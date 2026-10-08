import { supabase } from './supabase'

export type AutoFill = {
  weather: string
  temp_c: number | null
  wind_dir: string | null
  wind_ms: number | null
}

/** 기상청 초단기실황. 키 노출·CORS 문제로 엣지 함수 'weather'를 거쳐 호출한다. */
export async function fetchKmaNow(lat: number, lon: number): Promise<AutoFill> {
  const { data, error } = await supabase.functions.invoke<AutoFill & { error?: string }>('weather', {
    body: { lat, lon },
  })
  if (error) throw error
  if (!data || data.error) throw new Error(data?.error ?? 'weather failed')
  return { weather: data.weather, temp_c: data.temp_c, wind_dir: data.wind_dir, wind_ms: data.wind_ms }
}
