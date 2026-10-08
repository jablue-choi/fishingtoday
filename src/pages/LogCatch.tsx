import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getPosition } from '../lib/geo'
import { fetchKmaNow, type AutoFill } from '../lib/weather'
import { awardPoints, reasonLabel, type AwardResult } from '../lib/points'
import MapPicker from '../components/MapPicker'
import { regionName, searchPlaces, type PlaceHit } from '../lib/kakaoMap'
import { saveLastPos, getLastPos } from '../lib/fishingIndex'
import { fetchPastWeather, PAST_WEATHER_SOURCE } from '../lib/pastWeather'
import { pulse } from '../lib/pulse'
import DateTimeField, { toLocalInput } from '../components/DateTimeField'
import { fetchRules, checkCatch, closedNow, banZonesAt, otherMeasureRule, type Rule } from '../lib/rules'
import { tideAt, fetchTideTable, nearestTideTimes } from '../lib/tide'
import { identifyFish, CONFIDENCE_LABEL, type FishId } from '../lib/fishId'
import { fetchSpecies, type Species } from '../lib/species'
import SpeciesPicker from '../components/SpeciesPicker'
import FishArt from '../components/FishArt'
import Icon from '../components/Icon'
import BragBox from '../components/BragBox'
import LocalIndex from '../components/LocalIndex'

type Code = { code: string; label: string }
type Pos = { lat: number; lon: number }
type Step = 'when' | 'where' | 'what' | 'detail'
const STEPS: Step[] = ['when', 'where', 'what', 'detail']
const COUNTS = [1, 2, 3, 5, 10]

