import React, { useState, useEffect } from 'react';
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
  Copy,
  Trash2,
  Edit3,
  Download,
  Calendar,
  Zap,
  BatteryCharging,
  Layers,
  MapPin,
  Clock,
  ShieldAlert,
  Sliders,
  ChevronRight,
  TrendingUp,
  FileJson,
  FileSpreadsheet,
  RotateCcw,
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
import {
  formatPercent,
  formatHours,
  formatAngle,
  formatEnergyKWh,
  formatElevationM,
  formatDateTime,
} from '../../utils/formatters';
import LoadingState from '../common/LoadingState';
import ErrorState from '../common/ErrorState';
import Badge from '../common/Badge';
import ScenarioConfigModal from './ScenarioConfigModal';
import CustomSiteModal from './CustomSiteModal';

// Baseline scenario templates
const createDefaultScenarios = (baseDateIso = '2026-12-01T00:00:00.000Z') => [
  {
    id: 'sc-1',
    name: 'Shackleton Rim Alpha',
    site_id: 'shackleton-rim',
    latitude: -89.78,
    longitude: 125.0,
    elevation_m: 1240.0,
    observer_height_m: 2.0,
    start_date: baseDateIso,
    duration_days: 14.0,
    step_hours: 2.0,
    solar_array_area_m2: 4.5,
    solar_efficiency: 0.30,
    solar_tracking_type: 'VERTICAL_AZIMUTH_TRACKING',
    battery_capacity_wh: 5000.0,
    initial_battery_soc_percent: 100.0,
    min_safe_soc_percent: 20.0,
    base_hotel_load_w: 120.0,
    payload_active_load_w: 80.0,
    survival_heater_load_w: 150.0,
    use_live_horizons: false,
  },
  {
    id: 'sc-2',
    name: 'Connecting Ridge Bravo',
    site_id: 'connecting-ridge',
    latitude: -89.44,
    longitude: 222.5,
    elevation_m: 820.0,
    observer_height_m: 2.0,
    start_date: baseDateIso,
    duration_days: 14.0,
    step_hours: 2.0,
    solar_array_area_m2: 4.5,
    solar_efficiency: 0.30,
    solar_tracking_type: 'VERTICAL_AZIMUTH_TRACKING',
    battery_capacity_wh: 5000.0,
    initial_battery_soc_percent: 100.0,
    min_safe_soc_percent: 20.0,
    base_hotel_load_w: 120.0,
    payload_active_load_w: 80.0,
    survival_heater_load_w: 150.0,
    use_live_horizons: false,
  },
  {
    id: 'sc-3',
    name: 'Malapert Mountain Peak',
    site_id: 'malapert-mountain',
    latitude: -85.99,
    longitude: 2.91,
    elevation_m: 5050.0,
    observer_height_m: 2.0,
    start_date: baseDateIso,
    duration_days: 14.0,
    step_hours: 2.0,
    solar_array_area_m2: 4.5,
    solar_efficiency: 0.30,
    solar_tracking_type: 'VERTICAL_AZIMUTH_TRACKING',
    battery_capacity_wh: 5000.0,
    initial_battery_soc_percent: 100.0,
    min_safe_soc_percent: 20.0,
    base_hotel_load_w: 120.0,
    payload_active_load_w: 80.0,
    survival_heater_load_w: 150.0,
    use_live_horizons: false,
  },
];

const PALETTE = ['#06B6D4', '#F59E0B', '#10B981', '#8B5CF6', '#EC4899', '#3B82F6'];

