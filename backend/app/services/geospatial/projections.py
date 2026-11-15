"""
LUNA NAVIGATOR — Geospatial & Map Projections Module (Member 3 Ownership)
Implements IAU Mean Earth/Polar Axis (ME) frame projections and geodetic mathematics
for the Lunar South Pole (80°S - 90°S).
"""

import math
from typing import Tuple, Optional
from app.core.constants import MOON_MEAN_RADIUS_M, MOON_MEAN_RADIUS_KM


class PolarStereographic:
    """
    NASA LOLA Polar Stereographic Projection Engine.
    Conforms to NASA PDS Lunar Orbiter Laser Altimeter (LOLA) standard Gridded Data Record (GDR)
    projections (e.g., LDEM_80S_100M, LDEM_85S_20M).
    
    Parameters:
        center_lat_deg: Center latitude of projection (-90.0° for South Pole)
        center_lon_deg: Center longitude of projection (0.0° Prime Meridian)
        true_scale_lat_deg: Latitude of true scale (-90.0° for polar tangent, -75.0° for secant)
        radius_m: Reference lunar spherical datum radius (default 1,737,400.0 m)
    """
    
    def __init__(
        self,
        center_lat_deg: float = -90.0,
        center_lon_deg: float = 0.0,
        true_scale_lat_deg: float = -90.0,
        radius_m: float = MOON_MEAN_RADIUS_M
    ):
        self.center_lat_deg = center_lat_deg
        self.center_lon_deg = center_lon_deg
        self.true_scale_lat_deg = true_scale_lat_deg
        self.radius_m = radius_m
        
        # Scale factor at pole
        # For standard parallel phi_ts: k0 = (1 + sin(|phi_ts|)) / 2
        phi_ts_rad = math.radians(abs(true_scale_lat_deg))
        self.k0 = (1.0 + math.sin(phi_ts_rad)) / 2.0

    def forward(self, lat_deg: float, lon_deg: float) -> Tuple[float, float]:
        """
        Forward projection: Convert Selenographic (lat, lon) to projected Cartesian (X, Y) in meters.
        
        Args:
            lat_deg: Latitude in degrees [-90.0, -80.0] (South Pole)
            lon_deg: Longitude in degrees [0.0, 360.0)
            
        Returns:
            (x_m, y_m): Projected coordinates in meters relative to the South Pole (0, 0)
        """
        # Ensure colatitude from South Pole
        # For South Pole: colatitude c = 90 + lat (lat in [-90, 0])
        colat_rad = math.radians(90.0 + lat_deg)
        if colat_rad <= 0.0:
            return (0.0, 0.0)
            
        # Radial distance on stereographic plane: rho = 2 * R * k0 * tan(c / 2)
        rho = 2.0 * self.radius_m * self.k0 * math.tan(colat_rad / 2.0)
        
        rel_lon_rad = math.radians(lon_deg - self.center_lon_deg)
        x_m = rho * math.sin(rel_lon_rad)
        y_m = -rho * math.cos(rel_lon_rad)
        
        return (x_m, y_m)

    def inverse(self, x_m: float, y_m: float) -> Tuple[float, float]:
        """
        Inverse projection: Convert projected Cartesian (X, Y) in meters to Selenographic (lat, lon).
        
        Args:
            x_m: Projected X in meters
            y_m: Projected Y in meters
            
        Returns:
            (lat_deg, lon_deg): Selenographic coordinates in degrees
        """
        rho = math.hypot(x_m, y_m)
        if rho == 0.0:
            return (self.center_lat_deg, self.center_lon_deg)
            
        # c = 2 * atan(rho / (2 * R * k0))
        colat_rad = 2.0 * math.atan2(rho, 2.0 * self.radius_m * self.k0)
        colat_deg = math.degrees(colat_rad)
        lat_deg = colat_deg - 90.0
        
        # Longitude from angle
        # x = rho * sin(lon), y = -rho * cos(lon) => tan(lon) = x / (-y)
        rel_lon_rad = math.atan2(x_m, -y_m)
        lon_deg = (math.degrees(rel_lon_rad) + self.center_lon_deg) % 360.0
        if lon_deg < 0.0:
            lon_deg += 360.0
            
        return (lat_deg, lon_deg)

    def latlon_to_pixel(
        self,
        lat_deg: float,
        lon_deg: float,
        pixel_scale_m: float,
        center_pixel_x: float,
        center_pixel_y: float
    ) -> Tuple[float, float]:
        """
        Convert Selenographic coordinate to raster pixel line and sample coordinates.
        
        Args:
            lat_deg: Latitude in degrees
            lon_deg: Longitude in degrees
            pixel_scale_m: Pixel spatial resolution in meters (e.g. 100.0 or 20.0)
            center_pixel_x: Pixel X (sample) of the South Pole
            center_pixel_y: Pixel Y (line) of the South Pole
            
        Returns:
            (pixel_x, pixel_y): Floating-point pixel coordinates
        """
        x_m, y_m = self.forward(lat_deg, lon_deg)
        pixel_x = center_pixel_x + (x_m / pixel_scale_m)
        pixel_y = center_pixel_y - (y_m / pixel_scale_m)  # Image Y increases downwards
        return (pixel_x, pixel_y)

    def pixel_to_latlon(
        self,
        pixel_x: float,
        pixel_y: float,
        pixel_scale_m: float,
        center_pixel_x: float,
        center_pixel_y: float
    ) -> Tuple[float, float]:
        """
        Convert raster pixel line and sample coordinates to Selenographic (lat, lon).
        """
        x_m = (pixel_x - center_pixel_x) * pixel_scale_m
        y_m = -(pixel_y - center_pixel_y) * pixel_scale_m
        return self.inverse(x_m, y_m)


def forward_geodesic(
    lat_deg: float,
    lon_deg: float,
    azimuth_deg: float,
    distance_m: float,
    radius_m: float = MOON_MEAN_RADIUS_M
) -> Tuple[float, float]:
    """
    Direct / Forward Geodesic on the Lunar Sphere.
    Given an initial position, azimuth angle, and ground distance, compute destination (lat, lon).
    
    Args:
        lat_deg: Initial latitude [-90.0, 90.0]
        lon_deg: Initial longitude [0.0, 360.0)
        azimuth_deg: Azimuth clockwise from North [0.0, 360.0)
        distance_m: Ground arc distance in meters
        radius_m: Sphere radius in meters (default 1,737,400.0 m)
        
    Returns:
        (dest_lat_deg, dest_lon_deg)
    """
    if distance_m <= 0.0:
        return (lat_deg, lon_deg % 360.0)
        
    delta = distance_m / radius_m
    phi1 = math.radians(lat_deg)
    lam1 = math.radians(lon_deg)
    theta = math.radians(azimuth_deg)
    
    # Destination latitude
    sin_phi2 = math.sin(phi1) * math.cos(delta) + math.cos(phi1) * math.sin(delta) * math.cos(theta)
    sin_phi2 = max(-1.0, min(1.0, sin_phi2))
    phi2 = math.asin(sin_phi2)
    
    # Destination longitude
    y = math.sin(theta) * math.sin(delta) * math.cos(phi1)
    x = math.cos(delta) - math.sin(phi1) * sin_phi2
    dlam = math.atan2(y, x)
    
    dest_lat = math.degrees(phi2)
    dest_lon = (math.degrees(lam1 + dlam)) % 360.0
    if dest_lon < 0.0:
        dest_lon += 360.0
        
    return (dest_lat, dest_lon)
