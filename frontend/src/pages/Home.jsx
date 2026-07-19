export default function Home() {
  const params = new URLSearchParams(window.location.search)
  const error = params.get('error')

  return (
    <section className="card">
      <h1>React + FastAPI + Keycloak</h1>
      <p className="muted">
        BFF pattern: FastAPI owns the OIDC code flow and HTTP-only session.
        React never sees the client secret.
      </p>

      {error && (
        <p className="error">Login failed ({error}). Check Keycloak client config.</p>
      )}

      <div className="actions">
        {/* Full navigation so browser follows Keycloak redirects */}
        <a className="btn primary" href="/auth/login">
          Log in
        </a>
        <a className="btn secondary" href="/auth/signup">
          Sign up
        </a>
      </div>

      <ol className="steps">
        <li>Click Log in or Sign up.</li>
      </ol>
    </section>
  )
}
