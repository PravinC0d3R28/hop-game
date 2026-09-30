/**
 * Authored crystal formations.
 *
 * SOURCE OF TRUTH: `crystal-structures.authored.json` — the owner's final
 * export from `crystal-editor.html` (export (4).json, archived under
 * docs/ART/authored-crystal-structures/ with the earlier iterations).
 *
 * It is imported rather than copy-pasted into TypeScript on purpose: a
 * hand-maintained duplicate is guaranteed to drift the first time a formation
 * is re-exported, and then the game stops matching the preview.
 *
 * A formation is pure DATA, so the editor and the game build the identical
 * mesh. Nothing here is simulated, re-randomised or approximated.
 */
import authored from './crystal-structures.authored.json';
import { DEFAULT_PALETTE_ID, getPalette, type Palette } from './Palettes';

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
  /** Index into the active palette's crystal colour list. */
  color: number;
}

export interface CrystalStructure {
  id: string;
  name: string;
  /** Declared formation height; the game normalises spawn scale against it. */
  height: number;
  crystals: CrystalNode[];
}

export type { Palette };

/** The owner's authored formations, exactly as exported. */
export const CRYSTAL_STRUCTURES: CrystalStructure[] = authored as CrystalStructure[];

// ---------------------------------------------------------------- palette
export interface CrystalFamily {
  base: number;
  light?: number;
  shade?: number;
  cream?: number;
}

export interface PaletteFamily extends CrystalFamily {
  name: string;
}

const mix = (a: number, b: number, t: number): number => {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
};

/**
 * Derive the four facet tones for one crystal colour.
 *
 * The palette doc only specifies body colours plus a single shared "Pale
 * Facet" warm white, and asks for "stronger facet-to-facet value differences to
 * emphasize low-poly geometry" and moderately high saturation. So the ramp is
 * generated rather than hand-listed.
 *
 * The mixes are deliberately restrained. Pushing `light` far toward the pale
 * facet turned every crystal pastel — the body colour is what makes the field
 * read as poppy, and it must dominate the visible surface. Cream is reserved
 * for the handful of facets turned most directly into the key.
 */
function tonesFor(base: number, pale: number): CrystalFamily {
  return {
    base,
    light: mix(base, pale, 0.18),
    shade: mix(base, 0x000000, 0.3),
    cream: mix(base, pale, 0.72)
  };
}

function buildFamilies(p: Palette): PaletteFamily[] {
  return p.crystals.map((c) => ({ name: c.name, ...tonesFor(c.base, p.paleFacet) }));
}

let activePalette: Palette = getPalette(DEFAULT_PALETTE_ID);
let families: PaletteFamily[] = buildFamilies(activePalette);

/**
 * The active palette's crystal colours, with derived facet tones. This is a
 * live binding: switching palettes updates it in place, so the editor's
 * swatches and the game both follow without a reload.
 */
export let SUNRISE_CRYSTAL_PALETTE: PaletteFamily[] = families;

export function getActivePalette(): Palette {
  return activePalette;
}

/** Switch the world's colour system. Geometry and camera are unaffected. */
export function setActivePalette(id: string): Palette {
  activePalette = getPalette(id);
  families = buildFamilies(activePalette);
  SUNRISE_CRYSTAL_PALETTE = families;
  return activePalette;
}

/** Default initial value, overridable with `?palette=lavender` for A/B testing. */
if (typeof location !== 'undefined') {
  const q = new URLSearchParams(location.search).get('palette');
  if (q) setActivePalette(q);
}
