import { describe, expect, it } from 'vitest';
import { GameStateManager } from '../src/core/GameStateManager';
import {
  GENERAL_POOL,
  MISSIONS,
  DAILY_PICKS,
  getActiveMissions,
  getDailyMissions,
  getRunWorldId,
  getNextWorldOfId,
  getMissionById,
  todayKey
} from '../src/config/Missions';

/** Fixed date key so the daily draw is deterministic in tests. */
const KEY = '2026-08-03';

/** Advance a run so the given mission's target is met (any metric). */
function meetDailyMission(
  gm: GameStateManager,
  mission: { metric: string; target: number }
): void {
  gm.addScore(mission.target);
  if (mission.metric === 'perfects' || mission.metric === 'streak') {
    for (let i = 0; i < mission.target; i++) {
      if (mission.metric === 'streak') gm.getMutableState().perfectStreak++;
      gm.trackPerfectLanding();
    }
  }
  if (mission.metric === 'gems') {
    for (let i = 0; i < mission.target; i++) gm.trackGemCollected();
  }
}

/** Add a specific amount of the mission's metric (generic, for partial progress). */
function addRunProgress(
  gm: GameStateManager,
  mission: { metric: string },
  amount: number
): void {
  gm.addScore(amount);
  if (mission.metric === 'perfects' || mission.metric === 'streak') {
    for (let i = 0; i < amount; i++) {
      if (mission.metric === 'streak') gm.getMutableState().perfectStreak++;
      gm.trackPerfectLanding();
    }
  }
  if (mission.metric === 'gems') {
    for (let i = 0; i < amount; i++) gm.trackGemCollected();
  }
}

describe('mission deck', () => {
  it('has 20 general + 9 world + 6 lifetime missions, all unique ids, positive rewards', () => {
    const ids = MISSIONS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(MISSIONS.filter((m) => m.kind === 'general')).toHaveLength(20);
    expect(MISSIONS.filter((m) => m.kind === 'world')).toHaveLength(9);
    expect(MISSIONS.filter((m) => m.kind === 'lifetime')).toHaveLength(6);
    for (const m of MISSIONS) {
      expect(m.target).toBeGreaterThan(0);
      expect(m.reward).toBeGreaterThan(0);
    }
  });

  it('general pool is balanced across tiers (7 easy / 7 medium / 6 hard)', () => {
    expect(GENERAL_POOL.filter((m) => m.tier === 'easy')).toHaveLength(7);
    expect(GENERAL_POOL.filter((m) => m.tier === 'medium')).toHaveLength(7);
    expect(GENERAL_POOL.filter((m) => m.tier === 'hard')).toHaveLength(6);
    expect(GENERAL_POOL.every((m) => m.kind === 'general' && m.tier)).toBe(true);
  });

  it('world missions have valid world refs', () => {
    for (const m of MISSIONS.filter((m) => m.kind === 'world')) {
      expect(['sunrise', 'dusk', 'void']).toContain(m.world);
    }
  });

  it('world mission targets scale with world difficulty and sit inside their band', () => {
    const world = MISSIONS.filter((m) => m.kind === 'world');
    const by = (id: string) => world.filter((m) => m.world === id);
    const w1 = by('sunrise');
    const w2 = by('dusk');
    const w3 = by('void');
    const scoreOf = (list: typeof w1, metric: string) => list.find((m) => m.metric === metric)!.target;
    expect(Math.max(...w1.map((m) => m.target))).toBeLessThan(100);
    expect(scoreOf(w1, 'score')).toBeLessThan(100);
    expect(scoreOf(w2, 'score')).toBeGreaterThanOrEqual(100);
    expect(scoreOf(w2, 'score')).toBeLessThan(250);
    expect(scoreOf(w3, 'score')).toBeGreaterThanOrEqual(250);
    expect(Math.max(...w3.map((m) => m.target))).toBeGreaterThanOrEqual(300);
    const sum = (list: typeof w1) => list.reduce((s, m) => s + m.reward, 0);
    expect(sum(w3)).toBeGreaterThan(sum(w2));
    expect(sum(w2)).toBeGreaterThan(sum(w1));
  });
});

