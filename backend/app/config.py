import os
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()


@lru_cache
def get_settings():
    return Settings()


class Settings:
    frontend_url: str
    keycloak_base_url: str
    keycloak_realm: str
    keycloak_client_id: str
    cors_origins: list[str]

    def __init__(self) -> None:
        self.frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
        self.keycloak_base_url = os.getenv("KEYCLOAK_BASE_URL", "http://localhost:8090").rstrip("/")
        self.keycloak_realm = os.getenv("KEYCLOAK_REALM", "brandvisual")
        self.keycloak_client_id = os.getenv("KEYCLOAK_CLIENT_ID", "react-fastapi-demo")
        raw_origins = os.getenv(
            "CORS_ORIGINS",
            "http://localhost:8088,http://localhost:5173",
        )
        self.cors_origins = [o.strip().rstrip("/") for o in raw_origins.split(",") if o.strip()]

    @property
    def realm_url(self) -> str:
        return f"{self.keycloak_base_url}/realms/{self.keycloak_realm}"

    @property
    def jwks_url(self) -> str:
        return f"{self.realm_url}/protocol/openid-connect/certs"

    @property
    def issuer(self) -> str:
        return self.realm_url
