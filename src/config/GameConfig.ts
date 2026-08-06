import type { WorldId } from './Worlds';

export interface Skin {
  id: string;
  name: string;
  color: number;
  price: number;
}

export interface ColorPalette {
  base: number;
  light: number;
}

export interface GameConfig {
  // Platform geometry
  PLATFORM_WIDTH: number;
  PLATFORM_DEPTH: number;
  PLATFORM_HEIGHT: number;
  // Platform generation
  PLATFORM_SPACING_Z: number;
  PLATFORM_SPACING_Z_RAMP: number;
  PLATFORM_SPACING_Z_MAX: number;
  PLATFORM_X_RANGE: number;
  PLATFORM_X_RANGE_RAMP: number;
  PLATFORM_X_RANGE_MAX: number;
  PLATFORM_SIZE_MIN: number;
  PLATFORM_SIZE_RAMP: number;
  VISIBLE_STEPS: number;
  PLATFORM_RISE_DURATION: number;
  // Ball physics
  BALL_RADIUS: number;
  JUMP_DURATION_BASE: number;
  JUMP_DURATION_MIN: number;
  JUMP_DURATION_RAMP: number;
  BOUNCE_HEIGHT: number;
  X_LERP: number;
  HIT_THRESHOLD: number;
  // Coins (collectible pickups)
  COIN_CHANCE: number;
  COIN_RADIUS: number;
  COIN_COLLECT_THRESHOLD: number;
  // Scoring
  PERFECT_THRESHOLD: number;
  PERFECT_DOT_RADIUS: number;
  // Streak reward (simplified, v1): single tier at STREAK_FIRE perfects
  STREAK_FIRE: number;
  // Total score at which the start-screen world nav arrows are revealed
  WORLD_NAV_REVEAL_SCORE: number;
  // Runs played before the missions button unlocks (0 = from the start).
  MISSIONS_UNLOCK_RUNS: number;
  // Lifetime score at which the streak shield unlocks (World 2 milestone).
  SHIELD_UNLOCK_SCORE: number;
  // Visual effects
  DOTS_SCALE: number;
  DOTS_STRENGTH: number;
  DOTS_SHADOW_MIN: number;
  DOTS_SHADOW_MAX: number;
  SPEED_LINES_START_SCORE: number;
  SPEED_LINES_MAX_COUNT: number;
  SPEED_LINES_SPAWN_RATE: number;
  SPEED_LINES_LIFETIME: number;
  // Camera
  CAMERA_OFFSET_Y: number;
  CAMERA_OFFSET_Z: number;
  CAMERA_LOOK_AHEAD: number;
  // Colors
  COLOR_BG: number;
  COLOR_BALL: number;
  COLOR_COIN: number;
  COLOR_OUTLINE: number;
  COLOR_CYCLE_STEPS: number;
  COLOR_PALETTES: ColorPalette[];
  // Audio
  AUDIO_ENABLED: boolean;
  // Economy / shop
  SHOP_SKINS: Skin[];
  // Debug
  DEBUG: {
    enabled: boolean;
    showHitboxes: boolean;
    showFPS: boolean;
    invincible: boolean;
    unlockAllSkins: boolean;
    infiniteCoins: boolean;
    unlockAllWorlds: boolean;
    forceWorld: WorldId | null;
  };
}

/**
 * Verified verbatim from the original BounceTiles config object (`j`).
 * NOTE: PLATFORM_X_RANGE_RAMP is 0.02 — earlier docs incorrectly claimed 0.00002.
 */
export const GAME_CONFIG: GameConfig = {
  PLATFORM_WIDTH: 2.2,
  PLATFORM_DEPTH: 2.2,
  PLATFORM_HEIGHT: 0.8,

  PLATFORM_SPACING_Z: 3.5,
  PLATFORM_SPACING_Z_RAMP: 0.0025,
  PLATFORM_SPACING_Z_MAX: 4.5,
  PLATFORM_X_RANGE: 1.2,
  PLATFORM_X_RANGE_RAMP: 0.02,
  PLATFORM_X_RANGE_MAX: 3,
  PLATFORM_SIZE_MIN: 0.9,
  PLATFORM_SIZE_RAMP: 0.00012,
  VISIBLE_STEPS: 6,
  PLATFORM_RISE_DURATION: 0.5,

  BALL_RADIUS: 0.35,
  JUMP_DURATION_BASE: 0.5,
  JUMP_DURATION_MIN: 0.35,
  JUMP_DURATION_RAMP: 0.0005,
  BOUNCE_HEIGHT: 2,
  X_LERP: 0.16,
  HIT_THRESHOLD: 1.1,

  COIN_CHANCE: 0.28,
  COIN_RADIUS: 0.22,
  COIN_COLLECT_THRESHOLD: 0.8,

  PERFECT_THRESHOLD: 0.5,
  PERFECT_DOT_RADIUS: 0.18,

  STREAK_FIRE: 10,

  WORLD_NAV_REVEAL_SCORE: 250,

  MISSIONS_UNLOCK_RUNS: 3,

  SHIELD_UNLOCK_SCORE: 1000,

  DOTS_SCALE: 0.3,
  DOTS_STRENGTH: 0.25,
  DOTS_SHADOW_MIN: 0.25,
  DOTS_SHADOW_MAX: 0.55,
  SPEED_LINES_START_SCORE: 15,
  SPEED_LINES_MAX_COUNT: 30,
  SPEED_LINES_SPAWN_RATE: 0.03,
  SPEED_LINES_LIFETIME: 0.45,

  CAMERA_OFFSET_Y: 9.5,
  CAMERA_OFFSET_Z: -8.5,
  CAMERA_LOOK_AHEAD: 3,

  COLOR_BG: 0x2a2a2a,
  COLOR_BALL: 0xd0d8f0,
  COLOR_COIN: 0xf0c020,
  COLOR_OUTLINE: 0x111111,
  COLOR_CYCLE_STEPS: 12,
  COLOR_PALETTES: [
    { base: 0x3b9dff, light: 0x6bb8ff },
    { base: 0x9b4dff, light: 0xb97aff },
    { base: 0xff4d8a, light: 0xff7aaa },
    { base: 0x2ecc40, light: 0x5ddb6e },
    { base: 0xffb020, light: 0xffc850 },
    { base: 0x00cec9, light: 0x40e8e4 },
    { base: 0xff6348, light: 0xff8a70 },
    { base: 0xffd32a, light: 0xffe066 }
  ],

  AUDIO_ENABLED: true,

  SHOP_SKINS: [
    { id: 'default', name: 'Classic', color: 0xd0d8f0, price: 0 },
    { id: 'red', name: 'Ruby Red', color: 0xff4444, price: 50 },
    { id: 'blue', name: 'Ocean Blue', color: 0x4488ff, price: 50 },
    { id: 'green', name: 'Emerald', color: 0x44ff88, price: 75 },
    { id: 'gold', name: 'Golden', color: 0xffd700, price: 100 },
    { id: 'purple', name: 'Violet', color: 0x8844ff, price: 100 },
    { id: 'pink', name: 'Bubblegum', color: 0xff44aa, price: 125 },
    { id: 'cyan', name: 'Cyber Cyan', color: 0x44ffff, price: 150 },
    { id: 'shadow', name: 'Shadow', color: 0x333333, price: 200 }
  ],

  DEBUG: {
    enabled: false,
    showHitboxes: false,
    showFPS: false,
    invincible: false,
    unlockAllSkins: false,
    infiniteCoins: false,
    unlockAllWorlds: false,
    forceWorld: null
  }
};
