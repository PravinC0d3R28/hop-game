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
 * - General: 5 daily missions (2 easy + 2 medium + 1 hard) drawn round-robin
 *   from GENERAL_POOL — consecutive days are disjoint and the full 30-mission
 *   pool cycles with no repeats (easy/medium every 5 days, hard every 10).
 *   Progress is session-based: it persists across runs until the target is met.
 * - World: laddered by best-run depth. A world's missions only bank progress
 *   once the ladder (max of the current run and the all-time best run) reaches
 *   that world's run gate — locked worlds never fill.
 * - Lifetime: persistent counters across runs.
 */
export const GENERAL_POOL: MissionConfig[] = [
  // ---- easy (1 short session, ~30-45s; 2 per day, 10 in pool) ----
  { id: 'g_first_steps', title: 'First Steps', desc: 'Reach a run score of 25', kind: 'general', metric: 'score', target: 25, reward: 10, tier: 'easy' },
  { id: 'g_gem_grab', title: 'Gem Grab', desc: 'Collect 5 gems', kind: 'general', metric: 'gems', target: 5, reward: 10, tier: 'easy' },
  { id: 'g_clean_shots', title: 'Clean Shots', desc: 'Land 10 perfect hits', kind: 'general', metric: 'perfects', target: 10, reward: 10, tier: 'easy' },
  { id: 'g_warm_streak', title: 'Warm Up', desc: 'Reach a perfect streak of 8', kind: 'general', metric: 'streak', target: 8, reward: 12, tier: 'easy' },
  { id: 'g_fifty', title: 'Half Century', desc: 'Reach a run score of 50', kind: 'general', metric: 'score', target: 50, reward: 15, tier: 'easy' },
  { id: 'g_shiny_start', title: 'Shiny Start', desc: 'Collect 8 gems', kind: 'general', metric: 'gems', target: 8, reward: 12, tier: 'easy' },
  { id: 'g_perfect_ten', title: 'Perfect Ten', desc: 'Land 15 perfect hits', kind: 'general', metric: 'perfects', target: 15, reward: 15, tier: 'easy' },
  { id: 'g_early_bird', title: 'Early Bird', desc: 'Reach a run score of 30', kind: 'general', metric: 'score', target: 30, reward: 10, tier: 'easy' },
  { id: 'g_shiny_stones', title: 'Shiny Stones', desc: 'Collect 6 gems', kind: 'general', metric: 'gems', target: 6, reward: 10, tier: 'easy' },
  { id: 'g_rolling', title: 'Rolling', desc: 'Reach a perfect streak of 6', kind: 'general', metric: 'streak', target: 6, reward: 12, tier: 'easy' },

  // ---- medium (1 mid session, ~1-2min; 2 per day, 10 in pool) ----
  { id: 'g_hundred', title: 'Century', desc: 'Reach a run score of 100', kind: 'general', metric: 'score', target: 100, reward: 20, tier: 'medium' },
  { id: 'g_treasure', title: 'Treasure Trove', desc: 'Collect 12 gems', kind: 'general', metric: 'gems', target: 12, reward: 25, tier: 'medium' },
  { id: 'g_marksman', title: 'Marksman', desc: 'Land 20 perfect hits', kind: 'general', metric: 'perfects', target: 20, reward: 25, tier: 'medium' },
  { id: 'g_on_fire', title: 'On Fire', desc: 'Reach a perfect streak of 10', kind: 'general', metric: 'streak', target: 10, reward: 30, tier: 'medium' },
  { id: 'g_double', title: 'Doubles', desc: 'Reach a run score of 150', kind: 'general', metric: 'score', target: 150, reward: 25, tier: 'medium' },
  { id: 'g_gem_spree', title: 'Gem Spree', desc: 'Collect 15 gems', kind: 'general', metric: 'gems', target: 15, reward: 30, tier: 'medium' },
  { id: 'g_perfect_20', title: 'Sharpshooter', desc: 'Land 30 perfect hits', kind: 'general', metric: 'perfects', target: 30, reward: 30, tier: 'medium' },
  { id: 'g_sprint', title: 'Sprint', desc: 'Reach a run score of 125', kind: 'general', metric: 'score', target: 125, reward: 22, tier: 'medium' },
  { id: 'g_deadeye', title: 'Deadeye', desc: 'Land 25 perfect hits', kind: 'general', metric: 'perfects', target: 25, reward: 28, tier: 'medium' },
  { id: 'g_inferno', title: 'Inferno', desc: 'Reach a perfect streak of 12', kind: 'general', metric: 'streak', target: 12, reward: 35, tier: 'medium' },

  // ---- hard (2-4 mid sessions or one long run; 1 per day, 10 in pool) ----
  { id: 'g_quarter', title: 'Quarter Mile', desc: 'Reach a run score of 250', kind: 'general', metric: 'score', target: 250, reward: 40, tier: 'hard' },
  { id: 'g_gem_hoard', title: 'Gem Hoarder', desc: 'Collect 25 gems', kind: 'general', metric: 'gems', target: 25, reward: 45, tier: 'hard' },
  { id: 'g_sniper', title: 'Sniper', desc: 'Land 40 perfect hits', kind: 'general', metric: 'perfects', target: 40, reward: 45, tier: 'hard' },
  { id: 'g_streak_18', title: 'Unstoppable', desc: 'Reach a perfect streak of 18', kind: 'general', metric: 'streak', target: 18, reward: 50, tier: 'hard' },
  { id: 'g_three_hundred', title: 'Powerhouse', desc: 'Reach a run score of 350', kind: 'general', metric: 'score', target: 350, reward: 50, tier: 'hard' },
  { id: 'g_flawless', title: 'Flawless', desc: 'Land 60 perfect hits', kind: 'general', metric: 'perfects', target: 60, reward: 50, tier: 'hard' },
  { id: 'g_mile_marker', title: 'Mile Marker', desc: 'Reach a run score of 300', kind: 'general', metric: 'score', target: 300, reward: 45, tier: 'hard' },
  { id: 'g_diamond_purse', title: 'Diamond Purse', desc: 'Collect 30 gems', kind: 'general', metric: 'gems', target: 30, reward: 50, tier: 'hard' },
  { id: 'g_surgical', title: 'Surgical', desc: 'Land 50 perfect hits', kind: 'general', metric: 'perfects', target: 50, reward: 50, tier: 'hard' },
  { id: 'g_laser_focus', title: 'Laser Focus', desc: 'Reach a perfect streak of 15', kind: 'general', metric: 'streak', target: 15, reward: 55, tier: 'hard' }
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

/** Days since a fixed epoch — the daily-mission rotation index. */
function daysSinceEpoch(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

/** How many general missions per tier are drawn each day. */
export const DAILY_PICKS: Record<MissionTier, number> = { easy: 2, medium: 2, hard: 1 };

/**
 * The 5 general missions active today: a round-robin walk of each tier pool.
 * Consecutive days draw disjoint sets and every mission cycles back in with no
 * repeats — easy/medium rotate through all 10 every 5 days, hard every 10 days
 * (2 per day × 5 = 10; 1 per day × 10 = 10). Fully deterministic per date.
 */
export function getDailyMissions(dateKey: string): MissionConfig[] {
  const day = daysSinceEpoch(dateKey);
  const picked: MissionConfig[] = [];
  for (const tier of ['easy', 'medium', 'hard'] as const) {
    const candidates = GENERAL_POOL.filter((m) => m.tier === tier);
    const step = Math.min(DAILY_PICKS[tier], candidates.length);
    const start = (day * step) % candidates.length;
    for (let i = 0; i < step; i++) {
      picked.push(candidates[(start + i) % candidates.length]);
    }
  }
  return picked.sort((a, b) => a.target - b.target);
}

/**
 * Missions that can bank progress, given the world currently selected to play:
 * - General: today's daily set (5 missions).
 * - World: only the selected world's missions (world-based model) — missions
 *   of other worlds are inert and never bank while you play elsewhere.
 * - Lifetime: always on.
 */
export function getActiveMissions(world: WorldId, dateKey: string = todayKey()): MissionConfig[] {
  const dailyIds = new Set(getDailyMissions(dateKey).map((m) => m.id));
  return MISSIONS.filter((m) => {
    if (m.kind === 'general') return dailyIds.has(m.id);
    if (m.kind !== 'world') return true;
    return m.world === world;
  });
}