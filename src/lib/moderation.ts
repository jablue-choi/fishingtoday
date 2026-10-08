import { supabase } from './supabase'

export type Member = {
  id: string; nickname: string; provider: string; created_at: string
  logs: number; posts: number; comments: number; reports_received: number
  blocked: boolean; blocked_until: string | null; block_reason: string | null; is_admin: boolean
}
export type Report = {
  id: number; target_type: 'post' | 'comment' | 'feed' | 'feed_comment' | 'place_note'; target_id: string
  reason: string | null; created_at: string; reporter: string | null
  body: string | null; author_id: string | null; author: string | null; hidden: boolean | null; report_count: number | null
}
export const TARGET_LABEL: Record<Report['target_type'], string> = { post: '대화방 글', comment: '대화방 댓글', feed: '피드 글', feed_comment: '피드 댓글', place_note: '장소 제보' }

let blockCache: Promise<{ blocked: boolean; until: string | null; reason: string | null }> | null = null
/** 내가 차단됐는지 (글쓰기 화면 안내용) */
export function myBlockStatus() {
  if (!blockCache) blockCache = Promise.resolve(supabase.rpc('my_block_status')).then(({ data }) => {
    const r = (data ?? [])[0]
    return r ? { blocked: !!r.blocked, until: r.until, reason: r.reason } : { blocked: false, until: null, reason: null }
  }).catch(() => ({ blocked: false, until: null, reason: null }))
  return blockCache
}
export const blockText = (b: { until: string | null; reason: string | null }) =>
  `이용이 제한된 계정이에요${b.until ? ` (${new Date(b.until).toLocaleDateString('ko-KR')}까지)` : ''}. 글·댓글·제보를 쓸 수 없어요.${b.reason ? ` 사유: ${b.reason}` : ''}`

export async function listMembers(q: string): Promise<Member[]> {
  const { data, error } = await supabase.rpc('admin_list_members', { p_q: q.trim(), p_limit: 100 })
  if (error) throw new Error(error.message)
  return (data ?? []) as Member[]
}
export async function blockUser(id: string, days: number | null, reason: string, hide: boolean) {
  const { error } = await supabase.rpc('admin_block_user', { p_user: id, p_days: days, p_reason: reason, p_hide: hide })
  if (error) throw new Error(error.message)
}
export async function unblockUser(id: string) {
  const { error } = await supabase.rpc('admin_unblock_user', { p_user: id })
  if (error) throw new Error(error.message)
}
export async function listReports(): Promise<Report[]> {
  const { data, error } = await supabase.rpc('admin_list_reports', { p_limit: 100 })
  if (error) throw new Error(error.message)
  return (data ?? []) as Report[]
}
export async function setHidden(type: Report['target_type'], id: string, hidden: boolean) {
  const { error } = await supabase.rpc('admin_set_hidden', { p_type: type, p_id: id, p_hidden: hidden })
  if (error) throw new Error(error.message)
}

/** 신고: 대화방·피드·장소 제보 공통 (3건이면 자동 숨김) */
export async function reportContent(type: Report['target_type'], id: string, reason: string) {
  const { error } = await supabase.from('community_reports').insert({ target_type: type, target_id: id, reason: reason.slice(0, 200) })
  if (error) throw new Error(error.code === '23505' ? '이미 신고했어요.' : '신고하지 못했어요.')
}

/** DB 에러를 사용자 문구로 (차단·욕설·하루 제한) */
export function friendlyError(e: { message?: string; code?: string } | null, fallback: string) {
  const m = e?.message ?? ''
  if (/row-level security|violates row-level/.test(m)) return '이용이 제한된 계정이거나 쓸 수 없는 상태예요.'
  if (/욕설|하루|쓸 수 없는/.test(m)) return m
  return fallback
}
