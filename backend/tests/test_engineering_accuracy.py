"""
Unit & Integration Tests for Engineering-Level Accuracy Improvements:
- Physics-based 3D dot product solar panel incidence and tracking
- Battery charging/discharging efficiency, power limits, and survival analysis
- DTE communication antenna gimbal limits and discrete pass windows
- RF Link Budget assessment (Friis FSPL, received Eb/N0, link margin >= 3.0 dB)
- MCDA 6-criteria normalization and hard constraint enforcement
"""

import math
from datetime import datetime, timezone, timedelta
import pytest

from app.schemas.simulation import SimulationRequest, SimulationResponse
from app.schemas.communication import CommunicationRequest, CommunicationResponse
from app.schemas.recommend import RecommendRequest, WeightsConfig, ConstraintsConfig
from app.engines.simulation.engine import simulation_engine
from app.engines.communication.engine import communication_engine
from app.engines.recommendation.engine import recommendation_engine


# ==============================================================================
# TASK 1: SOLAR PANEL MODEL TESTS
# ==============================================================================

def test_solar_panel_tracking_modes_comparison():
    """Verify that dual-axis tracking produces higher or equal power to fixed panels."""
    base_params = {
        "site_id": "shackleton-rim",
        "start_date": datetime(2026, 12, 1, 0, 0, 0, tzinfo=timezone.utc),
        "duration_days": 1.0,
        "step_hours": 1.0,
        "solar_array_area_m2": 5.0,
        "solar_efficiency": 0.30,
        "battery_capacity_wh": 10000.0,
        "initial_battery_soc_percent": 100.0,
        "base_hotel_load_w": 50.0,
        "payload_active_load_w": 0.0,
        "survival_heater_load_w": 0.0,
    }

    req_dual = SimulationRequest(**base_params, solar_tracking_type="DUAL_AXIS_TRACKING")
    res_dual = simulation_engine.simulate_mission_power(req_dual)

    req_flat = SimulationRequest(**base_params, solar_tracking_type="HORIZONTAL_FLAT")
    res_flat = simulation_engine.simulate_mission_power(req_flat)

    req_vert_track = SimulationRequest(**base_params, solar_tracking_type="VERTICAL_AZIMUTH_TRACKING")
    res_vert_track = simulation_engine.simulate_mission_power(req_vert_track)

    # Near lunar south pole, solar elevation is low (~1-2°), so horizontal flat panel captures very little flux
    assert res_dual.total_energy_generated_kwh >= res_flat.total_energy_generated_kwh
    assert res_vert_track.total_energy_generated_kwh > res_flat.total_energy_generated_kwh


def test_solar_panel_dust_and_wiring_derating():
    """Verify dust degradation and wiring loss factor directly scale generated power."""
    base_params = {
        "site_id": "shackleton-rim",
        "start_date": datetime(2026, 12, 1, 0, 0, 0, tzinfo=timezone.utc),
        "duration_days": 1.0,
        "step_hours": 2.0,
        "solar_array_area_m2": 4.0,
        "solar_efficiency": 0.30,
        "battery_capacity_wh": 5000.0,
        "base_hotel_load_w": 20.0,
        "payload_active_load_w": 0.0,
        "survival_heater_load_w": 0.0,
    }

    req_ideal = SimulationRequest(
        **base_params,
        dust_degradation_factor=1.0,
        wiring_loss_factor=1.0
    )
    res_ideal = simulation_engine.simulate_mission_power(req_ideal)

    req_derated = SimulationRequest(
        **base_params,
        dust_degradation_factor=0.90,
        wiring_loss_factor=0.90
    )
    res_derated = simulation_engine.simulate_mission_power(req_derated)

    expected_ratio = 0.90 * 0.90  # 0.81
    actual_ratio = res_derated.total_energy_generated_kwh / res_ideal.total_energy_generated_kwh
    assert abs(actual_ratio - expected_ratio) < 0.02


def test_solar_incidence_angle_recorded():
    """Verify each point in EPS time series contains solar incidence angle theta."""
    req = SimulationRequest(
        site_id="shackleton-rim",
        start_date=datetime(2026, 12, 1, 0, 0, 0, tzinfo=timezone.utc),
        duration_days=0.5,
        step_hours=2.0,
        solar_array_area_m2=3.0,
        battery_capacity_wh=3000.0
    )
    res = simulation_engine.simulate_mission_power(req)
    assert len(res.time_series) > 0
    for pt in res.time_series:
        assert pt.solar_incidence_angle_deg >= 0.0
        assert pt.solar_incidence_angle_deg <= 180.0


# ==============================================================================
# TASK 2 & 3: BATTERY SIMULATION & SURVIVAL ANALYSIS
# ==============================================================================

