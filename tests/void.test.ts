import { describe, it, expect } from 'vitest';
import { MeshBasicMaterial, MeshToonMaterial } from 'three';
import { PlatformEntity, type PlatformData } from '../src/entities/PlatformEntity';
import {
  VOID_CONSTELLATIONS,
  VOID_MOON,
  buildVoidSky,
  voidCameraFrame,
  voidSkyPoint
} from '../src/worlds/void/VoidSky';
import {
  VOID_GATES,
  buildGateVariation,
  buildVoidGateSegments,
  gateClearsPlay
} from '../src/worlds/void/VoidGates';
import {
  VOID_ORBITS,
  VOID_PLANETS,
  buildOrbitVariation,
  buildPlanetVariation,
  buildVoidOrbitSegments,
  buildVoidPlanetSegments,
  planetStaysBeside
} from '../src/worlds/void/VoidPlanets';
import {
  VOID_ISLANDS,
  buildIslandVariation,
  buildVoidIslandSegments,
  islandStaysBeside
} from '../src/worlds/void/VoidIslands';
import { VOID_RIM, VOID_RIM_MAGENTA, VOID_RIM_VIOLET, VOID_TILES, voidRimColor } from '../src/worlds/void/VoidPalette';
import {
  VOID_MONOLITHS,
  buildMonolithVariation,
  buildVoidMonolithSegments,
  monolithStaysBeside
} from '../src/worlds/void/VoidMonoliths';
import {
  buildVoidFieldSegment,
  fieldClearsPlay,
  planVoidSegment,
  type VoidPlacement
} from '../src/worlds/void/VoidField';

/** Share of triangles whose normal points away from the mesh center. */
function outwardShare(geo: { getAttribute(name: string): { count: number; getX(i: number): number; getY(i: number): number; getZ(i: number): number } }): number {
  const pos = geo.getAttribute('position');
  let cx = 0;
  let cy = 0;
  let cz = 0;
  for (let i = 0; i < pos.count; i++) {
    cx += pos.getX(i);
    cy += pos.getY(i);
    cz += pos.getZ(i);
  }
  cx /= pos.count;
  cy /= pos.count;
  cz /= pos.count;
  let out = 0;
  const tris = pos.count / 3;
  for (let i = 0; i < pos.count; i += 3) {
    const ax = pos.getX(i);
    const ay = pos.getY(i);
    const az = pos.getZ(i);
    const bx = pos.getX(i + 1);
    const by = pos.getY(i + 1);
    const bz = pos.getZ(i + 1);
    const cx2 = pos.getX(i + 2);
    const cy2 = pos.getY(i + 2);
    const cz2 = pos.getZ(i + 2);
    const nx = (by - ay) * (cz2 - az) - (bz - az) * (cy2 - ay);
    const ny = (bz - az) * (cx2 - ax) - (bx - ax) * (cz2 - az);
    const nz = (bx - ax) * (cy2 - ay) - (by - ay) * (cx2 - ax);
    const mx = (ax + bx + cx2) / 3 - cx;
    const my = (ay + by + cy2) / 3 - cy;
    const mz = (az + bz + cz2) / 3 - cz;
    if (nx * mx + ny * my + nz * mz > 0) out++;
  }
  return out / tris;
}

