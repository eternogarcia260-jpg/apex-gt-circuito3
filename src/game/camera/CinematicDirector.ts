/**
 * CinematicDirector.ts - Real-Time 3D Circuit & Driver Broadcast Presentation
 * Orchestrates TV broadcast camera sweeps, orbital hero reveals, and sector telemetry
 * with 100% zero-GC allocation and 60/120 FPS stability.
 */

import * as THREE from 'three';
import { CircuitId } from '../circuits/ICircuit';
import { CustomLiverySettings } from '../career/CareerTypes';

export type CinematicShotType = 'GRID_SWEEP' | 'CURVONE_OUTFIELD' | 'PIT_AND_PADDOCK' | 'PILOT_REVEAL';

export interface CinematicShotInfo {
  type: CinematicShotType;
  index: number;
  totalShots: number;
  title: string;
  subtitle: string;
  zoneTag: string;
  elapsedInShot: number;
  duration: number;
  progress: number; // 0 to 1
  driverLivery?: CustomLiverySettings;
}

interface ShotKeyframe {
  startPos: THREE.Vector3;
  endPos: THREE.Vector3;
  startTarget: THREE.Vector3;
  endTarget: THREE.Vector3;
  startFov: number;
  endFov: number;
  duration: number;
  title: string;
  subtitle: string;
  zoneTag: string;
}

export class CinematicDirector {
  private camera: THREE.PerspectiveCamera;
  public isPlaying: boolean = false;
  public currentShotType: CinematicShotType = 'GRID_SWEEP';
  public totalElapsedTime: number = 0;
  public currentShotIndex: number = 0;

  private circuitId: CircuitId = 'square_apex';
  private playerCarPos: THREE.Vector3 = new THREE.Vector3(-18.0, 0.45, -128.0);
  private driverLivery?: CustomLiverySettings;

  private shots: ShotKeyframe[] = [];
  private shotStartTimes: number[] = [];
  private totalDuration: number = 18.0;

  // Pre-allocated scratch vectors to guarantee 0 GC allocations in frame update
  private readonly _vCamPos = new THREE.Vector3();
  private readonly _vCamTarget = new THREE.Vector3();

