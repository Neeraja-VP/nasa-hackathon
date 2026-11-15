# LUNA NAVIGATOR — Planetary Data Sources & Acquisition Specification

All calculations in LUNA NAVIGATOR utilize actual scientific datasets released by NASA Planetary Data System (PDS) and the Jet Propulsion Laboratory (JPL).

---

## 1. NASA JPL Horizons Ephemeris System

- **Provider**: Solar System Dynamics Group, NASA Jet Propulsion Laboratory, Caltech.
- **REST API Endpoint**: `https://ssd.jpl.nasa.gov/api/horizons.api`
- **Ephemeris Base**: DE440 / LE440 High-Precision Planetary and Lunar Ephemerides.
- **Primary Body Targets**:
  - `10`: Sun (Solar System Barycenter / Center of Sun)
  - `399`: Earth (Geocenter)
  - `301`: Moon Center of Mass
- **Observer Coordinate Format**:
  - Center parameter: `CENTER = 'coord@301'` (Topocentric observer on the Moon).
  - Observer coordinate parameter: `SITE_COORD = 'lon,lat,elev_km'`
    - Longitude: East positive (0–360° or -180° to +180°).
    - Latitude: Selenographic (-90° to +90°).
    - Elevation: Altitude in kilometers above the reference lunar radius ($R_{moon} = 1737.4\text{ km}$).
- **Key Query Parameters**:
  - `EPHEM_TYPE = 'OBSERVER'`
  - `QUANTITIES = '4,20'` (Topocentric Azimuth, Elevation, Range, and Range-rate)
  - `COORD_TYPE = 'GEODETIC'`
  - `REF_SYSTEM = 'ICRF'`
  - `CAL_FORMAT = 'CAL'`
  - `APPARENT = 'AIRLESS'`
  - `CSV_FORMAT = 'YES'`
- **Physical Libration & Orientation**:
  - Topocentric calculations queried with `CENTER = 'coord@301'` use JPL DE440/LE440 physical librations.
  - Accounts for the Moon's true polar orientation, diurnal rotation, optical libration, physical libration in latitude ($\pm 6.7^\circ$) and longitude ($\pm 7.9^\circ$), and relativistic light-time corrections.

### Data Transparency & Provenance Tags
Every calculation response in LUNA NAVIGATOR includes explicit data provenance tags:
1. `LIVE NASA HORIZONS DATA`: Real-time query successfully completed via JPL Horizons REST API.
2. `CACHED NASA HORIZONS DATA`: Retrieved from verified, deterministic disk cache (`datasets/cache/horizons/`).
3. `ANALYTICAL FALLBACK DATA`: Analytical DE440 ephemeris algorithm applied when offline or when Horizons service is unreachable. **Never silently labeled as live NASA data.**

---

## 2. NASA LOLA (Lunar Orbiter Laser Altimeter) Digital Elevation Models

- **Mission**: Lunar Reconnaissance Orbiter (LRO).
- **Instrument**: Lunar Orbiter Laser Altimeter (LOLA).
- **Data Archive**: NASA Planetary Data System (PDS) Geosciences Node (Washington University in St. Louis).
- **Reference Surface**: Sphere with mean volumetric radius $R_{moon} = 1737.4\text{ km}$ ($1,737,400\text{ meters}$).
- **Spatial Reference System**: South Pole Polar Stereographic (`IAU2000:301` / EPSG `proj=10`), Center Latitude $-90^\circ$, Center Longitude $0^\circ$.

### Key Polar DEM Products
| Product Identifier | Coverage | Spatial Resolution | Typical Format | PDS File Size |
| :--- | :--- | :--- | :--- | :--- |
| **LDEM_80S_100M** | $80^\circ\text{S} - 90^\circ\text{S}$ | $100\text{ m/pixel}$ | `.IMG` / `.LBL` or `.TIF` | $\sim 595\text{ MB}$ |
| **LDEM_85S_20M** | $85^\circ\text{S} - 90^\circ\text{S}$ | $20\text{ m/pixel}$ | `.IMG` / `.LBL` or `.TIF` | $\sim 890\text{ MB}$ |
| **LDEM_875S_5M** | $87.5^\circ\text{S} - 90^\circ\text{S}$ | $5\text{ m/pixel}$ | `.IMG` / `.LBL` or `.TIF` | $\sim 1.8\text{ GB}$ |

### Step-by-Step Data Acquisition Procedure

