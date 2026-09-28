import { BackSide, ConeGeometry, Group, Mesh, MeshBasicMaterial, SphereGeometry, type Scene } from 'three';
import { MaterialFactory } from './MaterialFactory';
import type { PropRecipe, WorldLook } from '../config/WorldLooks';

const BG_SPACING = 5; // `iu`
const BG_OFFSET = 4; // `ru`

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
    let index = 0;
    for (const recipe of look.props) {
      if (recipe.family !== 'ridge' && recipe.family !== 'cloud') {
        // NFR-3: normal play must stay warning-free — only dev builds nag.
        if (import.meta.env.DEV) {
          console.warn(`BackgroundSystem: no builder for prop family "${recipe.family}" yet — skipping`);
        }
        continue;
      }
      for (let k = 0; k < recipe.count; k++, index++) {
        this.groups.push(
          recipe.family === 'ridge'
            ? this.createRidge(recipe, index, k)
            : this.createCloud(recipe, index, k)
        );
      }
    }
    this.ms = this.groups.length - 1;
  }

  /** Paper mountain: squashed 4-sided pyramid + black hull (spike lock). */
  private createRidge(recipe: PropRecipe, index: number, k: number): Group {
    const color = recipe.colors[k % recipe.colors.length];
    const group = new Group();
    const mesh = new Mesh(ridgeGeo, MaterialFactory.createMaterial(color));
    const s = recipe.scaleMin + Math.random() * (recipe.scaleMax - recipe.scaleMin);
    mesh.scale.set(2.6 * s, 4.2 * s, 2.6 * s);
    mesh.rotation.y = Math.PI / 4;
    group.add(mesh);

    const hull = new Mesh(ridgeGeo, new MeshBasicMaterial({ color: 0x111111, side: BackSide }));
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
    const hullMat = new MeshBasicMaterial({ color: 0x111111, side: BackSide });
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

  private place(group: Group, recipe: PropRecipe, index: number, y: number): void {
    let side = 0;
    let x = 0;
    if (recipe.side === 'sky') {
      x = (Math.random() - 0.5) * 9;
    } else {
      side = recipe.side === 'left' ? -1 : recipe.side === 'right' ? 1 : index % 2 === 0 ? -1 : 1;
      x = side * (6 + Math.random() * 3);
    }
    const z = index * BG_SPACING + BG_OFFSET;
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
    for (const group of this.groups) {
      if (group.position.z < camZ - 10) {
        this.ms++;
        const index = this.ms;
        const z = index * BG_SPACING + BG_OFFSET;
        const y = 1 + Math.random() * 3;
        const side = index % 2 === 0 ? -1 : 1;
        const x = side * (6 + Math.random() * 3);
        group.position.set(x, y, z);
        group.userData = { baseX: x, baseY: y, side, index };
      }
    }
  }

  /** Show/hide all clusters (spike scenes swap rocks for paper props). */
  setVisible(v: boolean): void {
    for (const group of this.groups) group.visible = v;
  }

  /** Reset for a new run: reposition the current prop set (empty-safe). */
  reset(): void {
    this.ms = this.groups.length - 1;
    this.groups.forEach((group, t) => {
      const side = t % 2 === 0 ? -1 : 1;
      const x = side * (6 + Math.random() * 3);
      const z = t * BG_SPACING + BG_OFFSET;
      const y = 1 + Math.random() * 3;
      group.position.set(x, y, z);
      group.userData = { baseX: x, baseY: y, side, index: t };
    });
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
