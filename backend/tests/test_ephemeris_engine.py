"""
Unit Tests for Ephemeris Engine (Member 2)
Verifies astronomical calculations for Sun/Earth topocentric coordinates and lunar libration.
"""

import math
from datetime import datetime, timezone, timedelta
import pytest

from app.engines.ephemeris.engine import ephemeris_engine
from app.schemas.ephemeris import EphemerisRequest, EphemerisPoint, EphemerisResponse
from app.core.constants import (
    MAX_LIBRATION_LATITUDE_DEG,
    MAX_LIBRATION_LONGITUDE_DEG,
    ASTRONOMICAL_UNIT_KM,
    EARTH_MOON_MEAN_DISTANCE_KM
)


def test_sub_solar_point_bounds():
    """Verify sub-solar point latitude stays within lunar obliquity (±1.5424°) and longitude within [0, 360)."""
    base_epoch = datetime(2026, 1, 1, 0, 0, tzinfo=timezone.utc)
    for day in range(0, 365, 15):
        epoch = base_epoch + timedelta(days=day)
        lat, lon, dist = ephemeris_engine.calculate_sub_solar_point(epoch)
        assert -1.55 <= lat <= 1.55
        assert 0.0 <= lon < 360.0
        # Earth-Moon distance from Sun is around 1 AU (~147M to 152M km)
        assert 146000000.0 <= dist <= 153000000.0


def test_sub_earth_libration_bounds():
    """Verify sub-Earth point stays within maximum optical & physical libration bounds."""
    base_epoch = datetime(2026, 12, 1, 0, 0, tzinfo=timezone.utc)
    for day in range(0, 60, 2):
        epoch = base_epoch + timedelta(days=day)
        lat, lon, dist = ephemeris_engine.calculate_sub_earth_point(epoch)
        assert abs(lat) <= MAX_LIBRATION_LATITUDE_DEG + 0.1
        assert abs(lon) <= MAX_LIBRATION_LONGITUDE_DEG + 0.1
        assert 350000.0 <= dist <= 410000.0


def test_ephemeris_point_shackleton_baseline():
    """Verify single epoch calculation for Shackleton Crater Rim at 2026-12-01 baseline."""
    epoch = datetime(2026, 12, 1, 0, 0, tzinfo=timezone.utc)
    point = ephemeris_engine.calculate_ephemeris_point(
        epoch=epoch,
        latitude=-89.78,
        longitude=125.0,
        elevation_m=1240.0
    )
    assert isinstance(point, EphemerisPoint)
    assert 0.0 <= point.sun_azimuth_deg < 360.0
    assert 0.0 <= point.earth_azimuth_deg < 360.0
    # At South Pole in early December, Sun elevation is near +1.2°
    assert pytest.approx(point.sun_elevation_deg, abs=0.4) == 1.25
    # Earth elevation at Shackleton in favorable libration is positive (~4.8°)
    assert pytest.approx(point.earth_elevation_deg, abs=0.5) == 4.82


def test_ephemeris_time_series_generation():
    """Verify time series generation matches duration and step size requirements."""
    request = EphemerisRequest(
        latitude=-89.78,
        longitude=125.0,
        elevation_m=1240.0,
        start_date=datetime(2026, 12, 1, 0, 0, tzinfo=timezone.utc),
        duration_days=3.0,
        step_hours=6.0
    )
    response = ephemeris_engine.calculate_ephemeris_series(request)
    assert isinstance(response, EphemerisResponse)
    # 3 days * 24 h = 72 hours / 6 = 12 intervals + 1 = 13 steps
    assert response.total_steps == 13
    assert len(response.time_series) == 13
    assert response.time_series[0].timestamp == request.start_date
    assert response.time_series[-1].timestamp == request.start_date + timedelta(days=3)
