import * as THREE from 'three';

/** Restrained baked-light approximation for distant night landmarks; not GI. */
function architecturalWash(source: THREE.Material): THREE.Material {
  if (!(source instanceof THREE.MeshStandardMaterial)) return source;
  const paint = source.clone();
  paint.name = 'C3_StaticArchitecturalWash';
  paint.metalness = 0;paint.roughness = 0.78;
  paint.emissive.set(0x7e7568);paint.emissiveIntensity = 0.5;
  paint.userData.c3ArchitecturalWash = true;
  return paint;
}

/** Loft stations run longitudinally along X; each ring lies in the Y/Z cross-section. */
function loftSections(sections: Array<{ x: number; y: number; z: number; halfWidth: number; halfDepth: number }>, material: THREE.Material, name: string): THREE.Mesh {
  const around = 12;
  const positions: number[] = [], indices: number[] = [];
  for (const s of sections) {
    const vertical = s.halfDepth * 0.4;
    for (let j = 0; j < around; j++) {
      const a = 2 * Math.PI * j / around, sin = Math.sin(a);
      // Flat deck across the upper half, softened shoulders, and a curved lower hull.
      const y = sin >= 0 ? s.y + vertical : s.y + vertical * sin;
      positions.push(s.x, y, s.z + Math.cos(a) * s.halfWidth);
    }
  }
  for (let i = 0; i < sections.length - 1; i++) for (let j = 0; j < around; j++) {
    const a = i * around + j, b = i * around + (j + 1) % around;
    // Outward winding for the X-longitudinal loft.
    indices.push(a, b + around, b, a, a + around, b + around);
  }
  // Solid end caps; triangle orientation is outward at each longitudinal end.
  const start = positions.length / 3;
  positions.push(sections[0].x, sections[0].y, sections[0].z);
  const end = positions.length / 3;
  const last = sections[sections.length - 1]; positions.push(last.x, last.y, last.z);
  for (let j = 0; j < around; j++) {
    const n = (j + 1) % around;
    indices.push(start, j, n);
    const base = (sections.length - 1) * around;
    indices.push(end, base + n, base + j);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geo.setIndex(indices); geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, material); mesh.name = name; return mesh;
}

/** Sculpted, tapered SkyPark deck with inset pool and edge rails. */
export function createC3SkyPark(structure: THREE.Material, glass: THREE.Material, trim: THREE.Material, water: THREE.Material = glass): THREE.Group {
  const group = new THREE.Group(); group.name = 'C3_SkyPark_Sculpted';
  const stations = [
    { x: -115, y: 177.1, z: -3, halfWidth: 2.4, halfDepth: 3.7 }, { x: -108, y: 178, z: -3, halfWidth: 12, halfDepth: 8.7 },
    { x: -90, y: 178.2, z: -3, halfWidth: 19.5, halfDepth: 11.8 }, { x: -55, y: 178, z: -3, halfWidth: 22.8, halfDepth: 12.8 },
    { x: 25, y: 178, z: -3, halfWidth: 23.8, halfDepth: 13 }, { x: 105, y: 178, z: -3, halfWidth: 22.8, halfDepth: 12.8 },
    { x: 145, y: 178.1, z: -3, halfWidth: 18.5, halfDepth: 11.4 }, { x: 166, y: 178.4, z: -3, halfWidth: 9.5, halfDepth: 7.3 },
    { x: 175, y: 177.6, z: -3, halfWidth: 1.8, halfDepth: 3.1 },
  ].map(s => ({ ...s, y: 184 - s.halfDepth * 0.4 }));
  group.add(loftSections(stations, architecturalWash(structure), 'SkyPark_curved_boat_hull'));
  // Pool and canopy occupy opposite sides of the deck, with no overlap.
  const pool = stations.slice(3, 6).map(s => ({ ...s, y: s.y + s.halfDepth * 0.4 + 0.15, z: s.z + 6, halfWidth: 7, halfDepth: 0.12 }));
  group.add(loftSections(pool, water, 'SkyPark_infinity_pool_ribbon'));
  for (const side of [-1, 1]) {
    const rail = stations.map(s => ({ ...s, y: s.y + s.halfDepth * 0.4 + 0.75, z: s.z + side * s.halfWidth * 0.94, halfWidth: 0.15, halfDepth: 0.14 }));
    group.add(loftSections(rail, trim, side < 0 ? 'SkyPark_rail_front' : 'SkyPark_rail_back'));
  }
  // A single restrained canopy segment, avoiding a self-intersecting roof ribbon.
  group.add(loftSections(stations.slice(3, 6).map(s => ({ ...s, y: s.y + s.halfDepth * 0.4 + 1.1, z: s.z - 13, halfWidth: 4, halfDepth: 0.18 })), glass, 'SkyPark_canopy_ribbon'));
  return group;
}

