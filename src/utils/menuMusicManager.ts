/**
 * menuMusicManager.ts
 * High-performance, multi-track background music orchestrator for Apex GT.
 * 
 * Features:
 * - 7-track official OST playlist with smart non-repeating shuffle cycle.
 * - Silk-smooth 5-second acoustic S-curve fade-in without sudden volume bursts.
 * - Exponential decay fade-out (~1.6s) for seamless transitions to race mode.
 * - Persistent position memory: never restarts from 0.0s on rapid menu switching.
 * - Real-time state subscription for the Soundtrack HUD modal and in-menu player controls.
 * - Auto-advances to next track seamlessly upon song finish.
 * - Zero CPU waste; streams native HTMLAudioElement with GPU-friendly requestAnimationFrame.
 */

export interface SoundtrackTrack {
  id: string;
  title: string;
  subtitle: string;
  src: string;
  tag: string;
  color: string;
}

export interface SoundtrackState {
  currentTrack: SoundtrackTrack;
  currentIndex: number;
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  isFadingIn: boolean;
  isFadingOut: boolean;
  shuffleEnabled: boolean;
  playlist: readonly SoundtrackTrack[];
}

export const SOUNDTRACK_PLAYLIST: readonly SoundtrackTrack[] = [
  {
    id: 'over_the_edge',
    title: 'Over The Edge',
    subtitle: 'Tema Principal Apex GT',
    src: '/audio/soundtrack/over_the_edge.mp3',
    tag: 'ELECTRONIC ROCK',
    color: '#ef4444',
  },
  {
    id: 'asphalt_queen',
    title: 'Asphalt Queen',
    subtitle: 'High Velocity Synth',
    src: '/audio/soundtrack/asphalt_queen.mp3',
    tag: 'SYNTHWAVE',
    color: '#ec4899',
  },
  {
    id: 'burnt_rubber',
    title: 'Burnt Rubber',
    subtitle: 'Heavy Electro Paddock',
    src: '/audio/soundtrack/burnt_rubber.mp3',
    tag: 'ELECTRO BASS',
    color: '#f97316',
  },
  {
    id: 'sleeper_beast',
    title: 'Sleeper Beast',
    subtitle: 'Cyberpunk Garage Beats',
    src: '/audio/soundtrack/sleeper_beast.mp3',
    tag: 'CYBERPUNK',
    color: '#8b5cf6',
  },
  {
    id: 'stock_to_steel',
    title: 'Stock to Steel',
    subtitle: 'Industrial Speedwave',
    src: '/audio/soundtrack/stock_to_steel.mp3',
    tag: 'INDUSTRIAL',
    color: '#06b6d4',
  },
  {
    id: 'turbo_crush',
    title: 'Turbo Crush',
    subtitle: 'Maximum Overdrive Bass',
    src: '/audio/soundtrack/turbo_crush.mp3',
    tag: 'DRUM & BASS',
    color: '#eab308',
  },
  {
    id: 'zero_margin',
    title: 'Zero Margin',
    subtitle: 'Apex Precision Chiptune',
    src: '/audio/soundtrack/zero_margin.mp3',
    tag: 'HYPERDRIVE',
    color: '#10b981',
  },
];

type MusicListener = (state: SoundtrackState) => void;

class MenuMusicManager {
  private static instance: MenuMusicManager | null = null;
  private audio: HTMLAudioElement | null = null;
  private currentTrackIndex: number = 0;
  private targetVolume: number = 0.42;
  private fadeInterval: number | null = null;
  private lastPosition: number = 0;
  private isMuted: boolean = false;
  private isPlaying: boolean = false;
  private isFadingIn: boolean = false;
  private isFadingOut: boolean = false;
  private shuffleEnabled: boolean = true;
  private shuffleQueue: number[] = [];
  private listeners: Set<MusicListener> = new Set();

  private constructor() {
    this.initShuffleQueue();
  }

  public static getInstance(): MenuMusicManager {
    if (!MenuMusicManager.instance) {
      MenuMusicManager.instance = new MenuMusicManager();
    }
    return MenuMusicManager.instance;
  }

  /**
   * Initializes or replenishes the smart shuffle queue without consecutive repeats
   */
  private initShuffleQueue(): void {
    const indices = SOUNDTRACK_PLAYLIST.map((_, i) => i);
    // Fisher-Yates shuffle
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    // Prevent immediate back-to-back duplicate if multiple tracks exist
    if (indices.length > 1 && indices[0] === this.currentTrackIndex) {
      const temp = indices[0];
      indices[0] = indices[indices.length - 1];
      indices[indices.length - 1] = temp;
    }

    this.shuffleQueue = indices;
  }

