// Seeded crystal-field placement (src/systems/CrystalField.ts).
//
// Guards the owner's list: formations come only from the locked authored set,
// they are big enough to see, none is a giant, they are properly spaced, they
// never touch the tile path, they sit ON the cloud instead of being swallowed by
// it, and they stay inside the frustum on a phone as well as a laptop.
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PLACEMENT,
  generatePlacements,
  maxSpreadFor,
  structureHalfWidth,
  visibleHalfWidth,
  type FrameInfo,
  type PlacementOptions
} from '../src/systems/CrystalField';
import { CRYSTAL_STRUCTURES } from '../src/config/CrystalStructures';

/** Laptop 16:9 — vertical FOV stays at the base 55. */
const DESKTOP: FrameInfo = { fovDeg: 55, aspect: 16 / 9 };
/** Phone 390x844 — the game widens the FOV in portrait, but still sees far
 *  less horizontally than a laptop. This is the frame that broke before. */
const PHONE: FrameInfo = { fovDeg: 55 + (1 - 390 / 844) * 30, aspect: 390 / 844 };

const opts = (over: Partial<PlacementOptions> = {}): PlacementOptions => ({ ...DEFAULT_PLACEMENT, ...over });

/** Flat cloud at the shipped deck datum. */
const flat = (): number => -5.6;
/** An uneven cloud, standing in for the real billowed deck. */
const bumpy = (x: number, z: number): number => -5.6 + Math.sin(x * 0.3) * 2.4 + Math.cos(z * 0.11) * 1.8;

const place = (seed: number, frame: FrameInfo = DESKTOP, o?: PlacementOptions) =>
  generatePlacements(seed, frame, flat, o);

