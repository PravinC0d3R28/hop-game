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
import { getActivePalette } from '../src/config/CrystalStructures';
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
          // Cluster bases must sit below the tile plane (tiles span −0.4..+0.4)
          // so crystals rise out of the cloud instead of floating at tile height.
          expect(recipe.baseY).toBeLessThan(-1);
          for (const f of recipe.families) {
            expect(typeof f.base).toBe('number');
            // Derived tones must differ from the base or facets go flat.
            expect(f.base).not.toBe(f.cream);
          }
        }
        if (recipe.family === 'cloudsea') {
          expect(recipe.spread).toBeGreaterThan(0);
          expect(recipe.depth).toBeGreaterThan(0);
          expect(recipe.cols).toBeGreaterThan(1);
          expect(recipe.rows).toBeGreaterThan(1);
          // The deck's crest belongs under the tiles so the path floats above it.
          expect(recipe.top).toBeLessThan(0);
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

  it('edges follow the locked decisions (warm dark Sunrise, black elsewhere)', () => {
    // The palette doc (Sunrise_Peaks_Selected_Palettes.md) locks the outline as
    // "Dark Cocoa / Plum Black" #4A3638, shared across both palette variants.
    // Dusk/Void keep spike-lock black until their passes.
    expect(WORLD_LOOKS.sunrise.platformEdge).toBe(getActivePalette().outline);
    expect(WORLD_LOOKS.sunrise.platformEdge).toBe(0x4a3638);
    // Dusk shares the warm dark outline. Void stays on the spike-lock black
    // until its own pass.
    expect(WORLD_LOOKS.dusk.platformEdge).toBe(0x4a3638);
    expect(WORLD_LOOKS.void.platformEdge).toBe(0x111111);
  });

  it('every look carries a blob-shadow tint (world-owned, not theme-owned)', () => {
    for (const world of WORLDS) {
      expect(typeof WORLD_LOOKS[world.id].shadow).toBe('number');
    }
    // Sunrise's shadow is now palette-owned rather than the legacy constant.
    expect(WORLD_LOOKS.sunrise.shadow).toBe(getActivePalette().shadow);
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
    expect(look.motionCue.color).toBe(0x20e6ea);
  });

  it('Sunrise owns the sun rays and the score-mood sky; Dusk owns a sunset ramp', () => {
    expect(WORLD_LOOKS.sunrise.sunRays).toBe(true);
    expect(WORLD_LOOKS.dusk.sunRays).toBeUndefined();
    const stops = WORLD_LOOKS.dusk.skyStops ?? [];
    expect(stops.length).toBeGreaterThanOrEqual(5);
    const lums = stops.map((hex) => luminance(hex));
    const brightest = Math.max(...lums);
    const at = lums.indexOf(brightest);
    // The sun sits in the upper-middle of this downward camera, not at either edge.
    expect(at).toBeGreaterThan(1);
    expect(at).toBeLessThan(stops.length - 1);
    expect(lums[0]).toBeLessThan(brightest);
    expect(lums[lums.length - 1]).toBeLessThan(brightest);
    const families = WORLD_LOOKS.dusk.props.map((p) => p.family);
    expect(families).toContain('city');
    expect(families).not.toContain('crystalfield');
    expect(families).not.toContain('cloudsea');
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

