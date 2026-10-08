import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { AudioSystem, LANDING_NOTES, musicBusGain } from '../src/systems/AudioSystem';

describe('AudioSystem mission chime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('rings for a completion', () => {
    const audio = new AudioSystem();
    expect(audio.playMissionComplete()).toBe(true);
  });

  it('swallows repeats within the min gap (completion batch)', () => {
    const audio = new AudioSystem();
    expect(audio.playMissionComplete()).toBe(true);
    expect(audio.playMissionComplete()).toBe(false);
    expect(audio.playMissionComplete()).toBe(false);
  });

  it('plays a run at slider 100 at 75% of the coin and game-over gain', () => {
    expect(musicBusGain(100, 'run')).toBeCloseTo(0.25 * 0.75, 5);
  });

  it('gives each world its own landing pitches, Sunrise highest and Void quietest', () => {
    expect(LANDING_NOTES.sunrise[0]).toBeGreaterThan(LANDING_NOTES.dusk[2]);
    expect(LANDING_NOTES.void[0]).toBeLessThan(LANDING_NOTES.dusk[0]);
    expect(new Set(LANDING_NOTES.sunrise).size).toBe(3);
    expect(new Set(LANDING_NOTES.dusk).size).toBe(3);
    expect(new Set(LANDING_NOTES.void).size).toBe(3);
  });

  it('silences music at slider 0 and keeps the menu under the run', () => {
    expect(musicBusGain(0, 'run')).toBe(0);
    expect(musicBusGain(100, 'menu')).toBeLessThan(musicBusGain(100, 'run'));
    expect(musicBusGain(100, 'duck')).toBeCloseTo(musicBusGain(100, 'run') * 0.5, 5);
    expect(musicBusGain(50, 'run')).toBeCloseTo(musicBusGain(100, 'run') / 2, 5);
  });

  it('rings again after the gap elapses', () => {
    const audio = new AudioSystem();
    audio.playMissionComplete();
    vi.advanceTimersByTime(1800);
    expect(audio.playMissionComplete()).toBe(true);
  });
});
