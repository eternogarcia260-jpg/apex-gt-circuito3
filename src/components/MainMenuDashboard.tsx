/**
 * MainMenuDashboard.tsx
 * Ultra-Modern 2026 Esports Racing Operations Dashboard for Apex GT.
 * Inspired by Gran Turismo 7 & Formula 1 luxury motorsport editorial design.
 * 
 * Features:
 * - Screen 2 (Root View): 2x3 Panoramic Cards with zero scroll (Career, Garage, Free, School, Multiplayer, Grand Prix)
 * - Screen 3 (Paddock & Preparation Command Center):
 *   - Custom user-uploaded background image (/images/screen3_bg.png) with dark vignette
 *   - Zero-scroll layout (h-screen max-h-screen overflow-hidden flex flex-col justify-between)
 *   - 6 Custom Image Selector Buttons styled like GT7 cards (Circuits, Tires, Laps, AI Difficulty, Livery/Team, Assists/Setup)
 *   - High-fidelity superimposed modal overlays for selecting each configuration element seamlessly
 *   - Master Launch CTA button with audio feedback
 */

import React, { useState, useEffect } from 'react';
import {
  Trophy,
  Timer,
  Users,
  Flag,
  Play,
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Zap,
  Compass,
  HelpCircle,
  AlertCircle,
  Sparkles,
  ChevronRight,
  Sliders,
  CheckCircle2,
  Palette,
  Shield,
  Maximize2,
  Minimize2,
  Eye,
  Activity,
  Flame,
  Wind,
  Thermometer,
  Gauge,
  CircleDot,
  Radio,
  Layers,
  ChevronDown,
  GraduationCap,
  Globe,
  Car,
  Coins,
  X,
  Settings,
  Disc,
  Clock,
  Swords,
  User,
  Hash,
  Pencil,
  ChevronLeft,
  Target,
  Crosshair,
  Camera,
} from 'lucide-react';
import { CameraDistanceMode, CameraViewMode } from '../game/RacingGameEngine';
import { MultiplayerRoomState } from '../game/multiplayer/MultiplayerClient';
import { RaceDifficulty, RaceLapOption, CustomLiverySettings, CareerSeasonState, saveLivery } from '../game/career/CareerTypes';
import { TireCompoundType } from '../game/physics/TireCompound';
import { playUiClick, playUiHover, playModeSelectChime } from '../utils/uiAudio';
import { CircuitId } from '../game/circuits/ICircuit';
import { AVAILABLE_CIRCUITS } from '../game/circuits/CircuitRegistry';
import { SoundtrackModal } from './SoundtrackModal';

export interface MainMenuDashboardProps {
  onStartSolo: (
    cameraDistance: CameraDistanceMode,
    cameraMode: CameraViewMode,
    laps: RaceLapOption,
    difficulty: RaceDifficulty,
    startingCompound: TireCompoundType,
    circuitId?: CircuitId
  ) => void;
  onStartCareerMode?: (
    cameraDistance: CameraDistanceMode,
    cameraMode: CameraViewMode,
    laps: RaceLapOption,
    difficulty: RaceDifficulty,
    startingCompound: TireCompoundType,
    circuitId?: CircuitId
  ) => void;
  onOpenLiveryStudio?: () => void;
  customLivery?: CustomLiverySettings;
  careerSeason?: CareerSeasonState;
  onResetCareerSeason?: () => void;
  onStartFreePractice?: (
    cameraDistance: CameraDistanceMode,
    cameraMode: CameraViewMode,
    startingCompound: TireCompoundType,
    circuitId?: CircuitId
  ) => void;
  selectedCircuit?: CircuitId;
  onSelectCircuit?: (circuitId: CircuitId) => void;
  onCreateRoom: (options: {
    playerName: string;
    laps: number;
    car1Name: string;
    car2Name: string;
    crewName: string;
    cameraDistance: CameraDistanceMode;
    cameraMode: CameraViewMode;
  }) => Promise<void>;
  onJoinRoom: (code: string, playerName: string, cameraDistance: CameraDistanceMode, cameraMode: CameraViewMode) => Promise<void>;
  onStartMultiplayerRace: () => void;
  onSetReady: (isReady: boolean) => void;
  onLeaveRoom: () => void;
  onBackToTitle: () => void;
  roomState: MultiplayerRoomState | null;
  playerId: 'p1' | 'p2' | null;
  isConnecting: boolean;
  errorMessage: string | null;
  onStartFreeCamera?: (circuitId?: CircuitId) => void;
  // Deprecated stubs
  onOpenModelUpload?: (target: 'car1' | 'car2' | 'crew') => void;
  car1Name?: string;
  car2Name?: string;
  crewName?: string;
}

export type MenuDedicatedScreen = 'root' | 'career' | 'free' | 'multiplayer' | 'grand_prix';
export type Screen3Overlay = 'none' | 'tires' | 'circuit' | 'laps' | 'difficulty' | 'setup' | 'livery' | 'multiplayer_modal';

export interface EscuderiaPalette {
  id: string;
  name: string;
  stripesColor: string;
  dots: [string, string, string, string];
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  driverCode: string;
}

export const ESCUDERIA_PALETTES: EscuderiaPalette[] = [
  {
    id: 'violeta_punk',
    name: 'VIOLETA PUNK',
    stripesColor: '#a855f7',
    dots: ['#8b5cf6', '#d946ef', '#f472b6', '#ffffff'],
    primaryColor: '#3b0764',
    secondaryColor: '#a855f7',
    accentColor: '#f472b6',
    driverCode: 'PUN',
  },
  {
    id: 'rojo_fatuo',
    name: 'ROJO FATUO',
    stripesColor: '#ef4444',
    dots: ['#ef4444', '#dc2626', '#7f1d1d', '#9ca3af'],
    primaryColor: '#1a0507',
    secondaryColor: '#dc2626',
    accentColor: '#f87171',
    driverCode: 'FAT',
  },
  {
    id: 'azul_nebula',
    name: 'AZUL NÉBULA',
    stripesColor: '#0ea5e9',
    dots: ['#0284c7', '#38bdf8', '#7dd3fc', '#ffffff'],
    primaryColor: '#031738',
    secondaryColor: '#0ea5e9',
    accentColor: '#38bdf8',
    driverCode: 'NEB',
  },
  {
    id: 'amarillo_sol',
    name: 'AMARILLO SOL',
    stripesColor: '#eab308',
    dots: ['#eab308', '#facc15', '#fde047', '#94a3b8'],
    primaryColor: '#1c1917',
    secondaryColor: '#eab308',
    accentColor: '#fef08a',
    driverCode: 'SOL',
  },
  {
    id: 'verde_espectro',
    name: 'VERDE ESPECTRO',
    stripesColor: '#10b981',
    dots: ['#10b981', '#34d399', '#06b6d4', '#64748b'],
    primaryColor: '#022c22',
    secondaryColor: '#10b981',
    accentColor: '#6ee7b7',
    driverCode: 'ESP',
  },
  {
    id: 'naranja_fusion',
    name: 'NARANJA FUSIÓN',
    stripesColor: '#f97316',
    dots: ['#f97316', '#fb923c', '#ea580c', '#9ca3af'],
    primaryColor: '#1c1917',
    secondaryColor: '#f97316',
    accentColor: '#fed7aa',
    driverCode: 'FUS',
  },
];

