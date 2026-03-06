import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const navigate = useNavigate()
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (loading) return
    if (!session) navigate('/login', { replace: true })
  }, [loading, session, navigate])

  if (loading) {
    return (
      <div className="auth-loading">
        <span>로딩 중...</span>
      </div>
    )
  }

  if (!session) return null

  return <>{children}</>
}
