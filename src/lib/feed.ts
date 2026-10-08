import { supabase } from './supabase'
import { friendlyError } from './moderation'

export type FeedKind = 'gear' | 'recipe' | 'video'
export const FEED_KINDS: { k: FeedKind; label: string; desc: string }[] = [
  { k: 'gear', label: '장비 자랑', desc: '로드·릴·라인·루어 사진과 정보' },
  { k: 'recipe', label: '미끼 레시피', desc: '재료·만드는 법·대상 어종' },
  { k: 'video', label: '영상', desc: '유튜브 링크만 붙이면 제목·썸네일이 자동으로' },
]
export const VIDEO_TAGS = ['어종', '채비', '미끼만들기', '포인트', '조행기', '초보']

export type Gear = { rod?: string; reel?: string; line?: string; lure?: string }
export type Recipe = { ingredients?: string; steps?: string }
export type FeedPost = {
  id: string; user_id: string; kind: FeedKind; title: string; body: string | null; photo_url: string | null
  gear: Gear | null; recipe: Recipe | null; species_code: string | null; tags: string[]
  video_id: string | null; video_title: string | null; video_author: string | null
  like_count: number; comment_count: number; hidden: boolean; created_at: string
  profiles: { nickname: string } | null
}
export type FeedComment = { id: string; body: string; created_at: string; user_id: string; hidden: boolean; profiles: { nickname: string } | null }

const COLS = 'id,user_id,kind,title,body,photo_url,gear,recipe,species_code,tags,video_id,video_title,video_author,like_count,comment_count,hidden,created_at,profiles(nickname)'

export async function listFeed(kind: FeedKind | 'all', limit = 30): Promise<FeedPost[]> {
  let q = supabase.from('feed_posts').select(COLS).order('created_at', { ascending: false }).limit(limit)
  if (kind !== 'all') q = q.eq('kind', kind)
  const { data, error } = await q
  if (error) throw new Error('피드를 불러오지 못했어요')
  return (data ?? []) as unknown as FeedPost[]
}
export async function getFeed(id: string): Promise<FeedPost | null> {
  const { data } = await supabase.from('feed_posts').select(COLS).eq('id', id).maybeSingle()
  return (data as unknown as FeedPost) ?? null
}
export async function myLikes(ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set()
  const { data: { user } } = await supabase.auth.getUser()
  const { data } = await supabase.from('feed_likes').select('post_id').eq('user_id', user?.id ?? '').in('post_id', ids)
  return new Set((data ?? []).map(r => r.post_id as string))
}
export async function toggleLike(id: string, liked: boolean) {
  const { error } = liked
    ? await supabase.from('feed_likes').delete().eq('post_id', id).eq('user_id', (await supabase.auth.getUser()).data.user?.id ?? '')
    : await supabase.from('feed_likes').insert({ post_id: id })
  if (error) throw new Error(friendlyError(error, '좋아요를 누르지 못했어요.'))
}

/** 사진: 긴 변 1280px JPEG로 줄여서(EXIF 위치정보 제거) feed-photos/<내 id>/ 에 올리고 공개 주소 반환 */
export async function uploadPhoto(file: File): Promise<string> {
  const bmp = await createImageBitmap(file)
  const s = Math.min(1, 1280 / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s)
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  bmp.close()
  const blob: Blob = await new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('사진을 줄이지 못했어요'))), 'image/jpeg', 0.85))
  const { data: { user } } = await supabase.auth.getUser()
  const path = `${user!.id}/${Date.now()}.jpg`
  const { error } = await supabase.storage.from('feed-photos').upload(path, blob, { contentType: 'image/jpeg' })
  if (error) throw new Error(friendlyError(error, '사진을 올리지 못했어요.'))
  return supabase.storage.from('feed-photos').getPublicUrl(path).data.publicUrl
}

export type VideoMeta = { video_id: string; title: string; author: string; thumbnail: string }
export async function videoMeta(url: string): Promise<VideoMeta> {
  const { data, error } = await supabase.functions.invoke<VideoMeta & { error?: string }>('video_meta', { body: { url } })
  if (error || !data || data.error) throw new Error('유튜브 영상 주소를 확인해 주세요.')
  return data
}
export const thumbOf = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`

export async function createFeed(p: Partial<FeedPost>): Promise<string> {
  const { data, error } = await supabase.from('feed_posts').insert({
    kind: p.kind, title: p.title?.trim(), body: p.body?.trim() || null, photo_url: p.photo_url ?? null,
    gear: p.gear ?? null, recipe: p.recipe ?? null, species_code: p.species_code ?? null, tags: p.tags ?? [],
    video_id: p.video_id ?? null, video_title: p.video_title ?? null, video_author: p.video_author ?? null,
  }).select('id').single()
  if (error) throw new Error(friendlyError(error, '글을 올리지 못했어요. 제목은 2~60자로 써 주세요.'))
  return data.id as string
}
export async function deleteFeed(id: string) { const { error } = await supabase.from('feed_posts').delete().eq('id', id); if (error) throw new Error('지우지 못했어요.') }

export async function listFeedComments(id: string): Promise<FeedComment[]> {
  const { data } = await supabase.from('feed_comments').select('id,body,created_at,user_id,hidden,profiles(nickname)').eq('post_id', id).order('created_at')
  return (data ?? []) as unknown as FeedComment[]
}
export async function addFeedComment(id: string, body: string) {
  const { error } = await supabase.from('feed_comments').insert({ post_id: id, body: body.trim() })
  if (error) throw new Error(friendlyError(error, '댓글을 달지 못했어요.'))
}
export async function deleteFeedComment(id: string) { const { error } = await supabase.from('feed_comments').delete().eq('id', id); if (error) throw new Error('지우지 못했어요.') }
