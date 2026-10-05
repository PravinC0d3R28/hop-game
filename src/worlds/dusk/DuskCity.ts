/**
 * Dusk District scenery.
 *
 * One seeded canyon chunk rides with the runway (the same recycle Sunrise uses
 * for crystals). A second, softer skyline stays ahead of the camera so the
 * sunset is never something you arrive at.
 *
 * The street is the lab pieces: each one is turned so its front faces the
 * path, seated on a canyon stem that drops into the mist. Nothing solid is
 * allowed inside the hop corridor.
 */
import { BufferGeometry, Float32BufferAttribute } from 'three';
import { makeRng } from '../../systems/CrystalFactory';
import { visibleHalfWidth, type FrameInfo } from '../../systems/CrystalField';
import { DUSK_ARCH, DUSK_FACADE, DUSK_LANTERN_COLORS, DUSK_LANTERN_CORE, DUSK_WINDOW } from './DuskPalette';
import { buildDuskPiece, type DuskPieceName } from './DuskPieces';

/** Closest a tile edge can reach, plus a gap. Nothing solid may cross this. */
export const DUSK_CORRIDOR = 5.15;

/** How far a shell outline grows past its box, toward the path included. */
const SHELL = 0.16;

/** Extra gap so a hanging lantern still clears the corridor. */
const WALL_PAD = 1.15;

const BASE_Y = -18;

export type DuskKind = 'wall' | 'tower' | 'arch' | 'terrace' | 'back' | 'lantern' | 'float';

export interface DuskBlock {
  kind: DuskKind;
  /** +1 right of the path, -1 left. */
  side: 1 | -1;
  /**
   * Absolute distance of the path-facing face from the centre line.
   * For lanterns this is the centre of the lamp, which sits just proud of
   * the wall and still outside the corridor.
   */
  inner: number;
  width: number;
  z0: number;
  z1: number;
  y0: number;
  y1: number;
  /** -1, 0, or +1. Nudges the whole building up or down the facade ramp. */
  bias: number;
  /** Authored piece planted on this block. Lanterns pick their own. */
  piece?: DuskPieceName;
  /** How big the piece is planted. This is the skyline, not a uniform row. */
  scale?: number;
}

export interface DuskMeshSet {
  face: BufferGeometry;
  shell: BufferGeometry;
  lanterns: BufferGeometry;
  glows: BufferGeometry;
  /** Soft sheets under the street. Building bases fade into these. */
  mist: BufferGeometry;
}

interface Acc {
  pos: number[];
  nor: number[];
  col: number[];
  /** Fade vertices toward the canyon mist as they drop below the street. */
  sink?: boolean;
}

function emptyAcc(sink = false): Acc {
  return { pos: [], nor: [], col: [], sink };
}

/** Where the outline stops. Below this the wall is only colour, dissolving. */
const MIST_CUT = -4;

function srgbToLinear(byte: number): number {
  const u = byte / 255;
  return u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4;
}

const MIST_R = srgbToLinear(0x1a);
const MIST_G = srgbToLinear(0x10);
const MIST_B = srgbToLinear(0x22);

function cross(a: number[], b: number[], c: number[]): [number, number, number] {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  return [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
}

function bake(acc: Acc, withColor: boolean): BufferGeometry {
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(acc.pos, 3));
  if (acc.nor.length === acc.pos.length) {
    geo.setAttribute('normal', new Float32BufferAttribute(acc.nor, 3));
  }
  if (withColor && acc.col.length === acc.pos.length) {
    geo.setAttribute('color', new Float32BufferAttribute(acc.col, 3));
  }
  return geo;
}

function shade(nx: number, ny: number, nz: number, bias: number, colors: readonly number[]): number {
  // Walls stay plum. Only faces that look up, and a little of the street-facing
  // end, climb into coral. The sun itself is the bright thing, not the stone.
  const up = Math.max(0, ny);
  const sun = up * 0.72 + Math.max(0, nz) * 0.16;
  const t = Math.min(0.92, Math.max(0, 0.2 + sun + bias * 0.05));
  let i = Math.floor(t * colors.length);
  if (i < 0) i = 0;
  if (i >= colors.length) i = colors.length - 1;
  return colors[i];
}

