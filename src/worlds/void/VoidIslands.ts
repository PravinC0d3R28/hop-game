/**
 * Floating rocks. Each variation is one finished island: its own silhouette,
 * and, when it has them, the crack or the monolith that belongs to it.
 * Nothing here is glued on at spawn time.
 */
import { BufferGeometry, Float32BufferAttribute, IcosahedronGeometry } from 'three';
import { VOID_RIM, VOID_RIM_VIOLET, VOID_STONE } from './VoidPalette';
import { VOID_PLAY_HALF_X } from './VoidGates';

export type IslandFamily = 'wide' | 'jagged' | 'seam' | 'crowned' | 'point';

interface Chunk {
  at: [number, number, number];
  size: [number, number, number];
  yaw: number;
  tilt: number;
  seam: boolean;
}

/** One faceted stone. Vertices are shared, then pushed. Not a pile of boxes. */
export interface IslandHull {
  seed: number;
  /** Half extents of the stone before the top is flattened. */
  span: [number, number, number];
  /** Height of the broken top plane, in local space. */
  flatTop: number;
  /** How far the lowest points hang below the body. */
  fangs: number;
  /** 0 is a 20-face crystal. 1 is a finer rock. */
  detail: number;
  /**
   * 0 keeps an even body. Positive lowers the -X end so a side view
   * reads as a wedge. Applied after the top is set, so the deck slopes.
   */
  taper?: number;
  /** Drops and narrows the middle so the top view shows a bite. The mesh stays one stone. */
  notch?: number;
  /** Wide rocks flatten the top. Jagged rocks leave it. */
  deck?: boolean;
  /** Pulls the highest point up into one horn. It stays a vertex of the stone. */
  spike?: number;
  /** How much that horn pinches in. 0.3 is a needle, higher keeps a faceted peak. */
  spikePinch?: number;
  /** Stretches the outer corners into points. */
  points?: number;
  /** Raises the upper faces into one faceted peak. */
  peak?: number;
  /** One downward point, the broad face on top. An upside-down mountain. */
  invert?: boolean;
  /** Radians the top turns relative to the base. Vertices stay joined. */
  twist?: number;
  /**
   * Depth of a cyan crack through the stone, along local Z.
   * The crack is a band of faces on this hull, not a box beside it.
   */
  rift?: number;
  /** Colour of the crack. Cyan when omitted. */
  glow?: number;
  /** A second crack along local X, crossing the first. */
  cross?: boolean;
  /** A monolith whose base sits inside this rock. */
  crown?: IslandCrown;
  /** More than one monolith on the same rock. */
  crowns?: IslandCrown[];
}

/** A tall faceted shaft. One vertical edge is cyan. `lift` raises it clear of the rock. */
export interface IslandCrown {
  seed: number;
  span: [number, number, number];
  /** Centre before `lift`. Without a lift, the foot sits inside the rock. */
  at: [number, number, number];
  /** Radians tipped along the path, around local X. A strong lean pivots at the foot. */
  lean?: number;
  /** Radians tipped across the path, around local Z. Negative leans away from the path. */
  heel?: number;
  /** Radians turned around Y, so a broad face can point toward the path. */
  yaw?: number;
  /** Raises the whole shaft so a gap shows between the foot and the rock. */
  lift?: number;
  /** Obelisk is the tall taper. Block is a heavier stone with a slanted top. */
  kind?: 'obelisk' | 'block';
}

export interface IslandVariation {
  id: string;
  family: IslandFamily;
  y: number;
  z: number;
  /** Distance from the path centre. The island is mirrored onto either side. */
  distance: number;
  chunks: Chunk[];
  hull?: IslandHull;
}

function rock(
  x: number, y: number, z: number,
  hx: number, hy: number, hz: number,
  tilt = 0, yaw = 0
): Chunk {
  return { at: [x, y, z], size: [hx, hy, hz], tilt, yaw, seam: false };
}

function crack(
  x: number, y: number, z: number,
  hx: number, hy: number, hz: number,
  tilt = 0, yaw = 0
): Chunk {
  return { at: [x, y, z], size: [hx, hy, hz], tilt, yaw, seam: true };
}

/**
 * Local -X points toward the path. Wide islands keep a flat top and a jagged
 * underside. Jagged islands have no table top. A seam is a cyan crack cut
 * through the hull. A crowned island is a rock with the monolith that belongs to it.
 */
