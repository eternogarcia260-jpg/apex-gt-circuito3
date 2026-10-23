import * as THREE from 'three';
import { MathPool } from '../utils/MathPool';
import { PitStopManager } from '../pit/PitStopManager';

export type CameraViewMode = 'chase' | 'hood' | 'bumper' | 'orbit';
export type CameraDistanceMode = 'near' | 'medium' | 'far';

export interface CameraDistPreset {
  baseDist: number;
  baseHeight: number;
  lookAhead: number;
  targetY: number;
}

/**
 * CameraSystem - High-performance Camera Choreography & Visual Feedback
 * Manages multiple driver perspectives, dynamic TV broadcast angles,
 * high-speed aerodynamic buffeting, and seamless FOV scaling with ZERO allocations.
 */
export class CameraSystem {
  public camera: THREE.PerspectiveCamera;
  public cameraMode: CameraViewMode = 'chase';
  public cameraDistance: CameraDistanceMode = 'medium';

  public readonly cameraPos = new THREE.Vector3();
  public readonly cameraTarget = new THREE.Vector3();
  public smoothedCamYaw: number = 0;
  public currentTargetFov: number = 58.0;
  public speedBuffetingTime: number = 0;
  public cameraTrauma: number = 0;

  private static readonly DIST_PRESETS: Record<CameraDistanceMode, CameraDistPreset> = {
    near: { baseDist: 4.2, baseHeight: 1.68, lookAhead: 4.2, targetY: 0.86 },
    medium: { baseDist: 5.9, baseHeight: 2.18, lookAhead: 5.2, targetY: 0.98 },
    far: { baseDist: 8.9, baseHeight: 3.25, lookAhead: 6.8, targetY: 1.20 },
  };

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
  }

  public setCameraMode(mode: CameraViewMode): void {
    this.cameraMode = mode;
  }

  public setCameraDistance(distance: CameraDistanceMode): void {
    this.cameraDistance = distance;
    this.setCameraMode('chase');
  }

  public nextCameraDistance(): CameraDistanceMode {
    const distances: CameraDistanceMode[] = ['near', 'medium', 'far'];
    const idx = distances.indexOf(this.cameraDistance);
    this.cameraDistance = distances[(idx + 1) % distances.length];
    this.setCameraMode('chase');
    return this.cameraDistance;
  }

  public nextCameraMode(): CameraViewMode {
    const modes: CameraViewMode[] = ['chase', 'hood', 'bumper', 'orbit'];
    const idx = modes.indexOf(this.cameraMode);
    const next = modes[(idx + 1) % modes.length];
    this.setCameraMode(next);
    return this.cameraMode;
  }

  public addTrauma(amount: number): void {
    this.cameraTrauma = Math.min(1.0, this.cameraTrauma + amount);
  }

  public resetToPose(x: number, y: number, z: number, yaw: number): void {
    this.smoothedCamYaw = yaw;
    const forwardX = Math.sin(yaw);
    const forwardZ = Math.cos(yaw);
    this.cameraPos.set(x - forwardX * 7.0, y + 2.2, z - forwardZ * 7.0);
    this.cameraTarget.set(x + forwardX * 5.0, y + 0.85, z + forwardZ * 5.0);
    this.camera.position.copy(this.cameraPos);
    this.camera.lookAt(this.cameraTarget);
  }

  public update(
    dt: number,
    carPos: THREE.Vector3,
    yaw: number,
    speed: number,
    isDrifting: boolean,
    pitStop: PitStopManager
  ): void {
    const speedKmh = Math.abs(speed) * 3.6;
    const forwardX = Math.sin(yaw);
    const forwardZ = Math.cos(yaw);
    const rightX = Math.cos(yaw);
    const rightZ = -Math.sin(yaw);

    const isPitEntryAutopilot = pitStop.phase === 'entry_autopilot';
    const isStationaryPitService =
      pitStop.phase === 'docking' ||
      pitStop.phase === 'jacks_up' ||
      pitStop.phase === 'servicing' ||
      pitStop.phase === 'jacks_down';
    const isReleased =
      pitStop.phase === 'released' ||
      pitStop.phase === 'exit_autopilot' ||
      (pitStop.phase === 'none' && pitStop.greenLightAlertTimer > 0);

    // 1. Single Unified Dynamic FOV Target
    let targetFov = 58.0;
    if (isPitEntryAutopilot) {
      targetFov = 66.0;
    } else if (isStationaryPitService) {
      targetFov = 62.0;
    } else if (isReleased) {
      targetFov = 58.0;
    } else {
      const baseFov = this.cameraMode === 'hood' ? 62 : this.cameraMode === 'bumper' ? 68 : 58;
      const speedRatio = Math.min(1.0, speedKmh / 350);
      targetFov = baseFov + Math.pow(speedRatio, 1.25) * 14.0;
    }
    this.currentTargetFov = targetFov;

    // Synchronize smoothedCamYaw during pit service and non-chase modes to avoid angular snap on handover
    if (isStationaryPitService || isPitEntryAutopilot || this.cameraMode !== 'chase') {
      let preYawDiff = yaw - this.smoothedCamYaw;
      while (preYawDiff > Math.PI) preYawDiff -= Math.PI * 2;
      while (preYawDiff < -Math.PI) preYawDiff += Math.PI * 2;
      this.smoothedCamYaw += preYawDiff * Math.min(1.0, 10.0 * dt);
    }

    // 2. DYNAMIC PIT ENTRY CHASE & TRACKING CAM
    if (isPitEntryAutopilot) {
      pitStop.broadcastCamName = 'CÁMARA PIT LANE · SEGUIMIENTO 60 KM/H';

      const chaseDist = 5.8;
      const idealCamX = carPos.x - forwardX * chaseDist;
      const idealCamY = carPos.y + 2.25;
      const idealCamZ = carPos.z - forwardZ * chaseDist;

      const idealTargetX = carPos.x + forwardX * 4.2;
      const idealTargetY = carPos.y + 0.95;
      const idealTargetZ = carPos.z + forwardZ * 4.2;

      const camPosLerp = 1.0 - Math.exp(-9.0 * dt);
      const camTargetLerp = 1.0 - Math.exp(-10.0 * dt);

      this.cameraPos.x += (idealCamX - this.cameraPos.x) * camPosLerp;
      this.cameraPos.y += (idealCamY - this.cameraPos.y) * camPosLerp;
      this.cameraPos.z += (idealCamZ - this.cameraPos.z) * camPosLerp;

      this.cameraTarget.x += (idealTargetX - this.cameraTarget.x) * camTargetLerp;
      this.cameraTarget.y += (idealTargetY - this.cameraTarget.y) * camTargetLerp;
      this.cameraTarget.z += (idealTargetZ - this.cameraTarget.z) * camTargetLerp;

      this.camera.position.copy(this.cameraPos);
      this.camera.lookAt(this.cameraTarget);
      return;
    }
    // 3. TV TRACKSIDE BROADCAST CAM: CALIBRATED PANORAMIC PIT SERVICE CHOREOGRAPHY
    else if (isStationaryPitService) {
      pitStop.broadcastCamName = 'CÁMARA PIT LANE 4K · BOX APEX SCUDERIA';
      const t = pitStop.elapsedTime;
      const total = Math.max(2, pitStop.totalDuration);
      const orbitT = Math.min(1.0, Math.max(0, t / total));
      const boxX = pitStop.pitBoxX;

      // Elevated trackside crane-jib camera on pit wall looking across box toward garages
      const idealCamX = boxX + THREE.MathUtils.lerp(6.2, -5.8, orbitT);
      const idealCamZ = -116.2 + Math.sin(orbitT * Math.PI) * 0.4;
      const idealCamY = 3.25 + Math.sin(t * 0.6) * 0.08;

      // Focus accurately on the central chassis and wheel mechanics at the active pit box
      const idealTargetX = boxX + THREE.MathUtils.lerp(0.5, -0.5, orbitT);
      const idealTargetY = 0.72 + pitStop.carElevatedY * 0.5;
      const idealTargetZ = -110.5;

      // Fluid broadcast gimbal damping
      const camPosLerp = Math.min(1.0, 5.0 * dt);
      const camTargetLerp = Math.min(1.0, 6.0 * dt);

      this.cameraPos.x += (idealCamX - this.cameraPos.x) * camPosLerp;
      this.cameraPos.y += (idealCamY - this.cameraPos.y) * camPosLerp;
      this.cameraPos.z += (idealCamZ - this.cameraPos.z) * camPosLerp;

      this.cameraTarget.x += (idealTargetX - this.cameraTarget.x) * camTargetLerp;
      this.cameraTarget.y += (idealTargetY - this.cameraTarget.y) * camTargetLerp;
      this.cameraTarget.z += (idealTargetZ - this.cameraTarget.z) * camTargetLerp;

      this.camera.position.copy(this.cameraPos);
      this.camera.lookAt(this.cameraTarget);
      return;
    }
    // 3.5. DYNAMIC LAUNCH CAM & SEAMLESS HANDOVER (RELEASED PHASE)
    else if (isReleased) {
      pitStop.broadcastCamName = 'SALIDA DE BOXES · LANZAMIENTO';
      const distConfig = CameraSystem.DIST_PRESETS[this.cameraDistance];
      const aspect = this.camera.aspect;
      const isPortrait = aspect < 1.0;
      const portraitDistFactor = isPortrait ? Math.max(1.30, 1.0 + (1.0 - aspect) * 0.65) : 1.0;
      const portraitHeightFactor = isPortrait ? 1.28 : 1.0;

      const effectiveDist = distConfig.baseDist * portraitDistFactor;
      const effectiveHeight = distConfig.baseHeight * portraitHeightFactor;
      const effectiveTargetY = distConfig.targetY * (isPortrait ? 1.15 : 1.0);

      // Smooth trailing yaw orientation aligned with smoothedCamYaw
      let yawDiff = yaw - this.smoothedCamYaw;
      while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
      while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
      this.smoothedCamYaw += yawDiff * Math.min(1.0, 14.0 * dt);

      const camForwardX = Math.sin(this.smoothedCamYaw);
      const camForwardZ = Math.cos(this.smoothedCamYaw);

      const currentRelX = this.cameraPos.x - carPos.x;
      const currentRelY = this.cameraPos.y - carPos.y;
      const currentRelZ = this.cameraPos.z - carPos.z;

      const targetRelX = -camForwardX * effectiveDist;
      const targetRelY = effectiveHeight;
      const targetRelZ = -camForwardZ * effectiveDist;

      const currentRelTgtX = this.cameraTarget.x - carPos.x;
      const currentRelTgtY = this.cameraTarget.y - carPos.y;
      const currentRelTgtZ = this.cameraTarget.z - carPos.z;

      const targetRelTgtX = camForwardX * distConfig.lookAhead;
      const targetRelTgtY = effectiveTargetY;
      const targetRelTgtZ = camForwardZ * distConfig.lookAhead;

      const blendRate = 1.0 - Math.exp(-12.0 * dt);
      const newRelX = THREE.MathUtils.lerp(currentRelX, targetRelX, blendRate);
      const newRelY = THREE.MathUtils.lerp(currentRelY, targetRelY, blendRate);
      const newRelZ = THREE.MathUtils.lerp(currentRelZ, targetRelZ, blendRate);

      const newRelTgtX = THREE.MathUtils.lerp(currentRelTgtX, targetRelTgtX, blendRate);
      const newRelTgtY = THREE.MathUtils.lerp(currentRelTgtY, targetRelTgtY, blendRate);
      const newRelTgtZ = THREE.MathUtils.lerp(currentRelTgtZ, targetRelTgtZ, blendRate);

      this.cameraPos.set(carPos.x + newRelX, carPos.y + newRelY, carPos.z + newRelZ);
      this.cameraTarget.set(carPos.x + newRelTgtX, carPos.y + newRelTgtY, carPos.z + newRelTgtZ);

      this.camera.position.copy(this.cameraPos);
      this.camera.lookAt(this.cameraTarget);
      return;
    } else {
      pitStop.broadcastCamName = null;
    }

    // 4. PLAYER CONTROLLED CAMERAS
    if (this.cameraMode === 'chase') {
      const distConfig = CameraSystem.DIST_PRESETS[this.cameraDistance];

      // Mobile Portrait aspect ratio compensation
      const aspect = this.camera.aspect;
      const isPortrait = aspect < 1.0;
      const portraitDistFactor = isPortrait ? Math.max(1.30, 1.0 + (1.0 - aspect) * 0.65) : 1.0;
      const portraitHeightFactor = isPortrait ? 1.28 : 1.0;

      const effectiveDist = distConfig.baseDist * portraitDistFactor;
      const effectiveHeight = distConfig.baseHeight * portraitHeightFactor;
      const effectiveTargetY = distConfig.targetY * (isPortrait ? 1.15 : 1.0);

      // Smooth trailing yaw orientation
      let yawDiff = yaw - this.smoothedCamYaw;
      while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
      while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
      const yawLerp = 1.0 - Math.exp((isDrifting ? -10.0 : -14.0) * dt);
      this.smoothedCamYaw += yawDiff * yawLerp;

      const camForwardX = Math.sin(this.smoothedCamYaw);
      const camForwardZ = Math.cos(this.smoothedCamYaw);

      this.camera.position.set(
        carPos.x - camForwardX * effectiveDist,
        carPos.y + effectiveHeight,
        carPos.z - camForwardZ * effectiveDist
      );

      this.camera.lookAt(
        carPos.x + camForwardX * distConfig.lookAhead,
        carPos.y + effectiveTargetY,
        carPos.z + camForwardZ * distConfig.lookAhead
      );

      this.cameraPos.copy(this.camera.position);
      this.cameraTarget.set(
        carPos.x + camForwardX * distConfig.lookAhead,
        carPos.y + distConfig.targetY,
        carPos.z + camForwardZ * distConfig.lookAhead
      );

    } else if (this.cameraMode === 'hood') {
      this.camera.position.set(
        carPos.x + forwardX * 1.35,
        carPos.y + 0.68,
        carPos.z + forwardZ * 1.35
      );
      this.camera.lookAt(
        carPos.x + forwardX * 40.0,
        carPos.y + 0.50,
        carPos.z + forwardZ * 40.0
      );

    } else if (this.cameraMode === 'bumper') {
      this.camera.position.set(
        carPos.x + forwardX * 2.52,
        carPos.y + 0.40,
        carPos.z + forwardZ * 2.52
      );
      this.camera.lookAt(
        carPos.x + forwardX * 45.0,
        carPos.y + 0.38,
        carPos.z + forwardZ * 45.0
      );

    } else if (this.cameraMode === 'orbit') {
      const heliX = carPos.x - forwardX * 13.0 + rightX * 8.0;
      const heliZ = carPos.z - forwardZ * 13.0 + rightZ * 8.0;
      const heliY = carPos.y + 14.0;

      const lerpFactor = Math.min(1.0, 3.5 * dt);
      this.cameraPos.x += (heliX - this.cameraPos.x) * lerpFactor;
      this.cameraPos.y += (heliY - this.cameraPos.y) * lerpFactor;
      this.cameraPos.z += (heliZ - this.cameraPos.z) * lerpFactor;

      this.camera.position.copy(this.cameraPos);
      this.camera.lookAt(carPos.x + forwardX * 3.5, carPos.y + 0.6, carPos.z + forwardZ * 3.5);
    }

    // 5. HIGH-SPEED AERODYNAMIC BUFFETING & COCKPIT MICRO-VIBRATION (> 200 KM/H)
    let buffetingIntensity = 0;
    if (speedKmh > 200.0) {
      const normalizedRatio = Math.min(1.0, Math.max(0.0, (speedKmh - 200.0) / 125.0));
      let baseIntensity = Math.pow(normalizedRatio, 1.35);

      if (speedKmh > 270.0) {
        const highSpeedTaper = Math.min(1.0, (speedKmh - 270.0) / 60.0);
        const attenuation = 1.0 - highSpeedTaper * 0.32;
        baseIntensity *= attenuation;
      }

      buffetingIntensity = baseIntensity;
    }

    // Dynamic FOV Compression & Speed Tunnel Feeling
    const dynFov = this.currentTargetFov + buffetingIntensity * 5.0;
    const fovDelta = (dynFov - this.camera.fov) * Math.min(1.0, 8.0 * dt);
    if (Math.abs(fovDelta) > 0.002) {
      this.camera.fov += fovDelta;
      this.camera.updateProjectionMatrix();
    }

    // Refined Harmonic Pitch/Roll & High-Frequency Shake
    if (buffetingIntensity > 0.001) {
      this.speedBuffetingTime += dt * 38.0;
      const bt = this.speedBuffetingTime;

      const pitchBuffet = (Math.sin(bt * 1.0) * 0.65 + Math.sin(bt * 2.37) * 0.35) * buffetingIntensity * 0.012;
      const rollBuffet = (Math.cos(bt * 1.41) * 0.70 + Math.sin(bt * 3.14) * 0.30) * buffetingIntensity * 0.009;
      const verticalBuffet = Math.sin(bt * 1.83) * buffetingIntensity * 0.038;
      const lateralBuffet = Math.cos(bt * 2.15) * buffetingIntensity * 0.022;

      this.camera.rotation.x += pitchBuffet;
      this.camera.rotation.z += rollBuffet;
      this.camera.position.y += verticalBuffet;
      this.camera.position.x += lateralBuffet;
    }

    // Visceral Impact Camera Trauma
    if (this.cameraTrauma > 0.005) {
      const shake = this.cameraTrauma * this.cameraTrauma;
      this.camera.rotation.z += (Math.random() - 0.5) * shake * 0.025;
      this.camera.rotation.x += (Math.random() - 0.5) * shake * 0.035;
      this.camera.rotation.y += (Math.random() - 0.5) * shake * 0.035;
      this.cameraTrauma *= Math.exp(-dt * 14.0);
    }
  }
}
