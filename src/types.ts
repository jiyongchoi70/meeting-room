export interface MeetingRoom {
  id: string
  name: string
  capacity?: number
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
  }
}
