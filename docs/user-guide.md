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
* **Custom Landing Coordinates (`+ Custom` Button)**:
  Mission planners can define arbitrary landing coordinates across the lunar surface:
  - Click the **`+ Custom`** button in the Candidate Sites list header.
  - Enter a descriptive **Site Name** (e.g., "Nobile Rim Ridge West").
  - Enter **Lunar Latitude** ($-90^\circ$ to $+90^\circ$; inputs $\le -80^\circ$ are highlighted with a South Polar Circle badge).
  - Enter **Lunar Longitude** ($-180^\circ$ to $+360^\circ$).
  - Enter optional **Landing Elevation** in meters. If left blank, the backend queries the NASA LOLA Digital Elevation Model (DEM) polar stereographic grid at the target coordinates to automatically sample surface elevation and local terrain slope.
  - Set optional **Observer Mast Height** in meters (defaults to 2.0 m).
  - The custom site is instantly validated, registered, and added to the candidate sites selector. It becomes selectable across all 11 analysis views and multi-scenario comparisons.

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

### 3.4.1 Interactive Combined Local Sky-Horizon Simulator
* **Access Tab**: Click **`Sky Horizon`** (also accessible via direct button from Solar, Earth Comm, and Terrain tabs)
* **Purpose**: Interactive topocentric celestial simulator displaying the Sun and Earth simultaneously relative to the selected lunar landing site's actual NASA LOLA DEM 360-degree terrain horizon.
* **Key Features**:
  * **360° Circular Celestial Horizon Polar Radar**:
    * Concentric elevation rings from $-1.5^\circ$ to $+10.0^\circ$ centered on zenith.
    * 8 Cardinal and intercardinal compass directions ($N = 0^\circ, E = 90^\circ, S = 180^\circ, W = 270^\circ$).
    * **Variable LOLA Terrain Horizon Boundary**: Renders the ray-traced elevation mask as an authentic variable boundary (crimson ridge line with dark volcanic obstruction shading).
    * **0° Geometric Horizon**: Dotted blue reference circle clearly distinguishing the local tangent plane from topographic massifs.
    * **Simultaneous Sun & Earth Markers**:
      - ☀️ **Sun**: Golden orb with radiant corona when unshadowed; dimmed brown core with crossed-out red slash when terrain-occulted.
      - 🌍 **Earth**: Blue ocean orb with pulsing radio arcs when Direct-to-Earth line of sight exists; dark red blocked indicator when occulted by crater rims.
    * Sightline rays from central observer (lander mast) to both celestial bodies with live clearance angles.
    * Interactive cursor hover: calculates mouse azimuth angle, displays exact terrain obstruction angle, distance to blocking peak, and feature name.
  * **Linear 360° Panoramic Horizon Strip**:
    * Unwrapped $0^\circ \to 360^\circ$ panoramic horizon elevation profile.
    * Current Sun and Earth positions plotted with elevation clearance relative to the terrain ridge.
  * **Synchronized 3D Lunar Surface & Celestial Vectors (Three.js)**:
    * High-performance WebGL scene of the landing site topography.
    * Detailed lander model with solar mast and high-gain antenna dish.
    * **Real-time Directional Sunlight Ray**: Directional light positioned dynamically at $(az_\odot, el_\odot)$, casting real-time dynamic shadows across lunar craters and ridges as the timeline is scrubbed!
    * **Real-time Earth Direction Vector**: Cyan sightline pointing to a 3D Earth globe in the lunar sky at $(az_\oplus, el_\oplus)$ (turns red dashed when occulted).
  * **Interactive Time Transport Controls**:
    * Play/Pause toggle with smooth automated animation.
    * Timeline slider scrubbing through all mission time steps without triggering expensive API requests.
    * Step backward (`⏮`), step forward (`⏭`), and reset to mission start (`↺`).
    * Speed control selector ($1\times, 2\times, 5\times, 10\times, 25\times$).
    * Live UTC timestamp and mission elapsed time display (`T+00d 04h:00m`).
  * **Sun Visibility & Transition Dossier**:
    * Solar azimuth, elevation, terrain mask, and clearance angle ($\Delta el$).
    * Visibility classification: `DIRECT SUNLIGHT` vs `TERRAIN SHADOWED`.
    * **Polar Grazing Transition Prediction**:
      - Time remaining until next terrain shadow ingress ("sunset" equivalent).
      - Time remaining until next terrain shadow egress ("sunrise" equivalent).
      - Exact transition timestamp (UTC).
    * Total sunlight hours remaining in the mission and remaining percentage.
    * Scientific polar grazing explanation note.
  * **Earth Visibility & Libration Dossier**:
    * Earth azimuth, elevation, terrain mask, and clearance angle.
    * Link status: `DIRECT LINE OF SIGHT` vs `TERRAIN BLOCKED` vs `BELOW MIN ELEVATION`.
    * Apparent angular diameter ($\approx 1.88^\circ - 1.95^\circ$, ~4x larger than the Sun).
    * **Libration Ingress/Egress Transition Prediction**:
      - Time remaining until Earthset (occultation by terrain).
      - Time remaining until Earthrise (direct link re-acquisition).
      - Exact transition timestamp (UTC).
    * Total Direct-to-Earth visibility duration remaining in the mission.
  * **Comprehensive Legend**: Explains Sun, Earth, Terrain Horizon, Geometric Horizon, Visible Region, and Obstructed Region.

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

