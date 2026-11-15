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
Register a user-defined custom lunar landing site. Validates coordinate ranges (latitude between -90° and +90°, longitude between -180° and +360°). If `elevation_m` is omitted, the backend automatically queries the NASA LOLA Digital Elevation Model (DEM) polar stereographic grid at the target coordinates to retrieve surface elevation and local terrain slope gradient.

**Request Body (`CustomSiteRequest`)**:
```json
{
  "name": "Nobile Rim Ridge West",
  "latitude": -85.25,
  "longitude": 37.80,
  "elevation_m": -1250.0,
  "observer_height_m": 2.0,
  "notes": "Custom candidate site near Nobile Crater western ridge"
}
```

**Response `200 OK` (`SiteSchema`)**:
```json
{
  "id": "custom-nobile-rim-ridge-west",
  "name": "Nobile Rim Ridge West",
  "region": "Custom Site",
  "latitude": -85.25,
  "longitude": 37.80,
  "elevation_m": -1250.0,
  "slope_degrees": 5.4,
  "description": "User-defined custom lunar landing site at (-85.2500, 37.8000). Custom candidate site near Nobile Crater western ridge",
  "scientific_interest": "Custom mission profile target.",
  "primary_advantages": ["Custom candidate location"],
  "primary_challenges": ["User-defined site; requires localized safety validation"],
  "target_mission_class": ["Custom Mission"],
  "observer_height_m": 2.0,
  "is_custom": true
}
```

