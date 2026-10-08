import { GAME_CONFIG } from '../config/GameConfig';
import { markMeasureUnnatural } from '../core/RunLog';
import type { Game } from '../Game';
import type { WorldId } from '../config/Worlds';

/**
 * Dev-only test panel. Mounted from main.ts inside the dev-build gate, so a
 * normal player build never includes it. Deleting this file and its mount
 * does not change the hop.
 */
const RESTART_MARK = 'hop_admin_restarted_once';

type AdminGame = {
  state: {
    getScore(): number;
    setScore(n: number): void;
    getTotalScore(): number;
    setLifetimeScore(n: number): void;
    setCoins(n: number): void;
    setRunsPlayed(n: number): void;
    resetMissions(): void;
    forceCompleteAllMissions(): void;
    claimAllMissions(): unknown[];
    setUnlockAllWorlds(v: boolean): void;
    getPlayerData(): {
      totalCoins: number;
      runsPlayed: number;
      totalScore: number;
    };
    getMutablePlayerData(): unknown;
  };
  ui: {
    setScore(n: number): void;
    refreshCoins(): void;
    renderStartScreen(): void;
    renderShop(): void;
    openMissions(): void;
  };
  persistence: { save(data: unknown): Promise<void>; clear(): Promise<void> };
  devForceWorld(id: WorldId | null): void;
  devReseedRunway(): void;
};

