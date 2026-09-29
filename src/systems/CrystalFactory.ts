// Week 2 Day 1 — Sunrise crystal system (docs/ART concept + palette).
//
// KEY DESIGN (fixed after the first pass missed the concept):
//   1. Crystals are FORMATIONS — tight clusters of 4-7 related crystals with
//      one dominant spire, not lone solo shards.
//   2. Every crystal is MULTI-TONAL — each facet gets its own tone from a
//      3-4 color related set (cream / light / base / shade), assigned by
//      facet normal vs the key light. This is the concept's signature look.
//   3. Outlines are a FIXED WORLD THICKNESS (normal expansion), not a
//      relative scale — otherwise a 5-unit spire gets a 20cm border.
//   4. Everything merges into ONE vertex-colored geometry per segment
//      (+1 hull) = 2 draw calls for the whole crystal field, so density is
//      free (the concept is dense).
import { BufferGeometry, Color, Float32BufferAttribute } from 'three';

/** Fixed outline thickness in world units (concept: thin but always visible). */
export const EDGE_THICKNESS = 0.1;

/** Key light (upper-left) used for facet tone assignment. */
const KEY = { x: -0.42, y: 0.82, z: 0.39 };

/** Deterministic RNG so a segment rebuild is reproducible per seed. */
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
  /** Base tone; the other three derive from it unless overridden. */
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
  pos: number[];
  nor: number[];
  col: number[];
  hPos: number[];
  hNor: number[];
}

export function emptyAcc(): SegAcc {
  return { pos: [], nor: [], col: [], hPos: [], hNor: [] };
}

function cross(
  a: number[], b: number[], c: number[]
): [number, number, number] {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  let nx = uy * vz - uz * vy;
  let ny = uz * vx - ux * vz;
  let nz = ux * vy - uy * vx;
  const l = Math.hypot(nx, ny, nz) || 1;
  return [nx / l, ny / l, nz / l];
}

/** Append one flat-shaded triangle to both the face and hull buffers. */
function pushTri(
  acc: SegAcc,
  a: number[], b: number[], c: number[],
  color: number,
  thickness: number
): void {
  const [nx, ny, nz] = cross(a, b, c);
  const r = ((color >> 16) & 255) / 255;
  const g = ((color >> 8) & 255) / 255;
  const bl = (color & 255) / 255;
  for (const p of [a, b, c]) {
    acc.pos.push(p[0], p[1], p[2]);
    acc.nor.push(nx, ny, nz);
    acc.col.push(r, g, bl);
    acc.hPos.push(p[0] + nx * thickness, p[1] + ny * thickness, p[2] + nz * thickness);
    acc.hNor.push(nx, ny, nz);
  }
}

/** Tone for a facet: key-facing → cream/light, away → shade, else base. */
function facetTone(
  n: [number, number, number],
  t: CrystalTones,
  jitter: number
): number {
  const d = n[0] * KEY.x + n[1] * KEY.y + n[2] * KEY.z + jitter * 0.12;
  if (d > 0.55) return t.cream;
  if (d > 0.15) return t.light;
  if (d < -0.25) return t.shade;
  return t.base;
}

interface Ring { x: number; z: number; y: number }

/**
 * One radial jitter factor per angular index, SHARED by every ring of a
 * crystal. Re-rolling it per ring let adjacent rings disagree, which twists
 * individual quads inside-out — those faces get backface-culled and the
 * crystal renders as its bare dark hull.
 */
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
  spin: number;
  leanX: number;
  leanZ: number;
  scale: number;
  pos: [number, number, number];
  tones: CrystalTones;
  jitter: number;
}

