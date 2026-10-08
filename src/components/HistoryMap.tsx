import { useEffect, useRef, useState } from 'react'
import { loadKakaoMap } from '../lib/kakaoMap'
import type { LogRow } from '../lib/records'

type Group = { lat: number; lon: number; fish: number; logs: LogRow[] }

/** 약 100m 안의 기록을 한 지점으로 묶는다 */
function groupLogs(rows: LogRow[]): Group[] {
  const m = new Map<string, Group>()
  for (const r of rows) {
    const k = `${r.lat.toFixed(3)},${r.lon.toFixed(3)}`
    const g = m.get(k) ?? { lat: r.lat, lon: r.lon, fish: 0, logs: [] }
    if (r.log_type === 'catch') g.fish += r.count || 0
    g.logs.push(r)
    m.set(k, g)
  }
  return [...m.values()]
}

export default function HistoryMap({ rows }: { rows: LogRow[] }) {
  const box = useRef<HTMLDivElement>(null)
  const [err, setErr] = useState('')
  const [picked, setPicked] = useState<Group | null>(null)

  useEffect(() => {
    let alive = true
    const overlays: any[] = []
    loadKakaoMap().then(kakao => {
      if (!alive || !box.current) return
      const groups = groupLogs(rows)
      const map = new kakao.maps.Map(box.current, {
        center: new kakao.maps.LatLng(groups[0]?.lat ?? 37.5665, groups[0]?.lon ?? 126.978),
        level: 9,
      })
      map.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.RIGHT)
      if (!groups.length) return
      const bounds = new kakao.maps.LatLngBounds()

      for (const g of groups) {
        const ll = new kakao.maps.LatLng(g.lat, g.lon)
        bounds.extend(ll)
        const el = document.createElement('button')
        const zeroOnly = g.fish === 0
        el.textContent = zeroOnly ? '꽝' : String(g.fish)
        el.style.cssText = `
          min-width:30px;height:30px;padding:0 8px;border-radius:15px;border:2px solid #fff;
          background:${zeroOnly ? '#8A8D86' : '#FF4B33'};color:#fff;font-weight:700;font-size:12px;
          box-shadow:0 1px 4px rgba(0,0,0,.3);cursor:pointer;`
        el.onclick = () => setPicked(g)
        const ov = new kakao.maps.CustomOverlay({ position: ll, content: el, yAnchor: 0.5 })
        ov.setMap(map)
        overlays.push(ov)
      }
      if (groups.length === 1) { map.setCenter(bounds.getSouthWest()); map.setLevel(5) }
      else map.setBounds(bounds, 40, 40, 40, 40)
    }).catch(e => setErr((e as Error).message))
    return () => { alive = false; overlays.forEach(o => o.setMap(null)) }
  }, [rows])

  if (err) return <div className="card" style={{ color: 'var(--danger)', fontSize: 13 }}>{err}</div>

  return (
    <div>
      <div ref={box} style={{ width: '100%', height: 360, borderRadius: 12, overflow: 'hidden', background: 'var(--box)' }} />
      <div style={{ fontSize: 12, color: 'var(--mute)', margin: '6px 0 10px' }}>
        숫자는 그 지점에서 잡은 마릿수예요. 눌러서 기록을 볼 수 있어요.
      </div>
      {picked && (
        <div className="card">
          <div className="row" style={{ alignItems: 'center', marginBottom: 6 }}>
            <b>이 지점 기록 {picked.logs.length}건</b>
            <button className="chip" style={{ flex: 0 }} onClick={() => setPicked(null)}>닫기</button>
          </div>
          {picked.logs.map(r => (
            <div key={r.id} className="kv">
              <span>{new Date(r.caught_at).toLocaleDateString('ko-KR')} · {r.weather ?? ''}</span>
              <b>{r.log_type === 'zero' ? '꽝' : `${r.species_name ?? ''} ${r.size_cm ?? ''}cm ×${r.count}`}{r.log_type === 'release' ? ' (방생)' : ''}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
