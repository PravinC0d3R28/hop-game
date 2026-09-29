// Week 2 §8: look-data guards. These pin the data contract the Day 1-3
// paint passes must keep: complete looks per world, an honest Dusk cue, a
// Void contrast tripwire, and no silent fallback for unknown world ids.
import { describe, it, expect } from 'vitest';
import {
  WORLD_LOOKS,
  VOID_CONTRAST_FLOOR,
  contrastRatio,
  getWorldLook,
  luminance
} from '../src/config/WorldLooks';
import { WORLDS } from '../src/config/Worlds';

describe('WorldLook completeness', () => {
  it('every WorldId has a complete look', () => {
    for (const world of WORLDS) {
      const look = WORLD_LOOKS[world.id];
      expect(look, world.id).toBeDefined();
      expect(look.id).toBe(world.id);
      expect(look.platformFaces.length).toBeGreaterThan(0);
      expect(look.props.length).toBeGreaterThan(0);
      expect(look.fogNear).toBeGreaterThan(0);
      expect(look.fogFar).toBeGreaterThan(look.fogNear);
      for (const recipe of look.props) {
        expect(recipe.count).toBeGreaterThan(0);
        expect(recipe.parallax).toBeGreaterThanOrEqual(0);
        expect(recipe.parallax).toBeLessThanOrEqual(1);
        if (recipe.family === 'crystalfield') {
          expect(recipe.families.length).toBeGreaterThan(0);
          expect(recipe.perFormation).toBeGreaterThanOrEqual(2);
          for (const f of recipe.families) {
            expect(typeof f.base).toBe('number');
            // Derived tones must differ from the base or facets go flat.
            expect(f.base).not.toBe(f.cream);
          }
        }
        if (recipe.family === 'cloudsea') {
          expect(recipe.density).toBeGreaterThan(0);
          expect(recipe.spread).toBeGreaterThan(0);
          expect(recipe.depth).toBeGreaterThan(0);
        }
      }
    }
  });

  it('Sunrise ships both a crystal field and a cloud sea (concept structure)', () => {
    const families = WORLD_LOOKS.sunrise.props.map((p) => p.family);
    expect(families).toContain('crystalfield');
    expect(families).toContain('cloudsea');
  });

  it('unknown world ids throw instead of silently falling back', () => {
    expect(() => getWorldLook('bogus' as never)).toThrow(/unknown world id/);
    expect(() => getWorldLook('')).toThrow(/unknown world id/);
  });

  it('edges follow the locked decisions (charcoal Sunrise, black elsewhere)', () => {
    // Owner pick 2026-09-02: Sunrise hulls warmed to charcoal (reads black,
    // sits in dawn). Dusk/Void keep spike-lock black until their passes.
    expect(WORLD_LOOKS.sunrise.platformEdge).toBe(0x3b302d);
    expect(WORLD_LOOKS.dusk.platformEdge).toBe(0x111111);
    expect(WORLD_LOOKS.void.platformEdge).toBe(0x111111);
  });

  it('every look carries a blob-shadow tint (world-owned, not theme-owned)', () => {
    for (const world of WORLDS) {
      expect(typeof WORLD_LOOKS[world.id].shadow).toBe('number');
    }
    // Sunrise keeps the exact legacy light-theme shadow: zero behavior change.
    expect(WORLD_LOOKS.sunrise.shadow).toBe(0xb8a898);
  });
});

describe('Dusk motion cue', () => {
  it('Sunrise never shows the cue; Dusk/Void always do', () => {
    expect(WORLD_LOOKS.sunrise.motionCue.strength).toBe(0);
    expect(WORLD_LOOKS.dusk.motionCue.strength).toBeGreaterThan(0);
    expect(WORLD_LOOKS.void.motionCue.strength).toBeGreaterThan(0);
  });

  it('Dusk cue color is distinct from its static platform edge', () => {
    const look = WORLD_LOOKS.dusk;
    expect(look.motionCue.color).not.toBe(look.platformEdge);
  });
});

describe('Void contrast floor', () => {
  it('lightest Void face vs sky stays above the documented floor', () => {
    const look = WORLD_LOOKS.void;
    const best = Math.max(...look.platformFaces.map((f) => contrastRatio(f, look.skyBottom)));
    expect(best).toBeGreaterThanOrEqual(VOID_CONTRAST_FLOOR);
  });

  it('contrast helper matches WCAG math (black vs white = 21)', () => {
    expect(contrastRatio(0x000000, 0xffffff)).toBeCloseTo(21, 1);
    expect(luminance(0xffffff)).toBeCloseTo(1, 3);
    expect(luminance(0x000000)).toBeCloseTo(0, 3);
  });
});
