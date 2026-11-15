"""
LUNA NAVIGATOR — Site Comparison Schemas
"""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field
from app.schemas.common import DateRangeRequest


# ============================================================================
# LEGACY COMPARISON SCHEMAS (Maintained for Backward Compatibility)
# ============================================================================

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
# ADVANCED MULTI-SCENARIO COMPARISON SCHEMAS
# ============================================================================

class ScenarioConfig(BaseModel):
    """
    Independent mission scenario parameters.
    Each scenario retains its own site, coordinates, epoch, timing, and EPS setup.
    """
    id: str = Field(..., description="Unique scenario identifier (e.g. 'scenario-1')")
    name: str = Field(..., description="Scenario display title")
    site_id: Optional[str] = Field(default=None, description="Catalog site identifier (if catalog site)")
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Selenographic latitude in degrees")
    longitude: float = Field(..., ge=-180.0, le=360.0, description="Selenographic longitude in degrees")
    elevation_m: Optional[float] = Field(default=None, description="Surface elevation in meters")
    observer_height_m: float = Field(default=2.0, ge=0.0, le=100.0, description="Observer/lander mast height in meters")
    
    # Mission Epoch & Timing
    start_date: datetime = Field(..., description="Landing epoch ISO 8601 UTC")
    duration_days: float = Field(default=14.0, gt=0.0, le=90.0, description="Mission duration in Earth days")
    step_hours: float = Field(default=2.0, ge=0.25, le=24.0, description="Calculation step size in hours")
    
    # Power Configuration
    solar_array_area_m2: float = Field(default=4.5, gt=0.1, le=100.0)
    solar_efficiency: float = Field(default=0.30, gt=0.05, le=0.50)
    solar_tracking_type: str = Field(default="VERTICAL_AZIMUTH_TRACKING")
    base_hotel_load_w: float = Field(default=120.0, ge=0.0)
    payload_active_load_w: float = Field(default=80.0, ge=0.0)
    survival_heater_load_w: float = Field(default=150.0, ge=0.0)
    
    # Battery Configuration
    battery_capacity_wh: float = Field(default=5000.0, gt=100.0)
    initial_battery_soc_percent: float = Field(default=100.0, ge=0.0, le=100.0)
    min_safe_soc_percent: float = Field(default=20.0, ge=0.0, le=100.0)
    
    use_live_horizons: bool = Field(default=False)


class CompactTimelinePoint(BaseModel):
    timestamp: datetime
    hours_from_start: float
    is_sunlit: bool
    sun_elevation_deg: float
    is_earth_visible: bool
    earth_elevation_deg: float
    battery_soc_percent: float
    solar_generation_w: float
    net_power_w: float


class ScenarioMetrics(BaseModel):
    """
    Evaluated scientific metrics for a single scenario across illumination, communication, and EPS.
    """
    id: str
    name: str
    site_id: Optional[str] = None
    latitude: float
    longitude: float
    elevation_m: float
    slope_degrees: float
    observer_height_m: float
    start_date: datetime
    duration_days: float
    step_hours: float
    solar_array_area_m2: float
    battery_capacity_wh: float

    # TASK 4 Metrics
    mean_sun_elevation_deg: float
    max_sun_elevation_deg: float
    total_sunlit_hours: float
    total_darkness_hours: float
    longest_sunlight_hours: float
    longest_darkness_hours: float
    illumination_percentage: float

    earth_visibility_hours: float
    communication_percentage: float
    longest_comm_blackout_hours: float
    longest_comm_window_hours: float
    comm_windows_count: int

    min_battery_soc_percent: float
    max_battery_soc_percent: float
    total_energy_generated_kwh: float
    total_energy_consumed_kwh: float
    net_energy_balance_kwh: float
    power_survival_status: str  # NOMINAL, SURVIVED_WITH_MARGIN, DEGRADED_MARGIN, BATTERY_DEPLETED
    battery_depleted: bool

    overall_suitability_score: float
    rank: int = 1

    strengths: List[str] = Field(default_factory=list)
    risks: List[str] = Field(default_factory=list)
    timeline: List[CompactTimelinePoint] = Field(default_factory=list)

    ephemeris_source: str = "ANALYTICAL FALLBACK DATA"
    terrain_source: str = "REAL NASA LOLA DEM"
    dem_resolution_m: Optional[float] = 1200.0
    calculation_status: str = "NOMINAL"


class ScenarioComparisonSummary(BaseModel):
    best_overall_scenario_id: str
    best_illumination_scenario_id: str
    best_communication_scenario_id: str
    best_power_scenario_id: str
    mode_description: str
    key_findings: List[str]


class MultiScenarioCompareRequest(BaseModel):
    mode: str = Field(
        default="DIFFERENT_SITES_SAME_DATE",
        description="'DIFFERENT_SITES_SAME_DATE' | 'SAME_SITE_DIFFERENT_DATES' | 'DIFFERENT_SITES_AND_DATES'"
    )
    scenarios: List[ScenarioConfig] = Field(
        ...,
        min_length=2,
        max_length=8,
        description="2 to 8 independent mission scenarios to evaluate simultaneously"
    )


class MultiScenarioCompareResponse(BaseModel):
    mode: str
    total_scenarios: int
    scenarios: List[ScenarioMetrics]
    summary: ScenarioComparisonSummary
    evaluated_at: datetime
