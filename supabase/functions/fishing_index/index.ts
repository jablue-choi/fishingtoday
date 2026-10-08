// supabase/functions/fishing_index/index.ts
// 국립해양조사원 바다낚시지수(공공데이터포털) 프록시 + 3시간 캐시
// 호출: POST { gubun: '갯바위' | '선상' | '바다여행', lat?, lon?, limit? }
//   - 갯바위/선상: 바다낚시지수 (fcstFishingv2)
//   - 바다여행: 바다여행지수 (기본 fcstSeaTripv2, 다르면 SEA_TRIP_URL 시크릿으로 덮어쓰기)
//   - 선박운항: 선박운항지수 (기본 shipIndex, 다르면 SHIP_INDEX_URL 시크릿으로 덮어쓰기)
// 응답: { items: FishingIndex[], fetched_at, cached }
//
// 시크릿:
//   KMA_SERVICE_KEY       공공데이터포털 일반 인증키 (기상청과 같은 키, 바다낚시지수도 활용신청 필요)
//   FISHING_INDEX_URL     (선택) 요청주소. 포털 상세페이지의 '요청주소'와 다르면 이 값으로 덮어쓰기
//   FISHING_INDEX_GUBUN_PARAM (선택) 위치구분 파라미터 이름. 기본 'gubun'

import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const TTL_MS = 3 * 3600 * 1000
const DEFAULT_URL = 'https://apis.data.go.kr/1192136/fcstFishingv2/GetFcstFishingApiServicev2'
const DEFAULT_SEA_TRIP_URL = 'https://apis.data.go.kr/1192136/fcstSeaTripv2/GetFcstSeaTripApiServicev2'
const DEFAULT_SHIP_URL = 'https://apis.data.go.kr/1192136/shipIndex/GetShipIndexApiService'

// 선박운항지수(권역 AREA)는 응답에 좌표가 없어서, 가까운 권역을 고르기 위한 대략적인 해역 중심 좌표
// (활용가이드 코드표 AA_0001~AA_0007 기준, 위치는 근사값)
const SHIP_AREA_COORDS: Record<string, [number, number]> = {
  '황해중부': [37.0, 125.6], '황해남부': [35.3, 125.4], '제주해협': [33.9, 126.6],
  '대한해협': [34.7, 128.9], '제주남부': [32.9, 126.5], '동해남부': [35.9, 129.8], '동해중부': [37.7, 129.4],
}
const SCORE_RANK: Record<string, number> = { '매우좋음': 5, '좋음': 4, '보통': 3, '나쁨': 2, '매우나쁨': 1 }
const GUBUNS = ['갯바위', '선상', '바다여행', '선박운항']

export type FishingIndex = {
  name: string; date: string; time: string; fish: string | null; weather?: string | null
  score: string; points: number | null
  lat: number; lon: number
  wave: string | null; water_temp: string | null; air_temp: string | null
  wind: string | null; current: string | null; tide: string | null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const { gubun = '갯바위', lat, lon, limit = 10 } = await req.json().catch(() => ({}))
    if (!GUBUNS.includes(gubun)) return json({ error: `gubun must be one of ${GUBUNS.join(', ')}` }, 400)

    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: cache } = await db.from('fishing_index_cache').select('*').eq('gubun', gubun).maybeSingle()

    let items: FishingIndex[]
    let fetched_at: string
    let cached = false
    if (cache && Date.now() - new Date(cache.fetched_at).getTime() < TTL_MS) {
      items = cache.items; fetched_at = cache.fetched_at; cached = true
    } else {
      const fetched = await fetchIndex(gubun)
      if ('error' in fetched) {
        // 실패 시 오래된 캐시라도 반환
        if (cache) { items = cache.items; fetched_at = cache.fetched_at; cached = true }
        else return json(fetched, 502)
      } else {
        items = fetched.items; fetched_at = new Date().toISOString()
        await db.from('fishing_index_cache').upsert({ gubun, fetched_at, items })
      }
    }

    // 오늘 이후 것만, 위치가 오면 가까운 순
    const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)
    let out = items!.filter(i => i.date >= today)
    if (typeof lat === 'number' && typeof lon === 'number') {
      out = out.map(i => ({ ...i, dist_km: km(lat, lon, i.lat, i.lon) }))
        .sort((a: any, b: any) => a.dist_km - b.dist_km || a.date.localeCompare(b.date))
    } else {
      out = out.sort((a, b) => (b.points ?? rank(b.score)) - (a.points ?? rank(a.score)) || a.date.localeCompare(b.date))
    }
    return json({ items: out.slice(0, Math.min(200, limit)), fetched_at, cached })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})

