import { supabase } from './supabase'

export type FishingIndex = {
  name: string; date: string; time: string; fish: string | null; weather?: string | null
  score: string; points: number | null; lat: number; lon: number
  wave: string | null; water_temp: string | null; air_temp: string | null
  wind: string | null; current: string | null; tide: string | null
  dist_km?: number
}
export type Gubun = '갯바위' | '선상' | '바다여행' | '선박운항'

export async function fetchFishingIndex(gubun: Gubun, near?: { lat: number; lon: number }, limit = 10) {
  const { data, error } = await supabase.functions.invoke<{ items: FishingIndex[]; fetched_at: string; error?: string; detail?: unknown }>('fishing_index', {
    body: { gubun, limit, ...(near ?? {}) },
  })
  if (error) throw error
  if (!data || data.error) throw new Error(data?.error ?? '바다낚시지수를 불러오지 못했어요')
  return data
}

export const SCORE_COLOR: Record<string, string> = {
  '매우좋음': '#0A55B5', '좋음': '#3FA9F5', '보통': '#8A8D86', '나쁨': '#E8A13A', '매우나쁨': '#D9472B',
}

/* 마지막으로 찍은 위치 (홈에서 위치 권한을 다시 묻지 않으려고) */
const LAST = 'last_pos'
export function saveLastPos(p: { lat: number; lon: number }) { try { localStorage.setItem(LAST, JSON.stringify(p)) } catch { /* noop */ } }
export function getLastPos(): { lat: number; lon: number } | null { try { return JSON.parse(localStorage.getItem(LAST) ?? 'null') } catch { return null } }
