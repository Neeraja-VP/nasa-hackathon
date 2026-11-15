import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  buildSouthPoleTerrainGeometry,
  createEarthTexture,
  latLonToTerrainCoordsKm,
  getLolaElevationAtPoint,
} from '../../utils/lunarTerrain3D';

export default function SynchronizedSky3D({
  currentSite,
  sunAzimuthDeg = 0,
  sunElevationDeg = 1.5,
  sunIsVisible = true,
  earthAzimuthDeg = 0,
  earthElevationDeg = 4.5,
  earthIsVisible = true,
  observerHeightM = 2.0,
}) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const cameraRef = useRef(null);

  // Dynamic celestial objects
  const sunLightRef = useRef(null);
  const sunMeshRef = useRef(null);
  const sunBeamRef = useRef(null);
  const earthMeshRef = useRef(null);
  const earthBeamRef = useRef(null);
  const landerGroupRef = useRef(null);
  const animFrameRef = useRef(null);

  // Site coordinates on terrain mesh
  const lat = currentSite?.latitude ?? -89.78;
  const lon = currentSite?.longitude ?? 125.0;
  const siteCoords = latLonToTerrainCoordsKm(lat, lon);
  const siteElevM = currentSite?.elevation_m ?? getLolaElevationAtPoint(siteCoords.xKm, siteCoords.zKm);
  const yWorldLander = siteElevM * (2.0 / 1000.0); // 2.0x vert exaggeration

  // Initialize Scene
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth || 600;
    const height = mount.clientHeight || 450;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color('#030712'); // Deep space black

    // Starfield particles
    const starCount = 1200;
    const starGeo = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      starPositions[i] = (Math.random() - 0.5) * 2000;
      starPositions[i + 1] = Math.random() * 800 + 10;
      starPositions[i + 2] = (Math.random() - 0.5) * 2000;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({ color: '#E2E8F0', size: 1.5, transparent: true, opacity: 0.8 });
    const starField = new THREE.Points(starGeo, starMat);
    scene.add(starField);

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 3000);
    cameraRef.current = camera;
    camera.position.set(siteCoords.xKm + 25, yWorldLander + 18, siteCoords.zKm + 35);

    // WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;
    mount.appendChild(renderer.domElement);

    // OrbitControls focused on the lander
    const controls = new OrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(siteCoords.xKm, yWorldLander + 2.0, siteCoords.zKm);
    controls.minDistance = 6;
    controls.maxDistance = 250;
    controls.maxPolarAngle = Math.PI / 2 + 0.05; // allow looking slightly below horizon

    // Ambient Starlight & Earthshine
    const ambientLight = new THREE.AmbientLight('#1E293B', 0.4);
    scene.add(ambientLight);

    // 1. Lunar South Pole Terrain Mesh
    const terrainGeo = buildSouthPoleTerrainGeometry(120, 240.0, 2.0);
    const terrainMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.95,
      metalness: 0.05,
      flatShading: false,
    });
    const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    terrainMesh.receiveShadow = true;
    scene.add(terrainMesh);

    // 2. Lander Model at Site Coordinates
    const landerGroup = new THREE.Group();
    landerGroupRef.current = landerGroup;
    landerGroup.position.set(siteCoords.xKm, yWorldLander, siteCoords.zKm);

    // Octagonal lander body (Gold Foil MLI)
    const bodyGeo = new THREE.CylinderGeometry(1.6, 2.0, 1.8, 8);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: '#D97706',
      roughness: 0.35,
      metalness: 0.85,
    });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.y = 1.3;
    bodyMesh.castShadow = true;
    landerGroup.add(bodyMesh);

    // 4 Landing Gear Legs
    const legMat = new THREE.MeshStandardMaterial({ color: '#64748B', metalness: 0.8, roughness: 0.3 });
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2 + Math.PI / 4;
      const legGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.2);
      const legMesh = new THREE.Mesh(legGeo, legMat);
      legMesh.position.set(Math.cos(angle) * 1.8, 0.7, Math.sin(angle) * 1.8);
      legMesh.rotation.z = Math.cos(angle) * 0.45;
      legMesh.rotation.x = -Math.sin(angle) * 0.45;
      legMesh.castShadow = true;
      landerGroup.add(legMesh);

      // Footpad
      const padGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.06, 8);
      const padMesh = new THREE.Mesh(padGeo, legMat);
      padMesh.position.set(Math.cos(angle) * 2.3, 0.03, Math.sin(angle) * 2.3);
      landerGroup.add(padMesh);
    }

    // Solar Mast Phase Center
    const mastHeight3D = Math.max(1.5, (observerHeightM || 2.0) * 0.6);
    const mastGeo = new THREE.CylinderGeometry(0.06, 0.06, mastHeight3D);
    const mastMat = new THREE.MeshStandardMaterial({ color: '#06B6D4', metalness: 0.9, roughness: 0.2 });
    const mastMesh = new THREE.Mesh(mastGeo, mastMat);
    mastMesh.position.y = 2.2 + mastHeight3D / 2;
    landerGroup.add(mastMesh);

    // High Gain Antenna Dish
    const dishGeo = new THREE.SphereGeometry(0.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2.5);
    const dishMat = new THREE.MeshStandardMaterial({ color: '#E2E8F0', metalness: 0.9, roughness: 0.2, side: THREE.DoubleSide });
    const dishMesh = new THREE.Mesh(dishGeo, dishMat);
    dishMesh.position.set(0, 2.2 + mastHeight3D, 0);
    dishMesh.rotation.x = Math.PI;
    landerGroup.add(dishMesh);

    // 360° Compass & Geometric Horizon Ring on Lunar Surface
    const compassRadius = 14.0;
    const ringGeo = new THREE.RingGeometry(compassRadius - 0.2, compassRadius, 64);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: '#06B6D4', side: THREE.DoubleSide, transparent: true, opacity: 0.5 });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.y = 0.15;
    landerGroup.add(ringMesh);

    // Cardinal Axes
    const createCompassArm = (azRad, colorHex, length = 14.0) => {
      const armGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0.15, 0),
        new THREE.Vector3(Math.sin(azRad) * length, 0.15, -Math.cos(azRad) * length)
      ]);
      const armMat = new THREE.LineBasicMaterial({ color: colorHex, linewidth: 2 });
      return new THREE.Line(armGeo, armMat);
    };

    landerGroup.add(createCompassArm(0, '#EF4444', 16.0)); // North = Red (longer)
    landerGroup.add(createCompassArm(Math.PI / 2, '#10B981', 14.0)); // East = Green
    landerGroup.add(createCompassArm(Math.PI, '#64748B', 14.0)); // South = Slate
    landerGroup.add(createCompassArm((3 * Math.PI) / 2, '#64748B', 14.0)); // West = Slate

    scene.add(landerGroup);

    // 3. Sun Directional Light & Visual Orb
    const sunLight = new THREE.DirectionalLight('#FFFBEB', 2.8);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 1.0;
    sunLight.shadow.camera.far = 400;
    const shadowDist = 80;
    sunLight.shadow.camera.left = -shadowDist;
    sunLight.shadow.camera.right = shadowDist;
    sunLight.shadow.camera.top = shadowDist;
    sunLight.shadow.camera.bottom = -shadowDist;
    sunLight.shadow.bias = -0.0005;
    sunLight.target = landerGroup;
    sunLightRef.current = sunLight;
    scene.add(sunLight);

    const sunGeo = new THREE.SphereGeometry(3.5, 24, 24);
    const sunMat = new THREE.MeshBasicMaterial({ color: '#FDE047' });
    const sunMesh = new THREE.Mesh(sunGeo, sunMat);
    sunMeshRef.current = sunMesh;
    scene.add(sunMesh);

    // Solar Sightline Beam (Dotted yellow line from lander to Sun)
    const sunBeamGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 50, 0)
    ]);
    const sunBeamMat = new THREE.LineDashedMaterial({ color: '#FBBF24', dashSize: 2, gapSize: 1.5, transparent: true, opacity: 0.6 });
    const sunBeam = new THREE.Line(sunBeamGeo, sunBeamMat);
    sunBeam.computeLineDistances();
    sunBeamRef.current = sunBeam;
    scene.add(sunBeam);

    // 4. Earth Sphere & Sightline Beam
    const earthGeo = new THREE.SphereGeometry(4.0, 32, 32);
    const earthTexture = createEarthTexture(512, 256);
    const earthMat = new THREE.MeshStandardMaterial({
      map: earthTexture,
      roughness: 0.4,
      metalness: 0.1,
      emissive: '#0369A1',
      emissiveIntensity: 0.35,
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    earthMeshRef.current = earthMesh;
    scene.add(earthMesh);

    // Earth Sightline Beam
    const earthBeamGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 60, 0)
    ]);
    const earthBeamMat = new THREE.LineBasicMaterial({ color: '#06B6D4', transparent: true, opacity: 0.7 });
    const earthBeam = new THREE.Line(earthBeamGeo, earthBeamMat);
    earthBeamRef.current = earthBeam;
    scene.add(earthBeam);

    // Animation Render Loop
    function animate() {
      animFrameRef.current = requestAnimationFrame(animate);
      controls.update();

      // Earth slow rotation
      if (earthMeshRef.current) {
        earthMeshRef.current.rotation.y += 0.004;
      }

      renderer.render(scene, camera);
    }
    animate();

    // Handle Window Resize
    const handleResize = () => {
      if (!mount) return;
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (renderer.domElement && mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
      renderer.dispose();
      terrainGeo.dispose();
      terrainMat.dispose();
      starGeo.dispose();
      starMat.dispose();
      bodyGeo.dispose();
      bodyMat.dispose();
      earthGeo.dispose();
      earthMat.dispose();
      sunGeo.dispose();
      sunMat.dispose();
    };
  }, [siteCoords.xKm, siteCoords.zKm, yWorldLander, observerHeightM]);

  // Update Sun & Earth 3D Vectors Dynamically with Time Slider
  useEffect(() => {
    const rSun = 150.0;
    const rEarth = 160.0;

    const sunElRad = (sunElevationDeg * Math.PI) / 180.0;
    const sunAzRad = (sunAzimuthDeg * Math.PI) / 180.0;

    // Vector in topocentric frame:
    // +X = East = sin(az) * cos(el)
    // +Y = Up = sin(el)
    // -Z = North = -cos(az) * cos(el)
    const sunX = siteCoords.xKm + rSun * Math.cos(sunElRad) * Math.sin(sunAzRad);
    const sunY = yWorldLander + rSun * Math.sin(sunElRad);
    const sunZ = siteCoords.zKm - rSun * Math.cos(sunElRad) * Math.cos(sunAzRad);

    if (sunLightRef.current) {
      sunLightRef.current.position.set(sunX, Math.max(yWorldLander + 2.0, sunY), sunZ);
      sunLightRef.current.intensity = sunIsVisible && sunElevationDeg > -0.2 ? 2.8 : 0.08;
    }

    if (sunMeshRef.current) {
      sunMeshRef.current.position.set(sunX, sunY, sunZ);
      sunMeshRef.current.material.color.set(sunIsVisible ? '#FDE047' : '#9A3412');
    }

    if (sunBeamRef.current) {
      const positions = sunBeamRef.current.geometry.attributes.position.array;
      positions[0] = siteCoords.xKm;
      positions[1] = yWorldLander + 2.2;
      positions[2] = siteCoords.zKm;
      positions[3] = sunX;
      positions[4] = sunY;
      positions[5] = sunZ;
      sunBeamRef.current.geometry.attributes.position.needsUpdate = true;
      sunBeamRef.current.computeLineDistances();
      sunBeamRef.current.material.color.set(sunIsVisible ? '#FBBF24' : '#EF4444');
    }

    // Earth Vector
    const earthElRad = (earthElevationDeg * Math.PI) / 180.0;
    const earthAzRad = (earthAzimuthDeg * Math.PI) / 180.0;

    const earthX = siteCoords.xKm + rEarth * Math.cos(earthElRad) * Math.sin(earthAzRad);
    const earthY = yWorldLander + rEarth * Math.sin(earthElRad);
    const earthZ = siteCoords.zKm - rEarth * Math.cos(earthElRad) * Math.cos(earthAzRad);

    if (earthMeshRef.current) {
      earthMeshRef.current.position.set(earthX, earthY, earthZ);
      earthMeshRef.current.material.emissiveIntensity = earthIsVisible ? 0.45 : 0.08;
    }

    if (earthBeamRef.current) {
      const positions = earthBeamRef.current.geometry.attributes.position.array;
      positions[0] = siteCoords.xKm;
      positions[1] = yWorldLander + 2.5;
      positions[2] = siteCoords.zKm;
      positions[3] = earthX;
      positions[4] = earthY;
      positions[5] = earthZ;
      earthBeamRef.current.geometry.attributes.position.needsUpdate = true;
      earthBeamRef.current.material.color.set(earthIsVisible ? '#06B6D4' : '#EF4444');
    }
  }, [
    sunAzimuthDeg,
    sunElevationDeg,
    sunIsVisible,
    earthAzimuthDeg,
    earthElevationDeg,
    earthIsVisible,
    siteCoords.xKm,
    siteCoords.zKm,
    yWorldLander,
  ]);

  return (
    <div className="relative h-full w-full rounded-2xl overflow-hidden border border-luna-800 bg-luna-950">
      <div ref={mountRef} className="h-full w-full cursor-grab active:cursor-grabbing" />

      {/* Synchronized 3D Overlay Telemetry HUD */}
      <div className="absolute top-3 left-3 flex flex-col space-y-1.5 pointer-events-none text-xs font-mono">
        <div className="rounded-lg bg-luna-950/85 border border-luna-800 px-3 py-1.5 backdrop-blur-md shadow-md">
          <span className="text-cyan-400 font-bold">SYNCHRONIZED TOPOCENTRIC 3D SCENE</span>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Lander: ({lat.toFixed(2)}°, {lon.toFixed(2)}°) • Elevation: {siteElevM.toFixed(0)}m
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <div className={`rounded-lg px-2.5 py-1 text-[11px] border backdrop-blur-md flex items-center space-x-1.5 ${
            sunIsVisible
              ? 'bg-amber-950/70 border-amber-500/50 text-amber-300'
              : 'bg-rose-950/70 border-rose-500/50 text-rose-300'
          }`}>
            <span className={`h-2 w-2 rounded-full ${sunIsVisible ? 'bg-amber-400 animate-pulse' : 'bg-rose-500'}`} />
            <span>Sun: {sunAzimuthDeg.toFixed(1)}° / {sunElevationDeg.toFixed(2)}° ({sunIsVisible ? 'Sunlit' : 'Shadowed'})</span>
          </div>

          <div className={`rounded-lg px-2.5 py-1 text-[11px] border backdrop-blur-md flex items-center space-x-1.5 ${
            earthIsVisible
              ? 'bg-cyan-950/70 border-cyan-500/50 text-cyan-300'
              : 'bg-rose-950/70 border-rose-500/50 text-rose-300'
          }`}>
            <span className={`h-2 w-2 rounded-full ${earthIsVisible ? 'bg-cyan-400 animate-pulse' : 'bg-rose-500'}`} />
            <span>Earth: {earthAzimuthDeg.toFixed(1)}° / {earthElevationDeg.toFixed(2)}° ({earthIsVisible ? 'LOS' : 'Blocked'})</span>
          </div>
        </div>
      </div>

      {/* 3D Navigation Controls Hint */}
      <div className="absolute bottom-3 right-3 rounded-lg bg-luna-950/80 border border-luna-800/80 px-2.5 py-1 text-[10px] font-mono text-slate-400 pointer-events-none backdrop-blur-sm">
        Left Click: Orbit • Right Click: Pan • Scroll: Zoom
      </div>
    </div>
  );
}
