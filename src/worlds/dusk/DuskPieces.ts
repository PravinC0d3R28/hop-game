/**
 * One Dusk District piece at a time.
 *
 * Each builder returns the faces and the dark outline. The lab looks at a
 * single piece. The street planter uses the same builders, so a shape that
 * is wrong in the lab is wrong in the game.
 */
import { BufferGeometry, Float32BufferAttribute } from 'three';

export interface DuskPiece {
  name: string;
  face: BufferGeometry;
  shell: BufferGeometry;
  /** Hot centre of each window. Drawn additively so the light blooms out of the glass. */
  glow: BufferGeometry;
}

interface Acc {
  pos: number[];
  nor: number[];
  col: number[];
}

const SHELL = 0.055;

function cross(a: number[], b: number[], c: number[]): [number, number, number] {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  return [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
}

/** Authored hex is sRGB. The renderer treats vertex colours as linear and encodes on output. */
function srgbToLinear(byte: number): number {
  const u = byte / 255;
  return u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4;
}

function pushTri(acc: Acc, shell: Acc | null, a: number[], b: number[], c: number[], color: number, center: number[]): void {
  let nx = 0, ny = 0, nz = 0;
  [nx, ny, nz] = cross(a, b, c);
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
    acc.pos.push(p[0], p[1], p[2]);
    acc.nor.push(nx, ny, nz);
    acc.col.push(r, g, bl);
    if (shell) {
      shell.pos.push(p[0] + nx * SHELL, p[1] + ny * SHELL, p[2] + nz * SHELL);
    }
  }
}

function bake(acc: Acc, color: boolean): BufferGeometry {
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(acc.pos, 3));
  if (color) geo.setAttribute('color', new Float32BufferAttribute(acc.col, 3));
  return geo;
}

type FaceTone = number | {
  nz: number; pz: number; nx: number; px: number; top: number; bottom: number;
};

function toneOf(color: FaceTone, face: 'nz' | 'pz' | 'nx' | 'px' | 'top' | 'bottom'): number {
  return typeof color === 'number' ? color : color[face];
}

function box(
  face: Acc, shell: Acc | null,
  x0: number, y0: number, z0: number,
  x1: number, y1: number, z1: number,
  color: FaceTone
): void {
  const c = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
  const v = (x: number, y: number, z: number) => [x, y, z];
  const quad = (a: number[], b: number[], d: number[], e: number[], key: 'nz' | 'pz' | 'nx' | 'px' | 'top' | 'bottom') => {
    const paint = toneOf(color, key);
    pushTri(face, shell, a, b, d, paint, c);
    pushTri(face, shell, a, d, e, paint, c);
  };
  quad(v(x0, y1, z0), v(x0, y1, z1), v(x1, y1, z1), v(x1, y1, z0), 'top');
  quad(v(x0, y0, z0), v(x1, y0, z0), v(x1, y0, z1), v(x0, y0, z1), 'bottom');
  quad(v(x1, y0, z0), v(x1, y1, z0), v(x1, y1, z1), v(x1, y0, z1), 'px');
  quad(v(x0, y0, z1), v(x0, y1, z1), v(x0, y1, z0), v(x0, y0, z0), 'nx');
  quad(v(x0, y0, z1), v(x1, y0, z1), v(x1, y1, z1), v(x0, y1, z1), 'pz');
  quad(v(x1, y0, z0), v(x0, y0, z0), v(x0, y1, z0), v(x1, y1, z0), 'nz');
}

/** A box that can taper, and whose top can sit off the bottom's centre. */
function wedge(
  face: Acc,
  x0: number, y0: number, z0: number, hx0: number, hz0: number,
  x1: number, y1: number, z1: number, hx1: number, hz1: number,
  color: FaceTone
): void {
  const b0 = [x0 - hx0, y0, z0 - hz0];
  const b1 = [x0 + hx0, y0, z0 - hz0];
  const b2 = [x0 + hx0, y0, z0 + hz0];
  const b3 = [x0 - hx0, y0, z0 + hz0];
  const t0 = [x1 - hx1, y1, z1 - hz1];
  const t1 = [x1 + hx1, y1, z1 - hz1];
  const t2 = [x1 + hx1, y1, z1 + hz1];
  const t3 = [x1 - hx1, y1, z1 + hz1];
  const mid = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
  const quad = (a: number[], b: number[], c: number[], d: number[], key: 'nz' | 'pz' | 'nx' | 'px' | 'top' | 'bottom') => {
    const paint = toneOf(color, key);
    pushTri(face, null, a, b, c, paint, mid);
    pushTri(face, null, a, c, d, paint, mid);
  };
  quad(b0, b1, t1, t0, 'nz');
  quad(b2, b3, t3, t2, 'pz');
  quad(b3, b0, t0, t3, 'nx');
  quad(b1, b2, t2, t1, 'px');
  quad(t0, t1, t2, t3, 'top');
  quad(b0, b3, b2, b1, 'bottom');
}

