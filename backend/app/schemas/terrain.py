"""
LUNA NAVIGATOR — Terrain Horizon Schemas
"""

from typing import List, Optional
from pydantic import BaseModel, Field
from app.schemas.common import CoordinatesRequest


class TerrainHorizonRequest(CoordinatesRequest):
    max_distance_km: float = Field(
        default=60.0,
        gt=1.0,
        le=150.0,
        description="Maximum radial ray-trace horizon search distance in km"
    )
    azimuth_step_deg: float = Field(
        default=1.0,
        gt=0.1,
        le=10.0,
        description="Azimuth sampling resolution step in degrees"
    )
    observer_height_m: float = Field(
        default=2.0,
        ge=0.0,
        le=50.0,
        description="Height of instrument or solar array mast above ground in meters"
    )


class HorizonPoint(BaseModel):
    azimuth_deg: float = Field(..., description="Azimuth angle clockwise from North [0 to 360)")
    horizon_elevation_deg: float = Field(..., description="Maximum terrain obstruction elevation angle (deg)")
    obstruction_distance_km: float = Field(..., description="Distance in km to the blocking terrain feature")
    blocking_feature: Optional[str] = Field(default="Local Topographic Relief", description="Identified geomorphic feature")


class TerrainHorizonResponse(BaseModel):
    latitude: float
    longitude: float
    elevation_m: float
    observer_height_m: float
    elevation_datum: str = "Lunar Sphere R=1737.4 km (NASA LOLA)"
    terrain_data_source: str = Field(
        default="NASA LOLA RASTER DEM (1200m/px)",
        description="Dataset provenance: NASA LOLA raster DEM product or procedural topography fallback"
    )
    dem_resolution_m: float = Field(
        default=1200.0,
        description="Spatial grid resolution in meters per pixel"
    )
    is_procedural_fallback: bool = Field(
        default=False,
        description="True if procedural synthetic model was used instead of real DEM raster"
    )
    data_quality_warning: Optional[str] = Field(
        default=None,
        description="Warning notice if synthetic or degraded DEM resolution was used"
    )
    horizon_points: List[HorizonPoint]
    max_horizon_elevation_deg: float
    min_horizon_elevation_deg: float
    average_horizon_elevation_deg: float
