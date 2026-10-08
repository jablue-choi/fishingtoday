import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { searchPublic, summarizePlaces, getRecent, pushRecent, clearRecent, type Mode, type PubRow } from '../lib/search'
import HistoryMap from '../components/HistoryMap'
import FishingIndexCard from '../components/FishingIndexCard'
import SeasonCard from '../components/SeasonCard'
import type { LogRow } from '../lib/records'

const MODES: { k: Mode; label: string; ph: string }[] = [
  { k: 'region', label: '지역', ph: '예: 대부도, 태안, 여수' },
  { k: 'species', label: '어종', ph: '예: 우럭, 주꾸미, 감성돔' },
  { k: 'recommend', label: '추천', ph: '최근 2주 조황 좋은 곳' },
]
const SPECIES_HINT = ['우럭', '주꾸미', '갑오징어', '감성돔', '광어', '망둥어', '고등어', '무늬오징어']

export default function Search() {
  const [params] = useSearchParams()
  const [mode, setMode] = useState<Mode>((params.get('mode') as Mode) || 'region')
  const [q, setQ] = useState(params.get('q') ?? '')
  const [rows, setRows] = useState<PubRow[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [recent, setRecent] = useState(getRecent())
  const [view, setView] = useState<'list' | 'map'>('list')

  async function run(m: Mode = mode, kw: string = q) {
    setLoading(true); setErr('')
    try {
      setRows(await searchPublic(m, kw))
      if (m !== 'recommend') { pushRecent(m, kw); setRecent(getRecent()) }
    } catch (e) { setErr((e as Error).message) }
    finally { setLoading(false) }
  }

  // 주소(?mode=&q=)로 들어오면 바로 검색. 검색 화면 안에서 추천 카드를 눌러도 다시 실행
  useEffect(() => {
    const m = (params.get('mode') as Mode) || mode
    const kw = params.get('q')
    if (!kw) return
    setMode(m); setQ(kw); run(m, kw)
  }, [params]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (mode === 'recommend') run('recommend', '') }, [mode]) // eslint-disable-line react-hooks/exhaustive-deps

  const places = useMemo(() => summarizePlaces(rows ?? []), [rows])
  const asLogRows = useMemo(() => (rows ?? []).map(r => ({ ...r, lat: Number(r.lat), lon: Number(r.lon) })) as unknown as LogRow[], [rows])
  const hasSample = rows?.some(r => r.is_sample)

  return (
    <div className="page">
      <h1>검색</h1>
      <div className="chips" style={{ marginBottom: 10 }}>
        {MODES.map(m => (
          <button key={m.k} className={`chip ${mode === m.k ? 'on' : ''}`} onClick={() => { setMode(m.k); setRows(null) }}>{m.label}</button>
        ))}
      </div>

      {mode !== 'recommend' && (
        <div className="row" style={{ marginBottom: 10 }}>
          <input
            autoFocus value={q} onChange={e => setQ(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && run()}
            placeholder={MODES.find(m => m.k === mode)!.ph}
            style={{ flex: 3, padding: '12px 14px', borderRadius: 12, border: '1.5px solid var(--line)', fontSize: 15 }}
          />
          <button className="btn" style={{ flex: 1 }} onClick={() => run()}>검색</button>
        </div>
      )}

      {mode === 'species' && !rows && (
        <div className="chips" style={{ marginBottom: 12 }}>
          {SPECIES_HINT.map(s => <button key={s} className="chip" onClick={() => { setQ(s); run('species', s) }}>{s}</button>)}
        </div>
      )}

      {!rows && mode !== 'recommend' && recent.length > 0 && (
        <div className="card">
          <div className="row" style={{ alignItems: 'center' }}>
            <div className="label" style={{ margin: 0 }}>최근 검색</div>
            <button className="chip" style={{ flex: 0, fontSize: 11 }} onClick={() => { clearRecent(); setRecent([]) }}>지우기</button>
          </div>
          <div className="chips" style={{ marginTop: 8 }}>
            {recent.map((r, i) => (
              <button key={i} className="chip" onClick={() => { setMode(r.mode); setQ(r.q); run(r.mode, r.q) }}>
                {r.mode === 'species' ? '🐟 ' : '📍 '}{r.q}
              </button>
            ))}
          </div>
        </div>
      )}

      {mode === 'recommend' && <SeasonCard />}
      {mode === 'recommend' && <FishingIndexCard title="오늘 지수 좋은 바다 포인트" nationwide limit={5} />}
      {mode === 'recommend' && <div className="label">오늘낚시 사용자 최근 2주 조황</div>}

      {err && <p style={{ color: '#B8531E' }}>{err}</p>}
      {loading && <p style={{ color: 'var(--mute)' }}>찾는 중…</p>}

      {rows && !loading && (
        rows.length === 0 ? (
          <div className="card" style={{ color: 'var(--mute)' }}>공개된 기록이 아직 없어요. 다른 지역이나 어종으로 찾아보세요.</div>
        ) : (
          <>
            <div className="row" style={{ alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 13, color: 'var(--mute)' }}>
                {mode === 'recommend' ? '최근 2주 공개 조황 기준' : `기록 ${rows.length}건`} · 지역 {places.length}곳
              </div>
              <div className="chips" style={{ flex: 0, flexWrap: 'nowrap' }}>
                <button className={`chip ${view === 'list' ? 'on' : ''}`} onClick={() => setView('list')}>목록</button>
                <button className={`chip ${view === 'map' ? 'on' : ''}`} onClick={() => setView('map')}>지도</button>
              </div>
            </div>
            {hasSample && <div style={{ fontSize: 11, color: 'var(--mute)', marginBottom: 8 }}>개발용 샘플 데이터가 포함돼 있어요.</div>}

            {view === 'map' ? <HistoryMap rows={asLogRows} /> : places.slice(0, 20).map((p, i) => (
              <div key={p.key} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <b>{mode === 'recommend' && i < 3 ? `${i + 1}. ` : ''}{p.region}</b>
                  <span style={{ fontSize: 12, color: 'var(--mute)' }}>{new Date(p.last).toLocaleDateString('ko-KR')}</span>
                </div>
                <div style={{ fontSize: 13, marginTop: 4 }}>
                  {p.species.length ? p.species.map(([n, c]) => `${n} ${c}마리`).join(' · ') : '조과 없음'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--mute)', marginTop: 2 }}>
                  기록 {p.logs}건{p.zero ? ` (꽝 ${p.zero})` : ''}
                  {p.method ? ` · 많이 잡힌 방법 ${p.method}` : ''}{p.bait ? `/${p.bait}` : ''}
                </div>
              </div>
            ))}
          </>
        )
      )}
    </div>
  )
}