function petalGeometry(index: number): THREE.BufferGeometry {
  const radialSteps = 14, across = 8, pos: number[] = [], idx: number[] = [];
  const theta = index * Math.PI * 2 / 10;
  for (let i = 0; i <= radialSteps; i++) {
    const t = i / radialSteps, radius = 4.3 + 22 * t;
    const width = 1.5 + 9.0 * Math.sin(Math.PI * 0.5 * Math.pow(t, 0.78)) ** 0.9;
    const yCenter = 3.8 + 35.5 * Math.pow(t, 1.45);
    for (let j = 0; j <= across; j++) {
      const u = (j / across) * 2 - 1, angle = theta + u * width / Math.max(radius, 2) * 0.5;
      const camber = 1.15 * (1 - u * u) + 0.65 * Math.sin(Math.PI * t), r = radius + 1.3 * u * u;
      pos.push(r * Math.cos(angle), yCenter + camber, r * Math.sin(angle));
    }
  }
  // Closed thin shell: outer and inner surfaces plus perimeter closures.
  const vertexCount = (radialSteps + 1) * (across + 1);
  for (let v = 0; v < vertexCount; v++) pos.push(pos[v * 3], pos[v * 3 + 1] - 0.35, pos[v * 3 + 2]);
  const surface = (reverse: boolean) => {
    const base = reverse ? (radialSteps + 1) * (across + 1) : 0;
    for (let i = 0; i < radialSteps; i++) for (let j = 0; j < across; j++) {
      const a = base + i * (across + 1) + j, b = a + across + 1;
      if (reverse) idx.push(a, b, a + 1, a + 1, b, b + 1); else idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  };
  surface(false); surface(true);
  // Join both faces around the perimeter; bevel-free 0.35 m shell closure.
  const inner = (radialSteps + 1) * (across + 1), rows = radialSteps + 1, cols = across + 1;
  const edge = (a: number, b: number) => { const ai = a + inner, bi = b + inner; idx.push(b, a, ai, b, ai, bi); };
  for (let j = 0; j < across; j++) { edge(j, j + 1); edge(radialSteps * cols + j + 1, radialSteps * cols + j); }
  for (let i = 0; i < radialSteps; i++) { edge((i + 1) * cols, i * cols); edge(i * cols + across, (i + 1) * cols + across); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}

export function createC3LotusMuseum(structure: THREE.Material, glass: THREE.Material): THREE.Group {
  const group = new THREE.Group(); group.name = 'C3_Lotus_Museum_Petals';
  const petalPaint = architecturalWash(structure);
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(8.8, 10.5, 5.5, 20, 1), structure); pedestal.name = 'Lotus_light_pedestal'; pedestal.position.y = 2.75; group.add(pedestal);
  const core = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 7, 13, 16, 2), structure); core.name = 'Lotus_central_gallery'; core.position.y = 9.2; group.add(core);
  for (let i = 0; i < 10; i++) { const mesh = new THREE.Mesh(petalGeometry(i), petalPaint); mesh.name = `Lotus_curved_petal_${String(i + 1).padStart(2, '0')}`; group.add(mesh); }
  const oculus = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 4.5, 1.3, 16), glass); oculus.name = 'Lotus_glazed_oculus'; oculus.position.y = 15.7; group.add(oculus);
  group.position.set(-110, 0, -55); return group;
}