describe('Deep Void sky', () => {
  it('puts the crescent in the upper frame, not on the look direction', () => {
    const up = voidCameraFrame().up;
    const moon = voidSkyPoint(VOID_MOON.right, VOID_MOON.lift, VOID_MOON.dist);
    expect(moon.dot(up)).toBeGreaterThan(12);
    expect(VOID_MOON.lift).toBeGreaterThan(10);
  });

  it('draws a few short constellations, not a grid', () => {
    expect(VOID_CONSTELLATIONS.length).toBeGreaterThanOrEqual(3);
    expect(VOID_CONSTELLATIONS.length).toBeLessThanOrEqual(12);
    for (const figure of VOID_CONSTELLATIONS) {
      expect(figure.stars.length).toBeGreaterThanOrEqual(3);
      expect(figure.stars.length).toBeLessThanOrEqual(6);
    }
    const tones = new Set(VOID_CONSTELLATIONS.map((f) => f.tone));
    expect(tones.has('warm')).toBe(true);
    expect(tones.has('cool')).toBe(true);
  });

  it('builds one moon, one aurora, and a star field', () => {
    const sky = buildVoidSky();
    expect(sky.getObjectByName('moon')).toBeTruthy();
    expect(sky.getObjectByName('moon-halo')).toBeTruthy();
    expect(sky.getObjectByName('aurora')).toBeTruthy();
    expect(sky.getObjectByName('stars')).toBeTruthy();
    expect(sky.getObjectByName('constellations')).toBeTruthy();
    const moons = sky.children.flatMap((child) => {
      const found: string[] = [];
      child.traverse((obj) => {
        if (obj.name === 'moon') found.push(obj.name);
      });
      return found;
    });
    expect(moons).toHaveLength(1);
  });
});

describe('Deep Void gate rings', () => {
  it('authors a few finished circles, each with at most three real gaps', () => {
    expect(VOID_GATES.length).toBeGreaterThanOrEqual(3);
    expect(VOID_GATES.length).toBeLessThanOrEqual(5);
    for (const gate of VOID_GATES) {
      expect(gate.gaps.length).toBeGreaterThan(0);
      expect(gate.gaps.length).toBeLessThanOrEqual(3);
      for (const gap of gate.gaps) expect(gap.width).toBeGreaterThan(0.4);
      const top = gate.gaps.find((gap) => {
        let d = Math.abs(gap.at - Math.PI / 2) % (Math.PI * 2);
        if (d > Math.PI) d = Math.PI * 2 - d;
        return d < 0.35;
      });
      expect(top, gate.id).toBeTruthy();
      expect(top!.width, gate.id).toBeGreaterThanOrEqual(1.9);
    }
  });

  it('keeps every block and chip out of the hop volume', () => {
    for (const gate of VOID_GATES) {
      expect(gateClearsPlay(buildGateVariation(gate)), gate.id).toBe(true);
    }
  });

  it('repeats the same segment set for the same seed', () => {
    const a = buildVoidGateSegments(11, 3);
    const b = buildVoidGateSegments(11, 3);
    expect(a).toHaveLength(3);
    for (let i = 0; i < a.length; i++) {
      const pa = a[i].getAttribute('position').array;
      const pb = b[i].getAttribute('position').array;
      expect(Array.from(pa)).toEqual(Array.from(pb));
    }
    const c = buildVoidGateSegments(12, 3);
    expect(Array.from(c[0].getAttribute('position').array)).not.toEqual(
      Array.from(a[0].getAttribute('position').array)
    );
  });
});

describe('Deep Void ringed planets', () => {
  it('authors a few finished planets, each with one or two rings', () => {
    expect(VOID_PLANETS.length).toBeGreaterThanOrEqual(3);
    expect(VOID_PLANETS.length).toBeLessThanOrEqual(5);
    for (const planet of VOID_PLANETS) {
      expect(planet.rings.length).toBeGreaterThanOrEqual(1);
      expect(planet.rings.length).toBeLessThanOrEqual(2);
      const reach = planet.cluster
        ? Math.max(...planet.cluster.map((ball) => Math.hypot(ball.x, ball.y, ball.z) + ball.r))
        : planet.ball;
      if (planet.cluster) {
        expect(planet.cluster).toHaveLength(3);
        expect(planet.rings.every((ring) => ring.gaps.length === 0)).toBe(true);
      } else {
        expect(planet.rings.every((ring) => ring.gaps.length > 0)).toBe(true);
      }
      for (const ring of planet.rings) {
        expect(ring.gaps.length).toBeLessThanOrEqual(3);
        for (const gap of ring.gaps) expect(gap.width).toBeGreaterThan(0.4);
        expect(ring.inner).toBeGreaterThan(reach);
      }
    }
  });

  it('keeps both sides of every planet off the hop corridor', () => {
    for (const planet of VOID_PLANETS) {
      expect(planetStaysBeside(buildPlanetVariation(planet, 1)), planet.id).toBe(true);
      expect(planetStaysBeside(buildPlanetVariation(planet, -1)), planet.id).toBe(true);
    }
  });

  it('repeats the same planets for the same seed', () => {
    const a = buildVoidPlanetSegments(4, 3);
    const b = buildVoidPlanetSegments(4, 3);
    for (let i = 0; i < a.length; i++) {
      expect(Array.from(a[i].getAttribute('position').array)).toEqual(
        Array.from(b[i].getAttribute('position').array)
      );
    }
    const c = buildVoidPlanetSegments(5, 3);
    expect(Array.from(c[0].getAttribute('position').array)).not.toEqual(
      Array.from(a[0].getAttribute('position').array)
    );
  });
});

