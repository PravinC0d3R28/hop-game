# HOP — Complete Game Reference

A single self-contained reference for the **HOP** game (a faithful standalone
reimplementation of the *BounceTiles* arcade game from YouTube Playables).
Read this first when you start customizing — it explains what the game is, how
every piece works, and where everything lives in the code.

Companion docs (more detail on specific topics):
- `docs/ARCHITECTURE.md` — reverse-engineered spec of the original minified bundle
- `docs/GAME_MECHANICS.md` — exact behavioral formulas, verified against the original
- `docs/CUSTOMIZATION_GUIDE.md` — quick how-to guide for tweaks
- `README.md` — quick start + project overview
- `CHECKLIST.md` — development journal / verification log

---

## 1. What Is This Game?

A one-touch arcade game: the ball hops forward automatically along a track of
platforms. You **drag horizontally to aim** (position the ball left/right);
each jump is automatic. Land dead-center on a platform's diamond to get a
**PERFECT** bonus; collect golden **coins** to earn coins; spend coins on
**ball skins** in the shop.

| Attribute | Value |
|-----------|-------|
| Genre | Infinite runner / hop arcade |
| Controls | Pointer drag to aim (tap to start; tap again for first jump) |
| Rendering | Three.js (r152), WebGL, halftone-toon shader |
| Animation | GSAP 3.14 |
| Audio | 100% procedural Web Audio (no audio files) |
| Persistence | `localStorage` key `hop_player_data` |
| SDKs | None — pure standalone (no YouTube SDK) |
| Language | TypeScript, Vite build, Vitest tests |

---

## 2. Tech Stack & Commands

```
npm install        # install deps
npm run dev        # dev server, opens http://localhost:3000
npm run build      # typecheck (tsc) + production build → dist/
npm run preview    # serve the production build locally
npm run test       # vitest unit tests (33 tests)
npm run typecheck  # tsc --noEmit
```

Dependencies: `three`, `gsap`. Dev: `typescript`, `vite`, `vitest`, `@types/three`.
Vite config (`vite.config.ts`): `base: './'` (works from any static path),
manual chunks for `three` + `gsap`, es2020 target.

---

## 3. How to Play

1. **Tap the start screen** — run begins, ball idles on platform 0.
2. **Tap again** — first jump fires; the ball auto-chains jumps forever.
3. **Drag left/right** — aim the ball while it's in the air.
4. **Land on the platform** — score +1.
   - **Land on the diamond** (center, |offset| < 0.5) — **PERFECT**; score bonus
     equal to your streak (1, 2, 3, ...). The streak resets on a non-perfect landing.
   - **land on a coin** (|offset| < 0.8) — collect: +1 coin, +1 score.
5. **Miss** (|offset| > 1.1) — game over: shake, ball falls, score screen.
6. **Continue** — back to start screen, new run.

Two important quirks (faithful to the original):
- **Two separate taps** to start: tap #1 starts the run, tap #2 fires the first jump.
- **Drag direction is inverted**: dragging right moves the ball left
  (`delta * -0.028` — see InputSystem below).

---

## 4. Project Structure (file-by-file)