function pushTri(
  acc: Acc,
  a: number[],
  b: number[],
  c: number[],
  color: number,
  shell: Acc | null,
  center: number[]
): void {
  let [nx, ny, nz] = cross(a, b, c);
  const len = Math.hypot(nx, ny, nz) || 1;
  nx /= len; ny /= len; nz /= len;
  const mx = (a[0] + b[0] + c[0]) / 3 - center[0];
  const my = (a[1] + b[1] + c[1]) / 3 - center[1];
  const mz = (a[2] + b[2] + c[2]) / 3 - center[2];
  let p0 = a, p1 = b, p2 = c;
  if (nx * mx + ny * my + nz * mz < 0) {
    nx = -nx; ny = -ny; nz = -nz;
    p1 = c; p2 = b;
  }
  const r = srgbToLinear((color >> 16) & 255);
  const g = srgbToLinear((color >> 8) & 255);
  const bl = srgbToLinear(color & 255);
  for (const p of [p0, p1, p2]) {
    let rr = r, gg = g, bb = bl;
    if (acc.sink) {
      const t = Math.min(1, Math.max(0, (0.15 - p[1]) / 2.8));
      const s = t * t;
      rr = r + (MIST_R - r) * s;
      gg = g + (MIST_G - g) * s;
      bb = bl + (MIST_B - bl) * s;
    }
    acc.pos.push(p[0], p[1], p[2]);
    acc.nor.push(nx, ny, nz);
    acc.col.push(rr, gg, bb);
    if (shell) {
      shell.pos.push(p[0] + nx * SHELL, p[1] + ny * SHELL, p[2] + nz * SHELL);
    }
  }
}

