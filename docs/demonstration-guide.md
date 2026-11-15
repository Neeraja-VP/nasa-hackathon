# LUNA NAVIGATOR — Demonstration & Presentation Guide

> **AI-Powered Autonomous Lunar South-Pole Landing Site Analysis & Mission-Planning Platform**  
> *Artemis III / Commercial Lunar Payload Services (CLPS) Surface Characterization*

---

## 1. Executive Summary & Architecture Overview

**LUNA NAVIGATOR** is an operational decision-support platform designed to solve the primary engineering challenges of landing and operating near the lunar south pole:
1. **Grazing Solar Angles**: Solar elevation never exceeds 1.5°–2.0° above the local horizon, creating long, dynamic terrain shadows.
2. **Terrain-Obstructed Communications**: Earth oscillates around the southern horizon due to lunar libration (±6.7° in latitude, ±8.1° in longitude), resulting in periodic line-of-sight occultation behind topographic ridges.
3. **Extreme Thermal & Power Cycles**: Long shadows require accurate solar panel orientation modeling, battery state-of-charge tracking, and nighttime survival heater management.
4. **Multi-Attribute Decision Trade-offs**: Balances solar energy, Earth line of sight, geotechnical terrain slopes, and rover traversability.

### Unified Scientific Engine Architecture

```
                    ┌──────────────────────────┐
                    │ NASA JPL Horizons Service │
                    │  (DE440 Topocentric Pos)  │
                    └─────────────┬────────────┘
                                  │ (Live / Cached / Analytical Fallback)
                                  ▼
┌──────────────────────────┐   ┌──────────────────────────┐   ┌──────────────────────────┐
│  NASA PDS LOLA 100m DEM  │──▶│   Terrain Horizon Engine │──▶│   Interactive 360° Sky   │
│  (EPSG:3032 Polar DEM)   │   │  (360° Ray-Tracing Mask) │   │    Horizon & 3D Visual   │
└──────────────────────────┘   └─────────────┬────────────┘   └──────────────────────────┘
                                             │
                       ┌─────────────────────┴─────────────────────┐
                       ▼                                           ▼
         ┌──────────────────────────┐                ┌──────────────────────────┐
         │ Solar Illumination & EPS │                │ Earth Direct-to-Earth    │
         │ Power Simulation Engine  │                │ Comm & RF Link Budget    │
         └─────────────┬────────────┘                └─────────────┬────────────┘
                       │                                           │
                       └─────────────────────┬─────────────────────┘
                                             ▼
                               ┌──────────────────────────┐
                               │  6-Criteria MCDA Ranking │
                               │   & Scenario Comparison  │
                               └─────────────┬────────────┘
                                             │
                                             ▼
                               ┌──────────────────────────┐
                               │   AI Mission Assistant   │
                               │  (Safety & Traceability) │
                               └──────────────────────────┘
```

---

## 2. Three Pre-Configured Demonstration Scenarios

LUNA NAVIGATOR comes pre-configured with three distinct, scientifically validated scenarios that illustrate the core trade-offs of lunar south polar exploration:

### Scenario A: Solar Illumination Favorable (Peak Summer at Shackleton Rim)
* **Candidate Site**: `Shackleton Crater Rim` (89.78°S, 125.0°E, Elevation: 1240.0 m)
* **Epoch**: December 1, 2026 to December 15, 2026 (14 Days, Southern Summer Solstice)
* **Engineering Configuration**:
  * Solar Array: 4.5 m² triple-junction GaAs (30% efficiency), Vertical Azimuth-Tracking mast.
  * Battery Storage: 5000 Wh Li-ion, 100% initial SoC, 20% safe minimum cutoff.
  * Electrical Loads: 120 W avionics/hotel, 80 W active science payload, 150 W survival heater.
* **Observed Scientific Behavior**:
  * **Continuous Sunlight**: High topographic ridge stays above grazing sun rays; solar illumination exceeds 88%–95%.
  * **Nominal EPS Survival**: Battery state of charge stays above 90% throughout the 14-day window; zero critical energy shortages.
  * **Primary Hazard**: Very steep crater wall drop-offs (>25°) immediately adjacent to the narrow landing ridge.

