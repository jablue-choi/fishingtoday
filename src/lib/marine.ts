/*
 * 홈 해양 대시보드용 예측값: 시간별 기온·날씨·바람·기압 + 파고·수온·해수면(물때 곡선)
 * 출처 Open-Meteo (Forecast·Marine API, 키 없음, CC BY 4.0). 화면에 '예측 모델 참고값'으로 표기.
 * ※ 무료 API는 비상업 조건. 상용화 전 국립해양조사원 조석예보·기상청 단기예보로 교체 필요.
 * ※ 해수면은 모델 값이라 실제 조석표(바다누리)와 시각·높이가 다를 수 있음.
 */
export const MARINE_SOURCE = 'Open-Meteo 예측 모델'

export type Hour = {
  time: Date; temp: number | null; code: number | null; wind: number | null; windDir: number | null
  pressure: number | null; wave: number | null; sst: number | null; sea: number | null
}
export type Extreme = { time: Date; type: 'high' | 'low'; h: number }
export type MarineDash = { hours: Hour[]; extremes: Extreme[]; fetchedAt: Date }

const cache = new Map<string, { at: number; data: MarineDash }>()

export async function fetchMarineDash(lat: number, lon: number): Promise<MarineDash> {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < 30 * 60e3) return hit.data

  const q = `latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&timezone=Asia%2FSeoul&forecast_days=2`
  const [fRes, mRes] = await Promise.all([
    fetch(`https://api.open-meteo.com/v1/forecast?${q}&hourly=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure&wind_speed_unit=ms`),
    fetch(`https://marine-api.open-meteo.com/v1/marine?${q}&hourly=wave_height,sea_surface_temperature,sea_level_height_msl`).catch(() => null),
  ])
  if (!fRes.ok) throw new Error('예보를 불러오지 못했어요')
  const f = await fRes.json()
  const m = mRes && mRes.ok ? await mRes.json() : null   // 내륙이면 해양 값 없음

  const n = f.hourly?.time?.length ?? 0
  const hours: Hour[] = Array.from({ length: n }, (_, i) => ({
    time: new Date(`${f.hourly.time[i]}:00+09:00`),
    temp: f.hourly.temperature_2m?.[i] ?? null,
    code: f.hourly.weather_code?.[i] ?? null,
    wind: f.hourly.wind_speed_10m?.[i] ?? null,
    windDir: f.hourly.wind_direction_10m?.[i] ?? null,
    pressure: f.hourly.surface_pressure?.[i] ?? null,
    wave: m?.hourly?.wave_height?.[i] ?? null,
    sst: m?.hourly?.sea_surface_temperature?.[i] ?? null,
    sea: m?.hourly?.sea_level_height_msl?.[i] ?? null,
  }))
  const data = { hours, extremes: findExtremes(hours), fetchedAt: new Date() }
  cache.set(key, { at: Date.now(), data })
  return data
}

/** 시간별 해수면에서 만조·간조 찾기 (이웃 세 점으로 포물선 보정해 분 단위 시각) */
function findExtremes(hours: Hour[]): Extreme[] {
  const out: Extreme[] = []
  for (let i = 1; i < hours.length - 1; i++) {
    const a = hours[i - 1].sea, b = hours[i].sea, c = hours[i + 1].sea
    if (a == null || b == null || c == null) continue
    const high = b > a && b >= c, low = b < a && b <= c
    if (!high && !low) continue
    const denom = a - 2 * b + c
    const off = denom === 0 ? 0 : Math.max(-0.5, Math.min(0.5, (a - c) / (2 * denom)))
    out.push({ time: new Date(hours[i].time.getTime() + off * 3600e3), type: high ? 'high' : 'low', h: b - (a - c) * off / 4 })
  }
  return out
}

/** 지금 시각 기준 값 (정시 보간 없이 가장 가까운 시간) */
export function nowHour(d: MarineDash): Hour | undefined {
  const t = Date.now()
  return d.hours.reduce<Hour | undefined>((best, h) => (!best || Math.abs(h.time.getTime() - t) < Math.abs(best.time.getTime() - t) ? h : best), undefined)
}

export const DIR16 = ['북', '북북동', '북동', '동북동', '동', '동남동', '남동', '남남동', '남', '남남서', '남서', '서남서', '서', '서북서', '북서', '북북서']
export const dirKo = (deg: number | null) => (deg == null ? '' : DIR16[Math.round(deg / 22.5) % 16])

export type Sky = 'sun' | 'moon' | 'cloudSun' | 'cloud' | 'rain' | 'snow' | 'fog' | 'storm'
export function sky(code: number | null, time: Date): Sky {
  const night = time.getHours() < 6 || time.getHours() >= 19
  if (code == null || code === 0) return night ? 'moon' : 'sun'
  if (code <= 2) return night ? 'moon' : 'cloudSun'
  if (code === 3) return 'cloud'
  if (code <= 48) return 'fog'
  if (code <= 67 || (code >= 80 && code <= 82)) return 'rain'
  if (code <= 77 || code === 85 || code === 86) return 'snow'
  return 'storm'
}
export const SKY_LABEL: Record<Sky, string> = { sun: '맑음', moon: '맑음', cloudSun: '구름 조금', cloud: '흐림', rain: '비', snow: '눈', fog: '안개', storm: '뇌우' }
