"""
Site Comparison Endpoints (Member 4 Ownership)
"""
from fastapi import APIRouter, HTTPException, status
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


@router.post(
    "/compare/scenarios",
    response_model=MultiScenarioCompareResponse,
    status_code=status.HTTP_200_OK,
    tags=["Decision Support"],
    summary="Advanced multi-scenario comparison (different sites, different dates, different power configurations)"
)
def compare_mission_scenarios(request: MultiScenarioCompareRequest):
    """
    Multi-scenario comparison allowing independent landing site coordinates, landing dates/times,
    mission durations, solar array configurations, and battery storage across multiple scenarios.
    Supports Mode A (different sites, same date), Mode B (same site, different dates),
    and Mode C (different sites and different dates).
    """
    try:
        return recommendation_engine.compare_scenarios(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scenario comparison failed: {str(e)}")
