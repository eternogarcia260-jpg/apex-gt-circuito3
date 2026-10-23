import * as THREE from 'three';

export type GraphicsQualityPreset = 'low' | 'medium' | 'high' | 'ultra';

export interface GraphicsQualityProfile {
  id: GraphicsQualityPreset;
  label: string;
  sublabel: string;
  targetFpsLabel: string;
  pixelRatioCap: number;
  shadowsEnabled: boolean;
  shadowMapSize: number;
  heatHazeEnabled: boolean;
  cinematicOpticsEnabled: boolean;
  particleBudgetMultiplier: number;
  description: string;
}

export const GRAPHICS_PROFILES: Record<GraphicsQualityPreset, GraphicsQualityProfile> = {
  low: {
    id: 'low',
    label: 'Baja',
    sublabel: 'Ahorro Batería / Móvil',
    targetFpsLabel: '60 FPS Estables',
    pixelRatioCap: 1.0,
    shadowsEnabled: true,
    shadowMapSize: 512,
    heatHazeEnabled: false,
    cinematicOpticsEnabled: true,
    particleBudgetMultiplier: 0.5,
    description: 'Máxima fluidez con sombras y óptica cinemática optimizadas.',
  },
  medium: {
    id: 'medium',
    label: 'Media',
    sublabel: 'Equilibrado',
    targetFpsLabel: '60 FPS',
    pixelRatioCap: 1.25,
    shadowsEnabled: true,
    shadowMapSize: 768,
    heatHazeEnabled: true,
    cinematicOpticsEnabled: true,
    particleBudgetMultiplier: 0.75,
    description: 'Sombras nítidas de 1024px, refracción térmica completa y óptica cinemática.',
  },
  high: {
    id: 'high',
    label: 'Alta',
    sublabel: 'Recomendada',
    targetFpsLabel: '60 FPS Ultra-Nítido',
    pixelRatioCap: 1.6,
    shadowsEnabled: true,
    shadowMapSize: 2048,
    heatHazeEnabled: true,
    cinematicOpticsEnabled: true,
    particleBudgetMultiplier: 1.0,
    description: 'Sombras nítidas PCF de 2048px, refracción térmica de motor y partículas completas.',
  },
  ultra: {
    id: 'ultra',
    label: 'Ultra',
    sublabel: 'Máxima Fidelidad',
    targetFpsLabel: '120 FPS / GPU Pro',
    pixelRatioCap: 1.75,
    shadowsEnabled: true,
    shadowMapSize: 2048,
    heatHazeEnabled: true,
    cinematicOpticsEnabled: true,
    particleBudgetMultiplier: 1.25,
    description: 'Resolución nativa completa, sombras suaves de 2048px y simulación óptica total.',
  },
};

const STORAGE_KEY = 'apex_graphics_quality';

export class GraphicsQualityManager {
  private currentPreset: GraphicsQualityPreset = 'high';
  private renderer: THREE.WebGLRenderer;
  private dirLight?: THREE.DirectionalLight;
  private container: HTMLElement;

  // Adaptive Frame Pacing State
  public isAdaptivePacerActive: boolean = true;
  private frameTimes: number[] = new Array(60).fill(16.6);
  private frameTimeIndex: number = 0;
  private currentAppliedDpr: number = 1.0;
  private pacerCooldownTimer: number = 0;
  private pacerThrottleScale: number = 1.0; // 0.78 to 1.0 multiplier under thermal/GPU stress

  // Callback hooks for dependent subsystems
  public onQualityChanged?: (preset: GraphicsQualityPreset, profile: GraphicsQualityProfile) => void;

  constructor(renderer: THREE.WebGLRenderer, container: HTMLElement, dirLight?: THREE.DirectionalLight) {
    this.renderer = renderer;
    this.container = container;
    this.dirLight = dirLight;

    // Detect default preset from storage or hardware capability
    this.currentPreset = this.detectOptimalInitialPreset();
  }

  public setDirectionalLight(dirLight: THREE.DirectionalLight): void {
    this.dirLight = dirLight;
    this.applyProfile(this.currentPreset, false);
  }

  private detectOptimalInitialPreset(): GraphicsQualityPreset {
    const isMobile =
      typeof window !== 'undefined' &&
      (window.innerWidth < 768 ||
        (navigator.maxTouchPoints && navigator.maxTouchPoints > 1 && window.innerWidth < 1024));
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as GraphicsQualityPreset;
      if (saved && GRAPHICS_PROFILES[saved] && !(isMobile && (saved === 'high' || saved === 'ultra'))) {
        return saved;
      }
    } catch {
      // Ignore localStorage read errors in restricted contexts
    }

