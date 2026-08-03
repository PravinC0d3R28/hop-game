import { GAME_CONFIG } from '../config/GameConfig';
import { THEMES, type ThemeName } from '../config/Themes';
import type { GameStateManager } from '../core/GameStateManager';
import { EventBus, GAME_EVENTS } from '../core/EventBus';
import type { WorldConfig } from '../config/Worlds';
import type { MissionKind, MissionReward } from '../config/Missions';
import { getLedgerInfo, getMissionProgressList, getWorldProgress } from '../core/Progression';
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
  private ledgerFill = this.el<HTMLElement>('ledger-fill');
  private ledgerLabel = this.el<HTMLElement>('ledger-label');
  private ledgerTotal = this.el<HTMLElement>('ledger-total');
  private ledgerTarget = this.el<HTMLElement>('ledger-target');
  private worldProgress = this.el<HTMLElement>('world-progress');
  private missionsBtn = this.el<HTMLButtonElement>('missions-btn');
  private missionsOverlay = this.el<HTMLElement>('missions-overlay');
  private missionsClose = this.el<HTMLElement>('missions-close');
  private missionsList = this.el<HTMLElement>('missions-list');
  private missionsScroll = this.el<HTMLElement>('missions-scroll');
  private missionsTabs = Array.from(document.querySelectorAll<HTMLButtonElement>('.missions-tab'));
  private goWorld = this.el<HTMLElement>('go-world');
  private goMissions = this.el<HTMLElement>('go-missions');
  private goMissionsList = this.el<HTMLElement>('go-missions-list');
  private streakGlow: HTMLElement | null = null;
  private missionQueue: boolean[] = [];
  private missionBusy = false;
  private activeMissionTab: MissionKind = 'general';
  /** Done missions already celebrated with per-card confetti (one-time per session). */
  private celebratedIds = new Set<string>();
  private celebratedSeeded = false;

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
    this.events.on(GAME_EVENTS.WORLD_CHANGED, (world) =>
      this.showWorldBanner(world as WorldConfig)
    );
    this.events.on(GAME_EVENTS.STREAK_MILESTONE, (payload) =>
      this.showStreakBanner(payload as { milestone: 'fire'; shield: boolean })
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

  /** Render the compact progression block on the start screen (Iteration 7). */
  renderStartScreen(): void {
    this.renderLedger();
    this.renderWorldChips();
  }

  private renderLedger(): void {
    const data = this.state.getPlayerData();
    const ledger = getLedgerInfo(data.totalScore);
    this.ledgerFill.style.width = `${ledger.percent}%`;
    this.ledgerTotal.textContent = String(ledger.current);
    this.ledgerTarget.textContent = ledger.target.toLocaleString();
    this.ledgerLabel.classList.toggle('ledger-done', ledger.done);
    this.ledgerLabel.title = ledger.nextUnlock
      ? `Next: ${ledger.nextUnlock.name} at ${ledger.nextUnlock.unlockScore.toLocaleString()}`
      : 'All worlds open!';
  }

  private renderWorldChips(): void {
    const data = this.state.getPlayerData();
    this.worldProgress.innerHTML = '';
    for (const row of getWorldProgress(data)) {
      const chip = document.createElement('div');
      chip.className = `world-chip ${row.unlocked ? 'unlocked' : row.isNextUnlock ? 'next' : 'locked'}`;
      chip.innerHTML = `<span class="chip-name">${row.unlocked ? '&#10003; ' : ''}${row.world.name}</span>`;
      if (row.unlocked && row.best > 0) {
        const best = document.createElement('span');
        best.className = 'chip-best';
        best.textContent = `BEST ${row.best}`;
        chip.appendChild(best);
      }
      chip.title = row.unlocked
        ? `Best run in ${row.world.name}: ${row.best}`
        : `Unlocks at ${row.world.unlockScore.toLocaleString()} total`;
      this.worldProgress.appendChild(chip);
    }
  }

  /** Open the missions tab: render the active tab, animate bars, confetti on done. */
  openMissions(): void {
    this.renderMissionsOverlay();
    this.missionsOverlay.style.display = 'flex';
  }

  closeMissions(): void {
    this.missionsOverlay.style.display = 'none';
  }

  private renderMissionsOverlay(): void {
    const data = this.state.getPlayerData();
    const run = this.state.getState();
    let rows = getMissionProgressList(data, {
      score: run.score,
      runPerfects: run.runPerfects,
      runGems: run.runGems,
      maxStreak: run.maxStreak
    }).filter((r) => r.kind === this.activeMissionTab);

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

    for (const m of rows) {
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
        const lock = document.createElement('span');
        lock.className = 'm-lock';
        lock.textContent = '\u{1F512}';
        row.appendChild(lock);
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

    this.goWorld.textContent = `REACHED ${this.state.getActiveWorld().name.toUpperCase()}`;

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

  /** Show "entered world" banner: header + tagline + white flash overlay. */
  private showWorldBanner(world: WorldConfig): void {
    this.showBanner(world.name, world.tagline, 'world-banner', 2.0, true);
  }

  /** Show the fire reward banner (simplified v1): shield + constant glow. */
  private showStreakBanner(payload: { milestone: 'fire'; shield: boolean }): void {
    if (payload.milestone !== 'fire') return;
    this.showBanner('FIRE!', 'Shield raised — one free miss', 'streak-banner fire', 2.4, true);
  }

  /** Mission completed — white card slides in from the right, FIFO, no text. */
  showMissionToast(): void {
    this.missionQueue.push(true);
    this.pumpMissionCards();
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

  /** Bullseye + loading bar card (user spec: no mission name, minimal). */
  private showMissionCard(): void {
    const overlay = document.getElementById('ui-overlay');
    if (!overlay) return;
    overlay.querySelector('.mission-card')?.remove();

    const card = document.createElement('div');
    card.className = 'mission-card';
    card.innerHTML =
      '<svg class="mc-target" viewBox="0 0 24 24" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="10.5" fill="#fff" stroke="#111" stroke-width="1.6"/>' +
      '<circle cx="12" cy="12" r="7" fill="none" stroke="#111" stroke-width="1.6"/>' +
      '<circle cx="12" cy="12" r="3.5" fill="#ff4d4d" stroke="#111" stroke-width="1.6"/>' +
      '</svg>' +
      '<div class="mc-bar"><div class="mc-bar-fill"></div></div>';
    overlay.appendChild(card);

    gsap.fromTo(card, { xPercent: 120 }, { xPercent: 0, duration: 0.5, ease: 'power3.out' });
    const fill = card.querySelector<HTMLElement>('.mc-bar-fill');
    if (fill) {
      gsap.fromTo(fill, { width: '0%' }, { width: '100%', duration: 1.6, delay: 0.4, ease: 'power1.inOut' });
    }
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
    // DOM listeners persist for app lifetime
  }
}
