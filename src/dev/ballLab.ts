// Dev-only. The equipped ball, framed the way a hop sees it.
// Not part of the production build (Vite only bundles index.html).
import {
  BoxGeometry,
  Fog,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
  AmbientLight,
  DirectionalLight,
  BackSide,
  Color
} from 'three';
import { GAME_CONFIG } from '../config/GameConfig';
import { getWorldLook, type WorldLook } from '../config/WorldLooks';
import { BallEntity } from '../entities/BallEntity';
import { MaterialFactory } from '../systems/MaterialFactory';
import { ballPhotoCamera, ballSkinMaterial, PAINTED_BALLS, paintedBall, preloadBallSkins } from '../systems/BallSkins';

MaterialFactory.init();

const params = new URLSearchParams(location.search);
const skinId = params.get('skin') || 'paper-core';
const found = paintedBall(skinId);
if (!found) throw new Error(`HOP ball lab: unknown skin "${skinId}"`);
let active = found;
const frameOnly = params.has('frame');
const sheet = params.has('sheet');

const title = document.getElementById('title')!;
title.textContent = active.name;
const balls: BallEntity[] = [];
const paints: Array<() => void> = [];
const hoppers: BallEntity[] = [];
const lastHopZ = new WeakMap<BallEntity, number>();
let closeBall: BallEntity | null = null;
const row = document.getElementById('row')!;
const phoneRow = document.getElementById('phone-row')!;

function mount(parent: HTMLElement, label: string, className: string, worldId: string): void {
  const cell = document.createElement('div');
  cell.className = `cell ${className}`;
  const caption = document.createElement('span');
  caption.textContent = label;
  cell.appendChild(caption);
  parent.appendChild(cell);

  const look = getWorldLook(worldId);
  const scene = new Scene();
  scene.background = new Color(look.skyBottom);
  scene.fog = new Fog(look.fogColor, look.fogNear, look.fogFar);

  const ambient = new AmbientLight(look.ambient.color, look.ambient.intensity);
  const sun = new DirectionalLight(look.directional.color, look.directional.intensity);
  const pos = look.directionalPos ?? [3, 10, 8];
  sun.position.set(pos[0], pos[1], pos[2]);
  scene.add(ambient);
  scene.add(sun);

  addPath(scene, look);

  const ball = new BallEntity(scene);
  ball.applySkinMaterial(ballSkinMaterial(active.id));
  balls.push(ball);
  hoppers.push(ball);

  const camera = new PerspectiveCamera(55, 1, 0.1, 150);
  const renderer = new WebGLRenderer({ antialias: true });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.setPixelRatio(2);
  cell.appendChild(renderer.domElement);

  const fit = (): void => {
    const width = cell.clientWidth;
    const height = cell.clientHeight;
    const aspect = width / height;
    camera.aspect = aspect;
    camera.fov = aspect < 1 ? 55 + (1 - aspect) * 30 : 55;
    camera.position.set(0, GAME_CONFIG.CAMERA_OFFSET_Y, GAME_CONFIG.CAMERA_OFFSET_Z);
    camera.lookAt(0, GAME_CONFIG.CAMERA_LOOK_AHEAD * 0.3, GAME_CONFIG.CAMERA_LOOK_AHEAD);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  };

  const paint = (): void => {
    const z = ball.group.position.z;
    camera.position.set(0, GAME_CONFIG.CAMERA_OFFSET_Y, z + GAME_CONFIG.CAMERA_OFFSET_Z);
    camera.lookAt(0, GAME_CONFIG.CAMERA_LOOK_AHEAD * 0.3, z + GAME_CONFIG.CAMERA_LOOK_AHEAD);
    renderer.render(scene, camera);
  };
  paints.push(paint);
  fit();
  paint();
  window.addEventListener('resize', () => {
    fit();
    paint();
  });
}

function addPath(scene: Scene, look: WorldLook): void {
  const geo = new BoxGeometry(GAME_CONFIG.PLATFORM_WIDTH, GAME_CONFIG.PLATFORM_HEIGHT, GAME_CONFIG.PLATFORM_DEPTH);
  for (let i = 0; i < 4; i++) {
    const top = look.platformFaces[i % look.platformFaces.length];
    const tile = new Mesh(geo, MaterialFactory.createFlatMaterial(top));
    tile.position.set(0, 0, i * GAME_CONFIG.PLATFORM_SPACING_Z);
    const edge = new Mesh(
      geo,
      new MeshBasicMaterial({ color: look.platformEdge, side: BackSide })
    );
    edge.scale.set(1.045, 1.06, 1.045);
    tile.add(edge);
    scene.add(tile);
  }
}

