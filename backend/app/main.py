from __future__ import annotations

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .auth import require_user
from .config import get_settings

settings = get_settings()

app = FastAPI(title="Keycloak React FastAPI Demo", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/api/me")
async def me(user: dict = Depends(require_user)):
    return {"user": user}
