"""
LUNA NAVIGATOR — Ephemeris Request and Response Schemas
Adheres strictly to docs/api-contracts.md Section 2.
"""

from datetime import datetime
from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field
from app.schemas.common import CoordinatesRequest, DateRangeRequest


class EphemerisRequest(CoordinatesRequest, DateRangeRequest):
    """
    Request parameters for calculating topocentric celestial positions.
    """
    use_live_horizons: bool = Field(
        default=False,
        description="Whether to query live NASA JPL Horizons Web API (requires external network)"
    )


class EphemerisPoint(BaseModel):
    timestamp: datetime = Field(..., description="UTC calculation epoch")
    sun_azimuth_deg: float = Field(..., description="Solar azimuth clockwise from Lunar North [0 to 360)")
    sun_elevation_deg: float = Field(..., description="Solar elevation above local horizon plane")
    sun_distance_km: float = Field(..., description="Distance to Sun center in kilometers")
    earth_azimuth_deg: float = Field(..., description="Earth azimuth clockwise from Lunar North [0 to 360)")
    earth_elevation_deg: float = Field(..., description="Earth elevation above local horizon plane")
    earth_distance_km: float = Field(..., description="Distance to Earth center in kilometers")
    sub_earth_longitude_deg: float = Field(..., description="Selenographic longitude of sub-Earth point (libration)")
    sub_earth_latitude_deg: float = Field(..., description="Selenographic latitude of sub-Earth point (libration)")


class EphemerisResponse(BaseModel):
    site_coordinates: CoordinatesRequest
    start_date: datetime
    duration_days: float
    step_hours: float
    total_steps: int
    data_source: str = "NASA JPL Horizons Web API / DE440 ephemeris"
    time_series: List[EphemerisPoint]


class EphemerisValidationResiduals(BaseModel):
    delta_sun_azimuth_deg: float
    delta_sun_elevation_deg: float
    delta_earth_azimuth_deg: float
    delta_earth_elevation_deg: float
    max_residual_deg: float


class EphemerisValidationResponse(BaseModel):
    site_id: str
    epoch: str
    is_validated: bool
    truth: Optional[Dict[str, float]] = None
    residuals: Optional[EphemerisValidationResiduals] = None
    tolerance_deg: float = 0.50
    data_source: str = "NASA JPL Horizons DE440 Planetary Ephemeris (DE440/LE440)"
    message: Optional[str] = None


class HorizonsStatusResponse(BaseModel):
    api_endpoint: str
    cached_query_count: int
    benchmark_sites_available: List[str]
    ephemeris_datum: str
