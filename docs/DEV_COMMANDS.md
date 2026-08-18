# HOP — Dev Commands Quick Reference

Every command for running, building, testing, and debugging HOP. Run npm
commands from the project root (`C:\Users\Poonam\Desktop\YTGames\HOP`).

---

## 1. Server / Build / Test

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server on **http://localhost:3000** (hot reload). |
| `npm run dev:dev` | Dev server on **http://localhost:3001** with `--mode dev` (loads `.env.dev` → `VITE_DEV_MODE=true`). |
| `npm run build` | Typecheck + production build into `dist/`. |
| `npm run preview` | Serve the production `dist/` build locally. |
| `npm run typecheck` | TypeScript check only (`tsc --noEmit`). |
| `npm run test` | Run the full vitest suite once. |
| `npm run test:watch` | Run tests in watch mode. |

**Quality gates before shipping anything:** `npm run typecheck` clean **and**
`npm run test` all green.

---

## 2. Dev Mode vs Production

Dev mode is active when **any** of these is true:

- running under the vite dev server (`npm run dev` / `npm run dev:dev`), or
- `VITE_DEV_MODE=true` (set by `npm run dev:dev` via `.env.dev`), or
- the URL has `?dev=1`.

In dev mode:

- **the save is isolated** under the localStorage key `hop_dev_player_data` —
  your real `hop_player_data` save is never read or written.

The `?dev=1` query flag can force save isolation even on a production/preview URL.

### 6.4 gate: when is `window.gameDebug` exposed?

`window.gameDebug` is **build-gated** (6.4) — it ships **only** when the build
itself is a dev build:

| Build | `window.gameDebug` | Why |
|---|---|---|
| `npm run dev` (vite dev server) | ✅ exposed | `import.meta.env.DEV` is true |
| `npm run dev:dev` (port 3001) | ✅ exposed | dev server + `VITE_DEV_MODE=true` |
| `vite build --mode dev` (QA build) | ✅ exposed | `VITE_DEV_MODE=true` from `.env.dev` |
| `npm run build` (production) | ❌ **absent** | both flags are false; the whole debug API is dead-code-eliminated from the bundle |

The `?dev=1` query string only isolates the save key — it **never** enables
debug access on a production build. (Acceptance: helpers work in local dev,
absent from the ordinary production bundle at runtime, and debug flags default
to off — `GAME_CONFIG.DEBUG` is all `false`.)

### 6.5 gate: sourcemaps

Source-map behavior is defined per build profile:

| Profile | Command | Source maps | Notes |
|---|---|---|---|
| Local development | `npm run dev` / `npm run dev:dev` | ✅ in-memory | dev server always generates them; stack traces readable |
| QA build | `vite build --mode dev` | ✅ full `.map` files in `dist/` | same mode that enables `window.gameDebug` (6.4) |
| **Public portal package** | `npm run build` | ❌ **none** | no `.map` files, no `sourceMappingURL` refs |
| **Private error-analysis build** | `npm run build:analyze` | 🔒 **hidden** maps moved to `error-maps/` | `sourcemap: 'hidden'` (no `sourceMappingURL` comment → browsers never auto-fetch); `scripts/collect-maps.mjs` then moves the `.map` files **out of `dist/`** into `error-maps/` (gitignored, outside the public package). Code is identical to the portal build (no `gameDebug`). |

Acceptance: the intended portal build (`npm run build`) contains no accidental
public `.map` files; local debugging still has readable stack traces.

---

## 3. `window.gameDebug` Console Helpers

Open the browser DevTools console (`F12` → Console) on the running game and
call these. **They exist only in dev builds** (vite dev server, `npm run dev:dev`,
or `vite build --mode dev`) — see the 6.4 gate above. On a production build
`window.gameDebug` is `undefined` and these do not exist.

### Run / score / economy

| Command | Effect |
|---|---|
| `gameDebug.setScore(n)` | Set the current run's score to `n` (updates HUD). |
| `gameDebug.setTotalScore(n)` | Set the **lifetime** total score to `n` (drives world unlocks, lifetime missions). |
| `gameDebug.giveCoins(n)` | Add `n` coins to the wallet. |
| `gameDebug.unlockAllSkins()` | Grant every shop skin (and re-render the shop). |
| `gameDebug.toggleInvincible()` | Toggle no-fail mode. |

