import { GAME_CONFIG } from '../config/GameConfig';
import type { GameState, PlayerData } from './Types';
import type { ThemeName } from '../config/Themes';
import { getTierScore, getWorldById, isWorldUnlocked } from './WorldLogic';
import { WORLDS } from '../config/Worlds';
import type { WorldConfig, WorldId } from '../config/Worlds';
import { getActiveMissions, getMissionById, todayKey, MISSIONS } from '../config/Missions';
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
  totalCoinsCollected: 0,
  totalPerfects: 0,
  bestStreak: 0,
  bestStreakPerWorld: [0, 0, 0],
  runsPlayed: 0,
  totalCoinsEarned: 0,
  soundVolume: 100,
  musicVolume: 100,
  sensitivity: 50,
  completedMissions: [],
  claimedMissions: [],
  missionProgress: {},
  revealedWorlds: [],
  missionsUnlockSeen: false,
  tutorialDone: false,
  shieldCardSeen: false,
  worldSpotlightSeen: [],
  missionsSpotlightSeen: false,
  firstDuskCalloutSeen: false,
  selectedWorld: 'sunrise'
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
  runCoins: 0,
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
    claimedMissions: [],
    missionProgress: {}
  };
  private worldOverride: WorldId | null = null;
  /** Transient "locked preview": loads a locked world's look without making it playable. */
  private previewWorldId: WorldId | null = null;
  private unlockAllWorlds = false;
  private totalScore = 0;
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
    this.previewWorldId = null;
    this.playerData = sanitizePlayerData(data);
    this.setTotalScore(this.playerData.totalScore);
    // Safety clamp: a save pointing at a world the ledger can't reach yet
    // (e.g. hand-edited) falls back to the highest unlocked world.
    if (!this.unlockAllWorlds && !this.worldOverride) {
      const selected = getWorldById(this.playerData.selectedWorld);
      if (selected && !isWorldUnlocked(selected, this.totalScore)) {
        let fallback: WorldConfig = WORLDS[0];
        for (const w of WORLDS) {
          if (isWorldUnlocked(w, this.totalScore)) fallback = w;
        }
        this.playerData.selectedWorld = fallback.id;
      }
    }
  }

  // ---- world ----
  setWorldOverride(id: WorldId | null): void {
    this.worldOverride = id;
  }

  setUnlockAllWorlds(enabled: boolean): void {
    this.unlockAllWorlds = enabled;
  }

  /** DEBUG bypass flag (mirrors GAME_CONFIG.DEBUG.unlockAllWorlds). */
  isUnlockAllWorlds(): boolean {
    return this.unlockAllWorlds;
  }

  /** Cumulative lifetime score for unlock checks (wired from persistence). */
  setTotalScore(total: number): void {
    this.totalScore = total;
  }

  /** Cumulative lifetime score for unlock checks (wired from persistence). */
  getTotalScore(): number {
    return this.totalScore;
  }

  /**
   * Whether a world can be selected: unlock threshold met (or DEBUG bypass).
   * Used by the nav arrows, world chips and mission lock tooltips.
   */
  canSelectWorld(world: WorldConfig): boolean {
    return this.unlockAllWorlds || isWorldUnlocked(world, this.totalScore);
  }

  /**
   * Select the world to play next. Refused while its unlock threshold is not
   * met (unless DEBUG.unlockAllWorlds). Returns true on success.
   */
  selectWorld(id: WorldId): boolean {
    const world = getWorldById(id);
    if (!world) return false;
    if (!this.canSelectWorld(world)) return false;
    this.playerData.selectedWorld = world.id;
    return true;
  }

  /**
   * The world the run targets: the debug override wins, otherwise the
   * persisted selection (world-based model — the run never changes worlds).
   */
  getActiveWorld(): WorldConfig {
    if (this.worldOverride) {
      const override = getWorldById(this.worldOverride);
      if (override) return override;
    }
    if (this.previewWorldId) {
      const preview = getWorldById(this.previewWorldId);
      if (preview) return preview;
    }
    return getWorldById(this.playerData.selectedWorld) ?? WORLDS[0];
  }

  /** Load a world as a locked preview (visuals only — never persisted, never playable). */
  previewWorld(id: WorldId): boolean {
    const world = getWorldById(id);
    if (!world || this.canSelectWorld(world)) return false;
    this.previewWorldId = world.id;
    return true;
  }

  /** End the locked preview, reverting to the persisted selection. */
  clearPreview(): void {
    this.previewWorldId = null;
  }

  /** True while a locked world is previewed behind the lock overlay. */
  isPreviewLocked(): boolean {
    if (!this.previewWorldId) return false;
    const world = getWorldById(this.previewWorldId);
    return !world || !this.canSelectWorld(world);
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
    this.clearRunMissions();
  }

  /** Clear the per-run mission state between runs (delta guard). */
  clearRunMissions(): void {
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

  /** True once the streak shield is a feature the player has earned: the
   *  lifetime score reached the World-2 milestone (or DEBUG unlockAllWorlds).
   *  Before that, a 10-streak still fires the FIRE banner but grants no shield. */
  isShieldUnlocked(): boolean {
    return this.unlockAllWorlds || this.totalScore >= GAME_CONFIG.SHIELD_UNLOCK_SCORE;
  }

  /** One shield per run (FR-4.4): returns true only on the first grant of a run.
   *  Unlock gating (World-2 milestone) lives at the call site so this stays a
   *  pure state-machine mechanic. */
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
    this.playerData.totalCoinsEarned++;
  }

  // ---- mission tracking (Iteration 6) ----

  /** Called on a perfect landing: run + lifetime perfects, best streak roll-ups. */
  trackPerfectLanding(): void {
    const st = this.state;
    st.runPerfects++;
    this.playerData.totalPerfects++;
    if (st.perfectStreak > st.maxStreak) st.maxStreak = st.perfectStreak;
    if (st.maxStreak > this.playerData.bestStreak) this.playerData.bestStreak = st.maxStreak;
    const index = this.getActiveWorldIndex();
    if (st.maxStreak > (this.playerData.bestStreakPerWorld[index] ?? 0)) {
      this.playerData.bestStreakPerWorld[index] = st.maxStreak;
    }
  }

  /** Called on a coin collect: run + lifetime coin counters. */
  trackCoinCollected(): void {
    this.state.runCoins++;
    this.playerData.totalCoinsCollected++;
  }

  /**
   * Completes any active, not-yet-done missions whose target is met.
   * Rewards are NOT banked here — they become claimable in the missions tab
   * (completed but unclaimed) and are awarded on `claimMissionReward`.
   * Returns the newly completed missions for toasts.
   *
   * Session-based semantics (all kinds, one-time in the game's lifetime):
   * - lifetime: derived from persisted counters; recorded in `completedMissions`.
   * - general / world: the run's metric value is banked into persisted
   *   `missionProgress` (capped at the target); progress survives across runs
   *   and the mission completes permanently the moment the cap is reached.
   * Only the delta since the last evaluation this run is banked, so calling
   * this mid-run (every jump / coin) is idempotent.
   *
   * World missions activate for the selected world only — switching worlds
   * freezes their progress until you return. Streak missions are maxima, not
   * counters: progress keeps the best run value ever reached instead of
   * summing streaks across runs.
   */
  evaluateMissions(dateKey: string = todayKey()): MissionReward[] {
    // Missions are fully gated behind MISSIONS_UNLOCK_RUNS completed runs:
    // before that no progress banks, nothing completes and nothing is
    // claimable — the feature only turns on after the 3rd game over.
    if (!this.isMissionsUnlocked()) return [];
    const completed: MissionReward[] = [];
    const run = {
      score: this.state.score,
      runPerfects: this.state.runPerfects,
      runCoins: this.state.runCoins,
      maxStreak: this.state.maxStreak,
      selectedWorld: this.getActiveWorld().id
    };
    for (const mission of getActiveMissions(this.getActiveWorld().id, dateKey)) {
      if (this.playerData.completedMissions.includes(mission.id)) continue;
      if (mission.kind === 'lifetime') {
        const cur = getMetricValue(mission.metric, this.playerData, run);
        const base = this.getLifetimeBaseline(mission.metric);
        let achieved = false;
        if (mission.metric === 'bestStreak') {
          // bestStreak is a max, not a sum — complete only if the threshold was crossed after unlock
          achieved = cur >= mission.target && base < mission.target;
        } else {
          achieved = cur - base >= mission.target;
        }
        if (achieved) {
          this.playerData.completedMissions.push(mission.id);
          this.completeMission(mission, completed);
        }
        continue;
      }
      const runValue = getMetricValue(mission.metric, this.playerData, run);
      if (mission.metric === 'streak') {
        const progress = Math.min(
          mission.target,
          Math.max(this.playerData.missionProgress[mission.id] ?? 0, runValue)
        );
        this.playerData.missionProgress[mission.id] = progress;
        if (progress >= mission.target) {
          this.playerData.completedMissions.push(mission.id);
          this.completeMission(mission, completed);
        }
        continue;
      }
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
    const reward: MissionReward = {
      id: mission.id,
      title: mission.title,
      reward: mission.reward,
      kind: mission.kind
    };
    completed.push(reward);
  }

  /** Missions completed but whose reward hasn't been claimed yet. */
  getClaimableMissionCount(): number {
    return this.getClaimableMissionIds().length;
  }

  /** Ids of completed-but-unclaimed missions (the "!" on the missions button). */
  getClaimableMissionIds(): string[] {
    if (!this.isMissionsUnlocked()) return [];
    return this.playerData.completedMissions.filter((id) => !this.playerData.claimedMissions.includes(id));
  }

  /** Claimable count scoped to one missions tab (daily/world/lifetime). */
  getClaimableCountForKind(kind: MissionKind): number {
    return this.getClaimableMissionIds().filter((id) => getMissionById(id)?.kind === kind).length;
  }

  /** Whether the missions feature is available yet (gated behind N runs). */
  isMissionsUnlocked(): boolean {
    return this.playerData.runsPlayed >= GAME_CONFIG.MISSIONS_UNLOCK_RUNS;
  }

  /** Missions unlocked but the one-time "missions unlocked!" callout hasn't been
   *  checked out yet — until it is, the next run stays blocked. The gate is
   *  satisfied once the teach has been shown at all (missionsSpotlightSeen):
   *  a save where the spotlight fired but the dismiss path never persisted
   *  (e.g. the tab closed mid-teach) must not soft-lock the start screen. */
  hasPendingMissionsUnlock(): boolean {
    return (
      this.isMissionsUnlocked() &&
      !this.playerData.missionsUnlockSeen &&
      !this.playerData.missionsSpotlightSeen
    );
  }

  private getLifetimeBaseline(metric: string): number {
    const b = this.playerData.missionsBaseline;
    if (!b) return 0;
    switch (metric) {
      case 'totalScore': return b.totalScore;
      case 'totalCoinsCollected': return b.totalCoinsCollected;
      case 'totalPerfects': return b.totalPerfects;
      case 'bestStreak': return b.bestStreak;
      default: return 0;
    }
  }

  /** Whether a completed mission's reward has been claimed already. */
  isMissionClaimed(id: string): boolean {
    return this.playerData.claimedMissions.includes(id);
  }

  /**
   * Award a completed mission's reward to the wallet and mark it claimed.
   * Idempotent: returns null for unknown, incomplete or already-claimed ids.
   */
  claimMissionReward(id: string): MissionReward | null {
    if (!this.isMissionsUnlocked()) return null;
    if (this.isMissionClaimed(id)) return null;
    if (!this.playerData.completedMissions.includes(id)) return null;
    const mission = getMissionById(id);
    if (!mission) return null;
    this.playerData.claimedMissions.push(id);
    this.playerData.totalCoins += mission.reward;
    this.playerData.totalCoinsEarned += mission.reward;
    return {
      id: mission.id,
      title: mission.title,
      reward: mission.reward,
      kind: mission.kind
    };
  }

  // ---- dev helpers (window.gameDebug) ----

  /** Dev: force every mission into its completed state, unlocking the missions
   *  gate too, so the whole feature can be QA'd without playing N runs. */
  forceCompleteAllMissions(): void {
    if (this.playerData.runsPlayed < GAME_CONFIG.MISSIONS_UNLOCK_RUNS) {
      this.playerData.runsPlayed = GAME_CONFIG.MISSIONS_UNLOCK_RUNS;
    }
    this.playerData.missionsUnlockSeen = true;
    for (const mission of MISSIONS) {
      if (!this.playerData.completedMissions.includes(mission.id)) {
        this.playerData.completedMissions.push(mission.id);
      }
      this.playerData.missionProgress[mission.id] = mission.target;
    }
  }

  /** Dev: claim every completed-but-unclaimed mission (banks all their coins). */
  claimAllMissions(): MissionReward[] {
    const rewards: MissionReward[] = [];
    for (const id of this.getClaimableMissionIds()) {
      const reward = this.claimMissionReward(id);
      if (reward) rewards.push(reward);
    }
    return rewards;
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
    return WORLDS.indexOf(this.getActiveWorld());
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

  /** Record a completed run (all-time runs played). Call once per game over. */
  trackRunPlayed(): void {
    this.playerData.runsPlayed++;
    // Capture lifetime baseline the moment missions unlock (run 3) so lifetime
    // missions only count progress after the feature exists (fix for pre-unlock retroactive completes).
    if (this.playerData.runsPlayed === GAME_CONFIG.MISSIONS_UNLOCK_RUNS && !this.playerData.missionsBaseline) {
      this.playerData.missionsBaseline = {
        totalScore: this.playerData.totalScore,
        totalCoinsCollected: this.playerData.totalCoinsCollected,
        totalPerfects: this.playerData.totalPerfects,
        bestStreak: this.playerData.bestStreak,
      };
    }
  }
}

/**
 * Mirrors the original `QM(r)` sanitizer:
 * - default skins list (includes "default")
 * - fills missing fields
 * - coerces theme to a valid value
 *
 * The day/night theme toggle was removed in the overhaul (see GAME_MECHANICS.md),
 * so any persisted `theme` is healed to 'light' — dark saves can no longer be
 * produced by the UI and must not be honored on load.
 */
export function sanitizePlayerData(raw: Partial<PlayerData> | null | undefined): PlayerData {
  const purchased = Array.isArray(raw?.purchasedSkins)
    ? (raw.purchasedSkins as string[]).filter((s) => typeof s === 'string')
    : [];
  if (!purchased.includes('default')) purchased.unshift('default');

  // Toggle removed: always light. Ignore any stale `dark` in old saves.
  const theme: ThemeName = 'light';

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
    totalCoinsCollected: sanitizeLegacyTotalCoins(raw),
    totalPerfects: typeof raw?.totalPerfects === 'number' && raw.totalPerfects >= 0 ? raw.totalPerfects : 0,
    bestStreak: typeof raw?.bestStreak === 'number' && raw.bestStreak >= 0 ? raw.bestStreak : 0,
    bestStreakPerWorld: sanitizeBestPerWorld(raw?.bestStreakPerWorld),
    runsPlayed: typeof raw?.runsPlayed === 'number' && raw.runsPlayed >= 0 ? raw.runsPlayed : 0,
    totalCoinsEarned: typeof raw?.totalCoinsEarned === 'number' && raw.totalCoinsEarned >= 0 ? raw.totalCoinsEarned : 0,
    soundVolume: sanitizeVolume(raw?.soundVolume),
    musicVolume: sanitizeVolume(raw?.musicVolume),
    sensitivity: sanitizeSensitivity(raw?.sensitivity),
    completedMissions: sanitizeCompletedMissions(raw?.completedMissions),
    claimedMissions: sanitizeCompletedMissions(raw?.claimedMissions),
    missionProgress: sanitizeMissionProgress(raw?.missionProgress),
    revealedWorlds: sanitizeRevealedWorlds(raw?.revealedWorlds),
    missionsUnlockSeen: raw?.missionsUnlockSeen === true,
    // The tutorial is a true-first-run experience: anyone with an existing save
    // (prior runs) skips it, even though the flag predates them.
    tutorialDone:
      raw?.tutorialDone === true ||
      (typeof raw?.runsPlayed === 'number' && raw.runsPlayed > 0),
    shieldCardSeen: raw?.shieldCardSeen === true,
  worldSpotlightSeen: sanitizeWorldSpotlights(raw?.worldSpotlightSeen),
  missionsSpotlightSeen: raw?.missionsSpotlightSeen === true,
  firstDuskCalloutSeen: raw?.firstDuskCalloutSeen === true,
  selectedWorld: sanitizeWorldId(raw?.selectedWorld),
  missionsBaseline: sanitizeMissionsBaseline(raw?.missionsBaseline, raw)
  };
}

