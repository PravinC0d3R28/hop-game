import { beforeAll, describe, expect, it } from 'vitest';
import { Scene } from 'three';
import { GameStateManager } from '../src/core/GameStateManager';
import { PlatformManager } from '../src/managers/PlatformManager';
import { MaterialFactory } from '../src/systems/MaterialFactory';
import { GAME_CONFIG } from '../src/config/GameConfig';

beforeAll(() => {
  const noopCtx = new Proxy(
    {},
    { get: () => () => {}, set: () => true }
  ) as unknown as CanvasRenderingContext2D;
  (globalThis as { document?: unknown }).document = {
    createElement: () => ({ width: 0, height: 0, getContext: () => noopCtx })
  };
  MaterialFactory.init();
});

function setup() {
  const scene = new Scene();
  const state = new GameStateManager();
  const platforms = new PlatformManager(scene, state);
  platforms.initializePlatforms();
  return { scene, state, platforms };
}

function sortedZ(platforms: PlatformManager): { index: number; z: number }[] {
  return platforms
    .getPlatforms()
    .map((p) => ({ index: p.index, z: p.z }))
    .sort((a, b) => a.index - b.index);
}

describe('platform z stays forward across sawtooth gates', () => {
  it('initial platforms use base spacing', () => {
    const { platforms } = setup();
    const zs = sortedZ(platforms);
    zs.forEach((p, i) => expect(p.z).toBeCloseTo(i * GAME_CONFIG.PLATFORM_SPACING_Z, 10));
  });

  it('recycling keeps gaps exactly equal to the current spacing', () => {
    const { state, platforms } = setup();
    state.getMutableState().currentStep = 10;
    state.setScore(50);
    platforms.recycle();
    const zs = sortedZ(platforms);
    const spacing = state.getPlatformSpacing();
    for (let i = 1; i < zs.length; i++) {
      expect(zs[i].z - zs[i - 1].z).toBeCloseTo(spacing, 10);
    }
  });

  it('regression: world-switch spacing drop never places a platform behind the ball', () => {
    const { state, platforms } = setup();
    state.setUnlockAllWorlds(true);

    state.setScore(90);
    for (let step = 10; step <= 90; step += 10) {
      state.getMutableState().currentStep = step;
      platforms.recycle();
    }
    const before = sortedZ(platforms);
    const front = before[before.length - 1];

    state.selectWorld('dusk');
    state.getMutableState().currentStep = 93;
    state.setScore(100);
    platforms.recycle();

    const after = sortedZ(platforms);
    for (let i = 1; i < after.length; i++) {
      expect(after[i].z).toBeGreaterThan(after[i - 1].z);
      expect(after[i].z - after[i - 1].z).toBeGreaterThanOrEqual(GAME_CONFIG.PLATFORM_SPACING_Z);
    }
    const next = after.find((p) => p.index === front.index + 1);
    expect(next).toBeDefined();
    expect(next!.z).toBeGreaterThan(front.z);
    expect(next!.z - front.z).toBeCloseTo(GAME_CONFIG.PLATFORM_SPACING_Z, 10);
  });

  it('getNextZ is always ahead of the frontmost platform', () => {
    const { state, platforms } = setup();
    state.setUnlockAllWorlds(true);
    state.setScore(99);
    for (let step = 10; step <= 99; step += 10) {
      state.getMutableState().currentStep = step;
      platforms.recycle();
    }
    const front = sortedZ(platforms).pop()!.z;
    expect(platforms.getNextZ()).toBeGreaterThan(front);

    state.selectWorld('dusk');
    state.getMutableState().currentStep = 101;
    state.setScore(100);
    platforms.recycle();
    const newFront = sortedZ(platforms).pop()!.z;
    expect(platforms.getNextZ()).toBeGreaterThan(newFront);
  });
});

