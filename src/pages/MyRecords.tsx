import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type Row = { id: string; caught_at: string; log_type: string; size_cm: number | null; count: number; weather: string | null; species: { name_ko: string } | null }

export default function MyRecords() {
  const [rows, setRows] = useState<Row[]>([])
  const [ledger, setLedger] = useState<{ created_at: string; reason: string; amount: number }[]>([])

  useEffect(() => {
    supabase.from('catch_logs').select('id,caught_at,log_type,size_cm,count,weather,species(name_ko)').order('caught_at', { ascending: false }).limit(50)
      .then(({ data }) => setRows((data as unknown as Row[]) ?? []))
    supabase.from('point_ledger').select('created_at,reason,amount').order('created_at', { ascending: false }).limit(20)
      .then(({ data }) => setLedger(data ?? []))
  }, [])

  return (
    <div className="page">
      <h1>내 기록</h1>
      {rows.map(r => (
        <div key={r.id} className="card">
          <div style={{ fontWeight: 700 }}>{r.log_type === 'zero' ? '꽝' : `${r.species?.name_ko ?? ''} ${r.size_cm ?? ''}cm · ${r.count}마리`}{r.log_type === 'release' && ' (방생)'}</div>
          <div style={{ color: 'var(--mute)', fontSize: 13 }}>{new Date(r.caught_at).toLocaleString('ko-KR')} · {r.weather}</div>
        </div>
      ))}
      <div className="label">포인트 적립 내역</div>
      {ledger.map((l, i) => <div key={i} className="card" style={{ padding: 10, display: 'flex', justifyContent: 'space-between' }}><span>{l.reason}</span><b>{l.amount > 0 ? '+' : ''}{l.amount}P</b></div>)}
      <p style={{ fontSize: 12, color: 'var(--mute)' }}>포인트 사용처는 준비 중이에요. 지금 쌓은 포인트는 오픈 후 그대로 쓸 수 있어요.</p>
    </div>
  )
}