describe('crystal field placement', () => {
  it('a seed reproduces the same field exactly', () => {
    const sig = (l: ReturnType<typeof place>) =>
      l.map((p) => [p.structure.id, p.side, p.z, p.spread, p.scale, p.baseY]);
    expect(sig(place(12345))).toEqual(sig(place(12345)));
  });

  it('different seeds give different fields', () => {
    const sig = (s: number) => place(s).map((p) => p.structure.id + p.side).join(',');
    expect(sig(1)).not.toBe(sig(2));
  });

  it('uses ONLY the locked authored formations', () => {
    const ids = new Set(CRYSTAL_STRUCTURES.map((s) => s.id));
    expect(CRYSTAL_STRUCTURES).toHaveLength(5);
    for (let seed = 1; seed <= 30; seed++) {
      for (const p of place(seed)) expect(ids.has(p.structure.id)).toBe(true);
    }
  });

  // ---- size -------------------------------------------------------------
  it('makes the crystals big enough to read', () => {
    // Owner: the scale was far too small. Every formation should reach a decent
    // fraction of the reference height.
    for (const p of place(4)) {
      expect(p.structure.height * p.scale).toBeGreaterThan(4);
    }
  });

  it('produces no giant formation', () => {
    // A 12-unit authored piece scaled up 2x would swallow the frame, so scale
    // is normalised against a reference height.
    for (let seed = 1; seed <= 30; seed++) {
      for (const p of place(seed)) {
        expect(p.structure.height * p.scale).toBeLessThan(14);
      }
    }
  });

  it('normalises size across formations of different authored heights', () => {
    // "Needles" is 12 tall and "Ridge" 7; without normalisation the tall one
    // would dwarf the short one.
    const ratios = place(9).map((p) => (p.structure.height * p.scale));
    expect(Math.max(...ratios) / Math.min(...ratios)).toBeLessThan(1.9);
  });

  it('scales near formations larger than far ones', () => {
    // Assert on VISUAL height, not the raw scale: scale is derived from
    // structure height, so a short authored piece legitimately gets a larger
    // scale for the same apparent size.
    const list = place(11);
    const visual = (p: (typeof list)[number]) => p.structure.height * p.scale;
    expect(visual(list[0])).toBeGreaterThan(visual(list[list.length - 1]));
  });

  // ---- spacing ----------------------------------------------------------
  it('keeps a minimum gap between formations on the SAME flank', () => {
    // Owner: "some are very close to each other". Left and right are now
    // independent sequences, so the meaningful constraint is per flank — a left
    // and a right formation at the same depth is the intended zigzag, not a
    // crowding bug.
    for (let seed = 1; seed <= 30; seed++) {
      for (const side of [-1, 1] as const) {
        const flank = place(seed).filter((p) => p.side === side);
        for (let i = 1; i < flank.length; i++) {
          expect(flank[i].z - flank[i - 1].z, `seed ${seed} side ${side}`)
            .toBeGreaterThanOrEqual(opts().minGap * 0.5);
        }
      }
    }
  });

  it('populates both flanks and varies the structure independently per side', () => {
    // Owner: "differentiate left and right separately and randomly choose out
    // of 5". Both flanks must be present, and the choice must be genuinely
    // random per flank rather than a fixed pairing. A single seed can draw the
    // same formation twice by chance, so variety is asserted across the range.
    for (let seed = 1; seed <= 30; seed++) {
      const list = place(seed);
      expect(list.some((p) => p.side === -1)).toBe(true);
      expect(list.some((p) => p.side === 1)).toBe(true);
    }
    for (const side of [-1, 1] as const) {
      const used = new Set<string>();
      for (let seed = 1; seed <= 20; seed++) {
        for (const p of place(seed)) if (p.side === side) used.add(p.structure.id);
      }
      expect(used.size, `side ${side}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('over enough seeds each flank reaches all five formations', () => {
    const seen: Record<string, Set<string>> = { '-1': new Set(), '1': new Set() };
    for (let seed = 1; seed <= 60; seed++) {
      for (const p of place(seed)) seen[String(p.side)].add(p.structure.id);
    }
    expect(seen['-1'].size).toBe(5);
    expect(seen['1'].size).toBe(5);
  });

  it('does not crowd the near field', () => {
    for (const p of place(6)) {
      expect(p.z).toBeGreaterThanOrEqual(opts().minZ);
      expect(p.z).toBeLessThanOrEqual(opts().segmentLength);
    }
  });

  // ---- the path ---------------------------------------------------------
  it('never lets a formation touch the tile path', () => {
    for (const frame of [DESKTOP, PHONE]) {
      for (let seed = 1; seed <= 30; seed++) {
        for (const p of place(seed, frame)) {
          const half = structureHalfWidth(p.structure) * p.scale;
          expect(p.spread - half, `seed ${seed} on ${frame.aspect.toFixed(2)}`)
            .toBeGreaterThan(opts().corridor * 0.6);
        }
      }
    }
  });

  it('stays inside the frustum on a phone, not just on desktop', () => {
    for (let seed = 1; seed <= 30; seed++) {
      for (const p of place(seed, PHONE)) {
        const half = structureHalfWidth(p.structure) * p.scale;
        expect(p.spread + half, `seed ${seed}`).toBeLessThan(visibleHalfWidth(PHONE, p.z));
      }
    }
  });

  it('is framed for desktop too', () => {
    for (let seed = 1; seed <= 30; seed++) {
      for (const p of place(seed, DESKTOP)) {
        const half = structureHalfWidth(p.structure) * p.scale;
        expect(p.spread + half).toBeLessThan(visibleHalfWidth(DESKTOP, p.z));
      }
    }
  });

  // ---- seating on the cloud --------------------------------------------
  it('seats each formation on the actual cloud surface at its own spot', () => {
    // Owner: "many crystal clusters are drowning in the clouds". With an uneven
    // deck the base has to follow the surface, not sit at one fixed height.
    for (let seed = 1; seed <= 20; seed++) {
      for (const p of generatePlacements(seed, DESKTOP, bumpy)) {
        const surface = bumpy(p.side * p.spread, p.z);
        expect(p.baseY).toBeLessThanOrEqual(surface);
        // ...and only just below it: deep enough that no base hangs in the air,
        // shallow enough that the formation is not swallowed.
        expect(surface - p.baseY).toBeLessThan(opts().sink * 2);
        expect(surface - p.baseY).toBeGreaterThan(0);
      }
    }
  });

  it('varies base height across the field when the deck is uneven', () => {
    const bases = generatePlacements(2, DESKTOP, bumpy).map((p) => p.baseY);
    expect(Math.max(...bases) - Math.min(...bases)).toBeGreaterThan(1);
  });

  it('keeps every formation well below the tile plane', () => {
    // Bases must never poke up onto the path.
    for (let seed = 1; seed <= 20; seed++) {
      for (const p of generatePlacements(seed, DESKTOP, bumpy)) {
        expect(p.baseY).toBeLessThan(-0.4);
      }
    }
  });

  // ---- mechanics --------------------------------------------------------
  it('fills the requested count and stays sorted by depth', () => {
    const list = place(3, DESKTOP, opts({ count: 5 }));
    expect(list).toHaveLength(5);
    for (let i = 1; i < list.length; i++) expect(list[i].z).toBeGreaterThanOrEqual(list[i - 1].z);
  });

  it('a wider frame allows a wider spread than a narrow one', () => {
    const o = opts();
    expect(maxSpreadFor(DESKTOP, 40, 3, o)).toBeGreaterThan(maxSpreadFor(PHONE, 40, 3, o));
    expect(maxSpreadFor(PHONE, 40, 3, o)).toBeGreaterThanOrEqual(o.minSpread);
  });

  it('every formation has a positive measured half-width', () => {
    for (const s of CRYSTAL_STRUCTURES) expect(structureHalfWidth(s)).toBeGreaterThan(0);
  });
});
