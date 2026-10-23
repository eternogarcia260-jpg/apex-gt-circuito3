/**
 * SingaporeCircuitConfig.ts - Full Definition for FIA Marina Bay Street Circuit (Singapore Night GP)
 * Implements the ICircuitDefinition specification with 1:1 replica of the official 19-turn F1 map (~4,927m).
 */

import { ICircuitDefinition } from '../ICircuit';
import { SINGAPORE_WAYPOINTS, SINGAPORE_TOTAL_LENGTH, SINGAPORE_RACE_PACE_SPEED } from './SingaporeWaypoints';
import { SingaporeTrackBuilder } from './SingaporeTrackBuilder';

export const SingaporeCircuitConfig: ICircuitDefinition = {
  id: 'singapore_marina',
  name: 'Marina Bay',
  tagline: 'Gran Premio nocturno de Singapur: 4.927km y 19 curvas sobre mar abierto',
  country: 'Singapur',
  flagEmoji: '🇸🇬',
  totalLength: SINGAPORE_TOTAL_LENGTH,
  racePaceSpeed: SINGAPORE_RACE_PACE_SPEED,
  expectedLapTimeSec: 93.8, // 1:33.808 récord oficial Lewis Hamilton
  cornersCount: 19,
  topSpeedKmh: 355,
  drsZonesCount: 0,
  drsZones: [],
  waypoints: SINGAPORE_WAYPOINTS,
  pitZone: {
    minX: 697.0,
    maxX: 728.0,
    minZ: -185.0,
    maxZ: 25.0,
  },
  gridSlots: {
    player: {
      x: 687.89,
      z: -108.18,
      yaw: -2.996, // Facing North-Northwest (-Z) along the canonical pit straight
    },
    ai: (slot: number) => {
      const isLeft = slot % 2 === 1;
      const lateral = isLeft ? 3.5 : -3.5;
      // Staggered behind player along tangent (-0.145, -0.989) with normal (0.989, -0.145)
      return {
        x: Number((687.89 + 0.989 * lateral - (-0.145) * slot * 11.0).toFixed(2)),
        z: Number((-108.18 + (-0.145) * lateral - (-0.989) * slot * 11.0).toFixed(2)),
        yaw: -2.996,
      };
    },
  },
  checkSectorProgress: (x: number, z: number, currentSector: number) => {
    // Sector 1: Start line through Sheares and Raffles Blvd to Turn 7 Memorial Corner
    if (currentSector === 0 && x < -180 && z < -200) {
      return { newSector: 1, lapCompleted: false };
    }
    // Sector 2: Turn 7 through Stamford, Padang, and Anderson Bridge to Turn 14 Esplanade
    else if (currentSector === 1 && x > -380 && z < 50 && z > -50) {
      return { newSector: 2, lapCompleted: false };
    }
    // The old axis-aligned 60 m box completed laps before the timing line.
    // Use a narrow gate just AFTER the gantry in its local racing direction.
    else if (currentSector === 2) {
      const dx = x - 687.89;
      const dz = z + 108.18;
      const tx = Math.sin(-2.996);
      const tz = Math.cos(-2.996);
      const forward = dx * tx + dz * tz;
      const lateral = dx * tz - dz * tx;
      if (forward >= -0.1 && forward < 10 && Math.abs(lateral) < 7.2) {
        return { newSector: 0, lapCompleted: true };
      }
    }
    return { newSector: currentSector, lapCompleted: false };
  },
  minimapConfig: {
    viewBox: '0 0 100 100',
    svgTrackPath:
      'M 90.4 40.5 L 90.0 36.5 L 89.6 32.6 L 89.2 28.6 L 88.8 24.6 L 88.4 20.7 L 88.0 16.7 L 86.7 14.2 L 84.1 13.3 L 82.3 10.5 L 80.0 9.2 L 79.1 12.8 L 78.9 16.8 L 79.4 20.7 L 80.2 24.5 L 81.2 28.2 L 82.0 32.0 L 82.6 35.9 L 82.6 39.9 L 81.4 43.3 L 78.9 44.5 L 76.2 44.3 L 73.6 44.2 L 70.9 44.0 L 68.2 43.8 L 65.6 43.6 L 62.9 43.4 L 60.2 43.2 L 57.6 42.9 L 54.9 42.4 L 52.6 40.6 L 50.2 38.7 L 47.9 36.7 L 45.6 34.8 L 43.2 32.8 L 40.9 30.9 L 38.6 29.0 L 36.1 27.7 L 34.5 30.9 L 33.0 34.2 L 31.7 37.6 L 30.5 41.3 L 28.9 42.6 L 27.1 39.7 L 25.2 36.8 L 23.3 34.0 L 20.8 32.8 L 18.6 34.7 L 17.4 38.2 L 16.1 41.7 L 14.9 45.3 L 13.7 48.8 L 12.4 52.4 L 11.2 55.9 L 10.0 59.5 L 8.6 62.9 L 8.1 66.4 L 9.7 69.6 L 11.7 72.2 L 13.0 74.7 L 13.8 78.4 L 15.7 81.2 L 17.8 83.7 L 19.6 86.5 L 21.0 89.9 L 23.0 89.9 L 23.5 85.9 L 23.9 82.0 L 24.4 78.1 L 24.9 74.1 L 25.3 70.2 L 25.7 66.2 L 26.2 62.3 L 26.9 58.4 L 27.9 54.7 L 28.8 51.0 L 29.9 47.2 L 31.8 46.4 L 33.9 48.7 L 36.0 51.2 L 38.0 53.8 L 40.1 56.3 L 42.2 58.7 L 44.8 59.7 L 47.5 60.0 L 50.1 60.1 L 52.8 60.3 L 55.5 60.5 L 58.1 60.6 L 60.8 60.8 L 63.5 61.0 L 66.1 61.1 L 68.8 61.3 L 71.4 61.9 L 71.9 65.7 L 73.7 68.3 L 76.3 68.7 L 79.0 68.9 L 81.7 69.1 L 84.3 69.3 L 87.0 69.5 L 89.3 68.4 L 90.8 65.0 L 92.1 61.6 L 92.0 57.6 L 91.6 53.7 L 91.3 49.7 L 90.9 45.8 L 90.5 41.8 Z',
    pitLaneSvgPath: 'M 91.5 44 L 92.2 30',
    bounds: {
      minX: -750,
      maxX: 750,
      minZ: -500,
      maxZ: 500,
    },
  },
  createTrackBuilder: () => new SingaporeTrackBuilder(),
};
