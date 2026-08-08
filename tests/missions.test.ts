import { describe, expect, it } from 'vitest';
import { DEFAULT_PLAYER_DATA, GameStateManager } from '../src/core/GameStateManager';
import { GAME_CONFIG } from '../src/config/GameConfig';
import {
  GENERAL_POOL,
  MISSIONS,
  DAILY_PICKS,
  getActiveMissions,
  getDailyMissions,
  getNextWorldOfId,
  getMissionById,
  todayKey
} from '../src/config/Missions';

/** Fixed date key so the daily draw is deterministic in tests. */
const KEY = '2026-08-03';

/** Play the required number of runs so the missions feature unlocks. */
function unlockMissions(gm: GameStateManager): void {
  for (let i = 0; i < GAME_CONFIG.MISSIONS_UNLOCK_RUNS; i++) gm.trackRunPlayed();
}


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
  if (mission.metric === 'coins') {
    for (let i = 0; i < mission.target; i++) gm.trackCoinCollected();
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
  if (mission.metric === 'coins') {
    for (let i = 0; i < amount; i++) gm.trackCoinCollected();
  }
}

describe('mission deck', () => {
  it('has 30 general + 9 world + 6 lifetime missions, all unique ids, positive rewards', () => {
    const ids = MISSIONS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(MISSIONS.filter((m) => m.kind === 'general')).toHaveLength(30);
    expect(MISSIONS.filter((m) => m.kind === 'world')).toHaveLength(9);
    expect(MISSIONS.filter((m) => m.kind === 'lifetime')).toHaveLength(6);
    for (const m of MISSIONS) {
      expect(m.target).toBeGreaterThan(0);
      expect(m.reward).toBeGreaterThan(0);
    }
  });

  it('general pool is balanced across tiers (10 easy / 10 medium / 10 hard)', () => {
    expect(GENERAL_POOL.filter((m) => m.tier === 'easy')).toHaveLength(10);
    expect(GENERAL_POOL.filter((m) => m.tier === 'medium')).toHaveLength(10);
    expect(GENERAL_POOL.filter((m) => m.tier === 'hard')).toHaveLength(10);
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

  it('daily sets truly reset: consecutive days differ and the 30-mission pool cycles fully', () => {
    const days = Array.from({ length: 10 }, (_, i) => {
      const key = `2026-08-${String(3 + i).padStart(2, '0')}`;
      return getDailyMissions(key).map((m) => m.id);
    });
    for (let i = 1; i < days.length; i++) {
      expect(days[i]).not.toEqual(days[i - 1]);
    }
    const covered = new Set(days.flat());
    expect(covered.size).toBe(GENERAL_POOL.length);
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

describe('active missions by selected world', () => {
  it('sunrise selection activates only sunrise world missions (no next preview)', () => {
    const active = getActiveMissions('sunrise', KEY);
    const ids = active.map((m) => m.id);
    expect(ids).toContain('w1_perfects');
    expect(ids).not.toContain('w2_score');
    expect(ids).not.toContain('w3_coins');
    for (const m of getDailyMissions(KEY)) expect(ids).toContain(m.id);
    expect(ids).toContain('l_full_unlock');
  });

  it('dusk selection activates dusk missions, never the neighbours', () => {
    const active = getActiveMissions('dusk', KEY);
    const ids = active.map((m) => m.id);
    expect(ids).not.toContain('w1_perfects');
    expect(ids).toContain('w2_perfects');
    expect(ids).toContain('w2_score');
    expect(ids).not.toContain('w3_coins');
  });

  it('void selection activates void missions only', () => {
    const active = getActiveMissions('void', KEY);
    const ids = active.map((m) => m.id);
    expect(ids).not.toContain('w1_perfects');
    expect(ids).not.toContain('w2_perfects');
    expect(ids).toContain('w3_coins');
  });

  it('general and lifetime missions are always active in any world', () => {
    for (const world of ['sunrise', 'dusk', 'void'] as const) {
      const active = getActiveMissions(world, KEY);
      for (const m of getDailyMissions(KEY)) {
        expect(active.map((a) => a.id)).toContain(m.id);
      }
      expect(active.map((a) => a.id)).toContain('l_thousand');
    }
  });

  it('world ids chain sunrise → dusk → void → none', () => {
    expect(getNextWorldOfId('sunrise')).toBe('dusk');
    expect(getNextWorldOfId('dusk')).toBe('void');
    expect(getNextWorldOfId('void')).toBeNull();
  });

  it('every mission is reachable via something', () => {
    expect(getMissionById('g_on_fire')).toBeDefined();
    expect(getMissionById('nope')).toBeUndefined();
  });
});

describe('mission evaluation (run-scoped, daily set)', () => {
  it('completes a daily general mission on its per-run threshold exactly once', () => {
    const target = getDailyMissions(KEY).find((m) => m.tier === 'easy')!;
    expect(target.tier).toBe('easy');

    const gm = new GameStateManager();
    unlockMissions(gm);
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

  it('completed missions become claimable and award coins exactly once on claim', () => {
    const target = getDailyMissions(KEY)[0];

    const gm = new GameStateManager();
    unlockMissions(gm);
    gm.startGame();
    meetDailyMission(gm, target);
    const done = gm.evaluateMissions(KEY);
    expect(done.map((d) => d.id)).toContain(target.id);

    // Completed but NOT banked automatically.
    expect(gm.getPlayerData().totalCoins).toBe(0);
    expect(gm.getClaimableMissionIds()).toContain(target.id);
    expect(gm.isMissionClaimed(target.id)).toBe(false);
    const before = gm.getClaimableMissionCount();
    expect(before).toBeGreaterThan(0);

    const reward = gm.claimMissionReward(target.id);
    expect(reward).toMatchObject({ id: target.id, reward: target.reward });
    expect(gm.getPlayerData().totalCoins).toBe(target.reward);
    expect(gm.getPlayerData().totalCoinsEarned).toBe(target.reward);
    expect(gm.isMissionClaimed(target.id)).toBe(true);
    expect(gm.getClaimableMissionIds()).not.toContain(target.id);
    expect(gm.getClaimableMissionCount()).toBe(before - 1);

    // Idempotent: claiming twice never double-pays.
    expect(gm.claimMissionReward(target.id)).toBeNull();
    expect(gm.getPlayerData().totalCoins).toBe(target.reward);
  });

  it('claiming a mission is idempotent and unknown/incomplete ids are refused', () => {
    const gm = new GameStateManager();
    unlockMissions(gm);
    gm.startGame();
    expect(gm.claimMissionReward('nope')).toBeNull();

    const target = getDailyMissions(KEY)[0];
    meetDailyMission(gm, target);
    gm.evaluateMissions(KEY);
    gm.claimMissionReward(target.id);
    expect(gm.claimMissionReward(target.id)).toBeNull();
    expect(gm.getPlayerData().totalCoins).toBe(target.reward);
  });

  it('locked world missions never bank progress', () => {
    const gm = new GameStateManager();
    unlockMissions(gm);
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
    expect(ids).not.toContain('w3_coins');
    expect(gm.getPlayerData().missionProgress['w2_perfects']).toBeUndefined();
    expect(gm.getPlayerData().missionProgress['w3_coins']).toBeUndefined();
  });

  it('world missions bank only for the selected world once it is unlocked', () => {
    const gm = new GameStateManager();
    gm.loadPlayerData({
      ...DEFAULT_PLAYER_DATA,
      runsPlayed: GAME_CONFIG.MISSIONS_UNLOCK_RUNS,
      bestScore: 150,
      totalScore: 1000,
      selectedWorld: 'dusk'
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
    expect(ids).not.toContain('w1_perfects');
    expect(ids).toContain('w2_perfects');
    expect(ids).not.toContain('w3_coins');
  });

  it('streak missions complete from the run max streak', () => {
    const target = getDailyMissions(KEY)[0];

    const gm = new GameStateManager();
    unlockMissions(gm);
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

  it('is fully locked until MISSIONS_UNLOCK_RUNS runs have been played', () => {
    const target = getDailyMissions(KEY)[0];
    const gm = new GameStateManager();
    gm.startGame();
    meetDailyMission(gm, target);
    expect(gm.getPlayerData().runsPlayed).toBe(0);
    expect(gm.evaluateMissions(KEY)).toEqual([]);
    expect(gm.getPlayerData().completedMissions).not.toContain(target.id);
    expect(gm.getClaimableMissionIds()).toEqual([]);
    expect(gm.claimMissionReward(target.id)).toBeNull();
    expect(gm.getPlayerData().totalCoins).toBe(0);

    for (let i = 0; i < GAME_CONFIG.MISSIONS_UNLOCK_RUNS - 1; i++) gm.trackRunPlayed();
    gm.startGame();
    meetDailyMission(gm, target);
    expect(gm.isMissionsUnlocked()).toBe(false);
    expect(gm.evaluateMissions(KEY)).toEqual([]);

    unlockMissions(gm);
    gm.startGame();
    meetDailyMission(gm, target);
    expect(gm.isMissionsUnlocked()).toBe(true);
    expect(gm.evaluateMissions(KEY).map((d) => d.id)).toContain(target.id);
    expect(gm.getClaimableMissionIds()).toContain(target.id);
    expect(gm.claimMissionReward(target.id)?.id).toBe(target.id);
    expect(gm.getPlayerData().totalCoins).toBe(target.reward);
  });
});

describe('lifetime missions (persistent counters)', () => {
  it('a veteran save completes retroactive lifetime missions', () => {
    const gm = new GameStateManager();
    gm.loadPlayerData({
      ...DEFAULT_PLAYER_DATA,
      runsPlayed: GAME_CONFIG.MISSIONS_UNLOCK_RUNS,
      totalScore: 5200,
      totalCoinsCollected: 120,
      totalPerfects: 500,
      bestStreak: 20,
      selectedWorld: 'sunrise'
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

  it('tracks coin counters for lifetime missions', () => {
    const gm = new GameStateManager();
    unlockMissions(gm);
    for (let i = 0; i < 100; i++) gm.trackCoinCollected();
    expect(gm.getState().runCoins).toBe(100);
    gm.startGame();
    const done = gm.evaluateMissions(KEY);
    expect(done).toContainEqual({ id: 'l_collector', title: 'Collector', reward: 30, kind: 'lifetime' });
  });

  it('general missions are one-time across runs (session-based)', () => {
    const target = getDailyMissions(KEY)[0];

    const gm = new GameStateManager();
    unlockMissions(gm);
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
      ...DEFAULT_PLAYER_DATA,
      runsPlayed: GAME_CONFIG.MISSIONS_UNLOCK_RUNS,
      totalScore: 5200,
      selectedWorld: 'sunrise'
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
    unlockMissions(gm);
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
    unlockMissions(gm);
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
    unlockMissions(gm);
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
    unlockMissions(gm);
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
      ...DEFAULT_PLAYER_DATA,
      runsPlayed: GAME_CONFIG.MISSIONS_UNLOCK_RUNS,
      bestScore: 300,
      totalScore: 5000,
      selectedWorld: 'void'
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
    unlockMissions(gm);
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

describe('dev helpers (forceCompleteAllMissions / claimAllMissions)', () => {
  it('forceCompleteAllMissions unlocks the gate and completes every mission', () => {
    const gm = new GameStateManager();
    expect(gm.isMissionsUnlocked()).toBe(false);
    gm.forceCompleteAllMissions();
    expect(gm.isMissionsUnlocked()).toBe(true);
    expect(gm.getPlayerData().completedMissions.length).toBe(MISSIONS.length);
    for (const m of MISSIONS) {
      expect(gm.getPlayerData().completedMissions).toContain(m.id);
      expect(gm.getPlayerData().missionProgress[m.id]).toBe(m.target);
    }
    expect(gm.getClaimableMissionIds().length).toBe(MISSIONS.length);
  });

  it('claimAllMissions banks every reward exactly once', () => {
    const gm = new GameStateManager();
    gm.forceCompleteAllMissions();
    const before = gm.getPlayerData().totalCoins;
    const rewards = gm.claimAllMissions();
    expect(rewards.length).toBe(MISSIONS.length);
    const expected = MISSIONS.reduce((sum, m) => sum + m.reward, 0);
    expect(gm.getPlayerData().totalCoins).toBe(before + expected);
    expect(gm.getClaimableMissionIds().length).toBe(0);

    // idempotent — second call claims nothing
    const again = gm.claimAllMissions();
    expect(again.length).toBe(0);
    expect(gm.getPlayerData().totalCoins).toBe(before + expected);
  });
});

