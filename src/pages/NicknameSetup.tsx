import { useState } from 'react'
import { NICK_RE, saveNickname } from '../lib/profile'
import { hasProfanity } from '../lib/profanity'

/** 첫 로그인: 다른 사람에게 보일 닉네임 정하기 (카카오 실명 대신) */
export default function NicknameSetup({ onDone }: { onDone: (nick: string) => void }) {
  const [nick, setNick] = useState('')
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)
  const banned = hasProfanity(nick)
  const valid = NICK_RE.test(nick.trim()) && !banned

  async function submit() {
    if (!valid || saving) return
    setSaving(true); setErr('')
    try { onDone(await saveNickname(nick)) }
    catch (e) { setErr((e as Error).message) }
    finally { setSaving(false) }
  }

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', justifyContent: 'flex-end' }}>
      <h1>닉네임을 정해 주세요</h1>
      <p style={{ color: 'var(--mute)', marginTop: 0 }}>
        공개 기록과 검색에 이 이름이 보여요.<br />카카오 이름은 다른 사람에게 보이지 않아요.
      </p>
      <input
        autoFocus value={nick} maxLength={12}
        onChange={e => setNick(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && submit()}
        placeholder="예: 서해우럭왕"
        style={{ padding: '12px 14px', borderRadius: 12, border: '1.5px solid var(--line)', fontSize: 16, marginBottom: 6 }}
      />
      <div style={{ fontSize: 12, color: err ? 'var(--danger)' : 'var(--mute)', marginBottom: 14 }}>
        {err || (banned ? '쓸 수 없는 닉네임이에요.' : '2~12자, 한글·영문·숫자·_ 만 쓸 수 있어요.')}
      </div>
      <button className="btn" disabled={!valid || saving} onClick={submit}>
        {saving ? '저장하는 중…' : '이 닉네임으로 시작하기'}
      </button>
    </div>
  )
}
