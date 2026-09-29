// Week 2 Day 1 — Sunrise crystal system (docs/ART concept + palette).
//
// OWNER CORRECTIONS applied here (2026-09-02):
//   1. OUTLINE IS RELATIVE, NOT FIXED. A fixed 0.1-world-unit rim looks fine
//      up close and swallows a distant crystal whole — far formations went
//      solid black. The rim now scales with the crystal (same language the
//      tiles/ball already use), so a small far crystal keeps a small rim.
//   2. A CLUSTER IS MIXED COLOUR. The concept's formations contain coral AND
//      peach AND mint AND gold side by side. Each crystal now takes the next
//      family in the look, so one cluster shows the whole palette.
//   3. NO HALFTONE DOTS on crystals (MaterialFactory.createFlatMaterial).
//   4. Crystals are ROOTED BELOW TILE LEVEL so they emerge from the cloud sea
//      instead of floating in the sky.
import { BufferGeometry, Color, Float32BufferAttribute } from 'three';

/** Rim width as a fraction of crystal size (thin — the concept is 1-2px). */
export const OUTLINE_FACTOR = 0.035;

const KEY = { x: -0.42, y: 0.82, z: 0.39 };

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
  pos: number[];
  nor: number[];
  col: number[];
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

function facetTone(n: [number, number, number], t: CrystalTones, jitter: number): number {
  const d = n[0] * KEY.x + n[1] * KEY.y + n[2] * KEY.z + jitter * 0.1;
  if (d > 0.5) return t.cream;
  if (d > 0.12) return t.light;
  if (d < -0.2) return t.shade;
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
  spin: number;
  leanX: number;
  leanZ: number;
  scale: number;
  pos: [number, number, number];
  tones: CrystalTones;
}

export function emitCrystal(acc: SegAcc, o: CrystalOpts, rnd: () => number): void {
  // Rim scales WITH the crystal: a far, small crystal keeps a small rim instead
  // of being swallowed by a fixed-width one.
  const thickness = OUTLINE_FACTOR * o.scale;
  const s = o.scale;
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
  const r0 = hexRing(o.baseR, 0, 0, o.sides, ringJitter(o.sides, 0.12, rnd));
  const r1 = hexRing(o.baseR * 1.06, o.height * 0.55, 0.1, o.sides, ringJitter(o.sides, 0.12, rnd));
  const r2 = hexRing(o.baseR * o.taper, o.height * 0.82, 0.2, o.sides, ringJitter(o.sides, 0.16, rnd));
  const apex: Ring = { x: 0, y: o.height, z: 0 };
  const base: Ring = { x: 0, y: 0, z: 0 };
  const P = (p: Ring) => place(p);

  const add = (A: Ring, B: Ring, C: Ring) => {
    const pa = P(A), pb = P(B), pc = P(C);
    pushTri(acc, pa, pb, pc, facetTone(cross(pa, pb, pc), o.tones, rnd() * 2 - 1), thickness);
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

export interface FormationSpec {
  x: number;
  z: number;
  /** 0..1 — 0 small shards, 1 a dominant spire cluster. */
  weight: number;
  families: CrystalFamily[];
  count: number;
  /** Base sits this far below the tile plane so the crystal emerges. */
  baseY: number;
}

/**
 * One formation: a dominant spire plus satellites fanning outward from a
 * shared buried base. Colours CYCLE through the look's families, so a single
 * cluster shows coral + peach + mint + gold the way the concept does.
 */
export function emitFormation(acc: SegAcc, spec: FormationSpec, rnd: () => number): void {
  const fam = spec.families;
  if (fam.length === 0) return;
  const spireH = 2.6 + spec.weight * 3.6;
  const phase = Math.floor(rnd() * fam.length);

  // Dominant spire
  emitCrystal(acc, {
    baseR: 0.62 + spec.weight * 0.42,
    height: spireH,
    taper: 0.46 + rnd() * 0.16,
    sides: 6,
    spin: rnd() * Math.PI,
    leanX: (rnd() - 0.5) * 0.06,
    leanZ: (rnd() - 0.5) * 0.06,
    scale: 0.85 + spec.weight * 0.3,
    pos: [spec.x, spec.baseY, spec.z],
    tones: crystalTones(fam[phase % fam.length])
  }, rnd);

  // Satellites — each takes the NEXT family, so the cluster is mixed colour.
  // Tight radius + outward lean: the concept clumps are dense, with the shards
  // fanning out of one base, not a scatter of lone crystals.
  for (let i = 1; i < spec.count; i++) {
    const ang = (i / spec.count) * Math.PI * 2 + rnd() * 0.5;
    const rad = (0.22 + rnd() * 0.4) * (0.55 + spec.weight * 0.7);
    emitCrystal(acc, {
      baseR: 0.3 + rnd() * 0.26,
      height: spireH * (0.5 + rnd() * 0.5),
      taper: 0.44 + rnd() * 0.2,
      sides: 5 + (i % 2),
      spin: rnd() * Math.PI,
      leanX: Math.cos(ang) * (0.2 + rnd() * 0.16),
      leanZ: Math.sin(ang) * (0.2 + rnd() * 0.16),
      scale: 0.72 + rnd() * 0.4,
      pos: [
        spec.x + Math.cos(ang) * rad,
        spec.baseY - rnd() * 0.3,
        spec.z + Math.sin(ang) * rad * 0.8
      ],
      tones: crystalTones(fam[(phase + i) % fam.length])
    }, rnd);
  }
}

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
