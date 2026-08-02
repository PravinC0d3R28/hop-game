import { GAME_CONFIG } from '../config/GameConfig';

/**
 * Procedural Web Audio. Faithful port of the original `Ln`, `ZM`, `JM`, `KM`, `$M`.
 */
export class AudioSystem {
  private ctx: AudioContext | null = null;

  private ensureContext(): AudioContext | null {
    if (!this.ctx) {
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

  /** Mirror `KM`: perfect/combo arpeggio; more notes at higher streaks. */
  playPerfect(streak = 1): void {
    const base = 660 + Math.min(streak, 10) * 60;
    this.playTone(base, 0.15, 'sine', 0.3);
    setTimeout(() => this.playTone(base * 1.25, 0.12, 'sine', 0.25), 60);
    setTimeout(() => this.playTone(base * 1.5, 0.18, 'sine', 0.2), 120);
    if (streak >= 3) setTimeout(() => this.playTone(base * 2, 0.25, 'sine', 0.15), 180);
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
