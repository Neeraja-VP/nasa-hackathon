# NASA Scientific Data Acquisition & Configuration Guide

This guide documents the procedures for obtaining authentic NASA Lunar Orbiter Laser Altimeter (LOLA) elevation models, querying the NASA JPL Horizons Web API for celestial topocentric ephemerides, and configuring the Luna Navigator scientific engines.

---

## 1. NASA JPL Horizons Web API Integration

### 1.1 Overview & Architecture
Luna Navigator uses the official NASA Jet Propulsion Laboratory (JPL) Solar System Dynamics (SSD) Horizons API to compute topocentric positions of the Sun and Earth as observed from arbitrary coordinates on the lunar surface.

- **Endpoint**: `https://ssd.jpl.nasa.gov/api/horizons.api`
- **Reference Frame**: International Celestial Reference Frame (ICRF) / IAU Mean Earth/Polar Axis (ME) frame.
- **Planetary Ephemeris Kernel**: JPL DE440 / LE440 (high-precision numerical integration).

### 1.2 Target Identifiers
- Target `10`: Sun (Solar System Barycenter / Sun center)
- Target `399`: Earth
- Observer Center `coord@301`: Lunar surface topocentric observer coordinate on Body 301 (Moon).

### 1.3 Horizons Parameter Specifications
```http
GET https://ssd.jpl.nasa.gov/api/horizons.api?
    format=json&
    COMMAND='10'&
    CENTER='coord@301'&
    SITE_COORD='{lon_deg},{lat_deg},{elev_km}'&
    COORD_TYPE='GEODETIC'&
    MAKE_EPHEM='YES'&
    EPHEM_TYPE='OBSERVER'&
    START_TIME='2026-12-01 00:00'&
    STOP_TIME='2026-12-05 00:00'&
    STEP_SIZE='1 h'&
    QUANTITIES='4,20'&
    REF_SYSTEM='ICRF'&
    CSV_FORMAT='YES'
```

- `QUANTITIES='4,20'`:
  - `4`: Apparent topocentric Azimuth (`Azi_(a-app)`) and Elevation (`Elev_(a-app)`) in degrees, measured clockwise from Lunar North [0, 360) and above the local tangent horizon.
  - `20`: Target distance (`delta`) in AU and range-rate (`deldot`) in km/s.
- `SITE_COORD`: East longitude [0 to 360°], Selenographic latitude [-90 to +90°], and elevation in kilometers above reference sphere ($R_{moon} = 1737.4\text{ km}$).

### 1.4 Data Provenance Tagging & Caching
All simulation endpoints report the exact provenance of astronomical data:
- `LIVE NASA HORIZONS DATA`: Successfully queried via HTTPS from NASA JPL Horizons.
- `CACHED NASA HORIZONS DATA`: Retrieved from high-speed in-memory query cache.
- `ANALYTICAL FALLBACK DATA`: Computed via internal validated lunar ephemeris engine (accounting for solar obliquity and draconic/anomalistic physical libration) when offline or API requests time out.

---

## 2. NASA LOLA Digital Elevation Model (DEM) Acquisition

### 2.1 LOLA PDS Geosciences Catalog
NASA's Lunar Orbiter Laser Altimeter (LOLA) on the Lunar Reconnaissance Orbiter (LRO) has mapped the polar topography with sub-meter vertical precision.

| Product ID | Description | Resolution | Coverage | Size |
| :--- | :--- | :--- | :--- | :--- |
| `LDEM_80S_100M` | Primary South Pole Regional DEM | 100 m/pixel | 80°S – 90°S | ~580 MB |
| `LDEM_85S_20M` | Candidate Exploration Zones | 20 m/pixel | 85°S – 90°S | ~1.45 GB |
| `LDEM_875S_5M` | Ultra-High-Res Artemis Core | 5 m/pixel | 87.5°S – 90°S | ~2.9 GB |

### 2.2 Direct PDS Download Procedure
Files can be acquired directly from the NASA Planetary Data System (PDS) Geosciences Node at Washington University in St. Louis:

```bash
# 1. Download PDS Label (Metadata & Projection Parameters)
curl -O https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/ldem_80s_100m.lbl

# 2. Download Binary Raster (.img)
curl -O https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/ldem_80s_100m.img
```

### 2.3 Automated Acquisition CLI
Use the built-in downloader utility in Luna Navigator:
```powershell
# List all available NASA PDS elevation products
python luna-project/backend/app/services/geospatial/dem_downloader.py --list

# Download LDEM_80S_100M to datasets/dem/
python luna-project/backend/app/services/geospatial/dem_downloader.py --product LDEM_80S_100M --output-dir luna-project/datasets/dem/
```

### 2.4 Converting PDS `.img` to GeoTIFF using GDAL
If working with raw PDS `.img` files, convert them to standard GeoTIFF:
```bash
gdal_translate -of GTiff ldem_80s_100m.lbl lola_south_pole_100m.tif
```
Place the resulting `lola_south_pole_100m.tif` in `luna-project/datasets/dem/`. The DemLoader automatically detects and prioritizes this file over benchmark rasters.

### 2.5 Coordinate Reference System (CRS) & Projection
- **Datum**: Volumetric Mean Lunar Sphere ($R = 1,737,400\text{ meters}$).
- **Projection**: Polar Stereographic
  - Center Latitude ($\phi_0$): $-90.0^\circ$ (South Pole)
  - Center Longitude ($\lambda_0$): $0.0^\circ$ (Prime Meridian)
  - Standard Parallel ($\phi_{ts}$): $-90.0^\circ$ (tangent) or $-75.0^\circ$ (secant)
- **Pixel Scale**: 100 meters/pixel (or 1200 meters/pixel for the bundled regional benchmark tile `lola_south_pole_benchmark.npz`).

---

## 3. Configuration & Environment Variables

Create or update your `.env` file in `luna-project/backend/`:

```ini
# Environment Mode
ENVIRONMENT=production

# NASA JPL Horizons API Configuration (No API Key Required for Public Horizons API)
HORIZONS_API_BASE_URL=https://ssd.jpl.nasa.gov/api/horizons.api
HORIZONS_TIMEOUT_SECONDS=10.0
HORIZONS_MAX_RETRIES=2

# LOLA DEM Storage Path
LOLA_DEM_DIRECTORY=./datasets/dem

# CORS Configuration
ALLOWED_ORIGINS=["http://localhost:5173", "http://localhost:3000"]
```

> [!NOTE]
> NASA JPL Horizons Web API does not require authentication tokens or API keys. All queries include a descriptive user agent header (`LunaNavigator/1.0 (NASA Space Apps)`).

---

## 4. Verification and Validation

Verify both ephemeris and terrain engines by running the test suite:
```powershell
cd luna-project/backend
python -m pytest tests/test_horizons_service.py tests/test_ephemeris_engine.py tests/test_terrain_engine.py -v
```
All tests validate that calculations match NASA DE440 benchmarks within scientific tolerances ($< 0.25^\circ$ for Sun, $< 3.5^\circ$ for complex lunar libration).
