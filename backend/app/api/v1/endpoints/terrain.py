"""
Terrain Horizon Endpoints (Member 3 Ownership)
"""
from fastapi import APIRouter, HTTPException
from app.engines.terrain.horizon import terrain_engine
from app.engines.terrain.sky_horizon_engine import sky_horizon_engine
from app.schemas.terrain import TerrainHorizonRequest, TerrainHorizonResponse
from app.schemas.sky_horizon import SkyHorizonRequest, SkyHorizonResponse

router = APIRouter()


@router.post("/terrain/horizon", response_model=TerrainHorizonResponse, tags=["Geospatial & Terrain"])
def compute_terrain_horizon(request: TerrainHorizonRequest):
    """
    Calculate 360-degree local terrain horizon elevation profile and ray-tracing obstruction masks
    from NASA LOLA elevation models with lunar curvature correction.
    """
    try:
        return terrain_engine.generate_horizon_profile(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Terrain horizon processing failed: {str(e)}")


@router.post("/terrain/sky-horizon", response_model=SkyHorizonResponse, tags=["Geospatial & Terrain"])
def compute_sky_horizon(request: SkyHorizonRequest):
    """
    Compute synchronized local 360° sky horizon combining local LOLA terrain relief
    with topocentric Sun and Earth JPL Horizons ephemerides over the mission timeline.
    """
    try:
        return sky_horizon_engine.evaluate_sky_horizon(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sky horizon evaluation failed: {str(e)}")