def test_battery_charging_and_discharging_efficiency():
    """Verify battery round-trip Coulombic losses reduce stored and delivered energy."""
    base_params = {
        "site_id": "shackleton-rim",
        "start_date": datetime(2026, 12, 1, 0, 0, 0, tzinfo=timezone.utc),
        "duration_days": 1.0,
        "step_hours": 1.0,
        "solar_array_area_m2": 0.5,  # low solar to force heavy discharge
        "battery_capacity_wh": 5000.0,
        "initial_battery_soc_percent": 100.0,
        "base_hotel_load_w": 250.0,
        "payload_active_load_w": 0.0,
        "survival_heater_load_w": 0.0,
    }

    # Ideal battery (100% discharge efficiency)
    req_ideal = SimulationRequest(**base_params, discharging_efficiency=1.0)
    res_ideal = simulation_engine.simulate_mission_power(req_ideal)

    # Real battery (90% discharge efficiency -> draws more capacity for same load)
    req_lossy = SimulationRequest(**base_params, discharging_efficiency=0.90)
    res_lossy = simulation_engine.simulate_mission_power(req_lossy)

    assert res_lossy.min_battery_soc_percent < res_ideal.min_battery_soc_percent


def test_battery_depletion_and_survival_warning():
    """Verify that an undersized battery triggers battery_depleted and critical warnings."""
    req = SimulationRequest(
        site_id="shackleton-rim",
        start_date=datetime(2026, 12, 1, 0, 0, 0, tzinfo=timezone.utc),
        duration_days=3.0,
        step_hours=1.0,
        solar_array_area_m2=0.5,  # minimal solar
        battery_capacity_wh=500.0,  # tiny 500 Wh battery
        initial_battery_soc_percent=100.0,
        base_hotel_load_w=200.0,  # 200W load drains 500Wh in under 3 hours
        payload_active_load_w=50.0,
        survival_heater_load_w=50.0,
        min_safe_soc_percent=25.0
    )
    res = simulation_engine.simulate_mission_power(req)
    assert res.battery_depleted is True
    assert res.min_battery_soc_percent == 0.0
    assert res.estimated_survival_duration_hours is not None
    assert res.estimated_survival_duration_hours < 72.0
    assert len(res.power_shortage_warnings) > 0
    assert any("CRITICAL" in w for w in res.power_shortage_warnings)
    assert res.battery_temperature_limitation is not None


def test_battery_charge_curtailment():
    """Verify battery charge power limits clamp charge intake and track curtailment."""
    req = SimulationRequest(
        site_id="shackleton-rim",
        start_date=datetime(2026, 12, 1, 0, 0, 0, tzinfo=timezone.utc),
        duration_days=1.0,
        step_hours=1.0,
        solar_array_area_m2=20.0,  # huge solar array generates thousands of watts
        battery_capacity_wh=5000.0,
        initial_battery_soc_percent=50.0,
        base_hotel_load_w=100.0,
        max_charge_power_w=300.0  # clamp charge intake to 300 W
    )
    res = simulation_engine.simulate_mission_power(req)
    # Check that curtailed power is recorded when solar generation is high
    curtailed_pts = [pt.curtailed_power_w for pt in res.time_series if pt.curtailed_power_w > 0.0]
    assert len(curtailed_pts) > 0


# ==============================================================================
# TASK 4 & 5: DTE COMMUNICATION & LINK BUDGET TESTS
# ==============================================================================

def test_communication_antenna_gimbal_limits():
    """Verify that antenna elevation and azimuth gimbal restrictions prevent comm closure."""
    base_params = {
        "latitude": -89.78,
        "longitude": 125.0,
        "elevation_m": 1240.0,
        "start_date": datetime(2026, 12, 1, 0, 0, 0, tzinfo=timezone.utc),
        "duration_days": 2.0,
        "step_hours": 2.0,
        "use_terrain_horizon": False,  # isolate gimbal restrictions
    }

    # Wide open gimbal
    req_open = CommunicationRequest(**base_params, min_comm_elevation_deg=0.0, max_comm_elevation_deg=90.0)
    res_open = communication_engine.calculate_communication(req_open)

    # Restrictive gimbal: Earth at Shackleton is at ~1.5° elevation. Restricting min to 5.0° blocks it.
    req_restricted = CommunicationRequest(
        **base_params,
        min_comm_elevation_deg=5.0,
        max_comm_elevation_deg=90.0
    )
    res_restricted = communication_engine.calculate_communication(req_restricted)

    assert res_open.communication_availability_percentage > res_restricted.communication_availability_percentage


def test_communication_discrete_windows_extraction():
    """Verify comm_windows discrete pass list is populated with valid durations and metrics."""
    req = CommunicationRequest(
        latitude=-89.78,
        longitude=125.0,
        elevation_m=1240.0,
        start_date=datetime(2026, 12, 1, 0, 0, 0, tzinfo=timezone.utc),
        duration_days=3.0,
        step_hours=2.0,
        use_terrain_horizon=True,
        enable_link_budget=True
    )
    res = communication_engine.calculate_communication(req)
    assert res.num_comm_windows == len(res.comm_windows)
    for win in res.comm_windows:
        assert win.duration_hours > 0.0
        assert win.end_time > win.start_time
        assert win.mean_earth_elevation_deg is not None


