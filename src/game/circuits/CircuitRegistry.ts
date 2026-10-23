/**
 * CircuitRegistry.ts - Central Catalog & Factory for all Simulation Tracks
 * Decouples circuit selection completely from physics and game loops.
 */

import { CircuitId, ICircuitDefinition } from './ICircuit';
import { SquareCircuitConfig } from './square/SquareCircuitConfig';
import { SpeedwayCircuitConfig } from './speedway/SpeedwayCircuitConfig';
import { SingaporeCircuitConfig } from './singapore/SingaporeCircuitConfig';

export const AVAILABLE_CIRCUITS: ICircuitDefinition[] = [
  SquareCircuitConfig,
  SpeedwayCircuitConfig,
  SingaporeCircuitConfig,
];

export const DEFAULT_CIRCUIT_ID: CircuitId = 'speedway_gp';

export function getCircuit(id?: CircuitId | string | null): ICircuitDefinition {
  if (!id) return SquareCircuitConfig;
  const found = AVAILABLE_CIRCUITS.find((c) => c.id === id);
  return found || SquareCircuitConfig;
}