export const VOID_ISLANDS: IslandVariation[] = [
  {
    id: 'wide-shelf',
    family: 'wide',
    y: 0.15,
    z: 72,
    distance: 15.2,
    chunks: [],
    hull: {
      seed: 11,
      span: [3.5, 0.72, 2.05],
      flatTop: 0.48,
      fangs: 1.25,
      detail: 1,
      crown: { seed: 61, span: [0.4, 1.85, 0.34], at: [0.35, 1.45, 0.15], yaw: 0.35 }
    }
  },
  {
    id: 'wide-wedge',
    family: 'wide',
    y: 0.05,
    z: 72,
    distance: 13.4,
    chunks: [],
    hull: {
      seed: 29,
      span: [2.15, 1.35, 1.05],
      flatTop: 0.7,
      fangs: 0.7,
      detail: 1,
      taper: 0.85,
      crown: { seed: 73, span: [0.72, 0.85, 0.55], at: [-0.2, 0.85, 0.1], lift: 1.35, yaw: 0.9, kind: 'block' }
    }
  },
  {
    id: 'wide-broken',
    family: 'wide',
    y: 0.25,
    z: 72,
    distance: 16.4,
    chunks: [],
    hull: {
      seed: 41,
      span: [4.1, 0.78, 1.55],
      flatTop: 0.42,
      fangs: 0.95,
      detail: 1,
      notch: 1.05,
      crown: { seed: 89, span: [0.36, 2.45, 0.3], at: [0.6, 2.45, -0.15], lift: 1.3, lean: 0.16 }
    }
  },
  {
    id: 'wide-barge',
    family: 'wide',
    y: 0.1,
    z: 72,
    distance: 17.2,
    chunks: [],
    hull: {
      seed: 53,
      span: [4.6, 0.62, 2.45],
      flatTop: 0.36,
      fangs: 0.85,
      detail: 1,
      crown: { seed: 97, span: [1.15, 1.05, 0.72], at: [0.4, 0.55, 0.2], yaw: 0.7, heel: -0.12, kind: 'block' }
    }
  },
  {
    id: 'jag-heap',
    family: 'jagged',
    y: 0.4,
    z: 72,
    distance: 14.0,
    chunks: [],
    hull: {
      seed: 67,
      span: [2.3, 1.9, 1.7],
      flatTop: 0,
      fangs: 0.4,
      detail: 1,
      deck: false,
      crown: { seed: 101, span: [0.5, 2.3, 0.42], at: [0.15, 2.3, 0.05], lift: 0.95, yaw: 0.2 }
    }
  },
  {
    id: 'jag-fang',
    family: 'jagged',
    y: 0.25,
    z: 72,
    distance: 12.6,
    chunks: [],
    hull: {
      seed: 71,
      span: [1.1, 1.55, 0.95],
      flatTop: 0,
      fangs: 0.2,
      detail: 1,
      deck: false,
      spike: 2.1,
      crown: { seed: 113, span: [0.28, 0.95, 0.24], at: [-0.15, 0.55, 0.1], lean: -0.2 }
    }
  },
  {
    id: 'jag-twist',
    family: 'jagged',
    y: 0.45,
    z: 72,
    distance: 14.6,
    chunks: [],
    hull: {
      seed: 83,
      span: [2.55, 1.65, 1.15],
      flatTop: 0,
      fangs: 0.35,
      detail: 1,
      deck: false,
      twist: 1.25,
      crown: { seed: 127, span: [0.42, 1.7, 0.36], at: [0.2, 1.7, -0.1], lift: 0.85, lean: 0.32, yaw: 0.55 }
    }
  },
  {
    id: 'jag-low',
    family: 'jagged',
    y: -0.1,
    z: 72,
    distance: 15.0,
    chunks: [],
    hull: {
      seed: 97,
      span: [2.85, 0.55, 2.0],
      flatTop: 0,
      fangs: 0.18,
      detail: 1,
      deck: false,
      crown: { seed: 139, span: [0.9, 0.72, 0.62], at: [0.25, 0.35, 0.15], yaw: 1.1, kind: 'block' }
    }
  },
  {
    id: 'seam-rift',
    family: 'seam',
    y: 0.15,
    z: 72,
    distance: 12.0,
    chunks: [],
    hull: { seed: 103, span: [2.2, 1.05, 1.4], flatTop: 0.5, fangs: 0.8, detail: 1, rift: 0.85 }
  },
  {
    id: 'seam-cross',
    family: 'seam',
    y: 0.1,
    z: 72,
    distance: 11.8,
    chunks: [],
    hull: { seed: 127, span: [1.9, 0.92, 1.75], flatTop: 0.44, fangs: 0.6, detail: 1, rift: 0.8, cross: true, glow: VOID_RIM_VIOLET }
  },
  {
    id: 'seam-shelf',
    family: 'seam',
    y: 0.2,
    z: 72,
    distance: 12.3,
    chunks: [],
    hull: { seed: 149, span: [2.75, 0.82, 1.5], flatTop: 0.4, fangs: 0.65, detail: 1, rift: 0.75, glow: 0xe7f1ff }
  },
  {
    id: 'crown-planted',
    family: 'crowned',
    y: 0.1,
    z: 72,
    distance: 11.2,
    chunks: [],
    hull: {
      seed: 163,
      span: [2.6, 0.82, 1.55],
      flatTop: 0.42,
      fangs: 1.0,
      detail: 1,
      crown: { seed: 17, span: [0.78, 2.15, 0.64], at: [0.05, 1.72, 0], lean: 0.05 }
    }
  },
  {
    id: 'crown-gap',
    family: 'crowned',
    y: 0.05,
    z: 72,
    distance: 12.0,
    chunks: [],
    hull: {
      seed: 181,
      span: [2.35, 0.74, 1.4],
      flatTop: 0.38,
      fangs: 0.8,
      detail: 1,
      rift: 0.65,
      crown: {
        seed: 29,
        span: [0.95, 1.45, 0.72],
        at: [0.15, 1.4, -0.05],
        lean: 0.08,
        yaw: 0.45,
        lift: 1.2,
        kind: 'block'
      }
    }
  },
  {
    id: 'crown-twin',
    family: 'crowned',
    y: 0.15,
    z: 72,
    distance: 12.8,
    chunks: [],
    hull: {
      seed: 197,
      span: [2.7, 0.85, 1.5],
      flatTop: 0.44,
      fangs: 0.9,
      detail: 1,
      crowns: [
        { seed: 31, span: [0.55, 1.9, 0.46], at: [-0.7, 1.6, 0.2], lean: 0.04 },
        { seed: 43, span: [0.7, 1.15, 0.56], at: [1.05, 1.15, -0.25], lean: -0.06, yaw: 0.5, kind: 'block' }
      ]
    }
  },
  {
    id: 'crown-lean',
    family: 'crowned',
    y: 0.1,
    z: 72,
    distance: 12.2,
    chunks: [],
    hull: {
      seed: 211,
      span: [2.5, 0.9, 1.45],
      flatTop: 0.46,
      fangs: 0.85,
      detail: 1,
      crown: {
        seed: 47,
        span: [0.95, 1.7, 0.8],
        at: [0.15, 1.55, 0],
        lean: 0.4,
        heel: 0.1,
        yaw: 0.6,
        kind: 'block'
      }
    }
  },
  {
    id: 'point-shard',
    family: 'point',
    y: 0.5,
    z: 72,
    distance: 16.0,
    chunks: [],
    hull: {
      seed: 307,
      span: [3.7, 0.55, 2.15],
      flatTop: 0.45,
      fangs: 2.05,
      detail: 1,
      crown: { seed: 151, span: [0.34, 2.15, 0.28], at: [0.4, 2.15, 0.1], lift: 1.15, yaw: 0.4 }
    }
  },
  {
    id: 'point-peak',
    family: 'point',
    y: 0.4,
    z: 72,
    distance: 12.8,
    chunks: [],
    hull: {
      seed: 319,
      span: [1.15, 0.26, 0.78],
      flatTop: 0.22,
      fangs: 0.95,
      detail: 1,
      crown: { seed: 163, span: [0.26, 0.85, 0.22], at: [0.05, 0.45, 0], lean: 0.22 }
    }
  },
  {
    id: 'point-mountain',
    family: 'point',
    y: 0.9,
    z: 72,
    distance: 14.8,
    chunks: [],
    hull: {
      seed: 331,
      span: [2.4, 0.55, 1.85],
      flatTop: 0.4,
      fangs: 2.5,
      detail: 1,
      invert: true,
      crown: { seed: 179, span: [0.48, 1.55, 0.4], at: [-0.25, 1.55, 0.2], lift: 1.05, yaw: 0.65, lean: -0.12 }
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

function mulberry(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Detail-1 icosahedron, vertices welded so the push doesn't tear it into
 * separate triangles, then squashed into a wide stone. The usual low-poly
 * rock: shared hull, radial jitter, a chopped top, a few points pulled down.
 */
function pushHull(acc: Acc, origin: number[], hull: IslandHull): void {
  seamGlow = hull.glow ?? VOID_RIM;
  const src = new IcosahedronGeometry(1, hull.detail);
  const attr = src.getAttribute('position');
  const verts: number[][] = [];
  const weld = new Map<string, number>();
  const tris: number[] = [];
  const key = (x: number, y: number, z: number) =>
    `${Math.round(x * 1000)},${Math.round(y * 1000)},${Math.round(z * 1000)}`;
  for (let i = 0; i < attr.count; i++) {
    const x = attr.getX(i);
    const y = attr.getY(i);
    const z = attr.getZ(i);
    const k = key(x, y, z);
    let id = weld.get(k);
    if (id === undefined) {
      id = verts.length;
      weld.set(k, id);
      verts.push([x, y, z]);
    }
    tris.push(id);
  }
  src.dispose();

  const rng = mulberry(hull.seed);
  for (const v of verts) {
    const len = Math.hypot(v[0], v[1], v[2]) || 1;
    const j = 0.8 + rng() * 0.38;
    v[0] = (v[0] / len) * j;
    v[1] = (v[1] / len) * j;
    v[2] = (v[2] / len) * j;
  }
  const [sx, sy, sz] = hull.span;
  for (const v of verts) {
    v[0] *= sx;
    v[1] *= sy;
    v[2] *= sz;
  }
  if (hull.deck !== false) {
    for (const v of verts) {
      if (v[1] > hull.flatTop * 0.25) {
        v[1] = hull.flatTop * 0.7 + (rng() - 0.5) * 0.14;
      }
    }
  }
  const lowest = verts
    .map((v, i) => ({ i, y: v[1] }))
    .sort((a, b) => a.y - b.y)
    .slice(0, 5);
  for (const point of lowest) {
    const v = verts[point.i];
    v[1] -= hull.fangs * (0.45 + rng() * 0.55);
    v[0] *= 0.78;
    v[2] *= 0.78;
  }
  if (hull.taper) {
    for (const v of verts) {
      const along = Math.max(-1, Math.min(1, v[0] / sx));
      const k = 1 - hull.taper * (1 - (along + 1) * 0.5);
      v[1] *= Math.max(0.34, k);
    }
  }
  if (hull.notch) {
    for (const v of verts) {
      const along = v[0] / sx;
      const bite = Math.exp(-Math.pow(along / 0.22, 2));
      v[1] -= hull.notch * bite;
      v[2] *= 1 - 0.45 * bite;
    }
  }
  if (hull.spike) {
    let top = 0;
    for (let i = 1; i < verts.length; i++) {
      if (verts[i][1] > verts[top][1]) top = i;
    }
    const horn = verts[top];
    const pinch = hull.spikePinch ?? 0.3;
    horn[1] += hull.spike;
    horn[0] *= pinch;
    horn[2] *= pinch;
  }
  if (hull.peak) {
    let maxY = -Infinity;
    for (const v of verts) maxY = Math.max(maxY, v[1]);
    const cap = Math.abs(maxY) || 1;
    for (const v of verts) {
      const t = Math.max(0, v[1] / cap);
      if (t < 0.4) continue;
      const k = (t - 0.4) / 0.6;
      v[1] += hull.peak * k * k;
      const pinch = 1 - 0.42 * k;
      v[0] *= pinch;
      v[2] *= pinch;
    }
  }
  if (hull.points) {
    for (let k = 0; k < 3; k++) {
      const ang = k * (Math.PI * 2 / 3);
      const dx = Math.cos(ang);
      const dz = Math.sin(ang);
      let best = 0;
      let bestDot = -Infinity;
      for (let i = 0; i < verts.length; i++) {
        const r = Math.hypot(verts[i][0], verts[i][2]) || 1;
        const dot = (verts[i][0] / r) * dx + (verts[i][2] / r) * dz;
        if (dot > bestDot) {
          bestDot = dot;
          best = i;
        }
      }
      const v = verts[best];
      const gain = 1 + hull.points;
      v[0] *= gain;
      v[2] *= gain;
      if (k === 2) v[1] -= hull.points * 0.7;
    }
  }
  if (hull.twist) {
    let minY = Infinity;
    let maxY = -Infinity;
    for (const v of verts) {
      if (v[1] < minY) minY = v[1];
      if (v[1] > maxY) maxY = v[1];
    }
    const height = maxY - minY || 1;
    for (const v of verts) {
      const a = hull.twist * (v[1] - minY) / height;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const x = v[0] * c - v[2] * s;
      v[2] = v[0] * s + v[2] * c;
      v[0] = x;
    }
  }

  for (let t = 0; t < tris.length; t += 3) {
    const a = verts[tris[t]];
    const b = verts[tris[t + 1]];
    const c = verts[tris[t + 2]];
    if (hull.rift) emitRift(acc, origin, a, b, c, hull.rift, t / 3, hull.cross === true);
    else emitFace(acc, origin, a, b, c, false, t / 3);
  }
  if (hull.crown) pushCrown(acc, origin, hull.crown);
  for (const crown of hull.crowns ?? []) pushCrown(acc, origin, crown);
}

function pushCrown(acc: Acc, origin: number[], crown: IslandCrown): void {
  const block = crown.kind === 'block';
  const sides = block ? 6 : 5;
  const rng = mulberry(crown.seed);
  const [sx, sy, sz] = crown.span;
  const radii: number[] = [];
  for (let i = 0; i < sides; i++) radii.push((block ? 0.9 : 0.86) + rng() * (block ? 0.18 : 0.28));
  if (block) radii[2] *= 1.4;
  const ring = (y: number, scale: number, yJitter: number): Vec[] => {
    const out: Vec[] = [];
    for (let i = 0; i < sides; i++) {
      const a = Math.PI + (i / sides) * Math.PI * 2;
      const r = radii[i] * scale;
      out.push([
        Math.cos(a) * sx * r,
        y + (yJitter ? (rng() - 0.5) * yJitter : 0),
        Math.sin(a) * sz * r
      ]);
    }
    return out;
  };
  const foot = ring(-sy, block ? 1.02 : 1.2, 0);
  const waist = ring(sy * 0.02, block ? 0.94 : 0.82, 0);
  const crownTop = ring(sy, block ? 0.8 : 0.46, block ? 0 : sy * 0.2);
  if (block) {
    for (let i = 0; i < sides; i++) {
      const a = Math.PI + (i / sides) * Math.PI * 2;
      crownTop[i][1] += Math.sin(a) * sy * 0.55;
    }
  }
  if (crown.yaw) {
    const c = Math.cos(crown.yaw);
    const s = Math.sin(crown.yaw);
    for (const band of [foot, waist, crownTop]) {
      for (const v of band) {
        const x = v[0] * c - v[2] * s;
        v[2] = v[0] * s + v[2] * c;
        v[0] = x;
      }
    }
  }
  if (crown.lean) {
    const c = Math.cos(crown.lean);
    const s = Math.sin(crown.lean);
    const pivot = Math.abs(crown.lean) > 0.2 ? -sy : 0;
    for (const band of [foot, waist, crownTop]) {
      for (const v of band) {
        const y0 = v[1] - pivot;
        const y = y0 * c - v[2] * s;
        v[2] = y0 * s + v[2] * c;
        v[1] = y + pivot;
      }
    }
  }
  if (crown.heel) {
    const c = Math.cos(crown.heel);
    const s = Math.sin(crown.heel);
    for (const band of [foot, waist, crownTop]) {
      for (const v of band) {
        const y0 = v[1] + sy;
        const x = v[0] * c - y0 * s;
        v[1] = v[0] * s + y0 * c - sy;
        v[0] = x;
      }
    }
  }

  const [ox, oy, oz] = crown.at;
  const lift = crown.lift ?? 0;
  const place = (v: Vec): Vec => [origin[0] + ox + v[0], origin[1] + oy + lift + v[1], origin[2] + oz + v[2]];
  const emitOut = (a: Vec, b: Vec, c: Vec, seam: boolean, face: number) => {
    const mid = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
    const ax = b[0] - a[0];
    const ay = b[1] - a[1];
    const az = b[2] - a[2];
    const bx = c[0] - a[0];
    const by = c[1] - a[1];
    const bz = c[2] - a[2];
    const nx = ay * bz - az * by;
    const ny = az * bx - ax * bz;
    const nz = ax * by - ay * bx;
    const outward = nx * mid[0] + ny * mid[1] + nz * mid[2] >= 0;
    const pa = place(a);
    const pb = place(outward ? b : c);
    const pc = place(outward ? c : b);
    emitFace(acc, [0, 0, 0], pa, pb, pc, seam, face);
  };
  const inset = (edge: Vec, other: Vec): Vec => {
    const dx = other[0] - edge[0];
    const dz = other[2] - edge[2];
    const len = Math.hypot(dx, dz) || 1;
    const k = Math.min(0.12, len * 0.34) / len;
    return [edge[0] + dx * k, edge[1] + (other[1] - edge[1]) * k, edge[2] + dz * k];
  };

  const emitBand = (lower: Vec[], upper: Vec[], face: number) => {
    for (let i = 0; i < sides; i++) {
      const n = (i + 1) % sides;
      const b0 = lower[i];
      const b1 = lower[n];
      const t1 = upper[n];
      const t0 = upper[i];
      const onEdge = i === 0 || n === 0;
      if (!onEdge) {
        emitOut(b0, b1, t1, false, face + i);
        emitOut(b0, t1, t0, false, face + i);
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
        emitOut(b0, sB, sT, true, face + i);
        emitOut(b0, sT, t0, true, face + i);
        emitOut(sB, b1, t1, false, face + i);
        emitOut(sB, t1, sT, false, face + i);
      } else {
        emitOut(sB, b1, t1, true, face + i);
        emitOut(sB, t1, sT, true, face + i);
        emitOut(b0, sB, sT, false, face + i);
        emitOut(b0, sT, t0, false, face + i);
      }
    }
  };
  emitBand(foot, waist, 0);
  emitBand(waist, crownTop, 10);

  const mean = (pts: Vec[]): Vec => {
    const m: Vec = [0, 0, 0];
    for (const v of pts) {
      m[0] += v[0];
      m[1] += v[1];
      m[2] += v[2];
    }
    return [m[0] / sides, m[1] / sides, m[2] / sides];
  };
  const topMid = mean(crownTop);
  const botMid = mean(foot);
  for (let i = 0; i < sides; i++) {
    const n = (i + 1) % sides;
    emitOut(topMid, crownTop[i], crownTop[n], false, 20 + i);
    emitOut(botMid, foot[n], foot[i], false, 40 + i);
  }
}

type Vec = [number, number, number];

/** Half-width of the crack. Wide enough to read, narrow enough to stay a line. */
const RIFT_HALF = 0.13;

function lerpV(a: number[], b: number[], t: number): Vec {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t
  ];
}

/** Keep the part of a polygon on one side of an X or Z plane. Order stays wound. */
function clipAxis(poly: Vec[], axis: 0 | 2, plane: number, keep: 'lo' | 'hi'): Vec[] {
  const out: Vec[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const da = a[axis] - plane;
    const db = b[axis] - plane;
    const aIn = keep === 'lo' ? da <= 0 : da >= 0;
    const bIn = keep === 'lo' ? db <= 0 : db >= 0;
    if (aIn) out.push(a);
    if (aIn !== bIn) {
      const t = da / (da - db);
      out.push(lerpV(a, b, t));
    }
  }
  return out;
}

function sliceBand(poly: Vec[], axis: 0 | 2, half: number): { lo: Vec[]; mid: Vec[]; hi: Vec[] } {
  const rest = clipAxis(poly, axis, -half, 'hi');
  return {
    lo: clipAxis(poly, axis, -half, 'lo'),
    mid: clipAxis(rest, axis, half, 'lo'),
    hi: clipAxis(rest, axis, half, 'hi')
  };
}

function fan(poly: Vec[]): Vec[][] {
  const tris: Vec[][] = [];
  for (let i = 1; i < poly.length - 1; i++) tris.push([poly[0], poly[i], poly[i + 1]]);
  return tris;
}

/**
 * The crack is the strip of this face that crosses local Z = 0.
 * A cross adds the strip across local X = 0. Boundary verts drop with
 * the strip, so both lines sit in the stone.
 */
function emitRift(
  acc: Acc, origin: number[], a: number[], b: number[], c: number[],
  depth: number, face: number, cross: boolean, half = RIFT_HALF, gem = false
): void {
  const poly: Vec[] = [
    [a[0], a[1], a[2]],
    [b[0], b[1], b[2]],
    [c[0], c[1], c[2]]
  ];
  const place = (v: Vec): Vec => {
    const onZ = Math.abs(v[2]) <= half + 1e-3;
    const onX = cross && Math.abs(v[0]) <= half + 1e-3;
    const y = onZ || onX ? v[1] - depth * 0.4 * Math.max(0, v[1]) : v[1];
    return [origin[0] + v[0], origin[1] + y, origin[2] + v[2]];
  };
  const paint = (parts: Vec[][], seam: boolean) => {
    for (const tri of parts) {
      const pa = place(tri[0]);
      const pb = place(tri[1]);
      const pc = place(tri[2]);
      emitFace(acc, [0, 0, 0], pa, pb, pc, seam, face, gem);
    }
  };
  const z = sliceBand(poly, 2, half);
  if (!cross) {
    paint(fan(z.lo), false);
    paint(fan(z.hi), false);
    paint(fan(z.mid), true);
    return;
  }
  for (const part of [z.lo, z.mid, z.hi]) {
    const x = sliceBand(part, 0, half);
    const onZ = part === z.mid;
    paint(fan(x.lo), onZ);
    paint(fan(x.hi), onZ);
    paint(fan(x.mid), true);
  }
}

function emitFace(
  acc: Acc, origin: number[], a: number[], b: number[], c: number[],
  seam: boolean, face: number, gem = false
): void {
  const ax = b[0] - a[0];
  const ay = b[1] - a[1];
  const az = b[2] - a[2];
  const bx = c[0] - a[0];
  const by = c[1] - a[1];
  const bz = c[2] - a[2];
  const ny = az * bx - ax * bz;
  const len = Math.hypot(ay * bz - az * by, ny, ax * by - ay * bx) || 1;
  const pa = [origin[0] + a[0], origin[1] + a[1], origin[2] + a[2]];
  const pb = [origin[0] + b[0], origin[1] + b[1], origin[2] + b[2]];
  const pc = [origin[0] + c[0], origin[1] + c[1], origin[2] + c[2]];
  pushTri(acc, pa, pb, pc, rockColor(ny / len, seam, face, gem));
}

let seamGlow = VOID_RIM;

function rockColor(ny: number, seam: boolean, face: number, gem = false): number {
  if (seam) return seamGlow;
  if (gem) {
    if (ny > 0.4) return VOID_STONE.highlight;
    if (ny < -0.25) return VOID_STONE.violet;
    return face % 2 === 0 ? VOID_STONE.lit : VOID_STONE.highlight;
  }
  if (ny > 0.55) return VOID_STONE.highlight;
  if (ny > 0.12) return VOID_STONE.lit;
  if (ny < -0.4) return VOID_STONE.midnight;
  return face % 2 === 0 ? VOID_STONE.face : VOID_STONE.violet;
}

function pushChunk(acc: Acc, origin: number[], chunk: Chunk, index: number): void {
  const st = Math.sin(chunk.tilt);
  const ct = Math.cos(chunk.tilt);
  const sy = Math.sin(chunk.yaw);
  const cy = Math.cos(chunk.yaw);
  const v = norm([st * sy, ct, st * cy]);
  const u = norm([cy, 0, -sy]);
  const w = norm(cross(u, v));
  const center = [
    origin[0] + chunk.at[0],
    origin[1] + chunk.at[1],
    origin[2] + chunk.at[2]
  ];
  const [hu, hv, hw] = chunk.size;
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
    const hex = rockColor(face.n[1], chunk.seam, index);
    const [a, b, c, d] = face.q;
    pushTri(acc, a, b, c, hex);
    pushTri(acc, a, c, d, hex);
  }
}

/**
 * Upside-down mountain: a broad broken top, a sloping body with bites
 * in the outline, and one main point underneath plus a few shorter jags.
 */
function pushInvert(acc: Acc, origin: number[], hull: IslandHull): void {
  const rng = mulberry(hull.seed);
  const [rx, thick, rz] = hull.span;
  const n = 8;
  const top: number[][] = [];
  const mid: number[][] = [];
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 + (rng() - 0.5) * 0.85;
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    let rad = 0.55 + rng() * 0.7;
    if (i % 3 === 0) rad *= 1.4;
    if (i % 3 === 1) rad *= 0.5;
    const x = c * rx * rad;
    const z = s * rz * rad;
    top.push([x, thick * (0.4 + rng() * 0.85), z]);
    const bulge = i % 2 === 0;
    const scale = bulge ? 1.25 + rng() * 0.4 : 0.22 + rng() * 0.2;
    mid.push([
      x * scale,
      bulge ? -thick * (0.4 + rng() * 1.6) : thick * 0.15 - rng() * 0.2,
      z * scale
    ]);
  }
  const tip = [(rng() - 0.5) * 0.55, -hull.fangs, (rng() - 0.5) * 0.4];
  const jags: Array<number[] | null> = mid.map((v, i) => {
    if (i % 3 !== 0) return null;
    return [v[0] * (1.05 + rng() * 0.25), v[1] - hull.fangs * (0.35 + rng() * 0.45), v[2] * (1.05 + rng() * 0.25)];
  });
  const emitOut = (a: number[], b: number[], c: number[], face: number) => {
    const ax = b[0] - a[0];
    const ay = b[1] - a[1];
    const az = b[2] - a[2];
    const bx = c[0] - a[0];
    const by = c[1] - a[1];
    const bz = c[2] - a[2];
    const nx = ay * bz - az * by;
    const ny = az * bx - ax * bz;
    const nz = ax * by - ay * bx;
    const mx = (a[0] + b[0] + c[0]) / 3;
    const my = (a[1] + b[1] + c[1]) / 3;
    const mz = (a[2] + b[2] + c[2]) / 3;
    if (nx * mx + ny * my + nz * mz < 0) emitFace(acc, origin, a, c, b, false, face);
    else emitFace(acc, origin, a, b, c, false, face);
  };
  const crown = [0, thick * 0.85, 0];
  for (let i = 0; i < n; i++) emitOut(crown, top[i], top[(i + 1) % n], i);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    emitOut(top[i], mid[i], mid[j], i + 20);
    emitOut(top[i], mid[j], top[j], i + 40);
    const jag = jags[i];
    if (jag) {
      emitOut(mid[i], jag, mid[j], i + 60);
      emitOut(jag, tip, mid[j], i + 80);
    } else {
      emitOut(mid[i], tip, mid[j], i + 60);
    }
  }
  if (hull.crown) pushCrown(acc, origin, hull.crown);
  for (const extra of hull.crowns ?? []) pushCrown(acc, origin, extra);
}

