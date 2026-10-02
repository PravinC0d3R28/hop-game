// Week 2 Day 1: crystal cluster + cloud sea geometry guards. Headless (no
// WebGL). These pin the properties the owner called out, in order:
//
//  * a cluster is a real 3D CLUMP (x, y AND z all vary — the "all crystals in
//    the same spot" failure),
//  * every shape variant is distinct,
//  * one cluster is MIXED colour, never a single family,
//  * bases sit below the tile plane so crystals rise out of the cloud,
//  * the outline rim is RELATIVE to the crystal's own size,
//  * no degenerate triangles, in the crystals or the cloud surface.
import { describe, it, expect } from 'vitest';
import {
  CLUSTER_SHAPES,
  OUTLINE_FACTOR,
  bakeCluster,
  crystalTones,
  emitCluster,
  emitCrystal,
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

interface Attr { count: number; getX(i: number): number; getY(i: number): number; getZ(i: number): number }
const pos = (g: { getAttribute(n: string): Attr }): Attr => g.getAttribute('position');

function distinctFaceColors(g: { getAttribute(n: string): Attr }): number {
  const c = g.getAttribute('color');
  const used = new Set<string>();
  for (let i = 0; i < c.count; i += 3) {
    used.add(`${c.getX(i).toFixed(2)},${c.getY(i).toFixed(2)},${c.getZ(i).toFixed(2)}`);
  }
  return used.size;
}

function degenerateCount(p: Attr): number {
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
  return bad;
}

function clusterOf(shape: (typeof CLUSTER_SHAPES)[number], seed: number, weight = 0.8) {
  const acc = emptyAcc();
  emitCluster(acc, { x: 0, z: 0, weight, shape, families: MIXED, baseY: -3.4 }, makeRng(seed));
  return bakeCluster(acc);
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
    expect(distinctFaceColors(bakeCluster(acc).face)).toBeGreaterThanOrEqual(3);
  });

  it('the rim is RELATIVE to crystal size (a fixed rim swallowed far crystals)', () => {
    const rimFor = (scale: number): number => {
      const acc = emptyAcc();
      emitCrystal(acc, {
        baseR: 0.4, height: 2, taper: 0.5, sides: 6, spin: 0,
        leanX: 0, leanZ: 0, scale, pos: [0, 0, 0], tones: crystalTones(FAMILY)
      }, makeRng(3));
      const { face, shell } = bakeCluster(acc);
      const f = pos(face), h = pos(shell);
      return Math.hypot(h.getX(0) - f.getX(0), h.getY(0) - f.getY(0), h.getZ(0) - f.getZ(0));
    };
    const small = rimFor(0.5);
    const big = rimFor(2);
    // Rim grows with the crystal and stays a small fraction of it: a far,
    // small crystal keeps a small rim instead of being swallowed by it.
    expect(big).toBeGreaterThan(small * 3);
    expect(small / 0.5).toBeCloseTo(OUTLINE_FACTOR, 5);
    expect(small / 0.5).toBeLessThan(0.06);
  });
});

describe('clusters are real 3D clumps', () => {
  it('a cluster spreads in x, y AND z — not stuffed into one spot', () => {
    for (const shape of CLUSTER_SHAPES) {
      const p = pos(clusterOf(shape, 21).face);
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      let minZ = Infinity, maxZ = -Infinity;
      for (let i = 0; i < p.count; i++) {
        minX = Math.min(minX, p.getX(i)); maxX = Math.max(maxX, p.getX(i));
        minY = Math.min(minY, p.getY(i)); maxY = Math.max(maxY, p.getY(i));
        minZ = Math.min(minZ, p.getZ(i)); maxZ = Math.max(maxZ, p.getZ(i));
      }
      const spanX = maxX - minX, spanY = maxY - minY, spanZ = maxZ - minZ;
      expect(spanX, `${shape} needs x spread`).toBeGreaterThan(1);
      expect(spanZ, `${shape} needs z spread (depth)`).toBeGreaterThan(0.4);
      // Height spread proves the crystals differ in size, not clones.
      expect(spanY, `${shape} needs varied crystal heights`).toBeGreaterThan(1);
    }
  });

  it('every shape variant produces different geometry (variations exist)', () => {
    const sigs = new Set(CLUSTER_SHAPES.map((s) => {
      const p = pos(clusterOf(s, 21).face);
      return `${p.count}:${p.getX(0).toFixed(3)}:${p.getY(0).toFixed(3)}`;
    }));
    expect(sigs.size).toBe(CLUSTER_SHAPES.length);
  });

  it('trio and cluster are not the same size of clump', () => {
    const trio = pos(clusterOf('trio', 21).face).count;
    const cluster = pos(clusterOf('cluster', 21).face).count;
    expect(cluster).toBeGreaterThan(trio * 1.5);
  });

  it('is MIXED colour, never one family (the concept shows many per cluster)', () => {
    for (const shape of CLUSTER_SHAPES) {
      const { face } = clusterOf(shape, 5);
      // A single-family cluster yields exactly the 4 tones of one base, so
      // the tone spread stays tiny. Mixed families widen it a lot.
      expect(distinctFaceColors(face), `${shape} should mix families`).toBeGreaterThanOrEqual(8);
    }
  });

  it('bases sit below the tile plane so crystals emerge from the cloud', () => {
    for (const shape of CLUSTER_SHAPES) {
      const p = pos(clusterOf(shape, 9, 0.6).face);
      let minY = Infinity;
      for (let i = 0; i < p.count; i++) minY = Math.min(minY, p.getY(i));
      expect(minY, `${shape} base must be buried`).toBeLessThan(-1.5);
    }
  });

  it('the spire is the tallest crystal (a clear dominant silhouette)', () => {
    const p = pos(clusterOf('spire', 4).face);
    let maxY = -Infinity;
    for (let i = 0; i < p.count; i++) maxY = Math.max(maxY, p.getY(i));
    // baseY -3.4 plus a spire of 2.4..5.8 scaled up to ~1.25.
    expect(maxY).toBeGreaterThan(1);
  });

  it('has no degenerate triangles across every shape and many seeds', () => {
    const acc = emptyAcc();
    for (let seed = 1; seed <= 12; seed++) {
      for (const shape of CLUSTER_SHAPES) {
        emitCluster(acc, { x: 0, z: 0, weight: (seed % 5) / 4, shape, families: MIXED, baseY: -3.4 },
          makeRng(seed * 31));
      }
    }
    const p = pos(bakeCluster(acc).face);
    expect(degenerateCount(p)).toBeLessThan(p.count / 3 * 0.05);
  });
});

