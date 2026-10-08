import { supabase } from './supabase'
import { sourceLabel } from './admin'

export type PubRow = {
  id: string; caught_at: string; log_type: 'catch' | 'release' | 'zero'
  region: string | null; species_name: string | null; size_cm: number | null; count: number
  method_label: string | null; bait_label: string | null; weather: string | null; temp_c: number | null
  tide_mul: number | null; nickname: string; lat: number; lon: number; is_sample: boolean
  entered_by: 'user' | 'admin'; source_type: string | null; source_name: string | null
  share_url: string | null
}
export type Mode = 'region' | 'species' | 'recommend'

const COLS = 'id,caught_at,log_type,region,species_name,size_cm,count,method_label,bait_label,weather,temp_c,tide_mul,nickname,lat,lon,is_sample,entered_by,source_type,source_name,share_url'

/** 추천: 최근 14일 공개 기록 전체 */
export async function searchRecent(): Promise<PubRow[]> {
  const since = new Date(Date.now() - 14 * 864e5).toISOString()
  const { data, error } = await supabase.from('public_catch_v').select(COLS).gte('caught_at', since).order('caught_at', { ascending: false }).limit(500)
  if (error) throw error
  return (data ?? []) as PubRow[]
}

export type Parsed = { species: string[]; region: string }

/**
 * 검색어 나누기: 어종 이름이 들어 있는 단어는 어종, 나머지는 지역
 *  '우럭' → 어종 / '오징어' → 갑오징어·무늬오징어·살오징어 / '우럭낚시' → 우럭 / '속초 우럭' → 지역 속초 + 우럭
 */
export function parseQuery(q: string, speciesNames: string[]): Parsed {
  const species = new Set<string>()
  const region: string[] = []
  for (const tok of q.split(/[\s,]+/).map(t => t.trim()).filter(Boolean)) {
    const hit = speciesNames.filter(n => n === tok || tok.includes(n) || (tok.length >= 2 && n.endsWith(tok)))
    if (hit.length) hit.forEach(n => species.add(n))
    else region.push(tok)
  }
  return { species: [...species], region: region.join(' ') }
}

export type SearchResult = { rows: PubRow[]; parsed: Parsed; near?: { name: string; lat: number; lon: number; km: number } }

/** 통합 검색. 지역 글자로 못 찾으면 카카오 장소 검색 좌표 근처(약 15km)로 다시 */
export async function searchUnified(q: string, speciesNames: string[], findPlace: (q: string) => Promise<{ name: string; lat: number; lon: number } | null>): Promise<SearchResult> {
  const parsed = parseQuery(q, speciesNames)
  if (!parsed.species.length && !parsed.region) return { rows: [], parsed }

  const base = () => {
    let r = supabase.from('public_catch_v').select(COLS).order('caught_at', { ascending: false }).limit(500)
    if (parsed.species.length) r = r.in('species_name', parsed.species)
    return r
  }

  if (!parsed.region) {
    const { data, error } = await base()
    if (error) throw error
    return { rows: (data ?? []) as PubRow[], parsed }
  }

  let byText = base()
  for (const t of parsed.region.split(' ')) byText = byText.ilike('region', `%${t.replace(/(도|시|군|구|읍|면|동|리)$/, '') || t}%`)
  const { data, error } = await byText
  if (error) throw error
  if (data?.length) return { rows: data as PubRow[], parsed }

  const place = await findPlace(parsed.region).catch(() => null)
  if (!place) return { rows: [], parsed }
  const km = 15, dLat = km / 111, dLon = km / (111 * Math.cos(place.lat * Math.PI / 180))
  const { data: near, error: e2 } = await base()
    .gte('lat', place.lat - dLat).lte('lat', place.lat + dLat)
    .gte('lon', place.lon - dLon).lte('lon', place.lon + dLon)
  if (e2) throw e2
  return { rows: (near ?? []) as PubRow[], parsed, near: { ...place, km } }
}

export type Place = {
  key: string; region: string; lat: number; lon: number; fish: number; logs: number; zero: number
  species: [string, number][]; method: string | null; bait: string | null; last: string
  admin: number; sources: string[]   // 관리자 등록 건수, 출처 표시용 ('선사 제공 ○○호')
  brags: { url: string; nickname: string; caught_at: string }[]   // 사용자 자랑글 링크 (최근 순)
}

/** 지역(시군구+읍면동) 단위로 묶어 점수순 정렬 */
export function summarizePlaces(rows: PubRow[]): Place[] {
  const m = new Map<string, Place & { _sp: Map<string, number>; _me: Map<string, number>; _ba: Map<string, number> }>()
  const blank = (): string[] => []
  for (const r of rows) {
    const key = r.region ?? `${Number(r.lat).toFixed(2)},${Number(r.lon).toFixed(2)}`
    const p = m.get(key) ?? { key, region: r.region ?? '지역 미상', lat: Number(r.lat), lon: Number(r.lon), fish: 0, logs: 0, zero: 0, species: [], method: null, bait: null, last: r.caught_at, admin: 0, sources: blank(), brags: [] as Place['brags'], _sp: new Map(), _me: new Map(), _ba: new Map() }
    p.logs++
    if (r.share_url && r.entered_by !== 'admin' && p.brags.length < 3) p.brags.push({ url: r.share_url, nickname: r.nickname, caught_at: r.caught_at })
    if (r.entered_by === 'admin') {
      p.admin++
      const src = [sourceLabel(r.source_type), r.source_name].filter(Boolean).join(' ')
      if (!p.sources.includes(src)) p.sources.push(src)
    }
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

/** 두 좌표 사이 거리(km) */
export function distKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371, r = Math.PI / 180
  const x = Math.sin((b.lat - a.lat) * r / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin((b.lon - a.lon) * r / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(x))
}

/* 최근 검색어 (이 기기에만 저장). 예전 형식 {mode, q}도 읽음 */
const KEY = 'recent_searches'
export function getRecent(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]') as (string | { q: string })[]
    return [...new Set(raw.map(x => (typeof x === 'string' ? x : x.q)).filter(Boolean))]
  } catch { return [] }
}
export function pushRecent(q: string) {
  const v = q.trim()
  if (!v) return
  try { localStorage.setItem(KEY, JSON.stringify([v, ...getRecent().filter(x => x !== v)].slice(0, 8))) } catch { /* 저장 실패는 무시 */ }
}
export function clearRecent() { try { localStorage.removeItem(KEY) } catch { /* noop */ } }
