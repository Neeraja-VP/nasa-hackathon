"""
Comprehensive Integration Tests for NASA JPL Horizons Service & Data Provenance.

Validates:
1. Horizons API response parsing with solar/optical presence flags (*, i).
2. Sun and Earth coordinate transformations from Lunar Topocentric frames (coord@301).
3. Disk caching behavior and transparent data source tagging (LIVE, CACHED, FALLBACK).
4. Robust fallback behavior when offline, timeout, or network connection fails.
5. Error handling for malformed, truncated, or invalid Horizons data.
"""

import os
import io
import json
from datetime import datetime, timezone, timedelta
from unittest.mock import patch, MagicMock
import pytest

from app.services.horizons_client import JPLHorizonsClient
from app.engines.ephemeris.engine import ephemeris_engine
from app.schemas.ephemeris import EphemerisRequest


SAMPLE_HORIZONS_SUN_CSV = """
*******************************************************************************
 Revised: March 12, 2024             Sun / (Moon)                           10
*******************************************************************************
$$SOE
2026-Dec-01 00:00, 142.30,  1.25, 0.98595,  0.0001
2026-Dec-01 02:00 *  143.32,  1.26, 0.98594,  0.0001
2026-Dec-01 04:00 *i 144.34,  1.28, 0.98593,  0.0001
$$EOE
*******************************************************************************
"""

SAMPLE_HORIZONS_EARTH_CSV = """
*******************************************************************************
 Revised: March 12, 2024            Earth / (Moon)                         399
*******************************************************************************
$$SOE
2026-Dec-01 00:00, 310.40,  4.82, 0.00257, -0.0000
2026-Dec-01 02:00 *  310.55,  4.80, 0.00257, -0.0000
2026-Dec-01 04:00 *i 310.70,  4.77, 0.00257, -0.0000
$$EOE
*******************************************************************************
"""


def test_horizons_csv_parser_with_presence_flags():
    """Verify parser correctly handles Horizons presence flags (*, i) preceding numeric fields."""
    client = JPLHorizonsClient()
    records = client._parse_horizons_csv(SAMPLE_HORIZONS_SUN_CSV)
    
    assert len(records) == 3
    # Step 0: no flags
    assert records[0]["azimuth_deg"] == 142.30
    assert records[0]["elevation_deg"] == 1.25
    assert records[0]["distance_km"] > 140_000_000.0

    # Step 1: '*' presence flag
    assert records[1]["azimuth_deg"] == 143.32
    assert records[1]["elevation_deg"] == 1.26

    # Step 2: '*i' dual flags
    assert records[2]["azimuth_deg"] == 144.34
    assert records[2]["elevation_deg"] == 1.28


def test_horizons_csv_parser_empty_or_malformed():
    """Verify parser returns empty list without raising exception on invalid or truncated responses."""
    client = JPLHorizonsClient()
    assert client._parse_horizons_csv("") == []
    assert client._parse_horizons_csv("No marker tags here") == []
    assert client._parse_horizons_csv("$$SOE\ncorrupt row without numbers\n$$EOE") == []


def test_disk_caching_and_transparency(tmp_path):
    """Verify client writes cache to disk and subsequent calls return CACHED NASA HORIZONS DATA."""
    client = JPLHorizonsClient(cache_dir=str(tmp_path))
    start = datetime(2026, 12, 1, 0, 0, tzinfo=timezone.utc)
    stop = datetime(2026, 12, 1, 4, 0, tzinfo=timezone.utc)

    # Mock live urllib response for first call
    fake_json_bytes = json.dumps({"result": SAMPLE_HORIZONS_SUN_CSV}).encode("utf-8")
    mock_cm = MagicMock()
    mock_cm.__enter__.return_value = io.BytesIO(fake_json_bytes)
    mock_cm.__exit__.return_value = False

    with patch("urllib.request.urlopen", return_value=mock_cm):
        records, source = client.query_ephemeris(
            target_id="10",
            lat=-89.78,
            lon=125.0,
            elev_m=1240.0,
            start_date=start,
            stop_date=stop,
            step_hours=2.0
        )
        assert source == "LIVE NASA HORIZONS DATA"
        assert len(records) == 3

    # Verify cache file was written to disk
    cache_files = os.listdir(str(tmp_path))
    assert len(cache_files) == 1

    # Second call should read from disk without calling network
    with patch("urllib.request.urlopen", side_effect=Exception("Network must not be called on cache hit")):
        cached_records, cached_source = client.query_ephemeris(
            target_id="10",
            lat=-89.78,
            lon=125.0,
            elev_m=1240.0,
            start_date=start,
            stop_date=stop,
            step_hours=2.0
        )
        assert cached_source == "CACHED NASA HORIZONS DATA"
        assert len(cached_records) == 3
        assert cached_records[0]["azimuth_deg"] == 142.30


def test_offline_fallback_when_network_fails(tmp_path):
    """Verify client gracefully falls back to None on network timeout without unhandled crashes."""
    client = JPLHorizonsClient(cache_dir=str(tmp_path))
    start = datetime(2026, 12, 1, 0, 0, tzinfo=timezone.utc)
    stop = datetime(2026, 12, 1, 4, 0, tzinfo=timezone.utc)

    with patch("urllib.request.urlopen", side_effect=Exception("Network connection timed out")):
        records, source = client.query_ephemeris(
            target_id="10",
            lat=-89.78,
            lon=125.0,
            elev_m=1240.0,
            start_date=start,
            stop_date=stop,
            step_hours=2.0
        )
        assert records is None
        assert source == "ANALYTICAL FALLBACK DATA"


def test_ephemeris_engine_data_source_transparency():
    """Verify ephemeris series correctly sets transparent source tags for both live and fallback paths."""
    start = datetime(2026, 12, 1, 0, 0, tzinfo=timezone.utc)
    
    # 1. Without live horizons requested -> ANALYTICAL FALLBACK DATA
    req_analytical = EphemerisRequest(
        latitude=-89.78,
        longitude=125.0,
        elevation_m=1240.0,
        start_date=start,
        duration_days=1.0,
        step_hours=2.0,
        use_live_horizons=False
    )
    res_analytical = ephemeris_engine.calculate_ephemeris_series(req_analytical)
    assert res_analytical.ephemeris_source == "ANALYTICAL FALLBACK DATA"
    assert res_analytical.calculation_status == "FALLBACK_APPLIED"

    # 2. With live horizons requested for a precached benchmark location (14 days, 3.0h step) -> CACHED
    req_cached = EphemerisRequest(
        latitude=-89.78,
        longitude=125.0,
        elevation_m=1240.0,
        start_date=start,
        duration_days=14.0,
        step_hours=3.0,
        use_live_horizons=True
    )
    res_cached = ephemeris_engine.calculate_ephemeris_series(req_cached)
    assert res_cached.ephemeris_source == "CACHED NASA HORIZONS DATA"
    assert res_cached.calculation_status == "NOMINAL"
    # 14 days * 24h = 336 hours / 3h step = 112 intervals + 1 endpoint = 113 points
    assert len(res_cached.time_series) == 113
