// Week 2 Day 1 — procedural Sunrise crystal generator (§6-8 of the
// Sunrise implementation doc).
//
// One geometry language: hexagonal prism rings (base → mid → shoulder) closed
// by an apex, built non-indexed so computeVertexNormals yields flat facets.
// Four shared presets (tall / chunky / medium / shard) cover every instance —
// callers vary scale, tilt and spin, never geometry. Facet variation comes
// from the toon ramp + directional light (palette Rule F), with one base
// color per crystal from a related 2–4 color set (never rainbow).
import {
  BackSide,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial
} from 'three';
import { MaterialFactory } from '../systems/MaterialFactory';

export type CrystalPresetName = 'tall' | 'chunky' | 'medium' | 'shard';

interface CrystalPreset {
  name: CrystalPresetName;
  geo: BufferGeometry;
}

/** Deterministic wobble so crystals feel hand-built, not mathematical. */
function jitterRing(seed: number, i: number): number {
  return 1 + 0.06 * Math.sin(seed * 12.9898 + i * 78.233);
}

function hexRing(radius: number, y: number, phase: number, sides: number): number[][] {
  const pts: number[][] = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2 + phase;
    const rr = radius * jitterRing(y * 10 + phase, i);
    pts.push([Math.cos(a) * rr, y, Math.sin(a) * rr]);
  }
  return pts;
}

/** Hex prism (base/mid/shoulder) + apex + base cap. DoubleSide: winding-independent. */
function buildCrystalGeo(radius: number, height: number, taper: number, sides = 6): BufferGeometry {
  const r0 = hexRing(radius, 0, 0, sides);
  const r1 = hexRing(radius * 1.02, height * 0.55, 0.1, sides);
  const r2 = hexRing(radius * taper, height * 0.78, 0.2, sides);
  const apex = [0, height, 0];
  const base = [0, 0, 0];
  const tris: number[] = [];
  // Outward winding (verified: reversed from the inward first draft that
  // rendered hull-only black). Quad (a,b,c,d) → (a,c,b) + (a,d,c).
  const quad = (a: number[], b: number[], c: number[], d: number[]): void => {
    tris.push(...a, ...c, ...b, ...a, ...d, ...c);
  };
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides;
    quad(r0[i], r0[j], r1[j], r1[i]);
    quad(r1[i], r1[j], r2[j], r2[i]);
    tris.push(...r2[j], ...r2[i], ...apex);
    tris.push(...base, ...r0[i], ...r0[j]);
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(tris, 3));
  geo.computeVertexNormals();
  return geo;
}

const PRESETS: Record<CrystalPresetName, CrystalPreset> = {
  tall: { name: 'tall', geo: buildCrystalGeo(0.55, 4.6, 0.5) },
  chunky: { name: 'chunky', geo: buildCrystalGeo(0.95, 2.8, 0.62) },
  medium: { name: 'medium', geo: buildCrystalGeo(0.6, 3.2, 0.55) },
  shard: { name: 'shard', geo: buildCrystalGeo(0.35, 2.1, 0.45) }
};

/** Preset by instance scale: large alternates tall/chunky, else medium/shard. Pure. */
export function presetForScale(s: number, k: number): CrystalPresetName {
  if (s >= 1.2) return k % 2 === 0 ? 'tall' : 'chunky';
  if (s >= 0.8) return 'medium';
  return 'shard';
}

export function getCrystalPreset(name: CrystalPresetName): CrystalPreset {
  return PRESETS[name];
}

/** One base color per crystal from its related set (r in [0,1)). Pure. */
export function chooseBaseColor(colors: number[], r: number): number {
  const list = colors.length > 0 ? colors : [0xffffff];
  return list[Math.floor(r * list.length) % list.length];
}

/** A crystal = face mesh + edge hull sharing the preset geometry (2 draws). */
export function createCrystal(preset: CrystalPreset, color: number, edge: number): Group {
  const group = new Group();
  group.add(new Mesh(preset.geo, MaterialFactory.createMaterial(color)));
  const hull = new Mesh(preset.geo, new MeshBasicMaterial({ color: edge, side: BackSide }));
  hull.scale.multiplyScalar(1.04);
  group.add(hull);
  return group;
}
