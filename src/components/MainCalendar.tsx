import { useMemo, useEffect, useRef, useState, useCallback } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { EventClickArg, EventDropArg } from '@fullcalendar/core'
import type { DateClickArg } from '@fullcalendar/interaction'
import type { EventResizeDoneArg } from '@fullcalendar/interaction'
import type { EventInput } from '@fullcalendar/core'
import type { ReservationEvent } from '../types'
import { STATUS_APPROVED, STATUS_REJECTED } from '../api/reservations'

function isMoveLockedStatus(status: unknown): boolean {
  const s = Number(status)
  return s === STATUS_REJECTED || s === STATUS_APPROVED
}

/** YYYY-MM-DD → 해당 날짜의 시/분/초를 원본 Date와 동일하게 맞춘 새 Date (로컬 기준) */
function setDateKeepTime(targetDate: Date, yyyyMmDd: string): Date {
  const [y, m, d] = yyyyMmDd.split('-').map(Number)
  return new Date(
    y,
    m - 1,
    d,
    targetDate.getHours(),
    targetDate.getMinutes(),
    targetDate.getSeconds(),
    targetDate.getMilliseconds()
  )
}

interface MainCalendarProps {
  events: ReservationEvent[]
  currentDate: Date
  /** 캘린더 최초/리마운트 시 유지할 뷰 타입 (dayGridMonth | timeGridWeek | timeGridDay) */
  initialView?: string
  /**
   * true: 월/주/일 버튼 클릭 시 오늘 날짜로 이동 후 해당 뷰 표시.
   * false: 현재 캘린더가 보고 있는 기준일 유지한 뷰만 전환.
   */
  snapToTodayOnViewChange?: boolean
  onDateClick: (date: Date) => void
  onEventClick: (event: ReservationEvent) => void
  onNavigate: (date: Date) => void
  /** 뷰 전환 시 현재 뷰 타입을 부모에 알림 */
  onViewChange?: (viewType: string) => void
  /** 월/주/일 클릭으로 오늘로 점프할 때 부모 state(미니캘린더 등) 동기화 */
  onSnapToToday?: () => void
  /** 메인 캘린더 prev/next로 기간 이동 시 (사용자가 표시 기준을 직접 잡음) */
  onCalendarRangeNavigated?: () => void
  onTodayClick?: () => void
  /** false면 날짜/이벤트 드래그·리사이즈 비활성화 (예: join !== 110 인 사용자) */
  editable?: boolean
  /** 드래그로 이벤트 시간 이동 시 호출 (이벤트, 새 시작, 새 종료) */
  onEventDrop?: (event: ReservationEvent, start: Date, end: Date) => void
  /** 월 보기에서 이동 불가 시 호출 (onEventDrop 호출 없이 에러만 표시 → 원위치 유지). message 있으면 해당 문구, 없으면 기본 문구 */
  onEventDropNotAllowed?: (message?: string) => void
  /** 리사이즈로 이벤트 기간 변경 시 호출 */
  onEventResize?: (event: ReservationEvent, start: Date, end: Date) => void
  /** 로그인 user_uid (월 보기 이동 권한: create_user와 같을 때만 onEventDrop 호출) */
  currentUserUid?: string | null
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
  initialView = 'dayGridMonth',
  snapToTodayOnViewChange = true,
  onDateClick,
  onEventClick,
  onNavigate,
  onViewChange,
  onSnapToToday,
  onCalendarRangeNavigated,
  onTodayClick,
  editable = true,
  onEventDrop,
  onEventDropNotAllowed,
  onEventResize,
  currentUserUid,
}: MainCalendarProps) {
  const calendarRef = useRef<FullCalendar>(null)
  const calendarEvents = useMemo(() => toCalendarEvents(events), [events])
  const [currentViewType, setCurrentViewType] = useState<string>(initialView)
  const [contentHeight, setContentHeight] = useState<number>(560)
  /** 월 보기 전용: eventDrop가 안 불리므로 mouseup 시 드롭 위치를 직접 찾아 onEventDrop 호출 */
  const monthDragRef = useRef<{
    raw: ReservationEvent
    listener: (e: MouseEvent) => void
  } | null>(null)

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
    setCurrentViewType(initialView)
  }, [initialView])

  useEffect(() => {
    const calc = () => setContentHeight(Math.max(400, window.innerHeight - 220))
    calc()
    window.addEventListener('resize', calc)
    return () => window.removeEventListener('resize', calc)
  }, [])

  useEffect(() => {
    return () => {
      if (monthDragRef.current) {
        document.removeEventListener('mouseup', monthDragRef.current.listener, true)
        monthDragRef.current = null
      }
    }
  }, [])

  const handleDateClick = (arg: DateClickArg) => {
    onDateClick(arg.date)
  }

  const handleEventClick = (arg: EventClickArg) => {
    const raw = arg.event.extendedProps?.raw as ReservationEvent | undefined
    if (raw) onEventClick(raw)
  }

  const handleEventDrop = useCallback(
    (arg: EventDropArg) => {
      /* 주/일 보기에서만 호출됨. 월 보기는 아래 eventDragStart + mouseup 로 처리 */
      if (monthDragRef.current) {
        document.removeEventListener('mouseup', monthDragRef.current.listener, true)
        monthDragRef.current = null
      }
      const start = arg.event.start
      const rawEnd = arg.event.end
      const end = rawEnd ?? (start ? new Date(start.getTime() + 30 * 60 * 1000) : null)
      const raw = arg.event.extendedProps?.raw as ReservationEvent | undefined
      if (isMoveLockedStatus(raw?.extendedProps?.status)) {
        arg.revert()
        onEventDropNotAllowed?.('승인/반려된 예약은 이동할 수 없습니다.')
        return
      }
      if (start && end && raw && onEventDrop) onEventDrop(raw, start, end)
    },
    [onEventDrop, onEventDropNotAllowed]
  )

  const handleEventResize = (arg: EventResizeDoneArg) => {
    const start = arg.event.start
    const end = arg.event.end
    const raw = arg.event.extendedProps?.raw as ReservationEvent | undefined
    if (isMoveLockedStatus(raw?.extendedProps?.status)) {
      arg.revert()
      onEventDropNotAllowed?.('승인/반려된 예약은 이동할 수 없습니다.')
      return
    }
    if (start && end && raw && onEventResize) onEventResize(raw, start, end)
  }

  const changeMainView = useCallback(
    (viewType: string) => {
      const api = calendarRef.current?.getApi()
      if (!api) return
      if (snapToTodayOnViewChange) {
        api.changeView(viewType)
        api.today()
        onSnapToToday?.()
      } else {
        api.changeView(viewType)
      }
    },
    [snapToTodayOnViewChange, onSnapToToday]
  )

  return (
    <div className="main-calendar-wrap">
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView={initialView}
        customButtons={{
          myToday: {
            text: '오늘',
            click: () => {
              const api = calendarRef.current?.getApi()
              if (api) api.gotoDate(new Date())
              onTodayClick?.()
            },
          },
          myPrev: {
            text: '‹',
            click: () => {
              const api = calendarRef.current?.getApi()
              if (!api) return
              api.prev()
              onCalendarRangeNavigated?.()
            },
          },
          myNext: {
            text: '›',
            click: () => {
              const api = calendarRef.current?.getApi()
              if (!api) return
              api.next()
              onCalendarRangeNavigated?.()
            },
          },
          myMonth: {
            text: '월',
            click: () => changeMainView('dayGridMonth'),
          },
          myWeek: {
            text: '주',
            click: () => changeMainView('timeGridWeek'),
          },
          myDay: {
            text: '일',
            click: () => changeMainView('timeGridDay'),
          },
        }}
        headerToolbar={{
          left: 'myToday myPrev,myNext',
          center: 'title',
          right: 'myMonth,myWeek,myDay',
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
        eventStartEditable={editable}
        eventDurationEditable={editable}
        dateClick={handleDateClick}
        eventClick={handleEventClick}
        eventDragStart={(arg) => {
          const viewType = arg.view.type
          const raw = arg.event.extendedProps?.raw as ReservationEvent | undefined
          if (viewType !== 'dayGridMonth' || !raw || !onEventDrop) return
          if (monthDragRef.current) {
            document.removeEventListener('mouseup', monthDragRef.current.listener, true)
            monthDragRef.current = null
          }
          const listener = (ev: MouseEvent) => {
            document.removeEventListener('mouseup', listener, true)
            const cur = monthDragRef.current
            monthDragRef.current = null
            if (!cur || cur.raw !== raw) return
            const el = document.elementFromPoint(ev.clientX, ev.clientY)
            const dayCell = el?.closest?.('.fc-daygrid-day')
            const dataDate = dayCell?.getAttribute?.('data-date') // YYYY-MM-DD
            if (!dataDate || !/^\d{4}-\d{2}-\d{2}$/.test(dataDate)) return
            if (isMoveLockedStatus(raw.extendedProps?.status)) {
              onEventDropNotAllowed?.('승인/반려된 예약은 이동할 수 없습니다.')
              return
            }
            const createUser = raw.extendedProps?.createUser
            if (currentUserUid != null && createUser != null && createUser !== currentUserUid) {
              onEventDropNotAllowed?.()
              return
            }
            const origStart = new Date(raw.start)
            const origEnd = new Date(raw.end)
            const newStart = setDateKeepTime(origStart, dataDate)
            const newEnd = setDateKeepTime(origEnd, dataDate)
            onEventDrop(raw, newStart, newEnd)
          }
          document.addEventListener('mouseup', listener, { capture: true })
          monthDragRef.current = { raw, listener }
        }}
        eventDrop={handleEventDrop}
        eventResize={handleEventResize}
        datesSet={({ view }) => {
          setCurrentViewType((prev) => (prev === view.type ? prev : view.type))
          onViewChange?.(view.type)
          if (view.type === 'dayGridMonth') {
            const d = view.currentStart
            if (d) onNavigate(d)
          }
        }}
        eventContent={(arg) => {
          const viewType = arg.view?.type ?? currentViewType
          /* 월 보기에서는 기본 렌더링 사용 (return true) */
          if (viewType === 'dayGridMonth') return true
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
        slotDuration="00:30:00"
        slotLabelInterval="01:00:00"
        snapDuration="00:15:00"
        scrollTime="12:00:00"
        scrollTimeReset={false}
        /** 주/일(timeGrid) 보기에서 현재 시각 가로선 표시 */
        nowIndicator
        nowIndicatorSnap
      />
    </div>
  )
}