    // Hardware heuristic: mobile screen width / touch / core count
    return isMobile ? 'medium' : 'high';
  }

  public getPreset(): GraphicsQualityPreset {
    return this.currentPreset;
  }

  public getProfile(): GraphicsQualityProfile {
    return GRAPHICS_PROFILES[this.currentPreset];
  }

  public setPreset(preset: GraphicsQualityPreset): void {
    if (!GRAPHICS_PROFILES[preset]) return;
    this.currentPreset = preset;
    try {
      localStorage.setItem(STORAGE_KEY, preset);
    } catch {}

    this.pacerThrottleScale = 1.0;
    this.applyProfile(preset, true);

    if (this.onQualityChanged) {
      this.onQualityChanged(preset, GRAPHICS_PROFILES[preset]);
    }
  }

  public applyProfile(preset: GraphicsQualityPreset, updateShaders = true): void {
    const profile = GRAPHICS_PROFILES[preset];
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1.0 : 1.0;
    const baseTargetDpr = Math.min(dpr, profile.pixelRatioCap);
    const finalDpr = Math.max(0.85, baseTargetDpr * this.pacerThrottleScale);

    this.currentAppliedDpr = finalDpr;
    this.renderer.setPixelRatio(finalDpr);

    const w = this.container.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 1280);
    const h = this.container.clientHeight || (typeof window !== 'undefined' ? window.innerHeight : 720);
    this.renderer.setSize(w, h, false);
    if (this.renderer.domElement) {
      this.renderer.domElement.style.width = '100%';
      this.renderer.domElement.style.height = '100%';
      this.renderer.domElement.style.display = 'block';
    }

    // Dynamic Shadow Map Scaling
    if (this.dirLight) {
      if (profile.shadowsEnabled) {
        this.renderer.shadowMap.enabled = true;
        this.dirLight.castShadow = true;
        if (this.dirLight.shadow.mapSize.width !== profile.shadowMapSize) {
          this.dirLight.shadow.mapSize.set(profile.shadowMapSize, profile.shadowMapSize);
          if (this.dirLight.shadow.map && updateShaders) {
            this.dirLight.shadow.map.dispose();
            this.dirLight.shadow.map = null as any;
          }
        }
      } else {
        this.renderer.shadowMap.enabled = false;
        this.dirLight.castShadow = false;
        if (this.dirLight.shadow.map) {
          this.dirLight.shadow.map.dispose();
          this.dirLight.shadow.map = null as any;
        }
      }
    }
  }

  /**
   * Adaptive Frame Pacer: Samples real-time frametime without garbage collection.
   * If frametime exceeds 19ms (<52 FPS) on average, smoothly scales down resolution by up to 18%.
   * When frametime recovers below 14.5ms (>68 FPS), smoothly restores native resolution.
   */
  public tick(rawDt: number): void {
    const dtMs = rawDt * 1000.0;
    this.frameTimes[this.frameTimeIndex] = dtMs;
    this.frameTimeIndex = (this.frameTimeIndex + 1) % this.frameTimes.length;

    if (!this.isAdaptivePacerActive) return;

    this.pacerCooldownTimer += rawDt;
    if (this.pacerCooldownTimer < 0.75) return; // Evaluate every 750ms
    this.pacerCooldownTimer = 0;

    let sum = 0;
    for (let i = 0; i < 60; i++) {
      sum += this.frameTimes[i];
    }
    const avgFrametimeMs = sum / 60.0;

    const profile = GRAPHICS_PROFILES[this.currentPreset];
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1.0 : 1.0;
    const baseTargetDpr = Math.min(dpr, profile.pixelRatioCap);

    let needsAdjustment = false;

    // Detect thermal or GPU bottleneck (<56 FPS / >17.8ms)
    if (avgFrametimeMs > 17.8) {
      if (this.pacerThrottleScale > 0.78) {
        this.pacerThrottleScale = Math.max(0.78, this.pacerThrottleScale - 0.05);
        needsAdjustment = true;
      }
    } else if (avgFrametimeMs < 15.2) {
      // GPU has generous headroom (>65 FPS) -> gradually restore full target sharpness
      if (this.pacerThrottleScale < 1.0) {
        this.pacerThrottleScale = Math.min(1.0, this.pacerThrottleScale + 0.03);
        needsAdjustment = true;
      }
    }

    if (needsAdjustment) {
      const newDpr = Math.max(0.85, baseTargetDpr * this.pacerThrottleScale);
      if (Math.abs(newDpr - this.currentAppliedDpr) > 0.03) {
        this.currentAppliedDpr = newDpr;
        this.renderer.setPixelRatio(newDpr);
      }
    }
  }

  public getCurrentDpr(): number {
    return this.currentAppliedDpr;
  }
}