### Scenario B: Earth Communication Favorable (Malapert Mountain Massif)
* **Candidate Site**: `Malapert Mountain` (85.99°S, 2.91°E, Elevation: 5050.0 m)
* **Epoch**: December 1, 2026 to December 15, 2026 (14 Days)
* **Engineering Configuration**:
  * High-Gain X-band Parabolic Dish ($G_t = 28\text{ dBi}$, $P_t = 15\text{ W}$, 8.4 GHz).
  * Antenna Elevation Limit: $-2.0^\circ$ (accommodating high mountain vantage).
* **Observed Scientific Behavior**:
  * **Unmatched Direct Line-of-Sight (DTE)**: Because of its 5,050-meter altitude above datum, Earth remains continuously visible at 3.5°–6.8° elevation, unobstructed by local terrain.
  * **Direct DTE Availability**: $> 96\%$ communication availability; link margin exceeds $+8.2\text{ dB}$ at 2.0 Mbps data rate.
  * **Mission Role**: Premier candidate site for a permanent lunar surface telecom relay station or far-side polar observatory.

### Scenario C: Seasonal & Spatial Trade-off (Connecting Ridge & Amundsen Rim)
* **Candidate Sites**: `Connecting Ridge` (89.44°S, 222.5°E) vs `Amundsen Rim` (84.45°S, 85.5°E)
* **Epochs**: Baseline (Dec 1) vs Winter Shadow Ingress (July / Jan non-optimal libration)
* **Observed Scientific Behavior**:
  * **Terrain Shadowing (Occultation)**: The high massif of de Gerlache crater casts an extended shadow across Connecting Ridge despite high nominal latitude, causing 42+ consecutive hours of darkness.
  * **Battery Stress**: Standard 5000 Wh battery depletes past the 20% safe margin unless oversized to $\ge 8000\text{ Wh}$ or supplemented with dynamic payload power throttling.
  * **Communication Blackout**: Southern lunar libration dips Earth below the ridge horizon, creating a 52-hour communication blackout window.

---

## 3. Step-by-Step Demonstration Walkthrough

Follow this 8-step walkthrough during a live demonstration, stakeholder review, or evaluation:

### Step 1: Launch and Health Verification
1. Access the frontend dashboard at `http://localhost:5173`.
2. Observe the **System Header**:
   * Green status dot indicating `API TELEMETRY LIVE` (`/api/v1/health` endpoint returning `status: "healthy"`).
   * Data Provenance indicator displaying `EPHEMERIS: NASA HORIZONS (LIVE / CACHED)` or `DE440 ANALYTICAL`.
3. Notice the navigation tabs providing direct access to all subsystems.

### Step 2: Mission Horizon Configuration & Custom Coordinates
1. Open the **Mission Horizon Sidebar** on the left.
2. Select a candidate site from the dropdown: e.g., `Shackleton Crater Rim`.
3. Toggle between predefined landing sites and observe instantaneous updates in coordinates, region classification, and elevation.
4. Click **"+ Custom Coordinates"**:
   * Enter a test custom site: e.g., Name: `Amundsen Baseline Beta`, Latitude: `-84.50`, Longitude: `86.20`, Elevation: `1650.0m`.
   * Test the coordinate validation: Enter Latitude `-95.0` or Longitude `250.0` to verify rejection and helpful range hints ($-90^\circ \le \text{Lat} \le 90^\circ$, $-180^\circ \le \text{Lon} \le 360^\circ$).
   * Click **Save & Select Site** to immediately evaluate the custom location using real DEM ray-tracing.

### Step 3: Interactive Combined Sky Horizon View (`SkyHorizonView`)
1. Click the **Sky Horizon** tab in the main navigation.
2. Inspect the **360° Polar Horizon Chart**:
   * Concentric circles depict elevation from $-5^\circ$ (outer edge) through $0^\circ$ (geometric horizon) to $+30^\circ$ (zenith center).
   * Cardinal directions (N, E, S, W) are clearly marked.
   * **Local LOLA Terrain Boundary**: Rendered as a distinct mountain-ridge contour showing actual topography elevation around the lander.
