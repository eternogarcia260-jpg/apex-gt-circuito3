import * as THREE from 'three';
import { SPEEDWAY_WAYPOINTS } from '../src/game/circuits/speedway/SpeedwayWaypoints';
import { SpeedwayTrackBuilder } from '../src/game/circuits/speedway/SpeedwayTrackBuilder';

console.log('Analyzing Circuit 2 visibility and meshes...');

// Let's inspect all meshes created in SpeedwayTrackBuilder
const builder = new SpeedwayTrackBuilder();
const group = (builder as any).group as THREE.Group;

console.log('Total children in circuit group:', group.children.length);

const meshReport: { name: string; type: string; count: number; box: THREE.Box3 }[] = [];
group.traverse((obj) => {
  if (obj instanceof THREE.Mesh) {
    obj.geometry.computeBoundingBox();
    const box = obj.geometry.boundingBox ? obj.geometry.boundingBox.clone().applyMatrix4(obj.matrixWorld) : new THREE.Box3();
    meshReport.push({
      name: obj.name || (obj.material as any)?.name || 'unnamed',
      type: obj.geometry.type,
      count: obj.geometry.attributes.position ? obj.geometry.attributes.position.count : 0,
      box,
    });
  }
});

console.log(`Found ${meshReport.length} meshes in circuit:`);
for (const m of meshReport) {
  if (m.name.includes('Lake') || m.name.includes('Villa') || m.name.includes('Promenade') || m.name.includes('Alpine') || m.name.includes('Outfield') || m.name.includes('Water')) {
    console.log(`- MESH: "${m.name}", vertices: ${m.count}, Y-range: [${m.box.min.y.toFixed(2)}, ${m.box.max.y.toFixed(2)}], X-range: [${m.box.min.x.toFixed(1)}, ${m.box.max.x.toFixed(1)}], Z-range: [${m.box.min.z.toFixed(1)}, ${m.box.max.z.toFixed(1)}]`);
  }
}