  private initAudio(): HTMLAudioElement {
    if (this.audio) return this.audio;

    const audio = new Audio(SOUNDTRACK_PLAYLIST[this.currentTrackIndex].src);
    audio.loop = false;
    audio.preload = 'auto';
    audio.volume = 0;

    // Track playback position
    audio.addEventListener('timeupdate', () => {
      if (audio.currentTime > 0) {
        this.lastPosition = audio.currentTime;
      }
    });

    // Auto-advance smoothly when song ends
    audio.addEventListener('ended', () => {
      this.lastPosition = 0;
      this.nextTrack(true);
    });

    audio.addEventListener('play', () => {
      this.isPlaying = true;
      this.notifyListeners();
    });

    audio.addEventListener('pause', () => {
      if (!this.isFadingOut) {
        this.isPlaying = false;
        this.notifyListeners();
      }
    });

    this.audio = audio;
    return audio;
  }

  private notifyListeners(): void {
    const state = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(state);
      } catch (err) {
        console.error('Error in music state listener:', err);
      }
    });
  }

  public getState(): SoundtrackState {
    return {
      currentTrack: SOUNDTRACK_PLAYLIST[this.currentTrackIndex],
      currentIndex: this.currentTrackIndex,
      isPlaying: this.isPlaying,
      volume: this.targetVolume,
      isMuted: this.isMuted,
      isFadingIn: this.isFadingIn,
      isFadingOut: this.isFadingOut,
      shuffleEnabled: this.shuffleEnabled,
      playlist: SOUNDTRACK_PLAYLIST,
    };
  }

  public subscribe(listener: MusicListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Starts or resumes soundtrack with 5-second silky smooth volume swell.
   * Begins strictly at 0 volume to guarantee zero pops or bursts.
   */
  public play(options: { forceRandomStart?: boolean; fadeInMs?: number } = {}): void {
    const audio = this.initAudio();

    if (this.isMuted) return;

    // If already playing and actively fading in, let the 5-second swell continue uninterrupted
    if (this.isPlaying && this.isFadingIn && !audio.paused) {
      return;
    }

    this.clearFade();

    // Cue position handling
    if (options.forceRandomStart) {
      if (audio.duration && !isNaN(audio.duration) && audio.duration > 20) {
        const maxOffset = Math.min(60, Math.floor(audio.duration * 0.45));
        audio.currentTime = Math.floor(Math.random() * maxOffset);
      }
    } else if (this.lastPosition > 0 && Math.abs(audio.currentTime - this.lastPosition) > 1) {
      try {
        audio.currentTime = this.lastPosition;
      } catch {}
    } else if (this.lastPosition === 0) {
      try {
        audio.currentTime = 0;
      } catch {}
    }

    // STRICT: Ensure volume starts at absolute 0
    if (!this.isPlaying || audio.paused || this.isFadingOut) {
      audio.volume = 0;
    }

    this.isPlaying = true;
    this.isFadingIn = true;
    this.isFadingOut = false;
    this.notifyListeners();

    audio.play().catch(() => {
      // Browser autoplay policy guard
    });

    const duration = options.fadeInMs ?? 5000;
    this.fadeTo(this.targetVolume, duration, () => {
      this.isFadingIn = false;
      this.notifyListeners();
    });
  }

  /**
   * Pauses the menu music with progressive exponential decay
   */
  public pause(fadeOutMs: number = 1600): void {
    if (!this.audio || !this.isPlaying) return;

    this.isFadingIn = false;
    this.isFadingOut = true;
    this.clearFade();
    this.notifyListeners();

    if (this.audio.currentTime > 0) {
      this.lastPosition = this.audio.currentTime;
    }

    this.fadeTo(0, fadeOutMs, () => {
      if (this.audio) {
        this.audio.pause();
        this.isPlaying = false;
        this.isFadingOut = false;
        if (this.audio.currentTime > 0) {
          this.lastPosition = this.audio.currentTime;
        }
        this.notifyListeners();
      }
    });
  }

  public togglePlayPause(): void {
    if (this.isPlaying) {
      this.pause(600);
    } else {
      this.play({ fadeInMs: 2000 });
    }
  }

  /**
   * Selects and plays a specific track by index
   */
  public selectTrack(index: number, autoPlay: boolean = true): void {
    if (index < 0 || index >= SOUNDTRACK_PLAYLIST.length) return;
    if (index === this.currentTrackIndex && this.isPlaying) return;

    const audio = this.initAudio();

    // Quick smooth crossfade out of old track
    this.clearFade();
    const wasPlaying = this.isPlaying || autoPlay;

    this.fadeTo(0, 300, () => {
      this.currentTrackIndex = index;
      this.lastPosition = 0;
      audio.src = SOUNDTRACK_PLAYLIST[index].src;
      audio.currentTime = 0;
      audio.volume = 0;

      if (wasPlaying && !this.isMuted) {
        this.play({ fadeInMs: 3500 });
      } else {
        this.notifyListeners();
      }
    });
  }

  /**
   * Advances to next track using smart shuffle or sequential cycle
   */
  public nextTrack(autoAdvance: boolean = false): void {
    let nextIndex: number;

    if (this.shuffleEnabled) {
      if (this.shuffleQueue.length === 0) {
        this.initShuffleQueue();
      }
      nextIndex = this.shuffleQueue.shift() ?? 0;
      if (nextIndex === this.currentTrackIndex && SOUNDTRACK_PLAYLIST.length > 1) {
        if (this.shuffleQueue.length === 0) {
          this.initShuffleQueue();
        }
        nextIndex = this.shuffleQueue.shift() ?? (this.currentTrackIndex + 1) % SOUNDTRACK_PLAYLIST.length;
      }
    } else {
      nextIndex = (this.currentTrackIndex + 1) % SOUNDTRACK_PLAYLIST.length;
    }

    this.selectTrack(nextIndex, autoAdvance || this.isPlaying);
  }

  /**
   * Goes to previous track
   */
  public prevTrack(): void {
    const prevIndex = (this.currentTrackIndex - 1 + SOUNDTRACK_PLAYLIST.length) % SOUNDTRACK_PLAYLIST.length;
    this.selectTrack(prevIndex, this.isPlaying);
  }

  public toggleShuffle(): void {
    this.shuffleEnabled = !this.shuffleEnabled;
    if (this.shuffleEnabled) {
      this.initShuffleQueue();
    }
    this.notifyListeners();
  }

  public setVolume(volume: number): void {
    this.targetVolume = Math.max(0, Math.min(1, volume));
    if (this.isPlaying && this.audio && !this.isFadingIn && !this.isFadingOut) {
      this.audio.volume = this.targetVolume;
    }
    this.notifyListeners();
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (muted) {
      this.pause(300);
    } else if (this.isPlaying) {
      this.play({ fadeInMs: 1500 });
    }
    this.notifyListeners();
  }

  public toggleMute(): void {
    this.setMuted(!this.isMuted);
  }

  public getPlaybackPosition(): number {
    return this.audio ? this.audio.currentTime : this.lastPosition;
  }

  /**
   * Psychoacoustically curved progressive volume transition:
   * - Fade-in: starts softly like a whisper and steadily blossoms to target (p^1.6)
   * - Fade-out: smoothly decays into silence
   */
  private fadeTo(target: number, durationMs: number, onComplete?: () => void): void {
    if (!this.audio) return;

    this.clearFade();

    const startVolume = this.audio.volume;
    const startTime = performance.now();
    const isFadingIn = target > startVolume;

    if (Math.abs(target - startVolume) < 0.005 || durationMs <= 0) {
      this.audio.volume = target;
      onComplete?.();
      return;
    }

    const step = () => {
      if (!this.audio) return;
      const elapsed = performance.now() - startTime;
      const rawProgress = Math.min(1, elapsed / durationMs);

      let currentVal: number;
      if (isFadingIn) {
        // Calibrated progressive curve: starts smoothly from 0, reaches 15% volume at second 1 (1000ms),
        // then continues swelling progressively and smoothly to target volume over the remaining duration.
        const oneSecondMs = 1000;
        const midTarget = Math.min(target, 0.15);

        if (durationMs >= 2000 && startVolume < midTarget) {
          if (elapsed <= oneSecondMs) {
            // First 1 second: smooth swell from 0 up to 15% volume (no audio pop)
            const u = Math.min(1, elapsed / oneSecondMs);
            const ease = Math.pow(u, 1.15);
            currentVal = startVolume + (midTarget - startVolume) * ease;
          } else {
            // Second 1 to end: smooth progressive rise from 15% to target volume
            const remainProgress = Math.min(1, Math.max(0, (elapsed - oneSecondMs) / (durationMs - oneSecondMs)));
            const ease = Math.pow(remainProgress, 1.25);
            currentVal = midTarget + (target - midTarget) * ease;
          }
        } else {
          // Standard smooth power curve for shorter fades
          currentVal = startVolume + (target - startVolume) * Math.pow(rawProgress, 1.35);
        }
      } else {
        // Progressive natural dissolve
        const p = rawProgress;
        const smoother = p * p * p * (p * (p * 6 - 15) + 10);
        const invSmoother = 1 - smoother;
        const decay = Math.pow(invSmoother, 1.5);
        currentVal = target + (startVolume - target) * decay;
      }

      this.audio.volume = Math.max(0, Math.min(1, currentVal));

      if (rawProgress < 1) {
        this.fadeInterval = requestAnimationFrame(step);
      } else {
        this.audio.volume = target;
        this.fadeInterval = null;
        onComplete?.();
      }
    };

    this.fadeInterval = requestAnimationFrame(step);
  }

  private clearFade(): void {
    if (this.fadeInterval !== null) {
      cancelAnimationFrame(this.fadeInterval);
      this.fadeInterval = null;
    }
  }
}

export const menuMusic = MenuMusicManager.getInstance();
