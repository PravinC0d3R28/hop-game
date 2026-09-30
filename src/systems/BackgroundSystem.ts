import {
  AdditiveBlending,
  BackSide,
  BoxGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  type BufferGeometry,
  type Scene
} from 'three';
import { MaterialFactory } from './MaterialFactory';
import { bakeCluster, CLUSTER_SHAPES, emitCluster, emitStructure, emptyAcc, makeRng, type ClusterSpec } from './CrystalFactory';
import {
  DEFAULT_PLACEMENT,
  generatePlacements,
  type FrameInfo,
  type PlacementOptions
} from './CrystalField';
import { buildCloudSea, cloudHeightAlongSight, type CloudSeaOpts } from './CloudFactory';
import type { CrystalFieldRecipe, CloudSeaRecipe, WorldLook } from '../config/WorldLooks';

/** Segment length along +Z. */
const SEG_LEN = 70;
/**
 * Segments kept alive per layer. The camera can see `fogFar` (82) units of
 * haze plus its own offset, and it sits somewhere inside segment 0 of the
 * snapped range — 2 left a bare strip at the far end of the view.
 */
const SEG_COUNT = 3;

interface Layer {
  /** Meshes sharing one geometry (the set recycles as one chain). */
  meshes: Mesh[];
  geo: BufferGeometry;
  bob: number;
}

const CORRIDOR = 3.4; // keep |x| clear so the landing path stays readable

/**
 * Environment layers for the active world look.
 *
 * Each layer is ONE merged geometry instanced across a few recycled segments,
 * so a dense concept scene costs 2 draws (faces + hull) for all crystals and
 * 1 draw for the whole cloud sea. Z-recycling keeps the runway endless.
 */
export class BackgroundSystem {
  private layers: Layer[] = [];
  private root: Group;
  private seed = 1;
  private look: WorldLook | null = null;
  /**
   * Live camera framing, pushed in by the renderer. The crystal field is laid
   * out against the ACTUAL horizontal field of view, because the same lateral
   * offset is on screen on a laptop and off it on a phone.
   */
  private frame: FrameInfo = { fovDeg: 55, aspect: 16 / 9 };
  /** Sun-ray group, drifted each frame. */
  private rayGroup: Group | null = null;

  constructor(private scene: Scene) {
    this.root = new Group();
    scene.add(this.root);
  }

  init(): void {
    // Geometry arrives via setLook (Game applies the active world right after).
  }

  /** Camera framing used to keep formations inside the visible frustum. */
  setFrame(fovDeg: number, aspect: number): void {
    if (!Number.isFinite(fovDeg) || !Number.isFinite(aspect) || aspect <= 0) return;
    if (this.frame.fovDeg === fovDeg && this.frame.aspect === aspect) return;
    this.frame = { fovDeg, aspect };
    // Frustum-safe placement depends on the framing, so the field is rebuilt.
    if (this.look) this.setLook(this.look);
  }

  /** The seed the field was generated from — share it to reproduce a layout. */
  getSeed(): number {
    return this.seed;
  }

  /** Reseed the field: a new arrangement, same rules. */
  reseed(seed?: number): number {
    this.seed = (seed ?? (this.seed * 1664525 + 1013904223)) >>> 0;
    if (this.look) this.setLook(this.look);
    return this.seed;
  }

  /** Rebuild the scenery from a world's recipes (select/preview/run). */
  setLook(look: WorldLook): void {
    this.look = look;
    this.dispose(false);
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    let built = 0;
    // The crystal layer needs the cloud recipe up front so it can seat each
    // formation on the real cloud surface.
    const cloud = look.props.find((p) => p.family === 'cloudsea');
    this.addSunRayLayer();
    for (const recipe of look.props) {
      if (recipe.family === 'crystalfield') {
        this.addCrystalLayer(recipe, cloud && cloud.family === 'cloudsea' ? cloud : null);
      } else if (recipe.family === 'cloudsea') this.addCloudLayer(recipe);
      else if (import.meta.env.DEV) {
        console.warn(`BackgroundSystem: no builder for prop family "${recipe.family}" yet — skipping`);
      }
      built++;
    }
    void built;
  }

