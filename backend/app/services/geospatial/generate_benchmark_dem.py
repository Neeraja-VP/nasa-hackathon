"""
LUNA NAVIGATOR — Benchmark LOLA DEM Generator (Member 3 Ownership)
Generates calibrated benchmark digital elevation models (NPZ and GeoTIFF)
for the Lunar South Pole (80°S - 90°S) matching NASA LOLA GDR specifications.
"""

import os
import math
import numpy as np
from PIL import Image

from app.core.constants import MOON_MEAN_RADIUS_M
from app.services.geospatial.projections import PolarStereographic
from app.services.geospatial.dem_loader import dem_loader


def generate_benchmark_tile(
    output_dir: str,
    width: int = 401,
    height: int = 401,
    pixel_scale_m: float = 1000.0
) -> str:
    """
    Generate calibrated benchmark DEM array centered at the South Pole.
    
    Default parameters:
        width: 401 pixels
        height: 401 pixels
        pixel_scale_m: 1000.0 m (1 km/px covering +/- 200 km around South Pole)
        
    Saves:
        - datasets/dem/lola_south_pole_benchmark.npz
        - datasets/dem/lola_south_pole_benchmark.tif
    """
    os.makedirs(output_dir, exist_ok=True)
    proj = PolarStereographic()
    
    center_x = (width - 1) / 2.0
    center_y = (height - 1) / 2.0
    
    elevation_grid = np.zeros((height, width), dtype=np.float32)
    
    print(f"Generating LOLA South Pole benchmark raster ({width}x{height}, scale={pixel_scale_m}m/px)...")
    
    for y_idx in range(height):
        for x_idx in range(width):
            lat, lon = proj.pixel_to_latlon(
                pixel_x=float(x_idx),
                pixel_y=float(y_idx),
                pixel_scale_m=pixel_scale_m,
                center_pixel_x=center_x,
                center_pixel_y=center_y
            )
            # Evaluate calibrated LOLA elevation
            h = dem_loader.calibrated_lola_elevation(lat, lon)
            elevation_grid[y_idx, x_idx] = h

    # 1. Save NPZ
    npz_path = os.path.join(output_dir, "lola_south_pole_benchmark.npz")
    np.savez_compressed(
        npz_path,
        elevation=elevation_grid,
        pixel_scale_m=pixel_scale_m,
        center_pixel_x=center_x,
        center_pixel_y=center_y,
        product_id="NASA_LOLA_LDEM_SOUTH_POLE_BENCHMARK",
        datum_radius_m=MOON_MEAN_RADIUS_M
    )
    print(f"Saved NPZ DEM to: {npz_path}")

    # 2. Save TIFF
    tif_path = os.path.join(output_dir, "lola_south_pole_benchmark.tif")
    img = Image.fromarray(elevation_grid)
    img.save(tif_path)
    print(f"Saved GeoTIFF DEM to: {tif_path}")

    return npz_path


if __name__ == "__main__":
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "datasets", "dem"))
    generate_benchmark_tile(base_dir, width=251, height=251, pixel_scale_m=1200.0)
