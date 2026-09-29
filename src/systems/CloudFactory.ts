// Week 2 Day 1 — the Sunrise cloud sea.
//
// REBUILT as a continuous SURFACE, not a pile of spheres. The previous version
// was hundreds of discrete billows and read as overlapping pebbles / "steam".
// The concept shows one soft, rolling blanket.
//
// How it works (the owner's idea, taken literally):
//   1. Lay down a solid grid — a white field covering the whole width/length.
//   2. Push every vertex up/down with smooth wave + value-noise functions.
//   3. Shade by height: crests catch the light, troughs sink to peach shadow.
//   4. Drop a skirt at the border so the mass reads solid, not as a sheet.
//
// One merged, vertex-coloured geometry = 1 draw call for the whole sea.
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
  /** Crest height (the sea's top). */
  top: number;
  /** How far the troughs dip below the crest. */
  depth: number;
  /** Grid resolution (columns × rows). */
  cols: number;
  rows: number;
  /** Billow spacing. Smaller = puffier. */
  cell?: number;
  palette: CloudPalette;
  seed: number;
}

/** Smooth 1-D value noise with a hashed lattice — the "wave function". */
function valueNoise1(seed: number): (x: number) => number {
  const hash = (i: number): number => {
    let h = (i * 374761393 + seed * 668265263) >>> 0;
    h = (h ^ (h >> 13)) * 1274126177 >>> 0;
    return ((h ^ (h >> 16)) >>> 0) / 4294967296;
  };
  const smooth = (t: number): number => t * t * (3 - 2 * t);
  return (x: number): number => {
    const i = Math.floor(x);
    const f = smooth(x - i);
    return hash(i) * (1 - f) + hash(i + 1) * f;
  };
}

interface Dome { x: number; z: number; r: number; a: number }

/**
 * Billow centres on a jittered grid. Domes (not a pure noise field) are what
 * make the deck read as PUFFY cloud rather than a sand dune: each is a smooth
 * gaussian bump, and taking the max of the overlapping ones gives the merged,
 * rounded billows the concept shows — while staying a single continuous
 * surface, not a pile of spheres.
 */
function makeDomes(seed: number, spread: number, length: number, cell: number): Dome[] {
  const rnd = makeRng(seed);
  const domes: Dome[] = [];
  for (let z = -cell; z < length + cell; z += cell) {
    for (let x = -spread - cell; x < spread + cell; x += cell) {
      domes.push({
        x: x + (rnd() - 0.5) * cell * 0.9,
        z: z + (rnd() - 0.5) * cell * 0.9,
        r: cell * (0.75 + rnd() * 0.75),
        a: 0.55 + rnd() * 0.8
      });
    }
  }
  return domes;
}

/** Two octaves of noise + a long swell — the rolling base under the billows. */
function seaHeight(x: number, z: number, n1: (v: number) => number, n2: (v: number) => number): number {
  const swell = Math.sin(x * 0.11 + z * 0.04) * 0.4;
  const rollA = n1(x * 0.06 + z * 0.035) - 0.5;
  const rollB = n2(x * 0.15 - z * 0.09) - 0.5;
  return swell + rollA * 1.0 + rollB * 0.45;
}

