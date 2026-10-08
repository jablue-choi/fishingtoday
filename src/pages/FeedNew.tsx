import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { createFeed, uploadPhoto, videoMeta, FEED_KINDS, VIDEO_TAGS, type FeedKind, type VideoMeta } from '../lib/feed'
import { fetchSpecies, type Species } from '../lib/species'
import { myBlockStatus, blockText } from '../lib/moderation'
import { hasProfanity, PROFANITY_MSG } from '../lib/profanity'
import FishArt from '../components/FishArt'

/** 피드 글쓰기: 종류에 따라 장비 정보 / 레시피 / 유튜브 링크 */
export default function FeedNew() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const [kind, setKind] = useState<FeedKind>((FEED_KINDS.some(k => k.k === params.get('kind')) ? params.get('kind') : 'gear') as FeedKind)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [gear, setGear] = useState({ rod: '', reel: '', line: '', lure: '' })
  const [recipe, setRecipe] = useState({ ingredients: '', steps: '' })
  const [speciesCode, setSpeciesCode] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [url, setUrl] = useState('')
  const [video, setVideo] = useState<VideoMeta | null>(null)
  const [species, setSpecies] = useState<Species[]>([])
  const [block, setBlock] = useState<{ blocked: boolean; until: string | null; reason: string | null } | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { fetchSpecies().then(setSpecies).catch(() => setSpecies([])); myBlockStatus().then(setBlock) }, [])
  useEffect(() => { if (!photo) { setPreview(''); return } const u = URL.createObjectURL(photo); setPreview(u); return () => URL.revokeObjectURL(u) }, [photo])

  async function checkVideo() {
    setMsg(''); setVideo(null)
    try { const v = await videoMeta(url); setVideo(v); if (!title.trim()) setTitle(v.title.slice(0, 60)) }
    catch (e) { setMsg((e as Error).message) }
  }

  const allText = [title, body, ...Object.values(gear), ...Object.values(recipe)].join(' ')
  const bad = hasProfanity(allText)
  const ready = title.trim().length >= 2 && !bad && !block?.blocked && (kind !== 'video' || !!video) && !busy

  async function submit() {
    if (!ready) return
    setBusy(true); setMsg('')
    try {
      const photo_url = kind !== 'video' && photo ? await uploadPhoto(photo) : null
      const id = await createFeed({
        kind, title, body, photo_url, species_code: speciesCode || null, tags: kind === 'video' ? tags : [],
        gear: kind === 'gear' ? Object.fromEntries(Object.entries(gear).filter(([, v]) => v.trim())) : null,
        recipe: kind === 'recipe' ? Object.fromEntries(Object.entries(recipe).filter(([, v]) => v.trim())) : null,
        video_id: video?.video_id ?? null, video_title: video?.title ?? null, video_author: video?.author ?? null,
      })
      nav(`/feed/${id}`, { replace: true })
    } catch (e) { setMsg((e as Error).message) }
    finally { setBusy(false) }
  }

  const field = (label: string, value: string, set: (v: string) => void, ph: string) => (
    <><div className="label">{label}</div><input value={value} maxLength={80} onChange={e => set(e.target.value)} placeholder={ph} /></>
  )

  return (
    <div className="page">
      <h1>피드 글쓰기</h1>
      {block?.blocked && <div className="card plain error">{blockText(block)}</div>}
      <div className="choices" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))', marginBottom: 6 }}>
        {FEED_KINDS.map(k => <button key={k.k} className={`choice ${kind === k.k ? 'on' : ''}`} style={{ fontSize: 14 }} onClick={() => { setKind(k.k); setMsg('') }}>{k.label}</button>)}
      </div>
      <div className="note" style={{ marginTop: 0 }}>{FEED_KINDS.find(k => k.k === kind)!.desc}</div>

      {kind === 'video' && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="label" style={{ marginTop: 0 }}>유튜브 링크</div>
          <div className="row">
            <input type="url" inputMode="url" value={url} onChange={e => { setUrl(e.target.value); setVideo(null) }} placeholder="https://youtu.be/..." />
            <button className="btn dark" style={{ flex: '0 0 auto', width: 'auto', minHeight: 50, padding: '0 14px' }} disabled={!url.trim()} onClick={checkVideo}>불러오기</button>
          </div>
          {video && (
            <div className="item" style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center' }}>
              <img src={video.thumbnail} alt="" width={120} height={68} style={{ borderRadius: 8, objectFit: 'cover' }} />
              <div style={{ minWidth: 0 }}><div className="item-title">{video.title}</div><div className="sub">{video.author}</div></div>
            </div>
          )}
          <div className="label">태그 (최대 5개)</div>
          <div className="chips">{VIDEO_TAGS.map(t => <button key={t} className={`chip sm ${tags.includes(t) ? 'on' : ''}`} onClick={() => setTags(s => s.includes(t) ? s.filter(x => x !== t) : s.length < 5 ? [...s, t] : s)}>#{t}</button>)}</div>
        </div>
      )}

      <div className="label">제목</div>
      <input value={title} maxLength={60} onChange={e => setTitle(e.target.value)} placeholder={kind === 'gear' ? '예: 이번 시즌 주꾸미 장비' : kind === 'recipe' ? '예: 감성돔 밑밥 배합' : '영상 제목이 자동으로 들어가요'} />

      {kind !== 'video' && (
        <>
          <div className="label">사진 (선택)</div>
          <label className="btn ghost" style={{ minHeight: 46 }}>
            {photo ? '다른 사진 고르기' : '사진 고르기'}
            <input type="file" accept="image/*" hidden onChange={e => setPhoto(e.target.files?.[0] ?? null)} />
          </label>
          {preview && <img src={preview} alt="미리보기" style={{ width: '100%', borderRadius: 12, marginTop: 8, maxHeight: 260, objectFit: 'cover' }} />}
        </>
      )}

      {kind === 'gear' && (
        <>
          {field('로드', gear.rod, v => setGear(g => ({ ...g, rod: v })), '예: 다이와 에메랄다스 86M')}
          {field('릴', gear.reel, v => setGear(g => ({ ...g, reel: v })), '예: 시마노 뱅퀴시 2500')}
          {field('라인', gear.line, v => setGear(g => ({ ...g, line: v })), '예: PE 0.8호 + 쇼크리더 2호')}
          {field('루어·채비', gear.lure, v => setGear(g => ({ ...g, lure: v })), '예: 3.0호 에기')}
        </>
      )}
      {kind === 'recipe' && (
        <>
          <div className="label">재료</div>
          <textarea value={recipe.ingredients} maxLength={600} rows={3} onChange={e => setRecipe(r => ({ ...r, ingredients: e.target.value }))} placeholder="예: 크릴 3kg, 집어제 1봉, 빵가루 1봉" style={TA} />
          <div className="label">만드는 법</div>
          <textarea value={recipe.steps} maxLength={1000} rows={4} onChange={e => setRecipe(r => ({ ...r, steps: e.target.value }))} placeholder="순서대로 적어 주세요" style={TA} />
        </>
      )}

      {kind !== 'video' && (
        <>
          <div className="label">대상 어종 (선택)</div>
          <div className="chips">
            {species.filter(s => s.status !== 'user').map(s => (
              <button key={s.id} className={`chip sm ${speciesCode === s.code ? 'on' : ''}`} onClick={() => setSpeciesCode(c => (c === s.code ? '' : s.code))} style={{ paddingLeft: 4 }}>
                <FishArt code={s.code} size={22} />{s.name_ko}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="label">{kind === 'video' ? '한 줄 소개 (선택)' : '하고 싶은 말 (선택)'}</div>
      <textarea value={body} maxLength={2000} rows={3} onChange={e => setBody(e.target.value)} placeholder="자유롭게 적어 주세요" style={TA} />

      {bad && <div className="error" style={{ marginTop: 8 }}>{PROFANITY_MSG}</div>}
      {msg && <div className="card plain" style={{ marginTop: 10, fontSize: 14 }}>{msg}</div>}
      <button className="btn" style={{ marginTop: 16 }} disabled={!ready} onClick={submit}>{busy ? '올리는 중…' : '올리고 20P 받기'}</button>
      <div className="note">포인트는 하루 첫 글에만 쌓여요. 사진은 위치정보를 지우고 줄여서 올려요. 내가 찍은 사진·내가 만든 영상 위주로 올려 주세요.</div>
    </div>
  )
}

const TA: React.CSSProperties = { width: '100%', padding: 12, border: '1px solid var(--line)', borderRadius: 12, background: 'var(--surface)', color: 'var(--ink)', fontSize: 16, resize: 'vertical' }
