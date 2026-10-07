/**
 * Gate rings: one finished broken circle the tiles fly through.
 *
 * The circle stands upright on the path. The opening is the corridor.
 * At most three gaps, each wide enough to read, with a few chips beside them.
 * A variation is authored whole. Gameplay only places it.
 */
import { BufferGeometry, Float32BufferAttribute } from 'three';
import { VOID_RIM, VOID_RIM_VIOLET, VOID_STONE } from './VoidPalette';
import { voidCameraFrame } from './VoidSky';

/** Hop corridor the ring must not enter. Sides stay outside |x|; the arch is above and below. */
/** Tile edge plus sway and the ball, and the top of the jump arc. */
export const VOID_PLAY_HALF_X = 5.4;
export const VOID_PLAY_Y0 = -0.6;
export const VOID_PLAY_Y1 = 3.2;

export interface GateGap {
  /** Radians. 0 is world +X (screen left). */
  at: number;
  /** Full angular width. A real bite, not a hairline. */
  width: number;
  /** Cyan on one broken end. Most gaps stay dark stone. */
  glow?: boolean;
}

export interface GateVariation {
  id: string;
  inner: number;
  thick: number;
  depth: number;
  segments: number;
  centerY: number;
  /** How far along the segment the ring stands. */
  z: number;
  rim: number;
  gaps: GateGap[];
  /** A faceted band. The other gates stay on the older build until their turn. */
  solid?: boolean;
}

