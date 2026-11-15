import React, { useState, useEffect } from 'react';
import {
  BatteryCharging,
  Zap,
  Sun,
  ShieldAlert,
  Sliders,
  RotateCcw,
  Activity,
  Layers,
  Flame,
  CheckCircle2,
  AlertTriangle,
  Info,
  Clock,
  Compass,
  Gauge,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import { simulateMission } from '../../services/api';
import {
  DEFAULT_SIMULATION_CONFIG,
  SIMULATION_PRESETS,
} from '../../utils/constants';
import MetricCard from '../common/MetricCard';
import DataProvenanceBanner from '../common/DataProvenanceBanner';
import LoadingState from '../common/LoadingState';
import ErrorState from '../common/ErrorState';
import {
  formatPercent,
  formatPowerW,
  formatEnergyKWh,
  formatDateTime,
  formatDateShort,
  formatHours,
  toUtcIsoString,
} from '../../utils/formatters';

export default function PowerSimulation({
  currentSite,
  missionConfig = {},
}) {
  const [simConfig, setSimConfig] = useState(DEFAULT_SIMULATION_CONFIG);
  const [simulationData, setSimulationData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeChart, setActiveChart] = useState('soc'); // 'soc' | 'power' | 'incidence'
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleRunSimulation = async () => {
    if (!currentSite) return;
    setLoading(true);
    setError(null);

    try {
      const res = await simulateMission({
        site_id: currentSite.id,
        start_date: toUtcIsoString(missionConfig?.startDate),
        duration_days: Number(missionConfig?.durationDays || 14.0),
        step_hours: Number(missionConfig?.stepHours || 2.0),
        use_live_horizons: Boolean(missionConfig?.useLiveHorizons ?? true),
        ...simConfig,
      });
      setSimulationData(res);
    } catch (err) {
      console.error('Failed to run mission EPS simulation:', err);
      setError(err.response?.data?.error?.message || err.message || 'Mission energy simulation failed.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentSite) {
      handleRunSimulation();
    }
  }, [
    currentSite?.id,
    missionConfig?.startDate,
    missionConfig?.durationDays,
    missionConfig?.stepHours,
    missionConfig?.useLiveHorizons,
  ]);

  const applyPreset = (key) => {
    const p = SIMULATION_PRESETS[key];
    if (p) {
      const { name, ...cfg } = p;
      setSimConfig((prev) => ({
        ...prev,
        ...cfg,
      }));
    }
  };

  const series = simulationData?.time_series || [];

  return (
    <div className="space-y-6">
      {/* 0. DATA PROVENANCE & ACCURACY BANNER */}
      {simulationData && (
        <DataProvenanceBanner
          ephemerisSource={simulationData.ephemeris_source}
          terrainSource={simulationData.terrain_source}
          demResolutionM={simulationData.dem_resolution_m}
          calculationStatus={simulationData.calculation_status}
          dataQualityWarning={simulationData.data_quality_warning}
        />
      )}

      {/* 1. TOP TELEMETRY KPI METRICS */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard
          label="Min Battery SoC"
          value={simulationData ? formatPercent(simulationData.min_battery_soc_percent) : '—'}
          sublabel={
            simulationData?.battery_depleted
              ? 'CRITICAL DEPLETION'
              : `Margin: +${(simulationData?.min_battery_soc_percent - simConfig.min_safe_soc_percent).toFixed(1)}%`
          }
          icon={BatteryCharging}
          status={
            simulationData?.battery_depleted
              ? 'danger'
              : simulationData?.min_battery_soc_percent < simConfig.min_safe_soc_percent
              ? 'warning'
              : 'success'
          }
        />
        <MetricCard
          label="Survival Duration"
          value={
            simulationData
              ? simulationData.estimated_survival_duration_hours !== null && simulationData.estimated_survival_duration_hours !== undefined
                ? `${Number(simulationData.estimated_survival_duration_hours).toFixed(0)} h`
                : `${((missionConfig?.durationDays || 14) * 24).toFixed(0)} h (Full)`
              : '—'
          }
          sublabel={
            simulationData?.battery_depleted
              ? 'Mission Depletion Cutoff'
              : 'Nominal Mission Life'
          }
          icon={Clock}
          status={simulationData?.battery_depleted ? 'danger' : 'success'}
        />
        <MetricCard
          label="Max Continuous Shadow"
          value={simulationData ? `${(simulationData.max_continuous_darkness_hours || 0).toFixed(0)} h` : '—'}
          sublabel="Peak consecutive darkness"
          icon={Flame}
          status={simulationData?.max_continuous_darkness_hours > 36 ? 'warning' : 'neutral'}
        />
        <MetricCard
          label="Solar Generation"
          value={simulationData ? formatEnergyKWh(simulationData.total_energy_generated_kwh) : '—'}
          sublabel="Total solar array yield"
          icon={Sun}
          status="solar"
        />
        <MetricCard
          label="Total Consumption"
          value={simulationData ? formatEnergyKWh(simulationData.total_energy_consumed_kwh) : '—'}
          sublabel="Avionics + payload + heaters"
          icon={Zap}
          status="neutral"
        />
        <MetricCard
          label="Net Energy Balance"
          value={simulationData ? formatEnergyKWh(simulationData.net_energy_balance_kwh) : '—'}
          sublabel={simulationData?.net_energy_balance_kwh >= 0 ? 'Surplus Reserve' : 'Deficit Draw'}
          icon={Activity}
          status={simulationData?.net_energy_balance_kwh >= 0 ? 'success' : 'danger'}
        />
      </div>

      {/* Engineering Warnings & Power Shortage Alerts */}
      {simulationData && simulationData.power_shortage_warnings && simulationData.power_shortage_warnings.length > 0 && (
        <div className="space-y-2">
          {simulationData.power_shortage_warnings.map((warn, idx) => {
            const isCritical = warn.includes('CRITICAL');
            return (
              <div
                key={idx}
                className={`flex items-center space-x-3 rounded-xl border p-3.5 text-xs font-mono shadow-md ${
                  isCritical
                    ? 'border-rose-500/50 bg-rose-950/30 text-rose-300'
                    : 'border-amber-500/40 bg-amber-950/20 text-amber-300'
                }`}
              >
                {isCritical ? (
                  <ShieldAlert className="h-5 w-5 text-rose-400 shrink-0" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
                )}
                <div>
                  <span className="font-bold uppercase block text-[11px] tracking-wide">
                    {isCritical ? 'MISSION CRITICAL POWER SHORTAGE' : 'OPERATIONAL POWER NOTICE'}
                  </span>
                  <span>{warn}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Battery Temperature Modeling Boundary Notice */}
      {simulationData && simulationData.battery_temperature_limitation && (
        <div className="flex items-start space-x-2.5 rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-3 text-[11px] font-mono text-cyan-300/90">
          <Info className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-cyan-200">Thermodynamic &amp; Electrochemical Envelope: </span>
            <span>{simulationData.battery_temperature_limitation}</span>
          </div>
        </div>
      )}

      {/* 2. SIMULATION CONTROLS & ARCHITECTURE PRESETS */}
      <div className="rounded-2xl border border-luna-800 bg-luna-900/60 p-5 space-y-4 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-luna-800">
          <div>
            <h3 className="font-mono text-sm font-semibold uppercase tracking-wider text-amber-400 flex items-center space-x-2">
              <Zap className="h-4 w-4" />
              <span>Lander Electrical Power System (EPS) Configuration</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Simulate 3D vector solar incidence, panel tracking, and electrochemical battery charge-discharge dynamics.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center space-x-1 rounded-lg border border-luna-700 bg-luna-850 px-2.5 py-1.5 font-mono text-xs text-slate-300 hover:text-white transition-colors"
            >
              <span>{showAdvanced ? 'Hide Advanced' : 'Advanced Parameters'}</span>
              {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={handleRunSimulation}
              disabled={loading}
              className="flex items-center space-x-1.5 rounded-lg border border-amber-500/40 bg-amber-500/20 px-3.5 py-1.5 font-mono text-xs font-semibold text-amber-300 hover:bg-amber-500/30 transition-all shadow-sm disabled:opacity-50"
            >
              <Activity className="h-3.5 w-3.5" />
              <span>{loading ? 'SIMULATING...' : 'RUN EPS SIMULATION'}</span>
            </button>
          </div>
        </div>

        {/* Architecture Presets */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-mono text-slate-400 uppercase">Architecture Presets:</span>
          <div className="flex flex-wrap gap-2">
            {Object.entries(SIMULATION_PRESETS).map(([k, p]) => (
              <button
                key={k}
                onClick={() => applyPreset(k)}
                className="rounded-lg border border-luna-800 bg-luna-950 px-2.5 py-1 text-xs font-mono text-slate-300 hover:border-amber-500/40 hover:text-amber-300 transition-colors"
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {/* Primary Parameter Inputs Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono pt-2">
          <div>
            <label className="text-slate-400 block mb-1">Solar Area (m²)</label>
            <input
              type="number"
              min="0.5"
              max="50"
              step="0.5"
              value={simConfig.solar_array_area_m2}
              onChange={(e) => setSimConfig({ ...simConfig, solar_array_area_m2: Number(e.target.value) })}
              className="w-full rounded bg-luna-950 border border-luna-700 px-2.5 py-1.5 text-slate-200"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Cell Efficiency (η)</label>
            <input
              type="number"
              min="0.10"
              max="0.45"
              step="0.01"
              value={simConfig.solar_efficiency}
              onChange={(e) => setSimConfig({ ...simConfig, solar_efficiency: Number(e.target.value) })}
              className="w-full rounded bg-luna-950 border border-luna-700 px-2.5 py-1.5 text-slate-200"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Battery (Wh)</label>
            <input
              type="number"
              min="500"
              max="50000"
              step="500"
              value={simConfig.battery_capacity_wh}
              onChange={(e) => setSimConfig({ ...simConfig, battery_capacity_wh: Number(e.target.value) })}
              className="w-full rounded bg-luna-950 border border-luna-700 px-2.5 py-1.5 text-slate-200"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Tracking Type</label>
            <select
              value={simConfig.solar_tracking_type}
              onChange={(e) => setSimConfig({ ...simConfig, solar_tracking_type: e.target.value })}
              className="w-full rounded bg-luna-950 border border-luna-700 px-2 py-1.5 text-slate-200"
            >
              <option value="VERTICAL_AZIMUTH_TRACKING">Vertical Azimuth Tracking (1-Axis)</option>
              <option value="DUAL_AXIS_TRACKING">Dual-Axis Sun Tracking (2-Axis)</option>
              <option value="TILTED_FIXED">Tilted Fixed Array</option>
              <option value="FIXED_VERTICAL">Fixed Vertical Array</option>
              <option value="HORIZONTAL_FLAT">Horizontal Flat Array</option>
              <option value="TILTED_OPTIMAL">Sun-Facing Optimal Tilt</option>
            </select>
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Base Hotel Load (W)</label>
            <input
              type="number"
              min="10"
              max="1000"
              value={simConfig.base_hotel_load_w}
              onChange={(e) => setSimConfig({ ...simConfig, base_hotel_load_w: Number(e.target.value) })}
              className="w-full rounded bg-luna-950 border border-luna-700 px-2.5 py-1.5 text-slate-200"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Payload Load (W)</label>
            <input
              type="number"
              min="0"
              max="1000"
              value={simConfig.payload_active_load_w}
              onChange={(e) => setSimConfig({ ...simConfig, payload_active_load_w: Number(e.target.value) })}
              className="w-full rounded bg-luna-950 border border-luna-700 px-2.5 py-1.5 text-slate-200"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Night Heater Load (W)</label>
            <input
              type="number"
              min="0"
              max="1000"
              value={simConfig.survival_heater_load_w}
              onChange={(e) => setSimConfig({ ...simConfig, survival_heater_load_w: Number(e.target.value) })}
              className="w-full rounded bg-luna-950 border border-luna-700 px-2.5 py-1.5 text-slate-200"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Min Safe DoD Cutoff (%)</label>
            <input
              type="number"
              min="5"
              max="50"
              value={simConfig.min_safe_soc_percent}
              onChange={(e) => setSimConfig({ ...simConfig, min_safe_soc_percent: Number(e.target.value) })}
              className="w-full rounded bg-luna-950 border border-luna-700 px-2.5 py-1.5 text-slate-200"
            />
          </div>
        </div>

        {/* Advanced Solar Geometry & Electrochemical Parameters */}
        {showAdvanced && (
          <div className="pt-3 border-t border-luna-800 space-y-2">
            <span className="text-[11px] font-mono text-amber-400 uppercase tracking-wide">
              Advanced Orientation, Degradation &amp; Electrochemical Limits:
            </span>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 text-xs font-mono">
              <div>
                <label className="text-slate-400 block mb-1">Panel Tilt (β °)</label>
                <input
                  type="number"
                  min="0"
                  max="90"
                  step="1"
                  value={simConfig.panel_tilt_deg ?? 90}
                  onChange={(e) => setSimConfig({ ...simConfig, panel_tilt_deg: Number(e.target.value) })}
                  className="w-full rounded bg-luna-950 border border-luna-700 px-2 py-1 text-slate-200"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Panel Azimuth (γ °)</label>
                <input
                  type="number"
                  min="0"
                  max="360"
                  step="1"
                  value={simConfig.panel_azimuth_deg ?? 0}
                  onChange={(e) => setSimConfig({ ...simConfig, panel_azimuth_deg: Number(e.target.value) })}
                  className="w-full rounded bg-luna-950 border border-luna-700 px-2 py-1 text-slate-200"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Dust Factor (f_dust)</label>
                <input
                  type="number"
                  min="0.7"
                  max="1.0"
                  step="0.01"
                  value={simConfig.dust_degradation_factor ?? 0.98}
                  onChange={(e) => setSimConfig({ ...simConfig, dust_degradation_factor: Number(e.target.value) })}
                  className="w-full rounded bg-luna-950 border border-luna-700 px-2 py-1 text-slate-200"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Wiring Loss (f_wire)</label>
                <input
                  type="number"
                  min="0.8"
                  max="1.0"
                  step="0.01"
                  value={simConfig.wiring_loss_factor ?? 0.97}
                  onChange={(e) => setSimConfig({ ...simConfig, wiring_loss_factor: Number(e.target.value) })}
                  className="w-full rounded bg-luna-950 border border-luna-700 px-2 py-1 text-slate-200"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Charge Eff (η_chg)</label>
                <input
                  type="number"
                  min="0.8"
                  max="0.99"
                  step="0.01"
                  value={simConfig.charging_efficiency ?? 0.94}
                  onChange={(e) => setSimConfig({ ...simConfig, charging_efficiency: Number(e.target.value) })}
                  className="w-full rounded bg-luna-950 border border-luna-700 px-2 py-1 text-slate-200"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Discharge Eff (η_dis)</label>
                <input
                  type="number"
                  min="0.8"
                  max="0.99"
                  step="0.01"
                  value={simConfig.discharging_efficiency ?? 0.95}
                  onChange={(e) => setSimConfig({ ...simConfig, discharging_efficiency: Number(e.target.value) })}
                  className="w-full rounded bg-luna-950 border border-luna-700 px-2 py-1 text-slate-200"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {loading && <LoadingState title="Simulating Battery State-of-Charge Dynamics..." subtitle="Iterating electrical energy storage differential equations across mission duration." />}

      {error && <ErrorState title="Simulation Failed" message={error} onRetry={handleRunSimulation} />}

      {/* 3. SIMULATION CHARTS */}
      {!loading && !error && series.length > 0 && (
        <div className="rounded-2xl border border-luna-800 bg-luna-900/60 p-5 space-y-4 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-luna-800">
            <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-300">
              Energy Storage, Generation &amp; Incidence Angle Telemetry
            </h3>

            <div className="flex items-center space-x-1 rounded-xl border border-luna-800 bg-luna-950 p-1 text-xs font-mono">
              <button
                onClick={() => setActiveChart('soc')}
                className={`rounded-lg px-2.5 py-1 transition-all ${
                  activeChart === 'soc'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Battery SoC (%)
              </button>
              <button
                onClick={() => setActiveChart('power')}
                className={`rounded-lg px-2.5 py-1 transition-all ${
                  activeChart === 'power'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Net Power &amp; Curtailment (W)
              </button>
              <button
                onClick={() => setActiveChart('incidence')}
                className={`rounded-lg px-2.5 py-1 transition-all ${
                  activeChart === 'incidence'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Solar Incidence (θ °)
              </button>
            </div>
          </div>

          {/* CHART 1: BATTERY STATE OF CHARGE */}
          {activeChart === 'soc' && (
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series}>
                  <defs>
                    <linearGradient id="socGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                  <XAxis
                    dataKey="timestamp"
                    stroke="#64748B"
                    tickFormatter={formatDateShort}
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis stroke="#64748B" unit="%" domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0B0F19', borderColor: '#222E4A', borderRadius: '8px' }}
                    labelFormatter={formatDateTime}
                    formatter={(val, name) => [`${Number(val).toFixed(1)}%`, name]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <ReferenceLine
                    y={simConfig.min_safe_soc_percent}
                    stroke="#EF4444"
                    strokeDasharray="3 3"
                    label={`Min Safe ${simConfig.min_safe_soc_percent}%`}
                  />
                  <Area
                    type="monotone"
                    dataKey="battery_soc_percent"
                    name="Battery State of Charge (%)"
                    stroke="#10B981"
                    fill="url(#socGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* CHART 2: SOLAR POWER VS ELECTRICAL LOAD & CURTAILMENT */}
          {activeChart === 'power' && (
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                  <XAxis
                    dataKey="timestamp"
                    stroke="#64748B"
                    tickFormatter={formatDateShort}
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis stroke="#64748B" unit=" W" tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0B0F19', borderColor: '#222E4A', borderRadius: '8px' }}
                    labelFormatter={formatDateTime}
                    formatter={(val, name) => [`${Number(val).toFixed(1)} W`, name]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <ReferenceLine y={0} stroke="#64748B" />
                  <Line
                    type="monotone"
                    dataKey="solar_generation_w"
                    name="Solar Generation (W)"
                    stroke="#F59E0B"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="total_load_w"
                    name="Total Electrical Load (W)"
                    stroke="#EF4444"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="net_power_w"
                    name="Net Power Margin (W)"
                    stroke="#06B6D4"
                    strokeWidth={1.5}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="curtailed_power_w"
                    name="Curtailed Excess Power (W)"
                    stroke="#A855F7"
                    strokeWidth={1}
                    strokeDasharray="2 2"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* CHART 3: SOLAR INCIDENCE ANGLE & ELEVATION */}
          {activeChart === 'incidence' && (
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                  <XAxis
                    dataKey="timestamp"
                    stroke="#64748B"
                    tickFormatter={formatDateShort}
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis stroke="#64748B" unit="°" domain={[0, 95]} tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0B0F19', borderColor: '#222E4A', borderRadius: '8px' }}
                    labelFormatter={formatDateTime}
                    formatter={(val, name) => [`${Number(val).toFixed(1)}°`, name]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <ReferenceLine y={90} stroke="#EF4444" strokeDasharray="3 3" label="Graze Limit 90°" />
                  <Line
                    type="monotone"
                    dataKey="solar_incidence_angle_deg"
                    name="Solar Incidence Angle (θ °)"
                    stroke="#38BDF8"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="sun_elevation_deg"
                    name="Solar Elevation Angle (°)"
                    stroke="#F59E0B"
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
