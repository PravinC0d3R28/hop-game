// DEV-ONLY crystal structure editor.
//
// Two deliberately separate modes, because trying to author a formation while
// the cloud deck and tile path are in frame is genuinely hard work:
//
//   AUTHOR  — the structure alone on a neutral ground plane, with a free 360°
//             orbit camera. Nothing else on screen, so rotation, proportion and
//             spacing are easy to judge. This is where you build.
//   PREVIEW — the locked gameplay camera, the real cloud deck and the real
//             tiles, at the real spawn distance. This is only for confirming a
//             finished piece, and it is deliberately not a place to edit.
//
// A formation is plain data, so what you author is what the game replays — no
// re-generating, nothing approximating. `emitStructure` builds the exact same
// mesh in both modes and in the game.
import {
  AxesHelper,
  BoxGeometry,
  Color,
  DoubleSide,
  Fog,
  GridHelper,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer
} from 'three';
import { bakeCluster, emitStructure, emptyAcc } from '../systems/CrystalFactory';
import { buildCloudSea } from '../systems/CloudFactory';
import { CRYSTAL_STRUCTURES, SUNRISE_CRYSTAL_PALETTE } from '../config/CrystalStructures';
import type { CrystalNode, CrystalStructure } from '../config/CrystalStructures';
import { GAME_CONFIG } from '../config/GameConfig';

type Mode = 'author' | 'preview';

/** Gameplay framing, mirrored from RendererSystem so the preview is honest. */
const FOV = 55;
const CAM_Y = GAME_CONFIG.CAMERA_OFFSET_Y;
const CAM_Z = GAME_CONFIG.CAMERA_OFFSET_Z;
const LOOK_AHEAD = GAME_CONFIG.CAMERA_LOOK_AHEAD;
const FOG_NEAR = 28;
const FOG_FAR = 82;
const SKY = 0xfff0dc;
/** Authoring backdrop — neutral, so it never competes with the colours. */
const AUTHOR_BG = 0xe8e2da;

/** Matches the shipped Sunrise deck, so the preview shows the real cloud line. */
const DECK = { length: 70, spread: 64, top: -5.6, depth: 2.8, cols: 64, rows: 40, cell: 3 };
const DECK_PALETTE = { base: 0xfffaf0, highlight: 0xffffff, shadow: 0xefb193 };
/** Where a formation's base sits relative to the tiles in game. */
const BASE_Y = -3.5;
/** The game never spawns in the corridor — clusters stand off to one side. */
const PREVIEW_X = 13;
const PREVIEW_Z = 22;

const el = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

// ---------------------------------------------------------------- scene
const view = el<HTMLDivElement>('view');
const scene = new Scene();
scene.background = new Color(AUTHOR_BG);
const camera = new PerspectiveCamera(FOV, 1, 0.1, 400);

const renderer = new WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
view.appendChild(renderer.domElement);

// Preview-only scenery. Hidden entirely while authoring.
const cloudMesh = new Mesh(
  buildCloudSea({ ...DECK, palette: DECK_PALETTE, seed: 4 }),
  new MeshBasicMaterial({ vertexColors: true, side: DoubleSide })
);
cloudMesh.position.z = -18;
scene.add(cloudMesh);

const tileGeo = new BoxGeometry(2.2, 0.8, 2.2);
const tileMat = new MeshBasicMaterial({ color: 0xfff5d8 });
const tiles = new Group();
for (let i = -1; i <= 8; i++) {
  const t = new Mesh(tileGeo, tileMat);
  t.position.set(0, 0, i * 3.2);
  tiles.add(t);
}
scene.add(tiles);

// Authoring aids: a ground plane at the formation's base and world axes, so
// 360° rotation and "is it standing up?" are readable at a glance.
const grid = new GridHelper(24, 24, 0x8d7f70, 0xb8aa9a);
grid.position.y = 0;
scene.add(grid);
const axes = new AxesHelper(6);
scene.add(axes);

