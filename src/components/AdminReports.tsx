import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listReports, setHidden, blockUser, TARGET_LABEL, type Report } from '../lib/moderation'

const linkOf = (r: Report) => r.target_type === 'post' ? `/community/post/${r.target_id}` : r.target_type === 'feed' ? `/feed/${r.target_id}` : null

/** 관리자: 신고 목록 → 숨김/해제, 작성자 7일 차단 */
export default function AdminReports() {
  const [list, setList] = useState<Report[] | null>(null)
  const [msg, setMsg] = useState('')
  const load = () => listReports().then(setList).catch(e => setMsg((e as Error).message))
  useEffect(() => { load() }, [])

  async function toggle(r: Report) {
    try { await setHidden(r.target_type, r.target_id, !r.hidden); load() } catch (e) { setMsg((e as Error).message) }
  }
  async function block(r: Report) {
    if (!r.author_id || !window.confirm(`${r.author}님을 7일 차단하고 쓴 글을 모두 가릴까요?`)) return
    try { await blockUser(r.author_id, 7, `신고 처리: ${r.reason ?? ''}`.slice(0, 200), true); setMsg(`${r.author}님을 7일 차단했어요.`); load() }
    catch (e) { setMsg((e as Error).message) }
  }

  return (
    <div>
      {msg && <div className="card plain" style={{ fontSize: 14 }}>{msg}</div>}
      {!list && <div className="empty">불러오는 중…</div>}
      {list?.length === 0 && <div className="card plain empty">들어온 신고가 없어요.</div>}
      <div className="list">
        {list?.map(r => (
          <div key={r.id} className="card" style={{ marginBottom: 0 }}>
            <div className="item-row">
              <span><span className="badge">{TARGET_LABEL[r.target_type]}</span>{r.hidden && <span className="badge warn" style={{ marginLeft: 6 }}>가려짐</span>}</span>
              <span className="sub">{new Date(r.created_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
            </div>
            <div style={{ fontSize: 14, margin: '6px 0', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{r.body ?? <span className="sub">지워진 글이에요</span>}</div>
            <div className="sub">작성 {r.author ?? '-'} · 신고 {r.reporter ?? '-'} · 누적 {r.report_count ?? 0}건{r.reason ? ` · 사유: ${r.reason}` : ''}</div>
            {r.body != null && (
              <div className="chips" style={{ marginTop: 8 }}>
                <button className="chip sm" onClick={() => toggle(r)}>{r.hidden ? '다시 보이기' : '가리기'}</button>
                {r.author_id && <button className="chip sm" onClick={() => block(r)}>작성자 7일 차단</button>}
                {linkOf(r) && <Link className="chip sm" to={linkOf(r)!} style={{ textDecoration: 'none' }}>원문 보기</Link>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
