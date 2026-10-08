import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
)

/**
 * 카카오 로그인 (Supabase 기본 provider). 네이버는 2단계에서 엣지 함수로 붙인다.
 * 로그인 후 보던 화면으로 돌아오게 지금 주소로 되돌림 (Supabase Redirect URLs에 '<도메인>/**' 필요)
 */
export function signInWithKakao(returnTo: string = window.location.href) {
  return supabase.auth.signInWithOAuth({
    provider: 'kakao',
    options: { redirectTo: returnTo.startsWith(window.location.origin) ? returnTo : window.location.origin },
  })
}

export function signOut() {
  return supabase.auth.signOut()
}
