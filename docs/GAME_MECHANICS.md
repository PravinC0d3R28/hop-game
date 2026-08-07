# HOP — Verified Game Mechanics

Behavioral spec extracted from the original `BounceTiles` minified source.
All constants reference `GameConfig.ts` in the HOP implementation.

---

## 1. Game States & Transitions

```
BOOT → SPLASH (1.5s fade) → START SCREEN
START SCREEN → (tap) → WAITING_FOR_TAP (game started, ball idle at platform 0)
WAITING_FOR_TAP → (tap) → PLAYING (first jump fired)
PLAYING → (miss) → GAME OVER (shake, fall, 600ms delay, overlay)
GAME OVER → (continue) → reset → START SCREEN (auto re-arms waiting-for-tap)
```

Two distinct taps: **tap #1 starts the run** (hides menu), **tap #2 fires the first jump**.

### Input rules (pointer events on canvas + overlays)
- `pointerdown` blocked if: paused, shop open, game-over open, reset cooldown active,
  or target is the shop button.
- If not started → `start()`; if waiting for tap → first jump.
- Otherwise begin drag: record `startClientX`, `startXTarget`.
- `pointermove`: `xTarget = clamp(startXTarget + (clientX - startX) * -0.028, -5, 5)`
  (note: `*-0.028`, i.e. dragging right moves ball left, camera-space).
- `pointerup` / `pointercancel`: end drag.
- `shop-btn` stops propagation (does not trigger drag/jump).

---

## 2. Ball Physics

### Horizontal (every frame while started & not failed)
```
ballX = lerp(ballX, xTarget, 0.16)
ballGroup.x = ballX
```

### Jump (fires via Qd, auto-chains)
```
duration = max(0.35, 0.5 - score * 0.0005)
f(t) = t<0.5 ? 2*t² : 1 - (-2t+2)²/2     // easeInOutQuad
z = lerp(curZ, nextZ, f(t))
y = lerp(startY, endY, f(t)) + sin(π·t) * 2
```

Squash/stretch keyframes during the jump:
- `t < 0.2`: stretch up `scaleY = 1 + t/.2*.1`, `scaleXZ = 1 - t/.2*.05`
- `t > 0.85`: squash down `scaleY = 1 - (t-.85)/.15*.15`, `scaleXZ = 1 + (t-.85)/.15*.08`
- otherwise `(1,1,1)`

On complete:
- ball bounce `scale→(y:.85, x:1.08, z:1.08)` 0.06s yoyo ×2
- landing platform squash `(y:.7, x:1.08h, z:1.08h)` 0.08s yoyo ×2
- jump dust spawn (`Uy`), scoring, then **auto-call Qd() for next jump**

### Failure check (on landing, before scoring)
```
hitX = platformX + swayOffset   // swayOffset is ALWAYS 0 in the shipped build
if |ballX - hitX| > 1.1 → GAME OVER
```

---

## 3. Scoring

| Event | Score |
|-------|-------|
| Landing | +1 |
| coin collect | +1 (plus +1 coin) |
| Perfect hit (|ballX−hitX| < 0.5) | +streak (1,2,3…) |

After perfect, `dt.perfectStreak++`, score `+= streak`; else streak resets to 0.
Score display bounces (scale 1.15→1, back.out(2)).

### Speed lines intensity
```
intensity = clamp((score - 15) / 70, 0, 1)
```
Spawns when `intensity > 0`, up to 30 lines; spawn interval
`SPEED_LINES_SPAWN_RATE / max(0.1, intensity)`; batch of `1 + floor(intensity*3)` per tick.

---

## 4. Platform System

### Per-platform values (derived from score)
```
spacing     = min(4.5, 3.5 + score * 0.0025)
xRange      = min(3, 1.2 + score * 0.02)      // NOTE: ramp 0.02
scale       = 1 - min(1 - 0.9, score * 0.00012)
```

### Creation (index i)
- X: `(random()-0.5)*2*xRange` (0 for i≤1)
- Y: `0` (rise for i>2 from -5); recycle uses same rise tween `back.out(1.2)`, 0.5s, delay .1
- Z: `i * spacing`
- Mesh: Box(2.2, .8, 2.2) halftone-toon palette color + outline(1.02)
- **Perfect indicator**: diamond `ShapeGeometry` (0.15 half-size) white 0.5 + ring
  `RingGeometry(.18, .24, 24)` white 0.3 double-side, both rotated flat, y = h/2 + .01
