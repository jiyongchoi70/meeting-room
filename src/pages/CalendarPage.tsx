import { useState, useCallback, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import MainCalendar from '../components/MainCalendar'
import MiniCalendar from '../components/MiniCalendar'
import ReservationModal from '../components/ReservationModal'
import { MOCK_EVENTS } from '../mockData'
import { useAuth } from '../hooks/useAuth'
import { fetchMrUserByUid } from '../api/users'
import { fetchRoomsForReservation, fetchApproversByRoomIds } from '../api/rooms'
import type { ReservationEvent, RoomForReservation } from '../types'
import '../App.css'

/** mr_users.user_type: 110, 120 일 때만 관리자 메뉴 노출 */
const ADMIN_USER_TYPES = [110, 120]
/** mr_users.join: 110 일 때만 회의실 예약(만들기·수정·드래그) 가능 */
const RESERVATION_ALLOWED_JOIN = 110
/** mr_users.user_type: 110 = 관리자 (예약가능일 검증 생략) */
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

  /** 로그인 시 해당 사용자의 mr_users 조회 → 관리자 노출(user_type 110/120), 예약 가능(join 110) 판단 */
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

  const showAdmin = Boolean(user && mrUser && mrUser.user_type != null && ADMIN_USER_TYPES.includes(mrUser.user_type))
  /** join === 110 일 때만 예약(만들기·날짜클릭·이벤트클릭·드래그·리사이즈) 가능 */
  const canReserve = Boolean(user && mrUser && mrUser.join === RESERVATION_ALLOWED_JOIN)

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
  const [events, setEvents] = useState<ReservationEvent[]>(MOCK_EVENTS)
  const [roomsForReservation, setRoomsForReservation] = useState<RoomForReservation[]>([])
  const [reservationError, setReservationError] = useState<string | null>(null)
  const [currentDate, setCurrentDate] = useState(() => new Date(2026, 1, 1))
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalInitialDate, setModalInitialDate] = useState<Date | null>(null)
  const [modalInitialEvent, setModalInitialEvent] = useState<ReservationEvent | null>(null)

  /** 예약 화면용 회의실 목록 로드 */
  useEffect(() => {
    fetchRoomsForReservation()
      .then(setRoomsForReservation)
      .catch(() => setRoomsForReservation([]))
  }, [])

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
    if (!canReserve) return
    setModalInitialEvent(event)
    setModalInitialDate(new Date(event.start))
    setModalOpen(true)
  }, [canReserve])

  const handleEventDrop = useCallback((eventId: string, start: Date, end: Date) => {
    setEvents((prev) =>
      prev.map((e) =>
        e.id === eventId ? { ...e, start: start.toISOString(), end: end.toISOString() } : e
      )
    )
  }, [])

  const handleEventResize = useCallback((eventId: string, start: Date, end: Date) => {
    setEvents((prev) =>
      prev.map((e) =>
        e.id === eventId ? { ...e, start: start.toISOString(), end: end.toISOString() } : e
      )
    )
  }, [])

  const handleSaveReservation = useCallback(
    async (data: {
      title: string
      start: Date
      end: Date
      roomId: string
      roomName: string
      booker?: string
    }) => {
      setReservationError(null)
      const applyAndClose = () => {
        if (modalInitialEvent) {
          setEvents((prev) =>
            prev.map((e) =>
              e.id === modalInitialEvent.id
                ? {
                    ...e,
                    ...data,
                    start: data.start.toISOString(),
                    end: data.end.toISOString(),
                  }
                : e
            )
          )
        } else {
          const newEvent: ReservationEvent = {
            id: `evt-${Date.now()}`,
            title: data.title,
            start: data.start.toISOString(),
            end: data.end.toISOString(),
            roomId: data.roomId,
            roomName: data.roomName,
            booker: data.booker,
          }
          setEvents((prev) => [...prev, newEvent])
        }
        setModalOpen(false)
      }

      if (mrUser?.user_type === ADMIN_USER_TYPE) {
        applyAndClose()
        return
      }
      const approvers = await fetchApproversByRoomIds([data.roomId])
      const isApprover = user?.id && approvers.some((a) => a.user_uid === user.id)
      if (isApprover) {
        applyAndClose()
        return
      }
      const room = roomsForReservation.find((r) => r.id === data.roomId)
      const end_ymd = room?.end_ymd
      const endStr = endDateToYmd(data.end)
      if (!end_ymd || endStr <= end_ymd) {
        applyAndClose()
        return
      }
      const capacity = room?.capacity != null ? String(room.capacity) : ''
      setReservationError(
        `${data.roomName}${capacity ? ` (${capacity})` : ''}은(는) ${formatYmdDisplay(end_ymd)} 까지만 예약이 가능합니다.`
      )
    },
    [modalInitialEvent, mrUser?.user_type, user?.id, roomsForReservation]
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
        </aside>

        <main className="main-content">
          <MainCalendar
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
            onEventResize={handleEventResize}
          />
        </main>
      </div>

      <ReservationModal
        isOpen={modalOpen}
        initialDate={modalInitialDate}
        initialEvent={modalInitialEvent}
        rooms={roomsForReservation}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveReservation}
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
