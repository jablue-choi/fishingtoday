import { supabase } from './supabase'

export type FishId = {
  is_fish: boolean
  species: string | null
  confidence: 'high' | 'medium' | 'low'
  candidates: { name: string; reason: string }[]
  note: string
  remaining: number
}

export const CONFIDENCE_LABEL: Record<FishId['confidence'], string> = { high: '확실해요', medium: '아마도', low: '잘 모르겠어요' }

/** 긴 변 1024px JPEG로 줄이기 (전송량·비용 절감, EXIF 위치정보도 빠짐) */
async function shrink(file: File, max = 1024): Promise<string> {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * scale)
  canvas.height = Math.round(bmp.height * scale)
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  bmp.close()
  const url = canvas.toDataURL('image/jpeg', 0.85)
  return url.slice(url.indexOf(',') + 1)
}

/** 사진 속 어종 후보. 결과는 추천일 뿐이고 선택은 사용자가 한다. */
export async function identifyFish(file: File): Promise<FishId> {
  const image = await shrink(file)
  const { data, error } = await supabase.functions.invoke<FishId & { error?: string }>('identify_fish', {
    body: { image, media_type: 'image/jpeg' },
  })
  if (error) {
    const status = (error as { context?: Response }).context?.status
    throw new Error(status === 429 ? '오늘 어종 확인 횟수를 다 썼어요. 내일 다시 써 주세요.' : '어종을 확인하지 못했어요. 직접 골라 주세요.')
  }
  if (!data || data.error) throw new Error('어종을 확인하지 못했어요. 직접 골라 주세요.')
  return data
}
