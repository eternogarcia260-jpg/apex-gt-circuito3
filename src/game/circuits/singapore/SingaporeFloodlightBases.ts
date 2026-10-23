import * as THREE from 'three';

function createFloodlightConcreteMaterial(base: THREE.Material): THREE.MeshStandardMaterial {
  const material = base.clone() as THREE.MeshStandardMaterial;
  material.name = 'C3_FloodlightFootingWeatheredConcrete';
  material.color.set(0xffffff);
  material.roughness = 0.96;
  material.metalness = 0;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return material;
  const image = context.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x;
    const a = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    const b = Math.sin(x * 0.071 + Math.sin(y * 0.053) * 2.1) * 6;
    const c = Math.sin(x * 0.31 + y * 0.19) * 3;
    const v = THREE.MathUtils.clamp(145 + (a - Math.floor(a) - 0.5) * 22 + b + c, 95, 190);
    image.data[i * 4] = v * 0.97;
    image.data[i * 4 + 1] = v * 0.98;
    image.data[i * 4 + 2] = v;
    image.data[i * 4 + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 4;
  material.map = map;
  material.needsUpdate = true;
  return material;
}

/** Weather-exposed concrete plinth, steel footplate and anchor hardware for C3's existing poles. */
export function createC3FloodlightBases(poles: THREE.InstancedMesh, concreteMaterial: THREE.Material): THREE.Group {
  const bounds = new THREE.Box3().setFromBufferAttribute(poles.geometry.getAttribute('position') as THREE.BufferAttribute);
  const poleSize = bounds.getSize(new THREE.Vector3());
  const side = Math.max(poleSize.x, poleSize.z) * 1.25;
  const depth = 0.65;
  const group = new THREE.Group();
  group.name = 'C3_FloodlightFoundations';
  group.userData.c3NoShadow = true;
  const footingMaterial = createFloodlightConcreteMaterial(concreteMaterial);

  const plinths = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(side * 0.68, side * 0.82, depth, 8, 1, false),
    footingMaterial,
    poles.count,
  );
  plinths.name = 'C3_FloodlightConcreteBases';
  plinths.userData.c3NoShadow = true;
  plinths.receiveShadow = true;

  const plateMaterial = new THREE.MeshPhysicalMaterial({
    name: 'C3_GalvanizedAnchorFootplates',
    color: 0x68737a,
    metalness: 0.82,
    roughness: 0.43,
    clearcoat: 0.16,
    clearcoatRoughness: 0.45,
  });
  const plateSide = side * 0.76;
  const plateThickness = 0.095;
  const plates = new THREE.InstancedMesh(
    new THREE.BoxGeometry(plateSide, plateThickness, plateSide),
    plateMaterial,
    poles.count,
  );
  plates.name = 'C3_FloodlightSteelFootplates';
  plates.userData.c3NoShadow = true;

  const fastenerMaterial = new THREE.MeshStandardMaterial({
    name: 'C3_StainlessAnchorFasteners',
    color: 0xb0b9bd,
    metalness: 0.91,
    roughness: 0.28,
  });
  const boltGeometry = new THREE.CylinderGeometry(0.048, 0.048, 0.052, 6, 1, false);
  const bolts = new THREE.InstancedMesh(boltGeometry, fastenerMaterial, poles.count * 4);
  bolts.name = 'C3_FloodlightAnchorBolts';
  bolts.userData.c3NoShadow = true;
  const washerMaterial = new THREE.MeshPhysicalMaterial({
    name: 'C3_GalvanizedAnchorWashers', color: 0x929da2,
    metalness: 0.84, roughness: 0.42, clearcoat: 0.12, clearcoatRoughness: 0.52,
  });
  const washerGeometry = new THREE.CylinderGeometry(0.075, 0.075, 0.014, 12, 1, false);
  const washers = new THREE.InstancedMesh(washerGeometry, washerMaterial, poles.count * 4);
  washers.name = 'C3_FloodlightAnchorWashers';
  washers.userData.c3NoShadow = true;

  const pose = new THREE.Matrix4();
  const translation = new THREE.Matrix4();
  const rotation = new THREE.Matrix4();
  const boltAt = new THREE.Matrix4();
  const boltRot = new THREE.Matrix4();
  let boltIndex = 0;
  const boltInset = plateSide * 0.34;
  for (let i = 0; i < poles.count; i++) {
    poles.getMatrixAt(i, pose);

    // The concrete footing remains at exactly the former location: just above
    // the surrounding water surface, with most of its height submerged.
    translation.makeTranslation(0, bounds.min.y - depth / 2, 0);
    plinths.setMatrixAt(i, pose.clone().multiply(translation));

    translation.makeTranslation(0, bounds.min.y + plateThickness / 2 + 0.005, 0);
    plates.setMatrixAt(i, pose.clone().multiply(translation));

    const boltY = bounds.min.y + plateThickness + 0.005 + 0.019;
    for (const x of [-boltInset, boltInset]) for (const z of [-boltInset, boltInset]) {
      boltAt.makeTranslation(x, boltY, z);
      boltRot.makeRotationY(0);
      bolts.setMatrixAt(boltIndex++, pose.clone().multiply(boltAt).multiply(boltRot));
      const washerPose = new THREE.Matrix4().makeTranslation(x, bounds.min.y + plateThickness + 0.014, z);
      washers.setMatrixAt(boltIndex - 1, pose.clone().multiply(washerPose));
    }
  }
  for (const mesh of [plinths, plates, washers, bolts]) {
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
    group.add(mesh);
  }
  group.userData.c3MastCount = poles.count;
  return group;
}
