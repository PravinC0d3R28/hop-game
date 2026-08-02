import { GAME_CONFIG } from '../config/GameConfig';
import { sanitizePlayerData, mergePlayerData } from '../core/GameStateManager';
import type { PlayerData } from '../core/Types';

const STORAGE_KEY = 'hop_player_data';

export interface SaveBackend {
  load(): Promise<PlayerData | null>;
  save(data: PlayerData): Promise<void>;
}

/** Standalone localStorage backend. */
export class LocalStorageBackend implements SaveBackend {
  async load(): Promise<PlayerData | null> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as PlayerData;
    } catch {
      return null;
    }
  }

  async save(data: PlayerData): Promise<void> {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // storage full / unavailable — non-fatal
    }
  }
}

/**
 * Standalone persistence. Mirrors the original `ts()`/`QM()` save & sanitize flow
 * but uses localStorage instead of the YouTube Playables cloud.
 */
export class PersistenceManager {
  constructor(private backend: SaveBackend = new LocalStorageBackend()) {}

  async load(): Promise<PlayerData> {
    const loaded = await this.backend.load();
    return sanitizePlayerData(loaded);
  }

  /** Merge cloud/local into the current base and return the merged result. */
  merge(base: PlayerData, incoming: PlayerData): PlayerData {
    return mergePlayerData(base, incoming);
  }

  async save(data: PlayerData): Promise<void> {
    const sanitized = sanitizePlayerData(data);
    if (GAME_CONFIG.DEBUG.infiniteCoins) sanitized.totalCoins = Number.MAX_SAFE_INTEGER;
    if (GAME_CONFIG.DEBUG.unlockAllSkins) {
      for (const skin of GAME_CONFIG.SHOP_SKINS) {
        if (!sanitized.purchasedSkins.includes(skin.id)) sanitized.purchasedSkins.push(skin.id);
      }
    }
    await this.backend.save(sanitized);
  }

  /** Clear all persisted data (used by debug / reset-to-fresh). */
  async clear(): Promise<void> {
    await this.backend.save({} as PlayerData);
  }
}
