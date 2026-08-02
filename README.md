# HOP

A faithful, standalone, fully-customizable reimplementation of the **BounceTiles**
arcade game (YouTube Playables), rebuilt from scratch in TypeScript based on exact
constants reverse-engineered from the original minified bundle.

- **No YouTube SDK** — runs anywhere (localhost, static hosting, itch.io, etc.)
- **Persistence** via `localStorage` (`hop_player_data`)
- **Verified against the original** with unit tests + side-by-side browser comparison

---

## Quick Start

```bash
npm install
npm run dev        # dev server (http://localhost:3000)
npm run build      # typecheck + production build to dist/
npm run preview    # serve the production build
npm run test       # run vitest unit tests
npm run typecheck  # tsc --noEmit
```

Open the game, tap to start, drag horizontally to aim, keep bouncing onto the
next platform. Land on the center diamond for **PERFECT** bonus points, collect
golden **gems** for coins, and spend coins on **ball skins** in the shop.

---

## Project Structure

```
HOP/
├── index.html               # Full HTML/CSS UI (faithful to the original)
├── src/
│   ├── main.ts              # Bootstrap + window.gameDebug helpers
│   ├── Game.ts              # Coordinator: loop, jump, game-over, reset
│   ├── config/
│   │   ├── GameConfig.ts    # ALL verified constants, skins, palettes
│   │   └── Themes.ts        # Light/dark themes + decoration colors
│   ├── core/
│   │   ├── Types.ts         # PlayerData / GameState / JumpParams
│   │   ├── EventBus.ts      # Lightweight pub/sub
│   │   └── GameStateManager.ts  # Difficulty math, scoring, economy, sanitize
│   ├── systems/
│   │   ├── RendererSystem.ts    # Renderer, scene, fog, lights, FOV
│   │   ├── MaterialFactory.ts   # Halftone-toon shader (tri-planar dots)
│   │   ├── CameraController.ts  # Follow + dead-band + shake
│   │   ├── ShadowSystem.ts      # Ground shadow under ball
│   │   ├── InputSystem.ts       # Drag-to-aim, tap-to-jump, UI guards
│   │   ├── AudioSystem.ts       # Procedural WebAudio sounds
│   │   ├── EffectsSystem.ts     # Dust, perfect fx, speed lines, confetti
│   │   └── BackgroundSystem.ts  # 10 rock clusters (bob + recycle)
│   ├── entities/
│   │   ├── BallEntity.ts        # Ball mesh/outline/blob + jump tweens
│   │   └── PlatformEntity.ts    # Platform + diamond + ring + gem coins
│   ├── managers/
│   │   ├── PlatformManager.ts   # 6-slot pool, recycling, difficulty
│   │   └── PersistenceManager.ts# localStorage save/load/sanitize
│   └── ui/
│       └── UIManager.ts         # Start/gameover/shop overlays, score, theme
├── tests/
│   ├── config.test.ts           # Constant verification (9 tests)
│   ├── mechanics.test.ts        # Difficulty curves + scoring (11 tests)
│   └── state.test.ts            # Sanitize/merge/economy (13 tests)
├── docs/
│   ├── ARCHITECTURE.md          # Verified spec: configs, colors, class/function maps
│   ├── GAME_MECHANICS.md        # Verified behavior + full function map
│   ├── CUSTOMIZATION_GUIDE.md   # How to extend/tweak the game
│   └── shots/                   # Side-by-side verification screenshots
└── CHECKLIST.md                 # Project journal + verification log
```

---

## Verification

- **33 unit tests** across 3 files assert every config constant and the difficulty
  curves / scoring / economy / persistence logic match the reverse-engineered spec.
- **Side-by-side browser comparison** vs the original (run via a local `ytgame`
  stub) confirmed identical start screen, gameplay loop, shop, game-over screen,
  theme toggle, and coin economy. Screenshots in `docs/shots/`.

---

## Customization

Everything is data-driven. See `docs/CUSTOMIZATION_GUIDE.md` for details.

- **Difficulty & feel** — edit the constants in `src/config/GameConfig.ts`
  (jump duration, platform spacing, x-range, bounce height, gem chance, ...).
- **Skins & colors** — edit `SHOP_SKINS` in `GameConfig.ts` and `THEMES` in `Themes.ts`.
- **The halftone-toon shader** — `MaterialFactory.ts` (dot size, strength, shadow band).
- **Audio** — `AudioSystem.ts` presets (freqs, envelopes, waveforms).

### Debug helpers (dev console)

```js
window.gameDebug.setScore(100)          // jump to a score
window.gameDebug.giveCoins(500)         // add coins
window.gameDebug.unlockAllSkins()       // unlock everything
window.gameDebug.toggleInvincible()     // never miss (DEBUG.invincible)
```

---

## License

MIT. The original game is © its respective owner; this is an independent,
fan-made reimplementation for learning/portfolio purposes.
