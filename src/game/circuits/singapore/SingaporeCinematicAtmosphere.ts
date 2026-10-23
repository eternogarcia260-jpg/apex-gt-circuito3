import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { createC3SelectiveBloom } from './SingaporeSelectiveBloom';
import { createC3TrackFloodlights, type C3TrackFloodlights } from './SingaporeTrackFloodlights';
import { SINGAPORE_WAYPOINTS } from './SingaporeWaypoints';

function disableC3EmissiveMaterials(root: THREE.Group): number {
  const seen = new Set<THREE.Material>();
  let disabled = 0;
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (seen.has(material)) continue;
      seen.add(material);
      const emissive = material as THREE.Material & {
        emissive?: THREE.Color; emissiveIntensity?: number; emissiveMap?: THREE.Texture | null;
      };
      if (!emissive.emissive) continue;
      emissive.emissive.set(0x000000);
      if (typeof emissive.emissiveIntensity === 'number') emissive.emissiveIntensity = 0;
      if (emissive.emissiveMap) emissive.emissiveMap = null;
      material.needsUpdate = true;
      disabled++;
    }
  });
  return disabled;
}

/** Cielo atmosférico, nubes y luz golden-hour del estudio PELAGIC, limitado a C3. */
export class SingaporeCinematicAtmosphere {
  public readonly sky: Sky;
  public readonly diagnostics = {
    renders: 0, nestedRenders: 0, restored: 0, exposure: 1.08,
    environmentIntensity: 0, keyIntensity: 3.35, fillIntensity: 0.72,
    fogNear: 0, fogFar: 0, active: false,
  };
  private scene?: THREE.Scene;
  private previousBefore?: THREE.Scene['onBeforeRender'];
  private previousAfter?: THREE.Scene['onAfterRender'];
  private readonly fog = null;
  private readonly bloom = createC3SelectiveBloom();
  private readonly trackLighting: C3TrackFloodlights;
  private readonly cloudMaterial: THREE.ShaderMaterial;
  private readonly cloudNoise: THREE.DataTexture;
  private readonly cloudDome: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  private readonly sunDirection = new THREE.Vector3();
  private readonly depth = { value: 0 };
  private time = 0;
  private disposed = false;
  private readonly cameraWorld = new THREE.Vector3();
  private readonly cameraLocal = new THREE.Vector3();
  private snapshot?: {
    renderer: THREE.WebGLRenderer; exposure: number; environment: THREE.Texture | null;
    environmentIntensity: number; fog: THREE.Scene['fog'];
    hidden: Array<{ object: THREE.Object3D; visible: boolean }>;
    lights: Array<{
      light: THREE.Light; color: THREE.Color; intensity: number; visible: boolean;
      position: THREE.Vector3; targetPosition?: THREE.Vector3; ground?: THREE.Color;
      bias?: number; normalBias?: number; radius?: number;
    }>;
    optical: Array<{ uniform: THREE.IUniform; value: number; target: number }>;
  };
  private bindings?: NonNullable<SingaporeCinematicAtmosphere['snapshot']>;
  private boundCamera?: THREE.Camera;
  private appliedQuality?: 'low' | 'medium' | 'high';
  private readonly added = () => { if (this.root.parent instanceof THREE.Scene) this.attach(this.root.parent); };
  private readonly removed = () => this.detach();
  private readonly before: THREE.Scene['onBeforeRender'] = (...args) => {
    if (!this.scene || this.disposed || this.root.parent !== this.scene) return;
    if (this.depth.value++ > 0) { this.diagnostics.nestedRenders++; return; }
    try { this.previousBefore?.apply(this.scene, args); this.apply(args[0], args[2]); }
    catch (error) { this.restore(); this.depth.value = 0; throw error; }
  };
  private readonly after: THREE.Scene['onAfterRender'] = (...args) => {
    if (this.depth.value === 0 || --this.depth.value > 0) return;
    const renderer = args[0];
    try {
      if (renderer.getRenderTarget() === null && this.root.userData.c3BloomEnabled !== false)
        this.bloom.render(renderer, this.root.userData.c3Quality ?? 'low');
    } finally { this.restore(); this.diagnostics.renders++; }
    this.previousAfter?.apply(this.scene!, args);
  };

