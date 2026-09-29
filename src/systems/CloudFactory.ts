// Week 2 Day 1 — the Sunrise cloud sea.
//
// The concept's clouds are NOT a few discrete puffs: they are a dense,
// soft blanket filling the bottom ~40% of the frame that the crystal
// formations emerge from. So we build one merged, vertex-colored geometry
// per segment (base / highlight / shadow tones baked per facet) = 1 draw
// call for the entire sea, which makes the density free.
//
// No outlines here (owner pick: clouds stay soft and airy; hulling every
// billow cost ~16 draws and read as noise).
import { BufferGeometry, Color, Float32BufferAttribute } from 'three';
import { makeRng } from './CrystalFactory';

export interface CloudPalette {
  base: number;
  highlight: number;
  shadow: number;
}

export interface CloudSeaOpts {
  /** Segment length along +Z. */
  length: number;
  /** Half-width of the blanket. */
  spread: number;
  /** Blanket top height (crystals are buried below it). */
  top: number;
  /** How deep the blanket sits below top. */
  depth: number;
  /** Billows per segment. */
  density: number;
  palette: CloudPalette;
  seed: number;
}

const BILLOW_RINGS = 6;
const BILLOW_SEGS = 10;

/** Low-poly unit billow (spherical, non-indexed → flat facets). */
function billowTemplate(): { pos: number[] } {
  const pos: number[] = [];
  const profile = (t: number): number => Math.sqrt(Math.max(0, 1 - t * t));
  for (let r = 0; r < BILLOW_RINGS; r++) {
    const p0 = -1 + (2 * r) / BILLOW_RINGS;
    const p1 = -1 + (2 * (r + 1)) / BILLOW_RINGS;
    for (let s = 0; s < BILLOW_SEGS; s++) {
      const a0 = (s / BILLOW_SEGS) * Math.PI * 2;
      const a1 = ((s + 1) / BILLOW_SEGS) * Math.PI * 2;
      const v = (phi: number, ang: number) => {
        const rr = profile(phi);
        return [Math.cos(ang) * rr, phi, Math.sin(ang) * rr];
      };
      const A = v(p0, a0), B = v(p0, a1), Cc = v(p1, a1), D = v(p1, a0);
      pos.push(...A, ...Cc, ...B, ...A, ...D, ...Cc);
    }
  }
  return { pos };
}

const TEMPLATE = billowTemplate();

/**
 * Build one cloud-sea segment. Billows are laid in staggered rows so the
 * surface reads as a continuous blanket, denser toward the near edges where
 * the concept frames the path.
 */
export function buildCloudSea(o: CloudSeaOpts): BufferGeometry {
  const rnd = makeRng(o.seed);
  const pos: number[] = [];
  const nor: number[] = [];
  const col: number[] = [];
  const cBase = new Color(o.palette.base);
  const cHi = new Color(o.palette.highlight);
  const cSh = new Color(o.palette.shadow);
  const tmp = new Color();
  const tpl = TEMPLATE.pos;

  for (let i = 0; i < o.density; i++) {
    const z = (i / o.density) * o.length + (rnd() - 0.5) * 2.6;
    // The concept's blanket spans the FULL width — including behind the path.
    // Only a narrow ribbon is left open, so the tiles read against cloud.
    const lane = rnd();
    const x = lane < 0.3
      ? (rnd() - 0.5) * 3.4
      : (rnd() < 0.5 ? -1 : 1) * (2.4 + rnd() * (o.spread - 2.4));
    const yTop = o.top - rnd() * o.depth * 0.5;
    const rx = 1.2 + rnd() * 1.1;
    const ry = 0.6 + rnd() * 0.7;
    const rz = 1.1 + rnd() * 0.9;
    const spin = rnd() * Math.PI * 2;
    const cs = Math.cos(spin), sn = Math.sin(spin);
    const pick = rnd();
    const billowTone = pick < 0.24 ? cHi : pick < 0.82 ? cBase : cSh;

    // Walk the template's three DISTINCT vertices per triangle. (Reading only
    // tpl[t..t+2] and pushing that point three times made every triangle
    // zero-area — the whole sea was invisible while the vertex count and
    // bounding sphere still looked valid.)
    for (let t = 0; t < tpl.length; t += 9) {
      for (let v = 0; v < 3; v++) {
        const lx = tpl[t + v * 3] * rx;
        const ly = tpl[t + v * 3 + 1] * ry;
        const lz = tpl[t + v * 3 + 2] * rz;
        const wx = x + (lx * cs - lz * sn);
        const wz = z + (lx * sn + lz * cs);
        const wy = yTop + ly;
        // Facet tone by height: crowns catch the light, undersides sink.
        const up = (ly / ry + 1) / 2;
        tmp.copy(billowTone).lerp(up > 0.72 ? cHi : cSh, Math.abs(up - 0.62) * 0.9);
        pos.push(wx, wy, wz);
        nor.push(0, 1, 0);
        col.push(tmp.r, tmp.g, tmp.b);
      }
    }
  }

  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return geo;
}