function sanitizeMissionsBaseline(
  raw: unknown,
  playerRaw: Partial<PlayerData> | null | undefined
): PlayerData['missionsBaseline'] {
  if (
    raw &&
    typeof raw === 'object' &&
    typeof (raw as Record<string, unknown>).totalScore === 'number' &&
    typeof (raw as Record<string, unknown>).totalCoinsCollected === 'number' &&
    typeof (raw as Record<string, unknown>).totalPerfects === 'number' &&
    typeof (raw as Record<string, unknown>).bestStreak === 'number'
  ) {
    const r = raw as Record<string, number>;
    return {
      totalScore: Math.max(0, r.totalScore),
      totalCoinsCollected: Math.max(0, r.totalCoinsCollected),
      totalPerfects: Math.max(0, r.totalPerfects),
      bestStreak: Math.max(0, r.bestStreak)
    };
  }
  // Migration: existing saves that already unlocked missions but have no baseline
  // get a baseline pinned to their current totals so lifetime missions start from now.
  if (
    typeof playerRaw?.runsPlayed === 'number' &&
    playerRaw.runsPlayed >= 3
  ) {
    return {
      totalScore: typeof playerRaw.totalScore === 'number' ? Math.max(0, playerRaw.totalScore) : 0,
      totalCoinsCollected: typeof (playerRaw as Record<string, unknown>).totalCoinsCollected === 'number' ? Math.max(0, (playerRaw as Record<string, unknown>).totalCoinsCollected as number) : 0,
      totalPerfects: typeof playerRaw.totalPerfects === 'number' ? Math.max(0, playerRaw.totalPerfects) : 0,
      bestStreak: typeof playerRaw.bestStreak === 'number' ? Math.max(0, playerRaw.bestStreak) : 0
    };
  }
  return undefined;
}

