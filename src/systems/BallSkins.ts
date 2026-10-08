import {
  AmbientLight,
  CanvasTexture,
  ClampToEdgeWrapping,
  DirectionalLight,
  LinearFilter,
  MeshBasicMaterial,
  PerspectiveCamera,
  Quaternion,
  RepeatWrapping,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer
} from 'three';
import { GAME_CONFIG } from '../config/GameConfig';
import { BallEntity } from '../entities/BallEntity';

/** Equirectangular wrap. The picture is projected onto the face the hop camera sees. */
const MAP_W = 1024;
const MAP_H = 512;

export interface PaintedBall {
  id: string;
  name: string;
  /** Flat fallback, also the shop tint before a snapshot exists. */
  color: number;
  file: string;
}

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

interface ViewBasis {
  /** From the ball toward the camera. */
  view: Vec3;
  right: Vec3;
  up: Vec3;
}

const BALL_Y = GAME_CONFIG.PLATFORM_HEIGHT / 2 + GAME_CONFIG.BALL_RADIUS;

/**
 * The pictures are straight-on portraits. This basis turns that portrait so it
 * faces the hop camera and stays upright on screen.
 */
function viewBasis(): ViewBasis {
  const eye = { x: 0, y: GAME_CONFIG.CAMERA_OFFSET_Y, z: GAME_CONFIG.CAMERA_OFFSET_Z };
  const look = {
    x: 0,
    y: GAME_CONFIG.CAMERA_LOOK_AHEAD * 0.3,
    z: GAME_CONFIG.CAMERA_LOOK_AHEAD
  };
  const back = norm(sub(eye, look));
  const worldUp = { x: 0, y: 1, z: 0 };
  const right = norm(cross(worldUp, back));
  const camUp = cross(back, right);
  const view = norm(sub(eye, { x: 0, y: BALL_Y, z: 0 }));
  let screenRight = norm(reject(right, view));
  let screenUp = cross(view, screenRight);
  if (dot(screenUp, camUp) < 0) {
    screenRight = scale(screenRight, -1);
    screenUp = cross(view, screenRight);
  }
  return { view, right: screenRight, up: screenUp };
}

const BASIS = viewBasis();

/** Where to put a camera so a photo skin fills the frame the way the source does. */
export function ballPhotoCamera(distance: number): {
  position: Vec3;
  up: Vec3;
  look: Vec3;
} {
  return {
    position: {
      x: BASIS.view.x * distance,
      y: BALL_Y + BASIS.view.y * distance,
      z: BASIS.view.z * distance
    },
    up: BASIS.up,
    look: { x: 0, y: BALL_Y, z: 0 }
  };
}

const pickUrls = import.meta.glob('../../art/ball-refs/picks/*.jpg', {
  eager: true,
  query: '?url',
  import: 'default'
}) as Record<string, string>;

export const PAINTED_BALLS: PaintedBall[] = [
  { id: 'paper-core', name: 'Paper Core', color: 0xf3ead7, file: 'Toy_sphere_clay_render' },
  { id: 'rings', name: 'Rings', color: 0x3d7ec4, file: 'Peach_toy_sphere_with_rings' },
  { id: 'court-line', name: 'Court Line', color: 0xc6d63a, file: 'Tennis_ball_toy_render' },
  { id: 'confetti-plus', name: 'Confetti Plus', color: 0xf6f0e4, file: 'Toy_sphere_with_colored_dots' },
  { id: 'lantern', name: 'Lantern', color: 0xf07a62, file: 'Soft_coral_toy_sphere' },
  { id: 'marble', name: 'Marble', color: 0xf0d8b0, file: 'Cream_toy_sphere_with_teal' },
  { id: 'night-glass', name: 'Night Glass', color: 0x1a1460, file: 'Dark_indigo_ball_with_gold' },
  { id: 'prism-swirl', name: 'Prism Swirl', color: 0xf8e0f0, file: 'Toy_sphere_render_2026' },
  { id: 'hopper', name: 'Hopper', color: 0xf3ead8, file: 'Toy_sphere_smiling' },
  { id: 'crinkle', name: 'Crinkle', color: 0xd4a017, file: 'Crumpled_gold_foil' },
  { id: 'star-play', name: 'Star Play', color: 0x3a7adf, file: 'Toy_sphere_centered' }
];

