import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { signOut } from '../lib/supabase'
import { getThemePref, setThemePref, type ThemePref } from '../lib/theme'
import { isAdmin } from '../lib/admin'

const THEMES: { k: ThemePref; label: string }[] = [
  { k: 'system', label: '시스템 맞춤' },
  { k: 'light', label: '라이트' },
  { k: 'dark', label: '다크' },
]

export default function Settings() {
  const [theme, setTheme] = useState<ThemePref>(getThemePref)
  const [admin, setAdmin] = useState(false)
  useEffect(() => { isAdmin().then(setAdmin) }, [])

  return (
    <div className="page">
      <h1>설정</h1>

      <div className="card">
        <div className="card-head"><div className="card-title" style={{ fontSize: 16 }}>화면 테마</div></div>
        <div className="chips" role="radiogroup" aria-label="화면 테마">
          {THEMES.map(t => (
            <button key={t.k} role="radio" aria-checked={theme === t.k} className={`chip ${theme === t.k ? 'on' : ''}`}
              onClick={() => { setTheme(t.k); setThemePref(t.k) }}>{t.label}</button>
          ))}
        </div>
        <div className="note">시스템 맞춤은 휴대폰의 다크 모드 설정을 따라가요. 이 기기에만 저장돼요.</div>
      </div>

      {admin && (
        <Link to="/admin" className="btn dark" style={{ marginBottom: 12 }}>관리자: 조과 등록·관리</Link>
      )}

      <button className="btn ghost" onClick={() => signOut()}>로그아웃</button>
      <p className="note" style={{ textAlign: 'center', marginTop: 24 }}>오늘낚시 · © 153랩</p>
    </div>
  )
}
