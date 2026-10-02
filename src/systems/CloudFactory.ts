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

interface Dome { x: number; z: number; r: number; a: number }

/**
 * Billow centres on a jittered grid, indexed so the whole set is EXACTLY
 * periodic over `period`. Cell `k` always resolves to the same dome, so
 * segment k's far edge and segment k+1's near edge carry the same billows and
 * the two decks meet without a seam.
 */
function makeDomes(seed: number, spread: number, period: number, cell: number): Dome[] {
  const rnd = makeRng(seed);
  const perZ = Math.max(1, Math.round(period / cell));
  const domes: Dome[] = [];
  for (let j = 0; j < perZ; j++) {
    for (let x = -spread - cell; x < spread + cell; x += cell) {
      domes.push({
        x: x + (rnd() - 0.5) * cell * 0.9,
        z: j * (period / perZ) + (rnd() - 0.5) * cell * 0.9,
        r: cell * (0.75 + rnd() * 0.75),
        a: 0.55 + rnd() * 0.8
      });
    }
  }
  return domes;
}

/**
 * Roll the field up from billow domes plus a long swell.
 *
 * Every term is a sum of sin/cos with a z-frequency that is an exact multiple
 * of 2*PI / `period`, so the surface is EXACTLY periodic in z. Adjacent
 * segments therefore meet on a shared edge with identical heights and no
 * wall — the stair-stepped rectangles down the middle of the old deck came
 * from the per-segment end caps not lining up.
 */
function seaHeight(x: number, z: number, domes: Dome[], period: number, seed: number): number {
  const w = (2 * Math.PI) / period;
  const swell = Math.sin(x * 0.11 + w * 1 * z) * 0.4;
  const rollA = Math.sin(x * 0.06 + w * 3 * z + seed) * 0.5;
  const rollB = Math.sin(x * 0.15 - w * 7 * z + seed * 1.7) * 0.23;
  // Max of the gaussian billows → merged, rounded cloud tops. The z distance
  // is wrapped into one period so a dome sitting near z=0 also shapes the far
  // edge at z=period — without this the two edges disagree and the segments
  // no longer meet.
  let billow = 0;
  for (const d of domes) {
    const dx = (x - d.x) / d.r;
    let dz = z - d.z;
    dz -= period * Math.round(dz / period);
    const dzr = dz / d.r;
    const q = dx * dx + dzr * dzr;
    if (q > 1) continue;
    const h = d.a * (1 - q * q); // smooth, flat-ish top, feathered skirt
    if (h > billow) billow = h;
  }
  return swell + rollA + rollB + billow;
}

/**
 * The deck's surface height at an arbitrary world (x, z).
 *
 * The crystal field needs this for two reasons:
 *   1. To seat each formation on the cloud it actually stands over — the tops
 *      are uneven, so one fixed base height buries formations on the crests and
 *      floats them over the troughs.
 *   2. To clear the OCCLUDING crests in front of a formation, not just its own
 *      surface. Seen from the gameplay camera, a formation standing in a trough
 *      is hidden by the crest between it and the camera even when its own base
 *      is correct — that is the "still submerged" case.
 *
 * Shares `heightAt`'s maths, so the returned height always matches the mesh.
 */
export function cloudHeightAt(o: CloudSeaOpts, x: number, z: number): number {
  return heightAt(o, x, z, domesFor(o));
}

function domesFor(o: CloudSeaOpts): Dome[] {
  return makeDomes(o.seed * 11 + 3, o.spread, o.length, o.cell ?? 5);
}

/** The rolling surface height, shared by the mesh builder and the sampler. */
function heightAt(o: CloudSeaOpts, x: number, z: number, domes: Dome[]): number {
  const roll = seaHeight(x, z, domes, o.length, o.seed) * o.depth;
  const lim = o.depth * 1.3;
  const relief = lim * Math.tanh(roll / lim);
  const edge = Math.abs(x) / o.spread;
  return o.top + relief * (1 + edge * 1.15);
}

