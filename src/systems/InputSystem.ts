import { GAME_CONFIG } from '../config/GameConfig';
import type { GameStateManager } from '../core/GameStateManager';

/** Guard window for a duplicate Play press: the anticipation beat plus a small
 *  buffer for the browser's double-click interval. */
export const DUPLICATE_PLAY_GUARD_MS = GAME_CONFIG.FIRST_JUMP_ANTICIPATION * 1000 + 100;

/** A play-button rect snapshot (client coordinates). */
export interface PlayPressRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * True when a pointerdown is a leftover Play press: it lands inside the play
 * button's rect and arrives within the guard window after the press that
 * started the run. The first jump is already scheduled by Game (one-action
 * Play) or the guide owns the first tap (tutorial) — this press must not be
 * treated as a gameplay tap (8.5: ignore duplicate Play events while
 * preparation is in progress; prevent the Play pointer event from becoming a
 * second gameplay tap).
 */
export function isDuplicatePlayPress(
  now: number,
  playPressTime: number,
  playPressRect: PlayPressRect | null,
  clientX: number,
  clientY: number
): boolean {
  if (!playPressRect) return false;
  if (now - playPressTime > DUPLICATE_PLAY_GUARD_MS) return false;
  return (
    clientX >= playPressRect.left &&
    clientX <= playPressRect.right &&
    clientY >= playPressRect.top &&
    clientY <= playPressRect.bottom
  );
}

/**
 * Pointer input: drag-to-aim, tap-to-jump, with UI guards.
 * Faithful to the original `$d` / `jd` / `lu` handlers.
 */
export class InputSystem {
  private dragging = false;
  private startClientX = 0;
  private startTarget = 0;
  private resetCooldown = false;
  /** Timestamp of the last Play-button press (duplicate-press guard). */
  private playPressTime = 0;
  /** Play-button rect at the last Play press (duplicate-press guard). */
  private playPressRect: PlayPressRect | null = null;

  constructor(
    private canvas: HTMLElement,
    private uiOverlay: HTMLElement,
    private startScreen: HTMLElement,
    private gameOverScreen: HTMLElement,
    private shopOverlay: HTMLElement,
    private shopBtn: HTMLElement,
    private missionsOverlay: HTMLElement,
    private missionsBtn: HTMLElement,
    private playBtn: HTMLElement,
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
    const missionsOpen = this.missionsOverlay.style.display === 'flex';
    const isMissionsBtn = e.target === this.missionsBtn || this.missionsBtn.contains(e.target as Node);
    const gameOverOpen = this.gameOverScreen.style.display === 'flex';

    if (paused || shopOpen || missionsOpen || isShopBtn || isMissionsBtn || this.resetCooldown || gameOverOpen) return;

    if (!st.isStarted) {
      // The game only starts from the play button, not from anywhere on the screen.
      // Note: the attract demo deliberately ignores menu touches — it runs
      // indefinitely behind the start screen until a run actually starts.
      if (!this.playBtn.contains(e.target as Node)) return;
      const r = this.playBtn.getBoundingClientRect();
      this.playPressTime = performance.now();
      this.playPressRect = { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
      this.onGameStart();
      return;
    }
    if (st.isWaitingForTap) {
      // A duplicate Play press (rapid double-click on the play button) must not
      // be treated as a gameplay tap: the first jump is already scheduled by
      // Game (one-action Play) or the guide owns the first tap (tutorial).
      if (isDuplicatePlayPress(performance.now(), this.playPressTime, this.playPressRect, e.clientX, e.clientY)) {
        return;
      }
      // The state transition (isWaitingForTap → false) is owned by
      // GameStateManager via Game.firstJump — a tap here IS the first jump
      // (normal runs) or the tutorial's tap-to-start (guided runs).
      this.dragging = false;
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
    // While a tap is re-armed (run start, guided-tutorial retry), steering is
    // gated: a held pointer must never push the ball off its platform while it
    // waits for the tap.
    if (st.isWaitingForTap) return;
    // Sensitivity 0–100 scales the drag multiplier (50 = the original feel).
    const sens = this.state.getPlayerData().sensitivity / 50;
    const delta = (e.clientX - this.startClientX) * -0.028 * sens;
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
