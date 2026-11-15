"""
Integration Tests for FastAPI Endpoints and Calculations
"""

from datetime import datetime, timezone
import pytest
from fastapi_client import FastAPITestClient as TestClient
from app.main import app

client = TestClient(app)


def test_health_endpoint():
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "HEALTHY"
    assert "LUNA NAVIGATOR" in data["service"]


def test_get_sites_catalog():
    res = client.get("/api/sites")
    assert res.status_code == 200
    sites = res.json()
    assert len(sites) >= 8
    
    # Check Shackleton Rim
    shackleton = next((s for s in sites if s["id"] == "shackleton-rim"), None)
    assert shackleton is not None
    assert shackleton["latitude"] < -89.0


def test_get_single_site():
    res = client.get("/api/sites/shackleton-rim")
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == "shackleton-rim"
    assert "Shackleton" in data["name"]


def test_get_site_not_found():
    res = client.get("/api/sites/non-existent-site-id")
    assert res.status_code == 404


def test_ephemeris_calculation():
    payload = {
        "latitude": -89.78,
        "longitude": 125.0,
        "elevation_m": 1240.0,
        "start_date": "2026-12-01T00:00:00Z",
        "duration_days": 2.0,
        "step_hours": 6.0
    }
    res = client.post("/api/ephemeris", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "time_series" in data
    assert len(data["time_series"]) == 9  # 0, 6, 12, 18, 24, 30, 36, 42, 48 hours
    first_pt = data["time_series"][0]
    assert "sun_azimuth_deg" in first_pt
    assert "earth_elevation_deg" in first_pt


def test_ephemeris_validate_endpoint():
    res = client.get("/api/ephemeris/validate?site_id=shackleton-rim&epoch_iso=2026-12-01T00:00:00Z")
    assert res.status_code == 200
    data = res.json()
    assert data["site_id"] == "shackleton-rim"
    assert data["is_validated"] is True
    assert "residuals" in data
    assert data["residuals"]["max_residual_deg"] <= 0.50


def test_ephemeris_horizons_status_endpoint():
    res = client.get("/api/ephemeris/horizons-status")
    assert res.status_code == 200
    data = res.json()
    assert "api_endpoint" in data
    assert "cached_query_count" in data
    assert "DE440" in data["ephemeris_datum"]


def test_terrain_horizon():
    payload = {
        "latitude": -89.78,
        "longitude": 125.0,
        "elevation_m": 1240.0,
        "max_distance_km": 50.0,
        "azimuth_step_deg": 10.0,
        "observer_height_m": 2.0
    }
    res = client.post("/api/terrain/horizon", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert len(data["horizon_points"]) == 36  # 360 / 10


def test_illumination_calculation():
    payload = {
        "latitude": -89.78,
        "longitude": 125.0,
        "elevation_m": 1240.0,
        "start_date": "2026-12-01T00:00:00Z",
        "duration_days": 3.0,
        "step_hours": 3.0,
        "use_terrain_horizon": True
    }
    res = client.post("/api/illumination", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "illumination_percentage" in data
    assert data["illumination_percentage"] >= 0.0
    assert "total_sunlit_hours" in data


def test_communication_calculation():
    payload = {
        "latitude": -89.78,
        "longitude": 125.0,
        "elevation_m": 1240.0,
        "start_date": "2026-12-01T00:00:00Z",
        "duration_days": 3.0,
        "step_hours": 3.0,
        "min_comm_elevation_deg": 0.5,
        "use_terrain_horizon": True
    }
    res = client.post("/api/communication", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "communication_availability_percentage" in data
    assert data["communication_availability_percentage"] >= 0.0


def test_compare_sites():
    payload = {
        "site_ids": ["shackleton-rim", "malapert-mountain"],
        "start_date": "2026-12-01T00:00:00Z",
        "duration_days": 2.0,
        "step_hours": 4.0
    }
    res = client.post("/api/compare", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert len(data["sites_evaluated"]) == 2


def test_recommend_sites():
    payload = {
        "start_date": "2026-12-01T00:00:00Z",
        "duration_days": 14.0,
        "step_hours": 12.0,
        "weights": {
            "solar_illumination": 0.40,
            "earth_communication": 0.30,
            "slope_safety": 0.20,
            "elevation_advantage": 0.10
        },
        "constraints": {
            "min_illumination_percentage": 20.0,
            "min_communication_percentage": 20.0,
            "max_acceptable_slope_degrees": 15.0,
            "max_continuous_shadow_hours": 200.0
        }
    }
    res = client.post("/api/recommend", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "ranking" in data
    assert len(data["ranking"]) > 0
    assert data["ranking"][0]["rank"] == 1


def test_simulate_mission():
    payload = {
        "site_id": "shackleton-rim",
        "start_date": "2026-12-01T00:00:00Z",
        "duration_days": 2.0,
        "step_hours": 2.0,
        "solar_array_area_m2": 4.0,
        "solar_efficiency": 0.30,
        "battery_capacity_wh": 5000.0,
        "initial_battery_soc_percent": 100.0,
        "base_hotel_load_w": 100.0,
        "payload_active_load_w": 50.0,
        "survival_heater_load_w": 60.0
    }
    res = client.post("/api/simulate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "min_battery_soc_percent" in data
    assert "total_energy_generated_kwh" in data
    assert len(data["time_series"]) > 0


def test_ai_mission_assistant_endpoint():
    payload = {
        "query": "Which candidate site is optimal for an Artemis III surface stay?",
        "start_date": "2026-12-01T00:00:00Z",
        "duration_days": 7.0,
        "step_hours": 6.0
    }
    res = client.post("/api/assistant", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "intent" in data
    assert data["intent"] == "RECOMMEND_OPTIMAL_SITE"
    assert "summary" in data
    assert "detailed_analysis" in data
    assert "scientific_evidence" in data
    assert "safety_disclaimer" in data
    assert "NASA" in data["safety_disclaimer"]

