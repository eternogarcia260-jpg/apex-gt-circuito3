import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

type TrackPoint = { x: number; z: number };
type Bucket = { material: THREE.MeshStandardMaterial; geometries: THREE.BufferGeometry[] };

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function material(name: string, color: number, roughness: number, metalness: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ name, color, roughness, metalness });
}

function addGeometry(bucket: Bucket, geometry: THREE.BufferGeometry, matrix?: THREE.Matrix4): void {
  const copy = geometry.clone();
  if (matrix) copy.applyMatrix4(matrix);
  copy.computeVertexNormals();
  bucket.geometries.push(copy);
  geometry.dispose();
}

function box(bucket: Bucket, x: number, y: number, z: number, sx: number, sy: number, sz: number, matrix?: THREE.Matrix4): void {
  addGeometry(bucket, new THREE.BoxGeometry(sx, sy, sz), new THREE.Matrix4().makeTranslation(x, y, z).premultiply(matrix ?? new THREE.Matrix4()));
}

function cylinderBetween(bucket: Bucket, a: THREE.Vector3, b: THREE.Vector3, rA: number, rB: number, segments: number, matrix?: THREE.Matrix4): void {
  const direction = new THREE.Vector3().subVectors(b, a);
  const length = direction.length() || 1;
  const rotation = new THREE.Quaternion().setFromUnitVectors(Y_AXIS, direction.normalize());
  const local = new THREE.Matrix4().compose(new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5), rotation, new THREE.Vector3(1, 1, 1));
  addGeometry(bucket, new THREE.CylinderGeometry(rB, rA, length, segments, 1, false), new THREE.Matrix4().multiplyMatrices(matrix ?? new THREE.Matrix4(), local));
}

function cylinder(bucket: Bucket, x: number, y: number, z: number, rA: number, rB: number, height: number, segments: number, matrix?: THREE.Matrix4): void {
  cylinderBetween(bucket, new THREE.Vector3(x, y - height / 2, z), new THREE.Vector3(x, y + height / 2, z), rA, rB, segments, matrix);
}

function torus(bucket: Bucket, x: number, y: number, z: number, major: number, minor: number, materialMatrix: THREE.Matrix4, matrix?: THREE.Matrix4): void {
  const rotation = new THREE.Matrix4().makeRotationX(Math.PI / 2);
  const local = new THREE.Matrix4().makeTranslation(x, y, z).multiply(rotation).multiply(materialMatrix);
  addGeometry(bucket, new THREE.TorusGeometry(major, minor, 8, 16), new THREE.Matrix4().multiplyMatrices(matrix ?? new THREE.Matrix4(), local));
}

function sphere(bucket: Bucket, x: number, y: number, z: number, radius: number, matrix?: THREE.Matrix4): void {
  addGeometry(bucket, new THREE.SphereGeometry(radius, 8, 5), new THREE.Matrix4().makeTranslation(x, y, z).premultiply(matrix ?? new THREE.Matrix4()));
}

function mergeBucket(bucket: Bucket): THREE.BufferGeometry | null {
  if (!bucket.geometries.length) return null;
  const merged = mergeGeometries(bucket.geometries, false);
  bucket.geometries.forEach((geometry) => geometry.dispose());
  bucket.geometries.length = 0;
  if (merged) {
    merged.computeVertexNormals();
    merged.computeBoundingBox();
    merged.computeBoundingSphere();
  }
  return merged;
}

