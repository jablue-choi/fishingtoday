import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, signInWithKakao } from './supabase'

/*
 * 로그인 상태 + '로그인이 필요해요' 시트
 *  - 로그인 전에도 홈·검색·커뮤니티 읽기는 그대로
 *  - 기록·글쓰기·좋아요·제보 같은 참여 동작에서 requireLogin('질문을 올리려면') → 로그인 시트를 띄우고 false
 */
type Ctx = {
  session: Session | null
  ready: boolean
  /** 로그인돼 있으면 true, 아니면 로그인 시트를 띄우고 false */
  requireLogin: (why?: string) => boolean
}
const AuthCtx = createContext<Ctx>({ session: null, ready: false, requireLogin: () => false })
export const useAuth = () => useContext(AuthCtx)

/** 로그인 전이면 링크 이동을 막고 로그인 시트를 띄우는 onClick (목록 → 상세) */
export function useGuardClick(why = '글과 댓글을 보려면') {
  const { session, requireLogin } = useAuth()
  return (e: { preventDefault: () => void }) => { if (!session) { e.preventDefault(); requireLogin(why) } }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [why, setWhy] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session); setReady(true)
      // 카톡 인앱에서 넘어온 경우(?login=kakao): 표시를 지우고 로그인 안 돼 있으면 바로 카카오 로그인
      const url = new URL(window.location.href)
      if (url.searchParams.get('login') !== 'kakao') return
      url.searchParams.delete('login')
      window.history.replaceState(window.history.state, '', url.href)
      if (!data.session && !/KAKAOTALK/i.test(navigator.userAgent)) signInWithKakao(url.href)   // 인앱 그대로면 반복 방지
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const requireLogin = useCallback((reason?: string) => {
    if (session) return true
    setWhy(reason ?? '이 기능을 쓰려면')
    return false
  }, [session])

  return (
    <AuthCtx.Provider value={{ session, ready, requireLogin }}>
      {children}
      {why && <LoginSheet why={why} onClose={() => setWhy(null)} />}
    </AuthCtx.Provider>
  )
}

const PERKS = ['현위치만 찍으면 날씨·물때가 자동으로 기록돼요', '기록하고 사진 올리면 포인트가 쌓여요', '대화방에서 묻고 답하고, 내 조과를 자랑해요']

/** 아래에서 올라오는 로그인·가입 안내 */
export function LoginSheet({ why, onClose }: { why: string; onClose: () => void }) {
  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <div className="sheet" role="dialog" aria-modal="true" aria-label="로그인" onClick={e => e.stopPropagation()}>
        <LoginBody why={why} />
        <button className="btn ghost" style={{ marginTop: 8, boxShadow: 'none', border: 0, background: 'transparent', color: 'var(--mute)', fontSize: 14 }} onClick={onClose}>
          조금 더 둘러볼게요
        </button>
      </div>
    </div>
  )
}

/** 로그인이 필요한 화면(기록하기·내 기록 등) 대신 보여 주는 안내 */
export function LoginGate({ why, children }: { why: string; children: ReactNode }) {
  const { session, ready } = useAuth()
  if (!ready) return null
  if (session) return <>{children}</>
  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '80dvh' }}>
      <div className="card"><LoginBody why={why} /></div>
    </div>
  )
}

function LoginBody({ why }: { why: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <img src="/icon-192.png" alt="" width={64} height={64} style={{ borderRadius: 16 }} />
      <div style={{ fontSize: 20, fontWeight: 900, marginTop: 10 }}>{why} 로그인이 필요해요</div>
      <div className="sub" style={{ marginTop: 4 }}>카카오로 3초면 가입돼요. 보던 화면으로 바로 돌아와요.</div>
      <div className="list" style={{ margin: '14px 0', textAlign: 'left' }}>
        {PERKS.map(p => <div key={p} className="item dot" style={{ fontSize: 14 }}>{p}</div>)}
      </div>
      <button className="btn kakao" onClick={() => signInWithKakao()}>
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="#191919" d="M12 4C7 4 3 7.1 3 11c0 2.5 1.7 4.7 4.2 6l-1 3.6c-.1.3.3.6.6.4l4.2-2.8c.3 0 .7.1 1 .1 5 0 9-3.1 9-7s-4-7.3-9-7.3z" /></svg>
        카카오로 3초 만에 시작
      </button>
      <div className="note" style={{ textAlign: 'center' }}>네이버 로그인은 준비 중이에요. 가입하면 다른 사람에게는 닉네임만 보여요.</div>
    </div>
  )
}
