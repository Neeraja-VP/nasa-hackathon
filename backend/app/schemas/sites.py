"""
LUNA NAVIGATOR — Candidate Sites Schemas
"""

from typing import List, Optional
from pydantic import BaseModel, Field


class SiteSchema(BaseModel):
    id: str = Field(..., description="Unique alphanumeric identifier for candidate site")
    name: str = Field(..., description="Official IAU or mission planning feature name")
    region: str = Field(..., description="Lunar South Pole geographic region")
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Selenographic latitude (deg)")
    longitude: float = Field(..., ge=-180.0, le=360.0, description="Selenographic longitude (deg)")
    elevation_m: float = Field(..., description="Elevation above mean lunar radius (m)")
    slope_degrees: float = Field(..., ge=0.0, le=90.0, description="Mean surface slope gradient (deg)")
    description: str = Field(..., description="Geological and topographic characterization")
    scientific_interest: str = Field(..., description="Primary science objectives and resources")
    primary_advantages: List[str] = Field(default_factory=list, description="Key operational advantages")
    primary_challenges: List[str] = Field(default_factory=list, description="Primary hazards or constraints")
    target_mission_class: List[str] = Field(default_factory=list, description="Applicable mission architectures")
    is_custom: bool = Field(default=False, description="Whether this is a user-defined custom landing site")
    observer_height_m: Optional[float] = Field(default=2.0, ge=0.0, le=100.0, description="Observer/lander height in meters")


class CustomSiteRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100, description="Custom landing site designation")
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Selenographic latitude in degrees [-90 to +90]")
    longitude: float = Field(..., ge=-180.0, le=360.0, description="Selenographic longitude in degrees [-180 to 360]")
    elevation_m: Optional[float] = Field(default=None, ge=-12000.0, le=20000.0, description="Elevation in meters (sampled automatically from LOLA DEM if omitted)")
    observer_height_m: Optional[float] = Field(default=2.0, ge=0.0, le=100.0, description="Observer / lander mast height above ground (m)")
    description: Optional[str] = Field(default=None, max_length=500, description="User notes or mission objective")
    scientific_interest: Optional[str] = Field(default=None, max_length=500, description="Scientific rationale or target volatiles")


class SiteListResponse(BaseModel):
    total_sites: int
    sites: List[SiteSchema]
