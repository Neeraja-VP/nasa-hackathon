import React, { useState } from 'react';
import {
  Sun,
  Clock,
  Compass,
  Zap,
  Mountain,
  Layers,
  Activity,
  AlertTriangle,
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

export default function SolarVisualization({
  illuminationData,
  terrainHorizonData,
  loading,
  error,
  onRetry,
  onNavigateTab,
}) {
  const [chartView, setChartView] = useState('elevation'); // 'elevation' | 'flux' | 'radar'

  if (loading) {
    return (
      <LoadingState
        title="Simulating Solar Illumination & Ray Tracing..."
        subtitle="Computing Moon-to-Sun vectors, topocentric solar elevation angles, and LOLA DEM terrain horizon cast shadows."
      />
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Solar Illumination Calculation Error"
        message={error}
        onRetry={onRetry}
      />
    );
  }

  if (!illuminationData || !illuminationData.time_series) {
    return (
      <div className="rounded-2xl border border-luna-800 bg-luna-900/60 p-10 text-center text-slate-500 font-mono text-xs">
        No solar illumination telemetry available for the current configuration.
      </div>
    );
  }

  const series = illuminationData.time_series;

  return (
    <div className="space-y-6">
      {/* 0. DATA PROVENANCE & ACCURACY BANNER */}
      <DataProvenanceBanner
        ephemerisSource={illuminationData.ephemeris_source}
        terrainSource={illuminationData.terrain_source}
        demResolutionM={illuminationData.dem_resolution_m}
        calculationStatus={illuminationData.calculation_status}
        dataQualityWarning={illuminationData.data_quality_warning}
      />

      {/* 1. TOP METRIC GAUGES */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Solar Illumination"
          value={formatPercent(illuminationData.illumination_percentage)}
          sublabel="Net sunlit fraction over mission"
          icon={Sun}
          status="solar"
        />
        <MetricCard
          label="Total Sunlit Hours"
          value={formatHours(illuminationData.total_sunlit_hours)}
          sublabel={`Out of ${(illuminationData.duration_days * 24).toFixed(0)} total mission hours`}
          icon={Clock}
          status="solar"
        />
        <MetricCard
          label="Max Continuous Shadow"
          value={formatHours(illuminationData.longest_continuous_shadow_hours)}
          sublabel="Battery survival blackout duration"
          icon={AlertTriangle}
          status={illuminationData.longest_continuous_shadow_hours > 48 ? 'danger' : 'warning'}
        />
        <MetricCard
          label="Longest Sunlight Window"
          value={formatHours(illuminationData.longest_continuous_sunlight_hours)}
          sublabel="Unbroken payload operations"
          icon={Zap}
          status="success"
        />
      </div>

      {/* 2. MAIN VISUALIZATION PANEL */}
      <div className="rounded-2xl border border-luna-800 bg-luna-900/60 p-5 space-y-4 shadow-lg">
        {/* Header & Chart View Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-luna-800">
          <div>
            <h3 className="font-mono text-sm font-semibold uppercase tracking-wider text-amber-400 flex items-center space-x-2">
              <Sun className="h-4 w-4" />
              <span>Solar Elevation &amp; Terrain Shadowing Engine</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Topocentric solar altitude relative to local LOLA digital elevation model (DEM) horizon
            </p>
          </div>

          <div className="flex items-center space-x-1 rounded-xl border border-luna-800 bg-luna-950 p-1 text-xs font-mono">
            {[
              { id: 'elevation', label: 'Elevation Angle (°)' },
              { id: 'flux', label: 'Solar Flux (W/m²)' },
              { id: 'radar', label: '360° Sky Radar' },
            ].map((view) => (
              <button
                key={view.id}
                onClick={() => setChartView(view.id)}
                className={`rounded-lg px-2.5 py-1 transition-all ${
                  chartView === view.id
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
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

        {/* VIEW A: SOLAR ELEVATION VS TERRAIN HORIZON MASK */}
        {chartView === 'elevation' && (
          <div className="space-y-4">
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series}>
                  <defs>
                    <linearGradient id="solarElevGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.0} />
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
                    domain={[-2.5, 4.0]}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0B0F19', borderColor: '#222E4A', borderRadius: '8px' }}
                    labelFormatter={formatDateTime}
                    formatter={(val, name) => [`${Number(val).toFixed(2)}°`, name]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <ReferenceLine y={0} stroke="#475569" strokeDasharray="2 2" label="Geometric 0° Horizon" />
                  
                  {/* Sun Elevation Line & Shading */}
                  <Area
                    type="monotone"
                    dataKey="sun_elevation_deg"
                    name="Sun Elevation (°)"
                    stroke="#F59E0B"
                    fill="url(#solarElevGradient)"
                    strokeWidth={2}
                  />

                  {/* LOLA DEM Terrain Horizon Obstruction Mask */}
                  <Line
                    type="stepAfter"
                    dataKey="terrain_horizon_elevation_deg"
                    name="Local LOLA Terrain Horizon (°)"
                    stroke="#EF4444"
                    strokeWidth={1.8}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Sunlit / Shadow Timeline Gantt Bar */}
            <div className="space-y-1.5 pt-2">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span>SUNLIT vs TERRAIN SHADOW TIMELINE</span>
                <span>{series.length} Epoch Steps</span>
              </div>
              <div className="flex h-5 w-full rounded-md overflow-hidden border border-luna-800 bg-luna-950">
                {series.map((pt, i) => (
                  <div
                    key={i}
                    title={`${formatDateTime(pt.timestamp)}: ${pt.is_sunlit_terrain ? 'SUNLIT' : 'SHADOW'}`}
                    className={`h-full flex-1 transition-opacity ${
                      pt.is_sunlit_terrain ? 'bg-amber-400/90' : 'bg-slate-900 border-r border-slate-950'
                    }`}
                  />
                ))}
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                <span>{formatDateShort(series[0]?.timestamp)}</span>
                <div className="flex items-center space-x-3">
                  <span className="flex items-center space-x-1">
                    <span className="h-2 w-2 rounded-sm bg-amber-400 inline-block" />
                    <span>Direct Sunlight</span>
                  </span>
                  <span className="flex items-center space-x-1">
                    <span className="h-2 w-2 rounded-sm bg-slate-900 border border-slate-700 inline-block" />
                    <span>Terrain Shadow</span>
                  </span>
                </div>
                <span>{formatDateShort(series[series.length - 1]?.timestamp)}</span>
              </div>
            </div>
          </div>
        )}

        {/* VIEW B: SOLAR FLUX (IRRADIANCE W/M²) */}
        {chartView === 'flux' && (
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
                <YAxis stroke="#64748B" unit=" W/m²" tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0B0F19', borderColor: '#222E4A', borderRadius: '8px' }}
                  labelFormatter={formatDateTime}
                  formatter={(val, name) => [`${Number(val).toFixed(1)} W/m²`, name]}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line
                  type="monotone"
                  dataKey="effective_flux_horizontal_w_m2"
                  name="Effective Horizontal Solar Flux (W/m²)"
                  stroke="#10B981"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="solar_flux_w_m2"
                  name="Total Solar Constant Flux (1361 W/m²)"
                  stroke="#F59E0B"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* VIEW C: 360° POLAR SKY RADAR */}
        {chartView === 'radar' && (
          <PolarRadarPlot
            terrainHorizonData={terrainHorizonData}
            illuminationData={illuminationData}
            maxElevationDeg={6.0}
          />
        )}
      </div>
    </div>
  );
}
