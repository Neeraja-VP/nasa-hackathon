"""
Unit Tests for Ephemeris Validation against NASA JPL Horizons DE440
Tests that analytical calculations accurately match NASA JPL Horizons ground-truth records.
"""

import pytest
from app.engines.ephemeris.engine import ephemeris_engine
from app.services.horizons_benchmarks import JPL_HORIZONS_DE440_BENCHMARKS


@pytest.mark.parametrize("epoch_iso", [
    "2026-12-01T00:00:00Z",
    "2026-12-05T00:00:00Z",
    "2026-12-10T00:00:00Z",
    "2026-12-15T00:00:00Z"
])
def test_shackleton_ephemeris_accuracy_vs_horizons(epoch_iso):
    """
    Assert analytical ephemeris for Shackleton Rim stays within tolerance
    when compared directly with NASA JPL Horizons DE440 planetary ephemeris.
    """
    res = ephemeris_engine.validate_site_ephemeris(
        site_id="shackleton-rim",
        epoch_iso=epoch_iso
    )
    assert res.is_validated is True
    assert res.residuals is not None
    # Solar Azimuth is accurate to < 0.25°
    assert res.residuals.delta_sun_azimuth_deg <= 0.25
    # Solar Elevation is accurate to < 0.25°
    assert res.residuals.delta_sun_elevation_deg <= 0.25
    # Earth libration residual within planetary modeling tolerance
    assert res.residuals.delta_earth_elevation_deg <= 2.50
    assert res.residuals.max_residual_deg <= 3.50


def test_unknown_site_validation_handling():
    res = ephemeris_engine.validate_site_ephemeris(
        site_id="non-existent-site-xyz",
        epoch_iso="2026-12-01T00:00:00Z"
    )
    assert res.is_validated is False
    assert "No pre-compiled JPL Horizons" in (res.message or "")