```
HOP/
├── index.html                     # ALL DOM UI + CSS (start screen, score, shop, game-over)
├── vite.config.ts                 # Vite + Vitest config
├── tsconfig.json
├── package.json
├── src/
│   ├── main.ts                    # Bootstrap: creates Game, fades splash, exposes window.gameDebug
│   ├── Game.ts                    # ★ Coordinator: main loop, jump chain, game-over, reset
│   ├── config/
│   │   ├── GameConfig.ts          # ★ ALL tunable constants (GAME_CONFIG)
│   │   └── Themes.ts              # Light/dark theme definitions (THEMES)
│   ├── core/
│   │   ├── Types.ts               # PlayerData / GameState / JumpParams interfaces
│   │   ├── GameStateManager.ts    # ★ Pure logic: difficulty math, scoring, shop, sanitize/merge
│   │   └── EventBus.ts            # Typed pub/sub (defined; currently unused by systems)
│   ├── systems/
│   │   ├── RendererSystem.ts      # WebGLRenderer, scene, camera, fog, lights, resize, RAF loop
│   │   ├── MaterialFactory.ts     # ★ Halftone-toon shader (tri-planar dots + shadow mask)
│   │   ├── CameraController.ts    # Follow camera (dead-band + lerps) + game-over shake
│   │   ├── ShadowSystem.ts        # Blob shadow under the ball (scales/fades with height)
│   │   ├── InputSystem.ts         # Pointer drag→xTarget, tap-to-start/first-jump, UI guards
│   │   ├── AudioSystem.ts         # Procedural WebAudio: jump/coin/perfect/gameover tones
│   │   ├── EffectsSystem.ts       # Jump dust, perfect ring/burst/flash, speed lines, confetti
│   │   └── BackgroundSystem.ts    # 10 floating rock clusters (bob + recycle behind camera)
│   ├── entities/
│   │   ├── BallEntity.ts          # Ball mesh + outline + blob highlight; jump tweens
│   │   └── PlatformEntity.ts      # Platform + diamond + ring + coin; palette colors; recycle
│   ├── managers/
│   │   ├── PlatformManager.ts     # Pool of 6 platforms, recycling, coin idle animation
│   │   └── PersistenceManager.ts  # localStorage load/save/sanitize/merge (SaveBackend iface)
│   └── ui/
│       └── UIManager.ts           # All DOM UI wiring: shop, game-over, score, theme, coins
├── tests/
│   ├── config.test.ts             # 9 tests — constants match verified spec
│   ├── mechanics.test.ts          # 11 tests — difficulty curves + scoring
│   └── state.test.ts              # 13 tests — sanitize/merge/economy/persistence
├── docs/                          # docs incl. this file
├── public/                        # static assets (splash.png, Logo.png, Coin.png, cart.png, indicator.png)
└── dist/                          # production build output
```

`★` = files you will edit 90% of the time.

---

## 5. Runtime Flow & Game States

```
BOOT
 └─ main.ts creates Game → all systems initialized → splash fades out
START SCREEN            (game state: isStarted=false)
 └─ tap #1 → startGame()            isStarted=true, isWaitingForTap=true
WAITING_FOR_TAP         (ball idle on platform 0, drag hint visible)
 └─ tap #2 → firstJump() → jump()   isWaitingForTap=false
PLAYING                 (auto-chain: each jump calls the next jump)
 └─ miss → gameOver()
GAME OVER               (isFailed=true: shake, ball falls, 600ms delay, overlay)
 └─ Continue → reset()  (500ms debounce) → START SCREEN
```

Key flow methods live in `src/Game.ts`:

| Method | Mirrors original | Purpose |
|--------|------------------|---------|
| `startGame()` (Game.ts:140) | `Gy` | First tap: hide menus, show score/coins |
| `firstJump()` (Game.ts:153) | first-tap | Fires the first `jump()` |
| `jump()` (Game.ts:220) | `Qd` | One jump + landing logic + auto-chains next jump |
| `gameOver()` (Game.ts:198) | `By` | Fail sequence: shake, fall, best-score, overlay |
| `reset()` (Game.ts:158) | `Vy` | Full reset: state, ball, platforms, camera, effects |
| `perfectHit()` (Game.ts:283) | `Py` | Perfect visuals + score elastic |
| `collectCoin()` (Game.ts:306) | `Dy` | Coin + score, coin shrink animation |
| `gameLoop()` (Game.ts:329) | `ip` | Per-frame: aim lerp, shadow, camera, effects, coins, background |

The main loop is driven by `RendererSystem.start()` (requestAnimationFrame,
delta capped at 50ms) which calls back into `Game.gameLoop()`.

---

## 6. The Data Model (`src/core/Types.ts`)

### GameState (runtime, reset each run)
```ts
{ score, currentStep, isJumping, isFailed, isStarted, isWaitingForTap,
  xTarget, ballX, perfectStreak, roundCoins }
```
- `score` — current run score
- `currentStep` — platform index the ball is on
- `xTarget` — the aim position (set by dragging, clamped ±5)
- `ballX` — actual ball x (lerps toward xTarget)
- `roundCoins` — coins earned this run (shown on game-over, added to total)

