# LUNA NAVIGATOR — Official Hackathon Demonstration Guide

---

## 1. Executive Summary & Problem Context

### The Challenge
The Lunar South Pole is the primary target for NASA’s Artemis campaign and international lunar exploration due to deep, permanently shadowed regions (PSRs) that trap billions of kilograms of water ice and volatile resources. However, operating at the lunar pole introduces extreme, unprecedented engineering challenges:
1. **Grazing Solar Angles**: Because the Moon's spin axis is tilted only $1.54^\circ$ relative to the ecliptic normal, the Sun never rises high in the polar sky (solar elevation oscillates between $-1.8^\circ$ and $+1.8^\circ$ above the mean horizontal plane). Distant crater rims and massifs tens of kilometers away easily occult the Sun, plunging landers into abrupt, cryogenic shadows ($<40\text{ K}$).
2. **Dynamic Earth Libration**: Because the Moon’s orbit is eccentric ($e \approx 0.0549$) and inclined ($5.14^\circ$), the Earth oscillates by $\pm 6.7^\circ$ in latitude and $\pm 7.9^\circ$ in longitude over a 27.3-day cycle. An antenna at the south pole sees Earth rise and dip below the local topography, severing direct line-of-sight communication.
3. **Severe Multi-Variable Trade-Offs**: No single site offers $100\%$ continuous sunlight, $100\%$ Earth communication, and zero-slope terrain. Mission architects must conduct rigorous trade studies between power survival, telecom blackouts, touchdown slope hazards, and landing dates.

### The Solution: LUNA NAVIGATOR
**LUNA NAVIGATOR** is an AI-powered, scientifically verified lunar landing site evaluation and mission-planning platform. It synthesizes observational ephemerides from **NASA JPL Horizons**, elevation topography from the **NASA Lunar Reconnaissance Orbiter (LRO) LOLA DEM**, 3D solar array incidence kinematics, RF link budget physics, and Multi-Criteria Decision Analysis (MCDA) to de-risk landing site selection for landers, rovers, and human surface habitats.

---

## 2. Three Hackathon Demonstration Scenarios

To demonstrate the full scientific and engineering depth of LUNA NAVIGATOR, present the following three scenarios during the live judging demonstration:

```
+-------------------------------------------------------------------------------------------------------+
| SCENARIO COMPARISON MATRIX (14-Day Artemis Surface Mission: Dec 1 - Dec 15, 2026)                      |
+------------------------------------+--------------------------+-----------------------+---------------+
| Metric                             | Scenario A               | Scenario B            | Scenario C    |
|                                    | Shackleton Crater Rim    | Malapert Massif       | Connecting    |
|                                    | (Solar Priority)         | (Telecom Priority)    | Ridge (Shift) |
+------------------------------------+--------------------------+-----------------------+---------------+
| Latitude / Longitude               | -89.78° / 125.0°         | -86.04° / 2.7°        | -89.44°/222.5°|
| Topographic Elevation (m)          | +1,240 m                 | +5,020 m              | +1,850 m      |
| Landing Date                       | 2026-12-01 00:00 UTC     | 2026-12-01 00:00 UTC  | 2027-01-15 UTC|
| Solar Illumination (%)             | 82.5%                    | 74.2%                 | 68.4%         |
| Longest Continuous Shadow (h)      | 24.0 h                   | 42.0 h                | 56.0 h        |
| DTE Comm Availability (%)          | 76.4%                    | 98.1%                 | 64.2%         |
| Longest Comm Blackout (h)          | 32.0 h                   | 4.0 h (Near-Zero)     | 48.0 h        |
| Nominal RF Link Margin (dB)        | +16.0 dB                 | +16.8 dB              | +15.7 dB      |
| Minimum Battery SoC (%)            | 42.1% (Safe)             | 22.4% (Near Cutoff)   | 0.0% DEPLETED |
| Net Energy Balance (kWh)           | +13.2 kWh                | +4.8 kWh              | -6.2 kWh      |
| Operational Status                 | POWER NOMINAL            | SURVIVAL FEASIBLE     | SHORTAGE HAZARD|
+------------------------------------+--------------------------+-----------------------+---------------+
```

### Scenario A: Shackleton Crater Rim (Solar Illumination Priority)
- **Coordinates**: $-89.78^\circ$ Latitude, $125.0^\circ$ Longitude | Elevation: $+1,240\text{ m}$
- **Scientific Profile**: Located on the rim of Shackleton Crater (a 21 km wide, 4.2 km deep permanently shadowed cold trap). Receives quasi-continuous illumination ($82.5\%$) because its elevated rim stays above surrounding terrain.
- **Mission Implication**: High solar yield ($78.4\text{ kWh}$ generated), short continuous shadow periods ($24\text{ h}$), ensuring battery state-of-charge never falls below $42\%$. Ideal for solar-powered rover and habitat operations.

