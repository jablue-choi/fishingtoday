import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchMyLogs, buildReport, type LogRow, type Period } from '../lib/records'
import HistoryMap from '../components/HistoryMap'
import { reasonLabel } from '../lib/points'
import FishArt from '../components/FishArt'
import { fetchSpecies, type Species } from '../lib/species'
import { Link, useSearchParams } from 'react-router-dom'

type Tab = 'report' | 'map' | 'list'

export default function MyRecords() {
  const [params] = useSearchParams()
  const [tab, setTab] = useState<Tab>(params.get('tab') === 'list' ? 'list' : 'report')
  const [species, setSpecies] = useState<Species[]>([])
  useEffect(() => { fetchSpecies().then(setSpecies).catch(() => setSpecies([])) }, [])
  const codeOf = (name: string | null) => species.find(s => s.name_ko === name)?.code
  const [period, setPeriod] = useState<Period>('month')
  const [rows, setRows] = useState<LogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [balance, setBalance] = useState(0)
  const [score, setScore] = useState(0)
  const [ledger, setLedger] = useState<{ created_at: string; reason: string; amount: number }[]>([])

  useEffect(() => {
    setLoading(true); setErr('')
    fetchMyLogs(period).then(setRows).catch(e => setErr((e as Error).message)).finally(() => setLoading(false))
  }, [period])

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: b } = await supabase.from('point_balances').select('balance').eq('user_id', user.id).maybeSingle()
      setBalance(b?.balance ?? 0)
      const start = new Date(); start.setDate(1); start.setHours(0, 0, 0, 0)
      const { data: s } = await supabase.from('score_events').select('score').gte('created_at', start.toISOString())
      setScore((s ?? []).reduce((a, r: { score: number }) => a + r.score, 0))
      const { data: l } = await supabase.from('point_ledger').select('created_at,reason,amount').order('created_at', { ascending: false }).limit(20)
      setLedger(l ?? [])
    })()
  }, [])

  const rep = useMemo(() => buildReport(rows), [rows])

  return (
    <div className="page">
      <h1>내 기록</h1>

      <div className="chips" style={{ marginBottom: 8 }}>
        {(['report', 'map', 'list'] as Tab[]).map(t => (
          <button key={t} className={`chip ${tab === t ? 'on' : ''}`} onClick={() => setTab(t)}>
            {{ report: '리포트', map: '방문 지도', list: '목록' }[t]}
          </button>
        ))}
      </div>
      <div className="chips" style={{ marginBottom: 14 }}>
        {(['month', 'year', 'all'] as Period[]).map(p => (
          <button key={p} className={`chip ${period === p ? 'on' : ''}`} style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setPeriod(p)}>
            {{ month: '이번 달', year: '올해', all: '전체' }[p]}
          </button>
        ))}
      </div>

      {err && <p style={{ color: 'var(--danger)' }}>{err}</p>}
      {loading ? <p style={{ color: 'var(--mute)' }}>불러오는 중…</p> : rows.length === 0 ? (
        <div className="card" style={{ color: 'var(--mute)' }}>이 기간엔 기록이 없어요. 기록 탭에서 현위치를 찍고 첫 기록을 남겨보세요.</div>
      ) : tab === 'report' ? (
        <ReportView rep={rep} balance={balance} score={score} ledger={ledger} codeOf={codeOf} />
      ) : tab === 'map' ? (
        <HistoryMap rows={rows} />
      ) : (
        <div className="list">
          {rows.map(r => (
            <Link key={r.id} to={`/me/${r.id}`} className="card" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 0, textDecoration: 'none', color: 'var(--ink)' }}>
              {r.log_type === 'zero'
                ? <div className="score-box" style={{ width: 56, height: 34, background: 'var(--line-soft)', color: 'var(--mute)' }}>꽝</div>
                : <FishArt code={codeOf(r.species_name)} name={r.species_name ?? undefined} size={56} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="item-title">
                  {r.log_type === 'zero' ? '꽝' : `${r.species_name ?? ''} ${r.count}마리${r.size_cm ? ` · ${r.size_cm}cm` : ''}`}
                  {r.log_type === 'release' && ' (방생)'}
                </div>
                <div className="sub">
                  {new Date(r.caught_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' })} · {r.weather ?? ''}{r.temp_c != null ? ` ${r.temp_c}°C` : ''}
                  {r.method_label ? ` · ${r.method_label}` : ''}{r.bait_label ? `/${r.bait_label}` : ''}
                </div>
              </div>
              {r.log_type !== 'zero' && (r.share_url ? <span className="badge good">자랑글</span> : <span className="badge accent">자랑 +50P</span>)}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="card" style={{ marginBottom: 0 }}>
      <div className="label" style={{ margin: 0 }}>{label}</div>
      <div className="big" style={{ fontSize: 26 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--mute)' }}>{sub}</div>}
    </div>
  )
}

function Bars({ items, unit = '마리' }: { items: { name: string; fish: number; best?: number | null }[]; unit?: string }) {
  const max = Math.max(1, ...items.map(i => i.fish))
  if (!items.length) return <div style={{ color: 'var(--mute)', fontSize: 13 }}>아직 데이터가 없어요</div>
  return (
    <div>
      {items.map(i => (
        <div key={i.name} style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span>{i.name}{i.best != null ? <span style={{ color: 'var(--mute)' }}> · 최대 {i.best}cm</span> : null}</span>
            <b>{i.fish}{unit}</b>
          </div>
          <div style={{ height: 8, background: 'var(--box)', borderRadius: 4 }}>
            <div style={{ width: `${(i.fish / max) * 100}%`, height: '100%', background: 'var(--ink)', borderRadius: 4 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

/** 어종별 리포트: 일러스트 + 막대 */
function SpeciesBars({ items, codeOf }: { items: { name: string; fish: number; best?: number | null }[]; codeOf: (n: string) => string | undefined }) {
  const max = Math.max(1, ...items.map(i => i.fish))
  if (!items.length) return <div className="empty">아직 데이터가 없어요</div>
  return (
    <div className="list">
      {items.map((i, n) => (
        <div key={i.name} className="item" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <FishArt code={codeOf(i.name)} name={i.name} size={64} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="item-row">
              <span className="item-title">{n === 0 && <span className="badge accent" style={{ marginRight: 6 }}>최다</span>}{i.name}</span>
              <b className="num">{i.fish}마리</b>
            </div>
            <div style={{ height: 8, background: 'var(--line-soft)', borderRadius: 4, margin: '6px 0 4px' }}>
              <div style={{ width: `${(i.fish / max) * 100}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent), var(--accent-dark))', borderRadius: 4 }} />
            </div>
            {i.best != null && <div className="sub">최대 {i.best}cm</div>}
          </div>
        </div>
      ))}
    </div>
  )
}

function ReportView({ rep, balance, score, ledger, codeOf }: {
  rep: ReturnType<typeof buildReport>; balance: number; score: number
  ledger: { created_at: string; reason: string; amount: number }[]
  codeOf: (name: string | null) => string | undefined
}) {
  const zeroRate = rep.trips ? Math.round((rep.zeroDays / rep.trips) * 100) : 0
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
        <Stat label="출조" value={`${rep.trips}일`} sub={`방문 지점 ${rep.spots}곳`} />
        <Stat label="잡은 물고기" value={`${rep.fish}마리`} sub={rep.released ? `방생 ${rep.released}마리` : undefined} />
        <Stat label="꽝" value={`${rep.zeroDays}일`} sub={`꽝 비율 ${zeroRate}%`} />
        <Stat label="이달 스코어" value={score} sub={`포인트 ${balance.toLocaleString()}P`} />
      </div>

      <div className="card"><div className="card-title" style={{ marginBottom: 10 }}><span className="dot-mark" />어종별</div><SpeciesBars items={rep.bySpecies} codeOf={codeOf} /></div>
      <div className="card"><div className="label" style={{ marginTop: 0 }}>잘 잡힌 낚시 방법</div><Bars items={rep.byMethod} /></div>
      <div className="card"><div className="label" style={{ marginTop: 0 }}>잘 잡힌 미끼</div><Bars items={rep.byBait} /></div>
      {rep.byMonth.length > 1 && (
        <div className="card"><div className="label" style={{ marginTop: 0 }}>월별</div>
          <Bars items={rep.byMonth.map(m => ({ name: `${m.key.slice(2).replace('-', '.')} (${m.trips}일)`, fish: m.fish }))} />
        </div>
      )}

      <div className="label">포인트 적립 내역</div>
      {ledger.length === 0 && <div style={{ color: 'var(--mute)', fontSize: 13 }}>아직 적립 내역이 없어요</div>}
      {ledger.map((l, i) => (
        <div key={i} className="kv">
          <span>{new Date(l.created_at).toLocaleDateString('ko-KR')} {reasonLabel(l.reason)}</span>
          <b>{l.amount > 0 ? '+' : ''}{l.amount}P</b>
        </div>
      ))}
      <p style={{ fontSize: 12, color: 'var(--mute)' }}>포인트 사용처는 준비 중이에요. 지금 쌓은 포인트는 오픈 후 그대로 쓸 수 있어요.</p>
    </>
  )
}
