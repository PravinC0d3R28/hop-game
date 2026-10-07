/**
 * Ringed planets. One finished piece beside the path: a dark faceted ball,
 * or three small balls, and one or two rings. Broken rings carry their chips.
 * One planet is three balls inside a single complete ring. The rings are
 * tilted so the circle reads from this camera.
 */
import { BufferGeometry, Float32BufferAttribute, IcosahedronGeometry } from 'three';
import { VOID_RIM, VOID_RIM_VIOLET, VOID_STONE } from './VoidPalette';
import { VOID_PLAY_HALF_X } from './VoidGates';
import { voidCameraFrame } from './VoidSky';

export interface PlanetGap {
  at: number;
  width: number;
  /** Cyan on this break. Most gaps stay dark stone. */
  glow?: boolean;
}

export interface PlanetRing {
  inner: number;
  thick: number;
  depth: number;
  segments: number;
  /** 0 faces the camera. Larger values turn the ring into an ellipse. */
  tilt: number;
  roll: number;
  rim: number;
  gaps: PlanetGap[];
  /** A faceted band. The other planets stay on the older build until their turn. */
  solid?: boolean;
  /** Cyan drawn on the inner and outer edge of the tube, cut at the gaps. */
  lip?: boolean;
}

export interface PlanetBall {
  /** Offset from the ring centre. X is mirrored with the side. */
  x: number;
  y: number;
  z: number;
  r: number;
}

export interface PlanetVariation {
  id: string;
  ball: number;
  y: number;
  z: number;
  /** Distance from the path centre. The sign is applied per side. */
  distance: number;
  rings: PlanetRing[];
  /** A violet crack in the ball. Only a couple of planets carry one. */
  crack?: { n: number[]; shift: number; color?: number };
  /** When set, these balls replace the single centre ball. */
  cluster?: PlanetBall[];
}

/** Four finished planets. Gaps are part of the design, not added at spawn. */
const RIM = 0x8fb8d6;

