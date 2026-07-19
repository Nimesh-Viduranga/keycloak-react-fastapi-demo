import { useEffect, useState } from 'react'
import { fetchMe, logout } from '../api'

export default function Dashboard() {
  const [user, setUser] = useState(undefined)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    fetchMe()
      .then((u) => {
        if (!cancelled) setUser(u)
      })
      .catch((e) => {
        if (!cancelled) setError(e.message)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function onLogout() {
    try {
      const url = await logout()
      window.location.href = url
    } catch (e) {
      setError(e.message)
    }
  }

  if (user === undefined && !error) {
    return <section className="card">Loading session…</section>
  }

  if (!user) {
    return (
      <section className="card">
        <h1>Protected dashboard</h1>
        <p className="muted">You are not logged in.</p>
        {error && <p className="error">{error}</p>}
        <a className="btn primary" href="/auth/login">
          Log in with Keycloak
        </a>
      </section>
    )
  }

  return (
    <section className="card">
      <h1>Welcome</h1>
      <p className="muted">Session loaded from FastAPI <code>/api/me</code>.</p>
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
      <button type="button" className="btn danger" onClick={onLogout}>
        Log out
      </button>
    </section>
  )
}
