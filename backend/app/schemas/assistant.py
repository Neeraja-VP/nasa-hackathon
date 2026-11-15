"""
LUNA NAVIGATOR — AI Mission Assistant Schemas (Member 4 Ownership)
"""

from datetime import datetime, timezone
from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field
from app.schemas.recommend import WeightsConfig, ConstraintsConfig


class AssistantQueryRequest(BaseModel):
    query: str = Field(..., min_length=2, max_length=1000, description="Mission planner or operator inquiry")
    site_id: Optional[str] = Field(default=None, description="Optional focused candidate landing site ID")
    start_date: Optional[datetime] = Field(
        default_factory=lambda: datetime(2026, 12, 1, 0, 0, 0, tzinfo=timezone.utc),
        description="Mission start epoch (ISO 8601 UTC)"
    )
    duration_days: float = Field(default=14.0, gt=0.1, le=180.0, description="Mission duration in days")
    step_hours: float = Field(default=2.0, gt=0.1, le=24.0, description="Calculation step in hours")
    weights: Optional[WeightsConfig] = Field(default=None, description="Custom MCDA criteria weights")
    solar_array_area_m2: Optional[float] = Field(default=4.5, gt=0.1, le=100.0, description="Solar array area for power queries")
    battery_capacity_wh: Optional[float] = Field(default=5000.0, gt=100.0, description="Battery capacity for power queries")


class ScientificEvidence(BaseModel):
    data_sources: List[str] = Field(default_factory=list)
    site_id: Optional[str] = None
    site_name: Optional[str] = None
    coordinates: Optional[Dict[str, float]] = None
    illumination_percentage: Optional[float] = None
    communication_percentage: Optional[float] = None
    slope_degrees: Optional[float] = None
    elevation_m: Optional[float] = None
    max_continuous_shadow_hours: Optional[float] = None
    max_continuous_blackout_hours: Optional[float] = None
    suitability_score: Optional[float] = None


class RiskAssessment(BaseModel):
    risk_level: str = Field(default="LOW_RISK", description="'LOW_RISK' | 'MODERATE_RISK' | 'HIGH_RISK'")
    primary_risks: List[str] = Field(default_factory=list)
    recommended_mitigations: List[str] = Field(default_factory=list)


class AssistantQueryResponse(BaseModel):
    query: str
    intent: str
    focused_site_id: Optional[str] = None
    summary: str
    detailed_analysis: str
    scientific_evidence: ScientificEvidence
    risk_assessment: RiskAssessment
    safety_disclaimer: str
    suggested_followups: List[str]