### Scenario B: Malapert Massif / Mountain (Direct-to-Earth Telecom Priority)
- **Coordinates**: $-86.04^\circ$ Latitude, $2.7^\circ$ Longitude | Elevation: $+5,020\text{ m}$
- **Scientific Profile**: A massive topographic mountain rising $5\text{ km}$ above the surrounding terrain, permanently tilted towards Earth.
- **Mission Implication**: Direct line-of-sight Earth communication is available $98.1\%$ of the mission duration with a maximum blackout of only $4\text{ hours}$. Eliminates the need for orbital relay satellites during critical landing and sample return operations.

### Scenario C: Connecting Ridge — Date Shift Trade-Off
- **Coordinates**: $-89.44^\circ$ Latitude, $222.5^\circ$ Longitude | Elevation: $+1,850\text{ m}$
- **Scientific Profile**: Evaluated on an alternative winter date ($2027\text{-}01\text{-}15$) to showcase orbital sensitivity.
- **Mission Implication**: Changes in lunar sub-solar latitude and terrain horizon clearance result in an extended $56\text{-hour}$ shadow. A standard $5\text{ kWh}$ battery fully depletes to $0.0\%$, triggering an automated **MISSION SURVIVAL HAZARD** warning and demonstrating why dynamic mission date scheduling is vital.

---

## 3. Step-by-Step Live Demonstration Script

Follow these 10 steps to conduct an impressive 5-minute demonstration:

### Step 1: Mission Overview & Site Dossier (`Overview` Tab)
1. Point out the top header telemetry: Connected to FastAPI backend, active site coordinates, and current mission date.
2. Select **Shackleton Crater Rim** from the left sidebar.
3. Review the **Dossier Card**: Geological significance, volatile cold-trap proximity, landing slope ($8.5^\circ$), and target mission classes.
4. Click **Export Dossier** to demonstrate one-click JSON telemetry export.

### Step 2: 2D Polar Explorer & Interactive 3D Surface DEM (`Explorer` & `3D Surface` Tabs)
1. Switch to the **Explorer** tab: Point out the polar stereographic coordinate projection ($R = 2 R_{moon} \tan(\pi/4 - \phi/2)$), landing candidate markers, and named crater rims.
2. Switch to the **3D Surface** tab: Inspect the high-resolution Three.js interactive terrain mesh. Show the real-time Sun vector cast across the lunar topography and dynamic day/night terminator shading.

### Step 3: Combined SkyHorizon 360° Azimuth-Elevation Viewer (`Sky Horizon` Tab)
1. Switch to the **Sky Horizon** tab.
2. Highlight the circular polar radar: North ($0^\circ$), East ($90^\circ$), South ($180^\circ$), West ($270^\circ$).
3. Point out:
   - **Local Terrain Horizon** (red variable boundary showing actual LOLA topography).
   - **Current Sun Position** (yellow marker with elevation angle).
   - **Current Earth Position** (cyan marker with elevation clearance).
4. Drag the **Interactive Time Slider**: Show how the polar Sun revolves azimuthally along the horizon while Earth oscillates vertically due to lunar physical libration.

### Step 4: Solar Illumination & LOLA Horizon Ray-Tracing (`Illumination` Tab)
1. Switch to the **Illumination** tab.
2. Note the **Data Source Banner**: Transparently displays *LIVE / CACHED NASA HORIZONS DATA* and *NASA LOLA RASTER DEM ($100\text{ m}$ resolution)*.
3. Review the Illumination Profile: Observe the grazing solar elevation ($0.5^\circ - 1.5^\circ$) plotted against the terrain horizon mask.
4. Point out the terrain clearance metric: Sunlight occurs only when Sun elevation exceeds the terrain mask.

### Step 5: Direct-to-Earth (DTE) Communication & RF Link Budget (`Communication` Tab)
1. Switch to the **Communication** tab.
2. Note the four KPI cards: Availability ($76.4\%$), Longest Comm Window ($110\text{ h}$), Max Comm Blackout ($32\text{ h}$), and Next Available Downlink Window countdown.
3. Switch view to **Link Margin (dB)**:
   - Show the Free Space Path Loss ($\text{FSPL} \approx 211.0\text{ dB}$) at $384,400\text{ km}$ and $2.2\text{ GHz}$.
   - Received power ($P_{\text{rx}} \approx -104\text{ dBm}$) and $+16.0\text{ dB}$ margin over receiver sensitivity threshold ($-120\text{ dBm}$).
4. Scroll down to the **Contiguous Communication Windows Table**: Point out exact downlink start times, end times, duration, and peak elevation angles.

### Step 6: Electrical Power System (EPS) & Battery Simulation (`Simulation` Tab)
1. Switch to the **Power Simulation** tab.
2. Point out the physical EPS model equation:
   $$P_{\text{gen}} = S_0 \cdot A \cdot \eta \cdot \max(0, \cos\theta_{\text{inc}}) \cdot \eta_{\text{dust}} \cdot \eta_{\text{thermal}}$$
