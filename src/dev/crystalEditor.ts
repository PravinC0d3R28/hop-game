// DEV-ONLY crystal structure editor.
//
// The owner's workflow: shape ONE formation by hand — pick each crystal's
// colour from the locked palette, set its width/height, rotate it freely in
// 360°, nudge it along x/y/z — watch it in the real gameplay framing, then
// export the numbers so the game replays the exact same piece instead of
// re-generating something that merely resembles it.
//
// Everything is plain data; nothing here is simulated or interpolated. What you
// see in the viewport is what `emitStructure` will build in the game.
//
// The camera is deliberately LOCKED to the gameplay view (same FOV, offset and
// look-ahead as RendererSystem) — the whole point is to judge the formation the
// way a player will see it, and a free orbit would hide exactly the problems
// that matter.
import {
  BoxGeometry,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  Fog,
  WebGLRenderer
} from 'three';
import {
  bakeCluster,
  emitStructure,
  emptyAcc,
  type ClusterShape
} from '../systems/CrystalFactory';
import { buildCloudSea } from '../systems/CloudFactory';
import { CRYSTAL_STRUCTURES, SUNRISE_CRYSTAL_PALETTE } from '../config/CrystalStructures';
import type { CrystalNode, CrystalStructure } from '../config/CrystalStructures';
import { GAME_CONFIG } from '../config/GameConfig';

/** Gameplay framing, mirrored from RendererSystem so the preview is honest. */
const FOV = 55;
const CAM_Y = GAME_CONFIG.CAMERA_OFFSET_Y;
const CAM_Z = GAME_CONFIG.CAMERA_OFFSET_Z;
const LOOK_AHEAD = GAME_CONFIG.CAMERA_LOOK_AHEAD;
const FOG_NEAR = 28;
const FOG_FAR = 82;
const SKY_TOP = 0xf9c9c0;
const SKY_BOTTOM = 0xfff0dc;

/** Matches the shipped Sunrise deck, so the preview shows the real cloud line. */
const DECK = { length: 70, spread: 64, top: -5.6, depth: 2.8, cols: 64, rows: 40, cell: 3 };
const DECK_PALETTE = { base: 0xfffaf0, highlight: 0xffffff, shadow: 0xefb193 };
/** Where a formation's base sits relative to the tiles. */
const BASE_Y = -3.5;
/**
 * The game never spawns a formation in the corridor — clusters stand off to
 * one side, ~9-19 units out. The preview must do the same or it lies: a piece
 * placed dead centre beside the camera reads twice as large as it ever will in
 * play. It also sits AHEAD, at a typical in-run viewing distance, so the
 * framing matches what the player actually sees.
 */
const PREVIEW_X = 13;
const PREVIEW_Z = 22;

const el = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

// ---------------------------------------------------------------- scene
const view = el<HTMLDivElement>('view');
const scene = new Scene();
scene.background = new Color(SKY_BOTTOM);
scene.fog = new Fog(SKY_BOTTOM, FOG_NEAR, FOG_FAR);
const camera = new PerspectiveCamera(FOV, 1, 0.1, 110);
camera.position.set(0, CAM_Y, CAM_Z);
camera.lookAt(0, 0, LOOK_AHEAD);

const renderer = new WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
view.appendChild(renderer.domElement);

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

const grid = new Mesh(
  new BoxGeometry(24, 0.02, 24),
  new MeshBasicMaterial({ color: 0x3b302d, transparent: true, opacity: 0.12 })
);
grid.position.y = -0.45;
scene.add(grid);

const crystalGroup = new Group();
scene.add(crystalGroup);

// ---------------------------------------------------------------- state
const MAX = 10;
let structures: CrystalStructure[] = JSON.parse(JSON.stringify(CRYSTAL_STRUCTURES)) as CrystalStructure[];
let index = 0;
let selected = 0;
let dirty = false;
/** Which side of the corridor the preview formation stands on. */
const side = (): number => (el<HTMLInputElement>('sideL').checked ? -PREVIEW_X : PREVIEW_X);

