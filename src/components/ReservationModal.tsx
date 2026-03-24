import { useState, useEffect, useRef } from 'react'
import type { MeetingRoom, ReservationEvent } from '../types'
import type { LookupValue } from '../types'
import { fetchLookupValuesByTypeCd, normalizeDateTo4DigitYear } from '../api/lookup'
import { fetchMrUserByUid, formatPhone } from '../api/users'

const LOOKUP_RECURRENCE = 160 // 반복 (반복없음, 매일, 매주 등)
const LOOKUP_RECURRENCE_CYCLE = 170 // 반복 주기 단위 (일, 주, 월)
const LOOKUP_POSITION = 130 // 직분 (예약자 정보용)

function getLookupName(
  options: LookupValue[],
  valueCd: number | null,
  dateYmd: string | null
): string {
  if (valueCd == null) return ''
  const ymd = (dateYmd ?? '').replace(/\D/g, '')
  const v = options.find((o) => o.lookup_value_cd === valueCd)
  if (!v) return ''
  if (ymd && v.start_ymd && String(v.start_ymd).replace(/-/g, '') > ymd) return ''
  if (ymd && v.end_ymd && String(v.end_ymd).replace(/-/g, '') < ymd) return ''
  return v.lookup_value_nm
}
/** 요일 버튼 순서: 월 ~ 일 (사용자 설정 인라인용) */
const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']
/** 매월 n번째 요일: 주차 옵션 (다음 조건으로 반복) */
const MONTHLY_ORDINAL_LABELS = ['첫째 주', '둘째 주', '셋째 주', '넷째 주', '다섯째 주']
/** 반복없음: 이 값(100)일 때만 날짜선택 비필수·숨김. 100 이외의 값은 날짜선택 필수 */
const RECURRENCE_NONE_CD = 100
/** 사용자 설정: 선택 시 반복 사용자 설정 모달 표시 (lookup_value_cd=150) */
const RECURRENCE_CUSTOM_CD = 150
/** 매주 */
const RECURRENCE_WEEKLY_CD = 130
/** 매월 */
const RECURRENCE_MONTHLY_CD = 140

const DAY_NAMES_KO = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']

/** mr_reservations.status → 표시 텍스트 */
const RESERVATION_STATUS_LABELS: Record<number, string> = {
  110: '신청',
  120: '승인',
  130: '반려',
  140: '완료',
}
function getReservationStatusLabel(status: number | undefined | null): string {
  if (status == null) return ''
  return RESERVATION_STATUS_LABELS[status] ?? ''
}

function validateRecurrenceEndDate(
  recurrenceCd: number,
  startDate: Date,
  recurrenceEndDateStr: string
): string | null {
  if (!recurrenceEndDateStr.trim()) return null
  const end = new Date(recurrenceEndDateStr)
  if (Number.isNaN(end.getTime())) return null
  const startYmd = formatDateLocal(startDate)
  if (startDate.getFullYear() < 1000) return '시작일을 연도 4자리(YYYY-MM-DD) 형식으로 입력해 주세요.'
  if (recurrenceEndDateStr < startYmd) return '시작일보다 이전 날짜는 선택할 수 없습니다.'
  if (recurrenceCd === RECURRENCE_WEEKLY_CD) {
    if (end.getDay() !== startDate.getDay()) {
      const dayName = DAY_NAMES_KO[startDate.getDay()]
      return `시작일(${startYmd})이 ${dayName}이면 매주 ${dayName}만 선택 할 수 있습니다.`
    }
  }
  if (recurrenceCd === RECURRENCE_MONTHLY_CD) {
    if (end.getDate() !== startDate.getDate()) {
      const day = startDate.getDate()
      return `시작일(${startYmd})이면 매월 (${day}일)만 선택 할 수 있습니다.`
    }
  }
  return null
}

interface ReservationModalProps {
  isOpen: boolean
  initialDate?: Date | null
  initialEvent?: ReservationEvent | null
  rooms: MeetingRoom[]
  /** 로그인 사용자 UID. 예약자와 같을 때만 삭제 버튼 표시 */
  currentUserUid?: string | null
  onClose: () => void
  onSave: (data: {
    title: string
    start: Date
    end: Date
    roomId: string
    roomName: string
    booker?: string
    recurrenceCd?: number | null
    recurrenceEndYmd?: string | null
    isAllDay?: boolean
    /** 반복 주기 수 (사용자설정 시) */
    cycleNumber?: number
    /** 반복 주기 단위 lookup 170 (1일 2주 3월) */
    cycleUnitCd?: number | null
    /** 요일 선택 [일,월,화,수,목,금,토] 사용자설정+주 */
    selectedDays?: boolean[]
    /** "넷째 주 수요일" 형태, 사용자설정+개월 */
    repeatCondition?: string | null
  }) => void
  /** 삭제 시 호출. reservationId 전달 후 모달은 호출 측에서 닫기 */
  onDelete?: (reservationId: string) => void | Promise<void>
  /** 반복 일정 삭제 시 호출 (이 일정 / 이 일정 및 향후 / 모든 일정) */
  onDeleteRecurring?: (payload: {
    reservationId: string
    repeatGroupId: string
    startYmd: string
    scope: 'this' | 'thisAndFollowing' | 'all'
  }) => void | Promise<void>
  /** 관리자 여부. status=110일 때 승인/반려 버튼 노출 조건 */
  isAdmin?: boolean
  /** 해당 예약의 회의실 승인자 여부. status=110일 때 승인/반려 버튼 노출 조건 */
  isApproverForRoom?: boolean
  /** true면 예약 조회 전용(저장·삭제·승인/반려 없음). 예: mr_users.join=130 */
  viewOnly?: boolean
  /** 승인 클릭 시 (reservationId, repeatGroupId?) */
  onApprove?: (reservationId: string, repeatGroupId?: string | null) => void | Promise<void>
  /** 반려 클릭 시 반려 사유 입력 후 (reservationId, repeatGroupId?, returnComment) */
  onReject?: (
    reservationId: string,
    repeatGroupId?: string | null,
    returnComment?: string
  ) => void | Promise<void>
}

