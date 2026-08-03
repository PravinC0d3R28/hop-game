import { describe, expect, it } from 'vitest';
import { GameStateManager } from '../src/core/GameStateManager';

describe('streak milestones (simplified v1: single fire reward at 10, any score/world)', () => {
  it('no milestone before 10 perfects', () => {
    const gm = new GameStateManager();
    for (let i = 1; i <= 9; i++) {
      gm.addPerfectStreak();
      expect(gm.checkStreakMilestone()).toBeNull();
    }
  });

  it('fire at exactly 10 perfects, once', () => {
    const gm = new GameStateManager();
    for (let i = 1; i <= 9; i++) gm.addPerfectStreak();
    expect(gm.checkStreakMilestone()).toBeNull();
    gm.addPerfectStreak();
    expect(gm.checkStreakMilestone()).toBe('fire');
    gm.addPerfectStreak();
    expect(gm.checkStreakMilestone()).toBeNull();
  });

  it('ignores score gating — fires at 10 even with a low score', () => {
    const gm = new GameStateManager();
    for (let i = 1; i <= 10; i++) gm.addPerfectStreak();
    expect(gm.checkStreakMilestone()).toBe('fire');
  });

  it('a missed streak resets the counter before 10', () => {
    const gm = new GameStateManager();
    for (let i = 1; i <= 6; i++) gm.addPerfectStreak();
    gm.resetPerfectStreak();
    for (let i = 1; i <= 9; i++) {
      gm.addPerfectStreak();
      expect(gm.checkStreakMilestone()).toBeNull();
    }
    gm.addPerfectStreak();
    expect(gm.checkStreakMilestone()).toBe('fire');
  });

  it('milestone re-fires when the streak is rebuilt to 10 (banner every time)', () => {
    const gm = new GameStateManager();
    for (let i = 1; i <= 10; i++) gm.addPerfectStreak();
    expect(gm.checkStreakMilestone()).toBe('fire');
    gm.resetPerfectStreak();
    for (let i = 1; i <= 9; i++) gm.addPerfectStreak();
    expect(gm.checkStreakMilestone()).toBeNull();
    gm.addPerfectStreak();
    expect(gm.checkStreakMilestone()).toBe('fire');
  });
});

describe('shield ring (FR-4.4)', () => {
  it('grants once per round; a second charge is refused (no stacking)', () => {
    const gm = new GameStateManager();
    expect(gm.getShieldActive()).toBe(false);
    expect(gm.grantShield()).toBe(true);
    expect(gm.getShieldActive()).toBe(true);
    expect(gm.grantShield()).toBe(false);
    expect(gm.getShieldActive()).toBe(true);
  });

  it('consumes exactly one miss', () => {
    const gm = new GameStateManager();
    gm.grantShield();
    expect(gm.consumeShield()).toBe(true);
    expect(gm.getShieldActive()).toBe(false);
    expect(gm.consumeShield()).toBe(false);
  });

  it('no shield to consume without grant', () => {
    const gm = new GameStateManager();
    expect(gm.consumeShield()).toBe(false);
  });

  it('grant is refused after a consumed shield (one per run)', () => {
    const gm = new GameStateManager();
    gm.grantShield();
    gm.consumeShield();
    expect(gm.getShieldActive()).toBe(false);
    expect(gm.grantShield()).toBe(false);
  });

  it('resetGame re-arms the shield for the next run', () => {
    const gm = new GameStateManager();
    gm.grantShield();
    gm.resetGame();
    expect(gm.getShieldActive()).toBe(false);
    expect(gm.grantShield()).toBe(true);
  });
});