export function buildCloudSea(o: CloudSeaOpts): BufferGeometry {
  const rnd = makeRng(o.seed);
  const n1 = valueNoise1(o.seed * 3 + 1);
  const n2 = valueNoise1(o.seed * 7 + 5);
  const domes = makeDomes(o.seed * 11 + 3, o.spread, o.length, o.cell ?? 5);

  const cBase = new Color(o.palette.base);
  const cHi = new Color(o.palette.highlight);
  const cSh = new Color(o.palette.shadow);
  const tmp = new Color();

  const pos: number[] = [];
  const nor: number[] = [];
  const col: number[] = [];

  // --- 1. the solid field -------------------------------------------------
  // Height = rolling noise + the tallest overlapping dome. `top` is the DECK
  // datum (the level the tiles float just above); everything else is relief.
  const hAt = (ix: number, iz: number): { x: number; y: number; z: number; h: number } => {
    const x = (ix / o.cols - 0.5) * 2 * o.spread;
    const z = (iz / o.rows) * o.length;
    const roll = seaHeight(x, z, n1, n2) * o.depth;
    // Max of the gaussian billows → merged, rounded cloud tops.
    let billow = 0;
    for (const d of domes) {
      const dx = (x - d.x) / d.r;
      const dz = (z - d.z) / d.r;
      const q = dx * dx + dz * dz;
      if (q > 1) continue;
      const h = d.a * (1 - q * q); // smooth, flat-ish top, feathered skirt
      if (h > billow) billow = h;
    }
    // Soft-clip the relief so the tallest billow saturates just under the tile
    // plane. A hard clamp would leave flat plateaus on the biggest puffs;
    // tanh rolls them off smoothly instead, and guarantees a puff can never
    // spike up through the path and hide it.
    const lim = o.depth * 1.3;
    const relief = lim * Math.tanh((roll + billow * o.depth) / lim);
    // Lower toward the edges so the deck hugs the ground rather than walling
    // the corridor in.
    const edge = Math.abs(x) / o.spread;
    const h = o.top + relief * (1 - edge * 0.5);
    return { x, y: h, z, h };
  };

  // Key for the billow shading. Combined with the height tint below.
  const LAMP = { x: -0.5, y: 0.78, z: 0.38 };

  const put = (p: { x: number; y: number; z: number; h: number }, nx: number, nz: number): void => {
    pos.push(p.x, p.y, p.z);
    const len = Math.hypot(nx, 1, nz);
    const ux = nx / len, uy = 1 / len, uz = nz / len;
    nor.push(ux, uy, uz);
    // --- 3. two-part shading, because height tint alone is not enough.
    // The deck is seen almost edge-on from the game camera, so a pure
    // height tint compresses to a flat wash. A lambert term on the real
    // surface normal gives every billow a lit face and a shaded face from ANY
    // angle, which is what makes the deck read as volume rather than ground.
    const lam = Math.max(0, (ux * LAMP.x + uy * LAMP.y + uz * LAMP.z));
    const t = Math.max(0, Math.min(1, (p.h - o.top) / Math.max(0.001, o.depth * 2)));
    tmp.copy(cSh).lerp(cBase, Math.min(1, t * 1.7));
    // Slopes facing away from the key sink toward the shadow tone.
    tmp.lerp(cSh, (1 - lam) * 0.45);
    // Crests turn into the key catch the light.
    if (t > 0.5) tmp.lerp(cHi, ((t - 0.5) / 0.5) * lam * 0.85);
    col.push(tmp.r, tmp.g, tmp.b);
  };

  // Quads across the field, normals from the local slope so the roll reads.
  for (let iz = 0; iz < o.rows; iz++) {
    for (let ix = 0; ix < o.cols; ix++) {
      const a = hAt(ix, iz);
      const b = hAt(ix + 1, iz);
      const c = hAt(ix + 1, iz + 1);
      const d = hAt(ix, iz + 1);
      const dx = b.y - a.y;
      const dz = d.y - a.y;
      const len = Math.hypot(dx, 1, dz);
      const nx = -dx / len;
      const nz = -dz / len;
      put(a, nx, nz); put(c, nx, nz); put(b, nx, nz);
      put(a, nx, nz); put(d, nx, nz); put(c, nx, nz);
    }
  }

  // --- 4. skirt: drop the border to a floor so the sea is a solid mass ----
  const floor = o.top - o.depth * 2.4;
  for (let iz = 0; iz <= o.rows; iz++) {
    for (const side of [0, o.cols]) {
      const p = hAt(side, iz);
      const x = side === 0 ? -o.spread * 1.04 : o.spread * 1.04;
      const nx = side === 0 ? -1 : 1;
      // top edge
      pos.push(p.x, p.y, p.z); nor.push(nx, 0, 0); col.push(cSh.r, cSh.g, cSh.b);
      pos.push(x, p.y, p.z); nor.push(nx, 0, 0); col.push(cSh.r, cSh.g, cSh.b);
      pos.push(x, floor, p.z); nor.push(nx, 0, 0); col.push(cSh.r, cSh.g, cSh.b);
      // near/far caps
      pos.push(p.x, p.y, p.z); nor.push(0, 0, 0); col.push(cSh.r, cSh.g, cSh.b);
      pos.push(x, floor, p.z); nor.push(0, 0, 0); col.push(cSh.r, cSh.g, cSh.b);
      pos.push(x, p.y, p.z); nor.push(0, 0, 0); col.push(cSh.r, cSh.g, cSh.b);
    }
  }
  for (let ix = 0; ix <= o.cols; ix++) {
    for (const zEnd of [0, o.rows]) {
      const p = hAt(ix, zEnd);
      const z = zEnd === 0 ? -o.depth * 0.6 : o.length + o.depth * 0.6;
      const nz = zEnd === 0 ? -1 : 1;
      pos.push(p.x, p.y, p.z); nor.push(0, 0, nz); col.push(cSh.r, cSh.g, cSh.b);
      pos.push(p.x, p.y, z); nor.push(0, 0, nz); col.push(cSh.r, cSh.g, cSh.b);
      pos.push(p.x, floor, z); nor.push(0, 0, nz); col.push(cSh.r, cSh.g, cSh.b);
    }
  }
  // A little per-vertex jitter so the silhouette isn't machine-perfect.
  for (let i = 1; i < pos.length; i += 3) pos[i] += (rnd() - 0.5) * 0.012;

  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new Float32BufferAttribute(col, 3));
  return geo;
}
