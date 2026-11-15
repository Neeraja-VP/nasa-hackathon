# NASA Data Availability, Integration & Scientific Accuracy Audit Report

**Project**: LUNA NAVIGATOR — Autonomous Lunar South-Pole Landing Site Characterization & Mission-Planning Platform  
**Target Body**: Moon (IAU Body ID: 301, South Pole Region: $80^\circ\text{S} - 90^\circ\text{S}$)  
**Repository**: `https://github.com/Sripradha-03/nasa-hackathon.git`  
**Date of Audit**: November 15, 2026  
**Auditor**: Antigravity Autonomous Scientific Verification Engine  

---

## 1. Executive Summary

A comprehensive, non-destructive scientific and empirical data audit was conducted on the **LUNA NAVIGATOR** project. The primary objective was to establish whether the application genuinely retrieves, ingests, and computes upon official NASA scientific data (specifically NASA PDS LOLA altimetry and NASA JPL Horizons orbital ephemerides), or whether it relies on synthetic, benchmark, cached, or analytical models.

### Key Audit Findings:
1. **NASA JPL Horizons API Integration: [PASS]**  
   The application features a fully functional, live HTTP client interfacing with NASA's Jet Propulsion Laboratory (JPL) SSD Horizons REST API (`https://ssd.jpl.nasa.gov/api/horizons.api`). Live network queries using target ID `10` (Sun) and `399` (Earth) from lunar topocentric surface coordinates (`coord@301`) were empirically executed and verified. The parser extracts genuine topocentric azimuth, elevation, and range, which are actively consumed by the illumination and direct-to-Earth (DTE) communication pipelines.
2. **NASA LOLA Elevation Data: [PARTIAL]**  
   The project does **not** currently contain raw NASA Planetary Data System (PDS) LOLA raster files (`lola_south_pole_100m.tif`, `ldem_80s_100m.img`, or `ldem_80s_100m.lbl`). Instead, the active runtime dataset is a synthesized benchmark grid (`datasets/dem/lola_south_pole_benchmark.npz` / `.tif`, 251×251 pixels at 1200 m/pixel) calibrated against published NASA LOLA GDR spot elevations for known Artemis candidate sites. While a complete PDS download pipeline exists in `dem_downloader.py`, large raw PDS rasters (580 MB – 2.9 GB) have not been downloaded to the repository.
3. **Cache & Fallback Architecture: [PASS]**  
   The three operational regimes—**Case A (Live NASA Data)**, **Case B (Cached NASA Data)**, and **Case C (Analytical Fallback)**—were empirically tested. Provenance tagging is strictly honored across all API responses, preventing synthetic or analytical outputs from being misattributed as live NASA measurements.
4. **Scientific Accuracy & Calculation Review: [PARTIAL]**  
   - **FSPL**: The Python calculation engine (`CommunicationEngine`) accurately implements the Friis free-space transmission formula yielding **222.63 dB** at 8.4 GHz (lunar distance $d = 384,400\text{ km}$). A **20 dB documentation error** exists in `FINAL_IMPLEMENTATION_REPORT.md` (citing $\approx 202.5\text{ dB}$).
   - **Antenna Elevation Mask**: The codebase implements a default of $+0.5^\circ$ with input ranges $[-10^\circ, +45^\circ]$, while documentation contains conflicting claims of $+2.0^\circ$ and $-2.0^\circ$.
   - **Scenario Capacity**: Backend schemas strictly support up to **8 scenarios**, while the frontend UI artificially caps comparison rendering at **6 scenarios**.
5. **Runtime Test Suite: [PASS]**  
   All 108 backend tests pass cleanly ($100\%$ pass rate). The frontend production build compiles with zero errors.

---

## 2. Project Architecture & Data-Flow Overview

LUNA NAVIGATOR is structured as a decoupled, micro-service-oriented scientific web application:

```
[ NASA JPL Horizons API ] (Live HTTPS: ssd.jpl.nasa.gov)
           │
           ▼
[ backend/app/services/horizons_client.py ]
   │ (Cache Check / SHA-256 Keyed Disk Cache in datasets/cache/horizons)
   ├─► [LIVE NASA DATA] (Parsed Observer Ephemeris: Azimuth, Elevation, Distance)
   └─► [CACHED NASA DATA] / [ANALYTICAL DE440 FALLBACK]
           │
           ├────────────────────────┬────────────────────────┐
           ▼                        ▼                        ▼
[ EphemerisEngine ]     [ IlluminationEngine ]     [ CommunicationEngine ]
 (Sun & Earth Vector)    (Limb Ray-Tracing)         (RF Link Budget / DTE)
           │                        │                        │
           └────────────────────────┴────────────────────────┘
                                    │
    [ datasets/dem/lola_south_pole_benchmark.npz ] (Active Runtime DEM)
                                    │
                                    ▼
                         [ DemLoader / RayTracer ]
                          (Horizon Mask Profile)
                                    │
                                    ▼
                         [ AnalysisEngine / MCDA ]
                        (Candidate Site Scoring)
                                    │
                                    ▼
                         [ FastAPI REST Endpoints ]
                       (/api/v1/sites, /analyze, /compare)
                                    │
                                    ▼
                      [ React + Vite 6 + Tailwind UI ]
              (CesiumJS 3D Globe, Horizon Plots, Mission Timelines)
```

### Complete Data Flow Verification:
1. **Ephemeris Ingestion**: `HorizonsClient` generates request parameters $\rightarrow$ sends HTTPS GET to JPL $\rightarrow$ parses CSV block between `$$SOE` and `$$EOE` $\rightarrow$ serializes into `EphemerisPoint` schema $\rightarrow$ feeds topocentric coordinate vectors into `IlluminationEngine` and `CommunicationEngine`.
2. **DEM & Horizon Sampling**: `DemLoader` selects the best available raster (`.npz` $\rightarrow$ `.tif` $\rightarrow$ procedural fallback) $\rightarrow$ `HorizonRayTracer` executes azimuthal Line-of-Sight (LoS) sampling at $1^\circ$ intervals out to $50\text{ km}$ accounting for lunar spherical drop $s^2 / (2 R_{moon})$ $\rightarrow$ produces a 360-element horizon elevation mask.
3. **Mission Timeline Synthesis**: Evaluates solar vector against terrain horizon mask to compute sunlight intervals, eclipse durations, and solar panel power generation (via 3D incidence vectors on Horizontal, Vertical, Tilted, or Dual-Axis tracking arrays) $\rightarrow$ evaluates Earth vector against horizon mask and antenna elevation limit to calculate DTE comm windows and margin.

---

## 3. NASA LOLA Altimetry Data Verification

### 3.1 Dataset Inventory in `datasets/dem/`

| Filename | File Size | Data Source & Provenance | Actual Format | Resolution | Geographic Coverage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `lola_south_pole_benchmark.npz` | 191,423 bytes (~187 KB) | Benchmark Synthesized Grid (`generate_benchmark_dem.py`) | NumPy Compressed Array (`.npz`) | 1200 m/pixel | $80^\circ\text{S} - 90^\circ\text{S}$ ($301.2 \times 301.2\text{ km}$) |
| `lola_south_pole_benchmark.tif` | 252,138 bytes (~246 KB) | Benchmark Synthesized Grid (`generate_benchmark_dem.py`) | Single-band Float32 GeoTIFF | 1200 m/pixel | $80^\circ\text{S} - 90^\circ\text{S}$ ($301.2 \times 301.2\text{ km}$) |
| `lola_south_pole_100m.tif` | **NOT FOUND** | Official NASA LOLA PDS High-Res Altimetry | GeoTIFF | 100 m/pixel | South Pole Region |
| `ldem_80s_100m.img` | **NOT FOUND** | Official NASA PDS LOLA DEM Binary Raster | PDS3 IMG | 100 m/pixel | $80^\circ\text{S} - 90^\circ\text{S}$ |
| `ldem_80s_100m.lbl` | **NOT FOUND** | NASA PDS3 Header Label | ASCII Text | N/A | Metadata for `ldem_80s_100m.img` |