function pyramid(
  face: Acc, shell: Acc | null,
  cx: number, y: number, cz: number,
  hx: number, hz: number, height: number,
  color: number
): void {
  const apex = [cx, y + height, cz];
  const p0 = [cx - hx, y, cz - hz];
  const p1 = [cx + hx, y, cz - hz];
  const p2 = [cx + hx, y, cz + hz];
  const p3 = [cx - hx, y, cz + hz];
  const center = [cx, y + height * 0.35, cz];
  for (const [a, b] of [[p0, p1], [p1, p2], [p2, p3], [p3, p0]] as number[][][]) {
    pushTri(face, shell, apex, a, b, color, center);
  }
}

/**
 * Dark, and not one flat brown. The front and the top are a warm charcoal,
 * the back and the underside are near black, so the housing has contrast.
 */
const HOUSING: FaceTone = {
  nz: 0x1c1612,
  pz: 0x0a0807,
  nx: 0x100d0b,
  px: 0x16120e,
  top: 0x3a2c22,
  bottom: 0x080605
};

const GLASS = 0xff6a12;
const HOT = 0xfff4c8;

/** A lit opening. The face toward the path is the bright pane. */
const WELL: FaceTone = {
  nz: 0xffb45a,
  pz: 0x6a2808,
  nx: 0xc45218,
  px: 0xe06820,
  top: 0xffc878,
  bottom: 0x4a1808
};
const WELL_HOT = 0xffe0a8;

export type LanternTone = 'amber' | 'rose';

/**
 * The hanging lamp from the reference.
 *
 * A dark housing, a short cap, and a bright window that is most of the face.
 * The window is what you should see. The cap is small on purpose: a tall
 * roof makes this read as a little house.
 */
export function buildLantern(tone: LanternTone = 'amber'): DuskPiece {
  const face: Acc = { pos: [], nor: [], col: [] };
  const glowAcc: Acc = { pos: [], nor: [], col: [] };
  const glass = tone === 'rose' ? 0xff4d6a : GLASS;
  const hot = tone === 'rose' ? 0xffd0dc : HOT;

  // One solid. Every part starts inside the part under it.
  const w = 0.52;
  box(face, null, -0.66, 0, -0.66, 0.66, 0.24, 0.66, HOUSING);
  box(face, null, -w, 0.1, -w, w, 1.5, w, HOUSING);
  box(face, null, -0.6, 1.36, -0.6, 0.6, 1.58, 0.6, HOUSING);
  pyramid(face, null, 0, 1.42, 0, 0.5, 0.5, 0.52, 0x1a1410);
  box(face, null, -0.05, 1.78, -0.05, 0.05, 2.16, 0.05, 0x0c0908);

  const y0 = 0.42;
  const y1 = 1.22;
  const hw = 0.28;
  // Glass is deep amber. The hot centre is a smaller box inside it, drawn
  // additively, so the light reads as coming from inside the housing.
  const sunk = w - 0.1;
  const proud = w + 0.02;
  const paintWindow = (axis: 'x' | 'z', sign: number) => {
    const a = sign > 0 ? sunk : -proud;
    const b = sign > 0 ? proud : -sunk;
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    if (axis === 'z') box(face, null, -hw, y0, lo, hw, y1, hi, glass);
    else box(face, null, lo, y0, -hw, hi, y1, hw, glass);
    // Just past the glass, so the bloom is not hidden behind the pane.
    const outer = sign > 0 ? proud + 0.03 : -(w + 0.06);
    const inner = sign > 0 ? w + 0.06 : -(proud + 0.03);
    const clo = Math.min(outer, inner);
    const chi = Math.max(outer, inner);
    if (axis === 'z') box(glowAcc, null, -hw * 0.55, y0 + 0.12, clo, hw * 0.55, y1 - 0.12, chi, hot);
    else box(glowAcc, null, clo, y0 + 0.12, -hw * 0.55, chi, y1 - 0.12, hw * 0.55, hot);
  };
  paintWindow('z', 1);
  paintWindow('z', -1);
  paintWindow('x', 1);
  paintWindow('x', -1);

  return finish(tone === 'rose' ? 'lantern-rose' : 'lantern-amber', face, glowAcc);
}

function finish(name: string, face: Acc, glow: Acc): DuskPiece {
  const empty: Acc = { pos: [], nor: [], col: [] };
  return { name, face: bake(face, true), shell: bake(empty, false), glow: bake(glow, true) };
}

/**
 * The wall lamp in the reference: wider at the bottom, a real roof, a tall
 * window, and a bracket that meets the wall behind it.
 */
