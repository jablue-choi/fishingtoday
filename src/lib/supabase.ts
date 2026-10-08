import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
)

/**
 * 카카오 로그인 (Supabase 기본 provider). 네이버는 2단계에서 엣지 함수로 붙인다.
 * 로그인 후 보던 화면으로 돌아오게 경로를 저장해 두고, 카카오에서는 홈으로 돌아옴 (Supabase Site URL·Redirect URLs에 운영 도메인 필요)
 */
export async function signInWithKakao(returnTo: string = window.location.href) {
  const url = new URL(returnTo, window.location.origin)
  // 해시(#access_token·#error·#top 등)가 남아 있으면 토큰이 붙을 자리가 꼬여 로그인이 안 됨 → 보던 경로만 남김
  url.hash = ''
  for (const k of ['error', 'error_code', 'error_description', 'code']) url.searchParams.delete(k)
  const target = url.origin === window.location.origin ? url.href : window.location.origin

  // 카톡 인앱 브라우저: 카카오 로그인이 카톡 앱·외부 브라우저로 넘어가면서 세션이 다른 브라우저에 생김 → 외부 브라우저로 열어 거기서 로그인
  if (/KAKAOTALK/i.test(navigator.userAgent)) {
    const ext = new URL(target); ext.searchParams.set('login', 'kakao')   // 외부 브라우저에서 바로 로그인 이어가기 (AuthProvider)
    window.location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(ext.href)}`
    return
  }
  // 카카오에서 돌아오는 주소는 항상 홈(Redirect URLs에 확실히 있는 주소). 보던 화면은 저장했다가 AuthProvider가 로그인 후 이동
  const back = new URL(target)
  try { localStorage.setItem(RETURN_KEY, JSON.stringify({ path: back.pathname + back.search, at: Date.now() })) } catch { /* 저장 못 하면 홈으로 */ }
  // 끝에 '/' 붙이면 Redirect URLs의 'https://fishingtoday.vercel.app'과 안 맞아 Site URL로 가 버림 → origin 그대로
  await supabase.auth.signInWithOAuth({ provider: 'kakao', options: { redirectTo: window.location.origin } })
}

const RETURN_KEY = 'login_return'

/** 로그인 전에 보던 경로 (10분 안에 저장된 것만, 한 번 꺼내면 지움) */
export function takeLoginReturn(): string | null {
  try {
    const raw = localStorage.getItem(RETURN_KEY)
    localStorage.removeItem(RETURN_KEY)
    const v = raw ? JSON.parse(raw) as { path?: string; at?: number } : null
    if (!v?.path?.startsWith('/') || v.path.startsWith('//') || Date.now() - (v.at ?? 0) > 10 * 60e3) return null
    return v.path
  } catch { return null }
}

export function signOut() {
  return supabase.auth.signOut()
}
