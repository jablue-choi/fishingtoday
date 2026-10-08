import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { recentPosts, ago, type Post } from '../lib/community'
import Icon from './Icon'
import { useGuardClick } from '../lib/auth'

/** 홈: 대화방 새 질문 3개 + 오늘 대화방 바로가기 */
export default function CommunityCard() {
  const [posts, setPosts] = useState<Post[] | null>(null)
  const guard = useGuardClick()
  useEffect(() => { recentPosts(3).then(setPosts) }, [])
  if (!posts) return null

  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title"><span style={{ color: 'var(--accent)', display: 'inline-flex' }}><Icon name="chat" size={16} /></span>대화방 새 질문</div>
        <Link to="/community" className="more">전체<Icon name="chevron" size={12} /></Link>
      </div>
      {posts.length === 0 ? <div className="empty">아직 질문이 없어요. 첫 질문을 남겨 보세요.</div> : (
        <div className="list">
          {posts.map(p => (
            <Link key={p.id} to={`/community/post/${p.id}`} onClick={guard} className="item" style={{ textDecoration: 'none', color: 'var(--ink)' }}>
              <div style={{ fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.body}</div>
              <div className="sub">{p.profiles?.nickname ?? ''} · {ago(p.created_at)} · 댓글 {p.comment_count}</div>
            </Link>
          ))}
        </div>
      )}
      <Link to="/community/today/today" className="btn ghost" style={{ marginTop: 10, minHeight: 44 }}>오늘 대화방에 물어보기</Link>
    </div>
  )
}
