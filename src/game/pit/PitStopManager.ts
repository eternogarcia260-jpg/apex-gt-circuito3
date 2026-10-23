/**
 * PitStopManager.ts - Ultra-Realistic Professional F1 / WEC 3D Pit Stop System
 * 
 * Hyper-Realistic Features:
 * 1. Full 14-Member Coordinated F1 Crew:
 *    - 4 Dedicated Wheel Gunners with Analytical Two-Bone IK and Paoli DP 6000 pneumatic impact wrenches.
 *    - 4 Tyre-Off Mechanics who physically dismount and carry away the used, worn race slicks.
 *    - 4 Tyre-On Mechanics who lift brand new Pirelli soft slicks from thermal stands and slide them flush onto the spindle.
 *    - Front & Rear Quick-Release Trolley Jack Operators with mechanical lever kinematics.
 *    - Front Wing Aero Tech & Radiator Cooling Specialist.
 *    - Chief Pit Controller (Lollipop Marshal) with animated digital Red/Green signal.
 * 2. True Mechanical 4-Wheel Physical Exchange:
 *    - Old worn tires detach physically from the spindle, exposing the bare ventilated carbon ceramic discs & Brembo calipers!
 *    - Dismounted tires are pulled outward into the hands of the Tyre-Off crew.
 *    - Brand new, glossy Pirelli P-Zero soft slicks arc gracefully in 3D Bézier trajectories from their tire blankets onto the axle hubs!
 *    - Monolug centerlock nuts tightened with 3000 Nm high-torque rattle, golden friction sparks, and nitrogen exhaust bursts.
 * 3. Gravity Freefall & Suspension Slam Dynamics:
 *    - Hydraulic jacks dump pressure: 1180 kg prototype drops under gravitational acceleration.
 *    - Hard suspension bump & damped dual-cycle rebound squat upon tarmac contact.
 *    - Heavy mechanical chassis thud audio and camera shock.
 * 4. Realistic F1 Team Radio & Digital Pit Gantry Timing Screen.
 */

import * as THREE from 'three';
import { EngineSound } from '../audio/EngineSound';
import { CarModel } from '../models/CarModel';
import { ParticleSystem } from '../particles/ParticleSystem';
import { VehiclePhysics, CarInputs } from '../physics/VehiclePhysics';
import { CrewModelImporter } from '../loaders/CrewModelImporter';
import { TIRE_COMPOUNDS, TireCompoundType } from '../physics/TireCompound';
import { HumanCrewMeshBuilder, OFFICIAL_TEAM_CONFIGS } from './HumanCrewMeshBuilder';
import { safeMergeBufferGeometries } from '../utils/GeometryUtils';

export type PitStopPhase = 'none' | 'entry_autopilot' | 'docking' | 'jacks_up' | 'servicing' | 'jacks_down' | 'released' | 'exit_autopilot';

export interface ArmIKJoints {
  shoulder: THREE.Group;
  upperArm: THREE.Mesh;
  elbow: THREE.Group;
  forearm: THREE.Mesh;
  hand: THREE.Group;
  l1: number;
  l2: number;
  isRight: boolean;
}

export interface LegJoints {
  hip: THREE.Group;
  thigh: THREE.Mesh;
  knee: THREE.Group;
  shin: THREE.Mesh;
  ankle: THREE.Group;
  boot: THREE.Mesh;
  l1: number;
  l2: number;
  isRight: boolean;
}

export type CrewRoleType =
  | 'front_jack'
  | 'rear_jack'
  | 'tyre_tech_fl' | 'tyre_tech_fr' | 'tyre_tech_rl' | 'tyre_tech_rr'
  | 'lollipop';

export interface PitCrewMember {
  group: THREE.Group;
  proceduralBody: THREE.Group;
  customBody?: THREE.Group;
  basePos: THREE.Vector3;
  baseRotY: number;
  standbyPos: THREE.Vector3;
  servicePos: THREE.Vector3;
  floorRestPos?: THREE.Vector3;
  exitPos: THREE.Vector3;
  type: CrewRoleType;
  toolMesh?: THREE.Object3D;
  leftArmIK?: ArmIKJoints;
  rightArmIK?: ArmIKJoints;
  leftLeg?: LegJoints;
  rightLeg?: LegJoints;
  torsoGroup?: THREE.Group;
  pelvisGroup?: THREE.Group;
  headGroup?: THREE.Group;
  wheelIndex?: number;
  balancerCable?: THREE.Line;
  balancerHarness?: THREE.Group;
}

// Math utility to find the congruent target angle nearest to current angle (eliminates 360-degree flip bugs across laps)
function getNearestAngle(currentAngle: number, targetAngle: number): number {
  let diff = (targetAngle - currentAngle) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return currentAngle + diff;
}

// 5th-order Quintic Hermite smoothstep (C2-continuous: zero velocity and zero acceleration at endpoints)
function quinticSmooth(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * c * (c * (c * 6 - 15) + 10);
}

// 1st spatial derivative of Quintic Hermite smoothstep: S'(t) = 30 * t^2 * (1 - t)^2
function quinticSmoothDeriv(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return 30 * c * c * (1 - c) * (1 - c);
}

// 2nd spatial derivative of Quintic Hermite smoothstep: S''(t) = 60 * t * (1 - t) * (1 - 2*t)
function quinticSmoothSecondDeriv(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return 60 * c * (1 - c) * (1 - 2 * c);
}

// Cubic Bézier curve in 3D (evaluated in-place into out vector, 0 GC allocation)
function cubicBezier3D(
  p0: THREE.Vector3,
  p1: THREE.Vector3,
  p2: THREE.Vector3,
  p3: THREE.Vector3,
  t: number,
  out: THREE.Vector3
): THREE.Vector3 {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;
  out.x = uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x;
  out.y = uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y;
  out.z = uuu * p0.z + 3 * uu * t * p1.z + 3 * u * tt * p2.z + ttt * p3.z;
  return out;
}

export interface RivalMechanicActor {
  id: string;
  role: CrewRoleType;
  group: THREE.Group;
  built: ReturnType<typeof HumanCrewMeshBuilder.buildPhotorealisticMechanic>;
  isCrouched: boolean;
  hasGun: boolean;

  // Pristine rest transform for exact 4s restoration
  restPos: THREE.Vector3;
  restRotY: number;

  // Dynamic physics states
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotation: THREE.Euler;
  angularVelocity: THREE.Vector3;

  isAirborne: boolean;
  airborneTimer: number;
  radius: number;
  height: number;
  flailPhase: number;
  flailSpeed: number;
  lastHitTime?: number;
}

export class PitStopManager {
  public group: THREE.Group;
  public rivalCrewGroup: THREE.Group = new THREE.Group();
  public rivalMechanics: RivalMechanicActor[] = [];
  private crewMembers: PitCrewMember[] = [];
  private crewByRole: Map<string, PitCrewMember> = new Map();
  private staticStandbyCrewGroup: THREE.Group | null = null;

  // Zero-Allocation Reusable Static Scratch Variables
  private static readonly _sSpindlePos = new THREE.Vector3();
  private static readonly _sAxleOutDir = new THREE.Vector3();
  private static readonly _sHubQuat = new THREE.Quaternion();
  private static readonly _sGripL = new THREE.Vector3();
  private static readonly _sGripR = new THREE.Vector3();
  private static readonly _sP0 = new THREE.Vector3();
  private static readonly _sP1 = new THREE.Vector3();
  private static readonly _sP2 = new THREE.Vector3();
  private static readonly _sP3 = new THREE.Vector3();
  private static readonly _sWheelInterpPos = new THREE.Vector3();
  private static readonly _sTechTorsoQuat = new THREE.Quaternion();
  private static readonly _sFloorQuat = new THREE.Quaternion();
  private static readonly _sFloorEuler = new THREE.Euler();
  private static readonly _sFloorPos = new THREE.Vector3();
  private static readonly _sSlidePos = new THREE.Vector3();
  private static readonly _sGunTipPos = new THREE.Vector3();
  private static readonly _sHipHangPos = new THREE.Vector3();
  private static readonly _sAlignPos = new THREE.Vector3();
  private static readonly _sFloorGripL = new THREE.Vector3();
  private static readonly _sFloorGripR = new THREE.Vector3();
  private static readonly _sRackGripL = new THREE.Vector3();
  private static readonly _sRackGripR = new THREE.Vector3();
  private static readonly _sHarnessWorld = new THREE.Vector3();
  private static readonly _sTempV1 = new THREE.Vector3();
  private static readonly _sTempV2 = new THREE.Vector3();
  private static readonly _sBezP0 = new THREE.Vector3();
  private static readonly _sBezP1 = new THREE.Vector3();
  private static readonly _sBezP2 = new THREE.Vector3();
  private static readonly _sBezP3 = new THREE.Vector3();
  private static readonly _sForwardDir = new THREE.Vector3();
  private static readonly _sSideDir = new THREE.Vector3();
  private static readonly _sTangentDir = new THREE.Vector3();
  private static readonly _sGaragePos = new THREE.Vector3();
  private static readonly _sCarryQuat = new THREE.Quaternion();
  private static readonly _sHipQuat = new THREE.Quaternion();
  private static readonly _sFreshRestPos = new THREE.Vector3();
  private static readonly _sChestHoldPos = new THREE.Vector3();

  // Custom User-Uploaded 3D Pit Crew Mechanics State
  public isCustomCrew: boolean = false;
  public currentCrewName: string = 'Pit Crew Apex Scuderia';
  private customCrewProto: THREE.Group | null = null;
  private crewLoadGeneration: number = 0;

  // Driver BOX notification status for this lap
  public isBoxNotified: boolean = false;
  public hasCrossedPitEntryLine: boolean = false;
  public isPreparedPitStop: boolean = false;
  public tyreChangeDuration: number = 3.0;

  // Real 3D Wheel Props: Fresh New Slicks & Dismounted Used Tires
  private spareWheels: THREE.Group[] = [];        // Fresh Pirelli Soft Slicks on thermal stands
  private dismountedWheels: THREE.Group[] = [];   // Used worn tires pulled off the car
  private spareStripeMeshes: THREE.Mesh[] = [];   // Sidewall ring meshes of spare tires
  private spareLedMaterials: THREE.MeshBasicMaterial[] = []; // Temperature LEDs of thermal cradles
  private spareShadows: THREE.Mesh[] = [];        // Ambient occlusion contact shadow blobs
  private dismountedShadows: THREE.Mesh[] = [];   // Used wheel contact shadow blobs
  private contactShadowTex!: THREE.CanvasTexture;
  private freshPzeroStripeMat!: THREE.MeshStandardMaterial;
  private dismountedPzeroStripeMat!: THREE.MeshStandardMaterial;

  // Overhead air tool boom & hanging coiled hoses
  private airBoomsGroup!: THREE.Group;
  private airHoses: THREE.Mesh[] = [];

  // Digital Pit Wall Timing Screen
  private pitWallDisplayCanvas!: HTMLCanvasElement;
  private pitWallDisplayTex!: THREE.CanvasTexture;
  private pitWallDisplayMesh!: THREE.Mesh;

  // Active Lollipop sign
  private lollipopSignGroup!: THREE.Group;
  private lollipopDiscMat!: THREE.MeshStandardMaterial;

  // Pit Box Geometry (Centered at x = 0, z = -110.5)
  public readonly pitCenter = new THREE.Vector3(0, 0.35, -110.5);
  public readonly pitBounds = {
    minX: -20,
    maxX: 20,
    minZ: -122.5,
    maxZ: -105.0,
  };

  // Strategy: Next tire compound chosen for the pit stop
  public nextTireCompound: TireCompoundType = 'soft';

  // State Machine
  public phase: PitStopPhase = 'none';
  public totalDuration = 0;
  public elapsedTime = 0;
  public repairProgress = 0;
  public initialDamageFraction = 0;
  public carElevatedY = 0;

  // F1 Team Radio & TV Broadcast Metadata
  public radioMessage: string | null = null;
  public broadcastCamName: string | null = null;

  // Auto-docking and fluid entry tracking state
  private dockStartPos = { x: 0, z: 0, yaw: 0 };
  private dockDuration = 0.5;

  // Dynamic C2 Quintic Spline Entry Trajectory Path (Continuous, Non-Clipping)
  private trajP0 = { x: 0, z: 0, zPrime: 0 };
  private trajMid = { x: 0, z: 0, zPrime: 0 };
  private trajEnd = { x: 0, z: 0, zPrime: 0 };
  private trajHasMid = false;

  // Cooldown to prevent repeating pit stops while exiting
  public cooldownTimer = 0;
  public greenLightAlertTimer = 0;

  // Audio & effects single-shot triggers
  private lastGunSoundTime = 0;
  private lastSparkTime = 0;
  private lastAirBurstTime = 0;
  private hasTriggeredJackUpSound = false;
  private hasTriggeredJackDownSound = false;

  // Pre-allocated static scratchpads for Zero-Allocation IK and servicing loops (0 bytes GC churn!)
  private static readonly _ikShoulderWorld = new THREE.Vector3();
  private static readonly _ikToTarget = new THREE.Vector3();
  private static readonly _ikTargetDir = new THREE.Vector3();
  private static readonly _ikTorsoRight = new THREE.Vector3();
  private static readonly _ikTorsoFwd = new THREE.Vector3();
  private static readonly _ikTorsoUp = new THREE.Vector3();
  private static readonly _ikPole = new THREE.Vector3();
  private static readonly _ikLimbNormal = new THREE.Vector3();
  private static readonly _ikBendAxis = new THREE.Vector3();
  private static readonly _ikUpperArmDirWorld = new THREE.Vector3();
  private static readonly _ikParentWorldQuat = new THREE.Quaternion();
  private static readonly _ikInvParentQuat = new THREE.Quaternion();
  private static readonly _ikLocalUpperArmDir = new THREE.Vector3();
  private static readonly _ikDefaultDir = new THREE.Vector3(0, -1, 0);
  private static readonly _ikQAim = new THREE.Quaternion();

  private readonly _spindlePos = new THREE.Vector3();
  private readonly _axleOutDir = new THREE.Vector3();
  private readonly _hubQuat = new THREE.Quaternion();
  private readonly _gripL = new THREE.Vector3();
  private readonly _gripR = new THREE.Vector3();
  private readonly _p0 = new THREE.Vector3();
  private readonly _p1 = new THREE.Vector3();
  private readonly _p2 = new THREE.Vector3();
  private readonly _p3 = new THREE.Vector3();
  private readonly _wheelInterpolatedPos = new THREE.Vector3();
  private readonly _techTorsoQuat = new THREE.Quaternion();
  private readonly _gunTipPos = new THREE.Vector3();
  private readonly _hipHangPos = new THREE.Vector3();
  private readonly _harnessWorld = new THREE.Vector3();
  private readonly _localGunPos = new THREE.Vector3();
  private readonly _tempFloorPos = new THREE.Vector3();
  private readonly _floorGripL = new THREE.Vector3();
  private readonly _floorGripR = new THREE.Vector3();
  private readonly _rackGripL = new THREE.Vector3();
  private readonly _rackGripR = new THREE.Vector3();
  private readonly _tempSlidePos = new THREE.Vector3();
  private readonly _tempOffset = new THREE.Vector3();
  private hasTriggeredChime = false;
  private hasTriggeredRadioEntry = false;
  private hasTriggeredRadioTyres = false;
  private hasTriggeredRadioExit = false;
  private hasAppliedNewTireVisualsToCar = false;
  private lastDisplayBoardPhase: PitStopPhase = 'none';
  private displayBoardTimer: number = 0;

  // Dedicated Pit Box X coordinates (Garage 01: Host/Player 1 at X = -22.0, Garage 02: Rival/Player 2 at X = +22.0)
  // Perfectly separated by 44 meters of central Paddock Lounge
  public pitBoxX: number = -22.0;
  public rivalPitBoxX: number = 22.0;

