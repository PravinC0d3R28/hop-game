/**
 * Sunrise Peaks colour system (docs/ART/Sunrise_Peaks_Selected_Palettes.md).
 *
 * The doc supplies two candidates — "Aqua Bloom" and "Lavender Bloom" — over an
 * otherwise identical world, and explicitly says to generate/test them
 * independently rather than blending them. So they are modelled as two complete
 * palettes and the world is built from whichever is active. Aqua Bloom is the
 * default: the doc's own comparison calls it fresher, brighter and more
 * playful, and the owner asked for colours that stay poppy.
 *
 * Only colour changes between them. Geometry, camera, cloud sea, density,
 * lighting direction and the warm dark outline are all fixed by the doc and are
 * NOT varied here.
 */

/** One selectable crystal colour. Facet tones are derived, never hand-picked. */
export interface CrystalColour {
  name: string;
  /** Body colour — the crystal's dominant facet. */
  base: number;
}

/** Everything a palette supplies. */
export interface Palette {
  id: string;
  name: string;
  skyTop: number;
  /** Optional mid-stop for a three-band sky. */
  skyMid?: number;
  skyBottom: number;
  fogColor: number;
  cloud: { base: number; highlight: number; shadow: number };
  /** Ordered: an authored structure's `color` is an index into this list. */
  crystals: CrystalColour[];
  /** Shared warm-white used for the brightest facets. */
  paleFacet: number;
  tiles: { base: number; bright: number; mid: number; accent: number };
  ball: number;
  outline: number;
  ambient: { color: number; intensity: number };
  directional: { color: number; intensity: number };
  shadow: number;
  coin: number;
}

/**
 * Crystal colour ORDER is load-bearing. The authored structures were designed
 * against this ordering, so slots keep their original meaning:
 *   0 coral · 1 peach · 2 mint · 3 cyan · 4 yellow · 5 purple · 6 blue
 * Inserting a colour at the front would silently repaint every formation.
 */
export const PALETTES: Record<string, Palette> = {
  aqua: {
    id: 'aqua',
    name: 'Aqua Bloom',
    skyTop: 0xdccff0,
    skyBottom: 0xe8f6e7,
    // Deliberately deeper and more saturated than skyBottom. Matching the fog to
    // the sky made every mid-distance crystal bleach to near-white and killed the
    // poppy read; a slightly deeper fog instead gives real atmospheric
    // perspective — far crystals TINT instead of dissolving.
    fogColor: 0xd3e6da,
    cloud: { base: 0xf9f7f0, highlight: 0xffffff, shadow: 0xe4e2d4 },
    crystals: [
      { name: 'coral', base: 0xf47c82 },
      { name: 'peach', base: 0xffb078 },
      { name: 'mint', base: 0x67d8b0 },
      { name: 'cyan', base: 0x42cfe0 },
      { name: 'yellow', base: 0xf8d95a },
      { name: 'purple', base: 0xb58ae8 },
      { name: 'blue', base: 0x71bdeb }
    ],
    paleFacet: 0xfff3dc,
    // Tiles stay in the warm ivory/gold family and must never take on the
    // crystal palette — the doc is explicit that the two must not collapse into
    // the same visual category.
    //
    // `bright` is deliberately a deep tangerine, NOT the doc's Lemon Yellow:
    // lemon yellow sits at almost the same value as the cream cloud sea and the
    // variant tile vanished into it. A deeper, more saturated warm orange keeps
    // the tile readable against cloud while staying inside the doc's permitted
    // warm range.
    tiles: { base: 0xfff6d8, bright: 0xf0902c, mid: 0xdd7a24, accent: 0xe05f42 },
    ball: 0xfffdf8,
    outline: 0x4a3638,
    ambient: { color: 0xffe8d0, intensity: 0.9 },
    directional: { color: 0xffe0b0, intensity: 1.3 },
    shadow: 0xb9ada0,
    coin: 0xf6c93f
  },
  lavender: {
    id: 'lavender',
    name: 'Lavender Bloom',
    skyTop: 0xd8cbef,
    skyMid: 0xe5d8f1,
    skyBottom: 0xeaf3df,
    fogColor: 0xd8cfe6,
    cloud: { base: 0xfaf8f1, highlight: 0xffffff, shadow: 0xdfd8de },
    crystals: [
      { name: 'coral', base: 0xf16f78 },
      { name: 'peach', base: 0xffa66f },
      { name: 'mint', base: 0x68d4ae },
      { name: 'cyan', base: 0x48cfe3 },
      { name: 'yellow', base: 0xf4d65a },
      { name: 'purple', base: 0xa875e1 },
      { name: 'blue', base: 0x65bfe8 }
    ],
    paleFacet: 0xfff3dc,
    // Same reasoning as Aqua: the doc's lemon yellow is unreadable on cream
    // cloud, so the variant tiles are a deep warm tangerine.
    tiles: { base: 0xfff5d8, bright: 0xef8f2b, mid: 0xd9761f, accent: 0xde5f40 },
    ball: 0xfffdf8,
    outline: 0x4a3638,
    ambient: { color: 0xffe6d2, intensity: 0.92 },
    directional: { color: 0xffd19c, intensity: 1.28 },
    shadow: 0xb6abb2,
    coin: 0xf3c53c
  }
};

export const DEFAULT_PALETTE_ID = 'aqua';

/** Resolve a palette id, falling back to the default rather than throwing. */
export function getPalette(id: string | null | undefined): Palette {
  return (id && PALETTES[id]) || PALETTES[DEFAULT_PALETTE_ID];
}
