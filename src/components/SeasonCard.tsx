import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getLastPos } from '../lib/fishingIndex'
import { AREAS, guessArea, seasonPicks, type Area, type SeasonPick } from '../lib/seasons'

/** 홈·검색 추천: 이번 달 제철 어종 (금어기 제외) */
export default function SeasonCard({ limit = 5 }: { limit?: number }) {
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
      <b style={{ fontSize: 15 }}>{month}월 제철 어종</b>
      <div className="chips" style={{ margin: '8px 0 4px', flexWrap: 'nowrap', overflowX: 'auto' }}>
        {AREAS.map(a => (
          <button key={a} className={`chip ${area === a ? 'on' : ''}`} style={{ fontSize: 12, padding: '4px 10px', whiteSpace: 'nowrap' }} onClick={() => { setArea(a); setMore(false) }}>{a}</button>
        ))}
      </div>

      {err && <div style={{ fontSize: 13, color: '#B8531E' }}>추천 어종을 불러오지 못했어요.</div>}
      {!items && !err && <div style={{ fontSize: 13, color: 'var(--mute)' }}>불러오는 중…</div>}
      {items && items.length === 0 && <div style={{ fontSize: 13, color: 'var(--mute)' }}>이번 달 {area}에서 추천할 어종이 없어요.</div>}

      {shown.map(p => (
        <button
          key={p.speciesId}
          onClick={() => nav(`/search?mode=species&q=${encodeURIComponent(p.name)}`)}
          style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 0, borderTop: '1px solid var(--box)', padding: '8px 0', color: 'inherit', font: 'inherit', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <span>
              <b>{p.name}</b>
              {p.peak && <span style={{ color: '#fff', background: '#0A55B5', borderRadius: 999, padding: '1px 7px', fontSize: 11, marginLeft: 6 }}>제철</span>}
              {p.closingIn != null && <span style={{ color: '#fff', background: '#E8A13A', borderRadius: 999, padding: '1px 7px', fontSize: 11, marginLeft: 6 }}>D-{p.closingIn} 금어기 시작</span>}
            </span>
            <span style={{ fontSize: 12, color: 'var(--mute)', whiteSpace: 'nowrap' }}>{p.recent ? `최근 조황 ${p.recent}마리` : ''}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--mute)', marginTop: 2 }}>
            {[p.methods.join('·'), p.baits.join('·')].filter(Boolean).join(' / ')}{p.tip ? ` · ${p.tip}` : ''}
          </div>
        </button>
      ))}

      {items && items.length > limit && (
        <button className="chip" style={{ marginTop: 6, fontSize: 12 }} onClick={() => setMore(!more)}>{more ? '접기' : `${items.length - limit}종 더 보기`}</button>
      )}
      <div style={{ fontSize: 11, color: 'var(--mute)', marginTop: 8 }}>
        일반적인 시즌 안내예요. 지역·수온에 따라 달라요. 금어기인 어종은 빼고 보여 드려요.
      </div>
    </div>
  )
}