const crystalGroup = new Group();
scene.add(crystalGroup);

// ---------------------------------------------------------------- state
const MAX = 10;
let structures: CrystalStructure[] = JSON.parse(JSON.stringify(CRYSTAL_STRUCTURES)) as CrystalStructure[];
let index = 0;
let selected = 0;
let mode: Mode = 'author';
let dirty = false;

/** Free orbit used only in author mode. */
const orbit = { az: 0.7, pol: 1.15, dist: 26, auto: false };

const ui = {
  preset: el<HTMLSelectElement>('preset'),
  name: el<HTMLInputElement>('sname'),
  chips: el<HTMLDivElement>('chips'),
  swatches: el<HTMLDivElement>('swatches'),
  authorBtn: el<HTMLButtonElement>('modeAuthor'),
  previewBtn: el<HTMLButtonElement>('modePreview'),
  authorBox: el<HTMLDivElement>('authorBox'),
  previewBox: el<HTMLDivElement>('previewBox'),
  clouds: el<HTMLInputElement>('clouds'),
  tiles: el<HTMLInputElement>('tiles'),
  sideL: el<HTMLInputElement>('sideL'),
  fit: el<HTMLButtonElement>('fit'),
  spin: el<HTMLInputElement>('spin'),
  out: el<HTMLTextAreaElement>('out')
};

const sliders = {
  width: el<HTMLInputElement>('width'), height: el<HTMLInputElement>('height'),
  taper: el<HTMLInputElement>('taper'), sides: el<HTMLInputElement>('sides'),
  rx: el<HTMLInputElement>('rx'), ry: el<HTMLInputElement>('ry'), rz: el<HTMLInputElement>('rz'),
  px: el<HTMLInputElement>('px'), py: el<HTMLInputElement>('py'), pz: el<HTMLInputElement>('pz')
};

const current = (): CrystalStructure => structures[index];
const node = (): CrystalNode | undefined => current().crystals[selected];

// ---------------------------------------------------------------- build
function rebuild(fit = false): void {
  crystalGroup.clear();
  const acc = emptyAcc();
  // In author mode the formation sits on the origin's ground plane with its
  // base at y=0, so the position sliders mean what you'd expect. In preview it
  // takes the exact transform the game applies.
  const placing = mode === 'author'
    ? { x: 0, z: 0, baseY: 0, scale: 1, families: [...SUNRISE_CRYSTAL_PALETTE] as never }
    : {
      x: ui.sideL.checked ? -PREVIEW_X : PREVIEW_X,
      z: PREVIEW_Z,
      baseY: BASE_Y,
      scale: 1,
      families: [...SUNRISE_CRYSTAL_PALETTE] as never
    };
  emitStructure(acc, current(), placing);
  const { face } = bakeCluster(acc);
  const mesh = new Mesh(face, new MeshBasicMaterial({ vertexColors: true, side: DoubleSide }));
  crystalGroup.add(mesh);
  if (fit) fitToStructure();
}

/** Frame the formation so it always fills a sensible part of the view. */
function fitToStructure(): void {
  const mesh = crystalGroup.children[0] as Mesh | undefined;
  if (!mesh) return;
  mesh.geometry.computeBoundingBox();
  const b = mesh.geometry.boundingBox;
  if (!b) return;
  const centre = new Vector3();
  b.getCenter(centre);
  const size = new Vector3();
  b.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z, 1);
  const target = new Vector3(centre.x, Math.max(centre.y, size.y * 0.25), centre.z);
  orbitTarget.copy(target);
  orbit.dist = Math.max(7, maxDim * 2.3);
}

