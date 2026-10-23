import * as THREE from 'three';

/** Static, bounded garage-front LOD in C3_PitComplex local coordinates. */
export function createC3PitArchitecture(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'C3_PitArchitecture';
  const paint = new THREE.MeshStandardMaterial({ color: 0x687078, metalness: 0, roughness: 0.76 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x252d33, metalness: 0, roughness: 0.82 });
  const trim = new THREE.MeshStandardMaterial({ color: 0xb8bec1, metalness: 0, roughness: 0.68 });
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0x454e55, metalness: 0, roughness: 0.78 });
  const glow = new THREE.MeshStandardMaterial({ color: 0xb2aba0, emissive: 0xc7b998, emissiveIntensity: 0.25, metalness: 0, roughness: 0.8 });
  paint.name='C3_PitFramePaint';dark.name='C3_PitShutterPaint';trim.name='C3_PitTrimPaint';canopyMat.name='C3_PitCanopyPaint';glow.name='C3_PitCanopyEmission';
  // Use all six closed faces, with separate flat normals at every edge.
  const unit = new THREE.BoxGeometry(1, 1, 1);
  type Box = [number, number, number, number, number, number];
  function instances(name: string, material: THREE.Material, boxes: Box[]): void {
    const mesh = new THREE.InstancedMesh(unit, material, boxes.length);
    mesh.name = name;
    mesh.userData.c3NoShadow = name !== 'C3_PitCanopy';
    mesh.castShadow = !mesh.userData.c3NoShadow;
    mesh.receiveShadow = true;
    const dummy = new THREE.Object3D();
    boxes.forEach(([x,y,z,sx,sy,sz], i) => {
      dummy.position.set(x,y,z);dummy.scale.set(sx,sy,sz);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingBox();mesh.computeBoundingSphere();
    root.add(mesh);
  }
  const doors: Box[] = [], ribs: Box[] = [], frames: Box[] = [];
  const mullions: Box[] = [], panels: Box[] = [], canopy: Box[] = [];
  for (let g=0; g<12; g++) {
    const z=-75+g*13.5;
    doors.push([-18.86,2.05,z,0.22,3.72,12.45]);
    for (let row=0;row<12;row++) ribs.push([-18.72,0.45+row*0.29,z,0.12,0.055,12.15]);
    frames.push([-18.68,2.05,z-6.27,0.14,4.05,0.16],[-18.68,2.05,z+6.27,0.14,4.05,0.16]);
    mullions.push([-18.82,7.8,z,0.20,3.65,0.18]);
    canopy.push([-18.27,4.52,z,1.54,0.24,12.9]);
    panels.push([-18.25,4.375,z,1.45,0.045,11.9]);
  }
  instances('C3_PitGarageDoors',dark,doors);
  instances('C3_PitDoorRibs',trim,ribs);
  instances('C3_PitDoorFrames',paint,frames);
  instances('C3_PitHospitalityMullions',trim,mullions);
  instances('C3_PitCanopy',canopyMat,canopy);
  instances('C3_PitCanopyPanels',glow,panels);
  root.userData.summary = { garageDoors:12, ribsPerDoor:12, canopyPanels:12, static:true };
  return root;
}
