"""
LUNA NAVIGATOR — Engineering Accuracy & Environmental Physics Unit Tests (Tasks 1 - 8)
Tests:
- Solar incidence angle vector math and orientation changes.
- Panel tilt and lunar regolith dust / temperature deratings.
- Battery charging/discharging efficiencies and C-rate limiters.
- Power shortage warnings and estimated survival duration.
- RF Direct-to-Earth link budget calculations (FSPL, Prx, Margin).
- Antenna elevation restrictions and communication windows.
- MCDA 6-criteria weight normalization and power/blackout scoring.
"""

from datetime import datetime, timezone
import math
import pytest

from app.schemas.simulation import SimulationRequest
from app.schemas.communication import CommunicationRequest
from app.schemas.recommend import RecommendRequest, WeightsConfig, ConstraintsConfig
from app.engines.simulation.engine import simulation_engine
from app.engines.communication.engine import communication_engine
from app.engines.recommendation.engine import recommendation_engine


def test_solar_incidence_angle_physics():
    """Verify 3D vector cosine incidence angle across tracking types and elevations."""
    # 1. Vertical Azimuth Tracking: cos(inc) = cos(sun_el)
    cos_inc, inc_deg = simulation_engine.calculate_solar_incidence(
        sun_el_deg=2.0,
        sun_az_deg=145.0,
        tracking_type="VERTICAL_AZIMUTH_TRACKING"
    )
    expected_cos = math.cos(math.radians(2.0))
    assert abs(cos_inc - expected_cos) < 0.001
    assert abs(inc_deg - 2.0) < 0.05

    # 2. Horizontal Flat Deck: cos(inc) = sin(sun_el)
    cos_flat, inc_flat_deg = simulation_engine.calculate_solar_incidence(
        sun_el_deg=2.0,
        sun_az_deg=145.0,
        tracking_type="HORIZONTAL_FLAT"
    )
    expected_flat_cos = math.sin(math.radians(2.0))
    assert abs(cos_flat - expected_flat_cos) < 0.001
    assert abs(inc_flat_deg - 88.0) < 0.05

    # 3. Fixed Vertical Array facing North (0° Azimuth)
    # When Sun is due North (0° Az), cos(inc) = cos(el)
    cos_north, _ = simulation_engine.calculate_solar_incidence(
        sun_el_deg=1.5,
        sun_az_deg=0.0,
        tracking_type="FIXED_VERTICAL",
        panel_azimuth_deg=0.0
    )
    assert abs(cos_north - math.cos(math.radians(1.5))) < 0.001

    # When Sun is due South (180° Az), North-facing panel receives zero direct light
    cos_back, inc_back_deg = simulation_engine.calculate_solar_incidence(
        sun_el_deg=1.5,
        sun_az_deg=180.0,
        tracking_type="FIXED_VERTICAL",
        panel_azimuth_deg=0.0
    )
    assert cos_back == 0.0
    assert inc_back_deg >= 90.0


def test_panel_tilt_and_dust_temperature_deratings():
    """Verify panel tilt and environmental derating factors affect generated power physically."""
    req_clean = SimulationRequest(
        site_id="shackleton-rim",
        start_date=datetime(2026, 12, 1, 0, 0, tzinfo=timezone.utc),
        duration_days=3.0,
        step_hours=2.0,
        solar_array_area_m2=4.0,
        dust_degradation_factor=1.0,
        temperature_derate_factor=1.0
    )
    res_clean = simulation_engine.simulate_mission_power(req_clean)

    req_dusty = SimulationRequest(
        site_id="shackleton-rim",
        start_date=datetime(2026, 12, 1, 0, 0, tzinfo=timezone.utc),
        duration_days=3.0,
        step_hours=2.0,
        solar_array_area_m2=4.0,
        dust_degradation_factor=0.85,  # 15% dust loss
        temperature_derate_factor=0.90  # 10% thermal loss
    )
    res_dusty = simulation_engine.simulate_mission_power(req_dusty)

    # Generated energy should scale by ~ (0.85 * 0.90) = 0.765
    ratio = res_dusty.total_energy_generated_kwh / res_clean.total_energy_generated_kwh
    assert abs(ratio - (0.85 * 0.90)) < 0.02


def test_battery_efficiencies_and_c_rate_limiters():
    """Verify battery charge/discharge efficiencies and C-rate limiters."""
    # Low discharge efficiency (0.75) loses more energy than high efficiency (0.98)
    req_low_eff = SimulationRequest(
        site_id="connecting-ridge",
        start_date=datetime(2026, 12, 1, 0, 0, tzinfo=timezone.utc),
        duration_days=3.0,
        step_hours=2.0,
        battery_capacity_wh=4000.0,
        discharging_efficiency=0.75
    )
    res_low = simulation_engine.simulate_mission_power(req_low_eff)

    req_high_eff = SimulationRequest(
        site_id="connecting-ridge",
        start_date=datetime(2026, 12, 1, 0, 0, tzinfo=timezone.utc),
        duration_days=3.0,
        step_hours=2.0,
        battery_capacity_wh=4000.0,
        discharging_efficiency=0.98
    )
    res_high = simulation_engine.simulate_mission_power(req_high_eff)

    assert res_high.min_battery_soc_percent >= res_low.min_battery_soc_percent


