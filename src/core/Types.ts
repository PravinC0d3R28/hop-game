import type { ThemeName } from '../config/Themes';

export interface PlayerData {
  totalCoins: number;
  bestScore: number;
  purchasedSkins: string[];
  selectedSkin: string;
  theme: ThemeName;
  totalScore: number;
  bestPerWorld: number[];
  totalGems: number;
  totalPerfects: number;
  bestStreak: number;
  completedMissions: string[];
  /** Session-based mission progress (general/world), cumulative across runs. */
  missionProgress: Record<string, number>;
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
  runGems: number;
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
