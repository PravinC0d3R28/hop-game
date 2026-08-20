# HOP — Current Feature Inventory

> **What this is:** the complete, accurate list of everything implemented in HOP
> right now. Unlike `docs/REFERENCE.md` (which describes the pre-overhaul base
> game), this file is maintained against the live code. If a feature is listed
> here, it exists in `src/` today. Verify with `npm run typecheck` +
> `npm run test` (172 tests across 12 files).
>
> Related docs: `GAME_MECHANICS.md` (exact formulas), `REQUIREMENTS.md` (overhaul
> spec), `IMPLEMENTATION_PLAN.md` (iteration history), `DEV_COMMANDS.md`
> (debug helpers), `CUSTOMIZATION_GUIDE.md` (tuning surface), `LOADING_AND_TUTORIAL.md`
> (onboarding design).

---

## 1. Core Loop (faithful to the original BounceTiles)

- **One-action start.** Pressing Play hides the menu and, after a short
  anticipation beat (`FIRST_JUMP_ANTICIPATION`, 0.4s), fires the first jump
  automatically — a tap inside that window cancels the auto-fire and jumps
  immediately. The auto-chain then runs forever until a miss. (The first-run
  tutorial keeps its explicit tap-to-start — the guide owns the teaching.)
- **Drag-to-aim.** Drag horizontally while the ball is in the air to steer.
  Sensitivity is **inverted** (`xTarget = startTarget + dx * -0.028`, clamped ±5)
  — faithful to the original, do not "fix".
- **Auto-jump chain.** Each landing triggers the next jump automatically.
- **Scoring.**
  | Event | Score | Notes |
  |---|---|---|
  | Land on platform | +1 | |
  | Perfect (land within 0.5 of center diamond) | +streak bonus | streak = 1,2,3…; non-perfect resets it |
  | Collect a coin (within 0.8) | +1 | +1 coin to wallet |
  | Miss (|offset| > 1.1) | game over | |
- **Endless difficulty ramps** (bind to *tier score*, see §2): jump duration
  0.5→0.35, platform spacing 3.5→4.5, x-range 1.2→3.0, platform scale 1.0→0.9,
  speed lines turn on past score 15.
- **Juice:** squash/stretch on jump, landing squash, jump dust, score elastic pop,
  perfect ring + gold flash + 8-burst (streak ≥ 3), speed lines, confetti on
  new best.

## 2. Worlds (3 selectable play spaces)

| World | Id | Unlock (lifetime total) | Gate offset | Sway |
|---|---|---|---|---|
| Sunrise Peaks | `sunrise` | 0 (always) | 0 | none |
| Dusk District | `dusk` | 1,000 | 100 | amp 0.6 / speed 1.6 / 1-in-3 static |
| Deep Void | `void` | 5,000 | 250 | amp 0.9 / speed 2.4 / 1-in-4 static |

- **Selection, not run gates.** A run never changes worlds mid-flight. You pick
  the world on the start screen; the choice persists (`selectedWorld`).
- **Sawtooth difficulty.** Ramps bind to `tierScore = max(0, runScore − gateOffset)`,
  so each world matches the old mid-run bands while every run starts at 0.
- **Per-world ramp overrides** in `Worlds.ts` (x-range, spacing, jump duration,
  size).
- **Swaying platforms** (Dusk + Void): `sin(t·speed + index·1.7)·amp`, de-phased
  per index; the hit-check consumes the shifted position so sway affects landing.
- **World nav** on the start screen: back/next arrows (center-left/right,
  vertically centered), labeled `World N` once unlocked (else `???`), a green ▶
  when unlocked, a lock + threshold when locked. Nav reveals at 250 lifetime
  score. `world-far` = "coming soon" teaser for a 4th slot.
- **Locked-world flow:** clicking a locked arrow "loads" ~350ms then shows a
  **gaussian-blur lock overlay**: name hidden as `????`, description, unlock
  progress bar, points remaining. Back arrow stays usable above the blur; menu
  buttons fade out; a "too easy?"-style thought bubble occasionally taunts near
  the locked arrow.
- **Unlock celebration:** when a world unlocks, a gold **unlock dialog** with a
  **SHOW ME** button (launches the intro/spotlight for the new world) + confetti.
