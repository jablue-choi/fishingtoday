import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, signOut } from '../lib/supabase'
import SearchBar from '../components/SearchBar'
import FishingIndexCard from '../components/FishingIndexCard'
import ClosedSeasonCard from '../components/ClosedSeasonCard'
import SeasonCard from '../components/SeasonCard'

export default function Home() {
  const [nick, setNick] = useState('')
  const [balance, setBalance] = useState(0)

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: p } = await supabase.from('profiles').select('nickname').eq('id', user.id).single()
      setNick(p?.nickname ?? '')
      const { data: b } = await supabase.from('point_balances').select('balance').eq('user_id', user.id).maybeSingle()
      setBalance(b?.balance ?? 0)
    })()
  }, [])

  return (
    <div className="page">
      <SearchBar />
      <div className="row" style={{ alignItems: 'center', marginBottom: 12 }}>
        <h1 style={{ margin: 0 }}>안녕하세요, {nick}님</h1>
        <span className="pill" style={{ flex: 0 }}>{balance.toLocaleString()}P</span>
      </div>
      <FishingIndexCard />
      <SeasonCard />
      <ClosedSeasonCard />
      <Link to="/log" className="btn" style={{ textAlign: 'center', textDecoration: 'none' }}>현위치 찍고 기록 시작</Link>
      <div className="row" style={{ marginTop: 10 }}>
        <Link to="/search?mode=recommend" className="btn ghost" style={{ textAlign: 'center', textDecoration: 'none' }}>이번 주 어디 갈까?</Link>
        <Link to="/me" className="btn ghost" style={{ textAlign: 'center', textDecoration: 'none' }}>내 기록 보기</Link>
      </div>
      <button className="btn ghost" style={{ marginTop: 24 }} onClick={() => signOut()}>로그아웃</button>
    </div>
  )
}
