import { useState } from 'react'
import { saveShareUrl, shareCatch, isAllowedShareUrl, SHARE_SITES, siteName } from '../lib/brag'
import { awardBrag } from '../lib/points'

/** 자랑하기: 공유창으로 올리고, 올린 블로그·카페 글 링크를 기록에 붙이기 */
export default function BragBox({ logId, text, initialUrl = null, compact = false }: {
  logId: string; text: string; initialUrl?: string | null; compact?: boolean
}) {
  const [url, setUrl] = useState(initialUrl ?? '')
  const [saved, setSaved] = useState(initialUrl)
  const [open, setOpen] = useState(!compact)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [rewarded, setRewarded] = useState(!!initialUrl)   // 이미 링크가 있던 기록은 적립 끝난 것으로 봄
  const bad = !!url.trim() && !isAllowedShareUrl(url)

  async function share() {
    setMsg('')
    try { setMsg((await shareCatch(text)) === 'copied' ? '자랑 문구를 복사했어요. 블로그·카페에 붙여 넣어 주세요.' : '') }
    catch { setMsg('공유하지 못했어요.') }
  }
  async function save() {
    setBusy(true); setMsg('')
    try {
      await saveShareUrl(logId, url)
      setSaved(url.trim() || null)
      if (!url.trim()) { setMsg('링크를 지웠어요.'); return }
      const r = await awardBrag(logId).catch(() => null)
      if (r && r.total > 0) { setRewarded(true); setMsg(`자랑글을 붙이고 ${r.total}P 받았어요.${r.capped ? ' (오늘 적립 한도까지)' : ''}`) }
      else if (r?.brag_skipped === 'already') { setRewarded(true); setMsg('자랑글을 바꿨어요. 포인트는 기록마다 한 번만 받아요.') }
      else if (r?.late) setMsg('자랑글을 붙였어요. 하루 넘게 지나서 적은 기록이라 포인트는 없어요.')
      else if (r?.brag_skipped === 'reused') setMsg('자랑글을 붙였어요. 다른 기록에 쓴 링크라 포인트는 없어요.')
      else if (r?.capped) setMsg('자랑글을 붙였어요. 오늘 적립 한도를 채워서 포인트는 없어요.')
      else setMsg('자랑글을 붙였어요.')
    }
    catch (e) { setMsg((e as Error).message) }
    finally { setBusy(false) }
  }

  if (compact && !open) {
    return (
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
        {saved && <a className="chip sm" href={saved} target="_blank" rel="noopener noreferrer nofollow ugc" style={{ textDecoration: 'none' }}>{siteName(saved)} 보기</a>}
        <button className="chip sm" onClick={() => setOpen(true)}>{saved ? '자랑글 바꾸기' : '자랑글 붙이기 +50P'}</button>
      </div>
    )
  }

  return (
    <div className={compact ? '' : 'card'} style={compact ? { marginTop: 10 } : undefined}>
      {!compact && <div className="card-head"><div className="card-title" style={{ fontSize: 16 }}>자랑하기 #오낚완</div></div>}
      <button className="btn ghost" onClick={share}>블로그·카페·SNS로 공유하기</button>
      <div className="label">올린 글 링크 붙이기</div>
      <input type="url" inputMode="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://blog.naver.com/..." aria-label="자랑글 링크" />
      {bad && <div className="error" style={{ marginTop: 6 }}>{SHARE_SITES} 주소만 붙일 수 있어요.</div>}
      <div className="row" style={{ marginTop: 8 }}>
        {compact && <button className="btn ghost" onClick={() => setOpen(false)}>닫기</button>}
        <button className="btn dark" disabled={busy || bad || (url.trim() || null) === saved} onClick={save}>{busy ? '저장하는 중…' : rewarded ? '링크 저장' : '링크 붙이고 50P 받기'}</button>
      </div>
      {msg && <div className="note">{msg}</div>}
      <div className="note">
        글은 나중에 올려도 돼요. 내 기록 → 목록에서 언제든 붙일 수 있어요. 기록마다 한 번 50P를 받아요.
        공개한 기록이면 검색 화면에서 다른 사람도 이 링크를 볼 수 있으니 내가 쓴 글만 붙여 주세요.
      </div>
    </div>
  )
}
