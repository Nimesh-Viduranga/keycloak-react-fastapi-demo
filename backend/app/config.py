import os
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()


@lru_cache
def get_settings():
    return Settings()


class Settings:
    session_secret: str
    frontend_url: str
    backend_url: str
    public_url: str
    keycloak_base_url: str
    keycloak_realm: str
    keycloak_client_id: str
    keycloak_client_secret: str

    def __init__(self) -> None:
        self.session_secret = os.getenv("SESSION_SECRET", "dev-insecure-session-secret")
        self.frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
        self.backend_url = os.getenv("BACKEND_URL", "http://localhost:8000").rstrip("/")
        # Browser-facing origin for OAuth redirects (Vite proxy in local dev).
        # Must match where the session cookie is set — usually FRONTEND_URL.
        self.public_url = os.getenv("PUBLIC_URL", self.frontend_url).rstrip("/")
        self.keycloak_base_url = os.getenv("KEYCLOAK_BASE_URL", "http://localhost:8085").rstrip("/")
        self.keycloak_realm = os.getenv("KEYCLOAK_REALM", "mypage")
        self.keycloak_client_id = os.getenv("KEYCLOAK_CLIENT_ID", "react-fastapi-demo")
        self.keycloak_client_secret = os.getenv("KEYCLOAK_CLIENT_SECRET", "")

    @property
    def realm_url(self) -> str:
        return f"{self.keycloak_base_url}/realms/{self.keycloak_realm}"

    @property
    def metadata_url(self) -> str:
        return f"{self.realm_url}/.well-known/openid-configuration"

    @property
    def redirect_uri(self) -> str:
        return f"{self.public_url}/auth/callback"

    @property
    def post_logout_redirect_uri(self) -> str:
        return f"{self.frontend_url}/"
