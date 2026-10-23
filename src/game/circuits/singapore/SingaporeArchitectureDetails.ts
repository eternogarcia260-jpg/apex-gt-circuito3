import * as THREE from 'three';

/** Small architectural dressing for the already-built Marina Bay Sands landmark. */
export function decorateMarinaBaySands(group: THREE.Group): void {
  const details = new THREE.Group();
  details.name = 'C3_MBS_ArchitectureDetails';
  const warm = new THREE.MeshStandardMaterial({ color: 0xffc978, emissive: 0x8b4b13, emissiveIntensity: 0.62, roughness: 0.38, metalness: 0.08 });
  const cool = new THREE.MeshStandardMaterial({ color: 0x9ab4c1, roughness: 0.42, metalness: 0.32 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x687982, roughness: 0.58, metalness: 0.3 });
  let seed = 0x4d4253;
  const random = (): number => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const dummy = new THREE.Object3D();
  const front: THREE.Matrix4[] = [], back: THREE.Matrix4[] = [], fins: THREE.Matrix4[] = [], cornices: THREE.Matrix4[] = [];
  const windowGeo = new THREE.BoxGeometry(1.5, 2.15, 0.24);
  const towerCenters = [-75, 0, 75];
  for (let tower = 0; tower < towerCenters.length; tower++) {
    const x = towerCenters[tower]; const z = tower === 1 ? -8 : 0;
    // Repeated panes on both broad façades.
    for (let row = 0; row < 28; row++) for (let col = 0; col < 12; col++) {
      if (random() < 0.30) continue;
      const px = x - 18.2 + col * 3.3, py = 5.0 + row * 5.95;
      dummy.position.set(px, py, z + 13.91); dummy.scale.set(1, 1, 1); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); front.push(dummy.matrix.clone());
      dummy.position.set(px, py, z - 13.91); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); back.push(dummy.matrix.clone());
    }
    // Vertical mullions and two crown/belt lines, batched across all towers.
    for (let i = 0; i <= 10; i++) {
      dummy.position.set(x - 20.5 + i * 4.1, 87.5, z + 13.93); dummy.scale.set(1, 1, 1); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); fins.push(dummy.matrix.clone());
    }
    for (const y of [170.2, 8.0]) {
      dummy.position.set(x, y, z); dummy.scale.set(45.8, y > 100 ? 0.55 : 0.5, 26.5); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); cornices.push(dummy.matrix.clone());
    }
  }
  const addInstances = (name: string, geo: THREE.BufferGeometry, material: THREE.Material, matrices: THREE.Matrix4[]) => {
    const mesh = new THREE.InstancedMesh(geo, material, matrices.length); mesh.name = name;
    matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix)); mesh.instanceMatrix.needsUpdate = true; details.add(mesh);
  };
  addInstances('C3_MBS_Windows_Front', windowGeo, warm, front);
  addInstances('C3_MBS_Windows_Back', windowGeo, warm, back);
  addInstances('C3_MBS_Fins', new THREE.BoxGeometry(0.22, 166, 0.38), cool, fins);
  addInstances('C3_MBS_Cornices', new THREE.BoxGeometry(1, 1, 1), trim, cornices);
  group.add(details);
}

/** Dress existing Raffles Place tower boxes in their local group coordinates. */
export function decorateRafflesSkyline(group: THREE.Group, towers: readonly { x: number; z: number; w: number; d: number; h: number }[]): void {
  const details = new THREE.Group(); details.name = 'C3_Raffles_ArchitectureDetails';
  const glass = new THREE.MeshStandardMaterial({ color: 0xffcf8b, emissive: 0x78431b, emissiveIntensity: 0.58, roughness: 0.4, metalness: 0.14 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x77858a, roughness: 0.52, metalness: 0.35 });
  const finMat = new THREE.MeshStandardMaterial({ color: 0x91a2a6, roughness: 0.4, metalness: 0.42 });
  let seed = 0x524146; const random = (): number => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const inst: THREE.Matrix4[] = [], fins: THREE.Matrix4[] = [], bands: THREE.Matrix4[] = [];
  const dummy = new THREE.Object3D();
  for (const t of towers) {
    const floors = Math.max(1, Math.floor(t.h / 6.2));
    const cols = Math.max(2, Math.floor(t.w / 4.5));
    const paneW = Math.min(2.1, t.w / cols * 0.68);
    const paneH = Math.min(2.65, 6.2 * 0.58);
    // Front/back façades.
    for (const side of [-1, 1]) for (let row = 0; row < floors; row++) for (let col = 0; col < cols; col++) {
      if (random() < 0.38) continue;
      const x = t.x - t.w / 2 + (col + 0.5) * t.w / cols;
      const y = 3.5 + row * 6.2;
      dummy.position.set(x, y, t.z + side * (t.d / 2 + 0.19)); dummy.rotation.set(0, 0, 0); dummy.scale.set(paneW / 2, paneH / 2.65, 1); dummy.updateMatrix(); inst.push(dummy.matrix.clone());
    }
    // End façades independently: occupancy is sampled once per side/row/column.
    const sideCols = Math.max(2, Math.floor(t.d / 4.5));
    for (const side of [-1, 1]) for (let row = 0; row < floors; row++) for (let sideCol = 0; sideCol < sideCols; sideCol++) {
      if (random() < 0.38) continue;
      const y = 3.5 + row * 6.2;
      const z = t.z - t.d / 2 + (sideCol + 0.5) * t.d / sideCols;
      dummy.position.set(t.x + side * (t.w / 2 + 0.19), y, z); dummy.rotation.set(0, side * Math.PI / 2, 0);
      dummy.scale.set(Math.min(2.1, t.d / sideCols * 0.68) / 2, paneH / 2.65, 1); dummy.updateMatrix(); inst.push(dummy.matrix.clone());
    }
    const finCount = Math.max(1, Math.floor(t.w / 9));
    for (let i = 0; i <= finCount; i++) {
      dummy.position.set(t.x - t.w / 2 + i * t.w / finCount, t.h / 2, t.z + t.d / 2 + 0.22); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, t.h - 1, 1); dummy.updateMatrix(); fins.push(dummy.matrix.clone());
    }
    for (const [y, w, d, h] of [[t.h - 0.15, t.w + 1.3, t.d + 1.3, 0.6], [t.h * 0.67, t.w + 0.45, t.d + 0.45, 0.26]]) {
      dummy.position.set(t.x, y, t.z); dummy.scale.set(w, h, d); dummy.updateMatrix(); bands.push(dummy.matrix.clone());
    }
  }
  const paneGeo = new THREE.BoxGeometry(2, 2.65, 0.18);
  const panes = new THREE.InstancedMesh(paneGeo, glass, inst.length); panes.name = 'C3_Raffles_WarmWindows';
  inst.forEach((matrix, i) => panes.setMatrixAt(i, matrix)); panes.instanceMatrix.needsUpdate = true; details.add(panes);
  const finMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.18, 1, 0.28), finMat, fins.length); finMesh.name = 'C3_Raffles_Fins';
  fins.forEach((matrix, i) => finMesh.setMatrixAt(i, matrix)); finMesh.instanceMatrix.needsUpdate = true; details.add(finMesh);
  const bandMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), trim, bands.length); bandMesh.name = 'C3_Raffles_Cornices_Belts';
  bands.forEach((matrix, i) => bandMesh.setMatrixAt(i, matrix)); bandMesh.instanceMatrix.needsUpdate = true; details.add(bandMesh);
  group.add(details);
}
