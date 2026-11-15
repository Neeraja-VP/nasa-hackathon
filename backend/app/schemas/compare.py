"""
LUNA NAVIGATOR — Site Comparison Schemas
"""

from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from app.schemas.common import DateRangeRequest


class CompareRequest(DateRangeRequest):
    site_ids: List[str] = Field(
        ...,
        min_length=2,
        max_length=10,
        description="List of candidate site IDs to compare"
    )


class SiteComparisonMetrics(BaseModel):
    site_id: str
    name: str
    latitude: float
    longitude: float
    elevation_m: float
    slope_degrees: float
    illumination_percentage: float
    max_shadow_hours: float
    communication_percentage: float
    max_comm_blackout_hours: float
    overall_suitability_score: float


class CompareResponse(BaseModel):
    start_date: datetime
    duration_days: float
    sites_evaluated: List[SiteComparisonMetrics]


# ============================================================================
# ADVANCED MULTI-SCENARIO COMPARISON SCHEMAS (Tasks 1 - 6)
# ============================================================================

class ScenarioInput(BaseModel):
    id: str = Field(..., description="Unique scenario identifier (e.g. 'scenario-1')")
    name: str = Field(..., description="User-assigned scenario title")
    site_id: Optional[str] = Field(default=None, description="Catalog site ID or None if custom")
    site_name: Optional[str] = Field(default=None, description="Display name of landing site")
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Selenographic latitude [-90 to +90]")
    longitude: float = Field(..., ge=-180.0, le=360.0, description="Selenographic longitude [-180 to 360]")
    elevation_m: Optional[float] = Field(default=None, description="Elevation in meters (auto-sampled from LOLA DEM if None)")
    mast_height_m: float = Field(default=2.0, ge=0.0, le=50.0, description="Observer / mast height in meters")
    start_date: datetime = Field(..., description="Mission landing date and time (UTC)")
    duration_days: float = Field(default=14.0, gt=0.1, le=60.0, description="Mission surface duration in days")
    step_hours: float = Field(default=2.0, ge=0.5, le=24.0, description="Calculation epoch step in hours")
    # Power & EPS parameters
    solar_array_area_m2: float = Field(default=4.0, gt=0.1, le=100.0, description="Solar array aperture area (m²)")
    solar_efficiency: float = Field(default=0.30, gt=0.05, le=0.50, description="Solar conversion efficiency")
    solar_tracking_type: str = Field(default="VERTICAL_AZIMUTH_TRACKING", description="Tracking mode")
    battery_capacity_wh: float = Field(default=5000.0, gt=100.0, description="Battery capacity in Watt-hours")
    initial_battery_soc_percent: float = Field(default=100.0, ge=10.0, le=100.0, description="Initial State of Charge (%)")
    min_safe_soc_percent: float = Field(default=20.0, ge=5.0, le=50.0, description="Depth-of-Discharge cutoff limit (%)")
    base_hotel_load_w: float = Field(default=150.0, ge=10.0, description="Continuous base bus load (Watts)")
    payload_active_load_w: float = Field(default=100.0, ge=0.0, description="Daytime scientific payload load (Watts)")
    survival_heater_load_w: float = Field(default=80.0, ge=0.0, description="Nighttime survival heater load (Watts)")


class ScenarioTimelinePoint(BaseModel):
    timestamp: datetime
    is_sunlit: bool
    sun_elevation_deg: float
    is_earth_visible: bool
    earth_elevation_deg: float
    battery_soc_percent: float
    net_power_w: float


class ScenarioResult(BaseModel):
    scenario_id: str
    name: str
    site_name: str
    latitude: float
    longitude: float
    elevation_m: float
    slope_degrees: float
    start_date: datetime
    duration_days: float
    step_hours: float
    
    # Required 12 Comparison Metrics:
    max_solar_elevation_deg: float
    min_solar_elevation_deg: float
    total_sunlight_hours: float
    total_darkness_hours: float
    illumination_percentage: float
    longest_continuous_sunlight_hours: float
    longest_continuous_darkness_hours: float
    earth_visibility_hours: float
    communication_percentage: float
    longest_comm_blackout_hours: float
    num_comm_windows: int
    min_battery_soc_percent: float
    total_energy_generated_kwh: float
    total_energy_consumed_kwh: float
    net_energy_balance_kwh: float
    battery_depleted: bool
    power_survival_status: str  # "SURVIVED" | "BATTERY_DEPLETED"
    eps_health_status: str      # "NOMINAL" | "DEGRADED_MARGIN" | "CRITICAL_DEPLETION"
    overall_suitability_score: float
    rank: int = 0
    
    timeline: List[ScenarioTimelinePoint] = []


class MultiScenarioCompareRequest(BaseModel):
    mode: str = Field(
        default="CUSTOM",
        description="Comparison mode: 'SITES_SAME_DATE', 'SAME_SITE_DATES', or 'CUSTOM'"
    )
    scenarios: List[ScenarioInput] = Field(
        ...,
        min_length=2,
        max_length=10,
        description="List of independent scenarios to compare (each retaining own site, date, power & battery settings)"
    )


class MultiScenarioCompareResponse(BaseModel):
    mode: str
    comparison_timestamp: datetime
    total_scenarios: int
    scenarios: List[ScenarioResult]
    best_scenario_id: str
    metric_leaders: Dict[str, str] = Field(
        default_factory=dict,
        description="Maps metric key to the leading scenario ID"
    )
