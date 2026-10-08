import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { isAdmin, SOURCE_TYPES, sourceLabel, type SourceType } from '../lib/admin'
import { getLastPos } from '../lib/fishingIndex'
import { regionName } from '../lib/kakaoMap'
import { fetchPastWeather, PAST_WEATHER_SOURCE } from '../lib/pastWeather'
import { tideAt } from '../lib/tide'
import MapPicker from '../components/MapPicker'
import type { AutoFill } from '../lib/weather'
import { fetchSpecies, type Species } from '../lib/species'
import SpeciesPicker from '../components/SpeciesPicker'
import DateTimeField, { toLocalInput } from '../components/DateTimeField'

type Code = { code: string; label: string }
type Row = { id: string; caught_at: string; region: string | null; species_name: string | null; count: number; log_type: string; source_type: string | null; source_name: string | null }

const EMPTY = { log_type: 'catch', species_id: 0, size_cm: '', count: 1, method_code: '', bait_code: '', source_type: '' as SourceType | '', source_name: '', source_url: '', memo: '' }

/** 관리자: 조과 수동 등록 (출처 필수, 화면에 '관리자 등록'으로 표시, 포인트 없음) */
export default function Admin() {
  const [ok, setOk] = useState<boolean | null>(null)
  const [start] = useState(() => getLastPos() ?? { lat: 37.25, lon: 126.58 })
  const [pos, setPos] = useState(start)
  const [whenStr, setWhenStr] = useState(() => toLocalInput(new Date()))
  const [form, setForm] = useState(EMPTY)
  const [auto, setAuto] = useState<AutoFill | null>(null)
  const [species, setSpecies] = useState<Species[]>([])
  const [methods, setMethods] = useState<Code[]>([])
  const [baits, setBaits] = useState<Code[]>([])
  const [rows, setRows] = useState<Row[]>([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    isAdmin().then(setOk)
    fetchSpecies().then(setSpecies).catch(() => setSpecies([]))
    supabase.from('method_codes').select('code,label').then(({ data }) => setMethods(data ?? []))
    supabase.from('bait_codes').select('code,label').then(({ data }) => setBaits(data ?? []))
    loadRows()
  }, [])

  const when = new Date(whenStr)
  const whenOk = !isNaN(when.getTime()) && when.getTime() <= Date.now()
  useEffect(() => {
    if (!whenOk) return
    const t = window.setTimeout(() => { setAuto(null); fetchPastWeather(pos.lat, pos.lon, when).then(setAuto).catch(() => setAuto(null)) }, 600)
    return () => window.clearTimeout(t)
  }, [pos, whenStr]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadRows() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('catch_logs_v')
      .select('id,caught_at,region,species_name,count,log_type,source_type,source_name')
      .eq('user_id', user.id).eq('entered_by', 'admin').order('caught_at', { ascending: false }).limit(50)
    setRows((data ?? []) as Row[])
  }

  const set = (p: Partial<typeof EMPTY>) => setForm(f => ({ ...f, ...p }))
  const zero = form.log_type === 'zero'
  const canSave = whenOk && !!form.source_type && (zero || !!form.species_id) && !busy

  async function save() {
    if (!canSave) return
    setBusy(true); setMsg('')
    try {
      const region = await regionName(pos.lat, pos.lon)
      const { error } = await supabase.rpc('admin_add_catch', {
        p_caught_at: when.toISOString(), p_lat: pos.lat, p_lon: pos.lon, p_region: region,
        p_log_type: form.log_type, p_species_id: zero ? null : form.species_id,
        p_size_cm: zero || !form.size_cm ? null : Number(form.size_cm), p_count: zero ? 0 : form.count,
        p_method_code: zero ? null : form.method_code, p_bait_code: zero ? null : form.bait_code,
        p_weather: auto?.weather ?? null, p_temp_c: auto?.temp_c ?? null, p_wind_dir: auto?.wind_dir ?? null, p_wind_ms: auto?.wind_ms ?? null,
        p_tide_mul: tideAt(pos, when)?.mul ?? null,
        p_source_type: form.source_type, p_source_name: form.source_name, p_source_url: form.source_url, p_memo: form.memo,
      })
      if (error) throw new Error(error.message)
      setMsg('등록했어요. 검색 화면에 \'관리자 등록\'으로 표시돼요.')
      setForm(f => ({ ...EMPTY, source_type: f.source_type, source_name: f.source_name }))   // 같은 출처로 연속 등록하기 쉽게
      loadRows()
    } catch (e) { setMsg((e as Error).message) }
    finally { setBusy(false) }
  }

  async function remove(id: string) {
    if (!window.confirm('이 관리자 등록 기록을 지울까요?')) return
    const { error } = await supabase.from('catch_logs').delete().eq('id', id)
    if (error) setMsg(error.message); else loadRows()
  }

  if (ok === null) return null
  if (!ok) return <Navigate to="/" replace />

  const tide = whenOk ? tideAt(pos, when) : null

  return (
    <div className="page">
      <h1>관리자 조과 등록</h1>
      <div className="card plain" style={{ fontSize: 13 }}>
        등록한 기록은 검색·추천에 <span className="badge ink">관리자 등록</span> 표시와 출처가 함께 보여요. 포인트·스코어는 쌓이지 않아요.
        <div className="note">출처의 글·사진을 옮기지 말고 조황 사실(날짜·장소·어종·마릿수)만 적어 주세요. 커뮤니티 글은 출처로 쓰지 않아요.</div>
      </div>

      <DateTimeField value={whenStr} onChange={setWhenStr} label="언제" />

      <div className="label">어디서</div>
      <MapPicker initial={start} gps={start} onChange={setPos} level={7} backLabel="처음 위치로" />
      <div className="card auto" style={{ fontSize: 14 }}>
        {auto ? `${auto.weather} ${auto.temp_c ?? '-'}°C · ${auto.wind_dir ?? ''} ${auto.wind_ms ?? '-'}m/s` : '그날 날씨 불러오는 중…'} · 물때 {tide?.label ?? '-'}
        <div className="note" style={{ marginTop: 4 }}>날씨 출처: {PAST_WEATHER_SOURCE}</div>
      </div>

      <div className="label">결과</div>
      <div className="chips">
        <button className={`chip ${!zero ? 'on' : ''}`} onClick={() => set({ log_type: 'catch' })}>조과</button>
        <button className={`chip ${zero ? 'on' : ''}`} onClick={() => set({ log_type: 'zero' })}>꽝</button>
      </div>

      {!zero && (
        <>
          <div className="label">어종</div>
          <SpeciesPicker species={species} value={form.species_id} onChange={id => set({ species_id: id })} onAdded={s => setSpecies(l => [...l, s])} />
          <div className="label">마릿수 · 대표 사이즈(cm)</div>
          <div className="row">
            <input type="number" inputMode="numeric" min={1} value={form.count} onChange={e => set({ count: Math.max(1, Number(e.target.value) || 1) })} />
            <input type="number" inputMode="decimal" placeholder="선택" value={form.size_cm} onChange={e => set({ size_cm: e.target.value })} />
          </div>
          <div className="label">방법 · 미끼 (선택)</div>
          <div className="chips">{methods.map(m => <button key={m.code} className={`chip sm ${form.method_code === m.code ? 'on' : ''}`} onClick={() => set({ method_code: form.method_code === m.code ? '' : m.code })}>{m.label}</button>)}</div>
          <div className="chips" style={{ marginTop: 6 }}>{baits.map(b => <button key={b.code} className={`chip sm ${form.bait_code === b.code ? 'on' : ''}`} onClick={() => set({ bait_code: form.bait_code === b.code ? '' : b.code })}>{b.label}</button>)}</div>
        </>
      )}

      <div className="label">출처 (필수)</div>
      <div className="chips">{SOURCE_TYPES.map(s => <button key={s.k} className={`chip ${form.source_type === s.k ? 'on' : ''}`} onClick={() => set({ source_type: s.k })}>{s.label}</button>)}</div>
      <div className="row" style={{ marginTop: 8 }}>
        <input placeholder="출처 이름 (예: ○○호, ○○낚시)" value={form.source_name} onChange={e => set({ source_name: e.target.value })} />
      </div>
      <input placeholder="출처 링크 (선택)" value={form.source_url} onChange={e => set({ source_url: e.target.value })} style={{ marginTop: 8 }} />
      <input placeholder="메모 (선택, 화면에 안 보여요)" value={form.memo} onChange={e => set({ memo: e.target.value })} style={{ marginTop: 8 }} />

      {msg && <div className="card plain" style={{ marginTop: 12, fontSize: 14 }}>{msg}</div>}
      <button className="btn" style={{ marginTop: 16 }} disabled={!canSave} onClick={save}>{busy ? '등록하는 중…' : '관리자 기록으로 등록'}</button>

      <div className="card-head" style={{ marginTop: 28 }}><div className="card-title">내가 등록한 기록</div></div>
      {rows.length === 0 && <div className="empty">아직 없어요.</div>}
      <div className="list">
        {rows.map(r => (
          <div key={r.id} className="item" style={{ background: 'var(--surface)' }}>
            <div className="item-row">
              <span className="item-title">{r.log_type === 'zero' ? '꽝' : `${r.species_name ?? '-'} ${r.count}마리`}</span>
              <button className="chip sm" onClick={() => remove(r.id)}>삭제</button>
            </div>
            <div className="sub">{new Date(r.caught_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · {r.region ?? '지역 미상'} · {sourceLabel(r.source_type)}{r.source_name ? ` ${r.source_name}` : ''}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
