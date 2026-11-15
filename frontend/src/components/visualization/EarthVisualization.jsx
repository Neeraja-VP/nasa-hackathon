import React, { useState } from 'react';
import {
  Radio,
  Clock,
  Compass,
  Wifi,
  WifiOff,
  Signal,
  Mountain,
  AlertTriangle,
  Layers,
  ShieldAlert,
  Activity,
  Sliders,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import MetricCard from '../common/MetricCard';
import LoadingState from '../common/LoadingState';
import ErrorState from '../common/ErrorState';
import DataSourceBanner from '../common/DataSourceBanner';
import PolarRadarPlot from '../explorer/PolarRadarPlot';
import { formatPercent, formatHours, formatDateTime, formatDateShort } from '../../utils/formatters';

export default function EarthVisualization({
  communicationData,
  terrainHorizonData,
  loading,
  error,
  onRetry,
}) {
  const [chartView, setChartView] = useState('elevation'); // 'elevation' | 'link_margin' | 'radar'

  if (loading) {
    return (
      <LoadingState
        title="Calculating Earth Visibility & Libration Vectors..."
        subtitle="Computing topocentric lunar libration in latitude (±6.7°) and longitude (±7.9°), Direct-to-Earth line-of-sight, and terrain horizon clearance."
      />
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Earth Communication Calculation Error"
        message={error}
        onRetry={onRetry}
      />
    );
  }

  if (!communicationData || !communicationData.time_series) {
    return (
      <div className="rounded-2xl border border-luna-800 bg-luna-900/60 p-10 text-center text-slate-500 font-mono text-xs">
        No Earth communication telemetry available for the current configuration.
      </div>
    );
  }

  const series = communicationData.time_series;
  const windows = communicationData.communication_windows || [];
  const linkSummary = communicationData.link_budget_summary;

  return (
    <div className="space-y-6">
      {/* 0. DATA PROVENANCE & QUALITY TRANSPARENCY BANNER */}
      <DataSourceBanner
        ephemerisSource={communicationData.data_source}
        ephemerisType={communicationData.data_source_type}
        terrainSource={communicationData.terrain_data_source || terrainHorizonData?.terrain_data_source}
        demResolutionM={communicationData.dem_resolution_m || terrainHorizonData?.dem_resolution_m}
        isProceduralFallback={terrainHorizonData?.is_procedural_fallback}
        warningMessage={communicationData.data_quality_warning || terrainHorizonData?.data_quality_warning}
      />

      {/* 1. TOP TELEMETRY KPI METRICS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="DTE Geometric Visibility"
          value={formatPercent(communicationData.communication_availability_percentage)}
          sublabel="Line-of-Sight Earth clearance"
          icon={Radio}
          status="earth"
        />
        <MetricCard
          label="RF Link Feasibility"
          value={
            communicationData.rf_link_feasible_percentage != null
              ? formatPercent(communicationData.rf_link_feasible_percentage)
              : formatPercent(communicationData.communication_availability_percentage)
          }
          sublabel="Antenna limit & margin compliant"
          icon={Signal}
          status="success"
        />
        <MetricCard
          label="Comm Windows Count"
          value={windows.length > 0 ? `${windows.length} Windows` : `${communicationData.num_communication_windows ?? 0} Windows`}
          sublabel={`Max Window: ${formatHours(communicationData.longest_continuous_comm_window_hours)}`}
          icon={Wifi}
          status="solar"
        />
        <MetricCard
          label="Max Comm Blackout"
          value={formatHours(communicationData.longest_continuous_blackout_hours)}
          sublabel="Terrain / libration occultation"
          icon={WifiOff}
          status={communicationData.longest_continuous_blackout_hours > 36 ? 'danger' : 'warning'}
        />
      </div>

      {/* Blackout Risk Warning Banner */}
      {communicationData.blackout_warning && (
        <div className="flex items-start space-x-3 rounded-xl border border-amber-500/50 bg-amber-950/30 p-4 text-xs font-mono text-amber-200 shadow-md">
          <ShieldAlert className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold uppercase block text-sm">COMMUNICATION BLACKOUT HAZARD</span>
            <p className="leading-relaxed">{communicationData.blackout_warning}</p>
          </div>
        </div>
      )}

      {/* Next Window Telemetry Callout */}
      {communicationData.next_window_start && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cyan-500/30 bg-cyan-950/20 px-4 py-3 text-xs font-mono">
          <div className="flex items-center space-x-2 text-cyan-300">
            <Calendar className="h-4 w-4 text-cyan-400" />
            <span className="font-bold uppercase">Next Available Downlink Window:</span>
            <span className="text-slate-200">{formatDateTime(communicationData.next_window_start)}</span>
          </div>
          {communicationData.next_window_duration_hours != null && (
            <div className="text-slate-400">
              Expected Duration: <span className="font-bold text-cyan-300">{communicationData.next_window_duration_hours.toFixed(1)} h</span>
            </div>
          )}
        </div>
      )}

      {/* 2. RF LINK BUDGET TELEMETRY STRIP */}
      {linkSummary && (
        <div className="rounded-2xl border border-luna-800 bg-luna-900/60 p-4 space-y-3 shadow-lg">
          <div className="flex items-center justify-between border-b border-luna-800/80 pb-2">
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-cyan-300 flex items-center space-x-1.5">
              <Signal className="h-3.5 w-3.5" />
              <span>RF Link Budget Telemetry (DSN X/S-Band Downlink)</span>
            </span>
            <span className="font-mono text-[11px] text-slate-400">
              Freq: {linkSummary.carrier_frequency_ghz.toFixed(2)} GHz | Tx: {linkSummary.tx_power_w} W ({linkSummary.tx_power_dbm.toFixed(1)} dBm)
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs font-mono">
            <div className="rounded-lg bg-luna-950/80 border border-luna-800 p-2.5">
              <span className="text-slate-400 block text-[10px]">Avg Lunar Distance</span>
              <span className="text-slate-200 font-bold">{linkSummary.earth_distance_km.toLocaleString()} km</span>
            </div>
            <div className="rounded-lg bg-luna-950/80 border border-luna-800 p-2.5">
              <span className="text-slate-400 block text-[10px]">Path Loss (FSPL)</span>
              <span className="text-slate-200 font-bold">{linkSummary.fspl_db.toFixed(1)} dB</span>
            </div>
            <div className="rounded-lg bg-luna-950/80 border border-luna-800 p-2.5">
              <span className="text-slate-400 block text-[10px]">Received Power (Prx)</span>
              <span className="text-slate-200 font-bold">{linkSummary.received_power_dbm.toFixed(1)} dBm</span>
            </div>
            <div className="rounded-lg bg-luna-950/80 border border-luna-800 p-2.5">
              <span className="text-slate-400 block text-[10px]">Receiver Threshold</span>
              <span className="text-slate-200 font-bold">{linkSummary.rx_sensitivity_dbm.toFixed(1)} dBm</span>
            </div>
            <div className="rounded-lg bg-luna-950/80 border border-luna-800 p-2.5">
              <span className="text-slate-400 block text-[10px]">Nominal Link Margin</span>
              <span className={`font-bold ${linkSummary.nominal_link_margin_db >= 3.0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {linkSummary.nominal_link_margin_db > 0 ? `+${linkSummary.nominal_link_margin_db.toFixed(1)}` : linkSummary.nominal_link_margin_db.toFixed(1)} dB
              </span>
            </div>
            <div className="rounded-lg bg-luna-950/80 border border-luna-800 p-2.5">
              <span className="text-slate-400 block text-[10px]">Antenna Pointing</span>
              <span className="text-slate-200 font-bold">0.5° – 85.0° Gimbal</span>
            </div>
          </div>
        </div>
      )}

      {/* 3. MAIN TELECOMMUNICATION PANEL */}
      <div className="rounded-2xl border border-luna-800 bg-luna-900/60 p-5 space-y-4 shadow-lg">
        {/* Header & Chart View Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-luna-800">
          <div>
            <h3 className="font-mono text-sm font-semibold uppercase tracking-wider text-cyan-400 flex items-center space-x-2">
              <Radio className="h-4 w-4" />
              <span>Direct-to-Earth (DTE) Elevation &amp; RF Link Performance</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Earth line-of-sight elevation accounting for lunar libration, LOLA DEM topography, and free-space RF link margin.
            </p>
          </div>

          <div className="flex items-center space-x-1 rounded-xl border border-luna-800 bg-luna-950 p-1 text-xs font-mono">
            {[
              { id: 'elevation', label: 'Elevation Angle (°)' },
              { id: 'link_margin', label: 'Link Margin (dB)' },
              { id: 'radar', label: '360° Sky Radar' },
            ].map((view) => (
              <button
                key={view.id}
                onClick={() => setChartView(view.id)}
                className={`rounded-lg px-2.5 py-1 transition-all ${
                  chartView === view.id
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {view.label}
              </button>
            ))}
          </div>
        </div>

        {/* VIEW A: ELEVATION CHART */}
        {chartView === 'elevation' && (
          <div className="space-y-4">
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series}>
                  <defs>
                    <linearGradient id="earthCommGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#06B6D4" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                  <XAxis
                    dataKey="timestamp"
                    stroke="#64748B"
                    tickFormatter={formatDateShort}
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis
                    stroke="#64748B"
                    unit="°"
                    tick={{ fontSize: 10 }}
                    domain={[-6, 12]}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0B0F19', borderColor: '#222E4A', borderRadius: '8px' }}
                    labelFormatter={formatDateTime}
                    formatter={(val, name) => [`${Number(val).toFixed(2)}°`, name]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <ReferenceLine y={0.5} stroke="#38BDF8" strokeDasharray="2 2" label="Min 0.5° DTE Threshold" />

                  {/* Earth Elevation Line & Fill */}
                  <Area
                    type="monotone"
                    dataKey="earth_elevation_deg"
                    name="Earth Elevation (°)"
                    stroke="#06B6D4"
                    fill="url(#earthCommGradient)"
                    strokeWidth={2}
                  />

                  {/* Terrain Obstruction Mask */}
                  <Line
                    type="stepAfter"
                    dataKey="terrain_horizon_elevation_deg"
                    name="Local Terrain Horizon Mask (°)"
                    stroke="#EF4444"
                    strokeWidth={1.8}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* DTE Link Status Timeline Bar */}
            <div className="space-y-1.5 pt-2">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span>DTE LINK STATUS TIMELINE</span>
                <span>{series.length} Epoch Steps</span>
              </div>
              <div className="flex h-5 w-full rounded-md overflow-hidden border border-luna-800 bg-luna-950">
                {series.map((pt, i) => {
                  let bgColor = 'bg-cyan-500/90';
                  if (pt.link_status === 'TERRAIN_BLOCKED') bgColor = 'bg-rose-500/80';
                  else if (pt.link_status === 'BELOW_MIN_ELEVATION') bgColor = 'bg-amber-500/80';
                  else if (pt.link_status === 'POINTING_LIMIT_EXCEEDED') bgColor = 'bg-purple-500/80';
                  else if (pt.link_status === 'INSUFFICIENT_MARGIN') bgColor = 'bg-orange-500/80';
                  else if (!pt.is_earth_visible) bgColor = 'bg-slate-900';

                  return (
                    <div
                      key={i}
                      title={`${formatDateTime(pt.timestamp)}: ${pt.link_status || (pt.is_earth_visible ? 'VISIBLE' : 'BLOCKED')}`}
                      className={`h-full flex-1 ${bgColor}`}
                    />
                  );
                })}
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                <span>{formatDateShort(series[0]?.timestamp)}</span>
                <div className="flex items-center space-x-3">
                  <span className="flex items-center space-x-1">
                    <span className="h-2 w-2 rounded-sm bg-cyan-500 inline-block" />
                    <span>Direct LOS</span>
                  </span>
                  <span className="flex items-center space-x-1">
                    <span className="h-2 w-2 rounded-sm bg-rose-500 inline-block" />
                    <span>Terrain Blocked</span>
                  </span>
                  <span className="flex items-center space-x-1">
                    <span className="h-2 w-2 rounded-sm bg-amber-500 inline-block" />
                    <span>Below Min Elev</span>
                  </span>
                </div>
                <span>{formatDateShort(series[series.length - 1]?.timestamp)}</span>
              </div>
            </div>
          </div>
        )}

        {/* VIEW B: LINK MARGIN CHART */}
        {chartView === 'link_margin' && (
          <div className="space-y-4">
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
                  <YAxis
                    stroke="#64748B"
                    unit=" dB"
                    tick={{ fontSize: 10 }}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0B0F19', borderColor: '#222E4A', borderRadius: '8px' }}
                    labelFormatter={formatDateTime}
                    formatter={(val, name) => [`${Number(val).toFixed(2)} dB`, name]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <ReferenceLine y={3.0} stroke="#10B981" strokeDasharray="3 3" label="Required Margin (3.0 dB)" />
                  <ReferenceLine y={0.0} stroke="#EF4444" label="Link Threshold (0 dB)" />
                  <Line
                    type="monotone"
                    dataKey="link_margin_db"
                    name="RF Link Margin (dB)"
                    stroke="#06B6D4"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* VIEW C: 360° SKY RADAR */}
        {chartView === 'radar' && (
          <PolarRadarPlot
            terrainHorizonData={terrainHorizonData}
            communicationData={communicationData}
            maxElevationDeg={10.0}
          />
        )}
      </div>

      {/* 4. DISCRETE COMMUNICATION WINDOWS TABLE */}
      {windows.length > 0 && (
        <div className="rounded-2xl border border-luna-800 bg-luna-900/60 p-5 space-y-3 shadow-lg">
          <div className="flex items-center justify-between border-b border-luna-800 pb-2">
            <h4 className="font-mono text-xs font-semibold uppercase tracking-wider text-cyan-300 flex items-center space-x-2">
              <Wifi className="h-4 w-4" />
              <span>Contiguous Direct-to-Earth Communication Windows ({windows.length})</span>
            </h4>
            <span className="font-mono text-[11px] text-slate-400">
              Total Visible: {formatHours(communicationData.total_visible_hours)}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-luna-800 text-slate-400">
                  <th className="py-2 px-3">#</th>
                  <th className="py-2 px-3">Window Start</th>
                  <th className="py-2 px-3">Window End</th>
                  <th className="py-2 px-3">Duration (h)</th>
                  <th className="py-2 px-3">Peak Elevation</th>
                  <th className="py-2 px-3">Avg Margin</th>
                  <th className="py-2 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-luna-800/60 text-slate-300">
                {windows.map((win, idx) => (
                  <tr key={idx} className="hover:bg-luna-950/40">
                    <td className="py-2 px-3 text-cyan-400 font-bold">{idx + 1}</td>
                    <td className="py-2 px-3">{formatDateTime(win.start_time)}</td>
                    <td className="py-2 px-3">{formatDateTime(win.end_time)}</td>
                    <td className="py-2 px-3 font-semibold text-slate-100">{win.duration_hours.toFixed(1)} h</td>
                    <td className="py-2 px-3">+{win.max_elevation_deg.toFixed(2)}°</td>
                    <td className="py-2 px-3">
                      {win.avg_link_margin_db != null ? `+${win.avg_link_margin_db.toFixed(1)} dB` : '—'}
                    </td>
                    <td className="py-2 px-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        NOMINAL DTE
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}