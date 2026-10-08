import { GAME_CONFIG } from '../config/GameConfig';
import { WORLDS, type WorldConfig, type WorldId } from '../config/Worlds';
import { getWorldById } from './WorldLogic';
import { MISSIONS, getDailyMissions, todayKey, type MissionConfig, type MissionMetric } from '../config/Missions';
import type { PlayerData } from './Types';

/**
 * Pure derivation helpers for the progression UI (Iteration 7).
 * No DOM, no three.js — fully unit-testable.
 */

/** Snapshot of run-scoped stats used by run-based mission metrics. */
export interface RunStats {
  score: number;
  runPerfects: number;
  runCoins: number;
  maxStreak: number;
  /** World the run targets (world-based model: missions gate on this). */
  selectedWorld: WorldId;
}

/** Ledger goal: highest world unlock score (Deep Void at 5,000). */
export const LEDGER_TARGET: number = Math.max(...WORLDS.map((w) => w.unlockScore));

/** Value of a mission metric against a data snapshot. */
export function getMetricValue(
  metric: MissionMetric,
  playerData: PlayerData,
  run: RunStats
): number {
  switch (metric) {
    case 'coins':
      return run.runCoins;
    case 'perfects':
      return run.runPerfects;
    case 'streak':
      return run.maxStreak;
    case 'totalCoinsCollected':
      return playerData.totalCoinsCollected;
    case 'totalPerfects':
      return playerData.totalPerfects;
    case 'bestStreak':
      return playerData.bestStreak;
    case 'totalScore':
      return playerData.totalScore;
    case 'score':
    default:
      return run.score;
  }
}

/** Milliseconds until the next local midnight — the daily mission reset. */
export function getTimeUntilNextReset(now: Date = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next.getTime() - now.getTime();
}

/** `HH:MM:SS` countdown from a millisecond duration (floored, clamped ≥ 0). */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

export interface LedgerInfo {
  current: number;
  target: number;
  percent: number;
  done: boolean;
  /** First world whose unlock score exceeds the ledger (null when all open). */
  nextUnlock: WorldConfig | null;
}

/** Runs after a world unlock before the next world's distance may appear. */
export const NEXT_GOAL_QUIET_RUNS = 3;

