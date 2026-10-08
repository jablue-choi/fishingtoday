import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { listFeed, myLikes, toggleLike, thumbOf, FEED_KINDS, type FeedKind, type FeedPost } from '../lib/feed'
import { fetchSpecies, type Species } from '../lib/species'
import { ago } from '../lib/community'
import FishArt from '../components/FishArt'
import Icon from '../components/Icon'

/** 피드: 장비 자랑 · 미끼 레시피 · 영상 */
export default function Feed() {
  const [params, setParams] = useSearchParams()
  const kind = (FEED_KINDS.some(k => k.k === params.get('kind')) ? params.get('kind') : 'all') as FeedKind | 'all'
  const [posts, setPosts] = useState<FeedPost[] | null>(null)
  const [liked, setLiked] = useState<Set<string>>(new Set())
  const [species, setSpecies] = useState<Species[]>([])
  const [err, setErr] = useState('')

  useEffect(() => {
    setPosts(null); setErr('')
    listFeed(kind).then(p => { setPosts(p); myLikes(p.map(x => x.id)).then(setLiked) }).catch(e => setErr((e as Error).message))
  }, [kind])
  useEffect(() => { fetchSpecies().then(setSpecies).catch(() => setSpecies([])) }, [])

  async function like(p: FeedPost) {
    const was = liked.has(p.id)
    try {
      await toggleLike(p.id, was)
      setLiked(s => { const n = new Set(s); was ? n.delete(p.id) : n.add(p.id); return n })
      setPosts(list => list?.map(x => x.id === p.id ? { ...x, like_count: x.like_count + (was ? -1 : 1) } : x) ?? null)
    } catch (e) { setErr((e as Error).message) }
  }

  return (
    <div className="page">
      <div className="item-row" style={{ marginBottom: 12 }}>
        <h1 style={{ margin: 0 }}>피드</h1>
        <Link to={`/feed/new${kind !== 'all' ? `?kind=${kind}` : ''}`} className="btn" style={{ width: 'auto', minHeight: 40, padding: '0 14px' }}><Icon name="plusBare" size={18} />글쓰기</Link>
      </div>
      <div className="chips" style={{ marginBottom: 12 }}>
        <button className={`chip ${kind === 'all' ? 'on' : ''}`} onClick={() => setParams({}, { replace: true })}>전체</button>
        {FEED_KINDS.map(k => <button key={k.k} className={`chip ${kind === k.k ? 'on' : ''}`} onClick={() => setParams({ kind: k.k }, { replace: true })}>{k.label}</button>)}
      </div>

      {err && <div className="error">{err}</div>}
      {!posts && !err && <div className="empty">불러오는 중…</div>}
      {posts?.length === 0 && <div className="card plain empty">아직 글이 없어요. 첫 글을 올려 보세요. (하루 첫 글 +20P)</div>}

      <div className="list">
        {posts?.map(p => {
          const sp = species.find(s => s.code === p.species_code)
          const img = p.kind === 'video' && p.video_id ? thumbOf(p.video_id) : p.photo_url
          return (
            <div key={p.id} className="card" style={{ marginBottom: 0, padding: 0, overflow: 'hidden' }}>
              <Link to={`/feed/${p.id}`} style={{ textDecoration: 'none', color: 'var(--ink)', display: 'block' }}>
                {img && (
                  <div style={{ position: 'relative', aspectRatio: '16 / 9', background: 'var(--line-soft)' }}>
                    <img src={img} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    {p.kind === 'video' && <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ width: 52, height: 36, borderRadius: 10, background: 'rgba(220,38,38,.92)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg></span></span>}
                  </div>
                )}
                <div style={{ padding: '12px 14px 4px' }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className="badge">{FEED_KINDS.find(k => k.k === p.kind)?.label}</span>
                    {sp && <span className="badge accent-soft" style={{ color: 'var(--accent-ink)' }}>{sp.name_ko}</span>}
                    {p.tags.map(t => <span key={t} className="sub">#{t}</span>)}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, marginTop: 6 }}>{p.title}</div>
                  {p.kind === 'video' && p.video_author && <div className="sub">{p.video_author}</div>}
                  {p.kind === 'gear' && p.gear && <div className="sub">{[p.gear.rod, p.gear.reel, p.gear.line].filter(Boolean).join(' · ')}</div>}
                  {p.kind === 'recipe' && !img && sp && <div style={{ marginTop: 4 }}><FishArt code={sp.code} size={56} /></div>}
                </div>
              </Link>
              <div className="item-row" style={{ padding: '6px 14px 12px' }}>
                <span className="sub">{p.profiles?.nickname ?? ''} · {ago(p.created_at)}</span>
                <span style={{ display: 'flex', gap: 6 }}>
                  <button className={`chip sm ${liked.has(p.id) ? 'on' : ''}`} onClick={() => like(p)} aria-pressed={liked.has(p.id)}>좋아요 {p.like_count}</button>
                  <Link to={`/feed/${p.id}`} className="chip sm" style={{ textDecoration: 'none' }}>댓글 {p.comment_count}</Link>
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
