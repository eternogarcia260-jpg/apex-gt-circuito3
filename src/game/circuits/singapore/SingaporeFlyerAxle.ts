import * as THREE from 'three';

/** Scenic axle: overlap inside bearing housings is intentional, not a physics joint. */
export function createC3FlyerAxle(legs: readonly THREE.Mesh[], hubHeight: number): { supports: THREE.Group; rotor: THREE.Group } {
  const supports = new THREE.Group(); supports.name = 'C3_FlyerAxleSupports';
  const rotor = new THREE.Group(); rotor.name = 'C3_FlyerAxleRotor';
  const empty = { supports, rotor };
  if (legs.length !== 2 || !Number.isFinite(hubHeight) || hubHeight <= 0) return empty;
  const heads: THREE.Vector3[] = [];
  for (const leg of legs) {
    if (!(leg.geometry instanceof THREE.CylinderGeometry) || !leg.scale.equals(new THREE.Vector3(1, 1, 1))) return empty;
    const { height, radiusTop } = leg.geometry.parameters;
    if (![height, radiusTop, ...leg.position.toArray(), ...leg.quaternion.toArray()].every(Number.isFinite) || height <= 0 || radiusTop <= 0) return empty;
    leg.updateMatrix();
    const head = new THREE.Vector3(0, height / 2, 0).applyMatrix4(leg.matrix);
    if (Math.abs(head.x) > 1e-5) return empty;
    const positions = leg.geometry.getAttribute('position');
    for (let j = 0; j < positions.count; j++) {
      if (Math.abs(positions.getY(j) - height / 2) > 1e-5) continue;
      const p = new THREE.Vector3().fromBufferAttribute(positions, j).applyMatrix4(leg.matrix);
      if (!p.toArray().every(Number.isFinite) || Math.abs(p.x) >= 1.88 || Math.abs(p.y - hubHeight) >= 1.98 || Math.abs(p.z - head.z) >= 1.88) return empty;
    }
    heads.push(head);
  }
  const minZ = Math.min(...heads.map(p => p.z)) - 2.8, maxZ = Math.max(...heads.map(p => p.z)) + 2.8;
  if (Math.min(...heads.map(p => p.z)) >= -3 || Math.max(...heads.map(p => p.z)) <= 3) return empty;
  const box = new THREE.BoxGeometry(1, 1, 1), cylinder = new THREE.CylinderGeometry(1, 1, 1, 24);
  const paint = new THREE.MeshStandardMaterial({ name: 'C3_FlyerAxlePaint', color: 0xb2bec8, roughness: .68, metalness: 0 });
  const dark = new THREE.MeshStandardMaterial({ name: 'C3_FlyerAxleDarkPaint', color: 0x45515d, roughness: .58, metalness: 0 });
  const bodies = new THREE.InstancedMesh(box, paint, 2); bodies.name = 'C3_FlyerAxleBearings';
  const collars = new THREE.InstancedMesh(cylinder, dark, 2); collars.name = 'C3_FlyerAxleCollars';
  const flanges = new THREE.InstancedMesh(cylinder, dark, 2); flanges.name = 'C3_FlyerAxleFlanges';
  const axial = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2), identity = new THREE.Quaternion();
  const m = new THREE.Matrix4(), p = new THREE.Vector3(), s = new THREE.Vector3();
  heads.forEach((head, i) => {
    p.set(0, hubHeight, head.z); s.set(3.8, 4, 3.8); bodies.setMatrixAt(i, m.compose(p, identity, s));
    s.set(1.7, 4.1, 1.7); collars.setMatrixAt(i, m.compose(p, axial, s));
    p.set(0, 0, i ? 2.4 : -2.4); s.set(3.3, .2, 3.3); flanges.setMatrixAt(i, m.compose(p, axial, s));
  });
  const shaft = new THREE.Mesh(cylinder, dark); shaft.name = 'C3_FlyerAxleShaft'; shaft.position.set(0, hubHeight, (minZ + maxZ) / 2); shaft.quaternion.copy(axial); shaft.scale.set(1, maxZ - minZ, 1);
  const hub = new THREE.Mesh(cylinder, paint); hub.name = 'C3_FlyerAxleHub'; hub.quaternion.copy(axial); hub.scale.set(3, 4.6, 3);
  for (const mesh of [bodies, collars, flanges]) { mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingBox(); mesh.computeBoundingSphere(); }
  supports.add(bodies, collars, shaft); rotor.add(hub, flanges);
  return { supports, rotor };
}
