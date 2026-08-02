import type { GameStateManager } from '../core/GameStateManager';

/**
 * Pointer input: drag-to-aim, tap-to-jump, with UI guards.
 * Faithful to the original `$d` / `jd` / `lu` handlers.
 */
export class InputSystem {
  private dragging = false;
  private startClientX = 0;
  private startTarget = 0;
  private resetCooldown = false;

  constructor(
    private canvas: HTMLElement,
    private uiOverlay: HTMLElement,
    private startScreen: HTMLElement,
    private gameOverScreen: HTMLElement,
    private shopOverlay: HTMLElement,
    private shopBtn: HTMLElement,
    private state: GameStateManager
  ) {
    this.bind();
  }

  private bind(): void {
    this.canvas.addEventListener('pointerdown', (e) => this.onDown(e as PointerEvent));
    this.canvas.addEventListener('pointermove', (e) => this.onMove(e as PointerEvent));
    this.canvas.addEventListener('pointerup', () => this.onUp());
    this.canvas.addEventListener('pointercancel', () => this.onUp());
    this.startScreen.addEventListener('pointerdown', (e) => this.onDown(e as PointerEvent));
    this.uiOverlay.addEventListener('pointermove', (e) => this.onMove(e as PointerEvent));
    this.uiOverlay.addEventListener('pointerup', () => this.onUp());
  }

  /** Called by Game on reset (mirrors `Ps` cooldown flag). */
  beginResetCooldown(): void {
    this.resetCooldown = true;
    setTimeout(() => {
      this.resetCooldown = false;
    }, 500);
  }

  /** Public callbacks wired by Game. */
  onGameStart: () => void = () => {};
  onFirstJump: () => void = () => {};

  private onDown(e: PointerEvent): void {
    const st = this.state.getMutableState();
    const paused = document.body.classList.contains('game-paused');
    const shopOpen = this.shopOverlay.style.display === 'flex';
    const isShopBtn = e.target === this.shopBtn || this.shopBtn.contains(e.target as Node);
    const gameOverOpen = this.gameOverScreen.style.display === 'flex';

    if (paused || shopOpen || isShopBtn || this.resetCooldown || gameOverOpen) return;

    if (!st.isStarted) {
      this.onGameStart();
      return;
    }
    if (st.isWaitingForTap) {
      st.isWaitingForTap = false;
      this.onFirstJump();
      return;
    }
    this.dragging = true;
    this.startClientX = e.clientX;
    this.startTarget = st.xTarget;
  }

  private onMove(e: PointerEvent): void {
    if (!this.dragging) return;
    const st = this.state.getMutableState();
    const delta = (e.clientX - this.startClientX) * -0.028;
    st.xTarget = this.clamp(this.startTarget + delta, -5, 5);
  }

  private onUp(): void {
    this.dragging = false;
  }

  dispose(): void {
    // listeners are on persistent DOM nodes; no-op for this lifecycle
  }

  private clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
  }
}