export default function SiteComparison({
  sites = [],
  missionConfig,
  onSelectSite,
}) {
  // Comparison Mode: 'DIFFERENT_SITES_SAME_DATE' | 'SAME_SITE_DIFFERENT_DATES' | 'DIFFERENT_SITES_AND_DATES'
  const [comparisonMode, setComparisonMode] = useState('DIFFERENT_SITES_SAME_DATE');
  const [activeViewTab, setActiveViewTab] = useState('table'); // 'table' | 'charts' | 'timelines' | 'battery' | 'rankings'

  // Scenario list state
  const [scenarios, setScenarios] = useState(() => {
    const baseDate = missionConfig?.startDate
      ? new Date(missionConfig.startDate).toISOString()
      : '2026-12-01T00:00:00.000Z';
    return createDefaultScenarios(baseDate);
  });

  // Modal states
  const [editingScenario, setEditingScenario] = useState(null);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isCustomSiteModalOpen, setIsCustomSiteModalOpen] = useState(false);

  // Calculation results state
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Run calculation
  const handleRunComparison = async (scenariosToRun = scenarios, modeToRun = comparisonMode) => {
    const list = Array.isArray(scenariosToRun) && scenariosToRun.length ? scenariosToRun : scenarios;
    const mode = modeToRun || comparisonMode;
    if (list.length < 2) return;
    setLoading(true);
    setError(null);

    try {
      const res = await compareScenarios({
        mode: mode,
        scenarios: list.map((sc) => ({
          ...sc,
          start_date: new Date(sc.start_date).toISOString(),
          duration_days: Number(sc.duration_days),
          step_hours: Number(sc.step_hours),
          solar_array_area_m2: Number(sc.solar_array_area_m2),
          solar_efficiency: Number(sc.solar_efficiency),
          battery_capacity_wh: Number(sc.battery_capacity_wh),
          initial_battery_soc_percent: Number(sc.initial_battery_soc_percent),
          min_safe_soc_percent: Number(sc.min_safe_soc_percent),
          base_hotel_load_w: Number(sc.base_hotel_load_w),
          payload_active_load_w: Number(sc.payload_active_load_w),
          survival_heater_load_w: Number(sc.survival_heater_load_w),
        })),
      });
      setResults(res);
    } catch (err) {
      console.error('Failed to run multi-scenario comparison:', err);
      setError(
        err.response?.data?.error?.message ||
          err.response?.data?.detail ||
          err.message ||
          'Multi-scenario comparison calculation failed.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleRunComparison();
  }, []);

  // Quick Presets
  const applyPresetMode = (modeType) => {
    setComparisonMode(modeType);
    const baseDate = missionConfig?.startDate
      ? new Date(missionConfig.startDate).toISOString()
      : '2026-12-01T00:00:00.000Z';

    let nextScenarios = [];
    if (modeType === 'DIFFERENT_SITES_SAME_DATE') {
      nextScenarios = createDefaultScenarios(baseDate);
    } else if (modeType === 'SAME_SITE_DIFFERENT_DATES') {
      // 3 seasonal windows for Shackleton
      nextScenarios = [
        {
          ...createDefaultScenarios(baseDate)[0],
          id: 'sc-epoch-1',
          name: 'Shackleton Dec 01 (Baseline)',
          start_date: '2026-12-01T00:00:00.000Z',
        },
        {
          ...createDefaultScenarios(baseDate)[0],
          id: 'sc-epoch-2',
          name: 'Shackleton Dec 15 (Solstice Peak)',
          start_date: '2026-12-15T00:00:00.000Z',
        },
        {
          ...createDefaultScenarios(baseDate)[0],
          id: 'sc-epoch-3',
          name: 'Shackleton Jan 01 (Late Window)',
          start_date: '2027-01-01T00:00:00.000Z',
        },
      ];
    } else if (modeType === 'DIFFERENT_SITES_AND_DATES') {
      // Matrix of sites and dates
      nextScenarios = [
        {
          ...createDefaultScenarios(baseDate)[0],
          id: 'sc-mat-1',
          name: 'Shackleton Rim - Dec 1 (4.5m² Array)',
          start_date: '2026-12-01T00:00:00.000Z',
        },
        {
          ...createDefaultScenarios(baseDate)[1],
          id: 'sc-mat-2',
          name: 'Connecting Ridge - Dec 10 (High Battery 8000Wh)',
          start_date: '2026-12-10T00:00:00.000Z',
          battery_capacity_wh: 8000.0,
        },
        {
          ...createDefaultScenarios(baseDate)[2],
          id: 'sc-mat-3',
          name: 'Malapert Mountain - Dec 20 (Heavy Array 8m²)',
          start_date: '2026-12-20T00:00:00.000Z',
          solar_array_area_m2: 8.0,
        },
      ];
    }
    setScenarios(nextScenarios);
    handleRunComparison(nextScenarios, modeType);
  };

  // Scenario Management Actions
  const handleAddScenario = () => {
    if (scenarios.length >= 6) return;
    const nextIdx = scenarios.length + 1;
    const template = scenarios[scenarios.length - 1] || createDefaultScenarios()[0];
    const newScenario = {
      ...template,
      id: `sc-${Date.now()}`,
      name: `Alternative Scenario ${nextIdx}`,
    };
    setScenarios([...scenarios, newScenario]);
  };

  const handleDuplicateScenario = (sc) => {
    if (scenarios.length >= 6) return;
    const duplicated = {
      ...sc,
      id: `sc-${Date.now()}`,
      name: `${sc.name} (Copy)`,
    };
    setScenarios([...scenarios, duplicated]);
  };

  const handleRemoveScenario = (id) => {
    if (scenarios.length <= 2) return; // Keep minimum 2
    setScenarios(scenarios.filter((s) => s.id !== id));
  };

  const handleEditScenario = (sc) => {
    setEditingScenario(sc);
    setIsConfigModalOpen(true);
  };

  const handleSaveScenario = (updated) => {
    setScenarios(scenarios.map((s) => (s.id === updated.id ? updated : s)));
  };

  const handleReset = () => {
    const baseDate = missionConfig?.startDate
      ? new Date(missionConfig.startDate).toISOString()
      : '2026-12-01T00:00:00.000Z';
    setComparisonMode('DIFFERENT_SITES_SAME_DATE');
    const defaults = createDefaultScenarios(baseDate);
    setScenarios(defaults);
    handleRunComparison(defaults, 'DIFFERENT_SITES_SAME_DATE');
  };

  const handleCustomSiteCreated = (newSite) => {
    // Add scenario with new custom site
    const customScenario = {
      ...createDefaultScenarios()[0],
      id: `sc-${Date.now()}`,
      name: `${newSite.name} (Custom)`,
      site_id: newSite.id,
      latitude: newSite.latitude,
      longitude: newSite.longitude,
      elevation_m: newSite.elevation_m,
      observer_height_m: newSite.observer_height_m || 2.0,
    };
    setScenarios([...scenarios, customScenario]);
  };

  // Export handlers
  const handleExportCSV = () => {
    if (!results?.scenarios?.length) return;
    const headers = [
      'Rank',
      'Scenario Name',
      'Latitude',
      'Longitude',
      'Elevation (m)',
      'Slope (deg)',
      'Landing Epoch (UTC)',
      'Duration (days)',
      'Solar Array (m2)',
      'Battery (Wh)',
      'Illumination (%)',
      'Sunlit Hours (h)',
      'Max Shadow (h)',
      'Comm (%)',
      'Comm Windows',
      'Max Blackout (h)',
      'Min Battery SoC (%)',
      'Energy Generated (kWh)',
      'Energy Consumed (kWh)',
      'EPS Health Status',
      'Overall Suitability Score',
    ];

    const rows = results.scenarios.map((s) => [
      s.rank,
      `"${s.name.replace(/"/g, '""')}"`,
      s.latitude,
      s.longitude,
      s.elevation_m,
      s.slope_degrees,
      s.start_date,
      s.duration_days,
      s.solar_array_area_m2,
      s.battery_capacity_wh,
      s.illumination_percentage,
      s.total_sunlit_hours,
      s.longest_darkness_hours,
      s.communication_percentage,
      s.comm_windows_count,
      s.longest_comm_blackout_hours,
      s.min_battery_soc_percent,
      s.total_energy_generated_kwh,
      s.total_energy_consumed_kwh,
      s.power_survival_status,
      s.overall_suitability_score,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `luna_navigator_scenario_comparison_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportJSON = () => {
    if (!results) return;
    const dataStr =
      'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(results, null, 2));
    const link = document.createElement('a');
    link.setAttribute('href', dataStr);
    link.setAttribute('download', `luna_navigator_scenarios_${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const evaluated = results?.scenarios || [];

  // Helper metrics for highlights
  const maxIllum = Math.max(...evaluated.map((s) => s.illumination_percentage), 0);
  const minIllum = Math.min(...evaluated.map((s) => s.illumination_percentage), 100);
  const maxComm = Math.max(...evaluated.map((s) => s.communication_percentage), 0);
  const minComm = Math.min(...evaluated.map((s) => s.communication_percentage), 100);
  const maxScore = Math.max(...evaluated.map((s) => s.overall_suitability_score), 0);
  const minScore = Math.min(...evaluated.map((s) => s.overall_suitability_score), 100);
  const maxMinSoc = Math.max(...evaluated.map((s) => s.min_battery_soc_percent), 0);
  const minMinSoc = Math.min(...evaluated.map((s) => s.min_battery_soc_percent), 100);
  const minShadow = Math.min(...evaluated.map((s) => s.longest_darkness_hours), Infinity);
  const maxShadow = Math.max(...evaluated.map((s) => s.longest_darkness_hours), 0);

  // Synchronized chart data formatting
  const chartCategories = evaluated.map((s) => ({
    name: s.name.length > 18 ? s.name.slice(0, 16) + '…' : s.name,
    fullName: s.name,
    illumination_percentage: s.illumination_percentage,
    communication_percentage: s.communication_percentage,
    overall_suitability_score: s.overall_suitability_score,
    min_battery_soc_percent: s.min_battery_soc_percent,
    total_energy_generated_kwh: s.total_energy_generated_kwh,
    total_energy_consumed_kwh: s.total_energy_consumed_kwh,
  }));

  // Build merged timeline for battery SoC line chart (first 50 points normalized by hours)
  const maxHours = Math.max(...evaluated.map((s) => s.duration_days * 24.0), 24);
  const batteryPointsCount = 40;
  const mergedBatteryData = [];
  for (let i = 0; i <= batteryPointsCount; i++) {
    const h = (i / batteryPointsCount) * maxHours;
    const pt = { hour: Math.round(h) };
    evaluated.forEach((sc, idx) => {
      // Find closest timeline point
      if (sc.timeline && sc.timeline.length) {
        let closest = sc.timeline[0];
        let minDiff = Infinity;
        for (const t of sc.timeline) {
          const diff = Math.abs(t.hours_from_start - h);
          if (diff < minDiff) {
            minDiff = diff;
            closest = t;
          }
        }
        pt[sc.name] = closest.battery_soc_percent;
      }
    });
    mergedBatteryData.push(pt);
  }

  return (
    <div className="space-y-6">
      {/* 1. TOP CONTROL BAR: COMPARISON MODES & ACTIONS */}
      <div className="rounded-2xl border border-luna-800 bg-luna-900/70 p-5 space-y-4 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <Scale className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-mono text-base font-bold text-white tracking-wider">
                  ADVANCED MULTI-SCENARIO MISSION COMPARISON
                </h2>
                <p className="text-xs text-slate-400">
                  Simultaneous Multi-Site, Multi-Epoch, and EPS Configuration Trade-Off Analysis
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsCustomSiteModalOpen(true)}
              className="flex items-center space-x-1.5 rounded-lg border border-purple-500/40 bg-purple-500/15 px-3 py-1.5 font-mono text-xs font-semibold text-purple-300 hover:bg-purple-500/25 transition-all"
              title="Add custom landing site with user coordinates"
            >
              <MapPin className="h-3.5 w-3.5" />
              <span>+ Custom Site</span>
            </button>

            <button
              onClick={handleAddScenario}
              disabled={scenarios.length >= 6}
              className="flex items-center space-x-1.5 rounded-lg border border-slate-700 bg-luna-800 px-3 py-1.5 font-mono text-xs font-semibold text-slate-200 hover:bg-luna-750 transition-all disabled:opacity-40"
              title="Add a new alternative mission scenario"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Scenario ({scenarios.length}/6)</span>
            </button>

            <button
              onClick={handleRunComparison}
              disabled={loading || scenarios.length < 2}
              className="flex items-center space-x-1.5 rounded-lg border border-cyan-500/50 bg-cyan-500/20 px-4 py-1.5 font-mono text-xs font-bold text-cyan-300 hover:bg-cyan-500/30 transition-all shadow-[0_0_12px_rgba(6,182,212,0.25)] disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'CALCULATING...' : 'RUN COMPARISON'}</span>
            </button>

            <div className="hidden sm:inline-block h-5 w-px bg-luna-750 mx-1" />

            <button
              onClick={handleExportCSV}
              disabled={!results}
              className="flex items-center space-x-1 rounded-lg border border-luna-700 bg-luna-850 px-2.5 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-luna-800 transition-colors disabled:opacity-40"
              title="Export scenario comparison matrix as CSV"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
              <span className="hidden md:inline">CSV</span>
            </button>

            <button
              onClick={handleExportJSON}
              disabled={!results}
              className="flex items-center space-x-1 rounded-lg border border-luna-700 bg-luna-850 px-2.5 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-luna-800 transition-colors disabled:opacity-40"
              title="Export scenario results as JSON"
            >
              <FileJson className="h-3.5 w-3.5 text-cyan-400" />
              <span className="hidden md:inline">JSON</span>
            </button>

            <button
              onClick={handleReset}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-luna-800 rounded-lg transition-colors"
              title="Reset comparisons to baseline"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Comparison Modes Selector (TASK 3) */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-luna-800/80">
          <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wide mr-1">
            Comparison Mode:
          </span>
          {[
            {
              id: 'DIFFERENT_SITES_SAME_DATE',
              label: 'Mode A: Different Sites, Same Epoch',
              desc: 'Cross-Site Spatial Comparison',
            },
            {
              id: 'SAME_SITE_DIFFERENT_DATES',
              label: 'Mode B: Same Site, Seasonal Windows',
              desc: 'Multi-Epoch Libration Trade-off',
            },
            {
              id: 'DIFFERENT_SITES_AND_DATES',
              label: 'Mode C: Matrix / Independent Scenarios',
              desc: 'Global Multi-Variable Analysis',
            },
          ].map((mode) => (
            <button
              key={mode.id}
              onClick={() => applyPresetMode(mode.id)}
              className={`flex items-center space-x-2 rounded-xl px-3 py-1.5 text-xs font-mono transition-all border ${
                comparisonMode === mode.id
                  ? 'border-cyan-500/50 bg-cyan-950/40 text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.15)] font-semibold'
                  : 'border-luna-800 bg-luna-950 text-slate-400 hover:text-slate-200 hover:border-luna-700'
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  comparisonMode === mode.id ? 'bg-cyan-400 animate-pulse' : 'bg-slate-600'
                }`}
              />
              <span>{mode.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 2. SCENARIO CONFIGURATION CARDS GRID (TASK 2 & TASK 5) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {scenarios.map((sc, idx) => {
          const evalRes = evaluated.find((e) => e.id === sc.id);
          const color = PALETTE[idx % PALETTE.length];
          const rank = evalRes?.rank;

          return (
            <div
              key={sc.id}
              className="relative rounded-2xl border border-luna-800 bg-luna-900/60 p-4 space-y-3.5 shadow-lg transition-all hover:border-luna-700"
              style={{ borderTop: `3px solid ${color}` }}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center space-x-1.5">
                    {rank && (
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-mono font-bold ${
                          rank === 1
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-luna-800 text-slate-300'
                        }`}
                      >
                        RANK #{rank}
                      </span>
                    )}
                    <h3 className="font-mono text-xs font-bold text-white truncate max-w-[170px]">
                      {sc.name}
                    </h3>
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono">
                    {formatLatitude(sc.latitude)}, {formatLongitude(sc.longitude)} &bull; {sc.elevation_m || 0}m
                  </p>
                </div>

                {/* Card Controls */}
                <div className="flex items-center space-x-1 shrink-0">
                  <button
                    onClick={() => handleEditScenario(sc)}
                    className="p-1 text-slate-400 hover:text-cyan-300 hover:bg-luna-800 rounded transition-colors"
                    title="Edit scenario parameters"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDuplicateScenario(sc)}
                    disabled={scenarios.length >= 6}
                    className="p-1 text-slate-400 hover:text-cyan-300 hover:bg-luna-800 rounded transition-colors disabled:opacity-30"
                    title="Duplicate scenario"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleRemoveScenario(sc.id)}
                    disabled={scenarios.length <= 2}
                    className="p-1 text-slate-400 hover:text-rose-400 hover:bg-luna-800 rounded transition-colors disabled:opacity-30"
                    title="Remove scenario"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Epoch & Hardware Parameters */}
              <div className="grid grid-cols-2 gap-2 rounded-xl border border-luna-800/80 bg-luna-950/70 p-2.5 text-[10px] font-mono text-slate-300">
                <div>
                  <span className="text-slate-500 block">EPOCH:</span>
                  <span className="text-slate-200 font-semibold truncate block">
                    {formatDateTime(sc.start_date).slice(0, 16)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">DURATION:</span>
                  <span className="text-slate-200 font-semibold">{sc.duration_days} Days ({sc.step_hours}h step)</span>
                </div>
                <div>
                  <span className="text-slate-500 block">SOLAR ARRAY:</span>
                  <span className="text-cyan-300 font-semibold">{sc.solar_array_area_m2} m² ({(sc.solar_efficiency * 100).toFixed(0)}%)</span>
                </div>
                <div>
                  <span className="text-slate-500 block">BATTERY:</span>
                  <span className="text-emerald-300 font-semibold">{(sc.battery_capacity_wh / 1000).toFixed(1)} kWh</span>
                </div>
              </div>

              {/* Evaluated Metric Pills */}
              {evalRes ? (
                <div className="grid grid-cols-3 gap-1.5 pt-1 text-center font-mono text-[10px]">
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-1.5">
                    <span className="text-slate-400 block text-[9px]">SUNLIGHT</span>
                    <span className="font-bold text-amber-300 text-xs">
                      {formatPercent(evalRes.illumination_percentage)}
                    </span>
                  </div>
                  <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-1.5">
                    <span className="text-slate-400 block text-[9px]">EARTH DTE</span>
                    <span className="font-bold text-cyan-300 text-xs">
                      {formatPercent(evalRes.communication_percentage)}
                    </span>
                  </div>
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-1.5">
                    <span className="text-slate-400 block text-[9px]">SUITABILITY</span>
                    <span className="font-bold text-emerald-300 text-xs">
                      {evalRes.overall_suitability_score}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="py-2 text-center text-slate-500 text-[10px] font-mono">
                  Pending calculation...
                </div>
              )}
            </div>
          );
        })}
      </div>

      {loading && (
        <LoadingState
          title="Executing Multi-Scenario Scientific Engine Runs..."
          subtitle="Calculating time-series solar illumination, terrain shadow masking, Direct-to-Earth libration links, and EPS battery State-of-Charge for each scenario."
        />
      )}

      {error && (
        <ErrorState
          title="Scenario Comparison Calculation Error"
          message={error}
          onRetry={handleRunComparison}
        />
      )}

      {/* 3. VISUALIZATION SUB-TABS & ANALYSIS RESULTS (TASK 4 & TASK 5) */}
      {!loading && !error && evaluated.length > 0 && (
        <div className="space-y-4">
          {/* Sub-tab Navigation */}
          <div className="flex items-center space-x-1 rounded-xl border border-luna-800 bg-luna-900/80 p-1 font-mono text-xs overflow-x-auto">
            {[
              { id: 'table', label: '1. Comparative Matrix Table', icon: Scale },
              { id: 'charts', label: '2. Comparative Bar Charts', icon: Sliders },
              { id: 'timelines', label: '3. Sunlight & Comm Timelines', icon: Clock },
              { id: 'battery', label: '4. Battery SoC (%) Curves', icon: BatteryCharging },
              { id: 'rankings', label: '5. Leaderboard & Risks', icon: Award },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeViewTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveViewTab(tab.id)}
                  className={`flex items-center space-x-1.5 rounded-lg px-3 py-1.5 whitespace-nowrap transition-all ${
                    active
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold shadow-[0_0_8px_rgba(6,182,212,0.15)]'
                      : 'text-slate-400 hover:text-white hover:bg-luna-800/50'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* VIEW TAB 1: COMPARATIVE DATA MATRIX TABLE */}
          {activeViewTab === 'table' && (
            <div className="overflow-x-auto rounded-2xl border border-luna-800 bg-luna-900/60 shadow-xl">
              <table className="w-full text-left text-xs font-mono">
                <thead className="border-b border-luna-800 bg-luna-850 uppercase text-slate-400">
                  <tr>
                    <th className="py-3 px-4">Scenario Designation</th>
                    <th className="py-3 px-3 text-right">Coordinates</th>
                    <th className="py-3 px-3 text-right">Epoch &amp; Days</th>
                    <th className="py-3 px-3 text-right">Sunlight %</th>
                    <th className="py-3 px-3 text-right">Max Darkness</th>
                    <th className="py-3 px-3 text-right">Sun Elevation (Mean/Max)</th>
                    <th className="py-3 px-3 text-right">Earth Comm %</th>
                    <th className="py-3 px-3 text-right">Comm Windows</th>
                    <th className="py-3 px-3 text-right">Max Blackout</th>
                    <th className="py-3 px-3 text-right">Min Battery SoC</th>
                    <th className="py-3 px-3 text-right">Energy (Gen/Con)</th>
                    <th className="py-3 px-3 text-right">EPS Status</th>
                    <th className="py-3 px-4 text-right">Suitability</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-luna-800/60 text-slate-200">
                  {evaluated.map((sc, idx) => {
                    const isBestIllum = sc.illumination_percentage === maxIllum;
                    const isWorstIllum = sc.illumination_percentage === minIllum && evaluated.length > 1;
                    const isBestComm = sc.communication_percentage === maxComm;
                    const isWorstComm = sc.communication_percentage === minComm && evaluated.length > 1;
                    const isBestScore = sc.overall_suitability_score === maxScore;
                    const isWorstScore = sc.overall_suitability_score === minScore && evaluated.length > 1;
                    const isBestSoc = sc.min_battery_soc_percent === maxMinSoc;
                    const isWorstSoc = sc.min_battery_soc_percent === minMinSoc && evaluated.length > 1;

                    return (
                      <tr key={sc.id} className="hover:bg-luna-800/50 transition-colors">
                        {/* Name & Rank */}
                        <td className="py-3 px-4 font-semibold text-white">
                          <div className="flex items-center space-x-2">
                            <span
                              className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                                sc.rank === 1
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                  : 'bg-luna-800 text-slate-400'
                              }`}
                            >
                              {sc.rank}
                            </span>
                            <span className="truncate max-w-[170px]">{sc.name}</span>
                          </div>
                        </td>

                        {/* Coordinates */}
                        <td className="py-3 px-3 text-right text-slate-400 text-[11px]">
                          {formatLatitude(sc.latitude)}, {formatLongitude(sc.longitude)}
                        </td>

                        {/* Epoch */}
                        <td className="py-3 px-3 text-right text-slate-300 text-[11px]">
                          {sc.start_date.slice(0, 10)} ({sc.duration_days}d)
                        </td>

                        {/* Sunlight % */}
                        <td
                          className={`py-3 px-3 text-right font-bold ${
                            isBestIllum
                              ? 'text-emerald-400 bg-emerald-500/10'
                              : isWorstIllum
                              ? 'text-rose-400 bg-rose-500/5'
                              : 'text-amber-300'
                          }`}
                        >
                          {formatPercent(sc.illumination_percentage)}
                        </td>

                        {/* Max Darkness Duration */}
                        <td
                          className={`py-3 px-3 text-right ${
                            sc.longest_darkness_hours === minShadow
                              ? 'text-emerald-400 font-bold'
                              : sc.longest_darkness_hours === maxShadow && evaluated.length > 1
                              ? 'text-rose-400'
                              : 'text-slate-300'
                          }`}
                        >
                          {formatHours(sc.longest_darkness_hours)}
                        </td>

                        {/* Solar Elevation */}
                        <td className="py-3 px-3 text-right text-slate-300">
                          {formatAngle(sc.mean_sun_elevation_deg)} / {formatAngle(sc.max_sun_elevation_deg)}
                        </td>

                        {/* Earth Comm % */}
                        <td
                          className={`py-3 px-3 text-right font-bold ${
                            isBestComm
                              ? 'text-emerald-400 bg-emerald-500/10'
                              : isWorstComm
                              ? 'text-rose-400 bg-rose-500/5'
                              : 'text-cyan-300'
                          }`}
                        >
                          {formatPercent(sc.communication_percentage)}
                        </td>

                        {/* Comm Windows */}
                        <td className="py-3 px-3 text-right text-slate-300">
                          {sc.comm_windows_count}
                        </td>

                        {/* Max Comm Blackout */}
                        <td className="py-3 px-3 text-right text-slate-400">
                          {formatHours(sc.longest_comm_blackout_hours)}
                        </td>

                        {/* Min Battery SoC */}
                        <td
                          className={`py-3 px-3 text-right font-bold ${
                            sc.battery_depleted
                              ? 'text-rose-400 bg-rose-950/40 animate-pulse'
                              : isBestSoc
                              ? 'text-emerald-400 bg-emerald-500/10'
                              : isWorstSoc
                              ? 'text-amber-400'
                              : 'text-slate-200'
                          }`}
                        >
                          {formatPercent(sc.min_battery_soc_percent)}
                        </td>

                        {/* Energy Gen / Con */}
                        <td className="py-3 px-3 text-right text-slate-300 text-[11px]">
                          {formatEnergyKWh(sc.total_energy_generated_kwh)} / {formatEnergyKWh(sc.total_energy_consumed_kwh)}
                        </td>

                        {/* Power Survival Status */}
                        <td className="py-3 px-3 text-right">
                          <Badge
                            variant={
                              sc.power_survival_status === 'NOMINAL'
                                ? 'emerald'
                                : sc.power_survival_status === 'SURVIVED_WITH_MARGIN'
                                ? 'cyan'
                                : 'rose'
                            }
                            size="xs"
                          >
                            {sc.power_survival_status}
                          </Badge>
                        </td>

                        {/* Suitability Score */}
                        <td className="py-3 px-4 text-right font-bold text-sm">
                          <span
                            className={
                              isBestScore
                                ? 'rounded bg-amber-500/15 text-amber-300 px-2 py-0.5 border border-amber-500/30'
                                : isWorstScore
                                ? 'text-slate-400'
                                : 'text-emerald-400'
                            }
                          >
                            {sc.overall_suitability_score}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* VIEW TAB 2: COMPARATIVE BAR CHARTS */}
          {activeViewTab === 'charts' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Chart 1: Illumination % vs Comm % vs Suitability */}
              <div className="rounded-2xl border border-luna-800 bg-luna-900/60 p-5 space-y-4">
                <h4 className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Solar Availability, DTE Coverage &amp; Overall Score
                </h4>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartCategories} margin={{ top: 10, right: 20, left: -10, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                      <XAxis dataKey="name" stroke="#64748B" tick={{ fontSize: 11 }} />
                      <YAxis stroke="#64748B" domain={[0, 100]} unit="%" tick={{ fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0B0F19', borderColor: '#222E4A', borderRadius: '8px' }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="illumination_percentage" name="Sunlight (%)" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="communication_percentage" name="Earth Comm (%)" fill="#06B6D4" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="overall_suitability_score" name="Suitability (/100)" fill="#10B981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 2: Minimum Battery SoC (%) with DoD Cutoff */}
              <div className="rounded-2xl border border-luna-800 bg-luna-900/60 p-5 space-y-4">
                <h4 className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Minimum Battery State-of-Charge &amp; DoD Reserve Limit
                </h4>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartCategories} margin={{ top: 10, right: 20, left: -10, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                      <XAxis dataKey="name" stroke="#64748B" tick={{ fontSize: 11 }} />
                      <YAxis stroke="#64748B" domain={[0, 100]} unit="%" tick={{ fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0B0F19', borderColor: '#222E4A', borderRadius: '8px' }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <ReferenceLine y={20} stroke="#EF4444" strokeDasharray="4 4" label={{ value: '20% DoD Cutoff', fill: '#EF4444', fontSize: 10 }} />
                      <Bar dataKey="min_battery_soc_percent" name="Min Battery SoC (%)" fill="#10B981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* VIEW TAB 3: SUNLIGHT & COMMUNICATION TIMELINES */}
          {activeViewTab === 'timelines' && (
            <div className="rounded-2xl border border-luna-800 bg-luna-900/60 p-5 space-y-5">
              <div>
                <h4 className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Synchronized Mission Sunlight &amp; Direct-to-Earth Line-of-Sight Strips
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Visual representation of illumination (amber = lit, dark = shadowed) and Earth link (cyan = link, dark = blackout).
                </p>
              </div>

              <div className="space-y-4">
                {evaluated.map((sc, idx) => (
                  <div key={sc.id} className="space-y-1.5 rounded-xl border border-luna-800 bg-luna-950 p-3">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="font-bold text-white flex items-center space-x-2">
                        <span className="text-cyan-400">#{sc.rank}</span>
                        <span>{sc.name}</span>
                      </span>
                      <span className="text-slate-400 text-[11px]">
                        Sunlight {sc.illumination_percentage}% &bull; Earth DTE {sc.communication_percentage}%
                      </span>
                    </div>

                    {/* Sunlight Strip */}
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-mono text-amber-400/90 flex items-center space-x-1">
                        <Sun className="h-3 w-3" />
                        <span>Illumination Profile:</span>
                      </span>
                      <div className="flex h-5 w-full overflow-hidden rounded bg-luna-900 border border-luna-800">
                        {sc.timeline &&
                          sc.timeline.map((pt, pIdx) => (
                            <div
                              key={pIdx}
                              className={`flex-1 transition-colors ${
                                pt.is_sunlit
                                  ? 'bg-amber-400 hover:bg-amber-300'
                                  : 'bg-luna-950 border-r border-luna-900 hover:bg-slate-800'
                              }`}
                              title={`${pt.hours_from_start}h MET: ${pt.is_sunlit ? 'SUNLIT' : 'SHADOW'}`}
                            />
                          ))}
                      </div>
                    </div>

                    {/* Communication Strip */}
                    <div className="space-y-0.5 pt-1">
                      <span className="text-[10px] font-mono text-cyan-400/90 flex items-center space-x-1">
                        <Radio className="h-3 w-3" />
                        <span>Earth Comm Visibility:</span>
                      </span>
                      <div className="flex h-5 w-full overflow-hidden rounded bg-luna-900 border border-luna-800">
                        {sc.timeline &&
                          sc.timeline.map((pt, pIdx) => (
                            <div
                              key={pIdx}
                              className={`flex-1 transition-colors ${
                                pt.is_earth_visible
                                  ? 'bg-cyan-500 hover:bg-cyan-400'
                                  : 'bg-luna-950 border-r border-luna-900 hover:bg-slate-800'
                              }`}
                              title={`${pt.hours_from_start}h MET: ${pt.is_earth_visible ? 'DTE VISIBLE' : 'BLACKOUT'}`}
                            />
                          ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* VIEW TAB 4: BATTERY STATE-OF-CHARGE CURVES */}
          {activeViewTab === 'battery' && (
            <div className="rounded-2xl border border-luna-800 bg-luna-900/60 p-5 space-y-4">
              <div>
                <h4 className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Synchronized Battery State-of-Charge (%) Over Mission Elapsed Time
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Overlaid battery discharge and charge cycles. The red dashed line denotes the 20% Depth-of-Discharge cutoff limit.
                </p>
              </div>

              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={mergedBatteryData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                    <XAxis
                      dataKey="hour"
                      stroke="#64748B"
                      unit="h"
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis
                      stroke="#64748B"
                      domain={[0, 100]}
                      unit="%"
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0B0F19', borderColor: '#222E4A', borderRadius: '8px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <ReferenceLine
                      y={20}
                      stroke="#EF4444"
                      strokeDasharray="4 4"
                      label={{ value: '20% DoD Cutoff', fill: '#EF4444', fontSize: 11 }}
                    />
                    {evaluated.map((sc, idx) => (
                      <Line
                        key={sc.id}
                        type="monotone"
                        dataKey={sc.name}
                        stroke={PALETTE[idx % PALETTE.length]}
                        strokeWidth={2}
                        dot={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* VIEW TAB 5: LEADERBOARD & RISKS */}
          {activeViewTab === 'rankings' && (
            <div className="space-y-4">
              {results.summary && (
                <div className="rounded-2xl border border-cyan-500/30 bg-cyan-950/20 p-5 space-y-3">
                  <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-cyan-300 flex items-center space-x-2">
                    <TrendingUp className="h-4 w-4" />
                    <span>Scientific Trade-Off Summary &amp; Decision Drivers</span>
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-300 font-mono">
                    {results.summary.key_findings.map((finding, idx) => (
                      <li key={idx} className="flex items-start space-x-2">
                        <span className="text-cyan-400 font-bold">&bull;</span>
                        <span>{finding}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {evaluated.map((sc) => (
                  <div
                    key={sc.id}
                    className="rounded-2xl border border-luna-800 bg-luna-900/60 p-5 space-y-4 shadow-lg"
                  >
                    <div className="flex items-center justify-between border-b border-luna-800 pb-3">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-xs font-bold text-amber-400">
                            RANK #{sc.rank}
                          </span>
                          <h4 className="font-mono text-sm font-bold text-white truncate max-w-[180px]">
                            {sc.name}
                          </h4>
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono">
                          Suitability: <strong className="text-emerald-400">{sc.overall_suitability_score}/100</strong>
                        </span>
                      </div>
                      <Badge
                        variant={
                          sc.power_survival_status === 'NOMINAL'
                            ? 'emerald'
                            : sc.power_survival_status === 'SURVIVED_WITH_MARGIN'
                            ? 'cyan'
                            : 'rose'
                        }
                        size="xs"
                      >
                        {sc.power_survival_status}
                      </Badge>
                    </div>

                    {/* Strengths */}
                    <div className="space-y-1.5 text-xs font-sans">
                      <span className="text-[11px] font-mono text-emerald-400 uppercase font-semibold flex items-center space-x-1">
                        <Check className="h-3.5 w-3.5" />
                        <span>Key Strengths:</span>
                      </span>
                      <ul className="space-y-1 text-slate-300 text-xs">
                        {sc.strengths.map((str, sIdx) => (
                          <li key={sIdx} className="flex items-start space-x-1.5">
                            <span className="text-emerald-400">&bull;</span>
                            <span>{str}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Risks */}
                    <div className="space-y-1.5 text-xs font-sans border-t border-luna-800/80 pt-3">
                      <span className="text-[11px] font-mono text-rose-400 uppercase font-semibold flex items-center space-x-1">
                        <ShieldAlert className="h-3.5 w-3.5" />
                        <span>Potential Hazards &amp; Limits:</span>
                      </span>
                      <ul className="space-y-1 text-slate-300 text-xs">
                        {sc.risks.map((risk, rIdx) => (
                          <li key={rIdx} className="flex items-start space-x-1.5">
                            <span className="text-rose-400">&bull;</span>
                            <span>{risk}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODALS */}
      <ScenarioConfigModal
        isOpen={isConfigModalOpen}
        scenario={editingScenario}
        sites={sites}
        onClose={() => setIsConfigModalOpen(false)}
        onSave={handleSaveScenario}
        onOpenCustomSiteModal={() => setIsCustomSiteModalOpen(true)}
      />

      <CustomSiteModal
        isOpen={isCustomSiteModalOpen}
        onClose={() => setIsCustomSiteModalOpen(false)}
        onSiteCreated={handleCustomSiteCreated}
      />
    </div>
  );
}
