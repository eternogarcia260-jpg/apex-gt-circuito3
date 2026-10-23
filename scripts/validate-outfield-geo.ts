import * as THREE from 'three';
import { AlpineLakeAndVillasArchitect } from '../src/game/world/AlpineLakeAndVillasArchitect';
import { SpeedwayOutfieldArchitect } from '../src/game/world/SpeedwayOutfieldArchitect';

if (typeof (global as any).document === 'undefined') {
  (global as any).document = {
    createElement: () => ({
      width: 512,
      height: 512,
      getContext: () => ({
        createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
        putImageData: () => {},
      }),
    }),
  };
}

const dummyMaterials = {
  metalSilverMat: new THREE.MeshStandardMaterial({ name: 'metalSilver' }),
  metalDarkMat: new THREE.MeshStandardMaterial({ name: 'metalDark' }),
  glassMat: new THREE.MeshStandardMaterial({ name: 'glass' }),
  concreteMat: new THREE.MeshStandardMaterial({ name: 'concrete' }),
};

const outfield = SpeedwayOutfieldArchitect.buildOutfieldEnvironment(dummyMaterials);

console.log('--- GEOMETRY BUG & VALIDATION CHECK ---');
let bugsFound = 0;

outfield.traverse((obj) => {
  if (obj instanceof THREE.Mesh) {
    const geo = obj.geometry;
    const pos = geo.attributes.position;
    if (!pos) {
      console.error(`BUG: Mesh "${obj.name}" has no position attribute!`);
      bugsFound++;
      return;
    }
    
    // Check for NaNs or Infinities
    let nanCount = 0;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      if (isNaN(x) || isNaN(y) || isNaN(z) || !isFinite(x) || !isFinite(y) || !isFinite(z)) {
        nanCount++;
      }
    }
    if (nanCount > 0) {
      console.error(`BUG: Mesh "${obj.name}" has ${nanCount} NaN/Infinite vertices!`);
      bugsFound++;
    }

    // Check index bounds
    if (geo.index) {
      const idx = geo.index;
      for (let i = 0; i < idx.count; i++) {
        const indexVal = idx.getX(i);
        if (indexVal < 0 || indexVal >= pos.count) {
          console.error(`BUG: Mesh "${obj.name}" index out of bounds at ${i}: ${indexVal} >= ${pos.count}`);
          bugsFound++;
          break;
        }
      }
    }

    // Check material
    if (!obj.material) {
      console.error(`BUG: Mesh "${obj.name}" has NO material!`);
      bugsFound++;
    }

    console.log(`Mesh OK: "${obj.name || 'unnamed'}", verts: ${pos.count}, indices: ${geo.index ? geo.index.count : 'none'}, material: ${(obj.material as any)?.name || obj.material.type}`);
  }
});

console.log(`Total bugs in geometry: ${bugsFound}`);
