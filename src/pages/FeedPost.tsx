import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getFeed, listFeedComments, addFeedComment, deleteFeedComment, deleteFeed, toggleLike, myLikes, FEED_KINDS, type FeedPost as Post, type FeedComment } from '../lib/feed'
import { fetchSpecies, type Species } from '../lib/species'
import { reportContent, myBlockStatus, blockText } from '../lib/moderation'
import { ago, myUserId } from '../lib/community'
import { hasProfanity, PROFANITY_MSG } from '../lib/profanity'
import FishArt from '../components/FishArt'
import { useAuth } from '../lib/auth'

/** 피드 글 하나: 사진·영상, 장비·레시피, 좋아요, 댓글 */
export default function FeedPost() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const [post, setPost] = useState<Post | null | undefined>(undefined)
  const [comments, setComments] = useState<FeedComment[]>([])
  const [liked, setLiked] = useState(false)
  const [species, setSpecies] = useState<Species[]>([])
  const [me, setMe] = useState('')
  const [body, setBody] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [block, setBlock] = useState<{ blocked: boolean; until: string | null; reason: string | null } | null>(null)
  const { session, requireLogin } = useAuth()

  const loadComments = () => listFeedComments(id).then(setComments)
  useEffect(() => {
    getFeed(id).then(setPost); loadComments(); myLikes([id]).then(s => setLiked(s.has(id)))
    fetchSpecies().then(setSpecies).catch(() => setSpecies([])); myUserId().then(setMe)
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (session) myBlockStatus().then(setBlock) }, [session])

  if (post === undefined) return <div className="page"><div className="empty">불러오는 중…</div></div>
  if (!post) return <div className="page"><h1>글을 찾을 수 없어요</h1><Link to="/feed" className="btn ghost">피드로</Link></div>

  const sp = species.find(s => s.code === post.species_code)
  async function like() {
    if (!requireLogin('좋아요를 누르려면')) return
    try { await toggleLike(post!.id, liked); setLiked(!liked); setPost(p => p && { ...p, like_count: p.like_count + (liked ? -1 : 1) }) }
    catch (e) { setMsg((e as Error).message) }
  }
  async function send() {
    if (!requireLogin('댓글을 달려면')) return
    if (!body.trim() || busy || hasProfanity(body)) return
    setBusy(true); setMsg('')
    try { await addFeedComment(id, body); setBody(''); await loadComments() } catch (e) { setMsg((e as Error).message) } finally { setBusy(false) }
  }
  async function doReport(type: 'feed' | 'feed_comment', target: string) {
    if (!requireLogin('신고하려면')) return
    const reason = window.prompt('신고 이유를 짧게 적어 주세요 (욕설, 광고, 도용 등)')
    if (reason === null) return
    try { await reportContent(type, target, reason); setMsg('신고했어요. 3번 쌓이면 자동으로 가려져요.') } catch (e) { setMsg((e as Error).message) }
  }

  return (
    <div className="page">
      <Link to={`/feed?kind=${post.kind}`} className="more">← {FEED_KINDS.find(k => k.k === post.kind)?.label}</Link>
      <div className="card" style={{ marginTop: 8, padding: 0, overflow: 'hidden' }}>
        {post.kind === 'video' && post.video_id ? (
          <div style={{ aspectRatio: '16 / 9' }}>
            <iframe src={`https://www.youtube-nocookie.com/embed/${post.video_id}`} title={post.video_title ?? post.title} style={{ width: '100%', height: '100%', border: 0 }}
              allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowFullScreen loading="lazy" />
          </div>
        ) : post.photo_url && <img src={post.photo_url} alt="" style={{ width: '100%', display: 'block', maxHeight: 420, objectFit: 'cover' }} />}
        <div style={{ padding: 14 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span className="badge">{FEED_KINDS.find(k => k.k === post.kind)?.label}</span>
            {post.tags.map(t => <span key={t} className="sub">#{t}</span>)}
            {post.hidden && <span className="badge warn">가려진 글</span>}
          </div>
          <div style={{ fontSize: 19, fontWeight: 900, marginTop: 6 }}>{post.title}</div>
          <div className="sub">{post.profiles?.nickname ?? ''} · {ago(post.created_at)}{post.video_author ? ` · 영상: ${post.video_author}` : ''}</div>

          {post.kind === 'gear' && post.gear && (
            <div style={{ marginTop: 10 }}>
              {([['로드', post.gear.rod], ['릴', post.gear.reel], ['라인', post.gear.line], ['루어·채비', post.gear.lure]] as const).filter(([, v]) => v).map(([k, v]) => (
                <div key={k} className="kv"><span className="sub">{k}</span><b style={{ textAlign: 'right' }}>{v}</b></div>
              ))}
            </div>
          )}
          {post.kind === 'recipe' && post.recipe && (
            <div style={{ marginTop: 10 }}>
              {post.recipe.ingredients && <><div className="label" style={{ marginTop: 0 }}>재료</div><div style={{ whiteSpace: 'pre-wrap', fontSize: 15 }}>{post.recipe.ingredients}</div></>}
              {post.recipe.steps && <><div className="label">만드는 법</div><div style={{ whiteSpace: 'pre-wrap', fontSize: 15 }}>{post.recipe.steps}</div></>}
            </div>
          )}
          {sp && <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}><FishArt code={sp.code} size={56} /><span className="sub">대상 어종 · <b>{sp.name_ko}</b></span></div>}
          {post.body && <div style={{ whiteSpace: 'pre-wrap', fontSize: 15, marginTop: 10, lineHeight: 1.6 }}>{post.body}</div>}

          <div className="item-row" style={{ marginTop: 12 }}>
            <button className={`chip ${liked ? 'on' : ''}`} onClick={like} aria-pressed={liked} disabled={block?.blocked}>좋아요 {post.like_count}</button>
            {post.user_id === me
              ? <button className="chip sm" onClick={async () => { if (window.confirm('이 글을 지울까요?')) { await deleteFeed(post.id); nav('/feed', { replace: true }) } }}>지우기</button>
              : <button className="chip sm" onClick={() => doReport('feed', post.id)}>신고</button>}
          </div>
        </div>
      </div>

      <div className="card-title" style={{ margin: '4px 2px 8px' }}>댓글 {comments.length}</div>
      <div className="list" style={{ marginBottom: 12 }}>
        {comments.map(c => (
          <div key={c.id} className="item" style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
            <div className="item-row"><span style={{ fontWeight: 800, fontSize: 13 }}>{c.profiles?.nickname ?? ''}{c.user_id === post.user_id && <span className="badge accent" style={{ marginLeft: 6 }}>글쓴이</span>}</span><span className="sub">{ago(c.created_at)}</span></div>
            <div style={{ fontSize: 15, marginTop: 4, whiteSpace: 'pre-wrap' }}>{c.hidden ? <span className="sub">가려진 댓글이에요</span> : c.body}</div>
            <div style={{ textAlign: 'right' }}>
              {c.user_id === me ? <button className="chip sm" onClick={async () => { await deleteFeedComment(c.id); loadComments() }}>지우기</button> : <button className="chip sm" onClick={() => doReport('feed_comment', c.id)}>신고</button>}
            </div>
          </div>
        ))}
      </div>

      {msg && <div className="card plain" style={{ fontSize: 14 }}>{msg}</div>}
      {block?.blocked ? <div className="card plain error">{blockText(block)}</div> : (
        <div className="card">
          <textarea value={body} onChange={e => setBody(e.target.value)} onFocus={() => { if (!session) requireLogin('댓글을 달려면') }} maxLength={500} rows={2} placeholder="댓글을 남겨 주세요" aria-label="댓글"
            style={{ width: '100%', padding: 12, border: '1px solid var(--line)', borderRadius: 12, background: 'var(--surface)', color: 'var(--ink)', fontSize: 16, resize: 'vertical' }} />
          {hasProfanity(body) && <div className="error" style={{ marginTop: 6 }}>{PROFANITY_MSG}</div>}
          <div className="item-row" style={{ marginTop: 8 }}>
            <span className="sub">{body.length}/500</span>
            <button className="btn" style={{ width: 'auto', minHeight: 44, padding: '0 18px' }} disabled={!body.trim() || busy || hasProfanity(body)} onClick={send}>{busy ? '다는 중…' : '댓글 달기'}</button>
          </div>
        </div>
      )}
    </div>
  )
}
