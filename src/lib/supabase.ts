import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
)

/**
 * 카카오 로그인 (Supabase 기본 provider). 네이버는 2단계에서 엣지 함수로 붙인다.
 * 로그인 후 보던 화면으로 돌아오게 지금 주소로 되돌림 (Supabase Redirect URLs에 '<도메인>/**' 필요)
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
  await supabase.auth.signInWithOAuth({ provider: 'kakao', options: { redirectTo: target } })
}

export function signOut() {
  return supabase.auth.signOut()
}
