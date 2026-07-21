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
        # RFC 9068 §4: verify signature, issuer, expiry, AND that our identifier
        # is in `aud`. PyJWT enforces `aud` when `audience=` is passed and
        # verify_aud is on (default), rejecting tokens minted for other resources.
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            issuer=settings.issuer,
            audience=settings.api_audience,
            leeway=settings.clock_skew_leeway,
            options={"require": ["exp", "iat", "iss", "aud"]},
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail=f"Invalid token: {exc}") from exc

    # Defense in depth: this API is only meant to receive tokens issued to our
    # own SPA client, so the authorized party must match. (Relax via env if the
    # API is ever shared by multiple front-end clients.)
    azp = claims.get("azp")
    if azp is not None and azp != settings.keycloak_client_id:
        raise HTTPException(status_code=401, detail="Unexpected authorized party (azp)")

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