function mountClose(parent: HTMLElement): void {
  const cell = document.createElement('div');
  cell.className = 'cell desk';
  const caption = document.createElement('span');
  caption.textContent = 'Close';
  cell.appendChild(caption);
  parent.appendChild(cell);

  const look = getWorldLook('sunrise');
  const scene = new Scene();
  scene.background = new Color(look.skyBottom);
  scene.add(new AmbientLight(look.ambient.color, look.ambient.intensity));
  const sun = new DirectionalLight(look.directional.color, look.directional.intensity);
  const pos = look.directionalPos ?? [3, 10, 8];
  sun.position.set(pos[0], pos[1], pos[2]);
  scene.add(sun);
  const ball = new BallEntity(scene);
  ball.applySkinMaterial(ballSkinMaterial(active.id));
  balls.push(ball);
  closeBall = ball;

  const camera = new PerspectiveCamera(32, 1, 0.05, 20);
  const renderer = new WebGLRenderer({ antialias: true });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.setPixelRatio(2);
  cell.appendChild(renderer.domElement);

  let lastW = 0;
  let lastH = 0;
  const paint = (): void => {
    const width = cell.clientWidth || 480;
    const height = cell.clientHeight || 270;
    if (width !== lastW || height !== lastH) {
      lastW = width;
      lastH = height;
      camera.aspect = width / height;
      const frame = ballPhotoCamera(8);
      camera.fov = (2 * Math.atan(0.62 / 8) * 180) / Math.PI;
      camera.up.set(frame.up.x, frame.up.y, frame.up.z);
      camera.position.set(frame.position.x, frame.position.y, frame.position.z);
      camera.lookAt(frame.look.x, frame.look.y, frame.look.z);
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    }
    renderer.render(scene, camera);
  };
  paints.push(paint);
  paint();
}

void start();

async function start(): Promise<void> {
  await preloadBallSkins();
  if (frameOnly || sheet) {
    document.body.style.background = '#fff';
    for (const id of ['prev', 'skin', 'next']) {
      document.getElementById(id)!.style.display = 'none';
    }
    if (sheet) document.getElementById('title')!.style.display = 'none';
    if (sheet) mountSheet();
    else mountFrame();
    return;
  }
  mount(row, 'Sunrise', 'desk', 'sunrise');
  mount(row, 'Dusk', 'desk', 'dusk');
  mount(row, 'Deep Void', 'desk', 'void');
  mount(phoneRow, 'Phone · Sunrise', 'phone', 'sunrise');
  mountClose(phoneRow);
  mountSwitcher();
  playHops();
}

function mountSwitcher(): void {
  const select = document.getElementById('skin') as HTMLSelectElement;
  const prev = document.getElementById('prev') as HTMLButtonElement;
  const next = document.getElementById('next') as HTMLButtonElement;
  for (const entry of PAINTED_BALLS) {
    const option = document.createElement('option');
    option.value = entry.id;
    option.textContent = entry.name;
    select.appendChild(option);
  }
  select.value = active.id;

  const show = (id: string): void => {
    const nextSkin = paintedBall(id);
    if (!nextSkin || nextSkin.id === active.id) return;
    active = nextSkin;
    title.textContent = active.name;
    select.value = active.id;
    const url = new URL(location.href);
    url.searchParams.set('skin', active.id);
    history.replaceState(null, '', url);
    const material = ballSkinMaterial(active.id);
    for (const ball of balls) ball.applySkinMaterial(material);
    for (const paint of paints) paint();
  };

  select.addEventListener('change', () => show(select.value));
  prev.addEventListener('click', () => show(step(-1)));
  next.addEventListener('click', () => show(step(1)));
  window.addEventListener('keydown', (event) => {
    if (event.target === select) return;
    if (event.key === 'ArrowLeft') show(step(-1));
    if (event.key === 'ArrowRight') show(step(1));
  });
}

function step(dir: number): string {
  const index = PAINTED_BALLS.findIndex((entry) => entry.id === active.id);
  const nextIndex = (index + dir + PAINTED_BALLS.length) % PAINTED_BALLS.length;
  return PAINTED_BALLS[nextIndex].id;
}

const REST_Y = GAME_CONFIG.PLATFORM_HEIGHT / 2 + GAME_CONFIG.BALL_RADIUS;

