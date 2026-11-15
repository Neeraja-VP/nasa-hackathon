"""
LUNA NAVIGATOR — LOLA Ray-Tracing Horizon Obstruction Engine (Member 3 Ownership)
Implements radial line-of-sight ray tracing with lunar spherical curvature correction
to compute 360-degree local horizon elevation masks and celestial obstruction profiles.
"""

import math
import numpy as np
from typing import List, Tuple, Dict, Optional

from app.core.constants import MOON_MEAN_RADIUS_M
from app.core.coordinates import lunar_curvature_drop
from app.schemas.terrain import HorizonPoint
from app.services.geospatial.dem_loader import dem_loader, DemLoader
from app.services.geospatial.projections import forward_geodesic


class LolaRayTracer:
    """
    High-performance ray-tracing horizon profiler.
    Traces radial sight lines across lunar topography, applying spherical curvature correction:
        tan(alpha(s)) = [h(s) - h0 - s^2 / (2 * R_moon)] / s
        where h0 = ground_elevation + observer_mast_height
    """
    
    def __init__(self, loader: Optional[DemLoader] = None):
        self.dem_loader = loader or dem_loader

    def compute_horizon_point(
        self,
        lat_deg: float,
        lon_deg: float,
        obs_total_elev_m: float,
        azimuth_deg: float,
        max_dist_m: float = 60000.0,
        radial_step_m: float = 200.0
    ) -> HorizonPoint:
        """
        Ray-trace a single azimuth radial line of sight from the observer out to max_dist_m.
        
        Args:
            lat_deg: Observer latitude
            lon_deg: Observer longitude
            obs_total_elev_m: Total observer elevation (ground elevation + mast height in meters)
            azimuth_deg: Azimuth angle clockwise from North [0, 360)
            max_dist_m: Maximum search distance in meters (e.g. 60,000 m = 60 km)
            radial_step_m: Radial sampling distance step in meters
            
        Returns:
            HorizonPoint containing azimuth_deg, horizon_elevation_deg, obstruction_distance_km, and blocking_feature.
        """
        distances = np.arange(100.0, max_dist_m + radial_step_m, radial_step_m)
        max_alpha_rad = -math.pi / 2.0
        best_dist_m = distances[0]
        
        # Lunar curvature drop: s^2 / (2 * R_moon)
        curvature_drops = (distances ** 2) / (2.0 * MOON_MEAN_RADIUS_M)
        
        # Sample elevations along ray
        # For efficiency, evaluate points along the great circle path
        for dist_m, curv_drop in zip(distances, curvature_drops):
            target_lat, target_lon = forward_geodesic(lat_deg, lon_deg, azimuth_deg, dist_m)
            terrain_h = self.dem_loader.sample_elevation(target_lat, target_lon)
            
            # Subtended geometric angle
            delta_h = terrain_h - obs_total_elev_m - curv_drop
            alpha_rad = math.atan2(delta_h, dist_m)
            
            if alpha_rad > max_alpha_rad:
                max_alpha_rad = alpha_rad
                best_dist_m = dist_m

        horizon_elev_deg = round(math.degrees(max_alpha_rad), 2)
        obstruction_dist_km = round(best_dist_m / 1000.0, 1)
        
        # Categorize blocking feature
        if obstruction_dist_km < 4.0:
            feature = "Local Crest / Crater Wall"
        elif obstruction_dist_km < 18.0:
            feature = "Crater Rim Elevation"
        elif obstruction_dist_km < 40.0:
            feature = "Regional Highland Massif"
        else:
            feature = "Distant Topographic Horizon"
            
        return HorizonPoint(
            azimuth_deg=round(azimuth_deg % 360.0, 1),
            horizon_elevation_deg=horizon_elev_deg,
            obstruction_distance_km=obstruction_dist_km,
            blocking_feature=feature
        )

    def trace_full_horizon(
        self,
        lat_deg: float,
        lon_deg: float,
        elevation_m: Optional[float] = None,
        observer_height_m: float = 2.0,
        max_distance_km: float = 60.0,
        azimuth_step_deg: float = 1.0
    ) -> List[HorizonPoint]:
        """
        Compute the complete 360-degree local horizon elevation mask.
        
        Args:
            lat_deg: Observer latitude
            lon_deg: Observer longitude
            elevation_m: Ground elevation in meters (if None, sampled from active DEM)
            observer_height_m: Mast/antenna instrument height in meters
            max_distance_km: Maximum radial search radius in km
            azimuth_step_deg: Azimuth sampling resolution step in degrees
            
        Returns:
            List of HorizonPoint objects ordered from azimuth 0.0° to 359.0°
        """
        # Ground elevation: anchor to the active DEM surface at (lat_deg, lon_deg)
        # to ensure ray tracing originates from the actual topography rather than nominal approximations.
        if self.dem_loader:
            ground_elev = self.dem_loader.sample_elevation(lat_deg, lon_deg)
        else:
            ground_elev = elevation_m if elevation_m is not None else 0.0

        total_obs_elevation = ground_elev + observer_height_m
        max_dist_m = max_distance_km * 1000.0
        
        # Determine radial step based on resolution
        radial_step_m = 250.0 if azimuth_step_deg <= 1.0 else 150.0
        
        azimuths = np.arange(0.0, 360.0, azimuth_step_deg)
        points: List[HorizonPoint] = []
        
        for az in azimuths:
            pt = self.compute_horizon_point(
                lat_deg=lat_deg,
                lon_deg=lon_deg,
                obs_total_elev_m=total_obs_elevation,
                azimuth_deg=float(az),
                max_dist_m=max_dist_m,
                radial_step_m=radial_step_m
            )
            points.append(pt)
            
        return points


# Global singleton instance
ray_tracer = LolaRayTracer()
