// Week 2 Workstream A — shared paper-world look data (§10.3).
//
// One factory, three data entries: the selected (or previewed) world owns the
// 3D scene look. RendererSystem.applyWorldLook + the background factory read
// THIS file — no per-world edge hacks (the 2026-09-02 spike lock keeps black
// inverted-hull outlines everywhere; `platformEdge` documents it in data).
//
// Status: Sunrise is complete (spike-proven values). Dusk/Void are
// structurally complete but provisional — Day 2/3 refine their values and
// must keep tests/worldlook.test.ts green while doing it.
//
// §10.5 theme split: the world look always wins for the 3D scene. Light/dark
// stays a HUD/menu-chrome preference only and must never recolor the world.
import type { WorldId } from './Worlds';

/** Silhouette family a background factory knows how to build. */
export type PropFamily =
  | 'ridge'
  | 'cloud'
  | 'city'
  | 'lantern'
  | 'crescent'
  | 'starfield'
  | 'aurora';

/**
 * Data-only prop recipe: silhouette family, palette, scale range, side and
 * parallax speed. Never embeds Three.js objects (factory interprets it).
 * Background parallax must stay slower/calmer than tile sway so the eye
 * never confuses world motion with platform motion.
 */
export interface PropRecipe {
  family: PropFamily;
  colors: number[];
  count: number;
  scaleMin: number;
  scaleMax: number;
  side: 'left' | 'right' | 'both' | 'sky';
  /** 0 = static distant backdrop … 1 = rides with the runway. */
  parallax: number;
}

export interface WorldLook {
  id: WorldId;
  /** Gradient sky (top/bottom). The Day-1 apply path uses `skyBottom` as the
   *  flat clear color; a true gradient dome is a later refinement. */
  skyTop: number;
  skyBottom: number;
  fogColor: number;
  fogNear: number;
  fogFar: number;
  ambient: { color: number; intensity: number };
  directional: { color: number; intensity: number };
  /** World-local platform face cycle (§11.5) + locked edge color. */
  platformFaces: number[];
  platformEdge: number;
  coin: number;
  perfect: { fill: number; ring: number };
  /** Motion tell. `strength: 0` = this world never shows the cue (Sunrise). */
  motionCue: { color: number; strength: number };
  props: PropRecipe[];
}

const BLACK_HULL = 0x111111;
const NO_CUE = { color: 0x38f0e8, strength: 0 };
const FULL_CUE = { color: 0x38f0e8, strength: 1 };

export const WORLD_LOOKS: Record<WorldId, WorldLook> = {
  // ---- Sunrise Peaks: complete (spike-proven 2026-09-02) ----
  sunrise: {
    id: 'sunrise',
    skyTop: 0xf9efdb,
    skyBottom: 0xf6e7ce,
    fogColor: 0xf6e7ce,
    fogNear: 14,
    fogFar: 40,
    ambient: { color: 0xfff2e2, intensity: 0.38 },
    directional: { color: 0xfff1dd, intensity: 2 },
    platformFaces: [0xf7ead2, 0xf3d3a0, 0xe9b96f],
    platformEdge: BLACK_HULL,
    coin: 0xf0c020,
    // White on cream validated in the spike stills; re-check on the full
    // pass if faces get lighter.
    perfect: { fill: 0xffffff, ring: 0xffffff },
    motionCue: NO_CUE,
    props: [
      { family: 'ridge', colors: [0xa9c2df], count: 4, scaleMin: 0.8, scaleMax: 1.3, side: 'both', parallax: 0.2 },
      { family: 'ridge', colors: [0xf0a988], count: 3, scaleMin: 0.7, scaleMax: 1.1, side: 'both', parallax: 0.35 },
      { family: 'cloud', colors: [0xfff8ea], count: 3, scaleMin: 0.8, scaleMax: 1.4, side: 'sky', parallax: 0.1 }
    ]
  },
  // ---- Dusk District: provisional (Day 2 completes + validates) ----
  dusk: {
    id: 'dusk',
    skyTop: 0x6b5bb8,
    skyBottom: 0xe8956e,
    fogColor: 0xdd8a6e,
    fogNear: 14,
    fogFar: 40,
    ambient: { color: 0xffd9c0, intensity: 0.38 },
    directional: { color: 0xffb98a, intensity: 2 },
    // Warm paper faces for static tiles; movers carry the cyan cue.
    platformFaces: [0xffd9a0, 0xffb98a, 0xe08a6b],
    platformEdge: BLACK_HULL,
    coin: 0xffb347,
    // Provisional: validated against peach in the Day 2 contrast check.
    perfect: { fill: 0xffffff, ring: 0xffffff },
    motionCue: FULL_CUE,
    props: [
      { family: 'city', colors: [0x6b5bb8, 0xc86ba6], count: 5, scaleMin: 0.8, scaleMax: 1.4, side: 'both', parallax: 0.25 },
      { family: 'lantern', colors: [0x38f0e8, 0xffd9a0], count: 8, scaleMin: 0.4, scaleMax: 0.8, side: 'both', parallax: 0.4 }
    ]
  },
  // ---- Deep Void: provisional (Day 3 completes + validates) ----
  void: {
    id: 'void',
    skyTop: 0x141830,
    skyBottom: 0x1b1f3a,
    fogColor: 0x1b1f3a,
    fogNear: 14,
    fogFar: 40,
    ambient: { color: 0x8a9ac8, intensity: 0.3 },
    directional: { color: 0xb8c8ff, intensity: 1.6 },
    // Dark sky must never swallow the next platform — Day 3 contrast pass
    // owns this list (lightest face vs sky stays above VOID_CONTRAST_FLOOR).
    platformFaces: [0x2a2f52, 0x3d4470, 0x4a5180],
    platformEdge: BLACK_HULL,
    coin: 0xfff3c8,
    // Provisional: star-cream coin + white perfect must not compete on one
    // landing — Day 3 decides the final split.
    perfect: { fill: 0xffffff, ring: 0xffffff },
    motionCue: FULL_CUE,
    props: [
      { family: 'starfield', colors: [0xfff3c8], count: 1, scaleMin: 1, scaleMax: 1, side: 'sky', parallax: 0 },
      { family: 'crescent', colors: [0xfff3c8], count: 1, scaleMin: 0.8, scaleMax: 1.2, side: 'sky', parallax: 0.02 },
      { family: 'aurora', colors: [0x38f0e8, 0xff4dd8], count: 2, scaleMin: 0.8, scaleMax: 1.2, side: 'sky', parallax: 0.05 }
    ]
  }
};

/**
 * Look up a world's look. Throws on unknown ids — a world must never
 * silently fall back to another look (or the dark UI theme).
 */
export function getWorldLook(id: string): WorldLook {
  const look = (WORLD_LOOKS as Record<string, WorldLook | undefined>)[id];
  if (!look) throw new Error(`HOP: unknown world id "${id}" — no WorldLook`);
  return look;
}

/** Documented contrast floor: lightest platform face vs sky (WCAG ratio).
 *  Tripwire for the Day 3 Void pass — faces must never darken past this. */
export const VOID_CONTRAST_FLOOR = 1.3;

/** Relative luminance of a hex color (WCAG 2.x). Pure — unit-tested. */
export function luminance(hex: number): number {
  const channel = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const r = channel((hex >> 16) & 0xff);
  const g = channel((hex >> 8) & 0xff);
  const b = channel(hex & 0xff);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two hex colors (1–21). Pure — unit-tested. */
export function contrastRatio(a: number, b: number): number {
  const l1 = luminance(a);
  const l2 = luminance(b);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}
