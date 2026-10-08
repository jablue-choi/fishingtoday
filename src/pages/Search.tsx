import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { searchUnified, searchRecent, summarizePlaces, getRecent, pushRecent, clearRecent, distKm, type PubRow, type SearchResult } from '../lib/search'
import { getLastPos } from '../lib/fishingIndex'
import { siteName } from '../lib/brag'
import { searchPlaces } from '../lib/kakaoMap'
import { fetchSpecies, type Species } from '../lib/species'
import HistoryMap from '../components/HistoryMap'
import FishingIndexCard from '../components/FishingIndexCard'
import SeasonCard from '../components/SeasonCard'
import FishArt from '../components/FishArt'
import Icon from '../components/Icon'
import type { LogRow } from '../lib/records'
import { Link } from 'react-router-dom'
import { searchPosts, ago, type Post } from '../lib/community'
import { useGuardClick } from '../lib/auth'

type Tab = 'search' | 'recommend'
const SPECIES_HINT = ['우럭', '주꾸미', '갑오징어', '감성돔', '광어', '고등어']
const REGION_HINT = ['대부도', '태안', '속초', '여수', '제주']

/** 검색: 한 칸에 지역·어종을 섞어 입력 ('속초 우럭'). 추천은 최근 2주 조황 */
export default function Search() {
  const [params] = useSearchParams()
  const [tab, setTab] = useState<Tab>(params.get('mode') === 'recommend' ? 'recommend' : 'search')
  const [q, setQ] = useState(params.get('q') ?? '')
  const [species, setSpecies] = useState<Species[]>([])
  const [res, setRes] = useState<SearchResult | null>(null)
  const [rows, setRows] = useState<PubRow[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [recent, setRecent] = useState(getRecent)
  const [view, setView] = useState<'list' | 'map'>('list')
  const [me] = useState(getLastPos)
  const [sort, setSort] = useState<'score' | 'near'>('score')
  const [comm, setComm] = useState<Post[] | null>(null)
  const guard = useGuardClick()

  const names = useMemo(() => species.map(s => s.name_ko), [species])
  const speciesReady = useMemo(() => fetchSpecies().then(l => { setSpecies(l); return l.map(s => s.name_ko) }).catch(() => [] as string[]), [])

  async function run(kw: string = q) {
    const v = kw.trim()
    if (!v) return
    setLoading(true); setErr(''); setQ(v)
    try {
      const r = await searchUnified(v, names.length ? names : await speciesReady, async p => (await searchPlaces(p))[0] ?? null)
      setRes(r); setRows(r.rows)
      setComm(null)
      searchPosts(r.parsed.species, r.parsed.region).then(setComm).catch(() => setComm([]))
      pushRecent(v); setRecent(getRecent())
    } catch (e) { setErr((e as Error).message) }
    finally { setLoading(false) }
  }

  async function runRecommend() {
    setLoading(true); setErr(''); setRes(null)
    try { setRows(await searchRecent()) } catch (e) { setErr((e as Error).message) }
    finally { setLoading(false) }
  }

  // 주소(?q=)로 들어오면 바로 검색 (홈 제철 카드 등). ?mode=recommend면 추천 탭
  useEffect(() => {
    if (params.get('mode') === 'recommend') { setTab('recommend'); return }
    const kw = params.get('q')
    if (kw) { setTab('search'); run(kw) }
  }, [params]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (tab === 'recommend') runRecommend(); else { setRows(res?.rows ?? null) } }, [tab]) // eslint-disable-line react-hooks/exhaustive-deps

  const places = useMemo(() => {
    const list = summarizePlaces(rows ?? []).map(p => ({ ...p, dist: me ? distKm(me, p) : null }))
    return sort === 'near' && me ? [...list].sort((a, b) => a.dist! - b.dist!) : list
  }, [rows, me, sort])
  const asLogRows = useMemo(() => (rows ?? []).map(r => ({ ...r, lat: Number(r.lat), lon: Number(r.lon) })) as unknown as LogRow[], [rows])
  const hasSample = rows?.some(r => r.is_sample)
  const codeOf = (n: string) => species.find(s => s.name_ko === n)?.code

  return (
    <div className="page">
      <h1>검색</h1>
      <div className="chips" style={{ marginBottom: 12 }}>
        <button className={`chip ${tab === 'search' ? 'on' : ''}`} onClick={() => setTab('search')}>검색</button>
        <button className={`chip ${tab === 'recommend' ? 'on' : ''}`} onClick={() => setTab('recommend')}>추천</button>
      </div>

      {tab === 'search' && (
        <>
          <form className="search-field" role="search" onSubmit={e => { e.preventDefault(); run() }} style={{ marginBottom: 12 }}>
            <Icon name="search" size={20} />
            <input type="search" autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="지역·어종 (예: 속초 우럭, 주꾸미)" aria-label="지역·어종 검색" enterKeyHint="search" />
            <button type="submit" disabled={!q.trim()}>검색</button>
          </form>

          {/* 검색어를 어떻게 알아들었는지 */}
          {res && !loading && (
            <div className="chips" style={{ marginBottom: 10 }}>
              {res.parsed.region && <span className="badge ink">지역 · {res.near ? `${res.near.name} 근처 ${res.near.km}km` : res.parsed.region}</span>}
              {res.parsed.species.map(s => <span key={s} className="badge accent">어종 · {s}</span>)}
            </div>
          )}

          {!rows && !loading && (
            <>
              {recent.length > 0 && (
                <div className="card">
                  <div className="card-head">
                    <div className="card-title" style={{ fontSize: 15 }}>최근 검색</div>
                    <button className="chip sm" onClick={() => { clearRecent(); setRecent([]) }}>지우기</button>
                  </div>
                  <div className="chips">
                    {recent.map(r => <button key={r} className="chip sm" onClick={() => run(r)}>{r}</button>)}
                  </div>
                </div>
              )}
              <div className="card">
                <div className="card-head"><div className="card-title" style={{ fontSize: 15 }}>이렇게 찾아보세요</div></div>
                <div className="label" style={{ marginTop: 0 }}>어종</div>
                <div className="chips">
                  {SPECIES_HINT.map(s => (
                    <button key={s} className="chip sm" onClick={() => run(s)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <FishArt code={codeOf(s)} size={24} />{s}
                    </button>
                  ))}
                </div>
                <div className="label">지역</div>
                <div className="chips">{REGION_HINT.map(s => <button key={s} className="chip sm" onClick={() => run(s)}>{s}</button>)}</div>
                <div className="note">지역과 어종을 같이 적어도 돼요. 예: 태안 주꾸미</div>
              </div>
            </>
          )}
        </>
      )}

      {tab === 'recommend' && (
        <>
          <SeasonCard />
          <FishingIndexCard title="오늘 지수 좋은 바다 포인트" nationwide limit={5} />
          <div className="card-head" style={{ marginTop: 8 }}><div className="card-title">오늘낚시 사용자 최근 2주 조황</div></div>
        </>
      )}

      {err && <div className="error">{err}</div>}
      {loading && <div className="empty">찾는 중…</div>}

      {tab === 'search' && !loading && comm && comm.length > 0 && (
        <div className="card">
          <div className="card-head">
            <div className="card-title"><span style={{ color: 'var(--accent)', display: 'inline-flex' }}><Icon name="chat" size={16} /></span>대화방 글</div>
            <Link to="/community" className="more">대화방<Icon name="chevron" size={12} /></Link>
          </div>
          <div className="list">
            {comm.map(p => (
              <Link key={p.id} to={`/community/post/${p.id}`} onClick={guard} className="item" style={{ textDecoration: 'none', color: 'var(--ink)' }}>
                <div style={{ fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.body}</div>
                <div className="sub">
                  {p.tags?.map(t => <span key={t} style={{ color: 'var(--accent-ink)', fontWeight: 700, marginRight: 6 }}>#{t}</span>)}
                  {p.region ? `${p.region} · ` : ''}{ago(p.created_at)} · 댓글 {p.comment_count}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {rows && !loading && (
        rows.length === 0 ? (
          <div className="card plain empty">
            {tab === 'search' && res && !res.parsed.region && !res.parsed.species.length
              ? '검색어를 알아듣지 못했어요. 지역이나 어종 이름으로 찾아보세요.'
              : '공개된 기록이 아직 없어요. 다른 지역이나 어종으로 찾아보세요.'}
          </div>
        ) : (
          <>
            <div className="item-row" style={{ marginBottom: 8 }}>
              <div className="sub">{tab === 'recommend' ? '최근 2주 공개 조황' : `기록 ${rows.length}건`} · 지역 {places.length}곳</div>
              <div className="chips" style={{ flexWrap: 'nowrap' }}>
                <button className={`chip sm ${view === 'list' ? 'on' : ''}`} onClick={() => setView('list')}>목록</button>
                <button className={`chip sm ${view === 'map' ? 'on' : ''}`} onClick={() => setView('map')}>지도</button>
              </div>
            </div>
            {hasSample && <div className="note" style={{ marginTop: 0, marginBottom: 8 }}>개발용 샘플 데이터가 포함돼 있어요.</div>}

            {view === 'list' && (
              me ? (
                <div className="chips" style={{ marginBottom: 10 }}>
                  <button className={`chip sm ${sort === 'score' ? 'on' : ''}`} onClick={() => setSort('score')}>조황 좋은 순</button>
                  <button className={`chip sm ${sort === 'near' ? 'on' : ''}`} onClick={() => setSort('near')}>가까운 순</button>
                </div>
              ) : (
                <div className="note" style={{ marginTop: 0, marginBottom: 10 }}>기록 화면에서 현위치를 한 번 찍으면 내 위치와의 거리도 보여 드려요.</div>
              )
            )}

            {view === 'map' ? <HistoryMap rows={asLogRows} /> : places.slice(0, 20).map((p, i) => (
              <div key={p.key} className="card">
                <div className="item-row" style={{ alignItems: 'baseline' }}>
                  <b>{tab === 'recommend' && sort === 'score' && i < 3 ? `${i + 1}. ` : ''}{p.region}</b>
                  {p.dist != null
                    ? <span className="badge ink">내 위치에서 {p.dist < 10 ? p.dist.toFixed(1) : Math.round(p.dist)}km</span>
                    : <span className="sub">{new Date(p.last).toLocaleDateString('ko-KR')}</span>}
                </div>
                {p.dist != null && <div className="sub">최근 기록 {new Date(p.last).toLocaleDateString('ko-KR')}</div>}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                  {p.species.length ? p.species.map(([n, c]) => (
                    <span key={n} className="item" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px 4px 6px', fontSize: 13, fontWeight: 700 }}>
                      <FishArt code={codeOf(n)} size={28} />{n} {c}마리
                    </span>
                  )) : <span className="sub">조과 없음</span>}
                </div>
                <div className="sub" style={{ marginTop: 6 }}>
                  기록 {p.logs}건{p.zero ? ` (꽝 ${p.zero})` : ''}
                  {p.method ? ` · 많이 잡힌 방법 ${p.method}` : ''}{p.bait ? `/${p.bait}` : ''}
                </div>
                {p.brags.length > 0 && (
                  <div className="chips" style={{ marginTop: 8 }}>
                    {p.brags.map(b => (
                      <a key={b.url} className="chip sm" href={b.url} target="_blank" rel="noopener noreferrer nofollow ugc" style={{ textDecoration: 'none' }}>
                        {b.nickname}님의 {siteName(b.url)}
                      </a>
                    ))}
                  </div>
                )}
                {p.admin > 0 && (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }}>
                    <span className="badge ink">관리자 등록 {p.admin === p.logs ? '' : `${p.admin}건`}</span>
                    <span className="sub">출처: {p.sources.slice(0, 2).join(', ')}{p.sources.length > 2 ? ` 외 ${p.sources.length - 2}곳` : ''}</span>
                  </div>
                )}
              </div>
            ))}
          </>
        )
      )}
    </div>
  )
}
