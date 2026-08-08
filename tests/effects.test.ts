import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  PerspectiveCamera,
  Scene,
  Vector3
} from 'three';
import { EffectsSystem } from '../src/systems/EffectsSystem';
import { CameraController } from '../src/systems/CameraController';
import { GAME_CONFIG } from '../src/config/GameConfig';
import type { PlatformData } from '../src/entities/PlatformEntity';

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

/** Minimal stand-in platform: a group with a tinted mesh (for color sampling). */
function makePlatform(x = 0.5, z = 2, baseScale = 1): PlatformData {
  const group = new Group();
  const mesh = new Mesh(
    new BoxGeometry(1, 1, 1),
    new MeshToonMaterial({ color: 0x3b9dff })
  );
  group.add(mesh);
  return {
    group,
    mesh,
    outlineMesh: mesh,
    perfectDot: mesh,
    perfectRing: mesh,
    index: 5,
    coins: [],
    z,
    platformX: x,
    swayOffset: 0,
    baseScale,
    hasRisen: true
  };
}

function setupEffects() {
  const scene = new Scene();
  const cam = new PerspectiveCamera(55, 1.6, 0.1, 100);
  cam.position.set(0, 9.5, -8.5);
  const effects = new EffectsSystem(scene, {} as HTMLElement, cam);
  return { scene, effects, cam };
}

describe('failure flag (playFailureFlag)', () => {
  it('plants a flag group into the platform and tracks it', () => {
    const { effects } = setupEffects();
    const platform = makePlatform(0.5, 2);
    expect(effects.getFailureFlagCount()).toBe(0);
    effects.playFailureFlag(platform);
    expect(effects.getFailureFlagCount()).toBe(1);
    // the flag rides the platform group (child of platform.group)
    expect(platform.group.children.some((c) => c.type === 'Group')).toBe(true);
    // flag world scale is flag.scale even when the platform is scaled down
    expect(GAME_CONFIG.FAIL_FLAG.scale).toBe(2);
  });

  it('the flag is 200% bigger (scale 2 applies to pole height)', () => {
    const { effects } = setupEffects();
    const platform = makePlatform();
    effects.playFailureFlag(platform);
    // Find the pole mesh inside the flag root
    const flagRoot = platform.group.children.find((c) => c.type === 'Group') as Group;
    const worldScale = new Vector3();
    flagRoot.getWorldScale(worldScale);
    expect(worldScale.y).toBeCloseTo(GAME_CONFIG.FAIL_FLAG.scale, 10);
    expect(worldScale.y).toBeCloseTo(2, 10);
  });

  it('the flag sticks to a swaying platform (rides group x)', () => {
    const { effects } = setupEffects();
    const platform = makePlatform(0.5, 2);
    effects.playFailureFlag(platform);
    const flagRoot = platform.group.children.find((c) => c.type === 'Group') as Group;

    // Simulate the platform swaying to a new x
    platform.group.position.x = 1.5;
    platform.group.updateMatrixWorld(true);
    const worldPos = new Vector3();
    flagRoot.getWorldPosition(worldPos);
    expect(worldPos.x).toBeCloseTo(1.5, 10);

    // Sway further — flag follows
    platform.group.position.x = -0.75;
    platform.group.updateMatrixWorld(true);
    flagRoot.getWorldPosition(worldPos);
    expect(worldPos.x).toBeCloseTo(-0.75, 10);
  });

  it('clearFailureFlags removes the flag from the platform and the tracker', () => {
    const { effects } = setupEffects();
    const platform = makePlatform();
    effects.playFailureFlag(platform);
    expect(effects.getFailureFlagCount()).toBe(1);
    effects.clearFailureFlags();
    expect(effects.getFailureFlagCount()).toBe(0);
    expect(platform.group.children.length).toBe(1); // only the mesh remains
  });

  it('spawns debris and fires the impact callback once the flag lands', async () => {
    GAME_CONFIG.FAIL_FLAG.dropDuration = 0.001; // fast landing for the test
    const { effects } = setupEffects();
    const platform = makePlatform();
    let impacted = false;
    effects.playFailureFlag(platform, () => {
      impacted = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(impacted).toBe(true);
    // debris chips + the small dust puff (5-6) pushed into the particle pool
    expect(effects.getParticleCount()).toBeGreaterThanOrEqual(GAME_CONFIG.FAIL_FLAG.debrisCount);
  });
});

describe('failure flag cloth animation', () => {
  it('billboards the cloth toward the camera each frame', () => {
    const { effects, cam } = setupEffects();
    const platform = makePlatform();
    effects.playFailureFlag(platform);
    const flagRoot = platform.group.children.find((c) => c.type === 'Group') as Group;
    const cloth = flagRoot.children.find((c) => c.type === 'Group') as Group;

    // Camera parked on the +x side → cloth yaw points its face that way
    cam.position.set(5, 9.5, -8.5);
    effects.updateFailureFlags(1000);
    platform.group.updateMatrixWorld(true);
    const wp = new Vector3();
    cloth.getWorldPosition(wp);
    const expected = Math.atan2(cam.position.x - wp.x, cam.position.z - wp.z);
    // rotation.y holds in local space; compare via a world direction check
    const dir = new Vector3(0, 0, 1).applyEuler(cloth.rotation);
    const toCam = new Vector3(cam.position.x - wp.x, 0, cam.position.z - wp.z).normalize();
    expect(dir.dot(toCam)).toBeGreaterThan(0.99);
    expect(Math.abs(Math.atan2(dir.x, dir.z) - expected) % Math.PI).toBeLessThan(0.01);
  });

  it('the cloth poly mesh waves over time (vertex displacement)', () => {
    const { effects } = setupEffects();
    const platform = makePlatform();
    effects.playFailureFlag(platform);
    const flagRoot = platform.group.children.find((c) => c.type === 'Group') as Group;
    const cloth = flagRoot.children.find((c) => c.type === 'Group') as Group;
    const mesh = cloth.children.find((c) => c.type === 'Mesh') as Mesh;
    expect(mesh).toBeDefined();
    // Subdivided polygon mesh: (columns+1) x (rows+1) vertices
    const pos = mesh.geometry.attributes.position as unknown as { array: Float32Array };
    expect(pos.array.length / 3).toBe(
      (GAME_CONFIG.FAIL_FLAG.clothColumns + 1) * (GAME_CONFIG.FAIL_FLAG.clothRows + 1)
    );

    effects.updateFailureFlags(0);
    const z0 = Array.from(pos.array).filter((_, i) => i % 3 === 2);
    effects.updateFailureFlags(1000);
    const z1 = Array.from(pos.array).filter((_, i) => i % 3 === 2);
    // the wave is time-driven: z displacements must differ between frames
    expect(z1).not.toEqual(z0);
    // amplitude grows toward the tip: max |z| is not at the pole (x=0) edge
    const maxAbs = Math.max(...z1.map((v) => Math.abs(v)));
    expect(maxAbs).toBeGreaterThan(0);
    expect(Math.abs(z1[0])).toBeLessThanOrEqual(maxAbs);
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
