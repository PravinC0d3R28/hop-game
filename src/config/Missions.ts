import { WORLDS } from './Worlds';
import type { WorldId } from './Worlds';

export type MissionKind = 'general' | 'world' | 'lifetime';

/** Difficulty bucket for the daily general-mission pool (economy control). */
export type MissionTier = 'easy' | 'medium' | 'hard';

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
  /** Difficulty tier — only used for the daily general pool. */
  tier?: MissionTier;
}

export interface MissionReward {
  id: string;
  title: string;
  reward: number;
  kind: MissionKind;
}

/**
 * Iteration 7 mission economy (see docs/GAME_MECHANICS.md §missions).
 * - General: a daily random set drawn from GENERAL_POOL (2 easy + 2 medium +
 *   1 hard per day, seeded by date), active only for that day. Progress is
 *   session-based: it persists across runs until the target is met.
 * - World: laddered by best-run depth. A world's missions only bank progress
 *   once the ladder (max of the current run and the all-time best run) reaches
 *   that world's run gate — locked worlds never fill.
 * - Lifetime: persistent counters across runs.
 */
export const GENERAL_POOL: MissionConfig[] = [
  // ---- easy (1 short session, ~30-45s; 2 per day) ----
  { id: 'g_first_steps', title: 'First Steps', desc: 'Reach a run score of 25', kind: 'general', metric: 'score', target: 25, reward: 10, tier: 'easy' },
  { id: 'g_gem_grab', title: 'Gem Grab', desc: 'Collect 5 gems', kind: 'general', metric: 'gems', target: 5, reward: 10, tier: 'easy' },
  { id: 'g_clean_shots', title: 'Clean Shots', desc: 'Land 10 perfect hits', kind: 'general', metric: 'perfects', target: 10, reward: 10, tier: 'easy' },
  { id: 'g_warm_streak', title: 'Warm Up', desc: 'Reach a perfect streak of 8', kind: 'general', metric: 'streak', target: 8, reward: 12, tier: 'easy' },
  { id: 'g_fifty', title: 'Half Century', desc: 'Reach a run score of 50', kind: 'general', metric: 'score', target: 50, reward: 15, tier: 'easy' },
  { id: 'g_shiny_start', title: 'Shiny Start', desc: 'Collect 8 gems', kind: 'general', metric: 'gems', target: 8, reward: 12, tier: 'easy' },
  { id: 'g_perfect_ten', title: 'Perfect Ten', desc: 'Land 15 perfect hits', kind: 'general', metric: 'perfects', target: 15, reward: 15, tier: 'easy' },

  // ---- medium (1 mid session, ~1-2min; 2 per day) ----
  { id: 'g_hundred', title: 'Century', desc: 'Reach a run score of 100', kind: 'general', metric: 'score', target: 100, reward: 20, tier: 'medium' },
  { id: 'g_treasure', title: 'Treasure Trove', desc: 'Collect 12 gems', kind: 'general', metric: 'gems', target: 12, reward: 25, tier: 'medium' },
  { id: 'g_marksman', title: 'Marksman', desc: 'Land 20 perfect hits', kind: 'general', metric: 'perfects', target: 20, reward: 25, tier: 'medium' },
  { id: 'g_on_fire', title: 'On Fire', desc: 'Reach a perfect streak of 10', kind: 'general', metric: 'streak', target: 10, reward: 30, tier: 'medium' },
  { id: 'g_double', title: 'Doubles', desc: 'Reach a run score of 150', kind: 'general', metric: 'score', target: 150, reward: 25, tier: 'medium' },
  { id: 'g_gem_spree', title: 'Gem Spree', desc: 'Collect 15 gems', kind: 'general', metric: 'gems', target: 15, reward: 30, tier: 'medium' },
  { id: 'g_perfect_20', title: 'Sharpshooter', desc: 'Land 30 perfect hits', kind: 'general', metric: 'perfects', target: 30, reward: 30, tier: 'medium' },

  // ---- hard (2-4 mid sessions or one long run; 1 per day) ----
  { id: 'g_quarter', title: 'Quarter Mile', desc: 'Reach a run score of 250', kind: 'general', metric: 'score', target: 250, reward: 40, tier: 'hard' },
  { id: 'g_gem_hoard', title: 'Gem Hoarder', desc: 'Collect 25 gems', kind: 'general', metric: 'gems', target: 25, reward: 45, tier: 'hard' },
  { id: 'g_sniper', title: 'Sniper', desc: 'Land 40 perfect hits', kind: 'general', metric: 'perfects', target: 40, reward: 45, tier: 'hard' },
  { id: 'g_streak_18', title: 'Unstoppable', desc: 'Reach a perfect streak of 18', kind: 'general', metric: 'streak', target: 18, reward: 50, tier: 'hard' },
  { id: 'g_three_hundred', title: 'Powerhouse', desc: 'Reach a run score of 350', kind: 'general', metric: 'score', target: 350, reward: 50, tier: 'hard' },
  { id: 'g_flawless', title: 'Flawless', desc: 'Land 60 perfect hits', kind: 'general', metric: 'perfects', target: 60, reward: 50, tier: 'hard' }
];

