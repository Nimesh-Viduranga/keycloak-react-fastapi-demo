"""OIDC helpers for Keycloak via Authlib (BFF pattern)."""

from __future__ import annotations

import base64
import json
from typing import Any
from urllib.parse import urlencode

from authlib.integrations.starlette_client import OAuth
from fastapi import HTTPException, Request

from .config import Settings, get_settings

oauth = OAuth()


def register_oauth(settings: Settings | None = None) -> None:
    settings = settings or get_settings()
    oauth.register(
        name="keycloak",
        client_id=settings.keycloak_client_id,
        client_secret=settings.keycloak_client_secret,
        server_metadata_url=settings.metadata_url,
        client_kwargs={"scope": "openid email profile"},
    )


def decode_id_token_payload(id_token: str) -> dict[str, Any]:
    """Decode JWT payload without signature check (token from server-side code exchange)."""
    parts = id_token.split(".")
    if len(parts) != 3:
        return {}
    payload = parts[1]
    padding = "=" * (-len(payload) % 4)
    try:
        raw = base64.urlsafe_b64decode(payload + padding)
        data = json.loads(raw.decode("utf-8"))
        return data if isinstance(data, dict) else {}
    except (ValueError, json.JSONDecodeError, UnicodeDecodeError):
        return {}


def user_from_session(request: Request) -> dict[str, Any] | None:
    user = request.session.get("user")
    return user if isinstance(user, dict) else None


def require_user(request: Request) -> dict[str, Any]:
    user = user_from_session(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


def end_session_url(id_token: str | None, settings: Settings | None = None) -> str:
    settings = settings or get_settings()
    params = {
        "post_logout_redirect_uri": settings.post_logout_redirect_uri,
        "client_id": settings.keycloak_client_id,
    }
    if id_token:
        params["id_token_hint"] = id_token
    return f"{settings.realm_url}/protocol/openid-connect/logout?{urlencode(params)}"
