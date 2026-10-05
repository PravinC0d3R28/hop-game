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

/** Crystal clusters: clumps of related crystals flanking the path. */
export interface CrystalFieldRecipe extends RecipeBase {
  family: 'crystalfield';
  families: CrystalFamily[];
  /** Y of the cloud-top the clusters grow out of (well below the tiles). */
  baseY: number;
}

/** The soft blanket crystals rise out of. */
export interface CloudSeaRecipe extends RecipeBase {
  family: 'cloudsea';
  palette: { base: number; highlight: number; shadow: number };
  /** Half-width of the blanket. */
  spread: number;
  /** Crest height — the sea's top surface. */
  top: number;
  /** Trough depth below the crest. */
  depth: number;
  /** Grid resolution. */
  cols: number;
  rows: number;
  /** Billow spacing. Smaller = puffier. */
  cell?: number;
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
  /** Optional mid stop for a three-band sky. */
  skyMid?: number;
  skyBottom: number;
  /**
   * Full sky ramp, horizon (index 0) → top of frame. When set, the Sunrise
   * score-mood hue walk leaves this sky alone.
   */
  skyStops?: number[];
  /** Sunrise sun-ray fan. Worlds with their own horizon leave this off. */
  sunRays?: boolean;
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
  /** Optional side colours. Absent = derive a darker side from the top. */
  platformSides?: number[];
  platformEdge: number;
  /** Tile-top diamond marker colour. */
  tileMark: number;
  /** Blob-shadow tint (follows the world, not the removed light/dark toggle). */
  shadow: number;
  coin: number;
  perfect: { fill: number; ring: number };
  /** Motion tell. `strength: 0` = this world never shows the cue (Sunrise). */
  motionCue: { color: number; strength: number };
  props: PropRecipe[];
}

import { SUNRISE_CRYSTAL_PALETTE, getActivePalette } from './CrystalStructures';
import {
  DUSK_FACADE,
  DUSK_FOG,
  DUSK_OUTLINE,
  DUSK_RIBBON,
  DUSK_SIDES,
  DUSK_SKY,
  DUSK_TILES
} from '../worlds/dusk/DuskPalette';

/** The active colour system; see docs/ART/Sunrise_Peaks_Selected_Palettes.md. */
const PAL = getActivePalette();

const BLACK_HULL = 0x111111;
const NO_CUE = { color: 0x38f0e8, strength: 0 };
const FULL_CUE = { color: 0x38f0e8, strength: 1 };

