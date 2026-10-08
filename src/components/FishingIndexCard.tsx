import { useEffect, useState } from 'react'
import { fetchFishingIndex, getLastPos, SCORE_COLOR, type FishingIndex, type Gubun } from '../lib/fishingIndex'

const RANK: Record<string, number> = { '매우좋음': 5, '좋음': 4, '보통': 3, '나쁨': 2, '매우나쁨': 1 }
const best = (list: FishingIndex[]) => Math.max(0, ...list.map(i => RANK[i.score] ?? 0))
const TITLE: Record<string, string> = { '갯바위': '오늘 바다낚시지수', '선상': '오늘 바다낚시지수', '바다여행': '오늘 바다여행지수' }

/** 홈: 내 주변(마지막 위치) 바다낚시지수. 위치가 없으면 전국 상위. */
export default function FishingIndexCard({ title, nationwide = false, limit = 4 }: { title?: string; nationwide?: boolean; limit?: number }) {
  const [gubun, setGubun] = useState<Gubun>('갯바위')
  const [items, setItems] = useState<FishingIndex[] | null>(null)
  const [err, setErr] = useState('')
  const [ship, setShip] = useState<FishingIndex[] | null>(null)
  const near = nationwide ? null : getLastPos()

  useEffect(() => {
    setItems(null); setErr('')
    fetchFishingIndex(gubun, near ?? undefined, 200)
      .then(d => {
        // 장소당 한 번만: 가장 이른 날짜(보통 오늘) 것만 남기고, 같은 날의 오전/오후·어종은 함께 묶기
        const firstDate = new Map<string, string>()
        for (const i of d.items) {
          const cur = firstDate.get(i.name)
          if (!cur || i.date < cur) firstDate.set(i.name, i.date)
        }
        const byPlace = new Map<string, FishingIndex[]>()
        for (const i of d.items) {
          if (i.date !== firstDate.get(i.name)) continue
          byPlace.set(i.name, [...(byPlace.get(i.name) ?? []), i])
        }
        // 전국 모드는 그날 가장 좋은 지수 순, 주변 모드는 서버가 준 거리 순 유지
        let places = [...byPlace.values()]
        if (!near) places = places.sort((a, b) => best(b) - best(a))
        setItems(places.slice(0, limit).flat())
      })
      .catch(e => setErr((e as Error).message))
  }, [gubun]) // eslint-disable-line react-hooks/exhaustive-deps

  // 선상 탭: 가장 가까운 해역의 선박운항지수(오늘)를 함께 표시
  useEffect(() => {
    setShip(null)
    if (gubun !== '선상') return
    fetchFishingIndex('선박운항', near ?? undefined, 6)
      .then(d => {
        const first = d.items[0]
        if (!first) return
        setShip(d.items.filter(i => i.name === first.name && i.date === first.date))
      })
      .catch(() => setShip([]))
  }, [gubun]) // eslint-disable-line react-hooks/exhaustive-deps

  const groups = new Map<string, FishingIndex[]>()
  for (const i of items ?? []) { const k = `${i.name}|${i.date}`; groups.set(k, [...(groups.get(k) ?? []), i]) }

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
        <b style={{ fontSize: 15 }}>{title ?? TITLE[gubun]}</b>
        <div className="chips" style={{ flexWrap: 'nowrap' }}>
          {(['갯바위', '선상', '바다여행'] as Gubun[]).map(g => (
            <button key={g} className={`chip ${gubun === g ? 'on' : ''}`} style={{ fontSize: 12, padding: '4px 10px', whiteSpace: 'nowrap' }} onClick={() => setGubun(g)}>{g === '바다여행' ? '여행' : g}</button>
          ))}
        </div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--mute)', marginBottom: 6 }}>
        {near && !nationwide ? '마지막으로 기록한 위치 기준 가까운 곳' : '전국 지수 높은 순'} · 국립해양조사원{gubun === '바다여행' ? ' 바다여행지수 (가족 나들이용)' : ''}
      </div>
      {gubun === '선상' && ship && ship.length > 0 && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', fontSize: 12, padding: '6px 8px', background: 'var(--paper)', borderRadius: 8, marginBottom: 6 }}>
          <span>⛴ 선박운항 · {ship[0].name}{ship[0].dist_km != null ? ` (${ship[0].dist_km.toFixed(0)}km)` : ''}</span>
          {ship.map((i, idx) => (
            <span key={`${i.time}-${idx}`} style={{ padding: '1px 7px', borderRadius: 999, color: '#fff', background: SCORE_COLOR[i.score] ?? '#8A8D86' }}>{i.time} {i.score}</span>
          ))}
        </div>
      )}
      {err && <div style={{ fontSize: 13, color: '#B8531E' }}>{err}</div>}
      {!items && !err && <div style={{ fontSize: 13, color: 'var(--mute)' }}>불러오는 중…</div>}
      {[...groups.values()].map(g => {
        // 같은 포인트·날짜 안에서 어종별로 오전/오후 묶기
        const byFish = new Map<string, FishingIndex[]>()
        for (const i of g) { const f = i.fish ?? (gubun === '바다여행' ? '바다여행' : '전체'); byFish.set(f, [...(byFish.get(f) ?? []), i]) }
        const head = g[0]
        return (
          <div key={head.name + head.date} style={{ padding: '8px 0', borderTop: '1px solid var(--box)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
              <b>{head.name}</b>
              <span style={{ fontSize: 12, color: 'var(--mute)' }}>{head.date === new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10) ? '오늘' : head.date.slice(5).replace('-', '/')}{head.dist_km != null ? ` · ${head.dist_km.toFixed(0)}km` : ''}</span>
            </div>
            {[...byFish.entries()].map(([fish, list]) => (
              <div key={fish} style={{ display: 'flex', gap: 6, marginTop: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                {fish !== '바다여행' && <span style={{ fontSize: 12, minWidth: 52 }}>{fish}</span>}
                {list.map((i, idx) => (
                  <span key={`${i.time}-${idx}`} style={{ fontSize: 12, padding: '2px 8px', borderRadius: 999, color: '#fff', background: SCORE_COLOR[i.score] ?? '#8A8D86' }}>
                    {i.time} {i.score}
                  </span>
                ))}
              </div>
            ))}
            <div style={{ fontSize: 11, color: 'var(--mute)', marginTop: 4 }}>
              {[head.weather && head.weather, head.tide && `물때 ${head.tide}`, head.water_temp && `수온 ${head.water_temp}°C`, head.wave && `파고 ${head.wave}m`, head.wind && `풍속 ${head.wind}m/s`].filter(Boolean).join(' · ')}
            </div>
          </div>
        )
      })}
    </div>
  )
}