- **Per-world flag palettes** (`FLAG_WORLD_PALETTES`): the failure flag inherits
  each world's mood (sunrise warm, dusk rose, void neon).
- **Per-world bests** (`bestPerWorld[3]`) and **per-world best streaks**
  (`bestStreakPerWorld[3]`).

## 3. Meta-Progression (lifetime ledger)

- **`totalScore`** — lifetime score, banked **exactly once per game over** (not
  per retry, not mid-run). Drives world unlocks and lifetime missions.
- **Ledger bar** on the start screen: `Total X / 5,000` with percent.
- **Unlocks are derived** from `totalScore` at runtime — never stored as flags.
- **Stats overlay** (`#stats-btn`): runs played, total score, total coins,
  total perfects, best streak, best streak per world, worlds unlocked.
- **Persistence** is backwards-compatible: sanitize-first load + merge = max
  (never sum). Save key `hop_player_data` (production) / `hop_dev_player_data`
  (dev mode).

## 4. Streak Tiers & Shield

- **Streak 3+:** gold 8-particle burst + ring + flash (existing perfect juice).
- **Streak 10 (`STREAK_FIRE`):**
  - **FIRE banner** (DOM) + screen **fire overlay** (`FireOverlay`, 2D canvas:
    bottom flame band, embers, heat vignette, burst flash + shockwave ring on
    each fresh 10) + **3D ball burst** (~30 additive flame/ember particles,
    shockwave ring, flash pop).
  - **Shield grant** (once per run) — *only if the shield is unlocked*:
    lifetime `totalScore ≥ 1000` (World-2 milestone) or `DEBUG.unlockAllWorlds`.
- **Shield:** a glowing ring mesh around the ball while active. On the first
  miss it **absorbs the hit** (no game over), plays a shield-break effect, and
  deactivates. Never stacks; resets per run. A one-time **shield card dialog**
  explains it on first arrival at World 2.

## 5. Missions

Three kinds (config: `src/config/Missions.ts`):

- **General (daily):** 5 per day (2 easy + 2 medium + 1 hard) drawn round-robin
  from a 30-mission pool (10/10/10) — consecutive days are disjoint, full pool
  cycles with no repeats. Resets at **local midnight**; the DAILY tab shows a
  live `HH:MM:SS` countdown.
- **World:** 3 per world (9 total), sized for each world's run band. Only the
  **selected** world's missions bank progress; other worlds' rows show lock
  tooltips ("Play in <world>…" vs "Unlocks at <N>…"). Locked worlds never fill.
- **Lifetime:** 6 persistent missions from lifetime counters
  (`totalScore`, `totalCoinsCollected`, `totalPerfects`, `bestStreak`).

Semantics:
- Progress is **session-based**: general/world accumulate across runs in the
  persisted `missionProgress` map, capped at target, complete **once**.
- **Streak is a max, not a counter** — two runs of 10 ≠ 20.
- Completion shows a **mission toast** (white bullseye card, top-right, FIFO)
  and marks the row with a **gold check** + full bar + one-time confetti.
- **Claim** rewards in the missions overlay (3 tabs: General / World / Lifetime)
  to bank coins into the wallet.
