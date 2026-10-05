import { describe, it, expect } from 'vitest';
import { MeshToonMaterial } from 'three';
import { PlatformEntity } from '../src/entities/PlatformEntity';
import type { PlatformData } from '../src/entities/PlatformEntity';
import {
  DUSK_CORRIDOR,
  blockClearance,
  buildDuskCity,
  buildDuskHorizon,
  duskFrontInner,
  planDuskCity
} from '../src/worlds/dusk/DuskCity';
import { DUSK_RIBBON, DUSK_SIDES } from '../src/worlds/dusk/DuskPalette';

const DESKTOP = { fovDeg: 55, aspect: 16 / 9 };
const PHONE = { fovDeg: 71, aspect: 390 / 844 };
const LEN = 240;

function minAbsX(geo: { getAttribute(name: string): { count: number; getX(i: number): number } | null }): number {
  const pos = geo.getAttribute('position');
  if (!pos || pos.count === 0) return Infinity;
  let min = Infinity;
  for (let i = 0; i < pos.count; i++) {
    const ax = Math.abs(pos.getX(i));
    if (ax < min) min = ax;
  }
  return min;
}

describe('Dusk canyon layout', () => {
  it('repeats exactly for the same seed and frame', () => {
    const a = planDuskCity(42017, DESKTOP, LEN);
    const b = planDuskCity(42017, DESKTOP, LEN);
    expect(a).toEqual(b);
    const c = planDuskCity(7, DESKTOP, LEN);
    expect(c).not.toEqual(a);
  });

  it('keeps every solid and every lantern outside the hop corridor', () => {
    for (const frame of [DESKTOP, PHONE]) {
      const blocks = planDuskCity(99, frame, LEN);
      expect(blocks.length).toBeGreaterThan(20);
      for (const b of blocks) {
        expect(blockClearance(b)).toBeGreaterThanOrEqual(DUSK_CORRIDOR - 0.02);
      }
    }
  });

  it('places separate buildings on both sides, with a gap between them', () => {
    const blocks = planDuskCity(42017, DESKTOP, LEN);
    for (const side of [-1, 1] as const) {
      const spans = blocks
        .filter((b) => b.side === side && (b.kind === 'wall' || b.kind === 'tower' || b.kind === 'arch' || b.kind === 'terrace'))
        .map((b) => [b.z0, b.z1] as [number, number])
        .sort((a, b) => a[0] - b[0]);
      expect(spans.length).toBeGreaterThan(6);
      let gaps = 0;
      for (let i = 1; i < spans.length; i++) {
        expect(spans[i][0]).toBeGreaterThanOrEqual(spans[i - 1][1] - 0.02);
        if (spans[i][0] > spans[i - 1][1] + 1.5) gaps++;
      }
      expect(gaps).toBeGreaterThan(4);
    }
    const kinds = new Set(blocks.map((b) => b.kind));
    expect(kinds.has('tower')).toBe(true);
    expect(kinds.has('arch')).toBe(true);
    expect(kinds.has('lantern')).toBe(true);
    expect(kinds.has('back')).toBe(true);
  });

  it('opens the canyon on a wide screen and pulls it in on a phone', () => {
    expect(duskFrontInner(DESKTOP)).toBeGreaterThan(duskFrontInner(PHONE));
    expect(duskFrontInner(PHONE)).toBe(DUSK_CORRIDOR);
    expect(duskFrontInner(DESKTOP)).toBeGreaterThan(DUSK_CORRIDOR);
    expect(duskFrontInner(DESKTOP)).toBeLessThan(8);
  });

  it('bakes the chunk without putting vertices on the path', () => {
    const built = buildDuskCity(42017, DESKTOP, LEN);
    for (const geo of [built.face, built.lanterns, built.glows]) {
      expect(geo.getAttribute('position').count).toBeGreaterThan(30);
      expect(minAbsX(geo)).toBeGreaterThanOrEqual(DUSK_CORRIDOR - 0.02);
      const pos = geo.getAttribute('position');
      for (let i = 0; i < pos.count; i++) {
        const z = pos.getZ(i);
        expect(z).toBeGreaterThanOrEqual(-0.5);
        expect(z).toBeLessThanOrEqual(LEN + 0.5);
      }
    }
  });

  it('puts roof lanterns on towers and wall lanterns on the inner rows, with nothing floating', () => {
    const blocks = planDuskCity(42017, DESKTOP, LEN);
    expect(blocks.some((b) => b.kind === 'float')).toBe(false);
    expect(blocks.some((b) => b.piece === 'lantern-beacon' || b.piece === 'lantern-beacon-rose')).toBe(true);
    const nearWall = duskFrontInner(DESKTOP) + 1.15;
    expect(blocks.some((b) => b.kind === 'lantern' && b.inner > nearWall + 3)).toBe(true);
    const horizon = buildDuskHorizon(42017);
    expect(horizon.lanterns.getAttribute('position').count).toBe(0);
    expect(horizon.glow.getAttribute('position').count).toBe(0);
  });
});

describe('Dusk tiles', () => {
  it('uses the dusk side list and shows the cyan ribbon only when the cue is on', () => {
    const top = new MeshToonMaterial();
    const side = new MeshToonMaterial();
    const platform = { index: 1, topMat: top, sideMat: side, group: { getObjectByName: () => null } } as unknown as PlatformData;
    PlatformEntity.setSidePalette(DUSK_SIDES);
    PlatformEntity.setFaceColors(platform, 0xfff0cf);
    expect(side.color.getHex()).toBe(DUSK_SIDES[1]);
    PlatformEntity.setSidePalette(null);
    PlatformEntity.setFaceColors(platform, 0xfff0cf);
    expect(side.color.getHex()).not.toBe(DUSK_SIDES[1]);

    let visible = true;
    const ribbon = { visible };
    const live = {
      group: { getObjectByName: () => ribbon }
    } as unknown as PlatformData;
    PlatformEntity.setMotionCue({ color: DUSK_RIBBON, strength: 1 });
    PlatformEntity.syncMotionCue(live);
    expect(ribbon.visible).toBe(true);
    PlatformEntity.setMotionCue({ color: DUSK_RIBBON, strength: 0 });
    PlatformEntity.syncMotionCue(live);
    expect(ribbon.visible).toBe(false);
    PlatformEntity.setSidePalette(null);
    PlatformEntity.setMotionCue({ color: DUSK_RIBBON, strength: 0 });
  });
});
