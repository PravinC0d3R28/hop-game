import { GAME_CONFIG } from '../config/GameConfig';
import type { WorldId } from '../config/Worlds';

/** How loud each moment is, as a fraction of a run. */
const MUSIC_LEVEL_SCALE = { menu: 0.62, run: 1, duck: 0.5 } as const;

/** Coin and game-over tones peak around this gain. Music is mixed against it. */
const SFX_REFERENCE_GAIN = 0.25;

/** Slider 100 during a run is 75% of that reference. The first mix. */
const MUSIC_FULL_RATIO = 0.75;

export type MusicLevel = keyof typeof MUSIC_LEVEL_SCALE;

/** Linear music-bus gain for a 0–100 slider and a game moment. */
export function musicBusGain(volume: number, level: MusicLevel): number {
  const slider = Math.min(1, Math.max(0, volume / 100));
  return SFX_REFERENCE_GAIN * MUSIC_FULL_RATIO * MUSIC_LEVEL_SCALE[level] * slider;
}

const MUSIC_IDS: WorldId[] = ['sunrise', 'dusk', 'void'];

function musicUrl(id: WorldId): string {
  const base = import.meta.env.BASE_URL || './';
  return `${base}audio/${id}.mp3`;
}

/**
 * Landing pitches, in each world's key, a few close notes so a long run is
 * not one beep. Sunrise sits high (glassy, D major). Dusk is warmer and lower
 * (F major). Void is the quietest and sparsest (E minor).
 */
export const LANDING_NOTES: Record<WorldId, readonly number[]> = {
  sunrise: [1174.66, 1479.98, 1760],
  dusk: [349.23, 440, 523.25],
  void: [329.63, 392, 493.88]
};

export type UiSound = 'tick' | 'confirm' | 'deny' | 'back' | 'reveal';

/**
 * Procedural Web Audio. Faithful port of the original `Ln`, `ZM`, `JM`, `KM`, `$M`.
 * World beds are decoded MP3s on their own gain, separate from the SFX.
 */
export class AudioSystem {
  private ctx: AudioContext | null = null;

  /** SFX volume 0–1 (driven by the settings "sound" slider). */
  private soundVolume = 1;

  /** Music slider 0–100. */
  private musicVolume = 100;
  private musicLevel: MusicLevel = 'menu';
  private musicPaused = false;
  private musicBus: GainNode | null = null;
  private trackGain: GainNode | null = null;
  private buffers = new Map<WorldId, AudioBuffer>();
  private loading = new Map<WorldId, Promise<AudioBuffer | null>>();
  private currentWorld: WorldId | null = null;
  private buffer: AudioBuffer | null = null;
  private sources: AudioBufferSourceNode[] = [];
  private loopTimer: number | null = null;
  private voiceGen = 0;
  private switchToken = 0;
  /** Context time at which buffer position 0 of this cycle would have started. */
  private origin = 0;
  private pausedOffset = 0;

  /** Which close pitch the next landing uses. */
  private landStep = 0;
  /** One noise buffer, sliced for ticks, so a hop does not allocate. */
  private noiseBuffer: AudioBuffer | null = null;

  /** When the last mission chime rang — used to swallow rapid repeats from a completion batch. */
  private lastMissionChimeAt = Number.NEGATIVE_INFINITY;
  /** Minimum gap between mission chimes; a batch of completions rings at most every 1.8s. */
  private static readonly MISSION_CHIME_MIN_GAP_MS = 1800;

  /** Set the SFX volume from a 0–100 setting. */
  setSoundVolume(volume: number): void {
    this.soundVolume = Math.min(1, Math.max(0, volume / 100));
  }

  /** Set the music volume from a 0–100 setting. 100 is 75% of the coin and game-over loudness. */
  setMusicVolume(volume: number): void {
    this.musicVolume = Math.min(100, Math.max(0, volume));
    if (!this.musicPaused) this.applyBusGain(0.05);
  }

  /** Menu, in-run, or game-over loudness. Does not restart the bed. */
  setMusicLevel(level: MusicLevel): void {
    this.musicLevel = level;
    if (!this.musicPaused) this.applyBusGain(0.4);
  }

  /** Game over: the bed falls to half of the run level and stays there. */
  duckForMiss(): void {
    this.setMusicLevel('duck');
  }