export function buildPictureLantern(tone: 'amber' | 'rose' = 'amber'): DuskPiece {
  const face: Acc = { pos: [], nor: [], col: [] };
  const glowAcc: Acc = { pos: [], nor: [], col: [] };
  const glass = tone === 'rose' ? 0xff4d78 : GLASS;
  const hot = tone === 'rose' ? 0xffb4cc : HOT;
  box(face, null, -0.74, 0, -0.74, 0.74, 0.2, 0.74, HOUSING);
  wedge(face, 0, 0.06, 0, 0.66, 0.66, 0, 1.52, 0, 0.4, 0.4, HOUSING);
  pyramid(face, null, 0, 1.44, 0, 0.4, 0.4, 0.52, 0x1a1410);
  box(face, null, -0.1, 0.66, 0.2, 0.1, 1.04, 1.35, 0x120e0c);

  // Deep glass on the face. The hot centre sits just in front of that glass.
  const pane = (
    x0: number, z0: number, hx0: number, hz0: number,
    x1: number, z1: number, hx1: number, hz1: number
  ) => {
    wedge(face, x0, 0.36, z0, hx0, hz0, x1, 1.24, z1, hx1, hz1, glass);
    const sx = Math.sign(x0);
    const sz = Math.sign(z0);
    wedge(
      glowAcc,
      x0 + sx * 0.02, 0.48, z0 + sz * 0.02, hx0 * 0.62, hz0 * 1.15,
      x1 + sx * 0.02, 1.12, z1 + sz * 0.02, hx1 * 0.62, hz1 * 1.15,
      hot
    );
  };
  pane(0, -0.58, 0.34, 0.09, 0, -0.44, 0.2, 0.09);
  pane(0, 0.58, 0.34, 0.09, 0, 0.44, 0.2, 0.09);
  pane(-0.58, 0, 0.09, 0.34, -0.44, 0, 0.09, 0.2);
  pane(0.58, 0, 0.09, 0.34, 0.44, 0, 0.09, 0.2);
  return finish(tone === 'rose' ? 'lantern-rose' : 'lantern-picture', face, glowAcc);
}

/**
 * A lamp in the air. The body is the whole object: a glowing diamond,
 * nothing to hang it from and nothing for it to stand on.
 */
export function buildFloatLantern(tone: 'amber' | 'rose' = 'amber'): DuskPiece {
  const face: Acc = { pos: [], nor: [], col: [] };
  const glowAcc: Acc = { pos: [], nor: [], col: [] };
  const skin: FaceTone = tone === 'rose'
    ? { nz: 0xffe4ec, pz: 0xc43a58, px: 0xff7f95, nx: 0xe05878, top: 0xffb4cc, bottom: 0xa03048 }
    : { nz: 0xfff6d4, pz: 0xc4480e, px: 0xff9a32, nx: 0xd06012, top: 0xffc56a, bottom: 0xb8440c };
  const hot = tone === 'rose' ? 0xffd0dc : HOT;
  wedge(face, 0, 0.2, 0, 0.08, 0.08, 0, 0.7, 0, 0.36, 0.36, skin);
  wedge(face, 0, 0.7, 0, 0.36, 0.36, 0, 1.22, 0, 0.07, 0.07, skin);
  wedge(glowAcc, 0, 0.38, 0, 0.05, 0.05, 0, 0.74, 0, 0.18, 0.18, hot);
  wedge(glowAcc, 0, 0.74, 0, 0.18, 0.18, 0, 1.02, 0, 0.04, 0.04, hot);
  return finish(tone === 'rose' ? 'lantern-float-rose' : 'lantern-float', face, glowAcc);
}

/**
 * A lantern that sits on a spire. The foot is the seat, the glass is the
 * body, and the cap is part of the lamp. There is no bracket and no hook.
 */
export function buildBeaconLantern(tone: 'amber' | 'rose' = 'amber'): DuskPiece {
  const face: Acc = { pos: [], nor: [], col: [] };
  const glowAcc: Acc = { pos: [], nor: [], col: [] };
  const glass = tone === 'rose' ? 0xff4d78 : GLASS;
  const hot = tone === 'rose' ? 0xffb4cc : HOT;
  box(face, null, -0.34, 0, -0.34, 0.34, 0.14, 0.34, HOUSING);
  box(face, null, -0.22, 0.08, -0.22, 0.22, 0.7, 0.22, HOUSING);
  pyramid(face, null, 0, 0.58, 0, 0.26, 0.26, 0.32, 0x1a1410);
  const pane = (axis: 'x' | 'z', sign: number) => {
    const sunk = 0.16;
    const proud = 0.24;
    const a = sign > 0 ? sunk : -proud;
    const b = sign > 0 ? proud : -sunk;
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    if (axis === 'z') box(face, null, -0.12, 0.22, lo, 0.12, 0.58, hi, glass);
    else box(face, null, lo, 0.22, -0.12, hi, 0.58, 0.12, glass);
    const outer = sign > 0 ? proud + 0.03 : -0.27;
    const inner = sign > 0 ? 0.27 : -(proud + 0.03);
    const clo = Math.min(outer, inner);
    const chi = Math.max(outer, inner);
    if (axis === 'z') box(glowAcc, null, -0.07, 0.3, clo, 0.07, 0.52, chi, hot);
    else box(glowAcc, null, clo, 0.3, -0.07, chi, 0.52, 0.07, hot);
  };
  pane('z', -1);
  pane('z', 1);
  pane('x', -1);
  pane('x', 1);
  return finish(tone === 'rose' ? 'lantern-beacon-rose' : 'lantern-beacon', face, glowAcc);
}

/**
 * One bay of the canyon wall: a warm face, a pointed arch, a pitched roof.
 * The front (negative Z) is the face that turns toward the path.
 */
