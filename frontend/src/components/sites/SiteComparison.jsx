import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Scale,
  Sun,
  Radio,
  Mountain,
  Award,
  Check,
  RefreshCw,
  AlertCircle,
  Plus,
  RotateCcw,
  Download,
  Calendar,
  Layers,
  FileSpreadsheet,
  FileCode,
  Zap,
  Battery,
  ShieldCheck,
  AlertTriangle,
  TrendingUp,
  MapPin,
  Clock,
  Sparkles,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import { compareScenarios } from '../../services/api';
import { formatLatitude, formatLongitude } from '../../utils/coordinates';
import LoadingState from '../common/LoadingState';
import ErrorState from '../common/ErrorState';
import ScenarioCard from '../comparison/ScenarioCard';
import ScenarioEditorModal from '../comparison/ScenarioEditorModal';
import CustomSiteModal from './CustomSiteModal';

// Comparison Modes as specified in Task 3
export const COMPARISON_MODES = [
  {
    id: 'SITES_SAME_DATE',
    title: 'Mode A: Different Sites, Same Date',
    subtitle: 'Evaluate 3+ candidate landing zones under identical lunar seasonal illumination and subsolar latitude.',
    icon: Mountain,
  },
  {
    id: 'SAME_SITE_DATES',
    title: 'Mode B: Same Site, Different Dates',
    subtitle: 'Assess launch and touchdown seasonal windows at a single site across solstices and equinoxes.',
    icon: Calendar,
  },
  {
    id: 'CUSTOM',
    title: 'Mode C: Custom Scenarios',
    subtitle: 'Compare heterogeneous scenarios with independent landing sites, dates, solar arrays, and batteries.',
    icon: Layers,
  },
];

// Palette for scenario charts and timeline bands
const SCENARIO_COLORS = [
  '#06B6D4', // Cyan
  '#F59E0B', // Amber
  '#10B981', // Emerald
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#3B82F6', // Blue
];

