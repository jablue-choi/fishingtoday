import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { fetchRanking, PERIOD_LABEL, type RankPeriod, type RankRow } from '../lib/ranking'
import RankingList from '../components/RankingList'
import RegionFishCard from '../components/RegionFishCard'

/** 랭킹: 낚시왕(오늘·이번 주·이번 달) / 지역별 잘 잡히는 어종 */
export default function Ranking() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'region' ? 'region' : 'angler'
  const period = (['today', 'week', 'month'].includes(params.get('p') ?? '') ? params.get('p') : 'today') as RankPeriod
  const [rows, setRows] = useState<RankRow[] | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (tab !== 'angler') return
    setRows(null); setErr('')
    fetchRanking(period, 30).then(setRows).catch(e => setErr((e as Error).message))
  }, [period, tab])

  const top = rows?.filter(r => r.rank <= 30) ?? []
  const me = rows?.find(r => r.is_me && r.rank > 30)

  return (
    <div className="page">
      <h1>랭킹</h1>
      <div className="choices" style={{ marginBottom: 12 }}>
        <button className={`choice ${tab === 'angler' ? 'on' : ''}`} onClick={() => setParams({ tab: 'angler', p: period }, { replace: true })}>낚시왕</button>
        <button className={`choice ${tab === 'region' ? 'on' : ''}`} onClick={() => setParams({ tab: 'region' }, { replace: true })}>지역별 어종</button>
      </div>

      {tab === 'region' ? <RegionFishCard /> : (
        <>
          <div className="chips" style={{ marginBottom: 12 }}>
            {(Object.keys(PERIOD_LABEL) as RankPeriod[]).map(p => (
              <button key={p} className={`chip ${period === p ? 'on' : ''}`} onClick={() => setParams({ tab: 'angler', p }, { replace: true })}>{PERIOD_LABEL[p]}</button>
            ))}
          </div>

          {err && <div className="error">{err}</div>}
          {!rows && !err && <div className="empty">불러오는 중…</div>}
          {rows && top.length === 0 && (
            <div className="card plain empty">{PERIOD_LABEL[period]}은 아직 공개된 조과가 없어요. 첫 기록을 남기면 바로 1위예요.</div>
          )}
          {top.length > 0 && <div className="card"><div className="card-title" style={{ marginBottom: 10 }}>{PERIOD_LABEL[period]}의 낚시왕</div><RankingList rows={top} /></div>}
          {me && (
            <>
              <div className="or">내 순위</div>
              <RankingList rows={[me]} />
            </>
          )}

          <div className="note" style={{ marginTop: 16 }}>
            스코어 = 마릿수×5 + 가장 큰 크기×0.6 + 어종 난이도×4 + 방생 10점, 기록마다 더해요.
            공개한 기록만 들어가고, 하루 넘게 지나서 적은 기록과 관리자 등록 기록은 빠져요. 포인트와는 별개예요.
          </div>
        </>
      )}
    </div>
  )
}
