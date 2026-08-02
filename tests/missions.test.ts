import { describe, expect, it } from 'vitest';
import { GameStateManager } from '../src/core/GameStateManager';
import { MISSIONS, getActiveMissions, getRunWorldId, getNextWorldOfId, getMissionById } from '../src/config/Missions';

describe('mission deck', () => {
  it('has 6 general + 9 world + 6 lifetime missions, all unique ids, positive rewards', () => {
    const ids = MISSIONS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(MISSIONS.filter((m) => m.kind === 'general')).toHaveLength(6);
    expect(MISSIONS.filter((m) => m.kind === 'world')).toHaveLength(9);
    expect(MISSIONS.filter((m) => m.kind === 'lifetime')).toHaveLength(6);
    for (const m of MISSIONS) {
      expect(m.target).toBeGreaterThan(0);
      expect(m.reward).toBeGreaterThan(0);
    }
  });

  it('world missions have valid world refs', () => {
    for (const m of MISSIONS.filter((m) => m.kind === 'world')) {
      expect(['sunrise', 'dusk', 'void']).toContain(m.world);
    }
  });
});

describe('active mission ladder (current / next world)', () => {
  it('sunrise start activates sunrise + dusk missions, never void', () => {
    const active = getActiveMissions(0);
    const ids = active.map((m) => m.id);
    expect(ids).toContain('w1_perfects');
    expect(ids).toContain('w2_score');
    expect(ids).not.toContain('w3_gems');
    expect(ids).toContain('g_first_steps');
    expect(ids).toContain('l_full_unlock');
  });

  it('inside dusk activates dusk + void world missions, drops sunrise', () => {
    const active = getActiveMissions(150);
    const ids = active.map((m) => m.id);
    expect(ids).not.toContain('w1_perfects');
    expect(ids).toContain('w2_perfects');
    expect(ids).toContain('w3_gems');
  });

  it('inside void activates only void world missions', () => {
    const active = getActiveMissions(300);
    const ids = active.map((m) => m.id);
    expect(ids).not.toContain('w2_perfects');
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

describe('mission evaluation (run-scoped)', () => {
  it('completes on a per-run score threshold exactly once', () => {
    const gm = new GameStateManager();
    gm.startGame();
    gm.addScore(24);
    expect(gm.evaluateMissions()).toEqual([]);
    gm.addScore(1);
    const done = gm.evaluateMissions();
    expect(done).toContainEqual({ id: 'g_first_steps', title: 'First Steps', reward: 10, kind: 'general' });
    gm.setScore(25);
    expect(gm.evaluateMissions()).toEqual([]);
  });

  it('pending coins bank to the wallet once', () => {
    const gm = new GameStateManager();
    gm.startGame();
    gm.addScore(26);
    gm.evaluateMissions();
    expect(gm.getPendingMissionCoins()).toBe(10);
    expect(gm.bankPendingMissionCoins()).toBe(10);
    expect(gm.getPendingMissionCoins()).toBe(0);
    expect(gm.getPlayerData().totalCoins).toBe(10);
  });

  it('completes world missions from tracked run stats', () => {
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
    const done = gm.evaluateMissions();
    const ids = done.map((d) => d.id);
    expect(ids).toContain('w1_perfects');
    expect(ids).toContain('w2_perfects');
  });

  it('fire streak mission completes from the run max streak', () => {
    const gm = new GameStateManager();
    gm.addScore(10);
    for (let i = 0; i < 10; i++) {
      gm.getMutableState().perfectStreak++;
      gm.trackPerfectLanding();
    }
    const done = gm.evaluateMissions();
    expect(done).toContainEqual({ id: 'g_on_fire', title: 'On Fire', reward: 30, kind: 'general' });
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
      completedMissions: []
    });
    gm.startGame();
    const done = gm.evaluateMissions();
    const ids = done.map((d) => d.id);
    expect(ids).toContain('l_thousand');
    expect(ids).toContain('l_collector');
    expect(ids).toContain('l_marksman');
    expect(ids).toContain('l_marathon');
    expect(ids).toContain('l_deepest');
    expect(ids).toContain('l_full_unlock');
    gm.evaluateMissions();
    expect(gm.getPlayerData().completedMissions).toHaveLength(6);
  });

  it('tracks gem counters for lifetime missions', () => {
    const gm = new GameStateManager();
    for (let i = 0; i < 100; i++) gm.trackGemCollected();
    expect(gm.getState().runGems).toBe(100);
    gm.startGame();
    const done = gm.evaluateMissions();
    expect(done).toContainEqual({ id: 'l_collector', title: 'Collector', reward: 30, kind: 'lifetime' });
  });

  it('re-completes per-run missions on later runs (not one-time)', () => {
    const gm = new GameStateManager();
    gm.startGame();
    gm.addScore(30);
    gm.evaluateMissions();
    expect(gm.getPlayerData().completedMissions).not.toContain('g_first_steps');
    const remade = new GameStateManager();
    remade.loadPlayerData(gm.getPlayerData());
    remade.startGame();
    remade.addScore(25);
    expect(remade.evaluateMissions()).toContainEqual({ id: 'g_first_steps', title: 'First Steps', reward: 10, kind: 'general' });
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
      completedMissions: []
    });
    gm.startGame();
    gm.evaluateMissions();
    const firstCompleted = gm.getPlayerData().completedMissions;
    expect(firstCompleted).toContain('l_thousand');
    const remade = new GameStateManager();
    remade.loadPlayerData(gm.getPlayerData());
    remade.startGame();
    remade.addScore(30);
    const doneIds = remade.evaluateMissions().map((m) => m.id);
    expect(doneIds).not.toContain('l_thousand');
    expect(remade.getPlayerData().completedMissions).toContain('l_thousand');
  });

  it('persists only lifetime mission ids by default', () => {
    const gm = new GameStateManager();
    gm.startGame();
    gm.addScore(30);
    gm.evaluateMissions();
    const ids = gm.getPlayerData().completedMissions;
    expect(ids).not.toContain('g_first_steps');
    expect(ids).not.toContain('w1_score');
    expect(ids.every((id) => id.startsWith('l_'))).toBe(true);
  });
});