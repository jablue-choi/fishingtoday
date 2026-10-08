import { useRef } from 'react'

/*
 * 조과 날짜·시각 고르기 (지난 기록·관리자 등록)
 * - 날짜: 오늘/어제/그저께 칩 + '달력에서' (기본 날짜 선택창은 고르면 바로 닫힘)
 * - 시각: 시·분(10분 단위) 선택 목록 + 시간대 칩
 * - value/onChange는 'YYYY-MM-DDTHH:mm' (기기 시간대)
 */
const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const toLocalInput = (d: Date) => `${ymd(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`
const WEEK = ['일', '월', '화', '수', '목', '금', '토']
const PARTS = [{ label: '새벽', h: 5 }, { label: '아침', h: 8 }, { label: '낮', h: 12 }, { label: '오후', h: 15 }, { label: '저녁', h: 18 }, { label: '밤', h: 21 }]

export default function DateTimeField({ value, onChange, label = '언제 잡았나요?' }: {
  value: string
  onChange: (v: string) => void
  label?: string
}) {
  const dateRef = useRef<HTMLInputElement>(null)
  const now = new Date()
  const d = new Date(value)
  const valid = !isNaN(d.getTime())
  const day = valid ? ymd(d) : ymd(now)
  const hh = valid ? d.getHours() : now.getHours()
  const mm = valid ? Math.floor(d.getMinutes() / 10) * 10 : 0
  const future = valid && d.getTime() > now.getTime()

  const days = [0, 1, 2].map(n => { const x = new Date(now); x.setDate(x.getDate() - n); return { key: ymd(x), label: ['오늘', '어제', '그저께'][n] } })
  const set = (date: string, h: number, m: number) => onChange(`${date}T${pad(h)}:${pad(m)}`)

  function openCalendar() {
    const el = dateRef.current
    if (!el) return
    try { el.showPicker() } catch { el.focus(); el.click() }
  }

  const title = valid
    ? `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEK[d.getDay()]}) ${hh < 12 ? '오전' : '오후'} ${hh % 12 || 12}:${pad(d.getMinutes())}`
    : '날짜를 골라 주세요'

  return (
    <div className="card">
      <div className="label" style={{ marginTop: 0 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 10 }}>{title}</div>

      <div className="chips">
        {days.map(x => <button key={x.key} type="button" className={`chip sm ${day === x.key ? 'on' : ''}`} onClick={() => set(x.key, hh, mm)}>{x.label}</button>)}
        <button type="button" className={`chip sm ${!days.some(x => x.key === day) ? 'on' : ''}`} onClick={openCalendar}>
          {!days.some(x => x.key === day) ? `${d.getMonth() + 1}/${d.getDate()}` : '달력에서'}
        </button>
        {/* 화면에는 안 보이는 기본 날짜 선택창 (고르면 바로 닫힘) */}
        <input ref={dateRef} type="date" value={day} max={ymd(now)} aria-label="날짜 고르기" tabIndex={-1}
          onChange={e => e.target.value && set(e.target.value, hh, mm)}
          style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} />
      </div>

      <div className="chips" style={{ marginTop: 8 }}>
        {PARTS.map(p => <button key={p.label} type="button" className={`chip sm ${hh === p.h && mm === 0 ? 'on' : ''}`} onClick={() => set(day, p.h, 0)}>{p.label} {p.h}시</button>)}
      </div>

      <div className="row" style={{ marginTop: 10, alignItems: 'center' }}>
        <select aria-label="시" value={hh} onChange={e => set(day, Number(e.target.value), mm)} style={SELECT}>
          {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{h < 12 ? '오전' : '오후'} {h % 12 || 12}시</option>)}
        </select>
        <select aria-label="분" value={mm} onChange={e => set(day, hh, Number(e.target.value))} style={SELECT}>
          {[0, 10, 20, 30, 40, 50].map(m => <option key={m} value={m}>{pad(m)}분</option>)}
        </select>
      </div>
      {future && <div className="error" style={{ marginTop: 8 }}>지금보다 이후 시각은 고를 수 없어요.</div>}
    </div>
  )
}

const SELECT: React.CSSProperties = {
  width: '100%', padding: '12px 14px', borderRadius: 12, border: '2px solid var(--surface)',
  background: 'var(--bg)', color: 'var(--ink)', fontSize: 16, appearance: 'auto',
}
