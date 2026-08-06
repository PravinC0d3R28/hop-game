# HOP — Master Checklist

> Project journal + task tracker. Updated after every phase.
> Source of truth for what was done, what was verified, and what's next.

**Mission**: Reverse-engineer `BounceTiles` (YouTube Playables arcade game) into a
standalone, fully-customizable TypeScript reimplementation named **HOP**.

**Source**: `C:\Users\Poonam\Desktop\YTGames\BounceTiles\` (original download + docs)
**Target**: `C:\Users\Poonam\Desktop\YTGames\HOP\`
**Status**: COMPLETE — all phases done, ready for customization

---

## ✅ Phase 0 — Reverse Engineering (COMPLETE)

- [x] Located original game files (`BounceTiles/index.html`, `index-zMHsYNx1.js`)
- [x] Decompiled minified bundle; isolated the ~24.5KB game code from Three.js+GSAP libs
- [x] Extracted the exact `j` config object (all 40+ constants) verbatim
- [x] Decoded all colors (ball, coin, palettes, skins, themes, decorations) to hex
- [x] Mapped every minified identifier (`fr`→SphereGeometry, `ve`→Mesh, etc.)
- [x] Reverse-engineered: jump auto-chain, physics, platform recycling, scoring,
      perfect/coin mechanics, camera, shader, background, particles, speed lines,
      audio, shop, persistence, themes, game-over flow, splash/start flow
- [x] **Found + corrected 7 documentation errors** (see `docs/GAME_MECHANICS.md §14`):
      `PLATFORM_X_RANGE_RAMP` (0.02 not 0.00002), ball/coin colors, palettes,
      diamond indicator, no-sway, skin colors green/cyan
- [x] Verified previous `deprecated/HOP` was inaccurate → **decision: rebuild fresh**

### Key decisions (user-approved)
1. Build approach: **Rebuild from scratch in TypeScript** (no reuse of deprecated code)
2. Platform: **Pure standalone** (no YouTube SDK; localStorage persistence)
3. Verification: **Both** unit tests AND side-by-side browser comparison

---

## 🔨 Phase 1 — Scaffolding & Docs (COMPLETE)

- [x] Created folder tree (`src/{config,core,systems,entities,managers,ui}`, `docs`, `tests`, `assets`)
- [x] Copied 5 assets from original (Logo, splash, Coin, cart, indicator)
- [x] `package.json` (three r152, gsap 3.14.2, vite 5, vitest 1.6, typescript 5.4)
- [x] `tsconfig.json` (strict)
- [x] `vite.config.ts` (base './', chunk splitting, vitest config)
- [x] `docs/ARCHITECTURE.md` — verified spec (configs, colors, class map, shader, functions)
- [x] `docs/GAME_MECHANICS.md` — verified behavior (states, physics, scoring, effects)
- [x] `docs/CUSTOMIZATION_GUIDE.md` — extension surface

---

## 🛠 Phase 2 — Implementation (COMPLETE)

### 2a. Core infrastructure
- [x] `src/config/GameConfig.ts` — verified constants, skins, palettes, localization, debug
- [x] `src/config/Themes.ts` — light/dark themes + decoration colors
- [x] `src/core/Types.ts` — shared interfaces/types
- [x] `src/core/GameStateManager.ts` — physics/difficulty math + player data
- [x] `src/core/EventBus.ts` — pub/sub event system

### 2b. Rendering
- [x] `src/systems/RendererSystem.ts` — renderer/scene/camera/fog/lights
- [x] `src/systems/MaterialFactory.ts` — halftone-toon shader + procedural textures
- [x] `src/systems/CameraController.ts` — follow, dead-band, shake, lookAt
- [x] `src/systems/ShadowSystem.ts` — ground shadow (scale/opacity by height)

### 2c. Entities & managers
- [x] `src/entities/BallEntity.ts` — ball group (mesh, outline, blob), jump tweens
- [x] `src/entities/PlatformEntity.ts` — platform group (box, outline, diamond, ring, coins)
- [x] `src/managers/PlatformManager.ts` — 6-slot pool, recycling, difficulty
- [x] `src/managers/PersistenceManager.ts` — localStorage save/load/sanitize

### 2d. Systems & UI
- [x] `src/systems/InputSystem.ts` — drag-aim, tap-to-jump, button guards
- [x] `src/systems/AudioSystem.ts` — procedural WebAudio presets
- [x] `src/systems/EffectsSystem.ts` — dust, perfect flash/ring/burst, confetti, FPS
- [x] `src/systems/BackgroundSystem.ts` — 10 rock clusters, bob, recycle
- [x] `src/ui/UIManager.ts` — start/gameover/shop overlays, score/coin/best, theme

### 2e. Coordinator & entry
- [x] `src/Game.ts` — orchestrates all systems, jump sequence, game-over, reset
- [x] `src/main.ts` — bootstrap + debug helpers
- [x] `index.html` — full HTML/CSS (faithful to original, standalone)
- [x] `npm install` succeeds

### 2f. Bug fixes during integration
- [x] `PlayerData.purchasedSkins` array shared across instances (shallow copy) → deep-copy in GameStateManager
- [x] `PersistenceManager.load()` returned raw `{}` (no `purchasedSkins`) → always sanitize
- [x] UIManager constructed before `background` existed → reordered Game constructor
- [x] `#theme-icon` was class-only → added id to match UIManager lookup

