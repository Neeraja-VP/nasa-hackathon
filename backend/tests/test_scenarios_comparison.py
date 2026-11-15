"""
Automated Test Suite for Advanced Multi-Scenario Comparison & Custom Landing Coordinates.

Validates:
1. Custom coordinate validation (valid ranges, out-of-range rejection, LOLA DEM sampling).
2. Mode A: Different sites on the same date.
3. Mode B: Same site across different landing dates (seasonal/libration cycles).
4. Mode C: Independent matrix of different sites and different dates.
5. Scenario isolation: Independent battery, solar array, and load configurations.
6. Completeness of all 12 comparison metrics required by TASK 4.
7. Scenario constraints (minimum 2, maximum 8).
"""

from datetime import datetime, timezone, timedelta
import pytest

from app.schemas.sites import CustomSiteRequest, SiteSchema
from app.api.v1.endpoints.sites import create_custom_site
from app.core.sites_catalog import get_site_by_id, clear_custom_sites
from app.schemas.compare import (
    ScenarioConfig,
    MultiScenarioCompareRequest,
    MultiScenarioCompareResponse
)
from app.engines.recommendation.engine import recommendation_engine


@pytest.fixture(autouse=True)
def clean_custom_sites():
    clear_custom_sites()
    yield
    clear_custom_sites()


def test_custom_coordinate_validation_success():
    """Verify custom landing coordinate creation, DEM sampling, and catalog registration."""
    req = CustomSiteRequest(
        name="Amundsen Peak Alpha",
        latitude=-88.45,
        longitude=135.20,
        elevation_m=None,  # Should be auto-sampled from LOLA DEM
        observer_height_m=2.5,
        description="Candidate high-altitude peak near Amundsen crater"
    )
    site = create_custom_site(req)
    
    assert isinstance(site, SiteSchema)
    assert site.id.startswith("custom-")
    assert site.name == "Amundsen Peak Alpha"
    assert site.latitude == -88.45
    assert site.longitude == 135.20
    assert site.elevation_m is not None
    assert site.slope_degrees is not None
    assert site.is_custom is True
    assert site.observer_height_m == 2.5
    assert "South Pole" in site.region

    # Verify site is retrievable via get_site_by_id
    retrieved = get_site_by_id(site.id)
    assert retrieved is not None
    assert retrieved.name == "Amundsen Peak Alpha"


def test_custom_coordinate_validation_rejection():
    """Verify rejection of invalid latitude and coordinate values."""
    from pydantic import ValidationError

    # Latitude > 90° rejected by Pydantic schema validation
    with pytest.raises(ValidationError):
        CustomSiteRequest(
            name="Invalid Lat North",
            latitude=95.0,
            longitude=100.0
        )

    # Latitude < -90° rejected by Pydantic schema validation
    with pytest.raises(ValidationError):
        CustomSiteRequest(
            name="Invalid Lat South",
            latitude=-92.0,
            longitude=100.0
        )


def test_mode_a_different_sites_same_date():
    """
    Mode A: Compare different landing sites at the exact same landing epoch.
    Verifies comparative ranking and metric discrimination.
    """
    epoch = datetime(2026, 12, 1, 0, 0, tzinfo=timezone.utc)
    scenarios = [
        ScenarioConfig(
            id="sc-a1",
            name="Shackleton Rim (Mode A)",
            site_id="shackleton-rim",
            latitude=-89.78,
            longitude=125.0,
            start_date=epoch,
            duration_days=3.0,
            step_hours=3.0
        ),
        ScenarioConfig(
            id="sc-a2",
            name="Connecting Ridge (Mode A)",
            site_id="connecting-ridge",
            latitude=-89.44,
            longitude=222.5,
            start_date=epoch,
            duration_days=3.0,
            step_hours=3.0
        ),
        ScenarioConfig(
            id="sc-a3",
            name="Malapert Mountain (Mode A)",
            site_id="malapert-mountain",
            latitude=-85.99,
            longitude=2.91,
            start_date=epoch,
            duration_days=3.0,
            step_hours=3.0
        )
    ]
    req = MultiScenarioCompareRequest(
        mode="DIFFERENT_SITES_SAME_DATE",
        scenarios=scenarios
    )
    res = recommendation_engine.compare_scenarios(req)

    assert isinstance(res, MultiScenarioCompareResponse)
    assert res.total_scenarios == 3
    assert len(res.scenarios) == 3
    assert res.scenarios[0].rank == 1
    assert res.scenarios[1].rank == 2
    assert res.scenarios[2].rank == 3
    # Check that scores are ordered descending
    assert res.scenarios[0].overall_suitability_score >= res.scenarios[1].overall_suitability_score >= res.scenarios[2].overall_suitability_score
    assert res.summary.best_overall_scenario_id in ["sc-a1", "sc-a2", "sc-a3"]


