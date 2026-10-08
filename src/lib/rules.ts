import { supabase } from './supabase'

export type Rule = {
  id: number; species_id: number; rule_type: 'season' | 'min_size' | 'min_weight' | 'notice'
  start_mmdd: string | null; end_mmdd: string | null
  min_size_cm: number | null; min_weight_g: number | null
  measure: string | null; note: string | null; law_ref: string | null
  region: string | null   // 있으면 그 지역·수역에만 적용 (쏘가리 권역×하천/댐 등) → 막지 않고 안내만
  species: { name_ko: string } | null
}

let cache: Promise<Rule[]> | null = null
export function fetchRules(): Promise<Rule[]> {
  if (!cache) {
    cache = Promise.resolve(supabase.from('closed_season_rules')
      .select('id,species_id,rule_type,start_mmdd,end_mmdd,min_size_cm,min_weight_g,measure,note,law_ref,region,species(name_ko)'))
      .then(({ data, error }) => { if (error) { cache = null; throw error } return (data ?? []) as unknown as Rule[] })
  }
  return cache
}

const kstToday = () => new Date(Date.now() + 9 * 3600e3)
const mmdd = (d: Date) => String(d.getUTCMonth() + 1).padStart(2, '0') + String(d.getUTCDate()).padStart(2, '0')
const fmt = (m: string) => `${Number(m.slice(0, 2))}.${Number(m.slice(2))}`
export const period = (r: Rule) => (r.start_mmdd && r.end_mmdd ? `${fmt(r.start_mmdd)}~${fmt(r.end_mmdd)}` : '')

/** 기간 안인지 (연말을 넘어가는 기간도 처리) */
export function inPeriod(r: Rule, d = kstToday()) {
  if (!r.start_mmdd || !r.end_mmdd) return false
  const t = mmdd(d)
  return r.start_mmdd <= r.end_mmdd ? t >= r.start_mmdd && t <= r.end_mmdd : t >= r.start_mmdd || t <= r.end_mmdd
}
/** n일 안에 시작하는지 */
export function startsWithin(r: Rule, days: number) {
  if (!r.start_mmdd) return false
  const d = kstToday()
  for (let i = 1; i <= days; i++) { const x = new Date(d.getTime() + i * 864e5); if (mmdd(x) === r.start_mmdd) return i }
  return false
}

export type Check = { level: 'ban' | 'size' | 'info'; title: string; detail: string }

/** 금지체장이 전장이 아닌 다른 길이 기준인 규칙 (갈치 항문장, 살오징어 외투장) */
export function otherMeasureRule(rules: Rule[], speciesId: number): Rule | undefined {
  return rules.find(r => r.species_id === speciesId && r.rule_type === 'min_size' && r.min_size_cm != null && !!r.measure && r.measure !== '전장')
}

/**
 * 어종·사이즈 입력값으로 경고 만들기
 * sizeCm은 전장(저장값). 전장이 아닌 기준의 규칙은 measureCm(그 기준으로 잰 길이)으로만 판정하고, 없으면 안내만
 */
export function checkCatch(rules: Rule[], speciesId: number, sizeCm: number | null, at?: Date, measureCm: number | null = null): Check[] {
  const mine = rules.filter(r => r.species_id === speciesId)
  const d = at ? new Date(at.getTime() + 9 * 3600e3) : kstToday()
  const past = !!at && Date.now() - at.getTime() > 864e5
  const out: Check[] = []
  for (const r of mine) {
    if (r.rule_type === 'season' && inPeriod(r, d))
      out.push(r.region
        ? { level: 'info', title: `${r.region}이면 금어기예요 (${period(r)})`, detail: '해당 지역·수역이면 방생해야 해요.' }
        : { level: 'ban', title: `${past ? '그날은' : '지금은'} 금어기예요 (${period(r)})`, detail: `이 기간엔 잡으면 안 되는 어종이라 방생해야 해요.${r.note ? ` ${r.note}.` : ''}` })
    if (r.rule_type === 'notice' && inPeriod(r, d))
      out.push({ level: 'info', title: `금어기 고시 기간이에요 (${period(r)} 중 1개월)`, detail: '올해 고시된 금어기인지 확인해 주세요.' })
    // 법령은 'n cm 이하' 포획 금지 → 경계값 포함
    if (r.rule_type === 'min_size' && r.min_size_cm != null) {
      const other = !!r.measure && r.measure !== '전장'
      const v = other ? measureCm : sizeCm
      if (v != null && v <= r.min_size_cm)
        out.push({ level: 'size', title: `금지체장 ${r.min_size_cm}cm 이하예요`, detail: `${r.measure ?? '전장'} 기준 ${r.min_size_cm}cm 이하면 방생해야 해요.` })
      else if (other && v == null)
        out.push({ level: 'info', title: `금지체장은 ${r.measure} ${r.min_size_cm}cm예요`, detail: `${r.measure}${r.note ? `(${r.note})` : ''}이 ${r.min_size_cm}cm 이하면 방생해야 해요. 재 보셨다면 아래에 적어 주세요.` })
    }
    if (r.rule_type === 'min_weight' && r.min_weight_g != null)
      out.push({ level: 'info', title: `금지체중 ${r.min_weight_g}g`, detail: `${r.min_weight_g}g 이하는 방생해야 해요.` })
  }
  return out
}

/** 위치가 낚시금지구역(해도 제한구역) 안인지. 조회 실패 시 빈 배열 */
export async function banZonesAt(lat: number, lon: number): Promise<{ id: number; name: string | null }[]> {
  const { data, error } = await supabase.rpc('ban_zones_at', { p_lat: lat, p_lon: lon, p_m: 0 })
  return error ? [] : (data ?? [])
}

/** 어종 칩 옆 표시용: 지금 금어기인 어종 id */
export function closedNow(rules: Rule[], at?: Date): Set<number> {
  const d = at ? new Date(at.getTime() + 9 * 3600e3) : kstToday()
  return new Set(rules.filter(r => r.rule_type === 'season' && !r.region && inPeriod(r, d)).map(r => r.species_id))
}
