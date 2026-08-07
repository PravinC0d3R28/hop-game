# HOP — Loading Screen & Tutorial Design

> Status: **implemented (v1)**. Follow-up decision after the brainstorm: the loading **bar was dropped** — since there is nothing to load, the splash is a short branded **flash screen** (§2.6b). The tutorial shipped as the **attract demo + cycling hint** on the start screen and the **one-shot guided first run** (§3).
> Scope: design + implementation notes.

---

## 0. Where we are today

- The game boots into a static `#splash-screen` (a full-bleed `splash.png` on white) that fades out **100ms after `new Game()` completes** (`src/main.ts:16-21`).
- Real boot work, in order: state init → localStorage save load → `MaterialFactory.init()` + async `Coin.png` texture load → renderer/scene/background/platform init → first WebGL frame (shader compile).
- The whole game is tiny (< ~600KB, ~30 modules, no CDN deps). **There is no meaningful download to wait on.**
- Branding today: `<title>HOP</title>`, static `splash.png`, in-game world titles replace the logo on the start screen.

**Consequence:** the "loading screen" is a *brand moment and a taught beat*, not a progress meter. It must look intentional without ever being able to block on real progress. Every design decision below follows from that.

---

## 1. Design principles

1. **The bar must never wait on real work** — hybrid progress: real milestones advance the target, a GSAP tween chases it, a min-duration floor guarantees the moment reads.
2. **Zero external assets, procedural-first** — the game's whole philosophy. Animated background = CSS/canvas generated from the existing palette; the ball is the in-game sphere.
3. **Don't slow the "one more try" loop** — a returning player must reach the start screen fast; loading must be skippable and short (~2s first impression, less if skipped).
4. **One identity, reused** — loading screen and tutorial should feel like the same world as the game, not a disconnected marketing slide.
5. **Mobile-first, 60fps, no main-thread blocking** — background animation must be GPU-cheap (transforms/opacity only) so it never delays the engine boot it's covering.

---

## 2. Loading screen — decided spec

> **v1 simplification (user decision):** because there is nothing to load, the loading **bar was dropped**. The screen is a short branded **flash screen**: animated background + wordmark + descriptor + studio footer, shown for a beat (1.5s first visit / 0.9s returning, tap-to-skip), then it fades into the start screen where the attract demo takes over. §2.1–§2.5 describe the visuals; §2.6b records the simplified timing.

### 2.1 Layout (top → bottom)

```
┌──────────────────────────────────────────────┐
│                                              │
│        [ procedural animated background ]     │
│                                              │
│              H O P  (logomark)               │   ← big wordmark, world-theme gold
│           hop tiles · endless               │   ← descriptor line (small, letter-spaced)
│                                              │
│   ──◉───────────────────────────           │   ← loading track + rolling ball
│             50%                             │   ← percent (small, tabular)
│                                              │
│                 © company name               │   ← bottom watermark, tiny, muted
└──────────────────────────────────────────────┘
```

### 2.2 Animated background — **decided: procedural 2D, not the 3D world**

