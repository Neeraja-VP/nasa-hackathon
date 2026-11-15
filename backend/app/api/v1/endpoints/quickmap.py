"""
LUNA NAVIGATOR — LROC QuickMap Endpoints
REST endpoints providing metadata, layer definitions, and deep-link generation for NASA LROC QuickMap.
"""

import math
from typing import Optional
from fastapi import APIRouter, Query, HTTPException
from app.schemas.quickmap import (
    QuickMapMetadataResponse,
    QuickMapUrlResponse,
    QuickMapLayer,
    QuickMapProjection
)
from app.core.sites_catalog import load_candidate_sites, get_site_by_id
from app.core.constants import MOON_MEAN_RADIUS_M

router = APIRouter(prefix="/quickmap", tags=["LROC QuickMap"])

LROC_QUICKMAP_BASE = "https://quickmap.lroc.im-ldi.com/"
CANONICAL_SHARE_URL = "https://share.google/sCb5mzv7y0G7kEfA4"
CANONICAL_DEFS = "N4IgzGCMAsIFygPYAcCGBjAlgFwJ70gF9Cg"
CANONICAL_RESOLVED_URL = (
    "https://quickmap.lroc.im-ldi.com/?prjExtent=-3051793.6799876%2C-3012593.8734225"
    "%2C2175523.681406%2C3149731.2394266&earthShadowEnabled=true&proj=10&stack=3314"
    f"&defs={CANONICAL_DEFS}"
)


def latlon_to_polar_stereo_m(lat_deg: float, lon_deg: float) -> tuple[float, float]:
    """Convert selenographic coordinates to Moon South Pole Stereographic (EPSG:3032) meters."""
    colat_rad = math.radians(90.0 - abs(lat_deg))
    r = 2.0 * MOON_MEAN_RADIUS_M * math.tan(colat_rad / 2.0)
    lon_rad = math.radians(lon_deg)
    x = r * math.sin(lon_rad)
    y = -r * math.cos(lon_rad)
    return x, y


def build_quickmap_site_url(lat_deg: float, lon_deg: float, radius_km: float = 75.0) -> str:
    """Construct deep-link QuickMap URL centered on a specific lunar location."""
    x, y = latlon_to_polar_stereo_m(lat_deg, lon_deg)
    delta_m = radius_km * 1000.0
    x_min = x - delta_m
    y_min = y - delta_m
    x_max = x + delta_m
    y_max = y + delta_m
    extent_str = f"{x_min:.1f}%2C{y_min:.1f}%2C{x_max:.1f}%2C{y_max:.1f}"
    return (
        f"{LROC_QUICKMAP_BASE}?prjExtent={extent_str}"
        f"&earthShadowEnabled=true&proj=10&stack=3314"
        f"&defs={CANONICAL_DEFS}"
    )


@router.get("/metadata", response_model=QuickMapMetadataResponse)
def get_quickmap_metadata():
    """Return LROC QuickMap configuration, projection specifications, layer stack, and site bookmarks."""
    sites = load_candidate_sites()
    site_bookmarks = {}
    for s in sites:
        site_bookmarks[s.id] = build_quickmap_site_url(s.latitude, s.longitude, radius_km=60.0)

    layers = [
        QuickMapLayer(
            id="lroc_wac_polar",
            name="LROC Wide Angle Camera (WAC) South Pole Mosaic",
            resolution="64 m/pixel",
            layer_type="Optical Mosaic",
            description="Controlled seamless multi-temporal optical mosaic captured by NASA LRO WAC."
        ),
        QuickMapLayer(
            id="lola_dem_color",
            name="LOLA Hypsometric Elevation Shaded Relief",
            resolution="20 m/pixel",
            layer_type="Hypsometric Topography",
            description="False-color digital elevation model derived from NASA LOLA laser altimeter returns."
        ),
        QuickMapLayer(
            id="lroc_nac_strips",
            name="LROC Narrow Angle Camera (NAC) Artemis Candidate Corridors",
            resolution="0.5 - 1.0 m/pixel",
            layer_type="Ultra High-Resolution Optical",
            description="Meter-scale targeted optical swaths resolving meter-sized boulders and local touchdown hazards."
        ),
        QuickMapLayer(
            id="psr_catalog",
            name="Permanently Shadowed Regions (PSR) Water Ice Traps",
            resolution="240 m/pixel",
            layer_type="Cryogenic Traps",
            description="Polygonal boundaries of south-pole depression craters receiving zero direct sunlight."
        ),
        QuickMapLayer(
            id="earth_shadow_mask",
            name="Dynamic Grazing Sunlight & Earth Shadow Simulator",
            resolution="Real-time Celestial",
            layer_type="Solar Shadow Mask",
            description="ACT-REACT solar raytracing casting true grazing shadows across ridges and crater walls."
        ),
    ]

    return QuickMapMetadataResponse(
        service="LROC QuickMap (Lunar Reconnaissance Orbiter Camera)",
        institution="Arizona State University (ASU) & Intuitive Machines / ACT-REACT",
        share_url=CANONICAL_SHARE_URL,
        resolved_url=CANONICAL_RESOLVED_URL,
        projection=QuickMapProjection(
            id=10,
            code="EPSG:3032",
            name="Lunar South Pole Stereographic",
            central_meridian_deg=0.0,
            standard_parallel_deg=-90.0
        ),
        stack_id=3314,
        defs=CANONICAL_DEFS,
        earth_shadow_enabled=True,
        extent=[-3051793.68, -3012593.87, 2175523.68, 3149731.24],
        layers=layers,
        site_bookmarks=site_bookmarks
    )


@router.get("/url", response_model=QuickMapUrlResponse)
def get_quickmap_url(
    site_id: Optional[str] = Query(None, description="Candidate site ID (e.g. shackleton-rim)"),
    latitude: Optional[float] = Query(None, ge=-90.0, le=-60.0, description="Latitude degrees South"),
    longitude: Optional[float] = Query(None, ge=-180.0, le=180.0, description="Longitude degrees"),
    radius_km: float = Query(60.0, ge=10.0, le=500.0, description="Map view half-width extent in km")
):
    """Generate a custom LROC QuickMap URL for a specified candidate site or selenographic coordinate."""
    target_lat = latitude
    target_lon = longitude

    if site_id:
        site = get_site_by_id(site_id)
        if not site:
            raise HTTPException(status_code=404, detail=f"Candidate site '{site_id}' not found")
        target_lat = site.latitude
        target_lon = site.longitude
    elif target_lat is None or target_lon is None:
        # Default to Shackleton Crater Rim
        target_lat = -89.78
        target_lon = 125.0

    url = build_quickmap_site_url(target_lat, target_lon, radius_km=radius_km)
    return QuickMapUrlResponse(
        url=url,
        latitude=target_lat,
        longitude=target_lon,
        site_id=site_id,
        stack_id=3314,
        defs=CANONICAL_DEFS,
        earth_shadow_enabled=True
    )
