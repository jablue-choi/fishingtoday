// 공공데이터 '전국공중화장실표준데이터' CSV → Supabase toilets
//
// 사용법:
//   npm run import:toilets -- data/공중화장실정보.csv [--dry] [--only 부산,강원,전남] [--limit 500]
//   --only  : 주소가 이 시도명으로 시작하는 것만 (해안 지역 먼저 넣을 때)
//   --limit : 이번 실행에서 처리할 최대 건수
//
// 좌표: CSV에 위도·경도 열이 있으면 그대로, 없으면(현재 표준데이터) 카카오 로컬 API로 주소 → 좌표 변환
//   - supabase/.env 에 KAKAO_REST_KEY (카카오 앱의 'REST API 키', JavaScript 키와 다름)
//   - 변환 결과는 data/.toilet-geocode-cache.json 에 저장 → 다시 실행하면 이어서 (이미 한 주소는 다시 안 물어봄)
//   - 1000건마다 DB에 올림 (진행 중에도 앱에서 보이기 시작)
// 필요: supabase/.env 에 SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// 인코딩: UTF-8 / EUC-KR(CP949) 자동 판별

import fs from 'node:fs'
import path from 'node:path'
import iconv from 'iconv-lite'
import { parse } from 'csv-parse/sync'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: 'supabase/.env' })

const args = process.argv.slice(2)
const file = args.find(a => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--only' && args[args.indexOf(a) - 1] !== '--limit')
const DRY = args.includes('--dry')
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined }
const ONLY = (opt('--only') ?? '').split(',').map(s => s.trim()).filter(Boolean)
const LIMIT = Number(opt('--limit') ?? Infinity)
if (!file) { console.log('사용법: node scripts/import-toilets.mjs <파일.csv> [--dry] [--only 부산,강원] [--limit 500]'); process.exit(1) }

// ── CSV 읽기 ────────────────────────────────────────────
const buf = fs.readFileSync(file)
let text = buf.toString('utf8')
if (text.includes('�')) text = iconv.decode(buf, 'cp949')
text = text.replace(/^﻿/, '')
const rows = parse(text, { columns: true, skip_empty_lines: true, relax_column_count: true, trim: true })
const cols = Object.keys(rows[0] ?? {})
console.log(`${path.basename(file)}: ${rows.length}행`)

const col = (...kws) => cols.find(c => kws.some(k => c.replace(/\s/g, '').includes(k)))
const C = {
  name: col('화장실명'),
  road: col('소재지도로명주소', '도로명주소'),
  jibun: col('소재지지번주소', '지번주소'),
  lat: col('WGS84위도', '위도'),
  lon: col('WGS84경도', '경도'),
  open: col('개방시간상세', '개방시간'),
  phone: col('전화번호'),
  id: col('관리번호'),
  kind: col('구분명', '구분'),
  bell: col('비상벨설치여부'),
  diaper: col('기저귀교환대유무'),
}
if (!C.name) { console.error(`화장실명 컬럼을 못 찾았어요. 컬럼: ${cols.join(', ')}`); process.exit(1) }
const hasCoord = !!(C.lat && C.lon)
console.log('좌표:', hasCoord ? 'CSV 위도·경도 사용' : '없음 → 카카오 주소 변환')

const inKorea = (lat, lon) => lat > 32 && lat < 39.5 && lon > 124 && lon < 132.5
const addrOf = (r) => ((C.road && r[C.road]) || (C.jibun && r[C.jibun]) || '').trim()

// 대상 행 고르기 (--only, 중복 관리번호 제거)
const seen = new Set()
let targets = []
for (const r of rows) {
  const addr = addrOf(r)
  if (ONLY.length && !ONLY.some(s => addr.startsWith(s))) continue
  const ext = (C.id && r[C.id]) || `${r[C.name]}|${addr}`
  if (seen.has(ext)) continue
  seen.add(ext)
  targets.push({ r, ext, addr })
}
if (Number.isFinite(LIMIT)) targets = targets.slice(0, LIMIT)
console.log(`대상 ${targets.length}건${ONLY.length ? ` (지역: ${ONLY.join(', ')})` : ''}`)

// ── 주소 → 좌표 (카카오 로컬) ───────────────────────────
const CACHE = path.join(path.dirname(file), '.toilet-geocode-cache.json')
const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {}
const saveCache = () => fs.writeFileSync(CACHE, JSON.stringify(cache))
const KEY = process.env.KAKAO_REST_KEY

