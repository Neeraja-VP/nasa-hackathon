"""
LUNA NAVIGATOR — Sky Horizon View & Combined Terrain Engine Unit & Integration Tests (Task 9)
Tests:
- Sun above horizon / below horizon.
- Earth above horizon / below horizon.
- Terrain-obstructed Sun.
- Terrain-obstructed Earth.
- Time slider step indexing and timeline boundaries.
- API endpoints and schema validation.
- Missing and invalid data rejection.
"""

from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient

from app.main import create_application
from app.schemas.sky_horizon import SkyHorizonRequest, SkyHorizonResponse
from app.engines.terrain.sky_horizon_engine import sky_horizon_engine
from app.engines.terrain.horizon import terrain_engine
from app.schemas.terrain import TerrainHorizonRequest

client = TestClient(create_application())


def test_sky_horizon_engine_evaluation_basic():
    """Verify basic evaluation of SkyHorizonResponse for Shackleton Crater Rim."""
    request = SkyHorizonRequest(
        latitude=-89.78,
        longitude=125.0,
        elevation_m=1240.0,
        mast_height_m=2.0,
        start_date=datetime(2026, 12, 1, 0, 0, tzinfo=timezone.utc),
        duration_days=7.0,
        step_hours=2.0
    )

    response = sky_horizon_engine.evaluate_sky_horizon(request)

    assert isinstance(response, SkyHorizonResponse)
    assert response.total_steps == 85
    assert len(response.time_series) == 85
    assert len(response.horizon_profile) > 0
    assert 0.0 <= response.illumination_percentage <= 100.0
    assert 0.0 <= response.communication_percentage <= 100.0


def test_sun_above_and_below_geometric_horizon():
    """Verify distinction between Sun above and below the geometric horizon (0°)."""
    horizon_req = TerrainHorizonRequest(
        latitude=-89.78,
        longitude=125.0,
        elevation_m=1240.0,
        observer_height_m=2.0
    )
    horizon_resp = terrain_engine.generate_horizon_profile(horizon_req)

    # 1. Sun well above horizon (+3.0° above a 1.0° terrain ridge)
    vis_above = terrain_engine.calculate_solar_visibility(
        horizon_response=horizon_resp,
        sun_azimuth_deg=90.0,
        sun_elevation_deg=3.0
    )
    assert vis_above["is_sunlit"] is True
    assert vis_above["status"] == "DIRECT_SUNLIGHT"

    # 2. Sun below geometric horizon (-1.5°)
    vis_below = terrain_engine.calculate_solar_visibility(
        horizon_response=horizon_resp,
        sun_azimuth_deg=90.0,
        sun_elevation_deg=-1.5
    )
    assert vis_below["is_sunlit"] is False
    assert vis_below["status"] == "UMBRA_SHADOW"


def test_earth_above_and_below_geometric_horizon():
    """Verify distinction between Earth above and below the geometric horizon."""
    horizon_req = TerrainHorizonRequest(
        latitude=-86.04,
        longitude=2.7,
        elevation_m=5020.0,
        observer_height_m=2.0
    )
    horizon_resp = terrain_engine.generate_horizon_profile(horizon_req)

    # 1. Earth above horizon (+4.5°)
    vis_above = terrain_engine.calculate_earth_visibility(
        horizon_response=horizon_resp,
        earth_azimuth_deg=0.0,
        earth_elevation_deg=4.5,
        min_comm_elevation_deg=0.5
    )
    assert vis_above["is_visible"] is True
    assert vis_above["link_status"] == "DIRECT_LINE_OF_SIGHT"

    # 2. Earth below geometric horizon (-2.0°)
    vis_below = terrain_engine.calculate_earth_visibility(
        horizon_response=horizon_resp,
        earth_azimuth_deg=0.0,
        earth_elevation_deg=-2.0,
        min_comm_elevation_deg=0.5
    )
    assert vis_below["is_visible"] is False
    assert vis_below["link_status"] == "TERRAIN_BLOCKED" or vis_below["link_status"] == "BELOW_MIN_ELEVATION"


