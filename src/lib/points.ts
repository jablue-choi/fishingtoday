import { supabase } from './supabase'

export type AwardResult = {
  awarded: { reason: string; amount: number }[]
  total: number
  balance: number
  capped: boolean
}

/** point_ledger.reason → 화면 표시 라벨 */
export const REASON_LABEL: Record<string, string> = {
  base_log: '기록', photo_verified: '사진 인증', first_visit: '첫 방문',
  release: '방생', zero_log: '꽝 기록', daily_cap_adjust: '하루 한도 조정', admin: '관리자',
}
export const reasonLabel = (reason: string) => REASON_LABEL[reason] ?? reason

/** 기록 저장 후 호출. 포인트 적립은 엣지 함수만 할 수 있다 (RLS). */
export async function awardPoints(catchLogId: string): Promise<AwardResult> {
  const { data, error } = await supabase.functions.invoke<AwardResult>('award_points', {
    body: { catch_log_id: catchLogId },
  })
  if (error) throw error
  return data!
}
