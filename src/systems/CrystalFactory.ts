// Week 2 Day 1 — Sunrise crystal system (docs/ART concept + palette).
//
// REBUILT after the first pass read as "stuffing": a cluster is now a real 3D
// CLUMP — every crystal gets its own x/y/z offset inside a volume, its own
// lean, spin and size. Previously they were packed on one flat ring, which
// looked like a pile of spikes in a single spot.
//
// Cluster VARIANTS (each a named shape, chosen at random per formation):
//   trio    — 3 shards, small and tight
//   fan     — 5 shards splaying outward from one base
//   spire   — 1 dominant needle with 2 small companions
//   ridge   — 4-5 shards in a diagonal row (depth variation)
//   cluster — 7-9 dense clump (the signature shape from the concept)
//
// OUTLINE: a fixed width baked into the geometry, drawn as a shell that
// writes NO depth and is drawn BEFORE the faces. The faces then always paint
// over it, so a crystal can never turn into a black silhouette at range —
// the exact failure the depth-buffered inverted hull kept producing.
import { BufferGeometry, Color, Float32BufferAttribute } from 'three';
import { DoubleSide } from 'three';
import type { CrystalStructure } from '../config/CrystalStructures';

export type { CrystalStructure, CrystalNode } from '../config/CrystalStructures';

/** Outline width as a fraction of the crystal's own size. */
export const OUTLINE_FACTOR = 0.05;

/**
 * Key direction for baking facet tones. Kept LOW and to the side, matching the
 * concept's raking light. A key pointing mostly UP puts every top facet — the
 * ones the camera actually sees — in the cream band, and the whole cluster
 * washes out to pale. Raking it sideways keeps the saturated body colour
 * dominant and leaves cream for one or two narrow highlights.
 */
const KEY = { x: -0.78, y: 0.45, z: 0.44 };

export function makeRng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

export interface CrystalFamily {
  base: number;
  light?: number;
  shade?: number;
  cream?: number;
}

export interface CrystalTones {
  light: number;
  base: number;
  shade: number;
  cream: number;
}

export function crystalTones(f: CrystalFamily): CrystalTones {
  const b = new Color(f.base);
  return {
    light: f.light ?? b.clone().offsetHSL(0, -0.04, 0.13).getHex(),
    base: f.base,
    shade: f.shade ?? b.clone().offsetHSL(0, 0.05, -0.11).getHex(),
    cream: f.cream ?? b.clone().offsetHSL(0, -0.22, 0.3).getHex()
  };
}

export interface SegAcc {
  /** [x,y,z, r,g,b] per vertex, interleaved — one buffer for the faces. */
  pos: number[];
  nor: number[];
  col: number[];
  /** Shell vertices, same order. */
  hPos: number[];
  hNor: number[];
}

export function emptyAcc(): SegAcc {
  return { pos: [], nor: [], col: [], hPos: [], hNor: [] };
}

function cross(a: number[], b: number[], c: number[]): [number, number, number] {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  let nx = uy * vz - uz * vy;
  let ny = uz * vx - ux * vz;
  let nz = ux * vy - uy * vx;
  const l = Math.hypot(nx, ny, nz) || 1;
  return [nx / l, ny / l, nz / l];
}

function pushTri(acc: SegAcc, a: number[], b: number[], c: number[], color: number, rim: number): void {
  const [nx, ny, nz] = cross(a, b, c);
  const r = ((color >> 16) & 255) / 255;
  const g = ((color >> 8) & 255) / 255;
  const bl = (color & 255) / 255;
  for (const p of [a, b, c]) {
    acc.pos.push(p[0], p[1], p[2]);
    acc.nor.push(nx, ny, nz);
    acc.col.push(r, g, bl);
    acc.hPos.push(p[0] + nx * rim, p[1] + ny * rim, p[2] + nz * rim);
    acc.hNor.push(nx, ny, nz);
  }
}

function facetTone(n: [number, number, number], t: CrystalTones, jitter: number): number {
  const d = n[0] * KEY.x + n[1] * KEY.y + n[2] * KEY.z + jitter * 0.1;
  // The family's BODY colour owns the widest band on purpose. Widen it and the
  // coral/mint/cyan actually read; narrow it and every crystal washes out to
  // pale cream, which is what the concept never does.
  if (d > 0.82) return t.cream;
  if (d > 0.46) return t.light;
  if (d < -0.52) return t.shade;
  return t.base;
}