describe('per-world sway (updateSway)', () => {
  it('sunrise (amp 0) stays perfectly still at any time — parity', () => {
    const { platforms } = setup();
    for (const now of [0, 5000, 123456]) {
      platforms.updateSway(now);
      for (const p of platforms.getPlatforms()) {
        expect(p.swayOffset).toBe(0);
        expect(p.group.position.x).toBeCloseTo(p.platformX, 10);
      }
    }
  });

  it('default sunrise: score past the gate does not change the sway world', () => {
    const { state, platforms } = setup();
    state.setScore(150);
    expect(state.getActiveWorld().id).toBe('sunrise');
    platforms.updateSway(5000);
    for (const p of platforms.getPlatforms()) {
      expect(p.swayOffset).toBe(0);
      expect(p.group.position.x).toBeCloseTo(p.platformX, 10);
    }
  });

  it('dusk: offset = sin(t*speed + i*1.7) * 0.6, every 3rd platform stays static', () => {
    const { state, platforms } = setup();
    state.setUnlockAllWorlds(true);
    state.selectWorld('dusk');
    const now = 1234;
    platforms.updateSway(now);
    expect(state.getActiveWorld().id).toBe('dusk');
    for (const p of platforms.getPlatforms()) {
      if (p.index % 3 === 0) {
        expect(p.swayOffset).toBe(0);
        expect(p.group.position.x).toBeCloseTo(p.platformX, 10);
        continue;
      }
      const expected = Math.sin(now * 0.001 * 1.6 + p.index * 1.7) * 0.6;
      expect(p.swayOffset).toBeCloseTo(expected, 10);
      expect(p.group.position.x).toBeCloseTo(p.platformX + expected, 10);
      expect(Math.abs(p.swayOffset)).toBeLessThanOrEqual(0.6);
    }
  });

  it('sway ratio cadence: the static subset exactly matches 1/N of the pool', () => {
    const { state, platforms } = setup();
    state.setUnlockAllWorlds(true);
    state.selectWorld('dusk');
    expect(state.getActiveWorld().sway.ratio).toBe(0.66);
    platforms.updateSway(0);
    const pool = platforms.getPlatforms();
    const staticCount = pool.filter((p) => p.swayOffset === 0).length;
    const swayCount = pool.length - staticCount;
    expect(staticCount).toBe(2); // indices 0 and 3 (1 in 3)
    expect(swayCount).toBe(4);
    const sways = pool.filter((p) => p.swayOffset !== 0);
    for (const p of sways) expect(p.index % 3).not.toBe(0);
  });

  it('void cadence leaves fewer static platforms (1 in 4)', () => {
    const { state, platforms } = setup();
    state.setUnlockAllWorlds(true);
    state.selectWorld('void');
    expect(state.getActiveWorld().sway.ratio).toBe(0.75);
    platforms.updateSway(0);
    const staticCount = platforms.getPlatforms().filter((p) => p.swayOffset === 0).length;
    expect(staticCount).toBeLessThanOrEqual(2); // indices 0 (and 4 if in pool) stay static
  });

  it('void widens the sway envelope beyond dusk', () => {
    const { state, platforms } = setup();
    state.setUnlockAllWorlds(true);
    state.selectWorld('void');
    expect(state.getActiveWorld().id).toBe('void');
    platforms.updateSway(0);
    const sways = platforms.getPlatforms().filter((p) => p.swayOffset !== 0);
    expect(sways.length).toBeGreaterThan(0);
    const maxAmp = Math.max(...sways.map((p) => Math.abs(p.swayOffset)));
    expect(maxAmp).toBeGreaterThan(0.6);
    for (const p of sways) {
      expect(Math.abs(p.swayOffset)).toBeLessThanOrEqual(0.9);
    }
  });

  it('selecting a new world between runs re-rolls the sway field', () => {
    const { state, platforms } = setup();
    state.setUnlockAllWorlds(true);
    state.selectWorld('void');
    platforms.updateSway(0);
    const p1 = platforms.getPlatforms().find((p) => p.index === 1)!;
    expect(Math.abs(p1.swayOffset)).toBeGreaterThan(0.5);
    expect(p1.group.position.x).toBeCloseTo(p1.platformX + p1.swayOffset, 10);
  });
});