  /**
   * Play this world's loop. The same world keeps its place in the file and
   * only changes level. A different world fades out before the next one starts.
   */
  playWorld(id: WorldId, level: MusicLevel): void {
    if (!this.isEnabled() || !MUSIC_IDS.includes(id)) return;
    this.musicLevel = level;
    if (this.currentWorld === id && (this.sources.length > 0 || this.musicPaused)) {
      if (!this.musicPaused) this.applyBusGain(0.4);
      return;
    }
    const token = ++this.switchToken;
    void this.swapWorld(id, token);
  }

  /** Freeze the bed and remember where it was, so resume does not stack a second copy. */
  pauseMusic(): void {
    if (this.musicPaused) return;
    this.rememberOffset();
    this.musicPaused = true;
    this.voiceGen += 1;
    this.stopSources();
  }

  /** Continue the bed from the frozen offset. */
  resumeMusic(): void {
    if (!this.musicPaused) return;
    this.musicPaused = false;
    if (this.buffer && this.trackGain) this.beginVoice(this.pausedOffset);
    this.applyBusGain(0.15);
  }

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

  /** Scale a raw gain value by the current SFX volume (returns 0 when muted). Effects sit 50% above the first mix so the song does not cover them. */
  private applyVolume(gain: number): number {
    if (this.soundVolume <= 0) return 0;
    return gain * this.soundVolume * 1.5;
  }

  /** Ordinary landing. A perfect is the same hit with one higher sparkle. */
  playJump(_score = 0, world: WorldId = 'sunrise'): void {
    this.playLanding(world, false);
  }

  /** Centered landing. Replaces the ordinary landing. */
  playPerfect(_streak = 1, world: WorldId = 'sunrise'): void {
    this.playLanding(world, true);
  }

  /** One bright chime for the gold star. A short click so it cuts through the song. */
  playCoin(): void {
    const wobble = (Math.random() - 0.5) * 30;
    this.burst(0.03, 0.1, 'highpass', 2400, 0.8);
    this.tone(988 + wobble, 0.12, 'sine', 0.2);
    this.tone(1568 + wobble, 0.07, 'sine', 0.1);
  }

  /** Mission claim: the coin chime, one step bigger. */
  playClaim(): void {
    this.burst(0.03, 0.1, 'highpass', 1800, 0.7);
    this.tone(659.25, 0.14, 'sine', 0.16);
    this.tone(988, 0.12, 'sine', 0.16);
    this.tone(1318.5, 0.1, 'sine', 0.1);
  }

  /** Two short notes when a mission toast appears. */
  playMissionComplete(): boolean {
    const now = Date.now();
    if (now - this.lastMissionChimeAt < AudioSystem.MISSION_CHIME_MIN_GAP_MS) return false;
    this.lastMissionChimeAt = now;
    this.tone(523.25, 0.12, 'sine', 0.16);
    this.tone(659.25, 0.14, 'sine', 0.13, 0.08);
    return true;
  }

  /** Buttons and the unlock card. */
  playUi(kind: UiSound): void {
    if (kind === 'tick') this.burst(0.04, 0.07, 'bandpass', 1800, 1.4);
    else if (kind === 'confirm') {
      this.burst(0.035, 0.06, 'bandpass', 2000, 1.2);
      this.tone(880, 0.06, 'sine', 0.08);
    } else if (kind === 'deny') this.burst(0.06, 0.06, 'lowpass', 420, 0.7);
    else if (kind === 'back') this.tone(220, 0.06, 'triangle', 0.08);
    else {
      this.tone(523.25, 0.08, 'sine', 0.12);
      this.tone(659.25, 0.08, 'sine', 0.1, 0.07);
      this.tone(783.99, 0.1, 'sine', 0.08, 0.14);
    }
  }

  /** Fire streak: one short rising shimmer. */
  playMilestone(): void {
    this.glide(520, 1560, 0.28, 'sine', 0.12);
    this.burst(0.22, 0.04, 'bandpass', 1400, 0.8);
  }

  /** Shield break: a short cracked-glass cluster, not a random buzz. */
  playShieldBreak(): void {
    const partials = [1760, 2217, 2637, 3136, 1400];
    partials.forEach((freq, i) => this.tone(freq, 0.05 + i * 0.012, 'triangle', 0.07, i * 0.012));
    this.burst(0.09, 0.1, 'highpass', 3200, 0.7);
  }

  /** The miss. A short fall in the world's color. */
  playMiss(world: WorldId = 'sunrise'): void {
    if (world === 'dusk') {
      this.tone(440, 0.12, 'triangle', 0.14);
      this.tone(293.66, 0.16, 'triangle', 0.12, 0.1);
    } else if (world === 'void') {
      this.tone(329.63, 0.12, 'sine', 0.1);
      this.tone(196, 0.18, 'sine', 0.08, 0.1);
    } else {
      this.tone(1174.66, 0.08, 'sine', 0.1);
      this.tone(740, 0.14, 'triangle', 0.12, 0.07);
    }
  }

