# HOP — Agent Handoff

**Purpose:** everything a *cold* agent needs to continue this project correctly, with
no memory of prior sessions. Read this file fully before touching anything, then read
`AGENT_RULES.md` (the working agreement).

**Read order for a new agent:**
1. This file (orientation, current state, lessons)
2. `AGENT_RULES.md` (commit protocol, shell safety, delegation policy)
3. `COMMIT_LOG.md` — the full chronological history, most recent at the bottom.
   This is the single best record of *why* the code is shaped the way it is.
4. `docs/ART/WORLD 1|2|3/` — the locked art direction per world.

---

## 1. Working tree

World 3 landed in `a19db8a`. Run `git status` before starting. Do not assume the tree
is clean, and do not start a second void revamp unless the user asks.

---

## 2. Repo map

Root: `C:\Users\Poonam\Desktop\YTGames\HOP`

| Path | What it is |
|---|---|
| `index.html` | The entire game shell **and** a large chunk of CSS/UI markup. Scene markup, HUD, all overlays, and the score/callout CSS live here. |
| `src/config/` | Data, not behaviour. `Worlds.ts` (world list), `WorldLooks.ts` (per-world scene recipe + palette + prop recipes), `GameConfig.ts` (all tuning constants), `CrystalStructures.ts`, `Palettes.ts` |
| `src/core/` | `GameStateManager.ts` — save shape, progression, unlocks |
| `src/systems/` | The engine. `RendererSystem` (camera, dome, world look), `BackgroundSystem` (scenery layers + recycling), `CrystalFactory`/`CrystalField`, `CloudFactory`, `MaterialFactory`, `PlatformManager` |
| `src/entities/` | `PlatformEntity` (the bounce tiles) |
| `src/ui/UIManager.ts` | ~2500 lines. Every HUD element, overlay, callout, dialog, and the transient-FX reset path. |
| `src/managers/` | `PersistenceManager` (save I/O), `PlatformManager` (tile run) |
| `src/worlds/<id>/` | Per-world modules. `dusk/` and `void/` are self-contained art modules |
| `src/dev/` | Dev-only lab harnesses, not bundled into production |
| `tests/` | 20 files, 277 tests. Pure logic, node env, no jsdom |
| `COMMIT_LOG.md` | Append-only history. Every commit gets an entry. |

### Dev-only pages (Vite serves these; only `index.html` ships)

| Page | Harness |
|---|---|
| `crystal-editor.html` | `src/dev/crystalEditor.ts` — structure authoring, Author + Game-preview modes |
| `cluster-lab.html` | `src/dev/clusterLab.ts` — one cluster at a time, orbit, gallery |
| `dusk-lab.html` | `src/dev/duskLab.ts` — Dusk asset inspection + **gameplay preview** |
| `void-lab.html` | `src/dev/voidLab.ts` — World 3 equivalent |

### World status

| # | World | State |
|---|---|---|
| 1 | Sunrise Peaks | **Done.** Crystal field on a cloud sea. Art: `docs/ART/WORLD 1/` |
| 2 | Dusk District | **Done** (`7495901`). Canyon city. Art: `docs/ART/WORLD 2/` |
| 3 | Deep Void | **Done** (`a19db8a`). Sky, rocks, gates, planets, tiles, and seeded scenery. Art: `docs/ART/WORLD 3/` |
| — | Coming-soon teaser | A locked slot. Never show a world bubble for it. |

---

## 3. The art workflow that works — follow this for any new world

This is the process that produced World 2 and is being used for World 3. Do not skip
steps; every one of them exists because skipping it caused real rework.

1. **Get the art first.** Reference image + palette/direction doc, in
   `docs/ART/WORLD <n>/`. **Never invent a world's look.** Every wasted cycle on
   World 2 traces back to building before the direction was locked, or to iterating
   against the wrong view.
2. **Read the image before the prose, and actually look at it.** Write down concrete
   observations (silhouette, lean, colours, where the light comes from) so later work
   can be checked against something concrete rather than against adjectives.
3. **Cross-check image against prose.** Write down every place the image shows
   something the doc doesn't name. Those are silent scope — decide them explicitly.
4. **Save a build plan** in the world's ART folder before writing code.
5. **Build one asset at a time** in that world's lab. Screenshot it. Judge it. Only
   then move to the next. This is the owner's explicit workflow and it is not
   optional.
6. **Verify in the gameplay preview**, not just the orbiting inspection camera. See
   §6 — this caught bugs that in-game checking hid for several iterations.
7. **Then** place assets into the world and re-verify.
8. **Lock it in** only once it holds up in the real game.

---

## 4. Git & commit discipline

Repo style, from `AGENT_RULES.md` §2:

