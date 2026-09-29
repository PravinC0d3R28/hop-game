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

/**
 * Prop silhouette family. `crystalfield` + `cloudsea` are implemented (Sunrise);
 * the rest are reserved slots for the Dusk/Void passes and are skipped safely.
 */
export type PropFamily =
  | 'crystalfield'
  | 'cloudsea'
  | 'city'
  | 'lantern'
  | 'crescent'
  | 'starfield'
  | 'aurora';

/** A crystal colour family: one base tone, three derived facet tones. */
export interface CrystalFamily {
  base: number;
  light?: number;
  shade?: number;
  cream?: number;
}

interface RecipeBase {
  /** Items per environment segment (formations / blanket recipes). */
  count: number;
  /** 0 = static distant backdrop … 1 = rides with the runway. */
  parallax: number;
}

/** Crystal formations: clusters of related crystals flanking the path. */
export interface CrystalFieldRecipe extends RecipeBase {
  family: 'crystalfield';
  families: CrystalFamily[];
  /** Crystals per formation (1 dominant spire + N-1 satellites). */
  perFormation: number;
}

/** The soft blanket crystals emerge from. */
export interface CloudSeaRecipe extends RecipeBase {
  family: 'cloudsea';
  palette: { base: number; highlight: number; shadow: number };
  /** Billows per segment. */
  density: number;
  /** Half-width of the blanket. */
  spread: number;
  /** Blanket top height (crystal bases sit below it). */
  top: number;
  /** How far the blanket dips below `top`. */
  depth: number;
}

/** Reserved family with no builder yet (Dusk/Void). */
export interface PendingRecipe extends RecipeBase {
  family: 'city' | 'lantern' | 'crescent' | 'starfield' | 'aurora';
  colors: number[];
  scaleMin: number;
  scaleMax: number;
  side: 'left' | 'right' | 'both' | 'sky';
}

export type PropRecipe = CrystalFieldRecipe | CloudSeaRecipe | PendingRecipe;

export interface WorldLook {
  id: WorldId;
  /** Gradient sky (skyTop at frame top → skyBottom at the horizon). */
  skyTop: number;
  skyBottom: number;
  fogColor: number;
  fogNear: number;
  fogFar: number;
  ambient: { color: number; intensity: number };
  directional: { color: number; intensity: number };
  /** Key-light position. Absent = keep the current position (Dusk/Void until
   *  their passes). Sunrise uses upper-left per the palette doc. */
  directionalPos?: [number, number, number];
  /** World-local platform face cycle (§11.5) + locked edge color. */
  platformFaces: number[];
  platformEdge: number;
  /** Blob-shadow tint (follows the world, not the removed light/dark toggle). */
  shadow: number;
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
  // ---- Sunrise Peaks: locked 2026-09-02 (docs/ART concept + palette) ----
  sunrise: {
    id: 'sunrise',
    // Sky bottom is deliberately a step deeper than the cloud palette: the
    // first pass used near-identical values and the cloud sea vanished.
    skyTop: 0xf3d2dc,
    skyBottom: 0xffe3c4,
    fogColor: 0xf9d9bc,
    // The original 14/40 fog assumed a game with NO ground plane — just
    // floating tiles. With a cloud sea under the path, a 37°-down camera sees
    // only ground that is already past fogNear, so the whole sea fogged out to
    // sky colour and vanished. Push fog to the far field and keep the near/mid
    // world clear.
    fogNear: 28,
    fogFar: 82,
    // High-key dawn: a strong ambient keeps the shaded facets coloured (the
    // 4-step toon ramp drops unlit faces to near-black otherwise, which turned
    // the crystal families into dark silhouettes).
    ambient: { color: 0xffe8d5, intensity: 0.85 },
    directional: { color: 0xffd39a, intensity: 1.3 },
    // Upper-left, but pulled forward so camera-facing facets stay lit.
    directionalPos: [-4, 9, 13],
    // Concept tiles are CREAM/IVORY dominant with warm tan sides — the gold and
    // amber tones are the occasional variant, not the base. (Side colours
    // derive from these in PlatformEntity.deriveSideColor.)
    platformFaces: [0xfff5d8, 0xfdf0d2, 0xffe9af, 0xfff5d8, 0xf7e39a, 0xffe9af],
    // Spike lock warmed per owner pick: charcoal reads black, sits in dawn.
    platformEdge: 0x3b302d,
    shadow: 0xb8a898,
    coin: 0xf0c020,
    // White on ivory reads via outlines + side shade (concept-confirmed).
    perfect: { fill: 0xffffff, ring: 0xffffff },
    motionCue: NO_CUE,
    props: [
      {
        family: 'crystalfield',
        // Four related families (palette §4): coral, peach, mint, cyan, gold.
        families: [
          { base: 0xff6f70, light: 0xff927c, shade: 0xe0505a, cream: 0xffb9a4 },
          { base: 0xffb07a, light: 0xffc27e, shade: 0xe08a5c, cream: 0xffe0bd },
          { base: 0x8de3b0, light: 0xb5f0c7, shade: 0x5fc89a, cream: 0xd6f7e2 },
          { base: 0x55cfe6, light: 0x89e8f1, shade: 0x35afc1, cream: 0xc0f2fa },
          { base: 0xffd95a, light: 0xffe9a0, shade: 0xe0b93a, cream: 0xfff4cd }
        ],
        count: 12,
        perFormation: 7,
        parallax: 0.2
      },
      {
        family: 'cloudsea',
        // Brighter than the sky with a real shadow tone — clouds that match
        // the sky value read as nothing at all (the first pass did exactly that).
        palette: { base: 0xfffefc, highlight: 0xffffff, shadow: 0xf0d3b2 },
        count: 1,
        density: 130,
        spread: 18,
        // Well BELOW the tile line (tiles span y −0.4..+0.4): the path floats
        // above the sea, and the sea reads as the bottom of the frame.
        top: -3.4,
        depth: 1.8,
        parallax: 0.15
      }
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
    shadow: 0x9a6a70,
    coin: 0xffb347,
    // Provisional: validated against peach in the Day 2 contrast check.
    perfect: { fill: 0xffffff, ring: 0xffffff },
    motionCue: FULL_CUE,
    props: [
      { family: 'city', colors: [0x6b5bb8, 0xc86ba6], count: 5, scaleMin: 0.8, scaleMax: 1.4, side: 'both', parallax: 0.25 },
      { family: 'lantern', colors: [0x38f0e8, 0xffd9a0], count: 8, scaleMin: 0.4, scaleMax: 0.8, side: 'both', parallax: 0.4 }
    ]  },
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
    shadow: 0x141428,
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
