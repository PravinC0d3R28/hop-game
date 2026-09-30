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

/** Per-world flag palette: cloth, pole finial accent and debris colors so the
 *  flag vibes with the current world's art direction. */
export interface FlagColors {
  flagColor: number;
  poleColor: number;
  podiumColor: number;
  highlightColor: number;
  shadowColor: number;
  outlineColor: number;
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
  // One-action Play: seconds between pressing Play and the first jump firing
  // automatically (normal runs only — the tutorial keeps its explicit
  // tap-to-start). A tap inside this window cancels it and jumps immediately.
  FIRST_JUMP_ANTICIPATION: number;
  // First-run tutorial pacing. The 5 teaching hops run at lesson speed
  // (GUIDED_LESSON_TIME_SCALE = 1 / 0.4 → 0.4x), then the next GUIDED_RAMP_HOPS
  // hops ease the time scale down to 1.0x (full speed).
  GUIDED_LESSON_TIME_SCALE: number;
  GUIDED_RAMP_HOPS: number;
  /** Total guided hops before the tutorial fully hands over (5 lessons + ramp). */
  GUIDED_TOTAL_HOPS: number;
  /** Forced side-lane x for the drag-left / drag-right lessons. */
  GUIDED_LESSON_LANE: number;
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
  // Failure flag (red marker planted on the missed platform at game over)
  FAIL_FLAG: {
    enabled: boolean;
    /** Size multiplier for the whole flag (2 = twice as big as the base art). */
    scale: number;
    dropHeight: number;
    /** Delay before the flag starts falling — 0 = falls immediately, unbound. */
    dropDelay: number;
    dropDuration: number;
    /** Ball sink distance on game over (the flag waits for this to finish). */
    ballFallDistance: number;
    /** Ball fall duration on game over (matches the flag's dropDelay). */
    ballFallDuration: number;
    /** Crater debris: chips thrown in a ring around the pole base on impact. */
    craterDebrisCount: number;
    /** Radius of the crater debris ring around the pole (root-local units). */
    craterRadius: number;
    flagColor: number;
    /** Pole rod color. */
    poleColor: number;
    /** Raw-wood pole color (the pole is a tapered wooden stake). */
    woodColor: number;
    /** Podium (base) color under the pole. */
    podiumColor: number;
    /** Gold finial accent (pole-top knob). */
    highlightColor: number;
    /** Darker pedestal tier (shadow) under the podium. */
    shadowColor: number;
    /** Warm-dark rim for the podium outline. */
    outlineColor: number;
    debrisCount: number;
    impactShake: number;
    /** Cloth poly-mesh subdivision: columns along the length × rows of height. */
    clothColumns: number;
    clothRows: number;
    /** Cloth flutter speed (radians/sec of the traveling sine). */
    waveSpeed: number;
    /** Cloth flutter amplitude (units of z displacement, 0 = stiff cloth). */
    waveAmp: number;
    /** Cloth ripple spatial frequency (radians/unit along the cloth). */
    waveRipple: number;
    /** Phong specular strength — makes light glint off the swaying cloth. */
    clothShininess: number;
  };
  // Camera
  CAMERA_OFFSET_Y: number;
  CAMERA_OFFSET_Z: number;
  CAMERA_LOOK_AHEAD: number;
  /** Per-world flag palettes so the failure flag vibes with the current
   *  world's art direction (fallback = FAIL_FLAG colors). */
  FLAG_WORLD_PALETTES: Record<WorldId, FlagColors>;
  // Colors
  COLOR_BG: number;
  COLOR_BALL: number;
  COLOR_COIN: number;
  COLOR_OUTLINE: number;
  COLOR_CYCLE_STEPS: number;
  COLOR_PALETTES: ColorPalette[];
  // Audio
  AUDIO_ENABLED: boolean;
  // Branding (flash screen)
  BRANDING: {
    /** Game logomark shown on the flash screen. */
    title: string;
    /** Descriptor line under the logomark. */
    descriptor: string;
    /** Studio name in the flash-screen footer (placeholder until decided). */
    studio: string;
  };
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
    /** Dev: every platform spawns at x=0 (straight line — no lane changes). */
    straightLane: boolean;
    /** Dev: disable per-world sway (platforms never drift sideways). */
    noSway: boolean;
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

  FIRST_JUMP_ANTICIPATION: 0.4,

  GUIDED_LESSON_TIME_SCALE: 2.5,
  GUIDED_RAMP_HOPS: 5,
  GUIDED_TOTAL_HOPS: 10,
  GUIDED_LESSON_LANE: 1.5,

  MISSIONS_UNLOCK_RUNS: 3,

  SHIELD_UNLOCK_SCORE: 1000,

  // Halftone polka dots. Zeroed: the owner removed the dot styling from the
  // tiles. The toon ramp itself stays (tiles still need the top/side value
  // separation); only the dot overlay is gone, so this is the single knob for it.
  DOTS_SCALE: 0.3,
  DOTS_STRENGTH: 0,
  DOTS_SHADOW_MIN: 0.25,
  DOTS_SHADOW_MAX: 0.55,
  SPEED_LINES_START_SCORE: 15,
  SPEED_LINES_MAX_COUNT: 30,
  SPEED_LINES_SPAWN_RATE: 0.03,
  SPEED_LINES_LIFETIME: 0.45,

  FAIL_FLAG: {
    enabled: true,
    scale: 2,
    dropHeight: 7,
    // The flag falls IMMEDIATELY at the miss — its drop is bound to nothing
    // (no waiting for the ball to sink or the game-over screen).
    dropDelay: 0,
    dropDuration: 0.3,
    ballFallDistance: 10,
    ballFallDuration: 0.7,
    craterDebrisCount: 14,
    craterRadius: 0.42,
    flagColor: 0xc0392b,
    poleColor: 0x3a3430,
    woodColor: 0x9a7a52,
    podiumColor: 0x51483f,
    highlightColor: 0xffd166,
    shadowColor: 0xd47a16,
    outlineColor: 0x292522,
    debrisCount: 12,
    impactShake: 1.5,
    clothColumns: 12,
    clothRows: 4,
    waveSpeed: 6,
    waveAmp: 0.14,
    waveRipple: 5,
    clothShininess: 40
  },

  CAMERA_OFFSET_Y: 9.5,
  CAMERA_OFFSET_Z: -8.5,
  CAMERA_LOOK_AHEAD: 3,

  // Per-world flag palettes — the failure flag inherits the world's mood.
  FLAG_WORLD_PALETTES: {
    sunrise: {
      flagColor: 0xe0552e,
      poleColor: 0xf0e6d8,
      podiumColor: 0xe8c87a,
      highlightColor: 0xffd166,
      shadowColor: 0xc99a45,
      outlineColor: 0x8a6a3a
    },
    dusk: {
      flagColor: 0xd8506a,
      poleColor: 0xe8c9a8,
      podiumColor: 0xd8957a,
      highlightColor: 0xffb3a0,
      shadowColor: 0xa86a5a,
      outlineColor: 0x7a4a48
    },
    void: {
      flagColor: 0xff4dd8,
      poleColor: 0x3a4470,
      podiumColor: 0x2a3060,
      highlightColor: 0x38f0e8,
      shadowColor: 0x1a2048,
      outlineColor: 0x101430
    }
  },

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

  BRANDING: {
    title: 'HOP',
    descriptor: 'hop tiles · endless',
    studio: 'STUDIO'
  },

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
    forceWorld: null,
    straightLane: false,
    noSway: false
  }
};
