import { BackSide, ConeGeometry, Group, Mesh, MeshBasicMaterial, SphereGeometry, type Scene } from 'three';
import { MaterialFactory } from './MaterialFactory';
import { chooseBaseColor, createCrystal, getCrystalPreset, presetForScale } from './CrystalFactory';
import type { PropRecipe, WorldLook } from '../config/WorldLooks';

const BG_SPACING = 5; // `iu`
const BG_OFFSET = 4; // `ru`
/** Initial props wrap into this z-window (4..34); recycle extends past it. */
const BG_WINDOW = 34;
/** Highest slot index inside the window (slots 0..6). */
const BG_MAX_SLOT = 6;

interface ClusterData {
  baseX: number;
  baseY: number;
  side: number;
  index: number;
  parallax: number;
}

// Shared unit geometries: instances only ever scale them, so one cone and
// one sphere serve every prop (dispose() frees materials, never these).
const ridgeGeo = new ConeGeometry(1, 1, 4);
const cloudGeo = new SphereGeometry(1, 12, 8);

/**
 * Layered paper props for the active world look (Week 2 §10).
 * Built from WorldLook recipes — ridge + cloud families now; city, lantern,
 * crescent, starfield and aurora arrive with the Dusk/Void passes (skipped
 * with a dev-only warning until then, never a crash, never a console warning
 * in production). Z-recycling + bob are unchanged from the rock era.
 */
export class BackgroundSystem {
  private groups: Group[] = [];
  private ms: number;
  /** Hull color for fresh builds (the active look's edge — spike lock warmed). */
  private edge = 0x111111;

  constructor(private scene: Scene) {
    this.ms = -1;
  }

  init(): void {
    // Props arrive via setLook (Game applies the active world right after).
    this.ms = -1;
  }

  /** Rebuild the scenery from a world's prop recipes (select/preview/run). */
  setLook(look: WorldLook): void {
    this.clearGroups();
    this.edge = look.platformEdge;
    let index = 0;
    for (const recipe of look.props) {
      for (let k = 0; k < recipe.count; k++, index++) {
        switch (recipe.family) {
          case 'ridge':
            this.groups.push(this.createRidge(recipe, index, k));
            break;
          case 'cloud':
            this.groups.push(this.createCloud(recipe, index, k));
            break;
          case 'crystal':
            this.groups.push(this.createCrystalProp(recipe, index, k));
            break;
          case 'cloudbank':
            this.groups.push(this.createCloudbank(recipe, index, k));
            break;
          default:
            // NFR-3: normal play must stay warning-free — only dev builds nag.
            if (import.meta.env.DEV) {
              console.warn(`BackgroundSystem: no builder for prop family "${recipe.family}" yet — skipping`);
            }
            index--;
            break;
        }
      }
    }
    this.ms = BG_MAX_SLOT;
  }

  /** z-slot inside the initial window (recycle continues past it). */
  private slotZ(index: number): number {
    return BG_OFFSET + ((index * BG_SPACING) % BG_WINDOW);
  }

  /** Paper mountain: squashed 4-sided pyramid + edge hull (reserved: Dusk hills). */
  private createRidge(recipe: PropRecipe, index: number, k: number): Group {
    const color = recipe.colors[k % recipe.colors.length];
    const group = new Group();
    const mesh = new Mesh(ridgeGeo, MaterialFactory.createMaterial(color));
    const s = recipe.scaleMin + Math.random() * (recipe.scaleMax - recipe.scaleMin);
    mesh.scale.set(2.6 * s, 4.2 * s, 2.6 * s);
    mesh.rotation.y = Math.PI / 4;
    group.add(mesh);

    const hull = new Mesh(ridgeGeo, new MeshBasicMaterial({ color: this.edge, side: BackSide }));
    hull.scale.copy(mesh.scale).multiplyScalar(1.04);
    hull.rotation.y = Math.PI / 4;
    group.add(hull);

    this.place(group, recipe, index, mesh.scale.y / 2 - 0.6);
    this.scene.add(group);
    return group;
  }

  /** Cloud cutout: three flattened puffs + shared hull material. */
  private createCloud(recipe: PropRecipe, index: number, k: number): Group {
    const color = recipe.colors[k % recipe.colors.length];
    const group = new Group();
    const hullMat = new MeshBasicMaterial({ color: this.edge, side: BackSide });
    const s = recipe.scaleMin + Math.random() * (recipe.scaleMax - recipe.scaleMin);
    for (let u = 0; u < 3; u++) {
      const mesh = new Mesh(cloudGeo, MaterialFactory.createMaterial(color));
      mesh.position.set((u - 1) * 0.9 * s, (u % 2) * 0.25, 0);
      mesh.scale.set(s, s * 0.45, s * 0.7);
      group.add(mesh);

      const hull = new Mesh(cloudGeo, hullMat);
      hull.position.copy(mesh.position);
      hull.scale.copy(mesh.scale).multiplyScalar(1.04);
      group.add(hull);
    }
    this.place(group, recipe, index, 4.5 + Math.random() * 2);
    this.scene.add(group);
    return group;
  }

