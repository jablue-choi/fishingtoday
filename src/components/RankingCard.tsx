import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchRanking, type RankRow } from '../lib/ranking'
import RankingList from './RankingList'
import Icon from './Icon'

/** 홈: 오늘의 낚시왕 1~3위 (+ 내 순위) */
export default function RankingCard() {
  const [rows, setRows] = useState<RankRow[] | null>(null)
  useEffect(() => { fetchRanking('today', 3).then(setRows).catch(() => setRows([])) }, [])
  if (!rows) return null

  const top = rows.filter(r => r.rank <= 3)
  const me = rows.find(r => r.is_me && r.rank > 3)

  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title"><span style={{ color: 'var(--accent)', display: 'inline-flex' }}><Icon name="trophy" size={16} /></span>오늘의 낚시왕</div>
        <Link to="/ranking" className="more">전체 순위<Icon name="chevron" size={12} /></Link>
      </div>
      {top.length === 0 ? (
        <div className="empty">오늘은 아직 공개된 조과가 없어요. 지금 기록하면 바로 1위예요.
          <div style={{ marginTop: 8 }}><Link to="/ranking?p=week" className="chip sm" style={{ textDecoration: 'none' }}>이번 주 순위 보기</Link></div>
        </div>
      ) : <RankingList rows={top} />}
      {me && <div className="note">내 순위는 {me.rank}위예요 · 스코어 {me.score}</div>}
    </div>
  )
}
