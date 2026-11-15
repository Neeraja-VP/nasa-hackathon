"""
LUNA NAVIGATOR — NASA JPL Horizons API Client & Cache Service
Implements automated query generation, ephemeris data parsing, caching, and validation
against NASA JPL Horizons Web API (DE440 planetary ephemeris).
"""

import logging
import urllib.request
import urllib.parse
import json
import re
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Tuple

from app.core.config import settings
from app.services.horizons_benchmarks import get_horizons_benchmark, JPL_HORIZONS_DE440_BENCHMARKS

logger = logging.getLogger("luna.horizons")


class JPLHorizonsClient:
    """
    Client for NASA JPL Solar System Dynamics (SSD) Horizons API.
    Docs: https://ssd.jpl.nasa.gov/api/horizons.api
    """

    def __init__(self, base_url: str = settings.HORIZONS_API_BASE_URL, timeout: float = settings.HORIZONS_TIMEOUT_SECONDS):
        self.base_url = base_url
        self.timeout = timeout
        # In-memory query cache: key -> Ephemeris dictionary
        self._cache: Dict[str, Dict[str, Any]] = {}

    def _build_cache_key(
        self,
        target: str,
        lat: float,
        lon: float,
        elev_m: float,
        start_date: datetime,
        stop_date: datetime,
        step_hours: float
    ) -> str:
        return f"{target}:{lat:.2f}:{lon:.2f}:{elev_m:.0f}:{start_date.isoformat()}:{stop_date.isoformat()}:{step_hours:.1f}"

    def query_live_horizons(
        self,
        target_id: str,
        lat: float,
        lon: float,
        elev_m: float,
        start_date: datetime,
        stop_date: datetime,
        step_hours: float
    ) -> Optional[List[Dict[str, Any]]]:
        """
        Execute an HTTP request to the NASA JPL Horizons Web API.
        
        Args:
            target_id: '10' for Sun, '399' for Earth
            lat: Selenographic latitude [-90, +90]
            lon: Selenographic East longitude [0, 360]
            elev_m: Elevation in meters above lunar sphere
            start_date: Start datetime (UTC)
            stop_date: End datetime (UTC)
            step_hours: Sampling step in hours
            
        Returns:
            List of parsed ephemeris records or None on network/API failure.
        """
        cache_key = self._build_cache_key(target_id, lat, lon, elev_m, start_date, stop_date, step_hours)
        if cache_key in self._cache:
            return self._cache[cache_key].get("records")

        # Format times for Horizons (e.g. '2026-12-01 00:00')
        start_str = start_date.strftime("%Y-%m-%d %H:%M")
        stop_str = stop_date.strftime("%Y-%m-%d %H:%M")
        step_str = f"{int(step_hours * 60)} m" if step_hours < 1 else f"{int(step_hours)} h"
        elev_km = elev_m / 1000.0

        # Construct site coordinate: East Longitude, Latitude, Elevation (km) on Moon (Body 301)
        site_coord = f"{lon:.4f},{lat:.4f},{elev_km:.3f}"

        params = {
            "format": "json",
            "COMMAND": f"'{target_id}'",
            "CENTER": "'coord@301'",
            "SITE_COORD": f"'{site_coord}'",
            "COORD_TYPE": "'GEODETIC'",
            "MAKE_EPHEM": "'YES'",
            "EPHEM_TYPE": "'OBSERVER'",
            "START_TIME": f"'{start_str}'",
            "STOP_TIME": f"'{stop_str}'",
            "STEP_SIZE": f"'{step_str}'",
            "QUANTITIES": "'4,20'",  # 4 = Apparent Azimuth & Elevation; 20 = Observer range & range-rate
            "REF_SYSTEM": "'ICRF'",
            "CSV_FORMAT": "'YES'"
        }

        query_string = urllib.parse.urlencode(params)
        full_url = f"{self.base_url}?{query_string}"

        try:
            req = urllib.request.Request(full_url, headers={"User-Agent": "LunaNavigator/1.0 (NASA Space Apps)"})
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                raw_text = data.get("result", "")
                parsed_records = self._parse_horizons_csv(raw_text)
                if parsed_records:
                    self._cache[cache_key] = {"records": parsed_records, "cached_at": datetime.now(timezone.utc)}
                    return parsed_records
        except Exception as e:
            logger.warning(f"JPL Horizons API query failed ({str(e)}). Falling back to validated DE440 analytical engine.")

        return None

    def _parse_horizons_csv(self, raw_result_text: str) -> List[Dict[str, Any]]:
        """
        Parse CSV text located between $$SOE and $$EOE markers in the Horizons API response.
        """
        records: List[Dict[str, Any]] = []
        if "$$SOE" not in raw_result_text or "$$EOE" not in raw_result_text:
            return records

        content = raw_result_text.split("$$SOE")[1].split("$$EOE")[0].strip()
        lines = [line.strip() for line in content.splitlines() if line.strip()]

        for line in lines:
            parts = [p.strip() for p in line.split(",")]
            # Standard columns with QUANTITIES='4,20':
            # Date__(UT)__HR:MN, Solar_Az, Solar_El, delta, deldot
            if len(parts) >= 4:
                try:
                    time_str = parts[0]
                    azimuth = float(parts[1])
                    elevation = float(parts[2])
                    distance_km = float(parts[3]) * 149597870.7 if float(parts[3]) < 10 else float(parts[3])

                    records.append({
                        "timestamp_str": time_str,
                        "azimuth_deg": round(azimuth, 2),
                        "elevation_deg": round(elevation, 2),
                        "distance_km": round(distance_km, 1)
                    })
                except (ValueError, IndexError):
                    continue

        return records

    def validate_against_benchmark(
        self,
        site_id: str,
        epoch_iso: str,
        computed_sun_az: float,
        computed_sun_el: float,
        computed_earth_az: float,
        computed_earth_el: float
    ) -> Dict[str, Any]:
        """
        Empirically validate calculated values against ground-truth JPL Horizons DE440 benchmarks.
        """
        truth = get_horizons_benchmark(site_id, epoch_iso)
        if not truth:
            return {
                "site_id": site_id,
                "epoch": epoch_iso,
                "is_validated": False,
                "message": "No pre-computed ground-truth benchmark found for this specific epoch."
            }

        # Calculate absolute residuals
        delta_sun_az = abs(computed_sun_az - truth["sun_azimuth_deg"])
        # Handle 0/360 wrap around
        if delta_sun_az > 180.0:
            delta_sun_az = 360.0 - delta_sun_az

        delta_sun_el = abs(computed_sun_el - truth["sun_elevation_deg"])

        delta_earth_az = abs(computed_earth_az - truth["earth_azimuth_deg"])
        if delta_earth_az > 180.0:
            delta_earth_az = 360.0 - delta_earth_az

        delta_earth_el = abs(computed_earth_el - truth["earth_elevation_deg"])

        max_residual = max(delta_sun_az, delta_sun_el, delta_earth_az, delta_earth_el)
        # Tolerance: ≤ 0.5° over multi-year lunar orbital secular variation
        is_valid = max_residual <= 0.50

        return {
            "site_id": site_id,
            "epoch": epoch_iso,
            "is_validated": is_valid,
            "truth": truth,
            "residuals": {
                "delta_sun_azimuth_deg": round(delta_sun_az, 3),
                "delta_sun_elevation_deg": round(delta_sun_el, 3),
                "delta_earth_azimuth_deg": round(delta_earth_az, 3),
                "delta_earth_elevation_deg": round(delta_earth_el, 3),
                "max_residual_deg": round(max_residual, 3)
            },
            "tolerance_deg": 0.50,
            "data_source": "NASA JPL Horizons DE440 Planetary Ephemeris (DE440/LE440)"
        }

    def get_service_status(self) -> Dict[str, Any]:
        """
        Return telemetry status of the Horizons service and cache statistics.
        """
        return {
            "api_endpoint": self.base_url,
            "cached_query_count": len(self._cache),
            "benchmark_sites_available": list(JPL_HORIZONS_DE440_BENCHMARKS.keys()),
            "ephemeris_datum": "NASA JPL DE440 / IAU Mean Earth Frame"
        }


# Singleton service instance
horizons_client = JPLHorizonsClient()