export const MISSIONS: MissionConfig[] = [
  ...GENERAL_POOL,

  // ---- world (laddered by best-run depth; targets sized by per-world run math) ----
  // Sunrise band is score 0-99 (short runs): a decent sunrise run reaches ~75.
  { id: 'w1_perfects', title: 'Sunrise Steady', desc: 'Land 10 perfect hits', kind: 'world', metric: 'perfects', target: 10, reward: 10, world: 'sunrise' },
  { id: 'w1_gems', title: 'Morning Shine', desc: 'Collect 8 gems', kind: 'world', metric: 'gems', target: 8, reward: 12, world: 'sunrise' },
  { id: 'w1_score', title: 'Golden Hills', desc: 'Reach a run score of 75', kind: 'world', metric: 'score', target: 75, reward: 15, world: 'sunrise' },

  // Dusk band is score 100-249 (mid runs): 220 sits deep in the band.
  { id: 'w2_perfects', title: 'Dusk Dancer', desc: 'Land 20 perfect hits', kind: 'world', metric: 'perfects', target: 20, reward: 20, world: 'dusk' },
  { id: 'w2_gems', title: 'Sunset Bounty', desc: 'Collect 15 gems', kind: 'world', metric: 'gems', target: 15, reward: 25, world: 'dusk' },
  { id: 'w2_score', title: 'Street Sweeper', desc: 'Reach a run score of 220', kind: 'world', metric: 'score', target: 220, reward: 30, world: 'dusk' },

  // Void band is score 250+ (long, high-focus runs): 400 needs ~200 landings.
  { id: 'w3_streak', title: 'Fire Walker', desc: 'Reach a perfect streak of 12', kind: 'world', metric: 'streak', target: 12, reward: 40, world: 'void' },
  { id: 'w3_gems', title: 'Neon Harvest', desc: 'Collect 25 gems', kind: 'world', metric: 'gems', target: 25, reward: 35, world: 'void' },
  { id: 'w3_score', title: 'Into the Abyss', desc: 'Reach a run score of 400', kind: 'world', metric: 'score', target: 400, reward: 40, world: 'void' },

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

/** Local calendar day `YYYY-MM-DD` — the daily mission seed (economy reset). */
export function todayKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** FNV-1a string hash → unsigned 32-bit seed. */
function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic PRNG (mulberry32) so a date always yields the same set. */
function seededShuffle<T>(items: T[], seed: number): T[] {
  let a = seed >>> 0;
  const rand = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** How many general missions per tier are drawn each day. */
export const DAILY_PICKS: Record<MissionTier, number> = { easy: 2, medium: 2, hard: 1 };

/**
 * The 5 general missions active today: date-seeded, stratified draw from the
 * pool (2 easy + 2 medium + 1 hard) so the coin economy stays in check.
 */
export function getDailyMissions(dateKey: string): MissionConfig[] {
  const seed = hashString(`hop-daily-${dateKey}`);
  const picked: MissionConfig[] = [];
  for (const tier of ['easy', 'medium', 'hard'] as const) {
    const candidates = GENERAL_POOL.filter((m) => m.tier === tier);
    const count = Math.min(DAILY_PICKS[tier], candidates.length);
    picked.push(...seededShuffle(candidates, seed ^ hashString(tier)).slice(0, count));
  }
  return picked.sort((a, b) => a.target - b.target);
}

/**
 * Missions that can bank progress, given the run's ladder score (the max of
 * the current run and the all-time best run — see `evaluateMissions`).
 * - General: today's daily set (5 missions).
 * - World: every world the ladder has reached (`worldIndex <= reachedIndex`).
 *   Not-yet-reached worlds stay inert: their missions never bank while locked.
 * - Lifetime: always on.
 */
export function getActiveMissions(score: number, dateKey: string = todayKey()): MissionConfig[] {
  const dailyIds = new Set(getDailyMissions(dateKey).map((m) => m.id));
  const reachedIndex = WORLDS.findIndex((w) => w.id === getRunWorldId(score));
  return MISSIONS.filter((m) => {
    if (m.kind === 'general') return dailyIds.has(m.id);
    if (m.kind !== 'world') return true;
    const worldIndex = m.world ? WORLDS.findIndex((w) => w.id === m.world) : -1;
    return worldIndex <= reachedIndex;
  });
}