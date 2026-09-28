// Week 2 Workstream 0 — ART SPIKE scaffolding (post-decision).
//
// DEV-ONLY. The 2026-09-02 lock kept mode 0 (current black hulls) as the
// single V1 pipeline; the losing variants (tinted-rim, playable-only,
// contrast-only) were deleted here — recoverable from git history `39b7384`
// if the fallback is ever needed. What remains is the locked scene builder
// (Sunrise snippet + Dusk mover with the provisional cyan tell) plus the
// hull census, reused as a dev verification tool for the Day 2/3 passes.
// Game reaches this module through a dynamic import() inside a dev-only
// method (only callable via window.gameDebug, dev builds only), so the spike
// lives in its own chunk that production never requests.
//
// What it builds:
//   - a short Sunrise snippet: warm sky/fog, paper mountain + cloud layers,
//     warm-tinted platforms (replaces the generic rock clusters for the shot)
//   - ONE Dusk moving platform with the candidate motion tell (cyan glow
//     strip under its bottom edge + violet face), swaying via its own tween
//
// Revert: reload the page. A world switch / runway reseed also wipes the
// recolors (PlatformManager.reset repaints via platformColor).
import {
  BackSide,
  BoxGeometry,
  Color,
  ConeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  type Material,
  type Object3D,
  type Scene
} from 'three';
import { gsap } from 'gsap';
import { GAME_CONFIG } from '../config/GameConfig';
import { MaterialFactory } from '../systems/MaterialFactory';

/** Spike palette (feel-reference, not final art direction). */
export const SPIKE = {
  /** Warm cream sky + matching fog. */
  sky: 0xf6e7ce,
  /** Paper mountain far layer (warm blue). */
  ridgeFar: 0xa9c2df,
  /** Paper mountain near layer (peach). */
  ridgeNear: 0xf0a988,
  /** Cloud cutouts. */
  cloud: 0xfff8ea,
  /** Warm platform faces (cream / sand / restrained gold). */
  faces: [0xf7ead2, 0xf3d3a0, 0xe9b96f],
  /** The one Dusk mover's face (violet). */
  duskFace: 0x6b5bb8,
  /** The candidate motion tell: cyan glow strip (Dusk's one cyan accent). */
  tell: 0x38f0e8
} as const;

type HullRole = 'playable' | 'prop';

interface HullRecord {
  mesh: Mesh;
  role: HullRole;
  color: number;
  sx: number;
  sy: number;
  sz: number;
  visible: boolean;
}

const BLACK_HULL = 0x111111;

function isHullMesh(obj: Object3D): obj is Mesh {
  const mesh = obj as Mesh;
  if (!mesh.isMesh) return false;
  const mat = mesh.material as Material;
  if (Array.isArray(mat)) return false;
  if (mat.side !== BackSide) return false;
  const colored = mat as unknown as { color?: { getHex(): number } };
  if (!colored.color || colored.color.getHex() !== BLACK_HULL) return false;
  // Pair rule: the hull must share its geometry with a non-hull sibling in
  // the same group (platform/box, coin/cylinder, ball/sphere, rock/sphere,
  // spike prop/cone). This keeps perfect dots, blob highlights, shield
  // shells and glow strips out of the hull set.
  const parent = mesh.parent;
  if (!parent) return false;
  return parent.children.some(
    (sib) => sib !== mesh && (sib as Mesh).isMesh && (sib as Mesh).geometry === mesh.geometry
  );
}

export interface SpikeSceneHandles {
  scene: Scene;
  ballGroup: Group;
  platformGroups: Group[];
  /** Ball world z, so props spawn ahead of the current camera. */
  ballZ: number;
  /** Hide the generic rock clusters (restored on reload). */
  setBackgroundVisible(v: boolean): void;
}

export class SpikeLab {
  private handles: SpikeSceneHandles | null = null;
  private spikeGroup: Group | null = null;
  private swayTween: gsap.core.Tween | null = null;
  private hulls: HullRecord[] = [];
  private built = false;
  private duskTile: Group | null = null;

