# HOP — Overhaul Brainstorm

Working document for the full overhaul of the game. Purpose: capture the
direction ideas, weigh all options, and decide on a final pick. This is a
**brainstorming aid**, not a spec — the "Open Decisions" section at the end is
meant to be filled in during the next session.

Status: ✅ **Decisions locked** — see §11 (Locked V1 Plan)

---

## 0. Current Game (Baseline)

**What it is:** HOP — a faithful, standalone reimplementation of the
*BounceTiles* arcade game (YouTube Playables), rebuilt in TypeScript with
Three.js + GSAP. No SDKs, no external art/audio — everything procedural.

**Objective:** One-touch hop run. The ball auto-jumps along platforms; you
drag horizontally to aim. Land on platforms to score, land dead-center for
PERFECT streak bonuses, collect gems for coins, spend coins on ball skins.
Miss the platform → game over. Endless difficulty that ramps with score.

**Art:** Pastel "gumroad-style" look — procedural halftone-toon shader
(tri-planar dots + toon shading + thick black outlines), 8 cycling pastel
palettes, light/dark themes, floating rock clusters, DOM-based UI with the
Fredoka font, speed-line streaks and particle effects.

**Features:** 2-tap start (start run → first jump), inverted drag-aiming,
auto-chain jumps, squash/stretch + landing bounce, perfect streaks, gems +
coin economy, 9-skin ball shop, theme toggle, game-over stats (best score,
new-best confetti, coin count-up), procedural WebAudio SFX, localStorage
persistence, 33 unit tests, debug console helpers.

**What's NOT in the game (no prior art to preserve):** no story, no worlds,
no levels, no meta-progression, no power-ups, no missions, no unlocks beyond
skins. This is the blank canvas the overhaul fills.

---

## 1. Requirements & Constraints (the game's guardrails)

