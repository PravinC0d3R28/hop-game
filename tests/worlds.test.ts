import { describe, expect, it } from 'vitest';
import { WORLDS } from '../src/config/Worlds';
import {
  getNextWorld,
  getTierScore,
  getWorldById,
  getWorldForScore,
  getWorldEntryScore,
  isWorldUnlocked
} from '../src/core/WorldLogic';

describe('WORLDS (locked V1 definitions)', () => {
  it('has 3 worlds in gate order', () => {
    expect(WORLDS.map((w) => w.id)).toEqual(['sunrise', 'dusk', 'void']);
  });

  it('locks the §11 numbers', () => {
    expect(WORLDS[0].gateScore).toBe(0);
    expect(WORLDS[0].unlockScore).toBe(0);
    expect(WORLDS[1].gateScore).toBe(100);
    expect(WORLDS[1].unlockScore).toBe(1000);
    expect(WORLDS[2].gateScore).toBe(250);
    expect(WORLDS[2].unlockScore).toBe(5000);
  });

  it('W1 ramps mirror the current GAME_CONFIG parity values', () => {
    const sunrise = WORLDS[0].ramps;
    expect(sunrise.xRangeRamp).toBe(0.02);
    expect(sunrise.xRangeMax).toBe(3);
    expect(sunrise.spacingRamp).toBe(0.0025);
    expect(sunrise.spacingMax).toBe(4.5);
    expect(sunrise.jumpDurationRamp).toBe(0.0005);
    expect(sunrise.jumpDurationMin).toBe(0.35);
    expect(sunrise.sizeRamp).toBe(0.00012);
  });
});

describe('isWorldUnlocked', () => {
  it('sunrise is always unlocked', () => {
    expect(isWorldUnlocked(WORLDS[0], 0)).toBe(true);
  });

  it('dusk unlocks exactly at 1,000', () => {
    expect(isWorldUnlocked(WORLDS[1], 999)).toBe(false);
    expect(isWorldUnlocked(WORLDS[1], 1000)).toBe(true);
    expect(isWorldUnlocked(WORLDS[1], 1001)).toBe(true);
  });

  it('void unlocks exactly at 5,000', () => {
    expect(isWorldUnlocked(WORLDS[2], 4999)).toBe(false);
    expect(isWorldUnlocked(WORLDS[2], 5000)).toBe(true);
  });
});

describe('getWorldForScore', () => {
  it('fresh save stays in sunrise at any score', () => {
    expect(getWorldForScore(0, 0).id).toBe('sunrise');
    expect(getWorldForScore(999, 0).id).toBe('sunrise');
  });

  it('all unlocked: crosses gates at 100 and 250', () => {
    expect(getWorldForScore(99, 100000).id).toBe('sunrise');
    expect(getWorldForScore(100, 100000).id).toBe('dusk');
    expect(getWorldForScore(249, 100000).id).toBe('dusk');
    expect(getWorldForScore(250, 100000).id).toBe('void');
  });

  it('void locked: run stays in dusk past its gate', () => {
    expect(getWorldForScore(300, 1000).id).toBe('dusk');
    expect(getWorldForScore(999, 1000).id).toBe('dusk');
  });
});

describe('tier score (sawtooth base)', () => {
  it('entry scores are the world gates', () => {
    expect(getWorldEntryScore(WORLDS[0])).toBe(0);
    expect(getWorldEntryScore(WORLDS[1])).toBe(100);
    expect(getWorldEntryScore(WORLDS[2])).toBe(250);
  });

  it('tier score resets at each gate', () => {
    expect(getTierScore(90, WORLDS[0])).toBe(90);
    expect(getTierScore(100, WORLDS[1])).toBe(0);
    expect(getTierScore(150, WORLDS[1])).toBe(50);
    expect(getTierScore(250, WORLDS[2])).toBe(0);
    expect(getTierScore(350, WORLDS[2])).toBe(100);
  });

  it('never goes negative below entry', () => {
    expect(getTierScore(50, WORLDS[1])).toBe(0);
    expect(getTierScore(0, WORLDS[2])).toBe(0);
  });
});

describe('world helpers', () => {
  it('getWorldById finds worlds and rejects unknown ids', () => {
    expect(getWorldById('dusk')?.name).toBe('Dusk District');
    expect(getWorldById('nope')).toBeUndefined();
  });

  it('getNextWorld chains sunrise → dusk → void → none', () => {
    expect(getNextWorld(WORLDS[0])?.id).toBe('dusk');
    expect(getNextWorld(WORLDS[1])?.id).toBe('void');
    expect(getNextWorld(WORLDS[2])).toBeUndefined();
  });
});