def test_mode_b_same_site_different_dates():
    """
    Mode B: Compare the same landing site across different mission epochs (seasonal/libration trade-off).
    """
    site_id = "shackleton-rim"
    scenarios = [
        ScenarioConfig(
            id="sc-b1",
            name="Shackleton Dec 01 Window",
            site_id=site_id,
            latitude=-89.78,
            longitude=125.0,
            start_date=datetime(2026, 12, 1, 0, 0, tzinfo=timezone.utc),
            duration_days=3.0,
            step_hours=3.0
        ),
        ScenarioConfig(
            id="sc-b2",
            name="Shackleton Dec 15 Solstice",
            site_id=site_id,
            latitude=-89.78,
            longitude=125.0,
            start_date=datetime(2026, 12, 15, 0, 0, tzinfo=timezone.utc),
            duration_days=3.0,
            step_hours=3.0
        ),
        ScenarioConfig(
            id="sc-b3",
            name="Shackleton Jan 01 Late Window",
            site_id=site_id,
            latitude=-89.78,
            longitude=125.0,
            start_date=datetime(2027, 1, 1, 0, 0, tzinfo=timezone.utc),
            duration_days=3.0,
            step_hours=3.0
        )
    ]
    req = MultiScenarioCompareRequest(
        mode="SAME_SITE_DIFFERENT_DATES",
        scenarios=scenarios
    )
    res = recommendation_engine.compare_scenarios(req)

    assert res.total_scenarios == 3
    # All scenarios share same coordinates but have different start dates
    for sc in res.scenarios:
        assert sc.latitude == -89.78
        assert sc.longitude == 125.0
    # Start dates must be distinct
    dates = [sc.start_date for sc in res.scenarios]
    assert len(set(dates)) == 3


def test_mode_c_different_sites_and_dates_matrix():
    """
    Mode C: Completely independent matrix comparing different sites, custom coords, and distinct dates.
    """
    scenarios = [
        ScenarioConfig(
            id="sc-c1",
            name="Shackleton Baseline Dec 1",
            site_id="shackleton-rim",
            latitude=-89.78,
            longitude=125.0,
            start_date=datetime(2026, 12, 1, 0, 0, tzinfo=timezone.utc),
            duration_days=3.0,
            step_hours=3.0,
            battery_capacity_wh=5000.0
        ),
        ScenarioConfig(
            id="sc-c2",
            name="Connecting Ridge Dec 10",
            site_id="connecting-ridge",
            latitude=-89.44,
            longitude=222.5,
            start_date=datetime(2026, 12, 10, 0, 0, tzinfo=timezone.utc),
            duration_days=3.0,
            step_hours=3.0,
            battery_capacity_wh=8000.0
        ),
        ScenarioConfig(
            id="sc-c3",
            name="Custom Ridge Alpha Dec 20",
            latitude=-88.50,
            longitude=135.0,
            elevation_m=1100.0,
            start_date=datetime(2026, 12, 20, 0, 0, tzinfo=timezone.utc),
            duration_days=3.0,
            step_hours=3.0,
            battery_capacity_wh=6000.0
        )
    ]
    req = MultiScenarioCompareRequest(
        mode="DIFFERENT_SITES_AND_DATES",
        scenarios=scenarios
    )
    res = recommendation_engine.compare_scenarios(req)

    assert res.total_scenarios == 3
    assert len(res.summary.key_findings) >= 2


