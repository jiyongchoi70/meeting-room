import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { fetchMrUserByUid } from '../api/users'
import '../App.css'

const APPROVER_MENUS = [{ id: 'reservations', label: '예약현황', path: '/admin/reservations' }]

const ADMIN_MENUS = [
  { id: 'reservations', label: '예약현황', path: '/admin/reservations' },
  { id: 'users', label: '사용자', path: '/admin/users' },
  { id: 'rooms', label: '회의실관리', path: '/admin/rooms' },
  { id: 'codes', label: '공통코드', path: '/admin/codes' },
]

/** mr_users.user_type: 110 = 담당자 → 관리자 메뉴만, 그 외 → 승인자 메뉴만 */
const ADMIN_USER_TYPE = 110

export default function AdminPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  /** undefined: 로딩 중, null: mr_users 없음 */
  const [userType, setUserType] = useState<number | null | undefined>(undefined)

  useEffect(() => {
    if (!user?.id) {
      setUserType(null)
      return
    }
    let cancelled = false
    fetchMrUserByUid(user.id)
      .then((row) => {
        if (!cancelled) setUserType(row?.user_type ?? null)
      })
      .catch(() => {
        if (!cancelled) setUserType(null)
      })
    return () => {
      cancelled = true
    }
  }, [user?.id])

  const isAdminMenu = userType === ADMIN_USER_TYPE
  const columnMenus = isAdminMenu ? ADMIN_MENUS : APPROVER_MENUS
  const columnTitle = isAdminMenu ? '관리자' : '승인자'
  const columnThClass = isAdminMenu ? 'admin-menu-th--admin' : 'admin-menu-th--approver'

  /** 새로고침 없이 회의실 예약(/)으로 이동 + fromLogout 플래그 → CalendarPage에서 signOut 후 로그인 버튼 표시 */
  const handleLogout = () => {
    navigate('/', { state: { fromLogout: true }, replace: true })
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <h1 className="admin-title">회의실 예약</h1>
        <nav className="admin-header-nav">
          <Link to="/" className="app-nav-item" title="메인">
            <span className="app-nav-icon" aria-hidden="true">⚙</span>
            <span>메인</span>
          </Link>
          <button
            type="button"
            className="app-nav-item"
            title="로그아웃"
            onClick={handleLogout}
          >
            <span className="app-nav-icon" aria-hidden="true">👤</span>
            <span>로그아웃</span>
          </button>
        </nav>
      </header>

      <main className="admin-body">
        <div className="admin-menu-table-wrap">
          {userType === undefined && user?.id ? (
            <p className="admin-menu-loading" role="status">
              메뉴를 불러오는 중…
            </p>
          ) : (
            <table className="admin-menu-table admin-menu-table--single">
              <thead>
                <tr>
                  <th className={`admin-menu-th ${columnThClass}`}>{columnTitle}</th>
                </tr>
              </thead>
              <tbody>
                {columnMenus.map((item) => (
                  <tr key={item.id}>
                    <td className="admin-menu-td">
                      <Link to={item.path} className="admin-menu-link">
                        {item.label}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  )
}
