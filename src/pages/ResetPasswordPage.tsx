import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { authErrorMessage } from '../lib/authErrors'
import './auth.css'

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!isSupabaseConfigured) {
      setError(
        'Supabase가 설정되지 않았습니다. .env 파일에 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY를 설정한 뒤 개발 서버를 재시작해 주세요.'
      )
      return
    }
    setLoading(true)
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`,
      })
      if (err) {
        setError(authErrorMessage(err.message, '재설정 이메일 발송에 실패했습니다.'))
        return
      }
      setSent(true)
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-logo" aria-hidden="true">
            <span className="auth-logo-text">BTA</span>
            <span className="auth-logo-plus">+</span>
            <span className="auth-logo-text">GT</span>
          </div>
          <h1 className="auth-title">비밀번호 재설정</h1>
          <p className="auth-success">
            재설정 링크를 이메일로 보냈습니다. 메일함을 확인한 뒤 링크를 클릭해 새 비밀번호를 설정해 주세요.
          </p>
          <Link to="/login" className="auth-submit">
            로그인으로 돌아가기
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
        <h1 className="auth-title">비밀번호 재설정</h1>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && <p className="auth-error">{error}</p>}
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
          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? '전송 중...' : '재설정 이메일 보내기'}
          </button>
        </form>

        <div className="auth-links">
          <Link to="/login">로그인으로 돌아가기</Link>
        </div>
      </div>
    </div>
  )
}
