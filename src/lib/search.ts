import { supabase } from './supabase'

export type PubRow = {
  id: string; caught_at: string; log_type: 'catch' | 'release' | 'zero'
  region: string | null; species_name: string | null; size_cm: number | null; count: number
  method_label: string | null; bait_label: string | null; weather: string | null; temp_c: number | null
  tide_mul: number | null; nickname: string; lat: number; lon: number; is_sample: boolean
}
export type Mode = 'region' | 'species' | 'recommend'

const COLS = 'id,caught_at,log_type,region,species_name,size_cm,count,method_label,bait_label,weather,temp_c,tide_mul,nickname,lat,lon,is_sample'

/** 다른 사람(+내) 공개 기록 검색. 추천은 최근 14일 전체. */
export async function searchPublic(mode: Mode, q: string): Promise<PubRow[]> {
  let req = supabase.from('public_catch_v').select(COLS).order('caught_at', { ascending: false }).limit(500)
  const kw = q.trim()
  if (mode === 'region' && kw) req = req.ilike('region', `%${kw}%`)
  if (mode === 'species' && kw) req = req.ilike('species_name', `%${kw}%`)
  if (mode === 'recommend') {
    const since = new Date(Date.now() - 14 * 864e5).toISOString()
    req = req.gte('caught_at', since)
  }
  const { data, error } = await req
  if (error) throw error
  return (data ?? []) as PubRow[]
}

export type Place = { key: string; region: string; lat: number; lon: number; fish: number; logs: number; zero: number; species: [string, number][]; method: string | null; bait: string | null; last: string }

/** 지역(시군구+읍면동) 단위로 묶어 점수순 정렬 */
export function summarizePlaces(rows: PubRow[]): Place[] {
  const m = new Map<string, Place & { _sp: Map<string, number>; _me: Map<string, number>; _ba: Map<string, number> }>()
  for (const r of rows) {
    const key = r.region ?? `${Number(r.lat).toFixed(2)},${Number(r.lon).toFixed(2)}`
    const p = m.get(key) ?? { key, region: r.region ?? '지역 미상', lat: Number(r.lat), lon: Number(r.lon), fish: 0, logs: 0, zero: 0, species: [], method: null, bait: null, last: r.caught_at, _sp: new Map(), _me: new Map(), _ba: new Map() }
    p.logs++
    if (r.log_type === 'zero') p.zero++
    if (r.log_type === 'catch') {
      p.fish += r.count || 0
      if (r.species_name) p._sp.set(r.species_name, (p._sp.get(r.species_name) ?? 0) + (r.count || 0))
      if (r.method_label) p._me.set(r.method_label, (p._me.get(r.method_label) ?? 0) + (r.count || 0))
      if (r.bait_label) p._ba.set(r.bait_label, (p._ba.get(r.bait_label) ?? 0) + (r.count || 0))
    }
    if (r.caught_at > p.last) p.last = r.caught_at
    m.set(key, p)
  }
  const top = (mm: Map<string, number>) => [...mm].sort((a, b) => b[1] - a[1])
  return [...m.values()].map(({ _sp, _me, _ba, ...p }) => ({
    ...p, species: top(_sp).slice(0, 3), method: top(_me)[0]?.[0] ?? null, bait: top(_ba)[0]?.[0] ?? null,
  })).sort((a, b) => (b.fish / Math.max(1, b.logs)) * Math.log2(b.logs + 1) - (a.fish / Math.max(1, a.logs)) * Math.log2(a.logs + 1))
}

/* 최근 검색어 (이 기기에만 저장) */
const KEY = 'recent_searches'
export function getRecent(): { mode: Mode; q: string }[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] }
}
export function pushRecent(mode: Mode, q: string) {
  if (!q.trim()) return
  try {
    const list = getRecent().filter(x => !(x.mode === mode && x.q === q)).slice(0, 7)
    localStorage.setItem(KEY, JSON.stringify([{ mode, q }, ...list]))
  } catch { /* 저장 실패는 무시 */ }
}
export function clearRecent() { try { localStorage.removeItem(KEY) } catch { /* noop */ } }
