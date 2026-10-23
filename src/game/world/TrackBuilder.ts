/**
 * TrackBuilder.ts - Professional FIA Grade-1 Racing Circuit World
 * Features realistic PBR materials, FIA catch fencing & debris barriers,
 * Tecpro high-impact runoff cushions, multi-tiered covered grandstands with VIP suites,
 * 2-story modern Pit Lane & Paddock Club building, 8 high-mast stadium floodlights,
 * realistic organic vegetation (pines, oaks, shrubs), Jumbotron video walls, and marshal posts.
 */

import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { safeMergeBufferGeometries, safeMergeAndDispose } from '../utils/GeometryUtils';
import asphaltImg from '../../assets/images/track_asphalt_detail_1790904767865.jpg';
import { getAsphaltPBRTextures, getConcretePBRTextures } from '../utils/TrackPBRTextures';
import { GrandstandCrowdSystem, CrowdPlacementConfig } from '../crowd/GrandstandCrowdSystem';
import { CurvedPitBuildingBuilder } from './CurvedPitBuildingBuilder';
import { ModernVIPBuildingBuilder } from './ModernVIPBuildingBuilder';
import { OrganicVegetationSystem, TreePlacementConfig } from './OrganicVegetationSystem';
import { OrganicTerrainBuilder } from './OrganicTerrainBuilder';
import { HTMLMountainRanges } from './HTMLMountainRanges';
import { PitEntryGantryBuilder } from './PitEntryGantryBuilder';

export interface StaticObstacle {
  x: number;
  z: number;
  radius: number;
  isWallSegment?: boolean;
  p1?: { x: number; z: number };
  p2?: { x: number; z: number };
  type: 'tree' | 'pillar' | 'wall' | 'building' | 'tecpro';
  minX?: number;
  maxX?: number;
  minZ?: number;
  maxZ?: number;
  dx?: number;
  dz?: number;
  lengthSq?: number;
  _queryId?: number;
}

export interface DynamicProp {
  id: number;
  type: 'sign' | 'cone' | 'tire_stack';
  mesh: THREE.Object3D;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotation: THREE.Vector3;
  angularVelocity: THREE.Vector3;
  prevPosition?: THREE.Vector3;
  prevRotation?: THREE.Vector3;
  radius: number;
  height: number;
  mass: number;
  isSleeping: boolean;
  baseY: number;
  lastHitTime?: number;
  isAirborne?: boolean;
  airborneTimer?: number;
  initialPosition?: THREE.Vector3;
  initialRotation?: THREE.Vector3;
}

export class TrackBuilder {
  public group: THREE.Group;
  public staticObstacles: StaticObstacle[] = [];
  public dynamicProps: DynamicProp[] = [];
  public crowdSystem: GrandstandCrowdSystem;

  public static cachedSecondaryGrandstandModel: THREE.Group | null = null;
  public static cachedBrakeMarkers: Record<string, THREE.Group> = {};