/** 조과 기록: 언제 → 어디서 → 무엇을 → 자세히. 한 화면에 질문 하나, 답은 누르기로 */
export default function LogCatch() {
  const nav = useNavigate()
  const [step, setStep] = useState<Step>('when')

  // 언제
  const [whenStr, setWhenStr] = useState('')        // 비면 '지금'
  const [pickingTime, setPickingTime] = useState(false)
  const when = whenStr ? new Date(whenStr) : null
  const whenInvalid = !!when && (isNaN(when.getTime()) || when.getTime() > Date.now())
  const at = when && !whenInvalid ? when : undefined

  // 어디서
  const [pos, setPos] = useState<Pos | null>(null)
  const [center, setCenter] = useState<Pos | null>(null)   // 지도 처음 위치 (바뀌면 지도를 새로 그림)
  const [placeName, setPlaceName] = useState('')
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<PlaceHit[] | null>(null)
  const [locating, setLocating] = useState(false)
  const [whereDone, setWhereDone] = useState(false)
  const [auto, setAuto] = useState<AutoFill | null>(null)
  const [banned, setBanned] = useState(false)
  const weatherTimer = useRef<number | undefined>(undefined)
  const [lastPos] = useState(getLastPos)

  // 무엇을
  const [species, setSpecies] = useState<Species[]>([])
  const [zero, setZero] = useState(false)
  const [photo, setPhoto] = useState<File | null>(null)
  const [fishId, setFishId] = useState<FishId | null>(null)
  const [fishIdState, setFishIdState] = useState<'idle' | 'loading' | string>('idle')

  // 자세히
  const [methods, setMethods] = useState<Code[]>([])
  const [baits, setBaits] = useState<Code[]>([])
  const [form, setForm] = useState({ species_id: 0, size_cm: '', count: 1, method_code: '', bait_code: '' })
  const [measureCm, setMeasureCm] = useState('')   // 갈치 항문장 등 전장이 아닌 금지체장 확인용 (저장 안 함)
  const [share, setShare] = useState(true)
  const [rules, setRules] = useState<Rule[]>([])
  const [release, setRelease] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<AwardResult | null>(null)
  const [savedId, setSavedId] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    fetchSpecies().then(setSpecies).catch(() => setSpecies([]))
    supabase.from('method_codes').select('code,label').then(({ data }) => setMethods(data ?? []))
    supabase.from('bait_codes').select('code,label').then(({ data }) => setBaits(data ?? []))
    fetchRules().then(setRules).catch(() => setRules([]))
  }, [])

  function loadWeather(p: Pos, t: Date | undefined) {
    window.clearTimeout(weatherTimer.current)
    weatherTimer.current = window.setTimeout(async () => {
      banZonesAt(p.lat, p.lon).then(z => setBanned(z.length > 0))
      setAuto(null)
      try { setAuto(t ? await fetchPastWeather(p.lat, p.lon, t) : await fetchKmaNow(p.lat, p.lon)) }
      catch { setAuto({ weather: '-', temp_c: null, wind_dir: null, wind_ms: null }) }
    }, 500)
  }

  /* ── 언제 ── */
  function answerNow() { setWhenStr(''); setPickingTime(false); go('where') }
  function answerOther() {
    if (!whenStr) setWhenStr(toLocalInput(new Date(Date.now() - 3 * 3600e3)))
    setPickingTime(true)
  }
  function confirmWhen() {
    if (whenInvalid) return
    if (pos) loadWeather(pos, at)
    go(whereDone ? 'what' : 'where')
  }

  /* ── 어디서 ── */
  async function useGps() {
    setErr(''); setLocating(true)
    try {
      const g = await getPosition()
      const here = { lat: g.coords.latitude, lon: g.coords.longitude }
      saveLastPos(here)
      choosePlace(here, '지금 내 위치')
    } catch (e) { setErr((e as Error).message) }
    finally { setLocating(false) }
  }
  async function search() {
    setErr(''); setHits(null)
    try {
      const list = await searchPlaces(q)
      setHits(list)
    } catch (e) { setErr((e as Error).message) }
  }
  function choosePlace(p: Pos, name: string) {
    setCenter(p); setPos(p); setPlaceName(name); setHits(null)
    loadWeather(p, at)
  }
  function movePin(p: Pos) { setPos(p); setPlaceName(n => n.includes('(핀 이동)') ? n : `${n} (핀 이동)`); loadWeather(p, at) }
  function confirmWhere() { setWhereDone(true); go('what') }

  /* ── 무엇을 ── */
  function pickSpecies(id: number) {
    setForm(f => ({ ...f, species_id: id })); setZero(false); setRelease(false); setMeasureCm('')
    window.setTimeout(() => go('detail'), 250)   // 고르면 바로 다음 질문
  }
  function answerZero() { setZero(true); setForm(f => ({ ...f, species_id: 0 })); go('detail') }
  function pickPhoto(file: File | null) { setPhoto(file); setFishId(null); setFishIdState('idle'); if (file) checkSpecies(file) }
  async function checkSpecies(file: File) {
    setFishIdState('loading')
    try { setFishId(await identifyFish(file)); setFishIdState('idle') }
    catch (e) { setFishIdState((e as Error).message) }
  }

  function go(s: Step) { setStep(s); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  /* ── 저장 ── */
  async function save() {
    if (!pos || whenInvalid) return
    setBusy(true); setErr('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const region = await regionName(pos.lat, pos.lon)
      // 만조·간조 스냅샷 (조석예보 못 불러와도 기록은 저장)
      const tideTimes = await fetchTideTable(pos, at ?? new Date()).then(t => nearestTideTimes(t.extremes, at ?? new Date())).catch(() => null)
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
        tide_mul: tideAt(pos, at)?.mul ?? null,
        ...(tideTimes ?? {}),
        auto_filled: !!auto,
        ...(at ? { caught_at: at.toISOString() } : {}),
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
      setSavedId(log.id)
      setResult(await awardPoints(log.id))
    } catch (e) { setErr((e as Error).message) }
    finally { setBusy(false) }
  }

  const picked = species.find(s => s.id === form.species_id)
  const otherRule = !zero && form.species_id ? otherMeasureRule(rules, form.species_id) : undefined
  const checks = !zero && form.species_id ? checkCatch(rules, form.species_id, form.size_cm ? Number(form.size_cm) : null, at, otherRule && measureCm ? Number(measureCm) : null) : []
  const mustRelease = checks.some(c => c.level === 'ban' || c.level === 'size')
  const closedIds = closedNow(rules, at)
  const tide = pos ? tideAt(pos, at) : null
  const late = !!at && Date.now() - at.getTime() > 864e5   // award_points와 같은 기준(24시간)
  const whenLabel = at ? at.toLocaleString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short', hour: 'numeric', minute: '2-digit' }) : '지금'
  const stepNo = STEPS.indexOf(step) + 1

  if (result) return (
    <div className="page">
      <h1>저장됐어요</h1>
      <div className="card hero"><div className="label" style={{ marginTop: 0 }}>포인트</div><div className="big">+{result.total}</div><div style={{ marginTop: 6 }}>{result.balance.toLocaleString()}P</div></div>
      {result.awarded.map(a => <div key={a.reason} className="item" style={{ background: 'var(--surface)', marginBottom: 8 }}>{reasonLabel(a.reason)} +{a.amount}P</div>)}
      {result.late && <p className="note">하루 넘게 지난 기록은 포인트 없이 저장돼요. 기록과 통계에는 그대로 반영돼요.</p>}
      {result.capped && <p className="note">오늘 적립 한도를 채웠어요.</p>}
      {savedId && !zero && (
        <div style={{ marginTop: 12 }}>
          <BragBox logId={savedId} text={`${placeName && !placeName.includes('위치') ? `${placeName.replace(' (핀 이동)', '')}에서 ` : ''}${picked?.name_ko ?? ''} ${form.count}마리 잡았어요! #오늘낚시 #오낚완`} />
        </div>
      )}
      <button className="btn" style={{ marginTop: 12 }} onClick={() => nav('/me')}>내 기록 보기</button>
    </div>
  )

  return (
    <div className="page">
      <div className="item-row" style={{ marginBottom: 12 }}>
        <h1 style={{ margin: 0 }}>조과 기록</h1>
        <span className="sub" style={{ fontWeight: 700 }}>{stepNo} / 4</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, marginBottom: 14 }}>
        {STEPS.map((s, i) => <div key={s} style={{ height: 4, borderRadius: 2, background: i < stepNo ? 'var(--accent)' : 'var(--line)' }} />)}
      </div>

      {/* 답한 내용 요약: 누르면 그 질문으로 */}
      {step !== 'when' && (
        <div className="chips" style={{ marginBottom: 14 }}>
          <button className="chip sm" onClick={() => go('when')}>언제 · {whenLabel}</button>
          {whereDone && step !== 'where' && <button className="chip sm" onClick={() => go('where')}>어디서 · {placeName || '지도에서 고름'}</button>}
          {step === 'detail' && <button className="chip sm" onClick={() => go('what')}>무엇을 · {zero ? '꽝' : picked?.name_ko ?? '-'}</button>}
        </div>
      )}

      {err && <div className="card plain error">{err}</div>}

      {step === 'when' && (
        <section>
          <h2 style={Q}>언제 잡았나요?</h2>
          {!pickingTime ? (
            <div className="list">
              <button className="btn" onPointerDown={pulse} onClick={answerNow}>지금 잡았어요</button>
              <button className="btn ghost" onClick={answerOther}>다른 날·시간이에요</button>
              <div className="note">지난 기록은 그날 날씨·물때를 채워 드려요. 하루 넘게 지난 기록은 포인트 없이 저장돼요.</div>
            </div>
          ) : (
            <>
              <DateTimeField value={whenStr} onChange={setWhenStr} label="날짜와 시각을 골라 주세요" />
              <div className="row">
                <button className="btn ghost" onClick={answerNow}>지금으로</button>
                <button className="btn" disabled={whenInvalid} onClick={confirmWhen}>다음</button>
              </div>
            </>
          )}
        </section>
      )}

      {step === 'where' && (
        <section>
          <h2 style={Q}>어디서 잡았나요?</h2>
          <div className="choices" style={{ gridTemplateColumns: lastPos ? undefined : '1fr' }}>
            <button className={`choice ${placeName === '지금 내 위치' ? 'on' : ''}`} disabled={locating} onClick={useGps}>
              <Icon name="pin" size={20} />{locating ? '찾는 중…' : '지금 내 위치'}
            </button>
            {lastPos && (
              <button className={`choice ${placeName === '최근 위치' ? 'on' : ''}`} onClick={() => choosePlace(lastPos, '최근 위치')}>
                <Icon name="clock" size={20} />최근 위치
              </button>
            )}
          </div>
          <div className="or">또는 장소 검색</div>
          <form className="search-field" role="search" onSubmit={e => { e.preventDefault(); search() }}>
            <Icon name="search" size={20} />
            <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="예: 속초, 대부도, 방아머리" aria-label="지역·장소 검색" enterKeyHint="search" />
            <button type="submit" disabled={!q.trim()}>검색</button>
          </form>
          {hits && (
            <div className="list" style={{ marginTop: 8 }}>
              {hits.length === 0 && <div className="empty">찾는 곳이 없어요. 다른 이름으로 검색해 보세요.</div>}
              {hits.map((h, i) => (
                <button key={i} className="item" style={{ background: 'var(--surface)', border: 0, textAlign: 'left', cursor: 'pointer', color: 'var(--ink)' }} onClick={() => choosePlace(h, h.name)}>
                  <div className="item-title">{h.name}</div>
                  <div className="sub">{h.address}</div>
                </button>
              ))}
            </div>
          )}
          {center && pos && (
            <div style={{ marginTop: 12 }}>
              <MapPicker key={`${center.lat},${center.lon}`} initial={center} gps={center} onChange={movePin} level={placeName === '지금 내 위치' ? 3 : 6} backLabel="처음 위치로" />
              {banned && <BanWarning />}
              <button className="btn" onPointerDown={pulse} onClick={confirmWhere}>이 위치로 할게요</button>
              <LocalIndex pos={center} />
              {auto && (
                <div className="sub" style={{ marginTop: -4 }}>
                  {at ? '그날' : '지금'} 날씨 {auto.weather} {auto.temp_c ?? '-'}°C · {auto.wind_dir ?? ''} {auto.wind_ms ?? '-'}m/s{tide ? ` · 물때 ${tide.label}` : ''}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {step === 'what' && (
        <section>
          <h2 style={Q}>무엇을 잡았나요?</h2>
          <label className="btn ghost" style={{ marginBottom: 12 }}>
            <Icon name="search" size={20} />{photo ? '다른 사진으로 찾기' : '사진으로 어종 찾기'}
            <input type="file" accept="image/*" capture="environment" hidden onChange={e => pickPhoto(e.target.files?.[0] ?? null)} />
          </label>
          {photo && <FishIdResult state={fishIdState} result={fishId} species={species} value={form.species_id} onPick={pickSpecies} />}
          <SpeciesPicker species={species} value={form.species_id} closed={closedIds} onChange={pickSpecies} onAdded={s => setSpecies(l => [...l, s])} />
          <button className="btn ghost" style={{ marginTop: 16 }} onClick={answerZero}>오늘은 꽝이었어요</button>
        </section>
      )}

      {step === 'detail' && (
        <section>
          {zero ? (
            <h2 style={Q}>꽝도 소중한 기록이에요</h2>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                {picked && <FishArt code={picked.code} name={picked.name_ko} size={72} />}
                <h2 style={{ ...Q, margin: 0 }}>{picked?.name_ko} 몇 마리 잡았나요?</h2>
              </div>
              <div className="chips">
                {COUNTS.map(n => <button key={n} className={`chip ${form.count === n ? 'on' : ''}`} onClick={() => setForm(f => ({ ...f, count: n }))}>{n}마리</button>)}
                <button className="chip" aria-label="한 마리 빼기" onClick={() => setForm(f => ({ ...f, count: Math.max(1, f.count - 1) }))}>−</button>
                <span style={{ alignSelf: 'center', fontWeight: 800, minWidth: 28, textAlign: 'center' }}>{form.count}</span>
                <button className="chip" aria-label="한 마리 더하기" onClick={() => setForm(f => ({ ...f, count: f.count + 1 }))}>+</button>
              </div>

              <div className="label">가장 큰 녀석 크기 (cm, 선택)</div>
              <input type="number" inputMode="decimal" placeholder="예: 32" value={form.size_cm} onChange={e => setForm(f => ({ ...f, size_cm: e.target.value }))} />
              {otherRule && <>
                <div className="label">{otherRule.measure} (cm, 금지체장 확인용){otherRule.note ? <span className="sub"> {otherRule.note}</span> : null}</div>
                <input type="number" inputMode="decimal" placeholder={`금지체장 ${otherRule.min_size_cm}cm`} value={measureCm} onChange={e => setMeasureCm(e.target.value)} aria-label={otherRule.measure ?? '길이'} />
              </>}

              {checks.length > 0 && (
                <div className="card plain" style={{ marginTop: 10, borderColor: mustRelease ? 'var(--danger)' : 'var(--warn)' }}>
                  {checks.map((c, i) => (
                    <div key={i} style={{ marginBottom: 6 }}>
                      <b style={{ color: c.level === 'info' ? 'var(--warn)' : 'var(--danger)' }}>{c.title}</b>
                      <div style={{ fontSize: 13 }}>{c.detail}</div>
                    </div>
                  ))}
                  {mustRelease && (
                    <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, fontWeight: 700 }}>
                      <input type="checkbox" checked={release} onChange={e => setRelease(e.target.checked)} />
                      방생했어요 (방생 기록으로 저장)
                    </label>
                  )}
                </div>
              )}

              <div className="label">어떻게 잡았나요?</div>
              <div className="chips">{methods.map(m => <button key={m.code} className={`chip ${form.method_code === m.code ? 'on' : ''}`} onClick={() => setForm(f => ({ ...f, method_code: f.method_code === m.code ? '' : m.code }))}>{m.label}</button>)}</div>
              <div className="label">미끼는요?</div>
              <div className="chips">{baits.map(b => <button key={b.code} className={`chip ${form.bait_code === b.code ? 'on' : ''}`} onClick={() => setForm(f => ({ ...f, bait_code: f.bait_code === b.code ? '' : b.code }))}>{b.label}</button>)}</div>

              {!photo && (
                <label className="btn ghost" style={{ marginTop: 16 }}>
                  사진 올리기 (사진이 있어야 포인트가 쌓여요)
                  <input type="file" accept="image/*" capture="environment" hidden onChange={e => pickPhoto(e.target.files?.[0] ?? null)} />
                </label>
              )}
              {photo && <div className="note">사진 1장 첨부됨</div>}
            </>
          )}

          <div className="card auto" style={{ marginTop: 16, fontSize: 14 }}>
            <div className="label" style={{ margin: '0 0 4px' }}>{at ? '그날 날씨 · 물때' : '지금 날씨 · 물때'}</div>
            {auto ? `${auto.weather} ${auto.temp_c ?? '-'}°C · ${auto.wind_dir ?? ''} ${auto.wind_ms ?? '-'}m/s` : '불러오는 중…'} · 물때 {tide ? `${tide.label}${tide.phase ? ` (${tide.phase})` : ''}` : '-'}
            {at && <div className="note" style={{ marginTop: 4 }}>지난 날씨 출처: {PAST_WEATHER_SOURCE} (CC BY 4.0)</div>}
          </div>
          {banned && <BanWarning />}

          <label style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '14px 0', fontSize: 13 }}>
            <input type="checkbox" checked={share} onChange={e => setShare(e.target.checked)} />
            다른 사람 검색에 공개 (정확한 위치 대신 대략 500m 범위로만 보여요)
          </label>

          <button className="btn" disabled={!pos || busy || whenInvalid || (mustRelease && !release)} onPointerDown={pulse} onClick={save}>
            {busy ? '저장하는 중…' : zero ? '꽝으로 기록' : mustRelease && !release ? '방생 확인 후 저장' : release ? '방생 기록 저장' : late ? '지난 기록 저장' : '저장하고 포인트 받기'}
          </button>
        </section>
      )}
    </div>
  )
}

