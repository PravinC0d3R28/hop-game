/**
 * Tall dark shafts. A cluster is several shafts authored together.
 * A marked shaft carries one constellation on the face toward the path.
 * The drawing stays on that stone. It is not copied onto tiles.
 */
import { BufferGeometry, Float32BufferAttribute } from 'three';
import { VOID_LINE_COOL, VOID_LINE_WARM, VOID_RIM, VOID_STONE } from './VoidPalette';
import { VOID_PLAY_HALF_X } from './VoidGates';

const NODE = 0xffe8a0;

export type MonolithFamily = 'shaft' | 'cluster' | 'marked';

interface Shaft {
  /** Local X. Negative is toward the path. */
  x: number;
  z: number;
  height: number;
  half: number;
  yaw: number;
  /** Small lean. Positive leans away from the path. */
  lean: number;
  /** Tip along the path. Positive moves the top toward +Z. */
  pitch?: number;
  cyan: boolean;
  /** Top width as a fraction of the base. The tall shaft leaves this unset. */
  taper?: number;
  /** Six height shifts for the top corners, as a fraction of the shaft height. */
  chip?: number[];
}

interface Mark {
  /** Points on the inner face, as [height fraction, z offset]. */
  stars: [number, number][];
  lines: [number, number][];
  warm: boolean;
}

export interface MonolithVariation {
  id: string;
  family: MonolithFamily;
  y: number;
  z: number;
  distance: number;
  shafts: Shaft[];
  mark?: Mark;
  /** A faceted shaft. The other monoliths stay on the older build until their turn. */
  facet?: boolean;
}

const Z = 105;