describe('daily general missions (economy rework)', () => {
  it('draws exactly 5 unique missions: 2 easy + 2 medium + 1 hard', () => {
    const daily = getDailyMissions(KEY);
    expect(daily).toHaveLength(DAILY_PICKS.easy + DAILY_PICKS.medium + DAILY_PICKS.hard);
    const ids = daily.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(daily.filter((m) => m.tier === 'easy')).toHaveLength(2);
    expect(daily.filter((m) => m.tier === 'medium')).toHaveLength(2);
    expect(daily.filter((m) => m.tier === 'hard')).toHaveLength(1);
  });

  it('is deterministic per date and varies across dates', () => {
    expect(getDailyMissions(KEY)).toEqual(getDailyMissions(KEY));
    const keys = ['2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07'];
    const distinct = new Set(keys.map((k) => getDailyMissions(k).map((m) => m.id).join(',')));
    expect(distinct.size).toBeGreaterThan(1);
  });

  it('todayKey formats local calendar dates', () => {
    expect(todayKey(new Date(2026, 7, 3))).toBe('2026-08-03');
    expect(todayKey(new Date(2026, 0, 9))).toBe('2026-01-09');
  });

  it('daily rewards stay within the economy bounds (max ~165/day)', () => {
    const total = getDailyMissions(KEY).reduce((sum, m) => sum + m.reward, 0);
    expect(total).toBeGreaterThanOrEqual(50);
    expect(total).toBeLessThanOrEqual(165);
  });
});

describe('active mission ladder (bankable worlds only)', () => {
  it('sunrise ladder activates only sunrise world missions (no next preview)', () => {
    const active = getActiveMissions(0, KEY);
    const ids = active.map((m) => m.id);
    expect(ids).toContain('w1_perfects');
    expect(ids).not.toContain('w2_score');
    expect(ids).not.toContain('w3_gems');
    for (const m of getDailyMissions(KEY)) expect(ids).toContain(m.id);
    expect(ids).toContain('l_full_unlock');
  });

  it('dusk ladder activates sunrise + dusk missions, never void', () => {
    const active = getActiveMissions(150, KEY);
    const ids = active.map((m) => m.id);
    expect(ids).toContain('w1_perfects');
    expect(ids).toContain('w2_perfects');
    expect(ids).not.toContain('w3_gems');
  });

  it('void ladder activates all world missions', () => {
    const active = getActiveMissions(300, KEY);
    const ids = active.map((m) => m.id);
    expect(ids).toContain('w1_perfects');
    expect(ids).toContain('w2_perfects');
    expect(ids).toContain('w3_gems');
  });

  it('run world ids follow gate scores', () => {
    expect(getRunWorldId(0)).toBe('sunrise');
    expect(getRunWorldId(99)).toBe('sunrise');
    expect(getRunWorldId(100)).toBe('dusk');
    expect(getRunWorldId(250)).toBe('void');
    expect(getNextWorldOfId('sunrise')).toBe('dusk');
    expect(getNextWorldOfId('void')).toBeNull();
  });

  it('every mission is reachable via something', () => {
    expect(getMissionById('g_on_fire')).toBeDefined();
    expect(getMissionById('nope')).toBeUndefined();
  });
});

