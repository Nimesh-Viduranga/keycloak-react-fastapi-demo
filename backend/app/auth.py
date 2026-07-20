"""JWT validation helpers for Keycloak access tokens (SPA public-client pattern)."""

from __future__ import annotations

from typing import Any

import jwt
from fastapi import Depends, HTTPException, Request
from jwt import PyJWKClient

from .config import Settings, get_settings

_jwks_clients: dict[str, PyJWKClient] = {}


def _jwks_client(settings: Settings) -> PyJWKClient:
    url = settings.jwks_url
    if url not in _jwks_clients:
        _jwks_clients[url] = PyJWKClient(url, cache_keys=True)
    return _jwks_clients[url]


def decode_access_token(token: str, settings: Settings | None = None) -> dict[str, Any]:
    settings = settings or get_settings()
    try:
        signing_key = _jwks_client(settings).get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            issuer=settings.issuer,
            options={"verify_aud": False},
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail=f"Invalid token: {exc}") from exc

    azp = claims.get("azp")
    aud = claims.get("aud")
    client_id = settings.keycloak_client_id
    aud_ok = aud == client_id or (isinstance(aud, list) and client_id in aud)
    azp_ok = azp == client_id
    if not (aud_ok or azp_ok):
        raise HTTPException(status_code=401, detail="Token audience/azp mismatch")

    return claims


def bearer_token(request: Request) -> str:
    header = request.headers.get("Authorization") or ""
    if not header.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    token = header[7:].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    return token


def require_user(token: str = Depends(bearer_token)) -> dict[str, Any]:
    claims = decode_access_token(token)
    sub = claims.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Token missing sub")
    return {
        "sub": sub,
        "email": claims.get("email"),
        "name": claims.get("name") or claims.get("preferred_username"),
        "preferred_username": claims.get("preferred_username"),
        "given_name": claims.get("given_name"),
        "family_name": claims.get("family_name"),
    }
