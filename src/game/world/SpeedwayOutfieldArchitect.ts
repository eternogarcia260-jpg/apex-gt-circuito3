/**
 * SpeedwayOutfieldArchitect.ts - High-Performance Italian Alpine Resort & Outfield Architecture
 * 
 * Circuit 2 (Speedway GP) Outfield Architecture:
 * - Italian Alpine Lakeshore Resort & Luxury Riviera Villas
 * - Organic Specular PBR Alpine Lake & Riva Classic Speedboat Marina
 * - Lakeside Promenade with curved travertine retaining walls and bronze balustrades
 * - Parabolica Observation Belvedere & Lounge
 * - Batched into minimal single-pass draw calls (100% fluid 60-120 FPS performance)
 */

import * as THREE from 'three';
import { safeMergeBufferGeometries } from '../utils/GeometryUtils';
import { StaticObstacle } from './TrackBuilder';
import { AlpineLakeAndVillasArchitect } from './AlpineLakeAndVillasArchitect';

export interface OutfieldArchitectMaterials {
  metalSilverMat: THREE.Material;
  metalDarkMat: THREE.Material;
  glassMat: THREE.Material;
  concreteMat: THREE.Material;
}

export class SpeedwayOutfieldArchitect {
  /**
   * Builds the entire Italian Alpine resort outfield environment for Circuit 2.
   */
  public static buildOutfieldEnvironment(
    materials: OutfieldArchitectMaterials,
    obstaclesList?: StaticObstacle[]
  ): THREE.Group {
    const environmentGroup = new THREE.Group();
    environmentGroup.name = 'SpeedwayOutfield_AlpineResort';

    // 1. Build Hyperrealistic Italian Alpine Lake, Specular PBR Water & Curvilinear VIP Villas
    const alpineResortGroup = AlpineLakeAndVillasArchitect.buildAlpineLakeshoreEnvironment(
      materials,
      obstaclesList
    );
    environmentGroup.add(alpineResortGroup);

    // 2. Build Curvone Lakeside Promenade & Belvedere Walkway
    const promenadeGroup = this.buildLakesidePromenadeBelvedere(materials, obstaclesList);
    environmentGroup.add(promenadeGroup);

    // 3. Build Parabolica Alpine Belvedere Pavilion
    const parabolicaPavilion = this.buildParabolicaPavilion(materials, obstaclesList);
    environmentGroup.add(parabolicaPavilion);

    return environmentGroup;
  }

  /**
   * 2. Curvone Lakeside Promenade & Belvedere
   * An elegant, curved travertine stone promenade flanking the western shore of the lake,
   * giving spectators and guests an unobstructed panoramic view of the lake and Curvone apex.
   */
  private static buildLakesidePromenadeBelvedere(
    _materials: OutfieldArchitectMaterials,
    obstaclesList?: StaticObstacle[]
  ): THREE.Group {
    const group = new THREE.Group();
    group.name = 'LakesidePromenadeBelvedere';

    const stoneGeos: THREE.BufferGeometry[] = [];
    const bronzeGeos: THREE.BufferGeometry[] = [];

    // Curved promenade spline along the lake bank (X: 458 to 468, Z: 50 to 140)
    const curvePoints = [
      new THREE.Vector3(460, 0.15, 48),
      new THREE.Vector3(458, 0.15, 75),
      new THREE.Vector3(459, 0.15, 105),
      new THREE.Vector3(463, 0.15, 135),
    ];

    const curve = new THREE.CatmullRomCurve3(curvePoints);
    const numSteps = 24;
    const points = curve.getPoints(numSteps);

    // Wide travertine paved walkway slab
    const walkWidth = 4.2;
    const slabGeos: THREE.BufferGeometry[] = [];

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const dir = new THREE.Vector3().subVectors(p2, p1);
      const len = dir.length();
      const angle = Math.atan2(dir.x, dir.z);

      const slabGeo = new THREE.BoxGeometry(walkWidth, 0.35, len + 0.1);
      slabGeo.rotateY(angle);
      const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
      slabGeo.translate(mid.x, mid.y, mid.z);
      slabGeos.push(slabGeo);

      // Bronze balustrade posts and top railing on lake side (+X)
      if (i % 2 === 0) {
        const postGeo = new THREE.CylinderGeometry(0.06, 0.08, 1.05, 8);
        const norm = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
        const postPos = mid.clone().addScaledVector(norm, walkWidth * 0.48);
        postGeo.translate(postPos.x, postPos.y + 0.65, postPos.z);
        bronzeGeos.push(postGeo);
      }
    }

    const mergedSlabs = safeMergeBufferGeometries(slabGeos);
    if (mergedSlabs) {
      stoneGeos.push(mergedSlabs);
    }

