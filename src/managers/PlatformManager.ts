import type { Scene } from 'three';
import { MeshToonMaterial } from 'three';
import { GAME_CONFIG } from '../config/GameConfig';
import { PlatformEntity, type PlatformData } from '../entities/PlatformEntity';
import type { GameStateManager } from '../core/GameStateManager';
import { gsap } from 'gsap';

const SWAY_PHASE_STEP = 1.7;

/** Every Nth platform stays static (1 = all static). ratio ≥ 1 → 0 (never static). */
function staticCadence(ratio: number): number {
  if (ratio >= 1) return 0;
  return Math.max(1, Math.round(1 / (1 - ratio)));
}

/**
 * Pool of VISIBLE_STEPS platforms. Mirrors the original `cr` array + `Ay()`
 * recycling and `by()` initialization.
 */
export class PlatformManager {
  private platforms: PlatformData[] = [];
  private lastIndex: number;
  private lastZ: number;

  /**
   * First-run tutorial lesson layout. Returns the forced geometry for a tile
   * index ({ x } lane and/or { coins } guarantee), or null for the normal
   * random runway. Cleared once the guided run ends.
   */
  private guidedLayout: ((index: number) => { x?: number; coins?: boolean } | null) | null = null;

  constructor(
    private scene: Scene,
    private state: GameStateManager
  ) {
    this.lastIndex = GAME_CONFIG.VISIBLE_STEPS - 1;
    this.lastZ = this.lastIndex * GAME_CONFIG.PLATFORM_SPACING_Z;
  }

  /** Set (or clear, with null) the guided tutorial's forced lesson layout. */
  setGuidedLayout(fn: ((index: number) => { x?: number; coins?: boolean } | null) | null): void {
    this.guidedLayout = fn;
  }

  /** True when the current layout guarantees a coin on this tile index. */
  private guidedCoins(index: number): boolean {
    return !!this.guidedLayout && this.guidedLayout(index)?.coins === true;
  }

  getPlatforms(): PlatformData[] {
    return this.platforms;
  }

  getPlatformByIndex(index: number): PlatformData | undefined {
    return this.platforms.find((p) => p.index === index);
  }

  /**
   * Frontmost platform z + current spacing. Always strictly ahead of every
   * existing platform, regardless of spacing changes (sawtooth gates).
   */
  getNextZ(): number {
    return this.lastZ + this.state.getPlatformSpacing();
  }

  private randomPlatformX(index: number): number {
    if (index <= 1) return 0;
    const forced = this.guidedLayout?.(index);
    if (forced && typeof forced.x === 'number') return forced.x;
    const range = this.state.getXRange();
    return (Math.random() - 0.5) * 2 * range;
  }

  /** Create the initial 6 platforms (original `by` for r=0..5). */
  initializePlatforms(): void {
    this.platforms = [];
    this.lastIndex = GAME_CONFIG.VISIBLE_STEPS - 1;
    this.lastZ = this.lastIndex * GAME_CONFIG.PLATFORM_SPACING_Z;
    for (let i = 0; i < GAME_CONFIG.VISIBLE_STEPS; i++) {
      const z = i * GAME_CONFIG.PLATFORM_SPACING_Z;
      const x = this.randomPlatformX(i);
      const scale = this.state.getPlatformScale();
      const startY = i <= 2 ? 0 : -5;
      const platform = PlatformEntity.create(i, x, z, scale, startY, this.scene);
      if (i > 2 || this.guidedCoins(i)) PlatformEntity.addCoin(platform, this.scene, this.guidedCoins(i));
      this.platforms.push(platform);
      if (i > 2) {
        PlatformEntity.riseAnimation(platform);
      }
    }
  }

  /** Mirrors `Ay()`: recycle any platform behind the ball (index < currentStep-3). */
  recycle(): void {
    const currentStep = this.state.getState().currentStep;
    for (const platform of this.platforms) {
      if (platform.index < currentStep - 3) {
        this.lastIndex++;
        this.lastZ += this.state.getPlatformSpacing();
        const newIndex = this.lastIndex;
        const z = this.lastZ;
        const x = this.randomPlatformX(newIndex);
        const scale = this.state.getPlatformScale();
        PlatformEntity.recycle(platform, newIndex, x, z, scale, this.scene);
      }
    }
  }

  /** Strip every coin from the runway (attract demo: no coins on screen). */
  clearCoins(): void {
    for (const platform of this.platforms) {
      PlatformEntity.clearCoins(platform);
    }
  }

  /** Total coin pickups currently on the runway (debug/inspection). */
  coinCount(): number {
    return this.platforms.reduce((n, p) => n + p.coins.length, 0);
  }

  /** Coin idle animation: rotation + bob (original `Hy`). */
  updateCoins(delta: number, now: number): void {
    for (const platform of this.platforms) {
      for (const coin of platform.coins) {
        if (coin.collected) continue;
        coin.group.rotation.y += delta * 2.5;
        coin.group.position.y =
          GAME_CONFIG.PLATFORM_HEIGHT / 2 +
          GAME_CONFIG.COIN_RADIUS +
          0.15 +
          Math.sin(now * 0.004) * 0.08;
      }
    }
  }

  /**
   * Per-world sway. Platforms sways with a deterministic cadence derived from
   * `sway.ratio` (every Nth stays static); Sunrise (amp 0) stays perfectly still
   * = exact parity with the legacy game.
   */
  updateSway(now: number): void {
    const sway = this.state.getActiveWorld().sway;
    const staticEvery = staticCadence(sway.ratio);
    const t = now * 0.001;
    for (const platform of this.platforms) {
      const isStatic = sway.amplitude <= 0 || (staticEvery > 0 && platform.index % staticEvery === 0);
      if (isStatic) {
        if (platform.swayOffset !== 0) {
          platform.swayOffset = 0;
          platform.group.position.x = platform.platformX;
        }
        continue;
      }
      const offset = Math.sin(t * sway.speed + platform.index * SWAY_PHASE_STEP) * sway.amplitude;
      platform.swayOffset = offset;
      platform.group.position.x = platform.platformX + offset;
    }
  }

  /** Reset for a new run (original `Vy` platform block). */
  reset(): void {
    this.lastIndex = GAME_CONFIG.VISIBLE_STEPS - 1;
    this.lastZ = this.lastIndex * GAME_CONFIG.PLATFORM_SPACING_Z;
    for (let i = 0; i < this.platforms.length; i++) {
      const platform = this.platforms[i];
      PlatformEntity.clearCoins(platform);
      platform.index = i;
      platform.z = i * GAME_CONFIG.PLATFORM_SPACING_Z;
      platform.platformX = this.randomPlatformX(i);
      platform.swayOffset = 0;
      PlatformEntity.resetPosition(platform, platform.platformX, platform.z);
      (platform.mesh.material as MeshToonMaterial).color.setHex(PlatformEntity.platformColor(i));
      if (i > 2 || this.guidedCoins(i)) PlatformEntity.addCoin(platform, this.scene, this.guidedCoins(i));
    }
  }

  dispose(): void {
    for (const platform of this.platforms) {
      PlatformEntity.clearCoins(platform);
      gsap.killTweensOf(platform.group.position);
      this.scene.remove(platform.group);
      platform.group.traverse((obj) => {
        const m = obj as { material?: { dispose?: () => void }; geometry?: { dispose?: () => void } };
        m.material?.dispose?.();
      });
    }
    this.platforms = [];
  }
}