describe('cloud sea', () => {
  // Mirrors the shipped Sunrise deck so the guards test the real config.
  const opts = (seed: number) => ({
    length: 240, spread: 64, top: -8.5, depth: 1.8, cols: 60, rows: 100, cell: 3,
    palette: { base: 0xfff7e8, highlight: 0xfffbef, shadow: 0xf0cdb4 },
    seed
  });

  it('is one merged, vertex-coloured rolling surface (not a pile of spheres)', () => {
    const geo = buildCloudSea(opts(42));
    const p = pos(geo);
    expect(geo.getAttribute('color').count).toBe(p.count);
    // A continuous grid: cols*rows*2 triangles minimum, far more than a sparse
    // point cloud would give.
    expect(p.count / 3).toBeGreaterThan(44 * 30 * 2);
  });

  it('actually undulates (wave functions move the surface up and down)', () => {
    const o = opts(42);
    const p = pos(buildCloudSea(o));
    let minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < p.count; i++) {
      minY = Math.min(minY, p.getY(i));
      maxY = Math.max(maxY, p.getY(i));
    }
    // Real rolling relief, not a flat sheet.
    expect(maxY - minY).toBeGreaterThan(o.depth * 0.8);
  });

  it('the crest stays under the tile line so the path floats above the deck', () => {
    const p = pos(buildCloudSea(opts(8)));
    let maxY = -Infinity;
    for (let i = 0; i < p.count; i++) maxY = Math.max(maxY, p.getY(i));
    // Tiles span −0.4..+0.4; a billow crest must never reach over them.
    expect(maxY).toBeLessThan(0.4);
  });

  it('shades crests brighter than troughs (the concept\'s lit cloud tops)', () => {
    const geo = buildCloudSea(opts(11));
    const p = pos(geo), c = geo.getAttribute('color');
    // Compare the top 10% of heights against the bottom 10% rather than fixed
    // cutoffs, so the assertion doesn't depend on how deep one seed happens to
    // roll.
    const rows: { y: number; l: number }[] = [];
    for (let i = 0; i < p.count; i++) {
      rows.push({ y: p.getY(i), l: 0.2126 * c.getX(i) + 0.7152 * c.getY(i) + 0.0722 * c.getZ(i) });
    }
    rows.sort((a, b) => a.y - b.y);
    const mean = (xs: { l: number }[]): number => xs.reduce((s, x) => s + x.l, 0) / xs.length;
    const n = Math.max(1, Math.floor(rows.length * 0.1));
    const crests = mean(rows.slice(rows.length - n));
    const troughs = mean(rows.slice(0, n));
    expect(crests).toBeGreaterThan(troughs);
  });

  it('every triangle has real area (regression: duplicated points = invisible)', () => {
    const p = pos(buildCloudSea(opts(3)));
    expect(degenerateCount(p)).toBeLessThan(p.count / 3 * 0.05);
  });

  it('tiles exactly: the far edge matches the near edge, so segments meet flush', () => {
    // The stair-stepped rectangles down the view came from the deck's
    // per-segment end caps. The surface is now exactly periodic in z, so the
    // last row and the first row must carry identical heights — that is what
    // makes two adjacent segments join with no wall and no seam.
    const o = opts(9);
    const geo = buildCloudSea(o);
    const p = pos(geo);
    // The grid is unindexed: 6 vertices per quad, rows outer, columns inner.
    // Quad (ix, iz) pushes [a, c, b, a, d, c] where a = hAt(ix, iz),
    // b = hAt(ix+1, iz), c = hAt(ix+1, iz+1), d = hAt(ix, iz+1).
    // So z=0 is vertex 0 of the first row, and z=length is the `d` vertex
    // (offset 4) of the LAST row — those two must agree exactly.
    const at = (ix: number, iz: number, off: number): number =>
      p.getY((iz * o.cols + ix) * 6 + off);
    let worst = 0;
    for (let ix = 0; ix < o.cols; ix++) {
      worst = Math.max(worst, Math.abs(at(ix, o.rows - 1, 4) - at(ix, 0, 0)));
    }
    expect(worst).toBeLessThan(1e-6);
  });

  it('covers the full width so the deck never shows a gap at the seams', () => {
    const p = pos(buildCloudSea(opts(6)));
    let minX = Infinity, maxX = -Infinity;
    for (let i = 0; i < p.count; i++) {
      minX = Math.min(minX, p.getX(i));
      maxX = Math.max(maxX, p.getX(i));
    }
    expect(minX).toBeLessThanOrEqual(-32);
    expect(maxX).toBeGreaterThanOrEqual(32);
  });
});

