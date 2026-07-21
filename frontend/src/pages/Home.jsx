import { useAuth } from '../auth/AuthContext'

export default function Home() {
  const { login, signup, authenticated, loading, initError } = useAuth()
  const params = new URLSearchParams(window.location.search)
  const error = params.get('error')

  return (
    <section className="card">
      <h1>React + FastAPI + Keycloak</h1>
      <p className="muted">
        SPA OIDC client via <code>keycloak-js</code> (authorization code + PKCE).
        FastAPI only validates Bearer JWTs on <code>/api/me</code>.
      </p>

      {(error || initError) && (
        <p className="error">
          {initError || `Login failed (${error}). Check Keycloak client config.`}
        </p>
      )}

      {loading ? (
        <p className="muted">Checking session…</p>
      ) : authenticated ? (
        <div className="actions">
          <a className="btn primary" href="/dashboard">
            Go to dashboard
          </a>
        </div>
      ) : (
        <div className="actions">
          <button type="button" className="btn primary" onClick={() => login()}>
            Log in
          </button>
          <button type="button" className="btn secondary" onClick={() => signup()}>
            Sign up
          </button>
        </div>
      )}

      <ol className="steps">
        <li>Click Log in or Sign up — browser redirects to Keycloak.</li>
        <li>After auth, Keycloak returns to <code>/callback</code> with a code.</li>
        <li>
          <code>keycloak-js</code> exchanges the code (PKCE) and the app calls{' '}
          <code>/api/me</code> with the access token.
        </li>
      </ol>
    </section>
  )
}
