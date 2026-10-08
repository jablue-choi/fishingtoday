import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { roomStats, recentPosts, ago, type RoomStat, type Post } from '../lib/community'
import { fetchSpecies, type Species } from '../lib/species'
import { getLastPos } from '../lib/fishingIndex'
import { regionName } from '../lib/kakaoMap'
import { regionKey, regionLabel } from '../lib/regionStats'
import FishArt from '../components/FishArt'
import Icon from '../components/Icon'

const roomUrl = (type: string, key: string) => `/community/${type}/${encodeURIComponent(key)}`

/** 대화방 목록: 오늘 / 어종 / 지역 */
export default function Community() {
  const [stats, setStats] = useState<RoomStat[]>([])
  const [species, setSpecies] = useState<Species[]>([])
  const [mine, setMine] = useState('')
  const [latest, setLatest] = useState<Post[] | null>(null)

  useEffect(() => {
    roomStats().then(setStats)
    fetchSpecies().then(setSpecies).catch(() => setSpecies([]))
    recentPosts(5).then(setLatest)
    const p = getLastPos()
    if (p) regionName(p.lat, p.lon).then(n => setMine(regionKey(n)))
  }, [])

  const statOf = (type: string, key: string) => stats.find(s => s.room_type === type && s.room_key === key)
  // 어종방: 최근 글 많은 순, 나머지는 기본 순서
  const speciesRooms = useMemo(() => [...species].sort((a, b) => (statOf('species', b.code)?.posts ?? 0) - (statOf('species', a.code)?.posts ?? 0)), [species, stats]) // eslint-disable-line react-hooks/exhaustive-deps
  const regionRooms = useMemo(() => {
    const keys = stats.filter(s => s.room_type === 'region').sort((a, b) => b.posts - a.posts).map(s => s.room_key)
    return [...new Set([...(mine ? [mine] : []), ...keys])].slice(0, 12)
  }, [stats, mine])
  const nameOf = (p: Post) => p.room_type === 'today' ? '오늘' : p.room_type === 'species' ? species.find(s => s.code === p.room_key)?.name_ko ?? '어종' : regionLabel(p.room_key)

  return (
    <div className="page">
      <h1>커뮤니티</h1>
      <div className="choices" style={{ gridTemplateColumns: 'repeat(2, minmax(0,1fr))', marginBottom: 12 }}>
        <Link to="/feed" className="choice" style={{ textDecoration: 'none' }}><Icon name="camera" size={18} />피드 (장비·레시피·영상)</Link>
        <Link to="/places" className="choice" style={{ textDecoration: 'none' }}><Icon name="pin" size={18} />주변 편의시설</Link>
      </div>

      <Link to={roomUrl('today', 'today')} className="card dark" style={{ display: 'block', textDecoration: 'none' }}>
        <div className="glow" />
        <div className="item-row">
          <div>
            <span className="badge accent-soft">실시간 질문</span>
            <div style={{ fontSize: 20, fontWeight: 900, marginTop: 6 }}>오늘 대화방</div>
            <div className="sub">지금 바람·물색·입질, 오늘 궁금한 걸 물어보세요</div>
          </div>
          <span style={{ color: 'var(--accent)' }}><Icon name="chevron" size={24} /></span>
        </div>
        {statOf('today', 'today') && <div className="sub" style={{ marginTop: 8 }}>마지막 글 {ago(statOf('today', 'today')!.last_at)}</div>}
      </Link>

      {latest && latest.length > 0 && (
        <div className="card">
          <div className="card-title" style={{ marginBottom: 8 }}><span className="dot-mark" />방금 올라온 질문</div>
          <div className="list">
            {latest.map(p => (
              <Link key={p.id} to={`/community/post/${p.id}`} className="item" style={{ textDecoration: 'none', color: 'var(--ink)' }}>
                <div className="item-row"><span className="badge">{nameOf(p)}</span><span className="sub">{ago(p.created_at)} · 댓글 {p.comment_count}</span></div>
                <div style={{ fontSize: 14, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.body}</div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-title" style={{ marginBottom: 8 }}><span className="dot-mark" />지역 대화방</div>
        {regionRooms.length === 0 && <div className="empty">홈에서 위치를 정하면 내 지역 대화방이 생겨요.</div>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 8 }}>
          {regionRooms.map(k => {
            const s = statOf('region', k)
            return (
              <Link key={k} to={roomUrl('region', k)} className="item" style={{ textDecoration: 'none', color: 'var(--ink)' }}>
                <div className="item-title" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Icon name="pin" size={14} />{regionLabel(k)}{k === mine && <span className="badge accent" style={{ marginLeft: 4 }}>내 지역</span>}</div>
                <div className="sub" style={{ fontSize: 11 }}>{s ? `최근 글 ${s.posts}개 · ${ago(s.last_at)}` : '첫 질문을 남겨 보세요'}</div>
              </Link>
            )
          })}
        </div>
      </div>

      <div className="card">
        <div className="card-title" style={{ marginBottom: 8 }}><span className="dot-mark" />어종 대화방</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 8 }}>
          {speciesRooms.map(sp => {
            const s = statOf('species', sp.code)
            return (
              <Link key={sp.id} to={roomUrl('species', sp.code)} className="item" style={{ textDecoration: 'none', color: 'var(--ink)', textAlign: 'center', padding: '8px 4px' }}>
                <div style={{ display: 'flex', justifyContent: 'center' }}><FishArt code={sp.code} name={sp.name_ko} size={64} /></div>
                <div style={{ fontWeight: 800, fontSize: 13 }}>{sp.name_ko}</div>
                <div className="sub" style={{ fontSize: 10 }}>{s ? `글 ${s.posts} · ${ago(s.last_at)}` : ' '}</div>
              </Link>
            )
          })}
        </div>
      </div>

      <div className="note">욕설·비하 표현은 올릴 수 없어요. 서로 존중해 주세요. 광고·개인정보는 신고해 주세요. 신고가 3번 쌓이면 자동으로 가려져요. 정확한 포인트 좌표 대신 지역 이름으로 이야기해 주세요.</div>
    </div>
  )
}