const materials = new Map<string, MeshBasicMaterial>();
let ready: Promise<void> | null = null;

function urlFor(file: string): string {
  const hit = Object.entries(pickUrls).find(([path]) => path.includes(file));
  if (!hit) throw new Error(`HOP: missing ball picture for "${file}"`);
  return hit[1];
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`HOP: ball picture failed to load ${url}`));
    img.src = url;
  });
}

/** Decode every pick and bake the wraps before the first ball is shown. */
export function preloadBallSkins(): Promise<void> {
  if (!ready) {
    ready = Promise.all(PAINTED_BALLS.map((skin) => bake(skin))).then(() => undefined);
  }
  return ready;
}

export function ballSkinMaterial(id: string): MeshBasicMaterial {
  const cached = materials.get(id);
  if (!cached) throw new Error(`HOP: ball skin "${id}" is not ready`);
  return cached;
}

export function paintedBall(id: string): PaintedBall | undefined {
  return PAINTED_BALLS.find((entry) => entry.id === id);
}

export function paintedBallIds(): string[] {
  return PAINTED_BALLS.map((entry) => entry.id);
}

/** Shop id `default` wears Paper Core so old saves keep their equipped id. */
export function paintedIdForShop(shopId: string): string | null {
  const id = shopId === 'default' ? 'paper-core' : shopId;
  return paintedBall(id) ? id : null;
}

const iconUrls = new Map<string, string>();
let iconRenderer: WebGLRenderer | null = null;

/** Circle-ready picture of the ball from the hop camera. Cached. */
export function ballSkinIcon(id: string): string {
  const hit = iconUrls.get(id);
  if (hit) return hit;
  const scene = new Scene();
  const ball = new BallEntity(scene);
  ball.applySkinMaterial(ballSkinMaterial(id));
  const frame = ballPhotoCamera(8);
  const camera = new PerspectiveCamera((2 * Math.atan(0.55 / 8) * 180) / Math.PI, 1, 0.05, 30);
  camera.up.set(frame.up.x, frame.up.y, frame.up.z);
  camera.position.set(frame.position.x, frame.position.y, frame.position.z);
  camera.lookAt(frame.look.x, frame.look.y, frame.look.z);
  if (!iconRenderer) {
    iconRenderer = new WebGLRenderer({ antialias: true, alpha: true });
    iconRenderer.outputColorSpace = SRGBColorSpace;
    iconRenderer.setPixelRatio(2);
    iconRenderer.setSize(128, 128, false);
  }
  iconRenderer.render(scene, camera);
  const url = iconRenderer.domElement.toDataURL('image/png');
  ball.dispose();
  iconUrls.set(id, url);
  return url;
}

export interface ShopSpinSlot {
  canvas: HTMLCanvasElement;
  /** Painted skin id, when this card shows a picture. */
  paintedId: string | null;
  /** Flat color used when the card is not a picture. */
  color: number;
}

let shopToken = 0;
let shopFrame = 0;
let shopBall: BallEntity | null = null;
let shopRenderer: WebGLRenderer | null = null;
let shopAngle = 0;
let shopViews: Array<ShopSpinSlot & { ctx: CanvasRenderingContext2D }> = [];
// Tilted off vertical so a ball with level rings still shows the turn.
// Every card uses this one spin.
const SHOP_SPIN_AXIS = new Vector3(0.55, 1, 0.12).normalize();
const shopSpinQuat = new Quaternion();

function bindShopSlots(slots: ShopSpinSlot[]): Array<ShopSpinSlot & { ctx: CanvasRenderingContext2D }> {
  return slots.map((slot) => {
    slot.canvas.width = 192;
    slot.canvas.height = 192;
    return { ...slot, ctx: slot.canvas.getContext('2d')! };
  });
}