export function buildArchHouse(): DuskPiece {
  const face: Acc = { pos: [], nor: [], col: [] };
  const glowAcc: Acc = { pos: [], nor: [], col: [] };
  const { wall, shade, roof } = canyonTones();

  box(face, null, -1.15, 0, -0.62, 1.15, 2.7, 0.62, wall);
  box(face, null, -1.28, 0, -0.72, 1.28, 0.38, 0.72, shade);
  box(face, null, -1.36, 2.48, -0.86, 1.36, 2.76, 0.86, shade);
  wedge(face, 0, 2.58, 0, 1.22, 0.74, 0, 3.42, 0, 1.02, 0.05, roof);

  // The wall face is z=-0.62. The opening only clears it by a hair,
  // so it reads as a hole in the wall rather than a block stuck on the front.
  // FaceTone, not number: the well passes a shaded tone and a number-only
  // signature made that one call fail to typecheck.
  const arch = (z0: number, z1: number, hx: number, color: FaceTone) => {
    const lo = Math.min(z0, z1);
    const hi = Math.max(z0, z1);
    box(face, null, -hx, 0.32, lo, hx, 1.68, hi, color);
    wedge(face, 0, 1.5, (z0 + z1) / 2, hx, Math.abs(z1 - z0) / 2, 0, 2.22, (z0 + z1) / 2, 0.02, 0.02, color);
  };
  arch(-0.66, -0.58, 0.52, 0x3b2146);
  arch(-0.70, -0.64, 0.38, WELL);
  box(glowAcc, null, -0.2, 0.55, -0.78, 0.2, 1.45, -0.72, WELL_HOT);
  wedge(glowAcc, 0, 1.3, -0.75, 0.16, 0.02, 0, 1.95, -0.75, 0.02, 0.02, WELL_HOT);

  return finish('house-arch', face, glowAcc);
}

/**
 * The narrow skyline tower: a warm face, a darker side, a collar, and a steep cap.
 * The front (negative Z) turns toward the path.
 */
export function buildTower(): DuskPiece {
  const face: Acc = { pos: [], nor: [], col: [] };
  const { wall, shade, roof } = canyonTones();
  const shaft = wall;
  const upper = wall;
  const band = shade;
  const cap = roof;

  box(face, null, -0.58, 0, -0.58, 0.58, 0.32, 0.58, band);
  wedge(face, 0, 0.16, 0, 0.46, 0.46, 0, 2.35, 0, 0.4, 0.4, shaft);
  box(face, null, -0.5, 2.18, -0.5, 0.5, 2.42, 0.5, band);
  wedge(face, 0, 2.28, 0, 0.36, 0.36, 0, 3.85, 0, 0.3, 0.3, upper);
  box(face, null, -0.42, 3.68, -0.42, 0.42, 3.92, 0.42, band);
  wedge(face, 0, 3.78, 0, 0.4, 0.4, 0, 4.85, 0, 0.03, 0.03, cap);

  return finish('tower-cap', face, { pos: [], nor: [], col: [] });
}

/**
 * The right-hand canyon block: a lower wall, a balcony toward the path,
 * and a smaller story set back behind the rail.
 */
export function buildTerrace(): DuskPiece {
  const face: Acc = { pos: [], nor: [], col: [] };
  const glowAcc: Acc = { pos: [], nor: [], col: [] };
  const { wall, shade, roof } = canyonTones();
  const slab: FaceTone = {
    nz: 0x713050,
    pz: 0x261631,
    nx: 0x3b2146,
    px: 0x5a2c59,
    top: 0xc65363,
    bottom: 0x1a1024
  };

  const top = 1.58;
  box(face, null, -1.25, 0, -0.55, 1.25, top + 0.08, 0.7, wall);
  box(face, null, -1.38, 0, -0.65, 1.38, 0.28, 0.78, shade);
  // Same plan as the bottom base. Only the front continues out as the balcony.
  box(face, null, -1.38, top, -1.22, 1.38, top + 0.26, 0.78, slab);

  // A low wall on the outer edge. The sides turn back and die into the upper story.
  const y0 = top + 0.18;
  const y1 = top + 0.62;
  box(face, null, -1.24, y0, -1.1, 1.24, y1, -0.96, shade);
  box(face, null, -1.24, y0, -1.1, -1.1, y1, -0.28, shade);
  box(face, null, 1.1, y0, -1.1, 1.24, y1, -0.28, shade);
  box(face, null, -1.24, y0, -0.42, -0.58, y1, -0.28, shade);
  box(face, null, 0.58, y0, -0.42, 1.24, y1, -0.28, shade);

  box(face, null, -0.72, top + 0.12, -0.35, 0.72, 3.05, 0.55, wall);
  box(face, null, -0.88, 2.88, -0.5, 0.88, 3.12, 0.66, shade);
  wedge(face, 0, 2.96, 0.06, 0.76, 0.5, 0, 3.7, 0.06, 0.6, 0.04, roof);

  slit(face, glowAcc, -0.62, 0.42, top - 0.14, -0.55, 0.14);
  slit(face, glowAcc, 0.62, 0.42, top - 0.14, -0.55, 0.14);
  slit(face, glowAcc, 0, top + 0.55, 2.68, -0.35, 0.14);

  return finish('terrace', face, glowAcc);
}

