/**
 * OrganicVegetationSystem.ts - Next-Gen Photorealistic Instanced Vegetation System
 *
 * Provides high-performance 3D vegetation for racing circuits:
 * - Curved multi-blade grass tufts
 * - Mediterranean Racing Pines, European Broadleaf Oaks, Italian Cypresses, and Dense Shrubs
 * - 100% Hardware Instanced rendering (Draw calls cut from thousands to single digits)
 * - Zero collision interference on active track surface
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { safeMergeBufferGeometries } from '../utils/GeometryUtils';

export interface TreePlacementConfig {
  x: number;
  z: number;
  scale: number;
  yaw: number;
  type: 'pine' | 'oak' | 'cypress' | 'bush' | 'photorealistic_tree';
}

export interface VegetationMaterials {
  trunkMat: THREE.Material;
  pineFoliageMat: THREE.Material;
  oakFoliageMat: THREE.Material;
  cypressFoliageMat: THREE.Material;
  bushMat: THREE.Material;
}

export interface PhotorealisticTreeAssets {
  trunkGeo: THREE.BufferGeometry;
  trunkMat: THREE.MeshStandardMaterial;
  foliageGeo: THREE.BufferGeometry;
  foliageMat: THREE.MeshStandardMaterial;
  clumpGeo: THREE.BufferGeometry;
  clumpMat: THREE.MeshStandardMaterial;
}

export class OrganicVegetationSystem {
  private static cachedTuftGeo: THREE.BufferGeometry | null = null;
  private static cachedPineGeos: { trunk: THREE.BufferGeometry; foliage: THREE.BufferGeometry } | null = null;
  private static cachedOakGeos: { trunk: THREE.BufferGeometry; foliage: THREE.BufferGeometry } | null = null;
  private static cachedCypressGeos: { trunk: THREE.BufferGeometry; foliage: THREE.BufferGeometry } | null = null;
  private static cachedBushGeo: THREE.BufferGeometry | null = null;

  public static cachedTreeAssets: PhotorealisticTreeAssets | null = null;
  private static isTreeLoading: boolean = false;
  private static treeLoadPromise: Promise<PhotorealisticTreeAssets | null> | null = null;

  /**
   * Generates a curved grass tuft prototype geometry with 3 cross-planes.
   */
  public static createCurvedGrassTuftGeometry(): THREE.BufferGeometry {
    if (this.cachedTuftGeo) return this.cachedTuftGeo;

    const planes: THREE.BufferGeometry[] = [];
    const bladeW = 0.42;
    const bladeH = 0.48;

    for (let i = 0; i < 3; i++) {
      const plane = new THREE.PlaneGeometry(bladeW, bladeH, 1, 2);
      // Anchor at base
      plane.translate(0, bladeH * 0.5, 0);

      // Curve upper vertices slightly outwards
      const pos = plane.attributes.position as THREE.BufferAttribute;
      for (let j = 0; j < pos.count; j++) {
        const y = pos.getY(j);
        if (y > bladeH * 0.4) {
          const zOffset = (y / bladeH) * 0.08 * (i === 1 ? -1 : 1);
          pos.setZ(j, pos.getZ(j) + zOffset);
        }
      }

      plane.rotateY((i * Math.PI) / 3);
      planes.push(plane);
    }

    const merged = safeMergeBufferGeometries(planes);
    planes.forEach((p) => p.dispose());

    this.cachedTuftGeo = merged || new THREE.PlaneGeometry(bladeW, bladeH);
    return this.cachedTuftGeo;
  }

  /**
   * Applies organic vertex colors with ambient occlusion and height gradient to foliage geometries.
   */
  private static addFoliageColors(geo: THREE.BufferGeometry, lowColorHex: number, highColorHex: number): void {
    geo.computeBoundingBox();
    const bbox = geo.boundingBox;
    const minY = bbox ? bbox.min.y : 0;
    const maxY = bbox ? bbox.max.y : 10;
    const rangeY = Math.max(0.001, maxY - minY);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    if (!pos) return;

    const count = pos.count;
    const colors = new Float32Array(count * 3);
    const cLow = new THREE.Color(lowColorHex);
    const cHigh = new THREE.Color(highColorHex);
    const tempColor = new THREE.Color();

    for (let i = 0; i < count; i++) {
      const y = pos.getY(i);
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const t = THREE.MathUtils.clamp((y - minY) / rangeY, 0, 1);
      const jitter = Math.sin(x * 3.7 + z * 5.3) * 0.08;
      tempColor.copy(cLow).lerp(cHigh, THREE.MathUtils.clamp(t + jitter, 0, 1));
      colors[i * 3] = tempColor.r;
      colors[i * 3 + 1] = tempColor.g;
      colors[i * 3 + 2] = tempColor.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }

  /**
   * Pre-generates merged prototype geometries for Mediterranean Racing Pine.
   */
  public static createPineGeometries(): { trunk: THREE.BufferGeometry; foliage: THREE.BufferGeometry } {
    if (this.cachedPineGeos) {
      return this.cachedPineGeos;
    }

    // 1. Slender tall trunk with subtle organic bend
    const trunk = new THREE.CylinderGeometry(0.32, 0.52, 9.5, 8);
    trunk.translate(0, 4.75, 0);

    // 2. Distinctive high umbrella canopy (multi-tiered horizontal tiers)
    const folGeos: THREE.BufferGeometry[] = [];
    const tiers = [
      { y: 7.2, r: 4.8, h: 2.2 },
      { y: 8.6, r: 4.2, h: 2.0 },
      { y: 9.8, r: 3.2, h: 1.8 },
      { y: 10.8, r: 1.8, h: 1.4 },
    ];

    tiers.forEach((t) => {
      const cone = new THREE.ConeGeometry(t.r, t.h, 7);
      cone.translate(0, t.y, 0);
      folGeos.push(cone);
    });

    const foliageMerged = safeMergeBufferGeometries(folGeos) || new THREE.ConeGeometry(4.0, 4.0, 7);
    folGeos.forEach((g) => g.dispose());
    this.addFoliageColors(foliageMerged, 0x3d5c28, 0x82b044);

    this.cachedPineGeos = {
      trunk,
      foliage: foliageMerged,
    };

    return this.cachedPineGeos;
  }

  /**
   * Pre-generates merged prototype geometries for Broadleaf European Oak.
   */
  public static createOakGeometries(): { trunk: THREE.BufferGeometry; foliage: THREE.BufferGeometry } {
    if (this.cachedOakGeos) {
      return this.cachedOakGeos;
    }

    // Gnarled wide trunk
    const trunk = new THREE.CylinderGeometry(0.55, 0.85, 4.8, 8);
    trunk.translate(0, 2.4, 0);

    // Volumetric organic crown clusters
    const folGeos: THREE.BufferGeometry[] = [];
    const crowns = [
      { x: 0, y: 5.6, z: 0, r: 3.8 },
      { x: -1.8, y: 4.6, z: 1.2, r: 2.9 },
      { x: 1.9, y: 4.8, z: -0.9, r: 2.8 },
      { x: 0.8, y: 5.2, z: 1.8, r: 2.6 },
      { x: -1.2, y: 5.0, z: -1.6, r: 2.7 },
    ];

    crowns.forEach((c) => {
      const sphere = new THREE.DodecahedronGeometry(c.r, 1);
      sphere.translate(c.x, c.y, c.z);
      folGeos.push(sphere);
    });

    const foliageMerged = safeMergeBufferGeometries(folGeos) || new THREE.DodecahedronGeometry(4.2, 1);
    folGeos.forEach((g) => g.dispose());
    this.addFoliageColors(foliageMerged, 0x335924, 0x76a33b);

    this.cachedOakGeos = {
      trunk,
      foliage: foliageMerged,
    };

    return this.cachedOakGeos;
  }

  /**
   * Pre-generates merged prototype geometries for Slender Italian Cypress.
   */
  public static createCypressGeometries(): { trunk: THREE.BufferGeometry; foliage: THREE.BufferGeometry } {
    if (this.cachedCypressGeos) {
      return this.cachedCypressGeos;
    }

    // Short stout base trunk
    const trunk = new THREE.CylinderGeometry(0.24, 0.38, 2.6, 6);
    trunk.translate(0, 1.3, 0);

    // Tall slender columnar flame crown
    const folGeos: THREE.BufferGeometry[] = [];
    const cone1 = new THREE.ConeGeometry(1.4, 8.2, 7);
    cone1.translate(0, 5.8, 0);
    folGeos.push(cone1);

    const cone2 = new THREE.ConeGeometry(1.65, 5.4, 7);
    cone2.translate(0, 4.4, 0);
    folGeos.push(cone2);

    const foliageMerged = safeMergeBufferGeometries(folGeos) || new THREE.ConeGeometry(1.5, 8.0, 7);
    folGeos.forEach((g) => g.dispose());
    this.addFoliageColors(foliageMerged, 0x27451c, 0x548232);

    this.cachedCypressGeos = {
      trunk,
      foliage: foliageMerged,
    };

    return this.cachedCypressGeos;
  }

  /**
   * Pre-generates merged prototype geometry for Organic Bush Cluster.
   */
  public static createBushGeometry(): THREE.BufferGeometry {
    if (this.cachedBushGeo) return this.cachedBushGeo;

    const folGeos: THREE.BufferGeometry[] = [];
    const spheres = [
      { x: 0, y: 0.95, z: 0, r: 1.25 },
      { x: -0.7, y: 0.8, z: 0.4, r: 0.95 },
      { x: 0.75, y: 0.75, z: -0.35, r: 1.0 },
      { x: 0.2, y: 0.7, z: 0.75, r: 0.85 },
    ];

    spheres.forEach((s) => {
      const geo = new THREE.DodecahedronGeometry(s.r, 1);
      geo.translate(s.x, s.y, s.z);
      folGeos.push(geo);
    });

    const merged = safeMergeBufferGeometries(folGeos) || new THREE.DodecahedronGeometry(1.4, 1);
    folGeos.forEach((g) => g.dispose());
    this.addFoliageColors(merged, 0x2e4f20, 0x6e9c35);

    this.cachedBushGeo = merged;
    return this.cachedBushGeo;
  }

  /**
   * Preloader stub: keeps API compatibility without loading external 3D GLB tree meshes.
   */
  public static async preloadPhotorealisticTreeModel(): Promise<PhotorealisticTreeAssets | null> {
    return Promise.resolve(null);
  }

  /**
   * Builds the entire forest of trees and bushes using high-efficiency InstancedMesh batches
   * partitioned into an 8x8 spatial grid (64 sectors) to enable granular native Three.js Frustum Culling.
   * Restores circuit trees (Pines, Oaks, Cypresses, Bushes) with authentic materials and high framerates.
   */
  public static buildVegetationForest(
    parentGroup: THREE.Group,
    trees: TreePlacementConfig[],
    materials: VegetationMaterials,
    staticObstacles?: any[]
  ): void {
    if (!trees || trees.length === 0) return;

    const dummy = new THREE.Object3D();

    // High-resolution 8x8 spatial partitioning grid spanning -230m to +230m (57.5m cells)
    const gridDim = 8;
    const minCoord = -230;
    const maxCoord = 230;
    const totalSpan = maxCoord - minCoord;
    const cellSize = totalSpan / gridDim;

    const getCellIndex = (x: number, z: number): number => {
      const cx = Math.max(0, Math.min(gridDim - 1, Math.floor((x - minCoord) / cellSize)));
      const cz = Math.max(0, Math.min(gridDim - 1, Math.floor((z - minCoord) / cellSize)));
      return cz * gridDim + cx;
    };

    const partition = (items: TreePlacementConfig[]) => {
      const cells: TreePlacementConfig[][] = Array.from({ length: gridDim * gridDim }, () => []);
      for (let i = 0; i < items.length; i++) {
        cells[getCellIndex(items[i].x, items[i].z)].push(items[i]);
      }
      return cells;
    };

    // Pre-generate shared geometries once
    const { trunk: pTrunkGeo, foliage: pFolGeo } = this.createPineGeometries();
    const { trunk: oTrunkGeo, foliage: oFolGeo } = this.createOakGeometries();
    const { trunk: cTrunkGeo, foliage: cFolGeo } = this.createCypressGeometries();
    const bushGeo = this.createBushGeometry();

    // 1. MEDITERRANEAN RACING PINES
    const pineTrees = trees.filter((t) => t.type === 'pine');
    const pineQuads = partition(pineTrees);
    pineQuads.forEach((quadItems, cellIdx) => {
      if (quadItems.length === 0) return;
      const count = quadItems.length;

      const cellX = (cellIdx % gridDim) * cellSize + minCoord + cellSize * 0.5;
      const cellZ = Math.floor(cellIdx / gridDim) * cellSize + minCoord + cellSize * 0.5;
      const isNearTrack = Math.abs(cellX) < 148 && Math.abs(cellZ) < 148;
      const isTrackCorridorFoliage = Math.abs(cellX) < 132 && Math.abs(cellZ) < 132;

      const trunkMesh = new THREE.InstancedMesh(pTrunkGeo, materials.trunkMat, count);
      const folMesh = new THREE.InstancedMesh(pFolGeo, materials.pineFoliageMat, count);

      trunkMesh.castShadow = isNearTrack;
      trunkMesh.receiveShadow = true;
      trunkMesh.frustumCulled = true;

      folMesh.castShadow = isTrackCorridorFoliage;
      folMesh.receiveShadow = true;
      folMesh.frustumCulled = true;

      quadItems.forEach((t, idx) => {
        dummy.position.set(t.x, 0, t.z);
        dummy.rotation.set(0, t.yaw, 0);
        dummy.scale.set(t.scale, t.scale, t.scale);
        dummy.updateMatrix();

        trunkMesh.setMatrixAt(idx, dummy.matrix);
        folMesh.setMatrixAt(idx, dummy.matrix);

        if (staticObstacles && !staticObstacles.some((o: any) => o.type === 'tree' && Math.hypot(o.x - t.x, o.z - t.z) < 1.5)) {
          staticObstacles.push({
            x: t.x,
            z: t.z,
            radius: 0.65 * t.scale,
            type: 'tree',
          });
        }
      });

      trunkMesh.instanceMatrix.needsUpdate = true;
      folMesh.instanceMatrix.needsUpdate = true;
      trunkMesh.computeBoundingSphere();
      trunkMesh.computeBoundingBox();
      folMesh.computeBoundingSphere();
      folMesh.computeBoundingBox();

      parentGroup.add(trunkMesh);
      parentGroup.add(folMesh);
    });

    // 2. BROADLEAF EUROPEAN OAKS
    const oakTrees = trees.filter((t) => t.type === 'oak' || t.type === 'photorealistic_tree');
    const oakQuads = partition(oakTrees);
    oakQuads.forEach((quadItems, cellIdx) => {
      if (quadItems.length === 0) return;
      const count = quadItems.length;

      const cellX = (cellIdx % gridDim) * cellSize + minCoord + cellSize * 0.5;
      const cellZ = Math.floor(cellIdx / gridDim) * cellSize + minCoord + cellSize * 0.5;
      const isNearTrack = Math.abs(cellX) < 148 && Math.abs(cellZ) < 148;
      const isTrackCorridorFoliage = Math.abs(cellX) < 132 && Math.abs(cellZ) < 132;

      const trunkMesh = new THREE.InstancedMesh(oTrunkGeo, materials.trunkMat, count);
      const folMesh = new THREE.InstancedMesh(oFolGeo, materials.oakFoliageMat, count);

      trunkMesh.castShadow = isNearTrack;
      trunkMesh.receiveShadow = true;
      trunkMesh.frustumCulled = true;

      folMesh.castShadow = isTrackCorridorFoliage;
      folMesh.receiveShadow = true;
      folMesh.frustumCulled = true;

      quadItems.forEach((t, idx) => {
        dummy.position.set(t.x, 0, t.z);
        dummy.rotation.set(0, t.yaw, 0);
        dummy.scale.set(t.scale, t.scale, t.scale);
        dummy.updateMatrix();

        trunkMesh.setMatrixAt(idx, dummy.matrix);
        folMesh.setMatrixAt(idx, dummy.matrix);

        if (staticObstacles && !staticObstacles.some((o: any) => o.type === 'tree' && Math.hypot(o.x - t.x, o.z - t.z) < 1.5)) {
          staticObstacles.push({
            x: t.x,
            z: t.z,
            radius: 0.85 * t.scale,
            type: 'tree',
          });
        }
      });

      trunkMesh.instanceMatrix.needsUpdate = true;
      folMesh.instanceMatrix.needsUpdate = true;
      trunkMesh.computeBoundingSphere();
      trunkMesh.computeBoundingBox();
      folMesh.computeBoundingSphere();
      folMesh.computeBoundingBox();

      parentGroup.add(trunkMesh);
      parentGroup.add(folMesh);
    });

    // 3. SLENDER ITALIAN CYPRESSES
    const cypressTrees = trees.filter((t) => t.type === 'cypress');
    const cypressQuads = partition(cypressTrees);
    cypressQuads.forEach((quadItems, cellIdx) => {
      if (quadItems.length === 0) return;
      const count = quadItems.length;

      const cellX = (cellIdx % gridDim) * cellSize + minCoord + cellSize * 0.5;
      const cellZ = Math.floor(cellIdx / gridDim) * cellSize + minCoord + cellSize * 0.5;
      const isNearTrack = Math.abs(cellX) < 148 && Math.abs(cellZ) < 148;
      const isTrackCorridorFoliage = Math.abs(cellX) < 132 && Math.abs(cellZ) < 132;

      const trunkMesh = new THREE.InstancedMesh(cTrunkGeo, materials.trunkMat, count);
      const folMesh = new THREE.InstancedMesh(cFolGeo, materials.cypressFoliageMat, count);

      trunkMesh.castShadow = isNearTrack;
      trunkMesh.receiveShadow = true;
      trunkMesh.frustumCulled = true;

      folMesh.castShadow = isTrackCorridorFoliage;
      folMesh.receiveShadow = true;
      folMesh.frustumCulled = true;

      quadItems.forEach((t, idx) => {
        dummy.position.set(t.x, 0, t.z);
        dummy.rotation.set(0, t.yaw, 0);
        dummy.scale.set(t.scale, t.scale, t.scale);
        dummy.updateMatrix();

        trunkMesh.setMatrixAt(idx, dummy.matrix);
        folMesh.setMatrixAt(idx, dummy.matrix);

        if (staticObstacles && !staticObstacles.some((o: any) => o.type === 'tree' && Math.hypot(o.x - t.x, o.z - t.z) < 1.5)) {
          staticObstacles.push({
            x: t.x,
            z: t.z,
            radius: 0.45 * t.scale,
            type: 'tree',
          });
        }
      });

      trunkMesh.instanceMatrix.needsUpdate = true;
      folMesh.instanceMatrix.needsUpdate = true;
      trunkMesh.computeBoundingSphere();
      trunkMesh.computeBoundingBox();
      folMesh.computeBoundingSphere();
      folMesh.computeBoundingBox();

      parentGroup.add(trunkMesh);
      parentGroup.add(folMesh);
    });

    // 4. ORGANIC BUSHES
    const bushTrees = trees.filter((t) => t.type === 'bush');
    const bushQuads = partition(bushTrees);
    bushQuads.forEach((quadItems) => {
      if (quadItems.length === 0) return;
      const count = quadItems.length;
      const bushMesh = new THREE.InstancedMesh(bushGeo, materials.bushMat, count);

      bushMesh.castShadow = false;
      bushMesh.receiveShadow = false;
      bushMesh.frustumCulled = true;

      quadItems.forEach((b, idx) => {
        dummy.position.set(b.x, 0, b.z);
        dummy.rotation.set(0, b.yaw, 0);
        dummy.scale.set(b.scale, b.scale, b.scale);
        dummy.updateMatrix();

        bushMesh.setMatrixAt(idx, dummy.matrix);
      });

      bushMesh.instanceMatrix.needsUpdate = true;
      bushMesh.computeBoundingSphere();
      bushMesh.computeBoundingBox();
      parentGroup.add(bushMesh);
    });
  }
}