### PlayerData (persistent, stored in localStorage)
```ts
{ totalCoins, bestScore, purchasedSkins: string[], selectedSkin, theme }
```
- `purchasedSkins` — array of skin ids, always contains `"default"`
- `theme` — `"light" | "dark"`

### JumpParams
```ts
{ startZ, endZ, startY, endY, bounceHeight, duration }
```
Passed to `BallEntity.performJump()` — pure data, no logic.

---

## 7. All Tuning Constants (`src/config/GameConfig.ts`)

Everything is in the typed object `GAME_CONFIG`. These values were verified
against the original game and are asserted by tests — change deliberately.

### Platform geometry & generation
| Constant | Value | Effect |
|----------|-------|--------|
| `PLATFORM_WIDTH / DEPTH` | 2.2 / 2.2 | Platform footprint (box) |
| `PLATFORM_HEIGHT` | 0.8 | Platform thickness |
| `PLATFORM_SPACING_Z` | 3.5 | Distance between platform centers (start) |
| `PLATFORM_SPACING_Z_RAMP` | 0.0025 | Spacing grows per score point |
| `PLATFORM_SPACING_Z_MAX` | 4.5 | Spacing cap |
| `PLATFORM_X_RANGE` | 1.2 | Random horizontal offset range (start) |
| `PLATFORM_X_RANGE_RAMP` | 0.02 | Range grows per score point — **drives difficulty fast** |
| `PLATFORM_X_RANGE_MAX` | 3 | Range cap |
| `PLATFORM_SIZE_MIN` | 0.9 | Platform scale floor |
| `PLATFORM_SIZE_RAMP` | 0.00012 | Scale shrinks per score point |
| `VISIBLE_STEPS` | 6 | Platform pool size (recycled) |
| `PLATFORM_RISE_DURATION` | 0.5 | Time platforms rise from below on spawn |

### Ball physics
| Constant | Value | Effect |
|----------|-------|--------|
| `BALL_RADIUS` | 0.35 | Ball size |
| `JUMP_DURATION_BASE` | 0.5 | Jump time in seconds (start) |
| `JUMP_DURATION_MIN` | 0.35 | Fastest jump |
| `JUMP_DURATION_RAMP` | 0.0005 | Jump gets faster per score point |
| `BOUNCE_HEIGHT` | 2 | Jump arc height |
| `X_LERP` | 0.16 | Aim smoothing (ballX → xTarget per frame) |
| `HIT_THRESHOLD` | 1.1 | Land this far off-center → game over |
| `PERFECT_THRESHOLD` | 0.5 | Land within this → PERFECT bonus |

### Coins & scoring
| Constant | Value | Effect |
|----------|-------|--------|
| `COIN_CHANCE` | 0.28 | Probability a platform spawns a coin |
| `COIN_RADIUS` | 0.22 | coin coin size |
| `COIN_COLLECT_THRESHOLD` | 0.8 | Land within this → collect coin |
| `PERFECT_DOT_RADIUS` | 0.18 | Diamond marker size |

### Halftone shader
| Constant | Value | Effect |
|----------|-------|--------|
| `DOTS_SCALE` | 0.3 | Dot pattern scale (smaller = bigger dots) |
| `DOTS_STRENGTH` | 0.25 | How dark the dot darkening is |
| `DOTS_SHADOW_MIN/MAX` | 0.25 / 0.55 | NdotL band where shadow dots appear |

### Speed lines (motion streaks)
| Constant | Value | Effect |
|----------|-------|--------|
| `SPEED_LINES_START_SCORE` | 15 | Score where streaks begin |
| `SPEED_LINES_MAX_COUNT` | 30 | Cap on concurrent streaks |
| `SPEED_LINES_SPAWN_RATE` | 0.03 | Base seconds between spawns |
| `SPEED_LINES_LIFETIME` | 0.45 | Streak lifetime (base) |