function buildExactFixture(): { buckets: Bucket[]; sourceMaterial: THREE.Matrix4 } {
  const steel = material('C3_OfflineSteelSatin', 0x606b72, 0.30, 0.55);
  const steelLight = material('C3_OfflineSteelLight', 0x909ba1, 0.22, 0.68);
  const steelDark = material('C3_OfflineSteelDark', 0x353e44, 0.42, 0.36);
  const black = material('C3_OfflineBlack', 0x20272c, 0.50, 0.36);
  const black2 = material('C3_OfflineBlackEdge', 0x2d353a, 0.46, 0.48);
  const rubber = material('C3_OfflineRubber', 0x151a1d, 0.78, 0.08);
  const aluminum = material('C3_OfflineAluminium', 0xaab2b6, 0.16, 0.80);
  const glass = material('C3_OfflineGlass', 0x303a41, 0.28, 0.48);
  const optic = material('C3_OfflineOptic', 0x68747a, 0.22, 0.62);
  const opticDark = material('C3_OfflineOpticDark', 0x343f45, 0.37, 0.55);
  const lens = material('C3_OfflineLens', 0x7c888d, 0.18, 0.72);
  const warning = material('C3_OfflineWarningBand', 0xc58a3c, 0.52, 0.32);
  const concrete = material('C3_OfflineConcreteBase', 0x717a7e, 0.82, 0.10);
  const bolt = material('C3_OfflineBolts', 0xabb3b7, 0.14, 0.75);
  const seam = material('C3_OfflineSeams', 0x13191d, 0.62, 0.15);
  const buckets = [steel, steelLight, steelDark, black, black2, rubber, aluminum, glass, optic, opticDark, lens, warning, concrete, bolt, seam].map((m) => ({ material: m, geometries: [] }));
  const B = Object.fromEntries(buckets.map((bucket) => [bucket.material.name, bucket])) as Record<string, Bucket>;
  const head = new THREE.Matrix4().compose(new THREE.Vector3(0, 7.56, 0.12), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.105), new THREE.Vector3(1, 1, 1));

  cylinder(B[concrete.name], 0, 0.10, 0, 0.48, 0.48, 0.16, 48);
  cylinder(B[steelDark.name], 0, 0.20, 0, 0.43, 0.43, 0.08, 48);
  cylinder(B[steelLight.name], 0, 0.275, 0, 0.31, 0.31, 0.07, 40);
  cylinder(B[steel.name], 0, 0.35, 0, 0.235, 0.218, 0.10, 32);
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI * 2 / 12;
    cylinder(B[bolt.name], Math.cos(a) * 0.35, 0.245, Math.sin(a) * 0.35, 0.026, 0.026, 0.09, 10);
    torus(B[steelDark.name], Math.cos(a) * 0.35, 0.294, Math.sin(a) * 0.35, 0.018, 0.004, new THREE.Matrix4().makeRotationX(Math.PI / 2));
  }
  cylinder(B[steel.name], 0, 3.77, 0, 0.205, 0.108, 6.86, 32);
  for (const [y, r] of [[0.72, 0.198], [1.28, 0.190], [3.30, 0.161], [5.48, 0.128], [6.77, 0.113]]) {
    cylinder(B[steelDark.name], 0, y, 0, r + 0.018, r + 0.018, 0.07, 32);
    cylinder(B[steelLight.name], 0, y, 0, r + 0.020, r + 0.020, 0.042, 32);
    cylinder(B[steel.name], 0, y, 0, r + 0.021, r + 0.021, 0.022, 32);
  }
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + 0.22;
    cylinderBetween(B[steelDark.name], new THREE.Vector3(Math.cos(a) * 0.188, 0.48, Math.sin(a) * 0.188), new THREE.Vector3(Math.cos(a) * 0.111, 7.08, Math.sin(a) * 0.111), 0.006, 0.004, 8);
  }
  cylinder(B[warning.name], 0, 0.79, 0, 0.201, 0.198, 0.04, 32);
  cylinder(B[black.name], 0, 0.832, 0, 0.198, 0.196, 0.025, 32);
  box(B[black2.name], 0, 0.99, 0.205, 0.33, 0.43, 0.12);
  box(B[steelDark.name], 0, 0.99, 0.272, 0.285, 0.373, 0.018);
  box(B[black2.name], 0, 0.99, 0.284, 0.258, 0.343, 0.012);
  cylinder(B[black.name], 0, 0.795, 0.205, 0.043, 0.043, 0.07, 16);
  cylinder(B[steelLight.name], 0, 0.762, 0.205, 0.030, 0.030, 0.015, 16);
  cylinder(B[black.name], 0.157, 4.05, 0.115, 0.026, 0.021, 5.54, 12);
  for (let y = 1.55; y < 6.8; y += 0.55) {
    cylinder(B[steelDark.name], 0.157, y, 0.115, 0.033, 0.033, 0.05, 12);
    box(B[steelLight.name], 0.157, y, 0.148, 0.052, 0.022, 0.018);
  }
  for (const x of [-0.235, 0.235]) cylinderBetween(B[steelDark.name], new THREE.Vector3(x, 0.57, -0.12), new THREE.Vector3(x * 0.72, 6.55, -0.16), 0.022, 0.018, 10);
  for (let y = 0.72; y < 6.52; y += 0.32) {
    const t = y / 6.55; const half = 0.235 * (1 - t) + 0.169 * t;
    cylinderBetween(B[steelLight.name], new THREE.Vector3(-half, y, -0.165), new THREE.Vector3(half, y, -0.165), 0.016, 0.016, 10);
  }
  cylinder(B[steelDark.name], 0, 7.05, 0, 0.139, 0.139, 0.18, 32);
  cylinder(B[steelLight.name], 0, 7.032, 0, 0.151, 0.151, 0.045, 32);
  box(B[black2.name], 0, 7.19, -0.01, 0.36, 0.28, 0.42);
  box(B[steelDark.name], 0, 7.56, -0.045, 2.72, 0.12, 0.24);
  box(B[steelLight.name], 0, 7.56, 0.095, 2.66, 0.035, 0.025);
  for (const x of [-1.27, 1.27]) { box(B[steelDark.name], x, 7.57, -0.02, 0.10, 0.96, 0.25); box(B[steel.name], x, 7.57, 0.115, 0.055, 0.84, 0.035); }
  for (const side of [-1, 1]) {
    cylinderBetween(B[steelLight.name], new THREE.Vector3(0, 7.20, -0.08), new THREE.Vector3(side * 1.12, 7.49, -0.055), 0.047, 0.04, 16);
    cylinderBetween(B[steelDark.name], new THREE.Vector3(side * 0.10, 7.23, -0.07), new THREE.Vector3(side * 0.98, 7.46, 0.015), 0.022, 0.022, 12);
  }
  box(B[black.name], 0, 7.56, 0.17, 2.56, 0.93, 0.17, head);
  box(B[steelDark.name], 0, 7.56, 0.268, 2.50, 0.87, 0.035, head);
  for (const x of [-1.22, 0, 1.22]) box(B[steelLight.name], x, 7.56, 0.29, 0.035, 0.84, 0.025, head);
  const xs = [-0.82, 0, 0.82], ys = [7.31, 7.81];
  for (const cy of ys) for (const cx of xs) {
    box(B[black2.name], cx, cy, 0.205, 0.765, 0.435, 0.30, head);
    box(B[black.name], cx, cy, 0.365, 0.713, 0.397, 0.065, head);
    box(B[glass.name], cx, cy, 0.404, 0.641, 0.326, 0.014, head);
    for (const yy of [cy - 0.184, cy + 0.184]) box(B[steelLight.name], cx, yy, 0.421, 0.691, 0.026, 0.025, head);
    for (const xx of [cx - 0.333, cx + 0.333]) box(B[steelLight.name], xx, cy, 0.421, 0.026, 0.345, 0.025, head);
    box(B[rubber.name], cx, cy, 0.424, 0.611, 0.296, 0.008, head);
    box(B[glass.name], cx, cy, 0.429, 0.584, 0.270, 0.008, head);
    for (let iy = 0; iy < 3; iy++) for (let ix = 0; ix < 6; ix++) {
      const x = cx + (ix - 2.5) * 0.091, y = cy + (iy - 1) * 0.087, z = 0.437;
      cylinder(B[opticDark.name], x, y, z - 0.0035, 0.031, 0.031, 0.013, 10, head);
      cylinder(B[aluminum.name], x, y, z + 0.0055, 0.025, 0.025, 0.007, 10, head);
      torus(B[steelDark.name], x, y, z + 0.010, 0.018, 0.004, new THREE.Matrix4(), head);
      cylinder(B[optic.name], x, y, z + 0.0065, 0.016, 0.016, 0.005, 10, head);
      sphere(B[lens.name], x, y, z + 0.010, 0.010, head);
    }
    for (const dx of [-0.30, 0.30]) for (const dy of [-0.15, 0.15]) {
      cylinder(B[bolt.name], cx + dx, cy + dy, 0.426, 0.014, 0.014, 0.016, 8, head);
      box(B[seam.name], cx + dx, cy + dy, 0.435, 0.012, 0.002, 0.002, head);
    }
    for (let k = 0; k < 5; k++) box(k % 2 ? B[steelDark.name] : B[black.name], cx, cy + (k - 2) * 0.064, 0.035, 0.59, 0.021, 0.045, head);
    for (const dx of [-0.26, 0.26]) cylinder(B[steelLight.name], cx + dx, cy - 0.218, 0.195, 0.018, 0.018, 0.05, 8, head);
  }
  for (const x of [-1.31, 1.31]) {
    box(B[steelDark.name], x, 7.56, 0.17, 0.12, 1.05, 0.45, head);
    box(B[black2.name], x, 7.56, 0.408, 0.08, 0.94, 0.035, head);
    for (const y of [7.17, 7.94]) cylinder(B[bolt.name], x, y, 0.436, 0.025, 0.025, 0.032, 10, head);
  }
  for (const side of [-1, 1]) {
    cylinderBetween(B[black.name], new THREE.Vector3(side * 1.28, 7.56, -0.04), new THREE.Vector3(side * 1.48, 7.56, -0.04), 0.155, 0.155, 20, head);
    cylinderBetween(B[steelLight.name], new THREE.Vector3(side * 1.26, 7.56, -0.04), new THREE.Vector3(side * 1.50, 7.56, -0.04), 0.103, 0.103, 18, head);
    cylinderBetween(B[steelDark.name], new THREE.Vector3(side * 1.245, 7.56, -0.04), new THREE.Vector3(side * 1.515, 7.56, -0.04), 0.045, 0.045, 16, head);
    cylinderBetween(B[steelLight.name], new THREE.Vector3(side * 1.32, 7.18, -0.08), new THREE.Vector3(side * 1.32, 7.96, -0.08), 0.042, 0.035, 12, head);
    cylinderBetween(B[black.name], new THREE.Vector3(side * 1.32, 7.18, 0.04), new THREE.Vector3(side * 1.32, 7.96, 0.04), 0.023, 0.02, 10, head);
  }
  const cable = [new THREE.Vector3(0.05, 7.11, -0.17), new THREE.Vector3(0.05, 7.24, -0.22), new THREE.Vector3(0.22, 7.34, -0.23), new THREE.Vector3(0.36, 7.48, -0.22), new THREE.Vector3(0.42, 7.62, -0.22)];
  for (let i = 0; i < cable.length - 1; i++) cylinderBetween(B[rubber.name], cable[i], cable[i + 1], 0.018, 0.018, 8, head);
  for (const p of [cable[0], cable[cable.length - 1]]) sphere(B[steelDark.name], p.x, p.y, p.z, 0.034, head);
  return { buckets, sourceMaterial: new THREE.Matrix4() };
}

