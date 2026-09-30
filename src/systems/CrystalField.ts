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
  /** Base height, seated on the cloud surface so nothing is buried or floating. */
  baseY: number;
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
  /** Authored formation height treated as "normal"; others scale off it. */
  referenceHeight: number;
  /** Global size boost applied to every formation. */
  boost: number;
  /** How deep a formation's base is buried in the cloud it stands on. */
  sink: number;
  /** Never let consecutive formations crowd each other. */
  minGap: number;
}

export const DEFAULT_PLACEMENT: PlacementOptions = {
  count: 6,
  segmentLength: 70,
  corridor: 3.4,
  minZ: 32,
  margin: 0.82,
  minSpread: 5.6,
  maxSpread: 17,
  /** Authored formation height treated as "normal"; others scale off it. */
  referenceHeight: 9.5,
  /** Global size boost. The owner asked for bigger crystals. */
  boost: 1.0,
  /** How deep a formation's base is buried in the cloud it stands on. */
  sink: 0.9,
  /** Never let consecutive formations crowd each other. */
  minGap: 6.5
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
 * Build a segment's worth of placements. Pure function of (seed, frame, cloud):
 * same inputs, same field, so a seed is a shareable recipe.
 *
 * `cloudHeight` lets each formation be seated on the actual cloud surface
 * instead of at one fixed height — without it, formations on a crest are buried
 * to the tips and those over a trough float in mid-air.
 */
export function generatePlacements(
  seed: number,
  frame: FrameInfo,
  cloudHeight: (x: number, z: number) => number,
  o: PlacementOptions = DEFAULT_PLACEMENT
): Placement[] {
  const rnd = makeRng(seed);
  const out: Placement[] = [];
  // Evenly divide the runnable span into slots, then jitter WITHIN each slot.
  // Dividing by `count` and adding a full step of jitter on the last slot pushed
  // it past the segment, so the span is divided by (count - 1) and jitter is
  // forward-only and clamped to the segment.
  const span = Math.max(1, o.segmentLength - o.minZ);
  const step = o.count > 1 ? span / (o.count - 1) : span;
  // Strict alternation, not a coin flip. Random sides produced runs of three or
  // four on the same flank, which read as a lopsided clump instead of a rhythm.
  const firstSide: 1 | -1 = rnd() < 0.5 ? -1 : 1;

  for (let i = 0; i < o.count; i++) {
    const structure = CRYSTAL_STRUCTURES[Math.floor(rnd() * CRYSTAL_STRUCTURES.length)];
    const side: 1 | -1 = i % 2 === 0 ? firstSide : (-firstSide as 1 | -1);
    const z = Math.min(o.segmentLength, o.minZ + i * step + rnd() * step * 0.35);

    // The formation's VISUAL height is the controlled quantity, and the scale
    // is derived from it. A 12-unit "Needles" and a 7-unit "Ridge" then come out
    // the same size instead of one dwarfing the other, and near formations still
    // read larger than far ones. That is what stops a boosted tall piece from
    // swallowing the frame.
    const depth = 1 - Math.min(1, z / o.segmentLength);
    const targetHeight = o.referenceHeight * (0.55 + depth * 0.45) * o.boost;
    const half0 = structureHalfWidth(structure);
    let scale = targetHeight / Math.max(1, structure.height);

    // Two constraints fight here: the formation must clear the path, and it must
    // fit the frustum. The frustum is the harder limit on a phone, so shrink the
    // formation until BOTH can hold — rather than pushing it out of frame or
    // letting it overlap the tiles.
    const GAP = 0.6;
    const limit = visibleHalfWidth(frame, z) * o.margin;
    for (let guard = 0; guard < 24; guard++) {
      const need = o.corridor + half0 * scale + GAP;
      if (need <= limit) break;
      scale *= 0.9;
    }
    scale = Math.max(scale, 0.12);

    const half = half0 * scale;
    let spread = Math.max(
      o.minSpread,
      o.corridor + half + GAP,
      Math.min(
        maxSpreadFor(frame, z, half, o),
        o.minSpread + rnd() * (o.maxSpread - o.minSpread)
      )
    );
    // Final guarantee: the formation's OUTER edge is inside the frustum. The
    // clamps above can each win individually (minSpread on a narrow phone, the
    // corridor on a wide screen) and together overshoot, so the bound is applied
    // once more here rather than trusted to the ordering.
    spread = Math.min(spread, Math.max(half + 0.1, visibleHalfWidth(frame, z) - half - 0.1));
    // Sit the formation on the cloud it actually stands over, buried just
    // enough that no base is left hanging in the air.
    const x = side * spread;
    out.push({ structure, side, spread, z, scale, baseY: cloudHeight(x, z) - o.sink });
  }
  out.sort((a, b) => a.z - b.z);
  return out;
}