/** Turn every shop ball on one view and copy it onto that card. */
export function startShopSpinners(slots: ShopSpinSlot[]): void {
  if (!slots.length) {
    stopShopSpinners();
    return;
  }
  // Buy and equip rebuild the cards. Keep the same turn so the balls do not snap back.
  shopViews = bindShopSlots(slots);
  if (shopBall && shopRenderer) return;
  const token = shopToken;
  const scene = new Scene();
  const ball = new BallEntity(scene);
  shopBall = ball;
  scene.add(new AmbientLight(0xffffff, 0.38));
  const sun = new DirectionalLight(0xffffff, 2);
  sun.position.set(3, 10, 8);
  scene.add(sun);
  const frame = ballPhotoCamera(8);
  const camera = new PerspectiveCamera((2 * Math.atan(0.62 / 8) * 180) / Math.PI, 1, 0.05, 30);
  camera.up.set(frame.up.x, frame.up.y, frame.up.z);
  camera.position.set(frame.position.x, frame.position.y, frame.position.z);
  camera.lookAt(frame.look.x, frame.look.y, frame.look.z);
  const renderer = new WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(1);
  renderer.setSize(192, 192, false);
  shopRenderer = renderer;
  let last = performance.now();
  const tick = (now: number): void => {
    if (token !== shopToken) return;
    shopFrame = requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    shopAngle += dt * 0.85;
    shopSpinQuat.setFromAxisAngle(SHOP_SPIN_AXIS, shopAngle);
    ball.group.quaternion.copy(shopSpinQuat);
    for (const view of shopViews) {
      if (view.paintedId) ball.wearShared(ballSkinMaterial(view.paintedId));
      else ball.wearSolid(view.color);
      renderer.render(scene, camera);
      view.ctx.clearRect(0, 0, 192, 192);
      view.ctx.drawImage(renderer.domElement, 0, 0);
    }
  };
  shopFrame = requestAnimationFrame(tick);
}

export function stopShopSpinners(): void {
  shopToken += 1;
  cancelAnimationFrame(shopFrame);
  shopFrame = 0;
  shopViews = [];
  shopAngle = 0;
  shopBall?.dispose();
  shopBall = null;
  shopRenderer?.dispose();
  shopRenderer = null;
}

