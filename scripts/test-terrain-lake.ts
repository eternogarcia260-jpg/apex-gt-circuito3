import * as THREE from 'three';
import { SPEEDWAY_WAYPOINTS } from '../src/game/circuits/speedway/SpeedwayWaypoints';
import { OrganicTerrainBuilder } from '../src/game/world/OrganicTerrainBuilder';

function getMinDistanceToTrack(x: number, z: number): number {
  let minDistSq = Infinity;
  for (let i = 0; i < SPEEDWAY_WAYPOINTS.length; i++) {
    const p1 = SPEEDWAY_WAYPOINTS[i];
    const p2 = SPEEDWAY_WAYPOINTS[(i + 1) % SPEEDWAY_WAYPOINTS.length];
    const dx = p2.x - p1.x;
    const dz = p2.z - p1.z;
    const lenSq = dx * dx + dz * dz;
    let t = 0;
    if (lenSq > 0.0001) {
      t = Math.max(0, Math.min(1, ((x - p1.x) * dx + (z - p1.z) * dz) / lenSq));
    }
    const projX = p1.x + t * dx;
    const projZ = p1.z + t * dz;
    const dSq = (x - projX) * (x - projX) + (z - projZ) * (z - projZ);
    if (dSq < minDistSq) minDistSq = dSq;
  }
  return Math.sqrt(minDistSq);
}

const grassMat = new THREE.MeshBasicMaterial();
const terrain = OrganicTerrainBuilder.buildSculptedTerrain(
  1400,
  950,
  96,
  72,
  grassMat,
  (x, z) => getMinDistanceToTrack(x, z),
  { x: 0, z: 50 },
  32.0,
  {
    centerX: 505,
    centerZ: 95,
    radiusX: 52,
    radiusZ: 68,
    depth: 2.2,
  }
);

// Check heights around lake center (505, 95)
const pos = terrain.geometry.attributes.position;
console.log('Terrain vertex count:', pos.count);

// Sample points
const samplePoints = [
  { name: 'Lake Center', x: 505, z: 95 },
  { name: 'Lake West Shore (Marina)', x: 465, z: 95 },
  { name: 'Track near Curvone', x: 440, z: 95 },
  { name: 'Lake East Shore', x: 555, z: 95 },
  { name: 'Lake North Shore', x: 505, z: 25 },
  { name: 'Lake South Shore', x: 505, z: 160 },
  { name: 'Villa 1 (Curvone hill)', x: 480, z: 18 },
  { name: 'Villa 2 (Hairpin hill)', x: 15, z: 285 },
];

for (const sp of samplePoints) {
  // Find closest vertex in terrain
  let closestDist = Infinity;
  let closestY = 0;
  let actualWorldX = 0;
  let actualWorldZ = 0;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i) + terrain.position.x;
    const vz = pos.getZ(i) + terrain.position.z;
    const d = Math.hypot(vx - sp.x, vz - sp.z);
    if (d < closestDist) {
      closestDist = d;
      closestY = pos.getY(i) + terrain.position.y;
      actualWorldX = vx;
      actualWorldZ = vz;
    }
  }
  console.log(`${sp.name} (${sp.x}, ${sp.z}): closest vertex at (${actualWorldX.toFixed(1)}, ${actualWorldZ.toFixed(1)}), height = ${closestY.toFixed(2)}m (dist: ${closestDist.toFixed(1)}m)`);
}
