/**
 * Where finished Void pieces stand. Gameplay only picks a whole variation
 * and a place for it. It does not assemble a ring or glue a monolith on.
 *
 * Islands are the common rocks. Monoliths are fewer. A planet stands once
 * per segment, an orbit once per three, and the gate once per three with
 * the nearby rocks left out so the ring stays clear.
 */
import { BufferGeometry, Float32BufferAttribute, IcosahedronGeometry } from 'three';
import { VOID_GATES, VOID_PLAY_HALF_X, VOID_PLAY_Y0, VOID_PLAY_Y1, buildGateVariation, gateClearsPlay } from './VoidGates';
import { VOID_ISLANDS, buildIslandVariation } from './VoidIslands';
import { VOID_MONOLITHS, buildMonolithVariation } from './VoidMonoliths';
import { VOID_ORBITS, VOID_PLANETS, buildOrbitVariation, buildPlanetVariation } from './VoidPlanets';
import { VOID_STONE } from './VoidPalette';

export type VoidKind = 'gate' | 'planet' | 'orbit' | 'island' | 'monolith';

export interface VoidPlacement {
  kind: VoidKind;
  index: number;
  side: 1 | -1;
  z: number;
  /** Added beyond the authored distance, away from the path. */
  outward: number;
  /** Vertical shift. Negative sits under the tiles, positive hangs above them. */
  rise: number;
  /** Hung under the path. The whole mesh stays below the hop corridor. */
  sink: boolean;
}

const SLOT = 3;

function sideOf(seed: number, slot: number, flip: boolean): 1 | -1 {
  const base: 1 | -1 = (seed + slot) % 2 === 0 ? 1 : -1;
  return flip ? (base === 1 ? -1 : 1) : base;
}

interface BandStop {
  z: number;
  side: 0 | 1;
  rise: number;
  kind: VoidKind;
  outward: number;
  /** Index within its kind. Near and far bands count separately. */
  n: number;
  sink: boolean;
}

/**
 * One recycled segment. `slot` is 0, 1, or 2. The same seed and the same
 * portrait flag always return the same list.
 *
 * Eight stations is about a quarter fewer pieces than the eleven-station
 * field. The gate segment drops the stations that would sit on the ring.
 */
export function planVoidSegment(seed: number, slot: number, portrait: boolean): VoidPlacement[] {
  const s = ((slot % SLOT) + SLOT) % SLOT;
  const sides: Array<1 | -1> = [sideOf(seed, s, false), sideOf(seed, s, true)];
  const island = (seed * 3 + s * 11) % VOID_ISLANDS.length;
  const monolith = (seed * 5 + s * 7) % VOID_MONOLITHS.length;
  const planet = (seed + s) % VOID_PLANETS.length;
  const orbit = (seed + s * 2) % VOID_ORBITS.length;
  const gate = (seed + s) % VOID_GATES.length;
  const below = [-2.4, -1.15, -3.3];
  const above = [3.2, 4.4, 2.4];
  const GATE_Z = 114;
  const band: BandStop[] = [];
  let nearIsland = 0;
  let nearMono = 0;
  let farIsland = 0;
  let farMono = 0;
  const push = (stop: Omit<BandStop, 'n'>, far: boolean): void => {
    let n = 0;
    if (stop.kind === 'island') n = far ? farIsland++ + 9 : nearIsland++;
    else if (stop.kind === 'monolith') n = far ? farMono++ + 4 : nearMono++;
    band.push({ ...stop, n });
  };
  for (let i = 0; i < 8; i++) {
    const z = 16 + i * 28;
    if (s === 0 && Math.abs(z - GATE_Z) < 26) continue;
    const deep = i % 2 === 0 ? 0 : 1;
    const high = 1 - deep;
    const under = below[i % below.length];
    const over = above[i % above.length];
    const featured = (s === 1 && i === 1) || i === 5;
    if (s === 1 && i === 1) {
      push({
        z: portrait ? z + 14 : z,
        side: high as 0 | 1,
        rise: 3.2,
        kind: 'orbit',
        outward: portrait ? 4.6 : 0,
        sink: false
      }, false);
    } else if (i === 5) {
      push({
        z: portrait ? z + 14 : z,
        side: high as 0 | 1,
        rise: 1.4,
        kind: 'planet',
        outward: portrait ? 3.2 : 0,
        sink: false
      }, false);
    } else {
      push({ z, side: high as 0 | 1, rise: over, kind: 'island', outward: 0, sink: false }, false);
    }
    push({
      z,
      side: deep as 0 | 1,
      rise: under,
      kind: i % 3 === 1 ? 'monolith' : 'island',
      outward: 0,
      sink: false
    }, false);
    if (!featured) {
      push({
        z: z + 8,
        side: high as 0 | 1,
        rise: -3.6,
        kind: 'island',
        outward: 0,
        sink: true
      }, false);
    }
    if (!portrait) {
      push({
        z: z + 14,
        side: deep as 0 | 1,
        rise: i % 2 === 0 ? 0.15 : -1.4,
        kind: 'monolith',
        outward: 4,
        sink: false
      }, true);
      push({
        z: z + 14,
        side: high as 0 | 1,
        rise: i % 2 === 0 ? -2.8 : 5.1,
        kind: 'island',
        outward: 4,
        sink: false
      }, true);
    }
  }
  const places: VoidPlacement[] = band.map((stop) => {
    let index = planet;
    if (stop.kind === 'island') index = (island + stop.n) % VOID_ISLANDS.length;
    else if (stop.kind === 'monolith') index = (monolith + stop.n) % VOID_MONOLITHS.length;
    else if (stop.kind === 'orbit') index = orbit;
    return {
      kind: stop.kind,
      index,
      side: sides[stop.side],
      z: stop.z,
      outward: stop.outward,
      rise: stop.rise,
      sink: stop.sink
    };
  });
  if (s === 0) places.push({ kind: 'gate', index: gate, side: 1, z: GATE_Z, outward: 0, rise: 0, sink: false });
  return places;
}

