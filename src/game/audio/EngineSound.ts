/**
 * EngineSound.ts - Authentic Visceral F1 V10 Competition Powertrain Synthesizer
 *
 * Modeled on the physical acoustics of real 3.0L naturally aspirated F1 V10 racing engines
 * (Ferrari 053/054 & BMW P83/P84 competition blocks):
 * - Massive low-end punch & mechanical authority (ZERO thin, toy-like or buzzer frequencies)
 * - Sub-octave crankshaft mass pulse (2.5x order: 41 Hz to 395 Hz)
 * - 5-cylinder bank combustion pressure wave (5.0x order: 82 Hz to 790 Hz)
 * - Dual exhaust manifold merge collector resonance (10.0x order: 165 Hz to 1185 Hz)
 * - Low-shelf body thump resonance (+11.0 dB at 85 Hz) for chest-rumbling presence
 * - Progressive acoustic lowpass filter strictly tuned (420 Hz idle to 1620 Hz redline)
 *   to eliminate all electronic digital fizz, leaving a thick, terrifying, roaring mechanical beast.
 * - Deep throaty airbox induction growl under throttle (140 Hz to 420 Hz)
 * - Procedural sequential gearshift pneumatic cut & deep exhaust thump
 * - Physical aerodynamic cockpit wind rush & straight-cut transmission whine
 * - 3D Positional & Spatial Audio for the AI Rival car
 */

import { loadAuthenticSkidBuffer } from './skidAudioData';

export interface EngineAudioLayersState {
  base: boolean;
  v12: boolean;
  whistle: boolean;
  intake: boolean;
  engineFilter: boolean;
  dcBlock: boolean;
}

export class EngineSound {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private isEngineSoundEnabled: boolean = true;
  private isInitialized: boolean = false;

  // Master Graph
  private masterGain: GainNode | null = null;
  private masterDcBlocker: BiquadFilterNode | null = null;
  private masterLimiter: DynamicsCompressorNode | null = null;
  private engineBusGain: GainNode | null = null;

  // Player V10 Procedural Synthesis Nodes
  private playerBusGain: GainNode | null = null;
  private playerBodyThumpFilter: BiquadFilterNode | null = null;
  private playerCombustionBus: GainNode | null = null;
  private playerWaveShaper: WaveShaperNode | null = null;
  private playerExhaustResonator: BiquadFilterNode | null = null;
  private playerEngineFilter: BiquadFilterNode | null = null;
  private playerAirboxFilter: BiquadFilterNode | null = null;
  private playerAirboxGain: GainNode | null = null;

  // Player Multiphase Oscillators (Crankshaft Sub-octave, Bank Fundamental, Merge Collector, Airbox)
  private oscPlayerSub: OscillatorNode | null = null;       // 2.5x order crankshaft rotational mass
  private gainPlayerSub: GainNode | null = null;
  private oscPlayerF0: OscillatorNode | null = null;        // 5.0x order cylinder firing series
  private gainPlayerF0: GainNode | null = null;
  private oscPlayerMerge: OscillatorNode | null = null;     // 10.0x order collector merge roar
  private gainPlayerMerge: GainNode | null = null;
  private oscPlayerAirbox: OscillatorNode | null = null;    // Throaty induction growl

  private lastPlayerGear: number = 1;
  private lastShiftTime: number = 0;

  // Aerodynamic Wind Rush Nodes (Filtered Pink Noise)
  private windBuffer: AudioBuffer | null = null;
  private windSource: AudioBufferSourceNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private windGain: GainNode | null = null;

  // Straight-Cut Transmission Gearbox Whine Nodes
  private whineOsc: OscillatorNode | null = null;
  private whineFilter: BiquadFilterNode | null = null;
  private whineGain: GainNode | null = null;

  // AI Rival V10 Procedural Synthesis Nodes (3D Spatial)
  private rivalBusGain: GainNode | null = null;
  private rivalPanner: StereoPannerNode | null = null;
  private rivalCombustionBus: GainNode | null = null;
  private rivalWaveShaper: WaveShaperNode | null = null;
  private rivalBodyThumpFilter: BiquadFilterNode | null = null;
  private rivalExhaustResonator: BiquadFilterNode | null = null;
  private rivalEngineFilter: BiquadFilterNode | null = null;
  private oscRivalSub: OscillatorNode | null = null;
  private gainRivalSub: GainNode | null = null;
  private oscRivalF0: OscillatorNode | null = null;
  private gainRivalF0: GainNode | null = null;
  private oscRivalMerge: OscillatorNode | null = null;
  private gainRivalMerge: GainNode | null = null;
  private lastRivalGear: number = 1;

  // Real-time smoothed telemetry states
  private smoothRpmNorm: number = 0;
  private smoothThrottleNorm: number = 0;
  private lastAudioUpdateTimestamp: number = 0;

  // Tire Skid & Drift Audio
  private bufferSkid: AudioBuffer | null = null;
  private sourceSkid: AudioBufferSourceNode | null = null;
  private skidGain: GainNode | null = null;
  private smoothSlipRatio: number = 0;
  private isSkidLoading: boolean = false;

  // Ancillary Audio Nodes
  private flatTireGain: GainNode | null = null;
  private flatTireFilter: BiquadFilterNode | null = null;
  private flatTireOsc: OscillatorNode | null = null;
  private flatTireThumpGain: GainNode | null = null;
  private lastHadPuncture: boolean = false;
  private crashBuffer: AudioBuffer | null = null;

  // Diagnostic layers compatibility stubs
  private layersState: EngineAudioLayersState = {
    base: true,
    v12: true,
    whistle: true,
    intake: true,
    engineFilter: true,
    dcBlock: true,
  };
  private soloLayer: keyof EngineAudioLayersState | 'all' | 'none' = 'all';

  constructor() {
    // Initialized on first user interaction
  }