- The missions button unlocks after `MISSIONS_UNLOCK_RUNS = 3` runs (the
  unlocking run itself doesn't bank progress).

## 6. Onboarding (loading + tutorial)

- **Branded flash screen:** config-driven wordmark + descriptor + studio footer
  (`GAME_CONFIG.BRANDING`), shown ~1.5s first visit / ~0.9s returning,
  tap-to-skip. Fades to the start screen.
- **Start-screen attract demo:** the ball auto-hops **forever** behind the menu
  (muted audio, dimmed world, recycling runway). Menu touches never stop it; a
  world switch re-seeds it from tile 0. **Locked worlds never demo** (no
  difficulty spoilers). Stops when a real run starts, restarts on reset.
- **First-run guided tutorial** (one-shot, `tutorialDone` persisted):
  - 5 teaching hops at **0.4× speed**, each teaching one lesson:
    1. "tap to hop" — target ring on the diamond + down-arrow
    2. "drag left!" — next tile forced to a left lane, drag arrow resolved in
       screen space (locked per target tile)
    3. "drag right!" — forced right lane
    4. "drop on the diamond!" — perfect-dot emphasis
    5. "collect the coins!" — tile guaranteed to carry a coin
  - 5 **ramp hops** ease the time scale back to 1.0× (full speed).
  - Teaching-hop **retry loop**: a miss respawns to the start tile with a
    rotating "try again" caption (~4.5s or tap-through); steering is ignored
    while re-armed. Ramp-hop misses are a real game over.
  - Handover: "keep hopping!" pill after hop 10; the run continues seamlessly
    and counts as run 1.
- **One-action Play anticipation:** normal runs fire their first jump
  automatically after `FIRST_JUMP_ANTICIPATION` (0.4s) — a wind-up squash sells
  the "ready… go!" beat, and a tap during the window jumps immediately instead.
- **Spotlights / callouts** (all gated on `tutorialDone`): world-unlock
  spotlight (dim + ring + card), new-missions spotlight, best-score callout,
  first-dusk "can you win here?" callout, "coming soon" world-far teaser.

## 7. Failure Sequence & the Failure Flag (Iterations 12–13)

On a miss:
1. **Camera shake**, game-over sound, speed lines cleared.
2. **Ball sinks** 10 units over 0.7s (`ballFallDistance/Duration`), scale → 0.5.
3. **Failure flag** (`GAME_CONFIG.FAIL_FLAG.enabled`): a full 3D red marker
   planted on the missed platform —
   - **Falls immediately** at the miss (`dropDelay = 0`, `dropDuration = 0.3`),
     **bound to nothing** (not the ball sink, not the game-over screen).
     Starts 7 units up (`dropHeight`), slams at ~0.3s.
   - **Model:** tapered raw-wood stake (4-seg cylinder, 1.2× thick at top),
     gold finial knob, triangular pennant cloth with a **traveling vertex wave**
     (flutter) + Phong specular glint. World-scale × `flag.scale / platform.baseScale`
     so it never shrinks with a small tile.
   - **Per-world palette** (sunrise/dusk/void).
   - **Crater debris:** 14 cube chips (0.12³) thrown in a ring around the pole
     base, resting on the tile top — each in the **platform's live material
     color** (dynamic).
   - **Flying debris:** 12 cube chips (0.12³) launched upward in world space,
     also platform-colored.
   - **Impact shake** (stronger than the game-over shake).
4. **Game-over overlay** (after 600ms): score, per-world best, `NEW BEST!` +
   confetti, world reached, `PLAY AGAIN` button (debounced 500ms).

## 8. Shop

- **9 skins** (`SHOP_SKINS`), prices 0–200 coins: Classic (free), Ruby Red 50,
  Ocean Blue 50, Emerald 75, Golden 100, Violet 100, Bubblegum 125,
  Cyber Cyan 150, Shadow 200.
- Buy (deducts coins + **auto-equips**), equip, owns. Preview circle shows the
  skin color; names show `???` until owned.
- DOM overlay (`#shop-overlay`), coin footer shows wallet. Sales badge on the
  shop button when something is affordable-but-unowned.

## 9. Settings

- **Sound volume** slider (0–100, drives all procedural SFX live).
- **Music volume** slider (0–100 — channel reserved for a future track, only
  persists for now).
- **Sensitivity** slider (0–100, 50 = original feel) + **reset** button.
- All persisted via the normal save path.

## 10. Audio (100% procedural WebAudio)

| Event | Sound |
|---|---|
| jump | sine `440 + (score%8)·30` + octave |
| coin | 880 → 1100 → 1320 Hz ascending |
| perfect | `660 + min(streak,10)·60` arpeggio (×1.25/×1.5/×2 at high streaks) |
| mission complete | short success chime |
| milestone | streak-10 fanfare |
| shield break | burst/glass |
| game over | sawtooth 200 Hz + square 150 Hz (detuned) |

- Lazy `AudioContext`, resumed on first user gesture, suspended when the tab is
  hidden. `AUDIO_ENABLED` master switch.

## 11. Rendering & Environment

- Three.js r152, WebGL, GSAP 3.14. Halftone-toon shader: tri-planar dot
  sampling + 4-step toon gradient + shadow-dot mask (`MaterialFactory`).
- Camera: follow with ±0.5 dead-band, positional lerps, FOV widens on portrait
  (`55 + (1−aspect)·30`), game-over shake.
- Blob shadow under the ball (scales/fades with height).
- 10 background rock clusters (bob + recycle), themed decoration colors.
- Platform palette cycling: 8 pastel `{base, light}` pairs, cycle every 12
  platforms, random start per run.

## 12. Persistence & Saves

- `localStorage["hop_player_data"]` (production), `hop_dev_player_data` (dev).
- `sanitizePlayerData()` on load (defaults, clamps, coerce), `mergePlayerData`
  = **max per field** (union skins), write-on-change.
- Saved on: coin collect, game over (banked once), skin buy/equip, theme,
  settings change, world selection, mission claim.
- `PlayerData` includes: coins, best score, skins, theme, `totalScore`,
  `bestPerWorld[]`, lifetime counters (`totalCoinsCollected`, `totalPerfects`,
  `bestStreak`, `bestStreakPerWorld[]`, `runsPlayed`, `totalCoinsEarned`),
  settings (sound/music/sensitivity), onboarding flags (`tutorialDone`,
  `revealedWorlds[]`, `shieldCardSeen`, `worldSpotlightSeen[]`,
  `missionsSpotlightSeen`, `firstDuskCalloutSeen`, `missionsUnlockSeen`),
  missions (`completedMissions[]`, `claimedMissions[]`, `missionProgress`),
  and `selectedWorld`.

## 13. Debug / Dev Surface

- **Dev mode** (vite dev server, `npm run dev:dev`, or `?dev=1`): save isolated
  under `hop_dev_player_data`. **6.4 gate:** `window.gameDebug` is exposed only
  in dev *builds* (`import.meta.env.DEV` or `VITE_DEV_MODE=true`) — production
  builds ship without it; `?dev=1` never enables debug on a portal build.
- **`window.gameDebug` helpers:** `setScore`, `setTotalScore`, `giveCoins`,
  `unlockAllSkins`, `toggleInvincible`, `unlockAllWorlds`, `forceWorld`,
  `straightLane`, `noSway`, `hitboxes`, `reseedRunway`, `completeAllMissions`,
  `claimAllMissions`, `triggerWorldCallout`, `resetProgress`, `ballPos`,
  `coins`. (Full table in `docs/DEV_COMMANDS.md`.)
- **`GAME_CONFIG.DEBUG` flags:** `enabled`, `invincible`, `unlockAllSkins`,
  `infiniteCoins`, `unlockAllWorlds`, `forceWorld`, `straightLane`, `noSway`,
  `showFPS`, `showHitboxes`.
- **Test tip:** `Math.random = () => 0.5` forces straight deterministic lanes.

## 14. Test Suite (12 files, 172 tests)

| File | Tests | Covers |
|---|---|---|
| config.test.ts | 9 | verified constants |
| mechanics.test.ts | 11 | difficulty curves + scoring |
| state.test.ts | 22 | sanitize/merge/economy/missions state |
| difficulty.test.ts | 15 | sawtooth ramps per world |
| worlds.test.ts | 12 | unlock thresholds, selection, tier math |
| platforms.test.ts | 15 | sway, recycling, hitboxes |
| streak.test.ts | 10 | streak tiers + shield |
| missions.test.ts | 35 | daily pool, banking, claims, semantics |
| progression.test.ts | 18 | ledger, mission rows, countdown |
| persistence.test.ts | 11 | save/load/merge round-trips |
| effects.test.ts | 11 | perfect fx, speed lines, failure flag, debris |
| audio.test.ts | 3 | procedural presets |

---

## Key files (quick map)

| Concern | File |
|---|---|
| All tunables | `src/config/GameConfig.ts` |
| World configs | `src/config/Worlds.ts` |
| Mission pool + daily logic | `src/config/Missions.ts` |
| Themes | `src/config/Themes.ts` |
| Pure game logic (difficulty, economy, shield, missions, save) | `src/core/GameStateManager.ts` |
| Pure world logic | `src/core/WorldLogic.ts` |
| Progression derivation | `src/core/Progression.ts` |
| Coordinator / loop / tutorial / demo | `src/Game.ts` |
| All DOM UI | `src/ui/UIManager.ts` + `index.html` |
| Effects + failure flag + fire | `src/systems/EffectsSystem.ts`, `FireOverlay.ts` |
| Audio | `src/systems/AudioSystem.ts` |
| Input | `src/systems/InputSystem.ts` |
| Persistence | `src/managers/PersistenceManager.ts` |
