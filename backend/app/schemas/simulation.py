"""
LUNA NAVIGATOR — Mission Energy Simulation Schemas (Member 4 Ownership)
"""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field
from app.schemas.common import DateRangeRequest


class SimulationRequest(DateRangeRequest):
    site_id: Optional[str] = Field(default=None, description="Target candidate landing site ID (if catalog site)")
    latitude: Optional[float] = Field(default=None, ge=-90.0, le=90.0, description="Selenographic latitude (if custom site)")
    longitude: Optional[float] = Field(default=None, ge=-180.0, le=360.0, description="Selenographic longitude (if custom site)")
    elevation_m: Optional[float] = Field(default=None, description="Surface elevation in meters (if custom site)")
    solar_array_area_m2: float = Field(default=4.0, gt=0.1, le=100.0, description="Effective solar array area (m²)")
    solar_efficiency: float = Field(default=0.30, gt=0.05, le=0.50, description="Solar cell conversion efficiency (e.g. 0.30 for 30% triple-junction GaAs)")
    solar_tracking_type: str = Field(
        default="VERTICAL_AZIMUTH_TRACKING",
        description="Tracking mode: 'VERTICAL_AZIMUTH_TRACKING', 'DUAL_AXIS_TRACKING', 'FIXED_VERTICAL', 'HORIZONTAL_FLAT', 'TILTED_FIXED', 'TILTED_OPTIMAL'"
    )
    panel_tilt_deg: Optional[float] = Field(default=90.0, ge=0.0, le=90.0, description="Panel surface tilt angle from horizontal (0°=flat horizontal, 90°=vertical)")
    panel_azimuth_deg: Optional[float] = Field(default=0.0, ge=0.0, le=360.0, description="Fixed panel pointing azimuth (degrees clockwise from North, e.g. 0°=North, 180°=South)")
    dust_degradation_factor: float = Field(default=0.98, ge=0.70, le=1.0, description="Photovoltaic regolith dust/soiling factor (0.98 = 2% dust accumulation loss)")
    wiring_loss_factor: float = Field(default=0.97, ge=0.70, le=1.0, description="Cable harness resistance & MPPT conversion efficiency (0.97 = 3% electrical losses)")
    
    battery_capacity_wh: float = Field(default=5000.0, gt=100.0, description="Total battery storage capacity (Watt-hours)")
    initial_battery_soc_percent: float = Field(default=100.0, ge=10.0, le=100.0, description="Initial State of Charge (%)")
    min_safe_soc_percent: float = Field(default=20.0, ge=5.0, le=50.0, description="Depth-of-Discharge cutoff limit (%)")
    charging_efficiency: float = Field(default=0.94, ge=0.70, le=1.0, description="Battery charging Coulombic efficiency")
    discharging_efficiency: float = Field(default=0.95, ge=0.70, le=1.0, description="Battery discharging / DC-DC power converter efficiency")
    max_charge_power_w: Optional[float] = Field(default=None, description="Maximum allowable battery charge intake power in Watts (C-rate intake limit)")
    max_discharge_power_w: Optional[float] = Field(default=None, description="Maximum allowable battery discharge power in Watts (C-rate delivery limit)")
    
    base_hotel_load_w: float = Field(default=150.0, ge=10.0, description="Continuous avionics & bus power consumption (Watts)")
    payload_active_load_w: float = Field(default=100.0, ge=0.0, description="Daytime scientific instrumentation power (Watts)")
    survival_heater_load_w: float = Field(default=80.0, ge=0.0, description="Nighttime / shadow thermal survival heater power (Watts)")
    use_live_horizons: bool = Field(default=False, description="Whether to query live NASA JPL Horizons")


class PowerPoint(BaseModel):
    timestamp: datetime
    sun_elevation_deg: float
    is_sunlit: bool
    solar_incidence_angle_deg: float = Field(default=0.0, description="Angle between incoming solar vector and panel surface normal (°)")
    solar_generation_w: float
    total_load_w: float
    net_power_w: float
    battery_soc_percent: float
    battery_stored_wh: float
    curtailed_power_w: float = Field(default=0.0, description="Solar surplus power curtailed due to full battery or C-rate limit (Watts)")
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
    max_continuous_darkness_hours: float = Field(default=0.0, description="Longest consecutive hours in topographic shadow")
    battery_survival_margin_percent: float = Field(default=0.0, description="Safety margin above minimum DoD limit (%)")
    estimated_survival_duration_hours: float = Field(default=0.0, description="Hours until battery breaches safe cutoff (or mission duration if safe)")
    hours_below_safe_soc: float = Field(default=0.0, description="Total hours spent operating below safe DoD limit")
    power_shortage_warnings: List[str] = Field(default_factory=list, description="Active engineering power warnings & shortage notices")
    battery_temperature_limitation: str = Field(
        default=(
            "BATTERY TEMPERATURE MODEL LIMITATION: Electrochemical cell impedance and capacity derating at cryogenic "
            "polar temperatures (< 250 K) are not modeled. Cells are assumed to be housed inside an insulated avionics "
            "enclosure maintained at nominal operating temperatures (0°C to +20°C) by the survival heater system."
        ),
        description="Explicit notice regarding electrochemical temperature boundaries"
    )
    eps_health_status: str = Field(default="NOMINAL", description="'NOMINAL' | 'DEGRADED_MARGIN' | 'CRITICAL_DEPLETION'")
    ephemeris_source: str = Field(default="ANALYTICAL FALLBACK DATA", description="Ephemeris source: LIVE, CACHED, or ANALYTICAL")
    terrain_source: str = Field(default="REAL NASA LOLA DEM", description="LOLA DEM source")
    dem_resolution_m: Optional[float] = Field(default=1200.0, description="DEM resolution in meters/pixel")
    calculation_status: str = Field(default="NOMINAL", description="'NOMINAL' | 'FALLBACK_APPLIED'")
    data_quality_warning: Optional[str] = Field(default=None, description="Data transparency notice")
    time_series: List[PowerPoint]
    scientific_disclaimer: str = Field(
        default=(
            "EPS SIMULATION NOTICE: Electrical power model calculates energy balance from topocentric solar flux, "
            "vector dot product incidence angles, cell efficiency, and LOLA terrain shadow ray-tracing. Actual flight "
            "performance requires empirical cell calibration, thermal network modeling, and regolith accumulation qualification."
        ),
        description="Engineering simulation boundary disclaimer"
    )
