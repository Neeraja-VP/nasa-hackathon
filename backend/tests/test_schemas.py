"""
Unit Tests for Pydantic API Schemas & Validation
"""

from datetime import datetime, timezone
import pytest
from pydantic import ValidationError
from app.schemas.common import CoordinatesRequest, DateRangeRequest
from app.schemas.sites import SiteSchema
from app.schemas.recommend import WeightsConfig, ConstraintsConfig


def test_coordinates_request_valid():
    req = CoordinatesRequest(latitude=-89.5, longitude=120.0, elevation_m=500.0)
    assert req.latitude == -89.5
    assert req.longitude == 120.0
    assert req.elevation_m == 500.0


def test_coordinates_request_invalid_latitude():
    with pytest.raises(ValidationError):
        CoordinatesRequest(latitude=-95.0, longitude=0.0)
        
    with pytest.raises(ValidationError):
        CoordinatesRequest(latitude=92.0, longitude=0.0)


def test_date_range_validation():
    # Valid
    req = DateRangeRequest(
        start_date=datetime(2026, 12, 1, 0, 0, 0, tzinfo=timezone.utc),
        duration_days=10.0,
        step_hours=1.0
    )
    assert req.duration_days == 10.0

    # Invalid negative duration
    with pytest.raises(ValidationError):
        DateRangeRequest(
            start_date=datetime(2026, 12, 1, 0, 0, 0, tzinfo=timezone.utc),
            duration_days=-5.0
        )


def test_weights_config_bounds():
    weights = WeightsConfig(
        solar_illumination=0.4,
        earth_communication=0.3,
        slope_safety=0.2,
        elevation_advantage=0.1
    )
    assert weights.solar_illumination == 0.4


def test_provenance_schema_fields():
    """Verify data source transparency fields across ephemeris, terrain, illumination, and communication schemas."""
    from app.schemas.ephemeris import EphemerisResponse
    from app.schemas.terrain import TerrainHorizonResponse
    from app.schemas.illumination import IlluminationResponse
    from app.schemas.communication import CommunicationResponse

    # 1. EphemerisResponse defaults
    coords = CoordinatesRequest(latitude=-89.78, longitude=125.0, elevation_m=1240.0)
    now = datetime(2026, 12, 1, 0, 0, tzinfo=timezone.utc)
    eph = EphemerisResponse(
        site_coordinates=coords,
        start_date=now,
        duration_days=1.0,
        step_hours=1.0,
        total_steps=0,
        time_series=[]
    )
    assert eph.data_source == "ANALYTICAL FALLBACK DATA"
    assert eph.data_source_type == "ANALYTICAL_FALLBACK"
    assert eph.data_quality_warning is None

    # 2. TerrainHorizonResponse defaults
    terr = TerrainHorizonResponse(
        latitude=-89.78,
        longitude=125.0,
        elevation_m=1240.0,
        observer_height_m=2.0,
        horizon_points=[],
        max_horizon_elevation_deg=2.5,
        min_horizon_elevation_deg=-1.0,
        average_horizon_elevation_deg=0.8
    )
    assert "NASA LOLA" in terr.terrain_data_source
    assert terr.dem_resolution_m == 1200.0
    assert terr.is_procedural_fallback is False

    # 3. IlluminationResponse defaults
    illum = IlluminationResponse(
        latitude=-89.78,
        longitude=125.0,
        start_date=now,
        duration_days=1.0,
        step_hours=1.0,
        illumination_percentage=85.0,
        total_sunlit_hours=20.4,
        total_shadow_hours=3.6,
        longest_continuous_sunlight_hours=15.0,
        longest_continuous_shadow_hours=3.6,
        time_series=[]
    )
    assert illum.data_source == "ANALYTICAL FALLBACK DATA"
    assert "NASA LOLA" in illum.terrain_data_source
    assert illum.dem_resolution_m == 1200.0

    # 4. CommunicationResponse defaults
    comm = CommunicationResponse(
        latitude=-89.78,
        longitude=125.0,
        start_date=now,
        duration_days=1.0,
        step_hours=1.0,
        communication_availability_percentage=92.0,
        total_visible_hours=22.0,
        total_blocked_hours=2.0,
        longest_continuous_comm_window_hours=22.0,
        longest_continuous_blackout_hours=2.0,
        time_series=[]
    )
    assert comm.data_source == "ANALYTICAL FALLBACK DATA"
    assert "NASA LOLA" in comm.terrain_data_source
    
    # Negative weight should fail
    with pytest.raises(ValidationError):
        WeightsConfig(solar_illumination=-0.2)
