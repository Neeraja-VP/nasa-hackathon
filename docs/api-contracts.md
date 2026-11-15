# LUNA NAVIGATOR — Shared API Contract Specification

This document defines the strict REST API contracts for communication between the Frontend (Member 1) and Backend Engines (Members 2, 3, and 4). All endpoints use JSON payloads and validate schemas through Pydantic v2 models.

Base URL: `/api` (or `/api/v1`)

---

## 1. Candidate Sites Catalog

### `GET /api/sites`
Retrieve list of all pre-characterized lunar landing candidate sites.

**Response `200 OK`**:
```json
[
  {
    "id": "shackleton-rim",
    "name": "Shackleton Crater Rim",
    "region": "South Pole Proper",
    "latitude": -89.78,
    "longitude": 125.0,
    "elevation_m": 1240.0,
    "slope_degrees": 8.5,
    "description": "High ridge along the rim of Shackleton Crater...",
    "scientific_interest": "Volatiles prospecting, cryogenic ice preservation...",
    "primary_advantages": ["High solar illumination", "Near-permanent radio LOS to Earth"],
    "primary_challenges": ["Steep crater wall drop-offs nearby"],
    "target_mission_class": ["Artemis III Crewed", "CLPS Commercial Lander"]
  }
]
```

### `GET /api/sites/{site_id}`
Retrieve detailed information for a single candidate site by ID.

**Response `200 OK`**: Single site object as above.
**Response `404 Not Found`**:
```json
{
  "detail": "Site with ID 'unknown-site' not found."
}
```

### `POST /api/sites/custom`
Characterize a custom user-defined lunar landing coordinate by sampling elevation and slope from the NASA LOLA digital elevation model (DEM).

**Request Body**:
```json
{
  "name": "Faustini Rim Peak",
  "latitude": -87.18,
  "longitude": 77.0,
  "elevation_m": null,
  "observer_height_m": 2.0,
  "description": "Custom vantage point overlooking cold trap floor"
}
```

**Response `200 OK`**:
```json
{
  "id": "custom-faustini-rim-peak",
  "name": "Faustini Rim Peak",
  "region": "Custom South Pole Target",
  "latitude": -87.18,
  "longitude": 77.0,
  "elevation_m": 1824.5,
  "slope_degrees": 5.4,
  "observer_height_m": 2.0,
  "description": "Custom vantage point overlooking cold trap floor",
  "data_source": "NASA LOLA 30m South Pole DEM"
}
```

---

## 2. Ephemeris Engine

### `POST /api/ephemeris`
Calculate Sun and Earth topocentric positions (Azimuth, Elevation, Range) relative to a specific lunar surface coordinate over a given mission window.

**Request Body**:
```json
{
  "latitude": -89.78,
  "longitude": 125.0,
  "elevation_m": 1240.0,
  "start_date": "2026-12-01T00:00:00Z",
  "duration_days": 14.0,
  "step_hours": 2.0
}
```

**Response `200 OK`**:
```json
{
  "site_coordinates": {
    "latitude": -89.78,
    "longitude": 125.0,
    "elevation_m": 1240.0
  },
  "start_date": "2026-12-01T00:00:00Z",
  "duration_days": 14.0,
  "step_hours": 2.0,
  "total_steps": 169,
  "data_source": "NASA JPL Horizons Web API / DE440 ephemeris",
  "time_series": [
    {
      "timestamp": "2026-12-01T00:00:00Z",
      "sun_azimuth_deg": 142.3,
      "sun_elevation_deg": 1.25,
      "sun_distance_km": 147500000.0,
      "earth_azimuth_deg": 310.4,
      "earth_elevation_deg": 4.82,
      "earth_distance_km": 384400.0,
      "sub_earth_longitude_deg": 4.12,
      "sub_earth_latitude_deg": 6.35
    }
  ]
}
```

---

## 3. Terrain Horizon Obstruction

### `POST /api/terrain/horizon`
Calculate the 360-degree local terrain horizon elevation profile from a given surface coordinate using the LOLA digital elevation model (DEM).

**Request Body**:
```json
{
  "latitude": -89.78,
  "longitude": 125.0,
  "elevation_m": 1240.0,
  "max_distance_km": 60.0,
  "azimuth_step_deg": 1.0,
  "observer_height_m": 2.0
}
```

