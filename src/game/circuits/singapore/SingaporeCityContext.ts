import * as THREE from 'three';
import { createC3BayQuay } from './SingaporeBayQuay';
import { createC3RiverChannel } from './SingaporeRiverChannel';
import { createC3CityRoofDetails } from './SingaporeCityRoofDetails';

/** Visual-only ground and distant urban dressing. It deliberately creates no physics bodies. */
export function buildSingaporeCityContext(points: readonly { x: number; z: number }[]): THREE.Group {
  const root = new THREE.Group();
  root.name = 'C3_SingaporeCityContext';

  const bay: Array<[number, number]> = [
    [-470, 210], [-380, 120], [-170, 140], [60, 155], [350, 175], [500, 255],
    [560, 400], [475, 510], [330, 500], [80, 620], [-190, 690], [-460, 600], [-520, 430],
  ];
  const river = createC3RiverChannel(bay, points);
  const groundBay = river.contour;
  const shape = new THREE.Shape();
  shape.moveTo(-1800, 1400);
  shape.lineTo(1800, 1400); shape.lineTo(1800, -1400); shape.lineTo(-1800, -1400); shape.closePath();
  const hole = new THREE.Path();
  // Shape XY -> world XZ via -90° X rotation; invert the input Z to preserve world Z.
  hole.moveTo(groundBay[0][0], -groundBay[0][1]);
  for (let i = 1; i < groundBay.length; i++) hole.lineTo(groundBay[i][0], -groundBay[i][1]);
  hole.closePath(); shape.holes.push(hole);
  const groundGeo = new THREE.ShapeGeometry(shape, 1);
  groundGeo.computeVertexNormals();
  const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({
    name: 'C3_UrbanGroundMaterial', color: 0x343a40, roughness: 0.96, metalness: 0.02, side: THREE.DoubleSide,
  }));
  ground.name = 'C3_UrbanGround_BayCutout';
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.08;
  ground.receiveShadow = true;
  root.add(ground, river.group);
  // Only edge 3: full-footprint clearance is regression-tested against the route.
  // Do not extend this over the adjacent edges, some of which cross the track.
  root.add(createC3BayQuay(bay[2], bay[3]));

  const makeRect = (name: string, x: number, z: number, w: number, d: number, y: number, color: number) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({
      name: `${name}Material`, color, roughness: 0.88, metalness: 0.03, side: THREE.DoubleSide,
    }));
    mesh.name = name; mesh.rotation.x = -Math.PI / 2; mesh.position.set(x, y, z); root.add(mesh); return mesh;
  };
  // Small calm hardscape details, kept away from roads and landmarks.
  const mbsPlaza: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[]> = makeRect('C3_MBS_Plaza', 200, 540, 360, 130, -0.045, 0x62666a);
  mbsPlaza.rotation.z = -0.35;
  // Keep the original top face in its exact XY plane. Extrude down along its
  // local normal so the exposed edge reaches below the water at world y=-0.45.
  const plazaSurface = mbsPlaza.material as THREE.MeshStandardMaterial;
  const plazaRetaining = new THREE.MeshStandardMaterial({ name: 'C3_MBS_PlazaRetainingStone', color: 0x596169, roughness: 0.94, metalness: 0 });
  const plazaVolume = new THREE.BoxGeometry(360, 130, 1.2);
  plazaVolume.translate(0, 0, -0.6);
  const plazaIndices = Array.from(plazaVolume.index!.array);
  plazaVolume.setIndex([4, 0, 1, 2, 3, 5].flatMap(face => plazaIndices.slice(face * 6, face * 6 + 6)));
  plazaVolume.clearGroups(); plazaVolume.addGroup(0, 6, 0); plazaVolume.addGroup(6, 30, 1);
  mbsPlaza.geometry.dispose();
  mbsPlaza.geometry = plazaVolume;
  // BoxGeometry +Z is the existing plaza top after the -90 degree X rotation.
  mbsPlaza.material = [plazaSurface, plazaRetaining];
  mbsPlaza.userData.c3Podium = { depth: 1.2, topY: -0.045, waterY: -0.45 };
  makeRect('C3_Esplanade_Plaza', -200, -105, 150, 85, -0.04, 0x555b60);
  makeRect('C3_CityWalk_North', 0, 1000, 2200, 18, -0.055, 0x4b5054);
  makeRect('C3_CityWalk_South', 0, -1000, 2200, 18, -0.055, 0x4b5054);

  // Shared, locally generated night-window texture; no external assets, lights, or shader effects.
  const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#202a34'; ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#46535e'; ctx.fillRect(0, 0, 128, 4);
    for (let y = 10; y < 124; y += 18) for (let x = 8; x < 124; x += 16) {
      const h = ((x * 73 + y * 151 + 19) % 11);
      ctx.fillStyle = h < 5 ? '#d2ad70' : h < 7 ? '#718999' : '#263440';
      ctx.fillRect(x, y, 8, 10);
    }
  }
  const windowTexture = new THREE.CanvasTexture(canvas);
  windowTexture.colorSpace = THREE.SRGBColorSpace;
  windowTexture.wrapS = windowTexture.wrapT = THREE.RepeatWrapping;
  windowTexture.repeat.set(1.5, 2.5); windowTexture.anisotropy = 4;
  const facadeMat = new THREE.MeshStandardMaterial({ name: 'C3_CityFacadeWindows', map: windowTexture, color: 0xaab2b8, roughness: 0.68, metalness: 0.18 });
  const buildingGeo = new THREE.BoxGeometry(1, 1, 1);
  // Preserve every face, UV and normal, but keep the facade window map off the
  // horizontal roof/underside. Two contiguous groups avoid six material draws.
  const buildingIndices = Array.from(buildingGeo.index!.array);
  buildingGeo.setIndex([0, 1, 4, 5, 2, 3].flatMap(face => buildingIndices.slice(face * 6, face * 6 + 6)));
  buildingGeo.clearGroups(); buildingGeo.addGroup(0, 24, 0); buildingGeo.addGroup(24, 12, 1);
  const roofMat = new THREE.MeshStandardMaterial({ name: 'C3_CityRoofMembrane', color: 0x222932, roughness: 0.94, metalness: 0 });
  const buildings = new THREE.InstancedMesh(buildingGeo, [facadeMat, roofMat], 72);
  buildings.name = 'C3_DistantCityBlocks';
  buildings.castShadow = false; buildings.receiveShadow = true;
  const dummy = new THREE.Object3D();
  let seed = 0x53494e47;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const inBay = (x: number, z: number): boolean => {
    let inside = false;
    for (let i = 0, j = bay.length - 1; i < bay.length; j = i++) {
      const [xi, zi] = bay[i], [xj, zj] = bay[j];
      if (((zi > z) !== (zj > z)) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
    }
    return inside;
  };
  const routeSafe = (x: number, z: number, radius: number): boolean => {
    for (const p of points) if (Math.hypot(p.x - x, p.z - z) < radius) return false;
    return true;
  };
  const candidates: Array<[number, number]> = [];
  for (let z = -1320; z <= 1320; z += 150) for (let x = -1710; x <= 1710; x += 190) {
    // Leave the open bay, existing MBS footprint, esplanade/Flyer, and established skyline clear.
    if (inBay(x, z) || Math.hypot(x - 200, z - 540) < 215 || Math.hypot(x + 240, z + 45) < 115 || Math.hypot(x - 810, z + 120) < 135) continue;
    if (Math.hypot(x + 510, z - 680) < 245) continue;
    candidates.push([x, z]);
  }
  // Shuffle candidate order with the local seeded generator, so layout is stable and independent of Math.random.
  for (let i = candidates.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [candidates[i], candidates[j]] = [candidates[j], candidates[i]]; }
  let count = 0;
  for (const [x, z] of candidates) {
    if (count >= 72) break;
    const w = 34 + random() * 35, d = 30 + random() * 34, h = 16 + random() * 79;
    const clearance = 75 + Math.hypot(w, d) * 0.5;
    if (!routeSafe(x, z, clearance)) continue;
    dummy.position.set(x, -0.08 + h / 2, z); dummy.scale.set(w, h, d); dummy.rotation.y = (random() - 0.5) * 0.16; dummy.updateMatrix();
    buildings.setMatrixAt(count++, dummy.matrix);
  }
  buildings.count = count; buildings.instanceMatrix.needsUpdate = true;
  buildings.computeBoundingSphere();
  root.userData.c3CityBlocks = count;
  root.add(buildings);
  root.add(createC3CityRoofDetails(buildings, roofMat, plazaRetaining));
  root.updateMatrixWorld(true);
  return root;
}
