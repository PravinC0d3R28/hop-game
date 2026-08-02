import type { ThemeName } from '../config/Themes';

export interface PlayerData {
  totalCoins: number;
  bestScore: number;
  purchasedSkins: string[];
  selectedSkin: string;
  theme: ThemeName;
  totalScore: number;
  bestPerWorld: number[];
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
