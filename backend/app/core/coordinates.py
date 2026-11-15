"""
LUNA NAVIGATOR — Selenographic Coordinate & Local Horizon Transformation Engine
Implements IAU Mean Earth/Polar Axis (ME) frame mathematics and topocentric horizon conversions.
"""

import math
from typing import Tuple, Dict, Any
from app.core.constants import MOON_MEAN_RADIUS_M, MOON_MEAN_RADIUS_KM


def selenographic_to_cartesian(
    lat_deg: float,
    lon_deg: float,
    elevation_m: float = 0.0
) -> Tuple[float, float, float]:
    """
    Convert spherical Selenographic coordinates (Mean Earth frame) to 3D Cartesian coordinates (meters).
    
    Args:
        lat_deg: Latitude in degrees [-90.0, +90.0] (negative for South Pole)
        lon_deg: Longitude in degrees [0.0, 360.0) or [-180.0, +180.0] (East positive)
        elevation_m: Height in meters above the standard lunar reference sphere (R=1737.4 km)
        
    Returns:
        (X, Y, Z) Cartesian coordinates in meters relative to lunar center of mass
    """
    phi = math.radians(lat_deg)
    lam = math.radians(lon_deg)
    r = MOON_MEAN_RADIUS_M + elevation_m
    
    x = r * math.cos(phi) * math.cos(lam)
    y = r * math.cos(phi) * math.sin(lam)
    z = r * math.sin(phi)
    return (x, y, z)


def cartesian_to_selenographic(
    x_m: float,
    y_m: float,
    z_m: float
) -> Tuple[float, float, float]:
    """
    Convert 3D Moon-centered Cartesian coordinates (meters) to spherical Selenographic coordinates.
    
    Returns:
        (latitude_deg, longitude_deg, elevation_m)
    """
    r = math.sqrt(x_m**2 + y_m**2 + z_m**2)
    if r == 0:
        return (0.0, 0.0, -MOON_MEAN_RADIUS_M)
    
    lat_rad = math.asin(max(-1.0, min(1.0, z_m / r)))
    lon_rad = math.atan2(y_m, x_m)
    
    lat_deg = math.degrees(lat_rad)
    lon_deg = math.degrees(lon_rad)
    if lon_deg < 0:
        lon_deg += 360.0
        
    elevation_m = r - MOON_MEAN_RADIUS_M
    return (lat_deg, lon_deg, elevation_m)


def get_topocentric_basis(
    lat_deg: float,
    lon_deg: float
) -> Tuple[Tuple[float, float, float], Tuple[float, float, float], Tuple[float, float, float]]:
    """
    Compute orthonormal basis vectors (East, North, Up) for an observer on the lunar surface.
    
    In the IAU Mean Earth / Polar Axis frame:
    - Up (Zenith): Normal to the mean lunar reference sphere
    - North: Tangent pointing along meridian toward lunar North Pole (+Z)
    - East: Tangent pointing toward increasing longitude (East = North x Up)
    
    Returns:
        (hat_east, hat_north, hat_up) where each is a unit 3D vector (x, y, z)
    """
    phi = math.radians(lat_deg)
    lam = math.radians(lon_deg)
    
    # Up (Zenith unit vector normal to sphere)
    u_x = math.cos(phi) * math.cos(lam)
    u_y = math.cos(phi) * math.sin(lam)
    u_z = math.sin(phi)
    
    # North unit vector pointing toward Lunar North Pole (+Z)
    n_x = -math.sin(phi) * math.cos(lam)
    n_y = -math.sin(phi) * math.sin(lam)
    n_z = math.cos(phi)
    
    # East unit vector (East = North x Up)
    e_x = -math.sin(lam)
    e_y = math.cos(lam)
    e_z = 0.0
    
    return ((e_x, e_y, e_z), (n_x, n_y, n_z), (u_x, u_y, u_z))


