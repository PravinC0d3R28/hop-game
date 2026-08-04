export type WorldId = 'sunrise' | 'dusk' | 'void';

export interface RampOverrides {
  xRangeRamp: number;
  xRangeMax: number;
  spacingRamp: number;
  spacingMax: number;
  jumpDurationRamp: number;
  jumpDurationMin: number;
  sizeRamp: number;
}

export interface SwayParams {
  amplitude: number;
  speed: number;
  /** 0..1 — fraction of platforms that sway; the rest stay static (deterministic cadence). */
  ratio: number;
}

export interface WorldConfig {
  id: WorldId;
  name: string;
  tagline: string;
  /** Short teaser shown in the lock overlay while the world is still locked. */
  lockedDescription: string;
  unlockScore: number;
  gateScore: number;
  ramps: RampOverrides;
  sway: SwayParams;
}

/**
 * Locked V1 world definitions (§11 of docs/OVERHAUL_BRAINSTORM.md).
 * Ordered by gate: sunrise → dusk → void.
 * W1 ramps mirror current GAME_CONFIG values (parity baseline for the sawtooth).
 * W2/W3 ramp values are initial estimates — re-tuned in Iteration 1 with tests.
 */
export const WORLDS: WorldConfig[] = [
  {
    id: 'sunrise',
    name: 'Sunrise Peaks',
    tagline: 'Golden hills, soft light',
    lockedDescription: 'Golden peaks under a warm morning sun.',
    unlockScore: 0,
    gateScore: 0,
    ramps: {
      xRangeRamp: 0.02,
      xRangeMax: 3,
      spacingRamp: 0.0025,
      spacingMax: 4.5,
      jumpDurationRamp: 0.0005,
      jumpDurationMin: 0.35,
      sizeRamp: 0.00012
    },
    sway: { amplitude: 0, speed: 0, ratio: 0 }
  },
  {
    id: 'dusk',
    name: 'Dusk District',
    tagline: 'Swaying streets at sunset',
    lockedDescription: 'Streets sway as the sun melts below the skyline.',
    unlockScore: 1000,
    gateScore: 100,
    ramps: {
      xRangeRamp: 0.025,
      xRangeMax: 3,
      spacingRamp: 0.0025,
      spacingMax: 4.5,
      jumpDurationRamp: 0.0006,
      jumpDurationMin: 0.33,
      sizeRamp: 0.00012
    },
    sway: { amplitude: 0.6, speed: 1.6, ratio: 0.66 }
  },
  {
    id: 'void',
    name: 'Deep Void',
    tagline: 'Where the neon never sleeps',
    lockedDescription: 'A neon void where the ground never holds still.',
    unlockScore: 5000,
    gateScore: 250,
    ramps: {
      xRangeRamp: 0.03,
      xRangeMax: 3,
      spacingRamp: 0.0028,
      spacingMax: 4.6,
      jumpDurationRamp: 0.0007,
      jumpDurationMin: 0.31,
      sizeRamp: 0.00012
    },
    sway: { amplitude: 0.9, speed: 2.4, ratio: 0.75 }
  }
];
