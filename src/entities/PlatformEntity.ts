import {
  BoxGeometry,
  CanvasTexture,
  Curve,
  CylinderGeometry,
  TubeGeometry,
  Vector3,
  Group,
  Mesh,
  Quaternion,
  MeshBasicMaterial,
  MeshToonMaterial,
  RepeatWrapping,
  RingGeometry,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
  BackSide,
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Color,
  type Scene
} from 'three';
import { GAME_CONFIG } from '../config/GameConfig';
import { MaterialFactory } from '../systems/MaterialFactory';
import { voidRimColor } from '../worlds/void/VoidPalette';
import { gsap } from 'gsap';

export interface CoinObject {
  group: Group;
  collected: boolean;
  /** Radians per second around Y. Negative turns the face away clockwise. */
  spin: number;
  /** Shifts the bob so neighboring coins are not on the same beat. */
  bobPhase: number;
}

export interface PlatformData {
  group: Group;
  mesh: Mesh;
  outlineMesh: Mesh;
  topMat: MeshToonMaterial;
  sideMat: MeshToonMaterial;
  perfectDot: Mesh;
  perfectRing: Mesh;
  index: number;
  coins: CoinObject[];
  z: number;
  platformX: number;
  swayOffset: number;
  baseScale: number;
  hasRisen: boolean;
}

const platformGeo = new BoxGeometry(
  GAME_CONFIG.PLATFORM_WIDTH,
  GAME_CONFIG.PLATFORM_HEIGHT,
  GAME_CONFIG.PLATFORM_DEPTH
);
const coinGeo = new CylinderGeometry(
  GAME_CONFIG.COIN_RADIUS,
  GAME_CONFIG.COIN_RADIUS,
  0.06,
  24
);
/** Cap (+Y) points down the track (+Z), so the picture faces the camera.
 *  The group then turns on Y: the face swings away, goes edge-on, and comes back. */
const coinFacing = new Quaternion().setFromUnitVectors(
  new Vector3(0, 1, 0),
  new Vector3(0, 0, 1)
);
const ringGeo = new RingGeometry(
  GAME_CONFIG.PERFECT_DOT_RADIUS,
  GAME_CONFIG.PERFECT_DOT_RADIUS + 0.06,
  24
);

// Tile sides read visibly darker than tops, beyond what lighting alone does
// (palette doc §6). One derivation keeps WorldLook to top colors only.
export function deriveSideColor(top: number): number {
  return new Color(top).offsetHSL(0.005, 0.03, -0.12).getHex();
}

// Diamond shape (from the original `os` path)
function createDiamondGeo(ro: number): ShapeGeometry {
  const shape = new Shape();
  shape.moveTo(0, ro);
  shape.lineTo(ro, 0);
  shape.lineTo(0, -ro);
  shape.lineTo(-ro, 0);
  shape.closePath();
  return new ShapeGeometry(shape);
}
/**
 * The landing marker is a WHITE diamond with a BLACK outline, per the concept:
 * a black fill vanished against the warm tile, and a white fill with no outline
 * vanished against the cream cloud. The outline is a second, slightly larger
 * diamond drawn just underneath — real geometry, so it works at any zoom.
 */
const diamondGeo = createDiamondGeo(0.15);
const diamondOutlineGeo = createDiamondGeo(0.163);

/**
 * Cyan tube around the middle of the slab. The path sits outside the box,
 * so the round section is visible instead of a flat stripe on the face.
 */
class RoundedRectCurve extends Curve<Vector3> {
  constructor(private hx: number, private hz: number, private radius: number) {
    super();
  }

