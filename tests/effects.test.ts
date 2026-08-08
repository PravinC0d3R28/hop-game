import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { Group, PerspectiveCamera, Scene } from 'three';
import { EffectsSystem } from '../src/systems/EffectsSystem';
import { CameraController } from '../src/systems/CameraController';
import { GAME_CONFIG } from '../src/config/GameConfig';

beforeAll(() => {
  // EffectsSystem needs a DOM-ish confetti container only for showConfetti,
  // which these tests never call; a plain object suffices.
  (globalThis as { document?: unknown }).document = {
    createElement: () => ({ style: {} })
  };
});

afterEach(() => {
  // Restore the real drop duration after the impact test shortens it.
  GAME_CONFIG.FAIL_FLAG.dropDuration = 0.42;
});

function setupEffects() {
  const scene = new Scene();
  const effects = new EffectsSystem(scene, {} as HTMLElement);
  return { scene, effects };
}

describe('failure flag (playFailureFlag)', () => {
  it('adds a flag group to the scene and tracks it', () => {
    const { scene, effects } = setupEffects();
    const before = scene.children.length;
    effects.playFailureFlag(0.5, 2, 0x3b9dff);
    expect(effects.getFailureFlagCount()).toBe(1);
    expect(scene.children.length).toBe(before + 1);
    const group = scene.children[scene.children.length - 1] as Group;
    expect(group.isGroup).toBe(true);
    expect(group.position.y).toBeCloseTo(GAME_CONFIG.PLATFORM_HEIGHT / 2 + GAME_CONFIG.FAIL_FLAG.dropHeight, 10);
    expect(group.position.x).toBeCloseTo(0.5, 10);
    expect(group.position.z).toBeCloseTo(2, 10);
  });

  it('clearFailureFlags removes the flag from the scene and the tracker', () => {
    const { scene, effects } = setupEffects();
    effects.playFailureFlag(0, 0, 0xff4d8a);
    expect(effects.getFailureFlagCount()).toBe(1);
    const before = scene.children.length;
    effects.clearFailureFlags();
    expect(effects.getFailureFlagCount()).toBe(0);
    expect(scene.children.length).toBe(before - 1);
  });

  it('spawns debris and fires the impact callback once the flag lands', async () => {
    GAME_CONFIG.FAIL_FLAG.dropDuration = 0.001; // fast landing for the test
    const { effects } = setupEffects();
    let impacted = false;
    effects.playFailureFlag(0, 0, 0x3b9dff, () => {
      impacted = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(impacted).toBe(true);
    // debris chips + the small dust puff (5-6) pushed into the particle pool
    expect(effects.getParticleCount()).toBeGreaterThanOrEqual(GAME_CONFIG.FAIL_FLAG.debrisCount);
  });
});

describe('camera shake', () => {
  it('shake() and shake(strength) run without error', () => {
    const cam = new PerspectiveCamera(55, 1.6, 0.1, 100);
    const controller = new CameraController(cam);
    expect(() => controller.shake()).not.toThrow();
    expect(() => controller.shake(1.5)).not.toThrow();
  });
});