// ---------------------------------------------------------------- modes
function setMode(next: Mode): void {
  mode = next;
  const author = mode === 'author';
  ui.authorBtn.setAttribute('aria-pressed', String(author));
  ui.previewBtn.setAttribute('aria-pressed', String(!author));
  ui.authorBox.hidden = !author;
  ui.previewBox.hidden = author;
  cloudMesh.visible = !author && ui.clouds.checked;
  tiles.visible = !author && ui.tiles.checked;
  grid.visible = author;
  axes.visible = author;
  scene.background = new Color(author ? AUTHOR_BG : SKY);
  scene.fog = author ? null : new Fog(SKY, FOG_NEAR, FOG_FAR);
  el<HTMLDivElement>('hint').textContent = author
    ? 'Drag to orbit · wheel to zoom · the formation sits on the grid at y=0'
    : 'Locked gameplay camera, real clouds and tiles. Confirm-only — go back to author to edit.';
  rebuild(mode === 'author');
}

ui.authorBtn.addEventListener('click', () => setMode('author'));
ui.previewBtn.addEventListener('click', () => setMode('preview'));
ui.clouds.addEventListener('change', () => { cloudMesh.visible = mode === 'preview' && ui.clouds.checked; });
ui.tiles.addEventListener('change', () => { tiles.visible = mode === 'preview' && ui.tiles.checked; });
ui.sideL.addEventListener('change', () => rebuild());
ui.spin.addEventListener('change', () => { orbit.auto = ui.spin.checked; });
ui.fit.addEventListener('click', () => fitToStructure());

// ---------------------------------------------------------------- orbit input
let dragging = false;
let lastX = 0;
let lastY = 0;
const orbitTarget = new Vector3(0, 4, 0);

renderer.domElement.addEventListener('pointerdown', (e) => {
  if (mode !== 'author') return;
  dragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
  renderer.domElement.setPointerCapture(e.pointerId);
});
renderer.domElement.addEventListener('pointermove', (e) => {
  if (!dragging || mode !== 'author') return;
  orbit.az -= (e.clientX - lastX) * 0.006;
  orbit.pol = Math.max(0.08, Math.min(Math.PI - 0.08, orbit.pol - (e.clientY - lastY) * 0.006));
  lastX = e.clientX;
  lastY = e.clientY;
});
const endDrag = (): void => { dragging = false; };
renderer.domElement.addEventListener('pointerup', endDrag);
renderer.domElement.addEventListener('pointercancel', endDrag);
renderer.domElement.addEventListener('wheel', (e) => {
  if (mode !== 'author') return;
  e.preventDefault();
  orbit.dist = Math.max(6, Math.min(120, orbit.dist * (1 + e.deltaY * 0.001)));
}, { passive: false });

for (const [id, az, pol] of [
  ['viewFront', 0, Math.PI / 2],
  ['viewSide', Math.PI / 2, Math.PI / 2],
  ['viewTop', 0, 0.12],
  ['viewIso', 0.7, 1.15]
] as const) {
  el<HTMLButtonElement>(id).addEventListener('click', () => {
    orbit.az = az;
    orbit.pol = pol;
    fitToStructure();
  });
}

// ---------------------------------------------------------------- panel
const paletteCss = (i: number): string =>
  `#${SUNRISE_CRYSTAL_PALETTE[i].base.toString(16).padStart(6, '0')}`;

function renderPresets(): void {
  ui.preset.innerHTML = '';
  structures.forEach((s, i) => {
    const o = document.createElement('option');
    o.value = String(i);
    o.textContent = `${i + 1}. ${s.name} (${s.crystals.length})`;
    ui.preset.appendChild(o);
  });
  ui.preset.value = String(index);
  ui.name.value = current().name;
}

function renderChips(): void {
  ui.chips.innerHTML = '';
  current().crystals.forEach((c, i) => {
    const b = document.createElement('button');
    b.className = 'chip';
    b.setAttribute('aria-pressed', String(i === selected));
    b.innerHTML = `<span class="dot" style="background:${paletteCss(c.color)}"></span>${i + 1}`;
    b.addEventListener('click', () => { selected = i; syncInputs(); renderChips(); });
    ui.chips.appendChild(b);
  });
}

