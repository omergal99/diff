"""
Diffinity Backend — FastAPI Application Entry Point.

Registers all routers and configures CORS for local development.
Run with: uvicorn main:app --reload --port 8000
"""

from __future__ import annotations
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from utils.models import HealthResponse
from utils.logger import get_logger

from api.routes_diff import router as diff_router
from api.routes_archive import router as archive_router
from api.routes_image import router as image_router
from api.routes_office import router as office_router
from api.routes_unicode import router as unicode_router

log = get_logger("main")

app = FastAPI(
    title="Diffinity API",
    description="Professional file comparison engine",
    version="0.1.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# CORS — allow the frontend dev server and file:// origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "null"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register all routers
app.include_router(diff_router)
app.include_router(archive_router)
app.include_router(image_router)
app.include_router(office_router)
app.include_router(unicode_router)


@app.get("/api/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    """Health check endpoint."""
    return HealthResponse()


@app.on_event("startup")
async def on_startup() -> None:
    log.info("Diffinity backend started — http://localhost:8000/api/docs")