  public onShotChange?: (info: CinematicShotInfo) => void;
  public onFinished?: () => void;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
  }

  /**
   * Initializes and starts the cinematic camera sequence for the specified circuit and player livery
   */
  public start(
    circuitId: CircuitId,
    playerCarPos: THREE.Vector3,
    driverLivery?: CustomLiverySettings,
    onFinished?: () => void
  ): void {
    this.circuitId = circuitId;
    this.playerCarPos.copy(playerCarPos);
    this.driverLivery = driverLivery;
    this.onFinished = onFinished;
    this.isPlaying = true;
    this.totalElapsedTime = 0;
    this.currentShotIndex = 0;

    this.buildShotSequence();
    this.notifyShotChange(0);
  }

  /**
   * Builds circuit-specific waypoints for 4 distinct broadcast TV perspectives
   */
  private buildShotSequence(): void {
    this.shots = [];
    this.shotStartTimes = [];

    const isSpeedway = this.circuitId === 'speedway_gp';
    const isSingapore = this.circuitId === 'singapore_marina';

    // Shot 1: GRID_SWEEP - Main Straight & Starting Grid flyby
    const shot1Duration = 4.5;
    const shot1: ShotKeyframe = {
      startPos: new THREE.Vector3(this.playerCarPos.x - 70.0, 14.0, this.playerCarPos.z + 18.0),
      endPos: new THREE.Vector3(this.playerCarPos.x + 45.0, 3.8, this.playerCarPos.z - 8.0),
      startTarget: new THREE.Vector3(this.playerCarPos.x + 10.0, 1.2, this.playerCarPos.z),
      endTarget: new THREE.Vector3(this.playerCarPos.x + 90.0, 1.0, this.playerCarPos.z),
      startFov: 62,
      endFov: 48,
      duration: shot1Duration,
      title: 'RECTA PRINCIPAL Y PARRILLA FIA',
      subtitle: 'Semáforos de salida, zona de aceleración inicial y cajones de pole position',
      zoneTag: 'SECTOR 1 / PARRILLA',
    };
    this.shots.push(shot1);

    // Shot 2: CURVONE_OUTFIELD - Dynamic high-speed cornering & circuit signature zone
    const shot2Duration = 4.5;
    let shot2: ShotKeyframe;
    if (isSpeedway) {
      shot2 = {
        startPos: new THREE.Vector3(120.0, 35.0, 40.0),
        endPos: new THREE.Vector3(260.0, 18.0, 180.0),
        startTarget: new THREE.Vector3(300.0, 2.0, 120.0),
        endTarget: new THREE.Vector3(350.0, 0.0, 220.0),
        startFov: 55,
        endFov: 44,
        duration: shot2Duration,
        title: 'EL CURVONE Y LAGO ALPINA',
        subtitle: 'Curva peraltada de 320+ km/h con vistas al lago italiano y villas VIP',
        zoneTag: 'SECTOR 2 / CURVONE',
      };
    } else if (isSingapore) {
      shot2 = {
        startPos: new THREE.Vector3(60.0, 28.0, 40.0),
        endPos: new THREE.Vector3(140.0, 14.0, 110.0),
        startTarget: new THREE.Vector3(110.0, 1.0, 80.0),
        endTarget: new THREE.Vector3(180.0, 1.0, 140.0),
        startFov: 56,
        endFov: 46,
        duration: shot2Duration,
        title: 'MARINA BAY & PUENTE ESPLANADE',
        subtitle: 'Asfalto nocturno con rascacielos iluminados y frenada técnica de vértice',
        zoneTag: 'SECTOR 2 / MARINA',
      };
    } else {
      // Default: Circuit 1 Square Apex
      shot2 = {
        startPos: new THREE.Vector3(85.0, 22.0, -90.0),
        endPos: new THREE.Vector3(135.0, 12.0, -10.0),
        startTarget: new THREE.Vector3(115.0, 1.2, -115.0),
        endTarget: new THREE.Vector3(118.0, 1.2, 35.0),
        startFov: 58,
        endFov: 45,
        duration: shot2Duration,
        title: 'VÉRTICE 1 Y COMPLEJO DE PIANOS',
        subtitle: 'Frenada límite de 90° con escapatorias y pianos de alta adherencia',
        zoneTag: 'SECTOR 2 / VÉRTICE 1',
      };
    }
    this.shots.push(shot2);

    // Shot 3: PIT_AND_PADDOCK - Pit Lane, Telemetry wall & Garages
    const shot3Duration = 4.2;
    const shot3: ShotKeyframe = {
      startPos: new THREE.Vector3(35.0, 2.8, -108.0),
      endPos: new THREE.Vector3(-45.0, 3.5, -112.0),
      startTarget: new THREE.Vector3(-10.0, 1.1, -116.0),
      endTarget: new THREE.Vector3(-80.0, 1.2, -116.0),
      startFov: 50,
      endFov: 42,
      duration: shot3Duration,
      title: 'PIT LANE Y MURO DE TELEMETRÍA',
      subtitle: 'Boxes de escudería con límite de 80 km/h y paradas de cambio de neumáticos',
      zoneTag: 'SECTOR 3 / PADDOCK',
    };
    this.shots.push(shot3);

    // Total circuit overview shots: 3 key broadcast angles (Grid, High-Speed Sector, Pit Lane)
    // After these 3 shots finish, the sequence transitions seamlessly into the 3D Pilot Walking Presentation on track!

    // Calculate start times
    let accum = 0;
    for (const s of this.shots) {
      this.shotStartTimes.push(accum);
      accum += s.duration;
    }
    this.totalDuration = accum;
  }

  /**
   * Updates camera position, target, and FOV smoothly every frame
   * Returns true if cinematic is still playing, false when finished
   */
  public update(delta: number): boolean {
    if (!this.isPlaying || this.shots.length === 0) return false;

    this.totalElapsedTime += delta;

    if (this.totalElapsedTime >= this.totalDuration) {
      this.finish();
      return false;
    }

    // Identify current shot
    let shotIdx = 0;
    for (let i = this.shots.length - 1; i >= 0; i--) {
      if (this.totalElapsedTime >= this.shotStartTimes[i]) {
        shotIdx = i;
        break;
      }
    }

    if (shotIdx !== this.currentShotIndex) {
      this.currentShotIndex = shotIdx;
      this.notifyShotChange(shotIdx);
    }

    const shot = this.shots[shotIdx];
    const shotElapsed = this.totalElapsedTime - this.shotStartTimes[shotIdx];
    const rawT = Math.min(Math.max(shotElapsed / shot.duration, 0), 1);

    // Smooth smoothstep / cubic ease-in-out interpolation
    const easeT = rawT * rawT * (3 - 2 * rawT);

    // Interpolate camera position and target
    this._vCamPos.lerpVectors(shot.startPos, shot.endPos, easeT);
    this._vCamTarget.lerpVectors(shot.startTarget, shot.endTarget, easeT);

    this.camera.position.copy(this._vCamPos);
    this.camera.lookAt(this._vCamTarget);

    const fov = THREE.MathUtils.lerp(shot.startFov, shot.endFov, easeT);
    if (Math.abs(this.camera.fov - fov) > 0.05) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }

    return true;
  }

  /**
   * Skips the presentation immediately and proceeds to race start
   */
  public skip(): void {
    if (!this.isPlaying) return;
    this.finish();
  }

  private finish(): void {
    this.isPlaying = false;
    if (this.onFinished) {
      this.onFinished();
    }
  }

  private notifyShotChange(shotIdx: number): void {
    const shot = this.shots[shotIdx];
    if (!shot) return;

    let shotType: CinematicShotType = 'GRID_SWEEP';
    if (shotIdx === 0) shotType = 'GRID_SWEEP';
    else if (shotIdx === 1) shotType = 'CURVONE_OUTFIELD';
    else if (shotIdx === 2) shotType = 'PIT_AND_PADDOCK';
    else shotType = 'PILOT_REVEAL';

    this.currentShotType = shotType;

    if (this.onShotChange) {
      this.onShotChange({
        type: shotType,
        index: shotIdx,
        totalShots: this.shots.length,
        title: shot.title,
        subtitle: shot.subtitle,
        zoneTag: shot.zoneTag,
        elapsedInShot: 0,
        duration: shot.duration,
        progress: (shotIdx + 1) / this.shots.length,
        driverLivery: this.driverLivery,
      });
    }
  }
}