  /** Build (or rebuild) the spike scene. Idempotent. */
  build(handles: SpikeSceneHandles): { duskTileAhead: boolean; hulls: number; playable: number; props: number } {
    this.handles = handles;
    this.teardownScene();

    const { scene } = handles;
    scene.background = new Color(SPIKE.sky);
    const fog = scene.fog;
    if (fog && 'color' in fog) (fog.color as Color).setHex(SPIKE.sky);
    handles.setBackgroundVisible(false);

    this.spikeGroup = new Group();
    scene.add(this.spikeGroup);
    this.buildRidges(handles.ballZ);
    this.buildClouds(handles.ballZ);

    // Warm spike faces: swap the pipeline multi-material for one flat toon
    // fill (throwaway scene — reload restores the real materials).
    handles.platformGroups.forEach((g, i) => {
      const face = g.children[0] as Mesh;
      face.material = MaterialFactory.createMaterial(SPIKE.faces[i % SPIKE.faces.length]);
    });

    this.buildDuskTile(handles);
    this.collectHulls();
    this.applyLocked();
    this.built = true;
    return {
      duskTileAhead: this.duskTile !== null,
      hulls: this.hulls.length,
      playable: this.hulls.filter((h) => h.role === 'playable').length,
      props: this.hulls.filter((h) => h.role === 'prop').length
    };
  }

  dispose(): void {
    this.teardownScene();
    this.hulls = [];
    this.built = false;
    this.handles = null;
  }

  // ---- scene ----

  private buildRidges(ballZ: number): void {
    const group = this.spikeGroup!;
    // Far layer: warm-blue pyramids. Near layer: peach pyramids.
    const layers = [
      { color: SPIKE.ridgeFar, z0: ballZ + 18, count: 4, r: 3.4, h: 5.2 },
      { color: SPIKE.ridgeNear, z0: ballZ + 9, count: 3, r: 2.6, h: 3.8 }
    ];
    for (const layer of layers) {
      for (let i = 0; i < layer.count; i++) {
        const geo = new ConeGeometry(layer.r, layer.h, 4);
        const mesh = new Mesh(geo, MaterialFactory.createMaterial(layer.color));
        mesh.rotation.y = Math.PI / 4;
        const side = i % 2 === 0 ? -1 : 1;
        mesh.position.set(side * (6.5 + (i % 3) * 1.6), layer.h / 2 - 0.4, layer.z0 + i * 3.1);
        const hull = new Mesh(geo, new MeshBasicMaterial({ color: BLACK_HULL, side: BackSide }));
        hull.scale.multiplyScalar(1.04);
        hull.position.copy(mesh.position);
        hull.rotation.y = Math.PI / 4;
        group.add(mesh);
        group.add(hull);
      }
    }
  }

  private buildClouds(ballZ: number): void {
    const group = this.spikeGroup!;
    const geo = new SphereGeometry(1, 12, 8);
    const spots = [
      { x: -5.5, y: 5.2, z: ballZ + 12, s: 1.5 },
      { x: 5.8, y: 6.1, z: ballZ + 20, s: 1.9 },
      { x: 0.5, y: 4.6, z: ballZ + 26, s: 1.2 }
    ];
    for (const spot of spots) {
      const puff = new Group();
      for (let i = 0; i < 3; i++) {
        const mesh = new Mesh(geo, MaterialFactory.createMaterial(SPIKE.cloud));
        mesh.position.set((i - 1) * 0.9, (i % 2) * 0.25, 0);
        mesh.scale.set(spot.s, spot.s * 0.45, spot.s * 0.7);
        const hull = new Mesh(geo, new MeshBasicMaterial({ color: BLACK_HULL, side: BackSide }));
        hull.position.copy(mesh.position);
        hull.scale.copy(mesh.scale).multiplyScalar(1.04);
        puff.add(mesh);
        puff.add(hull);
      }
      puff.position.set(spot.x, spot.y, spot.z);
      group.add(puff);
    }
  }

