import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { regionStats, regionKey, regionLabel, type RegionInfo, type SpeciesRank } from '../lib/regionStats'
import { fetchSpecies, type Species } from '../lib/species'
import { getLastPos } from '../lib/fishingIndex'
import { regionName } from '../lib/kakaoMap'
import FishArt from './FishArt'
import Icon from './Icon'

const MEDAL = ['var(--accent)', '#94A3B8', '#C08457']

/**
 * 지역별 잘 잡히는 어종 순위 (최근 30일 공개 기록)
 * compact: 홈용 — 기준 위치 지역 TOP 3만, 지역 고르기 없음
 */
export default function RegionFishCard({ compact = false, limit = compact ? 3 : 10 }: { compact?: boolean; limit?: number }) {
  const nav = useNavigate()
  const [regions, setRegions] = useState<RegionInfo[] | null>(null)
  const [rankOf, setRankOf] = useState<((k: string) => SpeciesRank[]) | null>(null)
  const [mine, setMine] = useState('')        // 기준 위치의 지역 키
  const [sel, setSel] = useState('')
  const [species, setSpecies] = useState<Species[]>([])
  const [err, setErr] = useState('')

  useEffect(() => {
    regionStats(30).then(s => { setRegions(s.regions); setRankOf(() => s.rank) }).catch(e => setErr((e as Error).message))
    fetchSpecies().then(setSpecies).catch(() => setSpecies([]))
    const p = getLastPos()
    if (p) regionName(p.lat, p.lon).then(n => { const k = regionKey(n); if (k) setMine(k) })
  }, [])

  // 처음 고를 지역: 내 지역(기록이 있으면) → 기록 많은 지역
  const active = sel || (mine && regions?.some(r => r.key === mine) ? mine : regions?.[0]?.key ?? '')
  const list = useMemo(() => (rankOf && active ? rankOf(active).slice(0, limit) : []), [rankOf, active, limit])
  const codeOf = (n: string) => species.find(s => s.name_ko === n)?.code
  const max = Math.max(1, ...list.map(s => s.fish))
  // 지역 칩: 내 지역(기록 있으면)을 맨 앞에, 그다음 기록 많은 순 10곳
  const chips = regions ? [...regions.filter(r => r.key === mine), ...regions.filter(r => r.key !== mine).slice(0, 10)] : []

  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title"><span style={{ color: 'var(--accent)', display: 'inline-flex' }}><Icon name="fire" size={16} /></span>
          {compact ? `${active ? regionLabel(active) : '우리 지역'} 잘 잡히는 어종` : '지역별 잘 잡히는 어종'}
        </div>
        {compact ? <Link to="/ranking?tab=region" className="more">지역별 보기<Icon name="chevron" size={12} /></Link> : <span className="sub">최근 30일</span>}
      </div>

      {!compact && chips.length > 0 && (
        <div className="chips" style={{ flexWrap: 'nowrap', overflowX: 'auto', marginBottom: 10 }}>
          {chips.map(r => (
            <button key={r.key} className={`chip sm ${active === r.key ? 'on' : ''}`} onClick={() => setSel(r.key)} style={{ whiteSpace: 'nowrap' }}>
              {r.key === mine ? '내 지역 · ' : ''}{r.label}
            </button>
          ))}
        </div>
      )}

      {err && <div className="error">{err}</div>}
      {!regions && !err && <div className="empty">불러오는 중…</div>}
      {regions && list.length === 0 && <div className="empty">최근 30일 공개된 조과가 아직 없어요.</div>}
      {compact && mine && regions && active !== mine && list.length > 0 && <div className="note" style={{ marginTop: 0, marginBottom: 8 }}>내 지역은 아직 기록이 없어서 기록이 많은 {regionLabel(active)} 순위를 보여 드려요.</div>}

      <div className="list">
        {list.map((s, i) => (
          <button key={s.name} className="item" onClick={() => nav(`/search?q=${encodeURIComponent(`${regionLabel(active)} ${s.name}`)}`)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', cursor: 'pointer', color: 'var(--ink)', width: '100%' }}>
            <span className="num" style={{ flex: '0 0 auto', width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, background: i < 3 ? MEDAL[i] : 'var(--line-soft)', color: i < 3 ? '#fff' : 'var(--ink-2)' }}>{i + 1}</span>
            <FishArt code={codeOf(s.name)} name={s.name} size={56} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="item-row"><span className="item-title">{s.name}</span><b className="num" style={{ fontSize: 14 }}>{s.fish}마리</b></div>
              <div style={{ height: 6, background: 'var(--line-soft)', borderRadius: 3, margin: '5px 0 3px' }}>
                <div style={{ width: `${(s.fish / max) * 100}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent), var(--accent-dark))', borderRadius: 3 }} />
              </div>
              <div className="sub" style={{ fontSize: 11 }}>기록 {s.logs}건{s.best != null ? ` · 최대 ${s.best}cm` : ''}</div>
            </div>
          </button>
        ))}
      </div>
      {!compact && <div className="note">공개된 기록(관리자 등록 포함)을 시·군 단위로 모아 마릿수 순으로 보여 드려요. 누르면 그 지역·어종 기록을 찾아요.</div>}
    </div>
  )
}
