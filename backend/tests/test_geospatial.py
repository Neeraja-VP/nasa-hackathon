"""
LUNA NAVIGATOR — Geospatial Services & Projections Unit Tests (Member 3 Ownership)
Tests Polar Stereographic conversions, geodesic ray sampling, DEM loading, and terrain slope calculations.
"""

import math
import pytest
from app.core.constants import MOON_MEAN_RADIUS_M
from app.services.geospatial.projections import PolarStereographic, forward_geodesic
from app.services.geospatial.dem_loader import dem_loader, CANDIDATE_SITE_BENCHMARKS
from app.services.geospatial.dem_downloader import PDS_LOLA_CATALOG


def test_polar_stereographic_pole_origin():
    """Verify that South Pole (-90°, 0°) maps to (0, 0) in Cartesian meters."""
    proj = PolarStereographic()
    x, y = proj.forward(-90.0, 0.0)
    assert abs(x) < 1e-3
    assert abs(y) < 1e-3

    lat, lon = proj.inverse(0.0, 0.0)
    assert abs(lat - (-90.0)) < 1e-4


def test_polar_stereographic_cardinal_points():
    """Verify cardinal longitude directions in polar stereographic projection."""
    proj = PolarStereographic()
    
    # 85°S, 0° Lon (Prime Meridian) -> should have X ~ 0, Y negative
    x0, y0 = proj.forward(-85.0, 0.0)
    assert abs(x0) < 1.0
    assert y0 < 0.0
    
    # 85°S, 90° Lon (East) -> should have X positive, Y ~ 0
    x90, y90 = proj.forward(-85.0, 90.0)
    assert x90 > 0.0
    assert abs(y90) < 1.0
    
    # 85°S, 180° Lon -> should have X ~ 0, Y positive
    x180, y180 = proj.forward(-85.0, 180.0)
    assert abs(x180) < 1.0
    assert y180 > 0.0
    
    # 85°S, 270° Lon -> should have X negative, Y ~ 0
    x270, y270 = proj.forward(-85.0, 270.0)
    assert x270 < 0.0
    assert abs(y270) < 1.0


def test_polar_stereographic_roundtrip():
    """Verify forward and inverse roundtrip across candidate sites."""
    proj = PolarStereographic()
    test_coords = [
        (-89.78, 125.0),
        (-89.44, 222.5),
        (-85.99, 2.91),
        (-88.52, 271.4),
        (-87.41, 355.2),
        (-85.25, 35.8),
        (-84.45, 85.5),
        (-85.40, 30.50),
    ]
    for orig_lat, orig_lon in test_coords:
        x, y = proj.forward(orig_lat, orig_lon)
        lat_back, lon_back = proj.inverse(x, y)
        assert abs(lat_back - orig_lat) < 1e-4, f"Lat mismatch for ({orig_lat}, {orig_lon})"
        assert abs(lon_back - orig_lon) < 1e-4, f"Lon mismatch for ({orig_lat}, {orig_lon})"


def test_pixel_to_latlon_roundtrip():
    """Verify raster pixel line/sample to lat/lon roundtrip."""
    proj = PolarStereographic()
    center_x = 200.0
    center_y = 200.0
    pixel_scale = 100.0  # 100 m/pixel
    
    lat = -89.78
    lon = 125.0
    px, py = proj.latlon_to_pixel(lat, lon, pixel_scale, center_x, center_y)
    lat_calc, lon_calc = proj.pixel_to_latlon(px, py, pixel_scale, center_x, center_y)
    
    assert abs(lat_calc - lat) < 1e-4
    assert abs(lon_calc - lon) < 1e-4


def test_forward_geodesic_due_north():
    """Verify that moving along azimuth 0° (North) increases latitude towards the equator."""
    start_lat = -89.0
    start_lon = 45.0
    distance_m = 10000.0  # 10 km
    
    dest_lat, dest_lon = forward_geodesic(start_lat, start_lon, azimuth_deg=0.0, distance_m=distance_m)
    assert dest_lat > start_lat
    # Expected latitude change: dist / R in degrees
    expected_dlat = math.degrees(distance_m / MOON_MEAN_RADIUS_M)
    assert abs((dest_lat - start_lat) - expected_dlat) < 0.001
    assert abs(dest_lon - start_lon) < 0.05


