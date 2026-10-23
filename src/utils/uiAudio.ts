/**
 * uiAudio.ts
 * Procedural Web Audio API sound effects for Apex GT UI interactions.
 * Delivers crisp, tactile acoustic feedback for clicks, hovers, mode transitions,
 * and cinematic engine ignition roars without external sound assets.
 */

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!sharedAudioCtx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        sharedAudioCtx = new AudioContextClass();
      }
    }
    if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

/**
 * Subtle high-tech hover sound for menu buttons
 */
export function playUiHover(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.exponentialRampToValueAtTime(780, now + 0.04);

    gain.gain.setValueAtTime(0.025, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.045);
  } catch {
    // Audio context may not be ready yet
  }
}

/**
 * Tactile, crisp UI click with customizable frequency punch
 */
export function playUiClick(freq: number = 800): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.45, now + 0.06);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.065);
  } catch {
    // Audio context may not be ready yet
  }
}

/**
 * Ascending harmonic chime for selecting race modes
 */
export function playModeSelectChime(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const notes = [440, 554.37, 659.25, 880]; // A major arpeggio
    
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = now + idx * 0.055;
      const duration = 0.28;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.045, startTime);
      gain.gain.exponentialRampToValueAtTime(0.0005, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration + 0.02);
    });
  } catch {
    // Audio context may not be ready yet
  }
}

/**
 * High-octane American Muscle V8 ignition roar combined with subtle F1 hybrid whistle (zero backfires)
 */
export function playEngineIgnitionRoar(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    // 1. Heavy starter solenoid mechanical clicks
    for (let i = 0; i < 3; i++) {
      const crankOsc = ctx.createOscillator();
      const crankGain = ctx.createGain();
      const crankTime = now + i * 0.065;

      crankOsc.type = 'sawtooth';
      crankOsc.frequency.setValueAtTime(110 + i * 15, crankTime);

      crankGain.gain.setValueAtTime(0.07, crankTime);
      crankGain.gain.exponentialRampToValueAtTime(0.001, crankTime + 0.04);

      crankOsc.connect(crankGain);
      crankGain.connect(ctx.destination);

      crankOsc.start(crankTime);
      crankOsc.stop(crankTime + 0.048);
    }

    // 2. High-torque starter motor spin
    const starterWhir = ctx.createOscillator();
    const starterFilter = ctx.createBiquadFilter();
    const starterGain = ctx.createGain();
    const starterStart = now + 0.08;
    const starterEnd = now + 0.28;

    starterWhir.type = 'sawtooth';
    starterWhir.frequency.setValueAtTime(140, starterStart);
    starterWhir.frequency.exponentialRampToValueAtTime(260, starterEnd);

    starterFilter.type = 'lowpass';
    starterFilter.frequency.setValueAtTime(650, starterStart);

    starterGain.gain.setValueAtTime(0.001, starterStart);
    starterGain.gain.linearRampToValueAtTime(0.07, starterStart + 0.06);
    starterGain.gain.exponentialRampToValueAtTime(0.001, starterEnd);

    starterWhir.connect(starterFilter);
    starterFilter.connect(starterGain);
    starterGain.connect(ctx.destination);

    starterWhir.start(starterStart);
    starterWhir.stop(starterEnd);

    // 3. American V8 Muscle Roar: Deep, heavy, guttural combustion surge with massive bass punch
    const roarTime = now + 0.25;
    const roarDuration = 1.15;

    // Sub-bass heavy crank physical punch & exhaust pressure core (40 Hz - 240 Hz)
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sawtooth';
    subOsc.frequency.setValueAtTime(40, roarTime);
    subOsc.frequency.exponentialRampToValueAtTime(240, roarTime + 0.22); // Powerful V8 surge
    subOsc.frequency.exponentialRampToValueAtTime(42, roarTime + roarDuration); // Settling into deep American idle

    subGain.gain.setValueAtTime(0.20, roarTime);
    subGain.gain.exponentialRampToValueAtTime(0.38, roarTime + 0.20);
    subGain.gain.exponentialRampToValueAtTime(0.001, roarTime + roarDuration);

    const roarFilter = ctx.createBiquadFilter();
    roarFilter.type = 'lowpass';
    roarFilter.frequency.setValueAtTime(500, roarTime);
    roarFilter.frequency.exponentialRampToValueAtTime(1550, roarTime + 0.22);
    roarFilter.frequency.exponentialRampToValueAtTime(550, roarTime + roarDuration);

    // Deep exhaust pressure bass punch filter
    const bassPunchFilter = ctx.createBiquadFilter();
    bassPunchFilter.type = 'peaking';
    bassPunchFilter.frequency.setValueAtTime(75, roarTime);
    bassPunchFilter.Q.setValueAtTime(2.0, roarTime);
    bassPunchFilter.gain.setValueAtTime(9.0, roarTime);

    subOsc.connect(roarFilter);
    roarFilter.connect(bassPunchFilter);
    bassPunchFilter.connect(subGain);
    subGain.connect(ctx.destination);

    subOsc.start(roarTime);
    subOsc.stop(roarTime + roarDuration + 0.05);

    // V8 Cross-plane Manifold Growl & Throat Rumble
    const growlOsc = ctx.createOscillator();
    const growlGain = ctx.createGain();
    growlOsc.type = 'triangle';
    growlOsc.frequency.setValueAtTime(80, roarTime);
    growlOsc.frequency.exponentialRampToValueAtTime(460, roarTime + 0.22);
    growlOsc.frequency.exponentialRampToValueAtTime(84, roarTime + roarDuration);

    growlGain.gain.setValueAtTime(0.14, roarTime);
    growlGain.gain.exponentialRampToValueAtTime(0.26, roarTime + 0.22);
    growlGain.gain.exponentialRampToValueAtTime(0.001, roarTime + roarDuration);

    growlOsc.connect(bassPunchFilter);
    growlOsc.start(roarTime);
    growlOsc.stop(roarTime + roarDuration + 0.05);

    // 4. Subtle F1 Hybrid Whine Layer (Pure sine wave, silky & technological, 50/50 balance)
    const f1Osc = ctx.createOscillator();
    const f1Filter = ctx.createBiquadFilter();
    const f1Gain = ctx.createGain();

    f1Osc.type = 'sine';
    f1Osc.frequency.setValueAtTime(1500, roarTime);
    f1Osc.frequency.exponentialRampToValueAtTime(2850, roarTime + 0.24);
    f1Osc.frequency.exponentialRampToValueAtTime(1600, roarTime + roarDuration);

    f1Filter.type = 'bandpass';
    f1Filter.frequency.setValueAtTime(2200, roarTime);
    f1Filter.Q.setValueAtTime(1.8, roarTime);

    f1Gain.gain.setValueAtTime(0.01, roarTime);
    f1Gain.gain.exponentialRampToValueAtTime(0.16, roarTime + 0.22);
    f1Gain.gain.exponentialRampToValueAtTime(0.001, roarTime + roarDuration);

    f1Osc.connect(f1Filter);
    f1Filter.connect(f1Gain);
    f1Gain.connect(ctx.destination);

    f1Osc.start(roarTime);
    f1Osc.stop(roarTime + roarDuration + 0.05);
  } catch {
    // Audio context may not be ready yet
  }
}