export const VOID_PLANETS: PlanetVariation[] = [
  {
    id: 'planet-wide',
    ball: 3.35,
    y: -0.4,
    z: 44,
    distance: 14.6,
    crack: { n: [0.72, 0.16, 0.67], shift: -0.12, color: 0xe7f1ff },
    rings: [
      {
        inner: 5.55,
        thick: 1.7,
        depth: 1.15,
        segments: 12,
        tilt: 0.58,
        roll: 0.18,
        rim: RIM,
        solid: true,
        gaps: [
          { at: 0.45, width: 0.78 },
          { at: 3.55, width: 0.62, glow: true }
        ]
      }
    ]
  },
  {
    id: 'planet-twin',
    ball: 2.7,
    y: 0.2,
    z: 44,
    distance: 13.4,
    crack: { n: [0.18, 0.9, 0.4], shift: 0.16 },
    rings: [
      {
        inner: 4.15,
        thick: 1.2,
        depth: 0.9,
        segments: 14,
        tilt: 0.48,
        roll: 0.3,
        rim: RIM,
        solid: true,
        gaps: [{ at: 0.9, width: 0.72 }]
      },
      {
        inner: 5.7,
        thick: 1.35,
        depth: 0.95,
        segments: 12,
        tilt: 0.78,
        roll: -0.45,
        rim: RIM,
        solid: true,
        gaps: [
          { at: 2.4, width: 0.58 },
          { at: 4.7, width: 0.54, glow: true }
        ]
      }
    ]
  },
  {
    id: 'planet-heavy',
    ball: 4.05,
    y: -0.7,
    z: 44,
    distance: 17.4,
    rings: [
      {
        inner: 7.05,
        thick: 2.05,
        depth: 1.45,
        segments: 10,
        tilt: Math.PI / 2,
        roll: Math.PI / 2,
        rim: RIM,
        solid: true,
        gaps: [
          { at: 1.15, width: 0.82, glow: true },
          { at: 4.15, width: 0.6 }
        ]
      }
    ]
  },
  {
    id: 'planet-three',
    ball: 1.1,
    y: 0.55,
    z: 44,
    distance: 13.6,
    cluster: [
      { x: 0.1, y: 1.45, z: -0.15, r: 1.1 },
      { x: -0.16, y: -0.9, z: -1.2, r: 0.9 },
      { x: 0.06, y: -0.7, z: 1.25, r: 0.98 }
    ],
    rings: [
      {
        inner: 3.7,
        thick: 1.2,
        depth: 0.9,
        segments: 16,
        tilt: Math.PI / 2,
        roll: Math.PI / 2,
        rim: RIM,
        solid: true,
        gaps: []
      }
    ]
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

function angDist(a: number, b: number): number {
  let d = Math.abs(a - b) % (Math.PI * 2);
  if (d > Math.PI) d = Math.PI * 2 - d;
  return d;
}

function pushBox(
  acc: Acc,
  center: number[],
  u: number[], v: number[], w: number[],
  hu: number, hv: number, hw: number,
  colorOf: (ny: number, out: number) => number
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
    const hex = colorOf(face.n[1], face.n[0] * v[0] + face.n[1] * v[1] + face.n[2] * v[2]);
    const [a, b, c, d] = face.q;
    pushTri(acc, a, b, c, hex);
    pushTri(acc, a, c, d, hex);
  }
}

const SUN = norm([-8, 22, 12]);

function ballColor(n: number[], face: number): number {
  const lit = n[0] * SUN[0] + n[1] * SUN[1] + n[2] * SUN[2];
  if (face % 11 === 0) return VOID_STONE.violet;
  if (lit > 0.55) return VOID_STONE.highlight;
  if (lit > 0.2) return VOID_STONE.lit;
  if (lit > -0.15) return VOID_STONE.face;
  if (lit > -0.45) return VOID_STONE.midnight;
  return VOID_STONE.shadow;
}

function pushBall(acc: Acc, center: number[], radius: number, crack?: { n: number[]; shift: number; color?: number }): void {
  const ico = new IcosahedronGeometry(radius, 1);
  const pos = ico.getAttribute('position');
  const nrm = crack ? norm(crack.n) : null;
  const shift = crack ? crack.shift * radius : 0;
  const half = radius * 0.055;
  const signed = (p: number[]): number => (nrm ? p[0] * nrm[0] + p[1] * nrm[1] + p[2] * nrm[2] - shift : 0);
  const clip = (poly: number[][], limit: number, keep: 'lo' | 'hi'): number[][] => {
    const out: number[][] = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const da = signed(a);
      const db = signed(b);
      const aIn = keep === 'lo' ? da <= limit : da >= limit;
      const bIn = keep === 'lo' ? db <= limit : db >= limit;
      if (aIn) out.push(a);
      if (aIn !== bIn && da !== db) {
        const t = (limit - da) / (db - da);
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
      }
    }
    return out;
  };
  const place = (v: number[]): number[] => {
    let p = v;
    if (nrm && Math.abs(signed(v)) <= half + 1e-4) {
      const k = 0.93;
      p = [v[0] * k, v[1] * k, v[2] * k];
    }
    return [center[0] + p[0], center[1] + p[1], center[2] + p[2]];
  };
  const fan = (poly: number[][], seam: boolean, face: number): void => {
    for (let i = 1; i < poly.length - 1; i++) {
      const a = place(poly[0]);
      const b = place(poly[i]);
      const c = place(poly[i + 1]);
      const n = norm(cross(
        [b[0] - a[0], b[1] - a[1], b[2] - a[2]],
        [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
      ));
      pushTri(acc, a, b, c, seam ? (crack?.color ?? VOID_RIM_VIOLET) : ballColor(n, face));
    }
  };
  for (let i = 0; i < pos.count; i += 3) {
    const tri = [
      [pos.getX(i), pos.getY(i), pos.getZ(i)],
      [pos.getX(i + 1), pos.getY(i + 1), pos.getZ(i + 1)],
      [pos.getX(i + 2), pos.getY(i + 2), pos.getZ(i + 2)]
    ];
    if (!nrm) {
      const a = place(tri[0]);
      const b = place(tri[1]);
      const c = place(tri[2]);
      const n = norm(cross(
        [b[0] - a[0], b[1] - a[1], b[2] - a[2]],
        [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
      ));
      pushTri(acc, a, b, c, ballColor(n, i / 3));
      continue;
    }
    const rest = clip(tri, -half, 'hi');
    fan(clip(tri, -half, 'lo'), false, i / 3);
    fan(clip(rest, half, 'lo'), true, i / 3);
    fan(clip(rest, half, 'hi'), false, i / 3);
  }
  ico.dispose();
}

function ringFrame(tilt: number, roll: number): { normal: number[]; axis: number[]; bit: number[] } {
  const frame = voidCameraFrame();
  const F = [frame.forward.x, frame.forward.y, frame.forward.z];
  const R = [frame.right.x, frame.right.y, frame.right.z];
  const U = [frame.up.x, frame.up.y, frame.up.z];
  const normal = norm([
    F[0] * Math.cos(tilt) + U[0] * Math.sin(tilt) * Math.cos(roll) + R[0] * Math.sin(tilt) * Math.sin(roll),
    F[1] * Math.cos(tilt) + U[1] * Math.sin(tilt) * Math.cos(roll) + R[1] * Math.sin(tilt) * Math.sin(roll),
    F[2] * Math.cos(tilt) + U[2] * Math.sin(tilt) * Math.cos(roll) + R[2] * Math.sin(tilt) * Math.sin(roll)
  ]);
  let axis = cross(normal, U);
  if (Math.hypot(axis[0], axis[1], axis[2]) < 0.25) axis = cross(normal, R);
  axis = norm(axis);
  const bit = norm(cross(normal, axis));
  return { normal, axis, bit };
}

function ringColor(ny: number, facingOut: number): number {
  if (ny > 0.5) return VOID_STONE.lit;
  if (ny < -0.5) return VOID_STONE.shadow;
  if (facingOut > 0.4) return VOID_STONE.highlight;
  if (facingOut < -0.4) return VOID_STONE.midnight;
  return VOID_STONE.face;
}

type Vec = number[];

function pushSolidPlanetRing(acc: Acc, origin: number[], ring: PlanetRing): void {
  const { normal, axis, bit } = ringFrame(ring.tilt, ring.roll);
  const steps = 20;
  const step = (Math.PI * 2) / steps;
  const sides = 5;
  const radii = [1, 0.9, 1.12, 0.86, 1.04];
  const outwardAt = (theta: number): Vec => norm([
    axis[0] * Math.cos(theta) + bit[0] * Math.sin(theta),
    axis[1] * Math.cos(theta) + bit[1] * Math.sin(theta),
    axis[2] * Math.cos(theta) + bit[2] * Math.sin(theta)
  ]);
  const tangentAt = (theta: number): Vec => norm([
    -axis[0] * Math.sin(theta) + bit[0] * Math.cos(theta),
    -axis[1] * Math.sin(theta) + bit[1] * Math.cos(theta),
    -axis[2] * Math.sin(theta) + bit[2] * Math.cos(theta)
  ]);
  const open = (theta: number): boolean =>
    ring.gaps.some((gap) => angDist(theta, gap.at) < gap.width * 0.5);
  const kept = (i: number): boolean => !open(((i % steps) + steps) % steps * step + step * 0.5);
  const station = (index: number): Vec[] => {
    const theta = (index + 0.5) * step;
    const outward = outwardAt(theta);
    const center = add(origin, outward, ring.inner + ring.thick * 0.5);
    const pts: Vec[] = [];
    for (let k = 0; k < sides; k++) {
      const a = Math.PI + (k / sides) * Math.PI * 2;
      const r = radii[k];
      pts.push(add(
        add(center, outward, Math.cos(a) * ring.thick * 0.5 * r),
        normal,
        Math.sin(a) * ring.depth * 0.5 * r
      ));
    }
    return pts;
  };
  const hubOf = (pts: Vec[]): Vec => {
    const h = [0, 0, 0];
    for (const p of pts) {
      h[0] += p[0];
      h[1] += p[1];
      h[2] += p[2];
    }
    return [h[0] / pts.length, h[1] / pts.length, h[2] / pts.length];
  };
  const stone = (ny: number): number => {
    if (ny > 0.45) return VOID_STONE.highlight;
    if (ny > 0.1) return VOID_STONE.lit;
    if (ny < -0.35) return VOID_STONE.midnight;
    return VOID_STONE.face;
  };
  const emit = (a: Vec, b: Vec, c: Vec, hub: Vec, hex: number | null): void => {
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
    const out = nx * (mid[0] - hub[0]) + ny * (mid[1] - hub[1]) + nz * (mid[2] - hub[2]) >= 0;
    const len = Math.hypot(nx, ny, nz) || 1;
    pushTri(acc, a, out ? b : c, out ? c : b, hex ?? stone((out ? ny : -ny) / len));
  };
  const cap = (pts: Vec[], dir: Vec, glow: boolean): void => {
    const hub = hubOf(pts);
    for (let k = 0; k < sides; k++) {
      emit(hub, pts[k], pts[(k + 1) % sides], add(hub, dir, -1), glow ? VOID_RIM : null);
    }
  };
  for (let i = 0; i < steps; i++) {
    if (!kept(i)) continue;
    const theta = (i + 0.5) * step;
    const ringPts = station(i);
    const hub = hubOf(ringPts);
    const next = (i + 1) % steps;
    if (kept(next)) {
      const other = station(next);
      for (let k = 0; k < sides; k++) {
        const n = (k + 1) % sides;
        emit(ringPts[k], other[k], other[n], hub, null);
        emit(ringPts[k], other[n], ringPts[n], hub, null);
      }
    } else {
      cap(ringPts, tangentAt(theta), false);
    }
    if (!kept(i - 1)) cap(ringPts, tangentAt(theta).map((v) => -v), false);
  }
  const section = (at: number, outShift: number, scale: number, bite: boolean): Vec[] => {
    const outward = outwardAt(at);
    const tangent = tangentAt(at);
    const center = add(origin, outward, ring.inner + ring.thick * 0.5 + outShift);
    const pts: Vec[] = [];
    for (let k = 0; k < sides; k++) {
      const a = Math.PI + (k / sides) * Math.PI * 2;
      let r = radii[k] * scale;
      if (bite && (k === 1 || k === 3)) r *= 0.48;
      let p = add(
        add(center, outward, Math.cos(a) * ring.thick * 0.5 * r),
        normal,
        Math.sin(a) * ring.depth * 0.5 * r
      );
      if (bite && k === 2) p = add(p, tangent, ring.thick * 0.35);
      pts.push(p);
    }
    return pts;
  };
  for (let gi = 0; gi < ring.gaps.length; gi++) {
    const gap = ring.gaps[gi];
    const blunt = gap.glow !== true && gi % 2 === 0;
    const span = Math.min(0.2, gap.width * 0.32);
    const a = section(gap.at - span * 0.5, ring.thick * 0.15, blunt ? 0.9 : 0.96, false);
    const b = section(
      gap.at + span * 0.5,
      ring.thick * (blunt ? 0.35 : 0.65),
      blunt ? 0.76 : 0.55,
      true
    );
    const hub = hubOf(a);
    for (let k = 0; k < sides; k++) {
      const n = (k + 1) % sides;
      emit(a[k], b[k], b[n], hub, null);
      emit(a[k], b[n], a[n], hub, null);
    }
    cap(a, tangentAt(gap.at).map((v) => -v), false);
    cap(b, tangentAt(gap.at), gap.glow === true);
  }
  if (ring.lip) {
    const mix = (p: Vec, q: Vec, t: number): Vec => [
      p[0] + (q[0] - p[0]) * t,
      p[1] + (q[1] - p[1]) * t,
      p[2] + (q[2] - p[2]) * t
    ];
    const nudge = (p: Vec, from: Vec, dist: number): Vec => {
      const d = [p[0] - from[0], p[1] - from[1], p[2] - from[2]];
      const len = Math.hypot(d[0], d[1], d[2]) || 1;
      return [p[0] + (d[0] / len) * dist, p[1] + (d[1] / len) * dist, p[2] + (d[2] / len) * dist];
    };
    const paint = (ia: number, ib: number): void => {
      for (let i = 0; i < steps; i++) {
        const next = (i + 1) % steps;
        if (!kept(i) || !kept(next)) continue;
        const A = station(i);
        const B = station(next);
        const pair = (pts: Vec[], hub: Vec): [Vec, Vec] => {
          const mid = mix(pts[ia], pts[ib], 0.5);
          const skin = nudge(mid, hub, 0.028);
          const onto = nudge(mix(mid, hub, 0.22), hub, 0.028);
          return [skin, onto];
        };
        const [a0, a1] = pair(A, hubOf(A));
        const [b0, b1] = pair(B, hubOf(B));
        pushTri(acc, a0, b0, b1, VOID_RIM);
        pushTri(acc, a0, b1, a1, VOID_RIM);
        pushTri(acc, a0, b1, b0, VOID_RIM);
        pushTri(acc, a0, a1, b1, VOID_RIM);
      }
    };
    paint(0, 0);
    paint(2, 3);
  }
}

function pushRing(acc: Acc, origin: number[], ring: PlanetRing): void {
  const { normal, axis, bit } = ringFrame(ring.tilt, ring.roll);
  const step = (Math.PI * 2) / ring.segments;
  const outwardAt = (theta: number): number[] => norm([
    axis[0] * Math.cos(theta) + bit[0] * Math.sin(theta),
    axis[1] * Math.cos(theta) + bit[1] * Math.sin(theta),
    axis[2] * Math.cos(theta) + bit[2] * Math.sin(theta)
  ]);
  const tangentAt = (theta: number): number[] => norm([
    -axis[0] * Math.sin(theta) + bit[0] * Math.cos(theta),
    -axis[1] * Math.sin(theta) + bit[1] * Math.cos(theta),
    -axis[2] * Math.sin(theta) + bit[2] * Math.cos(theta)
  ]);

  for (let i = 0; i < ring.segments; i++) {
    const theta = (i + 0.5) * step;
    const missing = ring.gaps.some((gap) => angDist(theta, gap.at) < gap.width * 0.5 + step * 0.1);
    if (missing) continue;
    const mid = ring.inner + ring.thick * 0.5;
    const outward = outwardAt(theta);
    const tangent = tangentAt(theta);
    const center = add(origin, outward, mid);
    const halfArc = mid * Math.tan(step * 0.5) * 0.96;
    pushBox(
      acc, center, tangent, outward, normal,
      halfArc, ring.thick * 0.5, ring.depth * 0.5,
      (ny, out) => ringColor(ny, out)
    );
    pushBox(
      acc, add(center, outward, -(ring.thick * 0.5 + 0.05)), tangent, outward, normal,
      halfArc * 0.92, 0.045, ring.depth * 0.28,
      () => ring.rim
    );
  }

  for (const gap of ring.gaps) {
    const outward = outwardAt(gap.at);
    const tangent = tangentAt(gap.at);
    const chips = [
      { along: gap.width * ring.inner * 0.22, out: ring.inner + ring.thick + 0.55, s: 0.38 },
      { along: -gap.width * ring.inner * 0.16, out: ring.inner + ring.thick * 0.2, s: 0.26 }
    ];
    for (const chip of chips) {
      const center = add(add(origin, outward, chip.out), tangent, chip.along);
      pushBox(
        acc, center, tangent, outward, normal,
        chip.s, chip.s * 0.75, chip.s * 0.6,
        (ny) => (ny > 0.3 ? VOID_STONE.lit : VOID_STONE.shadow)
      );
    }
  }
}

/** `side` is +1 or -1. The whole planet, rings, and chips stay on that side. */
export function buildPlanetVariation(spec: PlanetVariation, side: 1 | -1): BufferGeometry {
  const acc: Acc = { pos: [], col: [] };
  const origin = [side * spec.distance, spec.y, spec.z];
  if (spec.cluster) {
    for (const ball of spec.cluster) {
      pushBall(acc, [origin[0] + side * ball.x, origin[1] + ball.y, origin[2] + ball.z], ball.r);
    }
  } else {
    pushBall(acc, origin, spec.ball, spec.crack);
  }
  for (const ring of spec.rings) {
    if (ring.solid) pushSolidPlanetRing(acc, origin, ring);
    else pushRing(acc, origin, ring);
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(acc.pos, 3));
  geo.setAttribute('color', new Float32BufferAttribute(acc.col, 3));
  return geo;
}

/** One planet per live segment, alternating sides, cycling the four designs. */
export function buildVoidPlanetSegments(seed: number, count: number): BufferGeometry[] {
  const start = seed % VOID_PLANETS.length;
  const geos: BufferGeometry[] = [];
  for (let k = 0; k < count; k++) {
    const side: 1 | -1 = k % 2 === 0 ? 1 : -1;
    geos.push(buildPlanetVariation(VOID_PLANETS[(start + k) % VOID_PLANETS.length], side));
  }
  return geos;
}

export interface OrbitVariation {
  id: string;
  kind: 'rock' | 'shaft';
  /** Ball radius, or the height of the shaft. */
  size: number;
  y: number;
  z: number;
  distance: number;
  ring: PlanetRing;
}

/** Three small rings. Each one already belongs to the rock or shaft inside it. */
export const VOID_ORBITS: OrbitVariation[] = [
  {
    id: 'orbit-rock',
    kind: 'rock',
    size: 1.4,
    y: 0.45,
    z: 22,
    distance: 12.4,
    ring: {
      inner: 2.9,
      thick: 0.55,
      depth: 0.48,
      segments: 16,
      tilt: 2.5,
      roll: 1.15,
      rim: RIM,
      solid: true,
      lip: true,
      gaps: [
        { at: 2.15, width: 0.7, glow: true },
        { at: 5.05, width: 0.55 }
      ]
    }
  },
  {
    id: 'orbit-shaft',
    kind: 'shaft',
    size: 4.4,
    y: -0.35,
    z: 22,
    distance: 14.2,
    ring: {
      inner: 1.85,
      thick: 0.5,
      depth: 0.42,
      segments: 16,
      tilt: 2.15,
      roll: 0.4,
      rim: RIM,
      solid: true,
      lip: true,
      gaps: [{ at: 0.85, width: 0.72, glow: true }]
    }
  },
  {
    id: 'orbit-pebble',
    kind: 'rock',
    size: 0.82,
    y: 0.95,
    z: 22,
    distance: 12.8,
    ring: {
      inner: 1.85,
      thick: 0.42,
      depth: 0.36,
      segments: 16,
      tilt: 2.2,
      roll: 1.35,
      rim: RIM,
      solid: true,
      lip: true,
      gaps: [
        { at: 0.55, width: 0.58 },
        { at: 2.7, width: 0.5, glow: true },
        { at: 4.6, width: 0.52 }
      ]
    }
  }
];

/** A faceted shaft. Returns the point the ring should circle. */
function pushOrbitShaft(acc: Acc, base: number[], height: number, side: 1 | -1): number[] {
  const sides = 6;
  const yaw = 0.52;
  const lean = 0.14 * side;
  const radii = [1, 0.88, 1.14, 0.82, 1.06, 0.92];
  const footR = 0.56;
  const tipR = 0.34;
  const ringAt = (y: number, scale: number, slant: number): Vec[] => {
    const pts: Vec[] = [];
    for (let i = 0; i < sides; i++) {
      const a = yaw + (i / sides) * Math.PI * 2;
      const r = scale * radii[i];
      const lx = Math.cos(a) * r + Math.sin(lean) * y;
      const ly = y * Math.cos(lean) + slant;
      const lz = Math.sin(a) * r * 0.92;
      pts.push([base[0] + lx, base[1] + ly, base[2] + lz]);
    }
    return pts;
  };
  const foot = ringAt(0.02, footR, 0);
  const waist = ringAt(height * 0.46, footR * 0.78, 0);
  const top = ringAt(height, tipR, height * 0.04);
  const hub = [0, 0, 0];
  const all = foot.concat(waist, top);
  for (const p of all) {
    hub[0] += p[0];
    hub[1] += p[1];
    hub[2] += p[2];
  }
  hub[0] /= all.length;
  hub[1] /= all.length;
  hub[2] /= all.length;
  const hex = (ny: number): number => {
    if (ny > 0.45) return VOID_STONE.highlight;
    if (ny > 0.08) return VOID_STONE.lit;
    if (ny < -0.35) return VOID_STONE.midnight;
    return VOID_STONE.face;
  };
  const emit = (a: Vec, b: Vec, c: Vec): void => {
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
    const out = nx * (mid[0] - hub[0]) + ny * (mid[1] - hub[1]) + nz * (mid[2] - hub[2]) >= 0;
    const len = Math.hypot(nx, ny, nz) || 1;
    pushTri(acc, a, out ? b : c, out ? c : b, hex((out ? ny : -ny) / len));
  };
  const band = (lower: Vec[], upper: Vec[]): void => {
    for (let i = 0; i < sides; i++) {
      const n = (i + 1) % sides;
      emit(lower[i], lower[n], upper[n]);
      emit(lower[i], upper[n], upper[i]);
    }
  };
  band(foot, waist);
  band(waist, top);
  const mean = (pts: Vec[]): Vec => {
    const m = [0, 0, 0];
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
    emit(cap, top[i], top[n]);
    emit(sole, foot[n], foot[i]);
  }
  return mean(waist);
}

function pushShaft(acc: Acc, base: number[], height: number): void {
  const slices = [
    { y: height * 0.22, h: height * 0.44, w: 0.58 },
    { y: height * 0.58, h: height * 0.3, w: 0.4 },
    { y: height * 0.86, h: height * 0.2, w: 0.24 }
  ];
  slices.forEach((slice, i) => {
    pushBox(
      acc,
      [base[0], base[1] + slice.y, base[2]],
      [1, 0, 0], [0, 1, 0], [0, 0, 1],
      slice.w, slice.h * 0.5, slice.w * 0.82,
      (ny) => {
        if (i === 2 && ny > 0.3) return VOID_STONE.lit;
        if (ny < -0.4) return VOID_STONE.shadow;
        return i === 1 ? VOID_STONE.face : VOID_STONE.midnight;
      }
    );
  });
}

export function buildOrbitVariation(spec: OrbitVariation, side: 1 | -1): BufferGeometry {
  const acc: Acc = { pos: [], col: [] };
  const x = side * spec.distance;
  if (spec.kind === 'rock') {
    const origin = [x, spec.y, spec.z];
    pushBall(acc, origin, spec.size);
    if (spec.ring.solid) pushSolidPlanetRing(acc, origin, spec.ring);
    else pushRing(acc, origin, spec.ring);
  } else {
    const base = [x, spec.y, spec.z];
    const around = pushOrbitShaft(acc, base, spec.size, side);
    if (spec.ring.solid) pushSolidPlanetRing(acc, around, spec.ring);
    else pushRing(acc, around, spec.ring);
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(acc.pos, 3));
  geo.setAttribute('color', new Float32BufferAttribute(acc.col, 3));
  return geo;
}

/** Opposite side from the planet in the same segment, so the two do not stack. */
export function buildVoidOrbitSegments(seed: number, count: number): BufferGeometry[] {
  const start = seed % VOID_ORBITS.length;
  const geos: BufferGeometry[] = [];
  for (let k = 0; k < count; k++) {
    const side: 1 | -1 = k % 2 === 0 ? -1 : 1;
    geos.push(buildOrbitVariation(VOID_ORBITS[(start + k) % VOID_ORBITS.length], side));
  }
  return geos;
}

/** Nothing of the planet crosses onto the hop corridor. */
export function planetStaysBeside(geo: BufferGeometry): boolean {
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    if (Math.abs(pos.getX(i)) < VOID_PLAY_HALF_X) return false;
  }
  return true;
}
