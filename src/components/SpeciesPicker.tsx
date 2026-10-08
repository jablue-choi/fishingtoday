import { useState } from 'react'
import FishArt from './FishArt'
import { addSpecies, type Species } from '../lib/species'
import { hasProfanity } from '../lib/profanity'

/**
 * 어종 고르기: 그림 + 이름 칩. 목록에 없으면 '어종 추가'로 정식 코드를 만들어 바로 선택.
 * closed: 지금(또는 그날) 금어기인 species_id
 */
export default function SpeciesPicker({ species, value, onChange, onAdded, closed }: {
  species: Species[]
  value: number
  onChange: (id: number) => void
  onAdded: (s: Species) => void
  closed?: Set<number>
}) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [water, setWater] = useState<'sea' | 'fresh'>('sea')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const picked = species.find(s => s.id === value)

  async function add() {
    if (!name.trim() || busy) return
    if (hasProfanity(name)) { setErr('쓸 수 없는 어종 이름이에요.'); return }
    setBusy(true); setErr('')
    try {
      const s = await addSpecies(name, water)
      if (!species.some(x => x.id === s.id)) onAdded(s)
      onChange(s.id)
      setAdding(false); setName('')
    } catch (e) { setErr((e as Error).message) }
    finally { setBusy(false) }
  }

  return (
    <div>
      {picked && (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, marginBottom: 10 }}>
          <FishArt code={picked.code} name={picked.name_ko} size={96} />
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{picked.name_ko}</div>
            {picked.status === 'user' && <div className="sub">사용자가 추가한 어종이에요</div>}
            {closed?.has(picked.id) && <span className="badge danger" style={{ marginTop: 4 }}>금어기</span>}
          </div>
        </div>
      )}
      <div className="chips">
        {species.map(s => (
          <button key={s.id} className={`chip ${value === s.id ? 'on' : ''}`} onClick={() => onChange(s.id)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, paddingLeft: 8 }}>
            <FishArt code={s.code} size={28} />
            {s.name_ko}
            {closed?.has(s.id) && <span style={{ fontSize: 10, color: value === s.id ? '#FFB4A6' : 'var(--danger)' }}>금어기</span>}
          </button>
        ))}
        {!adding && <button className="chip" onClick={() => setAdding(true)} style={{ border: '1.5px dashed var(--line)', background: 'transparent' }}>+ 어종 추가</button>}
      </div>
      {adding && (
        <div className="card" style={{ marginTop: 10 }}>
          <label className="label" htmlFor="new-species" style={{ marginTop: 0, display: 'block' }}>목록에 없는 어종 이름</label>
          <input id="new-species" value={name} maxLength={20} placeholder="예: 방어, 쥐치, 숭어" onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} />
          <div className="chips" style={{ marginTop: 8 }}>
            <button className={`chip sm ${water === 'sea' ? 'on' : ''}`} onClick={() => setWater('sea')}>바다</button>
            <button className={`chip sm ${water === 'fresh' ? 'on' : ''}`} onClick={() => setWater('fresh')}>민물</button>
          </div>
          {err && <div className="error" style={{ marginTop: 6 }}>{err}</div>}
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn ghost" onClick={() => { setAdding(false); setErr('') }}>취소</button>
            <button className="btn" disabled={!name.trim() || busy} onClick={add}>{busy ? '추가하는 중…' : '추가하고 선택'}</button>
          </div>
          <div className="note">이미 있는 이름이면 그 어종이 선택돼요. 추가한 어종은 다른 사람도 고를 수 있어요.</div>
        </div>
      )}
    </div>
  )
}
