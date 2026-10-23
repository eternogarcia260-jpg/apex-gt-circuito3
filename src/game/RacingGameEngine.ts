/**
 * RacingGameEngine.ts - Master 3D Game Coordinator (Refactored Architecture)
 * High-performance orchestrator delegating to specialized subsystems:
 * - CameraSystem (Choreography, multi-views, FOV scaling, trauma)
 * - RaceLoopManager (Lap timing, sector splits, best lap, DRS)
 * - CollisionSubsystem (Spatial 28m grid, dual-sphere car collisions, wall scraping)
 * - MathPool (Centralized zero-GC scratch math pool)
 * - Fixed 120Hz Physics Timestep with alpha sub-frame interpolation
 */

import * as THREE from 'three';
import { DynamicSkySystem } from './environment/DynamicSkySystem';
import { EngineSound, EngineAudioLayersState } from './audio/EngineSound';
import { CarModel } from './models/CarModel';
import { ParticleSystem } from './particles/ParticleSystem';
import { HeatHazeEffect } from './effects/HeatHazeEffect';
import { SpeedPostEffect } from './effects/SpeedPostEffect';
import { CinematicPostEffect } from './effects/CinematicPostEffect';
import { PitStopManager } from './pit/PitStopManager';
import { CarInputs, VehiclePhysics } from './physics/VehiclePhysics';
import { DistantMountainBackdropBuilder } from './world/DistantMountainBackdropBuilder';
import { RivalTelemetryData } from './multiplayer/MultiplayerClient';
import { RivalCarInterpolator } from './multiplayer/RivalCarInterpolator';
import { TireCompoundType } from './physics/TireCompound';
import { CareerRaceManager } from './career/CareerRaceManager';
import { CareerRaceConfig, DriverLeaderboardEntry, RaceDifficulty, RaceLapOption, CustomLiverySettings, liverySettingsToTeamConfig } from './career/CareerTypes';
import { AICarController } from './ai/AICarController';
import { CircuitId, ICircuitDefinition, ITrackWorld } from './circuits/ICircuit';
import { getCircuit } from './circuits/CircuitRegistry';
import { MathPool } from './utils/MathPool';
import { CameraSystem, CameraViewMode, CameraDistanceMode } from './camera/CameraSystem';
import { CinematicDirector } from './camera/CinematicDirector';
import { RaceLoopManager } from './race/RaceLoopManager';
import { CollisionSubsystem } from './collisions/CollisionSubsystem';
import { RivalMechanicActor } from './pit/PitStopManager';
import { playF1BoxRadioConfirmation, playPenaltyVoiceAudio, preloadPenaltyVoiceAudio } from '../utils/uiAudio';
import { GraphicsQualityManager, GraphicsQualityPreset, GRAPHICS_PROFILES } from './graphics/GraphicsQualityManager';
import { PilotWalkManager, PilotCameraPreset } from './pilot/PilotWalkManager';

export type { CameraViewMode, CameraDistanceMode, GraphicsQualityPreset, EngineAudioLayersState, PilotCameraPreset };

export interface GameTelemetry {
  circuitId?: CircuitId;
  speedKmh: number;
  rpm: number;
  engineTemp: number;
  gear: number;
  health: number;
  engineHealth: number;
  suspLeft: number;
  suspRight: number;
  lapTime: number;
  bestLap: number | null;
  lapCount: number;
  isDrifting: boolean;
  isInPit: boolean;
  pitProgress: number;
  pitPhase: string;
  pitTimeRemaining: number;
  pitTotalTime: number;
  radioMessage: string | null;
  isGreenLightExit?: boolean;
  broadcastCamName: string | null;
  isMuted: boolean;
  isEngineSoundOn: boolean;
  audioLayers?: EngineAudioLayersState;
  audioSoloLayer?: keyof EngineAudioLayersState | 'all' | 'none';
  cameraMode: CameraViewMode;
  cameraDistance: CameraDistanceMode;
  carName: string;
  isCustomCar: boolean;
  crewName: string;
  isCustomCrew: boolean;
  carX: number;
  carZ: number;
  carYaw: number;
  tireCompound: TireCompoundType;
  nextPitTireCompound: TireCompoundType;
  tireWear: [number, number, number, number];
  isPunctured: [boolean, boolean, boolean, boolean];
  wheelEffectiveGrip: [number, number, number, number];
  wheelGripIndex: [number, number, number, number];
  tireFlatSpot: [number, number, number, number];
  isTireCliffActive: boolean;
  tireWheelspinActive: boolean;
  hasAnyPuncture: boolean;
  isDrsAvailable: boolean;
  isDrsOpen: boolean;
  isBoxRequested: boolean;
  isPreparedPitStop?: boolean;
  dynamicMaxSpeedKmh: number;
  isDamageLimiterActive: boolean;
  structuralIntegrity: number;
  graphicsQuality?: GraphicsQualityPreset;
  careerLeaderboard?: DriverLeaderboardEntry[];
  careerConfig?: CareerRaceConfig;
  isFreePractice?: boolean;
  penaltySeconds: number;
  penaltyAlert?: { text: string; subtext: string; remainingTime: number } | null;
}

export class RacingGameEngine {
  public isFreePractice: boolean = false;
  public isFreeCamera: boolean = false;
  public freeCamPos = new THREE.Vector3(0, 60, 0);
  public freeCamYaw = 0;
  public freeCamPitch = -Math.PI / 3;
  public freeCameraInputs = { forward: 0, right: 0, altitude: 0 };
  private container: HTMLElement;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;

  // Graphics Quality & Adaptive Frame Pacer
  public qualityManager: GraphicsQualityManager;

  // Primary Subsystems
  public audio: EngineSound;
  public physics: VehiclePhysics;
  public carModel: CarModel;
  public activeCircuit: ICircuitDefinition;
  public track: ITrackWorld;
  public particles: ParticleSystem;
  public heatHaze: HeatHazeEffect;
  public speedEffect: SpeedPostEffect;
  public cinematicOptics: CinematicPostEffect;
  public pitStop: PitStopManager;
  public careerRaceManager: CareerRaceManager;

  // Modular Subsystem Handlers
  public cameraSystem: CameraSystem;
  public cinematicDirector: CinematicDirector;
  public isCinematicPlaying: boolean = false;
  public pilotWalkManager: PilotWalkManager;
  public isPilotPresentationPlaying: boolean = false;
  public raceLoopManager: RaceLoopManager;
  public collisionSubsystem: CollisionSubsystem;

  // Environmental Lighting & Sky
  public dynamicSky!: DynamicSkySystem;
  private dirLight!: THREE.DirectionalLight;
  private lastShadowCarX: number = -9999;
  private lastShadowCarZ: number = -9999;
  private hemiLight!: THREE.HemisphereLight;
  private daySkyTexture?: THREE.Texture;
  private envMapTexture?: THREE.Texture;
  private isDisposed = false;

  // Simulation Timing & 120Hz Physics Determinism
  private static readonly FIXED_PHYSICS_DT: number = 1 / 120; // 120 Hz deterministic physics
  private static readonly MAX_PHYSICS_SUB_STEPS: number = 5; // Absorbs up to 41.6ms spikes cleanly
  private clock = new THREE.Clock();
  private isRunning = false;
  private animFrameId: number | null = null;
  public isPaused = false;
  private physicsAccumulator: number = 0;
  private lastFrameTimestamp: number = 0;

  // Controls input buffer
  public inputs: CarInputs = {
    throttle: 0,
    brake: 0,
    steering: 0,
    handbrake: false,
    drs: false,
  };

  // 1v1 Multiplayer State & Rival Car Model
  public isMultiplayer: boolean = false;
  public myPlayerId: 'p1' | 'p2' = 'p1';
  public rivalCarModel: CarModel | null = null;
  public rivalPhysics: VehiclePhysics = new VehiclePhysics();
  public rivalInterpolator: RivalCarInterpolator = new RivalCarInterpolator();
  public isControlsLocked: boolean = false;
  public totalRaceLaps: number = 3;
  public rivalLapCount: number = 1;
  public rivalCurrentSector: number = 0;
  public rivalSpeedKmh: number = 0;
  public rivalTelemetry: RivalTelemetryData | null = null;

  // Telemetry Callbacks & Subscribers
  public onTelemetryUpdate?: (data: GameTelemetry) => void;
  private _telemetrySubscribers: Array<(data: GameTelemetry) => void> = [];
  private telemetryTimer: number = 0;
  private resizeObserver?: ResizeObserver;

  private _telemetryPayload: GameTelemetry = {
    circuitId: 'square_apex',
    speedKmh: 0,
    rpm: 1000,
    engineTemp: 85,
    gear: 1,
    health: 100,
    engineHealth: 100,
    suspLeft: 100,
    suspRight: 100,
    lapTime: 0,
    bestLap: null,
    lapCount: 1,
    isDrifting: false,
    isInPit: false,
    pitProgress: 0,
    pitPhase: 'none',
    pitTimeRemaining: 0,
    pitTotalTime: 0,
    radioMessage: null,
    broadcastCamName: null,
    isMuted: false,
    isEngineSoundOn: true,
    audioSoloLayer: 'all',
    audioLayers: {
      base: true,
      v12: true,
      whistle: true,
      intake: true,
      engineFilter: true,
      dcBlock: true,
    },
    cameraMode: 'chase',
    cameraDistance: 'medium',
    carName: 'F1 Turbo GP',
    isCustomCar: false,
    crewName: 'Pit Crew Apex Scuderia',
    isCustomCrew: false,
    carX: -35,
    carZ: -130,
    carYaw: Math.PI / 2,
    tireCompound: 'soft',
    nextPitTireCompound: 'soft',
    tireWear: [0, 0, 0, 0],
    isPunctured: [false, false, false, false],
    wheelEffectiveGrip: [1.0, 1.0, 1.0, 1.0],
    wheelGripIndex: [1.0, 1.0, 1.0, 1.0],
    tireFlatSpot: [0, 0, 0, 0],
    isTireCliffActive: false,
    tireWheelspinActive: false,
    hasAnyPuncture: false,
    isDrsAvailable: true,
    isDrsOpen: false,
    isBoxRequested: false,
    dynamicMaxSpeedKmh: 325,
    isDamageLimiterActive: false,
    structuralIntegrity: 1.0,
    graphicsQuality: 'high',
    isFreePractice: false,
    careerLeaderboard: [],
    careerConfig: undefined,
    penaltySeconds: 0,
    penaltyAlert: null,
  };

