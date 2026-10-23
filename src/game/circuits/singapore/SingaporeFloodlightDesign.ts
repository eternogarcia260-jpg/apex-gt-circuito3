import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createC3FloodlightBases } from './SingaporeFloodlightBases';

type TrackPoint = { x: number; z: number };

export function createC3FloodlightSteelMaterial(): THREE.MeshPhysicalMaterial {
  const size = 512;
  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = albedoCanvas.height = size;
  const albedoContext = albedoCanvas.getContext('2d', { willReadFrequently: true })!;
  const albedo = albedoContext.createImageData(size, size);
  const height = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const index = y * size + x;
    const hash = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
    const grain = (hash - Math.floor(hash) - 0.5) * 11;
    const brush = Math.sin(x * 0.115 + Math.sin(y * 0.009) * 0.7) * 1.8;
    const pits = hash - Math.floor(hash) > 0.996 ? -15 : 0;
    const value = 154 + grain + brush + pits;
    albedo.data[index * 4] = value * 0.91;
    albedo.data[index * 4 + 1] = value * 0.98;
    albedo.data[index * 4 + 2] = value * 1.02;
    albedo.data[index * 4 + 3] = 255;
    height[index] = grain * 0.14 + brush * 0.20 + pits * 0.12;
  }
  albedoContext.putImageData(albedo, 0, 0);

  const normalCanvas = document.createElement('canvas');
  normalCanvas.width = normalCanvas.height = size;
  const normalContext = normalCanvas.getContext('2d', { willReadFrequently: true })!;
  const normal = normalContext.createImageData(size, size);
  const heightAt = (x: number, y: number) => height[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4;
    normal.data[i] = THREE.MathUtils.clamp(128 - (heightAt(x + 1, y) - heightAt(x - 1, y)) * 5, 0, 255);
    normal.data[i + 1] = THREE.MathUtils.clamp(128 - (heightAt(x, y + 1) - heightAt(x, y - 1)) * 5, 0, 255);
    normal.data[i + 2] = 254;
    normal.data[i + 3] = 255;
  }
  normalContext.putImageData(normal, 0, 0);

  const roughnessCanvas = document.createElement('canvas');
  roughnessCanvas.width = roughnessCanvas.height = size;
  const roughnessContext = roughnessCanvas.getContext('2d', { willReadFrequently: true })!;
  const roughness = roughnessContext.createImageData(size, size);
  for (let index = 0; index < size * size; index++) {
    const value = THREE.MathUtils.clamp(195 + height[index] * 7, 0, 255);
    const i = index * 4;
    roughness.data[i] = roughness.data[i + 1] = roughness.data[i + 2] = value;
    roughness.data[i + 3] = 255;
  }
  roughnessContext.putImageData(roughness, 0, 0);

  const texture = (canvas: HTMLCanvasElement, colorSpace?: THREE.ColorSpace) => {
    const map = new THREE.CanvasTexture(canvas);
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(1.5, 1.0);
    map.anisotropy = 8;
    if (colorSpace) map.colorSpace = colorSpace;
    return map;
  };
  return new THREE.MeshPhysicalMaterial({
    name: 'C3_WeatherproofPowderCoatedGalvanizedSteel',
    color: 0xffffff,
    map: texture(albedoCanvas, THREE.SRGBColorSpace),
    normalMap: texture(normalCanvas),
    roughnessMap: texture(roughnessCanvas),
    normalScale: new THREE.Vector2(0.17, 0.17),
    roughness: 0.58,
    metalness: 0.36,
    clearcoat: 0.12,
    clearcoatRoughness: 0.52,
  });
}

function addInstances(
  parent: THREE.Group,
  name: string,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  transforms: readonly THREE.Matrix4[],
  transparent = false,
): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geometry, material, transforms.length);
  mesh.name = name;
  mesh.userData.c3NoShadow = true;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  if (transparent) mesh.renderOrder = 2;
  transforms.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  parent.add(mesh);
  return mesh;
}

function localTransform(
  x: number,
  y: number,
  z: number,
  sx = 1,
  sy = 1,
  sz = 1,
  rotation?: THREE.Quaternion,
): THREE.Matrix4 {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    rotation ?? new THREE.Quaternion(),
    new THREE.Vector3(sx, sy, sz),
  );
}

