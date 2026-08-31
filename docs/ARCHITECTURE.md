# HOP — Verified Reverse-Engineering Spec

This document is the **authoritative** analysis of the original *BounceTiles* game
(source: `BounceTiles/index-zMHsYNx1.js`, the minified production bundle shipped on
YouTube Playables). Every value below was verified directly against the decompiled
source. Where earlier documentation differed, this document wins.

---

## 1. Original Game Identity

| Field | Value |
|-------|-------|
| Title (in-game) | **HOP** (HTML `<title>` is "HOP") |
| Engine | Three.js (r152 build) + GSAP 3.14.2 |
| Rendering | WebGLRenderer, antialiased, pixelRatio capped at 2 |
| Platform SDK | YouTube Playables (`ytgame.game|ads|engacoinent|system|health`) |
| Audio | Procedural Web Audio API (no audio files) |
| Target | 60fps on mobile, `< 50MB` memory |

The original is a single minified bundle: `index-zMHsYNx1.js` (Vite build) plus
`index.html`, `Logo.png`, `splash.png`, `Coin.png`, `cart.png`, `indicator.png`.

---

## 2. Global State Objects

### 2.1 Config object `j` (ALL values verbatim)

```js
j = {
  PLATFORM_WIDTH: 2.2,
  PLATFORM_DEPTH: 2.2,
  PLATFORM_HEIGHT: 0.8,
  PLATFORM_SPACING_Z: 3.5,
  PLATFORM_X_RANGE: 1.2,
  PLATFORM_X_RANGE_RAMP: 0.02,        // <-- NOT 0.00002 (docs were wrong)
  PLATFORM_X_RANGE_MAX: 3,
  VISIBLE_STEPS: 6,
  PLATFORM_RISE_DURATION: 0.5,
  BALL_RADIUS: 0.35,
  JUMP_DURATION_BASE: 0.5,
  JUMP_DURATION_MIN: 0.35,
  JUMP_DURATION_RAMP: 0.0005,
  BOUNCE_HEIGHT: 2,
  X_LERP: 0.16,
  HIT_THRESHOLD: 1.1,
  COIN_CHANCE: 0.28,
  COIN_RADIUS: 0.22,
  COIN_COLLECT_THRESHOLD: 0.8,
  PLATFORM_SIZE_MIN: 0.9,
  PLATFORM_SIZE_RAMP: 0.00012,
  PLATFORM_SPACING_Z_RAMP: 0.0025,
  PLATFORM_SPACING_Z_MAX: 4.5,
  CAMERA_OFFSET_Y: 9.5,
  CAMERA_OFFSET_Z: -8.5,
  CAMERA_LOOK_AHEAD: 3,
  COLOR_BG: 0x2A2A2A,
  COLOR_BALL: 0xD0D8F0,               // <-- NOT 0xD119F0 (docs were wrong)
  COLOR_COIN: 0xF0C020,                // <-- NOT 0xF0E68C (docs were wrong)
  COLOR_OUTLINE: 0x111111,
  COLOR_CYCLE_STEPS: 12,
  COLOR_PALETTES: [ ...8 entries below ],
  DOTS_SCALE: 0.3,
  DOTS_STRENGTH: 0.25,
  DOTS_SHADOW_MIN: 0.25,
  DOTS_SHADOW_MAX: 0.55,
  PERFECT_THRESHOLD: 0.5,
  PERFECT_DOT_RADIUS: 0.18,
  SPEED_LINES_START_SCORE: 15,
  SPEED_LINES_MAX_COUNT: 30,
  SPEED_LINES_SPAWN_RATE: 0.03,
  SPEED_LINES_LIFETIME: 0.45,
  AUDIO_ENABLED: true,
  SHOP_SKINS: [ ...9 entries below ]
};
```

### 2.2 COLOR_PALETTES (8 verified pastel palettes)

Cycle: `paletteIndex = (randomStart + floor(platformIndex / 12)) % 8`.
Per-platform color: lerp between base and light, t = `(index % 6) / 6 * 0.5`.

| # | base | light |
|---|------|-------|
| 0 | `0x3B9DFF` | `0x6BB8FF` |
| 1 | `0x9B4DFF` | `0xB97AFF` |
| 2 | `0xFF4D8A` | `0xFF7AAA` |
| 3 | `0x2ECC40` | `0x5DDB6E` |
| 4 | `0xFFB020` | `0xFFC850` |
| 5 | `0x00CEC9` | `0x40E8E4` |
| 6 | `0xFF6348` | `0xFF8A70` |
| 7 | `0xFFD32A` | `0xFFE066` |

### 2.3 SHOP_SKINS (9 verified entries)