interface Ring { x: number; z: number; y: number }

/** One radial jitter per angular index, shared by all rings (no twisted quads). */
function ringJitter(sides: number, wob: number, rnd: () => number): number[] {
  const out: number[] = [];
  for (let i = 0; i < sides; i++) out.push(1 + (rnd() - 0.5) * wob);
  return out;
}

function hexRing(radius: number, y: number, phase: number, sides: number, jit: number[]): Ring[] {
  const out: Ring[] = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2 + phase;
    const rr = radius * jit[i];
    out.push({ x: Math.cos(a) * rr, y, z: Math.sin(a) * rr });
  }
  return out;
}

export interface CrystalOpts {
  baseR: number;
  height: number;
  taper: number;
  sides: number;
  /** Yaw. */
  spin: number;
  /** Shear (top displaced relative to base). */
  leanX: number;
  leanZ: number;
  scale: number;
  /** World position of the base. */
  pos: [number, number, number];
  tones: CrystalTones;
  /**
   * Authored rotation (radians, XYZ euler). When present the prism is built in
   * local space and rotated rigidly — this is the path the structure editor
   * exports, and it is exact: the same numbers always produce the same crystal.
   * When absent the procedural `spin` + shear path is used instead.
   */
  rot?: [number, number, number];
}

export function emitCrystal(acc: SegAcc, o: CrystalOpts, rnd: () => number): void {
  // Rim scales WITH the crystal: a far, small crystal keeps a small rim. A
  // fixed world-unit rim is what made distant formations swallow themselves.
  const rim = OUTLINE_FACTOR * o.scale;
  const s = o.scale;

  if (o.rot) {
    // --- authored path: build along +Y, then rotate and place rigidly
    const [rx, ry, rz] = o.rot;
    const cx = Math.cos(rx), sx = Math.sin(rx);
    const cy = Math.cos(ry), sy = Math.sin(ry);
    const cz = Math.cos(rz), sz = Math.sin(rz);
    const place = (p: Ring): number[] => {
      // scale
      let vx = p.x * s, vy = p.y * s, vz = p.z * s;
      // Rz, then Rx, then Ry
      let t1x = vx * cz - vy * sz, t1y = vx * sz + vy * cz, t1z = vz;
      let t2x = t1x, t2y = t1y * cx - t1z * sx, t2z = t1y * sx + t1z * cx;
      const t3x = t2x * cy + t2z * sy, t3y = t2y, t3z = -t2x * sy + t2z * cy;
      return [t3x + o.pos[0], t3y + o.pos[1], t3z + o.pos[2]];
    };
    buildPrism(acc, o, rnd, place, rim);
    return;
  }

  const cs = Math.cos(o.spin), sn = Math.sin(o.spin);
  // Clamp lean inside the base radius: a stronger shear folds the prism and
  // inverts the winding.
  const leanMax = (0.5 * o.baseR) / Math.max(0.001, o.height);
  const leanX = Math.max(-leanMax, Math.min(leanMax, o.leanX));
  const leanZ = Math.max(-leanMax, Math.min(leanMax, o.leanZ));
  const place = (p: Ring): number[] => {
    const t = p.y / o.height;
    const lx = p.x + leanZ * o.height * t;
    const lz = p.z + leanX * o.height * t;
    const x = (lx * s) * cs - (lz * s) * sn;
    const z = (lx * s) * sn + (lz * s) * cs;
    return [x + o.pos[0], p.y * s + o.pos[1], z + o.pos[2]];
  };
  buildPrism(acc, o, rnd, place, rim);
}

