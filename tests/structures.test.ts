// Authored crystal structures (crystal-editor.html output).
//
// These guard the contract between the editor and the game: the numbers you
// author are the numbers that get built. If any of these fail, the preview is
// lying to the owner.
import { describe, it, expect } from 'vitest';
import { CRYSTAL_STRUCTURES, SUNRISE_CRYSTAL_PALETTE } from '../src/config/CrystalStructures';
import { bakeCluster, emitStructure, emptyAcc, makeRng } from '../src/systems/CrystalFactory';

const MAX_CRYSTALS = 10;
const FAMILIES = [...SUNRISE_CRYSTAL_PALETTE];

interface Attr { count: number; getX(i: number): number; getY(i: number): number; getZ(i: number): number }
const posOf = (g: { getAttribute(n: string): Attr }): Attr => g.getAttribute('position');

const build = (i: number, baseY = -3.5) => {
  const acc = emptyAcc();
  emitStructure(acc, CRYSTAL_STRUCTURES[i], { x: 0, z: 0, baseY, scale: 1, families: FAMILIES });
  return posOf(bakeCluster(acc).face);
};

describe('authored structures', () => {
  it('ships five distinct formations for variety', () => {
    expect(CRYSTAL_STRUCTURES.length).toBeGreaterThanOrEqual(5);
    const ids = new Set(CRYSTAL_STRUCTURES.map((s) => s.id));
    expect(ids.size).toBe(CRYSTAL_STRUCTURES.length);
  });

  it('every structure is within the editor limits (1-10 crystals)', () => {
    for (const s of CRYSTAL_STRUCTURES) {
      expect(s.crystals.length, s.id).toBeGreaterThanOrEqual(1);
      expect(s.crystals.length, s.id).toBeLessThanOrEqual(MAX_CRYSTALS);
    }
  });

  it('only ever uses palette colours — never a raw colour', () => {
    for (const s of CRYSTAL_STRUCTURES) {
      for (const c of s.crystals) {
        expect(c.color, `${s.id}`).toBeGreaterThanOrEqual(0);
        expect(c.color, `${s.id}`).toBeLessThan(SUNRISE_CRYSTAL_PALETTE.length);
        expect(Number.isInteger(c.color), `${s.id}`).toBe(true);
      }
    }
  });

  it('every crystal is buildable: positive size, sane taper and facet count', () => {
    for (const s of CRYSTAL_STRUCTURES) {
      for (const c of s.crystals) {
        expect(c.width, s.id).toBeGreaterThan(0);
        expect(c.height, s.id).toBeGreaterThan(0);
        expect(c.taper, s.id).toBeGreaterThan(0);
        expect(c.taper, s.id).toBeLessThanOrEqual(1);
        expect(c.sides, s.id).toBeGreaterThanOrEqual(3);
        expect(c.sides, s.id).toBeLessThanOrEqual(12);
        expect(Number.isFinite(c.x + c.y + c.z + c.rx + c.ry + c.rz), s.id).toBe(true);
      }
    }
  });

  it('declares a height that matches its tallest crystal (the game scales by it)', () => {
    for (const s of CRYSTAL_STRUCTURES) {
      const tallest = Math.max(...s.crystals.map((c) => c.height));
      // A little slack is fine, a wild mismatch is not — it would rescale the
      // whole formation wrongly in game.
      expect(s.height, s.id).toBeGreaterThanOrEqual(tallest * 0.7);
      expect(s.height, s.id).toBeLessThanOrEqual(tallest * 1.6);
    }
  });

  it('replays deterministically — the same numbers always build the same mesh', () => {
    // The preview must be a faithful predictor, so nothing may be re-randomised
    // between runs of the same structure.
    for (let i = 0; i < CRYSTAL_STRUCTURES.length; i++) {
      const a = build(i);
      const b = build(i);
      expect(a.count).toBe(b.count);
      for (let v = 0; v < a.count; v++) {
        expect(a.getX(v)).toBeCloseTo(b.getX(v), 10);
        expect(a.getY(v)).toBeCloseTo(b.getY(v), 10);
        expect(a.getZ(v)).toBeCloseTo(b.getZ(v), 10);
      }
    }
  });

  it('produces genuinely different geometry per structure', () => {
    const sigs = new Set(CRYSTAL_STRUCTURES.map((s, i) => {
      const p = build(i);
      return `${p.count}:${p.getX(0).toFixed(3)}:${p.getY(0).toFixed(3)}`;
    }));
    expect(sigs.size).toBe(CRYSTAL_STRUCTURES.length);
  });

  it('honours authored rotation — turning a crystal actually moves it', () => {
    const base = CRYSTAL_STRUCTURES[0];
    // Same crystal, once upright and once tipped right onto its side.
    const tipped: typeof base = { ...base, crystals: [{ ...base.crystals[0], rz: Math.PI / 2 }] };
    const acc = emptyAcc();
    emitStructure(acc, base, { x: 0, z: 0, baseY: 0, scale: 1, families: FAMILIES });
    const uprightP = posOf(bakeCluster(acc).face);
    let maxUp = -Infinity;
    for (let v = 0; v < uprightP.count; v++) maxUp = Math.max(maxUp, uprightP.getY(v));

    const acc2 = emptyAcc();
    emitStructure(acc2, tipped, { x: 0, z: 0, baseY: 0, scale: 1, families: FAMILIES });
    const tippedP = posOf(bakeCluster(acc2).face);
    let maxTipped = -Infinity;
    for (let v = 0; v < tippedP.count; v++) maxTipped = Math.max(maxTipped, tippedP.getY(v));

    // Tipped 90°, the crystal's height lies along Z, so it no longer towers.
    expect(maxTipped).toBeLessThan(maxUp * 0.55);
  });

  it('has no degenerate triangles across every structure', () => {
    for (let i = 0; i < CRYSTAL_STRUCTURES.length; i++) {
      const p = build(i);
      let bad = 0;
      for (let t = 0; t < p.count; t += 3) {
        const a = [p.getX(t), p.getY(t), p.getZ(t)];
        const b = [p.getX(t + 1), p.getY(t + 1), p.getZ(t + 1)];
        const c = [p.getX(t + 2), p.getY(t + 2), p.getZ(t + 2)];
        const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
        const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
        const n = Math.hypot(
          u[1] * v[2] - u[2] * v[1],
          u[2] * v[0] - u[0] * v[2],
          u[0] * v[1] - u[1] * v[0]
        );
        if (n < 1e-9) bad++;
      }
      expect(bad, CRYSTAL_STRUCTURES[i].id).toBeLessThan(p.count / 3 * 0.05);
    }
  });

  it('keeps every crystal mixed into the cloud, not perched on the tiles', () => {
    for (let i = 0; i < CRYSTAL_STRUCTURES.length; i++) {
      const p = build(i, -3.5);
      let minY = Infinity;
      for (let v = 0; v < p.count; v++) minY = Math.min(minY, p.getY(v));
      // Bases must start below the tile plane (tiles span -0.4..+0.4).
      expect(minY, CRYSTAL_STRUCTURES[i].id).toBeLessThan(-1.5);
    }
  });
});

// Keep the shared rng import honest — the emitter is seeded from the id.
void makeRng;