  public init(): void {
    if (this.isInitialized && this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      // 1. Master Brickwall Limiter & Sub-audible DC Blocker (Ultra-fast 1ms attack prevents DAC clipping pops)
      this.masterLimiter = this.ctx.createDynamicsCompressor();
      this.masterLimiter.threshold.setValueAtTime(-1.0, this.ctx.currentTime);
      this.masterLimiter.knee.setValueAtTime(3.0, this.ctx.currentTime);
      this.masterLimiter.ratio.setValueAtTime(20.0, this.ctx.currentTime);
      this.masterLimiter.attack.setValueAtTime(0.001, this.ctx.currentTime); // 1ms true brickwall prevents any digital spike
      this.masterLimiter.release.setValueAtTime(0.08, this.ctx.currentTime);

      this.masterDcBlocker = this.ctx.createBiquadFilter();
      this.masterDcBlocker.type = 'highpass';
      this.masterDcBlocker.frequency.setValueAtTime(20.0, this.ctx.currentTime);
      this.masterDcBlocker.Q.setValueAtTime(0.707, this.ctx.currentTime);

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0.0 : 1.0, this.ctx.currentTime);

      this.masterGain.connect(this.masterDcBlocker);
      this.masterDcBlocker.connect(this.masterLimiter);
      this.masterLimiter.connect(this.ctx.destination);

      // 2. Dedicated Engine Bus
      this.engineBusGain = this.ctx.createGain();
      this.engineBusGain.gain.setValueAtTime(this.isEngineSoundEnabled ? 1.0 : 0.0, this.ctx.currentTime);
      this.engineBusGain.connect(this.masterGain);

      // 3. Setup Player F1 V10 Procedural Synthesizer
      this.setupPlayerV10Graph();

      // 4. Setup AI Rival F1 V10 Procedural Synthesizer (with 3D Spatial Panning)
      this.setupRivalV10Graph();

      // 5. Setup Aerodynamic Wind and Transmission Gear Whine
      this.setupWindAndWhineNodes();

      // 6. Setup Tire Skid & Ancillary Nodes
      this.skidGain = this.ctx.createGain();
      this.skidGain.gain.setValueAtTime(0.0000, this.ctx.currentTime);
      this.skidGain.connect(this.masterGain);

      this.setupFlatTireSound();
      this.prebakeCrashBuffer();
      this.loadSkidAudioAsync();

      this.isInitialized = true;
    } catch (e) {
      console.warn('Web Audio could not initialize automatically:', e);
    }
  }

  /**
   * Generates a warm non-linear saturation curve using hyperbolic tangent (tanh).
   * Perfectly smooth, infinitely differentiable (C-infinity), zero sharp corners or clipping edges.
   */
  private createV10DistortionCurve(samples: number = 2048): Float32Array {
    const curve = new Float32Array(samples);
    for (let i = 0; i < samples; ++i) {
      const x = (i * 2) / (samples - 1) - 1;
      // Smooth tanh soft saturation: warms harmonics without digital edge clipping
      curve[i] = Math.tanh(x * 1.35) * 0.85;
    }
    return curve;
  }

  /**
   * Initializes the visceral procedural F1 V10 audio graph for the player
   */
  private setupPlayerV10Graph(): void {
    if (!this.ctx || !this.engineBusGain) return;

    const t = this.ctx.currentTime;

    // Sub-bus for player engine (nominal 0.35 ensures clean 0dBFS headroom after body thump boost)
    this.playerBusGain = this.ctx.createGain();
    this.playerBusGain.gain.setValueAtTime(0.35, t);
    this.playerBusGain.connect(this.engineBusGain);

    // Body Thump Low-Shelf Filter (+3.5 dB boost at 85 Hz ensures visceral weight with pristine headroom)
    this.playerBodyThumpFilter = this.ctx.createBiquadFilter();
    this.playerBodyThumpFilter.type = 'lowshelf';
    this.playerBodyThumpFilter.frequency.setValueAtTime(85, t);
    this.playerBodyThumpFilter.gain.setValueAtTime(3.5, t);
    this.playerBodyThumpFilter.connect(this.playerBusGain);

    // Progressive low-pass filter (STRICTLY CAPPED at 1620 Hz to eliminate all toy-like buzzing)
    this.playerEngineFilter = this.ctx.createBiquadFilter();
    this.playerEngineFilter.type = 'lowpass';
    this.playerEngineFilter.frequency.setValueAtTime(450, t);
    this.playerEngineFilter.Q.setValueAtTime(0.85, t);
    this.playerEngineFilter.connect(this.playerBodyThumpFilter);

    // WaveShaper warm analog saturation
    this.playerWaveShaper = this.ctx.createWaveShaper();
    this.playerWaveShaper.curve = this.createV10DistortionCurve(2048) as unknown as Float32Array<ArrayBuffer>;
    this.playerWaveShaper.oversample = '2x';
    this.playerWaveShaper.connect(this.playerEngineFilter);

    // Exhaust Manifold Formant Resonator (Peaking filter tuned to 380 Hz - 950 Hz merge collector)
    this.playerExhaustResonator = this.ctx.createBiquadFilter();
    this.playerExhaustResonator.type = 'peaking';
    this.playerExhaustResonator.frequency.setValueAtTime(420, t);
    this.playerExhaustResonator.Q.setValueAtTime(1.4, t);
    this.playerExhaustResonator.gain.setValueAtTime(1.8, t);
    this.playerExhaustResonator.connect(this.playerWaveShaper);

    // Combustion Summing Bus (nominal 0.35 delivers warm analog curve without harsh digital square clipping)
    this.playerCombustionBus = this.ctx.createGain();
    this.playerCombustionBus.gain.setValueAtTime(0.35, t);
    this.playerCombustionBus.connect(this.playerExhaustResonator);

    // Airbox Induction Bandpass Filter (Deep throaty muscular growl: 160 Hz - 420 Hz)
    this.playerAirboxFilter = this.ctx.createBiquadFilter();
    this.playerAirboxFilter.type = 'bandpass';
    this.playerAirboxFilter.frequency.setValueAtTime(220, t);
    this.playerAirboxFilter.Q.setValueAtTime(1.4, t);

    this.playerAirboxGain = this.ctx.createGain();
    this.playerAirboxGain.gain.setValueAtTime(0.0, t);
    this.playerAirboxFilter.connect(this.playerAirboxGain);
    this.playerAirboxGain.connect(this.playerBusGain);

    // --- OSCILLATOR BANK (Visceral F1 V10 Additive Synthesis) ---
    // 1. Sub-Octave 2.5x Order (Crankshaft mechanical rotational mass: 41 Hz at idle -> 395 Hz at redline)
    // Delivers deep, menacing, gut-punching bass authority
    this.oscPlayerSub = this.ctx.createOscillator();
    this.oscPlayerSub.type = 'triangle';
    this.oscPlayerSub.frequency.setValueAtTime(41.6, t);

    this.gainPlayerSub = this.ctx.createGain();
    this.gainPlayerSub.gain.setValueAtTime(0.48, t);
    this.oscPlayerSub.connect(this.gainPlayerSub);
    this.gainPlayerSub.connect(this.playerCombustionBus);
    this.oscPlayerSub.start(0);

    // 2. Fundamental 5.0x Order (5-cylinder bank firing series: 83.3 Hz at idle -> 791.7 Hz at redline)
    this.oscPlayerF0 = this.ctx.createOscillator();
    this.oscPlayerF0.type = 'sawtooth';
    this.oscPlayerF0.frequency.setValueAtTime(83.3, t);

    this.gainPlayerF0 = this.ctx.createGain();
    this.gainPlayerF0.gain.setValueAtTime(0.42, t);
    this.oscPlayerF0.connect(this.gainPlayerF0);
    this.gainPlayerF0.connect(this.playerCombustionBus);
    this.oscPlayerF0.start(0);

    // 3. Merge Collector 10.0x Order (Dual 5-in-1 merge collector resonance: 166.7 Hz -> 1180 Hz)
    this.oscPlayerMerge = this.ctx.createOscillator();
    this.oscPlayerMerge.type = 'sawtooth';
    this.oscPlayerMerge.frequency.setValueAtTime(166.7, t);

    this.gainPlayerMerge = this.ctx.createGain();
    this.gainPlayerMerge.gain.setValueAtTime(0.24, t);
    this.oscPlayerMerge.connect(this.gainPlayerMerge);
    this.gainPlayerMerge.connect(this.playerCombustionBus);
    this.oscPlayerMerge.start(0);

    // 4. Airbox Induction Oscillator (Muscular low-mid intake bark)
    this.oscPlayerAirbox = this.ctx.createOscillator();
    this.oscPlayerAirbox.type = 'sawtooth';
    this.oscPlayerAirbox.frequency.setValueAtTime(83.3, t);
    this.oscPlayerAirbox.connect(this.playerAirboxFilter);
    this.oscPlayerAirbox.start(0);
  }

  /**
   * Initializes the procedural F1 V10 audio graph for the AI Rival with 3D Spatial Panning
   */
  private setupRivalV10Graph(): void {
    if (!this.ctx || !this.engineBusGain) return;

    const t = this.ctx.currentTime;

    this.rivalBusGain = this.ctx.createGain();
    this.rivalBusGain.gain.setValueAtTime(0.0, t);

    this.rivalPanner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    if (this.rivalPanner) {
      this.rivalBusGain.connect(this.rivalPanner);
      this.rivalPanner.connect(this.engineBusGain);
    } else {
      this.rivalBusGain.connect(this.engineBusGain);
    }

    this.rivalBodyThumpFilter = this.ctx.createBiquadFilter();
    this.rivalBodyThumpFilter.type = 'lowshelf';
    this.rivalBodyThumpFilter.frequency.setValueAtTime(85, t);
    this.rivalBodyThumpFilter.gain.setValueAtTime(7.0, t);
    this.rivalBodyThumpFilter.connect(this.rivalBusGain);

    this.rivalEngineFilter = this.ctx.createBiquadFilter();
    this.rivalEngineFilter.type = 'lowpass';
    this.rivalEngineFilter.frequency.setValueAtTime(450, t);
    this.rivalEngineFilter.Q.setValueAtTime(0.85, t);
    this.rivalEngineFilter.connect(this.rivalBodyThumpFilter);

    this.rivalWaveShaper = this.ctx.createWaveShaper();
    this.rivalWaveShaper.curve = this.createV10DistortionCurve(2048) as unknown as Float32Array<ArrayBuffer>;
    this.rivalWaveShaper.oversample = '2x';
    this.rivalWaveShaper.connect(this.rivalEngineFilter);

    this.rivalExhaustResonator = this.ctx.createBiquadFilter();
    this.rivalExhaustResonator.type = 'peaking';
    this.rivalExhaustResonator.frequency.setValueAtTime(420, t);
    this.rivalExhaustResonator.Q.setValueAtTime(1.4, t);
    this.rivalExhaustResonator.gain.setValueAtTime(1.8, t);
    this.rivalExhaustResonator.connect(this.rivalWaveShaper);

    this.rivalCombustionBus = this.ctx.createGain();
    this.rivalCombustionBus.gain.setValueAtTime(0.35, t);
    this.rivalCombustionBus.connect(this.rivalExhaustResonator);

    this.oscRivalSub = this.ctx.createOscillator();
    this.oscRivalSub.type = 'triangle';
    this.oscRivalSub.frequency.setValueAtTime(41.6, t);
    this.gainRivalSub = this.ctx.createGain();
    this.gainRivalSub.gain.setValueAtTime(0.45, t);
    this.oscRivalSub.connect(this.gainRivalSub);
    this.gainRivalSub.connect(this.rivalCombustionBus);
    this.oscRivalSub.start(0);

    this.oscRivalF0 = this.ctx.createOscillator();
    this.oscRivalF0.type = 'sawtooth';
    this.oscRivalF0.frequency.setValueAtTime(83.3, t);
    this.gainRivalF0 = this.ctx.createGain();
    this.gainRivalF0.gain.setValueAtTime(0.40, t);
    this.oscRivalF0.connect(this.gainRivalF0);
    this.gainRivalF0.connect(this.rivalCombustionBus);
    this.oscRivalF0.start(0);

    this.oscRivalMerge = this.ctx.createOscillator();
    this.oscRivalMerge.type = 'sawtooth';
    this.oscRivalMerge.frequency.setValueAtTime(166.7, t);
    this.gainRivalMerge = this.ctx.createGain();
    this.gainRivalMerge.gain.setValueAtTime(0.22, t);
    this.oscRivalMerge.connect(this.gainRivalMerge);
    this.gainRivalMerge.connect(this.rivalCombustionBus);
    this.oscRivalMerge.start(0);
  }

  /**
   * Generates seamless stereo pink noise buffer for physical aerodynamic wind simulation
   */
  private createPinkNoiseBuffer(ctx: AudioContext, durationSeconds: number = 2.0): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const numSamples = Math.floor(sampleRate * durationSeconds);
    const buffer = ctx.createBuffer(2, numSamples, sampleRate);
    const fadeLen = 1024;
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < numSamples; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.045;
        b6 = white * 0.115926;
      }
      // Seamless crossfade across the loop boundary to guarantee zero click
      for (let i = 0; i < fadeLen; i++) {
        const factor = i / fadeLen;
        const endSample = data[numSamples - fadeLen + i];
        data[i] = data[i] * factor + endSample * (1 - factor);
      }
    }
    return buffer;
  }

  private setupWindAndWhineNodes(): void {
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;

    // 1. Aerodynamic Wind Rush Node
    this.windBuffer = this.createPinkNoiseBuffer(this.ctx);
    this.windSource = this.ctx.createBufferSource();
    this.windSource.buffer = this.windBuffer;
    this.windSource.loop = true;

    this.windFilter = this.ctx.createBiquadFilter();
    this.windFilter.type = 'lowpass';
    this.windFilter.frequency.setValueAtTime(320, t);
    this.windFilter.Q.setValueAtTime(0.707, t);

    this.windGain = this.ctx.createGain();
    this.windGain.gain.setValueAtTime(0.0, t);

    this.windSource.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.masterGain);
    this.windSource.start(0);

    // 2. Straight-Cut Transmission Gearbox Whine Node (Gentle mechanical overtone)
    this.whineOsc = this.ctx.createOscillator();
    this.whineOsc.type = 'triangle';
    this.whineOsc.frequency.setValueAtTime(260, t);

    this.whineFilter = this.ctx.createBiquadFilter();
    this.whineFilter.type = 'bandpass';
    this.whineFilter.frequency.setValueAtTime(700, t);
    this.whineFilter.Q.setValueAtTime(2.0, t);

    this.whineGain = this.ctx.createGain();
    this.whineGain.gain.setValueAtTime(0.0, t);

    this.whineOsc.connect(this.whineFilter);
    this.whineFilter.connect(this.whineGain);
    this.whineGain.connect(this.masterGain);
    this.whineOsc.start(0);
  }

  /**
   * Seamless gear shifts matching authentic F1 V10 competition transmissions.
   * Eliminates artificial pop oscillators and gain interruptions (zero electric clicks or pops).
   * Engine pitch transitions naturally and seamlessly with physical RPM response.
   */
  public triggerGearShift(_volume: number = 0.55): void {
    if (!this.isInitialized || !this.ctx || this.isMuted || !this.isEngineSoundEnabled) return;
    this.lastShiftTime = this.ctx.currentTime;
  }

  public triggerRivalGearShift(_volume: number = 0.45): void {
    if (!this.isInitialized || !this.ctx || this.isMuted || !this.isEngineSoundEnabled) return;
  }

  private prebakeCrashBuffer(): void {
    if (!this.ctx) return;
    const crSize = Math.floor(this.ctx.sampleRate * 0.4);
    this.crashBuffer = this.ctx.createBuffer(1, crSize, this.ctx.sampleRate);
    const crData = this.crashBuffer.getChannelData(0);
    for (let i = 0; i < crSize; i++) {
      crData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.08));
    }
  }

  private async loadSkidAudioAsync(): Promise<void> {
    if (!this.ctx || this.isSkidLoading) return;
    this.isSkidLoading = true;
    try {
      this.bufferSkid = await loadAuthenticSkidBuffer(this.ctx);
      this.setupSkidSourceNode();
    } catch (err) {
      console.warn('Could not load authentic skid buffer:', err);
    } finally {
      this.isSkidLoading = false;
    }
  }

  private setupSkidSourceNode(): void {
    if (!this.ctx || !this.bufferSkid) return;
    if (this.sourceSkid) {
      try { this.sourceSkid.stop(); this.sourceSkid.disconnect(); } catch {}
      this.sourceSkid = null;
    }

    this.sourceSkid = this.ctx.createBufferSource();
    this.sourceSkid.buffer = this.bufferSkid;
    this.sourceSkid.loop = true;
    this.sourceSkid.playbackRate.setValueAtTime(1.0, this.ctx.currentTime);

    if (!this.skidGain) {
      this.skidGain = this.ctx.createGain();
      this.skidGain.gain.setValueAtTime(0.0000, this.ctx.currentTime);
      if (this.masterGain) {
        this.skidGain.connect(this.masterGain);
      }
    }

    this.sourceSkid.connect(this.skidGain);
    this.sourceSkid.start(0);
  }

  public resume(): void {
    if (!this.isInitialized) {
      this.init();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (this.engineBusGain && this.ctx) {
      try {
        this.engineBusGain.gain.setValueAtTime(this.isEngineSoundEnabled ? 1.0 : 0.0, this.ctx.currentTime);
      } catch {}
    }
  }

  /**
   * Main audio frame update for the Player Car (Visceral Competition V10 Synthesis)
   */
  public update(
    rpm: number,
    throttle: number,
    slipRatio: number,
    speedMs: number,
    _engineHealth: number = 1.0,
    isDrifting: boolean = false,
    gear: number = 1,
    isBraking: boolean = false
  ): void {
    if (!this.isInitialized || !this.ctx || this.isMuted || !this.isEngineSoundEnabled) return;

    const now = performance.now();
    const currentTime = this.ctx.currentTime;
    const speedKmh = speedMs * 3.6;

    // Check gear change event for crisp mechanical snap
    const currentGear = Math.max(1, Math.min(6, gear || 1));
    if (currentGear !== this.lastPlayerGear) {
      this.triggerGearShift(0.55);
      this.lastPlayerGear = currentGear;
    }

    const targetRpmNorm = Math.min(1.0, Math.max(0.0, (rpm - 1000) / (9500 - 1000)));
    const targetThrottleNorm = Math.min(1.0, Math.max(0.0, throttle));

    if (this.lastAudioUpdateTimestamp === 0) {
      this.lastAudioUpdateTimestamp = now;
      this.smoothRpmNorm = targetRpmNorm;
      this.smoothThrottleNorm = targetThrottleNorm;
    }

    const dt = Math.min(0.05, Math.max(0.001, (now - this.lastAudioUpdateTimestamp) * 0.001));
    this.lastAudioUpdateTimestamp = now;

    // Smooth physics telemetry inputs (24 Hz response rate)
    const alpha = 1.0 - Math.exp(-24.0 * dt);
    this.smoothRpmNorm += (targetRpmNorm - this.smoothRpmNorm) * alpha;
    this.smoothThrottleNorm += (targetThrottleNorm - this.smoothThrottleNorm) * alpha;

    const effectiveRpm = this.smoothRpmNorm;
    const effectiveThrottle = this.smoothThrottleNorm;

    // =========================================================================
    // 1. VISCERAL F1 V10 FREQUENCY SYNTHESIS (Warm, Deep, Muscular Roar)
    // =========================================================================
    // Physical Engine Order Frequencies:
    // Base RPM: 1000 RPM idle to 9500 RPM redline
    // Crankshaft Sub-octave: (RPM / 60) * 2.5  ->  41.6 Hz (idle) to 395 Hz (redline)
    // Bank Fundamental:      (RPM / 60) * 5.0  ->  83.3 Hz (idle) to 791 Hz (redline)
    // Merge Collector:       (RPM / 60) * 7.5  -> 125.0 Hz (idle) to 1187 Hz (redline)
    const physicalRpm = 1000 + effectiveRpm * 8500;

    // Gear scaling is kept realistic and subtle (0.96x in 1st up to 1.12x in 6th):
    // Preserves the deep authentic roar without ever turning into an ear-piercing toy!
    const gearMultipliers = [0.96, 0.99, 1.02, 1.05, 1.08, 1.12];
    const gearFactor = gearMultipliers[currentGear - 1] || 1.00;

    const fSub = (physicalRpm / 60) * 2.5 * gearFactor;   // Deep chest-thumping sub-bass
    const f0 = (physicalRpm / 60) * 5.0 * gearFactor;     // Muscular bank fundamental
    const fMerge = (physicalRpm / 60) * 7.5 * gearFactor; // Warm exhaust collector resonance

    const schedTime = currentTime;

    // Apply oscillator frequencies smoothly (eliminates micro-clicks and zipper artifacts)
    if (this.oscPlayerSub) {
      this.oscPlayerSub.frequency.setTargetAtTime(fSub, schedTime, 0.024);
    }
    if (this.oscPlayerF0) {
      this.oscPlayerF0.frequency.setTargetAtTime(f0, schedTime, 0.024);
    }
    if (this.oscPlayerMerge) {
      this.oscPlayerMerge.frequency.setTargetAtTime(fMerge, schedTime, 0.024);
    }
    if (this.oscPlayerAirbox) {
      this.oscPlayerAirbox.frequency.setTargetAtTime(fSub * 1.5, schedTime, 0.024);
    }

    // =========================================================================
    // 2. EXHAUST RESONANCE & STRICT ACOUSTIC LOWPASS (Zero Toy Buzzer)
    // =========================================================================
    // Exhaust collector resonator sweeps warmly between 380 Hz and 920 Hz
    const exhaustFreq = 380 + Math.pow(effectiveRpm, 1.10) * 540;
    if (this.playerExhaustResonator) {
      this.playerExhaustResonator.frequency.setTargetAtTime(exhaustFreq, schedTime, 0.025);
    }

    // Progressive lowpass filter:
    // Capped at 1580 Hz (strictly rolls off digital fizz/mosquito frequencies!)
    // Idle: 420 Hz (warm, deep, rhythmic idle)
    // Redline: 1580 Hz (thick, menacing, guttural competition roar)
    const filterFreq = 420 + Math.pow(effectiveRpm, 1.15) * 1020 + effectiveThrottle * 140;
    if (this.playerEngineFilter) {
      this.playerEngineFilter.frequency.setTargetAtTime(filterFreq, schedTime, 0.025);
    }

    // =========================================================================
    // 3. MULTI-HARMONIC BALANCE (Chest-Thumping Weight & Throaty Authority)
    // =========================================================================
    // Sub-bass stays loud and prominent throughout the entire rev range!
    const subVol = 0.52 + effectiveThrottle * 0.15;
    const f0Vol = 0.44 + effectiveRpm * 0.12;
    const mergeVol = 0.18 + Math.pow(effectiveRpm, 1.20) * 0.18;

    if (this.gainPlayerSub) this.gainPlayerSub.gain.setTargetAtTime(subVol, schedTime, 0.025);
    if (this.gainPlayerF0) this.gainPlayerF0.gain.setTargetAtTime(f0Vol, schedTime, 0.025);
    if (this.gainPlayerMerge) this.gainPlayerMerge.gain.setTargetAtTime(mergeVol, schedTime, 0.025);

    // Airbox induction throat growl under throttle (thick muscular induction bark)
    if (this.playerAirboxGain && this.playerAirboxFilter) {
      const airboxVol = Math.pow(effectiveThrottle, 1.20) * 0.42;
      const airboxFreq = 160 + effectiveRpm * 240;
      this.playerAirboxGain.gain.setTargetAtTime(airboxVol, schedTime, 0.030);
      this.playerAirboxFilter.frequency.setTargetAtTime(airboxFreq, schedTime, 0.030);
    }

    // =========================================================================
    // 4. OVERALL VOLUME DYNAMICS (Acceleration vs Overrun Deceleration)
    // =========================================================================
    let targetMasterEngineVol = 0.35;
    if (speedKmh < 3.0 && effectiveThrottle < 0.05) {
      // Clean, deep, rhythmic idle throb at 1000 RPM (ZERO ghost acceleration while stopped!)
      targetMasterEngineVol = 0.30;
    } else if (effectiveThrottle > 0.08) {
      // Under full throttle acceleration: immense acoustic presence
      const throttleCurve = Math.pow(effectiveThrottle, 1.20);
      targetMasterEngineVol = 0.42 + throttleCurve * 0.28 + effectiveRpm * 0.10;
    } else {
      // Off-throttle overrun / engine braking decrescendo
      const brakeDrop = isBraking ? 0.06 : 0.0;
      targetMasterEngineVol = Math.max(0.20, 0.26 + effectiveRpm * 0.20 - brakeDrop);
    }

    if (this.playerCombustionBus) {
      this.playerCombustionBus.gain.setTargetAtTime(this.isEngineSoundEnabled ? targetMasterEngineVol : 0.0, schedTime, 0.025);
    }

    // =========================================================================
    // 5. DYNAMIC AERODYNAMIC WIND RUSH
    // =========================================================================
    if (this.windGain && this.windFilter) {
      let targetWindVol = 0.0;
      let targetWindFreq = 300;
      if (speedKmh > 75.0) {
        const windNorm = Math.min(1.0, (speedKmh - 75.0) / 240.0);
        targetWindVol = Math.pow(windNorm, 1.35) * 0.35;
        targetWindFreq = 320 + Math.pow(windNorm, 1.15) * 720; // 320 Hz -> 1040 Hz
      }
      this.windGain.gain.setTargetAtTime(this.isEngineSoundEnabled ? targetWindVol : 0.0, schedTime, 0.040);
      this.windFilter.frequency.setTargetAtTime(targetWindFreq, schedTime, 0.040);
    }

    // =========================================================================
    // 6. STRAIGHT-CUT TRANSMISSION GEARBOX WHINE (Gentle Mechanical Whine)
    // =========================================================================
    if (this.whineGain && this.whineOsc && this.whineFilter) {
      let targetWhineVol = 0.0;
      let targetWhineFreq = 260;
      if (speedKmh > 35.0) {
        const whineSpeedNorm = Math.min(1.0, (speedKmh - 35.0) / 285.0);
        targetWhineFreq = 280 + speedKmh * 5.8; // Lower, warmer whine frequency
        const loadBoost = effectiveThrottle > 0.08 ? 1.0 : 0.55;
        targetWhineVol = Math.pow(whineSpeedNorm, 1.35) * 0.12 * loadBoost;
      }
      this.whineGain.gain.setTargetAtTime(this.isEngineSoundEnabled ? targetWhineVol : 0.0, schedTime, 0.035);
      this.whineOsc.frequency.setTargetAtTime(targetWhineFreq, schedTime, 0.030);
      this.whineFilter.frequency.setTargetAtTime(targetWhineFreq, schedTime, 0.030);
    }

    // =========================================================================
    // 7. TIRE SKID & DRIFT SOUND MODULATION
    // =========================================================================
    const effectiveSlip = Math.max(slipRatio, isDrifting ? 0.45 : 0.0);
    const slipAlpha = 1.0 - Math.exp(-22.0 * dt);
    this.smoothSlipRatio += (effectiveSlip - this.smoothSlipRatio) * slipAlpha;

    if (this.skidGain) {
      let targetSkidVol = 0.0;
      let targetSkidPitch = 1.0;

      if (this.smoothSlipRatio > 0.10 && speedMs > 2.0) {
        const slipIntensity = Math.min(1.0, (this.smoothSlipRatio - 0.10) / 0.40);
        const speedIntensity = Math.min(1.0, (speedMs - 2.0) / 7.0);

        targetSkidVol = Math.pow(slipIntensity, 1.10) * speedIntensity * 0.68;
        targetSkidPitch = 0.95 + 0.08 * slipIntensity;
      }

      this.skidGain.gain.setTargetAtTime(targetSkidVol, schedTime, 0.028);
      if (this.sourceSkid) {
        this.sourceSkid.playbackRate.setTargetAtTime(targetSkidPitch, schedTime, 0.028);
      }
    }
  }

  /**
   * 3D Spatial Audio Update for AI Rival Car (Visceral Competition V10 Synthesis)
   */
  public updateRival(
    rivalPos: { x: number; y: number; z: number },
    playerPos: { x: number; y: number; z: number },
    playerYaw: number,
    rivalRpm: number,
    rivalGear: number = 1,
    rivalSpeedMs: number = 0
  ): void {
    if (!this.isInitialized || !this.ctx || !this.rivalBusGain || !this.isEngineSoundEnabled || this.isMuted) return;

    const dx = rivalPos.x - playerPos.x;
    const dz = rivalPos.z - playerPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const rivalSpeedKmh = rivalSpeedMs * 3.6;

    const maxAudibleDist = 95.0; // Audible range in meters
    const currentTime = this.ctx.currentTime;
    const schedTime = currentTime;

    if (dist > maxAudibleDist) {
      this.rivalBusGain.gain.setTargetAtTime(0.0, schedTime, 0.05);
      return;
    }

    // Quadratic distance attenuation for natural acoustic falloff
    const normDist = dist / maxAudibleDist;
    const distAtten = (1.0 - normDist) * (1.0 - normDist);
    const masterRivalVol = distAtten * 0.35;
    this.rivalBusGain.gain.setTargetAtTime(masterRivalVol, schedTime, 0.035);

    // 3D Stereo Panning relative to player vehicle's yaw orientation
    if (this.rivalPanner) {
      const rightX = Math.cos(playerYaw);
      const rightZ = -Math.sin(playerYaw);
      const dotRight = (dx * rightX + dz * rightZ) / Math.max(1.0, dist);
      const pan = Math.max(-1.0, Math.min(1.0, dotRight * 1.45));
      this.rivalPanner.pan.setTargetAtTime(pan, schedTime, 0.035);
    }

    // Rival gear shift trigger
    const currentRivalGear = Math.max(1, Math.min(6, rivalGear || 1));
    if (currentRivalGear !== this.lastRivalGear) {
      this.triggerRivalGearShift(0.45);
      this.lastRivalGear = currentRivalGear;
    }

    const rivalRpmNorm = Math.min(1.0, Math.max(0.0, (rivalRpm - 1000) / (9500 - 1000)));
    const physicalRivalRpm = 1000 + rivalRpmNorm * 8500;

    const gearMultipliers = [0.96, 0.99, 1.02, 1.05, 1.08, 1.12];
    const rGearFactor = gearMultipliers[currentRivalGear - 1] || 1.00;

    const rSub = (physicalRivalRpm / 60) * 2.5 * rGearFactor;
    const rFund = (physicalRivalRpm / 60) * 5.0 * rGearFactor;
    const rMerge = (physicalRivalRpm / 60) * 7.5 * rGearFactor;

    if (this.oscRivalSub) this.oscRivalSub.frequency.setTargetAtTime(rSub, schedTime, 0.024);
    if (this.oscRivalF0) this.oscRivalF0.frequency.setTargetAtTime(rFund, schedTime, 0.024);
    if (this.oscRivalMerge) this.oscRivalMerge.frequency.setTargetAtTime(rMerge, schedTime, 0.024);

    if (this.rivalExhaustResonator) {
      const rExhaustFreq = 380 + Math.pow(rivalRpmNorm, 1.10) * 540;
      this.rivalExhaustResonator.frequency.setTargetAtTime(rExhaustFreq, schedTime, 0.030);
    }

    if (this.rivalEngineFilter) {
      const rFilterFreq = 420 + Math.pow(rivalRpmNorm, 1.15) * 1020;
      this.rivalEngineFilter.frequency.setTargetAtTime(rFilterFreq, schedTime, 0.030);
    }
  }

  public triggerBackfire(_isHighRpm: boolean = false): void {
    return;
  }

  public updateScrape(_intensity: number, _speedKmh: number): void {
    return;
  }

  public triggerCrash(impactForce: number): void {
    if (!this.isInitialized || !this.ctx || this.isMuted || !this.masterGain) return;

    const t = this.ctx.currentTime;
    const normalizedForce = Math.min(1.0, Math.max(0.1, impactForce / 35));

    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.35);

    const oscGain = this.ctx.createGain();
    oscGain.gain.setValueAtTime(0.001, t);
    oscGain.gain.linearRampToValueAtTime(normalizedForce * 0.7, t + 0.005);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.4);

    if (this.crashBuffer) {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.crashBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(800, t);
      filter.Q.setValueAtTime(2.0, t);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.001, t);
      noiseGain.gain.linearRampToValueAtTime(normalizedForce * 0.8, t + 0.005);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.masterGain);

      noise.start(t);
      noise.stop(t + 0.4);
    }
  }

  public triggerTireBlowout(): void {
    if (!this.isInitialized || !this.ctx || this.isMuted || !this.masterGain) return;
    const t = this.ctx.currentTime;
    const pulseCount = 6;
    for (let p = 0; p < pulseCount; p++) {
      const pt = t + p * 0.038;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(1400 + Math.random() * 400, pt);
      osc.frequency.exponentialRampToValueAtTime(350, pt + 0.03);

      gain.gain.setValueAtTime(0.001, pt);
      gain.gain.linearRampToValueAtTime(0.22, pt + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.001, pt + 0.035);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(pt);
      osc.stop(pt + 0.04);
    }
  }

  private setupFlatTireSound(): void {
    if (!this.ctx || !this.masterGain) return;

    this.flatTireFilter = this.ctx.createBiquadFilter();
    this.flatTireFilter.type = 'bandpass';
    this.flatTireFilter.frequency.setValueAtTime(450, this.ctx.currentTime);
    this.flatTireFilter.Q.setValueAtTime(2.5, this.ctx.currentTime);

    this.flatTireGain = this.ctx.createGain();
    this.flatTireGain.gain.setValueAtTime(0, this.ctx.currentTime);
    this.flatTireFilter.connect(this.flatTireGain);
    this.flatTireGain.connect(this.masterGain);

    this.flatTireThumpGain = this.ctx.createGain();
    this.flatTireThumpGain.gain.setValueAtTime(0, this.ctx.currentTime);
    this.flatTireThumpGain.connect(this.masterGain);
  }

  public updateFlatTireSound(hasPuncture: boolean, speedMs: number): void {
    if (!this.isInitialized || !this.ctx || this.isMuted) return;
    if (!hasPuncture && !this.lastHadPuncture) return;
    this.lastHadPuncture = hasPuncture;

    const t = this.ctx.currentTime;
    const safeTime = t + 0.015;
    const speedKmh = speedMs * 3.6;

    if (hasPuncture && speedKmh > 2.0) {
      if (!this.flatTireOsc && this.ctx) {
        this.flatTireOsc = this.ctx.createOscillator();
        this.flatTireOsc.type = 'sawtooth';
        this.flatTireOsc.frequency.setValueAtTime(14, safeTime);
        const thumpFilter = this.ctx.createBiquadFilter();
        thumpFilter.type = 'lowpass';
        thumpFilter.frequency.setValueAtTime(160, safeTime);
        this.flatTireOsc.connect(thumpFilter);
        if (this.flatTireThumpGain) thumpFilter.connect(this.flatTireThumpGain);
        this.flatTireOsc.start();
      }

      const flapFreq = Math.max(3, Math.min(35, speedMs * 2.8));
      const targetGain = Math.min(0.65, 0.15 + (speedKmh / 50.0) * 0.45);

      if (this.flatTireOsc) {
        this.flatTireOsc.frequency.linearRampToValueAtTime(flapFreq, safeTime);
      }
      if (this.flatTireThumpGain) {
        this.flatTireThumpGain.gain.linearRampToValueAtTime(targetGain, safeTime);
      }
    } else {
      if (this.flatTireThumpGain) {
        this.flatTireThumpGain.gain.linearRampToValueAtTime(0, safeTime);
      }
    }
  }

  public triggerPitChime(): void {
    if (!this.isInitialized || !this.ctx || this.isMuted) return;

    const notes = [523.25, 659.25, 783.99, 1046.5];
    const t = this.ctx.currentTime;

    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + idx * 0.08);

      gain.gain.setValueAtTime(0.001, t + idx * 0.08);
      gain.gain.linearRampToValueAtTime(0.2, t + idx * 0.08 + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.08 + 0.25);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t + idx * 0.08);
      osc.stop(t + idx * 0.08 + 0.3);
    });
  }

  public triggerPitRadio(_cue: 'box' | 'tyres' | 'go' | 'puncture'): void {
    return;
  }

  /**
   * FIA Stewards Penalty Alert Tone (Distinct two-tone authoritative chime: 880Hz -> 659.25Hz)
   */
  public triggerPenaltyAlertTone(): void {
    if (!this.isInitialized || !this.ctx || this.isMuted || !this.masterGain) return;
    const t = this.ctx.currentTime;

    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, t);
    gain1.gain.setValueAtTime(0.001, t);
    gain1.gain.linearRampToValueAtTime(0.30, t + 0.015);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc1.connect(gain1);
    gain1.connect(this.masterGain);
    osc1.start(t);
    osc1.stop(t + 0.20);

    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(659.25, t + 0.14);
    gain2.gain.setValueAtTime(0.001, t + 0.14);
    gain2.gain.linearRampToValueAtTime(0.35, t + 0.155);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
    osc2.connect(gain2);
    gain2.connect(this.masterGain);
    osc2.start(t + 0.14);
    osc2.stop(t + 0.45);
  }

  public triggerPneumaticJack(_isUp: boolean): void {
    if (!this.isInitialized || !this.ctx || this.isMuted || !this.masterGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(_isUp ? 280 : 210, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.18);
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.18, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.20);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.22);
  }

  public triggerWheelGunRattle(): void {
    if (!this.isInitialized || !this.ctx || this.isMuted || !this.masterGain) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 4; i++) {
      const pt = t + i * 0.028;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(650 + Math.random() * 200, pt);
      osc.frequency.exponentialRampToValueAtTime(180, pt + 0.024);
      gain.gain.setValueAtTime(0.001, pt);
      gain.gain.linearRampToValueAtTime(0.20, pt + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.001, pt + 0.025);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(pt);
      osc.stop(pt + 0.028);
    }
  }

  public isEngineSoundOn(): boolean {
    return this.isEngineSoundEnabled;
  }

  public setEngineSoundEnabled(enabled: boolean): void {
    this.isEngineSoundEnabled = enabled;
    if (this.ctx && this.engineBusGain) {
      const t = this.ctx.currentTime;
      this.engineBusGain.gain.setTargetAtTime(enabled ? 1.0 : 0.0, t + 0.005, 0.020);

      if (!enabled) {
        if (this.playerBusGain) this.playerBusGain.gain.setTargetAtTime(0.0, t, 0.020);
        if (this.rivalBusGain) this.rivalBusGain.gain.setTargetAtTime(0.0, t, 0.020);
        if (this.skidGain) this.skidGain.gain.setTargetAtTime(0.0, t, 0.020);
        if (this.windGain) this.windGain.gain.setTargetAtTime(0.0, t, 0.020);
        if (this.whineGain) this.whineGain.gain.setTargetAtTime(0.0, t, 0.020);
      } else {
        if (this.playerBusGain) this.playerBusGain.gain.setTargetAtTime(0.35, t, 0.020);
      }
    }
  }

  public toggleEngineSound(): boolean {
    this.setEngineSoundEnabled(!this.isEngineSoundEnabled);
    return this.isEngineSoundEnabled;
  }

  // --- DIAGNOSTICS & LAYERS COMPATIBILITY ---
  public getLayersState(): EngineAudioLayersState {
    return { ...this.layersState };
  }

  public getSoloLayer(): keyof EngineAudioLayersState | 'all' | 'none' {
    return this.soloLayer;
  }

  public setSoloLayer(layer: keyof EngineAudioLayersState | 'all' | 'none'): void {
    this.soloLayer = layer;
    if (!this.isEngineSoundEnabled) {
      this.setEngineSoundEnabled(true);
    }
  }

  public toggleLayer(_layer: keyof EngineAudioLayersState): void {
    this.soloLayer = 'none';
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.masterGain.gain.linearRampToValueAtTime(this.isMuted ? 0 : 1.0, this.ctx.currentTime + 0.020);
    }
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public pause(): void {
    if (this.engineBusGain && this.ctx) {
      try {
        this.engineBusGain.gain.setValueAtTime(0.0, this.ctx.currentTime);
      } catch {}
    }
    if (this.ctx && this.ctx.state === 'running') {
      this.ctx.suspend().catch(() => {});
    }
  }

  public dispose(): void {
    try {
      this.oscPlayerSub?.stop(); this.oscPlayerSub?.disconnect();
      this.oscPlayerF0?.stop(); this.oscPlayerF0?.disconnect();
      this.oscPlayerMerge?.stop(); this.oscPlayerMerge?.disconnect();
      this.oscPlayerAirbox?.stop(); this.oscPlayerAirbox?.disconnect();
      this.oscRivalSub?.stop(); this.oscRivalSub?.disconnect();
      this.oscRivalF0?.stop(); this.oscRivalF0?.disconnect();
      this.oscRivalMerge?.stop(); this.oscRivalMerge?.disconnect();
      this.windSource?.stop(); this.windSource?.disconnect();
      this.whineOsc?.stop(); this.whineOsc?.disconnect();
      this.sourceSkid?.stop(); this.sourceSkid?.disconnect();
      this.skidGain?.disconnect();
      this.windGain?.disconnect();
      this.whineGain?.disconnect();
      this.flatTireOsc?.stop(); this.flatTireOsc?.disconnect();
      this.playerBodyThumpFilter?.disconnect();
      this.playerBusGain?.disconnect();
      this.rivalBodyThumpFilter?.disconnect();
      this.rivalBusGain?.disconnect();
      this.engineBusGain?.disconnect();
      this.masterGain?.disconnect();
      this.masterDcBlocker?.disconnect();
      this.masterLimiter?.disconnect();
    } catch {}

    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
    this.isInitialized = false;
  }
}