export default function SiteComparison({
  sites = [],
  missionConfig,
  onSelectSite,
  onAddCustomSite,
}) {
  const [activeMode, setActiveMode] = useState('SITES_SAME_DATE');
  const [scenarios, setScenarios] = useState([]);
  const [comparisonData, setComparisonData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeScenarioId, setActiveScenarioId] = useState(null);

  // Modals state
  const [editingScenario, setEditingScenario] = useState(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isCustomSiteOpen, setIsCustomSiteOpen] = useState(false);

  // Helper to generate Mode Presets
  const generatePresetsForMode = useCallback(
    (mode) => {
      const baseDate = missionConfig?.startDate
        ? new Date(missionConfig.startDate).toISOString()
        : '2026-12-01T00:00:00Z';
      const duration = Number(missionConfig?.durationDays) || 14.0;
      const step = Math.max(1.0, Number(missionConfig?.stepHours) || 2.0);

      if (mode === 'SITES_SAME_DATE') {
        const defaultSites = sites.slice(0, 3);
        if (defaultSites.length === 0) {
          return [
            {
              id: 'scen-shackleton',
              name: 'Shackleton Peak Array',
              site_id: 'shackleton-rim',
              site_name: 'Shackleton Crater Rim',
              latitude: -89.78,
              longitude: 125.0,
              elevation_m: 1240.0,
              mast_height_m: 2.0,
              start_date: baseDate,
              duration_days: duration,
              step_hours: step,
              solar_array_area_m2: 4.0,
              solar_efficiency: 0.30,
              solar_tracking_type: 'VERTICAL_AZIMUTH_TRACKING',
              battery_capacity_wh: 5000.0,
              initial_battery_soc_percent: 100.0,
              min_safe_soc_percent: 20.0,
              base_hotel_load_w: 150.0,
              payload_active_load_w: 100.0,
              survival_heater_load_w: 80.0,
            },
            {
              id: 'scen-malapert',
              name: 'Malapert High Ridge',
              site_id: 'malapert-mountain',
              site_name: 'Malapert Mountain',
              latitude: -86.04,
              longitude: 2.7,
              elevation_m: 5020.0,
              mast_height_m: 2.0,
              start_date: baseDate,
              duration_days: duration,
              step_hours: step,
              solar_array_area_m2: 4.0,
              solar_efficiency: 0.30,
              solar_tracking_type: 'VERTICAL_AZIMUTH_TRACKING',
              battery_capacity_wh: 5000.0,
              initial_battery_soc_percent: 100.0,
              min_safe_soc_percent: 20.0,
              base_hotel_load_w: 150.0,
              payload_active_load_w: 100.0,
              survival_heater_load_w: 80.0,
            },
            {
              id: 'scen-degerlache',
              name: 'de Gerlache Plateau',
              site_id: 'de-gerlache-ridge',
              site_name: 'de Gerlache Connecting Ridge',
              latitude: -88.71,
              longitude: 291.0,
              elevation_m: 2150.0,
              mast_height_m: 2.0,
              start_date: baseDate,
              duration_days: duration,
              step_hours: step,
              solar_array_area_m2: 4.0,
              solar_efficiency: 0.30,
              solar_tracking_type: 'VERTICAL_AZIMUTH_TRACKING',
              battery_capacity_wh: 5000.0,
              initial_battery_soc_percent: 100.0,
              min_safe_soc_percent: 20.0,
              base_hotel_load_w: 150.0,
              payload_active_load_w: 100.0,
              survival_heater_load_w: 80.0,
            },
          ];
        }
        return defaultSites.map((s, idx) => ({
          id: `scen-${s.id}-${idx + 1}`,
          name: `${s.name.split(' ')[0]} Exploration`,
          site_id: s.id,
          site_name: s.name,
          latitude: s.latitude,
          longitude: s.longitude,
          elevation_m: s.elevation_m,
          mast_height_m: 2.0,
          start_date: baseDate,
          duration_days: duration,
          step_hours: step,
          solar_array_area_m2: 4.0,
          solar_efficiency: 0.30,
          solar_tracking_type: 'VERTICAL_AZIMUTH_TRACKING',
          battery_capacity_wh: 5000.0,
          initial_battery_soc_percent: 100.0,
          min_safe_soc_percent: 20.0,
          base_hotel_load_w: 150.0,
          payload_active_load_w: 100.0,
          survival_heater_load_w: 80.0,
        }));
      }

      if (mode === 'SAME_SITE_DATES') {
        const targetSite = sites[0] || {
          id: 'shackleton-rim',
          name: 'Shackleton Crater Rim',
          latitude: -89.78,
          longitude: 125.0,
          elevation_m: 1240.0,
        };
        return [
          {
            id: 'scen-dec-2026',
            name: `${targetSite.name.split(' ')[0]} (Dec 2026 Solstice)`,
            site_id: targetSite.id,
            site_name: targetSite.name,
            latitude: targetSite.latitude,
            longitude: targetSite.longitude,
            elevation_m: targetSite.elevation_m,
            mast_height_m: 2.0,
            start_date: '2026-12-01T00:00:00Z',
            duration_days: duration,
            step_hours: step,
            solar_array_area_m2: 4.0,
            solar_efficiency: 0.30,
            solar_tracking_type: 'VERTICAL_AZIMUTH_TRACKING',
            battery_capacity_wh: 5000.0,
            initial_battery_soc_percent: 100.0,
            min_safe_soc_percent: 20.0,
            base_hotel_load_w: 150.0,
            payload_active_load_w: 100.0,
            survival_heater_load_w: 80.0,
          },
          {
            id: 'scen-jan-2027',
            name: `${targetSite.name.split(' ')[0]} (Jan 2027 Mid-Summer)`,
            site_id: targetSite.id,
            site_name: targetSite.name,
            latitude: targetSite.latitude,
            longitude: targetSite.longitude,
            elevation_m: targetSite.elevation_m,
            mast_height_m: 2.0,
            start_date: '2027-01-15T00:00:00Z',
            duration_days: duration,
            step_hours: step,
            solar_array_area_m2: 4.0,
            solar_efficiency: 0.30,
            solar_tracking_type: 'VERTICAL_AZIMUTH_TRACKING',
            battery_capacity_wh: 5000.0,
            initial_battery_soc_percent: 100.0,
            min_safe_soc_percent: 20.0,
            base_hotel_load_w: 150.0,
            payload_active_load_w: 100.0,
            survival_heater_load_w: 80.0,
          },
          {
            id: 'scen-mar-2027',
            name: `${targetSite.name.split(' ')[0]} (Mar 2027 Equinox)`,
            site_id: targetSite.id,
            site_name: targetSite.name,
            latitude: targetSite.latitude,
            longitude: targetSite.longitude,
            elevation_m: targetSite.elevation_m,
            mast_height_m: 2.0,
            start_date: '2027-03-20T00:00:00Z',
            duration_days: duration,
            step_hours: step,
            solar_array_area_m2: 4.0,
            solar_efficiency: 0.30,
            solar_tracking_type: 'VERTICAL_AZIMUTH_TRACKING',
            battery_capacity_wh: 5000.0,
            initial_battery_soc_percent: 100.0,
            min_safe_soc_percent: 20.0,
            base_hotel_load_w: 150.0,
            payload_active_load_w: 100.0,
            survival_heater_load_w: 80.0,
          },
        ];
      }

      // Mode C: Heterogeneous Custom Architectures
      return [
        {
          id: 'scen-custom-standard',
          name: 'Shackleton 5kWh Baseline',
          site_id: 'shackleton-rim',
          site_name: 'Shackleton Crater Rim',
          latitude: -89.78,
          longitude: 125.0,
          elevation_m: 1240.0,
          mast_height_m: 2.0,
          start_date: '2026-12-01T00:00:00Z',
          duration_days: 14.0,
          step_hours: step,
          solar_array_area_m2: 4.0,
          solar_efficiency: 0.30,
          solar_tracking_type: 'VERTICAL_AZIMUTH_TRACKING',
          battery_capacity_wh: 5000.0,
          initial_battery_soc_percent: 100.0,
          min_safe_soc_percent: 20.0,
          base_hotel_load_w: 150.0,
          payload_active_load_w: 100.0,
          survival_heater_load_w: 80.0,
        },
        {
          id: 'scen-custom-heavy-battery',
          name: 'Malapert Extended 8kWh',
          site_id: 'malapert-mountain',
          site_name: 'Malapert Mountain',
          latitude: -86.04,
          longitude: 2.7,
          elevation_m: 5020.0,
          mast_height_m: 3.5,
          start_date: '2027-01-10T12:00:00Z',
          duration_days: 21.0,
          step_hours: step,
          solar_array_area_m2: 6.0,
          solar_efficiency: 0.32,
          solar_tracking_type: 'VERTICAL_AZIMUTH_TRACKING',
          battery_capacity_wh: 8000.0,
          initial_battery_soc_percent: 100.0,
          min_safe_soc_percent: 20.0,
          base_hotel_load_w: 160.0,
          payload_active_load_w: 120.0,
          survival_heater_load_w: 80.0,
        },
        {
          id: 'scen-custom-polar-deep',
          name: 'Faustini Cold Trap Rover',
          site_id: null,
          site_name: 'Faustini Rim Peak',
          latitude: -87.18,
          longitude: 77.0,
          elevation_m: 1800.0,
          mast_height_m: 2.5,
          start_date: '2027-02-01T00:00:00Z',
          duration_days: 14.0,
          step_hours: step,
          solar_array_area_m2: 5.0,
          solar_efficiency: 0.30,
          solar_tracking_type: 'VERTICAL_AZIMUTH_TRACKING',
          battery_capacity_wh: 6500.0,
          initial_battery_soc_percent: 100.0,
          min_safe_soc_percent: 20.0,
          base_hotel_load_w: 140.0,
          payload_active_load_w: 90.0,
          survival_heater_load_w: 90.0,
        },
      ];
    },
    [sites, missionConfig]
  );

  // Initialize or reset scenarios when mode changes
  useEffect(() => {
    const initialScenarios = generatePresetsForMode(activeMode);
    setScenarios(initialScenarios);
    setComparisonData(null);
  }, [activeMode, generatePresetsForMode]);

  // Execute multi-scenario comparison calculation
  const handleRunComparison = async () => {
    if (scenarios.length < 2) return;
    setLoading(true);
    setError(null);

    try {
      // Format start dates to standard ISO strings
      const payloadScenarios = scenarios.map((scen) => ({
        ...scen,
        start_date: new Date(scen.start_date).toISOString(),
        elevation_m: scen.elevation_m !== '' && scen.elevation_m !== null ? Number(scen.elevation_m) : null,
      }));

      const res = await compareScenarios({
        mode: activeMode,
        scenarios: payloadScenarios,
      });

      setComparisonData(res);
      if (res.scenarios?.length > 0) {
        setActiveScenarioId(res.best_scenario_id || res.scenarios[0].scenario_id);
      }
    } catch (err) {
      console.error('Multi-scenario comparison failed:', err);
      setError(
        err.response?.data?.error?.message ||
          err.response?.data?.detail ||
          err.message ||
          'Failed to calculate multi-scenario comparison.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Auto-run once when scenarios are ready
  useEffect(() => {
    if (scenarios.length >= 2 && !comparisonData && !loading) {
      handleRunComparison();
    }
  }, [scenarios.length]);

  // Scenario Management handlers (Task 6)
  const handleAddScenario = () => {
    const count = scenarios.length + 1;
    const baseSite = sites[0] || {
      id: 'shackleton-rim',
      name: 'Shackleton Crater Rim',
      latitude: -89.78,
      longitude: 125.0,
      elevation_m: 1240.0,
    };
    const newScenario = {
      id: `scen-custom-${Date.now()}`,
      name: `Scenario ${count}`,
      site_id: baseSite.id,
      site_name: baseSite.name,
      latitude: baseSite.latitude,
      longitude: baseSite.longitude,
      elevation_m: baseSite.elevation_m,
      mast_height_m: 2.0,
      start_date: missionConfig?.startDate ? new Date(missionConfig.startDate).toISOString() : '2026-12-01T00:00:00Z',
      duration_days: Number(missionConfig?.durationDays) || 14.0,
      step_hours: Math.max(1.0, Number(missionConfig?.stepHours) || 2.0),
      solar_array_area_m2: 4.0,
      solar_efficiency: 0.30,
      solar_tracking_type: 'VERTICAL_AZIMUTH_TRACKING',
      battery_capacity_wh: 5000.0,
      initial_battery_soc_percent: 100.0,
      min_safe_soc_percent: 20.0,
      base_hotel_load_w: 150.0,
      payload_active_load_w: 100.0,
      survival_heater_load_w: 80.0,
    };
    setScenarios([...scenarios, newScenario]);
    setEditingScenario(newScenario);
    setIsEditorOpen(true);
  };

  const handleDuplicateScenario = (scen) => {
    const copy = {
      ...scen,
      id: `scen-copy-${Date.now()}`,
      name: `${scen.name} (Copy)`,
    };
    setScenarios([...scenarios, copy]);
  };

  const handleRemoveScenario = (id) => {
    if (scenarios.length <= 2) return;
    setScenarios(scenarios.filter((s) => s.id !== id));
    if (activeScenarioId === id) {
      setActiveScenarioId(null);
    }
  };

  const handleOpenEditor = (scen) => {
    setEditingScenario(scen);
    setIsEditorOpen(true);
  };

  const handleSaveScenario = (updated) => {
    setScenarios(scenarios.map((s) => (s.id === updated.id ? updated : s)));
    setIsEditorOpen(false);
    setEditingScenario(null);
  };

  const handleResetPresets = () => {
    const presets = generatePresetsForMode(activeMode);
    setScenarios(presets);
    setComparisonData(null);
  };

  // Custom Site created from modal
  const handleSiteCreated = (newSite) => {
    if (onAddCustomSite) {
      onAddCustomSite(newSite);
    }
    // Offer to add directly as a new scenario
    const newScen = {
      id: `scen-${newSite.id}`,
      name: `${newSite.name} Scenario`,
      site_id: newSite.id,
      site_name: newSite.name,
      latitude: newSite.latitude,
      longitude: newSite.longitude,
      elevation_m: newSite.elevation_m,
      mast_height_m: newSite.observer_height_m || 2.0,
      start_date: missionConfig?.startDate ? new Date(missionConfig.startDate).toISOString() : '2026-12-01T00:00:00Z',
      duration_days: Number(missionConfig?.durationDays) || 14.0,
      step_hours: Math.max(1.0, Number(missionConfig?.stepHours) || 2.0),
      solar_array_area_m2: 4.0,
      solar_efficiency: 0.30,
      solar_tracking_type: 'VERTICAL_AZIMUTH_TRACKING',
      battery_capacity_wh: 5000.0,
      initial_battery_soc_percent: 100.0,
      min_safe_soc_percent: 20.0,
      base_hotel_load_w: 150.0,
      payload_active_load_w: 100.0,
      survival_heater_load_w: 80.0,
    };
    setScenarios((prev) => [...prev, newScen]);
  };

  // Results lookup helper
  const evaluatedMap = useMemo(() => {
    const map = {};
    if (comparisonData?.scenarios) {
      comparisonData.scenarios.forEach((s) => {
        map[s.scenario_id] = s;
      });
    }
    return map;
  }, [comparisonData]);

  // Evaluated array sorted by rank
  const evaluatedScenarios = useMemo(() => {
    if (!comparisonData?.scenarios) return [];
    return [...comparisonData.scenarios].sort((a, b) => (a.rank || 99) - (b.rank || 99));
  }, [comparisonData]);

  // Metric extrema for Best/Worst cell highlighting (Task 5)
  const extrema = useMemo(() => {
    if (evaluatedScenarios.length === 0) return {};
    const getVals = (key) => evaluatedScenarios.map((s) => Number(s[key] || 0));

    return {
      sunlight: {
        max: Math.max(...getVals('illumination_percentage')),
        min: Math.min(...getVals('illumination_percentage')),
      },
      darkness: {
        // for continuous darkness, lower is better
        best: Math.min(...getVals('longest_continuous_darkness_hours')),
        worst: Math.max(...getVals('longest_continuous_darkness_hours')),
      },
      comm: {
        max: Math.max(...getVals('communication_percentage')),
        min: Math.min(...getVals('communication_percentage')),
      },
      blackout: {
        // for blackout, lower is better
        best: Math.min(...getVals('longest_comm_blackout_hours')),
        worst: Math.max(...getVals('longest_comm_blackout_hours')),
      },
      soc: {
        max: Math.max(...getVals('min_battery_soc_percent')),
        min: Math.min(...getVals('min_battery_soc_percent')),
      },
      energy: {
        max: Math.max(...getVals('total_energy_generated_kwh')),
        min: Math.min(...getVals('total_energy_generated_kwh')),
      },
      score: {
        max: Math.max(...getVals('overall_suitability_score')),
        min: Math.min(...getVals('overall_suitability_score')),
      },
    };
  }, [evaluatedScenarios]);

  // Chart 1: Grouped Bar Chart Data
  const barChartData = useMemo(() => {
    return evaluatedScenarios.map((s) => ({
      name: s.name,
      illumination: Number(s.illumination_percentage?.toFixed(1)),
      comm: Number(s.communication_percentage?.toFixed(1)),
      minSoc: Number(s.min_battery_soc_percent?.toFixed(1)),
      score: Number(s.overall_suitability_score?.toFixed(1)),
    }));
  }, [evaluatedScenarios]);

  // Chart 2: Battery SoC Multi-Line Graph Data (Plotted vs Mission Elapsed Time in Hours)
  const batteryLineData = useMemo(() => {
    if (evaluatedScenarios.length === 0) return [];
    // Find maximum timeline length
    const maxSteps = Math.max(...evaluatedScenarios.map((s) => s.timeline?.length || 0));
    if (maxSteps === 0) return [];

    const stepHours = evaluatedScenarios[0]?.step_hours || 2.0;
    const points = [];

    for (let i = 0; i < maxSteps; i++) {
      const metHours = Number((i * stepHours).toFixed(1));
      const row = { met_hours: metHours };

      evaluatedScenarios.forEach((scen) => {
        const pt = scen.timeline?.[i];
        if (pt) {
          row[scen.name] = Number(pt.battery_soc_percent?.toFixed(1));
        }
      });
      points.push(row);
    }
    return points;
  }, [evaluatedScenarios]);

  // Export handlers (Task 6)
  const handleExportCSV = () => {
    if (evaluatedScenarios.length === 0) return;

    const headers = [
      'Rank',
      'Scenario Name',
      'Landing Site',
      'Latitude',
      'Longitude',
      'Elevation (m)',
      'Landing Date (UTC)',
      'Duration (days)',
      'Solar Array (m²)',
      'Battery (Wh)',
      'Max Sun Elev (deg)',
      'Min Sun Elev (deg)',
      'Sunlight Hours',
      'Darkness Hours',
      'Sunlight (%)',
      'Longest Sunlight (hrs)',
      'Longest Darkness (hrs)',
      'Comm Hours',
      'Comm (%)',
      'Longest Blackout (hrs)',
      'Comm Windows',
      'Min Battery SoC (%)',
      'Solar Energy Generated (kWh)',
      'Power Survival Status',
      'Suitability Score (/100)',
    ];

    const rows = evaluatedScenarios.map((s) => [
      s.rank || '',
      `"${s.name.replace(/"/g, '""')}"`,
      `"${s.site_name.replace(/"/g, '""')}"`,
      s.latitude,
      s.longitude,
      s.elevation_m,
      `"${new Date(s.start_date).toISOString()}"`,
      s.duration_days,
      s.solar_array_area_m2 || '',
      s.battery_capacity_wh || '',
      s.max_solar_elevation_deg,
      s.min_solar_elevation_deg,
      s.total_sunlight_hours,
      s.total_darkness_hours,
      s.illumination_percentage,
      s.longest_continuous_sunlight_hours,
      s.longest_continuous_darkness_hours,
      s.earth_visibility_hours,
      s.communication_percentage,
      s.longest_comm_blackout_hours,
      s.num_comm_windows,
      s.min_battery_soc_percent,
      s.total_energy_generated_kwh,
      s.power_survival_status,
      s.overall_suitability_score,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `luna_scenarios_comparison_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportJSON = () => {
    if (!comparisonData) return;
    const jsonStr =
      'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(comparisonData, null, 2));
    const link = document.createElement('a');
    link.setAttribute('href', jsonStr);
    link.setAttribute('download', `luna_scenarios_comparison_${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const bestScenario = evaluatedScenarios.find((s) => s.scenario_id === comparisonData?.best_scenario_id) || evaluatedScenarios[0];

  return (
    <div className="space-y-6">
      {/* 1. TOP HEADER & COMPARISON MODE SELECTOR (Task 3) */}
      <div className="rounded-2xl border border-luna-800 bg-luna-900/80 p-5 space-y-4 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                <Scale className="h-4 w-4" />
              </span>
              <h2 className="font-mono text-base font-bold uppercase tracking-wider text-white">
                Multi-Scenario Mission Comparison
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Simulate and compare independent lunar landing sites, seasonal touchdown epochs, and power configurations.
              Evaluates 12 empirical operational metrics using JPL Horizons ephemerides and NASA LOLA DEMs.
            </p>
          </div>

          {/* Action Bar: Run, Add, Custom Site, Reset, Export */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsCustomSiteOpen(true)}
              className="flex items-center space-x-1.5 rounded-lg border border-luna-700 bg-luna-800/80 px-3 py-1.5 font-mono text-xs font-semibold text-slate-200 hover:border-cyan-500/50 hover:bg-cyan-950/40 hover:text-cyan-200 transition-all"
              title="Add a custom landing site with LOLA DEM sampling"
            >
              <MapPin className="h-3.5 w-3.5 text-cyan-400" />
              <span>+ CUSTOM SITE</span>
            </button>

            <button
              onClick={handleAddScenario}
              className="flex items-center space-x-1.5 rounded-lg border border-luna-700 bg-luna-800/80 px-3 py-1.5 font-mono text-xs font-semibold text-slate-200 hover:border-emerald-500/50 hover:bg-emerald-950/40 hover:text-emerald-200 transition-all"
              title="Add another scenario to compare"
            >
              <Plus className="h-3.5 w-3.5 text-emerald-400" />
              <span>ADD SCENARIO</span>
            </button>

            <button
              onClick={handleResetPresets}
              className="flex items-center space-x-1.5 rounded-lg border border-luna-800 bg-luna-900 px-3 py-1.5 font-mono text-xs text-slate-400 hover:text-slate-200 hover:border-luna-700 transition-all"
              title="Reset scenarios to mode defaults"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>RESET</span>
            </button>

            <button
              onClick={handleRunComparison}
              disabled={loading || scenarios.length < 2}
              className="flex items-center space-x-1.5 rounded-lg border border-cyan-500/50 bg-cyan-500/20 px-4 py-1.5 font-mono text-xs font-bold text-cyan-300 hover:bg-cyan-500/30 transition-all shadow-[0_0_15px_rgba(6,182,212,0.15)] disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'CALCULATING...' : 'RUN COMPARISON'}</span>
            </button>
          </div>
        </div>

        {/* Mode Selector Tabs (Mode A / Mode B / Mode C) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-2 border-t border-luna-800/70">
          {COMPARISON_MODES.map((mode) => {
            const Icon = mode.icon;
            const isSelected = activeMode === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => {
                  if (activeMode !== mode.id) {
                    setActiveMode(mode.id);
                  }
                }}
                className={`flex flex-col text-left p-3 rounded-xl border transition-all ${
                  isSelected
                    ? 'border-cyan-500/70 bg-cyan-950/30 text-white shadow-[0_0_15px_rgba(6,182,212,0.12)]'
                    : 'border-luna-800 bg-luna-950/50 text-slate-400 hover:border-luna-700 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center space-x-2 font-mono text-xs font-bold">
                  <Icon className={`h-4 w-4 ${isSelected ? 'text-cyan-400' : 'text-slate-500'}`} />
                  <span className={isSelected ? 'text-cyan-200' : 'text-slate-300'}>{mode.title}</span>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                  {mode.subtitle}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Loading & Error States */}
      {loading && (
        <LoadingState
          title="Computing Multi-Scenario Comparison Matrix..."
          subtitle="Executing parallel ephemeris queries, terrain ray tracing, and electric power system battery charge simulations across candidate scenarios."
        />
      )}

      {error && (
        <ErrorState
          title="Multi-Scenario Comparison Failed"
          message={error}
          onRetry={handleRunComparison}
        />
      )}

      {/* 2. SCENARIO CARDS GRID (Task 5 & Task 6) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center space-x-2">
            <span>Configured Scenarios ({scenarios.length})</span>
            <span className="text-[10px] text-slate-500 font-normal">
              (Each scenario maintains independent coordinates, epoch, duration, solar area, and battery)
            </span>
          </h3>
          <div className="flex items-center space-x-2 text-xs font-mono text-slate-400">
            {evaluatedScenarios.length > 0 && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleExportCSV}
                  className="flex items-center space-x-1 hover:text-cyan-300 transition-colors"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
                  <span>CSV</span>
                </button>
                <span className="text-slate-600">|</span>
                <button
                  onClick={handleExportJSON}
                  className="flex items-center space-x-1 hover:text-cyan-300 transition-colors"
                >
                  <FileCode className="h-3.5 w-3.5 text-cyan-400" />
                  <span>JSON</span>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {scenarios.map((scen) => (
            <ScenarioCard
              key={scen.id}
              scenario={scen}
              result={evaluatedMap[scen.id]}
              isActive={activeScenarioId === scen.id}
              onSelect={() => setActiveScenarioId(scen.id)}
              onEdit={handleOpenEditor}
              onDuplicate={handleDuplicateScenario}
              onDelete={handleRemoveScenario}
              canDelete={scenarios.length > 2}
            />
          ))}
        </div>
      </div>

      {/* 3. EXECUTIVE RANKING SUMMARY & LEADER HIGHLIGHT (Task 5) */}
      {!loading && !error && evaluatedScenarios.length > 0 && bestScenario && (
        <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-950/30 via-luna-900/90 to-luna-900/90 p-5 space-y-3 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-500/20 pb-3">
            <div className="flex items-center space-x-2">
              <Award className="h-5 w-5 text-amber-400 shrink-0" />
              <div>
                <span className="font-mono text-xs font-bold text-amber-300 uppercase tracking-wider">
                  MISSION RANKING WINNER
                </span>
                <h3 className="text-sm font-bold text-white">
                  {bestScenario.name} — {bestScenario.site_name}
                </h3>
              </div>
            </div>

            <div className="flex items-center space-x-3 font-mono text-xs">
              <div className="text-right">
                <span className="text-slate-400 text-[10px] block">SUITABILITY SCORE</span>
                <span className="text-base font-extrabold text-amber-300">
                  {bestScenario.overall_suitability_score?.toFixed(1)} / 100
                </span>
              </div>
              <div className="text-right">
                <span className="text-slate-400 text-[10px] block">POWER STATUS</span>
                <span
                  className={`font-bold ${
                    bestScenario.power_survival_status === 'SURVIVED'
                      ? 'text-emerald-400'
                      : 'text-rose-400'
                  }`}
                >
                  {bestScenario.power_survival_status}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
            <div className="rounded-lg bg-luna-950/60 p-2 border border-luna-800">
              <div className="text-slate-400 text-[10px]">Sunlight Coverage</div>
              <div className="text-amber-300 font-bold text-sm mt-0.5">
                {bestScenario.illumination_percentage?.toFixed(1)}% ({bestScenario.total_sunlight_hours}h)
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Max Dark: {bestScenario.longest_continuous_darkness_hours}h
              </div>
            </div>

            <div className="rounded-lg bg-luna-950/60 p-2 border border-luna-800">
              <div className="text-slate-400 text-[10px]">Earth Direct Visibility</div>
              <div className="text-cyan-300 font-bold text-sm mt-0.5">
                {bestScenario.communication_percentage?.toFixed(1)}% ({bestScenario.earth_visibility_hours}h)
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Windows: {bestScenario.num_comm_windows} | Blackout: {bestScenario.longest_comm_blackout_hours}h
              </div>
            </div>

            <div className="rounded-lg bg-luna-950/60 p-2 border border-luna-800">
              <div className="text-slate-400 text-[10px]">Min Battery SoC</div>
              <div
                className={`font-bold text-sm mt-0.5 ${
                  bestScenario.min_battery_soc_percent > 30
                    ? 'text-emerald-400'
                    : bestScenario.min_battery_soc_percent > 20
                    ? 'text-amber-400'
                    : 'text-rose-400'
                }`}
              >
                {bestScenario.min_battery_soc_percent?.toFixed(1)}%
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Cutoff Threshold: 20.0%
              </div>
            </div>

            <div className="rounded-lg bg-luna-950/60 p-2 border border-luna-800">
              <div className="text-slate-400 text-[10px]">Total Generated Solar Energy</div>
              <div className="text-emerald-400 font-bold text-sm mt-0.5">
                {bestScenario.total_energy_generated_kwh?.toFixed(1)} kWh
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Net: {bestScenario.net_energy_balance_kwh?.toFixed(1)} kWh
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. SIDE-BY-SIDE COMPARISON MATRIX TABLE (Task 4 & Task 5) */}
      {!loading && !error && evaluatedScenarios.length > 0 && (
        <div className="rounded-2xl border border-luna-800 bg-luna-900/80 p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-white">
                Detailed 12-Metric Operational Matrix
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Green badges indicate the highest-performing scenario; red indicates operational vulnerability.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-luna-800 bg-luna-950/80">
            <table className="w-full text-left text-xs font-mono">
              <thead className="border-b border-luna-800 bg-luna-900/90 uppercase text-slate-400 text-[11px]">
                <tr>
                  <th className="py-3 px-3">Rank &amp; Scenario</th>
                  <th className="py-3 px-2 text-right">Site &amp; Coords</th>
                  <th className="py-3 px-2 text-right">Landing Epoch</th>
                  <th className="py-3 px-2 text-right">Sun Elev (Max/Min)</th>
                  <th className="py-3 px-2 text-right">Sunlight % (Total)</th>
                  <th className="py-3 px-2 text-right">Max Shadow</th>
                  <th className="py-3 px-2 text-right">Comm % (Total)</th>
                  <th className="py-3 px-2 text-right">Max Blackout</th>
                  <th className="py-3 px-2 text-right">Comm Passes</th>
                  <th className="py-3 px-2 text-right">Min SoC %</th>
                  <th className="py-3 px-2 text-right">Energy (kWh)</th>
                  <th className="py-3 px-2 text-center">Power Survival</th>
                  <th className="py-3 px-3 text-right">Suitability Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-luna-800/60 text-slate-300">
                {evaluatedScenarios.map((scen) => {
                  const isLeader = scen.rank === 1;
                  const isBestScore = scen.overall_suitability_score === extrema.score?.max;
                  const isWorstScore = scen.overall_suitability_score === extrema.score?.min && evaluatedScenarios.length > 1;
                  const isBestSun = scen.illumination_percentage === extrema.sunlight?.max;
                  const isWorstSun = scen.illumination_percentage === extrema.sunlight?.min && evaluatedScenarios.length > 1;
                  const isBestDark = scen.longest_continuous_darkness_hours === extrema.darkness?.best;
                  const isWorstDark = scen.longest_continuous_darkness_hours === extrema.darkness?.worst && evaluatedScenarios.length > 1;
                  const isBestComm = scen.communication_percentage === extrema.comm?.max;
                  const isWorstComm = scen.communication_percentage === extrema.comm?.min && evaluatedScenarios.length > 1;
                  const isBestBlackout = scen.longest_comm_blackout_hours === extrema.blackout?.best;
                  const isWorstBlackout = scen.longest_comm_blackout_hours === extrema.blackout?.worst && evaluatedScenarios.length > 1;
                  const isBestSoc = scen.min_battery_soc_percent === extrema.soc?.max;
                  const isWorstSoc = scen.min_battery_soc_percent === extrema.soc?.min && evaluatedScenarios.length > 1;
                  const isBestEnergy = scen.total_energy_generated_kwh === extrema.energy?.max;

                  return (
                    <tr
                      key={scen.scenario_id}
                      className={`hover:bg-luna-800/40 transition-colors ${
                        activeScenarioId === scen.scenario_id ? 'bg-cyan-950/20' : ''
                      }`}
                    >
                      {/* Rank & Scenario Name */}
                      <td className="py-3 px-3 font-semibold text-white">
                        <div className="flex items-center space-x-1.5">
                          <span
                            className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                              isLeader
                                ? 'bg-amber-500 text-black'
                                : scen.rank === 2
                                ? 'bg-slate-400 text-black'
                                : scen.rank === 3
                                ? 'bg-amber-800 text-white'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {scen.rank}
                          </span>
                          <span className="truncate max-w-[140px]" title={scen.name}>
                            {scen.name}
                          </span>
                        </div>
                      </td>

                      {/* Site & Coords */}
                      <td className="py-3 px-2 text-right text-slate-400 text-[11px]">
                        <div className="truncate max-w-[130px] font-medium text-slate-300">{scen.site_name}</div>
                        <div className="text-[10px] text-slate-500">
                          {formatLatitude(scen.latitude)}, {formatLongitude(scen.longitude)}
                        </div>
                      </td>

                      {/* Landing Epoch */}
                      <td className="py-3 px-2 text-right text-slate-300 text-[11px]">
                        <div>{new Date(scen.start_date).toISOString().slice(0, 10)}</div>
                        <div className="text-[10px] text-slate-500">{scen.duration_days} days</div>
                      </td>

                      {/* Sun Elevation */}
                      <td className="py-3 px-2 text-right font-medium">
                        <span className="text-amber-300">{scen.max_solar_elevation_deg?.toFixed(1)}°</span>
                        <span className="text-slate-500 text-[10px]"> / {scen.min_solar_elevation_deg?.toFixed(1)}°</span>
                      </td>

                      {/* Sunlight % */}
                      <td className="py-3 px-2 text-right">
                        <span
                          className={`px-1.5 py-0.5 rounded font-bold ${
                            isBestSun
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : isWorstSun
                              ? 'bg-rose-500/20 text-rose-400'
                              : 'text-amber-300'
                          }`}
                        >
                          {scen.illumination_percentage?.toFixed(1)}%
                        </span>
                        <div className="text-[10px] text-slate-500">{scen.total_sunlight_hours}h</div>
                      </td>

                      {/* Max Shadow */}
                      <td className="py-3 px-2 text-right">
                        <span
                          className={`font-semibold ${
                            isBestDark
                              ? 'text-emerald-400'
                              : isWorstDark
                              ? 'text-rose-400'
                              : 'text-slate-400'
                          }`}
                        >
                          {scen.longest_continuous_darkness_hours}h
                        </span>
                      </td>

                      {/* Comm % */}
                      <td className="py-3 px-2 text-right">
                        <span
                          className={`px-1.5 py-0.5 rounded font-bold ${
                            isBestComm
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : isWorstComm
                              ? 'bg-rose-500/20 text-rose-400'
                              : 'text-cyan-300'
                          }`}
                        >
                          {scen.communication_percentage?.toFixed(1)}%
                        </span>
                        <div className="text-[10px] text-slate-500">{scen.earth_visibility_hours}h</div>
                      </td>

                      {/* Max Blackout */}
                      <td className="py-3 px-2 text-right">
                        <span
                          className={`font-semibold ${
                            isBestBlackout
                              ? 'text-emerald-400'
                              : isWorstBlackout
                              ? 'text-rose-400'
                              : 'text-slate-400'
                          }`}
                        >
                          {scen.longest_comm_blackout_hours}h
                        </span>
                      </td>

                      {/* Comm Passes */}
                      <td className="py-3 px-2 text-right text-slate-300">
                        {scen.num_comm_windows}
                      </td>

                      {/* Min Battery SoC */}
                      <td className="py-3 px-2 text-right">
                        <span
                          className={`px-1.5 py-0.5 rounded font-bold ${
                            isBestSoc
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : isWorstSoc || scen.min_battery_soc_percent < 20
                              ? 'bg-rose-500/20 text-rose-400'
                              : 'text-slate-200'
                          }`}
                        >
                          {scen.min_battery_soc_percent?.toFixed(1)}%
                        </span>
                      </td>

                      {/* Generated Energy */}
                      <td className="py-3 px-2 text-right">
                        <span
                          className={`font-semibold ${
                            isBestEnergy ? 'text-emerald-400' : 'text-slate-300'
                          }`}
                        >
                          {scen.total_energy_generated_kwh?.toFixed(1)}
                        </span>
                      </td>

                      {/* Power Survival Status */}
                      <td className="py-3 px-2 text-center">
                        <span
                          className={`inline-flex items-center space-x-1 rounded px-2 py-0.5 text-[10px] font-bold ${
                            scen.power_survival_status === 'SURVIVED'
                              ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/40'
                              : 'bg-rose-950/60 text-rose-400 border border-rose-500/40'
                          }`}
                        >
                          {scen.power_survival_status === 'SURVIVED' ? (
                            <>
                              <ShieldCheck className="h-3 w-3" />
                              <span>SURVIVED</span>
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="h-3 w-3" />
                              <span>DEPLETED</span>
                            </>
                          )}
                        </span>
                      </td>

                      {/* Suitability Score */}
                      <td className="py-3 px-3 text-right">
                        <span
                          className={`inline-block px-2 py-0.5 rounded font-extrabold text-sm ${
                            isBestScore
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              : isWorstScore
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                              : 'text-emerald-400'
                          }`}
                        >
                          {scen.overall_suitability_score?.toFixed(1)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. VISUAL METRICS BAR CHART (Task 5) */}
      {!loading && !error && barChartData.length > 0 && (
        <div className="rounded-2xl border border-luna-800 bg-luna-900/80 p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-white">
                Multi-Scenario Key Metric Comparison
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Side-by-side normalized percentages: Sunlight % vs Earth Comm % vs Min Battery SoC % vs Overall Score (/100).
              </p>
            </div>
          </div>

          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barChartData} margin={{ top: 10, right: 20, left: -10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis
                  dataKey="name"
                  stroke="#64748B"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(n) => (n.length > 18 ? n.slice(0, 16) + '…' : n)}
                />
                <YAxis stroke="#64748B" domain={[0, 100]} unit="%" tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0B0F19', borderColor: '#222E4A', borderRadius: '8px' }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="illumination" name="Sunlight (%)" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                <Bar dataKey="comm" name="Earth Comm (%)" fill="#06B6D4" radius={[4, 4, 0, 0]} />
                <Bar dataKey="minSoc" name="Min Battery SoC (%)" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="score" name="Suitability Score (/100)" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 6. SUNLIGHT & COMMUNICATION GANTT TIMELINES (Task 5) */}
      {!loading && !error && evaluatedScenarios.length > 0 && (
        <div className="rounded-2xl border border-luna-800 bg-luna-900/80 p-5 space-y-4 shadow-xl">
          <div>
            <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-white">
              Sunlight &amp; Direct-to-Earth Communication Timelines
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Gantt-style mission profile: Golden blocks indicate unshaded solar contact; Cyan blocks indicate Earth line-of-sight.
            </p>
          </div>

          <div className="space-y-4 pt-2">
            {evaluatedScenarios.map((scen, scenIdx) => {
              const timeline = scen.timeline || [];
              const totalPts = timeline.length || 1;

              return (
                <div key={scen.scenario_id} className="rounded-xl border border-luna-800 bg-luna-950/70 p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="font-bold text-slate-200">
                      #{scen.rank || scenIdx + 1} {scen.name} — <span className="text-slate-400">{scen.site_name}</span>
                    </span>
                    <span className="text-slate-400">
                      {scen.duration_days}d @ {scen.step_hours}h steps ({totalPts} epochs)
                    </span>
                  </div>

                  {/* Sunlight Track */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                      <span className="flex items-center space-x-1">
                        <Sun className="h-3 w-3 text-amber-400" />
                        <span>Solar Illumination ({scen.illumination_percentage?.toFixed(1)}%)</span>
                      </span>
                      <span>{scen.total_sunlight_hours}h Sun / {scen.total_darkness_hours}h Dark</span>
                    </div>
                    <div className="flex h-5 w-full overflow-hidden rounded bg-slate-900 border border-slate-800">
                      {timeline.map((pt, idx) => (
                        <div
                          key={`sun-${idx}`}
                          title={`Epoch ${idx * scen.step_hours}h: ${pt.is_sunlit ? 'Sunlit' : 'Shadow'} (Elev: ${pt.sun_elevation_deg?.toFixed(1)}°)`}
                          className={`h-full flex-1 transition-opacity hover:opacity-80 ${
                            pt.is_sunlit ? 'bg-amber-400' : 'bg-slate-950'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Comm Track */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                      <span className="flex items-center space-x-1">
                        <Radio className="h-3 w-3 text-cyan-400" />
                        <span>Earth LOS Comm ({scen.communication_percentage?.toFixed(1)}%)</span>
                      </span>
                      <span>{scen.num_comm_windows} Passes | Max Blackout: {scen.longest_comm_blackout_hours}h</span>
                    </div>
                    <div className="flex h-5 w-full overflow-hidden rounded bg-slate-900 border border-slate-800">
                      {timeline.map((pt, idx) => (
                        <div
                          key={`comm-${idx}`}
                          title={`Epoch ${idx * scen.step_hours}h: ${pt.is_earth_visible ? 'Earth Visible' : 'Blackout'} (Elev: ${pt.earth_elevation_deg?.toFixed(1)}°)`}
                          className={`h-full flex-1 transition-opacity hover:opacity-80 ${
                            pt.is_earth_visible ? 'bg-cyan-500' : 'bg-slate-950'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 7. BATTERY STATE-OF-CHARGE (SoC %) MULTI-LINE GRAPH (Task 5) */}
      {!loading && !error && batteryLineData.length > 0 && (
        <div className="rounded-2xl border border-luna-800 bg-luna-900/80 p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-white flex items-center space-x-2">
                <Battery className="h-4 w-4 text-emerald-400" />
                <span>Simultaneous Battery State-of-Charge (SoC %) Profiles</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Simulated battery charge/discharge trajectories over Mission Elapsed Time (MET Hours).
                The red dashed line indicates the 20% Depth-of-Discharge cutoff limit.
              </p>
            </div>
          </div>

          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={batteryLineData} margin={{ top: 10, right: 30, left: -10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis
                  dataKey="met_hours"
                  stroke="#64748B"
                  tick={{ fontSize: 10 }}
                  unit="h"
                  name="Mission Elapsed Time"
                />
                <YAxis stroke="#64748B" domain={[0, 100]} unit="%" tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0B0F19', borderColor: '#222E4A', borderRadius: '8px' }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {/* 20% DoD Critical Cutoff line */}
                <ReferenceLine
                  y={20}
                  stroke="#EF4444"
                  strokeDasharray="4 4"
                  label={{ value: '20% DoD Cutoff', fill: '#EF4444', fontSize: 10, position: 'insideTopRight' }}
                />
                {evaluatedScenarios.map((scen, idx) => (
                  <Line
                    key={scen.scenario_id}
                    type="monotone"
                    dataKey={scen.name}
                    stroke={SCENARIO_COLORS[idx % SCENARIO_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 8. SCENARIO EDITOR MODAL (Task 6) */}
      <ScenarioEditorModal
        isOpen={isEditorOpen}
        onClose={() => {
          setIsEditorOpen(false);
          setEditingScenario(null);
        }}
        scenario={editingScenario}
        onSave={handleSaveScenario}
        availableSites={sites}
      />

      {/* 9. CUSTOM LANDING SITE CREATION MODAL (Task 1) */}
      <CustomSiteModal
        isOpen={isCustomSiteOpen}
        onClose={() => setIsCustomSiteOpen(false)}
        onSiteCreated={handleSiteCreated}
      />
    </div>
  );
}
