import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, signOut } from '../lib/supabase'

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
      <div className="row" style={{ alignItems: 'center', marginBottom: 12 }}>
        <h1 style={{ margin: 0 }}>안녕하세요, {nick}님</h1>
        <span className="pill" style={{ flex: 0 }}>{balance.toLocaleString()}P</span>
      </div>
      <div className="card">
        <div style={{ fontWeight: 700 }}>오늘</div>
        <div style={{ color: 'var(--mute)', fontSize: 13 }}>물때·날씨는 기록 화면에서 현위치 찍으면 자동으로 들어가요.</div>
      </div>
      <Link to="/log" className="btn" style={{ textAlign: 'center', textDecoration: 'none' }}>현위치 찍고 기록 시작</Link>
      <button className="btn ghost" style={{ marginTop: 24 }} onClick={() => signOut()}>로그아웃</button>
    </div>
  )
}
