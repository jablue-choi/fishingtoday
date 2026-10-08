import { useEffect, useState } from 'react'
import { fetchRules, inPeriod, period, startsWithin, type Rule } from '../lib/rules'

/** 홈: 지금 금어기 / 곧 시작하는 금어기 */
export default function ClosedSeasonCard() {
  const [rules, setRules] = useState<Rule[] | null>(null)
  const [open, setOpen] = useState(false)
  useEffect(() => { fetchRules().then(setRules).catch(() => setRules([])) }, [])
  if (!rules) return null

  const seasons = rules.filter(r => r.rule_type === 'season' || r.rule_type === 'notice')
  const now = seasons.filter(r => inPeriod(r))
  const soon = seasons.map(r => ({ r, d: startsWithin(r, 30) })).filter(x => x.d !== false).sort((a, b) => (a.d as number) - (b.d as number))
  const sizes = rules.filter(r => r.rule_type === 'min_size' || r.rule_type === 'min_weight')
    .sort((a, b) => (a.species?.name_ko ?? '').localeCompare(b.species?.name_ko ?? ''))

  return (
    <div className="card">
      <b style={{ fontSize: 15 }}>금어기 안내</b>
      <div style={{ marginTop: 8 }}>
        {now.length === 0 && soon.length === 0 && <div style={{ fontSize: 13, color: 'var(--mute)' }}>지금은 금어기인 주요 어종이 없어요.</div>}
        {now.map(r => (
          <div key={r.id} className="kv">
            <span><span style={{ color: '#fff', background: '#D9472B', borderRadius: 999, padding: '1px 7px', fontSize: 11, marginRight: 6 }}>금어기</span>{r.species?.name_ko}</span>
            <b>{period(r)}{r.rule_type === 'notice' ? ' 중 1개월' : ''}</b>
          </div>
        ))}
        {soon.map(({ r, d }) => (
          <div key={r.id} className="kv">
            <span><span style={{ color: '#fff', background: '#E8A13A', borderRadius: 999, padding: '1px 7px', fontSize: 11, marginRight: 6 }}>D-{d}</span>{r.species?.name_ko}</span>
            <b>{period(r)}</b>
          </div>
        ))}
      </div>
      <button className="chip" style={{ marginTop: 8, fontSize: 12 }} onClick={() => setOpen(!open)}>{open ? '금지체장 닫기' : '금지체장 보기'}</button>
      {open && (
        <div style={{ marginTop: 6 }}>
          {sizes.map(r => (
            <div key={r.id} className="kv">
              <span>{r.species?.name_ko}{r.note ? <span style={{ color: 'var(--mute)' }}> ({r.note})</span> : null}</span>
              <b>{r.rule_type === 'min_weight' ? `${r.min_weight_g}g 이하` : `${r.min_size_cm}cm 미만`} 방생</b>
            </div>
          ))}
        </div>
      )}
      <div style={{ fontSize: 11, color: 'var(--mute)', marginTop: 8 }}>
        수산자원관리법 시행령 기준 안내예요. 지역·업종별 예외와 최신 개정은 국가법령정보센터에서 확인해 주세요. 낚시인 위반 시 과태료 대상이에요.
      </div>
    </div>
  )
}