def vector_to_azimuth_elevation(
    target_vector_m: Tuple[float, float, float],
    observer_lat_deg: float,
    observer_lon_deg: float
) -> Tuple[float, float, float]:
    """
    Convert a relative vector (from observer to target body in lunar coordinates, meters)
    into topocentric Azimuth and Elevation angles.
    
    Args:
        target_vector_m: (dx, dy, dz) from observer to target in meters
        observer_lat_deg: Observer latitude in degrees
        observer_lon_deg: Observer longitude in degrees
        
    Returns:
        (azimuth_deg, elevation_deg, range_m)
        azimuth_deg: 0° = North, 90° = East, 180° = South, 270° = West (clockwise)
        elevation_deg: angle above horizontal tangent plane [-90°, +90°]
        range_m: slant range in meters
    """
    dx, dy, dz = target_vector_m
    slant_range = math.sqrt(dx**2 + dy**2 + dz**2)
    if slant_range == 0:
        return (0.0, 90.0, 0.0)
    
    east_basis, north_basis, up_basis = get_topocentric_basis(observer_lat_deg, observer_lon_deg)
    
    # Project relative vector onto local topocentric axes
    rho_east = dx * east_basis[0] + dy * east_basis[1] + dz * east_basis[2]
    rho_north = dx * north_basis[0] + dy * north_basis[1] + dz * north_basis[2]
    rho_up = dx * up_basis[0] + dy * up_basis[1] + dz * up_basis[2]
    
    # Elevation angle above tangent plane
    elevation_rad = math.asin(max(-1.0, min(1.0, rho_up / slant_range)))
    elevation_deg = math.degrees(elevation_rad)
    
    # Azimuth clockwise from North
    azimuth_rad = math.atan2(rho_east, rho_north)
    azimuth_deg = math.degrees(azimuth_rad)
    if azimuth_deg < 0:
        azimuth_deg += 360.0
        
    return (azimuth_deg, elevation_deg, slant_range)


def lunar_curvature_drop(distance_m: float) -> float:
    """
    Calculate the elevation drop (in meters) due to the spherical curvature of the Moon
    at a ground arc distance s.
    
    Formula: Delta_h = s^2 / (2 * R_moon)
    """
    return (distance_m ** 2) / (2.0 * MOON_MEAN_RADIUS_M)


def great_circle_distance_m(
    lat1_deg: float,
    lon1_deg: float,
    lat2_deg: float,
    lon2_deg: float
) -> float:
    """
    Calculate great circle ground distance along the lunar sphere between two selenographic points.
    
    Uses Haversine formula on sphere with R = 1737.4 km.
    """
    phi1 = math.radians(lat1_deg)
    phi2 = math.radians(lat2_deg)
    dphi = math.radians(lat2_deg - lat1_deg)
    dlam = math.radians(lon2_deg - lon1_deg)
    
    a = math.sin(dphi / 2.0)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2.0)**2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return MOON_MEAN_RADIUS_M * c


def apparent_angular_diameter_deg(radius_km: float, distance_km: float) -> float:
    """
    Calculate apparent angular diameter (in degrees) of a spherical celestial body
    at a given distance.
    
    Formula: theta = 2 * arctan(radius / distance)
    """
    if distance_km <= 0 or radius_km <= 0:
        return 0.0
    return math.degrees(2.0 * math.atan2(radius_km, distance_km))


def subtended_horizon_angle_deg(
    observer_elevation_m: float,
    terrain_elevation_m: float,
    ground_distance_m: float
) -> float:
    """
    Calculate the geometric elevation angle (in degrees) subtended by a terrain feature
    accounting for lunar spherical curvature.
    
    Formula: tan(alpha) = [h_terrain - h_observer - s^2 / (2 * R_moon)] / s
    """
    if ground_distance_m <= 0:
        return 0.0
    curv_drop = lunar_curvature_drop(ground_distance_m)
    delta_h = terrain_elevation_m - observer_elevation_m - curv_drop
    return math.degrees(math.atan2(delta_h, ground_distance_m))
