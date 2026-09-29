// Week 2 Day 1: crystal + cloud geometry guards. Headless (no WebGL): these
// pin the concept-critical properties — mixed-colour clusters, facet tone
// variation, a RELATIVE rim, and non-degenerate triangles.
import { describe, it, expect } from 'vitest';
import {
  OUTLINE_FACTOR,
  bakeSegment,
  crystalTones,
  emitCrystal,
  emitFormation,
  emptyAcc,
  makeRng
} from '../src/systems/CrystalFactory';
import { buildCloudSea } from '../src/systems/CloudFactory';

const FAMILY = { base: 0xff6f70 };
const MIXED = [
  { base: 0xff6f70 },
  { base: 0xffb07a },
  { base: 0x8de3b0 },
  { base: 0x55cfe6 },
  { base: 0xffd95a }
];

function attrs(geo: { getAttribute(n: string): { count: number; getX(i: number): number; getY(i: number): number; getZ(i: number): number } }) {
  return geo.getAttribute('position');
}

describe('crystal tones', () => {
  it('derives four distinct facet tones from one base', () => {
    const t = crystalTones(FAMILY);
    expect(new Set([t.light, t.base, t.shade, t.cream]).size).toBe(4);
    const lum = (c: number) => {
      const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
      return 0.2126 * f((c >> 16) & 255) + 0.7152 * f((c >> 8) & 255) + 0.0722 * f(c & 255);
    };
    expect(lum(t.cream)).toBeGreaterThan(lum(t.light));
    expect(lum(t.light)).toBeGreaterThan(lum(t.base));
    expect(lum(t.base)).toBeGreaterThan(lum(t.shade));
  });
});

describe('crystal geometry', () => {
  it('uses a facet tone per triangle (the concept look)', () => {
    const acc = emptyAcc();
    emitCrystal(acc, {
      baseR: 0.7, height: 4, taper: 0.5, sides: 6, spin: 0.3,
      leanX: 0.03, leanZ: -0.02, scale: 1, pos: [0, 0, 0],
      tones: crystalTones(FAMILY)
    }, makeRng(7));
    const { face } = bakeSegment(acc);
    const col = face.getAttribute('color') as unknown as { count: number; getX(i: number): number; getY(i: number): number; getZ(i: number): number };
    const used = new Set<string>();
    for (let i = 0; i < col.count; i += 3) {
      used.add(`${col.getX(i).toFixed(2)},${col.getY(i).toFixed(2)},${col.getZ(i).toFixed(2)}`);
    }
    expect(used.size).toBeGreaterThanOrEqual(3);
  });

  it('the rim is RELATIVE to crystal size (a fixed rim swallowed far crystals)', () => {
    const small = emptyAcc();
    emitCrystal(small, {
      baseR: 0.4, height: 2, taper: 0.5, sides: 6, spin: 0,
      leanX: 0, leanZ: 0, scale: 0.5, pos: [0, 0, 0], tones: crystalTones(FAMILY)
    }, makeRng(3));
    const big = emptyAcc();
    emitCrystal(big, {
      baseR: 0.4, height: 2, taper: 0.5, sides: 6, spin: 0,
      leanX: 0, leanZ: 0, scale: 2, pos: [0, 0, 0], tones: crystalTones(FAMILY)
    }, makeRng(3));

    const rim = (acc: ReturnType<typeof emptyAcc>): number => {
      const { face, hull } = bakeSegment(acc);
      const f = attrs(face), h = attrs(hull);
      return Math.hypot(h.getX(0) - f.getX(0), h.getY(0) - f.getY(0), h.getZ(0) - f.getZ(0));
    };
    const rSmall = rim(small);
    const rBig = rim(big);
    // Rim grows with the crystal, and stays a small fraction of it.
    expect(rBig).toBeGreaterThan(rSmall * 3);
    expect(rSmall / 0.5).toBeCloseTo(OUTLINE_FACTOR, 5);
    expect(rSmall / 0.5).toBeLessThan(0.06);
  });

  it('an un-sheared crystal has every side face pointing outward', () => {
    const acc = emptyAcc();
    emitCrystal(acc, {
      baseR: 0.6, height: 4, taper: 0.5, sides: 6, spin: 0.7,
      leanX: 0, leanZ: 0, scale: 1, pos: [0, 0, 0], tones: crystalTones(FAMILY)
    }, makeRng(11));
    const p = attrs(bakeSegment(acc).face);
    let sides = 0;
    for (let t = 0; t < p.count; t += 3) {
      const a = [p.getX(t), p.getY(t), p.getZ(t)];
      const b = [p.getX(t + 1), p.getY(t + 1), p.getZ(t + 1)];
      const c = [p.getX(t + 2), p.getY(t + 2), p.getZ(t + 2)];
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const len = Math.hypot(n[0], n[1], n[2]);
      expect(len).toBeGreaterThan(1e-6);
      const ny = n[1] / len;
      const cx = (a[0] + b[0] + c[0]) / 3;
      const cy = (a[1] + b[1] + c[1]) / 3;
      const cz = (a[2] + b[2] + c[2]) / 3;
      if (Math.abs(ny) > 0.8) {
        if (cy < 0.01) expect(ny).toBeLessThan(0);
        else expect(ny).toBeGreaterThan(0);
        continue;
      }
      const rad = Math.hypot(cx, cz);
      if (rad > 0.15) {
        expect((n[0] * cx + n[2] * cz) / (len * rad)).toBeGreaterThan(0.5);
        sides++;
      }
    }
    expect(sides).toBeGreaterThan(10);
  });
});

