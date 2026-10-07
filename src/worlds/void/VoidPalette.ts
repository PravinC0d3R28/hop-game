/**
 * Locked Deep Void colours.
 * Source: docs/ART/WORLD 3/Deep_Void_Color_and_Visual_System.md
 * and the four paintings in that folder.
 *
 * Sky stops run from the low edge of the frame (index 0, under the path)
 * to the top. This camera looks steeply down, so the lower frame is void
 * and the aurora lives in the upper band.
 */

/** Under the path → top of the frame. Navy the whole way, never black. */
export const VOID_SKY: number[] = [
  0x070e22,
  0x0b1228,
  0x101838,
  0x161e48,
  0x12183c,
  0x0c1430
];

/** Distant rocks sink into this. Same family as the sky, so the fade is clean. */
export const VOID_FOG = 0x0b1228;

/** Structure stone. Dark navy, a lit face, a rare highlight, a little violet. */
export const VOID_STONE = {
  shadow: 0x0b1228,
  midnight: 0x101b3a,
  face: 0x17284e,
  lit: 0x24446b,
  highlight: 0x355b79,
  violet: 0x302b67
} as const;

/**
 * Saturated tops, the way the path reads in the paintings.
 * Royal blue on most steps, purple on the rest. None of them white.
 */
export const VOID_TILES: number[] = [
  0x2a4c92, 0x3a62be, 0x243f78, 0x3458ae,
  0x4e3f96, 0x2a4c92, 0x3a62be, 0x5a48a8,
  0x243f78, 0x3a62be, 0x2a4c92, 0x6a56b4,
  0x3458ae, 0x4e3f96, 0x243f78, 0x3a62be,
  0x2a4c92, 0x5a48a8
];

/** Sides stay in the stone family, including under a light top. */
export const VOID_SIDES: number[] = [
  0x0b1228, 0x101b3a, 0x17284e, 0x101b3a,
  0x0b1228, 0x302b67, 0x101b3a, 0x17284e,
  0x0b1228, 0x101b3a, 0x101b3a, 0x17284e,
  0x0b1228, 0x101b3a, 0x17284e, 0x101b3a,
  0x0b1228, 0x101b3a
];

export const VOID_AURORA = [0x32d8e5, 0x24c7c8, 0x4a9be8, 0x8e66e8, 0xc45ae5, 0xb8a4ef] as const;

export const VOID_STAR = 0xf7d66a;
export const VOID_STAR_SOFT = 0xfff3b0;
export const VOID_STAR_BRIGHT = 0xfff9e8;

export const VOID_MOON_CORE = 0xddf7ff;
export const VOID_MOON_GLOW = 0x79d8f2;
export const VOID_MOON_HALO = 0x466ea8;

export const VOID_LINE_COOL = 0x8fb8d6;
export const VOID_LINE_WARM = 0xd8be78;

/** Tile rim, used when the void edge is painted. Cyan, then violet, magenta rare. */
export const VOID_RIM = 0x36e4ee;
export const VOID_RIM_VIOLET = 0x8a73f5;
export const VOID_RIM_MAGENTA = 0xd35be7;

/** Cyan on most tiles, magenta on a few, violet on one step of the cycle. */
export function voidRimColor(index: number): number {
  const n = ((index % 8) + 8) % 8;
  if (n === 2 || n === 5) return VOID_RIM_MAGENTA;
  if (n === 7) return VOID_RIM_VIOLET;
  return VOID_RIM;
}
