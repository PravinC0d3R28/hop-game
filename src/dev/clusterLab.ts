// DEV-ONLY cluster lab — one cluster at a time, per the owner's workflow:
// build a single cluster, match it against the concept, then make variations,
// then place them randomly in the game.
//
// It renders ONE cluster centred in frame, with the tile plane and the cloud
// deck for scale reference, and an orbit toggle so the 3D spread is visible
// from every angle (the "all crystals in the same spot" complaint was a flat
// placement — this is how you catch that).
//
// Not in the production build (Vite only bundles index.html).
import {
  BackSide,
  BoxGeometry,
  Color,
  DoubleSide,
  Fog,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  WebGLRenderer
} from 'three';
import { bakeCluster, CLUSTER_SHAPES, emitCluster, emptyAcc, makeRng, type ClusterShape, type CrystalFamily } from '../systems/CrystalFactory';
import { buildCloudSea } from '../systems/CloudFactory';

const FAMILIES: CrystalFamily[] = [
  { base: 0xf2545f, light: 0xff7d70, shade: 0xc4374c, cream: 0xffa892 },
  { base: 0xff9a4d, light: 0xffb96a, shade: 0xdb7530, cream: 0xffd79a },
  { base: 0x5fcf9a, light: 0x8ce0b8, shade: 0x35a97c, cream: 0xbdeecf },
  { base: 0x2fb8d4, light: 0x63d2e6, shade: 0x1a8fa8, cream: 0x9fe4f0 },
  { base: 0xf5c531, light: 0xffd964, shade: 0xc99a1c, cream: 0xffeeb0 }
];

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const scene = new Scene();
const camera = new PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 400);
const renderer = new WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.prepend(renderer.domElement);
scene.background = new Color(0xf7e3c4);
// Match the shipped Sunrise fog so the lab shows what the game actually
// renders — a lab-only fog was bleaching every crystal to pale cream.
const GAME_FOG = new Fog(0xf8dfd6, 28, 82);
scene.fog = GAME_FOG;

const ui = {
  shape: el<HTMLSelectElement>('shape'),
  outline: el<HTMLInputElement>('outline'),
  clouds: el<HTMLInputElement>('clouds'),
  tiles: el<HTMLInputElement>('tiles'),
  spin: el<HTMLInputElement>('spin'),
  auto: el<HTMLInputElement>('auto'),
  seed: el<HTMLInputElement>('seed'),
  weight: el<HTMLInputElement>('weight'),
  shuffle: el<HTMLButtonElement>('shuffle'),
  gallery: el<HTMLInputElement>('gallery'),
  stats: el<HTMLSpanElement>('stats')
};
for (const s of CLUSTER_SHAPES) {
  const o = document.createElement('option');
  o.value = s;
  o.textContent = s;
  ui.shape.appendChild(o);
}
ui.shape.value = 'cluster';

// Reference: the tile plane the player runs on, and the cloud deck the
// crystals rise out of.
const tileGeo = new BoxGeometry(2.2, 0.8, 2.2);
const tileMat = new MeshBasicMaterial({ color: 0xfff5d8 });
const tiles = new Group();
for (let i = -2; i <= 2; i++) {
  const t = new Mesh(tileGeo, tileMat);
  t.position.set(0, 0, i * 3.5);
  tiles.add(t);
}
scene.add(tiles);

const cloudMesh = new Mesh(
  buildCloudSea({
    length: 80, spread: 32, top: -2.2, depth: 1.8, cols: 60, rows: 50, cell: 3,
    palette: { base: 0xfff7e8, highlight: 0xfffbef, shadow: 0xf0cdb4 }, seed: 4
  }),
  new MeshBasicMaterial({ vertexColors: true, side: DoubleSide })
);
cloudMesh.position.z = -10;
scene.add(cloudMesh);

let group: Group | null = null;
let shown = '';