#### Option A: Automated Download via LUNA NAVIGATOR CLI
Run the built-in PDS downloader utility from the repository root:
```powershell
# 1. Download benchmark DEM (fast ~5MB archive for immediate local testing)
python backend/app/services/geospatial/dem_downloader.py --benchmark

# 2. Download official NASA PDS LDEM_80S_100M (~595 MB)
python backend/app/services/geospatial/dem_downloader.py --product ldem_80s_100m

# 3. Download official NASA PDS LDEM_85S_20M (~890 MB)
python backend/app/services/geospatial/dem_downloader.py --product ldem_85s_20m
```

#### Option B: Manual Download from NASA PDS Geosciences Node
1. Navigate in a browser to the NASA PDS Geosciences Node LOLA GDR archive:
   `https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/`
2. Download both the binary raster `.IMG` and the detached label `.LBL`:
   - `img/ldem_80s_100m.img`
   - `lbl/ldem_80s_100m.lbl`
3. Place both files in the project directory:
   `datasets/dem/ldem_80s_100m.img`
   `datasets/dem/ldem_80s_100m.lbl`
4. Alternatively, download the Cloud-Optimized GeoTIFF (COG) from USGS Astrogeology:
   `https://astropedia.astrogeology.usgs.gov/download/Moon/LRO/LOLA/`
   Save to: `datasets/dem/lola_south_pole_100m.tif`

### DEM Ingestion Hierarchy in LUNA NAVIGATOR
When initializing the terrain ray-tracer, `DemLoader` attempts to load elevation datasets in the following prioritized order:
1. **High-Resolution GeoTIFF**: `datasets/dem/lola_south_pole_100m.tif` (reads ModelPixelScaleTag and ModelTiepointTag).
2. **NASA PDS IMG/LBL**: `datasets/dem/ldem_80s_100m.img` (parses scaling factor, offsets, and line/sample counts from `.lbl`).
3. **Benchmark NPZ / TIFF**: `datasets/dem/lola_south_pole_benchmark.npz` (validated Artemis III candidate site elevation grid).
4. **Calibrated LOLA Topography Model**: Analytical harmonic surface model reproducing Artemis candidate site empirical elevations and crater rim profiles if no external file is present.

---

## 3. NASA LROC (Lunar Reconnaissance Orbiter Camera) Imagery

- **Instrument**: LROC Wide Angle Camera (WAC) & Narrow Angle Camera (NAC).
- **Data Archive**: PDS Cartography and Imaging Sciences Node (Arizona State University).
- **WAC Polar Mosaics**:
  - WAC South Pole Illumination Mosaic ($100\text{ m/pixel}$ average reflectance).
  - WAC Morphologic Basemap ($100\text{ m/pixel}$).
- **NAC Polar Targeted Products**:
  - High-resolution landing zone mosaics at $0.5\text{ to } 1.0\text{ meter/pixel}$ for obstacle and boulder field detection.
- **Tile Services & QuickMap Stack**:
  - NASA Treks Lunar WMTS API: `https://trek.nasa.gov/tiles/Moon/EQ/`
  - ASU / NASA LROC QuickMap Stack #3314 (`https://share.google/sCb5mzv7y0G7kEfA4`)

---

## 4. NASA Diviner Lunar Radiometer Experiment

- **Instrument**: Diviner on LRO.
- **Data Products**:
  - Global daytime and nighttime bolometric brightness temperatures.
  - Polar winter maximum and minimum surface temperature grids ($500\text{ m/pixel}$).
  - Permanently Shadowed Region (PSR) temperature maps demonstrating areas consistently below $110\text{ K}$ (water ice stability threshold) and below $54\text{ K}$ (carbon dioxide / methane frost stability).
- **Application in LUNA NAVIGATOR**:
  - Used in Site Recommendation Engine to score volatile resource prospecting value versus extreme cryogenic operational risk.

---

## 5. Local Dataset Directory Conventions

```
datasets/
├── cache/
│   └── horizons/                  # Precached & live-cached Horizons JSON responses
│       ├── 10_-89.78_125.00_...json
│       └── 399_-89.78_125.00_...json
├── dem/
│   ├── lola_south_pole_benchmark.npz   # Benchmark Artemis candidate site DEM
│   ├── lola_south_pole_benchmark.tif   # GeoTIFF benchmark
│   ├── ldem_80s_100m.img               # NASA PDS LOLA 100m DEM (optional)
│   └── ldem_80s_100m.lbl               # NASA PDS label
├── imagery/
│   ├── lroc_wac_south_pole.png         # 2D base map tiles
│   └── shaded_relief/                  # Computed hillshade tiles
└── sample/
    └── candidate_sites.json            # Ground-truth candidate sites catalog
```
