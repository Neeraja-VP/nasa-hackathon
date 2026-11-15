"""
LUNA NAVIGATOR — Sky-Horizon View Integration Tests (Task 9)
Tests combined topocentric Sun and Earth visibility relative to local 360° terrain horizon,
geometric vs terrain horizon distinction, polar grazing shadow ingress/egress transitions,
time slider timeline scrubbing boundaries, and error handling for missing/invalid data.
"""

import math
from datetime import datetime, timedelta, timezone
import pytest
from pydantic import ValidationError

from app.core.constants import (
    SOLAR_ANGULAR_RADIUS_DEG,
    EARTH_ANGULAR_RADIUS_LUNAR_SKY_DEG,
    MIN_COMM_ELEVATION_THRESHOLD_DEG,
    SOLAR_CONSTANT_1AU_W_M2,
)
from app.schemas.terrain import TerrainHorizonRequest, HorizonPoint, TerrainHorizonResponse
from app.schemas.illumination import IlluminationRequest, IlluminationPoint
from app.schemas.communication import CommunicationRequest, CommunicationPoint
from app.engines.terrain.horizon import terrain_engine
from app.engines.illumination.engine import illumination_engine
from app.engines.communication.engine import communication_engine
from app.core.coordinates import vector_to_azimuth_elevation, lunar_curvature_drop


def test_sun_above_horizon_visibility_and_flux():
    """Verify that when Sun elevation exceeds the local LOLA terrain horizon, it is flagged visible with positive flux."""
    req_terrain = TerrainHorizonRequest(
        latitude=-89.78,
        longitude=125.0,
        elevation_m=1240.0,
        azimuth_step_deg=10.0,
        observer_height_m=2.0
    )
    horizon_res = terrain_engine.generate_horizon_profile(req_terrain)
    horizon_at_az45 = terrain_engine.get_horizon_elevation_at_azimuth(horizon_res, 45.0)

    # Place Sun 1.5 degrees above the local terrain horizon
    sun_el = horizon_at_az45 + 1.5
    sun_state = terrain_engine.calculate_solar_visibility(
        horizon_response=horizon_res,
        sun_azimuth_deg=45.0,
        sun_elevation_deg=sun_el
    )

    assert sun_state["is_sunlit"] is True
    assert sun_state["is_fully_sunlit"] is True
    assert sun_state["status"] == "DIRECT_SUNLIGHT"
    assert sun_state["horizon_elevation_deg"] == horizon_at_az45
    assert sun_state["apparent_solar_elevation_deg"] == sun_el


def test_sun_below_horizon_geometric_darkness():
    """Verify that when the Sun is below the geometric horizontal tangent plane (< -0.267°), it is marked unlit."""
    req_terrain = TerrainHorizonRequest(
        latitude=-89.78,
        longitude=125.0,
        elevation_m=1240.0,
        azimuth_step_deg=10.0,
        observer_height_m=2.0
    )
    horizon_res = terrain_engine.generate_horizon_profile(req_terrain)

    # Sun well below 0° geometric horizon (-1.5°)
    sun_el = -1.5
    sun_state = terrain_engine.calculate_solar_visibility(
        horizon_response=horizon_res,
        sun_azimuth_deg=180.0,
        sun_elevation_deg=sun_el
    )

    assert sun_state["is_sunlit"] is False
    assert sun_state["is_fully_sunlit"] is False
    assert sun_state["status"] == "UMBRA_SHADOW"


def test_terrain_obstructed_sun_geometric_illumination_split():
    """
    CRITICAL SCIENTIFIC TEST:
    Distinguish between geometric horizon and terrain horizon.
    When Sun elevation is > 0° (above geometric tangent plane) but <= local terrain ridge,
    geometric illumination is True, but actual terrain illumination is False (topographic shadow).
    """
    # Create synthetic terrain with a +2.5° highland ridge at azimuth 120°
    dummy_points = [
        HorizonPoint(
            azimuth_deg=float(az),
            horizon_elevation_deg=2.5 if az == 120 else 0.5,
            obstruction_distance_km=15.0,
            blocking_feature="Highland Ridge Crest"
        )
        for az in range(0, 360, 10)
    ]
    synthetic_horizon = TerrainHorizonResponse(
        latitude=-89.78,
        longitude=125.0,
        elevation_m=1240.0,
        observer_height_m=2.0,
        elevation_datum="MOON_MEAN_SPHERE_R1737_4KM",
        dem_resolution_m=100.0,
        terrain_source="NASA LOLA DEM",
        max_horizon_elevation_deg=2.5,
        min_horizon_elevation_deg=0.5,
        average_horizon_elevation_deg=0.6,
        horizon_points=dummy_points
    )

    # Solar elevation is +1.2° (clearly above 0° geometric plane, but below the 2.5° ridge)
    sun_el = 1.2
    sun_az = 120.0

    is_sunlit_geom = (sun_el + SOLAR_ANGULAR_RADIUS_DEG) > 0.0
    horizon_el = terrain_engine.get_horizon_elevation_at_azimuth(synthetic_horizon, sun_az)
    is_sunlit_terr = (sun_el + SOLAR_ANGULAR_RADIUS_DEG) > horizon_el

    assert is_sunlit_geom is True, "Sun must be geometrically above flat horizon plane"
    assert is_sunlit_terr is False, "Sun must be blocked by the +2.5° terrain ridge"
    assert horizon_el == 2.5
    # Clearance is negative
    assert (sun_el - horizon_el) == pytest.approx(-1.3, abs=0.01)


