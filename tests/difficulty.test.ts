import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../src/config/GameConfig';
import { GameStateManager } from '../src/core/GameStateManager';

function legacyJumpDuration(score: number): number {
  return Math.max(
    GAME_CONFIG.JUMP_DURATION_MIN,
    GAME_CONFIG.JUMP_DURATION_BASE - score * GAME_CONFIG.JUMP_DURATION_RAMP
  );
}

function legacySpacing(score: number): number {
  return Math.min(
    GAME_CONFIG.PLATFORM_SPACING_Z_MAX,
    GAME_CONFIG.PLATFORM_SPACING_Z + score * GAME_CONFIG.PLATFORM_SPACING_Z_RAMP
  );
}

function legacyXRange(score: number): number {
  return Math.min(
    GAME_CONFIG.PLATFORM_X_RANGE_MAX,
    GAME_CONFIG.PLATFORM_X_RANGE + score * GAME_CONFIG.PLATFORM_X_RANGE_RAMP
  );
}

function legacyScale(score: number): number {
  return 1 - Math.min(1 - GAME_CONFIG.PLATFORM_SIZE_MIN, score * GAME_CONFIG.PLATFORM_SIZE_RAMP);
}

describe('sawtooth difficulty — parity', () => {
  it('fresh save (totalScore 0): curves equal the legacy formulas at any score', () => {
    const gm = new GameStateManager();
    for (const score of [0, 25, 50, 99, 100, 150, 250, 400, 900]) {
      gm.setScore(score);
      expect(gm.getActiveWorld().id).toBe('sunrise');
      expect(gm.getJumpDuration()).toBeCloseTo(legacyJumpDuration(score), 10);
      expect(gm.getPlatformSpacing()).toBeCloseTo(legacySpacing(score), 10);
      expect(gm.getXRange()).toBeCloseTo(legacyXRange(score), 10);
      expect(gm.getPlatformScale()).toBeCloseTo(legacyScale(score), 10);
    }
  });

  it('default manager matches the legacy start-of-run values', () => {
    const gm = new GameStateManager();
    expect(gm.getJumpDuration()).toBe(0.5);
    expect(gm.getPlatformSpacing()).toBe(3.5);
    expect(gm.getXRange()).toBe(1.2);
    expect(gm.getPlatformScale()).toBe(1);
  });
});

describe('sawtooth difficulty — world selection', () => {
  it('selecting dusk: curves reset to base at the entry score, then dusk ramps', () => {
    const gm = new GameStateManager();
    gm.setUnlockAllWorlds(true);
    expect(gm.selectWorld('dusk')).toBe(true);

    gm.setScore(99);
    expect(gm.getActiveWorld().id).toBe('dusk');
    expect(gm.getJumpDuration()).toBe(0.5);

    gm.setScore(100);
    expect(gm.getActiveWorld().id).toBe('dusk');
    expect(gm.getJumpDuration()).toBe(0.5);
    expect(gm.getXRange()).toBe(1.2);
  });

  it('the run stays in the selected world past the next entry score (no crossing)', () => {
    const gm = new GameStateManager();
    gm.setUnlockAllWorlds(true);
    gm.selectWorld('dusk');
    gm.setScore(249);
    expect(gm.getActiveWorld().id).toBe('dusk');
    gm.setScore(300);
    expect(gm.getActiveWorld().id).toBe('dusk');
  });

  it('uses world ramp overrides past the entry (dusk tier 50)', () => {
    const gm = new GameStateManager();
    gm.setUnlockAllWorlds(true);
    gm.selectWorld('dusk');
    gm.setScore(150);
    expect(gm.getActiveWorld().id).toBe('dusk');
    expect(gm.getXRange()).toBeCloseTo(1.2 + 50 * 0.025, 10);
    expect(gm.getJumpDuration()).toBeCloseTo(Math.max(0.33, 0.5 - 50 * 0.0006), 10);
  });

  it('uses void ramps (void tier 50)', () => {
    const gm = new GameStateManager();
    gm.setUnlockAllWorlds(true);
    gm.selectWorld('void');
    gm.setScore(300);
    expect(gm.getActiveWorld().id).toBe('void');
    expect(gm.getXRange()).toBeCloseTo(1.2 + 50 * 0.03, 10);
    expect(gm.getJumpDuration()).toBeCloseTo(Math.max(0.31, 0.5 - 50 * 0.0007), 10);
  });

  it('void ramps cap at their own maxima, not the global ones', () => {
    const gm = new GameStateManager();
    gm.setUnlockAllWorlds(true);
    gm.selectWorld('void');
    gm.setScore(250 + 9999);
    expect(gm.getActiveWorld().id).toBe('void');
    expect(gm.getXRange()).toBe(3);
    expect(gm.getPlatformSpacing()).toBe(4.6);
    expect(gm.getJumpDuration()).toBe(0.31);
  });
});