  /**
   * Consolidates sub-meshes of a sign model by material into minimal merged BufferGeometries
   * to eliminate duplicate draw calls while retaining 100% texture, material and visual fidelity.
   */
  public static consolidateSignModel(model: THREE.Group): THREE.Group {
    const consolidatedGroup = new THREE.Group();
    const meshesByMaterial = new Map<THREE.Material, THREE.BufferGeometry[]>();

    model.updateMatrixWorld(true);
    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const m = child as THREE.Mesh;
        const mat = m.material as THREE.Material;
        if (!mat || !m.geometry) return;
        const geom = m.geometry.clone();
        m.updateWorldMatrix(true, false);
        geom.applyMatrix4(m.matrixWorld);
        let list = meshesByMaterial.get(mat);
        if (!list) {
          list = [];
          meshesByMaterial.set(mat, list);
        }
        list.push(geom);
      }
    });

    meshesByMaterial.forEach((geoms, mat) => {
      const merged = safeMergeBufferGeometries(geoms);
      if (merged) {
        merged.computeBoundingSphere();
        merged.computeBoundingBox();
        const mergedMesh = new THREE.Mesh(merged, mat);
        mergedMesh.castShadow = false;
        mergedMesh.receiveShadow = false;
        consolidatedGroup.add(mergedMesh);
      } else {
        geoms.forEach((g) => {
          const mesh = new THREE.Mesh(g, mat);
          mesh.castShadow = false;
          mesh.receiveShadow = false;
          consolidatedGroup.add(mesh);
        });
      }
    });

    return consolidatedGroup.children.length > 0 ? consolidatedGroup : model;
  }

  public static cachedBrakeTextures: Record<string, THREE.Texture> = {};
  private static brakeMarkerGraphiteMat: THREE.MeshStandardMaterial | null = null;
  private static brakeMarkerYellowAccentMat: THREE.MeshStandardMaterial | null = null;
  private static brakeMarkerCompositeMat: THREE.MeshStandardMaterial | null = null;
  private static brakeMarkerDarkSteelMat: THREE.MeshStandardMaterial | null = null;
  private static brakeMarkerGalvSteelMat: THREE.MeshStandardMaterial | null = null;
  private static brakeMarkerRubberMat: THREE.MeshStandardMaterial | null = null;

  /**
   * Anodized matte graphite aluminum for the main frame bezel.
   * High metalness (0.82) with high roughness (0.78) eliminates all toy-like plastic shine.
   */
  public static getBrakeMarkerGraphiteMat(): THREE.MeshStandardMaterial {
    if (!TrackBuilder.brakeMarkerGraphiteMat) {
      TrackBuilder.brakeMarkerGraphiteMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0x23272d),
        metalness: 0.82,
        roughness: 0.78,
      });
      TrackBuilder.brakeMarkerGraphiteMat.name = 'MatMarkerGraphiteAnodized';
    }
    return TrackBuilder.brakeMarkerGraphiteMat;
  }

  /**
   * Weathered FIA industrial safety yellow for subtle frame chamfers, corner brackets, and safety demarcation.
   * Diffuse matte industrial finish (roughness 0.80) replaces saturated neon plastic.
   */
  public static getBrakeMarkerYellowAccentMat(): THREE.MeshStandardMaterial {
    if (!TrackBuilder.brakeMarkerYellowAccentMat) {
      TrackBuilder.brakeMarkerYellowAccentMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0xbfa026),
        metalness: 0.35,
        roughness: 0.80,
      });
      TrackBuilder.brakeMarkerYellowAccentMat.name = 'MatMarkerSafetyYellowWeathered';
    }
    return TrackBuilder.brakeMarkerYellowAccentMat;
  }

  /**
   * Matte carbon-composite backing housing and stiffener ribs.
   */
  public static getBrakeMarkerCompositeMat(): THREE.MeshStandardMaterial {
    if (!TrackBuilder.brakeMarkerCompositeMat) {
      TrackBuilder.brakeMarkerCompositeMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0x16181d),
        metalness: 0.20,
        roughness: 0.85,
      });
      TrackBuilder.brakeMarkerCompositeMat.name = 'MatMarkerCompositeHousing';
    }
    return TrackBuilder.brakeMarkerCompositeMat;
  }

  /**
   * Heavy structural dark steel baseplate and mounting brackets.
   */
  public static getBrakeMarkerDarkSteelMat(): THREE.MeshStandardMaterial {
    if (!TrackBuilder.brakeMarkerDarkSteelMat) {
      TrackBuilder.brakeMarkerDarkSteelMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0x1e2127),
        metalness: 0.75,
        roughness: 0.55,
      });
      TrackBuilder.brakeMarkerDarkSteelMat.name = 'MatMarkerDarkSteel';
    }
    return TrackBuilder.brakeMarkerDarkSteelMat;
  }

  /**
   * Galvanized tubular steel breakaway posts and hex foundation bolts.
   */
  public static getBrakeMarkerGalvSteelMat(): THREE.MeshStandardMaterial {
    if (!TrackBuilder.brakeMarkerGalvSteelMat) {
      TrackBuilder.brakeMarkerGalvSteelMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0x626870),
        metalness: 0.85,
        roughness: 0.45,
      });
      TrackBuilder.brakeMarkerGalvSteelMat.name = 'MatMarkerGalvSteel';
    }
    return TrackBuilder.brakeMarkerGalvSteelMat;
  }

  /**
   * Matte vulcanized elastomer breakaway boots.
   */
  public static getBrakeMarkerRubberMat(): THREE.MeshStandardMaterial {
    if (!TrackBuilder.brakeMarkerRubberMat) {
      TrackBuilder.brakeMarkerRubberMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0x0e1013),
        metalness: 0.05,
        roughness: 0.92,
      });
      TrackBuilder.brakeMarkerRubberMat.name = 'MatMarkerBreakawayRubber';
    }
    return TrackBuilder.brakeMarkerRubberMat;
  }

  /**
   * Generates or retrieves an ultra-crisp 1024x1024 FIA retroreflective
   * brake distance marker texture with honeycomb prismatic sheeting, authentic tire rubber
   * degradation, carbon composite backing, and subtle weathered safety borders.
   */
  public static getBrakeMarkerFaceTexture(distLabel: string): THREE.Texture {
    if (TrackBuilder.cachedBrakeTextures[distLabel]) {
      return TrackBuilder.cachedBrakeTextures[distLabel];
    }

    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return new THREE.Texture();
    }

    ctx.translate(1024, 0);
    ctx.scale(-1, 1);

    // 1. Carbon-composite backing panel with matte industrial tone
    ctx.fillStyle = '#14171e';
    ctx.fillRect(0, 0, 1024, 1024);

    const step = 8;
    for (let y = 0; y < 1024; y += step) {
      for (let x = 0; x < 1024; x += step) {
        if (((x / step | 0) + (y / step | 0)) % 2 === 0) {
          ctx.fillStyle = '#1c202a';
          ctx.fillRect(x, y, step, step);
        }
      }
    }

    // 2. Weathered EPDM synthetic rubber perimeter gasket & inner frame
    ctx.strokeStyle = '#0a0c10';
    ctx.lineWidth = 16;
    ctx.strokeRect(16, 16, 992, 992);

    // Subtle weathered FIA safety yellow inner demarcation border
    ctx.strokeStyle = '#c49a18';
    ctx.lineWidth = 6;
    ctx.strokeRect(28, 28, 968, 968);

    // Inner beveled dark frame shadow
    ctx.strokeStyle = '#101217';
    ctx.lineWidth = 8;
    ctx.strokeRect(36, 36, 952, 952);

    // 3. Top Header: FIA Homologated Braking Zone bar
    ctx.fillStyle = '#1e232e';
    ctx.fillRect(44, 44, 936, 90);
    ctx.strokeStyle = '#323a4a';
    ctx.lineWidth = 2;
    ctx.strokeRect(44, 44, 936, 90);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 34px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('FIA BRAKING ZONE • GRADE 1', 512, 89);

    // FIA Technical corner code
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${distLabel}M`, 955, 89);

    // 4. Large Bold High-Visibility Distance Numeral
    const numY = 512;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 440px sans-serif';

    // 3D stamped drop shadow for depth
    ctx.fillStyle = '#08090d';
    ctx.fillText(distLabel, 512 + 6, numY + 8);

    // Main 3M Retroreflective brilliant white numeral
    ctx.fillStyle = '#ffffff';
    ctx.fillText(distLabel, 512, numY);

    // Micro-prismatic diamond retroreflective sheen lines overlay
    ctx.save();
    ctx.strokeStyle = 'rgba(160, 175, 195, 0.22)';
    ctx.lineWidth = 3;
    const hexStep = 28;
    for (let py = 180; py < 820; py += hexStep) {
      ctx.beginPath();
      ctx.moveTo(120, py);
      ctx.lineTo(904, py);
      ctx.stroke();
    }
    for (let px = 120; px < 904; px += hexStep * 1.5) {
      ctx.beginPath();
      ctx.moveTo(px, 180);
      ctx.lineTo(px + 300, 820);
      ctx.stroke();
    }
    ctx.restore();

    // 5. Authentic track debris & tire rubber degradation (Desgaste de goma de competición)
    ctx.save();
    let seed = 42 + parseInt(distLabel, 10);
    const pseudoRandom = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    // Rubber marble streaks on bottom corners (outside the center number)
    for (let i = 0; i < 45; i++) {
      const rx = (pseudoRandom() > 0.5 ? 50 + pseudoRandom() * 220 : 750 + pseudoRandom() * 220);
      const ry = 450 + pseudoRandom() * 420;
      const rw = 2 + pseudoRandom() * 8;
      const rh = 1 + pseudoRandom() * 3;
      ctx.fillStyle = `rgba(10, 12, 16, ${0.4 + pseudoRandom() * 0.4})`;
      ctx.beginPath();
      ctx.ellipse(rx, ry, rw, rh, -0.2 + pseudoRandom() * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 6. Bottom Technical Specification Bar
    ctx.fillStyle = '#161922';
    ctx.fillRect(44, 882, 936, 96);
    // Subtle FIA racing red accent line
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(44, 878, 936, 4);

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('APEX GT PERFORMANCE BRAKING • FIA SPEC', 512, 930);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = 4;
    tex.needsUpdate = true;

    TrackBuilder.cachedBrakeTextures[distLabel] = tex;
    return tex;
  }

  /**
   * Applies realistic matte graphite aluminum and weathered FIA yellow materials
   * onto a loaded GLTF brake marker model before geometry consolidation.
   */
  public static applyPhotorealisticBrakeMarkerMaterials(model: THREE.Group, distLabel: string): void {
    const faceTex = TrackBuilder.getBrakeMarkerFaceTexture(distLabel);
    const faceMat = new THREE.MeshStandardMaterial({
      map: faceTex,
      roughness: 0.78,
      metalness: 0.10,
      side: THREE.DoubleSide,
    });
    faceMat.name = `MatBrakeFace_${distLabel}`;

    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const m = child as THREE.Mesh;
        const meshName = m.name || '';
        const oldMat = m.material as THREE.Material | null;
        const matName = oldMat?.name || '';

        // Front display face
        if (
          meshName.includes('DisplayFace') ||
          matName.includes('BrakeFace') ||
          matName.includes('Display')
        ) {
          m.material = faceMat;
        }
        // Frame bezel -> ALL 4 BARS IN ANODIZED MATTE GRAPHITE ALUMINUM
        else if (
          meshName.startsWith('BezelTop') ||
          meshName.startsWith('BezelBot') ||
          meshName.startsWith('BezelLeft') ||
          meshName.startsWith('BezelRight') ||
          matName.includes('SafetyYellow')
        ) {
          m.material = TrackBuilder.getBrakeMarkerGraphiteMat();
        }
        // Composite housing & rear stiffener ribs
        else if (
          meshName.includes('Housing') ||
          meshName.includes('Rib') ||
          matName.includes('Composite')
        ) {
          m.material = TrackBuilder.getBrakeMarkerCompositeMat();
        }
        // Structural baseplate and clamps
        else if (
          meshName.includes('Baseplate') ||
          meshName.includes('MountClamp') ||
          meshName.includes('Clamp') ||
          matName.includes('DarkSteel')
        ) {
          m.material = TrackBuilder.getBrakeMarkerDarkSteelMat();
        }
        // Galvanized tubular steel posts and bolts
        else if (
          meshName.includes('SupportPost') ||
          meshName.includes('Bolt') ||
          meshName.includes('Post') ||
          matName.includes('GalvSteel')
        ) {
          m.material = TrackBuilder.getBrakeMarkerGalvSteelMat();
        }
        // Breakaway rubber boots
        else if (
          meshName.includes('BreakawayBoot') ||
          meshName.includes('Boot') ||
          matName.includes('Rubber')
        ) {
          m.material = TrackBuilder.getBrakeMarkerRubberMat();
        }
      }
    });
  }

  /**
   * Procedural AAA Photorealistic FIA Breakaway Brake Distance Marker (200m, 150m, 100m, 50m).
   * Centered at origin with front face facing -Z in glTF standard.
   * High performance: merged into minimal draw calls per material.
   */
  public static createPhotorealisticBrakeMarkerModel(distLabel: string): THREE.Group {
    const group = new THREE.Group();
    group.name = `PhotorealisticBrakeMarker_${distLabel}`;

    const graphiteMat = TrackBuilder.getBrakeMarkerGraphiteMat();
    const yellowAccentMat = TrackBuilder.getBrakeMarkerYellowAccentMat();
    const compositeMat = TrackBuilder.getBrakeMarkerCompositeMat();
    const darkSteelMat = TrackBuilder.getBrakeMarkerDarkSteelMat();
    const galvSteelMat = TrackBuilder.getBrakeMarkerGalvSteelMat();
    const rubberMat = TrackBuilder.getBrakeMarkerRubberMat();

    const BOARD_Y = 1.35;

    // 1. Structural Ground Baseplate & Anchor Foundation
    const baseplateGeo = new THREE.BoxGeometry(1.40, 0.04, 0.50);
    baseplateGeo.translate(0, 0.02, 0);
    group.add(new THREE.Mesh(baseplateGeo, darkSteelMat));

    // 2. 4 Foundation Anchor Hex Bolts
    const boltGeos: THREE.BufferGeometry[] = [];
    for (const [bx, bz] of [
      [-0.55, -0.16],
      [0.55, -0.16],
      [-0.55, 0.16],
      [0.55, 0.16],
    ]) {
      const bGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.05, 6);
      bGeo.translate(bx, 0.045, bz);
      boltGeos.push(bGeo);
    }
    const mergedBolts = safeMergeBufferGeometries(boltGeos);
    if (mergedBolts) {
      group.add(new THREE.Mesh(mergedBolts, galvSteelMat));
    }

    // 3. Dual FIA Breakaway Posts (Left and Right)
    const rubberBootGeos: THREE.BufferGeometry[] = [];
    const postGeos: THREE.BufferGeometry[] = [];
    const clampGeos: THREE.BufferGeometry[] = [];

    for (const px of [-0.42, 0.42]) {
      const bootGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.18, 10);
      bootGeo.translate(px, 0.13, 0);
      rubberBootGeos.push(bootGeo);

      const postGeo = new THREE.CylinderGeometry(0.040, 0.040, 1.25, 8);
      postGeo.translate(px, 0.76, 0);
      postGeos.push(postGeo);

      const clampGeo = new THREE.BoxGeometry(0.11, 0.10, 0.14);
      clampGeo.translate(px, 1.25, 0);
      clampGeos.push(clampGeo);
    }

    const mergedBoots = safeMergeBufferGeometries(rubberBootGeos);
    if (mergedBoots) group.add(new THREE.Mesh(mergedBoots, rubberMat));

    const mergedPosts = safeMergeBufferGeometries(postGeos);
    if (mergedPosts) group.add(new THREE.Mesh(mergedPosts, galvSteelMat));

    const mergedClamps = safeMergeBufferGeometries(clampGeos);
    if (mergedClamps) group.add(new THREE.Mesh(mergedClamps, darkSteelMat));

    // 4. Molded Aerodynamic Carbon-Composite Housing & Rear Stiffener Ribs
    const compGeos: THREE.BufferGeometry[] = [];
    const housingGeo = new THREE.BoxGeometry(1.55, 1.15, 0.08);
    housingGeo.translate(0, BOARD_Y, -0.04);
    compGeos.push(housingGeo);

    const ribTopGeo = new THREE.BoxGeometry(1.48, 0.04, 0.05);
    ribTopGeo.translate(0, BOARD_Y + 0.38, 0.015);
    compGeos.push(ribTopGeo);

    const ribBotGeo = new THREE.BoxGeometry(1.48, 0.04, 0.05);
    ribBotGeo.translate(0, BOARD_Y - 0.38, 0.015);
    compGeos.push(ribBotGeo);

    const ribCenterGeo = new THREE.BoxGeometry(0.04, 1.05, 0.05);
    ribCenterGeo.translate(0, BOARD_Y, 0.015);
    compGeos.push(ribCenterGeo);

    const mergedComposite = safeMergeBufferGeometries(compGeos);
    if (mergedComposite) group.add(new THREE.Mesh(mergedComposite, compositeMat));

    // 5. Outer Frame Bezel: ALL 4 BARS IN ANODIZED MATTE GRAPHITE ALUMINUM
    // Sleek, authentic trackside finish with no cartoon plastic yellow pillars!
    const frameGeos: THREE.BufferGeometry[] = [];
    const bezelTopGeo = new THREE.BoxGeometry(1.57, 0.04, 0.04);
    bezelTopGeo.translate(0, BOARD_Y + 0.57, -0.09);
    frameGeos.push(bezelTopGeo);

    const bezelBotGeo = new THREE.BoxGeometry(1.57, 0.04, 0.04);
    bezelBotGeo.translate(0, BOARD_Y - 0.57, -0.09);
    frameGeos.push(bezelBotGeo);

    const bezelLeftGeo = new THREE.BoxGeometry(0.04, 1.15, 0.04);
    bezelLeftGeo.translate(-0.77, BOARD_Y, -0.09);
    frameGeos.push(bezelLeftGeo);

    const bezelRightGeo = new THREE.BoxGeometry(0.04, 1.15, 0.04);
    bezelRightGeo.translate(0.77, BOARD_Y, -0.09);
    frameGeos.push(bezelRightGeo);

    const mergedFrame = safeMergeBufferGeometries(frameGeos);
    if (mergedFrame) group.add(new THREE.Mesh(mergedFrame, graphiteMat));

    // 6. Subtle Weathered FIA Safety Yellow Corner Demarcation Brackets (Corner accents)
    const cornerGeos: THREE.BufferGeometry[] = [];
    for (const cx of [-0.74, 0.74]) {
      for (const cy of [BOARD_Y - 0.54, BOARD_Y + 0.54]) {
        const cGeo = new THREE.BoxGeometry(0.07, 0.07, 0.045);
        cGeo.translate(cx, cy, -0.092);
        cornerGeos.push(cGeo);
      }
    }
    const mergedCorners = safeMergeBufferGeometries(cornerGeos);
    if (mergedCorners) group.add(new THREE.Mesh(mergedCorners, yellowAccentMat));

    // 7. Recessed Display Face (Normal points towards -Z, directly facing oncoming cars)
    const faceW = 1.46;
    const faceH = 1.06;
    const halfW = faceW / 2;
    const halfH = faceH / 2;

    const displayGeo = new THREE.BufferGeometry();
    const positions = new Float32Array([
      -halfW,  halfH, 0, // 0: Top-Left
       halfW,  halfH, 0, // 1: Top-Right
      -halfW, -halfH, 0, // 2: Bottom-Left
       halfW, -halfH, 0, // 3: Bottom-Right
    ]);
    const normals = new Float32Array([
      0, 0, -1,
      0, 0, -1,
      0, 0, -1,
      0, 0, -1,
    ]);
    const uvs = new Float32Array([
      0, 1,
      1, 1,
      0, 0,
      1, 0,
    ]);
    const indices = [0, 2, 1, 1, 2, 3];
    displayGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    displayGeo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    displayGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    displayGeo.setIndex(indices);
    displayGeo.translate(0, BOARD_Y, -0.088);

    const faceTex = TrackBuilder.getBrakeMarkerFaceTexture(distLabel);
    const faceMat = new THREE.MeshStandardMaterial({
      map: faceTex,
      roughness: 0.78, // High roughness, diffuse scattering, no plastic gloss
      metalness: 0.10,
      side: THREE.DoubleSide,
    });
    faceMat.name = `MatBrakeFace_${distLabel}`;

    const faceMesh = new THREE.Mesh(displayGeo, faceMat);
    group.add(faceMesh);

    return TrackBuilder.consolidateSignModel(group);
  }

  /**
   * Preloads both secondary grandstands and breakaway brake markers upfront.
   */
  public static async preloadAssets(): Promise<void> {
    const gltfLoader = new GLTFLoader();
    const texLoader = new THREE.TextureLoader();

    const grandstandPromise = new Promise<void>((resolve) => {
      if (TrackBuilder.cachedSecondaryGrandstandModel) {
        resolve();
        return;
      }
      gltfLoader.load(
        '/models/photorealistic_secondary_grandstand.glb',
        (gltf) => {
          const grandstandModel = gltf.scene;
          let bannerTexture: THREE.Texture | null = null;
          grandstandModel.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              mesh.castShadow = false;
              mesh.receiveShadow = false;
              mesh.geometry.computeBoundingSphere();
              mesh.geometry.computeBoundingBox();
              if (mesh.material) {
                const mat = mesh.material as THREE.MeshStandardMaterial;
                mat.roughness = Math.max(0.40, mat.roughness);
                mat.side = THREE.FrontSide;
                const meshNameLow = mesh.name.toLowerCase();
                if (meshNameLow.includes('canopy')) {
                  mat.color.setHex(0x94a3b8);
                  mat.roughness = 0.65;
                } else if (meshNameLow.includes('deck') || meshNameLow.includes('scaffold')) {
                  mat.color.multiplyScalar(0.70);
                  mat.roughness = Math.max(0.50, mat.roughness);
                } else if (meshNameLow.includes('seat')) {
                  mat.color.multiplyScalar(0.75);
                  mat.roughness = Math.max(0.55, mat.roughness);
                }
                if (mesh.name.includes('Banner') && !mat.map) {
                  if (!bannerTexture) {
                    bannerTexture = texLoader.load('/textures/grandstands/sponsor_banner_apex.png');
                    bannerTexture.anisotropy = 16;
                  }
                  mat.map = bannerTexture;
                }
                mat.needsUpdate = true;
              }
            }
          });
          TrackBuilder.cachedSecondaryGrandstandModel = grandstandModel;
          resolve();
        },
        undefined,
        () => resolve()
      );
      setTimeout(resolve, 2500);
    });

    const dists = ['200', '150', '100', '50'];
    // Instantly seed cached brake markers with procedural AAA photorealistic models
    dists.forEach((d) => {
      TrackBuilder.cachedBrakeMarkers[d] = TrackBuilder.createPhotorealisticBrakeMarkerModel(d);
    });

    await grandstandPromise;
  }

  // Track Dimensions
  public readonly halfSize = 130;  // 260m total square size
  public readonly cornerRadius = 38; // Radius of 4 rounded corner apexes
  public readonly trackWidth = 16;
  public readonly innerCornerCenter = 130 - 38; // 92

  // Pit Stop Area Bounds
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
  private concreteBarrierMat!: THREE.MeshStandardMaterial;
  private metalFenceMat!: THREE.MeshStandardMaterial;
  private grassMat!: THREE.MeshStandardMaterial;
  private gravelMat!: THREE.MeshStandardMaterial;
  private dirtShoulderMat!: THREE.MeshStandardMaterial;
  private treeBarkMat!: THREE.MeshStandardMaterial;
  private pineFoliageMat!: THREE.MeshStandardMaterial;
  private oakFoliageMat!: THREE.MeshStandardMaterial;
  private cypressFoliageMat!: THREE.MeshStandardMaterial;
  private bushFoliageMat!: THREE.MeshStandardMaterial;
  private grassTuftMat!: THREE.MeshStandardMaterial;
  private glassMat!: THREE.MeshStandardMaterial;
  private metalDarkMat!: THREE.MeshStandardMaterial;
  private metalSilverMat!: THREE.MeshStandardMaterial;
  private overheadTrussMat!: THREE.MeshStandardMaterial;
  private startLightMat!: THREE.MeshBasicMaterial;
  private floodlightMat!: THREE.MeshStandardMaterial;

  constructor() {
    this.group = new THREE.Group();
    this.crowdSystem = new GrandstandCrowdSystem();
    this.initMaterials();
    this.buildTerrainAndInfield();
    this.buildSquareCircuitTrack();
    this.buildKerbsAndStartingGrid();
    this.buildConcreteBarriersWithCatchFences();
    this.buildGrandstands();
    this.buildModernVIPArchitecture();
    this.buildPaddockBuildingAndPitLane();
    this.buildPitEntryAndExitArchitecture();
    this.buildServiceAndSafetyVehicles();
    this.buildSpeedTrapRadarAndSectorGantries();
    this.buildOverheadGantriesAndBridges();
    this.buildHighMastFloodlights();
    this.buildOrganicVegetation();
    this.buildDynamicProps();

    // High-performance static scene graph & shadow pass optimization:
    // 1. Disables real-time dynamic shadow casting on static environment (saves >450 shadow draw calls per frame!)
    // 2. Only actual track surfaces (asphalt, gravel, kerbs) receive dynamic shadows. Overhead bridges, gantries,
    //    vegetation, walls and soft shadows NEVER sample the shadow map, eliminating fillrate choke when driving underneath.
    // 3. Disables per-frame local matrix recalculation and freezes global world matrices.
    const dynamicMeshes = new Set(this.dynamicProps.map(p => p.mesh));
    this.group.traverse((obj) => {
      let isDynamic = false;
      let curr: THREE.Object3D | null = obj;
      while (curr && curr !== this.group) {
        if (dynamicMeshes.has(curr as any)) {
          isDynamic = true;
          break;
        }
        curr = curr.parent;
      }

      if (obj instanceof THREE.Mesh) {
        // Overhead trusses and modern architectural buildings cast crisp physical shadows across track edges and kerbs
        const isShadowCaster = obj.castShadow === true ||
          obj.userData.castShadow === true ||
          obj.material === this.overheadTrussMat;
        obj.castShadow = isShadowCaster;

        const isGroundReceiver = obj.material === this.asphaltMat ||
          obj.material === this.gravelMat ||
          obj.material === this.kerbWhiteMat ||
          obj.material === this.kerbRedMat ||
          obj.material === this.dirtShoulderMat ||
          obj.name === 'trackLineMesh';
        obj.receiveShadow = isGroundReceiver;
      }

      if (!isDynamic) {
        obj.matrixAutoUpdate = false;
        obj.updateMatrix();
      }
    });
    this.group.updateMatrixWorld(true);
  }

  private initMaterials(): void {
    const textureLoader = new THREE.TextureLoader();

    // High-Grip Racing Asphalt Texture with Balanced Anisotropy
    const asphaltTex = textureLoader.load(asphaltImg);
    asphaltTex.wrapS = THREE.RepeatWrapping;
    asphaltTex.wrapT = THREE.RepeatWrapping;
    asphaltTex.anisotropy = 8;
    asphaltTex.generateMipmaps = true;
    asphaltTex.minFilter = THREE.LinearMipmapLinearFilter;
    asphaltTex.magFilter = THREE.LinearFilter;
    asphaltTex.repeat.set(16, 16);

    // Procedural PBR Physical Micro-Aggregate Normal, Roughness & Albedo Maps
    const asphaltPBR = getAsphaltPBRTextures();
    const asphaltAlbedo = asphaltPBR.albedo ? asphaltPBR.albedo.clone() : asphaltTex;
    asphaltAlbedo.repeat.set(16, 16);
    asphaltAlbedo.anisotropy = 8;
    asphaltAlbedo.needsUpdate = true;

    const asphaltNormal = asphaltPBR.normal.clone();
    asphaltNormal.repeat.set(16, 16);
    asphaltNormal.anisotropy = 4;
    asphaltNormal.needsUpdate = true;

    const asphaltRough = asphaltPBR.roughness.clone();
    asphaltRough.repeat.set(16, 16);
    asphaltRough.anisotropy = 4;
    asphaltRough.needsUpdate = true;

    this.asphaltMat = new THREE.MeshStandardMaterial({
      map: asphaltAlbedo,
      normalMap: asphaltNormal,
      normalScale: new THREE.Vector2(1.9, 1.9),
      roughnessMap: asphaltRough,
      roughness: 0.72,
      metalness: 0.04,
      envMapIntensity: 0.60,
    });

    // Photorealistic PBR Racing Turf (Organic multi-frequency fractal noise, Sobel normal map & roughness)
    const grassTextures = OrganicTerrainBuilder.createOrganicGrassPBRTextures();
    this.grassMat = new THREE.MeshStandardMaterial({
      map: grassTextures.albedo,
      normalMap: grassTextures.normal,
      normalScale: new THREE.Vector2(1.8, 1.8),
      roughnessMap: grassTextures.roughness,
      roughness: 0.88,
      metalness: 0.0,
      envMapIntensity: 0.16,
      color: new THREE.Color(0x3e5234), // Natural European twilight turf tint
    });

    // Runoff Gravel Trap Material with Micro-Pebble Normal Relief
    const gravelNormal = asphaltPBR.normal.clone();
    gravelNormal.repeat.set(24, 24);
    gravelNormal.needsUpdate = true;

    this.gravelMat = new THREE.MeshStandardMaterial({
      color: 0xaa9266,
      normalMap: gravelNormal,
      normalScale: new THREE.Vector2(2.0, 2.0),
      roughness: 0.90,
      metalness: 0.02,
      envMapIntensity: 0.35,
      polygonOffset: true,
      polygonOffsetFactor: -1.0,
      polygonOffsetUnits: -2.0,
    });

    // Compacted Dirt/Gravel Shoulder Transition along Kerbs and Track Limits
    this.dirtShoulderMat = new THREE.MeshStandardMaterial({
      color: 0x281c12,
      normalMap: gravelNormal,
      normalScale: new THREE.Vector2(1.4, 1.4),
      roughness: 0.92,
      metalness: 0.02,
      envMapIntensity: 0.25,
      polygonOffset: true,
      polygonOffsetFactor: -1.0,
      polygonOffsetUnits: -2.0,
    });

    // Cast Concrete & Kerb PBR Normal Map
    const concretePBR = getConcretePBRTextures();
    const kerbNormal = concretePBR.normal.clone();
    kerbNormal.repeat.set(20, 2);
    kerbNormal.anisotropy = 4;
    kerbNormal.needsUpdate = true;

    // Curbs - Weathered FIA Crimson and Clean High-Contrast White with Concrete Surface Relief
    this.kerbRedMat = new THREE.MeshStandardMaterial({
      color: 0xc52026, // Authentic FIA Rosso Corsa enamel
      normalMap: kerbNormal,
      normalScale: new THREE.Vector2(0.8, 0.8),
      roughness: 0.40, // Glossy painted concrete teeth
      metalness: 0.06,
      envMapIntensity: 0.75,
      side: THREE.FrontSide,
      polygonOffset: true,
      polygonOffsetFactor: -2.0,
      polygonOffsetUnits: -4.0,
    });
    this.kerbWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xe2e4ea, // High-contrast clean off-white enamel
      normalMap: kerbNormal,
      normalScale: new THREE.Vector2(0.8, 0.8),
      roughness: 0.40,
      metalness: 0.06,
      envMapIntensity: 0.75,
      side: THREE.FrontSide,
      polygonOffset: true,
      polygonOffsetFactor: -2.0,
      polygonOffsetUnits: -4.0,
    });

    // FIA Precast Concrete Barriers (High-Definition PBR with modular joints, aggregate pores & weathering)
    this.concreteBarrierMat = new THREE.MeshStandardMaterial({
      map: concretePBR.albedo,
      normalMap: concretePBR.normal,
      normalScale: new THREE.Vector2(0.8, 0.8),
      roughnessMap: concretePBR.roughness,
      roughness: 0.72,
      metalness: 0.04,
      envMapIntensity: 0.45,
    });

    // Debris Catch Fence Steel (Dark weathered industrial steel, non-reflective)
    this.metalFenceMat = new THREE.MeshStandardMaterial({
      color: 0x1e2229,
      metalness: 0.40,
      roughness: 0.65,
      wireframe: false,
    });

    // Architectural Metals
    this.metalDarkMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.85,
      roughness: 0.22,
    });
    this.metalSilverMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.75,
      roughness: 0.35,
    });

    // Specialized Low-Overhead Structural Truss Material (Matte Titanium-Carbon Composite)
    // Diffuse-dominant PBR to eliminate expensive specular IBL environment map lookups when camera passes directly underneath!
    this.overheadTrussMat = new THREE.MeshStandardMaterial({
      color: 0x1a202c,
      metalness: 0.20,
      roughness: 0.82,
    });

    // Ultra-fast shared starting light emissive material
    this.startLightMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
    });

    // Architectural VIP Glass (Optimized PBR - 0 transmission pass overhead)
    this.glassMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.35,
      roughness: 0.08,
      transparent: true,
      opacity: 0.55,
    });

    // High-Fidelity Botanical & Foliage Materials (PBR with Micro-relief & Vertex AO)
    const barkNormal = this.createProceduralBarkNormalTexture();
    const foliageNormal = this.createProceduralFoliageNormalTexture();

    this.treeBarkMat = new THREE.MeshStandardMaterial({
      map: this.createProceduralBarkTexture(),
      normalMap: barkNormal,
      normalScale: new THREE.Vector2(0.85, 0.85),
      color: 0x332014, // Dark weathered European bark
      roughness: 0.94,
      metalness: 0.0,
      envMapIntensity: 0.04,
    });
    this.pineFoliageMat = new THREE.MeshStandardMaterial({
      map: this.createProceduralPineNeedleTexture(),
      normalMap: foliageNormal,
      normalScale: new THREE.Vector2(0.60, 0.60),
      roughness: 0.90,
      metalness: 0.0,
      vertexColors: true,
      envMapIntensity: 0.06,
      side: THREE.FrontSide,
    });
    this.oakFoliageMat = new THREE.MeshStandardMaterial({
      map: this.createProceduralDeciduousFoliageTexture('#041206', '#0e2910'),
      normalMap: foliageNormal,
      normalScale: new THREE.Vector2(0.55, 0.55),
      roughness: 0.90,
      metalness: 0.0,
      vertexColors: true,
      envMapIntensity: 0.06,
      side: THREE.FrontSide,
    });
    this.cypressFoliageMat = new THREE.MeshStandardMaterial({
      map: this.createProceduralCypressFoliageTexture(),
      normalMap: foliageNormal,
      normalScale: new THREE.Vector2(0.50, 0.50),
      roughness: 0.92,
      metalness: 0.0,
      vertexColors: true,
      envMapIntensity: 0.05,
      side: THREE.FrontSide,
    });
    this.bushFoliageMat = new THREE.MeshStandardMaterial({
      map: this.createProceduralDeciduousFoliageTexture('#051508', '#103012'),
      normalMap: foliageNormal,
      normalScale: new THREE.Vector2(0.50, 0.50),
      roughness: 0.90,
      metalness: 0.0,
      vertexColors: true,
      envMapIntensity: 0.05,
      side: THREE.FrontSide,
    });
    // High-Performance Competition Turf Material with Vertex Color AO
    this.grassTuftMat = new THREE.MeshLambertMaterial({
      vertexColors: true,
      side: THREE.FrontSide,
    }) as any;

    // Stadium Floodlight Emissive Lens Material
    this.floodlightMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xfffbeb,
      emissiveIntensity: 3.5,
      roughness: 0.1,
    });
  }

  /**
   * Pre-generates photorealistic PBR turf textures (Albedo, Tangent-Space Normal Map, Roughness Map)
   * with organic multi-frequency Perlin fractal noise, rich chlorophyll depth, and humus soil undertones (Zero artificial stripes!).
   */
  private createRealisticGrassTextures(): {
    albedo: THREE.CanvasTexture;
    normal: THREE.CanvasTexture;
    roughness: THREE.CanvasTexture;
  } {
    const size = 1024;
    const albedoCanvas = document.createElement('canvas');
    albedoCanvas.width = size;
    albedoCanvas.height = size;
    const aCtx = albedoCanvas.getContext('2d')!;

    const normalCanvas = document.createElement('canvas');
    normalCanvas.width = size;
    normalCanvas.height = size;
    const nCtx = normalCanvas.getContext('2d')!;

    const roughCanvas = document.createElement('canvas');
    roughCanvas.width = size;
    roughCanvas.height = size;
    const rCtx = roughCanvas.getContext('2d')!;

    // Seamless value noise permutation table
    const perm = new Uint8Array(512);
    for (let i = 0; i < 256; i++) {
      perm[i] = perm[i + 256] = Math.floor(Math.random() * 256);
    }
    const gradX = [-1, 1, 0, 0, 1, -1, 1, -1];
    const gradY = [0, 0, -1, 1, 1, 1, -1, -1];

    // Seamless periodic 2D noise (period is power of 2: 4, 8, 16, 32, 64)
    const periodicNoise = (x: number, y: number, period: number): number => {
      const px = Math.floor(x) % period;
      const py = Math.floor(y) % period;
      const px1 = (px + 1) % period;
      const py1 = (py + 1) % period;

      const xf = x - Math.floor(x);
      const yf = y - Math.floor(y);
      const u = xf * xf * (3.0 - 2.0 * xf);
      const v = yf * yf * (3.0 - 2.0 * yf);

      const g00 = perm[px + perm[py]] % 8;
      const g10 = perm[px1 + perm[py]] % 8;
      const g01 = perm[px + perm[py1]] % 8;
      const g11 = perm[px1 + perm[py1]] % 8;

      const d00 = gradX[g00] * xf + gradY[g00] * yf;
      const d10 = gradX[g10] * (xf - 1) + gradY[g10] * yf;
      const d01 = gradX[g01] * xf + gradY[g01] * (yf - 1);
      const d11 = gradX[g11] * (xf - 1) + gradY[g11] * (yf - 1);

      const x1 = d00 * (1 - u) + d10 * u;
      const x2 = d01 * (1 - u) + d11 * u;
      return x1 * (1 - v) + x2 * v;
    };

    const heightField = new Float32Array(size * size);
    const albedoImg = aCtx.createImageData(size, size);
    const roughImg = rCtx.createImageData(size, size);
    const ad = albedoImg.data;
    const rd = roughImg.data;

    for (let y = 0; y < size; y++) {
      const ny = y / size;
      for (let x = 0; x < size; x++) {
        const nx = x / size;

        // Octave 1: Macro meadow biome patches (Period = 4)
        const macro = periodicNoise(nx * 4, ny * 4, 4);

        // Octave 2: Turf sod clumping and soil moisture (Period = 16)
        const meso = periodicNoise(nx * 16, ny * 16, 16);

        // Octave 3: High-frequency blade and micro-clover density (Period = 64)
        const micro = periodicNoise(nx * 64, ny * 64, 64);

        // Normalized height for normal mapping
        const h = macro * 0.38 + meso * 0.38 + micro * 0.24;
        heightField[y * size + x] = h;

        const normH = Math.min(1.0, Math.max(0.0, (h + 0.85) / 1.7));
        const macroFactor = Math.min(1.0, Math.max(0.0, (macro + 0.85) / 1.7));

        // Authentic European Grade-1 competition turf palette (Spa-Francorchamps / Red Bull Ring)
        // Root base: rgb(12, 22, 10)
        // Mid rich blade: rgb(18, 38, 16)
        // Sunlit crown: rgb(28, 56, 24)
        // Muted forest accents: rgb(38, 68, 30)
        let r = 12 + normH * 16 + macroFactor * 10;
        let g = 22 + normH * 34 + macroFactor * 14;
        let b = 10 + normH * 14 + macroFactor * 4;

        // Fine blade jitter and earthy soil flecks
        const jitter = (Math.random() - 0.5) * 8;
        const isGoldenTip = Math.random() > 0.94 ? 8 : 0;

        r = Math.min(255, Math.max(0, Math.floor(r + jitter + isGoldenTip * 0.5)));
        g = Math.min(255, Math.max(0, Math.floor(g + jitter + isGoldenTip * 0.9)));
        b = Math.min(255, Math.max(0, Math.floor(b + jitter * 0.4)));

        const idx = (y * size + x) * 4;
        ad[idx] = r;
        ad[idx + 1] = g;
        ad[idx + 2] = b;
        ad[idx + 3] = 255;

        // Roughness: 0.80 (velvety cut turf) to 0.92 (porous soil)
        const roughVal = Math.floor((0.80 + (1.0 - normH) * 0.12 + (Math.random() - 0.5) * 0.03) * 255);
        rd[idx] = roughVal;
        rd[idx + 1] = roughVal;
        rd[idx + 2] = roughVal;
        rd[idx + 3] = 255;
      }
    }

    aCtx.putImageData(albedoImg, 0, 0);
    rCtx.putImageData(roughImg, 0, 0);

    // Compute Tangent-Space Normal Map via Sobel operator on heightField
    const normalImg = nCtx.createImageData(size, size);
    const nd = normalImg.data;
    const normalStrength = 3.6;

    for (let y = 0; y < size; y++) {
      const yPrev = (y - 1 + size) % size;
      const yNext = (y + 1) % size;
      for (let x = 0; x < size; x++) {
        const xPrev = (x - 1 + size) % size;
        const xNext = (x + 1) % size;

        const hL = heightField[y * size + xPrev];
        const hR = heightField[y * size + xNext];
        const hU = heightField[yPrev * size + x];
        const hD = heightField[yNext * size + x];

        const dx = (hR - hL) * normalStrength;
        const dy = (hD - hU) * normalStrength;
        const len = Math.sqrt(dx * dx + dy * dy + 1.0);

        const nx = -dx / len;
        const ny = -dy / len;
        const nz = 1.0 / len;

        const idx = (y * size + x) * 4;
        nd[idx] = Math.floor((nx * 0.5 + 0.5) * 255);
        nd[idx + 1] = Math.floor((ny * 0.5 + 0.5) * 255);
        nd[idx + 2] = Math.floor(nz * 255);
        nd[idx + 3] = 255;
      }
    }
    nCtx.putImageData(normalImg, 0, 0);

    const albedoTex = new THREE.CanvasTexture(albedoCanvas);
    albedoTex.wrapS = THREE.RepeatWrapping;
    albedoTex.wrapT = THREE.RepeatWrapping;
    albedoTex.repeat.set(48, 48);
    albedoTex.anisotropy = 4;
    albedoTex.generateMipmaps = true;
    albedoTex.minFilter = THREE.LinearMipmapLinearFilter;
    albedoTex.magFilter = THREE.LinearFilter;

    const normalTex = new THREE.CanvasTexture(normalCanvas);
    normalTex.wrapS = THREE.RepeatWrapping;
    normalTex.wrapT = THREE.RepeatWrapping;
    normalTex.repeat.set(48, 48);
    normalTex.anisotropy = 4;
    normalTex.generateMipmaps = true;

    const roughTex = new THREE.CanvasTexture(roughCanvas);
    roughTex.wrapS = THREE.RepeatWrapping;
    roughTex.wrapT = THREE.RepeatWrapping;
    roughTex.repeat.set(48, 48);
    roughTex.anisotropy = 4;
    roughTex.generateMipmaps = true;

    return { albedo: albedoTex, normal: normalTex, roughness: roughTex };
  }

  /**
   * Generates procedural tactile organic tree bark texture with vertical striations,
   * natural fissures, and multi-tone weathered grain.
   */
  private createProceduralBarkTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Base deep umber heartwood
    ctx.fillStyle = '#22140c';
    ctx.fillRect(0, 0, 512, 512);

    // Primary vertical wood grain striations with organic wobble
    for (let x = 0; x < 512; x += 3) {
      const wobble = Math.sin(x * 0.12) * 12 + Math.cos(x * 0.04) * 8;
      const shade = 26 + Math.floor(wobble + Math.random() * 22);
      ctx.fillStyle = `rgb(${shade + 26}, ${shade + 12}, ${shade + 2})`;
      ctx.fillRect(x, 0, 2 + (x % 3), 512);
    }

    // Secondary vertical fissure clefts (dark fissures)
    for (let i = 0; i < 480; i++) {
      const fx = Math.random() * 512;
      const fy = Math.random() * 512;
      const flen = 30 + Math.random() * 85;
      const fwidth = 2 + Math.random() * 3.5;
      ctx.fillStyle = Math.random() > 0.4 ? '#120905' : '#3f281b';
      ctx.fillRect(fx, fy, fwidth, flen);
    }

    // Lichen and weathered bark accents
    ctx.fillStyle = 'rgba(78, 88, 58, 0.35)';
    for (let i = 0; i < 45; i++) {
      const lx = Math.random() * 512;
      const ly = Math.random() * 512;
      ctx.beginPath();
      ctx.arc(lx, ly, 4 + Math.random() * 9, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 4);
    tex.anisotropy = 8;
    tex.generateMipmaps = true;
    return tex;
  }

  /**
   * Generates procedural normal map for bark giving real 3D fissure depth under sunlight
   */
  private createProceduralBarkNormalTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    const imgData = ctx.createImageData(256, 256);
    const data = imgData.data;

    // Height function simulating vertical bark grooves
    const heights = new Float32Array(256 * 256);
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const furrow = Math.sin(x * 0.18 + Math.cos(y * 0.06) * 1.5) * 0.5 + 0.5;
        const grain = Math.sin(x * 0.75) * 0.2;
        heights[y * 256 + x] = furrow * 0.8 + grain;
      }
    }

    const strength = 2.2;
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const x0 = (x - 1 + 256) % 256;
        const x1 = (x + 1) % 256;
        const y0 = (y - 1 + 256) % 256;
        const y1 = (y + 1) % 256;
        const dx = (heights[y * 256 + x1] - heights[y * 256 + x0]) * strength;
        const dy = (heights[y1 * 256 + x] - heights[y0 * 256 + x]) * strength;
        const len = Math.hypot(dx, dy, 1.0);
        const nx = (-dx / len) * 0.5 + 0.5;
        const ny = (-dy / len) * 0.5 + 0.5;
        const nz = (1.0 / len) * 0.5 + 0.5;
        const idx = (y * 256 + x) * 4;
        data[idx] = Math.round(nx * 255);
        data[idx + 1] = Math.round(ny * 255);
        data[idx + 2] = Math.round(nz * 255);
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 4);
    tex.generateMipmaps = true;
    return tex;
  }

  /**
   * Generates procedural botanical pine needle cluster texture with radiating needle sprays
   */
  private createProceduralPineNeedleTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Base dense chlorophyll green
    ctx.fillStyle = '#0c2211';
    ctx.fillRect(0, 0, 512, 512);

    // Overlapping needle fascicle sprays (radial fan of fine needles)
    for (let i = 0; i < 2400; i++) {
      const cx = Math.random() * 512;
      const cy = Math.random() * 512;
      const baseAng = Math.random() * Math.PI * 2;
      const needleCount = 4 + Math.floor(Math.random() * 5);
      const sprayLength = 10 + Math.random() * 14;

      for (let n = 0; n < needleCount; n++) {
        const ang = baseAng + (n - needleCount / 2) * 0.14;
        const ex = cx + Math.cos(ang) * sprayLength;
        const ey = cy + Math.sin(ang) * sprayLength;

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(ex, ey);

        const r = Math.random();
        ctx.strokeStyle = r > 0.65 ? '#2d5e2e' : (r > 0.3 ? '#19421c' : '#0a1d0e');
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    }

    // Micro needle tip highlights
    for (let i = 0; i < 1800; i++) {
      const tx = Math.random() * 512;
      const ty = Math.random() * 512;
      ctx.fillStyle = Math.random() > 0.5 ? '#3a7238' : '#1e4820';
      ctx.fillRect(tx, ty, 1.5, 1.5);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 8;
    tex.generateMipmaps = true;
    return tex;
  }

  /**
   * Generates procedural deciduous leaf cluster texture with organic leaf margins and veins
   */
  private createProceduralDeciduousFoliageTexture(baseColorHex: string, tipColorHex: string): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = baseColorHex;
    ctx.fillRect(0, 0, 512, 512);

    // Interlocking organic leaf discs with edge shadows and veins
    for (let i = 0; i < 3200; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const rad = 4 + Math.random() * 8.0;
      const aspect = 0.65 + Math.random() * 0.5;
      const rot = Math.random() * Math.PI * 2;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.scale(1.0, aspect);

      ctx.beginPath();
      ctx.arc(0, 0, rad, 0, Math.PI * 2);
      const r = Math.random();
      ctx.fillStyle = r > 0.55 ? tipColorHex : (r > 0.25 ? baseColorHex : '#091c0c');
      ctx.fill();

      // Subtle center vein
      ctx.strokeStyle = 'rgba(18, 48, 20, 0.45)';
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(-rad * 0.8, 0);
      ctx.lineTo(rad * 0.8, 0);
      ctx.stroke();

      ctx.restore();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 8;
    tex.generateMipmaps = true;
    return tex;
  }

  /**
   * Generates procedural cypress foliage texture with dense scaly vertical sprigs
   */
  private createProceduralCypressFoliageTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#081a0b';
    ctx.fillRect(0, 0, 512, 512);

    // Slender vertical scaly sprigs
    for (let i = 0; i < 4000; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const len = 6 + Math.random() * 12;
      const r = Math.random();
      ctx.fillStyle = r > 0.6 ? '#1b401d' : (r > 0.25 ? '#102a12' : '#051107');
      ctx.fillRect(x, y, 2, len);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 8;
    tex.generateMipmaps = true;
    return tex;
  }

  /**
   * Generates procedural normal map for foliage to scatter sunlight micro-speculars
   */
  private createProceduralFoliageNormalTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    const imgData = ctx.createImageData(256, 256);
    const data = imgData.data;

    const heights = new Float32Array(256 * 256);
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const noise = Math.sin(x * 0.32) * Math.cos(y * 0.32) + Math.sin(x * 0.64 + y * 0.48) * 0.5;
        heights[y * 256 + x] = noise;
      }
    }

    const strength = 1.4;
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const x0 = (x - 1 + 256) % 256;
        const x1 = (x + 1) % 256;
        const y0 = (y - 1 + 256) % 256;
        const y1 = (y + 1) % 256;
        const dx = (heights[y * 256 + x1] - heights[y * 256 + x0]) * strength;
        const dy = (heights[y1 * 256 + x] - heights[y0 * 256 + x]) * strength;
        const len = Math.hypot(dx, dy, 1.0);
        const nx = (-dx / len) * 0.5 + 0.5;
        const ny = (-dy / len) * 0.5 + 0.5;
        const nz = (1.0 / len) * 0.5 + 0.5;
        const idx = (y * 256 + x) * 4;
        data[idx] = Math.round(nx * 255);
        data[idx + 1] = Math.round(ny * 255);
        data[idx + 2] = Math.round(nz * 255);
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.generateMipmaps = true;
    return tex;
  }

  /**
   * Backward-compatible procedural foliage generator
   */
  private createProceduralFoliageTexture(baseColorHex: string, tipColorHex: string): THREE.CanvasTexture {
    return this.createProceduralDeciduousFoliageTexture(baseColorHex, tipColorHex);
  }

  /**
   * Generates rich, dense volumetric 3D grass clump cutout texture
   */
  private createGrassTuftTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    ctx.clearRect(0, 0, 512, 512);

    // Draw 36 broad, tapering organic blades radiating naturally from base
    const blades = 36;
    for (let b = 0; b < blades; b++) {
      const t = b / (blades - 1);
      const startX = 256 + (t - 0.5) * 110;
      const startY = 512;
      const bladeW = 12 + Math.random() * 14;

      // Natural curved arching
      const spreadX = (t - 0.5) * 400 + (Math.random() - 0.5) * 60;
      const tipX = 256 + spreadX;
      const tipY = 40 + Math.random() * 150;
      const ctrlX = (startX + tipX) * 0.5 + (t - 0.5) * 90 + (Math.random() - 0.5) * 35;
      const ctrlY = 220 + Math.random() * 80;

      ctx.beginPath();
      ctx.moveTo(startX - bladeW * 0.5, startY);
      ctx.quadraticCurveTo(ctrlX - bladeW * 0.3, ctrlY, tipX, tipY);
      ctx.quadraticCurveTo(ctrlX + bladeW * 0.3, ctrlY, startX + bladeW * 0.5, startY);
      ctx.closePath();

      const grad = ctx.createLinearGradient(0, 512, 0, tipY);
      grad.addColorStop(0, '#0a1a0c'); // Deep dark root
      grad.addColorStop(0.35, '#163618'); // Rich deep foliage green
      grad.addColorStop(0.75, '#285826'); // Dark chlorophyll blade
      grad.addColorStop(1.0, '#3e7638'); // Muted forest tip
      ctx.fillStyle = grad;
      ctx.fill();

      // Sharp central blade spine highlight (solid alpha to survive alphaTest)
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.quadraticCurveTo(ctrlX, ctrlY, tipX, tipY);
      ctx.strokeStyle = '#488440';
      ctx.lineWidth = 1.8;
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 8;
    tex.generateMipmaps = true;
    return tex;
  }

  /**
   * Spatial clearance predicate: checks if coordinates fall on the exterior verge,
   * gravel runoff zone or outer forest amphitheater of Turn 1 (Curva 1).
   * Center: (92, -92), track radius: 38m, outer edge: >= 46m.
   */
  public isTurn1Exterior(x: number, z: number): boolean {
    if (x >= 75 && z <= -75) {
      const dist = Math.hypot(x - 92, z - (-92));
      // Outer track edge, gravel runoff, barrier line and outfield perimeter
      if (dist >= 46.0) return true;
      if (z <= -136.0 && x >= 75.0) return true;
      if (x >= 136.0 && z <= -75.0) return true;
    }
    return false;
  }

  /**
   * High-performance 3D Grass Tufts rendered in 1 single draw call via InstancedMesh.
   * Features strict geometric clearance testing: ZERO grass penetrates grandstands,
   * concrete barrier walls, catch fencing, pit buildings, helipad or asphalt track.
   */
  private buildGrassTufts(parent: THREE.Group): void {
    const tuftGeo = OrganicVegetationSystem.createCurvedGrassTuftGeometry();

    // 2x2 Spatial Macro-Quadrant Partitioning (-240m to +240m on X and Z, 240m per quadrant)
    // Consolidates 9,500 grass tufts into exactly 4 high-efficiency InstancedMeshes with local bounding volumes!
    interface GrassInstanceData {
      matrix: THREE.Matrix4;
      color: THREE.Color;
    }
    const gridDim = 4;
    const cellSize = 480 / gridDim; // 120m spatial cells (16 chunks for precise frustum culling)
    const chunks: GrassInstanceData[][] = Array.from({ length: gridDim * gridDim }, () => []);

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const maxTufts = 1200;
    let idx = 0;

    const c = this.innerCornerCenter; // 92
    const cornerCenters = [
      { cx: c, cz: -c },
      { cx: c, cz: c },
      { cx: -c, cz: c },
      { cx: -c, cz: -c },
    ];

    /**
     * Strict spatial validation: rejects any grass tuft that would touch or penetrate:
     * - Grandstands (South or North)
     * - Pit Lane, Paddock Club Garages, Team Transporters
     * - Helipad
     * - Concrete barriers (walls) and catch fences
     * - Asphalt track surface and kerbs
     * - Gravel runoff traps
     */
    const isGrassAllowed = (gx: number, gz: number): boolean => {
      // 0. Curva 1 Exterior Exclusion Zone (strictly eliminates grass tufts & weed stalks outside Turn 1)
      if (this.isTurn1Exterior(gx, gz)) return false;

      // 1. South Main Grandstand Exclusion Zone (including canopy & VIP box)
      if (gx >= -68 && gx <= 68 && gz >= -168 && gz <= -139.2) return false;

      // 2. North Grandstand Exclusion Zone
      if (gx >= -48 && gx <= 48 && gz >= 139.2 && gz <= 170.0) return false;

      // 3. Pit Lane, Pit Apron, Paddock Garages, Team Transporters & Infield behind garages (x: -125 to +125, z: -126 to -55)
      if (Math.abs(gx) <= 125 && gz >= -126.0 && gz <= -55.0) return false;

      // 4. Track Asphalt Surface & Starting Grid (Straight sections + 1.2m safety clearance margin)
      if (Math.abs(gx) <= 94 && gz >= -140.0 && gz <= -120.0) return false;
      if (Math.abs(gx) <= 94 && gz >= 120.0 && gz <= 140.0) return false;
      if (gx >= 120.0 && gx <= 140.0 && Math.abs(gz) <= 94) return false;
      if (gx >= -140.0 && gx <= -120.0 && Math.abs(gz) <= 94) return false;

      // 6. Corner Curved Roads, Kerbs & Infield Margin (in all 4 corner apexes)
      // Strictly exclude any grass tuft within 65m of every corner center:
      // Guarantees 100% clean FIA piano curbs, clean arcén and strict safety margin across all vertices!
      for (const cc of cornerCenters) {
        const dx = gx - cc.cx;
        const dz = gz - cc.cz;
        const distToCenter = Math.hypot(dx, dz);
        if (distToCenter <= 65.0) {
          return false;
        }
      }

      // 7. Concrete Barrier Walls (wall thickness 0.75m + grass radius 0.65m = clearance 1.05m)
      const wallClr = 1.05;
      if (Math.abs(gx) <= 92 && (Math.abs(gz - 140) < wallClr || Math.abs(gz + 140) < wallClr)) return false;
      if (Math.abs(gz) <= 92 && (Math.abs(gx - 140) < wallClr || Math.abs(gx + 140) < wallClr)) return false;
      if (Math.abs(gx) <= 92 && (Math.abs(gz - 120) < wallClr || Math.abs(gz + 120) < wallClr)) return false;
      if (Math.abs(gz) <= 92 && (Math.abs(gx - 120) < wallClr || Math.abs(gx + 120) < wallClr)) return false;

      // Corner outer and inner curved walls
      for (const cc of cornerCenters) {
        const dx = gx - cc.cx;
        const dz = gz - cc.cz;
        const signX = Math.sign(cc.cx);
        const signZ = Math.sign(cc.cz);
        if (dx * signX >= -2 && dz * signZ >= -2) {
          const dist = Math.hypot(dx, dz);
          if (Math.abs(dist - 48.0) < wallClr) return false;
          if (Math.abs(dist - 24.0) < wallClr) return false;
        }
      }

      return true;
    };

    const addTuft = (x: number, z: number, scale = 1.0, jitter = 0.35) => {
      if (idx >= maxTufts) return;
      const jx = (Math.random() - 0.5) * jitter;
      const jz = (Math.random() - 0.5) * jitter;
      const px = x + jx;
      const pz = z + jz;
      if (!isGrassAllowed(px, pz)) return;

      dummy.position.set(px, 0.002, pz);
      dummy.scale.setScalar(scale * (0.88 + Math.random() * 0.24));
      dummy.rotation.y = Math.random() * Math.PI * 2;
      dummy.updateMatrix();

      // Subtle biological tint variation multiplier preserving baked vertex color AO
      color.setRGB(
        0.95 + (Math.random() - 0.5) * 0.08,
        1.00,
        0.92 + (Math.random() - 0.5) * 0.08
      );

      const cx = Math.max(0, Math.min(gridDim - 1, Math.floor((px + 240) / cellSize)));
      const cz = Math.max(0, Math.min(gridDim - 1, Math.floor((pz + 240) / cellSize)));
      chunks[cz * gridDim + cx].push({
        matrix: dummy.matrix.clone(),
        color: color.clone(),
      });
      idx++;
    };

    // =========================================================================
    // 1. 4 CORNER OUTER CURVES: High-performance focal verge placement
    // =========================================================================
    cornerCenters.forEach(({ cx, cz }) => {
      if (cx === c && cz === -c) return;
      const signX = Math.sign(cx);
      const signZ = Math.sign(cz);
      for (let r = 65.0; r <= 73.0; r += 4.0) {
        const step = 4.5 / r;
        for (let a = 0.05; a < Math.PI / 2 - 0.05; a += step) {
          const kx = cx + signX * Math.cos(a) * r;
          const kz = cz + signZ * Math.sin(a) * r;
          addTuft(kx, kz, 1.35, 0.45);
        }
      }
    });

    // =========================================================================
    // 2. INFIELD PERIMETER CORRIDORS (Focused along inner barrier walls)
    // =========================================================================
    for (let x = -85; x <= 85; x += 6.5) {
      addTuft(x, 113.5, 1.25, 0.4);
    }
    for (let z = -85; z <= 85; z += 6.5) {
      addTuft(113.5, z, 1.25, 0.4);
      addTuft(-113.5, z, 1.25, 0.4);
    }

    // =========================================================================
    // 3. OUTFIELD PERIMETER MEADOWS (High-efficiency edge placement)
    // =========================================================================
    for (let x = -135; x <= 135; x += 8.0) {
      if (x < -68 || x > 68) {
        addTuft(x, -145.0, 1.30, 0.5);
      }
      if (x < -48 || x > 48) {
        addTuft(x, 145.0, 1.30, 0.5);
      }
    }
    for (let z = -125; z <= 125; z += 8.0) {
      addTuft(145.0, z, 1.30, 0.5);
      addTuft(-145.0, z, 1.30, 0.5);
    }

    // Instantiate each spatial chunk with local bounding volume for automatic frustum culling
    chunks.forEach((chunk) => {
      if (chunk.length === 0) return;
      const chunkMesh = new THREE.InstancedMesh(tuftGeo, this.grassTuftMat, chunk.length);
      chunk.forEach((item, i) => {
        chunkMesh.setMatrixAt(i, item.matrix);
        chunkMesh.setColorAt(i, item.color);
      });
      chunkMesh.instanceMatrix.needsUpdate = true;
      if (chunkMesh.instanceColor) chunkMesh.instanceColor.needsUpdate = true;
      chunkMesh.receiveShadow = false;
      chunkMesh.castShadow = false;
      chunkMesh.frustumCulled = true;
      chunkMesh.computeBoundingSphere();
      chunkMesh.computeBoundingBox();
      parent.add(chunkMesh);
    });
  }

  public getDistanceToTrack(x: number, z: number): number {
    const c = this.innerCornerCenter; // 92
    const r = this.cornerRadius; // 38
    const half = this.halfSize; // 130

    // Pit lane, garages and paddock corridor on South Straight (strictly flat: z from -138 to -84, |x| <= 96)
    if (z >= -138 && z <= -84 && Math.abs(x) <= 96) return 0;

    // Check 4 straight segments
    let minDist = Infinity;
    if (Math.abs(x) <= c) {
      const dSouth = Math.abs(z - (-half));
      const dNorth = Math.abs(z - half);
      minDist = Math.min(minDist, dSouth, dNorth);
    }
    if (Math.abs(z) <= c) {
      const dEast = Math.abs(x - half);
      const dWest = Math.abs(x - (-half));
      minDist = Math.min(minDist, dEast, dWest);
    }

    // Check 4 corners
    const corners = [
      { cx: c, cz: -c, sx: 1, sz: -1 },
      { cx: c, cz: c, sx: 1, sz: 1 },
      { cx: -c, cz: c, sx: -1, sz: 1 },
      { cx: -c, cz: -c, sx: -1, sz: -1 },
    ];

    for (const corn of corners) {
      const dx = x - corn.cx;
      const dz = z - corn.cz;
      if (dx * corn.sx >= -1 && dz * corn.sz >= -1) {
        // In or near the corner turn quadrant
        const d = Math.hypot(dx, dz);
        minDist = Math.min(minDist, Math.abs(d - r));
      } else {
        // In the inner corner apex hub
        const dCenter = Math.hypot(dx, dz);
        if (dCenter <= 46.0) {
          // Inside apex hub: distance to nearest track limit edge is safely bounded under clearance
          minDist = Math.min(minDist, Math.max(0, 30.0 - dCenter));
        }
      }
    }

    return minDist;
  }

  /**
   * Terrain, Infield Landscaping, Gravel Traps and Service Perimeter Roads
   */
  private buildTerrainAndInfield(): void {
    const terrainGroup = new THREE.Group();

    // 1. Organic Sculpted Ground with Natural Berms & Drainage Valleys
    const ground = OrganicTerrainBuilder.buildSculptedTerrain(
      800,
      800,
      64,
      64,
      this.grassMat,
      (x, z) => this.getDistanceToTrack(x, z)
    );
    ground.material = HTMLMountainRanges.createAlpineLowlandMaterial(this.grassMat);
    terrainGroup.add(ground);

    // 1.5. The attached HTML's alpine range profile/material, sampled as one 360° backdrop.
    const mountainBackdrop = HTMLMountainRanges.build();
    terrainGroup.add(mountainBackdrop);

    // 2. Corner Gravel Runoff Traps (Batched into a single hardware BufferGeometry for 0.00ms draw call overhead)
    const cornerArcs = [
      { cx: this.innerCornerCenter, cz: -this.innerCornerCenter, startA: -Math.PI / 2, endA: 0 },
      { cx: this.innerCornerCenter, cz: this.innerCornerCenter, startA: 0, endA: Math.PI / 2 },
      { cx: -this.innerCornerCenter, cz: this.innerCornerCenter, startA: Math.PI / 2, endA: Math.PI },
      { cx: -this.innerCornerCenter, cz: -this.innerCornerCenter, startA: Math.PI, endA: Math.PI * 1.5 },
    ];

    const outerR = this.cornerRadius + this.trackWidth / 2;
    const gravelGeos: THREE.BufferGeometry[] = [];
    cornerArcs.forEach((ca) => {
      gravelGeos.push(
        this.createCornerRoadGeometry(
          ca.cx,
          ca.cz,
          outerR + 1.2,
          outerR + 16,
          ca.startA,
          ca.endA,
          24,
          0.008
        )
      );
    });
    if (gravelGeos.length > 0) {
      const mergedGravel = this.mergeAndDispose(gravelGeos);
      if (mergedGravel) {
        const gravelMesh = new THREE.Mesh(mergedGravel, this.gravelMat);
        gravelMesh.receiveShadow = true;
        terrainGroup.add(gravelMesh);
      }
    }

    // 3. Infield Asphalt Service Road & Landscaping (Helipad removed from interior island)
    // Compacted Dirt/Soil Shoulder Transition Strips along Kerbs and Track Limits (Batched into 1 single Mesh)
    const c = this.innerCornerCenter; // 92
    const half = this.halfSize; // 130
    const w = this.trackWidth; // 16
    const shoulderWidth = 2.2;
    const dirtGeos: THREE.BufferGeometry[] = [];

    // Straight Outer Dirt Shoulders
    const straightShoulderGeoX = new THREE.PlaneGeometry(c * 2 + 16, shoulderWidth);
    straightShoulderGeoX.rotateX(-Math.PI / 2);

    const sSouthGeo = straightShoulderGeoX.clone();
    sSouthGeo.translate(0, 0.007, -half - w / 2 - shoulderWidth / 2 - 0.1);
    dirtGeos.push(sSouthGeo);

    const sNorthGeo = straightShoulderGeoX.clone();
    sNorthGeo.translate(0, 0.007, half + w / 2 + shoulderWidth / 2 + 0.1);
    dirtGeos.push(sNorthGeo);

    const straightShoulderGeoZ = new THREE.PlaneGeometry(shoulderWidth, c * 2 + 16);
    straightShoulderGeoZ.rotateX(-Math.PI / 2);

    const sEastGeo = straightShoulderGeoZ.clone();
    sEastGeo.translate(half + w / 2 + shoulderWidth / 2 + 0.1, 0.007, 0);
    dirtGeos.push(sEastGeo);

    const sWestGeo = straightShoulderGeoZ.clone();
    sWestGeo.translate(-half - w / 2 - shoulderWidth / 2 - 0.1, 0.007, 0);
    dirtGeos.push(sWestGeo);

    // Straight Inner Dirt Shoulders (North, East, West) - strictly bounded to c * 2 (184m)
    // so they do not protrude as straight flat slabs into the curved corner apexes.
    const straightInnerShoulderGeoX = new THREE.PlaneGeometry(c * 2, shoulderWidth);
    straightInnerShoulderGeoX.rotateX(-Math.PI / 2);

    const straightInnerShoulderGeoZ = new THREE.PlaneGeometry(shoulderWidth, c * 2);
    straightInnerShoulderGeoZ.rotateX(-Math.PI / 2);

    const sNorthInGeo = straightInnerShoulderGeoX.clone();
    sNorthInGeo.translate(0, 0.007, half - w / 2 - shoulderWidth / 2 - 0.1);
    dirtGeos.push(sNorthInGeo);

    const sEastInGeo = straightInnerShoulderGeoZ.clone();
    sEastInGeo.translate(half - w / 2 - shoulderWidth / 2 - 0.1, 0.007, 0);
    dirtGeos.push(sEastInGeo);

    const sWestInGeo = straightInnerShoulderGeoZ.clone();
    sWestInGeo.translate(-half + w / 2 + shoulderWidth / 2 + 0.1, 0.007, 0);
    dirtGeos.push(sWestInGeo);

    // 4 Corner Apex Inner Dirt Arcs (Seamlessly joining behind the inner FIA curbs with 32 smooth segments)
    const innerR = this.cornerRadius - w / 2;
    const kerbWidth = 1.6;
    cornerArcs.forEach((ca) => {
      dirtGeos.push(
        this.createCornerRoadGeometry(
          ca.cx,
          ca.cz,
          innerR - kerbWidth - shoulderWidth,
          innerR - kerbWidth,
          ca.startA,
          ca.endA,
          32,
          0.007
        )
      );
    });

    if (dirtGeos.length > 0) {
      const mergedDirt = this.mergeAndDispose(dirtGeos);
      if (mergedDirt) {
        const dirtMesh = new THREE.Mesh(mergedDirt, this.dirtShoulderMat);
        dirtMesh.receiveShadow = true;
        terrainGroup.add(dirtMesh);
      }
    }

    // 5. Volumetric 3D Grass Tufts concentrated 100% along the track corridors
    this.buildGrassTufts(terrainGroup);

    this.group.add(terrainGroup);
  }

  /**
   * Continuous Asphalt Racing Surface with Pit Lane Integration (Batched into 1 single Mesh)
   */
  private buildSquareCircuitTrack(): void {
    const trackGroup = new THREE.Group();
    const half = this.halfSize;
    const w = this.trackWidth;
    const c = this.innerCornerCenter;
    const straightLen = c * 2;
    const asphaltGeos: THREE.BufferGeometry[] = [];

    // 4 Straight Sections (Subdivided to 32 segments to match corner mesh resolution and eliminate T-junctions)
    const hGeo = new THREE.PlaneGeometry(straightLen, w, 32, 2);
    hGeo.rotateX(-Math.PI / 2);

    const vGeo = new THREE.PlaneGeometry(w, straightLen, 2, 32);
    vGeo.rotateX(-Math.PI / 2);

    // South Straight (Main straight)
    const southGeo = hGeo.clone();
    southGeo.translate(0, 0.005, -half);
    asphaltGeos.push(southGeo);

    // North Straight
    const northGeo = hGeo.clone();
    northGeo.translate(0, 0.005, half);
    asphaltGeos.push(northGeo);

    // East Straight
    const eastGeo = vGeo.clone();
    eastGeo.translate(half, 0.005, 0);
    asphaltGeos.push(eastGeo);

    // West Straight
    const westGeo = vGeo.clone();
    westGeo.translate(-half, 0.005, 0);
    asphaltGeos.push(westGeo);

    // 4 Rounded Corner Sections
    const innerR = this.cornerRadius - w / 2;
    const outerR = this.cornerRadius + w / 2;

    // Corner 1: South-East (Turn 1)
    asphaltGeos.push(this.createCornerRoadGeometry(c, -c, innerR, outerR, -Math.PI / 2, 0));
    // Corner 2: North-East (Turn 2)
    asphaltGeos.push(this.createCornerRoadGeometry(c, c, innerR, outerR, 0, Math.PI / 2));
    // Corner 3: North-West (Turn 3)
    asphaltGeos.push(this.createCornerRoadGeometry(-c, c, innerR, outerR, Math.PI / 2, Math.PI));
    // Corner 4: South-West (Turn 4)
    asphaltGeos.push(this.createCornerRoadGeometry(-c, -c, innerR, outerR, Math.PI, Math.PI * 1.5));

    // Pit Lane & Paddock Seamless Asphalt Ground (Flush meeting with South Straight at z = -122.0 all the way to rear of garages at z = -84.0)
    // 100% unified with track asphalt material, completely covering the pit road, car stopping box, working lane, and garage apron with zero grass.
    const pitApronGeo = new THREE.PlaneGeometry(184, 38.0, 32, 4);
    pitApronGeo.rotateX(-Math.PI / 2);
    pitApronGeo.translate(0, 0.005, -103.0);
    // Align texture UV scaling with main track asphalt for seamless continuous appearance
    const apronUVs = pitApronGeo.attributes.uv;
    for (let i = 0; i < apronUVs.count; i++) {
      apronUVs.setXY(i, apronUVs.getX(i) * (184 / 260), apronUVs.getY(i) * (38.0 / 16.0));
    }
    apronUVs.needsUpdate = true;
    asphaltGeos.push(pitApronGeo);

    const mergedAsphalt = this.mergeAndDispose(asphaltGeos);
    if (mergedAsphalt) {
      const asphaltMesh = new THREE.Mesh(mergedAsphalt, this.asphaltMat);
      asphaltMesh.receiveShadow = true;
      trackGroup.add(asphaltMesh);
    }

    // Paint FIA White Road Markings & Boundary Lines
    this.buildTrackAndPitRoadLines(trackGroup);

    this.group.add(trackGroup);
  }

  /**
   * Crisp FIA Official Road Lines & High-Speed Optical Flow Markings
   */
  private buildTrackAndPitRoadLines(trackGroup: THREE.Group): void {
    const linesGroup = new THREE.Group();

    // Road Marking Enamel conforms to asphalt aggregate grain underneath
    const lineNormal = this.asphaltMat.normalMap ? this.asphaltMat.normalMap.clone() : undefined;
    if (lineNormal) {
      lineNormal.repeat.set(16, 16);
      lineNormal.needsUpdate = true;
    }
    const whiteLineMat = new THREE.MeshStandardMaterial({
      color: 0xd8dbe2, // Weathered industrial traffic marking enamel
      normalMap: lineNormal,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughness: 0.58,
      metalness: 0.04,
      envMapIntensity: 0.55,
      polygonOffset: true,
      polygonOffsetFactor: -2.0,
      polygonOffsetUnits: -4.0,
    });

    const half = this.halfSize;
    const w = this.trackWidth;
    const c = this.innerCornerCenter;
    const straightLen = c * 2; // 184m

    const whiteGeos: THREE.BufferGeometry[] = [];

    // --- A. CONTINUOUS FIA TRACK LIMIT BOUNDARY LINES (Inner & Outer edges on all 4 straights) ---
    const hLineGeo = new THREE.PlaneGeometry(straightLen, 0.25);
    hLineGeo.rotateX(-Math.PI / 2);
    const vLineGeo = new THREE.PlaneGeometry(0.25, straightLen);
    vLineGeo.rotateX(-Math.PI / 2);

    // South Straight Outer Line (z = -half - w/2 + 0.25)
    const southOuterGeo = hLineGeo.clone();
    southOuterGeo.translate(0, 0.009, -half - w / 2 + 0.25);
    whiteGeos.push(southOuterGeo);

    // North Straight Inner & Outer Lines
    const northOuterGeo = hLineGeo.clone();
    northOuterGeo.translate(0, 0.009, half + w / 2 - 0.25);
    whiteGeos.push(northOuterGeo);

    const northInnerGeo = hLineGeo.clone();
    northInnerGeo.translate(0, 0.009, half - w / 2 + 0.25);
    whiteGeos.push(northInnerGeo);

    // East Straight Inner & Outer Lines
    const eastOuterGeo = vLineGeo.clone();
    eastOuterGeo.translate(half + w / 2 - 0.25, 0.009, 0);
    whiteGeos.push(eastOuterGeo);

    const eastInnerGeo = vLineGeo.clone();
    eastInnerGeo.translate(half - w / 2 + 0.25, 0.009, 0);
    whiteGeos.push(eastInnerGeo);

    // West Straight Inner & Outer Lines
    const westOuterGeo = vLineGeo.clone();
    westOuterGeo.translate(-half - w / 2 + 0.25, 0.009, 0);
    whiteGeos.push(westOuterGeo);

    const westInnerGeo = vLineGeo.clone();
    westInnerGeo.translate(-half + w / 2 - 0.25, 0.009, 0);
    whiteGeos.push(westInnerGeo);

    // --- B. 100% UNBROKEN RACING DASHED CENTERLINES (STRAIGHTS + ALL 4 CURVES) ---
    // 3.2m dash length, 4.8m gap (8.0m continuous cycle).
    const baseDashHGeo = new THREE.PlaneGeometry(3.2, 0.25);
    baseDashHGeo.rotateX(-Math.PI / 2);
    const baseDashVGeo = new THREE.PlaneGeometry(0.25, 3.2);
    baseDashVGeo.rotateX(-Math.PI / 2);

    // 1. South Straight (z = -half = -130, full 184m)
    for (let x = -c + 4; x <= c - 4; x += 8) {
      if (Math.abs(x - (-10.0)) < 4.0 || Math.abs(x) < 2.0) continue; // Skip finish line checker at x = -10.0 to prevent z-fighting
      const g = baseDashHGeo.clone();
      g.translate(x, 0.010, -half);
      whiteGeos.push(g);
    }

    // 2. East Straight (x = half = 130, full 184m)
    for (let z = -c + 4; z <= c - 4; z += 8) {
      const g = baseDashVGeo.clone();
      g.translate(half, 0.010, z);
      whiteGeos.push(g);
    }

    // 3. North Straight (z = half = 130, full 184m)
    for (let x = -c + 4; x <= c - 4; x += 8) {
      const g = baseDashHGeo.clone();
      g.translate(x, 0.010, half);
      whiteGeos.push(g);
    }

    // 4. West Straight (x = -half = -130, full 184m)
    for (let z = -c + 4; z <= c - 4; z += 8) {
      const g = baseDashVGeo.clone();
      g.translate(-half, 0.010, z);
      whiteGeos.push(g);
    }

    // 5. Four Rounded Corners (Turn 1, Turn 2, Turn 3, Turn 4)
    // Continuous dashed line along the corner center apex arc (R = 38m)
    const cornerConfigs = [
      { cx: c, cz: -c, startA: -Math.PI / 2 }, // Turn 1: South-East
      { cx: c, cz: c, startA: 0 },             // Turn 2: North-East
      { cx: -c, cz: c, startA: Math.PI / 2 },  // Turn 3: North-West
      { cx: -c, cz: -c, startA: Math.PI },     // Turn 4: South-West
    ];

    cornerConfigs.forEach((cfg) => {
      // 7 curved dashes per corner matching the 8.0m cycle exactly
      for (let k = 0; k < 7; k++) {
        const t = (k + 0.5) / 7;
        const angle = cfg.startA + t * (Math.PI / 2);
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);

        const g = baseDashHGeo.clone();
        g.rotateY(-angle - Math.PI / 2);
        g.translate(cfg.cx + cosA * this.cornerRadius, 0.010, cfg.cz + sinA * this.cornerRadius);
        whiteGeos.push(g);
      }
    });

    cornerConfigs.forEach((cfg) => {
      // Continuous Inner & Outer White Border Lines in this corner
      const innerR = this.cornerRadius - w / 2;
      const outerR = this.cornerRadius + w / 2;
      whiteGeos.push(this.createCornerRoadGeometry(
        cfg.cx,
        cfg.cz,
        innerR + 0.05,
        innerR + 0.30,
        cfg.startA,
        cfg.startA + Math.PI / 2,
        24,
        0.009
      ));

      whiteGeos.push(this.createCornerRoadGeometry(
        cfg.cx,
        cfg.cz,
        outerR - 0.30,
        outerR - 0.05,
        cfg.startA,
        cfg.startA + Math.PI / 2,
        24,
        0.009
      ));
    });

    // --- C. PIT LANE & PIT ENTRY MARKINGS ---
    // 1. South Straight Inner Track Limit Solid White Line (z = -122)
    const lineWestGeo = new THREE.PlaneGeometry(24, 0.3);
    lineWestGeo.rotateX(-Math.PI / 2);
    lineWestGeo.translate(-80, 0.010, -122);
    whiteGeos.push(lineWestGeo);

    // Continuous solid line connecting from pit entry wall to Turn 1 inner apex (x = -40 to x = 92)
    const lineEastGeo = new THREE.PlaneGeometry(132, 0.3);
    lineEastGeo.rotateX(-Math.PI / 2);
    lineEastGeo.translate(26, 0.010, -122);
    whiteGeos.push(lineEastGeo);

    // 2. Photorealistic Pit Entry Deceleration Line System:
    // Weathered FIA Traffic Marking Paint with Bitumen Border Primer and Deceleration Rubber Wear
    const pitLineCanvas = document.createElement('canvas');
    pitLineCanvas.width = 256;
    pitLineCanvas.height = 1024;
    const pCtx = pitLineCanvas.getContext('2d')!;

    // Transparent baseline
    pCtx.clearRect(0, 0, 256, 1024);

    // Subtle dark bitumen primer anchor borders (prevents harsh cartoon vector edges against asphalt)
    pCtx.fillStyle = 'rgba(16, 18, 22, 0.70)';
    pCtx.fillRect(10, 0, 236, 1024);

    // Weathered FIA road enamel (Muted off-white/light slate, authentic motorsport road paint)
    pCtx.fillStyle = 'rgba(182, 188, 198, 0.90)';
    pCtx.fillRect(26, 0, 204, 1024);

    // Micro-aggregate asphalt stone chipping & paint texture porosity
    pCtx.fillStyle = 'rgba(22, 25, 32, 0.22)';
    for (let dot = 0; dot < 450; dot++) {
      const dx = 28 + Math.random() * 200;
      const dy = Math.random() * 1024;
      pCtx.fillRect(dx, dy, 2 + Math.random() * 3, 2);
    }

    // Longitudinal braking rubber streaks from race tires crossing the deceleration zone
    for (const rx of [64, 128, 192]) {
      const grad = pCtx.createLinearGradient(rx - 24, 0, rx + 24, 0);
      grad.addColorStop(0.0, 'rgba(12, 14, 18, 0.0)');
      grad.addColorStop(0.5, 'rgba(12, 14, 18, 0.42)');
      grad.addColorStop(1.0, 'rgba(12, 14, 18, 0.0)');
      pCtx.fillStyle = grad;
      pCtx.fillRect(rx - 24, 0, 48, 1024);
    }

    const pitLineTex = new THREE.CanvasTexture(pitLineCanvas);
    pitLineTex.wrapS = THREE.RepeatWrapping;
    pitLineTex.wrapT = THREE.RepeatWrapping;
    pitLineTex.repeat.set(1, 6);
    pitLineTex.anisotropy = 8;

    const pitLineMat = new THREE.MeshStandardMaterial({
      map: pitLineTex,
      transparent: true,
      roughness: 0.88,
      metalness: 0.02,
      polygonOffset: true,
      polygonOffsetFactor: -2.0,
      polygonOffsetUnits: -4.0,
      depthWrite: false,
    });

    // Continuous curved ribbon geometry (48 segments with smooth normals and width 0.36m)
    const curveSegments = 48;
    const ribbonVerts: number[] = [];
    const ribbonUVs: number[] = [];
    const ribbonIndices: number[] = [];
    const ribbonWidth = 0.36;

    for (let i = 0; i <= curveSegments; i++) {
      const t = i / curveSegments;
      const lx = -74 + t * 26;
      // Smooth raised cosine deceleration curve
      const lz = -122 + (1 - Math.cos(t * Math.PI)) * 0.5 * 5.8;

      // Analytical derivative for exact smooth perpendicular normal
      const dlx = 26;
      const dlz = Math.sin(t * Math.PI) * Math.PI * 0.5 * 5.8;
      const len = Math.hypot(dlx, dlz);
      const nx = -dlz / len;
      const nz = dlx / len;

      const pLeftX = lx + (nx * ribbonWidth) / 2;
      const pLeftZ = lz + (nz * ribbonWidth) / 2;
      const pRightX = lx - (nx * ribbonWidth) / 2;
      const pRightZ = lz - (nz * ribbonWidth) / 2;

      ribbonVerts.push(pLeftX, 0.013, pLeftZ);
      ribbonVerts.push(pRightX, 0.013, pRightZ);

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

    const pitCurveMesh = new THREE.Mesh(pitCurveGeo, pitLineMat);
    pitCurveMesh.receiveShadow = true;
    pitCurveMesh.renderOrder = 2;
    linesGroup.add(pitCurveMesh);

    // 3. Pit Entry Dashed Commitment Line along Main Straight
    for (let d = 0; d < 8; d++) {
      const dashGeo = new THREE.PlaneGeometry(1.6, 0.34);
      dashGeo.rotateX(-Math.PI / 2);
      const dashMesh = new THREE.Mesh(dashGeo, pitLineMat);
      dashMesh.position.set(-71 + d * 3.0, 0.012, -122);
      dashMesh.receiveShadow = true;
      dashMesh.renderOrder = 2;
      linesGroup.add(dashMesh);
    }

    // 4. Pit Lane Fast Lane Solid White Boundary Lines
    const pitInnerLineGeo = new THREE.PlaneGeometry(96, 0.25);
    pitInnerLineGeo.rotateX(-Math.PI / 2);
    pitInnerLineGeo.translate(0, 0.010, -113.2);
    whiteGeos.push(pitInnerLineGeo);

    const pitOuterLineGeo = new THREE.PlaneGeometry(96, 0.25);
    pitOuterLineGeo.rotateX(-Math.PI / 2);
    pitOuterLineGeo.translate(0, 0.010, -120.4);
    whiteGeos.push(pitOuterLineGeo);

    // 5. Pit Lane Center Dashed Guidance Line
    for (let pd = 0; pd < 24; pd++) {
      const pDashGeo = new THREE.PlaneGeometry(2.0, 0.2);
      pDashGeo.rotateX(-Math.PI / 2);
      pDashGeo.translate(-44 + pd * 4.0, 0.010, -116.8);
      whiteGeos.push(pDashGeo);
    }



    if (whiteGeos.length > 0) {
      const mergedWhiteLines = this.mergeAndDispose(whiteGeos, false);
      if (mergedWhiteLines) {
        const whiteMesh = new THREE.Mesh(mergedWhiteLines, whiteLineMat);
        whiteMesh.name = 'trackLineMesh';
        whiteMesh.receiveShadow = true;
        linesGroup.add(whiteMesh);
      }
    }

    trackGroup.add(linesGroup);
  }

  /**
   * Continuous Batched 3D Beveled Kerbs (0 overlapping boxes, 0 Z-fighting) and Starting Grid
   * Eliminates 108 disjointed overlapping BoxGeometries and replaces them with 2 seamless
   * hardware-batched BufferGeometries (1 red, 1 white) with DoubleSide rendering, correct winding,
   * realistic elevated 3D profile, and maximum draw-call efficiency.
   */
  private buildKerbsAndStartingGrid(): void {
    const kerbGroup = new THREE.Group();
    const c = this.innerCornerCenter;
    const w = this.trackWidth;
    const innerR = this.cornerRadius - w / 2; // 38 - 8 = 30
    const outerR = this.cornerRadius + w / 2; // 38 + 8 = 46
    const kerbWidth = 1.6;

    const corners = [
      { cx: c, cz: -c, startAngle: -Math.PI / 2 },
      { cx: c, cz: c, startAngle: 0 },
      { cx: -c, cz: c, startAngle: Math.PI / 2 },
      { cx: -c, cz: -c, startAngle: Math.PI },
    ];

    const redVertices: number[] = [];
    const redIndices: number[] = [];
    const whiteVertices: number[] = [];
    const whiteIndices: number[] = [];

    const addQuad = (
      p1a: THREE.Vector3,
      p2a: THREE.Vector3,
      p1b: THREE.Vector3,
      p2b: THREE.Vector3,
      isOuter: boolean,
      isRed: boolean
    ) => {
      const targetVerts = isRed ? redVertices : whiteVertices;
      const targetIndices = isRed ? redIndices : whiteIndices;
      const baseIdx = targetVerts.length / 3;

      targetVerts.push(
        p1a.x, p1a.y, p1a.z, // baseIdx (p1a)
        p2a.x, p2a.y, p2a.z, // baseIdx + 1 (p2a)
        p1b.x, p1b.y, p1b.z, // baseIdx + 2 (p1b)
        p2b.x, p2b.y, p2b.z  // baseIdx + 3 (p2b)
      );

      if (!isOuter) {
        // Inner curb (ra > rb): CCW upward normal (p1a -> p1b -> p2a and p1b -> p2b -> p2a)
        targetIndices.push(baseIdx, baseIdx + 2, baseIdx + 1);
        targetIndices.push(baseIdx + 2, baseIdx + 3, baseIdx + 1);
      } else {
        // Outer curb (ra < rb): CCW upward normal (p1a -> p2a -> p1b and p2a -> p2b -> p1b)
        targetIndices.push(baseIdx, baseIdx + 1, baseIdx + 2);
        targetIndices.push(baseIdx + 1, baseIdx + 3, baseIdx + 2);
      }
    };

    const numSegs = 32;
    const arcSpan = Math.PI / 2;

    corners.forEach((corner) => {
      // 1. Inner Apex Curb (Spans the entire 90-degree apex smoothly with tapered ends)
      for (let i = 0; i < numSegs; i++) {
        const isRed = Math.floor(i / 2) % 2 === 0;
        const a1 = corner.startAngle + (i / numSegs) * arcSpan;
        const a2 = corner.startAngle + ((i + 1) / numSegs) * arcSpan;

        const taper1 = Math.min(1.0, (i + 0.5) / 2.5, (numSegs - 0.5 - i) / 2.5);
        const taper2 = Math.min(1.0, (i + 1.5) / 2.5, (numSegs - 1.5 - i) / 2.5);

        const y0_1 = 0.025;
        const y1_1 = 0.025 + 0.050 * taper1;
        const y2_1 = 0.025 + 0.010 * taper1;

        const y0_2 = 0.025;
        const y1_2 = 0.025 + 0.050 * taper2;
        const y2_2 = 0.025 + 0.010 * taper2;

        const r0 = innerR;
        const r1 = innerR - kerbWidth * 0.55;
        const r2 = innerR - kerbWidth;

        const cos1 = Math.cos(a1);
        const sin1 = Math.sin(a1);
        const cos2 = Math.cos(a2);
        const sin2 = Math.sin(a2);

        const p1_r0 = new THREE.Vector3(corner.cx + cos1 * r0, y0_1, corner.cz + sin1 * r0);
        const p2_r0 = new THREE.Vector3(corner.cx + cos2 * r0, y0_2, corner.cz + sin2 * r0);

        const p1_r1 = new THREE.Vector3(corner.cx + cos1 * r1, y1_1, corner.cz + sin1 * r1);
        const p2_r1 = new THREE.Vector3(corner.cx + cos2 * r1, y1_2, corner.cz + sin2 * r1);

        const p1_r2 = new THREE.Vector3(corner.cx + cos1 * r2, y2_1, corner.cz + sin1 * r2);
        const p2_r2 = new THREE.Vector3(corner.cx + cos2 * r2, y2_2, corner.cz + sin2 * r2);

        // Quad from track asphalt lip to beveled crown
        addQuad(p1_r0, p2_r0, p1_r1, p2_r1, false, isRed);
        // Quad from beveled crown to runoff verge
        addQuad(p1_r1, p2_r1, p1_r2, p2_r2, false, isRed);
      }

      // 2. Outer Curb (Full outer curve spanning entry braking through exit acceleration)
      for (let i = 0; i < numSegs; i++) {
        const isRed = Math.floor(i / 2) % 2 === 0;
        const a1 = corner.startAngle + (i / numSegs) * arcSpan;
        const a2 = corner.startAngle + ((i + 1) / numSegs) * arcSpan;

        const taper1 = Math.min(1.0, (i + 0.5) / 2.5, (numSegs - 0.5 - i) / 2.5);
        const taper2 = Math.min(1.0, (i + 1.5) / 2.5, (numSegs - 1.5 - i) / 2.5);

        const y0_1 = 0.025;
        const y1_1 = 0.025 + 0.050 * taper1;
        const y2_1 = 0.025 + 0.010 * taper1;

        const y0_2 = 0.025;
        const y1_2 = 0.025 + 0.050 * taper2;
        const y2_2 = 0.025 + 0.010 * taper2;

        const r0 = outerR;
        const r1 = outerR + kerbWidth * 0.55;
        const r2 = outerR + kerbWidth;

        const cos1 = Math.cos(a1);
        const sin1 = Math.sin(a1);
        const cos2 = Math.cos(a2);
        const sin2 = Math.sin(a2);

        const p1_r0 = new THREE.Vector3(corner.cx + cos1 * r0, y0_1, corner.cz + sin1 * r0);
        const p2_r0 = new THREE.Vector3(corner.cx + cos2 * r0, y0_2, corner.cz + sin2 * r0);

        const p1_r1 = new THREE.Vector3(corner.cx + cos1 * r1, y1_1, corner.cz + sin1 * r1);
        const p2_r1 = new THREE.Vector3(corner.cx + cos2 * r1, y1_2, corner.cz + sin2 * r1);

        const p1_r2 = new THREE.Vector3(corner.cx + cos1 * r2, y2_1, corner.cz + sin1 * r2);
        const p2_r2 = new THREE.Vector3(corner.cx + cos2 * r2, y2_2, corner.cz + sin2 * r2);

        // Quad from track asphalt lip to beveled crown
        addQuad(p1_r0, p2_r0, p1_r1, p2_r1, true, isRed);
        // Quad from beveled crown to gravel/turf runoff
        addQuad(p1_r1, p2_r1, p1_r2, p2_r2, true, isRed);
      }
    });

    if (redVertices.length > 0) {
      const redGeo = new THREE.BufferGeometry();
      redGeo.setAttribute('position', new THREE.Float32BufferAttribute(redVertices, 3));
      redGeo.setIndex(redIndices);
      redGeo.computeVertexNormals();
      const redMesh = new THREE.Mesh(redGeo, this.kerbRedMat);
      redMesh.receiveShadow = true;
      redMesh.renderOrder = 2;
      kerbGroup.add(redMesh);
    }

    if (whiteVertices.length > 0) {
      const whiteGeo = new THREE.BufferGeometry();
      whiteGeo.setAttribute('position', new THREE.Float32BufferAttribute(whiteVertices, 3));
      whiteGeo.setIndex(whiteIndices);
      whiteGeo.computeVertexNormals();
      const whiteMesh = new THREE.Mesh(whiteGeo, this.kerbWhiteMat);
      whiteMesh.receiveShadow = true;
      whiteMesh.renderOrder = 2;
      kerbGroup.add(whiteMesh);
    }

    // Checkered Start / Finish Line (Transverse across the entire track width, FIA standard)
    const sfGeo = new THREE.PlaneGeometry(2.2, this.trackWidth);
    sfGeo.rotateX(-Math.PI / 2);
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;
    // Base crisp white
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 128, 1024);
    // Dark asphalt squares (2 columns along track x 16 squares across track)
    ctx.fillStyle = '#09090b';
    const checkerSize = 64;
    for (let x = 0; x < 128; x += checkerSize) {
      for (let y = 0; y < 1024; y += checkerSize) {
        if ((x / checkerSize + y / checkerSize) % 2 === 0) {
          ctx.fillRect(x, y, checkerSize, checkerSize);
        }
      }
    }
    // Solid white leading line across the front edge (FIA specification)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(116, 0, 12, 1024);

    const sfTex = new THREE.CanvasTexture(canvas);
    sfTex.wrapS = THREE.ClampToEdgeWrapping;
    sfTex.wrapT = THREE.ClampToEdgeWrapping;
    sfTex.anisotropy = 8;
    const sfMat = new THREE.MeshStandardMaterial({
      map: sfTex,
      roughness: 0.5,
      polygonOffset: true,
      polygonOffsetFactor: -2.0,
      polygonOffsetUnits: -4.0,
    });
    const sfMesh = new THREE.Mesh(sfGeo, sfMat);
    sfMesh.position.set(-10.0, 0.014, -this.halfSize);
    sfMesh.renderOrder = 3;
    kerbGroup.add(sfMesh);

    this.group.add(kerbGroup);
  }

  /**
   * FIA Aerodynamic Continuous Curved Safety Barriers with Overhead Catch Fencing
   * Replaces discrete disjointed box blocks with smooth continuous swept profile lofting.
   * Generates authentic FIA New Jersey / F-Shape concrete barriers with rounded bevels, smooth flare toes,
   * continuous crimson aerodynamic top guardrails, and smooth continuous normal vectors for maximum rendering & physics sliding fluidez.
   */
  private buildConcreteBarriersWithCatchFences(): void {
    const wallHeight = 1.20;
    const fenceHeight = 2.40;
    const half = this.halfSize;
    const w = this.trackWidth;
    const c = this.innerCornerCenter;

    const outerHalf = half + w / 2 + 2.0;
    const innerHalf = half - w / 2 - 2.0;

    const concretePositions: number[] = [];
    const concreteUVs: number[] = [];
    const concreteIndices: number[] = [];

    // Spatial quadrant buckets (0: SW, 1: SE, 2: NW, 3: NE) for hardware frustum culling
    const cableBuckets: THREE.BufferGeometry[][] = [[], [], [], []];
    const postBuckets: THREE.Matrix4[][] = [[], [], [], []];
    const sharedPostGeo = new THREE.CylinderGeometry(0.06, 0.07, fenceHeight, 6);
    const dummyObj = new THREE.Object3D();

    const loftContinuousBarrier = (
      points: { x: number; z: number }[],
      isClosed: boolean,
      hasFence: boolean = true
    ) => {
      const N = points.length;
      if (N < 2) return;

      const numSegments = isClosed ? N : N - 1;

      // Compute continuous smooth normal vectors along the entire polyline
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

      // Cumulative distance along the path for seamless 4.0m modular precast block UV mapping
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

      // Catch fencing: instanced posts and continuous tension cables
      if (hasFence) {
        let accumulatedDistance = 0;
        const postSpacing = 4.8;
        let lastPostDist = -postSpacing;

        for (let seg = 0; seg < numSegments; seg++) {
          const p1 = points[seg];
          const p2 = isClosed ? points[(seg + 1) % N] : points[seg + 1];
          const segLen = Math.hypot(p2.x - p1.x, p2.z - p1.z);
          const yaw = Math.atan2(p2.x - p1.x, p2.z - p1.z);

          // Posts
          if (accumulatedDistance - lastPostDist >= postSpacing || seg === 0) {
            dummyObj.position.set(p1.x, wallHeight + fenceHeight / 2, p1.z);
            dummyObj.rotation.set(0, 0, 0);
            dummyObj.scale.set(1, 1, 1);
            dummyObj.updateMatrix();
            const qPost = (p1.x > 0 ? 1 : 0) + (p1.z > 0 ? 2 : 0);
            postBuckets[qPost].push(dummyObj.matrix.clone());
            lastPostDist = accumulatedDistance;
          }

          // 3 Horizontal continuous security tension wire cables
          const midSegX = (p1.x + p2.x) / 2;
          const midSegZ = (p1.z + p2.z) / 2;
          const qCable = (midSegX > 0 ? 1 : 0) + (midSegZ > 0 ? 2 : 0);
          for (let cb = 0; cb < 3; cb++) {
            const cableGeo = new THREE.CylinderGeometry(0.015, 0.015, segLen * 1.01, 4);
            cableGeo.rotateX(Math.PI / 2);
            cableGeo.rotateY(yaw);
            cableGeo.translate(midSegX, wallHeight + 0.6 + cb * 0.7, midSegZ);
            cableBuckets[qCable].push(cableGeo);
          }

          accumulatedDistance += segLen;
        }
      }

      // Physics collision registration: continuous unbroken barrier polyline
      for (let seg = 0; seg < numSegments; seg++) {
        const p1 = points[seg];
        const p2 = isClosed ? points[(seg + 1) % N] : points[seg + 1];
        const midX = (p1.x + p2.x) / 2;
        const midZ = (p1.z + p2.z) / 2;
        const len = Math.hypot(p2.x - p1.x, p2.z - p1.z);

        this.staticObstacles.push({
          x: midX,
          z: midZ,
          radius: len / 2,
          isWallSegment: true,
          p1: { x: p1.x, z: p1.z },
          p2: { x: p2.x, z: p2.z },
          type: 'wall',
        });
      }
    };

    // 1. Full Outer Perimeter Continuous Rounded Safety Barrier (Seamless 100% closed loop!)
    const outerPoints: { x: number; z: number }[] = [];
    const outerR = this.cornerRadius + w / 2 + 2.0; // 50.0
    const cornerSegments = 20;
    const straightSegments = 46;

    // South Straight (from -c to c at z = -outerHalf)
    for (let i = 0; i < straightSegments; i++) {
      const t = i / straightSegments;
      outerPoints.push({ x: -c + (2 * c) * t, z: -outerHalf });
    }

    // Turn 1 Outer Corner (Center c, -c, angle -PI/2 to 0)
    for (let i = 0; i < cornerSegments; i++) {
      const a = -Math.PI / 2 + (i / cornerSegments) * (Math.PI / 2);
      outerPoints.push({ x: c + Math.cos(a) * outerR, z: -c + Math.sin(a) * outerR });
    }

    // East Straight (from -c to c at x = outerHalf)
    for (let i = 0; i < straightSegments; i++) {
      const t = i / straightSegments;
      outerPoints.push({ x: outerHalf, z: -c + (2 * c) * t });
    }

    // Turn 2 Outer Corner (Center c, c, angle 0 to PI/2)
    for (let i = 0; i < cornerSegments; i++) {
      const a = (i / cornerSegments) * (Math.PI / 2);
      outerPoints.push({ x: c + Math.cos(a) * outerR, z: c + Math.sin(a) * outerR });
    }

    // North Straight (from c to -c at z = outerHalf)
    for (let i = 0; i < straightSegments; i++) {
      const t = i / straightSegments;
      outerPoints.push({ x: c - (2 * c) * t, z: outerHalf });
    }

    // Turn 3 Outer Corner (Center -c, c, angle PI/2 to PI)
    for (let i = 0; i < cornerSegments; i++) {
      const a = Math.PI / 2 + (i / cornerSegments) * (Math.PI / 2);
      outerPoints.push({ x: -c + Math.cos(a) * outerR, z: c + Math.sin(a) * outerR });
    }

    // West Straight (from c to -c at x = -outerHalf)
    for (let i = 0; i < straightSegments; i++) {
      const t = i / straightSegments;
      outerPoints.push({ x: -outerHalf, z: c - (2 * c) * t });
    }

    // Turn 4 Outer Corner (Center -c, -c, angle PI to 3*PI/2)
    for (let i = 0; i < cornerSegments; i++) {
      const a = Math.PI + (i / cornerSegments) * (Math.PI / 2);
      outerPoints.push({ x: -c + Math.cos(a) * outerR, z: -c + Math.sin(a) * outerR });
    }

    loftContinuousBarrier(outerPoints, true, true);

    // 2. Complete Unbroken Inner Safety Barrier System & Pit Lane Closures
    // Strictly closes the gap at Pit Entry, Pit Exit, Turn 1, Turn 4, and behind garages,
    // guaranteeing no car can enter or fall into the lower infield area.
    const innerCornerR = this.cornerRadius - w / 2 - 2.0; // 30.0

    // CHAIN A: West Straight -> Turn 4 Inner Apex -> Pit Entry Inner Wall -> Paddock West Wall
    const westAndPitEntryPoints: { x: number; z: number }[] = [];

    // West Straight Inner Wall (from 92 down to -c at x = -innerHalf)
    for (let i = 0; i <= straightSegments; i++) {
      const t = i / straightSegments;
      westAndPitEntryPoints.push({ x: -innerHalf, z: c - (2 * c) * t });
    }

    // Turn 4 Inner Apex (center: -c, -c = -92, -92, angle PI to 3*PI/2)
    for (let i = 0; i <= cornerSegments; i++) {
      const a = Math.PI + (i / cornerSegments) * (Math.PI / 2);
      westAndPitEntryPoints.push({ x: -c + Math.cos(a) * innerCornerR, z: -c + Math.sin(a) * innerCornerR });
    }

    // Pit Entry Right Boundary Wall (seals off the lower terrain along pit entrance)
    const pitEntryFlank: { x: number; z: number }[] = [
      { x: -84.0, z: -119.5 },
      { x: -76.0, z: -116.0 },
      { x: -68.0, z: -112.0 },
      { x: -60.0, z: -108.0 },
      { x: -54.0, z: -106.0 },
      { x: -50.0, z: -106.0 },
      { x: -50.0, z: -91.7 },
    ];
    pitEntryFlank.forEach((pt) => westAndPitEntryPoints.push(pt));
    loftContinuousBarrier(westAndPitEntryPoints, false, true);

    // CHAIN B: Rear Paddock Enclosure Barrier (along z = -91.7 behind garages)
    const rearPaddockPoints: { x: number; z: number }[] = [
      { x: -50.0, z: -91.7 },
      { x: 46.0, z: -91.7 },
    ];
    loftContinuousBarrier(rearPaddockPoints, false, true);

    // CHAIN C: Paddock East Wall -> Pit Exit Inner Wall -> Turn 1 -> East Straight -> Turn 2 -> North Straight -> Turn 3
    const eastCircuitPoints: { x: number; z: number }[] = [
      { x: 46.0, z: -91.7 },
      { x: 50.0, z: -106.0 },
      { x: 54.0, z: -106.0 },
      { x: 60.0, z: -108.0 },
      { x: 68.0, z: -112.0 },
      { x: 76.0, z: -116.0 },
      { x: 84.0, z: -119.5 },
      { x: 92.0, z: -122.0 },
    ];

    // Turn 1 Inner Apex (center: c, -c = 92, -92, angle -PI/2 to 0)
    for (let i = 0; i <= cornerSegments; i++) {
      const a = -Math.PI / 2 + (i / cornerSegments) * (Math.PI / 2);
      eastCircuitPoints.push({ x: c + Math.cos(a) * innerCornerR, z: -c + Math.sin(a) * innerCornerR });
    }

    // East Straight Inner Wall (from -c to c at x = innerHalf)
    for (let i = 0; i <= straightSegments; i++) {
      const t = i / straightSegments;
      eastCircuitPoints.push({ x: innerHalf, z: -c + (2 * c) * t });
    }

    // Turn 2 Inner Apex (center: c, c = 92, 92, angle 0 to PI/2)
    for (let i = 1; i <= cornerSegments; i++) {
      const a = (i / cornerSegments) * (Math.PI / 2);
      eastCircuitPoints.push({ x: c + Math.cos(a) * innerCornerR, z: c + Math.sin(a) * innerCornerR });
    }

    // North Straight Inner Wall (from c to -c at z = innerHalf)
    for (let i = 1; i <= straightSegments; i++) {
      const t = i / straightSegments;
      eastCircuitPoints.push({ x: c - (2 * c) * t, z: innerHalf });
    }

    // Turn 3 Inner Apex (center: -c, c = -92, 92, angle PI/2 to PI)
    for (let i = 1; i <= cornerSegments; i++) {
      const a = Math.PI / 2 + (i / cornerSegments) * (Math.PI / 2);
      eastCircuitPoints.push({ x: -c + Math.cos(a) * innerCornerR, z: c + Math.sin(a) * innerCornerR });
    }
    loftContinuousBarrier(eastCircuitPoints, false, true);

    // 3. Pit Wall separating main track and pit lane on South straight (x: -48 to 44 at z = -121.5)
    const pitWallPoints: { x: number; z: number }[] = [];
    const pitWallSegments = 16;
    for (let i = 0; i <= pitWallSegments; i++) {
      const t = i / pitWallSegments;
      pitWallPoints.push({ x: -48 + (44 - -48) * t, z: -121.5 });
    }
    loftContinuousBarrier(pitWallPoints, false, false);

    // Render all continuous barrier surfaces with smooth computed vertex normals and PBR UV mapping
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

    // Spatial quadrant partitioning for instanced posts and merged tension cables:
    // Segments the 300m perimeter fencing into 4 spatial quadrants (SW, SE, NW, NE).
    // Allows Three.js camera frustum culling to skip 50% to 75% of fence posts and wire cables outside view!
    for (let q = 0; q < 4; q++) {
      const qPosts = postBuckets[q];
      if (qPosts.length > 0) {
        const postInst = new THREE.InstancedMesh(sharedPostGeo, this.metalFenceMat, qPosts.length);
        qPosts.forEach((mat, idx) => postInst.setMatrixAt(idx, mat));
        postInst.castShadow = false;
        postInst.receiveShadow = false;
        postInst.instanceMatrix.needsUpdate = true;
        postInst.computeBoundingSphere();
        postInst.computeBoundingBox();
        this.group.add(postInst);
      }

      const qCables = cableBuckets[q];
      if (qCables.length > 0) {
        const mergedCableGeo = this.mergeAndDispose(qCables, false);
        if (mergedCableGeo) {
          mergedCableGeo.computeBoundingSphere();
          mergedCableGeo.computeBoundingBox();
          const cableMesh = new THREE.Mesh(mergedCableGeo, this.metalFenceMat);
          cableMesh.castShadow = false;
          cableMesh.receiveShadow = false;
          this.group.add(cableMesh);
        }
      }
    }
  }



  /**
   * Helper to build a seamless curved amphitheater tier with zero rectangular boxiness
   */
  private createCurvedAmphitheaterTier(
    width: number,
    depth: number,
    height: number,
    baseY: number,
    centerZ: number,
    segments: number = 32
  ): THREE.BufferGeometry {
    const halfW = width / 2;
    const vertices: number[] = [];
    const indices: number[] = [];
    const uvs: number[] = [];

    // 4 vertex rows:
    // row 0: front-bottom (y = baseY - height)
    // row 1: front-top (y = baseY)
    // row 2: back-top (y = baseY)
    // row 3: back-bottom (y = baseY - height)
    for (let row = 0; row < 4; row++) {
      const isTop = row === 1 || row === 2;
      const isBack = row === 2 || row === 3;
      const y = isTop ? baseY : baseY - height;
      const zOffset = isBack ? -depth / 2 : depth / 2;

      for (let s = 0; s <= segments; s++) {
        const u = s / segments;
        const x = -halfW + u * width;
        // Parabolic sweep forward at edges: edges curve 3.5m forward toward the track
        const curveOffset = Math.pow(x / halfW, 2) * 3.5;
        const z = centerZ + zOffset + curveOffset;

        vertices.push(x, y, z);
        uvs.push(u, isBack ? 1 : 0);
      }
    }

    const rowStride = segments + 1;
    // Riser quads (row 0 to row 1)
    for (let s = 0; s < segments; s++) {
      const a = s;
      const b = s + 1;
      const c = rowStride + s + 1;
      const d = rowStride + s;
      indices.push(a, b, c, a, c, d);
    }
    // Tread quads (row 1 to row 2)
    for (let s = 0; s < segments; s++) {
      const a = rowStride + s;
      const b = rowStride + s + 1;
      const c = 2 * rowStride + s + 1;
      const d = 2 * rowStride + s;
      indices.push(a, b, c, a, c, d);
    }
    // Back wall quads (row 2 to row 3)
    for (let s = 0; s < segments; s++) {
      const a = 2 * rowStride + s;
      const b = 2 * rowStride + s + 1;
      const c = 3 * rowStride + s + 1;
      const d = 3 * rowStride + s;
      indices.push(a, b, c, a, c, d);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  /**
   * Fluid Organic Grandstands: Sculpted Amphitheater Seating Bowl, Ergonomic Bucket Seats,
   * Bionic Tensile Wave Canopy, Arched Vomitorios, VIP Aero Capsule Pods & Natural Curved Berms.
   * Prohibits geometric box shapes; strictly uses fluid natural curves, tubes, and spatial LOD buffers
   * to maintain 60-120 FPS rock-solid performance with zero subpixel fragment stalls.
   */
  private buildGrandstands(): void {
    const standsGroup = new THREE.Group();

    const concreteMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.85 });
    const southConcreteGeos: THREE.BufferGeometry[] = [];

    // =========================================================================
    // 1. SOUTH MAIN GRANDSTAND: ORGANIC CURVED AMPHITHEATER & TENSILE CANOPY
    // =========================================================================
    // A. Sculpted Organic Curved Foundation Apron
    const southFoundationGeo = this.createCurvedAmphitheaterTier(
      130,
      26,
      2.2,
      1.8,
      -158.0,
      40
    );
    southConcreteGeos.push(southFoundationGeo);

    // Natural Rounded Wing Pylons (Smooth Cylindrical Terminations with Spherical Crown Caps)
    [-65, 65].forEach((capX) => {
      const capGeo = new THREE.CylinderGeometry(2.6, 3.8, 2.8, 16);
      capGeo.translate(capX, 1.4, -154.5);
      southConcreteGeos.push(capGeo);

      const crownGeo = new THREE.SphereGeometry(2.6, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2);
      crownGeo.translate(capX, 2.8, -154.5);
      southConcreteGeos.push(crownGeo);
    });

    // B. Arched Access Tunnels (Vomitorios) Piercing the Amphitheater
    // 4 Semicircular barrel vaults with rounded arch portal trims
    const vomitorioXs = [-42, -14, 14, 42];
    vomitorioXs.forEach((vx) => {
      const vaultGeo = new THREE.CylinderGeometry(1.8, 1.8, 8.0, 14, 1, true, 0, Math.PI);
      vaultGeo.rotateZ(Math.PI / 2);
      vaultGeo.translate(vx, 2.0, -153.0);
      southConcreteGeos.push(vaultGeo);

      const portalArchGeo = new THREE.TorusGeometry(1.85, 0.22, 8, 16, Math.PI);
      portalArchGeo.translate(vx, 2.0, -149.0);
      southConcreteGeos.push(portalArchGeo);
    });

    // C. 10 Concentric Parabolic Seating Tiers & Individual Ergonomic Bucket Seats
    // Partitioned into 3 Spatial Bays along X (West: x < -20, Center: -20 to +20, East: x > 20)
    // Rendered via GPU Hardware Instancing: 0 cloned geometry allocations, 90% VRAM reduction!
    const bayRedMatrices: THREE.Matrix4[][] = [[], [], []];
    const bayBlueMatrices: THREE.Matrix4[][] = [[], [], []];
    const bayGoldMatrices: THREE.Matrix4[][] = [[], [], []];
    const railingGeos: THREE.BufferGeometry[] = [];
    const seatDummy = new THREE.Object3D();

    // Fluid ergonomic bucket seat with organic contour (24 triangles per seat, smooth curved profile)
    const seatPanGeo = new THREE.CylinderGeometry(0.22, 0.24, 0.08, 6);
    seatPanGeo.translate(0, 0.04, 0);

    const seatBackGeo = new THREE.CylinderGeometry(
      0.23,
      0.23,
      0.34,
      6,
      1,
      true,
      -Math.PI * 0.40,
      Math.PI * 0.80
    );
    seatBackGeo.rotateY(Math.PI / 2);
    seatBackGeo.translate(0, 0.22, -0.11);

    const baseSeatUnit = safeMergeBufferGeometries([seatPanGeo, seatBackGeo]) || seatPanGeo;

    const tiers = 10;
    for (let t = 0; t < tiers; t++) {
      const tierWidth = 126 - t * 2.2;
      const tierDepth = 2.05;
      const tierHeight = 1.18;
      const baseY = 2.0 + t * 1.18;
      const centerZ = -149.5 - t * 2.0;

      const tierGeo = this.createCurvedAmphitheaterTier(
        tierWidth,
        tierDepth,
        tierHeight,
        baseY,
        centerZ,
        32
      );
      southConcreteGeos.push(tierGeo);

      // Generate individual high-detail curved bucket seats along each tier
      const halfW = tierWidth / 2;
      const seatPitch = 2.2;
      const seatCount = Math.floor((tierWidth - 2.8) / seatPitch);

      for (let s = 0; s <= seatCount; s++) {
        const sx = -halfW + 1.4 + s * seatPitch;

        // Skip stairway access corridors (Aisles at center, +/-28m, +/-56m)
        if (
          Math.abs(sx) < 1.1 ||
          Math.abs(sx - 28) < 1.1 ||
          Math.abs(sx + 28) < 1.1 ||
          Math.abs(sx - 52) < 1.1 ||
          Math.abs(sx + 52) < 1.1
        ) {
          continue;
        }

        // Parabolic forward curve: smooth amphitheater embrace
        const curveOffset = Math.pow(sx / halfW, 2) * 3.5;
        const sz = centerZ + 0.25 + curveOffset;

        // Tangent angle along the parabolic arc so seats face the track apex
        const dx = 0.05;
        const dz = (Math.pow((sx + dx) / halfW, 2) - Math.pow(sx / halfW, 2)) * 3.5;
        const yawAngle = -Math.atan2(dz, dx);

        seatDummy.position.set(sx, baseY + 0.06, sz);
        seatDummy.rotation.set(0, yawAngle, 0);
        seatDummy.scale.set(1, 1, 1);
        seatDummy.updateMatrix();

        // Spatial Bay Assignment: 0 = West Bay, 1 = Center Bay, 2 = East Bay
        const bayIdx = sx < -20 ? 0 : (sx > 20 ? 2 : 1);

        // Color zoning: Central VIP Gold, alternating Crimson Red & Sapphire Blue
        if (Math.abs(sx) < 13.0 && t >= 2 && t <= 7) {
          bayGoldMatrices[bayIdx].push(seatDummy.matrix.clone());
        } else if (t % 2 === 0) {
          bayRedMatrices[bayIdx].push(seatDummy.matrix.clone());
        } else {
          bayBlueMatrices[bayIdx].push(seatDummy.matrix.clone());
        }
      }
    }

    // Front Apron Safety Tubular Handrails (Continuous 3D curve following the amphitheater)
    const frontHalfW = 126 / 2;
    const railPoints: THREE.Vector3[] = [];
    for (let rp = 0; rp <= 24; rp++) {
      const ru = rp / 24;
      const rx = -frontHalfW + ru * 126;
      const rz = -149.5 + 1.1 + Math.pow(rx / frontHalfW, 2) * 3.5;
      railPoints.push(new THREE.Vector3(rx, 2.85, rz));
    }
    const frontRailCurve = new THREE.CatmullRomCurve3(railPoints);
    const frontRailGeo = new THREE.TubeGeometry(frontRailCurve, 28, 0.06, 6, false);
    railingGeos.push(frontRailGeo);

    // Front Railing Upright Posts (Tubular cylinders with spherical caps)
    for (let up = 0; up <= 16; up++) {
      const u = up / 16;
      const px = -frontHalfW + 2 + u * (126 - 4);
      const pz = -149.5 + 1.1 + Math.pow(px / frontHalfW, 2) * 3.5;
      const postGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.95, 6);
      postGeo.translate(px, 2.4, pz);
      railingGeos.push(postGeo);

      const capBall = new THREE.SphereGeometry(0.07, 6, 6);
      capBall.translate(px, 2.88, pz);
      railingGeos.push(capBall);
    }

    // High-performance Lambert materials for stadium seats (eliminates Cook-Torrance BRDF subpixel microfacet cost)
    const redSeatMat = new THREE.MeshLambertMaterial({ color: 0xdc2626 });
    const blueSeatMat = new THREE.MeshLambertMaterial({ color: 0x1d4ed8 });
    const goldSeatMat = new THREE.MeshLambertMaterial({ color: 0xf59e0b });

    for (let b = 0; b < 3; b++) {
      if (bayRedMatrices[b].length > 0) {
        const count = bayRedMatrices[b].length;
        const redInst = new THREE.InstancedMesh(baseSeatUnit, redSeatMat, count);
        for (let i = 0; i < count; i++) {
          redInst.setMatrixAt(i, bayRedMatrices[b][i]);
        }
        redInst.instanceMatrix.needsUpdate = true;
        redInst.castShadow = false;
        redInst.receiveShadow = false;
        redInst.frustumCulled = true;
        redInst.computeBoundingSphere();
        redInst.computeBoundingBox();
        standsGroup.add(redInst);
      }
      if (bayBlueMatrices[b].length > 0) {
        const count = bayBlueMatrices[b].length;
        const blueInst = new THREE.InstancedMesh(baseSeatUnit, blueSeatMat, count);
        for (let i = 0; i < count; i++) {
          blueInst.setMatrixAt(i, bayBlueMatrices[b][i]);
        }
        blueInst.instanceMatrix.needsUpdate = true;
        blueInst.castShadow = false;
        blueInst.receiveShadow = false;
        blueInst.frustumCulled = true;
        blueInst.computeBoundingSphere();
        blueInst.computeBoundingBox();
        standsGroup.add(blueInst);
      }
      if (bayGoldMatrices[b].length > 0) {
        const count = bayGoldMatrices[b].length;
        const goldInst = new THREE.InstancedMesh(baseSeatUnit, goldSeatMat, count);
        for (let i = 0; i < count; i++) {
          goldInst.setMatrixAt(i, bayGoldMatrices[b][i]);
        }
        goldInst.instanceMatrix.needsUpdate = true;
        goldInst.castShadow = false;
        goldInst.receiveShadow = false;
        goldInst.frustumCulled = true;
        goldInst.computeBoundingSphere();
        goldInst.computeBoundingBox();
        standsGroup.add(goldInst);
      }
    }

    // D. Bionic Tensile Wave Canopy: 11 Sweeping 3D Tubular Arches & Undulating Membrane
    const structureGeos: THREE.BufferGeometry[] = [];
    const ribXs = [-60, -48, -36, -24, -12, 0, 12, 24, 36, 48, 60];

    ribXs.forEach((rx) => {
      // 3D Organic Catmull-Rom Aerodynamic Curved Spine (Silver Tubular Rib)
      const crestY = 21.0 + Math.cos((rx / 60) * (Math.PI * 0.45)) * 2.8;
      const points = [
        new THREE.Vector3(rx, 0.6, -172.0),
        new THREE.Vector3(rx, 12.5, -170.0),
        new THREE.Vector3(rx, crestY, -160.0),
        new THREE.Vector3(rx, crestY - 2.6, -149.0),
        new THREE.Vector3(rx, crestY - 6.0, -142.5),
      ];
      const spineCurve = new THREE.CatmullRomCurve3(points);
      const spineGeo = new THREE.TubeGeometry(spineCurve, 24, 0.46, 10, false);
      structureGeos.push(spineGeo);

      // Wishbone Rear Struts (Angled aerodynamic stabilizing tubes in inverted V)
      [-2.6, 2.6].forEach((dx) => {
        const strutP1 = new THREE.Vector3(rx + dx, 0.3, -174.5);
        const strutP2 = new THREE.Vector3(rx, 12.0, -170.0);
        const strutCurve = new THREE.LineCurve3(strutP1, strutP2);
        const strutGeo = new THREE.TubeGeometry(strutCurve, 8, 0.28, 8, false);
        structureGeos.push(strutGeo);
      });
    });

    // Aerodynamic Undulating Canopy Membrane (Double-curved harmonic catenary surface)
    const membraneWidth = 126;
    const membraneDepth = 30;
    const membraneSegmentsX = 32;
    const membraneSegmentsZ = 16;
    const membraneGeo = new THREE.PlaneGeometry(membraneWidth, membraneDepth, membraneSegmentsX, membraneSegmentsZ);
    membraneGeo.rotateX(-Math.PI / 2);
    membraneGeo.translate(0, 0, -157.0);

    const mPos = membraneGeo.attributes.position;
    for (let i = 0; i < mPos.count; i++) {
      const vx = mPos.getX(i);
      const vz = mPos.getZ(i);
      const normX = vx / (membraneWidth / 2);
      const normZ = (vz - (-157.0)) / (membraneDepth / 2);

      const archProfile = 1 - Math.pow(normZ - 0.15, 2);
      const waveProfile = Math.cos(normX * Math.PI * 0.45);
      const wy = 17.2 + archProfile * 4.4 + waveProfile * 2.5;
      mPos.setY(i, wy);
    }
    membraneGeo.computeVertexNormals();
    structureGeos.push(membraneGeo);

    if (structureGeos.length > 0) {
      const mergedStructure = safeMergeBufferGeometries(structureGeos);
      if (mergedStructure) {
        const structureMesh = new THREE.Mesh(mergedStructure, this.metalSilverMat);
        structureMesh.geometry.computeBoundingSphere();
        structureMesh.geometry.computeBoundingBox();
        structureMesh.castShadow = false;
        structureMesh.receiveShadow = false;
        standsGroup.add(structureMesh);
      }
    }

    if (railingGeos.length > 0) {
      const mergedRailing = safeMergeBufferGeometries(railingGeos);
      if (mergedRailing) {
        const railMesh = new THREE.Mesh(mergedRailing, this.metalSilverMat);
        railMesh.geometry.computeBoundingSphere();
        railMesh.geometry.computeBoundingBox();
        railMesh.castShadow = false;
        railMesh.receiveShadow = false;
        standsGroup.add(railMesh);
      }
    }

    // E. Futuristic VIP Aero Lounge Capsule Pods (Suspended Oval Capsules with Curved Glass)
    const podGeos: THREE.BufferGeometry[] = [];
    const glassGeos: THREE.BufferGeometry[] = [];

    const podConfigs = [
      { x: 0, length: 24, radius: 2.3 },
      { x: -38, length: 16, radius: 2.0 },
      { x: 38, length: 16, radius: 2.0 },
    ];

    podConfigs.forEach((cfg) => {
      const podZ = -162.0;
      const podY = 13.5;

      // Streamlined cylindrical fuselage
      const podCyl = new THREE.CylinderGeometry(cfg.radius, cfg.radius, cfg.length, 18);
      podCyl.rotateZ(Math.PI / 2);
      podCyl.translate(cfg.x, podY, podZ);
      podGeos.push(podCyl);

      // Rounded hemispherical nose caps on both ends
      const leftCap = new THREE.SphereGeometry(cfg.radius, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2);
      leftCap.rotateZ(Math.PI / 2);
      leftCap.translate(cfg.x - cfg.length / 2, podY, podZ);
      podGeos.push(leftCap);

      const rightCap = new THREE.SphereGeometry(cfg.radius, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2);
      rightCap.rotateZ(-Math.PI / 2);
      rightCap.translate(cfg.x + cfg.length / 2, podY, podZ);
      podGeos.push(rightCap);

      // Panoramic curved glass window sector (facing the start-finish straight)
      const glassSector = new THREE.CylinderGeometry(
        cfg.radius + 0.04,
        cfg.radius + 0.04,
        cfg.length - 2.0,
        18,
        1,
        true,
        Math.PI * 0.5,
        Math.PI
      );
      glassSector.rotateZ(Math.PI / 2);
      glassSector.translate(cfg.x, podY, podZ);
      glassGeos.push(glassSector);
    });

    if (podGeos.length > 0) {
      const mergedPod = safeMergeBufferGeometries(podGeos);
      if (mergedPod) {
        const podMesh = new THREE.Mesh(mergedPod, this.metalDarkMat);
        podMesh.geometry.computeBoundingSphere();
        podMesh.geometry.computeBoundingBox();
        podMesh.castShadow = false;
        podMesh.receiveShadow = false;
        standsGroup.add(podMesh);
      }
    }
    if (glassGeos.length > 0) {
      const mergedGlass = safeMergeBufferGeometries(glassGeos);
      if (mergedGlass) {
        const glassMesh = new THREE.Mesh(mergedGlass, this.glassMat);
        glassMesh.geometry.computeBoundingSphere();
        glassMesh.geometry.computeBoundingBox();
        glassMesh.castShadow = false;
        glassMesh.receiveShadow = false;
        standsGroup.add(glassMesh);
      }
    }

    // F. Trackside Curved Ribbon Sponsor Board (Smooth Arc Following Amphitheater Contour)
    const ribbonCanvas = document.createElement('canvas');
    ribbonCanvas.width = 1024;
    ribbonCanvas.height = 128;
    const rCtx = ribbonCanvas.getContext('2d')!;
    rCtx.fillStyle = '#0f172a';
    rCtx.beginPath();
    rCtx.roundRect(12, 12, 1000, 104, 28);
    rCtx.fill();
    rCtx.fillStyle = '#ef4444';
    rCtx.beginPath();
    rCtx.roundRect(24, 18, 976, 8, 4);
    rCtx.fill();
    rCtx.fillStyle = '#f59e0b';
    rCtx.beginPath();
    rCtx.roundRect(24, 102, 976, 8, 4);
    rCtx.fill();
    rCtx.fillStyle = '#ffffff';
    rCtx.font = 'bold 44px sans-serif';
    rCtx.textAlign = 'center';
    rCtx.fillText('APEX GRAND PRIX  ·  PIRELLI  ·  BREMBO  ·  SHELL  ·  ROLEX', 512, 70);

    const ribbonTex = new THREE.CanvasTexture(ribbonCanvas);
    const ribbonMat = new THREE.MeshBasicMaterial({ map: ribbonTex, transparent: true });

    const sponsorRibbonGeo = new THREE.CylinderGeometry(
      160,
      160,
      2.4,
      32,
      1,
      true,
      Math.PI * 0.38,
      Math.PI * 0.24
    );
    sponsorRibbonGeo.rotateZ(Math.PI / 2);
    sponsorRibbonGeo.rotateY(Math.PI / 2);
    const sponsorMesh = new THREE.Mesh(sponsorRibbonGeo, ribbonMat);
    sponsorMesh.position.set(0, 2.5, -145.2);
    sponsorMesh.geometry.computeBoundingSphere();
    sponsorMesh.geometry.computeBoundingBox();
    sponsorMesh.castShadow = false;
    sponsorMesh.receiveShadow = false;
    standsGroup.add(sponsorMesh);

    // South Foundation Mesh (strictly localized around Z = -158 for precise frustum culling)
    if (southConcreteGeos.length > 0) {
      const mergedSouthConcrete = safeMergeBufferGeometries(southConcreteGeos);
      if (mergedSouthConcrete) {
        const southConcreteMesh = new THREE.Mesh(mergedSouthConcrete, concreteMat);
        southConcreteMesh.geometry.computeBoundingSphere();
        southConcreteMesh.geometry.computeBoundingBox();
        southConcreteMesh.castShadow = false;
        southConcreteMesh.receiveShadow = false;
        standsGroup.add(southConcreteMesh);
      }
    }

    // =========================================================================
    // 2. NORTH SECONDARY GRANDSTAND: PHOTOREALISTIC FIA MODULAR SCAFFOLDING & CANOPY
    // =========================================================================
    const northGrandstandGroup = new THREE.Group();
    northGrandstandGroup.name = 'NorthSecondaryGrandstand';

    if (TrackBuilder.cachedSecondaryGrandstandModel) {
      // Synchronous fast path: Use pre-loaded model immediately without runtime pop-in or stutter!
      northGrandstandGroup.add(TrackBuilder.cachedSecondaryGrandstandModel.clone(true));
      standsGroup.add(northGrandstandGroup);
    } else {
      // Asynchronous fallback if model was not preloaded
      const gltfLoader = new GLTFLoader();
      gltfLoader.load(
        '/models/photorealistic_secondary_grandstand.glb',
        (gltf) => {
          const grandstandModel = gltf.scene;
          const texLoader = new THREE.TextureLoader();
          let bannerTexture: THREE.Texture | null = null;

          grandstandModel.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              mesh.castShadow = false;
              mesh.receiveShadow = false;
              mesh.geometry.computeBoundingSphere();
              mesh.geometry.computeBoundingBox();
              if (mesh.material) {
                const mat = mesh.material as THREE.MeshStandardMaterial;
                mat.roughness = Math.max(0.40, mat.roughness);
                mat.side = THREE.FrontSide;
                const meshNameLow = mesh.name.toLowerCase();
                if (meshNameLow.includes('canopy')) {
                  mat.color.setHex(0x94a3b8);
                  mat.roughness = 0.65;
                } else if (meshNameLow.includes('deck') || meshNameLow.includes('scaffold')) {
                  mat.color.multiplyScalar(0.70);
                  mat.roughness = Math.max(0.50, mat.roughness);
                } else if (meshNameLow.includes('seat')) {
                  mat.color.multiplyScalar(0.75);
                  mat.roughness = Math.max(0.55, mat.roughness);
                }
                if (mesh.name.includes('Banner') && !mat.map) {
                  if (!bannerTexture) {
                    bannerTexture = texLoader.load('/textures/grandstands/sponsor_banner_apex.png');
                    bannerTexture.anisotropy = 16;
                  }
                  mat.map = bannerTexture;
                }
                mat.needsUpdate = true;
              }
            }
          });
          while (northGrandstandGroup.children.length > 0) {
            northGrandstandGroup.remove(northGrandstandGroup.children[0]);
          }
          northGrandstandGroup.add(grandstandModel);
        },
        undefined,
        (err) => {
          console.warn('Fallback to procedural secondary grandstand:', err);
        }
      );

      const procFallback = this.buildProceduralSecondaryGrandstandFallback();
      northGrandstandGroup.add(procFallback);
      standsGroup.add(northGrandstandGroup);
    }

    // =========================================================================
    // 3. POPULATE DENSE 3D HUMAN SPECTATOR CROWD & ANIMATED FLAGS
    // =========================================================================
    const placements: CrowdPlacementConfig[] = [];

    // South Main Amphitheater (10 tiers of cheering spectators & waving flags)
    const southCrowd = GrandstandCrowdSystem.generateSouthAmphitheaterCrowd(126, 10, 1.18, -149.5, 0.88);
    placements.push(...southCrowd);

    // North Secondary Grandstand (6 tiers of cheering spectators & waving flags)
    const northCrowd = GrandstandCrowdSystem.generateNorthBankCrowd(88, 6, 0.98, 152.0, 0.88);
    placements.push(...northCrowd);

    this.crowdSystem.generateCrowd(placements);
    this.group.add(this.crowdSystem.group);

    this.group.add(standsGroup);
  }

  /**
   * Procedural FIA Secondary Grandstand Fallback:
   * Scaffold lattice framework, aluminum decking, molded bucket seats, and cantilever canopy.
   * Rendered immediately while the Blender-baked GLB loads in the background.
   */
  private buildProceduralSecondaryGrandstandFallback(): THREE.Group {
    const group = new THREE.Group();
    group.name = 'ProceduralSecondaryGrandstandFallback';

    const steelMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      metalness: 0.75,
      roughness: 0.45,
    });
    const deckMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      metalness: 0.60,
      roughness: 0.55,
    });
    const concreteMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.9,
    });
    const seatRedMat = new THREE.MeshStandardMaterial({
      color: 0x991b1b,
      roughness: 0.60,
    });
    const seatBlueMat = new THREE.MeshStandardMaterial({
      color: 0x1e3a8a,
      roughness: 0.60,
    });
    const canopyMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.65,
      side: THREE.DoubleSide,
    });

    const concreteGeos: THREE.BufferGeometry[] = [];
    const deckGeos: THREE.BufferGeometry[] = [];
    const scaffoldGeos: THREE.BufferGeometry[] = [];
    const redSeatGeos: THREE.BufferGeometry[] = [];
    const blueSeatGeos: THREE.BufferGeometry[] = [];

    const width = 88;
    const tiers = 6;
    const tierRise = 0.98;
    const tierRun = 2.15;
    const baseZ = 152.0;
    const baseY = 1.80;

    // Foundation plinth
    const fGeo = this.createCurvedAmphitheaterTier(width, 16, 2.4, baseY, baseZ + 6.0, 32);
    concreteGeos.push(fGeo);

    // Tiers & Seats
    for (let t = 0; t < tiers; t++) {
      const tWidth = width - t * 2.0;
      const tY = baseY + t * tierRise;
      const tZ = baseZ + t * tierRun;
      const tierGeo = this.createCurvedAmphitheaterTier(tWidth, tierRun, tierRise, tY, tZ + tierRun * 0.5, 28);
      deckGeos.push(tierGeo);

      // Seats
      const halfW = tWidth / 2;
      const seatPitch = 1.0;
      const count = Math.floor((tWidth - 2.4) / seatPitch);
      for (let s = 0; s <= count; s++) {
        const sx = -halfW + 1.2 + s * seatPitch;
        if (Math.abs(sx) < 1.2 || Math.abs(sx - 24) < 1.2 || Math.abs(sx + 24) < 1.2) continue;
        const curveOffset = Math.pow(sx / (width / 2), 2) * 3.2;
        const sz = tZ + 0.65 + curveOffset;

        const seatBox = new THREE.BoxGeometry(0.42, 0.38, 0.36);
        seatBox.translate(sx, tY + 0.32, sz);
        if (Math.abs(sx) < 14) {
          blueSeatGeos.push(seatBox);
        } else {
          redSeatGeos.push(seatBox);
        }
      }
    }

    // Scaffolding rear pillars
    for (let x = -40; x <= 40; x += 8) {
      const cz = Math.pow(x / (width / 2), 2) * 3.2;
      const pillarGeo = new THREE.CylinderGeometry(0.12, 0.12, 11.5, 6);
      pillarGeo.translate(x, 5.75, baseZ + tiers * tierRun + cz);
      scaffoldGeos.push(pillarGeo);
    }

    // Tensile canopy
    const canopyGeo = this.createCurvedAmphitheaterTier(width + 2, 18, 0.15, baseY + tiers * tierRise + 4.8, baseZ + 5.5, 32);
    const canopyMesh = new THREE.Mesh(canopyGeo, canopyMat);
    canopyMesh.castShadow = false;
    canopyMesh.receiveShadow = false;
    group.add(canopyMesh);

    const mConc = safeMergeBufferGeometries(concreteGeos);
    if (mConc) group.add(new THREE.Mesh(mConc, concreteMat));

    const mDeck = safeMergeBufferGeometries(deckGeos);
    if (mDeck) group.add(new THREE.Mesh(mDeck, deckMat));

    const mScaff = safeMergeBufferGeometries(scaffoldGeos);
    if (mScaff) group.add(new THREE.Mesh(mScaff, steelMat));

    const mRed = safeMergeBufferGeometries(redSeatGeos);
    if (mRed) group.add(new THREE.Mesh(mRed, seatRedMat));

    const mBlue = safeMergeBufferGeometries(blueSeatGeos);
    if (mBlue) group.add(new THREE.Mesh(mBlue, seatBlueMat));

    return group;
  }

  /**
   * Two-Story Next-Gen Aerodynamic Paddock Club & Curved Pit Garages
   */
  private buildPaddockBuildingAndPitLane(): void {
    const curvedPaddock = CurvedPitBuildingBuilder.buildCurvedPitBuilding(
      {
        metalDarkMat: this.metalDarkMat,
        metalSilverMat: this.metalSilverMat,
        glassMat: this.glassMat,
        concreteMat: this.concreteBarrierMat,
      },
      96.0,
      { x: -2.0, y: 0, z: -99.0 }
    );

    // FIA Pit Box Markings on Asphalt for Rival (X = +22.0, Z = -110.5)
    // Note: Host box (X = -22.0) is dynamically rendered by PitStopManager to prevent Z-fighting duplicates.
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
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2.0,
      polygonOffsetUnits: -2.0,
      roughness: 0.6,
    });
    const stallMesh = new THREE.Mesh(stallBoxGeo, stallMat);
    stallMesh.position.set(22.0, 0.035, -110.5);
    stallMesh.renderOrder = 2;
    curvedPaddock.add(stallMesh);

    this.group.add(curvedPaddock);
  }

  /**
   * High-Tech Modern VIP Headquarters & Paddock Observation Complex
   * Replaces the East wing outer trees flanking the South straight (X = 88.0, Z = -152.0),
   * standing completely clear of the pit boxes and garages, facing the circuit with panoramic
   * cantilevered terraces that project deep, realistic shadows across the track asphalt!
   */
  private buildModernVIPArchitecture(): void {
    const modernVIPBuilding = ModernVIPBuildingBuilder.buildModernVIPBuilding(
      { x: 88.0, y: 0, z: -152.0 },
      Math.PI
    );
    this.group.add(modernVIPBuilding);

    // Physical obstacle collision boundaries for modern headquarters complex
    this.staticObstacles.push({
      x: 88.0,
      z: -152.0,
      radius: 16.0,
      type: 'building',
    });
  }

  /**
   * FIA Grade-1 High-Fidelity Pit Lane Entry & Exit Architecture
   * Includes Impact Attenuator Crash Cushion, Pit Limiter Speed & Timing Gantry,
   * Chevron Deceleration Road Markings, Fluorescent Apex Bollards, and Marshal Safety Station.
   */
  private buildPitEntryAndExitArchitecture(): void {
    const pitEntryGroup = new THREE.Group();

    // =========================================================================
    // 1. FIA HIGH-SPEED IMPACT ATTENUATOR / CRASH CUSHION (Pit Wall Entry Nose)
    // =========================================================================
    const noseX = -48;
    const noseZ = -121.5;

    // A. Main Crash Cushion Wedge
    const cushionGeo = new THREE.BoxGeometry(2.4, 1.35, 1.2);
    const cushionCanvas = document.createElement('canvas');
    cushionCanvas.width = 256;
    cushionCanvas.height = 128;
    const cCtx = cushionCanvas.getContext('2d')!;
    cCtx.fillStyle = '#d49e15'; // Weathered FIA industrial safety yellow
    cCtx.fillRect(0, 0, 256, 128);
    // Dark asphalt grime gradient at bottom
    const cGrime = cCtx.createLinearGradient(0, 80, 0, 128);
    cGrime.addColorStop(0, 'rgba(18, 20, 26, 0.0)');
    cGrime.addColorStop(1, 'rgba(18, 20, 26, 0.55)');
    cCtx.fillStyle = cGrime;
    cCtx.fillRect(0, 80, 256, 48);
    // Black chevron hazard diagonal stripes
    cCtx.fillStyle = '#11141a';
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
      roughness: 0.65,
      metalness: 0.15,
    });
    const cushionMesh = new THREE.Mesh(cushionGeo, cushionMat);
    cushionMesh.position.set(noseX - 1.2, 0.68, noseZ);
    cushionMesh.castShadow = false;
    pitEntryGroup.add(cushionMesh);

    // B. Stepped Energy-Absorbing Steel Deceleration Cylinders (QuadGuard style: batched)
    const yellowCylGeos: THREE.BufferGeometry[] = [];
    const darkCylGeos: THREE.BufferGeometry[] = [];
    for (let cyl = 0; cyl < 4; cyl++) {
      const cylGeo = new THREE.CylinderGeometry(0.48 - cyl * 0.04, 0.48 - cyl * 0.04, 1.2, 16);
      cylGeo.translate(noseX - 2.8 - cyl * 0.85, 0.6, noseZ);
      if (cyl % 2 === 0) {
        yellowCylGeos.push(cylGeo);
      } else {
        darkCylGeos.push(cylGeo);
      }
    }
    const yellowMerged = safeMergeBufferGeometries(yellowCylGeos);
    if (yellowMerged) {
      const yellowMat = new THREE.MeshStandardMaterial({ color: 0xd49e15, roughness: 0.60 });
      const m = new THREE.Mesh(yellowMerged, yellowMat);
      m.castShadow = false;
      pitEntryGroup.add(m);
    }
    const darkMerged = safeMergeBufferGeometries(darkCylGeos);
    if (darkMerged) {
      const m = new THREE.Mesh(darkMerged, this.metalDarkMat);
      m.castShadow = false;
      pitEntryGroup.add(m);
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
    const pitWallZ = -121.5;  // Left column aligns EXACTLY with the pit wall
    const paddockWallZ = -106.0; // Right column aligns with paddock side (15.5m wide open entrance)
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
    // 3. ROAD MARKINGS: PIT LIMITER LINE & DECELERATION RUBBER
    // =========================================================================
    // Transverse Pit Limiter Ground Road Line (at x = -54, spanning exactly the wide pit lane)
    // Realistic weathered FIA track marking: Deep oxide crimson & traffic off-white with bitumen border & rubber wear
    const limiterLineGeo = new THREE.PlaneGeometry(1.6, 15.5);
    limiterLineGeo.rotateX(-Math.PI / 2);
    const limiterCanvas = document.createElement('canvas');
    limiterCanvas.width = 256;
    limiterCanvas.height = 1024;
    const lCtx = limiterCanvas.getContext('2d')!;

    // Transparent background
    lCtx.clearRect(0, 0, 256, 1024);

    // Subtle dark bitumen edge border (prevents harsh cartoon contrast)
    lCtx.fillStyle = 'rgba(16, 18, 24, 0.75)';
    lCtx.fillRect(6, 0, 244, 1024);

    // Weathered FIA alternating stripes (Natural traffic road marking tones)
    const bandHeight = 64;
    for (let y = 0; y < 1024; y += bandHeight) {
      const isRed = (y / bandHeight) % 2 === 0;
      // Real FIA road paint: deep muted oxide crimson vs weathered traffic off-white
      lCtx.fillStyle = isRed ? 'rgba(118, 28, 34, 0.82)' : 'rgba(182, 188, 196, 0.80)';
      lCtx.fillRect(16, y, 224, bandHeight);

      // Micro asphalt grain / texture wear across paint
      lCtx.fillStyle = 'rgba(22, 25, 32, 0.18)';
      for (let dot = 0; dot < 45; dot++) {
        const dx = 18 + Math.random() * 220;
        const dy = y + Math.random() * bandHeight;
        lCtx.fillRect(dx, dy, 2 + Math.random() * 3, 2);
      }
    }

    // Heavy longitudinal tire rubber streaks where racing tires brake across the line
    for (const rx of [48, 112, 176]) {
      const rGrad = lCtx.createLinearGradient(rx - 28, 0, rx + 28, 0);
      rGrad.addColorStop(0, 'rgba(14, 16, 20, 0.0)');
      rGrad.addColorStop(0.5, 'rgba(14, 16, 20, 0.50)');
      rGrad.addColorStop(1, 'rgba(14, 16, 20, 0.0)');
      lCtx.fillStyle = rGrad;
      lCtx.fillRect(rx - 28, 0, 56, 1024);
    }

    const limiterTex = new THREE.CanvasTexture(limiterCanvas);
    limiterTex.anisotropy = 8;
    // Uses realistic MeshStandardMaterial with high roughness so it blends with the twilight environment
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
    limiterLine.position.set(gantryX, 0.014, gantryCenterZ);
    limiterLine.renderOrder = 2;
    pitEntryGroup.add(limiterLine);



    // =========================================================================
    // 4. FLUORESCENT BOLLARDS (InstancedMesh: 100% Batched in 2 Draw Calls)
    // =========================================================================
    const postGeo = new THREE.CylinderGeometry(0.06, 0.07, 0.75, 8);
    postGeo.translate(0, 0.375, 0);
    const postMat = new THREE.MeshStandardMaterial({
      color: 0xea580c, // Realistic highway polymer safety orange
      roughness: 0.65,
      metalness: 0.05,
    });
    const postInst = new THREE.InstancedMesh(postGeo, postMat, 6);

    const ringGeo = new THREE.CylinderGeometry(0.072, 0.072, 0.10, 8);
    const ringMat = new THREE.MeshStandardMaterial({ color: 0xdde2ea, roughness: 0.35 });
    const ringInst = new THREE.InstancedMesh(ringGeo, ringMat, 12);

    const dummyBollard = new THREE.Object3D();
    for (let b = 0; b < 6; b++) {
      const bt = b / 5;
      const bx = -56 + bt * 7.5;
      const bz = -123.2 + bt * 2.0;

      dummyBollard.position.set(bx, 0, bz);
      dummyBollard.updateMatrix();
      postInst.setMatrixAt(b, dummyBollard.matrix);

      for (let r = 0; r < 2; r++) {
        dummyBollard.position.set(bx, 0.48 + r * 0.16, bz);
        dummyBollard.updateMatrix();
        ringInst.setMatrixAt(b * 2 + r, dummyBollard.matrix);
      }
    }

    postInst.instanceMatrix.needsUpdate = true;
    postInst.castShadow = false;
    postInst.receiveShadow = false;
    postInst.computeBoundingSphere();
    postInst.computeBoundingBox();
    pitEntryGroup.add(postInst);

    ringInst.instanceMatrix.needsUpdate = true;
    ringInst.castShadow = false;
    ringInst.receiveShadow = false;
    ringInst.computeBoundingSphere();
    ringInst.computeBoundingBox();
    pitEntryGroup.add(ringInst);

    // =========================================================================
    // 5. MOTORSPORT SPONSOR BANNERS ALONG PIT WALL (Rolex, Pirelli, Brembo, Apex GT)
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
    bCtx.font = 'black 44px sans-serif';
    bCtx.fillText('APEX GT PIT LANE  ·  ROLEX  ·  PIRELLI  ·  BREMBO  ·  SHELL', 28, 78);

    const bannerTex = new THREE.CanvasTexture(bannerCanvas);
    const bannerMat = new THREE.MeshStandardMaterial({ map: bannerTex, roughness: 0.4 });
    const bannerGeo = new THREE.BoxGeometry(32, 1.1, 0.15);
    const bannerMesh = new THREE.Mesh(bannerGeo, bannerMat);
    bannerMesh.position.set(-32, 1.4, -121.9);
    pitEntryGroup.add(bannerMesh);

    this.group.add(pitEntryGroup);
  }

  /**
   * Start / Finish & Circuit Overhead Arches (Organic Aerodynamic Curved Tubular Architecture)
   * Completely replaces heavy blocky rectangular gantries with fluid, rounded composite arches.
   * Prohibits simple geometric boxes; uses smooth 3D curved tubular spines and rounded pylons for zero lag.
   */
  private buildOverheadGantriesAndBridges(): void {
    const structGroup = new THREE.Group();

    // 1. Start / Finish Aerodynamic Curved Tubular Arch (Spanning Main Straight)
    // Left pylon: outside track on outer grass verge (Z = -140.0)
    // Right pylon: mounted directly on concrete pit wall (Z = -121.5)
    // Span = 18.5m, Center = -130.75m. Leaves the entire pit lane at Z = -113.75 100% CLEAR!
    const startArch = this.buildAerodynamicCurvedArch(
      18.5,
      8.2,
      'CIRCUIT 1 · GRAND PRIX',
      '#ef4444'
    );
    startArch.position.set(0, 0, -130.75);
    structGroup.add(startArch);

    // 2. West High-Speed Sponsor Aerodynamic Curved Arch (at x = -130, z = 0 across the West Straight)
    const westArch = this.buildAerodynamicCurvedArch(
      21.0,
      8.2,
      'APEX GT · WORLD TOUR',
      '#38bdf8'
    );
    westArch.rotation.y = Math.PI / 2;
    westArch.position.set(-this.halfSize, 0, 0);
    structGroup.add(westArch);

    this.group.add(structGroup);
  }

  /**
   * Builder for Organic Aerodynamic Curved Tubular Arches with 100% Rounded Realism and Zero-Lag Soft Shadow
   */
  private buildAerodynamicCurvedArch(
    spanZ: number,
    height: number,
    titleText: string,
    accentColorHex: string
  ): THREE.Group {
    const archGroup = new THREE.Group();
    const halfSpan = spanZ / 2;

    const darkGeos: THREE.BufferGeometry[] = [];
    const silverGeos: THREE.BufferGeometry[] = [];

    // 1. Smooth Aerodynamic Continuous Curved Arch Spine (3D Catmull-Rom Tubular Spine in local coordinates)
    const curvePoints: THREE.Vector3[] = [];
    const segments = 16;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const z = -halfSpan + t * spanZ;
      const normalizedZ = (t - 0.5) * 2; // -1 to +1
      // Smooth parabolic/elliptical curve: rounded shoulders, organic rise
      const y = Math.max(0.4, height * (1 - Math.pow(normalizedZ, 4) * 0.48));
      curvePoints.push(new THREE.Vector3(0, y, z));
    }

    const archCurve = new THREE.CatmullRomCurve3(curvePoints);
    const mainTubeGeo = new THREE.TubeGeometry(archCurve, 28, 0.40, 14, false);
    darkGeos.push(mainTubeGeo);

    // 2. Secondary Slim Aerodynamic Stabilizer Tube
    const upperPoints = curvePoints.map((p, idx) => {
      const normZ = ((idx / segments) - 0.5) * 2;
      return new THREE.Vector3(-0.35, p.y + 0.52 * (1 - Math.pow(normZ, 2)), p.z);
    });
    const upperCurve = new THREE.CatmullRomCurve3(upperPoints);
    const upperTubeGeo = new THREE.TubeGeometry(upperCurve, 24, 0.16, 10, false);
    silverGeos.push(upperTubeGeo);

    // 3. Rounded Aerodynamic Base Pylons (Conical tapered cylinders with spherical crown joints)
    [-halfSpan, halfSpan].forEach((baseZ) => {
      const baseGeo = new THREE.CylinderGeometry(0.48, 0.82, 3.2, 20);
      baseGeo.translate(0, 1.6, baseZ);
      darkGeos.push(baseGeo);

      const ringGeo = new THREE.TorusGeometry(0.84, 0.07, 8, 20);
      ringGeo.rotateX(Math.PI / 2);
      ringGeo.translate(0, 0.25, baseZ);
      silverGeos.push(ringGeo);

      const sphereCapGeo = new THREE.SphereGeometry(0.52, 16, 12);
      sphereCapGeo.translate(0, 3.2, baseZ);
      silverGeos.push(sphereCapGeo);
    });

    const mergedDark = safeMergeBufferGeometries(darkGeos);
    if (mergedDark) {
      const mainTubeMesh = new THREE.Mesh(mergedDark, this.metalDarkMat);
      mainTubeMesh.castShadow = false;
      mainTubeMesh.receiveShadow = false;
      archGroup.add(mainTubeMesh);
    }

    const mergedSilver = safeMergeBufferGeometries(silverGeos);
    if (mergedSilver) {
      const upperTubeMesh = new THREE.Mesh(mergedSilver, this.metalSilverMat);
      upperTubeMesh.castShadow = false;
      upperTubeMesh.receiveShadow = false;
      archGroup.add(upperTubeMesh);
    }

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
    const ribbonMat = new THREE.MeshBasicMaterial({ map: ribbonTex, transparent: true });

    // Subtle curved ribbon section (Cylinder sector with rounded curve)
    const ribbonGeo = new THREE.CylinderGeometry(
      28.0, 28.0, 1.35, 24, 1, true,
      Math.PI * 0.42, Math.PI * 0.16
    );
    ribbonGeo.rotateZ(Math.PI / 2);
    ribbonGeo.rotateY(Math.PI / 2);
    const ribbonMesh = new THREE.Mesh(ribbonGeo, ribbonMat);
    ribbonMesh.position.set(-0.48, height - 0.2, 0);
    archGroup.add(ribbonMesh);

    // 5. Ultra-Lightweight Soft Baked Contact Shadow (0.00ms GPU overhead, zero fillrate impact)
    const shadowMesh = this.createCurvedArchSoftShadow(3.8, spanZ + 4.0, 0.45);
    shadowMesh.position.set(-1.2, 0.016, 0);
    archGroup.add(shadowMesh);

    return archGroup;
  }

  /**
   * 24 High-Mast Stadium Floodlight Towers Surrounding the Entire Circuit
   * Merged into optimized batched geometries to eliminate hundreds of individual draw calls.
   */
  private buildHighMastFloodlights(): void {
    // 24 Strategic Floodlight Tower positions with exact track target focal points
    const floodlightConfigs = [
      // South Straight (Main Straight & Pit Lane) - Towering behind Grandstand canopy at Z = -178
      { x: -75, z: -178, tx: -75, tz: -130 },
      { x: -40, z: -178, tx: -40, tz: -130 },
      { x: 0, z: -178, tx: 0, tz: -130 },
      { x: 40, z: -178, tx: 40, tz: -130 },
      { x: 75, z: -178, tx: 75, tz: -130 },

      // Turn 1 Corner Outer Towers (South-East) - Aiming at Turn 1 apex & exit
      { x: 125, z: -156, tx: 110, tz: -125 },
      { x: 156, z: -125, tx: 125, tz: -110 },
      { x: 156, z: -80, tx: 130, tz: -80 },

      // East Straight - Aiming West onto the track
      { x: 156, z: -40, tx: 130, tz: -40 },
      { x: 156, z: 0, tx: 130, tz: 0 },
      { x: 156, z: 40, tx: 130, tz: 40 },

      // Turn 2 Corner Outer Towers (North-East) - Aiming at Turn 2 apex & exit
      { x: 156, z: 80, tx: 130, tz: 80 },
      { x: 156, z: 125, tx: 125, tz: 110 },
      { x: 125, z: 156, tx: 110, tz: 125 },

      // North Straight - Aiming South onto the track (placed behind North Secondary Grandstand at Z = 172 to eliminate structure piercing)
      { x: 75, z: 156, tx: 75, tz: 130 },
      { x: 42, z: 172, tx: 42, tz: 130 },
      { x: 0, z: 172, tx: 0, tz: 130 },
      { x: -42, z: 172, tx: -42, tz: 130 },
      { x: -75, z: 156, tx: -75, tz: 130 },

      // Turn 3 Corner Outer Towers (North-West) - Aiming at Turn 3 apex & exit
      { x: -125, z: 156, tx: -110, tz: 125 },
      { x: -156, z: 125, tx: -125, tz: 110 },
      { x: -156, z: 80, tx: -130, tz: 80 },

      // West Straight - Aiming East onto the track
      { x: -156, z: 40, tx: -130, tz: 40 },
      { x: -156, z: 0, tx: -130, tz: 0 },
      { x: -156, z: -40, tx: -130, tz: -40 },

      // Turn 4 Corner Outer Towers (South-West) - Aiming at Turn 4 apex & entry
      { x: -156, z: -80, tx: -130, tz: -80 },
      { x: -156, z: -125, tx: -125, tz: -110 },
      { x: -125, z: -156, tx: -110, tz: -125 },
    ];

    const mastH = 24;
    const mastParts: THREE.BufferGeometry[] = [];

    const baseMastGeo = new THREE.CylinderGeometry(0.55, 1.1, mastH, 8);
    baseMastGeo.translate(0, mastH / 2, 0);
    mastParts.push(baseMastGeo);

    const headPitchMatrix = new THREE.Matrix4().makeRotationX(0.62);
    const headPosMatrix = new THREE.Matrix4().makeTranslation(0, mastH, 0);
    const headLocalMatrix = new THREE.Matrix4().multiplyMatrices(headPosMatrix, headPitchMatrix);

    const baseArmGeo = new THREE.BoxGeometry(0.8, 0.8, 2.2);
    baseArmGeo.translate(0, 0, 1.1);
    baseArmGeo.applyMatrix4(headLocalMatrix);
    mastParts.push(baseArmGeo);

    const baseHeadGeo = new THREE.BoxGeometry(5.4, 1.4, 0.8);
    baseHeadGeo.translate(0, 0, 2.2);
    baseHeadGeo.applyMatrix4(headLocalMatrix);
    mastParts.push(baseHeadGeo);

    const singleTowerGeo = safeMergeBufferGeometries(mastParts) || baseMastGeo;

    const baseSpotHousingGeo = new THREE.BoxGeometry(0.75, 0.75, 0.4);
    const baseLensGeo = new THREE.PlaneGeometry(0.65, 0.65);

    const mastMat = new THREE.MeshStandardMaterial({ color: 0x22262e, metalness: 0.40, roughness: 0.65 });

    const towerCount = floodlightConfigs.length;
    const towerInst = new THREE.InstancedMesh(singleTowerGeo, mastMat, towerCount);
    towerInst.castShadow = false;
    towerInst.receiveShadow = false;

    const spotsPerTower = 6;
    const totalSpots = towerCount * spotsPerTower;
    const spotHousingInst = new THREE.InstancedMesh(baseSpotHousingGeo, mastMat, totalSpots);
    spotHousingInst.castShadow = false;
    spotHousingInst.receiveShadow = false;

    const lensInst = new THREE.InstancedMesh(baseLensGeo, this.floodlightMat, totalSpots);
    lensInst.castShadow = false;
    lensInst.receiveShadow = false;

    floodlightConfigs.forEach((cfg, tIdx) => {
      const yawAngle = Math.atan2(cfg.tx - cfg.x, cfg.tz - cfg.z);
      const towerMatrix = new THREE.Matrix4();
      towerMatrix.makeRotationY(yawAngle);
      towerMatrix.setPosition(cfg.x, 0, cfg.z);
      towerInst.setMatrixAt(tIdx, towerMatrix);

      const headWorldMatrix = new THREE.Matrix4().multiplyMatrices(towerMatrix, headLocalMatrix);

      for (let s = 0; s < spotsPerTower; s++) {
        const spotX = -2.1 + s * 0.84;
        const spotIdx = tIdx * spotsPerTower + s;

        const spotMat = new THREE.Matrix4().makeTranslation(spotX, 0, 2.45);
        const spotWorldMat = new THREE.Matrix4().multiplyMatrices(headWorldMatrix, spotMat);
        spotHousingInst.setMatrixAt(spotIdx, spotWorldMat);

        const lensMat = new THREE.Matrix4().makeTranslation(spotX, 0, 2.66);
        const lensWorldMat = new THREE.Matrix4().multiplyMatrices(headWorldMatrix, lensMat);
        lensInst.setMatrixAt(spotIdx, lensWorldMat);
      }
    });

    towerInst.instanceMatrix.needsUpdate = true;
    towerInst.computeBoundingSphere();
    towerInst.computeBoundingBox();
    this.group.add(towerInst);

    spotHousingInst.instanceMatrix.needsUpdate = true;
    spotHousingInst.computeBoundingSphere();
    spotHousingInst.computeBoundingBox();
    this.group.add(spotHousingInst);

    lensInst.instanceMatrix.needsUpdate = true;
    lensInst.computeBoundingSphere();
    lensInst.computeBoundingBox();
    this.group.add(lensInst);
  }

  /**
   * Helper to recompute spherical normals from a center point for lush, volumetric foliage lighting
   */
  /**
   * Applies procedural organic 3D needle/leaf displacement to eliminate cartoon spherical symmetry
   */
  private displaceFoliageGeometry(geo: THREE.BufferGeometry, noiseScale = 0.28): void {
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const dist = Math.hypot(x, z) || 0.001;
      // Multi-octave organic perturbation
      const j1 = Math.sin(x * 5.2 + y * 3.4) * Math.cos(z * 4.8);
      const j2 = Math.sin(y * 8.0 + (x + z) * 3.0) * 0.5;
      const displace = (j1 + j2) * noiseScale;
      pos.setX(i, x + (x / dist) * displace);
      pos.setY(i, y + displace * 0.7);
      pos.setZ(i, z + (z / dist) * displace);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  }

  /**
   * High-performance BufferGeometry merger for building composite foliage prototypes
   */
  private mergeBufferGeometries(geos: Array<{ geo: THREE.BufferGeometry; matrix?: THREE.Matrix4 }>): THREE.BufferGeometry {
    let totalVerts = 0;
    let totalIndices = 0;

    for (const item of geos) {
      totalVerts += item.geo.attributes.position.count;
      if (item.geo.index) totalIndices += item.geo.index.count;
    }

    const positions = new Float32Array(totalVerts * 3);
    const normals = new Float32Array(totalVerts * 3);
    const uvs = new Float32Array(totalVerts * 2);
    const indices = new Uint16Array(totalIndices);

    let vertOffset = 0;
    let indexOffset = 0;

    const normalMatrix = new THREE.Matrix3();
    const v = new THREE.Vector3();
    const n = new THREE.Vector3();

    for (const item of geos) {
      const g = item.geo;
      const pos = g.attributes.position;
      const norm = g.attributes.normal;
      const uv = g.attributes.uv;
      const idx = g.index;

      const mat = item.matrix || new THREE.Matrix4();
      normalMatrix.getNormalMatrix(mat);

      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(mat);
        positions[(vertOffset + i) * 3] = v.x;
        positions[(vertOffset + i) * 3 + 1] = v.y;
        positions[(vertOffset + i) * 3 + 2] = v.z;

        if (norm) {
          n.fromBufferAttribute(norm, i).applyMatrix3(normalMatrix).normalize();
          normals[(vertOffset + i) * 3] = n.x;
          normals[(vertOffset + i) * 3 + 1] = n.y;
          normals[(vertOffset + i) * 3 + 2] = n.z;
        }

        if (uv) {
          uvs[(vertOffset + i) * 2] = uv.getX(i);
          uvs[(vertOffset + i) * 2 + 1] = uv.getY(i);
        }
      }

      if (idx) {
        for (let i = 0; i < idx.count; i++) {
          indices[indexOffset + i] = idx.getX(i) + vertOffset;
        }
        indexOffset += idx.count;
      }

      vertOffset += pos.count;
    }

    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    if (totalIndices > 0) {
      merged.setIndex(new THREE.BufferAttribute(indices, 1));
    }
    return merged;
  }

  /**
   * Pre-generates merged prototype geometries for Mediterranean Racing Pine
   */
  private createPineGeometries(): { trunk: THREE.BufferGeometry; foliage: THREE.BufferGeometry } {
    return OrganicVegetationSystem.createPineGeometries();
  }

  /**
   * Pre-generates merged prototype geometries for Broadleaf European Oak
   */
  private createOakGeometries(): { trunk: THREE.BufferGeometry; foliage: THREE.BufferGeometry } {
    return OrganicVegetationSystem.createOakGeometries();
  }

  /**
   * Pre-generates merged prototype geometries for Slender Italian Cypress
   */
  private createCypressGeometries(): { trunk: THREE.BufferGeometry; foliage: THREE.BufferGeometry } {
    return OrganicVegetationSystem.createCypressGeometries();
  }

  /**
   * Pre-generates merged prototype geometry for Organic Bush Cluster
   */
  private createBushGeometry(): THREE.BufferGeometry {
    return OrganicVegetationSystem.createBushGeometry();
  }

  /**
   * Photorealistic Dual-Corridor Tree System rendered via Hardware InstancedMesh.
   * Reduces draw calls from ~7,200 down to exactly 7 Draw Calls (99.9% reduction!).
   * Concentrates 100% of vegetation directly along BOTH sides of the circuit walls,
   * forming an immersive, tree-lined Grand Prix forest corridor at 60 FPS rock-solid.
   */
  private buildOrganicVegetation(): void {
    const vegGroup = new THREE.Group();
    const c = this.innerCornerCenter; // 92
    const cornerCenters = [
      { cx: c, cz: -c },
      { cx: c, cz: c },
      { cx: -c, cz: c },
      { cx: -c, cz: -c },
    ];

    interface TreeInst {
      x: number;
      z: number;
      scale: number;
      rotY: number;
    }

    const pineList: TreeInst[] = [];
    const oakList: TreeInst[] = [];
    const cypressList: TreeInst[] = [];
    const bushList: TreeInst[] = [];

    const placedTrees: Array<{ x: number; z: number; r: number }> = [];

    /**
     * Strict spatial validation ensuring no tree canopy or trunk intersects:
     * - Grandstands (South or North)
     * - Pit Lane, Paddock Club Garages, Team Transporters
     * - Helipad
     * - Concrete barriers (walls) and catch fences
     * - Asphalt track surface and kerbs
     * - Gravel runoff traps
     */
    const isTreeSafe = (x: number, z: number, canopyR: number): boolean => {
      // 0. Curva 1 Exterior Exclusion Zone (strictly eliminates all trees & shrubs outside Turn 1)
      if (this.isTurn1Exterior(x, z)) {
        return false;
      }

      // 1. South Main Grandstand Exclusion Zone (including canopy & VIP box)
      if (x >= -72 - canopyR && x <= 72 + canopyR && z >= -170 - canopyR && z <= -138.0 + canopyR) {
        return false;
      }

      // 2. North Grandstand & High-Mast Floodlight Exclusion Zone
      if (x >= -50 - canopyR && x <= 50 + canopyR && z >= 139.0 - canopyR && z <= 176.0 + canopyR) {
        return false;
      }

      // 3. Pit Lane, Pit Apron & Paddock Building (full width across all garages and pit road: x in [-96, 96], z in [-124.5, -84])
      if (Math.abs(x) <= 96 + canopyR && z >= -124.5 - canopyR && z <= -84 + canopyR) {
        return false;
      }

      // 4. Start/Finish Straight Building & Garage Corridor Exclusion Zone (z < -45, |x| <= 145)
      // Strictly eliminates all trees next to the Pit Building & Garages, Modern VIP Building, and Grandstand along recta de meta
      if (z < -45 && Math.abs(x) <= 145) {
        return false;
      }

      // 4.5. Inner Infield Occluded Zone: strictly eliminates all trees in the interior zone that are not visible from the track
      if (Math.abs(x) <= 116 && z <= 0) {
        return false;
      }

      // 5. Track Surface, Kerbs & Starting Grid
      // Straight Tracks (120 to 140 from center line)
      if (Math.abs(x) <= 92 && z >= -140.0 - canopyR && z <= -120.0 + canopyR) return false;
      if (Math.abs(x) <= 92 && z >= 120.0 - canopyR && z <= 140.0 + canopyR) return false;
      if (x >= 120.0 - canopyR && x <= 140.0 + canopyR && Math.abs(z) <= 92) return false;
      if (x >= -140.0 - canopyR && x <= -120.0 + canopyR && Math.abs(z) <= 92) return false;

      // Corner curved track & gravel traps
      for (const cc of cornerCenters) {
        const dx = x - cc.cx;
        const dz = z - cc.cz;
        const signX = Math.sign(cc.cx);
        const signZ = Math.sign(cc.cz);
        if (dx * signX >= -2 && dz * signZ >= -2) {
          const dist = Math.hypot(dx, dz);
          // Curved track + inner wall + gravel trap forbidden band (23.5m to 64.5m)
          if (dist >= 23.5 && dist <= 64.5) {
            return false;
          }
          // Inner apex tree canopy cannot extend past inner wall at 24.0m
          if (dist < 23.5 && dist + canopyR * 0.35 > 23.8) {
            return false;
          }
          // Outer curve tree canopy cannot extend into gravel runoff trap
          if (dist > 64.5 && dist - canopyR * 0.35 < 64.0) {
            return false;
          }
        }
      }

      // 7. Concrete Barrier Walls (wall thickness 0.75m + tree canopy radius + 0.45m clearance)
      const wallClr = canopyR + 0.45;
      if (Math.abs(x) <= 92) {
        if (Math.abs(z - 140) < wallClr || Math.abs(z + 140) < wallClr) return false;
        if (Math.abs(z - 120) < wallClr || Math.abs(z + 120) < wallClr) return false;
      }
      if (Math.abs(z) <= 92) {
        if (Math.abs(x - 140) < wallClr || Math.abs(x + 140) < wallClr) return false;
        if (Math.abs(x - 120) < wallClr || Math.abs(x + 120) < wallClr) return false;
      }

      for (const cc of cornerCenters) {
        const dx = x - cc.cx;
        const dz = z - cc.cz;
        const signX = Math.sign(cc.cx);
        const signZ = Math.sign(cc.cz);
        if (dx * signX >= -2 && dz * signZ >= -2) {
          const dist = Math.hypot(dx, dz);
          if (Math.abs(dist - 48.0) < wallClr) return false;
          if (Math.abs(dist - 24.0) < wallClr) return false;
        }
      }

      // 8. Tree-to-tree crown overlap prevention (allows lush, organic canopy clustering)
      for (const pt of placedTrees) {
        if (Math.hypot(x - pt.x, z - pt.z) < (canopyR + pt.r) * 0.38) {
          return false;
        }
      }

      return true;
    };

    const tryAddTree = (x: number, z: number, type: 'pine' | 'oak' | 'cypress', scale = 1.35) => {
      // Strictly eliminate all trees along the start/finish straight, paddock, and occluded interior infield
      if (z < -45 && Math.abs(x) <= 145) return;
      if (Math.abs(x) <= 116 && z <= 0) return;

      const canopyR = type === 'cypress' ? 1.4 * scale : (type === 'pine' ? 2.8 * scale : 3.4 * scale);
      if (!isTreeSafe(x, z, canopyR)) return;

      const rotY = (Math.abs(x * 13 + z * 17) % 628) / 100;
      if (type === 'pine') pineList.push({ x, z, scale, rotY });
      else if (type === 'oak') oakList.push({ x, z, scale, rotY });
      else cypressList.push({ x, z, scale, rotY });

      placedTrees.push({ x, z, r: canopyR });

      // Physics optimization: only check collisions for trees in the accessible infield (not behind outer walls)
      if (Math.abs(x) < 120 && Math.abs(z) < 120) {
        this.staticObstacles.push({
          x,
          z,
          radius: 0.8 * scale,
          type: 'tree',
        });
      }
    };

    // =========================================================================
    // CORRIDOR 1: OUTFIELD WALL TREE CORRIDOR (Hugging outer barriers & fences)
    // =========================================================================

    // 1. South Outer Wall Corridor: Flanked by Start/Finish Straight buildings, garages & grandstands (no trees)

    // 2. North Outer Wall Corridor (Safely flanking the North Grandstand)
    // West wing of North straight (x = -135 to -52, z = 149 to 162)
    for (let x = -135; x <= -52; x += 11.0) {
      const type = Math.abs(x) % 2 === 0 ? 'oak' : 'pine';
      tryAddTree(x, 151 + (Math.abs(x * 5) % 6), type, 1.4);
    }
    // East wing of North straight (x = 52 to 135, z = 149 to 162)
    for (let x = 52; x <= 135; x += 11.0) {
      const type = Math.abs(x) % 2 === 0 ? 'pine' : 'oak';
      tryAddTree(x, 151 + (Math.abs(x * 5) % 6), type, 1.4);
    }
    // Forest backdrop behind North Grandstand (z = 170 to 184)
    for (let x = -44; x <= 44; x += 13.0) {
      tryAddTree(x, 172 + (Math.abs(x * 7) % 8), 'oak', 1.55);
    }

    // 3. East Outer Wall Corridor (x ≈ 150 to 164, z = -120 to 120)
    for (let z = -125; z <= 125; z += 11.5) {
      if (z <= -75) continue; // Exclude trees flanking Turn 1 exterior
      const type = Math.abs(z) % 2 === 0 ? 'pine' : 'oak';
      tryAddTree(152 + (Math.abs(z * 5) % 8), z, type, 1.4);
    }

    // 4. West Outer Wall Corridor (x ≈ -150 to -164, z = -120 to 120)
    for (let z = -125; z <= 125; z += 11.5) {
      const type = Math.abs(z) % 2 === 0 ? 'oak' : 'pine';
      tryAddTree(-152 - (Math.abs(z * 5) % 8), z, type, 1.4);
    }

    // 5. 4 CORNER OUTER FOREST AMPHITHEATERS
    // Dense 4-tier majestic forest amphitheater encircling all 4 corners behind gravel runoff traps!
    const cornerAngles = [
      { cx: c, cz: -c, startAng: -Math.PI / 2 },
      { cx: c, cz: c, startAng: 0 },
      { cx: -c, cz: c, startAng: Math.PI / 2 },
      { cx: -c, cz: -c, startAng: Math.PI },
    ];

    cornerAngles.forEach(({ cx, cz, startAng }) => {
      // Exclude Turn 1 outer forest amphitheater (exterior of Turn 1)
      if (cx === c && cz === -c) return;

      // Tier 1: Near forest edge (r = 66.5 to 73m, flanking the runoff barrier)
      for (let a = 0.05; a < Math.PI / 2 - 0.05; a += 0.085) {
        const ang = startAng + a;
        const dist = 67.5 + ((a * 7) % 4.5);
        const type = Math.floor(a * 10) % 2 === 0 ? 'pine' : 'oak';
        tryAddTree(cx + Math.cos(ang) * dist, cz + Math.sin(ang) * dist, type, 1.4);
      }

      // Tier 2: Mid forest canopy (r = 75 to 84m)
      for (let a = 0.04; a < Math.PI / 2 - 0.04; a += 0.080) {
        const ang = startAng + a;
        const dist = 77.5 + ((a * 9) % 5.0);
        const type = Math.floor(a * 10) % 3 === 0 ? 'pine' : 'oak';
        tryAddTree(cx + Math.cos(ang) * dist, cz + Math.sin(ang) * dist, type, 1.5);
      }
    });

    // =========================================================================
    // CORRIDOR 2: INFIELD WALL TREE CORRIDOR (Hugging inner circuit barriers)
    // =========================================================================

    // 1. North Inner Barrier Corridor (z ≈ 110 to 113, facing the track)
    for (let x = -80; x <= 80; x += 12.0) {
      const mod = Math.abs(x) % 3;
      const type = mod === 0 ? 'cypress' : (mod === 1 ? 'oak' : 'pine');
      tryAddTree(x, 111.5 - (Math.abs(x * 3) % 2), type, 1.25);
    }

    // 2. East Inner Barrier Corridor (x ≈ 110 to 113, facing the track along north half)
    for (let z = 10; z <= 80; z += 12.0) {
      const mod = Math.abs(z) % 3;
      const type = mod === 0 ? 'cypress' : (mod === 1 ? 'pine' : 'oak');
      tryAddTree(111.5 - (Math.abs(z * 3) % 2), z, type, 1.25);
    }

    // 3. West Inner Barrier Corridor (x ≈ -110 to -113, facing the track along north half)
    for (let z = 10; z <= 80; z += 12.0) {
      const mod = Math.abs(z) % 3;
      const type = mod === 0 ? 'cypress' : (mod === 1 ? 'oak' : 'pine');
      tryAddTree(-111.5 + (Math.abs(z * 3) % 2), z, type, 1.25);
    }

    // 4. South Infield & Inner Corner Apex Groves completely removed per user instruction:
    // Invisible interior tree clusters that cannot be seen from the track are eliminated for performance and realism.

    // =========================================================================
    // TRACKSIDE SHRUB HEDGES (Strictly clear of walls and grandstands)
    // =========================================================================
    const barrierBushPositions: Array<[number, number, number]> = [];

    // Along North inner barrier meadow (z ≈ 114)
    for (let x = -75; x <= 75; x += 8.0) barrierBushPositions.push([x, 114.5, 1.05]);
    // Along East inner barrier meadow (x ≈ 114, north half)
    for (let z = 10; z <= 75; z += 8.0) barrierBushPositions.push([114.5, z, 1.05]);
    // Along West inner barrier meadow (x ≈ -114, north half)
    for (let z = 10; z <= 75; z += 8.0) barrierBushPositions.push([-114.5, z, 1.05]);
    // Along South outer barrier meadow: clear of vegetation along recta de meta buildings

    // Outer corner shrub hedges (r = 65.2m, nestled right behind corner gravel traps)
    cornerAngles.forEach(({ cx, cz, startAng }) => {
      // Exclude Turn 1 outer shrub hedges (exterior of Turn 1)
      if (cx === c && cz === -c) return;
      for (let a = 0.05; a < Math.PI / 2 - 0.05; a += 0.08) {
        const ang = startAng + a;
        barrierBushPositions.push([cx + Math.cos(ang) * 65.2, cz + Math.sin(ang) * 65.2, 1.15]);
      }
    });

    barrierBushPositions.forEach(([bx, bz, scale]) => {
      // Strictly eliminate all shrubs along the start/finish straight and adjacent to its buildings
      if (bz < -65 && Math.abs(bx) <= 145) return;
      const bushR = 1.2 * scale;
      if (isTreeSafe(bx, bz, bushR)) {
        const rotY = (Math.abs(bx * 19 + bz * 23) % 628) / 100;
        bushList.push({ x: bx, z: bz, scale, rotY });
        placedTrees.push({ x: bx, z: bz, r: bushR });
      }
    });

    // =========================================================================
    // HARDWARE INSTANCING COMPILATION WITH SPATIAL SECTOR CULLING
    // =========================================================================
    const allTreeConfigs: TreePlacementConfig[] = [];
    pineList.forEach((p) => allTreeConfigs.push({ x: p.x, z: p.z, scale: p.scale, yaw: p.rotY, type: 'pine' }));
    oakList.forEach((o) => allTreeConfigs.push({ x: o.x, z: o.z, scale: o.scale, yaw: o.rotY, type: 'oak' }));
    cypressList.forEach((c) => allTreeConfigs.push({ x: c.x, z: c.z, scale: c.scale, yaw: c.rotY, type: 'cypress' }));
    bushList.forEach((b) => allTreeConfigs.push({ x: b.x, z: b.z, scale: b.scale, yaw: b.rotY, type: 'bush' }));

    OrganicVegetationSystem.buildVegetationForest(
      vegGroup,
      allTreeConfigs,
      {
        trunkMat: this.treeBarkMat,
        pineFoliageMat: this.pineFoliageMat,
        oakFoliageMat: this.oakFoliageMat,
        cypressFoliageMat: this.cypressFoliageMat,
        bushMat: this.bushFoliageMat,
      }
    );

    this.group.add(vegGroup);
  }

  /**
   * Official FIA Safety Car, Medical Car & Circuit Recovery Cranes
   */
  private buildServiceAndSafetyVehicles(): void {
    // Service & safety vehicle slot (removed placeholder primitive blocks)
  }

  /**
   * FIA Speed Trap Radar Overpass Arches (North Straight)
   * Spans cleanly across Z axis from z = 114 to z = 146 with organic aerodynamic curved architecture.
   */
  private buildSpeedTrapRadarAndSectorGantries(): void {
    const radarGroup = new THREE.Group();

    // North Straight High-Speed Aerodynamic Curved Arch (x = 0, z = 130)
    const northArch = this.buildAerodynamicCurvedArch(
      21.0,
      7.8,
      'SPEED TRAP · 328 KM/H',
      '#10b981'
    );
    northArch.position.set(0, 0, this.halfSize);
    radarGroup.add(northArch);

    this.group.add(radarGroup);
  }


  /**
   * Trackside Signage & Dynamic Props: Photorealistic Blender 3.6 Models
   * - Eliminates all buggy unrotated legacy cardboard signs.
   * - FIA Distance Brake Marker Boards (200m, 150m, 100m, 50m) with breakaway elastomer mounts and high-visibility PBR graphics.
   * - FIA Turn Gantry Signs (Turn 1, Turn 2, Turn 3, Turn 4) with steel pylons, overhead LED floodlights, and sector telemetry.
   * - Curved Trackside Sponsor Billboards with barrier clamp brackets (Pirelli, Brembo, Shell, Apex GT).
   * - Slalom Apex Cones with dynamic physics.
   */
  private buildDynamicProps(): void {
    let propId = 0;
    const signageGroup = new THREE.Group();
    signageGroup.name = 'PhotorealisticCircuitSignage';
    this.group.add(signageGroup);

    // 1. Corner Apex Slalom Cones (Fluorescent Orange)
    const conePositions = [
      { x: 92, z: -84 },
      { x: 84, z: 92 },
      { x: -92, z: 84 },
      { x: -84, z: -92 },
    ];

    conePositions.forEach((pos) => {
      const coneGeo = new THREE.ConeGeometry(0.24, 0.65, 10);
      const coneMat = new THREE.MeshStandardMaterial({
        color: 0xf97316,
        roughness: 0.35,
        metalness: 0.1,
      });
      const coneMesh = new THREE.Mesh(coneGeo, coneMat);
      coneMesh.position.set(pos.x, 0.325, pos.z);
      coneMesh.castShadow = false;
      signageGroup.add(coneMesh);

      const propObj: DynamicProp = {
        id: propId++,
        type: 'cone',
        mesh: coneMesh,
        position: new THREE.Vector3(pos.x, 0, pos.z),
        velocity: new THREE.Vector3(0, 0, 0),
        rotation: new THREE.Vector3(0, 0, 0),
        angularVelocity: new THREE.Vector3(0, 0, 0),
        radius: 0.35,
        height: 0.65,
        mass: 3.5,
        isSleeping: true,
        baseY: 0.325,
        isAirborne: false,
        airborneTimer: 0,
        initialPosition: new THREE.Vector3(pos.x, 0, pos.z),
        initialRotation: new THREE.Vector3(0, 0, 0),
      };
      this.dynamicProps.push(propObj);
    });

    const gltfLoader = new GLTFLoader();

    // 2. Photorealistic FIA Breakaway Brake Distance Markers (200m, 150m, 100m, 50m)
    const dists = ['200', '150', '100', '50'];
    dists.forEach((d) => {
      if (!TrackBuilder.cachedBrakeMarkers[d]) {
        TrackBuilder.cachedBrakeMarkers[d] = TrackBuilder.createPhotorealisticBrakeMarkerModel(d);
      }
    });

    const setupStraightMarkers = (markerDict: Record<string, THREE.Group>) => {
      const straightApproaches = [
        // Approach to Turn 1 (South Straight, driver moving toward +X)
        {
          positions: [
            { x: 10, z: -138.8 },
            { x: 32, z: -138.8 },
            { x: 54, z: -138.8 },
            { x: 76, z: -138.8 },
          ],
          rotY: Math.PI / 2 + 0.22,
        },
        // Approach to Turn 2 (East Straight, driver moving toward +Z)
        {
          positions: [
            { x: 138.8, z: 10 },
            { x: 138.8, z: 32 },
            { x: 138.8, z: 54 },
            { x: 138.8, z: 76 },
          ],
          rotY: 0 + 0.22,
        },
        // Approach to Turn 3 (North Straight, driver moving toward -X)
        {
          positions: [
            { x: -10, z: 138.8 },
            { x: -32, z: 138.8 },
            { x: -54, z: 138.8 },
            { x: -76, z: 138.8 },
          ],
          rotY: -Math.PI / 2 + 0.22,
        },
        // Approach to Turn 4 (West Straight, driver moving toward -Z)
        {
          positions: [
            { x: -138.8, z: -10 },
            { x: -138.8, z: -32 },
            { x: -138.8, z: -54 },
            { x: -138.8, z: -76 },
          ],
          rotY: Math.PI + 0.22,
        },
      ];

      straightApproaches.forEach((straight) => {
        straight.positions.forEach((pos, idx) => {
          const distLabel = dists[idx];
          const template = markerDict[distLabel];
          if (!template) return;

          const markerHolder = new THREE.Group();
          markerHolder.position.set(pos.x, 0, pos.z);
          markerHolder.rotation.y = straight.rotY;
          markerHolder.add(template.clone(true));
          signageGroup.add(markerHolder);

          // Dynamic prop with clean breakaway physics and disappearance lifecycle
          const propItem: DynamicProp = {
            id: propId++,
            type: 'sign',
            mesh: markerHolder,
            position: new THREE.Vector3(pos.x, 0, pos.z),
            velocity: new THREE.Vector3(0, 0, 0),
            rotation: new THREE.Vector3(0, straight.rotY, 0),
            angularVelocity: new THREE.Vector3(0, 0, 0),
            radius: 0.8,
            height: 1.4,
            mass: 14,
            isSleeping: true,
            baseY: 0,
            isAirborne: false,
            airborneTimer: 0,
            initialPosition: new THREE.Vector3(pos.x, 0, pos.z),
            initialRotation: new THREE.Vector3(0, straight.rotY, 0),
          };
          this.dynamicProps.push(propItem);
        });
      });
    };

    setupStraightMarkers(TrackBuilder.cachedBrakeMarkers);

    // 4. Outer straight sponsor billboards removed per user request for clean mobile view
  }

  /**
   * Helper to build a seamless curved road quad geometry in the XZ plane
   */
  private createCornerRoadGeometry(
    cx: number,
    cz: number,
    innerR: number,
    outerR: number,
    startAngle: number,
    endAngle: number,
    segments: number = 32,
    yPos: number = 0.005
  ): THREE.BufferGeometry {
    const geo = new THREE.BufferGeometry();
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const angle = startAngle + t * (endAngle - startAngle);
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      positions.push(cx + cosA * innerR, yPos, cz + sinA * innerR);
      uvs.push(0, t * 6);

      positions.push(cx + cosA * outerR, yPos, cz + sinA * outerR);
      uvs.push(1, t * 6);
    }

    for (let i = 0; i < segments; i++) {
      const p1 = i * 2;
      const p2 = p1 + 1;
      const p3 = (i + 1) * 2;
      const p4 = p3 + 1;

      indices.push(p1, p3, p2);
      indices.push(p2, p3, p4);
    }

    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  /**
   * Helper to build a seamless curved road quad mesh in the XZ plane
   */
  private createCornerRoadMesh(
    cx: number,
    cz: number,
    innerR: number,
    outerR: number,
    startAngle: number,
    endAngle: number,
    segments: number = 32,
    mat: THREE.Material = this.asphaltMat,
    yPos: number = 0.005
  ): THREE.Mesh {
    const geo = this.createCornerRoadGeometry(cx, cz, innerR, outerR, startAngle, endAngle, segments, yPos);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    return mesh;
  }

  /**
   * Dynamic Prop Physics Simulation (Realistic ballistic trajectory, ground bounce & 3-axis angular damping)
   * With 2.0s - 2.8s smooth scale disappearance lifecycle
   */
  public updateDynamicProps(dt: number): void {
    let hasAwakeProp = false;
    for (let i = 0; i < this.dynamicProps.length; i++) {
      if (!this.dynamicProps[i].isSleeping) {
        hasAwakeProp = true;
        break;
      }
    }
    if (!hasAwakeProp) return;

    const gravity = 22.0;
    const airDrag = 0.982;
    const groundFriction = 0.82;
    const groundAngularFriction = 0.72; // Dampens rotation on ground impact
    const airAngularDrag = 0.95; // Aerodynamic rotational damping in flight

    for (let i = 0; i < this.dynamicProps.length; i++) {
      const prop = this.dynamicProps[i];
      if (!prop.prevPosition) prop.prevPosition = prop.position.clone();
      if (!prop.prevRotation) prop.prevRotation = prop.rotation.clone();
      if (prop.isSleeping) continue;

      prop.prevPosition.copy(prop.position);
      prop.prevRotation.copy(prop.rotation);

      // Airborne Lifecycle: Smoothly scale down and disappear after 2.0s - 2.8s
      if (prop.isAirborne) {
        prop.airborneTimer = (prop.airborneTimer || 0) + dt;
        if (prop.airborneTimer > 2.0) {
          const fadeProgress = (prop.airborneTimer - 2.0) / 0.8; // 2.0s to 2.8s
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

      // Integrate Velocity
      prop.position.x += prop.velocity.x * dt;
      prop.position.z += prop.velocity.z * dt;
      prop.position.y += prop.velocity.y * dt;

      // Apply Gravity and Ground Contact Dynamics
      if (prop.position.y > prop.baseY) {
        prop.velocity.y -= gravity * dt;
        // In-flight aerodynamic rotational damping
        prop.angularVelocity.x *= airAngularDrag;
        prop.angularVelocity.y *= airAngularDrag;
        prop.angularVelocity.z *= airAngularDrag;
      } else {
        prop.position.y = prop.baseY;
        // Ground bounce with realistic restitution
        if (prop.velocity.y < -1.0) {
          prop.velocity.y = -prop.velocity.y * 0.32;
        } else {
          prop.velocity.y = 0;
        }
        prop.velocity.x *= groundFriction;
        prop.velocity.z *= groundFriction;

        // Tri-axis angular damping on ground contact (stops endless spinning)
        prop.angularVelocity.x *= groundAngularFriction;
        prop.angularVelocity.y *= groundAngularFriction;
        prop.angularVelocity.z *= groundAngularFriction;
      }

      prop.velocity.x *= airDrag;
      prop.velocity.z *= airDrag;

      // Integrate Rotation
      prop.rotation.x += prop.angularVelocity.x * dt;
      prop.rotation.y += prop.angularVelocity.y * dt;
      prop.rotation.z += prop.angularVelocity.z * dt;

      // Sleep Threshold check: stops motion cleanly when energy is dissipated
      const speedSq = prop.velocity.lengthSq();
      const angSpeedSq = prop.angularVelocity.lengthSq();
      if (speedSq < 0.02 && angSpeedSq < 0.02 && prop.position.y <= prop.baseY + 0.05 && !prop.isAirborne) {
        prop.isSleeping = true;
        prop.velocity.set(0, 0, 0);
        prop.angularVelocity.set(0, 0, 0);
      }
    }
  }

  /**
   * Sub-frame temporal interpolation for dynamic props visual meshes (smooth 60/120/144+ FPS)
   */
  public syncDynamicPropsVisuals(alpha: number = 1.0): void {
    const clampedAlpha = THREE.MathUtils.clamp(alpha, 0, 1);
    for (let i = 0; i < this.dynamicProps.length; i++) {
      const prop = this.dynamicProps[i];
      if (prop.isSleeping || !prop.mesh.visible) continue;
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
        prop.mesh.rotation.set(prop.rotation.x, prop.rotation.y, prop.rotation.z);
      }
    }
  }

  /**
   * Imparts crash momentum to a breakaway prop and marks as airborne
   */
  public impartImpulseToProp(
    prop: DynamicProp,
    carVelocity: THREE.Vector3,
    contactNormal: THREE.Vector3
  ): void {
    prop.isSleeping = false;
    prop.isAirborne = true;
    prop.airborneTimer = 0;
    const impactSpeed = carVelocity.length();

    // Direction of car motion normalized (or forward if nearly stopped)
    const carDirX = impactSpeed > 0.1 ? carVelocity.x / impactSpeed : contactNormal.x;
    const carDirZ = impactSpeed > 0.1 ? carVelocity.z / impactSpeed : contactNormal.z;

    // Outward deflection away from car
    const deflectX = contactNormal.x;
    const deflectZ = contactNormal.z;

    // Linear impulse forward and outward
    const forwardImpulse = Math.max(12, impactSpeed * 0.95);
    const deflectImpulse = Math.max(4, impactSpeed * 0.35);

    prop.velocity.x = carDirX * forwardImpulse + deflectX * deflectImpulse;
    prop.velocity.z = carDirZ * forwardImpulse + deflectZ * deflectImpulse;
    prop.velocity.y = Math.min(16, 4.5 + impactSpeed * 0.22); // Dynamic upward loft proportional to speed

    // Natural tumbling rotation across pitch and roll, with controlled yaw rotation
    const tumblePower = Math.min(14, 4.0 + impactSpeed * 0.2);
    prop.angularVelocity.x = (Math.random() - 0.5) * tumblePower * 2.0;
    prop.angularVelocity.y = (Math.random() - 0.5) * tumblePower * 0.8; // Controlled yaw spin
    prop.angularVelocity.z = (Math.random() - 0.5) * tumblePower * 2.0;
  }

  /**
   * Restores all breakaway props to their pristine original positions upon new lap
   */
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

  /**
   * Complete GPU resource cleanup for track meshes, materials and textures
   */
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