**Response `200 OK`**:
```json
{
  "latitude": -89.78,
  "longitude": 125.0,
  "observer_height_m": 2.0,
  "elevation_datum": "Lunar Sphere R=1737.4 km",
  "horizon_points": [
    {
      "azimuth_deg": 0.0,
      "horizon_elevation_deg": 0.85,
      "obstruction_distance_km": 14.2,
      "blocking_feature": "Rim crest elevation"
    },
    {
      "azimuth_deg": 1.0,
      "horizon_elevation_deg": 0.88,
      "obstruction_distance_km": 14.1,
      "blocking_feature": "Rim crest elevation"
    }
  ],
  "max_horizon_elevation_deg": 3.42,
  "min_horizon_elevation_deg": -0.65
}
```

### `POST /api/terrain/sky-horizon`
Combined local sky-horizon simulation combining local 360° LOLA terrain relief with synchronized topocentric Sun and Earth JPL Horizons ephemerides over the mission timeline.

**Request Body**:
```json
{
  "latitude": -89.78,
  "longitude": 125.0,
  "elevation_m": 1240.0,
  "mast_height_m": 2.0,
  "azimuth_step_deg": 1.0,
  "min_comm_elevation_deg": 0.5,
  "start_date": "2026-12-01T00:00:00Z",
  "duration_days": 14.0,
  "step_hours": 2.0,
  "use_live_horizons": false
}
```

**Response `200 OK`**:
```json
{
  "latitude": -89.78,
  "longitude": 125.0,
  "elevation_m": 1240.0,
  "mast_height_m": 2.0,
  "start_date": "2026-12-01T00:00:00Z",
  "duration_days": 14.0,
  "step_hours": 2.0,
  "total_steps": 169,
  "max_horizon_elevation_deg": 3.42,
  "min_horizon_elevation_deg": -0.65,
  "average_horizon_elevation_deg": 1.15,
  "illumination_percentage": 82.5,
  "total_sunlight_hours": 277.2,
  "total_darkness_hours": 58.8,
  "longest_continuous_sunlight_hours": 144.0,
  "longest_continuous_darkness_hours": 24.0,
  "communication_percentage": 76.4,
  "total_comm_hours": 256.7,
  "total_comm_blackout_hours": 79.3,
  "longest_continuous_comm_window_hours": 110.0,
  "longest_continuous_blackout_hours": 32.0,
  "data_source": "ANALYTICAL FALLBACK DATA",
  "data_source_type": "ANALYTICAL_FALLBACK",
  "terrain_data_source": "NASA LOLA RASTER DEM (1200m/px)",
  "dem_resolution_m": 1200.0,
  "is_procedural_fallback": false,
  "horizon_profile": [
    {
      "azimuth_deg": 0.0,
      "horizon_elevation_deg": 0.85,
      "obstruction_distance_km": 14.2,
      "blocking_feature": "Rim crest elevation"
    }
  ],
  "time_series": [
    {
      "timestamp": "2026-12-01T00:00:00Z",
      "step_index": 0,
      "mission_elapsed_hours": 0.0,
      "sun_azimuth_deg": 142.3,
      "sun_elevation_deg": 1.25,
      "sun_terrain_horizon_elevation_deg": 0.90,
      "sun_elevation_clearance_deg": 0.35,
      "is_sun_visible": true,
      "is_sun_geometric": true,
      "sun_visibility_status": "DIRECT_SUNLIGHT",
      "solar_flux_w_m2": 29.68,
      "earth_azimuth_deg": 310.4,
      "earth_elevation_deg": 4.82,
      "earth_terrain_horizon_elevation_deg": 1.10,
      "earth_elevation_clearance_deg": 3.72,
      "is_earth_visible": true,
      "is_earth_geometric": true,
      "earth_visibility_status": "DIRECT_LINE_OF_SIGHT",
      "earth_apparent_diameter_deg": 1.88
    }
  ]
}
```

---

## 4. Solar Illumination Analysis

### `POST /api/illumination`
Calculate geometric and terrain-aware solar illumination status over time for a landing site.

**Request Body**:
```json
{
  "latitude": -89.78,
  "longitude": 125.0,
  "elevation_m": 1240.0,
  "start_date": "2026-12-01T00:00:00Z",
  "duration_days": 14.0,
  "step_hours": 1.0,
  "use_terrain_horizon": true
}
```

**Response `200 OK`**:
```json
{
  "latitude": -89.78,
  "longitude": 125.0,
  "start_date": "2026-12-01T00:00:00Z",
  "duration_days": 14.0,
  "step_hours": 1.0,
  "illumination_percentage": 82.5,
  "total_sunlit_hours": 277.2,
  "total_shadow_hours": 58.8,
  "longest_continuous_sunlight_hours": 142.0,
  "longest_continuous_shadow_hours": 24.0,
  "time_series": [
    {
      "timestamp": "2026-12-01T00:00:00Z",
      "sun_azimuth_deg": 142.3,
      "sun_elevation_deg": 1.25,
      "terrain_horizon_elevation_deg": 0.70,
      "is_sunlit_geometric": true,
      "is_sunlit_terrain": true,
      "solar_flux_w_m2": 1361.0,
      "effective_flux_horizontal_w_m2": 29.68
    }
  ]
}
```