async function bake(skin: PaintedBall): Promise<void> {
  if (skin.id === 'confetti-plus') {
    finish(skin.id, paintConfetti());
    return;
  }
  if (skin.id === 'rings') {
    finish(skin.id, paintRings());
    return;
  }
  const img = await loadImage(urlFor(skin.file));
  const src = document.createElement('canvas');
  src.width = img.naturalWidth;
  src.height = img.naturalHeight;
  const sctx = src.getContext('2d', { willReadFrequently: true })!;
  sctx.drawImage(img, 0, 0);
  const pic = sctx.getImageData(0, 0, src.width, src.height);
  const disk = fitDisk(pic);
  const paper = cornerColor(pic);
  const canvas = document.createElement('canvas');
  canvas.width = MAP_W;
  canvas.height = MAP_H;
  const ctx = canvas.getContext('2d')!;
  const out = ctx.createImageData(MAP_W, MAP_H);
  const fill = interiorColor(pic, disk);
  const mirrored = mirroredFace(skin.id) ? ballColor(pic, disk, paper) : null;
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const n = spherePoint(x / MAP_W, y / MAP_H);
      const nx = dot(n, BASIS.right);
      const ny = dot(n, BASIS.up);
      const i = (y * MAP_W + x) * 4;
      // One picture for the whole ball. The source outline is outside this
      // scale, so the top is the cap of the picture rather than a seam.
      // Night Glass uses that picture on two opposite sides and ball color between.
      let rgb = mirrored
        ? paintMirroredFace(pic, disk, paper, mirrored, nx, ny)
        : sampleFront(pic, disk, paper, nx * 0.9, ny * 0.9, fill);
      out.data[i] = rgb[0];
      out.data[i + 1] = rgb[1];
      out.data[i + 2] = rgb[2];
      out.data[i + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  finish(skin.id, canvas);
}

function finish(id: string, canvas: HTMLCanvasElement): void {
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = RepeatWrapping;
  tex.wrapT = ClampToEdgeWrapping;
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearFilter;
  tex.generateMipmaps = false;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  const mat = new MeshBasicMaterial({ color: 0xffffff, map: tex });
  mat.userData.photo = true;
  materials.set(id, mat);
}

interface ConfettiDot {
  at: Vec3;
  color: [number, number, number];
  radius: number;
}

interface RingBand {
  /** Height on the ball, 1 at the top and -1 at the bottom. */
  y: number;
  color: [number, number, number];
  half: number;
}

/**
 * Sky-blue ball with slim horizontal bands. The rings stay level,
 * stacked from top to bottom.
 */
function paintRings(): HTMLCanvasElement {
  const bands: RingBand[] = [
    { y: 0.7, color: [255, 248, 236], half: 0.042 },
    { y: 0.46, color: [242, 196, 72], half: 0.046 },
    { y: 0.2, color: [240, 112, 96], half: 0.04 },
    { y: -0.04, color: [255, 252, 248], half: 0.036 },
    { y: -0.3, color: [28, 42, 84], half: 0.046 },
    { y: -0.56, color: [64, 196, 176], half: 0.044 }
  ];
  const light = norm({
    x: BASIS.up.x * 0.82 + BASIS.view.x * 0.25,
    y: BASIS.up.y * 0.82 + BASIS.view.y * 0.25,
    z: BASIS.up.z * 0.82 + BASIS.view.z * 0.25
  });
  const canvas = document.createElement('canvas');
  canvas.width = MAP_W;
  canvas.height = MAP_H;
  const ctx = canvas.getContext('2d')!;
  const out = ctx.createImageData(MAP_W, MAP_H);
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const n = spherePoint(x / MAP_W, y / MAP_H);
      const rgb = ringTexel(n, light, bands);
      const i = (y * MAP_W + x) * 4;
      out.data[i] = rgb[0];
      out.data[i + 1] = rgb[1];
      out.data[i + 2] = rgb[2];
      out.data[i + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  return canvas;
}

function ringTexel(n: Vec3, light: Vec3, bands: RingBand[]): [number, number, number] {
  const lit = dot(n, light);
  const sky = mixRgb(
    [36, 92, 168],
    mixRgb([74, 150, 214], [186, 224, 248], smoothstep(0.05, 0.9, lit)),
    smoothstep(-0.75, 0.45, lit)
  );
  let best: { t: number; color: [number, number, number] } | null = null;
  for (const band of bands) {
    const dist = Math.abs(n.y - band.y);
    if (dist > band.half) continue;
    const t = dist / band.half;
    if (!best || t < best.t) best = { t, color: band.color };
  }
  if (!best) return sky;
  const body = mixRgb(best.color, [255, 252, 246], (1 - best.t) * 0.14);
  const rim = smoothstep(0.7, 1, best.t);
  return mixRgb(body, scaleRgb(best.color, 0.78), rim * 0.55);
}

/**
 * Cream clay ball with flat candy discs. The discs are circles on the sphere,
 * so a turn shows more discs instead of a stretched copy of one photo.
 */
function paintConfetti(): HTMLCanvasElement {
  const dots = placeConfettiDots();
  const light = norm({
    x: BASIS.up.x * 0.82 + BASIS.view.x * 0.25,
    y: BASIS.up.y * 0.82 + BASIS.view.y * 0.25,
    z: BASIS.up.z * 0.82 + BASIS.view.z * 0.25
  });
  const canvas = document.createElement('canvas');
  canvas.width = MAP_W;
  canvas.height = MAP_H;
  const ctx = canvas.getContext('2d')!;
  const out = ctx.createImageData(MAP_W, MAP_H);
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const n = spherePoint(x / MAP_W, y / MAP_H);
      const rgb = confettiTexel(n, light, dots);
      const i = (y * MAP_W + x) * 4;
      out.data[i] = rgb[0];
      out.data[i + 1] = rgb[1];
      out.data[i + 2] = rgb[2];
      out.data[i + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  return canvas;
}

const CONFETTI_COLORS: Array<[number, number, number]> = [
  [242, 139, 120],
  [230, 184, 74],
  [58, 184, 176],
  [176, 126, 214],
  [122, 102, 214],
  [122, 210, 164],
  [108, 174, 230],
  [230, 126, 158],
  [234, 150, 68]
];

function placeConfettiDots(): ConfettiDot[] {
  const count = 26;
  const pts = fibonacciSphere(count);
  let gap = Math.PI;
  for (let i = 0; i < count; i++) {
    for (let j = i + 1; j < count; j++) {
      gap = Math.min(gap, angleBetween(pts[i], pts[j]));
    }
  }
  const radius = gap * 0.44;
  const colorOf: number[] = [];
  for (let i = 0; i < count; i++) {
    const banned = new Set<number>();
    for (let j = 0; j < i; j++) {
      if (angleBetween(pts[i], pts[j]) < gap * 1.45) banned.add(colorOf[j]);
    }
    let pick = i % CONFETTI_COLORS.length;
    for (let k = 0; k < CONFETTI_COLORS.length; k++) {
      const candidate = (i * 3 + k) % CONFETTI_COLORS.length;
      if (!banned.has(candidate)) {
        pick = candidate;
        break;
      }
    }
    colorOf.push(pick);
  }
  return pts.map((at, i) => ({
    at,
    color: CONFETTI_COLORS[colorOf[i]],
    radius: radius * (0.9 + ((i * 17) % 5) * 0.025)
  }));
}

function confettiTexel(
  n: Vec3,
  light: Vec3,
  dots: ConfettiDot[]
): [number, number, number] {
  const lit = dot(n, light);
  const cream = mixRgb(
    [214, 196, 172],
    mixRgb([244, 234, 214], [255, 250, 242], smoothstep(0.15, 0.9, lit)),
    smoothstep(-0.85, 0.35, lit)
  );
  let nearest: ConfettiDot | null = null;
  let nearestAngle = Math.PI;
  for (const disc of dots) {
    const ang = angleBetween(n, disc.at);
    if (ang < nearestAngle) {
      nearest = disc;
      nearestAngle = ang;
    }
  }
  if (!nearest) return cream;
  const edge = 0.012;
  if (nearestAngle > nearest.radius + 0.05) return cream;
  const across = discShade(n, nearest.at, light);
  if (nearestAngle > nearest.radius) {
    const falloff = 1 - (nearestAngle - nearest.radius) / 0.05;
    const shade = smoothstep(0.05, -0.7, across) * falloff;
    return mixRgb(cream, scaleRgb(cream, 0.9), shade * 0.55);
  }
  const u = nearestAngle / nearest.radius;
  const body = mixRgb(nearest.color, [255, 252, 246], smoothstep(0.2, 1, across) * 0.08);
  const rim = smoothstep(0.9, 1, u);
  const disc = mixRgb(body, scaleRgb(nearest.color, 0.88), rim);
  const cover = 1 - smoothstep(nearest.radius - edge, nearest.radius + edge * 0.25, nearestAngle);
  return mixRgb(cream, disc, cover);
}

function discShade(n: Vec3, center: Vec3, light: Vec3): number {
  const offset = {
    x: n.x - center.x * dot(n, center),
    y: n.y - center.y * dot(n, center),
    z: n.z - center.z * dot(n, center)
  };
  const inPlane = {
    x: light.x - center.x * dot(light, center),
    y: light.y - center.y * dot(light, center),
    z: light.z - center.z * dot(light, center)
  };
  const ol = Math.hypot(offset.x, offset.y, offset.z);
  const ll = Math.hypot(inPlane.x, inPlane.y, inPlane.z);
  if (ol < 1e-5 || ll < 1e-5) return 0;
  return (offset.x * inPlane.x + offset.y * inPlane.y + offset.z * inPlane.z) / (ol * ll);
}

function fibonacciSphere(count: number): Vec3[] {
  const pts: Vec3[] = [];
  const turn = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - ((i + 0.5) / count) * 2;
    const ring = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = turn * i;
    pts.push({ x: Math.cos(theta) * ring, y, z: Math.sin(theta) * ring });
  }
  return pts;
}

function angleBetween(a: Vec3, b: Vec3): number {
  const c = Math.min(1, Math.max(-1, dot(a, b)));
  return Math.acos(c);
}

function mixRgb(
  a: [number, number, number],
  b: [number, number, number],
  t: number
): [number, number, number] {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t)
  ];
}