describe('mission evaluation (run-scoped, daily set)', () => {
  it('completes a daily general mission on its per-run threshold exactly once', () => {
    const daily = getDailyMissions(KEY);
    const target = daily[0];
    expect(target.tier).toBe('easy');

    const gm = new GameStateManager();
    gm.startGame();
    gm.addScore(target.target - 1);
    expect(gm.evaluateMissions(KEY)).toEqual([]);
    meetDailyMission(gm, target);
    const done = gm.evaluateMissions(KEY);
    expect(done).toContainEqual({
      id: target.id,
      title: target.title,
      reward: target.reward,
      kind: 'general'
    });
    expect(gm.evaluateMissions(KEY)).toEqual([]);
  });

  it('pending coins bank to the wallet once', () => {
    const target = getDailyMissions(KEY)[0];

    const gm = new GameStateManager();
    gm.startGame();
    meetDailyMission(gm, target);
    const done = gm.evaluateMissions(KEY);
    expect(done.map((d) => d.id)).toContain(target.id);
    const expected = done.reduce((sum, d) => sum + d.reward, 0);
    expect(gm.getPendingMissionCoins()).toBe(expected);
    expect(gm.bankPendingMissionCoins()).toBe(expected);
    expect(gm.getPendingMissionCoins()).toBe(0);
    expect(gm.getPlayerData().totalCoins).toBe(expected);
  });

  it('locked world missions never bank progress', () => {
    const gm = new GameStateManager();
    gm.startGame();
    for (let i = 0; i < 10; i++) {
      gm.addScore(5);
      gm.getMutableState().perfectStreak = 0;
      for (let j = 0; j < 5; j++) {
        gm.getMutableState().perfectStreak++;
        gm.trackPerfectLanding();
      }
    }
    expect(gm.getState().runPerfects).toBe(50);
    const done = gm.evaluateMissions(KEY);
    const ids = done.map((d) => d.id);
    expect(ids).toContain('w1_perfects');
    expect(ids).not.toContain('w2_perfects');
    expect(ids).not.toContain('w3_gems');
    expect(gm.getPlayerData().missionProgress['w2_perfects']).toBeUndefined();
    expect(gm.getPlayerData().missionProgress['w3_gems']).toBeUndefined();
  });

  it('world missions unlock when the ladder reaches the world', () => {
    const gm = new GameStateManager();
    gm.loadPlayerData({
      totalCoins: 0,
      bestScore: 150,
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
    });
    gm.startGame();
    for (let i = 0; i < 10; i++) {
      gm.addScore(5);
      gm.getMutableState().perfectStreak = 0;
      for (let j = 0; j < 5; j++) {
        gm.getMutableState().perfectStreak++;
        gm.trackPerfectLanding();
      }
    }
    const done = gm.evaluateMissions(KEY);
    const ids = done.map((d) => d.id);
    expect(ids).toContain('w1_perfects');
    expect(ids).toContain('w2_perfects');
    expect(ids).not.toContain('w3_gems');
  });

  it('streak missions complete from the run max streak', () => {
    const target = getDailyMissions(KEY)[0];

    const gm = new GameStateManager();
    gm.addScore(10);
    meetDailyMission(gm, target);
    const done = gm.evaluateMissions(KEY);
    expect(done).toContainEqual({
      id: target.id,
      title: target.title,
      reward: target.reward,
      kind: 'general'
    });
  });

  it('a mission outside today\'s daily set is not evaluated', () => {
    const dailyIds = new Set(getDailyMissions(KEY).map((m) => m.id));
    const outsider = GENERAL_POOL.find((m) => !dailyIds.has(m.id))!;
    expect(outsider).toBeDefined();

    const gm = new GameStateManager();
    gm.startGame();
    meetDailyMission(gm, outsider);
    const done = gm.evaluateMissions(KEY);
    expect(done.map((d) => d.id)).not.toContain(outsider.id);
  });
});

