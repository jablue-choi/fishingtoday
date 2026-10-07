import { toKmaGrid } from './geo'

export type AutoFill = {
  weather: string
  temp_c: number | null
  wind_dir: string | null
  wind_ms: number | null
}

/**
 * 기상청 초단기실황 (getUltraSrtNcst).
 * 공공데이터포털에서 "기상청_단기예보 ((구)_동네예보) 조회서비스" 활용신청 후 키 사용.
 * TODO: 물때(바다누리)는 lib/tide.ts 로 분리 예정.
 */
export async function fetchKmaNow(lat: number, lon: number): Promise<AutoFill> {
  const { nx, ny } = toKmaGrid(lat, lon)
  const now = new Date()
  // 실황은 매시 40분 이후 제공 → 그 전이면 한 시간 전 자료
  if (now.getMinutes() < 40) now.setHours(now.getHours() - 1)
  const base_date = now.toISOString().slice(0, 10).replace(/-/g, '')
  const base_time = String(now.getHours()).padStart(2, '0') + '00'

  const url = new URL('https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst')
  url.search = new URLSearchParams({
    serviceKey: import.meta.env.VITE_KMA_SERVICE_KEY,
    dataType: 'JSON', numOfRows: '20', pageNo: '1',
    base_date, base_time, nx: String(nx), ny: String(ny),
  }).toString()

  const res = await fetch(url)
  const json = await res.json()
  const items: { category: string; obsrValue: string }[] =
    json?.response?.body?.items?.item ?? []
  const get = (c: string) => items.find(i => i.category === c)?.obsrValue

  const pty = get('PTY') // 강수형태 0없음 1비 2비/눈 3눈 5빗방울 6빗방울눈날림 7눈날림
  const weather = pty && pty !== '0' ? (['1','5'].includes(pty) ? '비' : ['3','7'].includes(pty) ? '눈' : '비/눈') : '맑음'
  const vec = get('VEC') ? Number(get('VEC')) : null
  return {
    weather,
    temp_c: get('T1H') ? Number(get('T1H')) : null,
    wind_dir: vec === null ? null : degToDir(vec),
    wind_ms: get('WSD') ? Number(get('WSD')) : null,
  }
}

function degToDir(deg: number) {
  const dirs = ['N','NE','E','SE','S','SW','W','NW']
  return dirs[Math.round(deg / 45) % 8]
}
