# Week 2 Baseline Snapshot (pre-art)

Comparison snapshot recorded before Week 2 art/audio work, per
`HOP_WEEK_2_DEVELOPMENT_GUIDE.md` §7. Purpose: attribute any Week 2 frame-time
or bundle-size surprises to the art/music changes, not to hidden drift.

- Date: 2026-09-02
- Baseline commit: `c2410c0` (docs: append commit log entry for b23d010)
- Node/npm: as installed via `package-lock.json`
- Browser: Chrome via CDP (playtest browser), AMD Radeon 780M (D3D11)

## 1. Build pipeline

| Step | Result |
|---|---|
| `npm install` | Not re-run (lockfile unchanged since Week 1) |
| `npm run typecheck` | 0 TypeScript errors |
| `npm test` | **181 passed, 0 failed** (13 test files) |
| `npm run build` | Success (vite v5.4.21, 31 modules, built in 1.33s) |

Session 0 reference: 174 tests (12 files). The +7 tests are the Week 1
workstreams (pause, perfect popups, checkpoint retry, missions baseline).

## 2. Production bundle (dist/)

| File | Uncompressed | Gzip |
|---|---|---|
| `index.html` | 96.00 kB | 17.99 kB |
| `assets/index-*.js` (game) | 140.01 kB | 37.87 kB |
| `assets/gsap-*.js` | 70.44 kB | 27.81 kB |
| `assets/three-*.js` | 460.78 kB | 117.50 kB |
| **HTML + JS total** | **767.23 kB** | **201.17 kB** |

Session 0: 729.34 kB / 192.53 kB gzip → **+38 kB / +8.6 kB gzip** from the
Week 1 flow features (pause system, perfect popups, checkpoint retry,
missions baseline). No action needed.

> Vite note: `fonts/fredoka-latin.woff2` emits a build-time warning
> ("didn't resolve at build time, will remain unchanged") — pre-existing
> since `iter14-fix4`; the font is served from `public/fonts/` and loads
> fine at runtime.

### dist/ asset inventory (largest first)

| Asset | Size |
|---|---|
| `lock-icon.png` | 949.4 kB |
| `stats-icon.png` | 746.3 kB |
| `settings-gear.png` | 702.9 kB |
| `sparkle-star.png` | 481.4 kB |
| `assets/three-*.js` | 460.8 kB |
| `arrow-left.png` | 425.4 kB |
| `arrow-right.png` | 425.3 kB |
| `tap-to-play.gif` | 311.4 kB |
| `assets/index-*.js` | 140.0 kB |
| `index.html` | 96.1 kB |
| `assets/gsap-*.js` | 70.4 kB |
| `fonts/fredoka-latin.woff2` | 29.7 kB |
| `Coin.png` | 27.2 kB |
| `favicon.png` | 13.0 kB |
| `cart.png` | 8.9 kB |
| `crown.svg` | 1.3 kB |

**Total dist/ size: 4.67 MB** (4,894,009 bytes, no sourcemaps).

### ⚠ Size regression vs Session 0 (1.9 MB → 4.67 MB, +2.77 MB)

Cause: the four Week 1 UI icon PNGs added for the settings/stats/lock
buttons and the sparkle stars are **uncompressed-resolution PNGs**:

| Icon | Size |
|---|---|
| `lock-icon.png` | 949.4 kB |
| `stats-icon.png` | 746.3 kB |
| `settings-gear.png` | 702.9 kB |
| `sparkle-star.png` | 481.4 kB |
| **Total** | **2.88 MB** |

These four files are now **62% of the shipped package**, larger than
three.js. They render at ~38–62 CSS px (top buttons) — likely exported at
1024×1024 or similar. Session 0's largest asset was 415 kB
(`arrow-left.png`); the new worst offender is 949 kB.

**Recommendation before music lands (§13.4):** re-export these four icons
at display resolution (e.g. 128×128, which is 3× the 38–62 px top-button
size at DPR 2) or run them through an optimizer (tinypng/pngquant). Doing
this **before** adding ~4–6 MB of music keeps the Week 2 comparison honest
and stays far inside YouTube's 15 MB initial-bundle guidance. Recorded here
as a Week 2 finding, not fixed in the snapshot itself (its purpose is
measurement, not optimization — §7).

## 3. Browser load (production build via `vite preview`, localhost:4173)

- Initial console errors: **0**
- Network requests on load: **17, all 200/304, all same-origin** (13 at
  Session 0; the 4 new requests are the icon PNGs above)
- External dependency: **none** — no Google Fonts, CDN, or streaming
  request. Fredoka loads locally.

## 4. Frame rate & draw calls (attract demo, start screen)

Desktop 1280×800 (DPR 1.25):

| Metric | Value |
|---|---|
| Average FPS | 60.0 |
| p99 frame time | 18.0 ms |
| Worst frame | 18.4 ms |
| Avg draw calls / frame | 67.9 |
| Max draw calls / frame | 92 |

