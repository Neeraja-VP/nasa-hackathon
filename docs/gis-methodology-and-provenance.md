# LUNA NAVIGATOR — GIS & Scientific Computing Methodology and Data Provenance

**Module Ownership**: Member 3 (GIS & Scientific Computing)  
**Applicable Packages**: `backend/app/services/geospatial/`, `backend/app/engines/terrain/`, `datasets/dem/`  
**API Standards**: Compliant with [docs/api-contracts.md](file:///c:/Users/l/Documents/lunarsite_hackathon/luna-project/docs/api-contracts.md) Section 3 (`POST /api/terrain/horizon`)

---

## 1. Coordinate Reference Systems & Reference Frames

Evaluating lunar landing sites, solar illumination masks, and Direct-to-Earth (DTE) communication requires standard astronomical and planetary geodetic coordinate frames defined by the International Astronomical Union (IAU) and the NASA Navigation and Ancillary Information Facility (NAIF).

### 1.1 IAU Mean Earth / Polar Axis (ME) Frame
The primary selenographic reference frame used throughout LUNA NAVIGATOR is the **Lunar Mean Earth / Polar Axis (ME)** frame (NAIF SPICE frame ID `MOON_ME`):
- **Origin**: Center of mass of the Moon ($r = 0$).
- **Z-Axis**: Aligned with the mean lunar rotation axis pointing toward the Lunar North Pole (+Z).
- **X-Axis**: Lies in the lunar equatorial plane pointing toward the mean sub-Earth point at zero libration (intersection of Prime Meridian and Lunar Equator).
- **Y-Axis**: Completes the right-handed orthogonal system ($Y = Z \times X$, pointing toward $90^\circ\text{E}$ longitude).

NASA LOLA Gridded Data Records (GDRs) are formally tied to the ME frame.

### 1.2 Selenographic $(\phi, \lambda, h)$ to Moon-Centered Cartesian $(X, Y, Z)$
Given:
- Planetocentric latitude $\phi \in [-90^\circ, +90^\circ]$ (negative for the Lunar South Pole)
- East longitude $\lambda \in [0^\circ, 360^\circ)$
- Elevation $h$ in meters relative to reference sphere $R_{moon} = 1,737,400\text{ m}$ ($1737.4\text{ km}$)

$$R = R_{moon} + h$$
$$X = R \cos\phi \cos\lambda$$
$$Y = R \cos\phi \sin\lambda$$
$$Z = R \sin\phi$$

### 1.3 Topocentric Local Horizon Frame $(\hat{e}, \hat{n}, \hat{u})$
For an observer situated at lunar position $(\phi, \lambda)$:
- **Zenith ($\hat{u}$)**: Unit normal pointing upward from reference sphere:
  $$\hat{u} = (\cos\phi \cos\lambda, \cos\phi \sin\lambda, \sin\phi)$$
- **North ($\hat{n}$)**: Unit tangent vector along meridian toward Lunar North Pole:
  $$\hat{n} = (-\sin\phi \cos\lambda, -\sin\phi \sin\lambda, \cos\phi)$$
- **East ($\hat{e}$)**: Unit tangent vector pointing toward increasing longitude:
  $$\hat{e} = (-\sin\lambda, \cos\lambda, 0)$$

The system is strictly orthonormal: $\hat{u} \cdot \hat{n} = 0$, $\hat{u} \cdot \hat{e} = 0$, $\hat{n} \cdot \hat{e} = 0$, and $\hat{e} = \hat{n} \times \hat{u}$.

---

## 2. Elevation Datum & Physical Units

| Parameter | Value | Physical Unit | Description |
| :--- | :--- | :--- | :--- |
| **Lunar Mean Radius ($R_{moon}$)** | $1,737,400.0$ | meters ($\text{m}$) | Reference volumetric sphere defined by IAU/IAG |
| **Equatorial Radius ($R_{eq}$)** | $1,738,100.0$ | meters ($\text{m}$) | Semimajor axis of lunar reference ellipsoid |
| **Polar Radius ($R_{pol}$)** | $1,736,000.0$ | meters ($\text{m}$) | Semiminor axis of lunar reference ellipsoid |
| **Elevation ($h$)** | $[-3500.0, +5500.0]$ | meters ($\text{m}$) | Height relative to the $R = 1737.4\text{ km}$ spherical datum |
| **Surface Slope** | $[0.0, 45.0]$ | degrees ($^\circ$) | Local topographic slope gradient |
| **Ground Distance ($s$)** | $[0.0, 150000.0]$ | meters ($\text{m}$) | Great-circle surface arc distance |
| **Azimuth ($\theta$)** | $[0.0, 360.0)$ | degrees ($^\circ$) | Clockwise angle from local North ($0^\circ=\text{N}, 90^\circ=\text{E}$) |
| **Horizon Obstruction ($H$)** | $[-2.5, +7.0]$ | degrees ($^\circ$) | Angular elevation above local horizontal tangent plane |

---

## 3. Map Projections: Polar Stereographic

The Lunar South Pole ($80^\circ\text{S} - 90^\circ\text{S}$) is mapped using conformal **Polar Stereographic** projection centered at the South Pole:
- Center of projection: $\phi_0 = -90.0^\circ$, $\lambda_0 = 0.0^\circ$
- Reference sphere: $R = 1,737,400\text{ m}$
- Standard parallel of true scale: $\phi_{ts} = -90.0^\circ$ (tangent, $k_0 = 1.0$) or $\phi_{ts} = -75.0^\circ$ (secant, $k_0 = 0.98296$)

### Forward Transformation $(\phi, \lambda) \to (X, Y)$
For latitude $\phi \in [-90^\circ, -80^\circ]$, colatitude $c = 90^\circ + \phi$:
$$\rho = 2 R \cdot k_0 \cdot \tan\left(\frac{c_{rad}}{2}\right)$$
$$X = \rho \sin(\lambda - \lambda_0)$$
$$Y = -\rho \cos(\lambda - \lambda_0)$$

### Inverse Transformation $(X, Y) \to (\phi, \lambda)$
$$\rho = \sqrt{X^2 + Y^2}$$
If $\rho = 0 \implies \phi = -90^\circ, \lambda = 0^\circ$. Otherwise:
$$c_{rad} = 2 \arctan\left(\frac{\rho}{2 R k_0}\right)$$
$$\phi = \text{degrees}(c_{rad}) - 90.0^\circ$$
$$\lambda = (\text{degrees}(\text{atan2}(X, -Y)) + \lambda_0) \pmod{360^\circ}$$

---

## 4. NASA LOLA Data Provenance & Product Catalog

All elevation datasets originate from the **Lunar Orbiter Laser Altimeter (LOLA)** onboard the NASA Lunar Reconnaissance Orbiter (LRO), archived at the **NASA Planetary Data System (PDS) Geosciences Node** at Washington University in St. Louis.

### Primary Polar DEM Products

| Product ID | Coverage | Pixel Scale | Size | Format | PDS Direct URL |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **LDEM_80S_100M** | $80^\circ\text{S} - 90^\circ\text{S}$ | $100\text{ m/px}$ | $\sim 580\text{ MB}$ | PDS IMG / GeoTIFF | [LDEM_80S_100M.img](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/ldem_80s_100m.img) |
| **LDEM_85S_20M** | $85^\circ\text{S} - 90^\circ\text{S}$ | $20\text{ m/px}$ | $\sim 1.45\text{ GB}$ | PDS IMG / GeoTIFF | [LDEM_85S_20M.img](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/ldem_85s_20m.img) |
| **LDEM_875S_5M** | $87.5^\circ\text{S} - 90^\circ\text{S}$ | $5\text{ m/px}$ | $\sim 2.9\text{ GB}$ | PDS IMG / GeoTIFF | [LDEM_875S_5M.img](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/ldem_875s_5m.img) |

---

## 5. Mathematical Ray-Tracing Horizon Algorithm

At polar latitudes, the Sun never exceeds $1.5^\circ - 1.8^\circ$ above the local tangent plane. Therefore, terrain features located tens of kilometers away dictate all illumination and line-of-sight communication.

### 5.1 Lunar Curvature Correction
For a topographic feature at ground distance $s$ along the spherical lunar surface:
$$\Delta h_{curv}(s) = R_{moon} \left(1 - \cos\left(\frac{s}{R_{moon}}\right)\right) \approx \frac{s^2}{2 R_{moon}}$$

**Empirical Verification**:
- At $s = 10\text{ km}$: $\Delta h_{curv} = \frac{10000^2}{2 \times 1737400} = 28.78\text{ meters}$
- At $s = 30\text{ km}$: $\Delta h_{curv} = \frac{30000^2}{2 \times 1737400} = 259.01\text{ meters}$
- At $s = 60\text{ km}$: $\Delta h_{curv} = \frac{60000^2}{2 \times 1737400} = 1036.03\text{ meters}$

### 5.2 Subtended Horizon Angle & Mast Height
Let:
- $h_{ground}$ = ground elevation of the landing site (meters)
- $h_{mast}$ = height of instrument, rover mast, or antenna tower (meters)
- $h_0 = h_{ground} + h_{mast}$ = total observer elevation (meters)
- $h(s, \theta)$ = terrain elevation at ground distance $s$ along azimuth $\theta$

The subtended geometric horizon angle $\alpha(s, \theta)$ is:
$$\tan \alpha(s, \theta) = \frac{h(s, \theta) - h_0 - \Delta h_{curv}(s)}{s}$$

The 360-degree local horizon elevation mask $H(\theta)$ is:
$$H(\theta) = \max_{s \in [s_{min}, s_{max}]} \arctan\left(\frac{h(s, \theta) - h_0 - \frac{s^2}{2 R_{moon}}}{s}\right)$$

### 5.3 Solar Disk Illumination Criteria
Taking into account the solar angular semi-diameter $\delta_{sun} = 0.2667^\circ$ ($16$ arcmin):
1. **Fully Sunlit (Direct Solar Radiation)**:
   $$El_{sun} - \delta_{sun} \ge H(Az_{sun})$$
2. **Penumbra (Partial Solar Disk Grazing Horizon)**:
   $$H(Az_{sun}) - \delta_{sun} < El_{sun} < H(Az_{sun}) + \delta_{sun}$$
3. **Umbra (Complete Topographic Shadow)**:
   $$El_{sun} + \delta_{sun} \le H(Az_{sun})$$

### 5.4 Direct-to-Earth (DTE) Radio Visibility Criteria
For radio frequency communications between the lunar surface and the NASA Deep Space Network (DSN):
1. **Direct Line of Sight**:
   $$El_{earth} > \max\left(H(Az_{earth}), \gamma_{min}\right)$$
   where $\gamma_{min}$ is the minimum ground station elevation cutoff (typically $0.5^\circ - 1.0^\circ$).
2. **Terrain Blocked**:
   $$El_{earth} \le H(Az_{earth})$$
3. **Below Minimum Elevation Mask**:
   $$H(Az_{earth}) < El_{earth} \le \gamma_{min}$$

---

## 6. Reproducible Execution & Dataset Acquisition Instructions

### 6.1 Listing Available NASA PDS Products
```powershell
$env:PYTHONPATH="backend"
python backend/app/services/geospatial/dem_downloader.py --list
```

### 6.2 Generating Calibrated Benchmark LOLA DEM
```powershell
$env:PYTHONPATH="backend"
python backend/app/services/geospatial/generate_benchmark_dem.py
```
Outputs:
- `datasets/dem/lola_south_pole_benchmark.npz`
- `datasets/dem/lola_south_pole_benchmark.tif`

### 6.3 Running Scientific Validation Tests
```powershell
$env:PYTHONPATH="backend"
python -m pytest backend/tests/test_geospatial.py backend/tests/test_terrain_engine.py -v
```

### 6.4 Running Full Suite Verification
```powershell
$env:PYTHONPATH="backend"
python -m pytest backend/tests -v
```
All 51 test cases validate:
- Coordinate frames and basis orthonormality
- Polar stereographic forward and inverse conformal transforms
- NASA LOLA ground truth elevation matching across all 8 Artemis candidate sites
- Spherical curvature drop accuracy ($259.01\text{ m}$ at $30\text{ km}$)
- 360° ray-traced horizon masks and mast height sensitivity
- Solar illumination umbra/penumbra and Earth DTE line of sight
- NASA JPL Horizons ephemerides DE440 benchmarks
