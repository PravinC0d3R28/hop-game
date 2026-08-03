import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { AudioSystem } from '../src/systems/AudioSystem';

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

  it('rings again after the gap elapses', () => {
    const audio = new AudioSystem();
    audio.playMissionComplete();
    vi.advanceTimersByTime(1800);
    expect(audio.playMissionComplete()).toBe(true);
  });
});
