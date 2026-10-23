import * as THREE from 'three';

export interface C3TrackPoint { x: number; z: number; accumulatedDistance?: number }
export interface C3TrackFrame { x: number; z: number; nx: number; nz: number }

/** One frame per actual sample, also shared by both sides of the seam. */
export function getC3TrackFrames(points: readonly C3TrackPoint[]): C3TrackFrame[] {
  return points.map((p, i) => {
    const before = points[(i + points.length - 1) % points.length];
    const after = points[(i + 1) % points.length];
    const dx = after.x - before.x, dz = after.z - before.z;
    const length = Math.hypot(dx, dz) || 1;
    return { x: p.x, z: p.z, nx: -dz / length, nz: dx / length };
  });
}

export interface C3SafetyStrip {
  walls: THREE.BufferGeometry;
  segments: { p1: { x: number; z: number }; p2: { x: number; z: number }; side: number; index: number }[];
}

/** Concrete cross sections meet exactly; visual and collision segments share endpoints. */
export function buildC3SafetyStrip(points: readonly C3TrackPoint[], offset = 8.9): C3SafetyStrip {
  const frames = getC3TrackFrames(points);
  const vertices: number[] = [], indices: number[] = [], uvs: number[] = [];
  const segments: C3SafetyStrip['segments'] = [];
  const v = (f: C3TrackFrame, side: number, lateral: number, y: number) => new THREE.Vector3(f.x + f.nx * lateral * side, y, f.z + f.nz * lateral * side);
  const addQuad = (target: number[], idx: number[], uv: number[], a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, expected: THREE.Vector3, length: number, height: number) => {
    const base = target.length / 3;
    for (const p of [a, b, c, d]) target.push(p.x, p.y, p.z);
    uv.push(0, 0, length / 3, 0, 0, height / 3, length / 3, height / 3);
    const n = b.clone().sub(a).cross(c.clone().sub(a));
    if (n.dot(expected) >= 0) idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    else idx.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
  };
  const open = (index: number, side: number) => {
    const d = points[index].accumulatedDistance ?? 0;
    // East paddock opening: local -X / positive track normal on the pit straight.
    return side === 1 && (d < 160 || d > 4680);
  };
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    for (const side of [-1, 1]) {
      if (open(i, side)) continue;
      const a = frames[i], b = frames[j];
      const aIn = v(a, side, offset - 0.4, 0), bIn = v(b, side, offset - 0.4, 0);
      const aOut = v(a, side, offset + 0.4, 0), bOut = v(b, side, offset + 0.4, 0);
      const aInTop = aIn.clone().setY(1.1), bInTop = bIn.clone().setY(1.1);
      const aOutTop = aOut.clone().setY(1.1), bOutTop = bOut.clone().setY(1.1);
      const length = Math.hypot(b.x - a.x, b.z - a.z);
      const outward = new THREE.Vector3((a.nx + b.nx) * side, 0, (a.nz + b.nz) * side).normalize();
      addQuad(vertices, indices, uvs, aIn, bIn, aInTop, bInTop, outward.clone().negate(), length, 1.1);
      addQuad(vertices, indices, uvs, aOut, bOut, aOutTop, bOutTop, outward, length, 1.1);
      addQuad(vertices, indices, uvs, aInTop, bInTop, aOutTop, bOutTop, new THREE.Vector3(0, 1, 0), length, 0.8);
      if (open((i + points.length - 1) % points.length, side)) addQuad(vertices, indices, uvs, aIn, aOut, aInTop, aOutTop, new THREE.Vector3(a.x - b.x, 0, a.z - b.z), 0.8, 1.1);
      if (open(j, side)) addQuad(vertices, indices, uvs, bIn, bOut, bInTop, bOutTop, new THREE.Vector3(b.x - a.x, 0, b.z - a.z), 0.8, 1.1);
      const p1 = v(a, side, offset, 0), p2 = v(b, side, offset, 0);
      segments.push({ p1: { x: p1.x, z: p1.z }, p2: { x: p2.x, z: p2.z }, side, index: i });
    }
  }
  const make = (positions: number[], index: number[], uv: number[]) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(index);g.computeVertexNormals();g.computeBoundingSphere();return g;
  };
  return { walls: make(vertices, indices, uvs), segments };
}