function formatPoints(n: number): string {
  return Math.max(0, Math.floor(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export interface NextGoalInput {
  totalScore: number;
  runsPlayed: number;
  tutorialDone: boolean;
  nextGoalNotedUnlock: number;
  nextGoalQuietFromRun: number;
  /** This game over is already showing a world-unlock or missions card. */
  announcementVisible: boolean;
}

/**
 * One game-over sentence naming the next locked world, or null.
 *
 * The sentence does not depend on which world was just played. Before Dusk
 * is unlocked it names Dusk. After Dusk is unlocked, and three later runs
 * have finished, it names Deep Void on a Sunrise game over and a Dusk game
 * over alike. There is no world after Deep Void, so the line stays empty
 * once every current world is open. A future world would follow the same
 * rule: wait three runs, then name it from every world already open.
 *
 * It stays hidden until missions are unlocked or the lifetime score has
 * reached the world-nav teach. Those are save facts, so Play Again shows
 * the line without a Home visit. The card on the unlocking game over still
 * wins: pass `announcementVisible` and the line stays empty.
 */
export function nextUnlockGoalText(input: NextGoalInput): string | null {
  if (!input.tutorialDone || input.announcementVisible) return null;
  const next = getLedgerInfo(input.totalScore).nextUnlock;
  if (!next || next.unlockScore <= 0) return null;
  const taught =
    input.runsPlayed >= GAME_CONFIG.MISSIONS_UNLOCK_RUNS ||
    input.totalScore >= GAME_CONFIG.WORLD_NAV_REVEAL_SCORE;
  if (!taught) return null;
  if (input.nextGoalNotedUnlock > 0 && next.unlockScore > input.nextGoalNotedUnlock) {
    if (input.runsPlayed < input.nextGoalQuietFromRun + NEXT_GOAL_QUIET_RUNS) return null;
  }
  const remaining = next.unlockScore - Math.max(0, input.totalScore);
  if (remaining <= 0) return null;
  return `${formatPoints(remaining)} to ${next.name}`;
}

/** Start the three-run quiet period when a gated world is newly unlocked. */
export function stampNextGoalQuiet(data: PlayerData): void {
  let highest = 0;
  for (const world of WORLDS) {
    if (world.unlockScore > 0 && data.totalScore >= world.unlockScore) highest = world.unlockScore;
  }
  if (highest > data.nextGoalNotedUnlock) {
    data.nextGoalNotedUnlock = highest;
    data.nextGoalQuietFromRun = data.runsPlayed;
  }
}

export function getLedgerInfo(totalScore: number): LedgerInfo {
  const nextUnlock = WORLDS.find((w) => totalScore < w.unlockScore) ?? null;
  return {
    current: Math.max(0, totalScore),
    target: LEDGER_TARGET,
    percent: Math.min(100, Math.round((Math.max(0, totalScore) / LEDGER_TARGET) * 100)),
    done: totalScore >= LEDGER_TARGET,
    nextUnlock
  };
}

export interface WorldProgressRow {
  world: WorldConfig;
  best: number;
  unlocked: boolean;
  isNextUnlock: boolean;
}

/** Per-world bests with unlock state for the start screen chips. */
export function getWorldProgress(playerData: PlayerData): WorldProgressRow[] {
  return WORLDS.map((world, index) => {
    const unlocked = playerData.totalScore >= world.unlockScore;
    const isNextUnlock =
      !unlocked &&
      WORLDS.filter((w) => w.unlockScore < world.unlockScore).every(
        (w) => playerData.totalScore >= w.unlockScore
      );
    return {
      world,
      best: playerData.bestPerWorld[index] ?? 0,
      unlocked,
      isNextUnlock
    };
  });
}

export interface MissionProgressRow {
  id: string;
  title: string;
  desc: string;
  kind: string;
  world: WorldId | null;
  reward: number;
  target: number;
  current: number;
  percent: number;
  done: boolean;
  /** World missions of a world the player hasn't unlocked yet are shown locked. */
  locked: boolean;
}

/**
 * Mission progress rows for the missions overlay, one list per tab:
 * - general: only today's 5 daily missions (from getDailyMissions).
 * - world: all 9 world missions; missions of worlds the player hasn't
 *   unlocked (total score below the world's unlock score) are `locked`, the
 *   rest show live progress — regardless of which world is currently selected
 *   to play (progress only banks while playing in that world).
 * - lifetime: all 6 persistent missions.
 * Progress is session-based: general / world read the persisted `missionProgress`
 * map (cumulative across runs); lifetime reads the persisted counters.
 * A mission is done once its id sits in `completedMissions` (all kinds, one-time).
 */
export function getMissionProgressList(
  playerData: PlayerData,
  run: RunStats,
  dateKey: string = todayKey(),
  unlockAllWorlds: boolean = false
): MissionProgressRow[] {
  const deck = [...getDailyMissions(dateKey), ...MISSIONS.filter((m) => m.kind !== 'general')];
  return deck.map((m: MissionConfig) => {
    const done = playerData.completedMissions.includes(m.id);
    let current: number;
    if (m.kind === 'lifetime') {
      const raw = getMetricValue(m.metric, playerData, run);
      if (m.metric === 'bestStreak') {
        // A personal best is a MAX, not a counter — it cannot be re-earned, so
        // the unlock baseline does not apply (pre-unlock bests are
        // grandfathered). Display caps at the target: never "23/15".
        current = Math.min(m.target, raw);
      } else {
        const b = playerData.missionsBaseline;
        const base = (() => {
          if (!b) return 0;
          switch (m.metric) {
            case 'totalScore': return b.totalScore;
            case 'totalCoinsCollected': return b.totalCoinsCollected;
            case 'totalPerfects': return b.totalPerfects;
            default: return 0;
          }
        })();
        // Done rows always show a full bar (a debug total reset could
        // otherwise leave a done mission reading partial); live rows cap at
        // the target so the bar/text can never overflow it.
        current = done ? m.target : Math.min(m.target, Math.max(0, raw - base));
      }
    } else {
      current = playerData.missionProgress[m.id] ?? 0;
    }
    // A world mission is locked only while its OWN world is still locked
    // (unlock score not met) — never merely because another world is selected.
    // Done missions always read as done (checkmark) wherever they are.
    const worldUnlocked = m.world
      ? unlockAllWorlds || playerData.totalScore >= (getWorldById(m.world)?.unlockScore ?? Number.POSITIVE_INFINITY)
      : true;
    const locked = m.kind === 'world' && !done && !worldUnlocked;
    return {
      id: m.id,
      title: m.title,
      desc: m.desc,
      kind: m.kind,
      world: m.world ?? null,
      reward: m.reward,
      target: m.target,
      current,
      percent: Math.min(100, Math.round((current / m.target) * 100)),
      done,
      locked
    };
  });
}