/** Shared prism tessellation, given a local→world placement function. */
function buildPrism(
  acc: SegAcc,
  o: CrystalOpts,
  rnd: () => number,
  place: (p: Ring) => number[],
  rim: number
): void {
  const o2 = { ...o, baseR: o.baseR };
  const r0 = hexRing(o2.baseR, 0, 0, o.sides, ringJitter(o.sides, 0.12, rnd));
  const r1 = hexRing(o2.baseR * 1.06, o2.height * 0.55, 0.1, o.sides, ringJitter(o.sides, 0.12, rnd));
  const r2 = hexRing(o2.baseR * o2.taper, o2.height * 0.82, 0.2, o.sides, ringJitter(o.sides, 0.16, rnd));
  const apex: Ring = { x: 0, y: o2.height, z: 0 };
  const base: Ring = { x: 0, y: 0, z: 0 };
  const P = (p: Ring) => place(p);

  const add = (A: Ring, B: Ring, C: Ring) => {
    const pa = P(A), pb = P(B), pc = P(C);
    pushTri(acc, pa, pb, pc, facetTone(cross(pa, pb, pc), o2.tones, rnd() * 2 - 1), rim);
  };
  const quad = (A: Ring, B: Ring, C: Ring, D: Ring) => { add(A, C, B); add(A, D, C); };

  for (let i = 0; i < o.sides; i++) {
    const j = (i + 1) % o.sides;
    quad(r0[i], r0[j], r1[j], r1[i]);
    quad(r1[i], r1[j], r2[j], r2[i]);
    add(r2[i], apex, r2[j]);
    add(base, r0[i], r0[j]);
  }
}

export type ClusterShape = 'trio' | 'fan' | 'spire' | 'ridge' | 'cluster';

export const CLUSTER_SHAPES: ClusterShape[] = ['trio', 'fan', 'spire', 'ridge', 'cluster'];

/** Per-shape recipes: how many crystals and how they're spread. */
const SHAPES: Record<ClusterShape, { n: number; radius: number; height: [number, number]; size: [number, number]; lean: number; row: boolean }> = {
  trio:    { n: 3, radius: 2.0, height: [0.62, 0.84], size: [0.85, 1.0], lean: 0.5,  row: false },
  fan:     { n: 5, radius: 4.0, height: [0.6, 0.88],  size: [0.8, 1.05], lean: 1.1,  row: false },
  spire:   { n: 3, radius: 2.2, height: [0.55, 0.8],  size: [0.8, 0.95], lean: 0.7,  row: false },
  ridge:   { n: 5, radius: 3.2, height: [0.62, 0.86], size: [0.8, 1.0],  lean: 0.6,  row: true },
  cluster: { n: 8, radius: 4.2, height: [0.6, 0.92],  size: [0.78, 1.05], lean: 0.9, row: false }
};

/**
 * Width-to-height ratio. The concept's crystals are chunky prisms at roughly
 * 1:1.7 with a tapered point — not needles, not boulders. Deriving the radius
 * from each crystal's own height is what guarantees that: a 12-unit spire gets
 * a 3.6-unit base, so every crystal stays chunky as the cluster scales.
 */
const CHUNK = 0.3;

export interface ClusterSpec {
  x: number;
  z: number;
  /** 0..1 overall size of the cluster. */
  weight: number;
  shape: ClusterShape;
  families: CrystalFamily[];
  /** Base height (the cloud top the cluster grows out of). */
  baseY: number;
}

/**
 * Build one cluster. Crystals are placed inside an ellipsoidal VOLUME — x, y
 * AND z all vary — so a cluster reads as a 3D clump from every camera angle,
 * not a flat row. The tallest crystal is placed last and central, so the
 * silhouette has a clear dominant spire.
 */
