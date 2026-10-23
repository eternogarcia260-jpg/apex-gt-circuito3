/**
 * PilotPresentationOverlay.tsx
 * Ultra-Clean Cinematic Presentation for Apex GT Career Mode.
 * 
 * Philosophy:
 * - 100% Clean cinematic viewport: No bulky cards, no telemetry widgets, no intrusive buttons.
 * - Ultra-subtle, non-intrusive floating camera switcher (minimal translucent pill in top-right).
 * - Simple, pure typography subtitles synchronized with narrator audio without flashy animations.
 * - Non-intrusive keyboard navigation:
 *   - ESC / Enter: Skip directly to starting grid
 *   - Space: Pause / Resume voice narration & pilot stride
 *   - 1 / 2 / 3 / 4 or C: Seamless camera angle change
 *   - F: Toggle fullscreen
 * - Silky smooth fade-in when entering and fade-out when finishing into the starting grid.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera } from 'lucide-react';
import { PilotCameraPreset } from '../game/pilot/PilotWalkManager';
import { CustomLiverySettings } from '../game/career/CareerTypes';

export interface SubtitlePhrase {
  id: number;
  startSec: number;
  endSec: number;
  speaker: string;
  role: string;
  text: string;
  emphasis?: string;
}

export const PILOT_PRESENTATION_SUBTITLES: SubtitlePhrase[] = [
  {
    id: 1,
    startSec: 0.55,
    endSec: 4.45,
    speaker: 'NARRADOR OFICIAL',
    role: 'CAMPEONATO MUNDIAL FIA',
    text: 'Huele a goma quemada, asfalto caliente y gasolina...',
  },
  {
    id: 2,
    startSec: 4.65,
    endSec: 9.15,
    speaker: 'NARRADOR OFICIAL',
    role: 'CAMPEONATO MUNDIAL FIA',
    text: 'No hay nada en el mundo que se compare a esta calma antes de que rujan los motores.',
  },
  {
    id: 3,
    startSec: 9.35,
    endSec: 11.95,
    speaker: 'NARRADOR OFICIAL',
    role: 'CAMPEONATO MUNDIAL FIA',
    text: 'Hola. Bienvenido al asfalto, piloto.',
  },
  {
    id: 4,
    startSec: 12.15,
    endSec: 14.75,
    speaker: 'NARRADOR OFICIAL',
    role: 'CAMPEONATO MUNDIAL FIA',
    text: 'Si estás aquí, no es para pasear los domingos.',
  },
  {
    id: 5,
    startSec: 14.95,
    endSec: 17.65,
    speaker: 'NARRADOR OFICIAL',
    role: 'CAMPEONATO MUNDIAL FIA',
    text: 'Esto es el Campeonato Mundial FIA: la cima absoluta del automovilismo.',
  },
  {
    id: 6,
    startSec: 17.85,
    endSec: 20.25,
    speaker: 'NARRADOR OFICIAL',
    role: 'CAMPEONATO MUNDIAL FIA',
    text: 'A más de trescientos cincuenta kilómetros por hora, el margen de error NO existe.',
  },
  {
    id: 7,
    startSec: 20.35,
    endSec: 24.85,
    speaker: 'NARRADOR OFICIAL',
    role: 'CAMPEONATO MUNDIAL FIA',
    text: 'Un metro tarde en la frenada... y estás contra el muro.',
  },
  {
    id: 8,
    startSec: 25.05,
    endSec: 28.15,
    speaker: 'NARRADOR OFICIAL',
    role: 'CAMPEONATO MUNDIAL FIA',
    text: 'Un metro perfecto... ¡y eres LEYENDA!',
  },
  {
    id: 9,
    startSec: 28.25,
    endSec: 31.25,
    speaker: 'NARRADOR OFICIAL',
    role: 'CAMPEONATO MUNDIAL FIA',
    text: 'Tu monoplaza ya te espera en el garaje.',
  },
  {
    id: 10,
    startSec: 31.35,
    endSec: 38.15,
    speaker: 'NARRADOR OFICIAL',
    role: 'CAMPEONATO MUNDIAL FIA',
    text: 'Antes de poner un neumático en la parrilla, tendrás que definir tu propia identidad: los colores de tu escudería, tus patrocinadores y tu dorsal.',
  },
  {
    id: 11,
    startSec: 38.25,
    endSec: 46.15,
    speaker: 'NARRADOR OFICIAL',
    role: 'CAMPEONATO MUNDIAL FIA',
    text: 'Cada detalle cuenta, porque allá afuera no solo representas tu nombre, representas a todo un equipo de mecánicos e ingenieros que van a dejarse la piel en cada parada en boxes.',
  },
  {
    id: 12,
    startSec: 46.25,
    endSec: 52.15,
    speaker: 'NARRADOR OFICIAL',
    role: 'CAMPEONATO MUNDIAL FIA',
    text: 'Tenemos cinco Grandes Premios por delante en circuitos implacables.',
  },
  {
    id: 13,
    startSec: 52.35,
    endSec: 56.15,
    speaker: 'NARRADOR OFICIAL',
    role: 'CAMPEONATO MUNDIAL FIA',
    text: 'Vas a tener que gestionar el desgaste de los compuestos Blandos, Medios y Duros,',
  },
  {
    id: 14,
    startSec: 56.35,
    endSec: 60.55,
    speaker: 'NARRADOR OFICIAL',
    role: 'CAMPEONATO MUNDIAL FIA',
    text: 'exprimir el DRS en las rectas y defender cada vértice rueda a rueda con los mejores pilotos de la parrilla.',
  },
  {
    id: 15,
    startSec: 60.75,
    endSec: 67.35,
    speaker: 'NARRADOR OFICIAL',
    role: 'CAMPEONATO MUNDIAL FIA',
    text: 'El objetivo es claro: sumar cada punto, cumplir los contratos de la FIA y subir a lo más alto del podio de constructores.',
  },
  {
    id: 16,
    startSec: 67.55,
    endSec: 75.35,
    speaker: 'NARRADOR OFICIAL',
    role: 'CAMPEONATO MUNDIAL FIA',
    text: 'Ha llegado tu momento. Ajusta tu asiento, calienta los neumáticos y prepárate para apagar las cinco luces rojas.',
  },
  {
    id: 17,
    startSec: 75.55,
    endSec: 77.15,
    speaker: 'NARRADOR OFICIAL',
    role: 'CAMPEONATO MUNDIAL FIA',
    text: 'Nos vemos en la curva uno.',
  },
  {
    id: 18,
    startSec: 77.25,
    endSec: 85.08,
    speaker: 'NARRADOR OFICIAL',
    role: 'CAMPEONATO MUNDIAL FIA',
    text: '¡A RODAR!',
  },
];

const CAMERA_PRESETS: { id: PilotCameraPreset; label: string; key: string }[] = [
  { id: 'dynamic_front', label: 'Frontal', key: '1' },
  { id: 'low_asphalt', label: 'Contrapicado', key: '2' },
  { id: 'profile_medium', label: 'Lateral', key: '3' },
  { id: 'orbit_360', label: '360°', key: '4' },
];

export interface PilotPresentationOverlayProps {
  onFinish: () => void;
  onSetCameraPreset: (preset: PilotCameraPreset) => void;
  onSetPaused: (paused: boolean) => void;
  onAudioTimeUpdate?: (timeSec: number) => void;
  onLoadCustomModel?: (file: File) => Promise<boolean>;
  driverLivery?: CustomLiverySettings;
  circuitName?: string;
  roundNumber?: number;
  totalRounds?: number;
}

export const PilotPresentationOverlay: React.FC<PilotPresentationOverlayProps> = ({
  onFinish,
  onSetCameraPreset,
  onSetPaused,
  onAudioTimeUpdate,
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [activeCamera, setActiveCamera] = useState<PilotCameraPreset>('dynamic_front');
  const [activeSubtitle, setActiveSubtitle] = useState<SubtitlePhrase | null>(null);
  const [isFadeIn, setIsFadeIn] = useState<boolean>(false);
  const [isExiting, setIsExiting] = useState<boolean>(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeSubtitleIdRef = useRef<number>(-1);
  const isExitingRef = useRef<boolean>(false);
  const onAudioTimeUpdateRef = useRef(onAudioTimeUpdate);
  onAudioTimeUpdateRef.current = onAudioTimeUpdate;
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  // Ultra-smooth exit handler with audio volume ramp-down
  const handleFinishCleanly = useCallback(() => {
    if (isExitingRef.current) return;
    isExitingRef.current = true;
    setIsExiting(true);

    const aud = audioRef.current;
    if (aud) {
      const initialVol = aud.volume;
      const startFade = performance.now();
      const fadeDuration = 600; // ms

      const fadeTimer = setInterval(() => {
        const elapsed = performance.now() - startFade;
        const progress = Math.min(1, elapsed / fadeDuration);
        try {
          aud.volume = Math.max(0, initialVol * (1 - progress));
        } catch {
          // Ignore
        }
        if (progress >= 1) {
          clearInterval(fadeTimer);
          try {
            aud.pause();
          } catch {
            // Ignore
          }
        }
      }, 40);
    }

    setTimeout(() => {
      onFinishRef.current();
    }, 650);
  }, []);

  // Soft fade-in on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsFadeIn(true);
    }, 60);
    return () => clearTimeout(timer);
  }, []);

  // Initialize and play narrator voice audio with high-precision frame tracking
  useEffect(() => {
    const audio = new Audio('/audio/narrator_career_intro.mp3');
    audioRef.current = audio;
    audio.preload = 'auto';
    audio.volume = 0.95;

    let rafId: number | null = null;

    const checkAudioSync = () => {
      const cur = audio.currentTime;

      // 1. Send timestamp directly to PilotWalkManager for sample-accurate stride sync
      if (onAudioTimeUpdateRef.current) {
        onAudioTimeUpdateRef.current(cur);
      }

      // 2. Synchronize subtitle text at exact calibrated timestamps
      const foundSub = PILOT_PRESENTATION_SUBTITLES.find(
        (sub) => cur >= sub.startSec && cur < sub.endSec
      );

      if (foundSub) {
        if (foundSub.id !== activeSubtitleIdRef.current) {
          activeSubtitleIdRef.current = foundSub.id;
          setActiveSubtitle(foundSub);
        }
      } else {
        if (activeSubtitleIdRef.current !== -1) {
          activeSubtitleIdRef.current = -1;
          setActiveSubtitle(null);
        }
      }
    };

    const runRafLoop = () => {
      checkAudioSync();
      rafId = requestAnimationFrame(runRafLoop);
    };

    const handleEnded = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      setIsPlaying(false);
      onSetPaused(false);
      handleFinishCleanly();
    };

    audio.addEventListener('timeupdate', checkAudioSync);
    audio.addEventListener('ended', handleEnded);

    audio.play().then(() => {
      rafId = requestAnimationFrame(runRafLoop);
    }).catch(() => {
      setIsPlaying(false);
    });

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      audio.removeEventListener('timeupdate', checkAudioSync);
      audio.removeEventListener('ended', handleEnded);
      audio.pause();
      audio.src = '';
    };
  }, [handleFinishCleanly, onSetPaused]);

  // Pause / Resume audio & 3D pilot walking
  const handleTogglePlay = useCallback(() => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      onSetPaused(true);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
        onSetPaused(false);
      }).catch(() => {});
    }
  }, [isPlaying, onSetPaused]);

  // Camera selection handler
  const handleSelectCamera = useCallback((preset: PilotCameraPreset) => {
    setActiveCamera(preset);
    onSetCameraPreset(preset);
  }, [onSetCameraPreset]);

  // Keyboard navigation: Space (pause/play), ESC/Enter (finish), 1-4/C (camera), F (fullscreen)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.code === 'Escape' || e.code === 'Enter') {
        e.preventDefault();
        handleFinishCleanly();
      } else if (e.code === 'Digit1') {
        e.preventDefault();
        handleSelectCamera('dynamic_front');
      } else if (e.code === 'Digit2') {
        e.preventDefault();
        handleSelectCamera('low_asphalt');
      } else if (e.code === 'Digit3') {
        e.preventDefault();
        handleSelectCamera('profile_medium');
      } else if (e.code === 'Digit4') {
        e.preventDefault();
        handleSelectCamera('orbit_360');
      } else if (e.code === 'KeyC') {
        e.preventDefault();
        setActiveCamera((prev) => {
          const index = CAMERA_PRESETS.findIndex((p) => p.id === prev);
          const nextPreset = CAMERA_PRESETS[(index + 1) % CAMERA_PRESETS.length].id;
          onSetCameraPreset(nextPreset);
          return nextPreset;
        });
      } else if (e.code === 'KeyF') {
        e.preventDefault();
        try {
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
          } else {
            document.exitFullscreen().catch(() => {});
          }
        } catch {
          // Ignored
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleFinishCleanly, handleSelectCamera, handleTogglePlay, onSetCameraPreset]);

  return (
    <>
      {/* Seamless Black Transition Curtain: starts black to bridge from intro video, then reveals pilot presentation */}
      <div
        className={`fixed inset-0 z-30 pointer-events-none bg-black transition-opacity duration-700 ease-in-out ${
          isFadeIn && !isExiting ? 'opacity-0' : 'opacity-100'
        }`}
        style={{ backgroundColor: '#000000' }}
      />

      <div
        className={`absolute inset-0 z-40 pointer-events-none flex flex-col justify-between overflow-hidden select-none font-sans transition-opacity duration-700 ease-in-out ${
          isFadeIn && !isExiting ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Top Bar: Only the Ultra-Subtle & Non-Intrusive Camera Selector */}
        <header className="w-full pt-4 sm:pt-6 px-6 sm:px-8 flex items-center justify-end">
          <nav
            aria-label="Selector de Cámara"
            className="pointer-events-auto flex items-center gap-1 p-1 rounded-full bg-black/35 hover:bg-black/60 backdrop-blur-md border border-white/10 hover:border-white/20 transition-all duration-300 opacity-60 hover:opacity-100 shadow-md"
          >
            <Camera className="w-3.5 h-3.5 text-neutral-400 ml-1.5 mr-0.5" />
            {CAMERA_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSelectCamera(preset.id)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-mono tracking-wider transition-all cursor-pointer ${
                  activeCamera === preset.id
                    ? 'bg-white/25 text-white font-bold border border-white/30 shadow-xs'
                    : 'text-neutral-400 hover:text-white hover:bg-white/10'
                }`}
                title={`Cámara ${preset.label} (Tecla ${preset.key})`}
              >
                {preset.label}
              </button>
            ))}
          </nav>
        </header>

        {/* Center Cinematic Viewport: Completely Clean & Unobstructed */}
        <div className="flex-1" />

        {/* Bottom Area: Compact Non-Intrusive Subtitles & Faint Shortcut Indicator */}
        <footer className="w-full pb-5 sm:pb-7 px-4 flex flex-col items-center justify-end relative pointer-events-none">
          {/* Compact, Pure Subtitle Typography with Subtle Translucent Backdrop */}
          {activeSubtitle && (
            <div className="max-w-2xl text-center px-2 transition-all duration-300">
              <div className="inline-block px-4 py-1.5 rounded-xl bg-black/45 backdrop-blur-sm border border-white/10 shadow-lg">
                <p
                  key={activeSubtitle.id}
                  className="text-xs sm:text-sm font-normal text-white/90 leading-relaxed font-sans tracking-wide"
                  style={{
                    textShadow: '0 1px 4px rgba(0, 0, 0, 0.85)',
                  }}
                >
                  {activeSubtitle.text}
                </p>
              </div>
            </div>
          )}

          {/* Faint, Discreet ESC Shortcut Hint at Bottom-Left */}
          <div className="absolute bottom-3 left-5 text-[9px] font-mono text-neutral-500/40 uppercase tracking-widest">
            ESC · Parrilla de salida
          </div>
        </footer>
      </div>
    </>
  );
};
