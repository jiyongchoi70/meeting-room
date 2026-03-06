import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import MainCalendar from '../components/MainCalendar'
import MiniCalendar from '../components/MiniCalendar'
import ReservationModal from '../components/ReservationModal'
import { MOCK_ROOMS, MOCK_EVENTS } from '../mockData'
import { useAuth } from '../hooks/useAuth'
import type { ReservationEvent } from '../types'
import '../App.css'

export default function CalendarPage() {
  const { user, signOut } = useAuth()
  const [events, setEvents] = useState<ReservationEvent[]>(MOCK_EVENTS)
  const [currentDate, setCurrentDate] = useState(() => new Date(2026, 1, 1))
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalInitialDate, setModalInitialDate] = useState<Date | null>(null)
  const [modalInitialEvent, setModalInitialEvent] = useState<ReservationEvent | null>(null)

  const handleCreateClick = useCallback(() => {
    setModalInitialDate(new Date())
    setModalInitialEvent(null)
    setModalOpen(true)
  }, [])

  const handleDateSelect = useCallback((date: Date) => {
    setSelectedDate(date)
    setCurrentDate(new Date(date.getTime()))
  }, [])

  const handleCalendarDateClick = useCallback((date: Date) => {
    setModalInitialDate(date)
    setModalInitialEvent(null)
    setModalOpen(true)
  }, [])

  const handleEventClick = useCallback((event: ReservationEvent) => {
    setModalInitialEvent(event)
    setModalInitialDate(new Date(event.start))
    setModalOpen(true)
  }, [])

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
    (data: {
      title: string
      start: Date
      end: Date
      roomId: string
      roomName: string
      booker?: string
    }) => {
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
    },
    [modalInitialEvent]
  )

  return (
    <div className="app">
      <header className="app-header">
        <nav className="app-header-nav">
          <a
            href="/admin"
            className="app-nav-item app-nav-item--admin"
            title="관리자 화면"
          >
            <span className="app-nav-icon" aria-hidden="true">⚙</span>
            <span>관리자</span>
          </a>
          {user ? (
            <button
              type="button"
              className="app-nav-item"
              title="로그아웃"
              onClick={() => signOut()}
            >
              <span className="app-nav-icon" aria-hidden="true">👤</span>
              <span>로그아웃</span>
            </button>
          ) : (
            <Link to="/login" className="app-nav-item" title="로그인">
              <span className="app-nav-icon" aria-hidden="true">👤</span>
              <span>로그인</span>
            </Link>
          )}
        </nav>
      </header>

      <div className="app-body">
        <aside className="sidebar">
          <h2 className="sidebar-title">회의실 예약</h2>
          <button type="button" className="btn-create" onClick={handleCreateClick}>
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
            onEventDrop={handleEventDrop}
            onEventResize={handleEventResize}
          />
        </main>
      </div>

      <ReservationModal
        isOpen={modalOpen}
        initialDate={modalInitialDate}
        initialEvent={modalInitialEvent}
        rooms={MOCK_ROOMS}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveReservation}
      />
    </div>
  )
}
