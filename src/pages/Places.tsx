import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getLastPos, saveLastPos } from '../lib/fishingIndex'
import { getPosition } from '../lib/geo'
import { placesNear, listNotes, tipCounts, addNote, deleteNote, distText, PLACE_TYPES, STATUS, STATUS_LABEL, type Place, type PlaceType, type Note } from '../lib/places'
import { myBlockStatus, blockText, reportContent } from '../lib/moderation'
import { hasProfanity, PROFANITY_MSG } from '../lib/profanity'
import { ago, myUserId } from '../lib/community'
import PlacesMap from '../components/PlacesMap'
import Icon from '../components/Icon'
import { useAuth } from '../lib/auth'

/** 주변 편의시설 지도: 화장실(상태 제보) · 낚시점 · 미끼 · 맛집 (팁 남기기, 제보 +10P) */
export default function Places() {
  const [params, setParams] = useSearchParams()
  const type = (PLACE_TYPES.some(t => t.k === params.get('type')) ? params.get('type') : 'toilet') as PlaceType
  const [pos, setPos] = useState(getLastPos)
  const [places, setPlaces] = useState<Place[] | null>(null)
  const [tips, setTips] = useState<Map<string, number>>(new Map())
  const [sel, setSel] = useState<Place | null>(null)
  const [err, setErr] = useState('')
  const [locating, setLocating] = useState(false)

  useEffect(() => {
    setPlaces(null); setSel(null); setErr('')
    if (!pos) return
    placesNear(type, pos).then(list => {
      setPlaces(list)
      tipCounts(type, list.map(p => p.ref)).then(setTips)
    }).catch(e => setErr((e as Error).message))
  }, [type, pos?.lat, pos?.lon]) // eslint-disable-line react-hooks/exhaustive-deps

  async function gps() {
    setLocating(true); setErr('')
    try { const g = await getPosition(); const p = { lat: g.coords.latitude, lon: g.coords.longitude }; saveLastPos(p); setPos(p) }
    catch (e) { setErr((e as Error).message) }
    finally { setLocating(false) }
  }

  return (
    <div className="page">
      <h1>주변 편의시설</h1>
      <div className="chips" style={{ marginBottom: 10 }}>
        {PLACE_TYPES.map(t => <button key={t.k} className={`chip ${type === t.k ? 'on' : ''}`} onClick={() => setParams({ type: t.k }, { replace: true })}>{t.label}</button>)}
        <button className="chip" onClick={gps} disabled={locating} style={{ marginLeft: 'auto' }}><Icon name="pin" size={14} />{locating ? '찾는 중…' : '현위치로'}</button>
      </div>

      {!pos ? (
        <div className="card plain">
          <div style={{ fontSize: 14, marginBottom: 10 }}>현위치를 찍으면 주변 {PLACE_TYPES.find(t => t.k === type)!.label}을 보여 드려요.</div>
          <button className="btn" onClick={gps} disabled={locating}><Icon name="pin" size={18} />현위치 찍기</button>
        </div>
      ) : (
        <>
          <PlacesMap center={pos} places={places ?? []} selected={sel} onSelect={setSel} />
          {sel && <PlaceDetail key={`${sel.type}${sel.ref}`} place={sel} onClose={() => setSel(null)} />}
          {err && <div className="error">{err}</div>}
          {!places && !err && <div className="empty">찾는 중…</div>}
          {places?.length === 0 && <div className="card plain empty">{type === 'toilet' ? '3km 안에 등록된 화장실이 없어요. (화장실 데이터를 아직 넣지 않았을 수 있어요)' : '주변에서 찾지 못했어요.'}</div>}
          <div className="list">
            {places?.map(p => (
              <button key={p.ref} className="item" onClick={() => { setSel(p); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', cursor: 'pointer', color: 'var(--ink)', width: '100%', ...(sel?.ref === p.ref ? { borderColor: 'var(--accent)' } : {}) }}>
                <div className="score-box num" style={{ background: 'var(--line-soft)', color: 'var(--ink-2)', fontSize: 11 }}>{distText(p.dist_m)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="item-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                  <div className="sub" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.address ?? ''}{p.open_time ? ` · ${p.open_time}` : ''}</div>
                </div>
                {p.status?.last_kind && <span className={`badge ${p.status.last_kind === 'clean' ? 'good' : 'warn'}`}>{STATUS_LABEL[p.status.last_kind]}</span>}
                {(tips.get(p.ref) ?? 0) > 0 && <span className="badge accent">팁 {tips.get(p.ref)}</span>}
              </button>
            ))}
          </div>
          <div className="note">{PLACE_TYPES.find(t => t.k === type)!.desc} · 제보·팁을 남기면 10P (하루 5건, 같은 곳은 하루 1번)</div>
        </>
      )}
    </div>
  )
}

function PlaceDetail({ place, onClose }: { place: Place; onClose: () => void }) {
  const [notes, setNotes] = useState<Note[] | null>(null)
  const [tip, setTip] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [me, setMe] = useState('')
  const [block, setBlock] = useState<{ blocked: boolean; until: string | null; reason: string | null } | null>(null)
  const { session, requireLogin } = useAuth()
  const load = () => listNotes(place.type, place.ref).then(setNotes)
  useEffect(() => { load(); myUserId().then(setMe); if (session) myBlockStatus().then(setBlock) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function send(kind: Note['kind'], body: string | null) {
    if (!requireLogin(kind === 'tip' ? '팁을 남기려면' : '제보하려면')) return
    setBusy(true); setMsg('')
    try { await addNote(place, kind, body); setTip(''); setMsg(kind === 'tip' ? '팁을 남겼어요. 고마워요!' : '제보했어요. 고마워요!'); load() }
    catch (e) { setMsg((e as Error).message) }
    finally { setBusy(false) }
  }
  async function doReport(n: Note) {
    if (!requireLogin('신고하려면')) return
    const reason = window.prompt('신고 이유를 짧게 적어 주세요')
    if (reason === null) return
    try { await reportContent('place_note', n.id, reason); setMsg('신고했어요.') } catch (e) { setMsg((e as Error).message) }
  }

  const statusNotes = notes?.filter(n => n.kind !== 'tip') ?? []
  const tipNotes = notes?.filter(n => n.kind === 'tip') ?? []
  const bad = hasProfanity(tip)

  return (
    <div className="card" style={{ borderColor: 'var(--accent)' }}>
      <div className="item-row">
        <div className="card-title" style={{ minWidth: 0 }}>{place.name}</div>
        <button className="chip sm" onClick={onClose}>닫기</button>
      </div>
      <div className="sub">{place.address ?? ''} · {distText(place.dist_m)}</div>
      {place.open_time && <div className="sub">개방 {place.open_time}</div>}
      <div className="chips" style={{ marginTop: 8 }}>
        {place.phone && <a className="chip sm" href={`tel:${place.phone}`} style={{ textDecoration: 'none' }}>전화 {place.phone}</a>}
        {place.url && <a className="chip sm" href={place.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>카카오맵에서 보기</a>}
        <a className="chip sm" href={`https://map.kakao.com/link/to/${encodeURIComponent(place.name)},${place.lat},${place.lon}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>길찾기</a>
      </div>

      {block?.blocked && <div className="error" style={{ marginTop: 10 }}>{blockText(block)}</div>}

      {place.type === 'toilet' && (
        <>
          <div className="label">지금 상태는요? <span className="sub">(제보 +10P)</span></div>
          <div className="choices" style={{ gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }}>
            {STATUS.map(s => <button key={s.k} className="choice" style={{ minHeight: 44, fontSize: 14 }} disabled={busy || block?.blocked} onClick={() => send(s.k, null)}>{s.label}</button>)}
          </div>
          {statusNotes.length > 0 && (
            <div className="sub" style={{ marginTop: 8 }}>최근 제보: {statusNotes.slice(0, 5).map(n => `${STATUS_LABEL[n.kind]}(${ago(n.created_at)})`).join(' · ')}</div>
          )}
        </>
      )}

      <div className="label">{place.type === 'toilet' ? '팁' : '이용 팁'} {tipNotes.length > 0 && <span className="sub">{tipNotes.length}개</span>}</div>
      {notes && tipNotes.length === 0 && <div className="empty">아직 팁이 없어요. {place.type === 'shop' || place.type === 'bait' ? '예: "새벽 4시 오픈", "청갯지렁이 있음"' : place.type === 'food' ? '예: "낚시꾼 아침 백반 6시부터"' : '예: "밤엔 잠겨요"'}</div>}
      <div className="list">
        {tipNotes.map(n => (
          <div key={n.id} className="item">
            <div style={{ fontSize: 14 }}>{n.body}</div>
            <div className="item-row"><span className="sub">{n.profiles?.nickname ?? ''} · {ago(n.created_at)}</span>
              {n.user_id === me ? <button className="chip sm" onClick={() => deleteNote(n.id).then(load)}>지우기</button> : <button className="chip sm" onClick={() => doReport(n)}>신고</button>}
            </div>
          </div>
        ))}
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <input value={tip} maxLength={300} onChange={e => setTip(e.target.value)} onFocus={() => { if (!session) requireLogin('팁을 남기려면') }} placeholder={place.type === 'shop' || place.type === 'bait' ? '예: 새벽 4시 오픈, 청갯지렁이 있음' : '이곳에 대한 팁을 남겨 주세요'} aria-label="팁" disabled={block?.blocked} />
        <button className="btn" style={{ flex: '0 0 auto', width: 'auto', minHeight: 50, padding: '0 16px' }} disabled={busy || tip.trim().length < 2 || bad || block?.blocked} onClick={() => send('tip', tip)}>남기기</button>
      </div>
      {bad && <div className="error" style={{ marginTop: 6 }}>{PROFANITY_MSG}</div>}
      {msg && <div className="note">{msg}</div>}
    </div>
  )
}
