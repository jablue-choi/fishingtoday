/* 카카오맵 JS SDK 로더. 한 번만 로드해서 재사용. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare global { interface Window { kakao: any } }

let loading: Promise<any> | null = null

export function loadKakaoMap(): Promise<any> {
  if (window.kakao?.maps?.LatLng) return Promise.resolve(window.kakao)
  if (loading) return loading
  loading = new Promise((resolve, reject) => {
    const key = import.meta.env.VITE_KAKAO_JS_KEY
    if (!key) return reject(new Error('VITE_KAKAO_JS_KEY가 없어요'))
    const s = document.createElement('script')
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&libraries=services&autoload=false`
    s.async = true
    s.onload = () => window.kakao.maps.load(() => resolve(window.kakao))
    s.onerror = () => { loading = null; reject(new Error('카카오맵을 불러오지 못했어요')) }
    document.head.appendChild(s)
  })
  return loading
}

export type PlaceHit = { name: string; address: string; lat: number; lon: number }

/** 장소·지역 검색 ("속초", "대부도 방아머리"). 장소 검색 결과가 없으면 주소 검색으로 */
export async function searchPlaces(q: string): Promise<PlaceHit[]> {
  const kakao = await loadKakaoMap()
  const keyword = q.trim()
  if (!keyword) return []
  const places: PlaceHit[] = await new Promise(resolve => {
    new kakao.maps.services.Places().keywordSearch(keyword, (res: any[], status: string) => {
      if (status !== kakao.maps.services.Status.OK) return resolve([])
      resolve(res.slice(0, 8).map(r => ({ name: r.place_name, address: r.road_address_name || r.address_name, lat: Number(r.y), lon: Number(r.x) })))
    })
  })
  if (places.length) return places
  return new Promise(resolve => {
    new kakao.maps.services.Geocoder().addressSearch(keyword, (res: any[], status: string) => {
      if (status !== kakao.maps.services.Status.OK) return resolve([])
      resolve(res.slice(0, 8).map(r => ({ name: r.address_name, address: r.address_name, lat: Number(r.y), lon: Number(r.x) })))
    })
  })
}

/** 좌표 → "경기 화성시 서신면" 형태의 지역명. 실패하면 null. */
export async function regionName(lat: number, lon: number): Promise<string | null> {
  try {
    const kakao = await loadKakaoMap()
    const geocoder = new kakao.maps.services.Geocoder()
    return await new Promise(resolve => {
      geocoder.coord2RegionCode(lon, lat, (res: any[], status: string) => {
        if (status !== kakao.maps.services.Status.OK || !res?.length) return resolve(null)
        const r = res.find(x => x.region_type === 'H') ?? res[0] // 행정동 우선
        resolve([r.region_1depth_name, r.region_2depth_name, r.region_3depth_name].filter(Boolean).join(' '))
      })
    })
  } catch { return null }
}