- **Commit after each prompt** in which changes are proposed.
- **Message format:** `iter#-fix#: brief summary` for fixes,
  `feat(scope): summary` for features, `docs: summary` for documentation.
  Look at `git log --oneline` and match what is there.
- **After every commit, append an entry to `COMMIT_LOG.md`** — hash, message, and a
  substantive paragraph on *why* the change was made and what was tried first that
  failed. This log is the project's institutional memory; a future agent will rely on
  it to avoid re-making your mistakes.
- **Never leave the tree dirty.** Commit, or explicitly tell the user what is uncommitted.
- **Do not use `--amend`, do not force-push, do not skip hooks, do not edit git
  config.** If a commit fails, fix the problem and make a new commit.
- **Before committing, inspect `git status`, `git diff`, and `git log --oneline -10`.
** Stage only what you intend to commit. Never commit secrets (`.env.dev` is
  gitignored).

### Quality gates — all three, before every commit

```powershell
npx tsc --noEmit -p tsconfig.json   # must be clean
npx vitest run                      # must be 100% passing
npm run build                       # must succeed
```

A commit that fails any gate is not ready. If a gate genuinely cannot pass, say so
explicitly rather than committing anyway.

---

## 5. Windows / PowerShell environment gotchas

`AGENT_RULES.md` §7 covers foreground servers and pipeline hangs. These bit me
specifically and are worth internalising:

### CRLF will make `git status` lie to you

The repo normalises to LF (`.gitattributes`: `*.ts text eol=lf`). PowerShell's
`Set-Content` writes **CRLF**. So editing a file with `Set-Content` leaves the working
copy CRLF while the index is LF — git reports the file as **modified with an empty
diff**.

**Verify with `git diff --numstat`.** Empty output = line endings only, no content
change. Fix by `git add -A` (git normalises on add) and the tree goes clean again
without committing anything.

Never rewrite a whole file just to change a couple of lines. Prefer the `edit` tool,
which does surgical string replacement.

### Regex replacements through PowerShell will bite you