/**
 * A run of pointed arches under one roof. The front (negative Z) turns toward the path.
 */
export function buildArcade(): DuskPiece {
  const face: Acc = { pos: [], nor: [], col: [] };
  const glowAcc: Acc = { pos: [], nor: [], col: [] };
  const { wall, shade, roof } = canyonTones();

  const top = 2.05;
  box(face, null, -1.72, 0, -0.52, 1.72, top + 0.08, 0.52, wall);
  box(face, null, -1.9, 0, -0.66, 1.9, 0.26, 0.66, shade);
  box(face, null, -1.9, top, -0.66, 1.9, top + 0.24, 0.66, shade);
  wedge(face, 0, top + 0.08, 0, 1.74, 0.56, 0, 2.85, 0, 1.48, 0.04, roof);

  const bay = (x: number) => {
    box(face, null, x - 0.3, 0.32, -0.6, x + 0.3, 1.28, -0.52, 0x3b2146);
    wedge(face, x, 1.16, -0.56, 0.3, 0.04, x, 1.68, -0.56, 0.02, 0.02, 0x3b2146);
    box(face, null, x - 0.2, 0.4, -0.64, x + 0.2, 1.18, -0.58, WELL);
    wedge(face, x, 1.08, -0.61, 0.2, 0.03, x, 1.58, -0.61, 0.02, 0.02, WELL);
    box(glowAcc, null, x - 0.1, 0.55, -0.72, x + 0.1, 1.05, -0.66, WELL_HOT);
    wedge(glowAcc, x, 1.0, -0.69, 0.08, 0.02, x, 1.4, -0.69, 0.02, 0.02, WELL_HOT);
  };
  bay(-1.05);
  bay(0);
  bay(1.05);

  return finish('arcade', face, glowAcc);
}

/**
 * A wall whose roof climbs in three slabs. The front (negative Z) turns toward the path.
 */
export function buildStepRoof(): DuskPiece {
  const face: Acc = { pos: [], nor: [], col: [] };
  const glowAcc: Acc = { pos: [], nor: [], col: [] };
  const { wall, shade, roof } = canyonTones();
  const step = roof;

  box(face, null, -1.2, 0, -0.55, 1.2, 1.7, 0.55, wall);
  box(face, null, -1.36, 0, -0.68, 1.36, 0.26, 0.68, shade);
  box(face, null, -1.36, 1.55, -0.68, 1.36, 1.82, 0.68, shade);
  box(face, null, -0.92, 1.7, -0.48, 0.92, 2.28, 0.48, step);
  box(face, null, -0.52, 2.14, -0.32, 0.52, 2.78, 0.32, wall);
  wedge(face, 0, 2.62, 0, 0.4, 0.26, 0, 3.25, 0, 0.03, 0.03, step);

  slit(face, glowAcc, 0, 0.48, 1.22, -0.55, 0.16);

  return finish('step-roof', face, glowAcc);
}

function canyonTones(): { wall: FaceTone; shade: FaceTone; roof: FaceTone } {
  return {
    // The face toward the path is sunlit peach. The sides and the roof stay plum.
    wall: {
      nz: 0xf07868,
      pz: 0x1a1024,
      nx: 0x4a1868,
      px: 0xf49a67,
      top: 0x6a2458,
      bottom: 0x140c18
    },
    shade: {
      nz: 0x8a3058,
      pz: 0x140c18,
      nx: 0x2a1030,
      px: 0x5a2048,
      top: 0x3a1450,
      bottom: 0x100810
    },
    roof: {
      nz: 0x3a1848,
      pz: 0x120810,
      nx: 0x1a1020,
      px: 0x2a1438,
      top: 0x241030,
      bottom: 0x0c0810
    }
  };
}

function slit(face: Acc, glow: Acc, x: number, y0: number, y1: number, zFace: number, half = 0.12): void {
  box(face, null, x - half, y0, zFace - 0.05, x + half, y1, zFace + 0.02, WELL);
  const inset = half * 0.55;
  const pad = Math.max(0.05, (y1 - y0) * 0.16);
  box(glow, null, x - inset, y0 + pad, zFace - 0.1, x + inset, y1 - pad, zFace - 0.055, WELL_HOT);
}

/** A flat wall with a notched top. */
export function buildParapet(): DuskPiece {
  const face: Acc = { pos: [], nor: [], col: [] };
  const glowAcc: Acc = { pos: [], nor: [], col: [] };
  const { wall, shade } = canyonTones();
  box(face, null, -1.65, 0, -0.42, 1.65, 1.7, 0.42, wall);
  box(face, null, -1.82, 0, -0.55, 1.82, 0.24, 0.55, shade);
  for (const x of [-1.28, -0.64, 0, 0.64, 1.28]) {
    box(face, null, x - 0.2, 1.55, -0.5, x + 0.2, 2.15, 0.5, shade);
  }
  slit(face, glowAcc, -0.7, 0.5, 1.2, -0.42);
  slit(face, glowAcc, 0.7, 0.5, 1.2, -0.42);
  return finish('parapet', face, glowAcc);
}