### 3.6 Earth Communication (DTE), Libration & RF Link Budget
* **Access Tab**: Click **`Earth Comm (DTE)`**
* **Purpose**: Track Direct-to-Earth (DTE) radio contact, blackout intervals driven by lunar orbital libration, antenna gimbal restrictions, and physical RF link closure.
* **Key Features**:
  * **Libration Dynamics**: Tracks Earth's apparent oscillation in the lunar sky through $\pm 6.7^\circ$ in latitude and $\pm 7.9^\circ$ in longitude.
  * **Earth Elevation vs Local Horizon Mask**: Displays when the Earth center dips below local ridges or below the operational minimum communication threshold (e.g. $0.5^\circ$).
  * **Antenna Gimbal Boundaries**: Enforces minimum/maximum antenna elevation angles and 360° azimuth slewing limits (`OUTSIDE_ANTENNA_GIMBAL`).
  * **DSN RF Link Budget Assessment**:
    * Physics-grounded Friis transmission equation computing Free Space Path Loss (FSPL $\sim 222\text{ dB}$ at X-band 8.45 GHz over $\sim 384,400\text{ km}$).
    * Incorporates Transmitter Power ($P_{\text{tx}}$ W), Transmitter Antenna Gain ($G_{\text{tx}}$ dBi), DSN 34-meter Receiver Antenna Gain ($G_{\text{rx}} = 68.0\text{ dBi}$), system losses, and Deep Space Network receiver noise spectral density ($N_0 = k T_{\text{sys}} \approx -207.3\text{ dBW/Hz}$ at $T_{\text{sys}} = 135\text{ K}$).
    * Separates geometric line-of-sight from actual RF link closure: a link is only deemed feasible when Link Margin $\ge 3.0\text{ dB}$.
  * **Discrete Scheduled Communication Windows**:
    * Tabulates individual ground station tracking passes (`comm_windows`): window start/end UTC, duration (hours), mean Earth elevation, and mean RF link margin.
    * Real-time countdown to next available downlink window.
  * **Link Status Timeline Bar**:
    * `DIRECT_LINE_OF_SIGHT` (Cyan): Unimpeded radio frequency telemetry to the NASA Deep Space Network with margin $\ge 3.0\text{ dB}$.
    * `INSUFFICIENT_LINK_MARGIN` (Purple): Earth is geometrically visible, but low transmitter power or excessive data rate causes link margin to drop below $3.0\text{ dB}$.
    * `OUTSIDE_ANTENNA_GIMBAL` (Amber): Target azimuth or elevation lies outside the lander gimbal envelope.
    * `TERRAIN_BLOCKED` (Rose): Signal occulted by local topographic massifs or crater rim crests.
    * `BELOW_MIN_ELEVATION` (Slate): Earth elevation falls below the minimum horizon clearance threshold.

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

### 3.8 Advanced Multi-Scenario Comparison System
* **Access Tab**: Click **`Compare Sites`**
* **Purpose**: Side-by-side comparative trade analysis and multi-scenario simulation allowing mission architects to compare up to 8 independent operational scenarios across different candidate landing sites, custom landing coordinates, and seasonal landing dates.
* **Comparison Modes**:
  1. **Mode A: Different Sites, Same Date**: Evaluates distinct candidate regions or custom coordinates under an identical mission launch window to determine optimal landing geography.
  2. **Mode B: Same Site, Different Dates**: Evaluates a single landing zone across seasonal illumination windows (e.g. December vs June vs March) or alternate Artemis launch opportunities to detect seasonal solar valleys and communication dropouts.
  3. **Mode C: Matrix (Different Sites & Different Dates)**: Full trade matrix across diverse geographic coordinates, landing epochs, and lander/rover hardware configurations.
