import React, { useState } from 'react';
import {
  MapPin,
  X,
  Compass,
  Mountain,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { createCustomSite } from '../../services/api';

export default function CustomSiteModal({
  isOpen,
  onClose,
  onSiteCreated,
}) {
  const [name, setName] = useState('');
  const [latitude, setLatitude] = useState('-88.50');
  const [longitude, setLongitude] = useState('120.00');
  const [elevationM, setElevationM] = useState('');
  const [observerHeightM, setObserverHeightM] = useState('2.0');
  const [description, setDescription] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const latNum = parseFloat(latitude);
  const lonNum = parseFloat(longitude);
  const isLatValid = !isNaN(latNum) && latNum >= -90.0 && latNum <= 90.0;
  const isLonValid = !isNaN(lonNum) && lonNum >= -180.0 && lonNum <= 360.0;
  const isSouthPole = isLatValid && latNum <= -80.0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide a unique landing site name.');
      return;
    }
    if (!isLatValid) {
      setError('Latitude must be a valid number between -90.0° and +90.0°.');
      return;
    }
    if (!isLonValid) {
      setError('Longitude must be a valid number between -180.0° and +360.0°.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        name: name.trim(),
        latitude: latNum,
        longitude: lonNum,
        elevation_m: elevationM !== '' ? parseFloat(elevationM) : null,
        observer_height_m: observerHeightM !== '' ? parseFloat(observerHeightM) : 2.0,
        description: description.trim() || undefined,
      };

      const customSite = await createCustomSite(payload);
      if (onSiteCreated) {
        onSiteCreated(customSite);
      }
      onClose();
    } catch (err) {
      console.error('Failed to create custom landing site:', err);
      setError(err.response?.data?.error?.message || err.response?.data?.detail || err.message || 'Failed to register custom coordinates.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-cyan-500/40 bg-luna-900 shadow-2xl">
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-luna-800 bg-luna-850 px-5 py-4">
          <div className="flex items-center space-x-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <MapPin className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-mono text-sm font-bold text-white tracking-wide">
                REGISTER CUSTOM LANDING SITE
              </h2>
              <p className="text-[11px] text-slate-400">
                LOLA DEM Altimetry &amp; Coordinate Transformation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-lg p-1 text-slate-400 hover:bg-luna-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs font-mono">
          {error && (
            <div className="flex items-start space-x-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-rose-300">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Site Name */}
          <div className="space-y-1">
            <label className="text-slate-300 font-semibold flex items-center justify-between">
              <span>SITE DESIGNATION / NAME *</span>
              <span className="text-[10px] text-slate-500">e.g. Amundsen Ridge Bravo</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter custom landing site name..."
              className="w-full rounded-lg border border-luna-700 bg-luna-950 px-3 py-2 text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
              required
            />
          </div>

          {/* Latitude & Longitude */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-slate-300 font-semibold flex items-center justify-between">
                <span>LATITUDE (DEG) *</span>
                <span className="text-[10px] text-cyan-400">[-90° to +90°]</span>
              </label>
              <input
                type="number"
                step="0.0001"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                placeholder="-89.5"
                className={`w-full rounded-lg border px-3 py-2 text-white focus:outline-none ${
                  isLatValid
                    ? 'border-luna-700 bg-luna-950 focus:border-cyan-500'
                    : 'border-rose-500 bg-rose-950/20'
                }`}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-300 font-semibold flex items-center justify-between">
                <span>LONGITUDE (DEG) *</span>
                <span className="text-[10px] text-cyan-400">[0° to 360°]</span>
              </label>
              <input
                type="number"
                step="0.0001"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                placeholder="125.0"
                className={`w-full rounded-lg border px-3 py-2 text-white focus:outline-none ${
                  isLonValid
                    ? 'border-luna-700 bg-luna-950 focus:border-cyan-500'
                    : 'border-rose-500 bg-rose-950/20'
                }`}
                required
              />
            </div>
          </div>

          {/* Polar Coverage Indicator */}
          <div className="flex items-center justify-between rounded-lg border border-luna-800 bg-luna-950 px-3 py-2 text-[11px]">
            <span className="text-slate-400 flex items-center space-x-1.5">
              <Compass className="h-3.5 w-3.5 text-cyan-400" />
              <span>Target Region:</span>
            </span>
            <span className={isSouthPole ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}>
              {isSouthPole ? 'Lunar South Pole Polar Circle (< -80°)' : 'Mid-Latitude / Global Moon'}
            </span>
          </div>

          {/* Elevation & Mast Height */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-slate-300 font-semibold flex items-center justify-between">
                <span>ELEVATION (M)</span>
                <span className="text-[10px] text-slate-500">Optional</span>
              </label>
              <input
                type="number"
                step="1"
                value={elevationM}
                onChange={(e) => setElevationM(e.target.value)}
                placeholder="Auto LOLA DEM"
                className="w-full rounded-lg border border-luna-700 bg-luna-950 px-3 py-2 text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
              />
              <span className="text-[10px] text-slate-500 block">
                Leave empty for automatic LOLA DEM sampling
              </span>
            </div>

            <div className="space-y-1">
              <label className="text-slate-300 font-semibold flex items-center justify-between">
                <span>MAST / LANDER HEIGHT (M)</span>
                <span className="text-[10px] text-slate-500">Default 2m</span>
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="100"
                value={observerHeightM}
                onChange={(e) => setObserverHeightM(e.target.value)}
                className="w-full rounded-lg border border-luna-700 bg-luna-950 px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
              />
              <span className="text-[10px] text-slate-500 block">
                Solar array &amp; antenna phase center height
              </span>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-slate-300 font-semibold">DESCRIPTION / NOTES (OPTIONAL)</label>
            <textarea
              rows="2"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Elevated rim vantage point with potential continuous summer illumination..."
              className="w-full rounded-lg border border-luna-700 bg-luna-950 px-3 py-2 text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none resize-none"
            />
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-luna-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-lg border border-luna-700 bg-luna-850 px-4 py-2 font-mono text-xs text-slate-300 hover:text-white hover:bg-luna-800 transition-colors"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim() || !isLatValid || !isLonValid}
              className="flex items-center space-x-2 rounded-lg border border-cyan-500/50 bg-cyan-500/20 px-5 py-2 font-mono text-xs font-bold text-cyan-300 hover:bg-cyan-500/30 transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>SAMPLING LOLA DEM...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 text-cyan-400" />
                  <span>REGISTER LANDING SITE</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
