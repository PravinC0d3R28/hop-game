import { GAME_CONFIG } from '../config/GameConfig';
import { THEMES, type ThemeName } from '../config/Themes';
import type { GameStateManager } from '../core/GameStateManager';
import { EventBus, GAME_EVENTS } from '../core/EventBus';
import type { WorldId } from '../config/Worlds';
import { getNextWorld, getPreviousWorld, getWorldById } from '../core/WorldLogic';
import { WORLDS, type WorldConfig } from '../config/Worlds';
import type { MissionKind, MissionReward } from '../config/Missions';
import { getMissionProgressList, getTimeUntilNextReset, formatCountdown } from '../core/Progression';
import type { RendererSystem } from '../systems/RendererSystem';
import type { ShadowSystem } from '../systems/ShadowSystem';
import type { BackgroundSystem } from '../systems/BackgroundSystem';
import type { BallEntity } from '../entities/BallEntity';
import { FireOverlay } from '../systems/FireOverlay';
import { gsap } from 'gsap';
import { Vector3 } from 'three';

/**
 * All DOM UI: start screen, score, coin counters, shop, game-over.
 * Faithful port of the original `no` / `uc` / `as` / `io` / `zy` / `uc` handlers,
 * with localStorage persistence instead of the YouTube cloud.
 */
export class UIManager {
  private scoreEl = this.el<HTMLElement>('score');
  private coinAmount = this.el<HTMLElement>('coin-amount');
  private startScreen = this.el<HTMLElement>('start-screen');
  private gameOverScreen = this.el<HTMLElement>('gameover-screen');
  private goScore = this.el<HTMLElement>('go-score');
  private goBestVal = this.el<HTMLElement>('go-best-val');
  private goNewBest = this.el<HTMLElement>('go-new-best');
  private goRoundCoins = this.el<HTMLElement>('go-round-coins');
  private goTotalCoins = this.el<HTMLElement>('go-total-coins');
  private continueBtn = this.el<HTMLButtonElement>('go-continue-btn');
  private homeBtn = this.el<HTMLButtonElement>('go-home-btn');
  private goUnlockCallout = this.el<HTMLElement>('go-unlock-callout');
  private goMissionsCallout = this.el<HTMLElement>('go-missions-callout');
  private perfectPopupContainer = this.el<HTMLElement>('perfect-popup-container');
  private perfectPopupActive: HTMLElement | null = null;
  private pauseBtn = this.el<HTMLButtonElement>('pause-btn');
  private pauseOverlay = this.el<HTMLElement>('pause-overlay');
  private pauseResumeBtn = this.el<HTMLButtonElement>('pause-resume-btn');
  private pauseHomeBtn = this.el<HTMLButtonElement>('pause-home-btn');
  pauseCountdown = this.el<HTMLElement>('pause-countdown');
  private pauseCardEl = this.pauseOverlay.querySelector<HTMLElement>('.pause-card')!;
  private shopOverlay = this.el<HTMLElement>('shop-overlay');
  private shopClose = this.el<HTMLElement>('shop-close');
  private shopScroll = this.el<HTMLElement>('shop-scroll');
  private shopCoinDisplay = this.el<HTMLElement>('shop-coin-display');
  private confettiContainer = this.el<HTMLElement>('confetti-container');
  private splashScreen = this.el<HTMLElement>('splash-screen');
  private shopBtn = this.el<HTMLButtonElement>('shop-btn');
  private worldTitle = this.el<HTMLElement>('world-title');
  private missionsBtn = this.el<HTMLButtonElement>('missions-btn');
  private missionsMenuItem = this.el<HTMLElement>('missions-menu-item');
  private missionsOverlay = this.el<HTMLElement>('missions-overlay');
  private missionsClose = this.el<HTMLElement>('missions-close');
  private missionsList = this.el<HTMLElement>('missions-list');
  private missionsScroll = this.el<HTMLElement>('missions-scroll');
  private missionsCountdown = this.el<HTMLElement>('missions-countdown');
  private missionsTabs = Array.from(document.querySelectorAll<HTMLButtonElement>('.missions-tab'));
  private missionsTabsBar = this.el<HTMLElement>('missions-tabs-bar');
  private worldNav = this.el<HTMLElement>('world-nav');
  private worldPrev = this.el<HTMLElement>('world-prev');
  private worldNext = this.el<HTMLElement>('world-next');
  private worldFar = this.el<HTMLElement>('world-far');
  private worldBubble = this.el<HTMLElement>('world-bubble');
  private lockOverlay = this.el<HTMLElement>('lock-overlay');
  private lockClose = this.el<HTMLButtonElement>('lock-close');
  private lockWorldName = this.el<HTMLElement>('lock-world-name');
  private lockDesc = this.el<HTMLElement>('lock-desc');
  private lockTagline = this.el<HTMLElement>('lock-tagline');
  private lockFill = this.el<HTMLElement>('lock-fill');
  private lockProgressText = this.el<HTMLElement>('lock-progress-text');
  private lockRemaining = this.el<HTMLElement>('lock-remaining');
  private menuBtns = this.el<HTMLElement>('menu-btns');
  private goWorld = this.el<HTMLElement>('go-world');
  private playBtn = this.el<HTMLElement>('play-btn');
  private firstRunGuide = this.el<HTMLElement>('first-run-guide');
  private frgRing = this.el<HTMLElement>('frg-ring');
  private frgCaption = this.el<HTMLElement>('frg-caption');
  private frgDrag = this.el<HTMLElement>('frg-drag');
  private guideDragVisible = false;
  /** Locked drag-arrow direction for the current target tile (true = points left). */
  private guideDragLeft = false;
  private keepHoppingCallout = this.el<HTMLElement>('keep-hopping-callout');
  /** Pending "almost! try again" revert timer (guided-tutorial retry). */
  private tutorialRetryTimer: number | null = null;
  private bestScore = this.el<HTMLElement>('best-score');
  private bestScoreVal = this.el<HTMLElement>('best-score-value');
  private bestScoreCallout = this.el<HTMLElement>('best-score-callout');
  private unlockDialog = this.el<HTMLElement>('unlock-dialog');
  private unlockDialogConfetti = this.el<HTMLElement>('unlock-dialog-confetti');
  private unlockCardTitle = this.el<HTMLElement>('unlock-card-title');
  private unlockCardTag = this.el<HTMLElement>('unlock-card-tag');
  private unlockCardMeta = this.el<HTMLElement>('unlock-card-meta');
  private unlockShowmeBtn = this.el<HTMLButtonElement>('unlock-showme-btn');
  private unlockClose = this.el<HTMLButtonElement>('unlock-close');
  private shieldCardDialog = this.el<HTMLElement>('shield-card-dialog');
  private shieldCardClose = this.el<HTMLButtonElement>('shield-card-close');
  private shieldCardGotit = this.el<HTMLButtonElement>('shield-card-gotit');
  private spotlightOverlay = this.el<HTMLElement>('spotlight-overlay');
  private spotlightHole = this.el<HTMLElement>('spotlight-hole');
  private spotlightRing = this.el<HTMLElement>('spotlight-ring');
  private spotlightCard = this.el<HTMLElement>('spotlight-card');
  private spotlightKicker = this.el<HTMLElement>('spotlight-kicker');
  private spotlightCardTitle = this.el<HTMLElement>('spotlight-card-title');
  private spotlightCardDesc = this.el<HTMLElement>('spotlight-card-desc');
  /** Target element the spotlight hole/ring currently wraps (null = none). */
  private spotlightTarget: HTMLElement | null = null;
  /** Which teach is showing (world vs missions) — used to settle its gate when
   *  the player dismisses it. */
  private spotlightKind: 'world' | 'missions' | null = null;
  private streakGlow: FireOverlay | null = null;
  private missionQueue: boolean[] = [];
  private missionBusy = false;
  private activeMissionTab: MissionKind = 'general';
  private countdownTimer: number | null = null;
  private bestCalloutTimer: number | null = null;
  private lastUnlockedCount: number | null = null;
  private pendingUnlockWorld: WorldId | null = null;
  /** Worlds unlocked in one shot (a huge run can cross several gates at once);
   *  each gets its own intro dialog, in order. */
  private unlockQueue: WorldConfig[] = [];
  /** Pending timer for a scheduled spotlight (world unlock or new missions; kept
   *  so re-renders don't stack multiple schedules). */
  private spotlightTimer: number | null = null;
  private spotlightOpen = false;
  /** Auto-dismiss timer for an open spotlight — 5s then it closes itself. */
  private spotlightAutoTimer: number | null = null;
  private lastFireTime = 0;
  /** One-shot reveal timers that make the play button disappear the moment a
   *  spotlight becomes eligible, so the teach is actually seen before running. */
  private spotlightBlockTimer: number | null = null;
  /** Missions tabs whose bars already animated this overlay open (one-shot fill). */
  private animatedMissionsTabs = new Set<MissionKind>();
  /** Worlds that already showed the one-time "check this out!" callout. */
  private unlockCalloutShown = new Set<WorldId>();
  private tapTimeline: gsap.core.Timeline | null = null;
  private canvasResizeObserver: ResizeObserver | null = null;
  private settingsBtn = this.el<HTMLButtonElement>('settings-btn');
  private statsBtn = this.el<HTMLButtonElement>('stats-btn');
  private settingsOverlay = this.el<HTMLElement>('settings-overlay');
  private settingsClose = this.el<HTMLElement>('settings-close');
  private soundSlider = this.el<HTMLInputElement>('sound-slider');
  private musicSlider = this.el<HTMLInputElement>('music-slider');
  private sensitivitySlider = this.el<HTMLInputElement>('sensitivity-slider');
  private sensitivityReset = this.el<HTMLButtonElement>('sensitivity-reset');
  private soundValue = this.el<HTMLElement>('sound-value');
  private musicValue = this.el<HTMLElement>('music-value');
  private sensitivityValue = this.el<HTMLElement>('sensitivity-value');
  private missionsNotify = this.el<HTMLElement>('missions-notify');
  private shopNotify = this.el<HTMLElement>('shop-notify');
  private coinCardAmount = this.el<HTMLElement>('coin-card-amount');
  private statsOverlay = this.el<HTMLElement>('stats-overlay');
  private statsClose = this.el<HTMLElement>('stats-close');
  private statRuns = this.el<HTMLElement>('stat-runs');
  private statTotalScore = this.el<HTMLElement>('stat-total-score');
  private statCoins = this.el<HTMLElement>('stat-coins');
  private statPerfects = this.el<HTMLElement>('stat-perfects');
  private statStreak = this.el<HTMLElement>('stat-streak');
  private statStreakWorld = this.el<HTMLElement>('stat-streak-world');
  private statWorlds = this.el<HTMLElement>('stat-worlds');

  /** Fired when the "sound" volume slider changes (0–100). Wired by Game to AudioSystem. */
  onSoundVolumeChange: (volume: number) => void = () => {};
  /** Fired when the "music" volume slider changes (0–100). Reserved for a future track. */
  onMusicVolumeChange: (volume: number) => void = () => {};

  /** Check circle for claimed rows. Green circle + a 2px black ring drawn fully
   *  OUTSIDE the green, filling the whole element — exactly like the claim
   *  capsule's CSS border (2px, border-box). Geometry is in px (viewBox = element
   *  size) so at any resolution it superimposes the collapsed claim capsule
   *  perfectly: same green, same ring thickness, same outer footprint, no shadow.
   *  The white tick shares its path with TICK_SVG so it doesn't resize at the swap. */
  private static checkSvg(size: number): string {
    const c = size / 2;
    const s = size / 24;
    return (
      `<svg class="m-check-svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">` +
      `<circle cx="${c}" cy="${c}" r="${c - 2}" fill="#28a858"/>` +
      `<circle cx="${c}" cy="${c}" r="${c - 1}" fill="none" stroke="#111" stroke-width="2"/>` +
      `<path d="M${7 * s} ${12.6 * s} l${3.3 * s} ${3.3 * s} l${6.6 * s} ${-7.2 * s}" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` +
      '</svg>'
    );
  }

  /** Tick only — popped into the collapsed claim capsule (the capsule itself
   *  is already the green circle, so no nested check-circle is needed). Its
   *  white check shares the path used by checkSvg(), so the tick keeps its size
   *  when the row re-renders to the check icon (no visual "jump"). */
  private static TICK_SVG =
    '<svg class="m-tick-svg" viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M7 12.6l3.3 3.3 6.6-7.2" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg>';

