import { useMemo, useEffect, useRef, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { EventClickArg, EventDropArg } from '@fullcalendar/core'
import type { DateClickArg } from '@fullcalendar/interaction'
import type { EventResizeDoneArg } from '@fullcalendar/interaction'
import type { EventInput } from '@fullcalendar/core'
import type { ReservationEvent } from '../types'

interface MainCalendarProps {
  events: ReservationEvent[]
  currentDate: Date
  onDateClick: (date: Date) => void
  onEventClick: (event: ReservationEvent) => void
  onNavigate: (date: Date) => void
  onTodayClick?: () => void
  /** false면 날짜/이벤트 드래그·리사이즈 비활성화 (예: join !== 110 인 사용자) */
  editable?: boolean
  /** 드래그로 이벤트 시간 이동 시 호출 (eventId, 새 시작, 새 종료) */
  onEventDrop?: (eventId: string, start: Date, end: Date) => void
  /** 리사이즈로 이벤트 기간 변경 시 호출 */
  onEventResize?: (eventId: string, start: Date, end: Date) => void
}

function toCalendarEvents(events: ReservationEvent[]): EventInput[] {
  return events.map((e) => ({
    id: e.id,
    title: e.title,
    start: e.start,
    end: e.end,
    allDay: e.extendedProps?.isAllDay ?? false,
    backgroundColor: e.extendedProps?.color,
    borderColor: e.extendedProps?.color,
    extendedProps: { raw: e },
  }))
}

export default function MainCalendar({
  events,
  currentDate,
  onDateClick,
  onEventClick,
  onNavigate,
  onTodayClick,
  editable = true,
  onEventDrop,
  onEventResize,
}: MainCalendarProps) {
  const calendarRef = useRef<FullCalendar>(null)
  const calendarEvents = useMemo(() => toCalendarEvents(events), [events])
  const [currentViewType, setCurrentViewType] = useState<string>('dayGridMonth')
  const [contentHeight, setContentHeight] = useState<number>(560)

  useEffect(() => {
    const api = calendarRef.current?.getApi()
    if (!api) return
    const date = new Date(currentDate.getTime())
    let cancelled = false
    const id = setTimeout(() => {
      if (!cancelled) api.gotoDate(date)
    }, 0)
    return () => {
      cancelled = true
      clearTimeout(id)
    }
  }, [currentDate])

  useEffect(() => {
    const calc = () => setContentHeight(Math.max(400, window.innerHeight - 220))
    calc()
    window.addEventListener('resize', calc)
    return () => window.removeEventListener('resize', calc)
  }, [])

  const handleDateClick = (arg: DateClickArg) => {
    onDateClick(arg.date)
  }

  const handleEventClick = (arg: EventClickArg) => {
    const raw = arg.event.extendedProps?.raw as ReservationEvent | undefined
    if (raw) onEventClick(raw)
  }

  const handleEventDrop = (arg: EventDropArg) => {
    const start = arg.event.start
    const end = arg.event.end
    if (start && end && onEventDrop) {
      onEventDrop(arg.event.id, start, end)
    }
  }

  const handleEventResize = (arg: EventResizeDoneArg) => {
    const start = arg.event.start
    const end = arg.event.end
    if (start && end && onEventResize) {
      onEventResize(arg.event.id, start, end)
    }
  }

  return (
    <div className="main-calendar-wrap">
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        customButtons={{
          myToday: {
            text: '오늘',
            click: () => {
              const api = calendarRef.current?.getApi()
              if (api) api.gotoDate(new Date())
              onTodayClick?.()
            },
          },
        }}
        headerToolbar={{
          left: 'myToday prev,next',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay',
        }}
        buttonText={{
          month: '월',
          week: '주',
          day: '일',
        }}
        allDayText=""
        locale="ko"
        slotLabelContent={({ date }) => {
          const h = date.getHours()
          const ampm = h < 12 ? 'AM' : 'PM'
          const hour = h % 12 || 12
          return `${ampm} ${hour}시`
        }}
        initialDate={currentDate}
        events={calendarEvents}
        dayCellContent={({ date, view }) =>
          view.type === 'timeGridWeek' || view.type === 'timeGridDay'
            ? ''
            : new Date(date).getDate()
        }
        dayHeaderClassNames={({ date }) => {
          const day = new Date(date).getDay()
          if (day === 0) return ['fc-day-sunday']
          if (day === 6) return ['fc-day-saturday']
          if (day === 1) return ['fc-day-monday']
          return []
        }}
        editable={editable}
        dateClick={handleDateClick}
        eventClick={handleEventClick}
        eventDrop={handleEventDrop}
        eventResize={handleEventResize}
        datesSet={({ view }) => {
          setCurrentViewType((prev) => (prev === view.type ? prev : view.type))
          /* 월 뷰에서만 부모 currentDate 동기화. 주 뷰에서 onNavigate 호출 시
             useEffect의 gotoDate가 캘린더 이동을 덮어써 오른쪽(다음) 화살표가 동작하지 않는 문제 방지 */
          if (view.type === 'dayGridMonth') {
            const d = view.currentStart
            if (d) onNavigate(d)
          }
        }}
        eventContent={(arg) => {
          const time = arg.timeText
          const title = arg.event.title ?? ''
          const start = arg.event.start
          const end = arg.event.end
          const isMultiDay =
            start && end
              ? new Date(start).toDateString() !== new Date(end).toDateString()
              : false
          return (
            <div
              className={`fc-event-main-frame ${isMultiDay ? 'fc-event-multi-day' : 'fc-event-single-day'}`}
            >
              {time && <span className="fc-event-time">{time}</span>}
              <span className="fc-event-title">{title}</span>
            </div>
          )
        }}
        height={
          currentViewType === 'timeGridWeek' || currentViewType === 'timeGridDay'
            ? undefined
            : 'auto'
        }
        contentHeight={
          currentViewType === 'timeGridWeek' || currentViewType === 'timeGridDay'
            ? contentHeight
            : undefined
        }
        slotMinTime="00:00:00"
        slotMaxTime="24:00:00"
        scrollTime="12:00:00"
        scrollTimeReset={false}
      />
    </div>
  )
}