  constructor(private readonly root: THREE.Group, private readonly onQuality?: (quality: 'low'|'medium'|'high') => void) {
    // UE5-style golden-hour key: still warm and directional, but high enough
    // to illuminate the asphalt instead of grazing it into near-black.
    this.sunDirection.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - 30), THREE.MathUtils.degToRad(222)).normalize();
    this.sky = new Sky();
    this.sky.name = 'C3_PELAGIC_AtmosphericSky';
    this.sky.scale.setScalar(1100);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -10000;
    this.sky.material.depthTest = false;
    this.sky.material.depthWrite = false;
    const uniforms = this.sky.material.uniforms;
    uniforms.turbidity.value = 5.6;
    uniforms.rayleigh.value = 1.9;
    uniforms.mieCoefficient.value = 0.0031;
    uniforms.mieDirectionalG.value = 0.82;
    uniforms.sunPosition.value.copy(this.sunDirection);
    this.root.add(this.sky);

    this.cloudNoise = createCloudNoiseTexture();
    this.cloudMaterial = new THREE.ShaderMaterial({
      name: 'C3_PELAGIC_ProceduralStratus',
      uniforms: {
        uTime: { value: 0 }, uSunDirection: { value: this.sunDirection.clone() }, uCloudNoise: { value: this.cloudNoise },
      },
      vertexShader: 'varying vec3 vCloudDir; void main(){vCloudDir=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: `
        precision highp float;
        uniform float uTime; uniform vec3 uSunDirection; uniform sampler2D uCloudNoise;
        varying vec3 vCloudDir; const float PI=3.141592653589793;
        void main(){
          vec3 d=normalize(vCloudDir); float elevation=asin(clamp(d.y,-1.0,1.0));
          float longitude=atan(d.z,d.x)/(2.0*PI)+0.5;
          vec2 uv=vec2(fract(longitude),clamp((elevation+0.12)/0.72,0.0,1.0));
          vec4 warp=texture2D(uCloudNoise,uv*vec2(.82,1.12)+vec2(uTime*.0016,.17-uTime*.0003));
          vec2 warpedUV=uv+(warp.rg-.5)*vec2(.105,.046)+vec2(-uTime*.0017,0.0);
          vec4 cloudA=texture2D(uCloudNoise,warpedUV+vec2(uTime*.0015,0.0));
          vec4 cloudB=texture2D(uCloudNoise,warpedUV*vec2(2.15,1.7)+vec2(-uTime*.0022,.31));
          float lowDensity=cloudA.r*.76+cloudB.g*.24;
          float lowShape=smoothstep(.455,.665,lowDensity);
          float lowBand=smoothstep(-.060,-.012,elevation)*(1.0-smoothstep(.115,.195,elevation));
          float lowAlpha=lowShape*lowBand*.50;
          vec4 highA=texture2D(uCloudNoise,warpedUV*vec2(2.35,3.1)+vec2(-uTime*.0031,.43));
          float highDensity=highA.b*.78+highA.g*.22;
          float cirrusShape=smoothstep(.475,.700,highDensity)*smoothstep(.31,.59,highA.g);
          float highBand=smoothstep(.125,.17,elevation)*(1.0-smoothstep(.31,.39,elevation));
          float highAlpha=cirrusShape*highBand*.13;
          float cloudsAlpha=lowAlpha+highAlpha*(1.0-lowAlpha);
          vec3 sunDir=normalize(uSunDirection); float sunDot=clamp(dot(d,sunDir),-1.0,1.0);
          float angularDistance=sqrt(max(0.0,2.0*(1.0-sunDot)));
          float haloWide=exp(-angularDistance*5.2), haloCore=exp(-angularDistance*18.0);
          float glowAlpha=clamp(haloWide*.20+haloCore*.13,0.0,.30);
          vec3 glowColor=mix(vec3(1.13,.39,.19),vec3(1.42,.88,.59),smoothstep(.005,.17,angularDistance));
          float sunward=smoothstep(-.30,.62,sunDot);
          vec3 cloudShadow=mix(vec3(.105,.145,.225),vec3(.285,.205,.235),sunward*.82);
          vec3 cloudLit=mix(vec3(.42,.46,.58),vec3(1.14,.69,.44),sunward);
          float cloudTop=smoothstep(.50,.76,lowDensity);
          vec3 lowColor=mix(cloudShadow,cloudLit,.24+.72*cloudTop);
          vec3 highColor=mix(vec3(.34,.39,.52),vec3(.96,.70,.56),sunward*.72);
          highColor*=.78+.28*smoothstep(.51,.77,highDensity);
          vec3 cloudsColor=(lowColor*lowAlpha+highColor*highAlpha*(1.0-lowAlpha))/max(cloudsAlpha,.0001);
          vec3 premul=cloudsColor*cloudsAlpha+glowColor*glowAlpha*(1.0-cloudsAlpha);
          float alpha=cloudsAlpha+glowAlpha*(1.0-cloudsAlpha); if(alpha<.006) discard;
          gl_FragColor=vec4(premul/max(alpha,.0001),clamp(alpha,0.0,.76));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      transparent: true, depthWrite: false, depthTest: true, side: THREE.BackSide,
      blending: THREE.NormalBlending,
    });
    this.cloudDome = new THREE.Mesh(new THREE.SphereGeometry(1000, 64, 48), this.cloudMaterial);
    this.cloudDome.name = 'C3_PELAGIC_CloudDome'; this.cloudDome.frustumCulled = false; this.cloudDome.renderOrder = -9999;
    this.root.add(this.cloudDome);
    this.trackLighting = createC3TrackFloodlights(root, SINGAPORE_WAYPOINTS, 7);
    this.trackLighting.setIntensity(0);
    root.userData.c3ArtificialLighting = {
      sunOnly: true,
      trackSpotlightIntensity: 0,
      emissiveMaterialsDisabled: disableC3EmissiveMaterials(root),
    };
    root.userData.c3Bloom = this.bloom.diagnostics;
    root.userData.c3Environment = { preset: 'PELAGIC golden hour', sunElevationDegrees: 30, sunAzimuthDegrees: 222 };
    root.addEventListener('added', this.added); root.addEventListener('removed', this.removed);
    if (root.parent instanceof THREE.Scene) this.attach(root.parent);
  }

  update(dt: number): void {
    if (!Number.isFinite(dt) || dt <= 0) return;
    this.time = (this.time + Math.min(dt, 0.25)) % 86400;
    this.cloudMaterial.uniforms.uTime.value = this.time;
  }

  private attach(scene: THREE.Scene): void {
    if (this.scene === scene || this.disposed) return;
    this.detach(); this.scene = scene;
    this.previousBefore = scene.onBeforeRender; this.previousAfter = scene.onAfterRender;
    scene.onBeforeRender = this.before; scene.onAfterRender = this.after;
    this.diagnostics.active = true;
  }

  private apply(renderer: THREE.WebGLRenderer, camera: THREE.Camera): void {
    const scene = this.scene!;
    let state = this.bindings;
    if (!state) {
      state = { renderer, exposure: 0, environment: null, environmentIntensity: 1, fog: null, hidden: [], lights: [], optical: [] };
      scene.traverse(object => {
        if (object instanceof THREE.Light) {
          state!.lights.push({
            light: object, color: new THREE.Color(), intensity: 0, visible: object.visible, position: new THREE.Vector3(),
            targetPosition: object instanceof THREE.DirectionalLight ? new THREE.Vector3() : undefined,
            ground: object instanceof THREE.HemisphereLight ? new THREE.Color() : undefined,
          });
        } else if (object instanceof THREE.Mesh && object !== this.sky && object !== this.cloudDome && !Array.isArray(object.material)) {
          const material = object.material;
          if (material instanceof THREE.ShaderMaterial && material.uniforms.uSkyZenithColor && material.uniforms.uIsNight)
            state!.hidden.push({ object, visible: object.visible });
        }
      });
      this.bindings = state;
    }
    if (this.boundCamera !== camera) {
      state.optical.length = 0;
      camera.traverse(object => {
        if (!(object instanceof THREE.Mesh) || Array.isArray(object.material)) return;
        const material = object.material;
        if (!(material instanceof THREE.ShaderMaterial) || !material.uniforms.uVignetteIntensity || !material.uniforms.uSunFacing) return;
        for (const [name, target] of [['uIsNight',0],['uSunFacing',0],['uVignetteIntensity',0.10],['uGrainIntensity',0.003]] as const) {
          const uniform = material.uniforms[name]; if (uniform) state!.optical.push({ uniform, value: uniform.value, target });
        }
      });
      this.boundCamera = camera;
    }
    state.renderer = renderer; state.exposure = renderer.toneMappingExposure;
    state.environment = scene.environment; state.environmentIntensity = scene.environmentIntensity; state.fog = scene.fog;
    this.snapshot = state;
    const taggedKey = state.lights.find(e => e.light.userData.c3PrimarySun)?.light;
    const key = (taggedKey instanceof THREE.DirectionalLight ? taggedKey :
      state.lights.find(e => e.light instanceof THREE.DirectionalLight)?.light) as THREE.DirectionalLight | undefined;
    const shadowSize = key?.shadow.mapSize.width ?? 512;
    const quality = shadowSize <= 512 ? 'low' : shadowSize <= 1024 ? 'medium' : 'high';
    this.root.userData.c3Quality = quality;
    if (this.appliedQuality !== quality) {
      this.appliedQuality = quality;
      this.onQuality?.(quality);
    }
    this.trackLighting.update(camera, quality);

    renderer.toneMappingExposure = this.diagnostics.exposure;
    // The reference is lit directly by its sky/sun rather than a night-time studio environment or fog.
    scene.environment = null; scene.environmentIntensity = this.diagnostics.environmentIntensity; scene.fog = this.fog;
    camera.getWorldPosition(this.cameraWorld);
    this.cameraLocal.copy(this.cameraWorld); this.root.worldToLocal(this.cameraLocal);
    this.sky.position.copy(this.cameraLocal); this.sky.updateMatrix();
    this.cloudDome.position.copy(this.cameraLocal); this.cloudDome.updateMatrix();
    this.sky.visible = this.root.userData.c3SkyEnabled !== false;
    for (const entry of state.lights) {
      const light = entry.light; entry.color.copy(light.color); entry.intensity = light.intensity;
      entry.visible = light.visible;
      entry.position.copy(light.position);
      if (light instanceof THREE.DirectionalLight) {
        entry.targetPosition!.copy(light.target.position);
        entry.bias = light.shadow.bias; entry.normalBias = light.shadow.normalBias; entry.radius = light.shadow.radius;
      }
      if (light instanceof THREE.DirectionalLight && light === key) {
        light.color.set(0xffbd86); light.intensity = this.diagnostics.keyIntensity;
        light.visible = true;
        light.position.copy(this.cameraWorld).addScaledVector(this.sunDirection, 120);
        light.target.position.copy(this.cameraWorld);
        light.target.updateMatrixWorld(true); light.updateMatrixWorld(true);
        light.shadow.bias = -0.00014; light.shadow.normalBias = 0.007;
        light.shadow.radius = Math.max(1.0, shadowSize / 1024);
      } else if (light.userData.c3BounceLight) {
        // Broad cool bounce from the sky/sea. It has no shadow map and fills
        // the shaded side of the car and the inside of concrete barriers.
        light.color.set(0x78a9d6); light.intensity = 0.32; light.visible = true;
        light.position.copy(this.cameraWorld).addScaledVector(this.sunDirection, -90);
        if (light instanceof THREE.DirectionalLight) {
          light.target.position.copy(this.cameraWorld);
          light.target.updateMatrixWorld(true); light.updateMatrixWorld(true);
          light.castShadow = false;
        }
      } else if (light.userData.c3AmbientFill) {
        light.color.set(0xa9c8e6); light.intensity = this.diagnostics.fillIntensity;
        light.visible = true;
      } else {
        light.intensity = 0;
        light.visible = false;
      }
    }
    for (const entry of state.hidden) { entry.visible = entry.object.visible; entry.object.visible = false; }
    for (const entry of state.optical) { entry.value = entry.uniform.value; entry.uniform.value = entry.target; }
  }

  private restore(): void {
    const state = this.snapshot, scene = this.scene; if (!state || !scene) return;
    state.renderer.toneMappingExposure = state.exposure;
    scene.environment = state.environment; scene.environmentIntensity = state.environmentIntensity; scene.fog = state.fog;
    for (const entry of state.lights) {
      entry.light.color.copy(entry.color); entry.light.intensity = entry.intensity;
      entry.light.visible = entry.visible; entry.light.position.copy(entry.position);
      if (entry.light instanceof THREE.HemisphereLight && entry.ground) entry.light.groundColor.copy(entry.ground);
      if (entry.light instanceof THREE.DirectionalLight) {
        entry.light.target.position.copy(entry.targetPosition!); entry.light.target.updateMatrixWorld(true);
        entry.light.shadow.bias = entry.bias!; entry.light.shadow.normalBias = entry.normalBias!; entry.light.shadow.radius = entry.radius!;
        entry.light.updateMatrixWorld(true);
      }
    }
    for (const entry of state.hidden) entry.object.visible = entry.visible;
    for (const entry of state.optical) entry.uniform.value = entry.value;
    this.snapshot = undefined; this.diagnostics.restored++;
  }

  private detach(): void {
    this.restore(); this.depth.value = 0;
    if (this.scene) {
      if (this.scene.onBeforeRender === this.before) this.scene.onBeforeRender = this.previousBefore!;
      if (this.scene.onAfterRender === this.after) this.scene.onAfterRender = this.previousAfter!;
    }
    this.scene = undefined; this.previousBefore = undefined; this.previousAfter = undefined;
    this.bindings = undefined; this.boundCamera = undefined; this.diagnostics.active = false;
  }

  dispose(): void {
    if (this.disposed) return;
    this.detach(); this.disposed = true;
    this.root.removeEventListener('added', this.added); this.root.removeEventListener('removed', this.removed);
    this.bloom.dispose(); this.trackLighting.dispose();
    this.cloudNoise.dispose(); this.cloudMaterial.dispose(); this.cloudDome.geometry.dispose();
    // Sky geometry/material are also released by the builder's resource traversal.
  }
}

