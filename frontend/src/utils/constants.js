/**
 * LUNA NAVIGATOR — Frontend Application Constants & Scientific Defaults
 */

export const DEFAULT_MISSION_CONFIG = {
  startDate: '2026-12-01T00:00',
  durationDays: 14,
  stepHours: 3,
  useTerrainHorizon: true,
  mastHeightM: 2.0,
  minCommElevationDeg: 0.5,
  antennaHeightM: 2.5,
};

export const DEFAULT_MCDA_WEIGHTS = {
  solar_illumination: 0.35,
  earth_communication: 0.30,
  slope_safety: 0.20,
  elevation_advantage: 0.15,
  power_survival: 0.0,
  blackout_risk: 0.0,
};

export const DEFAULT_CONSTRAINTS = {
  min_illumination_percentage: 40.0,
  min_communication_percentage: 30.0,
  max_acceptable_slope_degrees: 12.0,
  max_continuous_shadow_hours: 80.0,
  max_comm_blackout_hours: 48.0,
  min_battery_soc_percent: 20.0,
};

export const DEFAULT_SIMULATION_CONFIG = {
  solar_array_area_m2: 4.5,
  solar_efficiency: 0.30,
  solar_tracking_type: 'VERTICAL_AZIMUTH_TRACKING',
  panel_tilt_deg: 90.0,
  panel_azimuth_deg: 0.0,
  dust_degradation_factor: 0.95,
  temperature_derate_factor: 0.90,
  battery_capacity_wh: 5000.0,
  initial_battery_soc_percent: 100.0,
  min_safe_soc_percent: 20.0,
  charging_efficiency: 0.92,
  discharging_efficiency: 0.94,
  max_charge_c_rate: 0.5,
  max_discharge_c_rate: 1.0,
  base_hotel_load_w: 150.0,
  payload_active_load_w: 100.0,
  survival_heater_load_w: 80.0,
};

// Solar Tracking Options
export const SOLAR_TRACKING_MODES = {
  VERTICAL_AZIMUTH_TRACKING: {
    id: 'VERTICAL_AZIMUTH_TRACKING',
    label: 'Vertical Azimuth Tracking',
    description: 'Rotates azimuthally to track low-elevation polar sun along the lunar horizon.',
  },
  FIXED_VERTICAL: {
    id: 'FIXED_VERTICAL',
    label: 'Fixed Vertical Panel',
    description: 'Fixed vertical orientation, cosine losses for changing azimuth.',
  },
  HORIZONTAL_FLAT: {
    id: 'HORIZONTAL_FLAT',
    label: 'Horizontal Flat Panel',
    description: 'Mounted flat facing lunar zenith, captures sine of grazing elevation.',
  },
};

// Simulation presets for realistic mission architectures
export const SIMULATION_PRESETS = {
  artemis_crewed: {
    name: 'Artemis Human Landing System (HLS)',
    solar_array_area_m2: 12.0,
    solar_efficiency: 0.32,
    solar_tracking_type: 'VERTICAL_AZIMUTH_TRACKING',
    panel_tilt_deg: 90.0,
    panel_azimuth_deg: 0.0,
    dust_degradation_factor: 0.95,
    temperature_derate_factor: 0.90,
    battery_capacity_wh: 25000.0,
    initial_battery_soc_percent: 100.0,
    min_safe_soc_percent: 25.0,
    charging_efficiency: 0.92,
    discharging_efficiency: 0.95,
    max_charge_c_rate: 0.5,
    max_discharge_c_rate: 1.0,
    base_hotel_load_w: 450.0,
    payload_active_load_w: 300.0,
    survival_heater_load_w: 220.0,
  },
  polar_rover: {
    name: 'VIPER-Class Volatiles Rover',
    solar_array_area_m2: 3.2,
    solar_efficiency: 0.30,
    solar_tracking_type: 'VERTICAL_AZIMUTH_TRACKING',
    panel_tilt_deg: 85.0,
    panel_azimuth_deg: 0.0,
    dust_degradation_factor: 0.90,
    temperature_derate_factor: 0.88,
    battery_capacity_wh: 4500.0,
    initial_battery_soc_percent: 100.0,
    min_safe_soc_percent: 20.0,
    charging_efficiency: 0.90,
    discharging_efficiency: 0.92,
    max_charge_c_rate: 0.5,
    max_discharge_c_rate: 0.8,
    base_hotel_load_w: 110.0,
    payload_active_load_w: 80.0,
    survival_heater_load_w: 65.0,
  },
  clps_microlander: {
    name: 'CLPS Commercial Micro-Lander',
    solar_array_area_m2: 2.0,
    solar_efficiency: 0.28,
    solar_tracking_type: 'FIXED_VERTICAL',
    panel_tilt_deg: 90.0,
    panel_azimuth_deg: 180.0,
    dust_degradation_factor: 0.92,
    temperature_derate_factor: 0.90,
    battery_capacity_wh: 2800.0,
    initial_battery_soc_percent: 100.0,
    min_safe_soc_percent: 20.0,
    charging_efficiency: 0.90,
    discharging_efficiency: 0.92,
    max_charge_c_rate: 0.4,
    max_discharge_c_rate: 0.7,
    base_hotel_load_w: 80.0,
    payload_active_load_w: 50.0,
    survival_heater_load_w: 45.0,
  },
};

