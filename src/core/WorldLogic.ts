import { WORLDS } from '../config/Worlds';
import type { WorldConfig } from '../config/Worlds';

/**
 * Pure world logic: unlock checks, gate crossing, sawtooth tier math.
 * No three.js / DOM dependencies — fully unit-testable.
 */
export function isWorldUnlocked(world: WorldConfig, totalScore: number): boolean {
  return totalScore >= world.unlockScore;
}

export function getWorldById(id: string): WorldConfig | undefined {
  return WORLDS.find((w) => w.id === id);
}

export function getNextWorld(world: WorldConfig): WorldConfig | undefined {
  const index = WORLDS.indexOf(world);
  return index >= 0 && index < WORLDS.length - 1 ? WORLDS[index + 1] : undefined;
}

/**
 * Active world for a run: the highest world whose gate is crossed
 * AND is unlocked. If the next world is locked, the run stays in the
 * current world (no soft-block, per FR-1.4).
 */
export function getWorldForScore(score: number, totalScore: number): WorldConfig {
  let current = WORLDS[0];
  for (const world of WORLDS) {
    if (score >= world.gateScore && isWorldUnlocked(world, totalScore)) {
      current = world;
    }
  }
  return current;
}

export function getWorldEntryScore(world: WorldConfig): number {
  return world.gateScore;
}

/**
 * Score since the world began (sawtooth base for difficulty ramps).
 * Never negative.
 */
export function getTierScore(score: number, world: WorldConfig): number {
  return Math.max(0, score - world.gateScore);
}