  getPoint(t: number, target = new Vector3()): Vector3 {
    const r = Math.min(this.radius, this.hx - 0.02, this.hz - 0.02);
    const sx = (this.hx - r) * 2;
    const sz = (this.hz - r) * 2;
    const arc = r * Math.PI * 0.5;
    const total = 2 * sx + 2 * sz + 4 * arc;
    let d = ((t % 1) + 1) % 1 * total;
    const take = (len: number): number | null => {
      if (d <= len) {
        const u = len === 0 ? 0 : d / len;
        d = 0;
        return u;
      }
      d -= len;
      return null;
    };
    let u = take(sz);
    if (u !== null) return target.set(this.hx, 0, -(this.hz - r) + u * sz);
    u = take(arc);
    if (u !== null) {
      const a = u * Math.PI * 0.5;
      return target.set(this.hx - r + Math.cos(a) * r, 0, this.hz - r + Math.sin(a) * r);
    }
    u = take(sx);
    if (u !== null) return target.set(this.hx - r - u * sx, 0, this.hz);
    u = take(arc);
    if (u !== null) {
      const a = Math.PI * 0.5 + u * Math.PI * 0.5;
      return target.set(-(this.hx - r) + Math.cos(a) * r, 0, this.hz - r + Math.sin(a) * r);
    }
    u = take(sz);
    if (u !== null) return target.set(-this.hx, 0, this.hz - r - u * sz);
    u = take(arc);
    if (u !== null) {
      const a = Math.PI + u * Math.PI * 0.5;
      return target.set(-(this.hx - r) + Math.cos(a) * r, 0, -(this.hz - r) + Math.sin(a) * r);
    }
    u = take(sx);
    if (u !== null) return target.set(-(this.hx - r) + u * sx, 0, -this.hz);
    u = take(arc);
    const a = Math.PI * 1.5 + (u ?? 0) * Math.PI * 0.5;
    return target.set(this.hx - r + Math.cos(a) * r, 0, -(this.hz - r) + Math.sin(a) * r);
  }
}

const RIBBON_RADIUS = 0.09;
const ribbonGeo = new TubeGeometry(
  new RoundedRectCurve(
    GAME_CONFIG.PLATFORM_WIDTH / 2 + RIBBON_RADIUS,
    GAME_CONFIG.PLATFORM_DEPTH / 2 + RIBBON_RADIUS,
    0.46
  ),
  64,
  RIBBON_RADIUS,
  10,
  true
);
const ribbonMat = new MeshBasicMaterial({ color: 0x20e6ea, side: DoubleSide });

/**
 * A short neon mark on each corner. It sits on the top edge and continues
 * a little way down the side, so it takes a few pixels of the tile height.
 * The middle of each edge stays the tile colour.
 */
function voidCornerGeometry(): BufferGeometry {
  const half = GAME_CONFIG.PLATFORM_WIDTH / 2;
  const top = GAME_CONFIG.PLATFORM_HEIGHT / 2 + 0.02;
  const arm = 0.28;
  const t = 0.05;
  const drop = 0.11;
  const pos: number[] = [];
  const quad = (a: number[], b: number[], c: number[], d: number[]) => {
    pos.push(...a, ...b, ...c, ...a, ...c, ...d);
  };
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const x = sx * (half - 0.02);
      const z = sz * (half - 0.02);
      const ix = -sx;
      const iz = -sz;
      const y1 = top - drop;
      quad(
        [x, top, z],
        [x + ix * arm, top, z],
        [x + ix * arm, top, z + iz * t],
        [x, top, z + iz * t]
      );
      quad(
        [x, top, z],
        [x + ix * t, top, z],
        [x + ix * t, top, z + iz * arm],
        [x, top, z + iz * arm]
      );
      const ox = x + sx * 0.03;
      const oz = z + sz * 0.03;
      quad(
        [ox, top, z],
        [ox, y1, z],
        [ox, y1, z + iz * t],
        [ox, top, z + iz * t]
      );
      quad(
        [x, top, oz],
        [x + ix * t, top, oz],
        [x + ix * t, y1, oz],
        [x, y1, oz]
      );
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  return geo;
}

const voidRimGeo = voidCornerGeometry();

/** One shared top. Offsets per tile keep the freckles from repeating in lockstep. */
let freckleTex: CanvasTexture | null = null;

