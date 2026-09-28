# HOP Overhaul — Requirements

Source of truth: [OVERHAUL_BRAINSTORM.md](./OVERHAUL_BRAINSTORM.md) §11 (Locked V1 Plan).
Any conflict with this file → this file wins for scope/acceptance; the brainstorm doc
wins for design rationale.

---

## 1. Overview

HOP is a Three.js drag-to-aim auto-jump hop game (BounceTiles reimplementation).
The overhaul converts the single endless mode into a 3-world progressive game with
cumulative-score meta-progression, missions, streak rewards, and a Dawn→Dusk art arc —
while keeping the core loop unchanged and everything config-driven.

## 2. Goals

| # | Goal | Acceptance |
|---|------|------------|
| G1 | 3 worlds as selectable play spaces | Start-screen world nav (arrows + chips) picks the world; locked worlds show 🔒 + threshold; runs never change worlds mid-flight |
| G2 | Cumulative-score progression that never punishes failure | Every run adds its final score to a lifetime total; unlocks are derived, permanent, never re-earned |
| G3 | Retention loop for players of any age | First reward within ~3 min of play; missions + streaks + shield; "fast early, slower later" curve (1,000 → 5,000) |
| G4 | Visually distinct worlds (Dawn→Dusk arc) | W1 warm/paper-craft → W2 sunset/neon → W3 night/neon; ~~no black outlines~~ **black hulls kept per Week 2 spike lock (2026-09-02)**; glow accents |
| G5 | Ship quality | 60 fps, no console errors, clean memory on world change, backwards-compatible saves, builds to static files |

## 3. Non-goals (v1)

- Daily challenge, slow-mo, stars, magnet power-up, run history chart (v2 backlog)
- Haptics (`navigator.vibrate` unsupported on iOS Safari)
- Multiplayer, accounts, backend, leaderboards
- Non-procedural art (80% procedural rule; optional ~50–70KB PNG swap-in later)
- New game modes (reverse, time attack, etc.)

## 4. Functional requirements

### FR-1 Worlds
- FR-1.1 Three worlds: W1 Sunrise Peaks (always on), W2 Dusk District (unlock 1,000 total score), W3 Deep Void (unlock 5,000).
- FR-1.2 World is a **menu choice** (`selectedWorld`, persisted): start-screen nav row (back arrow · current world + best · next arrow) and clickable world chips.
- FR-1.3 Entry offsets W2 = **100**, W3 = **250**: tier score = run score − offset, so each world's difficulty/sawtooth profile matches the original mid-run bands while score always starts at 0.
- FR-1.4 Locked worlds refuse selection (🔒 + threshold shown); a run never transitions worlds, so there is no soft-block.
- FR-1.5 Each world contributes exactly one per-world best (`bestPerWorld[worldIndex]`).

### FR-2 Meta-progression (cumulative ledger)
- FR-2.1 `totalScore` += final run score, added exactly once per run on game over (not on quit mid-run, not per retry).
- FR-2.2 Unlock = `totalScore >= threshold`, derived at runtime, never stored as a flag.
- FR-2.3 Saved data must migrate safely from the pre-overhaul schema (missing fields default, no crash, no data loss).

