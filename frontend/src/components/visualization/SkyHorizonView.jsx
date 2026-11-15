import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Compass,
  Sun,
  Radio,
  Mountain,
  Play,
  Pause,
  RotateCcw,
  SkipBack,
  SkipForward,
  Clock,
  Layers,
  Info,
  Maximize2,
  AlertTriangle,
  Eye,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Sparkles,
  Sliders,
  ChevronRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend as RechartsLegend,
  ReferenceLine,
  ReferenceDot,
} from 'recharts';
import MetricCard from '../common/MetricCard';
import DataProvenanceBanner from '../common/DataProvenanceBanner';
import LoadingState from '../common/LoadingState';
import ErrorState from '../common/ErrorState';
import SynchronizedSky3D from './SynchronizedSky3D';
import {
  formatAngle,
  formatHours,
  formatDateTime,
  formatDateShort,
  formatPercent,
} from '../../utils/formatters';

export default function SkyHorizonView({
  selectedSite,
  illuminationData,
  communicationData,
  terrainHorizonData,
  loading,
  error,
  onRetry,
  missionConfig,
}) {
  // 1. Time Scrubbing & Animation State
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(5); // 1, 2, 5, 10, 25
  const [viewMode, setViewMode] = useState('radar'); // 'radar' | 'panorama' | '3d' | 'dual'
  const [showSightlines, setShowSightlines] = useState(true);
  const [showTrajectories, setShowTrajectories] = useState(true);

  // Radar canvas interaction
  const canvasRef = useRef(null);
  const [hoveredInfo, setHoveredInfo] = useState(null);

  // Time series extraction
  const illumSeries = illuminationData?.time_series || [];
  const commSeries = communicationData?.time_series || [];
  const totalSteps = Math.min(illumSeries.length, commSeries.length);
  const stepHours = Number(missionConfig?.stepHours || illuminationData?.step_hours || 2.0);

  // Clamp index if series length changes
  useEffect(() => {
    if (totalSteps > 0 && currentIndex >= totalSteps) {
      setCurrentIndex(0);
    }
  }, [totalSteps, currentIndex]);

  // Animation Loop for Play/Pause
  useEffect(() => {
    if (!isPlaying || totalSteps === 0) return;

    const intervalMs = Math.max(35, Math.floor(600 / playbackSpeed));
    const timer = setInterval(() => {
      setCurrentIndex((prev) => {
        if (prev >= totalSteps - 1) {
          return 0; // loop back to mission start
        }
        return prev + 1;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPlaying, totalSteps, playbackSpeed]);

  // Handle Play/Pause
  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  // Step Controls
  const handleStepBack = useCallback(() => {
    setIsPlaying(false);
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const handleStepForward = useCallback(() => {
    setIsPlaying(false);
    setCurrentIndex((prev) => Math.min(totalSteps - 1, prev + 1));
  }, [totalSteps]);

  const handleReset = useCallback(() => {
    setIsPlaying(false);
    setCurrentIndex(0);
  }, []);

  const handleSliderChange = useCallback((e) => {
    setIsPlaying(false);
    setCurrentIndex(Number(e.target.value));
  }, []);

  // 2. Extract Current Active Point
  const currentIllum = illumSeries[currentIndex] || null;
  const currentComm = commSeries[currentIndex] || null;

  // Active Celestial Telemetry
  const sunAzimuth = currentIllum?.sun_azimuth_deg ?? 0;
  const sunElevation = currentIllum?.sun_elevation_deg ?? 0;
  const sunHorizonMask = currentIllum?.terrain_horizon_elevation_deg ?? 0;
  const sunClearance = sunElevation - sunHorizonMask;
  const sunIsVisible = Boolean(currentIllum?.is_sunlit_terrain);
  const sunIsGeometric = Boolean(currentIllum?.is_sunlit_geometric);
  const sunFlux = currentIllum?.solar_flux_w_m2 ?? 0;

  const earthAzimuth = currentComm?.earth_azimuth_deg ?? 0;
  const earthElevation = currentComm?.earth_elevation_deg ?? 0;
  const earthHorizonMask = currentComm?.terrain_horizon_elevation_deg ?? 0;
  const earthClearance = earthElevation - earthHorizonMask;
  const earthIsVisible = Boolean(currentComm?.is_earth_visible);
  const earthLinkStatus = currentComm?.link_status || (earthIsVisible ? 'DIRECT_LINE_OF_SIGHT' : 'TERRAIN_BLOCKED');
  const earthDiameter = currentComm?.earth_apparent_diameter_deg || 1.88;

  const currentTimestamp = currentIllum?.timestamp || currentComm?.timestamp;
  const elapsedHours = currentIndex * stepHours;
  const elapsedDays = (elapsedHours / 24.0).toFixed(1);

  // 3. Compute Dynamic Visibility Transitions (Sunset/Sunrise, Earthset/Earthrise)
  const sunTransitions = useMemo(() => {
    if (!illumSeries.length) return null;

    // Scan forward from currentIndex for next state change
    let nextTransitionIndex = -1;
    for (let i = currentIndex + 1; i < totalSteps; i++) {
      if (Boolean(illumSeries[i].is_sunlit_terrain) !== sunIsVisible) {
        nextTransitionIndex = i;
        break;
      }
    }

    // Remaining total sunlight from current index
    let remainingSunlitHours = 0;
    let remainingTotalHours = (totalSteps - currentIndex) * stepHours;
    for (let i = currentIndex; i < totalSteps; i++) {
      if (illumSeries[i].is_sunlit_terrain) {
        remainingSunlitHours += stepHours;
      }
    }

    if (nextTransitionIndex !== -1) {
      const hoursToTransition = (nextTransitionIndex - currentIndex) * stepHours;
      const transitionTime = illumSeries[nextTransitionIndex].timestamp;
      return {
        hasTransition: true,
        type: sunIsVisible ? 'sunset' : 'sunrise',
        label: sunIsVisible ? 'Terrain Sunset (Shadow Ingress)' : 'Terrain Sunrise (Shadow Egress)',
        description: sunIsVisible
          ? 'Sun dips behind blocking topographic ridge crest'
          : 'Sun emerges above local highland terrain',
        hoursToTransition,
        transitionTime,
        remainingSunlitHours,
        remainingTotalHours,
        remainingPercent: remainingTotalHours > 0 ? (remainingSunlitHours / remainingTotalHours) * 100 : 0,
      };
    }

    return {
      hasTransition: false,
      type: sunIsVisible ? 'permanent_sun' : 'permanent_shadow',
      label: sunIsVisible ? 'Continuous Illumination' : 'Continuous Shadow Run',
      description: sunIsVisible
        ? `Sun remains visible above terrain for remaining ${remainingTotalHours.toFixed(0)}h of mission window`
        : `Site remains shadowed by terrain for remaining ${remainingTotalHours.toFixed(0)}h of mission window`,
      hoursToTransition: null,
      transitionTime: null,
      remainingSunlitHours,
      remainingTotalHours,
      remainingPercent: remainingTotalHours > 0 ? (remainingSunlitHours / remainingTotalHours) * 100 : 0,
    };
  }, [illumSeries, currentIndex, totalSteps, stepHours, sunIsVisible]);

  const earthTransitions = useMemo(() => {
    if (!commSeries.length) return null;

    let nextTransitionIndex = -1;
    for (let i = currentIndex + 1; i < totalSteps; i++) {
      if (Boolean(commSeries[i].is_earth_visible) !== earthIsVisible) {
        nextTransitionIndex = i;
        break;
      }
    }

    let remainingVisibleHours = 0;
    let remainingTotalHours = (totalSteps - currentIndex) * stepHours;
    for (let i = currentIndex; i < totalSteps; i++) {
      if (commSeries[i].is_earth_visible) {
        remainingVisibleHours += stepHours;
      }
    }

    if (nextTransitionIndex !== -1) {
      const hoursToTransition = (nextTransitionIndex - currentIndex) * stepHours;
      const transitionTime = commSeries[nextTransitionIndex].timestamp;
      return {
        hasTransition: true,
        type: earthIsVisible ? 'earthset' : 'earthrise',
        label: earthIsVisible ? 'Earthset (Communication Blackout)' : 'Earthrise (Direct-to-Earth Reacquisition)',
        description: earthIsVisible
          ? 'Earth occluded by local massif crest due to lunar libration'
          : 'Earth re-emerges above terrain mask into Direct-to-Earth line of sight',
        hoursToTransition,
        transitionTime,
        remainingVisibleHours,
        remainingTotalHours,
        remainingPercent: remainingTotalHours > 0 ? (remainingVisibleHours / remainingTotalHours) * 100 : 0,
      };
    }

    return {
      hasTransition: false,
      type: earthIsVisible ? 'permanent_los' : 'permanent_blackout',
      label: earthIsVisible ? 'Continuous Direct Line of Sight' : 'Continuous Communication Blackout',
      description: earthIsVisible
        ? `Earth remains in direct radio view for remaining ${remainingTotalHours.toFixed(0)}h`
        : `Terrain blocks Earth line of sight for remaining ${remainingTotalHours.toFixed(0)}h`,
      hoursToTransition: null,
      transitionTime: null,
      remainingVisibleHours,
      remainingTotalHours,
      remainingPercent: remainingTotalHours > 0 ? (remainingVisibleHours / remainingTotalHours) * 100 : 0,
    };
  }, [commSeries, currentIndex, totalSteps, stepHours, earthIsVisible]);

  // 4. Polar Radar Canvas Rendering (Tasks 1, 2, 6)
  const maxRadarElevationDeg = 10.0;
  const minRadarElevationDeg = -1.5;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2;
    const maxRadius = Math.min(width, height) * 0.43;

    // Helper: Map Azimuth (0°-360°) and Elevation (-1.5° to 10°) to Canvas (X, Y)
    // 0° North = Top (-Y), 90° East = Right (+X), 180° South = Bottom (+Y), 270° West = Left (-X)
    function mapSkyToCanvas(azDeg, elDeg) {
      const clampedEl = Math.max(minRadarElevationDeg, Math.min(elDeg, maxRadarElevationDeg));
      const normDist = (maxRadarElevationDeg - clampedEl) / (maxRadarElevationDeg - minRadarElevationDeg);
      const r = normDist * maxRadius;
      const rad = ((azDeg - 90.0) * Math.PI) / 180.0;
      return {
        x: cx + r * Math.cos(rad),
        y: cy + r * Math.sin(rad),
        r,
      };
    }

    // A. Radar Concentric Rings
    ctx.lineWidth = 1 * dpr;
    const rings = [0, 2, 4, 6, 8, maxRadarElevationDeg];
    rings.forEach((el) => {
      const { r } = mapSkyToCanvas(0, el);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);

      if (el === 0) {
        // 0° Geometric Horizon Plane
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
        ctx.setLineDash([4 * dpr, 3 * dpr]);
      } else {
        ctx.strokeStyle = 'rgba(100, 116, 139, 0.22)';
        ctx.setLineDash([2 * dpr, 4 * dpr]);
      }
      ctx.stroke();

      // Elevation text tag
      ctx.fillStyle = el === 0 ? '#38BDF8' : '#64748B';
      ctx.font = `${8.5 * dpr}px JetBrains Mono, monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(`${el}°`, cx + 12 * dpr, cy - r + 3 * dpr);
    });

    // 0° Geometric Horizon Label
    const { r: r0 } = mapSkyToCanvas(0, 0);
    ctx.fillStyle = 'rgba(56, 189, 248, 0.7)';
    ctx.font = `${8 * dpr}px JetBrains Mono, monospace`;
    ctx.textAlign = 'left';
    ctx.fillText('0° Geometric Horizon', cx + r0 * 0.7, cy - r0 * 0.7);

    // B. Azimuth Radial Lines & Cardinal Compass Labels
    ctx.setLineDash([2 * dpr, 4 * dpr]);
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.2)';
    const cardinals = [
      { az: 0, label: 'N (0°)', color: '#EF4444' },
      { az: 45, label: 'NE (45°)', color: '#64748B' },
      { az: 90, label: 'E (90°)', color: '#10B981' },
      { az: 135, label: 'SE (135°)', color: '#64748B' },
      { az: 180, label: 'S (180°)', color: '#94A3B8' },
      { az: 225, label: 'SW (225°)', color: '#64748B' },
      { az: 270, label: 'W (270°)', color: '#94A3B8' },
      { az: 315, label: 'NW (315°)', color: '#64748B' },
    ];

    cardinals.forEach((c) => {
      const rad = ((c.az - 90.0) * Math.PI) / 180.0;
      const xOuter = cx + maxRadius * Math.cos(rad);
      const yOuter = cy + maxRadius * Math.sin(rad);

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(xOuter, yOuter);
      ctx.stroke();

      // Label text
      const xText = cx + (maxRadius + 16 * dpr) * Math.cos(rad);
      const yText = cy + (maxRadius + 16 * dpr) * Math.sin(rad);
      ctx.fillStyle = c.color;
      ctx.font = `bold ${9 * dpr}px JetBrains Mono, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(c.label, xText, yText);
    });
    ctx.setLineDash([]);

    // C. 360° Variable Terrain Horizon Obstruction Mask (LOLA DEM)
    const horizonPts = terrainHorizonData?.horizon_points || [];
    if (horizonPts.length > 0) {
      ctx.save();
      ctx.beginPath();

      // Outer radar circle
      ctx.arc(cx, cy, maxRadius, 0, Math.PI * 2);

      // Inner terrain contour in reverse to create donut obstruction mask
      for (let i = horizonPts.length - 1; i >= 0; i--) {
        const pt = horizonPts[i];
        const { x, y } = mapSkyToCanvas(pt.azimuth_deg, pt.horizon_elevation_deg);
        ctx.lineTo(x, y);
      }
      ctx.closePath();

      // Dark volcanic terrain obstruction fill
      ctx.fillStyle = 'rgba(225, 29, 72, 0.16)';
      ctx.fill();

      // Terrain Ridge Crest Line
      ctx.beginPath();
      horizonPts.forEach((pt, i) => {
        const { x, y } = mapSkyToCanvas(pt.azimuth_deg, pt.horizon_elevation_deg);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.strokeStyle = '#F43F5E';
      ctx.lineWidth = 1.6 * dpr;
      ctx.stroke();
      ctx.restore();
    }

    // D. Solar Trajectory & History Line
    if (showTrajectories && illumSeries.length > 0) {
      // 1. Full Solar Mission Path (dashed faint amber)
      ctx.save();
      ctx.beginPath();
      ctx.setLineDash([3 * dpr, 4 * dpr]);
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)';
      ctx.lineWidth = 1.2 * dpr;
      illumSeries.forEach((pt, i) => {
        const { x, y } = mapSkyToCanvas(pt.sun_azimuth_deg, pt.sun_elevation_deg);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // 2. Solar History up to currentIndex (solid brighter amber)
      if (currentIndex > 0) {
        ctx.beginPath();
        ctx.setLineDash([]);
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.75)';
        ctx.lineWidth = 2 * dpr;
        for (let i = 0; i <= currentIndex; i++) {
          const pt = illumSeries[i];
          const { x, y } = mapSkyToCanvas(pt.sun_azimuth_deg, pt.sun_elevation_deg);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    // E. Earth Libration Trajectory & History Line
    if (showTrajectories && commSeries.length > 0) {
      ctx.save();
      // 1. Full Earth Libration Loop (dashed faint cyan)
      ctx.beginPath();
      ctx.setLineDash([3 * dpr, 4 * dpr]);
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.35)';
      ctx.lineWidth = 1.2 * dpr;
      commSeries.forEach((pt, i) => {
        const { x, y } = mapSkyToCanvas(pt.earth_azimuth_deg, pt.earth_elevation_deg);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // 2. Earth History up to currentIndex (solid brighter cyan)
      if (currentIndex > 0) {
        ctx.beginPath();
        ctx.setLineDash([]);
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.75)';
        ctx.lineWidth = 2 * dpr;
        for (let i = 0; i <= currentIndex; i++) {
          const pt = commSeries[i];
          const { x, y } = mapSkyToCanvas(pt.earth_azimuth_deg, pt.earth_elevation_deg);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    // F. Sightline Rays (Center Observer to Active Sun & Earth)
    if (showSightlines) {
      ctx.save();
      // Observer center marker
      ctx.beginPath();
      ctx.arc(cx, cy, 3 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();

      // Observer label
      ctx.fillStyle = '#94A3B8';
      ctx.font = `${7.5 * dpr}px JetBrains Mono, monospace`;
      ctx.fillText('Lander', cx, cy + 9 * dpr);

      // Sun Sightline Ray
      const sunPos = mapSkyToCanvas(sunAzimuth, sunElevation);
      ctx.beginPath();
      ctx.setLineDash([3 * dpr, 3 * dpr]);
      ctx.strokeStyle = sunIsVisible ? 'rgba(251, 191, 36, 0.6)' : 'rgba(239, 68, 68, 0.6)';
      ctx.lineWidth = 1.2 * dpr;
      ctx.moveTo(cx, cy);
      ctx.lineTo(sunPos.x, sunPos.y);
      ctx.stroke();

      // Earth Sightline Ray
      const earthPos = mapSkyToCanvas(earthAzimuth, earthElevation);
      ctx.beginPath();
      ctx.setLineDash([3 * dpr, 3 * dpr]);
      ctx.strokeStyle = earthIsVisible ? 'rgba(6, 182, 212, 0.6)' : 'rgba(239, 68, 68, 0.6)';
      ctx.lineWidth = 1.2 * dpr;
      ctx.moveTo(cx, cy);
      ctx.lineTo(earthPos.x, earthPos.y);
      ctx.stroke();
      ctx.restore();
    }

    // G. Active Sun Marker
    const { x: sx, y: sy } = mapSkyToCanvas(sunAzimuth, sunElevation);
    ctx.save();
    if (sunIsVisible) {
      // Solar Glow Aura
      const sunGlow = ctx.createRadialGradient(sx, sy, 2 * dpr, sx, sy, 16 * dpr);
      sunGlow.addColorStop(0, 'rgba(253, 224, 71, 0.9)');
      sunGlow.addColorStop(0.4, 'rgba(245, 158, 11, 0.4)');
      sunGlow.addColorStop(1, 'rgba(245, 158, 11, 0)');
      ctx.fillStyle = sunGlow;
      ctx.beginPath();
      ctx.arc(sx, sy, 16 * dpr, 0, Math.PI * 2);
      ctx.fill();

      // Sun Core Disk
      ctx.beginPath();
      ctx.arc(sx, sy, 6.5 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = '#FDE047';
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.8 * dpr;
      ctx.stroke();

      // Corona Ray Spikes
      ctx.strokeStyle = '#FBBF24';
      ctx.lineWidth = 1.4 * dpr;
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
        ctx.beginPath();
        ctx.moveTo(sx + Math.cos(a) * 8 * dpr, sy + Math.sin(a) * 8 * dpr);
        ctx.lineTo(sx + Math.cos(a) * 12 * dpr, sy + Math.sin(a) * 12 * dpr);
        ctx.stroke();
      }
    } else {
      // Obstructed Sun (Darkened with red warning stroke)
      ctx.beginPath();
      ctx.arc(sx, sy, 6 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = '#78350F';
      ctx.fill();
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 2 * dpr;
      ctx.stroke();

      // Red Slash indicating terrain occlusion
      ctx.beginPath();
      ctx.moveTo(sx - 5 * dpr, sy - 5 * dpr);
      ctx.lineTo(sx + 5 * dpr, sy + 5 * dpr);
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 1.8 * dpr;
      ctx.stroke();
    }

    // Sun Callout Tag
    ctx.fillStyle = sunIsVisible ? '#FDE047' : '#F87171';
    ctx.font = `bold ${8.5 * dpr}px JetBrains Mono, monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(`☀️ Sun (${sunElevation.toFixed(1)}°)`, sx, sy - 14 * dpr);
    ctx.restore();

    // H. Active Earth Marker
    const { x: ex, y: ey } = mapSkyToCanvas(earthAzimuth, earthElevation);
    ctx.save();
    if (earthIsVisible) {
      // Radio Transmission Wave Arcs (pulsing out from Earth)
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
      ctx.lineWidth = 1.2 * dpr;
      for (let rWave = 10 * dpr; rWave <= 16 * dpr; rWave += 4 * dpr) {
        ctx.beginPath();
        ctx.arc(ex, ey, rWave, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Earth Globe
      ctx.beginPath();
      ctx.arc(ex, ey, 7 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = '#0284C7'; // Blue ocean
      ctx.fill();
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 1.8 * dpr;
      ctx.stroke();

      // Continents swirl highlight
      ctx.fillStyle = '#22C55E';
      ctx.beginPath();
      ctx.arc(ex - 1.5 * dpr, ey - 1 * dpr, 2.5 * dpr, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Obstructed Earth
      ctx.beginPath();
      ctx.arc(ex, ey, 6.5 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = '#164E63';
      ctx.fill();
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 2 * dpr;
      ctx.stroke();

      // Blocked Cross
      ctx.beginPath();
      ctx.moveTo(ex - 4 * dpr, ey - 4 * dpr);
      ctx.lineTo(ex + 4 * dpr, ey + 4 * dpr);
      ctx.moveTo(ex + 4 * dpr, ey - 4 * dpr);
      ctx.lineTo(ex - 4 * dpr, ey + 4 * dpr);
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 1.6 * dpr;
      ctx.stroke();
    }

    // Earth Callout Tag
    ctx.fillStyle = earthIsVisible ? '#38BDF8' : '#F87171';
    ctx.font = `bold ${8.5 * dpr}px JetBrains Mono, monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(`🌍 Earth (${earthElevation.toFixed(1)}°)`, ex, ey - 15 * dpr);
    ctx.restore();
  }, [
    terrainHorizonData,
    illumSeries,
    commSeries,
    currentIndex,
    sunAzimuth,
    sunElevation,
    sunIsVisible,
    earthAzimuth,
    earthElevation,
    earthIsVisible,
    showTrajectories,
    showSightlines,
  ]);

  // Handle Canvas Mouse Movement for Interactive Terrain Tooltip
  const handleCanvasMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.hypot(dx, dy);

    if (dist < 15 || dist > rect.width * 0.46) {
      setHoveredInfo(null);
      return;
    }

    // Calculate azimuth angle (0° = North = Top)
    let angleRad = Math.atan2(dy, dx);
    let azDeg = (angleRad * 180.0) / Math.PI + 90.0;
    if (azDeg < 0) azDeg += 360.0;
    if (azDeg >= 360.0) azDeg -= 360.0;

    // Find nearest terrain point
    const horizonPts = terrainHorizonData?.horizon_points || [];
    if (!horizonPts.length) return;

    let nearest = horizonPts[0];
    let minDiff = 360;
    for (const pt of horizonPts) {
      const diff = Math.abs(pt.azimuth_deg - azDeg);
      if (diff < minDiff) {
        minDiff = diff;
        nearest = pt;
      }
    }

    setHoveredInfo({
      azimuthDeg: azDeg,
      horizonElevationDeg: nearest.horizon_elevation_deg,
      distanceKm: nearest.obstruction_distance_km,
      feature: nearest.blocking_feature || 'Highland Topography',
      mouseX: x,
      mouseY: y,
    });
  };

  const handleCanvasMouseLeave = () => {
    setHoveredInfo(null);
  };

  // 5. Data for Linear 360° Panorama Strip (Recharts)
  const panoramaData = useMemo(() => {
    const horizonPts = terrainHorizonData?.horizon_points || [];
    return horizonPts.map((pt) => {
      // Check if Sun or Earth is close to this azimuth
      const isSunHere = Math.abs(pt.azimuth_deg - sunAzimuth) < 2.5;
      const isEarthHere = Math.abs(pt.azimuth_deg - earthAzimuth) < 2.5;
      return {
        azimuth_deg: pt.azimuth_deg,
        horizon_elevation_deg: pt.horizon_elevation_deg,
        sun_elevation: isSunHere ? sunElevation : null,
        earth_elevation: isEarthHere ? earthElevation : null,
        blocking_feature: pt.blocking_feature,
        distance_km: pt.obstruction_distance_km,
      };
    });
  }, [terrainHorizonData, sunAzimuth, sunElevation, earthAzimuth, earthElevation]);

  // Loading & Error States
  if (loading) {
    return (
      <LoadingState
        title="Synthesizing Local Sky-Horizon Telemetry..."
        subtitle="Computing topocentric Sun and Earth vectors, 360° terrain horizon occlusion masks, and dynamic libration visibility."
      />
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Sky Horizon Calculation Error"
        message={error}
        onRetry={onRetry}
      />
    );
  }

  if (!illumSeries.length || !commSeries.length) {
    return (
      <div className="rounded-2xl border border-luna-800 bg-luna-900/60 p-12 text-center text-slate-500 font-mono text-xs">
        No ephemeris or terrain horizon time series available for this landing site.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 0. DATA PROVENANCE BANNER */}
      <DataProvenanceBanner
        ephemerisSource={illuminationData?.ephemeris_source || 'NASA JPL HORIZONS'}
        terrainSource={terrainHorizonData?.terrain_source || 'NASA LOLA PDS DATA'}
        demResolutionM={terrainHorizonData?.dem_resolution_m || 80.0}
        calculationStatus={terrainHorizonData?.calculation_status || 'NOMINAL'}
        dataQualityWarning={illuminationData?.data_quality_warning}
      />

      {/* 1. TOP HEADER & INTERACTIVE TIME CONTROLS BAR (Task 5) */}
      <div className="rounded-2xl border border-luna-800 bg-luna-900/80 p-4 md:p-5 shadow-xl space-y-4">
        {/* Header line: Site Info & Mode Selector */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-luna-800">
          <div>
            <div className="flex items-center space-x-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-cyan-400 animate-pulse" />
              <h2 className="font-mono text-sm md:text-base font-bold uppercase tracking-wider text-cyan-300">
                Local Sky-Horizon Interactive Simulator
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Topocentric celestial sphere relative to <span className="text-slate-200 font-semibold">{selectedSite?.name || 'Selected Landing Site'}</span> ({selectedSite?.latitude?.toFixed(2)}°, {selectedSite?.longitude?.toFixed(2)}°, {selectedSite?.elevation_m?.toFixed(0)}m)
            </p>
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center space-x-1 rounded-xl border border-luna-800 bg-luna-950 p-1 text-xs font-mono">
            {[
              { id: 'radar', label: '360° Polar Radar' },
              { id: 'panorama', label: 'Horizon Strip' },
              { id: '3d', label: '3D Surface Scene' },
              { id: 'dual', label: 'Dual View (Radar + 3D)' },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => setViewMode(m.id)}
                className={`rounded-lg px-2.5 py-1.5 transition-all ${
                  viewMode === m.id
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* TIME SCRUBBER & TRANSPORT CONTROLS (Task 5) */}
        <div className="space-y-3 pt-1">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Play/Pause & Step Buttons */}
            <div className="flex items-center space-x-2">
              <button
                onClick={togglePlay}
                className={`flex items-center space-x-1.5 rounded-xl px-4 py-2 font-mono text-xs font-bold transition-all shadow-md ${
                  isPlaying
                    ? 'bg-amber-500 text-slate-950 shadow-amber-500/20'
                    : 'bg-cyan-500 text-slate-950 shadow-cyan-500/20 hover:bg-cyan-400'
                }`}
                title={isPlaying ? 'Pause Simulation' : 'Play Timeline'}
                aria-label={isPlaying ? 'Pause Simulation' : 'Play Timeline'}
              >
                {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
                <span>{isPlaying ? 'PAUSE' : 'PLAY'}</span>
              </button>

              <button
                onClick={handleStepBack}
                disabled={currentIndex === 0}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-luna-700 bg-luna-800 text-slate-300 hover:text-white disabled:opacity-40 transition-colors"
                title="Step Backward (1 Step)"
                aria-label="Step Backward"
              >
                <SkipBack className="h-4 w-4" />
              </button>

              <button
                onClick={handleStepForward}
                disabled={currentIndex >= totalSteps - 1}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-luna-700 bg-luna-800 text-slate-300 hover:text-white disabled:opacity-40 transition-colors"
                title="Step Forward (1 Step)"
                aria-label="Step Forward"
              >
                <SkipForward className="h-4 w-4" />
              </button>

              <button
                onClick={handleReset}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-luna-700 bg-luna-800 text-slate-300 hover:text-white transition-colors"
                title="Reset to Mission Start (T+0)"
                aria-label="Reset to Mission Start"
              >
                <RotateCcw className="h-4 w-4" />
              </button>

              {/* Playback Speed selector */}
              <div className="flex items-center space-x-1 border-l border-luna-800 pl-2">
                <span className="text-[11px] font-mono text-slate-500 hidden md:inline">SPEED:</span>
                {[1, 2, 5, 10, 25].map((s) => (
                  <button
                    key={s}
                    onClick={() => setPlaybackSpeed(s)}
                    className={`rounded-md px-1.5 py-0.5 text-[11px] font-mono transition-colors ${
                      playbackSpeed === s
                        ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-500/50 font-bold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>

            {/* Time readout */}
            <div className="flex items-center space-x-3 text-xs font-mono">
              <div className="flex items-center space-x-1.5 text-slate-300">
                <Clock className="h-3.5 w-3.5 text-cyan-400" />
                <span className="text-cyan-300 font-semibold">{formatDateTime(currentTimestamp)}</span>
              </div>
              <div className="rounded-lg bg-luna-950 px-2.5 py-1 text-slate-400 border border-luna-800">
                <span>T+{elapsedDays}d ({elapsedHours.toFixed(1)}h)</span>
                <span className="text-slate-600 mx-1.5">|</span>
                <span>Step {currentIndex + 1}/{totalSteps}</span>
              </div>
            </div>
          </div>

          {/* Timeline Slider with Progress */}
          <div className="space-y-1">
            <input
              type="range"
              min={0}
              max={totalSteps - 1}
              value={currentIndex}
              onChange={handleSliderChange}
              className="w-full h-2 rounded-lg bg-luna-950 accent-cyan-400 cursor-pointer border border-luna-800"
              aria-label="Mission Timeline Scrubbing Slider"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-500 px-0.5">
              <span>Mission Start ({formatDateShort(illumSeries[0]?.timestamp)})</span>
              <span>Timeline Scrubber ({formatHours(stepHours)} / step)</span>
              <span>Mission End ({formatDateShort(illumSeries[totalSteps - 1]?.timestamp)})</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. CELESTIAL DOSSIERS: SUN & EARTH TELEMETRY CARDS (Tasks 3 & 4) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* SUN TELEMETRY CARD (Task 3) */}
        <div className={`rounded-2xl border p-4 md:p-5 transition-all shadow-lg ${
          sunIsVisible
            ? 'border-amber-500/40 bg-amber-950/20'
            : 'border-rose-500/30 bg-rose-950/20'
        }`}>
          <div className="flex items-center justify-between pb-3 border-b border-luna-800">
            <div className="flex items-center space-x-2.5">
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl border ${
                sunIsVisible
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                  : 'bg-rose-500/20 border-rose-500/40 text-rose-300'
              }`}>
                <Sun className={`h-5 w-5 ${sunIsVisible ? 'animate-spin-slow' : ''}`} />
              </div>
              <div>
                <h3 className="font-mono text-sm font-bold text-amber-300 flex items-center space-x-2">
                  <span>SUN VISIBILITY DOSSIER</span>
                </h3>
                <span className="text-[11px] text-slate-400">
                  Topocentric solar coordinates & LOLA terrain cast shadows
                </span>
              </div>
            </div>

            {/* Visibility Status Badge */}
            <div className={`flex items-center space-x-1.5 rounded-xl px-3 py-1 text-xs font-mono font-bold border ${
              sunIsVisible
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
            }`}>
              {sunIsVisible ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
              <span>{sunIsVisible ? 'DIRECT SUNLIGHT' : 'TERRAIN SHADOWED'}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            <div className="rounded-xl border border-luna-800 bg-luna-950/80 p-2.5">
              <span className="text-[10px] font-mono uppercase text-slate-400">Solar Azimuth</span>
              <div className="text-sm md:text-base font-mono font-bold text-slate-100 mt-0.5">
                {formatAngle(sunAzimuth)}
              </div>
              <span className="text-[10px] font-mono text-slate-500">From Lunar North</span>
            </div>

            <div className="rounded-xl border border-luna-800 bg-luna-950/80 p-2.5">
              <span className="text-[10px] font-mono uppercase text-slate-400">Solar Elevation</span>
              <div className={`text-sm md:text-base font-mono font-bold mt-0.5 ${
                sunElevation >= 0 ? 'text-amber-400' : 'text-slate-400'
              }`}>
                {formatAngle(sunElevation, 2)}
              </div>
              <span className="text-[10px] font-mono text-slate-500">Above Tangent Plane</span>
            </div>

            <div className="rounded-xl border border-luna-800 bg-luna-950/80 p-2.5">
              <span className="text-[10px] font-mono uppercase text-slate-400">Terrain Horizon</span>
              <div className="text-sm md:text-base font-mono font-bold text-rose-400 mt-0.5">
                {formatAngle(sunHorizonMask, 2)}
              </div>
              <span className="text-[10px] font-mono text-slate-500">Blocking Angle at Az</span>
            </div>

            <div className="rounded-xl border border-luna-800 bg-luna-950/80 p-2.5">
              <span className="text-[10px] font-mono uppercase text-slate-400">Terrain Clearance</span>
              <div className={`text-sm md:text-base font-mono font-bold mt-0.5 ${
                sunClearance > 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {sunClearance > 0 ? `+${sunClearance.toFixed(2)}°` : `${sunClearance.toFixed(2)}°`}
              </div>
              <span className="text-[10px] font-mono text-slate-500">Elevation - Mask</span>
            </div>
          </div>

          {/* DYNAMIC TRANSITION PREDICTION (Sunset/Sunrise) (Task 3) */}
          <div className="mt-4 rounded-xl border border-luna-800 bg-luna-950/60 p-3 space-y-2 text-xs font-mono">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center space-x-1.5">
                <Clock className="h-3.5 w-3.5 text-amber-400" />
                <span>Next Illumination Transition:</span>
              </span>
              <span className="font-bold text-amber-300">
                {sunTransitions?.label}
              </span>
            </div>

            {sunTransitions?.hasTransition ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-slate-300 bg-luna-900/80 rounded-lg p-2 border border-luna-800">
                <div>
                  Time Remaining: <span className="text-amber-400 font-bold">{formatHours(sunTransitions.hoursToTransition)}</span>
                  <span className="text-slate-500 mx-2">•</span>
                  Epoch: <span className="text-slate-200">{formatDateTime(sunTransitions.transitionTime)}</span>
                </div>
                <div className="text-slate-400 text-[10px] mt-1 sm:mt-0">
                  {sunTransitions.description}
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-emerald-400 bg-luna-900/80 rounded-lg p-2 border border-luna-800">
                {sunTransitions?.description}
              </div>
            )}

            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
              <span>Total Mission Sunlight Remaining:</span>
              <span className="font-bold text-amber-300">
                {formatHours(sunTransitions?.remainingSunlitHours)} ({sunTransitions?.remainingPercent.toFixed(1)}% of remaining mission)
              </span>
            </div>
          </div>

          {/* Polar Grazing Scientific Note */}
          <div className="mt-3 flex items-start space-x-2 text-[10px] font-mono text-slate-400 bg-amber-950/20 rounded-lg p-2 border border-amber-900/30">
            <Info className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
            <span>
              <strong>Polar Grazing Note:</strong> At lunar south polar latitudes, the Sun stays within ~1.8° of the horizon. "Sunrise" and "Sunset" are topographic shadow events caused by distant massif ridges occulting the solar disk rather than flat-horizon diurnal setting.
            </span>
          </div>
        </div>

        {/* EARTH TELEMETRY CARD (Task 4) */}
        <div className={`rounded-2xl border p-4 md:p-5 transition-all shadow-lg ${
          earthIsVisible
            ? 'border-cyan-500/40 bg-cyan-950/20'
            : 'border-rose-500/30 bg-rose-950/20'
        }`}>
          <div className="flex items-center justify-between pb-3 border-b border-luna-800">
            <div className="flex items-center space-x-2.5">
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl border ${
                earthIsVisible
                  ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                  : 'bg-rose-500/20 border-rose-500/40 text-rose-300'
              }`}>
                <Radio className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-mono text-sm font-bold text-cyan-300 flex items-center space-x-2">
                  <span>EARTH DIRECT-TO-EARTH (DTE) DOSSIER</span>
                </h3>
                <span className="text-[11px] text-slate-400">
                  Libration tracking, terrain occlusion & radio line of sight
                </span>
              </div>
            </div>

            {/* Visibility Status Badge */}
            <div className={`flex items-center space-x-1.5 rounded-xl px-3 py-1 text-xs font-mono font-bold border ${
              earthIsVisible
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
            }`}>
              {earthIsVisible ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
              <span>{earthLinkStatus.replace(/_/g, ' ')}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            <div className="rounded-xl border border-luna-800 bg-luna-950/80 p-2.5">
              <span className="text-[10px] font-mono uppercase text-slate-400">Earth Azimuth</span>
              <div className="text-sm md:text-base font-mono font-bold text-slate-100 mt-0.5">
                {formatAngle(earthAzimuth)}
              </div>
              <span className="text-[10px] font-mono text-slate-500">From Lunar North</span>
            </div>

            <div className="rounded-xl border border-luna-800 bg-luna-950/80 p-2.5">
              <span className="text-[10px] font-mono uppercase text-slate-400">Earth Elevation</span>
              <div className={`text-sm md:text-base font-mono font-bold mt-0.5 ${
                earthElevation >= 0 ? 'text-cyan-400' : 'text-slate-400'
              }`}>
                {formatAngle(earthElevation, 2)}
              </div>
              <span className="text-[10px] font-mono text-slate-500">Apparent Center Angle</span>
            </div>

            <div className="rounded-xl border border-luna-800 bg-luna-950/80 p-2.5">
              <span className="text-[10px] font-mono uppercase text-slate-400">Terrain Horizon</span>
              <div className="text-sm md:text-base font-mono font-bold text-rose-400 mt-0.5">
                {formatAngle(earthHorizonMask, 2)}
              </div>
              <span className="text-[10px] font-mono text-slate-500">Blocking Angle at Az</span>
            </div>

            <div className="rounded-xl border border-luna-800 bg-luna-950/80 p-2.5">
              <span className="text-[10px] font-mono uppercase text-slate-400">Terrain Clearance</span>
              <div className={`text-sm md:text-base font-mono font-bold mt-0.5 ${
                earthClearance > 0 ? 'text-cyan-400' : 'text-rose-400'
              }`}>
                {earthClearance > 0 ? `+${earthClearance.toFixed(2)}°` : `${earthClearance.toFixed(2)}°`}
              </div>
              <span className="text-[10px] font-mono text-slate-500">Elevation - Mask</span>
            </div>
          </div>

          {/* DYNAMIC TRANSITION PREDICTION (Earthset/Earthrise) (Task 4) */}
          <div className="mt-4 rounded-xl border border-luna-800 bg-luna-950/60 p-3 space-y-2 text-xs font-mono">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center space-x-1.5">
                <Clock className="h-3.5 w-3.5 text-cyan-400" />
                <span>Next Communication Transition:</span>
              </span>
              <span className="font-bold text-cyan-300">
                {earthTransitions?.label}
              </span>
            </div>

            {earthTransitions?.hasTransition ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-slate-300 bg-luna-900/80 rounded-lg p-2 border border-luna-800">
                <div>
                  Time Remaining: <span className="text-cyan-400 font-bold">{formatHours(earthTransitions.hoursToTransition)}</span>
                  <span className="text-slate-500 mx-2">•</span>
                  Epoch: <span className="text-slate-200">{formatDateTime(earthTransitions.transitionTime)}</span>
                </div>
                <div className="text-slate-400 text-[10px] mt-1 sm:mt-0">
                  {earthTransitions.description}
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-cyan-400 bg-luna-900/80 rounded-lg p-2 border border-luna-800">
                {earthTransitions?.description}
              </div>
            )}

            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
              <span>Total Direct-to-Earth Visibility Remaining:</span>
              <span className="font-bold text-cyan-300">
                {formatHours(earthTransitions?.remainingVisibleHours)} ({earthTransitions?.remainingPercent.toFixed(1)}% of remaining mission)
              </span>
            </div>
          </div>

          {/* Earth Libration Scientific Note */}
          <div className="mt-3 flex items-start space-x-2 text-[10px] font-mono text-slate-400 bg-cyan-950/20 rounded-lg p-2 border border-cyan-900/30">
            <Info className="h-3.5 w-3.5 text-cyan-400 shrink-0 mt-0.5" />
            <span>
              <strong>Libration & Angular Size:</strong> Earth apparent diameter is ~{earthDiameter.toFixed(2)}° in the lunar sky (~4x larger than Sun). Earth oscillates across a ±6.7° lat / ±7.9° lon libration box over the 27.3-day lunar orbital cycle, causing periodic occultation behind crater rims.
            </span>
          </div>
        </div>
      </div>

      {/* 3. PRIMARY VISUALIZATION CANVAS AREA (Tasks 1, 2, 6, 7) */}
      <div className="rounded-2xl border border-luna-800 bg-luna-900/70 p-4 md:p-6 shadow-xl">
        <div className={viewMode === 'dual' ? 'grid grid-cols-1 xl:grid-cols-2 gap-6 items-start' : 'space-y-4'}>
          {/* VIEW 1: COMBINED 360° POLAR RADAR */}
          {(viewMode === 'radar' || viewMode === 'dual') && (
            <div className={`flex flex-col items-center justify-center ${viewMode === 'dual' ? 'w-full bg-luna-950/40 p-4 rounded-2xl border border-luna-800/60' : ''}`}>
              {/* View options bar */}
              <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-luna-800 text-xs font-mono">
                <div className="flex items-center space-x-2 text-slate-300 font-semibold">
                  <Compass className="h-4 w-4 text-cyan-400" />
                  <span>360° CELESTIAL HORIZON POLAR RADAR</span>
                </div>

                <div className="flex items-center space-x-4 text-[11px]">
                  <label className="flex items-center space-x-1.5 cursor-pointer text-slate-400 hover:text-slate-200">
                    <input
                      type="checkbox"
                      checked={showTrajectories}
                      onChange={(e) => setShowTrajectories(e.target.checked)}
                      className="accent-cyan-400"
                    />
                    <span>Trajectories</span>
                  </label>

                  <label className="flex items-center space-x-1.5 cursor-pointer text-slate-400 hover:text-slate-200">
                    <input
                      type="checkbox"
                      checked={showSightlines}
                      onChange={(e) => setShowSightlines(e.target.checked)}
                      className="accent-cyan-400"
                    />
                    <span>Sightlines</span>
                  </label>
                </div>
              </div>

              {/* Radar Canvas with Interactive Hover */}
              <div className="relative mt-4 flex items-center justify-center">
                <canvas
                  ref={canvasRef}
                  width={560}
                  height={560}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseLeave={handleCanvasMouseLeave}
                  className="h-[340px] w-[340px] sm:h-[420px] sm:w-[420px] md:h-[480px] md:w-[480px] cursor-crosshair rounded-full shadow-[0_0_30px_rgba(3,7,18,0.8)]"
                />

                {/* Interactive Hover Tooltip */}
                {hoveredInfo && (
                  <div
                    className="absolute pointer-events-none rounded-xl bg-luna-950/95 border border-luna-700 px-3 py-2 text-[11px] font-mono text-slate-200 shadow-2xl backdrop-blur-md z-20"
                    style={{
                      left: `${hoveredInfo.mouseX + 15}px`,
                      top: `${hoveredInfo.mouseY - 20}px`,
                    }}
                  >
                    <div className="font-bold text-cyan-300">
                      Azimuth: {hoveredInfo.azimuthDeg != null ? Number(hoveredInfo.azimuthDeg).toFixed(1) : '—'}°
                    </div>
                    <div className="text-rose-400">
                      Terrain Obstruction: {hoveredInfo.horizonElevationDeg != null ? Number(hoveredInfo.horizonElevationDeg).toFixed(2) : '—'}°
                    </div>
                    <div className="text-slate-400">
                      Blocking Peak Distance: {hoveredInfo.distanceKm != null ? Number(hoveredInfo.distanceKm).toFixed(1) : '—'} km
                    </div>
                    <div className="text-slate-500 text-[10px] mt-0.5">
                      Feature: {hoveredInfo.feature}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-3 text-center text-[11px] font-mono text-slate-400 max-w-lg">
                Center: zenith ({maxRadarElevationDeg}°); blue ring: 0° horizon; red perimeter: LOLA DEM mask.
              </div>
            </div>
          )}

          {/* VIEW 2: LINEAR 360° HORIZON PANORAMA STRIP */}
          {viewMode === 'panorama' && (
            <div className="space-y-4 w-full">
              <div className="flex items-center justify-between pb-2 border-b border-luna-800 text-xs font-mono">
                <span className="text-slate-300 font-semibold flex items-center space-x-1.5">
                  <Mountain className="h-4 w-4 text-emerald-400" />
                  <span>360° PANORAMIC HORIZON ELEVATION STRIP (0° TO 360° AZIMUTH)</span>
                </span>
                <span className="text-slate-400 text-[11px]">
                  Sun (Yellow) &amp; Earth (Cyan) clearance above local terrain profile
                </span>
              </div>

              <div className="h-96 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={panoramaData}>
                    <defs>
                      <linearGradient id="skyHorizonGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.45} />
                        <stop offset="95%" stopColor="#F43F5E" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                    <XAxis
                      dataKey="azimuth_deg"
                      stroke="#64748B"
                      unit="°"
                      tick={{ fontSize: 10 }}
                      ticks={[0, 45, 90, 135, 180, 225, 270, 315, 360]}
                    />
                    <YAxis
                      stroke="#64748B"
                      unit="°"
                      tick={{ fontSize: 10 }}
                      domain={[-1.5, 8.5]}
                    />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: '#0B0F19', borderColor: '#222E4A', borderRadius: '8px' }}
                      labelFormatter={(az) => `Azimuth: ${az}°`}
                      formatter={(val, name, item) => [
                        `${Number(val).toFixed(2)}° (${item.payload.blocking_feature || 'Highland Topography'}, ${item.payload.distance_km || 0} km)`,
                        name,
                      ]}
                    />
                    <RechartsLegend wrapperStyle={{ fontSize: 11 }} />
                    <ReferenceLine y={0} stroke="#38BDF8" strokeDasharray="3 3" label="0° Geometric Horizon" />

                    {/* Terrain Profile Area */}
                    <Area
                      type="monotone"
                      dataKey="horizon_elevation_deg"
                      name="LOLA Terrain Horizon Mask (°)"
                      stroke="#F43F5E"
                      fill="url(#skyHorizonGrad)"
                      strokeWidth={2}
                    />

                    {/* Active Sun Reference Dot */}
                    <ReferenceDot
                      x={Math.round(sunAzimuth)}
                      y={sunElevation}
                      r={6}
                      fill={sunIsVisible ? '#FDE047' : '#78350F'}
                      stroke={sunIsVisible ? '#FFFFFF' : '#EF4444'}
                      strokeWidth={2}
                      label={{
                        value: `Sun (${sunElevation.toFixed(1)}°)`,
                        fill: '#FDE047',
                        fontSize: 10,
                        position: 'top',
                      }}
                    />

                    {/* Active Earth Reference Dot */}
                    <ReferenceDot
                      x={Math.round(earthAzimuth)}
                      y={earthElevation}
                      r={6}
                      fill={earthIsVisible ? '#0284C7' : '#164E63'}
                      stroke={earthIsVisible ? '#38BDF8' : '#EF4444'}
                      strokeWidth={2}
                      label={{
                        value: `Earth (${earthElevation.toFixed(1)}°)`,
                        fill: '#38BDF8',
                        fontSize: 10,
                        position: 'top',
                      }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* VIEW 3: SYNCHRONIZED 3D SURFACE SCENE (Task 7) */}
          {(viewMode === '3d' || viewMode === 'dual') && (
            <div className={`space-y-3 ${viewMode === 'dual' ? 'w-full bg-luna-950/40 p-4 rounded-2xl border border-luna-800/60' : 'w-full'}`}>
              <div className="flex items-center justify-between pb-3 border-b border-luna-800 text-xs font-mono">
                <span className="text-slate-300 font-semibold flex items-center space-x-1.5">
                  <Compass className="h-4 w-4 text-cyan-400" />
                  <span>SYNCHRONIZED 3D LUNAR SURFACE &amp; CELESTIAL VECTORS</span>
                </span>
                <span className="text-slate-400 text-[11px]">
                  Real-time sunlight ray shadows &amp; Earth radio vector
                </span>
              </div>

              <div className="h-[420px] md:h-[500px] w-full">
                <SynchronizedSky3D
                  currentSite={selectedSite}
                  sunAzimuthDeg={sunAzimuth}
                  sunElevationDeg={sunElevation}
                  sunIsVisible={sunIsVisible}
                  earthAzimuthDeg={earthAzimuth}
                  earthElevationDeg={earthElevation}
                  earthIsVisible={earthIsVisible}
                  observerHeightM={missionConfig?.mastHeightM || 2.0}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. VISUALIZATION LEGEND & EXPLANATORY GUIDE (Task 6) */}
      <div className="rounded-2xl border border-luna-800 bg-luna-900/60 p-4 md:p-5 shadow-lg space-y-3 text-xs font-mono">
        <h4 className="font-bold text-slate-200 flex items-center space-x-2 uppercase tracking-wider text-xs">
          <HelpCircle className="h-4 w-4 text-cyan-400" />
          <span>Sky-Horizon Legend & Geometric Reference Guide</span>
        </h4>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 pt-1">
          {/* Legend 1: Sun */}
          <div className="rounded-xl border border-luna-800 bg-luna-950 p-2.5 space-y-1">
            <div className="flex items-center space-x-1.5 text-amber-300 font-bold">
              <span className="h-3 w-3 rounded-full bg-amber-400 inline-block shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
              <span>Sun (Active)</span>
            </div>
            <p className="text-[10px] text-slate-400">
              Golden orb = Sunlit; Crossed-out red circle = Terrain-shadowed.
            </p>
          </div>

          {/* Legend 2: Earth */}
          <div className="rounded-xl border border-luna-800 bg-luna-950 p-2.5 space-y-1">
            <div className="flex items-center space-x-1.5 text-cyan-300 font-bold">
              <span className="h-3 w-3 rounded-full bg-cyan-400 inline-block shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
              <span>Earth (Active)</span>
            </div>
            <p className="text-[10px] text-slate-400">
              Cyan orb with radio waves = Direct LOS; Dark red = Terrain-blocked.
            </p>
          </div>

          {/* Legend 3: Terrain Horizon */}
          <div className="rounded-xl border border-luna-800 bg-luna-950 p-2.5 space-y-1">
            <div className="flex items-center space-x-1.5 text-rose-400 font-bold">
              <span className="h-2.5 w-6 rounded bg-rose-500 inline-block" />
              <span>Terrain Horizon</span>
            </div>
            <p className="text-[10px] text-slate-400">
              NASA LOLA DEM variable elevation boundary; crest of local ridges.
            </p>
          </div>

          {/* Legend 4: Geometric Horizon */}
          <div className="rounded-xl border border-luna-800 bg-luna-950 p-2.5 space-y-1">
            <div className="flex items-center space-x-1.5 text-sky-400 font-bold">
              <span className="h-0.5 w-6 border-t-2 border-dashed border-sky-400 inline-block" />
              <span>0° Geometric Plane</span>
            </div>
            <p className="text-[10px] text-slate-400">
              Horizontal tangent plane to the lunar datum sphere (R=1737.4 km).
            </p>
          </div>

          {/* Legend 5: Visible Region */}
          <div className="rounded-xl border border-luna-800 bg-luna-950 p-2.5 space-y-1">
            <div className="flex items-center space-x-1.5 text-emerald-400 font-bold">
              <span className="h-3 w-3 rounded bg-emerald-500/30 border border-emerald-500 inline-block" />
              <span>Visible Region</span>
            </div>
            <p className="text-[10px] text-slate-400">
              Unobstructed celestial sky (elevation &gt; local terrain horizon).
            </p>
          </div>

          {/* Legend 6: Obstructed Region */}
          <div className="rounded-xl border border-luna-800 bg-luna-950 p-2.5 space-y-1">
            <div className="flex items-center space-x-1.5 text-rose-400 font-bold">
              <span className="h-3 w-3 rounded bg-rose-500/30 border border-rose-500 inline-block" />
              <span>Obstructed Region</span>
            </div>
            <p className="text-[10px] text-slate-400">
              Blocked line-of-sight (elevation &le; local terrain elevation).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
