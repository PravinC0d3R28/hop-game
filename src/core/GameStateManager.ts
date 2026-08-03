import { GAME_CONFIG } from '../config/GameConfig';
import type { GameState, PlayerData } from './Types';
import type { ThemeName } from '../config/Themes';
import { getTierScore, getWorldForScore } from './WorldLogic';
import { WORLDS } from '../config/Worlds';
import type { WorldConfig, WorldId } from '../config/Worlds';
import { getActiveMissions, getMissionById, todayKey } from '../config/Missions';
import type { MissionKind, MissionReward } from '../config/Missions';
import { getMetricValue } from './Progression';

export const DEFAULT_PLAYER_DATA: PlayerData = {
  totalCoins: 0,
  bestScore: 0,
  purchasedSkins: ['default'],
  selectedSkin: 'default',
  theme: 'light',
  totalScore: 0,
  bestPerWorld: [0, 0, 0],
  totalGems: 0,
  totalPerfects: 0,
  bestStreak: 0,
  completedMissions: [],
  missionProgress: {}
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
  roundCoins: 0,
  shieldActive: false,
  shieldAwarded: false,
  runPerfects: 0,
  runGems: 0,
  maxStreak: 0
};

export type StreakMilestone = 'fire';

/**
 * Pure game logic: difficulty curves, scoring, economy, persistence sanitizing.
 * No three.js / DOM dependencies — fully unit-testable.
 */
export class GameStateManager {
  private state: GameState = { ...DEFAULT_STATE };
  private playerData: PlayerData = {
    ...DEFAULT_PLAYER_DATA,
    purchasedSkins: [...DEFAULT_PLAYER_DATA.purchasedSkins],
    completedMissions: [],
    missionProgress: {}
  };
  private worldOverride: WorldId | null = null;
  private unlockAllWorlds = false;
  private totalScore = 0;
  private lastWorldId: WorldId = 'sunrise';
  private pendingMissionCoins = 0;
  private runMissionRewards: MissionReward[] = [];
  /** Per-mission run values already banked this run (delta guard). */
  private runMissionBanked: Record<string, number> = {};

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
    this.clearRunMissions();
  }

  /** Clear the per-run mission state between runs (rewards + delta guard). */
  clearRunMissions(): void {
    this.runMissionRewards = [];
    this.runMissionBanked = {};
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

  /** Single-shot fire reward (simplified v1): fires once at exactly STREAK_FIRE
   *  perfects — any score, any world. */
  checkStreakMilestone(): StreakMilestone | null {
    if (this.state.perfectStreak === GAME_CONFIG.STREAK_FIRE) return 'fire';
    return null;
  }

  getShieldActive(): boolean {
    return this.state.shieldActive;
  }

  /** One shield per run (FR-4.4): returns true only on first reach of streak 5. */
  grantShield(): boolean {
    if (this.state.shieldAwarded) return false;
    this.state.shieldAwarded = true;
    this.state.shieldActive = true;
    return true;
  }

  /** Consume shield on a miss. Returns true if it absorbed the hit. */
  consumeShield(): boolean {
    if (!this.state.shieldActive) return false;
    this.state.shieldActive = false;
    return true;
  }

  resetPerfectStreak(): void {
    this.state.perfectStreak = 0;
  }

  addRoundCoin(): void {
    this.state.roundCoins++;
    this.playerData.totalCoins++;
  }

  // ---- mission tracking (Iteration 6) ----

  /** Called on a perfect landing: run + lifetime perfects, best streak roll-ups. */
  trackPerfectLanding(): void {
    const st = this.state;
    st.runPerfects++;
    this.playerData.totalPerfects++;
    if (st.perfectStreak > st.maxStreak) st.maxStreak = st.perfectStreak;
    if (st.maxStreak > this.playerData.bestStreak) this.playerData.bestStreak = st.maxStreak;
  }

  /** Called on a gem collect: run + lifetime gem counters. */
  trackGemCollected(): void {
    this.state.runGems++;
    this.playerData.totalGems++;
  }

  /**
   * Completes any active, not-yet-done missions whose target is met.
   * Rewards accrue to `pendingMissionCoins` (banked at game over).
   * Returns the newly completed missions for toasts.
   *
   * Session-based semantics (all kinds, one-time in the game's lifetime):
   * - lifetime: derived from persisted counters; recorded in `completedMissions`.
   * - general / world: the run's metric value is banked into persisted
   *   `missionProgress` (capped at the target); progress survives across runs
   *   and the mission completes permanently the moment the cap is reached.
   * Only the delta since the last evaluation this run is banked, so calling
   * this mid-run (every jump / gem) is idempotent.
   */
  evaluateMissions(dateKey: string = todayKey()): MissionReward[] {
    const completed: MissionReward[] = [];
    const run = {
      score: this.state.score,
      runPerfects: this.state.runPerfects,
      runGems: this.state.runGems,
      maxStreak: this.state.maxStreak
    };
    for (const mission of getActiveMissions(this.state.score, dateKey)) {
      if (this.playerData.completedMissions.includes(mission.id)) continue;
      if (mission.kind === 'lifetime') {
        if (getMetricValue(mission.metric, this.playerData, run) >= mission.target) {
          this.playerData.completedMissions.push(mission.id);
          this.completeMission(mission, completed);
        }
        continue;
      }
      const runValue = getMetricValue(mission.metric, this.playerData, run);
      const bankedThisRun = this.runMissionBanked[mission.id] ?? 0;
      const delta = Math.max(0, runValue - bankedThisRun);
      this.runMissionBanked[mission.id] = runValue;
      const progress = Math.min(mission.target, (this.playerData.missionProgress[mission.id] ?? 0) + delta);
      this.playerData.missionProgress[mission.id] = progress;
      if (progress >= mission.target) {
        this.playerData.completedMissions.push(mission.id);
        this.completeMission(mission, completed);
      }
    }
    return completed;
  }

  private completeMission(
    mission: { id: string; title: string; reward: number; kind: MissionKind },
    completed: MissionReward[]
  ): void {
    this.pendingMissionCoins += mission.reward;
    const reward: MissionReward = {
      id: mission.id,
      title: mission.title,
      reward: mission.reward,
      kind: mission.kind
    };
    this.runMissionRewards.push(reward);
    completed.push(reward);
  }

  getPendingMissionCoins(): number {
    return this.pendingMissionCoins;
  }

  /** Missions completed during the current run (for the game-over summary). */
  getRunMissionRewards(): readonly MissionReward[] {
    return this.runMissionRewards.slice();
  }

  /** Bank accumulated mission coins into the wallet. Returns the amount banked. */
  bankPendingMissionCoins(): number {
    if (this.pendingMissionCoins <= 0) return 0;
    this.playerData.totalCoins += this.pendingMissionCoins;
    const amount = this.pendingMissionCoins;
    this.pendingMissionCoins = 0;
    return amount;
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
    bestPerWorld: sanitizeBestPerWorld(raw?.bestPerWorld),
    totalGems: typeof raw?.totalGems === 'number' && raw.totalGems >= 0 ? raw.totalGems : 0,
    totalPerfects: typeof raw?.totalPerfects === 'number' && raw.totalPerfects >= 0 ? raw.totalPerfects : 0,
    bestStreak: typeof raw?.bestStreak === 'number' && raw.bestStreak >= 0 ? raw.bestStreak : 0,
    completedMissions: sanitizeCompletedMissions(raw?.completedMissions),
    missionProgress: sanitizeMissionProgress(raw?.missionProgress)
  };
}