---

## 🧪 Phase 3 — Verification (COMPLETE)

### 3a. Automated
- [x] `tests/config.test.ts` — assert every constant matches verified spec (9 tests)
- [x] `tests/mechanics.test.ts` — jump duration, spacing, xRange, scale, speedIntensity (11 tests)
- [x] `tests/state.test.ts` — perfect streak, coin earn, skin buy/equip, sanitize (13 tests)
- [x] `npm run typecheck` passes
- [x] `npm run test` passes (33 tests, 3 files)
- [x] `npm run build` produces `dist/`

### 3b. Browser side-by-side
- [x] Run original `BounceTiles/index.html` in browser (ytgame stub at `%LOCALAPPDATA%\Temp\opencode\original_run\`)
- [x] Run new HOP via `vite preview` (port 4173) / original via python http (port 4174)
- [x] Screenshot start screen (theme, layout) — compare → identical DOM (Logo, 👑 best, ☾, hint, shop)
- [x] Screenshot gameplay (platforms, ball, coins) — compare → both auto-chain; original 23, HOP 56
- [x] Screenshot shop overlay — compare → 9 items, same names/prices/footer, identical
- [x] Screenshot game-over screen — compare → SCORE/NEW BEST/coins/total all match
- [x] Functional test: drag-aim, jump chain, perfect flash, coin collect, fail, continue → all pass
- [x] Screenshots saved to `docs/shots/` (00-original-*, 01-start, 02-gameplay, 03-gameover)

### 3c. Verified parity details
| Check | Original | HOP |
|---|---|---|
| Start screen structure | ✓ | ✓ identical |
| Game-over "NEW BEST" logic | shows when score > best | ✓ same rule |
| Coins round/total + count-up | +3 / 3 | +8 / 13 |
| Shop 9 skins (names, prices, "???", footer) | ✓ | ✓ identical |
| Theme toggle ☾→☀ + dark bg | ✓ | ✓ identical |
| Persistence across reload | cloud (stub) | localStorage `hop_player_data` ✓ |

---

## 📦 Phase 4 — Delivery (COMPLETE)

- [x] `README.md` — quick start, structure, customization summary
- [x] Final checklist review
- [x] Hand-off summary to user (what to customize next)

---

## 📓 Research Notes (context preservation)

### Discrepancies found vs old docs (all corrected)
1. `PLATFORM_X_RANGE_RAMP`: docs `0.00002` → actual `0.02`
2. `COLOR_BALL`: docs `0xD119F0` → actual `0xD0D8F0` (same as "Classic" skin)
3. `COLOR_COIN`: docs `0xF0E68C` → actual `0xF0C020`
4. Palettes: docs had warm set → actual 8 pastel `{base,light}` pairs
5. Perfect indicator: docs "dot + ring" → actual **diamond** `ShapeGeometry` + ring
6. Platform "sway": docs describe sway animation → actual `swayOffset` always 0
7. Skin colors: green `0x45A848`→`0x44FF88`, cyan `0x44FFAF`→`0x44FFFF`

### Verified color tables (hex)
- BG `0x2A2A2A` | Ball `0xD0D8F0` | coin `0xF0C020` | Outline `0x111111`
- Light theme: bg `0xE8DDD0`, shadow `0xB8A898`, icon ☾
- Dark theme: bg `0x2A2A2A`, shadow `0x1A1A1A`, icon ☀
- Decoration light: `0xB8C8D8, 0xC0D0E0, 0xB0C0D0, 0xC8D8E8`
- Decoration dark: `0x444455, 0x3A3A4A, 0x4A4A5A, 0x505060`
- Perfect/burst gold `0xFFD700`; confetti 7 colors listed in mechanics doc

### Class map (minified → Three.js)
`hr`=BoxGeometry, `fr`=SphereGeometry, `Ac`=**CylinderGeometry** (coins = coins), `Ja`=RingGeometry,
`Ks`=CircleGeometry, `Rc`=ShapeGeometry, `wf`=Shape, `Tn`=MeshBasicMaterial,
`Pc`=MeshToonMaterial, `ve`=Mesh, `Mi`=Group, `E_`=AmbientLight, `y_`=DirectionalLight,
`Tc`=Fog, `Im`=Scene, `Mn`=PerspectiveCamera, `MS`=WebGLRenderer, `Vt`=Color,
`U`=Vector3, `kn`=MathUtils, `re`=gsap, `b_`=Clock, `Mf`=CanvasTexture

### Function map (minified → purpose)
Listed in full in `docs/ARCHITECTURE.md §6`.


