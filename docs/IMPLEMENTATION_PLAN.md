# HOP Overhaul — Implementation Plan (iterations)

Working method: **vertical slices, trunk-based, shippable at every step.** Each
iteration ends with a playable game, green tests, and a checkpoint where you sign off.
No iteration is "a feature branch" — every layer sits on top of a working game.

## Working principles (real-world game-dev practice)

1. **One behavior change per iteration.** Logic first (pure functions + tests), wiring
   second, visuals last. Visuals are the final layer, not the first.
2. **Feature flags for incomplete features.** Debug flags let us playtest worlds/gates
   before unlocks exist. Production builds ship with debug off.
3. **Tests guard the refactors.** Difficulty math, unlock thresholds, mission tracking,
   persistence sanitize/merge — all pure, all tested. Visual/layout work is verified in
   the browser (Chrome DevTools screenshots + console), not by brittle tests.
4. **Backwards-compatible saves, always.** Every persistence change ships sanitize-first
   loading and a merge rule (max, never sum).
5. **Commit per iteration** (when you approve): one commit per completed slice makes
   bisecting and reverting trivial.
6. **Config, not code, for tuning.** All numbers in `src/config/Worlds.ts` +
   `GameConfig.ts`. Re-balancing after real players ≠ code change.
7. **Perf budget checked at every visual iteration**: 60fps, draw calls, memory.

## Iteration map (10 slices)

| It | Name | Gameplay change visible | Tests | Sign-off |
|----|------|------------------------|-------|----------|
| 0 | Foundation: Worlds config + pure logic | none (identical game) | new `worlds.test.ts` | ✅ you |
| 1 | Sawtooth difficulty curves + gate bypass flags | none early; gates kick in at 100/250 with bypass | curve tests updated | ✅ you |
| 2 | Persistence: `totalScore`, `bestPerWorld` | none visible | persistence tests | ✅ you |
| 3 | World transitions + banners | gates now visible when crossed | state tests | ✅ you |
| 4 | Sway platforms (W2 mechanic) | W2+ gameplay changes | sway tests | ✅ you |
| 5 | Streak tiers + Shield | new juice at streaks 5/10 | streak tests | ✅ you |
| 6 | Missions | toasts + rewards during play | mission tests | ✅ you |
| 7 | Start screen: ledger, missions UI, per-world bests | full UI | UI logic tests | ✅ you |
| 8 | Art pass 1: per-world palettes + skies | visual identity lands | — (visual) | ✅ you |
| 9 | Art pass 2: outlines off, glow, juice | final look | — (visual) | ✅ you |
| 10 | Hardening + ship | — | full suite + Lighthouse | ✅ you |

---

## Iteration 0 — Foundation: Worlds config + pure logic

**Goal:** introduce the world concept without touching gameplay.

- New `src/config/Worlds.ts`: `WorldId` ('sunrise'|'dusk'|'void'), `WorldConfig`
  (unlockThreshold, gateScore, name, tagline, rampOverrides, swayParams, paletteId).
- New pure helpers in `src/core/worldLogic.ts`:
  - `getWorldForScore(score, totalScore)` → active world id (unlock-aware)
  - `getWorldStartScore(world)` / `getTierScore(score, world)` (sawtooth math)
  - `isWorldUnlocked(world, totalScore)`
- `WORLDS` constant with §11 numbers (1,000/5,000, gates 100/250).
- Tests: `tests/worlds.test.ts` — unlock thresholds, gate boundaries, tier-score math.
- **DoD:** typecheck + 33 existing tests + new tests green; game plays identically.

## Iteration 1 — Sawtooth difficulty curves + bypass flags

**Goal:** ramps bind to tier score; world configs can override them; parity-checked.

- Refactor ramp functions (`GameStateManager`) to consume world ramp overrides and
  tier score instead of absolute score. World 1's overrides initially equal current
  constants → identical feel below gate 100.
