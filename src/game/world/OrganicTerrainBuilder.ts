/**
 * OrganicTerrainBuilder.ts - High-Performance Sculpted PBR Terrain Engine
 *
 * Generates natural undulating racing infield/outfield terrain with:
 * - Multi-frequency harmonic elevation sculpting (rolling berms & drainage contours)
 * - Zero-interference track safety clearance (strictly flattened near asphalt & kerbs)
 * - Photorealistic procedural PBR canvas textures (Albedo, Normal map, Roughness)
 * - 100% GPU optimized: single draw call, hardware vertex normals, receiveShadow enabled
 */

import * as THREE from 'three';

export interface GrassPBRTextures {
  albedo: THREE.CanvasTexture;
  normal: THREE.CanvasTexture;
  roughness: THREE.CanvasTexture;
}

export interface LakeDepressionConfig {
  centerX: number;
  centerZ: number;
  radiusX: number;
  radiusZ: number;
  depth: number;
}

export class OrganicTerrainBuilder {
  private static cachedTextures: GrassPBRTextures | null = null;

  /**
   * Generates or retrieves cached photorealistic procedural PBR grass textures.
   */
  public static createOrganicGrassPBRTextures(): GrassPBRTextures {
    if (this.cachedTextures) {
      return this.cachedTextures;
    }

    const size = 512;

    // 1. Height data for normal & roughness derivation
    const heightData = new Float32Array(size * size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        // Multi-octave natural turf noise
        const n1 = Math.sin(u * 32.0 + Math.cos(v * 28.0) * 1.5) * 0.5 + 0.5;
        const n2 = Math.sin(u * 96.0 + v * 84.0) * 0.5 + 0.5;
        const n3 = (Math.sin(u * 192.0) * Math.cos(v * 192.0)) * 0.5 + 0.5;
        heightData[y * size + x] = n1 * 0.55 + n2 * 0.30 + n3 * 0.15;
      }
    }

    // 2. Albedo Canvas
    const albCanvas = document.createElement('canvas');
    albCanvas.width = size;
    albCanvas.height = size;
    const albCtx = albCanvas.getContext('2d')!;
    const albImg = albCtx.createImageData(size, size);
    const albData = albImg.data;

    // Base turf tones (European Grade-1 circuit deep green/earth)
    const baseR = 64, baseG = 88, baseB = 52;
    const highR = 86, highG = 114, highB = 68;
    const lowR = 48, lowG = 66, lowB = 40;

    for (let i = 0; i < size * size; i++) {
      const h = heightData[i];
      const idx = i * 4;
      const r = Math.round(THREE.MathUtils.lerp(lowR, highR, h));
      const g = Math.round(THREE.MathUtils.lerp(lowG, highG, h));
      const b = Math.round(THREE.MathUtils.lerp(lowB, highB, h));
      albData[idx] = r;
      albData[idx + 1] = g;
      albData[idx + 2] = b;
      albData[idx + 3] = 255;
    }
    albCtx.putImageData(albImg, 0, 0);

    // 3. Normal Canvas (Sobel gradient filter)
    const normCanvas = document.createElement('canvas');
    normCanvas.width = size;
    normCanvas.height = size;
    const normCtx = normCanvas.getContext('2d')!;
    const normImg = normCtx.createImageData(size, size);
    const normData = normImg.data;

    for (let y = 0; y < size; y++) {
      const ym1 = (y - 1 + size) % size;
      const yp1 = (y + 1) % size;
      for (let x = 0; x < size; x++) {
        const xm1 = (x - 1 + size) % size;
        const xp1 = (x + 1) % size;

        const hL = heightData[y * size + xm1];
        const hR = heightData[y * size + xp1];
        const hU = heightData[ym1 * size + x];
        const hD = heightData[yp1 * size + x];

        const dx = (hR - hL) * 2.2;
        const dy = (hD - hU) * 2.2;
        const dz = 1.0;

        const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const nx = ((-dx / len) * 0.5 + 0.5) * 255;
        const ny = ((-dy / len) * 0.5 + 0.5) * 255;
        const nz = ((dz / len) * 0.5 + 0.5) * 255;

        const idx = (y * size + x) * 4;
        normData[idx] = Math.round(nx);
        normData[idx + 1] = Math.round(ny);
        normData[idx + 2] = Math.round(nz);
        normData[idx + 3] = 255;
      }
    }
    normCtx.putImageData(normImg, 0, 0);

    // 4. Roughness Canvas
    const roughCanvas = document.createElement('canvas');
    roughCanvas.width = size;
    roughCanvas.height = size;
    const roughCtx = roughCanvas.getContext('2d')!;
    const roughImg = roughCtx.createImageData(size, size);
    const roughData = roughImg.data;

