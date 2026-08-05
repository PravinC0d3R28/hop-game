import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  Fog,
  AmbientLight,
  DirectionalLight,
  Color
} from 'three';
import { GAME_CONFIG } from '../config/GameConfig';
import { MaterialFactory } from './MaterialFactory';
import { THEMES, type ThemeName } from '../config/Themes';

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

  constructor(container: HTMLElement) {
    this.container = container;
    const rect = container.getBoundingClientRect();

    this.scene = new Scene();
    this.scene.background = new Color(GAME_CONFIG.COLOR_BG);
    this.scene.fog = new Fog(GAME_CONFIG.COLOR_BG, 14, 40);

    this.camera = new PerspectiveCamera(55, rect.width / rect.height, 0.1, 100);
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

  setTheme(theme: ThemeName): void {
    const t = THEMES[theme];
    this.scene.background = new Color(t.bg);
    const fog = this.scene.fog;
    if (fog && 'color' in fog) (fog.color as Color).setHex(t.bg);
    this.container.style.background = t.cssBg;
    document.body.style.background = t.cssBg;
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
  };

  start(): void {
    this.lastTime = performance.now();
    const loop = (now: number): void => {
      this.rafId = requestAnimationFrame(loop);
      const delta = Math.min((now - this.lastTime) / 1000, 0.05);
      this.lastTime = now;
      MaterialFactory.updateLightDirection(this.directional);
      this.updateCallback?.(delta);
      this.renderer.render(this.scene, this.camera);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop(): void {
    cancelAnimationFrame(this.rafId);
  }

  dispose(): void {
    this.stop();
    this.resizeObserver.disconnect();
    window.removeEventListener('resize', this.handleResize);
    this.renderer.dispose();
  }
}
