import { supabase } from './supabase'

export type Species = { id: number; name_ko: string; code: string; status: 'official' | 'user'; water_type: 'sea' | 'fresh' | 'both' }

const COLS = 'id,name_ko,code,status,water_type'

/** 어종 목록: 정식 어종 먼저, 사용자 추가 어종은 뒤에 */
export async function fetchSpecies(): Promise<Species[]> {
  const { data, error } = await supabase.from('species').select(COLS).order('id')
  if (error) throw error
  const list = (data ?? []) as Species[]
  return [...list.filter(s => s.status !== 'user'), ...list.filter(s => s.status === 'user')]
}

/** 목록에 없는 어종 추가 → 정식 코드(u<id>)를 가진 species 행. 같은 이름이 있으면 그걸 돌려줌 */
export async function addSpecies(name: string, water: 'sea' | 'fresh'): Promise<Species> {
  const { data, error } = await supabase.rpc('add_species', { p_name: name, p_water: water })
  if (error) throw new Error(error.message)
  const row = (Array.isArray(data) ? data[0] : data) as Omit<Species, 'water_type'>
  return { ...row, water_type: water }
}
