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
  private missionsOverlay = this.el<HTMLElement>('missions-overlay');
  private missionsClose = this.el<HTMLElement>('missions-close');
  private missionsList = this.el<HTMLElement>('missions-list');
  private missionsScroll = this.el<HTMLElement>('missions-scroll');
  private missionsCountdown = this.el<HTMLElement>('missions-countdown');
  private missionsTabs = Array.from(document.querySelectorAll<HTMLButtonElement>('.missions-tab'));
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
  private goMissions = this.el<HTMLElement>('go-missions');
  private goMissionsList = this.el<HTMLElement>('go-missions-list');
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
  private streakGlow: HTMLElement | null = null;
  private missionQueue: boolean[] = [];
  private missionBusy = false;
  private activeMissionTab: MissionKind = 'general';
  private countdownTimer: number | null = null;
  /** Done missions already celebrated with per-card confetti (one-time per session). */
  private celebratedIds = new Set<string>();
  private celebratedSeeded = false;
  private bestCalloutTimer: number | null = null;
  private lastUnlockedCount: number | null = null;
  private pendingUnlockWorld: WorldId | null = null;
  private tapTimeline: gsap.core.Timeline | null = null;
  private canvasResizeObserver: ResizeObserver | null = null;

  private static CHECK_SVG =
    '<svg class="m-check-svg" viewBox="0 0 24 24" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="10.5" fill="#ffd700" stroke="#b8860b" stroke-width="1.4"/>' +
    '<path d="M7 12.6l3.3 3.3 6.6-7.2" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>' +
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
    window.addEventListener('resize', () => this.onResize());
  }

  onContinue: () => void = () => {};
  onSkinApplied: () => void = () => {};
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

  /** Mirror `as()`: coin counter + shop footer. */
  refreshCoins(): void {
    const total = this.state.getPlayerData().totalCoins;
    this.coinAmount.textContent = String(total);
    this.shopCoinDisplay.textContent = String(total);
  }

  /** Render the compact progression block on the start screen (Iteration 7). */
  renderStartScreen(): void {
    this.startScreen.classList.toggle('locked', this.state.isPreviewLocked());
    this.renderWorldTitle();
    this.renderWorldNav();
    this.refreshBestScore();
    this.checkWorldUnlocks();
  }

  /** Navigate to an adjacent world via the start-screen arrows. */
  private moveWorld(dir: 1 | -1): void {
    const target = dir > 0 ? getNextWorld(this.state.getActiveWorld()) : getPreviousWorld(this.state.getActiveWorld());
    if (!target) return;
    this.selectWorld(target.id);
  }

  /** Select a world (arrow or chip click); a locked world loads as a non-playable preview. */
  private selectWorld(id: WorldId): void {
    if (this.state.selectWorld(id)) {
      this.state.clearPreview();
      this.onWorldSelect(id);
      this.closeLockOverlay();
      this.renderStartScreen();
      return;
    }
    const world = getWorldById(id);
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

  /** Edge nav: back arrow (left) · next arrow/lock (right), both centered on their edge. */
  private renderWorldNav(): void {
    const world = this.state.getActiveWorld();
    const prev = getPreviousWorld(world);
    const next = getNextWorld(world);

    this.worldPrev.classList.toggle('hidden', !prev);
    if (prev) {
      this.setNavLabel(this.worldPrev, `World ${WORLDS.indexOf(prev) + 1}`);
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
      this.setNavLabel(this.worldNext, `World ${WORLDS.indexOf(next) + 1}`);
      this.worldNext.title = unlocked
        ? `Go to ${next.name}`
        : `${next.name} unlocks at ${next.unlockScore.toLocaleString()} total score`;
      // Bubble only when an UNLOCKED world faces its locked +1 (not during
      // locked previews, not for +2 "coming soon" worlds).
      if (unlocked || !this.state.canSelectWorld(world)) {
        this.stopBubble();
      } else {
        this.scheduleBubble();
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

  private setNavLabel(arrow: HTMLElement, text: string): void {
    let label = arrow.querySelector<HTMLElement>('.nav-label');
    if (!label) {
      label = document.createElement('span');
      label.className = 'nav-label';
      arrow.appendChild(label);
    }
    label.textContent = text;
  }

  /** Thought bubble teases the locked next world (curiosity, not rage-bait). */
  private static readonly BUBBLE_TAUNTS = [
    'what lies beyond?',
    'don\u2019t you wonder what\u2019s out there?',
    'the dark is calling\u2026',
    'another world is waiting\u2026',
    'see what the fog hides\u2026',
    'somewhere the sun is setting\u2026',
    'curious yet?',
    'the neon hums your name\u2026'
  ];
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

  private scheduleBubble(): void {
    this.stopBubble();
    this.bubbleTimer = window.setTimeout(() => {
      this.bubbleTimer = null;
      this.showBubble();
    }, 7000 + Math.random() * 6000);
  }

  private showBubble(): void {
    const taunt = UIManager.BUBBLE_TAUNTS[Math.floor(Math.random() * UIManager.BUBBLE_TAUNTS.length)];
    this.worldBubble.textContent = taunt;
    gsap.killTweensOf(this.worldBubble);
    gsap.set(this.worldBubble, { opacity: 0, scale: 0.5 });
    this.worldBubble.style.display = 'block';
    gsap.to(this.worldBubble, { opacity: 1, scale: 1, duration: 0.35, ease: 'back.out(2.5)' });
    this.bubbleTimer = window.setTimeout(() => {
      this.bubbleTimer = null;
      this.hideBubble();
      this.scheduleBubble();
    }, 3000);
  }

  private hideBubble(): void {
    if (this.worldBubble.style.display === 'none') return;
    gsap.killTweensOf(this.worldBubble);
    gsap.to(this.worldBubble, {
      opacity: 0,
      scale: 0.5,
      duration: 0.25,
      onComplete: () => {
        this.worldBubble.style.display = 'none';
      }
    });
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
      if (unlockedWorld) this.showUnlockDialog(unlockedWorld);
    }
    this.lastUnlockedCount = count;
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

  /** Open the missions tab: render the active tab, animate bars, confetti on done. */
  openMissions(): void {
    this.renderMissionsOverlay();
    this.missionsOverlay.style.display = 'flex';
    if (this.missionsCountdown.style.display === 'flex') this.startCountdown();
  }

  closeMissions(): void {
    this.missionsOverlay.style.display = 'none';
    this.stopCountdown();
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

  private renderMissionsOverlay(): void {
    const data = this.state.getPlayerData();
    const run = this.state.getState();
    let rows = getMissionProgressList(data, {
      score: run.score,
      runPerfects: run.runPerfects,
      runGems: run.runGems,
      maxStreak: run.maxStreak,
      selectedWorld: this.state.getActiveWorld().id
    }).filter((r) => r.kind === this.activeMissionTab);

    // "Come back tomorrow" countdown only makes sense once today's set is cleared.
    const allDailyDone =
      this.activeMissionTab === 'general' &&
      rows.length > 0 &&
      rows.every((r) => r.done);
    this.missionsCountdown.style.display = allDailyDone ? 'flex' : 'none';

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

    this.seedCelebrated();
    const celebrate: string[] = [];
    for (const m of rows) {
      if (!m.done || this.celebratedIds.has(m.id)) continue;
      this.celebratedIds.add(m.id);
      celebrate.push(m.id);
    }

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
        const check = document.createElement('span');
        check.className = 'm-check';
        check.innerHTML = UIManager.CHECK_SVG;
        row.appendChild(check);
      }

      this.missionsList.appendChild(row);
    }

    this.animateMissionBars(() => {
      for (const id of celebrate) {
        const row = this.missionsList.querySelector<HTMLElement>(`.mission-row[data-id="${id}"]`);
        if (row) this.burstConfetti(row, 14);
      }
    });
  }

  /** Done missions known since session start are already celebrated (no re-fire). */
  private seedCelebrated(): void {
    if (this.celebratedSeeded) return;
    this.celebratedSeeded = true;
    for (const id of this.state.getPlayerData().completedMissions) this.celebratedIds.add(id);
  }

  /** Staggered bar fill on tab open: 0% → real progress (GSAP).
   *  Completed rows stay full and static — no re-animation. */
  private animateMissionBars(onDone: () => void): void {
    const fills = Array.from(this.missionsList.querySelectorAll<HTMLElement>('.m-bar-fill'));
    let lastDelay = 0;
    fills.forEach((fill, i) => {
      const target = fill.dataset.width ?? '0';
      const row = fill.closest('.mission-row');
      if (row && row.classList.contains('done')) {
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
    window.setTimeout(onDone, lastDelay * 1000 + 700);
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
    this.goBestVal.textContent = String(data.bestScore);
    this.goNewBest.style.display = isNewBest ? 'block' : 'none';
    this.goRoundCoins.textContent = `+${roundCoins}`;

    this.goWorld.textContent = this.state.getActiveWorld().name.toUpperCase();

    const rewards = this.state.getRunMissionRewards();
    const missionCoins = rewards.reduce((sum, r) => sum + r.reward, 0);
    this.goMissionsList.innerHTML = '';
    if (rewards.length > 0) {
      for (const r of rewards) {
        const item = document.createElement('div');
        item.className = 'go-mission-row';
        const name = document.createElement('span');
        name.className = 'm-name';
        name.textContent = r.title;
        const coin = document.createElement('span');
        coin.className = 'm-coin';
        coin.textContent = `+${r.reward} coins`;
        item.append(name, coin);
        this.goMissionsList.appendChild(item);
      }
      const label = this.el<HTMLElement>('go-missions-label');
      label.textContent = `MISSIONS COMPLETED \u00B7 +${missionCoins} COINS`;
      this.goMissions.style.display = 'flex';
    } else {
      this.goMissions.style.display = 'none';
    }

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
