"""
Candidate Sites Endpoints
"""
import re
from typing import List
from fastapi import APIRouter, HTTPException
from app.core.sites_catalog import load_candidate_sites, get_site_by_id, register_custom_site
from app.schemas.sites import SiteSchema, CustomSiteRequest
from app.services.geospatial.dem_loader import dem_loader

router = APIRouter()


@router.get("/sites", response_model=List[SiteSchema], tags=["Landing Sites"])
def list_sites():
    """
    Retrieve all characterized lunar south-pole landing candidate sites (including registered custom sites).
    """
    try:
        return load_candidate_sites(include_custom=True)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sites/custom", response_model=SiteSchema, tags=["Landing Sites"])
def create_custom_site(request: CustomSiteRequest):
    """
    Validate and register custom lunar landing coordinates.
    Calculates surface elevation and slope from NASA LOLA DEM models.
    """
    # 1. Coordinate range validation
    if not (-90.0 <= request.latitude <= 90.0):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid latitude {request.latitude}°. Must be between -90.0° and +90.0°."
        )

    norm_lon = request.longitude % 360.0
    if norm_lon < 0:
        norm_lon += 360.0

    # 2. Elevation extraction (sample real LOLA DEM if omitted)
    if request.elevation_m is not None:
        elev_m = float(request.elevation_m)
    else:
        elev_m = dem_loader.sample_elevation(request.latitude, norm_lon)

    # 3. Slope gradient calculation from DEM
    slope_deg = dem_loader.calculate_surface_slope_deg(request.latitude, norm_lon)

    # 4. Generate clean alphanumeric identifier
    slug = re.sub(r"[^a-z0-9]+", "-", request.name.strip().lower()).strip("-")
    if not slug:
        slug = f"site-{abs(int(request.latitude * 100))}-{abs(int(norm_lon * 100))}"
    site_id = f"custom-{slug}"

    # Determine region label
    if request.latitude <= -80.0:
        region_label = "South Pole Polar Circle"
    elif request.latitude >= 80.0:
        region_label = "North Pole Polar Circle"
    elif abs(request.latitude) < 30.0:
        region_label = "Equatorial Highlands / Mare"
    else:
        region_label = "Lunar Mid-Latitudes"

    custom_site = SiteSchema(
        id=site_id,
        name=request.name.strip(),
        region=region_label,
        latitude=round(request.latitude, 4),
        longitude=round(norm_lon, 4),
        elevation_m=round(elev_m, 1),
        slope_degrees=round(slope_deg, 1),
        description=request.description or f"User-defined custom landing zone at {request.latitude:.2f}°S, {norm_lon:.2f}°E.",
        scientific_interest=request.scientific_interest or "High-resolution local topography and solar/communication visibility characterization.",
        primary_advantages=[
            f"Ground elevation {elev_m:.0f} m relative to lunar reference datum",
            f"Surface slope {slope_deg:.1f}° evaluated via LOLA altimetry",
            f"Observer mast height configured at {request.observer_height_m or 2.0} m"
        ],
        primary_challenges=[
            "Requires site-specific hazard verification against LROC NAC imagery"
        ],
        target_mission_class=["Custom Lander / Rover Architecture"],
        is_custom=True,
        observer_height_m=request.observer_height_m or 2.0
    )

    register_custom_site(custom_site)
    return custom_site


@router.get("/sites/{site_id}", response_model=SiteSchema, tags=["Landing Sites"])
def get_site(site_id: str):
    """
    Retrieve specific candidate site by unique identifier.
    """
    site = get_site_by_id(site_id)
    if not site:
        raise HTTPException(status_code=404, detail=f"Candidate site '{site_id}' not found.")
    return site
