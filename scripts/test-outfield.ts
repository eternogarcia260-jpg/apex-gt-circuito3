import * as THREE from 'three';
import { AlpineLakeAndVillasArchitect } from '../src/game/world/AlpineLakeAndVillasArchitect';
import { SpeedwayOutfieldArchitect } from '../src/game/world/SpeedwayOutfieldArchitect';

// Mock document for canvas creation in Node
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

const obstacles: any[] = [];
const outfield = SpeedwayOutfieldArchitect.buildOutfieldEnvironment(dummyMaterials, obstacles);

console.log('Outfield group name:', outfield.name);
console.log('Total children in outfield:', outfield.children.length);

outfield.traverse((obj) => {
  if (obj instanceof THREE.Mesh) {
    obj.geometry.computeBoundingBox();
    const box = obj.geometry.boundingBox;
    console.log(`MESH: "${obj.name}", visible: ${obj.visible}, material: ${(obj.material as any)?.name || obj.material.type}, vertCount: ${obj.geometry.attributes.position ? obj.geometry.attributes.position.count : 0}`);
    if (box) {
      console.log(`   Bounds: X[${box.min.x.toFixed(1)}, ${box.max.x.toFixed(1)}], Y[${box.min.y.toFixed(2)}, ${box.max.y.toFixed(2)}], Z[${box.min.z.toFixed(1)}, ${box.max.z.toFixed(1)}]`);
    }
  }
});
