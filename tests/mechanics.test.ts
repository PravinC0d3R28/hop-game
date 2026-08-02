import { describe, expect, it } from 'vitest';
import { GameStateManager } from '../src/core/GameStateManager';
import { GAME_CONFIG } from '../src/config/GameConfig';

describe('difficulty curves (verified formulas)', () => {
  function atScore(score: number): GameStateManager {
    const gm = new GameStateManager();
    gm.setScore(score);
    return gm;
  }

  it('jump duration starts at base and shrinks, clamped at min', () => {
    expect(atScore(0).getJumpDuration()).toBe(0.5);
    expect(atScore(100).getJumpDuration()).toBeCloseTo(0.45, 5);
    expect(atScore(300).getJumpDuration()).toBeCloseTo(0.35, 5);
    expect(atScore(1000).getJumpDuration()).toBe(0.35); // clamped
  });

  it('platform spacing starts at 3.5 and grows, clamped at 4.5', () => {
    expect(atScore(0).getPlatformSpacing()).toBe(3.5);
    expect(atScore(100).getPlatformSpacing()).toBeCloseTo(3.75, 5);
    expect(atScore(400).getPlatformSpacing()).toBe(4.5);
    expect(atScore(5000).getPlatformSpacing()).toBe(4.5);
  });

  it('x range ramps 1.2 + score*0.02, clamped at 3', () => {
    expect(atScore(0).getXRange()).toBe(1.2);
    expect(atScore(50).getXRange()).toBeCloseTo(2.2, 5);
    expect(atScore(90).getXRange()).toBe(3.0);
    expect(atScore(500).getXRange()).toBe(3.0);
  });

  it('platform scale shrinks from 1 toward 0.9', () => {
    expect(atScore(0).getPlatformScale()).toBeCloseTo(1, 5);
    expect(atScore(100).getPlatformScale()).toBeCloseTo(0.988, 5);
    expect(atScore(833).getPlatformScale()).toBeCloseTo(0.9, 3);
    expect(atScore(5000).getPlatformScale()).toBeCloseTo(0.9, 3);
  });

  it('speed lines intensity kicks in at score 15', () => {
    expect(atScore(0).getSpeedLinesIntensity()).toBe(0);
    expect(atScore(14).getSpeedLinesIntensity()).toBe(0);
    expect(atScore(15).getSpeedLinesIntensity()).toBe(0);
    expect(atScore(85).getSpeedLinesIntensity()).toBe(1);
    expect(atScore(50).getSpeedLinesIntensity()).toBeCloseTo(0.5, 5);
  });
});

describe('scoring (verified original logic)', () => {
  it('perfect streak increments and bonus equals streak', () => {
    const gm = new GameStateManager();
    gm.addScore(1); // base +1
    gm.addPerfectStreak(); // streak = 1
    gm.addScore(gm.getState().perfectStreak); // +1 bonus
    expect(gm.getState().score).toBe(2);
    expect(gm.getState().perfectStreak).toBe(1);

    // second consecutive perfect: base +1, streak = 2, +2 bonus
    gm.addScore(1);
    gm.addPerfectStreak();
    gm.addScore(gm.getState().perfectStreak);
    expect(gm.getState().score).toBe(2 + 1 + 2);
    expect(gm.getState().perfectStreak).toBe(2);
  });

  it('a non-perfect hit resets the streak', () => {
    const gm = new GameStateManager();
    gm.addPerfectStreak();
    gm.addPerfectStreak();
    gm.resetPerfectStreak();
    expect(gm.getState().perfectStreak).toBe(0);
  });

  it('collecting a gem adds score and a coin', () => {
    const gm = new GameStateManager();
    const before = gm.getState().score;
    gm.addRoundCoin();
    gm.addScore(1);
    expect(gm.getState().score).toBe(before + 1);
    expect(gm.getState().roundCoins).toBe(1);
    expect(gm.getPlayerData().totalCoins).toBe(1);
  });

  it('updateBestScore only fires when strictly greater', () => {
    const gm = new GameStateManager();
    expect(gm.updateBestScore(10)).toBe(true);
    expect(gm.getPlayerData().bestScore).toBe(10);
    expect(gm.updateBestScore(10)).toBe(false);
    expect(gm.updateBestScore(7)).toBe(false);
    expect(gm.getPlayerData().bestScore).toBe(10);
  });
});

describe('reset / flow state', () => {
  it('resetGame restores the default state', () => {
    const gm = new GameStateManager();
    gm.startGame();
    gm.fireFirstJump();
    gm.addScore(42);
    gm.addRoundCoin();
    gm.resetGame();
    expect(gm.getState()).toEqual({
      score: 0,
      currentStep: 0,
      isJumping: false,
      isFailed: false,
      isStarted: false,
      isWaitingForTap: false,
      xTarget: 0,
      ballX: 0,
      perfectStreak: 0,
      roundCoins: 0,
      shieldActive: false,
      shieldAwarded: false,
      runPerfects: 0,
      runGems: 0,
      maxStreak: 0
    });
  });

  it('startGame sets started + waiting flags', () => {
    const gm = new GameStateManager();
    gm.startGame();
    expect(gm.getState().isStarted).toBe(true);
    expect(gm.getState().isWaitingForTap).toBe(true);
    gm.fireFirstJump();
    expect(gm.getState().isWaitingForTap).toBe(false);
  });
});
