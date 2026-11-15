"""
LUNA NAVIGATOR — NASA JPL Horizons API Client & Cache Service
Implements automated query generation, ephemeris data parsing, caching, and validation
against NASA JPL Horizons Web API (DE440 planetary ephemeris).
"""

import logging
import urllib.request
import urllib.parse
import json
import os
import hashlib
import time
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Tuple

from app.core.config import settings
from app.services.horizons_benchmarks import get_horizons_benchmark, JPL_HORIZONS_DE440_BENCHMARKS

logger = logging.getLogger("luna.horizons")

# Provenance Data Source Constants
SOURCE_LIVE_HORIZONS = "LIVE NASA HORIZONS DATA"
SOURCE_CACHED_HORIZONS = "CACHED NASA HORIZONS DATA"
SOURCE_ANALYTICAL_FALLBACK = "ANALYTICAL FALLBACK DATA"


class JPLHorizonsClient:
    """
    Client for NASA JPL Solar System Dynamics (SSD) Horizons API.
    Docs: https://ssd.jpl.nasa.gov/api/horizons.api
    """

    def __init__(
        self,
        base_url: str = settings.HORIZONS_API_BASE_URL,
        timeout: float = settings.HORIZONS_TIMEOUT_SECONDS,
        cache_dir: Optional[str] = None
    ):
        self.base_url = base_url
        self.timeout = timeout
        # In-memory query cache: key -> dict with 'records', 'cached_at', 'source'
        self._cache: Dict[str, Dict[str, Any]] = {}
        
        # Disk cache directory
        if cache_dir is None:
            base_datasets = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "datasets"))
            self.cache_dir = os.path.join(base_datasets, "cache", "horizons")
        else:
            self.cache_dir = cache_dir
            
        try:
            os.makedirs(self.cache_dir, exist_ok=True)
        except Exception as e:
            logger.warning(f"Could not create disk cache directory {self.cache_dir}: {e}")

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
        """
        Build a deterministic cache key string.
        """
        start_iso = start_date.strftime("%Y-%m-%d-%H-%M")
        stop_iso = stop_date.strftime("%Y-%m-%d-%H-%M")
        return f"{target}:{lat:.2f}:{lon:.2f}:{elev_m:.0f}:{start_date.isoformat()}:{stop_date.isoformat()}:{step_hours:.1f}"

    def _get_disk_cache_path(self, cache_key: str) -> str:
        key_hash = hashlib.sha256(cache_key.encode("utf-8")).hexdigest()[:24]
        return os.path.join(self.cache_dir, f"{key_hash}.json")

    def _load_from_disk_cache(self, cache_key: str) -> Optional[List[Dict[str, Any]]]:
        path = self._get_disk_cache_path(cache_key)
        if os.path.isfile(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    payload = json.load(f)
                    records = payload.get("records")
                    if records:
                        self._cache[cache_key] = {
                            "records": records,
                            "cached_at": payload.get("cached_at", datetime.now(timezone.utc).isoformat()),
                            "source": SOURCE_CACHED_HORIZONS
                        }
                        return records
            except Exception as e:
                logger.warning(f"Error reading disk cache {path}: {e}")
        return None

    def _save_to_disk_cache(self, cache_key: str, records: List[Dict[str, Any]]):
        path = self._get_disk_cache_path(cache_key)
        try:
            with open(path, "w", encoding="utf-8") as f:
                json.dump({
                    "cache_key": cache_key,
                    "cached_at": datetime.now(timezone.utc).isoformat(),
                    "records": records
                }, f, indent=2)
        except Exception as e:
            logger.warning(f"Error writing to disk cache {path}: {e}")

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
        Query Horizons returning records list or None (backward-compatible method).
        """
        records, _ = self.query_ephemeris(
            target_id=target_id,
            lat=lat,
            lon=lon,
            elev_m=elev_m,
            start_date=start_date,
            stop_date=stop_date,
            step_hours=step_hours
        )
        return records

    def query_ephemeris(
        self,
        target_id: str,
        lat: float,
        lon: float,
        elev_m: float,
        start_date: datetime,
        stop_date: datetime,
        step_hours: float,
        allow_network: bool = True
    ) -> Tuple[Optional[List[Dict[str, Any]]], str]:
        """
        Retrieve ephemeris records for a target relative to lunar surface coordinate.
        Returns:
            (records, data_source)
            data_source is one of:
                - SOURCE_LIVE_HORIZONS ("LIVE NASA HORIZONS DATA")
                - SOURCE_CACHED_HORIZONS ("CACHED NASA HORIZONS DATA")
                - SOURCE_ANALYTICAL_FALLBACK ("ANALYTICAL FALLBACK DATA")
        """
        cache_key = self._build_cache_key(target_id, lat, lon, elev_m, start_date, stop_date, step_hours)

        # 1. Check in-memory cache
        if cache_key in self._cache:
            return self._cache[cache_key].get("records"), SOURCE_CACHED_HORIZONS

        # 2. Check disk cache
        disk_records = self._load_from_disk_cache(cache_key)
        if disk_records:
            return disk_records, SOURCE_CACHED_HORIZONS

        if not allow_network:
            return None, SOURCE_ANALYTICAL_FALLBACK

        # Format times for Horizons API
        start_str = start_date.strftime("%Y-%m-%d %H:%M")
        stop_str = stop_date.strftime("%Y-%m-%d %H:%M")
        
        if step_hours < 1.0:
            step_str = f"{max(1, int(step_hours * 60))} m"
        elif abs(step_hours - round(step_hours)) > 0.01:
            step_str = f"{int(step_hours * 60)} m"
        else:
            step_str = f"{int(step_hours)} h"
            
        elev_km = elev_m / 1000.0
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
            "QUANTITIES": "'4,20'",
            "REF_SYSTEM": "'ICRF'",
            "CAL_FORMAT": "'CAL'",
            "TIME_DIGITS": "'MINUTES'",
            "ANG_FORMAT": "'DEG'",
            "APPARENT": "'AIRLESS'",
            "TIME_ZONE": "'UTC'",
            "CSV_FORMAT": "'YES'"
        }

        query_string = urllib.parse.urlencode(params)
        full_url = f"{self.base_url}?{query_string}"

        # 3. Network attempt with retries (up to 2 retries)
        max_retries = 2
        last_error = None
        for attempt in range(max_retries + 1):
            try:
                req = urllib.request.Request(
                    full_url,
                    headers={"User-Agent": "LunaNavigator/1.0 (NASA Space Apps Challenge)"}
                )
                with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                    resp_data = json.loads(resp.read().decode("utf-8"))
                    raw_text = resp_data.get("result", "")
                    parsed_records = self._parse_horizons_csv(raw_text)
                    if parsed_records:
                        self._cache[cache_key] = {
                            "records": parsed_records,
                            "cached_at": datetime.now(timezone.utc).isoformat(),
                            "source": SOURCE_LIVE_HORIZONS
                        }
                        self._save_to_disk_cache(cache_key, parsed_records)
                        return parsed_records, SOURCE_LIVE_HORIZONS
                    else:
                        logger.warning(f"JPL Horizons returned no parsable ephemeris table for target {target_id}")
            except Exception as e:
                last_error = e
                logger.warning(f"JPL Horizons attempt {attempt + 1}/{max_retries + 1} failed: {e}")
                if attempt < max_retries:
                    time.sleep(0.5 * (attempt + 1))

        logger.warning(
            f"JPL Horizons query for target {target_id} failed after {max_retries + 1} attempts ({last_error}). "
            "Falling back to validated DE440 analytical engine."
        )
        return None, SOURCE_ANALYTICAL_FALLBACK

    def _parse_horizons_csv(self, raw_result_text: str) -> List[Dict[str, Any]]:
        """
        Parse CSV text located between $$SOE and $$EOE markers in the Horizons API response.
        Handles both formats with solar presence flags (*, i, m) and standard raw columns.
        """
        records: List[Dict[str, Any]] = []
        if "$$SOE" not in raw_result_text or "$$EOE" not in raw_result_text:
            return records

        content = raw_result_text.split("$$SOE")[1].split("$$EOE")[0].strip()
        lines = [line.strip() for line in content.splitlines() if line.strip()]

        for line in lines:
            parts = [p.strip() for p in line.split(",") if p.strip()]
            if not parts:
                continue

            # Tokenize parts[0] to separate timestamp (e.g. "2026-Dec-01 00:00") from any trailing flags/nums
            tokens_first = parts[0].split()
            if len(tokens_first) >= 2:
                time_str = f"{tokens_first[0]} {tokens_first[1]}"
                remaining_tokens = tokens_first[2:]
            else:
                time_str = parts[0]
                remaining_tokens = []

            # Filter tokens and remaining columns for float values
            nums: List[float] = []
            for tok in remaining_tokens:
                try:
                    nums.append(float(tok))
                except ValueError:
                    pass

            for p in parts[1:]:
                for sub in p.split():
                    try:
                        nums.append(float(sub))
                    except ValueError:
                        continue

            # Need at least azimuth and elevation; distance is optional (defaults to 1 AU/384,400km)
            if len(nums) >= 2:
                azimuth = nums[0]
                elevation = nums[1]
                
                # Distance handling
                if len(nums) >= 3:
                    raw_dist = nums[2]
                    # If distance < 10.0, units are AU (e.g. for Sun ~0.98-1.02 AU); convert to km
                    distance_km = raw_dist * 149597870.7 if raw_dist < 10.0 else raw_dist
                else:
                    distance_km = 149597870.7

                # Normalize azimuth [0, 360)
                azimuth = azimuth % 360.0

                records.append({
                    "timestamp_str": time_str,
                    "azimuth_deg": round(azimuth, 2),
                    "elevation_deg": round(elevation, 2),
                    "distance_km": round(distance_km, 1)
                })

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
        disk_files = 0
        if os.path.isdir(self.cache_dir):
            disk_files = len([f for f in os.listdir(self.cache_dir) if f.endswith(".json")])
            
        return {
            "api_endpoint": self.base_url,
            "cached_query_count": len(self._cache) + disk_files,
            "benchmark_sites_available": list(JPL_HORIZONS_DE440_BENCHMARKS.keys()),
            "ephemeris_datum": "NASA JPL DE440 / IAU Mean Earth Frame"
        }


# Singleton service instance
horizons_client = JPLHorizonsClient()