  /** Flag hitting the tile. The same soft impact in every world. */
  playImpact(): void {
    this.tone(110, 0.1, 'sine', 0.16);
    this.burst(0.06, 0.1, 'lowpass', 220, 0.8);
  }

  /** New best, after the impact. */
  playBest(): void {
    this.tone(1568, 0.08, 'sine', 0.1);
    this.tone(2093, 0.1, 'sine', 0.07, 0.06);
  }

  isEnabled(): boolean {
    return GAME_CONFIG.AUDIO_ENABLED;
  }

  dispose(): void {
    this.voiceGen += 1;
    this.switchToken += 1;
    this.stopSources();
    this.ctx?.close();
    this.ctx = null;
    this.musicBus = null;
    this.trackGain = null;
  }

  private async swapWorld(id: WorldId, token: number): Promise<void> {
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.ensureBus();
    if (this.sources.length > 0) {
      this.applyBusGain(0.3, 0);
      await new Promise((resolve) => window.setTimeout(resolve, 320));
      if (token !== this.switchToken) return;
      this.voiceGen += 1;
      this.stopSources();
    }
    const buffer = await this.loadBuffer(id);
    if (!buffer || token !== this.switchToken) return;
    this.currentWorld = id;
    this.buffer = buffer;
    this.pausedOffset = 0;
    if (!this.musicPaused) this.beginVoice(0);
    this.applyBusGain(0.45);
  }

  private playLanding(world: WorldId, perfect: boolean): void {
    const notes = LANDING_NOTES[world];
    const freq = notes[this.landStep % notes.length];
    this.landStep += 1;
    if (world === 'sunrise') {
      this.tone(freq, 0.07, 'triangle', 0.15);
      this.burst(0.025, 0.08, 'highpass', 4200, 0.7);
      if (perfect) this.tone(freq * 1.26, 0.09, 'sine', 0.08);
    } else if (world === 'dusk') {
      this.tone(freq, 0.09, 'triangle', 0.14);
      this.burst(0.04, 0.07, 'lowpass', 280, 0.8);
      if (perfect) this.tone(freq * 1.5, 0.1, 'sine', 0.06);
    } else {
      this.tone(freq, 0.06, 'sine', 0.09);
      this.tone(freq * 2, 0.08, 'sine', 0.035);
      if (perfect) this.tone(freq * 3, 0.07, 'sine', 0.03);
    }
  }