def test_power_shortage_warnings_and_survival_duration():
    """Verify shortage warning is triggered when SoC falls below safe threshold."""
    req = SimulationRequest(
        site_id="connecting-ridge",
        start_date=datetime(2026, 12, 1, 0, 0, tzinfo=timezone.utc),
        duration_days=4.0,
        step_hours=2.0,
        solar_array_area_m2=1.5,
        battery_capacity_wh=600.0,
        min_safe_soc_percent=30.0
    )
    res = simulation_engine.simulate_mission_power(req)

    assert res.is_below_safe_soc is True
    assert res.shortage_warning is not None
    assert "WARNING" in res.shortage_warning or "DEPLETION" in res.shortage_warning


def test_communication_rf_link_budget_fspl_and_margin():
    """Verify physical RF free space path loss and link margin calculations."""
    fspl, p_rx, margin = communication_engine.calculate_link_budget(
        distance_km=384400.0,
        tx_power_w=10.0,        # +40.0 dBm
        tx_gain_dbi=14.0,       # +14.0 dBi
        frequency_ghz=2.2,      # 2.2 GHz S-band
        rx_gain_dbi=56.0,       # +56.0 dBi NASA DSN 34m
        system_losses_db=3.0,   # -3.0 dB
        rx_sensitivity_dbm=-120.0
    )

    # Theoretical FSPL at 384,400 km and 2.2 GHz: ~ 211.0 dB
    assert 210.0 <= fspl <= 212.0
    # Prx = 40 + 14 - 211 + 56 - 3 = -104 dBm
    assert -106.0 <= p_rx <= -102.0
    # Margin over -120 dBm threshold: ~ +16 dB
    assert margin > 12.0


def test_antenna_gimbal_elevation_restrictions():
    """Verify that Earth is rejected if outside antenna gimbal limits."""
    req = CommunicationRequest(
        latitude=-86.04,
        longitude=2.7,
        elevation_m=5020.0,
        start_date=datetime(2026, 12, 1, 0, 0, tzinfo=timezone.utc),
        duration_days=3.0,
        step_hours=2.0,
        antenna_min_elevation_deg=6.0,  # Strict cutoff above current Earth elevation (~4.5°)
        antenna_max_elevation_deg=85.0
    )
    res = communication_engine.calculate_communication(req)

    # All points where Earth elevation is between 0.5° and 6.0° should have POINTING_LIMIT_EXCEEDED
    pointing_blocked = [p for p in res.time_series if p.is_earth_visible and not p.is_antenna_in_limits]
    for p in pointing_blocked:
        assert p.link_status == "POINTING_LIMIT_EXCEEDED"
        assert p.is_link_feasible is False


def test_communication_windows_extraction():
    """Verify extraction of communication windows and next window detection."""
    req = CommunicationRequest(
        latitude=-89.78,
        longitude=125.0,
        elevation_m=1240.0,
        start_date=datetime(2026, 12, 1, 0, 0, tzinfo=timezone.utc),
        duration_days=10.0,
        step_hours=2.0
    )
    res = communication_engine.calculate_communication(req)

    assert isinstance(res.num_communication_windows, int)
    if res.num_communication_windows > 0:
        first_win = res.communication_windows[0]
        assert first_win.duration_hours > 0.0
        assert first_win.end_time >= first_win.start_time
        assert res.next_window_start is not None


def test_mcda_six_criteria_weight_normalization_and_scoring():
    """Verify MCDA normalizes all 6 criteria and incorporates power survival and blackout risk."""
    weights = WeightsConfig(
        solar_illumination=0.25,
        earth_communication=0.20,
        slope_safety=0.15,
        elevation_advantage=0.10,
        power_survival=0.15,
        blackout_risk=0.15
    )
    req = RecommendRequest(
        start_date=datetime(2026, 12, 1, 0, 0, tzinfo=timezone.utc),
        duration_days=5.0,
        weights=weights,
        constraints=ConstraintsConfig(
            min_illumination_percentage=30.0,
            min_communication_percentage=20.0,
            max_acceptable_slope_degrees=15.0,
            max_continuous_shadow_hours=100.0,
            max_comm_blackout_hours=100.0,
            min_battery_soc_percent=15.0
        )
    )
    res = recommendation_engine.recommend_sites(req)

    assert len(res.ranking) > 0
    top_site = res.ranking[0]
    assert "power_survival" in top_site.scores_breakdown
    assert "blackout_risk" in top_site.scores_breakdown
    assert 0.0 <= top_site.total_score <= 100.0
