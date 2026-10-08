import type { RankRow } from '../lib/ranking'
import { shortRegion } from '../lib/ranking'

const MEDAL = ['var(--accent-hi)', '#B9C2CC', '#D9A37A']   // 1·2·3위 원 색

/** 랭킹 목록 한 줄씩. 내 순위는 강조 */
export default function RankingList({ rows }: { rows: RankRow[] }) {
  return (
    <div className="list">
      {rows.map(r => (
        <div key={`${r.rank}-${r.nickname}`} className="item" style={{ display: 'flex', alignItems: 'center', gap: 12, ...(r.is_me ? { outline: '2px solid var(--accent)' } : {}) }}>
          <div aria-label={`${r.rank}위`} style={{
            flex: '0 0 auto', width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 15, background: r.rank <= 3 ? MEDAL[r.rank - 1] : 'var(--surface)', color: r.rank <= 3 ? '#17181A' : 'var(--ink-2)',
          }}>{r.rank}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="item-title">{r.nickname}</span>
              {r.is_me && <span className="badge accent">나</span>}
              {r.is_sample && <span className="badge">샘플</span>}
            </div>
            <div className="sub">
              {r.fish}마리{r.best_species ? ` · ${r.best_species}${r.best_size ? ` ${r.best_size}cm` : ''}` : ''}{r.region ? ` · ${shortRegion(r.region)}` : ''}
            </div>
          </div>
          <div style={{ textAlign: 'right', flex: '0 0 auto' }}>
            <div style={{ fontWeight: 800, fontSize: 17 }}>{r.score.toLocaleString()}</div>
            <div className="sub">스코어</div>
          </div>
        </div>
      ))}
    </div>
  )
}
