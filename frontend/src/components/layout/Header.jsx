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
} from 'lucide-react';

export const NAVIGATION_TABS = [
  { id: 'overview', label: 'Site Overview', icon: Layers, accent: 'text-cyan-400' },
  { id: 'explorer', label: 'Lunar Explorer', icon: MapPin, accent: 'text-emerald-400' },
  { id: 'moon3d', label: '3D Moon Surface', icon: Globe, accent: 'text-blue-400' },
  { id: 'quickmap', label: 'LROC QuickMap', icon: Map, accent: 'text-indigo-400' },
  { id: 'illumination', label: 'Solar Illumination', icon: Sun, accent: 'text-amber-400' },
  { id: 'communication', label: 'Earth Comm (DTE)', icon: Radio, accent: 'text-sky-400' },
  { id: 'terrain', label: 'Terrain Horizon', icon: Mountain, accent: 'text-teal-400' },
  { id: 'skyhorizon', label: 'Sky Horizon', icon: Compass, accent: 'text-cyan-400' },
  { id: 'compare', label: 'Compare Sites', icon: Scale, accent: 'text-purple-400' },
  { id: 'ranking', label: 'MCDA Ranking', icon: Sliders, accent: 'text-pink-400' },
  { id: 'simulation', label: 'Power Simulation', icon: BatteryCharging, accent: 'text-lime-400' },
  { id: 'assistant', label: 'AI Assistant', icon: Bot, accent: 'text-violet-400' },
];

export default function Header({
  activeTab,
  onTabChange,
  apiOnline,
  selectedSite,
  sidebarOpen,
  onToggleSidebar,
}) {
  return (
    <header className="w-full border-b border-luna-800 bg-luna-900/95 backdrop-blur-md z-30 shrink-0 shadow-lg">
      {/* ROW 1: Executive Brand & Status Telemetry */}
      <div className="flex h-14 w-full items-center justify-between px-4 md:px-6 border-b border-luna-800/60">
        {/* Brand & Mission Identifier */}
        <div className="flex items-center space-x-3 shrink-0">
          <button
            onClick={onToggleSidebar}
            className="md:hidden flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-luna-700 bg-luna-850 text-slate-300 hover:text-white"
            title="Toggle Mission Sidebar"
          >
            {sidebarOpen ? <X className="h-5 w-5 shrink-0" /> : <Menu className="h-5 w-5 shrink-0" />}
          </button>

          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.25)]">
            <Compass className="h-5.5 w-5.5 shrink-0 animate-pulse" />
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <span className="font-mono text-base md:text-lg font-extrabold tracking-wider text-slate-100 whitespace-nowrap">
              LUNA NAVIGATOR
            </span>
            <span className="inline-flex items-center rounded-md bg-cyan-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-cyan-300 border border-cyan-500/30 whitespace-nowrap shadow-sm">
              ARTEMIS &bull; POLAR
            </span>
          </div>

          <p className="hidden 2xl:block text-[11px] text-slate-400 font-sans border-l border-luna-800/80 pl-3 ml-2 truncate">
            Autonomous Lunar South-Pole Landing Site Characterization &amp; Mission Planning
          </p>
        </div>

        {/* System Telemetry Indicator & Site Quick-view */}
        <div className="flex items-center space-x-3 shrink-0">
          {selectedSite && (
            <div className="hidden sm:flex items-center space-x-1.5 rounded-lg border border-luna-800 bg-luna-850/80 px-2.5 py-1 font-mono text-xs shrink-0">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-cyan-400" />
              <span className="text-slate-400">SITE:</span>
              <span className="font-bold text-slate-200 truncate max-w-[150px]">{selectedSite.name}</span>
            </div>
          )}

          <div className="flex items-center space-x-2 rounded-lg border border-luna-800 bg-luna-950/80 px-2.5 py-1 text-xs font-mono shrink-0">
            <span
              className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${
                apiOnline
                  ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]'
                  : 'bg-amber-500 animate-ping'
              }`}
            />
            <span className={`hidden sm:inline font-semibold ${apiOnline ? 'text-emerald-400' : 'text-amber-400'}`}>
              {apiOnline ? 'API TELEMETRY LIVE' : 'API OFFLINE'}
            </span>
          </div>
        </div>
      </div>

      {/* ROW 2: Mission Telemetry Stations Navigation Bar */}
      <nav className="flex w-full items-center px-3 md:px-5 py-1.5 overflow-x-auto scrollbar-thin scrollbar-thumb-luna-700 bg-luna-950/90 gap-1.5">
        {NAVIGATION_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`group shrink-0 flex items-center space-x-2 rounded-lg px-3 py-1.5 text-xs font-mono font-medium whitespace-nowrap transition-all select-none ${
                active
                  ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/50 shadow-[0_0_10px_rgba(6,182,212,0.25)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-luna-850/80 border border-transparent'
              }`}
              title={tab.label}
            >
              <Icon
                className={`h-4.5 w-4.5 shrink-0 min-w-[18px] min-h-[18px] transition-transform group-hover:scale-110 ${
                  active ? `${tab.accent} drop-shadow-[0_0_6px_rgba(6,182,212,0.6)]` : `${tab.accent} opacity-80 group-hover:opacity-100`
                }`}
                strokeWidth={2}
              />
              <span className="tracking-wide">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </header>
  );
}