3. Review the **Battery State-of-Charge (SoC)** curve: Minimum SoC reaches $42.1\%$, safely above the $20\%$ cutoff line.
4. Switch to **Power Flows (W)**: Show generation, avionics hotel load, active payload load, and nighttime survival heating.
5. Click the **CLPS Commercial Micro-Lander** preset: Show how a smaller battery and fixed panel causes SoC to drop near the critical threshold, triggering an advisory warning.

### Step 7: Multi-Scenario Comparative Trade Study (`Compare` Tab)
1. Switch to the **Compare Scenarios** tab.
2. Select **Mode A: Different Sites, Same Date**.
3. Compare **Shackleton Crater Rim**, **Malapert Mountain**, and **Connecting Ridge** side-by-side.
4. Review the 12 empirical comparison metrics, synchronized sunlight and communication timelines, and automated scenario ranking.
5. Click **Export Comparison (CSV)** and **Export Comparison (JSON)** to prove interoperability with flight software.

### Step 8: Multi-Criteria Decision Analysis (MCDA) 6-Criteria Ranking (`Ranking` Tab)
1. Switch to the **MCDA Ranking** tab.
2. Explain the 6 weighted operational criteria:
   - Solar Illumination
   - Earth Communication (DTE)
   - Slope Touchdown Safety
   - Topographic Elevation Advantage
   - Power Survival Feasibility
   - Blackout Risk Mitigation
3. Select the **Continuous Telecom Relay** preset: Show how Malapert Massif claims Rank #1 ($91.2\text{ score}$).
4. Select the **Maximum Solar Power** preset: Show how Shackleton Crater Rim rises to Rank #1 ($88.4\text{ score}$).
5. Adjust the **Max Comm Blackout** constraint to $20\text{ hours}$: Show how Shackleton is automatically moved to the **Disqualified Candidates** list with full violation transparency.

### Step 9: AI Mission Assistant (`AI Assistant` Tab)
1. Switch to the **AI Assistant** tab.
2. Click the quick query: *"What are the primary hazards of landing at Shackleton Crater Rim?"*
3. Show how the AI generates an explainable, fact-based response citing verified LOLA slopes ($8.5^\circ$), longest shadow ($24\text{ h}$), and DTE blackout ($32\text{ h}$), without hallucinating certification safety.

---

## 4. Key Scientific Calculations & Reference Equations

1. **Topocentric Selenographic Transformation**:
   $$\vec{\rho} = \vec{r}_{\text{body}} - \vec{r}_{\text{site}}, \quad \text{El} = \arcsin\left(\frac{\vec{\rho} \cdot \hat{u}}{\|\vec{\rho}\|}\right), \quad \text{Az} = \text{atan2}(\vec{\rho} \cdot \hat{e}, \vec{\rho} \cdot \hat{n}) \pmod{360^\circ}$$
2. **Lunar Curvature Drop**:
   $$\Delta h_{\text{curv}} \approx \frac{s^2}{2 R_{\text{moon}}} \quad (\approx 259\text{ m at } 30\text{ km})$$
3. **LOLA Ray-Tracing Horizon Profile**:
   $$H(\theta) = \max_{s \in [s_{\text{min}}, s_{\text{max}}]} \arctan\left(\frac{h(s) - h_0 - \frac{s^2}{2 R_{\text{moon}}}}{s}\right)$$
4. **3D Solar Vector Cosine Incidence**:
   $$\cos(\theta_{\text{inc}}) = \sin(\text{el})\cos(\beta) + \cos(\text{el})\sin(\beta)\cos(\text{az} - \alpha)$$
5. **Free Space Path Loss (FSPL)**:
   $$\text{FSPL}(\text{dB}) = 92.45 + 20\log_{10}(d_{\text{km}}) + 20\log_{10}(f_{\text{ghz}})$$
6. **MCDA Normalized Weighted Scoring**:
   $$\text{Score}(\text{site}) = \sum_{k=1}^{6} w'_k \cdot S_k(\text{site}), \quad w'_k = \frac{w_k}{\sum_{j=1}^6 w_j}$$

---

## 5. Transparent Scientific Limitations

In accordance with strict scientific integrity principles:
1. **Isothermal Battery Approximation**: Battery cells are modeled under nominal thermal control; deep cryogenic ($<100\text{ K}$) electrochemical kinetics require flight-qualification thermal radiator simulation.
2. **RF Multipath & Lunar Regolith Scattering**: The RF link budget assesses line-of-sight free space loss; grazing surface multipath reflections and regolith dielectric attenuation at very low elevations ($<0.5^\circ$) are omitted.
3. **DEM Raster Resolution**: Regional terrain calculations utilize $100\text{ m/pixel}$ LOLA DEMs. Micro-topography, boulders, and craters under $100\text{ m}$ diameter require high-resolution LROC NAC stereophotoclinometry prior to terminal descent.
4. **Advisory Decision Support Only**: LUNA NAVIGATOR outputs are engineering trade-study guidelines and do not constitute formal NASA/ESA flight-certified landing clearance.
