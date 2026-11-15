# LUNA NAVIGATOR — Planetary Data Sources Specification

All calculations in LUNA NAVIGATOR utilize actual scientific datasets released by NASA Planetary Data System (PDS) and the Jet Propulsion Laboratory (JPL).

---

## 1. NASA JPL Horizons Ephemeris System

- **Provider**: Solar System Dynamics Group, NASA Jet Propulsion Laboratory, Caltech.
- **REST API Endpoint**: `https://ssd.jpl.nasa.gov/api/horizons.api`
- **Ephemeris Base**: DE440 / DE441 High-Precision Planetary Ephemerides.
- **Primary Body Targets**:
  - `10`: Sun (Solar System Barycenter / Center of Sun)
  - `399`: Earth
  - `301`: Moon Center of Mass
- **Observer Coordinate Format**:
  - Observer location given as Selenographic coordinates: Longitude (East, 0–360°), Latitude (-90° to +90°), and Altitude (km above reference radius).
- **Time Standard**:
  - Coordinated Universal Time (UTC) and Barycentric Dynamical Time (TDB).
  - Gregorian date formatting `YYYY-MM-DD HH:MM:SS`.

---

## 2. NASA LOLA (Lunar Orbiter Laser Altimeter) Digital Elevation Models

- **Mission**: Lunar Reconnaissance Orbiter (LRO).
- **Instrument**: Lunar Orbiter Laser Altimeter (LOLA).
- **Data Archive**: NASA Planetary Data System (PDS) Geosciences Node.
- **Reference Surface**: Sphere with mean volumetric radius $R_{moon} = 1737.4\text{ km}$ ($1,737,400\text{ meters}$).
- **Key Polar DEM Products**:
  1. **LDEM_80S_100M**:
     - Coverage: $80^\circ\text{S}$ to $90^\circ\text{S}$ (complete South Pole circle).
     - Spatial Resolution: $100\text{ meters/pixel}$.
     - Projection: Polar Stereographic (Center Latitude: $-90^\circ$, Center Longitude: $0^\circ$).
     - Size: $\sim 600\text{ MB}$ GeoTIFF / IMG.
  2. **LDEM_85S_20M**:
     - Coverage: $85^\circ\text{S}$ to $90^\circ\text{S}$ (high-priority Artemis candidate sites).
     - Spatial Resolution: $20\text{ meters/pixel}$.
  3. **LDEM_875S_5M / 10M**:
     - Coverage: $87.5^\circ\text{S}$ to $90^\circ\text{S}$ (Shackleton, Connecting Ridge, de Gerlache).
     - Spatial Resolution: $5\text{ to } 10\text{ meters/pixel}$.
- **PDS Direct Download Base URL**:
  `https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/`

---

## 3. NASA LROC (Lunar Reconnaissance Orbiter Camera) Imagery

- **Instrument**: LROC Wide Angle Camera (WAC) & Narrow Angle Camera (NAC).
- **Data Archive**: PDS Cartography and Imaging Sciences Node (Arizona State University).
- **WAC Polar Mosaics**:
  - WAC South Pole Illumination Mosaic ($100\text{ m/pixel}$ average reflectance).
  - WAC Morphologic Basemap ($100\text{ m/pixel}$).
- **NAC Polar Targeted Products**:
  - High-resolution landing zone mosaics at $0.5\text{ to } 1.0\text{ meter/pixel}$ for obstacle and boulder field detection.
- **Tile Services & WMTS**:
  - NASA Treks Lunar WMTS API: `https://trek.nasa.gov/tiles/Moon/EQ/` and Polar Stereographic South Pole projection layers.

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
├── dem/
│   ├── lola_south_pole_100m.tif   # Member 3: Primary regional DEM (100 m/px)
│   ├── lola_south_pole_benchmark.npz # Calibrated benchmark raster (1200 m/px)
│   └── lola_south_pole_benchmark.tif # Calibrated benchmark GeoTIFF (1200 m/px)
├── imagery/
│   ├── lroc_wac_south_pole.png    # 2D base map tiles
│   └── shaded_relief/             # Computed hillshade tiles
├── processed/
│   ├── horizon_cache_360.npz      # Pre-computed horizon masks for benchmark sites
│   └── slope_rasters/             # Local terrain slope arrays (degrees)
└── sample/
    └── candidate_sites.json       # Ground-truth sites catalog
```

---

## 6. Scientific Provenance & Transparency Standard

All responses from Luna Navigator clearly specify dataset provenance:

- **Ephemeris Source**:
  - `LIVE NASA HORIZONS DATA`: Real-time query to NASA JPL Horizons Web API (DE440).
  - `CACHED NASA HORIZONS DATA`: Cached JPL Horizons results matching site coordinates and mission epoch.
  - `ANALYTICAL FALLBACK DATA`: Offline analytical model incorporating solar obliquity and lunar libration dynamics.
- **Terrain Source**:
  - `NASA LOLA RASTER DEM (product_id, resolution_m/px)`: Real elevation grid sampled via bilinear interpolation.
  - `PROCEDURAL LOLA TOPOGRAPHY FALLBACK`: Calibrated mathematical geomorphic model used when raster DEM files are absent.

For step-by-step PDS acquisition procedures, refer to [nasa-data-acquisition.md](file:///c:/Users/l/Documents/lunarsite_hackathon/luna-project/docs/nasa-data-acquisition.md).
