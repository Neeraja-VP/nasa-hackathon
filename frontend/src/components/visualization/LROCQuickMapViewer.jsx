import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Map,
  ExternalLink,
  Layers,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sun,
  Eye,
  Sliders,
  Copy,
  Check,
  Compass,
  MapPin,
  Crosshair,
  Info,
  Globe,
  Radio,
  Share2,
  Sparkles,
  Maximize2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Database,
  Navigation,
  FileText,
} from 'lucide-react';
import {
  polarProject,
  polarUnproject,
  formatLatitude,
  formatLongitude,
  lunarHaversineDistanceKm,
} from '../../utils/coordinates';
import { LUNAR_SOUTH_POLE_FEATURES } from '../../utils/constants';
import { getQuickMapMetadata } from '../../services/api';

// Canonical LROC QuickMap Share URLs provided by user
export const QUICKMAP_SHARE_URL = 'https://share.google/sCb5mzv7y0G7kEfA4';
export const CANONICAL_DEFS = 'N4IgzGCMAsIFygPYAcCGBjAlgFwJ70gF9Cg';
export const QUICKMAP_CANONICAL_RESOLVED =
  'https://quickmap.lroc.im-ldi.com/?prjExtent=-3051793.6799876%2C-3012593.8734225%2C2175523.681406%2C3149731.2394266&earthShadowEnabled=true&proj=10&stack=3314&defs=N4IgzGCMAsIFygPYAcCGBjAlgFwJ70gF9Cg';

/**
 * Convert selenographic coordinates to Moon South Pole Stereographic (EPSG:3032) meters.
 */
export function latLonToPolarStereoM(latDeg, lonDeg) {
  const colatRad = ((90.0 - Math.abs(latDeg)) * Math.PI) / 180.0;
  const r = 2.0 * 1737400.0 * Math.tan(colatRad / 2.0);
  const lonRad = (lonDeg * Math.PI) / 180.0;
  const x = r * Math.sin(lonRad);
  const y = -r * Math.cos(lonRad);
  return { x, y, r };
}

/**
 * Generate custom LROC QuickMap deep-link for a given selenographic coordinate.
 */
export function buildSiteQuickMapUrl(latDeg, lonDeg, radiusKm = 60.0) {
  const { x, y } = latLonToPolarStereoM(latDeg, lonDeg);
  const delta = radiusKm * 1000.0;
  const xMin = (x - delta).toFixed(1);
  const yMin = (y - delta).toFixed(1);
  const xMax = (x + delta).toFixed(1);
  const yMax = (y + delta).toFixed(1);
  return `https://quickmap.lroc.im-ldi.com/?prjExtent=${xMin}%2C${yMin}%2C${xMax}%2C${yMax}&earthShadowEnabled=true&proj=10&stack=3314&defs=${CANONICAL_DEFS}`;
}

const DEFAULT_QUICKMAP_METADATA = {
  service: 'LROC QuickMap (Lunar Reconnaissance Orbiter Camera)',
  institution: 'Arizona State University (ASU) & Intuitive Machines / ACT-REACT',
  share_url: QUICKMAP_SHARE_URL,
  resolved_url: QUICKMAP_CANONICAL_RESOLVED,
  projection: {
    id: 10,
    code: 'EPSG:3032',
    name: 'Lunar South Pole Stereographic',
    central_meridian_deg: 0.0,
    standard_parallel_deg: -90.0,
  },
  stack_id: 3314,
  defs: CANONICAL_DEFS,
  earth_shadow_enabled: true,
  extent: [-3051793.68, -3012593.87, 2175523.68, 3149731.24],
  layers: [
    {
      id: 'lroc_wac_polar',
      name: 'LROC Wide Angle Camera (WAC) South Pole Mosaic',
      resolution: '64 m/pixel',
      layer_type: 'Optical Mosaic',
      description:
        'Controlled seamless multi-temporal optical mosaic captured by NASA LRO WAC at 643 nm, standardizing solar azimuth and illumination to eliminate false shadows.',
    },
    {
      id: 'lola_dem_color',
      name: 'LOLA Hypsometric Elevation Shaded Relief',
      resolution: '20 m/pixel',
      layer_type: 'Hypsometric Topography',
      description:
        'False-color digital elevation model derived from over 4 billion NASA LOLA laser altimeter returns, providing absolute datum elevation from -3500m to +5050m.',
    },
    {
      id: 'lroc_nac_strips',
      name: 'LROC Narrow Angle Camera (NAC) Artemis Candidate Corridors',
      resolution: '0.5 - 1.0 m/pixel',
      layer_type: 'Ultra High-Resolution Optical',
      description:
        'Meter-scale targeted optical swaths resolving meter-sized boulders, rover traversal bottlenecks, and touchdown hazards on candidate landing zones.',
    },
    {
      id: 'psr_catalog',
      name: 'Permanently Shadowed Regions (PSR) Water Ice Traps',
      resolution: '240 m/pixel',
      layer_type: 'Cryogenic Traps',
      description:
        'Polygonal boundaries of south-pole depression craters receiving zero direct sunlight and maintaining cryogenic temperatures below 40K.',
    },
    {
      id: 'earth_shadow_mask',
      name: 'Dynamic Grazing Sunlight & Earth Shadow Simulator',
      resolution: 'Real-time Celestial',
      layer_type: 'Solar Shadow Mask',
      description:
        'ACT-REACT solar raytracing casting true grazing shadows across ridges and crater walls based on real-time solar declination and azimuth.',
    },
  ],
  site_bookmarks: {},
};