describe('lifetime missions (persistent counters)', () => {
  it('a veteran save completes retroactive lifetime missions', () => {
    const gm = new GameStateManager();
    gm.loadPlayerData({
      totalCoins: 0,
      bestScore: 0,
      purchasedSkins: ['default'],
      selectedSkin: 'default',
      theme: 'light',
      totalScore: 5200,
      bestPerWorld: [0, 0, 0],
      totalGems: 120,
      totalPerfects: 500,
      bestStreak: 20,
      completedMissions: [],
      missionProgress: {}
    });
    gm.startGame();
    const done = gm.evaluateMissions(KEY);
    const ids = done.map((d) => d.id);
    expect(ids).toContain('l_thousand');
    expect(ids).toContain('l_collector');
    expect(ids).toContain('l_marksman');
    expect(ids).toContain('l_marathon');
    expect(ids).toContain('l_deepest');
    expect(ids).toContain('l_full_unlock');
    gm.evaluateMissions(KEY);
    expect(gm.getPlayerData().completedMissions).toHaveLength(6);
  });

  it('tracks gem counters for lifetime missions', () => {
    const gm = new GameStateManager();
    for (let i = 0; i < 100; i++) gm.trackGemCollected();
    expect(gm.getState().runGems).toBe(100);
    gm.startGame();
    const done = gm.evaluateMissions(KEY);
    expect(done).toContainEqual({ id: 'l_collector', title: 'Collector', reward: 30, kind: 'lifetime' });
  });

  it('general missions are one-time across runs (session-based)', () => {
    const target = getDailyMissions(KEY)[0];

    const gm = new GameStateManager();
    gm.startGame();
    meetDailyMission(gm, target);
    gm.evaluateMissions(KEY);
    expect(gm.getPlayerData().completedMissions).toContain(target.id);

    const remade = new GameStateManager();
    remade.loadPlayerData(gm.getPlayerData());
    remade.startGame();
    meetDailyMission(remade, target);
    const doneIds = remade.evaluateMissions(KEY).map((d) => d.id);
    expect(doneIds).not.toContain(target.id);
    expect(remade.getPlayerData().completedMissions).toContain(target.id);
  });

  it('lifetime missions stay one-time across saves', () => {
    const gm = new GameStateManager();
    gm.loadPlayerData({
      totalCoins: 0,
      bestScore: 0,
      purchasedSkins: ['default'],
      selectedSkin: 'default',
      theme: 'light',
      totalScore: 5200,
      bestPerWorld: [0, 0, 0],
      totalGems: 0,
      totalPerfects: 0,
      bestStreak: 0,
      completedMissions: [],
      missionProgress: {}
    });
    gm.startGame();
    gm.evaluateMissions(KEY);
    const firstCompleted = gm.getPlayerData().completedMissions;
    expect(firstCompleted).toContain('l_thousand');
    const remade = new GameStateManager();
    remade.loadPlayerData(gm.getPlayerData());
    remade.startGame();
    remade.addScore(30);
    const doneIds = remade.evaluateMissions(KEY).map((m) => m.id);
    expect(doneIds).not.toContain('l_thousand');
    expect(remade.getPlayerData().completedMissions).toContain('l_thousand');
  });

  it('persists completed ids for all kinds in the save', () => {
    const target = getDailyMissions(KEY)[0];

    const gm = new GameStateManager();
    gm.startGame();
    meetDailyMission(gm, target);
    gm.evaluateMissions(KEY);
    const ids = gm.getPlayerData().completedMissions;
    expect(ids).toContain(target.id);
    expect(ids).not.toContain('w1_score');
  });
});