Mobile 390×844 (DPR 3, touch emulation):

| Metric | Value |
|---|---|
| Average FPS | 60.2 |
| p99 frame time | 17.5 ms |
| Worst frame | 20.4 ms |
| Avg draw calls / frame | 65.8 |
| Max draw calls / frame | 82 |

Session 0 reference: 60.1/60.2 fps, 17.1/16.9 ms p99, 66.9/48.6 avg draws.
Frame time and draw calls are **unchanged** within noise on desktop; mobile
draw calls are up (48.6 → 65.8) but mobile FPS is identical (60.2) — the
mobile increase is likely the DPR-3 emulation being heavier on this
machine than Session 0's setup, plus a few more visible platforms in the
Week 1 layout. Not a regression the art pass must answer for; the numbers
here are the reference the art pass will be compared against.

Draw-call counting this time used a `drawElements`/`drawArrays` prototype
hook injected before load (no public debug API exists in production, per
the Session 0 gate).

## 5. Offline behavior

- Load once, then emulate network Offline: the game keeps running at
  ~60 fps, zero new network errors. The only post-offline entries in the
  network panel are inline `data:` URIs (the procedural halftone textures)
  and the expected failed document reload.
- `navigator.onLine` stays `true` under CDP offline emulation (known CDP
  quirk) — the meaningful check is "no new network requests + rAF alive",
  which passed.
- Reload while offline: still fails (no service worker) — unchanged from
  Session 0, expected.

## 6. Known observations (noted for Week 2, not fixed here)

1. **Icon PNG weight (P1 for Week 2):** the four Week 1 UI icons add
   2.88 MB (62% of package). Re-export/optimize before music integration
   so the music size delta is measurable on a clean base.
2. `arrow-left.png` / `arrow-right.png` (425 kB each) remain oversized for
   their display size — same optimization pass can cover them.
3. `npm audit` advisories: unchanged from Session 0, out of scope.
4. No service worker — reload-while-offline still unsupported (Session 0
   known behavior).

## Baseline exit gate (§7.3)

- [x] typecheck and tests pass (181/181)
- [x] production build passes
- [x] Week 2 snapshot numbers written down (this file)
- [x] the art spike has a scheduled first session (built + shot 2026-09-02)

## 7. Art-spike decision (LOCKED 2026-09-02, §9.5)

Four outline candidates shot on one frozen Sunrise+Dusk-tell scene
(8 stills: desktop 1280×800 + mobile 390×844; all modes 60 fps —
the decision is purely visual, not performance).

- **Locked V1 pipeline: mode 0 — current thick black inverted-hull
  outlines on everything** (platforms, ball, coins, props). Keep as-is;
  revisit only if a later world pass feels off.
- **Rejected: mode 1 tinted-rim** — inconsistent in practice (cloud rims
  read wrong/off against the cream sky).
- **Not selected: mode 3 contrast-only.**
- **Pre-approved fallback: mode 2 playable-only** (black kept on
  ball+platforms, bare props; measured −16 draws desktop, −16 mobile).
  Implementation preserved in git history (`39b7384`); re-implementable
  in ~30 min if black hulls feel heavy later. Losing variants deleted
  from `SpikeLab` — production/dev ships exactly one edge path.
- **Motion cue (provisional): cyan glow strip** under the moving tile's
  bottom edge + violet face — the spike's candidate tell, constant across
  all four modes. Revalidated in the Day 2 Dusk freeze-frame check; cheap
  to change (one strip mesh, not a pipeline).
- **Halftone dots: unchanged (stay).** No dot variant was spiked.
- **Void: excluded from the spike by design;** dark-scene contrast pass
  scheduled Day 3.

Day 1 (shared `WorldLook` pipeline + Sunrise paint) is unblocked: it is
built on the mode-0 lock, so no edge shader gets rewritten three times.

## 8. Sway tell declined (2026-10-07)

Week 2 workstream C asked for a mark only on tiles that will slide. The owner
declined it: the moving tiles are already obvious in play, including the attract
demo. Do not build a per-tile tell, do not add one on Void, and do not change
which Dusk tiles show the cyan ribbon.

## 9. Post-art measure (2026-10-07)

Checked the shipped worlds against this snapshot. No art was changed.
Music is not in the build. Same machine and GPU as section 4
(AMD Radeon 780M, D3D11, Chrome).

Attract demo, about 4 seconds after the world had settled. Draw calls are
`drawElements` + `drawArrays`, same method as section 4. Laptop 1280×800 at
device pixel ratio 1.25. Phone 390×844 at device pixel ratio 3.

