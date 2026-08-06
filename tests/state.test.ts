import { describe, expect, it } from 'vitest';
import {
  GameStateManager,
  sanitizePlayerData,
  mergePlayerData,
  DEFAULT_PLAYER_DATA
} from '../src/core/GameStateManager';

describe('sanitizePlayerData (mirrors original QM)', () => {
  it('returns defaults for null/undefined', () => {
    expect(sanitizePlayerData(null)).toEqual(DEFAULT_PLAYER_DATA);
    expect(sanitizePlayerData(undefined)).toEqual(DEFAULT_PLAYER_DATA);
  });

  it('fills missing fields', () => {
    const out = sanitizePlayerData({ totalCoins: 7 } as never);
    expect(out.totalCoins).toBe(7);
    expect(out.bestScore).toBe(0);
    expect(out.purchasedSkins).toEqual(['default']);
    expect(out.selectedSkin).toBe('default');
    expect(out.theme).toBe('light');
  });

  it('clamps volume to 0–100 and sensitivity to the 50-based scale', () => {
    expect(sanitizePlayerData({ soundVolume: 35 } as never).soundVolume).toBe(35);
    expect(sanitizePlayerData({ musicVolume: 150 } as never).musicVolume).toBe(100);
    expect(sanitizePlayerData({ sensitivity: -10 } as never).sensitivity).toBe(0);
    expect(sanitizePlayerData({ sensitivity: 75 } as never).sensitivity).toBe(75);
    expect(sanitizePlayerData({ sensitivity: 'abc' } as never).sensitivity).toBe(50);
    expect(sanitizePlayerData({ sensitivity: undefined } as never).sensitivity).toBe(50);
    expect(sanitizePlayerData({ soundVolume: undefined } as never).soundVolume).toBe(100);
  });

  it('migrates the old default sensitivity (100) to 50 so feel is preserved', () => {
    expect(sanitizePlayerData({ sensitivity: 100 } as never).sensitivity).toBe(50);
    expect(sanitizePlayerData({ sensitivity: 50 } as never).sensitivity).toBe(50);
  });

  it('keeps only known world ids in revealedWorlds', () => {
    expect(sanitizePlayerData({ revealedWorlds: ['dusk', 'void', 'nope'] } as never).revealedWorlds).toEqual([
      'dusk',
      'void'
    ]);
    expect(sanitizePlayerData({ revealedWorlds: ['sunrise', 'sunrise'] } as never).revealedWorlds).toEqual([
      'sunrise'
    ]);
    expect(sanitizePlayerData({} as never).revealedWorlds).toEqual([]);
  });

  it('always keeps default skin first', () => {
    const out = sanitizePlayerData({ purchasedSkins: ['red', 'blue'] } as never);
    expect(out.purchasedSkins[0]).toBe('default');
    expect(out.purchasedSkins).toContain('red');
    expect(out.purchasedSkins).toContain('blue');
  });

  it('rejects an invalid selectedSkin and invalid theme', () => {
    const out = sanitizePlayerData({
      purchasedSkins: ['default'],
      selectedSkin: 'not-a-skin',
      theme: 'neon'
    } as never);
    expect(out.selectedSkin).toBe('default');
    expect(out.theme).toBe('light');
  });

  it('coerces non-numbers to 0', () => {
    const out = sanitizePlayerData({ totalCoins: 'abc', bestScore: null } as never);
    expect(out.totalCoins).toBe(0);
    expect(out.bestScore).toBe(0);
  });

  it('defaults the new progression fields for legacy saves', () => {
    const out = sanitizePlayerData({
      totalCoins: 7,
      bestScore: 50,
      purchasedSkins: ['default'],
      selectedSkin: 'default',
      theme: 'light'
    } as never);
    expect(out.totalScore).toBe(0);
    expect(out.bestPerWorld).toEqual([0, 0, 0]);
    expect(out.selectedWorld).toBe('sunrise');
  });

  it('sanitizes selectedWorld to a known world id', () => {
    expect(sanitizePlayerData({ selectedWorld: 'dusk' } as never).selectedWorld).toBe('dusk');
    expect(sanitizePlayerData({ selectedWorld: 'void' } as never).selectedWorld).toBe('void');
    expect(sanitizePlayerData({ selectedWorld: 'nope' } as never).selectedWorld).toBe('sunrise');
    expect(sanitizePlayerData({ selectedWorld: 42 } as never).selectedWorld).toBe('sunrise');
  });

  it('coerces totalScore', () => {
    expect(sanitizePlayerData({ totalScore: 999 } as never).totalScore).toBe(999);
    expect(sanitizePlayerData({ totalScore: -5 } as never).totalScore).toBe(0);
    expect(sanitizePlayerData({ totalScore: 'abc' } as never).totalScore).toBe(0);
  });

  it('sanitizes bestPerWorld to three non-negative numbers', () => {
    expect(sanitizePlayerData({ bestPerWorld: [10, 40, 90] } as never).bestPerWorld).toEqual([
      10, 40, 90
    ]);
    expect(sanitizePlayerData({ bestPerWorld: ['x', -1, 5] } as never).bestPerWorld).toEqual([
      0, 0, 5
    ]);
    expect(sanitizePlayerData({ bestPerWorld: [1, 2] } as never).bestPerWorld).toEqual([1, 2, 0]);
    expect(sanitizePlayerData({ bestPerWorld: [1, 2, 3, 4] } as never).bestPerWorld).toEqual([
      1, 2, 3
    ]);
  });
});

