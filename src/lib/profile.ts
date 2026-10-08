import { supabase } from './supabase'

export type MyProfile = { id: string; nickname: string; nickname_set: boolean }

export async function fetchMyProfile(): Promise<MyProfile | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data, error } = await supabase.from('profiles').select('id,nickname,nickname_set').eq('id', user.id).single()
  if (error) throw error
  return data as MyProfile
}

export const NICK_RE = /^[가-힣A-Za-z0-9_]{2,12}$/

/** 닉네임 저장 (서버에서 형식·중복 다시 검사) */
export async function saveNickname(nickname: string): Promise<string> {
  const { data, error } = await supabase.rpc('set_nickname', { p_nickname: nickname.trim() })
  if (error) throw new Error(error.message)
  return data as string
}
