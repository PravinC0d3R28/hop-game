import { GAME_CONFIG } from '../config/GameConfig';
import { THEMES, type ThemeName } from '../config/Themes';
import type { GameStateManager } from '../core/GameStateManager';
import { EventBus, GAME_EVENTS } from '../core/EventBus';
import type { WorldConfig } from '../config/Worlds';
import type { RendererSystem } from '../systems/RendererSystem';
import type { ShadowSystem } from '../systems/ShadowSystem';
import type { BackgroundSystem } from '../systems/BackgroundSystem';
import type { BallEntity } from '../entities/BallEntity';
import { gsap } from 'gsap';

/**
 * All DOM UI: start screen, score, coin counters, shop, game-over, theme toggle.
 * Faithful port of the original `no` / `uc` / `as` / `io` / `zy` / `uc` handlers,
 * with localStorage persistence instead of the YouTube cloud.
 */
export class UIManager {
  private scoreEl = this.el<HTMLElement>('score');
  private coinAmount = this.el<HTMLElement>('coin-amount');
  private bestScoreVal = this.el<HTMLElement>('best-score-val');
  private themeBtn = this.el<HTMLButtonElement>('theme-btn');
  private themeIcon = this.el<HTMLElement>('theme-icon');
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

  constructor(
    private state: GameStateManager,
    private events: EventBus,
    private renderer: RendererSystem,
    private shadow: ShadowSystem,
    private background: BackgroundSystem,
    private ball: BallEntity
  ) {
    this.bind();
    this.events.on(GAME_EVENTS.WORLD_CHANGED, (world) =>
      this.showWorldBanner(world as WorldConfig)
    );
  }

  private el<T extends HTMLElement>(id: string): T {
    const node = document.getElementById(id);
    if (!node) throw new Error(`Missing DOM element #${id}`);
    return node as T;
  }

  private bind(): void {
    this.themeBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.themeBtn.addEventListener('click', () => this.toggleTheme());
    this.shopBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openShop();
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
    window.addEventListener('resize', () => this.onResize());
  }

  onContinue: () => void = () => {};
  onSkinApplied: () => void = () => {};

  /** Mirror `no(r)`: apply theme to scene + DOM. */
  setTheme(theme: ThemeName, persist = true): void {
    this.state.setTheme(theme);
    const t = THEMES[theme];
    if (persist) void this.state.getMutablePlayerData();
    this.renderer.setTheme(theme);
    this.shadow.setThemeColor(t.shadowColor);
    this.themeIcon.textContent = t.icon;
    this.background.recolor();
    if (persist) this.onThemeChanged();
  }

  onThemeChanged: () => void = () => {};

  private toggleTheme(): void {
    const next = this.state.toggleTheme();
    this.setTheme(next);
  }

  /** Mirror `ts()` — persist happens via Game callback. */

  /** Mirror `as()`: coin counter + shop footer. */
  refreshCoins(): void {
    const total = this.state.getPlayerData().totalCoins;
    this.coinAmount.textContent = String(total);
    this.shopCoinDisplay.textContent = String(total);
  }

  /** Mirror `io()`: best score on start screen. */
  refreshBestScore(): void {
    this.bestScoreVal.textContent = String(this.state.getPlayerData().bestScore);
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
  }

  showThemeButton(show: boolean): void {
    this.themeBtn.style.display = show ? 'flex' : 'none';
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

  /** Mirror `no(r)` theme-button icon only. */
  refreshThemeIcon(): void {
    this.themeIcon.textContent = THEMES[this.state.getPlayerData().theme].icon;
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
    // CSS handles responsive sizing; nothing to do.
  }

  /** Show "entered world" banner: header + tagline + white flash overlay. */
  private showWorldBanner(world: WorldConfig): void {
    const overlay = document.getElementById('ui-overlay');
    if (!overlay) return;
    gsap.killTweensOf('.world-banner');
    overlay.querySelector('.world-banner')?.remove();

    const banner = document.createElement('div');
    banner.className = 'world-banner';
    const title = document.createElement('div');
    title.className = 'world-banner-title';
    title.textContent = world.name;
    const tag = document.createElement('div');
    tag.className = 'world-banner-tag';
    tag.textContent = world.tagline;
    banner.append(title, tag);
    overlay.appendChild(banner);

    const flash = document.createElement('div');
    flash.className = 'world-flash';
    overlay.appendChild(flash);
    gsap.fromTo(
      flash,
      { autoAlpha: 0 },
      {
        autoAlpha: 1,
        duration: 0.3,
        yoyo: true,
        repeat: 1,
        onComplete: () => flash.remove()
      }
    );

    gsap.fromTo(
      banner,
      { autoAlpha: 0, scale: 0.8, y: 14 },
      { autoAlpha: 1, scale: 1, y: 0, duration: 0.45, ease: 'back.out(1.6)', delay: 0.15 }
    );
    gsap.to(banner, {
      autoAlpha: 0,
      duration: 0.5,
      delay: 2.0,
      ease: 'power2.in',
      onComplete: () => banner.remove()
    });
  }

  dispose(): void {
    // DOM listeners persist for app lifetime
  }
}
