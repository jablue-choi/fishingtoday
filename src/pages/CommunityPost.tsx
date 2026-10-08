import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getPost, listComments, createComment, deletePost, deleteComment, report, myUserId, ago, type Post, type Comment } from '../lib/community'
import { fetchSpecies, type Species } from '../lib/species'
import { regionLabel } from '../lib/regionStats'
import { hasProfanity, PROFANITY_MSG } from '../lib/profanity'
import { myBlockStatus, blockText } from '../lib/moderation'
import { useAuth } from '../lib/auth'

/** 질문 하나 + 댓글 */
export default function CommunityPost() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const [post, setPost] = useState<Post | null | undefined>(undefined)
  const [comments, setComments] = useState<Comment[]>([])
  const [species, setSpecies] = useState<Species[]>([])
  const [me, setMe] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [block, setBlock] = useState<{ blocked: boolean; until: string | null; reason: string | null } | null>(null)
  const { session, requireLogin } = useAuth()
  useEffect(() => { if (session) myBlockStatus().then(setBlock) }, [session])

  const loadComments = () => listComments(id).then(setComments).catch(e => setMsg((e as Error).message))
  useEffect(() => {
    getPost(id).then(setPost); loadComments()
    fetchSpecies().then(setSpecies).catch(() => setSpecies([]))
    myUserId().then(setMe)
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (post === undefined) return <div className="page"><div className="empty">불러오는 중…</div></div>
  if (!post) return <div className="page"><h1>글을 찾을 수 없어요</h1><Link to="/community" className="btn ghost">대화방으로</Link></div>

  const roomName = post.room_type === 'today' ? '오늘 대화방' : post.room_type === 'species' ? `${species.find(s => s.code === post.room_key)?.name_ko ?? '어종'} 대화방` : `${regionLabel(post.room_key)} 대화방`
  const roomUrl = `/community/${post.room_type}/${encodeURIComponent(post.room_key)}`

  async function send() {
    if (!requireLogin('댓글을 달려면')) return
    if (!body.trim() || busy || hasProfanity(body)) return
    setBusy(true); setMsg('')
    try { await createComment(id, body); setBody(''); await loadComments() }
    catch (e) { setMsg((e as Error).message) }
    finally { setBusy(false) }
  }
  async function doReport(type: 'post' | 'comment', target: string) {
    if (!requireLogin('신고하려면')) return
    const reason = window.prompt('신고 이유를 짧게 적어 주세요 (욕설, 광고, 개인정보 등)')
    if (reason === null) return
    try { await report(type, target, reason.slice(0, 200)); setMsg('신고했어요. 3번 쌓이면 자동으로 가려져요.') }
    catch (e) { setMsg((e as Error).message) }
  }
  async function removePost() {
    if (!window.confirm('이 질문을 지울까요? 댓글도 함께 지워져요.')) return
    try { await deletePost(id); nav(roomUrl, { replace: true }) } catch (e) { setMsg((e as Error).message) }
  }
  async function removeComment(cid: string) {
    if (!window.confirm('이 댓글을 지울까요?')) return
    try { await deleteComment(cid); await loadComments() } catch (e) { setMsg((e as Error).message) }
  }

  return (
    <div className="page">
      <Link to={roomUrl} className="more">← {roomName}</Link>

      <div className="card" style={{ marginTop: 8 }}>
        <div className="item-row">
          <span style={{ fontWeight: 800 }}>{post.profiles?.nickname ?? '알 수 없음'}{post.region ? <span className="sub" style={{ fontWeight: 500 }}> · {post.region}</span> : null}</span>
          <span className="sub">{ago(post.created_at)}</span>
        </div>
        {post.hidden && <div className="badge warn" style={{ marginTop: 6 }}>신고가 쌓여 가려진 글이에요</div>}
        <div style={{ fontSize: 16, marginTop: 8, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{post.body}</div>
        {post.tags?.length > 0 && (
          <div className="chips" style={{ marginTop: 8 }}>
            {post.tags.map(t => <Link key={t} to={`/search?q=${encodeURIComponent(`${post.region ?? ''} ${t}`.trim())}`} className="chip sm" style={{ textDecoration: 'none', background: 'var(--accent-soft)', color: 'var(--accent-ink)' }}>#{t}</Link>)}
          </div>
        )}
        <div className="chips" style={{ marginTop: 10, justifyContent: 'flex-end' }}>
          {post.user_id === me ? <button className="chip sm" onClick={removePost}>지우기</button> : <button className="chip sm" onClick={() => doReport('post', post.id)}>신고</button>}
        </div>
      </div>

      <div className="card-title" style={{ margin: '4px 2px 8px' }}>댓글 {comments.length}</div>
      {comments.length === 0 && <div className="card plain empty">아직 댓글이 없어요. 아는 분이 답해 주세요.</div>}
      <div className="list" style={{ marginBottom: 12 }}>
        {comments.map(c => (
          <div key={c.id} className="item" style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
            <div className="item-row">
              <span style={{ fontWeight: 800, fontSize: 13 }}>{c.profiles?.nickname ?? '알 수 없음'}{c.user_id === post.user_id && <span className="badge accent" style={{ marginLeft: 6 }}>글쓴이</span>}</span>
              <span className="sub">{ago(c.created_at)}</span>
            </div>
            <div style={{ fontSize: 15, marginTop: 4, whiteSpace: 'pre-wrap' }}>{c.hidden ? <span className="sub">가려진 댓글이에요</span> : c.body}</div>
            <div style={{ textAlign: 'right' }}>
              {c.user_id === me ? <button className="chip sm" onClick={() => removeComment(c.id)}>지우기</button> : <button className="chip sm" onClick={() => doReport('comment', c.id)}>신고</button>}
            </div>
          </div>
        ))}
      </div>

      {msg && <div className="card plain" style={{ fontSize: 14 }}>{msg}</div>}
      {block?.blocked ? <div className="card plain error">{blockText(block)}</div> : <div className="card">
        <textarea value={body} onChange={e => setBody(e.target.value)} onFocus={() => { if (!session) requireLogin('댓글을 달려면') }} maxLength={500} rows={2} placeholder="답변이나 의견을 남겨 주세요" aria-label="댓글"
          style={{ width: '100%', padding: 12, border: '1px solid var(--line)', borderRadius: 12, background: 'var(--surface)', color: 'var(--ink)', fontSize: 16, resize: 'vertical' }} />
        {hasProfanity(body) && <div className="error" style={{ marginTop: 6 }}>{PROFANITY_MSG}</div>}
        <div className="item-row" style={{ marginTop: 8 }}>
          <span className="sub">{body.length}/500 · 욕설·비하 표현은 달 수 없어요</span>
          <button className="btn" style={{ width: 'auto', minHeight: 44, padding: '0 18px' }} disabled={!body.trim() || busy || hasProfanity(body)} onClick={send}>{busy ? '다는 중…' : '댓글 달기'}</button>
        </div>
      </div>}
    </div>
  )
}
