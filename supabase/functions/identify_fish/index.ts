// supabase/functions/identify_fish/index.ts
// 사진으로 어종 후보 추정 (Claude 비전). 결과는 '추천'일 뿐, 선택·저장은 사용자가 한다.
// 호출: POST { image: base64(jpeg/png/webp, 앱에서 1024px 이하로 줄여서), media_type }
// 응답: { is_fish, species, confidence, candidates: [{ name, reason }], note, remaining }
//
// 시크릿: ANTHROPIC_API_KEY (필수), FISH_ID_DAILY_LIMIT (선택, 기본 20)

import Anthropic from 'npm:@anthropic-ai/sdk'
import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const MEDIA = ['image/jpeg', 'image/png', 'image/webp']
const MAX_B64 = 2_000_000   // 약 1.5MB 이미지

const anthropic = new Anthropic()   // ANTHROPIC_API_KEY

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'unauthorized' }, 401)

    const { image, media_type = 'image/jpeg' } = await req.json().catch(() => ({}))
    if (typeof image !== 'string' || !image) return json({ error: 'image required' }, 400)
    if (!MEDIA.includes(media_type)) return json({ error: 'unsupported media_type' }, 400)
    if (image.length > MAX_B64) return json({ error: 'image too large' }, 413)

    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // 하루 호출 제한 (KST 자정 기준)
    const limit = Number(Deno.env.get('FISH_ID_DAILY_LIMIT') ?? 20)
    const kstMidnight = new Date(Math.floor((Date.now() + 9 * 3600e3) / 864e5) * 864e5 - 9 * 3600e3).toISOString()
    const { count: used } = await db.from('fish_id_usage').select('id', { count: 'exact', head: true })
      .eq('user_id', user.id).gte('created_at', kstMidnight)
    if ((used ?? 0) >= limit) return json({ error: 'daily_limit', remaining: 0 }, 429)

    const { data: sp } = await db.from('species').select('name_ko,name_std,water_type').order('id')
    const names = (sp ?? []).map((s) => s.name_ko as string)
    const speciesList = (sp ?? []).map((s) => `${s.name_ko}${s.name_std && s.name_std !== s.name_ko ? `(${s.name_std})` : ''}`).join(', ')

    const schema = {
      type: 'object',
      additionalProperties: false,
      required: ['is_fish', 'species', 'confidence', 'candidates', 'note'],
      properties: {
        is_fish: { type: 'boolean', description: '사진에 물고기·두족류 등 낚시 대상 생물이 보이는지' },
        species: { anyOf: [{ type: 'string', enum: names }, { type: 'null' }], description: '목록 중 가장 가능성 높은 어종. 목록에 없거나 판단 불가면 null' },
        confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        candidates: {
          type: 'array',
          description: '가능성 순 후보 최대 3개 (목록 안의 이름만)',
          items: {
            type: 'object', additionalProperties: false, required: ['name', 'reason'],
            properties: { name: { type: 'string', enum: names }, reason: { type: 'string', description: '구별 근거 한 문장, 한국어 ~해요체' } },
          },
        },
        note: { type: 'string', description: '사용자에게 보여줄 짧은 한 문장 (한국어 ~해요체). 목록에 없는 어종으로 보이면 그 이름을 여기에' },
      },
    }

    const response = await anthropic.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema } },
      system:
        '한국 바다·민물 낚시 기록 앱의 어종 판별 도우미예요. 사진 속 낚시 대상 생물의 종을 아래 목록 안에서 고르세요. ' +
        '비슷한 종(우럭/볼락/노래미, 광어/도다리, 주꾸미/낙지, 갑오징어/무늬오징어 등)은 형태 근거로 구별하고, 확실하지 않으면 confidence를 낮추세요. ' +
        '목록에 없는 종이면 species는 null로 두고 note에 추정 이름을 적으세요. 크기나 금어기 판단은 하지 마세요.\n' +
        `어종 목록: ${speciesList}`,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type, data: image } },
          { type: 'text', text: '이 사진 속 어종을 판별해 주세요.' },
        ],
      }],
    })

    if (response.stop_reason === 'refusal') return json({ error: 'refused' }, 422)
    const text = response.content.find((b) => b.type === 'text')
    if (!text || text.type !== 'text') return json({ error: 'no_result' }, 502)
    const result = JSON.parse(text.text)

    await db.from('fish_id_usage').insert({ user_id: user.id, species: result.species, confidence: result.confidence })
    return json({ ...result, remaining: Math.max(0, limit - (used ?? 0) - 1) })
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: 'busy' }, 503)
    if (e instanceof Anthropic.APIError) return json({ error: 'ai_error', status: e.status }, 502)
    return json({ error: String(e) }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}
