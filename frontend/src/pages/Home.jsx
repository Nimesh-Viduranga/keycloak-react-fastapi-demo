import { useAuth } from '../auth/AuthContext'

export default function Home() {
  const { login, signup, user, loading } = useAuth()
  const params = new URLSearchParams(window.location.search)
  const error = params.get('error')

  return (
    <section className="card">
      <h1>React + FastAPI + Keycloak</h1>
      <p className="muted">
        SPA OIDC client: React runs authorization code + PKCE with Keycloak.
        FastAPI only validates Bearer JWTs on <code>/api/me</code>.
      </p>

      {error && (
        <p className="error">Login failed ({error}). Check Keycloak client config.</p>
      )}

      {loading ? (
        <p className="muted">Checking session…</p>
      ) : user ? (
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
        <li>React exchanges the code (PKCE) and calls <code>/api/me</code> with the access token.</li>
      </ol>
    </section>
  )
}