export function mountAdminMenu(game: Game): void {
  if (new URLSearchParams(location.search).get('shot') === '1') return;
  if (document.getElementById('hop-admin-btn')) return;
  // One restart of the dev profile, asked for when this panel was added.
  // The real player save (hop_player_data) is a different key and stays.
  if (!localStorage.getItem(RESTART_MARK)) {
    localStorage.setItem(RESTART_MARK, '1');
    localStorage.removeItem('hop_dev_player_data');
    location.reload();
    return;
  }

  const admin = game as unknown as AdminGame;
  const style = document.createElement('style');
  style.textContent = `
    #hop-admin-btn {
      position: fixed;
      left: 10px;
      bottom: 10px;
      z-index: 10001;
      border: 3px solid #111;
      background: #fff;
      color: #111;
      font: 800 13px/1 Fredoka, 'Segoe UI', sans-serif;
      letter-spacing: 0.4px;
      border-radius: 999px;
      padding: 8px 12px;
      cursor: pointer;
      box-shadow: 3px 3px 0 #111;
    }
    #hop-admin-panel {
      position: fixed;
      inset: 0;
      z-index: 10002;
      display: none;
      align-items: center;
      justify-content: center;
      background: rgba(0,0,0,0.45);
      padding: 16px;
    }
    #hop-admin-panel.open { display: flex; }
    #hop-admin-card {
      width: min(420px, 100%);
      max-height: min(86vh, 720px);
      overflow: auto;
      background: #f5f5f5;
      border: 4px solid #111;
      border-radius: 14px;
      box-shadow: 6px 6px 0 rgba(0,0,0,0.35);
      padding: 14px 14px 16px;
      color: #111;
      font-family: Fredoka, 'Segoe UI', sans-serif;
    }
    #hop-admin-card h2 {
      margin: 0;
      font-size: 22px;
      letter-spacing: 0.5px;
    }
    #hop-admin-card p {
      margin: 4px 0 12px;
      font-size: 13px;
      line-height: 1.35;
    }
    #hop-admin-card label {
      display: block;
      font-size: 12px;
      font-weight: 700;
      margin: 8px 0 4px;
    }
    .hop-admin-row, .hop-admin-worlds, .hop-admin-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
    }
    #hop-admin-card input[type="number"] {
      flex: 1;
      min-width: 0;
      border: 3px solid #111;
      border-radius: 8px;
      padding: 6px 8px;
      font: 700 16px Fredoka, sans-serif;
    }
    #hop-admin-card button {
      border: 3px solid #111;
      background: #fff;
      border-radius: 8px;
      padding: 6px 10px;
      font: 800 13px Fredoka, sans-serif;
      cursor: pointer;
    }
    #hop-admin-card button.danger { background: #ffd0d0; }
    .hop-admin-check {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 6px 0;
      font-size: 14px;
      font-weight: 700;
    }
  `;
  document.head.appendChild(style);

  const openBtn = document.createElement('button');
  openBtn.id = 'hop-admin-btn';
  openBtn.type = 'button';
  openBtn.textContent = 'Admin';
  openBtn.addEventListener('pointerdown', (e) => e.stopPropagation());

  const panel = document.createElement('div');
  panel.id = 'hop-admin-panel';
  panel.innerHTML = `
    <div id="hop-admin-card">
      <h2>Admin</h2>
      <p>Testing tools for this browser. A player build does not include this panel.</p>
      <label for="hop-admin-lifetime">Lifetime score (world unlocks)</label>
      <div class="hop-admin-row">
        <input id="hop-admin-lifetime" type="number" min="0" step="1" />
        <button type="button" data-act="lifetime">Apply</button>
      </div>
      <label for="hop-admin-run">This run's score</label>
      <div class="hop-admin-row">
        <input id="hop-admin-run" type="number" min="0" step="1" />
        <button type="button" data-act="run">Apply</button>
      </div>
      <label for="hop-admin-coins">Coins</label>
      <div class="hop-admin-row">
        <input id="hop-admin-coins" type="number" min="0" step="1" />
        <button type="button" data-act="coins">Set</button>
      </div>
      <label for="hop-admin-runs">Runs played</label>
      <div class="hop-admin-row">
        <input id="hop-admin-runs" type="number" min="0" step="1" />
        <button type="button" data-act="runs">Set</button>
      </div>
      <label>World</label>
      <div class="hop-admin-worlds">
        <button type="button" data-world="sunrise">Sunrise</button>
        <button type="button" data-world="dusk">Dusk</button>
        <button type="button" data-world="void">Deep Void</button>
      </div>
      <label class="hop-admin-check"><input id="hop-admin-unlock" type="checkbox" /> All worlds unlocked</label>
      <label class="hop-admin-check"><input id="hop-admin-invincible" type="checkbox" /> Can't fail</label>
      <label class="hop-admin-check"><input id="hop-admin-straight" type="checkbox" /> Straight lane</label>
      <label class="hop-admin-check"><input id="hop-admin-nosway" type="checkbox" /> No sway</label>
      <label>Missions</label>
      <div class="hop-admin-actions">
        <button type="button" data-act="reset-missions">Reset missions</button>
        <button type="button" data-act="complete-missions">Complete all</button>
        <button type="button" data-act="claim-missions">Claim all</button>
      </div>
      <div class="hop-admin-actions" style="margin-top:12px">
        <button type="button" class="danger" data-act="restart">Restart profile</button>
        <button type="button" data-act="close">Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(openBtn);
  document.body.appendChild(panel);

  const field = (id: string): HTMLInputElement => panel.querySelector(id) as HTMLInputElement;
  const fill = (): void => {
    const data = admin.state.getPlayerData();
    field('#hop-admin-lifetime').value = String(data.totalScore);
    field('#hop-admin-run').value = String(admin.state.getScore());
    field('#hop-admin-coins').value = String(data.totalCoins);
    field('#hop-admin-runs').value = String(data.runsPlayed);
    field('#hop-admin-unlock').checked = GAME_CONFIG.DEBUG.unlockAllWorlds;
    field('#hop-admin-invincible').checked = GAME_CONFIG.DEBUG.invincible;
    field('#hop-admin-straight').checked = GAME_CONFIG.DEBUG.straightLane;
    field('#hop-admin-nosway').checked = GAME_CONFIG.DEBUG.noSway;
  };
  const save = (): void => {
    void admin.persistence.save(admin.state.getMutablePlayerData());
  };
  const refreshMenu = (): void => {
    const start = document.getElementById('start-screen');
    if (start && start.style.display !== 'none') admin.ui.renderStartScreen();
    admin.ui.refreshCoins();
  };
  const refreshMissionsIfOpen = (): void => {
    const overlay = document.getElementById('missions-overlay');
    if (overlay && overlay.style.display === 'flex') admin.ui.openMissions();
  };

  const readNumber = (id: string): number => {
    const n = Number(field(id).value);
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  };

  openBtn.addEventListener('click', () => {
    fill();
    panel.classList.add('open');
  });
  panel.addEventListener('pointerdown', (e) => {
    if (e.target === panel) panel.classList.remove('open');
    e.stopPropagation();
  });

  panel.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest('button');
    if (!target) return;
    const act = target.dataset.act;
    const world = target.dataset.world as WorldId | undefined;
    if (world) {
      markMeasureUnnatural();
      admin.devForceWorld(world);
      return;
    }
    if (act === 'close') panel.classList.remove('open');
    if (act === 'lifetime') {
      admin.state.setLifetimeScore(readNumber('#hop-admin-lifetime'));
      save();
      refreshMenu();
    }
    if (act === 'run') {
      markMeasureUnnatural();
      const n = readNumber('#hop-admin-run');
      admin.state.setScore(n);
      admin.ui.setScore(n);
    }
    if (act === 'coins') {
      admin.state.setCoins(readNumber('#hop-admin-coins'));
      save();
      admin.ui.refreshCoins();
      admin.ui.renderShop();
    }
    if (act === 'runs') {
      admin.state.setRunsPlayed(readNumber('#hop-admin-runs'));
      save();
      refreshMenu();
    }
    if (act === 'reset-missions') {
      admin.state.resetMissions();
      save();
      refreshMissionsIfOpen();
    }
    if (act === 'complete-missions') {
      admin.state.forceCompleteAllMissions();
      save();
      admin.ui.openMissions();
    }
    if (act === 'claim-missions') {
      admin.state.claimAllMissions();
      save();
      admin.ui.refreshCoins();
      refreshMissionsIfOpen();
    }
    if (act === 'restart') {
      void admin.persistence.clear().then(() => location.reload());
    }
  });

  field('#hop-admin-unlock').addEventListener('change', () => {
    const on = field('#hop-admin-unlock').checked;
    GAME_CONFIG.DEBUG.unlockAllWorlds = on;
    admin.state.setUnlockAllWorlds(on);
    refreshMenu();
  });
  field('#hop-admin-invincible').addEventListener('change', () => {
    GAME_CONFIG.DEBUG.invincible = field('#hop-admin-invincible').checked;
  });
  field('#hop-admin-straight').addEventListener('change', () => {
    GAME_CONFIG.DEBUG.straightLane = field('#hop-admin-straight').checked;
    admin.devReseedRunway();
  });
  field('#hop-admin-nosway').addEventListener('change', () => {
    GAME_CONFIG.DEBUG.noSway = field('#hop-admin-nosway').checked;
    admin.devReseedRunway();
  });
}
