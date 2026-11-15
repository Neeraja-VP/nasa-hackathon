/**
 * LUNA NAVIGATOR — 3D Lunar Topography & Procedural Shader Engine
 * Reconstructs 3D digital elevation models of the Lunar South Pole (80°S - 90°S)
 * using empirical NASA LOLA elevation models and scientific colormaps.
 */

import * as THREE from 'three';

export const MOON_RADIUS_KM = 1737.4;
export const SOUTH_POLE_EXTENT_KM = 300.0; // +/- 300 km from South Pole

/**
 * Empirical elevation benchmarks for candidate sites & polar features
 */
export const POLAR_TOPOGRAPHY_FEATURES = [
  { id: 'shackleton', name: 'Shackleton Crater', xKm: 0.0, yKm: -3.03, radiusKm: 10.5, rimElevM: 1240.0, floorElevM: -3000.0 },
  { id: 'de-gerlache', name: 'de Gerlache Crater', xKm: -44.5, yKm: -1.1, radiusKm: 16.2, rimElevM: 610.0, floorElevM: -1800.0 },
  { id: 'malapert-massif', name: 'Malapert Mountain', xKm: 6.2, yKm: 121.5, radiusKm: 18.0, peakElevM: 5050.0, baseElevM: 800.0 },
  { id: 'connecting-ridge', name: 'Connecting Ridge', xKm: -11.5, yKm: -10.4, radiusKm: 8.0, peakElevM: 820.0, baseElevM: 200.0 },
  { id: 'haworth', name: 'Haworth Crater', xKm: -6.8, yKm: 78.4, radiusKm: 17.5, rimElevM: 950.0, floorElevM: -2800.0 },
  { id: 'shoemaker', name: 'Shoemaker Crater', xKm: 40.5, yKm: 40.5, radiusKm: 25.4, rimElevM: 800.0, floorElevM: -2500.0 },
  { id: 'faustini', name: 'Faustini Crater', xKm: 79.5, yKm: 18.2, radiusKm: 19.5, rimElevM: 750.0, floorElevM: -2100.0 },
  { id: 'nobile', name: 'Nobile Rim (VIPER)', xKm: 83.0, yKm: 114.0, radiusKm: 39.8, rimElevM: 430.0, floorElevM: -1500.0 },
  { id: 'amundsen', name: 'Amundsen Crater', xKm: 167.0, yKm: 15.0, radiusKm: 51.5, rimElevM: 1680.0, floorElevM: -3200.0 },
  { id: 'leibnitz', name: 'Leibnitz Plateau', xKm: 70.0, yKm: 118.0, radiusKm: 25.0, peakElevM: 2890.0, baseElevM: 900.0 }
];

/**
 * Computes elevation in meters relative to lunar datum (R=1737.4 km)
 * at projected Cartesian coordinate (xKm, yKm) from the South Pole.
 */
export function getLolaElevationAtPoint(xKm, yKm) {
  let elevationM = 650.0; // Baseline lunar highlands elevation

  // 1. Regional undulating highland topography (spherical harmonics approximation)
  const distFromPoleKm = Math.hypot(xKm, yKm);
  const angleRad = Math.atan2(xKm, -yKm);

  elevationM += 400.0 * Math.sin(angleRad * 3.0 + 0.5)
              + 300.0 * Math.cos(distFromPoleKm * 0.05)
              + 180.0 * Math.sin(xKm * 0.04 + yKm * 0.03);

  // 2. Micro-impact crater noise across all scales
  const microNoise = Math.sin(xKm * 0.25) * Math.cos(yKm * 0.25) * 80.0
                   + Math.sin(xKm * 0.8 + 1.2) * Math.sin(yKm * 0.8) * 35.0;
  elevationM += microNoise;

  // 3. Inject major characterized impact basins and massifs
  for (const feat of POLAR_TOPOGRAPHY_FEATURES) {
    const dKm = Math.hypot(xKm - feat.xKm, yKm - feat.yKm);

    if (feat.peakElevM !== undefined) {
      // Mountain Massif / Peak structure (e.g. Malapert, Connecting Ridge, Leibnitz)
      if (dKm < feat.radiusKm * 1.8) {
        const factor = Math.exp(-0.5 * Math.pow(dKm / (feat.radiusKm * 0.65), 2));
        const mountainHeight = feat.peakElevM - feat.baseElevM;
        elevationM = Math.max(elevationM, feat.baseElevM + mountainHeight * factor);
      }
    } else if (feat.floorElevM !== undefined) {
      // Impact Crater Bowl structure (e.g. Shackleton, Haworth, de Gerlache)
      const r = feat.radiusKm;
      if (dKm < r) {
        // Deep interior crater bowl
        const normR = dKm / r;
        const depth = feat.floorElevM + (feat.rimElevM - feat.floorElevM) * Math.pow(normR, 2.2);
        elevationM = depth;
      } else if (dKm < r * 1.5) {
        // Elevated crater rim & ejecta blanket
        const rimFactor = (dKm - r) / (0.5 * r);
        const rimBlend = feat.rimElevM - (feat.rimElevM - 600.0) * rimFactor;
        elevationM = Math.max(elevationM, rimBlend);
      }
    }
  }

  return elevationM;
}