  /**
   * Sunrise crystal: one base color from the recipe's related set (never a
   * rainbow), preset by size class, slight tilt + spin. Placement keeps the
   * landing corridor clear: large far-sides, medium mid-sides, small
   * near-edges (some floating high).
   */
  private createCrystalProp(recipe: PropRecipe, index: number, k: number): Group {
    const s = recipe.scaleMin + Math.random() * (recipe.scaleMax - recipe.scaleMin);
    const color = chooseBaseColor(recipe.colors, Math.random());
    const group = createCrystal(getCrystalPreset(presetForScale(s, k)), color, this.edge);
    group.scale.setScalar(s);
    group.rotation.y = Math.random() * Math.PI * 2;
    group.rotation.z = (Math.random() - 0.5) * 0.14;
    const side = index % 2 === 0 ? -1 : 1;
    let x: number;
    let y: number;
    if (s >= 1.2) {
      x = side * (6.5 + Math.random() * 3.5);
      y = -0.5;
    } else if (s >= 0.8) {
      x = side * (4.8 + Math.random() * 2.7);
      y = -0.3;
    } else {
      x = side * (4.5 + Math.random() * 4.5);
      y = Math.random() < 0.3 ? 2 + Math.random() * 2.5 : -0.2;
    }
    const z = this.slotZ(index);
    group.position.set(x, y, z);
    group.userData = { baseX: x, baseY: y, side, index, parallax: recipe.parallax };
    this.scene.add(group);
    return group;
  }

  /**
   * Cloud sea bank: 4–5 flattened hull-free puffs the crystals emerge from.
   * Owner pick: no hulls (soft, airy, cheaper). Banks stay low and off the
   * near-center corridor; far-center banks read as fogged depth.
   */
  private createCloudbank(recipe: PropRecipe, index: number, k: number): Group {
    const group = new Group();
    const n = 4 + (k % 2);
    const s = recipe.scaleMin + Math.random() * (recipe.scaleMax - recipe.scaleMin);
    for (let u = 0; u < n; u++) {
      const mesh = new Mesh(cloudGeo, MaterialFactory.createMaterial(recipe.colors[u % recipe.colors.length]));
      mesh.position.set(
        (u - n / 2) * 1.1 * s + (Math.random() - 0.5) * 0.4,
        (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 0.8
      );
      mesh.scale.set(s * 1.4, s * 0.55, s);
      group.add(mesh);
    }
    const z = this.slotZ(index);
    const far = z > 20;
    const side = index % 2 === 0 ? -1 : 1;
    const x = far ? (Math.random() - 0.5) * 14 : side * (3.5 + Math.random() * 4.5);
    const y = -0.8 + Math.random() * 1.0;
    group.position.set(x, y, z);
    group.userData = { baseX: x, baseY: y, side: Math.sign(x) || side, index, parallax: recipe.parallax };
    this.scene.add(group);
    return group;
  }

  private place(group: Group, recipe: PropRecipe, index: number, y: number): void {
    let side = 0;
    let x = 0;
    if (recipe.side === 'sky') {
      x = (Math.random() - 0.5) * 9;
    } else {
      side = recipe.side === 'left' ? -1 : recipe.side === 'right' ? 1 : index % 2 === 0 ? -1 : 1;
      x = side * (6 + Math.random() * 3);
    }
    const z = this.slotZ(index);
    group.position.set(x, y, z);
    group.userData = { baseX: x, baseY: y, side, index, parallax: recipe.parallax };
  }

  private clearGroups(): void {
    for (const g of this.groups) {
      // Materials are per-prop instances; geometries are shared singletons.
      g.traverse((child) => {
        if ((child as Mesh).isMesh) {
          const m = (child as Mesh).material;
          if (!Array.isArray(m)) m?.dispose();
        }
      });
      this.scene.remove(g);
    }
    this.groups = [];
  }

  /** Mirror `My` + `Sy`: bob each cluster, recycle those behind the camera. */
  update(camZ: number): void {
    const now = Date.now() * 0.001;
    for (const group of this.groups) {
      const d = group.userData as ClusterData;
      group.position.y = d.baseY + Math.sin(now * 0.3 + d.index * 1.5) * 0.15;
    }
    this.recycle(camZ);
  }

  private recycle(camZ: number): void {
    // Advance depth only — x/y keep the prop's placement character.
    for (const group of this.groups) {
      if (group.position.z < camZ - 10) {
        this.ms++;
        const d = group.userData as ClusterData;
        const z = this.ms * BG_SPACING + BG_OFFSET;
        group.position.set(group.position.x, d.baseY, z);
        group.userData = { ...d, index: this.ms };
      }
    }
  }

  /** Show/hide all clusters (spike scenes swap rocks for paper props). */
  setVisible(v: boolean): void {
    for (const group of this.groups) group.visible = v;
  }

  /**
   * Reset for a new run: re-slot depths into the start window, preserving
   * each prop's x/y placement character (crystal corridors, bank heights).
   */
  reset(): void {
    this.ms = BG_MAX_SLOT;
    this.groups.forEach((group, t) => {
      const d = group.userData as ClusterData;
      group.position.set(group.position.x, d.baseY, this.slotZ(t));
      group.userData = { ...d, index: t };
    });
  }

  /** Live prop groups (hull recolor + inspection). */
  getGroups(): Group[] {
    return this.groups;
  }

  dispose(): void {
    for (const g of this.groups) {
      g.traverse((child) => {
        if ((child as Mesh).isMesh) {
          const m = (child as Mesh).material;
          if (!Array.isArray(m)) m?.dispose();
        }
      });
      this.scene.remove(g);
    }
    this.groups = [];
  }
}
