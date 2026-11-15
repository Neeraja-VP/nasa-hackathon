"""
LUNA NAVIGATOR — Combined Sky Horizon Engine (Tasks 1 - 9)
Synchronizes local LOLA terrain horizon elevation profile with topocentric Sun & Earth positions.
"""

import math
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from app.core.constants import (
    SOLAR_ANGULAR_RADIUS_DEG,
    EARTH_ANGULAR_RADIUS_LUNAR_SKY_DEG,
    SOLAR_CONSTANT_1AU_W_M2
)
from app.core.coordinates import apparent_angular_diameter_deg
from app.schemas.terrain import TerrainHorizonRequest
from app.schemas.ephemeris import EphemerisRequest
from app.schemas.sky_horizon import (
    SkyHorizonRequest,
    SkyHorizonPoint,
    SkyHorizonResponse
)
from app.engines.terrain.horizon import terrain_engine
from app.engines.ephemeris.engine import ephemeris_engine


class SkyHorizonEngine:
    """
    Combines local 360° LOLA terrain horizon relief with topocentric
    JPL Horizons Sun and Earth ephemeris vectors.
    """

    def evaluate_sky_horizon(self, request: SkyHorizonRequest) -> SkyHorizonResponse:
        # 1. Generate 360° terrain horizon elevation profile
        terrain_req = TerrainHorizonRequest(
            latitude=request.latitude,
            longitude=request.longitude,
            elevation_m=request.elevation_m,
            observer_height_m=request.mast_height_m,
            azimuth_step_deg=request.azimuth_step_deg,
            max_distance_km=60.0
        )
        horizon_resp = terrain_engine.generate_horizon_profile(terrain_req)

        # 2. Generate Sun and Earth topocentric positions
        ephem_req = EphemerisRequest(
            latitude=request.latitude,
            longitude=request.longitude,
            elevation_m=request.elevation_m,
            start_date=request.start_date,
            duration_days=request.duration_days,
            step_hours=request.step_hours,
            use_live_horizons=request.use_live_horizons
        )
        ephem_resp = ephemeris_engine.calculate_ephemeris_series(ephem_req)

        # 3. Process time-series points combining Sun & Earth positions relative to terrain
        time_series: List[SkyHorizonPoint] = []
        sunlit_steps = 0
        comm_steps = 0

        current_sunlight_run = 0
        longest_sunlight_steps = 0
        current_darkness_run = 0
        longest_darkness_steps = 0

        current_comm_run = 0
        longest_comm_steps = 0
        current_blackout_run = 0
        longest_blackout_steps = 0

        total_pts = len(ephem_resp.time_series)
        step_hours = request.step_hours

        for idx, ephem_pt in enumerate(ephem_resp.time_series):
            # Sun Topocentric Geometry
            sun_az = ephem_pt.sun_azimuth_deg
            sun_el = ephem_pt.sun_elevation_deg
            sun_terrain_el = terrain_engine.get_horizon_elevation_at_azimuth(horizon_resp, sun_az)
            sun_clearance = round(sun_el - sun_terrain_el, 2)
            is_sun_geom = sun_el > 0.0

            if sun_el < 0.0:
                is_sun_vis = False
                sun_status = "BELOW_GEOMETRIC_HORIZON"
            elif sun_el >= sun_terrain_el + SOLAR_ANGULAR_RADIUS_DEG:
                is_sun_vis = True
                sun_status = "DIRECT_SUNLIGHT"
            elif sun_el > sun_terrain_el - SOLAR_ANGULAR_RADIUS_DEG:
                is_sun_vis = True
                sun_status = "PENUMBRA"
            else:
                is_sun_vis = False
                sun_status = "TERRAIN_OCCLUDED"

            # Solar Flux
            if is_sun_vis and sun_el > 0.0:
                solar_flux = round(SOLAR_CONSTANT_1AU_W_M2 * math.sin(math.radians(max(0.0, sun_el))), 2)
            else:
                solar_flux = 0.0

            # Earth Topocentric Geometry
            earth_az = ephem_pt.earth_azimuth_deg
            earth_el = ephem_pt.earth_elevation_deg
            earth_terrain_el = terrain_engine.get_horizon_elevation_at_azimuth(horizon_resp, earth_az)
            earth_clearance = round(earth_el - earth_terrain_el, 2)
            is_earth_geom = earth_el > 0.0

            effective_comm_threshold = max(earth_terrain_el, request.min_comm_elevation_deg)
            if earth_el < 0.0:
                is_earth_vis = False
                earth_status = "BELOW_GEOMETRIC_HORIZON"
            elif earth_el >= effective_comm_threshold:
                is_earth_vis = True
                earth_status = "DIRECT_LINE_OF_SIGHT"
            else:
                is_earth_vis = False
                earth_status = "TERRAIN_BLOCKED"

            # Apparent Earth Angular Diameter (~1.88° to 1.95°)
            earth_apparent_diam = round(apparent_angular_diameter_deg(12742.0, ephem_pt.earth_distance_km), 2)

            # Accumulate run lengths
            if is_sun_vis:
                sunlit_steps += 1
                current_sunlight_run += 1
                longest_sunlight_steps = max(longest_sunlight_steps, current_sunlight_run)
                current_darkness_run = 0
            else:
                current_darkness_run += 1
                longest_darkness_steps = max(longest_darkness_steps, current_darkness_run)
                current_sunlight_run = 0

            if is_earth_vis:
                comm_steps += 1
                current_comm_run += 1
                longest_comm_steps = max(longest_comm_steps, current_comm_run)
                current_blackout_run = 0
            else:
                current_blackout_run += 1
                longest_blackout_steps = max(longest_blackout_steps, current_blackout_run)
                current_comm_run = 0

            met_hours = round(idx * step_hours, 1)

            time_series.append(SkyHorizonPoint(
                timestamp=ephem_pt.timestamp,
                step_index=idx,
                mission_elapsed_hours=met_hours,
                sun_azimuth_deg=sun_az,
                sun_elevation_deg=sun_el,
                sun_terrain_horizon_elevation_deg=sun_terrain_el,
                sun_elevation_clearance_deg=sun_clearance,
                is_sun_visible=is_sun_vis,
                is_sun_geometric=is_sun_geom,
                sun_visibility_status=sun_status,
                solar_flux_w_m2=solar_flux,
                earth_azimuth_deg=earth_az,
                earth_elevation_deg=earth_el,
                earth_terrain_horizon_elevation_deg=earth_terrain_el,
                earth_elevation_clearance_deg=earth_clearance,
                is_earth_visible=is_earth_vis,
                is_earth_geometric=is_earth_geom,
                earth_visibility_status=earth_status,
                earth_apparent_diameter_deg=earth_apparent_diam
            ))

        # Overall summary stats
        illum_pct = round((sunlit_steps / max(1, total_pts)) * 100.0, 1)
        comm_pct = round((comm_steps / max(1, total_pts)) * 100.0, 1)
        total_sun_hours = round(sunlit_steps * step_hours, 1)
        total_dark_hours = round((total_pts - sunlit_steps) * step_hours, 1)
        total_comm_hours = round(comm_steps * step_hours, 1)
        total_blackout_hours = round((total_pts - comm_steps) * step_hours, 1)

        return SkyHorizonResponse(
            latitude=request.latitude,
            longitude=request.longitude,
            elevation_m=request.elevation_m,
            mast_height_m=request.mast_height_m,
            start_date=request.start_date,
            duration_days=request.duration_days,
            step_hours=request.step_hours,
            total_steps=total_pts,
            horizon_profile=horizon_resp.horizon_points,
            max_horizon_elevation_deg=horizon_resp.max_horizon_elevation_deg,
            min_horizon_elevation_deg=horizon_resp.min_horizon_elevation_deg,
            average_horizon_elevation_deg=horizon_resp.average_horizon_elevation_deg,
            time_series=time_series,
            illumination_percentage=illum_pct,
            total_sunlight_hours=total_sun_hours,
            total_darkness_hours=total_dark_hours,
            longest_continuous_sunlight_hours=round(longest_sunlight_steps * step_hours, 1),
            longest_continuous_darkness_hours=round(longest_darkness_steps * step_hours, 1),
            communication_percentage=comm_pct,
            total_comm_hours=total_comm_hours,
            total_comm_blackout_hours=total_blackout_hours,
            longest_continuous_comm_window_hours=round(longest_comm_steps * step_hours, 1),
            longest_continuous_blackout_hours=round(longest_blackout_steps * step_hours, 1),
            data_source=ephem_resp.data_source,
            data_source_type=ephem_resp.data_source_type,
            terrain_data_source=horizon_resp.terrain_data_source,
            dem_resolution_m=horizon_resp.dem_resolution_m,
            is_procedural_fallback=horizon_resp.is_procedural_fallback,
            data_quality_warning=ephem_resp.data_quality_warning or horizon_resp.data_quality_warning
        )


sky_horizon_engine = SkyHorizonEngine()
