# Keycloak + React + FastAPI (SPA OIDC client demo)

React is the **OIDC public client** (authorization code + PKCE). FastAPI only
validates Bearer JWTs. Optional **nginx** serves one browser origin:

```
Browser → nginx :8088
            ├─ /          → React static (owns /callback)
            └─ /api/*     → FastAPI (JWT validation)
                    ↓
              Keycloak :8090 (realm brandvisual)
```

---

## Quick start (nginx mode)

```bash
cd /home/nimesh/projects/keycloak-react-fastapi-demo
cp backend/.env.example backend/.env
docker compose down -v   # needed once after switching from BFF → public client
docker compose up -d --build
```

Wait for Keycloak (~30s), then open:

| URL | Purpose |
|-----|---------|
| **http://localhost:8088** | App (nginx) |
| http://localhost:8090/admin/ | Keycloak admin (`admin` / `admin`) |

Login: `demo` / `demo123` · Sign up creates users in realm **brandvisual**.

```bash
docker compose ps
docker compose logs -f nginx backend keycloak
```

Stop:

```bash
docker compose down
```

---

## Why this shape

| Piece | Role |
|-------|------|
| React + `keycloak-js` | Redirect to Keycloak, PKCE code exchange, hold tokens |
| FastAPI | `GET /api/me` — verify access token via JWKS |
| nginx | Same-origin static UI + `/api` proxy |
| Keycloak | Login / register / issue tokens |

See [docs/authentication-flow-guide.md](docs/authentication-flow-guide.md).

---

## Ports

| Service | Port |
|---------|------|
| nginx (app) | **8088** |
| Keycloak | **8090** |
| FastAPI | internal only (`backend:8000`) |

---

## Keycloak (auto-imported)

| Item | Value |
|------|--------|
| Realm | `brandvisual` |
| Client | `react-fastapi-demo` (**public**, PKCE S256) |
| Redirect (nginx) | `http://localhost:8088/callback` |
| Redirect (vite) | `http://localhost:5173/callback` |
| Registration | enabled |

If the client still looks confidential (old volume), reset:

```bash
docker compose down -v
docker compose up -d --build
```

---

## Optional: Vite-only mode (no nginx)

```bash
# Keycloak only
docker compose up -d keycloak-db keycloak

# Terminal 1 — API on :8000 (free the port if PHP holds it)
cd backend && source .venv/bin/activate
uvicorn app.main:app --reload --port 8000

# Terminal 2
cd frontend && npm run dev
```

Open http://localhost:5173 — Vite proxies `/api` → FastAPI.

---

## Layout

```
docker-compose.yml
nginx/default.conf
keycloak/import/brandvisual-realm.json
backend/          # FastAPI JWT API (+ Dockerfile)
frontend/         # React SPA (+ Dockerfile → nginx image)
docs/authentication-flow-guide.md
```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `invalid_redirect_uri` | Client must allow `…/callback` (re-import with `down -v`) |
| `Unauthorized client` / secret errors | Client must be **public** (no secret) |
| Backend can't reach Keycloak JWKS | `extra_hosts: localhost:host-gateway` — restart backend |
| Old static UI | `docker compose up -d --build nginx` |
| Port 8088 / 8090 busy | Stop conflicting containers (e.g. kafka-ui on 8090) |