### Camera
| Constant | Value | Effect |
|----------|-------|--------|
| `CAMERA_OFFSET_Y` | 9.5 | Camera height above ball |
| `CAMERA_OFFSET_Z` | -8.5 | Camera distance behind ball |
| `CAMERA_LOOK_AHEAD` | 3 | Look-at point ahead of ball |

### Colors
| Constant | Value | Effect |
|----------|-------|--------|
| `COLOR_BG` | `0x2a2a2a` | Default scene background (dark theme) |
| `COLOR_BALL` | `0xd0d8f0` | Default ball color ("Classic") |
| `COLOR_COIN` | `0xf0c020` | coin color |
| `COLOR_OUTLINE` | `0x111111` | Outline color for all entities |
| `COLOR_CYCLE_STEPS` | 12 | Platforms per palette before cycling |
| `COLOR_PALETTES` | 8 entries | Pastel `{base, light}` pairs (see §11) |

### Economy / shop / debug
| Constant | Value | Effect |
|----------|-------|--------|
| `AUDIO_ENABLED` | true | Master audio switch |
| `SHOP_SKINS` | 9 entries | id/name/color/price (see §12) |
| `DEBUG` | all false | `enabled, showHitboxes, showFPS, invincible, unlockAllSkins, infiniteCoins` |

---

## 8. Difficulty Formulas (`src/core/GameStateManager.ts`)

All derived from the current score; all unit-tested:

```
jumpDuration = max(0.35, 0.5 − score × 0.0005)
spacing      = min(4.5, 3.5 + score × 0.0025)
xRange       = min(3.0, 1.2 + score × 0.02)
platformScale= 1 − min(0.1, score × 0.00012)      → 1.0 → 0.9
speedIntensity= clamp((score − 15) / 70, 0, 1)    → 0 at 15, 1 at 85
```

Methods: `getJumpDuration()`, `getPlatformSpacing()`, `getXRange()`,
`getPlatformScale()`, `getSpeedLinesIntensity()`.

Also in `GameStateManager` (pure, no three.js/DOM — that's why it's testable):
- Scoring helpers: `addScore`, `addPerfectStreak`, `resetPerfectStreak`, `addRoundCoin`
- Economy: `buySkin(id)`, `equipSkin(id)`, `ownsSkin(id)` — buy checks price,
  deducts coins, auto-equips; equip requires ownership
- `toggleTheme()`, `setTheme()`, `updateBestScore()`
- `sanitizePlayerData()` + `mergePlayerData()` — persistence hygiene (§14)

---

## 9. Scoring & Economy Rules

| Event | Score effect | Coins |
|-------|--------------|-------|
| Land on platform | +1 | — |
| Land on diamond (perfect) | +streak bonus (streak starts at 1, +1 per consecutive perfect) | — |
| collect coin | +1 | +1 (`roundCoins` and `totalCoins`) |
| Miss (|offset| > 1.1) | game over | — |

- A perfect hit at streak 1 gives +1; streak 2 gives +2, etc. Any non-perfect
  landing resets the streak to 0. (Note: base +1 always happens even on perfect,
  so a perfect is effectively +1 + streak.)
- Score display bounces on change (`back.out(2)` in `Game.jump()`).
- coin collection persists `totalCoins` immediately to localStorage.

---

## 10. The Rendering Pipeline

### Scene graph (built in constructors)
```
Scene
├── Fog (bg color, near 14, far 40)
├── AmbientLight (white, 0.38)
├── DirectionalLight (white, intensity 2) @ (3, 10, 8)
├── Ball group
│   ├── Ball mesh (sphere r=0.35, 24×16, halftone-toon, skin color)
│   ├── Outline (BackSide sphere ×1.06, #111)
│   └── "Blob" highlight (partial sphere, white 0.55 opacity)
├── Shadow (circle r=0.35, theme shadow color, flat)
├── 6 Platforms (box + outline×1.02 + diamond + ring + optional coin)
├── 10 background rock clusters (2–4 spheres + outlines)
├── Particles (dust, perfect burst)
└── Speed lines (thin boxes pointing −Z)
```

