/**
 * SoundtrackModal.tsx
 * Sleek, non-intrusive in-game soundtrack player & jukebox for Apex GT.
 * Styled in luxury Gran Turismo / F1 carbon-glass aesthetic.
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Volume2,
  VolumeX,
  Disc,
  Radio,
  Sparkles,
} from 'lucide-react';
import {
  menuMusic,
  SOUNDTRACK_PLAYLIST,
  SoundtrackState,
} from '../utils/menuMusicManager';
import { playUiClick, playUiHover } from '../utils/uiAudio';

interface SoundtrackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SoundtrackModal: React.FC<SoundtrackModalProps> = ({ isOpen, onClose }) => {
  const [musicState, setMusicState] = useState<SoundtrackState>(() => menuMusic.getState());

  useEffect(() => {
    const unsubscribe = menuMusic.subscribe((state) => {
      setMusicState(state);
    });
    return unsubscribe;
  }, []);

  if (!isOpen) return null;

  const handleTrackClick = (index: number) => {
    playUiClick();
    menuMusic.selectTrack(index, true);
  };

  const handleTogglePlay = () => {
    playUiClick();
    menuMusic.togglePlayPause();
  };

  const handleNext = () => {
    playUiClick();
    menuMusic.nextTrack();
  };

  const handlePrev = () => {
    playUiClick();
    menuMusic.prevTrack();
  };

  const handleToggleShuffle = () => {
    playUiClick();
    menuMusic.toggleShuffle();
  };

  const handleToggleMute = () => {
    playUiClick();
    menuMusic.toggleMute();
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    menuMusic.setVolume(val);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      {/* Click outside backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Main Glassmorphism Player Container */}
      <div className="relative z-10 w-full max-w-lg bg-neutral-950/92 border border-white/15 rounded-2xl shadow-2xl shadow-black/80 flex flex-col overflow-hidden backdrop-blur-2xl max-h-[90vh]">
        
        {/* Subtle Top Accent Glow */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-600 via-amber-500 to-red-600" />

        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between flex-shrink-0 bg-neutral-900/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-400 shadow-sm">
              <Disc className={`w-5 h-5 ${musicState.isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '4s' }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-red-500 px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/20">
                  OST APEX GT
                </span>
                <span className="text-[10px] uppercase tracking-widest text-neutral-400 font-mono">
                  7 CANCIONES
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black uppercase tracking-wider text-white font-sans mt-0.5">
                SOUNDTRACK & JUKEBOX
              </h2>
            </div>
          </div>

          <button
            onClick={() => {
              playUiClick();
              onClose();
            }}
            onMouseEnter={playUiHover}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-neutral-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
            title="Cerrar reproductor"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Active Now Playing Banner */}
        <div className="px-5 py-3 bg-neutral-900/40 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex items-center gap-1 h-3 flex-shrink-0">
              {musicState.isPlaying ? (
                <>
                  <span className="w-0.5 h-3 bg-red-500 rounded-full animate-pulse" />
                  <span className="w-0.5 h-4 bg-amber-400 rounded-full animate-pulse delay-75" />
                  <span className="w-0.5 h-2.5 bg-red-400 rounded-full animate-pulse delay-150" />
                </>
              ) : (
                <Radio className="w-3.5 h-3.5 text-neutral-500" />
              )}
            </div>
            <div className="truncate">
              <p className="text-[10px] uppercase font-mono tracking-widest text-neutral-400">
                {musicState.isPlaying ? (musicState.isFadingIn ? 'Entrando suavemente (5s)...' : 'Reproduciendo ahora') : 'En pausa'}
              </p>
              <p className="text-xs sm:text-sm font-bold text-white tracking-wide truncate">
                {musicState.currentTrack.title}
              </p>
            </div>
          </div>

          <span
            className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border"
            style={{
              borderColor: `${musicState.currentTrack.color}55`,
              backgroundColor: `${musicState.currentTrack.color}18`,
              color: musicState.currentTrack.color,
            }}
          >
            {musicState.currentTrack.tag}
          </span>
        </div>

        {/* Track List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar min-h-0">
          {musicState.playlist.map((track, idx) => {
            const isCurrent = idx === musicState.currentIndex;
            return (
              <button
                key={track.id}
                onClick={() => handleTrackClick(idx)}
                onMouseEnter={playUiHover}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl transition-all flex items-center justify-between group cursor-pointer border ${
                  isCurrent
                    ? 'bg-white/12 border-white/25 shadow-lg shadow-black/40 text-white'
                    : 'bg-white/3 hover:bg-white/7 border-white/5 hover:border-white/15 text-neutral-300'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Track Number / Equalizer */}
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono text-xs font-bold transition-all flex-shrink-0 ${
                      isCurrent
                        ? 'bg-red-600 text-white shadow-md'
                        : 'bg-neutral-800/80 text-neutral-400 group-hover:bg-neutral-700/80 group-hover:text-neutral-200'
                    }`}
                  >
                    {isCurrent && musicState.isPlaying ? (
                      <span className="flex items-center gap-0.5">
                        <span className="w-0.5 h-2.5 bg-white animate-pulse" />
                        <span className="w-0.5 h-3.5 bg-white animate-pulse delay-75" />
                        <span className="w-0.5 h-2 bg-white animate-pulse delay-150" />
                      </span>
                    ) : (
                      String(idx + 1).padStart(2, '0')
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className={`text-xs sm:text-sm font-bold tracking-wide truncate ${isCurrent ? 'text-white' : 'text-neutral-200'}`}>
                      {track.title}
                    </p>
                    <p className="text-[10px] text-neutral-400 truncate font-mono">
                      {track.subtitle}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <span
                    className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border hidden sm:inline-block"
                    style={{
                      borderColor: `${track.color}40`,
                      backgroundColor: `${track.color}15`,
                      color: track.color,
                    }}
                  >
                    {track.tag}
                  </span>
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center transition-opacity ${
                      isCurrent ? 'opacity-100 text-red-400' : 'opacity-0 group-hover:opacity-100 text-neutral-400'
                    }`}
                  >
                    {isCurrent && musicState.isPlaying ? (
                      <Pause className="w-3.5 h-3.5 fill-current" />
                    ) : (
                      <Play className="w-3.5 h-3.5 fill-current" />
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Bottom Playback Control Hub */}
        <div className="p-4 bg-neutral-950 border-t border-white/10 flex flex-col gap-3 flex-shrink-0">
          
          {/* Controls Bar: Shuffle, Prev, Play/Pause, Next, Mute */}
          <div className="flex items-center justify-between">
            {/* Shuffle Button */}
            <button
              onClick={handleToggleShuffle}
              onMouseEnter={playUiHover}
              title={musicState.shuffleEnabled ? 'Aleatorio inteligente activo (sin repetición)' : 'Reproducción en orden'}
              className={`p-2 rounded-lg transition-all flex items-center gap-1.5 text-xs font-mono cursor-pointer border ${
                musicState.shuffleEnabled
                  ? 'bg-red-600/25 border-red-500/40 text-red-300'
                  : 'bg-white/5 border-white/10 text-neutral-400 hover:text-white'
              }`}
            >
              <Shuffle className="w-3.5 h-3.5" />
              <span className="text-[10px] hidden sm:inline font-bold">SHUFFLE</span>
            </button>

            {/* Core Playback Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrev}
                onMouseEnter={playUiHover}
                title="Pista anterior"
                className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-neutral-300 hover:text-white flex items-center justify-center transition-all cursor-pointer"
              >
                <SkipBack className="w-4 h-4 fill-current" />
              </button>

              <button
                onClick={handleTogglePlay}
                onMouseEnter={playUiHover}
                title={musicState.isPlaying ? 'Pausar' : 'Reproducir'}
                className="w-11 h-11 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center transition-all cursor-pointer shadow-lg shadow-red-600/40 hover:scale-105 active:scale-95"
              >
                {musicState.isPlaying ? (
                  <Pause className="w-5 h-5 fill-current" />
                ) : (
                  <Play className="w-5 h-5 fill-current translate-x-0.5" />
                )}
              </button>

              <button
                onClick={handleNext}
                onMouseEnter={playUiHover}
                title="Siguiente pista"
                className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-neutral-300 hover:text-white flex items-center justify-center transition-all cursor-pointer"
              >
                <SkipForward className="w-4 h-4 fill-current" />
              </button>
            </div>

            {/* Volume & Mute Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleToggleMute}
                onMouseEnter={playUiHover}
                title={musicState.isMuted ? 'Activar sonido' : 'Silenciar'}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-neutral-400 hover:text-white transition-all cursor-pointer"
              >
                {musicState.isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={musicState.isMuted ? 0 : musicState.volume}
                onChange={handleVolumeChange}
                className="w-16 sm:w-20 accent-red-600 cursor-pointer h-1.5 bg-neutral-800 rounded-lg"
                title="Volumen del menú"
              />
            </div>
          </div>

          {/* Quick Notice */}
          <div className="flex items-center justify-between text-[10px] text-neutral-400 font-mono px-1">
            <span className="flex items-center gap-1 text-neutral-400">
              <Sparkles className="w-3 h-3 text-amber-400" />
              Fade-in progresivo de 5s al iniciar o cambiar
            </span>
            <span className="text-neutral-400">
              Apex Sound Engine
            </span>
          </div>

        </div>

      </div>
    </div>
  );
};
