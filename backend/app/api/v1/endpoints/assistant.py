"""
LUNA NAVIGATOR — AI Mission Assistant Endpoints (Member 4 Ownership)
"""

from fastapi import APIRouter, HTTPException
from app.engines.assistant.engine import assistant_engine
from app.schemas.assistant import AssistantQueryRequest, AssistantQueryResponse

router = APIRouter()


@router.post("/assistant", response_model=AssistantQueryResponse, tags=["AI Decision Support"])
def query_mission_assistant(request: AssistantQueryRequest):
    """
    Intelligent AI Mission Assistant grounded in verified NASA JPL Horizons ephemerides,
    LOLA DEM ray-tracing, MCDA rankings, and EPS power simulations.
    Provides explainable engineering assessments and explicit safety boundaries.
    """
    try:
        return assistant_engine.process_query(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI mission assistant query processing failed: {str(e)}")