**The overhaul must not break the game's identity or its lightweight nature.**
The core one-touch hop loop — drag to aim, auto-jump chain, perfect-center
bonus, gem collection — is the product and stays untouched; the verified
gameplay constants in `GameConfig.ts` remain the tuning baseline (World 1
should feel like today's game). The game must stay a tiny, fast-loading,
offline-capable web game: no audio or image downloads, no new runtime
dependencies, no post-processing effects — all art and sound stay
procedurally generated, and the bundle should grow by no more than ~20KB.
It must hold 60fps on mid-range mobile with the existing memory discipline
(shared geometry singletons, pooled platforms, texture disposal), work with
both touch and mouse, and keep the localStorage persistence model. The
existing 33 unit tests must keep passing, and the modular architecture
(config → GameStateManager → Game → systems/entities/managers/UI) must not
change shape — new features plug into the current files and their existing
hooks. Finally, while the visual direction can change completely (this is a
repurpose, not a reskin), every addition must serve engagement —
progression, collection, replay — rather than complexity, and stay true to
the no-SDK, standalone, honest build this game is.

---

## 2. Core Pitch: "Progressive Endless"

Keep the one-touch hop loop intact, but make the run **tiered** — score
thresholds roll you through 3 worlds mid-run, each with its own identity,
difficulty preset, and collectibles. Meta-progression (unlocks, stars,
missions) lives outside the run.

Why this fits the architecture 1:1:
- The run is still `Game.jump()` → `gameLoop()`
- Worlds are just **data** (config-driven, no new systems)
- `GameStateManager` keeps its curve methods — they just read the active
  world's params; `getActiveWorld()` derives from score
- Existing hooks get filled instead of replaced (e.g. `swayOffset`)

---

## 3. World System (config-driven)

A new `src/config/Worlds.ts` where each world is a *partial override* of
`GAME_CONFIG` (spacing / x-range / jump ramps, palette list, theme,
decoration colors, sky gradient, dot pattern).

### Draft world concept (one possible theme — see §6 for alternatives)

| World | Vibe | Palettes | Difficulty |
|-------|------|----------|------------|
| 1 — Sunrise Peaks | warm dawn, peach/teal | warm subset | current feel (base) |
| 2 — Neon District | night, purple/cyan glow | neon subset | faster jump, wider x-range, swaying platforms start |
| 3 — Deep Void | space, stars, near-black | cold blue/white | max ramps, sway common |

### Optional: World gate
Golden "gate" platform at the boundary + full-screen banner + confetti
(DOM + GSAP — already the pattern).

---

## 4. Engagement Features (ranked by impact ÷ size cost)

1. **World transitions** — golden gate platform + banner + confetti.
   High impact, tiny cost.
2. **Stars** — rare collectible on platform edges; 3 per world unlock the
   next world. Dual economy: coins stay for skins, stars for progression.
   (Copies the existing `roundCoins` pattern.)
3. **Missions** — 3 per world ("3 perfects", "5 gems", "reach score 60")
   → coin rewards. Pure config + a tracker in `GameStateManager` + a toast
   in `UIManager`.
4. **Moving platforms** — `PlatformData.swayOffset` is already an unused
   hook (always 0, commented "for future platform types"), and
   `Game.jump()` already factors it into the hit check. ~15 lines.
5. **Streak milestones** — every 5-perfect streak: "HOT STREAK!" banner +
   bonus coins. Hooks into existing `perfectStreak`.
6. **Magnet power-up** — rare spawn, attracts gems for ~10s. The
   feel-good that drives "one more run".
7. **Haptics + screen flash** on milestones (`navigator.vibrate`, 2 lines)
   — free mobile engagement.

### Feature options (full list for the decision)

| # | Feature | Description | Size cost |
|---|---------|-------------|-----------|
| F1 | World transitions / gates | Golden gate platform, banner, confetti | tiny |
| F2 | Stars | Collectible currency for world unlocks | small |
| F3 | Missions | 3 goals per world → coin rewards | small |
| F4 | Moving platforms | Swaying platforms in later worlds | tiny |
| F5 | Streak milestones | Every 5-perfect streak → banner + coins | tiny |
| F6 | Magnet power-up | Rare spawn, pulls gems to ball ~10s | small |
| F7 | Haptics + flash | vibrate + screen flash on milestones | negligible |
| F8 | (stretch) Combo meter | Persistent combo counter UI + multiplier | small |
| F9 | (stretch) Best run stats | Per-world best score + run history cards | medium |
| F10 | (stretch) Daily challenge | One seeded run per day, rewards | medium |

---

## 5. Keeping It Small (the constraint)

- **All art stays procedural**: textures are already generated via
  `CanvasTexture` (halftone dots + gradient map). Extend that pattern: sky
  gradient, starfield, glow sprites, scanlines, nebula — all drawn on small
  canvases at boot. **Zero image downloads.**
- **No post-processing** (no UnrealBloom ≈ −400KB). Fake glow with
  additive-blend sprites + halftone dots.
- **No new dependencies.** DOM UI for the world map (existing pattern).
- **Size budget**: +1 config file, ~12–18KB source. Bundle stays tiny.

---

## 6. Art Direction Options

### 6.0 Agreed Art Directive (before picking a world theme)

The overhaul's art must be **fuller and more eye-pleasing** than the current
minimal look — the current style reads as basic (flat background, black
outlines on everything, dark muddy decorations). The direction to commit to:

- **Layered depth, not flatness** — every world gets a sky gradient
  (canvas-drawn at boot), mid-ground decoration clusters, and the play field,
  so the scene feels like a *place* rather than a void.
- **No harsh black outlines** — the single biggest visual upgrade. Drop the
  outline meshes; use soft edges and color contrast instead.
- **Soft, warm, colorful palettes** with light accents (e.g. white platforms
  with gold trim, glow under the platforms).
- **Glow accents everywhere it helps** — fake glow via additive-blend
  sprites/planes (no post-processing), e.g. under-platform glow, sparkle
  particles, ring effects.
- **Softer materials** — lighter toon ramp or plain standard material instead
  of the harsh 4-step toon look.

**The 80% rule (decided):** target the *feel* of a polished 3D render, not the
render itself. Roughly 80% of that feel is achievable fully procedurally
(sky, glow, clouds, trim, sparkles). The remaining 20% (glossy reflections,
volumetric clouds, real soft shadows) is **out of scope** for this project —
unless we later choose to drop in a few small PNGs (cloud sprites, a
cubemap, a platform texture ≈ 50–70KB total), which the centralized
`MaterialFactory` texture system supports as a 1-function swap per texture,
with no rework.

**What is explicitly NOT in scope:** photorealistic materials, volumetric
rendering, real-time shadow maps, bloom post-processing, per-frame expensive
shading. Everything visual must render at 60fps on mid-range mobile with
zero downloads.

World concepts in this document get built on this richer base — the options
below differ in *theme*, not in *quality bar*.

### Option A — Neon Drift / synthwave ⭐ (recommended)
- Dark bases, neon accent palettes, scanline halftone dots, glow sprites,
  sun/planet horizon sprites.
- Repurposes the halftone shader (dots → scanlines), biggest contrast to
  the current pastel look.
- Procedural-friendly, high "wow", strongest identity.

### Option B — Cosmic / minimal space
- Near-black, starfields, cold whites + one accent color.
- Very distinctive, extremely cheap procedurally.
- Risk: can feel plain unless the starfield is animated well.

### Option C — Paper craft / storybook
- Warm flat colors, paper-grain canvas texture, soft outlines.
- Cozy, but a smaller visual pivot from the current pastels.

### Option D — Custom
- Any other direction — the procedural plan gets designed around it.

---

## 7. Architecture Mapping (unchanged architecture)

| New concept | Lives in (existing file) |
|-------------|--------------------------|
| World definitions | new `src/config/Worlds.ts` |
| World-aware curves | `GameStateManager.ts` (same method signatures) |
| Transitions / banner | `Game.ts` + `UIManager.ts` |
| Sway platforms | `PlatformEntity` + `PlatformManager` (existing hook) |
| Sky / glow textures | `MaterialFactory.ts` + `RendererSystem.setTheme()` |
| Stars / progress | `Types.ts` + `PersistenceManager` sanitize/merge |
| Missions / streaks | `GameStateManager` + `UIManager` |
| World map UI | `index.html` + `UIManager` |
| Tests | new `tests/worlds.test.ts` (existing tests keep passing) |

---

## 8. Open Decisions (for the next brainstorm session)

### D1 — Art direction
- ✅ Decided (see §6.0): **fuller, eye-pleasing, layered** look — sky
  gradients, no black outlines, soft warm colors, glow accents, procedural-first.
- ✅ Arc locked (see D5): **Dawn → Dusk** — World 1 warm/paper-craft, World 2
  sunset/neon, World 3 deep night/neon. Combines paper-craft warmth AND neon
  hype as a progression arc instead of choosing one.
- [ ] Remaining: exact palettes/names per world (implementation-time detail)

### D2 — World structure
- ✅ Decided: **A. Phases in one endless run** (sawtooth difficulty: ramps
  reset per world + a new mechanic per world; gates at score 100 / 250)

### D3 — Meta-progression
- ✅ Decided: **Cumulative total-score unlocks** (sum of all run scores)
- [ ] ~~Stars + coins~~ — rejected: second currency = new UI/persistence/balancing
- [ ] ~~Best-score milestones~~ — rejected: punishes failed runs
- [ ] ~~Coins only~~ — rejected: competes with skins
- Numbers locked in §11 (calibrated for average players, any age — sources:
  flappy-bird variant survival analysis of 175M sessions shows median players'
  most-likely score ≈ 25; hyper-casual session benchmarks 60–180s; progression
  guidance = fast early, slower later)

### D4 — Engagement features (multi-select)
- ✅ F1 World gates/transitions — **IN (core)**
- ✅ F3 Missions — **IN** (3 per world, table in §11)
- ✅ F4 Moving platforms — **IN** (sway, from World 2; hook already wired)
- ✅ F5 Streak milestones — **IN** (tiers 3/5/10, shield at 5)
- ✅ F8 Combo meter — **IN** (simple streak counter near score)
- ✅ F9 Run stats — **IN, trimmed** (per-world best scores only)
- [ ] ~~F2 Stars~~ — deferred to v2
- [ ] ~~F6 Magnet~~ — rejected (trivializes gem collection)
- [ ] ~~F7 Haptics~~ — rejected (navigator.vibrate unsupported on iOS Safari)
- [ ] ~~F10 Daily challenge~~ — deferred to v2

### D5 — World identities (after D1)
- ✅ Art arc locked: **Dawn → Dusk** (W1 warm paper-craft, W2 sunset/neon,
  W3 deep night/neon). Exact names/palettes still TBD at implementation time.

### D6 — Persistence changes
- ✅ `PlayerData` gains `totalScore: number` (cumulative lifetime score)
- ✅ `bestPerWorld: number[]` (3 entries, per-world bests)
- Sanitize: coerce to number/array, default 0; merge: take **max** (never sum)
  for both fields; tests updated.

---

## 9. Decision Matrix (fill in during the brainstorm)

Score each candidate 1–5 per criterion, sum, pick the highest.

| Criterion | Option A | Option B | Option C | Option D |
|-----------|:--------:|:--------:|:--------:|:--------:|
| Visual impact | | | | |
| Fits core hop mechanic | | | | |
| Procedural feasibility (size) | | | | |
| Dev effort | | | | |
| Replay value / engagement | | | | |
| **Total** | | | | |

---

## 10. Suggested Next Steps (once decisions land)

1. Add `src/config/Worlds.ts` + world-aware curves in `GameStateManager`
2. Persistence: extend `PlayerData` (`totalScore`, `bestPerWorld`) + sanitize/merge + tests
3. World gate + transition banner in `Game.ts` / `UIManager.ts`
4. Fill the `swayOffset` hook for moving platforms (F4)
5. `MaterialFactory`: per-world dot pattern + sky/glow textures
6. `index.html` / `UIManager`: world progress bar + missions UI on the start screen
7. Missions / streak tiers + shield per §11
8. `npm run test` + `npm run build` + verify in browser

---

## 11. Locked V1 Plan (final — calibrated for average players of any age)

Decisions are locked. Any future change to these numbers is a config tweak, not a
re-architecture.

### 11.1 World unlocks (cumulative lifetime total score)

| World | Unlock (lifetime total) | In-run gate | New mechanic |
|-------|------------------------|-------------|--------------|
| 1 — Sunrise Peaks | Always on | — | — |
| 2 — Dusk District | **1,000** | **100** | Swaying platforms begin |
| 3 — Deep Void | **5,000** | **250** | Max ramps + erratic sway |

- `totalScore` accumulates the final score of every run, added on game over.
- Unlock = derived (`totalScore >= threshold`), permanent, never re-earned.
- Start screen shows `Total X / 5,000` progress bar; game-over shows `+N this run`.
- Gate rationale (player-calibrated): at ~0.45s/jump a strong player scores
  25–50 in ~10s, so gates must be real milestones — **100** = current game's
  max horizontal difficulty (x-range caps at 90); **250** = edge of a strong
  player's reach (300 in 2–3 tries). Casual players' progression is the
  cumulative ledger, not the gates; World 1's ramp gets gentled (sawtooth
  re-tuning) so average players can realistically reach 100.