| id | name | color | price |
|----|------|-------|-------|
| default | Classic | `0xD0D8F0` | 0 |
| red | Ruby Red | `0xFF4444` | 50 |
| blue | Ocean Blue | `0x4488FF` | 50 |
| green | Emerald | `0x44FF88` | 75 |
| gold | Golden | `0xFFD700` | 100 |
| purple | Violet | `0x8844FF` | 100 |
| pink | Bubblegum | `0xFF44AA` | 125 |
| cyan | Cyber Cyan | `0x44FFFF` | 150 |
| shadow | Shadow | `0x333333` | 200 |

### 2.4 Runtime state `dt`

```js
dt = { score:0, currentStep:0, isJumping:false, isFailed:false,
       isStarted:false, isWaitingForTap:false, xTarget:0, ballX:0,
       perfectStreak:0, roundCoins:0 }
```

### 2.5 Persistent player data `Zt` (default)

```js
Zt = { totalCoins:0, bestScore:0, purchasedSkins:["default"],
       selectedSkin:"default", theme:"light" }
```

### 2.6 Themes `hy`

| theme | bg | cssBg | icon (button) | shadowColor |
|-------|----|-------|---------------|-------------|
| light | `0xE8DDD0` | `#e8ddd0` | ☾ | `0xB8A898` |
| dark | `0x2A2A2A` | `#2a2a2a` | ☀ | `0x1A1A1A` |

Note: the button icon shows the *opposite* state you switch TO (☾ on light = click to go dark).

---

## 3. Geometry Class Mapping (minified → Three.js)

| Minified | Three.js class | Usage |
|----------|----------------|-------|
| `hr` | BoxGeometry | platforms `(2.2,.8,2.2)`, speed lines `(.04,.04,1)` |
| `fr` | SphereGeometry | ball `(.35,24,16)`, rocks, dust `(1,8,6)`, ball blob `(.35*.92,16,8,.3,1.2,.2,1)` |
| `Ac` | CylinderGeometry | coins `(.22,.22,.06,16)` rotated Z=+π/2 |
| `Ja` | RingGeometry | perfect dot `(.18,.24,24)`, perfect ring `(.2,.3,32)` |
| `Ks` | CircleGeometry | ground shadow `(.35,16)`, burst particles `(.06,6)` |
| `Rc` | ShapeGeometry | diamond perfect indicator |
| `wf` | Shape | diamond path |
| `Tn` | MeshBasicMaterial | outlines, shadows, particles |
| `Pc` | MeshToonMaterial | halftone-toon materials |
| `ve` | Mesh | generic mesh |
| `Mi` | Group | entities |
| `E_` | AmbientLight | `(0xFFFFFF, .38)` |
| `y_` | DirectionalLight | `(0xFFFFFF, 2)` at `(3,10,8)` |
| `Tc` | Fog | `(color, 14, 40)` |
| `Im` | Scene | scene |
| `Mn` | PerspectiveCamera | `(55, aspect, .1, 100)` |
| `MS` | WebGLRenderer | antialias |
| `Vt` | Color | color math |
| `U` | Vector3 | vectors |
| `kn` | MathUtils | lerp / clamp |
| `re` | gsap | animation |
| `b_` | Clock | frame delta (capped 50ms) |
| `Mf` | CanvasTexture | procedural halftone / gradient maps |

---

## 4. Object Graph (topology)

```
Scene (Pe)
├── Fog (COLOR_BG, 14, 40)
├── AmbientLight (0xFFFFFF, 0.38)
├── DirectionalLight (0xFFFFFF, 2) @ (3,10,8)
├── Ball Group (Gt)
│   ├── Ball Mesh (Vd)   Sphere(.35,24,16) halftone-toon ball color
│   ├── Outline (my)     Sphere scaled 1.06, MeshBasic outline color
│   └── Blob highlight   partial sphere white .55 @ (.06,.08,-.04)
├── Ground Shadow (ns)   Circle(.35,16) theme shadow color, rot -PI/2
├── Platforms x6 (cr)    each Group: box mesh + outline(1.02) + diamond + ring + coins
├── Background x10 (Ni)  rock clusters (2-4 spheres each + outlines)
├── Particles (sr)       jump dust, perfect burst
└── Speed lines (ar)     boxes pointing -Z, 15..30
```

---

## 5. Halftone Toon Shader (verified GLSL)

MeshToonMaterial with `onBeforeCompile` patch + shared uniforms `Cn`:

```
uniforms: uHalftone(texture), uDotsScale, uDotsStrength,
          uDotsShadowMin, uDotsShadowMax, uLightDir(normalized)
```