function scaleRgb(rgb: [number, number, number], s: number): [number, number, number] {
  return [
    Math.max(0, Math.min(255, Math.round(rgb[0] * s))),
    Math.max(0, Math.min(255, Math.round(rgb[1] * s))),
    Math.max(0, Math.min(255, Math.round(rgb[2] * s)))
  ];
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

interface Disk {
  cx: number;
  cy: number;
  radius: number;
}

function fitDisk(pic: ImageData): Disk {
  const { width, height, data } = pic;
  let cx = width / 2;
  let cy = height / 2;
  let pts: Array<{ x: number; y: number }> = [];
  for (let pass = 0; pass < 3; pass++) {
    pts = [];
    for (let a = 0; a < 360; a += 2) {
      const rad = (a * Math.PI) / 180;
      const dx = Math.cos(rad);
      const dy = Math.sin(rad);
      for (let r = Math.max(width, height); r > 6; r -= 1) {
        const x = Math.round(cx + dx * r);
        const y = Math.round(cy + dy * r);
        if (x < 1 || y < 1 || x >= width - 1 || y >= height - 1) continue;
        if (isDark(data, width, x, y)) {
          pts.push({ x, y });
          break;
        }
      }
    }
    if (pts.length < 8) break;
    cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  }
  const dists = pts.map((p) => Math.hypot(p.x - cx, p.y - cy)).sort((a, b) => a - b);
  // Median keeps a round picture filling the ball. A max would include rings
  // and foil lumps that stick past the circle, and those leave a second rim.
  const radius = dists.length ? dists[Math.floor(dists.length * 0.5)] * 0.985 : Math.min(width, height) * 0.4;
  return { cx, cy, radius };
}

function cornerColor(pic: ImageData): [number, number, number] {
  const { width, height, data } = pic;
  const spots = [
    [2, 2],
    [width - 3, 2],
    [2, height - 3],
    [width - 3, height - 3]
  ];
  let r = 0;
  let g = 0;
  let b = 0;
  for (const [x, y] of spots) {
    const i = (y * width + x) * 4;
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
  }
  return [Math.round(r / 4), Math.round(g / 4), Math.round(b / 4)];
}

function isMargin(rgb: [number, number, number], paper: [number, number, number]): boolean {
  return Math.abs(rgb[0] - paper[0]) + Math.abs(rgb[1] - paper[1]) + Math.abs(rgb[2] - paper[2]) < 36;
}

function mirroredFace(id: string): boolean {
  return id === 'night-glass';
}

function isGold(rgb: [number, number, number]): boolean {
  const [r, g, b] = rgb;
  return r > 115 && g > 75 && r > b + 25 && g + 10 > b && r + g > 210;
}

/**
 * Same picture on the front and the opposite side. The band between those
 * two faces is the ball color, so the stars are not stretched around the side.
 */
function paintMirroredFace(
  pic: ImageData,
  disk: Disk,
  paper: [number, number, number],
  body: [number, number, number],
  nx: number,
  ny: number
): [number, number, number] {
  const r = Math.hypot(nx, ny);
  // Each face holds the picture. Past this ring is the band between the faces.
  const cap = 0.94;
  if (r >= cap) return body;
  const px = (nx / cap) * 0.96;
  const py = (ny / cap) * 0.96;
  const rgb = sampleFront(pic, disk, paper, px, py, body);
  if (isGold(rgb) || (luma(rgb) < 75 && nearGold(pic, disk, px, py))) return rgb;
  return fadeField(rgb, body, Math.hypot(px, py));
}

function fadeField(
  rgb: [number, number, number],
  body: [number, number, number],
  pr: number
): [number, number, number] {
  const keep = 0.48;
  const gone = 0.72;
  if (pr <= keep) return rgb;
  if (pr >= gone) return body;
  const t = (pr - keep) / (gone - keep);
  return [
    Math.round(rgb[0] + (body[0] - rgb[0]) * t),
    Math.round(rgb[1] + (body[1] - rgb[1]) * t),
    Math.round(rgb[2] + (body[2] - rgb[2]) * t)
  ];
}

function nearGold(pic: ImageData, disk: Disk, px: number, py: number): boolean {
  const step = 0.04;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const rgb = read(pic, disk, px + dx * step, py + dy * step);
      if (rgb && isGold(rgb)) return true;
    }
  }
  return false;
}

