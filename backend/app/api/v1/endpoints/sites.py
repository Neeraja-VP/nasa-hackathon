"""
Candidate Sites Endpoints
"""
from typing import List
from fastapi import APIRouter, HTTPException, status
from app.core.sites_catalog import load_candidate_sites, get_site_by_id
from app.services.geospatial.dem_loader import dem_loader
from app.schemas.sites import SiteSchema, CustomSiteCreateRequest

router = APIRouter()


@router.get("/sites", response_model=List[SiteSchema], tags=["Landing Sites"])
def list_sites():
    """
    Retrieve all characterized lunar south-pole landing candidate sites.
    """
    try:
        return load_candidate_sites()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sites/custom", response_model=SiteSchema, status_code=status.HTTP_200_OK, tags=["Landing Sites"])
def evaluate_custom_landing_site(request: CustomSiteCreateRequest):
    """
    Characterize custom landing coordinates: validates selenographic coordinate ranges,
    queries the NASA LOLA digital elevation model for terrain elevation (datum R=1737.4 km)
    and central-difference surface slope angle.
    """
    try:
        lat = request.latitude
        lon = request.longitude % 360.0
        if lon < 0:
            lon += 360.0

        elev = request.elevation_m if request.elevation_m is not None else dem_loader.sample_elevation(lat, lon)
        slope = dem_loader.calculate_surface_slope_deg(lat, lon)

        site_id = f"custom-{abs(int(lat * 100))}-{abs(int(lon * 100))}"
        description = request.description or (
            f"Custom candidate landing site at {abs(lat):.2f}°{'S' if lat < 0 else 'N'}, {lon:.2f}°E. "
            f"LOLA DEM elevation is {elev:.0f} m with mean surface gradient of {slope:.1f}°."
        )

        return SiteSchema(
            id=site_id,
            name=request.name,
            region="Custom Exploration Zone",
            latitude=round(lat, 4),
            longitude=round(lon, 4),
            elevation_m=round(elev, 1),
            slope_degrees=round(slope, 1),
            description=description,
            scientific_interest="Custom user-defined landing target evaluated against NASA LOLA elevation models.",
            primary_advantages=["Custom mission target tailored for specific exploration architecture"],
            primary_challenges=["Requires dedicated hazard avoidance verification and terrain clearance modeling"],
            target_mission_class=["Artemis Lander", "Commercial CLPS", "VIPER / Polar Rover"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Custom site evaluation failed: {str(e)}")


@router.get("/sites/{site_id}", response_model=SiteSchema, tags=["Landing Sites"])
def get_site(site_id: str):
    """
    Retrieve specific candidate site by unique identifier.
    """
    site = get_site_by_id(site_id)
    if not site:
        raise HTTPException(status_code=404, detail=f"Candidate site '{site_id}' not found.")
    return site
