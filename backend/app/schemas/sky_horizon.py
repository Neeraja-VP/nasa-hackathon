"""
LUNA NAVIGATOR — Combined Sky Horizon Schemas (Task 1 - 9)
"""

from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from app.schemas.common import CoordinatesRequest, DateRangeRequest
from app.schemas.terrain import HorizonPoint


class SkyHorizonRequest(CoordinatesRequest, DateRangeRequest):
    mast_height_m: float = Field(
        default=2.0,
        ge=0.0,
        le=50.0,
        description="Observer instrument / solar mast height above ground in meters"
    )
    azimuth_step_deg: float = Field(
        default=1.0,
        gt=0.1,
        le=10.0,
        description="Azimuth sampling resolution step for the 360-degree terrain horizon profile"
    )
    min_comm_elevation_deg: float = Field(
        default=0.5,
        ge=-5.0,
        le=15.0,
        description="Minimum elevation angle above local horizon for viable DTE radio link"
    )
    use_live_horizons: bool = Field(
        default=False,
        description="Whether to query live NASA JPL Horizons Web API (DE440 ephemeris)"
    )


class SkyHorizonPoint(BaseModel):
    timestamp: datetime
    step_index: int
    mission_elapsed_hours: float

    # 1. Sun topocentric position & terrain obstruction
    sun_azimuth_deg: float
    sun_elevation_deg: float
    sun_terrain_horizon_elevation_deg: float
    sun_elevation_clearance_deg: float
    is_sun_visible: bool
    is_sun_geometric: bool
    sun_visibility_status: str  # "DIRECT_SUNLIGHT" | "PENUMBRA" | "TERRAIN_OCCLUDED" | "BELOW_GEOMETRIC_HORIZON"
    solar_flux_w_m2: float

    # 2. Earth topocentric position & terrain obstruction
    earth_azimuth_deg: float
    earth_elevation_deg: float
    earth_terrain_horizon_elevation_deg: float
    earth_elevation_clearance_deg: float
    is_earth_visible: bool
    is_earth_geometric: bool
    earth_visibility_status: str  # "DIRECT_LINE_OF_SIGHT" | "TERRAIN_BLOCKED" | "BELOW_GEOMETRIC_HORIZON"
    earth_apparent_diameter_deg: float


class SkyHorizonResponse(BaseModel):
    latitude: float
    longitude: float
    elevation_m: float
    mast_height_m: float
    start_date: datetime
    duration_days: float
    step_hours: float
    total_steps: int

    # 360-degree local terrain horizon profile
    horizon_profile: List[HorizonPoint]
    max_horizon_elevation_deg: float
    min_horizon_elevation_deg: float
    average_horizon_elevation_deg: float

    # Time series of Sun and Earth topocentric positions
    time_series: List[SkyHorizonPoint]

    # Overall Sun metrics
    illumination_percentage: float
    total_sunlight_hours: float
    total_darkness_hours: float
    longest_continuous_sunlight_hours: float
    longest_continuous_darkness_hours: float

    # Overall Earth metrics
    communication_percentage: float
    total_comm_hours: float
    total_comm_blackout_hours: float
    longest_continuous_comm_window_hours: float
    longest_continuous_blackout_hours: float

    # Provenance
    data_source: str = "ANALYTICAL FALLBACK DATA"
    data_source_type: str = "ANALYTICAL_FALLBACK"
    terrain_data_source: str = "NASA LOLA RASTER DEM (1200m/px)"
    dem_resolution_m: float = 1200.0
    is_procedural_fallback: bool = False
    data_quality_warning: Optional[str] = None
