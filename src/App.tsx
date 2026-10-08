import { useEffect, useState } from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase, signInWithKakao } from './lib/supabase'
import Home from './pages/Home'
import LogCatch from './pages/LogCatch'
import MyRecords from './pages/MyRecords'
import Search from './pages/Search'
import NicknameSetup from './pages/NicknameSetup'
import Icon from './components/Icon'
import Settings from './pages/Settings'
import Admin from './pages/Admin'
import Ranking from './pages/Ranking'
import RecordEdit from './pages/RecordEdit'
import Community from './pages/Community'
import CommunityRoom from './pages/CommunityRoom'
import CommunityPost from './pages/CommunityPost'
import Feed from './pages/Feed'
import FeedNew from './pages/FeedNew'
import FeedPost from './pages/FeedPost'
import Places from './pages/Places'
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
        <Route path="/me/:id" element={<RecordEdit />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/ranking" element={<Ranking />} />
        <Route path="/community" element={<Community />} />
        <Route path="/feed" element={<Feed />} />
        <Route path="/feed/new" element={<FeedNew />} />
        <Route path="/feed/:id" element={<FeedPost />} />
        <Route path="/places" element={<Places />} />
        <Route path="/community/post/:id" element={<CommunityPost />} />
        <Route path="/community/:type/:key" element={<CommunityRoom />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
      <nav className="tabs">
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'on' : '')}><Icon name="home" size={20} />홈</NavLink>
        <NavLink to="/search" className={({ isActive }) => (isActive ? 'on' : '')}><Icon name="search" size={20} />검색</NavLink>
        <NavLink to="/log" className="rec" aria-label="조과 기록하기"><span className="rec-btn"><Icon name="camera" size={22} /></span>기록하기</NavLink>
        <NavLink to="/community" className={({ isActive }) => (isActive ? 'on' : '')}><Icon name="chat" size={20} />커뮤니티</NavLink>
        <NavLink to="/me" className={({ isActive }) => (isActive ? 'on' : '')}><Icon name="user" size={20} />내 기록</NavLink>
      </nav>
    </>
  )
}

function Landing() {
  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', justifyContent: 'flex-end' }}>
      <img src="/icon-192.png" alt="" width={88} height={88} style={{ marginBottom: 16 }} />
      <h1 style={{ fontSize: 30 }}>오늘낚시</h1>
      <p style={{ color: 'var(--mute)', marginTop: 0 }}>현위치 찍으면 물때·날씨가 자동으로,<br />기록하면 포인트가 쌓여요</p>
      <button className="btn kakao" onClick={() => signInWithKakao()}>카카오로 3초 만에 시작</button>
      <p style={{ fontSize: 12, color: 'var(--mute)', textAlign: 'center' }}>네이버 로그인은 준비 중</p>
      <p style={{ fontSize: 11, color: 'var(--mute)', textAlign: 'center', marginTop: 16 }}>© 153랩</p>
    </div>
  )
}
