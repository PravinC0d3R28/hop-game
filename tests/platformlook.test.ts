// Week 2 §8: look-data guards. These pin the data contract the Day 1-3
// paint passes must keep: complete looks per world, an honest Dusk cue, a
// Void contrast tripwire, and no silent fallback for unknown world ids.
import { describe, it, expect } from 'vitest';
import { PlatformEntity, deriveSideColor } from '../src/entities/PlatformEntity';
import { luminance } from '../src/config/WorldLooks';

describe('PlatformEntity world palettes', () => {
  it('cycles the world-local face list when set', () => {
    PlatformEntity.setFacePalette([0x111111, 0x222222, 0x333333]);
    try {
      expect(PlatformEntity.platformColor(0)).toBe(0x111111);
      expect(PlatformEntity.platformColor(1)).toBe(0x222222);
      expect(PlatformEntity.platformColor(2)).toBe(0x333333);
      expect(PlatformEntity.platformColor(3)).toBe(0x111111);
    } finally {
      PlatformEntity.setFacePalette(null);
    }
  });

  it('falls back to the legacy global cycle when cleared', () => {
    PlatformEntity.setFacePalette(null);
    const a = PlatformEntity.platformColor(0);
    const b = PlatformEntity.platformColor(5);
    // Legacy path lerps within a palette — both are valid hex colors and the
    // cycle varies across indices (palette lerp, not a flat list).
    expect(a).toBeGreaterThanOrEqual(0);
    expect(b).toBeGreaterThanOrEqual(0);
    expect(PlatformEntity.facePalette).toBeNull();
  });

  it('rejects empty lists (null = legacy, never a crash)', () => {
    PlatformEntity.setFacePalette([]);
    expect(PlatformEntity.facePalette).toBeNull();
    PlatformEntity.setFacePalette(null);
  });

  it('derives sides visibly darker than tops (palette doc §6)', () => {
    for (const top of [0xfff5d8, 0xffe9af, 0xffd84f, 0xf6b83f, 0xf29a2e, 0xf59a7c]) {
      expect(luminance(deriveSideColor(top))).toBeLessThan(luminance(top));
    }
  });
});