/**
 * Clamp a 0–100 sensitivity setting. 50 = the original pre-feature feel.
 * Legacy saves stored 100 for "original feel" on the old 0–100 scale — those
 * are migrated to 50 so the corrected mapping keeps their actual feel intact.
 * Anything invalid falls back to the current default (50).
 */
function sanitizeSensitivity(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return DEFAULT_PLAYER_DATA.sensitivity;
  const v = Math.min(100, Math.max(0, Math.round(raw)));
  return v === 100 ? 50 : v;
}

/**
 * Revealed world ids (first clicked in the start-screen nav) as a unique
 * array of known world ids. Legacy saves (no field) default to [].
 */
function sanitizeRevealedWorlds(raw: unknown): WorldId[] {
  if (!Array.isArray(raw)) return [];
  const out: WorldId[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const id = item as WorldId;
    if (WORLDS.some((w) => w.id === id) && !out.includes(id)) out.push(id);
  }
  return out;
}

/**
 * World ids whose locked-world spotlight already fired, as a unique array of
 * known ids. Legacy saves stored a single boolean `worldSpotlightSeen` — that
 * old flag is dropped (treated as []) so the redesigned per-world spotlight can
 * teach each locked next world once.
 */
function sanitizeWorldSpotlights(raw: unknown): WorldId[] {
  if (!Array.isArray(raw)) return [];
  const out: WorldId[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const id = item as WorldId;
    if (WORLDS.some((w) => w.id === id) && !out.includes(id)) out.push(id);
  }
  return out;
}

