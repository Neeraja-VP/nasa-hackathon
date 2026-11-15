import React, { useState, useEffect } from 'react';
import {
  X,
  Settings,
  Calendar,
  Clock,
  BatteryCharging,
  Zap,
  Sun,
  MapPin,
  Check,
  RotateCcw,
} from 'lucide-react';
import { SIMULATION_PRESETS } from '../../utils/constants';

export default function ScenarioConfigModal({
  isOpen,
  scenario,
  sites = [],
  onClose,
  onSave,
  onOpenCustomSiteModal,
}) {
  const [form, setForm] = useState(null);

  useEffect(() => {
    if (scenario) {
      setForm({ ...scenario });
    }
  }, [scenario]);

  if (!isOpen || !form) return null;

  const handleChange = (field, val) => {
    setForm((prev) => ({ ...prev, [field]: val }));
  };

  const handleSelectSite = (siteId) => {
    const s = sites.find((x) => x.id === siteId);
    if (s) {
      setForm((prev) => ({
        ...prev,
        site_id: s.id,
        latitude: s.latitude,
        longitude: s.longitude,
        elevation_m: s.elevation_m,
      }));
    }
  };

  const applyPreset = (presetKey) => {
    const p = SIMULATION_PRESETS[presetKey];
    if (p) {
      setForm((prev) => ({
        ...prev,
        solar_array_area_m2: p.solar_array_area_m2,
        solar_efficiency: p.solar_efficiency,
        solar_tracking_type: p.solar_tracking_type,
        battery_capacity_wh: p.battery_capacity_wh,
        initial_battery_soc_percent: p.initial_battery_soc_percent,
        min_safe_soc_percent: p.min_safe_soc_percent,
        base_hotel_load_w: p.base_hotel_load_w,
        payload_active_load_w: p.payload_active_load_w,
        survival_heater_load_w: p.survival_heater_load_w,
      }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-cyan-500/40 bg-luna-900 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-luna-800 bg-luna-850 px-5 py-3.5 backdrop-blur-md">
          <div className="flex items-center space-x-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <Settings className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-mono text-sm font-bold text-white tracking-wide">
                CONFIGURE SCENARIO PARAMETERS
              </h2>
              <p className="text-[11px] text-slate-400">
                Independent Site, Epoch, Altimetry &amp; Electrical Power Setup
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-luna-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-5 text-xs font-mono">
          {/* 1. SCENARIO IDENTITY */}
          <div className="space-y-3 rounded-xl border border-luna-800 bg-luna-950 p-4">
            <h3 className="text-cyan-400 font-bold uppercase tracking-wider text-[11px] flex items-center space-x-2">
              <MapPin className="h-3.5 w-3.5" />
              <span>1. Scenario Identification &amp; Landing Site</span>
            </h3>

            <div className="space-y-1">
              <label className="text-slate-300">SCENARIO TITLE / LABEL *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className="w-full rounded-lg border border-luna-700 bg-luna-900 px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
                required
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-slate-300">LANDING SITE CATALOG</label>
                {onOpenCustomSiteModal && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenCustomSiteModal();
                    }}
                    className="text-[10px] text-cyan-400 hover:underline"
                  >
                    + Register New Custom Coordinates
                  </button>
                )}
              </div>
              <select
                value={form.site_id || ''}
                onChange={(e) => handleSelectSite(e.target.value)}
                className="w-full rounded-lg border border-luna-700 bg-luna-900 px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
              >
                <option value="">— Use Custom Coordinates Below —</option>
                {(sites || []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({Number(s.latitude ?? 0).toFixed(2)}°S, {Number(s.longitude ?? 0).toFixed(2)}°E, {s.elevation_m}m)
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1">
              <div>
                <label className="text-[10px] text-slate-400">LATITUDE (°)</label>
                <input
                  type="number"
                  step="0.001"
                  value={form.latitude}
                  onChange={(e) => handleChange('latitude', parseFloat(e.target.value))}
                  className="w-full rounded-lg border border-luna-700 bg-luna-900 px-2.5 py-1.5 text-white focus:border-cyan-500 focus:outline-none text-[11px]"
                  required
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400">LONGITUDE (°)</label>
                <input
                  type="number"
                  step="0.001"
                  value={form.longitude}
                  onChange={(e) => handleChange('longitude', parseFloat(e.target.value))}
                  className="w-full rounded-lg border border-luna-700 bg-luna-900 px-2.5 py-1.5 text-white focus:border-cyan-500 focus:outline-none text-[11px]"
                  required
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400">ELEVATION (M)</label>
                <input
                  type="number"
                  step="1"
                  value={form.elevation_m || 0}
                  onChange={(e) => handleChange('elevation_m', parseFloat(e.target.value))}
                  className="w-full rounded-lg border border-luna-700 bg-luna-900 px-2.5 py-1.5 text-white focus:border-cyan-500 focus:outline-none text-[11px]"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400">MAST HEIGHT (M)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="50"
                  value={form.observer_height_m || 2.0}
                  onChange={(e) => handleChange('observer_height_m', parseFloat(e.target.value))}
                  className="w-full rounded-lg border border-luna-700 bg-luna-900 px-2.5 py-1.5 text-white focus:border-cyan-500 focus:outline-none text-[11px]"
                />
              </div>
            </div>
          </div>

          {/* 2. MISSION EPOCH & DURATION */}
          <div className="space-y-3 rounded-xl border border-luna-800 bg-luna-950 p-4">
            <h3 className="text-cyan-400 font-bold uppercase tracking-wider text-[11px] flex items-center space-x-2">
              <Calendar className="h-3.5 w-3.5" />
              <span>2. Independent Landing Epoch &amp; Horizon Timing</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-slate-300">LANDING EPOCH (UTC) *</label>
                <input
                  type="datetime-local"
                  value={
                    form.start_date
                      ? new Date(form.start_date).toISOString().slice(0, 16)
                      : '2026-12-01T00:00'
                  }
                  onChange={(e) => handleChange('start_date', new Date(e.target.value).toISOString())}
                  className="w-full rounded-lg border border-luna-700 bg-luna-900 px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300">DURATION (DAYS) *</label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  step="1"
                  value={form.duration_days}
                  onChange={(e) => handleChange('duration_days', parseFloat(e.target.value))}
                  className="w-full rounded-lg border border-luna-700 bg-luna-900 px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300">TIME STEP (HOURS) *</label>
                <select
                  value={form.step_hours}
                  onChange={(e) => handleChange('step_hours', parseFloat(e.target.value))}
                  className="w-full rounded-lg border border-luna-700 bg-luna-900 px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
                >
                  <option value={1.0}>1.0 Hour (High Fidelity)</option>
                  <option value={2.0}>2.0 Hours (Standard)</option>
                  <option value={3.0}>3.0 Hours (Fast Benchmark)</option>
                  <option value={6.0}>6.0 Hours (Long Survey)</option>
                </select>
              </div>
            </div>
          </div>

          {/* 3. POWER & BATTERY EPS ARCHITECTURE */}
          <div className="space-y-3 rounded-xl border border-luna-800 bg-luna-950 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-cyan-400 font-bold uppercase tracking-wider text-[11px] flex items-center space-x-2">
                <Zap className="h-3.5 w-3.5" />
                <span>3. Solar Array &amp; Battery Storage (EPS)</span>
              </h3>
              <div className="flex items-center space-x-1.5 text-[10px]">
                <span className="text-slate-400">Presets:</span>
                <button
                  type="button"
                  onClick={() => applyPreset('artemis_lander')}
                  className="rounded bg-cyan-950 px-2 py-0.5 text-cyan-300 hover:bg-cyan-900 border border-cyan-800"
                >
                  Lander
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('light_rover')}
                  className="rounded bg-cyan-950 px-2 py-0.5 text-cyan-300 hover:bg-cyan-900 border border-cyan-800"
                >
                  Rover
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('heavy_habitat')}
                  className="rounded bg-cyan-950 px-2 py-0.5 text-cyan-300 hover:bg-cyan-900 border border-cyan-800"
                >
                  Habitat
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] text-slate-300">SOLAR ARRAY AREA (M²)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="50"
                  value={form.solar_array_area_m2}
                  onChange={(e) => handleChange('solar_array_area_m2', parseFloat(e.target.value))}
                  className="w-full rounded-lg border border-luna-700 bg-luna-900 px-3 py-1.5 text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-slate-300">TRACKING ORIENTATION</label>
                <select
                  value={form.solar_tracking_type}
                  onChange={(e) => handleChange('solar_tracking_type', e.target.value)}
                  className="w-full rounded-lg border border-luna-700 bg-luna-900 px-3 py-1.5 text-white focus:border-cyan-500 focus:outline-none"
                >
                  <option value="VERTICAL_AZIMUTH_TRACKING">Vertical Azimuth Tracking</option>
                  <option value="FIXED_VERTICAL">Fixed Vertical (South Facing)</option>
                  <option value="TILTED_OPTIMAL">Tilted Optimal (80° Elevation)</option>
                  <option value="HORIZONTAL_FLAT">Horizontal Flat Deck</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-slate-300">BATTERY CAPACITY (WH)</label>
                <input
                  type="number"
                  step="500"
                  min="500"
                  max="50000"
                  value={form.battery_capacity_wh}
                  onChange={(e) => handleChange('battery_capacity_wh', parseFloat(e.target.value))}
                  className="w-full rounded-lg border border-luna-700 bg-luna-900 px-3 py-1.5 text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-1">
              <div>
                <label className="text-[10px] text-slate-400">HOTEL LOAD (W)</label>
                <input
                  type="number"
                  value={form.base_hotel_load_w}
                  onChange={(e) => handleChange('base_hotel_load_w', parseFloat(e.target.value))}
                  className="w-full rounded-lg border border-luna-700 bg-luna-900 px-2 py-1 text-white text-[11px]"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400">PAYLOAD LOAD (W)</label>
                <input
                  type="number"
                  value={form.payload_active_load_w}
                  onChange={(e) => handleChange('payload_active_load_w', parseFloat(e.target.value))}
                  className="w-full rounded-lg border border-luna-700 bg-luna-900 px-2 py-1 text-white text-[11px]"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400">SURVIVAL HEATER (W)</label>
                <input
                  type="number"
                  value={form.survival_heater_load_w}
                  onChange={(e) => handleChange('survival_heater_load_w', parseFloat(e.target.value))}
                  className="w-full rounded-lg border border-luna-700 bg-luna-900 px-2 py-1 text-white text-[11px]"
                />
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-luna-700 bg-luna-850 px-4 py-2 font-mono text-xs text-slate-300 hover:text-white transition-colors"
            >
              CANCEL
            </button>
            <button
              type="submit"
              className="flex items-center space-x-1.5 rounded-lg border border-cyan-500/50 bg-cyan-500/20 px-5 py-2 font-mono text-xs font-bold text-cyan-300 hover:bg-cyan-500/30 transition-all shadow-[0_0_12px_rgba(6,182,212,0.2)]"
            >
              <Check className="h-4 w-4" />
              <span>SAVE SCENARIO PARAMETERS</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
