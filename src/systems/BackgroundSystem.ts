import {
  BackSide,
  BoxGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  type BufferGeometry,  type Scene
} from 'three';
import { MaterialFactory } from './MaterialFactory';
import { bakeCluster, CLUSTER_SHAPES, emitCluster, emptyAcc, makeRng, type ClusterSpec } from './CrystalFactory';
import { buildCloudSea } from './CloudFactory';
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

  constructor(private scene: Scene) {
    this.root = new Group();
    scene.add(this.root);
  }

  init(): void {
    // Geometry arrives via setLook (Game applies the active world right after).
  }

  /** Rebuild the scenery from a world's recipes (select/preview/run). */
  setLook(look: WorldLook): void {
    this.dispose(false);
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    let built = 0;
    for (const recipe of look.props) {
      if (recipe.family === 'crystalfield') this.addCrystalLayer(recipe, look.platformEdge);
      else if (recipe.family === 'cloudsea') this.addCloudLayer(recipe);
      else if (import.meta.env.DEV) {
        console.warn(`BackgroundSystem: no builder for prop family "${recipe.family}" yet — skipping`);
      }
      built++;
    }
    void built;
  }

  /** Crystal formations: face mesh (vertex-coloured) + fixed-width hull. */
  private addCrystalLayer(recipe: CrystalFieldRecipe, edge: number): void {
    const rnd = makeRng(this.seed);
    const acc = emptyAcc();
    for (let i = 0; i < recipe.count; i++) {
      // Spread across the segment, alternating sides, never in the corridor.
      const t = (i + 0.5) / recipe.count;
      const z = 4 + t * (SEG_LEN - 8) + (rnd() - 0.5) * 3;
      const side = i % 2 === 0 ? -1 : 1;
      // Near formations are big, far ones small (atmospheric depth) — but the
      // floor stays high. At weight 0.3 a far cluster's tip barely cleared the
      // cloud deck, so formations appeared to vanish and pop back in as the
      // ball passed them.
      const depth = 1 - t;
      // Near formations sit WIDER. The clusters are ~8 units across, so at the
      // old 5..11 they overlapped the corridor and crowded the landing path —
      // the reference keeps clear air between the tiles and the crystals.
      const spread = 9 + rnd() * 8 + (depth > 0.6 ? 2 : 0);
      const x = side * spread;
      // A cluster is a 3D clump (x/y/z all vary) and its SHAPE is picked at
      // random, so the field never repeats the same silhouette twice.
      const spec: ClusterSpec = {
        x,
        z,
        weight: 0.55 + depth * 0.45,
        shape: CLUSTER_SHAPES[Math.floor(rnd() * CLUSTER_SHAPES.length)],
        families: recipe.families,
        // Deep: crystals grow up out of the thick cloud, well below the tiles,
        // so the player reads "high above a cloud sea" instead of "crystals
        // floating at tile height".
        baseY: recipe.baseY - rnd() * 2.2
      };
      emitCluster(acc, spec, rnd);
    }
    const { face, shell } = bakeCluster(acc);
    // Unlit + vertex colours: the facet tones (cream/light/base/shade) ARE the
    // lighting, baked per facet against the key direction — exactly the
    // concept's flat colour blocks. Lighting on top only re-darkened facets.
    const faceMesh = new Mesh(face, new MeshBasicMaterial({ vertexColors: true, side: DoubleSide }));
    faceMesh.renderOrder = 2;
    // No crystal contour for now. Two implementations were tried and both are
    // parked in git history:
    //   * world-space expanded shell — over-expands along the normal near
    //     silhouettes, and ghosts through the cloud deck and platforms;
    //   * clip-space contour (makeContourMaterial) — depth-safe, but its
    //     screen expansion over-shoots and paints solid black masses.
    // A correct hairline needs a real post-process outline pass. Until that
    // exists the crystals render flat-coloured, which is clean and matches the
    // concept's colour blocks.
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


