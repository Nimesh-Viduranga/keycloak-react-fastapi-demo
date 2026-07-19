# Keycloak + React + FastAPI + Nginx (BrandVisual-style BFF demo)

Single browser origin via **nginx** (like BrandVisual):

```
Browser → nginx :8088
            ├─ /          → React static
            ├─ /auth/*    → FastAPI
            └─ /api/*     → FastAPI
                    ↓
              Keycloak :8090 (realm brandvisual)
```

---

## Quick start (nginx mode)

```bash
cd /home/nimesh/projects/keycloak-react-fastapi-demo
cp backend/.env.example backend/.env
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

## Why nginx

| Without nginx | With nginx (closer to BrandVisual) |
|---------------|-------------------------------------|
| Vite `:5173` + API `:8000` | One origin `:8088` |
| Cookie/proxy tricks | Same-origin `/auth` + `/api` |
| Dev-only shape | Matches reverse-proxy production |

---

## Ports

| Service | Port |
|---------|------|
| nginx (app) | **8088** |
| Keycloak | **8090** |
| FastAPI | internal only (`backend:8000`) |

MyPage Keycloak on **8085** can keep running — no conflict.

---

## Keycloak (auto-imported)

| Item | Value |
|------|--------|
| Realm | `brandvisual` |
| Client | `react-fastapi-demo` |
| Secret | `brandvisual-demo-secret` |
| Redirect (nginx) | `http://localhost:8088/auth/callback` |
| Redirect (vite, optional) | `http://localhost:5173/auth/callback` |
| Registration | enabled |

If realm was imported before nginx was added, update the client redirect URIs in Admin, **or** reset Keycloak DB:

```bash
docker compose down -v
docker compose up -d --build
```

(`-v` wipes the Keycloak DB volume and re-imports the realm.)

---

## Optional: Vite-only mode (no nginx)

```bash
# Keycloak only
docker compose up -d keycloak-db keycloak

# Terminal 1
cd backend && source .venv/bin/activate
# set PUBLIC_URL=http://localhost:5173 in .env
uvicorn app.main:app --reload --port 8000

# Terminal 2
cd frontend && npm run dev
```

---

## Layout

```
docker-compose.yml
nginx/default.conf
keycloak/import/brandvisual-realm.json
backend/          # FastAPI (+ Dockerfile)
frontend/         # React (+ Dockerfile → nginx image)
```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `invalid_redirect_uri` | Client must allow `http://localhost:8088/auth/callback` (re-import with `down -v`) |
| Backend can't reach Keycloak | `extra_hosts: localhost:host-gateway` — restart backend |
| Old static UI | `docker compose up -d --build nginx` |
| Port 8088 busy | Change `"8088:80"` in compose |