def test_link_budget_feasibility_separation():
    """Verify that geometric visibility is separated from RF link closure (margin >= 3.0 dB)."""
    base_params = {
        "latitude": -89.78,
        "longitude": 125.0,
        "elevation_m": 1240.0,
        "start_date": datetime(2026, 12, 1, 0, 0, 0, tzinfo=timezone.utc),
        "duration_days": 1.0,
        "step_hours": 2.0,
        "use_terrain_horizon": False,
        "enable_link_budget": True,
    }

    # Nominal transmitter (15 W, high gain 28 dBi, 1 Mbps data rate) -> Closes link
    req_good = CommunicationRequest(
        **base_params,
        tx_power_w=15.0,
        tx_antenna_gain_dbi=28.0,
        data_rate_kbps=1000.0,
        min_link_margin_db=3.0
    )
    res_good = communication_engine.calculate_communication(req_good)
    assert res_good.link_budget_summary is not None
    assert res_good.link_budget_summary.free_space_path_loss_db > 200.0  # ~222 dB at X-band
    assert res_good.link_budget_summary.is_link_feasible is True

    # Underpowered transmitter (0.2 W, 0 dBi isotropic, 50 Mbps data rate) -> Fails link margin
    req_weak = CommunicationRequest(
        **base_params,
        tx_power_w=0.2,
        tx_antenna_gain_dbi=0.0,
        data_rate_kbps=50000.0,
        min_link_margin_db=3.0
    )
    res_weak = communication_engine.calculate_communication(req_weak)
    assert res_weak.link_budget_summary is not None
    # Earth is still geometrically visible, but link is not feasible!
    assert res_weak.link_budget_summary.is_link_feasible is False
    # Geometric availability must exceed or equal RF link availability
    pts_geom = [pt for pt in res_weak.time_series if pt.is_geometrically_visible]
    pts_feasible = [pt for pt in res_weak.time_series if pt.is_link_feasible]
    assert len(pts_geom) >= len(pts_feasible)


# ==============================================================================
# TASK 6: MCDA 6-CRITERIA NORMALIZATION & CONSTRAINTS TESTS
# ==============================================================================

def test_mcda_six_criteria_normalization():
    """Verify MCDA normalizes across all 6 operational criteria."""
    req = RecommendRequest(
        start_date=datetime(2026, 12, 1, 0, 0, 0, tzinfo=timezone.utc),
        duration_days=3.0,
        step_hours=6.0,
        weights=WeightsConfig(
            solar_illumination=0.25,
            earth_communication=0.20,
            slope_safety=0.15,
            elevation_advantage=0.10,
            power_survival=0.20,
            blackout_risk=0.10
        ),
        constraints=ConstraintsConfig(
            min_illumination_percentage=10.0,
            min_communication_percentage=10.0,
            max_acceptable_slope_degrees=20.0,
            max_continuous_shadow_hours=150.0,
            min_battery_soc_percent=15.0,
            max_comm_blackout_hours=100.0
        )
    )
    res = recommendation_engine.recommend_sites(req)
    assert len(res.ranking) > 0
    top = res.ranking[0]
    assert top.total_score >= 0.0
    assert top.total_score <= 100.0
    assert "power_survival" in top.scores_breakdown
    assert "blackout_risk" in top.scores_breakdown


def test_mcda_hard_constraint_disqualification():
    """Verify that violating min_battery_soc_percent or max_comm_blackout_hours disqualifies site."""
    req = RecommendRequest(
        start_date=datetime(2026, 12, 1, 0, 0, 0, tzinfo=timezone.utc),
        duration_days=14.0,
        step_hours=12.0,
        weights=WeightsConfig(
            solar_illumination=0.35,
            earth_communication=0.30,
            slope_safety=0.20,
            elevation_advantage=0.15,
            power_survival=0.0,
            blackout_risk=0.0
        ),
        constraints=ConstraintsConfig(
            min_illumination_percentage=0.0,
            min_communication_percentage=0.0,
            max_acceptable_slope_degrees=30.0,
            max_continuous_shadow_hours=500.0,
            # Strict 40% battery SoC cutoff over 14 days will disqualify shadowed sites like Amundsen Rim
            min_battery_soc_percent=40.0,
            max_comm_blackout_hours=12.0
        )
    )
    res = recommendation_engine.recommend_sites(req)
    assert len(res.disqualified_sites) > 0
    disq = res.disqualified_sites[0]
    assert any("battery" in v.lower() or "blackout" in v.lower() for v in disq.violations)
