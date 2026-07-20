import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

/**
 * Keycloak redirects here with ?code&state. AuthProvider's keycloak.init()
 * performs the PKCE code exchange. This page only waits for init, then routes on.
 */
export default function Callback() {
  const { loading, authenticated, initError } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const navigatedRef = useRef(false)

  useEffect(() => {
    if (loading || navigatedRef.current) return

    if (initError) {
      setError(initError)
      return
    }

    navigatedRef.current = true
    if (authenticated) {
      navigate('/dashboard', { replace: true })
    } else {
      setError('Sign-in did not complete. Try logging in again.')
      navigatedRef.current = false
    }
  }, [loading, authenticated, initError, navigate])

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
