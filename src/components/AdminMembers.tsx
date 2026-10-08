import { useEffect, useState } from 'react'
import { listMembers, blockUser, unblockUser, type Member } from '../lib/moderation'
import Icon from './Icon'

const PERIODS: { label: string; days: number | null }[] = [{ label: '1일', days: 1 }, { label: '7일', days: 7 }, { label: '30일', days: 30 }, { label: '영구', days: null }]

/** 관리자: 회원 검색·차단·해제 */
export default function AdminMembers() {
  const [q, setQ] = useState('')
  const [list, setList] = useState<Member[] | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [days, setDays] = useState<number | null>(7)
  const [reason, setReason] = useState('')
  const [hide, setHide] = useState(false)
  const [msg, setMsg] = useState('')

  const load = (kw = q) => listMembers(kw).then(setList).catch(e => setMsg((e as Error).message))
  useEffect(() => { load('') }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function block(m: Member) {
    if (!window.confirm(`${m.nickname}님을 ${days == null ? '영구' : `${days}일`} 차단할까요?${hide ? ' 쓴 글도 모두 가려져요.' : ''}`)) return
    try { await blockUser(m.id, days, reason, hide); setMsg(`${m.nickname}님을 차단했어요.`); setOpen(null); setReason(''); setHide(false); load() }
    catch (e) { setMsg((e as Error).message) }
  }
  async function unblock(m: Member) {
    if (!window.confirm(`${m.nickname}님 차단을 풀까요?`)) return
    try { await unblockUser(m.id); setMsg(`${m.nickname}님 차단을 풀었어요.`); load() } catch (e) { setMsg((e as Error).message) }
  }

  return (
    <div>
      <form className="search-field" role="search" onSubmit={e => { e.preventDefault(); load() }} style={{ marginBottom: 10 }}>
        <Icon name="search" size={20} />
        <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="닉네임 검색" aria-label="닉네임 검색" />
        <button type="submit">검색</button>
      </form>
      {msg && <div className="card plain" style={{ fontSize: 14 }}>{msg}</div>}
      {!list && <div className="empty">불러오는 중…</div>}
      <div className="list">
        {list?.map(m => (
          <div key={m.id} className="card" style={{ marginBottom: 0 }}>
            <div className="item-row">
              <div style={{ minWidth: 0 }}>
                <span className="item-title">{m.nickname}</span>
                {m.is_admin && <span className="badge ink" style={{ marginLeft: 6 }}>관리자</span>}
                {m.blocked && <span className="badge danger" style={{ marginLeft: 6 }}>차단{m.blocked_until ? ` ~${new Date(m.blocked_until).toLocaleDateString('ko-KR')}` : ' (영구)'}</span>}
                <div className="sub">가입 {new Date(m.created_at).toLocaleDateString('ko-KR')} · 기록 {m.logs} · 글 {m.posts} · 댓글 {m.comments} · <b style={{ color: m.reports_received ? 'var(--danger)' : undefined }}>받은 신고 {m.reports_received}</b></div>
                {m.blocked && m.block_reason && <div className="sub">사유: {m.block_reason}</div>}
              </div>
              {!m.is_admin && (m.blocked
                ? <button className="chip sm" onClick={() => unblock(m)}>차단 풀기</button>
                : <button className="chip sm" onClick={() => setOpen(open === m.id ? null : m.id)}>차단</button>)}
            </div>
            {open === m.id && (
              <div className="item" style={{ marginTop: 10 }}>
                <div className="label" style={{ marginTop: 0 }}>기간</div>
                <div className="chips">{PERIODS.map(p => <button key={p.label} className={`chip sm ${days === p.days ? 'on' : ''}`} onClick={() => setDays(p.days)}>{p.label}</button>)}</div>
                <div className="label">사유 (회원에게 보여요)</div>
                <input value={reason} maxLength={200} onChange={e => setReason(e.target.value)} placeholder="예: 욕설 반복, 광고 도배" />
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, marginTop: 10 }}>
                  <input type="checkbox" checked={hide} onChange={e => setHide(e.target.checked)} />이 회원이 쓴 글·댓글·제보도 모두 가리기
                </label>
                <button className="btn" style={{ marginTop: 10, background: 'var(--danger)', boxShadow: 'none' }} onClick={() => block(m)}>{days == null ? '영구 차단하기' : `${days}일 차단하기`}</button>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="note">차단된 회원은 대화방·피드·장소 제보·신고를 쓸 수 없어요. 자기 조과 기록은 계속 남길 수 있어요.</div>
    </div>
  )
}
