# LUNA NAVIGATOR — System Integration, AI/ML Decision Support, and Mission Simulation

**Module Ownership**: Member 4 (AI/ML & System Integration)  
**Applicable Packages**: `backend/app/engines/recommendation/`, `backend/app/engines/simulation/`, `backend/app/engines/assistant/`, `frontend/src/components/assistant/`, `docs/`  
**Shared Contracts**: [docs/api-contracts.md](file:///c:/Users/l/Documents/lunarsite_hackathon/luna-project/docs/api-contracts.md) Sections 6, 7, 8, and AI Decision Support

---

## 1. End-to-End System Integration Architecture

LUNA NAVIGATOR integrates 4 specialized subsystem domains into a unified, reactive scientific decision-support system:

```
                           +------------------------------------------+
                           |           Member 1: Frontend             |
                           |   React 18 + Vite + Tailwind Dashboard   |
                           |   2D Polar Stereographic Explorer        |
                           |   360° Terrain Radar + EPS Charts        |
                           +--------------------+---------------------+
                                                |  HTTP JSON REST APIs
                                                v
                           +--------------------+---------------------+
                           |            FastAPI Gateway               |
                           |      Pydantic v2 Contract Validation     |
                           +----+------------------+--------------+---+
                                |                  |              |
           +--------------------+                  |              +--------------------+
           v                                       v                                   v
+----------------------+        +----------------------+        +----------------------+
| Member 2: Ephemeris  |        | Member 3: GIS / DEM  |        | Member 4: AI & Sim   |
| NASA JPL Horizons    |        | NASA LOLA DEM (100m) |        | MCDA Ranking Engine  |
| DE440 Planetary Model|        | Spherical Curvature  |        | EPS Power Simulation |
| Az / El / Range      |        | 360° Ray Tracer Mask |        | AI Mission Assistant |
+----------+-----------+        +----------+-----------+        +----------+-----------+
           |                               |                               |
           +-------------------------------+-------------------------------+
                                           |
                                           v
                        +------------------+-------------------+
                        |   Explainable Decision Support       |
                        |   Factual Grounding (No Hallucination|
                        |   Explicit NASA Safety Boundary      |
                        +--------------------------------------+
```

---

## 2. Explainable Landing-Site Ranking (MCDA Engine)

### 2.1 Multi-Criteria Decision Framework
The Multi-Criteria Decision Analysis (MCDA) engine ranks candidate landing zones by evaluating normalized component utility functions against user-defined mission priorities:

$$S_{total} = w_{illum} \cdot S_{illum} + w_{comm} \cdot S_{comm} + w_{slope} \cdot S_{slope} + w_{elev} \cdot S_{elev}$$

where weights are normalized such that $\sum_k w_k = 1.0$.

#### Component Utility Metrics $[0 - 100]$:
1. **Solar Illumination ($S_{illum}$)**: Cumulative fraction of mission time where the Sun's upper limb exceeds the local LOLA terrain horizon ($0\% - 100\%$).
2. **Earth Communication ($S_{comm}$)**: Cumulative fraction of mission time where the Earth center is in direct line of sight above local terrain and above minimum elevation threshold $\gamma_{min} = 0.5^\circ - 1.0^\circ$ ($0\% - 100\%$).
3. **Slope Safety ($S_{slope}$)**:
   $$S_{slope} = \max\left(0.0, 100.0 \cdot \left(1.0 - \frac{\theta_{slope}}{\theta_{max\_acceptable}}\right)\right)$$
   For a nominal $12^\circ$ maximum limit: $4.8^\circ$ slope (VIPER Nobile) scores $60.0$, while $8.5^\circ$ (Shackleton Rim) scores $29.2$.
4. **Elevation Vantage ($S_{elev}$)**:
   $$S_{elev} = \min\left(100.0, \max\left(0.0, \frac{h + 1000.0}{60.0}\right)\right)$$
   Towering massifs (Malapert Mountain $+5050\text{ m}$) score $100.0$, while deep basins score near $0.0$.

### 2.2 Hard Operational Constraint Filtering
Sites failing operational mission requirements are disqualified prior to ranking:
* **Illumination Threshold**: Cumulative sunlight $< \text{min\_illumination\_percentage}$ (e.g. $< 50\%$).
* **Communication Threshold**: Direct-to-Earth contact $< \text{min\_communication\_percentage}$ (e.g. $< 40\%$).
* **Maximum Slope Limit**: Local surface slope $> \text{max\_acceptable\_slope\_degrees}$ (e.g. $> 12^\circ$).
* **Continuous Shadow Ceiling**: Longest uninterrupted shadow $> \text{max\_continuous\_shadow\_hours}$ (e.g. $> 72\text{ h}$).

### 2.3 Transparent Explainability & Risk Levels
Every ranked candidate includes:
* **Factor Decomposition**: Component-by-component scores ($S_k$).
* **Raw Physical Metrics**: Exact empirical values (elevation in meters, slope in degrees, longest shadow in hours, longest blackout in hours).
* **Key Strengths & Key Operational Risks**: Natural language summaries of physical trade-offs.
* **Risk Categorization**:
  * `LOW_RISK`: Gentle slope ($\le 6^\circ$), short shadow ($\le 24\text{ h}$), high comm availability.
  * `MODERATE_RISK`: Moderate slope ($6^\circ - 8^\circ$) or shadow intervals ($24\text{ h} - 36\text{ h}$).
  * `HIGH_RISK`: Slope $> 8^\circ$, shadow $> 36\text{ h}$, or narrow communication margins.

### 2.4 Crucial Scientific & Safety Certification Boundary
> [!IMPORTANT]
> **No Fabricated NASA Safety Certification**:
> The MCDA composite score is an automated mission-planning decision-support heuristic derived from orbital mechanics and gridded LOLA topography ($100\text{ m/pixel}$).
> **A high mathematical score DOES NOT constitute NASA certification of landing safety.**
> Final landing safety certification requires:
> 1. Sub-meter hazard detection (boulders $\ge 0.5\text{ m}$, micro-craters $\ge 2\text{ m}$) via LROC NAC or descent LIDAR.
> 2. Regolith geotechnical load-bearing capacity assessment to prevent landing gear puncture/settling.
> 3. Terminal descent trajectory guidance, hazard avoidance margins, and propellant reserves.

---

## 3. Mission Energy Simulation (EPS Engine)

### 3.1 Solar Array Tracking Kinematics
At the Lunar South Pole, the Sun circles the horizon at acute elevations ($0^\circ - 1.8^\circ$). The Electrical Power System (EPS) simulation models 4 distinct array geometries:

1. **Vertical Azimuth Tracking (`VERTICAL_AZIMUTH_TRACKING`)**:
   * Panel rotates about vertical axis to track Sun in azimuth.
   * Panel normal is horizontal ($El_{panel} = 0^\circ$).
   * Incidence angle $\theta_{inc} \approx El_{sun}$.
   * $\cos(\theta_{inc}) = \cos(El_{sun}) \approx \cos(1.5^\circ) = 0.99965$ (harvests $> 99.9\%$ of solar flux).
2. **Horizontal Flat (`HORIZONTAL_FLAT`)**:
   * Panel mounted flat on lander top deck (normal vector = Zenith).
   * Incidence angle $\theta_{inc} = 90^\circ - El_{sun}$.
   * $\cos(\theta_{inc}) = \sin(El_{sun}) \approx \sin(1.5^\circ) = 0.02618$ (harvests only $\sim 2.6\%$ of solar flux).
3. **Fixed Vertical (`FIXED_VERTICAL`)**:
   * Fixed vertical panel facing North ($0^\circ$ azimuth): $\cos(\theta_{inc}) = \max(0, \cos(El_{sun}) \cos(Az_{sun}))$.
4. **Optimal Tilt (`TILTED_OPTIMAL`)**:
   * Tilted at $80^\circ$ from horizontal towards azimuth.

### 3.2 Electrical Power & Battery Dynamics
* **Solar Power Generation**:
  $$P_{gen} = S_0 \cdot A_{array} \cdot \eta_{cell} \cdot \cos(\theta_{inc}) \cdot \mathbb{I}_{sunlit}$$
  where $S_0 = 1361.0\text{ W/m}^2$, $\eta_{cell} = 0.30$ (triple-junction GaAs), and $\mathbb{I}_{sunlit} \in \{0, 1\}$ is verified by LOLA terrain ray tracing.
* **Electrical Load Profile**:
  * Sunlit: $P_{load} = P_{base\_hotel} + P_{payload\_active}$
  * Shadow: $P_{load} = P_{base\_hotel} + P_{survival\_heater}$ (thermal heaters maintain avionics above cryogenic limits)
* **Battery State-of-Charge (SoC)**:
  * Charging ($P_{net} \ge 0$): $\Delta E = P_{net} \cdot \Delta t \cdot \eta_{chg}$ ($\eta_{chg} = 0.95$)
  * Discharging ($P_{net} < 0$): $\Delta E = |P_{net}| \cdot \Delta t / \eta_{dis}$ ($\eta_{dis} = 0.95$)
  * State of Charge: $\text{SoC} = (E_{stored} / E_{capacity}) \cdot 100\%$
  * Depletion condition: $\text{SoC} < \text{min\_safe\_soc\_percent}$

---

## 4. AI Mission Assistant Using Verified Scientific Outputs

The AI Mission Assistant (`/api/assistant`) synthesizes multi-engine data into structured engineering briefings:

### 4.1 Capabilities & Intents
* `RECOMMEND_OPTIMAL_SITE`: Ranks candidates, highlights the top site, and explains trade-offs.
* `POWER_SIMULATION`: Evaluates EPS battery survival, generation surplus, and shadow survival margins.
* `SITE_COMPARISON`: Generates a structured multi-parameter comparison matrix.
* `COMMUNICATION_ANALYSIS`: Analyzes Earth DTE line-of-sight and libration blackout intervals.
* `SAFETY_HAZARD_INQUIRY`: Evaluates slope gradients and landing gear touchdown risks.
* `GENERAL_SCIENCE`: Explains polar orbital mechanics and data provenance.

### 4.2 Factual Grounding & Guardrails
* **No Fabricated Values**: Coordinates, elevations, illumination %, and blackout hours are pulled directly from Horizons DE440 and LOLA GDR computations.
* **NASA Non-Certification Notice**: Emphasizes heuristic boundaries on every query.
* **Suggested Inquiries**: Surfaces next-step exploration questions for mission operators.

---

## 5. Deployment Guide

### 5.1 Production Deployment via Docker Compose
```bash
# Build and run backend, frontend, and PostGIS database
docker-compose -f docker-compose.prod.yml up --build -d
```
* **Frontend**: `http://localhost:5173` (or `http://localhost:80`)
* **Backend API**: `http://localhost:8000/docs`
* **PostgreSQL / PostGIS**: `localhost:5432`

### 5.2 Local Developer Execution
```powershell
# 1. Backend Service
cd backend
$env:PYTHONPATH="."
uvicorn app.main:app --reload --port 8000

# 2. Frontend Development Server
cd frontend
npm run dev
```

### 5.3 Complete Verification Test Suite (66 Tests)
```powershell
$env:PYTHONPATH="luna-project\backend"
python -m pytest luna-project\backend\tests -v
```
Validates:
* All 14 API endpoints (including `/api/assistant`)
* IAU ME Selenographic to Cartesian coordinate conversions & basis orthonormality
* NASA JPL Horizons DE440 benchmarks & parser
* NASA LOLA DEM sampling, slope gradients, and PDS catalog
* Spherical curvature drop ($259.01\text{ m}$ at $30\text{ km}$) and 360° ray tracing
* MCDA ranking, weights normalization, and constraints
* EPS power generation, tracking geometries, and battery depletion
* AI Mission Assistant grounding, intent routing, and safety disclaimers
* End-to-end multi-subsystem pipeline