export const VOID_MONOLITHS: MonolithVariation[] = [
  {
    id: 'shaft-tall',
    family: 'shaft',
    y: -0.3,
    z: Z,
    distance: 11.6,
    facet: true,
    shafts: [{ x: 0, z: 0, height: 4.8, half: 1.15, yaw: 0.52, lean: 0.05, cyan: true }]
  },
  {
    id: 'shaft-slim',
    family: 'shaft',
    y: 0.1,
    z: Z,
    distance: 11.0,
    facet: true,
    shafts: [{ x: 0, z: 0, height: 4.5, half: 0.72, yaw: 0.48, lean: 0.04, cyan: false, taper: 0.36 }]
  },
  {
    id: 'shaft-broad',
    family: 'shaft',
    y: -0.2,
    z: Z,
    distance: 12.6,
    facet: true,
    shafts: [{ x: 0, z: 0, height: 3.3, half: 1.55, yaw: 0.5, lean: 0.04, cyan: true, taper: 0.86 }]
  },
  {
    id: 'shaft-lean',
    family: 'shaft',
    y: -0.15,
    z: Z,
    distance: 12.4,
    facet: true,
    shafts: [{ x: 0.35, z: 0, height: 4.3, half: 1.05, yaw: 0.55, lean: -0.34, cyan: true, taper: 0.7 }]
  },
  {
    id: 'cluster-three',
    family: 'cluster',
    y: -0.2,
    z: Z,
    distance: 13.4,
    facet: true,
    shafts: [
      { x: 0, z: 0.1, height: 4.4, half: 0.82, yaw: 0.5, lean: -0.06, cyan: true, taper: 0.72 },
      { x: 2.05, z: -0.55, height: 3.15, half: 0.68, yaw: 0.42, lean: 0.05, cyan: false, taper: 0.8 },
      { x: 1.7, z: 0.9, height: 2.15, half: 0.58, yaw: 0.58, lean: 0.02, cyan: false, taper: 0.5 }
    ]
  },
  {
    id: 'cluster-step',
    family: 'cluster',
    y: 0,
    z: Z,
    distance: 13.0,
    facet: true,
    shafts: [
      { x: 0.4, z: -1.25, height: 4.35, half: 0.9, yaw: 0.52, lean: 0.16, cyan: false, taper: 0.4 },
      { x: 0.05, z: 0.45, height: 2.9, half: 0.56, yaw: 0.48, lean: 0.02, cyan: true, taper: 0.96 },
      { x: -0.3, z: 2.35, height: 1.65, half: 1.05, yaw: 0.58, lean: -0.1, cyan: false, taper: 1.08 }
    ]
  },
  {
    id: 'cluster-fan',
    family: 'cluster',
    y: -0.1,
    z: Z,
    distance: 13.6,
    facet: true,
    shafts: [
      { x: -0.2, z: -0.55, height: 3.25, half: 0.84, yaw: 0.58, lean: -0.32, pitch: -0.22, cyan: true, taper: 0.76, chip: [-0.22, -0.12, 0.0, 0.02, -0.04, -0.16] },
      { x: 1.4, z: 0.1, height: 3.65, half: 0.7, yaw: 0.5, lean: 0.02, cyan: false, taper: 0.66, chip: [-0.16, -0.08, 0.02, 0.0, -0.06, -0.22] },
      { x: 2.95, z: 0.7, height: 2.75, half: 0.8, yaw: 0.46, lean: 0.38, pitch: 0.24, cyan: false, taper: 0.82, chip: [-0.1, -0.22, -0.14, 0.0, 0.02, -0.04] }
    ]
  },
  {
    id: 'marked-hook',
    family: 'marked',
    y: -0.2,
    z: Z,
    distance: 11.8,
    facet: true,
    shafts: [{ x: 0, z: 0, height: 4.5, half: 1.28, yaw: 0.44, lean: 0.03, cyan: false, taper: 0.8 }],
    mark: {
      warm: true,
      stars: [[0.7, -0.16], [0.54, -0.16], [0.44, 0.02], [0.5, 0.18]],
      lines: [[0, 1], [1, 2], [2, 3]]
    }
  },
  {
    id: 'marked-peak',
    family: 'marked',
    y: 0,
    z: Z,
    distance: 11.4,
    facet: true,
    shafts: [{ x: 0, z: 0, height: 3.7, half: 1.02, yaw: 0.44, lean: 0.05, cyan: true, taper: 0.58 }],
    mark: {
      warm: false,
      stars: [[0.46, 0.1], [0.6, -0.06], [0.6, 0.26], [0.76, 0.1]],
      lines: [[0, 1], [0, 2], [1, 3], [2, 3]]
    }
  },
  {
    id: 'marked-arc',
    family: 'marked',
    y: -0.1,
    z: Z,
    distance: 12.0,
    facet: true,
    shafts: [{ x: 0, z: 0, height: 3.2, half: 1.42, yaw: 0.44, lean: 0.04, cyan: false, taper: 0.92 }],
    mark: {
      warm: false,
      stars: [[0.52, -0.22], [0.64, -0.1], [0.72, 0.02], [0.64, 0.14], [0.52, 0.24]],
      lines: [[0, 1], [1, 2], [2, 3], [3, 4]]
    }
  }
];

interface Acc {
  pos: number[];
  col: number[];
}

function srgbToLinear(byte: number): number {
  const u = byte / 255;
  return u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4;
}

function rgb(hex: number): [number, number, number] {
  return [
    srgbToLinear((hex >> 16) & 255),
    srgbToLinear((hex >> 8) & 255),
    srgbToLinear(hex & 255)
  ];
}

function pushTri(acc: Acc, a: number[], b: number[], c: number[], hex: number): void {
  const [r, g, bl] = rgb(hex);
  for (const p of [a, b, c]) {
    acc.pos.push(p[0], p[1], p[2]);
    acc.col.push(r, g, bl);
  }
}