    // Handrail continuous tube along the lake edge
    const railPoints: THREE.Vector3[] = [];
    for (let i = 0; i <= numSteps; i++) {
      const p = points[i];
      const t = i / numSteps;
      const tangent = curve.getTangentAt(t).normalize();
      const norm = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
      railPoints.push(p.clone().addScaledVector(norm, walkWidth * 0.48).add(new THREE.Vector3(0, 1.15, 0)));
    }

    const railCurve = new THREE.CatmullRomCurve3(railPoints);
    const railGeo = new THREE.TubeGeometry(railCurve, 32, 0.045, 8, false);
    bronzeGeos.push(railGeo);

    const mergedStone = safeMergeBufferGeometries(stoneGeos);
    if (mergedStone) {
      const stoneMat = new THREE.MeshStandardMaterial({
        color: 0xd4c7b5, // Italian warm travertine paving
        roughness: 0.52,
        metalness: 0.08,
      });
      const stoneMesh = new THREE.Mesh(mergedStone, stoneMat);
      stoneMesh.castShadow = true;
      stoneMesh.receiveShadow = true;
      group.add(stoneMesh);
    }

    const mergedBronze = safeMergeBufferGeometries(bronzeGeos);
    if (mergedBronze) {
      const bronzeMat = new THREE.MeshStandardMaterial({
        color: 0x9c8266, // Warm champagne bronze
        roughness: 0.28,
        metalness: 0.82,
      });
      const bronzeMesh = new THREE.Mesh(mergedBronze, bronzeMat);
      bronzeMesh.castShadow = true;
      group.add(bronzeMesh);
    }

    if (obstaclesList) {
      obstaclesList.push({
        x: 460,
        z: 90,
        radius: 20.0,
        type: 'building',
      });
    }

    return group;
  }

  /**
   * 3. Parabolica Alpine Belvedere Pavilion
   * Positioned on the elevated outfield terrace at the entrance of La Gran Parabólica (X: -415, Z: 45).
   * Low-profile contemporary pavilion with floating circular roof and champagne bronze trim.
   */
  private static buildParabolicaPavilion(
    materials: OutfieldArchitectMaterials,
    obstaclesList?: StaticObstacle[]
  ): THREE.Group {
    const group = new THREE.Group();
    group.name = 'Parabolica_AlpinePavilion';
    group.position.set(-415, 0, 45);

    const R = 22.0;

    // Solid stepped stone podium (grounded)
    const podiumGeo = new THREE.CylinderGeometry(R, R * 1.06, 1.4, 32);
    podiumGeo.translate(0, 0.7, 0);
    const podiumMesh = new THREE.Mesh(podiumGeo, materials.concreteMat);
    podiumMesh.receiveShadow = true;
    podiumMesh.castShadow = true;
    group.add(podiumMesh);

    // Floating elliptical roof disc
    const roofGeo = new THREE.CylinderGeometry(R * 0.95, R * 0.95, 0.5, 32);
    roofGeo.scale(1.0, 1.0, 0.75);
    roofGeo.translate(0, 7.5, 0);
    const roofMesh = new THREE.Mesh(roofGeo, materials.metalSilverMat);
    roofMesh.castShadow = true;
    group.add(roofMesh);

    // Bronze fascia rim
    const rimGeo = new THREE.TorusGeometry(R * 0.95, 0.18, 10, 32);
    rimGeo.rotateX(Math.PI / 2);
    rimGeo.scale(1.0, 1.0, 0.75);
    rimGeo.translate(0, 7.5, 0);
    const rimMesh = new THREE.Mesh(rimGeo, materials.metalSilverMat);
    rimMesh.castShadow = true;
    group.add(rimMesh);

    // Panoramic glass core
    const glassGeo = new THREE.CylinderGeometry(R * 0.65, R * 0.65, 6.0, 28, 1, true);
    glassGeo.scale(1.0, 1.0, 0.75);
    glassGeo.translate(0, 4.4, 0);
    const glassMesh = new THREE.Mesh(glassGeo, materials.glassMat);
    glassMesh.castShadow = false;
    glassMesh.receiveShadow = true;
    group.add(glassMesh);

    // Slender bronze columns
    const colGeos: THREE.BufferGeometry[] = [];
    for (let c = 0; c < 8; c++) {
      const angle = (c / 8) * Math.PI * 2;
      const cx = Math.cos(angle) * R * 0.82;
      const cz = Math.sin(angle) * R * 0.82 * 0.75;
      const cGeo = new THREE.CylinderGeometry(0.12, 0.16, 6.4, 8);
      cGeo.translate(cx, 4.4, cz);
      colGeos.push(cGeo);
    }
    const mergedCols = safeMergeBufferGeometries(colGeos);
    if (mergedCols) {
      const colMesh = new THREE.Mesh(mergedCols, materials.metalSilverMat);
      colMesh.castShadow = true;
      group.add(colMesh);
    }

    if (obstaclesList) {
      obstaclesList.push({
        x: -415,
        z: 45,
        radius: R * 1.1,
        type: 'building',
      });
    }

    return group;
  }
}