- `DEBUG.unlockAllWorlds` + `DEBUG.forceWorld` ('sunrise'|'dusk'|'void') in
  `GameConfig` + `window.gameDebug`.
- Tests: curve parity at scores 0–100 vs current formulas; tier-score reset behavior;
  gate-crossing math (100/250).
- **DoD:** typecheck + tests green; same feel as today below 100; with bypass, gates
  reset ramps at 100/250.

## Iteration 2 — Persistence: `totalScore`, `bestPerWorld`

**Goal:** the ledger exists before any UI shows it.

- `PlayerData` gains `totalScore: number`, `bestPerWorld: number[]` (3).
- `PersistenceManager`: sanitize-first load (missing/corrupt → defaults), merge = **max**
  per field, write-on-change. Bank `totalScore` exactly once per game over in `Game.ts`;
  update `bestPerWorld[currentWorld]` on game over.
- Tests: legacy save shape (old keys only) loads cleanly; corrupt values defaulted;
  merge never sums; score banked once.
- **DoD:** typecheck + tests green; save file migrates; game unchanged visually.

## Iteration 3 — World transitions + banners

**Goal:** crossing gates is a visible, satisfying event.

- Gate detection in `GameStateManager` (score crosses `gateScore` and next world
  unlocked, or bypass flag on).
- `UIManager` transition banner: world name + tagline + palette flash; EventBus events
  (`WORLD_CHANGED`) — first real use of the existing EventBus.
- Theme/palette swap hook wired (no visual change yet; slot ready for Iter 8).
- Tests: state machine transitions at exact gate scores, locked-world continuation
  (run stays in current world when next is locked).
- **DoD:** with bypass flags, crossing 100/250 shows the banner; without unlock, no gate.

**Status: DONE — commit `2333d72`**
- `GameStateManager.evaluateWorldChange()` — single-shot world-crossing detection
  (`lastWorldId` tracking, re-armed to `sunrise` on `resetGame`).
- `Game.ts` emits `WORLD_CHANGED` (EventBus) from both score paths (landing + gem).
- `UIManager.showWorldBanner()` — dynamic DOM banner (name + tagline) + white flash,
  gsap entrance/exit, self-cleaning; `dispose()` kills tweens.
- Tests: `difficulty.test.ts` +4 (79→80 total); typecheck + build green.
- Browser-verified at http://localhost:3000: banner + flash fire on gate cross;
  screenshot `docs/shots/iter3-banner-void.png` (shot via forceWorld('void')).

## Iteration 4 — Sway platforms (W2 mechanic)

**Goal:** world 2+ platforms move; world 1 untouched.

- `PlatformManager` fills the existing `swayOffset` hook: sin-wave sway from
  `WorldConfig.sway` (amplitude, speed); applied per-frame in `Game.gameLoop`.
- Sunrise (amp 0) keeps exact parity — platforms stay pinned to `platformX`.
- Sway moves `group.position.x` **and** `swayOffset`, so the existing landing
  hit-check (`platformX + swayOffset`) already consumes the shifted target.
- **Status: DONE — commit `5eec6c1`**
- `PlatformManager.updateSway(now)` — `sin(t·speed + index·1.7)·amp` per platform,
  de-phased by index; wire call in `gameLoop`.
- Per-world sway mix: `sway.ratio` (0..1) keeps every ~1/(1-ratio) platform static
  (deterministic cadence). Sunrise: amp 0 → untouched; Dusk: 1-in-3 static;
  Void: 1-in-4 static, wider+faster.
- Tests: `platforms.test.ts` sway suite (W1 still, locked-world continuity, dusk
  exact formula + cadence, void envelope + sparse cadence, gate-cross flip) → 87
  total.
- typecheck + test + build green; runtime clean; screenshot
  `docs/shots/iter4-sway-dusk.png`. Playtest sign-off: look good (incl. mix).

## Iteration 5 — Streak tiers + Shield