`Get-Content -Raw` + `-replace` + `Set-Content` is fast but destructive: a pattern
that matches more than intended silently mangles code, and multi-line replacements
need real newlines (`` `n `` inside a *single-quoted* string stays literal and
corrupts the file). When a regex edit spans lines, build the replacement in a
here-string and verify with `tsc` immediately after.

I twice corrupted `DuskGeometry.ts` this way and had to repair it. `tsc` caught both
times — **run it after every bulk edit, not just before commit.**

---

## 6. Visual debugging — the single highest-value lesson

**Verify in the gameplay preview, not an orbiting inspection camera.**

An orbiting camera lets you see an asset in isolation while hiding every problem that
matters in play. On World 2 this cost several wasted iterations, because:

- A single inspection object sitting at the origin **filled the entire preview
  frame** — dead centre of the gameplay camera's path. Several rounds of "fixing the
  city" produced *pixel-identical screenshots* because I was looking at that object,
  not the city.
- **If a change produces a pixel-identical screenshot, stop.** Either the build is
  stale or you are not looking at the thing you changed. Both happened.

When building a gameplay preview into a lab, make sure you **hide the inspection
object**, because it is usually at the origin, which is exactly where the camera looks.

Screenshot, look, judge, fix, repeat. One asset at a time.

---

## 7. Rendering & three.js gotchas learned the hard way

- **Vertex colours are LINEAR 0–1.** `new Color(0x7a3a63).r` is ~0.18, not 122. A test
  comparing a `vertexColors` attribute against 0–255 sRGB values is wrong by a factor
  of ~255. This produced a false test failure that looked like a rendering bug.
- **`MeshBasicMaterial` + `vertexColors` is the house style for scenery.** Sun
  direction is *baked into vertex colours* per face. No lights, no shadow maps, and
  an entire environment merges into one geometry and one draw call. Prefer this.
- **Flat 4-band ramps, not smooth lerps**, for facade lighting — the reference is flat
  vector art with hard facet breaks. Bias the band split **negative** (e.g. start at
  `-0.15`): with the sun this far forward, four of a box's six faces have
  `dot <= 0`, so a 0-based split makes two-thirds of every building near-black.
- **`fogFar` that is too close is worse than no fog.** It washes everything past ~60
  units to flat fog colour and destroys silhouettes. Tune fog *with* real geometry.
  Make the fog colour match what the architecture should dissolve into.
- **Bounds must be measured AFTER all transforms** (shear, stretch, placement), or
  clearance logic reasons about geometry that has since moved.
- **`let x = CONST_SPEC.prop` inherits a literal union type** in TypeScript. If the
  spec is `{a: 6, b: 4.2}`, the variable's type is `6 | 4.2` and *every* reassignment
  fails to compile. Annotate `: number`.
- **Additive blending does not read as glow on a light background** — it just pushes
  toward white. Dusk's sky is light lavender, so additive lantern quads rendered as
  white confetti. Glow needs a radial falloff texture and normal blending, or a dark
  surround.
- **Outlines:** vertex-expansion ("inverted hull") contours produced ghosting and a
  black-hull mess. `LineSegments` is clamped to 1px and aliased to speckle. The
  documented lesson is in `MaterialFactory.ts`: a patched `MeshBasicMaterial` shares
  a program-cache key with every other one, so `onBeforeCompile` can silently reuse an
  unpatched program. A **screen-space post-process outline is the correct approach**
  and remains the clean way to get the reference's outlines.
- **A canyon is two continuous walls, not a scatter.** A random `(x, z)` placement has
  gaps, so you see past it to the sky and to individual detached masses. What makes it
  read as architecture: fixed z-slots with no gaps, a narrow lateral band per depth,
  and masses planted below the frame's lower edge *at their own depth* (that edge
  falls away with distance — see `frameBottomAt` in `src/worlds/dusk/DuskCity.ts`).
- **Size openings from storey height, not facade width.** Sizing by width produces
  openings too tall to fit, which a fit test then silently rejects — whole towers
  render with no windows at all and it looks like a styling problem.
- **Paint details, don't cut holes.** The reference style is flat vector illustration
  where windows are dark shapes on a facade. Painted quads are cheaper, never leak
  holes when geometry is cropped by the frame, and match the art.

---

## 8. Gameplay / UI gotchas

- **The play button has a 0×0 hit rect.** Real clicks do nothing. Dispatch
  `pointerdown` then `pointerup` on the element (or press Space).
- **Canvas input is on the canvas**, not `window`/`document`, during play.
- **`gsap.globalTimeline.clear()` drops in-flight tweens WITHOUT firing their
  `onComplete`.** Anything hidden by a tween callback strands itself permanently.
  This was the root cause of a real bug: the tutorial's "keep hopping" callout was
  left stranded at 50% opacity across multiple Play Agains, only cleared by a page
  refresh. `UIManager.clearTransientFx()` now hides every reset-path element
  *directly*, never relying on a callback. If you add a transient element, do the
  same.
- **World nav arrows only appear at total score ≥ 250** (`WORLD_NAV_REVEAL_SCORE`).
  This surprised the user — it looked like a bug. It isn't. `gameDebug.setTotalScore()`
  bypasses it.
- **`VOID_CONTRAST_FLOOR`** is a contrast tripwire: a dark-sky world's tile faces must
  not sink below it or the next platform disappears into the sky.
- Cyan is reserved as the **tile-rim accent** in Dusk; a test enforces that no tile face
  and no motion cue uses cyan.

---

## 9. Debug API (dev builds only)

`window.gameDebug` — gated behind a dev build; stripped from production.

```
setScore(n)            giveCoins(n)           unlockAllSkins()
toggleInvincible()     unlockAllWorlds()      forceWorld('dusk' | 'void' | null)
straightLane(on)       noSway(on)             hitboxes(on)
spikeScene()           lookInfo()             seedCrystals(seed?)
reseedRunway()         setTotalScore(n)       completeAllMissions()
claimAllMissions()     resetProgress()        triggerWorldCallout()
ballPos()              coins()
```

Use **isolated browser contexts** (`chrome-devtools_new_page` with
`isolatedContext`) when testing saves — the main page's `hop_player_data` is the user's
real save. Back up and restore `hop_player_data` if you must touch it; `hop_save` is
stale and must be ignored.

**Do not simulate long gameplay runs.** The human is the playtester. Automation cannot
reliably time hops (the ball parks waiting for input rather than falling), so you will
burn budget and misdiagnose. Use it for camera framing, console errors, and state checks.

---

## 10. Delegation

Retired. One agent does the work. Do not route tasks to `@screens`, `@playtest`, `@deep`, or `@build`, and do not stop because a named model is missing.

---

## 11. If you are resuming, the natural next steps

1. Week 2's build is in: three worlds, three local songs, and synthesized effects. Do not restyle Sunrise or Dusk, and do not reopen Deep Void, unless the user asks.
2. The owner finished the two human checks on 2026-10-08: a real phone, and a first look by people who did not build the game. No code changes came out of that.
3. Week 3 (skins, icon family, game-over hierarchy) waits until the user asks.
4. Run the three gates before any new commit.
5. Keep the tree clean and `COMMIT_LOG.md` current after each commit.

## 12. Locked decisions

- **Sway tell: do not build.** Week 2 workstream C (a mark only on tiles that will slide) is declined, 2026-10-07. The moving tiles are already visible in play, including the attract demo. Leave the Dusk cyan ribbon as it is. Do not add a Void sway mark, and do not hide the ribbon on static tiles.