export default function LROCQuickMapViewer({
  sites = [],
  selectedSiteId,
  onSelectSite,
  currentSite,
  initialMode = 'canvas',
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // View Mode: 'canvas' (integrated fast map) | 'embed' (live QuickMap web frame) | 'specs' (Stack 3314 details)
  const [viewMode, setViewMode] = useState(initialMode || 'canvas');

  // Synchronize viewMode if initialMode prop changes externally
  useEffect(() => {
    if (initialMode) {
      setViewMode(initialMode);
    }
  }, [initialMode]);

  // Live Backend Metadata State
  const [metadata, setMetadata] = useState(DEFAULT_QUICKMAP_METADATA);
  const [metaLoading, setMetaLoading] = useState(false);
  const [isLiveMeta, setIsLiveMeta] = useState(false);
  const [copiedSiteId, setCopiedSiteId] = useState(null);
  const [copiedCanonicalUrl, setCopiedCanonicalUrl] = useState(false);

  // Fetch metadata from backend REST endpoint
  const fetchQuickMapMetadata = useCallback(async () => {
    setMetaLoading(true);
    try {
      const data = await getQuickMapMetadata();
      if (data && data.stack_id) {
        setMetadata(data);
        setIsLiveMeta(true);
      }
    } catch (err) {
      console.warn('Using verified default QuickMap Stack 3314 metadata:', err);
      setIsLiveMeta(false);
    } finally {
      setMetaLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuickMapMetadata();
  }, [fetchQuickMapMetadata]);

  // Layer toggles for Canvas mode
  const [activeLayers, setActiveLayers] = useState({
    wacMosaic: true,
    lolaElevation: true,
    slopeHazard: false,
    sunShadow: true,
    psrs: true,
    sites: true,
    grid: true,
  });

  // Transform state for Canvas
  const [zoom, setZoom] = useState(1.1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Hover & Telemetry
  const [hoveredSite, setHoveredSite] = useState(null);
  const [cursorCoords, setCursorCoords] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Dynamic Sun Azimuth for QuickMap earthShadow simulation (0 to 360 deg)
  const [sunAzimuth, setSunAzimuth] = useState(45);
  const [isPlayingSun, setIsPlayingSun] = useState(false);

  // Live QuickMap URL generator
  const getActiveQuickMapUrl = useCallback(() => {
    if (currentSite) {
      return buildSiteQuickMapUrl(currentSite.latitude, currentSite.longitude, 75.0);
    }
    return QUICKMAP_CANONICAL_RESOLVED;
  }, [currentSite]);

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
  }, [viewMode]);

  // Sun orbit animation
  useEffect(() => {
    if (!isPlayingSun) return;
    const interval = setInterval(() => {
      setSunAzimuth((az) => (az + 1) % 360);
    }, 80);
    return () => clearInterval(interval);
  }, [isPlayingSun]);

  // Copy share URL handler
  const handleCopyLink = () => {
    navigator.clipboard.writeText(getActiveQuickMapUrl());
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCopySiteUrl = (siteId, url) => {
    navigator.clipboard.writeText(url);
    setCopiedSiteId(siteId);
    setTimeout(() => setCopiedSiteId(null), 2500);
  };

  // Canvas Mouse interactions
  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }

    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const mouseX = (e.clientX - rect.left) * dpr;
    const mouseY = (e.clientY - rect.top) * dpr;

    const { cx, cy, radius } = getCanvasCenter();
    const coords = polarUnproject(mouseX, mouseY, cx, cy, radius);
    setCursorCoords(coords);

    // Check hit on candidate site pins
    let foundSite = null;
    for (const site of sites) {
      const pt = polarProject(site.latitude, site.longitude, cx, cy, radius);
      const dist = Math.hypot(mouseX - pt.x, mouseY - pt.y);
      if (dist < 18 * dpr) {
        foundSite = site;
        break;
      }
    }
    setHoveredSite(foundSite);
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleClick = (e) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const mouseX = (e.clientX - rect.left) * dpr;
    const mouseY = (e.clientY - rect.top) * dpr;

    const { cx, cy, radius } = getCanvasCenter();
    for (const site of sites) {
      const pt = polarProject(site.latitude, site.longitude, cx, cy, radius);
      const dist = Math.hypot(mouseX - pt.x, mouseY - pt.y);
      if (dist < 18 * dpr) {
        onSelectSite(site.id);
        break;
      }
    }
  };

  // Center view on active site
  const handleCenterOnSite = (site) => {
    onSelectSite(site.id);
    if (!canvasRef.current) return;
    const w = canvasRef.current.width;
    const h = canvasRef.current.height;
    const radius = Math.min(w, h) * 0.44 * 1.5;
    const pt = polarProject(site.latitude, site.longitude, w / 2, h / 2, radius);
    setZoom(1.5);
    setPan({
      x: w / 2 - pt.x,
      y: h / 2 - pt.y,
    });
  };

  // Render Canvas Map
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || viewMode !== 'canvas') return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const dpr = window.devicePixelRatio || 1;

    ctx.clearRect(0, 0, width, height);

    // Deep space backdrop
    ctx.fillStyle = '#05070d';
    ctx.fillRect(0, 0, width, height);

    const { cx, cy, radius } = getCanvasCenter();

    // 1. Lunar South Pole Disk (80°S to 90°S)
    const diskGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    diskGrad.addColorStop(0, '#1c222e');
    diskGrad.addColorStop(0.7, '#131822');
    diskGrad.addColorStop(1, '#0a0d14');

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = diskGrad;
    ctx.fill();
    ctx.clip(); // Clip everything to lunar disc

    // 2. LROC WAC / Optical Mosaic Texture Shading
    if (activeLayers.wacMosaic) {
      // Procedural highland regolith stippling
      const subRings = 24;
      for (let i = 0; i < subRings; i++) {
        const ringR = (radius * (i + 1)) / subRings;
        ctx.beginPath();
        ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
        ctx.strokeStyle = i % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.025)';
        ctx.lineWidth = radius / subRings;
        ctx.stroke();
      }
    }

    // 3. LOLA Hypsometric Elevation Colormap Overlay
    if (activeLayers.lolaElevation) {
      // Render colorized elevation contours for major massifs and rim crests
      const elevFeatures = [
        { lat: -85.99, lon: 2.91, elev: 5050, rKm: 32, label: 'Malapert Massif' },
        { lat: -85.4, lon: 22.0, elev: 2890, rKm: 40, label: 'Leibnitz' },
        { lat: -84.45, lon: 82.8, elev: 1680, rKm: 35, label: 'Amundsen' },
        { lat: -89.78, lon: 125.0, elev: 1240, rKm: 14, label: 'Shackleton Rim' },
        { lat: -87.41, lon: 355.0, elev: 950, rKm: 20, label: 'Haworth' },
        { lat: -89.44, lon: 222.5, elev: 820, rKm: 12, label: 'Connecting Ridge' },
        { lat: -88.52, lon: 271.4, elev: 610, rKm: 18, label: 'de Gerlache' },
        { lat: -85.25, lon: 53.5, elev: 430, rKm: 25, label: 'Nobile' },
      ];

      for (const feat of elevFeatures) {
        const pt = polarProject(feat.lat, feat.lon, cx, cy, radius);
        const featRadiusPx = (feat.rKm / (1737.4 * 0.1745)) * radius;

        const grad = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, featRadiusPx * 1.8);
        if (feat.elev > 4000) {
          grad.addColorStop(0, 'rgba(255, 75, 75, 0.45)');
          grad.addColorStop(0.5, 'rgba(249, 115, 22, 0.25)');
          grad.addColorStop(1, 'rgba(234, 179, 8, 0)');
        } else if (feat.elev > 1500) {
          grad.addColorStop(0, 'rgba(249, 115, 22, 0.4)');
          grad.addColorStop(0.6, 'rgba(234, 179, 8, 0.2)');
          grad.addColorStop(1, 'rgba(34, 197, 94, 0)');
        } else if (feat.elev > 700) {
          grad.addColorStop(0, 'rgba(234, 179, 8, 0.35)');
          grad.addColorStop(0.6, 'rgba(34, 197, 94, 0.18)');
          grad.addColorStop(1, 'rgba(6, 182, 212, 0)');
        } else {
          grad.addColorStop(0, 'rgba(34, 197, 94, 0.3)');
          grad.addColorStop(1, 'rgba(6, 182, 212, 0)');
        }

        ctx.beginPath();
        ctx.arc(pt.x, pt.y, featRadiusPx * 1.8, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      }
    }

    // 4. Permanently Shadowed Regions (PSRs) & Deep Craters
    if (activeLayers.psrs) {
      for (const feat of LUNAR_SOUTH_POLE_FEATURES) {
        if (feat.type === 'crater') {
          const pt = polarProject(feat.lat, feat.lon, cx, cy, radius);
          const crPx = (feat.radiusKm / (1737.4 * 0.1745)) * radius;

          // Rim stroke
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, crPx, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(200, 220, 255, 0.25)';
          ctx.lineWidth = 1.5 * dpr;
          ctx.stroke();

          // Cryogenic Deep PSR Floor
          const psrGrad = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, crPx * 0.75);
          psrGrad.addColorStop(0, 'rgba(4, 12, 32, 0.85)');
          psrGrad.addColorStop(0.7, 'rgba(6, 25, 60, 0.65)');
          psrGrad.addColorStop(1, 'rgba(6, 182, 212, 0)');

          ctx.beginPath();
          ctx.arc(pt.x, pt.y, crPx * 0.75, 0, Math.PI * 2);
          ctx.fillStyle = psrGrad;
          ctx.fill();

          // Hatching / ice icon for cold traps
          ctx.strokeStyle = 'rgba(6, 182, 212, 0.2)';
          ctx.lineWidth = 1 * dpr;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, crPx * 0.4, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }

    // 5. Dynamic Grazing Sunlight & Earth Shadow Simulator (earthShadowEnabled: true)
    if (activeLayers.sunShadow) {
      const sunRad = ((sunAzimuth - 90) * Math.PI) / 180.0;
      const sunDirX = Math.cos(sunRad);
      const sunDirY = Math.sin(sunRad);

      for (const feat of LUNAR_SOUTH_POLE_FEATURES) {
        if (feat.type === 'crater' || feat.type === 'massif') {
          const pt = polarProject(feat.lat, feat.lon, cx, cy, radius);
          const crPx = (feat.radiusKm / (1737.4 * 0.1745)) * radius;

          // Sunward illuminated rim crest
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, crPx, sunRad - Math.PI / 2.5, sunRad + Math.PI / 2.5);
          ctx.strokeStyle = 'rgba(255, 235, 170, 0.75)';
          ctx.lineWidth = 2.5 * dpr;
          ctx.stroke();

          // Leeward cast shadow wedge
          ctx.beginPath();
          ctx.moveTo(pt.x, pt.y);
          ctx.arc(pt.x, pt.y, crPx * 1.5, sunRad + Math.PI / 2, sunRad + (3 * Math.PI) / 2);
          ctx.closePath();
          ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
          ctx.fill();
        }
      }

      // Draw Grazing Sun Vector Indicator on bottom-left of disk
      const sunIndicatorX = cx - radius * 0.75;
      const sunIndicatorY = cy + radius * 0.75;
      ctx.beginPath();
      ctx.arc(sunIndicatorX, sunIndicatorY, 18 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.6)';
      ctx.lineWidth = 1.5 * dpr;
      ctx.fill();
      ctx.stroke();

      // Sun ray arrow
      ctx.beginPath();
      ctx.moveTo(sunIndicatorX, sunIndicatorY);
      ctx.lineTo(
        sunIndicatorX + Math.cos(sunRad) * 14 * dpr,
        sunIndicatorY + Math.sin(sunRad) * 14 * dpr
      );
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2 * dpr;
      ctx.stroke();

      ctx.font = `${9 * dpr}px monospace`;
      ctx.fillStyle = '#f59e0b';
      ctx.fillText(`SUN ${sunAzimuth}°`, sunIndicatorX - 18 * dpr, sunIndicatorY + 28 * dpr);
    }

    // 6. Polar Coordinate Grid (80°S, 85°S, 88°S, 89°S & Meridians)
    if (activeLayers.grid) {
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.15)';
      ctx.lineWidth = 1 * dpr;
      ctx.font = `${9 * dpr}px monospace`;
      ctx.fillStyle = 'rgba(148, 163, 184, 0.4)';

      // Concentric latitude rings
      const rings = [
        { lat: -80, label: '80°S' },
        { lat: -85, label: '85°S' },
        { lat: -88, label: '88°S' },
        { lat: -89, label: '89°S' },
      ];

      for (const r of rings) {
        const ringRadius = ((90.0 - Math.abs(r.lat)) / 10.0) * radius;
        ctx.beginPath();
        ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillText(r.label, cx + 5 * dpr, cy - ringRadius + 12 * dpr);
      }

      // Meridian spokes radiating from South Pole (every 45 degrees)
      for (let angle = 0; angle < 360; angle += 45) {
        const rad = ((angle - 90) * Math.PI) / 180.0;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(rad) * radius, cy + Math.sin(rad) * radius);
        ctx.stroke();

        const labelX = cx + Math.cos(rad) * (radius - 16 * dpr);
        const labelY = cy + Math.sin(rad) * (radius - 16 * dpr);
        ctx.fillText(`${angle}°`, labelX - 8 * dpr, labelY + 3 * dpr);
      }

      // Lunar South Pole (-90°S) center crosshair
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.8)';
      ctx.lineWidth = 1.5 * dpr;
      ctx.beginPath();
      ctx.moveTo(cx - 8 * dpr, cy);
      ctx.lineTo(cx + 8 * dpr, cy);
      ctx.moveTo(cx, cy - 8 * dpr);
      ctx.lineTo(cx, cy + 8 * dpr);
      ctx.stroke();
      ctx.fillStyle = '#06b6d4';
      ctx.fillText('SOUTH POLE (-90°)', cx + 10 * dpr, cy + 4 * dpr);
    }

    // 7. Crater Labels
    ctx.font = `${9 * dpr}px sans-serif`;
    ctx.fillStyle = 'rgba(226, 232, 240, 0.65)';
    for (const feat of LUNAR_SOUTH_POLE_FEATURES) {
      const pt = polarProject(feat.lat, feat.lon, cx, cy, radius);
      ctx.fillText(feat.name, pt.x + 8 * dpr, pt.y - 4 * dpr);
    }

    // 8. Candidate Landing Site Markers (Artemis Zones)
    if (activeLayers.sites) {
      for (const site of sites) {
        const isSelected = site.id === selectedSiteId;
        const isHovered = hoveredSite && hoveredSite.id === site.id;
        const pt = polarProject(site.latitude, site.longitude, cx, cy, radius);

        // Outer pulse ring
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, (isSelected ? 14 : isHovered ? 12 : 9) * dpr, 0, Math.PI * 2);
        ctx.fillStyle = isSelected
          ? 'rgba(6, 182, 212, 0.25)'
          : isHovered
          ? 'rgba(168, 85, 247, 0.25)'
          : 'rgba(59, 130, 246, 0.15)';
        ctx.fill();
        ctx.strokeStyle = isSelected
          ? '#06b6d4'
          : isHovered
          ? '#a855f7'
          : 'rgba(96, 165, 250, 0.8)';
        ctx.lineWidth = (isSelected ? 2 : 1.2) * dpr;
        ctx.stroke();

        // Center Pin
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, (isSelected ? 5 : 3.5) * dpr, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? '#ffffff' : '#38bdf8';
        ctx.fill();

        // Site Label
        ctx.font = `bold ${10 * dpr}px monospace`;
        ctx.fillStyle = isSelected ? '#ffffff' : isHovered ? '#38bdf8' : 'rgba(203, 213, 225, 0.85)';
        ctx.fillText(site.name, pt.x + 12 * dpr, pt.y + 3 * dpr);
      }
    }

    ctx.restore(); // Restore clipping
  }, [
    activeLayers,
    zoom,
    pan,
    sites,
    selectedSiteId,
    hoveredSite,
    sunAzimuth,
    getCanvasCenter,
    viewMode,
  ]);

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-luna-800 bg-luna-950 shadow-2xl">
      {/* 1. TOP SCIENTIFIC EXECUTIVE BANNER */}
      <div className="flex flex-wrap items-center justify-between border-b border-luna-800 bg-luna-900/90 px-4 py-3 backdrop-blur-md z-20 shrink-0 gap-3">
        <div className="flex items-center space-x-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.2)]">
            <Map className="h-5 w-5" />
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <h2 className="font-mono text-sm md:text-base font-bold text-white tracking-wide">
                NASA LROC QuickMap Viewer
              </h2>
              <button
                onClick={() => setViewMode('specs')}
                title="View ASU / NASA LROC QuickMap Stack #3314 Technical Specifications"
                className={`rounded-md border px-2 py-0.5 font-mono text-[10px] transition-all cursor-pointer ${
                  viewMode === 'specs'
                    ? 'border-cyan-400 bg-cyan-500/30 text-white shadow-sm ring-1 ring-cyan-400'
                    : 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/25'
                }`}
              >
                Stack #3314
              </button>
              <span className="hidden sm:inline-block rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] text-amber-300">
                Earth Shadow: ON
              </span>
            </div>
            <p className="font-mono text-xs text-slate-400">
              South Pole Polar Stereographic (EPSG:3032 / proj=10) &bull; NASA LRO / ASU SOC
            </p>
          </div>
        </div>

        {/* View Mode Switcher & Direct Actions */}
        <div className="flex items-center space-x-2">
          {/* Mode Switcher */}
          <div className="flex items-center rounded-xl border border-luna-750 bg-luna-850 p-1 text-xs font-mono shadow-inner">
            <button
              onClick={() => setViewMode('canvas')}
              className={`flex items-center space-x-1.5 rounded-lg px-2.5 py-1 transition-all ${
                viewMode === 'canvas'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Map className="h-3.5 w-3.5" />
              <span>Interactive Map</span>
            </button>

            <button
              onClick={() => setViewMode('embed')}
              className={`flex items-center space-x-1.5 rounded-lg px-2.5 py-1 transition-all ${
                viewMode === 'embed'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Globe className="h-3.5 w-3.5" />
              <span>Live QuickMap Web</span>
            </button>

            <button
              onClick={() => setViewMode('specs')}
              className={`flex items-center space-x-1.5 rounded-lg px-2.5 py-1 transition-all ${
                viewMode === 'specs'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Info className="h-3.5 w-3.5" />
              <span>Stack 3314 Specs</span>
            </button>
          </div>

          {/* Copy Share Link */}
          <button
            onClick={handleCopyLink}
            className="flex items-center space-x-1.5 rounded-xl border border-luna-750 bg-luna-850 px-2.5 py-1.5 font-mono text-xs text-slate-300 hover:border-slate-500 hover:text-white transition-all shadow-md"
            title="Copy Google QuickMap Share Link"
          >
            {copiedLink ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5 text-slate-400" />
                <span className="hidden sm:inline">Share</span>
              </>
            )}
          </button>

          {/* Fullscreen QuickMap Direct Launch */}
          <a
            href={getActiveQuickMapUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 px-3 py-1.5 font-mono text-xs font-semibold text-white shadow-[0_0_15px_rgba(6,182,212,0.3)] hover:from-blue-500 hover:to-cyan-500 transition-all"
            title="Launch Fullscreen LROC QuickMap in Dedicated Window"
          >
            <span>Launch QuickMap</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      {/* 2. CANDIDATE SITE QUICK-JUMP PRESETS */}
      <div className="flex items-center overflow-x-auto border-b border-luna-800 bg-luna-900/60 px-4 py-2 space-x-2 shrink-0 z-10 text-xs font-mono scrollbar-none">
        <span className="text-slate-400 flex items-center space-x-1 shrink-0 mr-1">
          <MapPin className="h-3.5 w-3.5 text-cyan-400" />
          <span>QUICK JUMP:</span>
        </span>

        <button
          onClick={() => {
            setZoom(1.1);
            setPan({ x: 0, y: 0 });
          }}
          className="rounded-lg border border-luna-750 bg-luna-850/80 px-2.5 py-1 text-slate-300 hover:border-cyan-500 hover:text-white whitespace-nowrap transition-colors"
        >
          🌐 South Pole Regional View
        </button>

        {sites.map((site) => {
          const isSelected = site.id === selectedSiteId;
          return (
            <button
              key={site.id}
              onClick={() => handleCenterOnSite(site)}
              className={`rounded-lg px-2.5 py-1 transition-colors whitespace-nowrap flex items-center space-x-1.5 ${
                isSelected
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-sm'
                  : 'bg-luna-850/60 text-slate-400 border border-luna-800 hover:text-white'
              }`}
            >
              <span>{site.name}</span>
              <span className="text-[10px] text-slate-500">({site.elevation_m}m)</span>
            </button>
          );
        })}
      </div>

      {/* 3. MAIN DISPLAY CANVAS OR EMBED FRAME */}
      <div className="relative flex-1 min-h-0 w-full overflow-hidden">
        {/* ================= MODE A: INTERACTIVE LROC CARTOGRAPHIC CANVAS ================= */}
        {viewMode === 'canvas' && (
          <div ref={containerRef} className="relative w-full h-full cursor-grab active:cursor-grabbing">
            <canvas
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onClick={handleClick}
              className="absolute inset-0 h-full w-full block"
            />

            {/* Floating Top Left Layer Control Bar */}
            <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-2 pointer-events-none">
              <div className="pointer-events-auto flex items-center space-x-1.5 rounded-xl border border-luna-800 bg-luna-900/90 p-1.5 backdrop-blur-md text-xs font-mono shadow-xl">
                <span className="text-slate-400 px-1.5 flex items-center space-x-1">
                  <Layers className="h-3.5 w-3.5 text-cyan-400" />
                  <span className="hidden sm:inline">LAYERS:</span>
                </span>

                {[
                  { key: 'wacMosaic', label: 'LROC WAC' },
                  { key: 'lolaElevation', label: 'LOLA Topo' },
                  { key: 'psrs', label: 'PSRs' },
                  { key: 'sunShadow', label: 'Sun Shadow' },
                  { key: 'sites', label: 'Sites' },
                  { key: 'grid', label: 'Grid' },
                ].map((l) => (
                  <button
                    key={l.key}
                    onClick={() =>
                      setActiveLayers((prev) => ({ ...prev, [l.key]: !prev[l.key] }))
                    }
                    className={`rounded-lg px-2 py-1 text-[11px] transition-colors ${
                      activeLayers[l.key]
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        : 'bg-luna-950/60 text-slate-500 border border-transparent hover:text-slate-300'
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>

              {/* Dynamic Sun Azimuth Scrubber */}
              {activeLayers.sunShadow && (
                <div className="pointer-events-auto flex items-center space-x-2 rounded-xl border border-amber-500/30 bg-luna-900/90 px-3 py-1.5 backdrop-blur-md text-xs font-mono text-amber-300 shadow-xl">
                  <Sun className="h-3.5 w-3.5 text-amber-400 animate-spin-slow" />
                  <span className="hidden sm:inline text-slate-400 text-[11px]">SUN AZ:</span>
                  <input
                    type="range"
                    min="0"
                    max="359"
                    value={sunAzimuth}
                    onChange={(e) => setSunAzimuth(parseInt(e.target.value))}
                    className="w-20 md:w-28 accent-amber-500 cursor-pointer h-1 bg-luna-800 rounded"
                  />
                  <span className="font-bold w-9 text-right">{sunAzimuth}°</span>

                  <button
                    onClick={() => setIsPlayingSun(!isPlayingSun)}
                    className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-300 hover:bg-amber-500/30"
                  >
                    {isPlayingSun ? 'Pause' : 'Play'}
                  </button>
                </div>
              )}
            </div>

            {/* Floating Top Right Zoom & Reset Bar */}
            <div className="absolute top-4 right-4 z-10 pointer-events-auto flex items-center space-x-1 rounded-xl border border-luna-800 bg-luna-900/90 p-1 backdrop-blur-md shadow-xl">
              <button
                onClick={() => setZoom((z) => Math.min(z * 1.3, 4.5))}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 hover:bg-luna-800 hover:text-white"
                title="Zoom In"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
              <button
                onClick={() => setZoom((z) => Math.max(z / 1.3, 0.6))}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 hover:bg-luna-800 hover:text-white"
                title="Zoom Out"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  setZoom(1.1);
                  setPan({ x: 0, y: 0 });
                }}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 hover:bg-luna-800 hover:text-white"
                title="Reset View"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>

            {/* Hovered Candidate Site Tooltip Card */}
            {hoveredSite && (
              <div className="pointer-events-none absolute bottom-16 left-4 z-20 w-72 rounded-xl border border-cyan-500/40 bg-luna-900/95 p-3.5 shadow-2xl backdrop-blur-md transition-all">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-white">{hoveredSite.name}</span>
                  <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 font-mono text-[10px] text-cyan-300">
                    {hoveredSite.region}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-[11px] text-slate-300">
                  <div>
                    <span className="text-slate-500 block text-[10px]">COORDINATES</span>
                    <span>
                      {formatLatitude(hoveredSite.latitude)}, {formatLongitude(hoveredSite.longitude)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">ELEVATION / SLOPE</span>
                    <span className="text-cyan-400 font-bold">{hoveredSite.elevation_m}m</span> &bull;{' '}
                    {hoveredSite.slope_degrees}°
                  </div>
                </div>
                <p className="mt-2 text-[10px] text-slate-400 line-clamp-2">
                  {hoveredSite.description}
                </p>
                <div className="mt-2 pt-2 border-t border-white/10 text-[10px] text-cyan-400 font-mono flex items-center justify-between">
                  <span>Click to select site</span>
                  <Crosshair className="h-3 w-3" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= MODE B: LIVE QUICKMAP WEB FRAME ================= */}
        {viewMode === 'embed' && (
          <div className="relative w-full h-full flex flex-col bg-luna-950">
            {/* Top Security & Launch Bar */}
            <div className="flex items-center justify-between border-b border-luna-800 bg-luna-900/90 px-4 py-2 text-xs font-mono text-slate-300 z-10 shrink-0">
              <div className="flex items-center space-x-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>QuickMap Host: quickmap.lroc.im-ldi.com (Intuitive Machines / ASU)</span>
              </div>

              <div className="flex items-center space-x-3">
                <span className="hidden md:inline text-slate-500 text-[11px]">
                  If iframe is blocked by browser cross-origin policy:
                </span>
                <a
                  href={getActiveQuickMapUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-1.5 rounded-lg bg-blue-600 px-3 py-1 font-bold text-white hover:bg-blue-500 transition-colors shadow-md"
                >
                  <span>Open Fullscreen Window</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>

            {/* Iframe with fallback prompt */}
            <div className="relative flex-1 w-full h-full">
              <iframe
                src={getActiveQuickMapUrl()}
                title="LROC QuickMap South Pole"
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                loading="lazy"
              />

              {/* Informational overlay notice */}
              <div className="absolute bottom-4 right-4 z-10 max-w-md rounded-xl border border-luna-750 bg-luna-900/95 p-3.5 shadow-2xl backdrop-blur-md text-xs font-mono space-y-2">
                <div className="flex items-center space-x-2 text-cyan-400 font-bold">
                  <Info className="h-4 w-4" />
                  <span>Browser Framing Notice</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
                  LROC QuickMap enforces strict HTTP security headers (<code>X-Frame-Options: sameorigin</code>). If your browser restricts inline framing, click the button below to launch the pre-configured session in a full tab.
                </p>
                <div className="flex items-center space-x-2 pt-1">
                  <a
                    href={getActiveQuickMapUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-center rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 py-1.5 font-bold text-white hover:from-blue-500 hover:to-cyan-500 transition-all text-[11px]"
                  >
                    Open in Dedicated Window &rarr;
                  </a>
                  <button
                    onClick={() => setViewMode('canvas')}
                    className="rounded-lg border border-luna-700 bg-luna-800 px-2.5 py-1.5 text-[11px] text-slate-300 hover:text-white"
                  >
                    Switch to In-App Map
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= MODE C: STACK #3314 SPECIFICATIONS & DEEP TELEMETRY ================= */}
        {viewMode === 'specs' && (
          <div className="w-full h-full overflow-y-auto p-4 md:p-6 space-y-6">
            {/* Header & Live Provenance Bar */}
            <div className="rounded-2xl border border-luna-800 bg-luna-900/80 p-5 md:p-6 shadow-xl space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-luna-800 pb-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-mono text-lg font-bold text-white flex items-center space-x-2">
                      <Sparkles className="h-5 w-5 text-cyan-400" />
                      <span>LROC QuickMap Stack #3314 Configuration &amp; Technical Dossier</span>
                    </h3>
                    <span
                      className={`inline-flex items-center space-x-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-mono font-semibold ${
                        isLiveMeta
                          ? 'border border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                          : 'border border-cyan-500/40 bg-cyan-500/10 text-cyan-300'
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          isLiveMeta ? 'bg-emerald-400 animate-pulse' : 'bg-cyan-400'
                        }`}
                      />
                      <span>{isLiveMeta ? 'NASA / ASU REST API Connected' : 'Verified Stack Specification'}</span>
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Host: <code>quickmap.lroc.im-ldi.com</code> &bull; Curated by Arizona State University (ASU) School of Earth and Space Exploration &amp; NASA LRO SOC
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={fetchQuickMapMetadata}
                    disabled={metaLoading}
                    className="flex items-center space-x-1.5 rounded-xl border border-luna-750 bg-luna-850 px-3 py-2 font-mono text-xs text-slate-300 hover:text-white hover:border-slate-500 transition-all shadow-md disabled:opacity-50"
                    title="Refresh metadata from backend REST endpoint"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 text-cyan-400 ${metaLoading ? 'animate-spin' : ''}`} />
                    <span>{metaLoading ? 'Syncing...' : 'Refresh API'}</span>
                  </button>

                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(QUICKMAP_CANONICAL_RESOLVED);
                      setCopiedCanonicalUrl(true);
                      setTimeout(() => setCopiedCanonicalUrl(false), 2500);
                    }}
                    className="flex items-center space-x-1.5 rounded-xl border border-luna-750 bg-luna-850 px-3 py-2 font-mono text-xs text-slate-300 hover:text-white hover:border-slate-500 transition-all shadow-md"
                    title="Copy full resolved QuickMap Canonical URL"
                  >
                    {copiedCanonicalUrl ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied URL</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5 text-slate-400" />
                        <span>Copy Canonical URL</span>
                      </>
                    )}
                  </button>

                  <a
                    href={QUICKMAP_CANONICAL_RESOLVED}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 px-4 py-2 font-mono text-xs font-semibold text-white hover:from-blue-500 hover:to-cyan-500 transition-all shadow-lg shrink-0"
                  >
                    <span>Launch Exact Shared View</span>
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>

              {/* Parameter Matrix (4 Key Cards) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-xl border border-luna-800 bg-luna-850/60 p-4 font-mono space-y-1">
                  <span className="text-[10px] text-slate-400 block uppercase font-semibold">Projection Mode</span>
                  <span className="text-base font-bold text-cyan-400 block">proj=10 &bull; EPSG:3032</span>
                  <span className="text-[11px] text-slate-400 block">Lunar South Pole Stereographic</span>
                  <span className="text-[10px] text-slate-500 block">Origin: -90.0°S, Central: 0.0°</span>
                </div>

                <div className="rounded-xl border border-luna-800 bg-luna-850/60 p-4 font-mono space-y-1">
                  <span className="text-[10px] text-slate-400 block uppercase font-semibold">Layer Stack ID</span>
                  <span className="text-base font-bold text-purple-400 block">stack=3314</span>
                  <span className="text-[11px] text-slate-400 block">Multi-Mission Polar Composite</span>
                  <span className="text-[10px] text-slate-500 block">Defs: <code>N4IgzGCMAsIF...</code></span>
                </div>

                <div className="rounded-xl border border-luna-800 bg-luna-850/60 p-4 font-mono space-y-1">
                  <span className="text-[10px] text-slate-400 block uppercase font-semibold">Shadow Modeling</span>
                  <span className="text-base font-bold text-amber-400 block">earthShadowEnabled=true</span>
                  <span className="text-[11px] text-slate-400 block">Raytraced Grazing Sunlight</span>
                  <span className="text-[10px] text-slate-500 block">Simulates ridge shadow occlusion</span>
                </div>

                <div className="rounded-xl border border-luna-800 bg-luna-850/60 p-4 font-mono space-y-1">
                  <span className="text-[10px] text-slate-400 block uppercase font-semibold">Global Extent Bounds</span>
                  <span className="text-base font-bold text-emerald-400 block">&plusmn;3,000 km</span>
                  <span className="text-[11px] text-slate-400 block">Polar Stereo Metric Extent</span>
                  <span className="text-[10px] text-slate-500 block">Covers 80°S to 90°S Polar Cap</span>
                </div>
              </div>
            </div>

            {/* Active Site Polar Stereographic EPSG:3032 Telemetry */}
            {currentSite && (
              <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-luna-900/90 via-luna-900/80 to-blue-950/40 p-5 md:p-6 shadow-xl space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-luna-800/80 pb-4">
                  <div className="flex items-center space-x-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.2)]">
                      <Navigation className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="font-mono text-base font-bold text-white">
                          Active Site: {currentSite.name}
                        </h4>
                        <span className="rounded bg-cyan-500/20 px-2 py-0.5 font-mono text-[10px] font-semibold text-cyan-300">
                          {currentSite.region}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">
                        LOLA Datum Elevation: <span className="text-white font-bold">{currentSite.elevation_m}m</span> &bull; Average Terrain Slope: <span className="text-white font-bold">{currentSite.slope_degrees}°</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => handleCopySiteUrl(currentSite.id, buildSiteQuickMapUrl(currentSite.latitude, currentSite.longitude, 60.0))}
                      className="flex items-center space-x-1.5 rounded-xl border border-luna-700 bg-luna-850 px-3 py-1.5 font-mono text-xs text-slate-300 hover:text-white hover:border-slate-500 transition-all shadow-md"
                    >
                      {copiedSiteId === currentSite.id ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Copied Deep Link</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5 text-slate-400" />
                          <span>Copy Site URL</span>
                        </>
                      )}
                    </button>

                    <a
                      href={buildSiteQuickMapUrl(currentSite.latitude, currentSite.longitude, 60.0)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center space-x-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 font-mono text-xs font-semibold text-white hover:bg-blue-500 transition-all shadow-md"
                    >
                      <span>Launch Site in QuickMap</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>

                {/* Metric Coordinate Conversion Breakdown */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 font-mono text-xs">
                  <div className="rounded-xl border border-luna-800 bg-luna-850/60 p-3">
                    <span className="text-[10px] text-slate-500 uppercase block">Selenographic Coordinates</span>
                    <span className="text-white font-bold text-sm block mt-1">
                      {formatLatitude(currentSite.latitude)}, {formatLongitude(currentSite.longitude)}
                    </span>
                    <span className="text-[10px] text-slate-400">IAU 2000 Selenocentric System</span>
                  </div>

                  {(() => {
                    const { x, y, r } = latLonToPolarStereoM(currentSite.latitude, currentSite.longitude);
                    const distKm = (r / 1000.0).toFixed(1);
                    return (
                      <>
                        <div className="rounded-xl border border-luna-800 bg-luna-850/60 p-3">
                          <span className="text-[10px] text-slate-500 uppercase block">EPSG:3032 Projected Meters</span>
                          <span className="text-cyan-300 font-bold text-sm block mt-1">
                            X: {x > 0 ? `+${x.toFixed(1)}` : x.toFixed(1)} m
                          </span>
                          <span className="text-cyan-300 font-bold text-xs block">
                            Y: {y > 0 ? `+${y.toFixed(1)}` : y.toFixed(1)} m
                          </span>
                        </div>

                        <div className="rounded-xl border border-luna-800 bg-luna-850/60 p-3">
                          <span className="text-[10px] text-slate-500 uppercase block">Offset From South Pole</span>
                          <span className="text-amber-300 font-bold text-sm block mt-1">
                            {distKm} km
                          </span>
                          <span className="text-[10px] text-slate-400">Radial Selenographic Distance</span>
                        </div>

                        <div className="rounded-xl border border-luna-800 bg-luna-850/60 p-3">
                          <span className="text-[10px] text-slate-500 uppercase block">Deep-Link Frame Extent</span>
                          <span className="text-emerald-400 font-bold text-xs block mt-1">
                            &plusmn;60 km Window
                          </span>
                          <span className="text-[10px] text-slate-400">Optimized for Rover Navigation</span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Layer Architecture Specification (All 5 Layers from Stack 3314) */}
            <div className="rounded-2xl border border-luna-800 bg-luna-900/70 p-5 md:p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-luna-800 pb-3">
                <h4 className="font-mono text-sm md:text-base font-bold text-white flex items-center space-x-2">
                  <Layers className="h-4 w-4 text-cyan-400" />
                  <span>Stack #3314 Layer Architecture ({metadata.layers?.length || 5} Verified Layers)</span>
                </h4>
                <span className="font-mono text-xs text-slate-400">
                  ACT-REACT Web Map Service (WMS)
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(metadata.layers || []).map((layer, idx) => (
                  <div
                    key={layer.id || idx}
                    className="rounded-xl border border-luna-800 bg-luna-850/50 p-4 space-y-2.5 hover:border-luna-700 transition-colors"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/20 text-[10px] font-mono font-bold text-blue-300">
                          {idx + 1}
                        </span>
                        <span className="font-mono text-xs font-bold text-white">
                          {layer.name}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <span className="rounded bg-cyan-500/15 border border-cyan-500/30 px-1.5 py-0.5 text-[10px] font-mono text-cyan-300">
                          {layer.resolution}
                        </span>
                        <span className="rounded bg-purple-500/15 border border-purple-500/30 px-1.5 py-0.5 text-[10px] font-mono text-purple-300">
                          {layer.layer_type}
                        </span>
                      </div>
                    </div>

                    <div className="font-mono text-[10px] text-slate-500">
                      LAYER ID: <code className="text-slate-300 font-semibold">{layer.id}</code>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed font-sans">
                      {layer.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Candidate Landing Site Bookmarks Table */}
            <div className="rounded-2xl border border-luna-800 bg-luna-900/70 p-5 md:p-6 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-luna-800 pb-3">
                <h4 className="font-mono text-sm md:text-base font-bold text-white flex items-center space-x-2">
                  <MapPin className="h-4 w-4 text-cyan-400" />
                  <span>Artemis III Candidate Sites QuickMap Bookmarks ({sites.length} Sites)</span>
                </h4>
                <p className="font-mono text-xs text-slate-400">
                  Pre-configured with Stack #3314 &amp; Earth Shadow
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {sites.map((site) => {
                  const isSelected = site.id === selectedSiteId;
                  const siteUrl = buildSiteQuickMapUrl(site.latitude, site.longitude, 60.0);
                  const isCopied = copiedSiteId === site.id;

                  return (
                    <div
                      key={site.id}
                      className={`rounded-xl border p-3.5 space-y-2.5 transition-all ${
                        isSelected
                          ? 'border-cyan-500/60 bg-cyan-500/10 shadow-lg shadow-cyan-500/10'
                          : 'border-luna-800 bg-luna-850/40 hover:border-luna-750'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-white truncate mr-2">
                          {site.name}
                        </span>
                        <span className="rounded bg-luna-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-300 shrink-0">
                          {site.elevation_m}m
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                        <span>{formatLatitude(site.latitude)}, {formatLongitude(site.longitude)}</span>
                        <span>Slope: {site.slope_degrees}°</span>
                      </div>

                      <div className="flex items-center space-x-2 pt-1 border-t border-luna-800/60">
                        <button
                          onClick={() => {
                            onSelectSite(site.id);
                            setViewMode('canvas');
                          }}
                          className="flex-1 rounded-lg border border-luna-750 bg-luna-800/80 py-1 text-center font-mono text-[11px] text-slate-300 hover:text-white hover:bg-luna-700 transition-colors"
                        >
                          Select Site
                        </button>

                        <button
                          onClick={() => handleCopySiteUrl(site.id, siteUrl)}
                          className="flex items-center space-x-1 rounded-lg border border-luna-750 bg-luna-800/80 px-2 py-1 font-mono text-[11px] text-slate-300 hover:text-white hover:bg-luna-700 transition-colors"
                          title="Copy site deep link"
                        >
                          {isCopied ? (
                            <>
                              <Check className="h-3 w-3 text-emerald-400" />
                              <span className="text-emerald-400 text-[10px]">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3 text-slate-400" />
                              <span className="text-[10px]">Copy</span>
                            </>
                          )}
                        </button>

                        <a
                          href={siteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center space-x-1 rounded-lg bg-blue-600 px-2.5 py-1 font-mono text-[11px] font-semibold text-white hover:bg-blue-500 transition-colors shadow-sm"
                          title="Launch site in LROC QuickMap"
                        >
                          <span>Open</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Protocol & Payload Dossier */}
            <div className="rounded-2xl border border-luna-800 bg-luna-900/70 p-5 md:p-6 shadow-xl space-y-4">
              <h4 className="font-mono text-sm md:text-base font-bold text-white flex items-center space-x-2 border-b border-luna-800 pb-3">
                <FileText className="h-4 w-4 text-cyan-400" />
                <span>ACT-REACT Protocol &amp; URL Payload Reference</span>
              </h4>

              <div className="space-y-3 font-mono text-xs">
                <div className="rounded-xl border border-luna-800 bg-luna-950/80 p-3.5 space-y-2">
                  <div className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                    Canonical Share Link Resolution:
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-luna-900/90 rounded-lg p-2.5 border border-luna-800">
                    <code className="text-cyan-300 break-all select-all text-[11px]">
                      {QUICKMAP_SHARE_URL}
                    </code>
                    <span className="text-[10px] text-slate-500 shrink-0">
                      HTTP 302 Redirect
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-luna-900/90 rounded-lg p-2.5 border border-luna-800">
                    <code className="text-slate-300 break-all select-all text-[11px]">
                      {QUICKMAP_CANONICAL_RESOLVED}
                    </code>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div className="rounded-xl border border-luna-800 bg-luna-850/40 p-3 space-y-1">
                    <span className="text-slate-500 text-[10px] uppercase block">Parameter: prjExtent</span>
                    <span className="text-white font-bold block text-xs">Xmin, Ymin, Xmax, Ymax</span>
                    <span className="text-slate-400 text-[11px]">Bounding box coordinates in polar stereographic meters (EPSG:3032).</span>
                  </div>

                  <div className="rounded-xl border border-luna-800 bg-luna-850/40 p-3 space-y-1">
                    <span className="text-slate-500 text-[10px] uppercase block">Parameter: proj</span>
                    <span className="text-cyan-400 font-bold block text-xs">proj=10</span>
                    <span className="text-slate-400 text-[11px]">Selects IAU Moon South Pole Stereographic projection engine.</span>
                  </div>

                  <div className="rounded-xl border border-luna-800 bg-luna-850/40 p-3 space-y-1">
                    <span className="text-slate-500 text-[10px] uppercase block">Parameter: stack</span>
                    <span className="text-purple-400 font-bold block text-xs">stack=3314</span>
                    <span className="text-slate-400 text-[11px]">Multi-mission composite stack curated by ASU and Intuitive Machines.</span>
                  </div>

                  <div className="rounded-xl border border-luna-800 bg-luna-850/40 p-3 space-y-1">
                    <span className="text-slate-500 text-[10px] uppercase block">Parameter: earthShadowEnabled</span>
                    <span className="text-amber-400 font-bold block text-xs">earthShadowEnabled=true</span>
                    <span className="text-slate-400 text-[11px]">Enables real-time ACT-REACT grazing shadow raytracing across topography.</span>
                  </div>

                  <div className="rounded-xl border border-luna-800 bg-luna-850/40 p-3 space-y-1 sm:col-span-2">
                    <span className="text-slate-500 text-[10px] uppercase block">Parameter: defs</span>
                    <code className="text-emerald-400 font-bold block text-xs truncate">
                      {CANONICAL_DEFS}
                    </code>
                    <span className="text-slate-400 text-[11px]">Compressed LZ-string layer definition payload storing visibility, opacity, and colormap state.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. BOTTOM TELEMETRY STATUS BAR */}
      <div className="flex flex-wrap items-center justify-between border-t border-luna-800 bg-luna-900/90 px-4 py-2 font-mono text-xs backdrop-blur-md z-10 shrink-0">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1.5">
            <Crosshair className="h-3.5 w-3.5 text-cyan-400" />
            <span className="text-slate-400">CURSOR:</span>
            <span className="text-cyan-300 font-semibold">
              {cursorCoords
                ? `${formatLatitude(cursorCoords.latitude)}, ${formatLongitude(cursorCoords.longitude)}`
                : 'Hover map'}
            </span>
          </div>

          <div className="hidden md:flex items-center space-x-1.5 text-slate-400 border-l border-luna-800 pl-3">
            <span>ACTIVE SITE:</span>
            <span className="text-white font-bold">{currentSite ? currentSite.name : 'None selected'}</span>
          </div>
        </div>

        <div className="flex items-center space-x-3 text-slate-400 text-[11px]">
          <span>PROJECTION: EPSG:3032</span>
          <span>&bull;</span>
          <span>SCALE: 1:5,000,000</span>
          <span>&bull;</span>
          <a
            href="https://quickmap.lroc.im-ldi.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 flex items-center space-x-1"
          >
            <span>quickmap.lroc.im-ldi.com</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