export const WORLD_LOOKS: Record<WorldId, WorldLook> = {
  // ---- Sunrise Peaks: locked 2026-09-02 (docs/ART concept + palette) ----
  sunrise: {
    id: 'sunrise',
    // Every colour below comes from the active palette
    // (docs/ART/Sunrise_Peaks_Selected_Palettes.md). Aqua Bloom is the default:
    // the doc calls it fresher, brighter and more playful, and poppy was the
    // brief. Switch to Lavender Bloom with `?palette=lavender`.
    skyTop: PAL.skyTop,
    skyMid: PAL.skyMid,
    skyBottom: PAL.skyBottom,
    // Fog sits ON the sky's own value so distant geometry dissolves into it
    // instead of turning to mud. The first pass used a tan fog and far crystals
    // became brown blobs against the dawn.
    fogColor: PAL.fogColor,
    // The original 14/40 fog assumed a game with NO ground plane. With a cloud
    // sea under the path, a steeply-down camera sees only ground already past
    // fogNear, so the whole sea fogged to sky and vanished.
    //
    // fogNear also controls how much colour survives. At 28 the first authored
    // formations (z≈30) were already 5% hazed and the pale Aqua Bloom bleached
    // out. Pushing the near plane to 40 keeps the whole playable mid-field fully
    // saturated while still swallowing the cloud deck's far edge.
    fogNear: 40,
    fogFar: 82,
    // High-key dawn: a strong ambient keeps shaded facets coloured (the 4-step
    // toon ramp drops unlit faces to near-black otherwise).
    ambient: { ...PAL.ambient },
    directional: { ...PAL.directional },
    // Upper-left, but pulled forward so camera-facing facets stay lit.
    directionalPos: [-4, 9, 13],
    // Concept tiles are IVORY dominant with warm gold/amber variants — never the
    // crystal palette, so the two never collapse into one visual category.
    // No cream anywhere in the cycle: every face must separate from the cream
    // cloud sea. Slots alternate warm base / bright / deep warm.
    platformFaces: [PAL.tiles.base, PAL.tiles.bright, PAL.tiles.base, PAL.tiles.mid, PAL.tiles.bright, PAL.tiles.accent],
    tileMark: PAL.tileMark,
    // Doc-locked warm dark outline, shared across both palette variants.
    platformEdge: PAL.outline,
    shadow: PAL.shadow,
    coin: PAL.coin,
    // White on ivory reads via outlines + side shade (concept-confirmed).
    perfect: { fill: 0xffffff, ring: 0xffffff },
    sunRays: true,
    motionCue: NO_CUE,
    props: [
      {
        family: 'crystalfield',
        // Seven palette colours with DERIVED facet tones. The authored
        // structures index into this list, so the order must not change.
        families: SUNRISE_CRYSTAL_PALETTE,
        count: 16,
        // Bases sit ~3.5 below the tile plane, which is well ABOVE the deck
        // (datum −5.6): the crystals rise out of the cloud tops rather than
        // starting inside them.
        baseY: -3.5,
        parallax: 0.2
      },
      {
        family: 'cloudsea',
        palette: { ...PAL.cloud },
        count: 1,
        // The deck's datum sits well BELOW the tiles, and the owner asked for it
        // lower still: the further down it sits, the more the path reads as
        // floating high above a cloud sea. Tiles span −0.4..+0.4, the deck
        // datum is −5.6, so the cloud tops sit ~5 units underfoot.
        //
        // `spread` must be wide enough that the deck's side edge falls BEYOND
        // fogFar. At 32 the edge was ~46 units out — only 34% fogged — so on a
        // 16:9 frame the sky showed through past it as hard pink wedges. At 64
        // the nearest edge point is ~86 units away, i.e. fully fogged.
        spread: 64,
        top: -8.5,
        depth: 2.8,
        cols: 96,
        rows: 48,
        cell: 3,
        parallax: 0.15
      }
    ]
  },
  // ---- Dusk District: locked to the canyon concept (docs/ART/WORLD 2) ----
  dusk: {
    id: 'dusk',
    // Deep plum overhead, golden peach on the horizon. skyStops is the real
    // ramp; these two keep the clear colour and any two-stop fallback honest.
    skyTop: DUSK_SKY[DUSK_SKY.length - 1],
    skyBottom: DUSK_SKY[0],
    skyStops: DUSK_SKY,
    fogColor: DUSK_FOG,
    // Same idea as Sunrise: fogNear keeps the tiles clean, fogFar swallows
    // the city before it runs to the far plane. Shorter than Sunrise's 82
    // so the canyon does not stay sharp all the way down the street.
    fogNear: 38,
    fogFar: 70,
    // Tiles are lit by the real scene lights. A strong warm ambient keeps the
    // toon ramp from crushing the near face of a tile to black.
    ambient: { color: 0xffe0cc, intensity: 0.72 },
    directional: { color: 0xffb36f, intensity: 1.35 },
    // Ahead and above: the sunset the player is walking toward.
    directionalPos: [1.5, 14, 26],
    platformFaces: DUSK_TILES,
    platformSides: DUSK_SIDES,
    tileMark: 0xffffff,
    platformEdge: DUSK_OUTLINE,
    shadow: 0x3a2044,
    coin: 0xffd36b,
    perfect: { fill: 0xffffff, ring: 0xffffff },
    // The cyan ribbon on the tile's lower edge. Not an architectural colour.
    motionCue: { color: DUSK_RIBBON, strength: 1 },
    props: [
      {
        family: 'city',
        colors: DUSK_FACADE,
        count: 1,
        scaleMin: 1,
        scaleMax: 1,
        side: 'both',
        parallax: 1
      }
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
    tileMark: 0xd8dcf0,
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