function freckleTexture(): CanvasTexture | null {
  if (freckleTex) return freckleTex;
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 256, 256);
  const spots: [number, number, number, number, number][] = [
    [38, 34, 14, 7, 0.4],
    [96, 58, 8, 5, -0.3],
    [168, 28, 6, 4, 0.6],
    [214, 72, 12, 6, 0.2],
    [52, 108, 5, 8, 1.1],
    [124, 96, 9, 5, -0.5],
    [188, 124, 7, 4, 0.3],
    [28, 168, 11, 5, 0.8],
    [86, 188, 4, 4, 0],
    [150, 176, 10, 6, -0.4],
    [220, 160, 6, 9, 0.7],
    [70, 220, 8, 4, 0.2],
    [196, 214, 5, 3, -0.2],
    [140, 48, 3, 3, 0.5],
    [230, 40, 4, 3, 0.1],
    [16, 80, 4, 3, 0.9]
  ];
  for (const [x, y, rx, ry, rot] of spots) {
    ctx.fillStyle = 'rgba(92, 58, 36, 0.28)';
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(120, 78, 48, 0.16)';
    ctx.beginPath();
    ctx.ellipse(x + 18, y + 22, rx * 0.45, ry * 0.45, rot, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  freckleTex = tex;
  return tex;
}

export class PlatformEntity {
  static create(index: number, platformX: number, z: number, baseScale: number, startY: number, scene: Scene): PlatformData {
    const topColor = this.platformColor(index);
    // Box groups: [+x, -x, +y, -y, +z, -z] — bright top, darker sides
    // (palette doc: sides visibly darker than tops, beyond lighting alone).
    const topMat = MaterialFactory.createMaterial(topColor);
    const sideMat = MaterialFactory.createMaterial(deriveSideColor(topColor));
    const mesh = new Mesh(platformGeo, [sideMat, sideMat, topMat, sideMat, sideMat, sideMat]);

    const outlineMat = new MeshBasicMaterial({ color: this.edgeColor, side: BackSide });
    const outlineMesh = new Mesh(platformGeo, outlineMat);
    outlineMesh.scale.multiplyScalar(1.02);

    const group = new Group();
    group.add(mesh);
    group.add(outlineMesh);

    const ribbon = new Mesh(ribbonGeo, ribbonMat);
    ribbon.name = 'dusk-ribbon';
    ribbon.position.y = 0;
    ribbon.renderOrder = 3;
    ribbon.visible = this.motionCue.strength > 0;
    group.add(ribbon);

    const rim = new Mesh(voidRimGeo, new MeshBasicMaterial({
      color: voidRimColor(index),
      side: DoubleSide
    }));
    rim.name = 'void-rim';
    rim.renderOrder = 5;
    rim.visible = this.voidRim;
    group.add(rim);

    // Perfect indicator: diamond + ring, lying flat
    // White diamond, black outline: the black fill vanished against the warm
    // tile and the unoutlined white vanished against the cloud, so the marker
    // needs BOTH. The outline is a slightly larger diamond behind it.
    const markOutlineMat = new MeshBasicMaterial({ color: 0x1b1218, depthWrite: false });
    const markOutline = new Mesh(diamondOutlineGeo, markOutlineMat);
    markOutline.rotation.x = -Math.PI / 2;
    markOutline.position.y = GAME_CONFIG.PLATFORM_HEIGHT / 2 + 0.008;
    group.add(markOutline);

    const dotMat = new MeshBasicMaterial({ color: 0xffffff });
    const perfectDot = new Mesh(diamondGeo, dotMat);
    perfectDot.rotation.x = -Math.PI / 2;
    perfectDot.position.y = GAME_CONFIG.PLATFORM_HEIGHT / 2 + 0.012;
    group.add(perfectDot);

    const ringMat = new MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      side: DoubleSide
    });
    const perfectRing = new Mesh(ringGeo, ringMat);
    perfectRing.rotation.x = -Math.PI / 2;
    perfectRing.position.y = GAME_CONFIG.PLATFORM_HEIGHT / 2 + 0.01;
    group.add(perfectRing);

    group.scale.set(baseScale, 1, baseScale);
    group.position.set(platformX, startY, z);
    scene.add(group);

    return {
      group,
      mesh,
      outlineMesh,
      topMat,
      sideMat,
      perfectDot,
      perfectRing,
      index,
      coins: [],
      z,
      platformX,
      swayOffset: 0,
      baseScale,
      hasRisen: startY === 0
    };
  }

  /** Master switch: while the start-screen attract demo runs, coins are
   *  suppressed (cleared + never re-added) so the demo runway stays clean. */
  static coinsEnabled = true;

  /** Random coin add (28% chance). Clears existing coins first (original `ou`+`Zd`).
   *  No-op while `coinsEnabled` is false (attract demo). Pass `force` to
   *  guarantee a coin regardless of the chance (first-run coin lesson). */
  static addCoin(platform: PlatformData, scene: Scene, force = false): void {
    if (!this.coinsEnabled) return;
    this.clearCoins(platform);
    if (!force && Math.random() >= GAME_CONFIG.COIN_CHANCE) return;

    const coinMat = MaterialFactory.createCoinMaterial();
    // The shared coin picture is already colored. A world tint would multiply
    // over the star and hide the artwork. Gold is only the fallback before it loads.
    if (!coinMat.map && this.coinColorOverride !== null) coinMat.color.setHex(this.coinColorOverride);
    const coinMesh = new Mesh(coinGeo, coinMat);
    coinMesh.quaternion.copy(coinFacing);

    const outlineMat = new MeshBasicMaterial({ color: this.edgeColor, side: BackSide });
    const outlineMesh = new Mesh(coinGeo, outlineMat);
    outlineMesh.scale.multiplyScalar(1.08);
    outlineMesh.quaternion.copy(coinFacing);

    const coinGroup = new Group();
    coinGroup.add(coinMesh);
    coinGroup.add(outlineMesh);
    // Already part-way through a turn, so a new tile does not show the face
    // square to the camera like every other coin.
    coinGroup.rotation.y = Math.random() * Math.PI * 2;
    coinGroup.position.set(
      0,
      GAME_CONFIG.PLATFORM_HEIGHT / 2 + GAME_CONFIG.COIN_RADIUS + 0.15,
      0
    );
    platform.group.add(coinGroup);
    platform.coins.push({
      group: coinGroup,
      collected: false,
      spin: -4,
      bobPhase: Math.random() * Math.PI * 2
    });
  }

  static clearCoins(platform: PlatformData): void {
    for (const coin of platform.coins) {
      platform.group.remove(coin.group);
      // Dispose per-coin materials only; geometries are shared singletons.
      coin.group.traverse((obj) => {
        const m = obj as Mesh;
        if (m.material) (m.material as MeshBasicMaterial).dispose();
      });
    }
    platform.coins = [];
  }

  static collectCoin(platform: PlatformData, coin: CoinObject): void {
    coin.collected = true;
    gsap.to(coin.group.scale, {
      x: 0,
      y: 0,
      z: 0,
      duration: 0.2,
      onComplete: () => {
        platform.group.remove(coin.group);
      }
    });
  }

  /** Recycle a platform to a new index with updated difficulty values. */
  static recycle(platform: PlatformData, newIndex: number, platformX: number, z: number, baseScale: number, scene: Scene): void {
    platform.index = newIndex;
    platform.z = z;
    platform.platformX = platformX;
    platform.swayOffset = 0;
    platform.baseScale = baseScale;
    platform.group.scale.set(baseScale, 1, baseScale);
    platform.group.position.set(platformX, -5, z);
    platform.hasRisen = false;
    this.setFaceColors(platform, this.platformColor(newIndex));
    this.addCoin(platform, scene);
    gsap.to(platform.group.position, {
      y: 0,
      duration: GAME_CONFIG.PLATFORM_RISE_DURATION,
      ease: 'back.out(1.2)',
      onComplete: () => {
        platform.hasRisen = true;
      }
    });
  }

  static riseAnimation(platform: PlatformData): void {
    gsap.to(platform.group.position, {
      y: 0,
      duration: GAME_CONFIG.PLATFORM_RISE_DURATION,
      ease: 'back.out(1.2)',
      delay: 0.1,
      onComplete: () => {
        platform.hasRisen = true;
      }
    });
  }

  static resetPosition(platform: PlatformData, platformX: number, z: number): void {
    gsap.killTweensOf(platform.group.position);
    platform.group.position.set(platformX, 0, z);
    platform.hasRisen = true;
  }

  /** Palette color for platform index: world-local list when set (§11.5),
   *  else the legacy global cycle (random start + floor(index/12), lerp). */
  static platformColor(index: number): number {
    if (this.facePalette) {
      const list = this.facePalette;
      return list[((index % list.length) + list.length) % list.length];
    }    const palettes = GAME_CONFIG.COLOR_PALETTES;
    const start = PlatformEntity.paletteStart;
    const palette = palettes[(start + Math.floor(index / GAME_CONFIG.COLOR_CYCLE_STEPS)) % palettes.length];
    const t = (index % 6) / 6;
    const base = new Color(palette.base);
    const light = new Color(palette.light);
    return base.clone().lerp(light, t * 0.5).getHex();
  }

  static paletteStart = 0;

  /**
   * Week 2 (§10-11): world-local face/coin palettes. Set by Game.applyWorldLook;
   * null restores the legacy global behavior. reset()/recycle() repaint via
   * platformColor/addCoin, so a palette swap propagates with no extra calls.
   */
  static facePalette: number[] | null = null;
  static coinColorOverride: number | null = null;
  /** Tile-top diamond colour; null falls back to the default warm dark. */
  static tileMarkOverride: number | null = null;

  static setFacePalette(faces: number[] | null): void {
    this.facePalette = faces && faces.length > 0 ? [...faces] : null;
  }