/** Steps climbing the face of a short wall. */
export function buildStair(): DuskPiece {
  const face: Acc = { pos: [], nor: [], col: [] };
  const { wall, shade } = canyonTones();
  box(face, null, -1.35, 0, -0.2, 1.4, 2.15, 0.55, wall);
  box(face, null, -1.5, 0, -0.32, 1.52, 0.22, 0.66, shade);
  for (let i = 0; i < 5; i++) {
    const x0 = -1.2 + i * 0.48;
    box(face, null, x0, 0, -1.05, x0 + 0.56, 0.36 + i * 0.34, 0.02, shade);
  }
  return finish('stair', face, { pos: [], nor: [], col: [] });
}

/** A sheer canyon mass. Darker at the foot, warmer as it rises. */
export function buildCliff(): DuskPiece {
  const face: Acc = { pos: [], nor: [], col: [] };
  const { wall, shade, roof } = canyonTones();
  box(face, null, -0.95, 0, -0.72, 0.95, 1.45, 0.72, shade);
  box(face, null, -0.78, 1.25, -0.58, 0.78, 2.7, 0.58, wall);
  box(face, null, -0.58, 2.5, -0.42, 0.58, 3.85, 0.42, roof);
  box(face, null, -0.7, 3.68, -0.52, 0.7, 3.92, 0.52, shade);
  return finish('cliff', face, { pos: [], nor: [], col: [] });
}

/** A flat facade with a row of tall rectangular openings. */
export function buildWindows(): DuskPiece {
  const face: Acc = { pos: [], nor: [], col: [] };
  const glowAcc: Acc = { pos: [], nor: [], col: [] };
  const { wall, shade, roof } = canyonTones();
  const top = 2.15;
  box(face, null, -1.55, 0, -0.5, 1.55, top + 0.08, 0.5, wall);
  box(face, null, -1.72, 0, -0.64, 1.72, 0.24, 0.64, shade);
  box(face, null, -1.72, top, -0.64, 1.72, top + 0.22, 0.64, shade);
  wedge(face, 0, top + 0.08, 0, 1.55, 0.52, 0, 2.7, 0, 1.3, 0.04, roof);
  for (const x of [-0.9, -0.3, 0.3, 0.9]) slit(face, glowAcc, x, 0.55, 1.65, -0.5, 0.14);
  return finish('windows', face, glowAcc);
}

/** Two piers and an open pointed arch between them. */
export function buildGate(): DuskPiece {
  const face: Acc = { pos: [], nor: [], col: [] };
  const glowAcc: Acc = { pos: [], nor: [], col: [] };
  const { wall, shade, roof } = canyonTones();
  box(face, null, -1.35, 0, -0.55, 1.35, 0.24, 0.55, shade);
  box(face, null, -1.2, 0, -0.42, -0.4, 2.45, 0.42, wall);
  box(face, null, 0.4, 0, -0.42, 1.2, 2.45, 0.42, wall);
  box(face, null, -1.28, 2.15, -0.55, 1.28, 2.5, 0.55, shade);
  wedge(face, 0, 2.28, 0, 0.4, 0.4, 0, 1.4, 0, 0.02, 0.02, shade);
  wedge(face, 0, 2.38, 0, 1.15, 0.48, 0, 3.05, 0, 0.95, 0.04, roof);
  box(glowAcc, null, -0.18, 0.7, -0.52, 0.18, 1.55, -0.46, WELL_HOT);
  wedge(glowAcc, 0, 1.4, -0.49, 0.14, 0.02, 0, 2.05, -0.49, 0.02, 0.02, WELL_HOT);
  return finish('gate', face, glowAcc);
}

/** A short post. Meant to sit well below the house roofs. */
export function buildPillarStub(): DuskPiece {
  const face: Acc = { pos: [], nor: [], col: [] };
  const { wall, shade, roof } = canyonTones();
  box(face, null, -0.5, 0, -0.5, 0.5, 0.26, 0.5, shade);
  box(face, null, -0.3, 0.12, -0.3, 0.3, 1.35, 0.3, wall);
  box(face, null, -0.42, 1.2, -0.42, 0.42, 1.42, 0.42, shade);
  wedge(face, 0, 1.3, 0, 0.36, 0.36, 0, 1.95, 0, 0.04, 0.04, roof);
  return finish('pillar-stub', face, { pos: [], nor: [], col: [] });
}

/** The banded chimney: a narrow shaft with collars, taller than a house. */
export function buildPillarBand(): DuskPiece {
  const face: Acc = { pos: [], nor: [], col: [] };
  const { wall, shade, roof } = canyonTones();
  box(face, null, -0.46, 0, -0.46, 0.46, 0.24, 0.46, shade);
  wedge(face, 0, 0.1, 0, 0.26, 0.26, 0, 3.85, 0, 0.18, 0.18, wall);
  const band = (y: number, half: number) => {
    box(face, null, -half, y, -half, half, y + 0.18, half, shade);
  };
  band(0.7, 0.4);
  band(1.65, 0.36);
  band(2.6, 0.32);
  band(3.55, 0.3);
  wedge(face, 0, 3.7, 0, 0.28, 0.28, 0, 4.65, 0, 0.03, 0.03, roof);
  return finish('pillar-band', face, { pos: [], nor: [], col: [] });
}