function renderSwatches(): void {
  ui.swatches.innerHTML = '';
  SUNRISE_CRYSTAL_PALETTE.forEach((_p, i) => {
    const b = document.createElement('button');
    b.className = 'sw';
    b.style.background = paletteCss(i);
    b.title = `palette colour ${i + 1}`;
    b.setAttribute('aria-pressed', String(node()?.color === i));
    b.addEventListener('click', () => {
      const n = node();
      if (!n) return;
      n.color = i;
      dirty = true;
      renderSwatches(); renderChips(); rebuild();
    });
    ui.swatches.appendChild(b);
  });
}

const deg = (r: number): number => Math.round((r * 180) / Math.PI);
const out = (key: string): HTMLElement => el(`${key}Out`);

function syncInputs(): void {
  const n = node();
  if (!n) return;
  sliders.width.value = String(n.width); out('width').textContent = n.width.toFixed(2);
  sliders.height.value = String(n.height); out('height').textContent = n.height.toFixed(1);
  sliders.taper.value = String(n.taper); out('taper').textContent = n.taper.toFixed(2);
  sliders.sides.value = String(n.sides); out('sides').textContent = String(n.sides);
  sliders.rx.value = String(deg(n.rx)); out('rx').textContent = `${deg(n.rx)}°`;
  sliders.ry.value = String(deg(n.ry)); out('ry').textContent = `${deg(n.ry)}°`;
  sliders.rz.value = String(deg(n.rz)); out('rz').textContent = `${deg(n.rz)}°`;
  sliders.px.value = String(n.x); out('px').textContent = n.x.toFixed(1);
  sliders.py.value = String(n.y); out('py').textContent = n.y.toFixed(1);
  sliders.pz.value = String(n.z); out('pz').textContent = n.z.toFixed(1);
  renderSwatches();
}

const HANDLERS: Record<string, (n: CrystalNode, raw: number) => void> = {
  width: (n, v) => { n.width = v; },
  height: (n, v) => { n.height = v; },
  taper: (n, v) => { n.taper = v; },
  sides: (n, v) => { n.sides = Math.round(v); },
  rx: (n, v) => { n.rx = (v * Math.PI) / 180; },
  ry: (n, v) => { n.ry = (v * Math.PI) / 180; },
  rz: (n, v) => { n.rz = (v * Math.PI) / 180; },
  px: (n, v) => { n.x = v; },
  py: (n, v) => { n.y = v; },
  pz: (n, v) => { n.z = v; }
};

function touch(fit = false): void {
  dirty = true;
  // Keep the declared height honest — the game scales formations by it.
  const tallest = Math.max(...current().crystals.map((c) => c.height));
  current().height = Math.max(1, Math.round(tallest));
  renderChips();
  syncInputs();
  rebuild(fit);
}

for (const [key, input] of Object.entries(sliders)) {
  input.addEventListener('input', () => {
    const n = node();
    if (!n) return;
    HANDLERS[key](n, Number(input.value));
    touch(false);
  });
}

function addCrystal(): void {
  const s = current();
  if (s.crystals.length >= MAX) return;
  s.crystals.push({
    x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0,
    width: 1.1, height: 6, taper: 0.5, sides: 6,
    color: s.crystals.length % SUNRISE_CRYSTAL_PALETTE.length
  });
  selected = s.crystals.length - 1;
  touch(true);
  renderPresets();
}
el<HTMLButtonElement>('add').addEventListener('click', addCrystal);

el<HTMLButtonElement>('dup').addEventListener('click', () => {
  const s = current();
  if (s.crystals.length >= MAX) return;
  const src = s.crystals[selected];
  s.crystals.push({ ...src, x: src.x + 1.2, z: src.z + 0.8 });
  selected = s.crystals.length - 1;
  touch(true);
});

