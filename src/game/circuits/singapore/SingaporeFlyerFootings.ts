import * as THREE from 'three';

/** Local scenic supports; they deliberately introduce no physics bodies. */
export function createC3FlyerFootings(legs: readonly THREE.Mesh[]): THREE.Group {
  const root = new THREE.Group(); root.name = 'C3_FlyerFootings';
  const plans: { leg: THREE.Mesh; bottom: THREE.Vector3; normal: THREE.Vector3; radius: number; half: number }[] = [];
  for (const leg of legs) {
    if (!(leg.geometry instanceof THREE.CylinderGeometry) || !leg.scale.equals(new THREE.Vector3(1, 1, 1))) return root;
    const { height, radiusBottom: radius } = leg.geometry.parameters;
    if (![height, radius, ...leg.position.toArray(), ...leg.quaternion.toArray()].every(Number.isFinite) || height <= 0 || radius <= 0) return root;
    leg.updateMatrix();
    const bottom = new THREE.Vector3(0, -height / 2, 0).applyMatrix4(leg.matrix);
    const normal = new THREE.Vector3(0, 1, 0).applyQuaternion(leg.quaternion).normalize();
    const half = radius + .6;
    if (normal.y <= .5 || bottom.y - .2 / normal.y - (Math.abs(normal.x) + Math.abs(normal.z)) * half / normal.y <= .35) return root;
    plans.push({ leg, bottom, normal, radius, half });
  }
  if (!plans.length) return root;
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const concrete = new THREE.MeshStandardMaterial({ name: 'C3_FlyerFootingConcrete', color: 0x727a80, roughness: .92, metalness: 0 });
  const paint = new THREE.MeshStandardMaterial({ name: 'C3_FlyerFootingPlate', color: 0xa6b1b8, roughness: .62, metalness: 0 });
  const slabs = new THREE.InstancedMesh(unitBox, concrete, plans.length); slabs.name = 'C3_FlyerFootingSlabs';
  const plates = new THREE.InstancedMesh(unitBox, paint, plans.length); plates.name = 'C3_FlyerFootingPlates';
  const matrix = new THREE.Matrix4(), scale = new THREE.Vector3(), position = new THREE.Vector3(), identity = new THREE.Quaternion();
  plans.forEach(({ leg, bottom, normal, radius, half }, i) => {
    // Slab: bottom -.35, top +.25; the urban ground at -.08 crosses the slab.
    position.set(bottom.x, -.05, bottom.z); scale.set(2 * (radius + 1.6), .6, 2 * (radius + 1.6));
    slabs.setMatrixAt(i, matrix.compose(position, identity, scale));
    // Its upper face is exactly the lower cylinder face, in the same plane.
    position.copy(bottom).addScaledVector(normal, -.1); scale.set(2 * (radius + .3), .2, 2 * (radius + .3));
    plates.setMatrixAt(i, matrix.compose(position, leg.quaternion, scale));
    const geometry = new THREE.BoxGeometry(2 * half, 1, 2 * half);
    const vertices = geometry.getAttribute('position');
    for (let j = 0; j < vertices.count; j++) {
      const top = bottom.y - .2 / normal.y - (normal.x * vertices.getX(j) + normal.z * vertices.getZ(j)) / normal.y;
      vertices.setY(j, vertices.getY(j) > 0 ? top : .25);
    }
    vertices.needsUpdate = true; geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const wedge = new THREE.Mesh(geometry, concrete); wedge.name = 'C3_FlyerFootingWedge'; wedge.position.set(bottom.x, 0, bottom.z); root.add(wedge);
  });
  for (const mesh of [slabs, plates]) { mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingBox(); mesh.computeBoundingSphere(); }
  root.add(slabs, plates);
  return root;
}