const ui = {
  preset: el<HTMLSelectElement>('preset'),
  name: el<HTMLInputElement>('sname'),
  chips: el<HTMLDivElement>('chips'),
  swatches: el<HTMLDivElement>('swatches'),
  clouds: el<HTMLInputElement>('clouds'),
  tiles: el<HTMLInputElement>('tiles'),
  grid: el<HTMLInputElement>('grid'),
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

// ---------------------------------------------------------------- viewport
function rebuild(): void {
  crystalGroup.clear();
  const acc = emptyAcc();
  emitStructure(acc, current(), {
    x: side(), z: PREVIEW_Z, baseY: BASE_Y, scale: 1, families: [...SUNRISE_CRYSTAL_PALETTE]
  });
  const { face } = bakeCluster(acc);
  crystalGroup.add(new Mesh(face, new MeshBasicMaterial({ vertexColors: true, side: DoubleSide })));
}

// ---------------------------------------------------------------- panel
function paletteCss(i: number): string {
  const p = SUNRISE_CRYSTAL_PALETTE[i];
  return `#${p.base.toString(16).padStart(6, '0')}`;
}

function renderPresets(): void {
  ui.preset.innerHTML = '';
  structures.forEach((s, i) => {
    const o = document.createElement('option');
    o.value = String(i);
    o.textContent = `${i + 1}. ${s.name}${s === CRYSTAL_STRUCTURES[i] ? '' : ' *'}`;
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
      renderSwatches();
      renderChips();
      rebuild();
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

for (const [key, input] of Object.entries(sliders)) {
  input.addEventListener('input', () => {
    const n = node();
    if (!n) return;
    HANDLERS[key](n, Number(input.value));
    dirty = true;
    syncInputs();
    rebuild();
    // Keep the structure's declared height honest so the game scales it right.
    const tallest = Math.max(...current().crystals.map((c) => c.height));
    current().height = Math.max(1, Math.round(tallest));
  });
}

// ---------------------------------------------------------------- structure ops
function addCrystal(): void {
  const s = current();
  if (s.crystals.length >= MAX) return;
  s.crystals.push({
    x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0,
    width: 1.1, height: 6, taper: 0.5, sides: 6, color: s.crystals.length % SUNRISE_CRYSTAL_PALETTE.length
  });
  selected = s.crystals.length - 1;
  dirty = true;
  renderChips(); syncInputs(); rebuild(); renderPresets();
}
el<HTMLButtonElement>('add').addEventListener('click', addCrystal);

el<HTMLButtonElement>('dup').addEventListener('click', () => {
  const s = current();
  if (s.crystals.length >= MAX) return;
  const src = s.crystals[selected];
  s.crystals.push({ ...src, x: src.x + 1.2, z: src.z + 0.8 });
  selected = s.crystals.length - 1;
  dirty = true;
  renderChips(); syncInputs(); rebuild();
});

el<HTMLButtonElement>('del').addEventListener('click', () => {
  const s = current();
  if (s.crystals.length <= 1) return;
  s.crystals.splice(selected, 1);
  selected = Math.max(0, selected - 1);
  dirty = true;
  renderChips(); syncInputs(); rebuild();
});

/** Drop the formation so its base sits on the tile line: handy after moving things. */
el<HTMLButtonElement>('focus').addEventListener('click', () => {
  const s = current();
  const shift = -Math.min(...s.crystals.map((c) => c.y));
  for (const c of s.crystals) c.y += shift;
  dirty = true;
  syncInputs(); rebuild();
});

ui.preset.addEventListener('change', () => {
  index = Number(ui.preset.value);
  selected = 0;
  ui.name.value = current().name;
  renderChips(); syncInputs(); rebuild();
});
ui.name.addEventListener('input', () => { current().name = ui.name.value; dirty = true; renderPresets(); });

ui.clouds.addEventListener('change', () => { cloudMesh.visible = ui.clouds.checked; });
ui.tiles.addEventListener('change', () => { tiles.visible = ui.tiles.checked; });
ui.grid.addEventListener('change', () => { grid.visible = ui.grid.checked; });
el<HTMLInputElement>('sideL').addEventListener('change', () => rebuild());

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
rebuild();
resize();
grid.visible = ui.grid.checked;

function tick(): void {
  requestAnimationFrame(tick);
  renderer.render(scene, camera);
}
requestAnimationFrame(tick);

(window as unknown as { editor: unknown }).editor = {
  structures,
  select: (i: number) => { index = i; selected = 0; renderPresets(); renderChips(); syncInputs(); rebuild(); },
  set: (path: string, value: number) => {
    const [si, ci, key] = path.split(':');
    const n = structures[Number(si)].crystals[Number(ci)];
    if (!n) return;
    HANDLERS[key](n, value);
    dirty = true;
    renderChips(); syncInputs(); rebuild();
  },
  add: addCrystal,
  get dirty() { return dirty; },
  shapes: [] as ClusterShape[]
};
