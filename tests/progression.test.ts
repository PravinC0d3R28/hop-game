import { describe, expect, it } from 'vitest';
import {
  LEDGER_TARGET,
  getLedgerInfo,
  getMetricValue,
  getMissionProgressList,
  getWorldProgress
} from '../src/core/Progression';
import { getDailyMissions } from '../src/config/Missions';
import type { PlayerData } from '../src/core/Types';

const FRESH_PLAYER: PlayerData = {
  totalCoins: 0,
  bestScore: 0,
  purchasedSkins: ['default'],
  selectedSkin: 'default',
  theme: 'light',
  totalScore: 0,
  bestPerWorld: [0, 0, 0],
  totalGems: 0,
  totalPerfects: 0,
  bestStreak: 0,
  completedMissions: [],
  missionProgress: {}
};

const FRESH_RUN = { score: 0, runPerfects: 0, runGems: 0, maxStreak: 0 };

/** Fixed date key so the daily draw is deterministic in tests. */
const KEY = '2026-08-03';

describe('ledger derivation', () => {
  it('target is the highest world unlock score (5,000)', () => {
    expect(LEDGER_TARGET).toBe(5000);
  });

  it('percent clamps at 0 and 100', () => {
    expect(getLedgerInfo(-5).percent).toBe(0);
    expect(getLedgerInfo(0).percent).toBe(0);
    expect(getLedgerInfo(2500).percent).toBe(50);
    expect(getLedgerInfo(6000).percent).toBe(100);
  });

  it('done flips at the target; nextUnlock walks the world ladder', () => {
    expect(getLedgerInfo(500).done).toBe(false);
    expect(getLedgerInfo(5000).done).toBe(true);
    expect(getLedgerInfo(999).nextUnlock?.id).toBe('dusk');
    expect(getLedgerInfo(1000).nextUnlock?.id).toBe('void');
    expect(getLedgerInfo(4999).nextUnlock?.id).toBe('void');
    expect(getLedgerInfo(5000).nextUnlock).toBeNull();
  });
});

describe('metric value derivation', () => {
  const player: PlayerData = {
    ...FRESH_PLAYER,
    totalScore: 1234,
    totalGems: 7,
    totalPerfects: 42,
    bestStreak: 9
  };
  const run = { score: 30, runPerfects: 5, runGems: 2, maxStreak: 4 };

  it('maps run metrics to the run snapshot', () => {
    expect(getMetricValue('score', player, run)).toBe(30);
    expect(getMetricValue('gems', player, run)).toBe(2);
    expect(getMetricValue('perfects', player, run)).toBe(5);
    expect(getMetricValue('streak', player, run)).toBe(4);
  });

  it('maps lifetime metrics to the player ledger', () => {
    expect(getMetricValue('totalScore', player, run)).toBe(1234);
    expect(getMetricValue('totalGems', player, run)).toBe(7);
    expect(getMetricValue('totalPerfects', player, run)).toBe(42);
    expect(getMetricValue('bestStreak', player, run)).toBe(9);
  });
});

describe('world progress chips', () => {
  it('marks unlock state by total score', () => {
    const rows = getWorldProgress({ ...FRESH_PLAYER, totalScore: 2500 });
    expect(rows[0].unlocked).toBe(true);
    expect(rows[1].unlocked).toBe(true);
    expect(rows[2].unlocked).toBe(false);
    expect(rows[2].isNextUnlock).toBe(true);
    expect(rows[2].best).toBe(0);
  });

  it('marks the next unlock exactly once', () => {
    const fresh = getWorldProgress(FRESH_PLAYER);
    expect(fresh[0].unlocked).toBe(true);
    expect(fresh[1].isNextUnlock).toBe(true);
    expect(fresh[2].isNextUnlock).toBe(false);
    expect(fresh.filter((r) => r.isNextUnlock)).toHaveLength(1);
  });

  it('maps per-world bests by world index', () => {
    const rows = getWorldProgress({ ...FRESH_PLAYER, bestPerWorld: [11, 22, 33], totalScore: 5000 });
    expect(rows.map((r) => r.best)).toEqual([11, 22, 33]);
    expect(rows.every((r) => r.unlocked)).toBe(true);
  });
});

