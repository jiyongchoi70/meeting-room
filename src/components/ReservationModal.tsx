import { useState, useEffect, useRef } from 'react'
import type { MeetingRoom, ReservationEvent } from '../types'

interface ReservationModalProps {
  isOpen: boolean
  initialDate?: Date | null
  initialEvent?: ReservationEvent | null
  rooms: MeetingRoom[]
  onClose: () => void
  onSave: (data: {
    title: string
    start: Date
    end: Date
    roomId: string
    roomName: string
    booker?: string
  }) => void
}

function formatDateLocal(date: Date): string {
  const y = date.getFullYear()
  const m = (date.getMonth() + 1).toString().padStart(2, '0')
  const d = date.getDate().toString().padStart(2, '0')
  return `${y}-${m}-${d}`
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

export default function ReservationModal({
  isOpen,
  initialDate,
  initialEvent,
  rooms,
  onClose,
  onSave,
}: ReservationModalProps) {
  const baseDate = initialDate || new Date()
  const [title, setTitle] = useState(initialEvent?.title ?? '')
  const [startDate, setStartDate] = useState(baseDate)
  const [endDate, setEndDate] = useState(baseDate)
  const [startTimeStr, setStartTimeStr] = useState('AM 9:00')
  const [endTimeStr, setEndTimeStr] = useState('AM 10:00')
  const [roomId, setRoomId] = useState(rooms[0]?.id ?? '')
  const [isAllDay, setIsAllDay] = useState(initialEvent?.extendedProps?.isAllDay ?? false)
  const skipNextSyncRef = useRef(false)

  useEffect(() => {
    if (!isOpen) return
    const d = initialDate || new Date()
    if (initialEvent) {
      setTitle(initialEvent.title)
      setStartDate(new Date(initialEvent.start))
      setEndDate(new Date(initialEvent.end))
      setStartTimeStr(formatTime(new Date(initialEvent.start)))
      setEndTimeStr(formatTime(new Date(initialEvent.end)))
      setRoomId(initialEvent.roomId)
      setIsAllDay(!!initialEvent.extendedProps?.isAllDay)
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
      setRoomId(rooms[0]?.id ?? '')
      setIsAllDay(false)
      skipNextSyncRef.current = true
    }
  }, [isOpen, initialDate, initialEvent, rooms])

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
  }, [isOpen, initialEvent, isAllDay, startDate, startTimeStr])

  const handleStartDateChange = (date: Date) => {
    setStartDate(date)
  }

  const handleStartTimeChange = (timeStr: string) => {
    setStartTimeStr(timeStr)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    const room = rooms.find((r) => r.id === roomId)
    if (!room) return

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

    onSave({
      title: title.trim(),
      start,
      end,
      roomId,
      roomName: room.name,
      booker: '현재 사용자',
    })
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal reservation-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{initialEvent ? '예약 수정' : '회의실 예약'}</h2>
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
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>시작일</label>
              <input
                type="date"
                value={formatDateLocal(startDate)}
                onChange={(e) => handleStartDateChange(new Date(e.target.value))}
              />
            </div>
            {!isAllDay && (
              <div className="form-group">
                <label>시작 시간</label>
                <select
                  value={startTimeStr}
                  onChange={(e) => handleStartTimeChange(e.target.value)}
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
            <div className="form-group">
              <label>종료일</label>
              <input
                type="date"
                value={formatDateLocal(endDate)}
                onChange={(e) => setEndDate(new Date(e.target.value))}
              />
            </div>
            {!isAllDay && (
              <div className="form-group">
                <label>종료 시간</label>
                <select value={endTimeStr} onChange={(e) => setEndTimeStr(e.target.value)}>
                  {TIME_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={isAllDay}
                onChange={(e) => setIsAllDay(e.target.checked)}
              />
              종일
            </label>
          </div>
          <div className="form-group">
            <label>회의실</label>
            <select value={roomId} onChange={(e) => setRoomId(e.target.value)} required>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                  {r.capacity != null ? ` (${r.capacity})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="modal-actions">
            <button type="button" onClick={onClose}>
              취소
            </button>
            <button type="submit" className="btn-primary" disabled={!title.trim()}>
              저장
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
