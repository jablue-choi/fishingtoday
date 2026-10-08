import { supabase } from './supabase'

export type RankPeriod = 'today' | 'week' | 'month'
export type RankRow = {
  rank: number; nickname: string; is_me: boolean; is_sample: boolean
  score: number; fish: number; logs: number; best_species: string | null; best_size: number | null; region: string | null
}
export const PERIOD_LABEL: Record<RankPeriod, string> = { today: '오늘', week: '이번 주', month: '이번 달' }

export async function fetchRanking(period: RankPeriod, limit = 20): Promise<RankRow[]> {
  const { data, error } = await supabase.rpc('angler_ranking', { p_period: period, p_limit: limit })
  if (error) throw new Error('랭킹을 불러오지 못했어요')
  return (data ?? []) as RankRow[]
}

/** 지역명은 시군구까지만 ('경기 안산시 단원구 대부동동' → '안산시 단원구') */
export const shortRegion = (r: string | null) => (r ? r.split(' ').slice(1, 3).join(' ') : '')
