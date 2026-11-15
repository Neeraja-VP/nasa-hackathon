import React from 'react';
import { Database, AlertTriangle, CheckCircle2, Radio, Mountain, Info } from 'lucide-react';
import Badge from './Badge';

export default function DataSourceBanner({
  ephemerisSource,
  ephemerisType,
  terrainSource,
  demResolutionM,
  isProceduralFallback,
  warningMessage,
  className = '',
}) {
  // Normalize ephemeris badge styling
  let ephVariant = 'amber';
  let ephLabel = ephemerisSource || 'ANALYTICAL FALLBACK DATA';
  let isLive = false;
  let isCached = false;

  if (ephLabel.toUpperCase().includes('LIVE') || ephemerisType === 'LIVE_NASA_HORIZONS') {
    ephVariant = 'emerald';
    isLive = true;
  } else if (ephLabel.toUpperCase().includes('CACHED') || ephemerisType === 'CACHED_NASA_HORIZONS') {
    ephVariant = 'cyan';
    isCached = true;
  }

  // Terrain DEM source styling
  const isDemFallback = isProceduralFallback || (terrainSource && terrainSource.includes('PROCEDURAL'));
  const terrVariant = isDemFallback ? 'amber' : 'purple';
  const terrLabel = terrainSource || (isDemFallback ? 'PROCEDURAL LOLA TOPOGRAPHY' : 'NASA LOLA RASTER DEM');

  return (
    <div className={`space-y-2 ${className}`}>
      {/* 1. DATA PROVENANCE CHIPS ROW */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-luna-800 bg-luna-950/80 px-3.5 py-2 text-xs font-mono">
        <div className="flex flex-wrap items-center gap-3">
          {/* Ephemeris Source Tag */}
          <div className="flex items-center space-x-1.5">
            <Radio className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-slate-400 text-[11px]">Ephemeris:</span>
            <Badge variant={ephVariant} size="xs" className="flex items-center space-x-1">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isLive ? 'bg-emerald-400 animate-pulse' : isCached ? 'bg-cyan-400' : 'bg-amber-400'
                }`}
              />
              <span>{ephLabel}</span>
            </Badge>
          </div>

          {/* Terrain DEM Source Tag */}
          <div className="flex items-center space-x-1.5">
            <Mountain className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-slate-400 text-[11px]">Terrain DEM:</span>
            <Badge variant={terrVariant} size="xs" className="flex items-center space-x-1">
              <span className={`h-1.5 w-1.5 rounded-full ${isDemFallback ? 'bg-amber-400' : 'bg-purple-400'}`} />
              <span>{terrLabel}</span>
            </Badge>
          </div>

          {/* DEM Resolution (if available) */}
          {demResolutionM && demResolutionM > 0 ? (
            <span className="text-[10px] text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/50">
              Res: {demResolutionM}m/px
            </span>
          ) : null}
        </div>

        {/* Calculation Status */}
        <div className="flex items-center space-x-1.5 text-[11px]">
          {isLive || isCached ? (
            <span className="flex items-center space-x-1 text-emerald-400 font-semibold">
              <CheckCircle2 className="h-3 w-3" />
              <span>NASA VERIFIED</span>
            </span>
          ) : (
            <span className="flex items-center space-x-1 text-amber-400 font-semibold">
              <Info className="h-3 w-3" />
              <span>ANALYTICAL BASELINE</span>
            </span>
          )}
        </div>
      </div>

      {/* 2. DATA QUALITY / FALLBACK WARNING BANNER (IF PRESENT) */}
      {warningMessage && (
        <div className="flex items-start space-x-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2 text-xs font-mono text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-semibold text-amber-200">Data Source Notice / Fallback Triggered</p>
            <p className="text-[11px] text-amber-300/90 leading-relaxed">{warningMessage}</p>
          </div>
        </div>
      )}
    </div>
  );
}
