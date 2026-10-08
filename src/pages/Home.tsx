import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getLastPos, saveLastPos } from '../lib/fishingIndex'
import { regionName } from '../lib/kakaoMap'
import FishingIndexCard from '../components/FishingIndexCard'
import ClosedSeasonCard from '../components/ClosedSeasonCard'
import SeasonCard from '../components/SeasonCard'
import NearbySpotsCard from '../components/NearbySpotsCard'
import RankingCard from '../components/RankingCard'
import RegionFishCard from '../components/RegionFishCard'
import LocalIndex from '../components/LocalIndex'
import CommunityCard from '../components/CommunityCard'
import NearbyFacilities from '../components/NearbyFacilities'
import { useAuth } from '../lib/auth'
import { getPosition } from '../lib/geo'
import { regionKey, regionLabel } from '../lib/regionStats'
import TideHero from '../components/TideHero'
import HourlyForecast from '../components/HourlyForecast'
import LocationSheet from '../components/LocationSheet'
import Icon from '../components/Icon'

type Pos = { lat: number; lon: number }
const PLACE_KEY = 'last_place_name'
const loadPlace = () => { try { return localStorage.getItem(PLACE_KEY) ?? '' } catch { return '' } }
const savePlace = (n: string) => { try { localStorage.setItem(PLACE_KEY, n) } catch { /* noop */ } }

export default function Home() {
  const [nick, setNick] = useState('')
  const [balance, setBalance] = useState(0)
  const [pos, setPos] = useState<Pos | null>(getLastPos)
  const [place, setPlace] = useState(loadPlace)
  const [sheet, setSheet] = useState(false)
  const [ver, setVer] = useState(0)   // 위치를 바꾸면 아래 카드들을 새로 불러오기
  const { session, requireLogin } = useAuth()

  useEffect(() => {
    if (!session) return
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: p } = await supabase.from('profiles').select('nickname').eq('id', user.id).single()
      setNick(p?.nickname ?? '')
      const { data: b } = await supabase.from('point_balances').select('balance').eq('user_id', user.id).maybeSingle()
      setBalance(b?.balance ?? 0)
    })()
  }, [session])

  // 이름 없는 위치(현위치 등)는 지역명으로
  useEffect(() => {
    if (pos && !place) regionName(pos.lat, pos.lon).then(n => { if (n) { setPlace(n); savePlace(n) } })
  }, [pos, place])

  function pick(p: Pos, name: string) {
    saveLastPos(p); setPos(p); setPlace(name); savePlace(name); setSheet(false); setVer(v => v + 1)
  }

  return (
    <div className="page flush">
      <header className="topbar">
        <div className="item-row">
          <button className="loc" onClick={() => setSheet(true)} aria-label="기준 위치 바꾸기">
            <span className="loc-icon"><Icon name="pin" size={18} /></span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <b style={{ fontSize: 16, fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>{place || (pos ? '내 위치' : '위치를 정해 주세요')}</b>
                <span style={{ color: 'var(--accent)', display: 'inline-flex' }}><Icon name="chevronDown" size={16} /></span>
              </span>
              <span style={{ display: 'block', fontSize: 11, color: 'var(--on-dark)' }}>오늘낚시 · 눌러서 위치 바꾸기</span>
            </span>
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {session ? (
              <Link to="/me" className="points">
                <span style={{ display: 'block', fontSize: 9, fontWeight: 800, color: 'var(--on-dark)' }}>보유 포인트</span>
                <span className="num" style={{ fontSize: 13, fontWeight: 900, color: '#FBBF24' }}>{balance.toLocaleString()} <small>P</small></span>
              </Link>
            ) : (
              <button className="points" style={{ cursor: 'pointer', color: '#fff', fontWeight: 900, fontSize: 13, minHeight: 36 }} onClick={() => requireLogin('포인트를 모으려면')}>로그인</button>
            )}
            <Link to="/settings" className="icon-btn" aria-label="설정"><Icon name="gear" size={16} /></Link>
          </div>
        </div>
      </header>

      <TideHero pos={pos} nick={nick} onPickLocation={() => setSheet(true)}
        onUseGps={async () => { const g = await getPosition(); pick({ lat: g.coords.latitude, lon: g.coords.longitude }, '') }} />
      {pos && <LocalIndex key={`l${ver}`} pos={pos} title={`${place ? regionLabel(regionKey(place)) || place : '이 지역'} 오늘 바다낚시지수`} />}
      <HourlyForecast pos={pos} />
      <NearbyFacilities />
      <RankingCard />
      <RegionFishCard key={`r${ver}`} compact />
      <CommunityCard />
      <SeasonCard key={`s${ver}`} />
      <FishingIndexCard key={`f${ver}`} title="주변 주요 낚시 포인트 지수" />
      <NearbySpotsCard key={`n${ver}`} />
      <ClosedSeasonCard />

      <div className="card dark" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12 }}>
        <span style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,87,34,.2)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name="tower" size={16} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800 }}>데이터 출처</div>
          <div className="sub" style={{ fontSize: 11 }}>기상청 초단기실황 · 국립해양조사원 바다낚시지수 · 해수부 낚시포인트 · Open-Meteo 예측 모델(물때 곡선·예보)</div>
        </div>
      </div>

      <div className="row" style={{ marginTop: 4 }}>
        <Link to="/search?mode=recommend" className="btn ghost">이번 주 어디 갈까?</Link>
        <Link to="/me" className="btn ghost">내 기록 보기</Link>
      </div>

      {sheet && <LocationSheet onPick={pick} onClose={() => setSheet(false)} />}
    </div>
  )
}
