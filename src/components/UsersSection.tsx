import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, ICellRendererParams } from 'ag-grid-community'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'
import type { MrUser } from '../types'
import type { LookupValue } from '../types'
import { useAuth } from '../hooks/useAuth'
import { fetchLookupValuesByTypeCd } from '../api/lookup'
import {
  fetchUsers,
  filterUsers,
  updateUser,
  formatPhone,
  formatPhoneInput,
  phoneWithoutHyphens,
  type UserFilters,
} from '../api/users'
import '../common_code.css'

const USER_TYPE_CD = 110
const POSITION_CD = 130
const JOIN_CD = 140

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

/** 수정 버튼 셀 렌더러 */
function EditCellRenderer(props: ICellRendererParams<MrUser> & { onEdit?: (user: MrUser) => void }) {
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
function DeleteCellRenderer(props: ICellRendererParams<MrUser> & { onDelete?: (user: MrUser) => void }) {
  if (!props.data || !props.onDelete) return null
  return (
    <button
      type="button"
      className="delete-btn"
      onClick={(e) => {
        e.stopPropagation()
        if (confirm('이 사용자를 삭제할까요?')) props.onDelete!(props.data!)
      }}
    >
      삭제
    </button>
  )
}

export default function UsersSection() {
  const { user: authUser } = useAuth()
  const [users, setUsers] = useState<MrUser[]>([])
  const [options110, setOptions110] = useState<LookupValue[]>([])
  const [options130, setOptions130] = useState<LookupValue[]>([])
  const [options140, setOptions140] = useState<LookupValue[]>([])
  const [filters, setFilters] = useState<UserFilters>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editUser, setEditUser] = useState<MrUser | null>(null)

  const loadUsers = useCallback(async () => {
    try {
      const data = await fetchUsers()
      setUsers(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : '사용자 조회 실패')
    }
  }, [])

  const loadOptions = useCallback(async () => {
    try {
      const [a, b, c] = await Promise.all([
        fetchLookupValuesByTypeCd(USER_TYPE_CD),
        fetchLookupValuesByTypeCd(POSITION_CD),
        fetchLookupValuesByTypeCd(JOIN_CD),
      ])
      setOptions110(a)
      setOptions130(b)
      setOptions140(c)
    } catch (e) {
      setError(e instanceof Error ? e.message : '공통코드 조회 실패')
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([loadUsers(), loadOptions()])
      .then(() => {})
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [loadUsers, loadOptions])

  const filtered = filterUsers(users, filters)

  const handleSearch = () => {
    setFilters((prev) => ({ ...prev }))
  }

  const handleExcelDownload = () => {
    const headers = ['순서', '성명', '직분', '이메일', '전화번호', '사용자구분', '가입/탈퇴', '비고']
    const rows = filtered.map((u, i) => [
      i + 1,
      u.user_name ?? '',
      getLookupName(options130, u.user_position, u.create_ymd),
      u.email ?? '',
      formatPhone(u.phone),
      getLookupName(options110, u.user_type, u.create_ymd),
      getLookupName(options140, u.join, u.create_ymd),
      u.remark ?? '',
    ])
    const BOM = '\uFEFF'
    const csv =
      BOM +
      [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join(
        '\r\n'
      )
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `사용자목록_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const gridContext = useMemo(
    () => ({
      options110,
      options130,
      options140,
      getLookupName,
      formatPhone,
      onEdit: setEditUser,
      onDelete: () => {},
    }),
    [options110, options130, options140]
  )

  const columnDefs = useMemo<ColDef<MrUser>[]>(
    () => [
      {
        headerName: '순서',
        valueGetter: (params) => (params.node?.rowIndex != null ? params.node.rowIndex + 1 : ''),
        width: 70,
        maxWidth: 80,
      },
      { field: 'user_name', headerName: '성명', flex: 1, minWidth: 90 },
      {
        headerName: '직분',
        valueGetter: (params) =>
          getLookupName(options130, params.data?.user_position ?? null, params.data?.create_ymd ?? null),
        flex: 1,
        minWidth: 80,
      },
      {
        headerName: '이메일',
        field: 'email',
        flex: 1,
        minWidth: 160,
        cellRenderer: (params: ICellRendererParams<MrUser>) => {
          const email = params.data?.email
          if (!email) return null
          return (
            <a href={`mailto:${email}`} className="user-email-link" onClick={(e) => e.stopPropagation()}>
              {email}
            </a>
          )
        },
      },
      {
        headerName: '전화번호',
        valueGetter: (params) => formatPhone(params.data?.phone ?? null),
        width: 130,
      },
      {
        headerName: '사용자구분',
        valueGetter: (params) =>
          getLookupName(options110, params.data?.user_type ?? null, params.data?.create_ymd ?? null),
        width: 90,
      },
      {
        headerName: '가입/탈퇴',
        valueGetter: (params) =>
          getLookupName(options140, params.data?.join ?? null, params.data?.create_ymd ?? null),
        width: 90,
      },
      { field: 'remark', headerName: '비고', flex: 1, minWidth: 80 },
      {
        headerName: '수정',
        width: 80,
        cellRenderer: EditCellRenderer,
        cellRendererParams: { onEdit: setEditUser },
      },
      {
        headerName: '삭제',
        width: 80,
        cellRenderer: DeleteCellRenderer,
        cellRendererParams: { onDelete: () => {} },
      },
    ],
    [options110, options130, options140]
  )

  return (
    <div className="common-code-container users-section">
      <header className="users-header">
        <h2 className="section-header">
          사용자
        </h2>
        <Link to="/admin" className="common-code-home-btn">
          홈
        </Link>
      </header>

      {error && (
        <div className="users-error" role="alert">
          {error}
        </div>
      )}

      <div className="search-form">
        <label>
          성명
          <input
            type="text"
            className="search-form-input-narrow"
            value={filters.user_name ?? ''}
            onChange={(e) => setFilters((p) => ({ ...p, user_name: e.target.value }))}
            placeholder="성명"
          />
        </label>
        <label>
          전화번호
          <input
            type="tel"
            inputMode="numeric"
            pattern="[0-9\-]*"
            className="search-form-input-narrow"
            value={filters.phone ?? ''}
            onChange={(e) => {
              const formatted = formatPhoneInput(e.target.value)
              setFilters((p) => ({ ...p, phone: formatted }))
            }}
            placeholder="010-0000-0000"
            maxLength={13}
            autoComplete="tel"
          />
        </label>
        <label>
          사용자구분
          <select
            value={filters.user_type ?? ''}
            onChange={(e) =>
              setFilters((p) => ({
                ...p,
                user_type: e.target.value === '' ? undefined : Number(e.target.value),
              }))
            }
          >
            <option value="">전체</option>
            {options110.map((o) => (
              <option key={o.lookup_value_id} value={o.lookup_value_cd}>
                {o.lookup_value_nm}
              </option>
            ))}
          </select>
        </label>
        <label>
          가입/탈퇴
          <select
            value={filters.join ?? ''}
            onChange={(e) =>
              setFilters((p) => ({
                ...p,
                join: e.target.value === '' ? undefined : Number(e.target.value),
              }))
            }
          >
            <option value="">전체</option>
            {options140.map((o) => (
              <option key={o.lookup_value_id} value={o.lookup_value_cd}>
                {o.lookup_value_nm}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="search-button" onClick={handleSearch}>
          조회
        </button>
        <button type="button" className="export-excel-button" onClick={handleExcelDownload}>
          엑셀 다운로드
        </button>
      </div>

      {loading ? (
        <p className="users-loading">불러오는 중…</p>
      ) : (
        <div className="detail-section">
          <div id="usersGrid" className="ag-theme-alpine" style={{ width: '100%', height: '500px' }}>
            <AgGridReact<MrUser>
              rowData={filtered}
              columnDefs={columnDefs}
              getRowId={(p) => p.data.user_uid}
              context={gridContext}
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

      {editUser && (
        <UserEditModal
          user={editUser}
          updateUserId={authUser?.id ?? null}
          options130={options130}
          options110={options110}
          options140={options140}
          onClose={() => setEditUser(null)}
          onSaved={() => {
            loadUsers()
            setEditUser(null)
          }}
        />
      )}
    </div>
  )
}

function UserEditModal({
  user,
  updateUserId,
  options130,
  options110,
  options140,
  onClose,
  onSaved,
}: {
  user: MrUser
  updateUserId: string | null
  options130: LookupValue[]
  options110: LookupValue[]
  options140: LookupValue[]
  onClose: () => void
  onSaved: () => void
}) {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const valid130 = options130.filter(
    (o) =>
      (!o.start_ymd || String(o.start_ymd).replace(/-/g, '') <= today) &&
      (!o.end_ymd || String(o.end_ymd).replace(/-/g, '') >= today)
  )
  const valid110 = options110.filter(
    (o) =>
      (!o.start_ymd || String(o.start_ymd).replace(/-/g, '') <= today) &&
      (!o.end_ymd || String(o.end_ymd).replace(/-/g, '') >= today)
  )
  const valid140 = options140.filter(
    (o) =>
      (!o.start_ymd || String(o.start_ymd).replace(/-/g, '') <= today) &&
      (!o.end_ymd || String(o.end_ymd).replace(/-/g, '') >= today)
  )

  const [user_position, setUser_position] = useState<number | null>(user.user_position)
  const [phone, setPhone] = useState(formatPhone(user.phone))
  const [user_type, setUser_type] = useState<number | null>(user.user_type)
  const [join, setJoin] = useState<number | null>(user.join)
  const [remark, setRemark] = useState(user.remark ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setUser_position(user.user_position)
    setPhone(formatPhone(user.phone))
    setUser_type(user.user_type)
    setJoin(user.join)
    setRemark(user.remark ?? '')
  }, [user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await updateUser(user.user_uid, {
        user_position,
        phone: phone ? phoneWithoutHyphens(phone) : null,
        user_type,
        join,
        remark: remark.trim() || null,
        update_user: updateUserId,
      })
      onSaved()
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal" style={{ display: 'block' }} onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>사용자 수정</h3>
          <button type="button" className="modal-close close-button" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <table className="modal-form">
              <tbody>
                <tr>
                  <td>성명</td>
                  <td>
                    <input
                      type="text"
                      className="modal-input"
                      value={user.user_name ?? ''}
                      readOnly
                      disabled
                    />
                  </td>
                </tr>
                <tr>
                  <td>직분</td>
                  <td>
                    <select
                      className="modal-select"
                      value={user_position ?? ''}
                      onChange={(e) =>
                        setUser_position(e.target.value === '' ? null : Number(e.target.value))
                      }
                    >
                      <option value="">선택</option>
                      {valid130.map((o) => (
                        <option key={o.lookup_value_id} value={o.lookup_value_cd}>
                          {o.lookup_value_nm}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
                <tr>
                  <td>이메일</td>
                  <td>
                    <input
                      type="text"
                      className="modal-input"
                      value={user.email ?? ''}
                      readOnly
                      disabled
                    />
                  </td>
                </tr>
                <tr>
                  <td>전화번호</td>
                  <td>
                    <input
                      type="text"
                      className="modal-input"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="010-0000-0000"
                    />
                  </td>
                </tr>
                <tr>
                  <td>사용자 구분</td>
                  <td>
                    <select
                      className="modal-select"
                      value={user_type ?? ''}
                      onChange={(e) =>
                        setUser_type(e.target.value === '' ? null : Number(e.target.value))
                      }
                    >
                      <option value="">선택</option>
                      {valid110.map((o) => (
                        <option key={o.lookup_value_id} value={o.lookup_value_cd}>
                          {o.lookup_value_nm}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
                <tr>
                  <td>가입/탈퇴</td>
                  <td>
                    <select
                      className="modal-select"
                      value={join ?? ''}
                      onChange={(e) =>
                        setJoin(e.target.value === '' ? null : Number(e.target.value))
                      }
                    >
                      <option value="">선택</option>
                      {valid140.map((o) => (
                        <option key={o.lookup_value_id} value={o.lookup_value_cd}>
                          {o.lookup_value_nm}
                        </option>
                      ))}
                    </select>
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
            <button type="button" className="cancel-button" onClick={onClose}>
              취소
            </button>
            <button type="submit" className="save-button" disabled={saving}>
              저장
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