describe('Deep Void small orbit rings', () => {
  it('authors a few thin rings, each already wrapped around a rock or a shaft', () => {
    expect(VOID_ORBITS.length).toBeGreaterThanOrEqual(3);
    expect(VOID_ORBITS.length).toBeLessThanOrEqual(5);
    const kinds = new Set(VOID_ORBITS.map((orbit) => orbit.kind));
    expect(kinds.has('rock')).toBe(true);
    expect(kinds.has('shaft')).toBe(true);
    for (const orbit of VOID_ORBITS) {
      expect(orbit.ring.gaps.length).toBeGreaterThan(0);
      expect(orbit.ring.gaps.length).toBeLessThanOrEqual(3);
      for (const gap of orbit.ring.gaps) expect(gap.width).toBeGreaterThan(0.4);
      expect(orbit.ring.thick).toBeLessThan(0.6);
    }
  });

  it('keeps both sides of every orbit off the hop corridor', () => {
    for (const orbit of VOID_ORBITS) {
      expect(planetStaysBeside(buildOrbitVariation(orbit, 1)), orbit.id).toBe(true);
      expect(planetStaysBeside(buildOrbitVariation(orbit, -1)), orbit.id).toBe(true);
    }
  });

  it('repeats the same orbits for the same seed', () => {
    const a = buildVoidOrbitSegments(8, 3);
    const b = buildVoidOrbitSegments(8, 3);
    for (let i = 0; i < a.length; i++) {
      expect(Array.from(a[i].getAttribute('position').array)).toEqual(
        Array.from(b[i].getAttribute('position').array)
      );
    }
    const c = buildVoidOrbitSegments(9, 3);
    expect(Array.from(c[0].getAttribute('position').array)).not.toEqual(
      Array.from(a[0].getAttribute('position').array)
    );
  });
});

/** Crack triangles (cyan, white, or violet), and how far they sit from the stone's centre lines. */
function crackOnStone(
  geo: { getAttribute(name: string): { count: number; getX(i: number): number; getY(i: number): number; getZ(i: number): number } },
  distance: number
): { triangles: number; meanAbsZ: number; meanNear: number; alongZ: number; alongX: number } {
  const pos = geo.getAttribute('position');
  const col = geo.getAttribute('color');
  let triangles = 0;
  let absZ = 0;
  let near = 0;
  let n = 0;
  let alongZ = 0;
  let alongX = 0;
  for (let i = 0; i < pos.count; i += 3) {
    const r = col.getX(i);
    const g = col.getY(i);
    const b = col.getZ(i);
    if (Math.max(r, g, b) > 0.45) {
      triangles++;
      let sx = 0;
      let sz = 0;
      for (let k = 0; k < 3; k++) {
        const lx = Math.abs(pos.getX(i + k) - distance);
        const lz = Math.abs(pos.getZ(i + k) - 72);
        absZ += lz;
        near += Math.min(lx, lz);
        sx += lx;
        sz += lz;
        n++;
      }
      if (sz <= sx) alongZ++;
      else alongX++;
    }
  }
  return {
    triangles,
    meanAbsZ: n ? absZ / n : 99,
    meanNear: n ? near / n : 99,
    alongZ,
    alongX
  };
}

