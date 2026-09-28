// Week 2 Day 1: crystal generator guards — preset mapping, deterministic
// color choice, and geometry sanity (all headless-safe, no WebGL).
import { describe, it, expect } from 'vitest';
import {
  chooseBaseColor,
  createCrystal,
  getCrystalPreset,
  presetForScale
} from '../src/systems/CrystalFactory';

describe('presetForScale', () => {
  it('alternates tall/chunky for large, medium, then shard', () => {
    expect(presetForScale(1.5, 0)).toBe('tall');
    expect(presetForScale(1.5, 1)).toBe('chunky');
    expect(presetForScale(1.2, 4)).toBe('tall');
    expect(presetForScale(1.0, 0)).toBe('medium');
    expect(presetForScale(0.8, 3)).toBe('medium');
    expect(presetForScale(0.5, 0)).toBe('shard');
  });
});

describe('chooseBaseColor', () => {
  it('picks one deterministic entry per crystal (never blends)', () => {
    const set = [0xff6f70, 0xffb07a, 0xffc27e];
    expect(chooseBaseColor(set, 0)).toBe(0xff6f70);
    expect(chooseBaseColor(set, 0.5)).toBe(0xffb07a);
    expect(chooseBaseColor(set, 0.99)).toBe(0xffc27e);
    expect(chooseBaseColor([], 0.5)).toBe(0xffffff);
  });
});

describe('crystal geometry', () => {
  it('every preset is a closed non-indexed triangle soup (faceted)', () => {
    for (const name of ['tall', 'chunky', 'medium', 'shard'] as const) {
      const pos = getCrystalPreset(name).geo.getAttribute('position');
      expect(pos.count).toBeGreaterThan(0);
      expect(pos.count % 3).toBe(0);
    }
  });

  it('createCrystal pairs one face mesh + one hull on shared geometry', () => {
    const group = createCrystal(getCrystalPreset('medium'), 0xff6f70, 0x3b302d);
    expect(group.children.length).toBe(2);
    const [face, hull] = group.children as unknown as [{ geometry: unknown }, { geometry: unknown }];
    expect(face.geometry).toBe(hull.geometry);
  });

  it('side-face normals point outward (inward winding rendered hull-only black)', () => {
    for (const name of ['tall', 'chunky', 'medium', 'shard'] as const) {
      const pos = getCrystalPreset(name).geo.getAttribute('position') as unknown as {
        count: number;
        getX(i: number): number;
        getY(i: number): number;
        getZ(i: number): number;
      };
      let checked = 0;
      for (let t = 0; t < pos.count; t += 3) {
        const ax = pos.getX(t); const ay = pos.getY(t); const az = pos.getZ(t);
        const bx = pos.getX(t + 1); const by = pos.getY(t + 1); const bz = pos.getZ(t + 1);
        const cx = pos.getX(t + 2); const cy = pos.getY(t + 2); const cz = pos.getZ(t + 2);
        // Recompute the face normal independently (AB × AC).
        const e1 = [bx - ax, by - ay, bz - az];
        const e2 = [cx - ax, cy - ay, cz - az];
        const n = [
          e1[1] * e2[2] - e1[2] * e2[1],
          e1[2] * e2[0] - e1[0] * e2[2],
          e1[0] * e2[1] - e1[1] * e2[0]
        ];
        const len = Math.hypot(n[0], n[1], n[2]);
        expect(len).toBeGreaterThan(1e-6);
        // Near-horizontal faces are caps/tips (axial check); steep faces are
        // sides (radial-outward check).
        const cx0 = (ax + bx + cx) / 3;
        const cy0 = (ay + by + cy) / 3;
        const cz0 = (az + bz + cz) / 3;
        const ny = n[1] / len;
        if (Math.abs(ny) > 0.75) {
          if (cy0 < 0.01) expect(ny).toBeLessThan(0); // base cap points down
          else expect(ny).toBeGreaterThan(0); // tip fan points up
          checked++;
          continue;
        }
        // Side faces: centroid well off-axis, normal must agree with radial dir.
        const rad = Math.hypot(cx0, cz0);
        if (rad > 0.2) {
          const dot = (n[0] * cx0 + n[2] * cz0) / (len * rad);
          expect(dot).toBeGreaterThan(0.5);
          checked++;
        }
      }
      expect(checked).toBeGreaterThan(0);
    }
  });
});
