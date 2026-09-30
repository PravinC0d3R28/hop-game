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

function toHsl(c: number): [number, number, number] {
  const r = ((c >> 16) & 255) / 255, g = ((c >> 8) & 255) / 255, b = (c & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}

function fromHsl(h: number, s: number, l: number): number {
  const c = (1 - Math.abs(2 * l - 1)) * Math.max(0, Math.min(1, s));
  const hp = (h % 1 + 1) % 1;
  const x = c * (1 - Math.abs(((hp * 6) % 2) - 1));
  const m = l - c / 2;
  let rgb: [number, number, number];
  const seg = Math.floor(hp * 6);
  if (seg === 0) rgb = [c, x, 0];
  else if (seg === 1) rgb = [x, c, 0];
  else if (seg === 2) rgb = [0, c, x];
  else if (seg === 3) rgb = [0, x, c];
  else if (seg === 4) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  const to = (v: number): number => Math.max(0, Math.min(255, Math.round((v + m) * 255)));
  return (to(rgb[0]) << 16) | (to(rgb[1]) << 8) | to(rgb[2]);
}

/**
 * Push a palette colour toward "poppy" WITHOUT moving its hue.
 *
 * The doc's crystal hexes are correct in hue but high-key in value, and the
 * owner wants them to read as vividly as the tiles. So saturation is driven up
 * and lightness is pulled toward the middle — the hue is held fixed, which is
 * what keeps coral looking like coral and not drifting toward red. Clamped so a
 * near-grey source colour cannot be pushed into neon.
 */
function poppy(base: number, satBoost = 1.42, lightTarget = 0.52): number {
  const [h, s, l] = toHsl(base);
  return fromHsl(h, Math.min(0.95, s * satBoost), s * satBoost > 0.2 ? lightTarget : l);
}

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
  return p.crystals.map((c) => {
    const base = poppy(c.base);
    return { name: c.name, ...tonesFor(base, p.paleFacet) };
  });
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
