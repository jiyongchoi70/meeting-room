import { supabase } from '../lib/supabase'
import type { MrUser } from '../types'

export interface UserFilters {
  user_name?: string
  phone?: string
  user_type?: number | null
  join?: number | null
}

/** 전화번호 하이픈 제거 */
export function phoneWithoutHyphens(phone: string | null): string {
  if (!phone) return ''
  return String(phone).replace(/-/g, '')
}

/** 전화번호 포맷 (010-xxxx-xxxx) */
export function formatPhone(phone: string | null): string {
  const s = phoneWithoutHyphens(phone)
  if (s.length >= 10) return `${s.slice(0, 3)}-${s.slice(3, 7)}-${s.slice(7)}`
  if (s.length >= 7) return `${s.slice(0, 3)}-${s.slice(3, 7)}-${s.slice(7)}`
  if (s.length >= 4) return `${s.slice(0, 3)}-${s.slice(3)}`
  return s
}

/** 입력용: 숫자만 11자리, 입력 시 010-5 형태로 자동 포맷 */
export function formatPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
}

/** 사용자 목록 조회 (필터는 클라이언트에서 적용) */
export async function fetchUsers(): Promise<MrUser[]> {
  const { data, error } = await supabase
    .from('mr_users')
    .select('*')
    .order('user_name', { ascending: true })
  if (error) throw error
  const rows = (data ?? []) as MrUser[]
  return rows
}

/** 로그인 사용자 UID로 mr_users 한 건 조회 (관리자 버튼 노출 여부 등) */
export async function fetchMrUserByUid(userUid: string): Promise<MrUser | null> {
  const { data, error } = await supabase
    .from('mr_users')
    .select('*')
    .eq('user_uid', userUid)
    .maybeSingle()
  if (error) throw error
  return (data as MrUser) ?? null
}

/** 사용자 목록 필터링 (성명 LIKE, 전화 LIKE(하이픈 제거), 사용자구분, 가입/탈퇴) */
export function filterUsers(users: MrUser[], filters: UserFilters): MrUser[] {
  let list = users
  if (filters.user_name?.trim()) {
    const q = filters.user_name.trim()
    list = list.filter((u) => (u.user_name ?? '').includes(q))
  }
  if (filters.phone?.trim()) {
    const q = phoneWithoutHyphens(filters.phone)
    list = list.filter((u) => phoneWithoutHyphens(u.phone).includes(q))
  }
  if (filters.user_type != null) {
    const v = Number(filters.user_type)
    if (!Number.isNaN(v)) list = list.filter((u) => u.user_type === v)
  }
  if (filters.join != null) {
    const v = Number(filters.join)
    if (!Number.isNaN(v)) list = list.filter((u) => u.join === v)
  }
  return list
}

/** 회원가입 시 mr_users 행 삽입 (Auth UID → user_uid, 전화번호는 숫자만 저장) */
export async function insertMrUser(payload: {
  user_uid: string
  user_name: string | null
  phone: string | null
  email: string | null
  user_position: number | null
}): Promise<void> {
  const today = new Date()
  const ymd =
    String(today.getFullYear()) +
    String(today.getMonth() + 1).padStart(2, '0') +
    String(today.getDate()).padStart(2, '0')
  const { error } = await supabase.from('mr_users').insert({
    user_uid: payload.user_uid,
    user_name: payload.user_name || null,
    phone: payload.phone ? phoneWithoutHyphens(payload.phone) : null,
    email: payload.email || null,
    user_position: payload.user_position,
    create_ymd: ymd,
  })
  if (error) throw error
}

/** 사용자 수정 (성명/이메일 제외: 직분, 전화, 사용자구분, 가입탈퇴, 비고, update_user=로그인 UID) */
export async function updateUser(
  userUid: string,
  payload: {
    user_position: number | null
    phone: string | null
    user_type: number | null
    join: number | null
    remark: string | null
    update_user: string | null
  }
): Promise<void> {
  const today = new Date()
  const ymd =
    String(today.getFullYear()) +
    String(today.getMonth() + 1).padStart(2, '0') +
    String(today.getDate()).padStart(2, '0')
  const { error } = await supabase
    .from('mr_users')
    .update({
      user_position: payload.user_position,
      phone: payload.phone ? phoneWithoutHyphens(payload.phone) : null,
      user_type: payload.user_type,
      join: payload.join,
      remark: payload.remark ?? null,
      update_ymd: ymd,
      update_user: payload.update_user ?? null,
    })
    .eq('user_uid', userUid)
  if (error) throw error
}
