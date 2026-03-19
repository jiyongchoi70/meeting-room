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
    /** 반복 구분 (lookup 160, 100=반복없음) */
    recurrenceCd?: number | null
    /** 반복 종료일 YYYYMMDD (RECURRENCE_NONE_CD(100) 이외일 때 필수) */
    recurrenceEndYmd?: string | null
    /** DB 예약 PK (수정 시 update 호출용) */
    reservationId?: string
    /** 반복 그룹 ID (삭제 시 이 일정/이후/전체 선택용) */
    repeatGroupId?: string | null
    /** 시작일 YYYY-MM-DD (이후 일정 삭제 시 비교용) */
    startYmd?: string
    /** 예약 신청자 user_uid (이동 가능 여부: 로그인 유저와 같을 때만 이동 허용) */
    createUser?: string
    /** 결재상태 (110 신청, 120 승인, 130 반려). 반려(130)인 경우 이동 불가 */
    status?: number
    /** 예약자 표시용: 이름, 직분, 연락처 (모달에서 즉시 표시) */
    bookerName?: string
    bookerPositionName?: string
    bookerPhone?: string
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

/** 회의실별 승인자 (mr_approver) */
export interface MrApprover {
  approver_id: number
  room_id: string
  user_uid: string
}

/** 예약 원본 (mr_reservations) */
export interface MrReservation {
  reservation_id: string
  title: string
  room_id: string
  allday_yn: string | null
  start_ymd: string
  end_ymd: string
  repeat_id: string | null
  repeat_end_ymd: string | null
  repeat_cycle: number | null
  repeat_user: string | null
  sun_yn: string | null
  mon_yn: string | null
  tue_yn: string | null
  wed_yn: string | null
  thu_yn: string | null
  fri_yn: string | null
  sat_yn: string | null
  repeat_condition: string | null
  repeat_group_id?: string | null
  status: number | null
  approver: string | null
  return_comment?: string | null
  create_user: string
  create_at: string | null
  update_at: string | null
}

/** 예약현황 그리드용 행 (조인·포맷 후) */
export interface ReservationRow {
  reservation_id: string
  title: string
  room_id: string
  room_nm: string
  allday_yn: string
  start_ymd: string
  end_ymd: string
  start_date_time: string
  end_date_time: string
  applicant_name: string
  applicant_position_nm?: string
  applicant_phone?: string
  approver_name: string
  create_user: string
  repeat_yn: string
  repeat_group_id?: string | null
  status: number | null
  status_nm: string
  /** 결재 100 + repeat_cycle null 일 때만 true (일괄승인/반려 선택 가능) */
  selectable: boolean
}
