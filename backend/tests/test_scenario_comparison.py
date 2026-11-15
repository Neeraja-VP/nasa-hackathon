"""
Unit & Integration Tests for Advanced Multi-Scenario Comparison System
Tests custom coordinates, scenario isolation, comparison modes (A, B, C), and the 12 operational metrics.
"""

from datetime import datetime, timezone, timedelta
import pytest
from app.engines.recommendation.engine import recommendation_engine
from app.schemas.compare import (
    ScenarioInput,
    MultiScenarioCompareRequest,
    MultiScenarioCompareResponse,
    ScenarioResult
)
from app.schemas.sites import CustomSiteCreateRequest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_custom_landing_site_evaluation_endpoint():
    """Verify POST /api/sites/custom characterization using NASA LOLA DEM."""
    payload = {
        "name": "Artemis III Test Zone Alpha",
        "latitude": -89.78,
        "longitude": 125.0,
        "elevation_m": None  # Auto-sample from LOLA DEM
    }
    res = client.post("/api/sites/custom", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["name"] == "Artemis III Test Zone Alpha"
    assert data["latitude"] == -89.78
    assert data["longitude"] == 125.0
    # At Shackleton Rim, elevation is around 1240m
    assert abs(data["elevation_m"] - 1240.0) < 50.0
    assert data["slope_degrees"] > 0.0
    assert "custom-" in data["id"]


def test_custom_landing_site_invalid_coordinates():
    """Verify coordinate range validation rejects invalid latitude/longitude."""
    # Latitude > 90
    res = client.post("/api/sites/custom", json={"name": "Bad Lat", "latitude": 95.0, "longitude": 0.0})
    assert res.status_code == 422

    # Latitude < -90
    res2 = client.post("/api/sites/custom", json={"name": "Bad Lat", "latitude": -95.0, "longitude": 0.0})
    assert res2.status_code == 422


def test_scenario_comparison_mode_a_different_sites_same_date():
    """
    Mode A: Different sites, same date.
    Compare Shackleton Rim, Malapert Mountain, and Connecting Ridge at 2026-12-01T00:00:00Z.
    """
    epoch = datetime(2026, 12, 1, 0, 0, tzinfo=timezone.utc)
    scenarios = [
        ScenarioInput(
            id="scen-shackleton",
            name="Shackleton Baseline",
            site_id="shackleton-rim",
            latitude=-89.78,
            longitude=125.0,
            start_date=epoch,
            duration_days=2.0,
            step_hours=4.0
        ),
        ScenarioInput(
            id="scen-malapert",
            name="Malapert Massif",
            site_id="malapert-mountain",
            latitude=-85.99,
            longitude=2.91,
            start_date=epoch,
            duration_days=2.0,
            step_hours=4.0
        ),
        ScenarioInput(
            id="scen-ridge",
            name="Connecting Ridge",
            site_id="connecting-ridge",
            latitude=-89.44,
            longitude=222.5,
            start_date=epoch,
            duration_days=2.0,
            step_hours=4.0
        )
    ]
    req = MultiScenarioCompareRequest(mode="SITES_SAME_DATE", scenarios=scenarios)
    res = recommendation_engine.compare_scenarios(req)

    assert isinstance(res, MultiScenarioCompareResponse)
    assert res.total_scenarios == 3
    assert len(res.scenarios) == 3
    assert res.best_scenario_id in ["scen-shackleton", "scen-malapert", "scen-ridge"]

    # Verify all 12 operational metrics are present and populated
    for s in res.scenarios:
        assert isinstance(s, ScenarioResult)
        assert -10.0 <= s.max_solar_elevation_deg <= 10.0
        assert s.total_sunlight_hours >= 0.0
        assert s.total_darkness_hours >= 0.0
        assert 0.0 <= s.illumination_percentage <= 100.0
        assert s.longest_continuous_sunlight_hours >= 0.0
        assert s.longest_continuous_darkness_hours >= 0.0
        assert s.earth_visibility_hours >= 0.0
        assert 0.0 <= s.communication_percentage <= 100.0
        assert s.longest_comm_blackout_hours >= 0.0
        assert s.num_comm_windows >= 0
        assert 0.0 <= s.min_battery_soc_percent <= 100.0
        assert s.total_energy_generated_kwh >= 0.0
        assert s.power_survival_status in ["SURVIVED", "BATTERY_DEPLETED"]
        assert 0.0 <= s.overall_suitability_score <= 100.0
        assert s.rank in [1, 2, 3]


def test_scenario_comparison_mode_b_same_site_different_dates():
    """
    Mode B: Same site, different dates.
    Compare Shackleton Rim across three distinct seasonal/libration epochs.
    """
    scenarios = [
        ScenarioInput(
            id="date-early-dec",
            name="Early December 2026",
            site_id="shackleton-rim",
            latitude=-89.78,
            longitude=125.0,
            start_date=datetime(2026, 12, 1, 0, 0, tzinfo=timezone.utc),
            duration_days=2.0,
            step_hours=4.0
        ),
        ScenarioInput(
            id="date-mid-dec",
            name="Mid December 2026",
            site_id="shackleton-rim",
            latitude=-89.78,
            longitude=125.0,
            start_date=datetime(2026, 12, 15, 0, 0, tzinfo=timezone.utc),
            duration_days=2.0,
            step_hours=4.0
        ),
        ScenarioInput(
            id="date-late-jan",
            name="Late January 2027",
            site_id="shackleton-rim",
            latitude=-89.78,
            longitude=125.0,
            start_date=datetime(2027, 1, 20, 0, 0, tzinfo=timezone.utc),
            duration_days=2.0,
            step_hours=4.0
        )
    ]
    req = MultiScenarioCompareRequest(mode="SAME_SITE_DATES", scenarios=scenarios)
    res = recommendation_engine.compare_scenarios(req)

    assert len(res.scenarios) == 3
    # Check that each scenario retained its own unique start date!
    dates = [s.start_date for s in res.scenarios]
    assert len(set(dates)) == 3


def test_scenario_comparison_mode_c_different_sites_and_dates():
    """
    Mode C: Different sites and different dates.
    Compare custom coordinates and candidate sites on diverse dates and power configurations.
    """
    scenarios = [
        ScenarioInput(
            id="scen-custom-1",
            name="Custom Ridge (Dec 2026)",
            site_id=None,
            latitude=-89.20,
            longitude=150.0,
            start_date=datetime(2026, 12, 1, 0, 0, tzinfo=timezone.utc),
            duration_days=2.0,
            step_hours=4.0,
            battery_capacity_wh=8000.0  # Custom battery
        ),
        ScenarioInput(
            id="scen-shackleton-2027",
            name="Shackleton Rim (Jan 2027)",
            site_id="shackleton-rim",
            latitude=-89.78,
            longitude=125.0,
            start_date=datetime(2027, 1, 15, 0, 0, tzinfo=timezone.utc),
            duration_days=2.0,
            step_hours=4.0,
            battery_capacity_wh=4000.0  # Smaller battery
        ),
        ScenarioInput(
            id="scen-malapert-feb",
            name="Malapert (Feb 2027)",
            site_id="malapert-mountain",
            latitude=-85.99,
            longitude=2.91,
            start_date=datetime(2027, 2, 1, 0, 0, tzinfo=timezone.utc),
            duration_days=2.0,
            step_hours=4.0,
            battery_capacity_wh=6000.0
        )
    ]
    req = MultiScenarioCompareRequest(mode="CUSTOM", scenarios=scenarios)
    res = recommendation_engine.compare_scenarios(req)

    assert len(res.scenarios) == 3
    assert res.metric_leaders is not None
    assert "illumination" in res.metric_leaders
    assert "communication" in res.metric_leaders
    assert "suitability" in res.metric_leaders


def test_compare_scenarios_api_endpoint():
    """Verify POST /api/compare/scenarios endpoint returns 200 with valid structure."""
    payload = {
        "mode": "CUSTOM",
        "scenarios": [
            {
                "id": "scen-1",
                "name": "Scenario 1",
                "latitude": -89.78,
                "longitude": 125.0,
                "start_date": "2026-12-01T00:00:00Z",
                "duration_days": 1.0,
                "step_hours": 3.0
            },
            {
                "id": "scen-2",
                "name": "Scenario 2",
                "latitude": -85.99,
                "longitude": 2.91,
                "start_date": "2026-12-10T00:00:00Z",
                "duration_days": 1.0,
                "step_hours": 3.0
            }
        ]
    }
    res = client.post("/api/compare/scenarios", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["total_scenarios"] == 2
    assert len(data["scenarios"]) == 2
    assert data["scenarios"][0]["rank"] == 1
    assert data["scenarios"][1]["rank"] == 2
