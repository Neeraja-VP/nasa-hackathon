import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Layers,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Compass,
  MapPin,
  Eye,
  Crosshair,
  Info,
  Globe,
  Map,
} from 'lucide-react';
import {
  polarProject,
  polarUnproject,
  formatLatitude,
  formatLongitude,
  lunarHaversineDistanceKm,
} from '../../utils/coordinates';
import { LUNAR_SOUTH_POLE_FEATURES } from '../../utils/constants';

export default function LunarExplorer({
  sites = [],
  selectedSiteId,
  onSelectSite,
  currentSite,
  onNavigateTab,
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // View transform state
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Hover state
  const [hoveredSite, setHoveredSite] = useState(null);
  const [cursorCoords, setCursorCoords] = useState(null);

  // Map Layer Toggles
  const [layers, setLayers] = useState({
    grid: true,
    features: true,
    psrs: true,
    topoShading: true,
    earthZone: false,
  });

  // Center coordinate on canvas
  const getCanvasCenter = useCallback(() => {
    if (!canvasRef.current) return { cx: 250, cy: 250, radius: 220 };
    const w = canvasRef.current.width;
    const h = canvasRef.current.height;
    const radius = Math.min(w, h) * 0.44 * zoom;
    const cx = w / 2 + pan.x;
    const cy = h / 2 + pan.y;
    return { cx, cy, radius };
  }, [zoom, pan]);

  // Handle Resize
  useEffect(() => {
    function handleResize() {
      if (!canvasRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      canvasRef.current.width = rect.width * window.devicePixelRatio;
      canvasRef.current.height = rect.height * window.devicePixelRatio;
    }
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Main Canvas Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width;
    const h = canvas.height;

    ctx.save();
    ctx.clearRect(0, 0, w, h);

    // Deep space background with subtle radial gradient
    const bgGrad = ctx.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, Math.max(w, h) * 0.6);
    bgGrad.addColorStop(0, '#0B0F19');
    bgGrad.addColorStop(1, '#05070B');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    const { cx, cy, radius } = getCanvasCenter();

    // 1. Lunar Body Disk & Topographic Shading
    if (layers.topoShading) {
      const diskGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, radius);
      diskGrad.addColorStop(0, '#131B2E');
      diskGrad.addColorStop(0.5, '#101626');
      diskGrad.addColorStop(0.85, '#0D121F');
      diskGrad.addColorStop(1, '#070B14');
      ctx.fillStyle = diskGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();

      // Topographic Relief subtle contours
      ctx.strokeStyle = 'rgba(71, 92, 141, 0.15)';
      ctx.lineWidth = 1 * dpr;
      for (let f = 0.2; f < 1.0; f += 0.2) {
        ctx.beginPath();
        ctx.arc(cx, cy, radius * f, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // 2. Earth Line-of-Sight Visibility Overlay (Prime Meridian hemisphere faces Earth)
    if (layers.earthZone) {
      ctx.save();
      ctx.beginPath();
      // Arc covering longitudes -90° to +90° (facing Earth)
      ctx.arc(cx, cy, radius, -Math.PI, 0);
      ctx.fillStyle = 'rgba(6, 182, 212, 0.08)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.3)';
      ctx.setLineDash([4 * dpr, 4 * dpr]);
      ctx.stroke();
      ctx.restore();
    }

    // 3. Polar Selenographic Coordinate Grid
    if (layers.grid) {
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.25)';
      ctx.lineWidth = 1 * dpr;
      ctx.setLineDash([3 * dpr, 3 * dpr]);

      // Latitude rings (-88°, -86°, -84°, -82°, -80°)
      const lats = [-88, -86, -84, -82, -80];
      ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
      ctx.font = `${10 * dpr}px JetBrains Mono, monospace`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';

      lats.forEach((lat) => {
        const rRing = ((90 - Math.abs(lat)) / 10.0) * radius;
        ctx.beginPath();
        ctx.arc(cx, cy, rRing, 0, Math.PI * 2);
        ctx.stroke();

        // Label on left edge
        ctx.fillText(`${lat}°S`, cx - rRing + 6 * dpr, cy - 6 * dpr);
      });

      // Longitude radial rays (every 45°)
      ctx.setLineDash([2 * dpr, 4 * dpr]);
      for (let angleDeg = 0; angleDeg < 360; angleDeg += 45) {
        const rad = ((angleDeg - 90) * Math.PI) / 180.0;
        const xEdge = cx + radius * Math.cos(rad);
        const yEdge = cy + radius * Math.sin(rad);

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(xEdge, yEdge);
        ctx.stroke();

        // Azimuth / Longitude labels
        const xText = cx + (radius + 14 * dpr) * Math.cos(rad);
        const yText = cy + (radius + 14 * dpr) * Math.sin(rad);
        ctx.textAlign = 'center';
        ctx.fillText(`${angleDeg}°`, xText, yText);
      }
      ctx.setLineDash([]);
    }

    // 4. Permanently Shadowed Regions (PSRs) & Craters
    if (layers.features) {
      LUNAR_SOUTH_POLE_FEATURES.forEach((feat) => {
        const { x, y } = polarProject(feat.lat, feat.lon, cx, cy, radius);
        // Colatitude scale factor: 10° lat = radius px. 1° lat ≈ 30.3 km on Moon.
        // 10° lat ≈ 303 km. Scale: pxPerKm = radius / 303.
        const pxPerKm = radius / 303.0;
        const rPx = Math.max(feat.radiusKm * pxPerKm, 4 * dpr);

        // Crater Rim Outline
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, rPx, 0, Math.PI * 2);

        if (layers.psrs && feat.type === 'crater') {
          // Dark cold-trap PSR interior
          ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
          ctx.fill();
          // PSR cold volatile fringe
          ctx.strokeStyle = 'rgba(168, 85, 247, 0.4)';
          ctx.lineWidth = 1.5 * dpr;
          ctx.stroke();
        } else {
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
          ctx.lineWidth = 1 * dpr;
          ctx.stroke();
        }

        // Feature Label
        ctx.fillStyle = 'rgba(203, 213, 225, 0.7)';
        ctx.font = `${9 * dpr}px JetBrains Mono, monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(feat.name, x, y + rPx + 10 * dpr);
        ctx.restore();
      });
    }

    // 5. Lunar South Pole Axis (90.00° S Marker)
    ctx.save();
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.6)';
    ctx.lineWidth = 1.5 * dpr;
    ctx.beginPath();
    ctx.moveTo(cx - 8 * dpr, cy);
    ctx.lineTo(cx + 8 * dpr, cy);
    ctx.moveTo(cx, cy - 8 * dpr);
    ctx.lineTo(cx, cy + 8 * dpr);
    ctx.stroke();
    ctx.fillStyle = '#F59E0B';
    ctx.font = `${10 * dpr}px JetBrains Mono, monospace`;
    ctx.textAlign = 'left';
    ctx.fillText('90.0°S (POLE)', cx + 10 * dpr, cy - 10 * dpr);
    ctx.restore();

    // 6. Candidate Landing Sites
    sites.forEach((site) => {
      const isSelected = site.id === selectedSiteId;
      const isHovered = hoveredSite?.id === site.id;
      const { x, y } = polarProject(site.latitude, site.longitude, cx, cy, radius);

      ctx.save();

      if (isSelected) {
        // Outer pulsing beacon ring
        ctx.beginPath();
        ctx.arc(x, y, 14 * dpr, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(6, 182, 212, 0.15)';
        ctx.fill();
        ctx.strokeStyle = '#06B6D4';
        ctx.lineWidth = 2 * dpr;
        ctx.stroke();

        // Inner glowing core
        ctx.beginPath();
        ctx.arc(x, y, 5 * dpr, 0, Math.PI * 2);
        ctx.fillStyle = '#67E8F9';
        ctx.fill();

        // Selected Target Crosshair
        ctx.strokeStyle = '#22D3EE';
        ctx.lineWidth = 1 * dpr;
        ctx.beginPath();
        ctx.moveTo(x - 18 * dpr, y);
        ctx.lineTo(x + 18 * dpr, y);
        ctx.moveTo(x, y - 18 * dpr);
        ctx.lineTo(x, y + 18 * dpr);
        ctx.stroke();
      } else {
        // Regular candidate marker
        ctx.beginPath();
        ctx.arc(x, y, (isHovered ? 6 : 4.5) * dpr, 0, Math.PI * 2);
        ctx.fillStyle = isHovered ? '#38BDF8' : '#F59E0B';
        ctx.fill();
        ctx.strokeStyle = '#0B0F19';
        ctx.lineWidth = 1.5 * dpr;
        ctx.stroke();
      }

      // Candidate Site Name Banner
      ctx.fillStyle = isSelected ? '#FFFFFF' : isHovered ? '#38BDF8' : 'rgba(226, 232, 240, 0.85)';
      ctx.font = `${(isSelected || isHovered ? 11 : 9.5) * dpr}px JetBrains Mono, monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(site.name, x, y - (isSelected ? 16 : 10) * dpr);

      ctx.restore();
    });

    ctx.restore();
  }, [sites, selectedSiteId, hoveredSite, zoom, pan, layers, getCanvasCenter]);

  // Mouse Interaction Handlers
  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const mouseX = (e.clientX - rect.left) * dpr;
    const mouseY = (e.clientY - rect.top) * dpr;

    // Pan viewport if dragging
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
      return;
    }

    const { cx, cy, radius } = getCanvasCenter();

    // Compute cursor selenographic coordinates
    const coords = polarUnproject(mouseX, mouseY, cx, cy, radius);
    setCursorCoords(coords);

    // Hit test candidate landing sites (within 15px radius)
    let found = null;
    for (const site of sites) {
      const { x, y } = polarProject(site.latitude, site.longitude, cx, cy, radius);
      const dist = Math.hypot(mouseX - x, mouseY - y);
      if (dist <= 16 * dpr) {
        found = site;
        break;
      }
    }
    setHoveredSite(found);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleClick = (e) => {
    if (hoveredSite) {
      onSelectSite(hoveredSite.id);
    }
  };

  // Quick navigation preset focus
  const focusOnSite = (siteId) => {
    onSelectSite(siteId);
    setZoom(1.3);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-luna-800 bg-luna-950 shadow-xl">
      {/* Top Floating Control Bar */}
      <div className="absolute top-4 left-4 right-4 z-10 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        {/* Layer Toggles */}
        <div className="pointer-events-auto flex items-center space-x-1.5 rounded-xl border border-luna-800 bg-luna-900/90 p-1.5 backdrop-blur-md text-xs font-mono shadow-lg">
          <span className="text-slate-400 px-2 flex items-center space-x-1">
            <Layers className="h-3.5 w-3.5 text-cyan-400" />
            <span className="hidden sm:inline">LAYERS:</span>
          </span>

          {[
            { key: 'grid', label: 'Grid' },
            { key: 'features', label: 'Craters' },
            { key: 'psrs', label: 'PSRs' },
            { key: 'earthZone', label: 'Earth LOS' },
          ].map((l) => (
            <button
              key={l.key}
              onClick={() => setLayers({ ...layers, [l.key]: !layers[l.key] })}
              className={`rounded-lg px-2 py-1 text-[11px] transition-colors ${
                layers[l.key]
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'bg-luna-950/60 text-slate-500 border border-transparent hover:text-slate-300'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>

        {/* Zoom & View Controls & 3D / QuickMap Switch */}
        <div className="pointer-events-auto flex items-center space-x-2">
          {onNavigateTab && (
            <>
              <button
                onClick={() => onNavigateTab('quickmap')}
                className="flex items-center space-x-1.5 rounded-xl border border-blue-500/50 bg-gradient-to-r from-blue-950/80 to-indigo-950/80 px-3 py-1.5 text-xs font-mono font-semibold text-blue-300 shadow-lg backdrop-blur-md hover:bg-blue-500/20 hover:text-white transition-all group"
                title="Open LROC QuickMap (Stack #3314 & Solar Shadows)"
              >
                <Map className="h-4 w-4 text-blue-400 group-hover:scale-110 transition-transform" />
                <span className="hidden md:inline">LROC QUICKMAP</span>
              </button>

              <button
                onClick={() => onNavigateTab('moon3d')}
                className="flex items-center space-x-1.5 rounded-xl border border-cyan-500/50 bg-gradient-to-r from-cyan-950/80 to-blue-950/80 px-3 py-1.5 text-xs font-mono font-semibold text-cyan-300 shadow-lg backdrop-blur-md hover:bg-cyan-500/20 hover:text-white transition-all group"
                title="Switch to 3D Moon Surface Visualization (NASA LOLA DEM & Dynamic Sun)"
              >
                <Globe className="h-4 w-4 text-cyan-400 group-hover:rotate-12 transition-transform" />
                <span>3D SURFACE VIEW</span>
              </button>
            </>
          )}

          <div className="flex items-center space-x-1 rounded-xl border border-luna-800 bg-luna-900/90 p-1 backdrop-blur-md shadow-lg">
            <button
              onClick={() => setZoom((z) => Math.min(z * 1.25, 4.0))}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 hover:bg-luna-800 hover:text-white"
              title="Zoom In"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              onClick={() => setZoom((z) => Math.max(z / 1.25, 0.6))}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 hover:bg-luna-800 hover:text-white"
              title="Zoom Out"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                setZoom(1.0);
                setPan({ x: 0, y: 0 });
              }}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 hover:bg-luna-800 hover:text-white"
              title="Reset View"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Interactive Canvas */}
      <div ref={containerRef} className="relative flex-1 cursor-grab active:cursor-grabbing w-full h-full min-h-[460px]">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={handleClick}
          className="absolute inset-0 h-full w-full block"
        />

        {/* Hover Candidate Site Card Overlay */}
        {hoveredSite && (
          <div
            className="pointer-events-none absolute bottom-14 left-4 z-20 w-72 rounded-xl border border-cyan-500/40 bg-luna-900/95 p-3.5 shadow-2xl backdrop-blur-md transition-all animate-in fade-in"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-white">{hoveredSite.name}</span>
              <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 font-mono text-[10px] text-cyan-300">
                {hoveredSite.region}
              </span>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-[11px] text-slate-300">
              <div>
                <span className="text-slate-500 block text-[10px]">COORDINATES</span>
                <span>{formatLatitude(hoveredSite.latitude)}, {formatLongitude(hoveredSite.longitude)}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">ELEVATION / SLOPE</span>
                <span className="text-cyan-400 font-bold">{hoveredSite.elevation_m}m</span> &bull; {hoveredSite.slope_degrees}°
              </div>
            </div>

            <p className="mt-2 text-[10px] text-slate-400 line-clamp-2">{hoveredSite.description}</p>
            <div className="mt-2 pt-2 border-t border-white/10 text-[10px] text-cyan-400 font-mono flex items-center justify-between">
              <span>Click to select site</span>
              <Crosshair className="h-3 w-3" />
            </div>
          </div>
        )}
      </div>

      {/* Bottom Telemetry Bar: Coordinates Under Cursor & Legend */}
      <div className="flex flex-wrap items-center justify-between border-t border-luna-800 bg-luna-900/90 px-4 py-2.5 font-mono text-xs backdrop-blur-md z-10 shrink-0">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1.5 text-slate-300">
            <Compass className="h-3.5 w-3.5 text-cyan-400" />
            <span className="text-slate-500">CURSOR:</span>
            <span>
              {cursorCoords
                ? `${formatLatitude(cursorCoords.latitude)}, ${formatLongitude(cursorCoords.longitude)}`
                : 'Move cursor over map'}
            </span>
          </div>

          {currentSite && (
            <div className="hidden md:flex items-center space-x-1.5 text-slate-400 border-l border-luna-800 pl-4">
              <span className="text-slate-500">SELECTED:</span>
              <span className="text-amber-300 font-semibold">{currentSite.name}</span>
            </div>
          )}
        </div>

        {/* Quick Focus Landing Site Buttons */}
        <div className="hidden sm:flex items-center space-x-1.5">
          <span className="text-slate-500 text-[11px]">FOCUS:</span>
          {sites.slice(0, 3).map((s) => (
            <button
              key={s.id}
              onClick={() => focusOnSite(s.id)}
              className="rounded bg-luna-800 px-2 py-0.5 text-[10px] text-slate-300 hover:bg-cyan-500/20 hover:text-cyan-300 transition-colors"
            >
              {s.name.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
