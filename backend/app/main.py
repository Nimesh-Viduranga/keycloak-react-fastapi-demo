from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from starlette.middleware.sessions import SessionMiddleware

from .auth import (
    decode_id_token_payload,
    end_session_url,
    oauth,
    register_oauth,
    require_user,
    user_from_session,
)
from .config import get_settings

settings = get_settings()
register_oauth(settings)

app = FastAPI(title="Keycloak React FastAPI Demo", version="1.0.0")

app.add_middleware(
    SessionMiddleware,
    secret_key=settings.session_secret,
    same_site="lax",
    https_only=False,  # local HTTP only
    max_age=60 * 60 * 8,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/auth/login")
async def login(request: Request):
    if user_from_session(request):
        return RedirectResponse(f"{settings.frontend_url}/dashboard")
    redirect_uri = settings.redirect_uri
    return await oauth.keycloak.authorize_redirect(request, redirect_uri)


@app.get("/auth/callback")
async def callback(request: Request):
    try:
        token = await oauth.keycloak.authorize_access_token(request)
    except Exception as exc:
        # Common: wrong client secret, redirect URI, or expired/reused code
        return RedirectResponse(
            f"{settings.frontend_url}/?error=callback_failed&detail={type(exc).__name__}"
        )

    id_token = token.get("id_token")
    claims = token.get("userinfo") or {}
    if not claims and id_token:
        claims = decode_id_token_payload(id_token)

    sub = claims.get("sub")
    if not sub:
        return RedirectResponse(f"{settings.frontend_url}/?error=missing_sub")

    request.session["user"] = {
        "sub": sub,
        "email": claims.get("email"),
        "name": claims.get("name") or claims.get("preferred_username"),
        "preferred_username": claims.get("preferred_username"),
        "given_name": claims.get("given_name"),
        "family_name": claims.get("family_name"),
    }
    if id_token:
        request.session["id_token"] = id_token

    return RedirectResponse(f"{settings.frontend_url}/dashboard")


@app.get("/auth/signup")
async def signup(request: Request):
    """Start OIDC like login so Authlib stores CSRF `state`, then open registration.

    A bare redirect to /registrations skipped Authlib state → MismatchingStateError
    on /auth/callback after the user registered.
    """
    if user_from_session(request):
        return RedirectResponse(f"{settings.frontend_url}/dashboard")

    redirect_uri = settings.redirect_uri
    client = oauth.keycloak
    # Same state/nonce session setup as login
    rv = await client.create_authorization_url(redirect_uri)
    await client.save_authorize_data(request, redirect_uri=redirect_uri, **rv)

    # Keycloak 26.0: user registration endpoint (Authlib still validates `state` on callback)
    url = rv["url"].replace(
        "/protocol/openid-connect/auth?",
        "/protocol/openid-connect/registrations?",
        1,
    )
    return RedirectResponse(url, status_code=302)


@app.post("/auth/logout")
async def logout(request: Request):
    id_token = request.session.get("id_token")
    request.session.clear()
    return JSONResponse({"logout_url": end_session_url(id_token, settings)})


@app.get("/api/me")
async def me(request: Request):
    user = require_user(request)
    return {"user": user}
