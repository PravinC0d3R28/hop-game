# HOP — Customization Guide

Everything is centralized and typed. The two main files to edit are:

- `src/config/GameConfig.ts` — all gameplay/economy/visual constants
- `src/config/Themes.ts` — color themes

After editing, `npm run build` regenerates `dist/`.

---

## 1. Game Balance (`GameConfig.ts` → `GAME_CONFIG`)

```ts
// Physics
JUMP_DURATION_BASE: 0.5,      // seconds
JUMP_DURATION_MIN: 0.35,
JUMP_DURATION_RAMP: 0.0005,   // faster per point
BOUNCE_HEIGHT: 2,
X_LERP: 0.16,
HIT_THRESHOLD: 1.1,           // landing forgiveness
PERFECT_THRESHOLD: 0.5,

// Platforms
PLATFORM_SPACING_Z: 3.5,
PLATFORM_SPACING_Z_RAMP: 0.0025,
PLATFORM_SPACING_Z_MAX: 4.5,
PLATFORM_X_RANGE: 1.2,
PLATFORM_X_RANGE_RAMP: 0.02,  // <-- verified; raises difficulty fast
PLATFORM_X_RANGE_MAX: 3,
PLATFORM_SIZE_MIN: 0.9,
PLATFORM_SIZE_RAMP: 0.00012,

// coins
COIN_CHANCE: 0.28,
COIN_COLLECT_THRESHOLD: 0.8,

// Speed lines
SPEED_LINES_START_SCORE: 15,
SPEED_LINES_MAX_COUNT: 30,
SPEED_LINES_SPAWN_RATE: 0.03,
```

---

## 2. Adding / Editing Skins

Edit `GAME_CONFIG.SHOP_SKINS`:

```ts
{ id: 'neon', name: 'Neon Green', color: 0x00FF00, price: 175 }
```

- `price: 0` + auto-purchased → free skin
- Skins render in the shop automatically
- Ball material color = `skin.color`

---

## 3. Color Palettes & Cycle

Edit `GAME_CONFIG.COLOR_PALETTES` (array of `{ base, light }`) and
`COLOR_CYCLE_STEPS` (default 12). Palettes rotate on a random start offset each run.

---

## 4. Themes (`src/config/Themes.ts`)

```ts
light: { bg, cssBg, icon, shadowColor, decorations: [0xB8C8D8, ...] },
dark:  { bg, cssBg, icon, shadowColor, decorations: [0x444455, ...] }
```

Add new themes and register them in `ThemeRegistry`. Theme is persisted per player.

---

## 5. Game Modes (examples)

The jump/difficulty math lives in `GameStateManager`. To add a mode:

- Create a mode class with `getJumpDuration()`, `getSpacing()`, `getXRange()`,
  `getScale()`, `onLanding(...)` overrides.
- Swap in `Game.ts` based on a menu selection.

Ideas: Time Attack (countdown + bonus time), Zen (no fail, teleport back),
Reverse (jump toward -Z), Night mode (new theme + dimmer light).

---

## 6. New Platform Types

`PlatformEntity` supports `userData.type`. Extend `PlatformManager.recyclePlatform()`
to pick types by score:

```ts
type: score > 50 && Math.random() < 0.15 ? 'moving' : 'normal'
```

Wire `moving` behavior in the platform update loop (x = baseX + sin(t*speed)*range).

---

## 7. Effects & Particles

All particle tuning constants are at the top of `EffectsSystem.ts`:
dust count/life/speed, perfect ring growth, burst count, confetti colors/count,
speed-line geometry/lifetime.

---

## 8. Audio

`AudioSystem.ts` exposes `playTone(freq, dur, type, gain, detune)` and preset
methods (jump/perfect/coin/gameOver). Compose new sounds freely; no assets needed.

---

## 9. UI / Text / Localization

UI is DOM + CSS in `index.html`. All strings live in `UIManager` string constants
or `GAME_CONFIG.LOCALIZATION`. Add a locale object to support another language.

---

## 10. Persistence

`PersistenceManager` reads/writes `localStorage['hop_player_data']`. To add cloud
save later, implement the `SaveBackend` interface (see `managers/PersistenceManager.ts`).

---

## 11. Debug & Dev Tools

**Full command reference: [`docs/DEV_COMMANDS.md`](./DEV_COMMANDS.md)** — all
npm scripts, dev-mode vs production behavior, the complete `window.gameDebug`
console helper list, save keys, and the `GAME_CONFIG.DEBUG` flag table.

Quick summary:

`GAME_CONFIG.DEBUG` (in `src/config/GameConfig.ts`) controls the build-time
defaults:
```ts
DEBUG: { enabled: false, invincible: false, unlockAllSkins: false,
         infiniteCoins: false, unlockAllWorlds: false, forceWorld: null,
         straightLane: false, noSway: false, showFPS: false, showHitboxes: false }
```
- `invincible` skips the failure check
- `infiniteCoins` sets coins to max on load
- `unlockAllSkins` grants all skins on load
- `unlockAllWorlds` unlocks dusk/void from boot
- `straightLane` / `noSway` pin the runway for deterministic testing
- FPS meter and hitbox wireframe render when their flags are on

Console helpers (always defined; dev mode isolates the save under
`hop_dev_player_data`):
```js
window.gameDebug.setScore(100)
window.gameDebug.setTotalScore(5000)      // lifetime score → world unlocks
window.gameDebug.giveCoins(1000)
window.gameDebug.unlockAllSkins()
window.gameDebug.toggleInvincible()
window.gameDebug.unlockAllWorlds()
window.gameDebug.forceWorld('dusk')       // or null to revert
window.gameDebug.straightLane(true)
window.gameDebug.noSway(true)
window.gameDebug.hitboxes(true)
window.gameDebug.reseedRunway()
window.gameDebug.completeAllMissions()    // force every mission completed
window.gameDebug.claimAllMissions()       // bank all claimable rewards
window.gameDebug.ballPos() / coins()
window.gameDebug.resetProgress()          // wipe current save + reload
```

---

## 12. Asset Replacement

Replace in `assets/` (references are `./assets/...`):
- `splash.png` (512×512)
- `Coin.png` (64×64)
- `cart.png` (64×64)
- `indicator.png` (64×64 finger)

`Logo.png` is no longer shown on the start screen (the selected world's name
is the title); it is kept in the repo for the planned loading screen.

Font: Fredoka via Google Fonts (see `index.html` `<link>`).

---

## 13. Repurpose Checklist

- [ ] Change game title / brand in `index.html` and `main.ts`
- [ ] Swap Logo/splash/Coin assets
- [ ] Tune `GAME_CONFIG` for pacing
- [ ] Re-theme via `Themes.ts`
- [ ] Add skins / palettes
- [ ] Add platform/coin types
- [ ] Add game modes
- [ ] Update `README.md`
- [ ] `npm run build` and verify `dist/`