async function geocode(q) {
  if (!q) return null
  if (q in cache) return cache[q]
  const res = await fetch(`https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(q)}&size=1`, { headers: { Authorization: `KakaoAK ${KEY}` } })
  if (res.status === 401 || res.status === 403) throw new Error(`카카오 REST 키 확인이 필요해요 (HTTP ${res.status})`)
  if (res.status === 429) { await new Promise(r => setTimeout(r, 2000)); return geocode(q) }
  if (!res.ok) return null
  const d = (await res.json()).documents?.[0]
  const v = d ? [Number(d.y), Number(d.x)] : null
  cache[q] = v
  return v
}

async function coordOf(t) {
  if (hasCoord) {
    const lat = Number(t.r[C.lat]), lon = Number(t.r[C.lon])
    return inKorea(lat, lon) ? [lat, lon] : null
  }
  const road = C.road && t.r[C.road]
  const jibun = C.jibun && t.r[C.jibun]
  return (await geocode(road)) ?? (await geocode(jibun))
}

const toRow = (t, [lat, lon]) => ({
  source: 'mois_toilet',
  external_id: t.ext,
  name: t.r[C.name] || '공중화장실',
  address: t.addr || null,
  open_time: (C.open && t.r[C.open]) || null,
  phone: (C.phone && t.r[C.phone]) || null,
  geom: `SRID=4326;POINT(${lon.toFixed(6)} ${lat.toFixed(6)})`,
  info: { kind: (C.kind && t.r[C.kind]) || null, bell: (C.bell && t.r[C.bell]) || null, diaper: (C.diaper && t.r[C.diaper]) || null },
})

if (DRY) {
  if (!hasCoord && !KEY) { console.log('※ 실제 적재엔 supabase/.env 에 KAKAO_REST_KEY 가 필요해요. 미리보기는 주소만 보여 줘요.'); console.log(targets.slice(0, 3).map(t => ({ name: t.r[C.name], addr: t.addr }))); process.exit(0) }
  const sample = []
  for (const t of targets.slice(0, 3)) { const c = await coordOf(t); sample.push(c ? toRow(t, c) : { name: t.r[C.name], addr: t.addr, coord: '변환 실패' }) }
  saveCache()
  console.log(sample)
  process.exit(0)
}

// ── 변환하면서 1000건씩 업로드 ──────────────────────────
const url = process.env.SUPABASE_URL, skey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !skey) { console.error('supabase/.env 에 SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 가 필요해요'); process.exit(1) }
if (!hasCoord && !KEY) { console.error('CSV에 좌표가 없어요. supabase/.env 에 KAKAO_REST_KEY(카카오 REST API 키)를 넣어 주세요.'); process.exit(1) }
const db = createClient(url, skey)

let batch = [], done = 0, failed = 0, uploaded = 0
const started = Date.now()
async function flush() {
  if (!batch.length) return
  const { error } = await db.from('toilets').upsert(batch, { onConflict: 'source,external_id' })
  if (error) { console.error('\n업로드 실패:', error.message); saveCache(); process.exit(1) }
  uploaded += batch.length; batch = []; saveCache()
}

const CONC = hasCoord ? 50 : 8   // 카카오 호출은 동시 8개
for (let i = 0; i < targets.length; i += CONC) {
  const part = targets.slice(i, i + CONC)
  const coords = await Promise.all(part.map(t => coordOf(t).catch(e => { if (/REST 키/.test(e.message)) { console.error('\n' + e.message); saveCache(); process.exit(1) } return null })))
  part.forEach((t, j) => { if (coords[j]) batch.push(toRow(t, coords[j])); else failed++ })
  done += part.length
  if (batch.length >= 1000) await flush()
  const sec = (Date.now() - started) / 1000
  const eta = done ? Math.round((targets.length - done) * sec / done / 60) : 0
  process.stdout.write(`\r처리 ${done}/${targets.length} · 올림 ${uploaded + batch.length} · 주소 못 찾음 ${failed} · 남은 시간 약 ${eta}분   `)
}
await flush()
console.log(`\n완료: ${uploaded}건 저장, 주소로 좌표를 못 찾은 ${failed}건 건너뜀`)