### 3.2 Raster Properties & Coordinate Reference System (CRS)
Direct empirical inspection of `lola_south_pole_benchmark.npz` reveals:
- **Raster Dimensions**: $251 \times 251$ grid cells (63,001 float32 elevation values).
- **Spatial Resolution**: $1,200.0\text{ m/pixel}$ (1.2 km per cell).
- **Physical Extent**: $X \in [-150,600\text{ m}, +150,600\text{ m}]$, $Y \in [-150,600\text{ m}, +150,600\text{ m}]$.
- **Vertical Reference & Datum**: Mean lunar spherical radius $R_{moon} = 1,737,400.0\text{ m}$ (1,737.4 km).
- **Elevation Range**: Minimum $-2,993.02\text{ m}$ (deep crater floor), Maximum $+5,049.92\text{ m}$ (Malapert Mountain ridge).
- **CRS & Projection**: Lunar Polar Stereographic projection:
  $$\text{Standard Parallel } \phi_c = -90^\circ, \quad \text{Central Meridian } \lambda_0 = 0^\circ, \quad \text{Scale Factor } k_0 = 1.0$$
  This rigorously matches IAU2000 / IAU2015 Lunar Polar Stereographic standards used by NASA PDS LOLA GDR products.

### 3.3 Active Runtime Dataset Selection
Inspection of `backend/app/services/dem_loader.py` (`DemLoader._load_best_available_dem()`):
1. **Tier 1 (Targeted)**: Looks for `lola_south_pole_100m.tif`. (Status: Not found on disk).
2. **Tier 2 (Benchmark NPZ)**: Loads `datasets/dem/lola_south_pole_benchmark.npz`. (**ACTIVE RUNTIME DATASET**).
3. **Tier 3 (Benchmark GeoTIFF)**: Loads `datasets/dem/lola_south_pole_benchmark.tif`.
4. **Tier 4 (Procedural Fallback)**: Evaluates `calibrated_lola_elevation(lat, lon)` using lunar spherical harmonics.

### 3.4 Candidate Landing Site Elevation Verification
The project incorporates a ground-truth calibration table (`CANDIDATE_SITE_BENCHMARKS`) calibrated against NASA LOLA PDS measurements for candidate Artemis landing sites:
- **Shackleton Connecting Ridge**: $-89.54^\circ\text{S}, 124.00^\circ\text{E}$ $\rightarrow$ $+1,250.0\text{ m}$
- **Malapert Mountain**: $-85.99^\circ\text{S}, -2.93^\circ\text{E}$ $\rightarrow$ $+5,050.0\text{ m}$
- **de Gerlache Rim**: $-88.71^\circ\text{S}, -88.34^\circ\text{E}$ $\rightarrow$ $+1,100.0\text{ m}$
- **Connecting Ridge Extension**: $-89.78^\circ\text{S}, 153.00^\circ\text{E}$ $\rightarrow$ $+1,400.0\text{ m}$
- **Amundsen Rim**: $-85.34^\circ\text{S}, 83.21^\circ\text{E}$ $\rightarrow$ $+2,100.0\text{ m}$
- **Haworth Crater Floor (PSR)**: $-87.87^\circ\text{S}, -5.18^\circ\text{E}$ $\rightarrow$ $-2,800.0\text{ m}$

**Verdict on LOLA Elevation Data: [PARTIAL]**  
The projection, elevation datum, coordinate transformations, and site anchor elevations are scientifically valid and consistent with NASA LOLA standards. However, the spatial grid actively used is a synthesized 1.2 km/px benchmark tile, not the genuine raw 100m NASA PDS GeoTIFF/IMG file.

---

## 4. NASA JPL Horizons Live API Integration Verification

### 4.1 Horizons Service Specification
- **Endpoint**: `https://ssd.jpl.nasa.gov/api/horizons.api`
- **Observer Centre**: Topocentric lunar surface specified via `CENTER='coord@301'` and `COORD_TYPE='GEODETIC'`.
- **Site Coordinates**: Formatted as `'lon,lat,elev_km'` (e.g. `'124.0000,-89.5400,1.250'`).
- **Ephemeris Quantities**: `QUANTITIES='4,20'` (Apparent Azimuth & Elevation, Observer-Target Distance & Range-Rate).
- **Target Bodies**:
  - `COMMAND='10'` $\rightarrow$ **Sun**
  - `COMMAND='399'` $\rightarrow$ **Earth**
- **Reference Frame**: `REF_SYSTEM='ICRF'`, `APPARENT='AIRLESS'`, `CSV_FORMAT='YES'`.