/**
 * Highest cloud surface anywhere between the camera and `z` at lateral `x`.
 *
 * This is what a formation has to clear to actually be visible, rather than the
 * height directly beneath it.
 */
export function cloudHeightAlongSight(
  o: CloudSeaOpts,
  x: number,
  z: number,
  fromZ = 0,
  samples = 10
): number {
  const domes = domesFor(o);
  let max = -Infinity;
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const h = heightAt(o, x, fromZ + (z - fromZ) * t, domes);
    if (h > max) max = h;
  }
  return max;
}

export function buildCloudSea(o: CloudSeaOpts): BufferGeometry {
  // The deck tiles over `length`, so that is its period.
  const domes = makeDomes(o.seed * 11 + 3, o.spread, o.length, o.cell ?? 5);

  const cBase = new Color(o.palette.base);
  const cHi = new Color(o.palette.highlight);
  const cSh = new Color(o.palette.shadow);
  const tmp = new Color();

  const pos: number[] = [];
  const nor: number[] = [];
  const col: number[] = [];

  // --- 1. the solid field -------------------------------------------------
  // Height = rolling swell + the tallest overlapping dome. `top` is the DECK
  // datum (the level the tiles float just above); everything else is relief.
  const hAt = (ix: number, iz: number): { x: number; y: number; z: number; h: number } => {
    const x = (ix / o.cols - 0.5) * 2 * o.spread;
    const z = (iz / o.rows) * o.length;
    // seaHeight already folds in the billow term, and it is exactly periodic
    // in z. An earlier copy of the dome loop lived here too — unwrapped, and
    // double-counting the billows — which is what stopped the deck from tiling.
    const roll = seaHeight(x, z, domes, o.length, o.seed) * o.depth;
    // Soft-clip the relief so the tallest billow saturates just under the tile
    // plane. A hard clamp would leave flat plateaus on the biggest puffs;
    // tanh rolls them off smoothly instead, and guarantees a puff can never
    // spike up through the path and hide it.
    const lim = o.depth * 1.3;
    const relief = lim * Math.tanh(roll / lim);
    // The concept has the cloud deck form a BOWL: it dips toward the path and
    // RISES at the flanks, so the crystals stand out of the high sides with
    // open sky in the middle. This used to do the opposite (clouds highest in
    // the middle), which walled the corridor in and hid the sky entirely.
    const edge = Math.abs(x) / o.spread;
    const h = o.top + relief * (1 + edge * 1.15);
    return { x, y: h, z, h };
  };

  // Key for the billow shading. Combined with the height tint below.
  const LAMP = { x: -0.5, y: 0.78, z: 0.38 };

  const put = (p: { x: number; y: number; z: number; h: number }, nx: number, nz: number, ny = 1): void => {
    pos.push(p.x, p.y, p.z);
    const len = Math.hypot(nx, ny, nz) || 1;
    const ux = nx / len, uy = ny / len, uz = nz / len;
    nor.push(ux, uy, uz);
    // --- 3. two-part shading, because height tint alone is not enough.
    // The deck is seen almost edge-on from the game camera, so a pure
    // height tint compresses to a flat wash. A lambert term on the real
    // surface normal gives every billow a lit face and a shaded face from ANY
    // angle, which is what makes the deck read as volume rather than ground.
    const lam = Math.max(0, (ux * LAMP.x + uy * LAMP.y + uz * LAMP.z));
    const t = Math.max(0, Math.min(1, (p.h - o.top) / Math.max(0.001, o.depth * 2)));
    tmp.copy(cSh).lerp(cBase, Math.min(1, t * 1.7));
    // Slopes facing away from the key sink toward the shadow tone. Kept strong:
    // this term is what gives each billow a readable lit and shaded face, and
    // at 1.0 it flattened out into a featureless wash.
    tmp.lerp(cSh, (1 - lam) * 0.62);
    // Crests turn into the key catch the light.
    if (t > 0.45) tmp.lerp(cHi, ((t - 0.45) / 0.55) * lam * 0.95);
    col.push(tmp.r, tmp.g, tmp.b);
  };

  // Normal at a grid node, from central differences over the NEIGHBOURING
  // heights. Computing it per-quad instead gives each of the quad's two
  // triangles a slightly different normal, and the result is a visible
  // triangular mesh pattern across the whole cloud sea — the faint white
  // "wind lines" over the clouds. Sampling at the shared node makes the
  // shading continuous across every quad boundary.
  const nodeNormal = (ix: number, iz: number): [number, number, number] => {
    const x0 = ((ix - 1) / o.cols - 0.5) * 2 * o.spread;
    const x1 = ((ix + 1) / o.cols - 0.5) * 2 * o.spread;
    const z0 = ((iz - 1) / o.rows) * o.length;
    const z1 = ((iz + 1) / o.rows) * o.length;
    const dx = heightAt(o, x1, z0, domes) - heightAt(o, x0, z0, domes);
    const dz = heightAt(o, x0, z1, domes) - heightAt(o, x0, z0, domes);
    const cellZ = o.length / o.rows;
    const len = Math.hypot(-dx, cellZ * 2, -dz) || 1;
    return [-dx / len, (cellZ * 2) / len, -dz / len];
  };

  // Quads across the field. Vertex colours and normals are sampled at the node
  // and shared by every triangle that touches it, so the surface is smooth.
  for (let iz = 0; iz < o.rows; iz++) {
    for (let ix = 0; ix < o.cols; ix++) {
      const a = hAt(ix, iz);
      const b = hAt(ix + 1, iz);
      const c = hAt(ix + 1, iz + 1);
      const d = hAt(ix, iz + 1);
      const dx = b.y - a.y;
      const dz = d.y - a.y;
      void dx; void dz;
      // Each node's own normal, shared by both triangles of the quad.
      const na = nodeNormal(ix, iz);
      const nb = nodeNormal(ix + 1, iz);
      const nc = nodeNormal(ix + 1, iz + 1);
      const nd = nodeNormal(ix, iz + 1);
      put(a, na[0], na[2], na[1]); put(c, nc[0], nc[2], nc[1]); put(b, nb[0], nb[2], nb[1]);
      put(a, na[0], na[2], na[1]); put(d, nd[0], nd[2], nd[1]); put(c, nc[0], nc[2], nc[1]);
    }
  }

  // --- 4. skirt: only on the LEFT/RIGHT edges ----------------------------
  // The near and far (z) ends deliberately get NO cap. The field is exactly
  // periodic in z, so segment k's last row and segment k+1's first row are the
  // same points at the same heights: the decks meet flush. The old end caps
  // were what produced the stair-stepped rectangles marching down the view.
  const floor = o.top - o.depth * 2.4;
  for (let iz = 0; iz <= o.rows; iz++) {
    for (const side of [0, o.cols]) {
      const p = hAt(side, iz);
      const x = side === 0 ? -o.spread * 1.06 : o.spread * 1.06;
      const nx = side === 0 ? -1 : 1;
      pos.push(p.x, p.y, p.z); nor.push(nx, 0, 0); col.push(cSh.r, cSh.g, cSh.b);
      pos.push(x, p.y, p.z); nor.push(nx, 0, 0); col.push(cSh.r, cSh.g, cSh.b);
      pos.push(x, floor, p.z); nor.push(nx, 0, 0); col.push(cSh.r, cSh.g, cSh.b);
      pos.push(p.x, p.y, p.z); nor.push(nx, 0, 0); col.push(cSh.r, cSh.g, cSh.b);
      pos.push(x, floor, p.z); nor.push(nx, 0, 0); col.push(cSh.r, cSh.g, cSh.b);
      pos.push(x, p.y, p.z); nor.push(nx, 0, 0); col.push(cSh.r, cSh.g, cSh.b);
    }
  }
  // No per-vertex jitter here: it was ±0.006 units (invisible) and it broke
  // the exact tiling, since the two vertices sharing a segment seam would each
  // get a different nudge. The field already varies along x and over its 23
  // billow rows, so it does not read as mechanical.

  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new Float32BufferAttribute(col, 3));
  return geo;
}


