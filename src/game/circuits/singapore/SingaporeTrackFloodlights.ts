import * as THREE from 'three';

export interface C3TrackFloodlightsDiagnostics {
  lightCount: number;
  intensity: number;
  activeStationIndices: number[];
  updates: number;
}

export interface C3TrackFloodlights {
  update(camera: THREE.Camera, quality?: 'low' | 'medium' | 'high'): void;
  setIntensity(value: number): void;
  dispose(): void;
  diagnostics: C3TrackFloodlightsDiagnostics;
}

interface Station {
  x: number;
  z: number;
  normalX: number;
  normalZ: number;
  tangentX: number;
  tangentZ: number;
  pointIndex: number;
}

// Keep the fixture geometry; artificial track illumination is disabled for C3.
const DEFAULT_INTENSITY = 0;
const MAX_DISTANCE = 70;
const LATERAL_OFFSET = 4.2;
const LENS_HEIGHT = 10.2;
// Cross-track overlap avoids a bright distant pool with an underlit camera foreground.
const TARGET_AHEAD = 2;
const TARGET_HEIGHT = 0.2;
const MOVEMENT_THRESHOLD_SQ = 9;

/** Six shadowless track-directed spots following the camera's nearest three light stations. */
export function createC3TrackFloodlights(
  root: THREE.Group,
  points: readonly { x: number; z: number }[],
  halfWidth = 10,
): C3TrackFloodlights {
  const stations: Station[] = [];
  const pointCount = points.length;
  if (pointCount >= 3 && Number.isFinite(halfWidth) && halfWidth > 0) {
    for (let i = 0; i < pointCount; i += 6) {
      const p = points[i];
      const next = points[(i + 1) % pointCount];
      const prev = points[(i - 1 + pointCount) % pointCount];
      if (!p || !next || !prev || !Number.isFinite(p.x) || !Number.isFinite(p.z) ||
          !Number.isFinite(next.x) || !Number.isFinite(next.z) ||
          !Number.isFinite(prev.x) || !Number.isFinite(prev.z)) continue;
      const dx = next.x - prev.x;
      const dz = next.z - prev.z;
      const len = Math.hypot(dx, dz);
      if (!(len > 1e-6) || !Number.isFinite(len)) continue;
      stations.push({
        x: p.x, z: p.z,
        normalX: -dz / len, normalZ: dx / len,
        tangentX: dx / len, tangentZ: dz / len,
        pointIndex: i,
      });
    }
  }

  const diagnostics: C3TrackFloodlightsDiagnostics = {
    lightCount: 0,
    intensity: DEFAULT_INTENSITY,
    activeStationIndices: [],
    updates: 0,
  };
  const lights: THREE.SpotLight[] = [];
  const targets: THREE.Object3D[] = [];
  const stationAssignments = [-1, -1, -1];
  const cameraLocal = new THREE.Vector3();
  const lastSearch = new THREE.Vector3(Number.POSITIVE_INFINITY, 0, Number.POSITIVE_INFINITY);
  const targetLocal = new THREE.Vector3();
  let disposed = false;
  let initialized = false;
  let currentClosest = 0;
  const weights = [1, 1, 1];
  const applyWeights = () => {
    if (!initialized) return;
    const station = stations[currentClosest];
    const advance = (cameraLocal.x-station.x)*station.tangentX + (cameraLocal.z-station.z)*station.tangentZ;
    const neighbor = stations[(currentClosest+(advance>=0?1:stations.length-1))%stations.length];
    const spacing = Math.max(1,Math.hypot(neighbor.x-station.x,neighbor.z-station.z));
    const phase = THREE.MathUtils.clamp(advance/spacing,-0.5,0.5);
    weights[0]=phase>0?1-THREE.MathUtils.smoothstep(phase,0,0.5):1;
    weights[1]=1;
    weights[2]=phase<0?1-THREE.MathUtils.smoothstep(-phase,0,0.5):1;
    for(let slot=0;slot<3;slot++) for(let side=0;side<2;side++) lights[slot*2+side].intensity=diagnostics.intensity*weights[slot];
  };

  for (let i = 0; i < 6; i++) {
    const light = new THREE.SpotLight(0xfff1d9, DEFAULT_INTENSITY, MAX_DISTANCE, Math.PI * 0.30, 0.52, 2);
    light.name = `C3_CinematicFloodlight_${i}`;
    light.castShadow = false;
    light.visible = DEFAULT_INTENSITY > 0;
    light.position.set(0, LENS_HEIGHT, 0);
    const target = new THREE.Object3D();
    target.name = `C3_CinematicFloodlightTarget_${i}`;
    target.position.set(0, TARGET_HEIGHT, 0);
    light.target = target;
    root.add(light, target);
    lights.push(light);
    targets.push(target);
  }
  diagnostics.lightCount = lights.length;
  root.userData.c3TrackLighting = diagnostics;

  const update = (camera: THREE.Camera, _quality: 'low' | 'medium' | 'high' = 'high'): void => {
    if (disposed || diagnostics.intensity <= 0 || stations.length === 0) return;
    diagnostics.updates++;
    camera.getWorldPosition(cameraLocal);
    root.worldToLocal(cameraLocal);
    if (!Number.isFinite(cameraLocal.x) || !Number.isFinite(cameraLocal.z)) return;
    const movedX = cameraLocal.x - lastSearch.x;
    const movedZ = cameraLocal.z - lastSearch.z;
    if (initialized && movedX * movedX + movedZ * movedZ <= MOVEMENT_THRESHOLD_SQ) { applyWeights(); return; }
    lastSearch.set(cameraLocal.x, 0, cameraLocal.z);

    let closest = 0;
    let bestDistanceSq = Number.POSITIVE_INFINITY;
    for (let i = 0; i < stations.length; i++) {
      const station = stations[i];
      const dx = station.x - cameraLocal.x;
      const dz = station.z - cameraLocal.z;
      const distanceSq = dx * dx + dz * dz;
      if (distanceSq < bestDistanceSq) {
        bestDistanceSq = distanceSq;
        closest = i;
      }
    }
    const count = stations.length;
    const selected = [(closest - 1 + count) % count, closest, (closest + 1) % count];
    for (let slot = 0; slot < 3; slot++) {
      const stationIndex = selected[slot];
      stationAssignments[slot] = stationIndex;
      const station = stations[stationIndex];
      for (let sideSlot = 0; sideSlot < 2; sideSlot++) {
        const side = sideSlot === 0 ? -1 : 1;
        const light = lights[slot * 2 + sideSlot];
        const target = targets[slot * 2 + sideSlot];
        const offset = halfWidth + LATERAL_OFFSET;
        const x = station.x + station.normalX * offset * side;
        const z = station.z + station.normalZ * offset * side;
        light.position.set(x, LENS_HEIGHT, z);
        targetLocal.set(station.x + station.tangentX * TARGET_AHEAD, TARGET_HEIGHT,
          station.z + station.tangentZ * TARGET_AHEAD);
        target.position.copy(targetLocal);
        light.updateMatrixWorld(true); target.updateMatrixWorld(true);
      }
    }
    diagnostics.activeStationIndices = [
      stations[selected[0]].pointIndex,
      stations[selected[1]].pointIndex,
      stations[selected[2]].pointIndex,
    ];
    currentClosest = closest;
    initialized = true;
    applyWeights();
  };

  return {
    update,
    setIntensity(value: number): void {
      if (!Number.isFinite(value) || value < 0) return;
      diagnostics.intensity = value;
      for (const light of lights) {
        light.intensity = value;
        light.visible = value > 0;
      }
      if (initialized) applyWeights();
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      for (let i = 0; i < lights.length; i++) {
        lights[i].removeFromParent();
        targets[i].removeFromParent();
        lights[i].dispose?.();
      }
      if (root.userData.c3TrackLighting === diagnostics) delete root.userData.c3TrackLighting;
      diagnostics.lightCount = 0;
      diagnostics.activeStationIndices = [];
    },
    diagnostics,
  };
}
