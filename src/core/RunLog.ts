import { GAME_CONFIG } from '../config/GameConfig';
import { getActiveMissions } from '../config/Missions';
import type { MissionMetric } from '../config/Missions';
import { WORLDS } from '../config/Worlds';
import type { WorldId } from '../config/Worlds';
import type { PlayerData } from './Types';
import { getMetricValue } from './Progression';

/**
 * Measure log. One record per finished run, plus a claim or a shop buy.
 *
 * This is not the profile. It lives under `hop_measure`, so clearing
 * `hop_player_data` or `hop_dev_player_data` (restart profile, reset progress)
 * does not touch it. The same browser keeps one history.
 *
 * A run is `natural` when this page was not used to set score, coins, runs,
 * worlds, skins, or missions, and invincible / straight-lane / no-sway were
 * off. A cheat marks the rest of that page; a reload starts clean. Practice
 * is a death inside the first-run lessons. Decisions about prices, unlock
 * scores, and mission targets use only natural, non-practice runs. The other
 * records stay in the log so the raw history is still there.
 *
 * Nothing here changes a price, an unlock, or a mission. `summarizeMeasure`
 * is the reading that a later pass will use.
 */
export const MEASURE_KEY = 'hop_measure';
const MEASURE_VERSION = 1;
const MEASURE_LIMIT = 400;

export interface MeasureStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface MeasureMission {
  id: string;
  metric: MissionMetric;
  target: number;
  /** Persisted progress after the run. Lifetime metrics use the lifetime counter. */
  progress: number;
  /** This run is the one that finished the mission. */
  done: boolean;
}

export interface MeasureRun {
  kind: 'run';
  n: number;
  at: number;
  dev: boolean;
  natural: boolean;
  practice: boolean;
  world: WorldId;
  skin: string;
  score: number;
  landings: number;
  coins: number;
  perfects: number;
  bestStreak: number;
  shieldSpent: boolean;
  seconds: number;
  newBest: boolean;
  missionsOn: boolean;
  missions: MeasureMission[];
}

export interface MeasureClaim {
  kind: 'claim';
  n: number;
  at: number;
  dev: boolean;
  natural: boolean;
  missionId: string;
  reward: number;
}

export interface MeasureBuy {
  kind: 'buy';
  n: number;
  at: number;
  dev: boolean;
  natural: boolean;
  skinId: string;
  price: number;
}

export type MeasureEvent = MeasureRun | MeasureClaim | MeasureBuy;

export interface MeasureFile {
  v: number;
  next: number;
  events: MeasureEvent[];
}

export interface FinishedRun {
  practice: boolean;
  world: WorldId;
  skin: string;
  score: number;
  landings: number;
  coins: number;
  perfects: number;
  bestStreak: number;
  shieldSpent: boolean;
  seconds: number;
  newBest: boolean;
  missionsOn: boolean;
  missions: MeasureMission[];
}

export interface MeasureSummary {
  stored: number;
  decisionRuns: number;
  score: { median: number | null; mean: number | null };
  coins: { median: number | null; mean: number | null };
  /** Mission rewards on natural claims, spread across the decision runs. */
  missionCoinsPerRun: number;
  /** Pickup median plus mission coins. Null until a decision run exists. */
  incomePerRun: number | null;
  worlds: Record<WorldId, { runs: number; medianScore: number | null; medianCoins: number | null }>;
  /** Decision runs, in order, until their scores add up to each unlock. */
  unlocks: { id: WorldId; name: string; score: number; runs: number | null }[];
  /** Runs of typical income to afford each priced skin. Prices are not changed. */
  prices: { id: string; name: string; price: number; runs: number | null }[];
  missions: {
    id: string;
    metric: MissionMetric;
    target: number;
    seen: number;
    /** Decision runs whose own score, coins, perfects, or streak met the target. */
    metOnOneRun: number;
    cleared: number;
  }[];
}