async function fetchIndex(gubun: string): Promise<{ items: FishingIndex[] } | { error: string; detail?: unknown }> {
  const key = Deno.env.get('KMA_SERVICE_KEY')
  if (!key) return { error: 'no_service_key' }
  const trip = gubun === '바다여행' || gubun === '선박운항'   // 위치구분 파라미터 없는 API
  const base =
    gubun === '바다여행' ? (Deno.env.get('SEA_TRIP_URL') || DEFAULT_SEA_TRIP_URL)
    : gubun === '선박운항' ? (Deno.env.get('SHIP_INDEX_URL') || DEFAULT_SHIP_URL)
    : (Deno.env.get('FISHING_INDEX_URL') || DEFAULT_URL)
  const gp = Deno.env.get('FISHING_INDEX_GUBUN_PARAM') || 'gubun'
  const kst = new Date(Date.now() + 9 * 3600e3)
  const reqDate = kst.toISOString().slice(0, 10).replace(/-/g, '')

  const ship = gubun === '선박운항'
  const all: any[] = []
  for (let page = 1; page <= 5; page++) {
    const url = new URL(base)
    url.search = new URLSearchParams(ship
      // 선박운항지수: category 필수 (AREA 권역 / LINE 항로 / PORT 항만 / MARINA / YACHT), 날짜 파라미터 없음
      ? { serviceKey: key, type: 'json', category: 'AREA', pageNo: String(page), numOfRows: '300' }
      : { serviceKey: key, type: 'json', resultType: 'json', dataType: 'JSON',
          ...(trip ? {} : { [gp]: gubun }), reqDate, pageNo: String(page), numOfRows: '300' },
    ).toString()
    const res = await fetch(url)
    const text = await res.text()
    let body: any
    try { body = JSON.parse(text) } catch { return { error: 'non_json', detail: text.slice(0, 400) } }
    const rows = pickItems(body)
    if (!rows) return { error: 'unexpected_shape', detail: JSON.stringify(body).slice(0, 400) }
    all.push(...rows)
    const total = Number(body?.response?.body?.totalCount ?? body?.body?.totalCount ?? rows.length)
    if (all.length >= total || rows.length === 0) break
  }
  let items = all.map(normalize)
  if (ship) {
    // 좌표 채우기 + 같은 권역·날짜·시간대(새벽/오전/오후/저녁)에 여러 시각이 오면 가장 나쁜 지수 하나만 (안전 우선)
    const worst = new Map<string, FishingIndex>()
    for (const i of items) {
      const c = SHIP_AREA_COORDS[i.name]
      if (!c) continue
      i.lat = c[0]; i.lon = c[1]
      const k = `${i.name}|${i.date}|${i.time}`
      const prev = worst.get(k)
      if (!prev || (SCORE_RANK[i.score] ?? 9) < (SCORE_RANK[prev.score] ?? 9)) worst.set(k, i)
    }
    items = [...worst.values()]
  }
  return { items: items.filter(i => !isNaN(i.lat) && !isNaN(i.lon)) }
}

function pickItems(b: any): any[] | null {
  const i = b?.response?.body?.items?.item ?? b?.body?.items?.item ?? b?.items?.item ?? b?.result?.data ?? b?.data
  if (Array.isArray(i)) return i
  if (i && typeof i === 'object') return [i]
  return null
}

// 필드명이 문서와 다를 수 있어 여러 후보를 순서대로 확인
const pick = (o: any, ...ks: string[]) => { for (const k of ks) if (o?.[k] != null && o[k] !== '') return o[k]; return null }
// min~max 범위가 있으면 범위로, 없으면 평균값(avg*)이나 단일값으로
const range = (o: any, min: string, max: string, ...one: string[]) => {
  const a = pick(o, min), b = pick(o, max)
  if (a != null && b != null) return a === b ? String(a) : `${a}~${b}`
  const v = pick(o, ...one)
  return v != null ? String(v) : null
}
function normalize(o: any): FishingIndex {
  const d = String(pick(o, 'predcYmd', 'date', 'fcstDt') ?? '')
  return {
    name: String(pick(o, 'seafsPstnNm', 'seatrPstnNm', 'sareaDtlNm', 'vslNvgtBrnchCdNm', 'name', 'pstnNm', 'pointNm', 'spotNm') ?? firstNm(o) ?? ''),
    date: d.length === 8 ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : d.slice(0, 10),
    time: String(pick(o, 'predcNoonSeCd', 'time_type', 'timeType') ?? ''),
    fish: pick(o, 'seafsTgfshNm', 'fish_name', 'fishNm'),
    weather: pick(o, 'weather', 'wthrCn', 'wtrCn', 'skyCn'),
    score: String(pick(o, 'totalIndex', 'lastScrCn', 'total_score', 'idx') ?? ''),
    points: pick(o, 'lastScr', 'totalScore') != null ? Number(pick(o, 'lastScr', 'totalScore')) : null,
    lat: Number(pick(o, 'lat', 'latitude')),
    lon: Number(pick(o, 'lot', 'lon', 'longitude')),
    wave: range(o, 'minWvhgt', 'maxWvhgt', 'avgWvhgt', 'wave_height'),
    water_temp: range(o, 'minWtem', 'maxWtem', 'avgWtem', 'water_temp'),
    air_temp: range(o, 'minArtmp', 'maxArtmp', 'avgArtmp', 'air_temp'),
    wind: range(o, 'minWspd', 'maxWspd', 'avgWspd', 'wind_speed'),
    current: range(o, 'minCrsp', 'maxCrsp', 'avgCrsp', 'current_speed'),
    tide: pick(o, 'tdlvHrCn', 'tdlvHrScr', 'tide_time_score'),
  }
}

function firstNm(o: any): string | null {
  for (const [k, v] of Object.entries(o ?? {})) if (/Nm$/.test(k) && typeof v === 'string' && v && !/fish|Tgfsh|Se/.test(k)) return v
  return null
}
const rank = (s: string) => ({ '매우좋음': 5, '좋음': 4, '보통': 3, '나쁨': 2, '매우나쁨': 1 } as Record<string, number>)[s] ?? 0
function km(a: number, b: number, c: number, d: number) {
  const R = 6371, r = Math.PI / 180
  const x = Math.sin((c - a) * r / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin((d - b) * r / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(x))
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}