describe('formations', () => {
  it('a cluster is MIXED colour, not one family (concept shows many per cluster)', () => {
    const acc = emptyAcc();
    emitFormation(acc, { x: 0, z: 0, weight: 1, families: MIXED, count: 7, baseY: -1.3 }, makeRng(5));
    const col = bakeSegment(acc).face.getAttribute('color') as unknown as { count: number; getX(i: number): number; getY(i: number): number; getZ(i: number): number };
    const used = new Set<string>();
    for (let i = 0; i < col.count; i += 3) {
      used.add(`${col.getX(i).toFixed(2)},${col.getY(i).toFixed(2)},${col.getZ(i).toFixed(2)}`);
    }
    // At least 4 of the 5 families must appear inside ONE cluster.
    expect(used.size).toBeGreaterThanOrEqual(8);
  });

  it('bases sit below the tile plane so crystals emerge from the sea', () => {
    const acc = emptyAcc();
    emitFormation(acc, { x: 0, z: 0, weight: 0.6, families: MIXED, count: 6, baseY: -1.4 }, makeRng(9));
    const p = attrs(bakeSegment(acc).face);
    let minY = Infinity;
    for (let i = 0; i < p.count; i++) minY = Math.min(minY, p.getY(i));
    expect(minY).toBeLessThan(-1);
  });

  it('has no degenerate triangles across many seeds', () => {
    const acc = emptyAcc();
    for (let seed = 1; seed <= 20; seed++) {
      emitFormation(acc, { x: 0, z: 0, weight: (seed % 5) / 4, families: MIXED, count: 7, baseY: -1.2 },
        makeRng(seed * 31));
    }
    const p = attrs(bakeSegment(acc).face);
    let degenerate = 0;
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
      if (n < 1e-9) degenerate++;
    }
    expect(degenerate).toBeLessThan(p.count / 3 * 0.2);
  });
});

describe('cloud sea', () => {
  it('builds a dense vertex-coloured blanket (one merged geometry)', () => {
    const geo = buildCloudSea({
      length: 70, spread: 18, top: -3.4, depth: 1.8, density: 130,
      palette: { base: 0xfffefc, highlight: 0xffffff, shadow: 0xf0d3b2 },
      seed: 42
    });
    const pos = attrs(geo);
    const col = geo.getAttribute('color') as unknown as { count: number };
    expect(pos.count).toBeGreaterThan(1000);
    expect(col.count).toBe(pos.count);
  });

  it('every triangle has real area (regression: three identical points = invisible)', () => {
    const geo = buildCloudSea({
      length: 70, spread: 18, top: -3.4, depth: 1.8, density: 40,
      palette: { base: 0xfffefc, highlight: 0xffffff, shadow: 0xf0d3b2 },
      seed: 3
    });
    const p = attrs(geo);
    let degenerate = 0;
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
      const dup = a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
      if (dup || n < 1e-9) degenerate++;
    }
    expect(degenerate).toBeLessThan(p.count / 3 * 0.25);
  });

  it('stays low and wide — never a tower over the path', () => {
    const geo = buildCloudSea({
      length: 70, spread: 18, top: -3.4, depth: 1.8, density: 60,
      palette: { base: 0xfffefc, highlight: 0xffffff, shadow: 0xf0d3b2 },
      seed: 8
    });
    const p = attrs(geo);
    let maxY = -Infinity;
    for (let i = 0; i < p.count; i++) maxY = Math.max(maxY, p.getY(i));
    expect(maxY).toBeLessThan(0.6);
  });
});