let sessionNatural = true;
let storeOverride: MeasureStore | null = null;

export function markMeasureUnnatural(): void {
  sessionNatural = false;
}

export function resetMeasureSession(): void {
  sessionNatural = true;
}

export function setMeasureStore(store: MeasureStore | null): void {
  storeOverride = store;
}

export function isMeasureNatural(): boolean {
  return sessionNatural
    && !GAME_CONFIG.DEBUG.unlockAllWorlds
    && !GAME_CONFIG.DEBUG.infiniteCoins
    && !GAME_CONFIG.DEBUG.unlockAllSkins
    && !GAME_CONFIG.DEBUG.invincible
    && !GAME_CONFIG.DEBUG.straightLane
    && !GAME_CONFIG.DEBUG.noSway;
}

export function snapshotMissions(
  player: PlayerData,
  world: WorldId,
  doneBefore: ReadonlySet<string>,
  dateKey?: string
): MeasureMission[] {
  const run = {
    score: 0,
    runPerfects: 0,
    runCoins: 0,
    maxStreak: 0,
    selectedWorld: world
  };
  return getActiveMissions(world, dateKey).map((mission) => {
    const progress = mission.kind === 'lifetime'
      ? getMetricValue(mission.metric, player, run)
      : (player.missionProgress[mission.id] ?? 0);
    const done = player.completedMissions.includes(mission.id) && !doneBefore.has(mission.id);
    return {
      id: mission.id,
      metric: mission.metric,
      target: mission.target,
      progress,
      done
    };
  });
}

export function recordRun(run: FinishedRun): void {
  append({
    kind: 'run',
    practice: run.practice,
    world: run.world,
    skin: run.skin,
    score: run.score,
    landings: run.landings,
    coins: run.coins,
    perfects: run.perfects,
    bestStreak: run.bestStreak,
    shieldSpent: run.shieldSpent,
    seconds: run.seconds,
    newBest: run.newBest,
    missionsOn: run.missionsOn,
    missions: run.missions
  });
}

export function recordClaim(missionId: string, reward: number): void {
  append({ kind: 'claim', missionId, reward });
}

export function recordBuy(skinId: string, price: number): void {
  append({ kind: 'buy', skinId, price });
}

export function loadMeasure(): MeasureFile {
  const store = activeStore();
  if (!store) return emptyFile();
  try {
    const raw = store.getItem(MEASURE_KEY);
    if (!raw) return emptyFile();
    const parsed = JSON.parse(raw) as Partial<MeasureFile>;
    if (parsed.v !== MEASURE_VERSION || !Array.isArray(parsed.events)) return emptyFile();
    const events = parsed.events.filter(isEvent);
    const next = typeof parsed.next === 'number' && parsed.next > 0
      ? parsed.next
      : events.reduce((max, event) => Math.max(max, event.n), 0) + 1;
    return { v: MEASURE_VERSION, next, events };
  } catch {
    return emptyFile();
  }
}

export function summarizeMeasure(file: MeasureFile = loadMeasure()): MeasureSummary {
  const runs = file.events.filter(isDecisionRun);
  const scores = runs.map((run) => run.score);
  const coins = runs.map((run) => run.coins);
  const coinMedian = median(coins);
  const claimCoins = file.events
    .filter((event): event is MeasureClaim => event.kind === 'claim' && event.natural)
    .reduce((sum, event) => sum + event.reward, 0);
  const missionCoinsPerRun = runs.length > 0 ? claimCoins / runs.length : 0;
  const incomePerRun = coinMedian === null ? null : coinMedian + missionCoinsPerRun;
  const worlds = {} as MeasureSummary['worlds'];
  for (const world of WORLDS) {
    const rows = runs.filter((run) => run.world === world.id);
    worlds[world.id] = {
      runs: rows.length,
      medianScore: median(rows.map((run) => run.score)),
      medianCoins: median(rows.map((run) => run.coins))
    };
  }
  return {
    stored: file.events.length,
    decisionRuns: runs.length,
    score: { median: median(scores), mean: mean(scores) },
    coins: { median: coinMedian, mean: mean(coins) },
    missionCoinsPerRun,
    incomePerRun,
    worlds,
    unlocks: WORLDS.filter((world) => world.unlockScore > 0).map((world) => ({
      id: world.id,
      name: world.name,
      score: world.unlockScore,
      runs: runsUntil(runs, world.unlockScore)
    })),
    prices: GAME_CONFIG.SHOP_SKINS.filter((skin) => skin.price > 0).map((skin) => ({
      id: skin.id,
      name: skin.name,
      price: skin.price,
      runs: incomePerRun && incomePerRun > 0 ? Math.ceil(skin.price / incomePerRun) : null
    })),
    missions: missionRows(runs)
  };
}

