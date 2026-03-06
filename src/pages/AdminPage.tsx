import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import '../App.css'

const APPROVER_MENUS = [{ id: 'reservations', label: '예약현황', path: '/admin/reservations' }]

const ADMIN_MENUS = [
  { id: 'reservations', label: '예약현황', path: '/admin/reservations' },
  { id: 'users', label: '사용자', path: '/admin/users' },
  { id: 'rooms', label: '회의실관리', path: '/admin/rooms' },
  { id: 'codes', label: '공통코드', path: '/admin/codes' },
]

export default function AdminPage() {
  const navigate = useNavigate()
  useAuth()

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
          <table className="admin-menu-table">
            <thead>
              <tr>
                <th className="admin-menu-th admin-menu-th--approver">승인자</th>
                <th className="admin-menu-th admin-menu-th--admin">관리자</th>
              </tr>
            </thead>
            <tbody>
              {[0, 1, 2, 3].map((rowIndex) => (
                <tr key={rowIndex}>
                  <td className="admin-menu-td">
                    {APPROVER_MENUS[rowIndex] ? (
                      <Link
                        to={APPROVER_MENUS[rowIndex].path}
                        className="admin-menu-link"
                      >
                        {APPROVER_MENUS[rowIndex].label}
                      </Link>
                    ) : (
                      <span className="admin-menu-empty">&nbsp;</span>
                    )}
                  </td>
                  <td className="admin-menu-td">
                    {ADMIN_MENUS[rowIndex] ? (
                      <Link
                        to={ADMIN_MENUS[rowIndex].path}
                        className="admin-menu-link"
                      >
                        {ADMIN_MENUS[rowIndex].label}
                      </Link>
                    ) : (
                      <span className="admin-menu-empty">&nbsp;</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}