**Goal:** streak 5 = HOT STREAK + shield; streak 10 = fire.

- Streak tracker in `GameStateManager`: tier checks at 5/10 (tier 3 exists).
- Banner + screen edge glow at 5 (EffectsSystem), fire particles at 10 (reuse
  particle system), big banner.
- Shield: consumed by first miss (mirror of `DEBUG.invincible` fail-check skip);
  glowing ring mesh while active; one per run.
- Tests: tier triggering, shield consume-on-miss, no stacking, reset on death.
- **DoD:** visible tiers at 3/5/10; shield saves exactly one miss.

## Iteration 6 — Missions

**Goal:** 3 missions per world, tracked, awarded.

- `MissionConfig` in `Worlds.ts` per §11.3; tracker in `GameStateManager` (perfects,
  gems, score thresholds, streak — all already counted).
- Toast on completion (EventBus); rewards banked into coins on game over; completed
  missions persisted (once).
- Mission set = current world's missions (+ next world's for the run after gate).
- Tests: each mission type completes exactly once, awards correctly, persists.
- **DoD:** missions complete live, toast shows, coins land at game over.

## Iteration 7 — Start screen: ledger, missions UI, per-world bests

**Goal:** progression becomes legible before playing.

- `index.html`/`UIManager`: ledger bar (`Total X / 5,000`), missions list with
  progress bars, per-world bests (locked = hidden/locked styling), world progress
  indicator. Skins shop untouched.
- Game over panel: `+N this run`, mission reward summary, world reached.
- Tests for any new pure formatting/derivation logic.
- **DoD:** start screen communicates everything; game over shows run contribution.

## Iteration 8 — Art pass 1: per-world palettes + skies

**Goal:** Dawn→Dusk identity lands on worlds.

- `MaterialFactory`: pre-generate per-world platform/gem palettes at boot (W1 warm
  paper-craft: sky gradient, white/gold platforms; W2 sunset/peach/purple; W3
  near-black + neon). Swap material references on gate (no mid-loop texture gen).
- `BackgroundSystem`/sky per world; dispose old textures on swap (NFR-2).
- Perf check: draw calls, fps before/after (research: outline removal in Iter 9
  also cuts draw calls).
- **DoD:** three distinct moods; no mid-loop texture updates; memory stable.

## Iteration 9 — Art pass 2: outlines off, glow, juice

**Goal:** final look — no black outlines, additive glow, polish.

- Remove `COLOR_OUTLINE` outlines (halves draw calls), replace with soft shading.
- Fake glow: additive-blended sprites/rings on ball, gems, streak edges.
- Tune camera shake / flashes already present; W3 stars; W1 clouds (sphere clusters
  per §6.0 art directive, Gemini cloud-kingdom feel).
- **DoD:** §6.0 directive satisfied at 80% procedural; perf budget met; you approve the look.

## Iteration 10 — Hardening + ship

**Goal:** perfection gate, then ship.

- Full QA pass: all debug flags off in build; console clean; 60fps on your machine;
  Lighthouse snapshot; memory leak check across many world changes; fresh-profile run.
- Edge cases: corrupt saves, rapid restarts, window resize, iOS/desktop basics.
- `npm run build` → `dist/`; decide deploy target (GitHub Pages / itch.io / your host)
  and any upload steps you want me to script.
- **DoD:** you play a full progression arc (0 → 5,000) without issues; build ships.

---

## Risk register (updated as we go)

| Risk | Trigger | Mitigation |
|------|---------|------------|
| Iteration too big | sign-off slips / bugs stack | split further; every slice stays shippable |
| Numbers feel wrong in real play | your playtest feedback | config-only retune (Iter 10 telemetry: none needed, feel-based) |
| Art pass regresses perf | fps/draw-call check fails | outline removal is a win; glow uses cheap additive sprites |
| Save migration bug | corrupted legacy saves in tests | sanitize-first + merge=max, tested in Iter 2 |