export const MainMenuDashboard: React.FC<MainMenuDashboardProps> = ({
  onStartSolo,
  onStartCareerMode,
  onOpenLiveryStudio,
  customLivery,
  careerSeason,
  onStartFreePractice,
  selectedCircuit: initialCircuit,
  onSelectCircuit,
  onCreateRoom,
  onJoinRoom,
  onStartMultiplayerRace,
  onSetReady,
  onLeaveRoom,
  onBackToTitle,
  roomState,
  playerId,
  isConnecting,
  errorMessage,
  onStartFreeCamera,
}) => {
  // Navigation State: 'root' (Screen 2 Mode Selection) or dedicated mode screen (Screen 3)
  const [activeScreen, setActiveScreen] = useState<MenuDedicatedScreen>('root');

  // Selected Circuit
  const [selectedCircuit, setSelectedCircuit] = useState<CircuitId>(initialCircuit || 'square_apex');

  // Racing Parameters
  const [laps, setLaps] = useState<RaceLapOption>(9);
  const [difficulty, setDifficulty] = useState<RaceDifficulty>('medium');
  const [startingCompound, setStartingCompound] = useState<TireCompoundType>('soft');

  // Camera Settings
  const [cameraDistance, setCameraDistance] = useState<CameraDistanceMode>('medium');
  const [cameraMode, setCameraMode] = useState<CameraViewMode>('chase');

  // Driving Assists
  const [tractionControl, setTractionControl] = useState<boolean>(true);
  const [absEnabled, setAbsEnabled] = useState<boolean>(true);
  const [racingLine, setRacingLine] = useState<boolean>(true);

  // Multiplayer Form State
  const [mpTab, setMpTab] = useState<'create' | 'join'>('create');
  const [playerName, setPlayerName] = useState<string>(customLivery?.driverName || 'PILOTO APEX');
  const [joinCodeInput, setJoinCodeInput] = useState<string>('');
  const [mpLaps, setMpLaps] = useState<number>(3);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isReady, setIsReady] = useState<boolean>(false);

  // Controls Guide Modal
  const [showControlsModal, setShowControlsModal] = useState<boolean>(false);

  // Soundtrack Jukebox Modal
  const [isSoundtrackOpen, setIsSoundtrackOpen] = useState<boolean>(false);

  // GT7 Style Active Card Index on Screen 2
  const [selectedCardIndex, setSelectedCardIndex] = useState<number>(0);

  // Screen 3: Superimposed Modal Overlays
  const [activeOverlay, setActiveOverlay] = useState<Screen3Overlay>('none');
  const [teamName, setTeamName] = useState<string>(customLivery?.teamName || 'VIOLETA PUNK');
  const [carNumber, setCarNumber] = useState<string>(customLivery?.driverNumber || '27');
  const [driverDisplayName, setDriverDisplayName] = useState<string>(customLivery?.driverName || 'ALEX VEGA');
  const [driverCode, setDriverCode] = useState<string>(customLivery?.driverCode || 'PUN');
  const [primaryColor, setPrimaryColor] = useState<string>(customLivery?.primaryColor || '#3b0764');
  const [secondaryColor, setSecondaryColor] = useState<string>(customLivery?.secondaryColor || '#a855f7');
  const [accentColor, setAccentColor] = useState<string>(customLivery?.accentColor || '#f472b6');
  const [selectedPaletteId, setSelectedPaletteId] = useState<string>(() => {
    if (customLivery?.teamName) {
      const match = ESCUDERIA_PALETTES.find((p) => p.name.toLowerCase() === customLivery.teamName.toLowerCase());
      if (match) return match.id;
    }
    return 'violeta_punk';
  });

  // Live Digital Clock & Date
  const [currentTime, setCurrentTime] = useState<string>(() => {
    const d = new Date();
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  });
  const [currentDateStr, setCurrentDateStr] = useState<string>(() => {
    const d = new Date();
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${d.getDate()} ${months[d.getMonth()]}`;
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date();
      setCurrentTime(`${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`);
      const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      setCurrentDateStr(`${d.getDate()} ${months[d.getMonth()]}`);
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Fullscreen State
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => {
    return typeof document !== 'undefined' ? !!document.fullscreenElement : false;
  });

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      }
      if (e.key === 'Escape' && activeOverlay !== 'none') {
        setActiveOverlay('none');
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeOverlay]);

  const toggleFullscreen = () => {
    playUiClick(750);
    try {
      if (!document.fullscreenElement) {
        const root = document.documentElement;
        if (root.requestFullscreen) {
          root.requestFullscreen().catch(() => {});
        } else if ((root as unknown as { webkitRequestFullscreen?: () => void }).webkitRequestFullscreen) {
          (root as unknown as { webkitRequestFullscreen: () => void }).webkitRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        } else if ((document as unknown as { webkitExitFullscreen?: () => void }).webkitExitFullscreen) {
          (document as unknown as { webkitExitFullscreen: () => void }).webkitExitFullscreen();
        }
      }
    } catch {}
  };

  const handleSelectCircuitLocal = (id: CircuitId) => {
    playUiClick(650);
    setSelectedCircuit(id);
    onSelectCircuit?.(id);
  };

  const handleNavigateToScreen = (screen: MenuDedicatedScreen) => {
    playModeSelectChime();
    setActiveScreen(screen);
  };

  const handleBackToGrid = () => {
    playUiClick(700);
    setActiveScreen('root');
    setActiveOverlay('none');
  };

  // Launch handlers for each dedicated screen
  const handleLaunchCareer = () => {
    playUiClick(950);
    if (onStartCareerMode) {
      onStartCareerMode(cameraDistance, cameraMode, laps, difficulty, startingCompound, selectedCircuit);
    } else {
      onStartSolo(cameraDistance, cameraMode, laps, difficulty, startingCompound, selectedCircuit);
    }
  };

  const handleLaunchFreePractice = () => {
    playUiClick(950);
    if (onStartFreePractice) {
      onStartFreePractice(cameraDistance, cameraMode, startingCompound, selectedCircuit);
    } else {
      onStartSolo(cameraDistance, cameraMode, 9, 'easy', startingCompound, selectedCircuit);
    }
  };

  const handleLaunchGrandPrix = () => {
    playUiClick(950);
    onStartSolo(cameraDistance, cameraMode, laps, difficulty, startingCompound, selectedCircuit);
  };

  const handleLaunchFreeCamera = () => {
    playUiClick(750);
    if (onStartFreeCamera) {
      onStartFreeCamera(selectedCircuit);
    } else if (onStartFreePractice) {
      onStartFreePractice(cameraDistance, cameraMode, startingCompound, selectedCircuit);
    }
  };

  const handleCreateRoomAction = async () => {
    playUiClick(850);
    await onCreateRoom({
      playerName: playerName.trim() || 'Piloto Anfitrión',
      laps: mpLaps,
      car1Name: 'F1 Turbo GP (Host)',
      car2Name: 'F1 Turbo GP (Rival)',
      crewName: 'Pit Crew Scuderia',
      cameraDistance,
      cameraMode,
    });
  };

  const handleJoinRoomAction = async () => {
    if (!joinCodeInput.trim()) return;
    playUiClick(850);
    await onJoinRoom(
      joinCodeInput.trim().toUpperCase(),
      playerName.trim() || 'Piloto Invitado',
      cameraDistance,
      cameraMode
    );
  };

  const handleToggleReady = () => {
    playUiClick(800);
    const next = !isReady;
    setIsReady(next);
    onSetReady(next);
  };

  const copyRoomCode = () => {
    if (!roomState?.code) return;
    navigator.clipboard.writeText(roomState.code);
    setIsCopied(true);
    playUiClick(900);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const currentCircuit = AVAILABLE_CIRCUITS.find((c) => c.id === selectedCircuit) || AVAILABLE_CIRCUITS[0];

  // Career stats calculation
  const playerStanding = careerSeason?.standings?.find((s) => s.isPlayer);
  const playerPoints = playerStanding?.points ?? 0;

  // Estimated race duration calculation
  const calculateEstimatedTime = (totalLaps: number) => {
    const lapTime = currentCircuit.expectedLapTimeSec || 35;
    const totalSecs = lapTime * totalLaps;
    const mins = Math.floor(totalSecs / 60);
    const secs = Math.round(totalSecs % 60);
    return `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
  };

  // Gran Turismo 7 Cards Configuration for Screen 2 (Root View: 4 Core Modes)
  const gt7Cards = [
    {
      id: 'career',
      title: 'MODO CARRERA',
      desc: 'Compite, gana y avanza en tu carrera como piloto profesional.',
      bg: '/images/cards/card_career.webp',
      icon: Trophy,
      action: () => handleNavigateToScreen('career'),
    },
    {
      id: 'free',
      title: 'CONDUCCIÓN LIBRE',
      desc: 'Explora libremente los circuitos y disfruta de la conducción.',
      bg: '/images/cards/card_free.webp',
      icon: Timer,
      action: () => handleNavigateToScreen('free'),
    },
    {
      id: 'multiplayer',
      title: 'MULTIJUGADOR',
      desc: 'Compite en línea con jugadores de todo el mundo en 1v1.',
      bg: '/images/cards/card_multiplayer.webp',
      icon: Globe,
      action: () => handleNavigateToScreen('multiplayer'),
    },
    {
      id: 'grand_prix',
      title: 'GRAN PREMIO',
      desc: 'Parrilla oficial FIA de 5 monoplazas con semáforo y paradas en boxes.',
      bg: '/images/cards/card_grandprix.webp',
      icon: Flag,
      action: () => handleNavigateToScreen('grand_prix'),
    },
  ];

  // Screen 3 Selectors Configuration (Cards with custom background images)
  const screen3Selectors = [
    {
      id: 'circuit',
      category: 'CIRCUITO FIA',
      title: currentCircuit.name,
      subtitle: `${(currentCircuit.totalLength / 1000).toFixed(2)} KM · ${currentCircuit.cornersCount} Curvas`,
      tag: currentCircuit.flagEmoji || '🏁',
      bg: '/images/cards/btn_circuit.webp',
      action: () => {
        playUiClick(750);
        setActiveOverlay('circuit');
      },
    },
    {
      id: 'tires',
      category: 'NEUMÁTICOS',
      title:
        startingCompound === 'soft'
          ? 'BLANDO C4 (ROJO)'
          : startingCompound === 'medium'
          ? 'MEDIO C3 (AMARILLO)'
          : 'DURO C2 (BLANCO)',
      subtitle:
        startingCompound === 'soft'
          ? 'Agarre 100% · 8-10 Vueltas'
          : startingCompound === 'medium'
          ? 'Agarre 92% · 18-22 Vueltas'
          : 'Agarre 84% · 35+ Vueltas',
      tag:
        startingCompound === 'soft' ? '🔴 PIRELLI' : startingCompound === 'medium' ? '🟡 PIRELLI' : '⚪ PIRELLI',
      bg: '/images/cards/btn_tire.webp',
      action: () => {
        playUiClick(750);
        setActiveOverlay('tires');
      },
    },
    {
      id: 'laps',
      category: 'DURACIÓN & VUELTAS',
      title: `${laps} VUELTAS`,
      subtitle: `${calculateEstimatedTime(laps)} · ${
        laps === 9 ? 'Sprint Relámpago' : laps === 20 ? 'Gran Premio Estándar' : 'Resistencia Completa'
      }`,
      tag: '🏁 DISTANCIA',
      bg: '/images/cards/btn_laps.webp',
      action: () => {
        playUiClick(750);
        setActiveOverlay('laps');
      },
    },
    {
      id: 'difficulty',
      category: activeScreen === 'multiplayer' ? 'SALA MULTIJUGADOR' : 'DIFICULTAD RIVALES',
      title:
        activeScreen === 'multiplayer'
          ? roomState
            ? `SALA: ${roomState.code}`
            : 'DUELO 1V1 EN LÍNEA'
          : difficulty === 'easy'
          ? 'NOVATO'
          : difficulty === 'medium'
          ? 'INTERMEDIO'
          : 'LEYENDA FIA',
      subtitle:
        activeScreen === 'multiplayer'
          ? roomState
            ? `Jugadores: ${roomState.players.p1 ? 1 : 0} + ${roomState.players.p2 ? 1 : 0}/2`
            : 'Crear sala privada o unirse con código'
          : difficulty === 'easy'
          ? 'Ritmo accesible y permisivo'
          : difficulty === 'medium'
          ? 'Competitivo y equilibrado'
          : 'Máxima agresividad de parrilla',
      tag: activeScreen === 'multiplayer' ? '🌐 WEBSOCKET' : '⚡ IA DINÁMICA',
      bg: '/images/cards/card_grandprix.webp',
      action: () => {
        playUiClick(750);
        if (activeScreen === 'multiplayer') {
          setActiveOverlay('multiplayer_modal');
        } else {
          setActiveOverlay('difficulty');
        }
      },
    },
    {
      id: 'livery',
      category: 'ESCUDERÍA & PILOTO',
      title: teamName,
      subtitle: `#${carNumber} · ${driverDisplayName} (${driverCode})`,
      tag: '🏎️ MONOPLAZA',
      bg: '/images/cards/btn_livery.webp',
      action: () => {
        playUiClick(750);
        setActiveOverlay('livery');
      },
    },
    {
      id: 'setup',
      category: 'REGLAJES & ASISTENCIAS',
      title: `TC: ${tractionControl ? 'ON' : 'OFF'} · ABS: ${absEnabled ? 'ON' : 'OFF'}`,
      subtitle: `Trazada: ${racingLine ? 'ON' : 'OFF'} · Cámara: ${
        cameraMode === 'chase' ? 'Exterior' : cameraMode === 'bumper' ? 'Morro/Asfalto' : cameraMode === 'hood' ? 'Capó' : 'Órbita'
      }`,
      tag: '🛠️ TELEMETRÍA',
      bg: '/images/cards/btn_helmet.webp',
      action: () => {
        playUiClick(750);
        setActiveOverlay('setup');
      },
    },
  ];

  // Arrow key navigation for 2x2 cards in root menu
  useEffect(() => {
    if (activeScreen !== 'root' || showControlsModal || activeOverlay !== 'none') return;
    const handleMenuNav = (e: KeyboardEvent) => {
      const total = gt7Cards.length;
      if (total === 0) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        playUiHover();
        setSelectedCardIndex((prev) => (prev + 1) % total);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        playUiHover();
        setSelectedCardIndex((prev) => (prev - 1 + total) % total);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        playUiHover();
        setSelectedCardIndex((prev) => (prev + 2) % total);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        playUiHover();
        setSelectedCardIndex((prev) => (prev - 2 + total) % total);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const c = gt7Cards[selectedCardIndex];
        if (c) c.action();
      }
    };
    window.addEventListener('keydown', handleMenuNav);
    return () => window.removeEventListener('keydown', handleMenuNav);
  }, [activeScreen, selectedCardIndex, showControlsModal, activeOverlay, gt7Cards]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-between h-full h-[100dvh] max-h-[100dvh] w-full max-w-[100vw] overflow-hidden select-none text-white font-sans bg-neutral-950">
      {/* ========================================================================= */}
      {/* BACKGROUND IMAGE: Root GT7 vs Screen 3 User Uploaded Background Image    */}
      {/* ========================================================================= */}
      <img
        src={activeScreen === 'root' ? '/images/dashboard_bg.webp' : '/images/screen3_bg.webp'}
        alt="Racing Background"
        className="absolute inset-0 w-full h-full object-cover pointer-events-none opacity-95 select-none z-0"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/90 via-neutral-950/35 to-neutral-950/75 pointer-events-none z-0" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-neutral-950/20 to-neutral-950/60 pointer-events-none z-0" />

      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* 1. TOP HEADER / FULLSCREEN ACTION                                         */}
      {/* ========================================================================= */}
      {activeScreen === 'root' ? (
        /* Screen 2: Top action cluster with unobtrusive Soundtrack button & fullscreen button */
        <div className="absolute top-2.5 sm:top-3.5 right-2.5 sm:right-3.5 z-30 flex items-center gap-2">
          {/* Non-intrusive Soundtrack Button */}
          <button
            onClick={() => {
              playUiClick();
              setIsSoundtrackOpen(true);
            }}
            onMouseEnter={playUiHover}
            title="Banda Sonora & Reproductor de Música"
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-white/80 hover:text-white transition-all cursor-pointer backdrop-blur-sm shadow-sm group"
          >
            <Disc className="w-3.5 h-3.5 text-red-500 group-hover:rotate-90 transition-transform duration-300" />
            <span className="text-[11px] sm:text-xs font-mono font-bold tracking-wider">SOUNDTRACK</span>
          </button>

          <button
            onClick={toggleFullscreen}
            onMouseEnter={playUiHover}
            title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
            className="p-1.5 sm:p-2 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-white/70 hover:text-white transition-all cursor-pointer backdrop-blur-sm shadow-sm"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      ) : (
        /* Screen 3 Top Header matching the luxury motorsport styling */
        <header className="relative z-20 w-full border-b border-white/10 bg-neutral-950/85 backdrop-blur-xl px-2.5 sm:px-6 py-1 sm:py-1.5 flex items-center justify-between flex-shrink-0 shadow-lg">
          {/* Left: Mode Title & F1 Badge without '2026' and without 'CONFIGURACIÓN' */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <div className="px-1.5 sm:px-2 py-0.5 rounded bg-red-600 text-white font-black italic tracking-tighter text-xs sm:text-sm font-mono shadow-md border border-red-400/40">
                F1
              </div>
            </div>

            <div className="leading-tight truncate">
              <h2 className="text-xs sm:text-sm md:text-base font-black uppercase tracking-wider text-white font-sans flex items-center gap-1.5 truncate">
                <span className="truncate">
                  {activeScreen === 'career' && 'MODO CARRERA'}
                  {activeScreen === 'free' && 'ENTRENAMIENTO & TIME ATTACK'}
                  {activeScreen === 'multiplayer' && 'PADDOCK MULTIJUGADOR 1V1'}
                  {activeScreen === 'grand_prix' && 'GRAN PREMIO OFICIAL FIA'}
                </span>
              </h2>
            </div>
          </div>

          {/* Right: Back Button & Fullscreen Button (Interchanged so Fullscreen is at the far right) */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 flex-shrink-0">
            {/* Back Button to return to Screen 2 */}
            <button
              onClick={handleBackToGrid}
              onMouseEnter={playUiHover}
              className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-red-600/30 hover:bg-red-600/50 border border-red-500/50 text-red-100 hover:text-white transition-all text-xs font-bold cursor-pointer shadow-md"
              title="Volver a selección de modalidades"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>MODOS</span>
            </button>

            {/* Fullscreen Button - At the far right where MODOS used to be */}
            <button
              onClick={toggleFullscreen}
              onMouseEnter={playUiHover}
              title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
              className="p-1 sm:p-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-neutral-300 hover:text-white transition-all cursor-pointer backdrop-blur-md"
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </header>
      )}

      {/* ========================================================================= */}
      {/* 2. MAIN CONTENT VIEWPORT: ZERO-SCROLL FOR BOTH SCREENS                    */}
      {/* ========================================================================= */}
      {activeScreen === 'root' ? (
        /* SCREEN 2: 2x2 Mode Selection Grid (40% Button Opacity & Maximized Space) */
        <main className="relative z-10 flex-1 flex flex-col justify-between px-3 sm:px-6 md:px-8 py-3.5 sm:py-5 max-w-7xl mx-auto w-full min-h-0 overflow-hidden">
          {/* Top Title Banner */}
          <div className="flex-shrink-0 mb-1.5 sm:mb-2.5 text-left">
            <h1 className="text-lg sm:text-2xl md:text-3xl font-black uppercase tracking-wide text-white drop-shadow font-sans">
              UN MUNDO DE AUTOMOVILISMO
            </h1>
            <p className="text-[11px] sm:text-xs text-neutral-300 font-normal">
              Elige tu forma de disfrutar Apex GT.
            </p>
          </div>

          {/* 4 Cards Grid in 2x2 with 57% opacity & 40% narrower buttons for a clean open center */}
          <div className="flex-1 min-h-0 grid grid-cols-2 grid-rows-2 gap-y-3 sm:gap-y-4 md:gap-y-5 w-full items-stretch my-auto">
            {gt7Cards.map((card, idx) => {
              const Icon = card.icon;
              const isSelected = selectedCardIndex === idx;
              const isLeftColumn = idx % 2 === 0;
              return (
                <button
                  key={card.id}
                  onClick={() => {
                    setSelectedCardIndex(idx);
                    playUiClick(800);
                    card.action();
                  }}
                  onMouseEnter={() => {
                    setSelectedCardIndex(idx);
                    playUiHover();
                  }}
                  className={`group relative rounded-xl sm:rounded-2xl overflow-hidden text-left cursor-pointer transition-all duration-300 flex flex-col justify-end p-2.5 sm:p-3.5 md:p-4 select-none bg-neutral-950/[0.57] backdrop-blur-sm ${
                    isLeftColumn ? 'justify-self-start w-[64%] sm:w-[60%]' : 'justify-self-end w-[64%] sm:w-[60%]'
                  } ${
                    isSelected
                      ? 'border-2 border-cyan-400 shadow-[0_0_24px_rgba(34,211,238,0.65),inset_0_0_12px_rgba(34,211,238,0.2)] ring-1 ring-cyan-300 scale-[1.01]'
                      : 'border border-white/20 hover:border-cyan-400/80 hover:shadow-[0_0_16px_rgba(34,211,238,0.35)]'
                  }`}
                >
                  {/* Background Image with 57% opacity */}
                  <img
                    src={card.bg}
                    alt={card.title}
                    className="absolute inset-0 w-full h-full object-cover opacity-[0.57] transition-transform duration-500 ease-out group-hover:scale-108"
                    loading="eager"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 to-transparent pointer-events-none" />
                  <div className="absolute inset-0 bg-black/15 group-hover:bg-transparent transition-colors pointer-events-none" />

                  {isSelected && (
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent pointer-events-none" />
                  )}

                  <div className="relative z-10 flex flex-col justify-end">
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5">
                      <div className="p-1 sm:p-1.5 rounded-lg bg-white/10 backdrop-blur-md border border-white/15 text-cyan-300 group-hover:text-cyan-200 shrink-0">
                        <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </div>
                      <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-white drop-shadow font-sans truncate">
                        {card.title}
                      </span>
                    </div>
                    <p className="text-[8.5px] sm:text-[10px] md:text-[11px] text-neutral-300 line-clamp-1 sm:line-clamp-2 mt-0.5 font-normal leading-tight">
                      {card.desc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </main>
      ) : (
        /* SCREEN 3: Custom Background + 6 Selector Buttons (60% Opacity) + Zero-Scroll Responsive Layout */
        <main className="relative z-10 flex-1 flex flex-col px-2 sm:px-4 md:px-6 py-1 sm:py-1.5 max-w-7xl mx-auto w-full min-h-0 overflow-hidden">
          
          {/* ========================================================================= */}
          {/* LAYOUT A: LANDSCAPE VIEWPORT (Horizontal Phone/Desktop: Left Minimalist Panel + 3x2 Grid) */}
          {/* ========================================================================= */}
          <div className="hidden landscape:flex flex-row gap-2 sm:gap-3 flex-1 min-h-0 items-stretch">
            {/* Left Technical Specification Panel (Exact replica of user design, optimized for compact viewports) */}
            <aside className="w-56 sm:w-64 md:w-72 flex-shrink-0 flex flex-col justify-between rounded-2xl bg-[#0b0c10]/95 backdrop-blur-xl border border-white/10 p-2 sm:p-2.5 md:p-3.5 shadow-[0_0_30px_rgba(0,0,0,0.85)] min-h-0 relative overflow-hidden before:absolute before:top-0 before:left-0 before:w-16 before:h-16 before:border-t-2 before:border-l-2 before:border-red-600 before:rounded-tl-2xl before:pointer-events-none">
              
              {/* Header: Glowing Red Dot + FICHA TÉCNICA + FIA Badge */}
              <div className="flex-shrink-0 border-b border-white/10 pb-1.5 mb-1 sm:pb-2 sm:mb-1.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-600 shadow-[0_0_8px_rgba(239,68,68,1)]" />
                  <span className="text-[11px] sm:text-xs md:text-sm font-bold tracking-wider text-white font-sans uppercase">
                    FICHA TÉCNICA
                  </span>
                </div>
                <div className="flex items-center justify-center px-1.5 py-0.5 rounded-full border border-white/60 bg-white/5 backdrop-blur-sm">
                  <span className="text-[8.5px] sm:text-[9.5px] font-black tracking-wider text-white font-serif leading-none">
                    FIA
                  </span>
                </div>
              </div>

              {/* 6 Clean Technical Rows separated by subtle lines */}
              <div className="flex-1 min-h-0 flex flex-col justify-between py-0.5 overflow-hidden">
                {/* 1. Circuito */}
                <div
                  onClick={() => { playUiClick(700); setActiveOverlay('circuit'); }}
                  className="flex items-center gap-2 sm:gap-2.5 py-0.5 sm:py-1 px-1 hover:bg-white/[0.04] rounded transition-colors cursor-pointer border-b border-white/[0.08]"
                >
                  <svg className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-white/90 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M4 22V3" strokeLinecap="round" />
                    <path d="M4 4h14l-2 5 2 5H4" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M8 4v10M12 4v10M16 4v10" opacity="0.6" />
                  </svg>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[8px] sm:text-[9px] font-semibold uppercase tracking-wider text-neutral-400 font-sans leading-none">
                      CIRCUITO
                    </span>
                    <span className="text-[11px] sm:text-xs md:text-[13px] font-bold text-white font-sans truncate leading-tight mt-0.5">
                      {currentCircuit.name}
                    </span>
                    <span className="text-[9px] sm:text-[10px] text-neutral-400 font-sans truncate leading-none mt-0.5">
                      {(currentCircuit.totalLength / 1000).toFixed(1)} km · {currentCircuit.cornersCount} Curvas
                    </span>
                  </div>
                </div>

                {/* 2. Neumático */}
                <div
                  onClick={() => { playUiClick(700); setActiveOverlay('tires'); }}
                  className="flex items-center gap-2 sm:gap-2.5 py-0.5 sm:py-1 px-1 hover:bg-white/[0.04] rounded transition-colors cursor-pointer border-b border-white/[0.08]"
                >
                  <svg className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-white/90 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="12" cy="12" r="9" />
                    <circle cx="12" cy="12" r="4.5" />
                    <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                    <path d="M12 3v4.5M12 16.5V21M3 12h4.5M16.5 12H21" strokeLinecap="round" />
                  </svg>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[8px] sm:text-[9px] font-semibold uppercase tracking-wider text-neutral-400 font-sans leading-none">
                      NEUMÁTICO
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span
                        className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full shrink-0 ${
                          startingCompound === 'soft'
                            ? 'bg-red-600 shadow-[0_0_6px_rgba(239,68,68,1)]'
                            : startingCompound === 'medium'
                            ? 'bg-yellow-400 shadow-[0_0_6px_rgba(250,204,21,1)]'
                            : 'bg-white shadow-[0_0_6px_rgba(255,255,255,1)]'
                        }`}
                      />
                      <span className="text-[11px] sm:text-xs md:text-[13px] font-bold text-white uppercase font-sans truncate leading-tight">
                        {startingCompound === 'soft' ? 'BLANDO C4 (ROJO)' : startingCompound === 'medium' ? 'MEDIO C3 (AMARILLO)' : 'DURO C2 (BLANCO)'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. Distancia */}
                <div
                  onClick={() => { playUiClick(700); setActiveOverlay('laps'); }}
                  className="flex items-center gap-2 sm:gap-2.5 py-0.5 sm:py-1 px-1 hover:bg-white/[0.04] rounded transition-colors cursor-pointer border-b border-white/[0.08]"
                >
                  <svg className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-white/90 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="13" r="8" />
                    <path d="M12 9v4l2.5 2.5" />
                    <path d="M12 2v3M10 2h4" />
                  </svg>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[8px] sm:text-[9px] font-semibold uppercase tracking-wider text-neutral-400 font-sans leading-none">
                      DISTANCIA
                    </span>
                    <span className="text-[11px] sm:text-xs md:text-[13px] font-bold text-white font-sans uppercase truncate leading-tight mt-0.5">
                      {laps} VUELTAS
                    </span>
                  </div>
                </div>

                {/* 4. Dificultad IA */}
                <div
                  onClick={() => { playUiClick(700); if (activeScreen === 'multiplayer') setActiveOverlay('multiplayer_modal'); else setActiveOverlay('difficulty'); }}
                  className="flex items-center gap-2 sm:gap-2.5 py-0.5 sm:py-1 px-1 hover:bg-white/[0.04] rounded transition-colors cursor-pointer border-b border-white/[0.08]"
                >
                  <Zap className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-white/90 fill-white/80 shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-[8px] sm:text-[9px] font-semibold uppercase tracking-wider text-neutral-400 font-sans leading-none">
                      {activeScreen === 'multiplayer' ? 'SALA MULTIJUGADOR' : 'DIFICULTAD IA'}
                    </span>
                    <span className="text-[11px] sm:text-xs md:text-[13px] font-bold text-white font-sans uppercase truncate leading-tight mt-0.5">
                      {activeScreen === 'multiplayer' ? (roomState ? `SALA ${roomState.code}` : '1V1 ONLINE') : difficulty === 'easy' ? 'NOVATO' : difficulty === 'medium' ? 'INTERMEDIO' : 'LEYENDA FIA'}
                    </span>
                  </div>
                </div>

                {/* 5. Piloto & Escudería */}
                <div
                  onClick={() => { playUiClick(700); setActiveOverlay('livery'); }}
                  className="flex items-center gap-2 sm:gap-2.5 py-0.5 sm:py-1 px-1 hover:bg-white/[0.04] rounded transition-colors cursor-pointer border-b border-white/[0.08]"
                >
                  <svg className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-white/90 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 4C7.03 4 3 8.03 3 13c0 3.2 1.68 6.01 4.2 7.6.28.18.63.15.88-.07l2.8-2.53H14c4.42 0 8-3.58 8-8 0-4.97-4.03-9-10-9zm2 10H8.5c-.83 0-1.5-.67-1.5-1.5S7.67 11 8.5 11H14c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z" />
                  </svg>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[8px] sm:text-[9px] font-semibold uppercase tracking-wider text-neutral-400 font-sans leading-none">
                      PILOTO & ESCUDERÍA
                    </span>
                    <span className="text-[11px] sm:text-xs md:text-[13px] font-bold text-white font-sans truncate leading-tight mt-0.5">
                      #{carNumber} · {driverDisplayName}
                    </span>
                  </div>
                </div>

                {/* 6. Asistencias */}
                <div
                  onClick={() => { playUiClick(700); setActiveOverlay('setup'); }}
                  className="flex items-center gap-2 sm:gap-2.5 py-0.5 sm:py-1 px-1 hover:bg-white/[0.04] rounded transition-colors cursor-pointer"
                >
                  <svg className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-white/90 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.5 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z" />
                  </svg>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[8px] sm:text-[9px] font-semibold uppercase tracking-wider text-neutral-400 font-sans leading-none">
                      ASISTENCIAS
                    </span>
                    <span className="text-[10px] sm:text-[11px] md:text-xs font-semibold text-white/90 font-sans truncate leading-tight mt-0.5">
                      TC: {tractionControl ? 'ON' : 'OFF'} · ABS: {absEnabled ? 'ON' : 'OFF'} · Línea: {racingLine ? 'ON' : 'OFF'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Start Button at Bottom of Sidebar: Compact Slanted Ferrari-Red Parallelogram */}
              <div className="flex-shrink-0 pt-0.5 sm:pt-1 relative mt-0.5">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-red-600/30 via-rose-500/10 to-red-600/30 blur-xs rounded pointer-events-none" />
                <button
                  onClick={() => {
                    playUiClick(850);
                    if (activeScreen === 'career') handleLaunchCareer();
                    else if (activeScreen === 'free') handleLaunchFreePractice();
                    else if (activeScreen === 'multiplayer') {
                      if (roomState) handleLaunchCareer();
                      else setActiveOverlay('multiplayer_modal');
                    } else if (activeScreen === 'grand_prix') handleLaunchGrandPrix();
                  }}
                  onMouseEnter={playUiHover}
                  className="relative w-full py-1 sm:py-1.5 px-2.5 [clip-path:polygon(8px_0,100%_0,calc(100%-8px)_100%,0_100%)] bg-gradient-to-r from-[#d90429] via-[#ef233c] to-[#d90429] hover:from-[#ef233c] hover:via-[#ff4d6d] hover:to-[#ef233c] text-white font-black text-[11px] sm:text-xs tracking-wider sm:tracking-widest uppercase transition-all duration-200 shadow-[0_0_12px_rgba(239,35,60,0.45)] flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98]"
                >
                  <Play className="w-3 h-3 fill-white text-white shrink-0 ml-0.5" />
                  <span className="font-sans font-black tracking-[0.14em] drop-shadow-sm">INICIAR</span>
                </button>
              </div>
            </aside>

            {/* Right: 6 Selector Buttons (3 cols x 2 rows, 60% opacity) */}
            <div className="flex-1 min-h-0 grid grid-cols-3 grid-rows-2 gap-1.5 items-stretch h-full">
              {screen3Selectors.map((btn) => (
                <button
                  key={btn.id}
                  onClick={btn.action}
                  onMouseEnter={playUiHover}
                  className="group relative rounded-xl overflow-hidden text-left cursor-pointer transition-all duration-300 flex flex-col justify-between p-1.5 sm:p-2 select-none border border-white/20 hover:border-red-500/80 hover:shadow-[0_0_14px_rgba(239,68,68,0.4)] hover:scale-[1.01]"
                >
                  {/* Background Image: exactly 60% opacity */}
                  <img
                    src={btn.bg}
                    alt={btn.title}
                    className="absolute inset-0 w-full h-full object-cover opacity-60 transition-transform duration-500 ease-out group-hover:scale-105"
                    loading="eager"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-black/20 pointer-events-none" />
                  <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors pointer-events-none" />

                  {/* ONLY BIG LETTERS / TITLE */}
                  <div className="relative z-10 flex items-center justify-between gap-1 w-full">
                    <span className="text-[10px] sm:text-[11px] md:text-xs font-black uppercase tracking-wide text-white drop-shadow truncate font-sans">
                      {btn.title}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-neutral-400 group-hover:text-red-400 transition-colors shrink-0" />
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* LAYOUT B: PORTRAIT VIEWPORT (Vertical Phone: Minimalist Top Bar + 2x3 Grid) */}
          {/* ========================================================================= */}
          <div className="flex landscape:hidden flex-col gap-1 sm:gap-1.5 flex-1 min-h-0 h-full w-full overflow-hidden">
            {/* Top Minimalist Summary Bar (arriba) */}
            <div className="flex-shrink-0 rounded-lg sm:rounded-xl bg-neutral-950/80 backdrop-blur-md border border-white/15 p-1 sm:p-1.5 shadow-lg">
              {/* Row 1: Title + Action Button */}
              <div className="flex items-center justify-between mb-0.5 sm:mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-[9px] sm:text-[9.5px] font-black uppercase tracking-wider text-white font-mono">
                    RESUMEN TÉCNICO FIA
                  </span>
                </div>
                <div className="w-28 sm:w-32">
                  {activeScreen === 'career' && (
                    <button
                      onClick={handleLaunchCareer}
                      onMouseEnter={playUiHover}
                      className="w-full py-1 px-2 rounded-lg bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-neutral-950 font-black text-[9px] tracking-wider uppercase transition-all shadow-md flex items-center justify-center gap-1 cursor-pointer active:scale-95"
                    >
                      <Play className="w-2.5 h-2.5 fill-current" />
                      <span>INICIAR</span>
                    </button>
                  )}
                  {activeScreen === 'free' && (
                    <button
                      onClick={handleLaunchFreePractice}
                      onMouseEnter={playUiHover}
                      className="w-full py-1 px-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-neutral-950 font-black text-[9px] tracking-wider uppercase transition-all shadow-md flex items-center justify-center gap-1 cursor-pointer active:scale-95"
                    >
                      <Play className="w-2.5 h-2.5 fill-current" />
                      <span>A PISTA</span>
                    </button>
                  )}
                  {activeScreen === 'multiplayer' && (
                    <button
                      onClick={() => { playUiClick(850); setActiveOverlay('multiplayer_modal'); }}
                      onMouseEnter={playUiHover}
                      className="w-full py-1 px-2 rounded-lg bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 text-neutral-950 font-black text-[9px] tracking-wider uppercase transition-all shadow-md flex items-center justify-center gap-1 cursor-pointer active:scale-95"
                    >
                      <Zap className="w-2.5 h-2.5 fill-current" />
                      <span>{roomState ? 'GESTIONAR' : 'UNIRSE'}</span>
                    </button>
                  )}
                  {activeScreen === 'grand_prix' && (
                    <button
                      onClick={handleLaunchGrandPrix}
                      onMouseEnter={playUiHover}
                      className="w-full py-1 px-2 rounded-lg bg-gradient-to-r from-red-600 via-rose-500 to-red-600 hover:from-red-500 hover:to-rose-400 text-white font-black text-[9px] tracking-wider uppercase transition-all shadow-md flex items-center justify-center gap-1 cursor-pointer active:scale-95"
                    >
                      <Play className="w-2.5 h-2.5 fill-current" />
                      <span>INICIAR GP</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Row 2: 6 Quick Horizontal Summary Chips */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 text-[7.5px] sm:text-[8px] font-mono">
                <div
                  onClick={() => { playUiClick(700); setActiveOverlay('circuit'); }}
                  className="px-1 py-0.5 rounded bg-white/[0.04] border border-white/10 text-center truncate cursor-pointer"
                >
                  <span className="text-neutral-400">🏁 </span>
                  <span className="text-white font-bold truncate">{currentCircuit.name}</span>
                </div>
                <div
                  onClick={() => { playUiClick(700); setActiveOverlay('tires'); }}
                  className="px-1 py-0.5 rounded bg-white/[0.04] border border-white/10 text-center truncate cursor-pointer flex items-center justify-center gap-1"
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      startingCompound === 'soft' ? 'bg-red-500' : startingCompound === 'medium' ? 'bg-yellow-400' : 'bg-white'
                    }`}
                  />
                  <span className="text-white font-bold truncate">{startingCompound.toUpperCase()}</span>
                </div>
                <div
                  onClick={() => { playUiClick(700); setActiveOverlay('laps'); }}
                  className="px-1 py-0.5 rounded bg-white/[0.04] border border-white/10 text-center truncate cursor-pointer"
                >
                  <span className="text-neutral-400">⏱️ </span>
                  <span className="text-amber-300 font-bold">{laps}V</span>
                </div>
                <div
                  onClick={() => { playUiClick(700); if (activeScreen === 'multiplayer') setActiveOverlay('multiplayer_modal'); else setActiveOverlay('difficulty'); }}
                  className="px-1 py-0.5 rounded bg-white/[0.04] border border-white/10 text-center truncate cursor-pointer"
                >
                  <span className="text-neutral-400">⚡ </span>
                  <span className="text-white font-bold truncate">{difficulty.toUpperCase()}</span>
                </div>
                <div
                  onClick={() => { playUiClick(700); setActiveOverlay('livery'); }}
                  className="px-1 py-0.5 rounded bg-white/[0.04] border border-white/10 text-center truncate cursor-pointer"
                >
                  <span className="text-neutral-400">🏎️ </span>
                  <span className="text-white font-bold truncate">#{carNumber} {driverCode}</span>
                </div>
                <div
                  onClick={() => { playUiClick(700); setActiveOverlay('setup'); }}
                  className="px-1 py-0.5 rounded bg-white/[0.04] border border-white/10 text-center truncate cursor-pointer"
                >
                  <span className="text-neutral-400">🛠️ </span>
                  <span className="text-emerald-400 font-bold">TC:{tractionControl ? 'ON' : 'OFF'}</span>
                </div>
              </div>
            </div>

            {/* 6 Selector Buttons Grid (2 cols x 3 rows, 60% opacity) */}
            <div className="flex-1 min-h-0 grid grid-cols-2 grid-rows-3 gap-1 sm:gap-1.5 items-stretch h-full w-full">
              {screen3Selectors.map((btn) => (
                <button
                  key={btn.id}
                  onClick={btn.action}
                  onMouseEnter={playUiHover}
                  className="group relative rounded-lg sm:rounded-xl overflow-hidden text-left cursor-pointer transition-all duration-200 flex flex-col justify-end p-1.5 sm:p-2 select-none border border-white/20 hover:border-red-500/80 hover:shadow-[0_0_14px_rgba(239,68,68,0.4)] hover:scale-[1.01] h-full w-full min-h-0"
                >
                  {/* Background Image: exactly 60% opacity */}
                  <img
                    src={btn.bg}
                    alt={btn.title}
                    className="absolute inset-0 w-full h-full object-cover opacity-60 transition-transform duration-500 ease-out group-hover:scale-105 pointer-events-none"
                    loading="eager"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-black/20 pointer-events-none" />
                  <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors pointer-events-none" />

                  {/* ONLY BIG LETTERS / TITLE */}
                  <div className="relative z-10 flex items-center justify-between gap-1 w-full mt-auto">
                    <span className="text-[9px] xs:text-[10px] sm:text-xs font-black uppercase tracking-wide text-white drop-shadow truncate font-sans">
                      {btn.title}
                    </span>
                    <ChevronRight className="w-3 h-3 text-neutral-400 group-hover:text-red-400 transition-colors shrink-0" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </main>
      )}

      {/* ========================================================================= */}
      {/* 4. SUPERIMPOSED OVERLAYS (PANTALLAS SUPERPUESTAS)                         */}
      {/* ========================================================================= */}

      {/* OVERLAY 1: TIRES SELECTION MODAL - REDESIGNED IDENTICAL TO REFERENCE DESIGN */}
      {activeOverlay === 'tires' && (
        <div className="fixed inset-0 z-50 h-[100dvh] max-h-[100dvh] w-full max-w-[100vw] overflow-hidden flex flex-col justify-between p-2 sm:p-3 md:p-4 landscape:p-2 landscape:py-1.5 animate-in fade-in duration-200 select-none bg-black">
          {/* Cinema-grade F1 Garage Pitlane Background with floor reflections */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <img
              src="/images/tire_strategy_full_bg.webp"
              alt="Estrategia de Neumáticos"
              className="w-full h-full object-cover brightness-[0.72] contrast-[1.08] select-none pointer-events-none"
            />
            {/* Ambient vignette and floor reflection depth */}
            <div className="absolute inset-0 bg-radial-[circle_at_center,transparent_20%,rgba(5,7,11,0.85)_100%] pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-black/60 pointer-events-none" />
          </div>

          {/* Top Header Bar */}
          <div className="relative z-10 flex items-start justify-between w-full max-w-7xl mx-auto mb-1 sm:mb-2 landscape:mb-0.5">
            <div className="flex items-start gap-2 sm:gap-3">
              {/* Slanted red speed chevrons /// */}
              <div className="flex items-center gap-1 mt-0.5 sm:mt-1 shrink-0">
                <span className="w-1.5 h-4 sm:h-6 -skew-x-[25deg] bg-red-600 block shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                <span className="w-1.5 h-4 sm:h-6 -skew-x-[25deg] bg-red-600 block shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                <span className="w-2 h-4 sm:h-6 -skew-x-[25deg] bg-red-600 block shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
              </div>
              <div>
                <h2 className="text-xs sm:text-xl md:text-2xl font-black italic tracking-wider text-white uppercase font-sans drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]">
                  ESTRATEGIA DE NEUMÁTICOS
                </h2>
                <p className="text-[8px] sm:text-xs text-neutral-300 font-medium tracking-wide mt-0.5 drop-shadow hidden sm:block">
                  Selecciona el compuesto según agarre, temperatura y duración.
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                playUiClick(700);
                setActiveOverlay('none');
              }}
              onMouseEnter={playUiHover}
              className="p-1 sm:p-2 text-white/80 hover:text-white hover:scale-110 transition-transform cursor-pointer"
              title="Cerrar"
            >
              <X className="w-5 h-5 sm:w-8 sm:h-8 stroke-[2.5]" />
            </button>
          </div>

          {/* Center 3 Compound Cards */}
          <div className="relative z-10 w-full max-w-7xl mx-auto my-auto py-1 flex-1 min-h-0 flex items-center justify-center">
            <div className="grid grid-cols-3 gap-1.5 sm:gap-3 md:gap-4 lg:gap-6 items-stretch w-full max-h-[72dvh]">
              {[
                {
                  id: 'soft' as TireCompoundType,
                  name: 'BLANDO',
                  code: 'C4',
                  image: '/images/tire_soft_render.png',
                  codeColor: 'text-red-500',
                  grip: '100%',
                  gripColor: 'text-red-500',
                  desc: 'Máximo agarre instantáneo y tracción en curva.',
                  thermalDegrad: 'ALTA DEGRADACIÓN TÉRMICA',
                  thermalSegments: 5,
                  laps: '8–10 VUELTAS',
                  lapsColor: 'text-red-500',
                  tempOptima: '90° – 110°C',
                  tempSegmentsCount: 4,
                  wearSegments: 5,
                  accentColor: 'red',
                  barColor: 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.7)]',
                  iconColor: 'text-red-500',
                  glowColor: 'rgba(239,68,68,0.5)',
                  topBorder: '',
                },
                {
                  id: 'medium' as TireCompoundType,
                  name: 'MEDIO',
                  code: 'C3',
                  image: '/images/tire_medium_render.png',
                  codeColor: 'text-yellow-400',
                  grip: '92%',
                  gripColor: 'text-yellow-400',
                  desc: 'Equilibrio ideal para tandas medias y estrategias estándar.',
                  thermalDegrad: 'DEGRADACIÓN MEDIA',
                  thermalSegments: 3,
                  laps: '18–25 VUELTAS',
                  lapsColor: 'text-white',
                  tempOptima: '80° – 100°C',
                  tempSegmentsCount: 3,
                  wearSegments: 3,
                  accentColor: 'yellow',
                  barColor: 'bg-yellow-400 shadow-[0_0_6px_rgba(250,204,21,0.7)]',
                  iconColor: 'text-yellow-400',
                  glowColor: 'rgba(250,204,21,0.5)',
                  topBorder: 'border-t-2 border-t-yellow-400/80',
                },
                {
                  id: 'hard' as TireCompoundType,
                  name: 'DURO',
                  code: 'C2',
                  image: '/images/tire_hard_render.png',
                  codeColor: 'text-neutral-200',
                  grip: '84%',
                  gripColor: 'text-white',
                  desc: 'Baja degradación para stints largos o una sola parada.',
                  thermalDegrad: 'MÍNIMA DEGRADACIÓN',
                  thermalSegments: 1,
                  laps: '35+ VUELTAS',
                  lapsColor: 'text-white',
                  tempOptima: '70° – 90°C',
                  tempSegmentsCount: 2,
                  wearSegments: 1,
                  accentColor: 'white',
                  barColor: 'bg-neutral-200 shadow-[0_0_6px_rgba(255,255,255,0.7)]',
                  iconColor: 'text-neutral-300',
                  glowColor: 'rgba(255,255,255,0.4)',
                  topBorder: 'border-t-2 border-t-white/70',
                },
              ].map((tire) => {
                const isSelected = startingCompound === tire.id;
                return (
                  <button
                    key={tire.id}
                    onClick={() => {
                      playUiClick(750);
                      setStartingCompound(tire.id);
                    }}
                    onMouseEnter={playUiHover}
                    className={`relative rounded-xl sm:rounded-3xl p-2 sm:p-4 md:p-5 text-left transition-all duration-300 cursor-pointer flex flex-col justify-between overflow-hidden bg-[#0a0c12]/92 backdrop-blur-md ${
                      isSelected
                        ? tire.id === 'soft'
                          ? 'border-2 border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.45),inset_0_0_15px_rgba(239,68,68,0.12)] scale-[1.01]'
                          : tire.id === 'medium'
                          ? 'border-2 border-yellow-400 shadow-[0_0_30px_rgba(250,204,21,0.45),inset_0_0_15px_rgba(250,204,21,0.12)] scale-[1.01]'
                          : 'border-2 border-white shadow-[0_0_30px_rgba(255,255,255,0.4),inset_0_0_15px_rgba(255,255,255,0.12)] scale-[1.01]'
                        : `border border-white/10 ${tire.topBorder} hover:border-white/30 hover:bg-[#0e111a]/95`
                    }`}
                  >
                    {/* Top right checkmark badge when selected */}
                    {isSelected && (
                      <div className="absolute top-1.5 right-1.5 sm:top-4 sm:right-4 z-20">
                        <div
                          className={`w-5 h-5 sm:w-6 sm:h-6 rounded-md flex items-center justify-center ${
                            tire.id === 'soft'
                              ? 'bg-red-500/20 text-red-500 border border-red-500/60'
                              : tire.id === 'medium'
                              ? 'bg-yellow-400/20 text-yellow-400 border border-yellow-400/60'
                              : 'bg-white/20 text-white border border-white/60'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[3]" />
                        </div>
                      </div>
                    )}

                    {/* Upper Section: Tire 3D Render & Detailed Specs */}
                    <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2.5 md:gap-3.5">
                      {/* 3D Tire Render with realistic asphalt reflection */}
                      <div className="relative shrink-0 w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 lg:w-24 flex items-center justify-center py-0.5">
                        <img
                          src={tire.image}
                          alt={`${tire.name} ${tire.code}`}
                          className="w-full h-full max-h-12 sm:max-h-16 md:max-h-20 lg:max-h-24 object-contain select-none pointer-events-none transform group-hover:scale-105 transition-transform duration-300 drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)]"
                          loading="eager"
                        />
                      </div>

                      {/* Specs Column */}
                      <div className="flex-1 min-w-0 w-full text-center sm:text-left pr-0 sm:pr-1">
                        {/* Title: NAME CODE */}
                        <div className="flex items-baseline justify-center sm:justify-start gap-1 sm:gap-1.5 flex-nowrap">
                          <span className="text-[11px] sm:text-xs md:text-sm lg:text-base font-black italic tracking-wide text-white font-sans whitespace-nowrap">
                            {tire.name}
                          </span>
                          <span className={`text-[11px] sm:text-xs md:text-sm lg:text-base font-black italic font-sans shrink-0 ${tire.codeColor}`}>
                            {tire.code}
                          </span>
                        </div>

                        {/* Description */}
                        <p className="hidden lg:block text-[9.5px] sm:text-[10.5px] text-neutral-300 leading-snug mt-0.5 font-medium line-clamp-1">
                          {tire.desc}
                        </p>

                        {/* Grip Row: / 100% AGARRE */}
                        <div className="flex items-baseline justify-center sm:justify-start gap-0.5 sm:gap-1 mt-0.5 sm:mt-1">
                          <span className={`text-[10px] sm:text-xs font-bold ${tire.gripColor}`}>/</span>
                          <span className={`text-[11px] sm:text-sm md:text-base font-black font-mono tracking-tight ${tire.gripColor}`}>
                            {tire.grip}
                          </span>
                          <span className="text-[7px] sm:text-[8.5px] font-black tracking-widest text-neutral-400 uppercase font-sans ml-0.5">
                            AGARRE
                          </span>
                        </div>

                        {/* Thermal Degradation Row with 5 Segments */}
                        <div className="mt-0.5 sm:mt-1">
                          <div className="flex items-center justify-center sm:justify-start gap-1 text-neutral-300">
                            <Thermometer className={`w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0 ${tire.iconColor}`} />
                            <span className="text-[6.5px] sm:text-[8px] md:text-[9px] font-black uppercase tracking-wider text-neutral-300 whitespace-nowrap">
                              {tire.thermalDegrad.replace(' TÉRMICA', '')}
                            </span>
                          </div>
                          <div className="flex items-center gap-0.5 sm:gap-1 mt-0.5">
                            {[1, 2, 3, 4, 5].map((segIndex) => {
                              const isFilled = segIndex <= tire.thermalSegments;
                              return (
                                <span
                                  key={segIndex}
                                  className={`h-0.5 sm:h-1 flex-1 rounded-xs transition-colors ${
                                    isFilled ? tire.barColor : 'bg-neutral-800'
                                  }`}
                                />
                              );
                            })}
                          </div>
                        </div>

                        {/* Stint Laps Row */}
                        <div className="flex items-center justify-center sm:justify-start gap-1 mt-0.5 sm:mt-1">
                          <Clock className={`w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0 ${tire.iconColor}`} />
                          <span className={`text-[8.5px] sm:text-[10.5px] font-black font-mono tracking-wide ${tire.lapsColor}`}>
                            {tire.laps}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Subtle horizontal separation (only on large desktop viewports) */}
                    <div className="hidden lg:block border-t border-white/10 my-2" />

                    {/* Bottom metrics sub-bar: Temp. Óptima & Desgaste (only on desktop where vertical height permits) */}
                    <div className="hidden lg:grid grid-cols-2 gap-2 text-left px-1">
                      {/* Temp. Óptima */}
                      <div>
                        <div className="flex items-center gap-1 text-neutral-400">
                          <Thermometer className={`w-3 h-3 shrink-0 ${tire.iconColor}`} />
                          <span className="text-[8px] font-bold uppercase tracking-wider text-neutral-400">
                            TEMP. ÓPTIMA
                          </span>
                        </div>
                        <div className="text-[10px] font-bold text-white font-mono mt-0.5">
                          {tire.tempOptima}
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          {[1, 2, 3, 4, 5].map((idx) => {
                            const active = idx <= tire.tempSegmentsCount;
                            return (
                              <span
                                key={idx}
                                className={`h-1 flex-1 rounded-xs ${
                                  active ? tire.barColor : 'bg-neutral-800'
                                }`}
                              />
                            );
                          })}
                        </div>
                      </div>

                      {/* Desgaste */}
                      <div>
                        <div className="flex items-center gap-1 text-neutral-400">
                          <CircleDot className={`w-3 h-3 shrink-0 ${tire.iconColor}`} />
                          <span className="text-[8px] font-bold uppercase tracking-wider text-neutral-400">
                            DESGASTE
                          </span>
                        </div>
                        <div className="h-[16px] flex items-center">
                          <div className="flex items-center gap-1 w-full mt-1">
                            {[1, 2, 3, 4, 5].map((idx) => {
                              const filled = idx <= tire.wearSegments;
                              return (
                                <span
                                  key={idx}
                                  className={`h-1 flex-1 rounded-xs ${
                                    filled ? tire.barColor : 'bg-neutral-800'
                                  }`}
                                />
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bottom Action Section: Futuristic Hex/Chamfered Confirm Button */}
          <div className="relative z-10 flex items-center justify-center gap-2 sm:gap-4 md:gap-6 mt-1 sm:mt-2.5 landscape:mt-1 mb-0.5 sm:mb-1 landscape:mb-0">
            {/* Left floor accent speed ticks */}
            <div className="flex items-center gap-1 opacity-70">
              <span className="w-2.5 h-1.5 -skew-x-[25deg] bg-red-600 block shadow-[0_0_6px_rgba(239,68,68,0.8)]" />
              <span className="w-4 h-1.5 -skew-x-[25deg] bg-red-600 block shadow-[0_0_6px_rgba(239,68,68,0.8)]" />
            </div>

            {/* Chamfered CTA Button */}
            <button
              onClick={() => {
                playUiClick(700);
                setActiveOverlay('none');
              }}
              onMouseEnter={playUiHover}
              className="relative group cursor-pointer px-5 sm:px-10 md:px-14 py-1.5 sm:py-2.5 landscape:py-1.5 rounded-lg border-2 border-red-500/80 bg-gradient-to-r from-red-950/70 via-red-900/50 to-red-950/70 hover:from-red-600 hover:to-red-700 hover:border-red-400 transition-all duration-300 shadow-[0_0_25px_rgba(239,68,68,0.45)] hover:shadow-[0_0_35px_rgba(239,68,68,0.8)] flex items-center justify-center gap-2 sm:gap-3"
            >
              {/* Left bracket decorative element */}
              <span className="absolute -left-2.5 top-1/2 -translate-y-1/2 text-red-500 font-mono text-base sm:text-lg font-bold pointer-events-none select-none">
                〈
              </span>
              {/* Right bracket decorative element */}
              <span className="absolute -right-2.5 top-1/2 -translate-y-1/2 text-red-500 font-mono text-base sm:text-lg font-bold pointer-events-none select-none">
                〉
              </span>

              <span className="text-[10px] sm:text-xs md:text-sm font-black uppercase tracking-widest text-white font-mono group-hover:tracking-[0.18em] transition-all">
                CONFIRMAR NEUMÁTICOS
              </span>
              <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 text-red-400 group-hover:text-white group-hover:translate-x-1 transition-all" />
            </button>

            {/* Right floor accent speed ticks */}
            <div className="flex items-center gap-1 opacity-70">
              <span className="w-4 h-1.5 -skew-x-[25deg] bg-red-600 block shadow-[0_0_6px_rgba(239,68,68,0.8)]" />
              <span className="w-2.5 h-1.5 -skew-x-[25deg] bg-red-600 block shadow-[0_0_6px_rgba(239,68,68,0.8)]" />
            </div>
          </div>
        </div>
      )}

      {/* OVERLAY 2: CIRCUIT SELECTION MODAL - REDESIGNED IDENTICAL TO REFERENCE DESIGN */}
      {activeOverlay === 'circuit' && (
        <div
          className="fixed inset-0 z-50 max-h-[100dvh] overflow-hidden flex items-center justify-center p-2 sm:p-4 select-none animate-in fade-in duration-200"
          style={{
            backgroundImage: "url('/images/circuit_clean_bg.webp')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        >
          {/* Subtle dark ambient backdrop overlay */}
          <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px] pointer-events-none" />

          {/* MAIN MODAL CONTAINER WITH CHAMFERED CORNERS */}
          <div
            className="relative z-10 w-full max-w-2xl md:max-w-3xl max-h-[98dvh] my-auto p-[1px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.95),0_0_40px_rgba(0,0,0,0.85)] animate-in zoom-in-95 duration-200"
            style={{
              clipPath:
                'polygon(16px 0%, calc(100% - 16px) 0%, 100% 16px, 100% calc(100% - 16px), calc(100% - 16px) 100%, 16px 100%, 0% calc(100% - 16px), 0% 16px)',
              background:
                'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(100,110,130,0.18) 50%, rgba(35,40,50,0.45) 100%)',
            }}
          >
            <div
              className="w-full bg-[#0a0c13]/95 p-2 sm:p-3 md:p-4 landscape:p-2 landscape:py-1.5 flex flex-col justify-between"
              style={{
                clipPath:
                  'polygon(15px 0%, calc(100% - 15px) 0%, 100% 15px, 100% calc(100% - 15px), calc(100% - 15px) 100%, 15px 100%, 0% calc(100% - 15px), 0% 15px)',
              }}
            >
              {/* TOP HEADER */}
              <div className="flex items-center justify-between mb-1 sm:mb-2 landscape:mb-1">
                <div className="flex items-center gap-2 sm:gap-2.5">
                  <span className="w-1.5 sm:w-2 h-4 sm:h-5 bg-red-600 -skew-x-[20deg] inline-block shadow-[0_0_12px_rgba(239,68,68,0.9)] shrink-0" />
                  <div>
                    <h2 className="text-xs sm:text-sm md:text-base font-black uppercase tracking-wider text-white font-mono">
                      SELECCIÓN DE CIRCUITO FIA
                    </h2>
                    <p className="text-[9px] sm:text-[11px] text-neutral-400 font-sans mt-0.5">
                      Elige el trazado de competición
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    playUiClick(700);
                    setActiveOverlay('none');
                  }}
                  className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  title="Cerrar"
                >
                  <X className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>

              {/* THREE CIRCUIT CARDS GRID */}
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5 md:gap-3 landscape:gap-1.5">
                {AVAILABLE_CIRCUITS.map((c) => {
                  const isSelected = selectedCircuit === c.id;

                  // Circuit visuals matching the reference design precisely
                  const isC1 = c.id === 'square_apex';
                  const isC2 = c.id === 'speedway_gp';
                  const isC3 = c.id === 'singapore_marina';

                  const previewImage = isC1
                    ? '/images/circuit_preview_1.webp'
                    : isC2
                    ? '/images/circuit_preview_2.webp'
                    : '/images/circuit_preview_3.webp';

                  const displayName = isC1 ? 'CIRCUIT 1' : isC2 ? 'CIRCUIT 2' : 'MARINA BAY';
                  const kmText = isC1 ? '0.97 KM' : isC2 ? '2.17 KM' : '4.93 KM';
                  const curvesText = isC1 ? '4 Curvas' : isC2 ? '8 Curvas' : '19 Curvas';
                  const topSpeedVal = isC1 ? 345 : isC2 ? 358 : 355;

                  return (
                    <div
                      key={c.id}
                      onClick={() => handleSelectCircuitLocal(c.id)}
                      onMouseEnter={playUiHover}
                      className={`relative cursor-pointer transition-all duration-200 group text-left ${
                        isSelected ? 'scale-[1.01]' : 'hover:scale-[1.005]'
                      }`}
                    >
                      {/* Outer Card Chamfered Frame */}
                      <div
                        className={`w-full p-[1.5px] transition-all duration-200 ${
                          isSelected
                            ? 'shadow-[0_0_25px_rgba(239,68,68,0.45)]'
                            : 'hover:shadow-[0_0_15px_rgba(255,255,255,0.08)]'
                        }`}
                        style={{
                          clipPath:
                            'polygon(12px 0%, calc(100% - 12px) 0%, 100% 12px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 12px 100%, 0% calc(100% - 12px), 0% 12px)',
                          background: isSelected
                            ? 'linear-gradient(180deg, #ef4444 0%, #dc2626 50%, #b91c1c 100%)'
                            : 'linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(55,60,70,0.35) 100%)',
                        }}
                      >
                        <div
                          className={`w-full h-full flex flex-col justify-between p-1.5 sm:p-2 landscape:p-1.5 transition-colors ${
                            isSelected ? 'bg-[#121015]' : 'bg-[#10121a] group-hover:bg-[#131620]'
                          }`}
                          style={{
                            clipPath:
                              'polygon(11px 0%, calc(100% - 11px) 0%, 100% 11px, 100% calc(100% - 11px), calc(100% - 11px) 100%, 11px 100%, 0% calc(100% - 11px), 0% 11px)',
                          }}
                        >
                          {/* Track Preview Image with chamfered top */}
                          <div
                            className="relative w-full aspect-16/9 rounded-t-lg overflow-hidden bg-black/60 shrink-0 max-h-16 sm:max-h-20 md:max-h-24 landscape:max-h-14 sm:landscape:max-h-16"
                            style={{
                              clipPath:
                                'polygon(8px 0%, calc(100% - 8px) 0%, 100% 8px, 100% 100%, 0% 100%, 0% 8px)',
                            }}
                          >
                            <img
                              src={previewImage}
                              alt={displayName}
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                              loading="eager"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent pointer-events-none" />

                            {/* Red Checkmark Badge on Selected */}
                            {isSelected && (
                              <div className="absolute top-1 right-1 sm:top-1.5 sm:right-1.5 w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 border-red-500 bg-red-950/70 flex items-center justify-center shadow-[0_0_12px_rgba(239,68,68,0.9)] animate-in zoom-in-75 duration-150">
                                <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-red-500 stroke-[3]" />
                              </div>
                            )}
                          </div>

                          {/* Info area below preview */}
                          <div className="pt-1 sm:pt-1.5 landscape:pt-0.5 px-0.5 flex flex-col justify-between grow">
                            <div>
                              {/* National Flag */}
                              <div className="mb-0.5 sm:mb-1 landscape:mb-0.5">
                                {isC1 && (
                                  <div className="w-5 h-3.5 rounded-xs overflow-hidden border border-white/20 flex flex-col shrink-0 shadow-xs">
                                    <div className="w-full h-1/2 bg-red-600" />
                                    <div className="w-full h-1/2 bg-white" />
                                  </div>
                                )}
                                {isC2 && (
                                  <div className="w-5 h-3.5 rounded-xs overflow-hidden border border-white/20 flex shrink-0 shadow-xs">
                                    <div className="w-1/3 h-full bg-[#009246]" />
                                    <div className="w-1/3 h-full bg-white" />
                                    <div className="w-1/3 h-full bg-[#ce2b37]" />
                                  </div>
                                )}
                                {isC3 && (
                                  <div className="w-5 h-3.5 rounded-xs overflow-hidden border border-white/20 flex flex-col shrink-0 shadow-xs relative">
                                    <div className="w-full h-1/2 bg-[#ED2939] flex items-center pl-0.5">
                                      <span className="text-[5px] text-white leading-none font-bold">★</span>
                                    </div>
                                    <div className="w-full h-1/2 bg-white" />
                                  </div>
                                )}
                              </div>

                              {/* Circuit Name */}
                              <div className="text-white font-extrabold uppercase tracking-wider text-[9px] sm:text-xs md:text-sm font-mono truncate">
                                {displayName}
                              </div>

                              {/* Distance & Curves */}
                              <div className="text-neutral-400 font-mono text-[7px] sm:text-[9px] md:text-[11px] mt-0.5 truncate">
                                {kmText} &nbsp;•&nbsp; {curvesText}
                              </div>
                            </div>

                            {/* Max Speed */}
                            <div className="mt-1 sm:mt-1.5 landscape:mt-0.5 pt-0.5 sm:pt-1 border-t border-white/5 flex items-center gap-1 font-mono text-[7px] sm:text-[9px] md:text-[11px]">
                              <Gauge
                                className={`w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0 ${
                                  isSelected ? 'text-red-500' : 'text-amber-400'
                                }`}
                              />
                              <span
                                className={`truncate ${
                                  isSelected ? 'text-red-500 font-bold' : 'text-amber-400 font-bold'
                                }`}
                              >
                                {topSpeedVal} km/h
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* BOTTOM CONFIRM BUTTON - CHAMFERED WITH RED NEON OUTLINE */}
              <div className="mt-1.5 sm:mt-2.5 landscape:mt-1 w-full flex justify-center">
                <button
                  onClick={() => {
                    playUiClick(700);
                    setActiveOverlay('none');
                  }}
                  onMouseEnter={playUiHover}
                  className="relative w-full group cursor-pointer transition-all duration-200 active:scale-[0.99]"
                  style={{
                    filter: 'drop-shadow(0 0 16px rgba(239,68,68,0.45))',
                  }}
                >
                  <div
                    className="w-full p-[1.5px] transition-all"
                    style={{
                      clipPath:
                        'polygon(16px 0%, calc(100% - 16px) 0%, 100% 50%, calc(100% - 16px) 100%, 16px 100%, 0% 50%)',
                      background:
                        'linear-gradient(90deg, #dc2626 0%, #ef4444 30%, #f87171 50%, #ef4444 70%, #dc2626 100%)',
                    }}
                  >
                    <div
                      className="w-full py-1.5 sm:py-2.5 landscape:py-1.5 px-3 sm:px-6 flex items-center justify-center gap-2 transition-colors bg-gradient-to-r from-[#141217] via-[#1c1822] to-[#141217] group-hover:from-[#1c1620] group-hover:via-[#251d2c] group-hover:to-[#1c1620]"
                      style={{
                        clipPath:
                          'polygon(15px 0%, calc(100% - 15px) 0%, calc(100% - 1px) 50%, calc(100% - 15px) 100%, 15px 100%, 1px 50%)',
                      }}
                    >
                      <span className="text-white font-mono font-black text-[10px] sm:text-xs md:text-sm tracking-widest uppercase">
                        CONFIRMAR CIRCUITO
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-500 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* OVERLAY 3: LAPS & DISTANCE MODAL */}
      {activeOverlay === 'laps' && (
        <div
          className="fixed inset-0 z-50 max-h-[100dvh] overflow-hidden flex items-center justify-center p-2 sm:p-4 select-none animate-in fade-in duration-200 laps-modal-backdrop"
        >
          {/* Subtle dark ambient backdrop overlay for maximum readability while preserving the wet track & pit lights */}
          <div className="absolute inset-0 bg-black/30 backdrop-blur-[0.5px] pointer-events-none" />

          <div className="relative z-10 w-full max-w-md landscape:max-w-3xl max-h-[96dvh] flex flex-col landscape:flex-row landscape:items-center landscape:justify-center gap-2 sm:gap-3 landscape:gap-4 my-auto">
            {/* LEFT COLUMN IN LANDSCAPE / TOP IN PORTRAIT: HEADER & (IN LANDSCAPE) ACTION BUTTON */}
            <div className="flex flex-col gap-2 landscape:gap-3 landscape:w-[42%] shrink-0">
              {/* HEADER PANEL WITH CHAMFERED CORNER */}
              <div
                className="relative transition-all"
                style={{
                  clipPath: 'polygon(20px 0, 100% 0, 100% 100%, 0 100%, 0 20px)',
                }}
              >
                <div
                  className="p-[1.5px] bg-gradient-to-b from-amber-500/50 via-neutral-700/60 to-neutral-800/80 shadow-[0_0_15px_rgba(245,158,11,0.25)]"
                  style={{
                    clipPath: 'polygon(20px 0, 100% 0, 100% 100%, 0 100%, 0 20px)',
                  }}
                >
                  <div
                    className="px-4 py-3 sm:py-3.5 bg-[#0d0e13]/95 flex items-center justify-between"
                    style={{
                      backgroundColor: 'rgba(13, 14, 19, 0.94)',
                      clipPath: 'polygon(19px 0, 100% 0, 100% 100%, 0 100%, 0 19px)',
                      backgroundImage:
                        'radial-gradient(ellipse at 20% 50%, rgba(245, 158, 11, 0.08) 0%, transparent 60%), repeating-linear-gradient(45deg, rgba(255,255,255,0.015) 0px, rgba(255,255,255,0.015) 1px, transparent 1px, transparent 6px)',
                    }}
                  >
                    <div className="flex items-center gap-3">
                      {/* Glowing Amber Racing Emblem // */}
                      <div
                        className="relative flex items-center justify-center w-10 h-10 bg-black/70 border border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.35)] shrink-0"
                        style={{
                          clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)',
                        }}
                      >
                        <div className="flex items-center gap-1 -skew-x-12">
                          <span className="w-1.5 h-5 bg-amber-400 rounded-xs shadow-[0_0_8px_#f59e0b]" />
                          <span className="w-1.5 h-5 bg-amber-400 rounded-xs shadow-[0_0_8px_#f59e0b]" />
                        </div>
                      </div>

                      <div>
                        <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white font-mono leading-none">
                          DURACIÓN DEL
                        </h3>
                        <h2 className="text-base sm:text-lg font-black uppercase tracking-wider text-amber-400 font-mono leading-tight drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]">
                          GRAN PREMIO
                        </h2>
                        <p className="text-[10px] text-neutral-400 font-mono">
                          Selecciona el número de vueltas de la carrera
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        playUiClick(700);
                        setActiveOverlay('none');
                      }}
                      className="p-1.5 text-neutral-400 hover:text-white hover:bg-white/10 rounded transition-colors cursor-pointer self-start"
                      aria-label="Cerrar modal"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* CONFIRM BUTTON (SHOWN IN LANDSCAPE ORIENTATION ON LEFT COLUMN) */}
              <div className="hidden landscape:block pt-1">
                <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-amber-400/90 to-transparent shadow-[0_0_8px_#f59e0b] mb-2 opacity-90" />
                <button
                  onClick={() => {
                    playUiClick(700);
                    setActiveOverlay('none');
                  }}
                  onMouseEnter={playUiHover}
                  className="w-full relative group transition-all duration-200 cursor-pointer"
                  style={{
                    filter: 'drop-shadow(0 0 14px rgba(245, 158, 11, 0.45))',
                  }}
                >
                  <div
                    className="p-[1.5px] bg-gradient-to-r from-amber-500 via-amber-300 to-amber-500 transition-all group-hover:brightness-125"
                    style={{
                      clipPath:
                        'polygon(14px 0, calc(100% - 14px) 0, 100% 14px, 100% calc(100% - 14px), calc(100% - 14px) 100%, 14px 100%, 0 calc(100% - 14px), 0 14px)',
                    }}
                  >
                    <div
                      className="py-2.5 px-4 bg-gradient-to-r from-neutral-950 via-[#18150e] to-neutral-950 flex items-center justify-center gap-2 transition-colors"
                      style={{
                        backgroundColor: '#0c0d12',
                        clipPath:
                          'polygon(13px 0, calc(100% - 13px) 0, 100% 13px, 100% calc(100% - 13px), calc(100% - 13px) 100%, 13px 100%, 0 calc(100% - 13px), 0 13px)',
                        backgroundImage:
                          'linear-gradient(to right, #0a0a0c, #1a160f, #0a0a0c), repeating-linear-gradient(45deg, rgba(245, 158, 11, 0.025) 0px, rgba(245, 158, 11, 0.025) 1px, transparent 1px, transparent 6px)',
                      }}
                    >
                      <span className="font-mono text-xs font-black uppercase tracking-[0.2em] text-white">
                        CONFIRMAR DURACIÓN
                      </span>
                      <ArrowRight className="w-4 h-4 text-amber-400 stroke-[3] transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                </button>
                <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-amber-400/90 to-transparent shadow-[0_0_8px_#f59e0b] mt-2 opacity-90" />
              </div>
            </div>

            {/* RIGHT COLUMN IN LANDSCAPE / MAIN COLUMN IN PORTRAIT: THREE LAP OPTIONS CARDS */}
            <div className="flex flex-col gap-2.5 landscape:w-[58%] flex-1">
              {[
                {
                  val: 9 as RaceLapOption,
                  title: 'SPRINT RÁPIDO',
                  desc: 'Carrera corta de alta intensidad',
                  litBars: 4,
                },
                {
                  val: 20 as RaceLapOption,
                  title: 'GRAN PREMIO',
                  desc: 'Estrategia completa y gestión de neumáticos',
                  litBars: 5,
                },
                {
                  val: 50 as RaceLapOption,
                  title: 'RESISTENCIA',
                  desc: 'Carrera larga, desgaste y estrategia avanzada',
                  litBars: 7,
                },
              ].map((item) => {
                const isSelected = laps === item.val;
                // Format estimated lap time in M:SS format
                const lapTime = currentCircuit.expectedLapTimeSec || 16.8;
                const totalSecs = Math.round(lapTime * item.val);
                const mins = Math.floor(totalSecs / 60);
                const secs = Math.round(totalSecs % 60);
                const timeFormatted = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

                return (
                  <div
                    key={item.val}
                    onClick={() => {
                      playUiClick(700);
                      setLaps(item.val);
                    }}
                    onMouseEnter={playUiHover}
                    className="relative transition-all duration-200 cursor-pointer group"
                    style={{
                      clipPath:
                        'polygon(14px 0, calc(100% - 14px) 0, 100% 14px, 100% calc(100% - 14px), calc(100% - 14px) 100%, 14px 100%, 0 calc(100% - 14px), 0 14px)',
                      filter: isSelected
                        ? 'drop-shadow(0 0 16px rgba(245, 158, 11, 0.4))'
                        : 'none',
                    }}
                  >
                    <div
                      className={`p-[1.5px] transition-all duration-200 ${
                        isSelected
                          ? 'bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500'
                          : 'bg-gradient-to-b from-neutral-700/80 via-neutral-800/60 to-neutral-700/80 group-hover:from-neutral-500 group-hover:to-neutral-600'
                      }`}
                      style={{
                        clipPath:
                          'polygon(14px 0, calc(100% - 14px) 0, 100% 14px, 100% calc(100% - 14px), calc(100% - 14px) 100%, 14px 100%, 0 calc(100% - 14px), 0 14px)',
                      }}
                    >
                      <div
                        className="px-2.5 py-1.5 sm:px-4 sm:py-2.5 flex items-center justify-between gap-2 transition-all"
                        style={{
                          backgroundColor: isSelected ? 'rgba(14, 15, 20, 0.94)' : 'rgba(15, 16, 21, 0.92)',
                          clipPath:
                            'polygon(13px 0, calc(100% - 13px) 0, 100% 13px, 100% calc(100% - 13px), calc(100% - 13px) 100%, 13px 100%, 0 calc(100% - 13px), 0 13px)',
                          backgroundImage: isSelected
                            ? 'radial-gradient(ellipse at 50% 0%, rgba(245, 158, 11, 0.09) 0%, rgba(245, 158, 11, 0.02) 65%, transparent 100%), repeating-linear-gradient(45deg, rgba(255,255,255,0.015) 0px, rgba(255,255,255,0.015) 1px, transparent 1px, transparent 6px), repeating-linear-gradient(-45deg, rgba(255,255,255,0.015) 0px, rgba(255,255,255,0.015) 1px, transparent 1px, transparent 6px)'
                            : 'repeating-linear-gradient(45deg, rgba(255,255,255,0.012) 0px, rgba(255,255,255,0.012) 1px, transparent 1px, transparent 6px), repeating-linear-gradient(-45deg, rgba(255,255,255,0.012) 0px, rgba(255,255,255,0.012) 1px, transparent 1px, transparent 6px)',
                        }}
                      >
                        {/* LEFT: NUMBER & VUELTAS */}
                        <div className="flex flex-col items-center justify-center min-w-[50px] sm:min-w-[70px] shrink-0">
                          <div
                            className={`text-xl sm:text-3xl font-black font-mono leading-none tracking-tight ${
                              isSelected
                                ? 'text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]'
                                : 'text-neutral-200'
                            }`}
                          >
                            {String(item.val).padStart(2, '0')}
                          </div>
                          <div
                            className={`text-[8.5px] sm:text-[10px] font-black tracking-widest uppercase mt-0.5 ${
                              isSelected ? 'text-amber-400' : 'text-neutral-400'
                            }`}
                          >
                            VUELTAS
                          </div>
                        </div>

                        {/* VERTICAL DIVIDER */}
                        <div
                          className={`w-[1px] h-7 sm:h-9 self-center shrink-0 ${
                            isSelected ? 'bg-amber-500/40' : 'bg-white/10'
                          }`}
                        />

                        {/* MIDDLE: TITLE, DESCRIPTION & ESTIMATED TIME */}
                        <div className="flex-1 min-w-0 pr-1">
                          <div
                            className={`text-xs sm:text-sm font-black uppercase tracking-wider font-mono truncate ${
                              isSelected ? 'text-amber-400 drop-shadow-[0_0_6px_rgba(245,158,11,0.3)]' : 'text-white'
                            }`}
                          >
                            {item.title}
                          </div>
                          <div className="hidden xs:block text-[9.5px] sm:text-[11px] text-neutral-300 leading-tight mt-0.5 line-clamp-1 font-sans">
                            {item.desc}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5 sm:mt-1">
                            <Clock
                              className={`w-3 h-3 shrink-0 ${
                                isSelected ? 'text-amber-400' : 'text-neutral-400'
                              }`}
                            />
                            <span className="text-[8.5px] sm:text-[9px] font-bold uppercase tracking-wider text-neutral-400 font-mono">
                              EST.
                            </span>
                            <span
                              className={`text-[11px] sm:text-xs font-black font-mono ${
                                isSelected ? 'text-amber-400' : 'text-neutral-200'
                              }`}
                            >
                              {timeFormatted}
                            </span>
                          </div>
                        </div>

                        {/* RIGHT: SLANTED METER BARS & RADIO CHECK */}
                        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                          {/* 7 Slanted Bars */}
                          <div className="hidden xs:flex items-center gap-0.5 sm:gap-1">
                            {Array.from({ length: 7 }).map((_, barIdx) => {
                              const isLit = barIdx < item.litBars;
                              return (
                                <div
                                  key={barIdx}
                                  className={`w-1.5 sm:w-2 h-2.5 sm:h-3 -skew-x-12 rounded-[1px] transition-colors ${
                                    isLit
                                      ? isSelected
                                        ? 'bg-amber-400 shadow-[0_0_6px_#f59e0b]'
                                        : 'bg-neutral-300'
                                      : 'bg-neutral-800'
                                  }`}
                                />
                              );
                            })}
                          </div>

                          {/* Radio Check Circle */}
                          {isSelected ? (
                            <div className="w-4 h-4 sm:w-6 sm:h-6 rounded-full border-2 border-amber-400 bg-amber-400/20 flex items-center justify-center shadow-[0_0_10px_rgba(245,158,11,0.6)] shrink-0">
                              <Check className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-amber-400 stroke-[3]" />
                            </div>
                          ) : (
                            <div className="w-4 h-4 sm:w-6 sm:h-6 rounded-full border border-neutral-600/90 bg-neutral-900/50 shrink-0" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* CONFIRMATION ACTION BUTTON WITH GLOW RAILS (SHOWN IN PORTRAIT ORIENTATION AT BOTTOM) */}
            <div className="landscape:hidden relative pt-0.5">
              <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-amber-400/90 to-transparent shadow-[0_0_8px_#f59e0b] mb-1.5 opacity-90" />

              <button
                onClick={() => {
                  playUiClick(700);
                  setActiveOverlay('none');
                }}
                onMouseEnter={playUiHover}
                className="w-full relative group transition-all duration-200 cursor-pointer"
                style={{
                  filter: 'drop-shadow(0 0 16px rgba(245, 158, 11, 0.55))',
                }}
              >
                <div
                  className="p-[1.5px] bg-gradient-to-r from-amber-500 via-amber-300 to-amber-500 transition-all group-hover:brightness-125"
                  style={{
                    clipPath:
                      'polygon(14px 0, calc(100% - 14px) 0, 100% 14px, 100% calc(100% - 14px), calc(100% - 14px) 100%, 14px 100%, 0 calc(100% - 14px), 0 14px)',
                  }}
                >
                  <div
                    className="py-2 sm:py-2.5 px-4 sm:px-6 bg-gradient-to-r from-neutral-950 via-[#18150e] to-neutral-950 flex items-center justify-center gap-2 transition-colors"
                    style={{
                      backgroundColor: '#0c0d12',
                      clipPath:
                        'polygon(13px 0, calc(100% - 13px) 0, 100% 13px, 100% calc(100% - 13px), calc(100% - 13px) 100%, 13px 100%, 0 calc(100% - 13px), 0 13px)',
                      backgroundImage:
                        'linear-gradient(to right, #0a0a0c, #1a160f, #0a0a0c), repeating-linear-gradient(45deg, rgba(245, 158, 11, 0.025) 0px, rgba(245, 158, 11, 0.025) 1px, transparent 1px, transparent 6px)',
                    }}
                  >
                    <span className="font-mono text-xs sm:text-sm font-black uppercase tracking-[0.2em] text-white">
                      CONFIRMAR DURACIÓN
                    </span>
                    <ArrowRight className="w-4 h-4 text-amber-400 stroke-[3] transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </button>

              <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-amber-400/90 to-transparent shadow-[0_0_8px_#f59e0b] mt-1.5 opacity-90" />
            </div>
          </div>
        </div>
      )}


      {/* OVERLAY 4: AI DIFFICULTY MODAL - EXACT REPLICA OF REFERENCE DESIGN */}
      {activeOverlay === 'difficulty' && (
        <div
          className="fixed inset-0 z-50 max-h-[100dvh] overflow-hidden flex items-center justify-center p-2 sm:p-4 select-none animate-in fade-in duration-200 difficulty-modal-backdrop"
        >
          {/* Subtle dark ambient backdrop overlay for readability while keeping the rainy track and car in full glory */}
          <div className="absolute inset-0 bg-black/35 backdrop-blur-[0.5px] pointer-events-none" />

          {/* Centered in portrait, anchored to the left in landscape just like the reference! */}
          <div className="relative z-10 w-full max-w-xl max-h-[98dvh] landscape:max-w-2xl landscape:mr-auto landscape:ml-4 sm:landscape:ml-10 md:landscape:ml-16 flex flex-col gap-1 sm:gap-1.5 landscape:gap-1 my-auto">
            {/* TOP BADGE: // CONFIGURACIÓN DE CARRERA */}
            <div className="flex items-center gap-2 mb-0 landscape:mb-0">
              <div className="flex items-center gap-0.5 -skew-x-12">
                <span className="w-1.5 h-2.5 sm:h-3 bg-cyan-400 rounded-xs shadow-[0_0_8px_#22d3ee]" />
                <span className="w-1.5 h-2.5 sm:h-3 bg-cyan-400 rounded-xs shadow-[0_0_8px_#22d3ee]" />
              </div>
              <span className="text-[9px] sm:text-[11px] font-black uppercase tracking-[0.2em] text-cyan-300 font-mono">
                CONFIGURACIÓN DE CARRERA
              </span>
            </div>

            {/* MAIN HUD FRAME WITH CHAMFERED CORNERS */}
            <div
              className="relative transition-all"
              style={{
                clipPath:
                  'polygon(22px 0, calc(100% - 22px) 0, 100% 22px, 100% calc(100% - 22px), calc(100% - 22px) 100%, 22px 100%, 0 calc(100% - 22px), 0 22px)',
              }}
            >
              <div
                className="p-[1.5px] bg-gradient-to-b from-cyan-500/40 via-neutral-700/60 to-neutral-800/80 shadow-[0_0_30px_rgba(6,182,212,0.15)]"
                style={{
                  clipPath:
                    'polygon(22px 0, calc(100% - 22px) 0, 100% 22px, 100% calc(100% - 22px), calc(100% - 22px) 100%, 22px 100%, 0 calc(100% - 22px), 0 22px)',
                }}
              >
                <div
                  className="p-2 sm:p-3 landscape:p-2 landscape:py-1.5 flex flex-col gap-1.5 sm:gap-2 landscape:gap-1"
                  style={{
                    backgroundColor: 'rgba(10, 13, 20, 0.94)',
                    clipPath:
                      'polygon(21px 0, calc(100% - 21px) 0, 100% 21px, 100% calc(100% - 21px), calc(100% - 21px) 100%, 21px 100%, 0 calc(100% - 21px), 0 21px)',
                    backgroundImage:
                      'radial-gradient(ellipse at 30% 0%, rgba(6, 182, 212, 0.08) 0%, transparent 60%), repeating-linear-gradient(45deg, rgba(255,255,255,0.012) 0px, rgba(255,255,255,0.012) 1px, transparent 1px, transparent 6px)',
                  }}
                >
                  {/* HEADER SECTION */}
                  <div className="flex items-start justify-between pb-1.5 sm:pb-2 landscape:pb-1 border-b border-cyan-500/20 relative">
                    <div>
                      <h2 className="text-xs sm:text-sm md:text-base font-black uppercase tracking-wider text-white font-mono flex items-center gap-1.5">
                        NIVEL DE COMPETITIVIDAD <span className="text-cyan-400">·</span> IA
                      </h2>
                      <p className="text-[9px] sm:text-xs text-neutral-400 font-mono mt-0.5">
                        Ajusta la agresividad y el ritmo de los pilotos rivales
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        playUiClick(700);
                        setActiveOverlay('none');
                      }}
                      className="p-1 text-neutral-400 hover:text-white hover:bg-white/10 rounded transition-colors cursor-pointer"
                      aria-label="Cerrar modal"
                    >
                      <X className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>

                    {/* Ambient cyan accent line below header */}
                    <div className="absolute -bottom-[1px] left-0 w-28 h-[1px] bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
                  </div>

                  {/* THREE DIFFICULTY CARDS */}
                  <div className="flex flex-col gap-1 sm:gap-1.5 landscape:gap-1">
                    {[
                      {
                        id: 'easy' as RaceDifficulty,
                        name: 'NOVATO',
                        descLine1: 'Ritmo accesible y permisivo.',
                        descLine2: 'Frenadas anticipadas y trazadas seguras.',
                        agresividad: { pct: 25, lit: 2 },
                        precision: { pct: 30, lit: 2 },
                        presion: { pct: 20, lit: 2 },
                      },
                      {
                        id: 'medium' as RaceDifficulty,
                        name: 'INTERMEDIO',
                        descLine1: 'Competitivo y equilibrado.',
                        descLine2: 'Ritmo consistente y adelantamientos calculados.',
                        agresividad: { pct: 65, lit: 5 },
                        precision: { pct: 70, lit: 6 },
                        presion: { pct: 60, lit: 5 },
                      },
                      {
                        id: 'hard' as RaceDifficulty,
                        name: 'LEYENDA FIA',
                        descLine1: 'Máxima agresividad.',
                        descLine2: 'Frenadas al límite, defensa férrea y errores mínimos.',
                        agresividad: { pct: 95, lit: 8 },
                        precision: { pct: 95, lit: 8 },
                        presion: { pct: 90, lit: 7 },
                      },
                    ].map((diff) => {
                      const isSelected = difficulty === diff.id;

                      return (
                        <div
                          key={diff.id}
                          onClick={() => {
                            playUiClick(700);
                            setDifficulty(diff.id);
                          }}
                          onMouseEnter={playUiHover}
                          className="relative transition-all duration-200 cursor-pointer group"
                          style={{
                            clipPath:
                              'polygon(14px 0, calc(100% - 14px) 0, 100% 14px, 100% calc(100% - 14px), calc(100% - 14px) 100%, 14px 100%, 0 calc(100% - 14px), 0 14px)',
                            filter: isSelected
                              ? 'drop-shadow(0 0 18px rgba(239, 68, 68, 0.55))'
                              : 'none',
                          }}
                        >
                          {/* CARD BORDER WRAPPER */}
                          <div
                            className={`p-[1.5px] transition-all duration-200 ${
                              isSelected
                                ? 'bg-gradient-to-r from-red-600 via-rose-500 to-red-600'
                                : 'bg-gradient-to-r from-cyan-900/40 via-neutral-700/60 to-cyan-900/40 group-hover:from-cyan-700/60 group-hover:to-neutral-600'
                            }`}
                            style={{
                              clipPath:
                                'polygon(14px 0, calc(100% - 14px) 0, 100% 14px, 100% calc(100% - 14px), calc(100% - 14px) 100%, 14px 100%, 0 calc(100% - 14px), 0 14px)',
                            }}
                          >
                            {/* INNER CARD BODY */}
                            <div
                              className="px-2 py-1 sm:px-3.5 sm:py-2 landscape:px-2.5 landscape:py-1 flex items-center justify-between gap-1.5 sm:gap-3 transition-all"
                              style={{
                                backgroundColor: isSelected ? 'rgba(20, 11, 15, 0.95)' : 'rgba(12, 16, 22, 0.92)',
                                clipPath:
                                  'polygon(13px 0, calc(100% - 13px) 0, 100% 13px, 100% calc(100% - 13px), calc(100% - 13px) 100%, 13px 100%, 0 calc(100% - 13px), 0 13px)',
                                backgroundImage: isSelected
                                  ? 'radial-gradient(ellipse at 50% 0%, rgba(239, 68, 68, 0.12) 0%, rgba(239, 68, 68, 0.02) 65%, transparent 100%), repeating-linear-gradient(45deg, rgba(255,255,255,0.012) 0px, rgba(255,255,255,0.012) 1px, transparent 1px, transparent 6px)'
                                  : 'repeating-linear-gradient(45deg, rgba(255,255,255,0.012) 0px, rgba(255,255,255,0.012) 1px, transparent 1px, transparent 6px)',
                              }}
                            >
                              {/* LEFT: SLANTED STRIPES & TITLE / DESCRIPTION */}
                              <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 flex-1">
                                {/* Slanted racing hazard stripes // */}
                                <div className="flex items-center gap-0.5 sm:gap-1 -skew-x-12 shrink-0">
                                  <span
                                    className={`w-1 sm:w-1.5 h-3.5 sm:h-4.5 rounded-xs transition-colors ${
                                      isSelected
                                        ? 'bg-red-500 shadow-[0_0_8px_#ef4444]'
                                        : 'bg-gradient-to-b from-cyan-400 to-blue-500 shadow-[0_0_6px_rgba(6,182,212,0.6)]'
                                    }`}
                                  />
                                  <span
                                    className={`w-1 sm:w-1.5 h-3.5 sm:h-4.5 rounded-xs transition-colors ${
                                      isSelected
                                        ? 'bg-red-500 shadow-[0_0_8px_#ef4444]'
                                        : 'bg-gradient-to-b from-cyan-400 to-blue-500 shadow-[0_0_6px_rgba(6,182,212,0.6)]'
                                    }`}
                                  />
                                </div>

                                <div className="min-w-0">
                                  <div className="text-[10.5px] sm:text-xs md:text-sm font-black uppercase tracking-wider font-mono text-white truncate">
                                    {diff.name}
                                  </div>
                                  <div className="text-[8.5px] sm:text-[10px] text-neutral-300 font-sans leading-tight mt-0.5 truncate">
                                    {diff.descLine1}
                                  </div>
                                  <div className="text-[8.5px] sm:text-[10px] text-neutral-400 font-sans leading-tight hidden xl:block">
                                    {diff.descLine2}
                                  </div>
                                </div>
                              </div>

                              {/* RIGHT: 3 TELEMETRY METERS & CHECKMARK */}
                              <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
                                <div className="flex flex-col gap-0.5 sm:gap-1 min-w-[95px] sm:min-w-[145px]">
                                  {/* Metric 1: AGRESIVIDAD */}
                                  <div className="flex items-center justify-between gap-1 text-[7.5px] sm:text-[8.5px] font-mono">
                                    <div className="flex items-center gap-1 text-neutral-400">
                                      <Crosshair className={`w-2.5 h-2.5 sm:w-3 sm:h-3 ${isSelected ? 'text-red-400' : 'text-cyan-400'}`} />
                                      <span className="uppercase tracking-wider">AGRESIVIDAD</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <div className="flex items-center gap-0.5">
                                        {Array.from({ length: 8 }).map((_, barIdx) => {
                                          const isLit = barIdx < diff.agresividad.lit;
                                          return (
                                            <div
                                              key={barIdx}
                                              className={`w-1 sm:w-1.5 h-1.5 sm:h-2 rounded-[1px] transition-colors ${
                                                isLit
                                                  ? isSelected
                                                    ? 'bg-red-500 shadow-[0_0_5px_#ef4444]'
                                                    : 'bg-cyan-400 shadow-[0_0_5px_#22d3ee]'
                                                  : 'bg-neutral-800'
                                              }`}
                                            />
                                          );
                                        })}
                                      </div>
                                      <span className={`w-5 sm:w-6 text-right font-bold ${isSelected ? 'text-red-400' : 'text-cyan-300'}`}>
                                        {diff.agresividad.pct}%
                                      </span>
                                    </div>
                                  </div>

                                  {/* Metric 2: PRECISIÓN */}
                                  <div className="flex items-center justify-between gap-1 text-[7.5px] sm:text-[8.5px] font-mono">
                                    <div className="flex items-center gap-1 text-neutral-400">
                                      <Target className={`w-2.5 h-2.5 sm:w-3 sm:h-3 ${isSelected ? 'text-red-400' : 'text-cyan-400'}`} />
                                      <span className="uppercase tracking-wider">PRECISIÓN</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <div className="flex items-center gap-0.5">
                                        {Array.from({ length: 8 }).map((_, barIdx) => {
                                          const isLit = barIdx < diff.precision.lit;
                                          return (
                                            <div
                                              key={barIdx}
                                              className={`w-1 sm:w-1.5 h-1.5 sm:h-2 rounded-[1px] transition-colors ${
                                                isLit
                                                  ? isSelected
                                                    ? 'bg-red-500 shadow-[0_0_5px_#ef4444]'
                                                    : 'bg-cyan-400 shadow-[0_0_5px_#22d3ee]'
                                                  : 'bg-neutral-800'
                                              }`}
                                            />
                                          );
                                        })}
                                      </div>
                                      <span className={`w-5 sm:w-6 text-right font-bold ${isSelected ? 'text-red-400' : 'text-cyan-300'}`}>
                                        {diff.precision.pct}%
                                      </span>
                                    </div>
                                  </div>

                                  {/* Metric 3: PRESIÓN */}
                                  <div className="flex items-center justify-between gap-1 text-[7.5px] sm:text-[8.5px] font-mono">
                                    <div className="flex items-center gap-1 text-neutral-400">
                                      <Gauge className={`w-2.5 h-2.5 sm:w-3 sm:h-3 ${isSelected ? 'text-red-400' : 'text-cyan-400'}`} />
                                      <span className="uppercase tracking-wider">PRESIÓN</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <div className="flex items-center gap-0.5">
                                        {Array.from({ length: 8 }).map((_, barIdx) => {
                                          const isLit = barIdx < diff.presion.lit;
                                          return (
                                            <div
                                              key={barIdx}
                                              className={`w-1 sm:w-1.5 h-1.5 sm:h-2 rounded-[1px] transition-colors ${
                                                isLit
                                                  ? isSelected
                                                    ? 'bg-red-500 shadow-[0_0_5px_#ef4444]'
                                                    : 'bg-cyan-400 shadow-[0_0_5px_#22d3ee]'
                                                  : 'bg-neutral-800'
                                              }`}
                                            />
                                          );
                                        })}
                                      </div>
                                      <span className={`w-5 sm:w-6 text-right font-bold ${isSelected ? 'text-red-400' : 'text-cyan-300'}`}>
                                        {diff.presion.pct}%
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Selection Check Radio Circle */}
                                {isSelected ? (
                                  <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 border-red-500 bg-red-500/20 flex items-center justify-center shadow-[0_0_12px_rgba(239,68,68,0.7)] shrink-0">
                                    <Check className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-red-400 stroke-[3]" />
                                  </div>
                                ) : (
                                  <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full border border-neutral-700/80 bg-neutral-900/50 shrink-0" />
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* CONFIRMATION ACTION BUTTON WITH THREE SLANTED RED STRIPES */}
            <div className="relative pt-0.5 landscape:pt-0">
              <button
                onClick={() => {
                  playUiClick(700);
                  setActiveOverlay('none');
                }}
                onMouseEnter={playUiHover}
                className="w-full relative group transition-all duration-200 cursor-pointer"
                style={{
                  filter: 'drop-shadow(0 0 16px rgba(239, 68, 68, 0.5))',
                }}
              >
                <div
                  className="p-[1.5px] bg-gradient-to-r from-red-600 via-rose-400 to-red-600 transition-all group-hover:brightness-125"
                  style={{
                    clipPath:
                      'polygon(14px 0, calc(100% - 14px) 0, 100% 14px, 100% calc(100% - 14px), calc(100% - 14px) 100%, 14px 100%, 0 calc(100% - 14px), 0 14px)',
                  }}
                >
                  <div
                    className="py-1.5 sm:py-2.5 landscape:py-1.5 px-3 sm:px-6 bg-gradient-to-r from-neutral-950 via-[#180a0e] to-neutral-950 flex items-center justify-center gap-2 sm:gap-3 transition-colors relative"
                    style={{
                      backgroundColor: '#0c0709',
                      clipPath:
                        'polygon(13px 0, calc(100% - 13px) 0, 100% 13px, 100% calc(100% - 13px), calc(100% - 13px) 100%, 13px 100%, 0 calc(100% - 13px), 0 13px)',
                      backgroundImage:
                        'linear-gradient(to right, #0a0608, #180a0e, #0a0608), repeating-linear-gradient(45deg, rgba(239, 68, 68, 0.025) 0px, rgba(239, 68, 68, 0.025) 1px, transparent 1px, transparent 6px)',
                    }}
                  >
                    {/* Left Accent: Three Slanted Red Hazard Stripes /// */}
                    <div className="absolute left-3 sm:left-6 flex items-center gap-1 -skew-x-12">
                      <span className="w-1 sm:w-1.5 h-3 sm:h-3.5 bg-red-500 rounded-xs shadow-[0_0_6px_#ef4444]" />
                      <span className="w-1 sm:w-1.5 h-3 sm:h-3.5 bg-red-500 rounded-xs shadow-[0_0_6px_#ef4444]" />
                      <span className="w-1 sm:w-1.5 h-3 sm:h-3.5 bg-red-500 rounded-xs shadow-[0_0_6px_#ef4444]" />
                    </div>

                    <span className="font-mono text-[10.5px] sm:text-xs md:text-sm font-black uppercase tracking-[0.2em] text-white">
                      CONFIRMAR DIFICULTAD
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-400 stroke-[3] transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OVERLAY 5: LIVERY & DRIVER IDENTITY - IDENTICAL TO REFERENCE DESIGN */}
      {activeOverlay === 'livery' && (
        <div className="fixed inset-0 z-50 h-[100dvh] max-h-[100dvh] w-full max-w-[100vw] overflow-hidden flex flex-col justify-between p-2 sm:p-4 md:p-6 animate-in fade-in duration-200 select-none bg-[#05070c]">
          {/* Background: Authentic High-Fidelity Sunset Pitlane & Wet Asphalt Reflections */}
          <img
            src="/assets/aistudio/file_0000000017d882468167dfa6f51ad628_4c32eeea.png"
            alt="Pitlane Sunset"
            className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none z-0"
          />
          {/* Atmospheric Cinematic Gradients: smooth dark backdrop on UI side, sunset pitlane open on right */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#06080e] via-[#06080e]/95 via-55% to-transparent pointer-events-none z-0" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/60 pointer-events-none z-0" />

          {/* Interactive UI Container (Positioned on the Left Exactly as in Reference Image) */}
          <div className="relative z-10 w-full max-w-4xl flex flex-col justify-between h-full min-h-0 py-0.5 sm:py-1">
            
            {/* Top-Left Header: Aerodynamic Dual Slanted Red Winglets + Vertical Divider + Title */}
            <div className="flex items-center gap-2 sm:gap-3.5 mb-1 sm:mb-2">
              <div className="flex items-center gap-1 sm:gap-1.5 -skew-x-12 shrink-0">
                <div className="w-2 sm:w-3.5 h-5 sm:h-8 bg-gradient-to-b from-red-500 to-red-700 rounded-xs shadow-[0_0_12px_rgba(239,68,68,0.9)]" />
                <div className="w-2 sm:w-3.5 h-5 sm:h-8 bg-gradient-to-b from-red-500 to-red-700 rounded-xs shadow-[0_0_12px_rgba(239,68,68,0.9)]" />
              </div>
              <div className="w-[1.5px] h-5 sm:h-8 bg-white/30 shrink-0" />
              <div className="leading-tight min-w-0">
                <h2 className="text-sm sm:text-base md:text-xl font-black uppercase tracking-wider text-white font-sans truncate drop-shadow-md">
                  IDENTIDAD DE PILOTO Y ESCUDERÍA
                </h2>
                <p className="text-[9.5px] sm:text-xs text-neutral-300 font-sans tracking-wide truncate">
                  Define tu presencia en pista
                </p>
              </div>
            </div>

            {/* Top Row: PILOTO | DORSAL | ESCUDERÍA in Chamfered Beveled Dark Container */}
            <div
              className="relative w-full rounded-2xl bg-[#080a10]/95 backdrop-blur-xl border border-red-500/40 p-1.5 sm:p-2.5 shadow-[0_0_25px_rgba(239,68,68,0.25)]"
              style={{
                clipPath: 'polygon(14px 0, calc(100% - 14px) 0, 100% 14px, 100% calc(100% - 14px), calc(100% - 14px) 100%, 14px 100%, 0 calc(100% - 14px), 0 14px)',
              }}
            >
              <div className="grid grid-cols-12 gap-1.5 sm:gap-3 items-center">
                
                {/* Field 1: PILOTO (7 cols on mobile, 5 on desktop) */}
                <div className="col-span-7 sm:col-span-5 flex flex-col">
                  <div className="flex items-center gap-1.5 text-neutral-300 mb-0.5">
                    <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full border border-red-500/80 bg-red-950/60 flex items-center justify-center shrink-0">
                      <User className="w-2 h-2 sm:w-2.5 sm:h-2.5 text-red-400" />
                    </div>
                    <span className="text-[8.5px] sm:text-[9.5px] font-mono uppercase tracking-widest text-neutral-300 font-bold">
                      PILOTO
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-1 bg-black/60 border border-white/10 hover:border-red-500/60 focus-within:border-red-500/80 rounded-lg sm:rounded-xl px-2 sm:px-3 py-1 sm:py-1.5 transition-colors">
                    <input
                      type="text"
                      value={driverDisplayName}
                      onChange={(e) => setDriverDisplayName(e.target.value)}
                      placeholder="ALEX VEGA"
                      maxLength={20}
                      className="w-full bg-transparent text-white font-black text-[11px] sm:text-sm uppercase tracking-wider font-sans focus:outline-none placeholder-neutral-500"
                    />
                    <Pencil className="w-3 h-3 text-neutral-400 shrink-0 opacity-70" />
                  </div>
                </div>

                {/* Field 2: DORSAL (5 cols on mobile, 3 on desktop) */}
                <div className="col-span-5 sm:col-span-3 flex flex-col">
                  <div className="flex items-center gap-1.5 text-neutral-300 mb-0.5">
                    <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-xs border border-red-500/80 bg-red-950/60 flex items-center justify-center shrink-0">
                      <Hash className="w-2 h-2 sm:w-2.5 sm:h-2.5 text-red-400 stroke-[3]" />
                    </div>
                    <span className="text-[8.5px] sm:text-[9.5px] font-mono uppercase tracking-widest text-neutral-300 font-bold">
                      DORSAL
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-1 bg-black/60 border border-white/10 rounded-lg sm:rounded-xl px-1.5 sm:px-2 py-0.5 sm:py-1">
                    <button
                      type="button"
                      onClick={() => {
                        playUiClick(700);
                        const num = Math.max(1, (parseInt(carNumber, 10) || 1) - 1);
                        setCarNumber(num.toString());
                      }}
                      className="p-1 hover:text-red-400 text-neutral-300 transition-colors cursor-pointer"
                      title="Dorsal anterior"
                    >
                      <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
                    </button>
                    <input
                      type="text"
                      value={carNumber}
                      onChange={(e) => setCarNumber(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
                      maxLength={2}
                      className="w-8 sm:w-10 text-center bg-transparent text-sm sm:text-lg font-black text-white font-mono tracking-wider focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        playUiClick(700);
                        const num = Math.min(99, (parseInt(carNumber, 10) || 1) + 1);
                        setCarNumber(num.toString());
                      }}
                      className="p-1 hover:text-red-400 text-neutral-300 transition-colors cursor-pointer"
                      title="Dorsal siguiente"
                    >
                      <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
                    </button>
                  </div>
                </div>

                {/* Field 3: ESCUDERÍA (12 cols on mobile, 4 on desktop) */}
                <div className="col-span-12 sm:col-span-4 flex flex-col">
                  <div className="flex items-center gap-1.5 text-neutral-300 mb-0.5">
                    <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-xs border border-red-500/80 bg-red-950/60 flex items-center justify-center shrink-0">
                      <Shield className="w-2 h-2 sm:w-2.5 sm:h-2.5 text-red-400" />
                    </div>
                    <span className="text-[8.5px] sm:text-[9.5px] font-mono uppercase tracking-widest text-neutral-300 font-bold">
                      ESCUDERÍA
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-1 bg-black/60 border border-white/10 hover:border-red-500/60 focus-within:border-red-500/80 rounded-lg sm:rounded-xl px-2 sm:px-3 py-1 sm:py-1.5 transition-colors">
                    <input
                      type="text"
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      placeholder="VIOLETA PUNK"
                      maxLength={25}
                      className="w-full bg-transparent text-white font-black text-[11px] sm:text-sm uppercase tracking-wider font-sans focus:outline-none placeholder-neutral-500 truncate"
                    />
                    <Pencil className="w-3 h-3 text-neutral-400 shrink-0 opacity-70" />
                    {/* Double Slanted Team Livery Icon Matching Current Selection */}
                    <div className="flex items-center gap-0.5 -skew-x-12 shrink-0 ml-1">
                      <div className="w-2 h-4 sm:w-2.5 sm:h-5 rounded-xs shadow-sm" style={{ backgroundColor: secondaryColor || primaryColor }} />
                      <div className="w-2 h-4 sm:w-2.5 sm:h-5 rounded-xs shadow-sm" style={{ backgroundColor: secondaryColor || primaryColor }} />
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Middle Section: PALETAS DE COLORES DE ESCUDERÍA Panel */}
            <div
              className="relative w-full rounded-2xl bg-[#080a10]/95 backdrop-blur-xl border border-red-500/40 p-2 sm:p-2.5 mt-1 sm:mt-2 shadow-[0_0_25px_rgba(239,68,68,0.25)] flex flex-col justify-between"
              style={{
                clipPath: 'polygon(14px 0, calc(100% - 14px) 0, 100% 14px, 100% calc(100% - 14px), calc(100% - 14px) 100%, 14px 100%, 0 calc(100% - 14px), 0 14px)',
              }}
            >
              <div className="mb-1">
                <span className="text-[10px] sm:text-[11.5px] font-black uppercase tracking-wider text-white font-sans drop-shadow-sm">
                  PALETAS DE COLORES DE ESCUDERÍA
                </span>
              </div>

              {/* 6 Color Preset Cards */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 sm:gap-2">
                {ESCUDERIA_PALETTES.map((preset) => {
                  const isSelected = selectedPaletteId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        playUiClick(700);
                        setSelectedPaletteId(preset.id);
                        setTeamName(preset.name);
                        setPrimaryColor(preset.primaryColor);
                        setSecondaryColor(preset.secondaryColor);
                        setAccentColor(preset.accentColor);
                        setDriverCode(preset.driverCode);
                      }}
                      className={`group relative rounded-xl p-1.5 sm:p-2 text-center transition-all duration-200 cursor-pointer flex flex-col items-center justify-between ${
                        isSelected
                          ? 'border-2 border-red-500 bg-[#170e20]/95 shadow-[0_0_20px_rgba(239,68,68,0.7),inset_0_0_10px_rgba(239,68,68,0.25)] scale-[1.02]'
                          : 'border border-white/10 bg-[#0d1017]/85 hover:border-white/30 hover:bg-[#151922]/90'
                      }`}
                    >
                      {/* Checkmark in top-right when selected */}
                      {isSelected && (
                        <div className="absolute top-1 right-1 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-red-600 border border-white flex items-center justify-center shadow-md">
                          <Check className="w-2 h-2 sm:w-2.5 sm:h-2.5 text-white stroke-[3.5]" />
                        </div>
                      )}

                      {/* Double Slanted Colored Bars Icon */}
                      <div className="flex items-center justify-center gap-1 -skew-x-12 my-0.5 sm:my-1">
                        <div
                          className="w-2.5 sm:w-3.5 h-4 sm:h-6 rounded-xs shadow-md"
                          style={{ backgroundColor: preset.stripesColor }}
                        />
                        <div
                          className="w-2.5 sm:w-3.5 h-4 sm:h-6 rounded-xs shadow-md"
                          style={{ backgroundColor: preset.stripesColor }}
                        />
                      </div>

                      {/* Palette Title */}
                      <span className="text-[8px] sm:text-[9.5px] font-black uppercase tracking-tight text-white font-sans mt-0.5 leading-tight truncate w-full">
                        {preset.name}
                      </span>

                      {/* 4 Color Dots */}
                      <div className="flex items-center justify-center gap-0.5 sm:gap-1 mt-1">
                        {preset.dots.map((d, i) => (
                          <div
                            key={i}
                            className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full border border-black/40 shadow-xs shrink-0"
                            style={{ backgroundColor: d }}
                          />
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Studio Banner: ESTUDIO DE DISEÑO Y PATROCINADORES with authentic helmet asset */}
              <button
                type="button"
                onClick={() => {
                  playUiClick(750);
                  setActiveOverlay('none');
                  if (onOpenLiveryStudio) onOpenLiveryStudio();
                }}
                className="group relative w-full mt-1 sm:mt-2 py-1 sm:py-1.5 px-2 sm:px-4 rounded-xl bg-black/60 hover:bg-black/85 border border-white/15 hover:border-red-500/70 transition-all cursor-pointer flex items-center justify-center gap-2 sm:gap-3 shadow-lg overflow-hidden"
              >
                {/* Left Authentic Racing Helmet Graphic */}
                <div className="absolute left-2 sm:left-4 flex items-center pointer-events-none">
                  <img
                    src="/images/livery_studio_helmet.png"
                    alt="Helmet Studio"
                    className="h-5 sm:h-7 md:h-8 object-contain rounded-xs drop-shadow-[0_0_8px_rgba(217,70,239,0.5)]"
                  />
                </div>

                <span className="text-[9.5px] sm:text-xs md:text-sm font-black uppercase tracking-[0.18em] text-white font-sans group-hover:text-red-400 transition-colors drop-shadow-md">
                  ESTUDIO DE DISEÑO Y PATROCINADORES
                </span>
              </button>
            </div>

            {/* Bottom Actions: Centered GUARDAR Y CONFIRMAR + Left VOLVER */}
            <div className="flex flex-col items-center justify-center mt-1 sm:mt-2 w-full relative">
              {/* Slanted Hexagon-Cut Ferrari-Red Parallelogram Confirm Button */}
              <button
                type="button"
                onClick={() => {
                  playUiClick(850);
                  saveLivery({
                    driverName: driverDisplayName.trim() || 'ALEX VEGA',
                    driverCode: (driverCode || 'PUN').toUpperCase().slice(0, 3),
                    driverNumber: carNumber || '27',
                    teamName: teamName.trim() || 'VIOLETA PUNK',
                    primaryColor: primaryColor || '#3b0764',
                    secondaryColor: secondaryColor || '#a855f7',
                    accentColor: accentColor || '#f472b6',
                    haloColor: '#0c0f16',
                    sponsorName: (teamName || 'VIOLETA PUNK').toUpperCase(),
                  });
                  setActiveOverlay('none');
                }}
                className="relative px-8 sm:px-18 md:px-24 py-1.5 sm:py-2 bg-gradient-to-r from-red-800 via-red-600 to-red-800 hover:from-red-700 hover:via-red-500 hover:to-red-700 text-white font-black text-xs sm:text-sm tracking-[0.25em] uppercase transition-all duration-200 shadow-[0_0_30px_rgba(239,35,60,0.85)] cursor-pointer active:scale-95 border-t border-b border-red-300"
                style={{
                  clipPath: 'polygon(16px 0, calc(100% - 16px) 0, 100% 50%, calc(100% - 16px) 100%, 16px 100%, 0 50%)',
                }}
              >
                GUARDAR Y CONFIRMAR
              </button>

              {/* Bottom Left: VOLVER Button */}
              <div className="w-full flex items-center justify-start mt-1">
                <button
                  type="button"
                  onClick={() => {
                    playUiClick(700);
                    setActiveOverlay('none');
                  }}
                  className="px-3 py-1 rounded-lg bg-black/80 hover:bg-black border border-white/20 hover:border-red-500 text-white font-black text-[10px] sm:text-[11px] tracking-wider uppercase transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
                  style={{
                    clipPath: 'polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)',
                  }}
                >
                  <ChevronLeft className="w-3 h-3 text-red-500 stroke-[3]" />
                  <span>VOLVER</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* OVERLAY 6: ASSISTS & SETUP MODAL - EXACT REPLICA OF REFERENCE DESIGN */}
      {activeOverlay === 'setup' && (
        <div
          className="fixed inset-0 z-50 h-[100dvh] max-h-[100dvh] w-full max-w-[100vw] overflow-hidden flex items-center justify-center p-2 sm:p-4 select-none animate-in fade-in duration-200 assists-modal-backdrop"
        >
          {/* Subtle dark ambient backdrop overlay preserving the golden sunset and garage */}
          <div className="absolute inset-0 bg-black/35 backdrop-blur-[0.5px] pointer-events-none" />

          {/* Centered in portrait, anchored to the left in landscape just like the reference! */}
          <div className="relative z-10 w-full max-w-xl max-h-[98dvh] landscape:max-w-2xl landscape:mr-auto landscape:ml-4 sm:landscape:ml-10 md:landscape:ml-16 flex flex-col justify-between gap-1 sm:gap-1.5 my-auto">
            {/* TOP HEADER PANEL WITH THREE SLANTED RED HAZARD STRIPES */}
            <div
              className="relative transition-all"
              style={{
                clipPath:
                  'polygon(20px 0, calc(100% - 20px) 0, 100% 20px, 100% calc(100% - 20px), calc(100% - 20px) 100%, 0 100%, 0 0)',
              }}
            >
              <div
                className="p-[1.5px] bg-gradient-to-r from-red-600/70 via-neutral-700/60 to-red-600/70 shadow-[0_0_20px_rgba(239,68,68,0.2)]"
                style={{
                  clipPath:
                    'polygon(20px 0, calc(100% - 20px) 0, 100% 20px, 100% calc(100% - 20px), calc(100% - 20px) 100%, 0 100%, 0 0)',
                }}
              >
                <div
                  className="px-3.5 py-1.5 sm:py-2.5 bg-[#0a0d14]/95 flex items-center justify-between"
                  style={{
                    backgroundColor: 'rgba(10, 13, 20, 0.94)',
                    clipPath:
                      'polygon(19px 0, calc(100% - 19px) 0, 100% 19px, 100% calc(100% - 19px), calc(100% - 19px) 100%, 0 100%, 0 0)',
                    backgroundImage:
                      'linear-gradient(to right, rgba(239, 68, 68, 0.08) 0%, transparent 40%), repeating-linear-gradient(45deg, rgba(255,255,255,0.012) 0px, rgba(255,255,255,0.012) 1px, transparent 1px, transparent 6px)',
                  }}
                >
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    {/* Three Slanted Red Hazard Stripes /// */}
                    <div className="flex items-center gap-1 -skew-x-12 shrink-0">
                      <span className="w-1.5 h-5 sm:h-6 bg-red-600 rounded-xs shadow-[0_0_8px_#ef4444]" />
                      <span className="w-1.5 h-5 sm:h-6 bg-red-600 rounded-xs shadow-[0_0_8px_#ef4444]" />
                      <span className="w-1.5 h-5 sm:h-6 bg-red-600 rounded-xs shadow-[0_0_8px_#ef4444]" />
                    </div>

                    <div>
                      <h2 className="text-xs sm:text-base md:text-lg font-black uppercase tracking-wider text-white font-mono leading-none">
                        AYUDAS DE CONDUCCIÓN Y CÁMARA
                      </h2>
                      <p className="text-[9.5px] sm:text-xs text-neutral-300 font-sans mt-0.5">
                        Calibra las asistencias electrónicas de tu monoplaza
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      playUiClick(700);
                      setActiveOverlay('none');
                    }}
                    className="p-1 text-neutral-400 hover:text-white hover:bg-white/10 rounded transition-colors cursor-pointer self-start"
                    aria-label="Cerrar modal"
                  >
                    <X className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* THREE ELECTRONIC ASSISTS CARDS */}
            <div className="flex flex-col gap-1 sm:gap-1.5">
              {/* CARD 1: CONTROL DE TRACCIÓN (TC) */}
              <div
                className="relative transition-all duration-200"
                style={{
                  clipPath:
                    'polygon(12px 0, calc(100% - 12px) 0, 100% 12px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 12px 100%, 0 calc(100% - 12px), 0 12px)',
                }}
              >
                <div
                  className="p-[1.5px] bg-gradient-to-r from-cyan-900/40 via-neutral-700/60 to-cyan-900/40"
                  style={{
                    clipPath:
                      'polygon(12px 0, calc(100% - 12px) 0, 100% 12px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 12px 100%, 0 calc(100% - 12px), 0 12px)',
                  }}
                >
                  <div
                    className="px-2.5 py-1.5 sm:px-4 sm:py-2 flex items-center justify-between gap-2 sm:gap-3"
                    style={{
                      backgroundColor: 'rgba(10, 13, 20, 0.94)',
                      clipPath:
                        'polygon(11px 0, calc(100% - 11px) 0, 100% 11px, 100% calc(100% - 11px), calc(100% - 11px) 100%, 11px 100%, 0 calc(100% - 11px), 0 11px)',
                      backgroundImage:
                        'repeating-linear-gradient(45deg, rgba(255,255,255,0.012) 0px, rgba(255,255,255,0.012) 1px, transparent 1px, transparent 6px)',
                    }}
                  >
                    {/* Left Icon Badge with Red Vertical Glowing Tabs */}
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                      <div className="relative w-8 h-8 sm:w-10 sm:h-10 shrink-0 flex items-center justify-center bg-[#0d121c]/90 border border-cyan-500/30 rounded-md">
                        <span className="absolute -left-[2px] w-[2.5px] h-4 bg-red-500 rounded-full shadow-[0_0_8px_#ef4444]" />
                        <span className="absolute -right-[2px] w-[2.5px] h-4 bg-red-500 rounded-full shadow-[0_0_8px_#ef4444]" />
                        <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11v6a1 1 0 0 1-1 1h-1a2 2 0 0 1-4 0H9a2 2 0 0 1-4 0H4a1 1 0 0 1-1-1v-6z" />
                          <path d="M4 19c2 0 2 2 4 2s2-2 4-2" stroke="#ef4444" strokeWidth="1.5" />
                          <path d="M12 19c2 0 2 2 4 2s2-2 4-2" stroke="#ef4444" strokeWidth="1.5" />
                        </svg>
                      </div>

                      <div className="min-w-0">
                        <div className="text-[11px] sm:text-sm font-black uppercase tracking-wider font-mono text-white truncate">
                          CONTROL DE TRACCIÓN (TC)
                        </div>
                        <div className="text-[9px] sm:text-[11px] text-neutral-300 font-sans leading-tight mt-0.5 truncate sm:whitespace-normal">
                          Evita el derrape en aceleración en curvas lentas
                        </div>
                      </div>
                    </div>

                    {/* Toggle Button */}
                    <button
                      onClick={() => {
                        playUiClick(700);
                        setTractionControl(!tractionControl);
                      }}
                      className="relative cursor-pointer transition-all duration-200 group shrink-0"
                      style={{
                        clipPath: 'polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px), 0 8px)',
                        filter: tractionControl ? 'drop-shadow(0 0 14px rgba(239, 68, 68, 0.55))' : 'none',
                      }}
                    >
                      <div
                        className={`p-[1.5px] transition-all group-hover:brightness-125 ${
                          tractionControl
                            ? 'bg-gradient-to-r from-red-600 via-rose-500 to-red-600'
                            : 'bg-neutral-700/60'
                        }`}
                        style={{
                          clipPath: 'polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px), 0 8px)',
                        }}
                      >
                        <div
                          className="px-3.5 sm:px-5 py-1 sm:py-1.5 flex items-center justify-center transition-colors"
                          style={{
                            backgroundColor: tractionControl ? '#18060a' : '#101217',
                            clipPath: 'polygon(7px 0, calc(100% - 7px) 0, 100% 7px, 100% calc(100% - 7px), calc(100% - 7px) 100%, 7px 100%, 0 calc(100% - 7px), 0 7px)',
                          }}
                        >
                          <span
                            className={`font-mono text-[9px] sm:text-[11px] font-black uppercase tracking-[0.15em] ${
                              tractionControl ? 'text-white' : 'text-neutral-400'
                            }`}
                          >
                            {tractionControl ? 'ACTIVO' : 'INACTIVO'}
                          </span>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              </div>

              {/* CARD 2: SISTEMA ANTIBLOQUEO (ABS) */}
              <div
                className="relative transition-all duration-200"
                style={{
                  clipPath:
                    'polygon(12px 0, calc(100% - 12px) 0, 100% 12px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 12px 100%, 0 calc(100% - 12px), 0 12px)',
                }}
              >
                <div
                  className="p-[1.5px] bg-gradient-to-r from-cyan-900/40 via-neutral-700/60 to-cyan-900/40"
                  style={{
                    clipPath:
                      'polygon(12px 0, calc(100% - 12px) 0, 100% 12px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 12px 100%, 0 calc(100% - 12px), 0 12px)',
                  }}
                >
                  <div
                    className="px-2.5 py-1.5 sm:px-4 sm:py-2 flex items-center justify-between gap-2 sm:gap-3"
                    style={{
                      backgroundColor: 'rgba(10, 13, 20, 0.94)',
                      clipPath:
                        'polygon(11px 0, calc(100% - 11px) 0, 100% 11px, 100% calc(100% - 11px), calc(100% - 11px) 100%, 11px 100%, 0 calc(100% - 11px), 0 11px)',
                      backgroundImage:
                        'repeating-linear-gradient(45deg, rgba(255,255,255,0.012) 0px, rgba(255,255,255,0.012) 1px, transparent 1px, transparent 6px)',
                    }}
                  >
                    {/* Left Icon Badge with Red Vertical Glowing Tabs */}
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                      <div className="relative w-8 h-8 sm:w-10 sm:h-10 shrink-0 flex items-center justify-center bg-[#0d121c]/90 border border-cyan-500/30 rounded-md">
                        <span className="absolute -left-[2px] w-[2.5px] h-4 bg-red-500 rounded-full shadow-[0_0_8px_#ef4444]" />
                        <span className="absolute -right-[2px] w-[2.5px] h-4 bg-red-500 rounded-full shadow-[0_0_8px_#ef4444]" />
                        <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2" />
                          <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.2" />
                          <text x="12" y="14" textAnchor="middle" fill="currentColor" fontSize="5.5" fontWeight="900" fontFamily="monospace">ABS</text>
                        </svg>
                      </div>

                      <div className="min-w-0">
                        <div className="text-[11px] sm:text-sm font-black uppercase tracking-wider font-mono text-white truncate">
                          SISTEMA ANTIBLOQUEO (ABS)
                        </div>
                        <div className="text-[9px] sm:text-[11px] text-neutral-300 font-sans leading-tight mt-0.5 truncate sm:whitespace-normal">
                          Impide que los frenos bloqueen las ruedas en frenadas fuertes
                        </div>
                      </div>
                    </div>

                    {/* Toggle Button */}
                    <button
                      onClick={() => {
                        playUiClick(700);
                        setAbsEnabled(!absEnabled);
                      }}
                      className="relative cursor-pointer transition-all duration-200 group shrink-0"
                      style={{
                        clipPath: 'polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px), 0 8px)',
                        filter: absEnabled ? 'drop-shadow(0 0 14px rgba(239, 68, 68, 0.55))' : 'none',
                      }}
                    >
                      <div
                        className={`p-[1.5px] transition-all group-hover:brightness-125 ${
                          absEnabled
                            ? 'bg-gradient-to-r from-red-600 via-rose-500 to-red-600'
                            : 'bg-neutral-700/60'
                        }`}
                        style={{
                          clipPath: 'polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px), 0 8px)',
                        }}
                      >
                        <div
                          className="px-3.5 sm:px-5 py-1 sm:py-1.5 flex items-center justify-center transition-colors"
                          style={{
                            backgroundColor: absEnabled ? '#18060a' : '#101217',
                            clipPath: 'polygon(7px 0, calc(100% - 7px) 0, 100% 7px, 100% calc(100% - 7px), calc(100% - 7px) 100%, 7px 100%, 0 calc(100% - 7px), 0 7px)',
                          }}
                        >
                          <span
                            className={`font-mono text-[9px] sm:text-[11px] font-black uppercase tracking-[0.15em] ${
                              absEnabled ? 'text-white' : 'text-neutral-400'
                            }`}
                          >
                            {absEnabled ? 'ACTIVO' : 'INACTIVO'}
                          </span>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              </div>

              {/* CARD 3: TRAZADA DINÁMICA FIA */}
              <div
                className="relative transition-all duration-200"
                style={{
                  clipPath:
                    'polygon(12px 0, calc(100% - 12px) 0, 100% 12px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 12px 100%, 0 calc(100% - 12px), 0 12px)',
                }}
              >
                <div
                  className="p-[1.5px] bg-gradient-to-r from-cyan-900/40 via-neutral-700/60 to-cyan-900/40"
                  style={{
                    clipPath:
                      'polygon(12px 0, calc(100% - 12px) 0, 100% 12px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 12px 100%, 0 calc(100% - 12px), 0 12px)',
                  }}
                >
                  <div
                    className="px-2.5 py-1.5 sm:px-4 sm:py-2 flex items-center justify-between gap-2 sm:gap-3"
                    style={{
                      backgroundColor: 'rgba(10, 13, 20, 0.94)',
                      clipPath:
                        'polygon(11px 0, calc(100% - 11px) 0, 100% 11px, 100% calc(100% - 11px), calc(100% - 11px) 100%, 11px 100%, 0 calc(100% - 11px), 0 11px)',
                      backgroundImage:
                        'repeating-linear-gradient(45deg, rgba(255,255,255,0.012) 0px, rgba(255,255,255,0.012) 1px, transparent 1px, transparent 6px)',
                    }}
                  >
                    {/* Left Icon Badge with Red Vertical Glowing Tabs */}
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                      <div className="relative w-8 h-8 sm:w-10 sm:h-10 shrink-0 flex items-center justify-center bg-[#0d121c]/90 border border-cyan-500/30 rounded-md">
                        <span className="absolute -left-[2px] w-[2.5px] h-4 bg-red-500 rounded-full shadow-[0_0_8px_#ef4444]" />
                        <span className="absolute -right-[2px] w-[2.5px] h-4 bg-red-500 rounded-full shadow-[0_0_8px_#ef4444]" />
                        <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="5" cy="18" r="2" fill="currentColor" />
                          <circle cx="19" cy="6" r="2" fill="currentColor" />
                          <path d="M5 16c2-8 12-4 14-8" />
                        </svg>
                      </div>

                      <div className="min-w-0">
                        <div className="text-[11px] sm:text-sm font-black uppercase tracking-wider font-mono text-white truncate">
                          TRAZADA DINÁMICA FIA
                        </div>
                        <div className="text-[9px] sm:text-[11px] text-neutral-300 font-sans leading-tight mt-0.5 truncate sm:whitespace-normal">
                          Guía visual de trayectoria y puntos de frenada óptimos
                        </div>
                      </div>
                    </div>

                    {/* Toggle Button */}
                    <button
                      onClick={() => {
                        playUiClick(700);
                        setRacingLine(!racingLine);
                      }}
                      className="relative cursor-pointer transition-all duration-200 group shrink-0"
                      style={{
                        clipPath: 'polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px), 0 8px)',
                        filter: racingLine ? 'drop-shadow(0 0 14px rgba(239, 68, 68, 0.55))' : 'none',
                      }}
                    >
                      <div
                        className={`p-[1.5px] transition-all group-hover:brightness-125 ${
                          racingLine
                            ? 'bg-gradient-to-r from-red-600 via-rose-500 to-red-600'
                            : 'bg-neutral-700/60'
                        }`}
                        style={{
                          clipPath: 'polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px), 0 8px)',
                        }}
                      >
                        <div
                          className="px-3.5 sm:px-5 py-1 sm:py-1.5 flex items-center justify-center transition-colors"
                          style={{
                            backgroundColor: racingLine ? '#18060a' : '#101217',
                            clipPath: 'polygon(7px 0, calc(100% - 7px) 0, 100% 7px, 100% calc(100% - 7px), calc(100% - 7px) 100%, 7px 100%, 0 calc(100% - 7px), 0 7px)',
                          }}
                        >
                          <span
                            className={`font-mono text-[9px] sm:text-[11px] font-black uppercase tracking-[0.15em] ${
                              racingLine ? 'text-white' : 'text-neutral-400'
                            }`}
                          >
                            {racingLine ? 'ACTIVO' : 'INACTIVO'}
                          </span>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              </div>

              {/* CARD 4: PERSPECTIVA DE CÁMARA PRINCIPAL */}
              <div
                className="relative transition-all duration-200"
                style={{
                  clipPath:
                    'polygon(12px 0, calc(100% - 12px) 0, 100% 12px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 12px 100%, 0 calc(100% - 12px), 0 12px)',
                }}
              >
                <div
                  className="p-[1.5px] bg-gradient-to-r from-cyan-900/40 via-neutral-700/60 to-cyan-900/40"
                  style={{
                    clipPath:
                      'polygon(12px 0, calc(100% - 12px) 0, 100% 12px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 12px 100%, 0 calc(100% - 12px), 0 12px)',
                  }}
                >
                  <div
                    className="p-2 sm:p-2.5 flex flex-col gap-1 sm:gap-1.5"
                    style={{
                      backgroundColor: 'rgba(10, 13, 20, 0.94)',
                      clipPath:
                        'polygon(11px 0, calc(100% - 11px) 0, 100% 11px, 100% calc(100% - 11px), calc(100% - 11px) 100%, 11px 100%, 0 calc(100% - 11px), 0 11px)',
                      backgroundImage:
                        'repeating-linear-gradient(45deg, rgba(255,255,255,0.012) 0px, rgba(255,255,255,0.012) 1px, transparent 1px, transparent 6px)',
                    }}
                  >
                    {/* Header */}
                    <div className="flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5 text-cyan-400" />
                      <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider font-mono text-white">
                        PERSPECTIVA DE CÁMARA PRINCIPAL
                      </span>
                    </div>

                    {/* 4 Camera Selectors */}
                    <div className="grid grid-cols-4 gap-1 sm:gap-2">
                      {[
                        {
                          id: 'chase' as CameraViewMode,
                          name: 'TERCERA',
                          icon: (
                            <svg className="w-4 h-4 sm:w-5 sm:h-5 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                              <path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11v6a1 1 0 0 1-1 1h-1a2 2 0 0 1-4 0H9a2 2 0 0 1-4 0H4a1 1 0 0 1-1-1v-6z" />
                              <circle cx="7" cy="14" r="1.5" />
                              <circle cx="17" cy="14" r="1.5" />
                            </svg>
                          ),
                        },
                        {
                          id: 'bumper' as CameraViewMode,
                          name: 'MORRO',
                          icon: (
                            <svg className="w-4 h-4 sm:w-5 sm:h-5 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                              <path d="M4 14h16M7 14v4M17 14v4M12 6l3 8H9l3-8z" />
                            </svg>
                          ),
                        },
                        {
                          id: 'hood' as CameraViewMode,
                          name: 'CAPÓ',
                          icon: (
                            <svg className="w-4 h-4 sm:w-5 sm:h-5 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                              <rect x="4" y="5" width="16" height="14" rx="2" />
                              <path d="M8 12h8M12 8v8" />
                            </svg>
                          ),
                        },
                        {
                          id: 'orbit' as CameraViewMode,
                          name: 'ÓRBITA',
                          icon: (
                            <svg className="w-4 h-4 sm:w-5 sm:h-5 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                              <circle cx="12" cy="12" r="3" />
                              <circle cx="12" cy="12" r="8" strokeDasharray="3 3" />
                            </svg>
                          ),
                        },
                      ].map((cm) => {
                        const isCamSelected = cameraMode === cm.id;

                        return (
                          <button
                            key={cm.id}
                            onClick={() => {
                              playUiClick(700);
                              setCameraMode(cm.id);
                            }}
                            onMouseEnter={playUiHover}
                            className="relative cursor-pointer transition-all duration-200 group"
                            style={{
                              clipPath:
                                'polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px), 0 8px)',
                              filter: isCamSelected ? 'drop-shadow(0 0 14px rgba(239, 68, 68, 0.6))' : 'none',
                            }}
                          >
                            <div
                              className={`p-[1.5px] transition-all group-hover:brightness-125 ${
                                isCamSelected
                                  ? 'bg-gradient-to-r from-red-600 via-rose-500 to-red-600'
                                  : 'bg-cyan-950/40 group-hover:bg-cyan-700/40'
                              }`}
                              style={{
                                clipPath:
                                  'polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px), 0 8px)',
                              }}
                            >
                              <div
                                className="py-1 sm:py-1.5 px-0.5 sm:px-1 flex flex-col items-center justify-center gap-0.5 transition-colors"
                                style={{
                                  backgroundColor: isCamSelected ? '#1c080d' : '#0c0f16',
                                  clipPath:
                                    'polygon(7px 0, calc(100% - 7px) 0, 100% 7px, 100% calc(100% - 7px), calc(100% - 7px) 100%, 7px 100%, 0 calc(100% - 7px), 0 7px)',
                                }}
                              >
                                <div className={isCamSelected ? 'text-red-400' : 'text-neutral-400 group-hover:text-white'}>
                                  {cm.icon}
                                </div>
                                <span
                                  className={`font-mono text-[8.5px] sm:text-[9.5px] font-black uppercase tracking-wider ${
                                    isCamSelected ? 'text-white' : 'text-neutral-400 group-hover:text-white'
                                  }`}
                                >
                                  {cm.name}
                                </span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* CONFIRMATION ACTION BUTTON WITH THREE SLANTED RED STRIPES */}
            <div className="relative pt-0.5">
              <button
                onClick={() => {
                  playUiClick(700);
                  setActiveOverlay('none');
                }}
                onMouseEnter={playUiHover}
                className="w-full relative group transition-all duration-200 cursor-pointer"
                style={{
                  filter: 'drop-shadow(0 0 16px rgba(239, 68, 68, 0.5))',
                }}
              >
                <div
                  className="p-[1.5px] bg-gradient-to-r from-red-600 via-rose-400 to-red-600 transition-all group-hover:brightness-125"
                  style={{
                    clipPath:
                      'polygon(14px 0, calc(100% - 14px) 0, 100% 14px, 100% calc(100% - 14px), calc(100% - 14px) 100%, 14px 100%, 0 calc(100% - 14px), 0 14px)',
                  }}
                >
                  <div
                    className="py-2 sm:py-2.5 px-4 sm:px-6 bg-gradient-to-r from-neutral-950 via-[#180a0e] to-neutral-950 flex items-center justify-center gap-3 transition-colors relative"
                    style={{
                      backgroundColor: '#0c0709',
                      clipPath:
                        'polygon(13px 0, calc(100% - 13px) 0, 100% 13px, 100% calc(100% - 13px), calc(100% - 13px) 100%, 13px 100%, 0 calc(100% - 13px), 0 13px)',
                      backgroundImage:
                        'linear-gradient(to right, #0a0608, #180a0e, #0a0608), repeating-linear-gradient(45deg, rgba(239, 68, 68, 0.025) 0px, rgba(239, 68, 68, 0.025) 1px, transparent 1px, transparent 6px)',
                    }}
                  >
                    {/* Left Accent: Three Slanted Red Hazard Stripes /// */}
                    <div className="absolute left-3 sm:left-6 flex items-center gap-1 -skew-x-12">
                      <span className="w-1.5 h-3.5 bg-red-500 rounded-xs shadow-[0_0_6px_#ef4444]" />
                      <span className="w-1.5 h-3.5 bg-red-500 rounded-xs shadow-[0_0_6px_#ef4444]" />
                      <span className="w-1.5 h-3.5 bg-red-500 rounded-xs shadow-[0_0_6px_#ef4444]" />
                    </div>

                    <span className="font-mono text-xs sm:text-sm font-black uppercase tracking-[0.2em] text-white">
                      CONFIRMAR REGLAJES
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-400 stroke-[3] transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </button>
            </div>

            {/* BOTTOM LEFT: VOLVER BUTTON */}
            <div className="flex items-center justify-start pt-0.5">
              <button
                type="button"
                onClick={() => {
                  playUiClick(700);
                  setActiveOverlay('none');
                }}
                className="px-3 py-1 rounded-lg bg-black/80 hover:bg-black border border-white/20 hover:border-red-500 text-white font-black text-[10px] sm:text-[11px] tracking-wider uppercase transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
                style={{
                  clipPath: 'polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)',
                }}
              >
                <ChevronLeft className="w-3 h-3 text-red-500 stroke-[3]" />
                <span>VOLVER</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OVERLAY 7: MULTIPLAYER LOBBY MODAL (GT7 / F1 MOTORSPORT REDESIGN) */}
      {activeOverlay === 'multiplayer_modal' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div
            className="relative w-full max-w-lg transition-all"
            style={{
              clipPath:
                'polygon(16px 0, calc(100% - 16px) 0, 100% 16px, 100% calc(100% - 16px), calc(100% - 16px) 100%, 16px 100%, 0 calc(100% - 16px), 0 16px)',
            }}
          >
            {/* Outer Red/Titanium Chamfered Border */}
            <div
              className="p-[1.5px] bg-gradient-to-r from-red-600/80 via-neutral-600/60 to-red-600/80 shadow-[0_0_35px_rgba(239,68,68,0.3)]"
              style={{
                clipPath:
                  'polygon(16px 0, calc(100% - 16px) 0, 100% 16px, 100% calc(100% - 16px), calc(100% - 16px) 100%, 16px 100%, 0 calc(100% - 16px), 0 16px)',
              }}
            >
              {/* Inner Carbon Glass Container */}
              <div
                className="p-5 sm:p-6 text-white relative flex flex-col gap-4"
                style={{
                  backgroundColor: 'rgba(10, 13, 20, 0.96)',
                  clipPath:
                    'polygon(15px 0, calc(100% - 15px) 0, 100% 15px, 100% calc(100% - 15px), calc(100% - 15px) 100%, 15px 100%, 0 calc(100% - 15px), 0 15px)',
                  backgroundImage:
                    'radial-gradient(ellipse at top, rgba(239, 68, 68, 0.12) 0%, transparent 65%), repeating-linear-gradient(45deg, rgba(255,255,255,0.012) 0px, rgba(255,255,255,0.012) 1px, transparent 1px, transparent 6px)',
                }}
              >
                {/* HEADER BANNER */}
                <div className="flex items-center justify-between pb-3.5 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    {/* Three Slanted Red Hazard Stripes /// */}
                    <div className="flex items-center gap-1 -skew-x-12 shrink-0">
                      <span className="w-1.5 h-6 bg-red-600 rounded-xs shadow-[0_0_8px_#ef4444]" />
                      <span className="w-1.5 h-6 bg-red-600 rounded-xs shadow-[0_0_8px_#ef4444]" />
                      <span className="w-1.5 h-6 bg-red-600 rounded-xs shadow-[0_0_8px_#ef4444]" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm sm:text-base font-black uppercase tracking-wider text-white font-mono leading-none">
                          LOBBY MULTIJUGADOR 1V1
                        </h2>
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/40 text-[9px] font-mono font-bold text-emerald-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          ONLINE
                        </span>
                      </div>
                      <p className="text-[10px] sm:text-[11px] text-neutral-300 font-sans mt-0.5">
                        Servidor en tiempo real • WebSocket P2P de ultra-baja latencia
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      playUiClick(700);
                      setActiveOverlay('none');
                    }}
                    className="p-1.5 text-neutral-400 hover:text-white hover:bg-white/10 rounded transition-colors cursor-pointer"
                    aria-label="Cerrar modal"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {errorMessage && (
                  <div className="p-3 rounded-lg bg-red-950/80 border border-red-500/60 text-red-200 text-xs flex items-center gap-2 shadow-[0_0_15px_rgba(239,68,68,0.3)]">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                    <span className="font-mono">{errorMessage}</span>
                  </div>
                )}

                {!roomState ? (
                  <div className="space-y-4">
                    {/* SEGMENTED MODE TABS (CREAR SALA vs UNIRSE CON CÓDIGO) */}
                    <div className="grid grid-cols-2 gap-2">
                      {/* Tab 1: CREAR SALA */}
                      <button
                        onClick={() => {
                          playUiClick(750);
                          setMpTab('create');
                        }}
                        className="relative cursor-pointer transition-all duration-200 group"
                        style={{
                          clipPath:
                            'polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px), 0 8px)',
                          filter: mpTab === 'create' ? 'drop-shadow(0 0 14px rgba(239, 68, 68, 0.55))' : 'none',
                        }}
                      >
                        <div
                          className={`p-[1.5px] transition-all group-hover:brightness-125 ${
                            mpTab === 'create'
                              ? 'bg-gradient-to-r from-red-600 via-rose-500 to-red-600'
                              : 'bg-neutral-700/60'
                          }`}
                          style={{
                            clipPath:
                              'polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px), 0 8px)',
                          }}
                        >
                          <div
                            className="py-2.5 px-3 flex items-center justify-center gap-2 transition-colors"
                            style={{
                              backgroundColor: mpTab === 'create' ? '#18060a' : '#101217',
                              clipPath:
                                'polygon(7px 0, calc(100% - 7px) 0, 100% 7px, 100% calc(100% - 7px), calc(100% - 7px) 100%, 7px 100%, 0 calc(100% - 7px), 0 7px)',
                            }}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                mpTab === 'create' ? 'bg-red-500 shadow-[0_0_6px_#ef4444]' : 'bg-neutral-600'
                              }`}
                            />
                            <span
                              className={`font-mono text-xs font-black uppercase tracking-[0.14em] ${
                                mpTab === 'create' ? 'text-white' : 'text-neutral-400 group-hover:text-neutral-200'
                              }`}
                            >
                              CREAR SALA
                            </span>
                          </div>
                        </div>
                      </button>

                      {/* Tab 2: UNIRSE CON CÓDIGO */}
                      <button
                        onClick={() => {
                          playUiClick(750);
                          setMpTab('join');
                        }}
                        className="relative cursor-pointer transition-all duration-200 group"
                        style={{
                          clipPath:
                            'polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px), 0 8px)',
                          filter: mpTab === 'join' ? 'drop-shadow(0 0 14px rgba(239, 68, 68, 0.55))' : 'none',
                        }}
                      >
                        <div
                          className={`p-[1.5px] transition-all group-hover:brightness-125 ${
                            mpTab === 'join'
                              ? 'bg-gradient-to-r from-red-600 via-rose-500 to-red-600'
                              : 'bg-neutral-700/60'
                          }`}
                          style={{
                            clipPath:
                              'polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px), 0 8px)',
                          }}
                        >
                          <div
                            className="py-2.5 px-3 flex items-center justify-center gap-2 transition-colors"
                            style={{
                              backgroundColor: mpTab === 'join' ? '#18060a' : '#101217',
                              clipPath:
                                'polygon(7px 0, calc(100% - 7px) 0, 100% 7px, 100% calc(100% - 7px), calc(100% - 7px) 100%, 7px 100%, 0 calc(100% - 7px), 0 7px)',
                            }}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                mpTab === 'join' ? 'bg-red-500 shadow-[0_0_6px_#ef4444]' : 'bg-neutral-600'
                              }`}
                            />
                            <span
                              className={`font-mono text-xs font-black uppercase tracking-[0.14em] ${
                                mpTab === 'join' ? 'text-white' : 'text-neutral-400 group-hover:text-neutral-200'
                              }`}
                            >
                              UNIRSE CON CÓDIGO
                            </span>
                          </div>
                        </div>
                      </button>
                    </div>

                    {/* PILOT ALIAS INPUT */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[10px] font-mono font-bold tracking-[0.16em] text-neutral-300 uppercase flex items-center gap-1.5">
                          <User className="w-3 h-3 text-red-500" />
                          <span>TU ALIAS DE PILOTO</span>
                        </label>
                        <span className="text-[9px] font-mono text-red-400/80 tracking-widest">[ TELEMETRÍA ID ]</span>
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          value={playerName}
                          onChange={(e) => setPlayerName(e.target.value)}
                          maxLength={16}
                          className="w-full px-3.5 py-2.5 rounded-lg bg-black/70 border border-white/15 text-white text-xs sm:text-sm font-black font-mono tracking-wider focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500/50 shadow-inner transition-all uppercase placeholder-neutral-500"
                          placeholder="NOMBRE DEL PILOTO"
                        />
                      </div>
                    </div>

                    {/* LAPS OR JOIN CODE */}
                    {mpTab === 'create' ? (
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-[10px] font-mono font-bold tracking-[0.16em] text-neutral-300 uppercase">
                            VUELTAS DEL DUELO
                          </label>
                          <span className="text-[9px] font-mono text-neutral-400 tracking-widest">[ FORMATO FIA ]</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { laps: 3, label: '3 VUELTAS', sub: 'SPRINT' },
                            { laps: 5, label: '5 VUELTAS', sub: 'GP' },
                            { laps: 10, label: '10 VUELTAS', sub: 'PRO' },
                          ].map((item) => {
                            const isSelected = mpLaps === item.laps;
                            return (
                              <button
                                key={item.laps}
                                onClick={() => {
                                  playUiClick(800);
                                  setMpLaps(item.laps);
                                }}
                                className="relative cursor-pointer transition-all duration-200 group"
                                style={{
                                  clipPath:
                                    'polygon(6px 0, calc(100% - 6px) 0, 100% 6px, 100% calc(100% - 6px), calc(100% - 6px) 100%, 6px 100%, 0 calc(100% - 6px), 0 6px)',
                                  filter: isSelected ? 'drop-shadow(0 0 10px rgba(239, 68, 68, 0.45))' : 'none',
                                }}
                              >
                                <div
                                  className={`p-[1.5px] transition-all group-hover:brightness-125 ${
                                    isSelected
                                      ? 'bg-gradient-to-r from-red-600 via-rose-500 to-red-600'
                                      : 'bg-neutral-800'
                                  }`}
                                  style={{
                                    clipPath:
                                      'polygon(6px 0, calc(100% - 6px) 0, 100% 6px, 100% calc(100% - 6px), calc(100% - 6px) 100%, 6px 100%, 0 calc(100% - 6px), 0 6px)',
                                  }}
                                >
                                  <div
                                    className="py-2 px-1 text-center transition-colors flex flex-col items-center justify-center"
                                    style={{
                                      backgroundColor: isSelected ? '#18060a' : '#101217',
                                      clipPath:
                                        'polygon(5px 0, calc(100% - 5px) 0, 100% 5px, 100% calc(100% - 5px), calc(100% - 5px) 100%, 5px 100%, 0 calc(100% - 5px), 0 5px)',
                                    }}
                                  >
                                    <span
                                      className={`font-mono text-xs font-black uppercase tracking-wider ${
                                        isSelected ? 'text-white' : 'text-neutral-400 group-hover:text-neutral-200'
                                      }`}
                                    >
                                      {item.label}
                                    </span>
                                    <span
                                      className={`text-[8px] font-mono tracking-widest ${
                                        isSelected ? 'text-red-400 font-bold' : 'text-neutral-500'
                                      }`}
                                    >
                                      {item.sub}
                                    </span>
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-[10px] font-mono font-bold tracking-[0.16em] text-neutral-300 uppercase">
                            CÓDIGO DE SALA (4 LETRAS)
                          </label>
                          <span className="text-[9px] font-mono text-cyan-400 tracking-widest">[ CÓDIGO DEL RIVAL ]</span>
                        </div>
                        <input
                          type="text"
                          value={joinCodeInput}
                          onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase().slice(0, 6))}
                          placeholder="EJ. ABCD"
                          className="w-full px-3.5 py-3 rounded-lg bg-black/70 border border-white/20 text-white text-base sm:text-lg font-black font-mono tracking-[0.3em] text-center focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500/50 shadow-inner uppercase transition-all"
                        />
                      </div>
                    )}

                    {/* MAIN CTA BUTTON (GT7 / F1 MOTORSPORT ANGLED BAR) */}
                    <button
                      onClick={mpTab === 'create' ? handleCreateRoomAction : handleJoinRoomAction}
                      disabled={isConnecting || (mpTab === 'join' && !joinCodeInput.trim())}
                      className="relative w-full cursor-pointer transition-all duration-200 group disabled:opacity-40 disabled:cursor-not-allowed pt-2"
                      style={{
                        clipPath: 'polygon(14px 0, 100% 0, calc(100% - 14px) 100%, 0 100%)',
                        filter: 'drop-shadow(0 0 18px rgba(239, 68, 68, 0.55))',
                      }}
                    >
                      <div
                        className="p-[1.5px] bg-gradient-to-r from-red-600 via-rose-500 to-red-600 group-hover:brightness-115 transition-all"
                        style={{ clipPath: 'polygon(14px 0, 100% 0, calc(100% - 14px) 100%, 0 100%)' }}
                      >
                        <div
                          className="py-3 sm:py-3.5 px-6 flex items-center justify-center gap-3 transition-colors bg-gradient-to-r from-red-600 via-rose-600 to-red-600 group-hover:from-red-500 group-hover:to-rose-500"
                          style={{
                            clipPath: 'polygon(13px 0, 100% 0, calc(100% - 13px) 100%, 0 100%)',
                            backgroundImage:
                              'repeating-linear-gradient(45deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 2px, transparent 2px, transparent 8px)',
                          }}
                        >
                          <div className="flex items-center gap-1 -skew-x-12 shrink-0">
                            <span className="w-1.5 h-4 bg-white/90 rounded-xs shadow-[0_0_6px_rgba(255,255,255,0.5)]" />
                            <span className="w-1.5 h-4 bg-white/90 rounded-xs shadow-[0_0_6px_rgba(255,255,255,0.5)]" />
                            <span className="w-1.5 h-4 bg-white/90 rounded-xs shadow-[0_0_6px_rgba(255,255,255,0.5)]" />
                          </div>
                          <span className="font-mono text-xs sm:text-sm font-black uppercase tracking-[0.18em] text-white italic drop-shadow-sm">
                            {isConnecting
                              ? 'CONECTANDO CON SERVIDOR...'
                              : mpTab === 'create'
                              ? 'CREAR SALA Y ESPERAR RIVAL'
                              : 'UNIRSE A LA SALA'}
                          </span>
                        </div>
                      </div>
                    </button>
                  </div>
                ) : (
                  /* ROOM ACTIVE STATE (IN LOBBY WAITING FOR OPPONENT) */
                  <div className="space-y-4 font-mono text-xs">
                    {/* Active Room Code Card */}
                    <div
                      className="p-4 rounded-xl relative overflow-hidden"
                      style={{
                        backgroundColor: '#10141e',
                        border: '1px solid rgba(239, 68, 68, 0.4)',
                        backgroundImage:
                          'radial-gradient(ellipse at center, rgba(239,68,68,0.12) 0%, transparent 70%), repeating-linear-gradient(45deg, rgba(255,255,255,0.015) 0px, rgba(255,255,255,0.015) 1px, transparent 1px, transparent 6px)',
                      }}
                    >
                      <span className="text-[10px] text-neutral-400 uppercase tracking-widest block text-center">
                        CÓDIGO DE INVITACIÓN
                      </span>
                      <div className="text-3xl font-black text-white tracking-[0.28em] text-center mt-1 drop-shadow-[0_0_12px_rgba(239,68,68,0.6)]">
                        {roomState.code}
                      </div>
                      <div className="flex justify-center mt-2.5">
                        <button
                          onClick={() => {
                            playUiClick(850);
                            copyRoomCode();
                          }}
                          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-white/10 hover:bg-white/20 border border-white/15 text-neutral-200 hover:text-white text-[10px] font-bold cursor-pointer transition-all active:scale-95"
                        >
                          <Copy className="w-3.5 h-3.5 text-red-400" />
                          <span>{isCopied ? '¡COPIADO EN PORTAPAPELES!' : 'COPIAR CÓDIGO'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Slot P1 & P2 Telemetry Cards */}
                    <div className="grid grid-cols-2 gap-3">
                      {/* P1 */}
                      <div className="p-3 rounded-lg bg-[#0d1017] border border-white/10 relative overflow-hidden">
                        <span className="absolute top-0 left-0 w-1 h-full bg-red-500 shadow-[0_0_8px_#ef4444]" />
                        <span className="text-[9px] text-neutral-400 block tracking-wider pl-1.5">PILOTO 1 (ANFITRIÓN)</span>
                        <span className="font-bold text-white text-sm truncate block mt-0.5 pl-1.5">
                          {roomState.players.p1?.name || 'Esperando...'}
                        </span>
                        <span
                          className={`text-[10px] font-bold block mt-1 pl-1.5 ${
                            roomState.players.p1?.isReady ? 'text-emerald-400' : 'text-neutral-500'
                          }`}
                        >
                          {roomState.players.p1?.isReady ? '✓ LISTO PARA CORRER' : '• PREPARANDO...'}
                        </span>
                      </div>

                      {/* P2 */}
                      <div className="p-3 rounded-lg bg-[#0d1017] border border-white/10 relative overflow-hidden">
                        <span
                          className={`absolute top-0 left-0 w-1 h-full ${
                            roomState.players.p2 ? 'bg-cyan-500 shadow-[0_0_8px_#06b6d4]' : 'bg-neutral-700'
                          }`}
                        />
                        <span className="text-[9px] text-neutral-400 block tracking-wider pl-1.5">PILOTO 2 (RIVAL)</span>
                        <span className="font-bold text-white text-sm truncate block mt-0.5 pl-1.5">
                          {roomState.players.p2?.name || 'Esperando rival...'}
                        </span>
                        <span
                          className={`text-[10px] font-bold block mt-1 pl-1.5 ${
                            roomState.players.p2?.isReady
                              ? 'text-emerald-400'
                              : roomState.players.p2
                              ? 'text-neutral-500'
                              : 'text-amber-400/80'
                          }`}
                        >
                          {roomState.players.p2?.isReady
                            ? '✓ LISTO PARA CORRER'
                            : roomState.players.p2
                            ? '• PREPARANDO...'
                            : '• ESPERANDO CONEXIÓN...'}
                        </span>
                      </div>
                    </div>

                    {/* Lobby Actions */}
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => {
                          playUiClick(800);
                          handleToggleReady();
                        }}
                        className={`flex-1 py-3 rounded-lg font-black tracking-wider uppercase cursor-pointer transition-all ${
                          isReady
                            ? 'bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.5)]'
                            : 'bg-white/10 hover:bg-white/20 text-white border border-white/15'
                        }`}
                      >
                        {isReady ? '✓ ESTOY LISTO' : 'MARCAR LISTO'}
                      </button>

                      <button
                        onClick={() => {
                          playUiClick(650);
                          onLeaveRoom();
                        }}
                        className="px-5 py-3 rounded-lg bg-red-950/60 hover:bg-red-900/80 border border-red-500/50 text-red-300 font-bold uppercase cursor-pointer transition-colors"
                      >
                        SALIR
                      </button>
                    </div>

                    {/* Host Start Duel Button */}
                    {playerId === 'p1' && (
                      <button
                        onClick={() => {
                          playUiClick(950);
                          onStartMultiplayerRace();
                        }}
                        disabled={!roomState.players.p1?.isReady || !roomState.players.p2?.isReady}
                        className="relative w-full cursor-pointer transition-all duration-200 group disabled:opacity-35 disabled:cursor-not-allowed pt-1"
                        style={{
                          clipPath: 'polygon(14px 0, 100% 0, calc(100% - 14px) 100%, 0 100%)',
                          filter: 'drop-shadow(0 0 18px rgba(239, 68, 68, 0.65))',
                        }}
                      >
                        <div
                          className="p-[1.5px] bg-gradient-to-r from-red-600 via-rose-500 to-red-600 group-hover:brightness-115 transition-all"
                          style={{ clipPath: 'polygon(14px 0, 100% 0, calc(100% - 14px) 100%, 0 100%)' }}
                        >
                          <div
                            className="py-3 sm:py-3.5 px-6 flex items-center justify-center gap-3 transition-colors bg-gradient-to-r from-red-600 via-rose-600 to-red-600 group-hover:from-red-500 group-hover:to-rose-500"
                            style={{
                              clipPath: 'polygon(13px 0, 100% 0, calc(100% - 13px) 100%, 0 100%)',
                              backgroundImage:
                                'repeating-linear-gradient(45deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 2px, transparent 2px, transparent 8px)',
                            }}
                          >
                            <div className="flex items-center gap-1 -skew-x-12 shrink-0">
                              <span className="w-1.5 h-4 bg-white/90 rounded-xs shadow-[0_0_6px_rgba(255,255,255,0.5)]" />
                              <span className="w-1.5 h-4 bg-white/90 rounded-xs shadow-[0_0_6px_rgba(255,255,255,0.5)]" />
                              <span className="w-1.5 h-4 bg-white/90 rounded-xs shadow-[0_0_6px_rgba(255,255,255,0.5)]" />
                            </div>
                            <span className="font-mono text-xs sm:text-sm font-black uppercase tracking-[0.18em] text-white italic drop-shadow-sm">
                              INICIAR DUELO (AMBOS LISTOS)
                            </span>
                          </div>
                        </div>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* OVERLAY 8: CONTROLS GUIDE MODAL */}
      {showControlsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-3xl bg-neutral-900 border border-white/20 p-6 shadow-2xl relative">
            <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <HelpCircle className="w-5 h-5 text-red-400" />
                <h3 className="text-base font-black uppercase tracking-wider text-white font-mono">GUÍA DE CONTROLES</h3>
              </div>
              <button
                onClick={() => {
                  playUiClick(700);
                  setShowControlsModal(false);
                }}
                className="p-1 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                <span className="font-bold text-white">Acelerar / Freno</span>
                <span className="font-mono text-amber-400 bg-white/10 px-2 py-0.5 rounded">W / S o Flechas ↑ / ↓</span>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                <span className="font-bold text-white">Girar Dirección</span>
                <span className="font-mono text-amber-400 bg-white/10 px-2 py-0.5 rounded">A / D o Flechas ← / →</span>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                <span className="font-bold text-white">Freno de Mano / Derrape</span>
                <span className="font-mono text-amber-400 bg-white/10 px-2 py-0.5 rounded">Espacio (Space)</span>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                <span className="font-bold text-white">Cambiar Cámara</span>
                <span className="font-mono text-cyan-400 bg-white/10 px-2 py-0.5 rounded">Tecla C</span>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                <span className="font-bold text-white">Pausa / Menú de Carrera</span>
                <span className="font-mono text-red-400 bg-white/10 px-2 py-0.5 rounded">Escape (ESC)</span>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                <span className="font-bold text-white">Pantalla Completa</span>
                <span className="font-mono text-white bg-white/10 px-2 py-0.5 rounded">Tecla F</span>
              </div>
            </div>

            <button
              onClick={() => {
                playUiClick(700);
                setShowControlsModal(false);
              }}
              className="w-full mt-5 py-3 rounded-xl bg-white/15 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer font-mono"
            >
              ENTENDIDO
            </button>
          </div>
        </div>
      )}

      {/* In-Game Soundtrack Jukebox Modal */}
      <SoundtrackModal
        isOpen={isSoundtrackOpen}
        onClose={() => setIsSoundtrackOpen(false)}
      />
    </div>
  );
};