/**
 * Valid world id for the selection, else the default world (sunrise).
 * Legacy saves (no field) default to sunrise.
 */
function sanitizeWorldId(raw: unknown): WorldId {
  if (typeof raw === 'string' && WORLDS.some((w) => w.id === raw)) return raw as WorldId;
  return 'sunrise';
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

/** Clamp a 0–100 volume setting; anything invalid falls back to 100. */
function sanitizeVolume(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 100;
  return Math.min(100, Math.max(0, Math.round(raw)));
}

/**
 * Lifetime coins collected, with a legacy fallback: pre-rename saves stored the
 * counter as `totalGems` — accept both keys so veteran profiles keep their count.
 */
function sanitizeLegacyTotalCoins(raw: Partial<PlayerData> | null | undefined): number {
  const legacy = (raw as unknown as { totalGems?: unknown } | null | undefined)?.totalGems;
  const current = raw?.totalCoinsCollected;
  if (typeof current === 'number' && current >= 0) return current;
  if (typeof legacy === 'number' && legacy >= 0) return legacy;
  return 0;
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
  const claimedMissions = [...base.claimedMissions];
  for (const id of incoming.claimedMissions) {
    if (!claimedMissions.includes(id)) claimedMissions.push(id);
  }
  const missionProgress: Record<string, number> = {};
  for (const id of new Set([...Object.keys(base.missionProgress), ...Object.keys(incoming.missionProgress)])) {
    missionProgress[id] = Math.max(
      base.missionProgress[id] ?? 0,
      incoming.missionProgress[id] ?? 0
    );
  }
  const revealedWorlds = [...base.revealedWorlds];
  for (const id of incoming.revealedWorlds) {
    if (!revealedWorlds.includes(id)) revealedWorlds.push(id);
  }
  return {
    totalCoins: Math.max(base.totalCoins, incoming.totalCoins),
    bestScore: Math.max(base.bestScore, incoming.bestScore),
    purchasedSkins: purchased,
    selectedSkin: purchased.includes(incoming.selectedSkin) ? incoming.selectedSkin : base.selectedSkin,
    // Toggle removed: always light, regardless of either save's theme.
    theme: 'light',
    totalScore: Math.max(base.totalScore, incoming.totalScore),
    bestPerWorld: WORLDS.map((_, i) =>
      Math.max(base.bestPerWorld[i] ?? 0, incoming.bestPerWorld[i] ?? 0)
    ),
    totalCoinsCollected: Math.max(
      sanitizeLegacyTotalCoins(base),
      sanitizeLegacyTotalCoins(incoming)
    ),
    totalPerfects: Math.max(base.totalPerfects, incoming.totalPerfects),
    bestStreak: Math.max(base.bestStreak, incoming.bestStreak),
    bestStreakPerWorld: WORLDS.map((_, i) =>
      Math.max(base.bestStreakPerWorld[i] ?? 0, incoming.bestStreakPerWorld[i] ?? 0)
    ),
    runsPlayed: Math.max(base.runsPlayed, incoming.runsPlayed),
    totalCoinsEarned: Math.max(base.totalCoinsEarned, incoming.totalCoinsEarned),
    soundVolume: sanitizeVolume(incoming.soundVolume),
    musicVolume: sanitizeVolume(incoming.musicVolume),
    sensitivity: sanitizeSensitivity(incoming.sensitivity),
    completedMissions,
    claimedMissions,
    missionProgress,
    revealedWorlds,
    missionsUnlockSeen: base.missionsUnlockSeen || incoming.missionsUnlockSeen,
    tutorialDone: base.tutorialDone || incoming.tutorialDone,
    shieldCardSeen: base.shieldCardSeen || incoming.shieldCardSeen,
    worldSpotlightSeen: Array.from(
      new Set([...base.worldSpotlightSeen, ...incoming.worldSpotlightSeen])
    ),
    missionsSpotlightSeen: base.missionsSpotlightSeen || incoming.missionsSpotlightSeen,
    firstDuskCalloutSeen: base.firstDuskCalloutSeen || incoming.firstDuskCalloutSeen,
    selectedWorld: WORLDS.some((w) => w.id === incoming.selectedWorld)
      ? incoming.selectedWorld
      : base.selectedWorld
  };
}
