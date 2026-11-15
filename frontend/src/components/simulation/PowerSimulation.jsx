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
  Compass,
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
import LoadingState from '../common/LoadingState';
import ErrorState from '../common/ErrorState';
import {
  formatPercent,
  formatPowerW,
  formatEnergyKWh,
  formatDateTime,
  formatDateShort,
} from '../../utils/formatters';

export default function PowerSimulation({
  currentSite,
  missionConfig,
}) {
  const [simConfig, setSimConfig] = useState(DEFAULT_SIMULATION_CONFIG);
  const [simulationData, setSimulationData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeChart, setActiveChart] = useState('soc'); // 'soc' | 'power' | 'angles'

  const handleRunSimulation = async () => {
    if (!currentSite) return;
    setLoading(true);
    setError(null);

    try {
      const res = await simulateMission({
        site_id: currentSite.id,
        start_date: new Date(missionConfig.startDate).toISOString(),
        duration_days: Number(missionConfig.durationDays),
        step_hours: Number(missionConfig.stepHours),
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
  }, [currentSite?.id, missionConfig.startDate, missionConfig.durationDays]);

  const applyPreset = (key) => {
    const p = SIMULATION_PRESETS[key];
    if (p) {
      const { name, ...cfg } = p;
      setSimConfig((prev) => ({ ...prev, ...cfg }));
    }
  };

  const series = simulationData?.time_series || [];

  return (
    <div className="space-y-6">
      {/* 1. TOP TELEMETRY KPI METRICS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Min Battery SoC"
          value={simulationData ? formatPercent(simulationData.min_battery_soc_percent) : '—'}
          sublabel={
            simulationData?.battery_depleted
              ? 'CRITICAL: BATTERY DEPLETED'
              : `Safety margin: +${(simulationData?.min_battery_soc_percent - simConfig.min_safe_soc_percent).toFixed(1)}%`
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
          label="Solar Generation"
          value={simulationData ? formatEnergyKWh(simulationData.total_energy_generated_kwh) : '—'}
          sublabel="Total solar array yield"
          icon={Sun}
          status="solar"
        />
        <MetricCard
          label="Total Consumption"
          value={simulationData ? formatEnergyKWh(simulationData.total_energy_consumed_kwh) : '—'}
          sublabel="Hotel + payload + survival heaters"
          icon={Zap}
          status="neutral"
        />
        <MetricCard
          label="Net Energy Balance"
          value={simulationData ? formatEnergyKWh(simulationData.net_energy_balance_kwh) : '—'}
          sublabel={simulationData?.net_energy_balance_kwh >= 0 ? 'Net positive energy' : 'Net deficit balance'}
          icon={Activity}
          status={simulationData?.net_energy_balance_kwh >= 0 ? 'success' : 'danger'}
        />
      </div>

      {/* Secondary Telemetry Strip */}
      {simulationData && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
          <div className="rounded-xl border border-luna-800 bg-luna-900/40 p-3">
            <span className="text-slate-400 block text-[11px]">Final Battery SoC</span>
            <span className="text-sm font-bold text-slate-100">
              {formatPercent(simulationData.current_battery_soc_percent ?? simulationData.min_battery_soc_percent)}
            </span>
          </div>
          <div className="rounded-xl border border-luna-800 bg-luna-900/40 p-3">
            <span className="text-slate-400 block text-[11px]">Max Darkness Duration</span>
            <span className="text-sm font-bold text-slate-100">
              {simulationData.max_continuous_darkness_hours != null
                ? `${simulationData.max_continuous_darkness_hours.toFixed(1)} h`
                : '—'}
            </span>
          </div>
          <div className="rounded-xl border border-luna-800 bg-luna-900/40 p-3">
            <span className="text-slate-400 block text-[11px]">Survival Duration</span>
            <span className="text-sm font-bold text-slate-100">
              {simulationData.estimated_survival_duration_hours != null
                ? `${simulationData.estimated_survival_duration_hours.toFixed(1)} h`
                : 'Full Mission'}
            </span>
          </div>
          <div className="rounded-xl border border-luna-800 bg-luna-900/40 p-3">
            <span className="text-slate-400 block text-[11px]">Survival Status</span>
            <span
              className={`text-sm font-bold ${
                simulationData.battery_depleted
                  ? 'text-rose-400'
                  : simulationData.is_below_safe_soc
                  ? 'text-amber-400'
                  : 'text-emerald-400'
              }`}
            >
              {simulationData.battery_depleted
                ? 'DEPLETED'
                : simulationData.is_below_safe_soc
                ? 'SHORTAGE RISK'
                : 'SURVIVES NOMINAL'}
            </span>
          </div>
        </div>
      )}

      {/* Power Shortage & Depletion Warning Banners */}
      {simulationData && simulationData.shortage_warning && (
        <div
          className={`flex items-start space-x-3 rounded-xl border p-4 text-xs font-mono shadow-md ${
            simulationData.battery_depleted
              ? 'border-rose-500/50 bg-rose-950/40 text-rose-200'
              : 'border-amber-500/50 bg-amber-950/30 text-amber-200'
          }`}
        >
          <ShieldAlert
            className={`h-5 w-5 shrink-0 mt-0.5 ${
              simulationData.battery_depleted ? 'text-rose-400' : 'text-amber-400'
            }`}
          />
          <div className="space-y-1">
            <span className="font-bold uppercase block text-sm">
              {simulationData.battery_depleted
                ? 'CRITICAL EPS SHORTAGE: BATTERY DEPLETED'
                : 'POWER SHORTAGE ADVISORY'}
            </span>
            <p className="leading-relaxed">{simulationData.shortage_warning}</p>
          </div>
        </div>
      )}

      {/* Engineering Model Assumptions Banner */}
      <div className="flex items-start space-x-3 rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-3.5 text-xs font-mono text-cyan-200/90">
        <Info className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <span className="font-semibold uppercase tracking-wider text-[11px] text-cyan-300">
            Physical Model Assumptions &amp; Engineering Limitations
          </span>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Solar output modeled via 3D vector cosine incidence angle: P = S0 · A · η · max(0, cos θ_inc) · η_dust · η_thermal. Battery charging/discharging applies C-rate limits and dual-path efficiencies. Note: An isothermal battery cell environment is assumed nominal; flight-qualification cryogenic thermal modeling is required for extended shadow survival.
          </p>
        </div>
      </div>

      {/* 2. SIMULATION CONTROLS & ARCHITECTURE PRESETS */}
      <div className="rounded-2xl border border-luna-800 bg-luna-900/60 p-5 space-y-4 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-luna-800">
          <div>
            <h3 className="font-mono text-sm font-semibold uppercase tracking-wider text-amber-400 flex items-center space-x-2">
              <Zap className="h-4 w-4" />
              <span>Lander Electrical Power System (EPS) Parameters</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Simulate solar array harvest, 3D panel incidence angle, battery state-of-charge, and nighttime survival heating.
            </p>
          </div>

          <button
            onClick={handleRunSimulation}
            disabled={loading}
            className="flex items-center space-x-1.5 rounded-lg border border-amber-500/40 bg-amber-500/20 px-3.5 py-1.5 font-mono text-xs font-semibold text-amber-300 hover:bg-amber-500/30 transition-all shadow-sm disabled:opacity-50"
          >
            <Activity className="h-3.5 w-3.5" />
            <span>{loading ? 'SIMULATING...' : 'RUN EPS SIMULATION'}</span>
          </button>
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

        {/* Parameter Inputs Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono pt-2">
          {/* Solar Array Sizing */}
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
            <label className="text-slate-400 block mb-1">Cell Efficiency</label>
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
            <label className="text-slate-400 block mb-1">Tracking Type</label>
            <select
              value={simConfig.solar_tracking_type}
              onChange={(e) => setSimConfig({ ...simConfig, solar_tracking_type: e.target.value })}
              className="w-full rounded bg-luna-950 border border-luna-700 px-2 py-1.5 text-slate-200"
            >
              <option value="VERTICAL_AZIMUTH_TRACKING">Vertical Azimuth Tracking</option>
              <option value="FIXED_VERTICAL">Fixed Vertical Panel</option>
              <option value="HORIZONTAL_FLAT">Horizontal Flat Panel</option>
            </select>
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Panel Tilt (0°=flat, 90°=vert)</label>
            <input
              type="number"
              min="0"
              max="90"
              step="5"
              value={simConfig.panel_tilt_deg ?? 90.0}
              onChange={(e) => setSimConfig({ ...simConfig, panel_tilt_deg: Number(e.target.value) })}
              className="w-full rounded bg-luna-950 border border-luna-700 px-2.5 py-1.5 text-slate-200"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Panel Azimuth (°)</label>
            <input
              type="number"
              min="0"
              max="360"
              step="15"
              value={simConfig.panel_azimuth_deg ?? 0.0}
              onChange={(e) => setSimConfig({ ...simConfig, panel_azimuth_deg: Number(e.target.value) })}
              className="w-full rounded bg-luna-950 border border-luna-700 px-2.5 py-1.5 text-slate-200"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Dust Derate Factor</label>
            <input
              type="number"
              min="0.5"
              max="1.0"
              step="0.05"
              value={simConfig.dust_degradation_factor ?? 0.95}
              onChange={(e) => setSimConfig({ ...simConfig, dust_degradation_factor: Number(e.target.value) })}
              className="w-full rounded bg-luna-950 border border-luna-700 px-2.5 py-1.5 text-slate-200"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Thermal Derate Factor</label>
            <input
              type="number"
              min="0.5"
              max="1.0"
              step="0.05"
              value={simConfig.temperature_derate_factor ?? 0.90}
              onChange={(e) => setSimConfig({ ...simConfig, temperature_derate_factor: Number(e.target.value) })}
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
            <label className="text-slate-400 block mb-1">Min Safe SoC (%)</label>
            <input
              type="number"
              min="5"
              max="50"
              value={simConfig.min_safe_soc_percent}
              onChange={(e) => setSimConfig({ ...simConfig, min_safe_soc_percent: Number(e.target.value) })}
              className="w-full rounded bg-luna-950 border border-luna-700 px-2.5 py-1.5 text-slate-200"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Charge Efficiency (η)</label>
            <input
              type="number"
              min="0.70"
              max="1.00"
              step="0.02"
              value={simConfig.charging_efficiency ?? 0.92}
              onChange={(e) => setSimConfig({ ...simConfig, charging_efficiency: Number(e.target.value) })}
              className="w-full rounded bg-luna-950 border border-luna-700 px-2.5 py-1.5 text-slate-200"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Discharge Efficiency (η)</label>
            <input
              type="number"
              min="0.70"
              max="1.00"
              step="0.02"
              value={simConfig.discharging_efficiency ?? 0.94}
              onChange={(e) => setSimConfig({ ...simConfig, discharging_efficiency: Number(e.target.value) })}
              className="w-full rounded bg-luna-950 border border-luna-700 px-2.5 py-1.5 text-slate-200"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Max Charge C-Rate</label>
            <input
              type="number"
              min="0.1"
              max="2.0"
              step="0.1"
              value={simConfig.max_charge_c_rate ?? 0.5}
              onChange={(e) => setSimConfig({ ...simConfig, max_charge_c_rate: Number(e.target.value) })}
              className="w-full rounded bg-luna-950 border border-luna-700 px-2.5 py-1.5 text-slate-200"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Hotel Load (W)</label>
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
            <label className="text-slate-400 block mb-1">Heater Load (W)</label>
            <input
              type="number"
              min="0"
              max="1000"
              value={simConfig.survival_heater_load_w}
              onChange={(e) => setSimConfig({ ...simConfig, survival_heater_load_w: Number(e.target.value) })}
              className="w-full rounded bg-luna-950 border border-luna-700 px-2.5 py-1.5 text-slate-200"
            />
          </div>
        </div>
      </div>

      {loading && (
        <LoadingState
          title="Simulating Battery State-of-Charge Dynamics..."
          subtitle="Iterating electrical energy storage differential equations with C-rate constraints and 3D incidence derating."
        />
      )}

      {error && <ErrorState title="Simulation Failed" message={error} onRetry={handleRunSimulation} />}

      {/* 3. SIMULATION CHARTS */}
      {!loading && !error && series.length > 0 && (
        <div className="rounded-2xl border border-luna-800 bg-luna-900/60 p-5 space-y-4 shadow-lg">
          <div className="flex items-center justify-between pb-2 border-b border-luna-800">
            <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-300">
              Energy Storage &amp; Power Generation Curves
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
                Power Flows (W)
              </button>
              <button
                onClick={() => setActiveChart('angles')}
                className={`rounded-lg px-2.5 py-1 transition-all ${
                  activeChart === 'angles'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Solar Geometry (°)
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
                    label={`Safe Threshold ${simConfig.min_safe_soc_percent}%`}
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

          {/* CHART 2: POWER GENERATION VS ELECTRICAL LOAD */}
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
                    dataKey="battery_charge_w"
                    name="Battery Charge Rate (W)"
                    stroke="#10B981"
                    strokeWidth={1.5}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="battery_discharge_w"
                    name="Battery Discharge Rate (W)"
                    stroke="#F43F5E"
                    strokeWidth={1.5}
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
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* CHART 3: SOLAR INCIDENCE & ELEVATION GEOMETRY */}
          {activeChart === 'angles' && (
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
                  <YAxis stroke="#64748B" unit="°" tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0B0F19', borderColor: '#222E4A', borderRadius: '8px' }}
                    labelFormatter={formatDateTime}
                    formatter={(val, name) => [`${Number(val).toFixed(2)}°`, name]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <ReferenceLine y={0} stroke="#64748B" />
                  <Line
                    type="monotone"
                    dataKey="sun_elevation_deg"
                    name="Solar Elevation Angle (°)"
                    stroke="#F59E0B"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="solar_incidence_angle_deg"
                    name="Solar Incidence Angle θ_inc (°)"
                    stroke="#38BDF8"
                    strokeWidth={2}
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