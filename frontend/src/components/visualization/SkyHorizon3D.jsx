import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createEarthTexture } from '../../utils/lunarTerrain3D';

/**
 * SkyHorizon3D — Synchronized 3D Topocentric Sky-Horizon View
 * Displays lunar lander on local topography, with animated Sun and Earth
 * direction vectors and illumination beams in the observer's local reference frame.
 */
export default function SkyHorizon3D({
  currentSite,
  currentPoint,
  terrainHorizonData,
  className = '',
}) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);

  // Dynamic 3D Object references
  const sunGroupRef = useRef(null);
  const earthGroupRef = useRef(null);
  const sunLightRef = useRef(null);
  const commBeamRef = useRef(null);
  const sunBeamRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth || 600;
    const height = mount.clientHeight || 400;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color('#030712'); // Deep lunar space black

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(28, 16, 28);
    cameraRef.current = camera;

    // 3. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;
    mount.appendChild(renderer.domElement);

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 + 0.1; // Don't orbit too far below lunar ground
    controls.minDistance = 8;
    controls.maxDistance = 120;
    controls.target.set(0, 2, 0);
    controlsRef.current = controls;

    // 5. Ambient Light (faint Earthshine & starlight)
    const ambientLight = new THREE.AmbientLight(0x1e293b, 0.6);
    scene.add(ambientLight);

    // 6. Local Lunar Terrain Mesh (Circular landing zone with variable elevation rim)
    const terrainRadius = 24.0;
    const terrainSegments = 64;
    const terrainGeo = new THREE.RingGeometry(0.1, terrainRadius, terrainSegments, 16);
    terrainGeo.rotateX(-Math.PI / 2);

    // Deform terrain vertices to match LOLA elevation profile around perimeter
    const posAttr = terrainGeo.attributes.position;
    const count = posAttr.count;

    const horizonPts = terrainHorizonData?.horizon_points || [];
    const getHorizonElAtAz = (azDeg) => {
      if (!horizonPts.length) return 1.0;
      const idx = Math.floor((azDeg % 360) / (360 / horizonPts.length));
      return horizonPts[idx]?.horizon_elevation_deg || 1.0;
    };

    for (let i = 0; i < count; i++) {
      const x = posAttr.getX(i);
      const z = posAttr.getZ(i);
      const dist = Math.hypot(x, z);
      const azRad = Math.atan2(x, -z);
      const azDeg = (azRad * 180 / Math.PI + 360) % 360;

      // Outer rim elevates based on local LOLA horizon relief
      const normDist = dist / terrainRadius;
      if (normDist > 0.3) {
        const reliefDeg = getHorizonElAtAz(azDeg);
        const reliefHeight = (reliefDeg / 10.0) * 3.5 * Math.pow(normDist, 1.8);
        posAttr.setY(i, reliefHeight);
      } else {
        posAttr.setY(i, 0.0);
      }
    }
    terrainGeo.computeVertexNormals();

    const terrainMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.9,
      metalness: 0.1,
      wireframe: false,
      flatShading: true,
    });
    const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    terrainMesh.receiveShadow = true;
    scene.add(terrainMesh);

    // Ground grid and geometric horizon reference ring
    const grid = new THREE.PolarGridHelper(terrainRadius, 4, 8, 64, 0x06b6d4, 0x1e293b);
    grid.position.y = 0.02;
    scene.add(grid);

    // Cardinal Azimuth Label Rings
    const createDirectionMarker = (text, x, z, color = 0x94a3b8) => {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(64, 64, 56, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.font = 'bold 54px monospace';
      ctx.fillStyle = '#38bdf8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 64, 64);

      const texture = new THREE.CanvasTexture(canvas);
      const spriteMat = new THREE.SpriteMaterial({ map: texture });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.position.set(x, 1.5, z);
      sprite.scale.set(3, 3, 1);
      scene.add(sprite);
    };

    createDirectionMarker('N', 0, -terrainRadius - 2);
    createDirectionMarker('E', terrainRadius + 2, 0);
    createDirectionMarker('S', 0, terrainRadius + 2);
    createDirectionMarker('W', -terrainRadius - 2, 0);

    // 7. Lander Model at Center (0, 0, 0)
    const landerGroup = new THREE.Group();
    // Descent stage octagonal base
    const baseGeo = new THREE.CylinderGeometry(1.4, 1.8, 1.0, 8);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.8, roughness: 0.3 }); // Gold foil
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.y = 0.5;
    baseMesh.castShadow = true;
    landerGroup.add(baseMesh);

    // Ascent cabin
    const cabinGeo = new THREE.CylinderGeometry(1.0, 1.2, 1.2, 8);
    const cabinMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.2, roughness: 0.5 });
    const cabinMesh = new THREE.Mesh(cabinGeo, cabinMat);
    cabinMesh.position.y = 1.6;
    cabinMesh.castShadow = true;
    landerGroup.add(cabinMesh);

    // Solar mast
    const mastGeo = new THREE.CylinderGeometry(0.06, 0.06, 3.2, 8);
    const mastMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8 });
    const mastMesh = new THREE.Mesh(mastGeo, mastMat);
    mastMesh.position.set(0.7, 2.6, 0.7);
    landerGroup.add(mastMesh);

    // Solar array panel
    const panelGeo = new THREE.BoxGeometry(0.08, 1.4, 0.8);
    const panelMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, metalness: 0.6, roughness: 0.2 });
    const panelMesh = new THREE.Mesh(panelGeo, panelMat);
    panelMesh.position.set(0.7, 3.8, 0.7);
    landerGroup.add(panelMesh);

    // High Gain Antenna (pointing to Earth)
    const antDishGeo = new THREE.ConeGeometry(0.6, 0.3, 16, 1, true);
    antDishGeo.rotateX(Math.PI);
    const antDishMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.5, roughness: 0.3, side: THREE.DoubleSide });
    const antMesh = new THREE.Mesh(antDishGeo, antDishMat);
    antMesh.position.set(-0.7, 2.8, -0.7);
    landerGroup.add(antMesh);

    // Lander landing legs
    for (let leg = 0; leg < 4; leg++) {
      const legAngle = (leg * Math.PI) / 2 + Math.PI / 4;
      const legGeo = new THREE.CylinderGeometry(0.06, 0.06, 2.2);
      const legMat = new THREE.MeshStandardMaterial({ color: 0x64748b });
      const legMesh = new THREE.Mesh(legGeo, legMat);
      legMesh.position.set(Math.cos(legAngle) * 1.5, 0.4, Math.sin(legAngle) * 1.5);
      legMesh.rotation.z = Math.PI / 4;
      legMesh.rotation.y = -legAngle;
      landerGroup.add(legMesh);
    }
    scene.add(landerGroup);

    // 8. Celestial Body 1: The Sun Group
    const sunGroup = new THREE.Group();
    // Sun glowing sphere
    const sunGeo = new THREE.SphereGeometry(1.6, 32, 32);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
    const sunSphere = new THREE.Mesh(sunGeo, sunMat);
    sunGroup.add(sunSphere);

    // Sun corona glow
    const coronaGeo = new THREE.SphereGeometry(2.4, 16, 16);
    const coronaMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.3 });
    const corona = new THREE.Mesh(coronaGeo, coronaMat);
    sunGroup.add(corona);

    scene.add(sunGroup);
    sunGroupRef.current = sunGroup;

    // Collimated directional sunlight shining on the lander
    const sunLight = new THREE.DirectionalLight(0xfffbeb, 2.2);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    scene.add(sunLight);
    sunLightRef.current = sunLight;

    // Sun guide beam
    const sunBeamGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 3.8, 0),
      new THREE.Vector3(0, 20, 0),
    ]);
    const sunBeamMat = new THREE.LineDashedMaterial({ color: 0xf59e0b, dashSize: 0.8, gapSize: 0.4 });
    const sunBeam = new THREE.Line(sunBeamGeo, sunBeamMat);
    sunBeam.computeLineDistances();
    scene.add(sunBeam);
    sunBeamRef.current = sunBeam;

    // 9. Celestial Body 2: The Earth Group
    const earthGroup = new THREE.Group();
    const earthGeo = new THREE.SphereGeometry(1.5, 32, 32);
    const earthMat = new THREE.MeshStandardMaterial({
      map: createEarthTexture(),
      roughness: 0.6,
      metalness: 0.1,
    });
    const earthSphere = new THREE.Mesh(earthGeo, earthMat);
    earthGroup.add(earthSphere);

    // Atmospheric halo
    const atmosGeo = new THREE.SphereGeometry(1.7, 32, 32);
    const atmosMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.25 });
    earthGroup.add(new THREE.Mesh(atmosGeo, atmosMat));

    scene.add(earthGroup);
    earthGroupRef.current = earthGroup;

    // Direct-to-Earth Communication Link Beam
    const commBeamGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-0.7, 2.8, -0.7),
      new THREE.Vector3(0, 15, 0),
    ]);
    const commBeamMat = new THREE.LineBasicMaterial({ color: 0x06b6d4, linewidth: 2 });
    const commBeam = new THREE.Line(commBeamGeo, commBeamMat);
    scene.add(commBeam);
    commBeamRef.current = commBeam;

    // 10. Animation Loop
    let animId;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // 11. Resize handling
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
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      if (mount && renderer.domElement) {
        mount.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [currentSite?.id, terrainHorizonData]);

  // Update dynamic Sun and Earth 3D positions whenever currentPoint changes
  useEffect(() => {
    if (!currentPoint) return;

    const sunGroup = sunGroupRef.current;
    const earthGroup = earthGroupRef.current;
    const sunLight = sunLightRef.current;
    const sunBeam = sunBeamRef.current;
    const commBeam = commBeamRef.current;

    // Helper: Convert topocentric (Azimuth, Elevation) to 3D Cartesian (x, y, z)
    // 0° North = -Z, 90° East = +X, 180° South = +Z, 270° West = -X
    const toCartesian = (azDeg, elDeg, radius) => {
      const azRad = (azDeg * Math.PI) / 180.0;
      const elRad = (elDeg * Math.PI) / 180.0;
      const rHoriz = radius * Math.cos(elRad);
      const x = rHoriz * Math.sin(azRad);
      const y = radius * Math.sin(elRad);
      const z = -rHoriz * Math.cos(azRad);
      return new THREE.Vector3(x, y, z);
    };

    // 1. Sun Update
    const sunRadius = 45.0;
    const sunPos = toCartesian(currentPoint.sun_azimuth_deg, currentPoint.sun_elevation_deg, sunRadius);

    if (sunGroup) {
      sunGroup.position.copy(sunPos);
      sunGroup.visible = currentPoint.sun_elevation_deg > -8.0; // Show slightly below horizon
    }

    if (sunLight) {
      sunLight.position.copy(sunPos);
      // If sun is terrain occluded or below horizon, turn off direct illumination
      const isSunlit = currentPoint.is_sun_visible ?? (currentPoint.is_sunlit_terrain || currentPoint.is_sunlit);
      sunLight.intensity = isSunlit ? 2.5 : 0.05;
    }

    if (sunBeam) {
      const origin = new THREE.Vector3(0.7, 3.8, 0.7);
      sunBeam.geometry.setFromPoints([origin, sunPos]);
      sunBeam.computeLineDistances();
      sunBeam.visible = currentPoint.sun_elevation_deg > -2.0;
    }

    // 2. Earth Update
    const earthRadius = 40.0;
    const earthPos = toCartesian(currentPoint.earth_azimuth_deg, currentPoint.earth_elevation_deg, earthRadius);

    if (earthGroup) {
      earthGroup.position.copy(earthPos);
      earthGroup.visible = currentPoint.earth_elevation_deg > -8.0;
    }

    if (commBeam) {
      const antOrigin = new THREE.Vector3(-0.7, 2.8, -0.7);
      commBeam.geometry.setFromPoints([antOrigin, earthPos]);
      const isVisible = currentPoint.is_earth_visible;
      commBeam.material.color.set(isVisible ? 0x06b6d4 : 0xef4444); // Cyan if LOS, red if occluded
      commBeam.visible = currentPoint.earth_elevation_deg > -5.0;
    }
  }, [currentPoint]);

  return (
    <div className={`relative h-full w-full overflow-hidden rounded-xl bg-luna-950 ${className}`}>
      <div ref={mountRef} className="h-full w-full cursor-grab active:cursor-grabbing" />
      {/* 3D Viewport Overlay Badges */}
      <div className="pointer-events-none absolute bottom-3 left-3 flex items-center space-x-2 font-mono text-[10px] text-slate-400">
        <span className="rounded bg-black/60 px-2 py-0.5 border border-luna-800 backdrop-blur-sm">
          Orbit: Drag | Zoom: Scroll
        </span>
        <span className="rounded bg-cyan-950/60 px-2 py-0.5 border border-cyan-500/30 text-cyan-300 backdrop-blur-sm">
          Local Topocentric Frame
        </span>
      </div>
    </div>
  );
}
