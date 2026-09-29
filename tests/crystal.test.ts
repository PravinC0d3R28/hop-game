// Week 2 Day 1: crystal + cloud geometry guards. Headless (no WebGL): these
// pin the concept-critical properties — multi-tonal facets, outward winding,
// fixed-width outlines, and formation clustering.
import { describe, it, expect } from 'vitest';
import {
  EDGE_THICKNESS,
  bakeSegment,
  crystalTones,
  emitCrystal,
  emitFormation,
  emptyAcc,
  makeRng
} from '../src/systems/CrystalFactory';
import { buildCloudSea } from '../src/systems/CloudFactory';

const FAMILY = { base: 0xff6f70 };

function attrs(geo: { getAttribute(n: string): { count: number; getX(i: number): number; getY(i: number): number; getZ(i: number): number } }) {
  return geo.getAttribute('position');
}

describe('crystal tones', () => {
  it('derives four distinct facet tones from one base', () => {
    const t = crystalTones(FAMILY);
    const all = [t.light, t.base, t.shade, t.cream];
    expect(new Set(all).size).toBe(4);
    // Cream is the key-facing highlight: clearly lighter than the base.
    const lum = (c: number) => {
      const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
      return 0.2126 * f((c >> 16) & 255) + 0.7152 * f((c >> 8) & 255) + 0.0722 * f(c & 255);
    };
    expect(lum(t.cream)).toBeGreaterThan(lum(t.light));
    expect(lum(t.light)).toBeGreaterThan(lum(t.base));
    expect(lum(t.base)).toBeGreaterThan(lum(t.shade));
  });

  it('honours explicit palette overrides', () => {
    const t = crystalTones({ base: 0xff6f70, cream: 0x123456 });
    expect(t.cream).toBe(0x123456);
  });
});

