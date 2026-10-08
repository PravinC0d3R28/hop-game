import { describe, expect, it } from 'vitest';
import {
  LEDGER_TARGET,
  formatCountdown,
  getLedgerInfo,
  getMetricValue,
  getMissionProgressList,
  getTimeUntilNextReset,
  getWorldProgress,
  nextUnlockGoalText,
  stampNextGoalQuiet,
  NEXT_GOAL_QUIET_RUNS
} from '../src/core/Progression';
import { getDailyMissions } from '../src/config/Missions';
import type { PlayerData } from '../src/core/Types';
import { DEFAULT_PLAYER_DATA } from '../src/core/GameStateManager';

const FRESH_PLAYER: PlayerData = {
  ...DEFAULT_PLAYER_DATA,
  selectedWorld: 'sunrise'
};

const FRESH_RUN = { score: 0, runPerfects: 0, runCoins: 0, maxStreak: 0, selectedWorld: 'sunrise' as const };

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

describe('game-over distance line', () => {
  const ready = {
    tutorialDone: true,
    nextGoalNotedUnlock: 0,
    nextGoalQuietFromRun: 0,
    announcementVisible: false
  };

  it('stays quiet until missions unlock or the world-nav teach, including a Play Again that never went Home', () => {
    expect(nextUnlockGoalText({ ...ready, totalScore: 100, runsPlayed: 1 })).toBeNull();
    expect(nextUnlockGoalText({ ...ready, totalScore: 100, runsPlayed: 2 })).toBeNull();
    expect(nextUnlockGoalText({ ...ready, totalScore: 400, runsPlayed: 1 })).toBe('600 to Dusk District');
    expect(nextUnlockGoalText({ ...ready, totalScore: 100, runsPlayed: 3 })).toBe('900 to Dusk District');
  });

  it('names Dusk until Dusk is unlocked, then Deep Void from either earlier world after three runs', () => {
    expect(nextUnlockGoalText({ ...ready, totalScore: 999, runsPlayed: 5 })).toBe('1 to Dusk District');
    const justUnlocked = { ...ready, totalScore: 1000, runsPlayed: 10, nextGoalNotedUnlock: 1000, nextGoalQuietFromRun: 10 };
    expect(nextUnlockGoalText(justUnlocked)).toBeNull();
    expect(nextUnlockGoalText({ ...justUnlocked, totalScore: 1200, runsPlayed: 12 })).toBeNull();
    expect(nextUnlockGoalText({ ...justUnlocked, totalScore: 1200, runsPlayed: 10 + NEXT_GOAL_QUIET_RUNS })).toBe('3,800 to Deep Void');
  });

  it('yields to an unlock or missions card and stays empty once every world is open', () => {
    expect(nextUnlockGoalText({ ...ready, totalScore: 400, runsPlayed: 4, announcementVisible: true })).toBeNull();
    expect(nextUnlockGoalText({ ...ready, totalScore: 400, runsPlayed: 4, tutorialDone: false })).toBeNull();
    expect(nextUnlockGoalText({ ...ready, totalScore: 5000, runsPlayed: 20, nextGoalNotedUnlock: 5000, nextGoalQuietFromRun: 8 })).toBeNull();
  });

  it('starts the quiet clock on the run that unlocks a world and does not restart it', () => {
    const data = { ...FRESH_PLAYER, totalScore: 1000, runsPlayed: 6 };
    stampNextGoalQuiet(data);
    expect(data.nextGoalNotedUnlock).toBe(1000);
    expect(data.nextGoalQuietFromRun).toBe(6);
    data.runsPlayed = 9;
    data.totalScore = 1400;
    stampNextGoalQuiet(data);
    expect(data.nextGoalQuietFromRun).toBe(6);
  });
});

