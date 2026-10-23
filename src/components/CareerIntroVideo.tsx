/**
 * CareerIntroVideo.tsx
 * Ultra-Smooth Cinematic Video Intro for Apex GT Career Mode.
 *
 * Sequence:
 * 1. Smooth crossfade entry from black loading screen into the video.
 * 2. Unobstructed, pure cinematic playback of the official career introduction video.
 * 3. Graceful audio handling with unmuted autoplay and soft volume ramps.
 * 4. Ultra-smooth fade-to-black exit directly into the 3D pilot walking presentation & audio narration.
 * 5. Discreet, non-intrusive keyboard shortcuts (Space, ESC, Enter) & subtle skip button.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Volume2, VolumeX, FastForward } from 'lucide-react';

export interface CareerIntroVideoProps {
  onFinish: () => void;
  videoSrc?: string;
}

export const CareerIntroVideo: React.FC<CareerIntroVideoProps> = ({
  onFinish,
  videoSrc = '/videos/career_intro.mp4',
}) => {
  const [isVisible, setIsVisible] = useState<boolean>(true);
  const [isExiting, setIsExiting] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [showUnmuteHint, setShowUnmuteHint] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isExitingRef = useRef<boolean>(false);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  // Ultra-smooth exit transition with audio fade-out
  const triggerExit = useCallback(() => {
    if (isExitingRef.current) return;
    isExitingRef.current = true;
    setIsExiting(true);

    const vid = videoRef.current;
    if (vid) {
      const initialVol = vid.volume;
      const startFade = performance.now();
      const fadeDuration = 800; // ms

      const fadeTimer = setInterval(() => {
        const elapsed = performance.now() - startFade;
        const progress = Math.min(1, elapsed / fadeDuration);
        try {
          vid.volume = Math.max(0, initialVol * (1 - progress));
        } catch {
          // Ignore
        }
        if (progress >= 1) {
          clearInterval(fadeTimer);
          try {
            vid.pause();
          } catch {
            // Ignore
          }
        }
      }, 40);
    }

    setTimeout(() => {
      onFinishRef.current();
    }, 850);
  }, []);

  // Smooth fade-in on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  // Autoplay and volume management
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;

    vid.volume = 1.0;

    const playPromise = vid.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Autoplay with sound blocked: fallback to muted playback and show subtle unmute button
        vid.muted = true;
        setIsMuted(true);
        setShowUnmuteHint(true);
        vid.play().catch(() => {
          // If video cannot play at all, smoothly exit to pilot presentation
          triggerExit();
        });
      });
    }
  }, [triggerExit]);

  // Unmute handler
  const handleToggleMute = useCallback(() => {
    const vid = videoRef.current;
    if (!vid) return;
    if (vid.muted) {
      vid.muted = false;
      vid.volume = 1.0;
      setIsMuted(false);
      setShowUnmuteHint(false);
    } else {
      vid.muted = true;
      setIsMuted(true);
    }
  }, []);

  // Keyboard navigation: ESC, Space, Enter to skip; M to toggle mute
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'Escape' || e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        triggerExit();
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        handleToggleMute();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleToggleMute, triggerExit]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black select-none overflow-hidden"
      style={{ backgroundColor: '#000000' }}
    >
      {/* Cinematic Pure Black Viewport with Video */}
      <div
        className={`relative w-full h-full flex items-center justify-center bg-black transition-opacity duration-700 ease-in-out ${
          isExiting ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <video
          ref={videoRef}
          className="w-full h-full max-w-full max-h-screen object-contain pointer-events-auto cursor-pointer"
          playsInline
          autoPlay
          preload="auto"
          onEnded={triggerExit}
          onError={() => {
            console.warn('Video failed to play, proceeding to pilot presentation...');
            triggerExit();
          }}
          onClick={triggerExit}
          title="Haz clic para continuar"
        >
          <source src={videoSrc} type="video/mp4" />
          <source src="/VID_20261018_030103.mp4" type="video/mp4" />
        </video>

        {/* Minimal Non-Intrusive Top Bar Controls */}
        <div className="absolute top-6 right-6 flex items-center gap-3 z-10 pointer-events-auto">
          {/* Subtle Unmute Pill if audio was initially restricted */}
          {showUnmuteHint && (
            <button
              type="button"
              onClick={handleToggleMute}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-600/80 hover:bg-red-600 text-white text-xs font-mono tracking-wider backdrop-blur-md shadow-lg transition-all duration-200 cursor-pointer animate-pulse"
              title="Activar Sonido"
            >
              <VolumeX className="w-3.5 h-3.5" />
              <span>ACTIVAR AUDIO</span>
            </button>
          )}

          {/* Sound Toggle (if not in hint mode) */}
          {!showUnmuteHint && (
            <button
              type="button"
              onClick={handleToggleMute}
              className="p-2 rounded-full bg-black/40 hover:bg-black/70 text-white/70 hover:text-white backdrop-blur-md border border-white/10 hover:border-white/25 transition-all duration-300 opacity-60 hover:opacity-100 cursor-pointer shadow-md"
              title={isMuted ? 'Activar sonido (M)' : 'Silenciar sonido (M)'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
            </button>
          )}

          {/* Ultra-Subtle Skip Button */}
          <button
            type="button"
            onClick={triggerExit}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/40 hover:bg-black/70 text-white/70 hover:text-white backdrop-blur-md border border-white/10 hover:border-white/25 text-xs font-mono tracking-wider transition-all duration-300 opacity-60 hover:opacity-100 cursor-pointer shadow-md"
            title="Omitir vídeo (ESC / Espacio)"
          >
            <span>OMITIR</span>
            <FastForward className="w-3.5 h-3.5" />
            <span className="hidden sm:inline-block text-[10px] px-1 py-0.2 rounded bg-white/10 text-neutral-400">
              ESC
            </span>
          </button>
        </div>

        {/* Faint Bottom Watermark / Cue */}
        <div className="absolute bottom-6 left-6 text-[10px] font-mono text-neutral-500/40 uppercase tracking-widest pointer-events-none">
          APEX GT · PRESENTACIÓN MODO CARRERA
        </div>
      </div>
    </div>
  );
};