describe('Deep Void islands', () => {
  it('authors the rock families as finished pieces', () => {
    const count = (family: string) => VOID_ISLANDS.filter((island) => island.family === family).length;
    expect(count('wide')).toBe(4);
    expect(count('jagged')).toBe(4);
    expect(count('seam')).toBe(3);
    expect(count('crowned')).toBe(4);
    expect(count('point')).toBe(3);
    for (const island of VOID_ISLANDS) {
      const seams = island.chunks.filter((chunk) => chunk.seam).length;
      if (island.family === 'seam') {
        if ((island.hull?.rift ?? 0) > 0) {
          expect(seams, island.id).toBe(0);
          const crack = crackOnStone(buildIslandVariation(island, 1), island.distance);
          expect(crack.triangles, island.id).toBeGreaterThan(6);
          expect(crack.meanNear, island.id).toBeLessThan(0.2);
          if (island.hull?.cross) {
            expect(crack.alongZ, island.id).toBeGreaterThan(4);
            expect(crack.alongX, island.id).toBeGreaterThan(4);
            expect(crack.triangles, island.id).toBeLessThan(160);
          } else {
            expect(crack.meanAbsZ, island.id).toBeLessThan(0.2);
            expect(crack.triangles, island.id).toBeLessThan(80);
          }
        } else {
          expect(seams).toBeGreaterThanOrEqual(1);
          expect(seams).toBeLessThanOrEqual(2);
        }
      }
      if (island.family === 'crowned') {
        const crowns = island.hull?.crowns ?? (island.hull?.crown ? [island.hull.crown] : []);
        if (crowns.length && island.hull) {
          if (island.id === 'crown-twin') expect(crowns.length, island.id).toBe(2);
          for (const crown of crowns) {
            const base = crown.at[1] - crown.span[1] + (crown.lift ?? 0);
            if ((crown.lift ?? 0) > 0) {
              expect(base, island.id).toBeGreaterThan(island.hull.flatTop + 0.45);
            } else {
              expect(base, island.id).toBeLessThan(island.hull.flatTop + 0.2);
            }
          }
          const pos = buildIslandVariation(island, 1).getAttribute('position');
          let top = -Infinity;
          for (let i = 0; i < pos.count; i++) top = Math.max(top, pos.getY(i));
          expect(top - island.y, island.id).toBeGreaterThan(3);
        } else {
          const tall = island.chunks.some((chunk) => chunk.at[1] + chunk.size[1] > 3);
          expect(tall, island.id).toBe(true);
        }
      }
      if (island.family === 'point') {
        const pos = buildIslandVariation(island, 1).getAttribute('position');
        const cap = island.y + 0.95;
        let minY = Infinity;
        let maxY = -Infinity;
        let reach = 0;
        for (let i = 0; i < pos.count; i++) {
          const y = pos.getY(i);
          if (y > cap) continue;
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
          reach = Math.max(reach, Math.hypot(Math.abs(pos.getX(i)) - island.distance, pos.getZ(i) - island.z));
        }
        const deck = maxY - (maxY - minY) * 0.22;
        let high = 0;
        for (let i = 0; i < pos.count; i++) if (pos.getY(i) > deck && pos.getY(i) <= cap) high++;
        expect(high, island.id).toBeGreaterThan(6);
        expect(minY, island.id).toBeLessThan(island.y - 0.4);
        expect(reach, island.id).toBeGreaterThan(island.id === 'point-peak' ? 1.0 : 1.8);
        if (island.hull?.invert) expect(maxY - minY, island.id).toBeGreaterThan(1.4);
        expect(island.hull?.crown || island.hull?.crowns?.length, island.id).toBeTruthy();
      }
      if (island.family === 'wide' || island.family === 'jagged' || island.family === 'point') {
        expect(seams).toBe(0);
        expect(island.hull?.crown || island.hull?.crowns?.length, island.id).toBeTruthy();
      }
    }
  });

  it('keeps both sides of every island off the hop corridor', () => {
    for (const island of VOID_ISLANDS) {
      expect(islandStaysBeside(buildIslandVariation(island, 1)), island.id).toBe(true);
      expect(islandStaysBeside(buildIslandVariation(island, -1)), island.id).toBe(true);
    }
  });

  it('keeps the outside of an island toward the camera on both sides of the path', () => {
    for (const island of VOID_ISLANDS) {
      const left = outwardShare(buildIslandVariation(island, 1));
      const right = outwardShare(buildIslandVariation(island, -1));
      expect(left, island.id).toBeGreaterThan(0.6);
      expect(right, island.id).toBeGreaterThan(0.6);
      expect(Math.abs(left - right), island.id).toBeLessThan(0.02);
    }
  });

  it('repeats the same islands for the same seed', () => {
    const a = buildVoidIslandSegments(3, 3);
    const b = buildVoidIslandSegments(3, 3);
    for (let i = 0; i < a.length; i++) {
      expect(Array.from(a[i].getAttribute('position').array)).toEqual(
        Array.from(b[i].getAttribute('position').array)
      );
    }
    const c = buildVoidIslandSegments(4, 3);
    expect(Array.from(c[0].getAttribute('position').array)).not.toEqual(
      Array.from(a[0].getAttribute('position').array)
    );
  });
});

