"""
LUNA NAVIGATOR — Ephemeris API Endpoints (Member 2 Ownership)
REST endpoints for topocentric celestial coordinates and NASA JPL Horizons validation.
Matches shared REST contracts in docs/api-contracts.md.
"""

from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, status
from app.engines.ephemeris.engine import ephemeris_engine
from app.services.horizons_client import horizons_client
from app.schemas.ephemeris import (
    EphemerisRequest,
    EphemerisResponse,
    EphemerisPoint,
    EphemerisValidationResponse,
    HorizonsStatusResponse
)

router = APIRouter()


@router.post(
    "/ephemeris",
    response_model=EphemerisResponse,
    status_code=status.HTTP_200_OK,
    tags=["Orbital Mechanics"],
    summary="Calculate topocentric Sun & Earth ephemeris series"
)
def calculate_ephemeris(request: EphemerisRequest):
    """
    Calculate topocentric Sun and Earth azimuth, elevation, range, and sub-Earth libration
    relative to a specific lunar surface coordinate over a given mission window.
    
    Adheres strictly to docs/api-contracts.md Section 2.
    """
    try:
        return ephemeris_engine.calculate_ephemeris_series(request)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ephemeris calculation failed: {str(e)}"
        )


@router.get(
    "/ephemeris/validate",
    response_model=EphemerisValidationResponse,
    status_code=status.HTTP_200_OK,
    tags=["Orbital Mechanics"],
    summary="Cross-validate calculations against NASA JPL Horizons DE440 ground-truth"
)
def validate_ephemeris(
    site_id: str = Query(default="shackleton-rim", description="Candidate site identifier"),
    epoch_iso: str = Query(default="2026-12-01T00:00:00Z", description="ISO 8601 UTC timestamp")
):
    """
    Empirically compare current analytical ephemeris calculations with verified
    NASA JPL Horizons DE440 benchmark data, returning exact residual errors.
    """
    try:
        return ephemeris_engine.validate_site_ephemeris(site_id=site_id, epoch_iso=epoch_iso)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ephemeris validation failed: {str(e)}"
        )


@router.get(
    "/ephemeris/horizons-status",
    response_model=HorizonsStatusResponse,
    status_code=status.HTTP_200_OK,
    tags=["Orbital Mechanics"],
    summary="Check NASA JPL Horizons API telemetry & cache status"
)
def get_horizons_telemetry():
    """
    Retrieve telemetry statistics for NASA JPL Horizons API client and query cache.
    """
    try:
        status_info = horizons_client.get_service_status()
        return HorizonsStatusResponse(**status_info)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to query Horizons telemetry: {str(e)}"
        )
