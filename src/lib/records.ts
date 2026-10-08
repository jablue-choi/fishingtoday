import { supabase } from './supabase'

export type LogRow = {
  id: string
  caught_at: string
  log_type: 'catch' | 'release' | 'zero'
  species_name: string | null
  size_cm: number | null
  count: number
  method_label: string | null
  bait_label: string | null
  weather: string | null
  temp_c: number | null
  lat: number
  lon: number
  share_url?: string | null
}

export type Period = 'month' | 'year' | 'all'

export async function fetchMyLogs(period: Period): Promise<LogRow[]> {
  const { data: { user } } = await supabase.auth.getUser()
  let q = supabase
    .from('catch_logs_v')
    .select('id,caught_at,log_type,species_name,size_cm,count,method_label,bait_label,weather,temp_c,lat,lon,share_url')
    .eq('user_id', user!.id)
    .eq('entered_by', 'user')   // 관리자 등록 기록은 내 리포트에서 제외
    .order('caught_at', { ascending: false })
  const now = new Date()
  if (period === 'month') q = q.gte('caught_at', new Date(now.getFullYear(), now.getMonth(), 1).toISOString())
  if (period === 'year') q = q.gte('caught_at', new Date(now.getFullYear(), 0, 1).toISOString())
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as LogRow[]
}

const kstDay = (iso: string) => new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })

export type Report = {
  trips: number            // 출조일 수 (날짜 기준)
  logs: number
  fish: number             // 잡은 마릿수 (방생 제외)
  released: number
  zeroDays: number         // 꽝만 있었던 날
  bySpecies: { name: string; fish: number; best: number | null }[]
  byMethod: { name: string; fish: number }[]
  byBait: { name: string; fish: number }[]
  byMonth: { key: string; fish: number; trips: number }[]
  spots: number            // 방문 지점 수(약 200m 단위)
}

export function buildReport(rows: LogRow[]): Report {
  const days = new Map<string, { fish: number; zero: boolean; any: boolean }>()
  const sp = new Map<string, { fish: number; best: number | null }>()
  const me = new Map<string, number>(), ba = new Map<string, number>()
  const mo = new Map<string, { fish: number; days: Set<string> }>()
  const cells = new Set<string>()
  let fish = 0, released = 0

  for (const r of rows) {
    const d = kstDay(r.caught_at)
    const day = days.get(d) ?? { fish: 0, zero: false, any: false }
    cells.add(`${r.lat.toFixed(3)},${r.lon.toFixed(3)}`)
    const mk = d.slice(0, 7)
    const m = mo.get(mk) ?? { fish: 0, days: new Set() }
    m.days.add(d)

    if (r.log_type === 'zero') { day.zero = true }
    else {
      day.any = true
      const n = r.count || 0
      if (r.log_type === 'release') released += n
      else { fish += n; day.fish += n; m.fish += n }
      if (r.species_name) {
        const s = sp.get(r.species_name) ?? { fish: 0, best: null }
        if (r.log_type !== 'release') s.fish += n
        if (r.size_cm != null) s.best = Math.max(s.best ?? 0, Number(r.size_cm))
        sp.set(r.species_name, s)
      }
      if (r.log_type === 'catch') {
        if (r.method_label) me.set(r.method_label, (me.get(r.method_label) ?? 0) + n)
        if (r.bait_label) ba.set(r.bait_label, (ba.get(r.bait_label) ?? 0) + n)
      }
    }
    days.set(d, day); mo.set(mk, m)
  }

  const sortDesc = <T extends { fish: number }>(a: T[]) => a.sort((x, y) => y.fish - x.fish)
  return {
    trips: days.size,
    logs: rows.length,
    fish, released,
    zeroDays: [...days.values()].filter(d => d.zero && !d.any).length,
    bySpecies: sortDesc([...sp].map(([name, v]) => ({ name, ...v }))),
    byMethod: sortDesc([...me].map(([name, fish]) => ({ name, fish }))),
    byBait: sortDesc([...ba].map(([name, fish]) => ({ name, fish }))),
    byMonth: [...mo].map(([key, v]) => ({ key, fish: v.fish, trips: v.days.size })).sort((a, b) => a.key.localeCompare(b.key)),
    spots: cells.size,
  }
}
