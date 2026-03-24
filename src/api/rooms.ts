import { supabase } from '../lib/supabase'
import type { MrRoom, MrApprover, RoomForReservation } from '../types'

function todayYmd(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

/** 날짜에 일수 더한 뒤 YYYYMMDD 반환 */
function addDaysYmd(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

/** 예약가능일 공통코드: 170 = 특정일 */
const RESERVATION_SPECIFIC_DATE_CD = 170

/** YYYY-MM-DD → YYYYMMDD */
export function toYmd(s: string): string {
  return s.replace(/-/g, '')
}

/** 회의실 목록 조회 (seq 기준 정렬) */
export async function fetchRooms(): Promise<MrRoom[]> {
  const { data, error } = await supabase
    .from('mr_room')
    .select('*')
    .order('seq', { ascending: true, nullsFirst: true })
  if (error) {
    console.error('[fetchRooms]', error.message)
    throw new Error(error.message || '회의실 조회 실패')
  }
  return (data ?? []) as MrRoom[]
}

/** 회의실 추가 */
export async function insertRoom(payload: {
  room_nm: string
  duplicate_yn: number | null
  reservation_available: number | null
  reservation_ymd: string | null
  reservation_cnt: number | null
  confirm_yn: number | null
  cnt: number | null
  remark: string | null
  seq: number | null
}): Promise<MrRoom> {
  const row = {
    room_nm: payload.room_nm,
    duplicate_yn: payload.duplicate_yn,
    reservation_available: payload.reservation_available,
    reservation_ymd: payload.reservation_ymd,
    reservation_cnt: payload.reservation_cnt ?? null,
    confirm_yn: payload.confirm_yn,
    cnt: payload.cnt,
    remark: payload.remark ?? null,
    seq: payload.seq ?? null,
    create_ymd: todayYmd(),
    update_ymd: todayYmd(),
  }
  const { data, error } = await supabase.from('mr_room').insert(row).select().single()
  if (error) throw error
  return data as MrRoom
}

/** 회의실 수정 */
export async function updateRoom(
  roomId: string,
  payload: {
    room_nm: string
    duplicate_yn: number | null
    reservation_available: number | null
    reservation_ymd: string | null
    reservation_cnt: number | null
    confirm_yn: number | null
    cnt: number | null
    remark: string | null
    seq: number | null
  }
): Promise<void> {
  const { error } = await supabase
    .from('mr_room')
    .update({
      room_nm: payload.room_nm,
      duplicate_yn: payload.duplicate_yn,
      reservation_available: payload.reservation_available,
      reservation_ymd: payload.reservation_ymd,
      reservation_cnt: payload.reservation_cnt ?? null,
      confirm_yn: payload.confirm_yn,
      cnt: payload.cnt,
      remark: payload.remark ?? null,
      seq: payload.seq ?? null,
      update_ymd: todayYmd(),
    })
    .eq('room_id', roomId)
  if (error) throw error
}

/** 회의실 삭제 */
export async function deleteRoom(roomId: string): Promise<void> {
  const { error } = await supabase.from('mr_room').delete().eq('room_id', roomId)
  if (error) throw error
}

/** 로그인 사용자가 mr_approver에 1건 이상 등록되어 있는지 (관리자 메뉴 노출 조건용) */
export async function fetchUserHasApproverRecord(userUid: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('mr_approver')
    .select('approver_id')
    .eq('user_uid', userUid)
    .limit(1)
  if (error) {
    console.error('[fetchUserHasApproverRecord]', error.message)
    return false
  }
  return (data ?? []).length > 0
}

/** 회의실별 승인자 목록 조회 (room_id 목록에 대해) */
export async function fetchApproversByRoomIds(roomIds: string[]): Promise<MrApprover[]> {
  if (roomIds.length === 0) return []
  const { data, error } = await supabase
    .from('mr_approver')
    .select('*')
    .in('room_id', roomIds)
  if (error) {
    console.error('[fetchApproversByRoomIds]', error.message)
    return []
  }
  return (data ?? []) as MrApprover[]
}

/** 한 회의실의 승인자 저장 (기존 삭제 후 일괄 삽입) */
export async function saveApprovers(roomId: string, userUids: string[]): Promise<void> {
  const { error: delError } = await supabase.from('mr_approver').delete().eq('room_id', roomId)
  if (delError) throw delError
  if (userUids.length === 0) return
  const rows = userUids.map((user_uid) => ({ room_id: roomId, user_uid }))
  const { error: insError } = await supabase.from('mr_approver').insert(rows)
  if (insError) throw insError
}

/** 예약 화면용 회의실 목록 (예약가능일 필터 + end_ymd 계산) */
export async function fetchRoomsForReservation(): Promise<RoomForReservation[]> {
  const list = await fetchRooms()
  const today = todayYmd()
  return list
    .filter((r) => {
      if (r.reservation_available !== RESERVATION_SPECIFIC_DATE_CD) return true
      return r.reservation_ymd != null && r.reservation_ymd >= today
    })
    .map((r) => {
      const end_ymd =
        r.reservation_available === RESERVATION_SPECIFIC_DATE_CD
          ? (r.reservation_ymd ?? today)
          : addDaysYmd(r.reservation_cnt ?? 0)
      return {
        id: r.room_id,
        name: r.room_nm,
        capacity: r.cnt ?? undefined,
        end_ymd,
      }
    })
}