const STONE = [VOID_STONE.midnight, VOID_STONE.face, VOID_STONE.lit, VOID_STONE.highlight];

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function srgb(hex: number): [number, number, number] {
  const ch = (byte: number): number => {
    const s = byte / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return [ch((hex >> 16) & 255), ch((hex >> 8) & 255), ch(hex & 255)];
}

/** Two small chips tucked against the outer face of one structure. */
function pushDebris(
  into: { pos: number[]; col: number[] },
  box: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number },
  side: 1 | -1,
  salt: number
): void {
  const rng = mulberry32(salt);
  const outer = side > 0 ? box.maxX : box.minX;
  const spanZ = Math.max(0.6, box.maxZ - box.minZ);
  const spanY = Math.max(0.4, box.maxY - box.minY);
  for (let i = 0; i < 2; i++) {
    const x = outer + side * (0.25 + rng() * 0.4);
    const y = box.minY + (0.2 + rng() * 0.55) * spanY;
    const z = box.minZ + rng() * spanZ;
    if (Math.abs(x) < VOID_PLAY_HALF_X + 0.6 && y > VOID_PLAY_Y0 && y < VOID_PLAY_Y1) continue;
    emitChip(into, x, y, z, 0.16 + rng() * 0.22, rng, side);
  }
}

function inPlay(x: number, y: number): boolean {
  return Math.abs(x) < VOID_PLAY_HALF_X && y > VOID_PLAY_Y0 && y < VOID_PLAY_Y1;
}

function emitChip(
  into: { pos: number[]; col: number[] },
  x: number, y: number, z: number,
  size: number,
  rng: () => number,
  side: 1 | -1
): void {
  const ico = new IcosahedronGeometry(1, 0);
  const attr = ico.getAttribute('position');
  const sx = size * (0.75 + rng() * 0.4);
  const sy = size * (0.6 + rng() * 0.35);
  const sz = size * (0.75 + rng() * 0.45);
  const yaw = rng() * Math.PI * 2;
  const cyaw = Math.cos(yaw);
  const syaw = Math.sin(yaw);
  const pts: number[][] = [];
  const cols: number[][] = [];
  for (let i = 0; i < attr.count; i += 3) {
    const face: number[][] = [];
    for (let k = 0; k < 3; k++) {
      const px = attr.getX(i + k) * sx;
      const py = attr.getY(i + k) * sy;
      const pz = attr.getZ(i + k) * sz;
      face.push([x + px * cyaw + pz * syaw, y + py, z - px * syaw + pz * cyaw]);
    }
    const ax = face[1][0] - face[0][0];
    const ay = face[1][1] - face[0][1];
    const az = face[1][2] - face[0][2];
    const bx = face[2][0] - face[0][0];
    const by = face[2][1] - face[0][1];
    const bz = face[2][2] - face[0][2];
    const ny = az * bx - ax * bz;
    const len = Math.hypot(ay * bz - az * by, ny, ax * by - ay * bx) || 1;
    const hex = ny / len > 0.45 ? VOID_STONE.highlight : STONE[Math.floor(rng() * STONE.length)];
    const rgb = srgb(hex);
    for (const p of face) {
      pts.push(p);
      cols.push(rgb);
    }
  }
  ico.dispose();
  if (pts.some((p) => inPlay(p[0], p[1]))) {
    const dir = Math.sign(x || side) || side;
    for (const p of pts) p[0] += dir * (VOID_PLAY_HALF_X + 0.4 - Math.abs(p[0]) + size);
  }
  if (pts.some((p) => inPlay(p[0], p[1]))) return;
  for (let i = 0; i < pts.length; i++) {
    into.pos.push(pts[i][0], pts[i][1], pts[i][2]);
    into.col.push(cols[i][0], cols[i][1], cols[i][2]);
  }
}

