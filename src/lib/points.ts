import { supabase } from './supabase'

export type AwardResult = {
  awarded: { reason: string; amount: number }[]
  total: number
  balance: number
  capped: boolean
  late?: boolean   // 지난 기록이라 포인트 없음
  brag_skipped?: 'already' | 'zero' | 'no_url' | 'reused' | null
}

/** 자랑글 링크를 붙인 뒤 호출. 기록당 1회 50P */
export async function awardBrag(catchLogId: string): Promise<AwardResult> {
  const { data, error } = await supabase.functions.invoke<AwardResult>('award_points', {
    body: { catch_log_id: catchLogId, action: 'brag' },
  })
  if (error) throw error
  return data!
}

/** point_ledger.reason → 화면 표시 라벨 */
export const REASON_LABEL: Record<string, string> = {
  base_log: '기록', photo_verified: '사진 인증', first_visit: '첫 방문',
  release: '방생', zero_log: '꽝 기록', brag_link: '자랑글', place_note: '장소 제보', feed_post: '피드 글', daily_cap_adjust: '하루 한도 조정', admin: '관리자',
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
