/**
 * Deep Void sky: aurora curtains, a star field, a few constellations, one crescent.
 *
 * The group is camera-local. BackgroundSystem pins it to the camera each frame,
 * so the moon never becomes a card on the path. Placements use the camera's own
 * up axis: lift 0 is the look direction, and positive lift is higher in the frame.
 *
 * The aurora marches a folded noise sheet, the curtain method from the
 * supervitas shader. Cyan through the middle, magenta at the sides. Stars
 * cover the view. Constellations are short thin figures with hard points.
 */
import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Group,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Points,
  ShaderMaterial,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  Vector3
} from 'three';
import { GAME_CONFIG } from '../../config/GameConfig';
import {
  VOID_AURORA,
  VOID_LINE_COOL,
  VOID_LINE_WARM,
  VOID_MOON_CORE,
  VOID_MOON_GLOW,
  VOID_STAR,
  VOID_STAR_BRIGHT,
  VOID_STAR_SOFT
} from './VoidPalette';

export interface SkySpot {
  right: number;
  lift: number;
  dist: number;
}

export interface Constellation {
  tone: 'cool' | 'warm';
  stars: SkySpot[];
}

/** One small crescent, high and off to screen-right, clear of the score. */
export const VOID_MOON: SkySpot = { right: 10, lift: 22, dist: 48 };

/** Short thin figures spread across the view. Not a grid. */
export const VOID_CONSTELLATIONS: Constellation[] = [
  {
    tone: 'warm',
    stars: [
      { right: -44, lift: 24, dist: 72 },
      { right: -38, lift: 28, dist: 72 },
      { right: -32, lift: 23, dist: 72 },
      { right: -27, lift: 27, dist: 72 }
    ]
  },
  {
    tone: 'cool',
    stars: [
      { right: 30, lift: 27, dist: 74 },
      { right: 36, lift: 31, dist: 74 },
      { right: 34, lift: 22, dist: 74 }
    ]
  },
  {
    tone: 'warm',
    stars: [
      { right: -50, lift: 10, dist: 66 },
      { right: -44, lift: 14, dist: 66 },
      { right: -38, lift: 9, dist: 66 },
      { right: -33, lift: 13, dist: 66 }
    ]
  },
  {
    tone: 'cool',
    stars: [
      { right: 40, lift: 8, dist: 64 },
      { right: 46, lift: 12, dist: 64 },
      { right: 50, lift: 6, dist: 64 },
      { right: 44, lift: 3, dist: 64 }
    ]
  },
  {
    tone: 'warm',
    stars: [
      { right: -30, lift: -2, dist: 70 },
      { right: -24, lift: 3, dist: 70 },
      { right: -18, lift: -3, dist: 70 },
      { right: -14, lift: 2, dist: 70 }
    ]
  },
  {
    tone: 'cool',
    stars: [
      { right: 22, lift: -6, dist: 68 },
      { right: 28, lift: -1, dist: 68 },
      { right: 34, lift: -5, dist: 68 }
    ]
  },
  {
    tone: 'warm',
    stars: [
      { right: -56, lift: 18, dist: 76 },
      { right: -50, lift: 22, dist: 76 },
      { right: -46, lift: 16, dist: 76 }
    ]
  },
  {
    tone: 'cool',
    stars: [
      { right: 48, lift: 18, dist: 70 },
      { right: 54, lift: 22, dist: 70 },
      { right: 52, lift: 14, dist: 70 },
      { right: 58, lift: 17, dist: 70 }
    ]
  },
  {
    tone: 'warm',
    stars: [
      { right: -14, lift: 16, dist: 70 },
      { right: -8, lift: 20, dist: 70 },
      { right: -4, lift: 15, dist: 70 },
      { right: -10, lift: 12, dist: 70 }
    ]
  },
  {
    tone: 'cool',
    stars: [
      { right: 6, lift: 8, dist: 68 },
      { right: 12, lift: 12, dist: 68 },
      { right: 9, lift: 4, dist: 68 }
    ]
  },
  {
    tone: 'warm',
    stars: [
      { right: -18, lift: -12, dist: 66 },
      { right: -12, lift: -7, dist: 66 },
      { right: -8, lift: -13, dist: 66 }
    ]
  },
  {
    tone: 'cool',
    stars: [
      { right: 12, lift: -14, dist: 66 },
      { right: 18, lift: -9, dist: 66 },
      { right: 16, lift: -16, dist: 66 },
      { right: 22, lift: -12, dist: 66 }
    ]
  }
];

