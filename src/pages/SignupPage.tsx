import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import './auth.css'

export default function SignupPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!isSupabaseConfigured) {
      setError(
        'Supabase가 설정되지 않았습니다. 프로젝트 루트에 .env 파일을 만들고 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY를 넣은 뒤 개발 서버를 재시작해 주세요.'
      )
      return
    }
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
      const { error: err } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name, phone },
        },
      })
      if (err) {
        setError(err.message ?? '회원가입에 실패했습니다.')
        return
      }
      setSuccess(true)
      setTimeout(() => navigate('/login', { replace: true }), 2000)
    } finally {
      setLoading(false)
    }
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
          <h1 className="auth-title">회원가입</h1>
          <p className="auth-success">
            가입이 완료되었습니다. 이메일 인증이 필요하면 메일함을 확인해 주세요. 로그인 페이지로 이동합니다.
          </p>
          <Link to="/login" className="auth-submit">
            로그인으로 이동
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
        <h1 className="auth-title">회원가입</h1>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && <p className="auth-error">{error}</p>}
          <div className="auth-field">
            <span className="auth-field-icon" aria-hidden="true">👤</span>
            <input
              type="text"
              placeholder="성명"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="auth-input"
            />
          </div>
          <div className="auth-field">
            <span className="auth-field-icon auth-field-icon-phone" aria-hidden="true">📱</span>
            <input
              type="tel"
              placeholder="전화번호 (예: 010-1234-5678)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="auth-input"
            />
          </div>
          <div className="auth-field">
            <span className="auth-field-icon" aria-hidden="true">✉</span>
            <input
              type="email"
              placeholder="이메일"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="auth-input"
            />
          </div>
          <div className="auth-field">
            <span className="auth-field-icon auth-field-icon-lock" aria-hidden="true">🔒</span>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="비밀번호"
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
              placeholder="비밀번호 확인"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              required
              autoComplete="new-password"
              className="auth-input"
            />
          </div>
          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? '가입 중...' : '회원가입'}
          </button>
        </form>

        <div className="auth-links">
          <p>
            이미 계정이 있으신가요? <Link to="/login">로그인</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
