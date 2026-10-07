/**
 * Dev-only sheet of every finished Void piece.
 *   /void-lab.html            all of them
 *   /void-lab.html?id=wide-shelf   one piece
 */
import {
  Box3,
  BufferGeometry,
  Color,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer
} from 'three';
import { VOID_GATES, buildGateVariation } from '../worlds/void/VoidGates';
import { VOID_ISLANDS, buildIslandVariation } from '../worlds/void/VoidIslands';
import { VOID_MONOLITHS, buildMonolithVariation } from '../worlds/void/VoidMonoliths';
import { VOID_ORBITS, VOID_PLANETS, buildOrbitVariation, buildPlanetVariation } from '../worlds/void/VoidPlanets';
import { voidCameraFrame } from '../worlds/void/VoidSky';
import { GAME_CONFIG } from '../config/GameConfig';

interface Card {
  id: string;
  group: string;
  geo: BufferGeometry;
  faceOn: boolean;
}

const GROUPS = ['Islands', 'Monoliths', 'Planets', 'Orbits', 'Gates'];

function catalog(): Card[] {
  return [
    ...VOID_ISLANDS.map((item) => ({
      id: item.id,
      group: 'Islands',
      geo: buildIslandVariation(item, 1),
      faceOn: false
    })),
    ...VOID_MONOLITHS.map((item) => ({
      id: item.id,
      group: 'Monoliths',
      geo: buildMonolithVariation(item, 1),
      faceOn: false
    })),
    ...VOID_PLANETS.map((item) => ({
      id: item.id,
      group: 'Planets',
      geo: buildPlanetVariation(item, 1),
      faceOn: false
    })),
    ...VOID_ORBITS.map((item) => ({
      id: item.id,
      group: 'Orbits',
      geo: buildOrbitVariation(item, 1),
      faceOn: false
    })),
    ...VOID_GATES.map((item) => ({
      id: item.id,
      group: 'Gates',
      geo: buildGateVariation(item),
      faceOn: true
    }))
  ];
}

function recenter(geo: BufferGeometry): void {
  const pos = geo.getAttribute('position');
  let sx = 0;
  let sy = 0;
  let sz = 0;
  for (let i = 0; i < pos.count; i++) {
    sx += pos.getX(i);
    sy += pos.getY(i);
    sz += pos.getZ(i);
  }
  const n = pos.count || 1;
  for (let i = 0; i < pos.count; i++) {
    pos.setX(i, pos.getX(i) - sx / n);
    pos.setY(i, pos.getY(i) - sy / n);
    pos.setZ(i, pos.getZ(i) - sz / n);
  }
  pos.needsUpdate = true;
}

const scene = new Scene();
scene.background = new Color(0xffffff);
const camera = new PerspectiveCamera(38, 600 / 420, 0.1, 400);
const renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(600, 420);
const material = new MeshBasicMaterial({ vertexColors: true });

const VIEWS: { name: string; dir: Vector3 }[] = [
  { name: 'three-quarter', dir: new Vector3(1.15, 0.58, 1) },
  { name: 'top', dir: new Vector3(0.2, 1, 0.08) },
  { name: 'bottom', dir: new Vector3(0.2, -1, 0.08) },
  { name: 'side', dir: new Vector3(1, 0.16, 0.02) },
  { name: 'end', dir: new Vector3(0.02, 0.16, 1) }
];

/** Direction from the piece back to a camera on the path, matching play. */
function gameDirection(geo: BufferGeometry): Vector3 {
  geo.computeBoundingBox();
  const center = geo.boundingBox!.getCenter(new Vector3());
  const cam = new Vector3(0, GAME_CONFIG.CAMERA_OFFSET_Y, center.z - 16);
  return cam.sub(center);
}

function frame(mesh: Mesh, dir: Vector3): void {
  const box = new Box3().setFromObject(mesh);
  const size = box.getSize(new Vector3());
  const center = box.getCenter(new Vector3());
  const radius = Math.max(size.x, size.y, size.z) * 0.62;
  const fov = (camera.fov * Math.PI) / 180;
  const dist = (radius / Math.tan(fov / 2)) * 1.55;
  camera.up.set(0, 1, 0);
  camera.position.copy(center).add(dir.clone().normalize().multiplyScalar(Math.max(dist, 2)));
  camera.lookAt(center);
  camera.updateProjectionMatrix();
}

function shot(card: Card, dir?: Vector3): string {
  const game = !dir;
  const aim = dir ?? (card.faceOn
    ? voidCameraFrame().forward.clone().negate()
    : gameDirection(card.geo));
  camera.fov = game && !card.faceOn ? 55 : 38;
  camera.aspect = game && !card.faceOn ? 16 / 9 : 600 / 420;
  renderer.setSize(game && !card.faceOn ? 960 : 600, game && !card.faceOn ? 540 : 420);
  recenter(card.geo);
  card.geo.boundingBox = null;
  const mesh = new Mesh(card.geo, material);
  scene.add(mesh);
  frame(mesh, aim);
  renderer.render(scene, camera);
  scene.remove(mesh);
  return renderer.domElement.toDataURL('image/png');
}

const params = new URLSearchParams(location.search);
const only = params.get('id');
const cards = catalog().filter((card) => !only || card.id === only);

if (only) {
  const sheet = document.getElementById('sheet');
  const card = cards[0];
  if (sheet && card) {
    const heading = document.createElement('h2');
    heading.textContent = only;
    const grid = document.createElement('div');
    grid.className = 'grid';
    const views = card.faceOn
      ? [{ name: 'face', dir: voidCameraFrame().forward.clone().negate() }, ...VIEWS.slice(1)]
      : [{ name: 'game', dir: undefined as Vector3 | undefined }, ...VIEWS];
    for (const view of views) {
      const cell = document.createElement('figure');
      cell.className = 'card';
      const img = document.createElement('img');
      img.alt = `${only} ${view.name}`;
      img.src = shot(card, view.dir);
      const caption = document.createElement('figcaption');
      caption.textContent = view.name;
      cell.append(img, caption);
      grid.append(cell);
    }
    sheet.append(heading, grid);
  }
} else {
  const sheet = document.getElementById('sheet');
  if (sheet) {
    for (const group of GROUPS) {
      const heading = document.createElement('h2');
      heading.textContent = group;
      const grid = document.createElement('div');
      grid.className = 'grid';
      for (const card of cards.filter((item) => item.group === group)) {
        const cell = document.createElement('figure');
        cell.className = 'card';
        const img = document.createElement('img');
        img.alt = card.id;
        img.src = shot(card);
        const caption = document.createElement('figcaption');
        caption.textContent = card.id;
        cell.append(img, caption);
        grid.append(cell);
      }
      sheet.append(heading, grid);
    }
  }
}