- coin (28% chance): coin `CylinderGeometry(.22, .22, .06, 16)` rotated Z=+π/2 (lying
  flat) + outline(1.08), y = h/2 + .22 + .15

### Recycling (when `index < currentStep - 3`)
Reuse pool entry: `Lr++`, new index = Lr, recompute z/x/scale/color, hide to y=-5,
tween up, respawn coin (or clear). Pool size = 6 (`VISIBLE_STEPS`).

---

## 5. coin collection

- Trigger on landing when `|ballX - hitX| < 0.8` (COIN_COLLECT_THRESHOLD)
- Effects: tween scale→0 (0.2s), remove from platform
- Rewards: `roundCoins++`, `totalCoins++`, `score++`, coin sound, coin UI refresh
- Idle animation: `rotation.y += dt*2.5`, `y = h/2 + .22 + .15 + sin(now*.004)*.08`

---

## 6. Camera

```
targetX  = ballX - clamp(ballX - camX, ±0.5) then lerp .15   // "Ir" dead-band
Pr = (Ir, 9.5, ballZ - 8.5)
cam.x = lerp(cam.x, Pr.x, .12)
cam.y = lerp(cam.y, Pr.y, .04)
cam.z = lerp(cam.z, Pr.z, .06)
lookTarget = (Ir, .9, ballZ + 3);  lerp .08; lookAt
```
- FOV: base 55; if aspect < 1 → `55 + (1-aspect)*30`
- Game-over shake: 6× random offsets (±.15 x, ±.075 y), 0.04s each

---

## 7. Ground Shadow (ball)

```
y = platformHeight/2 + .02
shadow.scale = clamp(1 - (ballY - y)*.15, .3, 1)
shadow.opacity = clamp(.35 - (ballY - y)*.06, .05, .35)
```
Circle(0.35, 16), color = theme shadowColor, rot -π/2.

---

## 8. Background Decorations

- 10 clusters (2-4 spheres each, halftone-toon + outline 1.04)
- Alternate sides: x = ±(6 + rand*3); z = i*5 + 4; y = 1 + rand*3
- Bob: `y = baseY + sin(now*.3 + i*1.5)*.15`
- Recycle when `z < camZ - 10`: new z = `Ms*5+4`, new side/x/y
- Colors: light = `[0xB8C8D8, 0xC0D0E0, 0xB0C0D0, 0xC8D8E8]`,
  dark = `[0x444455, 0x3A3A4A, 0x4A4A5A, 0x505060]`

---

## 9. Visual Effects

### Jump dust (5-6 particles)
white sphere + outline sphere child, expand+fade over .3-.4s, `vy` then gravity `-1.5*dt`.

### Perfect hit
1. diamond pulse (opacity 1 yoyo×2, scale 1.8 yoyo×2, .15s)
2. gold ring: RingGeometry(.2,.3,32), scale `6 + streak*.5` over .5s, fade
3. streak ≥ 3 → 8 burst spheres (gold), radial velocity 1.5-2.5, life .4
4. full-screen gold flash overlay `rgba(255,215,0, .15+.03*streak capped .35)`, .3s
5. score elastic scale

### Fire streak (10 perfects)
- **Screen fire (`FireOverlay`, zero-dep 2D canvas, additive)**: a living fire
  band along the bottom edge — rising flames that shift white-hot → orange →
  red as they age, plus ember sparks — a pulsing heat vignette, and a
  burst flash + shockwave ring on each fresh 10-streak. Own rAF loop; only runs
  while lit, fades out on game over/reset.
- **3D ball burst (`EffectsSystem.playFireBurst`)**: ~30 additive flame/ember
  particles (upward-biased) + an expanding shockwave ring + a central flash pop.
- **FIRE banner** (DOM) + one-time shield grant on the milestone.

### Speed lines
box(.04,.04,1) translated z .5, lookAt toward target, scale z `3..9+6*intensity`,
alpha `(.12+.3*intensity)*(.5+rand*.5)`, velocity toward `(15..40)+25*intensity`,
life `0.45 + rand*.15`. Fade in/out.

