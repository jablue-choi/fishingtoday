import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
)

/** 카카오 로그인 (Supabase 기본 provider). 네이버는 2단계에서 엣지 함수로 붙인다. */
export function signInWithKakao() {
  return supabase.auth.signInWithOAuth({
    provider: 'kakao',
    options: { redirectTo: window.location.origin },
  })
}

export function signOut() {
  return supabase.auth.signOut()
}