### Halftone-toon shader (`systems/MaterialFactory.ts`)
A `MeshToonMaterial` patched via `onBeforeCompile` (shared uniforms = one update
applies to every material):
1. Tri-planar dot sampling — world position projected on XZ/XY/YZ planes,
   blended by face normal → dots never stretch on any face.
2. 4-step toon gradient map (`#404040 → #909090 → #d0d0d0 → #ffffff`).
3. Shadow mask from NdotL (`smoothstep`) — dots darken to ×0.55 only in shadow.
4. Cache key `"halftone-toon"` (one compiled program for all materials).

`MaterialFactory.updateLightDirection(light)` refreshes uniforms each frame;
`MaterialFactory.init()` creates the shared dot texture (128×128, white dots
radius 4 on a 14px grid) and gradient map once.

### Camera (`systems/CameraController.ts`)
- Horizontal target tracks ballX with a **±0.5 dead-band**, lerp 0.15.
- Position lerps: x 0.12, y 0.04, z 0.06 (offset y=9.5, z=−8.5).
- Look-at lerps at 0.08, aimed at `(ballX, 0.9, ballZ+3)`.
- FOV: 55 desktop; portrait (aspect<1) widens: `55 + (1−aspect)×30`.
- `shake()`: game-over screen shake — 6 random offsets (±0.15 x, ±0.075 y),
  40ms apart.

### Shadow (`systems/ShadowSystem.ts`)
Per frame: `scale = clamp(1 − height×0.15, 0.3, 1)`,
`opacity = clamp(0.35 − height×0.06, 0.05, 0.35)` where `height = ballY − (h/2+0.02)`.

---

## 11. Platform System

### Creation (`PlatformManager.initializePlatforms()`)
- 6 platforms (pool = `VISIBLE_STEPS`), z = `i × spacing`.
- x = 0 for indices 0–1, else random in ±xRange.
- Indices > 2 spawn at y=−5 and **rise** (`back.out(1.2)`, 0.5s) — the opening look.
- coins: 28% chance on indices > 2.

### Palette cycling (`PlatformEntity.platformColor`)
- Random palette start offset per run (`randomizePaletteStart()`).
- Palette = `COLOR_PALETTES[(start + floor(index/12)) % 8]`.
- Per platform: `lerp(base, light, (index%6)/6 × 0.5)`.

### Recycling (`PlatformManager.recycle()`)
Called on every landing. Any platform with `index < currentStep − 3` is reused:
new index/z/x/scale, recolored, coin re-rolled, hidden at y=−5, rises back up.

### coin idle animation (`PlatformManager.updateCoins()`)
`rotation.y += dt×2.5`; y bobs `+sin(now×0.004)×0.08`.

---

## 12. Shop & Skins

`SHOP_SKINS` in `GameConfig.ts`:

| id | name | color | price |
|----|------|-------|-------|
| default | Classic | `0xd0d8f0` | 0 |
| red | Ruby Red | `0xff4444` | 50 |
| blue | Ocean Blue | `0x4488ff` | 50 |
| green | Emerald | `0x44ff88` | 75 |
| gold | Golden | `0xffd700` | 100 |
| purple | Violet | `0x8844ff` | 100 |
| pink | Bubblegum | `0xff44aa` | 125 |
| cyan | Cyber Cyan | `0x44ffff` | 150 |
| shadow | Shadow | `0x333333` | 200 |

- UI (`UIManager.renderShop()`): preview circle shows skin color (or `#111` if
  not owned), name shown as `???` until owned, status "Owned" / "EQUIP" / price.
- Buying deducts coins, adds to `purchasedSkins`, **auto-equips**.
- Equipping calls `Game.applySkin()` → `BallEntity.setSkinColor()`.
- Shop is DOM overlay (`#shop-overlay`), not 3D.

---

## 13. Input (`systems/InputSystem.ts`)

Pointer events on canvas + start screen + UI overlay:
- **Blocked** when: page hidden (`game-paused`), shop open, pointer on shop
  button, reset cooldown (500ms after continue), game-over open.
