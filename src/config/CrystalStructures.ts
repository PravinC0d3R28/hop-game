/**
 * Authored crystal structures (Week 2 Day 1).
 *
 * A structure is pure DATA — a list of crystal placements — so it can be
 * authored in the editor (`crystal-editor.html`), exported as JSON, pasted in
 * here, and then replayed exactly by the game. The procedural cluster
 * generator still exists for filler, but the hero formations come from here.
 *
 * Every crystal is described the way an artist thinks about one:
 *   position (x,y,z), rotation (rx,ry,rz) in radians, width, height, taper,
 *   facet count, and a palette INDEX (never a raw colour — the palette is
 *   locked so the three worlds stay coherent).
 */

export interface CrystalNode {
  /** Cluster-local base position. `y` is the buried base, so negatives sink it. */
  x: number;
  y: number;
  z: number;
  /** Euler rotation in radians. */
  rx: number;
  ry: number;
  rz: number;
  /** Base radius. */
  width: number;
  /** Tip height above the base. */
  height: number;
  /** Tip radius as a fraction of the base (0..1). */
  taper: number;
  /** Facet count. */
  sides: number;
  /** Index into the world's crystal palette. */
  color: number;
}

export interface CrystalStructure {
  id: string;
  name: string;
  /** Typical height of the formation, used to scale it against the cloud deck. */
  height: number;
  crystals: CrystalNode[];
}

const d = Math.PI / 180;

/**
 * Sunrise's crystal palette (docs/ART/Sunrise_Peaks_Color_Palette.md §4).
 * Saturated body colours, modest lift for highlights. The editor's swatches and
 * the game both read this list, so an exported index always resolves.
 */
export const SUNRISE_CRYSTAL_PALETTE = [
  { name: 'coral', base: 0xf2545f, light: 0xff7d70, shade: 0xc4374c, cream: 0xffa892 },
  { name: 'amber', base: 0xff9a4d, light: 0xffb96a, shade: 0xdb7530, cream: 0xffd79a },
  { name: 'mint', base: 0x5fcf9a, light: 0x8ce0b8, shade: 0x35a97c, cream: 0xbdeecf },
  { name: 'teal', base: 0x2fb8d4, light: 0x63d2e6, shade: 0x1a8fa8, cream: 0x9fe4f0 },
  { name: 'gold', base: 0xf5c531, light: 0xffd964, shade: 0xc99a1c, cream: 0xffeeb0 }
] as const;

/** Shorthand for a node so the structures below stay readable. */
function n(
  x: number, y: number, z: number,
  height: number, width: number,
  color: number,
  opts: Partial<Pick<CrystalNode, 'rx' | 'ry' | 'rz' | 'taper' | 'sides'>> = {}
): CrystalNode {
  return {
    x, y, z,
    rx: opts.rx ?? 0,
    ry: opts.ry ?? 0,
    rz: opts.rz ?? 0,
    width,
    height,
    taper: opts.taper ?? 0.55,
    sides: opts.sides ?? 6,
    color
  };
}

/**
 * The five hero formations. These are the ones authored in the editor — each
 * has a distinct silhouette so the field never repeats itself, and the mix of
 * thin needles and one broad anchor reads as a natural formation.
 */
export const CRYSTAL_STRUCTURES: CrystalStructure[] = [
  {
    id: 'needles',
    name: 'Needles',
    height: 9,
    crystals: [
      n(0, 0, 0, 9.0, 1.15, 3, { ry: 0.4, taper: 0.42 }),
      n(-1.9, -0.6, 0.9, 5.6, 0.95, 2, { ry: 1.9, rz: 7 * d, taper: 0.5 }),
      n(1.7, -0.9, -0.7, 4.4, 0.85, 0, { ry: 2.7, rz: -6 * d, taper: 0.52 }),
      n(0.4, -1.6, 1.6, 3.0, 0.7, 4, { ry: 1.2, rx: 5 * d, taper: 0.55 })
    ]
  },
  {
    id: 'splay',
    name: 'Splay',
    height: 8,
    crystals: [
      n(0, 0, 0, 8.0, 1.35, 1, { ry: 0.2, taper: 0.5 }),
      n(-2.6, -0.7, 0.6, 5.2, 1.0, 0, { ry: 1.1, rz: 16 * d, taper: 0.48 }),
      n(2.4, -0.8, -0.5, 5.8, 1.05, 2, { ry: 2.4, rz: -14 * d, taper: 0.5 }),
      n(0.2, -1.4, 2.2, 3.6, 0.8, 3, { ry: 0.9, rx: 9 * d, taper: 0.5 }),
      n(-1.2, -1.9, -1.9, 2.6, 0.7, 4, { ry: 2.0, taper: 0.55 })
    ]
  },
  {
    id: 'ridge',
    name: 'Ridge',
    height: 7,
    crystals: [
      n(-3.2, -0.5, -1.2, 6.4, 1.1, 2, { ry: 0.6, taper: 0.5 }),
      n(-1.1, -0.2, -0.4, 7.4, 1.25, 3, { ry: 1.5, taper: 0.48 }),
      n(1.0, -0.4, 0.3, 6.8, 1.15, 4, { ry: 2.2, taper: 0.5 }),
      n(3.0, -0.7, 1.1, 5.4, 0.95, 0, { ry: 3.0, rz: -8 * d, taper: 0.52 }),
      n(0.1, -1.5, 1.8, 3.2, 0.72, 1, { ry: 1.7, rx: 7 * d, taper: 0.55 })
    ]
  },
  {
    id: 'crown',
    name: 'Crown',
    height: 10,
    crystals: [
      n(0, 0, 0, 10.0, 1.55, 1, { ry: 0.3, taper: 0.44 }),
      n(-2.2, -0.5, 1.4, 6.6, 1.1, 3, { ry: 1.4, rz: 12 * d, taper: 0.48 }),
      n(2.1, -0.6, 1.2, 6.2, 1.05, 0, { ry: 2.3, rz: -11 * d, taper: 0.48 }),
      n(0.9, -0.9, -2.0, 5.0, 0.9, 2, { ry: 0.7, rx: 10 * d, taper: 0.5 }),
      n(-1.4, -1.2, -1.6, 4.2, 0.8, 4, { ry: 2.8, taper: 0.52 }),
      n(2.6, -1.5, -0.4, 3.0, 0.68, 1, { ry: 1.9, rx: 6 * d, taper: 0.55 })
    ]
  },
  {
    id: 'shards',
    name: 'Shards',
    height: 8,
    crystals: [
      n(-1.4, -0.4, 0.5, 8.2, 0.95, 3, { ry: 0.6, rz: 9 * d, taper: 0.4 }),
      n(1.5, -0.5, -0.4, 7.0, 0.88, 0, { ry: 2.1, rz: -8 * d, taper: 0.42 }),
      n(0.2, -1.0, 1.9, 4.6, 1.2, 4, { ry: 1.3, rx: 12 * d, taper: 0.5 }),
      n(-0.6, -1.4, -1.7, 3.4, 1.0, 1, { ry: 2.7, taper: 0.52 }),
      n(2.4, -1.7, 1.1, 2.4, 0.66, 2, { ry: 0.2, rz: -14 * d, taper: 0.56 })
    ]
  }
];