---

## 5. Earth Communication & Visibility

### `POST /api/communication`
Calculate Direct-to-Earth (DTE) radio visibility, accounting for lunar libration, local terrain obstruction, antenna gimbal limits, and RF link budget feasibility.

**Request Body**:
```json
{
  "latitude": -89.78,
  "longitude": 125.0,
  "elevation_m": 1240.0,
  "start_date": "2026-12-01T00:00:00Z",
  "duration_days": 14.0,
  "step_hours": 1.0,
  "min_comm_elevation_deg": 1.0,
  "use_terrain_horizon": true,
  "antenna_height_m": 2.5,
  "antenna_min_elevation_deg": 0.5,
  "antenna_max_elevation_deg": 85.0,
  "enable_link_budget": true,
  "tx_power_w": 10.0,
  "tx_antenna_gain_dbi": 14.0,
  "carrier_frequency_ghz": 2.2,
  "rx_antenna_gain_dbi": 56.0,
  "system_losses_db": 3.0,
  "rx_sensitivity_dbm": -120.0,
  "required_margin_db": 3.0
}
```

**Response `200 OK`**:
```json
{
  "latitude": -89.78,
  "longitude": 125.0,
  "start_date": "2026-12-01T00:00:00Z",
  "duration_days": 14.0,
  "step_hours": 1.0,
  "communication_availability_percentage": 76.4,
  "total_visible_hours": 256.7,
  "total_blocked_hours": 79.3,
  "longest_continuous_comm_window_hours": 110.0,
  "longest_continuous_blackout_hours": 32.0,
  "num_communication_windows": 3,
  "next_window_start": "2026-12-01T00:00:00Z",
  "next_window_duration_hours": 110.0,
  "rf_link_feasible_percentage": 76.4,
  "link_budget_summary": {
    "carrier_frequency_ghz": 2.2,
    "tx_power_w": 10.0,
    "tx_power_dbm": 40.0,
    "earth_distance_km": 384400.0,
    "fspl_db": 211.0,
    "received_power_dbm": -104.0,
    "rx_sensitivity_dbm": -120.0,
    "nominal_link_margin_db": 16.0,
    "required_margin_db": 3.0
  },
  "blackout_warning": null,
  "communication_windows": [
    {
      "window_index": 1,
      "start_time": "2026-12-01T00:00:00Z",
      "end_time": "2026-12-05T14:00:00Z",
      "duration_hours": 110.0,
      "max_elevation_deg": 6.4,
      "avg_link_margin_db": 16.2
    }
  ],
  "time_series": [
    {
      "timestamp": "2026-12-01T00:00:00Z",
      "earth_azimuth_deg": 310.4,
      "earth_elevation_deg": 4.82,
      "terrain_horizon_elevation_deg": 1.10,
      "terrain_clearance_deg": 3.72,
      "is_earth_visible": true,
      "link_status": "DIRECT_LINE_OF_SIGHT",
      "earth_apparent_diameter_deg": 1.88,
      "earth_distance_km": 384400.0,
      "is_antenna_in_limits": true,
      "free_space_path_loss_db": 211.0,
      "received_power_dbm": -104.0,
      "link_margin_db": 16.0,
      "is_link_feasible": true
    }
  ]
}
```

---

## 6. Multi-Site Comparison

### `POST /api/compare`
Side-by-side comparison of multiple candidate landing sites across solar illumination, Earth communication, slope, and topographic metrics.

**Request Body**:
```json
{
  "site_ids": ["shackleton-rim", "connecting-ridge", "malapert-mountain"],
  "start_date": "2026-12-01T00:00:00Z",
  "duration_days": 14.0,
  "step_hours": 2.0
}
```

**Response `200 OK`**:
```json
{
  "start_date": "2026-12-01T00:00:00Z",
  "duration_days": 14.0,
  "sites_evaluated": [
    {
      "site_id": "shackleton-rim",
      "name": "Shackleton Crater Rim",
      "latitude": -89.78,
      "longitude": 125.0,
      "elevation_m": 1240.0,
      "slope_degrees": 8.5,
      "illumination_percentage": 82.5,
      "max_shadow_hours": 24.0,
      "communication_percentage": 76.4,
      "max_comm_blackout_hours": 32.0,
      "overall_suitability_score": 88.4
    }
  ]
}
```