/** The same hop as a run, looping between two tiles, plus a roll so the wrap can be seen. */
function playHops(): void {
  for (const ball of hoppers) loopHop(ball, true);
  if (closeBall) loopClose(closeBall);
  let then = performance.now();
  const tick = (now: number): void => {
    const dt = Math.min(0.05, (now - then) / 1000);
    then = now;
    for (const ball of hoppers) rollWithTravel(ball);
    if (closeBall) {
      const angle = closeBall.mesh.rotation.x + dt * 1.1;
      closeBall.mesh.rotation.x = angle;
      closeBall.outlineMesh.rotation.x = angle;
    }
    for (const paint of paints) paint();
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function rollWithTravel(ball: BallEntity): void {
  const z = ball.group.position.z;
  const prev = lastHopZ.get(ball) ?? z;
  // A partial roll, so the picture stays readable while it turns.
  const angle = ball.mesh.rotation.x + ((z - prev) / GAME_CONFIG.BALL_RADIUS) * 0.18;
  ball.mesh.rotation.x = angle;
  ball.outlineMesh.rotation.x = angle;
  lastHopZ.set(ball, z);
}

function loopHop(ball: BallEntity, forward: boolean): void {
  const startZ = ball.group.position.z;
  const endZ = forward ? GAME_CONFIG.PLATFORM_SPACING_Z : 0;
  ball.performJump(
    {
      startZ,
      endZ,
      startY: REST_Y,
      endY: REST_Y,
      bounceHeight: GAME_CONFIG.BOUNCE_HEIGHT,
      duration: GAME_CONFIG.JUMP_DURATION_BASE
    },
    () => loopHop(ball, !forward)
  );
}

function loopClose(ball: BallEntity): void {
  ball.performJump(
    {
      startZ: 0,
      endZ: 0,
      startY: REST_Y,
      endY: REST_Y,
      bounceHeight: 0.45,
      duration: 0.7
    },
    () => loopClose(ball)
  );
}

function mountSheet(): void {
  const cell = document.createElement('div');
  cell.id = 'shot';
  cell.className = 'cell';
  cell.style.width = '420px';
  cell.style.height = '420px';
  document.body.appendChild(cell);
  const scene = new Scene();
  scene.background = new Color(0xffffff);
  const ball = new BallEntity(scene);
  const camera = new PerspectiveCamera(8, 1, 0.05, 30);
  const renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.setPixelRatio(1);
  cell.appendChild(renderer.domElement);
  camera.aspect = 1;
  const frame = ballPhotoCamera(8);
  camera.fov = (2 * Math.atan(0.55 / 8) * 180) / Math.PI;
  camera.up.set(frame.up.x, frame.up.y, frame.up.z);
  camera.position.set(frame.position.x, frame.position.y, frame.position.z);
  camera.lookAt(frame.look.x, frame.look.y, frame.look.z);
  camera.updateProjectionMatrix();
  renderer.setSize(420, 420, false);
  const shot = (id: string, degrees: number): void => {
    ball.applySkinMaterial(ballSkinMaterial(id));
    const angle = (degrees * Math.PI) / 180;
    ball.mesh.rotation.x = angle;
    ball.outlineMesh.rotation.x = angle;
    renderer.render(scene, camera);
  };
  const hop = window as unknown as {
    hopShot: (id: string, degrees: number) => void;
    hopSkins: string[];
  };
  hop.hopShot = shot;
  hop.hopSkins = PAINTED_BALLS.map((entry) => entry.id);
  shot(PAINTED_BALLS[0].id, 0);
}

function mountFrame(): void {
  const cell = document.createElement('div');
  cell.className = 'cell desk';
  cell.style.width = '720px';
  cell.style.height = '720px';
  phoneRow.appendChild(cell);
  const scene = new Scene();
  scene.background = new Color(0xffffff);
  const ball = new BallEntity(scene);
  ball.applySkinMaterial(ballSkinMaterial(active.id));
  const camera = new PerspectiveCamera(8, 1, 0.05, 30);
  const renderer = new WebGLRenderer({ antialias: true });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.setPixelRatio(1);
  cell.appendChild(renderer.domElement);
  const width = 720;
  const height = 720;
  camera.aspect = 1;
  const frame = ballPhotoCamera(8);
  camera.fov = (2 * Math.atan(0.52 / 8) * 180) / Math.PI;
  camera.up.set(frame.up.x, frame.up.y, frame.up.z);
  camera.position.set(frame.position.x, frame.position.y, frame.position.z);
  camera.lookAt(frame.look.x, frame.look.y, frame.look.z);
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
  renderer.render(scene, camera);
}
