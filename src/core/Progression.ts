import { WORLDS, type WorldConfig, type WorldId } from '../config/Worlds';
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
  runGems: number;
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
    case 'gems':
      return run.runGems;
    case 'perfects':
      return run.runPerfects;
    case 'streak':
      return run.maxStreak;
    case 'totalGems':
      return playerData.totalGems;
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
  /** World missions beyond the next unlock are shown locked on the start screen. */
  locked: boolean;
}

/**
 * Mission progress rows for the missions overlay, one list per tab:
 * - general: only today's 5 daily missions (from getDailyMissions).
 * - world: all 9 world missions; only the selected world's are unlocked, the
 *   other 6 are `locked` (their saved progress still shows once selected).
 * - lifetime: all 6 persistent missions.
 * Progress is session-based: general / world read the persisted `missionProgress`
 * map (cumulative across runs); lifetime reads the persisted counters.
 * A mission is done once its id sits in `completedMissions` (all kinds, one-time).
 */
export function getMissionProgressList(
  playerData: PlayerData,
  run: RunStats,
  dateKey: string = todayKey()
): MissionProgressRow[] {
  const deck = [...getDailyMissions(dateKey), ...MISSIONS.filter((m) => m.kind !== 'general')];
  return deck.map((m: MissionConfig) => {
    const current = m.kind === 'lifetime'
      ? getMetricValue(m.metric, playerData, run)
      : (playerData.missionProgress[m.id] ?? 0);
    const done = playerData.completedMissions.includes(m.id);
    // Done missions always read as done (checkmark), even outside their world —
    // only unfinished missions of non-selected worlds stay locked.
    const locked = m.kind === 'world' && m.world !== run.selectedWorld && !done;
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
