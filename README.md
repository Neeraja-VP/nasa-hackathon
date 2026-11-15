# LUNA NAVIGATOR — AI-Powered Lunar Landing Site Navigator

[![NASA Space Apps Inspired](https://img.shields.io/badge/Inspiration-NASA%20Space%20Apps%202026-blue.svg)](https://www.spaceappschallenge.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Python: 3.10+](https://img.shields.io/badge/Python-3.10%2B-green.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115%2B-teal.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-19%20%7C%2018-blue.svg)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6%2B-purple.svg)](https://vitejs.dev/)

An interactive scientific decision-support platform designed to evaluate, rank, and simulate lunar south-pole landing sites for robotic and crewed exploration missions (such as NASA Artemis and CLPS).

---

## 🌟 Key Capabilities

- **NASA LROC QuickMap Visualizer (Stack #3314)**: Integrated visualization of the ASU / NASA LROC QuickMap cartographic environment (`https://share.google/sCb5mzv7y0G7kEfA4`), featuring South Pole Polar Stereographic projection (EPSG:3032 / `proj=10`), multi-layer composite stack (LROC WAC 64m/px mosaic, LOLA DEM, LROC NAC strips, PSR water ice traps), real-time grazing sunlight simulation (`earthShadowEnabled=true`), candidate site quick-jump presets, and seamless deep-linking.
- **Interactive 3D Moon Surface & South Pole DEM**: Full Three.js WebGL 3D rendering of the Lunar South Pole ($80^\circ\text{S} - 90^\circ\text{S}$) using NASA LOLA elevation data, featuring dynamic grazing solar illumination, suspended Earth with libration orientation, 3 viewing modes (South Pole DEM, Global Moon, Lander First-Person view), and 4 scientific shading colormaps (Regolith, LOLA elevation heatmap, slope safety, wireframe).
- **Interactive Lunar South Pole 2D Explorer**: Explore candidate landing sites (Shackleton Rim, Connecting Ridge, Malapert Mountain, etc.) with real selenographic coordinates and polar stereographic projection.
- **Sun & Solar Illumination Modeling**: Real-time celestial ephemeris via NASA JPL Horizons, calculating solar azimuth, elevation, and terrain-cast shadows.
- **Earth Visibility & Libration Analysis**: Compute Direct-to-Earth (DTE) communication availability, tracking lunar libration in latitude ($\pm 6.7^\circ$) and longitude ($\pm 7.9^\circ$).
- **Topographic Horizon Ray Tracing**: Extract 360-degree local terrain horizon masks from NASA LOLA digital elevation models (DEM) to determine true line-of-sight obstructions.
- **Multi-Site Comparison & MCDA Ranking**: Configurable multi-criteria decision analysis (MCDA) weighting solar illumination, communication windows, slope hazard, and elevation.
- **Mission Power & Energy Simulation**: Model solar array power generation and battery State-of-Charge (SoC) across mission durations.
- **Explainable AI Recommendations**: Provide clear engineering justifications for candidate site selection based strictly on empirical calculations.

---

## 👥 Team Responsibilities

| Role | Module | Primary Work Directory | Status |
| :--- | :--- | :--- | :--- |
| **Member 1 (Frontend)** | React dashboard, lunar explorer, ephemeris charts | `frontend/` | Complete |
| **Member 2 (Backend)** | FastAPI, JPL Horizons DE440, Ephemeris calculations | `backend/app/api/`, `backend/app/engines/ephemeris/` | Complete |
| **Member 3 (GIS / Compute)**| LOLA DEM processing, ray tracing, terrain horizon | `backend/app/engines/terrain/`, `datasets/` | Complete |
| **Member 4 (AI / Integration)**| MCDA ranking engine, mission energy simulation, AI assistant, deployment | `backend/app/engines/recommendation/`, `backend/app/engines/simulation/`, `backend/app/engines/assistant/` | Complete |

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- **Python 3.10+** (with NumPy, FastAPI, Pydantic, Pillow)
- **Node.js 18+** & npm
- **Git**

### 1. Backend Setup
```powershell
cd backend
$env:PYTHONPATH="."
uvicorn app.main:app --reload --port 8000
```
Backend API interactive docs will be available at: `http://localhost:8000/docs`

### 2. Frontend Setup
```powershell
cd frontend
npm install
npm run dev
```
Frontend application will be live at: `http://localhost:5173`

### 3. Running Unit Tests (66 Tests Across All Subsystems)
```powershell
cd backend
$env:PYTHONPATH="."
python -m pytest tests -v
```

---

## 🐳 Docker Deployment

### Development Deployment
```bash
docker-compose up --build
```

### Production Deployment
```bash
docker-compose -f docker-compose.prod.yml up --build -d
```
* **Frontend Web App**: `http://localhost:5173` (or `http://localhost:80`)
* **Backend API Docs**: `http://localhost:8000/docs`
* **PostgreSQL / PostGIS**: `localhost:5432`

---

## 📚 Technical Documentation & Guides

- [Official User Guide](docs/user-guide.md) — Comprehensive walkthrough of all 9 views and workflows
- [System Architecture](docs/architecture.md)
- [Shared API Contracts](docs/api-contracts.md)
- [Scientific & Mathematical Methodology](docs/scientific-methodology.md)
- [Planetary Data Sources](docs/data-sources.md)
- [GIS & Provenance Methodology](docs/gis-methodology-and-provenance.md)
- [AI Decision Support & System Integration](docs/system-integration-and-ai.md)
- [Team Git & PR Workflow](docs/team-workflow.md)

---

## 🔬 Scientific Data & Standards

- **Ephemerides**: NASA JPL Horizons (DE440 planetary ephemeris).
- **Elevation Model**: NASA LRO Lunar Orbiter Laser Altimeter (LOLA) PDS datasets.
- **Reference Datum**: Mean lunar sphere with $R_{moon} = 1737.4\text{ km}$ ($1,737,400\text{ meters}$).
- **Coordinate System**: Lunar Mean Earth / Polar Axis (ME) selenographic frame.