/**
 * A flat faceted top, sides that taper in, and a jagged underside of
 * points that hang at different lengths. The long axis narrows toward -X.
 */
function pushDownRock(acc: Acc, origin: number[], hull: IslandHull): void {
  const rng = mulberry(hull.seed);
  const [rx, thick, rz] = hull.span;
  const n = rx > 2 ? 9 : 7;
  const top: number[][] = [];
  const waist: number[][] = [];
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 + (rng() - 0.5) * 0.55;
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    const taper = c < -0.2 ? 0.42 + rng() * 0.12 : 0.82 + rng() * 0.28;
    const x = c * rx * taper;
    const z = s * rz * (0.7 + rng() * 0.4);
    top.push([x, thick * (0.9 + rng() * 0.16), z]);
    const inset = 0.7 + rng() * 0.08;
    waist.push([x * inset, -thick * 0.35, z * inset]);
  }
  const emitOut = (a: number[], b: number[], c: number[], face: number) => {
    const ax = b[0] - a[0];
    const ay = b[1] - a[1];
    const az = b[2] - a[2];
    const bx = c[0] - a[0];
    const by = c[1] - a[1];
    const bz = c[2] - a[2];
    const nx = ay * bz - az * by;
    const ny = az * bx - ax * bz;
    const nz = ax * by - ay * bx;
    const mx = (a[0] + b[0] + c[0]) / 3;
    const my = (a[1] + b[1] + c[1]) / 3;
    const mz = (a[2] + b[2] + c[2]) / 3;
    if (nx * mx + ny * my + nz * mz < 0) emitFace(acc, origin, a, c, b, false, face);
    else emitFace(acc, origin, a, b, c, false, face);
  };
  const crown = [0, thick, 0];
  for (let i = 0; i < n; i++) emitOut(crown, top[i], top[(i + 1) % n], i);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    emitOut(top[i], waist[i], waist[j], i + 20);
    emitOut(top[i], waist[j], top[j], i + 40);
  }
  const drops = rx > 2
    ? [1, 0.28, 0.72, 0.18, 1.15, 0.4, 0.85, 0.22, 0.6]
    : [1, 0.3, 0.78, 0.2, 1.05, 0.42, 0.66];
  const tips: number[][] = [];
  for (let i = 0; i < n; i++) {
    const k = drops[i % drops.length];
    const deep = k > 0.55;
    const pull = deep ? 0.82 + rng() * 0.28 : 0.5 + rng() * 0.1;
    tips.push([
      waist[i][0] * pull + (rng() - 0.5) * 0.15,
      waist[i][1] - hull.fangs * k,
      waist[i][2] * pull + (rng() - 0.5) * 0.12
    ]);
  }
  const belly: number[] = [0, 0, 0];
  for (const tip of tips) {
    belly[0] += tip[0];
    belly[1] += tip[1];
    belly[2] += tip[2];
  }
  belly[0] /= n;
  belly[1] = belly[1] / n + hull.fangs * 0.22;
  belly[2] /= n;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    emitOut(waist[i], tips[i], waist[j], i + 60);
    emitOut(waist[j], tips[i], tips[j], i + 80);
    emitOut(tips[i], tips[j], belly, i + 100);
  }
  if (hull.crown) pushCrown(acc, origin, hull.crown);
  for (const extra of hull.crowns ?? []) pushCrown(acc, origin, extra);
}

