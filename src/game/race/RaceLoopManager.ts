import { ICircuitDefinition, ITrackWorld } from '../circuits/ICircuit';
import { VehiclePhysics, CarInputs } from '../physics/VehiclePhysics';

/**
 * RaceLoopManager - Lap Timing, Sector Splits, DRS Zones, and Telemetry Records
 * Handles racing logic cleanly, saving records without frame drops.
 */
export class RaceLoopManager {
  public currentLapTime: number = 0;
  public bestLapTime: number | null = null;
  public lapCount: number = 1;
  public currentSector: number = 0;

  // DRS Management
  public playerDrsEligible: boolean = false;
  public playerInDrsZone: boolean = false;
  public lastPlayerDrsDetectionId: string | null = null;

  public activeCircuit: ICircuitDefinition;

  constructor(activeCircuit: ICircuitDefinition) {
    this.activeCircuit = activeCircuit;
    this.loadStoredBestLap();
  }

  public setCircuit(newCircuit: ICircuitDefinition): void {
    this.activeCircuit = newCircuit;
    this.currentSector = 0;
    this.currentLapTime = 0;
    this.lapCount = 1;
    this.playerDrsEligible = false;
    this.playerInDrsZone = false;
    this.lastPlayerDrsDetectionId = null;
    this.loadStoredBestLap();
  }

  public resetRaceState(laps: number = 1): void {
    this.currentSector = 0;
    this.currentLapTime = 0;
    this.lapCount = laps;
    this.playerDrsEligible = true;
    this.playerInDrsZone = false;
    this.lastPlayerDrsDetectionId = null;
  }

  public loadStoredBestLap(): void {
    try {
      const stored = localStorage.getItem(`apex_best_lap_${this.activeCircuit.id}`);
      this.bestLapTime = stored ? parseFloat(stored) : null;
    } catch {
      this.bestLapTime = null;
    }
  }

  public saveBestLap(time: number): void {
    this.bestLapTime = time;
    try {
      localStorage.setItem(`apex_best_lap_${this.activeCircuit.id}`, time.toString());
    } catch {}
  }

  public updateLapProgress(
    x: number,
    z: number,
    track: ITrackWorld
  ): { lapCompleted: boolean; newSector: number } {
    let lapCompleted = false;

    if (this.activeCircuit?.checkSectorProgress) {
      const res = this.activeCircuit.checkSectorProgress(x, z, this.currentSector);
      if (res.lapCompleted) {
        lapCompleted = true;
        if (!this.bestLapTime || this.currentLapTime < this.bestLapTime) {
          this.saveBestLap(this.currentLapTime);
        }
        this.lapCount++;
        this.currentLapTime = 0;
        this.currentSector = 0;
        if (track?.resetDynamicProps) {
          track.resetDynamicProps();
        }
      } else {
        this.currentSector = res.newSector;
      }
    } else {
      // Fallback sector detection
      if (this.currentSector === 0 && x > 40 && z < -50) {
        this.currentSector = 1;
      } else if (this.currentSector === 1 && x > 40 && z > 50) {
        this.currentSector = 2;
      } else if (this.currentSector === 2 && x < -40 && z > 50) {
        this.currentSector = 3;
      } else if (this.currentSector === 3 && x < -50 && z < -40) {
        this.currentSector = 4;
      } else if (this.currentSector === 4 && z < -105 && x >= -10.0 && x <= 15.0) {
        lapCompleted = true;
        if (!this.bestLapTime || this.currentLapTime < this.bestLapTime) {
          this.saveBestLap(this.currentLapTime);
        }
        this.lapCount++;
        this.currentLapTime = 0;
        this.currentSector = 0;
        if (track?.resetDynamicProps) {
          track.resetDynamicProps();
        }
      }
    }

    return { lapCompleted, newSector: this.currentSector };
  }

  public updateDRSSystem(
    _dt: number,
    physics: VehiclePhysics,
    inputs: CarInputs,
    _isFreePractice: boolean,
    _isMultiplayer: boolean
  ): void {
    const drsZones = this.activeCircuit?.drsZones;
    let insideAnyZone = false;

    if (drsZones && drsZones.length > 0) {
      const { x, z } = physics.position;
      for (let i = 0; i < drsZones.length; i++) {
        const zone = drsZones[i];
        if (zone.detectionPoint) {
          const dxDet = x - zone.detectionPoint.x;
          const dzDet = z - zone.detectionPoint.z;
          const distDetSq = dxDet * dxDet + dzDet * dzDet;
          const detRadius = zone.detectionPoint.radius || 12.0;
          if (distDetSq <= detRadius * detRadius) {
            this.playerDrsEligible = true;
          }
        } else {
          this.playerDrsEligible = true;
        }

        insideAnyZone = true;
      }
    } else {
      // An empty zone list means this circuit has no DRS zones.
      this.playerDrsEligible = false;
      insideAnyZone = false;
    }

    this.playerInDrsZone = insideAnyZone;

    // Wing flap damage safety disable
    if (physics.damage.drsFlapBroken || physics.damage.rearWingLeftDetached || physics.damage.rearWingRightDetached) {
      physics.isDrsAvailable = false;
      physics.isDrsOpen = false;
      inputs.drs = false;
      return;
    }

    physics.isDrsAvailable = this.playerInDrsZone && this.playerDrsEligible;

    // Automatic DRS closure on braking
    if (!physics.isDrsAvailable || inputs.brake > 0.05) {
      inputs.drs = false;
      physics.isDrsOpen = false;
    } else {
      physics.isDrsOpen = !!inputs.drs;
    }
  }
}
