import { WORLDS } from '../config/Worlds';
import type { WorldConfig } from '../config/Worlds';

/**
 * Pure world logic: unlock checks, next-world navigation, sawtooth tier math.
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

export function getPreviousWorld(world: WorldConfig): WorldConfig | undefined {
  const index = WORLDS.indexOf(world);
  return index > 0 ? WORLDS[index - 1] : undefined;
}

export function getWorldEntryScore(world: WorldConfig): number {
  return world.gateScore;
}

/**
 * Score since the world's entry offset (sawtooth base for difficulty ramps).
 * World runs restart at 0, but the world's entry offset keeps the exact
 * per-world difficulty feel of the original phase-based game.
 * Never negative.
 */
export function getTierScore(score: number, world: WorldConfig): number {
  return Math.max(0, score - world.gateScore);
}
