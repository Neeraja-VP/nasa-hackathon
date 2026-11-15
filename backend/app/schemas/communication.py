"""
LUNA NAVIGATOR — Earth Communication Schemas
"""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field
from app.schemas.common import CoordinatesRequest, DateRangeRequest


class CommunicationRequest(CoordinatesRequest, DateRangeRequest):
    min_comm_elevation_deg: float = Field(
        default=0.5,
        ge=-5.0,
        le=15.0,
        description="Minimum elevation angle above local horizon for viable DTE radio link"
    )
    max_comm_elevation_deg: float = Field(
        default=90.0,
        ge=10.0,
        le=90.0,
        description="Maximum steerable antenna elevation angle (zenith pointing limit)"
    )
    antenna_azimuth_min_deg: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=360.0,
        description="Minimum antenna azimuth gimbal limit (°)"
    )
    antenna_azimuth_max_deg: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=360.0,
        description="Maximum antenna azimuth gimbal limit (°)"
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
    use_live_horizons: bool = Field(
        default=False,
        description="Whether to query live NASA JPL Horizons Web API (requires external network)"
    )
    
    # Optional RF link budget parameters
    enable_link_budget: bool = Field(
        default=True,
        description="Whether to perform physics-based link margin calculation"
    )
    tx_power_w: float = Field(
        default=10.0,
        gt=0.1,
        le=500.0,
        description="Transmitter RF power in Watts (10W = +10 dBW)"
    )
    tx_antenna_gain_dbi: float = Field(
        default=18.0,
        ge=0.0,
        le=45.0,
        description="Lander directional antenna gain in dBi (e.g. 18 dBi for 0.5m X-band dish)"
    )
    rx_antenna_gain_dbi: float = Field(
        default=68.0,
        ge=20.0,
        le=80.0,
        description="Ground station receiver antenna gain in dBi (68 dBi for DSN 34m aperture at X-band)"
    )
    carrier_frequency_ghz: float = Field(
        default=8.45,
        gt=0.1,
        le=40.0,
        description="Downlink frequency in GHz (8.45 GHz for Deep Space X-band)"
    )
    data_rate_kbps: float = Field(
        default=100.0,
        gt=1.0,
        le=50000.0,
        description="Required downlink data rate in kbps"
    )
    system_losses_db: float = Field(
        default=2.5,
        ge=0.0,
        le=10.0,
        description="Total cable, pointing, and atmospheric attenuation losses in dB"
    )
    required_eb_n0_db: float = Field(
        default=4.5,
        ge=1.0,
        le=15.0,
        description="Required Eb/N0 threshold for LDPC/Turbo coded link (dB)"
    )
    min_link_margin_db: float = Field(
        default=3.0,
        ge=0.0,
        le=12.0,
        description="Required engineering safety margin above Eb/N0 threshold (dB)"
    )


class CommunicationPoint(BaseModel):
    timestamp: datetime
    earth_azimuth_deg: float
    earth_elevation_deg: float
    terrain_horizon_elevation_deg: float
    is_earth_visible: bool
    is_geometrically_visible: bool = Field(default=True, description="True if Earth center is unobstructed by topography and elevation masks")
    link_status: str  # "DIRECT_LINE_OF_SIGHT", "TERRAIN_BLOCKED", "BELOW_MIN_ELEVATION", "OUTSIDE_ANTENNA_GIMBAL", "INSUFFICIENT_LINK_MARGIN"
    earth_apparent_diameter_deg: float
    link_margin_db: Optional[float] = Field(default=None, description="Calculated RF link margin in dB")
    is_link_feasible: bool = Field(default=True, description="True if geometrically visible AND link margin >= min_link_margin_db")


class CommWindow(BaseModel):
    window_id: int
    start_time: datetime
    end_time: datetime
    duration_hours: float
    mean_earth_elevation_deg: float
    mean_link_margin_db: Optional[float] = None


class LinkBudgetSummary(BaseModel):
    carrier_frequency_ghz: float
    transmitter_power_w: float
    tx_power_w: Optional[float] = Field(default=None, description="Transmitter power in Watts (alias)")
    tx_antenna_gain_dbi: float
    rx_antenna_gain_dbi: float
    free_space_path_loss_db: float
    eirp_dbw: float
    received_eb_n0_db: float
    required_eb_n0_db: float
    link_margin_db: float
    min_link_margin_db: Optional[float] = Field(default=None, description="Minimum link margin in dB (alias)")
    is_link_feasible: bool


class CommunicationResponse(BaseModel):
    latitude: float
    longitude: float
    start_date: datetime
    duration_days: float
    step_hours: float
    communication_availability_percentage: float
    total_visible_hours: float
    total_blocked_hours: float
    longest_continuous_comm_window_hours: float
    longest_continuous_blackout_hours: float
    num_comm_windows: int = Field(default=0, description="Total number of discrete communication windows")
    comm_windows: List[CommWindow] = Field(default_factory=list, description="Discrete communication window intervals")
    next_comm_window_start: Optional[datetime] = Field(default=None, description="Start timestamp of the next communication window")
    next_comm_window_hours_from_start: Optional[float] = Field(default=None, description="Hours from epoch to start of next comm window")
    link_budget_summary: Optional[LinkBudgetSummary] = Field(default=None, description="Engineering RF link budget accounting")
    ephemeris_source: str = Field(default="ANALYTICAL FALLBACK DATA", description="Ephemeris source: LIVE, CACHED, or ANALYTICAL")
    terrain_source: str = Field(default="REAL NASA LOLA DEM", description="LOLA DEM source")
    dem_resolution_m: Optional[float] = Field(default=1200.0, description="DEM resolution in meters/pixel")
    calculation_status: str = Field(default="NOMINAL", description="'NOMINAL' | 'FALLBACK_APPLIED'")
    data_quality_warning: Optional[str] = Field(default=None, description="Data transparency notice")
    time_series: List[CommunicationPoint]