### `POST /api/compare/scenarios`
Advanced multi-scenario comparison supporting independent landing sites, independent landing dates/times, and distinct solar array and battery configurations across 3 modes (Mode A: Different sites, same date; Mode B: Same site, different dates; Mode C: Custom heterogeneous scenarios).

Computes 12 empirical operational metrics with synchronized timeline points and leader rankings.

**Request Body**:
```json
{
  "mode": "SITES_SAME_DATE",
  "scenarios": [
    {
      "id": "scenario-1",
      "name": "Shackleton Baseline",
      "site_id": "shackleton-rim",
      "site_name": "Shackleton Crater Rim",
      "latitude": -89.78,
      "longitude": 125.0,
      "elevation_m": 1240.0,
      "mast_height_m": 2.0,
      "start_date": "2026-12-01T00:00:00Z",
      "duration_days": 14.0,
      "step_hours": 2.0,
      "solar_array_area_m2": 4.0,
      "solar_efficiency": 0.30,
      "solar_tracking_type": "VERTICAL_AZIMUTH_TRACKING",
      "battery_capacity_wh": 5000.0,
      "initial_battery_soc_percent": 100.0,
      "min_safe_soc_percent": 20.0,
      "base_hotel_load_w": 150.0,
      "payload_active_load_w": 100.0,
      "survival_heater_load_w": 80.0
    },
    {
      "id": "scenario-2",
      "name": "Malapert Heavy Array",
      "site_id": "malapert-mountain",
      "site_name": "Malapert Mountain",
      "latitude": -86.04,
      "longitude": 2.7,
      "elevation_m": 5020.0,
      "mast_height_m": 3.0,
      "start_date": "2026-12-01T00:00:00Z",
      "duration_days": 14.0,
      "step_hours": 2.0,
      "solar_array_area_m2": 6.0,
      "solar_efficiency": 0.32,
      "solar_tracking_type": "VERTICAL_AZIMUTH_TRACKING",
      "battery_capacity_wh": 8000.0,
      "initial_battery_soc_percent": 100.0,
      "min_safe_soc_percent": 20.0,
      "base_hotel_load_w": 160.0,
      "payload_active_load_w": 120.0,
      "survival_heater_load_w": 80.0
    }
  ]
}
```

**Response `200 OK`**:
```json
{
  "mode": "SITES_SAME_DATE",
  "comparison_timestamp": "2026-11-15T12:00:00Z",
  "total_scenarios": 2,
  "best_scenario_id": "scenario-2",
  "metric_leaders": {
    "illumination_percentage": "scenario-1",
    "min_battery_soc_percent": "scenario-2",
    "total_energy_generated_kwh": "scenario-2",
    "overall_suitability_score": "scenario-2"
  },
  "scenarios": [
    {
      "scenario_id": "scenario-2",
      "name": "Malapert Heavy Array",
      "site_name": "Malapert Mountain",
      "latitude": -86.04,
      "longitude": 2.7,
      "elevation_m": 5020.0,
      "slope_degrees": 5.4,
      "start_date": "2026-12-01T00:00:00Z",
      "duration_days": 14.0,
      "step_hours": 2.0,
      "max_solar_elevation_deg": 1.62,
      "min_solar_elevation_deg": -0.84,
      "total_sunlight_hours": 268.0,
      "total_darkness_hours": 68.0,
      "illumination_percentage": 79.8,
      "longest_continuous_sunlight_hours": 184.0,
      "longest_continuous_darkness_hours": 48.0,
      "earth_visibility_hours": 286.0,
      "communication_percentage": 85.1,
      "longest_comm_blackout_hours": 24.0,
      "num_comm_windows": 3,
      "min_battery_soc_percent": 54.2,
      "total_energy_generated_kwh": 312.4,
      "total_energy_consumed_kwh": 84.6,
      "net_energy_balance_kwh": 227.8,
      "battery_depleted": false,
      "power_survival_status": "SURVIVED",
      "eps_health_status": "NOMINAL",
      "overall_suitability_score": 89.2,
      "rank": 1,
      "timeline": [
        {
          "timestamp": "2026-12-01T00:00:00Z",
          "is_sunlit": true,
          "sun_elevation_deg": 1.45,
          "is_earth_visible": true,
          "earth_elevation_deg": 4.20,
          "battery_soc_percent": 100.0,
          "net_power_w": 450.0
        }
      ]
    }
  ]
}
```

---

## 7. Site Ranking & Recommendation

