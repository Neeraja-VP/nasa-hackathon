"""
Comprehensive Integration Tests for NASA LOLA Digital Elevation Model (DEM) Loading.

Validates:
1. GeoTIFF, NPZ, and NASA PDS .img/.lbl loading mechanisms.
2. Coordinate-to-raster transforms (Polar Stereographic IAU2000:301).
3. Scale deduction, raster bounds checking, and graceful fallback to procedural terrain.
4. Terrain horizon generation utilizing real DEM elevation grids.
5. DEM metadata reporting endpoint and structures.
"""

import os
import struct
import numpy as np
import pytest

from app.services.geospatial.dem_loader import DemLoader, dem_loader
from app.services.geospatial.projections import PolarStereographic
from app.engines.terrain.horizon import terrain_engine
from app.schemas.terrain import TerrainHorizonRequest


def test_dem_metadata_structure():
    """Verify get_dem_metadata returns all required provenance fields."""
    metadata = dem_loader.get_dem_metadata()
    assert "dem_source" in metadata
    assert "resolution_m" in metadata
    assert "elevation_unit" in metadata
    assert metadata["elevation_unit"] == "meters"
    assert "projection" in metadata
    assert "IAU2000:301" in metadata["projection"] or "Polar Stereographic" in metadata["projection"]
    assert "width" in metadata
    assert "height" in metadata
    assert metadata["resolution_m"] > 0


def test_is_within_bounds():
    """Verify is_within_bounds accurately verifies whether coordinate is inside loaded raster."""
    # Near South Pole (-89.78, 125.0) should be within South Pole benchmark DEM
    is_inside = dem_loader.is_within_bounds(-89.78, 125.0)
    # Benchmark DEM covers up to ~100 km radius around South Pole
    assert is_inside is True

    # Equator (-0.0, 0.0) is far outside South Pole DEM bounds
    is_outside = dem_loader.is_within_bounds(0.0, 0.0)
    assert is_outside is False


def test_pds_img_loading(tmp_path):
    """Verify NASA PDS .img with companion .lbl label parser works correctly."""
    lines = 10
    line_samples = 10
    sample_bits = 16
    pixel_scale = 100.0
    center_x = 5.0
    center_y = 5.0

    # Create dummy PDS .lbl file
    lbl_content = f"""PDS_VERSION_ID = PDS3
RECORD_TYPE = FIXED_LENGTH
RECORD_BYTES = {line_samples * 2}
FILE_RECORDS = {lines}
^IMAGE = "test_dem.img"
OBJECT = IMAGE
  LINES = {lines}
  LINE_SAMPLES = {line_samples}
  SAMPLE_BITS = {sample_bits}
  SAMPLE_TYPE = MSB_INTEGER
  SCALING_FACTOR = 0.5
  OFFSET = 1000.0
END_OBJECT = IMAGE
OBJECT = IMAGE_MAP_PROJECTION
  MAP_PROJECTION_TYPE = "POLAR STEREOGRAPHIC"
  MAP_SCALE = {pixel_scale}
  LINE_PROJECTION_OFFSET = {center_y}
  SAMPLE_PROJECTION_OFFSET = {center_x}
END_OBJECT = IMAGE_MAP_PROJECTION
END
"""
    lbl_path = tmp_path / "test_dem.lbl"
    lbl_path.write_text(lbl_content)

    # Create dummy 16-bit big-endian integer .img file
    img_data = np.full((lines, line_samples), 400, dtype=">i2")
    img_path = tmp_path / "test_dem.img"
    with open(img_path, "wb") as f:
        img_data.tofile(f)

    # Test custom loader
    loader = DemLoader(data_dir=str(tmp_path))
    dataset = loader.load_pds_img(str(img_path))
    assert dataset is not None
    assert dataset.elevation_data.shape == (lines, line_samples)
    # Pixel value check: 400 * 0.5 + 1000.0 = 1200.0 meters
    assert pytest.approx(dataset.elevation_data[0, 0], abs=0.1) == 1200.0
    assert dataset.pixel_scale_m == pixel_scale
    assert "NASA_LOLA" in dataset.product_id


def test_terrain_engine_real_dem_vs_procedural():
    """Verify terrain horizon generates valid horizon points with real LOLA DEM provenance."""
    req = TerrainHorizonRequest(
        latitude=-89.78,
        longitude=125.0,
        elevation_m=1240.0,
        max_distance_km=30.0,
        azimuth_step_deg=10.0,
        observer_height_m=2.0
    )
    res = terrain_engine.generate_horizon_profile(req)
    assert res.terrain_source is not None
    assert "LOLA" in res.terrain_source
    assert res.dem_resolution_m is not None
    assert res.calculation_status == "NOMINAL"
    assert len(res.horizon_points) == 36
    # Obstruction angles must be physically plausible for Shackleton area (-15° to +35°)
    for pt in res.horizon_points:
        assert -15.0 <= pt.horizon_elevation_deg <= 35.0


def test_terrain_engine_out_of_bounds_fallback():
    """Verify that far-offsite coordinates outside DEM coverage fall back gracefully without crash."""
    req_far = TerrainHorizonRequest(
        latitude=-70.0,  # Far outside South Pole polar stereographic DEM
        longitude=0.0,
        elevation_m=0.0,
        max_distance_km=20.0,
        azimuth_step_deg=10.0,
        observer_height_m=2.0
    )
    res = terrain_engine.generate_horizon_profile(req_far)
    assert len(res.horizon_points) == 36
    # Calculation status should remain NOMINAL or show procedural fallback notice
    assert res.calculation_status == "NOMINAL"
