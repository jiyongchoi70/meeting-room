export interface MeetingRoom {
  id: string
  name: string
  capacity?: number
}

/** 예약 화면용 회의실 (end_ymd: 해당 회의실 예약 가능 마감일 YYYYMMDD) */
export interface RoomForReservation extends MeetingRoom {
  end_ymd: string
}

export interface ReservationEvent {
  id: string
  title: string
  start: string // ISO date string
  end: string
  roomId: string
  roomName: string
  booker?: string
  extendedProps?: {
    isAllDay?: boolean
    color?: string
  }
}

/** 대분류 (공통코드) */
export interface LookupType {
  lookup_type_id: number
  lookup_type_cd: number
  lookup_type_nm: string
}

/** 중분류 (공통코드) */
export interface LookupValue {
  lookup_value_id: number
  lookup_type_id: number
  lookup_value_cd: number
  lookup_value_nm: string
  remark: string | null
  seq: number | null
  start_ymd: string | null
  end_ymd: string | null
  create_ymd: string | null
}

/** 사용자 (mr_users) */
export interface MrUser {
  user_uid: string
  user_name: string | null
  user_position: number | null
  email: string | null
  phone: string | null
  user_type: number | null
  join: number | null
  remark: string | null
  create_ymd: string | null
  update_ymd: string | null
  update_user: string | null
}

/** 회의실 (mr_room) */
export interface MrRoom {
  room_id: string
  room_nm: string
  duplicate_yn: number | null
  reservation_available: number | null
  reservation_ymd: string | null
  /** 현재일로부터 예약가능 일수 (reservation_available=110일 때) */
  reservation_cnt: number | null
  confirm_yn: number | null
  cnt: number | null
  remark: string | null
  seq: number | null
  create_ymd: string | null
  update_ymd: string | null
}

/** 회의실별 승인자 (mu_approver) */
export interface MuApprover {
  approver_id: number
  room_id: string
  user_uid: string
}
