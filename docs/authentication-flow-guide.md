# Authentication Flow Guide — Keycloak + React + FastAPI (BFF)

A developer-focused walkthrough of **how this project authenticates users with
Keycloak** — login, signup, session, logout — and **how to reproduce the same
flow in another React + FastAPI project**.

Read this if you want to understand *why* it works, not just copy it. Every code
reference points at a real file in this repo.

---

## 1. The one idea: Backend-for-Frontend (BFF)

The React app **never** talks OIDC to Keycloak directly and **never** holds
tokens. Instead:

- **FastAPI is the OIDC client** (confidential — it has the client secret). It
  performs the authorization-code exchange with Keycloak.
- The resulting tokens live **server-side**, referenced by an **httpOnly session
  cookie**.
- **React only ever sees identity** through a plain API call (`GET /api/me`), and
  triggers login/logout by navigating to backend URLs.

```
┌─────────┐        session cookie         ┌──────────┐   OIDC code flow   ┌──────────┐
│  React  │ ───────────────────────────▶ │ FastAPI  │ ─────────────────▶ │ Keycloak │
│ (:5173) │ ◀─────────────────────────── │  (BFF)   │ ◀───────────────── │ (:8085)  │
└─────────┘   /api/me · /auth/* (proxy)   └──────────┘   tokens (server)  └──────────┘
   no tokens in the browser                secret + tokens stay here
```

**Why BFF and not "SPA holds the token"?** A public SPA that stores access/ID
tokens in `localStorage` exposes them to any XSS on the page, can't keep a client
secret, and complicates refresh/revocation. The BFF keeps secrets and tokens on
the server; the browser only carries an opaque, httpOnly session cookie. This is
the same server-session model MyPage uses — re-shaped for a SPA + API split.

---

## 2. The players & where the flow lives

| File | Role |
|---|---|
| `backend/app/config.py` | Reads env; derives realm URL, discovery URL, `redirect_uri`, `post_logout_redirect_uri` |
| `backend/app/auth.py` | Registers the Authlib OIDC client; session helpers; `end_session_url` |
| `backend/app/main.py` | The endpoints: `/auth/login`, `/auth/callback`, `/auth/signup`, `/auth/logout`, `/api/me` |
| `frontend/vite.config.js` | Proxies `/auth` and `/api` to FastAPI so the cookie is **same-origin** |
| `frontend/src/api.js` | `fetchMe()` and `logout()` — always `credentials: 'include'` |
| `frontend/src/pages/*` | Home (login/signup links), Dashboard (`/api/me`, logout) |

The OIDC client is configured from Keycloak's **discovery document**, so endpoints
aren't hardcoded:

```python
# auth.py
oauth.register(
    name="keycloak",
    client_id=settings.keycloak_client_id,
    client_secret=settings.keycloak_client_secret,
    server_metadata_url=settings.metadata_url,   # /.well-known/openid-configuration
    client_kwargs={"scope": "openid email profile"},
)
```

---

## 3. Login flow (step by step)

```
1. User clicks "Log in"
   React: <a href="/auth/login">           ← FULL navigation, not fetch (see §7)

2. Browser GET /auth/login
   → Vite proxy → FastAPI /auth/login
   FastAPI: authorize_redirect(request, redirect_uri)
     · Authlib generates `state` (CSRF) + `nonce` (replay) and stores them in
       the session cookie
     · returns 302 → Keycloak /protocol/openid-connect/auth?...

3. Keycloak shows the login page; user authenticates.

4. Keycloak 302 → redirect_uri = http://localhost:5173/auth/callback?code=...&state=...
   → Vite proxy → FastAPI /auth/callback
   FastAPI: token = authorize_access_token(request)
     · validates `state` against the session
     · exchanges `code` for tokens at the token endpoint (uses client secret)
     · validates the ID token: signature via JWKS, `nonce`, `iss`, `aud`, `exp`
   FastAPI: store {sub,email,name,...} + id_token in the SERVER session
   FastAPI: 302 → http://localhost:5173/dashboard

5. Dashboard mounts → GET /api/me (cookie) → shows the user's claims.
```

Key code:

```python
# main.py
@app.get("/auth/login")
async def login(request: Request):
    if user_from_session(request):                       # already logged in → skip
        return RedirectResponse(f"{settings.frontend_url}/dashboard")
    return await oauth.keycloak.authorize_redirect(request, settings.redirect_uri)

@app.get("/auth/callback")
async def callback(request: Request):
    token = await oauth.keycloak.authorize_access_token(request)   # validates + exchanges
    claims = token.get("userinfo") or decode_id_token_payload(token.get("id_token", ""))
    if not claims.get("sub"):
        return RedirectResponse(f"{settings.frontend_url}/?error=missing_sub")
    request.session["user"] = { "sub": claims["sub"], "email": claims.get("email"), ... }
    request.session["id_token"] = token.get("id_token")            # needed for logout hint
    return RedirectResponse(f"{settings.frontend_url}/dashboard")
```

**The `sub` claim is the stable user id** — the equivalent of MyPage's
`legacy_id`. Use `sub` (or your own custom claim) as the primary key to link the
Keycloak identity to your app's user records.

---

## 4. Signup flow (the one non-obvious part)

Keycloak has a dedicated **registration** endpoint
(`/protocol/openid-connect/registrations`) that renders the "Register" form
instead of "Login" — but it's otherwise the **same** OIDC authorization request,
so the callback is identical.

The catch: if you redirect straight to `/registrations`, Authlib never stored the
`state`, so the callback fails with `MismatchingStateError`. The fix is to build a
normal authorization request (so `state`/`nonce` get saved) and then just swap the
path:

