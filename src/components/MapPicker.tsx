import { useEffect, useRef, useState } from 'react'
import { loadKakaoMap } from '../lib/kakaoMap'

type Pos = { lat: number; lon: number }

/**
 * 현위치 핀 + 위치 조정.
 * - 핀을 드래그하거나 지도를 탭하면 위치가 바뀜
 * - "내 위치로" 버튼으로 GPS 위치 복귀
 */
export default function MapPicker({ initial, gps, onChange, level = 3, backLabel = '내 위치로' }: {
  initial: Pos
  gps: Pos
  onChange: (p: Pos) => void
  level?: number        // 카카오맵 확대 단계 (클수록 넓게)
  backLabel?: string
}) {
  const box = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const [err, setErr] = useState('')
  const [moved, setMoved] = useState(false)

  useEffect(() => {
    let alive = true
    loadKakaoMap().then(kakao => {
      if (!alive || !box.current) return
      const center = new kakao.maps.LatLng(initial.lat, initial.lon)
      const map = new kakao.maps.Map(box.current, { center, level })
      map.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.RIGHT)
      const marker = new kakao.maps.Marker({ position: center, draggable: true })
      marker.setMap(map)

      const emit = (ll: any) => {
        setMoved(true)
        onChange({ lat: ll.getLat(), lon: ll.getLng() })
      }
      kakao.maps.event.addListener(marker, 'dragend', () => emit(marker.getPosition()))
      kakao.maps.event.addListener(map, 'click', (e: any) => {
        marker.setPosition(e.latLng)
        emit(e.latLng)
      })
      mapRef.current = map
      markerRef.current = marker
    }).catch(e => setErr((e as Error).message))
    return () => { alive = false }
    // 최초 1회만 생성
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function backToGps() {
    const kakao = window.kakao
    if (!kakao || !mapRef.current) return
    const ll = new kakao.maps.LatLng(gps.lat, gps.lon)
    markerRef.current.setPosition(ll)
    mapRef.current.panTo(ll)
    setMoved(false)
    onChange(gps)
  }

  if (err) return <div className="card" style={{ color: 'var(--danger)', fontSize: 13 }}>{err}</div>

  return (
    <div style={{ position: 'relative', marginBottom: 10 }}>
      <div ref={box} style={{ width: '100%', height: 240, borderRadius: 12, overflow: 'hidden', background: 'var(--box)' }} />
      <div style={{ fontSize: 12, color: 'var(--mute)', marginTop: 6 }}>
        핀을 끌거나 지도를 눌러 정확한 위치로 옮겨요
      </div>
      {moved && (
        <button className="chip" onClick={backToGps}
          style={{ position: 'absolute', left: 8, top: 8, zIndex: 2, background: '#fff', color: '#17181A' }}>
          {backLabel}
        </button>
      )}
    </div>
  )
}