* **Scenario Parameter Independence**:
  Each scenario maintains its own completely decoupled parameters (no shared global state):
  - **Landing Site / Custom Coordinates**: Choose from candidate catalog or enter custom Selenographic latitude, longitude, and elevation.
  - **Temporal Parameters**: Independent landing date, time (UTC), mission duration (1-30 days), and calculation step (1-6 hours).
  - **Power Subsystem**: Solar array area ($m^2$), photovoltaic efficiency (%), and tracking mode (Horizontal Fixed, Vertical Azimuth Tracking, Dual-Axis Tracking).
  - **Energy Storage**: Battery capacity ($Wh$), initial State of Charge (%), and minimum safe reserve margin (Depth-of-Discharge cutoff).
  - **Surface Power Demands**: Base avionics hotel load ($W$), active science payload load ($W$), and lunar night survival heater load ($W$).
  - **Hardware Presets**: One-click configuration for Artemis Lander ($4.5\text{ m}^2, 5000\text{ Wh}$), Science Rover ($1.2\text{ m}^2, 1200\text{ Wh}$), and Surface Habitat ($18.0\text{ m}^2, 35000\text{ Wh}$).
* **12 Comprehensive Scientific Metrics (Calculated from Real Engines)**:
  - **Solar Elevation (Mean & Max)**: Topocentric Sun elevation above horizon ($^\circ$).
  - **Total Sunlight Duration & Availability**: Hours and percentage of mission with unshadowed solar line-of-sight.
  - **Total Darkness Duration & Longest Continuous Shadow**: Critical shadow intervals for thermal/battery survival.
  - **Longest Continuous Sunlight Run**: Maximum unbroken science operational window.
  - **Earth Visibility Duration & Availability**: Direct-to-Earth (DTE) radio contact percentage.
  - **Longest Communication Blackout**: Maximum duration without DTE link to the Deep Space Network.
  - **Number of Communication Windows**: Discrete contact opportunities over mission duration.
  - **Minimum Battery State of Charge (%)**: Lowest battery SoC reached during shadow or peak loads.
  - **Total Solar Energy Generated ($kWh$)**: Cumulative photovoltaic output.
  - **Power Survival Status**: Health classification (`NOMINAL`, `SURVIVED_WITH_MARGIN`, `DEGRADED_MARGIN`, `BATTERY_DEPLETED`).
  - **Overall Mission Suitability Score**: Multi-criteria weighted score ($0-100$) reflecting illumination, comms, slope safety, and power margin.
* **Interactive Visualizations**:
  - **Scenario Configuration Cards**: Overview cards with Rank badge, hardware specs, and buttons to Edit, Duplicate, or Remove scenarios.
  - **Comparative Data Matrix Table**: Full tabular view with automatic **green best-in-class** and **rose worst-in-class** cell highlighting.
  - **Comparative Metric Bar Charts**: Side-by-side grouped bars for Solar Illumination %, Earth Comm %, Mission Suitability, and Minimum Battery SoC.
  - **Synchronized Sunlight & Earth Comm Timelines**: Micro-timeline gantt charts showing solar line-of-sight and Earth LOS intervals.
  - **Synchronized Battery SoC Overlaid Curves**: Multi-scenario time-series graph with a dashed 20% DoD red cutoff line.
  - **Scenario Leaderboard & Risk Dossiers**: Rank cards detailing key operational strengths and mission hazards.
  - **Data Export**: Export complete multi-scenario trade analysis as formatted **CSV** or **JSON** for mission documentation.

---

