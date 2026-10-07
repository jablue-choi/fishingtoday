// supabase/functions/award_points/index.ts
// 호출: POST { catch_log_id }  (Authorization: Bearer <user jwt>)
// 역할: 기록 하나에 대해 적립 가능한 포인트를 계산해서 point_ledger에 쓰고,
//       스코어를 score_events에 기록한다. 클라이언트는 원장에 직접 못 쓴다(RLS).

import { createClient } from 'npm:@supabase/supabase-js@2'

const DAILY_CAP = 200

type Rule = { reason: string; amount: number }
type Awarded = { reason: string; amount: number }

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  const authHeader = req.headers.get('Authorization') ?? ''
  const { catch_log_id } = await req.json().catch(() => ({}))
  if (!catch_log_id) return json({ error: 'catch_log_id required' }, 400)

  // 1) 호출자 확인 — anon 키 + 유저 JWT로 auth.getUser
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )
  const { data: { user }, error: uErr } = await userClient.auth.getUser()
  if (uErr || !user) return json({ error: 'unauthorized' }, 401)

  // 2) 이후 작업은 service_role (RLS 우회)
  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: log, error: lErr } = await db
    .from('catch_logs')
    .select('id,user_id,spot_id,log_type,species_id,size_cm,count,method_code,bait_code,caught_at,verified')
    .eq('id', catch_log_id)
    .single()
  if (lErr || !log) return json({ error: 'log not found' }, 404)
  if (log.user_id !== user.id) return json({ error: 'not your log' }, 403)

  const { data: rulesRows } = await db.from('point_rules').select('reason,amount')
  const rules = Object.fromEntries((rulesRows ?? []).map((r: Rule) => [r.reason, r.amount]))

  // 3) 적립 후보 계산
  const candidates: Awarded[] = []

  if (log.log_type === 'zero') {
    candidates.push({ reason: 'zero_log', amount: rules.zero_log ?? 5 })
  } else {
    const checksComplete =
      !!log.species_id && log.size_cm != null && !!log.count && !!log.method_code && !!log.bait_code

    if (checksComplete) candidates.push({ reason: 'base_log', amount: rules.base_log ?? 20 })

    // 사진 인증: exif_ok = true 인 사진이 1장 이상
    const { count: okPhotos } = await db
      .from('catch_photos')
      .select('id', { count: 'exact', head: true })
      .eq('catch_log_id', log.id)
      .eq('exif_ok', true)

    if (checksComplete && (okPhotos ?? 0) > 0) {
      candidates.push({ reason: 'photo_verified', amount: rules.photo_verified ?? 30 })
      if (!log.verified) await db.from('catch_logs').update({ verified: true }).eq('id', log.id)
    }

    // 방생 기록
    if (log.log_type === 'release') {
      candidates.push({ reason: 'release', amount: rules.release ?? 30 })
    }

    // 첫 방문: 이 spot에 내 다른 기록이 없을 때
    if (log.spot_id && checksComplete) {
      const { count: prev } = await db
        .from('catch_logs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('spot_id', log.spot_id)
        .neq('id', log.id)
      if ((prev ?? 0) === 0) candidates.push({ reason: 'first_visit', amount: rules.first_visit ?? 10 })
    }
  }

  // 4) 일일 상한 (KST 기준 오늘)
  const kstNow = new Date(Date.now() + 9 * 3600 * 1000)
  const kstStart = new Date(Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate()) - 9 * 3600 * 1000)
  const { data: todayRows } = await db
    .from('point_ledger')
    .select('amount')
    .eq('user_id', user.id)
    .gt('amount', 0)
    .gte('created_at', kstStart.toISOString())
  const todaySum = (todayRows ?? []).reduce((s: number, r: { amount: number }) => s + r.amount, 0)
  let room = Math.max(0, DAILY_CAP - todaySum)

  const awarded: Awarded[] = []
  let capped = false
  for (const c of candidates) {
    if (room <= 0) { capped = true; break }
    const amt = Math.min(c.amount, room)
    if (amt < c.amount) capped = true
    awarded.push({ reason: c.reason, amount: amt })
    room -= amt
  }

  // 5) 원장 insert — (user_id, reason, ref_id) 유니크라 재호출해도 중복 적립 안 됨
  if (awarded.length) {
    const { error: iErr } = await db.from('point_ledger').insert(
      awarded.map(a => ({
        user_id: user.id, amount: a.amount, reason: a.reason,
        ref_type: 'catch_log', ref_id: log.id,
      })),
    )
    // 23505 = unique_violation → 이미 적립됨. 에러로 보지 않고 넘어감.
    if (iErr && !String(iErr.code).includes('23505')) return json({ error: iErr.message }, 500)
  }

  // 6) 스코어 (포인트와 별개)
  if (log.log_type !== 'zero') {
    const { data: sp } = await db.from('species').select('difficulty').eq('id', log.species_id).maybeSingle()
    const breakdown = {
      count: (log.count ?? 0) * 5,
      size: Math.round((log.size_cm ?? 0) * 0.6),
      difficulty: (sp?.difficulty ?? 1) * 4,
      release: log.log_type === 'release' ? 10 : 0,
    }
    const score = Object.values(breakdown).reduce((a, b) => a + b, 0)
    await db.from('score_events').upsert(
      { user_id: user.id, catch_log_id: log.id, score, breakdown },
      { onConflict: 'catch_log_id', ignoreDuplicates: true },
    )
  }

  const { data: bal } = await db.from('point_balances').select('balance').eq('user_id', user.id).maybeSingle()

  return json({
    awarded,
    total: awarded.reduce((s, a) => s + a.amount, 0),
    balance: bal?.balance ?? 0,
    capped,
  })
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
}
