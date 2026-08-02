import { Vector3, type PerspectiveCamera } from 'three';
import { GAME_CONFIG } from '../config/GameConfig';

const X_DEAD_BAND = 0.5;

/**
 * Faithful port of the original camera follow (function `wy`).
 * - horizontal target `Ir` tracks ballX with a ±0.5 dead-band, lerp 0.15
 * - position lerps: x 0.12, y 0.04, z 0.06
 * - lookAt target lerps at 0.08, ahead of the ball
 */
export class CameraController {
  private cam: PerspectiveCamera;
  private ir = 0;
  private target = new Vector3(0, GAME_CONFIG.CAMERA_OFFSET_Y, GAME_CONFIG.CAMERA_OFFSET_Z);
  private lookTarget = new Vector3(0, 0, GAME_CONFIG.CAMERA_LOOK_AHEAD);
  private lookSmoothed = new Vector3(0, 0, GAME_CONFIG.CAMERA_LOOK_AHEAD);

  constructor(camera: PerspectiveCamera) {
    this.cam = camera;
  }

  update(ballX: number, ballZ: number): void {
    const diff = ballX - this.ir;
    if (Math.abs(diff) > X_DEAD_BAND) {
      const sign = diff > 0 ? 1 : -1;
      const n = ballX - sign * X_DEAD_BAND;
      this.ir = this.lerp(this.ir, n, 0.15);
    }

    this.target.set(this.ir, GAME_CONFIG.CAMERA_OFFSET_Y, ballZ + GAME_CONFIG.CAMERA_OFFSET_Z);

    this.cam.position.x = this.lerp(this.cam.position.x, this.target.x, 0.12);
    this.cam.position.y = this.lerp(this.cam.position.y, this.target.y, 0.04);
    this.cam.position.z = this.lerp(this.cam.position.z, this.target.z, 0.06);

    this.lookTarget.set(
      this.ir,
      GAME_CONFIG.CAMERA_LOOK_AHEAD * 0.3,
      ballZ + GAME_CONFIG.CAMERA_LOOK_AHEAD
    );
    this.lookSmoothed.lerp(this.lookTarget, 0.08);
    this.cam.lookAt(this.lookSmoothed);
  }

  reset(): void {
    this.ir = 0;
    this.cam.position.set(0, GAME_CONFIG.CAMERA_OFFSET_Y, GAME_CONFIG.CAMERA_OFFSET_Z);
    this.lookSmoothed.set(0, 0, GAME_CONFIG.CAMERA_LOOK_AHEAD);
    this.cam.lookAt(0, 0, GAME_CONFIG.CAMERA_LOOK_AHEAD);
  }

  /** Screen shake: 6 random offsets, 0.04s each (original game-over shake). */
  shake(): void {
    const startX = this.cam.position.x;
    const startY = this.cam.position.y;
    for (let i = 0; i < 6; i++) {
      setTimeout(() => {
        this.cam.position.x = startX + (Math.random() - 0.5) * 0.3;
        this.cam.position.y = startY + (Math.random() - 0.5) * 0.15;
      }, i * 40);
    }
    setTimeout(() => {
      this.cam.position.x = startX;
      this.cam.position.y = startY;
    }, 6 * 40);
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }
}
