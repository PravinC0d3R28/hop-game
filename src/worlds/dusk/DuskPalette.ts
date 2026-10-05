/**
 * Locked Dusk District colours.
 * Source: docs/ART/WORLD 2/Dusk_District_Final_Art_Direction.md
 *
 * Sky stops run from the horizon (index 0) to the top of the frame.
 * Facade stops run from the deepest shadow to the sunlit peach.
 */

/**
 * Bottom of the frame → top of the frame.
 *
 * This camera looks steeply down, so the lower frame is the canyon below the
 * path and the sunset sits in the upper-middle, not on the bottom edge.
 * Dark, then the warm band, then dark plum overhead.
 */
export const DUSK_SKY: number[] = [
  0x3a1848, // canyon under the path
  0x4a214f,
  0x6b2a61,
  0x9a3d67,
  0xd95c68,
  0xffb36f, // sunset, high in the frame
  0xf58a66,
  0x6b2a61,
  0x301530 // deep plum overhead
];

/** Shadow → sunlit. One flat colour per face, picked from this ramp. */
export const DUSK_FACADE: number[] = [
  0x261631,
  0x3b2146,
  0x5a2c59,
  0x713050,
  0xc65363,
  0xf07868,
  0xf49a67
];

/** Warm tops in the sunset family. Freckles darken them; the cyan band splits the height. */
export const DUSK_TILES: number[] = [0xf8e6c8, 0xf0c878, 0xe8a45c, 0xe08868];
/** Warm slab edge, a step darker than the top, still in the same light. */
export const DUSK_SIDES: number[] = [0xe0b088, 0xd09870, 0xc48460, 0xb87068];

export const DUSK_OUTLINE = 0x4a3638;
export const DUSK_RIBBON = 0x20e6ea;
export const DUSK_RIBBON_HOT = 0x63f5f2;

export const DUSK_LANTERN = 0xffb347;
export const DUSK_LANTERN_CORE = 0xffd36b;
export const DUSK_LANTERN_ROSE = 0xff7f95;
export const DUSK_LANTERN_SOFT = 0xff9361;

export const DUSK_WINDOW = 0x140c18;

/** Darkest recess tone - arch and opening interiors, darker than any facade. */
export const DUSK_ARCH = 0x100814;

/**
 * Distance and the canyon floor sink into this. A bright pink fog was washing
 * every facade out, so the fog is the same deep plum as the shadow faces.
 */
export const DUSK_FOG = 0x1c1028;

export const DUSK_LANTERN_COLORS = [DUSK_LANTERN, DUSK_LANTERN_ROSE, DUSK_LANTERN_SOFT, DUSK_LANTERN_CORE];

