import React from 'react';
import { Database, AlertTriangle, CheckCircle2, Cpu, Layers } from 'lucide-react';
import Badge from './Badge';

export default function DataProvenanceBanner({
  ephemerisSource,
  terrainSource,
  demResolutionM,
  calculationStatus = 'NOMINAL',
  dataQualityWarning,
  className = '',
}) {
  const isLive = ephemerisSource && ephemerisSource.includes('LIVE');
  const isCached = ephemerisSource && ephemerisSource.includes('CACHED');
  const isFallback = !isLive && !isCached;

  const ephemBadgeVariant = isLive ? 'emerald' : isCached ? 'cyan' : 'amber';
  const terrainBadgeVariant = terrainSource && terrainSource.includes('PROCEDURAL') ? 'amber' : 'cyan';

  return (
    <div className={`space-y-2.5 ${className}`}>
      {/* Provenance Pills Row */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-luna-800 bg-luna-900/80 px-4 py-2.5 backdrop-blur-sm text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center space-x-1.5 text-slate-400 font-mono text-[11px]">
            <Database className="h-3.5 w-3.5 text-cyan-400" />
            <span className="uppercase tracking-wider">Ephemeris:</span>
          </div>
          <Badge variant={ephemBadgeVariant} size="xs" className="font-semibold">
            {isLive && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse mr-1" />}
            {ephemerisSource || 'ANALYTICAL FALLBACK DATA'}
          </Badge>

          <div className="hidden sm:inline-block h-3 w-px bg-luna-700 mx-1" />

          <div className="flex items-center space-x-1.5 text-slate-400 font-mono text-[11px]">
            <Layers className="h-3.5 w-3.5 text-purple-400" />
            <span className="uppercase tracking-wider">Terrain:</span>
          </div>
          <Badge variant={terrainBadgeVariant} size="xs">
            {terrainSource || 'NASA LOLA DEM'}
          </Badge>

          {demResolutionM && (
            <Badge variant="default" size="xs" className="text-slate-400">
              {demResolutionM}m/px
            </Badge>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-[11px] font-mono text-slate-400">Status:</span>
          <Badge
            variant={calculationStatus === 'NOMINAL' ? 'emerald' : 'amber'}
            size="xs"
          >
            {calculationStatus === 'NOMINAL' ? (
              <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-400 inline" />
            ) : (
              <AlertTriangle className="h-3 w-3 mr-1 text-amber-400 inline" />
            )}
            {calculationStatus}
          </Badge>
        </div>
      </div>

      {/* Warning / Quality Alert */}
      {(dataQualityWarning || isFallback) && (
        <div className="flex items-start space-x-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 text-xs text-amber-200">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
          <div className="space-y-0.5 leading-relaxed">
            <span className="font-semibold block font-mono text-[11px] uppercase tracking-wide text-amber-300">
              {isFallback ? 'Analytical Approximation Notice' : 'Data Quality Telemetry'}
            </span>
            <p className="text-slate-300 text-[11px]">
              {dataQualityWarning ||
                'Telemetry currently calculated using validated DE440 analytical ephemeris fallback. Enable "Live NASA Horizons API" in the Mission Horizon sidebar for live NASA observational telemetry.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