- Not started → `onGameStart()`; waiting for tap → `onFirstJump()`.
- Otherwise **drag**: record `startClientX`/`startTarget`, then
  `xTarget = clamp(startTarget + (clientX − startClientX) × −0.028, −5, 5)`.
- Note the **−0.028 inversion** and the ±5 clamp — both faithful to the original.

---

## 14. Persistence (`managers/PersistenceManager.ts`)

- Key: `localStorage["hop_player_data"]`, JSON of `PlayerData`.
- `load()` → `sanitizePlayerData()` (fills missing fields, forces `"default"`
  into `purchasedSkins`, validates theme/skin).
- `merge(base, incoming)` → keep max coins/best score, union skins, prefer
  incoming theme/skin — mimics the original cloud-merge.
- `save()` sanitizes again, then applies DEBUG overrides (`infiniteCoins`,
  `unlockAllSkins`) before writing.
- Backend is behind the `SaveBackend` interface — swap in a cloud backend later
  without touching the rest.
- Saved on: coin collect, game over, skin buy/equip, theme toggle.

---

## 15. Audio (`systems/AudioSystem.ts`)

100% procedural — no assets. Lazy AudioContext, resumed on first user gesture,
suspended when tab hidden.

| Event | Sound |
|-------|-------|
| jump | sine `440 + (score%8)×30` (0.12s) + same ×1.5 (0.08s) |
| coin | 880 → 1100 → 1320 Hz ascending |
| perfect | base `660 + min(streak,10)×60`, arpeggio ×1.25, ×1.5, ×2 (streak≥3) |
| game over | sawtooth 200 Hz + square 150 Hz (detune −50) |

`playTone(freq, duration, type, gain, detune)` is the building block for new sounds.

---

## 16. Effects (`systems/EffectsSystem.ts`)

- **Jump dust** — 5–6 white spheres + outlines, expand + fade 0.3–0.4s, gravity.
- **Perfect hit** — diamond pulse (opacity yoyo + scale 1.8 yoyo), expanding
  gold ring (`6 + streak×0.5`), gold screen flash
  (`rgba(255,215,0, min(0.15+streak×0.03, 0.35))`), 8-gold-burst (streak ≥ 3),
  score elastic pop.
- **Speed lines** — spawn when intensity > 0, batch `1 + floor(intensity×3)`,
  interval `0.03 / max(0.1, intensity)`, max 30.
- **Confetti** — 60 pieces, 7 colors, on new best score (DOM, GSAP).

---

## 17. UI & DOM (`index.html` + `src/ui/UIManager.ts`)

All UI is HTML/CSS in `index.html` (no canvas UI). Key elements:

| id | Purpose |
|----|---------|
| `#splash-screen` | Boot splash (fades out via main.ts) |
| `#start-screen` | Logo, best score (👑), theme toggle, drag hint, shop button |
| `#score` | Big center score during play |
| `#coin-counter` | Top-right coin count during play |
| `#gameover-screen` | Score, best, NEW BEST!, +round coins, total count-up, continue → |
| `#shop-overlay` | Ball shop (rendered by `renderShop()`) |
| `#confetti-container` | Confetti pieces |

- Font: **Fredoka** (Google Fonts) for buttons/UI + 'Arial Black' for score.
- Theme toggle button icon shows the theme you *switch to* (☾ on light).
- Continue button is debounced 500ms (via `InputSystem.beginResetCooldown()`).
- Game-over total coins count up: duration `min(0.8 + roundCoins×0.05, 2)`s, 0.4s delay.

Assets in `public/`: `Logo.png` (~288px), `splash.png` (512×512), `Coin.png`,
`cart.png`, `indicator.png` (all 64×64). References are relative (`./assets` at
build time via `import.meta.env.BASE_URL` — actually `public/` files are copied
to `dist/` root and referenced directly, e.g. `src="Coin.png"`).

---

## 18. Debug Tools

### `window.gameDebug` (dev console, always exposed by `main.ts`)
```js
window.gameDebug.setScore(100)          // set score immediately
window.gameDebug.giveCoins(500)         // add coins
window.gameDebug.unlockAllSkins()       // grant every skin
window.gameDebug.toggleInvincible()     // skip the failure check
```