  constructor() {
    HumanCrewMeshBuilder.acquire();
    this.group = new THREE.Group();
    this.group.add(this.rivalCrewGroup);
    this.buildPitStallEnvironment();
    this.buildPitCrew();
    this.buildPhysicalWheelProps();
    this.buildAirBooms();
    this.buildRivalPitCrewsAndGarages();
    this.updateDisplayBoard();

    // Disable real-time shadow depth pass on static pit crew and garage equipment
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = false;
        obj.receiveShadow = true;
      }
    });
  }

  private buildPitStallEnvironment(): void {
    const stallGroup = new THREE.Group();
    // Digital Pit Wall Display Board / "CAR RELEASED" sign completely removed per user request
    this.group.add(stallGroup);
  }

  /**
   * Build realistic 3D Pit Crew Mechanics with articulated Two-Bone IK skeletal arms
   */
  private buildPitCrew(): void {
    const suitMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626, // Team Rosso Corsa racing fire suit
      roughness: 0.6,
      metalness: 0.1,
    });
    const suitBlackMat = new THREE.MeshStandardMaterial({
      color: 0x18181b, // Carbon black contrast panels
      roughness: 0.5,
    });
    const helmetMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      metalness: 0.4,
      roughness: 0.2,
    });
    const visorMat = new THREE.MeshPhysicalMaterial({
      color: 0x050505,
      metalness: 0.95,
      roughness: 0.05,
      clearcoat: 1.0,
    });
    const toolMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      metalness: 0.85,
      roughness: 0.2,
    });

    const createHumanCrewMember = (
      type: CrewRoleType,
      standbyPos: THREE.Vector3,
      servicePos: THREE.Vector3,
      exitPos: THREE.Vector3,
      rotationY: number,
      wheelIndex?: number,
      hasTwoBoneIK: boolean = false,
      floorRestPos?: THREE.Vector3
    ): PitCrewMember => {
      const memberGroup = new THREE.Group();
      memberGroup.position.copy(standbyPos);
      memberGroup.rotation.y = rotationY;

      // Build ultra-detailed photorealistic human mechanic with Nomex fire suit, FIA helmet & racing gear
      const built = HumanCrewMeshBuilder.buildPhotorealisticMechanic(
        type,
        OFFICIAL_TEAM_CONFIGS.apex,
        hasTwoBoneIK
      );

      memberGroup.add(built.proceduralBody);

      let toolMesh: THREE.Object3D | undefined = built.toolMesh;

      if (!hasTwoBoneIK) {
        if (type === 'front_jack') {
          const jackGroup = new THREE.Group();
          const frameGeo = new THREE.BoxGeometry(0.48, 0.08, 1.3);
          const frame = new THREE.Mesh(frameGeo, new THREE.MeshStandardMaterial({ color: 0xdc2626, metalness: 0.85, roughness: 0.25 }));
          frame.position.set(0, 0.1, 0.7);
          jackGroup.add(frame);

          const handleGeo = new THREE.CylinderGeometry(0.025, 0.025, 1.2, 8);
          handleGeo.rotateX(-0.6);
          const handle = new THREE.Mesh(handleGeo, new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.9 }));
          handle.position.set(0, 0.6, 0.2);
          jackGroup.add(handle);

          built.proceduralBody.add(jackGroup);
          toolMesh = jackGroup;
        } else if (type === 'rear_jack') {
          const jackGroup = new THREE.Group();
          const armGeo = new THREE.BoxGeometry(0.5, 0.08, 1.2);
          const arm = new THREE.Mesh(armGeo, new THREE.MeshStandardMaterial({ color: 0xdc2626, metalness: 0.85, roughness: 0.25 }));
          arm.position.set(0, 0.12, -0.6);
          jackGroup.add(arm);

          const leverGeo = new THREE.CylinderGeometry(0.025, 0.025, 1.1, 8);
          leverGeo.rotateX(0.5);
          const lever = new THREE.Mesh(leverGeo, new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.9 }));
          lever.position.set(0, 0.55, -0.2);
          jackGroup.add(lever);

          built.proceduralBody.add(jackGroup);
          toolMesh = jackGroup;
        } else if (type === 'lollipop') {
          this.lollipopSignGroup = new THREE.Group();
          const poleGeo = new THREE.CylinderGeometry(0.025, 0.025, 3.2, 8);
          const poleMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8 });
          const pole = new THREE.Mesh(poleGeo, poleMat);
          pole.position.set(0, 1.6, 0.8);
          pole.rotateX(0.2);
          this.lollipopSignGroup.add(pole);

          const discGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.05, 24);
          discGeo.rotateX(Math.PI / 2);
          this.lollipopDiscMat = new THREE.MeshStandardMaterial({
            color: 0xdc2626,
            emissive: 0xef4444,
            emissiveIntensity: 1.8,
            roughness: 0.3,
          });
          const disc = new THREE.Mesh(discGeo, this.lollipopDiscMat);
          disc.position.set(0, 2.5, 1.25);
          this.lollipopSignGroup.add(disc);

          built.proceduralBody.add(this.lollipopSignGroup);
          toolMesh = this.lollipopSignGroup;
        }
      }

      this.group.add(memberGroup);

      return {
        group: memberGroup,
        proceduralBody: built.proceduralBody,
        basePos: standbyPos.clone(),
        baseRotY: rotationY,
        standbyPos,
        servicePos,
        floorRestPos,
        exitPos,
        type,
        toolMesh,
        leftArmIK: built.leftArmIK,
        rightArmIK: built.rightArmIK,
        leftLeg: built.leftLeg,
        rightLeg: built.rightLeg,
        torsoGroup: built.torsoGroup,
        pelvisGroup: built.pelvisGroup,
        headGroup: built.headGroup,
        wheelIndex,
        balancerCable: built.balancerCable,
        balancerHarness: built.balancerHarness,
      };
    };

    const bx = this.pitBoxX;

    // 1. FRONT JACK OPERATOR
    this.crewMembers.push(createHumanCrewMember(
      'front_jack',
      new THREE.Vector3(bx + 3.55, 0, -108.5),
      new THREE.Vector3(bx + 3.05, 0, -110.5),
      new THREE.Vector3(bx + 3.85, 0, -108.5),
      -Math.PI / 2
    ));

    // 2. REAR JACK OPERATOR
    this.crewMembers.push(createHumanCrewMember(
      'rear_jack',
      new THREE.Vector3(bx - 3.55, 0, -108.5),
      new THREE.Vector3(bx - 3.05, 0, -110.5),
      new THREE.Vector3(bx - 3.85, 0, -108.5),
      Math.PI / 2
    ));

    // 3. DEDICATED 4 TYRE TECHNICIANS (1 Solo Master Technician per corner)
    // FRONT-LEFT (Wheel 0, hub at x = bx + 1.25, z = -109.58)
    this.crewMembers.push(createHumanCrewMember(
      'tyre_tech_fl',
      new THREE.Vector3(bx + 1.25, 0, -107.50), // Standby
      new THREE.Vector3(bx + 1.25, 0, -108.60), // Service
      new THREE.Vector3(bx + 1.25, 0, -107.20), // Exit
      Math.PI,
      0,
      true,
      new THREE.Vector3(bx + 1.95, 0.16, -108.40) // Floor rest for used wheel
    ));

    // FRONT-RIGHT (Wheel 1, hub at x = bx + 1.25, z = -111.42)
    this.crewMembers.push(createHumanCrewMember(
      'tyre_tech_fr',
      new THREE.Vector3(bx + 1.25, 0, -113.50),
      new THREE.Vector3(bx + 1.25, 0, -112.40),
      new THREE.Vector3(bx + 1.25, 0, -113.80),
      0,
      1,
      true,
      new THREE.Vector3(bx + 1.95, 0.16, -112.60)
    ));

    // REAR-LEFT (Wheel 2, hub at x = bx - 1.25, z = -109.58)
    this.crewMembers.push(createHumanCrewMember(
      'tyre_tech_rl',
      new THREE.Vector3(bx - 1.25, 0, -107.50),
      new THREE.Vector3(bx - 1.25, 0, -108.60),
      new THREE.Vector3(bx - 1.25, 0, -107.20),
      Math.PI,
      2,
      true,
      new THREE.Vector3(bx - 1.95, 0.16, -108.40)
    ));

    // REAR-RIGHT (Wheel 3, hub at x = bx - 1.25, z = -111.42)
    this.crewMembers.push(createHumanCrewMember(
      'tyre_tech_rr',
      new THREE.Vector3(bx - 1.25, 0, -113.50),
      new THREE.Vector3(bx - 1.25, 0, -112.40),
      new THREE.Vector3(bx - 1.25, 0, -113.80),
      0,
      3,
      true,
      new THREE.Vector3(bx - 1.95, 0.16, -112.60)
    ));

    // 4. PIT CONTROLLER (Lollipop marshal - positioned ahead of the cockpit with zero overlap)
    this.crewMembers.push(createHumanCrewMember(
      'lollipop',
      new THREE.Vector3(bx + 2.65, 0, -107.6),
      new THREE.Vector3(bx + 2.65, 0, -107.6),
      new THREE.Vector3(bx + 2.65, 0, -107.0),
      Math.PI * 0.88
    ));

    this.crewByRole.clear();
    for (const m of this.crewMembers) {
      this.crewByRole.set(m.type, m);
    }

    // High-Performance Graphics Optimization:
    // Pre-consolidate the 16 standby crew mechanics into a batched static mesh group.
    // Cuts ~720 individual draw calls and scene graph traversals down to ~4 draw calls during 99.9% of the race!
    const standbyCrewGroup = new THREE.Group();
    for (const m of this.crewMembers) {
      const clone = m.group.clone(true);
      standbyCrewGroup.add(clone);
    }
    this.staticStandbyCrewGroup = this.consolidateStaticGroup(standbyCrewGroup);
    this.group.add(this.staticStandbyCrewGroup);

    // Default state: during racing (phase === 'none'), show consolidated batch and hide dynamic rigs
    this.staticStandbyCrewGroup.visible = true;
    for (let i = 0; i < this.crewMembers.length; i++) {
      this.crewMembers[i].proceduralBody.visible = false;
    }
  }

  /**
   * Build 3D Wheel Props: Fresh New Slicks (on illuminated thermal racks) and Dismounted Worn Wheels
   */
  private buildPhysicalWheelProps(): void {
    const tireRadius = 0.35;
    const tireWidth = 0.32;
    const bx = this.pitBoxX;

    this.spareStripeMeshes = [];
    this.spareLedMaterials = [];
    this.spareWheels = [];
    this.dismountedWheels = [];
    this.spareShadows = [];
    this.dismountedShadows = [];

    // Fresh Pirelli Soft Slick Material (deep gloss, red soft compound stripe)
    const freshTireMat = new THREE.MeshStandardMaterial({
      color: 0x141416,
      roughness: 0.28, // Glossy fresh rubber straight from 100°C warmers!
      metalness: 0.05,
    });
    const freshRimMat = new THREE.MeshStandardMaterial({
      color: 0x27272a,
      metalness: 0.90,
      roughness: 0.20,
    });
    const pzeroRedMat = new THREE.MeshStandardMaterial({
      color: 0xef4444, // Pirelli P-Zero Soft Red
      roughness: 0.4,
      metalness: 0.1,
    });
    this.freshPzeroStripeMat = pzeroRedMat;

    // Used Dismounted Wheel Material (dull matte, brake dust patina)
    const usedTireMat = new THREE.MeshStandardMaterial({
      color: 0x222226,
      roughness: 0.92,
      metalness: 0.02,
    });
    const usedRimMat = new THREE.MeshStandardMaterial({
      color: 0x3f3f46,
      metalness: 0.65,
      roughness: 0.45,
    });
    const pzeroWornMat = new THREE.MeshStandardMaterial({
      color: 0x991b1b,
      roughness: 0.8,
    });
    this.dismountedPzeroStripeMat = pzeroWornMat;

    const sparePositions = [
      { x: bx + 0.55, z: -108.30 }, // FL (Left side thermal warmer cradle)
      { x: bx + 0.55, z: -112.70 }, // FR (Right side thermal warmer cradle)
      { x: bx - 0.55, z: -108.30 },// RL (Left side thermal warmer cradle)
      { x: bx - 0.55, z: -112.70 },// RR (Right side thermal warmer cradle)
    ];

    // Parked car orientation quaternion (yaw = Math.PI / 2)
    const parkedQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);

    // 1. Build 4 Illuminated Thermal Tire Warmer Cradles
    const standAlloyMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.85,
      roughness: 0.25,
    });
    const thermalCoilMat = new THREE.MeshStandardMaterial({
      color: 0xff4400,
      emissive: 0xff3300,
      emissiveIntensity: 1.6,
      roughness: 0.35,
    });

    sparePositions.forEach((sp, idx) => {
      const standGroup = new THREE.Group();
      standGroup.position.set(sp.x, 0, sp.z);

      // Low-profile alloy base plate
      const baseGeo = new THREE.BoxGeometry(0.58, 0.06, 0.46);
      const baseMesh = new THREE.Mesh(baseGeo, standAlloyMat);
      baseMesh.position.y = 0.03;
      standGroup.add(baseMesh);

      // Curved tire cradle
      const cradleGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.36, 16, 1, true, -Math.PI * 0.35, Math.PI * 0.7);
      cradleGeo.rotateZ(Math.PI / 2);
      const cradle = new THREE.Mesh(cradleGeo, standAlloyMat);
      cradle.position.y = 0.36;
      standGroup.add(cradle);

      // Glowing thermal heating coils
      const coilGeo = new THREE.TorusGeometry(0.37, 0.014, 6, 16, Math.PI * 0.65);
      coilGeo.rotateY(Math.PI / 2);
      const coil = new THREE.Mesh(coilGeo, thermalCoilMat);
      coil.position.y = 0.36;
      standGroup.add(coil);

      // Digital Temperature LED (100°C Pre-Heated Pirelli Race Rubber)
      const ledGeo = new THREE.BoxGeometry(0.14, 0.05, 0.03);
      const ledMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
      this.spareLedMaterials.push(ledMat);
      const led = new THREE.Mesh(ledGeo, ledMat);
      led.position.set(0, 0.12, idx % 2 === 1 ? -0.24 : 0.24);
      standGroup.add(led);

      this.group.add(standGroup);
    });

    // 2. Build 4 Fresh Pirelli Soft Slicks
    sparePositions.forEach((sp, idx) => {
      const isRight = (idx === 1 || idx === 3);
      const wheelGroup = new THREE.Group();
      wheelGroup.position.set(sp.x, 0.35, sp.z);
      wheelGroup.quaternion.copy(parkedQuat);
      wheelGroup.userData = {
        basePos: wheelGroup.position.clone(),
        baseQuat: wheelGroup.quaternion.clone(),
        wheelIndex: idx,
      };

      // Slick tire cylinder along local X axis
      const tireGeo = new THREE.CylinderGeometry(tireRadius, tireRadius, tireWidth, 24);
      tireGeo.rotateZ(Math.PI / 2);
      const tire = new THREE.Mesh(tireGeo, freshTireMat);
      tire.castShadow = false;
      wheelGroup.add(tire);

      // BBS Racing Rim
      const rimRadius = tireRadius * 0.65;
      const rimGeo = new THREE.CylinderGeometry(rimRadius, rimRadius, tireWidth + 0.005, 18);
      rimGeo.rotateZ(Math.PI / 2);
      const rim = new THREE.Mesh(rimGeo, freshRimMat);
      wheelGroup.add(rim);

      // Pirelli Soft Red Sidewall Ring (on outer face)
      const pzeroGeo = new THREE.TorusGeometry(tireRadius * 0.82, 0.009, 6, 24);
      pzeroGeo.rotateY(Math.PI / 2);
      const pzeroRing = new THREE.Mesh(pzeroGeo, pzeroRedMat);
      pzeroRing.position.x = isRight ? (tireWidth / 2 + 0.005) : (-tireWidth / 2 - 0.005);
      this.spareStripeMeshes.push(pzeroRing);
      wheelGroup.add(pzeroRing);

      // Monolug Centerlock Nut (Red on Left, Blue on Right)
      const nutGeo = new THREE.CylinderGeometry(0.065, 0.075, 0.08, 8);
      nutGeo.rotateZ(Math.PI / 2);
      const nutMat = new THREE.MeshStandardMaterial({
        color: isRight ? 0x1e40af : 0x991b1b,
        metalness: 0.92,
        roughness: 0.20,
      });
      const nut = new THREE.Mesh(nutGeo, nutMat);
      nut.position.x = isRight ? (tireWidth / 2 + 0.03) : (-tireWidth / 2 - 0.03);
      wheelGroup.add(nut);

      this.spareWheels.push(wheelGroup);
      this.group.add(wheelGroup);
    });

    // 3. Build 4 Dismounted Worn Wheels (Initially hidden)
    for (let i = 0; i < 4; i++) {
      const isRight = (i === 1 || i === 3);
      const dismountedGroup = new THREE.Group();
      dismountedGroup.visible = false;
      dismountedGroup.quaternion.copy(parkedQuat);

      const tireGeo = new THREE.CylinderGeometry(tireRadius, tireRadius, tireWidth, 20);
      tireGeo.rotateZ(Math.PI / 2);
      const tire = new THREE.Mesh(tireGeo, usedTireMat);
      dismountedGroup.add(tire);

      const rimRadius = tireRadius * 0.65;
      const rimGeo = new THREE.CylinderGeometry(rimRadius, rimRadius, tireWidth + 0.005, 16);
      rimGeo.rotateZ(Math.PI / 2);
      const rim = new THREE.Mesh(rimGeo, usedRimMat);
      dismountedGroup.add(rim);

      // Faded sidewall ring
      const pzeroGeo = new THREE.TorusGeometry(tireRadius * 0.82, 0.007, 6, 20);
      pzeroGeo.rotateY(Math.PI / 2);
      const pzeroRing = new THREE.Mesh(pzeroGeo, pzeroWornMat);
      pzeroRing.position.x = isRight ? (tireWidth / 2 + 0.005) : (-tireWidth / 2 - 0.005);
      dismountedGroup.add(pzeroRing);

      // Worn Centerlock Nut
      const nutGeo = new THREE.CylinderGeometry(0.065, 0.075, 0.08, 8);
      nutGeo.rotateZ(Math.PI / 2);
      const nutMat = new THREE.MeshStandardMaterial({
        color: isRight ? 0x1e3a5f : 0x7f1d1d,
        metalness: 0.85,
        roughness: 0.4,
      });
      const nut = new THREE.Mesh(nutGeo, nutMat);
      nut.position.x = isRight ? (tireWidth / 2 + 0.03) : (-tireWidth / 2 - 0.03);
      dismountedGroup.add(nut);

      this.dismountedWheels.push(dismountedGroup);
      this.group.add(dismountedGroup);
    }

    // 4. Build Contact Ambient Occlusion Shadow Blobs
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 128;
    shadowCanvas.height = 128;
    const shadowCtx = shadowCanvas.getContext('2d')!;
    const grad = shadowCtx.createRadialGradient(64, 64, 12, 64, 64, 60);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.75)');
    grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.3)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
    shadowCtx.fillStyle = grad;
    shadowCtx.fillRect(0, 0, 128, 128);
    this.contactShadowTex = new THREE.CanvasTexture(shadowCanvas);

    const shadowGeo = new THREE.PlaneGeometry(0.85, 0.85);
    shadowGeo.rotateX(-Math.PI / 2);

    for (let i = 0; i < 4; i++) {
      const sMat = new THREE.MeshBasicMaterial({
        map: this.contactShadowTex,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -3.0,
        polygonOffsetUnits: -3.0,
      });
      const spareShadow = new THREE.Mesh(shadowGeo, sMat);
      spareShadow.position.set(sparePositions[i].x, 0.010, sparePositions[i].z);
      spareShadow.renderOrder = 3;
      this.spareShadows.push(spareShadow);
      this.group.add(spareShadow);

      const dMat = new THREE.MeshBasicMaterial({
        map: this.contactShadowTex,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -3.0,
        polygonOffsetUnits: -3.0,
      });
      const dismountedShadow = new THREE.Mesh(shadowGeo, dMat);
      dismountedShadow.position.set(sparePositions[i].x, 0.010, sparePositions[i].z);
      dismountedShadow.renderOrder = 3;
      dismountedShadow.visible = false;
      this.dismountedShadows.push(dismountedShadow);
      this.group.add(dismountedShadow);
    }
  }

  /**
   * Evaluates if the driver notified the team at the exact instant of crossing the white pit entry line (x = -54.0)
   */
  public evaluatePitLineCrossing(notified: boolean): void {
    if (this.hasCrossedPitEntryLine) return;
    this.hasCrossedPitEntryLine = true;
    this.isPreparedPitStop = Boolean(notified);

    if (this.isPreparedPitStop) {
      // Prepared pit stop: 2.8s to 3.3s random tyre change duration
      this.tyreChangeDuration = Number((2.8 + Math.random() * (3.3 - 2.8)).toFixed(2));
      // Total stationary time: 0.5s jacks_up + tyreChangeDuration + 0.6s jacks_down
      this.totalDuration = 0.5 + 0.5 + this.tyreChangeDuration + 0.6;
      this.radioMessage = `BOX PROGRAMADO · EQUIPO PREPARADO (${this.tyreChangeDuration.toFixed(1)}s)`;
    } else {
      // Unprepared scramble pit stop: 6.1s to 7.2s random tyre change duration
      this.tyreChangeDuration = Number((6.1 + Math.random() * (7.2 - 6.1)).toFixed(2));
      this.totalDuration = 0.5 + 0.5 + this.tyreChangeDuration + 0.6;
      this.radioMessage = `¡BOX NO PROGRAMADO! RETRASO DE EQUIPO (${this.tyreChangeDuration.toFixed(1)}s)`;
    }

    this.resetWheelProps();
  }

  /**
   * Reset spare wheels and dismounted wheels to resting positions
   */
  public resetWheelProps(): void {
    this.hasAppliedNewTireVisualsToCar = false;
    const isUnprep = !this.isPreparedPitStop;
    const bx = this.pitBoxX;

    this.spareWheels.forEach((w, idx) => {
      if (w.userData?.basePos) {
        if (isUnprep) {
          // When unprepared, spare wheels start inside the garage on the racks!
          let gx = bx;
          if (idx === 0) gx = bx + 1.25;
          else if (idx === 1) gx = bx + 2.40;
          else if (idx === 2) gx = bx - 1.25;
          else if (idx === 3) gx = bx - 2.40;
          w.position.set(gx, 0.35, -95.5);
          w.quaternion.copy(w.userData.baseQuat);
          w.visible = true;
        } else {
          w.position.copy(w.userData.basePos);
          w.quaternion.copy(w.userData.baseQuat);
          w.visible = true;
        }
      }
    });
    this.dismountedWheels.forEach((w) => {
      w.visible = false;
    });
    this.spareShadows.forEach((s, idx) => {
      if (isUnprep) {
        s.visible = false;
      } else {
        const sp = this.spareWheels[idx]?.userData?.basePos;
        if (sp) s.position.set(sp.x, 0.009, sp.z);
        s.visible = true;
        (s.material as THREE.MeshBasicMaterial).opacity = 0.6;
      }
    });
    this.dismountedShadows.forEach((s) => {
      s.visible = false;
      (s.material as THREE.MeshBasicMaterial).opacity = 0;
    });

    // Synchronize initial standby vs garage positions of the 4 tyre technicians:
    for (let i = 0; i < 4; i++) {
      const cornerName = ['fl', 'fr', 'rl', 'rr'][i];
      const tech = this.crewByRole.get(`tyre_tech_${cornerName}`);
      if (!tech) continue;
      if (isUnprep) {
        let gx = bx;
        if (i === 0) gx = bx + 1.25;
        else if (i === 1) gx = bx + 2.40;
        else if (i === 2) gx = bx - 1.25;
        else if (i === 3) gx = bx - 2.40;
        tech.group.position.set(gx, 0, -95.5);
        tech.group.rotation.y = Math.PI; // Facing towards pit lane
        if (tech.pelvisGroup) tech.pelvisGroup.position.y = 0.72;
        if (tech.torsoGroup) tech.torsoGroup.rotation.set(0, 0, 0);
        if (tech.headGroup) tech.headGroup.rotation.set(0, 0, 0);
        if (tech.leftLeg && tech.rightLeg) {
          this.solveLegIK(tech.leftLeg, 0, 0);
          this.solveLegIK(tech.rightLeg, 0, 0);
        }
        if (tech.leftArmIK && tech.rightArmIK) {
          tech.leftArmIK.shoulder.rotation.set(0.2, 0, 0);
          tech.leftArmIK.elbow.rotation.set(0.3, 0, 0);
          tech.rightArmIK.shoulder.rotation.set(0.2, 0, 0);
          tech.rightArmIK.elbow.rotation.set(0.3, 0, 0);
        }
        if (tech.toolMesh) {
          const hipPos = PitStopManager._sHipHangPos.copy(tech.group.position);
          hipPos.x += (i % 2 === 0 ? -0.22 : 0.22);
          hipPos.y += 0.62;
          tech.toolMesh.position.copy(hipPos);
        }
      } else {
        tech.group.position.copy(tech.standbyPos);
        tech.group.rotation.y = tech.baseRotY;
        if (tech.pelvisGroup) tech.pelvisGroup.position.y = 0.72;
        if (tech.torsoGroup) tech.torsoGroup.rotation.set(0, 0, 0);
        if (tech.headGroup) tech.headGroup.rotation.set(0, 0, 0);
        if (tech.leftLeg && tech.rightLeg) {
          this.solveLegIK(tech.leftLeg, 0, 0);
          this.solveLegIK(tech.rightLeg, 0, 0);
        }
        if (tech.toolMesh) {
          tech.toolMesh.position.copy(tech.standbyPos);
        }
      }
    }
  }

  /**
   * Build overhead high-pressure pneumatic tool booms extending from the pit wall
   * Unified into CurvedPitBuildingBuilder to prevent duplicate overhead cranes and reduce draw calls.
   */
  private buildAirBooms(): void {
    this.airBoomsGroup = new THREE.Group();
    this.airHoses = [];
    this.group.add(this.airBoomsGroup);
  }

  /**
   * Analytical Two-Bone Arm Inverse Kinematics with Adaptive Natural Human Pole Vector
   * Highly optimized: zero recursive scene-graph matrix updates, zero allocations
   */
  private solveTwoBoneIK(
    arm: ArmIKJoints,
    targetWorld: THREE.Vector3,
    torsoQuat: THREE.Quaternion
  ): void {
    arm.shoulder.getWorldPosition(PitStopManager._ikShoulderWorld);

    const toTarget = PitStopManager._ikToTarget.subVectors(targetWorld, PitStopManager._ikShoulderWorld);
    let dist = toTarget.length();
    const maxReach = (arm.l1 + arm.l2) * 0.998;
    const minReach = Math.abs(arm.l1 - arm.l2) * 1.002;
    dist = Math.max(minReach, Math.min(maxReach, dist));

    const cosAlpha = Math.max(-1, Math.min(1, (arm.l1 * arm.l1 + dist * dist - arm.l2 * arm.l2) / (2 * arm.l1 * dist)));
    const alpha = Math.acos(cosAlpha);

    const cosBeta = Math.max(-1, Math.min(1, (arm.l1 * arm.l1 + arm.l2 * arm.l2 - dist * dist) / (2 * arm.l1 * arm.l2)));
    const beta = Math.acos(cosBeta);
    const elbowBend = Math.PI - beta;

    const targetDir = PitStopManager._ikTargetDir.copy(toTarget).normalize();

    // Natural human elbow kinematics (adaptive pole vector):
    // Elbow points outwards and slightly backwards from the ribcage
    const torsoRight = PitStopManager._ikTorsoRight.set(arm.isRight ? 1 : -1, 0, 0).applyQuaternion(torsoQuat);
    const torsoFwd = PitStopManager._ikTorsoFwd.set(0, 0, 1).applyQuaternion(torsoQuat);
    const torsoUp = PitStopManager._ikTorsoUp.set(0, 1, 0).applyQuaternion(torsoQuat);

    const pole = PitStopManager._ikPole.copy(torsoRight).multiplyScalar(0.85).addScaledVector(torsoFwd, -0.3);
    if (targetWorld.y < 0.38) {
      pole.addScaledVector(torsoUp, 0.45).addScaledVector(torsoRight, 0.4);
    }

    const limbNormal = PitStopManager._ikLimbNormal.crossVectors(targetDir, pole).normalize();
    if (limbNormal.lengthSq() < 0.001) {
      limbNormal.copy(torsoRight).cross(torsoUp).normalize();
    }

    const bendAxis = PitStopManager._ikBendAxis.crossVectors(limbNormal, targetDir).normalize();
    const upperArmDirWorld = PitStopManager._ikUpperArmDirWorld
      .copy(targetDir)
      .multiplyScalar(Math.cos(alpha))
      .addScaledVector(bendAxis, Math.sin(alpha))
      .normalize();

    arm.shoulder.parent?.getWorldQuaternion(PitStopManager._ikParentWorldQuat);
    const invParentQuat = PitStopManager._ikInvParentQuat.copy(PitStopManager._ikParentWorldQuat).invert();

    const localUpperArmDir = PitStopManager._ikLocalUpperArmDir.copy(upperArmDirWorld).applyQuaternion(invParentQuat);
    PitStopManager._ikQAim.setFromUnitVectors(PitStopManager._ikDefaultDir, localUpperArmDir);
    arm.shoulder.quaternion.copy(PitStopManager._ikQAim);

    arm.elbow.rotation.set(arm.isRight ? elbowBend : -elbowBend, 0, 0);
  }

  /**
   * Analytical Leg Inverse Kinematics with strict Foot Ground-Pinning
   * Solves hip, knee, and ankle angles so feet remain flat and grounded on the tarmac (Y = 0)
   * while the pelvis/hip descends into deep crouch (Y: 0.72m -> 0.44m)
   */
  private solveLegIK(leg: LegJoints, pelvisDrop: number, yawSplay: number = 0): void {
    const currentHipY = Math.max(0.38, Math.min(0.72, 0.72 - pelvisDrop));
    const totalLeg = leg.l1 + leg.l2; // 0.72m
    const clampedH = Math.min(totalLeg * 0.998, currentHipY);

    const cosHalf = Math.max(0.01, Math.min(1.0, clampedH / totalLeg));
    const halfAngle = Math.acos(cosHalf);
    const kneeBend = Math.PI - 2 * halfAngle;

    leg.hip.rotation.set(-halfAngle, yawSplay * (leg.isRight ? 1 : -1), 0);
    leg.knee.rotation.set(kneeBend, 0, 0);
    leg.ankle.rotation.set(halfAngle, 0, 0);
  }

  public isCarAtPitEntry(carPos: { x: number; z: number }, speed: number): boolean {
    if (this.cooldownTimer > 0 || this.phase !== 'none') return false;
    const inEntryCorridor = carPos.x >= -74 && carPos.x <= -45 && carPos.z >= -126.0 && carPos.z <= -112.0;
    return inEntryCorridor && speed > 0.3;
  }

  /**
   * Helper: update tool balancer coiled cable without creating garbage or GPU stalls
   */
  private updateGunBalancerCable(tech: PitCrewMember, gunPos: THREE.Vector3): void {
    if (tech.balancerCable && tech.balancerHarness) {
      tech.balancerHarness.getWorldPosition(PitStopManager._sHarnessWorld);
      PitStopManager._sTempV1.copy(gunPos).sub(PitStopManager._sHarnessWorld);
      const targetY = PitStopManager._sTempV1.y + 0.12;
      const posAttr = tech.balancerCable.geometry.attributes.position as THREE.BufferAttribute;
      // Only re-upload vertex data when position changes noticeably (> 4cm) to prevent GPU pipeline stalls
      if (
        Math.abs(posAttr.getX(1) - PitStopManager._sTempV1.x) > 0.04 ||
        Math.abs(posAttr.getY(1) - targetY) > 0.04 ||
        Math.abs(posAttr.getZ(1) - PitStopManager._sTempV1.z) > 0.04
      ) {
        posAttr.setXYZ(0, 0, 3.4, 0);
        posAttr.setXYZ(1, PitStopManager._sTempV1.x, targetY, PitStopManager._sTempV1.z);
        posAttr.needsUpdate = true;
      }
    }
  }

  /**
   * Consolidate an entire static group into a minimal number of merged meshes
   */
  private consolidateStaticGroup(group: THREE.Group): THREE.Group {
    group.updateMatrixWorld(true);
    const groupInverse = group.matrixWorld.clone().invert();

    const materialGeos = new Map<THREE.Material, THREE.BufferGeometry[]>();
    const multiMaterialMeshes: THREE.Mesh[] = [];

    group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        if (Array.isArray(obj.material)) {
          // Multi-material mesh (e.g. torso box with 6 face materials)
          const cloneMesh = obj.clone();
          const relMatrix = obj.matrixWorld.clone().premultiply(groupInverse);
          cloneMesh.geometry = obj.geometry.clone().applyMatrix4(relMatrix);
          cloneMesh.position.set(0, 0, 0);
          cloneMesh.rotation.set(0, 0, 0);
          cloneMesh.scale.set(1, 1, 1);
          cloneMesh.matrixAutoUpdate = false;
          cloneMesh.updateMatrix();
          cloneMesh.castShadow = false;
          cloneMesh.receiveShadow = true;
          multiMaterialMeshes.push(cloneMesh);
        } else if (obj.material && obj.geometry) {
          const mat = obj.material;
          const relMatrix = obj.matrixWorld.clone().premultiply(groupInverse);
          const geo = obj.geometry.clone();
          geo.applyMatrix4(relMatrix);
          if (!geo.attributes.normal) {
            geo.computeVertexNormals();
          }

          if (!materialGeos.has(mat)) {
            materialGeos.set(mat, []);
          }
          materialGeos.get(mat)!.push(geo);
        }
      }
    });

    const consolidatedGroup = new THREE.Group();
    consolidatedGroup.position.copy(group.position);
    consolidatedGroup.rotation.copy(group.rotation);

    for (const [mat, geos] of materialGeos.entries()) {
      try {
        const merged = safeMergeBufferGeometries(geos, false);
        if (merged) {
          const mergedMesh = new THREE.Mesh(merged, mat);
          mergedMesh.castShadow = false;
          mergedMesh.receiveShadow = true;
          mergedMesh.matrixAutoUpdate = false;
          mergedMesh.updateMatrix();
          consolidatedGroup.add(mergedMesh);
        }
      } catch {
        for (const g of geos) {
          const m = new THREE.Mesh(g, mat);
          m.castShadow = false;
          m.receiveShadow = true;
          m.matrixAutoUpdate = false;
          consolidatedGroup.add(m);
        }
      }
      // Critical cleanup: dispose cloned input geometries to prevent VRAM and heap retention
      for (let i = 0; i < geos.length; i++) {
        geos[i].dispose();
      }
    }

    for (const mm of multiMaterialMeshes) {
      consolidatedGroup.add(mm);
    }

    return consolidatedGroup;
  }

  /**
   * Evaluates the C2 Quintic Hermite Spline at distance x along pit lane
   * Returns exact target Z, first spatial derivative (zPrime), and second spatial derivative (zDoublePrime)
   * 100% Zero Heap Allocation - mathematical determinism
   */
  public evaluateEntryTrajectory(x: number): { targetZ: number; zPrime: number; zDoublePrime: number } {
    const useMid = this.trajHasMid && x < this.trajMid.x;
    const xA = useMid ? this.trajP0.x : (this.trajHasMid ? this.trajMid.x : this.trajP0.x);
    const xB = useMid ? this.trajMid.x : this.trajEnd.x;
    const zA = useMid ? this.trajP0.z : (this.trajHasMid ? this.trajMid.z : this.trajP0.z);
    const zB = useMid ? this.trajMid.z : this.trajEnd.z;
    const zPrimeA = useMid ? this.trajP0.zPrime : (this.trajHasMid ? this.trajMid.zPrime : this.trajP0.zPrime);
    const zPrimeB = useMid ? this.trajMid.zPrime : this.trajEnd.zPrime;

    const L = Math.max(1.0, xB - xA);
    const progress = Math.max(0, Math.min(1.0, (x - xA) / L));
    const c = progress;

    const c2 = c * c;
    const c3 = c2 * c;
    const c4 = c3 * c;
    const c5 = c4 * c;

    // Quintic Hermite basis polynomials (C2 continuous: zero jerk at endpoints)
    const h0 = 1 - 10 * c3 + 15 * c4 - 6 * c5;
    const h1 = 10 * c3 - 15 * c4 + 6 * c5;
    const h2 = c - 6 * c3 + 8 * c4 - 3 * c5;
    const h3 = -4 * c3 + 7 * c4 - 3 * c5;

    const MA = L * zPrimeA;
    const MB = L * zPrimeB;

    let targetZ = zA * h0 + zB * h1 + MA * h2 + MB * h3;

    // Pit Wall Hard Physical Clearance Barrier:
    // When past the wall start (x >= -49.0), ensure target is strictly >= -119.8 (1.7m clear of pit wall at z = -121.5)
    if (x >= -49.0) {
      targetZ = Math.max(-119.8, targetZ);
    }

    const h0Prime = -30 * c2 + 60 * c3 - 30 * c4;
    const h1Prime = 30 * c2 - 60 * c3 + 30 * c4;
    const h2Prime = 1 - 18 * c2 + 32 * c3 - 15 * c4;
    const h3Prime = -12 * c2 + 28 * c3 - 15 * c4;

    const zPrime = (zA * h0Prime + zB * h1Prime + MA * h2Prime + MB * h3Prime) / L;

    const h0Second = -60 * c + 180 * c2 - 120 * c3;
    const h1Second = 60 * c - 180 * c2 + 120 * c3;
    const h2Second = -36 * c + 96 * c2 - 60 * c3;
    const h3Second = -24 * c + 84 * c2 - 60 * c3;

    const zDoublePrime = (zA * h0Second + zB * h1Second + MA * h2Second + MB * h3Second) / (L * L);

    return { targetZ, zPrime, zDoublePrime };
  }

  public startPitEntryAutopilot(physics: VehiclePhysics, audio?: EngineSound): void {
    if (this.phase !== 'none' || this.cooldownTimer > 0) return;

    this.dockStartPos = {
      x: physics.position.x,
      z: physics.position.z,
      yaw: physics.yaw,
    };

    // Initialize C2 Quintic Spline Entry Trajectory from car's exact entry state
    this.trajP0.x = physics.position.x;
    this.trajP0.z = physics.position.z;

    // Calculate forward heading tangent
    const forwardX = Math.sin(physics.yaw);
    const forwardZ = Math.cos(physics.yaw);
    let initialZPrime = 0;
    if (forwardX > 0.15) {
      initialZPrime = forwardZ / forwardX;
    }
    // Clamped tangent ensures smooth non-violent entry curve
    this.trajP0.zPrime = THREE.MathUtils.clamp(initialZPrime, -0.65, 0.65);

    this.trajEnd.x = this.pitBoxX; // -22.0
    this.trajEnd.z = -110.5; // Pit Box Apron
    this.trajEnd.zPrime = 0; // Parallel to pit lane along +X

    if (this.trajP0.x < -38.0) {
      // Approach from pit entry lane: guide to safe center lane (Z = -114.5) >7m clear of pit wall
      const midX = Math.min(-36.0, this.trajP0.x + Math.max(10.0, (-36.0 - this.trajP0.x) * 0.72));
      this.trajMid.x = midX;
      this.trajMid.z = -114.5;
      this.trajMid.zPrime = 0;
      this.trajHasMid = true;
    } else {
      // Approaching when already past -38.0: seamless single-curve blend directly into pit box
      this.trajHasMid = false;
    }

    this.greenLightAlertTimer = 0;

    const healthDamage = (100 - physics.damage.overallHealth) / 100;
    const engineDamage = (100 - physics.damage.engineHealth) / 100;
    const crumpleDamage = Math.max(physics.damage.frontCrumple, physics.damage.rearCrumple);
    const suspDamage = (200 - (physics.damage.suspensionLeft + physics.damage.suspensionRight)) / 200;

    const avgDamage = Math.max(0, Math.min(1.0, (healthDamage * 0.4 + engineDamage * 0.3 + crumpleDamage * 0.2 + suspDamage * 0.1)));
    this.initialDamageFraction = avgDamage;

    // Pit Stop Readiness Evaluation:
    // If vehicle has already crossed the pit entry line (x >= -54.0), snapshot the notification status now.
    // If still before the line (x < -54.0), it will be evaluated at the exact crossing in entry_autopilot.
    if (physics.position.x >= -54.0) {
      this.evaluatePitLineCrossing(this.isBoxNotified);
    } else {
      this.hasCrossedPitEntryLine = false;
      this.isPreparedPitStop = this.isBoxNotified;
      if (this.isPreparedPitStop) {
        this.tyreChangeDuration = Number((2.8 + Math.random() * (3.3 - 2.8)).toFixed(2));
        this.totalDuration = 0.5 + 0.5 + this.tyreChangeDuration + 0.6;
        this.radioMessage = `ENTRADA A BOXES · EQUIPO LISTO (${this.tyreChangeDuration.toFixed(1)}s)`;
      } else {
        this.tyreChangeDuration = Number((6.1 + Math.random() * (7.2 - 6.1)).toFixed(2));
        this.totalDuration = 0.5 + 0.5 + this.tyreChangeDuration + 0.6;
        this.radioMessage = `ENTRADA A BOXES · EQUIPO DESPREPARADO (${this.tyreChangeDuration.toFixed(1)}s)`;
      }
    }

    this.elapsedTime = 0;
    this.repairProgress = 0;
    this.phase = 'entry_autopilot';
    this.group.visible = true;
    this.hasTriggeredJackUpSound = false;
    this.hasTriggeredJackDownSound = false;
    this.hasTriggeredChime = false;
    this.hasTriggeredRadioEntry = true;
    this.hasTriggeredRadioTyres = false;
    this.hasTriggeredRadioExit = false;
    this.hasAppliedNewTireVisualsToCar = false;
    this.carElevatedY = 0;

    this.resetWheelProps();

    this.radioMessage = 'ENTRADA A BOXES · LIMITADOR 60 KM/H ACTIVADO';
    if (audio) {
      audio.triggerPitRadio('box');
    }

    this.updateSpareTireVisuals(this.nextTireCompound);
    const oldConfig = TIRE_COMPOUNDS[physics.tireCompound] || TIRE_COMPOUNDS.soft;
    if (this.dismountedPzeroStripeMat) {
      this.dismountedPzeroStripeMat.color.setHex(oldConfig.stripeColorHex);
      this.dismountedPzeroStripeMat.needsUpdate = true;
    }

    if (this.lollipopDiscMat) {
      this.lollipopDiscMat.color.setHex(0xdc2626);
      this.lollipopDiscMat.emissive.setHex(0xef4444);
    }
    if (this.lollipopSignGroup) {
      this.lollipopSignGroup.rotation.y = 0;
      this.lollipopSignGroup.rotation.x = 0;
    }
  }

  public startPitStop(physics: VehiclePhysics, audio?: EngineSound): void {
    // Forward seamlessly to startPitEntryAutopilot to prevent abrupt snap / cut on entry
    this.startPitEntryAutopilot(physics, audio);
  }

  /**
   * Synchronize all spare wheel props, thermal cradles and LEDs to the target compound color
   * Ensures the spare tires that mechanics handle immediately match the chosen compound.
   */
  public updateSpareTireVisuals(compound: TireCompoundType): void {
    this.nextTireCompound = compound;
    const nextConfig = TIRE_COMPOUNDS[compound] || TIRE_COMPOUNDS.soft;

    if (this.freshPzeroStripeMat) {
      this.freshPzeroStripeMat.color.setHex(nextConfig.stripeColorHex);
      this.freshPzeroStripeMat.emissive.setHex(nextConfig.stripeColorHex);
      this.freshPzeroStripeMat.emissiveIntensity = 0.35;
      this.freshPzeroStripeMat.needsUpdate = true;
    }

    for (let i = 0; i < this.spareStripeMeshes.length; i++) {
      const ringMesh = this.spareStripeMeshes[i];
      const mat = ringMesh.material as THREE.MeshStandardMaterial;
      if (mat) {
        mat.color.setHex(nextConfig.stripeColorHex);
        mat.emissive.setHex(nextConfig.stripeColorHex);
        mat.emissiveIntensity = 0.35;
        mat.needsUpdate = true;
      }
    }

    for (let i = 0; i < this.spareLedMaterials.length; i++) {
      this.spareLedMaterials[i].color.setHex(nextConfig.stripeColorHex);
      this.spareLedMaterials[i].needsUpdate = true;
    }
  }

  public setNextTireCompound(compound: TireCompoundType): void {
    this.updateSpareTireVisuals(compound);
  }

  /**
   * Main Pit Stop Frame Update: Coreographed Multi-Stage 4-Wheel Mechanical Simulation
   */
  public update(
    dt: number,
    physics: VehiclePhysics,
    carModel: CarModel,
    particles: ParticleSystem,
    audio: EngineSound,
    inputs?: CarInputs
  ): void {
    if (this.cooldownTimer > 0) {
      this.cooldownTimer = Math.max(0, this.cooldownTimer - dt);
    }
    if (this.greenLightAlertTimer > 0) {
      this.greenLightAlertTimer = Math.max(0, this.greenLightAlertTimer - dt);
    }

    // Always update dynamic rival pit crew physics & limb animations every frame
    this.updateRivalMechanics(dt, particles);

    if (this.phase === 'none') {
      if (this.greenLightAlertTimer <= 0) {
        this.radioMessage = null;
      }
      if (this.lastDisplayBoardPhase !== 'none') {
        this.updateDisplayBoard();
        this.lastDisplayBoardPhase = 'none';
        if (this.staticStandbyCrewGroup) {
          this.staticStandbyCrewGroup.visible = true;
          for (let i = 0; i < this.crewMembers.length; i++) {
            this.crewMembers[i].proceduralBody.visible = false;
          }
        }
      }
      this.group.visible = true;
      return;
    }

    // Active pit servicing in progress (phase !== 'none'): activate individual articulated mechanics
    if (this.staticStandbyCrewGroup && this.staticStandbyCrewGroup.visible) {
      this.staticStandbyCrewGroup.visible = false;
      for (let i = 0; i < this.crewMembers.length; i++) {
        this.crewMembers[i].proceduralBody.visible = true;
      }
    }
    this.group.visible = true;
    this.lastDisplayBoardPhase = this.phase;

    // =========================================================================
    // STAGE 0: FLUID ENTRY AUTOPILOT (Smooth Kinematic Steering & Safe Corridor Guidance)
    // =========================================================================
    if (this.phase === 'entry_autopilot') {
      this.elapsedTime += dt;

      // Evaluates notification status at the exact moment of crossing the white pit entry line (x >= -54.0)
      if (!this.hasCrossedPitEntryLine && physics.position.x >= -54.0) {
        this.evaluatePitLineCrossing(this.isBoxNotified);
      }

      const pitLimitSpeed = 16.67; // 60 km/h FIA speed limit

      physics.lateralSpeed = 0;
      physics.angularVelocity = 0;

      // Wheel rotation proportional to forward motion
      const wheelDelta = (physics.speed / 0.33) * dt;
      for (let w = 0; w < 4; w++) {
        physics.wheelRotations[w] += wheelDelta;
      }
      physics.prevPosition.x = physics.position.x;
      physics.prevPosition.y = physics.position.y;
      physics.prevPosition.z = physics.position.z;
      physics.prevYaw = physics.yaw;

      // Evaluate C2 Quintic Spline Trajectory (Continuous, zero teleportation cuts)
      const { targetZ, zPrime, zDoublePrime } = this.evaluateEntryTrajectory(physics.position.x);

      const trajTheta = Math.atan(zPrime);
      const curvature = zDoublePrime / Math.pow(1.0 + zPrime * zPrime, 1.5);
      // Realistic Ackermann wheel steering proportional to path curvature
      const targetSteer = THREE.MathUtils.clamp(-3.6 * curvature, -0.42, 0.42);

      const distToStop = Math.max(0, this.pitBoxX - physics.position.x);

      if (distToStop > 2.8) {
        // Cruise and steer into box at 60 km/h speed limiter
        physics.speed = THREE.MathUtils.damp(physics.speed, pitLimitSpeed, 5.0, dt);
        if (inputs) inputs.brake = 0;
        physics.gear = physics.speed > 10 ? 2 : 1;
        physics.rpm = 1200 + (physics.speed / pitLimitSpeed) * 2400;
      } else {
        // Precise arrival braking into mechanics mark
        if (inputs) inputs.brake = 1.0;
        const brakeDecel = 60.0;
        physics.speed = Math.max(0, Math.min(physics.speed, Math.sqrt(Math.max(0, 2.0 * brakeDecel * distToStop))));
        physics.gear = 1;
        physics.rpm = 1000 + (physics.speed / pitLimitSpeed) * 2000;
      }

      // Jack operators approach naturally as car pulls into box
      const fj = this.crewByRole.get('front_jack');
      if (fj && physics.position.x > this.pitBoxX - 6.0) {
        const stepT = Math.min(1.0, (physics.position.x - (this.pitBoxX - 6.0)) / 5.0);
        fj.group.position.lerpVectors(fj.standbyPos, fj.servicePos, stepT);
      }
      const rj = this.crewByRole.get('rear_jack');
      if (rj && physics.position.x > this.pitBoxX - 6.0) {
        const stepT = Math.min(1.0, (physics.position.x - (this.pitBoxX - 6.0)) / 5.0);
        rj.group.position.lerpVectors(rj.standbyPos, rj.servicePos, stepT);
      }

      if (distToStop <= 0.05 || (distToStop <= 0.35 && physics.speed < 0.6)) {
        physics.position.x = this.pitBoxX;
        physics.position.z = -110.5;
        physics.yaw = getNearestAngle(physics.yaw, Math.PI / 2);
        physics.speed = 0;
        physics.visualSteerAngle = 0;
        physics.steerAngle = 0;
        physics.rpm = 1000;
        physics.gear = 1;
        physics.isLockedInPit = true;
        physics.prevPosition.x = physics.position.x;
        physics.prevPosition.y = physics.position.y;
        physics.prevPosition.z = physics.position.z;
        physics.prevYaw = physics.yaw;

        this.phase = 'jacks_up';
        this.elapsedTime = 0.5;
        return;
      }

      // Kinematic wheel steering and chassis yaw alignment (Ackermann steering - avoids feeling of floating!)
      const targetYaw = getNearestAngle(physics.yaw, (Math.PI / 2) - trajTheta);
      physics.yaw = THREE.MathUtils.damp(physics.yaw, targetYaw, 16.0, dt);
      physics.visualSteerAngle = THREE.MathUtils.damp(physics.visualSteerAngle, targetSteer, 14.0, dt);
      physics.steerAngle = physics.visualSteerAngle;

      // Realistic chassis suspension roll and pitch under turning & braking
      physics.roll = THREE.MathUtils.damp(physics.roll, -physics.visualSteerAngle * 0.07, 8.0, dt);
      physics.pitch = THREE.MathUtils.damp(physics.pitch, (inputs?.brake || 0) * 0.03, 8.0, dt);

      // Tangential physical advance along curve
      const dX = physics.speed * Math.cos(trajTheta) * dt;
      physics.position.x += dX;
      physics.position.z = THREE.MathUtils.damp(physics.position.z, targetZ, 20.0, dt);

      // Pit Wall Hard Physical Clearance Barrier:
      // When along pit wall (x >= -49.0), strictly guarantee vehicle never clips wall (wall is at z = -121.5)
      if (physics.position.x >= -49.0) {
        physics.position.z = Math.max(-119.8, physics.position.z);
      }

      return;
    }

    this.elapsedTime += dt;
    const t = this.elapsedTime;
    const total = Math.max(1, this.totalDuration);
    this.repairProgress = Math.min(1.0, t / total);

    // Subtle sway of hanging pneumatic hoses
    this.airHoses.forEach((hose, idx) => {
      hose.rotation.z = Math.sin(t * 3.5 + idx) * 0.05;
      hose.rotation.x = Math.cos(t * 3.0 + idx) * 0.03;
    });

    // =========================================================================
    // STAGE 1: DOCKING (0.0s - 0.5s)
    // =========================================================================
    if (t < this.dockDuration) {
      this.phase = 'docking';
      const dockT = Math.min(1.0, t / this.dockDuration);
      const easeDock = Math.sin(dockT * Math.PI * 0.5);

      physics.position.x = THREE.MathUtils.lerp(this.dockStartPos.x, this.pitBoxX, easeDock);
      physics.position.z = THREE.MathUtils.lerp(this.dockStartPos.z, -110.5, easeDock);
      physics.prevPosition.x = physics.position.x;
      physics.prevPosition.y = physics.position.y;
      physics.prevPosition.z = physics.position.z;

      const targetYaw = getNearestAngle(this.dockStartPos.yaw, Math.PI / 2);
      physics.yaw = THREE.MathUtils.lerp(this.dockStartPos.yaw, targetYaw, easeDock);
      physics.prevYaw = physics.yaw;

      physics.speed *= 0.80;
      physics.lateralSpeed = 0;
      physics.angularVelocity = 0;
      physics.pitch = THREE.MathUtils.lerp(physics.pitch, 0, 0.25);
      physics.roll = THREE.MathUtils.lerp(physics.roll, 0, 0.25);
      physics.isLockedInPit = true;

      if (!this.hasTriggeredRadioEntry) {
        this.radioMessage = 'BOX, BOX, BOX! STOP CONFIRMADO';
        audio.triggerPitRadio('box');
        this.hasTriggeredRadioEntry = true;
      }
    }
    // =========================================================================
    // STAGE 2: HYDRAULIC AIR JACKS ELEVATION (0.5s - 1.0s)
    // =========================================================================
    else if (t < 1.0) {
      this.phase = 'jacks_up';
      physics.position.x = this.pitBoxX;
      physics.position.z = -110.5;
      physics.prevPosition.x = this.pitBoxX;
      physics.prevPosition.y = physics.position.y;
      physics.prevPosition.z = -110.5;
      physics.yaw = getNearestAngle(physics.yaw, Math.PI / 2);
      physics.prevYaw = physics.yaw;
      physics.speed = 0;
      physics.isLockedInPit = true;

      if (!this.hasTriggeredJackUpSound) {
        audio.triggerPneumaticJack(true);
        this.hasTriggeredJackUpSound = true;
        particles.emitPneumaticBlast(PitStopManager._sTempV1.set(this.pitBoxX + 2.4, 0.12, -110.5), PitStopManager._sTempV2.set(0, 0.8, 0), 6);
        particles.emitPneumaticBlast(PitStopManager._sTempV1.set(this.pitBoxX - 2.4, 0.12, -110.5), PitStopManager._sTempV2.set(0, 0.8, 0), 6);
      }

      const liftT = (t - 0.5) / 0.5;
      // High-pressure lift to 0.20m
      this.carElevatedY = Math.sin(liftT * Math.PI * 0.5) * 0.20;

      this.crewMembers.forEach((m) => {
        if (m.type === 'front_jack' && m.toolMesh) {
          m.group.position.copy(m.servicePos);
          m.toolMesh.rotation.z = -liftT * 0.55;
          m.group.position.y = -liftT * 0.08;
        } else if (m.type === 'rear_jack' && m.toolMesh) {
          m.group.position.copy(m.servicePos);
          m.toolMesh.rotation.z = liftT * 0.55;
          m.group.position.y = -liftT * 0.08;
        }
      });
    }
    // =========================================================================
    // STAGE 3: FULL COMPONENT SERVICE & PHYSICAL 4-WHEEL TIRE SWAP (1.0s to total - 0.6s)
    // =========================================================================
    else if (t < total - 0.6) {
      this.phase = 'servicing';
      this.carElevatedY = 0.20;
      physics.position.x = this.pitBoxX;
      physics.position.z = -110.5;
      physics.prevPosition.x = this.pitBoxX;
      physics.prevPosition.y = physics.position.y;
      physics.prevPosition.z = -110.5;
      physics.yaw = getNearestAngle(physics.yaw, Math.PI / 2);
      physics.prevYaw = physics.yaw;
      physics.speed = 0;
      physics.isLockedInPit = true;

      const serviceDuration = (total - 0.6) - 1.0;
      const serviceT = Math.max(0, Math.min(1.0, (t - 1.0) / serviceDuration));

      const targetComp = this.nextTireCompound || physics.tireCompound;

      if (!this.hasTriggeredRadioTyres) {
        const compConfig = TIRE_COMPOUNDS[targetComp] || TIRE_COMPOUNDS.soft;
        const oldCompConfig = TIRE_COMPOUNDS[physics.tireCompound] || TIRE_COMPOUNDS.soft;
        this.updateSpareTireVisuals(targetComp);
        if (this.dismountedPzeroStripeMat) {
          this.dismountedPzeroStripeMat.color.setHex(oldCompConfig.stripeColorHex);
          this.dismountedPzeroStripeMat.needsUpdate = true;
        }
        // Keep carModel wheel mesh stripe materials strictly on the current physics compound (the old one)
        // so that unbolting and initial slide-out preserve identical visual continuity without premature popping!
        carModel.setTireCompoundVisuals(physics.tireCompound);
        this.hasAppliedNewTireVisualsToCar = false;

        this.radioMessage = `PISTOLAS ACTIVADAS · CAMBIO COMPLETO A ${compConfig.name.toUpperCase()} NUEVOS`;
        audio.triggerPitRadio('tyres');
        this.hasTriggeredRadioTyres = true;
      }

      // Seamless Tyre Compound Transition:
      // When the old worn tires are physically detached from the spindles and all 4 carModel wheel meshes
      // are hidden, swap carModel wheel stripe textures to the target compound.
      // Because the car wheels are invisible during this interval, there is zero visual popping or flicker.
      // When the fresh spare tires slide onto the hub and seat (w >= 0.96 / 0.95), carModel is unhidden
      // already displaying the identical target compound!
      const areOldWheelsDismounted = this.isPreparedPitStop ? (serviceT >= 0.22) : (serviceT >= 0.70);
      if (areOldWheelsDismounted && !this.hasAppliedNewTireVisualsToCar) {
        carModel.setTireCompoundVisuals(targetComp);
        this.hasAppliedNewTireVisualsToCar = true;
      }

      // Real-time progressive thermal dissipation on ventilated carbon ceramic discs
      const brakeGlow = Math.max(0.15, 1.0 - serviceT * 0.80);
      carModel.setBrakeDiscThermalGlow(brakeGlow);

      const spindlePos = PitStopManager._sSpindlePos;
      const axleOutDir = PitStopManager._sAxleOutDir;
      const hubQuat = PitStopManager._sHubQuat;
      const gripL = PitStopManager._sGripL;
      const gripR = PitStopManager._sGripR;
      const p0 = PitStopManager._sP0;
      const p1 = PitStopManager._sP1;
      const p2 = PitStopManager._sP2;
      const p3 = PitStopManager._sP3;
      const wheelInterpolatedPos = PitStopManager._sWheelInterpPos;
      const techTorsoQuat = PitStopManager._sTechTorsoQuat;

      // --- PHYSICAL 4-WHEEL TIRE REPLACEMENT CHOREOGRAPHY (Articulated Biomechanics & Tool Balancers) ---
      for (let i = 0; i < 4; i++) {
        carModel.getSpindleWorldTransform(i, spindlePos, axleOutDir, hubQuat);
        const spare = this.spareWheels[i];
        const dismounted = this.dismountedWheels[i];
        const spareShadow = this.spareShadows[i];
        const dismountedShadow = this.dismountedShadows[i];
        const spareBasePos = spare.userData.basePos as THREE.Vector3;
        const cornerName = ['fl', 'fr', 'rl', 'rr'][i];
        const isLeft = (i % 2 === 0);
        const isFront = (i < 2);
        const tech = this.crewByRole.get(`tyre_tech_${cornerName}`);
        if (!tech) continue;

        tech.torsoGroup?.getWorldQuaternion(techTorsoQuat);

        const floorPos = tech.floorRestPos || PitStopManager._sFloorPos.set(
          spindlePos.x + (isFront ? 0.70 : -0.70),
          0.16,
          spindlePos.z + (isLeft ? 1.15 : -1.15)
        );
        const floorQuat = PitStopManager._sFloorQuat.setFromEuler(
          PitStopManager._sFloorEuler.set(isLeft ? Math.PI * 0.45 : -Math.PI * 0.45, 0, Math.PI / 2)
        );

        // =====================================================================
        // CHOREOGRAPHY TRACK A: PREPARED ULTRA-FAST F1 PIT STOP (2.8s - 3.3s)
        // =====================================================================
        if (this.isPreparedPitStop) {
          // 1. SUB-PHASE 3.1 (0.00 to 0.22): UNBOLTING & AXIAL SLIDE-OUT
          if (serviceT < 0.22) {
            const w = quinticSmooth(serviceT / 0.22);
            tech.group.position.lerpVectors(tech.standbyPos, tech.servicePos, w);
            
            // Articulated leg IK: deep racing crouch towards the hub
            const pelvisDrop = 0.24 * w;
            if (tech.pelvisGroup) tech.pelvisGroup.position.y = 0.72 - pelvisDrop;
            if (tech.leftLeg && tech.rightLeg) {
              this.solveLegIK(tech.leftLeg, pelvisDrop, 0.15);
              this.solveLegIK(tech.rightLeg, pelvisDrop, 0.15);
            }
            if (tech.torsoGroup) tech.torsoGroup.rotation.set(-0.16 * w, 0, 0);
            if (tech.headGroup) tech.headGroup.rotation.set(0.20 * w, 0, 0);

            spare.visible = true;
            spare.position.copy(spareBasePos);
            spare.quaternion.copy(spare.userData.baseQuat);
            if (spareShadow) {
              spareShadow.position.set(spareBasePos.x, 0.009, spareBasePos.z);
              spareShadow.visible = true;
            }

            if (w < 0.45) {
              // High-Torque Paoli DP 6000 unbolting with reactive recoil
              carModel.setWheelVisible(i, true);
              carModel.setWheelOffset(i, 0);
              dismounted.visible = false;
              if (dismountedShadow) dismountedShadow.visible = false;

              const recoil = Math.sin(t * 68) * 0.010;
              const gunTipPos = PitStopManager._sGunTipPos.copy(spindlePos).addScaledVector(axleOutDir, 0.05 + recoil);
              
              if (tech.toolMesh) {
                tech.toolMesh.position.copy(gunTipPos);
                tech.toolMesh.quaternion.copy(hubQuat);
                if (isLeft) tech.toolMesh.rotateY(Math.PI);
                this.updateGunBalancerCable(tech, tech.toolMesh.position);
              }

              carModel.setCenterlockNutSpin(i, -t * 150);

              gripR.copy(gunTipPos);
              gripR.y -= 0.06;
              gripR.z += isLeft ? 0.08 : -0.08;

              gripL.copy(gunTipPos).addScaledVector(axleOutDir, 0.10);
              gripL.x += isLeft ? -0.12 : 0.12;
              gripL.y += 0.04;
            } else {
              // Nut is loose! Gun docks to suspended balancer, hands grip tire, slide wheel straight out along axleOutDir
              const slideOutT = quinticSmooth((w - 0.45) / 0.55);
              const slideDist = slideOutT * 0.45;
              carModel.setWheelVisible(i, false);
              dismounted.visible = true;
              dismounted.position.copy(spindlePos).addScaledVector(axleOutDir, slideDist);
              dismounted.quaternion.copy(hubQuat);

              if (dismountedShadow) {
                dismountedShadow.visible = true;
                dismountedShadow.position.set(dismounted.position.x, 0.009, dismounted.position.z);
                (dismountedShadow.material as THREE.MeshBasicMaterial).opacity = 0.55;
              }

              // Gun floats on overhead balancer harness beside technician
              if (tech.toolMesh) {
                const hipHangPos = PitStopManager._sHipHangPos.copy(tech.group.position);
                hipHangPos.x += isLeft ? 0.32 : -0.32;
                hipHangPos.y += 0.62;
                hipHangPos.z += 0.15;
                tech.toolMesh.position.lerp(hipHangPos, 0.25);
                tech.toolMesh.rotation.set(0.12, isLeft ? 0.35 : -0.35, 0);
                this.updateGunBalancerCable(tech, tech.toolMesh.position);
              }

              // Both hands grip the tire shoulders naturally
              gripR.copy(dismounted.position);
              gripR.x += isLeft ? 0.20 : -0.20;
              gripL.copy(dismounted.position);
              gripL.x += isLeft ? -0.20 : 0.20;
            }

            if (tech.leftArmIK && tech.rightArmIK) {
              this.solveTwoBoneIK(tech.rightArmIK, gripR, techTorsoQuat);
              this.solveTwoBoneIK(tech.leftArmIK, gripL, techTorsoQuat);
            }
          }
          // 2. SUB-PHASE 3.2 (0.22 to 0.45): PARABOLIC ARC & FLOOR PLACEMENT (Two-Handed Tire Carry)
          else if (serviceT < 0.45) {
            const w = quinticSmooth((serviceT - 0.22) / 0.23);
            carModel.setWheelVisible(i, false);
            dismounted.visible = true;
            spare.visible = true;
            spare.position.copy(spareBasePos);
            spare.quaternion.copy(spare.userData.baseQuat);

            // Deep crouch and hip twist to lower the tire to the floor
            const pelvisDrop = 0.24 + 0.06 * w;
            if (tech.pelvisGroup) tech.pelvisGroup.position.y = 0.72 - pelvisDrop;
            if (tech.leftLeg && tech.rightLeg) {
              this.solveLegIK(tech.leftLeg, pelvisDrop, 0.18);
              this.solveLegIK(tech.rightLeg, pelvisDrop, 0.18);
            }

            // Spine counter-balance when holding 13kg tire
            const yawTwist = (isFront ? 0.38 : -0.38) * w * (isLeft ? 1 : -1);
            if (tech.torsoGroup) tech.torsoGroup.rotation.set(-0.16 + 0.08 * (1 - w), yawTwist, 0);
            if (tech.headGroup) tech.headGroup.rotation.set(0.24, (isFront ? 0.45 : -0.45) * w * (isLeft ? 1 : -1), 0);

            const slidePos = p0.copy(spindlePos).addScaledVector(axleOutDir, 0.45);
            p1.copy(slidePos);
            p1.y += 0.06;
            PitStopManager._sTempV1.copy(floorPos).sub(slidePos);
            p1.addScaledVector(PitStopManager._sTempV1, 0.35);

            p2.copy(floorPos);
            p2.y += 0.16;
            p3.copy(floorPos);

            cubicBezier3D(p0, p1, p2, p3, w, wheelInterpolatedPos);
            dismounted.position.copy(wheelInterpolatedPos);
            dismounted.quaternion.slerpQuaternions(hubQuat, floorQuat, w);

            if (dismountedShadow) {
              dismountedShadow.visible = true;
              dismountedShadow.position.set(dismounted.position.x, 0.009, dismounted.position.z);
              const h = Math.max(0, dismounted.position.y - 0.16);
              (dismountedShadow.material as THREE.MeshBasicMaterial).opacity = Math.max(0.15, 0.75 - h * 1.5);
            }

            // Gun is suspended from overhead balancer
            if (tech.toolMesh) {
              const hipHangPos = PitStopManager._sHipHangPos.copy(tech.group.position);
              hipHangPos.x += isLeft ? 0.32 : -0.32;
              hipHangPos.y += 0.62;
              hipHangPos.z += 0.15;
              tech.toolMesh.position.copy(hipHangPos);
              this.updateGunBalancerCable(tech, tech.toolMesh.position);
            }

            // Both hands firmly hold the tire tread
            gripR.copy(dismounted.position);
            gripR.x += isLeft ? 0.19 : -0.19;
            gripR.y += 0.04 * (1 - w);

            gripL.copy(dismounted.position);
            gripL.x += isLeft ? -0.19 : 0.19;
            gripL.y += 0.04 * (1 - w);

            if (tech.leftArmIK && tech.rightArmIK) {
              this.solveTwoBoneIK(tech.rightArmIK, gripR, techTorsoQuat);
              this.solveTwoBoneIK(tech.leftArmIK, gripL, techTorsoQuat);
            }
          }
          // 3. SUB-PHASE 3.3 (0.45 to 0.62): REACH TO FRESH TIRE ON THERMAL RACK
          else if (serviceT < 0.62) {
            const w = quinticSmooth((serviceT - 0.45) / 0.17);
            dismounted.visible = true;
            dismounted.position.copy(floorPos);
            dismounted.quaternion.copy(floorQuat);
            if (dismountedShadow) {
              dismountedShadow.position.set(floorPos.x, 0.009, floorPos.z);
              (dismountedShadow.material as THREE.MeshBasicMaterial).opacity = 0.75;
            }

            spare.visible = true;
            spare.position.copy(spareBasePos);
            spare.quaternion.copy(spare.userData.baseQuat);

            // Pelvis rises slightly to pivot towards thermal rack
            const pelvisDrop = THREE.MathUtils.lerp(0.30, 0.22, w);
            if (tech.pelvisGroup) tech.pelvisGroup.position.y = 0.72 - pelvisDrop;
            if (tech.leftLeg && tech.rightLeg) {
              this.solveLegIK(tech.leftLeg, pelvisDrop, 0.14);
              this.solveLegIK(tech.rightLeg, pelvisDrop, 0.14);
            }

            const floorYaw = (isFront ? 0.38 : -0.38) * (isLeft ? 1 : -1);
            const rackYaw = (isFront ? -0.42 : 0.42) * (isLeft ? 1 : -1);
            const currentTorsoYaw = THREE.MathUtils.lerp(floorYaw, rackYaw, w);
            if (tech.torsoGroup) tech.torsoGroup.rotation.set(-0.16, currentTorsoYaw, 0);
            if (tech.headGroup) tech.headGroup.rotation.set(0.20, THREE.MathUtils.lerp(floorYaw * 1.2, rackYaw * 1.2, w), 0);

            const floorGripL = PitStopManager._sFloorGripL.copy(floorPos);
            floorGripL.x += isLeft ? -0.19 : 0.19;

            const floorGripR = PitStopManager._sFloorGripR.copy(floorPos);
            floorGripR.x += isLeft ? 0.19 : -0.19;

            const rackGripL = PitStopManager._sRackGripL.copy(spareBasePos);
            rackGripL.x += isLeft ? -0.19 : 0.19;

            const rackGripR = PitStopManager._sRackGripR.copy(spareBasePos);
            rackGripR.x += isLeft ? 0.19 : -0.19;

            const midLift = Math.sin(w * Math.PI) * 0.15;
            gripL.lerpVectors(floorGripL, rackGripL, w);
            gripL.y += midLift;

            gripR.lerpVectors(floorGripR, rackGripR, w);
            gripR.y += midLift;

            if (tech.leftArmIK && tech.rightArmIK) {
              this.solveTwoBoneIK(tech.rightArmIK, gripR, techTorsoQuat);
              this.solveTwoBoneIK(tech.leftArmIK, gripL, techTorsoQuat);
            }
          }
          // 4. SUB-PHASE 3.4 (0.62 to 0.85): ELEVATED ARC LIFT & AXIAL SPINDLE MOUNTING (Drive Pegs Alignment & Impact Shudder)
          else if (serviceT < 0.85) {
            const w = quinticSmooth((serviceT - 0.62) / 0.23);
            dismounted.position.copy(floorPos);
            dismounted.quaternion.copy(floorQuat);

            const pelvisDrop = 0.25;
            if (tech.pelvisGroup) tech.pelvisGroup.position.y = 0.72 - pelvisDrop;
            if (tech.leftLeg && tech.rightLeg) {
              this.solveLegIK(tech.leftLeg, pelvisDrop, 0.14);
              this.solveLegIK(tech.rightLeg, pelvisDrop, 0.14);
            }

            const rackYaw = (isFront ? -0.42 : 0.42) * (isLeft ? 1 : -1);
            if (tech.torsoGroup) tech.torsoGroup.rotation.set(-0.16 * (1 - w * 0.3), rackYaw * (1 - w), 0);
            if (tech.headGroup) tech.headGroup.rotation.set(0.18, rackYaw * (1 - w), 0);

            const alignPos = PitStopManager._sAlignPos.copy(spindlePos).addScaledVector(axleOutDir, 0.45);

            if (w < 0.65) {
              const u = quinticSmooth(w / 0.65);
              p0.copy(spareBasePos);
              p1.copy(spareBasePos);
              p1.y += 0.24;

              p2.copy(alignPos);
              p2.y += 0.12;
              p3.copy(alignPos);

              cubicBezier3D(p0, p1, p2, p3, u, wheelInterpolatedPos);
              spare.position.copy(wheelInterpolatedPos);
              spare.quaternion.slerpQuaternions(spare.userData.baseQuat, hubQuat, u);
              spare.visible = true;
              carModel.setWheelVisible(i, false);

              if (spareShadow) {
                spareShadow.visible = true;
                spareShadow.position.set(spare.position.x, 0.009, spare.position.z);
                const h = Math.max(0, spare.position.y - 0.16);
                (spareShadow.material as THREE.MeshBasicMaterial).opacity = Math.max(0.12, 0.75 - h * 1.5);
              }
            } else {
              const u = quinticSmooth((w - 0.65) / 0.35);
              // Drive pegs micro-alignment wobble during axial insertion
              const pegWobble = Math.sin(u * Math.PI * 4.0) * (1.0 - u) * 0.075;
              spare.position.lerpVectors(alignPos, spindlePos, u);
              spare.quaternion.copy(hubQuat);
              spare.rotateX(pegWobble);

              // High-frequency mechanical contact shudder upon seating flush against brake bell
              if (w >= 0.94) {
                const shudderProgress = (w - 0.94) / 0.06;
                const shudder = Math.sin(shudderProgress * Math.PI * 6.0) * Math.exp(-shudderProgress * 6.0) * 0.015;
                spare.position.addScaledVector(axleOutDir, shudder);
              }

              if (spareShadow) {
                spareShadow.visible = true;
                spareShadow.position.set(spare.position.x, 0.009, spare.position.z);
                (spareShadow.material as THREE.MeshBasicMaterial).opacity = 0.65;
              }

              if (w >= 0.96) {
                if (!this.hasAppliedNewTireVisualsToCar) {
                  carModel.setTireCompoundVisuals(targetComp);
                  this.hasAppliedNewTireVisualsToCar = true;
                }
                spare.visible = false;
                carModel.setWheelVisible(i, true);
                carModel.setWheelOffset(i, 0);
              } else {
                spare.visible = true;
                carModel.setWheelVisible(i, false);
              }
            }

            // Hands support the wheel securely
            gripL.copy(spare.position);
            gripL.x += isLeft ? -0.19 : 0.19;

            gripR.copy(spare.position);
            gripR.x += isLeft ? 0.19 : -0.19;

            if (tech.leftArmIK && tech.rightArmIK) {
              this.solveTwoBoneIK(tech.rightArmIK, gripR, techTorsoQuat);
              this.solveTwoBoneIK(tech.leftArmIK, gripL, techTorsoQuat);
            }
          }
          // 5. SUB-PHASE 3.5 (0.85 to 1.00): HIGH-TORQUE 3000 Nm FASTENING & SIGNAL OK
          else {
            const w = quinticSmooth((serviceT - 0.85) / 0.15);
            if (!this.hasAppliedNewTireVisualsToCar) {
              carModel.setTireCompoundVisuals(targetComp);
              this.hasAppliedNewTireVisualsToCar = true;
            }
            carModel.setWheelVisible(i, true);
            carModel.setWheelOffset(i, 0);
            spare.visible = false;
            if (spareShadow) spareShadow.visible = false;
            dismounted.visible = true;
            dismounted.position.copy(floorPos);
            dismounted.quaternion.copy(floorQuat);

            if (w < 0.68) {
              // Rapid bolting: gun returns into hands with spring-damper impulse recoil
              const recoil = Math.sin(t * 72) * 0.012;
              const gunTipPos = PitStopManager._sGunTipPos.copy(spindlePos).addScaledVector(axleOutDir, 0.04 + recoil);

              if (tech.toolMesh) {
                tech.toolMesh.position.copy(gunTipPos);
                tech.toolMesh.quaternion.copy(hubQuat);
                if (isLeft) tech.toolMesh.rotateY(Math.PI);
                this.updateGunBalancerCable(tech, tech.toolMesh.position);
              }

              carModel.setCenterlockNutSpin(i, t * 160);

              const pelvisDrop = 0.24;
              if (tech.pelvisGroup) tech.pelvisGroup.position.y = 0.72 - pelvisDrop;
              if (tech.leftLeg && tech.rightLeg) {
                this.solveLegIK(tech.leftLeg, pelvisDrop, 0.15);
                this.solveLegIK(tech.rightLeg, pelvisDrop, 0.15);
              }

              gripR.copy(gunTipPos);
              gripR.y -= 0.06;
              gripR.z += isLeft ? 0.08 : -0.08;

              gripL.copy(gunTipPos).addScaledVector(axleOutDir, 0.10);
              gripL.x += isLeft ? -0.12 : 0.12;
              gripL.y += 0.04;

              if (tech.torsoGroup) tech.torsoGroup.rotation.set(-0.16, 0, 0);
              if (tech.headGroup) tech.headGroup.rotation.set(0.18, 0, 0);

              if (tech.leftArmIK && tech.rightArmIK) {
                this.solveTwoBoneIK(tech.rightArmIK, gripR, techTorsoQuat);
                this.solveTwoBoneIK(tech.leftArmIK, gripL, techTorsoQuat);
              }
            } else {
              // Torqued & Locked! Technician smoothly stands upright with legs extending naturally, steps back, and signals OK
              const u = quinticSmooth((w - 0.68) / 0.32);
              tech.group.position.lerpVectors(tech.servicePos, tech.exitPos, u);

              // Legs extend from crouch (0.24m drop) back to full standing height (0.0m drop)
              const pelvisDrop = THREE.MathUtils.lerp(0.24, 0.0, u);
              if (tech.pelvisGroup) tech.pelvisGroup.position.y = 0.72 - pelvisDrop;
              if (tech.leftLeg && tech.rightLeg) {
                this.solveLegIK(tech.leftLeg, pelvisDrop, THREE.MathUtils.lerp(0.15, 0.0, u));
                this.solveLegIK(tech.rightLeg, pelvisDrop, THREE.MathUtils.lerp(0.15, 0.0, u));
              }

              if (tech.torsoGroup) tech.torsoGroup.rotation.set(0, 0, 0);
              if (tech.headGroup) tech.headGroup.rotation.set(-0.25, isLeft ? -0.15 : 0.15, 0);

              // Gun rests suspended
              if (tech.toolMesh) {
                const hipHangPos = PitStopManager._sHipHangPos.copy(tech.group.position);
                hipHangPos.x += isLeft ? 0.35 : -0.35;
                hipHangPos.y += 0.75;
                hipHangPos.z += 0.12;
                tech.toolMesh.position.lerp(hipHangPos, 0.25);
                this.updateGunBalancerCable(tech, tech.toolMesh.position);
              }

              if (tech.rightArmIK) {
                tech.rightArmIK.shoulder.rotation.set(0.35, 0, 0);
                tech.rightArmIK.elbow.rotation.set(0.55, 0, 0);
              }
              if (tech.leftArmIK) {
                tech.leftArmIK.shoulder.rotation.set(-1.45, 0, isLeft ? 0.35 : -0.35);
                tech.leftArmIK.elbow.rotation.set(0.25, 0, 0);
              }
            }
          }
        }
        // =====================================================================
        // CHOREOGRAPHY TRACK B: UNPREPARED SCRAMBLE PIT STOP (6.1s - 7.2s)
        // High-Fidelity Biomechanics, Wing-Rounding Anti-Clipping & Zero-Teleport Handlers
        // =====================================================================
        else {
          const bx = this.pitBoxX;
          let garageX = bx;
          const garageZ = -95.5; // Strictly inside the garage bay on epoxy floor (behind frontZ = -99.0)
          if (i === 0) { garageX = bx + 1.25; }
          else if (i === 1) { garageX = bx + 2.40; }
          else if (i === 2) { garageX = bx - 1.25; }
          else if (i === 3) { garageX = bx - 2.40; }

          const garageStartPos = PitStopManager._sGaragePos.set(garageX, 0, garageZ);

          // 1. SUB-PHASE B.1 (0.00 to 0.12): GARAGE REACTION & SQUAT-LIFT COLD SLICKS
          if (serviceT < 0.12) {
            const w = quinticSmooth(serviceT / 0.12);
            tech.group.position.copy(garageStartPos);
            tech.group.rotation.y = Math.PI; // Facing towards pit lane

            const squat = Math.sin(w * Math.PI) * 0.26;
            const pelvisDrop = squat;
            if (tech.pelvisGroup) tech.pelvisGroup.position.y = 0.72 - pelvisDrop;
            if (tech.leftLeg && tech.rightLeg) {
              this.solveLegIK(tech.leftLeg, pelvisDrop, 0.14);
              this.solveLegIK(tech.rightLeg, pelvisDrop, 0.14);
            }
            if (tech.torsoGroup) tech.torsoGroup.rotation.set(-0.18 * Math.sin(w * Math.PI), 0, 0);
            if (tech.headGroup) tech.headGroup.rotation.set(0.12, 0, 0);

            carModel.setWheelVisible(i, true);
            carModel.setWheelOffset(i, 0);
            dismounted.visible = false;
            if (dismountedShadow) dismountedShadow.visible = false;

            const liftHeight = THREE.MathUtils.lerp(0.35, 0.82, w);
            spare.visible = true;
            spare.position.set(garageX, liftHeight, garageZ - 0.28 * w);
            spare.quaternion.copy(spare.userData.baseQuat);
            if (spareShadow) spareShadow.visible = false;

            // Wheel gun safely holstered at right hip
            if (tech.toolMesh) {
              const hipHangPos = PitStopManager._sHipHangPos.copy(tech.group.position);
              hipHangPos.x += (i % 2 === 0 ? -0.22 : 0.22);
              hipHangPos.y += 0.62;
              tech.toolMesh.position.copy(hipHangPos);
              tech.toolMesh.rotation.set(0.2, 0, 0);
              this.updateGunBalancerCable(tech, tech.toolMesh.position);
            }

            // Both hands grip tire sides
            gripL.copy(spare.position);
            gripL.x -= 0.19;
            gripR.copy(spare.position);
            gripR.x += 0.19;
            if (tech.leftArmIK && tech.rightArmIK) {
              this.solveTwoBoneIK(tech.rightArmIK, gripR, techTorsoQuat);
              this.solveTwoBoneIK(tech.leftArmIK, gripL, techTorsoQuat);
            }
          }
          // 2. SUB-PHASE B.2 (0.12 to 0.48): SPRINT TO PIT BOX ROUNDING FRONT/REAR WINGS (NO CLIPPING)
          else if (serviceT < 0.48) {
            const runW = quinticSmooth((serviceT - 0.12) / 0.36);

            const p0 = PitStopManager._sBezP0;
            const p1 = PitStopManager._sBezP1;
            const p2 = PitStopManager._sBezP2;
            const p3 = PitStopManager._sBezP3;

            if (i === 1) {
              // FRONT-RIGHT: Starts inside garage, exits through portal, rounds comfortably ahead of Front Wing & Front Jack
              p0.set(bx + 2.40, 0, -95.5);
              p1.set(bx + 4.80, 0, -103.0);
              p2.set(bx + 4.60, 0, -114.5);
              p3.set(bx + 1.25, 0, -112.40);
            } else if (i === 3) {
              // REAR-RIGHT: Starts inside garage, exits through portal, rounds comfortably behind Rear Wing & Rear Jack
              p0.set(bx - 2.40, 0, -95.5);
              p1.set(bx - 4.80, 0, -103.0);
              p2.set(bx - 4.60, 0, -114.5);
              p3.set(bx - 1.25, 0, -112.40);
            } else if (i === 0) {
              // FRONT-LEFT: Direct advance sprinting out of garage to front-left hub
              p0.set(bx + 1.25, 0, -95.5);
              p1.set(bx + 1.25, 0, -100.5);
              p2.set(bx + 1.25, 0, -105.0);
              p3.set(bx + 1.25, 0, -108.60);
            } else {
              // REAR-LEFT: Direct advance sprinting out of garage to rear-left hub
              p0.set(bx - 1.25, 0, -95.5);
              p1.set(bx - 1.25, 0, -100.5);
              p2.set(bx - 1.25, 0, -105.0);
              p3.set(bx - 1.25, 0, -108.60);
            }

            cubicBezier3D(p0, p1, p2, p3, runW, tech.group.position);

            const u = 1 - runW;
            const tangent = PitStopManager._sTangentDir;
            tangent.x = 3 * u * u * (p1.x - p0.x) + 6 * u * runW * (p2.x - p1.x) + 3 * runW * runW * (p3.x - p2.x);
            tangent.z = 3 * u * u * (p1.z - p0.z) + 6 * u * runW * (p2.z - p1.z) + 3 * runW * runW * (p3.z - p2.z);
            tangent.y = 0;
            if (tangent.lengthSq() > 0.001) {
              tangent.normalize();
              let heading = Math.atan2(tangent.x, tangent.z);
              // Smooth transition to final service orientation at destination
              const targetServiceHeading = isLeft ? Math.PI : 0;
              if (runW > 0.75) {
                const blendT = quinticSmooth((runW - 0.75) / 0.25);
                heading = getNearestAngle(heading, targetServiceHeading);
                heading = THREE.MathUtils.lerp(heading, targetServiceHeading, blendT);
              }
              tech.group.rotation.y = heading;
            }

            // High-realism running gait & pelvic oscillation
            const strideCycle = runW * Math.PI * 10.0;
            const runBounce = Math.abs(Math.sin(strideCycle)) * 0.045;
            if (tech.pelvisGroup) tech.pelvisGroup.position.y = 0.72 - runBounce;
            if (tech.leftLeg && tech.rightLeg) {
              const leftLegDrop = Math.max(0, Math.sin(strideCycle)) * 0.12;
              const rightLegDrop = Math.max(0, -Math.sin(strideCycle)) * 0.12;
              this.solveLegIK(tech.leftLeg, runBounce + leftLegDrop, 0.10);
              this.solveLegIK(tech.rightLeg, runBounce + rightLegDrop, 0.10);
            }
            if (tech.torsoGroup) {
              tech.torsoGroup.rotation.set(-0.14, Math.sin(strideCycle) * 0.05, 0);
            }
            if (tech.headGroup) {
              tech.headGroup.rotation.set(0.12, 0, 0);
            }

            carModel.setWheelVisible(i, true);
            carModel.setWheelOffset(i, 0);
            dismounted.visible = false;
            if (dismountedShadow) dismountedShadow.visible = false;

            // Carry spare tire securely against chest
            const fwd = PitStopManager._sForwardDir.set(Math.sin(tech.group.rotation.y), 0, Math.cos(tech.group.rotation.y));
            const side = PitStopManager._sSideDir.set(Math.cos(tech.group.rotation.y), 0, -Math.sin(tech.group.rotation.y));

            spare.visible = true;
            spare.position.copy(tech.group.position);
            spare.position.y = 0.82 - runBounce * 0.5;
            spare.position.addScaledVector(fwd, 0.28);
            spare.quaternion.copy(tech.group.quaternion);

            if (spareShadow) spareShadow.visible = false;

            // Holstered wheel gun follows right hip
            if (tech.toolMesh) {
              const hipHangPos = PitStopManager._sHipHangPos.copy(tech.group.position);
              hipHangPos.addScaledVector(side, isLeft ? -0.22 : 0.22);
              hipHangPos.y += 0.62;
              tech.toolMesh.position.copy(hipHangPos);
              tech.toolMesh.rotation.set(0.2, 0, 0);
              this.updateGunBalancerCable(tech, tech.toolMesh.position);
            }

            // Both hands grip tire tread securely
            gripL.copy(spare.position).addScaledVector(side, -0.19);
            gripR.copy(spare.position).addScaledVector(side, 0.19);
            if (tech.leftArmIK && tech.rightArmIK) {
              this.solveTwoBoneIK(tech.rightArmIK, gripR, techTorsoQuat);
              this.solveTwoBoneIK(tech.leftArmIK, gripL, techTorsoQuat);
            }
          }
          // 3. SUB-PHASE B.3 (0.48 to 0.58): ARRIVAL, CROUCH & SET DOWN FRESH TIRE
          else if (serviceT < 0.58) {
            const w = quinticSmooth((serviceT - 0.48) / 0.10);
            tech.group.position.copy(tech.servicePos);
            tech.group.rotation.y = isLeft ? Math.PI : 0;

            const pelvisDrop = THREE.MathUtils.lerp(0.0, 0.24, w);
            if (tech.pelvisGroup) tech.pelvisGroup.position.y = 0.72 - pelvisDrop;
            if (tech.leftLeg && tech.rightLeg) {
              this.solveLegIK(tech.leftLeg, pelvisDrop, 0.15);
              this.solveLegIK(tech.rightLeg, pelvisDrop, 0.15);
            }

            const twistYaw = (isFront ? 0.25 : -0.25) * w * (isLeft ? 1 : -1);
            if (tech.torsoGroup) tech.torsoGroup.rotation.set(-0.16 * w, twistYaw, 0);
            if (tech.headGroup) tech.headGroup.rotation.set(0.18 * w, twistYaw * 0.5, 0);

            carModel.setWheelVisible(i, true);
            carModel.setWheelOffset(i, 0);
            dismounted.visible = false;
            if (dismountedShadow) dismountedShadow.visible = false;

            const freshRestPos = PitStopManager._sFreshRestPos.set(floorPos.x + (isFront ? 0.35 : -0.35), 0.16, floorPos.z);
            const chestHoldPos = PitStopManager._sChestHoldPos.copy(tech.servicePos);
            chestHoldPos.y = 0.82;
            const fwd = PitStopManager._sForwardDir.set(Math.sin(tech.group.rotation.y), 0, Math.cos(tech.group.rotation.y));
            chestHoldPos.addScaledVector(fwd, 0.28);

            spare.visible = true;
            spare.position.lerpVectors(chestHoldPos, freshRestPos, w);
            spare.quaternion.slerpQuaternions(tech.group.quaternion, floorQuat, w);

            if (spareShadow) {
              spareShadow.visible = true;
              spareShadow.position.set(freshRestPos.x, 0.009, freshRestPos.z);
              (spareShadow.material as THREE.MeshBasicMaterial).opacity = THREE.MathUtils.lerp(0.2, 0.65, w);
            }

            if (tech.toolMesh) {
              const hipHangPos = PitStopManager._sHipHangPos.copy(tech.group.position);
              hipHangPos.x += (isLeft ? -0.22 : 0.22);
              hipHangPos.y += 0.62;
              tech.toolMesh.position.copy(hipHangPos);
              tech.toolMesh.rotation.set(0.2, 0, 0);
              this.updateGunBalancerCable(tech, tech.toolMesh.position);
            }

            gripL.copy(spare.position);
            gripL.x += (isLeft ? 0.19 : -0.19);
            gripR.copy(spare.position);
            gripR.x += (isLeft ? -0.19 : 0.19);
            if (tech.leftArmIK && tech.rightArmIK) {
              this.solveTwoBoneIK(tech.rightArmIK, gripR, techTorsoQuat);
              this.solveTwoBoneIK(tech.leftArmIK, gripL, techTorsoQuat);
            }
          }
          // 4. SUB-PHASE B.4 (0.58 to 0.70): DRAW WHEEL GUN & UNBOLT CENTERLOCK NUT
          else if (serviceT < 0.70) {
            const w = quinticSmooth((serviceT - 0.58) / 0.12);
            tech.group.position.copy(tech.servicePos);
            tech.group.rotation.y = isLeft ? Math.PI : 0;

            const pelvisDrop = 0.24;
            if (tech.pelvisGroup) tech.pelvisGroup.position.y = 0.72 - pelvisDrop;
            if (tech.leftLeg && tech.rightLeg) {
              this.solveLegIK(tech.leftLeg, pelvisDrop, 0.15);
              this.solveLegIK(tech.rightLeg, pelvisDrop, 0.15);
            }
            if (tech.torsoGroup) tech.torsoGroup.rotation.set(-0.16, 0, 0);
            if (tech.headGroup) tech.headGroup.rotation.set(0.18, 0, 0);

            const freshRestPos = PitStopManager._sFreshRestPos.set(floorPos.x + (isFront ? 0.35 : -0.35), 0.16, floorPos.z);
            spare.visible = true;
            spare.position.copy(freshRestPos);
            spare.quaternion.copy(floorQuat);

            carModel.setWheelVisible(i, true);
            carModel.setWheelOffset(i, 0);
            dismounted.visible = false;
            if (dismountedShadow) dismountedShadow.visible = false;

            const recoil = Math.sin(t * 70) * 0.010;
            const gunTipPos = PitStopManager._sGunTipPos.copy(spindlePos).addScaledVector(axleOutDir, 0.05 + recoil);
            const hipHangPos = PitStopManager._sHipHangPos.copy(tech.group.position);
            hipHangPos.x += (isLeft ? -0.22 : 0.22);
            hipHangPos.y += 0.62;

            if (w < 0.35) {
              // Draw gun from hip holster to wheel spindle
              const drawT = quinticSmooth(w / 0.35);
              if (tech.toolMesh) {
                tech.toolMesh.position.lerpVectors(hipHangPos, gunTipPos, drawT);
                tech.toolMesh.quaternion.slerpQuaternions(tech.group.quaternion, hubQuat, drawT);
                if (isLeft) tech.toolMesh.rotateY(Math.PI);
                this.updateGunBalancerCable(tech, tech.toolMesh.position);
              }
              gripR.copy(tech.toolMesh ? tech.toolMesh.position : gunTipPos);
              gripL.copy(spindlePos).addScaledVector(axleOutDir, 0.15);
            } else if (w < 0.80) {
              // High-torque pneumatic unbolting with nut spinning counter-clockwise
              if (tech.toolMesh) {
                tech.toolMesh.position.copy(gunTipPos);
                tech.toolMesh.quaternion.copy(hubQuat);
                if (isLeft) tech.toolMesh.rotateY(Math.PI);
                this.updateGunBalancerCable(tech, tech.toolMesh.position);
              }
              carModel.setCenterlockNutSpin(i, -t * 150);

              gripR.copy(gunTipPos);
              gripR.y -= 0.06;
              gripR.z += (isLeft ? 0.08 : -0.08);
              gripL.copy(gunTipPos).addScaledVector(axleOutDir, 0.10);
            } else {
              // Nut is loose! Gun docks to hip/balancer, hands prepare to grip wheel
              const dockT = quinticSmooth((w - 0.80) / 0.20);
              if (tech.toolMesh) {
                tech.toolMesh.position.lerpVectors(gunTipPos, hipHangPos, dockT);
                tech.toolMesh.quaternion.slerpQuaternions(hubQuat, tech.group.quaternion, dockT);
                this.updateGunBalancerCable(tech, tech.toolMesh.position);
              }
              gripR.copy(spindlePos);
              gripR.x += (isLeft ? 0.20 : -0.20);
              gripL.copy(spindlePos);
              gripL.x += (isLeft ? -0.20 : 0.20);
            }

            if (tech.leftArmIK && tech.rightArmIK) {
              this.solveTwoBoneIK(tech.rightArmIK, gripR, techTorsoQuat);
              this.solveTwoBoneIK(tech.leftArmIK, gripL, techTorsoQuat);
            }
          }
          // 5. SUB-PHASE B.5 (0.70 to 0.82): SLIDE OUT WORN TIRE & LOWER TO FLOOR (PARABOLIC ARC)
          else if (serviceT < 0.82) {
            const w = quinticSmooth((serviceT - 0.70) / 0.12);
            tech.group.position.copy(tech.servicePos);
            tech.group.rotation.y = isLeft ? Math.PI : 0;

            const pelvisDrop = 0.24 + 0.06 * w;
            if (tech.pelvisGroup) tech.pelvisGroup.position.y = 0.72 - pelvisDrop;
            if (tech.leftLeg && tech.rightLeg) {
              this.solveLegIK(tech.leftLeg, pelvisDrop, 0.16);
              this.solveLegIK(tech.rightLeg, pelvisDrop, 0.16);
            }

            const freshRestPos = PitStopManager._sFreshRestPos.set(floorPos.x + (isFront ? 0.35 : -0.35), 0.16, floorPos.z);
            spare.visible = true;
            spare.position.copy(freshRestPos);
            spare.quaternion.copy(floorQuat);

            carModel.setWheelVisible(i, false);
            dismounted.visible = true;

            if (tech.toolMesh) {
              const hipHangPos = PitStopManager._sHipHangPos.copy(tech.group.position);
              hipHangPos.x += (isLeft ? -0.22 : 0.22);
              hipHangPos.y += 0.62;
              tech.toolMesh.position.copy(hipHangPos);
              tech.toolMesh.rotation.set(0.2, 0, 0);
              this.updateGunBalancerCable(tech, tech.toolMesh.position);
            }

            const slidePos = p0.copy(spindlePos).addScaledVector(axleOutDir, 0.45);

            if (w < 0.40) {
              // Slide straight out along axleOutDir
              const slideT = quinticSmooth(w / 0.40);
              dismounted.position.copy(spindlePos).addScaledVector(axleOutDir, slideT * 0.45);
              dismounted.quaternion.copy(hubQuat);

              if (dismountedShadow) {
                dismountedShadow.visible = true;
                dismountedShadow.position.set(dismounted.position.x, 0.009, dismounted.position.z);
                (dismountedShadow.material as THREE.MeshBasicMaterial).opacity = 0.55;
              }
            } else {
              // Smooth parabolic descent to floorPos
              const arcT = quinticSmooth((w - 0.40) / 0.60);
              p1.copy(slidePos);
              p1.y += 0.06;
              PitStopManager._sTempV1.copy(floorPos).sub(slidePos);
              p1.addScaledVector(PitStopManager._sTempV1, 0.35);

              p2.copy(floorPos);
              p2.y += 0.16;
              p3.copy(floorPos);

              cubicBezier3D(p0, p1, p2, p3, arcT, wheelInterpolatedPos);
              dismounted.position.copy(wheelInterpolatedPos);
              dismounted.quaternion.slerpQuaternions(hubQuat, floorQuat, arcT);

              if (dismountedShadow) {
                dismountedShadow.visible = true;
                dismountedShadow.position.set(dismounted.position.x, 0.009, dismounted.position.z);
                const h = Math.max(0, dismounted.position.y - 0.16);
                (dismountedShadow.material as THREE.MeshBasicMaterial).opacity = Math.max(0.2, 0.75 - h * 1.5);
              }
            }

            gripR.copy(dismounted.position);
            gripR.x += (isLeft ? 0.20 : -0.20);
            gripL.copy(dismounted.position);
            gripL.x += (isLeft ? -0.20 : 0.20);
            if (tech.leftArmIK && tech.rightArmIK) {
              this.solveTwoBoneIK(tech.rightArmIK, gripR, techTorsoQuat);
              this.solveTwoBoneIK(tech.leftArmIK, gripL, techTorsoQuat);
            }
          }
          // 6. SUB-PHASE B.6 (0.82 to 0.92): LIFT FRESH TIRE & SLIDE ONTO SPINDLE
          else if (serviceT < 0.92) {
            const w = quinticSmooth((serviceT - 0.82) / 0.10);
            tech.group.position.copy(tech.servicePos);
            tech.group.rotation.y = isLeft ? Math.PI : 0;

            const pelvisDrop = 0.25;
            if (tech.pelvisGroup) tech.pelvisGroup.position.y = 0.72 - pelvisDrop;
            if (tech.leftLeg && tech.rightLeg) {
              this.solveLegIK(tech.leftLeg, pelvisDrop, 0.14);
              this.solveLegIK(tech.rightLeg, pelvisDrop, 0.14);
            }

            dismounted.visible = true;
            dismounted.position.copy(floorPos);
            dismounted.quaternion.copy(floorQuat);
            if (dismountedShadow) {
              dismountedShadow.visible = true;
              dismountedShadow.position.set(floorPos.x, 0.009, floorPos.z);
              (dismountedShadow.material as THREE.MeshBasicMaterial).opacity = 0.75;
            }

            const alignPos = PitStopManager._sAlignPos.copy(spindlePos).addScaledVector(axleOutDir, 0.45);
            const freshRestPos = PitStopManager._sFreshRestPos.set(floorPos.x + (isFront ? 0.35 : -0.35), 0.16, floorPos.z);

            if (tech.toolMesh) {
              const hipHangPos = PitStopManager._sHipHangPos.copy(tech.group.position);
              hipHangPos.x += (isLeft ? -0.22 : 0.22);
              hipHangPos.y += 0.62;
              tech.toolMesh.position.copy(hipHangPos);
              tech.toolMesh.rotation.set(0.2, 0, 0);
              this.updateGunBalancerCable(tech, tech.toolMesh.position);
            }

            if (w < 0.65) {
              // Lift from floor to axle alignment height
              const u = quinticSmooth(w / 0.65);
              spare.visible = true;
              carModel.setWheelVisible(i, false);
              spare.position.lerpVectors(freshRestPos, alignPos, u);
              spare.position.y += Math.sin(u * Math.PI) * 0.22;
              spare.quaternion.slerpQuaternions(floorQuat, hubQuat, u);
              if (spareShadow) {
                spareShadow.visible = true;
                spareShadow.position.set(spare.position.x, 0.009, spare.position.z);
                (spareShadow.material as THREE.MeshBasicMaterial).opacity = Math.max(0.15, 0.75 - Math.sin(u * Math.PI) * 0.5);
              }
            } else {
              // Slide straight onto spindle
              const u = quinticSmooth((w - 0.65) / 0.35);
              spare.position.lerpVectors(alignPos, spindlePos, u);
              spare.quaternion.copy(hubQuat);
              if (spareShadow) {
                spareShadow.position.set(spare.position.x, 0.009, spare.position.z);
                (spareShadow.material as THREE.MeshBasicMaterial).opacity = 0.65;
              }
              if (w >= 0.95) {
                if (!this.hasAppliedNewTireVisualsToCar) {
                  carModel.setTireCompoundVisuals(targetComp);
                  this.hasAppliedNewTireVisualsToCar = true;
                }
                spare.visible = false;
                if (spareShadow) spareShadow.visible = false;
                carModel.setWheelVisible(i, true);
                carModel.setWheelOffset(i, 0);
              } else {
                spare.visible = true;
                carModel.setWheelVisible(i, false);
              }
            }

            gripL.copy(spare.visible ? spare.position : spindlePos);
            gripL.x += (isLeft ? -0.19 : 0.19);
            gripR.copy(spare.visible ? spare.position : spindlePos);
            gripR.x += (isLeft ? 0.19 : -0.19);
            if (tech.leftArmIK && tech.rightArmIK) {
              this.solveTwoBoneIK(tech.rightArmIK, gripR, techTorsoQuat);
              this.solveTwoBoneIK(tech.leftArmIK, gripL, techTorsoQuat);
            }
          }
          // 7. SUB-PHASE B.7 (0.92 to 1.00): FAST TORQUING, RAISE SIGNAL OK & STEP BACK
          else {
            const w = quinticSmooth((serviceT - 0.92) / 0.08);
            if (!this.hasAppliedNewTireVisualsToCar) {
              carModel.setTireCompoundVisuals(targetComp);
              this.hasAppliedNewTireVisualsToCar = true;
            }
            carModel.setWheelVisible(i, true);
            carModel.setWheelOffset(i, 0);
            spare.visible = false;
            if (spareShadow) spareShadow.visible = false;
            dismounted.visible = true;
            dismounted.position.copy(floorPos);
            dismounted.quaternion.copy(floorQuat);

            const recoil = Math.sin(t * 75) * 0.010;
            const gunTipPos = PitStopManager._sGunTipPos.copy(spindlePos).addScaledVector(axleOutDir, 0.04 + recoil);
            const hipHangPos = PitStopManager._sHipHangPos.copy(tech.group.position);
            hipHangPos.x += (isLeft ? -0.22 : 0.22);
            hipHangPos.y += 0.62;

            if (w < 0.55) {
              // High-torque tightening with Paoli wheel gun
              if (tech.toolMesh) {
                tech.toolMesh.position.copy(gunTipPos);
                tech.toolMesh.quaternion.copy(hubQuat);
                if (isLeft) tech.toolMesh.rotateY(Math.PI);
                this.updateGunBalancerCable(tech, tech.toolMesh.position);
              }
              carModel.setCenterlockNutSpin(i, t * 160);

              gripR.copy(gunTipPos);
              gripR.y -= 0.06;
              gripR.z += (isLeft ? 0.08 : -0.08);
              gripL.copy(spindlePos).addScaledVector(axleOutDir, 0.12);
              if (tech.leftArmIK && tech.rightArmIK) {
                this.solveTwoBoneIK(tech.rightArmIK, gripR, techTorsoQuat);
                this.solveTwoBoneIK(tech.leftArmIK, gripL, techTorsoQuat);
              }
            } else {
              // Nut torqued! Gun docks to holster, mechanic raises arm in OK signal and steps back
              const u = quinticSmooth((w - 0.55) / 0.45);
              if (tech.toolMesh) {
                tech.toolMesh.position.lerpVectors(gunTipPos, hipHangPos, u);
                this.updateGunBalancerCable(tech, tech.toolMesh.position);
              }
              tech.group.position.lerpVectors(tech.servicePos, tech.exitPos, u);
              const pelvisDrop = THREE.MathUtils.lerp(0.24, 0.0, u);
              if (tech.pelvisGroup) tech.pelvisGroup.position.y = 0.72 - pelvisDrop;
              if (tech.leftLeg && tech.rightLeg) {
                this.solveLegIK(tech.leftLeg, pelvisDrop, THREE.MathUtils.lerp(0.15, 0.0, u));
                this.solveLegIK(tech.rightLeg, pelvisDrop, THREE.MathUtils.lerp(0.15, 0.0, u));
              }
              if (tech.torsoGroup) tech.torsoGroup.rotation.set(0, 0, 0);
              if (tech.headGroup) tech.headGroup.rotation.set(0, 0, 0);

              // Raised fist "READY / OK" gesture
              if (tech.leftArmIK) {
                tech.leftArmIK.shoulder.rotation.set(-1.4 * u, 0, (isLeft ? 0.35 : -0.35) * u);
                tech.leftArmIK.elbow.rotation.set(-0.5 * u, 0, 0);
              }
              if (tech.rightArmIK) {
                tech.rightArmIK.shoulder.rotation.set(0.3 * u, 0, 0);
                tech.rightArmIK.elbow.rotation.set(0.4 * u, 0, 0);
              }
            }
          }
        }
      }

      // --- HIGH-SPEED PNEUMATIC IMPACT WRENCH SOUNDS, AIR BLASTS, TORQUE SPARKS & CRYOGENIC NITROGEN ---
      const isBolting = this.isPreparedPitStop
        ? ((serviceT < 0.24) || (serviceT > 0.74 && serviceT < 0.94))
        : ((serviceT > 0.58 && serviceT < 0.70) || (serviceT > 0.92 && serviceT < 0.98));

      if (isBolting && t - this.lastGunSoundTime > 0.28) {
        audio.triggerWheelGunRattle();
        this.lastGunSoundTime = t;
      }

      if (isBolting && t - this.lastAirBurstTime > 0.32) {
        const randomWheelIdx = Math.floor(Math.random() * 4);
        carModel.getSpindleWorldTransform(randomWheelIdx, spindlePos, axleOutDir, hubQuat);
        particles.emitPneumaticBlast(spindlePos, axleOutDir, 3);
        particles.emitCryogenicNitrogenPlume(spindlePos, axleOutDir, 3);
        this.lastAirBurstTime = t;
      }

      const isSparks = this.isPreparedPitStop
        ? (serviceT > 0.74 && serviceT < 0.94)
        : (serviceT > 0.92 && serviceT < 0.98);

      if (isSparks && t - this.lastSparkTime > 0.16) {
        const randomWheelIdx = Math.floor(Math.random() * 4);
        carModel.getSpindleWorldTransform(randomWheelIdx, spindlePos, axleOutDir, hubQuat);
        particles.emitNutTorqueSparks(spindlePos, 8);
        this.lastSparkTime = t;
      }

      // Real-time progressive vehicle restoration & front wing repair
      const lerpSpeed = Math.min(1.0, serviceT * 0.45 + 0.10);
      physics.damage.overallHealth = Math.min(100, physics.damage.overallHealth + (100 - physics.damage.overallHealth) * lerpSpeed);
      physics.damage.engineHealth = Math.min(100, physics.damage.engineHealth + (100 - physics.damage.engineHealth) * lerpSpeed);
      physics.damage.suspensionLeft = Math.min(100, physics.damage.suspensionLeft + (100 - physics.damage.suspensionLeft) * lerpSpeed);
      physics.damage.suspensionRight = Math.min(100, physics.damage.suspensionRight + (100 - physics.damage.suspensionRight) * lerpSpeed);
      physics.damage.frontCrumple = Math.max(0, physics.damage.frontCrumple - dt * 1.5);
      physics.damage.rearCrumple = Math.max(0, physics.damage.rearCrumple - dt * 1.5);
      physics.damage.frontWingLeftDamage = Math.max(0, (physics.damage.frontWingLeftDamage || 0) - dt * 1.5);
      physics.damage.frontWingRightDamage = Math.max(0, (physics.damage.frontWingRightDamage || 0) - dt * 1.5);
      physics.damage.wingDamageAmount = Math.max(0, (physics.damage.wingDamageAmount || 0) - dt * 1.5);
      physics.damage.wingLoose = false;
      physics.damage.isTotaled = false;

      // Front wing replacement & structural assembly mounted clean and tight during pit stop animation
      if (serviceT >= 0.35) {
        physics.damage.frontWingLeftDetached = false;
        physics.damage.frontWingRightDetached = false;
        physics.damage.frontWingLeftUpperFlapDetached = false;
        physics.damage.frontWingRightUpperFlapDetached = false;
        physics.damage.endplateLeftDetached = false;
        physics.damage.endplateRightDetached = false;
        physics.damage.rearWingLeftDetached = false;
        physics.damage.rearWingRightDetached = false;
        physics.damage.drsFlapBroken = false;
        physics.damage.frontWingLeftDamage = 0;
        physics.damage.frontWingRightDamage = 0;
        physics.damage.wingDamageAmount = 0;
        physics.damage.frontCrumple = 0;
        physics.damage.wingLoose = false;
        carModel.repairWingVisuals();
      }
    }
    // =========================================================================
    // STAGE 4: JACKS DROP & SUSPENSION SLAM PHYSICS (total - 0.6s to total)
    // =========================================================================
    else if (t < total) {
      this.phase = 'jacks_down';

      // Full vehicle & tire restoration active as soon as jacks drop so wheels and geometry are pristine
      physics.setTireCompound(this.nextTireCompound);
      physics.repairFull();
      carModel.setTireCompoundVisuals(physics.tireCompound);
      carModel.setAllWheelsVisible(true);
      carModel.resetWheelOffsets();
      carModel.setBrakeDiscThermalGlow(0.0);

      physics.position.x = this.pitBoxX;
      physics.position.z = -110.5;
      physics.prevPosition.x = this.pitBoxX;
      physics.prevPosition.y = physics.position.y;
      physics.prevPosition.z = -110.5;
      physics.yaw = getNearestAngle(physics.yaw, Math.PI / 2);
      physics.prevYaw = physics.yaw;

      const dropTimeProgress = Math.max(0, Math.min(1.0, (t - (total - 0.6)) / 0.6));

      // Realistic gravitational drop & suspension compression settle
      if (dropTimeProgress < 0.28) {
        // Fast gravitational drop (0.20m -> 0.0m)
        const fallRatio = dropTimeProgress / 0.28;
        this.carElevatedY = (1.0 - Math.pow(fallRatio, 2)) * 0.20;

        if (!this.hasTriggeredJackDownSound && fallRatio > 0.85) {
          audio.triggerPneumaticJack(false);
          this.hasTriggeredJackDownSound = true;
          particles.emitPneumaticBlast(PitStopManager._sTempV1.set(this.pitBoxX, 0.1, -110.5), PitStopManager._sTempV2.set(0, 0.8, 0), 10);
        }
      } else {
        // Touchdown: Fluid critically-damped suspension settle smoothly dissipating to 0.0 before launch
        const bounceT = (dropTimeProgress - 0.28) / 0.72;
        this.carElevatedY = Math.sin(bounceT * Math.PI) * Math.exp(-bounceT * 4.2) * -0.016;
      }

      if (!this.hasTriggeredRadioExit) {
        this.radioMessage = '¡LUZ VERDE! 3, 2, 1... ¡GO GO GO!';
        audio.triggerPitRadio('go');
        this.hasTriggeredRadioExit = true;
      }

      // FRONT JACK OPERATOR: Yanks trolley jack clear to the side
      const fj = this.crewByRole.get('front_jack');
      if (fj) {
        fj.group.position.lerpVectors(fj.servicePos, fj.exitPos, dropTimeProgress);
        if (fj.toolMesh) {
          fj.toolMesh.rotation.z = THREE.MathUtils.lerp(fj.toolMesh.rotation.z, 0, 0.25);
        }
      }

      // REAR JACK OPERATOR: Steps aside
      const rj = this.crewByRole.get('rear_jack');
      if (rj) {
        rj.group.position.lerpVectors(rj.servicePos, rj.exitPos, dropTimeProgress);
        if (rj.toolMesh) {
          rj.toolMesh.rotation.z = THREE.MathUtils.lerp(rj.toolMesh.rotation.z, 0, 0.25);
        }
      }

      // Crew mechanics stand upright and step toward the pit wall
      this.crewMembers.forEach((m) => {
        if (!m.type.includes('jack') && m.type !== 'lollipop') {
          m.group.position.lerpVectors(m.group.position, m.exitPos, 0.18);
          m.group.position.y = THREE.MathUtils.lerp(m.group.position.y, 0, 0.25);
          if (m.rightArmIK) {
            m.rightArmIK.shoulder.rotation.set(0.3, 0, 0);
            m.rightArmIK.elbow.rotation.set(0.5, 0, 0);
          }
          if (m.leftArmIK) {
            m.leftArmIK.shoulder.rotation.set(0.3, 0, 0);
            m.leftArmIK.elbow.rotation.set(0.5, 0, 0);
          }
        }
      });

      // LOLLIPOP: Rotates to bright green "GO!" and swings UP into the air
      if (this.lollipopDiscMat) {
        this.lollipopDiscMat.color.setHex(0x10b981);
        this.lollipopDiscMat.emissive.setHex(0x34d399);
      }
      if (this.lollipopSignGroup) {
        this.lollipopSignGroup.rotation.y = THREE.MathUtils.lerp(this.lollipopSignGroup.rotation.y, Math.PI / 2, 0.25);
        this.lollipopSignGroup.rotation.x = THREE.MathUtils.lerp(this.lollipopSignGroup.rotation.x, -0.65, 0.25);
      }
    }
    // =========================================================================
    // STAGE 5: PIT SERVICE COMPLETE - IMMEDIATE HANDOVER TO DRIVER ON GREEN LIGHT!
    // =========================================================================
    else {
      // Jacks down complete, wheels changed, green light lit!
      // Immediately terminate pit animation, unlock controls at 0 km/h and display "¡LUZ VERDE, SAL!" for 0.6s
      this.phase = 'none';
      this.isBoxNotified = false;
      this.hasCrossedPitEntryLine = false;
      this.carElevatedY = 0;
      carModel.setAllWheelsVisible(true);
      carModel.resetWheelOffsets();

      physics.setTireCompound(this.nextTireCompound);
      physics.repairFull();
      carModel.setTireCompoundVisuals(physics.tireCompound);
      carModel.repairWingVisuals();

      if (!this.hasTriggeredChime) {
        audio.triggerPitChime();
        this.hasTriggeredChime = true;
      }

      physics.isLockedInPit = false;
      physics.speed = 0; // Stationary at 0 km/h for player manual acceleration launch
      physics.gear = 1;
      physics.rpm = 1200;
      physics.visualSteerAngle = 0;
      physics.steerAngle = 0;
      physics.pitch = 0;
      physics.roll = 0;
      if (inputs) {
        inputs.brake = 0;
        inputs.handbrake = false;
      }

      // Crew mechanics step into clear exit positions
      this.crewMembers.forEach((m) => {
        m.group.position.copy(m.exitPos);
        m.group.position.y = 0;
      });

      // Keep lollipop green and raised
      if (this.lollipopDiscMat) {
        this.lollipopDiscMat.color.setHex(0x10b981);
        this.lollipopDiscMat.emissive.setHex(0x34d399);
      }
      if (this.lollipopSignGroup) {
        this.lollipopSignGroup.rotation.y = Math.PI / 2;
        this.lollipopSignGroup.rotation.x = -0.65;
      }

      this.cooldownTimer = 8.0;
      this.greenLightAlertTimer = 0.6; // 0.6s green light HUD notification
      this.radioMessage = 'Luz verde, ¡ Sal !';
      if (audio) {
        audio.triggerPitRadio('go');
      }

      this.resetWheelProps();
      const fj = this.crewByRole.get('front_jack');
      if (fj) fj.group.position.copy(fj.exitPos);
      const rj = this.crewByRole.get('rear_jack');
      if (rj) rj.group.position.copy(rj.exitPos);
    }

    this.displayBoardTimer += dt;
    if (this.displayBoardTimer >= 0.4) {
      this.displayBoardTimer = 0;
      this.updateDisplayBoard();
    }
  }

  /**
   * Update the Pit Wall LED telemetry texture - eliminated per user request
   */
  private updateDisplayBoard(): void {
    // Digital Pit Wall Billboard and "CAR RELEASED" sign eliminated
  }

  /**
   * Deep cleanup of cloned/custom crew 3D geometries, materials and textures
   */
  private disposeCustomCrewBody(obj: THREE.Object3D): void {
    const disposedGeos = new Set<THREE.BufferGeometry>();
    const disposedMats = new Set<THREE.Material>();
    const disposedTextures = new Set<THREE.Texture>();

    obj.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (child.geometry && !disposedGeos.has(child.geometry)) {
          disposedGeos.add(child.geometry);
          child.geometry.dispose();
        }
        if (child.material) {
          const mats = (Array.isArray(child.material) ? child.material : [child.material]) as THREE.Material[];
          mats.forEach((m: THREE.Material) => {
            if (disposedMats.has(m)) return;
            disposedMats.add(m);
            const anyMat = m as any;
            const texProps = [
              'map', 'lightMap', 'aoMap', 'emissiveMap', 'bumpMap',
              'normalMap', 'displacementMap', 'roughnessMap', 'metalnessMap',
              'alphaMap', 'envMap'
            ];
            for (let i = 0; i < texProps.length; i++) {
              const tex = anyMat[texProps[i]];
              if (tex && typeof tex.dispose === 'function' && !disposedTextures.has(tex)) {
                disposedTextures.add(tex);
                tex.dispose();
              }
            }
            m.dispose();
          });
        }
      }
    });
  }

  /**
   * Load custom 3D model for pit crew mechanics (.glb, .gltf, .zip, .obj)
   */
  public async loadCustomCrewModel(file: File): Promise<{ success: boolean; name: string; error?: string }> {
    const gen = ++this.crewLoadGeneration;
    try {
      const importedData = await CrewModelImporter.loadFromFile(file);
      if (gen !== this.crewLoadGeneration) {
        // Obsolete or superseded async load; clean up imported group and abort
        this.disposeCustomCrewBody(importedData.rootGroup);
        return { success: false, name: file.name, error: 'Carga cancelada.' };
      }

      // Clean up existing crew member instances first
      this.crewMembers.forEach((m) => {
        m.proceduralBody.visible = false;
        if (m.customBody) {
          m.group.remove(m.customBody);
          m.customBody.visible = false;
          m.customBody = undefined;
        }
      });

      // Clean up previous custom prototype
      if (this.customCrewProto) {
        this.disposeCustomCrewBody(this.customCrewProto);
        this.customCrewProto = null;
      }

      this.isCustomCrew = true;
      this.currentCrewName = importedData.name;
      this.customCrewProto = importedData.rootGroup;

      // Hide consolidated static procedural crew during custom crew usage
      if (this.staticStandbyCrewGroup) {
        this.staticStandbyCrewGroup.visible = false;
      }

      this.crewMembers.forEach((m) => {
        const clone = importedData.rootGroup.clone(true);
        m.customBody = clone;
        m.group.add(clone);
        clone.visible = true;
      });

      return { success: true, name: importedData.name };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, name: '', error: msg };
    }
  }

  /**
   * Restore default high-detail procedural pit crew mechanics
   */
  public restoreDefaultCrew(): void {
    this.crewLoadGeneration++;
    this.isCustomCrew = false;
    this.currentCrewName = 'Pit Crew Apex Scuderia';

    this.crewMembers.forEach((m) => {
      if (m.customBody) {
        m.customBody.visible = false;
        m.group.remove(m.customBody);
        m.customBody = undefined;
      }
      m.proceduralBody.visible = (this.phase !== 'none');
    });

    if (this.customCrewProto) {
      this.disposeCustomCrewBody(this.customCrewProto);
      this.customCrewProto = null;
    }

    if (this.staticStandbyCrewGroup) {
      this.staticStandbyCrewGroup.visible = (this.phase === 'none');
    }
  }

  /**
   * Build 3D Pit Crew Mechanics and Equipment for Garage 02 (Rival/Player 2 at X = 22.0)
   * Guaranteed: EXACTLY TWO garages with mechanics in the entire pit lane (Garage 01 at -22.0, Garage 02 at +22.0)
   * Separated by 44 meters with the central VIP Paddock Club Lounge in between.
   * 
   * Fully static matrix-frozen architecture (0 CPU bone calculations & 0 texture uploads during races)
   */
  private buildRivalPitCrewsAndGarages(): void {
    const rivalTeams = [
      {
        id: 'rival_p2',
        name: 'GARAGE 02 · PILOTO 2',
        x: this.rivalPitBoxX, // 22.0
        suitColor: 0xdc2626,
        accentColor: 0xfacc15,
        helmetColor: 0xf8fafc,
        jackColor: 0xdc2626,
      },
    ];

    const carbonBlackMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.5,
    });
    const visorMat = new THREE.MeshPhysicalMaterial({
      color: 0x050505,
      metalness: 0.95,
      roughness: 0.05,
      clearcoat: 1.0,
    });
    const toolMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      metalness: 0.85,
      roughness: 0.2,
    });
    const alloyRimMat = new THREE.MeshStandardMaterial({
      color: 0x27272a,
      metalness: 0.9,
      roughness: 0.2,
    });
    const freshTireMat = new THREE.MeshStandardMaterial({
      color: 0x141416,
      roughness: 0.35,
    });

    const pzeroColors = [0xef4444, 0xfacc15, 0xffffff]; // Soft, Medium, Hard

    rivalTeams.forEach((team) => {
      const teamGroup = new THREE.Group();
      const bx = team.x;

      const suitMat = new THREE.MeshStandardMaterial({
        color: team.suitColor,
        roughness: 0.6,
        metalness: 0.1,
      });
      const helmetMat = new THREE.MeshStandardMaterial({
        color: team.helmetColor,
        metalness: 0.4,
        roughness: 0.2,
      });
      const jackMat = new THREE.MeshStandardMaterial({
        color: team.jackColor,
        metalness: 0.75,
        roughness: 0.25,
      });

      // Helper to build a photorealistic human mechanic in team suit & gear
      const buildStaticMechanic = (
        x: number,
        z: number,
        rotY: number,
        hasGun: boolean = false,
        isCrouched: boolean = false,
        role: CrewRoleType = 'tyre_tech_fl'
      ) => {
        const mech = new THREE.Group();
        mech.position.set(x, 0, z);
        mech.rotation.y = rotY;

        const teamConfig = OFFICIAL_TEAM_CONFIGS[team.id] || OFFICIAL_TEAM_CONFIGS.apex;
        const built = HumanCrewMeshBuilder.buildPhotorealisticMechanic(
          role,
          teamConfig,
          false
        );

        HumanCrewMeshBuilder.poseStaticMechanic(built, role, isCrouched, hasGun);

        mech.add(built.proceduralBody);
        this.rivalCrewGroup.add(mech);

        const actor: RivalMechanicActor = {
          id: `rival_${team.id}_${role}`,
          role,
          group: mech,
          built,
          isCrouched,
          hasGun,
          restPos: new THREE.Vector3(x, 0, z),
          restRotY: rotY,
          position: new THREE.Vector3(x, 0, z),
          velocity: new THREE.Vector3(0, 0, 0),
          rotation: new THREE.Euler(0, rotY, 0),
          angularVelocity: new THREE.Vector3(0, 0, 0),
          isAirborne: false,
          airborneTimer: 0,
          radius: 0.65,
          height: 1.8,
          flailPhase: 0,
          flailSpeed: 0,
        };
        this.rivalMechanics.push(actor);
        return mech;
      };

      // 1. Front and Rear Quick-Lift Jack Operators
      buildStaticMechanic(bx + 2.8, -110.5, Math.PI, false, false, 'front_jack'); // Front Jack
      buildStaticMechanic(bx - 2.8, -110.5, 0, false, false, 'rear_jack');       // Rear Jack

      // Front & Rear Quick-Lift Trolley Jacks
      const fJackGeo = new THREE.BoxGeometry(1.6, 0.16, 0.55);
      const fJack = new THREE.Mesh(fJackGeo, jackMat);
      fJack.position.set(bx + 2.1, 0.09, -110.5);
      teamGroup.add(fJack);

      const rJackGeo = new THREE.BoxGeometry(1.6, 0.16, 0.55);
      const rJack = new THREE.Mesh(rJackGeo, jackMat);
      rJack.position.set(bx - 2.1, 0.09, -110.5);
      teamGroup.add(rJack);

      // 2. 4 Dedicated Master Tyre Technicians (FL, FR, RL, RR)
      buildStaticMechanic(bx + 1.25, -108.60, Math.PI, true, true, 'tyre_tech_fl');  // Tyre Tech FL (garage side)
      buildStaticMechanic(bx + 1.25, -112.40, 0, true, true, 'tyre_tech_fr');        // Tyre Tech FR (pit side)
      buildStaticMechanic(bx - 1.25, -108.60, Math.PI, true, true, 'tyre_tech_rl');  // Tyre Tech RL (garage side)
      buildStaticMechanic(bx - 1.25, -112.40, 0, true, true, 'tyre_tech_rr');        // Tyre Tech RR (pit side)

      // 3. Chief Pit Controller with Overhead Lollipop Boom Sign
      buildStaticMechanic(bx + 2.65, -107.6, Math.PI * 0.88, false, false, 'lollipop');

      const boomGeo = new THREE.CylinderGeometry(0.035, 0.045, 3.4, 8);
      boomGeo.rotateZ(Math.PI / 3);
      const boom = new THREE.Mesh(boomGeo, carbonBlackMat);
      boom.position.set(bx + 1.5, 2.4, -107.6);
      teamGroup.add(boom);

      const signGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.05, 16);
      signGeo.rotateX(Math.PI / 2);
      const signMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xdc2626, emissiveIntensity: 0.8 });
      const sign = new THREE.Mesh(signGeo, signMat);
      sign.position.set(bx + 0.1, 3.8, -107.6);
      teamGroup.add(sign);

      // 4. Thermal Tire Warmer Racks with Fresh Pirelli Slicks
      const rackLocations = [
        { x: bx + 0.55, z: -108.30 },
        { x: bx + 0.55, z: -112.70 },
        { x: bx - 0.55, z: -108.30 },
        { x: bx - 0.55, z: -112.70 },
      ];

      rackLocations.forEach((loc, rIdx) => {
        const tireGroup = new THREE.Group();
        tireGroup.position.set(loc.x, 0.35, loc.z);

        const tireGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.32, 16);
        tireGeo.rotateZ(Math.PI / 2);
        const tireMesh = new THREE.Mesh(tireGeo, freshTireMat);
        tireGroup.add(tireMesh);

        const rimGeo = new THREE.CylinderGeometry(0.23, 0.23, 0.33, 14);
        rimGeo.rotateZ(Math.PI / 2);
        const rimMesh = new THREE.Mesh(rimGeo, alloyRimMat);
        tireGroup.add(rimMesh);

        const stripeCol = pzeroColors[rIdx % pzeroColors.length];
        const stripeMat = new THREE.MeshBasicMaterial({ color: stripeCol });
        const stripeRingGeo = new THREE.RingGeometry(0.24, 0.32, 16);
        stripeRingGeo.rotateY(Math.PI / 2);
        const stripeRing = new THREE.Mesh(stripeRingGeo, stripeMat);
        stripeRing.position.set(0.165, 0, 0);
        tireGroup.add(stripeRing);

        teamGroup.add(tireGroup);
      });

      // Consolidate static geometries into batched meshes for 60 FPS performance
      const batchedTeamGroup = this.consolidateStaticGroup(teamGroup);
      this.group.add(batchedTeamGroup);
    });
  }

  /**
   * Imparts realistic ballistic trajectory and tumble momentum to hit rival mechanics
   */
  public impartImpulseToMechanic(
    mech: RivalMechanicActor,
    carVelocity: THREE.Vector3,
    contactNormal: THREE.Vector3
  ): void {
    mech.isAirborne = true;
    mech.airborneTimer = 0;

    const impactSpeed = carVelocity.length();
    const carDirX = impactSpeed > 0.1 ? carVelocity.x / impactSpeed : contactNormal.x;
    const carDirZ = impactSpeed > 0.1 ? carVelocity.z / impactSpeed : contactNormal.z;

    const forwardImpulse = Math.max(14, impactSpeed * 0.95);
    const deflectImpulse = Math.max(5, impactSpeed * 0.38);

    mech.velocity.x = carDirX * forwardImpulse + contactNormal.x * deflectImpulse;
    mech.velocity.z = carDirZ * forwardImpulse + contactNormal.z * deflectImpulse;
    mech.velocity.y = Math.min(18, 5.5 + impactSpeed * 0.28);

    const tumblePower = Math.min(16, 5.0 + impactSpeed * 0.25);
    mech.angularVelocity.x = (Math.random() - 0.5) * tumblePower * 2.0;
    mech.angularVelocity.y = (Math.random() - 0.5) * tumblePower * 1.5;
    mech.angularVelocity.z = (Math.random() - 0.5) * tumblePower * 2.0;

    mech.flailPhase = Math.random() * Math.PI * 2;
    mech.flailSpeed = 16.0 + Math.random() * 8.0;
  }

  /**
   * Dynamic update for airborne rival mechanics:
   * - Realistic ballistic physics (gravity 22m/s², aerodynamic drag, ground bounces)
   * - Biomechanical limb flailing (chaotic, realistic arms/legs oscillations)
   * - Exactly 4.0s respawn back to pristine pit stance
   */
  public updateRivalMechanics(dt: number, particles?: ParticleSystem): void {
    if (!this.rivalMechanics || this.rivalMechanics.length === 0) return;

    const gravity = 22.0;
    const airDrag = 0.985;
    const groundFriction = 0.78;

    for (let i = 0; i < this.rivalMechanics.length; i++) {
      const mech = this.rivalMechanics[i];
      if (!mech.isAirborne) continue;

      mech.airborneTimer += dt;

      // Integrate velocity & gravity
      mech.velocity.y -= gravity * dt;
      mech.velocity.x *= airDrag;
      mech.velocity.z *= airDrag;

      mech.position.x += mech.velocity.x * dt;
      mech.position.y += mech.velocity.y * dt;
      mech.position.z += mech.velocity.z * dt;

      // Ground impact / bounce
      if (mech.position.y <= 0) {
        mech.position.y = 0;
        if (mech.velocity.y < -1.5) {
          mech.velocity.y = -mech.velocity.y * 0.35; // Ground bounce
          mech.velocity.x *= groundFriction;
          mech.velocity.z *= groundFriction;
          mech.angularVelocity.x *= 0.65;
          mech.angularVelocity.y *= 0.65;
          mech.angularVelocity.z *= 0.65;
        } else {
          mech.velocity.y = 0;
          mech.velocity.x *= 0.80;
          mech.velocity.z *= 0.80;
          mech.angularVelocity.x *= 0.75;
          mech.angularVelocity.y *= 0.75;
          mech.angularVelocity.z *= 0.75;
        }
      }

      // Integrate angular velocity
      mech.rotation.x += mech.angularVelocity.x * dt;
      mech.rotation.y += mech.angularVelocity.y * dt;
      mech.rotation.z += mech.angularVelocity.z * dt;

      // Update mesh transforms
      mech.group.position.copy(mech.position);
      mech.group.rotation.copy(mech.rotation);

      // Frantic ragdoll limb flailing animation
      mech.flailPhase += mech.flailSpeed * dt;
      const p = mech.flailPhase;

      if (mech.built.leftArmIK) {
        mech.built.leftArmIK.shoulder.rotation.x = Math.sin(p * 1.3) * 1.4;
        mech.built.leftArmIK.shoulder.rotation.z = Math.cos(p * 1.1) * 0.7 + 0.6;
        mech.built.leftArmIK.elbow.rotation.x = Math.max(0.1, (Math.sin(p * 1.7) + 1.0) * 0.75);
      }
      if (mech.built.rightArmIK) {
        mech.built.rightArmIK.shoulder.rotation.x = Math.cos(p * 1.2) * 1.4;
        mech.built.rightArmIK.shoulder.rotation.z = -(Math.sin(p * 1.0) * 0.7 + 0.6);
        mech.built.rightArmIK.elbow.rotation.x = Math.max(0.1, (Math.cos(p * 1.5) + 1.0) * 0.75);
      }
      if (mech.built.leftLeg) {
        mech.built.leftLeg.hip.rotation.x = Math.sin(p * 1.4) * 0.9;
        mech.built.leftLeg.hip.rotation.z = Math.cos(p * 0.9) * 0.4;
        mech.built.leftLeg.knee.rotation.x = Math.max(0.1, (Math.sin(p * 1.6) + 1.0) * 0.75);
      }
      if (mech.built.rightLeg) {
        mech.built.rightLeg.hip.rotation.x = -Math.sin(p * 1.4) * 0.9;
        mech.built.rightLeg.hip.rotation.z = -Math.cos(p * 0.9) * 0.4;
        mech.built.rightLeg.knee.rotation.x = Math.max(0.1, (Math.cos(p * 1.6) + 1.0) * 0.75);
      }
      if (mech.built.torsoGroup) {
        mech.built.torsoGroup.rotation.x = Math.sin(p * 0.8) * 0.35;
        mech.built.torsoGroup.rotation.z = Math.cos(p * 0.7) * 0.25;
      }
      if (mech.built.headGroup) {
        mech.built.headGroup.rotation.x = Math.sin(p * 1.5) * 0.35;
      }

      // Check 4.0-second respawn threshold
      if (mech.airborneTimer >= 4.0) {
        mech.position.copy(mech.restPos);
        mech.group.position.copy(mech.restPos);
        mech.rotation.set(0, mech.restRotY, 0);
        mech.group.rotation.set(0, mech.restRotY, 0);
        mech.velocity.set(0, 0, 0);
        mech.angularVelocity.set(0, 0, 0);
        mech.isAirborne = false;
        mech.airborneTimer = 0;
        HumanCrewMeshBuilder.poseStaticMechanic(mech.built, mech.role, mech.isCrouched, mech.hasGun);

        if (particles) {
          particles.emitPneumaticBlast(mech.restPos, new THREE.Vector3(0, 1.2, 0), 8);
        }
      }
    }
  }

  /**
   * Resets all rival mechanics back to their initial positions and stances
   */
  public resetRivalMechanics(): void {
    for (let i = 0; i < this.rivalMechanics.length; i++) {
      const mech = this.rivalMechanics[i];
      mech.position.copy(mech.restPos);
      mech.group.position.copy(mech.restPos);
      mech.rotation.set(0, mech.restRotY, 0);
      mech.group.rotation.set(0, mech.restRotY, 0);
      mech.velocity.set(0, 0, 0);
      mech.angularVelocity.set(0, 0, 0);
      mech.isAirborne = false;
      mech.airborneTimer = 0;
      HumanCrewMeshBuilder.poseStaticMechanic(mech.built, mech.role, mech.isCrouched, mech.hasGun);
    }
  }

  /**
   * Complete cleanup of pit crew meshes, geometries, and materials
   */
  public dispose(): void {
    this.restoreDefaultCrew();
    HumanCrewMeshBuilder.release();

    if (this.pitWallDisplayTex) {
      this.pitWallDisplayTex.dispose();
    }
    if (this.contactShadowTex) {
      this.contactShadowTex.dispose();
    }

    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.InstancedMesh) {
        if (obj.geometry) {
          obj.geometry.dispose();
        }
        if (obj.material) {
          const disposeMat = (m: THREE.Material) => {
            const anyMat = m as any;
            const texProps = [
              'map', 'lightMap', 'aoMap', 'emissiveMap', 'bumpMap',
              'normalMap', 'displacementMap', 'roughnessMap', 'metalnessMap',
              'alphaMap', 'envMap'
            ];
            for (let i = 0; i < texProps.length; i++) {
              const tex = anyMat[texProps[i]];
              if (tex && typeof tex.dispose === 'function') {
                tex.dispose();
              }
            }
            m.dispose();
          };

          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => disposeMat(m));
          } else {
            disposeMat(obj.material);
          }
        }
      }
    });
  }
}