function shift(geo: BufferGeometry, dx: number, dy: number, dz: number): void {
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    pos.setX(i, pos.getX(i) + dx);
    pos.setY(i, pos.getY(i) + dy);
    pos.setZ(i, pos.getZ(i) + dz);
  }
}

/** Hang a rock under the path. Tops stay below the hop corridor, so the camera still looks down onto the stone. */
function sinkUnder(geo: BufferGeometry, side: 1 | -1): void {
  const pos = geo.getAttribute('position');
  let maxY = -Infinity;
  let sumX = 0;
  for (let i = 0; i < pos.count; i++) {
    maxY = Math.max(maxY, pos.getY(i));
    sumX += pos.getX(i);
  }
  const dx = side * 2.6 - sumX / pos.count;
  const drop = Math.max(0, maxY - (VOID_PLAY_Y0 - 0.45));
  for (let i = 0; i < pos.count; i++) {
    pos.setX(i, pos.getX(i) + dx);
    pos.setY(i, pos.getY(i) - drop);
  }
}
function seatTo(geo: BufferGeometry, side: 1 | -1, edge: number): void {
  const pos = geo.getAttribute('position');
  let minAbs = Infinity;
  for (let i = 0; i < pos.count; i++) minAbs = Math.min(minAbs, Math.abs(pos.getX(i)));
  const pull = minAbs - edge;
  if (pull <= 0) return;
  for (let i = 0; i < pos.count; i++) pos.setX(i, pos.getX(i) - side * pull);
}

function append(into: { pos: number[]; col: number[] }, geo: BufferGeometry): void {
  const pos = geo.getAttribute('position');
  const col = geo.getAttribute('color');
  for (let i = 0; i < pos.count; i++) {
    into.pos.push(pos.getX(i), pos.getY(i), pos.getZ(i));
    into.col.push(col.getX(i), col.getY(i), col.getZ(i));
  }
  geo.dispose();
}

function pieceGeometry(place: VoidPlacement, portrait: boolean): BufferGeometry {
  let geo: BufferGeometry;
  let authoredZ = 0;
  if (place.kind === 'gate') {
    const spec = VOID_GATES[place.index];
    geo = buildGateVariation(spec);
    authoredZ = spec.z;
  } else if (place.kind === 'planet') {
    const spec = VOID_PLANETS[place.index];
    geo = buildPlanetVariation(spec, place.side);
    authoredZ = spec.z;
  } else if (place.kind === 'orbit') {
    const spec = VOID_ORBITS[place.index];
    geo = buildOrbitVariation(spec, place.side);
    authoredZ = spec.z;
  } else if (place.kind === 'island') {
    const spec = VOID_ISLANDS[place.index];
    geo = buildIslandVariation(spec, place.side);
    authoredZ = spec.z;
  } else {
    const spec = VOID_MONOLITHS[place.index];
    geo = buildMonolithVariation(spec, place.side);
    authoredZ = spec.z;
  }
  shift(geo, place.side * place.outward, place.rise, place.z - authoredZ);
  if (place.sink) {
    sinkUnder(geo, place.side);
    return geo;
  }
  if (place.kind === 'island' || place.kind === 'monolith') {
    if (place.outward < 2) {
      const edge = place.rise < -2
        ? VOID_PLAY_HALF_X + (portrait ? 0.8 : 2.2)
        : place.rise < 2
          ? VOID_PLAY_HALF_X + (portrait ? 0.35 : 1.6)
          : (portrait ? 7.6 : 7.0);
      seatTo(geo, place.side, edge);
    } else if (!portrait) {
      const edge = place.rise < -2 ? 10.4 : place.rise < 2 ? 11.0 : 12.6;
      seatTo(geo, place.side, edge);
    }
  }
  return geo;
}

/** One merged segment. Only the pieces the plan picked, each still a finished variation. */
export function buildVoidFieldSegment(seed: number, slot: number, portrait: boolean): BufferGeometry {
  const acc = { pos: [] as number[], col: [] as number[] };
  const places = planVoidSegment(seed, slot, portrait);
  places.forEach((place, i) => {
    const geo = pieceGeometry(place, portrait);
    const pos = geo.getAttribute('position');
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let v = 0; v < pos.count; v++) {
      const x = pos.getX(v);
      const y = pos.getY(v);
      const z = pos.getZ(v);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
    append(acc, geo);
    pushDebris(acc, { minX, maxX, minY, maxY, minZ, maxZ }, place.side, (seed * 17 + slot * 131 + i * 97 + place.z) >>> 0);
  });
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(acc.pos, 3));
  geo.setAttribute('color', new Float32BufferAttribute(acc.col, 3));
  return geo;
}

export function buildVoidFieldSegments(seed: number, count: number, portrait: boolean): BufferGeometry[] {
  const geos: BufferGeometry[] = [];
  for (let k = 0; k < count; k++) geos.push(buildVoidFieldSegment(seed, k, portrait));
  return geos;
}

export function fieldClearsPlay(geo: BufferGeometry): boolean {
  return gateClearsPlay(geo);
}
