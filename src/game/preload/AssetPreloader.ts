/**
 * AssetPreloader.ts - Synchronous High-Fidelity Asset & Shader Preloader
 *
 * Ensures the assets required by the selected circuit are cached and pre-warmed
 * before the race begins, without loading scenery owned by unrelated circuits.
 */

import { DistantMountainBackdropBuilder } from '../world/DistantMountainBackdropBuilder';
import { GrandstandCrowdSystem } from '../crowd/GrandstandCrowdSystem';
import { TrackBuilder } from '../world/TrackBuilder';
import { OrganicVegetationSystem } from '../world/OrganicVegetationSystem';
import { RoyalEngineResidencesBuilder } from '../world/RoyalEngineResidencesBuilder';

export type PreloadProgressCallback = (percent: number, stageMessage: string) => void;

export class AssetPreloader {
  private static readonly preloadedKinds = new Set<string>();

  public static async preloadAll(onProgress?: PreloadProgressCallback, circuitId?: string): Promise<void> {
    const preloadKind = circuitId === 'singapore_marina' ? 'singapore_marina' : 'other';
    if (this.preloadedKinds.has(preloadKind)) {
      onProgress?.(100, 'Activos 3D en caché listos...');
      return;
    }

    try {
      if (circuitId === 'singapore_marina') {
        onProgress?.(20, 'Omitiendo recursos de paisaje de otros circuitos para Marina Bay...');
      } else {
        // Stage 1: Alpine Massif Mountains & Biome Cavity Texture
        onProgress?.(20, 'Cargando macizo alpino 360° y texturas de alta resolución...');
        await DistantMountainBackdropBuilder.preload();
      }

      // The Singapore builder uses this crowd system as well as the other tracks.
      onProgress?.(40, 'Cargando modelos anatómicos del público e instanciación GPU...');
      await GrandstandCrowdSystem.preload();

      if (circuitId === 'singapore_marina') {
        // These assets are not referenced by SingaporeTrackBuilder.
        onProgress?.(60, 'Omitiendo activos de pista no utilizados en Marina Bay...');
        onProgress?.(75, 'Omitiendo vegetación no utilizada en Marina Bay...');
        onProgress?.(90, 'Omitiendo residencias de otros circuitos...');
      } else {
        // Stage 3: Modular Secondary Grandstand & Breakaway Brake Distance Markers
        onProgress?.(60, 'Cargando gradas modulares FIA y paneles de frenada...');
        await TrackBuilder.preloadAssets();

        // Stage 4: Circuit Vegetation & Instancing
        onProgress?.(75, 'Generando vegetación de circuito e instanciación GPU...');
        await OrganicVegetationSystem.preloadPhotorealisticTreeModel();

        // Stage 5: Royal Engine Residences Architecture
        onProgress?.(90, 'Cargando arquitectura Royal Engine Residences y optimización de texturas...');
        try {
          await RoyalEngineResidencesBuilder.preload();
        } catch (e) {
          console.warn('Non-fatal warning loading residences in preloader:', e);
        }
      }

      this.preloadedKinds.add(preloadKind);
      onProgress?.(98, 'Modelos 3D y texturas verificados en memoria.');
    } catch (err) {
      console.warn('Preload encountered a non-fatal warning, fallback assets active:', err);
      this.preloadedKinds.add(preloadKind);
    }
  }
}
