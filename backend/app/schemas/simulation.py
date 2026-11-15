"""
LUNA NAVIGATOR — Mission Energy Simulation Schemas (Member 4 Ownership)
"""

from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from app.schemas.common import DateRangeRequest


class SimulationRequest(DateRangeRequest):
    site_id: str = Field(default="custom", description="Target candidate landing site ID or 'custom'")
    latitude: Optional[float] = Field(default=None, ge=-90.0, le=90.0, description="Optional custom latitude in degrees")
    longitude: Optional[float] = Field(default=None, ge=-180.0, le=360.0, description="Optional custom longitude in degrees")
    elevation_m: Optional[float] = Field(default=None, description="Optional custom elevation in meters")
    mast_height_m: float = Field(default=2.0, ge=0.0, le=50.0, description="Instrument or solar tower mast height in meters")

    # Solar Array Architecture
    solar_array_area_m2: float = Field(default=4.0, gt=0.1, le=100.0, description="Effective solar array area (m²)")
    solar_efficiency: float = Field(default=0.30, gt=0.05, le=0.50, description="Solar cell conversion efficiency (e.g. 0.30 for 30% triple-junction GaAs)")
    solar_tracking_type: str = Field(
        default="VERTICAL_AZIMUTH_TRACKING",
        description="Tracking mode: 'VERTICAL_AZIMUTH_TRACKING', 'FIXED_VERTICAL', 'HORIZONTAL_FLAT', 'TILTED_OPTIMAL', 'CUSTOM_ORIENTED'"
    )
    panel_tilt_deg: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=90.0,
        description="Panel tilt from horizontal: 0° flat horizontal, 90° vertical mast"
    )
    panel_azimuth_deg: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=360.0,
        description="Panel normal azimuth heading: 0° North, 90° East, 180° South, 270° West"
    )
    dust_degradation_factor: float = Field(
        default=0.95,
        ge=0.5,
        le=1.0,
        description="Lunar regolith dust accumulation derating factor (default 0.95 = 5% dust obscuration loss)"
    )
    temperature_derate_factor: float = Field(
        default=0.92,
        ge=0.5,
        le=1.0,
        description="Operational cell temperature derating factor (default 0.92 = 8% thermal loss)"
    )

    # Battery Storage Architecture
    battery_capacity_wh: float = Field(default=5000.0, gt=100.0, description="Total battery storage capacity (Watt-hours)")
    initial_battery_soc_percent: float = Field(default=100.0, ge=10.0, le=100.0, description="Initial State of Charge (%)")
    min_safe_soc_percent: float = Field(default=20.0, ge=5.0, le=50.0, description="Depth-of-Discharge cutoff limit (%)")
    charging_efficiency: float = Field(
        default=0.95,
        ge=0.70,
        le=1.0,
        description="Battery charging / coulombic efficiency factor"
    )
    discharging_efficiency: float = Field(
        default=0.95,
        ge=0.70,
        le=1.0,
        description="Battery discharge path conversion efficiency factor"
    )
    max_charge_c_rate: float = Field(
        default=0.5,
        ge=0.1,
        le=3.0,
        description="Maximum allowable battery charging C-rate (e.g. 0.5C)"
    )
    max_discharge_c_rate: float = Field(
        default=1.0,
        ge=0.2,
        le=5.0,
        description="Maximum allowable battery discharge C-rate (e.g. 1.0C)"
    )

    # Power Consumer Loads
    base_hotel_load_w: float = Field(default=150.0, ge=10.0, description="Continuous avionics & bus power consumption (Watts)")
    payload_active_load_w: float = Field(default=100.0, ge=0.0, description="Daytime scientific instrumentation power (Watts)")
    survival_heater_load_w: float = Field(default=80.0, ge=0.0, description="Nighttime / shadow thermal survival heater power (Watts)")


class PowerPoint(BaseModel):
    timestamp: datetime
    sun_elevation_deg: float
    sun_azimuth_deg: float
    solar_incidence_angle_deg: float
    cos_incidence: float
    is_sunlit: bool
    solar_generation_w: float
    total_load_w: float
    net_power_w: float
    battery_charge_w: float
    battery_discharge_w: float
    battery_soc_percent: float
    battery_stored_wh: float
    is_deficit: bool
    is_below_safe_soc: bool


class SimulationResponse(BaseModel):
    site_id: str
    mission_duration_hours: float
    min_battery_soc_percent: float
    max_battery_soc_percent: float
    current_battery_soc_percent: float
    battery_depleted: bool
    is_below_safe_soc: bool
    total_energy_generated_kwh: float
    total_energy_consumed_kwh: float
    net_energy_balance_kwh: float
    peak_solar_generation_w: float = Field(default=0.0, description="Maximum instantaneous solar generation in Watts")
    average_solar_generation_w: float = Field(default=0.0, description="Mission-average solar generation in Watts")
    max_continuous_discharge_hours: float = Field(default=0.0, description="Longest consecutive hours under battery discharge")
    max_continuous_darkness_hours: float = Field(default=0.0, description="Longest consecutive hours in darkness")
    estimated_survival_duration_hours: Optional[float] = Field(default=None, description="Hours until battery reaches 0% SoC, or None if survived")
    battery_survival_margin_percent: float = Field(default=0.0, description="Safety margin above minimum DoD limit (%)")
    eps_health_status: str = Field(default="NOMINAL", description="'NOMINAL' | 'DEGRADED_MARGIN' | 'CRITICAL_DEPLETION'")
    shortage_warning: Optional[str] = Field(default=None, description="Active power deficit or depletion warning message")
    model_assumptions: Dict[str, Any] = Field(default_factory=dict, description="Documented engineering physics assumptions and limits")
    scientific_disclaimer: str = Field(
        default=(
            "EPS ENGINEERING NOTICE: Physical generation model accounts for 3D solar incidence angle, terrain occultation, "
            "dust obscuration derating (5%), thermal efficiency derate (8%), and C-rate charge/discharge limits. "
            "Battery thermal chemistry assumes an insulated bus (isothermal cell model); cryogenic battery performance "
            "without radioisotope heating units requires empirical vacuum-thermal chamber flight qualification."
        ),
        description="Engineering simulation boundary disclaimer"
    )
    time_series: List[PowerPoint]
