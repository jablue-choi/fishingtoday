import { useState } from 'react'
import { getPosition } from '../lib/geo'
import { searchPlaces, type PlaceHit } from '../lib/kakaoMap'
import Icon from './Icon'

type Pos = { lat: number; lon: number }

/** 아래에서 올라오는 '기준 위치' 고르기: 현위치 또는 장소 검색 */
export default function LocationSheet({ onPick, onClose }: { onPick: (p: Pos, name: string) => void; onClose: () => void }) {
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<PlaceHit[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function gps() {
    setBusy(true); setErr('')
    try { const g = await getPosition(); onPick({ lat: g.coords.latitude, lon: g.coords.longitude }, '') }
    catch (e) { setErr((e as Error).message) }
    finally { setBusy(false) }
  }
  async function search() {
    setErr(''); setHits(null)
    try { setHits(await searchPlaces(q)) } catch (e) { setErr((e as Error).message) }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <div className="sheet" role="dialog" aria-modal="true" aria-label="기준 위치 고르기" onClick={e => e.stopPropagation()}>
        <div className="card-head">
          <div className="card-title">어디 바다를 볼까요?</div>
          <button className="chip sm" onClick={onClose}>닫기</button>
        </div>
        <button className="choice" style={{ width: '100%' }} disabled={busy} onClick={gps}><Icon name="pin" size={20} />{busy ? '찾는 중…' : '지금 내 위치'}</button>
        <div className="or">또는 장소 검색</div>
        <form className="search-field" role="search" onSubmit={e => { e.preventDefault(); search() }}>
          <Icon name="search" size={20} />
          <input type="search" autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="예: 태안 안흥항, 속초, 여수" aria-label="장소 검색" enterKeyHint="search" />
          <button type="submit" disabled={!q.trim()}>검색</button>
        </form>
        {err && <div className="error" style={{ marginTop: 8 }}>{err}</div>}
        {hits && (
          <div className="list" style={{ marginTop: 10 }}>
            {hits.length === 0 && <div className="empty">찾는 곳이 없어요.</div>}
            {hits.map((h, i) => (
              <button key={i} className="item" style={{ textAlign: 'left', cursor: 'pointer', color: 'var(--ink)' }} onClick={() => onPick(h, h.name)}>
                <div className="item-title">{h.name}</div>
                <div className="sub">{h.address}</div>
              </button>
            ))}
          </div>
        )}
        <div className="note">고른 위치로 물때·날씨·주변 포인트를 보여 드려요.</div>
      </div>
    </div>
  )
}
