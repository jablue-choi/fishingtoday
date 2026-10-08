import { supabase } from './supabase'

/* 지역별 잘 잡히는 어종: 최근 N일 공개 기록을 시도+시군구 단위로 묶어 어종별 마릿수 순위 */
type Row = { region: string | null; species_name: string | null; count: number; size_cm: number | null }
export type RegionInfo = { key: string; label: string; logs: number }
export type SpeciesRank = { name: string; fish: number; logs: number; best: number | null }

/** '강원특별자치도 속초시 조양동' → '강원특별자치도 속초시' */
export const regionKey = (r: string | null) => (r ? r.split(' ').slice(0, 2).join(' ') : '')
/** 화면용 짧은 이름: '속초시', '안산시 단원구'는 '안산시' */
export const regionLabel = (key: string) => key.split(' ')[1] ?? key

let cache: { at: number; days: number; rows: Row[] } | null = null
async function recentRows(days: number): Promise<Row[]> {
  if (cache && cache.days === days && Date.now() - cache.at < 5 * 60e3) return cache.rows
  const since = new Date(Date.now() - days * 864e5).toISOString()
  const { data, error } = await supabase.from('public_catch_v')
    .select('region,species_name,count,size_cm')
    .in('log_type', ['catch', 'release']).gte('caught_at', since).limit(5000)
  if (error) throw new Error('지역 조황을 불러오지 못했어요')
  cache = { at: Date.now(), days, rows: (data ?? []) as Row[] }
  return cache.rows
}

export async function regionStats(days = 30): Promise<{ regions: RegionInfo[]; rank: (key: string) => SpeciesRank[] }> {
  const rows = await recentRows(days)
  const byRegion = new Map<string, Row[]>()
  for (const r of rows) {
    const k = regionKey(r.region)
    if (!k || !r.species_name) continue
    byRegion.set(k, [...(byRegion.get(k) ?? []), r])
  }
  const regions = [...byRegion].map(([key, list]) => ({ key, label: regionLabel(key), logs: list.length })).sort((a, b) => b.logs - a.logs)
  const rank = (key: string) => {
    const m = new Map<string, SpeciesRank>()
    for (const r of byRegion.get(key) ?? []) {
      const s = m.get(r.species_name!) ?? { name: r.species_name!, fish: 0, logs: 0, best: null }
      s.fish += r.count || 0; s.logs++
      if (r.size_cm != null && (s.best == null || r.size_cm > s.best)) s.best = r.size_cm
      m.set(r.species_name!, s)
    }
    return [...m.values()].sort((a, b) => b.fish - a.fish || b.logs - a.logs)
  }
  return { regions, rank }
}
