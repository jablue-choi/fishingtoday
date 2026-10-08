import type { AutoFill } from './weather'

/*
 * 지난 날짜·시각의 날씨 (기온·풍속·풍향·날씨). 지난 조과 기록용.
 * Open-Meteo (키 없음, CC BY 4.0 — 화면에 출처 표기). 최근 90일은 forecast API, 그 이전은 archive API.
 * ※ 무료 API는 비상업 용도 조건. 서비스 상용화 전 기상청 ASOS(지상관측 시간자료)로 바꾸거나 유료 플랜 필요.
 */
export const PAST_WEATHER_SOURCE = 'Open-Meteo'

const WMO: [number, string][] = [
  [0, '맑음'], [1, '구름 조금'], [2, '구름많음'], [3, '흐림'], [48, '안개'], [57, '이슬비'],
  [67, '비'], [77, '눈'], [82, '소나기'], [86, '눈 소나기'], [99, '뇌우'],
]
const label = (code: number) => WMO.find(([max]) => code <= max)?.[1] ?? '-'
const dir8 = (deg: number) => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(deg / 45) % 8]

/** when: 조과 시각. 그 시각에 가장 가까운 정시 값 */
export async function fetchPastWeather(lat: number, lon: number, when: Date): Promise<AutoFill> {
  const kst = new Date(when.getTime() + 9 * 3600e3)
  const day = kst.toISOString().slice(0, 10)
  const hour = kst.getUTCHours() + (kst.getUTCMinutes() >= 30 ? 1 : 0)
  const recent = Date.now() - when.getTime() < 90 * 864e5
  const base = recent ? 'https://api.open-meteo.com/v1/forecast' : 'https://archive-api.open-meteo.com/v1/archive'
  const url = `${base}?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&start_date=${day}&end_date=${day}` +
    '&hourly=temperature_2m,wind_speed_10m,wind_direction_10m,weather_code&wind_speed_unit=ms&timezone=Asia%2FSeoul'
  const res = await fetch(url)
  if (!res.ok) throw new Error('지난 날씨를 불러오지 못했어요')
  const j = await res.json()
  const i = Math.min(hour, (j.hourly?.time?.length ?? 1) - 1)
  const t = j.hourly?.temperature_2m?.[i], w = j.hourly?.wind_speed_10m?.[i], d = j.hourly?.wind_direction_10m?.[i], c = j.hourly?.weather_code?.[i]
  if (t == null && w == null) throw new Error('그 시각의 날씨 자료가 없어요')
  return {
    weather: c != null ? label(c) : '-',
    temp_c: t != null ? Math.round(t * 10) / 10 : null,
    wind_ms: w != null ? Math.round(w * 10) / 10 : null,
    wind_dir: d != null ? dir8(d) : null,
  }
}
