import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchFishingIndex, getLastPos, SCORE_COLOR, type FishingIndex } from '../lib/fishingIndex'

type Spot = { id: string; name: string; spot_type: string; source: string; species_text: string | null; dist_km: number }

const TYPE_LABEL: Record<string, string> = { rock: '갯바위', boat: '선상', beach: '바다 낚시터', reservoir: '저수지', river: '하천', breakwater: '방파제' }
const RANK: Record<string, number> = { '매우좋음': 5, '좋음': 4, '보통': 3, '나쁨': 2, '매우나쁨': 1 }

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
          if (!prev || (RANK[i.score] ?? 0) > (RANK[prev.score] ?? 0)) m.set(i.name, i)
        }
        setIndex(m)
      })
  }, [pos, km, limit])

  if (!pos) return null

  return (
    <div className="card">
      <b style={{ fontSize: 15 }}>주변 낚시 포인트</b>
      {!spots && <div style={{ fontSize: 13, color: 'var(--mute)', marginTop: 6 }}>불러오는 중…</div>}
      {spots?.length === 0 && <div style={{ fontSize: 13, color: 'var(--mute)', marginTop: 6 }}>{km}km 안에 등록된 포인트가 아직 없어요.</div>}
      {spots?.map(s => {
        const idx = index.get(s.name)
        return (
          <div key={s.id} style={{ borderTop: '1px solid var(--box)', padding: '8px 0', marginTop: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span>
                <b>{s.name}</b>
                <span style={{ fontSize: 12, color: 'var(--mute)', marginLeft: 6 }}>{TYPE_LABEL[s.spot_type] ?? s.spot_type} · {s.dist_km.toFixed(1)}km</span>
              </span>
              {idx && <span style={{ color: '#fff', background: SCORE_COLOR[idx.score] ?? '#8A8D86', borderRadius: 999, padding: '1px 8px', fontSize: 11, whiteSpace: 'nowrap' }}>오늘 {idx.score}</span>}
            </div>
            {s.species_text && <div style={{ fontSize: 12, color: 'var(--mute)', marginTop: 2 }}>{s.species_text}</div>}
          </div>
        )
      })}
      <div style={{ fontSize: 11, color: 'var(--mute)', marginTop: 8 }}>마지막으로 찍은 위치 기준이에요. 지수는 국립해양조사원 바다낚시지수예요.</div>
    </div>
  )
}
