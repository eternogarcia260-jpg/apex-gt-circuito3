import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';

/** Superficie oceánica PELAGIC adaptada al nivel marino existente del Circuito 3. */
export interface C3WaterSurface {
  mesh: THREE.Mesh;
  update(dt: number): void;
  dispose(): void;
  diagnostics: {
    reflectionSize: number;
    refractionSize: number;
    refractionPasses: number;
    hasDepth: boolean;
    fallback: boolean;
    reflectionPasses: number;
    skippedPasses: number;
    lastError: string | null;
  };
}

const SETTINGS = Object.freeze({ wind: 0.78, waves: 0.84, foam: 0.62 });
type Quality = 'low' | 'medium' | 'high';

function createWaterNormals(size = 256): THREE.DataTexture {
  let seed = 0x51f15e;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const grids = [
    { w: 4, h: 3, a: 0.38 }, { w: 9, h: 6, a: 0.27 },
    { w: 18, h: 13, a: 0.17 }, { w: 35, h: 25, a: 0.11 }, { w: 67, h: 43, a: 0.07 },
  ].map(g => ({ ...g, data: Float32Array.from({ length: g.w * g.h }, random) }));
  const smooth = (x: number) => x * x * (3 - 2 * x);
  const heightAt = (u: number, v: number) => grids.reduce((sum, g) => {
    u -= Math.floor(u); v -= Math.floor(v);
    const x = u * g.w, y = v * g.h, ix = Math.floor(x), iy = Math.floor(y);
    const fx = smooth(x - ix), fy = smooth(y - iy);
    const x0 = ix % g.w, x1 = (ix + 1) % g.w, y0 = iy % g.h, y1 = (iy + 1) % g.h;
    const a = g.data[y0 * g.w + x0], b = g.data[y0 * g.w + x1];
    const c = g.data[y1 * g.w + x0], d = g.data[y1 * g.w + x1];
    return sum + ((a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy) * g.a;
  }, 0);
  const data = new Uint8Array(size * size * 4), du = 1 / size;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    const dx = (heightAt(u + du, v) - heightAt(u - du, v)) / (2 * du);
    const dy = (heightAt(u, v + du) - heightAt(u, v - du)) / (2 * du);
    let nx = -dx * 0.075, ny = -dy * 0.075, nz = 1;
    const inv = 1 / Math.hypot(nx, ny, nz); nx *= inv; ny *= inv; nz *= inv;
    const i = (y * size + x) * 4;
    data[i] = Math.round((nx * 0.5 + 0.5) * 255);
    data[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
    data[i + 2] = Math.round((nz * 0.5 + 0.5) * 255); data[i + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true; texture.colorSpace = THREE.NoColorSpace; texture.needsUpdate = true;
  return texture;
}

function addProceduralWaveDisplacement(water: Water): boolean {
  let vertexShader = water.material.vertexShader;
  let fragmentShader = water.material.fragmentShader;
  const mainTag = 'void main() {';
  const mirrorTag = 'mirrorCoord = modelMatrix * vec4( position, 1.0 );';
  const viewPattern = /vec4\s+mvPosition\s*=\s*modelViewMatrix\s*\*\s*vec4\(\s*position,\s*1\.0\s*\);/;
  const outgoingTag = 'vec3 outgoingLight = albedo;';
  if (!vertexShader.includes(mainTag) || !vertexShader.includes(mirrorTag) || !viewPattern.test(vertexShader)) {
    console.warn('[C3 ocean] Water.js vertex shader changed; using normal-map waves only.');
    water.material.uniforms.uWaveStrength = { value: SETTINGS.waves };
    water.material.uniforms.uFoamStrength = { value: SETTINGS.foam };
    return false;
  }
  const declarations = (/uniform\s+float\s+time\s*;/.test(vertexShader.split(mainTag)[0]) ? '' : 'uniform float time;') +
    'uniform float uWaveStrength; varying vec2 vWaveSlope;';
  vertexShader = vertexShader.replace(mainTag, `${declarations}${mainTag}`);
  vertexShader = vertexShader.replace(mirrorTag, `
      vec3 displacedPosition = position;
      vec2 baseP = vec2(position.x, -position.y);
      float t = time;
      float warpA = baseP.y*.018 + t*.09;
      float warpB = baseP.y*.047 - t*.15;
      float warpC = baseP.x*.016 - t*.10;
      float warpD = baseP.x*.039 + baseP.y*.011 + t*.13;
      float warpX = 3.40*sin(warpA) + 1.40*sin(warpB);
      float warpZ = 2.80*sin(warpC) + .90*sin(warpD);
      float warpX_dz = 3.40*.018*cos(warpA) + 1.40*.047*cos(warpB);
      float warpZ_dx = 2.80*.016*cos(warpC) + .90*.039*cos(warpD);
      float warpZ_dz = .90*.011*cos(warpD);
      vec2 p = baseP + vec2(warpX, warpZ);
      float p1=dot(p,vec2(.050,.022))+t*.62;
      float p2=dot(p,vec2(-.037,.091))+t*.91+1.17;
      float p3=dot(p,vec2(.132,-.096))+t*1.13+2.36;
      float p4=dot(p,vec2(-.172,-.142))+t*1.43+.42;
      float p5=dot(p,vec2(.27,-.205))+t*1.72+1.8;
      float p6=dot(p,vec2(-.088,.182))+t*.77+.87;
      float p7=dot(p,vec2(.33,.052))+t*1.92+2.08;
      float p8=dot(p,vec2(-.214,.276))+t*.83+2.61;
      float p9=dot(p,vec2(.342,.173))+t*2.03+.38;
      float p10=dot(p,vec2(-.284,-.233))+t*1.57+4.05;
      float s1=sin(p1),s2=sin(p2),s3=sin(p3),s4=sin(p4),s5=sin(p5),s6=sin(p6),s7=sin(p7),s8=sin(p8),s9=sin(p9),s10=sin(p10);
      float c1=cos(p1),c2=cos(p2),c3=cos(p3),c4=cos(p4),c5=cos(p5),c6=cos(p6),c7=cos(p7),c8=cos(p8),c9=cos(p9),c10=cos(p10);
      float h=.59*s1+.31*s2+.165*s3+.085*s4+.033*s5+.055*s6+.024*s7+.045*s8+.023*s9+.016*s10;
      // The reference demo has no roadway. Keep its wave pattern but cap height so crests
      // remain below the existing asphalt without moving or reshaping the circuit.
      displacedPosition.z = h * uWaveStrength * 0.38;
      float horizontalX=.22*(.59*.915*c1+.31*(-.377)*c2+.165*.808*c3+.085*(-.771)*c4+.033*.796*c5+.055*(-.435)*c6+.024*.988*c7+.045*(-.613)*c8+.023*.892*c9+.016*(-.773)*c10)*uWaveStrength*.38;
      float horizontalZ=.22*(.59*.403*c1+.31*.927*c2+.165*(-.588)*c3+.085*(-.636)*c4+.033*(-.605)*c5+.055*.900*c6+.024*.156*c7+.045*.790*c8+.023*.452*c9+.016*(-.634)*c10)*uWaveStrength*.38;
      displacedPosition.x += horizontalX; displacedPosition.y -= horizontalZ;
      float dhdx=.59*c1*(.050+.022*warpZ_dx)+.31*c2*(-.037+.091*warpZ_dx)+.165*c3*(.132-.096*warpZ_dx)+.085*c4*(-.172-.142*warpZ_dx)+.033*c5*(.27-.205*warpZ_dx)+.055*c6*(-.088+.182*warpZ_dx)+.024*c7*(.33+.052*warpZ_dx)+.045*c8*(-.214+.276*warpZ_dx)+.023*c9*(.342+.173*warpZ_dx)+.016*c10*(-.284-.233*warpZ_dx);
      float dhdz=.59*c1*(.050*warpX_dz+.022*(1.0+warpZ_dz))+.31*c2*(-.037*warpX_dz+.091*(1.0+warpZ_dz))+.165*c3*(.132*warpX_dz-.096*(1.0+warpZ_dz))+.085*c4*(-.172*warpX_dz-.142*(1.0+warpZ_dz))+.033*c5*(.27*warpX_dz-.205*(1.0+warpZ_dz))+.055*c6*(-.088*warpX_dz+.182*(1.0+warpZ_dz))+.024*c7*(.33*warpX_dz+.052*(1.0+warpZ_dz))+.045*c8*(-.214*warpX_dz+.276*(1.0+warpZ_dz))+.023*c9*(.342*warpX_dz+.173*(1.0+warpZ_dz))+.016*c10*(-.284*warpX_dz-.233*(1.0+warpZ_dz));
      vWaveSlope = vec2(dhdx,dhdz) * uWaveStrength * 0.38;
      mirrorCoord = modelMatrix * vec4(displacedPosition, 1.0);`);
  vertexShader = vertexShader.replace(viewPattern, 'vec4 mvPosition = modelViewMatrix * vec4( displacedPosition, 1.0 );');

  if (fragmentShader.includes(outgoingTag) && fragmentShader.includes('uniform sampler2D normalSampler;')) {
    fragmentShader = fragmentShader.replace(mainTag, 'uniform float uWaveStrength; uniform float uFoamStrength; varying vec2 vWaveSlope;' + mainTag);
    const normalLine = /vec3 surfaceNormal = normalize\(\s*noise\.xzy \* vec3\(\s*1\.5,\s*1\.0,\s*1\.5\s*\)\s*\);/;
    if (normalLine.test(fragmentShader)) fragmentShader = fragmentShader.replace(normalLine,
      `vec3 surfaceNormal = normalize(noise.xzy * vec3(1.5,1.0,1.5));
       vec3 swellNormal=normalize(vec3(-vWaveSlope.x,1.0,-vWaveSlope.y));
       float normalDetailFade=1.0-smoothstep(80.0,420.0,length(eye-worldPosition.xyz));
       surfaceNormal=normalize(swellNormal+(surfaceNormal-vec3(0.0,1.0,0.0))*mix(.32,.72,normalDetailFade));`);
    fragmentShader = fragmentShader.replace(outgoingTag, `${outgoingTag}
      float crestNoise=texture2D(normalSampler,(worldPosition.xz+vec2(time*1.25,-time*.86))*.052).r;
      float crestFoam=smoothstep(.75*uWaveStrength*.38,1.03*uWaveStrength*.38,worldPosition.y);
      crestFoam*=smoothstep(.40,.62,crestNoise)*(1.0-smoothstep(135.0,500.0,distance));
      outgoingLight=mix(outgoingLight,vec3(.68,.79,.77),crestFoam*.22*uFoamStrength);
      float oceanHaze=smoothstep(260.0,1100.0,distance);
      outgoingLight=mix(outgoingLight,vec3(.20,.145,.12),oceanHaze*.28);`);
    // Keep the reference's lower-Fresnel material response (r186 ships with .02).
    fragmentShader = fragmentShader.replace('float rf0 = 0.02;', 'float rf0 = 0.055;');
  } else {
    console.warn('[C3 ocean] Water.js fragment shader changed; retaining normal-map waves.');
  }
  water.material.vertexShader = vertexShader;
  water.material.fragmentShader = fragmentShader;
  water.material.uniforms.uWaveStrength = { value: SETTINGS.waves };
  water.material.uniforms.uFoamStrength = { value: SETTINGS.foam };
  water.material.needsUpdate = true;
  return true;
}

export function createC3WaterSurface(sourceGeometry: THREE.BufferGeometry): C3WaterSurface {
  // C3 spans roughly x[-720,720], z[-466,466]; this envelope keeps a
  // ~130 m visual margin while avoiding a large invisible far field.
  // The previous 6000x6000 plane was mostly outside the playable city and
  // still paid vertex/frustum work every frame.
  const width = 1700;
  const height = 1200;
  const mobile = typeof window !== 'undefined' && window.innerWidth < 700;
  // One reflection pass is the dominant C3 GPU cost. This keeps the water
  // visually crisp at phone distance while cutting the pass workload 4x.
  const reflectionSize = mobile ? 64 : 128;
  // The game reflects the full race scene, unlike the standalone ocean study.
  // Keep broad geometric swells while bounding the full-scene reflection cost.
  // The custom wave shader supplies the visual detail; this grid only needs
  // enough vertices for broad swells, not the 1.9 km far field.
  const segments = mobile ? 48 : 64;
  const geometry = new THREE.PlaneGeometry(width, height, segments, segments);
  const normals = createWaterNormals(256);
  const sunDirection = new THREE.Vector3(-0.640, 0.500, -0.585).normalize();
  const water = new Water(geometry, {
    textureWidth: reflectionSize, textureHeight: reflectionSize, waterNormals: normals,
    sunDirection, sunColor: 0xffc18a, waterColor: 0x073346,
    distortionScale: 1.35 + SETTINGS.foam * 1.25,
    alpha: 1, fog: false,
  });
  water.material.onBeforeCompile = (shader) => {
    shader.uniforms.c3ReflectionStrength = { value: 0.12 };
    shader.fragmentShader = shader.fragmentShader.replace(
      'float reflectance = rf0 + ( 1.0 - rf0 ) * pow( ( 1.0 - theta ), 5.0 );',
      'float reflectance = rf0 + ( 1.0 - rf0 ) * pow( ( 1.0 - theta ), 5.0 );\n\t\t\t\t\t reflectance *= c3ReflectionStrength;'
    );
    water.userData.c3ReflectionUniform = shader.uniforms.c3ReflectionStrength;
  };
  water.name = 'C3 PELAGIC Open Ocean';
  water.frustumCulled = true;
  water.material.uniforms.sunDirection.value.copy(sunDirection);
  water.material.uniforms.sunColor.value.set(0xffc18a);
  water.material.uniforms.waterColor.value.set(0x073346);
  water.material.uniforms.size.value = 0.92 + SETTINGS.foam * 0.26;
  const displacementEnabled = addProceduralWaveDisplacement(water);
  const diagnostics: C3WaterSurface['diagnostics'] = {
    reflectionSize, refractionSize: 0, refractionPasses: 0, hasDepth: false,
    fallback: !displacementEnabled, reflectionPasses: 0, skippedPasses: 0, lastError: null,
  };
  water.userData.c3WaterDiagnostics = diagnostics;
  water.material.userData.quality = 'high' as Quality;
  water.material.userData.setQuality = (quality: Quality) => {
    water.material.userData.quality = quality;
    const reflectionUniform = water.userData.c3ReflectionUniform as { value: number } | undefined;
    if (reflectionUniform) reflectionUniform.value = quality === 'high' ? 0.12 : quality === 'medium' ? 0.085 : 0.055;
    // Water.js owns one real-time reflection pass; lower quality attenuates distortion
    // while keeping this reference's ocean lighting stable across graphics profiles.
    water.material.uniforms.distortionScale.value = quality === 'high' ? 1.35 + SETTINGS.foam * 1.25 :
      quality === 'medium' ? 1.35 + SETTINGS.foam * 0.8 : 1.35;
    water.material.uniforms.uWaveStrength.value = quality === 'low' ? SETTINGS.waves * 0.72 : SETTINGS.waves;
  };
  const lastReflectionPosition = new THREE.Vector3();
  const lastReflectionQuaternion = new THREE.Quaternion();
  const reflectionCameraPosition = new THREE.Vector3();
  const reflectionCameraQuaternion = new THREE.Quaternion();
  let hasReflectionCamera = false;
  let lastReflectionFrame = -Infinity;
  let reflectionExcludedObjects: THREE.Object3D[] | null = null;
  const internalBeforeRender = water.onBeforeRender;
  water.onBeforeRender = function(renderer, scene, camera, ...rest) {
    const quality = (water.material.userData.quality as Quality | undefined) ?? 'high';
    // Water.js renders the complete scene into its mirror on this callback.
    // Keep animated waves live, but rebuild the expensive mirror only when
    // the view actually changed enough to justify new reflected geometry.
    camera.getWorldPosition(reflectionCameraPosition);
    camera.getWorldQuaternion(reflectionCameraQuaternion);
    const positionThreshold = quality === 'high' ? 0.35 : quality === 'medium' ? 0.22 : 0.28;
    const moved = !hasReflectionCamera ||
      reflectionCameraPosition.distanceToSquared(lastReflectionPosition) > positionThreshold * positionThreshold ||
      1 - Math.abs(reflectionCameraQuaternion.dot(lastReflectionQuaternion)) > 0.0002;
    const maxAgeFrames = quality === 'high' ? 2 : quality === 'medium' ? 2 : 3;
    const dueByAge = reflectionFrame - lastReflectionFrame >= maxAgeFrames;
    if (!moved && !dueByAge) {
      diagnostics.skippedPasses++;
      reflectionFrame++;
      return;
    }
    reflectionFrame++;
    lastReflectionPosition.copy(reflectionCameraPosition);
    lastReflectionQuaternion.copy(reflectionCameraQuaternion);
    lastReflectionFrame = reflectionFrame;
    hasReflectionCamera = true;

    // Distant landmarks remain fully visible in the main camera, but they do
    // not materially improve the water reflection and can add many draws.
    // Hide only explicitly tagged reflection decor during Water.js' nested
    // scene render, restoring every visibility flag immediately afterwards.
    if (!reflectionExcludedObjects) {
      reflectionExcludedObjects = [];
      scene.traverse((object) => {
        if (object !== water && object.userData.c3ReflectionExclude === true) {
          reflectionExcludedObjects!.push(object);
        }
      });
    }
    const previousVisibility = reflectionExcludedObjects.map((object) => object.visible);
    reflectionExcludedObjects.forEach((object) => { object.visible = false; });
    diagnostics.reflectionPasses++;
    try {
      internalBeforeRender.call(this, renderer, scene, camera, ...rest);
    } finally {
      reflectionExcludedObjects.forEach((object, index) => { object.visible = previousVisibility[index]; });
    }
  };
  let time = 0, disposed = false, reflectionFrame = 0;
  sourceGeometry.dispose();
  return {
    mesh: water,
    update(dt: number) {
      if (disposed || !Number.isFinite(dt) || dt <= 0) return;
      time = (time + Math.min(dt, 0.25) * SETTINGS.wind) % 100000;
      const uniforms = water.material.uniforms;
      const quality = (water.material.userData.quality as Quality | undefined) ?? 'high';
      if (uniforms.time) uniforms.time.value = time;
      // uWaveStrength/uFoamStrength/distortionScale are changed only by
      // setQuality; rewriting them here created avoidable driver work.
      void quality;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      const reflection = water.material.uniforms.mirrorSampler?.value as THREE.Texture | undefined;
      reflection?.dispose();
      water.material.uniforms.normalSampler?.value?.dispose?.();
      water.material.dispose();
      geometry.dispose();
      diagnostics.reflectionSize = 0;
      diagnostics.reflectionPasses = 0;
    },
    diagnostics,
  };
}
