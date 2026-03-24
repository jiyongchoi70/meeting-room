import { useState, useCallback, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import MainCalendar from '../components/MainCalendar'
import MiniCalendar from '../components/MiniCalendar'
import ReservationModal from '../components/ReservationModal'
import { useAuth } from '../hooks/useAuth'
import { fetchMrUserByUid } from '../api/users'
import {
  fetchRoomsForReservation,
  fetchApproversByRoomIds,
  fetchUserHasApproverRecord,
} from '../api/rooms'
import {
  insertReservation,
  updateReservation,
  updateReservationDates,
  deleteReservation,
  deleteReservationThisAndFollowing,
  deleteReservationAllInGroup,
  fetchReservationsForCalendar,
  fetchBookerInfoByUserUid,
  fetchReservationIdsForStatusUpdate,
  batchUpdateReservationStatus,
  STATUS_APPLIED,
  STATUS_APPROVED,
  STATUS_REJECTED,
  type SaveReservationPayload,
  type InsertReservationResult,
} from '../api/reservations'
import type { ReservationEvent, RoomForReservation } from '../types'
import '../App.css'

/** mr_users.join: 110 일 때만 회의실 예약(만들기·수정·드래그) 가능 */
const RESERVATION_ALLOWED_JOIN = 110
/** mr_users.join: 130 일 때는 예약은 불가하나 캘린더에서 예약 클릭 시 조회 전용 모달 허용 */
const JOIN_VIEW_RESERVATION_DETAIL = 130
/** mr_users.user_type: 110 = 담당자(관리자). 모달 승인/반려 등에 사용 (120은 관리자 메뉴 미노출) */
const ADMIN_USER_TYPE = 110

function endDateToYmd(end: Date): string {
  const y = end.getFullYear()
  const m = String(end.getMonth() + 1).padStart(2, '0')
  const d = String(end.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

function formatYmdDisplay(ymd: string): string {
  if (ymd.length !== 8) return ymd
  return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`
}

export default function CalendarPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const fromLogoutHandled = useRef(false)
  const [mrUser, setMrUser] = useState<{ user_type: number | null; join: number | null } | null>(null)
  const [userHasApproverRecord, setUserHasApproverRecord] = useState(false)

  /** 로그인 시 mr_approver에 본인 user_uid 존재 여부 (join=110일 때 관리자 메뉴 조건) */
  useEffect(() => {
    if (!user?.id) {
      setUserHasApproverRecord(false)
      return
    }
    let cancelled = false
    fetchUserHasApproverRecord(user.id)
      .then((ok) => {
        if (!cancelled) setUserHasApproverRecord(ok)
      })
      .catch(() => {
        if (!cancelled) setUserHasApproverRecord(false)
      })
    return () => {
      cancelled = true
    }
  }, [user?.id])

  /** 로그인 시 해당 사용자의 mr_users 조회 → 예약 가능(join 110) 등 판단 */
  useEffect(() => {
    if (!user?.id) {
      setMrUser(null)
      return
    }
    let cancelled = false
    fetchMrUserByUid(user.id)
      .then((row) => {
        if (!cancelled && row) setMrUser({ user_type: row.user_type ?? null, join: row.join ?? null })
        if (!cancelled && !row) setMrUser(null)
      })
      .catch(() => {
        if (!cancelled) setMrUser(null)
      })
    return () => { cancelled = true }
  }, [user?.id])

  /** 관리자 메뉴: join=110 이고 (user_type=110 또는 mr_approver에 본인 1건 이상) */
  const showAdmin = Boolean(
    user &&
      mrUser &&
      mrUser.join === RESERVATION_ALLOWED_JOIN &&
      (mrUser.user_type === ADMIN_USER_TYPE || userHasApproverRecord)
  )
  /** join === 110 일 때만 예약(만들기·날짜클릭·이벤트클릭·드래그·리사이즈) 가능 */
  const canReserve = Boolean(user && mrUser && mrUser.join === RESERVATION_ALLOWED_JOIN)
  /** join 110 또는 130: 캘린더에서 예약(이벤트) 클릭 시 상세 모달 열기 */
  const canOpenEventDetail = Boolean(
    user &&
      mrUser &&
      (mrUser.join === RESERVATION_ALLOWED_JOIN || mrUser.join === JOIN_VIEW_RESERVATION_DETAIL)
  )
  /** join 130: 모달은 조회 전용 */
  const reservationModalViewOnly = Boolean(
    mrUser && mrUser.join === JOIN_VIEW_RESERVATION_DETAIL
  )

  /** 관리자에서 로그아웃 후 넘어온 경우: 한 번만 signOut 실행 → 로그인 버튼 표시 (중복 실행·네비게이션 스로틀 방지) */
  useEffect(() => {
    const fromLogout = (location.state as { fromLogout?: boolean } | null)?.fromLogout
    if (!fromLogout || fromLogoutHandled.current) return
    fromLogoutHandled.current = true
    signOut().finally(() => {
      navigate('/', { replace: true }) // state 제거해서 새로고침 시 signOut 재실행 방지
    })
  }, [location.state, signOut, navigate])

  /** 회의실 예약(/) 화면에서 로그아웃 클릭 시: 새로고침 없이 로그아웃만 → 버튼이 로그인으로 바뀜 */
  const handleLogout = async () => {
    await signOut()
  }
  const [events, setEvents] = useState<ReservationEvent[]>([])
  const [roomsForReservation, setRoomsForReservation] = useState<RoomForReservation[]>([])
  const [reservationError, setReservationError] = useState<string | null>(null)
  const [currentDate, setCurrentDate] = useState(() => new Date(2026, 1, 1))
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalInitialDate, setModalInitialDate] = useState<Date | null>(null)
  const [modalInitialEvent, setModalInitialEvent] = useState<ReservationEvent | null>(null)
  /** 월 보기에서 권한 없이 드롭 시 캘린더 리마운트용. FullCalendar 월 보기는 events prop만으로 원위치가 안 되므로 key 변경으로 강제 재마운트 */
  const [monthRevertKey, setMonthRevertKey] = useState(0)
  /** 반복 예약 저장 후 캘린더 재조회 트리거 */
  const [calendarRefreshKey, setCalendarRefreshKey] = useState(0)
  /** 캘린더 필터: 선택한 회의실만 표시. '' 또는 null = 전체 */
  const [selectedRoomId, setSelectedRoomId] = useState<string>('')
  /** 모달에 열린 예약의 회의실 승인자 uid 목록 (승인/반려 버튼 노출 판단) */
  const [approversForModalRoom, setApproversForModalRoom] = useState<string[]>([])

  /** 모달에 예약(initialEvent)이 열려 있을 때 해당 회의실 승인자 목록 조회 */
  useEffect(() => {
    if (!modalOpen || !modalInitialEvent?.roomId) {
      setApproversForModalRoom([])
      return
    }
    let cancelled = false
    fetchApproversByRoomIds([modalInitialEvent.roomId])
      .then((list) => {
        if (!cancelled) setApproversForModalRoom(list.map((a) => a.user_uid))
      })
      .catch(() => {
        if (!cancelled) setApproversForModalRoom([])
      })
    return () => { cancelled = true }
  }, [modalOpen, modalInitialEvent?.roomId])

  /** 예약 화면용 회의실 목록 로드 */
  useEffect(() => {
    fetchRoomsForReservation()
      .then(setRoomsForReservation)
      .catch(() => setRoomsForReservation([]))
  }, [])

  /** 로그인 시 캘린더용 예약 목록 로드 (드래그 시 DB 반영을 위해 reservationId 포함) */
  useEffect(() => {
    if (!user?.id || mrUser == null) return
    const y = currentDate.getFullYear()
    const m = currentDate.getMonth()
    const first = new Date(y, m - 1, 1)
    const start = `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, '0')}-01`
    const last = new Date(y, m + 3, 0)
    const end = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`
    let cancelled = false
    fetchReservationsForCalendar(start, end, false, user.id, selectedRoomId || null)
      .then((list) => {
        if (!cancelled) setEvents(list as ReservationEvent[])
      })
      .catch(() => {
        if (!cancelled) setEvents([])
      })
    return () => { cancelled = true }
  }, [user?.id, mrUser?.user_type, currentDate.getFullYear(), currentDate.getMonth(), calendarRefreshKey, selectedRoomId])

  const handleCreateClick = useCallback(() => {
    if (!canReserve) return
    setModalInitialDate(new Date())
    setModalInitialEvent(null)
    setModalOpen(true)
  }, [canReserve])

  const handleDateSelect = useCallback((date: Date) => {
    setSelectedDate(date)
    setCurrentDate(new Date(date.getTime()))
  }, [])

  const handleCalendarDateClick = useCallback((date: Date) => {
    if (!canReserve) return
    setModalInitialDate(date)
    setModalInitialEvent(null)
    setModalOpen(true)
  }, [canReserve])

  const handleEventClick = useCallback((event: ReservationEvent) => {
    if (!canOpenEventDetail) return
    setModalInitialEvent(event)
    setModalInitialDate(new Date(event.start))
    setModalOpen(true)
  }, [canOpenEventDetail])

  const handleEventDrop = useCallback(
    async (event: ReservationEvent, start: Date, end: Date) => {
      if (event.extendedProps?.status === STATUS_REJECTED) {
        setReservationError('반려된 예약은 이동할 수 없습니다.')
        setEvents((prev) =>
          prev.map((e) => (e.id === event.id ? { ...e } : e))
        )
        return
      }
      const createUser = event.extendedProps?.createUser
      if (user?.id && createUser != null && createUser !== user.id) {
        setReservationError('본인이 신청한 예약만 이동할 수 있습니다.')
        setEvents((prev) =>
          prev.map((e) => (e.id === event.id ? { ...e } : e))
        )
        return
      }

      const reservationId =
        event.extendedProps?.reservationId ??
        (event.id && /^[0-9a-f-]{36}$/i.test(event.id) ? event.id : null)

      if (reservationId) {
        try {
          await updateReservationDates(reservationId, start.toISOString(), end.toISOString())
        } catch (err) {
          setReservationError(err instanceof Error ? err.message : '예약 일시 변경 실패')
          setMonthRevertKey((k) => k + 1)
          return
        }
      }

      setEvents((prevEvents) =>
        prevEvents.map((e) =>
          e.id === event.id ? { ...e, start: start.toISOString(), end: end.toISOString() } : e
        )
      )
    },
    [user?.id]
  )

  const handleEventResize = useCallback(
    async (event: ReservationEvent, start: Date, end: Date) => {
      if (event.extendedProps?.status === STATUS_REJECTED) {
        setReservationError('반려된 예약은 이동할 수 없습니다.')
        setEvents((prev) =>
          prev.map((e) => (e.id === event.id ? { ...e } : e))
        )
        return
      }
      const createUser = event.extendedProps?.createUser
      if (user?.id && createUser != null && createUser !== user.id) {
        setReservationError('본인이 신청한 예약만 이동할 수 있습니다.')
        setEvents((prev) =>
          prev.map((e) => (e.id === event.id ? { ...e } : e))
        )
        return
      }

      const reservationId =
        event.extendedProps?.reservationId ??
        (event.id && /^[0-9a-f-]{36}$/i.test(event.id) ? event.id : null)

      if (reservationId) {
        try {
          await updateReservationDates(reservationId, start.toISOString(), end.toISOString())
        } catch (err) {
          setReservationError(err instanceof Error ? err.message : '예약 일시 변경 실패')
          setMonthRevertKey((k) => k + 1)
          return
        }
      }

      setEvents((prevEvents) =>
        prevEvents.map((e) =>
          e.id === event.id ? { ...e, start: start.toISOString(), end: end.toISOString() } : e
        )
      )
    },
    [user?.id]
  )

  const handleSaveReservation = useCallback(
    async (data: {
      title: string
      start: Date
      end: Date
      roomId: string
      roomName: string
      booker?: string
      recurrenceCd?: number | null
      recurrenceEndYmd?: string | null
      isAllDay?: boolean
      cycleNumber?: number
      cycleUnitCd?: number | null
      selectedDays?: boolean[]
      repeatCondition?: string | null
    }) => {
      setReservationError(null)
      if (!user?.id) {
        setReservationError('로그인 후 예약할 수 있습니다.')
        return
      }

      const buildPayload = (): SaveReservationPayload => {
        const sd = data.selectedDays
        return {
          title: data.title,
          room_id: data.roomId,
          allday_yn: data.isAllDay ? 'Y' : 'N',
          start_ymd: data.start.toISOString(),
          end_ymd: data.end.toISOString(),
          repeat_id: data.recurrenceCd ?? null,
          repeat_end_ymd: data.recurrenceEndYmd ?? null,
          repeat_cycle: data.cycleNumber ?? null,
          repeat_user: data.cycleUnitCd ?? null,
          sun_yn: sd && sd[0] ? 'Y' : 'N',
          mon_yn: sd && sd[1] ? 'Y' : 'N',
          tue_yn: sd && sd[2] ? 'Y' : 'N',
          wed_yn: sd && sd[3] ? 'Y' : 'N',
          thu_yn: sd && sd[4] ? 'Y' : 'N',
          fri_yn: sd && sd[5] ? 'Y' : 'N',
          sat_yn: sd && sd[6] ? 'Y' : 'N',
          repeat_condition: data.repeatCondition ?? null,
        }
      }

      const applyAndClose = (
        reservationId?: string,
        booker?: { bookerName: string; bookerPositionName: string; bookerPhone: string },
        savedStatus?: number
      ) => {
        if (modalInitialEvent) {
          setEvents((prev) =>
            prev.map((e) =>
              e.id === modalInitialEvent.id
                ? {
                    ...e,
                    title: data.title,
                    start: data.start.toISOString(),
                    end: data.end.toISOString(),
                    roomId: data.roomId,
                    roomName: data.roomName,
                    booker: data.booker,
                    extendedProps: {
                      ...e.extendedProps,
                      isAllDay: data.isAllDay,
                      recurrenceCd: data.recurrenceCd ?? undefined,
                      recurrenceEndYmd: data.recurrenceEndYmd ?? undefined,
                      reservationId: e.extendedProps?.reservationId ?? reservationId,
                      ...(savedStatus != null && { status: savedStatus }),
                    },
                  }
                : e
            )
          )
        } else {
          const id = reservationId ?? `evt-${Date.now()}`
          const newEvent: ReservationEvent = {
            id,
            title: data.title,
            start: data.start.toISOString(),
            end: data.end.toISOString(),
            roomId: data.roomId,
            roomName: data.roomName,
            booker: data.booker,
            extendedProps: {
              isAllDay: data.isAllDay,
              recurrenceCd: data.recurrenceCd ?? undefined,
              recurrenceEndYmd: data.recurrenceEndYmd ?? undefined,
              reservationId: reservationId ?? undefined,
              status: savedStatus ?? STATUS_APPLIED,
              createUser: user.id,
              ...(booker && {
                bookerName: booker.bookerName,
                bookerPositionName: booker.bookerPositionName,
                bookerPhone: booker.bookerPhone,
              }),
            },
          }
          setEvents((prev) => [...prev, newEvent])
        }
        setModalOpen(false)
      }

      if (mrUser?.user_type === ADMIN_USER_TYPE) {
        // 검증 생략
      } else {
        const approvers = await fetchApproversByRoomIds([data.roomId])
        const isApprover = user?.id && approvers.some((a) => a.user_uid === user.id)
        if (!isApprover) {
          const room = roomsForReservation.find((r) => r.id === data.roomId)
          const end_ymd = room?.end_ymd
          const limitMsg = `${data.roomName}은(는) ${end_ymd ? formatYmdDisplay(end_ymd) : ''} 까지만 예약이 가능합니다.`

          const endStr = endDateToYmd(data.end)
          if (end_ymd && endStr > end_ymd) {
            setReservationError(limitMsg)
            return
          }

          if (data.recurrenceEndYmd && end_ymd) {
            const repeatEndStr = String(data.recurrenceEndYmd).replace(/\D/g, '').slice(0, 8)
            if (repeatEndStr.length === 8 && repeatEndStr > end_ymd) {
              setReservationError(limitMsg)
              return
            }
          }
        }
      }

      const payload = buildPayload()
      const reservationIdForUpdate =
        modalInitialEvent?.extendedProps?.reservationId ??
        (modalInitialEvent?.id && /^[0-9a-f-]{36}$/i.test(modalInitialEvent.id)
          ? modalInitialEvent.id
          : null)

      try {
        if (reservationIdForUpdate) {
          const updated = await updateReservation(reservationIdForUpdate, payload)
          applyAndClose(reservationIdForUpdate, undefined, updated.status ?? undefined)
        } else {
          const result: InsertReservationResult = await insertReservation(payload, user.id)
          const isRepeat = 'isRepeat' in result && result.isRepeat
          const reservation = 'isRepeat' in result ? result.reservation : result
          if (isRepeat) {
            setModalOpen(false)
            setCalendarRefreshKey((k) => k + 1)
          } else {
            const booker = await fetchBookerInfoByUserUid(user.id).catch(() => undefined)
            applyAndClose(reservation.reservation_id, booker, reservation.status ?? undefined)
          }
        }
      } catch (err) {
        setReservationError(err instanceof Error ? err.message : '예약 저장에 실패했습니다.')
      }
    },
    [modalInitialEvent, mrUser?.user_type, user, roomsForReservation]
  )

  const handleApprove = useCallback(
    async (reservationId: string, repeatGroupId?: string | null) => {
      if (!user?.id) return
      try {
        const ids = await fetchReservationIdsForStatusUpdate(reservationId, repeatGroupId)
        await batchUpdateReservationStatus(ids, STATUS_APPROVED, user.id)
        setEvents((prev) =>
          prev.map((e) => {
            const rid = e.extendedProps?.reservationId ?? e.id
            if (ids.includes(rid))
              return { ...e, extendedProps: { ...e.extendedProps, status: STATUS_APPROVED } }
            return e
          })
        )
        setCalendarRefreshKey((k) => k + 1)
        setModalOpen(false)
      } catch (err) {
        setReservationError(err instanceof Error ? err.message : '승인 처리에 실패했습니다.')
      }
    },
    [user?.id]
  )

  const handleReject = useCallback(
    async (
      reservationId: string,
      repeatGroupId?: string | null,
      returnComment?: string
    ) => {
      if (!user?.id) return
      try {
        const ids = await fetchReservationIdsForStatusUpdate(reservationId, repeatGroupId)
        await batchUpdateReservationStatus(ids, STATUS_REJECTED, user.id, returnComment ?? null)
        setEvents((prev) =>
          prev.map((e) => {
            const rid = e.extendedProps?.reservationId ?? e.id
            if (ids.includes(rid))
              return {
                ...e,
                extendedProps: {
                  ...e.extendedProps,
                  status: STATUS_REJECTED,
                  returnComment: returnComment ?? null,
                },
              }
            return e
          })
        )
        setCalendarRefreshKey((k) => k + 1)
        setModalOpen(false)
      } catch (err) {
        setReservationError(err instanceof Error ? err.message : '반려 처리에 실패했습니다.')
      }
    },
    [user?.id]
  )

  return (
    <div className="app">
      <header className="app-header">
        <nav className="app-header-nav" role="navigation">
          {showAdmin && (
            <button
              type="button"
              className="app-nav-item app-nav-item--admin"
              title="관리자 화면"
              onClick={() => { window.location.href = '/admin' }}
            >
              <span className="app-nav-icon" aria-hidden="true">⚙</span>
              <span>관리자</span>
            </button>
          )}
          {user ? (
            <button
              type="button"
              className="app-nav-item app-nav-item--auth"
              title="로그아웃"
              onClick={handleLogout}
            >
              <span className="app-nav-icon" aria-hidden="true">👤</span>
              <span>로그아웃</span>
            </button>
          ) : (
            <button
              type="button"
              className="app-nav-item app-nav-item--auth"
              title="로그인"
              onClick={() => { window.location.href = '/login' }}
            >
              <span className="app-nav-icon" aria-hidden="true">👤</span>
              <span>로그인</span>
            </button>
          )}
        </nav>
      </header>
      <div className="app-header-spacer" aria-hidden="true" />

      <div className="app-body">
        <aside className="sidebar">
          <h2 className="sidebar-title">회의실 예약</h2>
          <button
            type="button"
            className="btn-create"
            onClick={handleCreateClick}
            disabled={!canReserve}
            title={!canReserve ? '예약은 가입/탈퇴 상태(join)가 110인 사용자만 가능합니다.' : undefined}
          >
            <span className="btn-create-icon">+</span>
            만들기
          </button>
          <MiniCalendar
            currentDate={currentDate}
            selectedDate={selectedDate}
            onDateSelect={handleDateSelect}
            onPrevMonth={() =>
              setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))
            }
            onNextMonth={() =>
              setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))
            }
          />
          <div className="sidebar-filter">
            <label htmlFor="calendar-room-filter">회의실명</label>
            <select
              id="calendar-room-filter"
              value={selectedRoomId}
              onChange={(e) => setSelectedRoomId(e.target.value)}
              aria-label="캘린더에 표시할 회의실 선택"
            >
              <option value="">전체</option>
              {roomsForReservation.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
          </div>
        </aside>

        <main className="main-content">
          <MainCalendar
            key={monthRevertKey}
            events={events}
            currentDate={currentDate}
            onDateClick={handleCalendarDateClick}
            onEventClick={handleEventClick}
            onNavigate={(date) => setCurrentDate(date)}
            onTodayClick={() => {
              const today = new Date()
              setSelectedDate(today)
              setCurrentDate(today)
            }}
            editable={canReserve}
            onEventDrop={handleEventDrop}
            onEventDropNotAllowed={(message) => {
              setReservationError(message ?? '본인이 신청한 예약만 이동할 수 있습니다.')
              setMonthRevertKey((k) => k + 1)
            }}
            onEventResize={handleEventResize}
            currentUserUid={user?.id}
          />
        </main>
      </div>

      <ReservationModal
        isOpen={modalOpen}
        initialDate={modalInitialDate}
        initialEvent={modalInitialEvent}
        rooms={roomsForReservation}
        currentUserUid={user?.id}
        viewOnly={reservationModalViewOnly}
        isAdmin={Boolean(mrUser && mrUser.user_type === ADMIN_USER_TYPE)}
        isApproverForRoom={Boolean(user?.id && approversForModalRoom.includes(user.id))}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveReservation}
        onApprove={handleApprove}
        onReject={handleReject}
        onDelete={async (reservationId) => {
          try {
            await deleteReservation(reservationId)
            setEvents((prev) => prev.filter((e) => e.id !== reservationId))
            setModalOpen(false)
          } catch (err) {
            setReservationError(err instanceof Error ? err.message : '예약 삭제에 실패했습니다.')
          }
        }}
        onDeleteRecurring={async ({ reservationId, repeatGroupId, scope }) => {
          try {
            if (scope === 'this') {
              await deleteReservation(reservationId)
              setEvents((prev) => prev.filter((e) => e.id !== reservationId))
            } else if (scope === 'thisAndFollowing') {
              await deleteReservationThisAndFollowing(reservationId)
              setCalendarRefreshKey((k) => k + 1)
            } else {
              await deleteReservationAllInGroup(repeatGroupId)
              setCalendarRefreshKey((k) => k + 1)
            }
            setModalOpen(false)
          } catch (err) {
            setReservationError(err instanceof Error ? err.message : '예약 삭제에 실패했습니다.')
          }
        }}
      />

      {reservationError != null && (
        <div className="modal-overlay" onClick={() => setReservationError(null)} role="dialog" aria-modal="true">
          <div className="reservation-modal reservation-error-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>예약 불가</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setReservationError(null)}
                aria-label="닫기"
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <p className="reservation-error-message">{reservationError}</p>
              <div className="modal-actions">
                <button type="button" className="btn-primary" onClick={() => setReservationError(null)}>
                  확인
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