const Q: React.CSSProperties = { fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 14px' }

function BanWarning() {
  return (
    <div className="card plain" style={{ borderColor: 'var(--danger)', marginTop: 10 }}>
      <b style={{ color: 'var(--danger)' }}>낚시금지구역 안이에요</b>
      <div style={{ fontSize: 13 }}>해도에 낚시 제한구역으로 표시된 곳이에요. 위치를 다시 확인해 주세요.</div>
      <div className="note" style={{ marginTop: 4 }}>국립해양조사원 전자해도 기준 안내예요. 지자체 낚시통제구역은 현장 안내판을 확인해 주세요.</div>
    </div>
  )
}

function FishIdResult({ state, result, species, value, onPick }: {
  state: string; result: FishId | null; species: Species[]; value: number; onPick: (id: number) => void
}) {
  if (state === 'loading') return <div className="card plain empty">사진 속 어종을 확인하는 중…</div>
  if (state !== 'idle') return <div className="card plain error">{state}</div>
  if (!result) return null
  const list = result.candidates.length ? result.candidates : result.species ? [{ name: result.species, reason: '' }] : []
  return (
    <div className="card plain">
      {!result.is_fish ? <div style={{ fontSize: 14 }}>사진에서 물고기를 찾지 못했어요. 아래에서 직접 골라 주세요.</div> : (
        <>
          <div style={{ fontSize: 14 }}>{result.species ? <><b>{result.species}</b>로 보여요 · {CONFIDENCE_LABEL[result.confidence]}</> : '목록에서 맞는 어종을 찾지 못했어요.'}</div>
          {result.note && <div className="sub" style={{ marginTop: 2 }}>{result.note}</div>}
          <div className="chips" style={{ marginTop: 8 }}>
            {list.map(c => {
              const s = species.find(x => x.name_ko === c.name)
              if (!s) return null
              return <button key={c.name} className={`chip ${s.id === value ? 'on' : ''}`} title={c.reason} onClick={() => onPick(s.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><FishArt code={s.code} size={28} />{c.name}</button>
            })}
          </div>
        </>
      )}
      <div className="note">AI 추정이라 틀릴 수 있어요. 오늘 {result.remaining}번 더 쓸 수 있어요.</div>
    </div>
  )
}

async function hash(file: File) {
  const buf = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}
