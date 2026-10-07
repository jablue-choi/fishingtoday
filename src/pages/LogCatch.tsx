import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getPosition } from '../lib/geo'
import { fetchKmaNow, type AutoFill } from '../lib/weather'
import { awardPoints, type AwardResult } from '../lib/points'

type Species = { id: number; name_ko: string }
type Code = { code: string; label: string }

export default function LogCatch() {
  const nav = useNavigate()
  const [pos, setPos] = useState<{ lat: number; lon: number } | null>(null)
  const [auto, setAuto] = useState<AutoFill | null>(null)
  const [species, setSpecies] = useState<Species[]>([])
  const [methods, setMethods] = useState<Code[]>([])
  const [baits, setBaits] = useState<Code[]>([])
  const [form, setForm] = useState({ species_id: 0, size_cm: '', count: 1, method_code: '', bait_code: '' })
  const [photo, setPhoto] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<AwardResult | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    supabase.from('species').select('id,name_ko').then(({ data }) => setSpecies(data ?? []))
    supabase.from('method_codes').select('code,label').then(({ data }) => setMethods(data ?? []))
    supabase.from('bait_codes').select('code,label').then(({ data }) => setBaits(data ?? []))
  }, [])

  async function pin() {
    setErr('')
    try {
      const p = await getPosition()
      const lat = p.coords.latitude, lon = p.coords.longitude
      setPos({ lat, lon })
      try { setAuto(await fetchKmaNow(lat, lon)) } catch { setAuto({ weather: '-', temp_c: null, wind_dir: null, wind_ms: null }) }
    } catch (e) { setErr((e as Error).message) }
  }

  async function save(zero = false) {
    if (!pos) return
    setBusy(true); setErr('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: log, error } = await supabase.from('catch_logs').insert({
        user_id: user!.id,
        geom: `SRID=4326;POINT(${pos.lon} ${pos.lat})`,
        log_type: zero ? 'zero' : 'catch',
        species_id: zero ? null : form.species_id || null,
        size_cm: zero ? null : (form.size_cm ? Number(form.size_cm) : null),
        count: zero ? 0 : form.count,
        method_code: zero ? null : form.method_code || null,
        bait_code: zero ? null : form.bait_code || null,
        weather: auto?.weather, temp_c: auto?.temp_c, wind_dir: auto?.wind_dir, wind_ms: auto?.wind_ms,
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

  if (result) return (
    <div className="page">
      <h1>저장됐어요</h1>
      <div className="card"><div className="label" style={{ marginTop: 0 }}>포인트</div><div className="big">+{result.total}</div><div>{result.balance.toLocaleString()}P</div></div>
      {result.awarded.map(a => <div key={a.reason} className="card" style={{ padding: 10 }}>{a.reason} +{a.amount}P</div>)}
      {result.capped && <p style={{ color: 'var(--mute)', fontSize: 13 }}>오늘 적립 한도를 채웠어요.</p>}
      <button className="btn" onClick={() => nav('/me')}>내 기록 보기</button>
    </div>
  )

  return (
    <div className="page">
      <h1>조과 기록</h1>
      {!pos ? (
        <button className="btn" onClick={pin}>현위치 찍기</button>
      ) : (
        <div className="card auto">
          <div className="label" style={{ margin: 0 }}>자동 입력됨</div>
          <div>{new Date().toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · {auto?.weather ?? '…'} {auto?.temp_c != null && `${auto.temp_c}°C`}</div>
          <div>{auto?.wind_dir} {auto?.wind_ms != null && `${auto.wind_ms}m/s`} · 물때: 준비 중</div>
        </div>
      )}
      {err && <p style={{ color: '#B8531E' }}>{err}</p>}

      <div className="label">어종</div>
      <div className="chips">{species.map(s => <button key={s.id} className={`chip ${form.species_id === s.id ? 'on' : ''}`} onClick={() => setForm({ ...form, species_id: s.id })}>{s.name_ko}</button>)}</div>

      <div className="label">사이즈 · 마릿수</div>
      <div className="row">
        <input type="number" inputMode="decimal" placeholder="cm" value={form.size_cm} onChange={e => setForm({ ...form, size_cm: e.target.value })} />
        <div className="row"><button className="chip" onClick={() => setForm({ ...form, count: Math.max(1, form.count - 1) })}>−</button><span style={{ alignSelf: 'center', textAlign: 'center' }}>{form.count}</span><button className="chip" onClick={() => setForm({ ...form, count: form.count + 1 })}>+</button></div>
      </div>

      <div className="label">낚시 방법</div>
      <div className="chips">{methods.map(m => <button key={m.code} className={`chip ${form.method_code === m.code ? 'on' : ''}`} onClick={() => setForm({ ...form, method_code: m.code })}>{m.label}</button>)}</div>

      <div className="label">미끼</div>
      <div className="chips">{baits.map(b => <button key={b.code} className={`chip ${form.bait_code === b.code ? 'on' : ''}`} onClick={() => setForm({ ...form, bait_code: b.code })}>{b.label}</button>)}</div>

      <div className="label">사진 인증 (없으면 포인트 적립 안 됨)</div>
      <input type="file" accept="image/*" capture="environment" onChange={e => setPhoto(e.target.files?.[0] ?? null)} />

      <div className="row" style={{ marginTop: 20 }}>
        <button className="btn ghost" disabled={!pos || busy} onClick={() => save(true)}>꽝으로 기록</button>
        <button className="btn" disabled={!pos || busy} onClick={() => save(false)}>저장하고 포인트 받기</button>
      </div>
    </div>
  )
}

async function hash(file: File) {
  const buf = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}