function add(a: number[], b: number[], s: number): number[] {
  return [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
}

function norm(v: number[]): number[] {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

function cross(a: number[], b: number[]): number[] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

function stone(ny: number): number {
  if (ny > 0.45) return VOID_STONE.highlight;
  if (ny > 0.1) return VOID_STONE.lit;
  if (ny < -0.35) return VOID_STONE.midnight;
  return Math.abs(ny) < 0.2 ? VOID_STONE.violet : VOID_STONE.face;
}

function pushBox(
  acc: Acc,
  center: number[],
  u: number[], v: number[], w: number[],
  hu: number, hv: number, hw: number,
  colorOf: (ny: number) => number
): void {
  const corner = (su: number, sv: number, sw: number): number[] =>
    add(add(add(center, u, su * hu), v, sv * hv), w, sw * hw);
  const faces: Array<{ n: number[]; q: number[][] }> = [
    { n: u, q: [corner(1, -1, -1), corner(1, 1, -1), corner(1, 1, 1), corner(1, -1, 1)] },
    { n: [-u[0], -u[1], -u[2]], q: [corner(-1, -1, 1), corner(-1, 1, 1), corner(-1, 1, -1), corner(-1, -1, -1)] },
    { n: v, q: [corner(-1, 1, -1), corner(1, 1, -1), corner(1, 1, 1), corner(-1, 1, 1)] },
    { n: [-v[0], -v[1], -v[2]], q: [corner(-1, -1, 1), corner(1, -1, 1), corner(1, -1, -1), corner(-1, -1, -1)] },
    { n: w, q: [corner(-1, -1, 1), corner(-1, 1, 1), corner(1, 1, 1), corner(1, -1, 1)] },
    { n: [-w[0], -w[1], -w[2]], q: [corner(1, -1, -1), corner(1, 1, -1), corner(-1, 1, -1), corner(-1, -1, -1)] }
  ];
  for (const face of faces) {
    const hex = colorOf(face.n[1]);
    const [a, b, c, d] = face.q;
    pushTri(acc, a, b, c, hex);
    pushTri(acc, a, c, d, hex);
  }
}

function axes(yaw: number): { u: number[]; v: number[]; w: number[] } {
  const sy = Math.sin(yaw);
  const cy = Math.cos(yaw);
  const u = [cy, 0, -sy];
  const v = [0, 1, 0];
  const w = [sy, 0, cy];
  return { u, v, w };
}

type Vec = [number, number, number];

function facetBands(shaft: Shaft): [Vec[], Vec[], Vec[]] {
  const sides = 6;
  const radii = [1, 0.9, 1.22, 0.86, 1.08, 0.94];
  const h = shaft.height;
  const ring = (y: number, scale: number, slant: number): Vec[] => {
    const out: Vec[] = [];
    for (let i = 0; i < sides; i++) {
      const a = Math.PI + (i / sides) * Math.PI * 2;
      const r = radii[i] * scale;
      out.push([
        Math.cos(a) * shaft.half * r,
        y + Math.sin(a) * slant,
        Math.sin(a) * shaft.half * 0.82 * r
      ]);
    }
    return out;
  };
  const tip = shaft.taper ?? 0.66;
  const chip = shaft.chip;
  const foot = ring(0, 1, 0);
  const waist = ring(h * 0.48, 1 - (1 - tip) * 0.42, 0);
  const top = ring(h, tip, chip ? 0 : h * (tip < 0.5 ? 0.14 : 0.05));
  if (chip) {
    let low = 0;
    for (let i = 1; i < sides; i++) if ((chip[i] ?? 0) < (chip[low] ?? 0)) low = i;
    for (let i = 0; i < sides; i++) {
      top[i][1] += (chip[i] ?? 0) * h;
      if (i === low) {
        top[i][0] *= 0.7;
        top[i][2] *= 0.7;
      }
    }
  }
  const cy = Math.cos(shaft.yaw);
  const syaw = Math.sin(shaft.yaw);
  const pitch = shaft.pitch ?? 0;
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const cl = Math.cos(shaft.lean);
  const sl = Math.sin(shaft.lean);
  for (const band of [foot, waist, top]) {
    for (const v of band) {
      const x = v[0] * cy - v[2] * syaw;
      v[2] = v[0] * syaw + v[2] * cy;
      v[0] = x;
      const z = v[2] * cp + v[1] * sp;
      v[1] = v[1] * cp - v[2] * sp;
      v[2] = z;
      const nx = v[0] * cl + v[1] * sl;
      v[1] = -v[0] * sl + v[1] * cl;
      v[0] = nx;
    }
  }
  return [foot, waist, top];
}

function pushFacet(acc: Acc, origin: number[], shaft: Shaft): void {
  const sides = 6;
  const [foot, waist, top] = facetBands(shaft);
  const place = (v: Vec): number[] => [
    origin[0] + shaft.x + v[0],
    origin[1] + v[1],
    origin[2] + shaft.z + v[2]
  ];
  const hub: Vec = [0, 0, 0];
  const all = foot.concat(waist, top);
  for (const v of all) {
    hub[0] += v[0];
    hub[1] += v[1];
    hub[2] += v[2];
  }
  hub[0] /= all.length;
  hub[1] /= all.length;
  hub[2] /= all.length;
  const emit = (a: Vec, b: Vec, c: Vec, seam: boolean) => {
    const ax = b[0] - a[0];
    const ay = b[1] - a[1];
    const az = b[2] - a[2];
    const bx = c[0] - a[0];
    const by = c[1] - a[1];
    const bz = c[2] - a[2];
    const nx = ay * bz - az * by;
    const ny = az * bx - ax * bz;
    const nz = ax * by - ay * bx;
    const mid = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
    const outward = nx * (mid[0] - hub[0]) + ny * (mid[1] - hub[1]) + nz * (mid[2] - hub[2]) >= 0;
    const len = Math.hypot(nx, ny, nz) || 1;
    pushTri(
      acc,
      place(a),
      place(outward ? b : c),
      place(outward ? c : b),
      seam ? VOID_RIM : stone((outward ? ny : -ny) / len)
    );
  };
  const inset = (edge: Vec, other: Vec): Vec => {
    const dx = other[0] - edge[0];
    const dz = other[2] - edge[2];
    const len = Math.hypot(dx, dz) || 1;
    const k = Math.min(0.1, len * 0.28) / len;
    return [edge[0] + dx * k, edge[1] + (other[1] - edge[1]) * k, edge[2] + dz * k];
  };
  const band = (lower: Vec[], upper: Vec[]) => {
    for (let i = 0; i < sides; i++) {
      const n = (i + 1) % sides;
      const b0 = lower[i];
      const b1 = lower[n];
      const t1 = upper[n];
      const t0 = upper[i];
      const glow = shaft.cyan && (i === 0 || n === 0);
      if (!glow) {
        emit(b0, b1, t1, false);
        emit(b0, t1, t0, false);
        continue;
      }
      const edgeFirst = i === 0;
      const eB = edgeFirst ? b0 : b1;
      const eT = edgeFirst ? t0 : t1;
      const oB = edgeFirst ? b1 : b0;
      const oT = edgeFirst ? t1 : t0;
      const sB = inset(eB, oB);
      const sT = inset(eT, oT);
      if (edgeFirst) {
        emit(b0, sB, sT, true);
        emit(b0, sT, t0, true);
        emit(sB, b1, t1, false);
        emit(sB, t1, sT, false);
      } else {
        emit(sB, b1, t1, true);
        emit(sB, t1, sT, true);
        emit(b0, sB, sT, false);
        emit(b0, sT, t0, false);
      }
    }
  };
  band(foot, waist);
  band(waist, top);
  const mean = (pts: Vec[]): Vec => {
    const m: Vec = [0, 0, 0];
    for (const p of pts) {
      m[0] += p[0];
      m[1] += p[1];
      m[2] += p[2];
    }
    return [m[0] / sides, m[1] / sides, m[2] / sides];
  };
  const cap = mean(top);
  const sole = mean(foot);
  for (let i = 0; i < sides; i++) {
    const n = (i + 1) % sides;
    emit(cap, top[i], top[n], false);
    emit(sole, foot[n], foot[i], false);
  }
}

function pushShaft(acc: Acc, origin: number[], shaft: Shaft): void {
  const { u, v, w } = axes(shaft.yaw);
  const lean = Math.sin(shaft.lean) * shaft.height;
  const base = [origin[0] + shaft.x, origin[1], origin[2] + shaft.z];
  const tip = [base[0] + lean, base[1] + shaft.height, base[2]];
  const hb = shaft.half;
  const ht = shaft.half * 0.62;
  const db = hb * 0.78;
  const dt = ht * 0.78;
  const at = (center: number[], su: number, sw: number, hu: number, hw: number): number[] =>
    add(add(center, u, su * hu), w, sw * hw);
  const b0 = at(base, -1, -1, hb, db);
  const b1 = at(base, 1, -1, hb, db);
  const b2 = at(base, 1, 1, hb, db);
  const b3 = at(base, -1, 1, hb, db);
  const t0 = at(tip, -1, -1, ht, dt);
  const t1 = at(tip, 1, -1, ht, dt);
  const t2 = at(tip, 1, 1, ht, dt);
  const t3 = at(tip, -1, 1, ht, dt);
  const quad = (a: number[], b: number[], c: number[], d: number[], ny: number): void => {
    const hex = stone(ny);
    pushTri(acc, a, b, c, hex);
    pushTri(acc, a, c, d, hex);
  };
  quad(b0, b1, t1, t0, u[1]);
  quad(b1, b2, t2, t1, w[1]);
  quad(b2, b3, t3, t2, -u[1]);
  quad(b3, b0, t0, t3, -w[1]);
  quad(t0, t1, t2, t3, 1);
  quad(b0, b3, b2, b1, -1);
  if (shaft.cyan) {
    const hm = (hb + ht) * 0.5;
    const dm = (db + dt) * 0.5;
    const mid = [
      (base[0] + tip[0]) * 0.5,
      (base[1] + tip[1]) * 0.5,
      (base[2] + tip[2]) * 0.5
    ];
    const edge = add(add(mid, u, -(hm * 0.9)), w, dm * 0.9);
    pushBox(acc, edge, u, v, w, 0.016, shaft.height * 0.34, 0.016, () => VOID_RIM);
  }
}

function onPathFace(shaft: Shaft, heightFrac: number, along: number): { p: Vec; n: Vec } {
  const [foot, waist, top] = facetBands(shaft);
  const face = 0;
  const next = 1;
  const f = Math.max(0.12, Math.min(0.86, heightFrac));
  const lower = f <= 0.48 ? foot : waist;
  const upper = f <= 0.48 ? waist : top;
  const t = f <= 0.48 ? f / 0.48 : (f - 0.48) / 0.52;
  const s = 0.5 + Math.max(-0.36, Math.min(0.36, along / 0.7));
  const mix = (a: Vec, b: Vec, k: number): Vec => [
    a[0] + (b[0] - a[0]) * k,
    a[1] + (b[1] - a[1]) * k,
    a[2] + (b[2] - a[2]) * k
  ];
  const p = mix(mix(lower[face], lower[next], s), mix(upper[face], upper[next], s), t);
  const edge = [lower[next][0] - lower[face][0], lower[next][1] - lower[face][1], lower[next][2] - lower[face][2]];
  const rise = [upper[face][0] - lower[face][0], upper[face][1] - lower[face][1], upper[face][2] - lower[face][2]];
  const n = norm(cross(edge, rise));
  const hub: Vec = [0, 0, 0];
  for (const v of waist) {
    hub[0] += v[0];
    hub[1] += v[1];
    hub[2] += v[2];
  }
  hub[0] /= waist.length;
  hub[1] /= waist.length;
  hub[2] /= waist.length;
  const out = n[0] * (p[0] - hub[0]) + n[1] * (p[1] - hub[1]) + n[2] * (p[2] - hub[2]) >= 0 ? n : [-n[0], -n[1], -n[2]];
  return { p, n: [out[0], out[1], out[2]] };
}

function pushMark(acc: Acc, origin: number[], shaft: Shaft, mark: Mark, onFace: boolean): void {
  const line = mark.warm ? VOID_LINE_WARM : VOID_LINE_COOL;
  if (onFace) {
    const at = (star: [number, number]): { p: Vec; n: Vec } => onPathFace(shaft, star[0], star[1]);
    for (const [a, b] of mark.lines) {
      const pa = at(mark.stars[a]);
      const pb = at(mark.stars[b]);
      const dir = norm([pb.p[0] - pa.p[0], pb.p[1] - pa.p[1], pb.p[2] - pa.p[2]]);
      const side = norm(cross(pa.n, dir));
      const len = Math.hypot(pb.p[0] - pa.p[0], pb.p[1] - pa.p[1], pb.p[2] - pa.p[2]);
      const mid = [
        origin[0] + shaft.x + (pa.p[0] + pb.p[0]) * 0.5 + pa.n[0] * 0.03,
        origin[1] + (pa.p[1] + pb.p[1]) * 0.5 + pa.n[1] * 0.03,
        origin[2] + shaft.z + (pa.p[2] + pb.p[2]) * 0.5 + pa.n[2] * 0.03
      ];
      pushBox(acc, mid, side, dir, pa.n, 0.016, len * 0.5, 0.01, () => line);
    }
    for (const star of mark.stars) {
      const hit = at(star);
      const up = Math.abs(hit.n[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
      const side = norm(cross(hit.n, up));
      pushBox(
        acc,
        [
          origin[0] + shaft.x + hit.p[0] + hit.n[0] * 0.04,
          origin[1] + hit.p[1] + hit.n[1] * 0.04,
          origin[2] + shaft.z + hit.p[2] + hit.n[2] * 0.04
        ],
        side,
        up,
        hit.n,
        0.055,
        0.055,
        0.02,
        () => NODE
      );
    }
    return;
  }
  const faceX = origin[0] + shaft.x - shaft.half - 0.045;
  const point = (star: [number, number]): number[] => [
    faceX,
    origin[1] + shaft.height * star[0],
    origin[2] + shaft.z + star[1]
  ];
  for (const [a, b] of mark.lines) {
    const p = point(mark.stars[a]);
    const q = point(mark.stars[b]);
    const dir = norm([q[0] - p[0], q[1] - p[1], q[2] - p[2]]);
    const side = Math.abs(dir[1]) > 0.9 ? [1, 0, 0] : norm(cross(dir, [0, 1, 0]));
    const out = norm(cross(side, dir));
    const mid = [(p[0] + q[0]) * 0.5, (p[1] + q[1]) * 0.5, (p[2] + q[2]) * 0.5];
    const len = Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]);
    pushBox(acc, mid, side, dir, out, 0.012, len * 0.5, 0.012, () => line);
  }
  for (const star of mark.stars) {
    pushBox(acc, point(star), [1, 0, 0], [0, 1, 0], [0, 0, 1], 0.055, 0.055, 0.055, () => NODE);
  }
}

/** Built on +X, then mirrored, so the marked face stays toward the path. */
export function buildMonolithVariation(spec: MonolithVariation, side: 1 | -1): BufferGeometry {
  const acc: Acc = { pos: [], col: [] };
  const origin = [spec.distance, spec.y, spec.z];
  if (spec.facet) for (const shaft of spec.shafts) pushFacet(acc, origin, shaft);
  else for (const shaft of spec.shafts) pushShaft(acc, origin, shaft);
  if (spec.mark) pushMark(acc, origin, spec.shafts[0], spec.mark, spec.facet === true);
  if (side < 0) mirrorToPath(acc.pos, acc.col);
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(acc.pos, 3));
  geo.setAttribute('color', new Float32BufferAttribute(acc.col, 3));
  return geo;
}

/** Negating X turns the faces inside out. Swap each triangle so the outside still points out. */
function mirrorToPath(pos: number[], col: number[]): void {
  for (let i = 0; i < pos.length; i += 9) {
    pos[i] = -pos[i];
    pos[i + 3] = -pos[i + 3];
    pos[i + 6] = -pos[i + 6];
    for (let k = 0; k < 3; k++) {
      const a = i + 3 + k;
      const b = i + 6 + k;
      const p = pos[a];
      pos[a] = pos[b];
      pos[b] = p;
      const c = col[a];
      col[a] = col[b];
      col[b] = c;
    }
  }
}

/** One finished monolith per segment, opposite the island. */
export function buildVoidMonolithSegments(seed: number, count: number): BufferGeometry[] {
  const start = seed % VOID_MONOLITHS.length;
  const geos: BufferGeometry[] = [];
  for (let k = 0; k < count; k++) {
    const side: 1 | -1 = k % 2 === 0 ? 1 : -1;
    geos.push(buildMonolithVariation(VOID_MONOLITHS[(start + k) % VOID_MONOLITHS.length], side));
  }
  return geos;
}

export function monolithStaysBeside(geo: BufferGeometry): boolean {
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    if (Math.abs(pos.getX(i)) < VOID_PLAY_HALF_X) return false;
  }
  return true;
}
