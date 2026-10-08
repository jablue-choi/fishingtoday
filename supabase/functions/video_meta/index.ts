// supabase/functions/video_meta/index.ts
// 유튜브 링크 → 영상 id·제목·채널 (YouTube oEmbed, 키 없음). 브라우저 CORS 문제로 엣지 함수 경유
// 호출: POST { url }  응답: { video_id, title, author, thumbnail }

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/** youtube.com/watch?v=, youtu.be/, /shorts/, /embed/, /live/ 에서 11자리 id */
function videoId(raw: string): string | null {
  let u: URL
  try { u = new URL(raw.trim()) } catch { return null }
  const host = u.hostname.replace(/^www\.|^m\.|^music\./, '')
  let id: string | null = null
  if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0]
  else if (host === 'youtube.com') {
    id = u.searchParams.get('v')
    const m = u.pathname.match(/^\/(shorts|embed|live)\/([^/?#]+)/)
    if (!id && m) id = m[2]
  }
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const { url } = await req.json().catch(() => ({}))
    const id = typeof url === 'string' ? videoId(url) : null
    if (!id) return json({ error: 'not_youtube' }, 400)
    const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`)
    if (!res.ok) return json({ error: 'not_found', video_id: id }, 404)   // 비공개·삭제된 영상
    const o = await res.json()
    return json({
      video_id: id,
      title: String(o.title ?? '').slice(0, 200),
      author: String(o.author_name ?? '').slice(0, 100),
      thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}
