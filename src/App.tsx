import { useEffect, useState } from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase, signInWithKakao } from './lib/supabase'
import Home from './pages/Home'
import LogCatch from './pages/LogCatch'
import MyRecords from './pages/MyRecords'

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (session === undefined) return null
  if (!session) return <Landing />

  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/log" element={<LogCatch />} />
        <Route path="/me" element={<MyRecords />} />
      </Routes>
      <nav className="tabs">
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'on' : '')}>홈</NavLink>
        <NavLink to="/log" className={({ isActive }) => (isActive ? 'on' : '')}>기록</NavLink>
        <NavLink to="/me" className={({ isActive }) => (isActive ? 'on' : '')}>내 기록</NavLink>
      </nav>
    </>
  )
}

function Landing() {
  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', justifyContent: 'flex-end' }}>
      <h1 style={{ fontSize: 28 }}>잡은 만큼 쌓이는<br />낚시 기록</h1>
      <p style={{ color: 'var(--mute)' }}>기록할 때마다 포인트가 쌓여요</p>
      <button className="btn kakao" onClick={() => signInWithKakao()}>카카오로 3초 만에 시작</button>
      <p style={{ fontSize: 12, color: 'var(--mute)', textAlign: 'center' }}>네이버 로그인은 준비 중</p>
    </div>
  )
}
