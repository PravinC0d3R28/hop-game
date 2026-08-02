import { WORLDS } from './Worlds';
import type { WorldId } from './Worlds';

export type MissionKind = 'general' | 'world' | 'lifetime';

export type MissionMetric =
  | 'score' // run score
  | 'gems' // run gems collected
  | 'perfects' // run perfect landings
  | 'streak' // run best perfect streak
  | 'totalScore' // lifetime ledger
  | 'totalGems' // lifetime gems
  | 'totalPerfects' // lifetime perfect landings
  | 'bestStreak'; // lifetime best streak

export interface MissionConfig {
  id: string;
  title: string;
  desc: string;
  kind: MissionKind;
  metric: MissionMetric;
  target: number;
  reward: number;
  world?: WorldId;
}

export interface MissionReward {
  id: string;
  title: string;
  reward: number;
  kind: MissionKind;
}

/**
 * Iteration 6 mission deck.
 * - General: active every run, tracked from run stats.
 * - World: active only while that world is the current or next world of the run.
 * - Lifetime: persistent counters across runs.
 */
export const MISSIONS: MissionConfig[] = [
  // ---- general (per-run) ----
  { id: 'g_first_steps', title: 'First Steps', desc: 'Reach a run score of 25', kind: 'general', metric: 'score', target: 25, reward: 10 },
  { id: 'g_gem_hunter', title: 'Gem Hunter', desc: 'Collect 5 gems in one run', kind: 'general', metric: 'gems', target: 5, reward: 15 },
  { id: 'g_clean_shots', title: 'Clean Shots', desc: 'Land 10 perfect hits in one run', kind: 'general', metric: 'perfects', target: 10, reward: 15 },
  { id: 'g_on_fire', title: 'On Fire', desc: 'Reach a perfect streak of 10', kind: 'general', metric: 'streak', target: 10, reward: 30 },
  { id: 'g_gatecrasher', title: 'Gatecrasher', desc: 'Cross into Dusk District (score 100)', kind: 'general', metric: 'score', target: 100, reward: 25 },
  { id: 'g_beyond_void', title: 'Beyond the Void', desc: 'Reach a run score of 250', kind: 'general', metric: 'score', target: 250, reward: 50 },

  // ---- world (laddered) ----
  { id: 'w1_perfects', title: 'Sunrise Steady', desc: 'Land 3 perfect hits', kind: 'world', metric: 'perfects', target: 3, reward: 10, world: 'sunrise' },
  { id: 'w1_gems', title: 'Morning Shine', desc: 'Collect 5 gems', kind: 'world', metric: 'gems', target: 5, reward: 10, world: 'sunrise' },
  { id: 'w1_score', title: 'Golden Hills', desc: 'Reach a run score of 50', kind: 'world', metric: 'score', target: 50, reward: 15, world: 'sunrise' },

  { id: 'w2_perfects', title: 'Dusk Dancer', desc: 'Land 5 perfect hits', kind: 'world', metric: 'perfects', target: 5, reward: 20, world: 'dusk' },
  { id: 'w2_gems', title: 'Sunset Bounty', desc: 'Collect 10 gems', kind: 'world', metric: 'gems', target: 10, reward: 25, world: 'dusk' },
  { id: 'w2_score', title: 'Street Sweeper', desc: 'Reach a run score of 150', kind: 'world', metric: 'score', target: 150, reward: 30, world: 'dusk' },

  { id: 'w3_streak', title: 'Fire Walker', desc: 'Reach a perfect streak of 5', kind: 'world', metric: 'streak', target: 5, reward: 40, world: 'void' },
  { id: 'w3_gems', title: 'Neon Harvest', desc: 'Collect 15 gems', kind: 'world', metric: 'gems', target: 15, reward: 35, world: 'void' },
  { id: 'w3_score', title: 'Into the Abyss', desc: 'Reach a run score of 250', kind: 'world', metric: 'score', target: 250, reward: 35, world: 'void' },

  // ---- lifetime (persistent) ----
  { id: 'l_thousand', title: 'First Thousand', desc: 'Reach a total score of 1,000', kind: 'lifetime', metric: 'totalScore', target: 1000, reward: 50 },
  { id: 'l_collector', title: 'Collector', desc: 'Gather 100 gems over time', kind: 'lifetime', metric: 'totalGems', target: 100, reward: 30 },
  { id: 'l_marksman', title: 'Marksman', desc: 'Land 200 perfect hits over time', kind: 'lifetime', metric: 'totalPerfects', target: 200, reward: 30 },
  { id: 'l_marathon', title: 'Marathon', desc: 'Reach a total score of 2,500', kind: 'lifetime', metric: 'totalScore', target: 2500, reward: 50 },
  { id: 'l_deepest', title: 'Deepest Run', desc: 'Set a personal best streak of 15', kind: 'lifetime', metric: 'bestStreak', target: 15, reward: 50 },
  { id: 'l_full_unlock', title: 'Full Unlock', desc: 'Reach a total score of 5,000', kind: 'lifetime', metric: 'totalScore', target: 5000, reward: 100 }
];

export function getMissionById(id: string): MissionConfig | undefined {
  return MISSIONS.find((m) => m.id === id);
}

/** World the run is currently in, read purely from the run score (gate ladder). */
export function getRunWorldId(score: number): WorldId {
  let world = WORLDS[0].id;
  for (const candidate of WORLDS) {
    if (score >= candidate.gateScore) world = candidate.id;
  }
  return world;
}

/** Next world in the ladder (null for the last world). */
export function getNextWorldOfId(id: WorldId): WorldId | null {
  const index = WORLDS.findIndex((w) => w.id === id);
  if (index < 0 || index >= WORLDS.length - 1) return null;
  return WORLDS[index + 1].id;
}

/**
 * Active missions for a run given its score.
 * General + lifetime are always on; world missions only when that world is the
 * current or next world of the ladder (FR-3.3).
 */
export function getActiveMissions(score: number): MissionConfig[] {
  const current = getRunWorldId(score);
  const next = getNextWorldOfId(current);
  return MISSIONS.filter((m) => {
    if (m.kind !== 'world') return true;
    if (m.world === current) return true;
    return next !== null && m.world === next;
  });
}