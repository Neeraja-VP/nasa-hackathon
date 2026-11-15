"""
LUNA NAVIGATOR — Solar Illumination Schemas
"""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field
from app.schemas.common import CoordinatesRequest, DateRangeRequest


class IlluminationRequest(CoordinatesRequest, DateRangeRequest):
    use_terrain_horizon: bool = Field(
        default=True,
        description="Whether to evaluate shadows using LOLA terrain horizon ray tracing"
    )
    mast_height_m: float = Field(
        default=2.0,
        ge=0.0,
        le=50.0,
        description="Height of solar panels above local ground surface (meters)"
    )
    use_live_horizons: bool = Field(
        default=False,
        description="Whether to query live NASA JPL Horizons Web API (requires external network)"
    )


class IlluminationPoint(BaseModel):
    timestamp: datetime
    sun_azimuth_deg: float
    sun_elevation_deg: float
    terrain_horizon_elevation_deg: float
    is_sunlit_geometric: bool
    is_sunlit_terrain: bool
    solar_flux_w_m2: float
    effective_flux_horizontal_w_m2: float


class IlluminationResponse(BaseModel):
    latitude: float
    longitude: float
    start_date: datetime
    duration_days: float
    step_hours: float
    illumination_percentage: float
    total_sunlit_hours: float
    total_shadow_hours: float
    longest_continuous_sunlight_hours: float
    longest_continuous_shadow_hours: float
    data_source: str = Field(
        default="ANALYTICAL FALLBACK DATA",
        description="Ephemeris data source: LIVE NASA HORIZONS DATA, CACHED NASA HORIZONS DATA, or ANALYTICAL FALLBACK DATA"
    )
    data_source_type: str = Field(
        default="ANALYTICAL_FALLBACK",
        description="Type category: LIVE_NASA_HORIZONS, CACHED_NASA_HORIZONS, or ANALYTICAL_FALLBACK"
    )
    terrain_data_source: str = Field(
        default="NASA LOLA RASTER DEM (1200m/px)",
        description="Topographic elevation source provenance"
    )
    dem_resolution_m: float = Field(
        default=1200.0,
        description="LOLA DEM spatial resolution in meters per pixel"
    )
    data_quality_warning: Optional[str] = Field(
        default=None,
        description="Warning notice if external or raster datasets were degraded or fell back"
    )
    time_series: List[IlluminationPoint]
