"""
LUNA NAVIGATOR — Full System End-to-End Integration Tests (Member 4 Ownership)
Validates seamless data pipeline across Frontend contracts, Ephemeris (Member 2),
GIS/Terrain (Member 3), and AI/MCDA/EPS Simulation (Member 4).
"""

from datetime import datetime, timezone
import pytest
from app.core.sites_catalog import load_candidate_sites, get_site_by_id
from app.engines.ephemeris.engine import ephemeris_engine
from app.engines.terrain.horizon import terrain_engine
from app.engines.illumination.engine import illumination_engine
from app.engines.communication.engine import communication_engine
from app.engines.recommendation.engine import recommendation_engine
from app.engines.simulation.engine import simulation_engine
from app.engines.assistant.engine import assistant_engine

from app.schemas.ephemeris import EphemerisRequest
from app.schemas.terrain import TerrainHorizonRequest
from app.schemas.illumination import IlluminationRequest
from app.schemas.communication import CommunicationRequest
from app.schemas.recommend import RecommendRequest, WeightsConfig, ConstraintsConfig
from app.schemas.simulation import SimulationRequest
from app.schemas.assistant import AssistantQueryRequest


def test_end_to_end_scientific_pipeline_shackleton():
    """
    Test complete data flow for Shackleton Crater Rim across all 4 member subsystems:
    Catalog -> Ephemeris -> Terrain -> Illumination -> Comm -> MCDA -> Simulation -> Assistant.
    """
    epoch = datetime(2026, 12, 1, 0, 0, 0, tzinfo=timezone.utc)
    duration_days = 7.0
    step_hours = 2.0

    # 1. Catalog Lookup
    shackleton = get_site_by_id("shackleton-rim")
    assert shackleton is not None
    assert shackleton.elevation_m == 1240.0
    assert shackleton.slope_degrees == 8.5

    # 2. Ephemeris Topocentric Positions (Member 2)
    eph_req = EphemerisRequest(
        latitude=shackleton.latitude,
        longitude=shackleton.longitude,
        elevation_m=shackleton.elevation_m,
        start_date=epoch,
        duration_days=duration_days,
        step_hours=step_hours
    )
    eph_res = ephemeris_engine.calculate_ephemeris_series(eph_req)
    assert len(eph_res.time_series) == int((duration_days * 24.0) / step_hours) + 1
    assert eph_res.time_series[0].sun_azimuth_deg >= 0.0

    # 3. LOLA Terrain Horizon Ray Tracing (Member 3)
    terr_req = TerrainHorizonRequest(
        latitude=shackleton.latitude,
        longitude=shackleton.longitude,
        elevation_m=shackleton.elevation_m,
        max_distance_km=40.0,
        azimuth_step_deg=10.0,
        observer_height_m=2.0
    )
    terr_res = terrain_engine.generate_horizon_profile(terr_req)
    assert len(terr_res.horizon_points) == 36
    assert terr_res.max_horizon_elevation_deg > terr_res.min_horizon_elevation_deg

    # 4. Solar Illumination with Terrain Mask (Joint Member 2 & 3)
    illum_req = IlluminationRequest(
        latitude=shackleton.latitude,
        longitude=shackleton.longitude,
        elevation_m=shackleton.elevation_m,
        start_date=epoch,
        duration_days=duration_days,
        step_hours=step_hours,
        use_terrain_horizon=True
    )
    illum_res = illumination_engine.calculate_illumination(illum_req)
    assert 0.0 <= illum_res.illumination_percentage <= 100.0
    assert illum_res.total_sunlit_hours + illum_res.total_shadow_hours > 0

    # 5. Earth Communication with Terrain Mask (Joint Member 2 & 3)
    comm_req = CommunicationRequest(
        latitude=shackleton.latitude,
        longitude=shackleton.longitude,
        elevation_m=shackleton.elevation_m,
        start_date=epoch,
        duration_days=duration_days,
        step_hours=step_hours,
        use_terrain_horizon=True
    )
    comm_res = communication_engine.calculate_communication(comm_req)
    assert 0.0 <= comm_res.communication_availability_percentage <= 100.0

    # 6. MCDA Ranking & Explainability (Member 4)
    rec_req = RecommendRequest(
        start_date=epoch,
        duration_days=duration_days,
        step_hours=step_hours,
        weights=WeightsConfig(solar_illumination=0.4, earth_communication=0.3, slope_safety=0.2, elevation_advantage=0.1),
        constraints=ConstraintsConfig(
            min_illumination_percentage=0.0,
            min_communication_percentage=0.0,
            min_battery_soc_percent=0.0,
            max_continuous_shadow_hours=500.0
        )
    )
    rec_res = recommendation_engine.recommend_sites(rec_req)
    assert len(rec_res.ranking) > 0
    shackleton_ranked = next((r for r in rec_res.ranking if r.site_id == "shackleton-rim"), None)
    assert shackleton_ranked is not None
    assert shackleton_ranked.total_score > 0.0
    assert len(shackleton_ranked.key_strengths) > 0
    assert "NASA" in shackleton_ranked.safety_disclaimer

    # 7. EPS Mission Power Simulation (Member 4)
    sim_req = SimulationRequest(
        site_id="shackleton-rim",
        start_date=epoch,
        duration_days=duration_days,
        step_hours=step_hours,
        solar_array_area_m2=4.5,
        battery_capacity_wh=5000.0
    )
    sim_res = simulation_engine.simulate_mission_power(sim_req)
    assert sim_res.total_energy_generated_kwh >= 0.0
    assert sim_res.eps_health_status in ("NOMINAL", "DEGRADED_MARGIN", "CRITICAL_DEPLETION")

    # 8. AI Mission Assistant Synthesis (Member 4)
    assist_req = AssistantQueryRequest(
        query="Explain why Shackleton Rim is viable for Artemis surface power and what are its risks",
        site_id="shackleton-rim",
        start_date=epoch,
        duration_days=duration_days,
        step_hours=step_hours
    )
    assist_res = assistant_engine.process_query(assist_req)
    assert assist_res.focused_site_id == "shackleton-rim"
    assert "Shackleton" in assist_res.detailed_analysis
    assert "NASA" in assist_res.safety_disclaimer
    assert "NOT constitute NASA certification" in assist_res.safety_disclaimer