  /** Convert the first platform ahead of the ball into the Dusk mover. */
  private buildDuskTile(handles: SpikeSceneHandles): void {
    // Find the platform group just ahead of the ball (robust to demo progress).
    let best: Group | null = null;
    let bestZ = Infinity;
    for (const g of handles.platformGroups) {
      if (g.position.z > handles.ballZ + 2 && g.position.z < bestZ) {
        bestZ = g.position.z;
        best = g;
      }
    }
    if (!best) return;
    this.duskTile = best;

    const face = best.children[0] as Mesh;
    face.material = MaterialFactory.createMaterial(SPIKE.duskFace);

    // Candidate motion tell: cyan glow strip under the bottom edge
    // (Dusk prompt: "single streak of cool cyan neon glow on bottom edges").
    // Constant across all four modes — modes only change hulls/edges.
    const strip = new Mesh(
      new BoxGeometry(GAME_CONFIG.PLATFORM_WIDTH * 0.92, 0.07, GAME_CONFIG.PLATFORM_DEPTH * 0.92),
      new MeshBasicMaterial({ color: SPIKE.tell })
    );
    strip.position.y = -GAME_CONFIG.PLATFORM_HEIGHT / 2 - 0.035;
    strip.userData.spikeTell = true;
    best.add(strip);

    // Sway via its own tween (Sunrise world sway amp is 0, and updateSway
    // leaves static tiles alone while swayOffset stays 0 — no fighting).
    const baseX = best.position.x;
    this.swayTween = gsap.to(best.position, {
      x: baseX + 1.1,
      duration: 1.4,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1
    });
  }

  // ---- outline modes ----

  private collectHulls(): void {
    this.hulls = [];
    const handles = this.handles!;
    const found: Mesh[] = [];
    handles.scene.traverse((obj) => {
      if (isHullMesh(obj)) found.push(obj);
    });
    for (const mesh of found) {
      let role: HullRole = 'prop';
      let node: Object3D | null = mesh;
      while (node) {
        if (node === handles.ballGroup || handles.platformGroups.includes(node as Group)) {
          role = 'playable';
          break;
        }
        node = node.parent;
      }
      const mat = mesh.material as unknown as { color: { getHex(): number } };
      this.hulls.push({
        mesh,
        role,
        color: mat.color.getHex(),
        sx: mesh.scale.x,
        sy: mesh.scale.y,
        sz: mesh.scale.z,
        visible: mesh.visible
      });
    }
  }

  /** Locked pipeline (mode 0): thick black hulls everywhere, original scales. */
  private applyLocked(): void {
    for (const h of this.hulls) {
      const mat = h.mesh.material as unknown as { color: { setHex(n: number): void } };
      h.mesh.visible = h.visible;
      mat.color.setHex(h.color);
      h.mesh.scale.set(h.sx, h.sy, h.sz);
    }
  }

  private teardownScene(): void {
    if (this.swayTween) {
      this.swayTween.kill();
      this.swayTween = null;
    }
    if (this.handles && this.spikeGroup) {
      this.handles.scene.remove(this.spikeGroup);
      this.spikeGroup.traverse((obj) => {
        const m = obj as Mesh;
        if (m.isMesh) {
          const mat = m.material;
          if (!Array.isArray(mat)) mat?.dispose?.();
          // Cone/sphere geos here are per-prop instances (not shared) — safe.
          m.geometry?.dispose?.();
        }
      });
    }
    // Remove tell strips from platforms (faces keep spike colors until
    // reload — documented; a reseed repaints via platformColor).
    if (this.handles) {
      for (const g of this.handles.platformGroups) {
        for (let i = g.children.length - 1; i >= 0; i--) {
          const child = g.children[i];
          if (child.userData.spikeTell === true) {
            g.remove(child);
            const m = child as Mesh;
            if (m.isMesh && !Array.isArray(m.material)) (m.material as Material)?.dispose?.();
          }
        }
      }
    }
    this.spikeGroup = null;
    this.duskTile = null;
  }
}
