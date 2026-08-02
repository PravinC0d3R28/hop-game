import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../src/config/GameConfig';
import { THEMES } from '../src/config/Themes';

describe('GameConfig constants (verified verbatim from the original)', () => {
  it('has the corrected X range ramp', () => {
    expect(GAME_CONFIG.PLATFORM_X_RANGE_RAMP).toBe(0.02);
  });

  it('matches the original difficulty values', () => {
    expect(GAME_CONFIG.PLATFORM_SPACING_Z).toBe(3.5);
    expect(GAME_CONFIG.PLATFORM_SPACING_Z_RAMP).toBe(0.0025);
    expect(GAME_CONFIG.PLATFORM_SPACING_Z_MAX).toBe(4.5);
    expect(GAME_CONFIG.PLATFORM_X_RANGE).toBe(1.2);
    expect(GAME_CONFIG.PLATFORM_X_RANGE_MAX).toBe(3);
    expect(GAME_CONFIG.PLATFORM_SIZE_MIN).toBe(0.9);
    expect(GAME_CONFIG.PLATFORM_SIZE_RAMP).toBe(0.00012);
  });

  it('matches the jump physics', () => {
    expect(GAME_CONFIG.JUMP_DURATION_BASE).toBe(0.5);
    expect(GAME_CONFIG.JUMP_DURATION_MIN).toBe(0.35);
    expect(GAME_CONFIG.JUMP_DURATION_RAMP).toBe(0.0005);
    expect(GAME_CONFIG.BOUNCE_HEIGHT).toBe(2);
    expect(GAME_CONFIG.BALL_RADIUS).toBe(0.35);
    expect(GAME_CONFIG.X_LERP).toBe(0.16);
    expect(GAME_CONFIG.HIT_THRESHOLD).toBe(1.1);
  });

  it('matches gem + perfect + effect configs', () => {
    expect(GAME_CONFIG.GEM_CHANCE).toBe(0.28);
    expect(GAME_CONFIG.GEM_COLLECT_THRESHOLD).toBe(0.8);
    expect(GAME_CONFIG.PERFECT_THRESHOLD).toBe(0.5);
    expect(GAME_CONFIG.SPEED_LINES_START_SCORE).toBe(15);
    expect(GAME_CONFIG.SPEED_LINES_MAX_COUNT).toBe(30);
  });

  it('has verified colors', () => {
    expect(GAME_CONFIG.COLOR_BALL).toBe(0xd0d8f0);
    expect(GAME_CONFIG.COLOR_GEM).toBe(0xf0c020);
    expect(GAME_CONFIG.COLOR_OUTLINE).toBe(0x111111);
    expect(GAME_CONFIG.COLOR_BG).toBe(0x2a2a2a);
  });

  it('has the full 8-palette cycle', () => {
    expect(GAME_CONFIG.COLOR_PALETTES).toHaveLength(8);
    expect(GAME_CONFIG.COLOR_PALETTES[0]).toEqual({ base: 0x3b9dff, light: 0x6bb8ff });
    expect(GAME_CONFIG.COLOR_CYCLE_STEPS).toBe(12);
  });

  it('has 9 shop skins with the documented colors', () => {
    expect(GAME_CONFIG.SHOP_SKINS).toHaveLength(9);
    const byId = Object.fromEntries(GAME_CONFIG.SHOP_SKINS.map((s) => [s.id, s]));
    expect(byId.default.color).toBe(0xd0d8f0);
    expect(byId.green.color).toBe(0x44ff88);
    expect(byId.cyan.color).toBe(0x44ffff);
    expect(byId.shadow.color).toBe(0x333333);
    expect(byId.gold.color).toBe(0xffd700);
  });
});

describe('Themes', () => {
  it('has light and dark themes with verified colors', () => {
    expect(THEMES.light.bg).toBe(0xe8ddd0);
    expect(THEMES.light.shadowColor).toBe(0xb8a898);
    expect(THEMES.light.icon).toBe('\u263e'); // ☾
    expect(THEMES.dark.bg).toBe(0x2a2a2a);
    expect(THEMES.dark.shadowColor).toBe(0x1a1a1a);
    expect(THEMES.dark.icon).toBe('\u2600'); // ☀
  });

  it('has the correct decoration palettes', () => {
    expect(THEMES.light.decorations).toEqual([0xb8c8d8, 0xc0d0e0, 0xb0c0d0, 0xc8d8e8]);
    expect(THEMES.dark.decorations).toEqual([0x444455, 0x3a3a4a, 0x4a4a5a, 0x505060]);
  });
});