describe('Deep Void monoliths', () => {
  it('authors shafts, clusters, and a few marked faces', () => {
    const count = (family: string) => VOID_MONOLITHS.filter((m) => m.family === family).length;
    expect(count('shaft')).toBe(4);
    expect(count('cluster')).toBe(3);
    expect(count('marked')).toBe(3);
    for (const mono of VOID_MONOLITHS) {
      expect(mono.shafts.length).toBeGreaterThan(0);
      if (mono.family === 'cluster') expect(mono.shafts.length).toBeGreaterThanOrEqual(3);
      if (mono.family === 'shaft') expect(mono.shafts).toHaveLength(1);
      if (mono.family === 'marked') {
        expect(mono.mark).toBeTruthy();
        expect(mono.mark!.stars.length).toBeGreaterThanOrEqual(3);
        expect(mono.mark!.stars.length).toBeLessThanOrEqual(6);
        expect(mono.mark!.lines.length).toBeGreaterThan(0);
      } else {
        expect(mono.mark).toBeUndefined();
      }
    }
  });

  it('keeps both sides of every monolith off the hop corridor', () => {
    for (const mono of VOID_MONOLITHS) {
      expect(monolithStaysBeside(buildMonolithVariation(mono, 1)), mono.id).toBe(true);
      expect(monolithStaysBeside(buildMonolithVariation(mono, -1)), mono.id).toBe(true);
    }
  });

  it('keeps the outside of a monolith toward the camera on both sides of the path', () => {
    for (const mono of VOID_MONOLITHS) {
      const left = outwardShare(buildMonolithVariation(mono, 1));
      const right = outwardShare(buildMonolithVariation(mono, -1));
      expect(left, mono.id).toBeGreaterThan(0.6);
      expect(right, mono.id).toBeGreaterThan(0.6);
      expect(Math.abs(left - right), mono.id).toBeLessThan(0.02);
    }
  });

  it('repeats the same monoliths for the same seed', () => {
    const a = buildVoidMonolithSegments(6, 3);
    const b = buildVoidMonolithSegments(6, 3);
    for (let i = 0; i < a.length; i++) {
      expect(Array.from(a[i].getAttribute('position').array)).toEqual(
        Array.from(b[i].getAttribute('position').array)
      );
    }
    const c = buildVoidMonolithSegments(7, 3);
    expect(Array.from(c[0].getAttribute('position').array)).not.toEqual(
      Array.from(a[0].getAttribute('position').array)
    );
  });
});

