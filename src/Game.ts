import { gsap } from 'gsap';
import { Mesh } from 'three';
import type { Object3D } from 'three';
import { GAME_CONFIG } from './config/GameConfig';
import type { ThemeName } from './config/Themes';
import type { WorldConfig, WorldId } from './config/Worlds';
import { GameStateManager } from './core/GameStateManager';
import { EventBus, GAME_EVENTS } from './core/EventBus';
import { RendererSystem } from './systems/RendererSystem';
import { CameraController } from './systems/CameraController';
import { ShadowSystem } from './systems/ShadowSystem';
import { MaterialFactory } from './systems/MaterialFactory';
import { BackgroundSystem } from './systems/BackgroundSystem';
import { EffectsSystem } from './systems/EffectsSystem';
import { AudioSystem } from './systems/AudioSystem';
import { InputSystem } from './systems/InputSystem';
import { BallEntity } from './entities/BallEntity';
import { PlatformEntity, type CoinObject, type PlatformData } from './entities/PlatformEntity';
import { PlatformManager } from './managers/PlatformManager';
import { PersistenceManager, LocalStorageBackend } from './managers/PersistenceManager';
import { UIManager } from './ui/UIManager';

/** Optional construction knobs (dev mode uses the isolated save key). */
export interface GameOptions {
  /** localStorage key for the save. Dev mode passes `hop_dev_player_data`. */
  persistenceKey?: string;
}

/**
 * Game coordinator: wires systems together, owns the main loop and game flow.
 * Faithful port of the original `Qd` / `By` / `Gy` / `Vy` / `ip`.
 */
export class Game {
  private state: GameStateManager;
  private persistence: PersistenceManager;
  private renderer: RendererSystem;
  private camera: CameraController;
  private shadow: ShadowSystem;
  private background: BackgroundSystem;
  private effects: EffectsSystem;
  private audio: AudioSystem;
  private input!: InputSystem;
  private ball: BallEntity;
  private platforms: PlatformManager;
  private ui!: UIManager;
  private events = new EventBus();

  private gameContainer: HTMLElement;

  // ---- start-screen attract demo (continuous forward auto-play) ----
  private demoActive = false;
  private demoTween: { t: number } = { t: 0 };
  private demoStep = 0;

  // ---- first-run guided play (5 teaching hops + 5-hop speed ramp) ----
  private guidedFirst = false;
  /** Guided hops completed (0 = waiting for the first tap). */
  private guidedStep = 0;
  /** Number of teaching hops (lessons) before the guides fade + ramp begins. */
  private readonly GUIDE_LESSONS = 5;
  /** Guided step the drag-arrow direction was last locked for (-1 = none). */
  private guideDragDirectionStep = -1;

  // ---- one-action Play (normal runs): automatic first jump after anticipation ----
  /** True while the automatic first jump is armed (normal runs only). */
  private firstJumpArmed = false;
  /** Seconds elapsed since the automatic first jump was armed. */
  private firstJumpWait = 0;
  /** Wind-up squash tween during the anticipation beat (killed on first jump). */
  private anticipationTween: gsap.core.Animation | null = null;
  private isPaused = false;
  private pauseCountdownTimer: number | null = null;

  constructor(container: HTMLElement, options: GameOptions = {}) {
    this.gameContainer = container;
    this.state = new GameStateManager();
    this.state.setUnlockAllWorlds(GAME_CONFIG.DEBUG.unlockAllWorlds);
    this.state.setWorldOverride(GAME_CONFIG.DEBUG.forceWorld);
    this.persistence = options.persistenceKey
      ? new PersistenceManager(new LocalStorageBackend(options.persistenceKey))
      : new PersistenceManager();
    MaterialFactory.init();

    this.renderer = new RendererSystem(container);
    this.camera = new CameraController(this.renderer.camera);
    this.shadow = new ShadowSystem(this.renderer.scene);
    this.ball = new BallEntity(this.renderer.scene);
    this.background = new BackgroundSystem(this.renderer.scene, () => this.getTheme());
    this.background.init();
    this.buildUI();
    this.platforms = new PlatformManager(this.renderer.scene, this.state);
    this.platforms.initializePlatforms();
    this.effects = new EffectsSystem(this.renderer.scene, this.ui.confettiContainerEl());
    this.audio = new AudioSystem();
    this.audio.setSoundVolume(this.state.getPlayerData().soundVolume);

    this.buildInput();
    this.wirePersistence();
    this.wireVisibility();

    this.renderer.setUpdateCallback((delta) => this.gameLoop(delta));
    this.renderer.start();
  }

  private getTheme(): ThemeName {
    return this.state.getPlayerData().theme;
  }

