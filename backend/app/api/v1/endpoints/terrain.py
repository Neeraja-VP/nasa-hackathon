"""
Terrain Horizon Endpoints (Member 3 Ownership)
"""
from fastapi import APIRouter, HTTPException
from app.engines.terrain.horizon import terrain_engine
from app.schemas.terrain import TerrainHorizonRequest, TerrainHorizonResponse

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


@router.get("/terrain/metadata", tags=["Geospatial & Terrain"])
def get_terrain_metadata():
    """
    Get active LOLA DEM metadata, spatial resolution, datum, and provenance.
    """
    try:
        return terrain_engine.dem_loader.get_dem_metadata()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve terrain metadata: {str(e)}")