// MCDA Weighting Presets
export const MCDA_WEIGHT_PRESETS = {
  balanced: {
    name: 'Balanced Exploration',
    weights: { solar_illumination: 0.30, earth_communication: 0.25, slope_safety: 0.20, elevation_advantage: 0.10, power_survival: 0.10, blackout_risk: 0.05 },
  },
  power_priority: {
    name: 'Power & Cryo-Night Survival',
    weights: { solar_illumination: 0.30, earth_communication: 0.10, slope_safety: 0.15, elevation_advantage: 0.05, power_survival: 0.35, blackout_risk: 0.05 },
  },
  comm_priority: {
    name: 'Continuous Telecom Relay',
    weights: { solar_illumination: 0.15, earth_communication: 0.40, slope_safety: 0.15, elevation_advantage: 0.10, power_survival: 0.05, blackout_risk: 0.15 },
  },
  safety_first: {
    name: 'Lander Touchdown Safety',
    weights: { solar_illumination: 0.20, earth_communication: 0.15, slope_safety: 0.40, elevation_advantage: 0.10, power_survival: 0.10, blackout_risk: 0.05 },
  },
};

// Lunar South Pole Named Craters & Geomorphic Landmarks for 2D map overlay
export const LUNAR_SOUTH_POLE_FEATURES = [
  { id: 'shackleton', name: 'Shackleton', lat: -89.78, lon: 125.0, radiusKm: 10.5, type: 'crater' },
  { id: 'de-gerlache', name: 'de Gerlache', lat: -88.5, lon: 271.4, radiusKm: 16.2, type: 'crater' },
  { id: 'faustini', name: 'Faustini', lat: -87.3, lon: 77.0, radiusKm: 19.5, type: 'crater' },
  { id: 'shoemaker', name: 'Shoemaker', lat: -88.1, lon: 45.0, radiusKm: 25.4, type: 'crater' },
  { id: 'haworth', name: 'Haworth', lat: -87.4, lon: 355.0, radiusKm: 17.5, type: 'crater' },
  { id: 'nobile', name: 'Nobile', lat: -85.2, lon: 53.5, radiusKm: 39.8, type: 'crater' },
  { id: 'malapert', name: 'Malapert', lat: -84.9, lon: 12.9, radiusKm: 34.6, type: 'crater' },
  { id: 'amundsen', name: 'Amundsen', lat: -84.5, lon: 82.8, radiusKm: 51.5, type: 'crater' },
  { id: 'slater', name: 'Slater', lat: -88.0, lon: 111.0, radiusKm: 12.5, type: 'crater' },
  { id: 'connecting-ridge', name: 'Connecting Ridge', lat: -89.44, lon: 222.5, radiusKm: 6.0, type: 'ridge' },
  { id: 'malapert-massif', name: 'Malapert Massif', lat: -85.99, lon: 2.91, radiusKm: 15.0, type: 'massif' },
];