### 4.2 Empirical Live API Verification Results
An empirical live network test was executed against `https://ssd.jpl.nasa.gov/api/horizons.api` using an isolated, empty temporary cache directory (`test_horizons_temp_cache`).

#### 1. Sun Ephemeris Query (Target 10):
- **Request Parameters**:
  ```python
  {
      'format': 'json',
      'COMMAND': '10',
      'EPHEM_TYPE': 'OBSERVER',
      'CENTER': 'coord@301',
      'SITE_COORD': "'124.0000,-89.5400,1.250'",
      'COORD_TYPE': 'GEODETIC',
      'START_TIME': '2026-12-01 00:00',
      'STOP_TIME': '2026-12-01 03:00',
      'STEP_SIZE': '1h',
      'QUANTITIES': '4,20',
      'REF_SYSTEM': 'ICRF',
      'CAL_FORMAT': 'CAL',
      'TIME_DIGITS': 'MINUTES',
      'ANG_FORMAT': 'DEG',
      'APPARENT': 'AIRLESS',
      'TIME_TYPE': 'UT',
      'CSV_FORMAT': 'YES'
  }
  ```
- **Live HTTP Status**: `200 OK`
- **API Response Length**: 4,688 bytes
- **Parsing Status**: Successfully parsed 4 time steps
- **Data Provenance Assigned**: `LIVE NASA HORIZONS DATA`
- **Extracted Observational Data**:
  - `2026-Dec-01 00:00 UT`: Azimuth = $155.0740^\circ$, Elevation = $+1.2721^\circ$, Distance = $147,553,103.6\text{ km}$ ($0.9863\text{ AU}$)
  - `2026-Dec-01 01:00 UT`: Azimuth = $155.6214^\circ$, Elevation = $+1.2730^\circ$, Distance = $147,553,889.2\text{ km}$
  - `2026-Dec-01 02:00 UT`: Azimuth = $156.1687^\circ$, Elevation = $+1.2739^\circ$, Distance = $147,554,675.3\text{ km}$
  - `2026-Dec-01 03:00 UT`: Azimuth = $156.7161^\circ$, Elevation = $+1.2748^\circ$, Distance = $147,555,461.9\text{ km}$

#### 2. Earth Ephemeris Query (Target 399):
- **Request Parameters**: Identical configuration with `COMMAND='399'`.
- **Live HTTP Status**: `200 OK`
- **API Response Length**: 4,712 bytes
- **Parsing Status**: Successfully parsed 4 time steps
- **Data Provenance Assigned**: `LIVE NASA HORIZONS DATA`
- **Extracted Observational Data**:
  - `2026-Dec-01 00:00 UT`: Azimuth = $241.6705^\circ$, Elevation = $-1.7061^\circ$, Distance = $376,565.2\text{ km}$
  - `2026-Dec-01 01:00 UT`: Azimuth = $241.6912^\circ$, Elevation = $-1.7014^\circ$, Distance = $376,572.8\text{ km}$
  - `2026-Dec-01 02:00 UT`: Azimuth = $241.7118^\circ$, Elevation = $-1.6967^\circ$, Distance = $376,580.4\text{ km}$
  - `2026-Dec-01 03:00 UT`: Azimuth = $241.7323^\circ$, Elevation = $-1.6920^\circ$, Distance = $376,588.1\text{ km}$

#### 3. Topocentric Frame Verification:
Calculated Earth elevation from Shackleton Ridge ($-89.54^\circ\text{S}, 124^\circ\text{E}$) is $-1.71^\circ$ (sub-horizon), accurately reproducing lunar topocentric parallax and southern polar limb viewing geometry. The coordinates are confirmed to be strictly **lunar topocentric**, not geocentric.

**Verdict on JPL Horizons API: [PASS]**  
Live querying, topocentric observer configuration, and parsing of NASA JPL Horizons data operate as designed.

---

## 5. Cache and Fallback Behavior Verification

The project's three data pathways were empirically tested to verify data integrity and provenance labeling:

| Test Case | Operating Condition | Network State | Cache State | Resulting Provenance | Status Code | System Warnings |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Case A** | Live NASA Query | Online (`use_live_horizons=True`) | Empty Cache | `LIVE NASA HORIZONS DATA` | `NOMINAL` | None |
| **Case B** | Cached NASA Data | Offline / Fast-Path (`use_live_horizons=False`) | Cache Populated | `CACHED NASA HORIZONS DATA` | `NOMINAL` | None |
| **Case C** | Analytical Fallback | Offline / Failed Request | Empty Cache | `ANALYTICAL FALLBACK DATA` | `FALLBACK_APPLIED` | `"Using validated analytical DE440 ephemeris model."` |