- Calibration basis: median players' most-likely per-run score ≈ 25
  (175M-session flappy-variant study, far harder than a drag-aim hop game);
  hyper-casual sessions 60–180s; progression fast early, slower later
  (1,000 → 5,000 = 5× step).

### 11.2 Difficulty pacing (sawtooth)

- Ramp modifiers bind to **tier score** (score since world entry), not absolute score.
- Each world starts at a slightly lower ramp baseline and introduces a new
  mechanic, so difficulty peaks → drops → rebuilds across gates.

### 11.3 Missions (3 per world, coin rewards, toast on completion)

| World | Mission 1 | Mission 2 | Mission 3 |
|-------|-----------|-----------|-----------|
| 1 | 2 PERFECTs in a run (+10) | 5 gems (+15) | Reach score 50 (+15) |
| 2 | 4 PERFECTs (+20) | 10 gems (+25) | Reach score 150 (+25) |
| 3 | PERFECT streak of 3 (+30) | 15 gems (+35) | Reach score 250 (+35) |

### 11.4 Streak tiers

| Streak | Effect |
|--------|--------|
| 3 | Gold ring + flash (existing) |
| 5 | "HOT STREAK!" banner + edge glow + **Shield** (one free miss) |
| 10 | Fire particles + big banner |

Shield = one-time skip of the failure check (mirrors existing `DEBUG.invincible`),
visual = glowing ring around ball.

### 11.5 Everything else locked

- Art: Dawn→Dusk arc, no outlines (also halves draw calls), skies pre-generated
  at boot, fake glow via additive blending, never update canvas textures mid-loop
- Moving platforms (F4) from World 2 via the existing `swayOffset` hook
- Combo counter near the score; per-world best scores (`bestPerWorld[3]`)
- Persistence: `totalScore` + `bestPerWorld`; sanitize defaults 0; merge = **max**
- V2 backlog: daily challenge (F10), slow-mo, stars (F2), magnet variant (F6),
  run history (F9 full)
- Excluded: haptics (no iOS Safari support), dual currency, magnet as a v1 power-up