### `POST /api/recommend`
Rank candidate sites using user-defined Multi-Criteria Decision Analysis (MCDA) weightings across 6 operational criteria (solar, comm, slope, elevation, power survival, blackout risk) and hard operational constraints.

**Request Body**:
```json
{
  "start_date": "2026-12-01T00:00:00Z",
  "duration_days": 14.0,
  "weights": {
    "solar_illumination": 0.30,
    "earth_communication": 0.25,
    "slope_safety": 0.20,
    "elevation_advantage": 0.10,
    "power_survival": 0.10,
    "blackout_risk": 0.05
  },
  "constraints": {
    "min_illumination_percentage": 60.0,
    "min_communication_percentage": 50.0,
    "max_acceptable_slope_degrees": 12.0,
    "max_continuous_shadow_hours": 48.0,
    "max_comm_blackout_hours": 48.0,
    "min_battery_soc_percent": 20.0
  }
}
```

**Response `200 OK`**:
```json
{
  "ranking": [
    {
      "rank": 1,
      "site_id": "malapert-mountain",
      "name": "Malapert Mountain (Massif)",
      "total_score": 91.2,
      "is_compliant": true,
      "scores_breakdown": {
        "solar_illumination": 86.0,
        "earth_communication": 98.0,
        "slope_safety": 87.5,
        "elevation_advantage": 100.0,
        "power_survival": 92.0,
        "blackout_risk": 95.0
      },
      "explanation": "Ranked #1 primarily due to outstanding Direct-to-Earth communication coverage (98%) and elevated horizon profile above local obstructions."
    }
  ],
  "disqualified_sites": []
}
```

---

## 8. Mission Energy Simulation

### `POST /api/simulate`
Simulate lander/rover electrical power system (EPS), battery State of Charge (SoC), and thermal survival based on 3D panel incidence geometry, dust/thermal deratings, dual-path efficiencies, and C-rate limits.

**Request Body**:
```json
{
  "site_id": "shackleton-rim",
  "start_date": "2026-12-01T00:00:00Z",
  "duration_days": 14.0,
  "step_hours": 1.0,
  "solar_array_area_m2": 4.5,
  "solar_efficiency": 0.30,
  "solar_tracking_type": "VERTICAL_AZIMUTH_TRACKING",
  "panel_tilt_deg": 90.0,
  "panel_azimuth_deg": 0.0,
  "dust_degradation_factor": 0.95,
  "temperature_derate_factor": 0.90,
  "battery_capacity_wh": 5000.0,
  "initial_battery_soc_percent": 100.0,
  "min_safe_soc_percent": 20.0,
  "charging_efficiency": 0.92,
  "discharging_efficiency": 0.94,
  "max_charge_c_rate": 0.5,
  "max_discharge_c_rate": 1.0,
  "base_hotel_load_w": 180.0,
  "payload_active_load_w": 120.0,
  "survival_heater_load_w": 90.0
}
```

**Response `200 OK`**:
```json
{
  "site_id": "shackleton-rim",
  "mission_duration_hours": 336.0,
  "min_battery_soc_percent": 42.1,
  "current_battery_soc_percent": 88.5,
  "battery_depleted": false,
  "is_below_safe_soc": false,
  "max_continuous_darkness_hours": 12.0,
  "estimated_survival_duration_hours": null,
  "shortage_warning": null,
  "total_energy_generated_kwh": 78.4,
  "total_energy_consumed_kwh": 65.2,
  "net_energy_balance_kwh": 13.2,
  "model_assumptions": "Solar power computed using 3D cosine incidence angle...",
  "time_series": [
    {
      "timestamp": "2026-12-01T00:00:00Z",
      "solar_generation_w": 285.4,
      "total_load_w": 300.0,
      "net_power_w": -14.6,
      "battery_soc_percent": 99.7,
      "battery_stored_wh": 4985.4,
      "battery_charge_w": 0.0,
      "battery_discharge_w": 15.5,
      "is_deficit": true,
      "is_below_safe_soc": false,
      "sun_azimuth_deg": 142.3,
      "solar_incidence_angle_deg": 12.4,
      "cos_incidence": 0.976
    }
  ]
}
```

---

## 9. Common Error Formats

All API errors return a standard JSON schema:
```json
{
  "error": {
    "code": "INVALID_COORDINATES",
    "message": "Latitude must be between -90.0 and +90.0 degrees.",
    "field": "latitude"
  }
}
```
HTTP status codes used:
- `400 Bad Request`: Validation failure or parameter out of bounds
- `404 Not Found`: Site or resource does not exist
- `502 Bad Gateway`: External upstream API failure (e.g. JPL Horizons unreachable)
- `500 Internal Server Error`: Unhandled compute error
