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
  Activity,
  CheckCircle2,
  ShieldAlert,
  Sliders,
  Antenna,
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
import DataProvenanceBanner from '../common/DataProvenanceBanner';
import LoadingState from '../common/LoadingState';
import ErrorState from '../common/ErrorState';
import PolarRadarPlot from '../explorer/PolarRadarPlot';
import { formatPercent, formatHours, formatDateTime, formatDateShort } from '../../utils/formatters';

export default function EarthVisualization({
  communicationData,
  terrainHorizonData,
  loading,
  error,
  onRetry,
  onNavigateTab,
}) {
  const [chartView, setChartView] = useState('elevation'); // 'elevation' | 'linkbudget' | 'radar'
  const [showWindowsTable, setShowWindowsTable] = useState(false);

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
  const linkSummary = communicationData.link_budget_summary;
  const commWindows = communicationData.comm_windows || [];

  return (
    <div className="space-y-6">
      {/* 0. DATA PROVENANCE & ACCURACY BANNER */}
      <DataProvenanceBanner
        ephemerisSource={communicationData.ephemeris_source}
        terrainSource={communicationData.terrain_source}
        demResolutionM={communicationData.dem_resolution_m}
        calculationStatus={communicationData.calculation_status}
        dataQualityWarning={communicationData.data_quality_warning}
      />

      {/* 1. TOP TELEMETRY KPI METRICS */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard
          label="DTE Comm Availability"
          value={formatPercent(communicationData.communication_availability_percentage)}
          sublabel="Direct-to-Earth coverage"
          icon={Radio}
          status="earth"
        />
        <MetricCard
          label="Comm Windows"
          value={communicationData.num_comm_windows ?? commWindows.length}
          sublabel={`Longest: ${formatHours(communicationData.longest_continuous_comm_window_hours)}`}
          icon={Wifi}
          status="success"
        />
        <MetricCard
          label="Max Comm Blackout"
          value={formatHours(communicationData.longest_continuous_blackout_hours)}
          sublabel="Peak terrain / libration gap"
          icon={WifiOff}
          status={communicationData.longest_continuous_blackout_hours > 40 ? 'danger' : 'warning'}
        />
        <MetricCard
          label="Next Comm Window"
          value={
            communicationData.next_comm_window_hours_from_start !== null && communicationData.next_comm_window_hours_from_start !== undefined
              ? `T+${communicationData.next_comm_window_hours_from_start.toFixed(1)} h`
              : communicationData.communication_availability_percentage > 0
              ? 'At Start'
              : 'None'
          }
          sublabel={
            communicationData.next_comm_window_start
              ? formatDateTime(communicationData.next_comm_window_start)
              : 'Continuous or In Blackout'
          }
          icon={Clock}
          status="neutral"
        />
        <MetricCard
          label="Total Visible Hours"
          value={formatHours(communicationData.total_visible_hours)}
          sublabel={`Blocked: ${formatHours(communicationData.total_blocked_hours)}`}
          icon={Signal}
          status="earth"
        />
        <MetricCard
          label="RF Link Feasibility"
          value={
            linkSummary
              ? linkSummary.is_link_feasible
                ? `PASS (+${((linkSummary.min_link_margin_db ?? linkSummary.link_margin_db ?? 0)).toFixed(1)} dB)`
                : `FAIL (${((linkSummary.min_link_margin_db ?? linkSummary.link_margin_db ?? 0)).toFixed(1)} dB)`
              : 'Geometric Only'
          }
          sublabel={linkSummary ? `Min Margin (Req ≥ 3.0 dB)` : 'Link budget unconfigured'}
          icon={Activity}
          status={linkSummary ? (linkSummary.is_link_feasible ? 'success' : 'danger') : 'neutral'}
        />
      </div>

      {/* RF LINK BUDGET TELEMETRY CARD */}
      {linkSummary && (
        <div className="rounded-2xl border border-cyan-500/30 bg-cyan-950/20 p-4 space-y-3 shadow-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-cyan-800/40">
            <div className="flex items-center space-x-2">
              <Signal className="h-4 w-4 text-cyan-400" />
              <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-cyan-300">
                DSN Direct-to-Earth (DTE) RF Link Budget Telemetry
              </h4>
            </div>
            <div className="flex items-center space-x-2">
              <span
                className={`rounded px-2 py-0.5 font-mono text-[11px] font-bold uppercase ${
                  linkSummary.is_link_feasible
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                }`}
              >
                {linkSummary.is_link_feasible ? 'Link Feasible (Margin ≥ 3.0 dB)' : 'Link Impaired (Insufficient Margin)'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 font-mono text-xs">
            <div className="bg-luna-950/70 p-2.5 rounded-xl border border-luna-800/80">
              <span className="text-[10px] text-slate-400 uppercase block">Tx Power</span>
              <span className="text-white font-bold">{linkSummary.tx_power_w ?? linkSummary.transmitter_power_w ?? 10} W</span>
            </div>
            <div className="bg-luna-950/70 p-2.5 rounded-xl border border-luna-800/80">
              <span className="text-[10px] text-slate-400 uppercase block">Carrier Freq</span>
              <span className="text-cyan-300 font-bold">{linkSummary.carrier_frequency_ghz ?? 8.45} GHz</span>
            </div>
            <div className="bg-luna-950/70 p-2.5 rounded-xl border border-luna-800/80">
              <span className="text-[10px] text-slate-400 uppercase block">Tx Gain</span>
              <span className="text-slate-200 font-bold">{linkSummary.tx_antenna_gain_dbi ?? 18} dBi</span>
            </div>
            <div className="bg-luna-950/70 p-2.5 rounded-xl border border-luna-800/80">
              <span className="text-[10px] text-slate-400 uppercase block">Rx Gain (DSN 34m)</span>
              <span className="text-slate-200 font-bold">{linkSummary.rx_antenna_gain_dbi ?? 68} dBi</span>
            </div>
            <div className="bg-luna-950/70 p-2.5 rounded-xl border border-luna-800/80">
              <span className="text-[10px] text-slate-400 uppercase block">Free Space Loss</span>
              <span className="text-amber-400 font-bold">-{(linkSummary.free_space_path_loss_db ?? 222.0).toFixed(1)} dB</span>
            </div>
            <div className="bg-luna-950/70 p-2.5 rounded-xl border border-luna-800/80">
              <span className="text-[10px] text-slate-400 uppercase block">Recv Eb/N0</span>
              <span className="text-cyan-400 font-bold">{(linkSummary.received_eb_n0_db ?? 0).toFixed(1)} dB</span>
            </div>
            <div className="bg-luna-950/70 p-2.5 rounded-xl border border-luna-800/80">
              <span className="text-[10px] text-slate-400 uppercase block">Req Eb/N0</span>
              <span className="text-slate-400 font-bold">{(linkSummary.required_eb_n0_db ?? 4.5).toFixed(1)} dB</span>
            </div>
            <div className="bg-luna-950/70 p-2.5 rounded-xl border border-luna-800/80">
              <span className="text-[10px] text-slate-400 uppercase block">Min Margin</span>
              <span
                className={`font-black ${
                  (linkSummary.min_link_margin_db ?? linkSummary.link_margin_db ?? 0) >= 3.0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                +{((linkSummary.min_link_margin_db ?? linkSummary.link_margin_db ?? 0)).toFixed(2)} dB
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 2. MAIN TELECOMMUNICATION PANEL */}
      <div className="rounded-2xl border border-luna-800 bg-luna-900/60 p-5 space-y-4 shadow-lg">
        {/* Header & Chart View Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-luna-800">
          <div>
            <h3 className="font-mono text-sm font-semibold uppercase tracking-wider text-cyan-400 flex items-center space-x-2">
              <Radio className="h-4 w-4" />
              <span>Direct-to-Earth (DTE) Elevation &amp; Libration Tracking</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Earth line-of-sight elevation accounting for lunar physical libration, antenna gimbal boundaries, and local LOLA topography
            </p>
          </div>

          <div className="flex items-center space-x-1 rounded-xl border border-luna-800 bg-luna-950 p-1 text-xs font-mono">
            {[
              { id: 'elevation', label: 'Elevation Angle (°)' },
              { id: 'linkbudget', label: 'Link Margin (dB)' },
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

          {onNavigateTab && (
            <button
              onClick={() => onNavigateTab('skyhorizon')}
              className="flex items-center space-x-1.5 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-mono text-cyan-300 hover:bg-cyan-500/20 transition-colors shadow-sm"
            >
              <span>Combined Sky Horizon</span>
              <Compass className="h-3.5 w-3.5" />
            </button>
          )}
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
                  <ReferenceLine y={0.5} stroke="#38BDF8" strokeDasharray="2 2" label="Min 0.5° Mask" />

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
                  else if (pt.link_status === 'OUTSIDE_ANTENNA_GIMBAL') bgColor = 'bg-yellow-500/80';
                  else if (pt.link_status === 'INSUFFICIENT_LINK_MARGIN') bgColor = 'bg-purple-500/80';
                  else if (!pt.is_earth_visible) bgColor = 'bg-slate-900';

                  return (
                    <div
                      key={i}
                      title={`${formatDateTime(pt.timestamp)}: ${pt.link_status}${
                        pt.link_margin_db !== undefined && pt.link_margin_db !== null ? ` (Margin: ${pt.link_margin_db.toFixed(1)} dB)` : ''
                      }`}
                      className={`h-full flex-1 ${bgColor}`}
                    />
                  );
                })}
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                <span>{formatDateShort(series[0]?.timestamp)}</span>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex items-center space-x-1">
                    <span className="h-2 w-2 rounded-sm bg-cyan-500 inline-block" />
                    <span>Feasible Link</span>
                  </span>
                  <span className="flex items-center space-x-1">
                    <span className="h-2 w-2 rounded-sm bg-purple-500 inline-block" />
                    <span>Low RF Margin</span>
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

        {/* VIEW B: LINK BUDGET MARGIN CHART */}
        {chartView === 'linkbudget' && (
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
                <YAxis stroke="#64748B" unit=" dB" domain={[-10, 20]} tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0B0F19', borderColor: '#222E4A', borderRadius: '8px' }}
                  labelFormatter={formatDateTime}
                  formatter={(val, name) => [`${Number(val).toFixed(2)} dB`, name]}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <ReferenceLine y={3.0} stroke="#10B981" strokeDasharray="3 3" label="Threshold +3.0 dB" />
                <ReferenceLine y={0.0} stroke="#EF4444" strokeDasharray="2 2" label="Threshold 0.0 dB" />
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

      {/* 3. DISCRETE COMMUNICATION WINDOWS TABLE */}
      {commWindows.length > 0 && (
        <div className="rounded-2xl border border-luna-800 bg-luna-900/60 p-5 space-y-3 shadow-lg">
          <div className="flex items-center justify-between pb-2 border-b border-luna-800">
            <div className="flex items-center space-x-2">
              <Wifi className="h-4 w-4 text-cyan-400" />
              <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-300">
                Scheduled Ground Station Passes &amp; Downlink Windows ({commWindows.length})
              </h3>
            </div>
            <button
              onClick={() => setShowWindowsTable(!showWindowsTable)}
              className="text-xs font-mono text-cyan-400 hover:text-cyan-300"
            >
              {showWindowsTable ? 'Collapse Table' : 'Expand Details'}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs text-slate-300">
              <thead className="border-b border-luna-800 text-[11px] text-slate-400 uppercase bg-luna-950/40">
                <tr>
                  <th className="py-2 px-3">Pass #</th>
                  <th className="py-2 px-3">Window Start (UTC)</th>
                  <th className="py-2 px-3">Window End (UTC)</th>
                  <th className="py-2 px-3">Duration</th>
                  <th className="py-2 px-3">Mean Elevation</th>
                  <th className="py-2 px-3">Mean Margin</th>
                  <th className="py-2 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-luna-800/60">
                {(showWindowsTable ? commWindows : commWindows.slice(0, 5)).map((win) => (
                  <tr key={win.window_id} className="hover:bg-luna-850/40 transition-colors">
                    <td className="py-2 px-3 text-cyan-400 font-bold">#{win.window_id}</td>
                    <td className="py-2 px-3">{formatDateTime(win.start_time)}</td>
                    <td className="py-2 px-3">{formatDateTime(win.end_time)}</td>
                    <td className="py-2 px-3 text-white font-semibold">{formatHours(win.duration_hours)}</td>
                    <td className="py-2 px-3">{(win.mean_earth_elevation_deg ?? win.mean_elevation_deg ?? 0).toFixed(2)}°</td>
                    <td className="py-2 px-3">
                      {win.mean_link_margin_db !== undefined && win.mean_link_margin_db !== null ? (
                        <span className={win.mean_link_margin_db >= 3.0 ? 'text-emerald-400' : 'text-amber-400'}>
                          +{win.mean_link_margin_db.toFixed(1)} dB
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-2 px-3">
                      <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-300 border border-emerald-500/30">
                        {win.is_link_feasible ? 'FEASIBLE' : 'MARGIN LOW'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!showWindowsTable && commWindows.length > 5 && (
            <p className="text-[11px] font-mono text-slate-500 text-center pt-1">
              Showing first 5 of {commWindows.length} windows. Click 'Expand Details' to inspect full pass list.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
