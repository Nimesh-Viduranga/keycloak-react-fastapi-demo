import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export default function Callback() {
  const { completeLogin } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    completeLogin()
      .then(() => {
        if (!cancelled) navigate('/dashboard', { replace: true })
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || 'Login callback failed')
      })
    return () => {
      cancelled = true
    }
  }, [completeLogin, navigate])

  if (error) {
    return (
      <section className="card">
        <h1>Sign-in failed</h1>
        <p className="error">{error}</p>
        <a className="btn primary" href="/">
          Back home
        </a>
      </section>
    )
  }

  return <section className="card">Completing sign-in…</section>
}
