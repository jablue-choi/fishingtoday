import { Link } from 'react-router-dom'
import { PLACE_TYPES } from '../lib/places'
import Icon from './Icon'

/** 홈: 주변 편의시설 바로가기 (화장실·낚시점·미끼·맛집) + 피드 */
export default function NearbyFacilities() {
  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title"><span style={{ color: 'var(--accent)', display: 'inline-flex' }}><Icon name="pin" size={16} /></span>주변 편의시설</div>
        <span className="sub">제보하면 +10P</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 6 }}>
        {PLACE_TYPES.map(t => (
          <Link key={t.k} to={`/places?type=${t.k}`} className="item" style={{ textAlign: 'center', textDecoration: 'none', color: 'var(--ink)', fontWeight: 800, fontSize: 13, padding: '12px 4px' }}>{t.label}</Link>
        ))}
      </div>
      <Link to="/feed" className="btn ghost" style={{ marginTop: 10, minHeight: 44 }}>장비 자랑 · 미끼 레시피 · 영상 피드</Link>
    </div>
  )
}
