# Authentication Architecture Review — SPA OIDC Client + Stateless Resource Server

**Date:** 2026-07-20
**Scope:** Verify the current auth architecture (React public OIDC client + FastAPI
JWT resource server) against OIDC/OAuth standards and production readiness.
**Supersedes:** the BFF design/plan under `docs/superpowers/` (the project pivoted
away from Backend-for-Frontend). See the current runtime walkthrough in
[`authentication-flow-guide.md`](./authentication-flow-guide.md).

## Verdict

The architecture is **standards-correct and production-legitimate**. The React SPA
is a **public OIDC client** running **Authorization Code + PKCE**; FastAPI is a
**stateless resource server** validating Bearer JWTs via Keycloak's JWKS. This is
the pattern the current IETF BCP (RFC 9700, *OAuth 2.0 for Browser-Based Apps*)
recommends for SPAs. It is not inherently "weaker" than the BFF that was removed —
it sits at a different point on the security/complexity tradeoff, with **one risk
decision** (tokens exposed to the browser / XSS) and a short hardening checklist.

## Current architecture

```
┌─────────┐   authorization code + PKCE (S256)   ┌──────────┐
│  React  │ ───────────────────────────────────▶ │ Keycloak │
│  (SPA)  │ ◀──── id/access/refresh tokens ────── │  (:8090) │
└────┬────┘     (in adapter memory; not web storage) └──────────┘
     │  GET /api/me   Authorization: Bearer <access_token>   (same-origin via nginx)
     ▼
┌──────────┐
│ FastAPI  │  validates JWT: signature (JWKS) · iss · exp · aud · azp
└──────────┘
```

- **Client:** public, no secret in the browser; PKCE `S256` enforced server-side.
- **Backend:** no login/session/code-exchange; pure token validation, stateless.
- **Topology:** nginx serves the SPA and reverse-proxies same-origin `/api`, so
  API calls avoid CORS; the browser talks to Keycloak cross-origin for OIDC only.

## Standards conformance

| Concern | Implementation | Standard | Status |
|---|---|---|---|
| Grant type | `response_type=code` via `keycloak-js` | RFC 9700 / OAuth 2.1 (code for SPAs) | ✅ |
| PKCE | library verifier/challenge; realm enforces `S256` | RFC 7636 | ✅ |
| Implicit / ROPC | both disabled on the client | BCP deprecates both | ✅ |
| Client type | public client, no secret | correct for SPA | ✅ |
| id_token validation | `keycloak-js` checks tokens after code exchange | OIDC Core §3.1.3.7 | ✅ (library) |
| RS token validation | JWKS + iss + exp + **aud** + RS256 pinned + azp | RFC 9068 §4 | ✅ (after P1 fix) |
| Refresh tokens | rotation + reuse detection | RFC 9700 §6.1 | ✅ (after P3 fix) |
| CORS | Bearer auth, `allow_credentials=false`, scoped origins | no cookies → correct | ✅ |

## Findings and status

Severity: **P1** highest. "Fixed" items were addressed in this change set
(commits on branch `auth-hardening-and-review`).

| # | Finding | Where | Status |
|---|---|---|---|
| P1 | RS disabled audience verification; accepted `aud` **OR** `azp==client_id` — any token minted for the SPA was accepted regardless of intended audience (confused-deputy). | `backend/app/auth.py` | **Fixed** — strict `aud` via PyJWT + Keycloak audience mapper; `azp` now defense-in-depth only. |
| P3 | Refresh tokens not rotated; browser-held refresh token could be replayed. | realm | **Fixed** — `revokeRefreshToken` + `refreshTokenMaxReuse=0`, `accessTokenLifespan=300`. |
| P4 | React 19 StrictMode must not call `keycloak.init()` twice. | `frontend/src/auth/keycloak.js` | **Fixed** — module-level init promise latch. |
| P5 | Sign-up should use the adapter’s register helper (not metadata hacks). | `frontend/src/auth/AuthContext.jsx` | **Fixed** — `keycloak.register()`. |
| P2 | Access **and refresh** tokens live in **adapter memory** (not `sessionStorage`/`localStorage`) → XSS can still read the heap while the tab is alive; a hard refresh clears tokens until SSO re-establishes. | `frontend/src/auth/keycloak.js` | **Accepted risk** — better than durable web storage; still needs CSP / XSS hygiene (below). |
| P8 | Hard refresh / deep-link to `/dashboard` had no in-memory tokens (`check-sso` avoided — invalid `/` redirect URI + 3P-cookie iframes). | `Dashboard.jsx` | **Fixed** — protected route auto-calls `login()` once (transparent Keycloak SSO bounce). |
| P9 | Token refresh only on API calls; idle expiry was silent. | `AuthContext.jsx` | **Fixed** — `onTokenExpired` → `updateToken(30)`. |
| P6 | `VITE_*` env is inlined at build time; the Docker image hardcodes `localhost:8090`. | `frontend/Dockerfile` | **Operational** — inject per-env build args or a runtime `config.js`. |
| P7 | Dev-mode Keycloak: `start-dev`, `sslRequired=none`, `KC_HOSTNAME_STRICT=false`, HTTP origins. | compose / realm | **Operational** — see pre-prod checklist. |

## The decision that matters: SPA-as-client vs BFF

Both are standard. This is a **risk choice**, not a correctness one:

- **Keep SPA-as-client (current)** when API data is low/medium sensitivity, a
  strong CSP and dependency discipline are in place, and a simpler stateless
  backend is valued. With P1/P3 fixed, this is a defensible production setup.
- **Return toward a BFF** when handling high-value data or under compliance
  pressure, or when tokens must never be reachable by JavaScript. RFC 9700 still
  names the token-mediating BFF the most robust option.

Because the team deliberately moved off BFF, staying is reasonable — provided the
XSS exposure (P2) is treated as a first-class constraint via the controls below.

## P2 compensating controls (required if keeping this pattern)

- Strict **Content-Security-Policy** (no inline scripts; locked `script-src`).
- **No** `dangerouslySetInnerHTML` / unsanitized HTML; disciplined dependency
  hygiene (the SPA's whole dependency tree can read in-memory tokens during XSS).
- Short access-token TTL (done: 300s) + refresh rotation (done).
- Prefer **in-memory** tokens (current `keycloak-js` default) over writing access /
  refresh tokens to `localStorage` / `sessionStorage`. (PKCE `state` may still use
  short-lived `localStorage` entries — that is not the access token.)
- Protected routes auto-login via Keycloak SSO (done) instead of fragile iframe
  `check-sso`.

## Pre-production checklist (P6/P7 and deployment)

- Keycloak in **production mode** (not `start-dev`); `sslRequired=external`,
  `KC_HOSTNAME_STRICT=true`, TLS end-to-end.
- Exact **HTTPS** redirect URIs and web origins per environment; no wildcards on
  the callback path.
- **Issuer/hostname consistency:** the `iss` the browser receives must equal the
  `issuer` the backend validates *and* the JWKS URL must be reachable from the
  backend (classic split-network pitfall behind proxies).
- Frontend build: inject `VITE_KEYCLOAK_URL` / `VITE_KEYCLOAK_REALM` / `VITE_CLIENT_ID` per
  environment (build args or runtime config), not the baked localhost defaults.
- Enable Keycloak **brute-force protection** and review token/session lifespans.
