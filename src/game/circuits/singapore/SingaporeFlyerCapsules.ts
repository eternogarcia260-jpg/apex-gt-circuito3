import * as THREE from 'three';

/** Game-scale cabin LOD. The pivot stays on the rim; only the cabin hangs outside it. */
export function createC3FlyerCapsules(radius: number, count: number): THREE.Group[] {
  if (!Number.isFinite(radius) || radius <= 0 || !Number.isInteger(count) || count < 1) return [];
  const positions: number[] = [], painted: number[] = [], glazed: number[] = [];
  const sides = 16;
  const profile: Array<[number, number]> = [
    [-2.3, .45], [-2.1, .78], [-1.8, 1], [-1.72, 1], [-.70, 1], [-.62, 1],
    [.62, 1], [.70, 1], [1.72, 1], [1.8, 1], [2.1, .78], [2.3, .45],
  ];
  for (const [x, scale] of profile) for (let j = 0; j < sides; j++) {
    const angle = j * Math.PI * 2 / sides;
    positions.push(x, -1.8 + Math.cos(angle) * 1.2 * scale, 3.8 + Math.sin(angle) * 1.2 * scale);
  }
  for (let i = 0; i < profile.length - 1; i++) for (let j = 0; j < sides; j++) {
    const k = (j + 1) % sides, a = i * sides + j, b = (i + 1) * sides + j, c = i * sides + k, d = (i + 1) * sides + k;
    const isFrame = profile[i + 1][0] - profile[i][0] < .081;
    const roofOrFloor = Math.abs(Math.cos((j + .5) * Math.PI * 2 / sides)) > .85;
    (isFrame || roofOrFloor ? painted : glazed).push(a, c, b, b, c, d);
  }
  const leftTip = positions.length / 3; positions.push(-2.4, -1.8, 3.8);
  const rightTip = positions.length / 3; positions.push(2.4, -1.8, 3.8);
  for (let j = 0; j < sides; j++) {
    const k = (j + 1) % sides, right = (profile.length - 1) * sides;
    painted.push(leftTip, k, j, rightTip, right + j, right + k);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.name = 'C3_FlyerSharedCabinGeometry';
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex([...painted, ...glazed]); geometry.computeVertexNormals();
  const normals = Array.from(geometry.getAttribute('normal').array);
  const addPaintedBox = (w: number, h: number, d: number, x: number, y: number, z: number) => {
    const box = new THREE.BoxGeometry(w, h, d); box.translate(x, y, z);
    const base = positions.length / 3;
    positions.push(...Array.from(box.getAttribute('position').array));
    normals.push(...Array.from(box.getAttribute('normal').array));
    painted.push(...Array.from(box.index!.array, i => i + base)); box.dispose();
  };
  // The spindle intersects the positive rim intentionally: it is the mounting joint.
  addPaintedBox(.18, .18, 4, 0, 0, 1.9);
  addPaintedBox(.12, .65, .14, 0, -.325, 3.8);
  addPaintedBox(2.4, .1, .18, 0, -.6, 3.8);
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex([...painted, ...glazed]);
  geometry.clearGroups(); geometry.addGroup(0, painted.length, 0); geometry.addGroup(painted.length, glazed.length, 1);
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  const paint = new THREE.MeshStandardMaterial({ name: 'C3_FlyerCabinPaint', color: 0xd9e0e4, roughness: .62, metalness: 0 });
  // Lightweight tinted glazing, not transmission/refraction or a ray-traced material.
  const glass = new THREE.MeshStandardMaterial({ name: 'C3_FlyerCabinGlass', color: 0x315a70, roughness: .18, metalness: 0, transparent: true, opacity: .78, depthWrite: false });
  return Array.from({ length: count }, (_, i) => {
    const pivot = new THREE.Group(); pivot.name = 'C3_FlyerCapsule';
    const angle = i / count * Math.PI * 2;
    pivot.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
    const cabin = new THREE.Mesh(geometry, [paint, glass]);
    cabin.name = 'C3_FlyerCapsuleCabin';
    // Avoid an opaque glass silhouette in the distant shadow map; this is a cabin LOD.
    cabin.userData.c3NoShadow = true; cabin.receiveShadow = true;
    pivot.userData.c3Cabin = { center: [0, -1.8, 3.8], shellRadius: 1.2, shellHalfLength: 2.4, mountingJointAtRim: true };
    pivot.add(cabin); return pivot;
  });
}
