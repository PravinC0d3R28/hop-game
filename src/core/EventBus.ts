type Handler<T extends unknown[]> = (...args: T) => void;

/**
 * Minimal typed pub/sub used for cross-system communication.
 * Events map to payload tuples; subscription returns an unsubscribe fn.
 */
export class EventBus {
  private listeners = new Map<string, Set<Handler<unknown[]>>>();

  on<T extends unknown[]>(event: string, handler: Handler<T>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(handler as Handler<unknown[]>);
    return () => this.off(event, handler as Handler<unknown[]>);
  }

  off<T extends unknown[]>(event: string, handler: Handler<T>): void {
    this.listeners.get(event)?.delete(handler as Handler<unknown[]>);
  }

  emit<T extends unknown[]>(event: string, ...args: T): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const handler of [...set]) {
      (handler as Handler<T>)(...args);
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}

export const GAME_EVENTS = {
  SCORE_CHANGED: 'score-changed',
  COIN_CHANGED: 'coin-changed',
  BEST_SCORE_CHANGED: 'best-score-changed',
  THEME_CHANGED: 'theme-changed',
  SKIN_CHANGED: 'skin-changed',
  COIN_COLLECTED: 'coin-collected',
  PERFECT_HIT: 'perfect-hit',
  STREAK_MILESTONE: 'streak-milestone',
  GAME_OVER: 'game-over',
  GAME_START: 'game-start',
  GAME_RESET: 'game-reset',
  WORLD_CHANGED: 'world-changed',
  DATA_SAVED: 'data-saved',
  AUDIO_JUMP: 'audio-jump',
  AUDIO_PERFECT: 'audio-perfect',
  AUDIO_COIN: 'audio-coin',
  AUDIO_GAMEOVER: 'audio-gameover'
} as const;