describe('world selection via unlock score and overrides', () => {
  it('selectWorld refuses locked worlds and accepts them once unlocked', () => {
    const gm = new GameStateManager();
    expect(gm.selectWorld('dusk')).toBe(false);
    expect(gm.getActiveWorld().id).toBe('sunrise');
    gm.setTotalScore(1000);
    expect(gm.selectWorld('dusk')).toBe(true);
    expect(gm.getActiveWorld().id).toBe('dusk');
  });

  it('void unlocks at 5,000 and its selection sticks', () => {
    const gm = new GameStateManager();
    gm.setTotalScore(5000);
    expect(gm.selectWorld('void')).toBe(true);
    gm.setScore(300);
    expect(gm.getActiveWorld().id).toBe('void');
  });

  it('forceWorld overrides the selection entirely', () => {
    const gm = new GameStateManager();
    gm.setScore(10);
    gm.setWorldOverride('void');
    expect(gm.getActiveWorld().id).toBe('void');
    expect(gm.canSelectWorld(gm.getActiveWorld())).toBe(true);
    expect(gm.getXRange()).toBe(1.2);
    gm.setWorldOverride(null);
    expect(gm.getActiveWorld().id).toBe('sunrise');
  });

  it('unlockAllWorlds lets any world be selected even with totalScore 0', () => {
    const gm = new GameStateManager();
    gm.setUnlockAllWorlds(true);
    expect(gm.selectWorld('void')).toBe(true);
    gm.setScore(999);
    expect(gm.getActiveWorld().id).toBe('void');
  });

  it('unknown ids are rejected by selectWorld', () => {
    const gm = new GameStateManager();
    expect(gm.selectWorld('nope' as never)).toBe(false);
  });

  it('previewWorld loads a locked world as active but never selects it', () => {
    const gm = new GameStateManager();
    expect(gm.previewWorld('dusk')).toBe(true);
    expect(gm.isPreviewLocked()).toBe(true);
    expect(gm.getActiveWorld().id).toBe('dusk');
    expect(gm.getPlayerData().selectedWorld).toBe('sunrise');
    gm.clearPreview();
    expect(gm.isPreviewLocked()).toBe(false);
    expect(gm.getActiveWorld().id).toBe('sunrise');
  });

  it('previewWorld refuses unlocked worlds and locked ids stay non-playable', () => {
    const gm = new GameStateManager();
    expect(gm.previewWorld('sunrise')).toBe(false);
    gm.setTotalScore(1000);
    expect(gm.previewWorld('dusk')).toBe(false);
    expect(gm.selectWorld('void')).toBe(false);
  });

  it('loadPlayerData clears a stale locked preview', () => {
    const gm = new GameStateManager();
    gm.previewWorld('dusk');
    gm.loadPlayerData({ ...gm.getPlayerData() });
    expect(gm.isPreviewLocked()).toBe(false);
    expect(gm.getActiveWorld().id).toBe('sunrise');
  });
});
