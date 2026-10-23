import * as THREE from 'three';

/** Painted twin structural rings with a small, surface-mounted LED accent. */
export function createC3FlyerRims(radius: number): THREE.Mesh[] {
  if (!Number.isFinite(radius) || radius <= .85) return [];
  // Preserve the original support envelope and tessellation exactly.
  const frameGeometry = new THREE.TorusGeometry(radius, .85, 8, 48);
  // Match angular facets: a smoother LED otherwise floats above chorded supports.
  const ledGeometry = new THREE.TorusGeometry(radius + .84, .09, 6, 48);
  const paint = new THREE.MeshStandardMaterial({ name: 'C3_FlyerRimPaint', color: 0xa6b1b8, roughness: .62, metalness: 0 });
  const led = new THREE.MeshStandardMaterial({ name: 'C3_FlyerRimLED', color: 0x5e1738, emissive: 0xff3e91, emissiveIntensity: 1.1, roughness: .6, metalness: 0 });
  const meshes: THREE.Mesh[] = [];
  for (const z of [-1.5, 1.5]) {
    const frame = new THREE.Mesh(frameGeometry, paint);
    frame.name = 'C3_FlyerRimFrame'; frame.position.z = z;
    const strip = new THREE.Mesh(ledGeometry, led);
    strip.name = 'C3_FlyerRimLED'; strip.position.z = z;
    strip.userData.c3NoShadow = true;
    // The LED centreline lies .01 m inside the structural tube's outer surface.
    strip.userData.c3RimAccent = { centerlineRadialOffset: .84, tubeRadius: .09, mountedOnFrame: true };
    meshes.push(frame, strip);
  }
  return meshes;
}