describe('mission progress list', () => {
  it('fresh profile: 5 daily general + 9 world + 6 lifetime rows; void world locked', () => {
    const rows = getMissionProgressList(FRESH_PLAYER, FRESH_RUN, KEY);
    expect(rows).toHaveLength(20);
    const general = rows.filter((r) => r.kind === 'general');
    expect(general).toHaveLength(5);
    expect(general.map((r) => r.id).sort()).toEqual(getDailyMissions(KEY).map((m) => m.id).sort());
    expect(general.every((r) => r.percent === 0 && !r.done && !r.locked)).toBe(true);
    const w3 = rows.find((r) => r.id === 'w3_gems')!;
    expect(w3.locked).toBe(true);
    const w1 = rows.find((r) => r.id === 'w1_gems')!;
    expect(w1.locked).toBe(false);
    expect(rows.filter((r) => r.kind === 'world')).toHaveLength(9);
    expect(rows.filter((r) => r.kind === 'lifetime')).toHaveLength(6);
  });

  it('world missions unlock by the reached ladder, not only current+next', () => {
    const rows = getMissionProgressList(
      { ...FRESH_PLAYER, bestScore: 377 },
      FRESH_RUN,
      KEY
    );
    const w1 = rows.find((r) => r.id === 'w1_perfects')!;
    const w2 = rows.find((r) => r.id === 'w2_score')!;
    const w3 = rows.find((r) => r.id === 'w3_gems')!;
    expect(w1.locked).toBe(false);
    expect(w2.locked).toBe(false);
    expect(w3.locked).toBe(false);
  });

  it('veteran save: lifetime missions show real progress and done state', () => {
    const rows = getMissionProgressList(
      { ...FRESH_PLAYER, totalScore: 1500, totalGems: 60, completedMissions: ['l_thousand'] },
      FRESH_RUN,
      KEY
    );
    const thousand = rows.find((r) => r.id === 'l_thousand')!;
    expect(thousand.done).toBe(true);
    expect(thousand.percent).toBe(100);
    const collector = rows.find((r) => r.id === 'l_collector')!;
    expect(collector.current).toBe(60);
    expect(collector.done).toBe(false);
    const marathon = rows.find((r) => r.id === 'l_marathon')!;
    expect(marathon.percent).toBe(60);
    const voidMissions = rows.filter((r) => r.world === 'void' && r.kind === 'world');
    expect(voidMissions).toHaveLength(3);
    expect(voidMissions[0].locked).toBe(true);
  });

  it('general/world progress reads persisted mission progress, not the run', () => {
    const daily = getDailyMissions(KEY);
    const first = daily[0];
    const progress = Math.max(1, Math.floor(first.target / 2));
    const rows = getMissionProgressList(
      { ...FRESH_PLAYER, missionProgress: { [first.id]: progress } },
      { score: 100, runPerfects: 10, runGems: 5, maxStreak: 10 },
      KEY
    );
    const row = rows.find((r) => r.id === first.id)!;
    expect(row.current).toBe(progress);
    expect(row.percent).toBe(Math.round((progress / first.target) * 100));
    expect(row.done).toBe(false);
  });

  it('done state comes from completedMissions for all kinds', () => {
    const daily = getDailyMissions(KEY);
    const first = daily[0];
    const rows = getMissionProgressList(
      {
        ...FRESH_PLAYER,
        missionProgress: { [first.id]: first.target },
        completedMissions: [first.id, 'w1_score', 'l_thousand']
      },
      FRESH_RUN,
      KEY
    );
    expect(rows.find((r) => r.id === first.id)!.done).toBe(true);
    expect(rows.find((r) => r.id === 'w1_score')!.done).toBe(true);
    expect(rows.find((r) => r.id === 'l_thousand')!.done).toBe(true);
    expect(rows.find((r) => r.id === first.id)!.percent).toBe(100);
  });

  it('percent clamps to 100', () => {
    const daily = getDailyMissions(KEY);
    const rows = getMissionProgressList(
      { ...FRESH_PLAYER, missionProgress: { [daily[0].id]: daily[0].target * 2 } },
      { score: 9000, runPerfects: 500, runGems: 200, maxStreak: 100 },
      KEY
    );
    expect(rows.every((r) => r.percent <= 100)).toBe(true);
    expect(rows.find((r) => r.id === daily[0].id)!.percent).toBe(100);
  });
});
