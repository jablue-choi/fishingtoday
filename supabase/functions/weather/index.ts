// supabase/functions/weather/index.ts
// 기상청 API허브 초단기실황(getUltraSrtNcst) 프록시.
// 브라우저에서 직접 부르면 CORS로 막히고 키도 노출되므로 엣지 함수에서 호출한다.
// 호출: POST { lat, lon }   응답: { weather, temp_c, wind_dir, wind_ms, nx, ny, base }
// 시크릿 (둘 중 하나만 있어도 됨, 공공데이터포털 우선):
//   supabase secrets set KMA_SERVICE_KEY=...   (공공데이터포털 apis.data.go.kr 일반 인증키)
//   supabase secrets set KMA_AUTH_KEY=...      (기상청 API허브 apihub.kma.go.kr 인증키)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const { lat, lon } = await req.json()
    if (typeof lat !== 'number' || typeof lon !== 'number') return json({ error: 'lat, lon required' }, 400)

    const { nx, ny } = toKmaGrid(lat, lon)

    // KST 기준. 실황은 매시 40분 이후 제공 → 그 전이면 한 시간 전 자료
    const kst = new Date(Date.now() + 9 * 3600 * 1000)
    if (kst.getUTCMinutes() < 40) kst.setUTCHours(kst.getUTCHours() - 1)
    const base_date = kst.toISOString().slice(0, 10).replace(/-/g, '')
    const base_time = String(kst.getUTCHours()).padStart(2, '0') + '00'

    const params: Record<string, string> = {
      pageNo: '1', numOfRows: '20', dataType: 'JSON',
      base_date, base_time, nx: String(nx), ny: String(ny),
    }
    const svcKey = Deno.env.get('KMA_SERVICE_KEY')
    const hubKey = Deno.env.get('KMA_AUTH_KEY')
    let url: URL
    if (svcKey) {
      url = new URL('https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst')
      url.search = new URLSearchParams({ ...params, serviceKey: svcKey }).toString()
    } else if (hubKey) {
      url = new URL('https://apihub.kma.go.kr/api/typ02/openApi/VilageFcstInfoService_2.0/getUltraSrtNcst')
      url.search = new URLSearchParams({ ...params, authKey: hubKey }).toString()
    } else {
      return json({ error: 'no_kma_key' }, 500)
    }

    const res = await fetch(url)
    const text = await res.text()
    let body: any
    try { body = JSON.parse(text) } catch { return json({ error: 'kma_non_json', detail: text.slice(0, 300) }, 502) }

    const items: { category: string; obsrValue: string }[] = body?.response?.body?.items?.item ?? []
    if (!items.length) return json({ error: 'kma_empty', detail: body?.response?.header }, 502)
    const get = (c: string) => items.find(i => i.category === c)?.obsrValue

    const pty = get('PTY') // 0없음 1비 2비/눈 3눈 5빗방울 6빗방울눈날림 7눈날림
    const weather = !pty || pty === '0' ? '맑음'
      : ['1', '5'].includes(pty) ? '비'
      : ['3', '7'].includes(pty) ? '눈' : '비/눈'
    const vec = get('VEC')

    return json({
      weather,
      temp_c: get('T1H') != null ? Number(get('T1H')) : null,
      wind_dir: vec != null ? degToDir(Number(vec)) : null,
      wind_ms: get('WSD') != null ? Number(get('WSD')) : null,
      nx, ny, base: `${base_date} ${base_time}`,
    })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

function degToDir(deg: number) {
  return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(deg / 45) % 8]
}

// 위경도 → 기상청 격자 (기상청 공식 변환식)
function toKmaGrid(lat: number, lon: number) {
  const RE = 6371.00877, GRID = 5.0, SLAT1 = 30.0, SLAT2 = 60.0, OLON = 126.0, OLAT = 38.0, XO = 43, YO = 136
  const D = Math.PI / 180.0, re = RE / GRID
  const s1 = SLAT1 * D, s2 = SLAT2 * D, olon = OLON * D, olat = OLAT * D
  let sn = Math.tan(Math.PI * 0.25 + s2 * 0.5) / Math.tan(Math.PI * 0.25 + s1 * 0.5)
  sn = Math.log(Math.cos(s1) / Math.cos(s2)) / Math.log(sn)
  let sf = Math.tan(Math.PI * 0.25 + s1 * 0.5); sf = (Math.pow(sf, sn) * Math.cos(s1)) / sn
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5); ro = (re * sf) / Math.pow(ro, sn)
  let ra = Math.tan(Math.PI * 0.25 + lat * D * 0.5); ra = (re * sf) / Math.pow(ra, sn)
  let th = lon * D - olon
  if (th > Math.PI) th -= 2 * Math.PI
  if (th < -Math.PI) th += 2 * Math.PI
  th *= sn
  return { nx: Math.floor(ra * Math.sin(th) + XO + 0.5), ny: Math.floor(ro - ra * Math.cos(th) + YO + 0.5) }
}
