import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  RingGeometry,
  Shape,
  ShapeGeometry,
  BackSide,
  DoubleSide,
  Color,
  type Scene
} from 'three';
import { GAME_CONFIG } from '../config/GameConfig';
import { MaterialFactory } from '../systems/MaterialFactory';
import { gsap } from 'gsap';

export interface GemObject {
  group: Group;
  collected: boolean;
}

export interface PlatformData {
  group: Group;
  mesh: Mesh;
  outlineMesh: Mesh;
  perfectDot: Mesh;
  perfectRing: Mesh;
  index: number;
  gems: GemObject[];
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
const gemGeo = new CylinderGeometry(
  GAME_CONFIG.GEM_RADIUS,
  GAME_CONFIG.GEM_RADIUS,
  0.06,
  16
);
const ringGeo = new RingGeometry(
  GAME_CONFIG.PERFECT_DOT_RADIUS,
  GAME_CONFIG.PERFECT_DOT_RADIUS + 0.06,
  24
);

// Diamond shape (from the original `os` path)
function createDiamondGeo(): ShapeGeometry {
  const ro = 0.15;
  const shape = new Shape();
  shape.moveTo(0, ro);
  shape.lineTo(ro, 0);
  shape.lineTo(0, -ro);
  shape.lineTo(-ro, 0);
  shape.closePath();
  return new ShapeGeometry(shape);
}
const diamondGeo = createDiamondGeo();

export class PlatformEntity {
  static create(index: number, platformX: number, z: number, baseScale: number, startY: number, scene: Scene): PlatformData {
    const material = MaterialFactory.createMaterial(this.platformColor(index));
    const mesh = new Mesh(platformGeo, material);

    const outlineMat = new MeshBasicMaterial({ color: GAME_CONFIG.COLOR_OUTLINE, side: BackSide });
    const outlineMesh = new Mesh(platformGeo, outlineMat);
    outlineMesh.scale.multiplyScalar(1.02);

    const group = new Group();
    group.add(mesh);
    group.add(outlineMesh);

    // Perfect indicator: diamond + ring, lying flat
    const dotMat = new MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.5,
      depthWrite: false
    });
    const perfectDot = new Mesh(diamondGeo, dotMat);
    perfectDot.rotation.x = -Math.PI / 2;
    perfectDot.position.y = GAME_CONFIG.PLATFORM_HEIGHT / 2 + 0.01;
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
      perfectDot,
      perfectRing,
      index,
      gems: [],
      z,
      platformX,
      swayOffset: 0,
      baseScale,
      hasRisen: startY === 0
    };
  }

  /** Random gem add (28% chance). Clears existing gems first (original `ou`+`Zd`). */
  static addGem(platform: PlatformData, scene: Scene): void {
    this.clearGems(platform);
    if (Math.random() >= GAME_CONFIG.GEM_CHANCE) return;

    const gemMat = MaterialFactory.createMaterial(GAME_CONFIG.COLOR_GEM);
    const gemMesh = new Mesh(gemGeo, gemMat);
    gemMesh.rotation.z = Math.PI / 2;

    const outlineMat = new MeshBasicMaterial({ color: GAME_CONFIG.COLOR_OUTLINE, side: BackSide });
    const outlineMesh = new Mesh(gemGeo, outlineMat);
    outlineMesh.scale.multiplyScalar(1.08);
    outlineMesh.rotation.z = Math.PI / 2;

    const gemGroup = new Group();
    gemGroup.add(gemMesh);
    gemGroup.add(outlineMesh);
    gemGroup.position.set(
      0,
      GAME_CONFIG.PLATFORM_HEIGHT / 2 + GAME_CONFIG.GEM_RADIUS + 0.15,
      0
    );
    platform.group.add(gemGroup);
    platform.gems.push({ group: gemGroup, collected: false });
  }

  static clearGems(platform: PlatformData): void {
    for (const gem of platform.gems) {
      platform.group.remove(gem.group);
      // Dispose per-gem materials only; geometries are shared singletons.
      gem.group.traverse((obj) => {
        const m = obj as Mesh;
        if (m.material) (m.material as MeshBasicMaterial).dispose();
      });
    }
    platform.gems = [];
  }

  static collectGem(platform: PlatformData, gem: GemObject): void {
    gem.collected = true;
    gsap.to(gem.group.scale, {
      x: 0,
      y: 0,
      z: 0,
      duration: 0.2,
      onComplete: () => {
        platform.group.remove(gem.group);
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
    (platform.mesh.material as MeshToonMaterial).color.setHex(this.platformColor(newIndex));
    this.addGem(platform, scene);
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

  /** Palette color for platform index: random start + floor(index/12) cycle, lerp base→light. */
  static platformColor(index: number): number {
    const palettes = GAME_CONFIG.COLOR_PALETTES;
    const start = PlatformEntity.paletteStart;
    const palette = palettes[(start + Math.floor(index / GAME_CONFIG.COLOR_CYCLE_STEPS)) % palettes.length];
    const t = (index % 6) / 6;
    const base = new Color(palette.base);
    const light = new Color(palette.light);
    return base.clone().lerp(light, t * 0.5).getHex();
  }

  static paletteStart = 0;

  static randomizePaletteStart(): void {
    PlatformEntity.paletteStart = Math.floor(Math.random() * GAME_CONFIG.COLOR_PALETTES.length);
  }
}
