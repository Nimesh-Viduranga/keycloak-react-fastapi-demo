import { useEffect, useState } from 'react'
import { fetchMe } from '../api'
import { useAuth } from '../auth/AuthContext'

export default function Dashboard() {
  const { user: oidcUser, loading: authLoading, getAccessToken, login, logout } = useAuth()
  const [user, setUser] = useState(undefined)
  const [error, setError] = useState('')

  useEffect(() => {
    if (authLoading) return
    let cancelled = false

    async function load() {
      try {
        const token = await getAccessToken()
        if (!token) {
          if (!cancelled) setUser(null)
          return
        }
        const profile = await fetchMe(token)
        if (!cancelled) setUser(profile)
      } catch (e) {
        if (!cancelled) setError(e.message)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [authLoading, getAccessToken, oidcUser])

  if (authLoading || (user === undefined && !error)) {
    return <section className="card">Loading session…</section>
  }

  if (!user) {
    return (
      <section className="card">
        <h1>Protected dashboard</h1>
        <p className="muted">You are not logged in.</p>
        {error && <p className="error">{error}</p>}
        <button type="button" className="btn primary" onClick={() => login()}>
          Log in with Keycloak
        </button>
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