function ballColor(
  pic: ImageData,
  disk: Disk,
  paper: [number, number, number]
): [number, number, number] {
  const { width, height, data } = pic;
  const samples: Array<[number, number, number]> = [];
  for (let y = 0; y < height; y += 3) {
    for (let x = 0; x < width; x += 3) {
      const px = (x - disk.cx) / disk.radius;
      const py = -(y - disk.cy) / disk.radius;
      const r2 = px * px + py * py;
      if (r2 < 0.4 * 0.4 || r2 > 0.78 * 0.78) continue;
      const i = (y * width + x) * 4;
      const rgb: [number, number, number] = [data[i], data[i + 1], data[i + 2]];
      if (isGold(rgb) || luma(rgb) < 28 || isMargin(rgb, paper)) continue;
      samples.push(rgb);
    }
  }
  return medianRgb(samples);
}

function medianRgb(samples: Array<[number, number, number]>): [number, number, number] {
  if (!samples.length) return [40, 32, 110];
  const mid = (channel: number): number => {
    const values = samples.map((rgb) => rgb[channel]).sort((a, b) => a - b);
    return values[Math.floor(values.length / 2)];
  };
  return [mid(0), mid(1), mid(2)];
}

function sampleFront(
  pic: ImageData,
  disk: Disk,
  paper: [number, number, number],
  nx: number,
  ny: number,
  fill: [number, number, number]
): [number, number, number] {
  const r = Math.hypot(nx, ny);
  if (r > 1) return fill;
  const rgb = read(pic, disk, nx, ny);
  if (!rgb) return fill;
  // Only the white paper around a lumpy silhouette. A bright highlight on the
  // ball itself is the same color and must stay.
  const margin = r > 0.9 && isMargin(rgb, paper);
  if (!margin) return rgb;
  const start = r;
  for (let t = start; t > start - 0.1 && t > 0.45; t -= 0.02) {
    const inner = read(pic, disk, (nx / Math.max(r, 0.001)) * t, (ny / Math.max(r, 0.001)) * t);
    if (inner && !isMargin(inner, paper) && luma(inner) >= 48) return inner;
  }
  return margin ? fill : rgb;
}