const PIT_RADIO_AUDIO_PATH = '/audio/pit_box_radio.mp3';
let cachedRadioBuffer: AudioBuffer | null = null;
let isRadioLoading = false;

export function preloadPitRadioAudio(): void {
  const ctx = getAudioContext();
  if (!ctx || cachedRadioBuffer || isRadioLoading) return;
  isRadioLoading = true;
  fetch(PIT_RADIO_AUDIO_PATH)
    .then((r) => r.arrayBuffer())
    .then((arr) => ctx.decodeAudioData(arr))
    .then((buf) => {
      cachedRadioBuffer = buf;
    })
    .catch((err) => {
      console.warn('Could not preload pit radio audio:', err);
    })
    .finally(() => {
      isRadioLoading = false;
    });
}

/**
 * Procedural F1 Pit Radio Communication:
 * 1. Intro VHF static squelch burst & high-pitch tactical double chirp
 * 2. Authentic custom race engineer voice audio from uploaded recording
 * 3. Outro transmission roger beep & VHF line release
 */
export function playF1BoxRadioConfirmation(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    // --- 1. PROCEDURAL INTRO RADIO CHIRP & VHF SQUELCH ---
    // Double frequency opening beep (1480 Hz -> 2150 Hz)
    [
      { freq: 1480, start: now, dur: 0.038 },
      { freq: 2150, start: now + 0.042, dur: 0.045 },
    ].forEach(({ freq, start, dur }) => {
      const beepOsc = ctx.createOscillator();
      const beepGain = ctx.createGain();

      beepOsc.type = 'sine';
      beepOsc.frequency.setValueAtTime(freq, start);

      beepGain.gain.setValueAtTime(0.09, start);
      beepGain.gain.exponentialRampToValueAtTime(0.001, start + dur);

      beepOsc.connect(beepGain);
      beepGain.connect(ctx.destination);

      beepOsc.start(start);
      beepOsc.stop(start + dur + 0.01);
    });

    // VHF line-open static burst (filtered bandpass 500Hz - 3400Hz)
    const burstLen = Math.floor(ctx.sampleRate * 0.12);
    const burstBuf = ctx.createBuffer(1, burstLen, ctx.sampleRate);
    const bData = burstBuf.getChannelData(0);
    for (let i = 0; i < burstLen; i++) {
      bData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.035));
    }
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = burstBuf;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(1900, now);
    noiseFilter.Q.setValueAtTime(2.2, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.07, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    noiseSource.start(now);

    // --- 2. OUTRO ROGER BEEP HELPER ---
    const playRogerBeep = (delayMs: number = 0) => {
      setTimeout(() => {
        try {
          if (!ctx || ctx.state === 'closed') return;
          const rNow = ctx.currentTime;
          const rogerOsc = ctx.createOscillator();
          const rogerGain = ctx.createGain();

          rogerOsc.type = 'sawtooth';
          rogerOsc.frequency.setValueAtTime(1850, rNow);
          rogerOsc.frequency.exponentialRampToValueAtTime(1420, rNow + 0.065);

          const rFilter = ctx.createBiquadFilter();
          rFilter.type = 'bandpass';
          rFilter.frequency.setValueAtTime(1600, rNow);
          rFilter.Q.setValueAtTime(4.0, rNow);

          rogerGain.gain.setValueAtTime(0.08, rNow);
          rogerGain.gain.exponentialRampToValueAtTime(0.001, rNow + 0.07);

          rogerOsc.connect(rFilter);
          rFilter.connect(rogerGain);
          rogerGain.connect(ctx.destination);

          rogerOsc.start(rNow);
          rogerOsc.stop(rNow + 0.08);
        } catch {}
      }, delayMs);
    };

    // --- 3. CUSTOM PIT RADIO AUDIO (Replaces synthetic SpeechSynthesis) ---
    const playRadioVoice = () => {
      if (cachedRadioBuffer) {
        try {
          const voiceSource = ctx.createBufferSource();
          voiceSource.buffer = cachedRadioBuffer;

          const voiceGain = ctx.createGain();
          voiceGain.gain.setValueAtTime(1.0, ctx.currentTime);

          voiceSource.connect(voiceGain);
          voiceGain.connect(ctx.destination);

          voiceSource.onended = () => {
            playRogerBeep(30);
          };

          voiceSource.start(ctx.currentTime);
          return;
        } catch {
          // If buffer playback fails, proceed to HTML5 Audio fallback
        }
      }

      // Fast HTML5 Audio fallback
      try {
        const audioEl = new Audio(PIT_RADIO_AUDIO_PATH);
        audioEl.volume = 1.0;
        audioEl.onended = () => {
          playRogerBeep(30);
        };
        audioEl.onerror = () => {
          playRogerBeep(300);
        };
        audioEl.play().catch(() => {
          playRogerBeep(300);
        });
      } catch {
        playRogerBeep(400);
      }
    };

    if (cachedRadioBuffer) {
      setTimeout(playRadioVoice, 70);
    } else {
      fetch(PIT_RADIO_AUDIO_PATH)
        .then((res) => res.arrayBuffer())
        .then((buf) => ctx.decodeAudioData(buf))
        .then((decoded) => {
          cachedRadioBuffer = decoded;
          playRadioVoice();
        })
        .catch(() => {
          playRadioVoice();
        });
    }
  } catch {
    // Audio context safe fallback
  }
}

