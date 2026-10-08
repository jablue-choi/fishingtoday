// 국립해양조사원 낚시금지구역 Shapefile → Supabase fishing_ban_zones
//
// 사용법:
//   npm run import:ban-zones -- <압축 푼 폴더 또는 .shp 경로> [--dry]
//   예) npm run import:ban-zones -- data/낚시금지구역/TL_RESARE_ENS.shp --dry
//
// 필요: supabase/.env 에 SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// 좌표계: .prj 기준 EPSG:5179(UTM-K) → WGS84, 속성(.dbf)은 .cpg 인코딩(EUC-KR)

import fs from 'node:fs'
import path from 'node:path'
import iconv from 'iconv-lite'
import dotenv from 'dotenv'
import proj4 from 'proj4'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: 'supabase/.env' })
proj4.defs('EPSG:5179', '+proj=tmerc +lat_0=38 +lon_0=127.5 +k=0.9996 +x_0=1000000 +y_0=2000000 +ellps=GRS80 +units=m +no_defs')

const [, , target, ...flags] = process.argv
const DRY = flags.includes('--dry')
if (!target) { console.log('사용법: node scripts/import-ban-zones.mjs <폴더|파일.shp> [--dry]'); process.exit(1) }

let shp = target
if (fs.statSync(target).isDirectory()) {
  const found = fs.readdirSync(target, { recursive: true }).find(f => String(f).toLowerCase().endsWith('.shp'))
  if (!found) { console.error('.shp 파일을 못 찾았어요'); process.exit(1) }
  shp = path.join(target, String(found))
}
const base = shp.replace(/\.shp$/i, '')

// ── .prj 확인 ──────────────────────────────────────────
const prj = fs.existsSync(`${base}.prj`) ? fs.readFileSync(`${base}.prj`, 'utf8') : ''
if (!/Unified_Coordinate_System|False_Easting",1000000/.test(prj)) {
  console.error('좌표계가 EPSG:5179(Korea 2000 Unified)가 아니에요. .prj를 확인해 주세요.'); process.exit(1)
}

// ── .dbf 속성 ──────────────────────────────────────────
const cpg = fs.existsSync(`${base}.cpg`) ? fs.readFileSync(`${base}.cpg`, 'utf8').trim() : 'EUC-KR'
const enc = /949|euc/i.test(cpg) ? 'cp949' : 'utf8'
const dbf = fs.readFileSync(`${base}.dbf`)
const nRec = dbf.readUInt32LE(4), headLen = dbf.readUInt16LE(8), recLen = dbf.readUInt16LE(10)
const fields = []
for (let o = 32; dbf[o] !== 0x0d; o += 32) fields.push({ name: dbf.toString('latin1', o, o + 11).replace(/\0.*/, ''), len: dbf[o + 16] })
const attrs = []
for (let i = 0; i < nRec; i++) {
  let o = headLen + i * recLen + 1
  const r = {}
  for (const f of fields) { r[f.name] = iconv.decode(dbf.subarray(o, o + f.len), enc).trim(); o += f.len }
  attrs.push(r)
}

// ── .shp 폴리곤 → 링 목록 (WGS84) ─────────────────────
const buf = fs.readFileSync(shp)
const shapeType = buf.readInt32LE(32)
if (shapeType !== 5) { console.error(`폴리곤(5)만 지원해요. shapeType=${shapeType}`); process.exit(1) }
const shapes = []
for (let o = 100; o < buf.length;) {
  const len = buf.readInt32BE(o + 4) * 2
  const c = o + 8
  if (buf.readInt32LE(c) === 5) {
    const nParts = buf.readInt32LE(c + 36), nPts = buf.readInt32LE(c + 40)
    const parts = Array.from({ length: nParts }, (_, k) => buf.readInt32LE(c + 44 + k * 4))
    const p0 = c + 44 + nParts * 4
    const rings = parts.map((start, k) => {
      const end = k + 1 < nParts ? parts[k + 1] : nPts
      const ring = []
      for (let j = start; j < end; j++) {
        const [lon, lat] = proj4('EPSG:5179', 'EPSG:4326', [buf.readDoubleLE(p0 + j * 16), buf.readDoubleLE(p0 + j * 16 + 8)])
        ring.push(`${lon.toFixed(7)} ${lat.toFixed(7)}`)
      }
      return ring
    })
    shapes.push(rings)
  } else shapes.push(null)
  o += 8 + len
}

const ymd = s => (/^\d{8}$/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : null)
const out = shapes.map((rings, i) => {
  const a = attrs[i] ?? {}
  if (!rings || rings.every(r => r.length < 4)) return null
  return {
    p_source: 'khoa_enc',
    p_external_id: a.obj_sn || a.gid || String(i),
    p_name: a.korn_nm || a.eng_nm || '',
    p_rings_wkt: `MULTILINESTRING(${rings.filter(r => r.length >= 4).map(r => `(${r.join(',')})`).join(',')})`,
    p_info: { enc_no: a.enc_no || null, lmt_rgn_cd: a.lmt_rgn_cd || null, lmt_artcl: a.lmt_artcl_ || null, eng_nm: a.eng_nm || null, note: a.korn_etc_i || a.eng_etc_in || null },
    p_published_on: ymd(a.fbctn_ymd),
  }
}).filter(Boolean)

console.log(`${path.basename(shp)}: 도형 ${shapes.length}개, 속성 ${attrs.length}건 → 적재 대상 ${out.length}건`)
if (DRY) {
  for (const z of out.slice(0, 3)) console.log({ ...z, p_rings_wkt: z.p_rings_wkt.slice(0, 120) + '…' })
  process.exit(0)
}

// ── 업로드 ──────────────────────────────────────────────
const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.error('supabase/.env 에 SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 가 필요해요'); process.exit(1) }
const db = createClient(url, key)
let ok = 0, skipped = 0
for (const z of out) {
  const { data, error } = await db.rpc('import_ban_zone', z)
  if (error) { console.error(`\n${z.p_external_id} 실패:`, error.message); process.exit(1) }
  data ? ok++ : skipped++
  process.stdout.write(`\r적재 ${ok + skipped}/${out.length}`)
}
console.log(`\n완료: ${ok}건 저장, 면적 없는 도형 ${skipped}건 건너뜀`)
