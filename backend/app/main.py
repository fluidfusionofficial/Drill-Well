"""NWIS FastAPI application entry point.

Responsibilities:
- Create the FastAPI app with metadata.
- Register CORS middleware.
- Mount all API routers under the /api prefix.
- Expose a /health liveness endpoint.
- Manage application lifespan (startup / shutdown logging).
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings

logger = logging.getLogger("nwis")


# ── Lifespan ───────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Log startup and shutdown events.

    Extend this context manager to initialise connection pools, load ML
    models, or warm caches when those components are added.
    """
    logger.info(
        "NWIS API starting up — version=%s debug=%s",
        app.version,
        settings.DEBUG,
    )
    yield
    logger.info("NWIS API shut down cleanly.")


# ── Application instance ───────────────────────────────────────────────────────

app = FastAPI(
    title="NWIS API",
    description=(
        "Nearby Wells Intelligence System — AI-powered offset-well knowledge "
        "and decision-support platform for Oil India Limited (SIH26121)."
    ),
    version="0.1.0",
    docs_url=f"{settings.API_PREFIX}/docs",
    redoc_url=f"{settings.API_PREFIX}/redoc",
    openapi_url=f"{settings.API_PREFIX}/openapi.json",
    lifespan=lifespan,
)

# ── Middleware ─────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Routers ────────────────────────────────────────────────────────────────────
# Import routers lazily so that the app boots even when individual router
# modules are still under construction.  Each router module must expose a
# `router` attribute (fastapi.APIRouter instance).

def _include_router(module_path: str, prefix: str, tags: list[str]) -> None:
    """Attempt to import and register a router; log a warning on failure."""
    try:
        import importlib

        module = importlib.import_module(module_path)
        app.include_router(
            module.router,
            prefix=f"{settings.API_PREFIX}{prefix}",
            tags=tags,
        )
        logger.debug("Registered router: %s → %s%s", module_path, settings.API_PREFIX, prefix)
    except ImportError as exc:
        logger.warning("Router not yet available (%s): %s", module_path, exc)


# Routers that define their own prefix in APIRouter(prefix=...) are registered
# here with an empty prefix so the path is not doubled.
# Routers with prefix="" in their APIRouter use the mount prefix below instead.
_include_router("app.api.wells", "", ["Wells"])          # router prefix="/wells"
_include_router("app.api.ingestion", "", ["Ingestion"])  # router prefix="/ingestion"
_include_router("app.api.search", "", ["Search"])        # router prefix="/search"
_include_router("app.api.sources", "", ["Sources"])      # router prefix="/sources"
_include_router("app.api.alerts", "/alerts", ["Alerts"])       # router prefix=""
_include_router("app.api.knowledge", "/knowledge", ["Knowledge"])  # router prefix=""


# ── Health endpoint ────────────────────────────────────────────────────────────

@app.get("/health", tags=["Health"], summary="Liveness probe")
async def health() -> dict[str, str]:
    """Return a simple OK response.

    Kubernetes liveness and readiness probes can target this endpoint.
    A richer readiness probe that checks the database connection will be
    added in a later iteration.
    """
    return {"status": "ok", "service": settings.APP_NAME}


# ── Logging configuration ─────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s — %(message)s",
)