Fragment patch (injected at `#include <dithering_fragment>`):
1. Tri-planar blend weights from world normal:
   `blend = |normal| / sum(|normal| + 0.001)`
2. Sample halftone dots on 3 planes: `texture2D(uHalftone, vWorldPos.xz * uDotsScale)` etc.
3. Blend: `dots = dotsXZ*blend.y + dotsXY*blend.z + dotsYZ*blend.x`
4. Shadow mask: `NdotL = dot(normalize(vWorldNormal), uLightDir)`;
   `shadowMask = smoothstep(uDotsShadowMax, uDotsShadowMin, NdotL*.5 + .5)`
5. Darken in shadows only:
   `gl_FragColor.rgb = mix(color, color*.55, dots*shadowMask*uDotsStrength)`

`customProgramCacheKey = "halftone-toon"`.

Procedural textures:
- **Halftone** (128x128): black canvas, white dots of radius 4 on 14px grid, RepeatWrapping.
- **GradientMap** (4x1): `#404040, #909090, #d0d0d0, #ffffff`, NearestFilter (4-step toon ramp).

---

## 6. Key Functions (minified → purpose)

| Minified | Purpose |
|----------|---------|
| `eo(r, t)` | outline mesh maker (scale t, default 1.05) |
| `WM` | randomize palette start offset |
| `XM(r)` | palette for index r |
| `$c(r)` | platform material color for index r |
| `YM` / `qM` | ball / coin halftone materials |
| `Bd`/`zh`/`ac` | AudioContext lazy init / get / resume |
| `Ln` | tone player (freq, dur, type, gain, detune) |
| `ZM(r)` | jump sound (440+r%8*30, *1.5) |
| `JM` | coin sound (880→1100→1320) |
| `KM(r)` | perfect/combo sound (660+min(r,10)*60 arpeggio) |
| `$M` | game over sound (saw 200, square 150 -50) |
| `QM` | sanitize loaded player data |
| `ts` | save data (ytgame / storage) |
| `ty` | ytgame lifecycle init |
| `ey` | send score + save (delayed 0ms) |
| `ny` | interstitial ad throttle (every jM=2 runs) |
| `es(r)` | apply skin color to ball |
| `as` | refresh coin displays |
| `io` | refresh best score display |
| `no(r)` | apply theme |
| `fy` | recolor background decorations per theme |
| `vy(r)` | create rock cluster i |
| `Sy`/`My` | recycle / bob background clusters |
| `Ty`/`su` | X-range / random platform X |
| `qd` | platform scale (shrinks) |
| `au` | platform spacing |
| `by(r)` | create platform pool entry |
| `ou(r)` | add coin to platform (28%) |
| `Zd(r)` | remove/dispose platform coins |
| `Ay` | recycle platforms behind camera |
| `wy` | camera follow (lerps) |
| `$d` | pointer down (start / first-jump / begin drag) |
| `jd` | pointer move (drag aim, `*-.028`, clamp ±5) |
| `lu` | pointer up/cancel |
| `Cy` | jump duration (ramps down) |
| `Qd` | **jump + auto-chain** (recurses) |
| `Py` | perfect effects (flash, ring, burst, screen flash) |
| `Dy` | coin collect (scale down + score/coin) |
| `Uy` | jump dust particles |
| `Ny` | update/expire particles |
| `ep` | speed-line intensity `clamp((score-15)/70, 0..1)` |
| `Fy` | spawn speed line |
| `Oy` | update speed lines + spawner |
| `np` | clear speed lines |
| `By` | game over (shake, fall, delay 600ms) |
| `zy` | show game over screen |
| `ky` | confetti (60 pieces, 7 colors) |
| `Gy` | start game (hide menus, show score) |
| `Vy` | full reset (re-init pools) |
| — | `guidedRetry()` (added for Workstream D checkpoint retries) |
| — | `pauseGame()` / `resumeWithCountdown()` (added for Workstream B pause system) |
| `uc` | rebuild shop UI |
| `Hy` | rotate/bob coins |
| `ip` | **main loop** |
| `rp` | resize handler |

---

## 7. Standalone Build Deviations (deliberate)

The HOP reimplementation is a **pure standalone** build, so relative to the original:

- **No YouTube Playables SDK** (`ytgame` removed). Persistence uses `localStorage`
  (key `hop_player_data`) with the same merge/sanitize semantics as `QM()`.
- No ad requests. Continue button always resets.
- `firstFrameReady`/`gameReady` signals omitted.
- Everything else (rendering, physics, UI, economy) is faithful.

See `GAME_MECHANICS.md` for exact behavioral specs and `CUSTOMIZATION_GUIDE.md`
for the extension surface.