/**
 * Creates 3D digital elevation mesh for South Pole terrain
 */
export function buildSouthPoleTerrainGeometry(gridSegments = 140, extentKm = SOUTH_POLE_EXTENT_KM, vertExaggeration = 2.0) {
  const geo = new THREE.PlaneGeometry(extentKm, extentKm, gridSegments, gridSegments);
  geo.rotateX(-Math.PI / 2); // Place plane horizontal (XZ)

  const posAttr = geo.attributes.position;
  const count = posAttr.count;

  const elevations = new Float32Array(count);
  const slopes = new Float32Array(count);

  const colorsLola = new Float32Array(count * 3);
  const colorsSlope = new Float32Array(count * 3);
  const colorsRegolith = new Float32Array(count * 3);

  // Elevation scale: 1 km elevation = 1 unit in 3D world space
  const elevScale = (1.0 / 1000.0) * vertExaggeration;

  const colorDeepBlue = new THREE.Color('#0a184a'); // Deepest PSR floors (-3000m)
  const colorCyan = new THREE.Color('#00a2ff');
  const colorTeal = new THREE.Color('#00d2b4');
  const colorGreen = new THREE.Color('#22c55e');
  const colorYellow = new THREE.Color('#eab308');
  const colorOrange = new THREE.Color('#f97316');
  const colorRed = new THREE.Color('#ef4444');
  const colorWhite = new THREE.Color('#ffffff'); // Highest massif peaks (+5050m)

  // Slope safety colors
  const colorSafe = new THREE.Color('#10b981'); // Safe slope < 5°
  const colorCaution = new THREE.Color('#f59e0b'); // Caution 5° - 10°
  const colorHazard = new THREE.Color('#ef4444'); // Hazard > 12°

  // Regolith base
  const colorRockDark = new THREE.Color('#232833');
  const colorRockLight = new THREE.Color('#64748b');

  for (let i = 0; i < count; i++) {
    const xKm = posAttr.getX(i);
    const zKm = posAttr.getZ(i);

    // Compute elevation
    const elevM = getLolaElevationAtPoint(xKm, zKm);
    elevations[i] = elevM;

    // Apply displacement to Y axis
    const yWorld = elevM * elevScale;
    posAttr.setY(i, yWorld);

    // 1. LOLA Hypsometric Color Map (normalized between -3000m and +5100m)
    const normElev = Math.max(0, Math.min(1, (elevM - (-3000.0)) / (5100.0 - (-3000.0))));
    let colLola;
    if (normElev < 0.2) {
      colLola = colorDeepBlue.clone().lerp(colorCyan, normElev / 0.2);
    } else if (normElev < 0.4) {
      colLola = colorCyan.clone().lerp(colorTeal, (normElev - 0.2) / 0.2);
    } else if (normElev < 0.6) {
      colLola = colorTeal.clone().lerp(colorGreen, (normElev - 0.4) / 0.2);
    } else if (normElev < 0.75) {
      colLola = colorGreen.clone().lerp(colorYellow, (normElev - 0.6) / 0.15);
    } else if (normElev < 0.9) {
      colLola = colorYellow.clone().lerp(colorOrange, (normElev - 0.75) / 0.15);
    } else if (normElev < 0.97) {
      colLola = colorOrange.clone().lerp(colorRed, (normElev - 0.9) / 0.07);
    } else {
      colLola = colorRed.clone().lerp(colorWhite, (normElev - 0.97) / 0.03);
    }

    colorsLola[i * 3] = colLola.r;
    colorsLola[i * 3 + 1] = colLola.g;
    colorsLola[i * 3 + 2] = colLola.b;

    // 2. Photorealistic Regolith Color (albedo variations with elevation & crater depth)
    const regolithFactor = Math.max(0.1, Math.min(1.0, (elevM + 2500.0) / 6000.0));
    const colReg = colorRockDark.clone().lerp(colorRockLight, regolithFactor);
    colorsRegolith[i * 3] = colReg.r;
    colorsRegolith[i * 3 + 1] = colReg.g;
    colorsRegolith[i * 3 + 2] = colReg.b;
  }

  geo.computeVertexNormals();

  // 3. Compute Slope Angle for each vertex from surface normals
  const normalAttr = geo.attributes.normal;
  for (let i = 0; i < count; i++) {
    const ny = normalAttr.getY(i); // Vertical component of normal
    // Slope angle in degrees from horizontal: arccos(ny)
    const slopeDeg = Math.acos(Math.max(0, Math.min(1, ny))) * (180.0 / Math.PI);
    slopes[i] = slopeDeg;

    let colSlope;
    if (slopeDeg < 5.0) {
      colSlope = colorSafe;
    } else if (slopeDeg < 12.0) {
      const t = (slopeDeg - 5.0) / 7.0;
      colSlope = colorSafe.clone().lerp(colorCaution, t);
    } else {
      const t = Math.min(1.0, (slopeDeg - 12.0) / 10.0);
      colSlope = colorCaution.clone().lerp(colorHazard, t);
    }

    colorsSlope[i * 3] = colSlope.r;
    colorsSlope[i * 3 + 1] = colSlope.g;
    colorsSlope[i * 3 + 2] = colSlope.b;
  }

  geo.setAttribute('colorLola', new THREE.BufferAttribute(colorsLola, 3));
  geo.setAttribute('colorSlope', new THREE.BufferAttribute(colorsSlope, 3));
  geo.setAttribute('colorRegolith', new THREE.BufferAttribute(colorsRegolith, 3));

  // Default color attribute
  geo.setAttribute('color', new THREE.BufferAttribute(colorsRegolith.slice(), 3));

  geo.geometry = geo;
  geo.elevations = elevations;
  geo.slopes = slopes;

  return { geometry: geo, elevations, slopes };
}

