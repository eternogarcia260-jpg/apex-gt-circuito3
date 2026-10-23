/**
 * DynamicSkySystem.ts - Physically-Based Atmospheric Clear Sky
 *
 * Engineered for high-end 3D racing simulators (60-120 FPS rock-solid):
 * 1. Physical Rayleigh Atmosphere, Ozone & Sunset Horizon:
 *    - Deep cobalt zenith transitioning smoothly to warm sunset horizon.
 *    - Ozone Chappuis band in mid-elevations (delicate twilight violet).
 *    - Belt of Venus and Earth's Shadow on the anti-solar horizon.
 *    - Solar azimuth forward scattering warming at the low horizon.
 * 2. Solar Disc & Mie Corona Scattering Bloom:
 *    - Crisp photosphere disc with limb darkening.
 *    - Multi-tier incandescent corona flare with golden halo.
 * 3. Seamless Equirectangular PBR Environment Reflection Map:
 *    - Ultra-clean atmospheric gradient and solar flare reflection for cars.
 * 4. Maximum Performance & Efficiency:
 *    - Clear sky dome without cloud noise evaluation: lightning-fast ALU performance.
 *    - Single draw call, zero texture lookups, zero VRAM bandwidth overhead.
 *    - Zero CPU allocations in the animation loop.
 */

import * as THREE from 'three';

export interface DynamicSkyConfig {
  zenithColor?: THREE.Color;
  horizonColor?: THREE.Color;
  sunColor?: THREE.Color;
  groundHazeColor?: THREE.Color;
  cloudCoverage?: number;
  cloudDensity?: number;
  windSpeed1?: number;
  windSpeed2?: number;
}

export class DynamicSkySystem {
  public readonly group: THREE.Group;
  private readonly mesh: THREE.Mesh;
  private readonly material: THREE.ShaderMaterial;
  private readonly uniforms: {
    uTime: { value: number };
    uSunDirection: { value: THREE.Vector3 };
    uSunColor: { value: THREE.Vector3 };
    uSkyZenithColor: { value: THREE.Vector3 };
    uSkyHorizonColor: { value: THREE.Vector3 };
    uGroundHazeColor: { value: THREE.Vector3 };
    uIsNight: { value: number };
  };

  private envTexture: THREE.Texture | null = null;

