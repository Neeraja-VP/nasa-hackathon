"""
LUNA NAVIGATOR — FastAPI Main Application Entrypoint
Unified scientific platform for lunar landing site evaluation and mission simulation.
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from app.core.config import settings
from app.api.v1.router import api_router


def create_application() -> FastAPI:
    app = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        description=(
            "AI-Powered Lunar Landing Site Navigator — Decision-support platform for evaluating "
            "lunar south-pole landing zones using NASA JPL Horizons ephemerides and LOLA elevation models."
        ),
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json"
    )

    # Configure Cross-Origin Resource Sharing (CORS) for Member 1 Frontend
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Custom exception handler for validation errors
    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        first_error = exc.errors()[0] if exc.errors() else {}
        loc = first_error.get("loc", [])
        field_name = str(loc[-1]) if loc else "unknown"
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": first_error.get("msg", "Invalid request parameter"),
                    "field": field_name,
                    "details": exc.errors()
                }
            }
        )

    # Mount API routers (accessible at both /api and /api/v1 for developer convenience)
    app.include_router(api_router, prefix="/api")
    app.include_router(api_router, prefix="/api/v1")

    @app.get("/", tags=["Root"])
    def root():
        return {
            "name": settings.PROJECT_NAME,
            "version": settings.VERSION,
            "documentation": "/docs",
            "api_endpoints": "/api"
        }

    @app.get("/health", tags=["System"])
    def root_health():
        return {
            "status": "HEALTHY",
            "service": settings.PROJECT_NAME,
            "version": settings.VERSION,
            "environment": settings.ENVIRONMENT
        }

    return app


app = create_application()
