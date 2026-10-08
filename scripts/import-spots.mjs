// 공공데이터 낚시 포인트 CSV → Supabase spots 테이블
//
// 사용법:
//   node scripts/import-spots.mjs rock   data/갯바위낚시포인트.csv
//   node scripts/import-spots.mjs boat   data/선상낚시포인트.csv
//   node scripts/import-spots.mjs ground data/전국낚시터정보표준데이터.csv
//   (--dry 를 붙이면 DB에 쓰지 않고 변환 결과만 출력)
//
// 필요: supabase/.env 에 SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// 인코딩: UTF-8 / EUC-KR(CP949) 자동 판별

import fs from 'node:fs'
import path from 'node:path'
import iconv from 'iconv-lite'
import { parse } from 'csv-parse/sync'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import proj4 from 'proj4'

// 해수부 포인트 CSV의 '공간정보' 컬럼: POINT (x y), EPSG:5179(UTM-K, GRS80)
proj4.defs('EPSG:5179', '+proj=tmerc +lat_0=38 +lon_0=127.5 +k=0.9996 +x_0=1000000 +y_0=2000000 +ellps=GRS80 +units=m +no_defs')

dotenv.config({ path: 'supabase/.env' })

const [, , kind, file, ...flags] = process.argv
const DRY = flags.includes('--dry')
const SOURCES = { rock: 'mof_rock', boat: 'mof_boat', ground: 'mois_ground' }
if (!SOURCES[kind] || !file) {
  console.log('사용법: node scripts/import-spots.mjs <rock|boat|ground> <파일.csv> [--dry]')
  process.exit(1)
}

// ── 파일 읽기 (인코딩 자동) ─────────────────────────────
const buf = fs.readFileSync(file)
let text = buf.toString('utf8')
if (text.includes('\uFFFD')) text = iconv.decode(buf, 'cp949')
text = text.replace(/^\uFEFF/, '')
const rows = parse(text, { columns: true, skip_empty_lines: true, relax_column_count: true, trim: true })
console.log(`${path.basename(file)}: ${rows.length}행, 컬럼 = ${Object.keys(rows[0] ?? {}).join(', ')}`)

// ── 컬럼 찾기: 이름에 키워드가 들어간 첫 컬럼 ───────────
const cols = Object.keys(rows[0] ?? {})
const col = (...kws) => cols.find(c => kws.some(k => c.replace(/\s/g, '').includes(k)))
const C = {
  name: col('포인트명', '낚시터명'),
  area: col('포인트지역명'),
  region: col('행정구역명', '소재지도로명주소', '소재지지번주소'),
  lat: col('위도'),
  lon: col('경도'),
  species: col('주요어종', '어종'),
  bottom: col('주원료'),          // 해수부 CSV의 '주원료내용'은 어종이 아니라 저질(모래/바위)
  geomText: cols.find(c => c.replace(/\s/g, '') === '공간정보'),   // '공간정보일련번호'와 구분
  type: col('낚시터유형'),
  depth: col('수심'),
  tide: col('물때'),
  method: col('낚시방법'),
  fee: col('이용요금'),
  phone: col('전화번호'),
  facility: col('주요시설', '시설'),
  id: col('공간정보일련번호', '관리번호', '일련번호'),
}
for (const k of ['name', 'lat', 'lon']) if (!C[k]) { console.error(`필수 컬럼(${k})을 못 찾았어요. 컬럼명을 확인해 주세요.`); process.exit(1) }
console.log('컬럼 매칭:', Object.fromEntries(Object.entries(C).filter(([, v]) => v)))

// ── 좌표: 십진수 / 도분초 둘 다 처리 ───────────────────
function coord(v) {
  if (v == null || v === '') return NaN
  const s = String(v).trim()
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s)
  const n = s.match(/\d+(\.\d+)?/g)?.map(Number) ?? []
  if (n.length >= 2) return n[0] + (n[1] ?? 0) / 60 + (n[2] ?? 0) / 3600
  return NaN
}
const inKorea = (lat, lon) => lat > 32 && lat < 39.5 && lon > 124 && lon < 132.5

/** 위경도 컬럼이 비었으면 '공간정보' POINT(EPSG:5179)에서 변환 */
function latLon(r) {
  const lat = coord(r[C.lat]), lon = coord(r[C.lon])
  if (inKorea(lat, lon)) return [lat, lon]
  const m = C.geomText && String(r[C.geomText] ?? '').match(/POINT\s*\(\s*([\d.]+)\s+([\d.]+)\s*\)/i)
  if (!m) return [NaN, NaN]
  const [x, y] = proj4('EPSG:5179', 'EPSG:4326', [Number(m[1]), Number(m[2])])
  return [y, x]
}

/** '▶감성돔-장대/ 릴찌▶볼락-루어' → '감성돔, 볼락' */
const speciesFromMethod = (s) => s && s.includes('▶')
  ? [...new Set(s.split('▶').map(x => x.split('-')[0].trim()).filter(Boolean))].join(', ') || null
  : null

/** '소바위' + '울산소바위' → '울산소바위' (지역명이 포인트명에 들어 있으면 하나만) */
function spotName(area, name) {
  if (!area) return name
  if (!name) return area
  return name.includes(area) || area.includes(name) ? (name.length >= area.length ? name : area) : `${area} ${name}`
}

function spotType(r) {
  if (kind === 'rock') return 'rock'
  if (kind === 'boat') return 'boat'
  const t = (C.type && r[C.type]) || ''
  if (/바다|해상|좌대/.test(t)) return 'beach'
  if (/하천|강/.test(t)) return 'river'
  return 'reservoir'
}

const out = []
let skipped = 0
for (const r of rows) {
  const [lat, lon] = latLon(r)
  if (!inKorea(lat, lon)) { skipped++; continue }
  const name = spotName(C.area && kind !== 'ground' ? r[C.area] : null, r[C.name])
  const info = {}
  for (const k of ['depth', 'tide', 'method', 'fee', 'phone', 'facility', 'type', 'bottom']) if (C[k] && r[C[k]]) info[k] = r[C[k]]
  out.push({
    name: name || '이름 없음',
    geom: `SRID=4326;POINT(${lon.toFixed(6)} ${lat.toFixed(6)})`,
    spot_type: spotType(r),
    source: SOURCES[kind],
    external_id: (C.id && r[C.id]) || `${name}|${lat.toFixed(5)},${lon.toFixed(5)}`,
    region: (C.region && r[C.region]) || null,
    species_text: (C.species && r[C.species]) || speciesFromMethod(C.method && r[C.method]),
    info,
  })
}
console.log(`변환 ${out.length}건, 좌표 없음/범위 밖 건너뜀 ${skipped}건`)
if (DRY) { console.log(out.slice(0, 3)); process.exit(0) }

// ── 업로드 ──────────────────────────────────────────────
const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.error('supabase/.env 에 SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 가 필요해요'); process.exit(1) }
const db = createClient(url, key)
let done = 0
for (let i = 0; i < out.length; i += 500) {
  const chunk = out.slice(i, i + 500)
  const { error } = await db.from('spots').upsert(chunk, { onConflict: 'source,external_id' })
  if (error) { console.error('업로드 실패:', error.message); process.exit(1) }
  done += chunk.length
  process.stdout.write(`\r업로드 ${done}/${out.length}`)
}
console.log('\n완료')
