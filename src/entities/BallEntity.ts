import {
  BackSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  SphereGeometry,
  TorusGeometry,
  DoubleSide,
  AdditiveBlending,
  Quaternion,
  Vector3,
  type Scene
} from 'three';
import { GAME_CONFIG } from '../config/GameConfig';
import { MaterialFactory } from '../systems/MaterialFactory';
import type { JumpParams } from '../core/Types';
import { gsap } from 'gsap';

/**
 * Ball entity: ball mesh + outline + "blob" highlight, jump tweens.
 * Faithful to the original Gt group + Qd jump math.
 */
export class BallEntity {
  group: Group;
  mesh: Mesh;
  outlineMesh: Mesh;
  private blobMesh: Mesh;
  private blobMaterial: MeshBasicMaterial;
  private meshMaterial: MeshToonMaterial | MeshBasicMaterial;
  private baseGeo: SphereGeometry;
  /** False once a shared skin material is installed. That material is cached. */
  private ownsMaterial = true;
  /** One solid material for the shop cards. Not the shared photo cache. */
  private solidPreview: MeshToonMaterial | null = null;
  private readonly rollAxis = new Vector3();
  private readonly rollQuat = new Quaternion();
  private shieldShell: Mesh;
  private shieldShellMat: MeshBasicMaterial;
  private shieldRing: Mesh;
  private shieldRingMat: MeshBasicMaterial;