/** A needle. Authored much taller than the houses so the skyline breaks. */
export function buildPillarSpire(): DuskPiece {
  const face: Acc = { pos: [], nor: [], col: [] };
  const { wall, shade, roof } = canyonTones();
  box(face, null, -0.4, 0, -0.4, 0.4, 0.28, 0.4, shade);
  wedge(face, 0, 0.12, 0, 0.22, 0.22, 0, 2.45, 0, 0.18, 0.18, wall);
  box(face, null, -0.34, 2.22, -0.34, 0.34, 2.44, 0.34, shade);
  wedge(face, 0, 2.28, 0, 0.16, 0.16, 0, 4.55, 0, 0.12, 0.12, wall);
  box(face, null, -0.26, 4.35, -0.26, 0.26, 4.55, 0.26, shade);
  wedge(face, 0, 4.4, 0, 0.1, 0.1, 0, 6.35, 0, 0.07, 0.07, wall);
  wedge(face, 0, 5.95, 0, 0.12, 0.12, 0, 7.35, 0, 0.02, 0.02, roof);
  return finish('pillar-spire', face, { pos: [], nor: [], col: [] });
}

function pointedArch(face: Acc, glow: Acc, x: number, zFace: number, hx: number, hy: number): void {
  const z0 = zFace - 0.04;
  const z1 = zFace + 0.04;
  box(face, null, x - hx, 0.32, z0, x + hx, 0.32 + hy * 0.72, z1, 0x3b2146);
  wedge(face, x, 0.32 + hy * 0.62, zFace, hx, 0.04, x, 0.32 + hy, zFace, 0.02, 0.02, 0x3b2146);
  const ih = hx * 0.72;
  box(face, null, x - ih, 0.42, zFace - 0.06, x + ih, 0.32 + hy * 0.66, zFace - 0.02, WELL);
  wedge(face, x, 0.32 + hy * 0.56, zFace - 0.04, ih, 0.03, x, 0.32 + hy * 0.92, zFace - 0.04, 0.02, 0.02, WELL);
  box(glow, null, x - ih * 0.55, 0.55, zFace - 0.12, x + ih * 0.55, 0.32 + hy * 0.5, zFace - 0.07, WELL_HOT);
  wedge(glow, x, 0.32 + hy * 0.42, zFace - 0.1, ih * 0.4, 0.02, x, 0.32 + hy * 0.78, zFace - 0.1, 0.02, 0.02, WELL_HOT);
}

/**
 * A finished house: one arch, then a smaller floor and a roof that belong to it.
 * The upper storey starts inside the ground wall.
 */
export function buildCourt(): DuskPiece {
  const face: Acc = { pos: [], nor: [], col: [] };
  const glowAcc: Acc = { pos: [], nor: [], col: [] };
  const { wall, shade, roof } = canyonTones();
  box(face, null, -1.4, 0, -0.62, 1.4, 2.5, 0.58, wall);
  box(face, null, -1.55, 0, -0.72, 1.55, 0.3, 0.7, shade);
  pointedArch(face, glowAcc, 0, -0.62, 0.48, 1.85);
  box(face, null, -1.52, 2.22, -0.72, 1.52, 2.55, 0.7, shade);
  box(face, null, -0.82, 2.32, -0.48, 0.82, 3.95, 0.42, wall);
  slit(face, glowAcc, -0.32, 2.62, 3.45, -0.48, 0.12);
  slit(face, glowAcc, 0.32, 2.62, 3.45, -0.48, 0.12);
  box(face, null, -0.98, 3.72, -0.58, 0.98, 4.0, 0.52, shade);
  wedge(face, 0, 3.82, 0, 0.9, 0.5, 0, 4.65, 0, 0.62, 0.04, roof);
  return finish('court', face, glowAcc);
}

/**
 * An arcade and the floor above it, drawn as one building.
 * The upper walls grow out of the arcade cornice. There is one roof.
 */
export function buildHall(): DuskPiece {
  const face: Acc = { pos: [], nor: [], col: [] };
  const glowAcc: Acc = { pos: [], nor: [], col: [] };
  const { wall, shade, roof } = canyonTones();
  const top = 2.2;
  box(face, null, -1.75, 0, -0.55, 1.75, top, 0.52, wall);
  box(face, null, -1.9, 0, -0.66, 1.9, 0.26, 0.66, shade);
  box(face, null, -1.9, top - 0.08, -0.66, 1.9, top + 0.22, 0.66, shade);
  pointedArch(face, glowAcc, -1.05, -0.55, 0.32, 1.45);
  pointedArch(face, glowAcc, 0, -0.55, 0.32, 1.45);
  pointedArch(face, glowAcc, 1.05, -0.55, 0.32, 1.45);
  box(face, null, -1.12, top, -0.42, 1.12, 3.65, 0.4, wall);
  slit(face, glowAcc, -0.45, top + 0.35, 3.25, -0.42, 0.12);
  slit(face, glowAcc, 0.45, top + 0.35, 3.25, -0.42, 0.12);
  box(face, null, -1.28, 3.42, -0.54, 1.28, 3.7, 0.52, shade);
  wedge(face, 0, 3.52, 0, 1.15, 0.48, 0, 4.28, 0, 0.88, 0.04, roof);
  return finish('hall', face, glowAcc);
}

