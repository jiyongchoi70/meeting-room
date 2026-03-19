import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef } from 'ag-grid-community'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'
import type { ReservationRow, ReservationEvent, RoomForReservation } from '../types'
import type { LookupValue } from '../types'
import { useAuth } from '../hooks/useAuth'
import { fetchMrUserByUid } from '../api/users'
import { fetchRoomsForReservation, fetchApproversByRoomIds } from '../api/rooms'
import {
  fetchReservationList,
  fetchRoomOptionsForReservationStatus,
  fetchApprovalStatusOptions,
  batchUpdateReservationStatus,
  fetchReservationIdsForStatusUpdate,
  updateReservation,
  deleteReservation,
  deleteReservationThisAndFollowing,
  deleteReservationAllInGroup,
  STATUS_APPROVED,
  STATUS_REJECTED,
  type ReservationListFilters,
  type SaveReservationPayload,
} from '../api/reservations'
import ReservationModal from './ReservationModal'
import '../common_code.css'
import '../App.css'

const ADMIN_USER_TYPE = 110

/** 오늘 날짜 YYYY-MM-DD (로컬) - type="date" value용 */
function defaultStartDate(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 오늘 + 3개월 YYYY-MM-DD (로컬) */
function defaultEndDate(): string {
  const d = new Date()
  d.setMonth(d.getMonth() + 3)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function ReservationsSection() {
  const { user: authUser } = useAuth()
  const gridRef = useRef<AgGridReact<ReservationRow>>(null)
  const [mrUser, setMrUser] = useState<{ user_type: number | null } | null>(null)
  const [filters, setFilters] = useState<ReservationListFilters>({
    startDate: defaultStartDate(),
    endDate: defaultEndDate(),
    roomId: null,
    applicant: '',
    status: null,
  })
  const [roomOptions, setRoomOptions] = useState<{ room_id: string; room_nm: string }[]>([])
  const [statusOptions, setStatusOptions] = useState<LookupValue[]>([])
  const [rows, setRows] = useState<ReservationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalInitialEvent, setModalInitialEvent] = useState<ReservationEvent | null>(null)
  const [roomsForReservation, setRoomsForReservation] = useState<RoomForReservation[]>([])
  const [approversForModalRoom, setApproversForModalRoom] = useState<string[]>([])
  const [reservationError, setReservationError] = useState<string | null>(null)

  const isAdmin = mrUser?.user_type === ADMIN_USER_TYPE
  const userUid = authUser?.id ?? ''

  useEffect(() => {
    if (!authUser?.id) return
    let cancelled = false
    fetchMrUserByUid(authUser.id)
      .then((u) => {
        if (!cancelled && u) setMrUser({ user_type: u.user_type ?? null })
        if (!cancelled && !u) setMrUser(null)
      })
      .catch(() => {
        if (!cancelled) setMrUser(null)
      })
    return () => { cancelled = true }
  }, [authUser?.id])

  const loadRoomAndStatusOptions = useCallback(async () => {
    if (!userUid) return
    try {
      const [rooms, statuses] = await Promise.all([
        fetchRoomOptionsForReservationStatus(isAdmin, userUid),
        fetchApprovalStatusOptions(),
      ])
      setRoomOptions(rooms)
      setStatusOptions(statuses)
    } catch (e) {
      console.error(e)
    }
  }, [userUid, isAdmin])

  useEffect(() => {
    loadRoomAndStatusOptions()
  }, [loadRoomAndStatusOptions])

  const loadList = useCallback(async () => {
    if (!userUid) return
    setLoading(true)
    setError(null)
    try {
      const data = await fetchReservationList(filters, isAdmin, userUid)
      setRows(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : '예약 목록 조회 실패')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [filters, isAdmin, userUid])

  useEffect(() => {
    if (!userUid || mrUser == null) return
    loadList()
  }, [loadList, userUid, mrUser])

  useEffect(() => {
    fetchRoomsForReservation()
      .then(setRoomsForReservation)
      .catch(() => setRoomsForReservation([]))
  }, [])

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

  const rowToEvent = useCallback((row: ReservationRow): ReservationEvent => {
    const start = typeof row.start_ymd === 'string' && row.start_ymd.length > 10
      ? row.start_ymd
      : `${String(row.start_ymd).slice(0, 10)}T00:00:00.000Z`
    const end = typeof row.end_ymd === 'string' && row.end_ymd.length > 10
      ? row.end_ymd
      : row.allday_yn === 'Y'
        ? `${String(row.end_ymd).slice(0, 10)}T23:59:59.999Z`
        : `${String(row.end_ymd).slice(0, 10)}T00:00:00.000Z`
    return {
      id: row.reservation_id,
      title: row.title ?? '',
      start,
      end,
      roomId: row.room_id,
      roomName: row.room_nm ?? '',
      extendedProps: {
        isAllDay: row.allday_yn === 'Y',
        reservationId: row.reservation_id,
        createUser: row.create_user,
        status: row.status ?? undefined,
        repeatGroupId: row.repeat_group_id ?? undefined,
        startYmd: String(row.start_ymd).slice(0, 10),
        bookerName: row.applicant_name || undefined,
        bookerPositionName: row.applicant_position_nm || undefined,
        bookerPhone: row.applicant_phone || undefined,
      },
    }
  }, [])

  const handleSearch = useCallback(() => {
    loadList()
  }, [loadList])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }, [])

  const handleBatchApprove = useCallback(async () => {
    if (!userUid) {
      showToast('로그인 후 이용해 주세요.')
      return
    }
    const api = gridRef.current?.api
    const selected = api?.getSelectedRows() ?? []
    const ids = selected.map((r) => r.reservation_id).filter(Boolean)
    if (ids.length === 0) {
      showToast('선택된 행이 없습니다.')
      return
    }
    try {
      await batchUpdateReservationStatus(ids, STATUS_APPROVED, userUid)
      api?.deselectAll()
      showToast(`${ids.length}건 승인되었습니다.`)
      loadList()
    } catch (e) {
      showToast(e instanceof Error ? e.message : '승인 처리 실패')
    }
  }, [loadList, showToast, userUid])

  const handleBatchReject = useCallback(async () => {
    if (!userUid) {
      showToast('로그인 후 이용해 주세요.')
      return
    }
    const api = gridRef.current?.api
    const selected = api?.getSelectedRows() ?? []
    const ids = selected.map((r) => r.reservation_id).filter(Boolean)
    if (ids.length === 0) {
      showToast('선택된 행이 없습니다.')
      return
    }
    try {
      await batchUpdateReservationStatus(ids, STATUS_REJECTED, userUid)
      api?.deselectAll()
      showToast(`${ids.length}건 반려되었습니다.`)
      loadList()
    } catch (e) {
      showToast(e instanceof Error ? e.message : '반려 처리 실패')
    }
  }, [loadList, showToast, userUid])

  const handleSaveFromModal = useCallback(
    async (data: {
      title: string
      start: Date
      end: Date
      roomId: string
      roomName: string
      isAllDay?: boolean
      recurrenceCd?: number | null
      recurrenceEndYmd?: string | null
      cycleNumber?: number
      cycleUnitCd?: number | null
      selectedDays?: boolean[]
      repeatCondition?: string | null
    }) => {
      const reservationId = modalInitialEvent?.extendedProps?.reservationId
      if (!reservationId) return
      const sd = data.selectedDays
      const payload: SaveReservationPayload = {
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
      try {
        await updateReservation(reservationId, payload)
        loadList()
        setModalOpen(false)
      } catch (err) {
        setReservationError(err instanceof Error ? err.message : '예약 수정에 실패했습니다.')
      }
    },
    [modalInitialEvent?.extendedProps?.reservationId, loadList]
  )

  const handleApproveFromModal = useCallback(
    async (reservationId: string, repeatGroupId?: string | null) => {
      if (!userUid) return
      try {
        const ids = await fetchReservationIdsForStatusUpdate(reservationId, repeatGroupId)
        await batchUpdateReservationStatus(ids, STATUS_APPROVED, userUid)
        loadList()
        setModalOpen(false)
      } catch (err) {
        setReservationError(err instanceof Error ? err.message : '승인 처리에 실패했습니다.')
      }
    },
    [userUid, loadList]
  )

  const handleRejectFromModal = useCallback(
    async (
      reservationId: string,
      repeatGroupId?: string | null,
      returnComment?: string
    ) => {
      if (!userUid) return
      try {
        const ids = await fetchReservationIdsForStatusUpdate(reservationId, repeatGroupId)
        await batchUpdateReservationStatus(ids, STATUS_REJECTED, userUid, returnComment ?? null)
        loadList()
        setModalOpen(false)
      } catch (err) {
        setReservationError(err instanceof Error ? err.message : '반려 처리에 실패했습니다.')
      }
    },
    [userUid, loadList]
  )

  const handleExcelDownload = useCallback(() => {
    const headers = [
      '순서',
      '제목',
      '회의실명',
      '시작일',
      '종료일',
      '신청자',
      '결재상태',
      '반복',
      '승인자',
      '종일',
    ]
    const dataRows = rows.map((r, i) => [
      i + 1,
      r.title ?? '',
      r.room_nm ?? '',
      r.start_date_time ?? '',
      r.end_date_time ?? '',
      r.applicant_name ?? '',
      r.status_nm ?? '',
      r.repeat_yn ?? '',
      r.approver_name ?? '',
      r.allday_yn ?? '',
    ])
    const BOM = '\uFEFF'
    const csv =
      BOM +
      [headers.join(','), ...dataRows.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join(
        '\r\n'
      )
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `예약현황_${filters.startDate}_${filters.endDate}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }, [rows, filters.startDate, filters.endDate])

  /** repeat_group_id가 같은 인접 행만 셀 병합 (선택/순서/제목 열 공통) */
  const spanRowsByRepeatGroup = useCallback(
    (params: {
      valueA?: unknown
      valueB?: unknown
      dataA?: ReservationRow
      dataB?: ReservationRow
      rowNodeA?: { data?: ReservationRow }
      rowNodeB?: { data?: ReservationRow }
    }) => {
      const a = params.dataA ?? params.rowNodeA?.data
      const b = params.dataB ?? params.rowNodeB?.data
      if (a && b) {
        const idA = a.repeat_group_id
        const idB = b.repeat_group_id
        if (idA != null && idB != null && String(idA) === String(idB)) return true
      }
      return params.valueA === params.valueB
    },
    []
  )

  const columnDefs = useMemo<ColDef<ReservationRow>[]>(
    () => [
      {
        colId: 'seq',
        headerName: '순서',
        // 병합 기준: 같은 repeat_group_id/reservation_id면 동일 값 → spanRows: true로 셀 병합됨
        valueGetter: (params) =>
          params.data
            ? String(params.data.repeat_group_id ?? params.data.reservation_id ?? '')
            : '',
        valueFormatter: () => '', // 값(UUID)은 병합용으로만 쓰고, 화면에는 표시하지 않음
        cellRenderer: (params) =>
          params.node?.rowIndex != null ? String(params.node.rowIndex + 1) : '',
        tooltipValueGetter: (params) =>
          params.node?.rowIndex != null ? String(params.node.rowIndex + 1) : '',
        width: 70,
        maxWidth: 80,
        pinned: 'left',
        spanRows: true,
      },
      {
        field: 'title',
        headerName: '제목',
        width: 200,
        maxWidth: 200,
        cellStyle: { cursor: 'pointer', textDecoration: 'underline', color: '#1a73e8' },
        tooltipField: 'title',
        pinned: 'left',
        spanRows: spanRowsByRepeatGroup,
      },
      {
        field: 'room_nm',
        headerName: '회의실명',
        width: 200,
        maxWidth: 200,
        tooltipField: 'room_nm',
        pinned: 'left',
      },
      {
        field: 'start_date_time',
        headerName: '시작일',
        flex: 1,
        minWidth: 160,
        tooltipField: 'start_date_time',
      },
      {
        field: 'end_date_time',
        headerName: '종료일',
        flex: 1,
        minWidth: 160,
        tooltipField: 'end_date_time',
      },
      { field: 'applicant_name', headerName: '신청자', width: 90, tooltipField: 'applicant_name' },
      { field: 'status_nm', headerName: '결재상태', width: 90, tooltipField: 'status_nm' },
      { field: 'repeat_yn', headerName: '반복', width: 65, tooltipField: 'repeat_yn' },
      { field: 'approver_name', headerName: '승인자', width: 90, tooltipField: 'approver_name' },
      { field: 'allday_yn', headerName: '종일', width: 65, tooltipField: 'allday_yn' },
    ],
    [spanRowsByRepeatGroup]
  )

  return (
    <div className="common-code-container users-section reservations-section">
      <header className="users-header">
        <h2 className="section-header">예약현황</h2>
        <Link to="/admin" className="common-code-home-btn">
          홈
        </Link>
      </header>

      {error && (
        <div className="users-error" role="alert">
          {error}
        </div>
      )}

      {toast && (
        <div className="reservations-toast" role="status">
          {toast}
        </div>
      )}

      <div className="search-form search-form--reservations">
        <label className="reservations-date-range-label">
          시작일
          <span className="reservations-date-range-inputs">
            <input
              type="date"
              value={filters.startDate || defaultStartDate()}
              onChange={(e) => setFilters((p) => ({ ...p, startDate: e.target.value }))}
              aria-label="시작일"
            />
            <span className="reservations-date-sep">~</span>
            <input
              type="date"
              value={filters.endDate || defaultEndDate()}
              onChange={(e) => setFilters((p) => ({ ...p, endDate: e.target.value }))}
              aria-label="종료일"
            />
          </span>
        </label>
        <label>
          회의실명
          <select
            className="reservations-room-select"
            value={filters.roomId ?? ''}
            onChange={(e) =>
              setFilters((p) => ({
                ...p,
                roomId: e.target.value === '' ? null : e.target.value,
              }))
            }
          >
            <option value="">전체</option>
            {roomOptions.map((r) => (
              <option key={r.room_id} value={r.room_id}>
                {r.room_nm}
              </option>
            ))}
          </select>
        </label>
        <label>
          신청자
          <input
            type="text"
            className="search-form-input-narrow"
            value={filters.applicant}
            onChange={(e) => setFilters((p) => ({ ...p, applicant: e.target.value }))}
            placeholder="신청자"
          />
        </label>
        <label>
          결재상태
          <select
            className="reservations-status-select"
            value={filters.status ?? ''}
            onChange={(e) =>
              setFilters((p) => ({
                ...p,
                status: e.target.value === '' ? null : Number(e.target.value),
              }))
            }
          >
            <option value="">전체</option>
            {statusOptions.map((o) => (
              <option key={o.lookup_value_id} value={o.lookup_value_cd}>
                {o.lookup_value_nm}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="search-button" onClick={handleSearch}>
          조회
        </button>
        <div className="search-form-right-actions">
          <button type="button" className="batch-approve-button" onClick={handleBatchApprove}>
            일괄승인
          </button>
          <button type="button" className="batch-reject-button" onClick={handleBatchReject}>
            일괄반려
          </button>
          <button type="button" className="export-excel-button" onClick={handleExcelDownload}>
            엑셀 다운로드
          </button>
        </div>
      </div>

      {!userUid || mrUser == null ? (
        <p className="users-loading">불러오는 중…</p>
      ) : (
        <div className="detail-section" style={{ position: 'relative' }}>
          {loading && (
            <div
              className="reservations-grid-loading-overlay"
              aria-live="polite"
            >
              불러오는 중…
            </div>
          )}
          <div
            id="reservationsGrid"
            className="ag-theme-alpine"
            style={{ width: '100%', height: '500px' }}
          >
            <AgGridReact<ReservationRow>
              ref={gridRef}
              rowData={rows}
              columnDefs={columnDefs}
              getRowId={(p) => p.data.reservation_id}
              enableCellSpan
              onCellClicked={(e) => {
                if (e.column?.getColId() === 'title' && e.data) {
                  setModalInitialEvent(rowToEvent(e.data))
                  setModalOpen(true)
                }
              }}
              rowSelection={{
                mode: 'multiRow',
                checkboxes: true,
                isRowSelectable: (params) => params.data?.selectable === true,
              }}
              selectionColumnDef={{
                pinned: 'left',
                width: 50,
                maxWidth: 55,
                suppressHeaderMenuButton: true,
                // 같은 그룹이면 한 셀로 병합 (값은 표시하지 않음)
                valueGetter: (params: { data?: ReservationRow }) =>
                  params.data
                    ? String(params.data.repeat_group_id ?? params.data.reservation_id ?? '')
                    : '',
                valueFormatter: () => '',
                spanRows: true,
              }}
              onGridReady={(e) => {
                const cols = e.api.getColumns()
                const autoCol = cols?.find((c) => c.getColId() === 'ag-Grid-AutoColumn')
                if (autoCol) {
                  e.api.moveColumns([autoCol.getColId()], 0)
                } else if (cols && cols.length > 3) {
                  e.api.moveColumnByIndex(3, 0)
                }
              }}
              theme="legacy"
              suppressCellFocus
              domLayout="normal"
              rowHeight={39}
              headerHeight={39}
              overlayNoRowsTemplate="조회 결과가 없습니다"
              pagination
              paginationPageSize={20}
              paginationPageSizeSelector={[10, 20, 50, 100]}
            />
          </div>
        </div>
      )}

      <ReservationModal
        isOpen={modalOpen}
        initialEvent={modalInitialEvent}
        rooms={roomsForReservation}
        currentUserUid={userUid || undefined}
        isAdmin={isAdmin}
        isApproverForRoom={Boolean(userUid && approversForModalRoom.includes(userUid))}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveFromModal}
        onApprove={handleApproveFromModal}
        onReject={handleRejectFromModal}
        onDelete={async (reservationId) => {
          try {
            await deleteReservation(reservationId)
            loadList()
            setModalOpen(false)
          } catch (err) {
            setReservationError(err instanceof Error ? err.message : '예약 삭제에 실패했습니다.')
          }
        }}
        onDeleteRecurring={async ({ reservationId, repeatGroupId, scope }) => {
          try {
            if (scope === 'this') {
              await deleteReservation(reservationId)
            } else if (scope === 'thisAndFollowing') {
              await deleteReservationThisAndFollowing(reservationId)
            } else {
              await deleteReservationAllInGroup(repeatGroupId)
            }
            loadList()
            setModalOpen(false)
          } catch (err) {
            setReservationError(err instanceof Error ? err.message : '예약 삭제에 실패했습니다.')
          }
        }}
      />

      {reservationError != null && (
        <div
          className="modal-overlay"
          onClick={() => setReservationError(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="reservation-modal reservation-error-modal"
            onClick={(e) => e.stopPropagation()}
          >
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
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => setReservationError(null)}
                >
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
