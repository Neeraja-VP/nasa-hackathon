"""
LUNA NAVIGATOR — Terrain Horizon Ray-Tracing Engine Unit Tests (Member 3 Ownership)
Tests 360-degree radial ray tracing, lunar curvature drop, observer mast height dynamics,
and solar/Earth line-of-sight obstruction criteria.
"""

import math
import pytest
from app.core.constants import (
    MOON_MEAN_RADIUS_M,
    SOLAR_ANGULAR_RADIUS_DEG,
    EARTH_ANGULAR_RADIUS_LUNAR_SKY_DEG
)
from app.core.coordinates import lunar_curvature_drop
from app.schemas.terrain import TerrainHorizonRequest, TerrainHorizonResponse
from app.engines.terrain.horizon import terrain_engine
from app.services.geospatial.ray_tracer import ray_tracer


def test_lunar_curvature_drop_benchmark():
    """Verify lunar spherical curvature drop formula: Delta_h = s^2 / (2 * R_moon)."""
    # At 30 km ground distance, drop should be ~259.01 meters
    drop_30km = lunar_curvature_drop(30000.0)
    expected_drop_30km = (30000.0 ** 2) / (2.0 * MOON_MEAN_RADIUS_M)
    assert abs(drop_30km - 259.01) < 0.1
    assert abs(drop_30km - expected_drop_30km) < 1e-6

    # At 10 km ground distance: ~28.78 meters
    drop_10km = lunar_curvature_drop(10000.0)
    assert abs(drop_10km - 28.78) < 0.1


def test_ray_tracer_single_ray():
    """Verify single ray ray-tracing yields valid obstruction parameters."""
    point = ray_tracer.compute_horizon_point(
        lat_deg=-89.78,
        lon_deg=125.0,
        obs_total_elev_m=1242.0,  # 1240m ground + 2m mast
        azimuth_deg=45.0,
        max_dist_m=50000.0,
        radial_step_m=250.0
    )
    assert point.azimuth_deg == 45.0
    assert -2.0 <= point.horizon_elevation_deg <= 6.0
    assert point.obstruction_distance_km >= 0.1
    assert len(point.blocking_feature) > 0


def test_horizon_profile_azimuth_steps():
    """Verify correct number of horizon points for different sampling steps."""
    # 10 degree step -> 36 points
    req_10 = TerrainHorizonRequest(
        latitude=-89.78,
        longitude=125.0,
        elevation_m=1240.0,
        max_distance_km=40.0,
        azimuth_step_deg=10.0,
        observer_height_m=2.0
    )
    res_10 = terrain_engine.generate_horizon_profile(req_10)
    assert len(res_10.horizon_points) == 36
    assert res_10.horizon_points[0].azimuth_deg == 0.0
    assert res_10.horizon_points[-1].azimuth_deg == 350.0

    # 5 degree step -> 72 points
    req_5 = TerrainHorizonRequest(
        latitude=-89.78,
        longitude=125.0,
        elevation_m=1240.0,
        max_distance_km=40.0,
        azimuth_step_deg=5.0,
        observer_height_m=2.0
    )
    res_5 = terrain_engine.generate_horizon_profile(req_5)
    assert len(res_5.horizon_points) == 72


def test_observer_mast_height_benefit():
    """Verify that raising observer mast height reduces or keeps horizon obstruction angles."""
    req_low = TerrainHorizonRequest(
        latitude=-89.78,
        longitude=125.0,
        elevation_m=1240.0,
        max_distance_km=30.0,
        azimuth_step_deg=10.0,
        observer_height_m=1.0  # 1 meter mast (e.g. rover deck)
    )
    res_low = terrain_engine.generate_horizon_profile(req_low)

    req_high = TerrainHorizonRequest(
        latitude=-89.78,
        longitude=125.0,
        elevation_m=1240.0,
        max_distance_km=30.0,
        azimuth_step_deg=10.0,
        observer_height_m=20.0  # 20 meter mast (e.g. tall solar tower)
    )
    res_high = terrain_engine.generate_horizon_profile(req_high)

    # Average horizon elevation for 20m mast must be lower than for 1m mast
    assert res_high.average_horizon_elevation_deg <= res_low.average_horizon_elevation_deg
    assert res_high.max_horizon_elevation_deg <= res_low.max_horizon_elevation_deg


def test_horizon_elevation_interpolation():
    """Verify linear interpolation of horizon elevation between discrete points."""
    req = TerrainHorizonRequest(
        latitude=-89.44,
        longitude=222.5,
        elevation_m=820.0,
        max_distance_km=30.0,
        azimuth_step_deg=10.0,
        observer_height_m=2.0
    )
    res = terrain_engine.generate_horizon_profile(req)
    
    el_0 = terrain_engine.get_horizon_elevation_at_azimuth(res, 0.0)
    el_10 = terrain_engine.get_horizon_elevation_at_azimuth(res, 10.0)
    el_5 = terrain_engine.get_horizon_elevation_at_azimuth(res, 5.0)

    # Interpolated midpoint should be exactly the average of endpoints
    expected_mid = round((el_0 + el_10) / 2.0, 2)
    assert abs(el_5 - expected_mid) <= 0.02


