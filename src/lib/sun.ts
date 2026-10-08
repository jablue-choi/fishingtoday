/*
 * 일출·일몰: 좌표·날짜로 계산 (SunCalc 방식 천문 계산, API 없음, 오차 1분 안팎)
 * 지평선 기준 -0.833° (대기 굴절 + 태양 반지름), 고도(지형) 보정 없음
 */
const rad = Math.PI / 180
const J1970 = 2440588, J2000 = 2451545, J0 = 0.0009
const E = rad * 23.4397   // 황도 경사

const toJulian = (d: Date) => d.getTime() / 86400000 - 0.5 + J1970
const fromJulian = (j: number) => new Date((j + 0.5 - J1970) * 86400000)

/** date가 속한 날(KST)의 일출·일몰. 극지방처럼 해가 안 뜨거나 안 지면 null */
export function sunTimes(lat: number, lon: number, date = new Date()): { rise: Date | null; set: Date | null } {
  const ymd = new Date(date.getTime() + 9 * 3600e3).toISOString().slice(0, 10)
  const noon = new Date(`${ymd}T12:00:00+09:00`)
  const lw = -lon * rad, phi = lat * rad
  const d = toJulian(noon) - J2000
  const n = Math.round(d - J0 - lw / (2 * Math.PI))
  const ds = J0 + lw / (2 * Math.PI) + n
  const M = rad * (357.5291 + 0.98560028 * ds)
  const C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M))
  const L = M + C + rad * 102.9372 + Math.PI
  const dec = Math.asin(Math.sin(E) * Math.sin(L))
  const jNoon = J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L)
  const cosW = (Math.sin(-0.833 * rad) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec))
  if (cosW < -1 || cosW > 1) return { rise: null, set: null }
  const a = J0 + (Math.acos(cosW) + lw) / (2 * Math.PI) + n
  const jSet = J2000 + a + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L)
  return { rise: fromJulian(jNoon - (jSet - jNoon)), set: fromJulian(jSet) }
}
