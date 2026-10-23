import * as THREE from 'three';

/** C3 only. Repaint instance-owned maps; do not allocate Three resources or use
 * Math.random: either would shift the procedural city/crowd's random stream.
 * No displacement, geometry, UV, lighting or shared PBR-cache modifications.
 */
export function cloneC3AsphaltMap(source: THREE.Texture): THREE.Texture {
  // This is Texture.clone's same constructor/copy sequence, retaining the
  // already allocated private Source instead of sharing the cached Source.
  const clone = new (source.constructor as typeof THREE.Texture)();
  const ownedSource = clone.source;
  clone.copy(source);
  clone.source = ownedSource;
  return clone;
}

export function finishC3AsphaltSurface(material: THREE.MeshStandardMaterial): void {
  const size = 1024, cells = 88;
  const hash = (x: number, y: number, salt = 0): number => {
    let h = Math.imul((x % cells + cells) % cells + 971, 374761393) ^ Math.imul((y % cells + cells) % cells + 157, 668265263) ^ salt;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const height = new Float32Array(size * size);
  const images = [0, 1, 2].map(() => {
    const canvas = document.createElement('canvas');canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    return {canvas, ctx, image: ctx.createImageData(size, size)};
  });
  const [albedo, normal, rough] = images.map(i => i.image.data);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const sx = x / size * cells, sy = y / size * cells;
    const ix = Math.floor(sx), iy = Math.floor(sy);
    let first = 10, second = 10, stone = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const cx = ix + dx, cy = iy + dy;
      const px = cx + .15 + .7 * hash(cx, cy, 11), py = cy + .15 + .7 * hash(cx, cy, 47);
      const d = Math.hypot((sx - px) * 1.08, (sy - py) * .94);
      if (d < first) {second = first;first = d;stone = hash(cx, cy, 719);}
      else if (d < second) second = d;
    }
    // Irregular fractured mineral faces in recessed dark bitumen, not white
    // salt-and-pepper noise. All maps come from the same aggregate field.
    const edge = Math.min(1, Math.max(0, (second - first - .012) * 9));
    const grain = hash(x, y, 3017) - .5;
    const chip = .42 + stone * .58;
    const grey = 33 + edge * (15 + chip * 46) + grain * 7;
    const pore = hash(x, y, 1471) > .986 ? .75 : 1;
    const i = y * size + x, j = i * 4;
    height[i] = edge * (.16 + stone * .12) * pore + grain * .025;
    albedo[j] = grey * pore * (1 + (stone - .5) * .025);
    albedo[j + 1] = grey * pore;
    albedo[j + 2] = grey * pore * (1 - (stone - .5) * .035);
    albedo[j + 3] = 255;
    const r = Math.min(.97, .94 - edge * (.075 + stone * .065) + grain * .015);
    rough[j] = rough[j + 1] = rough[j + 2] = Math.round(r * 255);rough[j + 3] = 255;
  }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const left = height[y * size + (x + size - 1) % size], right = height[y * size + (x + 1) % size];
    const up = height[((y + size - 1) % size) * size + x], down = height[((y + 1) % size) * size + x];
    const dx = (left - right) * 2.1, dy = (up - down) * 2.1, len = Math.hypot(dx, dy, 1), j = (y * size + x) * 4;
    normal[j] = 128 + dx / len * 127;normal[j + 1] = 128 + dy / len * 127;normal[j + 2] = 128 + 127 / len;normal[j + 3] = 255;
  }
  [material.map, material.normalMap, material.roughnessMap].forEach((texture, i) => {
    if (!texture) throw new Error('C3 asphalt requires three instance-owned PBR maps');
    const {canvas, ctx, image} = images[i];ctx.putImageData(image, 0, 0);
    // cloneC3AsphaltMap retained an instance-owned Source, so repainting its
    // image cannot modify the shared PBR cache or any other circuit.
    texture.image = canvas;
    texture.needsUpdate = true;
  });
  material.color.setHex(0x919495);
  material.normalScale.set(1.18, 1.18);
  material.roughness = 1.0;
  material.metalness = 0;
  // Porous mineral/bitumen composite: broad, subdued dielectric response.
  const physical = material as THREE.MeshPhysicalMaterial;
  physical.specularIntensity = .26;
  physical.clearcoat = 0;
  physical.ior = 1.45;
  material.onBeforeCompile = shader => {
    shader.vertexShader = 'varying vec2 vC3PavementWorld;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvC3PavementWorld = (modelMatrix * vec4(transformed, 1.0)).xz;');
    shader.fragmentShader = `varying vec2 vC3PavementWorld;
      float c3PaveHash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float c3PaveNoise(vec2 p) { vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
        return mix(mix(c3PaveHash(i),c3PaveHash(i+vec2(1,0)),f.x),mix(c3PaveHash(i+vec2(0,1)),c3PaveHash(i+vec2(1,1)),f.x),f.y); }
    ` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      float c3Patina = c3PaveNoise(vC3PavementWorld * .39) * .65 + c3PaveNoise(vC3PavementWorld * 1.73) * .35;
      diffuseColor.rgb *= mix(.75, 1.13, c3Patina);
    `);
  };
  material.customProgramCacheKey = () => 'c3-dry-pavement-r3';
  material.userData.c3AsphaltFinish = 'dry-fractured-aggregate-r3';
}

/** C3 asphalt wear only. Keep the approved ribbon, its UVs and all PBR maps.
 * Rubber deposits absorb the asphalt below; they must not add an independent
 * smooth specular highlight, which made the uncoated shoulders look black.
 */
export function finishC3RubberSurface(material: THREE.MeshStandardMaterial): void {
  material.opacity = 0.12;
  material.onBeforeCompile = shader => {
    shader.vertexShader = 'varying float vC3RubberAcross;\nvarying vec2 vC3RubberWorld;\n' + shader.vertexShader;
    // The existing indexed ribbon has alternating left/right vertices. WebGL2
    // gl_VertexID recovers its lateral coordinate without adding/changing UVs,
    // positions, attributes, indices, resources or the procedural random stream.
    shader.vertexShader = shader.vertexShader.replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
      vC3RubberAcross = float(gl_VertexID % 2) * 2.0 - 1.0;
      vC3RubberWorld = (modelMatrix * vec4(transformed, 1.0)).xz;
    `);
    shader.fragmentShader = `varying float vC3RubberAcross;
      varying vec2 vC3RubberWorld;
      float c3RubberHash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float c3RubberNoise(vec2 p) { vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
        return mix(mix(c3RubberHash(i),c3RubberHash(i+vec2(1,0)),f.x),mix(c3RubberHash(i+vec2(0,1)),c3RubberHash(i+vec2(1,1)),f.x),f.y); }
    ` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
      float c3RubberWear = c3RubberNoise(vC3RubberWorld * .23) * .65
        + c3RubberNoise(vC3RubberWorld * 1.37) * .35;
      float c3RubberEdge = 1.0 - smoothstep(.12, 1.0, abs(vC3RubberAcross));
      diffuseColor.a *= c3RubberEdge * mix(.25, .85, c3RubberWear);
      // Neutral absorption preserves the underlying aggregate/porosity instead
      // of painting a smooth, independently lit grey strip over it.
      outgoingLight = vec3(0.0);
      #include <opaque_fragment>
    `);
  };
  material.customProgramCacheKey = () => 'c3-rubber-absorptive-feathered-r1';
  material.userData.c3RubberFinish = 'absorptive-feathered-r1';
  material.needsUpdate = true;
}
