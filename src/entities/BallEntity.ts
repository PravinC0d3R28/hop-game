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
  type Scene,
  type Vector3
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
  private meshMaterial: MeshToonMaterial;
  private shieldShell: Mesh;
  private shieldShellMat: MeshBasicMaterial;
  private shieldRing: Mesh;
  private shieldRingMat: MeshBasicMaterial;

  constructor(private scene: Scene) {
    const ballGeo = new SphereGeometry(GAME_CONFIG.BALL_RADIUS, 24, 16);
    this.meshMaterial = MaterialFactory.createMaterial(GAME_CONFIG.COLOR_BALL);
    this.mesh = new Mesh(ballGeo, this.meshMaterial);

    this.outlineMesh = this.makeOutline(ballGeo, 1.06);

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
    this.meshMaterial.color.setHex(color);
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
    this.mesh.geometry.dispose();
    (this.mesh.material as MeshBasicMaterial).dispose();
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
