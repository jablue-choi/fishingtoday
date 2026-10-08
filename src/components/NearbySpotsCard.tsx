import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchFishingIndex, getLastPos, scoreClass, SCORE_RANK, type FishingIndex } from '../lib/fishingIndex'

type Spot = { id: string; name: string; spot_type: string; source: string; species_text: string | null; dist_km: number }

const TYPE_LABEL: Record<string, string> = { rock: '갯바위', boat: '선상', beach: '바다 낚시터', reservoir: '저수지', river: '하천', breakwater: '방파제' }

/** 홈: 마지막 위치 근처 낚시 포인트 + 오늘 바다낚시지수 */
export default function NearbySpotsCard({ km = 30, limit = 5 }: { km?: number; limit?: number }) {
  const [pos] = useState(getLastPos)
  const [spots, setSpots] = useState<Spot[] | null>(null)
  const [index, setIndex] = useState<Map<string, FishingIndex>>(new Map())

  useEffect(() => {
    if (!pos) return
    supabase.rpc('spots_near', { p_lat: pos.lat, p_lon: pos.lon, p_km: km, p_limit: limit })
      .then(({ data }) => setSpots((data ?? []) as Spot[]))
    // 같은 이름 지점의 오늘 지수 (오전·오후 중 좋은 쪽)
    const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)
    Promise.all((['갯바위', '선상'] as const).map(g => fetchFishingIndex(g, pos, 200).catch(() => ({ items: [] as FishingIndex[] }))))
      .then(res => {
        const m = new Map<string, FishingIndex>()
        for (const i of res.flatMap(r => r.items)) {
          if (i.date !== today) continue
          const prev = m.get(i.name)
          if (!prev || (SCORE_RANK[i.score] ?? 0) > (SCORE_RANK[prev.score] ?? 0)) m.set(i.name, i)
        }
        setIndex(m)
      })
  }, [pos, km, limit])

  if (!pos) return null

  return (
    <div className="card">
      <div className="card-head"><div className="card-title"><span className="dot-mark" />주변 낚시 포인트</div><span className="sub">{km}km 안</span></div>
      {!spots && <div className="empty">불러오는 중…</div>}
      {spots?.length === 0 && <div className="empty">{km}km 안에 등록된 포인트가 아직 없어요.</div>}
      <div className="list">
        {spots?.map(s => {
          const idx = index.get(s.name)
          return (
            <div key={s.id} className="item" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="score-box num" style={{ background: 'var(--line-soft)', color: 'var(--ink-2)', fontSize: 11, flexDirection: 'column', lineHeight: 1.1 }}>
                {s.dist_km < 10 ? s.dist_km.toFixed(1) : Math.round(s.dist_km)}<span style={{ fontSize: 9, fontWeight: 700 }}>km</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="item-title">{s.name} <span className="sub" style={{ fontWeight: 500 }}>· {TYPE_LABEL[s.spot_type] ?? s.spot_type}</span></div>
                {s.species_text && <div className="sub" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>대상어: {s.species_text}</div>}
              </div>
              {idx && <span className={scoreClass(idx.score)}>{idx.score}</span>}
            </div>
          )
        })}
      </div>
      <div className="note">기준 위치에서 가까운 순이에요. 지수는 국립해양조사원 바다낚시지수예요.</div>
    </div>
  )
}
