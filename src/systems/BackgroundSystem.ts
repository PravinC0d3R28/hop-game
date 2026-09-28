import { BackSide, Group, Mesh, MeshBasicMaterial, SphereGeometry, type Scene } from 'three';
import { THEMES, type ThemeName } from '../config/Themes';
import { MaterialFactory } from './MaterialFactory';

const BG_CLUSTERS = 10;
const BG_SPACING = 5; // `iu`
const BG_OFFSET = 4; // `ru`

interface ClusterData {
  baseX: number;
  baseY: number;
  side: number;
  index: number;
}

/**
 * Floating rock clusters in the background.
 * Faithful port of the original `vy` / `Sy` / `My` / `fy`.
 * 10 clusters of 2-4 halftone-toon spheres + outlines, bobbing and recycling.
 */
export class BackgroundSystem {
  private groups: Group[] = [];
  private ms: number;

  constructor(
    private scene: Scene,
    private getTheme: () => ThemeName
  ) {
    this.ms = BG_CLUSTERS - 1; // `nu - 1`
  }

  init(): void {
    for (let i = 0; i < BG_CLUSTERS; i++) this.groups.push(this.createCluster(i));
  }

  private createCluster(index: number): Group {
    const theme = this.getTheme();
    const palettes = THEMES[theme].decorations;
    const color = palettes[index % palettes.length];
    const material = MaterialFactory.createMaterial(color);

    const group = new Group();
    const count = 2 + (index % 3); // 2-4 spheres
    const geo = new SphereGeometry(1, 12, 8);
    const outlineMat = new MeshBasicMaterial({ color: 0x111111, side: BackSide });

    for (let u = 0; u < count; u++) {
      const radius = 0.7 + Math.random() * 0.5;
      const scaleY = 0.55 + Math.random() * 0.25;
      const mesh = new Mesh(geo, material);
      mesh.position.set((u - count / 2) * 0.8, (Math.random() - 0.3) * 0.3, (Math.random() - 0.5) * 0.4);
      mesh.scale.set(radius, radius * scaleY, radius);
      group.add(mesh);

      const outline = new Mesh(geo, outlineMat);
      outline.position.copy(mesh.position);
      outline.scale.copy(mesh.scale).multiplyScalar(1.04);
      group.add(outline);
    }

    const side = index % 2 === 0 ? -1 : 1;
    const x = side * (6 + Math.random() * 3);
    const z = index * BG_SPACING + BG_OFFSET;
    const y = 1 + Math.random() * 3;
    group.position.set(x, y, z);
    group.userData = { baseX: x, baseY: y, side, index };
    this.scene.add(group);
    return group;
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

  /** Mirror `fy`: recolor non-outline materials per theme. */
  recolor(): void {
    const theme = this.getTheme();
    const palettes = THEMES[theme].decorations;
    this.groups.forEach((group, e) => {
      const color = palettes[e % palettes.length];
      group.traverse((child) => {
        if ((child as Mesh).isMesh) {
          const m = (child as Mesh).material;
          if (Array.isArray(m)) return;
          if (m && m.type !== 'MeshBasicMaterial') {
            (m as unknown as { color: { setHex(n: number): void } }).color.setHex(color);
          }
        }
      });
    });
  }

  reset(): void {
    this.ms = BG_CLUSTERS - 1;
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