    for (let i = 0; i < size * size; i++) {
      const h = heightData[i];
      const val = Math.round(THREE.MathUtils.lerp(210, 245, h));
      const idx = i * 4;
      roughData[idx] = val;
      roughData[idx + 1] = val;
      roughData[idx + 2] = val;
      roughData[idx + 3] = 255;
    }
    roughCtx.putImageData(roughImg, 0, 0);

    // Textures setup
    const albedoTex = new THREE.CanvasTexture(albCanvas);
    albedoTex.wrapS = THREE.RepeatWrapping;
    albedoTex.wrapT = THREE.RepeatWrapping;
    albedoTex.repeat.set(50, 50);

    const normalTex = new THREE.CanvasTexture(normCanvas);
    normalTex.wrapS = THREE.RepeatWrapping;
    normalTex.wrapT = THREE.RepeatWrapping;
    normalTex.repeat.set(50, 50);

    const roughnessTex = new THREE.CanvasTexture(roughCanvas);
    roughnessTex.wrapS = THREE.RepeatWrapping;
    roughnessTex.wrapT = THREE.RepeatWrapping;
    roughnessTex.repeat.set(50, 50);

    this.cachedTextures = {
      albedo: albedoTex,
      normal: normalTex,
      roughness: roughnessTex,
    };

    return this.cachedTextures;
  }

  /**
   * Generates sculpted natural landscape terrain mesh around the circuit.
   */
  public static buildSculptedTerrain(
    width: number,
    depth: number,
    segmentsW: number,
    segmentsD: number,
    material: THREE.Material,
    getDistToTrack: (x: number, z: number) => number,
    center?: { x: number; z: number },
    clearanceDist: number = 32.0,
    lakeDepression?: LakeDepressionConfig
  ): THREE.Mesh {
    const cx = center?.x ?? 0;
    const cz = center?.z ?? 0;

    const geo = new THREE.PlaneGeometry(width, depth, segmentsW, segmentsD);
    geo.rotateX(-Math.PI / 2);

    const posAttr = geo.attributes.position as THREE.BufferAttribute;
    const vertexCount = posAttr.count;

    for (let i = 0; i < vertexCount; i++) {
      const vx = posAttr.getX(i);
      const vz = posAttr.getZ(i);

      const worldX = vx + cx;
      const worldZ = vz + cz;

      const dist = getDistToTrack(worldX, worldZ);

      let height = 0;
      // Strictly flatten terrain across the entire circuit area, infield, and perimeter runoff (152m boundary)
      // This mathematically guarantees zero terrain triangles ever penetrate track asphalt, kerbs, or shoulders
      const isInfieldOrTrackCorridor = Math.abs(worldX) <= 152 && Math.abs(worldZ) <= 152;
      const isUnderPitOrPaddock = Math.abs(worldX) <= 125 && worldZ >= -140 && worldZ <= -65;
      const isNearAnyCorner = Math.hypot(Math.abs(worldX) - 92, Math.abs(worldZ) - 92) <= 70.0;

      if (isInfieldOrTrackCorridor || isUnderPitOrPaddock || isNearAnyCorner || dist <= clearanceDist + 16.0) {
        height = 0;
      } else {
        // Natural rolling harmonic terrain modulation strictly in the distant outfield beyond barrier walls
        const effectiveDist = dist - (clearanceDist + 16.0);
        const t = Math.min(1.0, effectiveDist / 36.0);
        const elevationWeight = t * t * (3 - 2 * t); // smoothstep transition

        // Low-frequency rolling waves (gentle drainage berms and natural rolling countryside)
        const wave1 = Math.sin(worldX * 0.012 + Math.cos(worldZ * 0.010) * 1.2) * 2.8;
        const wave2 = Math.cos(worldZ * 0.018 + worldX * 0.007) * 2.1;
        const wave3 = Math.sin((worldX + worldZ) * 0.024) * 0.9;

        height = Math.max(0, (wave1 + wave2 + wave3) * elevationWeight);
      }

      // Smooth lake basin depression: carves a natural sunken bowl below water level
      if (lakeDepression) {
        const ldx = (worldX - lakeDepression.centerX) / lakeDepression.radiusX;
        const ldz = (worldZ - lakeDepression.centerZ) / lakeDepression.radiusZ;
        const rNorm = Math.hypot(ldx, ldz);
        if (rNorm < 1.0) {
          const bowl = 1.0 - rNorm * rNorm;
          height = -lakeDepression.depth * bowl - 0.45;
        } else if (rNorm < 1.35) {
          const tShore = (rNorm - 1.0) / 0.35;
          const s = tShore * tShore * (3 - 2 * tShore);
          height = height * s + (-0.45) * (1.0 - s);
        }
      }

      posAttr.setY(i, height);
    }

    geo.computeVertexNormals();

    const mesh = new THREE.Mesh(geo, material);
    mesh.name = 'SculptedOrganicTerrain';
    mesh.position.set(cx, -0.04, cz);
    mesh.receiveShadow = true; // Enables deep, natural tree canopy and trackside structure shadows
    mesh.castShadow = false;

    return mesh;
  }
}
