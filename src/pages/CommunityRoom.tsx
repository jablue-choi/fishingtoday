import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { listPosts, createPost, ago, QUICK, type Post, type RoomType } from '../lib/community'
import { fetchSpecies, type Species } from '../lib/species'
import { getLastPos } from '../lib/fishingIndex'
import { regionName } from '../lib/kakaoMap'
import { regionLabel, regionKey } from '../lib/regionStats'
import FishArt from '../components/FishArt'
import LocalIndex from '../components/LocalIndex'
import { hasProfanity, PROFANITY_MSG } from '../lib/profanity'
import { myBlockStatus, blockText } from '../lib/moderation'

/** 대화방 하나: 질문 쓰기 + 질문 목록 */
export default function CommunityRoom() {
  const { type = 'today', key = 'today' } = useParams()
  const roomType = (['today', 'species', 'region'].includes(type) ? type : 'today') as RoomType
  const nav = useNavigate()
  const [posts, setPosts] = useState<Post[] | null>(null)
  const [species, setSpecies] = useState<Species[]>([])
  const [body, setBody] = useState('')
  const [myRegion, setMyRegion] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [pos] = useState(getLastPos)
  const [block, setBlock] = useState<{ blocked: boolean; until: string | null; reason: string | null } | null>(null)
  useEffect(() => { myBlockStatus().then(setBlock) }, [])

  const load = () => listPosts(roomType, key).then(setPosts).catch(e => setErr((e as Error).message))
  useEffect(() => {
    setPosts(null); load()
    fetchSpecies().then(setSpecies).catch(() => setSpecies([]))
    if (pos) regionName(pos.lat, pos.lon).then(n => setMyRegion(regionKey(n)))
  }, [roomType, key]) // eslint-disable-line react-hooks/exhaustive-deps

  const bad = hasProfanity(body)
  const sp = roomType === 'species' ? species.find(s => s.code === key) : undefined
  const title = roomType === 'today' ? '오늘 대화방' : roomType === 'species' ? `${sp?.name_ko ?? '어종'} 대화방` : `${regionLabel(key)} 대화방`

  async function submit() {
    if (body.trim().length < 2 || busy || hasProfanity(body)) return
    setBusy(true); setErr('')
    try {
      // 오늘·어종방은 글쓴이 지역(시군구)을 함께 붙여 "어디 얘기인지" 알 수 있게
      const id = await createPost(roomType, key, body, roomType === 'region' ? null : myRegion ? regionLabel(myRegion) : null)
      setBody('')
      nav(`/community/post/${id}`)
    } catch (e) { setErr((e as Error).message) }
    finally { setBusy(false) }
  }

  return (
    <div className="page">
      <Link to="/community" className="more">← 대화방</Link>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '6px 0 12px' }}>
        {sp && <FishArt code={sp.code} name={sp.name_ko} size={72} />}
        <div>
          <h1 style={{ margin: 0 }}>{title}</h1>
          <div className="sub">{roomType === 'today' ? `${new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })} 올라온 글만 보여요` : '최근 글 순'}</div>
        </div>
      </div>

      {roomType === 'region' && pos && regionKey(key) === myRegion && <LocalIndex pos={pos} title={`${regionLabel(key)} 오늘 바다낚시지수`} />}

      {block?.blocked ? <div className="card plain error">{blockText(block)}</div> : (
      <div className="card">
        <div className="card-title" style={{ marginBottom: 8 }}>무엇이 궁금한가요?</div>
        <div className="chips" style={{ marginBottom: 8 }}>
          {QUICK[roomType].map(q => <button key={q} className="chip sm" onClick={() => setBody(b => (b ? `${b} ${q}` : `${roomType === 'today' && myRegion ? `${regionLabel(myRegion)} ` : ''}${q}`))}>{q}</button>)}
        </div>
        <textarea value={body} onChange={e => setBody(e.target.value)} maxLength={1000} rows={3} placeholder={roomType === 'species' ? `${sp?.name_ko ?? '이 어종'} 관련해서 물어보세요` : '예: 대부도 지금 바람 어떤가요?'}
          aria-label="질문 내용"
          style={{ width: '100%', padding: 12, border: '1px solid var(--line)', borderRadius: 12, background: 'var(--surface)', color: 'var(--ink)', fontSize: 16, resize: 'vertical' }} />
        {bad && <div className="error" style={{ marginTop: 6 }}>{PROFANITY_MSG}</div>}
        <div className="item-row" style={{ marginTop: 8 }}>
          <span className="sub">{body.length}/1000 · 욕설·비하 표현은 올릴 수 없어요</span>
          <button className="btn" style={{ width: 'auto', minHeight: 44, padding: '0 18px' }} disabled={body.trim().length < 2 || busy || bad} onClick={submit}>{busy ? '올리는 중…' : '질문 올리기'}</button>
        </div>
        {err && <div className="error" style={{ marginTop: 6 }}>{err}</div>}
      </div>
      )}

      {!posts && !err && <div className="empty">불러오는 중…</div>}
      {posts && posts.length === 0 && <div className="card plain empty">{roomType === 'today' ? '오늘은 아직 질문이 없어요. 첫 질문을 남겨 보세요.' : '아직 질문이 없어요. 첫 질문을 남겨 보세요.'}</div>}
      <div className="list">
        {posts?.map(p => (
          <Link key={p.id} to={`/community/post/${p.id}`} className="card" style={{ marginBottom: 0, textDecoration: 'none', color: 'var(--ink)' }}>
            <div className="item-row">
              <span style={{ fontWeight: 800, fontSize: 13 }}>{p.profiles?.nickname ?? '알 수 없음'}{p.region ? <span className="sub" style={{ fontWeight: 500 }}> · {p.region}</span> : null}</span>
              <span className="sub">{ago(p.created_at)}</span>
            </div>
            <div style={{ fontSize: 15, marginTop: 6, whiteSpace: 'pre-wrap', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.body}</div>
            <div className="sub" style={{ marginTop: 6 }}>{p.hidden ? '가려진 글 · ' : ''}댓글 {p.comment_count}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
