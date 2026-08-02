import { Game } from './Game';
import { GAME_CONFIG } from './config/GameConfig';

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
  const accessor = game as unknown as {
    state: { setScore(n: number): void; getMutablePlayerData(): { totalCoins: number; purchasedSkins: string[] } };
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
    }
  };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