  /**
   * Sun rays raking in from the upper left, matching the doc's locked
   * upper-left key light.
   *
   * Additive, fog-exempt and parented to the scene root so they sit behind the
   * scenery, with a gentle drift so the light feels alive. Deliberately faint:
   * they are atmosphere, and at full strength they wash out the crystal colours
   * the palette work just added.
   */
  private addSunRayLayer(): void {
    const g = new Group();
    const mat = new MeshBasicMaterial({
      color: 0xffe6b8,
      transparent: true,
      opacity: 0.1,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
      fog: false
    });
    const rays = new Group();
    for (let i = 0; i < 7; i++) {
      const w = 1.6 + (i % 3) * 1.5;
      const len = 90 + (i % 4) * 22;
      const geo = new PlaneGeometry(w, len);
      // Origin off-frame at the upper left, splaying down and to the right.
      const m = new Mesh(geo, mat);
      m.position.set(-34 + i * 7.5, 40 - i * 2.5, -34 - i * 9);
      m.rotation.set(0.42, 0, -0.62 + i * 0.05);
      rays.add(m);
    }
    g.add(rays);
    g.renderOrder = 0;
    this.root.add(g);
    this.rayGroup = rays;
  }

  /** Crystal formations: one vertex-coloured mesh of the authored structures. */
  private addCrystalLayer(recipe: CrystalFieldRecipe, cloud: CloudSeaRecipe | null): void {
    const acc = emptyAcc();
    void recipe.parallax;
    const cloudOpts: CloudSeaOpts | null = cloud
      ? {
        length: SEG_LEN,
        spread: cloud.spread,
        top: cloud.top,
        depth: cloud.depth,
        cols: cloud.cols,
        rows: cloud.rows,
        cell: cloud.cell,
        palette: cloud.palette,
        seed: this.seed
      }
      : null;
    // Seat each formation on the real cloud surface at its own (x, z) — and, more
    // importantly, on the HIGHEST crest between it and the camera. Sampling only
    // the surface directly beneath left formations standing in a trough hidden
    // behind the crest in front of them, which is the "still submerged" case.
    const cloudHeight = cloudOpts
      ? (x: number, z: number) => cloudHeightAlongSight(cloudOpts, x, z, 0, 12)
      : () => recipe.baseY;

    const opts: PlacementOptions = {
      ...DEFAULT_PLACEMENT,
      count: recipe.count,
      segmentLength: SEG_LEN,
      corridor: CORRIDOR
    };
    // Authored formations ONLY — the owner locked five and asked that nothing
    // else appear in the field.
    for (const p of generatePlacements(this.seed ^ 0x5f3a, this.frame, cloudHeight, opts)) {
      emitStructure(acc, p.structure, {
        x: p.side * p.spread,
        z: p.z,
        baseY: p.baseY,
        scale: p.scale,
        families: recipe.families
      });
    }
    const faceMesh = new Mesh(bakeCluster(acc).face, new MeshBasicMaterial({ vertexColors: true, side: DoubleSide }));
    // No crystal contour for now. Two implementations were tried and both are
    // parked in git history:
    //   * world-space expanded shell — over-expands along the normal near
    //     silhouettes, and ghosts through the cloud deck and platforms;
    //   * clip-space contour — depth-safe, but its screen expansion over-shoots
    //     and paints solid black masses.
    // A correct hairline needs a real post-process outline pass. Until then the
    // crystals render flat-coloured, which is clean and matches the concept's
    // colour blocks.
    faceMesh.renderOrder = 2;
    this.spawnLayer([faceMesh], 0);
  }

  /** The cloud blanket: one vertex-coloured mesh, no outlines. */
  private addCloudLayer(recipe: CloudSeaRecipe): void {
    const geo = buildCloudSea({
      length: SEG_LEN,
      spread: recipe.spread,
      top: recipe.top,
      depth: recipe.depth,
      cols: recipe.cols,
      rows: recipe.rows,
      cell: recipe.cell,
      palette: recipe.palette,
      seed: this.seed
    });
    // Unlit + vertex colours: the crown/shadow tone is baked per billow, so
    // lighting on top only muddied them. No dots (they read as steam).
    const mesh = new Mesh(geo, new MeshBasicMaterial({ vertexColors: true, side: DoubleSide }));
    this.spawnLayer([mesh], recipe.parallax);
  }

