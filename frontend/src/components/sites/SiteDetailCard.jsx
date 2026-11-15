import React from 'react';
import {
  Compass,
  Mountain,
  Sun,
  Radio,
  CheckCircle2,
  AlertTriangle,
  Rocket,
  Info,
  Layers,
  ArrowUpRight,
  Globe,
  Map,
  Download,
} from 'lucide-react';
import { formatLatitude, formatLongitude } from '../../utils/coordinates';
import { formatElevationM } from '../../utils/formatters';
import Badge from '../common/Badge';

export default function SiteDetailCard({
  site,
  illuminationData,
  communicationData,
  onNavigateTab,
}) {
  if (!site) {
    return (
      <div className="rounded-2xl border border-luna-800 bg-luna-900/60 p-8 text-center text-slate-500 font-mono text-xs">
        No candidate landing site selected.
      </div>
    );
  }

  const handleExportDossier = () => {
    const dossier = {
      site,
      illumination: illuminationData,
      communication: communicationData,
      exported_at: new Date().toISOString(),
    };
    const jsonStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(dossier, null, 2));
    const link = document.createElement('a');
    link.setAttribute('href', jsonStr);
    link.setAttribute('download', `${site.id}_mission_dossier_${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* 1. HERO DOSSIER HEADER */}
      <div className="relative overflow-hidden rounded-2xl border border-luna-800 bg-gradient-to-br from-luna-900 via-luna-850 to-luna-900 p-6 shadow-xl">
        <div className="absolute right-0 top-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-cyan-500/5 blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="cyan">{site.region.toUpperCase()}</Badge>
              <Badge variant="default">
                LAT: {formatLatitude(site.latitude)} &bull; LON: {formatLongitude(site.longitude)}
              </Badge>
              <Badge variant={site.slope_degrees <= 8 ? 'emerald' : 'amber'}>
                SLOPE: {site.slope_degrees}°
              </Badge>
              <button
                onClick={handleExportDossier}
                className="flex items-center space-x-1 rounded-md border border-luna-700 bg-luna-900/80 px-2 py-0.5 text-[11px] font-mono text-cyan-300 hover:border-cyan-500 hover:bg-luna-800 transition-colors"
                title="Export complete site telemetry dossier as JSON"
              >
                <Download className="h-3 w-3" />
                <span>Export Dossier</span>
              </button>
            </div>

            <h1 className="font-mono text-2xl md:text-3xl font-extrabold tracking-tight text-white">
              {site.name}
            </h1>
            <p className="text-xs md:text-sm text-slate-300 max-w-3xl leading-relaxed">
              {site.description}
            </p>
          </div>

          {/* Quick KPI Stat Chips */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => onNavigateTab && onNavigateTab('illumination')}
              className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3.5 text-center min-w-[110px] hover:bg-amber-500/10 transition-colors cursor-pointer text-left"
            >
              <span className="text-[10px] uppercase font-mono text-amber-400 block flex items-center justify-between">
                <span>Sunlight</span>
                <ArrowUpRight className="h-3 w-3" />
              </span>
              <span className="text-xl md:text-2xl font-bold font-mono text-amber-300 block mt-1">
                {illuminationData ? `${illuminationData.illumination_percentage}%` : '—'}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {illuminationData ? `${illuminationData.total_sunlit_hours}h lit` : 'Simulating...'}
              </span>
            </button>

            <button
              onClick={() => onNavigateTab && onNavigateTab('communication')}
              className="rounded-xl border border-cyan-500/25 bg-cyan-500/5 p-3.5 text-center min-w-[110px] hover:bg-cyan-500/10 transition-colors cursor-pointer text-left"
            >
              <span className="text-[10px] uppercase font-mono text-cyan-400 block flex items-center justify-between">
                <span>Earth DTE</span>
                <ArrowUpRight className="h-3 w-3" />
              </span>
              <span className="text-xl md:text-2xl font-bold font-mono text-cyan-300 block mt-1">
                {communicationData ? `${communicationData.communication_availability_percentage}%` : '—'}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {communicationData ? `${communicationData.longest_continuous_comm_window_hours}h window` : 'Simulating...'}
              </span>
            </button>

            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3.5 text-center min-w-[110px] text-left">
              <span className="text-[10px] uppercase font-mono text-emerald-400 block">Elevation</span>
              <span className="text-xl md:text-2xl font-bold font-mono text-emerald-300 block mt-1">
                {formatElevationM(site.elevation_m)}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Mean Lunar Sphere</span>
            </div>

            <button
              onClick={() => onNavigateTab && onNavigateTab('moon3d')}
              className="rounded-xl border border-blue-500/25 bg-blue-500/5 p-3.5 text-center min-w-[110px] hover:bg-blue-500/15 transition-colors cursor-pointer text-left"
              title="Inspect 3D Lunar Topography &amp; Real-Time Sun Angle"
            >
              <span className="text-[10px] uppercase font-mono text-blue-400 block flex items-center justify-between">
                <span>3D Terrain</span>
                <Globe className="h-3 w-3" />
              </span>
              <span className="text-xl md:text-2xl font-bold font-mono text-blue-300 block mt-1">
                DEM
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Interactive 3D</span>
            </button>

            <button
              onClick={() => onNavigateTab && onNavigateTab('quickmap')}
              className="rounded-xl border border-indigo-500/25 bg-indigo-500/5 p-3.5 text-center min-w-[110px] hover:bg-indigo-500/15 transition-colors cursor-pointer text-left"
              title="Open LROC QuickMap Stack #3314 (Polar Stereographic)"
            >
              <span className="text-[10px] uppercase font-mono text-indigo-400 block flex items-center justify-between">
                <span>QuickMap</span>
                <Map className="h-3 w-3" />
              </span>
              <span className="text-xl md:text-2xl font-bold font-mono text-indigo-300 block mt-1">
                LROC
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Stack #3314</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. GEOLOGY & OPERATIONAL MATRICES */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Scientific & Geological Significance */}
        <div className="rounded-2xl border border-luna-800 bg-luna-900/60 p-5 space-y-4 shadow-md">
          <h3 className="font-mono text-sm font-semibold uppercase tracking-wider text-cyan-400 flex items-center space-x-2">
            <Info className="h-4 w-4" />
            <span>Scientific Objectives &amp; Volatiles</span>
          </h3>

          <p className="text-xs text-slate-300 leading-relaxed font-sans">
            {site.scientific_interest}
          </p>

          <div className="pt-3 border-t border-luna-800/80 space-y-2">
            <span className="text-[11px] uppercase font-mono text-slate-400 flex items-center space-x-1.5">
              <Rocket className="h-3.5 w-3.5 text-purple-400" />
              <span>Target Mission Architectures:</span>
            </span>
            <div className="flex flex-wrap gap-1.5">
              {site.target_mission_class && site.target_mission_class.map((mc, idx) => (
                <Badge key={idx} variant="purple">
                  {mc}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        {/* Operational Advantages & Challenges */}
        <div className="rounded-2xl border border-luna-800 bg-luna-900/60 p-5 space-y-4 shadow-md">
          <div className="space-y-2">
            <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center space-x-1.5">
              <CheckCircle2 className="h-4 w-4" />
              <span>Operational Advantages</span>
            </h3>
            <ul className="space-y-1.5 text-xs text-slate-300">
              {site.primary_advantages && site.primary_advantages.map((adv, idx) => (
                <li key={idx} className="flex items-start space-x-2">
                  <span className="text-emerald-400 font-bold shrink-0">&bull;</span>
                  <span>{adv}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="pt-3 border-t border-luna-800/80 space-y-2">
            <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-rose-400 flex items-center space-x-1.5">
              <AlertTriangle className="h-4 w-4" />
              <span>Topographic &amp; Thermal Challenges</span>
            </h3>
            <ul className="space-y-1.5 text-xs text-slate-300">
              {site.primary_challenges && site.primary_challenges.map((ch, idx) => (
                <li key={idx} className="flex items-start space-x-2">
                  <span className="text-rose-400 font-bold shrink-0">&bull;</span>
                  <span>{ch}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