function createCloudNoiseTexture(width = 512, height = 256): THREE.DataTexture {
  let seed = 0x37c4a91;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const grids = [4, 8, 16, 32, 64, 128].map((w, i) => {
    const h = [3, 5, 10, 20, 40, 80][i]; return { w, h, data: Float32Array.from({ length: w * h }, random) };
  });
  const smooth = (x: number) => x * x * (3 - 2 * x);
  const sample = (g: typeof grids[number], u: number, v: number) => {
    u -= Math.floor(u); v -= Math.floor(v); const x = u * g.w, y = v * g.h, ix = Math.floor(x), iy = Math.floor(y);
    const fx = smooth(x - ix), fy = smooth(y - iy), x0 = ix % g.w, x1 = (ix + 1) % g.w, y0 = iy % g.h, y1 = (iy + 1) % g.h;
    const a = g.data[y0 * g.w + x0], b = g.data[y0 * g.w + x1], c = g.data[y1 * g.w + x0], d = g.data[y1 * g.w + x1];
    return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
  };
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const u = x / width, v = y / height;
    const n = grids.map(g => sample(g, u, v));
    const r = n[0]*.45+n[1]*.26+n[2]*.15+n[3]*.08+n[4]*.06;
    const g = n[1]*.04+n[2]*.13+n[3]*.24+n[4]*.30+n[5]*.29;
    const b = n[2]*.06+n[3]*.18+n[4]*.31+n[5]*.45, i = (y * width + x) * 4;
    data[i]=Math.round(r*255); data[i+1]=Math.round(g*255); data[i+2]=Math.round(b*255); data[i+3]=255;
  }
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter; texture.generateMipmaps = true;
  texture.colorSpace = THREE.NoColorSpace; texture.needsUpdate = true; return texture;
}
