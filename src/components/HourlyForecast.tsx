import { useEffect, useState } from 'react'
import { fetchMarineDash, sky, SKY_LABEL, MARINE_SOURCE, type Hour } from '../lib/marine'
import Icon from './Icon'

const SKY_COLOR = { sun: '#F59E0B', moon: '#818CF8', cloudSun: '#94A3B8', cloud: '#94A3B8', rain: '#3B82F6', snow: '#60A5FA', fog: '#94A3B8', storm: '#7C3AED' }
const waveClass = (w: number) => (w < 0.5 ? 'wave-ok' : w < 1.5 ? 'wave-mid' : 'wave-high')

/** 앞으로 12시간 1시간 단위 예보 (날씨·기온·파고·풍속) */
export default function HourlyForecast({ pos }: { pos: { lat: number; lon: number } | null }) {
  const [hours, setHours] = useState<Hour[] | null>(null)
  useEffect(() => {
    setHours(null)
    if (!pos) return
    fetchMarineDash(pos.lat, pos.lon).then(d => {
      const from = Date.now() - 30 * 60e3
      setHours(d.hours.filter(h => h.time.getTime() >= from).slice(0, 12))
    }).catch(() => setHours([]))
  }, [pos?.lat, pos?.lon]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!pos || (hours && hours.length === 0)) return null

  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title"><span style={{ color: 'var(--accent)', display: 'inline-flex' }}><Icon name="clock" size={16} /></span>12시간 예보</div>
        <span className="sub">1시간 단위</span>
      </div>
      {!hours ? <div className="empty">불러오는 중…</div> : (
        <div className="hscroll" style={{ margin: '0 -14px', padding: '0 14px 2px' }}>
          {hours.map((h, i) => {
            const s = sky(h.code, h.time)
            return (
              <div key={h.time.getTime()} className={`hour ${i === 0 ? 'now' : ''}`}>
                <div style={{ fontSize: 11, fontWeight: i === 0 ? 900 : 600, color: i === 0 ? 'var(--accent-ink)' : 'var(--mute)' }}>{i === 0 ? '지금' : `${h.time.getHours()}시`}</div>
                <div style={{ color: SKY_COLOR[s], margin: '4px 0 2px', display: 'flex', justifyContent: 'center' }} title={SKY_LABEL[s]}><Icon name={s} size={20} stroke={2} /></div>
                <div className="num" style={{ fontWeight: 900 }}>{h.temp != null ? `${Math.round(h.temp)}°` : '-'}</div>
                {h.wave != null && <div className={`wave-tag ${waveClass(h.wave)}`}>{h.wave.toFixed(1)}m</div>}
                <div className="num" style={{ fontSize: 10, fontWeight: (h.wind ?? 0) >= 5 ? 800 : 500, color: (h.wind ?? 0) >= 5 ? 'var(--warn)' : 'var(--mute)' }}>{h.wind != null ? `${h.wind.toFixed(1)}m/s` : ''}</div>
              </div>
            )
          })}
        </div>
      )}
      <div className="note">파고 초록 0.5m 미만 · 노랑 1.5m 미만 · 빨강 그 이상. {MARINE_SOURCE} 참고값이에요.</div>
    </div>
  )
}
