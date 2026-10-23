/**
 * CareerTypes.ts - Multi-Car Grand Prix Race Definitions & Teams
 */

import { TireCompoundType } from '../physics/TireCompound';

export type RaceDifficulty = 'easy' | 'medium' | 'hard';
export type RaceLapOption = 9 | 20 | 50;

export interface TeamLiveryConfig {
  id: string;
  driverNumber: string;
  driverName: string;
  driverCode: string;
  teamName: string;
  primaryColor: string;       // Hex string e.g. '#1d4ed8'
  secondaryColor: string;     // Accent / Pods e.g. '#ef4444'
  accentColor: string;        // Stripes / Endplates
  haloColor: string;
  sponsorName: string;
  teamColorHex: number;
  teamColorCss: string;
  pitStallX: number;          // Pit lane X dock position (-24, -12, 0, 12, 24)
  pitStallZ: number;          // Pit lane Z dock position (-116.0)
}

export const RACE_TEAMS: TeamLiveryConfig[] = [
  {
    id: 'player',
    driverNumber: '1',
    driverName: 'M. Verstappen',
    driverCode: 'VER',
    teamName: 'Oracle Red Bull Racing',
    primaryColor: '#040814',     // Authentic Red Bull Matte Midnight Navy Blue
    secondaryColor: '#cc0022',   // Charging Bull Crimson Red
    accentColor: '#fec008',      // Sunburst Solar Yellow
    haloColor: '#0c0f16',
    sponsorName: 'ORACLE RED BULL',
    teamColorHex: 0x050a16,
    teamColorCss: '#050a16',
    pitStallX: -22.0,
    pitStallZ: -116.0,
  },
  {
    id: 'scuderia',
    driverNumber: '16',
    driverName: 'C. Leclerc',
    driverCode: 'LEC',
    teamName: 'Scuderia Corsa',
    primaryColor: '#dc2626',     // Rosso Corsa
    secondaryColor: '#facc15',   // Modena Yellow
    accentColor: '#ffffff',
    haloColor: '#0f172a',
    sponsorName: 'SANTANDER',
    teamColorHex: 0xdc2626,
    teamColorCss: '#dc2626',
    pitStallX: 22.0,
    pitStallZ: -116.0,
  },
];

export interface DriverLeaderboardEntry {
  id: string;
  position: number;
  driverCode: string;
  driverName: string;
  driverNumber: string;
  teamName: string;
  teamColorCss: string;
  currentLap: number;
  currentSector: number;
  currentCompound: TireCompoundType;
  compoundsUsed: TireCompoundType[];
  hasSatisfiedTireRule: boolean;
  tireWearAvg: number;
  pitStopsCount: number;
  isInPit: boolean;
  gapToLeaderFormatted: string;
  gapToAheadFormatted: string;
  lastLapTime: number | null;
  bestLapTime: number | null;
  currentLapTime: number;
  totalRaceTime: number;
  isPlayer: boolean;
  isFinished: boolean;
  finishPosition?: number;
  hasPenalty: boolean;
  penaltySeconds: number;
}

export interface CareerRaceConfig {
  totalLaps: RaceLapOption;
  difficulty: RaceDifficulty;
  startingCompound: TireCompoundType;
  requiresTwoCompounds: boolean; // True for 20 and 50 laps
}

export interface CustomLiverySettings {
  driverName: string;
  driverCode: string;
  driverNumber: string;
  teamName: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  haloColor: string;
  sponsorName: string;
}

export interface CareerSeasonDriverStanding {
  id: string;
  driverName: string;
  driverCode: string;
  driverNumber: string;
  teamName: string;
  teamColorCss: string;
  points: number;
  wins: number;
  podiums: number;
  isPlayer: boolean;
}

export interface CareerSeasonState {
  currentRound: number;
  totalRounds: number;
  standings: CareerSeasonDriverStanding[];
  teamObjective: {
    description: string;
    targetPosition: number;
    achieved: boolean;
  };
  lastRaceResult?: {
    position: number;
    pointsAwarded: number;
    objectiveMet: boolean;
  };
}

export const DEFAULT_LIVERY_SETTINGS: CustomLiverySettings = {
  driverName: 'Max Verstappen',
  driverCode: 'VER',
  driverNumber: '1',
  teamName: 'Oracle Red Bull Racing',
  primaryColor: '#040814',
  secondaryColor: '#cc0022',
  accentColor: '#fec008',
  haloColor: '#0c0f16',
  sponsorName: 'ORACLE',
};

export const FIA_POINTS_MAP: Record<number, number> = {
  1: 25,
  2: 18,
  3: 15,
  4: 12,
  5: 10,
  6: 8,
  7: 6,
  8: 4,
  9: 2,
  10: 1,
};

export function getFiaPointsForPosition(position: number): number {
  return FIA_POINTS_MAP[position] || 0;
}

export function loadSavedLivery(): CustomLiverySettings {
  try {
    const raw = localStorage.getItem('apex_custom_livery');
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_LIVERY_SETTINGS, ...parsed };
    }
  } catch (e) {
    console.error('Error loading custom livery:', e);
  }
  return { ...DEFAULT_LIVERY_SETTINGS };
}

export function saveLivery(settings: CustomLiverySettings): void {
  try {
    localStorage.setItem('apex_custom_livery', JSON.stringify(settings));
  } catch (e) {
    console.error('Error saving custom livery:', e);
  }
}

export function liverySettingsToTeamConfig(settings: CustomLiverySettings): TeamLiveryConfig {
  let hexNum = 0x050a16;
  try {
    hexNum = parseInt(settings.primaryColor.replace('#', ''), 16);
  } catch {}

  return {
    id: 'player',
    driverNumber: settings.driverNumber || '1',
    driverName: settings.driverName || 'Piloto',
    driverCode: (settings.driverCode || 'PIL').toUpperCase().slice(0, 3),
    teamName: settings.teamName || 'Escudería Apex',
    primaryColor: settings.primaryColor,
    secondaryColor: settings.secondaryColor,
    accentColor: settings.accentColor,
    haloColor: settings.haloColor,
    sponsorName: settings.sponsorName || 'ORACLE',
    teamColorHex: hexNum,
    teamColorCss: settings.primaryColor,
    pitStallX: -22.0,
    pitStallZ: -116.0,
  };
}

export function loadCareerSeason(): CareerSeasonState {
  try {
    const raw = localStorage.getItem('apex_career_season');
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Error loading career season:', e);
  }

  const livery = loadSavedLivery();
  return {
    currentRound: 1,
    totalRounds: 5,
    standings: [
      {
        id: 'player',
        driverName: livery.driverName,
        driverCode: livery.driverCode,
        driverNumber: livery.driverNumber,
        teamName: livery.teamName,
        teamColorCss: livery.primaryColor,
        points: 0,
        wins: 0,
        podiums: 0,
        isPlayer: true,
      },
      {
        id: 'scuderia',
        driverName: 'C. Leclerc',
        driverCode: 'LEC',
        driverNumber: '16',
        teamName: 'Scuderia Corsa',
        teamColorCss: '#dc2626',
        points: 0,
        wins: 0,
        podiums: 0,
        isPlayer: false,
      },
    ],
    teamObjective: {
      description: 'Llegar al podio (Top 1 o 2) en el Gran Premio inaugural',
      targetPosition: 2,
      achieved: false,
    },
  };
}

export function saveCareerSeason(season: CareerSeasonState): void {
  try {
    localStorage.setItem('apex_career_season', JSON.stringify(season));
  } catch (e) {
    console.error('Error saving career season:', e);
  }
}