### 3.9 MCDA Ranking & Constraints Engine
* **Access Tab**: Click **`MCDA Ranking`**
* **Purpose**: Multi-Attribute Decision Analysis framework ranking candidate landing sites against user-defined mission preferences and engineering survival thresholds.
* **Key Features**:
  * **6 Normalized Criteria Weights**: Sliders automatically normalize across all operational priorities:
    * *Solar Illumination Weight* (Default: $0.35$)
    * *Earth Communication Weight* (Default: $0.30$)
    * *Slope Safety Weight* (Default: $0.20$)
    * *Elevation Vantage Weight* (Default: $0.15$)
    * *Power Survival Weight* (Default: $0.00$, customizable up to $1.00$)
    * *Blackout Resilience Weight* (Default: $0.00$, customizable up to $1.00$)
  * **Hard Constraint Thresholds**:
    * *Minimum Illumination Percentage* (e.g. $40\%$)
    * *Minimum Communication Availability* (e.g. $30\%$)
    * *Maximum Allowable Slope* (e.g. $12.0^\circ$)
    * *Maximum Continuous Shadow Duration* (e.g. $80.0\text{ h}$)
    * *Minimum Battery SoC Cutoff* (e.g. $20.0\%$)
    * *Maximum Communication Blackout* (e.g. $48.0\text{ h}$)
  * **Ranked Sites Output**:
    * Sorted ranking list ($1, 2, 3...$) with composite score ($/100$).
    * Factor breakdown pills displaying individual utility scores across all 6 criteria.
    * Transparent explainability narrative articulating why the site earned its rank.
    * Key Strengths & Operational Risks summary.
    * Risk Level categorization badge (`LOW_RISK`, `MODERATE_RISK`, `HIGH_RISK`).
  * **Disqualified Sites Panel**: Highlights sites excluded due to constraint violations with explicit violation messages.
  * **Mandatory NASA Safety Non-Certification Notice**: Clearly states that algorithmic MCDA scores are decision-support heuristics and do not constitute certified flight landing safety.

---

### 3.10 Mission Power & Battery Simulation
* **Access Tab**: Click **`Power Simulation`**
* **Purpose**: Electrical Power System (EPS) simulator modeling 3D vector solar incidence, panel tracking, active loads, thermal survival heaters, and battery electrochemical State-of-Charge (SoC).
* **Key Features**:
  * **Physics-Based 3D Solar Vector Incidence Angle**:
    * Calculates exact vector dot product: $\cos\theta_{\text{inc}} = \cos\alpha_\odot\sin\beta\cos(\phi_\odot - \gamma) + \sin\alpha_\odot\cos\beta$.
    * Directly models array tilt angle ($\beta \in [0^\circ - 90^\circ]$) and array azimuth orientation ($\gamma \in [0^\circ - 360^\circ]$).
    * Environmental derating: Incorporates dust degradation factor ($f_{\text{dust}} \approx 0.98$) and wiring/MPPT loss factor ($f_{\text{wiring}} \approx 0.97$).
  * **Solar Array Tracking Architecture Selector**:
    * `VERTICAL_AZIMUTH_TRACKING`: 1-Axis vertical array slewing in azimuth to follow low grazing polar Sun.
    * `DUAL_AXIS_TRACKING`: 2-Axis heliostat tracking normal to the solar vector.
    * `TILTED_FIXED`: Fixed tilted panel with customizable tilt and azimuth angles.
    * `FIXED_VERTICAL`: Fixed vertical panel.
    * `HORIZONTAL_FLAT`: Horizontal deck array. Suffers extreme grazing incidence and generates $< 3\%$ of solar flux.
    * `TILTED_OPTIMAL`: Sun-facing optimal tilt.
  * **Battery Electrochemical & Thermal Parameters**:
    * Coulombic round-trip efficiency: charging efficiency ($\eta_{\text{chg}} = 94\%$) and discharging efficiency ($\eta_{\text{dis}} = 95\%$).
    * C-rate charge intake power limit (`max_charge_power_w`) and maximum discharge limit (`max_discharge_power_w`) with power curtailment tracking.
    * Initial State of Charge ($100\%$) and minimum safe DoD threshold ($20\%$).
    * Continuous base hotel load ($W$), active daytime payload load ($W$), and shadow thermal survival heater load ($W$).
  * **Simulation Outputs & Survival Telemetry**:
    * Battery State-of-Charge (%) timeline graph with minimum safe DoD reference line.
    * Solar power generation vs load timeline ($W$) and curtailed excess power ($W$).
    * Solar incidence angle ($\theta_{\text{inc}}^\circ$) telemetry chart.
    * Peak generation, total energy generated ($kWh$), total consumed ($kWh$), and net energy balance.
    * Estimated survival duration (hours until DoD breach) and hours below safe cutoff.
    * Active power shortage warning notices alerting planners to battery depletion or narrow survival margins.
    * Explicit thermodynamic modeling limitation notice (cells assumed thermally maintained at nominal $0^\circ\text{C}-20^\circ\text{C}$ via survival heaters; cryogenic electrochemical derating below $0^\circ\text{C}$ is not modeled).

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

