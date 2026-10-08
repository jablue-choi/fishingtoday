import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getLastPos } from '../lib/fishingIndex'
import { AREAS, guessArea, seasonPicks, type Area, type SeasonPick } from '../lib/seasons'
import FishArt from './FishArt'
import Icon from './Icon'

/** 홈·검색 추천: 이번 달 제철 어종 (금어기 제외). 제철은 어두운 카드 */
export default function SeasonCard({ limit = 4 }: { limit?: number }) {
  const nav = useNavigate()
  const [area, setArea] = useState<Area>(() => guessArea(getLastPos()))
  const [items, setItems] = useState<SeasonPick[] | null>(null)
  const [err, setErr] = useState('')
  const [more, setMore] = useState(false)
  const month = new Date(Date.now() + 9 * 3600e3).getUTCMonth() + 1

  useEffect(() => {
    setItems(null); setErr('')
    seasonPicks(area).then(setItems).catch(e => setErr((e as Error).message))
  }, [area])

  const shown = items ? (more ? items : items.slice(0, limit)) : []

  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title"><span className="dot-mark" />{month}월 제철 어종 & 추천 채비</div>
        <Link to="/search?mode=recommend" className="more">전체보기<Icon name="chevron" size={12} /></Link>
      </div>
      <div className="chips" style={{ flexWrap: 'nowrap', overflowX: 'auto', marginBottom: 10 }}>
        {AREAS.map(a => <button key={a} className={`chip sm ${area === a ? 'on' : ''}`} onClick={() => { setArea(a); setMore(false) }}>{a}</button>)}
      </div>

      {err && <div className="error">추천 어종을 불러오지 못했어요.</div>}
      {!items && !err && <div className="empty">불러오는 중…</div>}
      {items && items.length === 0 && <div className="empty">이번 달 {area}에서 추천할 어종이 없어요.</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
        {shown.map(p => (
          <button key={p.speciesId} className={`tile ${p.peak ? 'dark' : ''}`} style={{ flex: 'none', width: '100%' }}
            onClick={() => nav(`/search?mode=species&q=${encodeURIComponent(p.name)}`)}>
            <div className="item-row">
              <span className={`badge ${p.peak ? 'accent' : ''}`}>{p.peak ? '제철 피크' : '시즌'}</span>
              {p.closingIn != null
                ? <span className="badge warn">D-{p.closingIn} 금어기</span>
                : p.recent > 0 && <span style={{ fontSize: 10, fontWeight: 800, color: p.peak ? '#34D399' : 'var(--good)', display: 'inline-flex', alignItems: 'center', gap: 2 }}><Icon name="fire" size={11} />조황 있음</span>}
            </div>
            <div style={{ margin: '4px -4px 0', display: 'flex', justifyContent: 'center' }}><FishArt code={p.code} name={p.name} size={104} /></div>
            <div style={{ fontSize: 16, fontWeight: 900 }}>{p.name}</div>
            <div className="sub">추천: {[p.methods[0], p.baits[0]].filter(Boolean).join(' · ')}</div>
            <div className="item-row" style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${p.peak ? 'var(--dark-line)' : 'var(--line)'}`, fontSize: 11 }}>
              <span className="sub" style={{ fontSize: 11 }}>최근 30일</span>
              <b style={{ color: p.peak ? 'var(--accent-hi)' : 'var(--accent-ink)' }}>{p.recent ? `${p.recent}마리` : '기록 없음'}</b>
            </div>
          </button>
        ))}
      </div>
      {items && items.length > limit && (
        <button className="chip sm" style={{ marginTop: 8 }} onClick={() => setMore(!more)}>{more ? '접기' : `${items.length - limit}종 더 보기`}</button>
      )}
      <div className="note">일반적인 시즌 안내예요. 지역·수온에 따라 달라요. 금어기인 어종은 빼고 보여 드려요.</div>
    </div>
  )
}
