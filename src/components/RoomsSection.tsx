import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, ICellRendererParams } from 'ag-grid-community'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'
import type { MrRoom, MrUser, LookupValue } from '../types'
import { fetchLookupValuesByTypeCd } from '../api/lookup'
import { fromYmd } from '../api/lookup'
import {
  fetchRooms,
  fetchApproversByRoomIds,
  saveApprovers,
  insertRoom,
  updateRoom,
  deleteRoom,
  toYmd,
} from '../api/rooms'
import { fetchUsers } from '../api/users'
import { formatPhone } from '../api/users'
import '../common_code.css'

const LOOKUP_120 = 120 // 중복가능여부, 승인여부
const LOOKUP_130 = 130 // 직분 (승인자 팝업)
const LOOKUP_150 = 150 // 예약가능일
const RESERVATION_FROM_TODAY_CD = 110 // 현재일로부터 N일 (reservation_cnt 사용)
const RESERVATION_SPECIFIC_DATE_CD = 170 // 특정일 선택 시 코드

function getLookupName(
  options: LookupValue[],
  valueCd: number | null,
  dateYmd: string | null
): string {
  if (valueCd == null) return ''
  const ymd = (dateYmd ?? '').replace(/\D/g, '')
  const v = options.find((o) => o.lookup_value_cd === valueCd)
  if (!v) return ''
  if (ymd && v.start_ymd && String(v.start_ymd).replace(/-/g, '') > ymd) return ''
  if (ymd && v.end_ymd && String(v.end_ymd).replace(/-/g, '') < ymd) return ''
  return v.lookup_value_nm
}

/** 승인자 표시: user_name 오름차순 첫 번째 + " 외 N명" */
function formatApproverDisplay(users: MrUser[]): string {
  if (!users.length) return ''
  const sorted = [...users].sort((a, b) =>
    (a.user_name ?? '').localeCompare(b.user_name ?? '')
  )
  const first = sorted[0].user_name ?? ''
  if (sorted.length === 1) return first
  return `${first} 외 ${sorted.length - 1}명`
}

/** 수정 버튼 셀 렌더러 */
function EditCellRenderer(
  props: ICellRendererParams<MrRoom> & { onEdit?: (room: MrRoom) => void }
) {
  if (!props.data || !props.onEdit) return null
  return (
    <button
      type="button"
      className="edit-btn"
      onClick={(e) => {
        e.stopPropagation()
        props.onEdit!(props.data!)
      }}
    >
      수정
    </button>
  )
}

/** 삭제 버튼 셀 렌더러 */
function DeleteCellRenderer(
  props: ICellRendererParams<MrRoom> & { onDelete?: (room: MrRoom) => void }
) {
  if (!props.data || !props.onDelete) return null
  return (
    <button
      type="button"
      className="delete-btn"
      onClick={(e) => {
        e.stopPropagation()
        if (confirm('이 회의실을 삭제할까요?')) props.onDelete!(props.data!)
      }}
    >
      삭제
    </button>
  )
}