function build(): void {
  const seed = Number(ui.seed.value);
  const weight = Number(ui.weight.value) / 100;
  if (group) {
    scene.remove(group);
    group.traverse((c) => {
      const m = c as Mesh;
      if (m.isMesh) (m.material as { dispose?: () => void }).dispose?.();
    });
  }
  const acc = emptyAcc();
  // Gallery mode: every variant side by side, same seed and weight, so the
  // shapes can be compared directly against each other and the concept.
  if (ui.gallery.checked) {
    CLUSTER_SHAPES.forEach((shape, i) => {
      emitCluster(acc, {
        x: (i - (CLUSTER_SHAPES.length - 1) / 2) * 26,
        z: 0,
        weight,
        shape,
        families: FAMILIES,
        baseY: -4.2
      }, makeRng(seed * 7919));
    });
    shown = `gallery · ${CLUSTER_SHAPES.join(' / ')} · seed ${seed}`;
  } else {
    emitCluster(acc, {
      x: 0,
      z: 0,
      weight,
      shape: ui.shape.value as ClusterShape,
      families: FAMILIES,
      baseY: -4.2
    }, makeRng(seed * 7919));
    shown = `${ui.shape.value} · seed ${seed} · w ${weight.toFixed(2)}`;
  }
  const { face, shell } = bakeCluster(acc);
  const g = new Group();
  const shellMesh = new Mesh(shell, new MeshBasicMaterial({ color: 0x3b302d, side: BackSide, depthWrite: false }));
  shellMesh.renderOrder = 1;
  const faceMesh = new Mesh(face, new MeshBasicMaterial({ vertexColors: true, side: DoubleSide }));
  faceMesh.renderOrder = 2;
  shellMesh.visible = ui.outline.checked;
  g.add(shellMesh, faceMesh);
  group = g;
  scene.add(g);
  ui.stats.textContent = ` | ${face.getAttribute('position').count / 3} tris`;
}

function apply(): void {
  if (!group) return;
  const [shellMesh, faceMesh] = group.children as Mesh[];
  shellMesh.visible = ui.outline.checked;
  cloudMesh.visible = ui.clouds.checked;
  tiles.visible = ui.tiles.checked;
  void faceMesh;
}

function rebuild(next: number): void {
  ui.seed.value = String(((next - 1) % 60) + 1);
  build();
  apply();
}
ui.shuffle.addEventListener('click', () => rebuild(Math.floor(Math.random() * 60) + 1));
for (const n of [ui.outline, ui.clouds, ui.tiles]) n.addEventListener('change', apply);
ui.gallery.addEventListener('change', () => { build(); apply(); });
ui.spin.addEventListener('change', () => void 0);
ui.shape.addEventListener('change', () => { build(); apply(); });
ui.seed.addEventListener('input', () => { build(); apply(); });
ui.weight.addEventListener('input', () => { build(); apply(); });
window.setInterval(() => {
  // Auto-randomize only reseeds; it must not fight the shape/gallery choice.
  if (ui.auto.checked) rebuild(Math.floor(Math.random() * 60) + 1);
}, 3500);

build();
apply();

function frame(): void {
  // Frame the cluster itself: bases sit below the tile plane and the spire
  // tops out a few units above it, so pull back far enough to see the whole
  // clump plus the deck it rises out of.
  if (ui.gallery.checked) {
    // The gallery sits far back, well past fogFar — comparing shapes through
    // the game's fog would bleach them all to the same colour. Single-cluster
    // view keeps the real fog, so that is the one to judge fidelity in.
    scene.fog = null;
    camera.position.set(0, 9, 78);
    camera.lookAt(0, 0, 0);
  } else {
    scene.fog = GAME_FOG;
    if (ui.spin.checked) {
      const t = performance.now() * 0.00018;
      const r = 34;
      camera.position.set(Math.sin(t) * r, 9 + Math.sin(t * 1.7) * 4, Math.cos(t) * r);
      camera.lookAt(0, 1.5, 0);
    } else {
      // Approximate the game's own eye level: the deck is below us and the
      // crystals tower above it, which is the composition being judged.
      camera.position.set(14, 6.5, 21);
      camera.lookAt(0, 1.5, 0);
    }
  }
}
function tick(): void {
  requestAnimationFrame(tick);
  frame();
  renderer.render(scene, camera);
}
requestAnimationFrame(tick);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

(window as unknown as { lab: unknown }).lab = {
  get shown() { return shown; },
  shapes: CLUSTER_SHAPES,
  camera,
  scene
};