```python
# main.py
@app.get("/auth/signup")
async def signup(request: Request):
    client = oauth.keycloak
    rv = await client.create_authorization_url(settings.redirect_uri)
    await client.save_authorize_data(request, redirect_uri=settings.redirect_uri, **rv)  # stores state/nonce
    url = rv["url"].replace("/openid-connect/auth?", "/openid-connect/registrations?", 1)
    return RedirectResponse(url, status_code=302)
```

After the user registers, Keycloak redirects to the **same** `/auth/callback`, and
from there it's identical to login (§3, step 4 onward).

Requires **Realm settings → Login → User registration = ON** in Keycloak.

---

## 5. Session — how "am I logged in?" works

- The session is a signed httpOnly cookie managed by Starlette's
  `SessionMiddleware`. After a successful callback it holds `user` (claims) and
  `id_token`.
- React asks the backend, never itself:

```python
# main.py
@app.get("/api/me")
async def me(request: Request):
    return {"user": require_user(request)}    # 401 if no session
```

```js
// api.js
export async function fetchMe() {
  const res = await fetch('/api/me', { credentials: 'include' })   // cookie sent
  if (res.status === 401) return null                              // not logged in
  return (await res.json()).user
}
```

- `require_user` is this project's `CheckLKAuth`: **any protected endpoint calls
  it** and returns `401` when there's no session, which React treats as
  "logged out."

```python
# auth.py
def require_user(request: Request) -> dict:
    user = request.session.get("user")
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user
```

**Cookie must be same-origin as the SPA.** That's the whole reason for the Vite
proxy — `/auth/*` and `/api/*` are served from `:5173` (the React origin) and
forwarded to FastAPI, so the browser stores and sends the session cookie without
cross-origin (`SameSite`/CORS) friction.

---

## 6. Logout flow

Local session is cleared **first** (reliable), then the browser is sent to
Keycloak's end-session endpoint to terminate the SSO session:

```
1. User clicks "Log out"
   React: POST /auth/logout (cookie)
   FastAPI: read id_token from session → session.clear() → return { logout_url }

2. React: window.location.href = logout_url
   → Keycloak /protocol/openid-connect/logout?id_token_hint=...&post_logout_redirect_uri=...
   Keycloak ends the SSO session → 302 → frontend "/"
```

```python
# main.py
@app.post("/auth/logout")
async def logout(request: Request):
    id_token = request.session.get("id_token")
    request.session.clear()
    return JSONResponse({"logout_url": end_session_url(id_token, settings)})
```

```python
# auth.py
def end_session_url(id_token, settings):
    params = {"post_logout_redirect_uri": settings.post_logout_redirect_uri,
              "client_id": settings.keycloak_client_id}
    if id_token:
        params["id_token_hint"] = id_token
    return f"{settings.realm_url}/protocol/openid-connect/logout?{urlencode(params)}"
```

Clearing the local session first (rather than relying on Keycloak's redirect
completing) means the user is logged out of *this app* even if the round-trip to
Keycloak is interrupted — the same reasoning MyPage documents.

---

## 7. Pitfalls this project avoids (do the same)

1. **Login must be a full-page navigation, not `fetch`.**
   `<a href="/auth/login">` / `window.location = '/auth/login'` — never
   `fetch('/auth/login')`. OIDC involves cross-origin 302s to Keycloak that XHR
   cannot follow.
2. **Every API/logout call needs `credentials: 'include'`** or the session cookie
   isn't sent → perpetual 401.
3. **Keep the session cookie same-origin** — proxy `/auth` and `/api` to the
   backend in dev (Vite proxy), or deploy same-origin in prod. Cross-origin
   cookies need `SameSite=None; Secure` and exact CORS.
4. **Signup needs the state saved** — don't redirect straight to
   `/registrations`; build the auth request first (§4).
5. **Don't put tokens in the browser.** No `localStorage`/`sessionStorage`
   tokens; the SPA only knows identity via `/api/me`.
6. **Store `id_token` server-side** — you need it as the `id_token_hint` for a
   clean Keycloak logout.

---

## 8. Reusable vs. project-specific — adapting to your app

| Piece | Reuse as-is | Adapt |
|---|---|---|
| BFF architecture + endpoint shape | ✅ | |
| Authlib client registration (discovery-based) | ✅ | scopes if you need more claims |
| `/auth/login` · `/auth/callback` · `/auth/logout` | ✅ | post-login/redirect destinations |
| `/auth/signup` registrations trick | ✅ | only if you expose self-signup |
| `require_user` gate on protected routes | ✅ | apply to your own API routes |
| `sub` as the user id | | ✅ map to your user table (or a custom claim) |
| Session cookie (Starlette middleware) | ✅ dev | ✅ prod: encrypt / server-side store (see checklist) |
| Vite proxy | ✅ dev | ✅ prod: same-origin deploy or explicit CORS + `SameSite=None` |
| Keycloak client config | | ✅ per realm/client/redirect URIs |

**Minimum to stand this up in a new project:**
1. Create a **confidential** Keycloak client with redirect URI
   `<frontend>/auth/callback` and post-logout `<frontend>/`.
2. Copy `config.py` + `auth.py` + the five endpoints in `main.py`; set the env.
3. Add `SessionMiddleware` (strong secret) + CORS (`allow_credentials`).
4. Frontend: full-navigation login/signup links, `fetchMe()`/`logout()` with
   `credentials: 'include'`, and a proxy (dev) or same-origin deploy (prod).
5. Gate every protected API route with `require_user`.

---

## 9. Before production

This guide describes the **flow**, which is production-shaped. The concrete
hardening steps (HTTPS Secure cookies, encrypted/server-side token storage,
cross-origin cookie config, PKCE, refresh, back-channel logout, real Keycloak
config) are in the **[Production checklist](../README.md#production-checklist)**
in the README. Do not deploy without working through it.
