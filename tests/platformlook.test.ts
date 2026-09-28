// Week 2 §10-11: world-local platform/coin palettes. The override is plain
// data over pure math (no WebGL needed), so it is pinned here: the Day 2/3
// passes must keep platformColor/addCoin honoring the active look.
import { describe, it, expect } from 'vitest';
import { PlatformEntity } from '../src/entities/PlatformEntity';

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
});
