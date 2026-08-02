import { GAME_CONFIG } from '../config/GameConfig';
import type { GameState, PlayerData } from './Types';
import type { ThemeName } from '../config/Themes';

export const DEFAULT_PLAYER_DATA: PlayerData = {
  totalCoins: 0,
  bestScore: 0,
  purchasedSkins: ['default'],
  selectedSkin: 'default',
  theme: 'light'
};

export const DEFAULT_STATE: GameState = {
  score: 0,
  currentStep: 0,
  isJumping: false,
  isFailed: false,
  isStarted: false,
  isWaitingForTap: false,
  xTarget: 0,
  ballX: 0,
  perfectStreak: 0,
  roundCoins: 0
};

/**
 * Pure game logic: difficulty curves, scoring, economy, persistence sanitizing.
 * No three.js / DOM dependencies — fully unit-testable.
 */
export class GameStateManager {
  private state: GameState = { ...DEFAULT_STATE };
  private playerData: PlayerData = {
    ...DEFAULT_PLAYER_DATA,
    purchasedSkins: [...DEFAULT_PLAYER_DATA.purchasedSkins]
  };

  // ---- state ----
  getState(): Readonly<GameState> {
    return this.state;
  }

  getMutableState(): GameState {
    return this.state;
  }

  getPlayerData(): Readonly<PlayerData> {
    return this.playerData;
  }

  getMutablePlayerData(): PlayerData {
    return this.playerData;
  }

  loadPlayerData(data: PlayerData): void {
    this.playerData = sanitizePlayerData(data);
  }

  // ---- difficulty curves (verified formulas) ----
  getJumpDuration(): number {
    return Math.max(
      GAME_CONFIG.JUMP_DURATION_MIN,
      GAME_CONFIG.JUMP_DURATION_BASE - this.state.score * GAME_CONFIG.JUMP_DURATION_RAMP
    );
  }

  getPlatformSpacing(): number {
    return Math.min(
      GAME_CONFIG.PLATFORM_SPACING_Z_MAX,
      GAME_CONFIG.PLATFORM_SPACING_Z + this.state.score * GAME_CONFIG.PLATFORM_SPACING_Z_RAMP
    );
  }

  getXRange(): number {
    return Math.min(
      GAME_CONFIG.PLATFORM_X_RANGE_MAX,
      GAME_CONFIG.PLATFORM_X_RANGE + this.state.score * GAME_CONFIG.PLATFORM_X_RANGE_RAMP
    );
  }

  getPlatformScale(): number {
    return (
      1 -
      Math.min(
        1 - GAME_CONFIG.PLATFORM_SIZE_MIN,
        this.state.score * GAME_CONFIG.PLATFORM_SIZE_RAMP
      )
    );
  }

  getSpeedLinesIntensity(): number {
    return Math.max(0, Math.min(1, (this.state.score - GAME_CONFIG.SPEED_LINES_START_SCORE) / 70));
  }

  // ---- scoring ----
  resetGame(): void {
    this.state = { ...DEFAULT_STATE };
  }

  startGame(): void {
    this.state.isStarted = true;
    this.state.isWaitingForTap = true;
  }

  fireFirstJump(): void {
    this.state.isWaitingForTap = false;
  }

  setScore(score: number): void {
    this.state.score = score;
  }

  addScore(n: number): number {
    this.state.score += n;
    return this.state.score;
  }

  addPerfectStreak(): number {
    this.state.perfectStreak++;
    return this.state.perfectStreak;
  }

  resetPerfectStreak(): void {
    this.state.perfectStreak = 0;
  }

  addRoundCoin(): void {
    this.state.roundCoins++;
    this.playerData.totalCoins++;
  }

  // ---- economy / shop ----
  buySkin(id: string): boolean {
    const skin = GAME_CONFIG.SHOP_SKINS.find((s) => s.id === id);
    if (!skin) return false;
    if (this.playerData.purchasedSkins.includes(id)) return false;
    if (this.playerData.totalCoins < skin.price) return false;
    this.playerData.totalCoins -= skin.price;
    this.playerData.purchasedSkins.push(id);
    this.playerData.selectedSkin = id;
    return true;
  }

  equipSkin(id: string): boolean {
    if (!this.playerData.purchasedSkins.includes(id)) return false;
    this.playerData.selectedSkin = id;
    return true;
  }

  ownsSkin(id: string): boolean {
    return this.playerData.purchasedSkins.includes(id);
  }

  // ---- theme ----
  setTheme(theme: ThemeName): void {
    this.playerData.theme = theme;
  }

  toggleTheme(): ThemeName {
    const next: ThemeName = this.playerData.theme === 'light' ? 'dark' : 'light';
    this.playerData.theme = next;
    return next;
  }

  // ---- helpers ----
  updateBestScore(score: number): boolean {
    if (score > this.playerData.bestScore) {
      this.playerData.bestScore = score;
      return true;
    }
    return false;
  }
}

/**
 * Mirrors the original `QM(r)` sanitizer:
 * - default skins list (includes "default")
 * - fills missing fields
 * - coerces theme to a valid value
 */
export function sanitizePlayerData(raw: Partial<PlayerData> | null | undefined): PlayerData {
  const purchased = Array.isArray(raw?.purchasedSkins)
    ? (raw.purchasedSkins as string[]).filter((s) => typeof s === 'string')
    : [];
  if (!purchased.includes('default')) purchased.unshift('default');

  const theme: ThemeName =
    raw?.theme === 'dark' || raw?.theme === 'light' ? raw.theme : 'light';

  return {
    totalCoins: typeof raw?.totalCoins === 'number' ? raw.totalCoins : 0,
    bestScore: typeof raw?.bestScore === 'number' ? raw.bestScore : 0,
    purchasedSkins: purchased,
    selectedSkin:
      typeof raw?.selectedSkin === 'string' && purchased.includes(raw.selectedSkin)
        ? raw.selectedSkin
        : 'default',
    theme
  };
}

/**
 * Merge strategy from the original cloud-load: keep max coins/best, union skins,
 * prefer the most recently saved theme/skin.
 */
export function mergePlayerData(base: PlayerData, incoming: PlayerData): PlayerData {
  const purchased = [...base.purchasedSkins];
  for (const s of incoming.purchasedSkins) {
    if (!purchased.includes(s)) purchased.push(s);
  }
  if (!purchased.includes('default')) purchased.unshift('default');
  return {
    totalCoins: Math.max(base.totalCoins, incoming.totalCoins),
    bestScore: Math.max(base.bestScore, incoming.bestScore),
    purchasedSkins: purchased,
    selectedSkin: purchased.includes(incoming.selectedSkin) ? incoming.selectedSkin : base.selectedSkin,
    theme: incoming.theme
  };
}