def test_scenario_isolation():
    """
    Verify scenario isolation: Each scenario's battery capacity and load parameters
    directly affect only that scenario's results, not others.
    """
    epoch = datetime(2026, 12, 1, 0, 0, tzinfo=timezone.utc)
    scenarios = [
        # Scenario 1: Nominal battery capacity
        ScenarioConfig(
            id="sc-iso-nominal",
            name="Nominal Battery 5000Wh",
            site_id="connecting-ridge",
            latitude=-89.44,
            longitude=222.5,
            start_date=epoch,
            duration_days=2.0,
            step_hours=2.0,
            solar_array_area_m2=4.5,
            battery_capacity_wh=5000.0,
            min_safe_soc_percent=20.0
        ),
        # Scenario 2: Severe power deficit (load exceeds generation, small battery depletes)
        ScenarioConfig(
            id="sc-iso-depleted",
            name="Undersized Battery Deficit",
            site_id="connecting-ridge",
            latitude=-89.44,
            longitude=222.5,
            start_date=epoch,
            duration_days=2.0,
            step_hours=2.0,
            solar_array_area_m2=0.2,
            battery_capacity_wh=300.0,
            base_hotel_load_w=400.0,
            payload_active_load_w=100.0,
            survival_heater_load_w=200.0,
            min_safe_soc_percent=20.0
        )
    ]
    req = MultiScenarioCompareRequest(
        mode="DIFFERENT_SITES_SAME_DATE",
        scenarios=scenarios
    )
    res = recommendation_engine.compare_scenarios(req)

    nominal_sc = next(s for s in res.scenarios if s.id == "sc-iso-nominal")
    depleted_sc = next(s for s in res.scenarios if s.id == "sc-iso-depleted")

    # Scenario 1 must survive nominally
    assert nominal_sc.battery_depleted is False
    assert nominal_sc.power_survival_status in ["NOMINAL", "SURVIVED_WITH_MARGIN"]

    # Scenario 2 must register depletion and lower score
    assert depleted_sc.battery_depleted is True
    assert depleted_sc.power_survival_status == "BATTERY_DEPLETED"
    assert depleted_sc.overall_suitability_score < nominal_sc.overall_suitability_score


def test_comparison_metrics_completeness():
    """
    Verify that every scenario contains all 12 comparison metrics required by TASK 4.
    """
    epoch = datetime(2026, 12, 1, 0, 0, tzinfo=timezone.utc)
    scenarios = [
        ScenarioConfig(
            id="sc-m1",
            name="Shackleton Validation",
            site_id="shackleton-rim",
            latitude=-89.78,
            longitude=125.0,
            start_date=epoch,
            duration_days=2.0,
            step_hours=2.0
        ),
        ScenarioConfig(
            id="sc-m2",
            name="Connecting Ridge Validation",
            site_id="connecting-ridge",
            latitude=-89.44,
            longitude=222.5,
            start_date=epoch,
            duration_days=2.0,
            step_hours=2.0
        )
    ]
    req = MultiScenarioCompareRequest(scenarios=scenarios)
    res = recommendation_engine.compare_scenarios(req)

    for sc in res.scenarios:
        # 1. Solar elevation
        assert -90.0 <= sc.mean_sun_elevation_deg <= 90.0
        assert -90.0 <= sc.max_sun_elevation_deg <= 90.0
        # 2. Total sunlight duration
        assert sc.total_sunlit_hours >= 0.0
        # 3. Total darkness duration
        assert sc.total_darkness_hours >= 0.0
        # 4. Longest continuous sunlight
        assert sc.longest_sunlight_hours >= 0.0
        # 5. Longest continuous darkness
        assert sc.longest_darkness_hours >= 0.0
        # 6. Earth visibility duration
        assert sc.earth_visibility_hours >= 0.0
        # 7. Longest communication blackout
        assert sc.longest_comm_blackout_hours >= 0.0
        # 8. Number of communication windows
        assert sc.comm_windows_count >= 0
        # 9. Minimum battery state of charge
        assert 0.0 <= sc.min_battery_soc_percent <= 100.0
        # 10. Total generated solar energy
        assert sc.total_energy_generated_kwh >= 0.0
        # 11. Power survival status
        assert sc.power_survival_status in ["NOMINAL", "SURVIVED_WITH_MARGIN", "DEGRADED_MARGIN", "BATTERY_DEPLETED"]
        # 12. Overall mission suitability score
        assert 0.0 <= sc.overall_suitability_score <= 100.0
        # Timeline for visual charts
        assert len(sc.timeline) > 0


def test_scenario_count_constraints():
    """Verify that requests with fewer than 2 or more than 8 scenarios fail validation."""
    from pydantic import ValidationError

    epoch = datetime(2026, 12, 1, 0, 0, tzinfo=timezone.utc)
    sc = ScenarioConfig(
        id="sc-single",
        name="Single Scenario",
        site_id="shackleton-rim",
        latitude=-89.78,
        longitude=125.0,
        start_date=epoch
    )

    # Fewer than 2 scenarios
    with pytest.raises(ValidationError):
        MultiScenarioCompareRequest(scenarios=[sc])

    # More than 8 scenarios
    scenarios_9 = [
        ScenarioConfig(
            id=f"sc-{i}",
            name=f"Scenario {i}",
            site_id="shackleton-rim",
            latitude=-89.78,
            longitude=125.0,
            start_date=epoch
        )
        for i in range(9)
    ]
    with pytest.raises(ValidationError):
        MultiScenarioCompareRequest(scenarios=scenarios_9)
