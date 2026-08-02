import { Game } from './Game';
import { GAME_CONFIG } from './config/GameConfig';
import { WORLDS } from './config/Worlds';
import type { WorldId } from './config/Worlds';

function bootstrap(): void {
  const container = document.getElementById('game-container');
  if (!container) {
    console.error('HOP: #game-container not found');
    return;
  }

  const game = new Game(container);

  // Fade the splash once the game is up
  const splash = document.getElementById('splash-screen');
  if (splash) {
    setTimeout(() => {
      splash.classList.add('fade-out');
    }, 100);
  }

  // Debug helpers (documented in CUSTOMIZATION_GUIDE):
  //   window.gameDebug.setScore(n) / giveCoins(n) / unlockAllSkins() / toggleInvincible()
  //   window.gameDebug.unlockAllWorlds() / forceWorld(id | null) / setTotalScore(n)
  const accessor = game as unknown as {
    state: {
      setScore(n: number): void;
      getMutablePlayerData(): { totalCoins: number; purchasedSkins: string[] };
      setUnlockAllWorlds(v: boolean): void;
      setWorldOverride(id: string | null): void;
      setTotalScore(n: number): void;
    };
    ui: {
      setScore(n: number): void;
      refreshCoins(): void;
      renderShop(): void;
    };
    persistence: { save(d: unknown): Promise<void> };
  };

  (window as unknown as { gameDebug: Record<string, unknown> }).gameDebug = {
    setScore: (n: number) => {
      accessor.state.setScore(n);
      accessor.ui.setScore(n);
    },
    giveCoins: (n: number) => {
      const data = accessor.state.getMutablePlayerData();
      data.totalCoins += n;
      accessor.ui.refreshCoins();
      void accessor.persistence.save(data);
    },
    unlockAllSkins: () => {
      const data = accessor.state.getMutablePlayerData();
      for (const skin of GAME_CONFIG.SHOP_SKINS) {
        if (!data.purchasedSkins.includes(skin.id)) data.purchasedSkins.push(skin.id);
      }
      accessor.ui.renderShop();
      void accessor.persistence.save(data);
    },
    toggleInvincible: () => {
      GAME_CONFIG.DEBUG.invincible = !GAME_CONFIG.DEBUG.invincible;
    },
    unlockAllWorlds: () => {
      GAME_CONFIG.DEBUG.unlockAllWorlds = !GAME_CONFIG.DEBUG.unlockAllWorlds;
      accessor.state.setUnlockAllWorlds(GAME_CONFIG.DEBUG.unlockAllWorlds);
    },
    forceWorld: (id: string | null) => {
      const world: WorldId | null = WORLDS.some((w) => w.id === id) ? (id as WorldId) : null;
      GAME_CONFIG.DEBUG.forceWorld = world;
      accessor.state.setWorldOverride(world);
    },
    setTotalScore: (n: number) => {
      accessor.state.setTotalScore(n);
    }
  };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
