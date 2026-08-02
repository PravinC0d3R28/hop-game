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

  it('theme toggle alternates', () => {
    const gm = new GameStateManager();
    expect(gm.toggleTheme()).toBe('dark');
    expect(gm.toggleTheme()).toBe('light');
  });
});
