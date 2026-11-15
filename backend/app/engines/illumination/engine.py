"""
LUNA NAVIGATOR — Solar Illumination Engine (Joint Member 2 & 3 Integration)
Combines topocentric ephemeris with terrain horizon profiles to calculate true solar illumination.
"""

import math
from typing import List
from app.core.constants import SOLAR_CONSTANT_1AU_W_M2, SOLAR_ANGULAR_RADIUS_DEG
from app.engines.ephemeris.engine import ephemeris_engine
from app.engines.terrain.horizon import terrain_engine
from app.schemas.ephemeris import EphemerisRequest
from app.schemas.terrain import TerrainHorizonRequest
from app.schemas.illumination import (
    IlluminationRequest,
    IlluminationPoint,
    IlluminationResponse
)


class IlluminationEngine:
    """
    Computes solar illumination and shadow intervals accounting for lunar topography.
    """
    
    def calculate_illumination(self, request: IlluminationRequest) -> IlluminationResponse:
        # 1. Ephemeris time series
        eph_req = EphemerisRequest(
            latitude=request.latitude,
            longitude=request.longitude,
            elevation_m=request.elevation_m,
            start_date=request.start_date,
            duration_days=request.duration_days,
            step_hours=request.step_hours,
            use_live_horizons=getattr(request, "use_live_horizons", False)
        )
        eph_res = ephemeris_engine.calculate_ephemeris_series(eph_req)
        
        # 2. Local terrain horizon mask
        terrain_horizon = None
        if request.use_terrain_horizon:
            terr_req = TerrainHorizonRequest(
                latitude=request.latitude,
                longitude=request.longitude,
                elevation_m=request.elevation_m,
                observer_height_m=request.mast_height_m
            )
            terrain_horizon = terrain_engine.generate_horizon_profile(terr_req)
            
        time_series: List[IlluminationPoint] = []
        sunlit_count = 0
        current_sunlit_run = 0.0
        max_sunlit_run = 0.0
        current_shadow_run = 0.0
        max_shadow_run = 0.0
        
        for pt in eph_res.time_series:
            sun_az = pt.sun_azimuth_deg
            sun_el = pt.sun_elevation_deg
            
            # Geometric visibility (tangent to flat lunar sphere)
            is_sunlit_geom = (sun_el + SOLAR_ANGULAR_RADIUS_DEG) > 0.0
            
            # Terrain obstruction check
            horizon_el = 0.0
            if terrain_horizon:
                horizon_el = terrain_engine.get_horizon_elevation_at_azimuth(terrain_horizon, sun_az)
                is_sunlit_terr = (sun_el + SOLAR_ANGULAR_RADIUS_DEG) > horizon_el
            else:
                is_sunlit_terr = is_sunlit_geom
                
            # Solar flux calculation
            # Direct normal solar flux at Moon distance (~1361 W/m^2)
            solar_flux = SOLAR_CONSTANT_1AU_W_M2 if is_sunlit_terr else 0.0
            
            # Effective flux on horizontal plane: S_0 * max(0, sin(El))
            sin_el = math.sin(math.radians(max(0.0, sun_el)))
            effective_flux_horiz = (SOLAR_CONSTANT_1AU_W_M2 * sin_el) if is_sunlit_terr else 0.0
            
            if is_sunlit_terr:
                sunlit_count += 1
                current_sunlit_run += request.step_hours
                if current_sunlit_run > max_sunlit_run:
                    max_sunlit_run = current_sunlit_run
                current_shadow_run = 0.0
            else:
                current_shadow_run += request.step_hours
                if current_shadow_run > max_shadow_run:
                    max_shadow_run = current_shadow_run
                current_sunlit_run = 0.0
                
            time_series.append(IlluminationPoint(
                timestamp=pt.timestamp,
                sun_azimuth_deg=sun_az,
                sun_elevation_deg=sun_el,
                terrain_horizon_elevation_deg=round(horizon_el, 2),
                is_sunlit_geometric=is_sunlit_geom,
                is_sunlit_terrain=is_sunlit_terr,
                solar_flux_w_m2=round(solar_flux, 1),
                effective_flux_horizontal_w_m2=round(effective_flux_horiz, 2)
            ))
            
        total_steps = len(time_series)
        illum_pct = round((sunlit_count / total_steps * 100.0), 1) if total_steps > 0 else 0.0
        total_sunlit_hours = round(sunlit_count * request.step_hours, 1)
        total_shadow_hours = round((total_steps - sunlit_count) * request.step_hours, 1)
        
        ephem_source = eph_res.data_source
        terr_source = terrain_horizon.terrain_source if terrain_horizon else "GEOMETRIC HORIZON (NO TERRAIN)"
        dem_res = terrain_horizon.dem_resolution_m if terrain_horizon else None
        calc_status = eph_res.calculation_status
        warning = eph_res.data_quality_warning

        return IlluminationResponse(
            latitude=request.latitude,
            longitude=request.longitude,
            start_date=request.start_date,
            duration_days=request.duration_days,
            step_hours=request.step_hours,
            illumination_percentage=illum_pct,
            total_sunlit_hours=total_sunlit_hours,
            total_shadow_hours=total_shadow_hours,
            longest_continuous_sunlight_hours=round(max_sunlit_run, 1),
            longest_continuous_shadow_hours=round(max_shadow_run, 1),
            ephemeris_source=ephem_source,
            terrain_source=terr_source,
            dem_resolution_m=dem_res,
            calculation_status=calc_status,
            data_quality_warning=warning,
            time_series=time_series
        )


illumination_engine = IlluminationEngine()