export function emitCluster(acc: SegAcc, spec: ClusterSpec, rnd: () => number): void {
  const fam = spec.families;
  if (fam.length === 0) return;
  const rec = SHAPES[spec.shape];
  // HERO scale: the crystals are the subject of the frame, not scenery props.
  // A near cluster tops out around 12 units above its base.
  const spireH = 5.5 + spec.weight * 7.5;
  const phase = Math.floor(rnd() * fam.length);
  // Per-cluster primary/secondary axis so repeated clusters don't all face
  // the same way.
  const axisRot = rnd() * Math.PI;

  for (let i = 0; i < rec.n; i++) {
    // Spread in a volume: random in x/z (elliptical), small in y so the
    // bases stay buried together.
    const ang = (i / rec.n) * Math.PI * 2 + rnd() * 0.9;
    const rad = (0.25 + rnd() * 0.75) * rec.radius * (0.6 + spec.weight * 0.8);
    let ox: number;
    let oz: number;
    if (rec.row) {
      // Diagonal row: strong x, gentle z — reads as a ridge in depth.
      const t = i / Math.max(1, rec.n - 1) - 0.5;
      ox = t * rec.radius * 2.2;
      oz = t * rec.radius * 0.7 + (rnd() - 0.5) * 0.2;
    } else {
      const ca = Math.cos(axisRot), sa = Math.sin(axisRot);
      const lx = Math.cos(ang) * rad;
      const lz = Math.sin(ang) * rad * 0.75;
      ox = lx * ca - lz * sa;
      oz = lx * sa + lz * ca;
    }
    const oy = (rnd() - 0.5) * 0.5 * spec.weight;

    // The spire leads but does not tower: if it dominates, the cluster reads as
    // one lone crystal with specks beside it instead of a clump.
    const isSpire = i === rec.n - 1;
    const hFrac = isSpire
      ? 0.82 + spec.weight * 0.18
      : rec.height[0] + rnd() * (rec.height[1] - rec.height[0]);
    const sFrac = isSpire
      ? 0.8 + spec.weight * 0.18
      : rec.size[0] + rnd() * (rec.size[1] - rec.size[0]);

    // Size this crystal FIRST, then derive its width from its own height —
    // that is what keeps every crystal chunky instead of needle-thin.
    const h = spireH * hFrac;
    const scale = sFrac;
    emitCrystal(acc, {
      baseR: h * CHUNK * (0.82 + rnd() * 0.3),
      height: h,
      taper: 0.5 + rnd() * 0.22,
      sides: 5 + (i % 2),
      spin: rnd() * Math.PI,
      leanX: (rnd() - 0.5) * rec.lean,
      leanZ: (rnd() - 0.5) * rec.lean,
      scale,
      pos: [spec.x + ox, spec.baseY + oy, spec.z + oz],
      // Colours cycle through the palette so one cluster is multi-coloured.
      tones: crystalTones(fam[(phase + i) % fam.length])
    }, rnd);
  }
}

export function bakeCluster(acc: SegAcc): { face: BufferGeometry; shell: BufferGeometry } {  const face = new BufferGeometry();
  face.setAttribute('position', new Float32BufferAttribute(acc.pos, 3));
  face.setAttribute('normal', new Float32BufferAttribute(acc.nor, 3));
  face.setAttribute('color', new Float32BufferAttribute(acc.col, 3));
  const shell = new BufferGeometry();
  shell.setAttribute('position', new Float32BufferAttribute(acc.hPos, 3));
  shell.setAttribute('normal', new Float32BufferAttribute(acc.hNor, 3));
  return { face, shell };
}

export { DoubleSide };

/**
 * Emit an authored structure at a world position.
 *
 * The structure's numbers are used verbatim � the only thing applied on top is
 * `scale` (atmospheric depth) and `baseY` (where the cloud deck's surface is),
 * so what the editor shows is what the game renders.
 */
export function emitStructure(
  acc: SegAcc,
  structure: CrystalStructure,
  opts: { x: number; z: number; baseY: number; scale: number; families: CrystalFamily[] }
): void {
  const fam = opts.families;
  if (fam.length === 0) return;
  // Deterministic per structure: the same formation always facets the same
  // way, so a reload does not reshuffle the look of an authored piece.
  const rnd = makeRng(structure.id.split('').reduce((a, c) => a + c.charCodeAt(0), 7));
  for (const node of structure.crystals) {
    const tone = crystalTones(fam[node.color % fam.length]);
    emitCrystal(acc, {
      baseR: node.width,
      height: node.height,
      taper: node.taper,
      sides: node.sides,
      spin: 0,
      leanX: 0,
      leanZ: 0,
      scale: opts.scale,
      pos: [opts.x + node.x * opts.scale, opts.baseY + node.y * opts.scale, opts.z + node.z * opts.scale],
      tones: tone,
      rot: [node.rx, node.ry, node.rz]
    }, rnd);
  }
}