def test_terrain_obstructed_sun_and_earth():
    """
    Verify that celestial bodies with POSITIVE geometric elevation are correctly
    flagged as obstructed when local terrain ridge elevation exceeds body elevation.
    """
    request = SkyHorizonRequest(
        latitude=-89.78,
        longitude=125.0,
        elevation_m=1240.0,
        mast_height_m=2.0,
        start_date=datetime(2026, 12, 1, 0, 0, tzinfo=timezone.utc),
        duration_days=14.0,
        step_hours=2.0
    )
    response = sky_horizon_engine.evaluate_sky_horizon(request)

    # Check that points with sun_elevation > 0 but sun_elevation < terrain_el are TERRAIN_OCCLUDED
    obstructed_sun_pts = [
        pt for pt in response.time_series
        if pt.is_sun_geometric and not pt.is_sun_visible
    ]
    if obstructed_sun_pts:
        first_obs = obstructed_sun_pts[0]
        assert first_obs.sun_visibility_status == "TERRAIN_OCCLUDED"
        assert first_obs.sun_elevation_clearance_deg <= 0.0

    # Check earth clearance values
    for pt in response.time_series:
        expected_clearance = round(pt.earth_elevation_deg - pt.earth_terrain_horizon_elevation_deg, 2)
        assert abs(pt.earth_elevation_clearance_deg - expected_clearance) < 0.05
        if pt.is_earth_geometric and not pt.is_earth_visible:
            assert pt.earth_visibility_status == "TERRAIN_BLOCKED"


def test_sky_horizon_time_slider_step_updates_and_boundaries():
    """Verify that timeline steps increment consistently and match boundaries."""
    duration_days = 5.0
    step_hours = 1.0
    expected_steps = int(duration_days * 24 / step_hours) + 1

    request = SkyHorizonRequest(
        latitude=-89.78,
        longitude=125.0,
        elevation_m=1240.0,
        start_date=datetime(2026, 12, 1, 0, 0, tzinfo=timezone.utc),
        duration_days=duration_days,
        step_hours=step_hours
    )
    response = sky_horizon_engine.evaluate_sky_horizon(request)

    assert response.total_steps == expected_steps
    assert len(response.time_series) == expected_steps

    # Test boundary 0 (T+0)
    pt_start = response.time_series[0]
    assert pt_start.step_index == 0
    assert pt_start.mission_elapsed_hours == 0.0
    assert pt_start.timestamp == datetime(2026, 12, 1, 0, 0, tzinfo=timezone.utc)

    # Test boundary N-1 (T+max)
    pt_end = response.time_series[-1]
    assert pt_end.step_index == expected_steps - 1
    assert pt_end.mission_elapsed_hours == (expected_steps - 1) * step_hours

    # Monotonic timestamps
    for i in range(1, expected_steps):
        assert response.time_series[i].timestamp > response.time_series[i - 1].timestamp
        assert response.time_series[i].step_index == i


def test_sky_horizon_api_endpoint():
    """Integration test for POST /api/terrain/sky-horizon endpoint."""
    payload = {
        "latitude": -89.78,
        "longitude": 125.0,
        "elevation_m": 1240.0,
        "mast_height_m": 2.0,
        "start_date": "2026-12-01T00:00:00Z",
        "duration_days": 3.0,
        "step_hours": 2.0
    }

    res = client.post("/api/terrain/sky-horizon", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert data["latitude"] == -89.78
    assert data["longitude"] == 125.0
    assert data["total_steps"] == 37
    assert len(data["time_series"]) == 37
    assert "horizon_profile" in data
    assert "illumination_percentage" in data
    assert "communication_percentage" in data


def test_sky_horizon_missing_and_invalid_inputs():
    """Verify schema validation and error responses for invalid inputs."""
    # Invalid latitude (-95.0)
    res_lat = client.post("/api/terrain/sky-horizon", json={
        "latitude": -95.0,
        "longitude": 125.0,
        "start_date": "2026-12-01T00:00:00Z",
        "duration_days": 3.0
    })
    assert res_lat.status_code == 422

    # Invalid duration (0.0 days)
    res_dur = client.post("/api/terrain/sky-horizon", json={
        "latitude": -89.78,
        "longitude": 125.0,
        "start_date": "2026-12-01T00:00:00Z",
        "duration_days": 0.0
    })
    assert res_dur.status_code == 422