describe('session-based missions (progress persists across runs)', () => {
  it('banks partial progress and continues from it on the next run', () => {
    const daily = getDailyMissions(KEY);
    const mission = daily
      .filter((m) => m.metric !== 'streak')
      .sort((a, b) => a.target - b.target)[0];
    expect(mission).toBeDefined();
    const half = Math.floor(mission.target / 2);

    const gm = new GameStateManager();
    gm.startGame();
    addRunProgress(gm, mission, half);
    expect(gm.evaluateMissions(KEY)).toEqual([]);
    expect(gm.getPlayerData().missionProgress[mission.id]).toBe(half);
    expect(gm.getPlayerData().completedMissions).not.toContain(mission.id);

    const remade = new GameStateManager();
    remade.loadPlayerData(gm.getPlayerData());
    remade.startGame();
    addRunProgress(remade, mission, mission.target);
    const done = remade.evaluateMissions(KEY);
    expect(done.map((d) => d.id)).toContain(mission.id);
    expect(remade.getPlayerData().completedMissions).toContain(mission.id);
    expect(remade.getPlayerData().missionProgress[mission.id]).toBe(mission.target);
  });

  it('repeated mid-run evaluation banks each run value only once', () => {
    const gm = new GameStateManager();
    gm.startGame();
    gm.addScore(20);
    gm.evaluateMissions(KEY);
    gm.evaluateMissions(KEY);
    gm.evaluateMissions(KEY);
    expect(gm.getPlayerData().missionProgress['w1_score']).toBe(20);

    gm.addScore(15);
    gm.evaluateMissions(KEY);
    gm.evaluateMissions(KEY);
    expect(gm.getPlayerData().missionProgress['w1_score']).toBe(35);
    expect(gm.getPlayerData().completedMissions).not.toContain('w1_score');
  });

  it('world mission progress accumulates across runs', () => {
    const gm = new GameStateManager();
    gm.startGame();
    for (let i = 0; i < 6; i++) {
      gm.getMutableState().perfectStreak++;
      gm.trackPerfectLanding();
    }
    gm.evaluateMissions(KEY);
    expect(gm.getPlayerData().missionProgress['w1_perfects']).toBe(6);
    expect(gm.getPlayerData().completedMissions).not.toContain('w1_perfects');

    const remade = new GameStateManager();
    remade.loadPlayerData(gm.getPlayerData());
    remade.startGame();
    for (let i = 0; i < 4; i++) {
      remade.getMutableState().perfectStreak++;
      remade.trackPerfectLanding();
    }
    const done = remade.evaluateMissions(KEY);
    expect(done.map((d) => d.id)).toContain('w1_perfects');
    expect(remade.getPlayerData().missionProgress['w1_perfects']).toBe(10);
  });

  it('streak missions keep the best run value (max, not a sum)', () => {
    const gm = new GameStateManager();
    gm.loadPlayerData({
      totalCoins: 0,
      bestScore: 300,
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
    });
    gm.startGame();
    for (let i = 0; i < 10; i++) {
      gm.getMutableState().perfectStreak++;
      gm.trackPerfectLanding();
    }
    gm.evaluateMissions(KEY);
    expect(gm.getPlayerData().missionProgress['w3_streak']).toBe(10);
    expect(gm.getPlayerData().completedMissions).not.toContain('w3_streak');

    const remade = new GameStateManager();
    remade.loadPlayerData(gm.getPlayerData());
    remade.startGame();
    for (let i = 0; i < 8; i++) {
      remade.getMutableState().perfectStreak++;
      remade.trackPerfectLanding();
    }
    remade.evaluateMissions(KEY);
    expect(remade.getPlayerData().missionProgress['w3_streak']).toBe(10);
    expect(remade.getPlayerData().completedMissions).not.toContain('w3_streak');

    remade.resetGame();
    remade.startGame();
    for (let i = 0; i < 12; i++) {
      remade.getMutableState().perfectStreak++;
      remade.trackPerfectLanding();
    }
    const done = remade.evaluateMissions(KEY);
    expect(done.map((d) => d.id)).toContain('w3_streak');
    expect(remade.getPlayerData().missionProgress['w3_streak']).toBe(12);
  });

  it('resets the run delta guard between runs', () => {
    const gm = new GameStateManager();
    gm.startGame();
    gm.addScore(20);
    gm.evaluateMissions(KEY);
    gm.resetGame();
    gm.startGame();
    gm.addScore(20);
    gm.evaluateMissions(KEY);
    expect(gm.getPlayerData().missionProgress['w1_score']).toBe(40);
  });
});