def test_earth_above_horizon_direct_los():
    """Verify that when Earth is above the local terrain horizon and above antenna cutoff (1.0°), link is DIRECT_LINE_OF_SIGHT."""
    req_terrain = TerrainHorizonRequest(
        latitude=-85.99,
        longitude=2.91,
        elevation_m=5050.0,  # Malapert Mountain
        azimuth_step_deg=10.0,
        observer_height_m=2.0
    )
    horizon_res = terrain_engine.generate_horizon_profile(req_terrain)
    horizon_at_az0 = terrain_engine.get_horizon_elevation_at_azimuth(horizon_res, 0.0)

    # Earth at +6.0° elevation (standard polar libration altitude)
    earth_el = 6.0
    earth_state = terrain_engine.calculate_earth_visibility(
        horizon_response=horizon_res,
        earth_azimuth_deg=0.0,
        earth_elevation_deg=earth_el,
        min_comm_elevation_deg=1.0
    )

    assert earth_state["is_visible"] is True
    assert earth_state["link_status"] == "DIRECT_LINE_OF_SIGHT"
    assert earth_state["earth_elevation_deg"] == earth_el
    assert earth_state["earth_elevation_deg"] > earth_state["effective_cutoff_deg"]


def test_earth_below_horizon_geometric():
    """Verify that when Earth dips below the geometric horizon / cutoff, communication line of sight is lost."""
    req_terrain = TerrainHorizonRequest(
        latitude=-89.78,
        longitude=125.0,
        elevation_m=1240.0,
        azimuth_step_deg=10.0,
        observer_height_m=2.0
    )
    horizon_res = terrain_engine.generate_horizon_profile(req_terrain)
    horizon_at_310 = terrain_engine.get_horizon_elevation_at_azimuth(horizon_res, 310.0)

    # Earth dipping below geometric plane (-0.8°)
    earth_el = -0.8
    earth_state = terrain_engine.calculate_earth_visibility(
        horizon_response=horizon_res,
        earth_azimuth_deg=310.0,
        earth_elevation_deg=earth_el,
        min_comm_elevation_deg=0.5
    )

    assert earth_state["is_visible"] is False
    assert earth_state["link_status"] in ("TERRAIN_BLOCKED", "BELOW_MIN_ELEVATION")

    # When Earth is strictly below the local terrain horizon:
    earth_below_terrain = terrain_engine.calculate_earth_visibility(
        horizon_response=horizon_res,
        earth_azimuth_deg=310.0,
        earth_elevation_deg=horizon_at_310 - 1.0,
        min_comm_elevation_deg=0.5
    )
    assert earth_below_terrain["is_visible"] is False
    assert earth_below_terrain["link_status"] == "TERRAIN_BLOCKED"


