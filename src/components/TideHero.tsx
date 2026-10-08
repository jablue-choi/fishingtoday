import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { tideAt, fetchTideTable, tideLevel, TIDE_SOURCE, type TideTable, type TideExtreme } from '../lib/tide'
import { fetchMarineDash, nowHour, dirKo, MARINE_SOURCE, type MarineDash } from '../lib/marine'
import { fetchFishingIndex, scoreClass, SCORE_RANK, type FishingIndex } from '../lib/fishingIndex'
import { pulse } from '../lib/pulse'
import { sunTimes } from '../lib/sun'
import Icon from './Icon'

type Pos = { lat: number; lon: number }
const hm = (d: Date) => d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
const PHASE_HINT = { '사리': '물살 셈', '조금': '물살 약함' } as const

/** 홈 맨 위: 오늘 물때 + 물때 곡선(만조·간조) + 해양 지표 4칸 + 기록 버튼 */
export default function TideHero({ pos, nick, onPickLocation, onUseGps }: { pos: Pos | null; nick: string; onPickLocation: () => void; onUseGps: () => Promise<void> }) {
  const [locating, setLocating] = useState(false)
  const [gpsErr, setGpsErr] = useState('')
  const tide = tideAt(pos)
  const [dash, setDash] = useState<MarineDash | null>(null)
  const [idx, setIdx] = useState<FishingIndex | null>(null)
  const [table, setTable] = useState<TideTable | null>(null)

  useEffect(() => {
    setDash(null); setIdx(null); setTable(null)
    if (!pos) return
    fetchMarineDash(pos.lat, pos.lon).then(setDash).catch(() => setDash(null))
    fetchTideTable(pos).then(setTable).catch(() => setTable(null))
    const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)
    fetchFishingIndex('갯바위', pos, 20).then(d => {
      const near = d.items.filter(i => i.date === today)
      const first = near[0]
      if (!first) return
      const same = near.filter(i => i.name === first.name)
      setIdx(same.sort((a, b) => (SCORE_RANK[b.score] ?? 0) - (SCORE_RANK[a.score] ?? 0))[0])
    }).catch(() => setIdx(null))
  }, [pos?.lat, pos?.lon]) // eslint-disable-line react-hooks/exhaustive-deps

  const now = dash ? nowHour(dash) : undefined
  // 만조·간조와 곡선은 조석예보 우선, 못 불러오면 Open-Meteo 해수면 모델값
  const chart = useMemo(() => table ? buildChart(khoaSeries(table.extremes), table.extremes)
    : dash ? buildChart(dash.hours.filter(h => h.sea != null).map(h => ({ t: h.time.getTime(), v: h.sea! })), dash.extremes) : null, [table, dash])
  const extremes = table?.extremes ?? dash?.extremes ?? []
  const sun = pos ? sunTimes(pos.lat, pos.lon) : null
  const nextHigh = extremes.find(e => e.type === 'high' && e.time.getTime() > Date.now())
  const nextLow = extremes.find(e => e.type === 'low' && e.time.getTime() > Date.now())
  const rising = nextHigh && nextLow ? nextHigh.time < nextLow.time : null

  return (
    <div className="card dark">
      <div className="glow" />
      <div className="item-row" style={{ paddingBottom: 10, borderBottom: '1px solid var(--dark-line)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          {tide?.phase && <span className="badge accent-soft">{tide.phase === '사리' ? '사리 물때' : '조금 물때'}</span>}
          <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--on-dark-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nick ? `${nick}님, 오늘 물때` : '오늘 물때'}</span>
        </div>
        {tide && <span className="sub">{tide.system} 기준</span>}
      </div>

      <div className="item-row" style={{ margin: '12px 0', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span className="num" style={{ fontSize: 40, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1 }}>{tide?.label ?? '-'}</span>
          {tide?.phase && <span className="badge amber">{PHASE_HINT[tide.phase]}</span>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="sub" style={{ fontSize: 11 }}>{idx ? `${idx.name} 바다낚시지수` : '가까운 바다낚시지수'}</div>
          {idx ? <span className={scoreClass(idx.score)}>{idx.score}</span> : <span className="sub">{pos ? '불러오는 중…' : '-'}</span>}
        </div>
      </div>

      {!pos ? (
        <div className="dark-panel" style={{ fontSize: 13, color: 'var(--on-dark-strong)', marginBottom: 10 }}>
          현위치를 찍으면 이 지역의 바다낚시지수·물때 곡선·수온·파고·바람을 보여 드려요.
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn" disabled={locating} onClick={async () => { setLocating(true); setGpsErr(''); try { await onUseGps() } catch (e) { setGpsErr((e as Error).message) } finally { setLocating(false) } }}>
              <Icon name="pin" size={18} />{locating ? '찾는 중…' : '현위치 찍기'}
            </button>
            <button className="btn dark" style={{ border: '1px solid var(--dark-line)', flex: '0 0 auto', width: 'auto' }} onClick={onPickLocation}>장소 검색</button>
          </div>
          {gpsErr && <div className="error" style={{ marginTop: 6 }}>{gpsErr}</div>}
        </div>
      ) : (
        <>
          <div className="dark-panel">
            {chart ? (
              <>
                <div className="item-row" style={{ fontSize: 11, fontWeight: 800 }}>
                  <span style={{ color: 'var(--tide-low)' }}>{chart.low ? `간조 ${hm(chart.low.time)}` : ''}</span>
                  <span style={{ color: 'var(--accent)' }}>지금 {rising == null ? '' : rising ? '물 들어오는 중' : '물 빠지는 중'}</span>
                  <span style={{ color: 'var(--tide-high)' }}>{chart.high ? `만조 ${hm(chart.high.time)}` : ''}</span>
                </div>
                <svg viewBox="0 0 300 64" preserveAspectRatio="none" style={{ width: '100%', height: 64, display: 'block', margin: '6px 0' }} role="img" aria-label="오늘 물때 곡선">
                  <defs>
                    <linearGradient id="tideFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FF5722" stopOpacity=".35" /><stop offset="100%" stopColor="#FF5722" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <line x1="0" y1="16" x2="300" y2="16" stroke="#2C3E50" strokeWidth=".5" strokeDasharray="2,2" />
                  <line x1="0" y1="48" x2="300" y2="48" stroke="#2C3E50" strokeWidth=".5" strokeDasharray="2,2" />
                  <path d={`${chart.path} L300,64 L0,64 Z`} fill="url(#tideFill)" />
                  <path d={chart.path} fill="none" stroke="#FF5722" strokeWidth="2.5" className="wave-glow" />
                  <line x1={chart.nowX} y1="0" x2={chart.nowX} y2="64" stroke="#FF5722" strokeWidth="1" strokeDasharray="2,2" />
                  <circle cx={chart.nowX} cy={chart.nowY} r="5" fill="#FF5722" stroke="#fff" strokeWidth="2" />
                </svg>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, paddingTop: 6, borderTop: '1px solid var(--dark-line)', fontSize: 12 }}>
                  <div className="item-row" style={{ background: 'rgba(30,41,59,.6)', borderRadius: 8, padding: '5px 8px' }}>
                    <span className="sub">다음 만조</span><b className="num" style={{ color: 'var(--tide-high)' }}>{nextHigh ? hm(nextHigh.time) : '-'}</b>
                  </div>
                  <div className="item-row" style={{ background: 'rgba(30,41,59,.6)', borderRadius: 8, padding: '5px 8px' }}>
                    <span className="sub">다음 간조</span><b className="num" style={{ color: 'var(--tide-low)' }}>{nextLow ? hm(nextLow.time) : '-'}</b>
                  </div>
                  {sun && <>
                    <div className="item-row" style={{ background: 'rgba(30,41,59,.6)', borderRadius: 8, padding: '5px 8px' }}>
                      <span className="sub">일출</span><b className="num">{sun.rise ? hm(sun.rise) : '-'}</b>
                    </div>
                    <div className="item-row" style={{ background: 'rgba(30,41,59,.6)', borderRadius: 8, padding: '5px 8px' }}>
                      <span className="sub">일몰</span><b className="num">{sun.set ? hm(sun.set) : '-'}</b>
                    </div>
                  </>}
                </div>
              </>
            ) : <>
              <div className="sub">{dash || table ? '이 위치는 물때 곡선 자료가 없어요 (내륙·민물).' : '물때 곡선 불러오는 중…'}</div>
              {sun && <div className="sub" style={{ marginTop: 4 }}>일출 <b className="num">{sun.rise ? hm(sun.rise) : '-'}</b> · 일몰 <b className="num">{sun.set ? hm(sun.set) : '-'}</b></div>}
            </>}
          </div>

          <div className="metrics" style={{ margin: '10px 0' }}>
            <Metric icon="thermo" color="var(--cyan)" label="수온" value={now?.sst} unit="℃" />
            <Metric icon="wave" color="#29B6F6" label="파고" value={now?.wave} unit="m" />
            <Metric icon="wind" color="#FBBF24" label={`풍속${now?.windDir != null ? ` (${dirKo(now.windDir)})` : ''}`} value={now?.wind} unit="m/s" />
            <Metric icon="gauge" color="#34D399" label="기압" value={now?.pressure != null ? Math.round(now.pressure) : null} unit="hPa" />
          </div>
        </>
      )}

      <Link to="/log" className="btn" onPointerDown={pulse}>
        <Icon name="plus" size={20} />현위치 찍고 조과 기록하기<span className="tag">포인트 적립</span>
      </Link>
      {pos && <div className="note" style={{ marginTop: 8 }}>
        {table
          ? <>만조·간조는 {TIDE_SOURCE}({table.station.name} 기준, {table.station.dist_km}km), 수온·파고·바람은 {MARINE_SOURCE} 참고값이에요.</>
          : <>물때 곡선·수온·파고·바람은 {MARINE_SOURCE} 참고값이에요. 실제 조석표와 다를 수 있어요.</>}
      </div>}
    </div>
  )
}

function Metric({ icon, color, label, value, unit }: { icon: 'thermo' | 'wave' | 'wind' | 'gauge'; color: string; label: string; value: number | null | undefined; unit: string }) {
  return (
    <div className="metric">
      <span style={{ color, display: 'inline-flex' }}><Icon name={icon} size={15} /></span>
      <div className="m-label">{label}</div>
      <div className="m-value num">{value != null ? (typeof value === 'number' && !Number.isInteger(value) ? value.toFixed(1) : value) : '-'}<span className="m-unit">{value != null ? unit : ''}</span></div>
    </div>
  )
}

/** 조석예보 고·저조를 20분 간격 곡선 점으로 */
function khoaSeries(ex: TideExtreme[]) {
  const start = new Date(); start.setHours(0, 0, 0, 0)
  const out: { t: number; v: number }[] = []
  for (let t = start.getTime(); t <= start.getTime() + 24 * 3600e3; t += 20 * 60e3) {
    const v = tideLevel(ex, t)
    if (v != null) out.push({ t, v })
  }
  return out
}

/** 오늘 0~24시 해수면을 300x64 곡선으로 */
function buildChart(series: { t: number; v: number }[], extremes: { time: Date; type: 'high' | 'low' }[]) {
  const start = new Date(); start.setHours(0, 0, 0, 0)
  const end = start.getTime() + 24 * 3600e3
  const pts = series.filter(p => p.t >= start.getTime() && p.t <= end)
  if (pts.length < 6) return null
  const min = Math.min(...pts.map(p => p.v)), max = Math.max(...pts.map(p => p.v))
  const x = (t: number) => ((t - start.getTime()) / (end - start.getTime())) * 300
  const y = (v: number) => 56 - ((v - min) / Math.max(0.01, max - min)) * 46
  const xy = pts.map(p => [x(p.t), y(p.v)] as const)
  // 부드러운 곡선 (Catmull-Rom → 베지어)
  let path = `M${xy[0][0].toFixed(1)},${xy[0][1].toFixed(1)}`
  for (let i = 0; i < xy.length - 1; i++) {
    const p0 = xy[i - 1] ?? xy[i], p1 = xy[i], p2 = xy[i + 1], p3 = xy[i + 2] ?? p2
    path += ` C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)},${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)},${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`
  }
  const t = Date.now()
  const nearest = pts.reduce((a, b) => (Math.abs(b.t - t) < Math.abs(a.t - t) ? b : a))
  const today = extremes.filter(e => e.time.getTime() >= start.getTime() && e.time.getTime() <= end)
  return {
    path, nowX: x(t), nowY: y(nearest.v),
    low: today.find(e => e.type === 'low'), high: today.find(e => e.type === 'high'),
  }
}
