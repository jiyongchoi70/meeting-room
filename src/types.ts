export interface MeetingRoom {
  id: string
  name: string
  capacity?: number
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
