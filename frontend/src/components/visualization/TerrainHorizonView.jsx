import React, { useState } from 'react';
import {
  Mountain,
  Compass,
  Layers,
  Info,
  Maximize2,
  Minimize2,
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
import { formatAngle } from '../../utils/formatters';

export default function TerrainHorizonView({
  terrainData,
  loading,
  error,
  onRetry,
}) {
  const [activeTab, setActiveTab] = useState('elevation'); // 'elevation' | 'distance' | 'table'

  if (loading) {
    return (
      <LoadingState
        title="Generating LOLA DEM 360° Terrain Horizon Profile..."
        subtitle="Ray tracing 360 azimuth directions across NASA Lunar Orbiter Laser Altimeter digital elevation models."
      />
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Terrain Horizon Calculation Error"
        message={error}
        onRetry={onRetry}
      />
    );
  }

  if (!terrainData || !terrainData.horizon_points) {
    return (
      <div className="rounded-2xl border border-luna-800 bg-luna-900/60 p-10 text-center text-slate-500 font-mono text-xs">
        No terrain horizon mask available for the current location.
      </div>
    );
  }

  const points = terrainData.horizon_points;

  return (
    <div className="space-y-6">
      {/* 0. DATA PROVENANCE & QUALITY TRANSPARENCY BANNER */}
      <DataSourceBanner
        ephemerisSource="NASA LOLA GEODETIC TOPOCENTRIC DATUM"
        ephemerisType="NASA_LOLA_DATUM"
        terrainSource={terrainData.terrain_data_source}
        demResolutionM={terrainData.dem_resolution_m}
        isProceduralFallback={terrainData.is_procedural_fallback}
        warningMessage={terrainData.data_quality_warning}
      />

      {/* 1. TOP HORIZON STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Max Obstruction"
          value={formatAngle(terrainData.max_horizon_elevation_deg)}
          sublabel="Highest blocking terrain peak"
          icon={Mountain}
          status="danger"
        />
        <MetricCard
          label="Min Horizon"
          value={formatAngle(terrainData.min_horizon_elevation_deg)}
          sublabel="Lowest terrain depression"
          icon={Minimize2}
          status="success"
        />
        <MetricCard
          label="Average Horizon"
          value={formatAngle(terrainData.average_horizon_elevation_deg)}
          sublabel="Mean obstruction line"
          icon={Layers}
          status="neutral"
        />
        <MetricCard
          label="Observer Height"
          value={`${terrainData.observer_height_m}m`}
          sublabel="Mast phase center above ground"
          icon={Maximize2}
          status="earth"
        />
      </div>

      {/* 2. 360° PANORAMA CANVAS */}
      <div className="rounded-2xl border border-luna-800 bg-luna-900/60 p-5 space-y-4 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-luna-800">
          <div>
            <h3 className="font-mono text-sm font-semibold uppercase tracking-wider text-emerald-400 flex items-center space-x-2">
              <Mountain className="h-4 w-4" />
              <span>360° Local Terrain Horizon Profile (NASA LOLA DEM)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Topographic obstruction angle (alpha) as a function of azimuth from 0° (North) to 360°
            </p>
          </div>

          <div className="flex items-center space-x-1 rounded-xl border border-luna-800 bg-luna-950 p-1 text-xs font-mono">
            {[
              { id: 'elevation', label: 'Obstruction Angle (°)' },
              { id: 'distance', label: 'Blocking Distance (km)' },
              { id: 'table', label: 'Horizon Samples' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`rounded-lg px-2.5 py-1 transition-all ${
                  activeTab === t.id
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* VIEW 1: HORIZON ELEVATION CURVE */}
        {activeTab === 'elevation' && (
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={points}>
                <defs>
                  <linearGradient id="horizonGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis
                  dataKey="azimuth_deg"
                  stroke="#64748B"
                  unit="°"
                  tick={{ fontSize: 10 }}
                />
                <YAxis
                  stroke="#64748B"
                  unit="°"
                  tick={{ fontSize: 10 }}
                  domain={[-1.5, 4.5]}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0B0F19', borderColor: '#222E4A', borderRadius: '8px' }}
                  labelFormatter={(az) => `Azimuth: ${az}°`}
                  formatter={(val, name, item) => [
                    `${Number(val).toFixed(2)}° (${item.payload.blocking_feature || 'Highland Ridge'})`,
                    'Horizon Obstruction',
                  ]}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <ReferenceLine y={0} stroke="#475569" strokeDasharray="2 2" label="0° Horizon Plane" />
                <Area
                  type="monotone"
                  dataKey="horizon_elevation_deg"
                  name="Horizon Elevation Angle (°)"
                  stroke="#10B981"
                  fill="url(#horizonGradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* VIEW 2: BLOCKING DISTANCE (KM) */}
        {activeTab === 'distance' && (
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis dataKey="azimuth_deg" stroke="#64748B" unit="°" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748B" unit=" km" tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0B0F19', borderColor: '#222E4A', borderRadius: '8px' }}
                  labelFormatter={(az) => `Azimuth: ${az}°`}
                  formatter={(val) => [`${Number(val).toFixed(1)} km`, 'Blocking Feature Distance']}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line
                  type="monotone"
                  dataKey="obstruction_distance_km"
                  name="Distance to Blocking Terrain (km)"
                  stroke="#38BDF8"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* VIEW 3: SAMPLING DATA TABLE */}
        {activeTab === 'table' && (
          <div className="max-h-80 overflow-y-auto rounded-xl border border-luna-800 bg-luna-950/60">
            <table className="w-full text-left text-xs font-mono">
              <thead className="border-b border-luna-800 bg-luna-900 sticky top-0 uppercase text-slate-400">
                <tr>
                  <th className="py-2.5 px-4">Azimuth (°)</th>
                  <th className="py-2.5 px-4 text-right">Horizon Angle (°)</th>
                  <th className="py-2.5 px-4 text-right">Distance (km)</th>
                  <th className="py-2.5 px-4">Blocking Feature</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-luna-800/60 text-slate-300">
                {points.map((pt, i) => (
                  <tr key={i} className="hover:bg-luna-800/40">
                    <td className="py-2 px-4 font-semibold text-slate-100">{pt.azimuth_deg}°</td>
                    <td className="py-2 px-4 text-right font-bold text-emerald-400">{pt.horizon_elevation_deg}°</td>
                    <td className="py-2 px-4 text-right text-cyan-400">{pt.obstruction_distance_km} km</td>
                    <td className="py-2 px-4 text-slate-400">{pt.blocking_feature || 'Highland Topography'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 pt-2 border-t border-luna-800">
          <span>Datum: {terrainData.elevation_datum}</span>
          <span>Sample Count: {points.length} radial rays</span>
        </div>
      </div>
    </div>
  );
}