describe('Deep Void tiles', () => {
  it('keeps saturated blue and purple tops and no white tile', () => {
    const nearWhite = VOID_TILES.filter((hex) => {
      const r = (hex >> 16) & 255;
      const g = (hex >> 8) & 255;
      const b = hex & 255;
      return r > 210 && g > 210 && b > 200;
    });
    expect(nearWhite).toHaveLength(0);
    expect(VOID_TILES).toContain(0x3a62be);
    expect(VOID_TILES).toContain(0x4e3f96);
    expect(VOID_TILES).toContain(0x6a56b4);
    const blues = VOID_TILES.filter((hex) => hex === 0x2a4c92 || hex === 0x3a62be || hex === 0x3458ae || hex === 0x243f78);
    expect(blues.length).toBeGreaterThan(VOID_TILES.length / 2);
  });

  it('paints a glowing face rim, cyan most often', () => {
    const colors = Array.from({ length: 12 }, (_, i) => voidRimColor(i));
    expect(colors.filter((c) => c === VOID_RIM).length).toBe(8);
    expect(colors.filter((c) => c === VOID_RIM_VIOLET).length).toBe(1);
    expect(colors.filter((c) => c === VOID_RIM_MAGENTA).length).toBe(3);

    const mat = new MeshBasicMaterial();
    const rim = { name: 'void-rim', visible: false, material: mat };
    const platform = {
      index: 2,
      topMat: new MeshToonMaterial(),
      sideMat: new MeshToonMaterial(),
      group: { getObjectByName: (name: string) => (name === 'void-rim' ? rim : null) }
    } as unknown as PlatformData;
    PlatformEntity.setVoidRim(true);
    PlatformEntity.setFaceColors(platform, 0x111a38);
    expect(rim.visible).toBe(true);
    expect(mat.color.getHex()).toBe(VOID_RIM_MAGENTA);
    PlatformEntity.setVoidRim(false);
    PlatformEntity.setFaceColors(platform, 0x111a38);
    expect(rim.visible).toBe(false);
  });
});

