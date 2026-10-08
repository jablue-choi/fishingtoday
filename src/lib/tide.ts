import { guessArea } from './seasons'
import { supabase } from './supabase'

/*
 * 물때: 음력 날짜로 계산 (1~13물, 14=조금, 15=무시)
 *  - 서해 7물때식: 음력 1일 = 7물, 8일 = 조금, 9일 = 무시, 10일 = 1물
 *  - 남해·동해·제주 8물때식: 음력 1일 = 8물, 7일 = 조금
 * 만조·간조 시각: 국립해양조사원 조석예보(고·저조), 엣지 함수 'tide'가 가장 가까운 예보지점으로 조회
 */
export const TIDE_SOURCE = '국립해양조사원 조석예보'

export type TideExtreme = { time: Date; type: 'high' | 'low'; h: number }   // h: 조위(cm)
export type TideTable = { station: { code: string; name: string; dist_km: number }; extremes: TideExtreme[] }

const tableCache = new Map<string, Promise<TideTable>>()
const MAX_STATION_KM = 40

/** date(KST) 하루 앞부터 days일치 만조·간조. 같은 지점·날짜는 한 번만 부름 */
export function fetchTideTable(pos: { lat: number; lon: number }, date = new Date(), days = 2): Promise<TideTable> {
  const ymd = new Date(date.getTime() + 9 * 3600e3).toISOString().slice(0, 10)
  const key = `${pos.lat.toFixed(3)},${pos.lon.toFixed(3)},${ymd},${days}`
  let p = tableCache.get(key)
  if (!p) {
    p = (async () => {
      const { data, error } = await supabase.functions.invoke<{ station: TideTable['station']; extremes: { time: string; type: 'high' | 'low'; h_cm: number }[]; error?: string }>('tide', {
        body: { lat: pos.lat, lon: pos.lon, date: ymd, days },
      })
      if (error || !data || data.error || !data.extremes?.length) throw new Error('조석예보를 불러오지 못했어요')
      if (data.station.dist_km > MAX_STATION_KM) throw new Error('가까운 조석예보 지점이 없어요')   // 내륙·민물
      return { station: data.station, extremes: data.extremes.map(e => ({ time: new Date(e.time), type: e.type, h: e.h_cm })) }
    })()
    p.catch(() => tableCache.delete(key))
    tableCache.set(key, p)
  }
  return p
}

/** 고·저조 사이를 코사인으로 이어 t 시각의 조위(cm). 범위 밖이면 null */
export function tideLevel(ex: TideExtreme[], t: number): number | null {
  for (let i = 0; i < ex.length - 1; i++) {
    const a = ex[i], b = ex[i + 1], ta = a.time.getTime(), tb = b.time.getTime()
    if (t < ta || t > tb) continue
    const k = (1 - Math.cos(Math.PI * (t - ta) / (tb - ta))) / 2
    return a.h + (b.h - a.h) * k
  }
  return null
}

/** 기록 시각에서 가장 가까운 만조·간조 (catch_logs.high_tide_at / low_tide_at, 'HH:MM') */
export function nearestTideTimes(ex: TideExtreme[], at = new Date()) {
  const near = (type: 'high' | 'low') => ex.filter(e => e.type === type)
    .reduce<TideExtreme | null>((best, e) => (!best || Math.abs(e.time.getTime() - at.getTime()) < Math.abs(best.time.getTime() - at.getTime()) ? e : best), null)
  const hm = (e: TideExtreme | null) => e ? e.time.toLocaleTimeString('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false }) : null
  return { high_tide_at: hm(near('high')), low_tide_at: hm(near('low')) }
}

const lunarFmt = new Intl.DateTimeFormat('ko-KR-u-ca-dangi', { timeZone: 'Asia/Seoul', day: 'numeric' })

/** 음력 일(1~30), KST 기준 */
export function lunarDay(d = new Date()): number {
  return Number(lunarFmt.formatToParts(d).find(p => p.type === 'day')?.value)
}

export type Tide = { mul: number; label: string; phase: '사리' | '조금' | null; system: '7물때식' | '8물때식' }

export function tideAt(pos: { lat: number; lon: number } | null, d = new Date()): Tide | null {
  const day = lunarDay(d)
  if (!day) return null
  const west = guessArea(pos) === '서해'
  const mul = ((day + (west ? 6 : 7) - 1) % 15) + 1
  return {
    mul,
    label: tideLabel(mul)!,
    phase: mul >= 5 && mul <= 9 ? '사리' : mul >= 13 || mul === 1 ? '조금' : null,
    system: west ? '7물때식' : '8물때식',
  }
}

export function tideLabel(mul: number | null | undefined): string | null {
  if (!mul) return null
  return mul === 14 ? '조금' : mul === 15 ? '무시' : `${mul}물`
}
