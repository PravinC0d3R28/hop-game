import {
  AdditiveBlending,
  BackSide,
  BoxGeometry,
  DoubleSide,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  CanvasTexture,
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
import { buildDuskCity } from '../worlds/dusk/DuskCity';
import { buildVoidSky, tickVoidSky } from '../worlds/void/VoidSky';
import { buildVoidFieldSegments } from '../worlds/void/VoidField';

/** Segment length along +Z. */
/**
 * Segment length along +Z.
 *
 * This must comfortably exceed the mobile minimum formation depth. A portrait
 * phone only fits a full-size formation ~60 units out, so a 120-unit period
 * left the field occupying just the back half of every segment � crystals were
 * absent for the first 60 units of each period and then popped in when it
 * wrapped. 240 gives a ~180-unit live window on a phone and ~215 on a laptop,
 * so there is never a dead interval at the start of a cycle.
 */
const SEG_LEN = 240;
/**
 * Segments kept alive per layer. The camera can see `fogFar` (82) units of
 * haze plus its own offset, and it sits somewhere inside segment 0 of the
 * snapped range — 2 left a bare strip at the far end of the view.
 */
const SEG_COUNT = 3;

interface Layer {
  /** Meshes sharing one geometry (the set recycles as one chain). */
  meshes: LayerObject[];
  geo: BufferGeometry;
  bob: number;
}

/** Either drawable kind in a scenery layer: the crystal field mixes faces and
 *  facet-stroke lines in one recycled chain. */
type LayerObject = Mesh | LineSegments;

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
  /**
   * Objects that are not recycled segment layers: the sun-ray fan, and the
   * dusk skyline that stays a fixed distance ahead of the camera.
   */
  private extras: Group[] = [];
  /** Dusk horizon. Its local +Z points down the canyon; world Z tracks the camera. */
  private follow: Group | null = null;
  /** Deep Void sky. Pinned to the camera so the moon stays in the upper frame. */
  private skyAnchor: Group | null = null;

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
    if (look.sunRays) this.addSunRayLayer();
    for (const recipe of look.props) {
      if (recipe.family === 'crystalfield') {
        this.addCrystalLayer(recipe, cloud && cloud.family === 'cloudsea' ? cloud : null, look.platformEdge);
      } else if (recipe.family === 'cloudsea') this.addCloudLayer(recipe);
      else if (recipe.family === 'city') this.addCityLayer(look.platformEdge);
      else if (recipe.family === 'starfield' || recipe.family === 'crescent' || recipe.family === 'aurora') {
        if (!this.skyAnchor) this.addVoidSky();
      } else if (import.meta.env.DEV) {
        console.warn(`BackgroundSystem: no builder for prop family "${recipe.family}" yet — skipping`);
      }
      built++;
    }
    if (look.id === 'void') this.addVoidField();
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
    // A soft, tapered streak texture. Flat-coloured planes read as hard
    // rectangles hanging in the sky, which is exactly what the owner flagged;
    // the alpha has to fall off along the ray AND across its width.
    const tex = this.makeRayTexture();
    const g = new Group();
    const mat = new MeshBasicMaterial({
      map: tex,
      color: 0xffe8c0,
      transparent: true,
      opacity: 0.16,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
      fog: false
    });
    const rays = new Group();
    // All rays are children of one pivot placed up and to the LEFT of the
    // camera, each rotated a few degrees further, so they genuinely fan out of
    // the top-left corner instead of sitting as unrelated slabs.
    const pivot = new Group();
    pivot.position.set(-26, 16, -34);
    for (let i = 0; i < 6; i++) {
      const w = 5 + (i % 3) * 4;
      const len = 120 + (i % 4) * 26;
      const m = new Mesh(new PlaneGeometry(w, len), mat);
      // Pivot at the ray's top end so rotation swings the far end outward.
      m.geometry.translate(0, -len / 2, 0);
      m.position.set(0, 0, -i * 2);
      m.rotation.z = (-16 + i * 6.5) * (Math.PI / 180);
      pivot.add(m);
    }
    pivot.rotation.x = -0.34;
    rays.add(pivot);
    g.add(rays);
    this.trackExtra(g);
    this.rayGroup = rays;
  }

  /** Soft-edged ray texture: bright core, feathered on every edge. */
  private makeRayTexture(): CanvasTexture {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 256;
    const g = c.getContext('2d')!;
    const grad = g.createLinearGradient(0, 0, 0, 256);
    // Fades out at BOTH ends so the ray has no hard cap.
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.18, 'rgba(255,255,255,0.85)');
    grad.addColorStop(0.55, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 256);
    // Feather across the width.
    const side = g.createLinearGradient(0, 0, 64, 0);
    side.addColorStop(0, 'rgba(0,0,0,1)');
    side.addColorStop(0.5, 'rgba(0,0,0,0)');
    side.addColorStop(1, 'rgba(0,0,0,1)');
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = side;
    g.fillRect(0, 0, 64, 256);
    const tex = new CanvasTexture(c);
    return tex;
  }

  /** Crystal formations: one vertex-coloured mesh of the authored structures. */
  private addCrystalLayer(recipe: CrystalFieldRecipe, cloud: CloudSeaRecipe | null, edge: number): void {
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
    const { face } = bakeCluster(acc);
    const faceMesh = new Mesh(face, new MeshBasicMaterial({ vertexColors: true, side: DoubleSide }));
    // NO facet stroke, deliberately. Three implementations were tried:
    //   1. inverted hull  — ghosts through cloud and tiles (depth).
    //   2. LineSegments   — WebGL clamps line width to 1px, so it aliased into
    //                        invisible speckle.
    //   3. extruded bars  — real width, but a sub-pixel stroke on a distant
    //                        crystal resolves to floating dark scribbles with no
    //                        visible crystal behind them.
    // The concept gets this because its crystals fill the frame; ours are small
    // and distant, where a 1px-equivalent dark stroke is simply not resolvable.
    // The facet TONES (cream/light/base/shade) already read as low-poly facets.
    // A screen-space post-process outline is the only technique that would do
    // this properly, and that is deliberate follow-up work, not another tweak.
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
    const mesh = new Mesh(geo, new MeshBasicMaterial({ vertexColors: true, side: DoubleSide, transparent: true, opacity: 1 }));
    this.spawnLayer([mesh], recipe.parallax);
  }

  /**
   * Dusk canyon: one merged city per recycle chunk. Lanterns are part of
   * the buildings. Distance falls off through fog, the way Sunrise does.
   */
  private addCityLayer(edge: number): void {
    const built = buildDuskCity(this.seed, this.frame, SEG_LEN);
    const face = new Mesh(built.face, new MeshBasicMaterial({ vertexColors: true }));
    face.renderOrder = 2;
    this.spawnLayer([face], 0);

    const shell = new Mesh(built.shell, new MeshBasicMaterial({
      color: edge,
      depthWrite: false
    }));
    shell.renderOrder = 1;
    this.spawnLayer([shell], 0);

    const lamps = new Mesh(built.lanterns, new MeshBasicMaterial({ vertexColors: true }));
    lamps.renderOrder = 3;
    this.spawnLayer([lamps], 0);

    const glows = new Mesh(built.glows, new MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.4,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide
    }));
    glows.renderOrder = 4;
    this.spawnLayer([glows], 0);

    const mist = new Mesh(built.mist, new MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      side: DoubleSide
    }));
    mist.renderOrder = 5;
    this.spawnLayer([mist], 0);

  }

  /**
   * Recycled scenery for the live segments. A wide frame adds the farther
   * band. A phone keeps that band out. The gate segment leaves a gap
   * around the ring.
   */
  private addVoidField(): void {
    const portrait = this.frame.aspect < 1;
    const geos = buildVoidFieldSegments(this.seed, SEG_COUNT, portrait);
    const mat = new MeshBasicMaterial({ vertexColors: true });
    const meshes: Mesh[] = [];
    for (let k = 0; k < geos.length; k++) {
      const mesh = new Mesh(geos[k], mat);
      mesh.position.z = k * SEG_LEN;
      mesh.renderOrder = 2;
      mesh.frustumCulled = false;
      this.root.add(mesh);
      meshes.push(mesh);
    }
    this.layers.push({ meshes, geo: geos[0], bob: 0 });
  }

  /** Aurora, stars, constellations, and the crescent. One group, camera-locked. */
  private addVoidSky(): void {
    const anchor = new Group();
    anchor.name = 'void-sky-anchor';
    anchor.add(buildVoidSky());
    this.trackExtra(anchor);
    this.skyAnchor = anchor;
  }

  /** Parent a non-recycled group (sun rays, dusk horizon, void sky) and remember it for disposal. */
  private trackExtra(group: Group): void {
    this.root.add(group);
    this.extras.push(group);
  }

  private spawnLayer(meshes: LayerObject[], bob: number): void {
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
  update(camZ: number, now: number, camX = 0, camY = 9.5): void {
    const seg = Math.floor(camZ / SEG_LEN);
    for (const layer of this.layers) {
      const span = layer.meshes.length;
      layer.meshes.forEach((m, i) => {
        // Mesh i owns segments i, i+span, i+2span... It stays there until the
        // camera has passed it, then jumps forward by one full cycle. Identical
        // copies still tile. A segment with its own pieces is not swapped out
        // from under the ball.
        let place = i;
        if (span > 0) while (place < seg) place += span;
        m.position.z = place * SEG_LEN;
      });
      if (layer.bob > 0) {
        // Parallax drift: distant layers breathe very slowly so the world never
        // feels frozen (kept well below tile sway).
        const y = Math.sin(now * 0.00018) * 0.25 * layer.bob;
        for (const m of layer.meshes) m.position.y = y;
      }
    }
    if (this.rayGroup) {
      // Slow sway so the light is alive without ever distracting from play.
      this.rayGroup.rotation.y = Math.sin(now * 0.00004) * 0.09;
      this.rayGroup.position.z = Math.sin(now * 0.00003) * 3;
    }
    // The dusk skyline is authored ahead of the origin. Pinning the group to
    // the camera keeps that lead constant, so the sunset is never reached.
    if (this.follow) this.follow.position.z = camZ;
    if (this.skyAnchor) {
      this.skyAnchor.position.set(camX, camY, camZ);
      tickVoidSky(this.skyAnchor, now);
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
    this.clearExtras();
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

  private clearExtras(): void {
    for (const group of this.extras) {
      this.root.remove(group);
      group.traverse((obj) => {
        const mesh = obj as Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry?.dispose();
        const mat = mesh.material;
        if (!mat || Array.isArray(mat)) return;
        const mapped = mat as MeshBasicMaterial;
        mapped.map?.dispose();
        mapped.dispose();
      });
    }
    this.extras = [];
    this.rayGroup = null;
    this.follow = null;
    this.skyAnchor = null;
  }
}





















