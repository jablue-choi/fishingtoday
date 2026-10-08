import { useNavigate } from 'react-router-dom'
import { useState } from 'react'

/** 상단 검색창. 누르면 검색 화면으로, 엔터 치면 지역 검색 바로 실행 */
export default function SearchBar({ placeholder = '지역이나 어종으로 검색 (예: 대부도, 우럭)' }: { placeholder?: string }) {
  const nav = useNavigate()
  const [q, setQ] = useState('')
  return (
    <div style={{ position: 'sticky', top: 'env(safe-area-inset-top, 0px)', zIndex: 5, background: 'var(--paper)', padding: '4px 0 10px' }}>
      <input
        value={q}
        onChange={e => setQ(e.target.value)}
        onFocus={() => { if (!q) nav('/search') }}
        onKeyDown={e => { if (e.key === 'Enter') nav(`/search?q=${encodeURIComponent(q)}`) }}
        placeholder={placeholder}
        style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1.5px solid var(--line)', fontSize: 15, background: '#fff' }}
      />
    </div>
  )
}