**Error Response `422 Unprocessable Entity`**:
Returned if latitude is outside `[-90, 90]` or longitude is outside `[-180, 360]`.
```json
{
  "detail": [
    {
      "loc": ["body", "latitude"],
      "msg": "Input should be greater than or equal to -90",
      "type": "greater_than_equal"
    }
  ]
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
Calculate Direct-to-Earth (DTE) radio visibility, accounting for lunar libration, local LOLA terrain obstruction, antenna gimbal boundaries, and physical RF link budget.

**Request Body**:
```json
{
  "latitude": -89.78,
  "longitude": 125.0,
  "elevation_m": 1240.0,
  "start_date": "2026-12-01T00:00:00Z",
  "duration_days": 14.0,
  "step_hours": 1.0,
  "min_comm_elevation_deg": 0.5,
  "max_comm_elevation_deg": 85.0,
  "antenna_azimuth_min_deg": 0.0,
  "antenna_azimuth_max_deg": 360.0,
  "use_terrain_horizon": true,
  "enable_link_budget": true,
  "tx_power_w": 15.0,
  "tx_antenna_gain_dbi": 28.0,
  "rx_antenna_gain_dbi": 68.0,
  "carrier_frequency_ghz": 8.45,
  "data_rate_kbps": 1000.0,
  "system_losses_db": 3.5,
  "required_eb_n0_db": 4.5,
  "min_link_margin_db": 3.0
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
  "num_comm_windows": 3,
  "next_comm_window_start": "2026-12-01T00:00:00Z",
  "next_comm_window_hours_from_start": 0.0,
  "comm_windows": [
    {
      "window_id": 1,
      "start_time": "2026-12-01T00:00:00Z",
      "end_time": "2026-12-05T14:00:00Z",
      "duration_hours": 110.0,
      "mean_earth_elevation_deg": 4.82,
      "mean_link_margin_db": 6.45,
      "is_link_feasible": true
    }
  ],
  "link_budget_summary": {
    "is_link_feasible": true,
    "min_link_margin_db": 6.45,
    "free_space_path_loss_db": 222.7,
    "received_eb_n0_db": 10.95,
    "required_eb_n0_db": 4.5,
    "carrier_frequency_ghz": 8.45,
    "tx_power_w": 15.0,
    "tx_antenna_gain_dbi": 28.0,
    "rx_antenna_gain_dbi": 68.0
  },
  "time_series": [
    {
      "timestamp": "2026-12-01T00:00:00Z",
      "earth_azimuth_deg": 310.4,
      "earth_elevation_deg": 4.82,
      "terrain_horizon_elevation_deg": 1.10,
      "is_earth_visible": true,
      "is_geometrically_visible": true,
      "is_link_feasible": true,
      "link_status": "DIRECT_LINE_OF_SIGHT",
      "link_margin_db": 6.85,
      "earth_apparent_diameter_deg": 1.88
    }
  ]
}
```

---

## 6. Multi-Site & Multi-Scenario Comparison

### `POST /api/compare`
Legacy side-by-side comparison of candidate landing sites across baseline solar illumination, Earth communication, slope, and topographic metrics.

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
Advanced multi-scenario comparison system allowing mission planners to simultaneously evaluate 2 to 8 independent scenarios across three operational modes:
- **Mode A (DIFFERENT_SITES_SAME_DATE)**: Evaluates distinct landing zones under an identical mission launch window.
- **Mode B (SAME_SITE_DIFFERENT_DATES)**: Evaluates a single landing zone across seasonal illumination windows or alternate Artemis launch opportunities.
- **Mode C (DIFFERENT_SITES_AND_DATES)**: Matrix evaluation across different geographic coordinates, dates, and hardware configurations.

Each scenario maintains completely independent parameters:
- Landing Site ID or custom coordinates (`latitude`, `longitude`, `elevation_m`, `observer_height_m`)
- Landing date and time (`start_date`)
- Mission duration (`duration_days`) and calculation time step (`step_hours`)
- Solar power configuration (`solar_array_area_m2`, `solar_efficiency`, `solar_tracking_type`)
- Battery configuration (`battery_capacity_wh`, `initial_battery_soc_percent`, `min_safe_soc_percent`)
- Surface power loads (`base_hotel_load_w`, `payload_active_load_w`, `survival_heater_load_w`)

All metrics are calculated using actual ephemeris, LOLA DEM ray-tracing, and EPS simulation engines.

**Request Body (`MultiScenarioCompareRequest`)**:
```json
{
  "mode": "DIFFERENT_SITES_SAME_DATE",
  "scenarios": [
    {
      "id": "scenario-1",
      "name": "Shackleton Peak (Winter)",
      "site_id": "shackleton-rim",
      "start_date": "2026-12-01T00:00:00Z",
      "duration_days": 14.0,
      "step_hours": 2.0,
      "solar_array_area_m2": 3.0,
      "solar_efficiency": 0.30,
      "solar_tracking_type": "VERTICAL_AZIMUTH_TRACKING",
      "battery_capacity_wh": 5000.0,
      "initial_battery_soc_percent": 100.0,
      "min_safe_soc_percent": 20.0,
      "base_hotel_load_w": 120.0,
      "payload_active_load_w": 80.0,
      "survival_heater_load_w": 60.0
    },
    {
      "id": "scenario-2",
      "name": "Malapert Ridge (Winter)",
      "site_id": "malapert-mountain",
      "start_date": "2026-12-01T00:00:00Z",
      "duration_days": 14.0,
      "step_hours": 2.0,
      "solar_array_area_m2": 3.0,
      "solar_efficiency": 0.30,
      "solar_tracking_type": "VERTICAL_AZIMUTH_TRACKING",
      "battery_capacity_wh": 5000.0,
      "initial_battery_soc_percent": 100.0,
      "min_safe_soc_percent": 20.0,
      "base_hotel_load_w": 120.0,
      "payload_active_load_w": 80.0,
      "survival_heater_load_w": 60.0
    },
    {
      "id": "scenario-3",
      "name": "Custom Nobile Ridge",
      "latitude": -85.25,
      "longitude": 37.8,
      "elevation_m": -1250.0,
      "observer_height_m": 2.0,
      "start_date": "2026-12-01T00:00:00Z",
      "duration_days": 14.0,
      "step_hours": 2.0,
      "solar_array_area_m2": 3.0,
      "solar_efficiency": 0.30,
      "solar_tracking_type": "VERTICAL_AZIMUTH_TRACKING",
      "battery_capacity_wh": 5000.0,
      "initial_battery_soc_percent": 100.0,
      "min_safe_soc_percent": 20.0,
      "base_hotel_load_w": 120.0,
      "payload_active_load_w": 80.0,
      "survival_heater_load_w": 60.0
    }
  ]
}
```

**Response `200 OK` (`MultiScenarioCompareResponse`)**:
```json
{
  "mode": "DIFFERENT_SITES_SAME_DATE",
  "generated_at": "2026-11-15T13:45:00Z",
  "total_scenarios": 3,
  "scenarios": [
    {
      "scenario_id": "scenario-1",
      "scenario_name": "Shackleton Peak (Winter)",
      "site_id": "shackleton-rim",
      "site_name": "Shackleton Crater Rim",
      "latitude": -89.78,
      "longitude": 125.0,
      "elevation_m": 1240.0,
      "slope_degrees": 8.5,
      "start_date": "2026-12-01T00:00:00Z",
      "duration_days": 14.0,
      "step_hours": 2.0,
      "solar_elevation_deg_mean": 1.42,
      "solar_elevation_deg_max": 1.88,
      "total_sunlight_hours": 336.0,
      "sunlight_percentage": 100.0,
      "total_darkness_hours": 0.0,
      "darkness_percentage": 0.0,
      "longest_continuous_sunlight_hours": 336.0,
      "longest_continuous_darkness_hours": 0.0,
      "earth_visibility_hours": 284.0,
      "earth_visibility_percentage": 84.52,
      "longest_comm_blackout_hours": 18.0,
      "num_comm_windows": 1,
      "min_battery_soc_percent": 84.2,
      "max_battery_soc_percent": 100.0,
      "battery_depleted": false,
      "power_survival_status": "NOMINAL",
      "total_generated_solar_energy_kwh": 65.4,
      "total_consumed_energy_kwh": 48.2,
      "net_energy_balance_kwh": 17.2,
      "overall_suitability_score": 93.4,
      "rank": 1,
      "timeline": [
        {
          "timestamp": "2026-12-01T00:00:00Z",
          "elapsed_hours": 0.0,
          "is_sun_visible": true,
          "is_earth_visible": true,
          "solar_elevation_deg": 1.25,
          "earth_elevation_deg": 4.82,
          "battery_soc_percent": 100.0,
          "solar_generation_w": 285.4,
          "net_power_w": 85.4
        }
      ]
    }
  ],
  "rankings": [
    {
      "rank": 1,
      "scenario_id": "scenario-1",
      "scenario_name": "Shackleton Peak (Winter)",
      "site_name": "Shackleton Crater Rim",
      "suitability_score": 93.4,
      "power_survival_status": "NOMINAL",
      "key_strengths": ["100.0% solar illumination", "Nominal battery state (min 84.2%)"],
      "key_hazards": []
    }
  ],
  "summary": {
    "best_overall_scenario_id": "scenario-1",
    "best_sunlight_scenario_id": "scenario-1",
    "best_comm_scenario_id": "scenario-2",
    "best_battery_scenario_id": "scenario-1"
  }
}
```

---

## 7. Site Ranking & Recommendation

### `POST /api/recommend`
Rank candidate sites using user-defined Multi-Criteria Decision Analysis (MCDA) weightings across 6 operational criteria and hard operational constraints.

**Request Body**:
```json
{
  "start_date": "2026-12-01T00:00:00Z",
  "duration_days": 14.0,
  "weights": {
    "solar_illumination": 0.25,
    "earth_communication": 0.20,
    "slope_safety": 0.15,
    "elevation_advantage": 0.10,
    "power_survival": 0.20,
    "blackout_risk": 0.10
  },
  "constraints": {
    "min_illumination_percentage": 60.0,
    "min_communication_percentage": 50.0,
    "max_acceptable_slope_degrees": 12.0,
    "max_continuous_shadow_hours": 48.0,
    "min_battery_soc_percent": 20.0,
    "max_comm_blackout_hours": 48.0
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
        "power_survival": 92.4,
        "blackout_risk": 88.0
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
Simulate lander/rover electrical power system (EPS), battery State of Charge (SoC), thermal survival, and 3D vector solar incidence angle.

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
  "dust_degradation_factor": 0.98,
  "wiring_loss_factor": 0.97,
  "battery_capacity_wh": 5000.0,
  "initial_battery_soc_percent": 100.0,
  "min_safe_soc_percent": 20.0,
  "charging_efficiency": 0.94,
  "discharging_efficiency": 0.95,
  "max_charge_power_w": 1000.0,
  "max_discharge_power_w": 1500.0,
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
  "battery_depleted": false,
  "estimated_survival_duration_hours": null,
  "max_continuous_darkness_hours": 18.0,
  "hours_below_safe_soc": 0.0,
  "total_energy_generated_kwh": 78.4,
  "total_energy_consumed_kwh": 65.2,
  "net_energy_balance_kwh": 13.2,
  "power_shortage_warnings": [],
  "battery_temperature_limitation": "Battery cells are assumed thermally managed at nominal 0°C to 20°C via electric survival heaters. Cryogenic electrochemical derating below 0°C is not modeled.",
  "time_series": [
    {
      "timestamp": "2026-12-01T00:00:00Z",
      "solar_generation_w": 285.4,
      "curtailed_power_w": 0.0,
      "total_load_w": 300.0,
      "net_power_w": -14.6,
      "battery_soc_percent": 99.7,
      "battery_stored_wh": 4985.4,
      "solar_incidence_angle_deg": 88.6,
      "is_deficit": true
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