def test_solar_visibility_classification():
    """Verify solar visibility classification (DIRECT_SUNLIGHT, PENUMBRA, UMBRA_SHADOW)."""
    req = TerrainHorizonRequest(
        latitude=-89.78,
        longitude=125.0,
        elevation_m=1240.0,
        max_distance_km=30.0,
        azimuth_step_deg=10.0,
        observer_height_m=2.0
    )
    res = terrain_engine.generate_horizon_profile(req)
    horizon_at_90 = terrain_engine.get_horizon_elevation_at_azimuth(res, 90.0)

    # 1. Sun well above horizon: DIRECT_SUNLIGHT
    sun_direct = terrain_engine.calculate_solar_visibility(
        horizon_response=res,
        sun_azimuth_deg=90.0,
        sun_elevation_deg=horizon_at_90 + 2.0
    )
    assert sun_direct["status"] == "DIRECT_SUNLIGHT"
    assert sun_direct["is_sunlit"] is True
    assert sun_direct["is_fully_sunlit"] is True

    # 2. Sun grazing horizon (within angular semi-diameter ~0.2667°): PENUMBRA
    sun_penumbra = terrain_engine.calculate_solar_visibility(
        horizon_response=res,
        sun_azimuth_deg=90.0,
        sun_elevation_deg=horizon_at_90
    )
    assert sun_penumbra["status"] == "PENUMBRA"
    assert sun_penumbra["is_sunlit"] is True
    assert sun_penumbra["is_fully_sunlit"] is False

    # 3. Sun well below horizon: UMBRA_SHADOW
    sun_umbra = terrain_engine.calculate_solar_visibility(
        horizon_response=res,
        sun_azimuth_deg=90.0,
        sun_elevation_deg=horizon_at_90 - 2.0
    )
    assert sun_umbra["status"] == "UMBRA_SHADOW"
    assert sun_umbra["is_sunlit"] is False
    assert sun_umbra["is_fully_sunlit"] is False


def test_earth_visibility_classification():
    """Verify Earth communication line-of-sight classification."""
    req = TerrainHorizonRequest(
        latitude=-85.99,
        longitude=2.91,
        elevation_m=5050.0,  # Malapert Mountain
        max_distance_km=30.0,
        azimuth_step_deg=10.0,
        observer_height_m=2.0
    )
    res = terrain_engine.generate_horizon_profile(req)
    horizon_at_0 = terrain_engine.get_horizon_elevation_at_azimuth(res, 0.0)

    # 1. Earth high in sky above horizon and min cutoff: DIRECT_LINE_OF_SIGHT
    earth_visible = terrain_engine.calculate_earth_visibility(
        horizon_response=res,
        earth_azimuth_deg=0.0,
        earth_elevation_deg=max(horizon_at_0, 1.0) + 3.0,
        min_comm_elevation_deg=1.0
    )
    assert earth_visible["link_status"] == "DIRECT_LINE_OF_SIGHT"
    assert earth_visible["is_visible"] is True

    # 2. Earth below terrain horizon: TERRAIN_BLOCKED
    earth_blocked = terrain_engine.calculate_earth_visibility(
        horizon_response=res,
        earth_azimuth_deg=0.0,
        earth_elevation_deg=horizon_at_0 - 1.0,
        min_comm_elevation_deg=0.5
    )
    assert earth_blocked["link_status"] == "TERRAIN_BLOCKED"
    assert earth_blocked["is_visible"] is False

    # 3. Earth above terrain horizon but below instrument cutoff: BELOW_MIN_ELEVATION
    earth_low = terrain_engine.calculate_earth_visibility(
        horizon_response=res,
        earth_azimuth_deg=0.0,
        earth_elevation_deg=horizon_at_0 + 0.2,
        min_comm_elevation_deg=horizon_at_0 + 1.0
    )
    assert earth_low["link_status"] == "BELOW_MIN_ELEVATION"
    assert earth_low["is_visible"] is False


def test_terrain_horizon_provenance_and_metadata():
    """Verify that TerrainHorizonResponse includes data provenance, DEM resolution, and datum."""
    req = TerrainHorizonRequest(
        latitude=-89.78,
        longitude=125.0,
        elevation_m=1240.0,
        max_distance_km=20.0,
        azimuth_step_deg=10.0,
        observer_height_m=2.0
    )
    res = terrain_engine.generate_horizon_profile(req)
    assert res.terrain_data_source is not None
    assert "NASA LOLA" in res.terrain_data_source or "PROCEDURAL" in res.terrain_data_source
    assert res.dem_resolution_m > 0.0 or res.is_procedural_fallback is True
    assert "R=1737.4 km" in res.elevation_datum


def test_dem_loader_procedural_fallback():
    """Verify that when no raster DEM is loaded, DemLoader gracefully uses procedural fallback."""
    from app.services.geospatial.dem_loader import dem_loader
    original_dataset = dem_loader.active_dataset
    try:
        dem_loader.active_dataset = None
        meta = dem_loader.get_metadata()
        assert meta["is_procedural_fallback"] is True
        assert meta["terrain_data_source"] == "PROCEDURAL LOLA TOPOGRAPHY FALLBACK"
        assert meta["data_quality_warning"] is not None
        
        # Test elevation sampling in procedural mode
        elev = dem_loader.sample_elevation(-89.78, 125.0)
        assert abs(elev - 1240.0) < 5.0
    finally:
        dem_loader.active_dataset = original_dataset


def test_dem_loader_geotiff_loading():
    """Verify loading real LOLA GeoTIFF raster file."""
    import os
    from app.services.geospatial.dem_loader import dem_loader
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "datasets", "dem"))
    tif_path = os.path.join(base_dir, "lola_south_pole_benchmark.tif")
    if os.path.isfile(tif_path):
        ds = dem_loader.load_geotiff(tif_path)
        assert ds.width == 251
        assert ds.height == 251
        assert ds.pixel_scale_m == 1200.0
        assert "TIFF" in ds.product_id