  constructor(
    private state: GameStateManager,
    private events: EventBus,
    private renderer: RendererSystem,
    private shadow: ShadowSystem,
    private background: BackgroundSystem,
    private ball: BallEntity
  ) {
    this.bind();
    this.missionsCountdown.innerHTML =
      '<span>Come back tomorrow</span><span class="cd-clock">--:--:--</span>';
    this.events.on(GAME_EVENTS.STREAK_MILESTONE, (payload) =>
      this.showStreakBanner(payload as { milestone: 'fire'; shield: boolean })
    );
    // The start screen renders via HTML defaults at boot (no showStartScreen
    // call), so prime the per-start-screen features here.
    this.positionPlayButton();
    this.startTapAnimation();
    this.refreshBestScore();
    // Default to the reveal-gated nav before the async save load resolves
    // (a fresh player has 0 total score, so the arrows start hidden).
    this.renderWorldNav();
    // Re-pin the overlay whenever the canvas resizes (window/orientation/layout
    // changes) so it stays centered on the ball on any device.
    this.canvasResizeObserver = new ResizeObserver(() => this.positionPlayButton());
    this.canvasResizeObserver.observe(this.renderer.renderer.domElement);
  }

  private el<T extends HTMLElement>(id: string): T {
    const node = document.getElementById(id);
    if (!node) throw new Error(`Missing DOM element #${id}`);
    return node as T;
  }

