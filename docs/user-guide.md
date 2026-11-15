# LUNA NAVIGATOR — Official User Guide

Welcome to **Luna Navigator**, an interactive decision-support platform designed for lunar exploration mission planners, systems engineers, and scientific researchers to evaluate, simulate, and rank candidate landing sites in the **Lunar South Pole ($80^\circ\text{S} - 90^\circ\text{S}$)** for Artemis, CLPS, and robotic surface missions.

---

## 📑 Table of Contents

1. [Quick Start & Launching the Application](#1-quick-start--launching-the-application)
2. [Global Application Layout](#2-global-application-layout)
   - [Top Executive Bar](#21-top-executive-bar)
   - [Mission Parameters & Candidate Region Sidebar](#22-mission-parameters--candidate-region-sidebar)
3. [Deep-Dive Walkthrough: The 11 Primary Analysis Views](#3-deep-dive-walkthrough-the-11-primary-analysis-views)
   - [1. Site Overview & Dossier](#31-site-overview--dossier)
   - [2. Lunar Explorer (2D Polar Map)](#32-lunar-explorer-2d-polar-map)
   - [3. 3D Moon Surface Visualization & Terrain Mesh](#33-3d-moon-surface-visualization--terrain-mesh)
   - [4. NASA LROC QuickMap Visualizer (Stack #3314)](#34-nasa-lroc-quickmap-visualizer)
   - [5. Solar Illumination & Shadow Analysis](#35-solar-illumination--shadow-analysis)
   - [6. Earth Communication (DTE) & Libration](#36-earth-communication-dte--libration)
   - [7. Terrain Horizon & 360° Sky Radar Plot](#37-terrain-horizon--360-sky-radar-plot)
   - [8. Multi-Site Comparison Matrix](#38-multi-site-comparison-matrix)
   - [9. MCDA Ranking & Constraints Engine](#39-mcda-ranking--constraints-engine)
   - [10. Mission Power & Battery Simulation](#310-mission-power--battery-simulation)
   - [11. AI Scientific Mission Assistant](#311-ai-scientific-mission-assistant)
4. [Step-by-Step Mission Planning Workflows](#4-step-by-step-mission-planning-workflows)
   - [Workflow A: Evaluating Shackleton Rim for an Artemis Crewed Mission](#workflow-a-evaluating-shackleton-rim-for-an-artemis-crewed-mission)
   - [Workflow B: Sizing Lander Solar Arrays & Battery for Shadow Survival](#workflow-b-sizing-lander-solar-arrays--battery-for-shadow-survival)
   - [Workflow C: Telecommunication Relay Site Analysis (Malapert Massif)](#workflow-c-telecommunication-relay-site-analysis-malapert-massif)
   - [Workflow D: Custom Multi-Criteria Site Trade Study](#workflow-d-custom-multi-criteria-site-trade-study)
   - [Workflow E: 3D Topographic Exploration & Diurnal Grazing Shadow Analysis](#workflow-e-3d-topographic-exploration--diurnal-grazing-shadow-analysis)
   - [Workflow F: Cross-Referencing with NASA LROC QuickMap (Stack #3314)](#workflow-f-cross-referencing-with-nasa-lroc-quickmap-stack-3314)
5. [Understanding Planetary Data & Scientific Guardrails](#5-understanding-planetary-data--scientific-guardrails)
6. [Troubleshooting & Frequently Asked Questions](#6-troubleshooting--frequently-asked-questions)

---

## 1. Quick Start & Launching the Application

### Option A: Local Standalone Development (Recommended for quick testing)

1. **Start the Backend API**:
   Open a terminal (PowerShell or Bash) in the project directory:
   ```powershell
   cd luna-project/backend
   $env:PYTHONPATH="."
   uvicorn app.main:app --reload --port 8000
   ```
   *Interactive API documentation is now live at: `http://localhost:8000/docs`*

2. **Start the Frontend Dashboard**:
   Open a second terminal window:
   ```powershell
   cd luna-project/frontend
   npm install
   npm run dev
   ```
   *The web application is now live at: `http://localhost:5173`*

### Option B: Production Docker Deployment

To launch the complete unified stack (FastAPI Backend, PostGIS Database, and Nginx Production Frontend):
```bash
cd luna-project
docker-compose -f docker-compose.prod.yml up --build -d
```
* **Frontend Dashboard**: Open your browser at `http://localhost:5173` (or `http://localhost:80`)
* **Backend Swagger API**: Accessible at `http://localhost:8000/docs`
* **PostgreSQL / PostGIS**: Running on `localhost:5432`

---

## 2. Global Application Layout

When you open `http://localhost:5173`, the screen is divided into two primary operational zones:

```
+-----------------------------------------------------------------------------------------------+
| [Compass] LUNA NAVIGATOR | Status: LIVE | Site: Shackleton Crater Rim | [11 Tabs Navigation]  |
+------------------------------------+----------------------------------------------------------+
|  LEFT SIDEBAR                      |  MAIN ANALYSIS WORKSPACE                                 |
|  - Mission Start Epoch             |                                                          |
|  - Duration (Days) & Step (Hours)  |  Renders the currently active view:                      |
|  - Observer Mast Height (Meters)   |  (Overview / Explorer / 3D Moon / LROC QuickMap / Solar  |
|  - Candidate Sites Selector List   |   Comm / Terrain / Compare / MCDA / Simulation / AI)     |
|    (8 Pre-characterized sites)     |                                                          |
+------------------------------------+----------------------------------------------------------+
```

### 2.1 Top Executive Bar
* **Mission Identifier**: Displays the project badge and active telemetry link.
* **API Telemetry Pill**: Indicates whether the FastAPI calculation engine is `ONLINE` (green) or in offline fallback mode.
* **Active Site Indicator**: Shows the currently selected landing zone, regional tag, and coordinates.
* **Tab Navigation Bar**: Instant one-click switching between the 11 analysis modules.

### 2.2 Mission Parameters & Candidate Region Sidebar
The left sidebar controls all global inputs across the entire application:
* **Mission Start Date (UTC)**: Choose the target mission epoch (defaults to `2026-12-01T00:00:00Z`).
* **Mission Duration**: Adjust slider from `1` to `30` days (defaults to `14.0` days).
* **Calculation Time Step**: Select `1.0h`, `2.0h`, `3.0h`, or `6.0h` temporal resolution.
* **Observer Mast / Antenna Height**: Adjust instrument height above ground from `0.0 m` (rover deck) to `20.0 m` (tall solar tower).
* **Candidate Landing Sites List**: Quickly select between any of the 8 pre-characterized NASA candidate sites:
  1. **Shackleton Crater Rim** (South Pole Proper, $-89.78^\circ$, $1240\text{ m}$)
  2. **Connecting Ridge** (Inter-rim corridor, $-89.44^\circ$, $820\text{ m}$)
  3. **Malapert Mountain (Massif)** (Highland summit, $-85.99^\circ$, $5050\text{ m}$)
  4. **de Gerlache Rim 1** (Plateau, $-88.52^\circ$, $610\text{ m}$)
  5. **Haworth Crater Rim** (Cryogenic ridge, $-87.41^\circ$, $950\text{ m}$)
  6. **Nobile Rim 1 (VIPER Site)** (Rolling hills, $-85.25^\circ$, $430\text{ m}$)
  7. **Amundsen Crater Rim** (Basin rim, $-84.45^\circ$, $1680\text{ m}$)
  8. **Leibnitz Plateau** (SPA basin margin, $-85.40^\circ$, $2890\text{ m}$)

---

## 3. Deep-Dive Walkthrough: The 9 Primary Analysis Views

### 3.1 Site Overview & Dossier
* **Access Tab**: Click **`Site Overview`**
* **Purpose**: Comprehensive briefing dossier for the active candidate site.
* **Key Features**:
  * **Coordinate & Elevation Banner**: Precise Selenographic latitude, longitude, elevation above datum ($R=1737.4\text{ km}$), and regional surface slope.
  * **Orbital & Telemetry Quick Stats**: Instant readout of cumulative solar illumination percentage, longest shadow interval, Earth line-of-sight availability, and longest blackout duration over the mission window.
  * **Scientific Interest & Geology**: Mission objectives (e.g. PSR volatile prospecting, mantle impact melt sampling).
  * **Primary Advantages & Hazards**: Concise engineering breakdown of benefits vs landing drop-offs.
  * **Action Shortcuts**: Quick buttons to jump straight into Ephemeris, MCDA Ranking, or Power Simulation.

---

### 3.2 Lunar Explorer (2D Polar Map)
* **Access Tab**: Click **`Lunar Explorer`**
* **Purpose**: High-fidelity 2D Polar Stereographic map centered at the Lunar South Pole ($-90^\circ\text{S}$).
* **Key Features**:
  * **Conformal Polar Projection**: Renders the lunar south polar cap ($80^\circ\text{S} - 90^\circ\text{S}$) with concentric latitude rings ($-80^\circ$, $-85^\circ$, $-88^\circ$, $-89^\circ$) and meridian lines radiating outwards from the South Pole.
  * **Interactive Candidate Site Markers**: Clickable site pins with elevation tooltips. Selecting a pin dynamically updates the global site focus across the whole application.
  * **Crater Outlines**: Geometric vector bounds for major polar impact basins (Shackleton, Faustini, Shoemaker, Haworth, de Gerlache, Amundsen, Nobile).
  * **Map Legend**: Color-coded markers indicating elevation ranges and landing site classifications.
  * **1-Click 3D Surface View Shortcut**: Instantly jump from the 2D polar map into the 3D surface visualization.

---

### 3.3 3D Moon Surface Visualization & Terrain Mesh
* **Access Tab**: Click **`3D Moon Surface`** or the **`3D Surface View`** button in the Lunar Explorer or Site Overview card.
* **Purpose**: Fully interactive 3D WebGL digital elevation model (DEM) of the Moon and the Lunar South Pole with dynamic solar grazing illumination, Earth position, candidate site beacons, and multi-mode surface shading.
* **Key Features**:
  * **Three Dedicated 3D Viewing Modes**:
    1. **South Pole 3D DEM**: High-resolution 140x140 vertex topographic mesh covering a $600\text{ km} \times 600\text{ km}$ regional corridor ($80^\circ\text{S} - 90^\circ\text{S}$) built from NASA LOLA elevation benchmarks. Renders real massif peaks (Malapert Mountain at $+5050\text{ m}$), elevated rim crests (Shackleton at $+1240\text{ m}$), and cryogenic crater bowls ($-3000\text{ m}$ floor).
    2. **Global Moon Sphere**: Full 3D lunar globe with maria basins (Oceanus Procellarum, Mare Imbrium, South Pole-Aitken basin), crater rays, and an illuminated polar region marker.
    3. **First-Person Lander View**: Ground-level perspective stationed directly on the selected candidate landing site, looking across the local topography toward the grazing Sun and Earth.
  * **Dynamic Sun Position & Grazing Shadow Physics**:
    * Accurate low-elevation solar vector ($0^\circ - 1.8^\circ$) casting real-time soft directional shadows across ridges and into crater interiors.
    * Interactive 708-hour (one complete lunar synodic diurnal cycle) time scrubber.
    * Play/Pause auto-orbit animation to inspect shadow progression and identify Permanently Shadowed Regions (PSRs).
  * **Suspended 3D Earth Globe**:
    * Realistic Earth globe with atmospheric Rayleigh scattering halo positioned in the lunar sky at realistic libration angles ($\sim 6.7^\circ$ latitude, $\sim 7.9^\circ$ longitude).
  * **Four Scientific Shading Styles**:
    1. **Photorealistic Regolith**: Lunar surface gray with procedural micro-cratering and directional lighting.
    2. **LOLA Hypsometric Colormap**: Full rainbow elevation heatmap matching NASA LOLA color conventions (Blue: deep PSRs $< -1500\text{ m}$; Green: highlands $0 - 500\text{ m}$; Yellow/Orange: crater rims $+500 - 3000\text{ m}$; Red/White: massif summits $> +4500\text{ m}$) with an interactive legend.
    3. **Touchdown Slope Safety Colormap**: Green ($< 5^\circ$, safe landing zone), Amber ($5^\circ - 12^\circ$, cautionary slope), and Red ($> 12^\circ$, hazardous tip risk) with legend.
    4. **TIN Wireframe**: Structural triangulated irregular network visualization.
  * **Vertical Relief Exaggeration Slider**:
    * Real-time scaling from $1.0\times$ (true scale) to $4.5\times$ vertical exaggeration to inspect micro-ridges and subtle landing corridors.
  * **Interactive Candidate Site Beacons**:
    * Pulsing 3D orbs, ground target rings, and vertical laser beams marking all candidate sites.
    * Mouse hover reveals candidate site name, region, coordinates, elevation, and slope.
    * Click-to-select updates the active site across the entire Luna Navigator application.

---

### 3.4 NASA LROC QuickMap Visualizer
* **Access Tab**: Click **`LROC QuickMap`** or the **`QuickMap`** button in the top bar of Lunar Explorer and Site Overview.
* **Canonical Share Link**: `https://share.google/sCb5mzv7y0G7kEfA4` (resolves to QuickMap Stack `#3314`, `proj=10`, `earthShadowEnabled=true`).
* **Purpose**: Integration and visualization of the Arizona State University (ASU) / NASA Lunar Reconnaissance Orbiter Camera (LROC) QuickMap system, the primary cartographic interface used by planetary geologists and Artemis mission planners.
* **Key Features**:
  * **Three Viewing Modes**:
    1. **Interactive Cartographic Map**: High-speed WebGL canvas replicating QuickMap's polar stereographic view (EPSG:3032, $80^\circ\text{S} - 90^\circ\text{S}$) with LROC WAC optical mosaic, LOLA hypsometric topography, slope hazards, and PSR polygons.
    2. **Live QuickMap Web Frame**: Direct embedded session connected to `quickmap.lroc.im-ldi.com` with one-click full-screen launch to bypass browser cross-origin frame restrictions.
    3. **Stack #3314 Technical Specifications**: Detailed scientific metadata and resolution specifications for each data layer included in the user's shared configuration.
  * **Dynamic Grazing Sunlight & Earth Shadow (`earthShadowEnabled=true`)**:
    * Interactive Sun azimuth slider ($0^\circ - 360^\circ$) with play/pause orbital rotation to observe shadow elongation across crater rims (Shackleton, Haworth, Shoemaker) and verify cold-trap shadow persistence.
  * **Layer Selector**:
    * *LROC WAC Optical Mosaic* ($64\text{ m/px}$)
    * *LOLA Hypsometric Topography* ($20\text{ m/px}$)
    * *LROC NAC Artemis Exploration Corridors* ($0.5 - 1.0\text{ m/px}$)
    * *Permanently Shadowed Regions (PSRs)* ($240\text{ m/px}$)
    * *Dynamic Sun Shadows & Polar Coordinate Grid*
  * **Candidate Site Quick-Jump Toolbar**:
    * Instant focus on any of the 8 candidate landing zones with dynamic QuickMap URL generation and synchronized selection.
  * **REST API Endpoints**:
    * `GET /api/quickmap/metadata`: Returns JSON metadata, layer definitions, projection, and candidate site bookmarks.
    * `GET /api/quickmap/url`: Dynamically generates custom QuickMap deep-links for specified coordinates or site IDs.

---

### 3.5 Solar Illumination & Shadow Analysis
* **Access Tab**: Click **`Solar Illumination`**
* **Purpose**: Evaluate topocentric solar availability, solar elevation angle, and terrain-cast shadow intervals.
* **Key Features**:
  * **Solar Elevation & Azimuth Charts**: Temporal plots of Sun Azimuth $[0^\circ - 360^\circ)$ and Sun Elevation above horizontal tangent plane ($0^\circ - 1.8^\circ$ nominal polar range).
  * **Terrain Horizon Overlay**: Plots the local LOLA 360° terrain mask directly against the solar trajectory. When Sun Elevation dips below the terrain mask, the site enters topographic shadow.
  * **Cumulative Illumination Metrics**:
    * Total Sunlit Hours vs Shadow Hours.
    * Longest Continuous Sunlight Run (critical for continuous science operations).
    * Longest Continuous Shadow Run (critical for battery sizing).
  * **Direct Solar Irradiance Flux**: Computes horizontal solar flux ($W/m^2$) based on the $1361\text{ W/m}^2$ solar constant and angle of incidence.

---

### 3.6 Earth Communication (DTE) & Libration
* **Access Tab**: Click **`Earth Comm (DTE)`**
* **Purpose**: Track Direct-to-Earth (DTE) radio contact and blackout intervals driven by lunar orbital libration.
* **Key Features**:
  * **Libration Dynamics**: Tracks Earth's apparent oscillation in the lunar sky through $\pm 6.7^\circ$ in latitude and $\pm 7.9^\circ$ in longitude.
  * **Earth Elevation vs Local Horizon Mask**: Displays when the Earth center dips below local ridges or below the operational minimum communication threshold (e.g. $0.5^\circ$ or $1.0^\circ$).
  * **Link Status Timeline**:
    * `DIRECT_LINE_OF_SIGHT` (Green): Unimpeded radio frequency telemetry to the NASA Deep Space Network (DSN).
    * `TERRAIN_BLOCKED` (Rose): Signal blocked by local topographic massifs or crater rim crests.
    * `BELOW_MIN_ELEVATION` (Amber): Line-of-sight exists but falls below the antenna elevation cutoff.
  * **Earth Apparent Angular Diameter**: Displays the apparent size of Earth in the lunar sky ($\sim 1.9^\circ$).

---

### 3.7 Terrain Horizon & 360° Sky Radar Plot
* **Access Tab**: Click **`Terrain Horizon`**
* **Purpose**: Inspect the 360-degree local horizon elevation profile ray-traced from NASA LOLA digital elevation models.
* **Key Features**:
  * **Polar Sky Radar Plot**: A circular 360-degree celestial dome view showing azimuth clockwise from North ($0^\circ = \text{North}, 90^\circ = \text{East}, 180^\circ = \text{South}, 270^\circ = \text{West}$) with the radial axis representing elevation angle. The terrain mask is rendered as an obstruction boundary.
  * **Linear Horizon Profile Chart**: Azimuth vs Obstruction Elevation ($^\circ$) with labeled geomorphic features:
    * *Local Crest / Crater Rim* (features $< 4\text{ km}$ away)
    * *Crater Rim Elevation* ($4\text{ km} - 18\text{ km}$)
    * *Regional Highland Massif* ($18\text{ km} - 40\text{ km}$)
    * *Distant Topographic Horizon* ($> 40\text{ km}$)
  * **Curvature Drop Verification**: Displays the spherical lunar curvature elevation drop $\Delta h = s^2 / 2R_{moon}$ ($259.01\text{ m}$ at $30\text{ km}$).
  * **Observer Mast Height Sensitivity**: Shows how raising an antenna mast from $1\text{ m}$ to $20\text{ m}$ lowers the effective horizon mask.

---

### 3.8 Multi-Site Comparison Matrix
* **Access Tab**: Click **`Compare Sites`**
* **Purpose**: Side-by-side comparative trade matrix of candidate sites over the active mission epoch.
* **Key Features**:
  * **Multi-Parameter Table**: Compares candidate sites across:
    * Cumulative Illumination (%)
    * Longest Shadow Duration (hours)
    * Direct-to-Earth Communication (%)
    * Longest Communication Blackout (hours)
    * Surface Slope Gradient ($^\circ$)
    * Topographic Elevation Datum ($m$)
    * Composite Suitability Score ($/100$)
  * **Multi-Site Radar Chart**: Visualizes relative strengths across solar access, comm availability, flatness, and elevation vantage.
  * **Selection Sync**: Clicking any site in the comparison table sets it as the active global site.

---

### 3.9 MCDA Ranking & Constraints Engine
* **Access Tab**: Click **`MCDA Ranking`**
* **Purpose**: Configurable Multi-Criteria Decision Analysis (MCDA) tool allowing mission architects to define trade-off weights and enforce hard operational constraints.
* **Key Features**:
  * **Weight Sliders (Auto-normalized)**:
    * *Solar Illumination Weight* (Default: $0.35$)
    * *Earth Communication Weight* (Default: $0.30$)
    * *Slope Safety Weight* (Default: $0.20$)
    * *Elevation Vantage Weight* (Default: $0.15$)
  * **Hard Constraint Thresholds**:
    * *Minimum Illumination Percentage* (e.g. $50\%$)
    * *Minimum Communication Availability* (e.g. $40\%$)
    * *Maximum Allowable Slope* (e.g. $12.0^\circ$)
    * *Maximum Continuous Shadow Duration* (e.g. $72.0\text{ h}$)
  * **Ranked Sites Output**:
    * Sorted ranking list ($1, 2, 3...$) with composite score ($/100$).
    * Factor breakdown pills displaying individual utility scores.
    * Transparent explainability narrative articulating why the site earned its rank.
    * Key Strengths & Operational Risks summary.
    * Risk Level categorization badge (`LOW_RISK`, `MODERATE_RISK`, `HIGH_RISK`).
  * **Disqualified Sites Panel**: Highlights sites excluded due to constraint violations with explicit violation messages.
  * **Mandatory NASA Safety Non-Certification Notice**: Clearly states that algorithmic MCDA scores are decision-support heuristics and do not constitute certified flight landing safety.

---

### 3.10 Mission Power & Battery Simulation
* **Access Tab**: Click **`Power Simulation`**
* **Purpose**: Electrical Power System (EPS) simulator modeling solar array generation, active loads, thermal survival heaters, and battery State-of-Charge (SoC).
* **Key Features**:
  * **Solar Array Tracking Architecture Selector**:
    * `VERTICAL_AZIMUTH_TRACKING`: Mast-mounted vertical array rotating to track low polar Sun. Harvests $> 99.9\%$ of solar flux.
    * `HORIZONTAL_FLAT`: Horizontal deck array. Suffers extreme grazing incidence and generates $< 3\%$ of solar flux.
    * `FIXED_VERTICAL`: Fixed North-facing vertical panel.
    * `TILTED_OPTIMAL`: Array tilted at $80^\circ$ from horizontal.
  * **Lander Hardware Parameters**:
    * Solar array effective area ($m^2$) & cell efficiency (e.g. $30\%$ triple-junction GaAs).
    * Total battery capacity ($Wh$, e.g. $5000\text{ Wh}$).
    * Initial State of Charge ($100\%$) and minimum safe DoD threshold ($20\%$).
    * Continuous base hotel load ($W$), active daytime payload load ($W$), and shadow thermal survival heater load ($W$).
  * **Simulation Outputs**:
    * Battery State-of-Charge (%) timeline graph over the mission duration.
    * Solar power generation vs load timeline ($W$).
    * Power surplus / deficit indicators.
    * Total energy generated ($kWh$) vs total energy consumed ($kWh$).
    * EPS Health Status (`NOMINAL`, `DEGRADED_MARGIN`, `CRITICAL_DEPLETION`).
    * Battery depletion alert if SoC dips below the safe cutoff.

---

### 3.11 AI Scientific Mission Assistant
* **Access Tab**: Click **`AI Assistant`**
* **Purpose**: Explainable scientific advisor that queries Luna Navigator's calculation engines to answer complex mission planning inquiries.
* **Key Features**:
  * **Quick-Prompt Presets**:
    * *Optimal Artemis Site*: Recommends the top site for a 14-day surface stay.
    * *Power Survival at Shackleton*: Simulates solar generation and battery margins.
    * *Compare Top 3 Candidates*: Generates a markdown comparison matrix.
    * *Earth Comm at Malapert*: Evaluates libration-induced DTE contact.
    * *Landing Slope Safety*: Analyzes touchdown slope hazards and terrain relief.
  * **Natural Language Query Input**: Ask custom questions in plain English (e.g., *"What happens to battery SoC at Connecting Ridge if we reduce the array area to 3.0 m²?"*).
  * **Empirical Evidence Box**: Displays exact data pulled from JPL Horizons and LOLA DEMs without hallucination.
  * **Risk Assessment & Mitigation Recommendations**: Categorizes mission risks and provides concrete engineering countermeasures.
  * **Suggested Follow-up Inquiries**: Clickable follow-up buttons to deepen the mission trade study.

---

## 4. Step-by-Step Mission Planning Workflows

### Workflow A: Evaluating Shackleton Rim for an Artemis Crewed Mission
1. In the **Left Sidebar**, select **`Shackleton Crater Rim`**.
2. Set **Mission Start Date** to `2026-12-01` (Southern summer illumination peak).
3. Set **Mission Duration** to `14.0` days and **Observer Mast Height** to `2.0 m`.
4. Open the **`Solar Illumination`** tab: verify that cumulative sunlight exceeds $80\%$ and observe the small shadow intervals cast by regional ridges.
5. Open the **`Earth Comm (DTE)`** tab: inspect the Earth elevation curve ($\sim 4.5^\circ - 6.0^\circ$) and confirm direct line of sight is maintained.
6. Open the **`Terrain Horizon`** tab: review the 360° radar mask to see the elevated rim crest.
7. Open the **`Power Simulation`** tab: select `VERTICAL_AZIMUTH_TRACKING` with a $4.5\text{ m}^2$ array and $5000\text{ Wh}$ battery. Confirm battery SoC remains $> 50\%$ throughout the 14 days.

---

### Workflow B: Sizing Lander Solar Arrays & Battery for Shadow Survival
1. In the **Left Sidebar**, select a site subject to shadow occultations, such as **`Connecting Ridge`** or **`de Gerlache Rim 1`**.
2. Navigate to **`Power Simulation`**.
3. Set **Solar Array Area** to `2.0 m²` and **Battery Capacity** to `1500 Wh`.
4. Run the simulation and observe the **Battery SoC (%) timeline**: note how the battery rapidly depletes during the extended shadow window, triggering a `CRITICAL_DEPLETION` alert.
5. Increase **Battery Capacity** to `6000 Wh` and **Solar Array Area** to `4.5 m²`. Re-run the simulation to verify that the minimum SoC remains safely above the $20\%$ cutoff, restoring `NOMINAL` EPS health status.

---

### Workflow C: Telecommunication Relay Site Analysis (Malapert Massif)
1. In the **Left Sidebar**, select **`Malapert Mountain (Massif)`**.
2. Open the **`Site Overview`** tab: note its towering elevation of $+5050\text{ m}$ above the lunar reference datum.
3. Open the **`Earth Comm (DTE)`** tab: observe the near-continuous line-of-sight availability ($> 95\%$) even as Earth oscillates through libration cycles.
4. Open the **`Terrain Horizon`** tab: note that because the observer is perched atop a 5-kilometer massif, the local horizon angles dip below $0^\circ$ across most azimuths, virtually eliminating terrain occultations.
5. Conclude why Artemis architecture designates Malapert Massif as the premier lunar south pole communication relay and navigation base.

---

### Workflow D: Custom Multi-Criteria Site Trade Study
1. Click the **`MCDA Ranking`** tab.
2. Suppose your mission is an uncrewed solar-powered science rover:
   * Prioritize solar access: drag **Solar Illumination Weight** to `0.55`.
   * Prioritize gentle terrain: drag **Slope Safety Weight** to `0.30`.
   * Lower comm priority: drag **Earth Communication Weight** to `0.10`.
   * Set **Maximum Acceptable Slope** to `8.0^\circ`.
3. Review the ranked table: observe how gentle sites with high illumination (such as **Connecting Ridge**) climb the rankings while steeper sites are penalized or disqualified.
4. Click on the top-ranked site to jump directly to its complete technical dossier.

---

---

### Workflow E: 3D Topographic Exploration & Diurnal Grazing Shadow Analysis
1. In the **Left Sidebar**, select **`Shackleton Crater Rim`**.
2. Click the **`3D Moon Surface`** tab (or click **`3D SURFACE VIEW`** inside the Lunar Explorer).
3. Switch **Shading Style** to **`LOLA Elevation`** to inspect the rainbow hypsometric elevation colormap:
   - Observe the deep navy/blue crater floor dropping to $-3000\text{ m}$.
   - Inspect the elevated rim crest rising to $+1240\text{ m}$.
4. Switch to **`Slope Safety`** colormap: note the green safe landing corridor along the gentle outer flank ($< 5^\circ$) versus the steep red crater wall drop-off ($> 25^\circ$).
5. Move the **Vertical Relief Exaggeration** slider to `3.0x` to clearly inspect micro-topography.
6. Press the **`▶ Play`** button on the Diurnal Cycle bar: observe how the Sun directional light casts long grazing shadows across the rim while the crater bowl remains plunged in permanent darkness (Permanently Shadowed Region / PSR).
7. Switch **View Mode** to **`First-Person Lander View`** to see what a crewed lander on the rim would witness: low grazing sunlight skimming across ridges and Earth suspended in the lunar sky.

---

### Workflow F: Cross-Referencing with NASA LROC QuickMap (Stack #3314)
1. Click the **`LROC QuickMap`** tab in the top navigation bar.
2. In the **Quick Jump** toolbar, click **`Shackleton`** or **`Malapert`**: the interactive map centers over that candidate site with dynamic coordinates.
3. Toggle individual layers:
   - Turn on **`LROC WAC`** to view the optical albedo mosaic.
   - Turn on **`PSRs`** to view cold-trap boundaries.
   - Drag the **`SUN AZ`** slider from $0^\circ$ to $360^\circ$ to evaluate topographic illumination.
4. Switch to the **`Live QuickMap Web`** view:
   - If your browser displays the frame, interact directly with the Intuitive Machines / ASU map interface.
   - If your browser blocks inline framing due to `X-Frame-Options: sameorigin`, click **`Launch Fullscreen QuickMap`** to open the pre-configured session (`stack=3314`, `proj=10`, `earthShadowEnabled=true`) in a full window.

---

## 5. Understanding Planetary Data & Scientific Guardrails

All scientific quantities in Luna Navigator are computed using empirical NASA planetary datasets:

| System Element | Data Source & Standard | Physical Formula / Reference |
| :--- | :--- | :--- |
| **Ephemerides** | NASA JPL Horizons API / DE440 | Topocentric vectors to Sun (`10`) and Earth (`399`) relative to Moon center (`301`) |
| **Topography** | NASA LRO LOLA PDS Gridded Data Records | `LDEM_80S_100M` ($100\text{ m/px}$) Polar Stereographic projection |
| **Optical Imagery** | NASA LROC WAC & NAC (ASU SOC) | Polar stereographic mosaic at $64\text{ m/px}$ and targeted strips at $0.5 - 1.0\text{ m/px}$ |
| **Lunar Datum** | IAU Mean Earth / Polar Axis (ME) Frame | Reference volumetric sphere with $R_{moon} = 1,737,400\text{ m}$ ($1737.4\text{ km}$) |
| **Curvature Drop** | Spherical Geodesic Correction | $\Delta h_{curv} = \frac{s^2}{2 R_{moon}}$ ($259.01\text{ m}$ drop at $30\text{ km}$ distance) |
| **Solar Constant** | 1 AU Mean Solar Irradiance | $S_0 = 1361.0\text{ W/m}^2$, Solar disk semi-diameter $\delta_{sun} = 0.2667^\circ$ |
| **Earth Diameter** | Apparent Lunar Sky Diameter | $\sim 1.88^\circ - 1.94^\circ$, Libration $\pm 6.7^\circ$ Lat, $\pm 7.9^\circ$ Lon |

> [!WARNING]
> **Safety Certification Notice**:
> Algorithmic MCDA rankings and AI mission evaluations provide preliminary strategic decision support. They **DO NOT** constitute official NASA human-rating or landing safety certification. Mission flight qualification requires sub-meter boulder/hazard detection (via LROC NAC / descent LIDAR), regolith geotechnical load-bearing capacity assessment, landing gear touchdown dynamics, and terminal descent propellant margin qualification.

---

## 6. Troubleshooting & Frequently Asked Questions

### Q1: The API Telemetry indicator shows "OFFLINE / DEGRADED". What should I do?
* Verify that the FastAPI backend is running:
  ```powershell
  cd luna-project/backend
  $env:PYTHONPATH="."
  uvicorn app.main:app --reload --port 8000
  ```
* Open `http://localhost:8000/api/health` in your browser. It should return `{"status": "HEALTHY", "service": "LUNA NAVIGATOR Backend API"}`.
* Check that no firewall or antivirus is blocking local port `8000`.

### Q2: Why does a flat horizontal solar panel produce almost zero power at the South Pole?
* At the Lunar South Pole, the Sun never rises high in the sky; its maximum elevation angle above the mean horizontal plane is only $1.5^\circ - 1.8^\circ$.
* A horizontal panel laid flat on the ground has its normal vector pointing straight up toward the Zenith ($90^\circ$). The angle of incidence is $\theta_{inc} \approx 90^\circ - 1.5^\circ = 88.5^\circ$.
* Because solar generation is proportional to $\cos(\theta_{inc}) = \sin(1.5^\circ) \approx 0.026$, a horizontal panel receives only $\sim 2.6\%$ of the available solar flux!
* Selecting **`VERTICAL_AZIMUTH_TRACKING`** aligns the panel normal directly with the low-lying Sun, harvesting $> 99.9\%$ of solar flux.

### Q3: How do I run the full test suite?
* Run the comprehensive 70-test pytest suite:
  ```powershell
  cd luna-project/backend
  $env:PYTHONPATH="."
  python -m pytest tests -v
  ```
  All 70 test cases across ephemeris, GIS projections, ray tracing, MCDA ranking, EPS power simulation, AI assistant, and LROC QuickMap will execute and pass.

### Q4: Why does the Live LROC QuickMap tab show a framing notice?
* The official LROC QuickMap web server (`quickmap.lroc.im-ldi.com`) sends `X-Frame-Options: sameorigin` HTTP headers for security.
* If your browser blocks inline iframes from third-party domains, click the prominent **`Launch QuickMap in Fullscreen Window`** button. This opens the exact shared session (`stack=3314`, `proj=10`, `earthShadowEnabled=true`) in a full tab without any restrictions.
* Alternatively, use the **`Interactive Map`** mode inside Luna Navigator for an immediate, high-performance canvas experience with live solar shadow simulation.

### Q5: What are the browser requirements for 3D Moon Surface visualization?
* The 3D surface visualizer is built on Three.js and requires WebGL support (standard in modern versions of Google Chrome, Microsoft Edge, Mozilla Firefox, and Apple Safari).
* Hardware acceleration should be enabled in your browser settings for optimal frame rates.

---

*Luna Navigator — Developed for Lunar South Pole Mission Architecture & Surface Exploration.*

---

*Luna Navigator — Developed for Lunar South Pole Mission Architecture & Surface Exploration.*