describe('mergePlayerData (mirrors original cloud-merge)', () => {
  it('takes max coins and best score', () => {
    const base = { ...DEFAULT_PLAYER_DATA, totalCoins: 10, bestScore: 50 };
    const incoming = { ...DEFAULT_PLAYER_DATA, totalCoins: 25, bestScore: 20 };
    const out = mergePlayerData(base, incoming);
    expect(out.totalCoins).toBe(25);
    expect(out.bestScore).toBe(50);
  });

  it('unions purchased skins', () => {
    const base = { ...DEFAULT_PLAYER_DATA, purchasedSkins: ['default', 'red'] };
    const incoming = { ...DEFAULT_PLAYER_DATA, purchasedSkins: ['default', 'green'] };
    const out = mergePlayerData(base, incoming);
    expect(out.purchasedSkins).toEqual(expect.arrayContaining(['default', 'red', 'green']));
  });

  it('prefers the incoming theme', () => {
    const base = { ...DEFAULT_PLAYER_DATA, theme: 'light' as const };
    const incoming = { ...DEFAULT_PLAYER_DATA, theme: 'dark' as const };
    expect(mergePlayerData(base, incoming).theme).toBe('dark');
  });

  it('takes max totalScore, never sums', () => {
    const base = { ...DEFAULT_PLAYER_DATA, totalScore: 10 };
    const incoming = { ...DEFAULT_PLAYER_DATA, totalScore: 25 };
    expect(mergePlayerData(base, incoming).totalScore).toBe(25);
    const other = { ...DEFAULT_PLAYER_DATA, totalScore: 60 };
    expect(mergePlayerData(other, base).totalScore).toBe(60);
  });

  it('merges bestPerWorld element-wise by max', () => {
    const base = { ...DEFAULT_PLAYER_DATA, bestPerWorld: [100, 40, 70] };
    const incoming = { ...DEFAULT_PLAYER_DATA, bestPerWorld: [50, 80, 10] };
    expect(mergePlayerData(base, incoming).bestPerWorld).toEqual([100, 80, 70]);
  });

  it('prefers the incoming selectedWorld when it is valid, else keeps base', () => {
    const base = { ...DEFAULT_PLAYER_DATA, selectedWorld: 'sunrise' as const };
    const incoming = { ...DEFAULT_PLAYER_DATA, selectedWorld: 'dusk' as const };
    expect(mergePlayerData(base, incoming).selectedWorld).toBe('dusk');
    const corrupt = { ...DEFAULT_PLAYER_DATA, selectedWorld: 'nope' as never };
    expect(mergePlayerData(base, corrupt).selectedWorld).toBe('sunrise');
  });
});

describe('shop economy', () => {
  it('buySkin deducts coins and equips', () => {
    const gm = new GameStateManager();
    gm.getMutablePlayerData().totalCoins = 200;
    expect(gm.buySkin('gold')).toBe(true);
    const data = gm.getPlayerData();
    expect(data.totalCoins).toBe(100);
    expect(data.purchasedSkins).toContain('gold');
    expect(data.selectedSkin).toBe('gold');
  });

  it('cannot buy an unaffordable skin', () => {
    const gm = new GameStateManager();
    gm.getMutablePlayerData().totalCoins = 40;
    expect(gm.buySkin('gold')).toBe(false);
    expect(gm.getPlayerData().purchasedSkins).not.toContain('gold');
  });

  it('cannot buy the same skin twice', () => {
    const gm = new GameStateManager();
    gm.getMutablePlayerData().totalCoins = 1000;
    expect(gm.buySkin('red')).toBe(true);
    expect(gm.buySkin('red')).toBe(false);
  });

  it('equipSkin requires ownership', () => {
    const gm = new GameStateManager();
    expect(gm.equipSkin('cyan')).toBe(false);
    gm.getMutablePlayerData().purchasedSkins.push('cyan');
    expect(gm.equipSkin('cyan')).toBe(true);
    expect(gm.getPlayerData().selectedSkin).toBe('cyan');
  });
});