/** Four finished gates. Gaps are placed, not rolled at spawn. */
export const VOID_GATES: GateVariation[] = [
  {
    id: 'gate-break-right',
    inner: 9.2,
    thick: 3.4,
    depth: 2.9,
    segments: 18,
    centerY: -2.0,
    z: 88,
    rim: 0x8fb8d6,
    solid: true,
    gaps: [
      { at: Math.PI / 2, width: 1.95 },
      { at: 0.2, width: 0.62, glow: true },
      { at: 4.35, width: 0.7 }
    ]
  },
  {
    id: 'gate-wide-top',
    inner: 10.4,
    thick: 3.15,
    depth: 2.75,
    segments: 16,
    centerY: -2.4,
    z: 88,
    rim: VOID_RIM,
    solid: true,
    gaps: [{ at: Math.PI / 2, width: 2.1 }]
  },
  {
    id: 'gate-three',
    inner: 10.0,
    thick: 2.85,
    depth: 2.55,
    segments: 20,
    centerY: -2.5,
    z: 88,
    rim: VOID_RIM_VIOLET,
    solid: true,
    gaps: [
      { at: Math.PI / 2, width: 2.05 },
      { at: 5.8, width: 0.55 },
      { at: 4.2, width: 0.58 }
    ]
  },
  {
    id: 'gate-heavy',
    inner: 11.2,
    thick: 4.1,
    depth: 3.2,
    segments: 14,
    centerY: -2.6,
    z: 88,
    rim: 0x8fb8d6,
    solid: true,
    gaps: [
      { at: Math.PI / 2, width: 2.0 },
      { at: Math.PI, width: 0.74 },
      { at: 5.5, width: 0.66, glow: true }
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

/** A box. u, v, w are unit axes. Half-extents are along those axes. */
function pushBox(
  acc: Acc,
  center: number[],
  u: number[], v: number[], w: number[],
  hu: number, hv: number, hw: number,
  colorOf: (nx: number, ny: number, nz: number) => number
): void {
  const corner = (su: number, sv: number, sw: number): number[] =>
    add(add(add(center, u, su * hu), v, sv * hv), w, sw * hw);
  const faces: Array<{ n: number[]; quad: number[][] }> = [
    { n: u, quad: [corner(1, -1, -1), corner(1, 1, -1), corner(1, 1, 1), corner(1, -1, 1)] },
    { n: [-u[0], -u[1], -u[2]], quad: [corner(-1, -1, 1), corner(-1, 1, 1), corner(-1, 1, -1), corner(-1, -1, -1)] },
    { n: v, quad: [corner(-1, 1, -1), corner(1, 1, -1), corner(1, 1, 1), corner(-1, 1, 1)] },
    { n: [-v[0], -v[1], -v[2]], quad: [corner(-1, -1, 1), corner(1, -1, 1), corner(1, -1, -1), corner(-1, -1, -1)] },
    { n: w, quad: [corner(-1, -1, 1), corner(-1, 1, 1), corner(1, 1, 1), corner(1, -1, 1)] },
    { n: [-w[0], -w[1], -w[2]], quad: [corner(1, -1, -1), corner(1, 1, -1), corner(-1, 1, -1), corner(-1, -1, -1)] }
  ];
  for (const face of faces) {
    const hex = colorOf(face.n[0], face.n[1], face.n[2]);
    const [a, b, c, d] = face.quad;
    pushTri(acc, a, b, c, hex);
    pushTri(acc, a, c, d, hex);
  }
}

function angDist(a: number, b: number): number {
  let d = Math.abs(a - b) % (Math.PI * 2);
  if (d > Math.PI) d = Math.PI * 2 - d;
  return d;
}

function stoneColor(nx: number, ny: number, nz: number, outward: number[]): number {
  if (ny > 0.55) return VOID_STONE.lit;
  if (ny < -0.55) return VOID_STONE.shadow;
  const facingOut = nx * outward[0] + ny * outward[1] + nz * outward[2];
  if (facingOut > 0.45) return VOID_STONE.highlight;
  if (facingOut < -0.45) return VOID_STONE.midnight;
  if (Math.abs(nz) > 0.7) return VOID_STONE.violet;
  return VOID_STONE.face;
}

function chipColor(nx: number, ny: number): number {
  if (ny > 0.4) return VOID_STONE.lit;
  if (ny < -0.4) return VOID_STONE.shadow;
  return Math.abs(nx) > 0.5 ? VOID_STONE.face : VOID_STONE.midnight;
}

function bandColor(ny: number, facingOut: number): number {
  if (ny > 0.45) return VOID_STONE.highlight;
  if (facingOut > 0.5) return VOID_STONE.lit;
  if (ny < -0.35) return VOID_STONE.midnight;
  if (facingOut < -0.4) return VOID_STONE.violet;
  return VOID_STONE.face;
}

type Vec = number[];

function pushSolidRing(acc: Acc, spec: GateVariation): void {
  const frame = voidCameraFrame();
  const right = [frame.right.x, frame.right.y, frame.right.z];
  const up = [frame.up.x, frame.up.y, frame.up.z];
  const forward = [frame.forward.x, frame.forward.y, frame.forward.z];
  const origin = [0, spec.centerY, spec.z];
  const steps = 24;
  const step = (Math.PI * 2) / steps;
  const sides = 6;
  const radii = [1, 0.94, 1.08, 0.92, 1.04, 0.96];
  const radial = (theta: number): Vec => [
    right[0] * Math.cos(theta) + up[0] * Math.sin(theta),
    right[1] * Math.cos(theta) + up[1] * Math.sin(theta),
    right[2] * Math.cos(theta) + up[2] * Math.sin(theta)
  ];
  const tangentOf = (theta: number): Vec => [
    -right[0] * Math.sin(theta) + up[0] * Math.cos(theta),
    -right[1] * Math.sin(theta) + up[1] * Math.cos(theta),
    -right[2] * Math.sin(theta) + up[2] * Math.cos(theta)
  ];
  const open = (theta: number): boolean =>
    spec.gaps.some((gap) => angDist(theta, gap.at) < gap.width * 0.5);
  const solid = (i: number): boolean => !open((i + 0.5) * step);
  const station = (index: number): Vec[] => {
    const theta = (index + 0.5) * step;
    const wobble = 0.99 + (index % 4) * 0.012;
    const mid = (spec.inner + spec.thick * 0.5) * wobble;
    const outward = radial(theta);
    const center = add(origin, outward, mid);
    const ring: Vec[] = [];
    for (let k = 0; k < sides; k++) {
      const a = Math.PI + (k / sides) * Math.PI * 2;
      const r = radii[k];
      ring.push(
        add(
          add(center, outward, Math.cos(a) * spec.thick * 0.5 * r),
          forward,
          Math.sin(a) * spec.depth * 0.5 * r
        )
      );
    }
    return ring;
  };
  const hubOf = (ring: Vec[]): Vec => {
    const h = [0, 0, 0];
    for (const p of ring) {
      h[0] += p[0];
      h[1] += p[1];
      h[2] += p[2];
    }
    return [h[0] / ring.length, h[1] / ring.length, h[2] / ring.length];
  };
  const emit = (a: Vec, b: Vec, c: Vec, hub: Vec, seam: boolean, glow = false): void => {
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
    const hex = glow
      ? VOID_RIM
      : seam
        ? spec.rim
        : bandColor((outward ? ny : -ny) / len, (outward ? 1 : -1) * (nx * (mid[0] - hub[0]) + ny * (mid[1] - hub[1]) + nz * (mid[2] - hub[2])) / (len * (Math.hypot(mid[0] - hub[0], mid[1] - hub[1], mid[2] - hub[2]) || 1)));
    pushTri(acc, a, outward ? b : c, outward ? c : b, hex);
  };
  const inset = (edge: Vec, other: Vec): Vec => {
    const dx = other[0] - edge[0];
    const dy = other[1] - edge[1];
    const dz = other[2] - edge[2];
    const len = Math.hypot(dx, dy, dz) || 1;
    const k = Math.min(0.28, len * 0.34) / len;
    return [edge[0] + dx * k, edge[1] + dy * k, edge[2] + dz * k];
  };
  const cap = (ring: Vec[], dir: Vec, glow = false): void => {
    const hub = hubOf(ring);
    for (let k = 0; k < sides; k++) {
      const n = (k + 1) % sides;
      emit(hub, ring[k], ring[n], add(hub, dir, -1), false, glow);
    }
  };
  for (let i = 0; i < steps; i++) {
    if (!solid(i)) continue;
    const theta = (i + 0.5) * step;
    const ring = station(i);
    const hub = hubOf(ring);
    const next = (i + 1) % steps;
    if (solid(next)) {
      const other = station(next);
      for (let k = 0; k < sides; k++) {
        const n = (k + 1) % sides;
        if (k !== 5) {
          emit(ring[k], other[k], other[n], hub, false);
          emit(ring[k], other[n], ring[n], hub, false);
          continue;
        }
        const s0 = inset(ring[0], ring[5]);
        const s1 = inset(other[0], other[5]);
        emit(ring[0], other[0], s1, hub, true);
        emit(ring[0], s1, s0, hub, true);
        emit(s0, s1, other[5], hub, false);
        emit(s0, other[5], ring[5], hub, false);
      }
    } else {
      cap(ring, tangentOf(theta));
    }
    const prev = (i - 1 + steps) % steps;
    if (!solid(prev)) cap(ring, tangentOf(theta).map((v) => -v));
  }
  const section = (at: number, outShift: number, faceShift: number, scale: number, bite: boolean): Vec[] => {
    const mid = spec.inner + spec.thick * 0.5 + outShift;
    const outward = radial(at);
    const tangent = tangentOf(at);
    const center = add(add(origin, outward, mid), forward, faceShift);
    const ring: Vec[] = [];
    for (let k = 0; k < sides; k++) {
      const ang = Math.PI + (k / sides) * Math.PI * 2;
      let r = radii[k] * scale;
      if (bite && (k === 1 || k === 4)) r *= 0.46;
      let p = add(
        add(center, outward, Math.cos(ang) * spec.thick * 0.5 * r),
        forward,
        Math.sin(ang) * spec.depth * 0.5 * r
      );
      if (bite && k === 2) p = add(p, tangent, spec.thick * 0.26);
      ring.push(p);
    }
    return ring;
  };
  const placeChunk = (theta: number, outShift: number, faceShift: number, span: number, glow: boolean, blunt: boolean): void => {
    const a = section(theta - span * 0.5, outShift, faceShift, blunt ? 0.9 : 0.96, false);
    const b = section(
      theta + span * 0.5,
      outShift + (blunt ? 0.35 : 0.8),
      faceShift + (blunt ? 0.15 : 0.4),
      blunt ? 0.78 : 0.58,
      true
    );
    const hub = hubOf(a);
    for (let k = 0; k < sides; k++) {
      const n = (k + 1) % sides;
      emit(a[k], b[k], b[n], hub, false);
      emit(a[k], b[n], a[n], hub, false);
    }
    cap(a, tangentOf(theta).map((v) => -v));
    cap(b, tangentOf(theta), glow);
  };
  for (const gap of spec.gaps) {
    if (angDist(gap.at, Math.PI / 2) < 0.3) continue;
    if (spec.gaps.length > 2) {
      placeChunk(gap.at, 0.9, 0.5, 0.16, gap.glow === true, gap.glow !== true);
      continue;
    }
    placeChunk(gap.at - gap.width * 0.2, 1.35, 0.4, 0.18, gap.glow === true, false);
    placeChunk(gap.at + gap.width * 0.16, -0.25, 1.15, 0.14, false, true);
  }
}

/**
 * One authored gate. The circle faces the camera, so the whole ring stays in
 * frame instead of standing so tall that only the crown is visible. The path
 * still passes through the hole.
 */
export function buildGateVariation(spec: GateVariation): BufferGeometry {
  const acc: Acc = { pos: [], col: [] };
  if (spec.solid) {
    pushSolidRing(acc, spec);
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(acc.pos, 3));
    geo.setAttribute('color', new Float32BufferAttribute(acc.col, 3));
    return geo;
  }
  const frame = voidCameraFrame();
  const right = [frame.right.x, frame.right.y, frame.right.z];
  const up = [frame.up.x, frame.up.y, frame.up.z];
  const forward = [frame.forward.x, frame.forward.y, frame.forward.z];
  const origin = [0, spec.centerY, spec.z];
  const step = (Math.PI * 2) / spec.segments;
  const tilt = 0.28;

  const mix3 = (a: number[], b: number[], t: number): number[] => {
    const x = a[0] + b[0] * t;
    const y = a[1] + b[1] * t;
    const z = a[2] + b[2] * t;
    const len = Math.hypot(x, y, z) || 1;
    return [x / len, y / len, z / len];
  };
  const radial = (theta: number): number[] => [
    right[0] * Math.cos(theta) + up[0] * Math.sin(theta),
    right[1] * Math.cos(theta) + up[1] * Math.sin(theta),
    right[2] * Math.cos(theta) + up[2] * Math.sin(theta)
  ];
  const tangentOf = (theta: number): number[] => [
    -right[0] * Math.sin(theta) + up[0] * Math.cos(theta),
    -right[1] * Math.sin(theta) + up[1] * Math.cos(theta),
    -right[2] * Math.sin(theta) + up[2] * Math.cos(theta)
  ];

  for (let i = 0; i < spec.segments; i++) {
    const theta = (i + 0.5) * step;
    const blocked = spec.gaps.some((gap) => angDist(theta, gap.at) < gap.width * 0.5 + step * 0.12);
    if (blocked) continue;
    const mid = spec.inner + spec.thick * 0.5;
    const wobble = 0.9 + ((i * 3 + spec.segments) % 5) * 0.03;
    const outward = radial(theta);
    const tangent = tangentOf(theta);
    const face = mix3(forward, outward, -tilt);
    const out = mix3(outward, forward, tilt);
    const center = add(origin, outward, mid);
    const arc = mid * step * 0.86;
    pushBox(
      acc, center, tangent, out, face,
      arc * 0.5, spec.thick * 0.5 * wobble, spec.depth * 0.5,
      (nx, ny, nz) => stoneColor(nx, ny, nz, outward)
    );
    const rimC = add(center, outward, -(spec.thick * 0.5 + 0.08));
    pushBox(
      acc, rimC, tangent, out, face,
      arc * 0.46, 0.08, spec.depth * 0.22,
      () => spec.rim
    );
  }

  for (const gap of spec.gaps) {
    const outward = radial(gap.at);
    const tangent = tangentOf(gap.at);
    const face = mix3(forward, outward, -tilt);
    const out = mix3(outward, forward, tilt);
    const chips = [
      { along: 0, out: spec.inner + spec.thick * 0.2, z: 0.9, s: [0.62, 0.48, 0.4] },
      { along: gap.width * spec.inner * 0.22, out: spec.inner + spec.thick + 1.05, z: -0.7, s: [0.78, 0.55, 0.42] },
      { along: -gap.width * spec.inner * 0.18, out: spec.inner + spec.thick + 0.45, z: 0.85, s: [0.4, 0.34, 0.3] }
    ];
    for (const chip of chips) {
      const center = add(add(add(origin, outward, chip.out), tangent, chip.along), face, chip.z);
      pushBox(
        acc, center, tangent, out, face,
        chip.s[0], chip.s[1], chip.s[2],
        (nx, ny) => chipColor(nx, ny)
      );
    }
  }

  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(acc.pos, 3));
  geo.setAttribute('color', new Float32BufferAttribute(acc.col, 3));
  return geo;
}

/**
 * One geometry per live segment. Segment k carries a different finished gate,
 * so the run cycles the variations instead of repeating one ring.
 */
export function buildVoidGateSegments(seed: number, count: number): BufferGeometry[] {
  const start = seed % VOID_GATES.length;
  const geos: BufferGeometry[] = [];
  for (let k = 0; k < count; k++) {
    geos.push(buildGateVariation(VOID_GATES[(start + k) % VOID_GATES.length]));
  }
  return geos;
}

/** True when no vertex sits in the hop volume. The arch may cross x = 0 above or below it. */
export function gateClearsPlay(geo: BufferGeometry): boolean {
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = Math.abs(pos.getX(i));
    const y = pos.getY(i);
    if (x < VOID_PLAY_HALF_X && y > VOID_PLAY_Y0 && y < VOID_PLAY_Y1) return false;
  }
  return true;
}
