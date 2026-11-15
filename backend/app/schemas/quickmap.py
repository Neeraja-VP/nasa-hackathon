"""
LUNA NAVIGATOR — LROC QuickMap Schemas
Metadata, layer definitions, and URL generation schemas for NASA LROC QuickMap.
"""

from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field


class QuickMapLayer(BaseModel):
    id: str = Field(..., description="Unique layer identifier")
    name: str = Field(..., description="Human-readable layer name")
    resolution: str = Field(..., description="Spatial resolution or grid scale")
    layer_type: str = Field(..., description="Classification (e.g. Optical Mosaic, DEM, PSR)")
    description: str = Field(..., description="Layer description and scientific heritage")


class QuickMapProjection(BaseModel):
    id: int = Field(default=10, description="QuickMap internal projection identifier")
    code: str = Field(default="EPSG:3032", description="Standard EPSG / IAU code")
    name: str = Field(default="Lunar South Pole Stereographic", description="Projection name")
    central_meridian_deg: float = Field(default=0.0, description="Central longitude meridian")
    standard_parallel_deg: float = Field(default=-90.0, description="Origin latitude parallel")


class QuickMapMetadataResponse(BaseModel):
    service: str = Field(default="LROC QuickMap (Lunar Reconnaissance Orbiter Camera)")
    institution: str = Field(default="Arizona State University (ASU) & Intuitive Machines / ACT-REACT")
    share_url: str = Field(default="https://share.google/sCb5mzv7y0G7kEfA4")
    resolved_url: str = Field(...)
    projection: QuickMapProjection
    stack_id: int = Field(default=3314)
    earth_shadow_enabled: bool = Field(default=True)
    extent: List[float] = Field(...)
    layers: List[QuickMapLayer]
    site_bookmarks: Dict[str, str] = Field(..., description="Direct QuickMap URLs for each candidate site")


class QuickMapUrlResponse(BaseModel):
    url: str
    latitude: float
    longitude: float
    site_id: Optional[str] = None
    stack_id: int
    earth_shadow_enabled: bool