function formatDateLocal(date: Date): string {
  const y = date.getFullYear()
  const m = (date.getMonth() + 1).toString().padStart(2, '0')
  const d = date.getDate().toString().padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** type="date" value로 쓸 수 있는지 검사 (빈 문자열 또는 yyyy-MM-dd) */
function isValidYyyyMmDd(str: string): boolean {
  if (str === '') return true
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false
  const d = new Date(str)
  return !Number.isNaN(d.getTime())
}

/** 월 01 입력 시 브라우저가 10으로 보내는 경우 보정: 이전 값이 'yyyy-0'이고 현재가 'yyyy-10' 또는 'yyyy-10-01'이면 'yyyy-01'로 간주 */
function correctMonth01From10(
  currentVal: string,
  prevVal: string | null
): string {
  if (!currentVal || !prevVal) return currentVal
  const prevTrim = prevVal.trim()
  const m = currentVal.match(/^(\d{4})-10(-01)?$/)
  if (!m) return currentVal
  const isMonthOnly = prevTrim.match(/^\d{4}-0$/)
  if (isMonthOnly) return m[2] ? `${m[1]}-01-01` : `${m[1]}-01`
  return currentVal
}

/** 부분 입력(예: 2026-0, 2026-02, 202701)을 type="date"에 넣을 수 있는 유효한 yyyy-MM-dd로 보정. 월 첫자리 0 입력 시에도 표시 유지 */
function partialDateToDisplay(partial: string, fallback: string): string {
  if (!partial || !partial.trim()) return fallback
  const digitsOnly = partial.replace(/\D/g, '')
  if (digitsOnly.length >= 6) {
    const yyyy = digitsOnly.slice(0, 4)
    const mm = digitsOnly.slice(4, 6)
    const dd = digitsOnly.length >= 8 ? digitsOnly.slice(6, 8) : '01'
    const mmNum = parseInt(mm, 10)
    const ddNum = parseInt(dd, 10)
    if (mmNum >= 1 && mmNum <= 12 && ddNum >= 1 && ddNum <= 31) {
      const built = `${yyyy}-${mm}-${dd}`
      if (isValidYyyyMmDd(built)) return built
    }
  }
  const parts = partial.trim().split('-').map((p) => p.replace(/\D/g, ''))
  const y = parts[0] ?? ''
  const m = parts[1] ?? ''
  const d = parts[2] ?? ''
  if (y.length < 4) return fallback
  const yyyy = y.slice(0, 4)
  let mm = '01'
  if (m.length === 1) mm = m === '0' ? '01' : m.padStart(2, '0')
  else if (m.length >= 2) mm = m.slice(0, 2).padStart(2, '0')
  const mmNum = parseInt(mm, 10)
  if (mmNum < 1 || mmNum > 12) mm = '01'
  else mm = mm.padStart(2, '0')
  let dd = '01'
  if (d.length === 1) dd = d === '0' ? '01' : d.padStart(2, '0')
  else if (d.length >= 2) dd = d.slice(0, 2).padStart(2, '0')
  const ddNum = parseInt(dd, 10)
  if (ddNum < 1 || ddNum > 31) dd = '01'
  else dd = dd.padStart(2, '0')
  const built = `${yyyy}-${mm}-${dd}`
  return isValidYyyyMmDd(built) ? built : fallback
}

function formatTime(date: Date): string {
  const h = date.getHours()
  const m = date.getMinutes()
  const ampm = h < 12 ? 'AM' : 'PM'
  const hour = h % 12 || 12
  return `${ampm} ${hour.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

function parseTime(str: string, base: Date): Date {
  const match = str.match(/(AM|PM)\s*(\d{1,2}):(\d{2})/)
  if (!match) return base
  const [, ampm, h, m] = match
  let hour = parseInt(h, 10)
  if (ampm === 'PM' && hour !== 12) hour += 12
  if (ampm === 'AM' && hour === 12) hour = 0
  const d = new Date(base)
  d.setHours(hour, parseInt(m, 10), 0, 0)
  return d
}

const TIME_OPTIONS = (() => {
  const opts: string[] = []
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const ampm = h < 12 ? 'AM' : 'PM'
      const hour = h % 12 || 12
      opts.push(`${ampm} ${hour.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`)
    }
  }
  return opts
})()

export type DeleteRecurringScope = 'this' | 'thisAndFollowing' | 'all'

export default function ReservationModal({
  isOpen,
  initialDate,
  initialEvent,
  rooms,
  currentUserUid,
  onClose,
  onSave,
  onDelete,
  onDeleteRecurring,
  isAdmin,
  isApproverForRoom,
  onApprove,
  onReject,
  viewOnly = false,
}: ReservationModalProps) {
  const baseDate = initialDate || new Date()
  const [title, setTitle] = useState(initialEvent?.title ?? '')
  const [startDate, setStartDate] = useState(baseDate)
  const [endDate, setEndDate] = useState(baseDate)
  const [startDateInput, setStartDateInput] = useState<string | null>(null)
  const [endDateInput, setEndDateInput] = useState<string | null>(null)
  const [startTimeStr, setStartTimeStr] = useState('AM 9:00')
  const [endTimeStr, setEndTimeStr] = useState('AM 10:00')
  const [roomId, setRoomId] = useState('')
  const [isAllDay, setIsAllDay] = useState(initialEvent?.extendedProps?.isAllDay ?? false)
  const [recurrenceOptions, setRecurrenceOptions] = useState<LookupValue[]>([])
  const [recurrenceCd, setRecurrenceCd] = useState<number | null>(null)
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('') // YYYY-MM-DD, RECURRENCE_NONE_CD(100) 이외일 때 필수
  const [recurrenceEndDateInput, setRecurrenceEndDateInput] = useState<string | null>(null)
  const prevRecurrenceEndInputRef = useRef<string | null>(null)
  const [recurrenceEndError, setRecurrenceEndError] = useState<string | null>(null)
  /** 사용자 설정 인라인: 주기 숫자, 주기 단위 옵션/선택값, 요일 선택 */
  const [cycleNumber, setCycleNumber] = useState(1)
  const [cycleOptions, setCycleOptions] = useState<LookupValue[]>([])
  const [cycleUnitCd, setCycleUnitCd] = useState<number | null>(null)
  const [selectedDays, setSelectedDays] = useState<boolean[]>(
    () => [false, false, false, false, false, false, false]
  )
  /** 사용자 설정·개월: 매월 n번째 요일 (ordinal 1~5: 첫째~넷째·마지막, dayOfWeek 0~6: 일~토) */
  const [monthlyOrdinal, setMonthlyOrdinal] = useState(1)
  const [monthlyDayOfWeek, setMonthlyDayOfWeek] = useState(3)
  const skipNextSyncRef = useRef(false)
  /** 수정 모드일 때 예약 작성자 정보 (mr_users 기준: 작성자, 직분, 연락처) */
  const [bookerInfo, setBookerInfo] = useState<{
    authorName: string
    positionName: string
    phone: string
  } | null>(null)
  const prevStartDateInputRef = useRef<string | null>(null)
  const prevEndDateInputRef = useRef<string | null>(null)
  /** 반복 일정 삭제 팝업: 열림 여부, 선택 범위 */
  const [deleteRecurringOpen, setDeleteRecurringOpen] = useState(false)
  const [deleteRecurringScope, setDeleteRecurringScope] = useState<DeleteRecurringScope>('this')
  /** 반려 팝업: 열림 여부, 반려 사유 입력, 검증 에러 */
  const [rejectPopupOpen, setRejectPopupOpen] = useState(false)
  const [rejectComment, setRejectComment] = useState('')
  const [rejectCommentError, setRejectCommentError] = useState<string | null>(null)

  /** 반복 옵션 조회 (lookup 160) */
  useEffect(() => {
    if (!isOpen) return
    const today = new Date().toISOString().slice(0, 10)
    fetchLookupValuesByTypeCd(LOOKUP_RECURRENCE, { validAt: today })
      .then(setRecurrenceOptions)
      .catch(() => setRecurrenceOptions([]))
  }, [isOpen])

  /** 반복 주기 단위 옵션 조회 (lookup 170, 사용자 설정 인라인용) */
  useEffect(() => {
    if (!isOpen) return
    const today = new Date().toISOString().slice(0, 10)
    fetchLookupValuesByTypeCd(LOOKUP_RECURRENCE_CYCLE, { validAt: today })
      .then((list) => {
        setCycleOptions(list)
        if (list.length > 0) {
          setCycleUnitCd((prev) => (prev == null ? list[0].lookup_value_cd : prev))
        }
      })
      .catch(() => setCycleOptions([]))
  }, [isOpen])

  /** 수정 모드: 예약 작성자(create_user) 기준 mr_users + lookup 130 직분 조회 (캘린더에서 미리 채운 경우는 스킵) */
  useEffect(() => {
    if (!isOpen || !initialEvent?.extendedProps?.createUser) {
      setBookerInfo(null)
      return
    }
    const ep = initialEvent.extendedProps
    if (ep.bookerName != null || ep.bookerPositionName != null || ep.bookerPhone != null) {
      return
    }
    const createUserUid = ep.createUser
    if (!createUserUid) return
    let cancelled = false
    fetchMrUserByUid(createUserUid)
      .then((user) => {
        if (cancelled || !user) {
          setBookerInfo(null)
          return
        }
        const ymdDigits = (user.create_ymd ?? '').replace(/\D/g, '')
        const validAt =
          ymdDigits.length >= 8
            ? `${ymdDigits.slice(0, 4)}-${ymdDigits.slice(4, 6)}-${ymdDigits.slice(6, 8)}`
            : new Date().toISOString().slice(0, 10)
        return fetchLookupValuesByTypeCd(LOOKUP_POSITION, { validAt }).then((positionOptions) => ({
          user,
          positionOptions,
        }))
      })
      .then((result) => {
        if (cancelled || !result) return
        const { user, positionOptions } = result
        if (cancelled || !user) {
          setBookerInfo(null)
          return
        }
        const positionName = getLookupName(
          positionOptions,
          user.user_position ?? null,
          user.create_ymd
        )
        setBookerInfo({
          authorName: user.user_name ?? '',
          positionName,
          phone: formatPhone(user.phone),
        })
      })
      .catch(() => {
        if (!cancelled) setBookerInfo(null)
      })
    return () => {
      cancelled = true
    }
  }, [isOpen, initialEvent?.extendedProps?.createUser])

  /** 시작일·종료일이 다르면 반복은 반복없음만 표시; 표시할 옵션 목록 (종일과는 무관) */
  const isStartEndSameDay =
    formatDateLocal(startDate) === formatDateLocal(endDate)
  const showOnlyRecurrenceNone = !isStartEndSameDay

  /** lookup에서 '반복없음' 옵션 코드 (달력·일 까지 숨김 조건용, DB 코드가 100이 아닐 수 있음) */
  const noRecurrenceCd =
    recurrenceOptions.find((o) =>
      /반복\s*없음/.test(String(o.lookup_value_nm).trim())
    )?.lookup_value_cd ?? RECURRENCE_NONE_CD

  /** 수정 모드에서 DB에 반복 설정이 있으면 해당 옵션도 포함 (종일+시작일≠종료일이어도 반복 표시) */
  const loadedRecurrenceCd = initialEvent?.extendedProps?.recurrenceCd
  const visibleRecurrenceOptions = showOnlyRecurrenceNone
    ? (() => {
        const base = recurrenceOptions.filter((o) => o.lookup_value_cd === noRecurrenceCd)
        if (
          loadedRecurrenceCd != null &&
          Number(loadedRecurrenceCd) !== noRecurrenceCd &&
          !base.some((o) => o.lookup_value_cd === loadedRecurrenceCd)
        ) {
          const extra = recurrenceOptions.find((o) => Number(o.lookup_value_cd) === Number(loadedRecurrenceCd))
          if (extra) return [extra, ...base]
        }
        return base
      })()
    : recurrenceOptions

  /** 반복 주기 단위가 '개월'인지 (lookup_value_nm에 '개월' 또는 '월' 포함) */
  const isCycleUnitMonth =
    cycleUnitCd != null &&
    /개월|^월$/.test(
      String(cycleOptions.find((o) => o.lookup_value_cd === cycleUnitCd)?.lookup_value_nm ?? '')
    )

  /** 사용자 설정 + 개월 선택 시: 시작일 기준으로 '다음 조건으로 반복'(n번째 요일) 자동 설정 */
  useEffect(() => {
    if (!isOpen || recurrenceCd !== RECURRENCE_CUSTOM_CD || !isCycleUnitMonth) return
    setMonthlyOrdinal(getMonthlyOrdinalFromDate(startDate))
    setMonthlyDayOfWeek(startDate.getDay())
  }, [isOpen, recurrenceCd, isCycleUnitMonth, startDate.getTime()])


  /** 시작일·종료일이 다를 때 반복을 반복없음으로 고정. 수정 모드에서 DB에 반복 설정이 있으면 덮어쓰지 않음 */
  useEffect(() => {
    if (!isOpen) return
    if (showOnlyRecurrenceNone && recurrenceCd !== noRecurrenceCd) {
      if (loadedRecurrenceCd != null && Number(loadedRecurrenceCd) !== noRecurrenceCd) return
      setRecurrenceCd(noRecurrenceCd)
      setRecurrenceEndDate('')
      setRecurrenceEndDateInput(null)
      prevRecurrenceEndInputRef.current = null
      setRecurrenceEndError(null)
    }
  }, [isOpen, showOnlyRecurrenceNone, recurrenceCd, noRecurrenceCd, loadedRecurrenceCd])

  /** 새 예약 시 반복 옵션 로드 후 '반복없음'으로 초기화. 수정 시 recurrenceCd가 없으면 첫 번째 옵션으로 설정 */
  useEffect(() => {
    if (!isOpen || visibleRecurrenceOptions.length === 0) return
    if (recurrenceCd == null) {
      setRecurrenceCd(
        initialEvent != null
          ? visibleRecurrenceOptions[0].lookup_value_cd
          : noRecurrenceCd
      )
    }
  }, [isOpen, initialEvent, visibleRecurrenceOptions, noRecurrenceCd])

  useEffect(() => {
    if (!isOpen) return
    setStartDateInput(null)
    setEndDateInput(null)
    setRecurrenceEndDateInput(null)
    prevStartDateInputRef.current = null
    prevEndDateInputRef.current = null
    prevRecurrenceEndInputRef.current = null
    const d = initialDate || new Date()
    if (initialEvent) {
      setTitle(initialEvent.title)
      setStartDate(new Date(initialEvent.start))
      setEndDate(new Date(initialEvent.end))
      setStartTimeStr(formatTime(new Date(initialEvent.start)))
      setEndTimeStr(formatTime(new Date(initialEvent.end)))
      setRoomId(initialEvent.roomId)
      setIsAllDay(!!initialEvent.extendedProps?.isAllDay)
      setRecurrenceCd(initialEvent.extendedProps?.recurrenceCd ?? null)
      const endYmd = initialEvent.extendedProps?.recurrenceEndYmd
      if (endYmd) {
        const s = String(endYmd).replace(/-/g, '')
        setRecurrenceEndDate(
          s.length === 8 ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : ''
        )
      } else {
        setRecurrenceEndDate('')
      }
      setRecurrenceEndError(null)
      // 예약자: 캘린더에서 미리 채워둔 extendedProps가 있으면 즉시 표시(화면 오픈 시 함께 나오도록)
      const ep = initialEvent.extendedProps
      const loadedRc = ep?.recurrenceCd
      if (loadedRc != null && Number(loadedRc) === RECURRENCE_CUSTOM_CD) {
        if (ep?.cycleNumber != null && !Number.isNaN(Number(ep.cycleNumber))) {
          setCycleNumber(Math.max(1, Number(ep.cycleNumber)))
        } else {
          setCycleNumber(1)
        }
        if (ep?.cycleUnitCd != null && !Number.isNaN(Number(ep.cycleUnitCd))) {
          setCycleUnitCd(Number(ep.cycleUnitCd))
        }
        if (Array.isArray(ep?.selectedDays) && ep.selectedDays.length === 7) {
          setSelectedDays(ep.selectedDays.map((v) => !!v))
        } else {
          setSelectedDays([false, false, false, false, false, false, false])
        }
      } else {
        setCycleNumber(1)
        setSelectedDays([false, false, false, false, false, false, false])
      }
      if (ep?.bookerName != null || ep?.bookerPositionName != null || ep?.bookerPhone != null) {
        setBookerInfo({
          authorName: ep.bookerName ?? '',
          positionName: ep.bookerPositionName ?? '',
          phone: ep.bookerPhone ?? '',
        })
      } else {
        setBookerInfo(null)
      }
    } else {
      // 주/일 뷰에서 시간대 클릭 시: 클릭한 시각 사용. 월 뷰·만들기 클릭 시: 당일 + 현재 시각
      const hasClickedTime = d.getHours() !== 0 || d.getMinutes() !== 0
      const now = new Date()
      const nearest = hasClickedTime
        ? new Date(d.getTime())
        : new Date(
            d.getFullYear(),
            d.getMonth(),
            d.getDate(),
            now.getHours(),
            now.getMinutes(),
            0,
            0
          )
      nearest.setMinutes(Math.ceil(nearest.getMinutes() / 15) * 15, 0, 0)
      const next = new Date(nearest)
      next.setHours(next.getHours() + 1, 0, 0, 0)
      setStartDate(nearest)
      setEndDate(next)
      setStartTimeStr(formatTime(nearest))
      setEndTimeStr(formatTime(next))
      setTitle('')
      setRoomId('')
      setIsAllDay(false)
      setRecurrenceCd(noRecurrenceCd)
      setRecurrenceEndDate('')
      setRecurrenceEndError(null)
      setBookerInfo(null)
      skipNextSyncRef.current = true
    }
    if (!initialEvent) {
      setCycleNumber(1)
      setSelectedDays([false, false, false, false, false, false, false])
    }
  }, [isOpen, initialDate, initialEvent, rooms, noRecurrenceCd])

  /** 새 예약이고 '종일'이 아닐 때: 시작일/시작시간이 바뀌면 종료 = 시작 + 1시간 (모달 최초 오픈 직후 1회는 스킵) */
  useEffect(() => {
    if (!isOpen) {
      skipNextSyncRef.current = false
      return
    }
    if (initialEvent != null || isAllDay) return
    if (skipNextSyncRef.current) {
      skipNextSyncRef.current = false
      return
    }
    const start = parseTime(startTimeStr, startDate)
    const end = new Date(start.getTime() + 60 * 60 * 1000)
    setEndDate(end)
    setEndTimeStr(formatTime(end))
    setEndDateInput(null)
  }, [isOpen, initialEvent, isAllDay, startDate, startTimeStr])

  /** 날짜 입력값을 연도 4자리(YYYY-MM-DD)로 정규화한 뒤 Date로 반환 (시간 유지). 연도 1000 미만은 거부 */
  const applyDateWith4DigitYear = (
    dateStr: string,
    preserveTimeFrom: Date
  ): Date | null => {
    const norm = normalizeDateTo4DigitYear(dateStr)
    if (!norm) return null
    const [y, m, day] = norm.split('-').map(Number)
    if (y < 1000) return null
    const d = new Date(preserveTimeFrom)
    d.setFullYear(y, m - 1, day)
    return d
  }

  const handleStartTimeChange = (timeStr: string) => {
    setStartTimeStr(timeStr)
  }

  /** 시작일 기준 매월 n번째 요일 계산 (ordinal 1~5, dayOfWeek 0~6) */
  const getMonthlyOrdinalFromDate = (d: Date) => {
    const date = d.getDate()
    return Math.min(5, Math.ceil(date / 7))
  }

  /** 사용자 설정 요일 토글 (인덱스 0=월 … 6=일) */
  const toggleCustomDay = (index: number) => {
    setSelectedDays((prev) => {
      const next = [...prev]
      next[index] = !next[index]
      return next
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (viewOnly) return
    if (!title.trim()) return
    const room = rooms.find((r) => r.id === roomId)
    if (!room) return

    // 반복없음 이외의 값은 날짜선택 필수. 사용자설정(150) 포함
    if (
      recurrenceCd != null &&
      recurrenceCd !== noRecurrenceCd &&
      !recurrenceEndDate.trim()
    ) {
      setRecurrenceEndError('반복 종료일을 선택해 주세요.')
      return
    }
    setRecurrenceEndError(null)

    // 매주/매월: 반복 종료일이 시작일 기준 요일·일 제한에 맞는지 검증 (사용자설정 제외)
    if (
      recurrenceCd != null &&
      recurrenceCd !== noRecurrenceCd &&
      recurrenceCd !== RECURRENCE_CUSTOM_CD &&
      recurrenceEndDate.trim()
    ) {
      const limitError = validateRecurrenceEndDate(
        recurrenceCd,
        startDate,
        recurrenceEndDate
      )
      if (limitError) {
        setRecurrenceEndError(limitError)
        return
      }
    }

    let start: Date
    let end: Date
    if (isAllDay) {
      start = new Date(startDate)
      start.setHours(0, 0, 0, 0)
      end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
    } else {
      start = parseTime(startTimeStr, startDate)
      end = parseTime(endTimeStr, endDate)
    }

    const recurrenceEndYmd =
      recurrenceCd != null &&
      recurrenceCd !== noRecurrenceCd &&
      recurrenceEndDate.trim()
        ? recurrenceEndDate.replace(/-/g, '')
        : undefined

    const repeatCondition =
      recurrenceCd === RECURRENCE_CUSTOM_CD && isCycleUnitMonth
        ? `${MONTHLY_ORDINAL_LABELS[monthlyOrdinal - 1]} ${DAY_NAMES_KO[monthlyDayOfWeek]}`
        : undefined

    onSave({
      title: title.trim(),
      start,
      end,
      roomId,
      roomName: room.name,
      booker: '현재 사용자',
      recurrenceCd: recurrenceCd ?? undefined,
      recurrenceEndYmd: recurrenceEndYmd ?? undefined,
      isAllDay,
      cycleNumber: recurrenceCd === RECURRENCE_CUSTOM_CD ? cycleNumber : undefined,
      cycleUnitCd: recurrenceCd === RECURRENCE_CUSTOM_CD ? cycleUnitCd ?? undefined : undefined,
      selectedDays: recurrenceCd === RECURRENCE_CUSTOM_CD && !isCycleUnitMonth ? selectedDays : undefined,
      repeatCondition: repeatCondition ?? undefined,
    })
  }

  if (!isOpen) return null

  /** join=130 등 조회 전용, 또는 타인 예약 조회 시 수정 불가 */
  const isReadOnly = Boolean(
    initialEvent &&
      (viewOnly ||
        (currentUserUid != null && initialEvent.extendedProps?.createUser !== currentUserUid))
  )

  /** 종료일·종료시간이 시작일·시작시간보다 작거나 같으면 true (빨간색 표시용) */
  /** 종료가 시작보다 이전일 때만 빨간색 (종료=시작은 반복 예약 등으로 허용) */
  const isEndBeforeOrEqualStart = isAllDay
    ? formatDateLocal(endDate) < formatDateLocal(startDate)
    : parseTime(endTimeStr, endDate) < parseTime(startTimeStr, startDate)

  return (
    <>
    <div className="modal-overlay" onClick={onClose}>
      <div className="reservation-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-title-wrap">
            <h2>
              {initialEvent
                ? viewOnly
                  ? '예약 조회'
                  : '회의실 예약 수정'
                : '회의실 예약'}
            </h2>
            {(() => {
              const status = initialEvent?.extendedProps?.status
              const label = initialEvent ? getReservationStatusLabel(status) : ''
              if (!label) return null
              const modifier =
                status === 110
                  ? 'reservation-status-badge--applied'
                  : status === 130
                    ? 'reservation-status-badge--rejected'
                    : status === 120 || status === 140
                      ? 'reservation-status-badge--approved'
                      : ''
              return (
                <span className={`reservation-status-badge ${modifier}`.trim()}>
                  {label}
                </span>
              )
            })()}
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label>제목 *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="제목 추가"
              required
              disabled={isReadOnly}
              readOnly={isReadOnly}
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>시작일</label>
              <input
                type="date"
                value={
                  startDateInput !== null && startDateInput !== ''
                    ? isValidYyyyMmDd(startDateInput)
                      ? startDateInput
                      : partialDateToDisplay(startDateInput, formatDateLocal(startDate))
                    : formatDateLocal(startDate)
                }
                onChange={(e) => {
                  let val = e.target.value
                  val = correctMonth01From10(val, prevStartDateInputRef.current)
                  prevStartDateInputRef.current = val
                  setStartDateInput(val)
                  let next = normalizeDateTo4DigitYear(val) || val
                  if (val && /^\d{4}-01$/.test(val)) next = val + '-01'
                  const digits = (val || '').replace(/\D/g, '')
                  if ((!next || !/^\d{4}-\d{2}-\d{2}$/.test(next)) && digits.length === 6)
                    next = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-01`
                  if (next && /^\d{4}-\d{2}-\d{2}$/.test(next)) {
                    const dateNext = applyDateWith4DigitYear(next, startDate)
                    if (dateNext) {
                      setStartDate(dateNext)
                      setStartDateInput(null)
                      prevStartDateInputRef.current = null
                    }
                  }
                }}
                onBlur={() => {
                  if (startDateInput !== null && startDateInput !== '') {
                    let next = normalizeDateTo4DigitYear(startDateInput) || startDateInput
                    if (startDateInput && /^\d{4}-01$/.test(startDateInput))
                      next = startDateInput + '-01'
                    const digits = (startDateInput || '').replace(/\D/g, '')
                    if ((!next || !/^\d{4}-\d{2}-\d{2}$/.test(next)) && digits.length === 6)
                      next = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-01`
                    if (next && /^\d{4}-\d{2}-\d{2}$/.test(next)) {
                      const dateNext = applyDateWith4DigitYear(next, startDate)
                      if (dateNext) setStartDate(dateNext)
                    }
                    setStartDateInput(null)
                    prevStartDateInputRef.current = null
                  }
                }}
                required
                min="1900-01-01"
                max="9999-12-31"
                disabled={isReadOnly}
              />
            </div>
            {!isAllDay && (
              <div className="form-group">
                <label>시작 시간</label>
                <select
                  value={startTimeStr}
                  onChange={(e) => handleStartTimeChange(e.target.value)}
                  disabled={isReadOnly}
                >
                  {TIME_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="form-row">
            <div
              className={`form-group${isEndBeforeOrEqualStart ? ' form-group--end-invalid' : ''}`}
            >
              <label>종료일</label>
              <input
                type="date"
                value={
                  endDateInput !== null && endDateInput !== ''
                    ? isValidYyyyMmDd(endDateInput)
                      ? endDateInput
                      : partialDateToDisplay(endDateInput, formatDateLocal(endDate))
                    : formatDateLocal(endDate)
                }
                onChange={(e) => {
                  let val = e.target.value
                  val = correctMonth01From10(val, prevEndDateInputRef.current)
                  prevEndDateInputRef.current = val
                  setEndDateInput(val)
                  let next = normalizeDateTo4DigitYear(val) || val
                  if (val && /^\d{4}-01$/.test(val)) next = val + '-01'
                  const digits = (val || '').replace(/\D/g, '')
                  if ((!next || !/^\d{4}-\d{2}-\d{2}$/.test(next)) && digits.length === 6)
                    next = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-01`
                  if (next && /^\d{4}-\d{2}-\d{2}$/.test(next)) {
                    const dateNext = applyDateWith4DigitYear(next, endDate)
                    if (dateNext) {
                      setEndDate(dateNext)
                      setEndDateInput(null)
                      prevEndDateInputRef.current = null
                    }
                  }
                }}
                onBlur={() => {
                  if (endDateInput !== null && endDateInput !== '') {
                    let next = normalizeDateTo4DigitYear(endDateInput) || endDateInput
                    if (endDateInput && /^\d{4}-01$/.test(endDateInput))
                      next = endDateInput + '-01'
                    const digits = (endDateInput || '').replace(/\D/g, '')
                    if ((!next || !/^\d{4}-\d{2}-\d{2}$/.test(next)) && digits.length === 6)
                      next = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-01`
                    if (next && /^\d{4}-\d{2}-\d{2}$/.test(next)) {
                      const dateNext = applyDateWith4DigitYear(next, endDate)
                      if (dateNext) setEndDate(dateNext)
                    }
                    setEndDateInput(null)
                    prevEndDateInputRef.current = null
                  }
                }}
                required
                min="1900-01-01"
                max="9999-12-31"
                disabled={isReadOnly}
              />
            </div>
            {!isAllDay && (
              <div
                className={`form-group${isEndBeforeOrEqualStart ? ' form-group--end-invalid' : ''}`}
              >
                <label>종료 시간</label>
                <select value={endTimeStr} onChange={(e) => setEndTimeStr(e.target.value)} disabled={isReadOnly}>
                  {TIME_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="form-group form-group--row">
            <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={isAllDay}
                  onChange={(e) => setIsAllDay(e.target.checked)}
                  disabled={isReadOnly}
                />
              종일
            </label>
            {recurrenceOptions.length > 0 && (
              <>
                <select
                  className="form-input-recurrence"
                  value={recurrenceCd != null ? String(recurrenceCd) : ''}
                  disabled={isReadOnly}
                  onChange={(e) => {
                    const raw = e.target.value
                    const numVal = raw === '' ? null : Number(raw)
                    const isNone = numVal === noRecurrenceCd
                    const nextCd = isNone ? noRecurrenceCd : numVal
                    setRecurrenceCd(nextCd)
                    if (nextCd === noRecurrenceCd) {
                      setRecurrenceEndDate('')
                      setRecurrenceEndError(null)
                    } else if (nextCd === RECURRENCE_CUSTOM_CD) {
                      if (!recurrenceEndDate.trim()) setRecurrenceEndDate(formatDateLocal(endDate))
                      if (cycleUnitCd == null && cycleOptions.length > 0) {
                        const weekOpt = cycleOptions.find((o) => Number(o.lookup_value_cd) === 110)
                        setCycleUnitCd(weekOpt ? 110 : cycleOptions[0].lookup_value_cd)
                      }
                    } else if (nextCd != null && !recurrenceEndDate) {
                      setRecurrenceEndDate(formatDateLocal(endDate))
                    }
                  }}
                  aria-label="반복"
                >
                  {visibleRecurrenceOptions.map((o) => (
                    <option
                      key={o.lookup_value_id}
                      value={String(Number(o.lookup_value_cd))}
                    >
                      {o.lookup_value_nm}
                    </option>
                  ))}
                </select>
                {/* 반복없음 선택 시 달력·일 까지 숨김. 사용자설정이면 인라인으로 주기·요일·종료일 표시, 매일/매주/매월이면 종료일만 */}
                {recurrenceCd != null && Number(recurrenceCd) !== noRecurrenceCd && (
                  <>
                    {Number(recurrenceCd) === RECURRENCE_CUSTOM_CD && (
                      <>
                        <span className="form-recurrence-end-inline recurrence-inline-cycle">
                          <input
                            type="number"
                            min={1}
                            max={999}
                            value={cycleNumber}
                            onChange={(e) =>
                              setCycleNumber(Math.max(1, parseInt(e.target.value, 10) || 1))
                            }
                            onFocus={(e) => e.target.select()}
                            className="recurrence-cycle-number form-input"
                            aria-label="반복 주기 수"
                            disabled={isReadOnly}
                          />
                          <select
                            className="recurrence-cycle-unit form-input"
                            value={cycleUnitCd ?? ''}
                            disabled={isReadOnly}
                            onChange={(e) => {
                              const val = e.target.value === '' ? null : Number(e.target.value)
                              setCycleUnitCd(val)
                              if (val != null) {
                                const opt = cycleOptions.find((o) => o.lookup_value_cd === val)
                                if (opt && /개월|^월$/.test(String(opt.lookup_value_nm ?? ''))) {
                                  setMonthlyOrdinal(getMonthlyOrdinalFromDate(startDate))
                                  setMonthlyDayOfWeek(startDate.getDay())
                                }
                              }
                            }}
                            aria-label="반복 주기 단위"
                          >
                            {cycleOptions.map((o) => (
                              <option key={o.lookup_value_id} value={o.lookup_value_cd}>
                                {o.lookup_value_nm}
                              </option>
                            ))}
                          </select>
                        </span>
                        {isCycleUnitMonth ? (
                          <div className="form-group form-group--recurrence-days">
                            <div className="recurrence-monthly-block">
                              <label className="form-label-inline">다음 조건으로 반복</label>
                              <div className="recurrence-monthly-condition recurrence-monthly-condition--text">
                                <span className="recurrence-monthly-text">
                                  ● {MONTHLY_ORDINAL_LABELS[monthlyOrdinal - 1]} {DAY_NAMES_KO[monthlyDayOfWeek]}
                                </span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="form-group form-group--recurrence-days">
                            <label className="form-label-inline">다음 요일에 반복</label>
                            <div className="recurrence-days-row">
                              {WEEKDAY_LABELS.map((label, index) => (
                                <button
                                  key={label}
                                  type="button"
                                  className={`recurrence-day-btn${selectedDays[index] ? ' recurrence-day-btn--selected' : ''}`}
                                  onClick={() => toggleCustomDay(index)}
                                  aria-pressed={selectedDays[index]}
                                  disabled={isReadOnly}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                    <>
                      <span className="form-recurrence-end-inline">
                      <input
                        type="date"
                        className="form-input form-input-date"
                        value={
                          recurrenceEndDateInput !== null && recurrenceEndDateInput !== ''
                            ? isValidYyyyMmDd(recurrenceEndDateInput)
                              ? recurrenceEndDateInput
                              : partialDateToDisplay(
                                  recurrenceEndDateInput,
                                  recurrenceEndDate || formatDateLocal(startDate)
                                )
                            : recurrenceEndDate && isValidYyyyMmDd(recurrenceEndDate)
                              ? recurrenceEndDate
                              : ''
                        }
                        min={formatDateLocal(startDate)}
                        max="9999-12-31"
                        onChange={(e) => {
                          let val = e.target.value
                          val = correctMonth01From10(val, prevRecurrenceEndInputRef.current)
                          prevRecurrenceEndInputRef.current = val
                          setRecurrenceEndDateInput(val)
                          let next = normalizeDateTo4DigitYear(val) || val
                          if (val && /^\d{4}-01$/.test(val)) next = val + '-01'
                          const digits = (val || '').replace(/\D/g, '')
                          if ((!next || !/^\d{4}-\d{2}-\d{2}$/.test(next)) && digits.length === 6)
                            next = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-01`
                          if (next && /^\d{4}-\d{2}-\d{2}$/.test(next)) {
                            setRecurrenceEndDate(next)
                            setRecurrenceEndDateInput(null)
                            prevRecurrenceEndInputRef.current = null
                            if (recurrenceCd != null) {
                              const err = validateRecurrenceEndDate(
                                recurrenceCd,
                                startDate,
                                next
                              )
                              setRecurrenceEndError(err)
                            } else {
                              setRecurrenceEndError(null)
                            }
                          } else {
                            setRecurrenceEndError(null)
                          }
                        }}
                        onBlur={() => {
                          if (
                            recurrenceEndDateInput !== null &&
                            recurrenceEndDateInput !== ''
                          ) {
                            let val = recurrenceEndDateInput
                            val = correctMonth01From10(val, prevRecurrenceEndInputRef.current)
                            let next = normalizeDateTo4DigitYear(val) || val
                            if (val && /^\d{4}-01$/.test(val)) next = val + '-01'
                            const digits = (val || '').replace(/\D/g, '')
                            if (
                              (!next || !/^\d{4}-\d{2}-\d{2}$/.test(next)) &&
                              digits.length === 6
                            )
                              next = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-01`
                            if (next && /^\d{4}-\d{2}-\d{2}$/.test(next)) {
                              setRecurrenceEndDate(next)
                              if (recurrenceCd != null) {
                                const err = validateRecurrenceEndDate(
                                  recurrenceCd,
                                  startDate,
                                  next
                                )
                                setRecurrenceEndError(err)
                              } else {
                                setRecurrenceEndError(null)
                              }
                            }
                            setRecurrenceEndDateInput(null)
                            prevRecurrenceEndInputRef.current = null
                          }
                        }}
                        aria-label="반복 종료일"
                        required
                        disabled={isReadOnly}
                      />
                      <span className="form-label-inline">일 까지</span>
                    </span>
                    {recurrenceEndError && (
                      <span className="form-error-inline form-error-inline--full" role="alert">
                        {recurrenceEndError}
                      </span>
                    )}
                  </>
                </>
              )}
              </>
            )}
          </div>
          <div className="form-group">
            <label>회의실</label>
            <select
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              required
              disabled={isReadOnly}
              aria-label="회의실 선택"
            >
              <option value="">회의실 선택</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                  {r.capacity != null ? ` (${r.capacity})` : ''}
                </option>
              ))}
            </select>
          </div>
          {initialEvent?.extendedProps?.status === 130 && (
            <div className="form-group form-group--reject-comment">
              <label>반려 사유</label>
              <div className="form-readonly form-readonly--multiline" role="note">
                {String(initialEvent.extendedProps.returnComment ?? '').trim() || '—'}
              </div>
            </div>
          )}
          {initialEvent && bookerInfo && (
            <div className="form-group form-group--booker-info">
              <span className="form-readonly form-readonly--inline">
                예약자 : {bookerInfo.authorName || '-'}
                {bookerInfo.positionName ? ` (${bookerInfo.positionName})  ` : ''}
                {bookerInfo.phone ? ` ${bookerInfo.phone}` : ''}
              </span>
            </div>
          )}
          <div className="modal-actions">
            {viewOnly && initialEvent ? (
              <button type="button" className="btn-primary" onClick={onClose}>
                닫기
              </button>
            ) : (
              <>
            {(!initialEvent || (currentUserUid && initialEvent.extendedProps?.createUser === currentUserUid)) && (
              <>
                <button type="button" onClick={onClose}>
                  취소
                </button>
                {(!initialEvent ||
                  (initialEvent.extendedProps?.status !== 120 &&
                    initialEvent.extendedProps?.status !== 130)) && (
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={!title.trim() || !roomId}
                  >
                    저장
                  </button>
                )}
              </>
            )}
            {initialEvent &&
            currentUserUid &&
            initialEvent.extendedProps?.createUser === currentUserUid &&
            initialEvent.extendedProps?.reservationId ? (
              <button
                type="button"
                className="btn-danger"
                onClick={() => {
                  const id = initialEvent.extendedProps!.reservationId!
                  const repeatGroupId = initialEvent.extendedProps?.repeatGroupId
                  const startYmd = initialEvent.extendedProps?.startYmd ?? initialEvent.start.slice(0, 10)
                  if (repeatGroupId && onDeleteRecurring) {
                    setDeleteRecurringScope('this')
                    setDeleteRecurringOpen(true)
                  } else if (onDelete) {
                    onDelete(id)
                  }
                }}
                disabled={!onDelete && !onDeleteRecurring}
              >
                삭제
              </button>
            ) : null}
            {initialEvent &&
            initialEvent.extendedProps?.status === 110 &&
            (isAdmin || isApproverForRoom) &&
            initialEvent.extendedProps?.reservationId ? (
              <>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    const id = initialEvent.extendedProps!.reservationId!
                    const groupId = initialEvent.extendedProps?.repeatGroupId
                    onApprove?.(id, groupId ?? undefined)
                  }}
                  disabled={!onApprove}
                >
                  승인
                </button>
                <button
                  type="button"
                  className="btn-danger"
                onClick={() => {
                  setRejectComment('')
                  setRejectCommentError(null)
                  setRejectPopupOpen(true)
                }}
                  disabled={!onReject}
                >
                  반려
                </button>
              </>
            ) : null}
              </>
            )}
          </div>
        </form>
      </div>
    </div>

    {deleteRecurringOpen &&
      initialEvent?.extendedProps?.reservationId &&
      initialEvent?.extendedProps?.repeatGroupId && (
        <div
          className="modal-overlay"
          onClick={() => setDeleteRecurringOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-recurring-title"
        >
          <div
            className="reservation-modal delete-recurring-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 id="delete-recurring-title">반복 일정 삭제</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setDeleteRecurringOpen(false)}
                aria-label="닫기"
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group delete-recurring-options">
                <label className="radio-label">
                  <input
                    type="radio"
                    name="deleteRecurringScope"
                    checked={deleteRecurringScope === 'this'}
                    onChange={() => setDeleteRecurringScope('this')}
                  />
                  이 일정
                </label>
                <label className="radio-label">
                  <input
                    type="radio"
                    name="deleteRecurringScope"
                    checked={deleteRecurringScope === 'thisAndFollowing'}
                    onChange={() => setDeleteRecurringScope('thisAndFollowing')}
                  />
                  이 일정 및 향후 일정
                </label>
                <label className="radio-label">
                  <input
                    type="radio"
                    name="deleteRecurringScope"
                    checked={deleteRecurringScope === 'all'}
                    onChange={() => setDeleteRecurringScope('all')}
                  />
                  모든 일정
                </label>
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setDeleteRecurringOpen(false)}>
                  취소
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={async () => {
                    const id = initialEvent!.extendedProps!.reservationId!
                    const groupId = String(initialEvent!.extendedProps!.repeatGroupId)
                    const startYmd =
                      initialEvent!.extendedProps!.startYmd ?? initialEvent!.start.slice(0, 10)
                    await onDeleteRecurring?.({
                      reservationId: id,
                      repeatGroupId: groupId,
                      startYmd,
                      scope: deleteRecurringScope,
                    })
                    setDeleteRecurringOpen(false)
                  }}
                >
                  확인
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    {rejectPopupOpen && initialEvent?.extendedProps?.reservationId && (
      <div
        className="modal-overlay"
        onClick={() => setRejectPopupOpen(false)}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reject-modal-title"
      >
        <div
          className="reservation-modal delete-recurring-modal reject-reason-modal"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-header">
            <h2 id="reject-modal-title">반려 사유</h2>
            <button
              type="button"
              className="modal-close"
              onClick={() => setRejectPopupOpen(false)}
              aria-label="닫기"
            >
              ×
            </button>
          </div>
          <div className="modal-body">
            <div className="form-group">
              <textarea
                id="reject-comment-input"
                value={rejectComment}
                onChange={(e) => {
                  setRejectComment(e.target.value)
                  setRejectCommentError(null)
                }}
                placeholder="반려 사유를 입력하세요."
                rows={4}
                className="form-input reject-comment-textarea"
                aria-label="반려 사유"
                aria-invalid={Boolean(rejectCommentError)}
                aria-describedby={rejectCommentError ? 'reject-comment-error' : undefined}
              />
              {rejectCommentError && (
                <span id="reject-comment-error" className="form-error-inline form-error-inline--full" role="alert">
                  {rejectCommentError}
                </span>
              )}
            </div>
            <div className="modal-actions">
              <button type="button" onClick={() => setRejectPopupOpen(false)}>
                취소
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={async () => {
                  const trimmed = rejectComment.trim()
                  if (!trimmed) {
                    setRejectCommentError('반려 사유 등록후 반려를 진행해 주세요.')
                    return
                  }
                  setRejectCommentError(null)
                  const id = initialEvent!.extendedProps!.reservationId!
                  const groupId = initialEvent!.extendedProps?.repeatGroupId ?? undefined
                  await onReject?.(id, groupId ?? null, trimmed)
                  setRejectPopupOpen(false)
                }}
                disabled={!onReject}
              >
                반려
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