  constructor(config?: DynamicSkyConfig) {
    this.group = new THREE.Group();

    // Physically-calibrated sunset colors
    const zenith = config?.zenithColor ?? new THREE.Color(0x061434);
    const horizon = config?.horizonColor ?? new THREE.Color(0xf48838);
    const sunCol = config?.sunColor ?? new THREE.Color(0xffeed6);
    const groundHaze = config?.groundHazeColor ?? new THREE.Color(0x121620);

    this.uniforms = {
      uTime: { value: 0 },
      uSunDirection: { value: new THREE.Vector3(-0.68, 0.17, -0.71).normalize() },
      uSunColor: { value: new THREE.Vector3(sunCol.r, sunCol.g, sunCol.b) },
      uSkyZenithColor: { value: new THREE.Vector3(zenith.r, zenith.g, zenith.b) },
      uSkyHorizonColor: { value: new THREE.Vector3(horizon.r, horizon.g, horizon.b) },
      uGroundHazeColor: { value: new THREE.Vector3(groundHaze.r, groundHaze.g, groundHaze.b) },
      uIsNight: { value: 0.0 },
    };

    const vertexShader = `
      varying vec3 vWorldRay;

      void main() {
        // Local position on the dome (centered on camera) gives the exact world direction ray
        vWorldRay = position;
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `;

    const fragmentShader = `
      precision highp float;

      varying vec3 vWorldRay;

      uniform float uTime;
      uniform float uIsNight;
      uniform vec3 uSunDirection;
      uniform vec3 uSunColor;
      uniform vec3 uSkyZenithColor;
      uniform vec3 uSkyHorizonColor;
      uniform vec3 uGroundHazeColor;

      void main() {
        vec3 ray = normalize(vWorldRay);
        float elevation = clamp(ray.y, 0.0005, 1.0);

        // Night Sky Mode (Singapore Marina Bay nocturnal atmosphere with stars & urban glow)
        if (uIsNight > 0.5) {
          vec3 nightZenith = vec3(0.015, 0.026, 0.065);
          vec3 cityHorizon = vec3(0.045, 0.088, 0.165);
          float nightGrad = pow(elevation, 0.42);
          vec3 nightAtmosphere = mix(cityHorizon, nightZenith, nightGrad);

          // Twinkling celestial stars
          if (elevation > 0.08) {
            vec3 starRay = normalize(vWorldRay);
            float starHash = fract(sin(dot(floor(starRay * 380.0), vec3(12.9898, 78.233, 45.164))) * 43758.5453);
            if (starHash > 0.992) {
              float starTwinkle = 0.55 + 0.45 * sin(uTime * 3.8 + starHash * 80.0);
              nightAtmosphere += vec3(0.85, 0.92, 1.0) * starTwinkle * (elevation - 0.08) * 1.8;
            }
          }

          // Soft lunar disc glow
          float moonAngle = dot(ray, normalize(vec3(-0.35, 0.85, -0.45)));
          if (moonAngle > 0.998) {
            nightAtmosphere += vec3(0.82, 0.90, 1.0) * 2.2;
          }

          if (ray.y < 0.0) {
            float groundFactor = clamp(-ray.y * 4.0, 0.0, 1.0);
            nightAtmosphere = mix(nightAtmosphere, vec3(0.012, 0.016, 0.024), groundFactor);
          }

          gl_FragColor = vec4(nightAtmosphere, 1.0);
          return;
        }

        // ---------------------------------------------------------------------
        // A. PHYSICAL RAYLEIGH ATMOSPHERE, OZONE & SUNSET HORIZON
        // ---------------------------------------------------------------------
        float cosSun = dot(ray, uSunDirection);
        float sunAngle = clamp(cosSun, 0.0, 1.0);

        // Elevation-based Rayleigh curve (extends deep blue cobalt down to near the horizon)
        float rayleighExp = pow(elevation, 0.46);
        vec3 atmosphere = mix(uSkyHorizonColor, uSkyZenithColor, rayleighExp);

        // Ozone Chappuis band in mid-elevations (delicate twilight violet)
        float ozoneWeight = smoothstep(0.04, 0.32, elevation) * (1.0 - smoothstep(0.32, 0.75, elevation));
        vec3 ozoneTwilight = vec3(0.28, 0.18, 0.44);
        atmosphere = mix(atmosphere, ozoneTwilight, ozoneWeight * 0.38);

        // Belt of Venus & Earth's Shadow on the anti-solar horizon
        float antiSun = clamp(-cosSun, 0.0, 1.0);
        float venusBand = smoothstep(0.015, 0.12, elevation) * (1.0 - smoothstep(0.12, 0.32, elevation)) * antiSun;
        vec3 venusRose = vec3(0.68, 0.42, 0.52);
        vec3 earthShadow = vec3(0.06, 0.10, 0.20);
        atmosphere = mix(atmosphere, venusRose, venusBand * 0.55);
        if (elevation < 0.06 && antiSun > 0.25) {
          atmosphere = mix(atmosphere, earthShadow, (1.0 - elevation / 0.06) * antiSun * 0.55);
        }

        // Solar azimuth forward scattering warming (strictly at the low horizon near the sun)
        float forwardScatter = pow(max(0.0, cosSun), 3.5) * (1.0 - smoothstep(0.0, 0.18, elevation));
        vec3 goldenGlow = vec3(1.0, 0.74, 0.40);
        atmosphere = mix(atmosphere, goldenGlow, forwardScatter * 0.65);

        // ---------------------------------------------------------------------
        // B. SOLAR DISC & MIE CORONA SCATTERING BLOOM
        // ---------------------------------------------------------------------
        // Crisp photosphere disc with limb darkening (warm sunset disc)
        float sunDisc = smoothstep(0.9991, 0.9997, sunAngle);
        float limb = pow(clamp((sunAngle - 0.9991) / (0.9997 - 0.9991), 0.0, 1.0), 0.5);
        vec3 sunDiscRadiance = uSunColor * (sunDisc * (0.90 + 0.45 * limb) * 7.5);

        // Multi-tier Mie corona flare with crisp golden halo
        float coronaWide = pow(max(0.0, cosSun), 4.2) * 0.25;
        float coronaMid = pow(max(0.0, cosSun), 20.0) * 0.50;
        float coronaCore = pow(max(0.0, cosSun), 160.0) * 1.30;
        vec3 coronaColor = mix(vec3(1.0, 0.72, 0.35), uSunColor, 0.70);
        vec3 solarCorona = coronaColor * coronaWide + uSunColor * (coronaMid + coronaCore);

        // Base atmospheric sky dome color
        vec3 skyColor = atmosphere + solarCorona + sunDiscRadiance;

        // ---------------------------------------------------------------------
        // C. SEAMLESS BELOW-HORIZON GROUND TRANSITION
        // ---------------------------------------------------------------------
        if (ray.y < 0.0) {
          float groundFactor = clamp(-ray.y * 4.0, 0.0, 1.0);
          vec3 groundBase = mix(uSkyHorizonColor * 0.45, uGroundHazeColor, groundFactor);
          skyColor = mix(skyColor, groundBase, groundFactor);
        }

        gl_FragColor = vec4(skyColor, 1.0);
      }
    `;

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: this.uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: true,
      fog: false,
    });

    // Inverted sky dome centered continuously on camera
    const geometry = new THREE.SphereGeometry(950, 64, 32);
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.frustumCulled = false;
    this.group.add(this.mesh);
  }

  /**
   * Generates a seamless 360° equirectangular environment texture for IBL car reflections
   * matching the atmospheric daylight palette and sunset lighting.
   */
  public generateEnvironmentMap(renderer: THREE.WebGLRenderer, isNight: boolean = false): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;

    // 1. Physically-calibrated atmosphere vertical gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, 1024);
    if (isNight) {
      skyGrad.addColorStop(0.0, '#02050e');  // Zenith deep dark space
      skyGrad.addColorStop(0.30, '#060e22'); // Midnight blue
      skyGrad.addColorStop(0.44, '#0e1d3d'); // High Singapore skyline dome
      skyGrad.addColorStop(0.485, '#1e3a6a'); // Urban sodium/mercury horizon glow
      skyGrad.addColorStop(0.50, '#38bdf8'); // Floodlight rim highlight
      skyGrad.addColorStop(0.51, '#0c1524'); // Distant city towers silhouette
      skyGrad.addColorStop(0.56, '#060a12'); // Dark tarmac perimeter
      skyGrad.addColorStop(1.0, '#03050a');  // Deep specular ground
    } else {
      skyGrad.addColorStop(0.0, '#040d22');  // Zenith deep twilight cobalt
      skyGrad.addColorStop(0.30, '#12244a'); // Mid-sky royal cobalt
      skyGrad.addColorStop(0.44, '#262842'); // Ozone Chappuis twilight transition
      skyGrad.addColorStop(0.485, '#e07628'); // Warm sunset horizon band
      skyGrad.addColorStop(0.50, '#ffbe58'); // Low crisp golden solar horizon line
      skyGrad.addColorStop(0.51, '#161c24'); // Distant mountains & terrain in cool dusk silhouette
      skyGrad.addColorStop(0.56, '#0d1015'); // Track perimeter asphalt transition
      skyGrad.addColorStop(1.0, '#07090c');  // Neutral dark bitumen ground bounce
    }
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, 2048, 1024);

    if (isNight) {
      // 2. High-power 5600K Xenon stadium floodlight reflection ribbon on horizon
      const floodGrad = ctx.createLinearGradient(0, 500, 0, 526);
      floodGrad.addColorStop(0.0, 'rgba(255, 255, 255, 0.0)');
      floodGrad.addColorStop(0.4, 'rgba(248, 250, 252, 0.95)');
      floodGrad.addColorStop(0.6, 'rgba(56, 189, 248, 0.85)');
      floodGrad.addColorStop(1.0, 'rgba(14, 165, 233, 0.0)');
      ctx.fillStyle = floodGrad;
      ctx.fillRect(0, 500, 2048, 26);

      // Delicate lunar / high-radiance cold xenon source in upper sky
      const moonX = 680;
      const moonY = 220;
      const moonGrad = ctx.createRadialGradient(moonX, moonY, 2, moonX, moonY, 140);
      moonGrad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
      moonGrad.addColorStop(0.15, 'rgba(224, 242, 254, 0.7)');
      moonGrad.addColorStop(0.50, 'rgba(125, 211, 252, 0.2)');
      moonGrad.addColorStop(1.0, 'rgba(14, 165, 233, 0.0)');
      ctx.fillStyle = moonGrad;
      ctx.beginPath();
      ctx.arc(moonX, moonY, 140, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // 2. Exact solar disc and high-radiance incandescent golden corona (Daytime for Circuit 1 & 2)
      const sun = this.uniforms.uSunDirection.value;
      const uNorm = (Math.atan2(sun.z, sun.x) / (Math.PI * 2) + 0.5 + 1.0) % 1.0;
      const vNorm = 0.5 - Math.asin(THREE.MathUtils.clamp(sun.y, -1, 1)) / Math.PI;
      const sunX = uNorm * 2048;
      const sunY = vNorm * 1024;

      const sunGrad = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 420);
      sunGrad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
      sunGrad.addColorStop(0.04, 'rgba(255, 245, 200, 0.98)');
      sunGrad.addColorStop(0.14, 'rgba(255, 205, 110, 0.65)');
      sunGrad.addColorStop(0.35, 'rgba(240, 140, 50, 0.22)');
      sunGrad.addColorStop(0.70, 'rgba(200, 90, 30, 0.05)');
      sunGrad.addColorStop(1.0, 'rgba(180, 70, 20, 0.0)');
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(sunX, sunY, 420, 0, Math.PI * 2);
      ctx.fill();
    }

    const canvasTexture = new THREE.CanvasTexture(canvas);
    canvasTexture.mapping = THREE.EquirectangularReflectionMapping;
    canvasTexture.colorSpace = THREE.SRGBColorSpace;
    canvasTexture.wrapS = THREE.RepeatWrapping;
    canvasTexture.wrapT = THREE.ClampToEdgeWrapping;
    canvasTexture.needsUpdate = true;

    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const envMap = pmrem.fromEquirectangular(canvasTexture).texture;
    pmrem.dispose();
    canvasTexture.dispose();

    const previousEnvTexture = this.envTexture;
    this.envTexture = envMap;
    if (previousEnvTexture && previousEnvTexture !== envMap) previousEnvTexture.dispose();
    return envMap;
  }

  /**
   * Updates dome position to lock to camera (infinite skybox illusion)
   * Zero GC allocations in loop.
   */
  public update(dt: number, cameraPos: THREE.Vector3, sunDir?: THREE.Vector3): void {
    // Keep dome centered around camera at all times (zero clipping)
    this.mesh.position.copy(cameraPos);

    this.uniforms.uTime.value = (this.uniforms.uTime.value + dt) % 86400.0;

    if (sunDir) {
      this.uniforms.uSunDirection.value.copy(sunDir).normalize();
    }
  }

  public setSunDirection(sunDir: THREE.Vector3): void {
    this.uniforms.uSunDirection.value.copy(sunDir).normalize();
  }

  public setNightMode(isNight: boolean): void {
    this.uniforms.uIsNight.value = isNight ? 1.0 : 0.0;
  }

  public getSkyZenithColor(): THREE.Color {
    return new THREE.Color(
      this.uniforms.uSkyZenithColor.value.x,
      this.uniforms.uSkyZenithColor.value.y,
      this.uniforms.uSkyZenithColor.value.z
    );
  }

  public getSkyHorizonColor(): THREE.Color {
    return new THREE.Color(
      this.uniforms.uSkyHorizonColor.value.x,
      this.uniforms.uSkyHorizonColor.value.y,
      this.uniforms.uSkyHorizonColor.value.z
    );
  }

  public getGroundHazeColor(): THREE.Color {
    return new THREE.Color(
      this.uniforms.uGroundHazeColor.value.x,
      this.uniforms.uGroundHazeColor.value.y,
      this.uniforms.uGroundHazeColor.value.z
    );
  }

  public getSunColor(): THREE.Color {
    return new THREE.Color(
      this.uniforms.uSunColor.value.x,
      this.uniforms.uSunColor.value.y,
      this.uniforms.uSunColor.value.z
    );
  }

  public setCloudCoverage(_coverage: number): void {
    // Clouds removed per design specification
  }

  public setCloudDensity(_density: number): void {
    // Clouds removed per design specification
  }

  public dispose(): void {
    this.material.dispose();
    this.mesh.geometry.dispose();
    if (this.envTexture) {
      this.envTexture.dispose();
      this.envTexture = null;
    }
  }
}