static setCoinColor(color: number | null): void {
    this.coinColorOverride = color;
  }

  /** Tile-top diamond colour, so the landing marker always reads on the tile. */
  static setTileMark(color: number | null): void {
    this.tileMarkOverride = color;
  }

  /** Hull color for newly built outlines (set by Game.applyWorldLook). */
  static edgeColor: number = GAME_CONFIG.COLOR_OUTLINE;

  static setEdgeColor(color: number): void {
    this.edgeColor = color;
  }

  /** Parallel to the face cycle. Null keeps the derived darker side. */
  static sidePalette: number[] | null = null;

  static setSidePalette(sides: number[] | null): void {
    this.sidePalette = sides && sides.length > 0 ? [...sides] : null;
  }

  /**
   * Dusk tiles stay close to their painted colours. The shared toon ramp
   * crushes a vertical face toward gray, which turned the cream slabs brown.
   */
  static flatTiles = false;

  static setFlatTiles(on: boolean): void {
    this.flatTiles = on;
  }

  /**
   * Void tiles are navy. The shared toon ramp's shadow step would crush them
   * to black, so a little of the face colour is added back. Dusk uses
   * flatTiles instead, and that path also paints freckles — this one does not.
   */
  static colorLift = 0;

  static setColorLift(amount: number): void {
    this.colorLift = amount;
  }

  /** Corner glow on the void tile. Off for Sunrise and Dusk. */
  static voidRim = false;

  static setVoidRim(on: boolean): void {
    this.voidRim = on;
  }

  private static paintVoidRim(platform: PlatformData): void {
    const rim = platform.group.getObjectByName('void-rim') as Mesh | undefined;
    if (!rim) return;
    rim.visible = this.voidRim;
    (rim.material as MeshBasicMaterial).color.setHex(voidRimColor(platform.index));
  }

  /** Cyan lower-edge ribbon. strength 0 hides it (Sunrise, Void). */
  static motionCue: { color: number; strength: number } = { color: 0x20e6ea, strength: 0 };

  static setMotionCue(cue: { color: number; strength: number }): void {
    this.motionCue = { color: cue.color, strength: cue.strength };
    ribbonMat.color.setHex(cue.color);
  }

  static syncMotionCue(platform: PlatformData): void {
    const ribbon = platform.group.getObjectByName('dusk-ribbon');
    if (ribbon) ribbon.visible = this.motionCue.strength > 0;
  }

  /** Paint a platform's top + side. Sides come from the world list when one is set. */
  static setFaceColors(platform: PlatformData, top: number): void {
    platform.topMat.color.setHex(top);
    const sides = this.sidePalette;
    const side = sides && sides.length > 0
      ? sides[((platform.index % sides.length) + sides.length) % sides.length]
      : deriveSideColor(top);
    platform.sideMat.color.setHex(side);
    const brightTop = ((top >> 16) & 255) > 170 && ((top >> 8) & 255) > 170;
    const lift = this.flatTiles ? 0.22 : brightTop ? Math.min(0.06, this.colorLift) : this.colorLift;
    const glow = this.flatTiles || this.colorLift > 0;
    platform.topMat.emissive.setHex(glow ? top : 0x000000);
    platform.topMat.emissiveIntensity = lift;
    platform.sideMat.emissive.setHex(glow ? side : 0x000000);
    platform.sideMat.emissiveIntensity = lift * 0.65;
    const spots = this.flatTiles ? freckleTexture() : null;
    if (spots) {
      let map = platform.topMat.userData.freckle as CanvasTexture | undefined;
      if (!map) {
        map = spots.clone();
        map.wrapS = RepeatWrapping;
        map.wrapT = RepeatWrapping;
        platform.topMat.userData.freckle = map;
      }
      const n = platform.index;
      map.offset.set((n * 0.37) % 1, (n * 0.53) % 1);
      map.needsUpdate = true;
      platform.topMat.map = map;
    } else {
      platform.topMat.map = null;
    }
    platform.topMat.needsUpdate = true;
    this.paintVoidRim(platform);
  }

  static randomizePaletteStart(): void {
    PlatformEntity.paletteStart = Math.floor(Math.random() * GAME_CONFIG.COLOR_PALETTES.length);
  }
}


