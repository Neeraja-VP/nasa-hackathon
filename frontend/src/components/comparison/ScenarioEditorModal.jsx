import React, { useState, useEffect } from 'react';
import {
  X,
  Check,
  Calendar,
  Clock,
  BatteryCharging,
  Zap,
  Mountain,
  Sun,
  Radio,
  Sliders,
  MapPin,
} from 'lucide-react';
import { SOLAR_TRACKING_MODES } from '../../utils/constants';

export default function ScenarioEditorModal({
  isOpen,
  onClose,
  scenario,
  onSave,
  availableSites = [],
}) {
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    site_id: 'shackleton-rim',
    site_name: '',
    latitude: -89.78,
    longitude: 125.0,
    elevation_m: 1240.0,
    mast_height_m: 2.0,
    start_date: '2026-12-01T00:00',
    duration_days: 14.0,
    step_hours: 2.0,
    solar_array_area_m2: 4.0,
    solar_efficiency: 0.30,
    solar_tracking_type: 'VERTICAL_AZIMUTH_TRACKING',
    battery_capacity_wh: 5000.0,
    initial_battery_soc_percent: 100.0,
    min_safe_soc_percent: 20.0,
    base_hotel_load_w: 150.0,
    payload_active_load_w: 100.0,
    survival_heater_load_w: 80.0,
  });

  const [activeTab, setActiveTab] = useState('site'); // 'site' | 'timeline' | 'power'

  useEffect(() => {
    if (scenario) {
      // Format start date for datetime-local input
      let dateStr = '2026-12-01T00:00';
      if (scenario.start_date) {
        const d = new Date(scenario.start_date);
        dateStr = d.toISOString().slice(0, 16);
      }
      setFormData({
        ...scenario,
        start_date: dateStr,
      });
    }
  }, [scenario]);

  if (!isOpen) return null;

  const handleSiteSelect = (siteId) => {
    if (siteId === 'custom') {
      setFormData((prev) => ({
        ...prev,
        site_id: null,
        site_name: 'Custom Lunar Target',
      }));
      return;
    }
    const found = availableSites.find((s) => s.id === siteId);
    if (found) {
      setFormData((prev) => ({
        ...prev,
        site_id: found.id,
        site_name: found.name,
        latitude: found.latitude,
        longitude: found.longitude,
        elevation_m: found.elevation_m,
      }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const finalData = {
      ...formData,
      latitude: Number(formData.latitude),
      longitude: Number(formData.longitude),
      elevation_m: formData.elevation_m !== '' && formData.elevation_m !== null ? Number(formData.elevation_m) : null,
      mast_height_m: Number(formData.mast_height_m),
      duration_days: Number(formData.duration_days),
      step_hours: Number(formData.step_hours),
      solar_array_area_m2: Number(formData.solar_array_area_m2),
      solar_efficiency: Number(formData.solar_efficiency),
      battery_capacity_wh: Number(formData.battery_capacity_wh),
      initial_battery_soc_percent: Number(formData.initial_battery_soc_percent),
      min_safe_soc_percent: Number(formData.min_safe_soc_percent),
      base_hotel_load_w: Number(formData.base_hotel_load_w),
      payload_active_load_w: Number(formData.payload_active_load_w),
      survival_heater_load_w: Number(formData.survival_heater_load_w),
      start_date: new Date(formData.start_date).toISOString(),
    };
    onSave(finalData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl rounded-2xl border border-luna-700 bg-luna-900 p-6 shadow-2xl space-y-5 text-slate-100 font-sans max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-luna-800 pb-3 shrink-0">
          <div>
            <h2 className="font-mono text-base font-bold text-white tracking-wide">
              {scenario?.id ? 'Edit Mission Scenario Parameters' : 'Create New Mission Scenario'}
            </h2>
            <p className="text-xs text-slate-400">
              Each scenario maintains independent landing sites, dates, power, and battery configurations
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-luna-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-luna-800 space-x-2 shrink-0">
          {[
            { id: 'site', label: '1. Landing Site & Coords', icon: MapPin },
            { id: 'timeline', label: '2. Landing Date & Duration', icon: Calendar },
            { id: 'power', label: '3. Solar & Battery EPS', icon: Zap },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-1.5 pb-2.5 px-3 font-mono text-xs font-semibold transition-all border-b-2 ${
                  active
                    ? 'border-cyan-400 text-cyan-300'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* SCENARIO NAME */}
          <div className="space-y-1">
            <label className="text-xs font-mono text-slate-300 font-semibold">Scenario Identifier</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Scenario A: Shackleton (Dec 2026)"
              required
              className="w-full rounded-lg border border-luna-700 bg-luna-950 px-3 py-2 text-xs font-mono text-white focus:border-cyan-400 focus:outline-none"
            />
          </div>

          {/* TAB 1: SITE & COORDINATES */}
          {activeTab === 'site' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-300 font-semibold">Select Landing Zone</label>
                <select
                  value={formData.site_id || 'custom'}
                  onChange={(e) => handleSiteSelect(e.target.value)}
                  className="w-full rounded-lg border border-luna-700 bg-luna-950 px-3 py-2 text-xs font-mono text-white focus:border-cyan-400 focus:outline-none"
                >
                  {availableSites.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.name} ({site.latitude.toFixed(2)}°, {site.longitude.toFixed(1)}°E)
                    </option>
                  ))}
                  <option value="custom">-- Custom Coordinate Input --</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-mono text-slate-400">Latitude (°)</label>
                  <input
                    type="number"
                    step="0.0001"
                    min="-90"
                    max="90"
                    value={formData.latitude}
                    onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                    required
                    className="w-full rounded-lg border border-luna-700 bg-luna-950 px-3 py-1.5 text-xs font-mono text-white focus:border-cyan-400 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-mono text-slate-400">Longitude (°)</label>
                  <input
                    type="number"
                    step="0.0001"
                    min="-180"
                    max="360"
                    value={formData.longitude}
                    onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                    required
                    className="w-full rounded-lg border border-luna-700 bg-luna-950 px-3 py-1.5 text-xs font-mono text-white focus:border-cyan-400 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-mono text-slate-400">Elevation (m)</label>
                  <input
                    type="number"
                    step="1"
                    value={formData.elevation_m || ''}
                    onChange={(e) => setFormData({ ...formData, elevation_m: e.target.value })}
                    placeholder="Auto LOLA DEM"
                    className="w-full rounded-lg border border-luna-700 bg-luna-950 px-3 py-1.5 text-xs font-mono text-white focus:border-cyan-400 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-mono text-slate-400">Mast / Instrument Height (m)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="50"
                    value={formData.mast_height_m}
                    onChange={(e) => setFormData({ ...formData, mast_height_m: e.target.value })}
                    required
                    className="w-full rounded-lg border border-luna-700 bg-luna-950 px-3 py-1.5 text-xs font-mono text-white focus:border-cyan-400 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LANDING DATE & TIMELINE */}
          {activeTab === 'timeline' && (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-mono text-slate-300 font-semibold flex items-center space-x-1.5">
                  <Calendar className="h-3.5 w-3.5 text-cyan-400" />
                  <span>Landing Date &amp; Touchdown Time (UTC)</span>
                </label>
                <input
                  type="datetime-local"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  required
                  className="w-full rounded-lg border border-luna-700 bg-luna-950 px-3 py-2 text-xs font-mono text-white focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-mono text-slate-400">Mission Surface Duration</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      step="1"
                      min="1"
                      max="60"
                      value={formData.duration_days}
                      onChange={(e) => setFormData({ ...formData, duration_days: e.target.value })}
                      required
                      className="w-full rounded-lg border border-luna-700 bg-luna-950 px-3 py-1.5 text-xs font-mono text-white focus:border-cyan-400 focus:outline-none"
                    />
                    <span className="text-xs font-mono text-slate-400">days</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-mono text-slate-400">Calculation Step Size</label>
                  <div className="flex items-center space-x-2">
                    <select
                      value={formData.step_hours}
                      onChange={(e) => setFormData({ ...formData, step_hours: Number(e.target.value) })}
                      className="w-full rounded-lg border border-luna-700 bg-luna-950 px-3 py-1.5 text-xs font-mono text-white focus:border-cyan-400 focus:outline-none"
                    >
                      <option value={1.0}>1 hour (High precision)</option>
                      <option value={2.0}>2 hours (Standard)</option>
                      <option value={4.0}>4 hours (Fast)</option>
                      <option value={6.0}>6 hours (Coarse)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Quick Date Shortcuts */}
              <div className="rounded-xl border border-luna-800 bg-luna-950 p-3 space-y-2">
                <span className="text-[11px] font-mono font-semibold uppercase text-slate-400">
                  Mission Epoch Shortcuts:
                </span>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'Artemis Baseline (Dec 1, 2026)', date: '2026-12-01T00:00' },
                    { label: 'Southern Summer Solstice (Dec 21, 2026)', date: '2026-12-21T00:00' },
                    { label: 'Early 2027 Window (Jan 15, 2027)', date: '2027-01-15T00:00' },
                    { label: 'Equinox Crossing (Mar 20, 2027)', date: '2027-03-20T00:00' },
                  ].map((preset, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setFormData({ ...formData, start_date: preset.date })}
                      className="rounded bg-slate-800 px-2 py-1 text-[10px] font-mono text-cyan-300 hover:bg-slate-700 transition-colors"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: POWER & EPS */}
          {activeTab === 'power' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-mono text-slate-400">Solar Array Area (m²)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="50"
                    value={formData.solar_array_area_m2}
                    onChange={(e) => setFormData({ ...formData, solar_array_area_m2: e.target.value })}
                    required
                    className="w-full rounded-lg border border-luna-700 bg-luna-950 px-3 py-1.5 text-xs font-mono text-white focus:border-cyan-400 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-mono text-slate-400">Array Tracking Mode</label>
                  <select
                    value={formData.solar_tracking_type}
                    onChange={(e) => setFormData({ ...formData, solar_tracking_type: e.target.value })}
                    className="w-full rounded-lg border border-luna-700 bg-luna-950 px-3 py-1.5 text-xs font-mono text-white focus:border-cyan-400 focus:outline-none"
                  >
                    {Object.entries(SOLAR_TRACKING_MODES).map(([key, item]) => (
                      <option key={key} value={key}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-mono text-slate-400">Battery Capacity (Wh)</label>
                  <input
                    type="number"
                    step="500"
                    min="500"
                    max="50000"
                    value={formData.battery_capacity_wh}
                    onChange={(e) => setFormData({ ...formData, battery_capacity_wh: e.target.value })}
                    required
                    className="w-full rounded-lg border border-luna-700 bg-luna-950 px-3 py-1.5 text-xs font-mono text-white focus:border-cyan-400 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-mono text-slate-400">Initial State of Charge (%)</label>
                  <input
                    type="number"
                    step="5"
                    min="20"
                    max="100"
                    value={formData.initial_battery_soc_percent}
                    onChange={(e) => setFormData({ ...formData, initial_battery_soc_percent: e.target.value })}
                    required
                    className="w-full rounded-lg border border-luna-700 bg-luna-950 px-3 py-1.5 text-xs font-mono text-white focus:border-cyan-400 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-luna-800">
                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-slate-400">Hotel Load (W)</label>
                  <input
                    type="number"
                    step="10"
                    value={formData.base_hotel_load_w}
                    onChange={(e) => setFormData({ ...formData, base_hotel_load_w: e.target.value })}
                    className="w-full rounded-lg border border-luna-700 bg-luna-950 px-2 py-1 text-xs font-mono text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-slate-400">Payload Load (W)</label>
                  <input
                    type="number"
                    step="10"
                    value={formData.payload_active_load_w}
                    onChange={(e) => setFormData({ ...formData, payload_active_load_w: e.target.value })}
                    className="w-full rounded-lg border border-luna-700 bg-luna-950 px-2 py-1 text-xs font-mono text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-slate-400">Heater Load (W)</label>
                  <input
                    type="number"
                    step="10"
                    value={formData.survival_heater_load_w}
                    onChange={(e) => setFormData({ ...formData, survival_heater_load_w: e.target.value })}
                    className="w-full rounded-lg border border-luna-700 bg-luna-950 px-2 py-1 text-xs font-mono text-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Footer Save / Cancel */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-luna-800 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-luna-700 bg-luna-850 px-4 py-2 font-mono text-xs font-medium text-slate-300 hover:bg-luna-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center space-x-1.5 rounded-lg border border-cyan-500/50 bg-cyan-500/20 px-4 py-2 font-mono text-xs font-semibold text-cyan-300 hover:bg-cyan-500/30 transition-all"
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
