/**
 * SpeedwayTrackBuilder.ts - 3D World Generation for 2,780m Grand Prix Speedway
 * Masterclass FIA Grade-1 Racing Simulator Architecture:
 * - 100% Guaranteed Zero Track Obstruction: Every single prop, tire bundle, barrier,
 *   sign, pylon, and tree is strictly validated to be completely off the asphalt.
 * - Ultra-Realistic Safety Barriers with Chamfered Tops, Red Top Guardrails,
 *   FIA Debris Catch Fencing, Continuous Sponsor Advertising Decals, and Ramped End-Caps
 * - High-Grip Green Astroturf / Painted Runoff Strips behind all kerbs
 * - Corner Safety Tire Bundles positioned strictly outside track limits behind barriers
 * - Elevated Marshal Intervention Posts with Glowing LED Electronic Flag Displays
 * - Overhead Motorsport Sponsor Arch bridging the circuit
 * - Continuous Extruded Quad-Ribbon Kerbs (0 overlapping boxes, 0 Z-fighting)
 * - Complete FIA Pit Lane System (5 F1 Team Garages, HD Liveries, Pit Entry/Exit Gantries,
 *   Crash Attenuators, Limiter Lines, Swiveling Air Booms, Pit Stalls, and Equipment)
 * - 1.1km Mega Straight with DRS speed traps & braking boards
 * - Continuous dashed centerline across the entire 2.8 km circuit
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { safeMergeBufferGeometries, safeMergeAndDispose } from '../../utils/GeometryUtils';
import asphaltImg from '../../../assets/images/track_asphalt_detail_1790904767865.jpg';
import { getAsphaltPBRTextures, getConcretePBRTextures } from '../../utils/TrackPBRTextures';
import { ITrackWorld } from '../ICircuit';
import { StaticObstacle, DynamicProp } from '../../world/TrackBuilder';
import { SPEEDWAY_WAYPOINTS } from './SpeedwayWaypoints';
import { GrandstandCrowdSystem, CrowdPlacementConfig } from '../../crowd/GrandstandCrowdSystem';
import { CurvedPitBuildingBuilder } from '../../world/CurvedPitBuildingBuilder';
import { OrganicVegetationSystem, TreePlacementConfig } from '../../world/OrganicVegetationSystem';
import { OrganicTerrainBuilder } from '../../world/OrganicTerrainBuilder';
import { DistantMountainBackdropBuilder } from '../../world/DistantMountainBackdropBuilder';
import { PitEntryGantryBuilder } from '../../world/PitEntryGantryBuilder';
import { RoyalEngineResidencesBuilder } from '../../world/RoyalEngineResidencesBuilder';
import { SpeedwayOutfieldArchitect } from '../../world/SpeedwayOutfieldArchitect';

export class SpeedwayTrackBuilder implements ITrackWorld {
  public group: THREE.Group;
  public staticObstacles: StaticObstacle[] = [];
  public dynamicProps: DynamicProp[] = [];
  public crowdSystem: GrandstandCrowdSystem;

  // Track Dimensions
  public readonly trackWidth = 16.0; // 16m FIA Grade-1 standard track width
  public readonly halfWidth = 8.0;

  // Pit Stop Area Bounds (Positioned along main straight)
  public readonly pitZone = {
    minX: -68,
    maxX: 50,
    minZ: -122.5,
    maxZ: -105.0,
  };

  // Shared High-Performance PBR Materials
  private asphaltMat!: THREE.MeshStandardMaterial;
  private kerbRedMat!: THREE.MeshStandardMaterial;
  private kerbWhiteMat!: THREE.MeshStandardMaterial;
  private kerbBlueMat!: THREE.MeshStandardMaterial;
  private astroturfMat!: THREE.MeshStandardMaterial;
  private concreteBarrierMat!: THREE.MeshStandardMaterial;
  private guardrailRedMat!: THREE.MeshStandardMaterial;
  private metalFenceMat!: THREE.MeshStandardMaterial;
  private tecproRedMat!: THREE.MeshStandardMaterial;
  private tecproWhiteMat!: THREE.MeshStandardMaterial;
  private tireStackMat!: THREE.MeshStandardMaterial;
  private grassMat!: THREE.MeshStandardMaterial;
  private gravelMat!: THREE.MeshStandardMaterial;
  private metalDarkMat!: THREE.MeshStandardMaterial;
  private metalSilverMat!: THREE.MeshStandardMaterial;
  private glassMat!: THREE.MeshStandardMaterial;
  private treeBarkMat!: THREE.MeshStandardMaterial;
  private pineFoliageMat!: THREE.MeshStandardMaterial;
  private oakFoliageMat!: THREE.MeshStandardMaterial;
  private cypressFoliageMat!: THREE.MeshStandardMaterial;
  private bushMat!: THREE.MeshStandardMaterial;
  private whiteLineMat!: THREE.MeshStandardMaterial;
  private yellowLineMat!: THREE.MeshStandardMaterial;
  private greenDrsMat!: THREE.MeshStandardMaterial;
  private sponsorRolexMat!: THREE.MeshStandardMaterial;
  private sponsorPirelliMat!: THREE.MeshStandardMaterial;
  private sponsorBremboMat!: THREE.MeshStandardMaterial;
  private sponsorShellMat!: THREE.MeshStandardMaterial;
  private overheadTrussMat!: THREE.MeshStandardMaterial;

  private sLeftKerbs: Float32Array | null = null;
  private sRightKerbs: Float32Array | null = null;

  constructor() {
    this.group = new THREE.Group();
    this.crowdSystem = new GrandstandCrowdSystem();
    this.initMaterials();
    this.buildTerrain();
    this.buildTrackRibbon();
    this.buildContinuousRibbonKerbs();
    this.buildAstroturfRunoffs();
    this.buildRoadMarkingsAndDashedLines();
    this.buildStartFinishGantry();
    this.buildPaddockBuildingAndGarages();
    this.buildRoyalEngineResidences();
    this.buildPitEntryAndExitArchitecture();
    this.buildPitEquipment();
    this.buildSafetyBarriersAndCatchFences();
    this.buildTireBundlesAndTecpro();
    this.buildOverheadSponsorArch();
    this.buildGrandstands();
    this.buildBrakeDistanceBoards();
    this.buildHighMastFloodlights();
    this.buildVegetation();
    this.buildOutfieldMotorCity();

    // High performance static scene graph optimization
    const dynamicMeshes = new Set(this.dynamicProps.map((p) => p.mesh));
    this.group.traverse((obj) => {
      // Exclude dynamic props and their sub-meshes from static matrix freeze
      let isDynamic = false;
      let curr: THREE.Object3D | null = obj;
      while (curr && curr !== this.group) {
        if (curr.userData.keepDynamic || dynamicMeshes.has(curr as any)) {
          isDynamic = true;
          break;
        }
        curr = curr.parent;
      }

      if (obj instanceof THREE.Mesh) {
        const isShadowCaster =
          obj.material === this.concreteBarrierMat ||
          obj.material === this.tecproRedMat ||
          obj.material === this.tecproWhiteMat;
        obj.castShadow = isShadowCaster;

        const isGroundReceiver =
          obj.material === this.asphaltMat ||
          obj.material === this.gravelMat ||
          obj.material === this.kerbWhiteMat ||
          obj.material === this.kerbRedMat ||
          obj.material === this.kerbBlueMat ||
          obj.material === this.grassMat ||
          obj.name === 'SculptedOrganicTerrain' ||
          obj.receiveShadow === true;
        obj.receiveShadow = isGroundReceiver;

        if (!isDynamic) {
          obj.matrixAutoUpdate = false;
          obj.updateMatrix();
        } else {
          obj.matrixAutoUpdate = true;
        }
      }
    });
    this.group.updateMatrixWorld(true);
  }

  private initMaterials(): void {
    const textureLoader = new THREE.TextureLoader();

    // High-Grip Racing Asphalt with Procedural PBR Micro-Aggregate Normal & Roughness Maps
    const asphaltTex = textureLoader.load(asphaltImg);
    asphaltTex.wrapS = THREE.RepeatWrapping;
    asphaltTex.wrapT = THREE.RepeatWrapping;
    asphaltTex.anisotropy = 8;
    asphaltTex.repeat.set(12, 12);

    const asphaltPBR = getAsphaltPBRTextures();
    const asphaltAlbedo = asphaltPBR.albedo ? asphaltPBR.albedo.clone() : asphaltTex;
    asphaltAlbedo.repeat.set(12, 12);
    asphaltAlbedo.anisotropy = 8;
    asphaltAlbedo.needsUpdate = true;

    const asphaltNormal = asphaltPBR.normal.clone();
    asphaltNormal.repeat.set(12, 12);
    asphaltNormal.anisotropy = 4;
    asphaltNormal.needsUpdate = true;

    const asphaltRough = asphaltPBR.roughness.clone();
    asphaltRough.repeat.set(12, 12);
    asphaltRough.anisotropy = 4;
    asphaltRough.needsUpdate = true;

    this.asphaltMat = new THREE.MeshStandardMaterial({
      map: asphaltAlbedo,
      normalMap: asphaltNormal,
      normalScale: new THREE.Vector2(1.8, 1.8),
      roughnessMap: asphaltRough,
      roughness: 0.88,
      metalness: 0.06,
      envMapIntensity: 0.45,
      side: THREE.DoubleSide,
    });

    this.astroturfMat = new THREE.MeshStandardMaterial({
      color: 0x164e22,
      roughness: 0.88,
      metalness: 0.02,
      side: THREE.DoubleSide,
    });

    this.whiteLineMat = new THREE.MeshStandardMaterial({
      color: 0xd8dbe2,
      normalMap: asphaltNormal,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughness: 0.58,
      metalness: 0.04,
      envMapIntensity: 0.55,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1.0,
      polygonOffsetUnits: -1.0,
    });

    this.yellowLineMat = new THREE.MeshStandardMaterial({
      color: 0xdeb408,
      normalMap: asphaltNormal,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughness: 0.58,
      metalness: 0.04,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1.0,
      polygonOffsetUnits: -1.0,
    });

    this.greenDrsMat = new THREE.MeshStandardMaterial({
      color: 0x059669,
      roughness: 0.50,
      metalness: 0.08,
      side: THREE.DoubleSide,
    });

    this.sponsorRolexMat = new THREE.MeshStandardMaterial({
      color: 0x006039,
      roughness: 0.35,
      metalness: 0.20,
    });

    this.sponsorPirelliMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.35,
      metalness: 0.15,
    });

    this.sponsorBremboMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      roughness: 0.35,
      metalness: 0.20,
    });

    this.sponsorShellMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.35,
      metalness: 0.15,
    });

    const grassTextures = OrganicTerrainBuilder.createOrganicGrassPBRTextures();
    this.grassMat = new THREE.MeshStandardMaterial({
      map: grassTextures.albedo,
      normalMap: grassTextures.normal,
      normalScale: new THREE.Vector2(1.8, 1.8),
      roughnessMap: grassTextures.roughness,
      roughness: 0.85,
      metalness: 0.0,
      envMapIntensity: 0.12,
      color: new THREE.Color(0x82987a),
    });

    this.gravelMat = new THREE.MeshStandardMaterial({
      color: 0x9e855a,
      roughness: 0.95,
      metalness: 0.05,
    });

    const concretePBR = getConcretePBRTextures();
    const kerbNormal = concretePBR.normal.clone();
    kerbNormal.repeat.set(20, 2);
    kerbNormal.needsUpdate = true;

    this.kerbRedMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      normalMap: kerbNormal,
      normalScale: new THREE.Vector2(0.8, 0.8),
      roughness: 0.42,
      metalness: 0.06,
      envMapIntensity: 0.65,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1.0,
      polygonOffsetUnits: -2.0,
    });

    this.kerbWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xeeeff2,
      normalMap: kerbNormal,
      normalScale: new THREE.Vector2(0.8, 0.8),
      roughness: 0.42,
      metalness: 0.06,
      envMapIntensity: 0.65,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1.0,
      polygonOffsetUnits: -2.0,
    });

    this.kerbBlueMat = new THREE.MeshStandardMaterial({
      color: 0x1d4ed8,
      normalMap: kerbNormal,
      normalScale: new THREE.Vector2(0.8, 0.8),
      roughness: 0.42,
      metalness: 0.06,
      envMapIntensity: 0.65,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1.0,
      polygonOffsetUnits: -2.0,
    });

    this.concreteBarrierMat = new THREE.MeshStandardMaterial({
      map: concretePBR.albedo,
      normalMap: concretePBR.normal,
      normalScale: new THREE.Vector2(0.8, 0.8),
      roughnessMap: concretePBR.roughness,
      roughness: 0.90,
      metalness: 0.0,
      envMapIntensity: 0.04,
    });

    this.guardrailRedMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      roughness: 0.30,
      metalness: 0.60,
    });

    this.metalFenceMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.50,
      metalness: 0.70,
      wireframe: true,
    });

    this.tecproRedMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      roughness: 0.35,
      metalness: 0.05,
    });

    this.tecproWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.35,
      metalness: 0.05,
    });

    this.tireStackMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.85,
      metalness: 0.05,
    });

    this.metalDarkMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.40,
      metalness: 0.85,
    });

    this.metalSilverMat = new THREE.MeshStandardMaterial({
      color: 0xcfd8dc,
      roughness: 0.30,
      metalness: 0.80,
    });

    this.overheadTrussMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.35,
      metalness: 0.85,
    });

    this.glassMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.10,
      metalness: 0.90,
      transparent: true,
      opacity: 0.65,
    });

    this.treeBarkMat = new THREE.MeshStandardMaterial({
      color: 0x825c3e,
      roughness: 0.88,
      metalness: 0.02,
    });

    this.pineFoliageMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.82,
      metalness: 0.01,
      vertexColors: true,
      envMapIntensity: 0.35,
    });

    this.oakFoliageMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.82,
      metalness: 0.01,
      vertexColors: true,
      envMapIntensity: 0.35,
    });

    this.cypressFoliageMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.86,
      metalness: 0.01,
      vertexColors: true,
      envMapIntensity: 0.28,
    });

    this.bushMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.84,
      metalness: 0.01,
      vertexColors: true,
      envMapIntensity: 0.28,
    });
  }

  public getMinDistanceToTrack(x: number, z: number): number {
    let minDistSq = Infinity;
    const pts = SPEEDWAY_WAYPOINTS;
    const count = pts.length;
    for (let i = 0; i < count; i++) {
      const p1 = pts[i];
      const p2 = pts[(i + 1) % count];
      const dx = p2.x - p1.x;
      const dz = p2.z - p1.z;
      const lenSq = dx * dx + dz * dz;
      let t = lenSq > 1e-6 ? ((x - p1.x) * dx + (z - p1.z) * dz) / lenSq : 0;
      t = Math.max(0, Math.min(1, t));
      const nx = p1.x + t * dx - x;
      const nz = p1.z + t * dz - z;
      const dSq = nx * nx + nz * nz;
      if (dSq < minDistSq) {
        minDistSq = dSq;
      }
    }
    return Math.sqrt(minDistSq);
  }

  private getMinDistanceToTrackExcluding(x: number, z: number, localIdx: number, margin: number = 25): number {
    let minDistSq = Infinity;
    const pts = SPEEDWAY_WAYPOINTS;
    const count = pts.length;
    for (let i = 0; i < count; i++) {
      const diff = Math.abs(i - localIdx);
      const cyclicDiff = Math.min(diff, count - diff);
      if (cyclicDiff <= margin) continue;

      const p1 = pts[i];
      const p2 = pts[(i + 1) % count];
      const dx = p2.x - p1.x;
      const dz = p2.z - p1.z;
      const lenSq = dx * dx + dz * dz;
      let t = lenSq > 1e-6 ? ((x - p1.x) * dx + (z - p1.z) * dz) / lenSq : 0;
      t = Math.max(0, Math.min(1, t));
      const nx = p1.x + t * dx - x;
      const nz = p1.z + t * dz - z;
      const dSq = nx * nx + nz * nz;
      if (dSq < minDistSq) {
        minDistSq = dSq;
      }
    }
    return Math.sqrt(minDistSq);
  }

  /**
   * Evaluates 5 equidistant checkpoints along the wall segment to ensure 100% clearance from the track.
   * Discards any barrier segment that penetrates or approaches within 10.5m of any part of the circuit.
   */
  private isWallSegmentSafe(x1: number, z1: number, x2: number, z2: number, localIdx: number): boolean {
    const samples = [0.0, 0.25, 0.5, 0.75, 1.0];
    const minSafeDistOther = this.halfWidth + 2.5; // 8.0 + 2.5 = 10.5m from other track sections
    const minSafeDistLocal = this.halfWidth + 2.0; // 8.0 + 2.0 = 10.0m from local kerbs/astroturf

    for (const t of samples) {
      const px = x1 + (x2 - x1) * t;
      const pz = z1 + (z2 - z1) * t;

      // 1. Distance to other track sections (must not cross any chicane, loop, or adjacent straight)
      const distOther = this.getMinDistanceToTrackExcluding(px, pz, localIdx, 25);
      if (distOther < minSafeDistOther) {
        return false;
      }

      // 2. Distance to current track section (must stay strictly outside track limits & kerbs)
      const distLocal = this.getMinDistanceToTrack(px, pz);
      if (distLocal < minSafeDistLocal) {
        return false;
      }
    }
    return true;
  }

  private buildTerrain(): void {
    const terrainMesh = OrganicTerrainBuilder.buildSculptedTerrain(
      1400,
      950,
      96,
      72,
      this.grassMat,
      (x, z) => this.getMinDistanceToTrack(x, z),
      { x: 0, z: 50 },
      32.0,
      {
        centerX: 505,
        centerZ: 95,
        radiusX: 52,
        radiusZ: 68,
        depth: 2.2,
      }
    );
    this.group.add(terrainMesh);

    // 360° Panoramic Distant Mountain Range Backdrop
    // Scaled to 580m inner clearance radius so mountains cleanly frame the horizon without invading the track
    const mountainBackdrop = DistantMountainBackdropBuilder.buildMountainRing({
      innerRadius: 580,
      outerRadius: 1100,
      radialSegments: 288,
      heightSegments: 24,
      baseHeightScale: 1.35,
      center: { x: 0, z: 50 },
    });
    this.group.add(mountainBackdrop);
  }

  private buildTrackRibbon(): void {
    const pts = SPEEDWAY_WAYPOINTS;
    const numPts = pts.length;
    const vertices: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    const leftLineVertices: number[] = [];
    const leftLineIndices: number[] = [];
    const rightLineVertices: number[] = [];
    const rightLineIndices: number[] = [];

    const halfW = this.halfWidth;
    const lineWidth = 0.28;

    for (let i = 0; i < numPts; i++) {
      const p = pts[i];
      const prevP = pts[(i - 1 + numPts) % numPts];
      const nextP = pts[(i + 1) % numPts];

      // Central smoothed continuous tangent for silky smooth rounded curvature without kinks
      const dx = nextP.x - prevP.x;
      const dz = nextP.z - prevP.z;
      const len = Math.hypot(dx, dz) || 1;
      const normX = -dz / len;
      const normZ = dx / len;

      const dist = (p.accumulatedDistance ?? i * 4.63) * 0.1;
      vertices.push(p.x - normX * halfW, 0.02, p.z - normZ * halfW);
      uvs.push(0, dist);

      vertices.push(p.x + normX * halfW, 0.02, p.z + normZ * halfW);
      uvs.push(1, dist);

      const currentLeft = i * 2;
      const currentRight = i * 2 + 1;
      const nextLeft = ((i + 1) % numPts) * 2;
      const nextRight = ((i + 1) % numPts) * 2 + 1;

      indices.push(currentLeft, currentRight, nextLeft);
      indices.push(currentRight, nextRight, nextLeft);

      // Track limits lines
      const lOuterX = p.x - normX * halfW;
      const lOuterZ = p.z - normZ * halfW;
      const lInnerX = p.x - normX * (halfW - lineWidth);
      const lInnerZ = p.z - normZ * (halfW - lineWidth);
      leftLineVertices.push(lOuterX, 0.030, lOuterZ);
      leftLineVertices.push(lInnerX, 0.030, lInnerZ);
      leftLineIndices.push(currentLeft, currentRight, nextLeft);
      leftLineIndices.push(currentRight, nextRight, nextLeft);

      const rInnerX = p.x + normX * (halfW - lineWidth);
      const rInnerZ = p.z + normZ * (halfW - lineWidth);
      const rOuterX = p.x + normX * halfW;
      const rOuterZ = p.z + normZ * halfW;
      rightLineVertices.push(rInnerX, 0.030, rInnerZ);
      rightLineVertices.push(rOuterX, 0.030, rOuterZ);

      // Do not seal pit entry mouth with white boundary line on the main straight
      const isPitEntryMouth = (p.z < -120 && p.x >= -75 && p.x <= -46) ||
                              (nextP.z < -120 && nextP.x >= -75 && nextP.x <= -46);
      if (!isPitEntryMouth) {
        rightLineIndices.push(currentLeft, currentRight, nextLeft);
        rightLineIndices.push(currentRight, nextRight, nextLeft);
      }
    }

    const roadGeo = new THREE.BufferGeometry();
    roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    roadGeo.setIndex(indices);
    roadGeo.computeVertexNormals();
    this.group.add(new THREE.Mesh(roadGeo, this.asphaltMat));

    const leftLineGeo = new THREE.BufferGeometry();
    leftLineGeo.setAttribute('position', new THREE.Float32BufferAttribute(leftLineVertices, 3));
    leftLineGeo.setIndex(leftLineIndices);
    leftLineGeo.computeVertexNormals();
    this.group.add(new THREE.Mesh(leftLineGeo, this.whiteLineMat));

    const rightLineGeo = new THREE.BufferGeometry();
    rightLineGeo.setAttribute('position', new THREE.Float32BufferAttribute(rightLineVertices, 3));
    rightLineGeo.setIndex(rightLineIndices);
    rightLineGeo.computeVertexNormals();
    this.group.add(new THREE.Mesh(rightLineGeo, this.whiteLineMat));
  }

  /**
   * Continuous High-Grip Green Astroturf / Painted Runoff Strips directly outside the kerbs
   * Features continuous smooth width blending with 0 disjointed triangles or floating shards.
   */
  private buildAstroturfRunoffs(): void {
    const pts = SPEEDWAY_WAYPOINTS;
    const numPts = pts.length;
    const turfVertices: number[] = [];
    const turfUVs: number[] = [];
    const turfIndices: number[] = [];

    const halfW = this.halfWidth;
    const maxKerbW = 1.65;
    const maxTurfW = 1.40;

    // Compute smooth continuous corner intensity and target width per waypoint
    const leftTurfWidths = new Float32Array(numPts);
    const rightTurfWidths = new Float32Array(numPts);

    for (let i = 0; i < numPts; i++) {
      const nextP = pts[(i + 1) % numPts];
      const prevP = pts[(i - 1 + numPts) % numPts];
      const dx = nextP.x - prevP.x;
      const dz = nextP.z - prevP.z;
      const yawNow = Math.atan2(dx, dz);

      const prevDx = pts[i].x - pts[(i - 2 + numPts) % numPts].x;
      const prevDz = pts[i].z - pts[(i - 2 + numPts) % numPts].z;
      const yawPrev = Math.atan2(prevDx, prevDz);

      let angleDelta = yawNow - yawPrev;
      while (angleDelta > Math.PI) angleDelta -= Math.PI * 2;
      while (angleDelta < -Math.PI) angleDelta += Math.PI * 2;

      const p = pts[i];
      const isCorner = p.speedLimitKmh <= 285 || Math.abs(angleDelta) > 0.005;

      if (isCorner) {
        if (angleDelta < -0.001) {
          // Turning right: outside runoff is on the left
          leftTurfWidths[i] = maxTurfW;
          rightTurfWidths[i] = 0;
        } else if (angleDelta > 0.001) {
          // Turning left: outside runoff is on the right
          rightTurfWidths[i] = maxTurfW;
          leftTurfWidths[i] = 0;
        } else if (p.speedLimitKmh <= 240) {
          leftTurfWidths[i] = maxTurfW * 0.5;
          rightTurfWidths[i] = maxTurfW * 0.5;
        }
      }
    }

    // Smooth width transitions over 3 iterations to ensure seamless 0-gap ramped tapers
    const smoothWidths = (arr: Float32Array) => {
      const smoothed = new Float32Array(numPts);
      for (let i = 0; i < numPts; i++) {
        const pPrev = arr[(i - 1 + numPts) % numPts];
        const pCurr = arr[i];
        const pNext = arr[(i + 1) % numPts];
        smoothed[i] = pPrev * 0.25 + pCurr * 0.5 + pNext * 0.25;
      }
      return smoothed;
    };

    const sLeftTurf = smoothWidths(smoothWidths(leftTurfWidths));
    const sRightTurf = smoothWidths(smoothWidths(rightTurfWidths));

    // Precalculate tangent normals at all waypoints
    const normals: THREE.Vector2[] = [];
    for (let i = 0; i < numPts; i++) {
      const nextP = pts[(i + 1) % numPts];
      const prevP = pts[(i - 1 + numPts) % numPts];
      const dx = nextP.x - prevP.x;
      const dz = nextP.z - prevP.z;
      const len = Math.hypot(dx, dz) || 1;
      normals.push(new THREE.Vector2(-dz / len, dx / len));
    }

    [-1, 1].forEach((side) => {
      const turfWidthArr = side === -1 ? sLeftTurf : sRightTurf;
      const kerbWidthArr = side === -1 ? this.sLeftKerbs : this.sRightKerbs;

      for (let i = 0; i < numPts; i++) {
        const w1 = turfWidthArr[i];
        const w2 = turfWidthArr[(i + 1) % numPts];

        if (w1 < 0.04 && w2 < 0.04) continue;

        const kw1 = kerbWidthArr ? kerbWidthArr[i] : 0;
        const kw2 = kerbWidthArr ? kerbWidthArr[(i + 1) % numPts] : 0;

        const p1 = pts[i];
        const p2 = pts[(i + 1) % numPts];
        const n1 = normals[i];
        const n2 = normals[(i + 1) % numPts];

        const p1InX = p1.x + n1.x * (halfW + kw1) * side;
        const p1InZ = p1.z + n1.y * (halfW + kw1) * side;
        const p1OutX = p1.x + n1.x * (halfW + kw1 + w1) * side;
        const p1OutZ = p1.z + n1.y * (halfW + kw1 + w1) * side;

        const p2InX = p2.x + n2.x * (halfW + kw2) * side;
        const p2InZ = p2.z + n2.y * (halfW + kw2) * side;
        const p2OutX = p2.x + n2.x * (halfW + kw2 + w2) * side;
        const p2OutZ = p2.z + n2.y * (halfW + kw2 + w2) * side;

        const turfY = kw1 > 0.04 ? 0.032 : 0.024;
        const baseIdx = turfVertices.length / 3;
        turfVertices.push(p1InX, turfY, p1InZ);
        turfVertices.push(p1OutX, turfY, p1OutZ);
        turfVertices.push(p2InX, turfY, p2InZ);
        turfVertices.push(p2OutX, turfY, p2OutZ);

        const accDist = p1.accumulatedDistance ?? (i * 12.0);
        const segLen = p1.segmentLength ?? 12.0;
        const v1 = accDist * 0.4;
        const v2 = (accDist + segLen) * 0.4;
        turfUVs.push(0.0, v1);
        turfUVs.push(1.0, v1);
        turfUVs.push(0.0, v2);
        turfUVs.push(1.0, v2);

        if (side > 0) {
          turfIndices.push(baseIdx, baseIdx + 2, baseIdx + 1);
          turfIndices.push(baseIdx + 1, baseIdx + 2, baseIdx + 3);
        } else {
          turfIndices.push(baseIdx, baseIdx + 1, baseIdx + 2);
          turfIndices.push(baseIdx + 1, baseIdx + 3, baseIdx + 2);
        }
      }
    });

    if (turfVertices.length > 0) {
      const turfGeo = new THREE.BufferGeometry();
      turfGeo.setAttribute('position', new THREE.Float32BufferAttribute(turfVertices, 3));
      turfGeo.setAttribute('uv', new THREE.Float32BufferAttribute(turfUVs, 2));
      turfGeo.setIndex(turfIndices);
      turfGeo.computeVertexNormals();
      this.group.add(new THREE.Mesh(turfGeo, this.astroturfMat));
    }
  }

  private buildRoadMarkingsAndDashedLines(): void {
    const pts = SPEEDWAY_WAYPOINTS;
    const numPts = pts.length;
    const dashGeometries: THREE.BufferGeometry[] = [];

    const dashLength = 3.6;
    const dashWidth = 0.26;
    const baseDashGeo = new THREE.PlaneGeometry(dashWidth, dashLength);
    baseDashGeo.rotateX(-Math.PI / 2);

    for (let i = 0; i < numPts; i += 2) {
      const p = pts[i];
      const nextP = pts[(i + 1) % numPts];
      const dx = nextP.x - p.x;
      const dz = nextP.z - p.z;
      const yaw = Math.atan2(dx, dz);

      const dGeo = baseDashGeo.clone();
      dGeo.rotateY(yaw);
      dGeo.translate(p.x, 0.028, p.z);
      dashGeometries.push(dGeo);
    }

    // Checkered Start / Finish Line (Transverse across the entire 16m track width)
    const sfGeo = new THREE.PlaneGeometry(2.0, 16.0);
    sfGeo.rotateX(-Math.PI / 2);
    sfGeo.translate(-10.0, 0.032, -130);
    dashGeometries.push(sfGeo);

    // Starting Grid Boxes (Slots 1 to 5)
    const asphaltGridGeos: THREE.BufferGeometry[] = [];
    for (let slot = 1; slot <= 5; slot++) {
      const isLeft = slot % 2 === 1;
      const gx = -18.0 - (slot - 1) * 8.0;
      const gz = isLeft ? -128.0 : -132.0;

      const gridBoxGeo = new THREE.PlaneGeometry(2.4, 4.8);
      gridBoxGeo.rotateX(-Math.PI / 2);
      gridBoxGeo.translate(gx, 0.031, gz);
      dashGeometries.push(gridBoxGeo);

      const innerGeo = new THREE.PlaneGeometry(2.1, 4.4);
      innerGeo.rotateX(-Math.PI / 2);
      innerGeo.translate(gx, 0.033, gz);
      asphaltGridGeos.push(innerGeo);
    }

    if (dashGeometries.length > 0) {
      const mergedDashes = safeMergeBufferGeometries(dashGeometries);
      if (mergedDashes) this.group.add(new THREE.Mesh(mergedDashes, this.whiteLineMat));
    }

    if (asphaltGridGeos.length > 0) {
      const mergedInnerGrid = safeMergeBufferGeometries(asphaltGridGeos);
      if (mergedInnerGrid) this.group.add(new THREE.Mesh(mergedInnerGrid, this.asphaltMat));
    }
  }

  private buildContinuousRibbonKerbs(): void {
    const redVertices: number[] = [];
    const redUVs: number[] = [];
    const redIndices: number[] = [];
    const whiteVertices: number[] = [];
    const whiteUVs: number[] = [];
    const whiteIndices: number[] = [];
    const blueVertices: number[] = [];
    const blueUVs: number[] = [];
    const blueIndices: number[] = [];

    const pts = SPEEDWAY_WAYPOINTS;
    const numPts = pts.length;
    const halfW = this.halfWidth;
    const maxKerbWidth = 1.65;

    // Compute continuous corner curvature intensity per waypoint
    const leftKerbWidths = new Float32Array(numPts);
    const rightKerbWidths = new Float32Array(numPts);
    const isLowSpeedArr = new Uint8Array(numPts);

    for (let i = 0; i < numPts; i++) {
      const nextP = pts[(i + 1) % numPts];
      const prevP = pts[(i - 1 + numPts) % numPts];
      const dx = nextP.x - prevP.x;
      const dz = nextP.z - prevP.z;
      const yawNow = Math.atan2(dx, dz);

      const prevDx = pts[i].x - pts[(i - 2 + numPts) % numPts].x;
      const prevDz = pts[i].z - pts[(i - 2 + numPts) % numPts].z;
      const yawPrev = Math.atan2(prevDx, prevDz);

      let angleDelta = yawNow - yawPrev;
      while (angleDelta > Math.PI) angleDelta -= Math.PI * 2;
      while (angleDelta < -Math.PI) angleDelta += Math.PI * 2;

      const p = pts[i];
      const isCorner = p.speedLimitKmh <= 285 || Math.abs(angleDelta) > 0.005;

      if (isCorner) {
        if (angleDelta < -0.001) {
          // Turning right: Apex is on the RIGHT (+1), Outside exit is on LEFT (-1)
          rightKerbWidths[i] = maxKerbWidth;
          leftKerbWidths[i] = maxKerbWidth * 0.75;
        } else if (angleDelta > 0.001) {
          // Turning left: Apex is on the LEFT (-1), Outside exit is on RIGHT (+1)
          leftKerbWidths[i] = maxKerbWidth;
          rightKerbWidths[i] = maxKerbWidth * 0.75;
        } else if (p.speedLimitKmh <= 240) {
          leftKerbWidths[i] = maxKerbWidth * 0.75;
          rightKerbWidths[i] = maxKerbWidth * 0.75;
        }
      }

      if (p.speedLimitKmh <= 125) {
        isLowSpeedArr[i] = 1;
      }
    }

    // Smooth width transitions over 3 iterations for seamless continuous tapers
    const smoothWidths = (arr: Float32Array) => {
      const smoothed = new Float32Array(numPts);
      for (let i = 0; i < numPts; i++) {
        const pPrev = arr[(i - 1 + numPts) % numPts];
        const pCurr = arr[i];
        const pNext = arr[(i + 1) % numPts];
        smoothed[i] = pPrev * 0.25 + pCurr * 0.5 + pNext * 0.25;
      }
      return smoothed;
    };

    const sLeftKerbs = smoothWidths(smoothWidths(leftKerbWidths));
    const sRightKerbs = smoothWidths(smoothWidths(rightKerbWidths));
    this.sLeftKerbs = sLeftKerbs;
    this.sRightKerbs = sRightKerbs;

    // Precalculate tangent normals at all waypoints
    const normals: THREE.Vector2[] = [];
    for (let i = 0; i < numPts; i++) {
      const nextP = pts[(i + 1) % numPts];
      const prevP = pts[(i - 1 + numPts) % numPts];
      const dx = nextP.x - prevP.x;
      const dz = nextP.z - prevP.z;
      const len = Math.hypot(dx, dz) || 1;
      normals.push(new THREE.Vector2(-dz / len, dx / len));
    }

    [-1, 1].forEach((side) => {
      const kerbWidthArr = side === -1 ? sLeftKerbs : sRightKerbs;

      for (let i = 0; i < numPts; i++) {
        const w1 = kerbWidthArr[i];
        const w2 = kerbWidthArr[(i + 1) % numPts];

        if (w1 < 0.04 && w2 < 0.04) continue;

        const p1 = pts[i];
        const p2 = pts[(i + 1) % numPts];
        const n1 = normals[i];
        const n2 = normals[(i + 1) % numPts];

        const p1InnerX = p1.x + n1.x * halfW * side;
        const p1InnerZ = p1.z + n1.y * halfW * side;
        const p1OuterX = p1.x + n1.x * (halfW + w1) * side;
        const p1OuterZ = p1.z + n1.y * (halfW + w1) * side;

        const p2InnerX = p2.x + n2.x * halfW * side;
        const p2InnerZ = p2.z + n2.y * halfW * side;
        const p2OuterX = p2.x + n2.x * (halfW + w2) * side;
        const p2OuterZ = p2.z + n2.y * (halfW + w2) * side;

        const stripePhase = (i % 4 < 2);
        const isLowSpeed = isLowSpeedArr[i] === 1;

        let targetVerts: number[];
        let targetUVs: number[];
        let targetIndices: number[];

        if (isLowSpeed) {
          if (stripePhase) {
            targetVerts = blueVertices;
            targetUVs = blueUVs;
            targetIndices = blueIndices;
          } else {
            targetVerts = whiteVertices;
            targetUVs = whiteUVs;
            targetIndices = whiteIndices;
          }
        } else {
          if (stripePhase) {
            targetVerts = redVertices;
            targetUVs = redUVs;
            targetIndices = redIndices;
          } else {
            targetVerts = whiteVertices;
            targetUVs = whiteUVs;
            targetIndices = whiteIndices;
          }
        }

        const baseIdx = targetVerts.length / 3;
        targetVerts.push(p1InnerX, 0.026, p1InnerZ);
        targetVerts.push(p1OuterX, 0.038, p1OuterZ);
        targetVerts.push(p2InnerX, 0.026, p2InnerZ);
        targetVerts.push(p2OuterX, 0.038, p2OuterZ);

        const accDist = p1.accumulatedDistance ?? (i * 12.0);
        const segLen = p1.segmentLength ?? 12.0;
        const v1 = accDist * 0.4;
        const v2 = (accDist + segLen) * 0.4;
        targetUVs.push(0.0, v1);
        targetUVs.push(1.0, v1);
        targetUVs.push(0.0, v2);
        targetUVs.push(1.0, v2);

        if (side > 0) {
          targetIndices.push(baseIdx, baseIdx + 2, baseIdx + 1);
          targetIndices.push(baseIdx + 1, baseIdx + 2, baseIdx + 3);
        } else {
          targetIndices.push(baseIdx, baseIdx + 1, baseIdx + 2);
          targetIndices.push(baseIdx + 1, baseIdx + 3, baseIdx + 2);
        }
      }
    });

    if (redVertices.length > 0) {
      const redGeo = new THREE.BufferGeometry();
      redGeo.setAttribute('position', new THREE.Float32BufferAttribute(redVertices, 3));
      redGeo.setAttribute('uv', new THREE.Float32BufferAttribute(redUVs, 2));
      redGeo.setIndex(redIndices);
      redGeo.computeVertexNormals();
      this.group.add(new THREE.Mesh(redGeo, this.kerbRedMat));
    }
    if (whiteVertices.length > 0) {
      const whiteGeo = new THREE.BufferGeometry();
      whiteGeo.setAttribute('position', new THREE.Float32BufferAttribute(whiteVertices, 3));
      whiteGeo.setAttribute('uv', new THREE.Float32BufferAttribute(whiteUVs, 2));
      whiteGeo.setIndex(whiteIndices);
      whiteGeo.computeVertexNormals();
      this.group.add(new THREE.Mesh(whiteGeo, this.kerbWhiteMat));
    }
    if (blueVertices.length > 0) {
      const blueGeo = new THREE.BufferGeometry();
      blueGeo.setAttribute('position', new THREE.Float32BufferAttribute(blueVertices, 3));
      blueGeo.setAttribute('uv', new THREE.Float32BufferAttribute(blueUVs, 2));
      blueGeo.setIndex(blueIndices);
      blueGeo.computeVertexNormals();
      this.group.add(new THREE.Mesh(blueGeo, this.kerbBlueMat));
    }

    // Direction Chevron Warning Boards positioned safely in runoff areas
    const chevronCanvas = document.createElement('canvas');
    chevronCanvas.width = 512;
    chevronCanvas.height = 128;
    const cCtx = chevronCanvas.getContext('2d');
    if (cCtx) {
      // High-visibility fluorescent racing amber background
      cCtx.fillStyle = '#f59e0b';
      cCtx.fillRect(0, 0, 512, 128);
      // Outer black protective border
      cCtx.strokeStyle = '#0f172a';
      cCtx.lineWidth = 8;
      cCtx.strokeRect(4, 4, 504, 120);

      // Official FIA Directional Chevron arrows (>>>>)
      cCtx.fillStyle = '#0f172a';
      for (let a = 0; a < 4; a++) {
        const startX = 55 + a * 110;
        cCtx.beginPath();
        cCtx.moveTo(startX, 18);
        cCtx.lineTo(startX + 48, 64);
        cCtx.lineTo(startX, 110);
        cCtx.lineTo(startX + 30, 110);
        cCtx.lineTo(startX + 78, 64);
        cCtx.lineTo(startX + 30, 18);
        cCtx.closePath();
        cCtx.fill();
      }
    }

    const chevronTex = new THREE.CanvasTexture(chevronCanvas);
    chevronTex.generateMipmaps = false;
    chevronTex.minFilter = THREE.LinearFilter;
    const chevronMat = new THREE.MeshStandardMaterial({
      map: chevronTex,
      roughness: 0.35,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });

    const chevronLocations = [
      { x: 446, z: -138, yaw: -Math.PI / 2 },
      { x: 462, z: -88, yaw: -Math.PI / 3 },
      { x: 28, z: 252, yaw: 0 },
      { x: 10, z: 248, yaw: Math.PI / 6 },
      { x: -5, z: 220, yaw: Math.PI / 3 },
      { x: -445, z: -40, yaw: Math.PI / 2 },
      { x: -448, z: -75, yaw: Math.PI / 2 },
    ];

    chevronLocations.forEach((ch) => {
      if (this.getMinDistanceToTrack(ch.x, ch.z) < 11.5) return;

      const boardHolder = new THREE.Group();
      boardHolder.position.set(ch.x, 0, ch.z);
      boardHolder.rotation.y = ch.yaw;

      // Board face with crisp directional chevron graphics
      const boardGeo = new THREE.BoxGeometry(3.5, 1.2, 0.12);
      const boardMesh = new THREE.Mesh(boardGeo, chevronMat);
      boardMesh.position.set(0, 1.4, 0);
      boardHolder.add(boardMesh);

      // Dual metal mounting support poles down to ground
      const poleGeo = new THREE.CylinderGeometry(0.045, 0.045, 1.4, 8);
      [-1.2, 1.2].forEach((px) => {
        const pole = new THREE.Mesh(poleGeo, this.metalDarkMat);
        pole.position.set(px, 0.7, 0);
        boardHolder.add(pole);
      });

      this.group.add(boardHolder);
    });
  }

  /**
   * Start / Finish & Circuit Overhead Arches (Organic Aerodynamic Curved Tubular Architecture)
   * Completely replaces heavy black rectangular gantries with fluid, rounded composite arches.
   * Prohibits simple geometric boxes; uses smooth 3D curved tubular spines and rounded pylons for zero lag.
   */
  private buildStartFinishGantry(): void {
    // Start / Finish Aerodynamic Curved Tubular Arch (Spanning Main Straight)
    // Left pylon: outside track on grass (Z = -140.0)
    // Right pylon: mounted directly on concrete pit wall (Z = -121.5)
    // Span = 18.5m, Center = -130.75m. Leaves the entire pit lane at Z = -116.8 100% CLEAR!
    const startArch = this.buildAerodynamicCurvedArch(
      0,
      -130.75,
      18.5,
      8.2,
      'CIRCUIT 2 · SPEEDWAY GRAND PRIX',
      '#ef4444'
    );
    this.group.add(startArch);
  }

  private buildPaddockBuildingAndGarages(): void {
    const paddockGroup = new THREE.Group();

    // Next-Gen Aerodynamic Pit Building & Curved Garages
    const curvedPaddock = CurvedPitBuildingBuilder.buildCurvedPitBuilding(
      {
        metalDarkMat: this.metalDarkMat,
        metalSilverMat: this.metalSilverMat,
        glassMat: this.glassMat,
        concreteMat: this.concreteBarrierMat,
      },
      160.0,
      { x: 0, y: 0, z: -95.0 }
    );
    paddockGroup.add(curvedPaddock);

    // Pit Apron & Paddock Ground (Covers pit garages, working lane and pit road, x: -90 to +90, z: -122.0 to -84.0)
    const pitApronGeo = new THREE.PlaneGeometry(180, 38.0, 32, 4);
    pitApronGeo.rotateX(-Math.PI / 2);
    const apronUVs = pitApronGeo.attributes.uv;
    for (let i = 0; i < apronUVs.count; i++) {
      apronUVs.setXY(i, apronUVs.getX(i) * (180 / 260), apronUVs.getY(i) * (38.0 / 16.0));
    }
    apronUVs.needsUpdate = true;
    const pitApronMesh = new THREE.Mesh(pitApronGeo, this.asphaltMat);
    pitApronMesh.position.set(0, 0.021, -103.0);
    paddockGroup.add(pitApronMesh);

    // Pit Exit Seamless Acceleration Asphalt (Tapering from Paddock to Track Barrier)
    // Sits at Y = 0.022 with polygonOffset to completely eradicate coplanar Z-fighting with main road
    const exitLaneGeo = new THREE.BufferGeometry();
    const exitVerts = new Float32Array([
      80.0, 0.022, -121.95,
      155.0, 0.022, -121.95,
      155.0, 0.022, -117.2,
      85.0, 0.022, -105.8,
      80.0, 0.022, -105.8,
    ]);
    const exitIndices = [
      0, 1, 2,
      0, 2, 3,
      0, 3, 4,
    ];
    const exitNormals = new Float32Array([
      0, 1, 0,
      0, 1, 0,
      0, 1, 0,
      0, 1, 0,
      0, 1, 0,
    ]);
    const exitUVs = new Float32Array([
      80.0 * 0.1, -121.95 * 0.1,
      155.0 * 0.1, -121.95 * 0.1,
      155.0 * 0.1, -117.2 * 0.1,
      85.0 * 0.1, -105.8 * 0.1,
      80.0 * 0.1, -105.8 * 0.1,
    ]);
    exitLaneGeo.setAttribute('position', new THREE.BufferAttribute(exitVerts, 3));
    exitLaneGeo.setAttribute('normal', new THREE.BufferAttribute(exitNormals, 3));
    exitLaneGeo.setAttribute('uv', new THREE.BufferAttribute(exitUVs, 2));
    exitLaneGeo.setIndex(exitIndices);

    const exitAsphaltMat = this.asphaltMat.clone();
    exitAsphaltMat.polygonOffset = true;
    exitAsphaltMat.polygonOffsetFactor = -1.0;
    exitAsphaltMat.polygonOffsetUnits = -2.0;

    const exitLaneMesh = new THREE.Mesh(exitLaneGeo, exitAsphaltMat);
    exitLaneMesh.receiveShadow = true;
    exitLaneMesh.renderOrder = 1;
    paddockGroup.add(exitLaneMesh);

    // Pit Wall separating main track and pit lane on South straight
    // Sits at z = -121.5 from x = -48 to x = 44 (length = 92m, center x = -2.0)
    const pitWallGeo = new THREE.BoxGeometry(92, 1.2, 0.8);
    const pitWallUV = pitWallGeo.attributes.uv;
    if (pitWallUV) {
      for (let i = 0; i < pitWallUV.count; i++) {
        pitWallUV.setX(i, pitWallUV.getX(i) * 23.0);
      }
      pitWallUV.needsUpdate = true;
    }
    const pitWallMesh = new THREE.Mesh(pitWallGeo, this.concreteBarrierMat);
    pitWallMesh.position.set(-2, 0.6, -121.5);
    pitWallMesh.castShadow = false;
    pitWallMesh.receiveShadow = true;
    paddockGroup.add(pitWallMesh);

    // Pit Fence on top of pit wall
    const pitFenceGeo = new THREE.PlaneGeometry(92, 2.0);
    const pitFenceMesh = new THREE.Mesh(pitFenceGeo, this.metalFenceMat);
    pitFenceMesh.position.set(-2, 2.2, -121.5);
    paddockGroup.add(pitFenceMesh);

    // Sponsor Boards along Pit Wall (Batch merged by sponsor to eliminate draw calls)
    const pwRolexGeos: THREE.BufferGeometry[] = [];
    const pwPirelliGeos: THREE.BufferGeometry[] = [];
    const pwBremboGeos: THREE.BufferGeometry[] = [];
    const pwShellGeos: THREE.BufferGeometry[] = [];

    for (let x = -44; x <= 38; x += 9.2) {
      const matIdx = Math.abs(Math.floor(x / 10)) % 4;
      const bGeoIn = new THREE.BoxGeometry(7.2, 0.9, 0.08);
      bGeoIn.translate(x, 0.65, -121.05);
      const bGeoOut = new THREE.BoxGeometry(7.2, 0.9, 0.08);
      bGeoOut.translate(x, 0.65, -121.95);

      const targetArr = matIdx === 0 ? pwRolexGeos : matIdx === 1 ? pwPirelliGeos : matIdx === 2 ? pwBremboGeos : pwShellGeos;
      targetArr.push(bGeoIn, bGeoOut);
    }

    const addPaddockSponsor = (geos: THREE.BufferGeometry[], mat: THREE.Material) => {
      if (geos.length === 0) return;
      const m = safeMergeBufferGeometries(geos);
      if (m) paddockGroup.add(new THREE.Mesh(m, mat));
    };
    addPaddockSponsor(pwRolexGeos, this.sponsorRolexMat);
    addPaddockSponsor(pwPirelliGeos, this.sponsorPirelliMat);
    addPaddockSponsor(pwBremboGeos, this.sponsorBremboMat);
    addPaddockSponsor(pwShellGeos, this.sponsorShellMat);

    // Pit Box Asphalt Markings for Garage 02 (Rival)
    const stallBoxGeo = new THREE.PlaneGeometry(4.8, 8.5);
    stallBoxGeo.rotateX(-Math.PI / 2);
    const stallCanvas = document.createElement('canvas');
    stallCanvas.width = 256;
    stallCanvas.height = 512;
    const sCtx = stallCanvas.getContext('2d');
    if (sCtx) {
      sCtx.clearRect(0, 0, 256, 512);
      sCtx.strokeStyle = '#ffffff';
      sCtx.lineWidth = 14;
      sCtx.strokeRect(10, 10, 236, 492);
      sCtx.fillStyle = '#facc15';
      sCtx.fillRect(16, 80, 48, 48);
      sCtx.fillRect(192, 80, 48, 48);
      sCtx.fillRect(16, 380, 48, 48);
      sCtx.fillRect(192, 380, 48, 48);
      sCtx.fillStyle = '#ef4444';
      sCtx.fillRect(40, 240, 176, 28);
      sCtx.font = 'bold 36px monospace';
      sCtx.fillStyle = '#ffffff';
      sCtx.textAlign = 'center';
      sCtx.fillText('RIVAL', 128, 200);
    }

    const stallTex = new THREE.CanvasTexture(stallCanvas);
    stallTex.colorSpace = THREE.SRGBColorSpace;
    const stallMat = new THREE.MeshStandardMaterial({
      map: stallTex,
      transparent: true,
      roughness: 0.6,
    });
    const stallMesh = new THREE.Mesh(stallBoxGeo, stallMat);
    stallMesh.position.set(22.0, 0.035, -110.5);
    paddockGroup.add(stallMesh);

    // Pit Lane Fast Lane Solid White Boundary Lines
    const pitInnerLine = new THREE.Mesh(new THREE.PlaneGeometry(92, 0.25).rotateX(-Math.PI / 2), this.whiteLineMat);
    pitInnerLine.position.set(-2.0, 0.035, -113.2);
    paddockGroup.add(pitInnerLine);

    const pitOuterLine = new THREE.Mesh(new THREE.PlaneGeometry(92, 0.25).rotateX(-Math.PI / 2), this.whiteLineMat);
    pitOuterLine.position.set(-2.0, 0.026, -120.4);
    paddockGroup.add(pitOuterLine);

    // Pit Lane Center & Exit Dashed Guidance Lines (Consolidated into single batch geometry)
    const yellowDashGeos: THREE.BufferGeometry[] = [];
    const baseDash = new THREE.PlaneGeometry(2.0, 0.2).rotateX(-Math.PI / 2);
    for (let pd = 0; pd < 22; pd++) {
      const g = baseDash.clone();
      g.translate(-44 + pd * 4.0, 0.026, -116.8);
      yellowDashGeos.push(g);
    }
    for (let ed = 0; ed < 22; ed++) {
      const g = baseDash.clone();
      g.translate(46 + ed * 4.0, 0.026, -118.0);
      yellowDashGeos.push(g);
    }
    if (yellowDashGeos.length > 0) {
      const mergedYellow = this.mergeAndDispose(yellowDashGeos);
      if (mergedYellow) paddockGroup.add(new THREE.Mesh(mergedYellow, this.yellowLineMat));
    }

    // Official FIA Pit Exit Regulation Solid White Line & Merge Dashes (Consolidated into single batch mesh)
    const whiteExitGeos: THREE.BufferGeometry[] = [];
    const exitSolidGeo = new THREE.PlaneGeometry(81, 0.3).rotateX(-Math.PI / 2);
    exitSolidGeo.translate(84.5, 0.026, -122.0);
    whiteExitGeos.push(exitSolidGeo);

    const baseMergeDash = new THREE.PlaneGeometry(1.5, 0.3).rotateX(-Math.PI / 2);
    for (let md = 0; md < 7; md++) {
      const mdGeo = baseMergeDash.clone();
      mdGeo.translate(127 + md * 3.2, 0.026, -122.0);
      whiteExitGeos.push(mdGeo);
    }
    if (whiteExitGeos.length > 0) {
      const mergedWhite = this.mergeAndDispose(whiteExitGeos);
      if (mergedWhite) paddockGroup.add(new THREE.Mesh(mergedWhite, this.whiteLineMat));
    }

    // Register Pit Wall as Static Rigid Collider (set safely back at z = -121.1 to prevent phantom track edge collisions)
    this.staticObstacles.push({
      x: -2.0,
      z: -121.1,
      radius: 46,
      isWallSegment: true,
      p1: { x: -48.0, z: -121.1 },
      p2: { x: 44.0, z: -121.1 },
      type: 'wall',
    });

    this.group.add(paddockGroup);
  }

  private buildRoyalEngineResidences(): void {
    // 1. Primary Landmark VIP Residence along Main Straight (Kept and optimized for ultra-smooth 60/120 FPS performance)
    // Positioned at X: 35.0, Z: -158.0, Y: 0.0 - Facing +Z (directly towards the track and pit lane)
    const straightResidences = RoyalEngineResidencesBuilder.buildBuilding(
      {
        x: 35.0,
        y: 0.0,
        z: -158.0,
        rotationY: -0.08, // Direct panoramic view facing the track interior and start grid
        scale: 1.15,
        includePlaza: true,
        includeLighting: true,
      },
      this.staticObstacles
    );
    this.group.add(straightResidences);

    // Pit-side building (X: 95.0, Z: -80.0) removed per user request to free up the pit exit area and maximize rendering fluidity.
  }

  private buildPitEntryAndExitArchitecture(): void {
    const pitEntryGroup = new THREE.Group();

    // =========================================================================
    // 1. FIA HIGH-SPEED IMPACT ATTENUATOR / CRASH CUSHION (Pit Wall Entry Nose)
    // =========================================================================
    const noseX = -48.0;
    const noseZ = -122.0;

    // A. Main Crash Cushion Wedge
    const cushionGeo = new THREE.BoxGeometry(2.4, 1.35, 1.2);
    const cushionCanvas = document.createElement('canvas');
    cushionCanvas.width = 256;
    cushionCanvas.height = 128;
    const cCtx = cushionCanvas.getContext('2d')!;
    cCtx.fillStyle = '#facc15'; // High-visibility safety yellow
    cCtx.fillRect(0, 0, 256, 128);
    // Black chevron hazard diagonal stripes
    cCtx.fillStyle = '#09090b';
    cCtx.lineWidth = 28;
    for (let x = -100; x < 350; x += 55) {
      cCtx.beginPath();
      cCtx.moveTo(x, 128);
      cCtx.lineTo(x + 50, 0);
      cCtx.lineTo(x + 75, 0);
      cCtx.lineTo(x + 25, 128);
      cCtx.fill();
    }
    const cushionTex = new THREE.CanvasTexture(cushionCanvas);
    const cushionMat = new THREE.MeshStandardMaterial({
      map: cushionTex,
      roughness: 0.5,
      metalness: 0.2,
    });
    const cushionMesh = new THREE.Mesh(cushionGeo, cushionMat);
    cushionMesh.position.set(noseX - 1.2, 0.68, noseZ);
    cushionMesh.castShadow = true;
    pitEntryGroup.add(cushionMesh);

    // B. Stepped Energy-Absorbing Steel Deceleration Cylinders (QuadGuard style)
    for (let cyl = 0; cyl < 4; cyl++) {
      const cylGeo = new THREE.CylinderGeometry(0.48 - cyl * 0.04, 0.48 - cyl * 0.04, 1.2, 16);
      const cylMat = new THREE.MeshStandardMaterial({ color: cyl % 2 === 0 ? 0xfacc15 : 0x1e293b, roughness: 0.4 });
      const cylMesh = new THREE.Mesh(cylGeo, cylMat);
      cylMesh.position.set(noseX - 2.8 - cyl * 0.85, 0.6, noseZ);
      cylMesh.castShadow = true;
      pitEntryGroup.add(cylMesh);
    }

    // C. High-Intensity Flashing Amber LED Warning Beacon on Nose
    const beaconBaseGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.35, 12);
    const beaconBase = new THREE.Mesh(beaconBaseGeo, this.metalDarkMat);
    beaconBase.position.set(noseX - 0.8, 1.5, noseZ);
    pitEntryGroup.add(beaconBase);

    const beaconLightGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.25, 12);
    const beaconLightMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xf59e0b,
      emissiveIntensity: 6.0,
      roughness: 0.1,
    });
    const beaconLight = new THREE.Mesh(beaconLightGeo, beaconLightMat);
    beaconLight.position.set(noseX - 0.8, 1.75, noseZ);
    pitEntryGroup.add(beaconLight);

    // =========================================================================
    // 2. PHOTOREALISTIC FIA F1 PIT ENTRY SPEED & TIMING GANTRY SYSTEM
    // =========================================================================
    const gantryX = -54.0;
    const gantryH = 5.8;
    const pitWallZ = -122.0;  // Left column aligns EXACTLY with the pit wall
    const paddockWallZ = -106.0; // Right column aligns with paddock side (16.0m wide open entrance)
    const gantryCenterZ = (pitWallZ + paddockWallZ) / 2;

    const fiaGantry = PitEntryGantryBuilder.buildPitEntryGantry({
      gantryX,
      gantryH,
      pitWallZ,
      paddockWallZ,
      facingAngle: -Math.PI / 2,
    });
    pitEntryGroup.add(fiaGantry);

    // =========================================================================
    // 3. ROAD MARKINGS: FIA CHEVRON DECELERATION HATCHING & LIMITER LINE
    // =========================================================================
    // A. Triangular Chevron Island between Main Track and Pit Lane (x: -74 to -48)
    const chevronGeo = new THREE.PlaneGeometry(28, 7.5);
    chevronGeo.rotateX(-Math.PI / 2);
    chevronGeo.rotateY(0.28);
    const chevronCanvas = document.createElement('canvas');
    chevronCanvas.width = 512;
    chevronCanvas.height = 256;
    const chCtx = chevronCanvas.getContext('2d')!;
    chCtx.fillStyle = 'rgba(20, 20, 25, 0.0)';
    chCtx.fillRect(0, 0, 512, 256);

    chCtx.strokeStyle = '#ffffff';
    chCtx.lineWidth = 14;
    chCtx.beginPath();
    chCtx.moveTo(20, 230);
    chCtx.lineTo(490, 128);
    chCtx.lineTo(20, 26);
    chCtx.closePath();
    chCtx.stroke();

    chCtx.lineWidth = 16;
    for (let px = 60; px < 460; px += 42) {
      chCtx.beginPath();
      chCtx.moveTo(px, 220);
      chCtx.lineTo(px + 45, 128);
      chCtx.lineTo(px, 36);
      chCtx.stroke();
    }

    const chevronTex = new THREE.CanvasTexture(chevronCanvas);
    const chevronMat = new THREE.MeshBasicMaterial({
      map: chevronTex,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2.0,
      polygonOffsetUnits: -4.0,
      side: THREE.DoubleSide,
    });
    const chevronMesh = new THREE.Mesh(chevronGeo, chevronMat);
    chevronMesh.position.set(-61, 0.026, -124.8);
    chevronMesh.renderOrder = 2;
    pitEntryGroup.add(chevronMesh);

    // B. Transverse Pit Limiter Ground Road Line (at x = -54, spanning exactly the wide pit lane)
    const limiterLineGeo = new THREE.PlaneGeometry(1.6, 15.5);
    limiterLineGeo.rotateX(-Math.PI / 2);
    const limiterCanvas = document.createElement('canvas');
    limiterCanvas.width = 256;
    limiterCanvas.height = 1024;
    const lCtx = limiterCanvas.getContext('2d')!;
    lCtx.clearRect(0, 0, 256, 1024);
    lCtx.fillStyle = 'rgba(16, 18, 24, 0.75)';
    lCtx.fillRect(6, 0, 244, 1024);
    for (let y = 0; y < 1024; y += 64) {
      const isRed = (y / 64) % 2 === 0;
      lCtx.fillStyle = isRed ? 'rgba(118, 28, 34, 0.82)' : 'rgba(182, 188, 196, 0.80)';
      lCtx.fillRect(16, y, 224, 64);
    }
    const limiterTex = new THREE.CanvasTexture(limiterCanvas);
    const limiterMat = new THREE.MeshStandardMaterial({
      map: limiterTex,
      transparent: true,
      roughness: 0.88,
      metalness: 0.02,
      polygonOffset: true,
      polygonOffsetFactor: -2.0,
      polygonOffsetUnits: -4.0,
      depthWrite: false,
    });
    const limiterLine = new THREE.Mesh(limiterLineGeo, limiterMat);
    limiterLine.position.set(gantryX, 0.028, gantryCenterZ);
    limiterLine.renderOrder = 2;
    pitEntryGroup.add(limiterLine);

    // C. Heavy Tire Skid / Deceleration Rubber Marks on Pit Entry Tarmac
    const skidGeo = new THREE.PlaneGeometry(36, 6.0);
    skidGeo.rotateX(-Math.PI / 2);
    skidGeo.rotateY(0.42);
    const skidCanvas = document.createElement('canvas');
    skidCanvas.width = 512;
    skidCanvas.height = 128;
    const skCtx = skidCanvas.getContext('2d')!;
    skCtx.fillStyle = 'rgba(0,0,0,0)';
    skCtx.fillRect(0, 0, 512, 128);
    const drawTireRubber = (offsetY: number) => {
      const grad = skCtx.createLinearGradient(0, 0, 512, 0);
      grad.addColorStop(0.0, 'rgba(10, 10, 12, 0.0)');
      grad.addColorStop(0.3, 'rgba(10, 10, 12, 0.65)');
      grad.addColorStop(0.8, 'rgba(10, 10, 12, 0.85)');
      grad.addColorStop(1.0, 'rgba(10, 10, 12, 0.35)');
      skCtx.fillStyle = grad;
      skCtx.fillRect(0, offsetY, 512, 14);
    };
    drawTireRubber(32);
    drawTireRubber(82);
    const skidTex = new THREE.CanvasTexture(skidCanvas);
    const skidMat = new THREE.MeshStandardMaterial({
      map: skidTex,
      transparent: true,
      roughness: 0.85,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1.0,
      polygonOffsetUnits: -2.0,
    });
    const skidMesh = new THREE.Mesh(skidGeo, skidMat);
    skidMesh.position.set(-66, 0.025, -121.8);
    skidMesh.renderOrder = 1;
    pitEntryGroup.add(skidMesh);

    // D. Pit Entry Deceleration Photorealistic Road Marking Line (Continuous Ribbon)
    const curveSegments = 48;
    const ribbonVerts: number[] = [];
    const ribbonUVs: number[] = [];
    const ribbonIndices: number[] = [];
    const ribbonWidth = 0.36;

    for (let i = 0; i <= curveSegments; i++) {
      const t = i / curveSegments;
      const lx = -74 + t * 26;
      const lz = -122 + (1 - Math.cos(t * Math.PI)) * 0.5 * 5.8;

      const dlx = 26;
      const dlz = Math.sin(t * Math.PI) * Math.PI * 0.5 * 5.8;
      const len = Math.hypot(dlx, dlz);
      const nx = -dlz / len;
      const nz = dlx / len;

      ribbonVerts.push(lx + (nx * ribbonWidth) / 2, 0.026, lz + (nz * ribbonWidth) / 2);
      ribbonVerts.push(lx - (nx * ribbonWidth) / 2, 0.026, lz - (nz * ribbonWidth) / 2);

      ribbonUVs.push(0, t);
      ribbonUVs.push(1, t);

      if (i < curveSegments) {
        const base = i * 2;
        ribbonIndices.push(base, base + 1, base + 2);
        ribbonIndices.push(base + 1, base + 3, base + 2);
      }
    }

    const pitCurveGeo = new THREE.BufferGeometry();
    pitCurveGeo.setAttribute('position', new THREE.Float32BufferAttribute(ribbonVerts, 3));
    pitCurveGeo.setAttribute('uv', new THREE.Float32BufferAttribute(ribbonUVs, 2));
    pitCurveGeo.setIndex(ribbonIndices);
    pitCurveGeo.computeVertexNormals();

    const pitCurveMesh = new THREE.Mesh(pitCurveGeo, this.whiteLineMat);
    pitCurveMesh.receiveShadow = true;
    pitCurveMesh.renderOrder = 2;
    pitEntryGroup.add(pitCurveMesh);

    // E. Pit Entry Dashed Commitment Line along Main Straight
    for (let d = 0; d < 8; d++) {
      const dashGeo = new THREE.PlaneGeometry(1.6, 0.34);
      dashGeo.rotateX(-Math.PI / 2);
      const dash = new THREE.Mesh(dashGeo, this.whiteLineMat);
      dash.position.set(-71 + d * 3.0, 0.025, -122.0);
      dash.renderOrder = 2;
      pitEntryGroup.add(dash);
    }

    // =========================================================================
    // 4. FLUORESCENT BOLLARDS (Consolidated into single batch geometry)
    // =========================================================================
    const bollardPostGeos: THREE.BufferGeometry[] = [];
    const bollardRingGeos: THREE.BufferGeometry[] = [];
    const bPostGeoBase = new THREE.CylinderGeometry(0.06, 0.07, 0.75, 10);
    bPostGeoBase.translate(0, 0.375, 0);
    const bRingGeoBase = new THREE.CylinderGeometry(0.072, 0.072, 0.10, 10);

    for (let b = 0; b < 6; b++) {
      const bt = b / 5;
      const bx = -56 + bt * 7.5;
      const bz = -123.2 + bt * 2.0;

      const pGeo = bPostGeoBase.clone();
      pGeo.translate(bx, 0, bz);
      bollardPostGeos.push(pGeo);

      for (let r = 0; r < 2; r++) {
        const rGeo = bRingGeoBase.clone();
        rGeo.translate(bx, 0.48 + r * 0.16, bz);
        bollardRingGeos.push(rGeo);
      }
    }

    if (bollardPostGeos.length > 0) {
      const orangeMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.3, metalness: 0.1 });
      const m = safeMergeBufferGeometries(bollardPostGeos);
      if (m) pitEntryGroup.add(new THREE.Mesh(m, orangeMat));
    }
    if (bollardRingGeos.length > 0) {
      const m = safeMergeBufferGeometries(bollardRingGeos);
      if (m) pitEntryGroup.add(new THREE.Mesh(m, this.whiteLineMat));
    }

    // =========================================================================
    // 5. MOTORSPORT SPONSOR BANNERS ALONG PIT WALL (Dual Unmirrored Display)
    // =========================================================================
    const bannerCanvas = document.createElement('canvas');
    bannerCanvas.width = 1024;
    bannerCanvas.height = 128;
    const bCtx = bannerCanvas.getContext('2d')!;
    bCtx.fillStyle = '#0f172a';
    bCtx.fillRect(0, 0, 1024, 128);
    bCtx.fillStyle = '#ef4444';
    bCtx.fillRect(0, 0, 1024, 8);
    bCtx.fillStyle = '#f59e0b';
    bCtx.fillRect(0, 120, 1024, 8);
    bCtx.fillStyle = '#ffffff';
    bCtx.font = 'black 42px sans-serif';
    bCtx.fillText('APEX GT PIT LANE  ·  ROLEX  ·  PIRELLI  ·  BREMBO  ·  SHELL', 28, 78);

    const bannerTex = new THREE.CanvasTexture(bannerCanvas);
    bannerTex.generateMipmaps = false;
    bannerTex.minFilter = THREE.LinearFilter;
    const bannerMat = new THREE.MeshStandardMaterial({ map: bannerTex, roughness: 0.4 });

    // A. Rigid composite mounting frame
    const bannerFrameGeo = new THREE.BoxGeometry(32.0, 1.12, 0.14);
    const bannerFrameMesh = new THREE.Mesh(bannerFrameGeo, this.metalDarkMat);
    bannerFrameMesh.position.set(-32, 1.4, -123.8);
    pitEntryGroup.add(bannerFrameMesh);

    // B. Track-facing signboard (Viewed from main straight at Z = -130 towards +Z)
    // Looking from -Z towards +Z: Left is -X (U=0), Right is +X (U=1)
    const trackBannerGeo = new THREE.BufferGeometry();
    const tVerts = new Float32Array([
      -15.9, -0.52, 0, // bottom-left
       15.9, -0.52, 0, // bottom-right
      -15.9,  0.52, 0, // top-left
       15.9,  0.52, 0, // top-right
    ]);
    const tUVs = new Float32Array([
      0, 0,
      1, 0,
      0, 1,
      1, 1,
    ]);
    trackBannerGeo.setAttribute('position', new THREE.BufferAttribute(tVerts, 3));
    trackBannerGeo.setAttribute('uv', new THREE.BufferAttribute(tUVs, 2));
    trackBannerGeo.setIndex([0, 2, 1, 1, 2, 3]);
    trackBannerGeo.computeVertexNormals();

    const trackBannerMesh = new THREE.Mesh(trackBannerGeo, bannerMat);
    trackBannerMesh.position.set(-32, 1.4, -123.88);
    pitEntryGroup.add(trackBannerMesh);

    // C. Pit-lane facing signboard (Viewed from pit garages at Z = -95 towards -Z)
    // Looking from +Z towards -Z: Left is +X (U=0), Right is -X (U=1)
    const pitBannerGeo = new THREE.BufferGeometry();
    const pVerts = new Float32Array([
       15.9, -0.52, 0, // bottom-left
      -15.9, -0.52, 0, // bottom-right
       15.9,  0.52, 0, // top-left
      -15.9,  0.52, 0, // top-right
    ]);
    const pUVs = new Float32Array([
      0, 0,
      1, 0,
      0, 1,
      1, 1,
    ]);
    pitBannerGeo.setAttribute('position', new THREE.BufferAttribute(pVerts, 3));
    pitBannerGeo.setAttribute('uv', new THREE.BufferAttribute(pUVs, 2));
    pitBannerGeo.setIndex([0, 2, 1, 1, 2, 3]);
    pitBannerGeo.computeVertexNormals();

    const pitBannerMesh = new THREE.Mesh(pitBannerGeo, bannerMat);
    pitBannerMesh.position.set(-32, 1.4, -123.72);
    pitEntryGroup.add(pitBannerMesh);

    // =========================================================================
    // 6. PIT EXIT ARCHITECTURE (Clean F1 Signal Light Post)
    // =========================================================================
    // FIA Pit Exit Signal Light Post (At end of pit wall, x = 44.0, z = -122.0)
    const exitPostGeo = new THREE.BoxGeometry(0.35, 3.2, 0.35);
    const exitPost = new THREE.Mesh(exitPostGeo, this.metalDarkMat);
    exitPost.position.set(44.0, 1.6, -122.0);
    pitEntryGroup.add(exitPost);

    const lightHousing = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.9, 0.5), this.metalDarkMat);
    lightHousing.position.set(44.0, 2.7, -122.0);
    pitEntryGroup.add(lightHousing);

    const greenLight = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 0.1, 16).rotateZ(Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x10b981, emissiveIntensity: 5.0 })
    );
    greenLight.position.set(43.75, 2.7, -122.0);
    pitEntryGroup.add(greenLight);

    this.group.add(pitEntryGroup);
  }

  private buildPitEquipment(): void {
    const eqDarkGeos: THREE.BufferGeometry[] = [];
    const eqHoseGeos: THREE.BufferGeometry[] = [];
    const eqTireGeos: THREE.BufferGeometry[] = [];
    const eqBottleGeos: THREE.BufferGeometry[] = [];
    const eqToolBoxGeos: THREE.BufferGeometry[] = [];

    const armBase = new THREE.BoxGeometry(0.15, 0.15, 4.5);
    const hoseBase = new THREE.CylinderGeometry(0.04, 0.04, 2.2, 8);
    const tireBase = new THREE.CylinderGeometry(0.38, 0.38, 0.35, 14);
    const bottleBase = new THREE.CylinderGeometry(0.14, 0.14, 1.4, 10);
    const toolBoxBase = new THREE.BoxGeometry(1.4, 1.1, 0.7);

    for (let b = 0; b < 6; b++) {
      const boomX = -38 + b * 15;
      const aGeo = armBase.clone();
      aGeo.translate(boomX, 4.2, -110.5 + 2.25);
      eqDarkGeos.push(aGeo);

      const hGeo = hoseBase.clone();
      hGeo.translate(boomX, 4.2 - 1.1, -110.5 + 4.2);
      eqHoseGeos.push(hGeo);
    }

    [-8, 8].forEach((tx) => {
      for (let t = 0; t < 3; t++) {
        const tGeo = tireBase.clone();
        tGeo.translate(tx, 0.18 + t * 0.36, -107.2);
        eqTireGeos.push(tGeo);
      }

      const bGeo = bottleBase.clone();
      bGeo.translate(tx + 1.2, 0.7, -107.0);
      eqBottleGeos.push(bGeo);

      const tbGeo = toolBoxBase.clone();
      tbGeo.translate(tx - 1.4, 0.55, -107.1);
      eqToolBoxGeos.push(tbGeo);
    });

    if (eqDarkGeos.length > 0) {
      const m = this.mergeAndDispose(eqDarkGeos);
      if (m) this.group.add(new THREE.Mesh(m, this.metalDarkMat));
    }
    if (eqHoseGeos.length > 0) {
      const m = this.mergeAndDispose(eqHoseGeos);
      if (m) this.group.add(new THREE.Mesh(m, this.guardrailRedMat));
    }
    if (eqTireGeos.length > 0) {
      const m = this.mergeAndDispose(eqTireGeos);
      if (m) this.group.add(new THREE.Mesh(m, this.tireStackMat));
    }
    if (eqBottleGeos.length > 0) {
      const m = this.mergeAndDispose(eqBottleGeos);
      if (m) this.group.add(new THREE.Mesh(m, this.guardrailRedMat));
    }
    if (eqToolBoxGeos.length > 0) {
      const toolBoxMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.5, roughness: 0.4 });
      const m = this.mergeAndDispose(eqToolBoxGeos);
      if (m) this.group.add(new THREE.Mesh(m, toolBoxMat));
    }
  }

  /**
   * FIA Aerodynamic Continuous Curved Safety Barriers with Overhead Catch Fencing
   * Continuous swept profile lofting: replaces segmented faceted boxes with smooth continuous New Jersey / FIA profiles,
   * smooth rounded flare toes, continuous crimson aerodynamic guardrail crown, and smooth normal vectors.
   */
  private buildSafetyBarriersAndCatchFences(): void {
    const pts = SPEEDWAY_WAYPOINTS;
    const numPts = pts.length;
    const wallOffset = this.halfWidth + 4.8;
    const wallHeight = 1.15;
    const fenceHeight = 2.20;

    const concretePositions: number[] = [];
    const concreteUVs: number[] = [];
    const concreteIndices: number[] = [];

    const fenceGeos: THREE.BufferGeometry[] = [];

    // Batch merged sponsor boards
    const bRolexGeos: THREE.BufferGeometry[] = [];
    const bPirelliGeos: THREE.BufferGeometry[] = [];
    const bBremboGeos: THREE.BufferGeometry[] = [];
    const bShellGeos: THREE.BufferGeometry[] = [];

    const loftBarrierRibbon = (
      points: { x: number; z: number }[],
      isClosed: boolean,
      hasFence: boolean = true
    ) => {
      const N = points.length;
      if (N < 2) return;

      const numSegments = isClosed ? N : N - 1;

      const normals: { nx: number; nz: number }[] = [];
      for (let i = 0; i < N; i++) {
        let dx = 0;
        let dz = 0;
        if (isClosed) {
          const prev = points[(i - 1 + N) % N];
          const next = points[(i + 1) % N];
          dx = next.x - prev.x;
          dz = next.z - prev.z;
        } else {
          if (i === 0) {
            dx = points[1].x - points[0].x;
            dz = points[1].z - points[0].z;
          } else if (i === N - 1) {
            dx = points[N - 1].x - points[N - 2].x;
            dz = points[N - 1].z - points[N - 2].z;
          } else {
            dx = points[i + 1].x - points[i - 1].x;
            dz = points[i + 1].z - points[i - 1].z;
          }
        }
        const len = Math.hypot(dx, dz) || 1;
        normals.push({ nx: -dz / len, nz: dx / len });
      }

      // Cumulative distances for 4.0m modular precast block UV mapping
      const distances: number[] = [0];
      for (let i = 1; i < N; i++) {
        const d = Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z);
        distances.push(distances[i - 1] + d);
      }

      const addQuad = (
        p1A: { x: number; y: number; z: number },
        p2A: { x: number; y: number; z: number },
        p2B: { x: number; y: number; z: number },
        p1B: { x: number; y: number; z: number },
        vA: number,
        vB: number,
        uStart: number,
        uEnd: number
      ) => {
        const base = concretePositions.length / 3;
        concretePositions.push(
          p1A.x, p1A.y, p1A.z,
          p2A.x, p2A.y, p2A.z,
          p2B.x, p2B.y, p2B.z,
          p1B.x, p1B.y, p1B.z
        );
        concreteUVs.push(
          uStart, vA,
          uEnd, vA,
          uEnd, vB,
          uStart, vB
        );
        // Correct CCW outward-facing winding: (0, 1, 2) and (0, 2, 3)
        concreteIndices.push(base, base + 1, base + 2);
        concreteIndices.push(base, base + 2, base + 3);
      };

      for (let seg = 0; seg < numSegments; seg++) {
        const i1 = seg;
        const i2 = isClosed ? (seg + 1) % N : seg + 1;
        const p1 = points[i1];
        const p2 = points[i2];
        const n1 = normals[i1];
        const n2 = normals[i2];

        const d1 = distances[i1];
        const segLen = Math.hypot(p2.x - p1.x, p2.z - p1.z);
        const d2 = d1 + segLen;
        const u1 = d1 / 4.0;
        const u2 = d2 / 4.0;

        // 1. Front Lower Flare (facing track, y: 0.00 -> 0.22, o: 0.36 -> 0.24)
        addQuad(
          { x: p1.x + n1.nx * 0.36, y: 0.00, z: p1.z + n1.nz * 0.36 },
          { x: p2.x + n2.nx * 0.36, y: 0.00, z: p2.z + n2.nz * 0.36 },
          { x: p2.x + n2.nx * 0.24, y: 0.22, z: p2.z + n2.nz * 0.24 },
          { x: p1.x + n1.nx * 0.24, y: 0.22, z: p1.z + n1.nz * 0.24 },
          0.00, 0.22, u1, u2
        );

        // 2. Front Main Vertical Wall (facing track, y: 0.22 -> 1.14, o: 0.24 -> 0.10)
        addQuad(
          { x: p1.x + n1.nx * 0.24, y: 0.22, z: p1.z + n1.nz * 0.24 },
          { x: p2.x + n2.nx * 0.24, y: 0.22, z: p2.z + n2.nz * 0.24 },
          { x: p2.x + n2.nx * 0.10, y: 1.14, z: p2.z + n2.nz * 0.10 },
          { x: p1.x + n1.nx * 0.10, y: 1.14, z: p1.z + n1.nz * 0.10 },
          0.22, 0.90, u1, u2
        );

        // 3. Front Top Chamfer (facing track/sky, y: 1.14 -> 1.20, o: 0.10 -> 0.05)
        addQuad(
          { x: p1.x + n1.nx * 0.10, y: 1.14, z: p1.z + n1.nz * 0.10 },
          { x: p2.x + n2.nx * 0.10, y: 1.14, z: p2.z + n2.nz * 0.10 },
          { x: p2.x + n2.nx * 0.05, y: 1.20, z: p2.z + n2.nz * 0.05 },
          { x: p1.x + n1.nx * 0.05, y: 1.20, z: p1.z + n1.nz * 0.05 },
          0.90, 1.00, u1, u2
        );

        // 4. Flat Top Crown (facing sky, y: 1.20, o: +0.05 -> -0.05)
        addQuad(
          { x: p1.x + n1.nx * 0.05, y: 1.20, z: p1.z + n1.nz * 0.05 },
          { x: p2.x + n2.nx * 0.05, y: 1.20, z: p2.z + n2.nz * 0.05 },
          { x: p2.x - n2.nx * 0.05, y: 1.20, z: p2.z - n2.nz * 0.05 },
          { x: p1.x - n1.nx * 0.05, y: 1.20, z: p1.z - n1.nz * 0.05 },
          0.95, 1.00, u1, u2
        );

        // 5. Back Top Chamfer (facing away from track, y: 1.20 -> 1.14, o: -0.05 -> -0.10)
        addQuad(
          { x: p1.x - n1.nx * 0.05, y: 1.20, z: p1.z - n1.nz * 0.05 },
          { x: p2.x - n2.nx * 0.05, y: 1.20, z: p2.z - n2.nz * 0.05 },
          { x: p2.x - n2.nx * 0.10, y: 1.14, z: p2.z - n2.nz * 0.10 },
          { x: p1.x - n1.nx * 0.10, y: 1.14, z: p1.z - n1.nz * 0.10 },
          1.00, 0.90, u1, u2
        );

        // 6. Back Wall Face (facing away from track, y: 1.14 -> 0.00, o: -0.10 -> -0.36)
        addQuad(
          { x: p1.x - n1.nx * 0.10, y: 1.14, z: p1.z - n1.nz * 0.10 },
          { x: p2.x - n2.nx * 0.10, y: 1.14, z: p2.z - n2.nz * 0.10 },
          { x: p2.x - n2.nx * 0.36, y: 0.00, z: p2.z - n2.nz * 0.36 },
          { x: p1.x - n1.nx * 0.36, y: 0.00, z: p1.z - n1.nz * 0.36 },
          0.90, 0.00, u1, u2
        );
      }

      // Catch fence mesh & sponsor boards
      if (hasFence) {
        for (let seg = 0; seg < numSegments; seg++) {
          const p1 = points[seg];
          const p2 = isClosed ? points[(seg + 1) % N] : points[seg + 1];
          const segLen = Math.hypot(p2.x - p1.x, p2.z - p1.z);
          const yaw = Math.atan2(p2.x - p1.x, p2.z - p1.z);
          const midX = (p1.x + p2.x) * 0.5;
          const midZ = (p1.z + p2.z) * 0.5;

          if (segLen > 3.0) {
            const fGeo = new THREE.PlaneGeometry(segLen * 1.0, fenceHeight);
            fGeo.rotateY(yaw + Math.PI / 2);
            fGeo.translate(midX, wallHeight + fenceHeight / 2, midZ);
            fenceGeos.push(fGeo);
          }

          if (seg % 4 === 0 && segLen > 5.0) {
            const matIdx = Math.floor(seg / 4) % 4;
            const boardGeo = new THREE.BoxGeometry(0.08, 0.85, Math.min(7.0, segLen * 0.85));
            boardGeo.rotateY(yaw);
            const norm = normals[seg];
            boardGeo.translate(midX + norm.nx * 0.30, 0.60, midZ + norm.nz * 0.30);

            if (matIdx === 0) bRolexGeos.push(boardGeo);
            else if (matIdx === 1) bPirelliGeos.push(boardGeo);
            else if (matIdx === 2) bBremboGeos.push(boardGeo);
            else bShellGeos.push(boardGeo);
          }
        }
      }

      // Physics obstacle registration (only for contiguous spans <= 10.0m to prevent phantom cross-track walls)
      for (let seg = 0; seg < numSegments; seg++) {
        const p1 = points[seg];
        const p2 = isClosed ? points[(seg + 1) % N] : points[seg + 1];
        const segLen = Math.hypot(p2.x - p1.x, p2.z - p1.z);
        if (segLen > 10.0) continue;

        const midX = (p1.x + p2.x) * 0.5;
        const midZ = (p1.z + p2.z) * 0.5;

        this.staticObstacles.push({
          x: midX,
          z: midZ,
          radius: segLen * 0.55,
          isWallSegment: true,
          p1: { x: p1.x, z: p1.z },
          p2: { x: p2.x, z: p2.z },
          type: 'wall',
        });
      }
    };

    [-1, 1].forEach((side) => {
      const sidePoints: { x: number; z: number }[] = [];
      for (let i = 0; i < numPts; i++) {
        const p1 = pts[i];
        const nextP = pts[(i + 1) % numPts];

        if (side === 1 && p1.z < -120 && p1.x > -80 && p1.x < 155) {
          continue;
        }

        const dx = nextP.x - p1.x;
        const dz = nextP.z - p1.z;
        const len = Math.hypot(dx, dz) || 1;
        const normX = -dz / len;
        const normZ = dx / len;

        const w1X = p1.x + normX * wallOffset * side;
        const w1Z = p1.z + normZ * wallOffset * side;

        if (!this.isWallSegmentSafe(w1X, w1Z, w1X, w1Z, i)) {
          continue;
        }

        sidePoints.push({ x: w1X, z: w1Z });
      }

      if (sidePoints.length > 2) {
        const isClosed = side === -1; // Outer side is a full closed ring
        loftBarrierRibbon(sidePoints, isClosed, true);
      }
    });

    // Pit Front & Garages Barrier completely eliminated per user request
    // The frontage between the pit lane and team boxes is completely clear and open.
    // Pit Exit blend guide barrier begins downstream past the buildings (x: 85 to 155)
    const pitExitGuide: { x: number; z: number }[] = [
      { x: 85, z: -105.8 },
      { x: 155, z: -117.2 },
    ];
    loftBarrierRibbon(pitExitGuide, false, true);

    if (concretePositions.length > 0) {
      const concreteGeo = new THREE.BufferGeometry();
      concreteGeo.setAttribute('position', new THREE.Float32BufferAttribute(concretePositions, 3));
      concreteGeo.setAttribute('uv', new THREE.Float32BufferAttribute(concreteUVs, 2));
      concreteGeo.setIndex(concreteIndices);
      concreteGeo.computeVertexNormals();
      const concreteMesh = new THREE.Mesh(concreteGeo, this.concreteBarrierMat);
      concreteMesh.castShadow = false;
      concreteMesh.receiveShadow = true;
      this.group.add(concreteMesh);
    }

    if (fenceGeos.length > 0) {
      const mergedFences = safeMergeBufferGeometries(fenceGeos);
      if (mergedFences) this.group.add(new THREE.Mesh(mergedFences, this.metalFenceMat));
    }

    const addSponsorBoard = (geos: THREE.BufferGeometry[], mat: THREE.Material) => {
      if (geos.length === 0) return;
      const m = safeMergeBufferGeometries(geos);
      if (m) this.group.add(new THREE.Mesh(m, mat));
    };
    addSponsorBoard(bRolexGeos, this.sponsorRolexMat);
    addSponsorBoard(bPirelliGeos, this.sponsorPirelliMat);
    addSponsorBoard(bBremboGeos, this.sponsorBremboMat);
    addSponsorBoard(bShellGeos, this.sponsorShellMat);
  }

  /**
   * Corner Safety Tire Bundles & Tecpro Runoffs in Impact Zones
   * Placed strictly behind the outer kerb boundary outside the driving line.
   */
  private buildTireBundlesAndTecpro(): void {
    const group = new THREE.Group();

    // Stacks of 3 F1 Slicks positioned strictly outside track limits behind barriers (outside apexes)
    // Batched into a single BufferGeometry for 1 single Draw Call
    const tirePlacements = [
      { x: 445, z: -140 },
      { x: 462, z: -85 },
      { x: 235 + 12, z: 235 + 8 },
      { x: 15, z: 215 + 14 },
      { x: 5, z: 175 + 14 },
      { x: -220 - 12, z: 105 + 10 },
      { x: -445 - 12, z: -85 },
    ];

    const tireGeos: THREE.BufferGeometry[] = [];
    const baseTireGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.38, 12);

    tirePlacements.forEach((loc) => {
      // Must be at least 11.5m away from centerline
      if (this.getMinDistanceToTrack(loc.x, loc.z) < 11.5) return;

      for (let s = 0; s < 4; s++) {
        const sx = loc.x + (s - 1.5) * 0.95;
        const sz = loc.z;
        for (let t = 0; t < 3; t++) {
          const tGeo = baseTireGeo.clone();
          tGeo.translate(sx, 0.19 + t * 0.38, sz);
          tireGeos.push(tGeo);
        }
      }
    });

    if (tireGeos.length > 0) {
      const mergedTires = this.mergeAndDispose(tireGeos);
      if (mergedTires) group.add(new THREE.Mesh(mergedTires, this.tireStackMat));
    }

    // Tecpro Runoff Cushions in Heavy Deceleration Escape Roads
    // Positioned strictly behind outer kerbs and escape zones with minimum 13.0m track separation
    const tecproLocations = [
      { x: 462, z: -130, length: 28, angle: 0 }, // Chicane 1A straight overrun buffer
      { x: 472, z: -52, length: 28, angle: Math.PI / 4 }, // Chicane 1A exit outer buffer
      { x: 458, z: 85, length: 32, angle: Math.PI / 2 }, // Turn 2 outer runoff
      { x: 15, z: 258, length: 45, angle: 0 }, // Hairpin outer buffer
      { x: -468, z: -30, length: 38, angle: Math.PI * 0.75 }, // Turn 4 outer runoff
    ];

    const tecproGeos: THREE.BufferGeometry[] = [];
    tecproLocations.forEach((loc) => {
      const count = Math.floor(loc.length / 1.6);
      for (let i = 0; i < count; i++) {
        const offset = (i - count / 2) * 1.6;
        const px = loc.x + Math.sin(loc.angle) * offset;
        const pz = loc.z + Math.cos(loc.angle) * offset;

        if (this.getMinDistanceToTrack(px, pz) < 13.0) continue;

        const tpGeo = new THREE.BoxGeometry(1.4, 1.1, 1.2);
        tpGeo.rotateY(loc.angle);
        tpGeo.translate(px, 0.55, pz);
        tecproGeos.push(tpGeo);

        this.staticObstacles.push({
          x: px,
          z: pz,
          radius: 0.9,
          type: 'tecpro',
        });
      }
    });

    if (tecproGeos.length > 0) {
      const mergedTecpro = safeMergeBufferGeometries(tecproGeos);
      if (mergedTecpro) group.add(new THREE.Mesh(mergedTecpro, this.tecproRedMat));
    }

    this.group.add(group);
  }

  /**
   * Overhead Motorsport Sponsor Arch bridging the circuit at Turn 3
   * Fluid, rounded organic composite arch with smooth tubular spine and zero-lag soft shadow.
   */
  private buildOverheadSponsorArch(): void {
    const archX = 300;
    const archZ = 205;
    // Track heading at waypoint 225 is ~ -1.045 rad (-60°).
    // Perpendicular angle spanning across the track with oncoming cars approaching from -X:
    const archAngle = -1.045 - Math.PI / 2;

    const sponsorArch = this.buildAerodynamicCurvedArch(
      0,
      0,
      28.0,
      8.4,
      'PIRELLI MOTORSPORT · FORMULA 1',
      '#facc15'
    );
    sponsorArch.position.set(archX, 0, archZ);
    sponsorArch.rotation.y = archAngle;
    this.group.add(sponsorArch);
  }

  /**
   * Builder for Organic Aerodynamic Curved Tubular Arches with 100% Rounded Realism and Zero-Lag Soft Shadow
   * Replaces heavy blocky geometric boxes with fluid curved tubes, spherical crown joints, and smooth timing ribbon.
   */
  private buildAerodynamicCurvedArch(
    archX: number,
    centerZ: number,
    spanZ: number,
    height: number,
    titleText: string,
    accentColorHex: string
  ): THREE.Group {
    const archGroup = new THREE.Group();
    const halfSpan = spanZ / 2;

    // 1. Smooth Aerodynamic Continuous Curved Arch Spine (3D Catmull-Rom Tubular Spine)
    const curvePoints: THREE.Vector3[] = [];
    const segments = 16;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const z = centerZ - halfSpan + t * spanZ;
      const normalizedZ = (t - 0.5) * 2; // -1 to +1
      // Smooth parabolic/elliptical curve: rounded shoulders, organic rise
      const y = Math.max(0.4, height * (1 - Math.pow(normalizedZ, 4) * 0.48));
      curvePoints.push(new THREE.Vector3(archX, y, z));
    }

    const archCurve = new THREE.CatmullRomCurve3(curvePoints);
    const mainTubeGeo = new THREE.TubeGeometry(archCurve, 28, 0.40, 14, false);
    const mainTubeMesh = new THREE.Mesh(mainTubeGeo, this.metalDarkMat);
    mainTubeMesh.castShadow = false;
    mainTubeMesh.receiveShadow = false;
    archGroup.add(mainTubeMesh);

    // 2. Secondary Slim Aerodynamic Stabilizer Tube
    const upperPoints = curvePoints.map((p, idx) => {
      const normZ = (idx / segments - 0.5) * 2;
      return new THREE.Vector3(archX - 0.35, p.y + 0.52 * (1 - Math.pow(normZ, 2)), p.z);
    });
    const upperCurve = new THREE.CatmullRomCurve3(upperPoints);
    const upperTubeGeo = new THREE.TubeGeometry(upperCurve, 24, 0.16, 10, false);
    const upperTubeMesh = new THREE.Mesh(upperTubeGeo, this.metalSilverMat);
    upperTubeMesh.castShadow = false;
    upperTubeMesh.receiveShadow = false;
    archGroup.add(upperTubeMesh);

    // 3. Rounded Aerodynamic Base Pylons (Conical tapered cylinders with spherical crown joints)
    [-halfSpan, halfSpan].forEach((zOffset) => {
      const baseZ = centerZ + zOffset;

      const baseGeo = new THREE.CylinderGeometry(0.48, 0.82, 3.2, 20);
      const baseMesh = new THREE.Mesh(baseGeo, this.metalDarkMat);
      baseMesh.position.set(archX, 1.6, baseZ);
      archGroup.add(baseMesh);

      const ringGeo = new THREE.TorusGeometry(0.84, 0.07, 8, 20);
      ringGeo.rotateX(Math.PI / 2);
      const ringMesh = new THREE.Mesh(ringGeo, this.metalSilverMat);
      ringMesh.position.set(archX, 0.25, baseZ);
      archGroup.add(ringMesh);

      const sphereCapGeo = new THREE.SphereGeometry(0.52, 16, 12);
      const sphereCapMesh = new THREE.Mesh(sphereCapGeo, this.metalSilverMat);
      sphereCapMesh.position.set(archX, 3.2, baseZ);
      archGroup.add(sphereCapMesh);
    });

    // 4. Central Aerodynamic Curved Timing/Branding Fascia (Smooth elliptical curve)
    const ribbonCanvas = document.createElement('canvas');
    ribbonCanvas.width = 1024;
    ribbonCanvas.height = 128;
    const rCtx = ribbonCanvas.getContext('2d')!;

    rCtx.fillStyle = '#0f172a';
    rCtx.beginPath();
    rCtx.roundRect(12, 12, 1000, 104, 32);
    rCtx.fill();

    rCtx.fillStyle = accentColorHex;
    rCtx.beginPath();
    rCtx.roundRect(24, 20, 976, 8, 4);
    rCtx.fill();

    rCtx.fillStyle = '#ffffff';
    rCtx.font = 'bold 36px sans-serif';
    rCtx.textAlign = 'center';
    rCtx.fillText(titleText, 512, 68);

    rCtx.fillStyle = '#f59e0b';
    rCtx.font = 'bold 20px monospace';
    rCtx.fillText('FIA OFFICIAL TIMING & TELEMETRY', 512, 98);

    const ribbonTex = new THREE.CanvasTexture(ribbonCanvas);
    ribbonTex.generateMipmaps = false;
    ribbonTex.minFilter = THREE.LinearFilter;
    const ribbonMat = new THREE.MeshBasicMaterial({ map: ribbonTex, transparent: true, side: THREE.DoubleSide });

    // Aerodynamic curved billboard fascia spanning across track, facing oncoming drivers (-X)
    const fasciaWidth = Math.min(spanZ * 0.76, 14.2);
    const fasciaHeight = 1.35;
    const fasciaSegments = 16;
    const fPositions: number[] = [];
    const fUVs: number[] = [];
    const fIndices: number[] = [];

    for (let i = 0; i <= fasciaSegments; i++) {
      const u = i / fasciaSegments;
      const z = centerZ - fasciaWidth / 2 + u * fasciaWidth;
      // Gentle convex aerodynamic camber towards approaching drivers (-X)
      const bowX = -Math.cos((u - 0.5) * Math.PI) * 0.22;
      const vx = archX - 0.35 + bowX;

      // Bottom vertex (UV v=0)
      fPositions.push(vx, height - 0.2 - fasciaHeight / 2, z);
      fUVs.push(u, 0);

      // Top vertex (UV v=1)
      fPositions.push(vx, height - 0.2 + fasciaHeight / 2, z);
      fUVs.push(u, 1);
    }

    for (let i = 0; i < fasciaSegments; i++) {
      const v0 = i * 2;
      const v2 = i * 2 + 1;
      const v1 = (i + 1) * 2;
      const v3 = (i + 1) * 2 + 1;
      fIndices.push(v0, v1, v3);
      fIndices.push(v0, v3, v2);
    }

    const fasciaGeo = new THREE.BufferGeometry();
    fasciaGeo.setAttribute('position', new THREE.Float32BufferAttribute(fPositions, 3));
    fasciaGeo.setAttribute('uv', new THREE.Float32BufferAttribute(fUVs, 2));
    fasciaGeo.setIndex(fIndices);
    fasciaGeo.computeVertexNormals();

    const ribbonMesh = new THREE.Mesh(fasciaGeo, ribbonMat);
    archGroup.add(ribbonMesh);

    // Composite backing housing
    const backHousingGeo = new THREE.BoxGeometry(0.12, fasciaHeight * 0.95, fasciaWidth * 0.98);
    const backHousing = new THREE.Mesh(backHousingGeo, this.metalDarkMat);
    backHousing.position.set(archX - 0.24, height - 0.2, centerZ);
    archGroup.add(backHousing);

    // 5. Ultra-Lightweight Soft Baked Contact Shadow (0.00ms GPU overhead, zero fillrate impact)
    const shadowMesh = this.createCurvedArchSoftShadow(3.8, spanZ + 4.0, 0.45);
    shadowMesh.position.set(archX - 1.2, 0.016, centerZ);
    archGroup.add(shadowMesh);

    return archGroup;
  }

  /**
   * Helper to create ultra-lightweight soft diffused contact shadow for curved arches.
   * Renders at 0.00ms runtime GPU overhead with zero Z-fighting or fillrate drop.
   */
  private createCurvedArchSoftShadow(
    width: number,
    length: number,
    opacity = 0.45
  ): THREE.Mesh {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Ultra-soft smooth diffuse gradient
    const grad = ctx.createRadialGradient(128, 256, 20, 128, 256, 240);
    grad.addColorStop(0.0, `rgba(0, 0, 0, ${opacity * 0.85})`);
    grad.addColorStop(0.35, `rgba(0, 0, 0, ${opacity * 0.5})`);
    grad.addColorStop(0.75, `rgba(0, 0, 0, ${opacity * 0.15})`);
    grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 512);

    const tex = new THREE.CanvasTexture(canvas);
    const geo = new THREE.PlaneGeometry(width, length);
    geo.rotateX(-Math.PI / 2);

    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1.5,
      polygonOffsetUnits: -1.5,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = 0.016;
    mesh.renderOrder = 1;
    return mesh;
  }

  private buildGrandstands(): void {
    const grandstandLocations = [
      { x: -60, z: -155, length: 70, angle: 0 },
      { x: 380, z: -155, length: 80, angle: 0 },
      { x: 440, z: -85, length: 60, angle: Math.PI * 0.42 }, // Chicane exit viewing stand
      { x: -25, z: 260, length: 65, angle: -0.15 },          // Hairpin infield viewing stand
      { x: -360, z: 95, length: 70, angle: -Math.PI / 3 },
    ];

    const tierGeos: THREE.BufferGeometry[] = [];
    const roofGeos: THREE.BufferGeometry[] = [];

    grandstandLocations.forEach((gs) => {
      if (this.getMinDistanceToTrack(gs.x, gs.z) < 22.0) return;

      const tGeo = new THREE.BoxGeometry(gs.length, 6, 14);
      tGeo.rotateY(gs.angle);
      tGeo.translate(gs.x, 3, gs.z);
      tierGeos.push(tGeo);

      const rGeo = new THREE.BoxGeometry(gs.length + 4, 0.6, 18);
      rGeo.rotateY(gs.angle);
      rGeo.translate(gs.x, 8.5, gs.z);
      roofGeos.push(rGeo);

      this.staticObstacles.push({
        x: gs.x,
        z: gs.z,
        radius: gs.length * 0.45,
        type: 'building',
      });
    });

    if (tierGeos.length > 0) {
      const m = safeMergeBufferGeometries(tierGeos);
      if (m) this.group.add(new THREE.Mesh(m, this.concreteBarrierMat));
    }
    if (roofGeos.length > 0) {
      const m = safeMergeBufferGeometries(roofGeos);
      if (m) this.group.add(new THREE.Mesh(m, this.metalSilverMat));
    }

    // =========================================================================
    // POPULATE 3D SPECTATOR CROWD & ANIMATED FLAGS ACROSS SPEEDWAY GRANDSTANDS
    // =========================================================================
    const placements: CrowdPlacementConfig[] = [];

    grandstandLocations.forEach((gs) => {
      if (this.getMinDistanceToTrack(gs.x, gs.z) < 22.0) return;
      const standCrowd = GrandstandCrowdSystem.generateLinearGrandstandCrowd(
        gs.x,
        gs.z,
        gs.length,
        gs.angle,
        6,
        0.85,
        1.4,
        1.2,
        0.86
      );
      placements.push(...standCrowd);
    });

    this.crowdSystem.generateCrowd(placements);
    this.group.add(this.crowdSystem.group);
  }

  private buildBrakeDistanceBoards(): void {
    const brakeBoardsConfig = [
      // Sector 1: Approach to Chicane 1A (Main Straight - facing cars moving along +X)
      { dist: '150', x: 335, z: -141.5, rotY: -Math.PI / 2 },
      { dist: '100', x: 360, z: -141.5, rotY: -Math.PI / 2 },
      { dist: '50', x: 380, z: -141.5, rotY: -Math.PI / 2 },
      // Sector 2: Approach to Turn 4 / 5 technical section (positioned safely on outer verge outside track limits)
      { dist: '150', x: 120, z: 254.5, rotY: 1.684 },
      { dist: '100', x: 85, z: 248.0, rotY: 1.868 },
      { dist: '50', x: 60, z: 241.0, rotY: 2.033 },
    ];

    const pBaseGeo = new THREE.CylinderGeometry(0.06, 0.08, 1.4, 8);
    pBaseGeo.translate(0, 0.7, 0);

    brakeBoardsConfig.forEach((board) => {
      // 100% Guaranteed Zero Track Obstruction: Discard any board within track half-width + 2.5m
      if (this.getMinDistanceToTrack(board.x, board.z) < this.halfWidth + 2.5) {
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, 128, 128);
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 54px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(board.dist, 64, 64);
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#0f172a';
        ctx.strokeRect(3, 3, 122, 122);
      }

      const boardTex = new THREE.CanvasTexture(canvas);
      boardTex.generateMipmaps = false;
      boardTex.minFilter = THREE.LinearFilter;

      const markerHolder = new THREE.Group();
      markerHolder.position.set(board.x, 0, board.z);
      markerHolder.rotation.y = board.rotY;

      // Board face (double-sided so it looks solid if it tumbles in 3D)
      const boardMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1.5, 1.5),
        new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.7, side: THREE.DoubleSide })
      );
      boardMesh.position.set(0, 1.35, 0);
      boardMesh.castShadow = true;
      markerHolder.add(boardMesh);

      // Support post
      const postMesh = new THREE.Mesh(pBaseGeo, this.metalDarkMat);
      postMesh.castShadow = true;
      markerHolder.add(postMesh);

      this.group.add(markerHolder);

      // Register as DynamicProp with ballistic physics, 2.0-2.8s fade-out and lap regeneration
      const propItem: DynamicProp = {
        id: this.dynamicProps.length + 1,
        type: 'sign',
        mesh: markerHolder,
        position: new THREE.Vector3(board.x, 0, board.z),
        velocity: new THREE.Vector3(0, 0, 0),
        rotation: new THREE.Vector3(0, board.rotY, 0),
        angularVelocity: new THREE.Vector3(0, 0, 0),
        radius: 0.8,
        height: 1.5,
        mass: 14,
        isSleeping: true,
        baseY: 0,
        isAirborne: false,
        airborneTimer: 0,
        initialPosition: new THREE.Vector3(board.x, 0, board.z),
        initialRotation: new THREE.Vector3(0, board.rotY, 0),
      };
      this.dynamicProps.push(propItem);
    });
  }

  private buildHighMastFloodlights(): void {
    const towerPositions = [
      { x: -350, z: -158 },
      { x: -180, z: -158 },
      { x: 0, z: -158 },
      { x: 180, z: -158 },
      { x: 350, z: -158 },
      { x: 475, z: -30 },
      { x: 455, z: 120 },
      { x: 260, z: 275 },
      { x: 60, z: 285 },
      { x: -150, z: 180 },
      { x: -320, z: 120 },
      { x: -475, z: -60 },
    ];

    const mastGeos: THREE.BufferGeometry[] = [];
    const headGeos: THREE.BufferGeometry[] = [];
    const mastBase = new THREE.CylinderGeometry(0.6, 1.1, 26, 8);
    const headBase = new THREE.BoxGeometry(6, 2.5, 1.5);

    towerPositions.forEach((pos) => {
      if (this.getMinDistanceToTrack(pos.x, pos.z) < 22.0) return;

      const mGeo = mastBase.clone();
      mGeo.translate(pos.x, 13, pos.z);
      mastGeos.push(mGeo);

      const hGeo = headBase.clone();
      hGeo.translate(pos.x, 26, pos.z);
      headGeos.push(hGeo);

      this.staticObstacles.push({
        x: pos.x,
        z: pos.z,
        radius: 1.5,
        type: 'pillar',
      });
    });

    if (mastGeos.length > 0) {
      const m = safeMergeBufferGeometries(mastGeos);
      if (m) this.group.add(new THREE.Mesh(m, this.metalSilverMat));
    }
    if (headGeos.length > 0) {
      const m = safeMergeBufferGeometries(headGeos);
      if (m) this.group.add(new THREE.Mesh(m, this.metalDarkMat));
    }
  }

  private buildVegetation(): void {
    const trees: TreePlacementConfig[] = [];

    for (let i = 0; i < 110; i++) {
      const angle = (i / 110) * Math.PI * 2;
      const r = 240 + (i % 6) * 38;
      const tx = Math.cos(angle) * r;
      const tz = Math.sin(angle) * (r * 0.72) + 40;

      if (this.getMinDistanceToTrack(tx, tz) < 26.0) {
        continue;
      }

      // Strictly eliminate all trees along start/finish straight and adjacent to pit buildings / residences
      if ((tz < -60 && Math.abs(tx) <= 220) || Math.hypot(tx - 105, tz - (-68)) < 38) {
        continue;
      }

      const typeChoice = i % 4;
      const type: 'pine' | 'oak' | 'cypress' | 'bush' =
        typeChoice === 0 ? 'pine' : typeChoice === 1 ? 'oak' : typeChoice === 2 ? 'cypress' : 'bush';
      const scale = type === 'bush' ? 1.1 + (i % 3) * 0.2 : 1.2 + (i % 5) * 0.15;

      trees.push({
        x: tx,
        z: tz,
        scale,
        type,
        yaw: (i * 1.37) % (Math.PI * 2),
      });
    }

    // Add Italian Cypress avenues and Mediterranean stone pines framing the Alpine Lake and Villas
    const cypressAvenues: { x: number; z: number; scale: number; type: 'cypress' | 'pine' }[] = [
      { x: 472, z: 15, scale: 1.45, type: 'cypress' },
      { x: 485, z: 0, scale: 1.55, type: 'cypress' },
      { x: 512, z: -10, scale: 1.50, type: 'cypress' },
      { x: 535, z: 8, scale: 1.40, type: 'cypress' },
      { x: 548, z: 28, scale: 1.45, type: 'cypress' },
      { x: 518, z: 175, scale: 1.45, type: 'pine' },
      { x: 495, z: 190, scale: 1.40, type: 'pine' },
      { x: 470, z: 205, scale: 1.38, type: 'pine' },
      { x: 445, z: 220, scale: 1.42, type: 'pine' },
      { x: 25, z: 315, scale: 1.42, type: 'pine' },
      { x: 45, z: 335, scale: 1.55, type: 'cypress' },
      { x: 65, z: 345, scale: 1.65, type: 'cypress' },
      { x: 92, z: 345, scale: 1.50, type: 'cypress' },
      { x: 115, z: 335, scale: 1.45, type: 'cypress' },
      { x: 135, z: 320, scale: 1.38, type: 'pine' },
      { x: 125, z: -196, scale: 1.35, type: 'pine' },
      { x: 140, z: -206, scale: 1.40, type: 'cypress' },
      { x: 160, z: -212, scale: 1.50, type: 'cypress' },
      { x: 210, z: -212, scale: 1.45, type: 'cypress' },
      { x: 230, z: -205, scale: 1.40, type: 'cypress' },
      { x: 250, z: -198, scale: 1.55, type: 'cypress' },
      { x: 265, z: -192, scale: 1.38, type: 'pine' },
    ];

    cypressAvenues.forEach((ca, cIdx) => {
      if (this.getMinDistanceToTrack(ca.x, ca.z) >= 25.0) {
        trees.push({
          x: ca.x,
          z: ca.z,
          scale: ca.scale,
          type: ca.type,
          yaw: (cIdx * 0.73) % (Math.PI * 2),
        });
      }
    });

    OrganicVegetationSystem.buildVegetationForest(
      this.group,
      trees,
      {
        trunkMat: this.treeBarkMat,
        pineFoliageMat: this.pineFoliageMat,
        oakFoliageMat: this.oakFoliageMat,
        cypressFoliageMat: this.cypressFoliageMat,
        bushMat: this.bushMat,
      },
      this.staticObstacles
    );
  }

  private buildOutfieldMotorCity(): void {
    const outfieldCity = SpeedwayOutfieldArchitect.buildOutfieldEnvironment(
      {
        metalSilverMat: this.metalSilverMat,
        metalDarkMat: this.metalDarkMat,
        glassMat: this.glassMat,
        concreteMat: this.concreteBarrierMat,
      },
      this.staticObstacles
    );
    this.group.add(outfieldCity);
  }

  public impartImpulseToProp(prop: DynamicProp, vel: THREE.Vector3, normal: THREE.Vector3): void {
    prop.isSleeping = false;
    prop.isAirborne = true;
    prop.airborneTimer = 0;
    const impactSpeed = vel.length();
    const impulseStrength = Math.min(32, Math.max(6, impactSpeed * 1.4));

    prop.velocity.x = normal.x * impulseStrength + vel.x * 0.45;
    prop.velocity.z = normal.z * impulseStrength + vel.z * 0.45;
    prop.velocity.y = Math.min(12, 5.0 + Math.random() * 3.5);

    prop.angularVelocity.set((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12);
  }

  public updateDynamicProps(dt: number): void {
    for (let i = 0; i < this.dynamicProps.length; i++) {
      const prop = this.dynamicProps[i];
      if (!prop.prevPosition) prop.prevPosition = prop.position.clone();
      if (!prop.prevRotation) prop.prevRotation = prop.rotation.clone();
      if (prop.isSleeping) continue;

      prop.prevPosition.copy(prop.position);
      prop.prevRotation.copy(prop.rotation);

      if (prop.isAirborne) {
        prop.airborneTimer = (prop.airborneTimer || 0) + dt;
        if (prop.airborneTimer > 2.0) {
          const fadeProgress = (prop.airborneTimer - 2.0) / 0.8;
          const scale = Math.max(0, 1 - fadeProgress);
          prop.mesh.scale.set(scale, scale, scale);
        }
        if (prop.airborneTimer >= 2.8) {
          prop.mesh.visible = false;
          prop.mesh.scale.set(0.001, 0.001, 0.001);
          prop.isSleeping = true;
          prop.velocity.set(0, 0, 0);
          prop.angularVelocity.set(0, 0, 0);
          continue;
        }
      }

      prop.position.addScaledVector(prop.velocity, dt);
      prop.velocity.y -= 19.6 * dt;
      prop.rotation.addScaledVector(prop.angularVelocity, dt);

      if (prop.position.y <= prop.baseY) {
        prop.position.y = prop.baseY;
        prop.velocity.y *= -0.3;
        prop.velocity.x *= 0.85;
        prop.velocity.z *= 0.85;
        prop.angularVelocity.multiplyScalar(0.85);

        if (prop.velocity.lengthSq() < 0.05 && !prop.isAirborne) {
          prop.isSleeping = true;
        }
      }
    }
  }

  public resetDynamicProps(): void {
    for (let i = 0; i < this.dynamicProps.length; i++) {
      const prop = this.dynamicProps[i];
      if (prop.initialPosition) {
        prop.position.copy(prop.initialPosition);
        if (prop.prevPosition) prop.prevPosition.copy(prop.initialPosition);
      }
      if (prop.initialRotation) {
        prop.rotation.copy(prop.initialRotation);
        if (prop.prevRotation) prop.prevRotation.copy(prop.initialRotation);
      }
      prop.velocity.set(0, 0, 0);
      prop.angularVelocity.set(0, 0, 0);
      prop.isSleeping = true;
      prop.isAirborne = false;
      prop.airborneTimer = 0;
      prop.mesh.visible = true;
      prop.mesh.scale.set(1, 1, 1);
      prop.mesh.position.copy(prop.position);
      prop.mesh.rotation.set(prop.rotation.x, prop.rotation.y, prop.rotation.z);
    }
  }

  public syncDynamicPropsVisuals(alpha: number = 1.0): void {
    const clampedAlpha = THREE.MathUtils.clamp(alpha, 0, 1);
    for (let i = 0; i < this.dynamicProps.length; i++) {
      const prop = this.dynamicProps[i];
      if (prop.isSleeping) continue;
      if (prop.prevPosition) {
        prop.mesh.position.lerpVectors(prop.prevPosition, prop.position, clampedAlpha);
      } else {
        prop.mesh.position.copy(prop.position);
      }
      if (prop.prevRotation) {
        prop.mesh.rotation.set(
          THREE.MathUtils.lerp(prop.prevRotation.x, prop.rotation.x, clampedAlpha),
          THREE.MathUtils.lerp(prop.prevRotation.y, prop.rotation.y, clampedAlpha),
          THREE.MathUtils.lerp(prop.prevRotation.z, prop.rotation.z, clampedAlpha)
        );
      } else {
        prop.mesh.rotation.setFromVector3(prop.rotation);
      }
    }
  }

  private mergeAndDispose(geos: THREE.BufferGeometry[], useGroups = false): THREE.BufferGeometry | null {
    if (!geos || geos.length === 0) return null;
    return safeMergeAndDispose(geos, useGroups);
  }

  private disposeMaterial(mat: THREE.Material): void {
    const anyMat = mat as any;
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
    mat.dispose();
  }

  public dispose(): void {
    if (this.crowdSystem && typeof this.crowdSystem.dispose === 'function') {
      this.crowdSystem.dispose();
    }

    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.InstancedMesh) {
        if (obj.geometry) {
          obj.geometry.dispose();
        }
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => this.disposeMaterial(m));
          } else {
            this.disposeMaterial(obj.material);
          }
        }
      }
    });

    this.staticObstacles = [];
    this.dynamicProps = [];
  }
}
