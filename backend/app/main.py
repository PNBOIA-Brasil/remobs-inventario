from __future__ import annotations

import uuid
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings
from app.core.errors import register_error_handlers
from app.models import *  # noqa: F401,F403 - importa metadata dos modelos
from app.routers import alerts, audit_logs, checklists, dashboard, inventory, locations, movements, platforms, sensors, sync, withdrawals


class RequestIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):  # type: ignore[override]
        request_id = request.headers.get(settings.request_id_header) or str(uuid.uuid4())
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers[settings.request_id_header] = request_id
        return response


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        debug=settings.debug,
        lifespan=lifespan,
    )

    cors_origin_regex = None
    if settings.environment.lower() in {"dev", "test"}:
        cors_origin_regex = r"^https?://(localhost|127\.0\.0\.1):\d+$"

    app.add_middleware(RequestIdMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_origin_regex=cors_origin_regex,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    register_error_handlers(app)

    @app.get("/healthz", tags=["health"])
    async def healthz() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(inventory.router)
    app.include_router(locations.router)
    app.include_router(movements.router)
    app.include_router(withdrawals.router)
    app.include_router(audit_logs.router)
    app.include_router(alerts.router)
    app.include_router(checklists.router)
    app.include_router(dashboard.router)
    app.include_router(platforms.router)
    app.include_router(sensors.router)
    app.include_router(sync.router)
    return app


app = create_app()
