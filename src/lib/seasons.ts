import { supabase } from './supabase'
import { fetchRules, inPeriod, startsWithin } from './rules'

export type Area = '서해' | '남해' | '동해' | '제주' | '민물'
export const AREAS: Area[] = ['서해', '남해', '동해', '제주', '민물']

type SeasonRow = {
  species_id: number; area: Area; months: number[]; peak_months: number[]
  methods: string[]; baits: string[]; tip: string | null
  species: { name_ko: string } | null
}

export type SeasonPick = {
  speciesId: number; name: string; peak: boolean; methods: string[]; baits: string[]; tip: string | null
  recent: number            // 최근 30일 공개 기록 마릿수
  closingIn: number | null  // n일 뒤 금어기 시작
}

/** 위치로 해역 추정 (경도·위도 경계로 단순 판정, 내륙은 가까운 바다 쪽으로 붙음) */
export function guessArea(p: { lat: number; lon: number } | null): Area {
  if (!p) return '서해'
  if (p.lat < 33.7) return '제주'
  if (p.lon >= 128.8 && p.lat >= 35.3) return '동해'
  if (p.lat < 35.0 || (p.lon >= 127.5 && p.lat < 35.3)) return '남해'
  return '서해'
}

const kstMonth = () => new Date(Date.now() + 9 * 3600e3).getUTCMonth() + 1

let seasonCache: Promise<SeasonRow[]> | null = null
function fetchSeasons(): Promise<SeasonRow[]> {
  if (!seasonCache) {
    seasonCache = Promise.resolve(supabase.from('species_seasons')
      .select('species_id,area,months,peak_months,methods,baits,tip,species(name_ko)'))
      .then(({ data, error }) => { if (error) { seasonCache = null; throw error } return (data ?? []) as unknown as SeasonRow[] })
  }
  return seasonCache
}

/** 최근 30일 공개 조과 어종별 마릿수 */
async function recentCounts(): Promise<Map<string, number>> {
  const since = new Date(Date.now() - 30 * 864e5).toISOString()
  const { data, error } = await supabase.from('public_catch_v')
    .select('species_name,count').eq('log_type', 'catch').gte('caught_at', since).limit(2000)
  const m = new Map<string, number>()
  if (error) return m
  for (const r of data ?? []) if (r.species_name) m.set(r.species_name, (m.get(r.species_name) ?? 0) + (r.count || 0))
  return m
}

/** 이번 달 해역별 추천 어종: 금어기 제외, 제철 먼저, 최근 조황 많은 순 */
export async function seasonPicks(area: Area): Promise<SeasonPick[]> {
  const [rows, rules, counts] = await Promise.all([fetchSeasons(), fetchRules(), recentCounts()])
  const month = kstMonth()
  const seasonRules = rules.filter(r => r.rule_type === 'season')
  const closed = new Set(seasonRules.filter(r => inPeriod(r)).map(r => r.species_id))

  return rows
    .filter(r => r.area === area && r.months.includes(month) && !closed.has(r.species_id))
    .map(r => {
      const soon = seasonRules.filter(x => x.species_id === r.species_id).map(x => startsWithin(x, 30)).filter((d): d is number => d !== false)
      const name = r.species?.name_ko ?? ''
      return {
        speciesId: r.species_id, name, peak: r.peak_months.includes(month),
        methods: r.methods, baits: r.baits, tip: r.tip,
        recent: counts.get(name) ?? 0,
        closingIn: soon.length ? Math.min(...soon) : null,
      }
    })
    .sort((a, b) => Number(b.peak) - Number(a.peak) || b.recent - a.recent || a.name.localeCompare(b.name))
}
