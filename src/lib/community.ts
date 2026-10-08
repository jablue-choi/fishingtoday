import { supabase } from './supabase'
import { friendlyError } from './moderation'

export type RoomType = 'today' | 'species' | 'region'
export type Post = {
  id: string; room_type: RoomType; room_key: string; body: string; region: string | null
  tags: string[]; region_key: string | null
  comment_count: number; created_at: string; user_id: string; hidden: boolean
  profiles: { nickname: string } | null
}
export type Comment = { id: string; post_id: string; body: string; created_at: string; user_id: string; hidden: boolean; profiles: { nickname: string } | null }
export type RoomStat = { room_type: RoomType; room_key: string; posts: number; last_at: string }

const POST_COLS = 'id,room_type,room_key,body,region,tags,region_key,comment_count,created_at,user_id,hidden,profiles(nickname)'
const COMMENT_COLS = 'id,post_id,body,created_at,user_id,hidden,profiles(nickname)'

/** 한국 시간 오늘 0시 */
export function todayStartIso() {
  const k = new Date(Date.now() + 9 * 3600e3)
  return new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate()) - 9 * 3600e3).toISOString()
}

export async function listPosts(type: RoomType, key: string, limit = 50): Promise<Post[]> {
  let q = supabase.from('community_posts').select(POST_COLS).eq('room_type', type).eq('room_key', key).order('created_at', { ascending: false }).limit(limit)
  if (type === 'today') q = q.gte('created_at', todayStartIso())
  const { data, error } = await q
  if (error) throw new Error('글을 불러오지 못했어요')
  return (data ?? []) as unknown as Post[]
}

export async function recentPosts(limit = 3): Promise<Post[]> {
  const { data, error } = await supabase.from('community_posts').select(POST_COLS).order('created_at', { ascending: false }).limit(limit)
  if (error) return []
  return (data ?? []) as unknown as Post[]
}

export async function getPost(id: string): Promise<Post | null> {
  const { data } = await supabase.from('community_posts').select(POST_COLS).eq('id', id).maybeSingle()
  return (data as unknown as Post) ?? null
}

export async function listComments(postId: string): Promise<Comment[]> {
  const { data, error } = await supabase.from('community_comments').select(COMMENT_COLS).eq('post_id', postId).order('created_at')
  if (error) throw new Error('댓글을 불러오지 못했어요')
  return (data ?? []) as unknown as Comment[]
}

export async function createPost(type: RoomType, key: string, body: string, region: string | null, regionKey: string | null = null, tags: string[] = []) {
  const { data, error } = await supabase.from('community_posts')
    .insert({ room_type: type, room_key: key, body: body.trim(), region, region_key: regionKey, tags: tags.slice(0, 5) }).select('id').single()
  if (error) throw new Error(friendlyError(error, '글을 올리지 못했어요. 2자 이상 1,000자 이하로 써 주세요.'))
  return data.id as string
}

export async function createComment(postId: string, body: string) {
  const { error } = await supabase.from('community_comments').insert({ post_id: postId, body: body.trim() })
  if (error) throw new Error(friendlyError(error, '댓글을 달지 못했어요.'))
}

export async function deletePost(id: string) { const { error } = await supabase.from('community_posts').delete().eq('id', id); if (error) throw new Error('지우지 못했어요.') }
export async function deleteComment(id: string) { const { error } = await supabase.from('community_comments').delete().eq('id', id); if (error) throw new Error('지우지 못했어요.') }

export async function report(type: 'post' | 'comment', id: string, reason: string) {
  const { error } = await supabase.from('community_reports').insert({ target_type: type, target_id: id, reason })
  if (error) throw new Error(error.code === '23505' ? '이미 신고했어요.' : '신고하지 못했어요.')
}

/** 흔히 틀리게 쓰는 어종 이름 → 정식 이름 */
const ALIAS: Record<string, string> = { '쭈꾸미': '주꾸미', '쭈구미': '주꾸미', '갑오': '갑오징어', '문어': '참문어', '넙치': '광어', '조피볼락': '우럭', '망둑어': '망둥어', '망둥이': '망둥어', '무늬': '무늬오징어', '감생이': '감성돔', '뺀찌': '벵에돔' }

/** 본문에서 어종 이름 찾기 → 태그 (긴 이름 우선: '쥐노래미'가 있으면 '노래미'는 빼기) */
export function detectTags(text: string, speciesNames: string[]): string[] {
  const t = text.replace(/\s+/g, '')
  const found = new Set<string>()
  for (const n of [...speciesNames].sort((a, b) => b.length - a.length)) {
    if (t.includes(n) && ![...found].some(f => f.includes(n))) found.add(n)
  }
  for (const [a, n] of Object.entries(ALIAS)) if (t.includes(a) && speciesNames.includes(n) && ![...found].some(f => f.includes(n))) found.add(n)
  return [...found].slice(0, 5)
}

/** 검색용: 어종 태그·지역으로 대화방 글 찾기 */
export async function searchPosts(species: string[], region: string, limit = 5): Promise<Post[]> {
  if (!species.length && !region) return []
  let q = supabase.from('community_posts').select(POST_COLS).order('created_at', { ascending: false }).limit(limit)
  if (species.length) q = q.overlaps('tags', species)
  for (const r of region.split(' ').filter(Boolean)) {
    const k = r.replace(/(도|시|군|구|읍|면|동|리)$/, '') || r
    q = q.or(`region_key.ilike.%${k}%,region.ilike.%${k}%,body.ilike.%${k}%`)
  }
  const { data } = await q
  return (data ?? []) as unknown as Post[]
}

export async function roomStats(): Promise<RoomStat[]> {
  const { data } = await supabase.rpc('community_room_stats')
  return (data ?? []) as RoomStat[]
}

export async function myUserId() {
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? ''
}

/** '3분 전', '2시간 전', '어제', '10/3' */
export function ago(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60) return '방금'
  if (s < 3600) return `${Math.floor(s / 60)}분 전`
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`
  if (s < 172800) return '어제'
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

/** 대화방별 질문 예시 (누르면 입력칸에 채움) */
export const QUICK: Record<RoomType, string[]> = {
  today: ['지금 바람 어떤가요?', '오늘 물색 어때요?', '지금 입질 있나요?', '주차 자리 있나요?'],
  species: ['요즘 잘 나오나요?', '채비 추천해 주세요', '물에 들어가야 하나요?', '시간대는 언제가 좋아요?'],
  region: ['요즘 뭐 잘 나와요?', '초보가 가기 좋은 곳 있나요?', '지금 바람 어떤가요?', '근처 낚시점 추천해 주세요'],
}
