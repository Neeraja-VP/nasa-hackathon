import React from 'react';
import {
  Compass,
  Layers,
  MapPin,
  Sun,
  Radio,
  Mountain,
  Sliders,
  BatteryCharging,
  Scale,
  Activity,
  Menu,
  X,
  Bot,
  Globe,
  Map,
  Eye,
} from 'lucide-react';

export const NAVIGATION_TABS = [
  { id: 'overview', label: 'Site Overview', icon: Layers },
  { id: 'explorer', label: 'Lunar Explorer', icon: MapPin },
  { id: 'moon3d', label: '3D Moon Surface', icon: Globe },
  { id: 'quickmap', label: 'LROC QuickMap', icon: Map },
  { id: 'skyhorizon', label: 'Sky Horizon', icon: Eye },
  { id: 'illumination', label: 'Solar Illumination', icon: Sun },
  { id: 'communication', label: 'Earth Comm (DTE)', icon: Radio },
  { id: 'terrain', label: 'Terrain Horizon', icon: Mountain },
  { id: 'compare', label: 'Compare Sites', icon: Scale },
  { id: 'ranking', label: 'MCDA Ranking', icon: Sliders },
  { id: 'simulation', label: 'Power Simulation', icon: BatteryCharging },
  { id: 'assistant', label: 'AI Assistant', icon: Bot },
];

export default function Header({
  activeTab,
  onTabChange,
  apiOnline,
  selectedSite,
  ephemerisSource,
  sidebarOpen,
  onToggleSidebar,
}) {
  return (
    <header className="flex h-16 w-full items-center justify-between border-b border-luna-800 bg-luna-900/90 px-4 md:px-6 backdrop-blur-md z-30 shrink-0">
      {/* Brand & Mission Identifier */}
      <div className="flex items-center space-x-3">
        <button
          onClick={onToggleSidebar}
          className="md:hidden flex h-9 w-9 items-center justify-center rounded-lg border border-luna-700 bg-luna-850 text-slate-300 hover:text-white"
          title="Toggle Mission Sidebar"
        >
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.2)]">
          <Compass className="h-6 w-6 animate-pulse" />
        </div>

        <div>
          <div className="flex items-center space-x-2">
            <span className="font-mono text-base md:text-lg font-bold tracking-wider text-slate-100">
              LUNA NAVIGATOR
            </span>
            <span className="hidden sm:inline-flex rounded bg-cyan-500/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-cyan-300 border border-cyan-500/30">
              ARTEMIS &bull; POLAR
            </span>
          </div>
          <p className="hidden md:block text-[11px] text-slate-400">
            Autonomous Lunar South-Pole Landing Site Characterization &amp; Mission Planning
          </p>
        </div>
      </div>

      {/* Primary Navigation Tabs */}
      <nav className="hidden lg:flex items-center space-x-1 rounded-xl border border-luna-800 bg-luna-950/80 p-1">
        {NAVIGATION_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center space-x-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${
                active
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_8px_rgba(6,182,212,0.2)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-luna-850/60'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* System Telemetry Indicator & Site Quick-view */}
      <div className="flex items-center space-x-3">
        {selectedSite && (
          <div className="hidden xl:flex items-center space-x-2 rounded-lg border border-luna-800 bg-luna-850/60 px-3 py-1 font-mono text-xs">
            <span className="text-slate-400">SITE:</span>
            <span className="font-bold text-slate-200 truncate max-w-[140px]">{selectedSite.name}</span>
          </div>
        )}

        {ephemerisSource && (
          <div className="hidden lg:flex items-center space-x-1.5 rounded-lg border border-luna-800 bg-luna-950/60 px-2.5 py-1 text-[11px] font-mono">
            <span className="text-slate-400">EPHEMERIS:</span>
            <span
              className={`font-semibold flex items-center gap-1 ${
                ephemerisSource.includes('LIVE')
                  ? 'text-emerald-400'
                  : ephemerisSource.includes('CACHED')
                  ? 'text-cyan-400'
                  : 'text-amber-400'
              }`}
            >
              {ephemerisSource.includes('LIVE') && (
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              )}
              {ephemerisSource.includes('LIVE')
                ? 'NASA HORIZONS (LIVE)'
                : ephemerisSource.includes('CACHED')
                ? 'NASA HORIZONS (CACHED)'
                : 'DE440 ANALYTICAL'}
            </span>
          </div>
        )}

        <div className="flex items-center space-x-2 rounded-lg border border-luna-800 bg-luna-950/60 px-3 py-1 text-xs font-mono">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${
              apiOnline
                ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]'
                : 'bg-amber-500 animate-ping'
            }`}
          />
          <span className={`hidden sm:inline ${apiOnline ? 'text-emerald-400' : 'text-amber-400'}`}>
            {apiOnline ? 'API TELEMETRY LIVE' : 'API DISCONNECTED'}
          </span>
        </div>
      </div>
    </header>
  );
}
