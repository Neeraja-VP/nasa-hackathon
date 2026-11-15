"""
LUNA NAVIGATOR — Terrain Horizon Engine (Member 3 Ownership)
Computes 360-degree local terrain horizon elevation profile and ray-tracing obstruction masks
using NASA LOLA DEM data and selenographic curvature models.
"""

import math
from typing import List, Dict, Tuple, Optional, Any
from app.core.constants import (
    MOON_MEAN_RADIUS_M,
    SOLAR_ANGULAR_RADIUS_DEG,
    EARTH_ANGULAR_RADIUS_LUNAR_SKY_DEG,
    MIN_COMM_ELEVATION_THRESHOLD_DEG
)
from app.core.coordinates import lunar_curvature_drop
from app.schemas.terrain import (
    TerrainHorizonRequest,
    HorizonPoint,
    TerrainHorizonResponse
)
from app.services.geospatial.ray_tracer import ray_tracer, LolaRayTracer
from app.services.geospatial.dem_loader import dem_loader, DemLoader


class TerrainHorizonEngine:
    """
    Computes terrain horizon obstruction angles for arbitrary lunar coordinates
    using NASA LOLA elevation models and spherical ray tracing.
    """
    
    def __init__(self, tracer: Optional[LolaRayTracer] = None, loader: Optional[DemLoader] = None):
        self.tracer = tracer or ray_tracer
        self.dem_loader = loader or dem_loader
        self._profile_cache: Dict[Tuple[float, float, float, float, float, float], TerrainHorizonResponse] = {}

    def _get_cache_key(self, request: TerrainHorizonRequest) -> Tuple[float, float, float, float, float, float]:
        return (
            round(request.latitude, 4),
            round(request.longitude, 4),
            round(request.elevation_m, 1),
            round(request.observer_height_m, 1),
            round(request.max_distance_km, 1),
            round(request.azimuth_step_deg, 2)
        )

    def generate_horizon_profile(self, request: TerrainHorizonRequest) -> TerrainHorizonResponse:
        """
        Calculates the horizon elevation mask for azimuths from 0° to 359° with azimuth_step_deg.
        Ray-traces line-of-sight sightlines across LOLA topography with lunar curvature correction:
            tan(alpha(s)) = [h(s) - h_obs - s^2 / (2 * R_moon)] / s
            where s is ground distance, h_obs is observer ground elevation + mast height.
        """
        cache_key = self._get_cache_key(request)
        if cache_key in self._profile_cache:
            return self._profile_cache[cache_key]

        horizon_points = self.tracer.trace_full_horizon(
            lat_deg=request.latitude,
            lon_deg=request.longitude,
            elevation_m=request.elevation_m,
            observer_height_m=request.observer_height_m,
            max_distance_km=request.max_distance_km,
            azimuth_step_deg=request.azimuth_step_deg
        )

        elevations = [p.horizon_elevation_deg for p in horizon_points]
        max_el = max(elevations) if elevations else 0.0
        min_el = min(elevations) if elevations else 0.0
        avg_el = round(sum(elevations) / len(elevations), 2) if elevations else 0.0

        response = TerrainHorizonResponse(
            latitude=request.latitude,
            longitude=request.longitude,
            elevation_m=request.elevation_m,
            observer_height_m=request.observer_height_m,
            elevation_datum="Lunar Sphere R=1737.4 km (NASA LOLA)",
            horizon_points=horizon_points,
            max_horizon_elevation_deg=round(max_el, 2),
            min_horizon_elevation_deg=round(min_el, 2),
            average_horizon_elevation_deg=avg_el
        )
        
        self._profile_cache[cache_key] = response
        return response

    def get_horizon_elevation_at_azimuth(
        self,
        horizon_response: TerrainHorizonResponse,
        azimuth_deg: float
    ) -> float:
        """
        Fast lookup and linear interpolation of horizon obstruction elevation angle
        at any continuous azimuth angle [0, 360).
        """
        points = horizon_response.horizon_points
        if not points:
            return 0.0
            
        az = azimuth_deg % 360.0
        n = len(points)
        step = points[1].azimuth_deg - points[0].azimuth_deg if n > 1 else 1.0
        if step <= 0.0:
            step = 1.0
            
        exact_idx = az / step
        idx0 = int(math.floor(exact_idx)) % n
        idx1 = (idx0 + 1) % n
        frac = exact_idx - math.floor(exact_idx)
        
        el0 = points[idx0].horizon_elevation_deg
        el1 = points[idx1].horizon_elevation_deg
        
        return round((1.0 - frac) * el0 + frac * el1, 2)

    def calculate_solar_visibility(
        self,
        horizon_response: TerrainHorizonResponse,
        sun_azimuth_deg: float,
        sun_elevation_deg: float
    ) -> Dict[str, Any]:
        """
        Determine solar illumination state considering terrain mask and finite solar disk semi-diameter.
        
        Returns:
            Dict with:
                - horizon_elevation_deg: local obstruction mask
                - status: 'DIRECT_SUNLIGHT' | 'PENUMBRA' | 'UMBRA_SHADOW'
                - is_sunlit: bool (true if any portion of solar disk is visible)
                - is_fully_sunlit: bool (true if entire solar disk is above horizon)
        """
        horizon_el = self.get_horizon_elevation_at_azimuth(horizon_response, sun_azimuth_deg)
        delta_sun = SOLAR_ANGULAR_RADIUS_DEG
        
        # Sun disk upper and lower limbs
        upper_limb = sun_elevation_deg + delta_sun
        lower_limb = sun_elevation_deg - delta_sun
        
        if lower_limb >= horizon_el:
            status = "DIRECT_SUNLIGHT"
            is_sunlit = True
            is_fully_sunlit = True
        elif upper_limb > horizon_el:
            status = "PENUMBRA"
            is_sunlit = True
            is_fully_sunlit = False
        else:
            status = "UMBRA_SHADOW"
            is_sunlit = False
            is_fully_sunlit = False
            
        return {
            "horizon_elevation_deg": horizon_el,
            "status": status,
            "is_sunlit": is_sunlit,
            "is_fully_sunlit": is_fully_sunlit,
            "apparent_solar_elevation_deg": sun_elevation_deg
        }

    def calculate_earth_visibility(
        self,
        horizon_response: TerrainHorizonResponse,
        earth_azimuth_deg: float,
        earth_elevation_deg: float,
        min_comm_elevation_deg: float = MIN_COMM_ELEVATION_THRESHOLD_DEG
    ) -> Dict[str, Any]:
        """
        Determine Direct-to-Earth (DTE) communication visibility considering terrain mask
        and minimum ground station elevation cutoff.
        """
        horizon_el = self.get_horizon_elevation_at_azimuth(horizon_response, earth_azimuth_deg)
        effective_cutoff = max(horizon_el, min_comm_elevation_deg)
        is_visible = earth_elevation_deg > effective_cutoff
        
        if is_visible:
            link_status = "DIRECT_LINE_OF_SIGHT"
        elif earth_elevation_deg <= horizon_el:
            link_status = "TERRAIN_BLOCKED"
        else:
            link_status = "BELOW_MIN_ELEVATION"
            
        return {
            "horizon_elevation_deg": horizon_el,
            "effective_cutoff_deg": effective_cutoff,
            "is_visible": is_visible,
            "link_status": link_status,
            "earth_elevation_deg": earth_elevation_deg
        }


# Global singleton instance
terrain_engine = TerrainHorizonEngine()