export function buildC3OfflineExactFloodlightRig(points: readonly TrackPoint[], halfWidth: number, concreteMaterial: THREE.Material): THREE.Group {
  const group = new THREE.Group();
  group.name = 'C3_OfflineExactFloodlightRig';
  const { buckets } = buildExactFixture();
  const transforms: THREE.Matrix4[] = [];
  for (let i = 0; i < points.length; i += 6) {
    const p = points[i]; const next = points[(i + 1) % points.length]; const prev = points[(i - 1 + points.length) % points.length];
    const dx = next.x - prev.x, dz = next.z - prev.z, len = Math.hypot(dx, dz) || 1;
    const nx = -dz / len, nz = dx / len, yaw = Math.atan2(dx, dz);
    for (const side of [-1, 1]) {
      const x = p.x + nx * (halfWidth + 4.2) * side;
      const z = p.z + nz * (halfWidth + 4.2) * side;
      transforms.push(new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromAxisAngle(Y_AXIS, yaw), new THREE.Vector3(1, 1, 1)));
    }
  }
  const identity = new THREE.Matrix4();
  for (const bucket of buckets) {
    const geometry = mergeBucket(bucket);
    if (!geometry) continue;
    const mesh = new THREE.InstancedMesh(geometry, bucket.material, transforms.length);
    mesh.name = `C3_OfflineFloodlight_${bucket.material.name}`;
    mesh.userData.c3NoShadow = true;
    mesh.castShadow = false; mesh.receiveShadow = false;
    transforms.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingBox(); mesh.computeBoundingSphere();
    group.add(mesh);
  }
  const base = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.50, 0.50, 0.05, 32), concreteMaterial, transforms.length);
  base.name = 'C3_OfflineFloodlightConcreteBases'; base.userData.c3NoShadow = true; base.castShadow = false; base.receiveShadow = false;
  transforms.forEach((matrix, index) => base.setMatrixAt(index, matrix));
  base.instanceMatrix.needsUpdate = true; base.computeBoundingSphere(); group.add(base);
  group.userData.c3FloodlightDesign = {
    fixtureCount: transforms.length,
    source: 'Foco_Circuito_Offline.html',
    exactParts: 'mástil, abrazaderas, caja eléctrica, escalera, travesaño, cabezal 3x6, reflectores, lentes, tornillería, disipadores, articulaciones y cable',
    mergedMaterialBatches: group.children.length,
    dynamicLightCount: 0,
    emissive: false,
  };
  void identity;
  return group;
}
