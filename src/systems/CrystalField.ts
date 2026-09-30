/**
 * Seeded placement of the authored crystal formations.
 *
 * Two problems this solves that hand-tuned constants could not:
 *
 * 1. **Randomisation you can reproduce.** Every formation's structure, side,
 *    distance and scale come from one integer seed, so a good-looking field can
 *    be recovered exactly, and a new one is one call away.
 *
 * 2. **Framing that survives portrait.** A 16:9 frame sees ~85° horizontally;
 *    a 390×844 phone sees ~36°. A formation parked 13 units to the side is dead
 *    centre of a laptop screen and completely off a phone. So the lateral
 *    budget is derived from the live horizontal field of view at the formation's
 *    own distance, and the spread is clamped to fit inside it — with a hard
 *    floor that keeps the path clear.
 */
import { CRYSTAL_STRUCTURES, type CrystalStructure } from '../config/CrystalStructures';
import { makeRng } from './CrystalFactory';

export interface Placement {
  structure: CrystalStructure;
  /** +1 right of the path, -1 left. */
  side: 1 | -1;
  /** Lateral distance of the formation's origin from the path centre. */
  spread: number;
  /** Distance ahead of the camera anchor. */
  z: number;
  /** Uniform scale applied to the authored numbers. */
  scale: number;
}

export interface FrameInfo {
  /** Camera vertical FOV in degrees (the game widens it in portrait). */
  fovDeg: number;
  /** width / height. */
  aspect: number;
}

export interface PlacementOptions {
  /** How many formations to place per segment. */
  count: number;
  /** Segment length along +Z. */
  segmentLength: number;
  /** Half-width of the tile path plus a safety gap. */
  corridor: number;
  /** Never place a formation closer than this, so portrait framing works. */
  minZ: number;
  /** Fraction of the horizontal half-width a formation may occupy. */
  margin: number;
  /** Hard minimum spread — the path must always stay readable. */
  minSpread: number;
  maxSpread: number;
}

export const DEFAULT_PLACEMENT: PlacementOptions = {
  count: 9,
  segmentLength: 70,
  corridor: 3.4,
  minZ: 30,
  margin: 0.82,
  minSpread: 5.6,
  maxSpread: 17
};

/**
 * Half-width of the view at distance `z`, in world units.
 * hHalf = atan(tan(vFov/2) * aspect); visible half-width = z * tan(hHalf).
 */
export function visibleHalfWidth(frame: FrameInfo, z: number): number {
  const vHalf = (frame.fovDeg * Math.PI) / 360;
  return z * Math.tan(vHalf) * frame.aspect;
}

/**
 * Widest lateral offset a formation of `halfWidth` can sit at, `z` units ahead,
 * and still sit inside the frame with the requested margin. This is the whole
 * point of the module: on a wide screen it is a generous number, on a phone it
 * pulls the crystals in so they stay on screen.
 */
export function maxSpreadFor(frame: FrameInfo, z: number, halfWidth: number, o: PlacementOptions): number {
  const room = visibleHalfWidth(frame, z) * o.margin - halfWidth;
  return Math.max(o.minSpread, Math.min(o.maxSpread, room));
}

/** Bounding half-width of a formation in its own units, before scaling. */
export function structureHalfWidth(s: CrystalStructure): number {
  let max = 0;
  for (const c of s.crystals) {
    // A tipped crystal can reach further sideways than its base radius.
    const reach = Math.abs(c.x) + Math.max(c.width, c.height * 0.5) * 0.55;
    if (reach > max) max = reach;
  }
  return max;
}

/**
 * Build a segment's worth of placements. Pure function of (seed, frame, count):
 * same inputs, same field, so a seed is a shareable recipe.
 */
export function generatePlacements(
  seed: number,
  frame: FrameInfo,
  o: PlacementOptions = DEFAULT_PLACEMENT
): Placement[] {
  const rnd = makeRng(seed);
  const out: Placement[] = [];
  // Evenly divide the runnable span into slots, then jitter WITHIN each slot.
  // Dividing by `count` and adding a full step of jitter on the last slot pushed
  // it past the segment, so the span is divided by (count - 1) and jitter is
  // capped at a fraction of the slot.
  const span = o.segmentLength - o.minZ;
  const step = o.count > 1 ? span / (o.count - 1) : span;
  for (let i = 0; i < o.count; i++) {
    const structure = CRYSTAL_STRUCTURES[Math.floor(rnd() * CRYSTAL_STRUCTURES.length)];
    const side: 1 | -1 = rnd() < 0.5 ? -1 : 1;
    // Always start past minZ so a phone can actually see the formation; the
    // first slot is the one the camera meets head-on. Jitter is one-sided and
    // forward-only, so it can neither pull a formation back inside minZ nor
    // push the last one past the segment.
    const z = Math.min(
      o.segmentLength,
      o.minZ + i * step + rnd() * step * 0.4
    );
    const half = structureHalfWidth(structure);
    // Nearer formations are larger, as atmospheric depth demands — but the
    // authored heights run to 12 units, so the scale range is deliberately
    // restrained: at 0.45-0.95 the closest formation filled half the frame.
    const depth = 1 - Math.min(1, z / o.segmentLength);
    const scale = 0.34 + depth * 0.34;
    const spread = Math.max(
      o.minSpread,
      o.corridor + half * scale * 0.6,
      Math.min(
        maxSpreadFor(frame, z, half * scale, o),
        o.minSpread + rnd() * (o.maxSpread - o.minSpread)
      )
    );
    out.push({ structure, side, spread, z, scale });
  }
  // Deterministic order keeps the emitter's draw order stable.
  out.sort((a, b) => a.z - b.z);
  return out;
}