function boxCenter(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): number[] {
  return [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
}

function emitBox(
  face: Acc,
  shell: Acc | null,
  x0: number, y0: number, z0: number,
  x1: number, y1: number, z1: number,
  colorOf: (nx: number, ny: number, nz: number) => number
): void {
  const c = boxCenter(x0, y0, z0, x1, y1, z1);
  const v = (x: number, y: number, z: number): number[] => [x, y, z];
  const quad = (a: number[], b: number[], d: number[], e: number[]) => {
    // Temporary normal from the unflipped winding, then pushTri corrects it.
    const [nx, ny, nz] = cross(a, b, d);
    const len = Math.hypot(nx, ny, nz) || 1;
    const color = colorOf(nx / len, ny / len, nz / len);
    pushTri(face, a, b, d, color, shell, c);
    pushTri(face, a, d, e, color, shell, c);
  };
  // Each quad is two triangles. Winding is corrected against the box centre.
  quad(v(x0, y1, z0), v(x0, y1, z1), v(x1, y1, z1), v(x1, y1, z0)); // top
  quad(v(x0, y0, z0), v(x1, y0, z0), v(x1, y0, z1), v(x0, y0, z1)); // bottom
  quad(v(x1, y0, z0), v(x1, y1, z0), v(x1, y1, z1), v(x1, y0, z1)); // +x
  quad(v(x0, y0, z1), v(x0, y1, z1), v(x0, y1, z0), v(x0, y0, z0)); // -x
  quad(v(x0, y0, z1), v(x1, y0, z1), v(x1, y1, z1), v(x0, y1, z1)); // +z
  quad(v(x1, y0, z0), v(x0, y0, z0), v(x0, y1, z0), v(x1, y1, z0)); // -z
}

/**
 * A building mass. The outline stops at the mist line so the base has no
 * hard edge, and the face colour sinks into the canyon the rest of the way.
 */
function emitSolid(
  face: Acc,
  shell: Acc,
  x0: number, y0: number, z0: number,
  x1: number, y1: number, z1: number,
  colorOf: (nx: number, ny: number, nz: number) => number
): void {
  const yLo = Math.min(y0, y1);
  const yHi = Math.max(y0, y1);
  if (yHi <= MIST_CUT) {
    emitBox(face, null, x0, yLo, z0, x1, yHi, z1, colorOf);
    return;
  }
  if (yLo >= MIST_CUT) {
    emitBox(face, shell, x0, yLo, z0, x1, yHi, z1, colorOf);
    return;
  }
  emitBox(face, null, x0, yLo, z0, x1, MIST_CUT, z1, colorOf);
  emitBox(face, shell, x0, MIST_CUT, z0, x1, yHi, z1, colorOf);
}

/** Wider at the base, like the hanging lamps in the reference. */
function emitFrustum(
  face: Acc,
  x: number, y0: number, y1: number, z: number,
  hx0: number, hz0: number, hx1: number, hz1: number,
  color: number
): void {
  const b0 = [x - hx0, y0, z - hz0];
  const b1 = [x + hx0, y0, z - hz0];
  const b2 = [x + hx0, y0, z + hz0];
  const b3 = [x - hx0, y0, z + hz0];
  const t0 = [x - hx1, y1, z - hz1];
  const t1 = [x + hx1, y1, z - hz1];
  const t2 = [x + hx1, y1, z + hz1];
  const t3 = [x - hx1, y1, z + hz1];
  const mid = [x, (y0 + y1) / 2, z];
  const quad = (a: number[], b: number[], c: number[], d: number[]) => {
    pushTri(face, a, b, c, color, null, mid);
    pushTri(face, a, c, d, color, null, mid);
  };
  quad(b0, b1, t1, t0);
  quad(b2, b3, t3, t2);
  quad(b3, b0, t0, t3);
  quad(b1, b2, t2, t1);
  quad(t0, t1, t2, t3);
  quad(b0, b3, b2, b1);
}

function emitPyramid(
  face: Acc,
  shell: Acc | null,
  cx: number, y: number, cz: number,
  hx: number, hz: number, height: number,
  colorOf: (nx: number, ny: number, nz: number) => number
): void {
  const apex = [cx, y + height, cz];
  const p0 = [cx - hx, y, cz - hz];
  const p1 = [cx + hx, y, cz - hz];
  const p2 = [cx + hx, y, cz + hz];
  const p3 = [cx - hx, y, cz + hz];
  const center = [cx, y + height * 0.4, cz];
  for (const [a, b] of [[p0, p1], [p1, p2], [p2, p3], [p3, p0]] as number[][][]) {
    const [nx, ny, nz] = cross(apex, a, b);
    const len = Math.hypot(nx, ny, nz) || 1;
    pushTri(face, apex, a, b, colorOf(nx / len, ny / len, nz / len), shell, center);
  }
}

/**
 * Where the near wall starts.
 *
 * A wide frame keeps a broader open canyon. A phone pulls the wall in until
 * it hits the corridor, then lets the outer half crop off the screen.
 */
export function duskFrontInner(frame: FrameInfo): number {
  // Measured at a near slice of the view, not the horizon. A wide screen keeps
  // a slightly broader gap than a phone, but the wall still enters the frame
  // beside the player so the canyon reads as something you are inside.
  const half = visibleHalfWidth(frame, 18);
  const open = frame.aspect >= 1 ? 0.38 : 0.62;
  return Math.max(DUSK_CORRIDOR, Math.min(half * open, 7.4));
}

function pushBlock(blocks: DuskBlock[], block: DuskBlock): void {
  blocks.push(block);
}

interface Plot {
  kind: DuskKind;
  piece: DuskPieceName;
  scale: number;
}

/**
 * Three depths, one skyline.
 *
 * The furthest row is the city itself: a few enormous masses.
 * The middle row is a step down from those.
 * The street you hop is a rhythm of low houses and tall breaks,
 * and it never stacks a second piece on top of a finished building.
 */
const NEAR_SHORT: Plot[] = [
  { kind: 'wall', piece: 'lodge', scale: 0.82 },
  { kind: 'arch', piece: 'gate', scale: 0.86 },
  { kind: 'terrace', piece: 'terrace', scale: 0.88 },
  { kind: 'wall', piece: 'parapet', scale: 0.95 }
];
const NEAR_MEDIUM: Plot[] = [
  { kind: 'arch', piece: 'hall', scale: 1.02 },
  { kind: 'arch', piece: 'court', scale: 1.0 },
  { kind: 'wall', piece: 'windows', scale: 1.08 }
];
const NEAR_TALL: Plot[] = [
  { kind: 'tower', piece: 'keep', scale: 1.22 },
  { kind: 'tower', piece: 'tower-cap', scale: 1.55 },
  { kind: 'tower', piece: 'pillar-spire', scale: 1.05 }
];
/** Low, tall, low, medium, low, tall. Two tall plots never touch. */
const NEAR_BEAT = ['short', 'tall', 'short', 'medium', 'short', 'tall'] as const;

/** Smaller than the monuments behind, still tall enough to clear a low street house. */
const MID_HOUSES: Plot[] = [
  { kind: 'back', piece: 'hall', scale: 1.42 },
  { kind: 'back', piece: 'court', scale: 1.35 },
  { kind: 'back', piece: 'lodge', scale: 1.28 },
  { kind: 'back', piece: 'terrace', scale: 1.22 },
  { kind: 'back', piece: 'gate', scale: 1.18 }
];

/** The back of the canyon. Large enough that perspective still leaves them towering over the street. */
const FAR_MONUMENTS: Plot[] = [
  { kind: 'back', piece: 'hall', scale: 3.7 },
  { kind: 'back', piece: 'cliff', scale: 4.0 },
  { kind: 'back', piece: 'court', scale: 3.5 },
  { kind: 'back', piece: 'keep', scale: 2.75 }
];

/** Spikes and caps are too thin for a wall lamp. They wear a beacon on the tip instead. */
const NARROW_LANTERN = new Set<DuskPieceName>(['pillar-stub', 'pillar-band', 'pillar-spire', 'tower-cap']);

/** Local point where the roof lantern sits. Keep's tower is on the corner, not the middle. */
const TOWER_TIP: Partial<Record<DuskPieceName, { x: number; y: number; z: number }>> = {
  'tower-cap': { x: 0, y: 4.85, z: 0 },
  'pillar-spire': { x: 0, y: 7.35, z: 0 },
  'pillar-band': { x: 0, y: 4.65, z: 0 },
  keep: { x: 0.7, y: 6.4, z: 0 }
};

const LAYERS = {
  near: { setback: 0, start: 0, gapMin: 2.6, gapSpan: 1.5 },
  mid: { setback: 4.4, start: 2.4, gapMin: 4.2, gapSpan: 2.4 },
  far: { setback: 8.8, start: 0, gapMin: 6, gapSpan: 4 }
} as const;

/** Deal every option once before any repeat, so the street cannot clump. */
function deal<T>(rnd: () => number, bag: T[], source: readonly T[]): T {
  if (bag.length === 0) {
    const copy = source.slice();
    for (let n = copy.length - 1; n > 0; n--) {
      const j = Math.floor(rnd() * (n + 1));
      const swap = copy[n];
      copy[n] = copy[j];
      copy[j] = swap;
    }
    for (const item of copy) bag.push(item);
  }
  return bag.pop() as T;
}

interface BakedPiece {
  pos: Float32Array;
  col: Float32Array;
  glowPos: Float32Array;
  glowCol: Float32Array;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

const PIECE_CACHE = new Map<DuskPieceName, BakedPiece>();

function bakedPiece(name: DuskPieceName): BakedPiece {
  const hit = PIECE_CACHE.get(name);
  if (hit) return hit;
  const piece = buildDuskPiece(name);
  const pos = piece.face.getAttribute('position').array as Float32Array;
  const col = piece.face.getAttribute('color').array as Float32Array;
  const glowPosAttr = piece.glow.getAttribute('position');
  const glowColAttr = piece.glow.getAttribute('color');
  const glowPos = glowPosAttr ? glowPosAttr.array as Float32Array : new Float32Array();
  const glowCol = glowColAttr ? glowColAttr.array as Float32Array : new Float32Array();
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i], y = pos[i + 1], z = pos[i + 2];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  const baked: BakedPiece = { pos, col, glowPos, glowCol, minX, maxX, minY, maxY, minZ, maxZ };
  PIECE_CACHE.set(name, baked);
  return baked;
}

function fillRow(
  rnd: () => number,
  side: 1 | -1,
  wallInner: number,
  segmentLength: number,
  row: 'near' | 'mid' | 'far',
  blocks: DuskBlock[],
  portrait: boolean
): void {
  const layer = LAYERS[row];
  // A phone sees a narrow slot. Extra rows sit further out and further ahead,
  // so they enter the frame down the street instead of stacking beside the player.
  // Explicit `number` annotations: without them these inherit the literal union
  // from the layer spec (e.g. `6 | 4.2 | 2.6`), so every reassignment below —
  // the portrait variants — fails to typecheck.
  let setback: number = layer.setback;
  let gapMin: number = layer.gapMin;
  let gapSpan: number = layer.gapSpan;
  let cursor: number = layer.start;
  let scaleMul = 1;
  if (portrait && row === 'near') {
    gapMin = 5.6;
    gapSpan = 3.6;
    scaleMul = 0.84;
  } else if (portrait && row === 'mid') {
    setback = 7.4;
    cursor = 34;
    gapMin = 8;
    gapSpan = 4;
    scaleMul = 0.88;
  } else if (portrait && row === 'far') {
    // Still the biggest row. It sits outside the first phone frame and enters as the street opens.
    setback = 12.2;
    cursor = 18;
    gapMin = 9;
    gapSpan = 5;
    scaleMul = 0.92;
  } else if (side > 0) {
    if (row === 'mid') cursor += 4;
    if (row === 'far') cursor += 7;
    if (row === 'near') cursor += 1.6;
  }
  const bags = {
    short: [] as Plot[],
    medium: [] as Plot[],
    tall: [] as Plot[],
    mid: [] as Plot[],
    far: [] as Plot[]
  };
  let i = 0;
  while (cursor < segmentLength - 1.2) {
    const remaining = segmentLength - cursor;
    let plot: Plot;
    if (row === 'near') {
      const role = NEAR_BEAT[i % NEAR_BEAT.length];
      plot = role === 'short'
        ? deal(rnd, bags.short, NEAR_SHORT)
        : role === 'tall'
          ? deal(rnd, bags.tall, NEAR_TALL)
          : deal(rnd, bags.medium, NEAR_MEDIUM);
    } else if (row === 'mid') {
      plot = deal(rnd, bags.mid, MID_HOUSES);
    } else {
      plot = deal(rnd, bags.far, FAR_MONUMENTS);
    }
    const scale = plot.scale * scaleMul;
    const baked = bakedPiece(plot.piece);
    const span = (baked.maxX - baked.minX) * scale;
    const away = (baked.maxZ - baked.minZ) * scale;
    const depth = span;
    if (depth > remaining || !(depth > 0.4)) break;
    const block: DuskBlock = {
      kind: plot.kind,
      side,
      inner: wallInner + setback,
      width: Math.max(1.2, away * 0.7),
      z0: cursor,
      z1: cursor + depth,
      y0: -3.4,
      y1: 0.2,
      bias: Math.floor(rnd() * 3) - 1,
      piece: plot.piece,
      scale
    };
    pushBlock(blocks, block);
    const wideEnough = span >= (portrait ? 2.0 : 2.4);
    const lampHere = !portrait || i % 2 === 0;
    const tip = TOWER_TIP[plot.piece];
    if (tip) {
      const pieceSpan = Math.max(0.2, baked.maxX - baked.minX);
      const planted = Math.min(scale, (span * 0.96) / pieceSpan);
      const beaconScale = Math.min(1.15, Math.max(0.42, planted * 0.38));
      const beaconName = side > 0 ? 'lantern-beacon-rose' : 'lantern-beacon';
      const beacon = bakedPiece(beaconName);
      const y = (tip.y - baked.minY) * planted - 0.04;
      const cx = (baked.minX + baked.maxX) / 2;
      const wx = side > 0
        ? (tip.z - baked.minZ) * planted + block.inner
        : -((tip.z - baked.minZ) * planted + block.inner);
      const wz = side > 0
        ? -tip.x * planted + (cursor + depth / 2) + cx * planted
        : tip.x * planted + (cursor + depth / 2) - cx * planted
      blocks.push({
        kind: 'lantern',
        side,
        inner: Math.abs(wx) + beacon.minZ * beaconScale,
        width: 0.25,
        z0: wz,
        z1: wz,
        y0: y,
        y1: 0,
        bias: 0,
        scale: beaconScale,
        piece: beaconName
      });
    }
    if (wideEnough && lampHere && !NARROW_LANTERN.has(plot.piece)) {
      const height = (baked.maxY - baked.minY) * scale;
      const lampY = row === 'far'
        ? Math.min(7.2, Math.max(2.4, height * 0.36))
        : row === 'mid'
          ? Math.min(4.2, Math.max(1.7, height * 0.4))
          : Math.min(2.45, Math.max(1.25, height * 0.42));
      const along = i % 2 === 0 ? 0.28 : 0.72;
      const z = cursor + depth * along;
      const lamps = side > 0
        ? ['lantern-rose', 'lantern-picture', 'lantern-amber'] as const
        : ['lantern-picture', 'lantern-rose', 'lantern-amber'] as const;
      const lampScale = row === 'far' ? 1.05 : row === 'mid' ? 0.72 : 0.5;
      blocks.push({
        kind: 'lantern',
        side,
        inner: block.inner,
        width: 0.7,
        z0: z,
        z1: z,
        y0: lampY,
        y1: 0,
        bias: 0,
        scale: lampScale,
        piece: lamps[i % lamps.length]
      });
    }
    cursor += depth + gapMin + rnd() * gapSpan;
    i++;
  }
}

/**
 * Pure layout. Same seed and frame always return the same street.
 * `segmentLength` is the recycle period the background already uses.
 */
export function planDuskCity(seed: number, frame: FrameInfo, segmentLength = 240): DuskBlock[] {
  const rnd = makeRng(seed);
  const wallInner = duskFrontInner(frame) + WALL_PAD;
  const portrait = frame.aspect < 1;
  const blocks: DuskBlock[] = [];
  for (const side of [-1, 1] as const) {
    fillRow(rnd, side, wallInner, segmentLength, 'near', blocks, portrait);
    fillRow(rnd, side, wallInner, segmentLength, 'mid', blocks, portrait);
    fillRow(rnd, side, wallInner, segmentLength, 'far', blocks, portrait);
  }
  return blocks;
}

function blockBox(b: DuskBlock): [number, number, number, number, number, number] {
  const y0 = Math.min(b.y0, b.y1);
  const y1 = Math.max(b.y0, b.y1);
  if (b.side > 0) return [b.inner, y0, b.z0, b.inner + b.width, y1, b.z1];
  return [-b.inner - b.width, y0, b.z0, -b.inner, y1, b.z1];
}

function colorOf(bias: number): (nx: number, ny: number, nz: number) => number {
  return (nx, ny, nz) => shade(nx, ny, nz, bias, DUSK_FACADE);
}

/** Path-facing stone is coral. The outer wall and the drop below stay plum. */
function massPaint(side: 1 | -1, bias: number): (nx: number, ny: number, nz: number) => number {
  return (nx, ny, nz) => {
    const facingPath = -nx * side > 0.5;
    const up = ny > 0.45;
    let i = 2;
    if (up) i = 5;
    else if (facingPath) i = 4;
    else if (nz > 0.5) i = 3;
    i += bias;
    if (i < 0) i = 0;
    if (i >= DUSK_FACADE.length) i = DUSK_FACADE.length - 1;
    return DUSK_FACADE[i];
  };
}

function fixed(hex: number): (nx: number, ny: number, nz: number) => number {
  return () => hex;
}

function emitArch(face: Acc, shell: Acc, b: DuskBlock): void {
  const [x0, , z0, x1, , z1] = blockBox(b);
  const toward = b.side > 0 ? -1 : 1;
  const faceX = b.side > 0 ? x0 : x1;
  const zc = (z0 + z1) / 2;
  const span = z1 - z0;
  // Narrower than the wall, so the stone piers are as visible as the hole.
  const w = Math.min(1.15, span * 0.16);
  const crown = Math.max(b.y0, b.y1) - 0.35;
  const base = 0.55;
  const t = 0.85;
  const proud = 0.1 * toward;
  const ring = fixed(b.side > 0 ? 0xf49a67 : 0xc65363);
  const hole = fixed(DUSK_ARCH);
  const xa = faceX + proud;
  const xb = faceX + proud - t * toward;
  const lo = Math.min(xa, xb);
  const hi = Math.max(xa, xb);
  const spring = crown - 1.7;
  emitBox(face, null, faceX - 0.02 * toward, base, zc - w, faceX + 0.06 * toward, spring, zc + w, hole);
  emitPyramid(face, null, faceX, spring - 0.05, zc, 0.06, w * 0.96, 1.65, hole);
  const pier = (zA: number, zB: number) => {
    emitBox(face, shell, lo, base - 0.2, zA, hi, spring + 0.15, zB, ring);
  };
  pier(zc - w - t, zc - w + 0.05);
  pier(zc + w - 0.05, zc + w + t);
  emitBox(face, shell, lo, spring - 0.15, zc - w - t, hi, spring + 0.55, zc + w + t, ring);
  const cx = (lo + hi) / 2;
  emitPyramid(face, shell, cx, spring + 0.2, zc, (hi - lo) * 0.46, w + t * 0.35, 1.7, ring);
}

function emitWindows(face: Acc, _shell: Acc, b: DuskBlock): void {
  const [x0, , z0, x1, y1, z1] = blockBox(b);
  const faceX = b.side > 0 ? x0 : x1;
  const toward = b.side > 0 ? -1 : 1;
  const span = z1 - z0;
  const glass = fixed(DUSK_WINDOW);
  const cols = span > 7 ? 3 : 2;
  for (let i = 0; i < cols; i++) {
    const z = z0 + span * ((i + 1) / (cols + 1));
    const ww = 0.38;
    const wh = 1.15;
    const y = Math.min(y1 - 2.3, 3.4);
    const xa = faceX + toward * 0.02;
    const xb = faceX + toward * 0.14;
    emitBox(face, null, Math.min(xa, xb), y, z - ww, Math.max(xa, xb), y + wh, z + ww, glass);
    emitPyramid(face, null, faceX + toward * 0.08, y + wh - 0.04, z, 0.06, ww * 0.95, 0.42, glass);
  }
}

function emitRoof(face: Acc, shell: Acc, b: DuskBlock): void {
  const [x0, , z0, x1, y1, z1] = blockBox(b);
  const color = colorOf(Math.min(2, b.bias + 1));
  if (b.kind === 'tower') {
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const hx = (x1 - x0) * 0.42;
    emitBox(face, shell, cx - hx, y1 - 0.05, z0 + 0.3, cx + hx, y1 + 0.7, z1 - 0.3, color);
    emitPyramid(face, shell, cx, y1 + 0.65, cz, hx * 0.85, (z1 - z0) * 0.32, 14, color);
    return;
  }
  // A ridge roof. The inner slope faces the path, so the camera sees a roof
  // rather than the top of a crate. The overhang stays outside the corridor.
  const toward = b.side > 0 ? -1 : 1;
  const innerX = b.side > 0 ? x0 : x1;
  const outerX = b.side > 0 ? x1 : x0;
  const eaveX = innerX + toward * 0.2;
  const ridgeX = innerX + (outerX - innerX) * 0.62;
  const eaveY = y1 + 0.08;
  const ridgeY = y1 + 2.6;
  const mid = [(x0 + x1) / 2, y1 + 1, (z0 + z1) / 2];
  const roof = b.bias > 0 ? 0xc65363 : 0x713050;
  const slope = (a: number[], b0: number[], c0: number[], d0: number[]) => {
    pushTri(face, a, b0, c0, roof, shell, mid);
    pushTri(face, a, c0, d0, roof, shell, mid);
  };
  slope(
    [eaveX, eaveY, z0], [eaveX, eaveY, z1],
    [ridgeX, ridgeY, z1], [ridgeX, ridgeY, z0]
  );
  slope(
    [ridgeX, ridgeY, z0], [ridgeX, ridgeY, z1],
    [outerX, eaveY, z1], [outerX, eaveY, z0]
  );
}

function emitLanternAt(
  lamps: Acc,
  glows: Acc,
  x: number, y: number, z: number,
  s: number,
  color: number,
  clampToCorridor: boolean
): void {
  // The picture's lamp: a dark housing, wider at the bottom, with a bright
  // window and a short cap. The housing is the silhouette. The glow stays
  // inside the window so it doesn't turn into a white card.
  let hx = Math.max(0.2, s) * 0.92;
  if (clampToCorridor) {
    const room = Math.abs(x) - DUSK_CORRIDOR - 0.12;
    hx = Math.max(0.16, Math.min(hx, room));
  }
  const hz = hx * 0.7;
  const y0 = y - hx * 2.35;
  const y1 = y + hx * 1.15;
  const frame = 0x3a2044;
  // The body is the light. A dark cap and a hotter core keep the framed look
  // without turning the lamp into a shadow on the wall.
  emitFrustum(lamps, x, y0, y1, z, hx, hz, hx * 0.72, hz * 0.72, color);
  const win0 = y0 + (y1 - y0) * 0.16;
  const win1 = y0 + (y1 - y0) * 0.78;
  emitBox(lamps, null, x - hx * 0.48, win0, z - hz * 0.2, x + hx * 0.48, win1, z + hz * 0.2, () => DUSK_LANTERN_CORE);
  emitPyramid(lamps, null, x, y1 - hx * 0.02, z, hx * 0.8, hz * 0.8, hx * 0.55, () => frame);
  const ghx = hx * 0.28;
  const ghy = (win1 - win0) * 0.38;
  const gy = (win0 + win1) / 2;
  const center = [x, gy, z - 1];
  pushTri(glows, [x - ghx, gy - ghy, z], [x + ghx, gy - ghy, z], [x + ghx, gy + ghy, z], color, null, center);
  pushTri(glows, [x - ghx, gy - ghy, z], [x + ghx, gy + ghy, z], [x - ghx, gy + ghy, z], color, null, center);
}

function emitLantern(lamps: Acc, glows: Acc, b: DuskBlock): void {
  const x = b.side * b.inner;
  const color = DUSK_LANTERN_COLORS[Math.abs(b.bias) % DUSK_LANTERN_COLORS.length];
  emitLanternAt(lamps, glows, x, b.y0, b.z0, b.width, color, true);
}

/**
 * Turn an authored piece so the face that looks down -Z in the lab looks
 * toward the path. `front` is the absolute distance of that face from x=0.
 */
/** Screen right stays sunlit coral. Screen left is the picture's deep plum. */
function gradeCanyon(r: number, g: number, b: number, side: 1 | -1): [number, number, number] {
  const lum = r * 0.3 + g * 0.55 + b * 0.15;
  // This camera's +X is the left of the frame.
  const hex = side > 0
    ? (lum > 0.22 ? 0x7a2868 : lum > 0.07 ? 0x3a1450 : 0x1a1024)
    : (lum > 0.16 ? 0xf07868 : lum > 0.06 ? 0xc65363 : 0x3a1848);
  const t = side > 0 ? 0.78 : (lum > 0.16 ? 0.62 : 0.4);
  const tr = srgbToLinear((hex >> 16) & 255);
  const tg = srgbToLinear((hex >> 8) & 255);
  const tb = srgbToLinear(hex & 255);
  return [r + (tr - r) * t, g + (tg - g) * t, b + (tb - b) * t];
}

function placePiece(
  face: Acc,
  glows: Acc,
  name: DuskPieceName,
  side: 1 | -1,
  front: number,
  zCenter: number,
  yBase: number,
  scale: number,
  tint: boolean
): void {
  const src = bakedPiece(name);
  const tx = side * front - side * src.minZ * scale;
  const cx = (src.minX + src.maxX) / 2;
  const tz = side > 0 ? zCenter + cx * scale : zCenter - cx * scale;
  const ty = yBase - src.minY * scale;
  const xform = (x: number, y: number, z: number): [number, number, number] => {
    const sx = x * scale;
    const sy = y * scale + ty;
    const sz = z * scale;
    if (side > 0) return [sz + tx, sy, -sx + tz];
    return [-sz + tx, sy, sx + tz];
  };
  const write = (acc: Acc, pos: Float32Array, col: Float32Array, sink: boolean, grade: boolean) => {
    for (let i = 0; i < pos.length; i += 3) {
      const [x, y, z] = xform(pos[i], pos[i + 1], pos[i + 2]);
      let r = col[i], g = col[i + 1], b = col[i + 2];
      if (grade) [r, g, b] = gradeCanyon(r, g, b, side);
      if (sink) {
        const t = Math.min(1, Math.max(0, (0.15 - y) / 2.8));
        const s = t * t;
        r = r + (MIST_R - r) * s;
        g = g + (MIST_G - g) * s;
        b = b + (MIST_B - b) * s;
      }
      acc.pos.push(x, y, z);
      acc.nor.push(0, 1, 0);
      acc.col.push(r, g, b);
    }
  };
  write(face, src.pos, src.col, true, tint);
  if (src.glowPos.length > 0) write(glows, src.glowPos, src.glowCol, false, false);
}

function placeBlockPiece(face: Acc, glows: Acc, b: DuskBlock, segmentLength: number): void {
  const piece = b.piece ?? 'court';
  const src = bakedPiece(piece);
  const span = Math.max(0.2, src.maxX - src.minX);
  const lot = Math.max(0.2, b.z1 - b.z0);
  const scale = Math.min(b.scale ?? 1.1, (lot * 0.96) / span);
  const half = span * scale * 0.5;
  const zc = (b.z0 + b.z1) / 2;
  let z = zc;
  if (z - half < -0.15) z = half - 0.15;
  if (z + half > segmentLength + 0.15) z = segmentLength + 0.15 - half;
  placePiece(face, glows, piece, b.side, b.inner, z, -0.02, scale, true);
}

function placeLantern(lamps: Acc, glows: Acc, b: DuskBlock): void {
  const name = b.piece ?? 'lantern-picture';
  const src = bakedPiece(name);
  if (name === 'lantern-beacon' || name === 'lantern-beacon-rose') {
    // `inner` is already the distance that seats the lamp on the spire tip.
    placePiece(lamps, glows, name, b.side, b.inner, b.z0, b.y0, b.scale ?? 0.5, false);
    return;
  }
  // The bracket's back meets the wall. The glass hangs in front of it.
  // Local +Z is the wall side once the piece is turned toward the path.
  const mountZ = name === 'lantern-amber' ? 0.4 : 0.55;
  const hang = Math.max(0.2, mountZ - src.minZ);
  const room = b.inner - (DUSK_CORRIDOR + 0.16);
  const wanted = b.scale ?? (name === 'lantern-amber' ? 0.5 : 0.52);
  const scale = Math.min(wanted, Math.max(0.3, room / hang));
  const front = Math.max(DUSK_CORRIDOR + 0.16, b.inner - hang * scale + 0.04);
  placePiece(lamps, glows, name, b.side, front, b.z0, b.y0 - 0.82 * scale, scale, false);
}

/** Turn a plan into merged meshes for one recycle chunk. */
export function buildDuskCity(seed: number, frame: FrameInfo, segmentLength = 240): DuskMeshSet {
  const blocks = planDuskCity(seed, frame, segmentLength);
  const face = emptyAcc(true);
  const shell = emptyAcc();
  const lamps = emptyAcc();
  const glows = emptyAcc();
  for (const b of blocks) {
    if (b.kind === 'lantern' || b.kind === 'float') {
      placeLantern(lamps, glows, b);
      continue;
    }
    const [x0, , z0, x1, , z1] = blockBox(b);
    // A short skirt. Colour sinks to the fog within a few units, so the
    // building does not run down the canyon forever.
    const lip = 0.1;
    const sx0 = b.side > 0 ? x0 + lip : x0;
    const sx1 = b.side > 0 ? x1 : x1 - lip;
    emitBox(face, null, sx0, -3.2, z0, sx1, 0.16, z1, fixed(0x241430));
    placeBlockPiece(face, glows, b, segmentLength);
  }
  const mist = emptyAcc();
  emitMist(mist, segmentLength);
  return {
    face: bake(face, true),
    shell: bake(shell, false),
    lanterns: bake(lamps, true),
    glows: bake(glows, true),
    mist: bake(mist, true)
  };
}

/** Fog under the buildings only. The canyon gap stays open so the sunset reads through. */
function emitMist(acc: Acc, length: number): void {
  const bands = [0x4a1860, 0x2a1030];
  const heights = [-0.55, -2.1];
  for (let i = 0; i < bands.length; i++) {
    const y = heights[i];
    emitBox(acc, null, -30, y, -6, -6.2, y + 0.4, length + 6, fixed(bands[i]));
    emitBox(acc, null, 6.2, y, -6, 30, y + 0.4, length + 6, fixed(bands[i]));
  }
}

export interface DuskHorizon {
  /** Small lamps ahead of the camera. Local space: +Z is forward. */
  lanterns: BufferGeometry;
  /** Soft bloom inside those lamps. Not a sun. */
  glow: BufferGeometry;
}

/**
 * Nothing hangs in the open air. The sunset is the sky gradient.
 * Kept so a caller still receives an empty pair instead of a sun card.
 */
export function buildDuskHorizon(_seed: number): DuskHorizon {
  const lamps = emptyAcc();
  const glow = emptyAcc();
  return { lanterns: bake(lamps, true), glow: bake(glow, true) };
}

/** Closest |x| of a solid block. Lanterns include their own half-size. */
export function blockClearance(b: DuskBlock): number {
  if (b.kind === 'lantern' || b.kind === 'float') return b.inner - b.width;
  return b.inner - SHELL;
}