export default function RoomsSection() {
  const [rooms, setRooms] = useState<MrRoom[]>([])
  const [options120, setOptions120] = useState<LookupValue[]>([])
  const [options130, setOptions130] = useState<LookupValue[]>([])
  const [options150, setOptions150] = useState<LookupValue[]>([])
  const [approversByRoom, setApproversByRoom] = useState<Record<string, string[]>>({})
  const [users, setUsers] = useState<MrUser[]>([])
  const [roomNameFilter, setRoomNameFilter] = useState('')
  const [filteredRooms, setFilteredRooms] = useState<MrRoom[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editRoom, setEditRoom] = useState<MrRoom | null>(null)
  const [isAdd, setIsAdd] = useState(false)

  const loadRooms = useCallback(async () => {
    try {
      const data = await fetchRooms()
      setRooms(data)
      if (data.length > 0) {
        const approvers = await fetchApproversByRoomIds(data.map((r) => r.room_id))
        const map: Record<string, string[]> = {}
        approvers.forEach((a) => {
          if (!map[a.room_id]) map[a.room_id] = []
          map[a.room_id].push(a.user_uid)
        })
        setApproversByRoom(map)
      } else {
        setApproversByRoom({})
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '회의실 조회 실패')
    }
  }, [])

  const loadUsers = useCallback(async () => {
    try {
      const data = await fetchUsers()
      setUsers(data)
    } catch (e) {
      console.error(e)
    }
  }, [])

  const loadOptions = useCallback(async () => {
    try {
      const today = new Date().toISOString().slice(0, 10)
      const [a, b, c] = await Promise.all([
        fetchLookupValuesByTypeCd(LOOKUP_120, { validAt: today }),
        fetchLookupValuesByTypeCd(LOOKUP_130, { validAt: today }),
        fetchLookupValuesByTypeCd(LOOKUP_150, { validAt: today }),
      ])
      setOptions120(a)
      setOptions130(b)
      setOptions150(c)
    } catch (e) {
      setError(e instanceof Error ? e.message : '공통코드 조회 실패')
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([loadRooms(), loadOptions(), loadUsers()])
      .then(() => {})
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [loadRooms, loadOptions, loadUsers])

  useEffect(() => {
    if (!roomNameFilter.trim()) {
      setFilteredRooms(rooms)
      return
    }
    const q = roomNameFilter.trim().toLowerCase()
    setFilteredRooms(rooms.filter((r) => (r.room_nm ?? '').toLowerCase().includes(q)))
  }, [rooms, roomNameFilter])

  const handleSearch = () => {
    setFilteredRooms((prev) => [...prev])
  }

  const approverDisplayMap = useMemo(() => {
    const map: Record<string, string> = {}
    Object.keys(approversByRoom).forEach((roomId) => {
      const uids = approversByRoom[roomId] || []
      const list = users.filter((u) => uids.includes(u.user_uid))
      map[roomId] = formatApproverDisplay(list)
    })
    return map
  }, [approversByRoom, users])

  const handleExcelDownload = () => {
    const headers = [
      '순서',
      '회의실명',
      '중복가능여부',
      '예약가능일',
      '승인여부',
      '승인자',
      '인원수',
      '순서',
      '비고',
    ]
    const rows = filteredRooms.map((r, i) => {
      const resAvailableDisplay =
        r.reservation_available === RESERVATION_SPECIFIC_DATE_CD
          ? fromYmd(r.reservation_ymd)
          : r.reservation_available === RESERVATION_FROM_TODAY_CD && r.reservation_cnt != null
            ? `현재일로부터 ${r.reservation_cnt}일`
            : getLookupName(options150, r.reservation_available, r.create_ymd)
      return [
        i + 1,
        r.room_nm ?? '',
        getLookupName(options120, r.duplicate_yn, r.create_ymd),
        resAvailableDisplay,
        getLookupName(options120, r.confirm_yn, r.create_ymd),
        approverDisplayMap[r.room_id] ?? '',
        r.cnt ?? '',
        r.seq ?? '',
        r.remark ?? '',
      ]
    })
    const BOM = '\uFEFF'
    const csv =
      BOM +
      [
        headers.join(','),
        ...rows.map((r) =>
          r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')
        ),
      ].join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `회의실목록_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const handleDelete = useCallback(
    async (room: MrRoom) => {
      try {
        await deleteRoom(room.room_id)
        loadRooms()
      } catch (e) {
        setError(e instanceof Error ? e.message : '삭제 실패')
      }
    },
    [loadRooms]
  )

  const columnDefs = useMemo<ColDef<MrRoom>[]>(
    () => [
      {
        headerName: '순서',
        valueGetter: (params) =>
          params.node?.rowIndex != null ? params.node.rowIndex + 1 : '',
        width: 70,
        maxWidth: 80,
        pinned: 'left',
      },
      {
        field: 'room_nm',
        headerName: '회의실명',
        flex: 1,
        minWidth: 250,
        pinned: 'left',
        tooltipField: 'room_nm',
      },
      {
        headerName: '중복가능여부',
        valueGetter: (params) =>
          getLookupName(options120, params.data?.duplicate_yn ?? null, params.data?.create_ymd ?? null),
        tooltipValueGetter: (params) =>
          getLookupName(options120, params.data?.duplicate_yn ?? null, params.data?.create_ymd ?? null),
        width: 110,
      },
      {
        headerName: '예약가능일',
        valueGetter: (params) => {
          const r = params.data
          if (!r) return ''
          if (r.reservation_available === RESERVATION_SPECIFIC_DATE_CD)
            return fromYmd(r.reservation_ymd)
          if (r.reservation_available === RESERVATION_FROM_TODAY_CD && r.reservation_cnt != null)
            return `현재일로부터 ${r.reservation_cnt}일`
          return getLookupName(options150, r.reservation_available, r.create_ymd)
        },
        tooltipValueGetter: (params) => {
          const r = params.data
          if (!r) return ''
          if (r.reservation_available === RESERVATION_SPECIFIC_DATE_CD)
            return fromYmd(r.reservation_ymd)
          if (r.reservation_available === RESERVATION_FROM_TODAY_CD && r.reservation_cnt != null)
            return `현재일로부터 ${r.reservation_cnt}일`
          return getLookupName(options150, r.reservation_available, r.create_ymd)
        },
        flex: 1,
        minWidth: 140,
      },
      {
        headerName: '승인여부',
        valueGetter: (params) =>
          getLookupName(options120, params.data?.confirm_yn ?? null, params.data?.create_ymd ?? null),
        tooltipValueGetter: (params) =>
          getLookupName(options120, params.data?.confirm_yn ?? null, params.data?.create_ymd ?? null),
        width: 90,
      },
      {
        headerName: '승인자',
        valueGetter: (params) => approverDisplayMap[params.data?.room_id ?? ''] ?? '',
        tooltipValueGetter: (params) => approverDisplayMap[params.data?.room_id ?? ''] ?? '',
        flex: 1,
        minWidth: 100,
      },
      {
        headerName: '인원수',
        field: 'cnt',
        width: 80,
        tooltipField: 'cnt',
      },
      {
        headerName: '순서',
        field: 'seq',
        width: 80,
        tooltipField: 'seq',
      },
      {
        field: 'remark',
        headerName: '비고',
        flex: 1,
        minWidth: 80,
        tooltipField: 'remark',
      },
      {
        headerName: '수정',
        width: 80,
        cellRenderer: EditCellRenderer,
        cellRendererParams: {
          onEdit: (room: MrRoom) => {
            setEditRoom(room)
            setIsAdd(false)
          },
        },
      },
      {
        headerName: '삭제',
        width: 80,
        cellRenderer: DeleteCellRenderer,
        cellRendererParams: { onDelete: handleDelete },
      },
    ],
    [options120, options150, approverDisplayMap, handleDelete]
  )

  return (
    <div className="common-code-container users-section rooms-section">
      <header className="users-header">
        <h2 className="section-header">회의실관리</h2>
        <Link to="/admin" className="common-code-home-btn">
          홈
        </Link>
      </header>

      {error && (
        <div className="users-error" role="alert">
          {error}
        </div>
      )}

      <div className="search-form search-form--rooms">
        <label>
          회의실명
          <input
            type="text"
            className="search-form-input-narrow"
            value={roomNameFilter}
            onChange={(e) => setRoomNameFilter(e.target.value)}
            placeholder="회의실명"
          />
        </label>
        <button type="button" className="search-button" onClick={handleSearch}>
          조회
        </button>
        <div className="search-form-right-actions">
          <button
            type="button"
            className="export-excel-button"
            onClick={handleExcelDownload}
          >
            엑셀 다운로드
          </button>
          <button
            type="button"
            className="add-button"
            onClick={() => {
              setIsAdd(true)
              setEditRoom(null)
            }}
            title="회의실 추가"
          >
            +
          </button>
        </div>
      </div>

      {loading ? (
        <p className="users-loading">불러오는 중…</p>
      ) : (
        <div className="detail-section">
          <div
            id="roomsGrid"
            className="ag-theme-alpine"
            style={{ width: '100%', height: '500px' }}
          >
            <AgGridReact<MrRoom>
              rowData={filteredRooms}
              columnDefs={columnDefs}
              getRowId={(p) => p.data.room_id}
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

      {(editRoom || isAdd) && (
        <RoomEditModal
          room={editRoom}
          isAdd={isAdd}
          options120={options120}
          options130={options130}
          options150={options150}
          initialApproverUids={
            editRoom ? approversByRoom[editRoom.room_id] ?? [] : []
          }
          users={users}
          formatPhone={formatPhone}
          onClose={() => {
            setEditRoom(null)
            setIsAdd(false)
          }}
          onSaved={() => {
            loadRooms()
            setEditRoom(null)
            setIsAdd(false)
          }}
        />
      )}
    </div>
  )
}

function RoomEditModal({
  room,
  isAdd,
  options120,
  options130,
  options150,
  initialApproverUids,
  users,
  formatPhone,
  onClose,
  onSaved,
}: {
  room: MrRoom | null
  isAdd: boolean
  options120: LookupValue[]
  options130: LookupValue[]
  options150: LookupValue[]
  initialApproverUids: string[]
  users: MrUser[]
  formatPhone: (phone: string | null) => string
  onClose: () => void
  onSaved: () => void
}) {
  const [room_nm, setRoom_nm] = useState(room?.room_nm ?? '')
  const [duplicate_yn, setDuplicate_yn] = useState<number | null>(
    room?.duplicate_yn ?? null
  )
  const [reservation_available, setReservation_available] = useState<
    number | null
  >(room?.reservation_available ?? null)
  const [reservation_ymd, setReservation_ymd] = useState(
    room?.reservation_ymd ? fromYmd(room.reservation_ymd) : ''
  )
  const [reservation_cnt, setReservation_cnt] = useState(
    room?.reservation_available === RESERVATION_FROM_TODAY_CD && room?.reservation_cnt != null
      ? String(room.reservation_cnt)
      : ''
  )
  const [confirm_yn, setConfirm_yn] = useState<number | null>(
    room?.confirm_yn ?? null
  )
  const [approverUids, setApproverUids] = useState<string[]>(initialApproverUids)
  const [cnt, setCnt] = useState<string>(String(room?.cnt ?? ''))
  const [seq, setSeq] = useState<string>(String(room?.seq ?? ''))
  const [remark, setRemark] = useState(room?.remark ?? '')
  const [saving, setSaving] = useState(false)
  const [showApproverPopup, setShowApproverPopup] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  useEffect(() => {
    setRoom_nm(room?.room_nm ?? '')
    setDuplicate_yn(room?.duplicate_yn ?? null)
    setReservation_available(room?.reservation_available ?? null)
    setReservation_ymd(room?.reservation_ymd ? fromYmd(room.reservation_ymd) : '')
    setReservation_cnt(
      room?.reservation_available === RESERVATION_FROM_TODAY_CD && room?.reservation_cnt != null
        ? String(room.reservation_cnt)
        : ''
    )
    setConfirm_yn(room?.confirm_yn ?? null)
    setApproverUids(room ? initialApproverUids : [])
    setCnt(String(room?.cnt ?? ''))
    setSeq(String(room?.seq ?? ''))
    setRemark(room?.remark ?? '')
  }, [room, initialApproverUids])

  const approverDisplay = useMemo(
    () => formatApproverDisplay(users.filter((u) => approverUids.includes(u.user_uid))),
    [users, approverUids]
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setValidationError(null)

    if (!room_nm.trim()) {
      setValidationError('회의실명을 입력하세요.')
      return
    }
    if (duplicate_yn == null) {
      setValidationError('중복가능여부를 선택하세요.')
      return
    }
    if (
      reservation_available === RESERVATION_SPECIFIC_DATE_CD &&
      !reservation_ymd.trim()
    ) {
      setValidationError('예약가능일을 특정일로 선택한 경우 특정일을 입력하세요.')
      return
    }
    if (reservation_available === RESERVATION_FROM_TODAY_CD) {
      if (!reservation_cnt.trim()) {
        setValidationError('예약가능일을 "현재일로부터"로 선택한 경우 일수를 입력하세요.')
        return
      }
      const cntNum = parseInt(reservation_cnt, 10)
      if (Number.isNaN(cntNum) || cntNum < 1 || !/^\d+$/.test(reservation_cnt.trim())) {
        setValidationError('예약가능 일수는 1 이상의 숫자만 입력 가능합니다.')
        return
      }
    }
    if (!cnt.trim()) {
      setValidationError('인원수를 입력하세요.')
      return
    }
    const cntNum = parseInt(cnt, 10)
    if (Number.isNaN(cntNum) || cntNum < 0) {
      setValidationError('인원수는 0 이상의 숫자를 입력하세요.')
      return
    }
    if (!seq.trim()) {
      setValidationError('순서를 입력하세요.')
      return
    }
    const seqNum = parseInt(seq, 10)
    if (Number.isNaN(seqNum) || seqNum < 0) {
      setValidationError('순서는 0 이상의 숫자를 입력하세요.')
      return
    }

    setSaving(true)
    try {
      const payload = {
        room_nm: room_nm.trim(),
        duplicate_yn,
        reservation_available,
        reservation_ymd:
          reservation_available === RESERVATION_SPECIFIC_DATE_CD && reservation_ymd
            ? toYmd(reservation_ymd)
            : null,
        reservation_cnt:
          reservation_available === RESERVATION_FROM_TODAY_CD && reservation_cnt.trim()
            ? parseInt(reservation_cnt, 10)
            : null,
        confirm_yn,
        cnt: cntNum,
        remark: remark.trim() || null,
        seq: seqNum,
      }
      if (isAdd) {
        const created = await insertRoom(payload)
        await saveApprovers(created.room_id, approverUids)
      } else if (room) {
        await updateRoom(room.room_id, payload)
        await saveApprovers(room.room_id, approverUids)
      }
      onSaved()
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div
        className="modal"
        style={{ display: 'block' }}
        onClick={onClose}
      >
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>{isAdd ? '회의실 등록' : '회의실 수정'}</h3>
            <button
              type="button"
              className="modal-close close-button"
              onClick={onClose}
              aria-label="닫기"
            >
              ×
            </button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <table className="modal-form modal-form--rooms">
                <tbody>
                  <tr>
                    <td>
                      <span className="required-field">*</span>회의실명
                    </td>
                    <td>
                      <input
                        type="text"
                        className="modal-input"
                        value={room_nm}
                        onChange={(e) => setRoom_nm(e.target.value)}
                        placeholder="회의실명"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <span className="required-field">*</span>중복가능여부
                    </td>
                    <td>
                      <select
                        className="modal-select"
                        value={duplicate_yn ?? ''}
                        onChange={(e) =>
                          setDuplicate_yn(
                            e.target.value === '' ? null : Number(e.target.value)
                          )
                        }
                      >
                        <option value="">선택</option>
                        {options120.map((o) => (
                          <option
                            key={o.lookup_value_id}
                            value={o.lookup_value_cd}
                          >
                            {o.lookup_value_nm}
                          </option>
                        ))}
                      </select>
                      <span className="modal-note">
                        동일일자, 동일시간에 회의실 중복허용 여부
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td>예약가능일</td>
                    <td>
                      <select
                        className="modal-select"
                        value={reservation_available ?? ''}
                        onChange={(e) => {
                          const v =
                            e.target.value === ''
                              ? null
                              : Number(e.target.value)
                          setReservation_available(v)
                          if (v !== RESERVATION_SPECIFIC_DATE_CD)
                            setReservation_ymd('')
                          if (v !== RESERVATION_FROM_TODAY_CD)
                            setReservation_cnt('')
                        }}
                      >
                        <option value="">선택</option>
                        {options150.map((o) => (
                          <option
                            key={o.lookup_value_id}
                            value={o.lookup_value_cd}
                          >
                            {o.lookup_value_nm}
                          </option>
                        ))}
                      </select>
                      <span className="modal-note">
                        예약가능일을 control 하기 위함. 선택하지 않으면 2999-12-31까지 예약이 가능함
                        <br />
                        예) 현재일로부터 30일을 선택하면 예약시작일, 예약종료일이 <br />    현재일로부터 30일까지만 예약이 가능함
                      </span>
                      {reservation_available === RESERVATION_FROM_TODAY_CD && (
                        <div style={{ marginTop: 8 }}>
                          <label>
                            <span className="required-field">*</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              className="modal-input"
                              value={reservation_cnt}
                              onChange={(e) => {
                                const next = e.target.value.replace(/\D/g, '')
                                setReservation_cnt(next)
                              }}
                              placeholder="일수"
                              style={{ marginLeft: 4, width: 80 }}
                              maxLength={5}
                            />
                            <span style={{ marginLeft: 8 }}>일까지 예약 가능함</span>
                          </label>
                          <span className="modal-note" style={{ display: 'block', marginTop: 4 }}>
                            숫자만 입력 가능 (필수)
                          </span>
                        </div>
                      )}
                      {reservation_available === RESERVATION_SPECIFIC_DATE_CD && (
                        <div style={{ marginTop: 8 }}>
                          <label>
                            <span className="required-field">*</span>특정일
                            <input
                              type="date"
                              className="modal-input"
                              value={reservation_ymd}
                              onChange={(e) =>
                                setReservation_ymd(e.target.value)
                              }
                              style={{ marginLeft: 8, width: 'auto' }}
                            />
                            <span style={{ marginLeft: 8 }}>까지 예약 가능함</span>
                          </label>
                        </div>
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td>승인여부</td>
                    <td>
                      <select
                        className="modal-select"
                        value={confirm_yn ?? ''}
                        onChange={(e) =>
                          setConfirm_yn(
                            e.target.value === '' ? null : Number(e.target.value)
                          )
                        }
                      >
                        <option value="">선택</option>
                        {options120.map((o) => (
                          <option
                            key={o.lookup_value_id}
                            value={o.lookup_value_cd}
                          >
                            {o.lookup_value_nm}
                          </option>
                        ))}
                      </select>
                      <span className="modal-note">
                        예약시 승인이 필요한 회의실
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td>승인자</td>
                    <td>
                      <input
                        type="text"
                        className="modal-input"
                        value={approverDisplay}
                        readOnly
                        disabled
                        style={{ flex: 1, maxWidth: 200 }}
                      />
                      <button
                        type="button"
                        className="edit-btn"
                        style={{ marginLeft: 8 }}
                        onClick={() => setShowApproverPopup(true)}
                      >
                        등록
                      </button>
                      <span className="modal-note">
                        관리자이외의 승인자, 관리자는 모든 회의실에 승인자임 등록하지 않아도 됨
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <span className="required-field">*</span>인원수
                    </td>
                    <td>
                      <input
                        type="text"
                        className="modal-input"
                        value={cnt}
                        onChange={(e) =>
                          setCnt(e.target.value.replace(/\D/g, ''))
                        }
                        placeholder="회의실 사용 가능 인원"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <span className="required-field">*</span>순서
                    </td>
                    <td>
                      <input
                        type="text"
                        className="modal-input"
                        value={seq}
                        onChange={(e) =>
                          setSeq(e.target.value.replace(/\D/g, ''))
                        }
                        placeholder="회의실 조회 시 보이는 순서"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td>비고</td>
                    <td>
                      <textarea
                        className="modal-input"
                        rows={3}
                        value={remark}
                        onChange={(e) => setRemark(e.target.value)}
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="cancel-button"
                onClick={onClose}
              >
                취소
              </button>
              <button
                type="submit"
                className="save-button"
                disabled={saving}
              >
                저장
              </button>
            </div>
          </form>
        </div>
      </div>

      {validationError && (
        <div
          className="modal modal--alert"
          style={{ display: 'block' }}
          onClick={() => setValidationError(null)}
          role="dialog"
          aria-modal="true"
          aria-label="알림"
        >
          <div
            className="modal-content modal-content--alert"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-body modal-body--alert">
              <p className="modal-alert-message">{validationError}</p>
              <div className="modal-actions modal-actions--alert">
                <button
                  type="button"
                  className="modal-alert-confirm-btn"
                  onClick={() => setValidationError(null)}
                >
                  확인
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showApproverPopup && (
        <ApproverPopup
          initialUserUids={approverUids}
          users={users}
          formatPhone={formatPhone}
          options130={options130}
          onClose={() => setShowApproverPopup(false)}
          onSave={(uids) => {
            setApproverUids(uids)
            setShowApproverPopup(false)
          }}
        />
      )}
    </>
  )
}

function ApproverPopup({
  initialUserUids,
  users,
  formatPhone,
  options130,
  onClose,
  onSave,
}: {
  initialUserUids: string[]
  users: MrUser[]
  formatPhone: (phone: string | null) => string
  options130: LookupValue[]
  onClose: () => void
  onSave: (userUids: string[]) => void
}) {
  const [searchName, setSearchName] = useState('')
  const [selected, setSelected] = useState<string[]>(initialUserUids)

  const filteredUsers = useMemo(() => {
    if (!searchName.trim()) return users
    const q = searchName.trim().toLowerCase()
    return users.filter((u) =>
      (u.user_name ?? '').toLowerCase().includes(q)
    )
  }, [users, searchName])

  const selectedUsers = useMemo(
    () => users.filter((u) => selected.includes(u.user_uid)),
    [users, selected]
  )

  const addSelected = (uids: string[]) => {
    setSelected((prev) => {
      const set = new Set(prev)
      uids.forEach((id) => set.add(id))
      return Array.from(set)
    })
  }

  const removeOne = (user_uid: string) => {
    setSelected((prev) => prev.filter((id) => id !== user_uid))
  }

  function getLookupName(
    options: LookupValue[],
    valueCd: number | null,
    dateYmd: string | null
  ): string {
    if (valueCd == null) return ''
    const ymd = (dateYmd ?? '').replace(/\D/g, '')
    const v = options.find((o) => o.lookup_value_cd === valueCd)
    if (!v) return ''
    if (ymd && v.start_ymd && String(v.start_ymd).replace(/-/g, '') > ymd)
      return ''
    if (ymd && v.end_ymd && String(v.end_ymd).replace(/-/g, '') < ymd) return ''
    return v.lookup_value_nm
  }

  return (
    <div
      className="modal"
      style={{ display: 'block', zIndex: 1001 }}
      onClick={onClose}
    >
      <div
        className="modal-content"
        style={{ maxWidth: 900 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>승인자 등록</h3>
          <button
            type="button"
            className="modal-close close-button"
            onClick={onClose}
            aria-label="닫기"
          >
            ×
          </button>
        </div>
        <div className="modal-body">
          <div className="approver-popup-body">
            <div className="approver-popup-left">
              <div className="search-form" style={{ marginBottom: 12 }}>
                <input
                  type="text"
                  className="modal-input"
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  placeholder="성명"
                  style={{ minWidth: 120 }}
                  aria-label="성명"
                />
                <button
                  type="button"
                  className="search-button"
                  onClick={() => {}}
                >
                  조회
                </button>
              </div>
              <div className="approver-table-wrap">
                <table className="user-table">
                  <thead>
                    <tr>
                      <th>선택</th>
                      <th>성명</th>
                      <th>직분</th>
                      <th>전화번호</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => (
                      <tr key={u.user_uid}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selected.includes(u.user_uid)}
                            onChange={(e) => {
                              if (e.target.checked) addSelected([u.user_uid])
                              else removeOne(u.user_uid)
                            }}
                          />
                        </td>
                        <td>{u.user_name ?? ''}</td>
                        <td>
                          {getLookupName(
                            options130,
                            u.user_position,
                            u.create_ymd
                          )}
                        </td>
                        <td>{formatPhone(u.phone)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="approver-popup-arrow">
              <img
                src="/arrow-right.svg"
                alt="선택 항목 이동"
                className="approver-popup-arrow-img"
              />
            </div>
            <div className="approver-popup-right">
              <div className="approver-popup-right-header">
                <h4 style={{ marginBottom: 8, marginTop: 0 }}>승인자</h4>
              </div>
              <div className="approver-table-wrap">
                <table className="user-table">
                  <thead>
                    <tr>
                      <th>성명</th>
                      <th>직분</th>
                      <th>전화번호</th>
                      <th>삭제</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedUsers
                      .sort((a, b) =>
                        (a.user_name ?? '').localeCompare(b.user_name ?? '')
                      )
                      .map((u) => (
                        <tr key={u.user_uid}>
                          <td>{u.user_name ?? ''}</td>
                          <td>
                            {getLookupName(
                              options130,
                              u.user_position,
                              u.create_ymd
                            )}
                          </td>
                          <td>{formatPhone(u.phone)}</td>
                          <td>
                            <button
                              type="button"
                              className="delete-btn"
                              onClick={() => removeOne(u.user_uid)}
                            >
                              삭제
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="cancel-button" onClick={onClose}>
            취소
          </button>
          <button
            type="button"
            className="save-button"
            onClick={() => onSave(selected)}
          >
            저장
          </button>
        </div>
      </div>
    </div>
  )
}
