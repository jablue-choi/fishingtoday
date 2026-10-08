import { supabase } from './supabase'

/** DB의 is_allowed_share_url()과 같은 목록. 다른 사람에게 보이는 링크라 주요 도메인만 받음 */
const ALLOWED = /^https:\/\/([a-z0-9-]+\.)*(blog\.naver\.com|cafe\.naver\.com|naver\.me|tistory\.com|cafe\.daum\.net|blog\.daum\.net|brunch\.co\.kr|velog\.io|instagram\.com|youtube\.com|youtu\.be|band\.us|threads\.net|threads\.com)(\/|$|\?)/i
export const SHARE_SITES = '네이버 블로그·카페, 티스토리, 다음 카페, 브런치, 인스타그램, 유튜브, 밴드, 스레드'

export function isAllowedShareUrl(u: string) { return u.length <= 500 && ALLOWED.test(u.trim()) }

/** 링크 표시용 사이트 이름 */
export function siteName(u: string) {
  const h = (() => { try { return new URL(u).hostname } catch { return '' } })()
  if (h.includes('blog.naver')) return '네이버 블로그'
  if (h.includes('cafe.naver') || h === 'naver.me') return '네이버 카페'
  if (h.includes('tistory')) return '티스토리'
  if (h.includes('cafe.daum')) return '다음 카페'
  if (h.includes('instagram')) return '인스타그램'
  if (h.includes('youtu')) return '유튜브'
  if (h.includes('band')) return '밴드'
  if (h.includes('brunch')) return '브런치'
  if (h.includes('threads')) return '스레드'
  return '자랑글'
}

/** 내 기록에 자랑글 링크 저장 (빈 값이면 지움) */
export async function saveShareUrl(logId: string, url: string) {
  const v = url.trim()
  if (v && !isAllowedShareUrl(v)) throw new Error(`${SHARE_SITES} 주소만 붙일 수 있어요.`)
  const { error } = await supabase.from('catch_logs').update({ share_url: v || null }).eq('id', logId)
  if (error) throw new Error('링크를 저장하지 못했어요.')
}

/** 휴대폰 공유창으로 자랑하기 (안 되면 문구 복사) */
export async function shareCatch(text: string): Promise<'shared' | 'copied'> {
  const url = 'https://fishingtoday.vercel.app'
  if (navigator.share) {
    try { await navigator.share({ title: '오늘낚시', text, url }); return 'shared' }
    catch (e) { if ((e as Error).name === 'AbortError') return 'shared' }
  }
  await navigator.clipboard.writeText(`${text}\n${url}`)
  return 'copied'
}
