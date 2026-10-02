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
  /** Hard cap on how far the first formation may be pushed back. */
  nearCap: number;
}

export const DEFAULT_PLACEMENT: PlacementOptions = {
  count: 16,
  segmentLength: 240,
  corridor: 3.4,
  minZ: 26,
  margin: 0.82,
  minSpread: 5.6,
  maxSpread: 17,
  /** Authored formation height treated as "normal"; others scale off it. */
  referenceHeight: 15,
  /** Global size boost. The owner asked for bigger crystals. */
  boost: 1.0,
  /** How deep a formation's base is buried in the cloud it stands on. */
  sink: 0.9,
  /** Never let consecutive formations crowd each other. */
  minGap: 7,
  nearCap: 34
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

  /**
   * Minimum usable depth is VIEW-DEPENDENT, not a constant.
   *
   * A portrait phone sees roughly half the horizontal field of a laptop, so a
   * formation 24 units ahead has only ~7.8 units of visible half-width. Anything
   * substantial cannot fit there, and the shrink-to-fit loop collapsed every
   * near formation to nothing. Solving for the depth at which a reference-sized
   * formation actually fits keeps the same framing intent on every screen and
   * stops the field being crushed against the camera on a phone.
   */
  const vHalf = Math.tan((frame.fovDeg * Math.PI) / 360);
  const halfPerUnit = vHalf * frame.aspect * o.margin;
  const stand = Math.max(o.corridor, o.minSpread);
  const refHalf = structureHalfWidth(CRYSTAL_STRUCTURES[0]) * (o.referenceHeight / 9);
  const needed = (stand + 2 * refHalf + 0.6) / Math.max(0.02, halfPerUnit);
  // CAP the solved minimum, so the opening slot is never so far away that the
  // player starts a run with an empty sky. The shrink-to-fit loop below then
  // trims the first formation to whatever actually fits that close — a small
  // nearby cluster reads far better than no cluster at all.
  const minZ = Math.min(
    o.segmentLength * 0.5,
    Math.max(o.minZ, Math.min(needed, o.nearCap))
  );
  const span = Math.max(1, o.segmentLength - minZ);

  // Left and right are built as INDEPENDENT sequences, each picking freely from
  // the five authored formations with its own jitter. A single shared pass (or
  // a forced alternation) made the field read as a mirror or a metronome;
  // independent sampling is what gives each flank its own character.
  for (const side of [-1, 1] as const) {
    // Split the budget so the total is exactly `count` rather than rounding each
    // flank up and overshooting the requested density.
    const perSide = side === -1
      ? Math.max(1, Math.floor(o.count / 2))
      : Math.max(1, o.count - Math.floor(o.count / 2));
    const step = perSide > 1 ? span / (perSide - 1) : span;
    for (let i = 0; i < perSide; i++) {
      const structure = CRYSTAL_STRUCTURES[Math.floor(rnd() * CRYSTAL_STRUCTURES.length)];
      // Jitter only into the room the minimum gap leaves. Without this clamp the
      // jitter pushes a formation forward into its own neighbour and the flank
      // ends up crowded exactly where it was meant to be spread out.
      const jitterRoom = Math.max(0, step - o.minGap);
      const z = Math.min(o.segmentLength, minZ + i * step + rnd() * jitterRoom);

      // The formation's VISUAL height is the controlled quantity, and the scale
      // is derived from it, so a 12-unit "Needles" and a 7-unit "Ridge" come out
      // the same size instead of one dwarfing the other.
      const depth = 1 - Math.min(1, z / o.segmentLength);
      const targetHeight = o.referenceHeight * (0.6 + depth * 0.4) * o.boost;
      const half0 = structureHalfWidth(structure);
      let scale = targetHeight / Math.max(1, structure.height);

      // Two constraints fight: clear the path, and fit the frustum. The frustum
      // is the harder limit on a phone, so shrink until BOTH can hold rather
      // than pushing the formation off screen or onto the tiles.
      //
      // The frustum test counts the formation's OUTER edge, so it needs the width
      // on BOTH sides: `stand + 2*half + GAP <= limit`. Checking only `stand +
      // half` let the outer edge leave the frame, which is how formations ended
      // up half off screen.
      const GAP = 0.6;
      const limit = visibleHalfWidth(frame, z) * o.margin;
      for (let guard = 0; guard < 40; guard++) {
        if (stand + 2 * half0 * scale + GAP <= limit) break;
        scale *= 0.9;
      }
      scale = Math.max(scale, 0.08);

      const half = half0 * scale;
      let spread = Math.max(
        stand + half + GAP,
        Math.min(
          maxSpreadFor(frame, z, half, o),
          o.minSpread + rnd() * (o.maxSpread - o.minSpread)
        )
      );
      // Belt-and-braces: the formation's outer edge stays inside the margin.
      spread = Math.min(spread, Math.max(half + 0.1, limit - half));

      const x = side * spread;
      out.push({ structure, side, spread, z, scale, baseY: cloudHeight(x, z) - o.sink });
    }
  }
  out.sort((a, b) => a.z - b.z);
  return out;
}