  constructor(private scene: Scene) {
    this.baseGeo = new SphereGeometry(GAME_CONFIG.BALL_RADIUS, 24, 16);
    this.meshMaterial = MaterialFactory.createMaterial(GAME_CONFIG.COLOR_BALL);
    this.mesh = new Mesh(this.baseGeo, this.meshMaterial);

    this.outlineMesh = this.makeOutline(this.baseGeo, 1.06);

    // blob highlight (partial sphere), from the original Hd mesh
    const blobGeo = new SphereGeometry(GAME_CONFIG.BALL_RADIUS * 0.92, 16, 8, 0.3, 1.2, 0.2, 1);
    this.blobMaterial = new MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.55,
      depthWrite: false
    });
    this.blobMesh = new Mesh(blobGeo, this.blobMaterial);
    this.blobMesh.position.set(0.06, 0.08, -0.04);

    // Shield visuals (FR-4.4): translucent glow shell + energy ring, hidden until setShield.
    this.shieldShellMat = new MeshBasicMaterial({
      color: 0x66ccff,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      side: DoubleSide,
      blending: AdditiveBlending
    });
    this.shieldShell = new Mesh(new SphereGeometry(GAME_CONFIG.BALL_RADIUS * 1.28, 16, 12), this.shieldShellMat);

    this.shieldRingMat = new MeshBasicMaterial({
      color: 0x88ddff,
      transparent: true,
      opacity: 0.85,
      depthWrite: false
    });
    this.shieldRing = new Mesh(
      new TorusGeometry(GAME_CONFIG.BALL_RADIUS * 1.4, 0.02, 6, 24),
      this.shieldRingMat
    );
    this.shieldRing.rotation.x = Math.PI / 2;
    this.shieldShell.visible = false;
    this.shieldRing.visible = false;

    this.group = new Group();
    this.group.add(this.mesh);
    this.group.add(this.outlineMesh);
    this.group.add(this.blobMesh);
    this.group.add(this.shieldShell);
    this.group.add(this.shieldRing);
    this.group.position.set(0, GAME_CONFIG.PLATFORM_HEIGHT / 2 + GAME_CONFIG.BALL_RADIUS, 0);
    scene.add(this.group);
  }

  private makeOutline(geo: SphereGeometry, scale: number): Mesh {
    const mat = new MeshBasicMaterial({ color: GAME_CONFIG.COLOR_OUTLINE, side: BackSide });
    const mesh = new Mesh(geo, mat);
    mesh.scale.multiplyScalar(scale);
    return mesh;
  }

  setSkinColor(color: number): void {
    this.usePlayGeo();
    if (!this.ownsMaterial) {
      this.meshMaterial = MaterialFactory.createMaterial(color);
      this.mesh.material = this.meshMaterial;
      this.ownsMaterial = true;
    }
    this.meshMaterial.color.setHex(color);
    this.blobMaterial.opacity = 0.55;
  }

  /**
   * Install a cached skin material. The previous owned color material is
   * released. The shared skin material is left for the cache to dispose.
   * Photo skins (userData.photo) keep the picture's own light, so the shine
   * sticker stays off and the hull is smooth enough to hold the photo.
   */
  applySkinMaterial(material: MeshToonMaterial | MeshBasicMaterial): void {
    if (this.ownsMaterial) this.meshMaterial.dispose();
    this.ownsMaterial = false;
    this.meshMaterial = material;
    this.mesh.material = material;
    if (material.userData.photo === true) {
      this.usePhotoGeo();
      this.blobMaterial.opacity = 0;
    } else {
      this.usePlayGeo();
      this.blobMaterial.opacity = 0.2;
    }
  }

  /**
   * Shop card: a shared material on the smooth hull. The caller owns the
   * material. A solid color keeps a soft shine so the turn is visible.
   */
  wearShared(material: MeshToonMaterial | MeshBasicMaterial): void {
    if (this.ownsMaterial) {
      this.meshMaterial.dispose();
      this.ownsMaterial = false;
    }
    this.meshMaterial = material;
    this.mesh.material = material;
    this.usePhotoGeo();
    this.blobMaterial.opacity = material.userData.photo === true ? 0 : 0.4;
  }

  wearSolid(color: number): void {
    if (!this.solidPreview) this.solidPreview = MaterialFactory.createMaterial(color);
    this.solidPreview.color.setHex(color);
    this.wearShared(this.solidPreview);
  }

  private usePlayGeo(): void {
    this.mesh.geometry = this.baseGeo;
    this.outlineMesh.geometry = this.baseGeo;
    this.outlineMesh.scale.set(1.06, 1.06, 1.06);
  }

  private usePhotoGeo(): void {
    const geo = photoSphere();
    this.mesh.geometry = geo;
    this.outlineMesh.geometry = geo;
    this.outlineMesh.scale.set(1.06, 1.06, 1.06);
  }

  /** Show/hide the shield glow shell + ring. */
  setShield(active: boolean): void {
    this.shieldShell.visible = active;
    this.shieldRing.visible = active;
    if (active) {
      gsap.killTweensOf(this.shieldShellMat);
      gsap.killTweensOf(this.shieldRingMat);
      this.shieldShellMat.opacity = 0.22;
      this.shieldRingMat.opacity = 0.85;
      gsap.to(this.shieldShellMat, { opacity: 0.34, duration: 0.5, yoyo: true, repeat: 1 });
      gsap.to(this.shieldRingMat, { opacity: 0.35, duration: 0.5, yoyo: true, repeat: 1 });
    } else {
      gsap.killTweensOf(this.shieldShellMat);
      gsap.killTweensOf(this.shieldRingMat);
    }
  }

  reset(): void {
    gsap.killTweensOf(this.group.position);
    gsap.killTweensOf(this.group.scale);
    this.group.position.set(0, GAME_CONFIG.PLATFORM_HEIGHT / 2 + GAME_CONFIG.BALL_RADIUS, 0);
    this.group.scale.set(1, 1, 1);
    this.mesh.quaternion.identity();
    this.outlineMesh.quaternion.identity();
    this.blobMesh.quaternion.identity();
  }

  /**
   * Roll from horizontal travel. The axis stays on the ground, so a hop
   * forward and a steer to the side both turn the ball. Jump height is ignored.
   * A full roll hides the skin, so each hop only turns part of the way.
   */
  rollBy(dx: number, dz: number): void {
    const dist = Math.hypot(dx, dz);
    if (dist < 1e-5) return;
    const ROLL = 0.15;
    this.rollAxis.set(-dz / dist, 0, dx / dist);
    this.rollQuat.setFromAxisAngle(this.rollAxis, (dist / GAME_CONFIG.BALL_RADIUS) * ROLL);
    this.mesh.quaternion.premultiply(this.rollQuat);
    this.outlineMesh.quaternion.premultiply(this.rollQuat);
    this.blobMesh.quaternion.premultiply(this.rollQuat);
  }

  /**
   * Original Qd() jump: parabolic arc via easeInOutQuad on Z/Y plus sin bounce.
   * Applies squash/stretch keyframes and the landing bounce on complete.
   */
  performJump(
    params: JumpParams,
    onLanding: () => void
  ): void {
    const p = { t: 0 };
    const easeInOutQuad = (h: number): number =>
      h < 0.5 ? 2 * h * h : 1 - Math.pow(-2 * h + 2, 2) / 2;

    gsap.to(p, {
      t: 1,
      duration: params.duration,
      ease: 'none',
      onUpdate: () => {
        const h = p.t;
        const f = easeInOutQuad(h);
        this.group.position.z = this.lerp(params.startZ, params.endZ, f);
        this.group.position.y =
          this.lerp(params.startY, params.endY, f) + Math.sin(Math.PI * h) * params.bounceHeight;

        if (h > 0.85) {
          const d = (h - 0.85) / 0.15;
          this.group.scale.y = 1 - d * 0.15;
          this.group.scale.x = 1 + d * 0.08;
          this.group.scale.z = 1 + d * 0.08;
        } else if (h < 0.2) {
          const d = h / 0.2;
          this.group.scale.y = 1 + d * 0.1;
          this.group.scale.x = 1 - d * 0.05;
          this.group.scale.z = 1 - d * 0.05;
        } else {
          this.group.scale.set(1, 1, 1);
        }
      },
      onComplete: () => {
        gsap.to(this.group.scale, {
          y: 0.85,
          x: 1.08,
          z: 1.08,
          duration: 0.06,
          yoyo: true,
          repeat: 1,
          ease: 'power2.out'
        });
        onLanding();
      }
    });
  }

  /** Landing platform squash (from Qd onComplete, on the platform). */
  static squashPlatform(group: Group, baseScale: number): void {
    gsap.killTweensOf(group.scale);
    group.scale.set(baseScale, 1, baseScale);
    gsap.to(group.scale, {
      y: 0.7,
      x: baseScale * 1.08,
      z: baseScale * 1.08,
      duration: 0.08,
      ease: 'power2.out',
      yoyo: true,
      repeat: 1,
      onComplete: () => {
        group.scale.set(baseScale, 1, baseScale);
      }
    });
  }

  getPosition(): { x: number; y: number; z: number } {
    return this.group.position;
  }

  dispose(): void {
    gsap.killTweensOf(this.group.position);
    gsap.killTweensOf(this.group.scale);
    gsap.killTweensOf(this.shieldShellMat);
    gsap.killTweensOf(this.shieldRingMat);
    this.baseGeo.dispose();
    if (this.ownsMaterial) this.meshMaterial.dispose();
    this.solidPreview?.dispose();
    this.blobMesh.geometry.dispose();
    this.blobMaterial.dispose();
    (this.outlineMesh.material as MeshBasicMaterial).dispose();
    (this.shieldShell.geometry as SphereGeometry).dispose();
    this.shieldShellMat.dispose();
    (this.shieldRing.geometry as TorusGeometry).dispose();
    this.shieldRingMat.dispose();
    this.scene.remove(this.group);
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }
}

/** One smooth hull for every photo skin. Same radius as the play ball. */
let sharedPhotoGeo: SphereGeometry | null = null;

function photoSphere(): SphereGeometry {
  if (!sharedPhotoGeo) sharedPhotoGeo = new SphereGeometry(GAME_CONFIG.BALL_RADIUS, 96, 64);
  return sharedPhotoGeo;
}