  public totalPenaltySeconds: number = 0;
  public penaltyAlert: { text: string; subtext: string; remainingTime: number } | null = null;
  public lastMechanicPenaltyLap: number = -1;
  public lastBoxRequestTimestamp: number = 0;

  private _fourWheelsArray: THREE.Vector3[] = [
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
  ];

  // Getters/Setters delegating to subsystems for seamless backwards compatibility
  public get cameraMode(): CameraViewMode {
    return this.cameraSystem.cameraMode;
  }
  public set cameraMode(mode: CameraViewMode) {
    this.cameraSystem.cameraMode = mode;
  }
  public get cameraDistance(): CameraDistanceMode {
    return this.cameraSystem.cameraDistance;
  }
  public set cameraDistance(dist: CameraDistanceMode) {
    this.cameraSystem.cameraDistance = dist;
  }
  public get currentLapTime(): number {
    return this.raceLoopManager.currentLapTime;
  }
  public set currentLapTime(val: number) {
    this.raceLoopManager.currentLapTime = val;
  }
  public get bestLapTime(): number | null {
    return this.raceLoopManager.bestLapTime;
  }
  public set bestLapTime(val: number | null) {
    this.raceLoopManager.bestLapTime = val;
  }
  public get lapCount(): number {
    return this.raceLoopManager.lapCount;
  }
  public set lapCount(val: number) {
    this.raceLoopManager.lapCount = val;
  }
  public get currentSector(): number {
    return this.raceLoopManager.currentSector;
  }
  public set currentSector(val: number) {
    this.raceLoopManager.currentSector = val;
  }
  public get playerDrsEligible(): boolean {
    return this.raceLoopManager.playerDrsEligible;
  }
  public set playerDrsEligible(val: boolean) {
    this.raceLoopManager.playerDrsEligible = val;
  }
  public get playerInDrsZone(): boolean {
    return this.raceLoopManager.playerInDrsZone;
  }
  public set playerInDrsZone(val: boolean) {
    this.raceLoopManager.playerInDrsZone = val;
  }

  constructor(container: HTMLElement, initialCircuitId: CircuitId = 'square_apex') {
    this.container = container;
    this.activeCircuit = getCircuit(initialCircuitId);

    // 1. Three.js Scene with atmospheric horizon depth fog
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x1a2638, 380, 1250);

    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    const isLandscapeMobile = w > h && h < 650;

    // 2. Camera setup
    this.camera = new THREE.PerspectiveCamera(
      isLandscapeMobile ? 50 : 56,
      w / h,
      0.25,
      1200
    );
    this.camera.position.set(-45, 5, -130);

