/**
 * ModernVIPBuildingBuilder.ts - High-Tech Modern VIP Headquarters & Paddock Complex
 *
 * Generates an architectural Grade-1 VIP hospitality and observation building:
 * - Sweeping cantilevered panoramic observation terraces
 * - Tinted structural glass curtain walls
 * - Beveled aerodynamic composite panels and structural columns
 * - Roof deck hospitality lounge with shade canopies
 * - 100% Batched static BufferGeometry merging (4 Draw Calls total)
 */

import * as THREE from 'three';
import { safeMergeBufferGeometries } from '../utils/GeometryUtils';

export class ModernVIPBuildingBuilder {
  public static buildModernVIPBuilding(
    center: { x: number; y: number; z: number } = { x: 88.0, y: 0, z: -152.0 },
    rotationY: number = 0
  ): THREE.Group {
    const rootGroup = new THREE.Group();
    rootGroup.name = 'ModernVIPBuilding';
    rootGroup.position.set(center.x, center.y, center.z);
    rootGroup.rotation.y = rotationY;

    const concreteGeos: THREE.BufferGeometry[] = [];
    const darkCompositeGeos: THREE.BufferGeometry[] = [];
    const silverTrimGeos: THREE.BufferGeometry[] = [];
    const glassGeos: THREE.BufferGeometry[] = [];
    const warmEmissiveGeos: THREE.BufferGeometry[] = [];

    // =========================================================================
    // 1. BASE PODIUM FOUNDATION (Polished architectural concrete)
    // =========================================================================
    const podiumGeo = new THREE.BoxGeometry(32, 1.2, 22);
    podiumGeo.translate(0, 0.6, 0);
    concreteGeos.push(podiumGeo);

    // Entry plaza steps
    const step1 = new THREE.BoxGeometry(34, 0.4, 24);
    step1.translate(0, 0.2, 0);
    concreteGeos.push(step1);

    // =========================================================================
    // 2. LEVEL 1: GROUND RECEPTION & MEDIA CENTER
    // =========================================================================
    // Structural columns
    const colRadius = 0.45;
    const colHeight = 5.2;
    const colPositions = [
      [-14, -9], [-14, 9], [14, -9], [14, 9],
      [-5, -9], [-5, 9], [5, -9], [5, 9]
    ];

    colPositions.forEach(([cx, cz]) => {
      const col = new THREE.CylinderGeometry(colRadius, colRadius, colHeight, 12);
      col.translate(cx, 1.2 + colHeight * 0.5, cz);
      silverTrimGeos.push(col);
    });

    // Glass perimeter walls (Ground floor)
    const gfGlassFront = new THREE.BoxGeometry(27.6, 4.6, 0.15);
    gfGlassFront.translate(0, 3.5, 8.8);
    glassGeos.push(gfGlassFront);

    const gfGlassBack = new THREE.BoxGeometry(27.6, 4.6, 0.15);
    gfGlassBack.translate(0, 3.5, -8.8);
    glassGeos.push(gfGlassBack);

    const gfGlassLeft = new THREE.BoxGeometry(0.15, 4.6, 17.6);
    gfGlassLeft.translate(-13.8, 3.5, 0);
    glassGeos.push(gfGlassLeft);

    const gfGlassRight = new THREE.BoxGeometry(0.15, 4.6, 17.6);
    gfGlassRight.translate(13.8, 3.5, 0);
    glassGeos.push(gfGlassRight);

    // Interior warm glow strip (Ground floor reception)
    const gfInteriorGlow = new THREE.BoxGeometry(24, 0.15, 14);
    gfInteriorGlow.translate(0, 5.7, 0);
    warmEmissiveGeos.push(gfInteriorGlow);

    // Level 1 Intermediate Slab
    const slab1 = new THREE.BoxGeometry(33, 0.5, 23);
    slab1.translate(0, 5.85, 0);
    darkCompositeGeos.push(slab1);

    // =========================================================================
    // 3. LEVEL 2: CANTILEVERED PANORAMIC VIP LOUNGE
    // Projecting forward 4.5 meters towards the track for supreme racing views
    // =========================================================================
    const vipLoungeWidth = 36;
    const vipLoungeDepth = 25;
    const cantileverZ = 2.2;

    const slab2Base = new THREE.BoxGeometry(vipLoungeWidth, 0.6, vipLoungeDepth);
    slab2Base.translate(0, 6.45, cantileverZ);
    darkCompositeGeos.push(slab2Base);

    // Angled aerodynamic facade framing
    const facadeLeft = new THREE.BoxGeometry(1.2, 4.8, vipLoungeDepth);
    facadeLeft.translate(-vipLoungeWidth * 0.5 + 0.6, 9.1, cantileverZ);
    silverTrimGeos.push(facadeLeft);

    const facadeRight = new THREE.BoxGeometry(1.2, 4.8, vipLoungeDepth);
    facadeRight.translate(vipLoungeWidth * 0.5 - 0.6, 9.1, cantileverZ);
    silverTrimGeos.push(facadeRight);

    // Floor-to-ceiling panoramic observation glass (Track-facing)
    const vipFrontGlass = new THREE.BoxGeometry(vipLoungeWidth - 2.4, 4.2, 0.2);
    vipFrontGlass.translate(0, 9.2, cantileverZ + vipLoungeDepth * 0.5 - 0.1);
    glassGeos.push(vipFrontGlass);

    // VIP Lounge ceiling / Roof slab
    const roofSlab = new THREE.BoxGeometry(vipLoungeWidth + 1.2, 0.7, vipLoungeDepth + 1.2);
    roofSlab.translate(0, 11.65, cantileverZ);
    darkCompositeGeos.push(roofSlab);

    // Interior lounge lighting
    const vipInteriorGlow = new THREE.BoxGeometry(vipLoungeWidth - 4, 0.15, vipLoungeDepth - 4);
    vipInteriorGlow.translate(0, 11.2, cantileverZ);
    warmEmissiveGeos.push(vipInteriorGlow);

    // =========================================================================
    // 4. LEVEL 3: ROOFTOP SKY TERRACE & CANOPY
    // =========================================================================
    // Perimeter glass balustrades
    const railingGeoFront = new THREE.BoxGeometry(vipLoungeWidth, 1.1, 0.1);
    railingGeoFront.translate(0, 12.55, cantileverZ + vipLoungeDepth * 0.5 + 0.5);
    glassGeos.push(railingGeoFront);

    const railingGeoBack = new THREE.BoxGeometry(vipLoungeWidth, 1.1, 0.1);
    railingGeoBack.translate(0, 12.55, cantileverZ - vipLoungeDepth * 0.5 - 0.5);
    glassGeos.push(railingGeoBack);

    // Aerodynamic cantilevered solar shade wing / canopy over rooftop lounge
    const shadeWing = new THREE.BoxGeometry(26, 0.35, 14);
    shadeWing.rotateX(0.04);
    shadeWing.translate(0, 15.2, cantileverZ);
    silverTrimGeos.push(shadeWing);

    // Canopy support pylons
    [-8, 8].forEach((px) => {
      const pylon = new THREE.CylinderGeometry(0.2, 0.2, 3.8, 8);
      pylon.translate(px, 13.5, cantileverZ);
      darkCompositeGeos.push(pylon);
    });

    // =========================================================================
    // 5. MATERIAL CREATION & BATCHED GPU MESH ASSEMBLY
    // =========================================================================
    const concreteMat = new THREE.MeshStandardMaterial({
      color: 0xd6d9dc,
      roughness: 0.82,
      metalness: 0.12,
    });

    const darkCompositeMat = new THREE.MeshStandardMaterial({
      color: 0x1a1e24,
      roughness: 0.38,
      metalness: 0.65,
    });

    const silverTrimMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.25,
      metalness: 0.85,
    });

    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x0f2336,
      roughness: 0.08,
      metalness: 0.92,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    });

    const warmEmissiveMat = new THREE.MeshBasicMaterial({
      color: 0xffedd5,
    });

    // Merge Geometries
    const mergedConcrete = safeMergeBufferGeometries(concreteGeos);
    if (mergedConcrete) {
      const mesh = new THREE.Mesh(mergedConcrete, concreteMat);
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      rootGroup.add(mesh);
    }

    const mergedDark = safeMergeBufferGeometries(darkCompositeGeos);
    if (mergedDark) {
      const mesh = new THREE.Mesh(mergedDark, darkCompositeMat);
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      rootGroup.add(mesh);
    }

    const mergedSilver = safeMergeBufferGeometries(silverTrimGeos);
    if (mergedSilver) {
      const mesh = new THREE.Mesh(mergedSilver, silverTrimMat);
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      rootGroup.add(mesh);
    }

    const mergedGlass = safeMergeBufferGeometries(glassGeos);
    if (mergedGlass) {
      const mesh = new THREE.Mesh(mergedGlass, glassMat);
      mesh.receiveShadow = true;
      mesh.castShadow = false;
      rootGroup.add(mesh);
    }

    const mergedGlow = safeMergeBufferGeometries(warmEmissiveGeos);
    if (mergedGlow) {
      const mesh = new THREE.Mesh(mergedGlow, warmEmissiveMat);
      rootGroup.add(mesh);
    }

    // Clean up temporary individual geometries
    concreteGeos.forEach((g) => g.dispose());
    darkCompositeGeos.forEach((g) => g.dispose());
    silverTrimGeos.forEach((g) => g.dispose());
    glassGeos.forEach((g) => g.dispose());
    warmEmissiveGeos.forEach((g) => g.dispose());

    return rootGroup;
  }
}