function append(partial: Omit<MeasureRun, 'n' | 'at' | 'dev' | 'natural'> | Omit<MeasureClaim, 'n' | 'at' | 'dev' | 'natural'> | Omit<MeasureBuy, 'n' | 'at' | 'dev' | 'natural'>): void {
  const store = activeStore();
  if (!store) return;
  try {
    const file = loadMeasure();
    const event = {
      ...partial,
      n: file.next,
      at: Date.now(),
      dev: import.meta.env.DEV === true || import.meta.env.VITE_DEV_MODE === 'true',
      natural: isMeasureNatural()
    } as MeasureEvent;
    file.events.push(event);
    file.next += 1;
    if (file.events.length > MEASURE_LIMIT) {
      file.events.splice(0, file.events.length - MEASURE_LIMIT);
    }
    store.setItem(MEASURE_KEY, JSON.stringify({ v: MEASURE_VERSION, next: file.next, events: file.events }));
  } catch {
    // A full or blocked store must not affect the hop.
  }
}

function missionRows(runs: MeasureRun[]): MeasureSummary['missions'] {
  const rows = new Map<string, MeasureSummary['missions'][number]>();
  for (const run of runs) {
    for (const mission of run.missions) {
      let row = rows.get(mission.id);
      if (!row) {
        row = {
          id: mission.id,
          metric: mission.metric,
          target: mission.target,
          seen: 0,
          metOnOneRun: 0,
          cleared: 0
        };
        rows.set(mission.id, row);
      }
      row.seen += 1;
      row.target = mission.target;
      if (mission.done) row.cleared += 1;
      const value = runMetric(run, mission.metric);
      if (value !== null && value >= mission.target) row.metOnOneRun += 1;
    }
  }
  return [...rows.values()].sort((a, b) => b.seen - a.seen || a.id.localeCompare(b.id));
}

function runMetric(run: MeasureRun, metric: MissionMetric): number | null {
  if (metric === 'score') return run.score;
  if (metric === 'coins') return run.coins;
  if (metric === 'perfects') return run.perfects;
  if (metric === 'streak') return run.bestStreak;
  return null;
}

function runsUntil(runs: MeasureRun[], target: number): number | null {
  let sum = 0;
  for (let i = 0; i < runs.length; i++) {
    sum += runs[i].score;
    if (sum >= target) return i + 1;
  }
  return null;
}

function isDecisionRun(event: MeasureEvent): event is MeasureRun {
  return event.kind === 'run' && event.natural && !event.practice;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function emptyFile(): MeasureFile {
  return { v: MEASURE_VERSION, next: 1, events: [] };
}

function activeStore(): MeasureStore | null {
  if (storeOverride) return storeOverride;
  if (typeof localStorage === 'undefined') return null;
  return localStorage;
}

function isEvent(value: unknown): value is MeasureEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as Partial<MeasureEvent>;
  return (event.kind === 'run' || event.kind === 'claim' || event.kind === 'buy')
    && typeof event.n === 'number';
}
