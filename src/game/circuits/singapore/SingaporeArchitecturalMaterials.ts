import * as THREE from 'three';

type Surface = THREE.MeshStandardMaterial;
type References = { structure: Surface; glass: Surface; backGlass: Surface };

/** C3-only material finishing. Call after all procedural scenery/crowds and water. */
export function finishC3ArchitecturalMaterials(root: THREE.Group, references: References): void {
  if (root.userData.c3Architecture) return;
  const texture = (name: string, size: number, color: boolean, paint: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('C3 architectural texture requires a 2D canvas');
    paint(ctx);
    const t = new THREE.CanvasTexture(canvas); t.name = `C3_Cine_${name}`;
    t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
    return t;
  };
  // Tiny height/roughness variation, not displacement or a geometry change.
  const stone = texture('StoneMicrostructure', 128, false, ctx => {
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
      const hash = (Math.imul(x + 17, 374761393) ^ Math.imul(y + 31, 668265263)) >>> 0;
      const n = 230 + ((hash ^ (hash >>> 13)) >>> 0) % 20;
      ctx.fillStyle = `rgb(${n},${n},${n})`; ctx.fillRect(x, y, 1, 1);
    }
  });
  stone.repeat.set(12, 36);
  const room = (emission: boolean) => texture(emission ? 'RoomEmission' : 'RoomAlbedo', 128, true, ctx => {
    ctx.fillStyle = emission ? '#000000' : '#343e46'; ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = emission ? '#bcbcbc' : '#d2cbb8'; ctx.fillRect(9, 6, 110, 116);
    ctx.fillStyle = emission ? '#888888' : '#a6a99f'; ctx.fillRect(10, 7, 24, 114);
    for (let y = 18; y < 121; y += 15) {
      ctx.fillStyle = emission ? '#8c8c8c' : '#a1a89f'; ctx.fillRect(10, y, 108, 2);
    }
    ctx.fillStyle = emission ? '#000000' : '#3e4c54'; ctx.fillRect(62, 6, 3, 116);
  });
  const roomAlbedo = room(false), roomEmission = room(true);
  const clones = new Map<THREE.Material, Surface>();
  const shell = references.structure.clone(); shell.name = 'C3_Cine_MBS_Limestone';
  shell.color.set(0xd4d1c7); shell.roughness = 0.78; shell.metalness = 0;
  shell.roughnessMap = stone; shell.bumpMap = stone; shell.bumpScale = 0.006;
  clones.set(references.structure, shell);
  for (const [original, name, color, roughness] of [
    [references.glass, 'C3_Cine_MBS_Glass', 0x293f4f, 0.24],
    [references.backGlass, 'C3_Cine_MBS_BackGlass', 0x243847, 0.27],
  ] as const) {
    const m = original.clone(); m.name = name; m.color.set(color);
    // Opaque game-scale glazing LOD: dielectric response, not metal/transmission.
    m.metalness = 0; m.roughness = roughness; m.emissive.set(0); m.emissiveIntensity = 0;
    m.envMapIntensity = 0.9; clones.set(original, m);
  }
  const mbs = root.getObjectByName('C3_MarinaBaySands');
  mbs?.traverse(o => {
    if (!(o instanceof THREE.Mesh)) return;
    const replace = (m: THREE.Material): THREE.Material => {
      if (m instanceof THREE.MeshStandardMaterial && m.name === 'C3_StaticArchitecturalWash') {
        m.name = 'C3_Cine_ArchitecturalWash'; m.roughness = 0.82; m.metalness = 0;
        m.color.set(0xd4d1c7); m.emissiveIntensity = 0.28;
      }
      return clones.get(m) ?? m;
    };
    o.material = Array.isArray(o.material) ? o.material.map(replace) : replace(o.material);
  });
  const finishRoom = (name: string) => {
    const mesh = root.getObjectByName(name) as THREE.Mesh | undefined;
    if (!mesh || !(mesh.material instanceof THREE.MeshStandardMaterial)) return;
    const m = mesh.material; m.name = 'C3_Cine_RoomWindows'; m.color.set(0xd8d0bb);
    m.map = roomAlbedo; m.emissiveMap = roomEmission; m.emissive.set(0xe2ba7e);
    m.emissiveIntensity = 0.38; m.roughness = 0.32; m.metalness = 0;
  };
  for (const name of ['C3_MBS_Windows_Front', 'C3_MBS_Windows_Back', 'C3_Raffles_WarmWindows']) finishRoom(name);
  const raffles = root.getObjectByName('C3_RafflesSkyline');
  for (const o of raffles?.children ?? []) if (o instanceof THREE.Mesh && o.geometry instanceof THREE.BoxGeometry) {
    const m = o.material;
    if (m instanceof THREE.MeshStandardMaterial) {
      m.name = 'C3_Cine_RafflesGlazing'; m.color.set(0x263947); m.roughness = 0.28;
      m.metalness = 0; m.emissiveIntensity = 0.06;
    }
  }
  const city = root.getObjectByName('C3_DistantCityBlocks') as THREE.Mesh | undefined;
  const cityMaterial = city && Array.isArray(city.material) ? city.material[0] : undefined;
  if (cityMaterial instanceof THREE.MeshStandardMaterial) {
    const cityMap = (mode: 'albedo' | 'emission' | 'roughness') => texture(`City_${mode}`, 256, mode !== 'roughness', ctx => {
      ctx.fillStyle = mode === 'albedo' ? '#202e39' : mode === 'emission' ? '#000000' : '#e8e8e8';
      ctx.fillRect(0, 0, 256, 256);
      for (let y = 20; y < 248; y += 36) for (let x = 16; x < 248; x += 32) {
        const h = ((x / 2 * 73 + y / 2 * 151 + 19) % 11), lit = h < 7;
        ctx.fillStyle = mode === 'roughness' ? '#7b7b7b' : mode === 'emission'
          ? (h < 5 ? '#a58c66' : lit ? '#697b88' : '#000000')
          : (h < 5 ? '#b9ad91' : lit ? '#8195a1' : '#2b3a46');
        ctx.fillRect(x, y, 16, 20);
        ctx.fillStyle = mode === 'roughness' ? '#d8d8d8' : mode === 'emission' ? '#000000' : '#344650';
        ctx.fillRect(x + 7, y, 1, 20); ctx.fillRect(x, y + 8, 16, 1);
      }
    });
    const old = cityMaterial.map;
    cityMaterial.name = 'C3_Cine_CityFacade'; cityMaterial.color.set(0xb5bdc3);
    cityMaterial.map = cityMap('albedo'); cityMaterial.emissiveMap = cityMap('emission');
    cityMaterial.roughnessMap = cityMap('roughness'); cityMaterial.roughness = 0.9; cityMaterial.metalness = 0;
    cityMaterial.emissive.set(0xffffff); cityMaterial.emissiveIntensity = 0.32;
    for (const t of [cityMaterial.map, cityMaterial.emissiveMap, cityMaterial.roughnessMap]) t.repeat.set(1.5, 2.5);
    old?.dispose(); // This old local map has no remaining users, and was never uploaded.
  }
  const fixtures = root.getObjectByName('C3_FloodlightFixtures') as THREE.Mesh | undefined;
  const poles = root.children.find(o => o instanceof THREE.InstancedMesh && o.geometry instanceof THREE.CylinderGeometry && o.geometry.parameters.height === 10 && o.geometry.parameters.radiusBottom === 0.42) as THREE.Mesh | undefined;
  if (fixtures && Array.isArray(fixtures.material) && poles) {
    const coat = (fixtures.material[0] as Surface).clone(); coat.name = 'C3_Cine_FloodlightPowderCoat';
    coat.color.set(0x45515b); coat.metalness = 0; coat.roughness = 0.58;
    poles.material = coat;
    const led = fixtures.material[1] as Surface;
    const lens = (emission: boolean) => texture(emission ? 'LED_Emission' : 'LED_Albedo', 128, true, ctx => {
      ctx.fillStyle = emission ? '#000000' : '#182027'; ctx.fillRect(0, 0, 128, 128);
      for (let row = 0; row < 4; row++) for (let col = 0; col < 6; col++) {
        const x = 11 + col * 18, y = 14 + row * 26;
        ctx.fillStyle = emission ? '#5e5e5e' : '#697e87'; ctx.fillRect(x, y, 15, 21);
        ctx.fillStyle = emission ? '#bcbcbc' : '#c0cdc9'; ctx.fillRect(x + 2, y + 2, 11, 17);
        ctx.fillStyle = emission ? '#ffffff' : '#fff4df'; ctx.fillRect(x + 4, y + 5, 7, 11);
      }
    });
    led.name = 'C3_Cine_FloodlightLED'; led.color.set(0xffffff); led.map = lens(false);
    led.emissiveMap = lens(true); led.emissive.set(0xfff0d8); led.emissiveIntensity = 1.4;
    led.roughness = 0.32; led.metalness = 0; fixtures.material = [coat, led];
  }
  // Dispose only replaced originals with no remaining mesh users. Shared pit/Flyer materials stay alive.
  const used = new Set<THREE.Material>(); root.traverse(o => {
    if (o instanceof THREE.Mesh) for (const m of Array.isArray(o.material) ? o.material : [o.material]) used.add(m);
  });
  for (const original of clones.keys()) if (!used.has(original)) original.dispose();
  root.userData.c3Architecture = { version: 1, addedLights: 0, addedRenderPasses: 0, canvasTextures: 8,
    note: 'Local PBR finishing; opaque glazing LOD and existing architectural wash approximation, not transmission or GI.' };
}
