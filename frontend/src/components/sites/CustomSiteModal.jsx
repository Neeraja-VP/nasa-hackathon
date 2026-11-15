import React, { useState } from 'react';
import {
  MapPin,
  X,
  Compass,
  Mountain,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Sparkles,
} from 'lucide-react';
import { createCustomSite } from '../../services/api';

const CUSTOM_PRESETS = [
  { name: 'Faustini Crater Peak', lat: -87.18, lon: 77.0, desc: 'Elevated rim vantage with extended Earth DTE line of sight' },
  { name: 'Shoemaker Crater Rim', lat: -88.10, lon: 45.2, desc: 'Permanently shadowed cold trap rim with potential volatile access' },
  { name: 'Haworth North Lip', lat: -87.45, lon: 350.0, desc: 'Highlands terrain with favorable solar grazing illumination' },
  { name: 'Amundsen South Scarp', lat: -84.80, lon: 86.5, desc: 'Deep south pole crater floor ejecta boundary' },
];

export default function CustomSiteModal({
  isOpen,
  onClose,
  onSiteCreated,
}) {
  const [name, setName] = useState('Custom Landing Site');
  const [latitude, setLatitude] = useState(-89.50);
  const [longitude, setLongitude] = useState(130.0);
  const [elevationM, setElevationM] = useState('');
  const [observerHeightM, setObserverHeightM] = useState(2.0);
  const [description, setDescription] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [previewResult, setPreviewResult] = useState(null);

  if (!isOpen) return null;

  const handleApplyPreset = (preset) => {
    setName(preset.name);
    setLatitude(preset.lat);
    setLongitude(preset.lon);
    setDescription(preset.desc);
    setElevationM('');
    setError(null);
    setPreviewResult(null);
  };

  const handleValidateAndCreate = async (e) => {
    e.preventDefault();
    setError(null);

    // Validation
    const lat = Number(latitude);
    const lon = Number(longitude);
    const mast = Number(observerHeightM);

    if (isNaN(lat) || lat < -90.0 || lat > 90.0) {
      setError('Latitude must be a valid number between -90.0° and +90.0°.');
      return;
    }

    if (isNaN(lon) || lon < -180.0 || lon > 360.0) {
      setError('Longitude must be a valid number between -180.0° and 360.0°.');
      return;
    }

    if (isNaN(mast) || mast < 0.0 || mast > 50.0) {
      setError('Observer/mast height must be between 0 and 50 meters.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: name.trim() || 'Custom Landing Target',
        latitude: lat,
        longitude: lon,
        elevation_m: elevationM !== '' ? Number(elevationM) : null,
        observer_height_m: mast,
        description: description.trim() || undefined,
      };

      const newSite = await createCustomSite(payload);
      setPreviewResult(newSite);
      
      if (onSiteCreated) {
        onSiteCreated(newSite);
      }
      onClose();
    } catch (err) {
      console.error('Failed to create custom landing site:', err);
      setError(err.response?.data?.error?.message || err.message || 'Failed to query NASA LOLA DEM for custom coordinates.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg rounded-2xl border border-luna-700 bg-luna-900 p-6 shadow-2xl space-y-5 text-slate-100 font-sans">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-luna-800 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-mono text-base font-bold text-white tracking-wide">
                Custom Landing Coordinates
              </h2>
              <p className="text-xs text-slate-400">
                Define arbitrary coordinates characterized with NASA LOLA DEM elevation models
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-luna-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Quick Presets */}
        <div className="space-y-1.5">
          <label className="text-xs font-mono font-semibold uppercase text-slate-400 flex items-center space-x-1">
            <Sparkles className="h-3 w-3 text-amber-400" />
            <span>Lunar South Pole Target Presets</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {CUSTOM_PRESETS.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleApplyPreset(p)}
                className="text-left rounded-lg border border-luna-800 bg-luna-950 p-2 text-xs font-mono hover:border-cyan-500/40 hover:bg-luna-850 transition-colors"
              >
                <div className="font-semibold text-cyan-300 truncate">{p.name}</div>
                <div className="text-[10px] text-slate-400">{p.lat.toFixed(2)}°, {p.lon.toFixed(1)}°E</div>
              </button>
            ))}
          </div>
        </div>

        {/* Form Fields */}
        <form onSubmit={handleValidateAndCreate} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-mono text-slate-300 font-semibold">
              Landing Target Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Artemis III Secondary Ridge"
              required
              className="w-full rounded-lg border border-luna-700 bg-luna-950 px-3 py-2 text-xs font-mono text-white focus:border-cyan-400 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-300 flex items-center justify-between">
                <span>Latitude (°)</span>
                <span className="text-[10px] text-slate-500">[-90° to +90°]</span>
              </label>
              <input
                type="number"
                step="0.0001"
                min="-90"
                max="90"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                required
                className="w-full rounded-lg border border-luna-700 bg-luna-950 px-3 py-2 text-xs font-mono text-white focus:border-cyan-400 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-300 flex items-center justify-between">
                <span>Longitude (°)</span>
                <span className="text-[10px] text-slate-500">[0° to 360°]</span>
              </label>
              <input
                type="number"
                step="0.0001"
                min="-180"
                max="360"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                required
                className="w-full rounded-lg border border-luna-700 bg-luna-950 px-3 py-2 text-xs font-mono text-white focus:border-cyan-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-300 flex items-center justify-between">
                <span>Elevation (m)</span>
                <span className="text-[10px] text-cyan-400">Auto LOLA DEM</span>
              </label>
              <input
                type="number"
                step="1"
                value={elevationM}
                onChange={(e) => setElevationM(e.target.value)}
                placeholder="Leave blank for LOLA DEM"
                className="w-full rounded-lg border border-luna-700 bg-luna-950 px-3 py-2 text-xs font-mono text-white placeholder-slate-600 focus:border-cyan-400 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-300 flex items-center justify-between">
                <span>Lander/Mast Height</span>
                <span className="text-[10px] text-slate-500">meters</span>
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="50"
                value={observerHeightM}
                onChange={(e) => setObserverHeightM(e.target.value)}
                required
                className="w-full rounded-lg border border-luna-700 bg-luna-950 px-3 py-2 text-xs font-mono text-white focus:border-cyan-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-mono text-slate-300 font-semibold">
              Mission Notes / Characterization (Optional)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Operational objectives, expected obstacles, or science targets..."
              className="w-full rounded-lg border border-luna-700 bg-luna-950 px-3 py-2 text-xs font-mono text-white placeholder-slate-600 focus:border-cyan-400 focus:outline-none resize-none"
            />
          </div>

          {error && (
            <div className="flex items-center space-x-2 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-xs font-mono text-rose-300">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-2 border-t border-luna-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-luna-700 bg-luna-850 px-4 py-2 font-mono text-xs font-medium text-slate-300 hover:bg-luna-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center space-x-2 rounded-lg border border-cyan-500/50 bg-cyan-500/20 px-4 py-2 font-mono text-xs font-semibold text-cyan-300 hover:bg-cyan-500/30 transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" />
                  <span>SAMPLING LOLA DEM...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>CHARACTERIZE &amp; SELECT SITE</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
