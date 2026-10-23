/**
 * TitleScreen.tsx
 * Modern, High-Octane Esport Title Screen for Apex GT.
 * Features:
 * - Bespoke aerodynamic racing typography with aggressive esport italic skew
 * - Dual-tone titanium & crimson competition badge lockup
 * - Chamfered F1 telemetry polygon start button with speed vents and angle cuts
 * - Pure structural speed design (zero distracting animated loops)
 * - User's exact background image with 50% opacity & dark vignette
 * - Subtle, elegant fullscreen button with keyboard shortcut ('F') and status indicator
 */

import React, { useState, useEffect } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { playEngineIgnitionRoar, playUiHover, playUiClick } from '../utils/uiAudio';
import titleBgImg from '../assets/images/f1_title_screen_custom.png';
import { preloadUiAssets, onUiPreloadProgress, getUiPreloadProgress } from '../utils/uiAssetPreloader';

interface TitleScreenProps {
  onEnter: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({ onEnter }) => {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [preloadProgress, setPreloadProgress] = useState<number>(() => getUiPreloadProgress());
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => {
    return typeof document !== 'undefined' ? !!document.fullscreenElement : false;
  });

  // Start background preloading of all menu images immediately on mount
  useEffect(() => {
    preloadUiAssets();
    const unsubscribe = onUiPreloadProgress((percent) => {
      setPreloadProgress(percent);
    });
    return unsubscribe;
  }, []);

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
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

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
    } catch {
      // Ignored if restricted in iframe
    }
  };

  const handleStart = async () => {
    if (isTransitioning) return;
    playUiClick(880);
    playEngineIgnitionRoar();
    setIsTransitioning(true);

    // Ensure both min transition animation delay (for audio) and all UI images are 100% preloaded & decoded
    const minDelay = new Promise((resolve) => setTimeout(resolve, 450));
    await Promise.all([minDelay, preloadUiAssets()]);
    onEnter();
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col justify-center items-center select-none overflow-hidden transition-all duration-500 bg-[#05070B] ${
        isTransitioning ? 'scale-[1.02]' : 'opacity-100 scale-100'
      }`}
    >
      {/* Transitional High-Octane Paddock Loading Bar */}
      {isTransitioning && (
        <div className="absolute inset-0 z-50 bg-[#05070B]/85 backdrop-blur-md flex flex-col items-center justify-center transition-all duration-300 px-6">
          <div className="w-full max-w-xs sm:max-w-sm flex flex-col items-center gap-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-600 shadow-[0_0_12px_rgba(239,68,68,1)] animate-pulse" />
              <span className="text-xs sm:text-sm font-black tracking-[0.25em] uppercase text-white font-mono">
                SINCRONIZANDO PADDOCK...
              </span>
            </div>

            {/* F1 Red & Titanium Speed Track */}
            <div className="w-full h-2 bg-neutral-900 rounded-full overflow-hidden p-0.5 border border-white/20 shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-red-600 via-rose-500 to-amber-400 rounded-full transition-all duration-200 shadow-[0_0_10px_rgba(239,68,68,0.8)]"
                style={{ width: `${Math.max(25, preloadProgress)}%` }}
              />
            </div>

            <div className="flex items-center justify-between w-full text-[10px] font-mono tracking-wider text-neutral-400">
              <span className="flex items-center gap-1.5">
                <span className="text-red-500">FIA</span> ACTIVOS Y TELEMETRÍA
              </span>
              <span className="text-white font-bold">{preloadProgress}%</span>
            </div>
          </div>
        </div>
      )}
      {/* Semi-Transparent Background Image (60% Opacity) with Dark Atmospheric Vignette */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden select-none">
        <img
          src={titleBgImg}
          alt="Apex GT Background"
          className="w-full h-full object-cover opacity-60 scale-105"
          referrerPolicy="no-referrer"
        />
        {/* Soft Radial Vignette */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at center, rgba(5, 7, 11, 0.15) 0%, rgba(5, 7, 11, 0.6) 60%, rgba(5, 7, 11, 0.95) 100%)',
          }}
        />
      </div>

      {/* Subtle Fullscreen Toggle in Top-Right Corner */}
      <button
        type="button"
        onClick={toggleFullscreen}
        onMouseEnter={playUiHover}
        className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20 flex items-center gap-2 px-2.5 py-2 sm:px-3 sm:py-2 rounded-lg bg-black/40 hover:bg-neutral-900/80 backdrop-blur-md border border-white/10 hover:border-white/30 text-neutral-400 hover:text-white transition-all duration-200 cursor-pointer shadow-lg group focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-400"
        title={isFullscreen ? 'Salir de Pantalla Completa (F / ESC)' : 'Pantalla Completa (F / F11)'}
        aria-label="Pantalla Completa"
      >
        {isFullscreen ? (
          <Minimize2 className="w-4 h-4 text-neutral-300 group-hover:text-amber-400 transition-colors" />
        ) : (
          <Maximize2 className="w-4 h-4 text-neutral-300 group-hover:text-amber-400 transition-colors" />
        )}
        <span className="hidden sm:inline text-[10px] font-mono tracking-widest uppercase opacity-75 group-hover:opacity-100 transition-opacity">
          {isFullscreen ? 'Ventana' : 'Pantalla Completa'}
        </span>
        <kbd className="hidden md:inline text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-neutral-400 font-mono border border-white/10">
          F
        </kbd>
      </button>

      {/* Main Focus: Aerodynamic Logo Lockup & F1 Chamfered Start Button */}
      <main className="relative z-10 flex flex-col items-center justify-center text-center px-4 w-full max-w-4xl mx-auto">
        {/* --- MODERN MOTORSPORT TITLE LOCKUP --- */}
        <div className="flex flex-col items-center select-none">
          {/* Main Title: APEX + GT with Aerodynamic Esport Skew */}
          <div className="relative inline-flex items-center justify-center gap-2 sm:gap-4 -skew-x-12 transform py-2">
            {/* Speed Cut Underline / Shadow Accent */}
            <div className="absolute -bottom-1 left-2 right-2 h-[3px] bg-gradient-to-r from-transparent via-red-600 to-transparent opacity-80" />

            {/* "APEX" Wordmark with razor stencil gradient */}
            <h1
              className="text-6xl sm:text-8xl md:text-9xl font-black italic tracking-tighter uppercase font-mono bg-gradient-to-b from-white via-neutral-100 to-neutral-400 bg-clip-text text-transparent drop-shadow-[0_12px_30px_rgba(0,0,0,0.95)]"
              style={{
                fontFamily: "'Chakra Petch', 'Plus Jakarta Sans', sans-serif",
                letterSpacing: '-0.04em',
              }}
            >
              APEX
            </h1>

            {/* "GT" Competition Slanted Badge */}
            <div
              className="relative px-3 sm:px-6 py-1 sm:py-2 bg-gradient-to-br from-red-600 via-red-700 to-neutral-900 border-t-2 border-l border-red-400 shadow-[0_10px_25px_rgba(220,38,38,0.4)] flex items-center justify-center"
              style={{
                clipPath: 'polygon(12px 0, 100% 0, calc(100% - 12px) 100%, 0 100%)',
              }}
            >
              {/* Internal Aerodynamic Winglet Stripe */}
              <div className="absolute top-0 right-2 w-1.5 h-full bg-white/20 -skew-x-6" />

              <span
                className="text-4xl sm:text-7xl md:text-8xl font-black italic tracking-tighter text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]"
                style={{
                  fontFamily: "'Chakra Petch', sans-serif",
                }}
              >
                GT
              </span>
            </div>
          </div>

          {/* Sub-Technical Spec Line */}
          <div className="mt-2 sm:mt-3 flex items-center justify-center gap-2.5 text-[10px] sm:text-xs font-mono tracking-[0.25em] text-neutral-400/90 -skew-x-12 uppercase">
            <span className="text-neutral-300">CHAMPIONSHIP SPEC</span>
            <span className="text-neutral-600 font-bold">/</span>
            <span className="font-black tracking-[0.28em] bg-gradient-to-b from-sky-200 via-blue-600 to-indigo-950 bg-clip-text text-transparent drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] filter drop-shadow-[0_0_8px_rgba(37,99,235,0.75)]">
              V8 F1 HYBRID
            </span>
          </div>
        </div>

        {/* --- F1 TELEMETRY CHAMFERED START BUTTON --- */}
        <div className="mt-10 sm:mt-14 flex flex-col items-center justify-center">
          <button
            onClick={handleStart}
            onMouseEnter={playUiHover}
            className="group relative w-72 sm:w-84 h-14 sm:h-16 active:scale-95 transition-transform duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
            style={{
              clipPath: 'polygon(18px 0%, 100% 0%, calc(100% - 18px) 100%, 0% 100%)',
            }}
          >
            {/* Outer Beveled Chassis (Transparent Glassmorphic Red/Titanium Border Frame) */}
            <div className="absolute inset-0 bg-gradient-to-r from-red-500/50 via-white/30 to-red-600/50 p-[2px]">
              {/* Inner Core Surface (High-Transparency Glass with Red Hue & Backdrop Blur) */}
              <div className="w-full h-full backdrop-blur-md bg-gradient-to-r from-black/40 via-red-900/30 to-black/40 group-hover:from-red-950/50 group-hover:via-red-800/45 group-hover:to-red-950/50 transition-all duration-200 flex items-center justify-center gap-4 px-6 sm:px-8 border border-white/10 group-hover:border-red-400/40">
                {/* Left Telemetry Tachometer Speed Vents */}
                <div className="flex items-center gap-1 -skew-x-12 opacity-60 group-hover:opacity-100 transition-opacity">
                  <div className="w-1 h-3.5 bg-white/40" />
                  <div className="w-1 h-4 bg-white/60" />
                  <div className="w-1.5 h-5 bg-white" />
                </div>

                {/* Center Content: Play Chevron & Typographic Label */}
                <div className="flex items-center gap-3 -skew-x-12">
                  <svg
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="w-4 h-4 sm:w-5 sm:h-5 text-white drop-shadow group-hover:scale-110 transition-transform duration-150"
                  >
                    <path d="M5 3l16 9-16 9V3z" />
                  </svg>
                  <span
                    className="text-white font-mono font-black italic text-base sm:text-lg tracking-[0.3em] uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                    style={{ fontFamily: "'Chakra Petch', sans-serif" }}
                  >
                    COMENZAR
                  </span>
                </div>

                {/* Right Aerodynamic Vents (Balanced symmetry replacing [S1]) */}
                <div className="flex items-center gap-1 -skew-x-12 opacity-60 group-hover:opacity-100 transition-opacity">
                  <div className="w-1.5 h-5 bg-white" />
                  <div className="w-1 h-4 bg-white/60" />
                  <div className="w-1 h-3.5 bg-white/40" />
                </div>
              </div>
            </div>
          </button>
        </div>
      </main>
    </div>
  );
};