### FR-3 Missions (3 per world)
- FR-3.1 Missions per world (config-driven): see §11.3 of brainstorm doc (W1: 2 PERFECTs / 5 gems / score 50; W2: 4 PERFECTs / 10 gems / score 150; W3: streak 3 / 15 gems / score 250).
- FR-3.2 Tracked live during a run; toast on completion; coin reward banked on game over.
- FR-3.3 Progress shown on the start screen; per-world mission set active only for the selected world (other worlds' rows locked).
- FR-3.4 Mission completion is persisted (only once per mission).

### FR-4 Streak tiers
- FR-4.1 Streak 3: gold ring + flash (existing).
- FR-4.2 Streak 5: "HOT STREAK!" banner + screen edge glow + **Shield** (one free miss).
- FR-4.3 Streak 10: fire particles + big banner.
- FR-4.4 Shield: consumes on first miss (visual ring around ball while active); does not stack; resets per run.

### FR-5 World mechanics
- FR-5.1 Swaying platforms from W2 via the existing `PlatformData.swayOffset` hook; sway amplitude/phase from world config; erratic (larger, faster) sway in W3.
- FR-5.2 Sawtooth difficulty: ramp params bind to **tier score** (score since world entry); each world's baseline ramp params come from world config; W1's early feel must match current game at equal scores until its ramp differs.

### FR-6 UI
- FR-6.1 Start screen: selected world's name as the title; back arrow at the center-left and next arrow at the center-right edge, both vertically centered and labeled `World 1/2/3`; a `TAP TO PLAY` button is the only game-start trigger; missions list with progress, per-world bests, existing skins shop intact.
- FR-6.2 Game over: `+N this run` on the run summary, mission rewards summary, world name of the run.
- FR-6.3 In-run: combo counter near score; existing HUD intact.
- FR-6.4 Locked-world UI: lock SVG + unlock threshold on the next arrow; clicking a locked world briefly "loads" then shows a gaussian-blur screen with a lock card (name hidden as `????`, world description, progress bar, points remaining) — clicking anywhere never starts a run while locked, and the back arrow stays usable above the blur; missions/shop buttons fade out while locked; an occasional "too easy?"-style thought bubble near a locked next arrow; mission rows distinguish "Play in <world>…" from "Unlocks at <N>…" tooltips.

### FR-7 Debug
- FR-7.1 `DEBUG.unlockAllWorlds` (bypass unlock thresholds) and `DEBUG.forceWorld` to playtest any world without grinding.
- FR-7.2 Existing debug flags (`invincible`, `showHitboxes`, `showFPS`, etc.) keep working.
- FR-7.3 All debug flags are stripped/disabled in production builds (DEBUG.enabled=false shipped).

## 5. Non-functional requirements

| # | Requirement | Target |
|---|-------------|--------|
| NFR-1 | Performance | 60 fps on mid-range hardware; outlines kept per spike lock — measured cost is ~16–17 draws, not half (57→40/41 desktop, 54→37/38 mobile); no canvas-texture updates during the game loop (pre-generate at boot, swap references) |
| NFR-2 | Memory | Dispose GPU resources on world change (no per-world texture leak); no listener leaks |
| NFR-3 | Robustness | No console errors/warnings in normal play; clean handling of corrupt localStorage (sanitize + defaults) |
| NFR-4 | Testability | All difficulty/unlock/mission logic in pure functions covered by Vitest; existing 33 tests stay green; suite grows per iteration |
| NFR-5 | Config-driven | Every tuned number lives in config (world configs), never hardcoded in systems — post-launch retuning is a config edit |
| NFR-6 | Backwards-compat | Existing save data loads without loss; new fields sanitized, merge rule = max (never sum) |
| NFR-7 | Build | `npm run build` (tsc + vite) produces static files; ships on any static host |
| NFR-8 | Accessibility/basic | UI readable at typical phone/desktop sizes; no reliance on color alone for game-critical state (banners + text) |

## 6. Definition of Done (every iteration)

1. `npm run typecheck` clean
2. `npm run test` green (existing + new tests)
3. `npm run build` succeeds
4. Browser check via Chrome DevTools (I verify: no console errors, screenshot, core flow works)
5. Player check: user plays the iteration's slice on `npm run dev` and signs off
6. Iteration documented in IMPLEMENTATION_PLAN.md (checkpoint notes)

## 7. Risks

| Risk | Mitigation |
|------|------------|
| Gates too hard for casuals | Ledger is the casual progression path; gates are skill entries; W1 ramp gentler than current game at same scores (Iter 1 keeps parity until tuning pass) |
| Sawtooth reset feels like "difficulty loss" | Each world adds a new mechanic at the same time, so difficulty re-builds with novelty |
| Save migration breaks testers' data | Sanitize-first loading, merge=max, tests for legacy shapes |
| Art overhaul regresses performance | Outlines removal is a net perf win; textures pre-generated; per-iteration perf check (draw calls, fps) |
