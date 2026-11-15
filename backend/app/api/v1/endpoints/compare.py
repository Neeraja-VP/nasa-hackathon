"""
Site Comparison Endpoints (Member 4 Ownership)
"""
from fastapi import APIRouter, HTTPException
from app.engines.recommendation.engine import recommendation_engine
from app.schemas.compare import (
    CompareRequest,
    CompareResponse,
    MultiScenarioCompareRequest,
    MultiScenarioCompareResponse
)

router = APIRouter()


@router.post("/compare", response_model=CompareResponse, tags=["Decision Support"])
def compare_candidate_sites(request: CompareRequest):
    """
    Side-by-side comparison of multiple candidate landing sites across solar illumination,
    Earth communications, slope, and elevation metrics.
    """
    try:
        return recommendation_engine.compare_sites(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Site comparison failed: {str(e)}")


@router.post("/compare/scenarios", response_model=MultiScenarioCompareResponse, tags=["Decision Support"])
def compare_mission_scenarios(request: MultiScenarioCompareRequest):
    """
    Advanced multi-scenario trade-off evaluation comparing different landing sites,
    custom coordinates, landing epochs, durations, and electrical power system (EPS) configs.
    Supports Mode A (different sites, same date), Mode B (same site, different dates),
    and Mode C (matrix comparison).
    """
    try:
        return recommendation_engine.compare_scenarios(request)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Multi-scenario comparison failed: {str(e)}")
