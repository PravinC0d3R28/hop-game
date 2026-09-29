// DEV-ONLY crystal lab. Not part of the production build (Vite only bundles
// index.html). Lets the crystal look be tuned in isolation — outline width,
// facet tone, cluster colour mixing, halftone on/off — before it goes near
// the game, per the owner's request.
//
// Open http://localhost:3000/crystal-lab.html
import {
  AmbientLight,
  BackSide,
  BoxGeometry,
  Color,
  DirectionalLight,
  Fog,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer
} from 'three';
import { MaterialFactory } from '../systems/MaterialFactory';
import {
  bakeSegment,
  emptyAcc,
  emitFormation,
  makeRng,
  OUTLINE_FACTOR,
  type CrystalFamily
} from '../systems/CrystalFactory';

const FAMILIES: CrystalFamily[] = [
  { base: 0xff6f70, light: 0xff927c, shade: 0xe0505a, cream: 0xffb9a4 },
  { base: 0xffb07a, light: 0xffc27e, shade: 0xe08a5c, cream: 0xffe0bd },
  { base: 0x8de3b0, light: 0xb5f0c7, shade: 0x5fc89a, cream: 0xd6f7e2 },
  { base: 0x55cfe6, light: 0x89e8f1, shade: 0x35afc1, cream: 0xc0f2fa },
  { base: 0xffd95a, light: 0xffe9a0, shade: 0xe0b93a, cream: 0xfff4cd }
];

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const scene = new Scene();
const camera = new PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 400);
const renderer = new WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.prepend(renderer.domElement);
MaterialFactory.init();

// Lights must match the game (RendererSystem) — MeshToonMaterial renders
// BLACK with no lights, which is exactly how this lab first looked.
scene.add(new AmbientLight(0xffe8d5, 0.85));
const key = new DirectionalLight(0xffd39a, 1.3);
key.position.set(-4, 9, 13);
scene.add(key);

const ui = {
  outline: el<HTMLInputElement>('outline'),
  dots: el<HTMLInputElement>('dots'),
  fog: el<HTMLInputElement>('fog'),
  tiles: el<HTMLInputElement>('tiles'),
  loop: el<HTMLInputElement>('loop'),
  seed: el<HTMLInputElement>('seed'),
  auto: el<HTMLInputElement>('auto'),
  shuffle: el<HTMLButtonElement>('shuffle'),
  stats: el<HTMLSpanElement>('stats')
};

let seedValue = 7;
function rebuild(next: number): void {
  seedValue = ((next - 1) % 40) + 1;
  ui.seed.value = String(seedValue);
  build(seedValue);
  sceneColor();
}
ui.shuffle.addEventListener('click', () => rebuild(Math.floor(Math.random() * 40) + 1));
ui.seed.addEventListener('input', () => rebuild(Number(ui.seed.value)));
// Auto-randomize: new clusters on a slow cadence so the look can be judged
// across many random arrangements, not one lucky one.
window.setInterval(() => {
  if (ui.auto.checked) rebuild(Math.floor(Math.random() * 40) + 1);
}, 4000);

// Ground reference so we can see whether crystals sit BELOW the tile line.
const tileGeo = new BoxGeometry(2.2, 0.8, 2.2);
const tileMat = new MeshToonMaterial({ color: 0xfff5d8 });
const tiles = new Group();
for (let i = 0; i < 6; i++) {
  const t = new Mesh(tileGeo, tileMat);
  t.position.set(0, 0, -i * 3.5);
  tiles.add(t);
}
scene.add(tiles);

let group: Group | null = null;
let builtSeed = -1;

function build(seed: number): void {
  if (group) {
    scene.remove(group);
    group.traverse((c) => {
      const m = c as Mesh;
      if (m.isMesh) (m.material as { dispose?: () => void }).dispose?.();
    });
  }
  const rnd = makeRng(seed * 7919);
  const acc = emptyAcc();
  // Four clusters flanking the corridor, near ones bigger.
  const spots = [
    { x: -6.5, z: 6, w: 1 },
    { x: 7.0, z: 14, w: 0.75 },
    { x: -7.5, z: 24, w: 0.55 },
    { x: 6.0, z: 34, w: 0.35 }
  ];
  for (const s of spots) {
    emitFormation(acc, { x: s.x, z: s.z, weight: s.w, families: FAMILIES, count: 9, baseY: -1.3 }, rnd);
  }
  const { face, hull } = bakeSegment(acc);
  const g = new Group();
  g.add(new Mesh(face, new MeshBasicMaterial({ vertexColors: true, side: 2 })));
  g.add(new Mesh(hull, new MeshBasicMaterial({ color: 0x3b302d, side: BackSide })));
  group = g;
  scene.add(g);
  builtSeed = seed;
  ui.stats.textContent = ` | ${face.getAttribute('position').count} verts`;
}

function sceneColor(): void {
  scene.background = new Color(0xf7e3c4);
  if (ui.fog.checked) {
    scene.fog = new Fog(0xf7e3c4, 30, 95);
  } else {
    scene.fog = null;
  }
  // Re-apply the material choice (dots on/off) + outline toggle.
  if (group) {
    const [face, hull] = group.children as Mesh[];
    const mat = ui.dots.checked
      ? MaterialFactory.createMaterial(0xffffff, { vertexColors: true, side: 2 })
      : new MeshBasicMaterial({ vertexColors: true, side: 2 });
    (face.material as { dispose?: () => void }).dispose?.();
    face.material = mat;
    hull.visible = ui.outline.checked;
  }
  tiles.visible = ui.tiles.checked;
}

for (const node of [ui.outline, ui.dots, ui.fog, ui.tiles]) {
  node.addEventListener('change', () => sceneColor());
}

build(7);
sceneColor();

let last = performance.now();
function frame(now: number): void {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (ui.loop.checked) {
    // Crystals live at +Z (the game recedes toward +Z), so the lab camera
    // sits behind them and looks the same way the game camera does.
    const sway = Math.sin(now * 0.00022) * 5.5;
    camera.position.set(sway, 6.5 + Math.sin(now * 0.00017) * 1.2, -6 + Math.cos(now * 0.00015) * 6);
    camera.lookAt(0, 0.2, 16);
  }
  renderer.render(scene, camera);
  void dt;
}
requestAnimationFrame(frame);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// Expose for quick console poking in the lab.
(window as unknown as { lab: unknown }).lab = {
  get seed() { return builtSeed; },
  outlineFactor: OUTLINE_FACTOR,
  families: FAMILIES,
  camera, scene, Vector3
};
