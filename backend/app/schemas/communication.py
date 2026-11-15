"""
LUNA NAVIGATOR — Earth Communication Schemas (Tasks 4 & 5)
"""

from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from app.schemas.common import CoordinatesRequest, DateRangeRequest


class CommunicationRequest(CoordinatesRequest, DateRangeRequest):
    min_comm_elevation_deg: float = Field(
        default=0.5,
        ge=-5.0,
        le=15.0,
        description="Minimum elevation angle above local horizon for viable DTE radio link"
    )
    use_terrain_horizon: bool = Field(
        default=True,
        description="Whether to evaluate terrain masking using LOLA elevation models"
    )
    antenna_height_m: float = Field(
        default=2.5,
        ge=0.0,
        le=50.0,
        description="Antenna phase center height above ground (meters)"
    )
    antenna_max_elevation_deg: float = Field(
        default=85.0,
        ge=10.0,
        le=90.0,
        description="Upper gimbal / mechanical elevation pointing limit (degrees)"
    )
    antenna_min_elevation_deg: float = Field(
        default=0.5,
        ge=-5.0,
        le=20.0,
        description="Lower mechanical gimbal elevation pointing cutoff (degrees)"
    )
    use_live_horizons: bool = Field(
        default=False,
        description="Whether to query live NASA JPL Horizons Web API (requires external network)"
    )

    # Optional RF Link Budget Parameters (Task 5)
    enable_link_budget: bool = Field(
        default=False,
        description="Whether to compute physical RF link margin (FSPL, EIRP, received power)"
    )
    tx_power_w: float = Field(
        default=10.0,
        gt=0.0,
        le=500.0,
        description="Lander transmitter RF output power in Watts (e.g. 10W S-band transmitter)"
    )
    tx_antenna_gain_dbi: float = Field(
        default=14.0,
        ge=0.0,
        le=50.0,
        description="Lander directional antenna gain in dBi"
    )
    carrier_frequency_ghz: float = Field(
        default=2.2,
        gt=0.1,
        le=40.0,
        description="RF carrier frequency in GHz (e.g. 2.2 GHz S-band or 8.4 GHz X-band)"
    )
    rx_antenna_gain_dbi: float = Field(
        default=56.0,
        ge=10.0,
        le=80.0,
        description="Earth ground station receiver antenna gain in dBi (e.g. NASA DSN 34m beam)"
    )
    system_losses_db: float = Field(
        default=3.0,
        ge=0.0,
        le=20.0,
        description="Combined system losses: polarization, pointing error, line loss in dB"
    )
    rx_sensitivity_dbm: float = Field(
        default=-120.0,
        le=-50.0,
        ge=-170.0,
        description="Ground station receiver sensitivity threshold in dBm"
    )
    required_margin_db: float = Field(
        default=3.0,
        ge=0.0,
        le=20.0,
        description="Required mission engineering link margin in dB"
    )


class CommunicationWindow(BaseModel):
    window_index: int
    start_time: datetime
    end_time: datetime
    duration_hours: float
    max_elevation_deg: float
    avg_link_margin_db: Optional[float] = None


class CommunicationPoint(BaseModel):
    timestamp: datetime
    earth_azimuth_deg: float
    earth_elevation_deg: float
    earth_distance_km: float = 384400.0
    terrain_horizon_elevation_deg: float
    terrain_clearance_deg: float = 0.0
    is_earth_visible: bool
    is_antenna_in_limits: bool = True
    link_status: str  # "DIRECT_LINE_OF_SIGHT", "TERRAIN_BLOCKED", "BELOW_MIN_ELEVATION", "POINTING_LIMIT_EXCEEDED", "INSUFFICIENT_MARGIN"
    earth_apparent_diameter_deg: float

    # Link Budget Results
    free_space_path_loss_db: Optional[float] = None
    received_power_dbm: Optional[float] = None
    link_margin_db: Optional[float] = None
    is_link_feasible: bool = True


class CommunicationResponse(BaseModel):
    latitude: float
    longitude: float
    start_date: datetime
    duration_days: float
    step_hours: float

    # Geometric & Horizon Metrics
    communication_availability_percentage: float
    total_visible_hours: float
    total_blocked_hours: float
    longest_continuous_comm_window_hours: float
    longest_continuous_blackout_hours: float
    num_communication_windows: int = 0
    communication_windows: List[CommunicationWindow] = Field(default_factory=list)
    next_window_start: Optional[datetime] = None
    next_window_duration_hours: Optional[float] = None

    # Link Feasibility (Task 5)
    rf_link_feasible_percentage: float = 0.0
    total_rf_feasible_hours: float = 0.0
    link_budget_enabled: bool = False
    average_link_margin_db: Optional[float] = None
    blackout_warning: Optional[str] = None
    link_budget_summary: Optional[Dict[str, Any]] = None

    # Provenance
    data_source: str = Field(
        default="ANALYTICAL FALLBACK DATA",
        description="Ephemeris data source: LIVE NASA HORIZONS DATA, CACHED NASA HORIZONS DATA, or ANALYTICAL FALLBACK DATA"
    )
    data_source_type: str = Field(
        default="ANALYTICAL_FALLBACK",
        description="Type category: LIVE_NASA_HORIZONS, CACHED_NASA_HORIZONS, or ANALYTICAL_FALLBACK"
    )
    terrain_data_source: str = Field(
        default="NASA LOLA RASTER DEM (1200m/px)",
        description="Topographic elevation source provenance"
    )
    dem_resolution_m: float = Field(
        default=1200.0,
        description="LOLA DEM spatial resolution in meters per pixel"
    )
    data_quality_warning: Optional[str] = Field(
        default=None,
        description="Warning notice if external or raster datasets were degraded or fell back"
    )
    time_series: List[CommunicationPoint]