### Provenance Integrity:
- The system computes an MD5/SHA-256 hash of `(target, lat, lon, elev, start, stop, step)` as the cache key.
- Disk cache entries are stored in `datasets/cache/horizons/<hash>.json`.
- When an analytical fallback occurs, the `provenance` field is explicitly set to `ANALYTICAL FALLBACK DATA` or `ANALYTICAL DE440 EPHEMERIS`. The system **never** mislabels synthetic or analytical outputs as live NASA data.

**Verdict on Cache & Fallback: [PASS]**  
The triage logic rigorously preserves data provenance across all states.

---

## 6. Actual Runtime Data-Source Classification Matrix

Every key analytical capability within LUNA NAVIGATOR was traced from data ingestion to frontend visualization:

| Feature / Capability | Active Data Source | Classification | Verification Direct Evidence |
| :--- | :--- | :--- | :--- |
| **Sun Topocentric Vector** | NASA JPL Horizons REST API | **LIVE NASA / CACHED NASA** | `HorizonsClient.get_sun_ephemeris()` queried `https://ssd.jpl.nasa.gov/api/horizons.api`; returned topocentric azimuth/elevation parsed into `EphemerisPoint`. |
| **Earth Topocentric Vector** | NASA JPL Horizons REST API | **LIVE NASA / CACHED NASA** | `HorizonsClient.get_earth_ephemeris()` queried JPL API with target `399`, observer `coord@301`; topocentric parallax verified. |
| **Candidate Site Elevation** | Calibrated Reference Table | **BENCHMARK DATA** | Exact site heights anchored to `CANDIDATE_SITE_BENCHMARKS` table derived from LOLA GDR published data. |
| **Regional DEM Grid** | `lola_south_pole_benchmark.npz` | **BENCHMARK DATA** | 251×251 grid generated from calibrated regional harmonic model; $1.2\text{ km/pixel}$ resolution. |
| **Horizon Ray-Tracing** | Line-of-Sight Azimuthal Scanner | **HYBRID BENCHMARK / ANALYTICAL** | Ray traces 360 azimuth rays over the benchmark DEM, applying $s^2 / (2 R_{moon})$ lunar curvature drop. |
| **Solar Illumination Windows** | Solar Vector vs. Horizon Mask | **LIVE/CACHED NASA + BENCHMARK DEM** | Direct ray-tracing between JPL topocentric solar vector and DEM terrain horizon profile. |
| **DTE Comm Windows** | Earth Vector vs. Horizon & Mask | **LIVE/CACHED NASA + BENCHMARK DEM** | Evaluates JPL Earth elevation against local terrain mask and antenna elevation limit. |
| **RF Link Budget (FSPL/Eb/N0)**| Analytical Friis Model | **ANALYTICAL MODEL** | Friis equation at 8.4 GHz yielding 222.63 dB FSPL. Evaluates received vs. required $E_b/N_0$. |
| **EPS Power & Battery Sim** | Solar Vector + Battery ODE | **ANALYTICAL MODEL** | Computes 3D solar incidence angle on panels + depth-of-discharge battery state equations. |
| **MCDA Site Ranking** | Multi-Criteria Decision Engine | **ANALYTICAL MODEL** | Linear weighted normalization across 6 criteria with boolean constraint filters. |
| **CesiumJS 3D Surface Scene** | Procedural Moon Ellipsoid / Terrain | **HARDCODED / DEMO DATA** | Standard Cesium Ion Moon ellipsoid with procedural visual shading; not rendering LOLA heightmap directly in WebGL. |

---

## 7. Scientific Calculation & Consistency Review

### 7.1 Free-Space Path Loss (FSPL) Verification
- **Documentation Claim (`FINAL_IMPLEMENTATION_REPORT.md:59`)**:
  > *"Free-space path loss (FSPL) at 8.4 GHz across lunar distance (~384,400 km): approximately 202.5 dB"*
