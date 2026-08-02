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

  it('regression: gate spacing drop never places a platform behind the ball', () => {
    const { state, platforms } = setup();
    state.setUnlockAllWorlds(true);

    state.setScore(90);
    for (let step = 10; step <= 90; step += 10) {
      state.getMutableState().currentStep = step;
      platforms.recycle();
    }
    const before = sortedZ(platforms);
    const front = before[before.length - 1];

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

    state.getMutableState().currentStep = 101;
    state.setScore(100);
    platforms.recycle();
    const newFront = sortedZ(platforms).pop()!.z;
    expect(platforms.getNextZ()).toBeGreaterThan(newFront);
  });
});