    // 3. Renderer with hardware-accelerated PCF Shadow Map and HDR tone mapping
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      precision: 'highp',
      stencil: false,
      depth: true,
    });
    this.renderer.setPixelRatio(Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 1.75));
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    // Quality Manager & Frame Pacer Initialization
    this.qualityManager = new GraphicsQualityManager(this.renderer, this.container);
    this.qualityManager.applyProfile(this.qualityManager.getPreset(), false);
    this.qualityManager.onQualityChanged = (_preset, profile) => {
      this.heatHaze.group.visible = profile.heatHazeEnabled;
      this.cinematicOptics.group.visible = profile.cinematicOpticsEnabled;
    };

    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.display = 'block';
    container.innerHTML = '';
    container.appendChild(this.renderer.domElement);

    // Continuous Sub-pixel Responsive Layout Engine with ResizeObserver
    if (typeof ResizeObserver !== 'undefined' && this.container) {
      this.resizeObserver = new ResizeObserver(() => {
        this.onResize();
      });
      this.resizeObserver.observe(this.container);
    }

    // 4. Subsystem initialization
    this.audio = new EngineSound();
    const pPose = this.activeCircuit.gridSlots.player;
    this.physics = new VehiclePhysics(pPose.x, pPose.z, pPose.yaw);
    this.carModel = new CarModel();
    this.track = this.activeCircuit.createTrackBuilder();
    this.particles = new ParticleSystem();
    this.heatHaze = new HeatHazeEffect();
    this.speedEffect = new SpeedPostEffect(this.camera);
    this.cinematicOptics = new CinematicPostEffect(this.camera);
    this.pitStop = new PitStopManager();
    this.careerRaceManager = new CareerRaceManager(this.scene);
    this.careerRaceManager.setCircuit(this.activeCircuit);

    // 5. Modular Subsystems
    this.cameraSystem = new CameraSystem(this.camera);
    this.cinematicDirector = new CinematicDirector(this.camera);
    this.pilotWalkManager = new PilotWalkManager(this.scene);
    this.raceLoopManager = new RaceLoopManager(this.activeCircuit);
    this.collisionSubsystem = new CollisionSubsystem();
    this.collisionSubsystem.buildObstacleSpatialGrid(this.track);
    preloadPenaltyVoiceAudio();

    // Add visual objects to scene graph
    this.scene.add(this.track.group);
    this.scene.add(this.carModel.group);
    this.scene.add(this.particles.group);
    this.scene.add(this.heatHaze.group);
    this.scene.add(this.speedEffect.group);
    this.scene.add(this.cinematicOptics.group);
    this.scene.add(this.pitStop.group);
    this.scene.add(this.camera);

    // 6. Environmental Lighting & Realistic Skybox
    this.setupLighting();
    this.setupSkybox();
    this.applyCircuitAtmosphere(this.activeCircuit.id);

    // 7. Connect Vehicle Physics Audio & Particle Event Hooks
    this.physics.onBackfire = (isHighRpm) => {
      this.audio.triggerBackfire(isHighRpm);
      this.carModel.triggerBackfire(isHighRpm);

      const leftPipe = MathPool.V0;
      const rightPipe = MathPool.V1;
      const rearDir = MathPool.V2;
      this.carModel.getExhaustWorldPositions(leftPipe, rightPipe, rearDir);
      this.particles.emitRealisticExhaust(leftPipe, rearDir, 'backfire');
      this.particles.emitRealisticExhaust(rightPipe, rearDir, 'backfire');
    };
    this.physics.onCrash = (force) => {
      this.audio.triggerCrash(force);
    };
    this.physics.onPitFinish = () => {
      this.audio.triggerPitChime();
    };
    this.physics.onTireBlowout = (wheelIdx) => {
      this.audio.triggerTireBlowout();
      this.audio.triggerPitRadio('puncture');
      this.cameraSystem.addTrauma(0.65);

      const wheelPos = MathPool.V0;
      this.carModel.getSingleWheelWorldPosition(wheelIdx, wheelPos);
      this.particles.emitSparks(wheelPos, MathPool.UP, 30);
      this.particles.emitImpactDust(wheelPos, MathPool.UP);
      this.particles.emitTireSmoke(wheelPos, 8, 1.0);
    };

    window.addEventListener('resize', this.onResize);

    // Initialize camera from the active circuit's player grid slot.
    const playerGridPose = this.activeCircuit.gridSlots.player;
    this.cameraSystem.resetToPose(playerGridPose.x, 0.35, playerGridPose.z, playerGridPose.yaw);

    // Pre-warm GPU pipelines
    try {
      this.renderer.compile(this.scene, this.camera);
    } catch {}

    // Start loop
    this.isRunning = true;
    this.clock.start();
    this.loop();
  }

  private setupLighting(): void {
    this.hemiLight = new THREE.HemisphereLight(0x9fc5e5, 0x342b28, 0.72);
    this.hemiLight.userData.c3AmbientFill = true;
    this.hemiLight.position.set(0, 100, 0);
    this.scene.add(this.hemiLight);

    // Broad sky bounce: no shadow map, stable cost, and physically plausible
    // cool fill on the side facing the open bay.
    const c3Bounce = new THREE.DirectionalLight(0x78a9d6, 0.32);
    c3Bounce.userData.c3BounceLight = true;
    c3Bounce.castShadow = false;
    this.scene.add(c3Bounce);
    this.scene.add(c3Bounce.target);

    this.dirLight = new THREE.DirectionalLight(0xffeed6, 2.6);
    this.dirLight.userData.c3PrimarySun = true;
    const initCarX = -35;
    const initCarZ = -130;
    const c3SunY = this.activeCircuit.id === 'singapore_marina' ? 63.0 : 36.0;
    this.dirLight.position.set(initCarX - 80, c3SunY, initCarZ - 74);
    this.dirLight.target.position.set(initCarX + 4, 0.2, initCarZ + 4);
    this.dirLight.castShadow = true;

    this.dirLight.shadow.mapSize.width = 1024;
    this.dirLight.shadow.mapSize.height = 1024;
    this.dirLight.shadow.camera.near = 5;
    this.dirLight.shadow.camera.far = this.activeCircuit.id === 'singapore_marina' ? 150 : 190;
    const shadowD = 60; // Focused 60m radius delivering 1.56x higher shadow texel density and ~35% lower shadow caster overhead
    this.dirLight.shadow.camera.left = -shadowD;
    this.dirLight.shadow.camera.right = shadowD;
    this.dirLight.shadow.camera.top = shadowD;
    this.dirLight.shadow.camera.bottom = -shadowD;
    this.dirLight.shadow.bias = -0.0003;
    this.dirLight.shadow.normalBias = 0.012;
    this.dirLight.shadow.camera.updateProjectionMatrix();

    this.scene.add(this.dirLight);
    this.scene.add(this.dirLight.target);
    this.dirLight.target.updateMatrixWorld();
    this.dirLight.updateMatrixWorld();

    // Delegate shadow map sizing and state to QualityManager
    this.qualityManager.setDirectionalLight(this.dirLight);

    const sunVec = MathPool.V0.set(-80, c3SunY, -74).normalize();
    this.particles.setSunDirection(sunVec);
    this.cinematicOptics.setSunDirection(sunVec);
    const hazeColor = MathPool.C0.set(0x381824);
    const skyAmbientColor = MathPool.C1.set(0x1a1222);
    DistantMountainBackdropBuilder.updateSunDirection(sunVec, this.dirLight.color, hazeColor, skyAmbientColor);
  }

  private setupSkybox(): void {
    this.dynamicSky = new DynamicSkySystem({
      zenithColor: new THREE.Color(0x061434),
      horizonColor: new THREE.Color(0xf48838),
      sunColor: new THREE.Color(0xffeed6),
      groundHazeColor: new THREE.Color(0x121620),
    });
    this.scene.add(this.dynamicSky.group);

    const sunDir = this.dirLight.position.clone().sub(this.dirLight.target.position).normalize();
    this.dynamicSky.setSunDirection(sunDir);
    const hazeColor = new THREE.Color(0x381824);
    const skyAmbientColor = new THREE.Color(0x1a1222);
    DistantMountainBackdropBuilder.updateSunDirection(sunDir, this.dirLight.color, hazeColor, skyAmbientColor);

    const envMap = this.dynamicSky.generateEnvironmentMap(this.renderer);
    this.envMapTexture = envMap;
    this.scene.environment = envMap;
    this.scene.environmentIntensity = 1.15;
    this.scene.background = null;
  }

  public onResize = (): void => {
    if (!this.container) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w <= 0 || h <= 0) return;

    const isLandscapeMobile = w > h && h < 650;
    const aspect = w / h;
    this.camera.fov = isLandscapeMobile ? 50 : 56;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();

    if (this.cameraSystem) {
      this.cameraSystem.currentTargetFov = this.camera.fov;
    }

    this.qualityManager.applyProfile(this.qualityManager.getPreset(), false);

    // Propagate aspect ratio to screen-space optical shaders to prevent distortion
    if (this.speedEffect) {
      this.speedEffect.setAspect(aspect);
    }
    if (this.cinematicOptics) {
      this.cinematicOptics.setAspect(aspect);
    }
  };

  /**
   * Deterministic 120Hz Physics Timestep Loop with Alpha Sub-Frame Interpolation
   */
  private loop = (timestamp?: number): void => {
    if (!this.isRunning) return;
    this.animFrameId = requestAnimationFrame(this.loop);

    const now = typeof timestamp === 'number' ? timestamp : performance.now();
    let rawDt = this.lastFrameTimestamp > 0 ? (now - this.lastFrameTimestamp) * 0.001 : 1 / 60;
    this.lastFrameTimestamp = now;

    // Safety clamp (minimum 1ms, maximum 50ms)
    rawDt = Math.min(Math.max(rawDt, 0.001), 0.050);

    if (this.isFreeCamera) {
      const moveSpeed = 65.0 * rawDt;
      const fwd = this.freeCameraInputs.forward;
      const rt = this.freeCameraInputs.right;
      const alt = this.freeCameraInputs.altitude;

      const dirX = Math.sin(this.freeCamYaw);
      const dirZ = Math.cos(this.freeCamYaw);
      const perpX = Math.cos(this.freeCamYaw);
      const perpZ = -Math.sin(this.freeCamYaw);

      this.freeCamPos.x += (dirX * fwd + perpX * rt) * moveSpeed;
      this.freeCamPos.z += (dirZ * fwd + perpZ * rt) * moveSpeed;
      this.freeCamPos.y += alt * moveSpeed;
      this.freeCamPos.y = Math.max(5, Math.min(400, this.freeCamPos.y));

      this.camera.position.copy(this.freeCamPos);
      this.camera.lookAt(
        this.freeCamPos.x + dirX * 15,
        this.freeCamPos.y - 20,
        this.freeCamPos.z + dirZ * 15
      );
      this.renderer.render(this.scene, this.camera);
      return;
    }

    const dt = this.isPaused ? 0 : rawDt;

    if (!this.isPaused) {
      const isPitAutomated =
        this.pitStop.phase === 'entry_autopilot' ||
        this.pitStop.phase === 'docking' ||
        this.pitStop.phase === 'jacks_up' ||
        this.pitStop.phase === 'servicing' ||
        this.pitStop.phase === 'jacks_down' ||
        this.pitStop.phase === 'released' ||
        this.pitStop.phase === 'exit_autopilot';

      // 1. Fixed Timestep Physics Integration (120 Hz deterministic lockstep)
      if (!this.isPilotPresentationPlaying) {
        this.physicsAccumulator += dt;
        let substeps = 0;

        while (
          this.physicsAccumulator >= RacingGameEngine.FIXED_PHYSICS_DT &&
          substeps < RacingGameEngine.MAX_PHYSICS_SUB_STEPS
        ) {
          this.stepPhysics(RacingGameEngine.FIXED_PHYSICS_DT, isPitAutomated);
          this.track.updateDynamicProps(RacingGameEngine.FIXED_PHYSICS_DT);
          this.physicsAccumulator -= RacingGameEngine.FIXED_PHYSICS_DT;
          substeps++;
        }

        // Clamp excess accumulator to at most 1 fixed step to prevent accumulation debt
        if (this.physicsAccumulator > RacingGameEngine.FIXED_PHYSICS_DT) {
          this.physicsAccumulator = RacingGameEngine.FIXED_PHYSICS_DT;
        }
      } else {
        this.physicsAccumulator = 0;
      }

      const alpha = Math.min(1.0, Math.max(0.0, this.physicsAccumulator / RacingGameEngine.FIXED_PHYSICS_DT));

      // 2. Multiplayer Rival Car Interpolation
      if (this.isMultiplayer && this.rivalCarModel) {
        this.updateRivalCarInterpolation(dt);
      }

      // 3. Sync 3D Car Model transforms with sub-frame visual interpolation
      this.syncCarModel(dt, alpha);
      if (!this.isFreePractice && !this.isMultiplayer) {
        this.careerRaceManager.updateVisuals(dt, alpha);
      }

      // 4. Dynamic Props sub-frame visual interpolation & Grandstand Crowd Dynamics
      if (this.track.syncDynamicPropsVisuals) {
        this.track.syncDynamicPropsVisuals(alpha);
      }
      if (this.track.crowdSystem) {
        this.track.crowdSystem.update(dt, this.physics.position, Math.abs(this.physics.speed) * 3.6);
      }

      // 5. Particle System updates
      this.updateParticles(dt);

      // Visual-only C3 animation is decoupled from the fixed 120 Hz physics
      // loop: water, atmosphere and the Flyer do not need substep updates.
      this.track.updateVisualDynamicProps?.(dt);
    }

    // 5.5 Adaptive Frame Pacer Tick (tracks rolling frametime for 60/120 FPS target)
    this.qualityManager.tick(rawDt);

    const currentSpeedKmh = Math.abs(this.physics.speed) * 3.6;

    // 6. Atmospheric Heat Haze & Thermal Refraction Simulation
    if (this.qualityManager.getProfile().heatHazeEnabled) {
      this.heatHaze.group.visible = true;
      const carPosScratch = MathPool.V0.set(this.physics.position.x, this.physics.position.y, this.physics.position.z);
      this.heatHaze.update(rawDt, {
        engineTemp: this.physics.engineTemp,
        rpm: this.physics.rpm,
        speedKmh: currentSpeedKmh,
        throttle: this.isPaused ? 0 : this.inputs.throttle,
        carPosition: carPosScratch,
        carYaw: this.physics.yaw,
      });
    } else {
      this.heatHaze.group.visible = false;
    }

    // 7. High-Speed Optical Motion Streaks & Cinematic Broadcast Optics
    this.speedEffect.update(rawDt, currentSpeedKmh, this.isPaused);
    this.cinematicOptics.update(rawDt, currentSpeedKmh, this.isPaused);

    // 8. Camera Choreography (delegated to PilotWalkManager, CinematicDirector, or CameraSystem)
    if (this.isPilotPresentationPlaying) {
      this.pilotWalkManager.update(rawDt);
      this.pilotWalkManager.updateCamera(this.camera, rawDt);
    } else if (this.isCinematicPlaying) {
      const stillPlaying = this.cinematicDirector.update(rawDt);
      if (!stillPlaying) {
        this.isCinematicPlaying = false;
      }
    } else {
      this.cameraSystem.update(
        rawDt,
        this.carModel.group.position,
        this.carModel.group.rotation.y,
        this.physics.speed,
        this.physics.isDrifting,
        this.pitStop
      );
    }

    // 9. Audio update (strictly silenced during pilot presentation so voice narration is 100% crystal clear)
    const speedMs = this.isPaused ? 0 : Math.abs(this.physics.speed);
    if (this.isPilotPresentationPlaying || this.isCinematicPlaying) {
      this.audio.pause();
    } else {
      const audioRpm = this.isPaused ? 0 : this.physics.rpm;
      const audioThrottle = this.isPaused ? 0 : this.inputs.throttle;
      this.audio.update(
        audioRpm,
        audioThrottle,
        this.isPaused ? 0 : this.physics.slipRatio,
        speedMs,
        this.physics.damage.engineHealth / 100,
        this.isPaused ? false : this.physics.isDrifting,
        this.physics.gear,
        this.inputs.brake > 0.1 || this.inputs.handbrake
      );
      this.audio.updateFlatTireSound(this.physics.hasAnyPuncture, speedMs);
    }

    // 10. Advance dynamic sky simulation
    if (this.dynamicSky) {
      this.dynamicSky.update(rawDt, this.camera.position);
    }

    // 10.5 Advance Stewards Penalty Alert Timer (3.0s window)
    if (this.penaltyAlert) {
      this.penaltyAlert.remainingTime -= rawDt;
      if (this.penaltyAlert.remainingTime <= 0) {
        this.penaltyAlert = null;
      }
    }

    // 11. Render Scene
    this.renderer.render(this.scene, this.camera);

    // 12. Dispatch Telemetry (Throttled to 20Hz / 50ms without allocations)
    this.telemetryTimer += rawDt;
    if (this.telemetryTimer >= 0.050) {
      this.telemetryTimer = 0;
      this.dispatchTelemetry(speedMs);
    }
  };

  /**
   * Official FIA Stewards Penalty:
   * Adds +5.0s to race/lap time, broadcasts 3.0s visual alert banner on HUD and sounds alert chime
   */
  public handleRivalMechanicPenalty(_mech: RivalMechanicActor): void {
    const currentLap = this.raceLoopManager.lapCount;
    if (this.lastMechanicPenaltyLap === currentLap) {
      // Regla FIA: aunque se atropelle a varios mecánicos a la vez en la misma vuelta, solo se penaliza una vez por vuelta.
      return;
    }
    this.lastMechanicPenaltyLap = currentLap;
    this.totalPenaltySeconds += 5;
    this.raceLoopManager.currentLapTime += 5.0;
    this.penaltyAlert = {
      text: 'STEWARDS DECISION · +5s TIME PENALTY',
      subtext: 'COLLISION WITH RIVAL PIT CREW',
      remainingTime: 3.0,
    };
    this.audio.triggerPenaltyAlertTone();
    playPenaltyVoiceAudio();
  }

  private stepPhysics(fixedDt: number, isPitAutomated: boolean): void {
    if (this.inputs.brake > 0.05 || !this.physics.isDrsAvailable) {
      this.inputs.drs = false;
      this.physics.isDrsOpen = false;
    }

    let activeInputs: CarInputs;
    if (this.isControlsLocked) {
      activeInputs = {
        throttle: this.inputs.throttle,
        brake: 1.0,
        steering: 0,
        handbrake: true,
        drs: false,
      };
    } else if (isPitAutomated) {
      this.inputs.throttle = 0;
      this.inputs.brake = 0;
      this.inputs.steering = 0;
      this.inputs.handbrake = false;
      this.inputs.drs = false;
      activeInputs = {
        throttle: 0,
        brake: 0,
        steering: 0,
        handbrake: false,
        drs: false,
      };
    } else {
      activeInputs = {
        throttle: this.inputs.throttle,
        brake: this.inputs.brake,
        steering: this.inputs.steering,
        handbrake: this.inputs.handbrake,
        drs: this.inputs.drs,
      };
    }

    if (!isPitAutomated) {
      this.physics.update(fixedDt, activeInputs);
    } else {
      this.physics.lateralSpeed = 0;
      this.physics.angularVelocity = 0;
    }

    if (this.isControlsLocked) {
      this.physics.speed = 0;
      this.physics.lateralSpeed = 0;
      this.physics.angularVelocity = 0;
      const gridSlot = this.isMultiplayer
        ? (this.myPlayerId === 'p1' ? this.activeCircuit.gridSlots.player : this.activeCircuit.gridSlots.ai(1))
        : this.activeCircuit.gridSlots.player;
      this.physics.position.x = gridSlot.x;
      this.physics.position.y = 0.35;
      this.physics.position.z = gridSlot.z;
      this.physics.yaw = gridSlot.yaw;
      this.physics.gear = 1;
    }

    if (!isPitAutomated) {
      this.collisionSubsystem.checkStaticCollisions(
        fixedDt,
        this.physics,
        this.particles,
        this.audio,
        (trauma) => this.cameraSystem.addTrauma(trauma)
      );
      this.collisionSubsystem.checkDynamicPropCollisions(
        this.physics,
        this.track,
        this.audio
      );
      this.collisionSubsystem.checkRivalMechanicCollisions(
        this.physics,
        this.pitStop,
        this.audio,
        this.particles,
        (mech) => {
          this.handleRivalMechanicPenalty(mech);
        }
      );
    }

    // Pit stop update & Crew animations
    this.pitStop.update(fixedDt, this.physics, this.carModel, this.particles, this.audio, this.inputs);
    this.physics.isLockedInPit = (this.pitStop.phase === 'jacks_up' || this.pitStop.phase === 'servicing' || this.pitStop.phase === 'jacks_down');
    this.checkPitStopArea();

    // Lap tracking & Career simulation
    const lapProgress = this.raceLoopManager.updateLapProgress(this.physics.position.x, this.physics.position.z, this.track);
    if (lapProgress.lapCompleted) {
      // If the driver crosses the finish line into a new lap without entering the pit lane, auto-cancel the box call
      // (Grace period: do not cancel if it was requested within the last 3.5 seconds for the upcoming lap)
      const timeSinceRequest = (performance.now() - this.lastBoxRequestTimestamp) * 0.001;
      if (this.pitStop.phase === 'none' && !this.physics.isInPitStop && this.pitStop.isBoxNotified && timeSinceRequest > 3.5) {
        this.pitStop.isBoxNotified = false;
      }
    }
    this.raceLoopManager.updateDRSSystem(fixedDt, this.physics, this.inputs, this.isFreePractice, this.isMultiplayer);
    this.raceLoopManager.currentLapTime += fixedDt;

    if (!this.isFreePractice && !this.isMultiplayer) {
      this.careerRaceManager.update(
        fixedDt,
        this.physics,
        this.raceLoopManager.lapCount,
        this.raceLoopManager.currentSector,
        this.raceLoopManager.currentLapTime,
        this.raceLoopManager.bestLapTime,
        this.pitStop.phase !== 'none' || this.physics.isInPitStop,
        this.particles,
        this.audio,
        this.isControlsLocked
      );
    }

    // Physical collisions
    this.collisionSubsystem.checkCarToCarCollisions(
      fixedDt,
      this.physics,
      this.carModel,
      this.careerRaceManager.aiCars,
      this.rivalPhysics,
      this.rivalCarModel ?? undefined,
      this.isMultiplayer,
      this.isControlsLocked,
      this.isFreePractice,
      this.particles,
      this.audio,
      (amt) => this.cameraSystem.addTrauma(amt),
      (car) => this.isVehicleInPitLane(car)
    );
    this.collisionSubsystem.checkAiStaticCollisions(
      this.careerRaceManager.aiCars,
      this.isControlsLocked,
      this.isFreePractice
    );
  }

  public isVehicleInPitLane(car: { id: string; physics: VehiclePhysics; isPlayer: boolean; aiRef?: AICarController }): boolean {
    if (car.isPlayer) {
      if (this.pitStop.phase !== 'none' || this.physics.isInPitStop) return true;
    }
    const pz = this.track.pitZone || { minX: -65.0, maxX: 45.0, minZ: -120.0, maxZ: -106.0 };
    const x = car.physics.position.x;
    const z = car.physics.position.z;
    if (x >= (pz.minX - 18.0) && x <= (pz.maxX + 18.0) && z >= (pz.minZ - 0.8) && z <= (pz.maxZ + 6.0)) {
      return true;
    }
    if (car.aiRef) {
      if (car.aiRef.isInPitLane || car.aiRef.isStationaryInBox || car.aiRef.isEnteringPitTransition) return true;
    }
    return false;
  }

  private checkPitStopArea(): void {
    const { x, z } = this.physics.position;
    const pz = this.track.pitZone;
    const inPit = (x >= pz.minX && x <= pz.maxX && z >= pz.minZ && z <= pz.maxZ) || this.pitStop.phase !== 'none';
    this.physics.isInPitStop = inPit;

    if (this.pitStop.phase === 'none' && this.pitStop.cooldownTimer <= 0) {
      const isBeforePitWall = x >= -75.0 && x < -49.0 && z >= -121.0 && z <= -106.0;
      const isInsidePitLane = x >= -49.0 && x <= (this.pitStop.pitBoxX - 1.5) && z >= -120.0 && z <= -106.0;
      const inPitEntryZone = isBeforePitWall || isInsidePitLane;

      if (inPitEntryZone && this.physics.speed > 0.2) {
        this.pitStop.startPitEntryAutopilot(this.physics, this.audio);
        return;
      }

      const inBoxApron = x >= (this.pitStop.pitBoxX - 8.0) && x <= (this.pitStop.pitBoxX + 8.0) && z >= -118.0 && z <= -106.0;
      if (inBoxApron && Math.abs(this.physics.speed) < 12.0) {
        this.pitStop.startPitEntryAutopilot(this.physics, this.audio);
        return;
      }
    }
  }

  public requestPitStop(): void {
    if (this.pitStop.phase !== 'none') return;
    this.pitStop.cooldownTimer = 0;

    const { x, z } = this.physics.position;
    const isBeforePitWall = x >= -75.0 && x < -49.0 && z >= -121.0 && z <= -106.0;
    const isInsidePitLane = x >= -49.0 && x <= (this.pitStop.pitBoxX - 1.5) && z >= -120.0 && z <= -106.0;
    const inPitLane = isBeforePitWall || isInsidePitLane;

    if (inPitLane) {
      this.pitStop.isBoxNotified = true;
      this.lastBoxRequestTimestamp = performance.now();
      playF1BoxRadioConfirmation();
      this.pitStop.startPitEntryAutopilot(this.physics, this.audio);
    } else {
      // Out on track: toggle box call to notify team ahead of time (no jarring teleportation)
      this.toggleBoxCall();
    }
  }

  private syncCarModel(dt: number, alpha: number = 1.0): void {
    const curX = this.physics.position.x;
    const curY = this.physics.position.y;
    const curZ = this.physics.position.z;
    const prevX = this.physics.prevPosition.x;
    const prevY = this.physics.prevPosition.y;
    const prevZ = this.physics.prevPosition.z;

    const interpX = THREE.MathUtils.lerp(prevX, curX, alpha);
    const interpY = THREE.MathUtils.lerp(prevY, curY, alpha);
    const interpZ = THREE.MathUtils.lerp(prevZ, curZ, alpha);

    let yawDiff = this.physics.yaw - this.physics.prevYaw;
    while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
    while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
    const interpYaw = this.physics.prevYaw + yawDiff * alpha;

    const lift = this.pitStop.carElevatedY;
    this.carModel.group.position.set(interpX, interpY + lift, interpZ);
    this.carModel.group.rotation.set(
      this.physics.pitch,
      interpYaw,
      this.physics.roll,
      'YXZ'
    );

    if (this.carModel.contactShadowMesh) {
      this.carModel.contactShadowMesh.rotation.x = -this.physics.pitch;
      this.carModel.contactShadowMesh.rotation.z = -this.physics.roll;
      const groundY = -interpY + 0.008;
      if (this.pitStop.carElevatedY > 0.001) {
        this.carModel.contactShadowMesh.position.y = groundY - this.pitStop.carElevatedY;
        (this.carModel.contactShadowMesh.material as THREE.MeshBasicMaterial).opacity = Math.max(
          0.30,
          0.88 - this.pitStop.carElevatedY * 2.2
        );
      } else {
        this.carModel.contactShadowMesh.position.y = groundY;
        (this.carModel.contactShadowMesh.material as THREE.MeshBasicMaterial).opacity = 0.92;
      }
    }

    const speedKmh = Math.abs(this.physics.speed) * 3.6;
    this.carModel.setDRS(this.physics.isDrsOpen, dt, speedKmh);
    this.carModel.update(
      this.physics.visualSteerAngle,
      this.physics.wheelRotations,
      this.inputs.brake,
      speedKmh,
      this.physics.damage,
      this.physics.isShifting,
      this.physics.rpm,
      this.physics.wheelSuspensionCompression,
      this.physics.isPunctured,
      this.physics.tireWear,
      dt,
      this.inputs.throttle
    );

    // Directional shadow tracking with 1.2m hysteresis deadzone to prevent invalidating shadow map unnecessarily
    const shadowDistSq =
      (interpX - this.lastShadowCarX) * (interpX - this.lastShadowCarX) +
      (interpZ - this.lastShadowCarZ) * (interpZ - this.lastShadowCarZ);
    if (shadowDistSq > 1.44 && this.activeCircuit.id !== 'singapore_marina') {
      this.lastShadowCarX = interpX;
      this.lastShadowCarZ = interpZ;
      this.dirLight.position.set(interpX - 42, 36.0, interpZ - 40);
      this.dirLight.target.position.set(interpX + 4, 0.2, interpZ + 4);
      this.dirLight.target.updateMatrixWorld();
      this.dirLight.updateMatrixWorld();
    }
    if (shadowDistSq > 1.44 && this.activeCircuit.id === 'singapore_marina') {
      this.lastShadowCarX = interpX;
      this.lastShadowCarZ = interpZ;
      this.track.updateNearbyShadowCasters?.(this.carModel.group.position, 150);
    }
  }

  private updateParticles(dt: number): void {
    const carPos = this.carModel.group.position;
    const yaw = this.physics.yaw;
    const speedKmh = Math.abs(this.physics.speed) * 3.6;

    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);

    const wFL = this._fourWheelsArray[0];
    const wFR = this._fourWheelsArray[1];
    const wRL = this._fourWheelsArray[2];
    const wRR = this._fourWheelsArray[3];
    this.carModel.getFourWheelWorldPositions(wFL, wFR, wRL, wRR);

    const carForward = MathPool.V0.set(sinY, 0, cosY);
    const carVel = MathPool.V1.set(
      sinY * this.physics.speed + cosY * this.physics.lateralSpeed,
      0,
      cosY * this.physics.speed - sinY * this.physics.lateralSpeed
    );

    const slips = this.physics.wheelSlipRatios;
    this.particles.addFourWheelSkidmarks(this._fourWheelsArray, slips, carForward);

    const isDriftingAtSpeed = this.physics.isDrifting && speedKmh > 10;
    const isBurnout = (this.inputs.throttle > 0.82 && speedKmh < 12 && this.physics.gear === 1) || this.physics.tireWheelspinActive;

    const slipRL = Math.max(slips[2], isDriftingAtSpeed ? 0.75 : isBurnout ? 0.95 : 0);
    const slipRR = Math.max(slips[3], isDriftingAtSpeed ? 0.75 : isBurnout ? 0.95 : 0);

    this.particles.emitContinuousTireSmoke(2, wRL, slipRL, carVel, speedKmh, isBurnout);
    this.particles.emitContinuousTireSmoke(3, wRR, slipRR, carVel, speedKmh, isBurnout);

    if (this.physics.isDrifting && speedKmh > 18) {
      if (slips[0] > 0.22) this.particles.emitContinuousTireSmoke(0, wFL, slips[0] * 0.85, carVel, speedKmh, false);
      else this.particles.breakTireSmokeTrail(0);
      if (slips[1] > 0.22) this.particles.emitContinuousTireSmoke(1, wFR, slips[1] * 0.85, carVel, speedKmh, false);
      else this.particles.breakTireSmokeTrail(1);
    } else {
      this.particles.breakTireSmokeTrail(0);
      this.particles.breakTireSmokeTrail(1);
    }

    if (this.physics.hasAnyPuncture && speedKmh > 2.0) {
      if (this.physics.isPunctured[0]) {
        this.particles.emitContinuousScrapeSparks(wFL, MathPool.UP, carVel, dt, 0.75);
        if (Math.random() < 0.25) this.particles.emitTireSmoke(wFL, 1, 0.45, carVel);
      }
      if (this.physics.isPunctured[1]) {
        this.particles.emitContinuousScrapeSparks(wFR, MathPool.UP, carVel, dt, 0.75);
        if (Math.random() < 0.25) this.particles.emitTireSmoke(wFR, 1, 0.45, carVel);
      }
      if (this.physics.isPunctured[2]) {
        this.particles.emitContinuousScrapeSparks(wRL, MathPool.UP, carVel, dt, 0.75);
        if (Math.random() < 0.25) this.particles.emitTireSmoke(wRL, 1, 0.45, carVel);
      }
      if (this.physics.isPunctured[3]) {
        this.particles.emitContinuousScrapeSparks(wRR, MathPool.UP, carVel, dt, 0.75);
        if (Math.random() < 0.25) this.particles.emitTireSmoke(wRR, 1, 0.45, carVel);
      }
    }

    if (this.physics.damage.engineHealth < 45) {
      const hoodPos = MathPool.V2.set(
        carPos.x + sinY * 0.9,
        carPos.y + 0.65,
        carPos.z + cosY * 0.9
      );
      this.particles.emitEngineDamageSmoke(hoodPos, this.physics.damage.engineHealth);
    }

    // Realistic titanium plank scrape friction sparks (fires on authentic bottoming and kerb strikes, not continuous electric arcs)
    const plankScrapeFL = this.physics.wheelSuspensionCompression[0] > 0.94;
    const plankScrapeFR = this.physics.wheelSuspensionCompression[1] > 0.94;
    const plankScrapeRL = this.physics.wheelSuspensionCompression[2] > 0.94;
    const plankScrapeRR = this.physics.wheelSuspensionCompression[3] > 0.94;
    const totalPlankScrape = (plankScrapeFL || plankScrapeFR || plankScrapeRL || plankScrapeRR) && speedKmh > 195;

    if (totalPlankScrape) {
      const plankCenter = MathPool.V3.set(
        carPos.x - sinY * 0.5,
        carPos.y + 0.015,
        carPos.z - cosY * 0.5
      );
      this.particles.emitUnderbodyTitaniumSparks(plankCenter, carForward, carVel, dt, 0.40);
    }

    this.particles.update(dt, carPos, carForward, carVel);

    // Aerodynamic Wingtip Condensation Streamer Ribbons
    const leftWingtip = MathPool.V4;
    const rightWingtip = MathPool.V5;
    const rearDir = MathPool.V6;
    this.carModel.getWingtipWorldPositions(leftWingtip, rightWingtip, rearDir);
    this.particles.updateWingtipVortices(leftWingtip, rightWingtip, rearDir, speedKmh, dt);
  }

  private dispatchTelemetry(speedMs: number): void {
    const t = this._telemetryPayload;
    t.circuitId = this.activeCircuit.id;
    t.speedKmh = Math.round(speedMs * 3.6);
    t.rpm = Math.round(this.physics.rpm);
    t.engineTemp = Math.round(this.physics.engineTemp);
    t.gear = this.physics.gear;
    t.health = Math.round(this.physics.damage.overallHealth);
    t.engineHealth = Math.round(this.physics.damage.engineHealth);
    t.suspLeft = Math.round(this.physics.damage.suspensionLeft);
    t.suspRight = Math.round(this.physics.damage.suspensionRight);
    t.lapTime = this.raceLoopManager.currentLapTime;
    t.bestLap = this.raceLoopManager.bestLapTime;
    t.lapCount = this.raceLoopManager.lapCount;
    t.isDrifting = this.physics.isDrifting;
    t.isInPit = this.pitStop.phase !== 'none' || this.physics.isInPitStop;
    t.pitProgress = this.pitStop.phase !== 'none' ? this.pitStop.repairProgress : this.physics.pitRepairProgress;
    t.pitPhase = this.pitStop.phase;
    t.pitTimeRemaining = Math.max(0, this.pitStop.totalDuration - this.pitStop.elapsedTime);
    t.pitTotalTime = this.pitStop.totalDuration;
    t.radioMessage = this.pitStop.radioMessage;
    t.isPreparedPitStop = this.pitStop.isPreparedPitStop;
    t.isBoxRequested = this.pitStop.isBoxNotified;
    t.isGreenLightExit = this.pitStop.greenLightAlertTimer > 0;
    t.broadcastCamName = this.pitStop.broadcastCamName;
    t.isMuted = this.audio.getMuted();
    t.isEngineSoundOn = this.audio.isEngineSoundOn();
    t.audioLayers = this.audio.getLayersState();
    t.audioSoloLayer = this.audio.getSoloLayer();
    t.cameraMode = this.cameraSystem.cameraMode;
    t.cameraDistance = this.cameraSystem.cameraDistance;
    t.carName = this.carModel.currentModelName;
    t.isCustomCar = this.carModel.isCustomModel;
    t.crewName = this.pitStop.currentCrewName;
    t.isCustomCrew = this.pitStop.isCustomCrew;
    t.carX = this.physics.position.x;
    t.carZ = this.physics.position.z;
    t.carYaw = this.physics.yaw;
    t.tireCompound = this.physics.tireCompound;
    t.nextPitTireCompound = this.pitStop.nextTireCompound;
    for (let i = 0; i < 4; i++) {
      t.tireWear[i] = this.physics.tireWear[i];
      t.isPunctured[i] = this.physics.isPunctured[i];
      t.wheelEffectiveGrip[i] = this.physics.wheelEffectiveGrip[i];
      t.wheelGripIndex[i] = this.physics.wheelGripIndex[i];
      t.tireFlatSpot[i] = this.physics.tireFlatSpot[i];
    }
    t.isTireCliffActive = this.physics.isTireCliffActive;
    t.tireWheelspinActive = this.physics.tireWheelspinActive;
    t.hasAnyPuncture = this.physics.hasAnyPuncture;
    t.isDrsAvailable = this.physics.isDrsAvailable;
    t.isDrsOpen = this.physics.isDrsOpen;
    t.isBoxRequested = this.pitStop.isBoxNotified;
    t.dynamicMaxSpeedKmh = Math.round(this.physics.dynamicMaxSpeedKmh);
    t.isDamageLimiterActive = this.physics.isDamageLimiterActive;
    t.structuralIntegrity = this.physics.structuralIntegrity;
    t.graphicsQuality = this.qualityManager.getPreset();
    t.isFreePractice = this.isFreePractice;
    t.careerLeaderboard = this.isFreePractice ? [] : this.careerRaceManager.leaderboard;
    t.careerConfig = this.isFreePractice ? undefined : this.careerRaceManager.config;
    t.penaltySeconds = this.totalPenaltySeconds;
    t.penaltyAlert = this.penaltyAlert ? { ...this.penaltyAlert } : null;

    if (this.onTelemetryUpdate) {
      this.onTelemetryUpdate(t);
    }
    for (let i = 0; i < this._telemetrySubscribers.length; i++) {
      this._telemetrySubscribers[i](t);
    }
  }

  public setGraphicsQuality(preset: GraphicsQualityPreset): void {
    this.qualityManager.setPreset(preset);
  }

  public getGraphicsQuality(): GraphicsQualityPreset {
    return this.qualityManager.getPreset();
  }

  public subscribeTelemetry(listener: (data: GameTelemetry) => void): () => void {
    this._telemetrySubscribers.push(listener);
    return () => {
      const idx = this._telemetrySubscribers.indexOf(listener);
      if (idx !== -1) this._telemetrySubscribers.splice(idx, 1);
    };
  }

  public getTelemetry(): GameTelemetry {
    return this._telemetryPayload;
  }

  public setInputs(inputs: CarInputs): void {
    this.inputs = inputs;
  }

  public toggleDRS(): boolean {
    if (this.physics.isDrsAvailable) {
      this.inputs.drs = !this.inputs.drs;
      this.physics.isDrsOpen = this.inputs.drs;
      return this.physics.isDrsOpen;
    }
    return false;
  }

  public setPaused(paused: boolean): void {
    this.isPaused = paused;
    this.physicsAccumulator = 0;
    if (paused) {
      this.inputs.throttle = 0;
      this.inputs.brake = 0;
      this.inputs.steering = 0;
      this.inputs.handbrake = false;
      this.inputs.drs = false;
    }
  }

  public setCameraMode(mode: CameraViewMode): void {
    this.cameraSystem.setCameraMode(mode);
  }

  public setCameraDistance(distance: CameraDistanceMode): void {
    this.cameraSystem.setCameraDistance(distance);
  }

  public nextCameraDistance(): CameraDistanceMode {
    return this.cameraSystem.nextCameraDistance();
  }

  public nextCameraMode(): CameraViewMode {
    return this.cameraSystem.nextCameraMode();
  }

  public repairCar(): void {
    this.physics.repairFull();
    this.audio.triggerPitChime();
  }

  public resetCarToTrack(): void {
    const pose = this.activeCircuit.gridSlots.player;
    this.physics.reset(pose.x, pose.z, pose.yaw);
    this.cameraSystem.resetToPose(pose.x, 0.35, pose.z, pose.yaw);
    this.audio.triggerPitChime();
    if (this.track?.resetDynamicProps) {
      this.track.resetDynamicProps();
    }
  }

  public toggleAudio(): boolean {
    return this.audio.toggleMute();
  }

  public toggleEngineSound(): boolean {
    return this.audio.toggleEngineSound();
  }

  public setEngineSoundEnabled(enabled: boolean): void {
    this.audio.setEngineSoundEnabled(enabled);
  }

  public isEngineSoundOn(): boolean {
    return this.audio.isEngineSoundOn();
  }

  public resumeAudio(): void {
    this.audio.resume();
  }

  public pauseAudio(): void {
    this.audio.pause();
  }

  public getAudioLayersState(): EngineAudioLayersState {
    return this.audio.getLayersState();
  }

  public setAudioSoloLayer(layer: keyof EngineAudioLayersState | 'all' | 'none'): void {
    this.audio.setSoloLayer(layer);
  }

  public toggleAudioLayer(layer: keyof EngineAudioLayersState): void {
    this.audio.toggleLayer(layer);
  }

  public getAudioSoloLayer(): keyof EngineAudioLayersState | 'all' | 'none' {
    return this.audio.getSoloLayer();
  }

  public async loadCustomCar(file: File): Promise<{ success: boolean; name: string; error?: string }> {
    return this.carModel.loadCustomModel(file);
  }

  public restoreDefaultCar(): void {
    this.carModel.restoreDefaultModel();
  }

  public async loadCustomCrew(file: File): Promise<{ success: boolean; name: string; error?: string }> {
    return this.pitStop.loadCustomCrewModel(file);
  }

  public restoreDefaultCrew(): void {
    this.pitStop.restoreDefaultCrew();
  }

  public setTireCompound(compound: TireCompoundType): void {
    this.physics.setTireCompound(compound);
    this.pitStop.nextTireCompound = compound;
    this.pitStop.updateSpareTireVisuals(compound);
    this.carModel.setTireCompoundVisuals(compound);
  }

  public setNextPitTireCompound(compound: TireCompoundType): void {
    this.pitStop.setNextTireCompound(compound);
  }

  public toggleBoxCall(): boolean {
    if (this.pitStop.phase !== 'none') return false;
    this.pitStop.isBoxNotified = !this.pitStop.isBoxNotified;
    if (this.pitStop.isBoxNotified) {
      this.lastBoxRequestTimestamp = performance.now();
      playF1BoxRadioConfirmation();
    }
    this.dispatchTelemetry(Math.abs(this.physics.speed));
    return this.pitStop.isBoxNotified;
  }

  public isBoxRequested(): boolean {
    return this.pitStop.isBoxNotified;
  }

  public repairTires(): void {
    this.physics.repairTires();
    this.carModel.setTireCompoundVisuals(this.physics.tireCompound);
  }

  public startCinematicPresentation(
    circuitId: CircuitId,
    livery?: CustomLiverySettings,
    onFinished?: () => void
  ): void {
    this.isCinematicPlaying = true;
    this.physics.speed = 0;
    this.inputs.handbrake = true;
    this.inputs.throttle = 0;
    this.inputs.brake = 1;

    // Reset car position on official starting grid slot
    const pPose = this.activeCircuit.gridSlots.player;
    this.physics.reset(pPose.x, pPose.z, pPose.yaw);
    this.carModel.group.position.set(pPose.x, 0.45, pPose.z);
    this.carModel.group.rotation.set(0, pPose.yaw, 0);

    if (livery) {
      this.updatePlayerLivery(livery);
    }

    this.cinematicDirector.start(circuitId, this.carModel.group.position, livery, () => {
      this.isCinematicPlaying = false;
      this.inputs.handbrake = false;
      this.inputs.brake = 0;
      if (onFinished) onFinished();
    });
  }

  public skipCinematic(): void {
    if (this.isCinematicPlaying) {
      this.cinematicDirector.skip();
    }
  }

  public startPilotPresentation(
    circuitId: CircuitId,
    livery?: CustomLiverySettings,
    onFinished?: () => void
  ): void {
    this.isPilotPresentationPlaying = true;
    this.isCinematicPlaying = false;
    this.audio.pause();
    this.physics.speed = 0;
    this.inputs.handbrake = true;
    this.inputs.throttle = 0;
    this.inputs.brake = 1;

    // Reset car position on official starting grid slot
    const pPose = this.activeCircuit.gridSlots.player;
    this.physics.reset(pPose.x, pPose.z, pPose.yaw);
    this.carModel.group.position.set(pPose.x, 0.45, pPose.z);
    this.carModel.group.rotation.set(0, pPose.yaw, 0);

    if (livery) {
      this.updatePlayerLivery(livery);
    }

    this.pilotWalkManager.activate(livery, () => {
      this.isPilotPresentationPlaying = false;
      this.pilotWalkManager.deactivate();
      this.inputs.handbrake = false;
      this.inputs.brake = 0;
      if (onFinished) onFinished();
    });
  }

  public skipPilotPresentation(): void {
    if (this.isPilotPresentationPlaying) {
      this.isPilotPresentationPlaying = false;
      this.pilotWalkManager.deactivate();
      this.inputs.handbrake = false;
      this.inputs.brake = 0;
    }
  }

  public setPilotCameraPreset(preset: PilotCameraPreset): void {
    this.pilotWalkManager.setCameraPreset(preset);
  }

  public setPilotPaused(paused: boolean): void {
    this.pilotWalkManager.setPaused(paused);
  }

  public setPilotPlaybackTime(timeSec: number): void {
    this.pilotWalkManager.setAudioTime(timeSec);
  }

  public async loadCustomPilotModel(file: File): Promise<boolean> {
    return this.pilotWalkManager.loadCustomGlbFile(file);
  }

  public updatePlayerLivery(settings: CustomLiverySettings): void {
    const teamConfig = liverySettingsToTeamConfig(settings);
    this.carModel.setLivery(teamConfig);
  }

  public setCircuit(circuitId: CircuitId): void {
    if (this.activeCircuit && this.activeCircuit.id === circuitId) return;
    const newCircuit = getCircuit(circuitId);
    this.activeCircuit = newCircuit;

    if (this.track) {
      this.scene.remove(this.track.group);
      if (this.track.dispose) {
        this.track.dispose();
      }
    }

    this.track = newCircuit.createTrackBuilder();
    this.collisionSubsystem.buildObstacleSpatialGrid(this.track);
    this.scene.add(this.track.group);

    this.careerRaceManager.setCircuit(newCircuit);
    this.raceLoopManager.setCircuit(newCircuit);

    const pPose = newCircuit.gridSlots.player;
    this.physics.reset(pPose.x, pPose.z, pPose.yaw);
    this.syncCarModel(0.016);
    this.cameraSystem.resetToPose(pPose.x, 0.35, pPose.z, pPose.yaw);

    this.applyCircuitAtmosphere(newCircuit.id);

    try {
      this.renderer.compile(this.scene, this.camera);
    } catch {}
  }

  public applyCircuitAtmosphere(circuitId: CircuitId): void {
    const isNight = circuitId === 'singapore_marina';

    if (this.dynamicSky) {
      this.dynamicSky.setNightMode(isNight);
      if (isNight) {
        // C3 has its own sky and direct sun; avoid creating an unused night PMREM.
        this.scene.environment = null;
        this.scene.environmentIntensity = 0;
      } else {
        const envMap = this.dynamicSky.generateEnvironmentMap(this.renderer, false);
        this.envMapTexture = envMap;
        this.scene.environment = envMap;
        this.scene.environmentIntensity = 1.15;
      }
    }

    if (this.cinematicOptics) {
      this.cinematicOptics.setNightMode(isNight);
    }

    if (isNight) {
      this.scene.fog = new THREE.Fog(0x060d1a, 450, 1800);
      if (this.hemiLight) {
        this.hemiLight.color.setHex(0x182c4d);
        this.hemiLight.groundColor.setHex(0x050912);
        this.hemiLight.intensity = 0;
      }
      if (this.dirLight) {
        this.dirLight.color.setHex(0xf4f8ff);
        this.dirLight.intensity = 3.6;
        this.dirLight.position.set(666, 52, -130);
        this.dirLight.target.position.set(688, 0.2, -108);
      }
      this.renderer.toneMappingExposure = 1.7;
    } else {
      this.scene.fog = new THREE.Fog(0x1a2638, 380, 1250);
      if (this.hemiLight) {
        this.hemiLight.color.setHex(0x52729c); // Sky blue fill
        this.hemiLight.groundColor.setHex(0x2d3a24); // Warm earthy grass bounce
        this.hemiLight.intensity = 0.65;
      }
      if (this.dirLight) {
        this.dirLight.color.setHex(0xffeed6);
        this.dirLight.intensity = 2.6;
        this.dirLight.position.set(-77, 63.0, -170);
        this.dirLight.target.position.set(-31, 0.2, -126);
      }
      this.renderer.toneMappingExposure = 1.15;
    }

    if (this.dirLight) {
      this.dirLight.target.updateMatrixWorld();
      this.dirLight.updateMatrixWorld();
    }
  }

  public prewarmGPU(): void {
    try {
      this.scene.updateMatrixWorld(true);
      if (this.dirLight) {
        this.dirLight.target.updateMatrixWorld();
        this.dirLight.updateMatrixWorld();
      }
      this.renderer.compile(this.scene, this.camera);
      this.renderer.render(this.scene, this.camera);
    } catch (e) {
      console.warn('Pre-warm completed with warning:', e);
    }
  }

  public initCareerRace(laps: RaceLapOption, difficulty: RaceDifficulty, startingCompound: TireCompoundType, livery?: CustomLiverySettings): void {
    this.isMultiplayer = false;
    this.isFreePractice = false;
    this.physics.setTireCompound(startingCompound);
    this.pitStop.setNextTireCompound(startingCompound);
    this.carModel.setTireCompoundVisuals(startingCompound);

    if (livery) {
      this.updatePlayerLivery(livery);
      this.careerRaceManager.playerLivery = livery;
    }

    this.careerRaceManager.config.totalLaps = laps;
    this.careerRaceManager.config.difficulty = difficulty;
    this.careerRaceManager.config.startingCompound = startingCompound;
    this.careerRaceManager.config.requiresTwoCompounds = laps >= 20;

    this.careerRaceManager.setCircuit(this.activeCircuit);
    this.careerRaceManager.startRace(this.physics);
    this.raceLoopManager.resetRaceState(1);
    this.totalRaceLaps = laps;
    this.totalPenaltySeconds = 0;
    this.penaltyAlert = null;
    this.lastMechanicPenaltyLap = -1;
    this.pitStop.resetRivalMechanics();

    this.isControlsLocked = true;

    const p = this.physics.position;
    const pPose = this.activeCircuit.gridSlots.player;
    this.cameraSystem.resetToPose(p.x, 0.35, p.z, pPose.yaw);
  }

  public initFreePractice(startingCompound: TireCompoundType = 'soft'): void {
    this.isFreePractice = true;
    this.isMultiplayer = false;
    this.isControlsLocked = false;
    this.totalPenaltySeconds = 0;
    this.penaltyAlert = null;
    this.lastMechanicPenaltyLap = -1;
    this.pitStop.resetRivalMechanics();

    this.careerRaceManager.dispose();
    this.careerRaceManager.leaderboard = [];

    const pPose = this.activeCircuit.gridSlots.player;
    this.physics.reset(pPose.x, pPose.z, pPose.yaw);
    this.physics.setTireCompound(startingCompound);
    this.pitStop.setNextTireCompound(startingCompound);
    this.carModel.setTireCompoundVisuals(startingCompound);
    this.raceLoopManager.resetRaceState(1);
    this.totalRaceLaps = 999;

    const p = this.physics.position;
    this.cameraSystem.resetToPose(p.x, 0.35, p.z, pPose.yaw);
  }

  public initFreeCamera(): void {
    this.isFreeCamera = true;
    this.isFreePractice = true;
    this.isMultiplayer = false;
    this.isControlsLocked = false;
    this.totalPenaltySeconds = 0;
    this.penaltyAlert = null;
    this.lastMechanicPenaltyLap = -1;
    this.pitStop.resetRivalMechanics();

    this.careerRaceManager.dispose();
    this.careerRaceManager.leaderboard = [];

    const pPose = this.activeCircuit.gridSlots.player;
    this.freeCamPos.set(pPose.x, 50, pPose.z - 25);
    this.freeCamYaw = pPose.yaw;
    this.freeCamPitch = -Math.PI / 3;
    this.camera.position.copy(this.freeCamPos);
    this.camera.rotation.set(0, 0, 0);
    this.camera.lookAt(pPose.x, 0, pPose.z);
  }

  public setFreeCameraInput(inputs: { forward: number; right: number; altitude: number }): void {
    this.freeCameraInputs.forward = inputs.forward;
    this.freeCameraInputs.right = inputs.right;
    this.freeCameraInputs.altitude = inputs.altitude;
  }

  public initMultiplayer(playerId: 'p1' | 'p2', laps: number = 3): void {
    this.isMultiplayer = true;
    this.isFreePractice = false;
    this.myPlayerId = playerId;
    this.totalRaceLaps = laps;
    this.totalPenaltySeconds = 0;
    this.penaltyAlert = null;
    this.lastMechanicPenaltyLap = -1;
    this.pitStop.resetRivalMechanics();
    this.raceLoopManager.resetRaceState(1);

    this.careerRaceManager.clearAiGrid();
    this.careerRaceManager.leaderboard = [];

    if (!this.rivalCarModel) {
      this.rivalCarModel = new CarModel();
      this.scene.add(this.rivalCarModel.group);
    }

    const p1Grid = this.activeCircuit.gridSlots.player;
    const p2Grid = this.activeCircuit.gridSlots.ai(1);

    if (playerId === 'p1') {
      this.physics.reset(p1Grid.x, p1Grid.z, p1Grid.yaw);
      this.rivalPhysics.reset(p2Grid.x, p2Grid.z, p2Grid.yaw);
      this.rivalCarModel.group.position.set(p2Grid.x, 0.35, p2Grid.z);
      this.rivalCarModel.group.rotation.set(0, p2Grid.yaw, 0);
      this.rivalInterpolator.reset(p2Grid.x, 0.35, p2Grid.z, p2Grid.yaw);
    } else {
      this.physics.reset(p2Grid.x, p2Grid.z, p2Grid.yaw);
      this.rivalPhysics.reset(p1Grid.x, p1Grid.z, p1Grid.yaw);
      this.rivalCarModel.group.position.set(p1Grid.x, 0.35, p1Grid.z);
      this.rivalCarModel.group.rotation.set(0, p1Grid.yaw, 0);
      this.rivalInterpolator.reset(p1Grid.x, 0.35, p1Grid.z, p1Grid.yaw);
    }

    this.isControlsLocked = true;
    const p = this.physics.position;
    this.cameraSystem.resetToPose(p.x, 0.35, p.z, playerId === 'p1' ? p1Grid.yaw : p2Grid.yaw);
  }

  public updateRivalCar(telemetry: RivalTelemetryData): void {
    if (!this.rivalCarModel) {
      this.rivalCarModel = new CarModel();
      this.scene.add(this.rivalCarModel.group);
    }

    this.rivalTelemetry = telemetry;
    this.rivalLapCount = telemetry.lapCount;
    this.rivalCurrentSector = telemetry.currentSector;
    this.rivalSpeedKmh = telemetry.speedKmh;

    this.rivalInterpolator.pushSnapshot(telemetry);
  }

  public updateRivalCarInterpolation(dt: number): void {
    if (!this.rivalCarModel) return;
    const interp = this.rivalInterpolator.sample(dt);

    this.rivalPhysics.position.x = interp.x;
    this.rivalPhysics.position.y = interp.y;
    this.rivalPhysics.position.z = interp.z;
    this.rivalPhysics.yaw = interp.yaw;
    this.rivalPhysics.pitch = 0;
    this.rivalPhysics.roll = interp.roll;
    this.rivalPhysics.speed = interp.speed;
    this.rivalPhysics.steerAngle = interp.steerAngle;
    this.rivalPhysics.slipRatio = interp.slipRatio;

    this.rivalCarModel.group.position.set(interp.x, interp.y, interp.z);
    this.rivalCarModel.group.rotation.set(0, interp.yaw, interp.roll);

    if (interp.damage) {
      this.rivalPhysics.damage.overallHealth = interp.damage.overallHealth ?? 100;
      this.rivalPhysics.damage.engineHealth = interp.damage.engineHealth ?? 100;
      this.rivalPhysics.damage.frontCrumple = interp.damage.frontCrumple ?? 0;
      this.rivalPhysics.damage.rearCrumple = interp.damage.rearCrumple ?? 0;
      this.rivalPhysics.damage.frontWingLeftDamage = interp.damage.frontWingLeftDamage ?? 0;
      this.rivalPhysics.damage.frontWingRightDamage = interp.damage.frontWingRightDamage ?? 0;
      this.rivalPhysics.damage.wingDamageAmount = interp.damage.wingDamageAmount ?? 0;
      this.rivalPhysics.damage.frontWingLeftDetached = !!interp.damage.frontWingLeftDetached;
      this.rivalPhysics.damage.frontWingRightDetached = !!interp.damage.frontWingRightDetached;
      this.rivalPhysics.damage.rearWingLeftDetached = !!interp.damage.rearWingLeftDetached;
      this.rivalPhysics.damage.rearWingRightDetached = !!interp.damage.rearWingRightDetached;
      this.rivalPhysics.damage.drsFlapBroken = !!interp.damage.drsFlapBroken;
      this.rivalPhysics.damage.wingLoose = !!interp.damage.wingLoose;
    }

    const wheelSpin = (interp.speed / 0.33);
    this.rivalCarModel.update(
      interp.steerAngle,
      [wheelSpin, wheelSpin, wheelSpin, wheelSpin],
      interp.brake,
      interp.speedKmh,
      this.rivalPhysics.damage,
      interp.isShifting,
      interp.rpm,
      interp.damage?.wheelSuspensionCompression,
      interp.damage?.isPunctured,
      interp.damage?.tireWear,
      dt
    );

    if (interp.slipRatio > 0.18) {
      const p = this.rivalCarModel.group.position;
      const yaw = interp.yaw;
      const cosY = Math.cos(yaw);
      const sinY = Math.sin(yaw);

      const rL = MathPool.V0.set(p.x - cosY * 0.94 - sinY * 1.35, 0.024, p.z + sinY * 0.94 - cosY * 1.35);
      const rR = MathPool.V1.set(p.x + cosY * 0.94 - sinY * 1.35, 0.024, p.z - sinY * 0.94 - cosY * 1.35);
      this.particles.emitTireSmoke(rL, 1, interp.slipRatio);
      this.particles.emitTireSmoke(rR, 1, interp.slipRatio);
      this.particles.addSkidmark(rL, rR, interp.slipRatio);
    }
  }

  public async loadCustomRivalCar(file: File): Promise<{ success: boolean; name: string; error?: string }> {
    if (!this.rivalCarModel) {
      this.rivalCarModel = new CarModel();
      this.scene.add(this.rivalCarModel.group);
    }
    return this.rivalCarModel.loadCustomModel(file);
  }

  public restoreDefaultRivalCar(): void {
    if (this.rivalCarModel) {
      this.rivalCarModel.restoreDefaultModel();
    }
  }

  public setControlsLocked(locked: boolean): void {
    this.isControlsLocked = locked;
    if (!locked) {
      this.physics.speed = 0.5;
      this.careerRaceManager.onLightsOut();
    }
  }

  public playStartingBeep(_isHighPitch: boolean = false): void {
    this.audio.triggerPitChime();
  }

  public dispose(): void {
    this.isDisposed = true;
    this.isRunning = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    window.removeEventListener('resize', this.onResize);
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = undefined;
    }

    if (this.daySkyTexture) {
      this.daySkyTexture.dispose();
      this.daySkyTexture = undefined;
    }
    if (this.dynamicSky) {
      this.dynamicSky.dispose();
    }
    if (this.envMapTexture) {
      this.envMapTexture.dispose();
      this.envMapTexture = undefined;
    }
    if (this.scene.environment && typeof (this.scene.environment as any).dispose === 'function') {
      (this.scene.environment as any).dispose();
      this.scene.environment = null;
    }

    CarModel.clearTireTextureCache();

    if (this.track && typeof this.track.dispose === 'function') {
      this.track.dispose();
    }
    if (this.carModel && typeof this.carModel.dispose === 'function') {
      this.carModel.dispose();
    }
    if (this.rivalCarModel && typeof this.rivalCarModel.dispose === 'function') {
      this.rivalCarModel.dispose();
    }
    if (this.particles && typeof this.particles.dispose === 'function') {
      this.particles.dispose();
    }
    if (this.pitStop && typeof this.pitStop.dispose === 'function') {
      this.pitStop.dispose();
    }
    if (this.careerRaceManager && typeof this.careerRaceManager.dispose === 'function') {
      this.careerRaceManager.dispose();
    }
    if (this.pilotWalkManager && typeof this.pilotWalkManager.dispose === 'function') {
      this.pilotWalkManager.dispose();
    }
    if (this.speedEffect && typeof this.speedEffect.dispose === 'function') {
      this.speedEffect.dispose();
    }
    if (this.cinematicOptics && typeof this.cinematicOptics.dispose === 'function') {
      this.cinematicOptics.dispose();
    }
    if (this.heatHaze && typeof this.heatHaze.dispose === 'function') {
      this.heatHaze.dispose();
    }
    if (this.audio && typeof this.audio.dispose === 'function') {
      this.audio.dispose();
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
  }
}