- **Theoretical Calculation**:
  The physical formula for Free-Space Path Loss is:
  $$FSPL = 20 \log_{10}(d) + 20 \log_{10}(f) + 20 \log_{10}\left(\frac{4 \pi}{c}\right)$$
  For center distance $d = 384,400,000\text{ m}$ and frequency $f = 8.4 \times 10^9\text{ Hz}$ ($c = 299,792,458\text{ m/s}$):
  $$FSPL = 20 \log_{10}(3.844 \times 10^8) + 20 \log_{10}(8.4 \times 10^9) + 20 \log_{10}\left(\frac{4 \pi}{299,792,458}\right)$$
  $$FSPL = 171.696 + 198.486 - 147.552 = 222.63\text{ dB}$$
  - At lunar perigee ($d = 363,300\text{ km}$): $FSPL = 222.14\text{ dB}$
  - At lunar apogee ($d = 405,500\text{ km}$): $FSPL = 223.09\text{ dB}$
- **Empirical Code Inspection (`CommunicationEngine.calculate_link_budget()`)**:
  ```python
  fspl = 20 * math.log10(distance_m) + 20 * math.log10(frequency_hz) - 147.55
  ```
  Evaluated in code: **$222.63\text{ dB}$**.
- **Finding**: **The implementation code is physically correct.** The documentation in `FINAL_IMPLEMENTATION_REPORT.md` and `docs/demonstration-guide.md` contains a **20 dB typographical error** ($\approx 202.5\text{ dB}$ instead of $222.6\text{ dB}$).

### 7.2 Minimum Antenna Elevation Mask Consistency
- `FINAL_IMPLEMENTATION_REPORT.md:61`: States **$+2.0^\circ$** threshold.
- `docs/demonstration-guide.md:74`: States **$-2.0^\circ$** threshold for mountain peaks.
- `backend/app/core/constants.py:48`: `DEFAULT_MIN_COMM_ELEVATION_DEG = 0.5`.
- `backend/app/schemas/communication.py:27`: Field validation allows `ge=-10.0, le=45.0, default=0.0`.
- `frontend/src/utils/constants.js:52`: `DEFAULT_MIN_ELEVATION_DEG = 0.5`.
- **Finding**: While physical negative elevation masks (down to $-2^\circ$) are valid for high-altitude peaks (e.g. Malapert Mountain looking over depressed terrain), the documentation exhibits internal contradiction between $+2.0^\circ$ and $-2.0^\circ$.

### 7.3 Maximum Scenario Count Consistency
- `backend/app/schemas/analysis.py:91`:
  ```python
  scenarios: List[ScenarioConfig] = Field(..., min_length=2, max_length=8)
  ```
- `backend/app/api/v1/endpoints/compare.py`: Validates up to 8 scenarios.
- `frontend/src/components/SiteComparison.jsx`:
  ```javascript
  if (scenarios.length >= 6) { /* blocks addition */ }
  ```
- `FINAL_IMPLEMENTATION_REPORT.md:73`: Mentions "up to 6 scenarios".
- **Finding**: Backend supports 8 scenarios; frontend UI restricts users to 6 scenarios.

### 7.4 Lunar Polar Stereographic Projection Formulation
The project's projection engine (`PolarStereographic` in `backend/app/utils/projections.py`) implements:
$$r = 2 R_{moon} \tan\left(\frac{\pi/2 - |\phi|}{2}\right), \quad X = r \sin(\lambda), \quad Y = -r \cos(\lambda)$$
This is the standard conformal Polar Stereographic projection with standard parallel at $-90^\circ$ ($k_0 = 1.0$), exactly conforming to the projection of LOLA polar products (e.g., LDEM_80S).

---

## 8. Test Execution & Runtime Results

### 8.1 Backend Pytest Execution
- **Command**: `pytest`
- **Result**: `108 passed in 37.57s` ($100\%$ success rate).
- **Test Composition**:
  - Unit tests for coordinate transformations: **Passed**
  - Horizon ray-tracing geometry tests: **Passed**
  - Ephemeris parsing & analytical fallback tests: **Passed**
  - Link budget & FSPL math tests: **Passed**
  - Multi-Criteria Decision Analysis (MCDA) weighting tests: **Passed**
  - Fast-API REST endpoint validation: **Passed**
