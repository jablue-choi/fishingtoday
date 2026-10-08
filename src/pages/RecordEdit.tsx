import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fetchSpecies, type Species } from '../lib/species'
import { tideLabel } from '../lib/tide'
import SpeciesPicker from '../components/SpeciesPicker'
import FishArt from '../components/FishArt'
import BragBox from '../components/BragBox'

type Code = { code: string; label: string }
type Log = {
  id: string; species_id: number | null; count: number; size_cm: number | null; method_code: string | null; bait_code: string | null
  visibility: 'private' | 'radius' | 'public'; log_type: 'catch' | 'release' | 'zero'; caught_at: string; created_at: string
  region: string | null; share_url: string | null; weather: string | null; temp_c: number | null; wind_dir: string | null; wind_ms: number | null
  tide_mul: number | null; entered_by: string
}
const COLS = 'id,species_id,count,size_cm,method_code,bait_code,visibility,log_type,caught_at,created_at,region,share_url,weather,temp_c,wind_dir,wind_ms,tide_mul,entered_by'

/** 내 기록 수정 + 자랑하기. 어종·마릿수·크기는 기록 후 24시간 안에만 (DB 트리거와 같은 기준) */
export default function RecordEdit() {
  const { id = '' } = useParams()
  const [log, setLog] = useState<Log | null | undefined>(undefined)
  const [form, setForm] = useState({ species_id: 0, count: 1, size_cm: '', method_code: '', bait_code: '', share: true })
  const [species, setSpecies] = useState<Species[]>([])
  const [methods, setMethods] = useState<Code[]>([])
  const [baits, setBaits] = useState<Code[]>([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    supabase.from('catch_logs').select(COLS).eq('id', id).maybeSingle().then(({ data }) => {
      const l = data as Log | null
      setLog(l)
      if (l) setForm({ species_id: l.species_id ?? 0, count: l.count || 1, size_cm: l.size_cm != null ? String(l.size_cm) : '', method_code: l.method_code ?? '', bait_code: l.bait_code ?? '', share: l.visibility !== 'private' })
    })
    fetchSpecies().then(setSpecies).catch(() => setSpecies([]))
    supabase.from('method_codes').select('code,label').then(({ data }) => setMethods(data ?? []))
    supabase.from('bait_codes').select('code,label').then(({ data }) => setBaits(data ?? []))
  }, [id])

  if (log === undefined) return <div className="page"><div className="empty">불러오는 중…</div></div>
  if (!log) return <div className="page"><h1>기록을 찾을 수 없어요</h1><Link to="/me" className="btn ghost">내 기록으로</Link></div>

  const zero = log.log_type === 'zero'
  const editable = Date.now() - new Date(log.created_at).getTime() <= 24 * 3600e3
  const picked = species.find(s => s.id === form.species_id)
  const set = (p: Partial<typeof form>) => setForm(f => ({ ...f, ...p }))

  async function save() {
    if (!log) return
    setBusy(true); setMsg('')
    const patch: Record<string, unknown> = {
      method_code: form.method_code || null, bait_code: form.bait_code || null,
      visibility: form.share ? (log.visibility === 'public' ? 'public' : 'radius') : 'private',
    }
    if (editable && !zero) Object.assign(patch, { species_id: form.species_id || null, count: form.count, size_cm: form.size_cm ? Number(form.size_cm) : null })
    const { error } = await supabase.from('catch_logs').update(patch).eq('id', log.id)
    setBusy(false)
    setMsg(error ? error.message : '저장했어요.')
  }

  const when = new Date(log.caught_at)
  return (
    <div className="page">
      <Link to="/me?tab=list" className="more" style={{ marginBottom: 8 }}>← 내 기록</Link>
      <h1>기록 고치기</h1>

      <div className="card dark" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div className="glow" />
        {!zero && <FishArt code={picked?.code} name={picked?.name_ko} size={88} />}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 900 }}>{zero ? '꽝' : `${picked?.name_ko ?? '-'} ${form.count}마리`}{log.log_type === 'release' ? ' (방생)' : ''}</div>
          <div className="sub">{when.toLocaleString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short', hour: 'numeric', minute: '2-digit' })}</div>
          <div className="sub">{log.region ?? '지역 미상'}</div>
          <div className="sub">{[log.weather, log.temp_c != null && `${log.temp_c}°C`, log.wind_ms != null && `${log.wind_dir ?? ''} ${log.wind_ms}m/s`, log.tide_mul && `물때 ${tideLabel(log.tide_mul)}`].filter(Boolean).join(' · ')}</div>
        </div>
      </div>

      {!zero && (
        <>
          <BragBox logId={log.id} initialUrl={log.share_url} text={`${log.region ? `${log.region.split(' ').slice(1, 2).join('')}에서 ` : ''}${picked?.name_ko ?? ''} ${form.count}마리 잡았어요! #오늘낚시 #오낚완`} />

          <div className="card">
            <div className="card-head">
              <div className="card-title">무엇을 잡았나요?</div>
              {!editable && <span className="badge">24시간이 지나 못 고쳐요</span>}
            </div>
            {editable ? (
              <>
                <SpeciesPicker species={species} value={form.species_id} onChange={id => set({ species_id: id })} onAdded={s => setSpecies(l => [...l, s])} />
                <div className="label">마릿수 · 가장 큰 크기(cm)</div>
                <div className="row">
                  <input type="number" inputMode="numeric" min={1} value={form.count} onChange={e => set({ count: Math.max(1, Number(e.target.value) || 1) })} aria-label="마릿수" />
                  <input type="number" inputMode="decimal" placeholder="선택" value={form.size_cm} onChange={e => set({ size_cm: e.target.value })} aria-label="크기" />
                </div>
              </>
            ) : <div className="sub">어종·마릿수·크기는 랭킹에 쓰여서 기록 후 24시간 안에만 고칠 수 있어요.</div>}
          </div>

          <div className="card">
            <div className="card-title" style={{ marginBottom: 8 }}>어떻게 잡았나요?</div>
            <div className="chips">{methods.map(m => <button key={m.code} className={`chip ${form.method_code === m.code ? 'on' : ''}`} onClick={() => set({ method_code: form.method_code === m.code ? '' : m.code })}>{m.label}</button>)}</div>
            <div className="label">미끼</div>
            <div className="chips">{baits.map(b => <button key={b.code} className={`chip ${form.bait_code === b.code ? 'on' : ''}`} onClick={() => set({ bait_code: form.bait_code === b.code ? '' : b.code })}>{b.label}</button>)}</div>
          </div>
        </>
      )}

      <label className="card" style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
        <input type="checkbox" checked={form.share} onChange={e => set({ share: e.target.checked })} />
        다른 사람 검색에 공개 (대략 500m 범위로만 보여요)
      </label>

      {msg && <div className="card plain" style={{ fontSize: 14 }}>{msg}</div>}
      <button className="btn" disabled={busy} onClick={save}>{busy ? '저장하는 중…' : '고친 내용 저장'}</button>
    </div>
  )
}