function createC3GraphiteCoatMap(source: THREE.Texture | null): THREE.CanvasTexture {
  const image = source?.image as CanvasImageSource & { width?: number; height?: number } | undefined;
  const size = Math.min(1024, Math.max(512, image?.width ?? 1024));
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas 2D no disponible para el mapa PBR del cabezal');
  if (image) context.drawImage(image, 0, 0, size, size);
  const pixels = context.getImageData(0, 0, size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const index = y * size + x;
    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
    const grain = (n - Math.floor(n) - 0.5) * 5;
    const sourceLuma = 0.2126 * pixels.data[index * 4] + 0.7152 * pixels.data[index * 4 + 1] + 0.0722 * pixels.data[index * 4 + 2];
    const v = THREE.MathUtils.clamp(46 + sourceLuma * 0.72 + grain, 42, 184);
    pixels.data[index * 4] = v * 0.91;
    pixels.data[index * 4 + 1] = v * 0.98;
    pixels.data[index * 4 + 2] = v * 1.02;
    pixels.data[index * 4 + 3] = 255;
  }
  context.putImageData(pixels, 0, 0);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 8;
  map.needsUpdate = true;
  return map;
}

/** Repeated high-mast sports floodlights, with all optics aimed at the racing surface. */
export function buildC3FloodlightRig(
  points: readonly TrackPoint[],
  halfWidth: number,
  poleMaterial: THREE.MeshStandardMaterial,
  concreteMaterial: THREE.Material,
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'C3_HighMastStadiumFloodlights';

  const towerTransforms: THREE.Matrix4[] = [];
  const lowerCollarTransforms: THREE.Matrix4[] = [];
  const upperCollarTransforms: THREE.Matrix4[] = [];
  const armTransforms: THREE.Matrix4[] = [];
  const hingeTransforms: THREE.Matrix4[] = [];
  const headTransforms: THREE.Matrix4[] = [];
  const faceplateTransforms: THREE.Matrix4[] = [];
  const frontFrameTransforms: THREE.Matrix4[] = [];
  const reflectorTransforms: THREE.Matrix4[] = [];
  const bezelTransforms: THREE.Matrix4[] = [];
  const lensTransforms: THREE.Matrix4[] = [];
  const ledTransforms: THREE.Matrix4[] = [];
  const ledSubstrateTransforms: THREE.Matrix4[] = [];
  const opticFastenerTransforms: THREE.Matrix4[] = [];
  const screwTransforms: THREE.Matrix4[] = [];
  const finTransforms: THREE.Matrix4[] = [];
  const cabinetTransforms: THREE.Matrix4[] = [];
  const cabinetDoorTransforms: THREE.Matrix4[] = [];
  const cabinetHandleTransforms: THREE.Matrix4[] = [];
  const serviceConduitTransforms: THREE.Matrix4[] = [];
  const serviceConduitJunctionTransforms: THREE.Matrix4[] = [];

  const poleFrame = new THREE.Object3D();
  const aimedFrame = new THREE.Object3D();
  const source = new THREE.Vector3();
  const destination = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const boomUp = new THREE.Vector3(0, 1, 0);

  for (let i = 0; i < points.length; i += 6) {
    const p = points[i];
    const next = points[(i + 1) % points.length];
    const prev = points[(i - 1 + points.length) % points.length];
    const dx = next.x - prev.x;
    const dz = next.z - prev.z;
    const tangentLength = Math.hypot(dx, dz) || 1;
    const normX = -dz / tangentLength;
    const normZ = dx / tangentLength;
    const trackYaw = Math.atan2(dx, dz);

    for (const side of [-1, 1]) {
      const mastX = p.x + normX * (halfWidth + 4.2) * side;
      const mastZ = p.z + normZ * (halfWidth + 4.2) * side;

      poleFrame.position.set(mastX, 5.0, mastZ);
      poleFrame.rotation.set(0, trackYaw, 0);
      poleFrame.scale.set(1, 1, 1);
      poleFrame.updateMatrix();
      const poleMatrix = poleFrame.matrix.clone();
      towerTransforms.push(poleMatrix);

      // Two horizontal weather collars break up the uninterrupted pole shaft.
      const horizontalRing = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
      lowerCollarTransforms.push(poleMatrix.clone().multiply(localTransform(0, -4.42, 0, 1, 1, 1, horizontalRing)));
      upperCollarTransforms.push(poleMatrix.clone().multiply(localTransform(0, 4.54, 0, 1, 1, 1, horizontalRing)));

      const targetX = p.x - normX * (halfWidth * 0.32) * side + (dx / tangentLength) * 13;
      const targetZ = p.z - normZ * (halfWidth * 0.32) * side + (dz / tangentLength) * 13;
      source.set(mastX, 10.05, mastZ);
      destination.set(targetX, 0.05, targetZ);
      direction.subVectors(destination, source).normalize();
      const headPosition = source.clone().add(new THREE.Vector3(normX * -side * 2.8, 0, normZ * -side * 2.8));

      const boomDirection = headPosition.clone().sub(source).normalize();
      const boomRotation = new THREE.Quaternion().setFromUnitVectors(boomUp, boomDirection);
      const boomLength = source.distanceTo(headPosition);
      const boomCenter = source.clone().add(headPosition).multiplyScalar(0.5);
      armTransforms.push(new THREE.Matrix4().compose(boomCenter, boomRotation, new THREE.Vector3(1, boomLength, 1)));

      aimedFrame.position.copy(headPosition);
      aimedFrame.lookAt(targetX, 0.05, targetZ);
      aimedFrame.scale.set(1, 1, 1);
      aimedFrame.updateMatrix();
      const aimMatrix = aimedFrame.matrix.clone();
      headTransforms.push(aimMatrix);

      // Paired die-cast pivot trunnions and a compact rear adjustment yoke.
      const pivotRotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
      for (const x of [-0.74, 0.74]) {
        hingeTransforms.push(aimMatrix.clone().multiply(localTransform(x, 0, -0.225, 1, 1, 1, pivotRotation)));
      }

      // The gasket backing and heat-sink fins are both positioned from the
      // same aim frame; no variation can rotate an optical face away from track.
      faceplateTransforms.push(aimMatrix.clone().multiply(localTransform(0, 0, 0.218)));
      frontFrameTransforms.push(
        aimMatrix.clone().multiply(localTransform(0, -0.452, 0.243, 0.92, 0.035, 0.028)),
        aimMatrix.clone().multiply(localTransform(0, 0.452, 0.243, 0.92, 0.035, 0.028)),
        aimMatrix.clone().multiply(localTransform(-0.95, 0, 0.243, 0.035, 0.86, 0.028)),
        aimMatrix.clone().multiply(localTransform(0.95, 0, 0.243, 0.035, 0.86, 0.028)),
      );
      for (let fin = 0; fin < 7; fin++) {
        finTransforms.push(aimMatrix.clone().multiply(localTransform(0, (fin - 3) * 0.112, -0.44)));
      }
      for (const x of [-0.9, 0.9]) for (const y of [-0.37, 0.37]) {
        const screwRotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
        screwTransforms.push(aimMatrix.clone().multiply(localTransform(x, y, 0.26, 1, 1, 1, screwRotation)));
      }

      for (let row = 0; row < 3; row++) for (let col = 0; col < 7; col++) {
        const x = (col - 3) * 0.235;
        const y = (1 - row) * 0.245;
        const cupRotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
        reflectorTransforms.push(aimMatrix.clone().multiply(localTransform(x, y, 0.274, 1, 1, 1, cupRotation)));
        bezelTransforms.push(aimMatrix.clone().multiply(localTransform(x, y, 0.328)));
        lensTransforms.push(aimMatrix.clone().multiply(localTransform(x, y, 0.333, 0.071, 0.071, 0.033)));
        ledSubstrateTransforms.push(aimMatrix.clone().multiply(localTransform(x, y, 0.289, 0.082, 0.082, 0.014)));
        ledTransforms.push(aimMatrix.clone().multiply(localTransform(x, y, 0.34, 0.014, 0.014, 0.006)));
        const opticScrewRotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
        for (const yOffset of [-0.054, 0.054]) {
          opticFastenerTransforms.push(aimMatrix.clone().multiply(localTransform(x, y + yOffset, 0.337, 1, 1, 1, opticScrewRotation)));
        }
      }

      // Sealed low-voltage service cabinet, access-door inset and latch at the
      // same relative side of every mast; one instanced draw per detail class.
      cabinetTransforms.push(poleMatrix.clone().multiply(localTransform(0.47, -3.65, 0)));
      const outwardDoor = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
      cabinetDoorTransforms.push(poleMatrix.clone().multiply(localTransform(0.665, -3.65, 0, 1, 1, 1, outwardDoor)));
      cabinetHandleTransforms.push(poleMatrix.clone().multiply(localTransform(0.677, -3.65, 0.095)));
      const mastHalfHeight = 5;
      const baseRadius = 0.46;
      const tipRadius = 0.245;
      const cableRadius = 0.035;
      for (const y of [-4, -2, 0, 2, 4]) {
        const radius = baseRadius - ((y + mastHalfHeight) / (2 * mastHalfHeight)) * (baseRadius - tipRadius);
        serviceConduitTransforms.push(poleMatrix.clone().multiply(localTransform(0, y, radius + cableRadius * 0.45, 1, 2.04, 1)));
      }
      for (const y of [-3.65, 0, 3.65]) {
        const radius = baseRadius - ((y + mastHalfHeight) / (2 * mastHalfHeight)) * (baseRadius - tipRadius);
        serviceConduitJunctionTransforms.push(poleMatrix.clone().multiply(localTransform(0, y, radius + 0.042, 1, 1, 1)));
      }
    }
  }

  // Metallic housings share the pole's physically textured finish; critical
  // for keeping the paint/metal response coherent from footplate to optic.
  const housingMaterial = poleMaterial.clone() as THREE.MeshPhysicalMaterial;
  housingMaterial.name = 'C3_DieCastGraphiteFloodlightHousing';
  housingMaterial.color.set(0xffffff);
  // Graphite powder-coat is a dielectric surface over cast aluminium, not a
  // bare mirror metal; this keeps the body readable under the night lighting.
  housingMaterial.metalness = 0.08;
  housingMaterial.roughness = 0.34;
  housingMaterial.clearcoat = 0.48;
  housingMaterial.clearcoatRoughness = 0.19;
  housingMaterial.normalScale.set(0.08, 0.08);

  const poleGeometry = new THREE.CylinderGeometry(0.245, 0.46, 10.0, 20, 6, false);
  const poles = addInstances(group, 'C3_FloodlightMasts', poleGeometry, poleMaterial, towerTransforms);
  group.add(createC3FloodlightBases(poles, concreteMaterial));
  const conduitMaterial = new THREE.MeshPhysicalMaterial({
    name: 'C3_WeatherSealedPowerRaceway', color: 0x343c40, metalness: 0.62, roughness: 0.48,
    clearcoat: 0.12, clearcoatRoughness: 0.5,
  });
  const conduitGeometry = new THREE.CylinderGeometry(0.032, 0.032, 1, 12, 1, false);
  addInstances(group, 'C3_FloodlightServiceConduits', conduitGeometry, conduitMaterial, serviceConduitTransforms);
  addInstances(group, 'C3_FloodlightConduitJunctions', new THREE.CylinderGeometry(0.047, 0.047, 0.075, 12, 1, false), conduitMaterial, serviceConduitJunctionTransforms);

  const collarMaterial = new THREE.MeshPhysicalMaterial({
    name: 'C3_ClampedMastCollars', color: 0x606b71, metalness: 0.78, roughness: 0.39,
    clearcoat: 0.18, clearcoatRoughness: 0.46,
  });
  addInstances(group, 'C3_FloodlightLowerWeatherCollars', new THREE.TorusGeometry(0.448, 0.025, 8, 28), collarMaterial, lowerCollarTransforms);
  addInstances(group, 'C3_FloodlightUpperWeatherCollars', new THREE.TorusGeometry(0.238, 0.018, 8, 24), collarMaterial, upperCollarTransforms);

  const armMaterial = poleMaterial.clone();
  armMaterial.name = 'C3_GalvanizedFloodlightCantilevers';
  armMaterial.color.set(0xffffff);
  armMaterial.metalness = 0.78;
  armMaterial.roughness = 0.4;
  addInstances(group, 'C3_FloodlightCantilevers', new THREE.CylinderGeometry(0.085, 0.12, 1, 16, 1, false), armMaterial, armTransforms);

  const headShape = new THREE.Shape();
  headShape.moveTo(-0.88, -0.49); headShape.lineTo(0.88, -0.49);
  headShape.quadraticCurveTo(1.02, -0.49, 1.02, -0.35);
  headShape.lineTo(1.02, 0.35); headShape.quadraticCurveTo(1.02, 0.49, 0.88, 0.49);
  headShape.lineTo(-0.88, 0.49); headShape.quadraticCurveTo(-1.02, 0.49, -1.02, 0.35);
  headShape.lineTo(-1.02, -0.35); headShape.quadraticCurveTo(-1.02, -0.49, -0.88, -0.49);
  const headGeometry = new THREE.ExtrudeGeometry(headShape, {
    depth: 0.42, steps: 1, bevelEnabled: true, bevelSegments: 4,
    bevelSize: 0.055, bevelThickness: 0.055,
  });
  headGeometry.translate(0, 0, -0.21);
  headGeometry.computeVertexNormals();
  addInstances(group, 'C3_FloodlightDieCastBodies', headGeometry, housingMaterial, headTransforms);

  const plateMaterial = new THREE.MeshPhysicalMaterial({
    name: 'C3_BlackAnodizedOpticalGasket', color: 0x202930, metalness: 0.48, roughness: 0.52,
    clearcoat: 0.22, clearcoatRoughness: 0.39,
  });
  addInstances(group, 'C3_FloodlightOpticalGaskets', new THREE.BoxGeometry(1.91, 0.88, 0.045), plateMaterial, faceplateTransforms);
  const frontFrameMaterial = new THREE.MeshPhysicalMaterial({
    name: 'C3_MachinedOpticFrontPerimeter', color: 0x8f9ba2,
    metalness: 0.88, roughness: 0.24, clearcoat: 0.54, clearcoatRoughness: 0.18,
  });
  addInstances(group, 'C3_FloodlightMachinedFrontFrame', new THREE.BoxGeometry(1, 1, 1), frontFrameMaterial, frontFrameTransforms);

  const finMaterial = housingMaterial.clone();
  finMaterial.name = 'C3_AluminiumHeatSinkFins';
  finMaterial.map = null;
  finMaterial.normalMap = null;
  finMaterial.roughnessMap = null;
  finMaterial.color.set(0x8b969c);
  finMaterial.metalness = 0.78;
  finMaterial.roughness = 0.46;
  addInstances(group, 'C3_FloodlightHeatSinkFins', new THREE.BoxGeometry(1.72, 0.052, 0.28), finMaterial, finTransforms);

  const pivotMaterial = new THREE.MeshPhysicalMaterial({
    name: 'C3_FloodlightTrunnionHardware', color: 0x758087, metalness: 0.84, roughness: 0.34,
    clearcoat: 0.16, clearcoatRoughness: 0.4,
  });
  addInstances(group, 'C3_FloodlightTrunnionPivots', new THREE.CylinderGeometry(0.085, 0.085, 0.10, 16, 1, false), pivotMaterial, hingeTransforms);

  const reflectorMaterial = new THREE.MeshPhysicalMaterial({
    name: 'C3_MetalizedSecondaryOpticReflectors', color: 0xc2cbd0,
    metalness: 0.94, roughness: 0.16, clearcoat: 0.44, clearcoatRoughness: 0.18,
    side: THREE.DoubleSide,
  });
  addInstances(
    group,
    'C3_FloodlightIndividualReflectorCups',
    new THREE.CylinderGeometry(0.066, 0.087, 0.11, 20, 1, true),
    reflectorMaterial,
    reflectorTransforms,
  );

  const bezelMaterial = new THREE.MeshPhysicalMaterial({
    name: 'C3_IndividualOpticBezels', color: 0x9ba6ad,
    metalness: 0.88, roughness: 0.22, clearcoat: 0.58, clearcoatRoughness: 0.16,
  });
  addInstances(group, 'C3_FloodlightOpticRetainingRings', new THREE.TorusGeometry(0.069, 0.009, 8, 24), bezelMaterial, bezelTransforms);

  const glassMaterial = new THREE.MeshPhysicalMaterial({
    name: 'C3_SealedConvexLEDOpticGlass', color: 0xd8eaf4,
    metalness: 0.01, roughness: 0.075, clearcoat: 1.0, clearcoatRoughness: 0.025,
    transparent: true, opacity: 0.23, depthWrite: false, side: THREE.DoubleSide,
  });
  addInstances(group, 'C3_FloodlightConvexOpticLenses', new THREE.SphereGeometry(1, 18, 12), glassMaterial, lensTransforms, true);

  const substrateMaterial = new THREE.MeshPhysicalMaterial({
    name: 'C3_CeramicLEDSubstrates', color: 0x77736c,
    metalness: 0.32, roughness: 0.49, clearcoat: 0.12, clearcoatRoughness: 0.4,
  });
  addInstances(group, 'C3_FloodlightLEDSubstrates', new THREE.BoxGeometry(1, 1, 1), substrateMaterial, ledSubstrateTransforms);

  const emitterMaterial = new THREE.MeshStandardMaterial({
    name: 'C3_CeramicWarmWhiteLEDEmitters', color: 0xfff4dc,
    emissive: 0x000000, emissiveIntensity: 0, roughness: 0.42, metalness: 0.01,
  });
  addInstances(group, 'C3_FloodlightIndividualLEDChips', new THREE.BoxGeometry(1, 1, 1), emitterMaterial, ledTransforms);

  const screwMaterial = new THREE.MeshStandardMaterial({
    name: 'C3_FloodlightStainlessOpticFasteners', color: 0xb8c0c3, metalness: 0.92, roughness: 0.26,
  });
  addInstances(group, 'C3_FloodlightOpticRetainingScrews', new THREE.CylinderGeometry(0.019, 0.019, 0.014, 6, 1, false), screwMaterial, screwTransforms);
  addInstances(group, 'C3_FloodlightOpticMicroFasteners', new THREE.CylinderGeometry(0.006, 0.006, 0.008, 6, 1, false), screwMaterial, opticFastenerTransforms);

  const cabinetMaterial = housingMaterial.clone();
  cabinetMaterial.name = 'C3_WeatherproofMastElectricalEnclosures';
  const cabinetGeometry = new THREE.BoxGeometry(0.39, 0.56, 0.19);
  addInstances(group, 'C3_FloodlightMastServiceCabinets', cabinetGeometry, cabinetMaterial, cabinetTransforms);
  const cabinetDoorMaterial = new THREE.MeshPhysicalMaterial({
    name: 'C3_EnamelledElectricalAccessDoors', color: 0x333e45,
    metalness: 0.62, roughness: 0.43, clearcoat: 0.15, clearcoatRoughness: 0.4,
  });
  addInstances(group, 'C3_FloodlightCabinetAccessDoors', new THREE.BoxGeometry(0.30, 0.38, 0.012), cabinetDoorMaterial, cabinetDoorTransforms);
  const latchMaterial = new THREE.MeshStandardMaterial({
    name: 'C3_EnclosureSteelLatches', color: 0xaab3b7, metalness: 0.9, roughness: 0.27,
  });
  addInstances(group, 'C3_FloodlightCabinetLatchHandles', new THREE.BoxGeometry(0.018, 0.082, 0.025), latchMaterial, cabinetHandleTransforms);

  group.userData.c3FloodlightDesign = {
    fixtureCount: headTransforms.length,
    sealedOpticCount: reflectorTransforms.length,
    ledChipCount: ledTransforms.length,
    direction: 'all 21 optics aimed toward racing-surface center and forward tangent',
    mounting: 'fixed die-cast trunnions, galvanized cantilevers and weatherproof service cabinets',
    materials: 'procedural brushed galvanized steel, coated die-cast aluminum, metalized reflectors, convex coated glass',
    dynamicLightCount: 0,
  };

  // Swap the hand-built optical block for the textured, image-derived PBR
  // housing as soon as it arrives. The complete procedural assembly remains
  // visible until then, and also remains the runtime fallback on load failure.
  const modelUrl = `${import.meta.env.BASE_URL}models/c3-stadium-led-floodlight-pbr.glb`;
  void new GLTFLoader().loadAsync(modelUrl).then((asset) => {
    const source = asset.scene.getObjectByProperty('isMesh', true) as THREE.Mesh | undefined;
    if (!source) throw new Error('GLB de faro sin malla visible');
    asset.scene.updateMatrixWorld(true);

    const geometry = source.geometry.clone();
    geometry.applyMatrix4(source.matrixWorld);
    const sourceBounds = new THREE.Box3().setFromBufferAttribute(geometry.getAttribute('position') as THREE.BufferAttribute);
    const sourceSize = sourceBounds.getSize(new THREE.Vector3());
    const center = sourceBounds.getCenter(new THREE.Vector3());
    const largestAxis = Math.max(sourceSize.x, sourceSize.y, sourceSize.z);
    if (!Number.isFinite(largestAxis) || largestAxis < 1e-4) throw new Error('Dimensiones GLB no válidas');

    geometry.translate(-center.x, -center.y, -center.z);
    geometry.rotateY(-Math.PI / 2);
    const scale = 2.04 / largestAxis;
    geometry.scale(scale, scale, scale);
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    const importedMaterial = Array.isArray(source.material) ? source.material[0] : source.material;
    const material = importedMaterial.clone() as THREE.MeshPhysicalMaterial;
    const bakedColorMap = material.map;
    const bakedMetalnessMap = material.metalnessMap;
    const bakedRoughnessMap = material.roughnessMap;
    material.map = createC3GraphiteCoatMap(bakedColorMap);
    material.metalnessMap = null;
    material.roughnessMap = null;
    material.color.set(0xffffff);
    material.metalness = 0.16;
    material.roughness = 0.62;
    material.normalScale.set(0.22, 0.22);
    material.emissive.set(0x000000);
    material.emissiveIntensity = 0;
    material.emissiveMap = null;
    if ('clearcoat' in material) {
      material.clearcoat = 0.16;
      material.clearcoatRoughness = 0.48;
    }
    bakedColorMap?.dispose();
    bakedMetalnessMap?.dispose();
    bakedRoughnessMap?.dispose();

    // The complete 218-head array spanned the whole 4.9 km circuit, so its
    // single bounding sphere defeated frustum culling in both camera and mirror.
    // Spatial batches retain every exact transform/material/triangle while
    // allowing off-screen sections to be culled independently.
    const headsPerBatch = 8;
    let headBatchCount = 0;
    for (let start = 0; start < headTransforms.length; start += headsPerBatch) {
      const batchTransforms = headTransforms.slice(start, start + headsPerBatch);
      const name = headBatchCount === 0 ? 'C3_FloodlightGeneratedPBRHeads' :
        `C3_FloodlightGeneratedPBRHeads_${String(headBatchCount).padStart(2, '0')}`;
      const generatedHeads = new THREE.InstancedMesh(geometry, material, batchTransforms.length);
      generatedHeads.name = name;
      generatedHeads.userData.c3NoShadow = true;
      generatedHeads.castShadow = false;
      generatedHeads.receiveShadow = false;
      batchTransforms.forEach((matrix, index) => generatedHeads.setMatrixAt(index, matrix));
      generatedHeads.instanceMatrix.needsUpdate = true;
      generatedHeads.computeBoundingBox();
      generatedHeads.computeBoundingSphere();
      group.add(generatedHeads);
      headBatchCount++;
    }

    const supersededNames = [
      'C3_FloodlightDieCastBodies', 'C3_FloodlightOpticalGaskets', 'C3_FloodlightMachinedFrontFrame',
      'C3_FloodlightTrunnionPivots', 'C3_FloodlightIndividualReflectorCups',
      'C3_FloodlightOpticRetainingRings', 'C3_FloodlightConvexOpticLenses', 'C3_FloodlightLEDSubstrates',
      'C3_FloodlightOpticRetainingScrews', 'C3_FloodlightOpticMicroFasteners',
    ];
    for (const name of supersededNames) {
      const oldMesh = group.getObjectByName(name);
      if (!(oldMesh instanceof THREE.Mesh)) continue;
      group.remove(oldMesh);
      oldMesh.geometry.dispose();
    }
    group.userData.c3FloodlightDesign.assetState = 'photorealistic PBR GLB loaded';
    group.userData.c3FloodlightDesign.headMeshCount = headTransforms.length;
    group.userData.c3FloodlightDesign.headBatchCount = headBatchCount;
    group.userData.c3FloodlightDesign.sourceAsset = modelUrl;
  }).catch((error: unknown) => {
    group.userData.c3FloodlightDesign.assetState = 'procedural fallback retained';
    console.warn('[C3 Floodlights] No se pudo cargar el cabezal PBR; se conserva el rig procedural.', error);
  });
  return group;
}
