import { useEffect, useRef, useState } from 'react'
import { fetchMe } from '../api'
import { useAuth } from '../auth/AuthContext'

export default function Dashboard() {
  const {
    authenticated,
    loading: authLoading,
    getAccessToken,
    login,
    logout,
  } = useAuth()
  const [user, setUser] = useState(undefined)
  const [error, setError] = useState('')
  // F1: one auto-login attempt per mount so F5 / deep-link recovers via Keycloak SSO
  // without looping if the user cancels the IdP screen.
  const autoLoginStarted = useRef(false)

  useEffect(() => {
    if (authLoading) return
    if (authenticated) return
    if (autoLoginStarted.current) return
    autoLoginStarted.current = true
    login()
  }, [authLoading, authenticated, login])

  useEffect(() => {
    if (authLoading || !authenticated) return
    let cancelled = false

    async function load() {
      try {
        const token = await getAccessToken()
        if (!token) {
          if (!cancelled) {
            setUser(null)
            setError(
              'Browser session exists but the access token is missing or expired. Log out and log in again.',
            )
          }
          return
        }
        const profile = await fetchMe(token)
        if (!cancelled) {
          if (!profile) {
            setUser(null)
            setError(
              'API rejected the access token (401). Log out, then log in again so a new token is issued.',
            )
          } else {
            setUser(profile)
            setError('')
          }
        }
      } catch (e) {
        if (!cancelled) {
          setUser(null)
          setError(e.message)
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [authLoading, getAccessToken, authenticated])

  if (authLoading || (!authenticated && !error)) {
    return <section className="card">Redirecting to Keycloak…</section>
  }

  if (!authenticated) {
    return (
      <section className="card">
        <h1>Protected dashboard</h1>
        <p className="muted">You are not logged in.</p>
        <button type="button" className="btn primary" onClick={() => login()}>
          Log in with Keycloak
        </button>
      </section>
    )
  }

  if (user === undefined && !error) {
    return <section className="card">Loading session…</section>
  }

  if (!user) {
    return (
      <section className="card">
        <h1>Protected dashboard</h1>
        <p className="muted">
          You appear signed in to Keycloak in this browser, but the API did not accept the token.
        </p>
        {error && <p className="error">{error}</p>}
        <div className="actions">
          <button type="button" className="btn primary" onClick={() => login()}>
            Log in with Keycloak
          </button>
          <button type="button" className="btn danger" onClick={() => logout()}>
            Log out (clear session)
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="card">
      <h1>Welcome</h1>
      <p className="muted">
        Profile from FastAPI <code>/api/me</code> (Bearer access token validated via JWKS).
      </p>
      <dl className="claims">
        <div>
          <dt>sub</dt>
          <dd>{user.sub}</dd>
        </div>
        <div>
          <dt>email</dt>
          <dd>{user.email || '—'}</dd>
        </div>
        <div>
          <dt>name</dt>
          <dd>{user.name || '—'}</dd>
        </div>
        <div>
          <dt>username</dt>
          <dd>{user.preferred_username || '—'}</dd>
        </div>
      </dl>
      <button type="button" className="btn danger" onClick={() => logout()}>
        Log out
      </button>
    </section>
  )
}
