import * as THREE from 'three';

/** A bounded procedural LOD of Esplanade's triangular sunshades, not a survey replica. */
export function createC3EsplanadeShells(cladding: THREE.MeshStandardMaterial, glazing: THREE.MeshStandardMaterial): THREE.Group {
  const root = new THREE.Group();
  root.name = 'C3_EsplanadeShells';
  const glassGeo = new THREE.SphereGeometry(1, 48, 18, 0, Math.PI * 2, 0, Math.PI / 2);
  const skirtGeo = new THREE.CylinderGeometry(1, 1, 1, 48, 1, true);
  const columnGeo = new THREE.CylinderGeometry(0.1, 0.1, 1, 5);
  const frameMat = new THREE.MeshStandardMaterial({ name: 'C3_EsplanadeFrames', color: 0x797970, roughness: 0.74, metalness: 0.25 });
  let panelCount = 0;
  const dimensions = [{ x: -28, z: 0, r: 32, h: 24 }, { x: 35, z: 12, r: 28, h: 21 }];
  for (const [domeIndex, dp] of dimensions.entries()) {
    const dome = new THREE.Group();
    dome.name = `C3_EsplanadeDome_${domeIndex}`;
    dome.position.set(dp.x, 0, dp.z);
    const rx = dp.r * 1.15, rz = dp.r * 0.95, base = 5.8, rh = dp.h - base;
    const roof = new THREE.Mesh(glassGeo, glazing);
    roof.name = 'C3_EsplanadeGlazedRoof';
    roof.scale.set(rx, rh, rz); roof.position.y = base;
    roof.castShadow = false; roof.receiveShadow = true; dome.add(roof);
    const skirt = new THREE.Mesh(skirtGeo, glazing);
    skirt.name = 'C3_EsplanadeGlazedSkirt';
    skirt.scale.set(rx, base - 3.5, rz); skirt.position.y = (base + 3.5) / 2;
    dome.add(skirt);
    const columns = new THREE.InstancedMesh(columnGeo, frameMat, 48);
    columns.name = 'C3_EsplanadeMullions';
    const matrix = new THREE.Matrix4(), dummy = new THREE.Object3D();
    for (let i = 0; i < 48; i++) {
      const phi = i / 48 * Math.PI * 2;
      dummy.position.set((rx + 0.04) * Math.cos(phi), (base + 3.5) / 2, (rz + 0.04) * Math.sin(phi));
      dummy.scale.set(1, base - 3.5, 1); dummy.updateMatrix(); matrix.copy(dummy.matrix); columns.setMatrixAt(i, matrix);
    }
    columns.instanceMatrix.needsUpdate = true; columns.computeBoundingSphere(); dome.add(columns);
    const positions: number[] = [];
    const normalAt = (p: THREE.Vector3) => new THREE.Vector3(p.x / (rx * rx), (p.y - base) / (rh * rh), p.z / (rz * rz)).normalize();
    const surface = (theta: number, phi: number) => new THREE.Vector3(rx * Math.sin(theta) * Math.cos(phi), base + rh * Math.cos(theta), rz * Math.sin(theta) * Math.sin(phi));
    const project = (p: THREE.Vector3) => {
      const q = new THREE.Vector3(p.x / rx, (p.y - base) / rh, p.z / rz).normalize();
      const out = new THREE.Vector3(q.x * rx, base + q.y * rh, q.z * rz);
      return out.addScaledVector(normalAt(out), 0.065);
    };
    const addFace = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
      const center = a.clone().add(b).add(c).multiplyScalar(1 / 3);
      const face = b.clone().sub(a).cross(c.clone().sub(a));
      if (face.dot(normalAt(center)) < 0) [b, c] = [c, b];
      positions.push(...a.toArray(), ...b.toArray(), ...c.toArray());
    };
    const addPanel = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
      if (b.clone().sub(a).cross(c.clone().sub(a)).lengthSq() < 1e-9) return;
      const center = a.clone().add(b).add(c).multiplyScalar(1 / 3);
      const edge = [a, b, c].map(p => project(p.clone().sub(center).multiplyScalar(0.91).add(center)));
      const tip = project(center).addScaledVector(normalAt(project(center)), 0.34);
      addFace(edge[0], edge[1], tip); addFace(edge[1], edge[2], tip); addFace(edge[2], edge[0], tip);
      panelCount++;
    };
    // Three folded faces per leaf; gaps reveal a separate, recessed glass shell.
    for (let row = 0; row < 14; row++) for (let col = 0; col < 48; col++) {
      const t0 = row / 14 * Math.PI / 2, t1 = (row + 1) / 14 * Math.PI / 2;
      const p0 = col / 48 * Math.PI * 2, p1 = (col + 1) / 48 * Math.PI * 2;
      const a = surface(t0, p0), b = surface(t1, p0), c = surface(t1, p1), d = surface(t0, p1);
      addPanel(a, b, c); addPanel(a, c, d);
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.computeVertexNormals(); geo.computeBoundingBox(); geo.computeBoundingSphere();
    const shades = new THREE.Mesh(geo, cladding);
    shades.name = 'C3_EsplanadeSunshades'; shades.castShadow = false; shades.receiveShadow = true;
    shades.userData.c3Ellipsoid = { rx, rz, rh, base };
    dome.add(shades); root.add(dome);
  }
  root.userData.c3SunshadeCount = panelCount;
  root.updateMatrixWorld(true);
  return root;
}
