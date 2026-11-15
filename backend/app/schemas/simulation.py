"""
LUNA NAVIGATOR — Mission Energy Simulation Schemas (Member 4 Ownership)
"""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field
from app.schemas.common import DateRangeRequest


class SimulationRequest(DateRangeRequest):
    site_id: str = Field(..., description="Target candidate landing site ID")
    solar_array_area_m2: float = Field(default=4.0, gt=0.1, le=100.0, description="Effective solar array area (m²)")
    solar_efficiency: float = Field(default=0.30, gt=0.05, le=0.50, description="Solar cell conversion efficiency (e.g. 0.30 for 30% triple-junction GaAs)")
    solar_tracking_type: str = Field(
        default="VERTICAL_AZIMUTH_TRACKING",
        description="Tracking mode: 'VERTICAL_AZIMUTH_TRACKING', 'FIXED_VERTICAL', 'HORIZONTAL_FLAT', 'TILTED_OPTIMAL'"
    )
    battery_capacity_wh: float = Field(default=5000.0, gt=100.0, description="Total battery storage capacity (Watt-hours)")
    initial_battery_soc_percent: float = Field(default=100.0, ge=10.0, le=100.0, description="Initial State of Charge (%)")
    min_safe_soc_percent: float = Field(default=20.0, ge=5.0, le=50.0, description="Depth-of-Discharge cutoff limit (%)")
    base_hotel_load_w: float = Field(default=150.0, ge=10.0, description="Continuous avionics & bus power consumption (Watts)")
    payload_active_load_w: float = Field(default=100.0, ge=0.0, description="Daytime scientific instrumentation power (Watts)")
    survival_heater_load_w: float = Field(default=80.0, ge=0.0, description="Nighttime / shadow thermal survival heater power (Watts)")


class PowerPoint(BaseModel):
    timestamp: datetime
    sun_elevation_deg: float
    is_sunlit: bool
    solar_generation_w: float
    total_load_w: float
    net_power_w: float
    battery_soc_percent: float
    battery_stored_wh: float
    is_deficit: bool


class SimulationResponse(BaseModel):
    site_id: str
    mission_duration_hours: float
    min_battery_soc_percent: float
    max_battery_soc_percent: float
    battery_depleted: bool
    total_energy_generated_kwh: float
    total_energy_consumed_kwh: float
    net_energy_balance_kwh: float
    peak_solar_generation_w: float = Field(default=0.0, description="Maximum instantaneous solar generation in Watts")
    average_solar_generation_w: float = Field(default=0.0, description="Mission-average solar generation in Watts")
    max_continuous_discharge_hours: float = Field(default=0.0, description="Longest consecutive hours under battery discharge")
    battery_survival_margin_percent: float = Field(default=0.0, description="Safety margin above minimum DoD limit (%)")
    eps_health_status: str = Field(default="NOMINAL", description="'NOMINAL' | 'DEGRADED_MARGIN' | 'CRITICAL_DEPLETION'")
    time_series: List[PowerPoint]
    scientific_disclaimer: str = Field(
        default=(
            "EPS SIMULATION NOTICE: Electrical power model calculates energy balance from topocentric solar flux and "
            "terrain shadow occultation. Battery aging, degradation from thermal cycling, regolith dust accumulation, "
            "and cable line losses require empirical flight system qualification."
        ),
        description="Engineering simulation boundary disclaimer"
    )