  private bind(): void {
    this.shopBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openShop();
    });
    this.missionsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openMissions();
    });
    this.missionsClose.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeMissions();
    });
    this.missionsTabs.forEach((tab) =>
      tab.addEventListener('click', (e) => {
        e.stopPropagation();
        const kind = tab.dataset.tab as MissionKind | undefined;
        if (!kind || kind === this.activeMissionTab) return;
        this.activeMissionTab = kind;
        this.missionsTabs.forEach((t) => t.classList.toggle('active', t === tab));
        this.missionsScroll.scrollTop = 0;
        this.renderMissionsOverlay();
      })
    );
    this.missionsOverlay.addEventListener('click', (e) => {
      if (e.target === this.missionsOverlay) this.closeMissions();
    });
    this.missionsList.addEventListener('click', (e) => {
      const claim = (e.target as HTMLElement).closest<HTMLElement>('[data-claim]');
      if (!claim) return;
      e.stopPropagation();
      this.claimMission(claim.dataset.claim!, claim);
    });
    this.settingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openSettings();
    });
    this.settingsClose.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeSettings();
    });
    this.settingsOverlay.addEventListener('click', (e) => {
      if (e.target === this.settingsOverlay) this.closeSettings();
    });
    this.soundSlider.addEventListener('input', () => this.applySoundVolume());
    this.musicSlider.addEventListener('input', () => this.applyMusicVolume());
    this.sensitivitySlider.addEventListener('input', () => this.applySensitivity());
    this.sensitivityReset.addEventListener('click', () => this.resetSensitivity());
    this.statsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openStats();
    });
    this.statsClose.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeStats();
    });
    this.statsOverlay.addEventListener('click', (e) => {
      if (e.target === this.statsOverlay) this.closeStats();
    });
    this.shopClose.addEventListener('click', (e) => {
      e.stopPropagation();
      this.shopOverlay.style.display = 'none';
    });
    this.shopOverlay.addEventListener('click', (e) => {
      if (e.target === this.shopOverlay) this.shopOverlay.style.display = 'none';
    });
    this.shopScroll.addEventListener('click', (e) => this.onShopClick(e));
    this.continueBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      e.preventDefault();
    });
    this.continueBtn.addEventListener('click', () => {
      if (this.gameOverScreen.style.display === 'flex') this.onContinue();
    });
    this.homeBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      e.preventDefault();
    });
    this.homeBtn.addEventListener('click', () => {
      if (this.gameOverScreen.style.display === 'flex') this.onHome();
    });
    this.pauseBtn.addEventListener('click', () => this.onPause());
    this.pauseResumeBtn.addEventListener('click', () => this.onResume());
    this.pauseHomeBtn.addEventListener('click', () => this.onPauseHome());
    this.pauseOverlay.addEventListener('click', (e) => {
      if (e.target === this.pauseOverlay) this.onResume();
    });
    this.worldPrev.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.worldPrev.addEventListener('click', (e) => {
      e.stopPropagation();
      this.moveWorld(-1);
    });
    this.worldNext.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.worldNext.addEventListener('click', (e) => {
      e.stopPropagation();
      this.moveWorld(1);
    });
    this.lockClose.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeLockOverlay();
    });
    this.lockOverlay.addEventListener('click', (e) => {
      if (e.target === this.lockOverlay) this.closeLockOverlay();
    });
    this.unlockClose.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeUnlockDialog();
    });
    this.unlockDialog.addEventListener('click', (e) => {
      if (e.target === this.unlockDialog) this.closeUnlockDialog();
    });
    this.unlockShowmeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      // Capture the clicked world BEFORE closing: closing pumps the unlock
      // queue and the next intro takes over pendingUnlockWorld.
      const world = this.pendingUnlockWorld;
      this.pendingUnlockWorld = null;
      this.closeUnlockDialog();
      if (world) this.selectWorld(world);
    });
    this.shieldCardClose.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeShieldCard();
    });
    this.shieldCardGotit.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeShieldCard();
    });
    this.shieldCardDialog.addEventListener('click', (e) => {
      if (e.target === this.shieldCardDialog) this.closeShieldCard();
    });
    // One-tap dismiss anywhere for a spotlight.
    this.spotlightOverlay.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.closeSpotlight();
    });
    window.addEventListener('resize', () => this.onResize());
    // Pinch-zoom / embedded webviews resize the visual viewport without a
    // window resize — re-pin the play button (and any open spotlight hole)
    // there too, so zoom can never strand the tap-to-play overlay.
    window.visualViewport?.addEventListener('resize', () => this.onResize());
  }

  onContinue: () => void = () => {};
  /** Home button on the game-over screen (returns to the start screen). */
  onHome: () => void = () => {};
  onPause: () => void = () => {};
  onResume: () => void = () => {};
  onPauseHome: () => void = () => {};
  onSkinApplied: () => void = () => {};
  /** Fired when a mission reward is claimed (Game plays the coin jingle). */
  onMissionClaim: () => void = () => {};
  /** Fired after a successful world selection (Game re-seeds platform ramps). */
  onWorldSelect: (id: WorldId) => void = () => {};

  /** Mirror `no(r)`: apply theme to scene + DOM. */
  setTheme(theme: ThemeName, persist = true): void {
    this.state.setTheme(theme);
    const t = THEMES[theme];
    if (persist) void this.state.getMutablePlayerData();
    this.renderer.setTheme(theme);
    this.shadow.setThemeColor(t.shadowColor);
    this.background.recolor();
    if (persist) this.onThemeChanged();
  }

  onThemeChanged: () => void = () => {};

  /** Mirror `ts()` — persist happens via Game callback. */

  /** Mirror `as()`: coin counter + shop footer + start-screen coin card + bubbles. */
  refreshCoins(): void {
    const total = this.state.getPlayerData().totalCoins;
    this.coinAmount.textContent = String(total);
    this.shopCoinDisplay.textContent = String(total);
    this.coinCardAmount.textContent = String(total);
    this.refreshShopNotify();
    this.refreshMissionNotify();
  }

  /** Render the compact progression block on the start screen (Iteration 7). */
  renderStartScreen(): void {
    this.startScreen.classList.toggle('locked', this.state.isPreviewLocked());
    this.renderWorldTitle();
    this.renderWorldNav();
    this.refreshBestScore();
    this.checkWorldUnlocks();
    // Missions tease: earnable after MISSIONS_UNLOCK_RUNS runs, until then the
    // label reads "???" and the item stays dimmed (still clickable — opening
    // it reveals a locked card so new players aren't overwhelmed).
    const missionsUnlocked = this.state.isMissionsUnlocked();
    this.missionsMenuItem.classList.toggle('missions-gated', !missionsUnlocked);
    const missionsLabel = this.missionsMenuItem.querySelector<HTMLElement>('.menu-label');
    if (missionsLabel) missionsLabel.textContent = missionsUnlocked ? 'missions' : '???';
    this.refreshMissionsPending();
    this.maybeShowShieldCard();
    // World-nav callouts (spotlights, "too easy?" bubble) only start once the
    // first-run tutorial is done — the tutorial owns the teaching while it's
    // running, so unlock/nav teases stay quiet until it hands over.
    if (this.state.getPlayerData().tutorialDone) {
      this.maybeShowSpotlights();
    }
  }

  /** While the one-time missions-unlocked gate is pending, the play button
   *  stays hidden (pattern: `#start-screen.missions-callout-pending`) until the
   *  missions overlay is opened once; the spotlight teaches where the button is. */
  private refreshMissionsPending(): void {
    this.startScreen.classList.toggle(
      'missions-callout-pending',
      this.state.hasPendingMissionsUnlock()
    );
  }

  /** Navigate to an adjacent world via the start-screen arrows. */
  private moveWorld(dir: 1 | -1): void {
    const target = dir > 0 ? getNextWorld(this.state.getActiveWorld()) : getPreviousWorld(this.state.getActiveWorld());
    if (!target) return;
    this.selectWorld(target.id);
  }

  /** Select a world (arrow or chip click); a locked world loads as a non-playable preview. */
  private selectWorld(id: WorldId): void {
    // First click on a world reveals its nav label ("???" → "World N").
    const world = getWorldById(id);
    if (world) {
      const data = this.state.getMutablePlayerData();
      if (!data.revealedWorlds.includes(id)) data.revealedWorlds.push(id);
    }
    if (this.state.selectWorld(id)) {
      this.state.clearPreview();
      this.onWorldSelect(id);
      this.closeLockOverlay();
      this.renderStartScreen();
      return;
    }
    if (world && !this.state.canSelectWorld(world)) {
      this.state.previewWorld(id);
      this.onWorldSelect(id);
      this.renderStartScreen();
      this.openLockOverlay(world);
    }
  }

  private readonly WORLD_TITLE_COLORS: Record<WorldId, string> = {
    sunrise: '#ffd23f',
    dusk: '#c98bff',
    void: '#8ef1ff'
  };

  /** Start-screen title: the current world name (replaces the logo). */
  private renderWorldTitle(): void {
    const world = this.state.getActiveWorld();
    const locked = this.state.isPreviewLocked();
    this.worldTitle.textContent = locked ? '????' : world.name.toUpperCase();
    this.worldTitle.style.color = locked ? '#8a8a96' : this.WORLD_TITLE_COLORS[world.id];
  }

  /** Edge nav: back arrow (left) · next arrow/lock (right), both centered on their edge.
   *  The arrows stay hidden until the player's total score reaches
   *  `WORLD_NAV_REVEAL_SCORE` — the curiosity tease is earned, not given. */
  private renderWorldNav(): void {
    if (this.state.getTotalScore() < GAME_CONFIG.WORLD_NAV_REVEAL_SCORE) {
      this.worldPrev.classList.add('hidden');
      this.worldNext.classList.add('hidden');
      this.worldFar.classList.add('hidden');
      this.stopBubble();
      return;
    }
    const world = this.state.getActiveWorld();
    const prev = getPreviousWorld(world);
    const next = getNextWorld(world);

    this.worldPrev.classList.toggle('hidden', !prev);
    if (prev) {
      this.setNavLabel(this.worldPrev, this.navLabelFor(prev));
      this.worldPrev.title = `Back to ${prev.name}`;
      // Back arrow dims while the CURRENT world is still locked (preview) and
      // turns green again once it's unlocked — mirrors the next-arrow behavior.
      this.worldPrev.classList.toggle('locked', !this.state.canSelectWorld(world));
    }

    this.worldNext.classList.toggle('hidden', !next);
    if (next) {
      const unlocked = this.state.canSelectWorld(next);
      // Locked worlds keep the arrow (no lock/score preview) — the lock card
      // is the reveal. Dimmed arrow hints the world isn't ready yet.
      this.worldNext.classList.toggle('locked', !unlocked);
      this.worldNext.innerHTML =
        `<span class="nav-chevron"><img src="${this.asset('arrow-right.png')}" alt="next"></span>`;
      this.setNavLabel(this.worldNext, this.navLabelFor(next));
      this.worldNext.title = unlocked
        ? `Go to ${next.name}`
        : `${next.name} unlocks at ${next.unlockScore.toLocaleString()} total score`;
      // Thought bubble by the nav: teases the NEXT world whether it's locked
      // ("what lies beyond?") or already open ("your next world is ready").
      // Only the "coming soon" far slot stays bubble-free (no next world — the
      // else branch below stops it).
      this.scheduleBubble(next.id, !unlocked);
      this.worldFar.classList.add('hidden');
    } else {
      this.worldNext.innerHTML = '';
      this.stopBubble();
      // Last world: no next arrow — tease future worlds with a non-clickable "coming soon".
      this.worldFar.classList.remove('hidden');
      this.setNavLabel(this.worldFar, 'coming soon');
      this.worldFar.title = 'More worlds coming soon';
    }
  }

  /** World-nav label: "???" while the world is locked, "World N" once unlocked. */
  private navLabelFor(world: WorldConfig): string {
    return this.state.canSelectWorld(world) ? `World ${WORLDS.indexOf(world) + 1}` : '???';
  }

  private setNavLabel(arrow: HTMLElement, text: string): void {
    let label = arrow.querySelector<HTMLElement>('.nav-label');
    if (!label) {
      label = document.createElement('span');
      label.className = 'nav-label';
      arrow.appendChild(label);
    }
    label.textContent = text;
  }

  /** Thought-bubble pools: tease the NEXT world with copy that depends on
   *  whether it's still locked ("what lies beyond?") or already open ("your
   *  next world is ready"). Every world also has its own themed lines for both
   *  states; sunrise never appears here (it's never a "next" world). */
  private static readonly BUBBLE_LOCKED_GENERAL = [
    'what lies beyond?',
    'don\u2019t you wonder what\u2019s out there?',
    'another world is waiting\u2026',
    'see what the fog hides\u2026',
    'curious yet?'
  ];
  private static readonly BUBBLE_UNLOCKED_GENERAL = [
    'your next world is ready\u2026',
    'a new world is open for you',
    'hop over when you are ready\u2026',
    'the next horizon is calling\u2026',
    'what are you waiting for?'
  ];
  private static readonly BUBBLE_LOCKED_THEMED: Record<string, string[]> = {
    dusk: [
      'somewhere the sun is setting\u2026',
      'a golden hour is waiting\u2026',
      'the horizon glows amber\u2026',
      'chase the dusk before it fades\u2026'
    ],
    void: [
      'the dark is calling\u2026',
      'the neon hums your name\u2026',
      'step into the void\u2026',
      'the lights never sleep out there\u2026'
    ]
  };
  private static readonly BUBBLE_UNLOCKED_THEMED: Record<string, string[]> = {
    dusk: [
      'dusk is open\u2014 a golden hour waits\u2026',
      'the sun never quite sets here\u2026',
      'the amber horizon is ready for you\u2026',
      'welcome to the golden hour\u2026'
    ],
    void: [
      'the void is open\u2014 neon awaits\u2026',
      'step in\u2014 the dark is yours to light\u2026',
      'the lights never sleep\u2014 join them\u2026',
      'the deep is ready when you are\u2026'
    ]
  };
  private bubbleTimer: number | null = null;

  private stopBubble(): void {
    if (this.bubbleTimer !== null) {
      window.clearTimeout(this.bubbleTimer);
      this.bubbleTimer = null;
    }
    if (this.worldBubble.style.display !== 'none') {
      gsap.killTweensOf(this.worldBubble);
      this.worldBubble.style.display = 'none';
    }
  }

  private scheduleBubble(worldId?: string, locked = true): void {
    // Don't tease when the lock card is open — the card already explains the lock.
    if (this.lockOverlay.style.display === 'flex') return;
    this.stopBubble();
    this.bubbleTimer = window.setTimeout(() => {
      this.bubbleTimer = null;
      this.showBubble(undefined, 5000, true, worldId, locked);
    }, 9000 + Math.random() * 6000);
  }

  private showBubble(
    text?: string,
    duration = 5000,
    reschedule = true,
    worldId?: string,
    locked = true
  ): void {
    if (this.lockOverlay.style.display === 'flex') return;
    // Drop any pending hide/schedule timer so a stale timeout can't fire early
    // and cut this bubble's display short (overlapping cycles would show
    // bubbles back-to-back instead of one at a time).
    if (this.bubbleTimer !== null) {
      window.clearTimeout(this.bubbleTimer);
      this.bubbleTimer = null;
    }
    const themed = (locked ? UIManager.BUBBLE_LOCKED_THEMED : UIManager.BUBBLE_UNLOCKED_THEMED)[worldId ?? ''];
    const general = locked ? UIManager.BUBBLE_LOCKED_GENERAL : UIManager.BUBBLE_UNLOCKED_GENERAL;
    const pool = themed ? [...general, ...themed] : [...general];
    const content =
      text ?? pool[Math.floor(Math.random() * pool.length)];
    this.worldBubble.textContent = content;
    gsap.killTweensOf(this.worldBubble);
    // yPercent (not a CSS translateY) keeps the bubble centered on the arrow no
    // matter how many lines the taunt wraps to — GSAP holds percentages as-is.
    gsap.set(this.worldBubble, { opacity: 0, scale: 0.5, yPercent: -50 });
    this.worldBubble.style.display = 'block';
    gsap.to(this.worldBubble, { opacity: 1, scale: 1, duration: 0.35, ease: 'back.out(2.5)' });
    this.bubbleTimer = window.setTimeout(() => {
      this.bubbleTimer = null;
      // Reschedule only after the out animation finishes (via onDone), so the
      // fade-out is never killed mid-flight by the next schedule.
      this.hideBubble(() => {
        if (reschedule) this.scheduleBubble(worldId, locked);
      });
    }, duration);
  }

  /** One-shot "check this out!" bubble next to the freshly unlocked world arrow. */
  private showUnlockCallout(): void {
    this.stopBubble();
    this.showBubble('check this out!', 5000);
  }

  private hideBubble(onDone?: () => void): void {
    if (this.worldBubble.style.display === 'none') {
      onDone?.();
      return;
    }
    gsap.killTweensOf(this.worldBubble);
    gsap.to(this.worldBubble, {
      opacity: 0,
      scale: 0.5,
      duration: 0.25,
      onComplete: () => {
        this.worldBubble.style.display = 'none';
        onDone?.();
      }
    });
  }

  /** Debug hook: force the "what lies beyond?" bubble to appear right now. */
  triggerWorldCallout(): void {
    this.showBubble();
  }

  // ---- play button: hand taps the ball, arrows burst on each tap ----

  /** Project the ball's start position onto the screen and park the play button there. */
  /** Center the tap-to-play overlay on the ball's projected position.
   *  Nudges come from the CSS vars --tap-offset-x / --tap-offset-y (see :root
   *  in index.html) so the overlay can be repositioned without touching JS.
   *  The projection uses the camera's BOOT pose, not its live one: the camera
   *  follows the ball, so during the attract demo it drifts far ahead — a
   *  behind-camera projection of the start tile would fling the button off-
   *  screen on the next zoom/resize re-pin. The boot pose gives the tile's
   *  canonical spot for any canvas size (fov/aspect stay live). */
  private positionPlayButton(): void {
    const canvas = this.renderer.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    // A transient 0-size rect (mid-zoom / layout) must not overwrite the
    // current position — keep the last good pin until the layout settles.
    if (rect.width < 1 || rect.height < 1) return;
    const cam = this.renderer.camera;
    const pos = cam.position.clone();
    const quat = cam.quaternion.clone();
    cam.position.set(0, GAME_CONFIG.CAMERA_OFFSET_Y, GAME_CONFIG.CAMERA_OFFSET_Z);
    cam.lookAt(0, 0, GAME_CONFIG.CAMERA_LOOK_AHEAD);
    cam.updateMatrixWorld(true);
    cam.updateProjectionMatrix();
    const vec = new Vector3(
      0,
      GAME_CONFIG.PLATFORM_HEIGHT / 2 + GAME_CONFIG.BALL_RADIUS,
      0
    );
    vec.project(cam);
    cam.position.copy(pos);
    cam.quaternion.copy(quat);
    cam.updateMatrixWorld(true);
    cam.updateProjectionMatrix();
    const x = (vec.x * 0.5 + 0.5) * rect.width;
    const y = (-vec.y * 0.5 + 0.5) * rect.height;
    const rs = getComputedStyle(document.documentElement);
    const ox = parseFloat(rs.getPropertyValue('--tap-offset-x')) || 0;
    const oy = parseFloat(rs.getPropertyValue('--tap-offset-y')) || 0;
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      // Never park the button at a garbage position: fall back to the CSS
      // default (centered on the screen) so it stays visible and tappable.
      this.playBtn.style.left = '';
      this.playBtn.style.top = '';
      return;
    }
    this.playBtn.style.left = `${x + ox}px`;
    this.playBtn.style.top = `${y + oy}px`;
  }

  /** Looping tap-to-play overlay: fades in, stays a while, fades out, then
   *  reappears. Timings come from the CSS vars --tap-fade-in / --tap-hold /
   *  --tap-fade-out / --tap-gap (see :root in index.html). The button stays
   *  tappable the whole cycle, even while the overlay is invisible. */
  private startTapAnimation(): void {
    this.stopTapAnimation();
    const rs = getComputedStyle(document.documentElement);
    const sec = (v: string, fallback: number): number => {
      const n = parseFloat(v);
      return Number.isFinite(n) ? n : fallback;
    };
    const fadeIn = sec(rs.getPropertyValue('--tap-fade-in'), 0.6);
    const hold = sec(rs.getPropertyValue('--tap-hold'), 7);
    const fadeOut = sec(rs.getPropertyValue('--tap-fade-out'), 0.6);
    const gap = sec(rs.getPropertyValue('--tap-gap'), 7);
    this.playBtn.style.pointerEvents = 'auto';
    gsap.set(this.playBtn, { opacity: 0 });
    this.tapTimeline = gsap
      .timeline({ repeat: -1 })
      .to(this.playBtn, { opacity: 1, duration: fadeIn, ease: 'power1.out' })
      .to({}, { duration: hold })
      .to(this.playBtn, { opacity: 0, duration: fadeOut, ease: 'power1.in' })
      .to({}, { duration: gap });
  }

  private stopTapAnimation(): void {
    if (this.tapTimeline) {
      this.tapTimeline.kill();
      this.tapTimeline = null;
    }
    gsap.killTweensOf(this.playBtn);
    gsap.set(this.playBtn, { opacity: 1 });
    this.playBtn.style.pointerEvents = 'auto';
  }

  // ---- first-run guided play: target ring over the next tile ----

  /** Show/hide the guided-play overlay (ring + caption) for the tutorial run.
   *  In/out are animated: the ring/drag fade in when shown (the caption pops in
   *  via setGuideStep) and everything fades out before the overlay hides. The
   *  seamless ending staggers its own longer fade. */
  showFirstRunGuide(show: boolean): void {
    gsap.killTweensOf(this.frgCaption);
    gsap.killTweensOf(this.frgRing);
    gsap.killTweensOf(this.frgDrag);
    this.cancelTutorialRetry();
    if (!show) {
      gsap.to([this.frgCaption, this.frgRing, this.frgDrag], {
        opacity: 0,
        duration: 0.22,
        ease: 'power2.in',
        onComplete: () => this.setGuideHidden()
      });
    } else {
      this.firstRunGuide.classList.remove('hidden');
      gsap.set([this.frgCaption, this.frgRing, this.frgDrag], { opacity: 0 });
      // Force the caption pop even when its text is unchanged (the initial
      // "tap to hop" is already in the markup) so the card always animates in.
      this.setGuideStep(0, true);
      gsap.to(this.frgRing, { opacity: 1, duration: 0.3, ease: 'power2.out' });
      gsap.to(this.frgDrag, { opacity: 1, duration: 0.3, delay: 0.15, ease: 'power2.out' });
    }
  }

  /** Apply the fully-hidden state for the guide overlay (after any fade-out). */
  private setGuideHidden(): void {
    this.firstRunGuide.classList.add('hidden');
    this.frgRing.style.left = '';
    this.guideDragVisible = false;
    this.frgDrag.style.display = 'none';
  }

  /** Advance the tutorial caption + drag hint for a completed guided hop.
   *  The 5 teaching hops each teach one lesson. */
  setGuideStep(step: number, forcePop = false): void {
    // A completed hop (or a new guide session) cancels any pending "try again"
    // revert so a stale timer can never overwrite the current caption — a tap
    // during the retry therefore jumps straight to the next hop.
    this.cancelTutorialRetry();
    let next: string;
    if (step === 0) next = 'tap to hop';
    else if (step === 1) next = 'drag left!';
    else if (step === 2) next = 'drag right!';
    else if (step === 3) next = 'drop on the diamond!';
    else next = 'collect the coins!';
    // The drag arrow only teaches the two steering lessons (steps 1-2).
    this.guideDragVisible = step >= 1 && step <= 2;
    if (!this.guideDragVisible) this.frgDrag.style.display = 'none';
    // Pop the caption when its text changes, or when the guide is being shown
    // fresh (forcePop) — otherwise the initial "tap to hop" (already in the
    // markup) would never animate in.
    if (forcePop || this.frgCaption.textContent !== next) {
      this.popCaption(next);
    }
  }

  /** Swap the tutorial caption with a quick pop-in. */
  private popCaption(text: string): void {
    gsap.killTweensOf(this.frgCaption);
    this.frgCaption.textContent = text;
    gsap.fromTo(this.frgCaption, { opacity: 0 }, { opacity: 1, duration: 0.28, ease: 'power2.out' });
  }

  /**
   * Fade the guided-play overlay out element by element — the tutorial's end
   * is deliberately seamless (no end screen, no "tutorial over" moment): the
   * guides simply melt away while the run keeps going.
   */
  fadeOutFirstRunGuide(): void {
    if (this.firstRunGuide.classList.contains('hidden')) return;
    gsap.killTweensOf(this.frgCaption);
    gsap.killTweensOf(this.frgRing);
    gsap.killTweensOf(this.frgDrag);
    gsap.to([this.frgCaption, this.frgRing, this.frgDrag], {
      opacity: 0,
      duration: 0.45,
      stagger: 0.15,
      ease: 'power2.in',
      onComplete: () => this.showFirstRunGuide(false)
    });
  }

  /** Brief "you missed" flash on a tutorial retry. Uses a rotating set of
   *  friendly variants so a long tutorial never repeats the same line; the
   *  caption stays up for a few seconds (or until the next tap — which jumps
   *  straight to a new hop) instead of snapping back immediately. */
  showTutorialRetry(): void {
    this.cancelTutorialRetry();
    const lines = [
      'almost! try again',
      "that was close — you've got this!",
      'so close! tap when you are ready',
      "don't worry — hop on it again!"
    ];
    const pick = Math.floor(Math.random() * lines.length);
    this.popCaption(lines[pick]);
    this.tutorialRetryTimer = window.setTimeout(() => {
      this.tutorialRetryTimer = null;
      this.popCaption('tap to hop');
    }, 4500);
  }

  private cancelTutorialRetry(): void {
    if (this.tutorialRetryTimer !== null) {
      clearTimeout(this.tutorialRetryTimer);
      this.tutorialRetryTimer = null;
    }
  }

  /** Project a tile's world position onto the screen and park the ring on it. */
  positionGuideRing(x: number, z: number): void {
    const canvas = this.renderer.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    const cam = this.renderer.camera;
    cam.updateMatrixWorld(true);
    cam.updateProjectionMatrix();
    const vec = new Vector3(x, GAME_CONFIG.PLATFORM_HEIGHT / 2, z);
    vec.project(cam);
    if (vec.z > 1 || vec.z < -1) {
      this.firstRunGuide.style.display = 'none';
      return;
    }
    this.firstRunGuide.style.display = 'block';
    this.frgRing.style.left = `${(vec.x * 0.5 + 0.5) * rect.width}px`;
    this.frgRing.style.top = `${(-vec.y * 0.5 + 0.5) * rect.height}px`;
  }

  /**
   * Drag hint: parked on the NEXT tile (below its ring) and pointed the way
   * the player must drag. The direction is locked per target tile (set via
   * setGuideDragDirection when the guide advances) so it never flips while the
   * ball approaches; only the screen position tracks the target each frame.
   */
  positionGuideDrag(ballX: number, ballZ: number, targetX: number, targetZ: number): void {
    if (!this.guideDragVisible) {
      this.frgDrag.style.display = 'none';
      return;
    }
    const canvas = this.renderer.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    const cam = this.renderer.camera;
    cam.updateMatrixWorld(true);
    cam.updateProjectionMatrix();
    const tgtV = new Vector3(targetX, GAME_CONFIG.PLATFORM_HEIGHT / 2, targetZ);
    tgtV.project(cam);
    if (tgtV.z > 1 || tgtV.z < -1) {
      this.frgDrag.style.display = 'none';
      return;
    }
    this.frgDrag.classList.toggle('left', this.guideDragLeft);
    this.frgDrag.style.display = 'block';
    this.frgDrag.style.left = `${(tgtV.x * 0.5 + 0.5) * rect.width}px`;
    this.frgDrag.style.top = `${(-tgtV.y * 0.5 + 0.5) * rect.height + 44}px`;
  }

  /**
   * Lock the drag-arrow direction for the current target tile. Called ONCE per
   * target (when the guide advances, i.e. after the ball lands on the tile it
   * was aiming for) — the direction is resolved in screen space (project ball
   * and target, compare NDC x; the camera looks forward, so world +x is
   * screen-left). Locked until the next landing.
   */
  setGuideDragDirection(ballX: number, ballZ: number, targetX: number, targetZ: number): void {
    const cam = this.renderer.camera;
    cam.updateMatrixWorld(true);
    cam.updateProjectionMatrix();
    const ballV = new Vector3(ballX, GAME_CONFIG.PLATFORM_HEIGHT / 2 + GAME_CONFIG.BALL_RADIUS, ballZ);
    const tgtV = new Vector3(targetX, GAME_CONFIG.PLATFORM_HEIGHT / 2, targetZ);
    ballV.project(cam);
    tgtV.project(cam);
    this.guideDragLeft = tgtV.x < ballV.x;
    this.frgDrag.classList.toggle('left', this.guideDragLeft);
  }

  /**
   * Brief top callout when the first-run tutorial fully hands over to normal
   *  play ("keep hopping!") — a positive beat, then the run continues seamlessly. */
  showKeepHoppingCallout(): void {
    gsap.killTweensOf(this.keepHoppingCallout);
    this.keepHoppingCallout.classList.remove('hidden');
    gsap.fromTo(
      this.keepHoppingCallout,
      { opacity: 0 },
      {
        opacity: 1,
        duration: 0.35,
        ease: 'power2.out',
        onComplete: () => {
          gsap.to(this.keepHoppingCallout, {
            opacity: 0,
            duration: 0.4,
            delay: 2.2,
            ease: 'power2.in',
            onComplete: () => this.keepHoppingCallout.classList.add('hidden')
          });
        }
      }
    );
  }

  // ---- best score chip (crown asset) + occasional "can you beat this?" ----

  private refreshBestScore(): void {
    const world = this.state.getActiveWorld();
    const idx = WORLDS.indexOf(world);
    const best = this.state.getPlayerData().bestPerWorld[idx] ?? 0;
    const unlocked = this.state.canSelectWorld(world);
    this.bestScore.classList.toggle('hidden', !unlocked);
    this.bestScoreVal.textContent = String(best);
    if (unlocked && best > 0) this.startBestCallout();
  }

  private startBestCallout(): void {
    this.stopBestCallout();
    const tick = () => {
      gsap.to(this.bestScoreCallout, { opacity: 1, duration: 0.4 });
      this.bestCalloutTimer = window.setTimeout(() => {
        gsap.to(this.bestScoreCallout, { opacity: 0, duration: 0.4 });
        this.bestCalloutTimer = window.setTimeout(tick, 6000 + Math.random() * 6000);
      }, 3200);
    };
    this.bestCalloutTimer = window.setTimeout(tick, 4000 + Math.random() * 5000);
  }

  private stopBestCallout(): void {
    if (this.bestCalloutTimer !== null) {
      window.clearTimeout(this.bestCalloutTimer);
      this.bestCalloutTimer = null;
    }
    gsap.killTweensOf(this.bestScoreCallout);
    this.bestScoreCallout.style.opacity = '0';
  }

  // ---- new-world unlock dialog ----

  /** Queue any worlds whose unlock gate the current total score has crossed.
   *  Runs from the start screen (checkWorldUnlocks) and from the game-over
   *  screen (maybeShowWorldUnlockCallout), so a run that crosses a gate
   *  surfaces its reveal the moment the player returns Home. */
  private queueNewWorldUnlocks(): void {
    // While the first-run tutorial is live, the unlock reveal (dialog +
    // "check this out!" callout) stays quiet — the tutorial owns all teaching
    // until it hands over. The baseline still tracks so nothing is missed.
    const teachActive = !this.state.getPlayerData().tutorialDone;
    const count = WORLDS.filter((w) => this.state.canSelectWorld(w)).length;
    if (!teachActive && this.lastUnlockedCount !== null && count > this.lastUnlockedCount) {
      // One giant run can cross several unlock gates at once (e.g. 999 → 5,000
      // total score unlocks dusk AND void). Queue every newly unlocked world
      // so each one gets its own intro dialog, in order — never just the last.
      for (const world of WORLDS.slice(this.lastUnlockedCount, count)) {
        this.unlockQueue.push(world);
      }
    }
    this.lastUnlockedCount = count;
  }

  private checkWorldUnlocks(): void {
    this.queueNewWorldUnlocks();
    this.pumpUnlockQueue();
  }

  /** Game-over world-unlock reveal: when the run's banked score crossed an
   *  unlock gate, queue the new world (its intro dialog fires on the start
   *  screen via checkWorldUnlocks) and surface a "NEW WORLD UNLOCKED" callout
   *  that guides the player to the HOME button. The callout persists on every
   *  game-over screen until the player visits Home and the dialog is shown —
   *  PLAY AGAIN stays fully usable (guide, not force). */
  private maybeShowWorldUnlockCallout(): void {
    this.queueNewWorldUnlocks();
    if (this.unlockQueue.length === 0) return;
    this.goUnlockCallout.style.display = 'flex';
    this.homeBtn.classList.add('go-home-highlight');
    // Rewarding burst: pop confetti from the callout center so the unlock
    // feels celebratory even though PLAY AGAIN stays usable underneath.
    this.spawnGoUnlockConfetti();
  }

  private hideWorldUnlockCallout(): void {
    this.goUnlockCallout.style.display = 'none';
    this.homeBtn.classList.remove('go-home-highlight');
    this.goUnlockCallout.querySelectorAll('.go-unlock-confetti').forEach((n) => n.remove());
  }

  /** Missions unlock at game-over: same card style as world unlock but purple.
   *  Non-blocking — PLAY AGAIN stays usable, the spotlight teach (maybeShowMissionsSpotlight)
   *  fires only when the player visits HOME. World unlock takes precedence if both
   *  fire on the same run. */
  private maybeShowMissionsUnlockCallout(): boolean {
    if (this.unlockQueue.length > 0) return false;
    if (!this.state.hasPendingMissionsUnlock()) return false;
    this.goMissionsCallout.style.display = 'flex';
    this.homeBtn.classList.add('go-home-highlight');
    this.spawnGoMissionsConfetti();
    return true;
  }

  private hideMissionsUnlockCallout(): void {
    this.goMissionsCallout.style.display = 'none';
    // Only drop highlight if world callout isn't also showing.
    if (this.goUnlockCallout.style.display === 'none') {
      this.homeBtn.classList.remove('go-home-highlight');
    }
    this.goMissionsCallout.querySelectorAll('.go-missions-confetti').forEach((n) => n.remove());
  }

  private spawnGoMissionsConfetti(): void {
    const colors = ['#8838c8', '#ffd700', '#4a9bd8', '#ff4d4d', '#28a858'];
    for (let i = 0; i < 12; i++) {
      const p = document.createElement('div');
      p.className = 'go-missions-confetti';
      p.style.background = colors[i % colors.length];
      p.style.transform = 'translate(-50%, -50%)';
      this.goMissionsCallout.appendChild(p);
      const angle = (Math.PI * 2 * i) / 12 + (Math.random() - 0.5) * 0.5;
      const dist = 38 + Math.random() * 32;
      gsap.to(p, {
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist - 12,
        rotation: Math.random() * 600 - 300,
        opacity: 0,
        duration: 0.65 + Math.random() * 0.3,
        ease: 'power2.out',
        onComplete: () => p.remove(),
      });
    }
  }

  private spawnGoUnlockConfetti(): void {
    const colors = ['#ffd700', '#ffb020', '#ff4d4d', '#4a9bd8', '#28a858', '#8838c8'];
    for (let i = 0; i < 14; i++) {
      const p = document.createElement('div');
      p.className = 'go-unlock-confetti';
      p.style.background = colors[i % colors.length];
      p.style.transform = 'translate(-50%, -50%)';
      this.goUnlockCallout.appendChild(p);
      const angle = (Math.PI * 2 * i) / 14 + (Math.random() - 0.5) * 0.6;
      const dist = 42 + Math.random() * 38;
      gsap.to(p, {
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist - 14,
        rotation: Math.random() * 720 - 360,
        opacity: 0,
        duration: 0.7 + Math.random() * 0.35,
        ease: 'power2.out',
        onComplete: () => p.remove(),
      });
    }
  }

  /** Show the next queued unlock intro, one world at a time. */
  private pumpUnlockQueue(): void {
    if (this.unlockQueue.length === 0) return;
    if (!this.unlockDialog.classList.contains('hidden')) return;
    const world = this.unlockQueue.shift();
    if (!world) return;
    this.showUnlockDialog(world);
    this.scheduleUnlockCallout(world.id);
  }

  /** Show the one-time "check this out!" callout a moment after the unlock dialog
   *  (the dialog is full-screen, so the bubble waits until it can be seen). */
  private scheduleUnlockCallout(worldId: WorldId): void {
    if (this.unlockCalloutShown.has(worldId)) return;
    this.unlockCalloutShown.add(worldId);
    window.setTimeout(() => {
      if (this.startScreen.style.display === 'flex') this.showUnlockCallout();
    }, 3500);
  }

  /** Reveal the newly unlocked world behind a lock screen with confetti. */
  private showUnlockDialog(world: WorldConfig): void {
    this.pendingUnlockWorld = world.id;
    this.unlockCardTitle.textContent = world.name.toUpperCase();
    this.unlockCardTitle.style.color = this.WORLD_TITLE_COLORS[world.id];
    this.unlockCardTag.textContent = world.tagline;
    this.unlockCardMeta.textContent = `UNLOCKED AT ${world.unlockScore.toLocaleString()} TOTAL SCORE`;
    this.unlockDialog.classList.remove('hidden');
    this.spawnDialogConfetti();
    const card = this.unlockDialog.querySelector<HTMLElement>('#unlock-card');
    if (card) {
      gsap.killTweensOf(card);
      gsap.fromTo(
        card,
        { scale: 0.7, opacity: 0, y: 20 },
        { scale: 1, opacity: 1, y: 0, duration: 0.5, ease: 'back.out(2)' }
      );
    }
  }

  private closeUnlockDialog(): void {
    this.unlockDialog.classList.add('hidden');
    gsap.killTweensOf(this.unlockDialogConfetti);
    this.unlockDialogConfetti.innerHTML = '';
    // A teach scheduled behind the dialog may now fire; play was unblocked
    // the moment the dialog took over.
    this.setSpotlightBlocking(false);
    this.maybeShowSpotlights();
    // Multi-unlock: if more worlds were unlocked in the same shot, their
    // intros come up next, in order.
    this.pumpUnlockQueue();
  }

  /** One-time shield powerup card, shown the first time the player is on world 2
   *  (dusk) once the shield's World-2 milestone is met. Runs from renderStartScreen
   *  so it fires on arrival via the nav arrow, the unlock dialog's SHOW ME, or a
   *  fresh load already sitting on dusk. Flag is marked seen the moment it shows. */
  private maybeShowShieldCard(): void {
    if (this.state.getActiveWorld().id !== 'dusk') return;
    if (!this.state.isShieldUnlocked()) return;
    const data = this.state.getMutablePlayerData();
    if (data.shieldCardSeen) return;
    data.shieldCardSeen = true;
    this.onDataChanged();
    this.openShieldCard();
  }

  private openShieldCard(): void {
    this.shieldCardDialog.classList.remove('hidden');
    const card = this.shieldCardDialog.querySelector<HTMLElement>('#shield-card');
    if (card) {
      gsap.killTweensOf(card);
      gsap.fromTo(
        card,
        { scale: 0.7, opacity: 0, y: 20 },
        { scale: 1, opacity: 1, y: 0, duration: 0.5, ease: 'back.out(2)' }
      );
    }
  }

  private closeShieldCard(): void {
    this.shieldCardDialog.classList.add('hidden');
    const card = this.shieldCardDialog.querySelector<HTMLElement>('#shield-card');
    if (card) gsap.killTweensOf(card);
    // A teach scheduled behind the card may now fire; play was unblocked the
    // moment the card took over.
    this.setSpotlightBlocking(false);
    this.maybeShowSpotlights();
  }

  /** True while a full-screen overlay that must not be stacked under/over a
   *  teach is up (unlock dialog, shield card, missions overlay). */
  private anyDialogVisible(): boolean {
    if (!this.unlockDialog.classList.contains('hidden')) return true;
    if (!this.shieldCardDialog.classList.contains('hidden')) return true;
    if (this.missionsOverlay.style.display === 'flex') return true;
    return false;
  }

  /** Two teach spots, world first: the locked-next-world spotlight, then (once
   *  dismissed) the new-missions spotlight. Runs from renderStartScreen. */
  private maybeShowSpotlights(): void {
    // Missions first when both are pending (user crossed 250 then 3 runs on same run) — missions is the newer feature
    if (this.maybeShowMissionsSpotlight()) return;
    if (this.maybeShowWorldSpotlight()) return;
  }

  /** One-time locked-world spotlight: dims everything except the next-arrow
   *  button, showing a locked-world-style card. Fires once per locked next
   *  world — the moment the world-nav arrows first reveal (score 250) on world
   *  1, and again later for every world whose lock sits on the path ahead. The
   *  flag is marked seen the moment it shows, so each world only teaches once.
   *  World 3 (void) is exempt: no blocking spotlight — the periodic nav
   *  thought-bubble teases its lock instead. */
  private maybeShowWorldSpotlight(): boolean {
    const data = this.state.getPlayerData();
    const current = this.state.getActiveWorld();
    const next = getNextWorld(current);
    if (!next) return false;
    // World 3's lock gets the lighter touch: a one-time bubble after the first
    // dusk run, never a blocking spotlight teach.
    if (next.id === 'void') return false;
    // Feature 4 / Requirement 9.4: if Dusk (1000) was already unlocked before the
    // 250-point nav reveal ever fired, the 250 teach is obsolete — the unlock
    // dialog + SHOW ME already introduced the nav with full context, so never
    // retroactively show the generic world-nav spotlight for Dusk.
    if (next.id === 'dusk' && data.totalScore >= WORLDS[1].unlockScore) return false;
    if (this.state.canSelectWorld(next)) return false;
    if (data.worldSpotlightSeen.includes(next.id)) return false;
    if (data.totalScore < GAME_CONFIG.WORLD_NAV_REVEAL_SCORE) return false;
    // Don't tease the world after a world 1 player with a huge first run that
    // skips straight past world 2 — they haven't experienced dusk yet. The
    // teach waits until they've actually played the world they're standing on.
    const currentIndex = WORLDS.indexOf(current);
    const playedCurrent = currentIndex === 0 || (data.bestPerWorld[currentIndex] ?? 0) > 0;
    if (!playedCurrent) return false;
    if (this.state.isPreviewLocked()) return false;
    if (this.spotlightTimer !== null || this.spotlightOpen) return false;
    // Don't stack on top of the dialogs — they have their own moment.
    if (this.anyDialogVisible()) return false;
    this.scheduleSpotlight(() => this.openWorldSpotlight(next));
    return true;
  }

  /** One-time "new missions" spotlight: same dim + ring + card, aimed at the
   *  missions button. Fires right after any pending locked-world spotlight, and
   *  only from the start screen. Dismissing it settles the missions gate, so it
   *  never leaves the player stuck (see closeSpotlight). */
  private maybeShowMissionsSpotlight(): boolean {
    const data = this.state.getPlayerData();
    if (data.missionsSpotlightSeen) return false;
    if (!this.state.hasPendingMissionsUnlock()) return false;
    if (this.state.isPreviewLocked()) return false;
    if (this.spotlightTimer !== null || this.spotlightOpen) return false;
    if (this.anyDialogVisible()) return false;
    this.scheduleSpotlight(() => this.openMissionsSpotlight());
    return true;
  }

  /** Queue a spotlight to open after a beat, hiding the play button for the
   *  whole wait so the teach isn't skipped. */
  private scheduleSpotlight(open: () => void): void {
    this.setSpotlightBlocking(true);
    this.spotlightTimer = window.setTimeout(() => {
      this.spotlightTimer = null;
      open();
    }, 1200);
  }

  /** During an in-flight teach the play button disappears; any dialog that
   *  takes over (or a cancelled schedule) re-enables it. */
  private setSpotlightBlocking(blocking: boolean): void {
    if (blocking) {
      if (this.spotlightBlockTimer !== null) return;
      this.spotlightBlockTimer = window.setTimeout(() => {
        this.spotlightBlockTimer = null;
        this.startScreen.classList.add('spotlight-pending');
      }, 0);
    } else {
      if (this.spotlightBlockTimer !== null) {
        clearTimeout(this.spotlightBlockTimer);
        this.spotlightBlockTimer = null;
      }
      this.startScreen.classList.remove('spotlight-pending');
    }
  }

  private openWorldSpotlight(next: WorldConfig): void {
    if (this.spotlightOpen || this.state.isPreviewLocked() || this.anyDialogVisible()) {
      this.setSpotlightBlocking(false);
      return;
    }
    const data = this.state.getMutablePlayerData();
    if (!data.worldSpotlightSeen.includes(next.id)) {
      data.worldSpotlightSeen.push(next.id);
      this.onDataChanged();
    }
    this.spotlightKind = 'world';
    this.openSpotlight(
      this.worldNext,
      'left',
      'UNLOCK NEW WORLD',
      next.name,
      next.lockedDescription
    );
  }

  private openMissionsSpotlight(): void {
    if (this.spotlightOpen || this.state.isPreviewLocked() || this.anyDialogVisible()) {
      this.setSpotlightBlocking(false);
      return;
    }
    const data = this.state.getMutablePlayerData();
    data.missionsSpotlightSeen = true;
    this.onDataChanged();
    this.spotlightKind = 'missions';
    // No yellow kicker for missions — the card alone names the feature. The
    // desc stays honest: missions only ever reward coins, across all three
    // kinds (daily, world, lifetime).
    this.openSpotlight(
      this.missionsBtn,
      'above',
      null,
      'Missions unlocked',
      'Complete missions to earn coins.'
    );
  }

  private openSpotlight(
    target: HTMLElement,
    placement: 'left' | 'above',
    kicker: string | null,
    title: string,
    desc: string
  ): void {
    if (this.spotlightOpen) return;
    this.spotlightOpen = true;
    this.spotlightTarget = target;
    this.spotlightOverlay.classList.toggle('above', placement === 'above');
    this.spotlightKicker.textContent = kicker ?? '';
    this.spotlightKicker.style.display = kicker ? '' : 'none';
    this.spotlightCardTitle.textContent = title;
    this.spotlightCardDesc.textContent = desc;
    this.spotlightOverlay.classList.remove('hidden');
    this.positionSpotlightHole(target);
    gsap.killTweensOf(this.spotlightOverlay);
    gsap.killTweensOf(this.spotlightHole);
    gsap.killTweensOf(this.spotlightRing);
    gsap.killTweensOf(this.spotlightCard);
    gsap.fromTo(this.spotlightOverlay, { opacity: 0 }, { opacity: 1, duration: 0.3 });
    gsap.fromTo(this.spotlightHole, { opacity: 0 }, { opacity: 1, duration: 0.35 });
    gsap.fromTo(
      this.spotlightRing,
      { scale: 1.1, opacity: 0 },
      { scale: 1.45, opacity: 0.9, duration: 0.7, repeat: -1, yoyo: true, ease: 'sine.inOut' }
    );
    const slide =
      placement === 'left'
        ? { x: 16, y: 0, xPercent: 0, yPercent: -50, opacity: 0 }
        : { x: 0, y: 16, xPercent: -50, yPercent: 0, opacity: 0 };
    const rest =
      placement === 'left'
        ? { x: 0, y: 0, xPercent: 0, yPercent: -50, opacity: 1 }
        : { x: 0, y: 0, xPercent: -50, yPercent: 0, opacity: 1 };
    gsap.fromTo(this.spotlightCard, slide, {
      ...rest,
      duration: 0.4,
      delay: 0.15,
      ease: 'back.out(2)'
    });
    // Non-blocking: auto-dismiss after 5s, mistouch is prevented by the overlay
    // itself (covers screen) until it closes — click anywhere dismisses early.
    if (this.spotlightAutoTimer !== null) window.clearTimeout(this.spotlightAutoTimer);
    this.spotlightAutoTimer = window.setTimeout(() => {
      this.spotlightAutoTimer = null;
      this.closeSpotlight();
    }, 5000);
  }

  /** Center the spotlight hole on a target button (next-arrow / missions). */
  private positionSpotlightHole(target: HTMLElement): void {
    const rect = target.getBoundingClientRect();
    const overlayRect = this.spotlightOverlay.getBoundingClientRect();
    if (rect.width === 0) return;
    const r = Math.max(rect.width, rect.height) / 2 + 10;
    this.spotlightHole.style.left = `${rect.left - overlayRect.left + rect.width / 2 - r}px`;
    this.spotlightHole.style.top = `${rect.top - overlayRect.top + rect.height / 2 - r}px`;
    this.spotlightHole.style.width = `${r * 2}px`;
    this.spotlightHole.style.height = `${r * 2}px`;
  }

  private closeSpotlight(): void {
    if (!this.spotlightOpen) return;
    this.spotlightOpen = false;
    this.spotlightTarget = null;
    if (this.spotlightAutoTimer !== null) {
      window.clearTimeout(this.spotlightAutoTimer);
      this.spotlightAutoTimer = null;
    }
    // Dismissing the missions teach counts as finding the missions feature —
    // any tap anywhere re-enables play (no need to open the overlay itself).
    if (this.spotlightKind === 'missions') this.settleMissionsTeach();
    this.spotlightKind = null;
    this.setSpotlightBlocking(false);
    gsap.killTweensOf(this.spotlightOverlay);
    gsap.killTweensOf(this.spotlightHole);
    gsap.killTweensOf(this.spotlightRing);
    gsap.killTweensOf(this.spotlightCard);
    gsap.to(this.spotlightOverlay, {
      opacity: 0,
      duration: 0.25,
      onComplete: () => {
        this.spotlightOverlay.classList.add('hidden');
        gsap.set(this.spotlightOverlay, { opacity: 1 });
        // Let any queued teach (e.g. new missions) take over.
        this.maybeShowSpotlights();
      }
    });
  }

  /** Clear the one-time missions gate once the teach has been acknowledged. */
  private settleMissionsTeach(): void {
    const data = this.state.getMutablePlayerData();
    if (this.state.hasPendingMissionsUnlock()) {
      data.missionsUnlockSeen = true;
      this.onDataChanged();
      this.refreshMissionsPending();
    }
  }

  /** Confetti raining behind the card inside the unlock dialog. */
  private spawnDialogConfetti(): void {
    this.unlockDialogConfetti.innerHTML = '';
    const colors = ['#ffd23f', '#c98bff', '#8ef1ff', '#ff7ac8', '#ff9d6b', '#28a858', '#ff4d4d'];
    for (let i = 0; i < 70; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.background = colors[Math.floor(Math.random() * colors.length)];
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.width = `${6 + Math.random() * 8}px`;
      piece.style.height = `${6 + Math.random() * 8}px`;
      piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
      this.unlockDialogConfetti.appendChild(piece);
      const xOffset = (Math.random() - 0.5) * 140;
      const duration = 1.6 + Math.random() * 1.8;
      const delay = Math.random() * 1.2;
      const rotation = Math.random() * 720 - 360;
      gsap.fromTo(
        piece,
        { y: -20, x: 0, rotation: 0, opacity: 1 },
        {
          y: window.innerHeight + 30,
          x: xOffset,
          rotation,
          opacity: 0,
          duration,
          delay,
          ease: 'power1.in',
          onComplete: () => piece.remove()
        }
      );
    }
  }

  /** Locked-world overlay: lock covers the world instantly so its layout stays hidden. */
  private openLockOverlay(world: WorldConfig): void {
    const data = this.state.getPlayerData();
    this.lockWorldName.textContent = '????';
    this.lockDesc.textContent = world.lockedDescription;
    this.lockTagline.textContent = `Unlocks at ${world.unlockScore.toLocaleString()} total score`;
    const pct = Math.min(100, Math.round((data.totalScore / world.unlockScore) * 100));
    this.lockFill.style.width = `${pct}%`;
    this.lockProgressText.textContent = `${data.totalScore.toLocaleString()} / ${world.unlockScore.toLocaleString()}`;
    const remaining = Math.max(0, world.unlockScore - data.totalScore);
    this.lockRemaining.textContent = `${remaining.toLocaleString()} more points to go`;
    this.menuBtns.classList.add('menu-hidden');
    this.stopBubble();
    this.lockOverlay.style.display = 'flex';
  }

  private closeLockOverlay(): void {
    if (this.state.isPreviewLocked()) this.revertPreview();
    this.menuBtns.classList.remove('menu-hidden');
    this.lockOverlay.style.display = 'none';
  }

  /** Leaving a locked preview (overlay close / back arrow): revert to the highest unlocked world. */
  private revertPreview(): void {
    let highest: WorldConfig | null = null;
    for (const w of WORLDS) if (this.state.canSelectWorld(w)) highest = w;
    this.state.clearPreview();
    if (highest) {
      this.state.selectWorld(highest.id);
      this.onWorldSelect(highest.id);
    }
    this.renderStartScreen();
  }

  /** Open the missions tab: render the active tab, animate bars, confetti on claim. */
  openMissions(): void {
    this.animatedMissionsTabs.clear();
    // A pending or open teach is moot once the missions overlay takes over —
    // cancel it so it can't fire over/under the overlay. Play is unblocked; if
    // a locked-world teach is still valid it reschedules via renderStartScreen.
    if (this.spotlightTimer !== null) {
      clearTimeout(this.spotlightTimer);
      this.spotlightTimer = null;
    }
    this.setSpotlightBlocking(false);
    if (this.spotlightOpen) this.closeSpotlight();
    // First visit after missions unlock: clear the one-time callout gate that
    // blocked the next run (persisted so a reload doesn't re-block).
    if (this.state.hasPendingMissionsUnlock()) {
      this.state.getMutablePlayerData().missionsUnlockSeen = true;
      this.onDataChanged();
      this.refreshMissionsPending();
    }
    this.renderMissionsOverlay();
    this.missionsOverlay.style.display = 'flex';
  }

  closeMissions(): void {
    this.missionsOverlay.style.display = 'none';
    this.stopCountdown();
  }

  /** Open settings: sync sliders to the persisted values, then show. */
  openSettings(): void {
    const data = this.state.getPlayerData();
    this.soundSlider.value = String(data.soundVolume);
    this.musicSlider.value = String(data.musicVolume);
    this.sensitivitySlider.value = String(data.sensitivity);
    this.soundValue.textContent = String(data.soundVolume);
    this.musicValue.textContent = String(data.musicVolume);
    this.sensitivityValue.textContent = String(data.sensitivity);
    this.settingsOverlay.style.display = 'flex';
  }

  closeSettings(): void {
    this.settingsOverlay.style.display = 'none';
  }

  /** Persist the sound volume, notify Game, and refresh the value label. */
  private applySoundVolume(): void {
    const volume = Number(this.soundSlider.value);
    this.soundValue.textContent = String(volume);
    const data = this.state.getMutablePlayerData();
    data.soundVolume = volume;
    this.onSoundVolumeChange(volume);
    void this.persistSettings();
  }

  /** Persist the music volume (music channel is reserved for a future track). */
  private applyMusicVolume(): void {
    const volume = Number(this.musicSlider.value);
    this.musicValue.textContent = String(volume);
    const data = this.state.getMutablePlayerData();
    data.musicVolume = volume;
    this.onMusicVolumeChange(volume);
    void this.persistSettings();
  }

  /** Persist the drag sensitivity (0–100; consumed by InputSystem at drag time). */
  private applySensitivity(): void {
    const sensitivity = Number(this.sensitivitySlider.value);
    this.sensitivityValue.textContent = String(sensitivity);
    const data = this.state.getMutablePlayerData();
    data.sensitivity = sensitivity;
    void this.persistSettings();
  }

  /** One-tap return to the default sensitivity (50 = the original feel). */
  private resetSensitivity(): void {
    this.sensitivitySlider.value = '50';
    this.applySensitivity();
  }

  /**
   * Independent notify bubbles.
   * - Missions: total count of unclaimed rewards on the start-screen button
   *   (capped at "5+"); each missions tab instead gets a plain red "!" while it
   *   has pending claims. Both clear once the rewards are claimed (not just
   *   until the tab is opened) and reappear when a new mission completes.
   * - Shop: count of unowned skins the current coin balance can afford.
   */
  private refreshMissionNotify(): void {
    const claimable = this.state.getClaimableMissionCount();
    this.missionsNotify.textContent = claimable > 5 ? '5+' : String(claimable);
    this.missionsNotify.hidden = claimable === 0;
    this.missionsTabs.forEach((tab) => {
      const kind = tab.dataset.tab as MissionKind | undefined;
      const badge = tab.querySelector<HTMLElement>('.m-tab-badge');
      if (!badge || !kind) return;
      const count = this.state.getClaimableCountForKind(kind);
      badge.textContent = '!';
      badge.hidden = count === 0;
    });
  }

  private refreshShopNotify(): void {
    const data = this.state.getPlayerData();
    const count = GAME_CONFIG.SHOP_SKINS.filter(
      (s) => !data.purchasedSkins.includes(s.id) && data.totalCoins >= s.price
    ).length;
    this.shopNotify.textContent = count > 5 ? '5+' : String(count);
    this.shopNotify.hidden = count === 0;
  }

  /** Save volume settings through the persistence callback (wired by Game). */
  onPersistSettings: () => Promise<void> = async () => {};

  private persistSettings(): Promise<void> {
    return this.onPersistSettings();
  }

  /** Open stats: re-render all-time numbers from player data. */
  openStats(): void {
    this.renderStats();
    this.statsOverlay.style.display = 'flex';
  }

  closeStats(): void {
    this.statsOverlay.style.display = 'none';
  }

  /** Fill the all-time stats panel from persisted player data. */
  renderStats(): void {
    const data = this.state.getPlayerData();
    this.statRuns.textContent = data.runsPlayed.toLocaleString();
    this.statTotalScore.textContent = data.totalScore.toLocaleString();
    this.statCoins.textContent = data.totalCoinsEarned.toLocaleString();
    this.statPerfects.textContent = data.totalPerfects.toLocaleString();
    this.statStreak.textContent = data.bestStreak.toLocaleString();

    let streakWorld = '—';
    let bestIdx = -1;
    for (let i = 0; i < WORLDS.length; i++) {
      const s = data.bestStreakPerWorld[i] ?? 0;
      if (s >= data.bestStreak && s > 0) {
        bestIdx = i;
      }
    }
    // Prefer the world that actually holds the global best (ties → first/last match).
    const globalIdx = data.bestStreakPerWorld.findIndex((s) => s === data.bestStreak);
    const idx = globalIdx >= 0 ? globalIdx : bestIdx;
    if (idx >= 0) streakWorld = WORLDS[idx].name;
    this.statStreakWorld.textContent = streakWorld === '—' ? '' : `Best in ${streakWorld}`;

    this.statWorlds.innerHTML = '';
    for (let i = 0; i < WORLDS.length; i++) {
      const row = document.createElement('div');
      row.className = 'stat-world-row';
      const name = document.createElement('span');
      name.className = 'stat-world-name';
      name.textContent = WORLDS[i].name;
      const best = document.createElement('span');
      best.className = 'stat-world-best';
      best.textContent = (data.bestPerWorld[i] ?? 0).toLocaleString();
      row.append(name, best);
      this.statWorlds.appendChild(row);
    }
  }

  /** Live countdown to the next daily-mission reset (runs while the overlay is open). */
  private startCountdown(): void {
    this.stopCountdown();
    this.updateCountdown();
    this.countdownTimer = window.setInterval(() => this.updateCountdown(), 1000);
  }

  private stopCountdown(): void {
    if (this.countdownTimer !== null) {
      window.clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  }

  private updateCountdown(): void {
    const clock = this.missionsCountdown.querySelector<HTMLElement>('.cd-clock');
    if (clock) clock.textContent = formatCountdown(getTimeUntilNextReset());
  }

  /** Missions are still gated (MISSIONS_UNLOCK_RUNS not met): a plain locked
   *  card instead of the mission list — missions logo, a run-progress bar
   *  toward the unlock, and a dynamic hint. No title (the overlay header
   *  already says "MISSIONS"). Tabs are hidden entirely. */
  private renderMissionsLocked(): void {
    this.stopCountdown();
    this.missionsCountdown.style.display = 'none';
    this.missionsTabs.forEach((t) => (t.disabled = true));
    this.missionsTabsBar.style.display = 'none';
    this.missionsList.innerHTML = '';

    const card = document.createElement('div');
    card.className = 'missions-locked';

    const icon = document.createElement('div');
    icon.className = 'missions-locked-icon';
    icon.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="10.5" fill="none" stroke="#111" stroke-width="1.6"/>
        <circle cx="12" cy="12" r="7" fill="none" stroke="#111" stroke-width="1.6"/>
        <circle cx="12" cy="12" r="3.5" fill="#ff4d4d" stroke="#111" stroke-width="1.6"/>
      </svg>`;

    const bar = document.createElement('div');
    bar.className = 'missions-locked-bar';
    const fill = document.createElement('div');
    fill.className = 'missions-locked-bar-fill';
    const runs = this.state.getPlayerData().runsPlayed;
    const pct = Math.min(100, (runs / GAME_CONFIG.MISSIONS_UNLOCK_RUNS) * 100);
    fill.style.width = `${pct}%`;
    bar.appendChild(fill);

    const remaining = Math.max(0, GAME_CONFIG.MISSIONS_UNLOCK_RUNS - runs);
    const hint = document.createElement('div');
    hint.className = 'missions-locked-hint';
    hint.textContent = remaining === 1 ? 'play 1 more game to unlock' : `play ${remaining} more games to unlock`;

    card.append(icon, bar, hint);
    this.missionsList.appendChild(card);
  }

  private renderMissionsOverlay(): void {
    if (!this.state.isMissionsUnlocked()) {
      this.renderMissionsLocked();
      return;
    }
    this.missionsTabs.forEach((t) => (t.disabled = false));
    this.missionsTabsBar.style.display = 'flex';
    const data = this.state.getPlayerData();
    const run = this.state.getState();
    let rows = getMissionProgressList(data, {
      score: run.score,
      runPerfects: run.runPerfects,
      runCoins: run.runCoins,
      maxStreak: run.maxStreak,
      selectedWorld: this.state.getActiveWorld().id
    }, undefined, this.state.isUnlockAllWorlds()).filter((r) => r.kind === this.activeMissionTab);

    // "Come back tomorrow" countdown only makes sense once today's set is cleared.
    // Start it whenever it becomes visible (covers first open AND tab switches),
    // stop it otherwise — otherwise a freshly-revealed clock keeps the `--:--:--`
    // placeholder because only `openMissions` used to start it.
    const allDailyDone =
      this.activeMissionTab === 'general' &&
      rows.length > 0 &&
      rows.every((r) => r.done);
    this.missionsCountdown.style.display = allDailyDone ? 'flex' : 'none';
    if (allDailyDone) this.startCountdown();
    else this.stopCountdown();

    if (this.activeMissionTab === 'world') {
      const worldOrder: Record<string, number> = { sunrise: 0, dusk: 1, void: 2 };
      rows.sort(
        (a, b) =>
          (worldOrder[a.world ?? ''] ?? 9) - (worldOrder[b.world ?? ''] ?? 9) || a.target - b.target
      );
    } else {
      rows.sort((a, b) => a.target - b.target);
    }

    // Re-renders must never yank the list: the claim animation rebuilds the
    // DOM from scratch, and the browser clamps scrollTop to the new content
    // height — preserve the offset so a claim at the bottom of the list keeps
    // the view pinned there (tab switches reset explicitly beforehand).
    const previousScrollTop = this.missionsScroll.scrollTop;
    this.missionsList.innerHTML = '';

    let lastWorld: string | null = null;
    for (const m of rows) {
      // World tab: group each world's missions under a world-name header.
      if (this.activeMissionTab === 'world') {
        const wKey = m.world ?? '';
        if (wKey !== lastWorld) {
          lastWorld = wKey;
          const world = getWorldById(wKey as WorldId);
          const header = document.createElement('div');
          header.className = 'mission-world-header';
          const name = document.createElement('span');
          name.className = 'mission-world-name';
          name.textContent = world ? world.name.toUpperCase() : '';
          const lockHint = document.createElement('span');
          lockHint.className = 'mission-world-hint';
          if (world) {
            if (this.state.canSelectWorld(world)) {
              lockHint.textContent = world.unlockScore > 0 ? 'UNLOCKED' : '';
            } else {
              lockHint.textContent = `UNLOCKS AT ${world.unlockScore.toLocaleString()}`;
            }
            lockHint.classList.toggle('closed', !this.state.canSelectWorld(world));
          }
          header.append(name, lockHint);
          this.missionsList.appendChild(header);
        }
      }

      const row = document.createElement('div');
      row.className = `mission-row${m.done ? ' done' : ''}${m.locked ? ' locked' : ''}`;
      row.dataset.id = m.id;

      const info = document.createElement('div');
      info.className = 'm-info';
      const title = document.createElement('div');
      title.className = 'm-title';
      title.textContent = m.title;
      const desc = document.createElement('div');
      desc.className = 'm-desc';
      desc.textContent = m.desc;
      info.append(title, desc);

      const bar = document.createElement('div');
      bar.className = 'm-bar';
      const fill = document.createElement('div');
      fill.className = 'm-bar-fill';
      fill.dataset.width = String(m.percent);
      bar.appendChild(fill);

      const metric = document.createElement('div');
      metric.className = 'm-metric';
      metric.textContent = `${m.current}/${m.target}`;

      row.append(info, bar, metric);

      if (m.locked) {
        // no lock icon — user asked to keep it clean
      } else if (m.done) {
        if (this.state.isMissionClaimed(m.id)) {
          const check = document.createElement('span');
          check.className = 'm-check';
          check.innerHTML = UIManager.checkSvg(UIManager.resolveCheckSize());
          row.appendChild(check);
        } else {
          const claim = document.createElement('button');
          claim.className = 'm-claim-btn';
          claim.dataset.claim = m.id;
          claim.innerHTML =
            `<span class="coin-icon"><img src="${this.asset('Coin.png')}" alt="coin"></span> ` +
            `<span class="claim-amount">+${m.reward}</span>`;
          row.appendChild(claim);
        }
      }

      this.missionsList.appendChild(row);
    }

    this.animateMissionBars();
    if (previousScrollTop > 0) this.missionsScroll.scrollTop = previousScrollTop;
  }

  /** Claim a completed mission's reward: award coins, morph the claim capsule
   *  into a green circle (length-only collapse) and pop out the tick, re-render,
   *  then burst confetti on the freshly-rendered row (the pre-render row
   *  reference is wiped by the re-render and would be detached). */
  private claimMission(id: string, btn?: HTMLElement): void {
    const reward = this.state.claimMissionReward(id);
    if (!reward) {
      this.refreshMissionNotify();
      return;
    }
    this.onMissionClaim();
    this.onDataChanged();
    this.refreshCoins();
    this.refreshMissionNotify();

    const finish = () => {
      this.renderMissionsOverlay();
      const row = this.missionsList.querySelector<HTMLElement>(`.mission-row[data-id="${id}"]`);
      if (row) this.burstConfetti(row, 14);
    };

    if (btn) this.animateClaimButton(btn, finish);
    else finish();
  }

  /** Capsule → circle morph. The pill shrinks into a green circle whose diameter
   *  equals the rendered check-circle size (`--check-size`), so the re-rendered
   *  check superimposes the collapsed capsule exactly — same px, always, even
   *  after tab switches or full reloads. The coin + amount fade out during the
   *  morph; the tick pops out inside the collapsed circle. */
  private animateClaimButton(btn: HTMLElement, onDone: () => void): void {
    btn.classList.add('claiming');
    const size = UIManager.resolveCheckSize();
    const amount = btn.querySelector('.claim-amount') as HTMLElement | null;
    const coin = btn.querySelector('.coin-icon') as HTMLElement | null;

    if (amount) gsap.to(amount, { opacity: 0, duration: 0.15 });
    if (coin) gsap.to(coin, { opacity: 0, duration: 0.15 });
    gsap.to(btn, {
      width: size,
      height: size,
      paddingLeft: 0,
      paddingRight: 0,
      gap: 0,
      duration: 0.3,
      ease: 'power2.inOut',
      onComplete: () => {
        btn.innerHTML = UIManager.TICK_SVG;
        const svg = btn.querySelector('.m-tick-svg') as HTMLElement | null;
        if (svg) {
          svg.style.width = `${size}px`;
          svg.style.height = `${size}px`;
        }
        gsap.fromTo(
          btn.querySelector('.m-tick-svg'),
          { scale: 0 },
          { scale: 1, duration: 0.35, ease: 'back.out(1.7)' }
        );
        setTimeout(onDone, 350);
      }
    });
  }

  /** Resolve `--check-size` to pixels via a probe element, so it works even when
   *  the missions overlay holds no rendered check yet (e.g. the very first claim). */
  private static resolveCheckSize(): number {
    const probe = document.createElement('span');
    probe.className = 'm-check-svg';
    probe.style.cssText = 'position:absolute;visibility:hidden;left:-9999px;';
    document.body.appendChild(probe);
    const size = probe.getBoundingClientRect().width;
    probe.remove();
    return size || 28;
  }

  /** Staggered bar fill, once per tab open (GSAP): 0% → real progress the first
   *  time a tab renders this overlay session. Completed rows stay full and
   *  static — no re-animation. Re-renders (claims, tab switches) snap directly
   *  to the target instead of refilling, so bars never replay. */
  private animateMissionBars(): void {
    const fills = Array.from(this.missionsList.querySelectorAll<HTMLElement>('.m-bar-fill'));
    const alreadyAnimated = this.animatedMissionsTabs.has(this.activeMissionTab);
    let lastDelay = 0;
    fills.forEach((fill, i) => {
      const target = fill.dataset.width ?? '0';
      const row = fill.closest('.mission-row');
      if (alreadyAnimated || (row && row.classList.contains('done'))) {
        fill.style.width = `${target}%`;
        return;
      }
      lastDelay = 0.2 + i * 0.05;
      gsap.fromTo(
        fill,
        { width: '0%' },
        { width: `${target}%`, duration: 0.6, delay: lastDelay, ease: 'power2.out' }
      );
    });
    if (!alreadyAnimated) this.animatedMissionsTabs.add(this.activeMissionTab);
  }

  /** Confetti falls inside the completed mission card itself (one-time). */
  private burstConfetti(target: HTMLElement, count: number): void {
    const colors = ['#ff4d4d', '#ffd700', '#4dd4ff', '#44ff88', '#ff44aa', '#8844ff'];
    for (let i = 0; i < count; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.background = colors[Math.floor(Math.random() * colors.length)];
      piece.style.left = `${5 + Math.random() * 90}%`;
      piece.style.width = `${4 + Math.random() * 5}px`;
      piece.style.height = `${4 + Math.random() * 5}px`;
      piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
      target.appendChild(piece);
      gsap.fromTo(
        piece,
        { y: -6, x: 0, rotation: 0, opacity: 1 },
        {
          y: target.clientHeight + 8,
          x: (Math.random() - 0.5) * 60,
          rotation: Math.random() * 540 - 270,
          opacity: 0,
          duration: 0.7 + Math.random() * 0.7,
          delay: 0.1 + Math.random() * 0.4,
          ease: 'power1.in',
          onComplete: () => piece.remove()
        }
      );
    }
  }

  /** Render the ball shop (`uc`). */
  renderShop(): void {
    const data = this.state.getPlayerData();
    this.shopScroll.innerHTML = '';
    for (const skin of GAME_CONFIG.SHOP_SKINS) {
      const owned = data.purchasedSkins.includes(skin.id);
      const equipped = data.selectedSkin === skin.id;
      const affordable = data.totalCoins >= skin.price;

      const item = document.createElement('div');
      item.className = `shop-item${equipped ? ' selected' : ''}`;

      const color = owned ? `#${skin.color.toString(16).padStart(6, '0')}` : '#111111';
      const preview = document.createElement('div');
      preview.className = 'shop-item-preview';
      preview.style.background = color;

      const info = document.createElement('div');
      info.className = 'shop-item-info';
      const name = document.createElement('div');
      name.className = 'shop-item-name';
      name.textContent = owned ? skin.name : '???';
      const status = document.createElement('div');
      status.className = 'shop-item-status';
      status.textContent = owned ? 'Owned' : `${skin.price} coins`;
      info.appendChild(name);
      info.appendChild(status);

      let action: HTMLButtonElement;
      if (equipped) {
        action = document.createElement('button');
        action.className = 'shop-item-btn equipped';
        action.disabled = true;
        action.textContent = 'EQUIPPED';
      } else if (owned) {
        action = document.createElement('button');
        action.className = 'shop-item-btn';
        action.dataset.action = 'equip';
        action.dataset.skin = skin.id;
        action.textContent = 'EQUIP';
      } else {
        action = document.createElement('button');
        action.className = 'shop-item-btn';
        action.dataset.action = 'buy';
        action.dataset.skin = skin.id;
        action.disabled = !affordable;
        action.innerHTML = `<span class="coin-icon"><img src="${this.asset('Coin.png')}" alt="coin"></span> ${skin.price}`;
      }

      item.appendChild(preview);
      item.appendChild(info);
      item.appendChild(action);
      this.shopScroll.appendChild(item);
    }
  }

  openShop(): void {
    this.renderShop();
    this.refreshCoins();
    this.shopOverlay.style.display = 'flex';
  }

  private onShopClick(e: Event): void {
    const target = (e.target as HTMLElement).closest('[data-action]') as HTMLElement | null;
    if (!target) return;
    const action = target.dataset.action;
    const skinId = target.dataset.skin!;
    if (action === 'buy') {
      if (!this.state.buySkin(skinId)) return;
      this.onSkinApplied();
      this.onDataChanged();
      this.renderShop();
      this.refreshCoins();
    } else if (action === 'equip') {
      if (!this.state.equipSkin(skinId)) return;
      this.onSkinApplied();
      this.onDataChanged();
      this.renderShop();
    }
  }

  onDataChanged: () => void = () => {};

  /** Mirror `zy(r)`: game-over overlay, coins count-up, confetti flag. */
  showGameOver(isNewBest: boolean): void {
    const data = this.state.getPlayerData();
    const score = this.state.getState().score;
    const roundCoins = this.state.getState().roundCoins;

    this.goScore.textContent = String(score);
    // The "best" is per-world — this run is compared against the best ever made
    // in THIS world. The world name already appears below the coins row, so the
    // line just reads "Best <n>" (the all-time best still lives in the ledger).
    const bestIdx = WORLDS.indexOf(this.state.getActiveWorld());
    this.goBestVal.textContent = String(data.bestPerWorld[bestIdx] ?? 0);
    this.goNewBest.style.display = isNewBest ? 'block' : 'none';
    this.goRoundCoins.textContent = `+${roundCoins}`;

    this.goWorld.textContent = this.state.getActiveWorld().name.toUpperCase();

    const startCoins = data.totalCoins - roundCoins;
    this.goTotalCoins.textContent = String(startCoins);
    this.gameOverScreen.style.display = 'flex';
    // A run that crossed a world-unlock gate surfaces its reveal here: the
    // callout guides the player to HOME, where the unlock dialog fires.
    // Missions unlock is second priority and non-blocking.
    this.maybeShowWorldUnlockCallout();
    if (this.goUnlockCallout.style.display === 'none') {
      this.maybeShowMissionsUnlockCallout();
    }

    if (roundCoins > 0) {
      const duration = Math.min(0.8 + roundCoins * 0.05, 2);
      const obj = { val: startCoins };
      gsap.to(obj, {
        val: data.totalCoins,
        duration,
        delay: 0.4,
        ease: 'power1.out',
        onUpdate: () => {
          this.goTotalCoins.textContent = String(Math.round(obj.val));
        }
      });
    }
  }

  hideGameOver(): void {
    this.gameOverScreen.style.display = 'none';
    this.goTotalCoins.textContent = '';
    this.goWorld.textContent = '';
    this.hideWorldUnlockCallout();
    this.hideMissionsUnlockCallout();
  }

  /** Perfect xN pop-up — research decision: hidden during tutorial (guidedFirst / !tutorialDone)
   *  to avoid clutter with keep-hopping, and fire at 10+ is separate (top 18%) so no overlap.
   *  Tiered gold/orange/fire palette, single instance, auto-fades. */
  showPerfectPopup(streak: number): void {
    // At 10, FIRE banner takes the same spot — suppress Perfect x10, counter resumes at 11
    if (streak === 10) return;
    if (Date.now() - this.lastFireTime < 2600) return;
    if (this.perfectPopupActive) {
      gsap.killTweensOf(this.perfectPopupActive);
      this.perfectPopupActive.remove();
      this.perfectPopupActive = null;
    }
    const el = document.createElement('div');
    el.className = 'perfect-popup';
    const title = document.createElement('div');
    title.className = 'perfect-popup-title';
    title.textContent = 'PERFECT';
    const value = document.createElement('div');
    value.className = 'perfect-popup-streak';
    value.textContent = `×${streak}`;
    // Tiered color scheme — green 20+, purple 30+ added per request
    let color = '#fff';
    let glow = 'none';
    if (streak >= 30) {
      color = '#a855f7';
      glow = '0 0 14px rgba(168,85,247,0.7)';
    } else if (streak >= 20) {
      color = '#22c55e';
      glow = '0 0 14px rgba(34,197,94,0.7)';
    } else if (streak >= 10) {
      color = '#ff4d4d';
      glow = '0 0 14px rgba(255,77,61,0.7)';
    } else if (streak >= 7) {
      color = '#ff6b35';
      glow = '0 0 12px rgba(255,107,53,0.55)';
    } else if (streak >= 5) {
      color = '#ffb020';
      glow = '0 0 10px rgba(255,176,32,0.5)';
    } else if (streak >= 3) {
      color = '#ffd700';
      glow = '0 0 8px rgba(255,215,0,0.5)';
    }
    value.style.color = color;
    title.style.color = streak >= 3 ? color : '#fff';
    if (glow !== 'none') {
      value.style.filter = `drop-shadow(${glow})`;
      title.style.filter = `drop-shadow(${glow})`;
    }
    el.append(title, value);
    this.perfectPopupContainer.appendChild(el);
    this.perfectPopupActive = el;
    gsap.fromTo(el, { scale: 0.4, opacity: 0, y: 0 }, { scale: 1.25, opacity: 1, duration: 0.22, ease: 'back.out(2.2)' });
    gsap.to(el, { scale: 1, duration: 0.15, delay: 0.22, ease: 'power2.out' });
    gsap.to(el, {
      y: -40,
      opacity: 0,
      duration: 0.4,
      delay: 0.57,
      ease: 'power2.in',
      onComplete: () => {
        if (el.parentNode) el.remove();
        if (this.perfectPopupActive === el) this.perfectPopupActive = null;
      }
    });
  }

  clearPerfectPopups(): void {
    if (this.perfectPopupActive) {
      gsap.killTweensOf(this.perfectPopupActive);
      this.perfectPopupActive.remove();
      this.perfectPopupActive = null;
    }
    this.perfectPopupContainer.innerHTML = '';
  }

  showPauseButton(): void {
    this.pauseBtn.classList.add('visible');
  }
  hidePauseButton(): void {
    this.pauseBtn.classList.remove('visible');
  }
  showPauseOverlay(): void {
    this.pauseOverlay.classList.add('visible');
    this.pauseCardEl.style.display = '';
    this.pauseCountdown.style.display = 'none';
  }
  hidePauseOverlay(): void {
    this.pauseOverlay.classList.remove('visible');
    this.pauseCardEl.style.display = '';
    this.pauseCountdown.style.display = 'none';
  }
  showPauseCountdown(n: number): void {
    this.pauseCardEl.style.display = 'none';
    this.pauseCountdown.textContent = String(n);
    this.pauseCountdown.style.display = 'block';
    this.pauseOverlay.classList.add('visible');
  }
  hidePauseCountdown(): void {
    this.pauseCountdown.style.display = 'none';
  }

  setScore(score: number): void {
    this.scoreEl.textContent = String(score);
  }

  showScoreUI(show: boolean): void {
    this.scoreEl.style.display = show ? 'block' : 'none';
  }

  showCoinCounter(show: boolean): void {
    this.coinAmount.parentElement!.style.display = show ? 'flex' : 'none';
  }

  showStartScreen(show: boolean): void {
    this.startScreen.style.display = show ? 'flex' : 'none';
    if (show) {
      this.positionPlayButton();
      this.startTapAnimation();
      this.startBestCallout();
    } else {
      this.stopBubble();
      this.stopTapAnimation();
      this.stopBestCallout();
      this.closeLockOverlay();
      this.closeUnlockDialog();
    }
  }

  hideShop(): void {
    this.shopOverlay.style.display = 'none';
  }

  clearConfetti(): void {
    this.confettiContainer.innerHTML = '';
  }

  confettiContainerEl(): HTMLElement {
    return this.confettiContainer;
  }

  applyThemeToDOM(): void {
    const theme = this.state.getPlayerData().theme;
    this.setTheme(theme, false);
  }

  getTheme(): ThemeName {
    return this.state.getPlayerData().theme;
  }

  get scoreElement(): HTMLElement {
    return this.scoreEl;
  }

  private asset(name: string): string {
    const base = import.meta.env.BASE_URL || './';
    return `${base}${name}`;
  }

  private onResize(): void {
    this.positionPlayButton();
    if (this.spotlightOpen && this.spotlightTarget) this.positionSpotlightHole(this.spotlightTarget);
  }

  /** Constant flame corner glow (v1 simplified): on once the fire reward fires,
   *  held for the rest of the run, cleared on game over/reset. */
  setStreakGlow(level: 'off' | 'fire'): void {
    if (level === 'off') {
      // Let any live fire fade out (no-op if never lit).
      this.streakGlow?.setFire(false);
      return;
    }
    this.ensureFireOverlay().setFire(true);
  }

  private ensureFireOverlay(): FireOverlay {
    if (!this.streakGlow) this.streakGlow = new FireOverlay();
    return this.streakGlow;
  }

  /** Screen-level fire burst (flash + ember spray) when the 10-streak fires. */
  fireBurst(): void {
    this.lastFireTime = Date.now();
    this.ensureFireOverlay().burst();
  }

  /** FIRE banner on every fresh 10-perfect streak; the shield tagline only on the one-time grant. */
  private showStreakBanner(payload: { milestone: 'fire'; shield: boolean }): void {
    if (payload.milestone !== 'fire') return;
    this.lastFireTime = Date.now();
    const tagline = payload.shield ? 'Shield raised — one free miss' : '10 in a row — on fire!';
    this.showBanner('FIRE!', tagline, 'streak-banner fire', 2.4, true);
  }

  /** Mission completed — white card slides in from the right, FIFO, no text. */
  showMissionToast(): void {
    this.refreshMissionNotify();
    this.missionQueue.push(true);
    this.pumpMissionCards();
  }

  /**
   * Remove every transient FX node and drop queued toasts. Called on run reset
   * AFTER `gsap.globalTimeline.clear()` — cleared tweens never fire their
   * `onComplete` removals, so without this a mid-flight toast/banner would stay
   * frozen on screen.
   */
  clearTransientFx(): void {
    this.missionQueue = [];
    this.missionBusy = false;
    this.stopCountdown();
    const overlay = document.getElementById('ui-overlay');
    if (!overlay) return;
    for (const sel of ['.mission-card', '.world-banner', '.streak-banner', '.world-flash']) {
      overlay.querySelectorAll(sel).forEach((node) => node.remove());
    }
  }

  private pumpMissionCards(): void {
    if (this.missionBusy) return;
    const next = this.missionQueue.shift();
    if (!next) return;
    this.missionBusy = true;
    this.showMissionCard();
    window.setTimeout(() => {
      this.missionBusy = false;
      this.pumpMissionCards();
    }, 2400);
  }

  /** Green tick + "MISSION COMPLETED" card (user spec), slides in from the right, FIFO. */
  private showMissionCard(): void {
    const overlay = document.getElementById('ui-overlay');
    if (!overlay) return;
    overlay.querySelector('.mission-card')?.remove();

    const card = document.createElement('div');
    card.className = 'mission-card';
    card.innerHTML =
      '<svg class="mc-tick" viewBox="0 0 24 24" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="11" fill="#2ecc71"/>' +
      '<path d="M7 12.5l3.2 3.2L17 8.5" stroke="#fff" stroke-width="2.6" fill="none" ' +
      'stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>' +
      '<div class="mc-label">MISSIONS<br/>COMPLETED</div>';
    overlay.appendChild(card);

    const tick = card.querySelector<HTMLElement>('.mc-tick');
    if (tick) {
      gsap.fromTo(
        tick,
        { scale: 0.4, rotation: -18 },
        { scale: 1, rotation: 0, duration: 0.45, delay: 0.3, ease: 'back.out(2.5)' }
      );
    }
    gsap.fromTo(card, { xPercent: 120 }, { xPercent: 0, duration: 0.5, ease: 'power3.out' });
    gsap.to(card, {
      xPercent: 130,
      duration: 0.5,
      delay: 2.2,
      ease: 'power2.in',
      onComplete: () => card.remove()
    });
  }

  /** Generic banner: title + tagline, entrance/exit tweens, optional white flash. */
  private showBanner(title: string, tagline: string, cssClass: string, hold = 2.0, flash = false): void {
    const overlay = document.getElementById('ui-overlay');
    if (!overlay) return;
    gsap.killTweensOf('.' + cssClass);
    overlay.querySelector('.' + cssClass)?.remove();

    const banner = document.createElement('div');
    banner.className = cssClass;
    const titleEl = document.createElement('div');
    titleEl.className = 'world-banner-title';
    titleEl.textContent = title;
    const tagEl = document.createElement('div');
    tagEl.className = 'world-banner-tag';
    tagEl.textContent = tagline;
    banner.append(titleEl, tagEl);
    overlay.appendChild(banner);

    if (flash) {
      const flashEl = document.createElement('div');
      flashEl.className = 'world-flash';
      overlay.appendChild(flashEl);
      gsap.fromTo(
        flashEl,
        { autoAlpha: 0 },
        {
          autoAlpha: 1,
          duration: 0.3,
          yoyo: true,
          repeat: 1,
          onComplete: () => flashEl.remove()
        }
      );
    }

    gsap.fromTo(
      banner,
      { autoAlpha: 0, scale: 0.8, y: 14 },
      { autoAlpha: 1, scale: 1, y: 0, duration: 0.45, ease: 'back.out(1.6)', delay: 0.15 }
    );
    gsap.to(banner, {
      autoAlpha: 0,
      duration: 0.5,
      delay: hold - 0.4,
      ease: 'power2.in',
      onComplete: () => banner.remove()
    });
  }

  dispose(): void {
    this.canvasResizeObserver?.disconnect();
    this.canvasResizeObserver = null;
  }
}