function read(
  pic: ImageData,
  disk: Disk,
  nx: number,
  ny: number
): [number, number, number] | null {
  const x = disk.cx + nx * disk.radius;
  const y = disk.cy - ny * disk.radius;
  return bilinear(pic, x, y);
}

function interiorColor(pic: ImageData, disk: Disk): [number, number, number] {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let a = 0; a < 12; a++) {
    const ang = (a / 12) * Math.PI * 2;
    const rgb = read(pic, disk, Math.cos(ang) * 0.35, Math.sin(ang) * 0.35);
    if (!rgb || luma(rgb) < 52) continue;
    r += rgb[0];
    g += rgb[1];
    b += rgb[2];
    n++;
  }
  if (!n) return [240, 232, 214];
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
}

function bilinear(pic: ImageData, x: number, y: number): [number, number, number] | null {
  const { width, height, data } = pic;
  if (x < 0 || y < 0 || x >= width - 1 || y >= height - 1) return null;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = x - x0;
  const ty = y - y0;
  const sample = (px: number, py: number): [number, number, number] => {
    const i = (py * width + px) * 4;
    return [data[i], data[i + 1], data[i + 2]];
  };
  const c00 = sample(x0, y0);
  const c10 = sample(x0 + 1, y0);
  const c01 = sample(x0, y0 + 1);
  const c11 = sample(x0 + 1, y0 + 1);
  const mix = (a: number, b: number, t: number): number => a + (b - a) * t;
  return [
    Math.round(mix(mix(c00[0], c10[0], tx), mix(c01[0], c11[0], tx), ty)),
    Math.round(mix(mix(c00[1], c10[1], tx), mix(c01[1], c11[1], tx), ty)),
    Math.round(mix(mix(c00[2], c10[2], tx), mix(c01[2], c11[2], tx), ty))
  ];
}

function isDark(data: Uint8ClampedArray, width: number, x: number, y: number): boolean {
  const i = (y * width + x) * 4;
  return luma([data[i], data[i + 1], data[i + 2]]) < 48;
}

function luma(rgb: [number, number, number]): number {
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

/** Three.js sphere UV. u = 0.75 is the face toward the camera when the basis agrees. */
function spherePoint(u: number, v: number): Vec3 {
  const theta = u * Math.PI * 2;
  const phi = v * Math.PI;
  const sinPhi = Math.sin(phi);
  return {
    x: -Math.cos(theta) * sinPhi,
    y: Math.cos(phi),
    z: Math.sin(theta) * sinPhi
  };
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function scale(v: Vec3, s: number): Vec3 {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  };
}

function norm(v: Vec3): Vec3 {
  const l = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / l, y: v.y / l, z: v.z / l };
}

function reject(v: Vec3, onto: Vec3): Vec3 {
  const d = dot(v, onto);
  return { x: v.x - onto.x * d, y: v.y - onto.y * d, z: v.z - onto.z * d };
}
