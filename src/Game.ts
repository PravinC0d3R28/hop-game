import { gsap } from 'gsap';
import { GAME_CONFIG } from './config/GameConfig';
import type { ThemeName } from './config/Themes';
import type { WorldConfig } from './config/Worlds';
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
import { PersistenceManager } from './managers/PersistenceManager';
import { UIManager } from './ui/UIManager';

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

  constructor(container: HTMLElement) {
    this.gameContainer = container;
    this.state = new GameStateManager();
    this.state.setUnlockAllWorlds(GAME_CONFIG.DEBUG.unlockAllWorlds);
    this.state.setWorldOverride(GAME_CONFIG.DEBUG.forceWorld);
    this.persistence = new PersistenceManager();
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
    this.ui.onContinue = () => {
      this.reset();
    };
    this.ui.onThemeChanged = () => {
      void this.persistence.save(this.state.getMutablePlayerData());
    };
    // World selection only happens on the start screen: re-seed the runway so
    // the first run uses the new world's ramps from platform #1.
    this.ui.onWorldSelect = () => {
      void this.persistence.save(this.state.getMutablePlayerData());
      this.platforms.reset();
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

  /** Original `Gy()`: first tap on menu starts the run. */
  private startGame(): void {
    if (!this.state.canSelectWorld(this.state.getActiveWorld())) return;
    // The missions-unlocked callout is a one-time gate: the player must click
    // the missions button before the next run is allowed.
    if (this.state.hasPendingMissionsUnlock()) return;
    this.audio.resume();
    this.state.getMutableState().isStarted = true;
    this.state.getMutableState().isWaitingForTap = true;
    this.ui.showStartScreen(false);
    this.ui.hideShop();
    this.ui.hideGameOver();
    this.ui.showScoreUI(true);
    this.ui.showCoinCounter(true);
  }

  /** Original first-tap handler: begins the auto-chain. */
  private firstJump(): void {
    this.jump();
  }

  /** Original `Vy()`: reset everything for a new run. */
  private reset(): void {
    this.input.beginResetCooldown();

    gsap.killTweensOf(this.ball.group.position);
    gsap.killTweensOf(this.ball.group.scale);
    gsap.globalTimeline.clear();
    this.ui.clearTransientFx();

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

    // Restore camera/entities BEFORE the start screen positions the play button,
    // so its projection uses the boot camera (not the end-of-run one).
    PlatformEntity.randomizePaletteStart();
    this.ball.reset();
    this.ball.setShield(false);
    this.platforms.reset();
    this.camera.reset();
    this.background.reset();
    this.effects.clearParticles();
    this.effects.clearSpeedLines();

    this.ui.renderStartScreen();
    this.ui.setScore(0);
    this.ui.showScoreUI(false);
    this.ui.showCoinCounter(false);
    this.ui.showStartScreen(true);
    this.effects.clearParticles();
    this.effects.clearSpeedLines();

    st.isWaitingForTap = true;
  }

  /** Original `By()`: fail sequence. */
  private gameOver(): void {
    const st = this.state.getMutableState();
    st.isFailed = true;
    this.audio.playGameOver();
    this.effects.clearSpeedLines();
    this.ui.setStreakGlow('off');
    this.ball.setShield(false);

    this.camera.shake();
    gsap.to(this.ball.group.position, { y: this.ball.group.position.y - 5, duration: 0.6, ease: 'power2.in' });
    gsap.to(this.ball.group.scale, { x: 0.5, y: 0.5, z: 0.5, duration: 0.6 });

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
    const duration = this.state.getJumpDuration();
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
            st.score++;
            const h = target ? target.swayOffset || 0 : 0;
            const f = target ? target.platformX + h : 0;
            if (Math.abs(st.ballX - f) < GAME_CONFIG.PERFECT_THRESHOLD) {
              st.perfectStreak++;
              st.score += st.perfectStreak;
              this.audio.playPerfect(st.perfectStreak);
              this.perfectHit(target);
              this.state.trackPerfectLanding();
              this.totalStreakReward();
            } else {
              st.perfectStreak = 0;
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
    const milestone = this.state.checkStreakMilestone();
    if (milestone !== 'fire') return;
    const shieldGranted = this.state.isShieldUnlocked() ? this.state.grantShield() : false;
    if (shieldGranted) this.ball.setShield(true);
    this.audio.playMilestone();
    this.effects.playFireBurst(this.ball.group.position.x, this.ball.group.position.y, this.ball.group.position.z);
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
    if (st.isStarted && !st.isFailed) {
      st.ballX += (st.xTarget - st.ballX) * GAME_CONFIG.X_LERP;
      this.ball.group.position.x = st.ballX;
    }

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
    this.background.update(this.renderer.camera.position.z);
    MaterialFactory.updateLightDirection(this.renderer.directional);
  }

  dispose(): void {
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