el<HTMLButtonElement>('del').addEventListener('click', () => {
  const s = current();
  if (s.crystals.length <= 1) return;
  s.crystals.splice(selected, 1);
  selected = Math.max(0, selected - 1);
  touch(true);
});

/** Drop the formation so its lowest base sits exactly on the ground plane. */
el<HTMLButtonElement>('focus').addEventListener('click', () => {
  const s = current();
  const shift = -Math.min(...s.crystals.map((c) => c.y));
  for (const c of s.crystals) c.y += shift;
  touch(true);
});

ui.preset.addEventListener('change', () => {
  index = Number(ui.preset.value);
  selected = 0;
  ui.name.value = current().name;
  renderChips(); syncInputs(); rebuild(true);
});
ui.name.addEventListener('input', () => { current().name = ui.name.value; dirty = true; renderPresets(); });

// ---------------------------------------------------------------- export
function toTypeScript(): string {
  const body = structures.map((s) => {
    const crystals = s.crystals.map((c) =>
      `      n(${c.x.toFixed(2)}, ${c.y.toFixed(2)}, ${c.z.toFixed(2)}, ${c.height.toFixed(2)}, ${c.width.toFixed(2)}, ${c.color}, ` +
      `{ ry: ${c.ry.toFixed(3)}, rx: ${c.rx.toFixed(3)}, rz: ${c.rz.toFixed(3)}, taper: ${c.taper.toFixed(2)}, sides: ${c.sides} })`
    ).join(',\n');
    return `  {\n    id: '${s.id}',\n    name: '${s.name}',\n    height: ${s.height},\n    crystals: [\n${crystals}\n    ]\n  }`;
  }).join(',\n');
  return `export const CRYSTAL_STRUCTURES: CrystalStructure[] = [\n${body}\n];`;
}

el<HTMLButtonElement>('export').addEventListener('click', () => {
  ui.out.value = toTypeScript();
  ui.out.select();
  void navigator.clipboard?.writeText(ui.out.value);
});
el<HTMLButtonElement>('copyJson').addEventListener('click', () => {
  ui.out.value = JSON.stringify(structures, null, 2);
  ui.out.select();
  void navigator.clipboard?.writeText(ui.out.value);
});
el<HTMLButtonElement>('download').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(structures, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'crystal-structures.json';
  a.click();
  URL.revokeObjectURL(a.href);
});

// ---------------------------------------------------------------- boot
function resize(): void {
  const w = view.clientWidth;
  const h = view.clientHeight;
  if (w === 0 || h === 0) return;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}
addEventListener('resize', resize);

renderPresets();
renderChips();
syncInputs();
resize();
setMode('author');
renderChips();
syncInputs();

function tick(): void {
  requestAnimationFrame(tick);
  if (mode === 'author') {
    if (orbit.auto && !dragging) orbit.az += 0.006;
    const sp = Math.sin(orbit.pol);
    camera.position.set(
      orbitTarget.x + orbit.dist * sp * Math.sin(orbit.az),
      orbitTarget.y + orbit.dist * Math.cos(orbit.pol),
      orbitTarget.z + orbit.dist * sp * Math.cos(orbit.az)
    );
    camera.lookAt(orbitTarget);
  } else {
    camera.position.set(0, CAM_Y, CAM_Z);
    camera.lookAt(0, 0, LOOK_AHEAD);
  }
  renderer.render(scene, camera);
}
requestAnimationFrame(tick);

(window as unknown as { editor: unknown }).editor = {
  structures,
  mode: () => mode,
  setMode,
  select: (i: number) => { index = i; selected = 0; renderPresets(); renderChips(); syncInputs(); rebuild(true); },
  set: (path: string, value: number) => {
    const [si, ci, key] = path.split(':');
    const n = structures[Number(si)].crystals[Number(ci)];
    if (!n) return;
    HANDLERS[key](n, value);
    touch(false);
  },
  add: addCrystal,
  get dirty() { return dirty; }
};
