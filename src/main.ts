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

  // Cold-start failures (e.g. the first-ever WebGL context on a fresh GPU
  // process, or a one-off module hiccup) can throw exactly once and never
  // again — retry after a beat before giving up. The splash's inline fallback
  // (index.html) hides it on a hard deadline regardless, so the start screen
  // underneath can never be permanently covered.
  // Dev mode (vite dev server, `npm run dev:dev` via VITE_DEV_MODE, or `?dev=1`):
  // the save goes to its own key so the real player's progress is never
  // touched. NOTE: `?dev=1` only isolates the save — it must NOT expose
  // window.gameDebug on a production build (see createDebugApi gate below).
  const devMode =
    import.meta.env.DEV ||
    import.meta.env.VITE_DEV_MODE === 'true' ||
    new URLSearchParams(location.search).has('dev');
  let game: Game | null = null;
  try {
    game = new Game(container, devMode ? { persistenceKey: 'hop_dev_player_data' } : {});
  } catch (err) {
    console.error('HOP: boot init failed once — retrying.', err);
    window.setTimeout(() => {
      try {
        game = new Game(container, devMode ? { persistenceKey: 'hop_dev_player_data' } : {});
      } catch (err2) {
        console.error('HOP: boot init failed again.', err2);
      }
    }, 400);
  }

  // Branded flash screen: fill the wordmark/descriptor/studio from config, show
  // it for a short beat (shorter for returning players — there's a save), let a
  // tap skip it, then hand the live world to the start-screen attract demo.
  const splash = document.getElementById('splash-screen');
  if (splash) {
    const b = GAME_CONFIG.BRANDING;
    const setText = (id: string, value: string): void => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };
    setText('splash-title', b.title);
    setText('splash-descriptor', b.descriptor);
    setText('splash-studio-name', b.studio);
    const returning = !!localStorage.getItem('hop_player_data');
    const holdMs = returning ? 900 : 1500;
    const dismiss = (): void => {
      if (splash.classList.contains('fade-out')) return;
      splash.classList.add('fade-out');
      window.setTimeout(() => splash.classList.add('hidden'), 550);
      // The demo only needs the live world once the game is up; a boot that's
      // still retrying skips it (the splash fallback still reveals the screen).
      game?.startAttractDemo();
    };
    splash.addEventListener('pointerdown', dismiss, { once: true });
    window.setTimeout(dismiss, holdMs);
  }

  // Debug helpers (documented in docs/DEV_COMMANDS.md):
  //   window.gameDebug.setScore(n) / giveCoins(n) / unlockAllSkins() / toggleInvincible()
  //   window.gameDebug.unlockAllWorlds() / forceWorld(id | null) / setTotalScore(n)
  //   window.gameDebug.straightLane(on) / noSway(on) / hitboxes(on) / reseedRunway()
  //   window.gameDebug.spikeScene() / spikeOutline(0-3)  (Week 2 art spike)
  //   window.gameDebug.completeAllMissions() / claimAllMissions() / resetProgress()
  //
  // 6.4 gate: window.gameDebug is exposed ONLY when the build itself is a dev
  // build (vite dev server, or `npm run dev:dev` which sets VITE_DEV_MODE=true
  // via .env.dev). Both flags are replaced at build time, so in an ordinary
  // production build this whole branch — and createDebugApi with it — is
  // dead-code-eliminated: no debug surface ships, and `?dev=1` on a portal
  // build only isolates the save key, it never enables debug access.
  const accessor = game as unknown as DebugAccessor;
  if (import.meta.env.DEV || import.meta.env.VITE_DEV_MODE === 'true') {
    (window as unknown as { gameDebug?: Record<string, unknown> }).gameDebug =
      createDebugApi(accessor);
  }
}

/** Shape of the Game surface the debug API reaches into (see bootstrap). */
type DebugAccessor = {
  ball: { group: { position: { x: number; y: number; z: number } } };
  state: {
    setScore(n: number): void;
    getMutablePlayerData(): { totalCoins: number; purchasedSkins: string[] };
    setUnlockAllWorlds(v: boolean): void;
    setWorldOverride(id: string | null): void;
    setTotalScore(n: number): void;
    forceCompleteAllMissions(): void;
    claimAllMissions(): unknown[];
  };
  ui: {
    setScore(n: number): void;
    refreshCoins(): void;
    renderShop(): void;
    triggerWorldCallout(): void;
    openMissions(): void;
  };
  persistence: { save(d: unknown): Promise<void>; clear(): Promise<void> };
  platforms: { coinCount(): number };
  devForceWorld(id: WorldId | null): void;
  devReseedRunway(): void;
  devSetHitboxes(on: boolean): void;
  devSpikeScene(): Promise<{ duskTileAhead: boolean; hulls: number; playable: number; props: number }>;
  devSpikeOutline(mode: number): Promise<{ mode: number; name: string; hulls: number; playable: number; props: number }>;
};

/**
 * The window.gameDebug console surface. Only ever wired up by bootstrap when
 * the build is a dev build (see the 6.4 gate above) — never in production.
 */
function createDebugApi(accessor: DebugAccessor): Record<string, unknown> {
  return {
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
      accessor.devForceWorld(world);
    },
    straightLane: (on: boolean) => {
      GAME_CONFIG.DEBUG.straightLane = on;
      accessor.devReseedRunway();
    },
    noSway: (on: boolean) => {
      GAME_CONFIG.DEBUG.noSway = on;
      accessor.devReseedRunway();
    },
    hitboxes: (on: boolean) => {
      accessor.devSetHitboxes(on);
    },
    // Week 2 art spike (dev-only): build the Sunrise+Dusk-tell scene, then
    // flip the edge treatment 0-3 (black-hull / tinted-rim / playable-only /
    // contrast-only). Reload the page to revert. Documented in DEV_COMMANDS.
    spikeScene: () => accessor.devSpikeScene(),
    spikeOutline: (mode: number) => accessor.devSpikeOutline(mode),
    reseedRunway: () => {
      accessor.devReseedRunway();
    },
    setTotalScore: (n: number) => {
      accessor.state.setTotalScore(n);
    },
    completeAllMissions: () => {
      accessor.state.forceCompleteAllMissions();
      accessor.ui.openMissions();
      void accessor.persistence.save(accessor.state.getMutablePlayerData());
    },
    claimAllMissions: () => {
      const rewards = accessor.state.claimAllMissions();
      accessor.ui.refreshCoins();
      void accessor.persistence.save(accessor.state.getMutablePlayerData());
      return rewards;
    },
    resetProgress: () => {
      void accessor.persistence.clear().then(() => window.location.reload());
    },
    triggerWorldCallout: () => {
      accessor.ui.triggerWorldCallout();
    },
    ballPos: () => {
      const p = accessor.ball.group.position;
      return { x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2) };
    },
    coins: () => accessor.platforms.coinCount()
  };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