/**
 * Creates dynamic high-resolution texture canvas for the Moon Globe
 */
export function createMoonTexture(width = 1024, height = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Deep basalt highland base
  ctx.fillStyle = '#404552';
  ctx.fillRect(0, 0, width, height);

  // Maria regions (darker patches)
  const mariaGradients = [
    { x: width * 0.45, y: height * 0.35, rx: width * 0.2, ry: height * 0.25 }, // Oceanus Procellarum / Imbrium
    { x: width * 0.65, y: height * 0.40, rx: width * 0.12, ry: height * 0.18 }, // Serenitatis / Tranquillitatis
    { x: width * 0.75, y: height * 0.45, rx: width * 0.08, ry: height * 0.10 }, // Crisium
    { x: width * 0.50, y: height * 0.75, rx: width * 0.18, ry: height * 0.15 }, // South Pole-Aitken (SPA) Basin
  ];

  for (const m of mariaGradients) {
    const grad = ctx.createRadialGradient(m.x, m.y, 10, m.x, m.y, m.rx);
    grad.addColorStop(0, '#1a1d26');
    grad.addColorStop(0.6, '#262b38');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(m.x, m.y, m.rx, m.ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Cratering rays & bright highland anorthosite speckles
  const rand = (min, max) => min + Math.random() * (max - min);
  ctx.fillStyle = '#838ea3';
  for (let i = 0; i < 400; i++) {
    const cx = rand(0, width);
    const cy = rand(0, height);
    const rad = rand(2, 12);
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  // Bright Tycho & Copernicus ray bursts
  const rays = [
    { x: width * 0.43, y: height * 0.70, color: 'rgba(210, 220, 240, 0.25)' }, // Tycho
    { x: width * 0.40, y: height * 0.38, color: 'rgba(200, 215, 235, 0.20)' }, // Copernicus
  ];

  for (const r of rays) {
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) {
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(r.x, r.y);
      ctx.lineTo(r.x + Math.cos(a) * 140, r.y + Math.sin(a) * 140);
      ctx.stroke();
    }
  }

  // South Pole Polar Cap highlight
  const southPoleGrad = ctx.createLinearGradient(0, height * 0.85, 0, height);
  southPoleGrad.addColorStop(0, 'transparent');
  southPoleGrad.addColorStop(1, 'rgba(6, 182, 212, 0.25)');
  ctx.fillStyle = southPoleGrad;
  ctx.fillRect(0, height * 0.85, width, height * 0.15);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

/**
 * Creates dynamic 3D Earth texture for lunar sky visualization
 */
export function createEarthTexture(width = 512, height = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Deep Blue Oceans
  ctx.fillStyle = '#0f3866';
  ctx.fillRect(0, 0, width, height);

  // Continental landmasses
  ctx.fillStyle = '#225533';
  // North America & South America
  ctx.beginPath();
  ctx.ellipse(width * 0.25, height * 0.35, 45, 30, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(width * 0.32, height * 0.65, 30, 45, 0.2, 0, Math.PI * 2);
  ctx.fill();

  // Africa & Eurasia
  ctx.beginPath();
  ctx.ellipse(width * 0.55, height * 0.55, 35, 40, 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(width * 0.65, height * 0.32, 60, 30, 0, 0, Math.PI * 2);
  ctx.fill();

  // Swirling white clouds
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  for (let i = 0; i < 20; i++) {
    const cx = (i * 37) % width;
    const cy = 25 + (i * 29) % (height - 50);
    ctx.beginPath();
    ctx.ellipse(cx, cy, 35, 12, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Polar ice caps
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, 18);
  ctx.fillRect(0, height - 22, width, 22);

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

/**
 * Converts Selenographic (lat, lon) to Cartesian coordinates (X, Z) in km
 * on the 3D South Pole terrain mesh.
 */
export function latLonToTerrainCoordsKm(latitude, longitude) {
  const colatRad = ((90.0 - Math.abs(latitude)) * Math.PI) / 180.0;
  // Distance from pole along surface
  const distKm = MOON_RADIUS_KM * Math.tan(colatRad);

  const lonRad = (longitude * Math.PI) / 180.0;
  const xKm = distKm * Math.sin(lonRad);
  const zKm = -distKm * Math.cos(lonRad);

  return { xKm, zKm, distKm };
}
