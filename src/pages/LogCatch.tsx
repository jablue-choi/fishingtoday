import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getPosition } from '../lib/geo'
import { fetchKmaNow, type AutoFill } from '../lib/weather'
import { awardPoints, reasonLabel, type AwardResult } from '../lib/points'
import MapPicker from '../components/MapPicker'
import { regionName } from '../lib/kakaoMap'
import { saveLastPos } from '../lib/fishingIndex'
import { fetchRules, checkCatch, closedNow, banZonesAt, type Rule } from '../lib/rules'
import { tideAt } from '../lib/tide'

type Species = { id: number; name_ko: string }
type Code = { code: string; label: string }

export default function LogCatch() {
  const nav = useNavigate()
  const [pos, setPos] = useState<{ lat: number; lon: number } | null>(null)
  const [gps, setGps] = useState<{ lat: number; lon: number } | null>(null)
  const weatherTimer = useRef<number | undefined>(undefined)
  const [auto, setAuto] = useState<AutoFill | null>(null)
  const [species, setSpecies] = useState<Species[]>([])
  const [methods, setMethods] = useState<Code[]>([])
  const [baits, setBaits] = useState<Code[]>([])
  const [form, setForm] = useState({ species_id: 0, size_cm: '', count: 1, method_code: '', bait_code: '' })
  const [photo, setPhoto] = useState<File | null>(null)
  const [share, setShare] = useState(true)
  const [rules, setRules] = useState<Rule[]>([])
  const [release, setRelease] = useState(false)
  const [banned, setBanned] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<AwardResult | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    supabase.from('species').select('id,name_ko').then(({ data }) => setSpecies(data ?? []))
    supabase.from('method_codes').select('code,label').then(({ data }) => setMethods(data ?? []))
    supabase.from('bait_codes').select('code,label').then(({ data }) => setBaits(data ?? []))
    fetchRules().then(setRules).catch(() => setRules([]))
  }, [])

  async function loadWeather(lat: number, lon: number) {
    banZonesAt(lat, lon).then(z => setBanned(z.length > 0))
    try { setAuto(await fetchKmaNow(lat, lon)) }
    catch { setAuto({ weather: '-', temp_c: null, wind_dir: null, wind_ms: null }) }
  }

  async function pin() {
    setErr('')
    try {
      const p = await getPosition()
      const here = { lat: p.coords.latitude, lon: p.coords.longitude }
      setGps(here); setPos(here); saveLastPos(here)
      loadWeather(here.lat, here.lon)
    } catch (e) { setErr((e as Error).message) }
  }

  /** 지도에서 핀을 옮기면 위치 갱신, 날씨는 0.8초 뒤 한 번만 다시 조회 */
  function movePin(p: { lat: number; lon: number }) {
    setPos(p)
    window.clearTimeout(weatherTimer.current)
    weatherTimer.current = window.setTimeout(() => loadWeather(p.lat, p.lon), 800)
  }

  async function save(zero = false) {
    if (!pos) return
    setBusy(true); setErr('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const region = await regionName(pos.lat, pos.lon)
      const { data: log, error } = await supabase.from('catch_logs').insert({
        region,
        visibility: share ? 'radius' : 'private',
        user_id: user!.id,
        geom: `SRID=4326;POINT(${pos.lon} ${pos.lat})`,
        log_type: zero ? 'zero' : release ? 'release' : 'catch',
        species_id: zero ? null : form.species_id || null,
        size_cm: zero ? null : (form.size_cm ? Number(form.size_cm) : null),
        count: zero ? 0 : form.count,
        method_code: zero ? null : form.method_code || null,
        bait_code: zero ? null : form.bait_code || null,
        weather: auto?.weather, temp_c: auto?.temp_c, wind_dir: auto?.wind_dir, wind_ms: auto?.wind_ms,
        tide_mul: tideAt(pos)?.mul ?? null,
        auto_filled: !!auto,
      }).select('id').single()
      if (error) throw error

      if (!zero && photo) {
        const path = `${user!.id}/${log.id}/${Date.now()}.jpg`
        const { error: upErr } = await supabase.storage.from('catch-photos').upload(path, photo)
        if (upErr) throw upErr
        const sha256 = await hash(photo)
        // TODO: EXIF 파싱(exifr) 후 시각·위치 비교. 지금은 업로드만으로 exif_ok=true.
        await supabase.from('catch_photos').insert({ catch_log_id: log.id, storage_path: path, sha256, exif_ok: true })
      }

      setResult(await awardPoints(log.id))
    } catch (e) { setErr((e as Error).message) }
    finally { setBusy(false) }
  }

  const checks = form.species_id ? checkCatch(rules, form.species_id, form.size_cm ? Number(form.size_cm) : null) : []
  const mustRelease = checks.some(c => c.level === 'ban' || c.level === 'size')
  const closedIds = closedNow(rules)
  const tide = pos ? tideAt(pos) : null

  if (result) return (
    <div className="page">
      <h1>저장됐어요</h1>
      <div className="card"><div className="label" style={{ marginTop: 0 }}>포인트</div><div className="big">+{result.total}</div><div>{result.balance.toLocaleString()}P</div></div>
      {result.awarded.map(a => <div key={a.reason} className="card" style={{ padding: 10 }}>{reasonLabel(a.reason)} +{a.amount}P</div>)}
      {result.capped && <p style={{ color: 'var(--mute)', fontSize: 13 }}>오늘 적립 한도를 채웠어요.</p>}
      <button className="btn" onClick={() => nav('/me')}>내 기록 보기</button>
    </div>
  )

  return (
    <div className="page">
      <h1>조과 기록</h1>
      {!pos || !gps ? (
        <button className="btn" onClick={pin}>현위치 찍기</button>
      ) : (
        <>
          <MapPicker initial={gps} gps={gps} onChange={movePin} />
          <div className="card auto">
            <div className="label" style={{ margin: 0 }}>자동 입력됨</div>
            <div>{new Date().toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · {auto?.weather ?? '…'} {auto?.temp_c != null && `${auto.temp_c}°C`}</div>
            <div>{auto?.wind_dir} {auto?.wind_ms != null && `${auto.wind_ms}m/s`} · 물때 {tide ? `${tide.label}${tide.phase ? ` (${tide.phase})` : ''}` : '-'}</div>
          </div>
          {banned && (
            <div className="card" style={{ border: '2px solid #D9472B' }}>
              <b style={{ color: '#D9472B' }}>낚시금지구역 안이에요</b>
              <div style={{ fontSize: 13 }}>해도에 낚시 제한구역으로 표시된 곳이에요. 낚시를 멈추고 위치를 다시 확인해 주세요.</div>
              <div style={{ fontSize: 11, color: 'var(--mute)', marginTop: 4 }}>국립해양조사원 전자해도 기준 안내예요. 지자체 낚시통제구역은 현장 안내판을 확인해 주세요.</div>
            </div>
          )}
        </>
      )}
      {err && <p style={{ color: '#B8531E' }}>{err}</p>}

      <div className="label">어종</div>
      <div className="chips">{species.map(s => (
        <button key={s.id} className={`chip ${form.species_id === s.id ? 'on' : ''}`} onClick={() => { setForm({ ...form, species_id: s.id }); setRelease(false) }}>
          {s.name_ko}{closedIds.has(s.id) && <span style={{ marginLeft: 4, fontSize: 10, color: form.species_id === s.id ? '#FFB4A6' : '#D9472B' }}>금어기</span>}
        </button>
      ))}</div>

      <div className="label">사이즈 · 마릿수</div>
      <div className="row">
        <input type="number" inputMode="decimal" placeholder="cm" value={form.size_cm} onChange={e => setForm({ ...form, size_cm: e.target.value })} />
        <div className="row"><button className="chip" onClick={() => setForm({ ...form, count: Math.max(1, form.count - 1) })}>−</button><span style={{ alignSelf: 'center', textAlign: 'center' }}>{form.count}</span><button className="chip" onClick={() => setForm({ ...form, count: form.count + 1 })}>+</button></div>
      </div>

      {checks.length > 0 && (
        <div className="card" style={{ marginTop: 10, border: `2px solid ${mustRelease ? '#D9472B' : '#E8A13A'}` }}>
          {checks.map((c, i) => (
            <div key={i} style={{ marginBottom: 6 }}>
              <b style={{ color: c.level === 'info' ? '#B8741E' : '#D9472B' }}>{c.title}</b>
              <div style={{ fontSize: 13 }}>{c.detail}</div>
            </div>
          ))}
          {mustRelease && (
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, fontWeight: 600 }}>
              <input type="checkbox" checked={release} onChange={e => setRelease(e.target.checked)} />
              방생했어요 (방생 기록으로 저장, +30P)
            </label>
          )}
        </div>
      )}

      <div className="label">낚시 방법</div>
      <div className="chips">{methods.map(m => <button key={m.code} className={`chip ${form.method_code === m.code ? 'on' : ''}`} onClick={() => setForm({ ...form, method_code: m.code })}>{m.label}</button>)}</div>

      <div className="label">미끼</div>
      <div className="chips">{baits.map(b => <button key={b.code} className={`chip ${form.bait_code === b.code ? 'on' : ''}`} onClick={() => setForm({ ...form, bait_code: b.code })}>{b.label}</button>)}</div>

      <div className="label">사진 인증 (없으면 포인트 적립 안 됨)</div>
      <input type="file" accept="image/*" capture="environment" onChange={e => setPhoto(e.target.files?.[0] ?? null)} />

      <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 14, fontSize: 13 }}>
        <input type="checkbox" checked={share} onChange={e => setShare(e.target.checked)} />
        다른 사람 검색에 공개 (정확한 위치 대신 대략 500m 범위로만 보여요)
      </label>

      <div className="row" style={{ marginTop: 20 }}>
        <button className="btn ghost" disabled={!pos || busy} onClick={() => save(true)}>꽝으로 기록</button>
        <button className="btn" disabled={!pos || busy || (mustRelease && !release)} onClick={() => save(false)}>
          {mustRelease && !release ? '방생 확인 후 저장' : release ? '방생 기록 저장' : '저장하고 포인트 받기'}
        </button>
      </div>
    </div>
  )
}

async function hash(file: File) {
  const buf = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}