| View | World | FPS | p99 | Worst | Avg draws | Max draws |
|---|---|---|---|---|---|---|
| Landscape | Sunrise | 60 | 17.1 ms | 17.3 ms | 63.2 | 71 |
| Landscape | Dusk | 60 | 17.2 ms | 17.5 ms | 59.5 | 73 |
| Landscape | Void | 60 | 16.9 ms | 16.9 ms | 62.6 | 71 |
| Portrait | Sunrise | 60 | 17.0 ms | 17.6 ms | 68.9 | 77 |
| Portrait | Dusk | 60 | 17.1 ms | 17.2 ms | 65.0 | 75 |
| Portrait | Void | 60 | 16.9 ms | 17.0 ms | 68.1 | 75 |

Section 4 reference: 60 fps, p99 18.0 / 17.5 ms, avg draws 67.9 / 65.8,
max 92 / 82. The worlds sit inside that band. Draw calls are not several
times the old ~50–75 range.

Phone pixel ratio 3 is still capped: the canvas used ratio 2
(`Math.min(devicePixelRatio, 2)`). The laptop ratio 1.25 is under the cap
and was left alone.

Path check, both screen shapes, UI hidden so the lane is visible
(`docs/shots/week2-measure/`): the next tiles stay in an open lane on
Sunrise, Dusk, and Deep Void. Scenery stays beside the path.

Production preview (`vite preview`, localhost:4173):

- Console errors: 0
- Network: 17 requests, all 200, all same-origin. No `SpikeLab` request
  (that chunk is only fetched if the dev spike is opened).
- `window.gameDebug` is absent.
- Load once, then Offline: the attract demo kept producing frames.
  Reload-while-offline was not retested; there is still no service worker.

### Bundle

`npm run build` succeeded (vite v5.4.21, 49 modules).

| File | Uncompressed | Gzip |
|---|---|---|
| `index.html` | 99.66 kB | 19.20 kB |
| `assets/index-*.js` (game) | 244.85 kB | 75.38 kB |
| `assets/gsap-*.js` | 70.44 kB | 27.81 kB |
| `assets/three-*.js` | 470.39 kB | 120.19 kB |
| **HTML + JS on first load** | **885.34 kB** | **242.58 kB** |

Section 4 was 767.23 kB / 201.17 kB gzip. The difference is the game
script (140 kB → 245 kB): the three worlds live in that file. three.js
and gsap are unchanged.

**Total dist/: 1.14 MB** (1,198,807 bytes) after the coin picture on the
sheet was reduced to 128px so the small bank icon keeps its rim. The same
sheet with the 512px coin was 1.36 MB (1,424,419 bytes). The four-icon
pack alone was 2.17 MB. Before any packing this build was 4.78 MB.
Section 4, the pre-art snapshot, was 4.67 MB. Music is not included.
`assets/SpikeLab-*.js` (4.12 kB) is in the folder but is not part of the
first load.

`ui-icons.png` (253 kB) plus `ui-icons.json` hold the lock, gear, chart,
sparkle, both arrows, the cart, the coin, the crown, and both frames of
the tap hand. The coin frame is the new star token. The browser-tab
favicon stays its own small file. Originals except the retired coin are
kept in `art/icon-sources/` and are not copied into the build.

### Adaptive quality

Not added. Frame time did not slip, so there is nothing to turn down.
The later check with the songs in the page is section 10. Revisit only if
a heavier pass drops the attract demo off 60 fps or pushes draw calls
several times past this band.

## 10. With the songs (2026-10-08)

Same machine, same script, and the same attract demo as section 9. The
three songs are in the page. GPU: AMD Radeon 780M via ANGLE Direct3D11.
No console errors.

| View | World | Avg fps | p99 ms | Worst ms | Avg draws | Max draws |
|---|---|---|---|---|---|---|
| Landscape 1280×800, dpr 1.25 | Sunrise | 60 | 17.1 | 17.4 | 62.7 | 71 |
| Landscape | Dusk | 60 | 17.1 | 17.6 | 59.4 | 73 |
| Landscape | Deep Void | 60 | 17.0 | 17.1 | 62.6 | 71 |
| Portrait 390×844, dpr 3 (capped at 2) | Sunrise | 60 | 17.0 | 17.1 | 68.4 | 75 |
| Portrait | Dusk | 60 | 17.4 | 17.7 | 65.0 | 75 |
| Portrait | Deep Void | 60 | 16.9 | 17.0 | 68.1 | 75 |

After the page was already open, the network was cut. Frames kept
arriving (248, then 369) and `navigator.onLine` was false. Reloading
with no network is still unsupported. There is no service worker.

Production package from `npm run build`: **4.59 MB** (4,807,034 bytes),
13 files. The three songs are 1,200,813 bytes each, **3.44 MB** together,
inside the 4–6 MB music budget. Without the songs the package is 1.15 MB
(1,204,595 bytes), next to section 9. The whole package is under section
4's 4.67 MB pre-art number.

Typecheck was clean. The suite was 280 tests, 20 files, all passing.

Adaptive quality stays off. The songs did not move the attract demo off
60 fps.

Still for a person: play on a real phone, and watch 3–5 first-time
players. Those were open from Week 1 and were not done here.
