import { useEffect, useState } from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import { AuthProvider, LoginGate, useAuth } from './lib/auth'
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
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  )
}

/** 로그인 전에도 그대로 둘러보기. 기록·내 기록·글쓰기·관리자는 LoginGate가 로그인 안내로 바꿔 보여 줌 */
function Shell() {
  const { session, ready } = useAuth()
  const [nickSet, setNickSet] = useState<boolean | undefined>(undefined)
  const uid = session?.user.id

  useEffect(() => {
    setNickSet(undefined)
    if (!uid) return
    // 프로필을 못 읽으면 설정 화면으로 막지 않고 그냥 진행
    fetchMyProfile().then(p => setNickSet(p?.nickname_set ?? true)).catch(() => setNickSet(true))
  }, [uid])

  if (!ready) return null
  if (uid && nickSet === undefined) return null
  if (uid && !nickSet) return <NicknameSetup onDone={() => setNickSet(true)} />

  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/log" element={<LoginGate why="조과를 기록하려면"><LogCatch /></LoginGate>} />
        <Route path="/search" element={<Search />} />
        <Route path="/me" element={<LoginGate why="내 기록을 보려면"><MyRecords /></LoginGate>} />
        <Route path="/me/:id" element={<LoginGate why="기록을 고치려면"><RecordEdit /></LoginGate>} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/ranking" element={<Ranking />} />
        <Route path="/community" element={<Community />} />
        <Route path="/feed" element={<Feed />} />
        <Route path="/feed/new" element={<LoginGate why="피드에 글을 올리려면"><FeedNew /></LoginGate>} />
        <Route path="/feed/:id" element={<LoginGate why="글과 댓글을 보려면"><FeedPost /></LoginGate>} />
        <Route path="/places" element={<Places />} />
        <Route path="/community/post/:id" element={<LoginGate why="글과 댓글을 보려면"><CommunityPost /></LoginGate>} />
        <Route path="/community/:type/:key" element={<CommunityRoom />} />
        <Route path="/admin" element={<LoginGate why="관리자 화면은"><Admin /></LoginGate>} />
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
