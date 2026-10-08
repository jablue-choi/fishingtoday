import { useEffect, useRef, useState } from 'react'
import { loadKakaoMap } from '../lib/kakaoMap'
import type { Place } from '../lib/places'

/** 주변 장소 마커 지도. 마커를 누르면 onSelect, 고른 장소는 주황 원으로 표시 */
export default function PlacesMap({ center, places, selected, onSelect }: {
  center: { lat: number; lon: number }; places: Place[]; selected: Place | null; onSelect: (p: Place) => void
}) {
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<any>(null)
  const markers = useRef<any[]>([])
  const pick = useRef<any>(null)
  const [err, setErr] = useState('')
  const [ready, setReady] = useState(0)   // 지도가 만들어진 뒤 마커를 그리기 위해

  useEffect(() => {
    let alive = true
    loadKakaoMap().then(kakao => {
      if (!alive || !box.current) return
      map.current = new kakao.maps.Map(box.current, { center: new kakao.maps.LatLng(center.lat, center.lon), level: 5 })
      new kakao.maps.Marker({ map: map.current, position: new kakao.maps.LatLng(center.lat, center.lon), title: '기준 위치' })
      setReady(r => r + 1)
    }).catch(e => setErr((e as Error).message))
    return () => { alive = false }
  }, [center.lat, center.lon])

  useEffect(() => {
    const kakao = window.kakao
    if (!kakao?.maps || !map.current) return
    markers.current.forEach(m => m.setMap(null))
    markers.current = places.map(p => {
      const el = document.createElement('button')
      el.type = 'button'
      el.textContent = p.name.length > 8 ? `${p.name.slice(0, 8)}…` : p.name
      el.setAttribute('aria-label', p.name)
      el.style.cssText = 'border:0;border-radius:999px;padding:3px 8px;font:700 11px/1.4 "Noto Sans KR",sans-serif;background:#131C22;color:#fff;box-shadow:0 2px 6px rgba(0,0,0,.25);cursor:pointer;white-space:nowrap'
      el.onclick = () => onSelect(p)
      return new kakao.maps.CustomOverlay({ map: map.current, position: new kakao.maps.LatLng(p.lat, p.lon), content: el, yAnchor: 1.3 })
    })
    if (places.length) {
      const b = new kakao.maps.LatLngBounds()
      b.extend(new kakao.maps.LatLng(center.lat, center.lon))
      places.slice(0, 10).forEach(p => b.extend(new kakao.maps.LatLng(p.lat, p.lon)))
      map.current.setBounds(b)
    }
  }, [places, ready]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const kakao = window.kakao
    if (!kakao?.maps || !map.current) return
    pick.current?.setMap(null)
    if (!selected) return
    const ll = new kakao.maps.LatLng(selected.lat, selected.lon)
    pick.current = new kakao.maps.Circle({ map: map.current, center: ll, radius: 25, strokeWeight: 3, strokeColor: '#FF5722', fillColor: '#FF5722', fillOpacity: 0.3 })
    map.current.panTo(ll)
  }, [selected, ready])

  if (err) return <div className="card plain error">{err}</div>
  return <div ref={box} style={{ width: '100%', height: 260, borderRadius: 16, overflow: 'hidden', background: 'var(--line)', marginBottom: 12 }} />
}
