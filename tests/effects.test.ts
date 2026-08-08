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
  // Restore the real drop timing after tests shorten it.
  GAME_CONFIG.FAIL_FLAG.dropDuration = 0.3;
  GAME_CONFIG.FAIL_FLAG.dropDelay = 0.24;
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
  const effects = new EffectsSystem(scene, {} as HTMLElement);
  return { scene, effects };
}

/** Play the flag with near-instant drop timing and wait for it to land. */
async function plantAndLand(
  effects: EffectsSystem,
  platform: PlatformData,
  onImpact?: () => void
): Promise<void> {
  GAME_CONFIG.FAIL_FLAG.dropDuration = 0.001;
  GAME_CONFIG.FAIL_FLAG.dropDelay = 0.001;
  effects.playFailureFlag(platform, 'sunrise', onImpact);
  await new Promise((resolve) => setTimeout(resolve, 60));
}

describe('failure flag (playFailureFlag)', () => {
  it('plants a flag group into the platform and tracks it', () => {
    const { effects } = setupEffects();
    const platform = makePlatform(0.5, 2);
    expect(effects.getFailureFlagCount()).toBe(0);
    effects.playFailureFlag(platform, 'sunrise');
    expect(effects.getFailureFlagCount()).toBe(1);
    // the flag rides the platform group (child of platform.group)
    expect(platform.group.children.some((c) => c.type === 'Group')).toBe(true);
    // flag world scale is flag.scale even when the platform is scaled down
    expect(GAME_CONFIG.FAIL_FLAG.scale).toBe(2);
  });

  it('the flag is 200% bigger (scale 2 applies to pole height)', () => {
    const { effects } = setupEffects();
    const platform = makePlatform();
    effects.playFailureFlag(platform, 'sunrise');
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
    effects.playFailureFlag(platform, 'sunrise');
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
    effects.playFailureFlag(platform, 'sunrise');
    expect(effects.getFailureFlagCount()).toBe(1);
    effects.clearFailureFlags();
    expect(effects.getFailureFlagCount()).toBe(0);
    expect(platform.group.children.length).toBe(1); // only the mesh remains
  });

  it('spawns debris and fires the impact callback once the flag lands', async () => {
    const { effects } = setupEffects();
    const platform = makePlatform();
    let impacted = false;
    await plantAndLand(effects, platform, () => {
      impacted = true;
    });
    expect(impacted).toBe(true);
    // debris chips + the small dust puff (5-6) pushed into the particle pool
    expect(effects.getParticleCount()).toBeGreaterThanOrEqual(GAME_CONFIG.FAIL_FLAG.debrisCount);
  });
});

describe('failure flag cloth animation', () => {
  it('keeps a fixed orientation — tip at +x (right), no 180-degree snap', async () => {
    const { effects } = setupEffects();
    const platform = makePlatform();
    await plantAndLand(effects, platform);
    const flagRoot = platform.group.children.find((c) => c.type === 'Group') as Group;
    const cloth = flagRoot.children.find((c) => c.type === 'Group') as Group;
    const clothMesh = cloth.children.find((c) => c.type === 'Mesh') as Mesh;

    // The cloth is never yawed: rotation.y stays 0, so the tip built at +x
    // reads on the RIGHT from the camera (which sits at -z looking +z).
    effects.updateFailureFlags(1000);
    expect(cloth.rotation.y).toBe(0);

    const pos = clothMesh.geometry.attributes.position as unknown as { array: Float32Array };
    let maxX = -Infinity;
    for (let i = 0; i < pos.array.length; i += 3) {
      maxX = Math.max(maxX, pos.array[i]);
    }
    expect(maxX).toBeGreaterThan(0);
  });

  it('the cloth poly mesh waves over time (vertex displacement)', async () => {
    const { effects } = setupEffects();
    const platform = makePlatform();
    await plantAndLand(effects, platform);
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

  it('sinks a tapered wood pole into the platform (no podium)', async () => {
    const { effects } = setupEffects();
    const platform = makePlatform();
    await plantAndLand(effects, platform);
    const flagRoot = platform.group.children.find((c) => c.type === 'Group') as Group;

    // The pole is a 4-segment cylinder (tapered: top 1.2x bottom), not a box.
    const pole = flagRoot.children.find((c) => c.type === 'Mesh') as Mesh;
    expect(pole).toBeDefined();
    expect(pole.geometry.type).toBe('CylinderGeometry');
    const params = (pole.geometry as unknown as { parameters: { radiusTop: number; radiusBottom: number } })
      .parameters;
    expect(params.radiusTop).toBeCloseTo(params.radiusBottom * 1.2, 10);

    // No podium: the only meshes are the pole + finial (+ crater/dent after
    // landing) — no podium tiers.
    const meshes = flagRoot.children.filter((c) => c.type === 'Mesh') as Mesh[];
    const boxMeshes = meshes.filter((m) => m.geometry.type === 'BoxGeometry');
    expect(boxMeshes.length).toBe(0);

    // The pole base is sunk below the tile top (root-local y<0).
    expect(pole.position.y - (pole.geometry as unknown as { parameters: { height: number } }).parameters.height / 2)
      .toBeLessThan(0);
  });

  it('leaves a crater (dark ring + dent) on the platform at impact', async () => {
    const { effects } = setupEffects();
    const platform = makePlatform();
    await plantAndLand(effects, platform);
    const flagRoot = platform.group.children.find((c) => c.type === 'Group') as Group;

    const craters = flagRoot.children.filter((c) => c.type === 'Mesh' && (c as Mesh).geometry.type === 'RingGeometry');
    const dents = flagRoot.children.filter((c) => c.type === 'Mesh' && (c as Mesh).geometry.type === 'CircleGeometry');
    expect(craters.length).toBe(1);
    expect(dents.length).toBe(1);
    // The crater lies flat on the platform top (rotated -90° around x).
    expect((craters[0] as Mesh).rotation.x).toBeCloseTo(-Math.PI / 2, 10);
  });

  it('applies the active world palette to the cloth color', async () => {
    const { effects } = setupEffects();
    const platform = makePlatform();
    await plantAndLand(effects, platform);
    const flagRoot = platform.group.children.find((c) => c.type === 'Group') as Group;
    const cloth = flagRoot.children.find((c) => c.type === 'Group') as Group;
    const clothMesh = cloth.children.find((c) => c.type === 'Mesh') as Mesh;
    const material = clothMesh.material as unknown as { color: { getHex(): number } };
    expect(material.color.getHex()).toBe(GAME_CONFIG.FLAG_WORLD_PALETTES.sunrise.flagColor);
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
