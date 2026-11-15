"""
Unit Tests for NASA JPL Horizons Client Service (Member 2)
Tests Horizons query creation, CSV response parsing, cache hits, and offline fallbacks.
"""

from datetime import datetime, timezone, timedelta
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


def test_horizons_csv_parser_with_solar_and_interference_flags():
    """
    Assert parser correctly handles real NASA Horizons CSV tables containing
    solar presence flags ('*'), interference flags ('i'), and apparent angle columns.
    """
    client = JPLHorizonsClient()
    real_horizons_raw = """
*******************************************************************************
 Revised: March 12, 2024             Sun / (Moon)                           10
*******************************************************************************
$$SOE
2026-Dec-01 00:00,*, , 218.4716, 1.4883, 0.98561848529528, -0.3708307
2026-Dec-01 01:00,*,i, 219.2541, 1.5012, 0.98561912450123, -0.3708100
2026-Dec-01 02:00, , , 220.0365, 1.5140, 0.98562000000000, -0.3707890
$$EOE
*******************************************************************************
"""
    records = client._parse_horizons_csv(real_horizons_raw)
    assert len(records) == 3
    assert records[0]["azimuth_deg"] == 218.47
    assert records[0]["elevation_deg"] == 1.49
    assert records[0]["distance_km"] > 147000000.0  # AU converted to km
    assert records[1]["azimuth_deg"] == 219.25
    assert records[1]["elevation_deg"] == 1.50
    assert records[2]["azimuth_deg"] == 220.04


def test_horizons_csv_parser_malformed_and_empty():
    """Verify parser robustness against empty results or missing markers."""
    client = JPLHorizonsClient()
    assert client._parse_horizons_csv("") == []
    assert client._parse_horizons_csv("No markers present") == []
    assert client._parse_horizons_csv("$$SOE\nInvalid row without commas\n$$EOE") == []


def test_horizons_caching_and_clear_cache():
    """Verify that cached queries return CACHED NASA HORIZONS DATA and clear_cache works."""
    client = JPLHorizonsClient()
    client.clear_cache()
    assert len(client._cache) == 0

    start = datetime(2026, 12, 1, 0, 0, tzinfo=timezone.utc)
    stop = datetime(2026, 12, 2, 0, 0, tzinfo=timezone.utc)
    cache_key = client._build_cache_key("10", -89.78, 125.0, 1240.0, start, stop, 1.0)

    # Pre-populate cache
    mock_records = [{"timestamp_str": "2026-Dec-01 00:00", "azimuth_deg": 142.3, "elevation_deg": 1.25, "distance_km": 147512400.0}]
    client._cache[cache_key] = {"records": mock_records, "cached_at": start}

    # Query with return_source=True
    records, source_tag = client.query_live_horizons("10", -89.78, 125.0, 1240.0, start, stop, 1.0, return_source=True)
    assert records == mock_records
    assert source_tag == "CACHED NASA HORIZONS DATA"

    client.clear_cache()
    assert len(client._cache) == 0


def test_horizons_query_series_alignment():
    """Verify alignment of Sun and Earth time-series from Horizons."""
    client = JPLHorizonsClient()
    client.clear_cache()

    start = datetime(2026, 12, 1, 0, 0, tzinfo=timezone.utc)
    duration_days = 2.0 / 24.0  # Exactly 2 hours
    stop = start + timedelta(days=duration_days)

    # Inject mock Sun & Earth records
    key_sun = client._build_cache_key("10", -89.78, 125.0, 1240.0, start, stop, 1.0)
    key_earth = client._build_cache_key("399", -89.78, 125.0, 1240.0, start, stop, 1.0)

    sun_pts = [
        {"timestamp_str": "2026-Dec-01 00:00", "timestamp": start, "azimuth_deg": 142.30, "elevation_deg": 1.25, "distance_km": 147512400.0},
        {"timestamp_str": "2026-Dec-01 01:00", "timestamp": start, "azimuth_deg": 143.32, "elevation_deg": 1.26, "distance_km": 147512000.0}
    ]
    earth_pts = [
        {"timestamp_str": "2026-Dec-01 00:00", "timestamp": start, "azimuth_deg": 310.40, "elevation_deg": 4.82, "distance_km": 384420.0},
        {"timestamp_str": "2026-Dec-01 01:00", "timestamp": start, "azimuth_deg": 310.80, "elevation_deg": 4.85, "distance_km": 384400.0}
    ]

    client._cache[key_sun] = {"records": sun_pts, "cached_at": start}
    client._cache[key_earth] = {"records": earth_pts, "cached_at": start}

    points, source_label, source_type, warning = client.query_site_ephemeris_series(
        lat=-89.78,
        lon=125.0,
        elev_m=1240.0,
        start_date=start,
        duration_days=duration_days,
        step_hours=1.0
    )

    assert points is not None
    assert len(points) == 2
    assert source_label == "CACHED NASA HORIZONS DATA"
    assert source_type == "CACHED_NASA_HORIZONS"
    assert warning is None
    assert points[0]["sun_azimuth_deg"] == 142.30
    assert points[0]["earth_azimuth_deg"] == 310.40
    assert points[0]["sun_elevation_deg"] == 1.25
    assert points[0]["earth_elevation_deg"] == 4.82


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
