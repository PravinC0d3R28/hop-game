import {
  BackSide,
  BufferAttribute,
  Color,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  Vector3,
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  Fog,
  AmbientLight,
  DirectionalLight
} from 'three';
import { GAME_CONFIG } from '../config/GameConfig';
import { MaterialFactory } from './MaterialFactory';
import type { WorldLook } from '../config/WorldLooks';

export class RendererSystem {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  ambient: AmbientLight;
  directional: DirectionalLight;
  private container: HTMLElement;
  private resizeObserver: ResizeObserver;
  private updateCallback: ((delta: number) => void) | null = null;
  private rafId = 0;
  private lastTime = 0;
  /** Gradient sky dome (palette doc §11): follows the camera, fog-exempt. */
  private dome: Mesh | null = null;
  /** Framing listener, so the scenery can lay itself out for the viewport. */
  private onFrame: ((fovDeg: number, aspect: number) => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    const rect = container.getBoundingClientRect();

    this.scene = new Scene();
    this.scene.background = new Color(GAME_CONFIG.COLOR_BG);
    this.scene.fog = new Fog(GAME_CONFIG.COLOR_BG, 14, 40);

    // Far plane reaches past the fog so the cloud sea and distant formations
    // are never clipped before they finish fading — but not further: every
    // extra unit of range costs depth precision, and a thin outline needs the
    // depth buffer to separate it from the face it hugs.
    this.camera = new PerspectiveCamera(55, rect.width / rect.height, 0.1, 110);
    this.camera.position.set(0, GAME_CONFIG.CAMERA_OFFSET_Y, GAME_CONFIG.CAMERA_OFFSET_Z);
    this.camera.lookAt(0, 0, GAME_CONFIG.CAMERA_LOOK_AHEAD);

    this.renderer = new WebGLRenderer({ antialias: true });
    this.renderer.setSize(rect.width, rect.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.prepend(this.renderer.domElement);

    this.ambient = new AmbientLight(0xffffff, 0.38);
    this.directional = new DirectionalLight(0xffffff, 2);
    this.directional.position.set(3, 10, 8);
    this.scene.add(this.ambient);
    this.scene.add(this.directional);

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);
    window.addEventListener('resize', this.handleResize);
  }

  /**
   * Week 2 (§10): apply the active world's look — sky, fog, lights and page
   * chrome. The world owns the 3D scene; the removed light/dark toggle never
   * touches this (it persists a HUD-only preference). Flat `skyBottom` is the
   * clear color for now; `skyTop` reserves the gradient-dome refinement.
   */
  applyWorldLook(look: WorldLook): void {
    this.scene.background = new Color(look.skyBottom);
    const fog = this.scene.fog;
    if (fog && 'color' in fog) {
      (fog.color as Color).setHex(look.fogColor);
      (fog as Fog).near = look.fogNear;
      (fog as Fog).far = look.fogFar;
    }
    this.ambient.color.setHex(look.ambient.color);
    this.ambient.intensity = look.ambient.intensity;
    this.directional.color.setHex(look.directional.color);
    this.directional.intensity = look.directional.intensity;
    // Upper-left key per look (absent = keep position — Dusk/Void pre-pass).
    if (look.directionalPos) this.directional.position.set(...look.directionalPos);
    this.updateDome(look);
    const css = `#${look.skyBottom.toString(16).padStart(6, '0')}`;
    this.container.style.background = css;
    document.body.style.background = css;
  }

  /**
   * Sky dome: BackSide sphere with a baked vertical gradient (skyBottom at
   * the horizon → skyTop above). One dome per renderer; colors rewritten per
   * look. The dome trails the camera every frame so the runway never leaves it.
   */
  private updateDome(look: WorldLook): void {
    if (!this.dome) {
      const geo = new SphereGeometry(60, 24, 16);
      geo.setAttribute('color', new BufferAttribute(new Float32Array(geo.getAttribute('position').count * 3), 3));
      const mat = new MeshBasicMaterial({ vertexColors: true, side: BackSide, fog: false, depthWrite: false });
      this.dome = new Mesh(geo, mat);
      this.dome.renderOrder = -1;
      this.dome.frustumCulled = false;
      this.scene.add(this.dome);
    }
    const geo = this.dome.geometry as SphereGeometry;
    const pos = geo.getAttribute('position') as BufferAttribute;
    const col = geo.getAttribute('color') as BufferAttribute;
    const top = new Color(look.skyTop);
    const bottom = new Color(look.skyBottom);
    const v = new Vector3();
    const c = new Color();
    for (let i = 0; i < pos.count; i++) {
      // Visible-band gradient: the gameplay camera looks steeply down, so
      // the frame's sky spans dome-local y ≈ -25 (horizon cream) to -10
      // (dawn color at frame top). Mapping the full hemisphere hid the whole
      // gradient above the frame (the "flat sky" bug).
      v.fromBufferAttribute(pos, i);
      const t = Math.min(1, Math.max(0, (v.y / 60 + 0.417) / 0.25));
      const s = t * t * (3 - 2 * t);
      c.copy(bottom).lerp(top, s);
      col.setXYZ(i, c.r, c.g, c.b);
    }
    col.needsUpdate = true;
  }

  setUpdateCallback(cb: (delta: number) => void): void {
    this.updateCallback = cb;
  }

  private handleResize = (): void => {
    const rect = this.container.getBoundingClientRect();
    this.camera.aspect = rect.width / rect.height;
    // FOV: base 55; grows when aspect < 1 (portrait/mobile)
    const fov = rect.width / rect.height < 1 ? 55 + (1 - this.camera.aspect) * 30 : 55;
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(rect.width, rect.height, false);
    this.notifyFrame();
  };

  /**
   * Push the live framing to anyone who needs it.
   *
   * The crystal field lays itself out against the horizontal field of view, and
   * portrait sees barely half the width a laptop does — so the field has to be
   * rebuilt whenever the framing changes or crystals end up off screen on a
   * phone. No-op when unchanged, so an ordinary resize does not thrash.
   */
  private notifyFrame(): void {
    this.onFrame?.(this.camera.fov, this.camera.aspect);
  }

  /** Register a framing listener (Game forwards this to BackgroundSystem). */
  setFrameListener(cb: (fovDeg: number, aspect: number) => void): void {
    this.onFrame = cb;
    this.notifyFrame();
  }

  start(): void {
    this.lastTime = performance.now();
    const loop = (now: number): void => {
      this.rafId = requestAnimationFrame(loop);
      const delta = Math.min((now - this.lastTime) / 1000, 0.05);
      this.lastTime = now;
      MaterialFactory.updateLightDirection(this.directional);
      this.updateCallback?.(delta);
      if (this.dome) this.dome.position.copy(this.camera.position);
      this.renderer.render(this.scene, this.camera);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop(): void {
    cancelAnimationFrame(this.rafId);
  }

  dispose(): void {
    this.stop();
    if (this.dome) {
      this.scene.remove(this.dome);
      this.dome.geometry.dispose();
      (this.dome.material as MeshBasicMaterial).dispose();
      this.dome = null;
    }
    this.resizeObserver.disconnect();
    window.removeEventListener('resize', this.handleResize);
    this.renderer.dispose();
  }
}

