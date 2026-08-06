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
  private missionsCallout = this.el<HTMLElement>('missions-callout');
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
  private streakGlow: HTMLElement | null = null;
  private missionQueue: boolean[] = [];
  private missionBusy = false;
  private activeMissionTab: MissionKind = 'general';
  private countdownTimer: number | null = null;
  private bestCalloutTimer: number | null = null;
  private lastUnlockedCount: number | null = null;
  private pendingUnlockWorld: WorldId | null = null;
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

  /** Check circle for claimed rows. Drawn as a border-box circle (rect filled to
   *  the edges + 2px ring) so it superimposes the collapsed claim capsule
   *  exactly: same green fill, same ring, same footprint, no shadow. */
  private static CHECK_SVG =
    '<svg class="m-check-svg" viewBox="0 0 24 24" aria-hidden="true">' +
    '<rect x="2" y="2" width="20" height="20" rx="10" fill="#28a858" stroke="#111" stroke-width="2"/>' +
    '<path d="M7 12.6l3.3 3.3 6.6-7.2" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg>';

  /** Tick only — popped into the collapsed claim capsule (the capsule itself
   *  is already the green circle, so no nested check-circle is needed). */
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
      this.closeUnlockDialog();
      if (this.pendingUnlockWorld) {
        this.selectWorld(this.pendingUnlockWorld);
        this.pendingUnlockWorld = null;
      }
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
    window.addEventListener('resize', () => this.onResize());
  }

  onContinue: () => void = () => {};
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
    this.refreshMissionsCallout();
    this.maybeShowShieldCard();
  }

  /** One-time "missions unlocked!" callout left of the missions button. Shown
   *  while missions are unlocked but haven't been checked out yet; the play
   *  button is dimmed and the next run stays blocked until the missions
   *  overlay is opened once. */
  private refreshMissionsCallout(): void {
    const pending = this.state.hasPendingMissionsUnlock();
    this.missionsCallout.hidden = !pending;
    this.startScreen.classList.toggle('missions-callout-pending', pending);
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
      this.worldNext.innerHTML = '<span class="nav-chevron">&#9654;</span>';
      this.setNavLabel(this.worldNext, this.navLabelFor(next));
      this.worldNext.title = unlocked
        ? `Go to ${next.name}`
        : `${next.name} unlocks at ${next.unlockScore.toLocaleString()} total score`;
      // Bubble only when an UNLOCKED world faces its locked +1 (not during
      // locked previews, not for +2 "coming soon" worlds). The locked world's
      // id picks its themed taunt pool.
      if (unlocked || !this.state.canSelectWorld(world)) {
        this.stopBubble();
      } else {
        this.scheduleBubble(next.id);
      }
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

  /** Thought bubble teases the locked next world (curiosity, not rage-bait).
   *  Each locked world has its own themed taunts; the general set is shared so
   *  some messages overlap between worlds. The pool is picked from the LOCKED
   *  NEXT world (e.g. teasing dusk while on sunrise → dusk-themed + general). */
  private static readonly BUBBLE_GENERAL = [
    'what lies beyond?',
    'don\u2019t you wonder what\u2019s out there?',
    'another world is waiting\u2026',
    'see what the fog hides\u2026',
    'curious yet?'
  ];
  private static readonly BUBBLE_THEMED: Record<string, string[]> = {
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

  private scheduleBubble(worldId?: string): void {
    this.stopBubble();
    this.bubbleTimer = window.setTimeout(() => {
      this.bubbleTimer = null;
      this.showBubble(undefined, 5000, true, worldId);
    }, 9000 + Math.random() * 6000);
  }

  private showBubble(
    text?: string,
    duration = 5000,
    reschedule = true,
    worldId?: string
  ): void {
    // Drop any pending hide/schedule timer so a stale timeout can't fire early
    // and cut this bubble's display short (overlapping cycles would show
    // bubbles back-to-back instead of one at a time).
    if (this.bubbleTimer !== null) {
      window.clearTimeout(this.bubbleTimer);
      this.bubbleTimer = null;
    }
    const themed = worldId ? UIManager.BUBBLE_THEMED[worldId] : undefined;
    const pool = themed
      ? [...UIManager.BUBBLE_GENERAL, ...themed]
      : [...UIManager.BUBBLE_GENERAL, ...Object.values(UIManager.BUBBLE_THEMED).flat()];
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
        if (reschedule) this.scheduleBubble();
      });
    }, duration);
  }

  /** One-shot "check this out!" bubble next to the freshly unlocked world arrow. */
  private showUnlockCallout(): void {
    this.stopBubble();
    this.showBubble('check this out!', 5000, false);
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
   *  in index.html) so the overlay can be repositioned without touching JS. */
  private positionPlayButton(): void {
    const canvas = this.renderer.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    const cam = this.renderer.camera;
    cam.updateMatrixWorld(true);
    cam.updateProjectionMatrix();
    const vec = new Vector3(
      0,
      GAME_CONFIG.PLATFORM_HEIGHT / 2 + GAME_CONFIG.BALL_RADIUS,
      0
    );
    vec.project(cam);
    const x = (vec.x * 0.5 + 0.5) * rect.width;
    const y = (-vec.y * 0.5 + 0.5) * rect.height;
    const rs = getComputedStyle(document.documentElement);
    const ox = parseFloat(rs.getPropertyValue('--tap-offset-x')) || 0;
    const oy = parseFloat(rs.getPropertyValue('--tap-offset-y')) || 0;
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

  private checkWorldUnlocks(): void {
    const count = WORLDS.filter((w) => this.state.canSelectWorld(w)).length;
    if (this.lastUnlockedCount !== null && count > this.lastUnlockedCount) {
      const unlockedWorld = WORLDS[count - 1];
      if (unlockedWorld) {
        this.showUnlockDialog(unlockedWorld);
        this.scheduleUnlockCallout(unlockedWorld.id);
      }
    }
    this.lastUnlockedCount = count;
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
    // First visit after missions unlock: clear the one-time callout gate that
    // blocked the next run (persisted so a reload doesn't re-block).
    if (this.state.hasPendingMissionsUnlock()) {
      this.state.getMutablePlayerData().missionsUnlockSeen = true;
      this.onDataChanged();
      this.refreshMissionsCallout();
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
    }).filter((r) => r.kind === this.activeMissionTab);

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
          check.innerHTML = UIManager.CHECK_SVG;
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
  }

  /** Constant flame corner glow (v1 simplified): on once the fire reward fires,
   *  held for the rest of the run, cleared on game over/reset. */
  setStreakGlow(level: 'off' | 'fire'): void {
    const el = this.ensureStreakGlow();
    gsap.killTweensOf(el);
    el.classList.toggle('fire', level === 'fire');
    if (level === 'off') {
      gsap.to(el, { opacity: 0, duration: 0.45, ease: 'power2.out' });
      return;
    }
    gsap.to(el, { opacity: 1, duration: 0.5, ease: 'power2.out' });
  }

  private ensureStreakGlow(): HTMLElement {
    if (this.streakGlow) return this.streakGlow;
    const el = document.createElement('div');
    el.className = 'streak-corners';
    el.innerHTML =
      '<span class="c c-tl"></span><span class="c c-tr"></span>' +
      '<span class="c c-bl"></span><span class="c c-br"></span>';
    document.getElementById('ui-overlay')?.appendChild(el);
    this.streakGlow = el;
    return el;
  }

  /** FIRE banner on every fresh 10-perfect streak; the shield tagline only on the one-time grant. */
  private showStreakBanner(payload: { milestone: 'fire'; shield: boolean }): void {
    if (payload.milestone !== 'fire') return;
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
