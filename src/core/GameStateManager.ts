import { GAME_CONFIG } from '../config/GameConfig';
import type { GameState, PlayerData } from './Types';
import type { ThemeName } from '../config/Themes';
import { getTierScore, getWorldForScore } from './WorldLogic';
import { WORLDS } from '../config/Worlds';
import type { WorldConfig, WorldId } from '../config/Worlds';

export const DEFAULT_PLAYER_DATA: PlayerData = {
  totalCoins: 0,
  bestScore: 0,
  purchasedSkins: ['default'],
  selectedSkin: 'default',
  theme: 'light',
  totalScore: 0,
  bestPerWorld: [0, 0, 0]
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
  private worldOverride: WorldId | null = null;
  private unlockAllWorlds = false;
  private totalScore = 0;
  private lastWorldId: WorldId = 'sunrise';

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
    this.setTotalScore(this.playerData.totalScore);
  }

  // ---- world ----
  setWorldOverride(id: WorldId | null): void {
    this.worldOverride = id;
  }

  setUnlockAllWorlds(enabled: boolean): void {
    this.unlockAllWorlds = enabled;
  }

  /** Cumulative lifetime score for unlock checks (wired from persistence). */
  setTotalScore(total: number): void {
    this.totalScore = total;
  }

  getActiveWorld(): WorldConfig {
    if (this.worldOverride) {
      const override = WORLDS.find((w) => w.id === this.worldOverride);
      if (override) return override;
    }
    const unlockScore = this.unlockAllWorlds ? Number.POSITIVE_INFINITY : this.totalScore;
    return getWorldForScore(this.state.score, unlockScore);
  }

  /**
   * Detects crossing into a new world since the last call (single-shot).
   * Returns the newly entered world exactly once, otherwise null.
   */
  evaluateWorldChange(): WorldConfig | null {
    const active = this.getActiveWorld();
    if (active.id !== this.lastWorldId) {
      this.lastWorldId = active.id;
      return active;
    }
    return null;
  }

  // ---- difficulty curves (world ramps over tier score) ----
  getJumpDuration(): number {
    const world = this.getActiveWorld();
    return Math.max(
      world.ramps.jumpDurationMin,
      GAME_CONFIG.JUMP_DURATION_BASE - getTierScore(this.state.score, world) * world.ramps.jumpDurationRamp
    );
  }

  getPlatformSpacing(): number {
    const world = this.getActiveWorld();
    return Math.min(
      world.ramps.spacingMax,
      GAME_CONFIG.PLATFORM_SPACING_Z + getTierScore(this.state.score, world) * world.ramps.spacingRamp
    );
  }

  getXRange(): number {
    const world = this.getActiveWorld();
    return Math.min(
      world.ramps.xRangeMax,
      GAME_CONFIG.PLATFORM_X_RANGE + getTierScore(this.state.score, world) * world.ramps.xRangeRamp
    );
  }

  getPlatformScale(): number {
    const world = this.getActiveWorld();
    return (
      1 -
      Math.min(
        1 - GAME_CONFIG.PLATFORM_SIZE_MIN,
        getTierScore(this.state.score, world) * world.ramps.sizeRamp
      )
    );
  }

  getSpeedLinesIntensity(): number {
    return Math.max(0, Math.min(1, (this.state.score - GAME_CONFIG.SPEED_LINES_START_SCORE) / 70));
  }

  // ---- scoring ----
  resetGame(): void {
    this.state = { ...DEFAULT_STATE };
    this.lastWorldId = 'sunrise';
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

  /** Index of the active world (for per-world bests). */
  getActiveWorldIndex(): number {
    return Math.max(0, WORLDS.indexOf(this.getActiveWorld()));
  }

  updateBestPerWorld(score: number): boolean {
    const index = this.getActiveWorldIndex();
    if (score > this.playerData.bestPerWorld[index]) {
      this.playerData.bestPerWorld[index] = score;
      return true;
    }
    return false;
  }

  /** Add the current run's final score to the lifetime ledger exactly once per call. */
  bankTotalScore(): number {
    this.playerData.totalScore += this.state.score;
    this.setTotalScore(this.playerData.totalScore);
    return this.playerData.totalScore;
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
    totalCoins: typeof raw?.totalCoins === 'number' && raw.totalCoins >= 0 ? raw.totalCoins : 0,
    bestScore: typeof raw?.bestScore === 'number' && raw.bestScore >= 0 ? raw.bestScore : 0,
    purchasedSkins: purchased,
    selectedSkin:
      typeof raw?.selectedSkin === 'string' && purchased.includes(raw.selectedSkin)
        ? raw.selectedSkin
        : 'default',
    theme,
    totalScore: typeof raw?.totalScore === 'number' && raw.totalScore >= 0 ? raw.totalScore : 0,
    bestPerWorld: sanitizeBestPerWorld(raw?.bestPerWorld)
  };
}

/**
 * Per-world bests as a fixed length-3 array of non-negative numbers.
 * Legacy saves (no field) default to zeros; corrupt shapes are reset.
 */
function sanitizeBestPerWorld(raw: unknown, size: number = WORLDS.length): number[] {
  if (!Array.isArray(raw)) return Array(size).fill(0);
  const out: number[] = [];
  for (let i = 0; i < size; i++) {
    const v = raw[i];
    out.push(typeof v === 'number' && v >= 0 ? v : 0);
  }
  return out;
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
    theme: incoming.theme,
    totalScore: Math.max(base.totalScore, incoming.totalScore),
    bestPerWorld: WORLDS.map((_, i) =>
      Math.max(base.bestPerWorld[i] ?? 0, incoming.bestPerWorld[i] ?? 0)
    )
  };
}