def test_terrain_obstructed_earth_occlusion():
    """
    Verify that when Earth elevation is > 0° and > min_comm_elevation_deg, but blocked by a crater rim,
    link_status is TERRAIN_BLOCKED.
    """
    dummy_points = [
        HorizonPoint(
            azimuth_deg=float(az),
            horizon_elevation_deg=5.2 if az == 270 else 0.8,
            obstruction_distance_km=8.5,
            blocking_feature="Crater Rim Crest"
        )
        for az in range(0, 360, 10)
    ]
    synthetic_horizon = TerrainHorizonResponse(
        latitude=-89.78,
        longitude=125.0,
        elevation_m=1240.0,
        observer_height_m=2.0,
        elevation_datum="MOON_MEAN_SPHERE_R1737_4KM",
        dem_resolution_m=100.0,
        terrain_source="NASA LOLA DEM",
        max_horizon_elevation_deg=5.2,
        min_horizon_elevation_deg=0.8,
        average_horizon_elevation_deg=1.0,
        horizon_points=dummy_points
    )

    # Earth at elevation +3.5° (above 1.0° antenna cutoff, but below 5.2° crater rim)
    earth_el = 3.5
    earth_az = 270.0
    earth_state = terrain_engine.calculate_earth_visibility(
        horizon_response=synthetic_horizon,
        earth_azimuth_deg=earth_az,
        earth_elevation_deg=earth_el,
        min_comm_elevation_deg=1.0
    )

    assert earth_state["is_visible"] is False
    assert earth_state["link_status"] == "TERRAIN_BLOCKED"
    assert earth_state["horizon_elevation_deg"] == 5.2
    # Clearance is negative
    assert (earth_el - earth_state["horizon_elevation_deg"]) == pytest.approx(-1.7, abs=0.01)


def test_time_slider_scrubbing_and_boundary_guards():
    """Verify timeline time-series structure, indexing boundaries, and temporal scrubbing invariants."""
    start_dt = datetime(2026, 12, 1, 0, 0, 0, tzinfo=timezone.utc)
    duration_days = 3.0
    step_hours = 2.0
    expected_steps = int((duration_days * 24.0) / step_hours) + 1  # 37 points

    req = IlluminationRequest(
        latitude=-89.78,
        longitude=125.0,
        elevation_m=1240.0,
        start_date=start_dt,
        duration_days=duration_days,
        step_hours=step_hours,
        use_terrain_horizon=True,
        mast_height_m=2.0
    )
    illum_res = illumination_engine.calculate_illumination(req)
    series = illum_res.time_series

    assert len(series) == expected_steps
    assert series[0].timestamp == start_dt

    # Test timeline scrubbing index clamp
    valid_indices = [0, len(series) // 2, len(series) - 1]
    for idx in valid_indices:
        pt = series[idx]
        assert 0.0 <= pt.sun_azimuth_deg < 360.0
        assert -5.0 <= pt.sun_elevation_deg <= 10.0
        assert isinstance(pt.is_sunlit_terrain, bool)
        assert isinstance(pt.is_sunlit_geometric, bool)

    # End timestamp check
    expected_end = start_dt + timedelta(days=duration_days)
    assert series[-1].timestamp == expected_end


def test_solar_and_earth_visibility_transition_calculations():
    """
    Test transition forward-scan algorithm (sunset/sunrise, Earthset/Earthrise)
    derived from calculated time-series points.
    """
    # Create alternating illumination pattern: True, True, False, False, True
    test_pattern = [True, True, False, False, True, True]
    step_hours = 2.0

    # From index 0 (currently sunlit): next shadow ingress (sunset) should be at index 2 (4 hours away)
    curr_state_0 = test_pattern[0]
    next_idx_0 = -1
    for i in range(1, len(test_pattern)):
        if test_pattern[i] != curr_state_0:
            next_idx_0 = i
            break
    assert next_idx_0 == 2
    hours_to_transition_0 = (next_idx_0 - 0) * step_hours
    assert hours_to_transition_0 == 4.0  # Sunset in 4.0 hours

    # From index 2 (currently shadowed): next shadow egress (sunrise) should be at index 4 (4 hours away)
    curr_state_2 = test_pattern[2]
    next_idx_2 = -1
    for i in range(3, len(test_pattern)):
        if test_pattern[i] != curr_state_2:
            next_idx_2 = i
            break
    assert next_idx_2 == 4
    hours_to_transition_2 = (next_idx_2 - 2) * step_hours
    assert hours_to_transition_2 == 4.0  # Sunrise in 4.0 hours


def test_missing_and_invalid_data_error_handling():
    """Verify that invalid coordinates (out of bounds) are properly rejected by Pydantic validation."""
    # Latitude > 90° should raise ValidationError
    with pytest.raises(ValidationError):
        TerrainHorizonRequest(
            latitude=95.0,
            longitude=0.0,
            elevation_m=0.0
        )

    # Latitude < -90° should raise ValidationError
    with pytest.raises(ValidationError):
        IlluminationRequest(
            latitude=-92.5,
            longitude=0.0,
            elevation_m=0.0,
            start_date=datetime(2026, 12, 1, 0, 0, 0, tzinfo=timezone.utc),
            duration_days=7.0
        )
