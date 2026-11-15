import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  Globe,
  Layers,
  Sun,
  Radio,
  Play,
  Pause,
  RotateCcw,
  Maximize2,
  Compass,
  MapPin,
  Mountain,
  Eye,
  Sliders,
  Sparkles,
  Info,
  Map,
} from 'lucide-react';
import {
  buildSouthPoleTerrainGeometry,
  createMoonTexture,
  createEarthTexture,
  latLonToTerrainCoordsKm,
  getLolaElevationAtPoint,
  SOUTH_POLE_EXTENT_KM
} from '../../utils/lunarTerrain3D';
import { formatLatitude, formatLongitude } from '../../utils/coordinates';

export default function MoonSurface3D({
  sites = [],
  selectedSiteId,
  onSelectSite,
  currentSite,
  missionConfig,
  onNavigateTab,
}) {
  const mountRef = useRef(null);

  // View & Simulation States
  const [viewMode, setViewMode] = useState('south_pole_dem'); // 'south_pole_dem' | 'global_moon' | 'first_person'
  const [shadingStyle, setShadingStyle] = useState('regolith'); // 'regolith' | 'lola' | 'slope' | 'wireframe'
  const [vertExaggeration, setVertExaggeration] = useState(2.0);
  const [showEarth, setShowEarth] = useState(true);
  const [showSitePins, setShowSitePins] = useState(true);

  // Diurnal cycle time simulation
  const [isPlayingSolar, setIsPlayingSolar] = useState(false);
  const [solarHourOffset, setSolarHourOffset] = useState(0);

  // Hover state
  const [hoveredSite, setHoveredSite] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Three.js internal references
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const terrainMeshRef = useRef(null);
  const moonSphereRef = useRef(null);
  const sunLightRef = useRef(null);
  const earthMeshRef = useRef(null);
  const siteMarkersGroupRef = useRef(null);
  const animationFrameRef = useRef(null);

  // 1. Initialize Three.js Scene
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth;
    const height = mount.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color('#05070c');

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 5000);
    camera.position.set(0, 220, 260);
    cameraRef.current = camera;

    // WebGL Renderer with High-Precision Shadows
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    rendererRef.current = renderer;

    mount.appendChild(renderer.domElement);

    // OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxDistance = 1200;
    controls.minDistance = 2;
    controls.maxPolarAngle = Math.PI / 2 + 0.1; // Prevent going beneath ground plane
    controlsRef.current = controls;

    // Ambient Space Light (subtle earthshine & starlight)
    const ambientLight = new THREE.AmbientLight('#182030', 0.55);
    scene.add(ambientLight);

    // Sun Directional Light (Dynamic low-elevation polar sunlight with sharp shadows)
    const sunLight = new THREE.DirectionalLight('#fffdf5', 2.2);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 1000;
    const d = 200;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);
    sunLightRef.current = sunLight;

    // Sun visual orb
    const sunGeo = new THREE.SphereGeometry(6, 16, 16);
    const sunMat = new THREE.MeshBasicMaterial({ color: '#fff5b0' });
    const sunOrb = new THREE.Mesh(sunGeo, sunMat);
    sunLight.add(sunOrb);

    // Deep Space Starfield
    const starsGeo = new THREE.BufferGeometry();
    const starCount = 1800;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      starPositions[i] = (Math.random() - 0.5) * 3000;
      starPositions[i + 1] = Math.random() * 1500 + 100;
      starPositions[i + 2] = (Math.random() - 0.5) * 3000;
    }
    starsGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starsMat = new THREE.PointsMaterial({ color: '#c0d0f0', size: 1.5, sizeAttenuation: false });
    const starField = new THREE.Points(starsGeo, starsMat);
    scene.add(starField);

    // 2. Build 3D South Pole Regional Terrain Mesh
    const { geometry: terrainGeo } = buildSouthPoleTerrainGeometry(140, SOUTH_POLE_EXTENT_KM, vertExaggeration);
    const terrainMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.85,
      metalness: 0.1,
      flatShading: false
    });
    const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    terrainMesh.receiveShadow = true;
    terrainMesh.castShadow = true;
    scene.add(terrainMesh);
    terrainMeshRef.current = terrainMesh;

    // 3. Build 3D Global Moon Sphere (visible in global_moon mode)
    const moonTex = createMoonTexture();
    const moonSphereGeo = new THREE.SphereGeometry(80, 64, 64);
    const moonSphereMat = new THREE.MeshStandardMaterial({
      map: moonTex,
      roughness: 0.9,
      metalness: 0.05
    });
    const moonSphere = new THREE.Mesh(moonSphereGeo, moonSphereMat);
    moonSphere.position.set(0, -40, 0);
    moonSphere.rotation.x = -Math.PI / 2; // Orient South Pole towards viewer
    moonSphere.visible = false;
    scene.add(moonSphere);
    moonSphereRef.current = moonSphere;

    // 4. Build 3D Earth in Lunar Sky
    const earthTex = createEarthTexture();
    const earthGeo = new THREE.SphereGeometry(7, 32, 32);
    const earthMat = new THREE.MeshStandardMaterial({
      map: earthTex,
      roughness: 0.6,
      metalness: 0.1
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    earthMesh.position.set(120, 35, -220); // Topocentric elevation ~5° - 8° above horizon
    scene.add(earthMesh);
    earthMeshRef.current = earthMesh;

    // Earth atmosphere halo
    const haloGeo = new THREE.SphereGeometry(7.6, 32, 32);
    const haloMat = new THREE.MeshBasicMaterial({
      color: '#38bdf8',
      transparent: true,
      opacity: 0.25,
      side: THREE.BackSide
    });
    const earthHalo = new THREE.Mesh(haloGeo, haloMat);
    earthMesh.add(earthHalo);

    // 5. Build Candidate Site Beacons Group
    const siteMarkersGroup = new THREE.Group();
    scene.add(siteMarkersGroup);
    siteMarkersGroupRef.current = siteMarkersGroup;

    // Animation Loop
    let lastTime = performance.now();
    function animate(time) {
      animationFrameRef.current = requestAnimationFrame(animate);
      const delta = (time - lastTime) / 1000.0;
      lastTime = time;

      controls.update();

      // Earth slow rotation
      if (earthMeshRef.current) {
        earthMeshRef.current.rotation.y += delta * 0.15;
      }

      // Rotate moon globe when in global mode
      if (moonSphereRef.current && moonSphereRef.current.visible) {
        moonSphereRef.current.rotation.z += delta * 0.04;
      }

      renderer.render(scene, camera);
    }
    animate(performance.now());

    // Resize Handler
    function handleResize() {
      if (!mount || !rendererRef.current || !cameraRef.current) return;
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    }
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (renderer.domElement && mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // Update Dynamic Sunlight based on Mission Hour & Start Date
  useEffect(() => {
    if (!sunLightRef.current) return;

    // Moon synodic diurnal cycle: 708.7 hours per lunar day (Sun advances ~0.508°/hour)
    const solarAzimuthDeg = (solarHourOffset * 0.508) % 360.0;
    // Polar solar elevation angle fluctuates between 0.0° and 1.8°
    const solarElevDeg = 1.35 + 0.35 * Math.sin((solarHourOffset / 708.7) * Math.PI * 2);

    const radAz = (solarAzimuthDeg * Math.PI) / 180.0;
    const radEl = (solarElevDeg * Math.PI) / 180.0;

    // Position sun light on 3D hemisphere (distance 350 units)
    const sunDist = 350.0;
    const sunX = sunDist * Math.cos(radEl) * Math.sin(radAz);
    const sunY = Math.max(12.0, sunDist * Math.sin(radEl)); // Maintain grazing low angle
    const sunZ = -sunDist * Math.cos(radEl) * Math.cos(radAz);

    sunLightRef.current.position.set(sunX, sunY, sunZ);
  }, [solarHourOffset]);

  // Handle Play/Pause Diurnal Simulation
  useEffect(() => {
    let timer;
    if (isPlayingSolar) {
      timer = setInterval(() => {
        setSolarHourOffset((prev) => (prev + 2.0) % 708);
      }, 50);
    }
    return () => clearInterval(timer);
  }, [isPlayingSolar]);

  // Update Shading Style (Regolith / LOLA / Slope / Wireframe)
  useEffect(() => {
    if (!terrainMeshRef.current) return;
    const mesh = terrainMeshRef.current;
    const geo = mesh.geometry;
    const mat = mesh.material;

    if (shadingStyle === 'wireframe') {
      mat.wireframe = true;
      mat.color.set('#06b6d4');
      mat.vertexColors = false;
    } else {
      mat.wireframe = false;
      mat.color.set('#ffffff');
      mat.vertexColors = true;

      const attrName =
        shadingStyle === 'lola' ? 'colorLola' :
        shadingStyle === 'slope' ? 'colorSlope' : 'colorRegolith';

      const sourceAttr = geo.getAttribute(attrName);
      if (sourceAttr) {
        geo.setAttribute('color', sourceAttr);
        geo.attributes.color.needsUpdate = true;
      }
    }
  }, [shadingStyle]);

  // Update Vertical Exaggeration
  useEffect(() => {
    if (!terrainMeshRef.current) return;
    const mesh = terrainMeshRef.current;
    const { geometry: newGeo } = buildSouthPoleTerrainGeometry(140, SOUTH_POLE_EXTENT_KM, vertExaggeration);
    mesh.geometry.dispose();
    mesh.geometry = newGeo;

    // Reapply active shading style
    const attrName =
      shadingStyle === 'lola' ? 'colorLola' :
      shadingStyle === 'slope' ? 'colorSlope' : 'colorRegolith';
    const sourceAttr = newGeo.getAttribute(attrName);
    if (sourceAttr) {
      newGeo.setAttribute('color', sourceAttr);
    }
  }, [vertExaggeration]);

  // Update View Mode (South Pole 3D DEM vs Global Moon vs First-Person Surface)
  useEffect(() => {
    if (!terrainMeshRef.current || !moonSphereRef.current || !cameraRef.current || !controlsRef.current) return;

    const terrain = terrainMeshRef.current;
    const globe = moonSphereRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;

    if (viewMode === 'global_moon') {
      terrain.visible = false;
      globe.visible = true;
      if (siteMarkersGroupRef.current) siteMarkersGroupRef.current.visible = false;

      camera.position.set(0, 150, 160);
      controls.target.set(0, -40, 0);
    } else if (viewMode === 'first_person') {
      terrain.visible = true;
      globe.visible = false;
      if (siteMarkersGroupRef.current) siteMarkersGroupRef.current.visible = true;

      // Position camera directly at active landing site at eye level (2m mast above ground)
      const site = currentSite || sites[0];
      if (site) {
        const { xKm, zKm } = latLonToTerrainCoordsKm(site.latitude, site.longitude);
        const yGround = (getLolaElevationAtPoint(xKm, zKm) / 1000.0) * vertExaggeration;
        camera.position.set(xKm, yGround + 1.5, zKm);
        // Look outward across the crater rim toward Prime Meridian (Z negative)
        controls.target.set(xKm, yGround + 1.2, zKm - 30);
      }
    } else {
      // Default: South Pole 3D DEM
      terrain.visible = true;
      globe.visible = false;
      if (siteMarkersGroupRef.current) siteMarkersGroupRef.current.visible = showSitePins;

      camera.position.set(0, 180, 220);
      controls.target.set(0, 0, 0);
    }
    controls.update();
  }, [viewMode, currentSite, vertExaggeration, showSitePins]);

  // Render 3D Site Beacons & Pins
  useEffect(() => {
    if (!siteMarkersGroupRef.current || !sites.length) return;
    const group = siteMarkersGroupRef.current;

    // Clear previous markers
    while (group.children.length > 0) {
      const obj = group.children[0];
      group.remove(obj);
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
    }

    if (!showSitePins || viewMode === 'global_moon') return;

    sites.forEach((site) => {
      const { xKm, zKm } = latLonToTerrainCoordsKm(site.latitude, site.longitude);
      const elevM = getLolaElevationAtPoint(xKm, zKm);
      const yGround = (elevM / 1000.0) * vertExaggeration;

      const isSelected = site.id === selectedSiteId;

      const siteGroup = new THREE.Group();
      siteGroup.position.set(xKm, yGround, zKm);
      siteGroup.userData = { site };

      // 1. Vertical Laser Pillar Beam (rising to +18 km)
      const beamHeight = isSelected ? 28 : 16;
      const beamGeo = new THREE.CylinderGeometry(0.35, 0.35, beamHeight, 12);
      beamGeo.translate(0, beamHeight / 2, 0);
      const beamMat = new THREE.MeshBasicMaterial({
        color: isSelected ? '#38bdf8' : '#22c55e',
        transparent: true,
        opacity: isSelected ? 0.85 : 0.45
      });
      const beamMesh = new THREE.Mesh(beamGeo, beamMat);
      siteGroup.add(beamMesh);

      // 2. Base Glowing Ring
      const ringGeo = new THREE.RingGeometry(1.5, 3.2, 24);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: isSelected ? '#00e5ff' : '#4ade80',
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.7
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.y = 0.15;
      siteGroup.add(ringMesh);

      // 3. Top Glowing Orb Beacon
      const beaconGeo = new THREE.SphereGeometry(isSelected ? 2.2 : 1.4, 16, 16);
      const beaconMat = new THREE.MeshStandardMaterial({
        color: isSelected ? '#00f0ff' : '#10b981',
        emissive: isSelected ? '#0284c7' : '#059669',
        emissiveIntensity: 1.5,
        roughness: 0.2
      });
      const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
      beaconMesh.position.y = beamHeight;
      siteGroup.add(beaconMesh);

      group.add(siteGroup);
    });
  }, [sites, selectedSiteId, vertExaggeration, showSitePins, viewMode]);

  // Handle Raycasting / Hover / Click on 3D Markers
  const handlePointerMove = useCallback((e) => {
    const mount = mountRef.current;
    if (!mount || !cameraRef.current || !siteMarkersGroupRef.current) return;

    const rect = mount.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), cameraRef.current);

    const intersects = raycaster.intersectObjects(siteMarkersGroupRef.current.children, true);
    if (intersects.length > 0) {
      let topObj = intersects[0].object;
      while (topObj && !topObj.userData?.site && topObj.parent) {
        topObj = topObj.parent;
      }
      if (topObj?.userData?.site) {
        setHoveredSite(topObj.userData.site);
        mount.style.cursor = 'pointer';
        return;
      }
    }

    setHoveredSite(null);
    mount.style.cursor = 'grab';
  }, []);

  const handleClick = useCallback((e) => {
    const mount = mountRef.current;
    if (!mount || !cameraRef.current || !siteMarkersGroupRef.current || !onSelectSite) return;

    const rect = mount.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), cameraRef.current);

    const intersects = raycaster.intersectObjects(siteMarkersGroupRef.current.children, true);
    if (intersects.length > 0) {
      let topObj = intersects[0].object;
      while (topObj && !topObj.userData?.site && topObj.parent) {
        topObj = topObj.parent;
      }
      if (topObj?.userData?.site) {
        onSelectSite(topObj.userData.site.id);
      }
    }
  }, [onSelectSite]);

  // Reset Camera
  const handleResetCamera = () => {
    if (!cameraRef.current || !controlsRef.current) return;
    cameraRef.current.position.set(0, 180, 220);
    controlsRef.current.target.set(0, 0, 0);
    controlsRef.current.update();
  };

  return (
    <div className="relative h-full w-full rounded-2xl border border-luna-800 bg-luna-950 overflow-hidden select-none flex flex-col shadow-2xl">
      {/* 1. TOP INTERACTIVE HUD & VIEW CONTROLS */}
      <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Left: View Mode Buttons */}
        <div className="flex items-center space-x-1.5 rounded-xl border border-luna-750 bg-luna-900/90 p-1.5 shadow-xl backdrop-blur-md pointer-events-auto">
          <button
            onClick={() => setViewMode('south_pole_dem')}
            className={`flex items-center space-x-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              viewMode === 'south_pole_dem'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
                : 'text-slate-400 hover:text-white hover:bg-luna-800'
            }`}
          >
            <Mountain className="h-3.5 w-3.5" />
            <span>South Pole 3D DEM</span>
          </button>
          <button
            onClick={() => setViewMode('global_moon')}
            className={`flex items-center space-x-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              viewMode === 'global_moon'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
                : 'text-slate-400 hover:text-white hover:bg-luna-800'
            }`}
          >
            <Globe className="h-3.5 w-3.5" />
            <span>Global Moon 3D</span>
          </button>
          <button
            onClick={() => setViewMode('first_person')}
            className={`flex items-center space-x-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              viewMode === 'first_person'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
                : 'text-slate-400 hover:text-white hover:bg-luna-800'
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            <span>Lander Surface View</span>
          </button>
        </div>

        {/* Right: Shading Style Selector & Camera Reset */}
        <div className="flex items-center space-x-2 pointer-events-auto">
          {viewMode === 'south_pole_dem' && (
            <div className="flex items-center space-x-1 rounded-xl border border-luna-750 bg-luna-900/90 p-1.5 shadow-xl backdrop-blur-md">
              <span className="text-[11px] font-mono text-slate-400 px-2 hidden sm:inline">SHADING:</span>
              <button
                onClick={() => setShadingStyle('regolith')}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                  shadingStyle === 'regolith' ? 'bg-cyan-600 text-white' : 'text-slate-300 hover:bg-luna-800'
                }`}
                title="Photorealistic Lunar Regolith"
              >
                Regolith
              </button>
              <button
                onClick={() => setShadingStyle('lola')}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                  shadingStyle === 'lola' ? 'bg-cyan-600 text-white' : 'text-slate-300 hover:bg-luna-800'
                }`}
                title="NASA LOLA Elevation Colormap"
              >
                LOLA Elevation
              </button>
              <button
                onClick={() => setShadingStyle('slope')}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                  shadingStyle === 'slope' ? 'bg-cyan-600 text-white' : 'text-slate-300 hover:bg-luna-800'
                }`}
                title="Landing Slope Safety Colormap (<5° Safe, >12° Hazard)"
              >
                Slope Safety
              </button>
              <button
                onClick={() => setShadingStyle('wireframe')}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                  shadingStyle === 'wireframe' ? 'bg-cyan-600 text-white' : 'text-slate-300 hover:bg-luna-800'
                }`}
                title="Triangulated TIN Elevation Wireframe"
              >
                Wireframe
              </button>
            </div>
          )}

          {onNavigateTab && (
            <button
              onClick={() => onNavigateTab('quickmap')}
              className="flex items-center space-x-1.5 rounded-xl border border-indigo-500/40 bg-indigo-950/80 px-3 py-1.5 font-mono text-xs text-indigo-300 hover:bg-indigo-500/30 hover:text-white shadow-xl backdrop-blur-md transition-all"
              title="Open LROC QuickMap (Stack #3314)"
            >
              <Map className="h-3.5 w-3.5 text-indigo-400" />
              <span className="hidden sm:inline">LROC QuickMap</span>
            </button>
          )}

          <button
            onClick={handleResetCamera}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-luna-750 bg-luna-900/90 text-slate-300 hover:text-white hover:bg-luna-800 shadow-xl backdrop-blur-md transition-colors"
            title="Reset 3D Orbit Camera"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 2. MAIN WEBGL THREE.JS CANVAS */}
      <div
        ref={mountRef}
        onPointerMove={handlePointerMove}
        onClick={handleClick}
        className="flex-1 w-full h-full cursor-grab active:cursor-grabbing"
      />

      {/* 3. BOTTOM FLOATING CONTROLS & SUNLIGHT SIMULATION BAR */}
      <div className="absolute bottom-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        {/* Left: Vertical Exaggeration Slider & Layer Toggles */}
        <div className="flex items-center space-x-3 rounded-xl border border-luna-750 bg-luna-900/90 px-3.5 py-2 shadow-xl backdrop-blur-md pointer-events-auto">
          {viewMode === 'south_pole_dem' && (
            <div className="flex items-center space-x-2">
              <Sliders className="h-3.5 w-3.5 text-cyan-400" />
              <span className="text-[11px] font-mono text-slate-300 whitespace-nowrap">
                VERTICAL RELIEF: <strong className="text-cyan-400">{vertExaggeration.toFixed(1)}x</strong>
              </span>
              <input
                type="range"
                min="1.0"
                max="4.5"
                step="0.5"
                value={vertExaggeration}
                onChange={(e) => setVertExaggeration(parseFloat(e.target.value))}
                className="w-20 accent-cyan-400 cursor-pointer"
              />
            </div>
          )}

          <div className="h-4 w-px bg-luna-750 hidden sm:block" />

          <label className="flex items-center space-x-1.5 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={showSitePins}
              onChange={(e) => setShowSitePins(e.target.checked)}
              className="accent-cyan-400 rounded"
            />
            <span className="text-[11px]">Site Beacons</span>
          </label>
        </div>

        {/* Right: Diurnal Sunlight & Shadow Time Scrubber */}
        <div className="flex items-center space-x-3 rounded-xl border border-luna-750 bg-luna-900/90 px-4 py-2 shadow-xl backdrop-blur-md pointer-events-auto">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsPlayingSolar(!isPlayingSolar)}
              className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
                isPlayingSolar
                  ? 'bg-amber-500 text-black shadow-[0_0_10px_rgba(245,158,11,0.4)]'
                  : 'bg-luna-800 text-amber-400 hover:bg-luna-750'
              }`}
              title={isPlayingSolar ? 'Pause Solar Orbit' : 'Play 3D Solar Orbit Simulation'}
            >
              {isPlayingSolar ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 fill-current" />}
            </button>
            <div className="flex items-center space-x-1.5">
              <Sun className="h-4 w-4 text-amber-400 animate-spin-slow" />
              <span className="text-[11px] font-mono text-slate-300 whitespace-nowrap">
                SOLAR AZ: <strong className="text-amber-400">{((solarHourOffset * 0.508) % 360).toFixed(0)}°</strong>
              </span>
            </div>
          </div>

          <input
            type="range"
            min="0"
            max="708"
            step="2"
            value={solarHourOffset}
            onChange={(e) => setSolarHourOffset(parseFloat(e.target.value))}
            className="w-28 sm:w-44 accent-amber-400 cursor-pointer"
            title="Scrub Mission Timeline to rotate Sun & cast grazing shadows"
          />

          <span className="text-[10px] font-mono text-slate-400 hidden md:inline">
            T+{(solarHourOffset / 24).toFixed(1)}d
          </span>
        </div>
      </div>

      {/* 4. HOVERED SITE TOOLTIP CARD */}
      {hoveredSite && (
        <div
          style={{ left: mousePos.x + 15, top: mousePos.y - 15 }}
          className="absolute z-30 pointer-events-none rounded-xl border border-cyan-500/40 bg-luna-900/95 p-3 text-xs text-white shadow-2xl backdrop-blur-md min-w-[200px]"
        >
          <div className="flex items-center justify-between border-b border-luna-800 pb-1.5 mb-1.5">
            <strong className="text-cyan-300">{hoveredSite.name}</strong>
            <span className="rounded bg-cyan-500/20 px-1.5 py-0.2 text-[10px] font-mono text-cyan-200">
              {hoveredSite.region}
            </span>
          </div>
          <div className="space-y-1 text-[11px] text-slate-300">
            <div className="flex justify-between">
              <span className="text-slate-400">Coordinates:</span>
              <span className="font-mono">{formatLatitude(hoveredSite.latitude)}, {formatLongitude(hoveredSite.longitude)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Elevation:</span>
              <strong className="text-amber-400 font-mono">+{hoveredSite.elevation_m} m</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Slope:</span>
              <span className="font-mono">{hoveredSite.slope_degrees}°</span>
            </div>
          </div>
          <div className="mt-2 pt-1 border-t border-luna-800 text-[10px] text-cyan-400 flex items-center justify-center space-x-1">
            <MapPin className="h-3 w-3" />
            <span>Click to Select & Center Landing Zone</span>
          </div>
        </div>
      )}

      {/* 5. SCIENTIFIC ELEVATION COLORMAP LEGEND (LOLA mode) */}
      {shadingStyle === 'lola' && viewMode === 'south_pole_dem' && (
        <div className="absolute top-20 right-4 z-20 rounded-xl border border-luna-750 bg-luna-900/90 p-3 shadow-xl backdrop-blur-md text-[10px] text-slate-300 space-y-1.5 pointer-events-none">
          <strong className="text-slate-200 block text-xs border-b border-luna-800 pb-1">LOLA Elevation Datum</strong>
          <div className="flex items-center space-x-2">
            <span className="h-3 w-4 rounded" style={{ backgroundColor: '#ffffff' }} />
            <span>&gt; +4500 m (Massif Peak)</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="h-3 w-4 rounded" style={{ backgroundColor: '#ef4444' }} />
            <span>+3000 to +4500 m</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="h-3 w-4 rounded" style={{ backgroundColor: '#f97316' }} />
            <span>+1500 to +3000 m</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="h-3 w-4 rounded" style={{ backgroundColor: '#eab308' }} />
            <span>+500 to +1500 m (Rim Crest)</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="h-3 w-4 rounded" style={{ backgroundColor: '#22c55e' }} />
            <span>0 to +500 m (Highlands)</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="h-3 w-4 rounded" style={{ backgroundColor: '#00a2ff' }} />
            <span>-1500 to 0 m</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="h-3 w-4 rounded" style={{ backgroundColor: '#0a184a' }} />
            <span>&lt; -1500 m (Deep PSR Floor)</span>
          </div>
        </div>
      )}

      {/* 6. SLOPE HAZARD COLORMAP LEGEND (Slope mode) */}
      {shadingStyle === 'slope' && viewMode === 'south_pole_dem' && (
        <div className="absolute top-20 right-4 z-20 rounded-xl border border-luna-750 bg-luna-900/90 p-3 shadow-xl backdrop-blur-md text-[10px] text-slate-300 space-y-1.5 pointer-events-none">
          <strong className="text-slate-200 block text-xs border-b border-luna-800 pb-1">Touchdown Slope Safety</strong>
          <div className="flex items-center space-x-2">
            <span className="h-3 w-4 rounded bg-emerald-500" />
            <span>&lt; 5.0° (Safe Landing Zone)</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="h-3 w-4 rounded bg-amber-500" />
            <span>5.0° - 12.0° (Cautionary Slope)</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="h-3 w-4 rounded bg-rose-500" />
            <span>&gt; 12.0° (Hazard / Tip Risk)</span>
          </div>
        </div>
      )}
    </div>
  );
}
