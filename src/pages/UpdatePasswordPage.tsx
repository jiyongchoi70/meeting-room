import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import './auth.css'

export default function UpdatePasswordPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(() => setSessionReady(true))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password !== passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }
    if (password.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.')
      return
    }
    setLoading(true)
    try {
      const { error: err } = await supabase.auth.updateUser({ password })
      if (err) {
        setError(err.message ?? '비밀번호 변경에 실패했습니다.')
        return
      }
      setSuccess(true)
      setTimeout(() => navigate('/login', { replace: true }), 2000)
    } finally {
      setLoading(false)
    }
  }

  if (!sessionReady) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <p className="auth-success">로딩 중...</p>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-logo" aria-hidden="true">
            <span className="auth-logo-text">BTA</span>
            <span className="auth-logo-plus">+</span>
            <span className="auth-logo-text">GT</span>
          </div>
          <h1 className="auth-title">비밀번호 재설정</h1>
          <p className="auth-success">비밀번호가 변경되었습니다. 로그인 페이지로 이동합니다.</p>
          <Link to="/login" className="auth-submit">
            로그인
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo" aria-hidden="true">
          <span className="auth-logo-text">BTA</span>
          <span className="auth-logo-plus">+</span>
          <span className="auth-logo-text">GT</span>
        </div>
        <h1 className="auth-title">새 비밀번호 설정</h1>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && <p className="auth-error">{error}</p>}
          <div className="auth-field">
            <span className="auth-field-icon auth-field-icon-lock" aria-hidden="true">🔒</span>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="새 비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              className="auth-input"
            />
            <button
              type="button"
              className="auth-toggle-password"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
            >
              {showPassword ? '🙈' : '👁'}
            </button>
          </div>
          <div className="auth-field">
            <span className="auth-field-icon auth-field-icon-lock" aria-hidden="true">🔒</span>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="새 비밀번호 확인"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              required
              autoComplete="new-password"
              className="auth-input"
            />
          </div>
          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? '저장 중...' : '비밀번호 변경'}
          </button>
        </form>

        <div className="auth-links">
          <Link to="/login">로그인으로 돌아가기</Link>
        </div>
      </div>
    </div>
  )
}