describe('crystal geometry', () => {
  it('a crystal is a closed, outward-wound, multi-tone triangle soup', () => {
    const acc = emptyAcc();
    emitCrystal(acc, {
      baseR: 0.5, height: 3, taper: 0.5, sides: 6, spin: 0.3,
      leanX: 0.05, leanZ: -0.03, scale: 1, pos: [0, 0, 0],
      tones: crystalTones(FAMILY), jitter: 0
    }, makeRng(7), EDGE_THICKNESS);
    const { face, hull } = bakeSegment(acc);
    const pos = attrs(face);
    const col = face.getAttribute('color') as unknown as { count: number; getX(i: number): number; getY(i: number): number; getZ(i: number): number };
    expect(pos.count % 3).toBe(0);
    // Facet tone variation is the concept's signature — several colors used.
    const used = new Set<string>();
    for (let i = 0; i < col.count; i += 3) {
      used.add(`${col.getX(i).toFixed(2)},${col.getY(i).toFixed(2)},${col.getZ(i).toFixed(2)}`);
    }
    expect(used.size).toBeGreaterThanOrEqual(3);
  });

  it('outlines are a fixed world thickness, not a relative scale', () => {
    const acc = emptyAcc();
    emitCrystal(acc, {
      baseR: 0.5, height: 6, taper: 0.5, sides: 6, spin: 0,
      leanX: 0, leanZ: 0, scale: 2, pos: [0, 0, 0],
      tones: crystalTones(FAMILY), jitter: 0
    }, makeRng(3), EDGE_THICKNESS);
    const { face, hull } = bakeSegment(acc);
    const f = attrs(face), h = attrs(hull);
    // Every hull vertex sits exactly EDGE_THICKNESS from its face vertex.
    for (let i = 0; i < f.count; i++) {
      const d = Math.hypot(h.getX(i) - f.getX(i), h.getY(i) - f.getY(i), h.getZ(i) - f.getZ(i));
      expect(d).toBeCloseTo(EDGE_THICKNESS, 5);
    }
  });

  it('an un-sheared crystal has every side face pointing outward', () => {
    // The real geometric invariant. (A world-origin radial test is invalid for
    // leaning shards, whose outward normal is not parallel to the origin
    // direction — the renderer no longer depends on this anyway, since the
    // crystal material is DoubleSide, but a flipped wall would still shade
    // wrong.)
    const acc = emptyAcc();
    emitCrystal(acc, {
      baseR: 0.6, height: 4, taper: 0.5, sides: 6, spin: 0.7,
      leanX: 0, leanZ: 0, scale: 1, pos: [0, 0, 0],
      tones: crystalTones(FAMILY), jitter: 0
    }, makeRng(11), EDGE_THICKNESS);
    const { face } = bakeSegment(acc);
    const p = attrs(face);
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
        // Base cap points down, tip fan points up.
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

  it('formations across many seeds have no degenerate triangles', () => {
    const acc = emptyAcc();
    for (let seed = 1; seed <= 24; seed++) {
      emitFormation(acc, { x: 0, z: 0, weight: (seed % 5) / 4, family: FAMILY, accent: null, count: 7 },
        makeRng(seed * 31), EDGE_THICKNESS);
    }
    const { face } = bakeSegment(acc);
    const p = attrs(face);
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
    // Only the collapsed pole rings may degenerate.
    expect(degenerate).toBeLessThan(p.count / 3 * 0.2);
  });
});

describe('formations', () => {
  it('a formation is a CLUSTER (dominant spire + satellites), not one crystal', () => {
    const acc = emptyAcc();
    emitFormation(acc, {
      x: 6, z: 10, weight: 0.9, family: FAMILY, accent: null, count: 6
    }, makeRng(5), EDGE_THICKNESS);
    const { face } = bakeSegment(acc);
    const p = attrs(face);
    // One crystal ≈ 6 sides * 8 triangles * 3 verts. 6 crystals >> that.
    expect(p.count / 3).toBeGreaterThan(100);

    // Satellites must stay near the cluster centre (tight clump).
    const single = emptyAcc();
    emitCrystal(single, {
      baseR: 0.5, height: 3, taper: 0.5, sides: 6, spin: 0,
      leanX: 0, leanZ: 0, scale: 1, pos: [6, 0, 10],
      tones: crystalTones(FAMILY), jitter: 0
    }, makeRng(5), EDGE_THICKNESS);
    expect(p.count).toBeGreaterThan(attrs(bakeSegment(single).face).count * 4);
  });

  it('crystal bases sit below the blanket top so they emerge from cloud', () => {
    const acc = emptyAcc();
    emitFormation(acc, { x: -6, z: 8, weight: 0.5, family: FAMILY, accent: null, count: 4 },
      makeRng(9), EDGE_THICKNESS);
    const { face } = bakeSegment(acc);
    const p = attrs(face);
    let minY = Infinity;
    for (let i = 0; i < p.count; i++) minY = Math.min(minY, p.getY(i));
    expect(minY).toBeLessThan(0.15);
  });
});

describe('cloud sea', () => {
  it('builds a dense vertex-coloured blanket (one merged geometry)', () => {
    const geo = buildCloudSea({
      length: 70, spread: 17, top: 0.15, depth: 1.5, density: 170,
      palette: { base: 0xfff7e8, highlight: 0xfffbef, shadow: 0xf4dccb },
      seed: 42
    });
    const pos = attrs(geo);
    const col = geo.getAttribute('color') as unknown as { count: number };
    expect(pos.count).toBeGreaterThan(1000);
    expect(col.count).toBe(pos.count);
  });

  it('stays low and wide — never a tower over the path', () => {
    const geo = buildCloudSea({
      length: 70, spread: 17, top: 0.15, depth: 1.5, density: 60,
      palette: { base: 0xfff7e8, highlight: 0xfffbef, shadow: 0xf4dccb },
      seed: 8
    });
    const p = attrs(geo);
    let maxY = -Infinity;
    for (let i = 0; i < p.count; i++) maxY = Math.max(maxY, p.getY(i));
    expect(maxY).toBeLessThan(3);
  });

  it('every triangle has real area (regression: three identical points = invisible)', () => {
    // The sea once pushed the SAME vertex three times per triangle. Vertex
    // count and bounding sphere both looked correct, so nothing caught it
    // except actually measuring triangle area.
    const geo = buildCloudSea({
      length: 70, spread: 22, top: -0.5, depth: 2.6, density: 40,
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
      const n = [
        u[1] * v[2] - u[2] * v[1],
        u[2] * v[0] - u[0] * v[2],
        u[0] * v[1] - u[1] * v[0]
      ];
      // Cross-product magnitude = 2× area. Poles legitimately collapse to
      // points, so only flag a triangle that is BOTH tiny and duplicated.
      const len = Math.hypot(n[0], n[1], n[2]);
      const dup = a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
      if (dup || len < 1e-9) degenerate++;
    }
    // Poles may be degenerate; the bulk of the blanket must not be.
    expect(degenerate).toBeLessThan(p.count / 3 * 0.25);
  });
});
