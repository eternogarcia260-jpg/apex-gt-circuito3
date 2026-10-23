import * as THREE from 'three';

/** Generic roof LOD, not surveyed equipment from real Singapore buildings. */
export function createC3CityRoofDetails(buildings: THREE.InstancedMesh, roofMaterial: THREE.Material, casingMaterial: THREE.Material): THREE.Group {
  const root = new THREE.Group();
  root.name = 'C3_CityRoofDetails';
  // Reuse the existing closed unit cube. Single materials render all its faces,
  // irrespective of the facade/roof groups used by the original building batch.
  const trim = new THREE.InstancedMesh(buildings.geometry, roofMaterial, buildings.count * 6);
  const plant = new THREE.InstancedMesh(buildings.geometry, casingMaterial, buildings.count);
  trim.name = 'C3_CityRoofParapetsAndCaps';
  plant.name = 'C3_CityRoofPlant';
  const pose = new THREE.Matrix4(), local = new THREE.Matrix4(), scale = new THREE.Matrix4();
  const dimensions = new THREE.Vector3();
  const inset = 0.08, thickness = 0.32, height = 0.8;
  for (let i = 0; i < buildings.count; i++) {
    buildings.getMatrixAt(i, pose);
    dimensions.setFromMatrixScale(pose);
    const w = dimensions.x, h = dimensions.y, d = dimensions.z;
    // Physical metre dimensions in each building's actual upright/yaw frame.
    const put = (mesh: THREE.InstancedMesh, index: number, x: number, bottom: number, z: number, sx: number, sy: number, sz: number) => {
      local.makeTranslation(x / w, 0.5 + (bottom + sy / 2) / h, z / d);
      scale.makeScale(sx / w, sy / h, sz / d);
      local.multiply(scale).premultiply(pose);
      mesh.setMatrixAt(index, local);
    };
    const x = w / 2 - inset - thickness / 2;
    const z = d / 2 - inset - thickness / 2;
    // The shorter pair fits BETWEEN the long pair, avoiding coplanar corner overlaps.
    put(trim, i * 6, -x, 0, 0, thickness, height, d - 2 * inset);
    put(trim, i * 6 + 1, x, 0, 0, thickness, height, d - 2 * inset);
    put(trim, i * 6 + 2, 0, 0, -z, w - 2 * inset - 2 * thickness, height, thickness);
    put(trim, i * 6 + 3, 0, 0, z, w - 2 * inset - 2 * thickness, height, thickness);
    put(trim, i * 6 + 4, 0, 0, 0, 6.4, 0.18, 4.2);
    put(plant, i, 0, 0.18, 0, 5.8, 1.5, 3.6);
    put(trim, i * 6 + 5, 0, 1.68, 0, 6, 0.12, 3.8);
  }
  for (const mesh of [trim, plant]) {
    mesh.userData.c3NoShadow = true;
    mesh.receiveShadow = true;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingBox(); mesh.computeBoundingSphere();
    root.add(mesh);
  }
  return root;
}
