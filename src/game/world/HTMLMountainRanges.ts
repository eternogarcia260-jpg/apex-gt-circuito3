import * as THREE from 'three';

/**
 * 360-degree adaptation of the distant mountain ranges from
 * `the_silent_summit_solo_cordilleras_fondo_v11.html`.
 *
 * The source HTML builds two north-facing planes. Here, the same procedural
 * ridge-height field is sampled around a radial panorama so Circuit 1 retains
 * mountain coverage while the racing camera turns. No sky, valley floor,
 * lighting, mist, grass, or post-processing from the standalone HTML is added.
 */
export class HTMLMountainRanges {
  private static rockMaps: {
    color: THREE.DataTexture;
    normal: THREE.DataTexture;
    bump: THREE.DataTexture;
  } | null = null;

  private static readonly TAU = Math.PI * 2;
  private static readonly SOURCE_SEED = 1207;

  private static hash2(x: number, z: number, seed = HTMLMountainRanges.SOURCE_SEED): number {
    const v = Math.sin(x * 127.1 + z * 311.7 + seed * 74.7) * 43758.5453123;
    return (v - Math.floor(v)) * 2 - 1;
  }

  private static smooth(t: number): number {
    return t * t * (3 - 2 * t);
  }

  private static smoothstep(edge0: number, edge1: number, value: number): number {
    const t = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  private static noise2(x: number, z: number, seed = HTMLMountainRanges.SOURCE_SEED): number {
    const ix = Math.floor(x), iz = Math.floor(z);
    const fx = x - ix, fz = z - iz;
    const a = this.hash2(ix, iz, seed), b = this.hash2(ix + 1, iz, seed);
    const c = this.hash2(ix, iz + 1, seed), d = this.hash2(ix + 1, iz + 1, seed);
    const u = this.smooth(fx), v = this.smooth(fz);
    const top = a + (b - a) * u;
    return top + ((c + (d - c) * u) - top) * v;
  }

  private static fbm(
    x: number,
    z: number,
    octaves = 5,
    lacunarity = 2.03,
    gain = 0.5,
    seed = HTMLMountainRanges.SOURCE_SEED,
  ): number {
    let value = 0, amp = 0.5, norm = 0;
    for (let i = 0; i < octaves; i++) {
      value += this.noise2(x, z, seed + i * 19) * amp;
      norm += amp;
      x *= lacunarity;
      z *= lacunarity;
      amp *= gain;
    }
    return value / norm;
  }

  private static ridgeNoise(x: number, z: number, octaves = 4): number {
    let total = 0, amp = 0.55, norm = 0;
    for (let i = 0; i < octaves; i++) {
      const n = 1 - Math.abs(this.noise2(x, z, this.SOURCE_SEED + 311 + i * 31));
      total += n * n * amp;
      norm += amp;
      x *= 2.06;
      z *= 2.06;
      amp *= 0.48;
    }
    return total / norm;
  }

  /** Height function ported from the attached HTML's `farHeightAt`. */
  private static farHeightAt(x: number, z: number, rangeIndex: 0 | 1): number {
    const shift = rangeIndex === 0 ? -1.0 : 2.7;
    const centerZ = rangeIndex === 0 ? -325 : -560;
    const envelope = Math.exp(-Math.pow((z - centerZ) / 150, 2));
    const wx = x + this.fbm(x * 0.010 + rangeIndex * 9.1, z * 0.009, 3) * 22;
    const wz = z + this.fbm(x * 0.008, z * 0.012 + rangeIndex * 3.1, 3) * 20;
    let peaksHeight = 0;
    const spacing = rangeIndex === 0 ? 66 : 83;
    for (let i = -8; i <= 8; i++) {
      const px = i * spacing + 18 * Math.sin(i * 1.71 + rangeIndex * 2.0);
      const h = (rangeIndex === 0 ? 23 : 17)
        + 18 * (0.5 + 0.5 * Math.sin(i * 2.37 + rangeIndex * 1.4))
        + 9 * (0.5 + 0.5 * Math.cos(i * 1.13));
      const width = (rangeIndex === 0 ? 27 : 37) + 14 * (0.5 + 0.5 * Math.sin(i * 1.93));
      const dx = Math.abs((wx - px) / width);
      const dz = Math.abs((wz - centerZ - 15 * Math.sin(i * 1.4)) / (rangeIndex === 0 ? 112 : 145));
      peaksHeight += h * Math.exp(-Math.pow(dx, 1.14) - Math.pow(dz, 1.08));
    }
    const rugged = this.ridgeNoise(wx * 0.033 + shift, wz * 0.026, 4) * 4.0
      + this.fbm(wx * 0.045, wz * 0.035, 4) * 2.4;
    return Math.max(0.1, 0.7 + envelope * (peaksHeight + rugged));
  }

  private static createRockMaps(): NonNullable<typeof HTMLMountainRanges.rockMaps> {
    if (this.rockMaps) return this.rockMaps;

    const size = 512;
    const heightData = new Float32Array(size * size);
    const colorData = new Uint8Array(size * size * 4);
    const normalData = new Uint8Array(size * size * 4);
    const bumpData = new Uint8Array(size * size * 4);
    const clamp = THREE.MathUtils.clamp;

    // Same deterministic procedural mineral, striation and fissure synthesis as the source HTML.
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const broad = this.fbm(x * 0.022, y * 0.022, 4, 2, 0.52, 214);
      const medium = this.fbm(x * 0.095, y * 0.095, 4, 2, 0.5, 828);
      const fine = this.fbm(x * 0.31, y * 0.31, 3, 2, 0.5, 449);
      const striation = Math.sin(y * 0.092 + Math.sin(x * 0.018 + y * 0.013 + broad * 1.8) * 2.7 + broad * 3.4);
      const fissure = Math.pow(Math.max(0, Math.sin(x * 0.31 + Math.sin(x * 0.035 + y * 0.035 + broad * 4.0) * 1.9 + medium * 0.8)), 18);
      const h = broad * 0.48 + medium * 0.30 + fine * 0.17 + striation * 0.045 - fissure * 0.055;
      heightData[i] = h;
      const grain = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      const grainFine = Math.sin(x * 91.71 + y * 17.13) * 43758.5453;
      const mineral = clamp(166 + h * 55 + ((grain - Math.floor(grain)) - 0.5) * 19
        + ((grainFine - Math.floor(grainFine)) - 0.5) * 8 - fissure * 40, 82, 228);
      colorData[i * 4] = clamp(mineral * 1.025, 0, 255);
      colorData[i * 4 + 1] = clamp(mineral * 0.995, 0, 255);
      colorData[i * 4 + 2] = clamp(mineral * 0.955, 0, 255);
      colorData[i * 4 + 3] = 255;
      const bump = clamp(128 + h * 90 - fissure * 34 + striation * 9, 0, 255);
      bumpData[i * 4] = bumpData[i * 4 + 1] = bumpData[i * 4 + 2] = bump;
      bumpData[i * 4 + 3] = 255;
    }

    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const left = y * size + (x + size - 1) % size;
      const right = y * size + (x + 1) % size;
      const up = ((y + size - 1) % size) * size + x;
      const down = ((y + 1) % size) * size + x;
      const dx = (heightData[right] - heightData[left]) * 4.5;
      const dy = (heightData[down] - heightData[up]) * 4.5;
      let nx = -dx, ny = -dy, nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len; ny /= len; nz /= len;
      normalData[i * 4] = Math.round((nx * 0.5 + 0.5) * 255);
      normalData[i * 4 + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      normalData[i * 4 + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      normalData[i * 4 + 3] = 255;
    }

    const createTexture = (data: Uint8Array, colorSpace: THREE.ColorSpace): THREE.DataTexture => {
      const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(23, 21);
      texture.colorSpace = colorSpace;
      texture.magFilter = THREE.LinearFilter;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.generateMipmaps = true;
      texture.anisotropy = 8;
      texture.needsUpdate = true;
      return texture;
    };
    this.rockMaps = {
      color: createTexture(colorData, THREE.SRGBColorSpace),
      normal: createTexture(normalData, THREE.NoColorSpace),
      bump: createTexture(bumpData, THREE.NoColorSpace),
    };
    return this.rockMaps;
  }

  /** Alpine texturing for the existing low outfield; it changes albedo only. */
  public static createAlpineLowlandMaterial(base: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
    const material = base.clone();
    material.name = 'Circuit1_AlpineTexturedLowland';
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vAlpineLowlandWorldPos;',
      );
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvAlpineLowlandWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `#include <common>
        varying vec3 vAlpineLowlandWorldPos;
        float lowlandHash3(vec3 p) {
          p = fract(p * 0.1031);
          p += dot(p, p.yzx + 33.33);
          return fract((p.x + p.y) * p.z);
        }
        float lowlandNoise3(vec3 p) {
          vec3 i = floor(p), f = fract(p);
          f = f*f*(3.0-2.0*f);
          float n000=lowlandHash3(i+vec3(0.,0.,0.));
          float n100=lowlandHash3(i+vec3(1.,0.,0.));
          float n010=lowlandHash3(i+vec3(0.,1.,0.));
          float n110=lowlandHash3(i+vec3(1.,1.,0.));
          float n001=lowlandHash3(i+vec3(0.,0.,1.));
          float n101=lowlandHash3(i+vec3(1.,0.,1.));
          float n011=lowlandHash3(i+vec3(0.,1.,1.));
          float n111=lowlandHash3(i+vec3(1.,1.,1.));
          float z0=mix(mix(n000,n100,f.x),mix(n010,n110,f.x),f.y);
          float z1=mix(mix(n001,n101,f.x),mix(n011,n111,f.x),f.y);
          return mix(z0,z1,f.z)*2.0-1.0;
        }`,
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        vec3 lowlandPos = vAlpineLowlandWorldPos;
        float lowlandLarge = lowlandNoise3(lowlandPos*0.038+vec3(0.7,1.4,2.1));
        float lowlandMedium = lowlandNoise3(lowlandPos*0.142+vec3(9.7,4.1,13.2));
        float lowlandFine = lowlandNoise3(lowlandPos*0.62+vec3(17.1,3.8,6.4));
        float lowlandMicro = sin(lowlandPos.x*5.7+sin(lowlandPos.z*3.2)*0.73)
                           * sin(lowlandPos.z*6.9+sin(lowlandPos.x*2.6)*0.61);
        float lowlandHeight = 8.0+lowlandLarge*2.2+lowlandMedium*1.4;
        float lowlandSlope = 0.24+abs(lowlandLarge)*0.11+abs(lowlandMedium)*0.05;
        vec3 lowlandRock = mix(vec3(0.145,0.158,0.172),vec3(0.355,0.328,0.294),
          clamp(0.49+lowlandLarge*0.34+lowlandMedium*0.20,0.0,1.0));
        lowlandRock *= 0.91+lowlandFine*0.14+lowlandMicro*0.045;
        vec3 lowlandSoil = mix(vec3(0.095,0.074,0.052),vec3(0.235,0.173,0.105),
          clamp(0.50+lowlandLarge*0.42+lowlandMedium*0.19,0.0,1.0));
        vec3 lowlandGrass = mix(vec3(0.035,0.060,0.033),vec3(0.135,0.175,0.086),
          clamp(0.48+lowlandLarge*0.42+lowlandMedium*0.24,0.0,1.0));
        float lowlandSoilMask = smoothstep(5.0,13.0,lowlandHeight)
          *(1.0-smoothstep(13.0,23.0,lowlandHeight))
          *(1.0-smoothstep(0.23,0.76,lowlandSlope));
        float lowlandGrassMask = (1.0-smoothstep(3.5,13.5,lowlandHeight))
          *(1.0-smoothstep(0.12,0.60,lowlandSlope));
        vec3 alpineLowland = mix(lowlandRock,lowlandSoil,lowlandSoilMask*0.92);
        alpineLowland = mix(alpineLowland,lowlandGrass,lowlandGrassMask*0.96);
        alpineLowland *= 0.92+lowlandFine*0.09+lowlandMicro*0.025;
        float lowlandRadius = length(lowlandPos.xz);
        float outerField = smoothstep(166.0,188.0,lowlandRadius);
        vec2 lowlandAbs = abs(lowlandPos.xz);
        float segmentAlongX = clamp(lowlandAbs.x,0.0,92.0);
        float segmentAlongZ = clamp(lowlandAbs.y,0.0,92.0);
        float straightDistanceX = length(vec2(lowlandAbs.x-segmentAlongX,abs(lowlandAbs.y-130.0)));
        float straightDistanceZ = length(vec2(abs(lowlandAbs.x-130.0),lowlandAbs.y-segmentAlongZ));
        float cornerDistance = abs(length(lowlandAbs-vec2(92.0))-38.0);
        float trackDistance = min(cornerDistance,min(straightDistanceX,straightDistanceZ));
        float clearOfTrackAndRunoff = smoothstep(22.0,30.0,trackDistance);
        diffuseColor.rgb = mix(diffuseColor.rgb,alpineLowland,outerField*clearOfTrackAndRunoff);`,
      );
    };
    material.customProgramCacheKey = () => 'circuit1-alpine-textured-lowland-v3';
    return material;
  }

  private static createMountainMaterial(): THREE.MeshStandardMaterial {
    const maps = this.createRockMaps();
    const material = new THREE.MeshStandardMaterial({
      name: 'Circuit1_HTML_AlpineRockSnow',
      map: maps.color,
      normalMap: maps.normal,
      normalScale: new THREE.Vector2(1.15, 1.15),
      bumpMap: maps.bump,
      bumpScale: 0.075,
      roughness: 0.93,
      metalness: 0.01,
    });

    // Alpine rock, fractured strata, soil, forested lower slopes and wind-packed snow
    // are the attached HTML's material treatment; lighting remains the game's own.
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vTerrainWorldPos;\nvarying vec3 vTerrainWorldNormal;',
      );
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvTerrainWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvTerrainWorldNormal = normalize(mat3(modelMatrix) * objectNormal);',
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `#include <common>
        varying vec3 vTerrainWorldPos;
        varying vec3 vTerrainWorldNormal;
        float terrainHash3(vec3 p) {
          p = fract(p * 0.1031);
          p += dot(p, p.yzx + 33.33);
          return fract((p.x + p.y) * p.z);
        }
        float terrainNoise3(vec3 p) {
          vec3 i = floor(p), f = fract(p);
          f = f*f*(3.0-2.0*f);
          float n000=terrainHash3(i+vec3(0.,0.,0.));
          float n100=terrainHash3(i+vec3(1.,0.,0.));
          float n010=terrainHash3(i+vec3(0.,1.,0.));
          float n110=terrainHash3(i+vec3(1.,1.,0.));
          float n001=terrainHash3(i+vec3(0.,0.,1.));
          float n101=terrainHash3(i+vec3(1.,0.,1.));
          float n011=terrainHash3(i+vec3(0.,1.,1.));
          float n111=terrainHash3(i+vec3(1.,1.,1.));
          float z0=mix(mix(n000,n100,f.x),mix(n010,n110,f.x),f.y);
          float z1=mix(mix(n001,n101,f.x),mix(n011,n111,f.x),f.y);
          return mix(z0,z1,f.z)*2.0-1.0;
        }
        `,
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        vec3 terrainN = normalize(vTerrainWorldNormal);
        float terrainSlope = 1.0 - clamp(terrainN.y, 0.0, 1.0);
        float terrainHeight = vTerrainWorldPos.y;
        float terrainLarge = terrainNoise3(vTerrainWorldPos * 0.038 + vec3(0.7, 1.4, 2.1));
        float terrainMedium = terrainNoise3(vTerrainWorldPos * 0.142 + vec3(9.7, 4.1, 13.2));
        float terrainFine = terrainNoise3(vTerrainWorldPos * 0.62 + vec3(17.1, 3.8, 6.4));
        float terrainMicro = sin(vTerrainWorldPos.x * 5.7 + sin(vTerrainWorldPos.z * 3.2) * 0.73)
                           * sin(vTerrainWorldPos.z * 6.9 + sin(vTerrainWorldPos.x * 2.6) * 0.61);
        float terrainPores = terrainHash3(floor(vTerrainWorldPos * 13.0 + vec3(0.7, 1.9, 2.8))) * 2.0 - 1.0;
        float terrainFaultNoise = terrainNoise3(vTerrainWorldPos * vec3(0.235, 0.095, 0.255) + vec3(31.0, 4.3, 12.1));
        float terrainFractureNoise = terrainNoise3(vTerrainWorldPos * vec3(0.73, 0.22, 0.69) + vec3(6.7, 21.4, 3.9));
        float terrainFractures = (1.0-smoothstep(0.055,0.21,abs(terrainFractureNoise + terrainMedium*0.09))) * smoothstep(0.24,0.77,terrainSlope);
        vec3 terrainTexel = diffuseColor.rgb;
        float terrainRockVar = clamp(0.49 + terrainLarge*0.34 + terrainMedium*0.20, 0.0, 1.0);
        vec3 terrainRock = mix(vec3(0.145,0.158,0.172), vec3(0.355,0.328,0.294), terrainRockVar);
        terrainRock *= 0.91 + terrainFine*0.14 + terrainMicro*0.045 + terrainPores*0.025;
        float terrainBandWave = 0.5 + 0.5*sin(terrainHeight*1.58 + terrainLarge*2.4 + terrainMedium*1.15 + terrainFaultNoise*0.65);
        float terrainStrata = smoothstep(0.865,0.979,terrainBandWave) * smoothstep(0.19,0.61,terrainSlope) * (1.0-smoothstep(50.0,67.0,terrainHeight));
        float terrainVein = smoothstep(0.905,0.991,0.5+0.5*sin(terrainHeight*2.08+terrainLarge*3.0+terrainFine*0.9)) * smoothstep(0.32,0.79,terrainSlope);
        terrainRock = mix(terrainRock, terrainRock*0.49, terrainStrata*0.65);
        terrainRock = mix(terrainRock, terrainRock*1.22, terrainVein*0.28);
        terrainRock = mix(terrainRock, terrainRock*vec3(0.43,0.45,0.48), terrainFractures*0.32);
        vec3 terrainSoil = mix(vec3(0.095,0.074,0.052), vec3(0.235,0.173,0.105), clamp(0.50+terrainLarge*0.42+terrainMedium*0.19,0.0,1.0));
        vec3 terrainGrass = mix(vec3(0.035,0.060,0.033), vec3(0.135,0.175,0.086), clamp(0.48+terrainLarge*0.42+terrainMedium*0.24,0.0,1.0));
        terrainGrass *= 0.93 + terrainFine*0.14;
        vec3 terrainSnow = mix(vec3(0.38,0.47,0.56), vec3(0.86,0.89,0.91), clamp(0.52+terrainMedium*0.28+terrainFine*0.22,0.0,1.0));
        float snowWindRibs = smoothstep(0.56,0.82,0.5+0.5*sin(vTerrainWorldPos.x*0.34 + terrainLarge*3.7 + terrainMedium*1.2));
        terrainSnow *= 0.94 + snowWindRibs*0.055;
        float terrainSoilMask = smoothstep(5.0,13.0,terrainHeight) * (1.0-smoothstep(13.0,23.0,terrainHeight)) * (1.0-smoothstep(0.23,0.76,terrainSlope));
        terrainSoilMask *= clamp(0.72+terrainLarge*0.18,0.42,0.94);
        float terrainGrassMask = (1.0-smoothstep(3.5,13.5,terrainHeight)) * (1.0-smoothstep(0.12,0.60,terrainSlope));
        terrainGrassMask *= clamp(0.79+terrainLarge*0.12+terrainMedium*0.08,0.55,0.97);
        float snowDrift = terrainLarge*5.6 + terrainMedium*4.2 + terrainFine*1.15;
        float terrainSnowMask = smoothstep(41.0+snowDrift,59.5+snowDrift,terrainHeight);
        terrainSnowMask *= (1.0-smoothstep(0.31,0.90,terrainSlope)*0.82);
        terrainSnowMask *= smoothstep(-0.75,0.03,terrainLarge*0.62+terrainMedium*0.38+0.20);
        terrainSnowMask *= 1.0 - smoothstep(0.52,0.88,terrainSlope) * smoothstep(0.40,0.78,terrainFaultNoise) * 0.54;
        vec3 terrainAlbedo = terrainRock;
        terrainAlbedo = mix(terrainAlbedo, terrainSoil, terrainSoilMask*0.92);
        terrainAlbedo = mix(terrainAlbedo, terrainGrass, terrainGrassMask*0.96);
        terrainAlbedo = mix(terrainAlbedo, terrainSnow, clamp(terrainSnowMask,0.0,0.98));
        float terrainCrack = smoothstep(0.62,0.90,abs(terrainFaultNoise)) * smoothstep(0.24,0.76,terrainSlope) * (1.0-terrainSnowMask);
        terrainAlbedo = mix(terrainAlbedo, terrainAlbedo*vec3(0.42,0.43,0.44), terrainCrack*0.22);
        float terrainTextureDetail = 0.88 + terrainTexel.r*0.16 + terrainFine*0.065 + terrainMicro*0.032 + terrainPores*0.016;
        terrainTextureDetail *= 1.0 - terrainFractures*0.08;
        diffuseColor.rgb = terrainAlbedo * terrainTextureDetail;`,
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <roughnessmap_fragment>',
        '#include <roughnessmap_fragment>\nroughnessFactor = clamp(0.965 - terrainSnowMask*0.18 + terrainMicro*0.024 + terrainPores*0.014 - terrainVein*0.025, 0.64, 0.999);',
      );
    };
    material.customProgramCacheKey = () => 'circuit1-html-alpine-ranges-v1';
    return material;
  }

  /** Build one draw-call mountain corona by sampling the HTML's two range fields. */
  public static build(): THREE.Mesh {
    const angularSegments = 288;
    const radialSegments = 72;
    // Circuit 1's track, barriers and corner runoff reach roughly 200 m from
    // the origin. Keep a clear margin and a low apron outside that perimeter.
    const innerRadius = 225;
    const outerRadius = 820;
    const angularStride = angularSegments + 1;
    const vertexCount = (radialSegments + 1) * angularStride;
    const positions = new Float32Array(vertexCount * 3);
    const uvs = new Float32Array(vertexCount * 2);
    const indices = new Uint32Array(radialSegments * angularSegments * 6);

    for (let rIndex = 0; rIndex <= radialSegments; rIndex++) {
      const rFraction = rIndex / radialSegments;
      const radius = innerRadius + (outerRadius - innerRadius) * rFraction;
      // Push the source ranges outward and ease them in after a flatter apron.
      const sourceZ = -(radius - 85);
      const mountainRise = this.smoothstep(300, 410, radius);
      const sourceHeightAt = (sampleX: number): number => Math.max(0.1,
        this.farHeightAt(sampleX, sourceZ, 0)
        + this.farHeightAt(sampleX, sourceZ, 1)
        - 0.7,
      );
      // The panorama samples a non-periodic source strip. Blend both ends
      // to one shared seam height so the first/last radial columns meet
      // continuously, including their angular tangent.
      const seamHeight = (sourceHeightAt(-525) + sourceHeightAt(525)) * 0.5;
      for (let aIndex = 0; aIndex <= angularSegments; aIndex++) {
        const angleFraction = aIndex / angularSegments;
        const angle = angleFraction * this.TAU;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        // Map the source's 1050 m ridgeline width once around the full racing horizon.
        const sourceX = (angleFraction - 0.5) * 1050;
        const rawHeight = sourceHeightAt(sourceX);
        const seamDistance = Math.min(angleFraction, 1 - angleFraction);
        const seamBlend = this.smoothstep(0, 0.025, seamDistance);
        const height = THREE.MathUtils.lerp(seamHeight, rawHeight, seamBlend) * mountainRise;
        const index = rIndex * angularStride + aIndex;
        positions[index * 3] = x;
        positions[index * 3 + 1] = height;
        positions[index * 3 + 2] = z;
        uvs[index * 2] = angleFraction;
        uvs[index * 2 + 1] = rFraction;
      }
    }

    let write = 0;
    for (let rIndex = 0; rIndex < radialSegments; rIndex++) {
      for (let aIndex = 0; aIndex < angularSegments; aIndex++) {
        const a = rIndex * angularStride + aIndex;
        const b = (rIndex + 1) * angularStride + aIndex;
        const c = b + 1;
        const d = a + 1;
        // Winding faces upward so the mountain material remains single-sided.
        indices[write++] = a; indices[write++] = d; indices[write++] = b;
        indices[write++] = b; indices[write++] = d; indices[write++] = c;
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.computeVertexNormals();
    const normals = geometry.attributes.normal as THREE.BufferAttribute;
    for (let rIndex = 0; rIndex <= radialSegments; rIndex++) {
      const first = rIndex * angularStride;
      const last = first + angularSegments;
      const nx = normals.getX(first) + normals.getX(last);
      const ny = normals.getY(first) + normals.getY(last);
      const nz = normals.getZ(first) + normals.getZ(last);
      const length = Math.hypot(nx, ny, nz) || 1;
      normals.setXYZ(first, nx / length, ny / length, nz / length);
      normals.setXYZ(last, nx / length, ny / length, nz / length);
    }
    geometry.computeBoundingSphere();

    const mesh = new THREE.Mesh(geometry, this.createMountainMaterial());
    mesh.name = 'Circuit1_HTML_360_AlpineRanges';
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = false;
    return mesh;
  }
}
