import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  Layers,
  MapPin,
  Mountain,
  Radio,
  Search,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  Plus,
} from 'lucide-react';
import { formatLatitude, formatLongitude } from '../../utils/coordinates';
import CustomSiteModal from '../sites/CustomSiteModal';

export default function MissionSidebar({
  missionConfig,
  onChangeMissionConfig,
  sites,
  selectedSiteId,
  onSelectSite,
  onAddCustomSite,
  loading,
  isOpen,
  onCloseMobile,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRegion, setFilterRegion] = useState('all');
  const [expandedConfig, setExpandedConfig] = useState(true);
  const [isCustomSiteModalOpen, setIsCustomSiteModalOpen] = useState(false);

  // Filter candidate sites
  const filteredSites = sites.filter((site) => {
    const matchesSearch =
      site.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      site.region.toLowerCase().includes(searchQuery.toLowerCase()) ||
      site.id.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filterRegion === 'ultra-polar') {
      return site.latitude <= -88.0;
    }
    if (filterRegion === 'massif') {
      return site.region.toLowerCase().includes('massif') || site.elevation_m >= 3000;
    }
    if (filterRegion === 'gentle-slope') {
      return site.slope_degrees <= 8.0;
    }
    return true;
  });

  return (
    <aside
      className={`fixed inset-y-16 left-0 z-20 w-80 shrink-0 transform border-r border-luna-800 bg-luna-900/95 p-4 flex flex-col space-y-4 backdrop-blur-md transition-transform duration-200 ease-in-out md:static md:translate-x-0 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      {/* 1. MISSION EPOCH & CONSTRAINTS CONFIGURATION */}
      <div className="rounded-xl border border-luna-800 bg-luna-850/60 p-3.5 space-y-3">
        <button
          onClick={() => setExpandedConfig(!expandedConfig)}
          className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-300"
        >
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-cyan-400" />
            <span>Mission Epoch &amp; Horizon</span>
          </div>
          {expandedConfig ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </button>

        {expandedConfig && (
          <div className="space-y-2.5 text-xs pt-1">
            <div>
              <label className="text-slate-400 block mb-1 font-mono text-[11px]">Evaluation Epoch (UTC)</label>
              <input
                type="datetime-local"
                value={missionConfig.startDate}
                onChange={(e) => onChangeMissionConfig({ ...missionConfig, startDate: e.target.value })}
                className="w-full rounded-lg bg-luna-950 border border-luna-700 px-2.5 py-1.5 font-mono text-slate-200 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-400 block mb-1 font-mono text-[11px]">Duration (days)</label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={missionConfig.durationDays}
                  onChange={(e) => onChangeMissionConfig({ ...missionConfig, durationDays: Number(e.target.value) })}
                  className="w-full rounded-lg bg-luna-950 border border-luna-700 px-2.5 py-1.5 font-mono text-slate-200 focus:border-cyan-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1 font-mono text-[11px]">Step (hours)</label>
                <input
                  type="number"
                  min="0.5"
                  max="24"
                  step="0.5"
                  value={missionConfig.stepHours}
                  onChange={(e) => onChangeMissionConfig({ ...missionConfig, stepHours: Number(e.target.value) })}
                  className="w-full rounded-lg bg-luna-950 border border-luna-700 px-2.5 py-1.5 font-mono text-slate-200 focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-luna-800/80">
              <div>
                <label className="text-slate-400 block mb-1 font-mono text-[11px]">Solar Mast (m)</label>
                <input
                  type="number"
                  min="0.5"
                  max="20"
                  step="0.5"
                  value={missionConfig.mastHeightM}
                  onChange={(e) => onChangeMissionConfig({ ...missionConfig, mastHeightM: Number(e.target.value) })}
                  className="w-full rounded-lg bg-luna-950 border border-luna-700 px-2.5 py-1 font-mono text-slate-200 text-right focus:border-cyan-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1 font-mono text-[11px]">Comm Ant. (m)</label>
                <input
                  type="number"
                  min="0.5"
                  max="20"
                  step="0.5"
                  value={missionConfig.antennaHeightM || 2.5}
                  onChange={(e) => onChangeMissionConfig({ ...missionConfig, antennaHeightM: Number(e.target.value) })}
                  className="w-full rounded-lg bg-luna-950 border border-luna-700 px-2.5 py-1 font-mono text-slate-200 text-right focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-luna-800/80 flex items-center justify-between">
              <span className="text-slate-300 text-xs">LOLA 360° DEM Mask</span>
              <input
                type="checkbox"
                checked={missionConfig.useTerrainHorizon}
                onChange={(e) => onChangeMissionConfig({ ...missionConfig, useTerrainHorizon: e.target.checked })}
                className="h-4 w-4 rounded border-luna-700 bg-luna-950 text-cyan-500 focus:ring-cyan-500 cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>

      {/* 2. CANDIDATE LANDING SITES CATALOG */}
      <div className="flex-1 flex flex-col min-h-0 space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center space-x-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Candidate Sites ({filteredSites.length})
            </h3>
            {loading && <span className="font-mono text-[10px] text-cyan-400 animate-pulse">Scanning...</span>}
          </div>
          <button
            type="button"
            onClick={() => setIsCustomSiteModalOpen(true)}
            className="flex items-center space-x-1 rounded bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 text-[10px] font-mono font-semibold text-cyan-300 hover:bg-cyan-500/20 transition-colors"
            title="Define a new lunar landing site using custom coordinates"
          >
            <Plus className="h-3 w-3" />
            <span>CUSTOM</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search crater, ridge, massif..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg bg-luna-950 border border-luna-700 pl-8 pr-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
          />
        </div>

        {/* Quick Filter Pills */}
        <div className="flex flex-wrap gap-1 text-[11px] font-mono">
          {[
            { id: 'all', label: 'All' },
            { id: 'ultra-polar', label: 'Lat < -88°' },
            { id: 'massif', label: 'Massifs' },
            { id: 'gentle-slope', label: 'Slope ≤ 8°' },
          ].map((pill) => (
            <button
              key={pill.id}
              onClick={() => setFilterRegion(pill.id)}
              className={`rounded px-2 py-0.5 transition-colors ${
                filterRegion === pill.id
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'bg-luna-950 text-slate-400 border border-luna-800 hover:text-slate-200'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>

        {/* Candidate Sites Scrollable List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
          {filteredSites.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-500 font-mono">
              No matching landing candidates found.
            </div>
          ) : (
            filteredSites.map((site) => {
              const isSelected = site.id === selectedSiteId;
              return (
                <button
                  key={site.id}
                  onClick={() => {
                    onSelectSite(site.id);
                    if (onCloseMobile) onCloseMobile();
                  }}
                  className={`w-full text-left rounded-xl p-3 transition-all border ${
                    isSelected
                      ? 'border-cyan-500/60 bg-cyan-950/30 text-white shadow-[0_0_14px_rgba(6,182,212,0.18)]'
                      : 'border-luna-800/80 bg-luna-850/40 text-slate-300 hover:bg-luna-800/60 hover:text-white hover:border-luna-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs truncate max-w-[190px]">{site.name}</span>
                    <ArrowUpRight
                      className={`h-3.5 w-3.5 shrink-0 ${isSelected ? 'text-cyan-400' : 'text-slate-600'}`}
                    />
                  </div>

                  <p className="mt-0.5 text-[10px] text-slate-400 truncate">{site.region}</p>

                  <div className="mt-2 flex items-center justify-between font-mono text-[10px] pt-1.5 border-t border-white/5">
                    <span className="text-slate-400">
                      {formatLatitude(site.latitude)}, {formatLongitude(site.longitude)}
                    </span>
                    <span className="text-cyan-400 font-semibold">{site.elevation_m}m</span>
                  </div>

                  <div className="mt-1 flex items-center justify-between font-mono text-[10px]">
                    <span className="text-slate-500">Slope: {site.slope_degrees}°</span>
                    <span
                      className={`font-semibold ${
                        site.slope_degrees <= 8 ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    >
                      {site.slope_degrees <= 8 ? 'Safe Touchdown' : 'Caution'}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Custom Site Modal */}
      <CustomSiteModal
        isOpen={isCustomSiteModalOpen}
        onClose={() => setIsCustomSiteModalOpen(false)}
        onSiteCreated={(newSite) => {
          if (onAddCustomSite) onAddCustomSite(newSite);
          if (onSelectSite) onSelectSite(newSite.id);
        }}
      />
    </aside>
  );
}
