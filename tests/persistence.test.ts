import { describe, expect, it } from 'vitest';
import { PersistenceManager, type SaveBackend } from '../src/managers/PersistenceManager';
import { GameStateManager, DEFAULT_PLAYER_DATA } from '../src/core/GameStateManager';

class MemoryBackend implements SaveBackend {
  data: string | null = null;
  async load() {
    return this.data ? (JSON.parse(this.data) as never) : null;
  }
  async save(d: never) {
    this.data = JSON.stringify(d);
  }
}

describe('PersistenceManager round-trip', () => {
  it('empty store loads as defaults including new progression fields', async () => {
    const pm = new PersistenceManager(new MemoryBackend());
    const loaded = await pm.load();
    expect(loaded.totalScore).toBe(0);
    expect(loaded.bestPerWorld).toEqual([0, 0, 0]);
  });

  it('saving then loading round-trips the new fields', async () => {
    const pm = new PersistenceManager(new MemoryBackend());
    const data = { ...DEFAULT_PLAYER_DATA, totalScore: 1234, bestPerWorld: [300, 150, 0] };
    await pm.save(data);
    const loaded = await pm.load();
    expect(loaded.totalScore).toBe(1234);
    expect(loaded.bestPerWorld).toEqual([300, 150, 0]);
  });

  it('sanitizes corrupt persisted data on load', async () => {
    const backend = new MemoryBackend();
    backend.data = JSON.stringify({
      totalScore: -1,
      bestPerWorld: ['bad', 10]
    });
    const pm = new PersistenceManager(backend);
    const loaded = await pm.load();
    expect(loaded.totalScore).toBe(0);
    expect(loaded.bestPerWorld).toEqual([0, 10, 0]);
    expect(loaded.purchasedSkins).toContain('default');
  });

  it('merge takes max for totalScore and bestPerWorld', () => {
    const pm = new PersistenceManager(new MemoryBackend());
    const base = { ...DEFAULT_PLAYER_DATA, totalScore: 500, bestPerWorld: [900, 40, 10] };
    const incoming = { ...DEFAULT_PLAYER_DATA, totalScore: 700, bestPerWorld: [10, 60, 0] };
    const merged = pm.merge(base, incoming);
    expect(merged.totalScore).toBe(700);
    expect(merged.bestPerWorld).toEqual([900, 60, 10]);
  });
});

describe('game-over banking', () => {
  it('bankTotalScore adds the run score to the ledger once', () => {
    const gm = new GameStateManager();
    gm.setScore(120);
    expect(gm.bankTotalScore()).toBe(120);
    expect(gm.getPlayerData().totalScore).toBe(120);
  });

  it('subsequent runs accumulate (one bank per run)', () => {
    const gm = new GameStateManager();
    gm.setScore(100);
    gm.bankTotalScore();
    gm.resetGame();
    gm.setScore(250);
    gm.bankTotalScore();
    expect(gm.getPlayerData().totalScore).toBe(350);
  });

  it('banking accumulates toward world unlocks', () => {
    const gm = new GameStateManager();
    for (let i = 0; i < 4; i++) {
      gm.setScore(300);
      gm.bankTotalScore();
      gm.resetGame();
    }
    expect(gm.getPlayerData().totalScore).toBe(1200);
    gm.setScore(120);
    expect(gm.getActiveWorld().id).toBe('dusk');
  });

  it('updateBestPerWorld records the active world index only, by max', () => {
    const gm = new GameStateManager();
    gm.setUnlockAllWorlds(true);
    gm.setScore(130);
    gm.updateBestPerWorld(130);
    expect(gm.getPlayerData().bestPerWorld).toEqual([0, 130, 0]);

    gm.updateBestPerWorld(90);
    expect(gm.getPlayerData().bestPerWorld).toEqual([0, 130, 0]);
    gm.updateBestPerWorld(200);
    expect(gm.getPlayerData().bestPerWorld).toEqual([0, 200, 0]);
  });

  it('loadPlayerData syncs world unlocks from a migrated save', () => {
    const gm = new GameStateManager();
    gm.loadPlayerData({ ...DEFAULT_PLAYER_DATA, totalScore: 6000 });
    gm.setScore(300);
    expect(gm.getActiveWorld().id).toBe('void');
  });
});