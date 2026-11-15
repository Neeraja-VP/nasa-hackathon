import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Compass,
  Sun,
  Radio,
  Mountain,
  Layers,
  Play,
  Pause,
  RotateCcw,
  SkipBack,
  SkipForward,
  Clock,
  Zap,
  Wifi,
  WifiOff,
  AlertTriangle,
  Info,
  Maximize2,
  Minimize2,
  Calendar,
  Globe,
  Sliders,
  ShieldCheck,
} from 'lucide-react';
import MetricCard from '../common/MetricCard';
import LoadingState from '../common/LoadingState';
import ErrorState from '../common/ErrorState';
import DataSourceBanner from '../common/DataSourceBanner';
import SkyHorizon3D from './SkyHorizon3D';
import { formatAngle, formatHours, formatDateTime } from '../../utils/formatters';
import { formatLatitude, formatLongitude } from '../../utils/coordinates';

export default function SkyHorizonView({
  currentSite,
  missionConfig,
  illuminationData,
  communicationData,
  terrainHorizonData,
  loading,
  error,
  onRetry,
}) {
  // Active Time Index across synchronized time series
  const [timeIndex, setTimeIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1); // 1x, 5x, 10x, 25x
  const [viewMode, setViewMode] = useState('combined'); // 'combined' (Radar + 3D) | 'radar' | 'panorama' | '3d'
  const [maxRadarElevationDeg, setMaxRadarElevationDeg] = useState(12.0); // 10°, 15°, 45°, 90°

  const radarCanvasRef = useRef(null);
  const panoCanvasRef = useRef(null);
  const timerRef = useRef(null);

  // Synchronized time-series series
  const sunSeries = illuminationData?.time_series || [];
  const earthSeries = communicationData?.time_series || [];
  const totalSteps = Math.min(sunSeries.length, earthSeries.length) || sunSeries.length || 0;
  const stepHours = Number(missionConfig?.stepHours) || 2.0;

  // Clamp time index if series length changes
  useEffect(() => {
    if (timeIndex >= totalSteps && totalSteps > 0) {
      setTimeIndex(totalSteps - 1);
    }
  }, [totalSteps, timeIndex]);

  // Playback timer loop
  useEffect(() => {
    if (isPlaying && totalSteps > 1) {
      const intervalMs = Math.max(40, Math.floor(400 / playbackSpeed));
      timerRef.current = setInterval(() => {
        setTimeIndex((prev) => {
          if (prev >= totalSteps - 1) {
            setIsPlaying(false);
            return 0; // Loop or stop
          }
          return prev + 1;
        });
      }, intervalMs);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, totalSteps, playbackSpeed]);

  // Current active points at timeIndex
  const currentSun = sunSeries[timeIndex] || null;
  const currentEarth = earthSeries[timeIndex] || null;
  const currentTimestamp = currentSun?.timestamp || currentEarth?.timestamp || missionConfig?.startDate;

  // Mission Elapsed Time in hours & days
  const missionElapsedHours = timeIndex * stepHours;
  const metDays = Math.floor(missionElapsedHours / 24);
  const metRemHours = Math.floor(missionElapsedHours % 24);
  const metMinutes = Math.floor((missionElapsedHours % 1) * 60);
  const metFormatted = `MET +${String(metDays).padStart(2, '0')}d ${String(metRemHours).padStart(2, '0')}h ${String(metMinutes).padStart(2, '0')}m`;

  // Helper: Find terrain elevation at given azimuth from terrainHorizonData
  const getTerrainElevationAtAzimuth = useCallback(
    (azDeg) => {
      const pts = terrainHorizonData?.horizon_points;
      if (!pts || !pts.length) return 0.0;
      const az = ((azDeg % 360) + 360) % 360;
      const step = pts[1]?.azimuth_deg - pts[0]?.azimuth_deg || 1.0;
      const exactIdx = az / (step > 0 ? step : 1.0);
      const idx0 = Math.floor(exactIdx) % pts.length;
      const idx1 = (idx0 + 1) % pts.length;
      const frac = exactIdx - Math.floor(exactIdx);
      const el0 = pts[idx0]?.horizon_elevation_deg || 0.0;
      const el1 = pts[idx1]?.horizon_elevation_deg || 0.0;
      return Number(((1.0 - frac) * el0 + frac * el1).toFixed(2));
    },
    [terrainHorizonData]
  );

  // Current clearance calculations
  const sunTerrainEl = currentSun ? getTerrainElevationAtAzimuth(currentSun.sun_azimuth_deg) : 0.0;
  const earthTerrainEl = currentEarth ? getTerrainElevationAtAzimuth(currentEarth.earth_azimuth_deg) : 0.0;
  const sunClearanceDeg = currentSun ? Number((currentSun.sun_elevation_deg - sunTerrainEl).toFixed(2)) : 0.0;
  const earthClearanceDeg = currentEarth ? Number((currentEarth.earth_elevation_deg - earthTerrainEl).toFixed(2)) : 0.0;

  // Solar state classification
  const isSunGeometric = currentSun ? currentSun.sun_elevation_deg > 0.0 : false;
  const isSunVisible = currentSun ? (currentSun.is_sunlit_terrain ?? currentSun.is_sunlit ?? false) : false;
  const sunVisibilityStatus = !isSunGeometric
    ? 'BELOW_GEOMETRIC_HORIZON'
    : isSunVisible
    ? 'DIRECT_SUNLIGHT'
    : 'TERRAIN_OCCLUDED';

  // Earth state classification
  const isEarthGeometric = currentEarth ? currentEarth.earth_elevation_deg > 0.0 : false;
  const isEarthVisible = currentEarth ? currentEarth.is_earth_visible : false;
  const earthVisibilityStatus = !isEarthGeometric
    ? 'BELOW_GEOMETRIC_HORIZON'
    : isEarthVisible
    ? 'DIRECT_LINE_OF_SIGHT'
    : 'TERRAIN_OCCLUDED';

  // Predictive Event Calculations (Tasks 3 & 4)
  const eventMetrics = useMemo(() => {
    if (!sunSeries.length || timeIndex >= sunSeries.length) {
      return {
        sunTransitionTime: null,
        sunTransitionLabel: 'None detected',
        remainingSunlightHours: 0,
        earthTransitionTime: null,
        earthTransitionLabel: 'None detected',
        remainingEarthHours: 0,
      };
    }

    let sunTransHours = null;
    let sunTransLabel = 'No transition in window';
    let remSunHours = 0;

    for (let i = timeIndex; i < sunSeries.length; i++) {
      const pt = sunSeries[i];
      const isVisible = pt.is_sunlit_terrain ?? pt.is_sunlit;
      if (isVisible) remSunHours += stepHours;

      if (sunTransHours === null && i > timeIndex) {
        const prev = sunSeries[i - 1];
        const prevVis = prev.is_sunlit_terrain ?? prev.is_sunlit;
        if (prevVis !== isVisible) {
          sunTransHours = (i - timeIndex) * stepHours;
          if (prevVis && !isVisible) {
            sunTransLabel =
              pt.sun_elevation_deg < 0
                ? 'Astronomical Sunset (Geometric)'
                : `Terrain Ingress (Shadow Entry behind peak @ ${formatAngle(getTerrainElevationAtAzimuth(pt.sun_azimuth_deg))})`;
          } else {
            sunTransLabel =
              prev.sun_elevation_deg < 0
                ? 'Astronomical Sunrise (Geometric)'
                : 'Terrain Egress (Sunlight Restored)';
          }
        }
      }
    }

    let earthTransHours = null;
    let earthTransLabel = 'No transition in window';
    let remEarthHours = 0;

    for (let i = timeIndex; i < earthSeries.length; i++) {
      const pt = earthSeries[i];
      if (pt.is_earth_visible) remEarthHours += stepHours;

      if (earthTransHours === null && i > timeIndex) {
        const prev = earthSeries[i - 1];
        if (prev.is_earth_visible !== pt.is_earth_visible) {
          earthTransHours = (i - timeIndex) * stepHours;
          if (prev.is_earth_visible && !pt.is_earth_visible) {
            earthTransLabel =
              pt.earth_elevation_deg < 0
                ? 'Earthset (Libration Sub-Horizon)'
                : 'Earth Occlusion (Terrain Blocked)';
          } else {
            earthTransLabel =
              prev.earth_elevation_deg < 0
                ? 'Earthrise (Libration Clearance)'
                : 'Earth AOS (Terrain Clearance)';
          }
        }
      }
    }

    return {
      sunTransitionTime: sunTransHours,
      sunTransitionLabel: sunTransLabel,
      remainingSunlightHours: Number(remSunHours.toFixed(1)),
      earthTransitionTime: earthTransHours,
      earthTransitionLabel: earthTransLabel,
      remainingEarthHours: Number(remEarthHours.toFixed(1)),
    };
  }, [sunSeries, earthSeries, timeIndex, stepHours, getTerrainElevationAtAzimuth]);

  // 1. Canvas 2D Rendering: Polar All-Sky Radar Dome (Task 1, 2, 6)
  useEffect(() => {
    const canvas = radarCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;
    const maxRadius = Math.min(w, h) * 0.43;

    // Helper: Map topocentric (Azimuth, Elevation) to canvas coordinate
    // 0° Azimuth = North (Top, -Y), 90° = East (Right, +X), 180° = South, 270° = West
    // Center = Zenith (maxRadarElevationDeg)
    // Outer perimeter = Horizon (-2° to 0° elevation)
    const mapSky = (azDeg, elDeg) => {
      const clampedEl = Math.max(-2.0, Math.min(elDeg, maxRadarElevationDeg));
      const normDist = (maxRadarElevationDeg - clampedEl) / (maxRadarElevationDeg + 2.0);
      const r = Math.max(0, normDist * maxRadius);
      const rad = ((azDeg - 90.0) * Math.PI) / 180.0;
      return {
        x: cx + r * Math.cos(rad),
        y: cy + r * Math.sin(rad),
        r,
      };
    };

    // A. Concentric Elevation Reference Rings
    const rings = [0, 2, 4, 6, 8, maxRadarElevationDeg];
    ctx.lineWidth = 1 * dpr;

    rings.forEach((el) => {
      const { r } = mapSky(0, el);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = el === 0 ? 'rgba(239, 68, 68, 0.5)' : 'rgba(100, 116, 139, 0.22)';
      ctx.setLineDash(el === 0 ? [4 * dpr, 3 * dpr] : [2 * dpr, 4 * dpr]);
      ctx.stroke();

      // Elevation labels
      ctx.fillStyle = el === 0 ? '#EF4444' : '#64748B';
      ctx.font = `${8.5 * dpr}px JetBrains Mono, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(el === 0 ? '0° (Geom)' : `${el}°`, cx, cy - r - 2 * dpr);
    });

    // B. Cardinal & Ordinal Azimuth Radial Rays
    const cardinals = [
      { az: 0, label: 'N (0°)' },
      { az: 45, label: 'NE' },
      { az: 90, label: 'E (90°)' },
      { az: 135, label: 'SE' },
      { az: 180, label: 'S (180°)' },
      { az: 225, label: 'SW' },
      { az: 270, label: 'W (270°)' },
      { az: 315, label: 'NW' },
    ];

    cardinals.forEach((c) => {
      const rad = ((c.az - 90.0) * Math.PI) / 180.0;
      const xOuter = cx + maxRadius * Math.cos(rad);
      const yOuter = cy + maxRadius * Math.sin(rad);

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(xOuter, yOuter);
      ctx.strokeStyle = c.az % 90 === 0 ? 'rgba(148, 163, 184, 0.3)' : 'rgba(71, 85, 105, 0.15)';
      ctx.setLineDash([2 * dpr, 4 * dpr]);
      ctx.stroke();

      // Cardinal Labels
      const xText = cx + (maxRadius + 14 * dpr) * Math.cos(rad);
      const yText = cy + (maxRadius + 14 * dpr) * Math.sin(rad);
      ctx.fillStyle = c.az % 90 === 0 ? '#38BDF8' : '#64748B';
      ctx.font = `bold ${9 * dpr}px JetBrains Mono, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(c.label, xText, yText);
    });
    ctx.setLineDash([]);

    // C. Local Terrain Horizon Obstruction Mask (Task 2)
    const horizonPts = terrainHorizonData?.horizon_points || [];
    if (horizonPts.length > 0) {
      ctx.save();
      ctx.beginPath();

      // Outer bounding rim
      ctx.arc(cx, cy, maxRadius, 0, Math.PI * 2);

      // Inner variable-elevation terrain contour
      for (let i = horizonPts.length - 1; i >= 0; i--) {
        const pt = horizonPts[i];
        const { x, y } = mapSky(pt.azimuth_deg, pt.horizon_elevation_deg);
        ctx.lineTo(x, y);
      }
      ctx.closePath();

      // Shaded relief fill (Terrain obstructed region)
      ctx.fillStyle = 'rgba(239, 68, 68, 0.12)';
      ctx.fill();

      // Terrain Ridge Crest Line
      ctx.beginPath();
      horizonPts.forEach((pt, idx) => {
        const { x, y } = mapSky(pt.azimuth_deg, pt.horizon_elevation_deg);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 1.6 * dpr;
      ctx.stroke();
      ctx.restore();
    }

    // D. Solar Orbital Trajectory Path (Amber trace)
    if (sunSeries.length > 1) {
      ctx.save();
      ctx.beginPath();
      sunSeries.forEach((pt, idx) => {
        const { x, y } = mapSky(pt.sun_azimuth_deg, pt.sun_elevation_deg);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
      ctx.lineWidth = 1.5 * dpr;
      ctx.stroke();
      ctx.restore();
    }

    // E. Earth Libration Path (Cyan trace)
    if (earthSeries.length > 1) {
      ctx.save();
      ctx.beginPath();
      earthSeries.forEach((pt, idx) => {
        const { x, y } = mapSky(pt.earth_azimuth_deg, pt.earth_elevation_deg);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
      ctx.lineWidth = 1.5 * dpr;
      ctx.stroke();
      ctx.restore();
    }

    // F. Current Sun Marker (Task 3 & 6)
    if (currentSun) {
      const { x, y } = mapSky(currentSun.sun_azimuth_deg, currentSun.sun_elevation_deg);
      ctx.save();

      // Corona glow if visible
      if (isSunVisible) {
        ctx.beginPath();
        ctx.arc(x, y, 12 * dpr, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(245, 158, 11, 0.25)';
        ctx.fill();
      }

      // Sun core disc
      ctx.beginPath();
      ctx.arc(x, y, 6 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = isSunVisible ? '#F59E0B' : '#78350F';
      ctx.fill();
      ctx.strokeStyle = isSunVisible ? '#FFFBEB' : '#EF4444';
      ctx.lineWidth = 1.8 * dpr;
      ctx.stroke();

      // Sun label
      ctx.fillStyle = '#FBBF24';
      ctx.font = `bold ${8.5 * dpr}px JetBrains Mono, monospace`;
      ctx.textAlign = 'left';
      ctx.fillText(` SUN ${formatAngle(currentSun.sun_elevation_deg)}`, x + 8 * dpr, y - 4 * dpr);
      ctx.restore();
    }

    // G. Current Earth Marker (Task 4 & 6)
    if (currentEarth) {
      const { x, y } = mapSky(currentEarth.earth_azimuth_deg, currentEarth.earth_elevation_deg);
      ctx.save();

      // Earth atmosphere glow if visible
      if (isEarthVisible) {
        ctx.beginPath();
        ctx.arc(x, y, 11 * dpr, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(6, 182, 212, 0.25)';
        ctx.fill();
      }

      // Earth disc
      ctx.beginPath();
      ctx.arc(x, y, 5.5 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = isEarthVisible ? '#06B6D4' : '#164E63';
      ctx.fill();
      ctx.strokeStyle = isEarthVisible ? '#FFFFFF' : '#EF4444';
      ctx.lineWidth = 1.8 * dpr;
      ctx.stroke();

      // Earth label
      ctx.fillStyle = '#38BDF8';
      ctx.font = `bold ${8.5 * dpr}px JetBrains Mono, monospace`;
      ctx.textAlign = 'left';
      ctx.fillText(` EARTH ${formatAngle(currentEarth.earth_elevation_deg)}`, x + 8 * dpr, y + 10 * dpr);
      ctx.restore();
    }
  }, [
    terrainHorizonData,
    sunSeries,
    earthSeries,
    currentSun,
    currentEarth,
    isSunVisible,
    isEarthVisible,
    maxRadarElevationDeg,
  ]);

  // 2. Canvas 2D Rendering: 360° Unrolled Horizon Skyline Panorama (Task 2 & 6)
  useEffect(() => {
    if (viewMode !== 'panorama' && viewMode !== 'combined') return;
    const canvas = panoCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const padLeft = 40 * dpr;
    const padRight = 20 * dpr;
    const padTop = 20 * dpr;
    const padBottom = 25 * dpr;

    const plotW = w - padLeft - padRight;
    const plotH = h - padTop - padBottom;

    // Y Axis Range: -4° to +12° elevation
    const elMin = -4.0;
    const elMax = 12.0;
    const mapY = (el) => padTop + (1.0 - (el - elMin) / (elMax - elMin)) * plotH;
    const mapX = (az) => padLeft + ((az % 360) / 360.0) * plotW;

    // Elevation Grid & Zero Reference Line
    ctx.lineWidth = 1 * dpr;
    [-2, 0, 2, 4, 6, 8, 10].forEach((el) => {
      const y = mapY(el);
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(w - padRight, y);
      ctx.strokeStyle = el === 0 ? 'rgba(239, 68, 68, 0.6)' : 'rgba(100, 116, 139, 0.2)';
      ctx.setLineDash(el === 0 ? [] : [2 * dpr, 4 * dpr]);
      ctx.stroke();

      ctx.fillStyle = el === 0 ? '#EF4444' : '#64748B';
      ctx.font = `${8.5 * dpr}px JetBrains Mono, monospace`;
      ctx.textAlign = 'right';
      ctx.fillText(`${el}°`, padLeft - 6 * dpr, y + 3 * dpr);
    });
    ctx.setLineDash([]);

    // Azimuth Grid & Cardinal Ticks
    [0, 45, 90, 135, 180, 225, 270, 315, 360].forEach((az) => {
      const x = mapX(az);
      ctx.beginPath();
      ctx.moveTo(x, padTop);
      ctx.lineTo(x, h - padBottom);
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.18)';
      ctx.setLineDash([2 * dpr, 4 * dpr]);
      ctx.stroke();

      const labels = {
        0: 'N 0°',
        45: 'NE',
        90: 'E 90°',
        135: 'SE',
        180: 'S 180°',
        225: 'SW',
        270: 'W 270°',
        315: 'NW',
        360: 'N 360°',
      };
      ctx.fillStyle = az % 90 === 0 ? '#38BDF8' : '#64748B';
      ctx.font = `${8.5 * dpr}px JetBrains Mono, monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(labels[az], x, h - 8 * dpr);
    });
    ctx.setLineDash([]);

    // LOLA 360° Terrain Horizon Silhouette Relief
    const horizonPts = terrainHorizonData?.horizon_points || [];
    if (horizonPts.length > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(mapX(0), mapY(elMin));

      horizonPts.forEach((pt) => {
        ctx.lineTo(mapX(pt.azimuth_deg), mapY(pt.horizon_elevation_deg));
      });
      ctx.lineTo(mapX(360), mapY(horizonPts[0].horizon_elevation_deg));
      ctx.lineTo(mapX(360), mapY(elMin));
      ctx.closePath();

      // Terrain Relief Gradient Fill
      const grad = ctx.createLinearGradient(0, mapY(8), 0, mapY(elMin));
      grad.addColorStop(0, 'rgba(239, 68, 68, 0.35)');
      grad.addColorStop(1, 'rgba(15, 23, 42, 0.85)');
      ctx.fillStyle = grad;
      ctx.fill();

      // Mountain Ridge Crest Line
      ctx.beginPath();
      horizonPts.forEach((pt, idx) => {
        const x = mapX(pt.azimuth_deg);
        const y = mapY(pt.horizon_elevation_deg);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.lineTo(mapX(360), mapY(horizonPts[0].horizon_elevation_deg));
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 2 * dpr;
      ctx.stroke();
      ctx.restore();
    }

    // Current Sun Position on Skyline
    if (currentSun) {
      const sx = mapX(currentSun.sun_azimuth_deg);
      const sy = mapY(currentSun.sun_elevation_deg);

      ctx.save();
      // Corona glow
      if (isSunVisible) {
        ctx.beginPath();
        ctx.arc(sx, sy, 14 * dpr, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(245, 158, 11, 0.3)';
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(sx, sy, 7 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = isSunVisible ? '#F59E0B' : '#78350F';
      ctx.fill();
      ctx.strokeStyle = isSunVisible ? '#FFFBEB' : '#EF4444';
      ctx.lineWidth = 2 * dpr;
      ctx.stroke();

      // Drop guide line to ground
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx, h - padBottom);
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)';
      ctx.setLineDash([2 * dpr, 3 * dpr]);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#FBBF24';
      ctx.font = `bold ${9 * dpr}px JetBrains Mono, monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(`SUN ${formatAngle(currentSun.sun_elevation_deg)}`, sx, sy - 11 * dpr);
      ctx.restore();
    }

    // Current Earth Position on Skyline
    if (currentEarth) {
      const ex = mapX(currentEarth.earth_azimuth_deg);
      const ey = mapY(currentEarth.earth_elevation_deg);

      ctx.save();
      if (isEarthVisible) {
        ctx.beginPath();
        ctx.arc(ex, ey, 13 * dpr, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(6, 182, 212, 0.3)';
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(ex, ey, 6.5 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = isEarthVisible ? '#06B6D4' : '#164E63';
      ctx.fill();
      ctx.strokeStyle = isEarthVisible ? '#FFFFFF' : '#EF4444';
      ctx.lineWidth = 2 * dpr;
      ctx.stroke();

      // Drop guide line to ground
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex, h - padBottom);
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.35)';
      ctx.setLineDash([2 * dpr, 3 * dpr]);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#38BDF8';
      ctx.font = `bold ${9 * dpr}px JetBrains Mono, monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(`EARTH ${formatAngle(currentEarth.earth_elevation_deg)}`, ex, ey - 11 * dpr);
      ctx.restore();
    }
  }, [
    terrainHorizonData,
    currentSun,
    currentEarth,
    isSunVisible,
    isEarthVisible,
    viewMode,
  ]);

  if (loading) {
    return (
      <LoadingState
        title="Generating Local Sky-Horizon Elevation Model..."
        subtitle="Synchronizing NASA LOLA 360° terrain obstruction profiles with JPL Horizons topocentric Sun & Earth ephemerides."
      />
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Sky Horizon Visualization Error"
        message={error}
        onRetry={onRetry}
      />
    );
  }

  if (!sunSeries.length && !earthSeries.length) {
    return (
      <div className="rounded-2xl border border-luna-800 bg-luna-900/60 p-10 text-center font-mono text-xs text-slate-500">
        No ephemeris or terrain horizon telemetry available. Please select a candidate landing site.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 0. DATA SOURCE PROVENANCE BANNER */}
      <DataSourceBanner
        ephemerisSource={illuminationData?.data_source || communicationData?.data_source}
        ephemerisType={illuminationData?.data_source_type || communicationData?.data_source_type}
        terrainSource={terrainHorizonData?.terrain_data_source}
        demResolutionM={terrainHorizonData?.dem_resolution_m}
        isProceduralFallback={terrainHorizonData?.is_procedural_fallback}
        warningMessage={
          illuminationData?.data_quality_warning ||
          communicationData?.data_quality_warning ||
          terrainHorizonData?.data_quality_warning
        }
      />

      {/* 1. TOP DUAL CELESTIAL METRIC GAUGES (Tasks 3 & 4) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Sun Elevation & Clearance */}
        <div className="rounded-2xl border border-luna-800 bg-luna-900/70 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-amber-400 flex items-center space-x-1.5">
              <Sun className="h-4 w-4" />
              <span>Solar Topocentric</span>
            </span>
            <span
              className={`rounded px-1.5 py-0.5 text-[9px] font-mono font-bold ${
                isSunVisible
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
              }`}
            >
              {sunVisibilityStatus}
            </span>
          </div>
          <div className="flex items-baseline justify-between font-mono">
            <div>
              <div className="text-xl font-extrabold text-white">
                {currentSun ? formatAngle(currentSun.sun_elevation_deg) : '—'}
              </div>
              <div className="text-[10px] text-slate-400">Azimuth: {currentSun?.sun_azimuth_deg?.toFixed(1)}°</div>
            </div>
            <div className="text-right">
              <div className="text-xs font-bold text-amber-300">
                {sunClearanceDeg >= 0 ? `+${sunClearanceDeg}°` : `${sunClearanceDeg}°`}
              </div>
              <div className="text-[10px] text-slate-400">Terrain Clearance</div>
            </div>
          </div>
          <div className="border-t border-luna-800/80 pt-2 text-[10px] font-mono text-slate-400">
            Next Event: <span className="text-slate-200">{eventMetrics.sunTransitionLabel}</span>
            {eventMetrics.sunTransitionTime !== null && (
              <span className="text-amber-400 ml-1">({formatHours(eventMetrics.sunTransitionTime)})</span>
            )}
          </div>
        </div>

        {/* Earth Elevation & Clearance */}
        <div className="rounded-2xl border border-luna-800 bg-luna-900/70 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-cyan-400 flex items-center space-x-1.5">
              <Radio className="h-4 w-4" />
              <span>Earth (DTE Radio)</span>
            </span>
            <span
              className={`rounded px-1.5 py-0.5 text-[9px] font-mono font-bold ${
                isEarthVisible
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
              }`}
            >
              {earthVisibilityStatus}
            </span>
          </div>
          <div className="flex items-baseline justify-between font-mono">
            <div>
              <div className="text-xl font-extrabold text-white">
                {currentEarth ? formatAngle(currentEarth.earth_elevation_deg) : '—'}
              </div>
              <div className="text-[10px] text-slate-400">Azimuth: {currentEarth?.earth_azimuth_deg?.toFixed(1)}°</div>
            </div>
            <div className="text-right">
              <div className="text-xs font-bold text-cyan-300">
                {earthClearanceDeg >= 0 ? `+${earthClearanceDeg}°` : `${earthClearanceDeg}°`}
              </div>
              <div className="text-[10px] text-slate-400">Terrain Clearance</div>
            </div>
          </div>
          <div className="border-t border-luna-800/80 pt-2 text-[10px] font-mono text-slate-400">
            Next Event: <span className="text-slate-200">{eventMetrics.earthTransitionLabel}</span>
            {eventMetrics.earthTransitionTime !== null && (
              <span className="text-cyan-400 ml-1">({formatHours(eventMetrics.earthTransitionTime)})</span>
            )}
          </div>
        </div>

        {/* Total Mission Sunlight Remaining */}
        <MetricCard
          label="Sunlight Remaining"
          value={formatHours(eventMetrics.remainingSunlightHours)}
          sublabel={`Out of ${formatHours(illuminationData?.total_sunlit_hours || 0)} total mission sun`}
          icon={Zap}
          status="solar"
        />

        {/* Total Direct-to-Earth Comm Remaining */}
        <MetricCard
          label="Earth LOS Remaining"
          value={formatHours(eventMetrics.remainingEarthHours)}
          sublabel={`Out of ${formatHours(communicationData?.total_visible_hours || 0)} total DTE window`}
          icon={Wifi}
          status="earth"
        />
      </div>

      {/* 2. INTERACTIVE MISSION TIMELINE CONTROLS (Task 5) */}
      <div className="rounded-2xl border border-luna-800 bg-luna-900/80 p-4 space-y-3 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Epoch & MET Readout */}
          <div className="flex items-center space-x-3 font-mono">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <Clock className="h-4 w-4" />
            </span>
            <div>
              <div className="text-sm font-bold text-white flex items-center space-x-2">
                <span>{formatDateTime(currentTimestamp)}</span>
                <span className="rounded bg-cyan-950 px-2 py-0.5 text-xs text-cyan-300 border border-cyan-800">
                  {metFormatted}
                </span>
              </div>
              <div className="text-[10px] text-slate-400">
                Epoch Step {timeIndex + 1} of {totalSteps} ({stepHours}h interval) &bull; Observer Mast: {missionConfig?.mastHeightM || 2.0}m
              </div>
            </div>
          </div>

          {/* VCR Playback Action Buttons */}
          <div className="flex items-center space-x-1.5 font-mono text-xs">
            {/* Reset */}
            <button
              onClick={() => {
                setTimeIndex(0);
                setIsPlaying(false);
              }}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-luna-800 bg-luna-950 text-slate-400 hover:text-white hover:border-luna-700 transition-colors"
              title="Reset to Mission Start (T+0)"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>

            {/* Step Backward */}
            <button
              onClick={() => setTimeIndex((prev) => Math.max(0, prev - 1))}
              disabled={timeIndex === 0}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-luna-800 bg-luna-950 text-slate-300 hover:text-white hover:border-luna-700 transition-colors disabled:opacity-30"
              title="Step Backward (1 epoch)"
            >
              <SkipBack className="h-3.5 w-3.5" />
            </button>

            {/* Play / Pause Toggle */}
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className={`flex items-center space-x-1.5 rounded-lg px-3 py-1.5 font-bold transition-all shadow-md ${
                isPlaying
                  ? 'border border-amber-500/50 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                  : 'border border-cyan-500/50 bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30'
              }`}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              <span>{isPlaying ? 'PAUSE' : 'PLAY'}</span>
            </button>

            {/* Step Forward */}
            <button
              onClick={() => setTimeIndex((prev) => Math.min(totalSteps - 1, prev + 1))}
              disabled={timeIndex >= totalSteps - 1}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-luna-800 bg-luna-950 text-slate-300 hover:text-white hover:border-luna-700 transition-colors disabled:opacity-30"
              title="Step Forward (1 epoch)"
            >
              <SkipForward className="h-3.5 w-3.5" />
            </button>

            {/* Playback Speed Select */}
            <div className="flex items-center space-x-1 rounded-lg border border-luna-800 bg-luna-950 px-2 py-1 text-[11px] text-slate-400">
              <span className="text-[10px] text-slate-500">SPEED:</span>
              {[1, 5, 10, 25].map((sp) => (
                <button
                  key={sp}
                  onClick={() => setPlaybackSpeed(sp)}
                  className={`rounded px-1.5 py-0.5 transition-colors ${
                    playbackSpeed === sp
                      ? 'bg-cyan-500/30 text-cyan-200 font-bold'
                      : 'hover:text-slate-200'
                  }`}
                >
                  {sp}x
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Timeline Slider */}
        <div className="space-y-1 pt-1">
          <input
            type="range"
            min="0"
            max={Math.max(0, totalSteps - 1)}
            value={timeIndex}
            onChange={(e) => setTimeIndex(Number(e.target.value))}
            className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-luna-950 border border-luna-700 accent-cyan-400"
          />
          <div className="flex justify-between font-mono text-[10px] text-slate-500">
            <span>T+00h (Mission Start)</span>
            <span className="text-cyan-400 font-semibold">{metFormatted}</span>
            <span>T+{(totalSteps * stepHours).toFixed(0)}h ({missionConfig?.durationDays} days)</span>
          </div>
        </div>
      </div>

      {/* 3. MAIN SKY-HORIZON VISUALIZATION WORKSPACE (Tasks 1, 2, 6, 7) */}
      <div className="rounded-2xl border border-luna-800 bg-luna-900/80 p-5 space-y-4 shadow-xl">
        {/* Workspace Subheader & View Mode Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-luna-800">
          <div>
            <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-white flex items-center space-x-2">
              <Compass className="h-4 w-4 text-cyan-400" />
              <span>Combined 360° Sky-Horizon View</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Simultaneous topocentric Sun &amp; Earth trajectories plotted against {currentSite?.name} LOLA DEM terrain horizon.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Switcher */}
            <div className="flex items-center space-x-1 rounded-xl border border-luna-800 bg-luna-950 p-1 text-xs font-mono">
              {[
                { id: 'combined', label: 'Dual Radar + 3D' },
                { id: 'radar', label: '360° All-Sky Dome' },
                { id: 'panorama', label: 'Panorama Skyline' },
                { id: '3d', label: '3D Local Scene' },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setViewMode(m.id)}
                  className={`rounded-lg px-2.5 py-1 transition-all ${
                    viewMode === m.id
                      ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40 shadow-sm font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Radar Zoom Level */}
            {(viewMode === 'combined' || viewMode === 'radar') && (
              <div className="flex items-center space-x-1 rounded-xl border border-luna-800 bg-luna-950 px-2 py-1 text-xs font-mono text-slate-400">
                <span className="text-[10px] text-slate-500">CEILING:</span>
                {[12, 20, 45].map((deg) => (
                  <button
                    key={deg}
                    onClick={() => setMaxRadarElevationDeg(deg)}
                    className={`rounded px-1.5 py-0.5 transition-colors ${
                      maxRadarElevationDeg === deg
                        ? 'bg-cyan-500/30 text-cyan-300 font-bold'
                        : 'hover:text-slate-200'
                    }`}
                  >
                    +{deg}°
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* VIEW CONTAINER */}
        <div className="space-y-4">
          {/* COMBINED DUAL VIEW: Radar All-Sky + Synchronized 3D Scene */}
          {viewMode === 'combined' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Left Column: All-Sky Radar Dome */}
              <div className="relative flex flex-col items-center justify-center rounded-xl border border-luna-800 bg-luna-950/70 p-3 aspect-square min-h-[360px]">
                <canvas
                  ref={radarCanvasRef}
                  width={520}
                  height={520}
                  className="h-full w-full max-h-[460px] max-w-[460px]"
                />
                <div className="absolute top-3 left-3 font-mono text-[11px] font-semibold text-slate-300">
                  ALL-SKY AZIMUTH POLAR RADAR
                </div>
              </div>

              {/* Right Column: Synchronized 3D Topocentric Scene */}
              <div className="flex flex-col rounded-xl border border-luna-800 bg-luna-950/70 p-1 min-h-[360px] h-full">
                <SkyHorizon3D
                  currentSite={currentSite}
                  currentPoint={{
                    sun_azimuth_deg: currentSun?.sun_azimuth_deg || 0,
                    sun_elevation_deg: currentSun?.sun_elevation_deg || 0,
                    is_sun_visible: isSunVisible,
                    earth_azimuth_deg: currentEarth?.earth_azimuth_deg || 0,
                    earth_elevation_deg: currentEarth?.earth_elevation_deg || 0,
                    is_earth_visible: isEarthVisible,
                  }}
                  terrainHorizonData={terrainHorizonData}
                />
              </div>
            </div>
          )}

          {/* SINGLE VIEW: 360° All-Sky Dome Radar */}
          {viewMode === 'radar' && (
            <div className="relative flex flex-col items-center justify-center rounded-xl border border-luna-800 bg-luna-950/70 p-4 min-h-[480px]">
              <canvas
                ref={radarCanvasRef}
                width={640}
                height={640}
                className="h-full w-full max-h-[580px] max-w-[580px]"
              />
              <div className="absolute top-4 left-4 font-mono text-xs font-semibold text-slate-300">
                ALL-SKY 360° AZIMUTH RADAR PROJECTION
              </div>
            </div>
          )}

          {/* SINGLE VIEW: 360° Panoramic Skyline Horizon */}
          {viewMode === 'panorama' && (
            <div className="relative rounded-xl border border-luna-800 bg-luna-950/70 p-4 min-h-[360px]">
              <div className="pb-2 font-mono text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>UNROLLED 360° HORIZON SKYLINE (CYLINDRICAL EQUIRECTANGULAR)</span>
                <span className="text-slate-500 font-normal">North (0°) &rarr; East &rarr; South &rarr; West &rarr; North (360°)</span>
              </div>
              <canvas
                ref={panoCanvasRef}
                width={1000}
                height={340}
                className="h-72 w-full rounded-lg bg-slate-950"
              />
            </div>
          )}

          {/* SINGLE VIEW: Interactive Three.js 3D Scene */}
          {viewMode === '3d' && (
            <div className="rounded-xl border border-luna-800 bg-luna-950/70 p-1 h-[500px]">
              <SkyHorizon3D
                currentSite={currentSite}
                currentPoint={{
                  sun_azimuth_deg: currentSun?.sun_azimuth_deg || 0,
                  sun_elevation_deg: currentSun?.sun_elevation_deg || 0,
                  is_sun_visible: isSunVisible,
                  earth_azimuth_deg: currentEarth?.earth_azimuth_deg || 0,
                  earth_elevation_deg: currentEarth?.earth_elevation_deg || 0,
                  is_earth_visible: isEarthVisible,
                }}
                terrainHorizonData={terrainHorizonData}
              />
            </div>
          )}

          {/* Always display Panoramic Skyline at the bottom when in Combined Mode */}
          {viewMode === 'combined' && (
            <div className="relative rounded-xl border border-luna-800 bg-luna-950/70 p-3 pt-2">
              <div className="flex items-center justify-between pb-1.5 font-mono text-[11px] font-semibold text-slate-300">
                <span>360° UNROLLED HORIZON PANORAMA (LOLA DEM SILHOUETTE)</span>
                <span className="text-[10px] text-slate-500">Azimuth 0° (North) &rarr; 360°</span>
              </div>
              <canvas
                ref={panoCanvasRef}
                width={1000}
                height={220}
                className="h-44 w-full rounded-lg bg-slate-950"
              />
            </div>
          )}
        </div>

        {/* 4. SCIENTIFIC VISUALIZATION LEGEND (Task 6) */}
        <div className="rounded-xl border border-luna-800/80 bg-luna-950/80 p-3.5 space-y-2 text-xs font-mono">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Horizon Map Legend &amp; Symbology
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-[11px]">
            {/* Sun */}
            <div className="flex items-center space-x-2">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 border border-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.5)]">
                <Sun className="h-2.5 w-2.5 text-black" />
              </span>
              <span className="text-slate-300">Sun Position</span>
            </div>

            {/* Earth */}
            <div className="flex items-center space-x-2">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-cyan-500 border border-white shadow-[0_0_8px_rgba(6,182,212,0.5)]">
                <Radio className="h-2.5 w-2.5 text-black" />
              </span>
              <span className="text-slate-300">Earth (DTE)</span>
            </div>

            {/* Terrain Horizon */}
            <div className="flex items-center space-x-2">
              <span className="h-2.5 w-5 rounded-sm bg-rose-500/80 border border-rose-400" />
              <span className="text-slate-300">Terrain Horizon</span>
            </div>

            {/* Geometric Horizon */}
            <div className="flex items-center space-x-2">
              <span className="h-0.5 w-5 border-t border-dashed border-red-500" />
              <span className="text-slate-300">Geometric (0°)</span>
            </div>

            {/* Visible Region */}
            <div className="flex items-center space-x-2">
              <span className="h-2.5 w-5 rounded-sm bg-slate-900 border border-slate-700" />
              <span className="text-slate-300">Visible Sky</span>
            </div>

            {/* Obstructed Region */}
            <div className="flex items-center space-x-2">
              <span className="h-2.5 w-5 rounded-sm bg-rose-500/20 border border-rose-500/40" />
              <span className="text-slate-300">Terrain Shadow</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
