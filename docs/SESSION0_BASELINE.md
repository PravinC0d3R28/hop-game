# Session 0 Baseline (P0000)

Release-hygiene gate recorded before Week 1 gameplay work. Purpose: detect
regressions after Week 1. This is **not** a performance-optimization project —
metrics are recorded as-is for later comparison.

- Date: 2026-08-18
- Baseline commit: `24afe5e`
- Node/npm: as installed via `npm install` (package-lock.json)
- Browser: Chrome via CDP (playtest browser)

## 1. Build pipeline

| Step | Result |
|---|---|
| `npm install` | Clean (5 audit advisories: 2 moderate, 2 high, 1 critical — pre-existing, not addressed here) |
| `npm run typecheck` | 0 TypeScript errors |
| `npm test` | **174 passed, 0 failed** (12 test files) |
| `npm run build` | Success (vite v5.4.21, 31 modules, built in 1.42s) |

## 2. Production bundle (dist/)

| File | Uncompressed | Gzip |
|---|---|---|
| `index.html` | 84.22 kB | 15.58 kB |
| `assets/index-*.js` (game) | 131.19 kB | 36.20 kB |
| `assets/gsap-*.js` | 70.49 kB | 27.84 kB |
| `assets/three-*.js` | 460.82 kB | 117.53 kB |
| **HTML + JS total** | **729.34 kB** | **192.53 kB** |

Sourcemaps (dev-only, not shipped to players): 2,574.87 kB total.

### dist/ asset inventory (largest first)

| Asset | Size |
|---|---|
| `assets/three-*.js.map` | 1,789.9 kB |
| `MIssions.png` | 1,165.5 kB |
| `assets/three-*.js` | 450.0 kB |
| `assets/index-*.js.map` | 420.0 kB |
| `arrow-left.png` | 415.4 kB |
| `arrow-right.png` | 415.3 kB |
| `assets/gsap-*.js.map` | 365.0 kB |
| `tap-to-play.gif` | 304.1 kB |
| `Logo.png` | 214.0 kB |
| `assets/index-*.js` | 128.2 kB |
| `index.html` | 82.3 kB |
| `assets/gsap-*.js` | 68.8 kB |
| `splash.png` | 41.0 kB |
| `Coin.png` | 26.6 kB |
| `indicator.png` | 13.7 kB |
| `cart.png` | 8.6 kB |
| `crown.svg` | 1.3 kB |
| `hand-tap.svg` | 0.5 kB |

**Total dist/ size: 5.8 MB** (6,052,180 bytes, including sourcemaps).
Largest shipped asset: `MIssions.png` (1.17 MB). Largest JS: `three.js` chunk
(450 kB / 117.5 kB gzip).

## 3. Browser load (production build via `vite preview`, localhost:4173)

- Initial console errors: **0**
- Missing network resources: **0** (13 requests, all 200/304)
- External dependency: Google Fonts (`fonts.googleapis.com` / `fonts.gstatic.com`)
  — the only network-origin resource; falls back to system fonts if unavailable.

## 4. Frame rate & draw calls (representative)

Measured on the start screen with the attract demo running (continuous
auto-play — the game's steady-state render load).

| Metric | Desktop 1280×800 | Mobile 390×844 (DPR 3) |
|---|---|---|
| Average FPS | 60.1 | 60.2 |
| p99 frame time | 17.1 ms (58.5 fps) | 16.9 ms |
| Min FPS (worst frame) | 57.8 | 59.2 |
| Avg draw calls / frame | 66.9 | 48.6 |
| Max draw calls / frame | 74 | 55 |

Both viewports hold a locked 60 fps with no dropped frames. Mobile draws fewer
calls because fewer platforms are visible on the smaller screen.

## 5. Offline behavior

- **Reload while offline**: fails (`chrome-error://chromewebdata/`) — no service
  worker, so a fresh navigation needs the network. Expected for this build.
- **Load once, then cut the network**: the game keeps running at full 60 fps
  with zero console errors and `navigator.onLine = false`. All game assets are
  same-origin and self-contained; only the Google Fonts request would fail
  (graceful fallback).

## 6. Known observations (noted, not fixed — hygiene gate only)

1. `npm audit` reports 5 advisories (1 critical) in the dependency tree —
   pre-existing, out of scope for Session 0.
2. `MIssions.png` (1.17 MB) is the single largest shipped asset; `three.js`
   dominates JS weight. No action taken per the no-optimization scope.
3. No service worker / offline caching — reload-while-offline is not supported.
4. Sourcemaps are emitted into `dist/` (2.57 MB) — harmless for local hosting,
   but they ship with the folder if deployed as-is.

## Re-run procedure (for Week 1 regression check)

```
npm install
npm run typecheck
npm test
npm run build
# then re-measure: console errors, network resources, desktop+mobile FPS/draw
# calls, offline-after-load, and compare against this file.
```