3. Observe celestial bodies:
   * **Sun (Yellow Marker)**: Displays current topocentric azimuth and elevation. If the Sun is below the terrain line, the badge indicates `TERRAIN OCCLUDED` with $0\text{ W/m}^2$ direct solar flux.
   * **Earth (Cyan Marker)**: Displays Earth's topocentric position and libration displacement. The badge indicates `DIRECT LINE-OF-SIGHT` or `TERRAIN BLOCKED`.
4. Drag the **Time Scrubbing Slider** at the bottom:
   * Watch the Sun trace its low 360-degree diurnal spiral across the polar horizon.
   * Watch Earth oscillate in its 27.3-day libration oval.
   * Review instantaneous event cards: *Time Remaining in Current Sunlight/Shadow*, *Next Sunrise/Sunset*, and *Next Earth Comm Window*.

### Step 4: Multi-Scenario Comparison Engine
1. Click the **Compare Sites** tab in the top navigation.
2. Experience the **Three Comparison Modes**:
   * **Mode A: Different Sites, Same Date**: Compares Shackleton Rim vs Connecting Ridge vs Malapert Mountain on Dec 1, 2026.
   * **Mode B: Same Site, Different Dates**: Compares Shackleton Rim across three seasonal epochs (Early Summer Dec 1, Solstice Peak Dec 15, Late Summer Jan 1).
   * **Mode C: Matrix (Different Sites & Different Dates)**: Simultaneously evaluates varying landing dates and power configurations.
3. Review the **Side-by-Side Comparison Metrics**:
   * Solar Illumination Percentage & Longest Darkness Gap.
   * Earth Visibility & Longest Telemetry Blackout.
   * Battery Minimum State of Charge (SoC %) and EPS Survival Status (`SURVIVES` vs `CRITICAL SHORTAGE`).
   * Composite MCDA Suitability Score ($[0, 100]$).
4. Click **Export JSON** or **Export CSV** to download ready-to-use telemetry files for mission reporting.

### Step 5: Power & Battery Engineering Simulation
1. Click the **Power Simulation** tab.
2. Adjust engineering sliders:
   * **Solar Tracking**: Toggle between `FIXED_HORIZONTAL`, `FIXED_VERTICAL_SOUTH`, `1-AXIS VERTICAL TRACKING`, and `2-AXIS DUAL TRACKING`.
   * Observe how vertical azimuth-tracking yields over $2.5\times$ more energy than horizontal arrays due to polar grazing sun vectors ($I = I_0 \cos\theta_i$).
   * **Degradation**: Adjust dust deposition derating ($0\% - 25\%$) and wiring transmission losses ($2\% - 10\%$).
   * **Thermal Heater Load**: Adjust nighttime survival heating ($50\text{ W} - 300\text{ W}$) to simulate cryogenic regolith cooling.
3. Observe the **Dual-Axis Chart**:
   * Upper chart: Solar generation ($P_{\text{gen}}$) vs combined mission load ($P_{\text{load}}$).
   * Lower chart: Battery State of Charge ($SoC\%$) timeline with safety threshold reference lines.
   * Automated **Survival Warning Banner**: Triggers if battery drops below the configured safe minimum threshold (default 20%).

### Step 6: Earth Communication & RF Link Budget
1. Click the **Earth Comm (DTE)** tab.
2. Review the communication availability timeline and discrete communication pass tables.
3. Inspect the **RF Link Budget Calculation Table**:
   * Free-space path loss ($FSPL \approx 202.5\text{ dB}$ at 8.4 GHz X-band).
   * Received Carrier-to-Noise spectral density ($C/N_0$).
   * Energy-per-bit to Noise ratio ($E_b/N_0$).
   * Required threshold ($E_b/N_0 = 4.5\text{ dB}$ for QPSK rate 1/2 DVB-S2).
   * **Link Margin**: Displayed in decibels with clear color-coded closure status (`LINK CLOSURE ACHIEVED` vs `NEGATIVE MARGIN`).
4. Mechanical Gimbal Limit Verification:
   * Minimum elevation constraint ($+2.0^\circ$) filters out ground-clutter multipath reflection.

