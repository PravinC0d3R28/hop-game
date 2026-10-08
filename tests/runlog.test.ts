import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_PLAYER_DATA } from '../src/core/GameStateManager';
import {
  MEASURE_KEY,
  loadMeasure,
  markMeasureUnnatural,
  recordRun,
  resetMeasureSession,
  setMeasureStore,
  snapshotMissions,
  summarizeMeasure,
  type MeasureFile,
  type MeasureRun,
  type MeasureStore
} from '../src/core/RunLog';

function memoryStore(): MeasureStore & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => { map.set(key, value); }
  };
}

function run(partial: Partial<MeasureRun> & Pick<MeasureRun, 'n' | 'score' | 'coins'>): MeasureRun {
  return {
    kind: 'run',
    at: partial.n,
    dev: false,
    natural: true,
    practice: false,
    world: 'sunrise',
    skin: 'default',
    landings: 10,
    perfects: 2,
    bestStreak: 2,
    shieldSpent: false,
    seconds: 20,
    newBest: false,
    missionsOn: true,
    missions: [],
    ...partial
  };
}

describe('measure log', () => {
  let store: ReturnType<typeof memoryStore>;

  beforeEach(() => {
    store = memoryStore();
    setMeasureStore(store);
    resetMeasureSession();
  });

  afterEach(() => {
    setMeasureStore(null);
    resetMeasureSession();
  });

  it('keeps the history when both profile keys are wiped', () => {
    recordRun({
      practice: false,
      world: 'sunrise',
      skin: 'default',
      score: 40,
      landings: 12,
      coins: 3,
      perfects: 4,
      bestStreak: 3,
      shieldSpent: false,
      seconds: 18,
      newBest: true,
      missionsOn: false,
      missions: []
    });
    store.setItem('hop_player_data', '{}');
    store.setItem('hop_dev_player_data', '');
    store.map.delete('hop_player_data');
    store.map.delete('hop_dev_player_data');
    const saved = loadMeasure();
    expect(store.map.has(MEASURE_KEY)).toBe(true);
    expect(store.map.has('hop_player_data')).toBe(false);
    expect(saved.events).toHaveLength(1);
    expect(saved.events[0]).toMatchObject({ kind: 'run', score: 40, coins: 3, natural: true });
  });

  it('marks a cheated page and still stores the run', () => {
    markMeasureUnnatural();
    recordRun({
      practice: false,
      world: 'dusk',
      skin: 'lantern',
      score: 9999,
      landings: 1,
      coins: 0,
      perfects: 0,
      bestStreak: 0,
      shieldSpent: false,
      seconds: 1,
      newBest: false,
      missionsOn: false,
      missions: []
    });
    expect(loadMeasure().events[0]).toMatchObject({ natural: false, score: 9999 });
  });

  it('drops the oldest record past the cap', () => {
    for (let i = 0; i < 401; i++) {
      recordRun({
        practice: false,
        world: 'sunrise',
        skin: 'default',
        score: i,
        landings: 1,
        coins: 0,
        perfects: 0,
        bestStreak: 0,
        shieldSpent: false,
        seconds: 1,
        newBest: false,
        missionsOn: false,
        missions: []
      });
    }
    const saved = loadMeasure();
    expect(saved.events).toHaveLength(400);
    expect(saved.events[0]).toMatchObject({ n: 2, score: 1 });
    expect(saved.events[399]).toMatchObject({ n: 401, score: 400 });
  });

  it('reads prices and unlocks from natural runs only', () => {
    const file: MeasureFile = {
      v: 1,
      next: 6,
      events: [
        run({ n: 1, score: 400, coins: 4, world: 'sunrise' }),
        run({ n: 2, score: 400, coins: 8, world: 'sunrise' }),
        run({ n: 3, score: 300, coins: 6, world: 'dusk' }),
        run({ n: 4, score: 5000, coins: 0, natural: false }),
        run({ n: 5, score: 1, coins: 0, practice: true }),
        { kind: 'claim', n: 6, at: 6, dev: false, natural: true, missionId: 'g_fifty', reward: 15 }
      ]
    };
    const summary = summarizeMeasure(file);
    expect(summary.decisionRuns).toBe(3);
    expect(summary.score.median).toBe(400);
    expect(summary.coins.median).toBe(6);
    expect(summary.missionCoinsPerRun).toBe(5);
    expect(summary.incomePerRun).toBe(11);
    expect(summary.unlocks.find((row) => row.id === 'dusk')?.runs).toBe(3);
    expect(summary.unlocks.find((row) => row.id === 'void')?.runs).toBeNull();
    expect(summary.prices.find((row) => row.id === 'rings')).toMatchObject({ price: 50, runs: 5 });
    expect(summary.worlds.sunrise.runs).toBe(2);
    expect(summary.worlds.dusk.medianScore).toBe(300);
  });

  it('counts a mission the run itself could finish', () => {
    const file: MeasureFile = {
      v: 1,
      next: 3,
      events: [
        run({
          n: 1,
          score: 80,
          coins: 2,
          perfects: 4,
          bestStreak: 3,
          missions: [{ id: 'g_fifty', metric: 'score', target: 50, progress: 80, done: true }]
        }),
        run({
          n: 2,
          score: 20,
          coins: 1,
          missions: [{ id: 'g_fifty', metric: 'score', target: 50, progress: 20, done: false }]
        })
      ]
    };
    const row = summarizeMeasure(file).missions.find((mission) => mission.id === 'g_fifty');
    expect(row).toMatchObject({ seen: 2, metOnOneRun: 1, cleared: 1, target: 50 });
  });

  it('snapshots the active world missions and a completion from this run', () => {
    const player = {
      ...DEFAULT_PLAYER_DATA,
      completedMissions: ['w1_score'],
      missionProgress: { w1_score: 75 },
      totalScore: 40
    };
    const rows = snapshotMissions(player, 'sunrise', new Set(), '2026-01-01');
    expect(rows.find((row) => row.id === 'w1_score')).toMatchObject({ done: true, progress: 75, target: 75 });
    expect(rows.find((row) => row.id === 'w2_score')).toBeUndefined();
    expect(rows.find((row) => row.id === 'l_thousand')).toMatchObject({
      metric: 'totalScore',
      progress: 40,
      done: false
    });
  });
});