/** Emit one crystal's triangles into acc (transformed into segment space). */
export function emitCrystal(
  acc: SegAcc, o: CrystalOpts,
  rnd: () => number, thickness: number
): void {
  const s = o.scale;
  const cs = Math.cos(o.spin), sn = Math.sin(o.spin);
  // A shear stronger than the base radius folds the prism inside out, which
  // inverts the winding — the faces get backface-culled and the crystal
  // renders as its bare dark hull. Clamp lean to stay well inside the radius.
  const leanMax = (0.55 * o.baseR) / Math.max(0.001, o.height);
  const leanX = Math.max(-leanMax, Math.min(leanMax, o.leanX));
  const leanZ = Math.max(-leanMax, Math.min(leanMax, o.leanZ));
  // Lean shears x/z proportional to height — the base stays anchored.
  const place = (p: Ring): number[] => {
    const t = p.y / o.height;
    const lx = p.x + leanZ * o.height * t;
    const lz = p.z + leanX * o.height * t;
    const x = (lx * s) * cs - (lz * s) * sn;
    const z = (lx * s) * sn + (lz * s) * cs;
    return [x + o.pos[0], p.y * s + o.pos[1], z + o.pos[2]];
  };
  const r0 = hexRing(o.baseR, 0, 0, o.sides, ringJitter(o.sides, 0.16, rnd));
  const r1 = hexRing(o.baseR * 1.04, o.height * 0.5, 0.14, o.sides, ringJitter(o.sides, 0.16, rnd));
  const r2 = hexRing(o.baseR * o.taper, o.height * 0.78, 0.28, o.sides, ringJitter(o.sides, 0.2, rnd));
  const apex: Ring = { x: 0, y: o.height, z: 0 };
  const base: Ring = { x: 0, y: 0, z: 0 };
  const P = (p: Ring) => place(p);

  const add = (A: Ring, B: Ring, C: Ring) => {
    const pa = P(A), pb = P(B), pc = P(C);
    pushTri(acc, pa, pb, pc, facetTone(cross(pa, pb, pc), o.tones, rnd() * 2 - 1), thickness);
  };
  // Wall quad: A,B = lower ring, C = above B, D = above A (outward winding).
  const quad = (A: Ring, B: Ring, C: Ring, D: Ring) => { add(A, C, B); add(A, D, C); };

  for (let i = 0; i < o.sides; i++) {
    const j = (i + 1) % o.sides;
    quad(r0[i], r0[j], r1[j], r1[i]);
    quad(r1[i], r1[j], r2[j], r2[i]);
    add(r2[i], apex, r2[j]);   // tip fan
    add(base, r0[i], r0[j]);   // base cap faces down
  }
}

export interface FormationSpec {
  x: number;
  z: number;
  /** 0..1 — 0 small shards, 1 a dominant spire cluster. */
  weight: number;
  family: CrystalFamily;
  accent: CrystalFamily | null;
  count: number;
}

/**
 * One formation: a dominant spire plus satellites fanning outward from a
 * shared buried base (concept: clusters, not lone shards).
 */
export function emitFormation(
  acc: SegAcc, spec: FormationSpec,
  rnd: () => number, thickness: number
): void {
  // Tall prisms: the concept's clusters dominate the frame, rising out of the
  // cloud sea. Our camera looks down ~37°, so ground-level objects sit high in
  // frame — height is what makes them read as flanking scenery.
  const spireH = 3.0 + spec.weight * 4.0;
  emitCrystal(acc, {
    // Chunky prisms (~2.6:1 height:width), not blades — the concept's
    // formations are blocky and read as mass, not spikes.
    baseR: 0.8 + spec.weight * 0.55,
    height: spireH,
    taper: 0.42 + rnd() * 0.18,
    sides: 6,
    spin: rnd() * Math.PI,
    leanX: (rnd() - 0.5) * 0.1,
    leanZ: (rnd() - 0.5) * 0.1,
    scale: 0.8 + spec.weight * 0.35,
    pos: [spec.x, -0.4 - rnd() * 0.8, spec.z],
    tones: crystalTones(spec.family),
    jitter: 0
  }, rnd, thickness);

  for (let i = 1; i < spec.count; i++) {
    const ang = (i / spec.count) * Math.PI * 2 + rnd() * 0.6;
    // Tight cluster radius — keeps the formation a clump, not a spread field.
    const rad = (0.4 + rnd() * 0.6) * (0.5 + spec.weight * 0.8);
    const fam = spec.accent && rnd() < 0.22 ? spec.accent : spec.family;
    emitCrystal(acc, {
      baseR: 0.45 + rnd() * 0.4,
      height: spireH * (0.42 + rnd() * 0.5),
      taper: 0.4 + rnd() * 0.25,
      sides: 5 + (i % 2),
      spin: rnd() * Math.PI,
      leanX: Math.cos(ang) * (0.16 + rnd() * 0.18),
      leanZ: Math.sin(ang) * (0.16 + rnd() * 0.18),
      scale: 0.75 + rnd() * 0.4,
      pos: [
        spec.x + Math.cos(ang) * rad,
        -0.4 - rnd() * 0.6,
        spec.z + Math.sin(ang) * rad * 0.7
      ],
      tones: crystalTones(fam),
      jitter: rnd() * 2 - 1
    }, rnd, thickness);
  }
}

/** Bake the accumulators into geometry (flat normals, vertex colors). */
export function bakeSegment(acc: SegAcc): { face: BufferGeometry; hull: BufferGeometry } {
  const face = new BufferGeometry();
  face.setAttribute('position', new Float32BufferAttribute(acc.pos, 3));
  face.setAttribute('normal', new Float32BufferAttribute(acc.nor, 3));
  face.setAttribute('color', new Float32BufferAttribute(acc.col, 3));
  const hull = new BufferGeometry();
  hull.setAttribute('position', new Float32BufferAttribute(acc.hPos, 3));
  hull.setAttribute('normal', new Float32BufferAttribute(acc.hNor, 3));
  return { face, hull };
}