### Step 7: MCDA Site Ranking & Sensitivity Analysis
1. Click the **MCDA Ranking** tab.
2. Adjust the interactive weight sliders:
   * Solar Illumination ($w_1$)
   * Earth Direct Communication ($w_2$)
   * Slope Safety ($w_3$)
   * Elevation Advantage ($w_4$)
   * Power Survival Margin ($w_5$)
   * Blackout Risk Mitigation ($w_6$)
3. Observe dynamic recalculation:
   * Weights are automatically normalized to sum to 1.0 ($\sum w_i = 1$).
   * Candidate sites immediately re-order based on Multi-Criteria Decision Analysis.
   * Any site exceeding the maximum slope threshold ($\theta_{\text{slope}} > 15.0^\circ$) is flagged with **HARD CONSTRAINT DISQUALIFIED**.

### Step 8: AI Mission Assistant Interaction
1. Click the **AI Assistant** tab.
2. Test sample mission planner inquiries:
   * *"Why is Shackleton Crater Rim ranked higher than Amundsen Rim for a 14-day mission in December 2026?"*
   * *"What are the primary power survival risks at Connecting Ridge during lunar winter?"*
   * *"Recommend the best site for an uncrewed communications relay lander."*
3. Observe the synthesized response:
   * Direct citations of ephemeris, terrain, and power simulation metrics.
   * Identification of specific trade-offs and terrain occultations.
   * Mandatory NASA safety disclaimer: *"Analysis based on NASA LOLA and JPL Horizons scientific models; operational flight landing certification requires full TRR / CDR sign-off."*

---

## 4. Key Talking Points for Evaluators & Presentations

| Topic | Common Question | Luna Navigator Scientific Answer |
|---|---|---|
| **Grazing Sun Angles** | *"Why can't you use standard horizontal solar panels at the lunar south pole?"* | At latitudes $>85^\circ\text{S}$, the solar elevation is only $0.5^\circ$ to $1.8^\circ$ above the horizon. A flat horizontal panel has an incidence angle $\theta_i \approx 88.5^\circ$, yielding $\cos\theta_i \approx 0.026$ (over $97\%$ geometric loss). Vertical tracking panels orient their surface normal perpendicular to the ground, capturing direct solar flux at $\cos\theta_i \approx 0.99$. |
| **Libration Dynamics** | *"Does Earth move in the lunar sky?"* | Because the Moon is tidally locked with non-zero orbital eccentricity ($e \approx 0.0549$) and orbital inclination ($5.14^\circ$), topocentric libration causes Earth to trace an apparent 27.3-day elliptical figure of eight in the local sky (up to $\pm 8.1^\circ$ in azimuth and $\pm 6.7^\circ$ in elevation). A site that has line of sight today may experience an 80-hour blackout next week as Earth dips behind a ridge. |
| **Terrain vs Geometric Horizon** | *"Why is a geometric horizon calculation insufficient?"* | Lunar polar topography features vertical elevation reliefs exceeding 5,000 meters over baseline distances of 20–40 km. Mountain ridges like the Malapert Massif or crater rims like de Gerlache block celestial line-of-sight up to $+3.5^\circ$ to $+5.0^\circ$ above the local tangent plane. Ray-tracing through real LOLA elevation data is essential to avoid mission loss. |
| **Data Provenance Transparency** | *"How do we know if calculations use real NASA data or fallbacks?"* | Every screen features a persistent Data Provenance Banner displaying the exact backend source: `LIVE NASA HORIZONS DATA`, `CACHED NASA HORIZONS DATA`, `ANALYTICAL FALLBACK DATA`, or `ACTUAL LOLA DEM`. No fabricated numbers or silent failures are permitted. |

---

## 5. Quick Verification Commands

To verify the complete system independently:

```bash
# 1. Run all 108 backend tests
python -m pytest -v

# 2. Run the end-to-end integration pipeline
python -m pytest backend/tests/test_system_integration.py -v

# 3. Build the production frontend static bundle
cd frontend && npm run build

# 4. Start the stack via Docker Compose
docker-compose -f docker-compose.prod.yml up -d
```