describe('Deep Void field', () => {
  const slots = [0, 1, 2];

  it('fills both sides in layers, with a farther band only on a wide screen', () => {
    const desk = slots.flatMap((slot) => planVoidSegment(4, slot, false));
    const phone = slots.flatMap((slot) => planVoidSegment(4, slot, true));
    const count = (list: VoidPlacement[], kind: string) => list.filter((p) => p.kind === kind).length;
    expect(count(desk, 'gate')).toBe(1);
    expect(count(phone, 'gate')).toBe(1);
    expect(count(desk, 'planet')).toBe(3);
    expect(count(phone, 'planet')).toBe(3);
    expect(count(desk, 'orbit')).toBe(1);
    expect(count(phone, 'orbit')).toBe(1);
    expect(count(desk, 'island')).toBeGreaterThan(count(desk, 'planet') * 3);
    expect(count(desk, 'monolith')).toBeGreaterThan(count(desk, 'orbit'));
    expect(count(desk, 'monolith')).toBeLessThan(count(desk, 'island'));
    const gateSlot = planVoidSegment(4, 0, false);
    const gatePiece = gateSlot.find((p) => p.kind === 'gate')!;
    expect(gateSlot.filter((p) => p.kind !== 'gate' && Math.abs(p.z - gatePiece.z) < 20)).toEqual([]);
    expect(planVoidSegment(4, 0, false).length).toBeLessThan(planVoidSegment(4, 2, false).length);
    const seen = new Set<number>();
    let repeats = 0;
    for (const p of planVoidSegment(4, 2, true)) {
      if (p.kind !== 'island') continue;
      if (seen.has(p.index)) repeats++;
      seen.add(p.index);
    }
    expect(repeats).toBeLessThan(4);
    expect(phone.length).toBeLessThan(desk.length);
    expect(desk.some((p) => p.rise < 0)).toBe(true);
    expect(desk.some((p) => p.rise > 4)).toBe(true);
    expect(phone.some((p) => p.rise < 0)).toBe(true);
    expect(phone.some((p) => p.rise > 2.4)).toBe(true);
    const scenery = (list: VoidPlacement[]) => list.filter((p) => p.kind === 'island' || p.kind === 'monolith');
    expect(scenery(phone).some((p) => p.outward >= 4)).toBe(false);
    expect(scenery(desk).some((p) => p.outward >= 4)).toBe(true);
    const gaps = (portrait: boolean, min: number) => {
      for (const slot of slots) {
        for (const side of [1, -1] as const) {
          const zs = planVoidSegment(4, slot, portrait)
            .filter((p) => p.side === side && p.kind !== 'gate' && !p.sink)
            .map((p) => p.z)
            .sort((a, b) => a - b);
          for (let i = 1; i < zs.length; i++) expect(zs[i] - zs[i - 1]).toBeGreaterThanOrEqual(min);
        }
      }
    };
    gaps(true, 12);
    gaps(false, 8);
    const nearBand = (portrait: boolean) =>
      planVoidSegment(4, 0, portrait).filter(
        (p) => p.outward < 2 && p.kind !== 'gate' && p.kind !== 'planet' && p.kind !== 'orbit'
      );
    expect(nearBand(true)).toEqual(nearBand(false));
  });

  it('keeps the same layout for the same seed, and a different one for another seed', () => {
    const a = buildVoidFieldSegment(4, 0, false);
    const b = buildVoidFieldSegment(4, 0, false);
    expect(Array.from(a.getAttribute('position').array)).toEqual(Array.from(b.getAttribute('position').array));
    const c = buildVoidFieldSegment(5, 0, false);
    expect(Array.from(c.getAttribute('position').array)).not.toEqual(Array.from(a.getAttribute('position').array));
  });

  it('pushes planets and orbits out and ahead on a phone, and leaves the near pieces where they were', () => {
    const desk = planVoidSegment(4, 1, false);
    const phone = planVoidSegment(4, 1, true);
    const planetD = desk.find((p) => p.kind === 'planet')!;
    const planetP = phone.find((p) => p.kind === 'planet')!;
    const orbitD = desk.find((p) => p.kind === 'orbit')!;
    const orbitP = phone.find((p) => p.kind === 'orbit')!;
    expect(planetP.z).toBeGreaterThan(planetD.z);
    expect(orbitP.z).toBeGreaterThan(orbitD.z);
    expect(planetP.outward).toBeGreaterThan(planetD.outward);
    expect(orbitP.outward).toBeGreaterThan(orbitD.outward);
    expect(planVoidSegment(4, 0, true).length).toBeLessThan(planVoidSegment(4, 0, false).length);

    const islandEdge = (geo: ReturnType<typeof buildVoidFieldSegment>) => {
      const pos = geo.getAttribute('position');
      let min = Infinity;
      for (let i = 0; i < pos.count; i++) {
        const z = pos.getZ(i);
        const y = pos.getY(i);
        if (z < 20 || z > 55 || y < -0.4) continue;
        min = Math.min(min, Math.abs(pos.getX(i)));
      }
      return min;
    };
    const phoneNear = islandEdge(buildVoidFieldSegment(4, 0, true));
    const deskNear = islandEdge(buildVoidFieldSegment(4, 0, false));
    expect(phoneNear).toBeGreaterThanOrEqual(5.4);
    expect(phoneNear).toBeLessThan(deskNear);
  });

  it('keeps every planted segment out of the hop corridor', () => {
    for (const portrait of [false, true]) {
      for (const slot of slots) {
        expect(fieldClearsPlay(buildVoidFieldSegment(4, slot, portrait)), `${slot} ${portrait}`).toBe(true);
        expect(fieldClearsPlay(buildVoidFieldSegment(9, slot, portrait)), `${slot} ${portrait} seed`).toBe(true);
      }
    }
  });
});
