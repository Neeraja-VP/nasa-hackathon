"""
LUNA NAVIGATOR — Mission Energy Simulation Engine Unit Tests (Member 4 Ownership)
Tests solar array tracking geometries, battery state-of-charge integration,
thermal survival loads, and battery depletion margins.
"""

from datetime import datetime, timezone
import pytest
from app.schemas.simulation import SimulationRequest
from app.engines.simulation.engine import simulation_engine


def test_simulation_solar_tracking_geometry_advantage():
    """Verify vertical azimuth tracking produces vastly more power than horizontal deck at South Pole."""
    # Run 5-day simulation at Shackleton Rim
    req_vertical = SimulationRequest(
        site_id="shackleton-rim",
        start_date=datetime(2026, 12, 1, 0, 0, 0, tzinfo=timezone.utc),
        duration_days=5.0,
        step_hours=2.0,
        solar_array_area_m2=4.0,
        solar_efficiency=0.30,
        solar_tracking_type="VERTICAL_AZIMUTH_TRACKING"
    )
    res_vertical = simulation_engine.simulate_mission_power(req_vertical)

    req_horizontal = SimulationRequest(
        site_id="shackleton-rim",
        start_date=datetime(2026, 12, 1, 0, 0, 0, tzinfo=timezone.utc),
        duration_days=5.0,
        step_hours=2.0,
        solar_array_area_m2=4.0,
        solar_efficiency=0.30,
        solar_tracking_type="HORIZONTAL_FLAT"
    )
    res_horizontal = simulation_engine.simulate_mission_power(req_horizontal)

    # Low-elevation polar Sun (< 1.8°) strikes vertical arrays at near-normal incidence,
    # whereas horizontal arrays suffer acute grazing incidence (cos(theta) = sin(1.5°) ~ 0.026)
    assert res_vertical.total_energy_generated_kwh > res_horizontal.total_energy_generated_kwh * 5.0
    assert res_vertical.peak_solar_generation_w > res_horizontal.peak_solar_generation_w * 5.0


def test_battery_depletion_detection():
    """Verify that undersized battery storage triggers depletion flag during shadow intervals or high load."""
    # Connecting Ridge experiences shadow occultation, or use high load exceeding generation
    req_undersized = SimulationRequest(
        site_id="connecting-ridge",
        start_date=datetime(2026, 12, 1, 0, 0, 0, tzinfo=timezone.utc),
        duration_days=3.0,
        step_hours=2.0,
        solar_array_area_m2=1.0,
        battery_capacity_wh=200.0,  # Small battery (200 Wh) under shadow discharge
        min_safe_soc_percent=20.0
    )
    res = simulation_engine.simulate_mission_power(req_undersized)
    
    assert res.battery_depleted is True
    assert res.eps_health_status == "CRITICAL_DEPLETION"
    assert res.min_battery_soc_percent < 20.0


def test_sufficient_battery_nominal_health():
    """Verify that adequately sized battery maintains nominal health status."""
    req_nominal = SimulationRequest(
        site_id="shackleton-rim",
        start_date=datetime(2026, 12, 1, 0, 0, 0, tzinfo=timezone.utc),
        duration_days=5.0,
        step_hours=2.0,
        solar_array_area_m2=6.0,
        battery_capacity_wh=15000.0,  # 15 kWh large battery buffer
        min_safe_soc_percent=20.0
    )
    res = simulation_engine.simulate_mission_power(req_nominal)
    assert res.battery_depleted is False
    assert res.eps_health_status in ("NOMINAL", "DEGRADED_MARGIN")
    assert res.total_energy_generated_kwh > 0.0


def test_simulation_energy_balance_accounting():
    """Verify mathematical consistency of generated vs consumed energy accounting."""
    req = SimulationRequest(
        site_id="connecting-ridge",
        start_date=datetime(2026, 12, 1, 0, 0, 0, tzinfo=timezone.utc),
        duration_days=4.0,
        step_hours=2.0
    )
    res = simulation_engine.simulate_mission_power(req)
    
    expected_net = round(res.total_energy_generated_kwh - res.total_energy_consumed_kwh, 2)
    assert abs(res.net_energy_balance_kwh - expected_net) <= 0.02
    assert len(res.time_series) == int((4.0 * 24.0) / 2.0) + 1