def test_candidate_sites_elevation_sampling():
    """Verify elevation sampling returns valid lunar elevations when NASA DEM is active, and preserves benchmark anchors in fallback mode."""
    # 1. Active DEM (genuine NASA LOLA or benchmark) returns valid physical elevations
    for site_id, benchmark in CANDIDATE_SITE_BENCHMARKS.items():
        sampled_h = dem_loader.sample_elevation(benchmark["latitude"], benchmark["longitude"])
        assert -9000.0 <= sampled_h <= 10000.0, f"Out of bounds elevation at {site_id}: {sampled_h}"

    # 2. Verify that benchmark mode strictly preserves ground-truth benchmark anchors
    saved_dataset = dem_loader.active_dataset
    try:
        dem_loader.active_dataset = None  # Benchmark / procedural mode
        for site_id, benchmark in CANDIDATE_SITE_BENCHMARKS.items():
            bench_h = dem_loader.sample_elevation(benchmark["latitude"], benchmark["longitude"])
            assert abs(bench_h - benchmark["elevation_m"]) < 1.0, f"Benchmark anchor mismatch at {site_id}: {bench_h} vs {benchmark['elevation_m']}"
    finally:
        dem_loader.active_dataset = saved_dataset


def test_dem_slope_calculation():
    """Verify surface slope gradient calculation produces realistic terrain slopes."""
    # Shackleton rim should have significant slope (8.5° nominal)
    shackleton_slope = dem_loader.calculate_surface_slope_deg(-89.78, 125.0)
    assert 2.0 <= shackleton_slope <= 25.0

    # Malapert mountain slope
    malapert_slope = dem_loader.calculate_surface_slope_deg(-85.99, 2.91)
    assert 2.0 <= malapert_slope <= 30.0


def test_pds_lola_catalog_structure():
    """Verify NASA PDS LOLA catalog contains standard polar GDR products."""
    assert "LDEM_80S_100M" in PDS_LOLA_CATALOG
    assert "LDEM_85S_20M" in PDS_LOLA_CATALOG
    assert "LDEM_875S_5M" in PDS_LOLA_CATALOG
    
    product_80s = PDS_LOLA_CATALOG["LDEM_80S_100M"]
    assert product_80s["resolution_m"] == 100.0
    assert "pds-geosciences.wustl.edu" in product_80s["url_img"]


def test_dem_three_tier_fallback_hierarchy():
    """
    Verify the strict three-tier degradation sequence:
    Tier 1: Genuine NASA LOLA PDS DEM (LDEM_80S_80M) -> 80 m/px
    Tier 2: Synthesized Benchmark DEM (NPZ) -> 1200 m/px
    Tier 3: Procedural Fallback -> 100 m/px (with benchmark anchor preservation)
    """
    orig_dataset = dem_loader.active_dataset
    try:
        # Tier 1: Genuine NASA LOLA DEM active
        meta1 = dem_loader.get_dem_metadata()
        assert meta1["dem_source"] == "NASA LOLA PDS DATA"
        assert meta1["resolution_m"] == 80.0

        # Tier 2: Benchmark NPZ
        dem_loader.active_dataset = dem_loader.load_npz("datasets/dem/lola_south_pole_benchmark.npz")
        meta2 = dem_loader.get_dem_metadata()
        assert meta2["dem_source"] == "BENCHMARK DEM DATA"
        assert meta2["resolution_m"] == 1200.0

        # Tier 3: Procedural Fallback
        dem_loader.active_dataset = None
        meta3 = dem_loader.get_dem_metadata()
        assert meta3["dem_source"] == "PROCEDURAL FALLBACK DATA"
        assert meta3["resolution_m"] == 100.0
        
        # Verify elevation calculation still succeeds in Tier 3
        elev_procedural = dem_loader.sample_elevation(-89.78, 125.0)
        assert abs(elev_procedural - 1240.0) < 1.0
    finally:
        dem_loader.active_dataset = orig_dataset

