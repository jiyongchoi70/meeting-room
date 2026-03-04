import { useMemo } from 'react'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

interface MiniCalendarProps {
  currentDate: Date
  selectedDate: Date | null
  onDateSelect: (date: Date) => void
  onPrevMonth: () => void
  onNextMonth: () => void
}

export default function MiniCalendar({
  currentDate,
  selectedDate,
  onDateSelect,
  onPrevMonth,
  onNextMonth,
}: MiniCalendarProps) {
  const { year, month, days, startOffset } = useMemo(() => {
    const y = currentDate.getFullYear()
    const m = currentDate.getMonth()
    const first = new Date(y, m, 1)
    const last = new Date(y, m + 1, 0)
    const startOffset = first.getDay()
    const dayCount = last.getDate()
    const days = Array.from({ length: dayCount }, (_, i) => i + 1)
    return { year: y, month: m, days, startOffset }
  }, [currentDate])

  const today = new Date()
  const isToday = (day: number) =>
    today.getFullYear() === year && today.getMonth() === month && today.getDate() === day
  const isSelected = (day: number) =>
    selectedDate &&
    selectedDate.getFullYear() === year &&
    selectedDate.getMonth() === month &&
    selectedDate.getDate() === day

  return (
    <div className="mini-calendar">
      <div className="mini-calendar-header">
        <button type="button" onClick={onPrevMonth} aria-label="이전 달">
          ‹
        </button>
        <span>
          {year}년 {month + 1}월
        </span>
        <button type="button" onClick={onNextMonth} aria-label="다음 달">
          ›
        </button>
      </div>
      <div className="mini-calendar-weekdays">
        {WEEKDAYS.map((w) => (
          <span key={w} className="mini-calendar-weekday">
            {w}
          </span>
        ))}
      </div>
      <div className="mini-calendar-grid">
        {Array.from({ length: startOffset }, (_, i) => (
          <span key={`empty-${i}`} className="mini-calendar-day empty" />
        ))}
        {days.map((day) => (
          <button
            key={day}
            type="button"
            className={`mini-calendar-day ${isToday(day) ? 'today' : ''} ${isSelected(day) ? 'selected' : ''}`}
            onClick={() => onDateSelect(new Date(year, month, day))}
          >
            {day}
          </button>
        ))}
      </div>
    </div>
  )
}
