import { supabase } from './supabase'
import { loadKakaoMap } from './kakaoMap'
import { friendlyError } from './moderation'

export type PlaceType = 'toilet' | 'shop' | 'bait' | 'food'
export const PLACE_TYPES: { k: PlaceType; label: string; desc: string }[] = [
  { k: 'toilet', label: '화장실', desc: '공중화장실 (공공데이터)' },
  { k: 'shop', label: '낚시점', desc: '낚시용품점 (카카오 장소)' },
  { k: 'bait', label: '미끼', desc: '미끼 파는 곳 (카카오 장소)' },
  { k: 'food', label: '맛집', desc: '음식점 (카카오 장소)' },
]

export type Place = {
  type: PlaceType; ref: string; name: string; address: string | null; phone: string | null
  lat: number; lon: number; dist_m: number; url: string | null; open_time?: string | null
  status?: { clean: number; dirty: number; locked: number; gone: number; last_kind: string | null; last_at: string | null }
}
export type Note = { id: string; kind: NoteKind; body: string | null; created_at: string; user_id: string; profiles: { nickname: string } | null }
export type NoteKind = 'clean' | 'dirty' | 'locked' | 'gone' | 'tip'
export const STATUS: { k: Exclude<NoteKind, 'tip'>; label: string }[] = [
  { k: 'clean', label: '깨끗해요' }, { k: 'dirty', label: '지저분해요' }, { k: 'locked', label: '잠겨 있어요' }, { k: 'gone', label: '없어졌어요' },
]
export const STATUS_LABEL: Record<string, string> = { clean: '깨끗함', dirty: '지저분함', locked: '잠김', gone: '없어짐' }

type Pos = { lat: number; lon: number }

/** 주변 장소 찾기: 화장실은 DB, 나머지는 카카오 장소 검색 */
export async function placesNear(type: PlaceType, pos: Pos): Promise<Place[]> {
  if (type === 'toilet') {
    const { data, error } = await supabase.rpc('toilets_near', { p_lat: pos.lat, p_lon: pos.lon, p_km: 3, p_limit: 30 })
    if (error) throw new Error('화장실을 불러오지 못했어요')
    return (data ?? []).map((t: any) => ({
      type, ref: String(t.id), name: t.name, address: t.address, phone: null, lat: t.lat, lon: t.lon, dist_m: t.dist_m, url: null,
      open_time: t.open_time, status: { clean: t.clean, dirty: t.dirty, locked: t.locked, gone: t.gone, last_kind: t.last_kind, last_at: t.last_at },
    }))
  }
  const kakao = await loadKakaoMap()
  const ps = new kakao.maps.services.Places()
  const opts = { location: new kakao.maps.LatLng(pos.lat, pos.lon), radius: type === 'food' ? 3000 : 10000, sort: kakao.maps.services.SortBy.DISTANCE }
  const res: any[] = await new Promise(resolve => {
    const done = (r: any[], status: string) => resolve(status === kakao.maps.services.Status.OK ? r : [])
    if (type === 'food') ps.categorySearch('FD6', done, opts)
    else ps.keywordSearch(type === 'bait' ? '낚시 미끼' : '낚시', done, opts)
  })
  return res.slice(0, 15).map(r => ({
    type, ref: String(r.id), name: r.place_name, address: r.road_address_name || r.address_name || null, phone: r.phone || null,
    lat: Number(r.y), lon: Number(r.x), dist_m: Number(r.distance) || 0, url: r.place_url || null,
  }))
}

export async function listNotes(type: PlaceType, ref: string): Promise<Note[]> {
  const { data } = await supabase.from('place_notes').select('id,kind,body,created_at,user_id,profiles(nickname)')
    .eq('place_type', type).eq('place_ref', ref).order('created_at', { ascending: false }).limit(30)
  return (data ?? []) as unknown as Note[]
}

/** 목록에 '팁 n개' 배지를 달기 위한 개수 */
export async function tipCounts(type: PlaceType, refs: string[]): Promise<Map<string, number>> {
  const m = new Map<string, number>()
  if (!refs.length) return m
  const { data } = await supabase.from('place_notes').select('place_ref').eq('place_type', type).eq('kind', 'tip').in('place_ref', refs)
  for (const r of data ?? []) m.set(r.place_ref, (m.get(r.place_ref) ?? 0) + 1)
  return m
}

export async function addNote(p: Place, kind: NoteKind, body: string | null) {
  const { error } = await supabase.from('place_notes').insert({
    place_type: p.type, place_ref: p.ref, place_name: p.name.slice(0, 80), kind,
    body: body?.trim() || null, geom: `SRID=4326;POINT(${p.lon} ${p.lat})`,
  })
  if (error) throw new Error(friendlyError(error, '제보하지 못했어요.'))
}

export async function deleteNote(id: string) {
  const { error } = await supabase.from('place_notes').delete().eq('id', id)
  if (error) throw new Error('지우지 못했어요.')
}

export const distText = (m: number) => (m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)}km`)