### Workflow G: Advanced Multi-Scenario Trade Study (Comparing Sites & Launch Dates)
1. Click the **`Compare Sites`** tab in the top navigation bar.
2. Select your comparison strategy using the **Mode Selector**:
   - **Mode A (Different Sites, Same Date)**: To evaluate which landing location offers the best solar and communication conditions for a fixed launch window.
   - **Mode B (Same Site, Different Dates)**: To compare seasonal launch windows for a fixed site (e.g., Shackleton Rim in December vs March vs July) to pinpoint when the Sun elevation is highest and shadows are shortest.
   - **Mode C (Matrix)**: To compare completely independent combinations of locations, dates, and hardware sizes.
3. Use the **Quick Presets** buttons (e.g. `Winter Solstice Launch: Dec 2026` or `Seasonal Windows (Dec / Mar / Jul)`) to load realistic baseline scenarios, or click **`+ Add Scenario`** to add a custom scenario.
4. To customize a scenario:
   - Click the **`⚙` (Edit)** button on any scenario card.
   - Select a candidate site from the dropdown or enter custom latitude/longitude coordinates.
   - Set the landing epoch (date and time UTC), mission duration, and calculation step.
   - Adjust power parameters: solar array area ($m^2$), efficiency, tracking mode, battery capacity ($Wh$), and surface loads ($W$).
   - Choose a hardware preset (`Lander Preset`, `Rover Preset`, `Habitat Preset`) to auto-fill realistic values.
   - Click **`Save Scenario Parameters`**.
5. Use **Duplicate** (`⎘`) to clone a scenario and test parameter sensitivities (e.g. comparing fixed horizontal solar panels vs vertical azimuth-tracking panels).
6. Click **`⚡ Run Multi-Scenario Comparison`**:
   - The backend runs parallel ephemeris, LOLA DEM ray-tracing, and EPS simulations for each scenario.
   - Review the **Leaderboard & Risk Cards** to see overall rankings and key operational strengths/hazards.
   - Inspect the **Comparative Data Matrix Table** with automatic green (best-in-class) and red (worst-in-class) highlights across all 12 metrics.
   - Analyze the **Comparative Bar Charts** for solar illumination, Earth comms, suitability score, and minimum battery SoC.
   - Examine the **Synchronized Sunlight & Earth Comm Timelines** to compare continuous operational windows and blackouts.
   - Check the **Synchronized Battery SoC Overlaid Curves** against the 20% DoD red limit line to confirm power survival.
7. Click **`Export CSV`** or **`Export JSON`** to download the comprehensive scenario results for your mission trade study report.

---

### Workflow H: Topocentric Sky-Horizon Evaluation & Ridge Occlusion Analysis
1. In the **Left Sidebar**, select your target landing site (e.g. **`Shackleton Crater Rim`** or **`Nobile Rim 1`**).
2. Click the **`Sky Horizon`** tab in the top navigation bar (or click **`Combined Sky Horizon →`** inside the Solar, Earth, or Terrain tabs).
3. The **360° Celestial Horizon Polar Radar** renders the local celestial dome with the variable LOLA DEM terrain horizon mask (shaded red boundary) and the $0^\circ$ Geometric Horizon circle.
4. Observe the current positions of the Sun (☀️ golden orb) and Earth (🌍 blue/cyan orb) with sightlines from the central lander:
   - Check the **Sun Dossier**: observe current azimuth, elevation, clearance angle ($\Delta el$), and time remaining until the next terrain shadow ingress ("sunset").
   - Check the **Earth Dossier**: observe current elevation, clearance above crater rims, direct line-of-sight status, and time remaining until next Earthset.
5. Press the **`▶ PLAY`** transport button (or scrub the timeline slider):
   - Watch the Sun track along its polar azimuth trajectory. When the solar marker crosses the red terrain boundary, observe it transition to a dark slashed orb, indicating shadow ingress by an occulting ridge.
   - Watch Earth oscillate along its libration loop. Observe whether libration causes Earth to dip below local rim topography, triggering a communication blackout.
6. Switch to **`3D Surface Scene`** (or **`Dual View`**):
   - Orbit and zoom with the mouse around the 3D lander.
   - Notice the dynamic directional sunlight beam casting real-time shadows across the craters and hills, synchronized with your timeline scrubbing!
   - Observe the cyan line-of-sight ray to the 3D Earth sphere in the sky, turning dashed red when blocked by terrain.
7. Switch to **`Horizon Strip`** to inspect the unwrapped $0^\circ \to 360^\circ$ panoramic profile showing both bodies' elevation relative to the local ridgeline.

---

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
