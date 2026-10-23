import * as THREE from 'three';

export type C3KerbPoint = { x: number; z: number; accumulatedDistance?: number };
export type C3KerbStats = { stripes: number; maxStripeLength: number; triangles: number };
export type C3KerbRibbons = { blue: THREE.BufferGeometry; white: THREE.BufferGeometry; stats: C3KerbStats };
type Sample = { x: number; z: number; distance: number; nx: number; nz: number; segment: number };
type SurfacePoint = { x: number; y: number; z: number };

/** Blue/white paint uses world metres, not the spline's waypoint spacing. */
export function buildC3KerbRibbons(points: readonly C3KerbPoint[], halfWidth = 7): C3KerbRibbons {
  const blue = new THREE.BufferGeometry(), white = new THREE.BufferGeometry();
  const stats: C3KerbStats = { stripes: 0, maxStripeLength: 0, triangles: 0 };
  if (points.length < 3 || !Number.isFinite(halfWidth) || halfWidth <= 0 || points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.z))) return { blue, white, stats };
  const n = points.length, geometric = [0];
  for (let i = 1; i < n; i++) geometric.push(geometric[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z));
  const useAccumulated = points.every((p, i) => Number.isFinite(p.accumulatedDistance) && (i === 0 || p.accumulatedDistance! > points[i - 1].accumulatedDistance!));
  const origin = useAccumulated ? points[0].accumulatedDistance! : 0;
  const distances = points.map((p, i) => useAccumulated ? p.accumulatedDistance! - origin : geometric[i]);
  const total = distances[n - 1] + Math.hypot(points[0].x - points[n - 1].x, points[0].z - points[n - 1].z);
  if (!(total > 0)) return { blue, white, stats };
  const curvature = points.map((p, i) => {
    const prev = points[(i + n - 1) % n], next = points[(i + 1) % n];
    return (p.x - prev.x) * (next.z - p.z) - (p.z - prev.z) * (next.x - p.x);
  });
  const signs = points.map((_, i) => {
    for (let radius = 0; radius <= 2; radius++) for (const j of radius === 0 ? [i] : [(i - radius + n) % n, (i + radius) % n]) {
      if (Math.abs(curvature[j]) > 0.85) return Math.sign(curvature[j]);
    }
    return 0;
  });
  const sides = signs.map((_, i) => signs[(i + 1) % n]);
  const samples: Sample[] = points.map((p, i) => {
    const prev = points[(i + n - 1) % n], next = points[(i + 1) % n];
    const dx = next.x - prev.x, dz = next.z - prev.z, length = Math.hypot(dx, dz) || 1;
    return { x: p.x, z: p.z, distance: distances[i], nx: -dz / length, nz: dx / length, segment: i };
  });
  const segmentAt = (d: number): number => {
    let low = 0, high = n;
    while (low < high) { const mid = (low + high) >>> 1; if (distances[mid] <= d) low = mid + 1; else high = mid; }
    return Math.max(0, Math.min(n - 1, low - 1));
  };
  const sampleAt = (d: number): Sample => {
    const segment = segmentAt(d), a = samples[segment], next = (segment + 1) % n, b = samples[next];
    const end = next === 0 ? total : b.distance;
    const t = end > a.distance ? THREE.MathUtils.clamp((d - a.distance) / (end - a.distance), 0, 1) : 0;
    let nx = a.nx + (b.nx - a.nx) * t, nz = a.nz + (b.nz - a.nz) * t;
    const norm = Math.hypot(nx, nz) || 1; nx /= norm; nz /= norm;
    return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, distance: d, nx, nz, segment };
  };
  // A closed run spanning waypoint 649->0 is one run, not two abrupt steps.
  const runLimits = sides.map((side, i) => {
    if (!side) return null;
    let first = i, last = i, count = 1;
    while (count < n && sides[(first + n - 1) % n] === side) { first = (first + n - 1) % n; count++; }
    if (count === n) return null; // Continuous circular kerb needs no artificial meta taper.
    while (sides[(last + 1) % n] === side) last = (last + 1) % n;
    const start = distances[first], end = distances[(last + 1) % n];
    return { start, length: (end - start + total) % total };
  });
  const buckets = { blue: { vertices: [] as number[], indices: [] as number[] }, white: { vertices: [] as number[], indices: [] as number[] } };
  const addTop = (key: 'blue' | 'white', a: SurfacePoint, b: SurfacePoint, c: SurfacePoint, d: SurfacePoint) => {
    const out = buckets[key], offset = out.vertices.length / 3;
    out.vertices.push(a.x,a.y,a.z,b.x,b.y,b.z,c.x,c.y,c.z,d.x,d.y,d.z);
    const upward = (b.z-a.z)*(c.x-a.x)-(b.x-a.x)*(c.z-a.z);
    out.indices.push(...(upward >= 0 ? [offset,offset+1,offset+2,offset+1,offset+3,offset+2] : [offset,offset+2,offset+1,offset+1,offset+2,offset+3]));
    stats.triangles += 2;
  };
  const stripeLength = 1.2;
  for (let stripe = 0; stripe * stripeLength < total; stripe++) {
    const start = stripe * stripeLength, end = Math.min(total, start + stripeLength);
    const key = stripe % 2 === 0 ? 'blue' : 'white';
    const cuts = [start];
    for (let i = segmentAt(start) + 1; i < n && distances[i] < end - 1e-8; i++) if (distances[i] > start + 1e-8) cuts.push(distances[i]);
    cuts.push(end);
    let emitted = false;
    for (let k = 0; k < cuts.length - 1; k++) {
      const d0 = cuts[k], d1 = cuts[k + 1], segment = segmentAt((d0 + d1) / 2), side = sides[segment];
      if (!side || d1 - d0 < 1e-8) continue;
      emitted = true;
      const limits = runLimits[segment];
      const edge = (sample: Sample) => {
        const runDistance = limits ? (sample.distance - limits.start + total) % total : 3;
        const taper = limits ? THREE.MathUtils.clamp(Math.min(runDistance / 3, (limits.length - runDistance) / 3), 0, 1) : 1;
        const point = (offset: number, y: number) => ({ x: sample.x + sample.nx * offset * side, y, z: sample.z + sample.nz * offset * side });
        return { inner: point(halfWidth - 0.05, 0.025), peak: point(halfWidth + 0.66, 0.025 + 0.055*taper), outer: point(halfWidth + 1.3, 0.025 + 0.012*taper) };
      };
      const a = edge(sampleAt(d0)), b = edge(sampleAt(d1));
      addTop(key,a.inner,b.inner,a.peak,b.peak);addTop(key,a.peak,b.peak,a.outer,b.outer);
    }
    if (emitted) { stats.stripes++;stats.maxStripeLength = Math.max(stats.maxStripeLength, end - start); }
  }
  for (const [key, geometry] of [['blue',blue],['white',white]] as const) {
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(buckets[key].vertices,3));geometry.setIndex(buckets[key].indices);geometry.computeVertexNormals();geometry.name=key==='blue'?'C3_KerbsBlue':'C3_KerbsWhite';
  }
  return { blue, white, stats };
}