const LOOK_Y = GAME_CONFIG.CAMERA_LOOK_AHEAD * 0.3;

/** Camera axes in world space. `up` matches the top of the rendered frame. */
export function voidCameraFrame(): { forward: Vector3; right: Vector3; up: Vector3 } {
  const forward = new Vector3(
    0,
    LOOK_Y - GAME_CONFIG.CAMERA_OFFSET_Y,
    GAME_CONFIG.CAMERA_LOOK_AHEAD - GAME_CONFIG.CAMERA_OFFSET_Z
  ).normalize();
  const right = new Vector3().crossVectors(forward, new Vector3(0, 1, 0)).normalize();
  const up = new Vector3().crossVectors(right, forward).normalize();
  return { forward, right, up };
}

/** lift 0 sits on the look direction. Positive lift is higher in the frame. */
export function voidSkyPoint(rightAmt: number, lift: number, dist: number): Vector3 {
  const { forward, right, up } = voidCameraFrame();
  return forward.multiplyScalar(dist).addScaledVector(right, rightAmt).addScaledVector(up, lift);
}

function srgbByte(byte: number): number {
  const s = byte / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function linearVec(hex: number): Vector3 {
  return new Vector3(
    srgbByte((hex >> 16) & 255),
    srgbByte((hex >> 8) & 255),
    srgbByte(hex & 255)
  );
}

function faceCamera(mesh: Mesh, dist: number, right: number, lift: number): void {
  const frame = voidCameraFrame();
  const basis = new Matrix4().makeBasis(frame.right, frame.up, frame.forward.clone().negate());
  mesh.quaternion.setFromRotationMatrix(basis);
  mesh.position.copy(voidSkyPoint(right, lift, dist));
}

const AURORA_VERT = `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const AURORA_FRAG = `
  uniform float uTime;
  uniform vec3 uC0;
  uniform vec3 uC1;
  uniform vec3 uC3;
  uniform vec3 uC4;
  varying vec3 vDir;

  float random(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  mat2 mm2(float a) {
    float c = cos(a);
    float s = sin(a);
    return mat2(c, s, -s, c);
  }

  float tri(float x) {
    return clamp(abs(fract(x) - 0.5), 0.01, 0.49);
  }

  vec2 tri2(vec2 p) {
    return vec2(tri(p.x) + tri(p.y), tri(p.y + tri(p.x)));
  }

  float fbmAurora(vec2 p, float spd) {
    float z = 1.8;
    float z2 = 2.5;
    float rz = 0.0;
    p += vec2(uTime * 0.028, uTime * 0.008);
    p *= mm2(p.x * 0.06);
    vec2 bp = p;
    for (int i = 0; i < 5; i++) {
      vec2 dg = tri2(bp * 1.85) * 0.75;
      dg *= mm2(uTime * spd);
      p -= dg / z2;
      bp *= 1.3;
      z2 *= 0.45;
      z *= 0.42;
      p *= 1.21 + (rz - 1.0) * 0.02;
      rz += tri(p.x + tri(p.y)) * z;
      p *= 0.9 + 0.1 * sin(uTime * 0.07);
    }
    return clamp(1.0 / pow(rz * 20.0, 1.5), 0.0, 1.0);
  }

  vec3 aurora(vec3 rd) {
    vec4 col = vec4(0.0);
    vec4 avgCol = vec4(0.0);
    float flank = smoothstep(0.03, 0.24, abs(rd.x));
    vec3 cyan = mix(uC0, uC1, 0.35);
    vec3 magenta = mix(uC4, uC3, 0.35);
    for (int i = 0; i < 40; i++) {
      float fi = float(i);
      float of = 0.006 * random(gl_FragCoord.xy) * smoothstep(0.0, 15.0, fi);
      float pt = (0.8 + pow(fi, 1.4) * 0.002) / (rd.y * 2.0 + 0.4);
      pt -= of;
      vec3 bpos = vec3(5.5) + pt * rd;
      float rzt = fbmAurora(bpos.zx, 0.055);
      vec3 shift = sin(vec3(0.35, 2.05, 1.55) + fi * 0.043) * 0.5 + 0.5;
      float weave = smoothstep(0.62, 1.0, 0.5 + 0.5 * sin(bpos.x * 0.5 + fi * 0.2));
      float purp = max(flank, weave);
      vec3 tint = mix(cyan, magenta, purp);
      vec4 col2 = vec4(tint * shift * rzt, rzt);
      avgCol = mix(avgCol, col2, 0.5);
      col += avgCol * exp2(-fi * 0.065 - 2.5) * smoothstep(0.0, 5.0, fi);
    }
    col *= clamp(rd.y * 15.0 + 0.4, 0.0, 1.0);
    vec3 lit = smoothstep(vec3(0.0), vec3(1.1), col.rgb * 1.5);
    float glow = max(max(lit.r, lit.g), lit.b);
    return lit * smoothstep(0.05, 0.22, glow);
  }

  void main() {
    vec3 F = normalize(vec3(0.0, -0.5989, 0.8009));
    vec3 U = vec3(0.0, 0.8009, 0.5989);
    vec3 R = vec3(-1.0, 0.0, 0.0);
    vec3 dir = normalize(vDir);
    float ahead = dot(dir, F);
    float side = dot(dir, R);
    float lift = dot(dir, U);
    if (lift < -0.16) {
      gl_FragColor = vec4(0.0);
      return;
    }
    vec3 rd = normalize(vec3(side, lift + 0.04, ahead));
    vec3 col = aurora(rd) * smoothstep(0.0, 0.35, ahead);
    gl_FragColor = vec4(max(col, 0.0), 1.0);
  }
`;

const STAR_VERT = `
  attribute float aSize;
  attribute float aBright;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vBright;
  void main() {
    vColor = aColor;
    vBright = aBright;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = clamp(aSize * (90.0 / max(8.0, -mv.z)), 2.0, 9.0);
    gl_Position = projectionMatrix * mv;
  }
`;

const STAR_FRAG = `
  varying vec3 vColor;
  varying float vBright;
  void main() {
    vec2 p = gl_PointCoord - vec2(0.5);
    float disc = step(length(p), 0.16);
    float arm = 0.0;
    if (vBright > 0.5) {
      arm = step(abs(p.x), 0.06) * step(abs(p.y), 0.46);
      arm += step(abs(p.y), 0.06) * step(abs(p.x), 0.46);
    }
    if (max(disc, arm) < 0.5) discard;
    gl_FragColor = vec4(vColor, 1.0);
  }
`;

interface StarSeed {
  spot: SkySpot;
  size: number;
  hex: number;
  bright: number;
}

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function looseStars(rng: () => number): StarSeed[] {
  const out: StarSeed[] = [];
  const halfY = Math.tan((55 * Math.PI) / 180 / 2);
  const halfX = halfY * (16 / 9);
  for (let i = 0; i < 520; i++) {
    const sx = (rng() * 2 - 1) * halfX * 1.2;
    const sy = (rng() * 2 - 1) * halfY * 1.25;
    const dist = 76 + rng() * 22;
    const roll = rng();
    const bright = roll > 0.93 ? 1 : 0;
    const hex = bright ? VOID_STAR_BRIGHT : roll > 0.5 ? VOID_STAR : VOID_STAR_SOFT;
    const size = bright ? 6.5 : 2.1 + rng() * 1.4;
    out.push({
      spot: { right: sx * dist, lift: sy * dist, dist },
      size,
      hex,
      bright
    });
  }
  return out;
}

function buildStars(seeds: StarSeed[]): Points {
  const positions: number[] = [];
  const colors: number[] = [];
  const sizes: number[] = [];
  const brights: number[] = [];
  for (const star of seeds) {
    const p = voidSkyPoint(star.spot.right, star.spot.lift, star.spot.dist);
    positions.push(p.x, p.y, p.z);
    const c = linearVec(star.hex);
    colors.push(c.x, c.y, c.z);
    sizes.push(star.size);
    brights.push(star.bright);
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geo.setAttribute('aColor', new BufferAttribute(new Float32Array(colors), 3));
  geo.setAttribute('aSize', new BufferAttribute(new Float32Array(sizes), 1));
  geo.setAttribute('aBright', new BufferAttribute(new Float32Array(brights), 1));
  const points = new Points(geo, new ShaderMaterial({
    vertexShader: STAR_VERT,
    fragmentShader: STAR_FRAG,
    transparent: true,
    depthWrite: false,
    fog: false
  }));
  points.name = 'stars';
  points.frustumCulled = false;
  points.renderOrder = 2;
  return points;
}

const NODE_VERT = `
  attribute vec3 aColor;
  varying vec3 vColor;
  void main() {
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = clamp(3.4 * (90.0 / max(8.0, -mv.z)), 3.0, 5.5);
    gl_Position = projectionMatrix * mv;
  }
`;

const NODE_FRAG = `
  varying vec3 vColor;
  void main() {
    vec2 p = gl_PointCoord - vec2(0.5);
    if (dot(p, p) > 0.2) discard;
    gl_FragColor = vec4(vColor, 1.0);
  }
`;

function buildConstellations(): Group {
  const positions: number[] = [];
  const colors: number[] = [];
  for (const figure of VOID_CONSTELLATIONS) {
    const rgb = linearVec(figure.tone === 'warm' ? VOID_LINE_WARM : VOID_LINE_COOL);
    for (let i = 1; i < figure.stars.length; i++) {
      const a = figure.stars[i - 1];
      const b = figure.stars[i];
      const pa = voidSkyPoint(a.right, a.lift, a.dist);
      const pb = voidSkyPoint(b.right, b.lift, b.dist);
      positions.push(pa.x, pa.y, pa.z, pb.x, pb.y, pb.z);
      colors.push(rgb.x, rgb.y, rgb.z, rgb.x, rgb.y, rgb.z);
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geo.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3));
  const lines = new LineSegments(geo, new LineBasicMaterial({
    vertexColors: true,
    depthWrite: false,
    fog: false
  }));
  lines.frustumCulled = false;
  lines.renderOrder = 3;

  const nodePos: number[] = [];
  const nodeCol: number[] = [];
  for (const figure of VOID_CONSTELLATIONS) {
    const rgb = linearVec(figure.tone === 'warm' ? VOID_LINE_WARM : VOID_LINE_COOL);
    for (const spot of figure.stars) {
      const p = voidSkyPoint(spot.right, spot.lift, spot.dist);
      nodePos.push(p.x, p.y, p.z);
      nodeCol.push(rgb.x, rgb.y, rgb.z);
    }
  }
  const nodeGeo = new BufferGeometry();
  nodeGeo.setAttribute('position', new BufferAttribute(new Float32Array(nodePos), 3));
  nodeGeo.setAttribute('aColor', new BufferAttribute(new Float32Array(nodeCol), 3));
  const nodes = new Points(nodeGeo, new ShaderMaterial({
    vertexShader: NODE_VERT,
    fragmentShader: NODE_FRAG,
    depthWrite: false,
    fog: false
  }));
  nodes.frustumCulled = false;
  nodes.renderOrder = 4;

  const group = new Group();
  group.name = 'constellations';
  group.add(lines);
  group.add(nodes);
  return group;
}

function buildAurora(): Mesh {
  const mat = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uC0: { value: linearVec(VOID_AURORA[0]) },
      uC1: { value: linearVec(VOID_AURORA[1]) },
      uC2: { value: linearVec(VOID_AURORA[2]) },
      uC3: { value: linearVec(VOID_AURORA[3]) },
      uC4: { value: linearVec(VOID_AURORA[4]) },
      uC5: { value: linearVec(VOID_AURORA[5]) }
    },
    vertexShader: AURORA_VERT,
    fragmentShader: AURORA_FRAG,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: BackSide,
    fog: false
  });
  const shell = new Mesh(new SphereGeometry(110, 96, 64), mat);
  shell.name = 'aurora';
  shell.frustumCulled = false;
  shell.renderOrder = 1;
  return shell;
}

/** Thin crescent: bright limb on the lower right, horns toward the upper left. */
function crescentGeometry(): ShapeGeometry {
  const cx = -0.09;
  const cy = 0.12;
  const radius = 0.97;
  const dist = Math.hypot(cx, cy);
  const towardHole = Math.atan2(cy, cx);
  const outer = Math.acos((1 + dist * dist - radius * radius) / (2 * dist));
  const limbStart = towardHole + outer;
  const limbEnd = towardHole - outer + Math.PI * 2;
  const shape = new Shape();
  shape.absarc(0, 0, 1, limbStart, limbEnd, false);
  const endX = Math.cos(towardHole - outer);
  const endY = Math.sin(towardHole - outer);
  const startX = Math.cos(towardHole + outer);
  const startY = Math.sin(towardHole + outer);
  const biteEnd = Math.atan2(endY - cy, endX - cx);
  const biteStart = Math.atan2(startY - cy, startX - cx);
  shape.absarc(cx, cy, radius, biteEnd, biteStart, true);
  return new ShapeGeometry(shape, 64);
}

function buildMoon(): Group {
  const group = new Group();
  group.name = 'moon-rig';
  const geo = crescentGeometry();
  const glow = new Mesh(geo, new MeshBasicMaterial({
    color: VOID_MOON_GLOW,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
    fog: false
  }));
  faceCamera(glow, VOID_MOON.dist + 0.15, VOID_MOON.right, VOID_MOON.lift);
  glow.scale.set(1.62, 1.62, 1);
  glow.name = 'moon-halo';
  glow.frustumCulled = false;
  glow.renderOrder = 5;
  group.add(glow);

  const moon = new Mesh(geo, new MeshBasicMaterial({
    color: VOID_MOON_CORE,
    depthWrite: false,
    side: DoubleSide,
    fog: false
  }));
  faceCamera(moon, VOID_MOON.dist, VOID_MOON.right, VOID_MOON.lift);
  moon.scale.set(1.55, 1.55, 1);
  moon.name = 'moon';
  moon.frustumCulled = false;
  moon.renderOrder = 6;
  group.add(moon);
  return group;
}

/** Aurora, stars, constellations, and the crescent. Camera-local. */
export function buildVoidSky(): Group {
  const root = new Group();
  root.name = 'void-sky';
  root.add(buildAurora());
  root.add(buildStars(looseStars(mulberry32(0x51a7))));
  root.add(buildConstellations());
  root.add(buildMoon());
  return root;
}

/** Advance the curtain motion. `now` is milliseconds. The value is wrapped so it stays small enough for the shader to see each frame. */
export function tickVoidSky(root: Group, now: number): void {
  const aurora = root.getObjectByName('aurora') as Mesh | undefined;
  const mat = aurora?.material as ShaderMaterial | undefined;
  if (mat?.uniforms?.uTime) mat.uniforms.uTime.value = (now % 180000) * 0.001;
}
