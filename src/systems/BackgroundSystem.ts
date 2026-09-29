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
import { bakeSegment, emptyAcc, emitFormation, makeRng, type FormationSpec } from './CrystalFactory';
import { buildCloudSea } from './CloudFactory';
import type { CrystalFieldRecipe, CloudSeaRecipe, WorldLook } from '../config/WorldLooks';

/** Segment length along +Z. Seams land beyond the fog far plane, so the
 *  repeated formation layout is never visible. */
const SEG_LEN = 70;
/** Segments kept alive per layer. */
const SEG_COUNT = 2;

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
      // Near formations are big, far ones small (atmospheric depth).
      const depth = 1 - t;
      // Near formations sit wider (the concept's biggest clusters hug the
      // frame edges) so nothing crowds the landing corridor in 9:16.
      const spread = CORRIDOR + 1.6 + rnd() * 4.6 + (depth > 0.6 ? 1.4 : 0);
      const x = side * spread;
      // A cluster shows the WHOLE palette: every formation hands the emitter
      // the full family list and each crystal inside takes the next one, the
      // way the concept mixes coral + peach + mint + gold side by side.
      const spec: FormationSpec = {
        x,
        z,
        weight: 0.3 + depth * 0.7,
        families: recipe.families,
        count: recipe.perFormation,
        // Buried base: crystals emerge from the cloud sea, not float in sky.
        baseY: -1.2 - rnd() * 0.9
      };
      emitFormation(acc, spec, rnd);
    }
    const { face, hull } = bakeSegment(acc);
    // MeshBasic + vertex colours: the facet tones (cream/light/base/shade) are
    // ALREADY the lighting, baked per facet against the key direction — which
    // is exactly the concept's flat colour blocks. A lit toon material on top
    // of that only re-darkened some facets to near-black; unlit makes the
    // palette deterministic and the draw cheaper.
    const faceMesh = new Mesh(face, new MeshBasicMaterial({ vertexColors: true, side: DoubleSide }));
    const hullMesh = new Mesh(hull, new MeshBasicMaterial({ color: edge, side: BackSide }));
    // One layer = both meshes, so they recycle in lockstep at the same slot.
    this.spawnLayer([faceMesh, hullMesh], 0);
  }

  /** The cloud blanket: one vertex-coloured mesh, no outlines. */
  private addCloudLayer(recipe: CloudSeaRecipe): void {
    const geo = buildCloudSea({
      length: SEG_LEN,
      spread: recipe.spread,
      top: recipe.top,
      depth: recipe.depth,
      density: recipe.density,
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
