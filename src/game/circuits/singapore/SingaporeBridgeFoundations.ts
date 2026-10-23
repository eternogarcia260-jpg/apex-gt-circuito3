import * as THREE from 'three';

/** Scenic, ground-embedded bearings. Not a surveyed bridge foundation model. */
export function createC3BridgeFoundations(steel: THREE.MeshStandardMaterial): THREE.Group {
  const root = new THREE.Group();
  root.name = 'C3_AndersonFoundations';
  const stone = new THREE.MeshStandardMaterial({ name: 'C3_AndersonStone', color: 0x737c83, roughness: 0.94, metalness: 0 });
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const add = (name: string, material: THREE.Material, parts: number[][]) => {
    const mesh = new THREE.InstancedMesh(unit, material, parts.length);
    mesh.name = name;
    const matrix = new THREE.Matrix4(), quaternion = new THREE.Quaternion();
    parts.forEach(([x, y, z, w, h, d], i) => {
      matrix.compose(new THREE.Vector3(x, y, z), quaternion, new THREE.Vector3(w, h, d));
      mesh.setMatrixAt(i, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingBox(); mesh.computeBoundingSphere();
    mesh.receiveShadow = true;
    root.add(mesh);
  };
  // City ground is y=-0.08. Embed the base to -0.11 and overlap the rail's
  // underside at 0.325; no unsupported gap or coplanar surface remains.
  add('C3_AndersonStoneSills', stone, [-1, 1].map(s => [s * 11, 0.12, 0, 0.6, 0.46, 64]));
  const plinths: number[][] = [], caps: number[][] = [], bearings: number[][] = [];
  for (const side of [-1, 1]) for (const end of [-1, 1]) {
    // The outward offset preserves the curved host road's safety envelope.
    plinths.push([side * 11.3, 0.16, end * 32, 1, 0.56, 1]);
    caps.push([side * 11.3, 0.46, end * 32, 1.06, 0.12, 1.06]);
    bearings.push([side * 11, 0.54, end * 32, 0.4, 0.18, 0.5]);
  }
  add('C3_AndersonEndPlinths', stone, plinths);
  add('C3_AndersonPlinthCaps', stone, caps);
  add('C3_AndersonBearingShoes', steel, bearings);
  root.userData.c3GroundY = -0.08;
  return root;
}
