"""
LUNA NAVIGATOR — Site Recommendation & MCDA Schemas (Member 4 Ownership)
"""

from datetime import datetime
from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field
from app.schemas.common import DateRangeRequest


class WeightsConfig(BaseModel):
    solar_illumination: float = Field(default=0.35, ge=0.0, le=1.0, description="Solar illumination weighting factor")
    earth_communication: float = Field(default=0.30, ge=0.0, le=1.0, description="Earth DTE communication weighting factor")
    slope_safety: float = Field(default=0.20, ge=0.0, le=1.0, description="Topographic slope safety weighting factor")
    elevation_advantage: float = Field(default=0.15, ge=0.0, le=1.0, description="Elevation vantage weighting factor")


class ConstraintsConfig(BaseModel):
    min_illumination_percentage: float = Field(default=50.0, ge=0.0, le=100.0, description="Minimum allowable cumulative illumination %")
    min_communication_percentage: float = Field(default=40.0, ge=0.0, le=100.0, description="Minimum allowable Direct-to-Earth comm %")
    max_acceptable_slope_degrees: float = Field(default=12.0, ge=1.0, le=45.0, description="Maximum allowable landing gear slope (°)")
    max_continuous_shadow_hours: float = Field(default=72.0, ge=0.0, le=700.0, description="Maximum continuous shadow duration before battery depletion (h)")


class RecommendRequest(DateRangeRequest):
    weights: WeightsConfig = Field(default_factory=WeightsConfig)
    constraints: ConstraintsConfig = Field(default_factory=ConstraintsConfig)
    site_ids: Optional[List[str]] = Field(default=None, description="Optional subset of sites to evaluate")


class RankedSite(BaseModel):
    rank: int
    site_id: str
    name: str
    total_score: float = Field(..., ge=0.0, le=100.0)
    is_compliant: bool
    scores_breakdown: Dict[str, float]
    raw_metrics: Dict[str, float]
    explanation: str
    key_strengths: List[str] = Field(default_factory=list, description="Primary positive engineering attributes")
    key_risks: List[str] = Field(default_factory=list, description="Key operational hazards and trade-offs")
    risk_level: str = Field(default="LOW_RISK", description="'LOW_RISK', 'MODERATE_RISK', 'HIGH_RISK'")
    safety_disclaimer: str = Field(
        default="Decision-support heuristic based on orbital/DEM models. Not a NASA landing qualification certification.",
        description="Explicit notice regarding certification boundaries"
    )


class DisqualifiedSite(BaseModel):
    site_id: str
    name: str
    violations: List[str]


class RecommendResponse(BaseModel):
    start_date: datetime
    duration_days: float
    weights_applied: WeightsConfig
    ranking: List[RankedSite]
    disqualified_sites: List[DisqualifiedSite]
    scientific_disclaimer: str = Field(
        default=(
            "SCIENTIFIC NOTICE: This ranking is an algorithmic Multi-Criteria Decision Analysis (MCDA) heuristic "
            "based on orbital ephemerides (JPL DE440) and gridded LOLA topographic models. A high score reflects "
            "mathematical alignment with user criteria weights and DOES NOT constitute NASA certification of landing "
            "safety. Operational flight safety requires sub-meter obstacle detection, hazard avoidance, regolith "
            "geotechnical bearing capacity assessment, landing gear touchdown dynamics, and terminal descent propellant margins."
        ),
        description="Mandatory scientific disclaimer on certification limits"
    )
