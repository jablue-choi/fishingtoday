import { guessArea } from './seasons'

/*
 * 물때: 음력 날짜로 계산 (1~13물, 14=조금, 15=무시)
 *  - 서해 7물때식: 음력 1일 = 7물, 8일 = 조금, 9일 = 무시, 10일 = 1물
 *  - 남해·동해·제주 8물때식: 음력 1일 = 8물, 7일 = 조금
 * 만조·간조 시각은 바다누리 조석 API 연동 후 추가 (high_tide_at / low_tide_at)
 */

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
