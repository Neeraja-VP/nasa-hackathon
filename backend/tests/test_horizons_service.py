"""
Unit Tests for NASA JPL Horizons Client Service (Member 2)
Tests Horizons query creation, CSV response parsing, cache hits, and offline fallbacks.
"""

from datetime import datetime, timezone
import pytest
from app.services.horizons_client import JPLHorizonsClient, horizons_client


def test_horizons_cache_key_generation():
    client = JPLHorizonsClient()
    start = datetime(2026, 12, 1, 0, 0, tzinfo=timezone.utc)
    stop = datetime(2026, 12, 15, 0, 0, tzinfo=timezone.utc)
    key = client._build_cache_key("10", -89.78, 125.0, 1240.0, start, stop, 2.0)
    assert "10" in key
    assert "-89.78" in key
    assert "125.00" in key
    assert "2026-12-01" in key


def test_horizons_csv_parser():
    client = JPLHorizonsClient()
    mock_horizons_output = """
*******************************************************************************
 Revised: March 12, 2024             Sun / (Moon)                           10
*******************************************************************************
$$SOE
2026-Dec-01 00:00, 142.30,  1.25, 0.98595,  0.0001
2026-Dec-01 02:00, 143.32,  1.26, 0.98594,  0.0001
2026-Dec-01 04:00, 144.34,  1.28, 0.98593,  0.0001
$$EOE
*******************************************************************************
"""
    records = client._parse_horizons_csv(mock_horizons_output)
    assert len(records) == 3
    assert records[0]["azimuth_deg"] == 142.30
    assert records[0]["elevation_deg"] == 1.25
    assert records[1]["azimuth_deg"] == 143.32


def test_horizons_service_status():
    status_info = horizons_client.get_service_status()
    assert "api_endpoint" in status_info
    assert "cached_query_count" in status_info
    assert "shackleton-rim" in status_info["benchmark_sites_available"]
    assert "DE440" in status_info["ephemeris_datum"]


def test_horizons_validation_against_benchmark():
    # Validate Shackleton at baseline
    result = horizons_client.validate_against_benchmark(
        site_id="shackleton-rim",
        epoch_iso="2026-12-01T00:00:00Z",
        computed_sun_az=142.30,
        computed_sun_el=1.25,
        computed_earth_az=310.40,
        computed_earth_el=4.82
    )
    assert result["is_validated"] is True
    assert result["residuals"]["delta_sun_azimuth_deg"] < 0.1
    assert result["residuals"]["delta_sun_elevation_deg"] < 0.1
    assert result["residuals"]["max_residual_deg"] < 0.1