  private buildUI(): void {
    this.ui = new UIManager(
      this.state,
      this.events,
      this.renderer,
      this.shadow,
      this.background,
      this.ball
    );

    this.ui.onSkinApplied = () => {
      this.applySkin(this.state.getPlayerData().selectedSkin);
    };
    this.ui.onMissionClaim = () => {
      this.audio.playCoin();
    };
    this.ui.onDataChanged = () => {
      void this.persistence.save(this.state.getMutablePlayerData());
    };
    this.ui.onPersistSettings = () => this.persistence.save(this.state.getMutablePlayerData());
    this.ui.onSoundVolumeChange = (volume) => this.audio.setSoundVolume(volume);
    this.ui.onMusicVolumeChange = () => {
      // Music channel reserved for a future track — slider persists, plays nothing.
    };
    // PLAY AGAIN re-runs the same world in place (Workstream B); Home returns
    // to the start screen. Both finalize the previous run (already done by
    // gameOver) and only differ in where the next run begins.
    this.ui.onContinue = () => {
      this.retryRun();
    };
    this.ui.onHome = () => {
      this.returnHome();
    };
    this.ui.onPause = () => this.pauseGame();
    this.ui.onResume = () => this.resumeWithCountdown();
    this.ui.onPauseHome = () => {
      this.isPaused = false;
      document.body.classList.remove('game-paused');
      gsap.globalTimeline.resume();
      this.ui.hidePauseOverlay();
      if (this.pauseCountdownTimer !== null) {
        window.clearTimeout(this.pauseCountdownTimer);
        this.pauseCountdownTimer = null;
      }
      this.returnHome();
    };
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.autoPause();
    });
    window.addEventListener('blur', () => this.autoPause());
    this.ui.onThemeChanged = () => {
      void this.persistence.save(this.state.getMutablePlayerData());
    };
    // World selection only happens on the start screen: re-seed the runway so
    // the first run uses the new world's ramps from platform #1.
    this.ui.onWorldSelect = () => {
      void this.persistence.save(this.state.getMutablePlayerData());
      this.platforms.reset();
      // The attract demo runs forever; a world switch re-seeds the runway, so
      // restart the demo from tile 0 in the new world instead of hopping on
      // stale coordinates.
      if (this.demoActive) {
        this.stopAttractDemo();
        this.resetEntities();
        this.startAttractDemo();
      }
    };
  }

  private buildInput(): void {
    const uiEl = document.getElementById('ui-overlay')!;
    const startScreen = document.getElementById('start-screen')!;
    const gameOverScreen = document.getElementById('gameover-screen')!;
    const shopOverlay = document.getElementById('shop-overlay')!;
    const shopBtn = document.getElementById('shop-btn')!;
    const missionsOverlay = document.getElementById('missions-overlay')!;
    const missionsBtn = document.getElementById('missions-btn')!;
    const playBtn = document.getElementById('play-btn')!;

    this.input = new InputSystem(
      this.renderer.renderer.domElement,
      uiEl,
      startScreen,
      gameOverScreen,
      shopOverlay,
      shopBtn,
      missionsOverlay,
      missionsBtn,
      playBtn,
      this.state
    );
    this.input.onGameStart = () => this.startGame();
    this.input.onFirstJump = () => this.firstJump();
  }

  private async wirePersistence(): Promise<void> {
    try {
      const data = await this.persistence.load();
      const base = this.state.getMutablePlayerData();
      const merged = this.persistence.merge(base, data);
      this.state.loadPlayerData(merged);

      // Apply the persisted audio settings AFTER the async save loads — the
      // constructor only sees the defaults (soundVolume/musicVolume = 100), so
      // without this a reload would snap both channels back to full volume
      // until the sliders are touched again.
      this.audio.setSoundVolume(this.state.getPlayerData().soundVolume);
      this.audio.setMusicVolume(this.state.getPlayerData().musicVolume);

      this.applySkin(this.state.getPlayerData().selectedSkin);
      this.ui.applyThemeToDOM();
      this.ui.refreshCoins();
      this.ui.renderStartScreen();
    } catch (err) {
      // A corrupt/unreadable save must never take the boot down: fall back to
      // the defaults and keep going (the player's data is re-sanitized on the
      // next save anyway).
      console.error('HOP: persistence load failed — running with defaults.', err);
    } finally {
      // Activate the start screen (positioned, pulsing play button) no matter
      // what happened above, so a first-time player always sees where to tap —
      // it normally only activates on reset, which never runs at boot.
      this.ui.showStartScreen(true);
    }
  }

  private wireVisibility(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        document.body.classList.add('game-paused');
        this.audio.suspend();
      } else {
        document.body.classList.remove('game-paused');
        this.audio.resume();
      }
    });
    window.addEventListener('pointerdown', () => this.audio.resume());
  }

  // ---- flow ----

  /**
   * Restore the ball, platforms, camera and background to a clean pre-run
   * state. The attract demo may have moved the ball anywhere on the runway, so
   * a run must always start over from the start tile (currentStep stays 0 —
   * only the entities are repositioned).
   */
  private resetEntities(): void {
    PlatformEntity.randomizePaletteStart();
    this.ball.reset();
    this.ball.setShield(false);
    // While the first-run tutorial is live, the runway is generated with the
    // forced lesson layout (side lanes for drag-left/right, a guaranteed coin);
    // otherwise it's the normal random runway.
    this.platforms.setGuidedLayout(this.guidedFirst ? this.guidedLessonLayout() : null);
    this.platforms.reset();
    this.effects.clearFailureFlags();
    this.camera.reset();
    this.background.reset();
    const st = this.state.getMutableState();
    st.currentStep = 0;
    st.ballX = 0;
    st.xTarget = 0;
  }

  /** The forced first-run lesson layout (see PlatformManager.setGuidedLayout). */
  private guidedLessonLayout(): (index: number) => { x?: number; coins?: boolean } | null {
    return (index) => {
      // Drag-left lesson: tile 2 sits screen-left of the ball (world +x).
      if (index === 2) return { x: GAME_CONFIG.GUIDED_LESSON_LANE };
      // Drag-right lesson: tile 3 sits screen-right of the ball (world -x).
      if (index === 3) return { x: -GAME_CONFIG.GUIDED_LESSON_LANE };
      // Coin lesson: tile 5 always carries a coin.
      if (index === 5) return { coins: true };
      return null;
    };
  }

  /** Original `Gy()`: first tap on menu starts the run. */
  private startGame(): void {
    if (!this.state.canSelectWorld(this.state.getActiveWorld())) return;
    // The missions-unlocked callout is a one-time gate: the player must click
    // the missions button before the next run is allowed.
    if (this.state.hasPendingMissionsUnlock()) return;
    // First-run tutorial: 5 teaching hops (lessons) + a 5-hop speed ramp.
    this.guidedFirst = false;
    this.guidedStep = 0;
    this.guideDragDirectionStep = -1;
    if (!this.state.getPlayerData().tutorialDone) {
      this.guidedFirst = true;
    }
    this.beginRun();
  }

  /** Shared run-preparation: stop the demo, reset the entities, start the state
   *  machine, show the run UI, and begin the one-action first-jump preparation
   *  (normal runs) or the guided tutorial's tap-to-start. */
  private beginRun(): void {
    this.stopAttractDemo();
    // The demo may have left the ball mid-runway — start every run clean
    // (resetEntities applies the guided lesson layout via guidedFirst).
    this.resetEntities();
    this.audio.resume();
    this.state.startGame();
    this.ui.showStartScreen(false);
    this.ui.hideShop();
    this.ui.hideGameOver();
    this.ui.showScoreUI(true);
    this.ui.showCoinCounter(true);
    this.ui.showPauseButton();
    if (this.guidedFirst) {
      this.ui.showFirstRunGuide(true);
      this.ui.setGuideStep(0);
      this.updateFirstRunGuide();
    } else {
      // One-action Play: the first jump fires automatically after a short
      // anticipation beat (the tutorial keeps its explicit tap-to-start — the
      // guide owns the teaching there). A tap inside the window cancels it and
      // jumps immediately (see firstJump), so the jump never fires twice.
      this.armFirstJump();
    }
  }

  /** Arm the automatic first jump for a normal run: a wind-up squash sells the
   *  "ready… go!" beat while the ball waits out FIRST_JUMP_ANTICIPATION. */
  private armFirstJump(): void {
    this.firstJumpArmed = true;
    this.firstJumpWait = 0;
    this.anticipationTween = gsap.fromTo(
      this.ball.group.scale,
      { y: 0.82, x: 1.1, z: 1.1 },
      { y: 1, x: 1, z: 1, duration: 0.35, ease: 'power2.out' }
    );
  }

  /** Disarm the automatic first jump (tap-cancel or run reset). */
  private cancelFirstJumpAnticipation(): void {
    this.firstJumpArmed = false;
    this.firstJumpWait = 0;
    if (this.anticipationTween) {
      this.anticipationTween.kill();
      this.anticipationTween = null;
      this.ball.group.scale.set(1, 1, 1);
    }
  }

  /** Original first-tap handler: begins the auto-chain. Also the auto-fire
   *  target for one-action Play (normal runs) once the anticipation elapses. */
  private firstJump(): void {
    // A tap during the anticipation window cancels the pending auto-jump so it
    // can never fire twice (the tap IS the first jump).
    this.cancelFirstJumpAnticipation();
    this.state.fireFirstJump();
    const st = this.state.getMutableState();
    // The guided-tutorial retry parks the chain behind isJumping for a beat;
    // the player's first tap must ALWAYS be able to start it (a tap inside the
    // park window would otherwise be consumed, leave the chain dead and the
    // ball unlocked — the next drag then slides it off its platform to hover).
    st.isJumping = false;
    this.jump();
  }

  /** Same-world Play Again (Workstream B): start the selected world again from
   *  the game-over screen. The previous run was already finalized by gameOver()
   *  (score banked, run tracked, save persisted) — this only resets run-only
   *  state, preserves player data + selected world, re-seeds the runway, and
   *  begins through the same one-action preparation path. Start-screen gates
   *  (missions unlock, world selection) are skipped: the player is already in
   *  the world they just played. */
  private retryRun(): void {
    this.input.beginResetCooldown();
    gsap.killTweensOf(this.ball.group.position);
    gsap.killTweensOf(this.ball.group.scale);
    gsap.globalTimeline.clear();
    this.ui.clearTransientFx();
    this.resetRunState();
    this.guidedFirst = false;
    this.guidedStep = 0;
    this.guideDragDirectionStep = -1;
    this.beginRun();
  }

  /** Original `Vy()`: reset everything and return to the start screen (Home). */
  private returnHome(): void {
    this.input.beginResetCooldown();
    gsap.killTweensOf(this.ball.group.position);
    gsap.killTweensOf(this.ball.group.scale);
    gsap.globalTimeline.clear();
    this.ui.clearTransientFx();
    this.resetRunState();
    this.guidedFirst = false;
    this.guidedStep = 0;
    this.guideDragDirectionStep = -1;
    // Restore camera/entities BEFORE the start screen positions the play button,
    // so its projection uses the boot camera (not the end-of-run one).
    this.resetEntities();
    this.effects.clearParticles();
    this.effects.clearSpeedLines();
    this.ui.renderStartScreen();
    this.ui.setScore(0);
    this.ui.showScoreUI(false);
    this.ui.showCoinCounter(false);
    this.ui.showStartScreen(true);
    this.startAttractDemo();
    this.effects.clearParticles();
    this.effects.clearSpeedLines();
    const st = this.state.getMutableState();
    st.isWaitingForTap = true;
  }

  /** Reset run-only state (score, streak, round coins, shield, run missions).
   *  Player data and the selected world are preserved. */
  private resetRunState(): void {
    const st = this.state.getMutableState();
    st.score = 0;
    st.currentStep = 0;
    st.isStarted = false;
    st.isJumping = false;
    st.isFailed = false;
    st.xTarget = 0;
    st.ballX = 0;
    st.roundCoins = 0;
    st.isWaitingForTap = false;
    st.perfectStreak = 0;
    st.shieldActive = false;
    st.shieldAwarded = false;
    st.runPerfects = 0;
    st.runCoins = 0;
    st.maxStreak = 0;
    this.state.clearRunMissions();
    this.ui.hideGameOver();
    this.ui.clearConfetti();
    this.ui.setStreakGlow('off');
    this.ui.showFirstRunGuide(false);
    this.cancelFirstJumpAnticipation();
    this.ui.hidePauseButton();
    if (this.isPaused) {
      this.isPaused = false;
      document.body.classList.remove('game-paused');
      this.ui.hidePauseOverlay();
      if (this.pauseCountdownTimer !== null) {
        window.clearTimeout(this.pauseCountdownTimer);
        this.pauseCountdownTimer = null;
      }
    }
  }

  private pauseGame(): void {
    const st = this.state.getState();
    if (!st.isStarted || st.isFailed || this.isPaused) return;
    this.isPaused = true;
    document.body.classList.add('game-paused');
    gsap.globalTimeline.pause();
    this.ui.hidePauseButton();
    this.ui.showPauseOverlay();
  }

  private autoPause(): void {
    const st = this.state.getState();
    if (!st.isStarted || st.isFailed || this.isPaused) return;
    this.pauseGame();
  }

  private resumeWithCountdown(): void {
    if (!this.isPaused) return;
    if (this.pauseCountdownTimer !== null) {
      window.clearTimeout(this.pauseCountdownTimer);
      this.pauseCountdownTimer = null;
    }
    let count = 3;
    const tick = () => {
      if (count > 0) {
        this.ui.showPauseCountdown(count);
        gsap.fromTo(this.ui.pauseCountdown, { scale: 0.5, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.25, ease: 'back.out(1.7)' });
        count--;
        this.pauseCountdownTimer = window.setTimeout(tick, 700);
      } else {
        this.ui.hidePauseOverlay();
        this.isPaused = false;
        document.body.classList.remove('game-paused');
        gsap.globalTimeline.resume();
        this.ui.showPauseButton();
        if (this.pauseCountdownTimer !== null) {
          window.clearTimeout(this.pauseCountdownTimer);
          this.pauseCountdownTimer = null;
        }
      }
    };
    tick();
  }

  /** Original `By()`: fail sequence. */
  private gameOver(): void {
    const st = this.state.getMutableState();
    st.isFailed = true;
    this.ui.hidePauseButton();
    if (this.isPaused) {
      this.isPaused = false;
      document.body.classList.remove('game-paused');
      this.ui.hidePauseOverlay();
      if (this.pauseCountdownTimer !== null) {
        window.clearTimeout(this.pauseCountdownTimer);
        this.pauseCountdownTimer = null;
      }
    }
    this.ui.showFirstRunGuide(false);
    this.audio.playGameOver();
    this.effects.clearSpeedLines();
    this.ui.setStreakGlow('off');
    this.ball.setShield(false);

    this.camera.shake();
    // Ball falls 10 units below the platform; the flag's dropDelay is matched
    // to this so the flag only starts falling once the ball has sunk away —
    // no overlapping motions, no mid-air "jump".
    const ballFall = GAME_CONFIG.FAIL_FLAG.ballFallDistance;
    const ballFallT = GAME_CONFIG.FAIL_FLAG.ballFallDuration;
    gsap.to(this.ball.group.position, { y: this.ball.group.position.y - ballFall, duration: ballFallT, ease: 'power2.in' });
    gsap.to(this.ball.group.scale, { x: 0.5, y: 0.5, z: 0.5, duration: ballFallT });

    // Red failure flag: drop from the sky onto the missed platform. The flag is
    // parented to the platform (rides its sway), takes the active world's color
    // palette, kicks up a crater + mixed debris + dust, and triggers a stronger
    // camera shake on impact.
    if (GAME_CONFIG.FAIL_FLAG.enabled) {
      const failed = this.platforms.getPlatformByIndex(st.currentStep);
      if (failed) {
        this.effects.playFailureFlag(failed, this.state.getActiveWorld().id, () =>
          this.camera.shake(GAME_CONFIG.FAIL_FLAG.impactShake)
        );
      }
    }

    // Global ledger keeps the all-time best for stats; the NEW BEST! badge and
    // the game-over "best" line are per-world, so each run is compared against
    // the best ever made in the world being played.
    this.state.updateBestScore(st.score);
    const isNewBest = this.state.updateBestPerWorld(st.score);
    this.state.bankTotalScore();
    // Missions only count once the feature is unlocked, and the run that
    // crosses the threshold (the 3rd game over) must not bank its own
    // progress — otherwise achievements pop "during" the unlocking run.
    const wasUnlocked = this.state.isMissionsUnlocked();
    this.state.trackRunPlayed();
    if (wasUnlocked) this.checkMissions();
    void this.persistence.save(this.state.getMutablePlayerData());

    setTimeout(() => {
      this.ui.showScoreUI(false);
      this.ui.showCoinCounter(false);
      this.ui.showGameOver(isNewBest);
      if (isNewBest) this.effects.showConfetti();
    }, 600);
  }

  /** Original `Qd()`: perform a jump from currentStep to currentStep+1. */
  private jump(): void {
    const st = this.state.getMutableState();
    if (st.isJumping || st.isFailed) return;
    st.isJumping = true;

    const r = st.currentStep;
    const t = r + 1;
    // First-run tutorial: the 5 teaching hops run at lesson speed (0.4x by
    // default) and the next GUIDED_RAMP_HOPS hops ease up to full speed.
    const duration = this.guidedFirst
      ? this.state.getJumpDuration() * this.guidedHopTimeScale()
      : this.state.getJumpDuration();
    const bounce = GAME_CONFIG.BOUNCE_HEIGHT;
    const current = this.platforms.getPlatformByIndex(r);
    const target = this.platforms.getPlatformByIndex(t);
    const y = GAME_CONFIG.PLATFORM_HEIGHT / 2 + GAME_CONFIG.BALL_RADIUS;
    const startZ = current ? current.z : r * GAME_CONFIG.PLATFORM_SPACING_Z;
    const endZ = target ? target.z : this.platforms.getNextZ();

    this.ball.performJump(
      { startZ, endZ, startY: y, endY: y, bounceHeight: bounce, duration },
      () => {
        st.currentStep = t;
        st.isJumping = false;
        try {
          this.effects.spawnJumpDust(this.ball.group.position.x, y, this.ball.group.position.z);

          if (target) {
            BallEntity.squashPlatform(target.group, target.baseScale || 1);
          }

          if (target) {
            const f = target.platformX + (target.swayOffset || 0);
            const d = Math.abs(st.ballX - f);
            if (d > GAME_CONFIG.HIT_THRESHOLD) {
              if (this.state.consumeShield()) {
                this.ball.setShield(false);
                this.audio.playShieldBreak();
                this.effects.playShieldBreak(this.ball.group.position.x, this.ball.group.position.z);
                this.effects.playGlassFloor(this.ball.group.position.x, this.ball.group.position.z);
              } else if (this.guidedFirst && this.guidedStep < this.GUIDE_LESSONS) {
                // Tutorial fallback (teaching hops only): missing respawns the
                // guided run instead of ending it — the player retries in a
                // loop until they get the hang of it. The speed-ramp hops
                // (6-10) are normal play: a miss there is a real game over.
                this.guidedRetry();
                return;
              } else {
                this.gameOver();
                return;
              }
            }
            for (const coin of target.coins) {
              if (!coin.collected && d < GAME_CONFIG.COIN_COLLECT_THRESHOLD) {
                this.collectCoin(target, coin);
              }
            }
          }

          if (!st.isFailed) {
            if (this.guidedFirst) {
              // This landing completed guided hop #guidedStep+1.
              this.guidedStep++;
              if (this.guidedStep === this.GUIDE_LESSONS) {
                // All 5 teaching hops done: mark the tutorial complete and fade
                // the guides. The ramp hops (6-10) then run silently at rising
                // speed — no end screen, no repeat of the lessons.
                this.finishTutorial();
                this.ui.fadeOutFirstRunGuide();
              } else if (this.guidedStep < this.GUIDE_LESSONS) {
                this.ui.setGuideStep(this.guidedStep);
                this.updateFirstRunGuide();
              } else if (this.guidedStep >= GAME_CONFIG.GUIDED_TOTAL_HOPS) {
                // Ramp finished — full handover to normal play + a keep-going callout.
                this.guidedFirst = false;
                this.ui.showKeepHoppingCallout();
              }
            }
            st.score++;
            const h = target ? target.swayOffset || 0 : 0;
            const f = target ? target.platformX + h : 0;
            const isPerfect = Math.abs(st.ballX - f) < GAME_CONFIG.PERFECT_THRESHOLD;
            const inTutorial = !this.state.getPlayerData().tutorialDone || this.guidedFirst;
            if (isPerfect) {
              if (inTutorial) {
                // No streak / no popup during tutorial — prevents spam (every perfect showed x1) and keeps
                // the tutorial focused on movement; streak starts at tile 11. Only play the subtle dot effect.
                this.audio.playPerfect(1);
                this.effects.playPerfectEffect(
                  this.ball.group.position.x,
                  this.ball.group.position.y,
                  this.ball.group.position.z,
                  1,
                  this.ui.scoreElement
                );
                // No showPerfectPopup here — removed to avoid confusing x1 spam; only the dot scales
                this.state.trackPerfectLanding();
              } else {
                st.perfectStreak++;
                st.score += st.perfectStreak;
                this.audio.playPerfect(st.perfectStreak);
                this.perfectHit(target);
                this.state.trackPerfectLanding();
                this.totalStreakReward();
              }
            } else {
              if (!inTutorial) st.perfectStreak = 0;
              this.audio.playJump(st.score);
            }
            this.checkMissions();
            this.ui.setScore(st.score);
            gsap.fromTo(this.ui.scoreElement, { scale: 1.15 }, { scale: 1, duration: 0.2, ease: 'back.out(2)' });
            this.updateStreakGlow();
            this.platforms.recycle();
          }
        } finally {
          // The auto-jump chain MUST survive: a stray exception escaping
          // GSAP's ticker would otherwise silently kill this callback before
          // `jump()` runs — and with isJumping already false the ball would
          // just sit on the platform forever (the reported freeze). Guarding
          // the chain in `finally` keeps it alive while still surfacing the
          // real error to the console.
          if (!st.isFailed) this.jump();
        }
      }
    );
  }

  /** Original `Py(r)` + `Dy(r,t)`: perfect visual + coin collection. */
  private perfectHit(target: PlatformData | undefined): void {
    if (target && target.perfectDot) {
      const mat = target.perfectDot.material as { opacity?: number };
      gsap.to(mat, { opacity: 1, duration: 0.08, yoyo: true, repeat: 1 });
      gsap.to(target.perfectDot.scale, {
        x: 1.8,
        y: 1.8,
        duration: 0.15,
        yoyo: true,
        repeat: 1,
        ease: 'power2.out'
      });
    }
    this.effects.playPerfectEffect(
      this.ball.group.position.x,
      this.ball.group.position.y,
      this.ball.group.position.z,
      this.state.getState().perfectStreak,
      this.ui.scoreElement
    );
    // Perfect xN pop-up — hidden during tutorial (research: tutorial already has
    // keep-hopping + drag hints; perfect + fire would overlap and clutter)
    if (this.state.getPlayerData().tutorialDone && !this.guidedFirst) {
      this.ui.showPerfectPopup(this.state.getState().perfectStreak);
    }
  }

  /** Original `Dy(r,t)`: collect a coin. */
  private collectCoin(platform: PlatformData, coin: CoinObject): void {
    coin.collected = true;
    this.audio.playCoin();
    PlatformEntity.collectCoin(platform, coin);

    const st = this.state.getMutableState();
    st.roundCoins++;
    this.state.trackCoinCollected();
    const data = this.state.getMutablePlayerData();
    data.totalCoins++;
    data.totalCoinsEarned++;
    void this.persistence.save(data);
    this.ui.refreshCoins();

    st.score++;
    this.ui.setScore(st.score);
    this.checkMissions();
  }

  /** Fire reward: the FIRE banner plays every time the run hits a fresh 10-perfect
   *  streak (including rebuilds after a break), but the shield — and its text —
   *  grant once per run. The flame glow is live: it stays only while the streak
   *  holds and drops the moment a non-perfect breaks it. */
  private totalStreakReward(): void {
    // Research decision: hide fire (and perfect pop-ups) during tutorial — the
    // tutorial already shows keep-hopping + drag hints at the same screen area;
    // fire at 10 perfects during the 10-hop tutorial would overlap and confuse.
    if (!this.state.getPlayerData().tutorialDone || this.guidedFirst) return;
    const milestone = this.state.checkStreakMilestone();
    if (milestone !== 'fire') return;
    const shieldGranted = this.state.isShieldUnlocked() ? this.state.grantShield() : false;
    if (shieldGranted) this.ball.setShield(true);
    this.audio.playMilestone();
    this.effects.playFireBurst(this.ball.group.position.x, this.ball.group.position.y, this.ball.group.position.z);
    // Screen-level fire burst (flash + ember spray) + the FIRE banner.
    this.ui.fireBurst();
    this.events.emit(GAME_EVENTS.STREAK_MILESTONE, { milestone, shield: shieldGranted });
  }

  /** Flame glow mirrors the fire streak: ≥10 perfects on, anything else off. */
  private updateStreakGlow(): void {
    this.ui.setStreakGlow(this.state.getState().perfectStreak >= GAME_CONFIG.STREAK_FIRE ? 'fire' : 'off');
  }

  /** Evaluate missions; toast any that just completed and persist the one-time marks. */
  private checkMissions(): void {
    if (!this.state.isMissionsUnlocked()) return;
    const completed = this.state.evaluateMissions();
    if (completed.length === 0) return;
    this.audio.playMissionComplete();
    for (const c of completed) this.ui.showMissionToast();
    void this.persistence.save(this.state.getMutablePlayerData());
  }

  private applySkin(skinId: string): void {
    const skin = GAME_CONFIG.SHOP_SKINS.find((s) => s.id === skinId);
    if (skin) this.ball.setSkinColor(skin.color);
  }

  // ---- main loop ----

  /** Original `ip()`: per-frame update. */
  private gameLoop(delta: number): void {
    if (document.body.classList.contains('game-paused')) return;

    const st = this.state.getMutableState();
    // Steering is gated while the run waits for a tap (run start, guided
    // tutorial retry) — otherwise a lingering drag would drift the ball off
    // its platform while it idles.
    if (st.isStarted && !st.isFailed && !st.isWaitingForTap) {
      st.ballX += (st.xTarget - st.ballX) * GAME_CONFIG.X_LERP;
      this.ball.group.position.x = st.ballX;
    }

    // One-action Play (normal runs only): once the run is armed, the first jump
    // fires automatically after the anticipation beat. A tap inside the window
    // cancels it (firstJump clears the armed flag), so the jump never fires
    // twice. The tutorial never arms it — the guide owns the first tap there.
    if (st.isStarted && !st.isFailed && st.isWaitingForTap && this.firstJumpArmed) {
      this.firstJumpWait += delta;
      if (this.firstJumpWait >= GAME_CONFIG.FIRST_JUMP_ANTICIPATION) {
        this.firstJump();
      }
    }

    // Keep the guided-play ring glued to the target tile while the lessons are
    // up (the ramp hops run silently after the 5 teaching hops fade out).
    if (this.guidedFirst && this.guidedStep < this.GUIDE_LESSONS) this.updateFirstRunGuide();

    this.shadow.update(this.ball.group.position.x, this.ball.group.position.y, this.ball.group.position.z);
    this.camera.update(st.ballX, this.ball.group.position.z);
    this.effects.updateParticles(delta);
    this.effects.updateSpeedLines(
      delta,
      st.score,
      this.ball.group.position.x,
      this.ball.group.position.y,
      this.ball.group.position.z,
      st.isStarted,
      st.isFailed
    );
    this.platforms.updateCoins(delta, Date.now());
    this.platforms.updateSway(Date.now());
    this.effects.updateFailureFlags(Date.now());
    this.background.update(this.renderer.camera.position.z);
    MaterialFactory.updateLightDirection(this.renderer.directional);
  }

  // ---- start-screen attract demo ----

  /**
   * Start the start-screen attract demo (idempotent): the ball hops forward
   * continuously while the runway recycles ahead of it, so it goes forever.
   * Silent, and it chases each tile's live center so landings stay on-tile even
   * in sway worlds. It runs indefinitely on the start screen — only a run start
   * stops it, and it restarts whenever the start screen is shown again
   * (reset / boot-fade). World switches re-seed it from tile 0 (onWorldSelect).
   * Coins are stripped from the runway while the demo is up — the demo never
   * shows pickups (they're re-added by reset() when a real run starts).
   * Locked worlds never demo: the ball stays parked on the start tile with the
   * world as scenery — a tease, not a spoiler (the demo resumes automatically
   * the next time startAttractDemo runs with the world unlocked).
   */
  startAttractDemo(): void {
    if (this.demoActive) return;
    this.demoActive = true;
    PlatformEntity.coinsEnabled = false;
    this.platforms.clearCoins();
    this.demoStep = 0;
    if (!this.state.canSelectWorld(this.state.getActiveWorld())) {
      this.resetEntities();
      return;
    }
    this.demoHop(0);
  }

  /** Stop the attract demo (taken over by real play or UI interaction). */
  stopAttractDemo(): void {
    this.demoActive = false;
    PlatformEntity.coinsEnabled = true;
    gsap.killTweensOf(this.demoTween);
  }

  /** Hop the demo ball one tile forward, recycling the runway so it goes forever. */
  private demoHop(index: number): void {
    // Halt whenever the active world is (or becomes) locked — e.g. a locked
    // world preview selected from the nav arrows must never demo its gameplay.
    if (!this.demoActive || !this.state.canSelectWorld(this.state.getActiveWorld())) return;
    const st = this.state.getMutableState();
    const startP = this.platforms.getPlatformByIndex(index);
    const targetP = this.platforms.getPlatformByIndex(index + 1);
    if (!startP || !targetP) {
      // Shouldn't happen while recycling; re-seed a fresh runway and continue.
      this.platforms.reset();
      this.ball.reset();
      this.camera.reset();
      this.demoHop(0);
      return;
    }
    const startX = index === 0 ? 0 : st.ballX;
    const y = GAME_CONFIG.PLATFORM_HEIGHT / 2 + GAME_CONFIG.BALL_RADIUS;
    const duration = Math.max(0.45, this.state.getJumpDuration());
    const bounce = GAME_CONFIG.BOUNCE_HEIGHT;
    const easeInOutQuad = (h: number): number =>
      h < 0.5 ? 2 * h * h : 1 - Math.pow(-2 * h + 2, 2) / 2;
    st.ballX = startX;
    this.demoTween.t = 0;
    gsap.killTweensOf(this.demoTween);
    gsap.to(this.demoTween, {
      t: 1,
      duration,
      ease: 'none',
      onUpdate: () => {
        const h = this.demoTween.t;
        const f = easeInOutQuad(h);
        // Chase the tile's LIVE center (it may sway) so landings stay on-tile.
        const endX = targetP.platformX + (targetP.swayOffset || 0);
        this.ball.group.position.x = startX + (endX - startX) * f;
        this.ball.group.position.z = startP.z + (targetP.z - startP.z) * f;
        this.ball.group.position.y = y + Math.sin(Math.PI * h) * bounce;
      },
      onComplete: () => {
        if (!this.demoActive) return;
        const landX = targetP.platformX + (targetP.swayOffset || 0);
        this.ball.group.position.set(landX, y, targetP.z);
        st.ballX = landX;
        this.demoStep = index + 1;
        st.currentStep = this.demoStep;
        // Recycle platforms behind the ball so the runway extends forever.
        this.platforms.recycle();
        BallEntity.squashPlatform(targetP.group, targetP.baseScale || 1);
        this.demoHop(this.demoStep);
      }
    });
  }

  // ---- first-run guided play ----

  /**
   * Time-scale multiplier for the current guided hop. The 5 teaching hops run
   * at lesson speed (GUIDED_LESSON_TIME_SCALE = 1/0.4 → 0.4x); the next
   * GUIDED_RAMP_HOPS hops ease the multiplier down to 1.0x (full speed).
   */
  private guidedHopTimeScale(): number {
    const start = GAME_CONFIG.GUIDED_LESSON_TIME_SCALE;
    if (this.guidedStep < this.GUIDE_LESSONS) return start;
    const t = (this.guidedStep - (this.GUIDE_LESSONS - 1)) / GAME_CONFIG.GUIDED_RAMP_HOPS;
    return start + (1 - start) * Math.min(1, Math.max(0, t));
  }

  /** Keep the guided-play ring glued to the next target tile. */
  private updateFirstRunGuide(): void {
    const target = this.platforms.getPlatformByIndex(this.guidedStep + 1);
    if (!target) return;
    const targetX = target.platformX + (target.swayOffset || 0);
    this.ui.positionGuideRing(targetX, target.z);
    // Lock the drag-arrow direction per target tile: it is only recomputed when
    // the guide advances (i.e. after the ball lands on the tile it was aiming
    // for), never while the ball is still approaching — so it can't flip mid-hop.
    if (this.guidedStep !== this.guideDragDirectionStep) {
      this.guideDragDirectionStep = this.guidedStep;
      this.ui.setGuideDragDirection(this.ball.group.position.x, this.ball.group.position.z, targetX, target.z);
    }
    // The arrow stays parked on the NEXT tile and points the way the player must
    // drag to land there (direction resolved in screen space by the UI).
    this.ui.positionGuideDrag(this.ball.group.position.x, this.ball.group.position.z, targetX, target.z);
  }

  /** One-shot mark so returning players never see the tutorial again. */
  private finishTutorial(): void {
    const data = this.state.getMutablePlayerData();
    if (!data.tutorialDone) {
      data.tutorialDone = true;
      void this.persistence.save(data);
    }
  }

  /**
   * Tutorial fallback: the player missed during the guided segment. Instead of
   * a real game over, respawn the guided run from the start tile and let them
   * retry in a loop — the tutorial only hands over after the teaching hops.
   */
  private guidedRetry(): void {
    const st = this.state.getMutableState();
    // Block the auto-jump chain from continuing into the void: the finally in
    // jump() calls jump() again, which must no-op while we re-arm the first tap.
    st.isJumping = true;
    st.isFailed = false;
    this.resetEntities();
    st.score = 0;
    st.roundCoins = 0;
    st.perfectStreak = 0;
    st.shieldActive = false;
    st.shieldAwarded = false;
    st.runPerfects = 0;
    st.runCoins = 0;
    st.maxStreak = 0;
    st.isWaitingForTap = true;
    this.guidedStep = 0;
    this.guideDragDirectionStep = -1;
    this.ui.setScore(0);
    this.ui.showFirstRunGuide(true);
    this.ui.showTutorialRetry();
    this.updateFirstRunGuide();
    // The chain stays parked behind isJumping until the player's first tap:
    // firstJump() clears the flag and starts the hop. Nothing else unblocks
    // it, so the ball cannot move (or be steered) while it waits.
  }

  // ---- dev panel helpers (dev-only server builds) ----

  /**
   * Force the active world like a start-screen world switch: re-seeds the
   * runway and restarts the attract demo so ramps + demo coordinates stay
   * consistent (mirrors the `onWorldSelect` flow).
   */
  devForceWorld(id: WorldId | null): void {
    GAME_CONFIG.DEBUG.forceWorld = id;
    this.state.setWorldOverride(id);
    void this.persistence.save(this.state.getMutablePlayerData());
    this.platforms.reset();
    if (this.demoActive) {
      this.stopAttractDemo();
      this.resetEntities();
      this.startAttractDemo();
    }
  }

  /**
   * Re-roll the runway so layout toggles (straight line, no sway) take effect
   * before the next run. On the start screen the attract demo restarts; during
   * a live run only the pool is re-seeded (panel toggles are start-screen use).
   */
  devReseedRunway(): void {
    if (this.demoActive) {
      this.stopAttractDemo();
      this.resetEntities();
      this.startAttractDemo();
    } else {
      this.platforms.reset();
    }
  }

  /** Dev hitbox view: toggle wireframe on the ball + every platform mesh. */
  devSetHitboxes(on: boolean): void {
    const apply = (root: Object3D): void => {
      root.traverse((obj) => {
        const mesh = obj as Mesh;
        if (!mesh.isMesh) return;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          (m as { wireframe?: boolean }).wireframe = on;
        }
      });
    };
    for (const p of this.platforms.getPlatforms()) apply(p.group);
    apply(this.ball.group);
  }

  dispose(): void {
    // 8.5: clear any scheduled first-jump callback on dispose — the armed
    // anticipation must never outlive the game instance (kills the wind-up
    // tween and disarms the loop-driven auto-fire).
    this.cancelFirstJumpAnticipation();
    this.renderer.dispose();
    this.effects.dispose();
    this.audio.dispose();
    this.background.dispose();
    this.platforms.dispose();
    this.ball.dispose();
    this.shadow.dispose();
    MaterialFactory.dispose();
  }
}