### Worlds

| Command | Effect |
|---|---|
| `gameDebug.unlockAllWorlds()` | Toggle all worlds unlocked (dusk/void selectable). |
| `gameDebug.forceWorld('dusk')` | Switch to a world by id (`'sunrise'` \| `'dusk'` \| `'void'`); `null` reverts. Re-seeds the runway + restarts the attract demo. |
| `gameDebug.triggerWorldCallout()` | Fire the world-unlock callout/bubble. |

### Layout testing (the deterministic-testing flags)

| Command | Effect |
|---|---|
| `gameDebug.straightLane(true)` | Every platform spawns dead-center (x=0). `false` restores random lanes. Re-seeds the runway. |
| `gameDebug.noSway(true)` | Freeze per-world sway — dusk/void platforms stop drifting. `false` restores it. Re-seeds the runway. |
| `gameDebug.reseedRunway()` | Re-roll the runway so layout toggles take effect immediately. |
| `gameDebug.hitboxes(true)` | Wireframe overlay on the ball + all platform meshes. `false` hides it. |

> **Test tip:** `Math.random = () => 0.5` in the console forces straight,
> deterministic lanes for repeatable automated checks.

### Missions

| Command | Effect |
|---|---|
| `gameDebug.completeAllMissions()` | Force every mission into its completed state (unlocks the missions gate too) and opens the missions tab so you can see/claim them. |
| `gameDebug.claimAllMissions()` | Claim every completed-but-unclaimed mission — banks all their coin rewards at once. Returns the list of rewards. |

### Inspection / reset

| Command | Effect |
|---|---|
| `gameDebug.ballPos()` | Returns `{ x, y, z }` of the ball (rounded to 2dp). |
| `gameDebug.coins()` | Returns how many coins are currently on the runway. |
| `gameDebug.resetProgress()` | Wipes the current save key and reloads the page — back to a fresh profile. In dev mode this only touches `hop_dev_player_data`. |

### Full list (all defined helpers)

```
ballPos  claimAllMissions  coins  completeAllMissions  forceWorld
giveCoins  hitboxes  noSway  reseedRunway  resetProgress
setScore  setTotalScore  straightLane  toggleInvincible  triggerWorldCallout
unlockAllSkins  unlockAllWorlds
```

---

## 4. `GAME_CONFIG.DEBUG` Flags (build-time defaults)

Edit `src/config/GameConfig.ts` → `GAME_CONFIG.DEBUG` and rebuild/restart.
These set the *starting* state; the console helpers above toggle the same
flags live.

| Flag | Default | Effect |
|---|---|---|
| `enabled` | `false` | Master switch for debug features. |
| `invincible` | `false` | Skip the failure check (no game over). |
| `unlockAllSkins` | `false` | Grant all skins on save load. |
| `infiniteCoins` | `false` | Coins maxed on save load. |
| `unlockAllWorlds` | `false` | All worlds selectable from boot. |
| `forceWorld` | `null` | Start in a specific world (`WorldId` or `null`). |
| `straightLane` | `false` | Every platform spawns at x=0. |
| `noSway` | `false` | Disable per-world sway (dusk/void). |
| `showFPS` | `false` | FPS meter in the corner. |
| `showHitboxes` | `false` | Wireframe hitbox view on load. |

---

## 5. Save keys

| Key | Purpose |
|---|---|
| `hop_player_data` | The real player save (production / non-dev). |
| `hop_dev_player_data` | Isolated save used in dev mode — the real save is never touched. |
| `hop_save` | **Stale legacy key — ignore it.** |

---

## 6. Editing gameplay constants

All balance/economy/visual constants live in `src/config/GameConfig.ts`
(typed interface `GameConfig`). Themes live in `src/config/Themes.ts`. See
`docs/CUSTOMIZATION_GUIDE.md` for the full tuning guide.
