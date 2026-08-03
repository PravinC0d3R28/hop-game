import { GAME_CONFIG } from '../config/GameConfig';

/**
 * Procedural Web Audio. Faithful port of the original `Ln`, `ZM`, `JM`, `KM`, `$M`.
 */
export class AudioSystem {
  private ctx: AudioContext | null = null;

  /** When the last mission chime rang — used to swallow rapid repeats from a completion batch. */
  private lastMissionChimeAt = Number.NEGATIVE_INFINITY;
  /** Minimum gap between mission chimes; a batch of completions rings at most every 1.8s. */
  private static readonly MISSION_CHIME_MIN_GAP_MS = 1800;

  private ensureContext(): AudioContext | null {
    if (!this.ctx) {
      if (typeof window === 'undefined') return null;
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (Ctor) this.ctx = new Ctor();
    }
    return this.ctx;
  }

  resume(): void {
    const ctx = this.ensureContext();
    if (ctx && ctx.state === 'suspended') void ctx.resume();
  }

  suspend(): void {
    this.ctx?.suspend();
  }

  /** Mirror `Ln`: play a tone with exponential decay. */
  playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    gain = 0.3,
    detune = 0
  ): void {
    const ctx = this.ensureContext();
    if (!ctx || ctx.state === 'suspended') return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = detune;
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  /** Mirror `ZM`: jump sound — base tone + 1.5x. */
  playJump(score = 0): void {
    const base = 440 + (score % 8) * 30;
    this.playTone(base, 0.12, 'sine', 0.2);
    this.playTone(base * 1.5, 0.08, 'sine', 0.1);
  }

  /** Mirror `JM`: gem sound — three ascending tones. */
  playGem(): void {
    this.playTone(880, 0.1, 'sine', 0.25);
    setTimeout(() => this.playTone(1100, 0.1, 'sine', 0.2), 50);
    setTimeout(() => this.playTone(1320, 0.15, 'sine', 0.15), 100);
  }

  /** Mission complete: bright C-major chime. Throttled so a batch of completions doesn't ring repeatedly. */
  playMissionComplete(): boolean {
    const now = Date.now();
    if (now - this.lastMissionChimeAt < AudioSystem.MISSION_CHIME_MIN_GAP_MS) return false;
    this.lastMissionChimeAt = now;
    this.playTone(523.25, 0.18, 'sine', 0.22);
    setTimeout(() => this.playTone(659.25, 0.18, 'sine', 0.2), 90);
    setTimeout(() => this.playTone(783.99, 0.22, 'sine', 0.18), 180);
    setTimeout(() => this.playTone(1046.5, 0.32, 'sine', 0.14), 270);
    return true;
  }

  /** Mirror `KM`: perfect/combo arpeggio; more notes at higher streaks. */
  playPerfect(streak = 1): void {
    const base = 660 + Math.min(streak, 10) * 60;
    this.playTone(base, 0.15, 'sine', 0.3);
    setTimeout(() => this.playTone(base * 1.25, 0.12, 'sine', 0.25), 60);
    setTimeout(() => this.playTone(base * 1.5, 0.18, 'sine', 0.2), 120);
    if (streak >= 3) setTimeout(() => this.playTone(base * 2, 0.25, 'sine', 0.15), 180);
  }

  /** Fire streak reward: a flame "swoosh" — noise burst with a rising bandpass sweep. */
  playMilestone(): void {
    const ctx = this.ensureContext();
    if (!ctx || ctx.state === 'suspended') return;
    const now = ctx.currentTime;
    this.swoosh(0.5, 500, 3500, ctx, now, 0.5);
    setTimeout(() => this.swoosh(0.35, 900, 5000, ctx, ctx.currentTime, 0.28), 90);
  }

  private swoosh(duration: number, fromFreq: number, toFreq: number, ctx: AudioContext, when: number, gain: number): void {
    const len = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.3;
    filter.frequency.setValueAtTime(Math.max(fromFreq, 20), when);
    filter.frequency.exponentialRampToValueAtTime(Math.max(toFreq, 20), when + duration);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(gain, when + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    src.connect(filter);
    filter.connect(g);
    g.connect(ctx.destination);
    src.start(when);
    src.stop(when + duration);
  }

  /** Shield break: glass "shatter" — scattered bright partials + fast highpass noise. */
  playShieldBreak(): void {
    const ctx = this.ensureContext();
    if (!ctx || ctx.state === 'suspended') return;
    const now = ctx.currentTime;
    for (let i = 0; i < 9; i++) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      const freq = 1800 + Math.random() * 4400;
      osc.type = i % 2 ? 'square' : 'triangle';
      osc.frequency.value = freq;
      osc.detune.value = (Math.random() - 0.5) * 120;
      const dur = 0.035 + Math.random() * 0.16;
      const amp = 0.1 + Math.random() * 0.12;
      g.gain.setValueAtTime(amp, now + Math.random() * 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + dur + 0.01);
    }
    const len = ctx.sampleRate * 0.22;
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7500;
    const g = ctx.createGain();
    g.gain.value = 0.45;
    src.connect(hp);
    hp.connect(g);
    g.connect(ctx.destination);
    src.start(now);
    src.stop(now + 0.22);
  }

  /** Mirror `$M`: game over — descending sawtooth + square. */
  playGameOver(): void {
    this.playTone(200, 0.3, 'sawtooth', 0.25);
    this.playTone(150, 0.4, 'square', 0.15, -50);
  }

  isEnabled(): boolean {
    return GAME_CONFIG.AUDIO_ENABLED;
  }

  dispose(): void {
    this.ctx?.close();
    this.ctx = null;
  }
}