describe('metric value derivation', () => {
  const player: PlayerData = {
    ...FRESH_PLAYER,
    totalScore: 1234,
    totalCoinsCollected: 7,
    totalPerfects: 42,
    bestStreak: 9
  };
  const run = { score: 30, runPerfects: 5, runCoins: 2, maxStreak: 4, selectedWorld: 'sunrise' as const };

  it('maps run metrics to the run snapshot', () => {
    expect(getMetricValue('score', player, run)).toBe(30);
    expect(getMetricValue('coins', player, run)).toBe(2);
    expect(getMetricValue('perfects', player, run)).toBe(5);
    expect(getMetricValue('streak', player, run)).toBe(4);
  });

  it('maps lifetime metrics to the player ledger', () => {
    expect(getMetricValue('totalScore', player, run)).toBe(1234);
    expect(getMetricValue('totalCoinsCollected', player, run)).toBe(7);
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
  it('fresh profile: 5 daily general + 9 world + 6 lifetime rows; locked-world missions locked', () => {
    const rows = getMissionProgressList(FRESH_PLAYER, FRESH_RUN, KEY);
    expect(rows).toHaveLength(20);
    const general = rows.filter((r) => r.kind === 'general');
    expect(general).toHaveLength(5);
    expect(general.map((r) => r.id).sort()).toEqual(getDailyMissions(KEY).map((m) => m.id).sort());
    expect(general.every((r) => r.percent === 0 && !r.done && !r.locked)).toBe(true);
    const w1 = rows.find((r) => r.id === 'w1_coins')!;
    expect(w1.locked).toBe(false);
    const w2 = rows.find((r) => r.id === 'w2_coins')!;
    expect(w2.locked).toBe(true);
    const w3 = rows.find((r) => r.id === 'w3_coins')!;
    expect(w3.locked).toBe(true);
    expect(rows.filter((r) => r.kind === 'world')).toHaveLength(9);
    expect(rows.filter((r) => r.kind === 'lifetime')).toHaveLength(6);
  });

  it('world mission locks follow each world being unlocked, not the selected world', () => {
    const rows = getMissionProgressList(
      { ...FRESH_PLAYER, bestScore: 377, totalScore: 5000 },
      { ...FRESH_RUN, selectedWorld: 'dusk' },
      KEY
    );
    const w1 = rows.find((r) => r.id === 'w1_perfects')!;
    const w2 = rows.find((r) => r.id === 'w2_score')!;
    const w3 = rows.find((r) => r.id === 'w3_coins')!;
    expect(w1.locked).toBe(false);
    expect(w2.locked).toBe(false);
    expect(w3.locked).toBe(false);
  });

  it('missions of a still-locked world stay locked regardless of selection', () => {
    const rows = getMissionProgressList(
      { ...FRESH_PLAYER, totalScore: 1500 },
      { ...FRESH_RUN, selectedWorld: 'dusk' },
      KEY
    );
    const w1 = rows.find((r) => r.id === 'w1_perfects')!;
    const w2 = rows.find((r) => r.id === 'w2_score')!;
    const w3 = rows.find((r) => r.id === 'w3_coins')!;
    expect(w1.locked).toBe(false);
    expect(w2.locked).toBe(false);
    expect(w3.locked).toBe(true);
  });

  it('done world missions show as done, never locked, even outside their world', () => {
    const rows = getMissionProgressList(
      { ...FRESH_PLAYER, completedMissions: ['w1_perfects'] },
      { ...FRESH_RUN, selectedWorld: 'dusk' },
      KEY
    );
    const doneSunrise = rows.find((r) => r.id === 'w1_perfects')!;
    const pendingSunrise = rows.find((r) => r.id === 'w1_coins')!;
    expect(doneSunrise.done).toBe(true);
    expect(doneSunrise.locked).toBe(false);
    // Sunrise is unlocked from the start, so its missions are never faded even
    // while another world is selected — only its done/undone state differs.
    expect(pendingSunrise.locked).toBe(false);
  });

  it('veteran save: lifetime missions show real progress and done state', () => {
    const rows = getMissionProgressList(
      { ...FRESH_PLAYER, totalScore: 1500, totalCoinsCollected: 60, completedMissions: ['l_thousand'] },
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
      { score: 100, runPerfects: 10, runCoins: 5, maxStreak: 10, selectedWorld: 'sunrise' },
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
      { score: 9000, runPerfects: 500, runCoins: 200, maxStreak: 100, selectedWorld: 'sunrise' },
      KEY
    );
    expect(rows.every((r) => r.percent <= 100)).toBe(true);
    expect(rows.find((r) => r.id === daily[0].id)!.percent).toBe(100);
  });
});

describe('daily mission reset countdown', () => {
  it('getTimeUntilNextReset reaches the next local midnight', () => {
    const noon = new Date(2026, 7, 3, 12, 0, 0);
    expect(getTimeUntilNextReset(noon)).toBe(12 * 3600 * 1000);
    const lateNight = new Date(2026, 7, 3, 23, 59, 59, 999);
    expect(getTimeUntilNextReset(lateNight)).toBe(1);
    const exactlyMidnight = new Date(2026, 7, 4, 0, 0, 0);
    expect(getTimeUntilNextReset(exactlyMidnight)).toBe(24 * 3600 * 1000);
  });

  it('formatCountdown renders HH:MM:SS, clamped at 0', () => {
    expect(formatCountdown(12 * 3600 * 1000)).toBe('12:00:00');
    expect(formatCountdown(5 * 3600 * 1000 + 23 * 60 * 1000 + 12 * 1000)).toBe('05:23:12');
    expect(formatCountdown(3661 * 1000)).toBe('01:01:01');
    expect(formatCountdown(0)).toBe('00:00:00');
    expect(formatCountdown(-500)).toBe('00:00:00');
  });
});

