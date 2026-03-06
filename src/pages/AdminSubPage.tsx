import { Link, useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import CommonCodeSection from '../components/CommonCodeSection'
import UsersSection from '../components/UsersSection'
import '../App.css'

const SECTION_TITLES: Record<string, string> = {
  reservations: '예약 현황',
  users: '사용자',
  rooms: '회의실관리',
  codes: '공통코드',
}

export default function AdminSubPage() {
  const { section } = useParams<{ section: string }>()
  const navigate = useNavigate()
  useAuth()
  const title = section ? SECTION_TITLES[section] ?? '관리' : '관리'

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
        <div className="admin-sub-content">
          {section !== 'codes' && section !== 'users' && (
            <Link to="/admin" className="app-nav-item admin-back-link">
              ← 관리자 메뉴로
            </Link>
          )}
          {section === 'codes' ? (
            <CommonCodeSection />
          ) : section === 'users' ? (
            <UsersSection />
          ) : (
            <>
              <h2 className="admin-sub-title">{title}</h2>
              <p className="admin-sub-desc">해당 메뉴는 준비 중입니다.</p>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