  /** A short electronic tone. `at` is seconds from now, on the audio clock. */
  private tone(freq: number, duration: number, type: OscillatorType, gain: number, at = 0): void {
    const ctx = this.ensureContext();
    if (!ctx || ctx.state === 'suspended') return;
    const level = this.applyVolume(gain);
    if (level <= 0) return;
    const when = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    const node = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freq), when);
    node.gain.setValueAtTime(level, when);
    node.gain.exponentialRampToValueAtTime(0.001, when + duration);
    osc.connect(node);
    node.connect(ctx.destination);
    osc.start(when);
    osc.stop(when + duration + 0.02);
  }

  /** A short glide, used for the fire shimmer. */
  private glide(from: number, to: number, duration: number, type: OscillatorType, gain: number): void {
    const ctx = this.ensureContext();
    if (!ctx || ctx.state === 'suspended') return;
    const level = this.applyVolume(gain);
    if (level <= 0) return;
    const when = ctx.currentTime;
    const osc = ctx.createOscillator();
    const node = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, when);
    osc.frequency.exponentialRampToValueAtTime(to, when + duration);
    node.gain.setValueAtTime(level, when);
    node.gain.exponentialRampToValueAtTime(0.001, when + duration);
    osc.connect(node);
    node.connect(ctx.destination);
    osc.start(when);
    osc.stop(when + duration + 0.02);
  }

  /** A filtered slice of noise. The tick, the knock, the deny. */
  private burst(duration: number, gain: number, type: BiquadFilterType, freq: number, q: number): void {
    const ctx = this.ensureContext();
    if (!ctx || ctx.state === 'suspended') return;
    const level = this.applyVolume(gain);
    if (level <= 0) return;
    if (!this.noiseBuffer) {
      const len = Math.max(1, Math.floor(ctx.sampleRate * 0.12));
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buffer;
    }
    const when = ctx.currentTime;
    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const node = ctx.createGain();
    src.buffer = this.noiseBuffer;
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    node.gain.setValueAtTime(level, when);
    node.gain.exponentialRampToValueAtTime(0.001, when + duration);
    src.connect(filter);
    filter.connect(node);
    node.connect(ctx.destination);
    src.start(when, 0, duration);
    src.stop(when + duration + 0.02);
  }

  private loadBuffer(id: WorldId): Promise<AudioBuffer | null> {
    const cached = this.buffers.get(id);
    if (cached) return Promise.resolve(cached);
    const pending = this.loading.get(id);
    if (pending) return pending;
    const ctx = this.ensureContext();
    if (!ctx) return Promise.resolve(null);
    const job = fetch(musicUrl(id))
      .then((res) => {
        if (!res.ok) throw new Error(`HOP: music ${id} ${res.status}`);
        return res.arrayBuffer();
      })
      .then((bytes) => ctx.decodeAudioData(bytes))
      .then((buffer) => {
        this.buffers.set(id, buffer);
        return buffer;
      })
      .catch((err) => {
        console.error(err);
        return null;
      })
      .finally(() => {
        this.loading.delete(id);
      });
    this.loading.set(id, job);
    return job;
  }

  private ensureBus(): void {
    const ctx = this.ctx;
    if (!ctx || this.musicBus) return;
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 0;
    this.musicBus.connect(ctx.destination);
    this.trackGain = ctx.createGain();
    this.trackGain.gain.value = 1;
    this.trackGain.connect(this.musicBus);
  }

  private applyBusGain(ramp: number, target?: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus) return;
    const level = target ?? (this.musicPaused ? 0 : musicBusGain(this.musicVolume, this.musicLevel));
    const now = ctx.currentTime;
    const gain = this.musicBus.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(Math.max(0, level), now + ramp);
  }

  /** Overlap the last 1.25s of the file with the start so the loop has no click. */
  private beginVoice(offset: number): void {
    const ctx = this.ctx;
    const buffer = this.buffer;
    const track = this.trackGain;
    if (!ctx || !buffer || !track) return;
    this.voiceGen += 1;
    const gen = this.voiceGen;
    this.stopSources();
    const now = ctx.currentTime;
    this.origin = now - offset;
    this.spawnCycle(gen, now, offset);
  }

  private spawnCycle(gen: number, when: number, offset: number): void {
    const ctx = this.ctx;
    const buffer = this.buffer;
    const track = this.trackGain;
    if (!ctx || !buffer || !track || gen !== this.voiceGen) return;
    const fade = Math.min(1.25, buffer.duration / 4);
    let start = when;
    let from = offset;
    if (start < ctx.currentTime) {
      from = Math.min(buffer.duration - 0.05, from + (ctx.currentTime - start));
      start = ctx.currentTime;
    }
    const playFor = Math.max(0.05, buffer.duration - from);
    const end = start + playFor;
    const src = ctx.createBufferSource();
    const g = ctx.createGain();
    src.buffer = buffer;
    src.connect(g);
    g.connect(track);
    g.gain.setValueAtTime(from <= 0.001 ? 0 : 1, start);
    if (from <= 0.001) g.gain.linearRampToValueAtTime(1, start + fade);
    const fadeOutAt = Math.max(start + 0.02, end - fade);
    g.gain.setValueAtTime(1, fadeOutAt);
    g.gain.linearRampToValueAtTime(0, end);
    src.start(start, from, playFor);
    src.stop(end + 0.02);
    src.onended = () => {
      g.disconnect();
      const index = this.sources.indexOf(src);
      if (index >= 0) this.sources.splice(index, 1);
    };
    this.sources.push(src);
    const nextAt = end - fade;
    const wait = (nextAt - ctx.currentTime - 0.4) * 1000;
    this.loopTimer = window.setTimeout(() => {
      if (gen !== this.voiceGen) return;
      this.spawnCycle(gen, nextAt, 0);
    }, Math.max(0, wait));
  }

  private rememberOffset(): void {
    const ctx = this.ctx;
    const buffer = this.buffer;
    if (!ctx || !buffer) return;
    const fade = Math.min(1.25, buffer.duration / 4);
    const period = Math.max(0.1, buffer.duration - fade);
    const elapsed = ctx.currentTime - this.origin;
    this.pausedOffset = ((elapsed % period) + period) % period;
  }

  private stopSources(): void {
    if (this.loopTimer !== null) {
      window.clearTimeout(this.loopTimer);
      this.loopTimer = null;
    }
    for (const src of this.sources) {
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
      src.disconnect();
    }
    this.sources = [];
  }
}
