import { describe, it, expect } from 'vitest';
import { isDuplicatePlayPress, DUPLICATE_PLAY_GUARD_MS } from '../src/systems/InputSystem';
import { GAME_CONFIG } from '../src/config/GameConfig';

describe('duplicate Play press guard (8.5 input rules)', () => {
  const rect = { left: 100, right: 400, top: 200, bottom: 500 };

  it('ignores a press inside the play rect within the guard window', () => {
    expect(isDuplicatePlayPress(1000, 800, rect, 250, 350)).toBe(true);
  });

  it('ignores a press at the exact press time', () => {
    expect(isDuplicatePlayPress(1000, 1000, rect, 100, 200)).toBe(true);
  });

  it('does not ignore a press after the guard window expires', () => {
    expect(isDuplicatePlayPress(1000 + DUPLICATE_PLAY_GUARD_MS + 1, 1000, rect, 250, 350)).toBe(false);
  });

  it('does not ignore a press outside the play rect', () => {
    expect(isDuplicatePlayPress(1000, 900, rect, 50, 350)).toBe(false);
    expect(isDuplicatePlayPress(1000, 900, rect, 250, 600)).toBe(false);
  });

  it('does not ignore when no Play press was recorded', () => {
    expect(isDuplicatePlayPress(1000, 0, null, 250, 350)).toBe(false);
  });

  it('guard window covers the full anticipation beat', () => {
    expect(DUPLICATE_PLAY_GUARD_MS).toBeGreaterThanOrEqual(GAME_CONFIG.FIRST_JUMP_ANTICIPATION * 1000);
  });
});