### `GAME_CONFIG.DEBUG` (config flags)
`enabled` (default false), `showHitboxes`, `showFPS`, `invincible`,
`unlockAllSkins`, `infiniteCoins`. NOTE: `DEBUG.enabled` flag is not itself
read by the game code — the individual flags are. `unlockAllSkins` and
`infiniteCoins` are applied inside `PersistenceManager.save()`.

---

## 19. Tests (`tests/`)

33 unit tests, all against the verified spec:
- `config.test.ts` (9) — every `GAME_CONFIG` constant equals the verified value.
- `mechanics.test.ts` (11) — difficulty curves, scoring, streak bonus math.
- `state.test.ts` (13) — `sanitizePlayerData`, `mergePlayerData`, economy
  (buy/equip/owns), persistence round-trip.

**Run `npm run test` after any change to config or logic.** The config tests
will fail loudly if you break a verified constant — if you intentionally change
one, update the corresponding test too.

---

## 20. Customization Cheat-Sheet (start here)

| I want to… | Edit |
|------------|------|
| Change game difficulty/pacing | `GAME_CONFIG`: jump duration, spacing, x-range, size, thresholds (§7) |
| Add/change skins | `GAME_CONFIG.SHOP_SKINS` (id/name/color/price) |
| Change platform colors | `GAME_CONFIG.COLOR_PALETTES`, `COLOR_CYCLE_STEPS` |
| Add a theme | `Themes.ts` `THEMES` + `ThemeName` type (`Record` keys) |
| Change dot/shader look | `GAME_CONFIG.DOTS_*` or GLSL patch in `MaterialFactory` |
| Change sound | `AudioSystem.ts` presets / `playTone()` params |
| Change effects (particles, confetti, speed lines) | `EffectsSystem.ts` top constants + `CONFETTI_COLORS` |
| Change UI text/layout/colors | `index.html` (all strings + CSS inline) |
| Change fonts | `index.html` Google Fonts `<link>` + `font-family` rules |
| Replace art | `public/` png files (keep filenames or update refs) |
| New game mode / rule change | `GameStateManager` formulas + `Game.jump()` landing logic |
| New platform type (moving, breakable…) | `PlatformEntity.create()` / `PlatformManager.recycle()`, hook into `Game.jump()` |
| Change scoring/economy | `GameStateManager` scoring + `Game.jump()`/`collectCoin()` |
| Cloud save later | Implement `SaveBackend` in `PersistenceManager.ts` |
| Rebrand | `<title>` + logo/splash in `index.html` |

**Golden rules:**
1. Config lives in `GameConfig.ts` — prefer adding constants there over hardcoding.
2. After editing, run `npm run typecheck` and `npm run test`, then `npm run build`.
3. If you change a verified constant, update the matching `tests/config.test.ts` assertion.
4. `GameStateManager` is the only "logic" layer — keep three.js/DOM out of it so
   tests stay fast and pure.
5. The ball material is re-tinted via `setSkinColor()` — no re-compile, cheap.

---

## 21. Gotchas & Notes (from the original RE work)

- `PLATFORM_X_RANGE_RAMP` is **0.02** (docs previously claimed 0.00002) — at
  score 90 the x-range already caps at 3.0.
- `swayOffset` is always 0 in the shipped build — platforms never sway
  (the field exists as a hook for future platform types).
- `EventBus` + `GAME_EVENTS` exist in `core/EventBus.ts` but no system uses
  them yet — systems call each other directly via `Game`. It's a ready-made
  hook for your own decoupling.
- Drag is **inverted** (−0.028) — don't "fix" it without updating the feel docs.
- Two taps to start (run start, then first jump) — a deliberate faithful quirk.
- Audio context can only start after a user gesture — `wireVisibility()`
  resumes on any pointerdown.
- `dist/` is the built output of `npm run build`; don't edit it by hand.
- The game has no ad / SDK integration (original used YouTube Playables) —
  Continue always resets locally.


