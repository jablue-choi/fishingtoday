import { useEffect, useState } from 'react'
import { fetchFishingIndex, scoreClass, SCORE_RANK, type FishingIndex } from '../lib/fishingIndex'

type Pos = { lat: number; lon: number }

/** 고른 위치 근처의 오늘 바다낚시지수 (가까운 지점 3곳, 지점마다 가장 좋은 시간대) */
export default function LocalIndex({ pos, title = '이 지역 오늘 바다낚시지수' }: { pos: Pos; title?: string }) {
  const [items, setItems] = useState<FishingIndex[] | null>(null)

  useEffect(() => {
    setItems(null)
    const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)
    Promise.all((['갯바위', '선상'] as const).map(g => fetchFishingIndex(g, pos, 60).catch(() => ({ items: [] as FishingIndex[] }))))
      .then(res => {
        const best = new Map<string, FishingIndex>()
        for (const i of res.flatMap(r => r.items)) {
          if (i.date !== today) continue
          const prev = best.get(i.name)
          if (!prev || (SCORE_RANK[i.score] ?? 0) > (SCORE_RANK[prev.score] ?? 0)) best.set(i.name, i)
        }
        setItems([...best.values()].sort((a, b) => (a.dist_km ?? 0) - (b.dist_km ?? 0)).slice(0, 3))
      })
  }, [pos.lat, pos.lon])

  return (
    <div className="card" style={{ marginTop: 10 }}>
      <div className="card-title" style={{ marginBottom: 8 }}><span className="dot-mark" />{title}</div>
      {!items ? <div className="empty">불러오는 중…</div> : items.length === 0 ? (
        <div className="empty">가까운 바다낚시지수 지점이 없어요 (내륙·민물이면 지수가 없어요).</div>
      ) : (
        <div className="list">
          {items.map(i => (
            <div key={i.name} className="item item-row">
              <div style={{ minWidth: 0 }}>
                <div className="item-title">{i.name} <span className="sub" style={{ fontWeight: 500 }}>{i.dist_km != null ? `· ${i.dist_km.toFixed(1)}km` : ''}</span></div>
                <div className="sub" style={{ fontSize: 11 }}>{[i.fish && `대상어 ${i.fish}`, i.time, i.water_temp && `수온 ${i.water_temp}°C`, i.wave && `파고 ${i.wave}m`].filter(Boolean).join(' · ')}</div>
              </div>
              <span className={scoreClass(i.score)}>{i.score}</span>
            </div>
          ))}
        </div>
      )}
      <div className="note" style={{ marginTop: 6 }}>국립해양조사원 바다낚시지수 · 오늘 기준</div>
    </div>
  )
}