- During load the renderer isn't up yet, so the background is a **CSS/canvas composite** built from the game's palette:
  - a slow **vertical gradient sweep** (world theme color → dark) for depth,
  - a drifting **neon grid / halftone** layer (reuses the game's halftone motif) scrolling downward,
  - sparse **tile silhouettes** (rounded rectangles like the platforms) drifting upward at parallax speeds with a soft glow,
  - a few **rising particle motes** (recycled coin color) for life.
- All GPU-cheap (transform/opacity animations). Matches the sunrise/dusk/void identity, no assets.
- **Why not the live 3D world behind the loading UI:** the engine literally is what we're waiting for; rendering it during load is impossible by definition. The live world shows up the moment the loading screen is done.

### 2.3 Wordmark — **decided: keep "HOP" as the logomark, "hop tiles" as the descriptor**

- Big single word **HOP** (current identity, brandable, already everywhere in code/URLs).
- Small descriptor beneath: **"hop tiles · endless"** — communicates the mechanic instantly and nods to the original *Tiles Hop* genre without renaming the product.
- Font treatment: heavy weight, letter-spaced, `paint-order: stroke` (the same neon text styling already used by the in-game world titles) so it feels like part of the game.
- Alternate display names considered: *Hop Tiles*, *TILES HOP*, *HOP: Endless*. All viable; the "HOP + hop tiles descriptor" combo keeps the logomark stable while letting the descriptor carry the description. **If you'd rather the player-facing name be "Hop Tiles", we only change the descriptor line.**

### 2.4 Company line — **decided: config-driven placeholder**

- A small muted line bottom-center: `© <studio>`. Put it in a **branding config block** (mirroring the existing `CUSTOMIZATION_GUIDE` philosophy) so it's a one-line change.
- Candidate names (pick one or supply your own): *Sunrise Studio · Daybreak Games · Pockethop · Litehop · Keen Hop · Hoply Works*.
- Recommendation: pick something neutral and short (a generic "Studio" suffix reads more professional than a pun for a footer) — e.g. **Daybreak Studio** or your own. Easy to swap later because it's config-driven.

### 2.5 The loading bar + ball — **decided: marble-roll metaphor**

The bar is the centerpiece — the ball **rolls along the track** as it fills.

- **Track:** thin horizontal rounded bar (~4–6px), darker than the background, with a glow when active.
- **Ball:** the in-game sphere, sitting ON the track (center on the fill line). 
  - `x = progress% × trackWidth` — the ball travels the bar.
  - `rotation = x / ballRadius` — it **physically rolls**, so at 100% it has made ~1–2 full rotations depending on track length.
  - A **glow ring + short dash trail** trails behind the ball to emphasize the motion.
  - While progress is idle at the start, the ball bobs in place (gentle scale/sine) so it never looks frozen.
- **Fill:** bar fills behind the ball; a soft gradient + halftone pattern inside the filled portion.
- **At 100%:** ball gives one little bounce + ring pop, the percent snaps to 100, then the whole screen fades into the start screen (same `0.5s` ease the splash uses today).

### 2.6 Progress model — **decided: choreographed beat + readiness gate**

**The honest truth about this game's load:** boot is local and nearly instant — `new Game()` returns in ~100–300ms even on a phone, and the one late async asset (`Coin.png`) is *already handled* (materials get patched when it finishes, see `MaterialFactory`). There is no real download for the bar to measure.

That reframes the bar: **it is a choreographed brand beat with a "don't lie" gate**, not a meter.

How it actually works:

1. **Readiness gate (the only thing that must never lie):** the loading screen may only start fading out after **both** (a) `new Game()` has returned — the engine can render, guaranteed within ~300ms even on slow phones — and (b) the floor has elapsed. Before both hold: no 100%, no tap-to-skip.
2. **The floor is the show:** the bar animates 0 → 100 on a clock (~2.0s first visit). The ball rolls the track once. That is the entire experience — by design.
3. **Real milestones are decorative-but-honest:** engine init → texture warm-up → save load → first frame each nudge the *target* (0 / 35 / 70 / 90 → 100). A GSAP tween chases the latest target, so the bar moves in smooth, believable bursts instead of a perfectly linear fake line. On a rare slow device the milestone lags and the bar honestly holds below 100 with the ball bobbing — no fake completion, no fade into a frozen screen.
4. **Skip:** enabled only once readiness holds. Tap then → 0.35s ease into the start screen (or a "PLAY" pill appears). Taps before readiness are ignored — you can't skip into a dead screen.
5. **Returning players:** the floor drops to ~1.2s when `localStorage` shows an existing save (they've seen the brand). Keeps the "one more try" loop fast without a bare white flash.
6. **Fail-safe:** hard cap ~5s — if readiness never arrives (pathological), force the fade so a player is never trapped behind a dead bar.

Timing table:

| Situation | Floor | What the player sees |
|---|---|---|
| First visit, fast phone | 2.0s | Full brand beat; ball rolls the track once |
| First visit, slow phone | 2.0s | Bar may hold near a milestone (ball bobs) until the engine is ready, then 100 → skip |
| Returning player | 1.2s | Short beat, same motion, less patience asked |
| Pathological failure | cap ~5s | Force fade; no trap |

### 2.7 Build shape (for the implementing pass, not now)

- New `load` sequence in `main.ts`: bootstrap emits progress events; UIManager owns the splash DOM + GSAP animations (GSAP is already in the bundle).
- `#splash-screen` markup grows from `<img>` to the layout in §2.1; the static `splash.png` is retired or kept as a first-frame fallback while CSS loads.
- Branding (name, descriptor, studio, min durations) all from one `GAME_CONFIG.BRANDING` block.
- The animated background = a small CSS/SVG module, **not** canvas, to avoid a second rAF loop fighting the game loop.

---

## 3. Tutorial — decision

Three candidate formats, evaluated against this specific game (10-second teachable core: *drag to aim → release to hop → land on tiles → collect coins → don't miss*; a <600KB procedural web game):

### Option A — Static card overlay with static images
- **Pros:** simplest, fully controlled pacing, works offline, zero runtime cost, easy to localize.
- **Cons:** needs baked screenshots/illustrations (new asset files + upkeep when UI changes); a still image can't convey the *timing/juice* of aim → release; hyper-casual players skim static cards and still make their first mistake 3 seconds later.
- **Verdict:** good as a *supplement* (a "?" help card), weak as the primary teach.

### Option B — Live video on an overlay card (recorded gameplay)
- **Pros:** shows real feel; looks professional; full authoring control.
- **Cons:** **a 10s 720p loop is ~1–3MB — heavier than the entire game.** Mobile data cost, autoplay restrictions, mute/loop handling, an asset pipeline, and a wall between "watch this" and "do this". Hyper-casual best practice is *show-by-doing*, not *watch-first*.
- **Verdict:** **rejected.** It violates the tiny-footprint identity and buys nothing the live teach can't.

### Option C — Live teach of the gameplay (attract-mode demo + guided first run)
- **Pros:** shows the actual game with real juice; **zero new assets** (reuses the engine + palette); teaches the *gesture* in the exact context the player will perform it; it's the proven pattern for the genre (*Stack*, *Helix Jump*, *Tiles Hop* itself). Also gives the start screen a living, animated background for free.
- **Cons:** needs a scripted "auto-hop" demo state + a guided-run mode — real (but contained) gameplay-side work.
- **Verdict:** **chosen as the primary teach.**

### Chosen spec — two layers, both live

1. **Start-screen attract demo (post-load)** — *continuous forward*:
   - The engine is idle behind the start screen: the ball hops **forward forever**, chasing each tile's live center while the runway **recycles ahead** of it (same `PlatformManager.recycle()` the real run uses). No end, no backtracking.
   - **Restraint rules (so it never feels like too much):**
     - **Muted hop audio** during the demo.
     - **Dimmed world** behind the UI so the demo reads as "background" and the play button stays the hero.
      - **Runs indefinitely:** the demo keeps hopping forever on the start screen — menu touches (empty space, settings, stats, world arrows) never stop it, and a world switch re-seeds it from tile 0. Only an actual run start halts it; it restarts whenever the start screen shows again (reset / boot-fade).
      - **Locked worlds never demo:** selecting a locked world parks the ball on the start tile — the world stays as scenery (a tease), but no hops/coins (no spoiler of the new difficulty). The demo resumes automatically once the world unlocks (next start screen show).
   - A pulsing hint fades in over it: **"drag to aim"** with a ghost drag-arrow, then **"stay on the tiles"**. (The hop chain is automatic — the player's skill is steering, so the hint teaches the control, not a fictional release gesture.) Loops quietly; only a run start yields the demo.
   - This is the loading screen's "animated world" payoff and the tutorial's hook in one.

2. **First-run guided play (multi-step, 5 tiles, retry loop):**
   - On the player's very first actual run the tutorial guides **5 hops**:
     - **Step 0** — caption **"tap to hop"** + a pulsing **target ring on the diamond** of the next tile, with a **down-arrow above** it pointing at the diamond.
     - **Steps 1–2** — caption **"drag to aim"** + a **drag arrow on the next tile** (below its ring) pointing the **exact drag direction** — left or right, resolved in screen space (the camera looks forward, so a world-x sign would teach the wrong way) — + the ring on each next tile (steering is the whole skill — the hop chain is automatic).
     - **Steps 3–4** — caption **"drop on the diamond!"**, ring follows the target (the perfect-dot bonus).
   - Guided hops run in **slow motion (half speed)** so the arc + ring read clearly; the **first drag snaps the remaining hops back to full speed** (the player has the idea — never hold a reacting player back).
   - **Retry loop (fallback):** if the player misses during the guided segment, the run is **not** ended — it respawns to the start tile with a brief **"almost! try again"**, re-arms the first tap, and repeats until the guided hops are completed. While the tap is re-armed, steering input is **ignored** (a still-held pointer can't drift the ball off its platform while it idles). This keeps a struggling first-timer in a safe teaching loop.
   - **Seamless ending:** after 5 guided hops there is **no end screen** — the guides simply **fade out element by element** while the run keeps going at full speed, and the run counts as run 1 like any other. `tutorialDone` is persisted so returning players never see it again (existing saves with prior runs are migrated to skip it).
   - The start screen also activates at boot (positioned, pulsing play button) so a first-time player clearly sees where to tap.

### Optional supplement (small, cheap)
- A **3-icon static help card** (drag / release / collect) reachable from a tiny "?" on the start screen — the accessibility + reference fallback, built later if needed. Not required for v1.

---

## 4. Decisions (confirmed)

1. **Game name** — keep the **HOP** logomark with the "hop tiles · endless" descriptor. ✓
2. **Studio name** — undecided; keep a **config-driven placeholder** (`© <studio>`) until a name is chosen. ✓
3. **First-impression length** — **~2.0s first visit / ~1.2s returning**, skippable once ready (details in §2.6). ✓
4. **Attract demo on the start screen** — **chosen**, *restrained but always on* (muted audio + dimmed world + recycling runway, never stops for menu touches, re-seeds on world switch). Reasoning: the start screen already renders the live world, so a hopping ball is the smallest step to an attention-grabbing menu; restraint (dim, mute, recycle) is what keeps it from feeling like too much — and per playtest feedback it must keep running indefinitely, not pause on interaction. See §3.

---

## 5. Decision summary

| Topic | Decision |
|---|---|
| Loading background | Procedural 2D: diagonal-moving gradient sweep + halftone grid (tiles/motes removed per feedback). No 3D during load (engine not ready). |
| Wordmark | **HOP** logomark + "hop tiles · endless" descriptor. |
| Studio line | Config-driven `© <studio>` footer; placeholder until a name is chosen. |
| Loading bar | **Dropped (v1)** — the splash is a short branded flash screen; the marble-roll bar spec is preserved above as a future option if a real load ever appears. |
| Progress | Choreographed beat + readiness gate: ~1.5s first visit / ~0.9s returning, tap-to-skip. |
| Start-screen demo | **Attract demo, restrained but always on** — muted audio, dimmed world, recycling runway; runs indefinitely, ignores menu touches, re-seeds on world switch; only a run start halts it. |
| Tutorial | **Live teach (Option C)**: attract demo + one-shot first-run guided slow-mo jump. |
| Video teach (B) | Rejected — asset weight vs a <600KB game, no benefit over live. |
| Static card (A) | Optional "?" help-card supplement, not the primary teach. |
