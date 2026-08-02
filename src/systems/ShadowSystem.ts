import { CircleGeometry, MeshBasicMaterial, Mesh, type Scene } from 'three';
import { GAME_CONFIG } from '../config/GameConfig';

/**
 * Ground shadow under the ball (function `ip` shadow block).
 * Scale & opacity shrink as the ball gets higher.
 */
export class ShadowSystem {
  mesh: Mesh;
  private material: MeshBasicMaterial;

  constructor(private scene: Scene) {
    const geometry = new CircleGeometry(GAME_CONFIG.BALL_RADIUS, 16);
    this.material = new MeshBasicMaterial({
      color: 0x1a1a1a,
      transparent: true,
      opacity: 0.35,
      depthWrite: false
    });
    this.mesh = new Mesh(geometry, this.material);
    this.mesh.rotation.x = -Math.PI / 2;
    scene.add(this.mesh);
  }

  setThemeColor(color: number): void {
    this.material.color.setHex(color);
  }

  /** Mirrors the per-frame shadow math from the original loop. */
  update(ballX: number, ballY: number, ballZ: number): void {
    const groundY = GAME_CONFIG.PLATFORM_HEIGHT / 2 + 0.02;
    const height = Math.max(0, ballY - groundY);
    const scale = this.clamp(1 - height * 0.15, 0.3, 1);
    const opacity = this.clamp(0.35 - height * 0.06, 0.05, 0.35);
    this.mesh.position.set(ballX, groundY, ballZ);
    this.mesh.scale.setScalar(scale);
    this.material.opacity = opacity;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.scene.remove(this.mesh);
  }

  private clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
  }
}
