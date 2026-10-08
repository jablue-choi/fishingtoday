// supabase/functions/tide/index.ts
// 국립해양조사원 조석예보(고·저조) (공공데이터포털 1192136/tideFcstHghLw) 프록시 + 지점·날짜별 캐시
// 호출: POST { lat, lon, date?: 'YYYY-MM-DD' (기본 오늘 KST), days?: 1~3 }
// 응답: { station: { code, name, lat, lon, dist_km }, extremes: [{ time: ISO(+09:00), type: 'high'|'low', h_cm }], fetched_at, cached }
//   extremes는 곡선을 0시부터 그릴 수 있게 전날 것도 포함
//
// 시크릿:
//   KMA_SERVICE_KEY  공공데이터포털 일반 인증키 (조석예보(고, 저조)도 활용신청 필요)
//   TIDE_URL         (선택) 요청주소. 포털 상세페이지의 '요청주소'와 다르면 이 값으로 덮어쓰기
//
// API: GetTideFcstHghLwApiService?obsCode=DT_0001&reqDate=YYYYMMDD&type=json (obsCode 필수)
//   item: { obsvtrNm, lat, lot, predcDt: 'YYYY-MM-DD HH:mm', predcTdlvVl(cm), extrSe(그날 순번) }

import { createClient } from 'npm:@supabase/supabase-js@2'
import { STATIONS } from './stations.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const DEFAULT_URL = 'https://apis.data.go.kr/1192136/tideFcstHghLw/GetTideFcstHghLwApiService'
const TTL_MS = 24 * 3600e3   // 조석예보는 날짜별로 고정값

type Raw = { time: string; h_cm: number }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const { lat, lon, date, days = 1 } = await req.json().catch(() => ({}))
    if (typeof lat !== 'number' || typeof lon !== 'number') return json({ error: 'lat, lon required' }, 400)
    const start = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)

    // 가장 가까운 지점
    let best = STATIONS[0], bestKm = Infinity
    for (const s of STATIONS) { const d = km(lat, lon, s[2], s[3]); if (d < bestKm) { best = s; bestKm = d } }
    const [code, name, sLat, sLon] = best

    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const dates = Array.from({ length: Math.min(3, Math.max(1, days)) + 1 }, (_, i) => addDays(start, i - 1))
    const raw: Raw[] = []
    let fetched_at = '', cached = true
    for (const d of dates) {
      const r = await rowsFor(db, code, d)
      if ('error' in r) { if (d === start) return json(r, 502); continue }
      raw.push(...r.rows); fetched_at = r.fetched_at; cached &&= r.cached
    }
    raw.sort((a, b) => a.time.localeCompare(b.time))

    return json({
      station: { code, name, lat: sLat, lon: sLon, dist_km: Math.round(bestKm * 10) / 10 },
      extremes: classify(raw),
      fetched_at, cached,
    })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})

/** extrSe는 그날 순번이라 고·저 구분이 아님 → 앞뒤 값과 비교해 만조·간조 판정 */
function classify(raw: Raw[]) {
  return raw.map((r, i) => {
    const nb = [raw[i - 1], raw[i + 1]].filter(Boolean).map(x => x.h_cm)
    const avg = nb.length ? nb.reduce((a, b) => a + b, 0) / nb.length : r.h_cm
    return { time: r.time, type: r.h_cm >= avg ? 'high' as const : 'low' as const, h_cm: r.h_cm }
  })
}

async function rowsFor(db: any, code: string, date: string): Promise<{ rows: Raw[]; fetched_at: string; cached: boolean } | { error: string; detail?: unknown }> {
  const key = `조석:${code}:${date}`
  const { data: cache } = await db.from('fishing_index_cache').select('*').eq('gubun', key).maybeSingle()
  if (cache && Date.now() - new Date(cache.fetched_at).getTime() < TTL_MS) return { rows: cache.items, fetched_at: cache.fetched_at, cached: true }
  const got = await fetchRows(code, date)
  if ('error' in got) return cache ? { rows: cache.items, fetched_at: cache.fetched_at, cached: true } : got
  const fetched_at = new Date().toISOString()
  if (got.rows.length) await db.from('fishing_index_cache').upsert({ gubun: key, fetched_at, items: got.rows })
  return { rows: got.rows, fetched_at, cached: false }
}

async function fetchRows(code: string, date: string): Promise<{ rows: Raw[] } | { error: string; detail?: unknown }> {
  const serviceKey = Deno.env.get('KMA_SERVICE_KEY')
  if (!serviceKey) return { error: 'no_service_key' }
  const url = new URL(Deno.env.get('TIDE_URL') || DEFAULT_URL)
  url.search = new URLSearchParams({ serviceKey, type: 'json', obsCode: code, reqDate: date.replace(/-/g, ''), pageNo: '1', numOfRows: '20' }).toString()
  const res = await fetch(url)
  const text = await res.text()
  let body: any
  try { body = JSON.parse(text) } catch { return { error: `non_json_${res.status}`, detail: text.slice(0, 400) } }
  const rc = body?.header?.resultCode ?? body?.response?.header?.resultCode
  if (rc && rc !== '00') return { error: 'api_error', detail: body?.header ?? body?.response?.header }
  let items = body?.body?.items?.item ?? body?.response?.body?.items?.item ?? []
  if (!Array.isArray(items)) items = [items]
  const rows: Raw[] = []
  for (const o of items) {
    const m = String(o?.predcDt ?? '').match(/^(\d{4})-?(\d{2})-?(\d{2})\s*(\d{2}):?(\d{2})/)
    const h = Number(o?.predcTdlvVl)
    if (m && !isNaN(h)) rows.push({ time: `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00+09:00`, h_cm: h })
  }
  return { rows }
}

function addDays(ymd: string, n: number) {
  const d = new Date(`${ymd}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
function km(a: number, b: number, c: number, d: number) {
  const R = 6371, r = Math.PI / 180
  const x = Math.sin((c - a) * r / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin((d - b) * r / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(x))
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}
