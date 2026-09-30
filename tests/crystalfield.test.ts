// Seeded crystal-field placement (src/systems/CrystalField.ts).
//
// The two things worth guarding: a seed must reproduce a layout exactly, and a
// formation must never be placed where the player cannot see it, nor where it
// would touch the tile path.
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

describe('crystal field placement', () => {
  it('a seed reproduces the same field exactly', () => {
    const a = generatePlacements(12345, DESKTOP);
    const b = generatePlacements(12345, DESKTOP);
    expect(a.map((p) => [p.structure.id, p.side, p.z, p.spread, p.scale]))
      .toEqual(b.map((p) => [p.structure.id, p.side, p.z, p.spread, p.scale]));
  });

  it('different seeds give different fields', () => {
    const sig = (s: number) => generatePlacements(s, DESKTOP).map((p) => p.structure.id + p.side).join(',');
    expect(sig(1)).not.toBe(sig(2));
  });

  it('never lets a formation touch the tile path', () => {
    for (const frame of [DESKTOP, PHONE]) {
      for (let seed = 1; seed <= 25; seed++) {
        for (const p of generatePlacements(seed, frame)) {
          const half = structureHalfWidth(p.structure) * p.scale;
          // The formation's nearest edge must clear the corridor, not just its
          // origin — a wide formation centred just outside the path still
          // overlaps it.
          expect(p.spread - half, `seed ${seed} on ${frame.aspect.toFixed(2)}`).toBeGreaterThan(
            opts().corridor * 0.6
          );
        }
      }
    }
  });

  it('stays inside the frustum on a phone, not just on desktop', () => {
    // The real bug: a lateral offset fine on 16:9 is off screen entirely in
    // portrait, because portrait sees roughly half the horizontal field.
    for (let seed = 1; seed <= 25; seed++) {
      for (const p of generatePlacements(seed, PHONE)) {
        const half = structureHalfWidth(p.structure) * p.scale;
        const edge = p.spread + half;
        const frame = visibleHalfWidth(PHONE, p.z);
        expect(edge, `seed ${seed}: formation must be on screen`).toBeLessThan(frame);
      }
    }
  });

  it('is framed for desktop too', () => {
    for (let seed = 1; seed <= 25; seed++) {
      for (const p of generatePlacements(seed, DESKTOP)) {
        const half = structureHalfWidth(p.structure) * p.scale;
        expect(p.spread + half).toBeLessThan(visibleHalfWidth(DESKTOP, p.z));
      }
    }
  });

  it('places nothing closer than minZ, so the first slot is always visible', () => {
    for (const frame of [DESKTOP, PHONE]) {
      for (const p of generatePlacements(7, frame)) {
        expect(p.z).toBeGreaterThanOrEqual(opts().minZ);
        // A formation may sit exactly on the segment boundary: that is the join
        // with the next segment, and the geometry there is shared.
        expect(p.z).toBeLessThanOrEqual(opts().segmentLength);
      }
    }
  });

  it('fills the requested count and stays sorted by depth', () => {
    const list = generatePlacements(3, DESKTOP, opts({ count: 7 }));
    expect(list).toHaveLength(7);
    for (let i = 1; i < list.length; i++) expect(list[i].z).toBeGreaterThanOrEqual(list[i - 1].z);
  });

  it('uses only authored formations', () => {
    const ids = new Set(CRYSTAL_STRUCTURES.map((s) => s.id));
    for (const p of generatePlacements(99, DESKTOP)) expect(ids.has(p.structure.id)).toBe(true);
  });

  it('scales near formations larger than far ones', () => {
    const list = generatePlacements(11, DESKTOP);
    expect(list[0].scale).toBeGreaterThan(list[list.length - 1].scale);
  });

  it('a wider frame allows a wider spread than a narrow one', () => {
    const o = opts();
    const wide = maxSpreadFor(DESKTOP, 40, 3, o);
    const narrow = maxSpreadFor(PHONE, 40, 3, o);
    expect(wide).toBeGreaterThan(narrow);
    // ...but the narrow frame must never collapse below the readable floor.
    expect(narrow).toBeGreaterThanOrEqual(o.minSpread);
  });

  it('every formation has a positive measured half-width', () => {
    for (const s of CRYSTAL_STRUCTURES) expect(structureHalfWidth(s)).toBeGreaterThan(0);
  });
});
