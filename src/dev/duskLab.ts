// Dev-only. One Dusk piece, framed the way the gameplay camera sees it.
// Not part of the production build (Vite only bundles index.html).
import {
  AdditiveBlending,
  BoxGeometry,
  Color,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  WebGLRenderer
} from 'three';
import { DUSK_PIECE_NAMES, buildDuskPiece, type DuskPieceName } from '../worlds/dusk/DuskPieces';

const pieceEl = document.getElementById('piece') as HTMLSelectElement;
const noteEl = document.getElementById('note') as HTMLDivElement;
for (const name of DUSK_PIECE_NAMES) {
  const option = document.createElement('option');
  option.value = name;
  option.textContent = name;
  pieceEl.appendChild(option);
}

const scene = new Scene();
scene.background = new Color(0x6a3a58);

const camera = new PerspectiveCamera(42, innerWidth / innerHeight, 0.05, 80);
const renderer = new WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.prepend(renderer.domElement);

let targetY = 0.95;
let radius = 5.2;
const params = new URLSearchParams(location.search);
const deg = (name: string, fallback: number) => {
  const raw = params.get(name);
  if (raw === null || raw === '') return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
};
let yaw = (deg('yaw', 12) * Math.PI) / 180;
let pitch = (deg('pitch', 30) * Math.PI) / 180;

function placeCamera(): void {
  const cp = Math.cos(pitch);
  camera.position.set(
    Math.sin(yaw) * cp * radius,
    targetY + Math.sin(pitch) * radius,
    -Math.cos(yaw) * cp * radius
  );
  camera.lookAt(0, targetY, 0);
}
placeCamera();

let dragging = false;
let lastX = 0;
let lastY = 0;
renderer.domElement.addEventListener('pointerdown', (event) => {
  dragging = true;
  lastX = event.clientX;
  lastY = event.clientY;
  renderer.domElement.setPointerCapture(event.pointerId);
});
renderer.domElement.addEventListener('pointerup', () => {
  dragging = false;
});
renderer.domElement.addEventListener('pointermove', (event) => {
  if (!dragging) return;
  yaw -= (event.clientX - lastX) * 0.01;
  pitch = Math.min(1.25, Math.max(-0.15, pitch + (event.clientY - lastY) * 0.008));
  lastX = event.clientX;
  lastY = event.clientY;
  placeCamera();
});

const wall = new Mesh(
  new BoxGeometry(2.6, 3.4, 0.35),
  new MeshBasicMaterial({ color: 0xc46b78 })
);
wall.position.set(0, 1.45, 0.78);
scene.add(wall);

let face: Mesh | null = null;
let shell: Mesh | null = null;
let glow: Mesh | null = null;

function show(name: DuskPieceName): void {
  const beacon = name.startsWith('lantern-beacon');
  const building = !name.startsWith('lantern');
  const tall = name === 'tower-cap' || name === 'cliff' || name === 'pillar-band' || name === 'court' || name === 'hall';
  const wide = name === 'arcade' || name === 'parapet' || name === 'windows' || name === 'gate' || name === 'stair' || name === 'lodge' || name === 'hall';
  const needle = name === 'pillar-spire' || name === 'keep';
  targetY = beacon ? 0.45 : needle ? 3.2 : name === 'pillar-stub' ? 1.05 : tall ? 2.3 : building ? 1.6 : 0.95;
  radius = beacon ? 2.6 : needle ? 13 : name === 'pillar-stub' ? 6.2 : tall ? 10 : wide ? 10.4 : name === 'terrace' ? 9.2 : building ? 8.6 : 5.2;
  wall.visible = !building && !beacon;
  placeCamera();
  if (face) scene.remove(face);
  if (shell) scene.remove(shell);
  if (glow) scene.remove(glow);
  const piece = buildDuskPiece(name);
  face = new Mesh(piece.face, new MeshBasicMaterial({ vertexColors: true }));
  face.renderOrder = 2;
  scene.add(face);
  const outline = piece.shell.getAttribute('position');
  if (outline && outline.count > 0) {
    shell = new Mesh(piece.shell, new MeshBasicMaterial({ color: 0x4a3638 }));
    shell.renderOrder = 1;
    scene.add(shell);
  }
  const light = piece.glow.getAttribute('position');
  if (light && light.count > 0) {
    glow = new Mesh(piece.glow, new MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide
    }));
    glow.renderOrder = 3;
    scene.add(glow);
  }
  noteEl.textContent = piece.name;
}

pieceEl.addEventListener('change', () => show(pieceEl.value as DuskPieceName));
const requested = new URLSearchParams(location.search).get('piece');
const initial = (DUSK_PIECE_NAMES as readonly string[]).includes(requested ?? '')
  ? requested as DuskPieceName
  : 'lantern-amber';
pieceEl.value = initial;
show(initial);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

renderer.setAnimationLoop(() => renderer.render(scene, camera));
