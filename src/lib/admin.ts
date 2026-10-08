import { supabase } from './supabase'

let cache: Promise<boolean> | null = null
/** 관리자 여부 (admins 테이블). 실패하면 false */
export function isAdmin(): Promise<boolean> {
  if (!cache) cache = Promise.resolve(supabase.rpc('is_admin')).then(({ data, error }) => !error && data === true)
  return cache
}

export const SOURCE_TYPES = [
  { k: 'boat', label: '선사 제공' },
  { k: 'shop', label: '낚시점 제공' },
  { k: 'partner', label: '제휴처 제공' },
  { k: 'admin_check', label: '관리자 직접 확인' },
  { k: 'public_data', label: '공공데이터' },
  { k: 'etc', label: '기타' },
] as const
export type SourceType = typeof SOURCE_TYPES[number]['k']
export const sourceLabel = (k: string | null) => SOURCE_TYPES.find(s => s.k === k)?.label ?? '기타'