  private spawnLayer(meshes: Mesh[], bob: number): void {
    const layer: Layer = { meshes, geo: meshes[0].geometry, bob };
    // NOTE: `root.add(m)` moves an Object3D, it does not clone it — adding the
    // SAME mesh once per segment silently produced ONE segment per layer (the
    // last position won). Each segment needs its own Mesh over the shared
    // geometry.
    layer.meshes = [];
    for (let k = 0; k < SEG_COUNT; k++) {
      for (const source of meshes) {
        const m = new Mesh(source.geometry, source.material);
        m.position.z = k * SEG_LEN;
        // Copy the ordering flags: the source meshes are only templates and are
        // never added to the scene, so anything not copied here is silently
        // lost — this is what let a hidden template still render its clones.
        m.renderOrder = source.renderOrder;
        m.frustumCulled = source.frustumCulled;
        m.visible = source.visible;
        this.root.add(m);
        layer.meshes.push(m);
      }
    }
    this.layers.push(layer);
  }

  /**
   * Keep the scenery centred on the player.
   *
   * Every segment shares ONE geometry, so the environment is periodic with
   * period SEG_LEN: snapping each segment to `floor(camZ / SEG_LEN) * SEG_LEN
   * + i * SEG_LEN` advances the whole world by exactly one period when the
   * ball crosses a cell boundary — a pixel-identical image, so there is no pop
   * — while the scenery can never outrun the camera.
   *
   * (The first two attempts advanced a running slot index per frame. That
   * moved scenery ~70 units per frame while the ball advances ~0.2, so the
   * world ran away and the screen went empty; anchoring to the ball's own
   * position is the only stable rule.)
   */
  update(camZ: number, now: number): void {
    const base = Math.floor(camZ / SEG_LEN) * SEG_LEN;
    for (const layer of this.layers) {
      layer.meshes.forEach((m, i) => {
        m.position.z = base + i * SEG_LEN;
      });
      if (this.rayGroup) {
        // Slow sway so the light is alive without ever distracting from play.
        this.rayGroup.rotation.y = Math.sin(now * 0.00004) * 0.09;
        this.rayGroup.position.z = Math.sin(now * 0.00003) * 3;
      }
      if (layer.bob > 0) {
        // Parallax drift: distant layers breathe very slowly so the world never
        // feels frozen (kept well below tile sway).
        const y = Math.sin(now * 0.00018) * 0.25 * layer.bob;
        for (const m of layer.meshes) m.position.y = y;
      }
    }
  }

  /** Reset for a new run: rewind every segment to its start slot. */
  reset(): void {
    for (const layer of this.layers) {
      for (const m of layer.meshes) {
        m.position.z = 0;
        m.position.y = 0;
      }
    }
  }

  setVisible(v: boolean): void {
    this.root.visible = v;
  }

  /** Root group (dev spikes swap scenery in/out). */
  getRoot(): Group {
    return this.root;
  }

  /**
   * Development-only look diagnostics (Week 2 §16): what is actually in the
   * scene, with real world-space bounds. Debugging "I can't see the clouds"
   * by eye is guesswork; this answers it in one call.
   */
  inspect(): Array<Record<string, unknown>> {
    return this.layers.map((layer) => {
      const pos = layer.geo.getAttribute('position');
      const min: [number, number, number] = [Infinity, Infinity, Infinity];
      const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        if (x < min[0]) min[0] = x;
        if (y < min[1]) min[1] = y;
        if (z < min[2]) min[2] = z;
        if (x > max[0]) max[0] = x;
        if (y > max[1]) max[1] = y;
        if (z > max[2]) max[2] = z;
      }
      const m = layer.meshes[0];
      const r = (v: number) => Math.round(v * 10) / 10;
      return {
        z: r(m.position.z),
        visible: this.root.visible && m.visible,
        parented: m.parent === this.root,
        rootChildren: this.root.children.length,
        inScene: !!this.root.parent,
        matType: (m.material as { type?: string }).type,
        frustumCulled: m.frustumCulled,
        verts: pos.count,
        hulls: layer.meshes.length,
        min: [r(min[0]), r(min[1]), r(min[2])],
        max: [r(max[0]), r(max[1]), r(max[2])]
      };
    });
  }

  dispose(full = true): void {
    for (const layer of this.layers) {
      for (const m of layer.meshes) {
        this.root.remove(m);
        const mat = m.material;
        if (!Array.isArray(mat)) mat?.dispose();
      }
      for (const m of layer.meshes) m.geometry.dispose();
    }
    this.layers = [];
    if (full) {
      this.scene.remove(this.root);
    }
  }
}









