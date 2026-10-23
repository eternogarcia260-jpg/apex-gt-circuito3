/**
 * CinematicOverlay.tsx - FIA Official Broadcast TV Graphics Overlay
 * Renders real-time telemetry lower-thirds, sector indicators, pilot & constructor cards,
 * and high-visibility skip affordances during the 3D cinematic presentation.
 */

import React, { useEffect } from 'react';
import { CinematicShotInfo } from '../game/camera/CinematicDirector';
import { Flag, Compass, FastForward, Award, Shield, Zap, Sparkles } from 'lucide-react';

interface CinematicOverlayProps {
  shotInfo: CinematicShotInfo | null;
  onSkip: () => void;
  circuitName?: string;
  country?: string;
  flagEmoji?: string;
  seasonRound?: number;
  totalRounds?: number;
}

export const CinematicOverlay: React.FC<CinematicOverlayProps> = ({
  shotInfo,
  onSkip,
  circuitName = 'Circuit 1 - Square Apex',
  country = 'Monaco / Urban',
  flagEmoji = '🇲🇨',
  seasonRound = 1,
  totalRounds = 5,
}) => {
  // Listen for Spacebar key to skip
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Escape' || e.code === 'Enter') {
        e.preventDefault();
        onSkip();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSkip]);

  const isPilotReveal = shotInfo?.type === 'PILOT_REVEAL';
  const livery = shotInfo?.driverLivery;

  return (
    <div className="absolute inset-0 z-40 pointer-events-none flex flex-col justify-between overflow-hidden select-none font-sans">
      {/* Top Cinematic Letterbox Bar */}
      <div className="w-full bg-linear-to-b from-black/90 via-black/60 to-transparent pt-4 pb-12 px-6 sm:px-10 flex items-start justify-between">
        {/* Left: Circuit Broadcast Badge */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-neutral-900/90 border border-neutral-700/80 flex items-center justify-center text-xl shadow-lg">
            {flagEmoji}
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400">
              <span>FIA GRAND PRIX</span>
              <span>·</span>
              <span>RONDA {seasonRound} DE {totalRounds}</span>
            </div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white font-['Chakra_Petch'] uppercase">
              {circuitName}
            </h1>
            <p className="text-xs text-neutral-400 hidden sm:block">
              {country} · Inspección oficial de sectores y trazada
            </p>
          </div>
        </div>

        {/* Right: Skip Button (Interactive pointer-events-auto) */}
        <button
          onClick={onSkip}
          className="pointer-events-auto group flex items-center gap-2.5 px-4 py-2 rounded-lg bg-neutral-900/80 hover:bg-neutral-800 text-white text-xs font-semibold tracking-wide border border-neutral-700/80 hover:border-amber-400/80 transition-all shadow-xl active:scale-95 cursor-pointer"
          title="Saltar presentación de circuito"
        >
          <span className="text-neutral-300 group-hover:text-amber-400 transition-colors uppercase">
            Saltar Presentación
          </span>
          <FastForward className="w-4 h-4 text-amber-400 group-hover:translate-x-0.5 transition-transform" />
          <span className="hidden md:inline text-[10px] text-neutral-400 px-1.5 py-0.5 bg-neutral-800 rounded border border-neutral-700 font-mono">
            ESPACIO
          </span>
        </button>
      </div>

      {/* Center Dynamic Crosshair / Framing Grid (Subtle high-tech aesthetic) */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-30">
        <div className="w-48 h-48 border border-white/10 rounded-full flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-white/40" />
        </div>
      </div>

      {/* Bottom Cinematic Letterbox & Official Broadcast Graphic Card */}
      <div className="w-full bg-linear-to-t from-black/95 via-black/80 to-transparent pb-8 pt-16 px-6 sm:px-12 flex flex-col items-center">
        {/* Step Indicator Bar */}
        <div className="w-full max-w-4xl flex items-center justify-between mb-4 gap-2">
          {Array.from({ length: shotInfo?.totalShots || 3 }).map((_, stepIdx) => {
            const isCurrent = (shotInfo?.index ?? 0) === stepIdx;
            const isCompleted = (shotInfo?.index ?? 0) > stepIdx;
            return (
              <div
                key={stepIdx}
                className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                  isCurrent
                    ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]'
                    : isCompleted
                    ? 'bg-neutral-500'
                    : 'bg-neutral-800'
                }`}
              />
            );
          })}
        </div>

        {/* Dynamic Broadcast Lower-Third Card */}
        <div className="w-full max-w-4xl">
          {!isPilotReveal ? (
            /* Zone & Sector Presentation Card */
            <div className="p-5 sm:p-6 rounded-xl bg-neutral-900/90 border border-neutral-800 shadow-2xl backdrop-blur-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-3 duration-500">
              <div className="flex-1">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-widest font-['Chakra_Petch']">
                  <Compass className="w-3.5 h-3.5" />
                  <span>{shotInfo?.zoneTag || 'SECTOR EN VIVO'}</span>
                  <span className="text-neutral-500">·</span>
                  <span className="text-neutral-400">TOMA {(shotInfo?.index ?? 0) + 1} DE {shotInfo?.totalShots ?? 4}</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white uppercase font-['Chakra_Petch'] mt-1">
                  {shotInfo?.title || 'SECTOR DEL CIRCUITO'}
                </h2>
                <p className="text-sm text-neutral-300 mt-1 max-w-2xl leading-relaxed">
                  {shotInfo?.subtitle || 'Análisis en tiempo real de trazada, bordillos y velocidades de paso.'}
                </p>
              </div>

              <div className="shrink-0 flex items-center gap-3 px-4 py-2 rounded-lg bg-neutral-950/80 border border-neutral-800">
                <div className="text-right">
                  <div className="text-[10px] text-neutral-400 uppercase tracking-wider">MODO DE CÁMARA</div>
                  <div className="text-xs font-bold text-white font-mono">TELEMETRÍA 3D</div>
                </div>
                <Zap className="w-5 h-5 text-amber-400" />
              </div>
            </div>
          ) : (
            /* Official Driver & Team Presentation Card */
            <div className="p-6 rounded-xl bg-neutral-900/95 border border-amber-400/40 shadow-2xl backdrop-blur-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 animate-in fade-in zoom-in-95 duration-500 relative overflow-hidden">
              {/* Team Color Accent Edge */}
              <div
                className="absolute left-0 top-0 bottom-0 w-2.5"
                style={{ backgroundColor: livery?.secondaryColor || livery?.primaryColor || '#cc0022' }}
              />

              <div className="flex items-center gap-4 pl-2">
                {/* Driver Number Badge */}
                <div
                  className="w-16 h-16 rounded-lg flex flex-col items-center justify-center font-['Chakra_Petch'] font-black text-2xl shadow-inner border"
                  style={{
                    backgroundColor: livery?.primaryColor || '#040814',
                    borderColor: livery?.accentColor || '#fec008',
                    color: livery?.accentColor || '#fec008',
                  }}
                >
                  <span className="text-[10px] uppercase tracking-tighter leading-none opacity-80">DORSAL</span>
                  <span className="leading-none mt-0.5">#{livery?.driverNumber || '1'}</span>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400">
                    <span>{livery?.driverCode || 'PIL'}</span>
                    <span className="text-neutral-500">·</span>
                    <span className="text-neutral-300">{livery?.teamName || 'ESCUDERÍA APEX'}</span>
                    {livery?.sponsorName && (
                      <>
                        <span className="text-neutral-500">·</span>
                        <span className="text-white font-bold">{livery.sponsorName}</span>
                      </>
                    )}
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white uppercase font-['Chakra_Petch'] mt-0.5">
                    {livery?.driverName || 'PILOTO OFICIAL'}
                  </h2>
                  <div className="flex items-center gap-3 text-xs text-neutral-300 mt-1">
                    <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                      <Award className="w-3.5 h-3.5" />
                      Posición en parrilla: Pole Position (P1)
                    </span>
                    <span className="text-neutral-500">·</span>
                    <span className="text-neutral-400">Listo para inicio de Gran Premio</span>
                  </div>
                </div>
              </div>

              {/* Ready Status / Start Race Prompt */}
              <div className="shrink-0 flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-800">
                <div className="text-right">
                  <span className="text-[10px] text-neutral-400 uppercase tracking-widest block font-mono">SECUENCIA DE SALIDA</span>
                  <span className="text-xs font-bold text-amber-400 uppercase font-['Chakra_Petch']">5 Luces Rojas FIA</span>
                </div>
                <button
                  onClick={onSkip}
                  className="pointer-events-auto mt-2 px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs uppercase tracking-wider transition-all shadow-lg active:scale-95 cursor-pointer flex items-center gap-2"
                >
                  <span>A la Parrilla</span>
                  <FastForward className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
