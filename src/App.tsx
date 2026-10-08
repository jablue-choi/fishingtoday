import { useEffect, useState } from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase, signInWithKakao } from './lib/supabase'
import Home from './pages/Home'
import LogCatch from './pages/LogCatch'
import MyRecords from './pages/MyRecords'
import Search from './pages/Search'
import NicknameSetup from './pages/NicknameSetup'
import { fetchMyProfile } from './lib/profile'

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [nickSet, setNickSet] = useState<boolean | undefined>(undefined)
  const uid = session?.user.id

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    setNickSet(undefined)
    if (!uid) return
    // 프로필을 못 읽으면 설정 화면으로 막지 않고 그냥 진행
    fetchMyProfile().then(p => setNickSet(p?.nickname_set ?? true)).catch(() => setNickSet(true))
  }, [uid])

  if (session === undefined) return null
  if (!session) return <Landing />
  if (nickSet === undefined) return null
  if (!nickSet) return <NicknameSetup onDone={() => setNickSet(true)} />

  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/log" element={<LogCatch />} />
        <Route path="/search" element={<Search />} />
        <Route path="/me" element={<MyRecords />} />
      </Routes>
      <nav className="tabs">
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'on' : '')}>홈</NavLink>
        <NavLink to="/search" className={({ isActive }) => (isActive ? 'on' : '')}>검색</NavLink>
        <NavLink to="/log" className={({ isActive }) => (isActive ? 'on' : '')}>기록</NavLink>
        <NavLink to="/me" className={({ isActive }) => (isActive ? 'on' : '')}>내 기록</NavLink>
      </nav>
    </>
  )
}

function Landing() {
  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', justifyContent: 'flex-end' }}>
      <h1 style={{ fontSize: 30 }}>오늘낚시</h1>
      <p style={{ color: 'var(--mute)', marginTop: 0 }}>현위치 찍으면 물때·날씨가 자동으로,<br />기록하면 포인트가 쌓여요</p>
      <button className="btn kakao" onClick={() => signInWithKakao()}>카카오로 3초 만에 시작</button>
      <p style={{ fontSize: 12, color: 'var(--mute)', textAlign: 'center' }}>네이버 로그인은 준비 중</p>
      <p style={{ fontSize: 11, color: 'var(--mute)', textAlign: 'center', marginTop: 16 }}>© 153랩</p>
    </div>
  )
}