### Confetti (new best, 60 pieces)
colors `[#FFD700,#FF4444,#44AAFF,#44FF88,#FF44AA,#8844FF,#FF8800]`, size 6-14px,
random x offset ±60, fall `power1.in` 1.2-2.7s, rotation ±360.

---

## 10. Audio (procedural)

| Event | Notes |
|-------|-------|
| jump | sine 440+r%8·30 (0.12s, .2) + ×1.5 (0.08s, .1) |
| coin | sine 880 (.1,.25) → 1100 (50ms) → 1320 (100ms, .15) |
| perfect | base 660+min(streak,10)·60; +×1.25 (60ms) +×1.5 (120ms); streak≥3 +×2 (180ms) |
| gameover | sawtooth 200 (.3,.25) + square 150 (.4,.15, detune -50) |

AudioContext lazy-created; resumed on first user gesture; suspended on pause.

---

## 11. Persistence (standalone: localStorage)

Key: `hop_player_data`. JSON shape identical to `Zt`. On load, sanitize like the
original `QM()`:
- ensure `purchasedSkins` array contains `default`
- default missing fields (`totalCoins`=0, `bestScore`=0, `selectedSkin`=default, `theme`=light)
- merge: keep max coins/bestScore, union purchased skins, latest theme/skin

---

## 12. Shop

9 skins (see ARCHITECTURE §2.3). Buy: deduct coins, add to purchased, auto-equip.
Equip: set selected. UI: preview circle = skin color hex (or `#111` if not owned),
status "Owned"/"EQUIP"/"BUY price". Buttons disabled if can't afford. Shop footer
shows total coins.

---

## 13. Failure → Game Over Sequence

```
miss → isFailed = true, gameover sound, clear speed lines
camera shake (6 offsets)
ball falls y-5 (0.6s, power2.in), scale→.5
if score > best: best = score; new-best flag; confetti
600ms → hide score/coin counter, show overlay:
  SCORE, BEST (crown), NEW BEST! (if any), +roundCoins (gold),
  TOTAL coins (counts up if roundCoins>0, dur min(.8+.05*roundCoins,2), delay .4)
continue button → reset (debounced 500ms) → start screen + request ad (omitted standalone)
```

---

## 14. Fidelity Notes / Known Deviations in the Old Docs

| Claim (old docs) | Actual |
|------------------|--------|
| `PLATFORM_X_RANGE_RAMP = 0.00002` | **0.02** |
| `COLOR_BALL = 0xD119F0` | **0xD0D8F0** |
| `COLOR_COIN = 0xF0E68C` | **0xF0C020** |
| palette set | 8 pastel palettes (table in ARCHITECTURE §2.2) |
| "Perfect indicator = dot + ring" | **diamond + ring** |
| "platform sway animation" | **no sway (swayOffset always 0)** |
| skin green `0x45A848`, cyan `0x44FFAF` | green **0x44FF88**, cyan **0x44FFFF** |

---

## 15. Mission Economy (session-based, Iteration 7)

### 15.1 Scoring model (drives every target)

Each landing gives **+1** base score. A perfect landing (within `PERFECT_THRESHOLD`
0.5 of the platform center) **also** adds its streak length (`score += perfectStreak`,
which is 1, 2, 3, … on consecutive perfects). a coin adds **+1** on top. `COIN_CHANCE`
= 28% of platforms.

Expected score per landing for a player with perfect rate `p`:

```
bonus per landing ≈ p²/(1−p)        (mean perfect-run bonus)
score per landing ≈ 1 + p²/(1−p) + 0.28
```

| perfect rate p | multiplier |
|----------------|------------|
| 0.4 (beginner) | ~1.6× |
| 0.5 (casual)   | ~1.8× |
| 0.6 (steady)   | ~2.2× |
| 0.7 (hardcore) | ~2.9× |

Cadence: `JUMP_DURATION_BASE` 0.5s → 0.35s, so a focused player sustains
~1.7–2.2 landings/sec.

### 15.2 Player session archetypes (target sizing)

| archetype | run length | landings | score | perfects | coins | streak |
|-----------|-----------|----------|-------|----------|------|--------|
| easily bored | 20–40s | ~35–70 | 55–150 | 14–35 | 10–20 | 3–5 |
| casual (mid) | 1–2 min | ~100–240 | 155–420 | 40–120 | 28–67 | 5–9 |
| hardcore | 3–6 min | 300–700 | 470–1500+ | 120+ | 84–196 | 10–20+ |