/** Built on +X, then mirrored. The monolith and the crack travel with the rock. */
export function buildIslandVariation(spec: IslandVariation, side: 1 | -1): BufferGeometry {
  const acc: Acc = { pos: [], col: [] };
  const origin = [spec.distance, spec.y, spec.z];
  if (spec.family === 'point' && spec.hull?.invert) pushInvert(acc, origin, spec.hull);
  else if (spec.family === 'point' && spec.hull) pushDownRock(acc, origin, spec.hull);
  else if (spec.hull) pushHull(acc, origin, spec.hull);
  else spec.chunks.forEach((chunk, i) => pushChunk(acc, origin, chunk, i));
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

/** One finished island per live segment, opposite the planet, cycling the set. */
export function buildVoidIslandSegments(seed: number, count: number): BufferGeometry[] {
  const start = seed % VOID_ISLANDS.length;
  const geos: BufferGeometry[] = [];
  for (let k = 0; k < count; k++) {
    const side: 1 | -1 = k % 2 === 0 ? -1 : 1;
    geos.push(buildIslandVariation(VOID_ISLANDS[(start + k) % VOID_ISLANDS.length], side));
  }
  return geos;
}

export function islandStaysBeside(geo: BufferGeometry): boolean {
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    if (Math.abs(pos.getX(i)) < VOID_PLAY_HALF_X) return false;
  }
  return true;
}
