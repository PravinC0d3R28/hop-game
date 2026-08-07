import type { ThemeName } from '../config/Themes';
import type { WorldId } from '../config/Worlds';

export interface PlayerData {
  totalCoins: number;
  bestScore: number;
  purchasedSkins: string[];
  selectedSkin: string;
  theme: ThemeName;
  totalScore: number;
  bestPerWorld: number[];
  totalCoinsCollected: number;
  totalPerfects: number;
  bestStreak: number;
  /** Best perfect streak per world (index-aligned with WORLDS). */
  bestStreakPerWorld: number[];
  /** Lifetime number of runs played (incremented once per game over). */
  runsPlayed: number;
  /** Lifetime coins earned (mission rewards + coin pickups), independent of balance. */
  totalCoinsEarned: number;
  /** SFX volume 0–100. */
  soundVolume: number;
  /** Music volume 0–100 (music channel reserved for a future track). */
  musicVolume: number;
  /** Drag sensitivity 0–100 (50 = the original feel). */
  sensitivity: number;
  /** World ids the player has first clicked in the start-screen nav (labels stay "???" until then). */
  revealedWorlds: WorldId[];
  /** True once the one-time "Shield unlocked" card has been shown (fires on the
   *  first arrival at world 2, gated by the shield's World-2 milestone). */
  shieldCardSeen: boolean;
  /** World ids whose locked-world "unlock spotlight" (dim + ring + card) has been
   *  shown — fires once per locked next world, not just world 2. */
  worldSpotlightSeen: WorldId[];
  /** True once the one-time "new missions" spotlight has been shown. */
  missionsSpotlightSeen: boolean;
  /** True once the one-time post-dusk-run callout ("too easy? can you win
   *  here?") teasing the locked void world has been shown. */
  firstDuskCalloutSeen: boolean;
  /** True once the player checked out the missions overlay after it unlocked
   *  (the one-time callout that must be clicked before the next run starts). */
  missionsUnlockSeen: boolean;
  /** True once the one-time first-run tutorial (guided slow-mo first jump) has
   *  been shown; returning players skip it. */
  tutorialDone: boolean;
  completedMissions: string[];
  /** Mission rewards already claimed (completed but unclaimed = claimable). */
  claimedMissions: string[];
  /** Session-based mission progress (general/world), cumulative across runs. */
  missionProgress: Record<string, number>;
  /** The world the player is currently set to play (persisted selection). */
  selectedWorld: WorldId;
}

export interface GameState {
  score: number;
  currentStep: number;
  isJumping: boolean;
  isFailed: boolean;
  isStarted: boolean;
  isWaitingForTap: boolean;
  xTarget: number;
  ballX: number;
  perfectStreak: number;
  roundCoins: number;
  shieldActive: boolean;
  shieldAwarded: boolean;
  runPerfects: number;
  runCoins: number;
  maxStreak: number;
}

export interface JumpParams {
  startZ: number;
  endZ: number;
  startY: number;
  endY: number;
  bounceHeight: number;
  duration: number;
}

export type ThemeNameExport = ThemeName;