/**
 * A house with its tower on the corner. The shaft starts inside the roof,
 * so the tower is part of the house rather than a pole beside it.
 */
export function buildKeep(): DuskPiece {
  const face: Acc = { pos: [], nor: [], col: [] };
  const glowAcc: Acc = { pos: [], nor: [], col: [] };
  const { wall, shade, roof } = canyonTones();
  box(face, null, -1.4, 0, -0.58, 1.15, 2.2, 0.55, wall);
  box(face, null, -1.52, 0, -0.68, 1.28, 0.28, 0.68, shade);
  pointedArch(face, glowAcc, -0.55, -0.58, 0.38, 1.55);
  box(face, null, -1.52, 1.95, -0.68, 0.28, 2.28, 0.68, shade);
  wedge(face, -0.55, 2.1, 0, 0.95, 0.58, -0.55, 2.78, 0, 0.7, 0.04, roof);
  box(face, null, 0.32, 1.65, -0.4, 1.08, 2.45, 0.4, shade);
  wedge(face, 0.7, 1.85, 0, 0.3, 0.3, 0.7, 4.2, 0, 0.22, 0.22, wall);
  box(face, null, 0.38, 4.0, -0.34, 1.02, 4.22, 0.34, shade);
  wedge(face, 0.7, 4.08, 0, 0.2, 0.2, 0.7, 5.7, 0, 0.14, 0.14, wall);
  wedge(face, 0.7, 5.45, 0, 0.18, 0.18, 0.7, 6.4, 0, 0.02, 0.02, roof);
  return finish('keep', face, glowAcc);
}

/**
 * One wall whose roof climbs toward the right. The high block starts
 * inside the low roof, so the step is the same building.
 */
export function buildLodge(): DuskPiece {
  const face: Acc = { pos: [], nor: [], col: [] };
  const glowAcc: Acc = { pos: [], nor: [], col: [] };
  const { wall, shade, roof } = canyonTones();
  box(face, null, -1.5, 0, -0.52, 1.5, 1.9, 0.5, wall);
  box(face, null, -1.64, 0, -0.64, 1.64, 0.26, 0.64, shade);
  slit(face, glowAcc, -0.7, 0.48, 1.4, -0.52, 0.13);
  slit(face, glowAcc, 0.15, 0.48, 1.4, -0.52, 0.13);
  box(face, null, -1.62, 1.68, -0.62, 0.2, 2.05, 0.6, shade);
  wedge(face, -0.7, 1.9, 0, 0.9, 0.55, -0.7, 2.55, 0, 0.62, 0.04, roof);
  box(face, null, 0.05, 1.72, -0.42, 1.38, 3.15, 0.42, wall);
  slit(face, glowAcc, 0.7, 2.15, 2.85, -0.42, 0.12);
  box(face, null, 0.0, 2.95, -0.54, 1.48, 3.22, 0.52, shade);
  wedge(face, 0.72, 3.05, 0, 0.7, 0.46, 0.72, 3.7, 0, 0.48, 0.04, roof);
  return finish('lodge', face, glowAcc);
}

export const DUSK_PIECE_NAMES = [
  'lantern-amber', 'lantern-picture', 'lantern-rose', 'lantern-float', 'lantern-float-rose',
  'lantern-beacon', 'lantern-beacon-rose',
  'house-arch', 'tower-cap', 'terrace', 'arcade', 'step-roof',
  'parapet', 'stair', 'cliff', 'windows', 'gate',
  'pillar-stub', 'pillar-band', 'pillar-spire',
  'court', 'hall', 'keep', 'lodge'
] as const;
export type DuskPieceName = (typeof DUSK_PIECE_NAMES)[number];

export function buildDuskPiece(name: DuskPieceName): DuskPiece {
  if (name === 'lantern-picture') return buildPictureLantern();
  if (name === 'lantern-rose') return buildPictureLantern('rose');
  if (name === 'lantern-float') return buildFloatLantern();
  if (name === 'lantern-float-rose') return buildFloatLantern('rose');
  if (name === 'lantern-beacon') return buildBeaconLantern();
  if (name === 'lantern-beacon-rose') return buildBeaconLantern('rose');
  if (name === 'court') return buildCourt();
  if (name === 'hall') return buildHall();
  if (name === 'keep') return buildKeep();
  if (name === 'lodge') return buildLodge();
  if (name === 'house-arch') return buildArchHouse();
  if (name === 'tower-cap') return buildTower();
  if (name === 'terrace') return buildTerrace();
  if (name === 'arcade') return buildArcade();
  if (name === 'step-roof') return buildStepRoof();
  if (name === 'parapet') return buildParapet();
  if (name === 'stair') return buildStair();
  if (name === 'cliff') return buildCliff();
  if (name === 'windows') return buildWindows();
  if (name === 'gate') return buildGate();
  if (name === 'pillar-stub') return buildPillarStub();
  if (name === 'pillar-band') return buildPillarBand();
  if (name === 'pillar-spire') return buildPillarSpire();
  return buildLantern('amber');
}