const PENALTY_VOICE_AUDIO_PATH = '/audio/penalty_voice.mp3';
let cachedPenaltyVoiceBuffer: AudioBuffer | null = null;
let isPenaltyLoading = false;

export function preloadPenaltyVoiceAudio(): void {
  const ctx = getAudioContext();
  if (!ctx || cachedPenaltyVoiceBuffer || isPenaltyLoading) return;
  isPenaltyLoading = true;
  fetch(PENALTY_VOICE_AUDIO_PATH)
    .then((r) => r.arrayBuffer())
    .then((arr) => ctx.decodeAudioData(arr))
    .then((buf) => {
      cachedPenaltyVoiceBuffer = buf;
    })
    .catch((err) => {
      console.warn('Could not preload penalty voice audio:', err);
    })
    .finally(() => {
      isPenaltyLoading = false;
    });
}

/**
 * Plays the official penalty announcement voice recording (ElevenLabs Martin Osborne)
 * with robust HTML5 Audio and Web Audio fallback layers.
 */
export function playPenaltyVoiceAudio(): void {
  const ctx = getAudioContext();

  try {
    const audioEl = new Audio(PENALTY_VOICE_AUDIO_PATH);
    audioEl.volume = 1.0;
    audioEl.play().catch(() => {
      // Fallback to decoded Web Audio buffer if audio element restricted
      if (ctx && cachedPenaltyVoiceBuffer) {
        try {
          const src = ctx.createBufferSource();
          src.buffer = cachedPenaltyVoiceBuffer;
          const gain = ctx.createGain();
          gain.gain.setValueAtTime(1.0, ctx.currentTime);
          src.connect(gain);
          gain.connect(ctx.destination);
          src.start(ctx.currentTime);
        } catch {}
      }
    });
  } catch {
    if (ctx && cachedPenaltyVoiceBuffer) {
      try {
        const src = ctx.createBufferSource();
        src.buffer = cachedPenaltyVoiceBuffer;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(1.0, ctx.currentTime);
        src.connect(gain);
        gain.connect(ctx.destination);
        src.start(ctx.currentTime);
      } catch {}
    }
  }
}