- **Note on Test Isolation**: Backend integration tests run in unit test mode using pre-recorded or synthetic fixtures to avoid uncontrolled external network dependencies during automated CI/CD runs.

### 8.2 Frontend Production Build
- **Command**: `npm --prefix frontend run build`
- **Result**: `✓ built in 14.65s` (Exit code: 0).
- Zero syntax, bundling, or module resolution errors.

---

## 9. Comprehensive Issues and Inconsistencies Discovered

| # | Item / Location | Severity | Description | Evidence / File Reference |
| :--- | :--- | :--- | :--- | :--- |
| **1** | FSPL Documentation Discrepancy | Minor / Doc | Documentation claims $\approx 202.5\text{ dB}$ FSPL; code correctly computes $222.63\text{ dB}$. | `FINAL_IMPLEMENTATION_REPORT.md:59` vs `backend/app/services/communication_engine.py:108` |
| **2** | Antenna Mask Inconsistency | Minor / Config | Conflicting documentation citations of $+2^\circ$ vs $-2^\circ$. Code defaults to $0.5^\circ$. | `FINAL_IMPLEMENTATION_REPORT.md:61` vs `docs/demonstration-guide.md:74` |
| **3** | Scenario Limit Disparity | Minor / UI | Backend schema permits 8 scenarios; frontend component limits to 6. | `backend/app/schemas/analysis.py:91` vs `frontend/src/components/SiteComparison.jsx` |
| **4** | Absence of Raw LOLA PDS Rasters | Moderate / Data | 100m raw PDS GeoTIFF/IMG not in repository; 1.2 km/px benchmark tile actively loaded. | Absence of `datasets/dem/lola_south_pole_100m.tif` |
| **5** | CesiumJS Terrain Elevation Ingestion | Minor / Visualization | Frontend CesiumJS view uses 3D sphere/ellipsoid rendering rather than draping the custom LOLA heightmap directly. | `frontend/src/components/GlobeView.jsx` |

---

## 10. Recommendations and Next Steps

1. **Reconcile Documentation Typo**: Update `FINAL_IMPLEMENTATION_REPORT.md` line 59 and `docs/demonstration-guide.md` line 153 to reflect the true $222.63\text{ dB}$ FSPL computed by the code.
2. **Align Scenario Limits**: Update `SiteComparison.jsx` to allow up to 8 scenarios matching the backend API contract.
3. **Optional Ingestion of High-Res LOLA GeoTIFF**: For sub-100m local slope fidelity, run `dem_downloader.py` under an approved environment to fetch the official 580 MB LDEM_80S GeoTIFF tile from NASA PDS (`https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/`).
4. **Standardize Antenna Mask Terminology**: Document in the UI that the default mask is $+0.5^\circ$, but elevated ridge-top stations support negative masks down to $-2.0^\circ$ for sub-horizontal visibility.

---

## 11. Verification Status Summary

| Area Checked | Status | Direct Verification Evidence |
| :--- | :--- | :--- |
| **NASA JPL Horizons API** | **PASS** | Live HTTPS query to `https://ssd.jpl.nasa.gov/api/horizons.api` verified with Sun (`10`) and Earth (`399`) from topocentric lunar surface (`coord@301`). Parsed azimuth/elevation actively feed illumination & comm engines. |
| **NASA LOLA Elevation Data** | **PARTIAL** | Projection, datum, and landing site benchmark elevations conform to NASA LOLA standards; active runtime raster is a calibrated $1.2\text{ km/px}$ benchmark grid, not raw 100m PDS IMG/GeoTIFF. |
| **Cache & Fallback Integrity**| **PASS** | Provenance tagging strictly differentiates `LIVE NASA HORIZONS DATA`, `CACHED NASA HORIZONS DATA`, and `ANALYTICAL FALLBACK DATA`. |
| **Link Budget Scientific Accuracy** | **PASS** | Code calculates physically exact Friis FSPL ($222.63\text{ dB}$ at 8.4 GHz). |
| **Test Suite Execution** | **PASS** | 108/108 pytest suite passed; frontend build compiled with zero errors. |
| **Overall Verification Status** | **PASS WITH DOCUMENTED NUANCES** | Real NASA Horizons ephemerides are actively operational; DEM elevation utilizes a scientifically anchored benchmark model rather than large raw PDS files. |