### 15.3 Worlds (selection, not run gates)

Each world is a **separate playable space** chosen on the start screen: a back
arrow pinned to the **center-left edge** and a next arrow pinned to the
**center-right edge**, both vertically centered, each labeled `World 1/2/3`.
The selected world's name is the start-screen title (the old Bounce Tiles logo
is retired to a future loading screen). Worlds unlock by **lifetime total
score** (1,000 → dusk, 5,000 → void); a locked arrow shows a small lock +
threshold. Clicking a locked arrow makes the world "load" briefly (≈350 ms),
then a **gaussian-blur translucent screen** covers the view with a lock card:
name hidden as `????`, a one-line description, an unlock progress bar and the
points remaining. While locked, clicking anywhere never starts a run; the back
arrow stays clickable above the blur so the player can navigate away. Missions
and shop buttons fade out under the blur. An occasional "too easy?"-style
thought bubble taunts the player near a locked next arrow. The selection
persists in the save (`selectedWorld`) and survives reloads; the safety clamp
falls back to the highest unlocked world for hand-edited saves. A dedicated
**TAP TO PLAY** button is the only start-screen area that starts a run (no more
tap-anywhere), and the day/night theme toggle is removed.

A run **never changes worlds**: score always starts at 0 and the difficulty
curves bind to the *tier score* = run score − the world's entry offset
(0 / 100 / 250), so each world's ramp profile matches the old mid-run bands.
Per-world bests (`bestPerWorld[3]`) track the best run in each world.

World missions are **selection-scoped**: only the selected world's missions are
active; the other worlds' rows show locked in the WORLD tab.

| world | entry offset | unlock | perfects target | coins target | score target | reward pool |
|-------|-------------|--------|-----------------|-------------|--------------|-------------|
| sunrise | 0 | always | 10 | 8 | 75 | 37 |
| dusk | 100 | 1,000 total | 20 | 15 | 220 | 75 |
| void | 250 | 5,000 total | streak 12 | 25 | 400 | 115 |

Score targets sit inside their world's tier band (75 < 100 < 220 < 250 < 400)
so the mission can only complete in that world. Rewards scale with difficulty
(37 → 75 → 115 one-time).

### 15.4 Daily general pool (economy reset)

5 missions/day from a **30-mission pool (10 easy / 10 medium / 10 hard)**, drawn
round-robin per tier: consecutive days get disjoint sets and the full pool
cycles with no repeats — easy/medium rotate through all 10 every 5 days, hard
every 10 days. All general missions are session-based (progress persists across
runs, completes once); the pool draws reset at local midnight (`todayKey()`).

| tier | session cost | score | coins | perfects | streak | reward |
|------|--------------|-------|------|----------|--------|--------|
| easy | ~1 short session | 25–50 | 5–8 | 10–15 | 8 | 10–15 |
| medium | ~1 mid session | 100–150 | 12–15 | 20–30 | 10 | 20–30 |
| hard | 2–4 mid sessions / 1 long run | 250–350 | 25 | 40–60 | 18 | 40–50 |

Daily ceiling ≈ 155 coins/day; shop prices 50–200, world missions grant 227
one-time, lifetime grants 310 one-time. The DAILY tab shows a live countdown to
the next reset (local midnight, `getTimeUntilNextReset` / `formatCountdown`).

### 15.5 Semantics rules (implementation contract)

- **Lifetime**: derived from persisted counters (`totalScore`, `totalCoinsCollected`,
  `totalPerfects`, `bestStreak`); complete the moment the counter passes target.
- **General / world**: run counters are banked into persisted `missionProgress`
  capped at the target; only the delta since the last evaluation this run is
  banked (`runMissionBanked` guard), so mid-run evaluation is idempotent.
- **Streak is a max, not a counter**: progress keeps the best run value ever
  reached — two runs of 10 do **not** make 20.
- **Locked worlds never bank**: `getActiveMissions(worldId)` returns only the
  selected world's missions; the missions overlay shows the same lock state
  (`locked = m.world !== run.selectedWorld`), so a non-selected world never
  fills. Row tooltips distinguish "Play in <world> to progress its missions"
  (unlocked but not selected) from "Unlocks at <N> total score" (threshold not
  met).


