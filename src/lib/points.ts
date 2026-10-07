import { supabase } from './supabase'

export type AwardResult = {
  awarded: { reason: string; amount: number }[]
  total: number
  balance: number
  capped: boolean
}

/** 기록 저장 후 호출. 포인트 적립은 엣지 함수만 할 수 있다 (RLS). */
export async function awardPoints(catchLogId: string): Promise<AwardResult> {
  const { data, error } = await supabase.functions.invoke<AwardResult>('award_points', {
    body: { catch_log_id: catchLogId },
  })
  if (error) throw error
  return data!
}