/**
 * Session-based mission progress as a map of mission id → cumulative amount.
 * Unknown ids are dropped, values clamped to [0, target].
 * Legacy saves (no field) default to {}.
 */
function sanitizeMissionProgress(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    const config = getMissionById(id);
    if (!config) continue;
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) continue;
    out[id] = Math.min(config.target, Math.floor(value));
  }
  return out;
}

/**
 * Completed-mission ids as a length-safe array of unique strings.
 * Legacy saves (no field) default to [].
 */
function sanitizeCompletedMissions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item === 'string' && !out.includes(item)) out.push(item);
  }
  return out;
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
  const completedMissions = [...base.completedMissions];
  for (const id of incoming.completedMissions) {
    if (!completedMissions.includes(id)) completedMissions.push(id);
  }
  const missionProgress: Record<string, number> = {};
  for (const id of new Set([...Object.keys(base.missionProgress), ...Object.keys(incoming.missionProgress)])) {
    missionProgress[id] = Math.max(
      base.missionProgress[id] ?? 0,
      incoming.missionProgress[id] ?? 0
    );
  }
  return {
    totalCoins: Math.max(base.totalCoins, incoming.totalCoins),
    bestScore: Math.max(base.bestScore, incoming.bestScore),
    purchasedSkins: purchased,
    selectedSkin: purchased.includes(incoming.selectedSkin) ? incoming.selectedSkin : base.selectedSkin,
    theme: incoming.theme,
    totalScore: Math.max(base.totalScore, incoming.totalScore),
    bestPerWorld: WORLDS.map((_, i) =>
      Math.max(base.bestPerWorld[i] ?? 0, incoming.bestPerWorld[i] ?? 0)
    ),
    totalGems: Math.max(base.totalGems, incoming.totalGems),
    totalPerfects: Math.max(base.totalPerfects, incoming.totalPerfects),
    bestStreak: Math.max(base.bestStreak, incoming.bestStreak),
    completedMissions,
    missionProgress
  };
}
