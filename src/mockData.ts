import type { MeetingRoom, ReservationEvent } from './types'

export const MOCK_ROOMS: MeetingRoom[] = [
  { id: '1', name: '본당 2층 302호', capacity: 8 },
  { id: '2', name: 'Open회의실 411-4', capacity: 8 },
  { id: '3', name: '본관 1층 베들레헴', capacity: 12 },
  { id: '4', name: '본관 지하 비전홀', capacity: 30 },
]

// 데모용: 2026년 2월 고정 (화면설계서 기준)
const year = 2026
const month = 1 // 2월

function toISO(date: Date, hour: number, minute: number): string {
  const d = new Date(date)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

export const MOCK_EVENTS: ReservationEvent[] = [
  {
    id: '1',
    title: '삼일제약 방문시연',
    start: toISO(new Date(year, month, 3), 10, 30),
    end: toISO(new Date(year, month, 3), 11, 30),
    roomId: '1',
    roomName: '본당 2층 302호',
    booker: '김담당',
  },
  {
    id: '2',
    title: 'GPRO 타운홀 미팅',
    start: toISO(new Date(year, month, 3), 10, 30),
    end: toISO(new Date(year, month, 3), 12, 0),
    roomId: '2',
    roomName: 'Open회의실 411-4',
    booker: '이팀장',
  },
  {
    id: '3',
    title: '운영미팅_실무',
    start: toISO(new Date(year, month, 5), 11, 0),
    end: toISO(new Date(year, month, 5), 12, 0),
    roomId: '1',
    roomName: '본당 2층 302호',
    booker: '박대리',
  },
  {
    id: '4',
    title: '[DevOps] 정투수 연차',
    start: toISO(new Date(year, month, 10), 0, 0),
    end: toISO(new Date(year, month, 12), 23, 59),
    roomId: '1',
    roomName: '본당 2층 302호',
    booker: '정투수',
    extendedProps: { color: '#5c6bc0' },
  },
  {
    id: '5',
    title: '[Marketing] 오진선 오후반차',
    start: toISO(new Date(year, month, 11), 14, 30),
    end: toISO(new Date(year, month, 11), 19, 0),
    roomId: '2',
    roomName: 'Open회의실 411-4',
    booker: '오진선',
    extendedProps: { color: '#5c6bc0' },
  },
  {
    id: '6',
    title: '설날 연휴',
    start: toISO(new Date(year, month, 16), 0, 0),
    end: toISO(new Date(year, month, 17), 23, 59),
    roomId: '1',
    roomName: '공휴일',
    extendedProps: { color: '#43a047', isAllDay: true },
  },
  {
    id: '7',
    title: '운영미팅_실무',
    start: toISO(new Date(year, month, 17), 10, 30),
    end: toISO(new Date(year, month, 17), 11, 30),
    roomId: '2',
    roomName: 'Open회의실 411-4',
    booker: '박대리',
  },
  {
    id: '8',
    title: '[User SUP & Svc] 이진 연차',
    start: toISO(new Date(year, month, 19), 0, 0),
    end: toISO(new Date(year, month, 20), 23, 59),
    roomId: '2',
    roomName: 'Open회의실 411-4',
    booker: '이진',
    extendedProps: { color: '#8e24aa' },
  },
  {
    id: '9',
    title: '운영미팅 실무',
    start: toISO(new Date(year, month, 24), 10, 30),
    end: toISO(new Date(year, month, 24), 11, 30),
    roomId: '1',
    roomName: '본당 2층 302호',
    booker: '박대리',
  },
  {
    id: '10',
    title: '[개발1팀] 최지용 오전반차',
    start: toISO(new Date(year, month, 26), 10, 0),
    end: toISO(new Date(year, month, 26), 14, 0),
    roomId: '1',
    roomName: '본당 2층 302호',
    booker: '최지용',
    extendedProps: { color: '#1e88e5' },
  },
]
