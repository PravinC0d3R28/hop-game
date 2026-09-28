# Art Reference Prompts (Worlds 2 & 3)

These prompts are tuned to match the style of your World 1 reference
(`C:\Users\Poonam\Downloads\coinini_Generated_Image_c8zsq3c8zsq3c8zs.png` —
cloud kingdom: layered paper-craft depth, soft gradient sky, white/gold shapes,
no black outlines). They are **feel-references** — the game stays 100%
procedural; we copy mood and palette, never pixels.

## World 2 — Dusk District (sunset / first neon)

```
Soft paper-craft diorama of floating geometric platforms in a sunset kingdom.
Layers of peach, coral, magenta and violet paper hills receding into a warm
gradient dusk sky with a low sun and tiny clouds. Platforms are rounded
cubes in cream and soft gold with a single streak of cool cyan neon glow on
their bottom edges. Small glowing lantern dots float between platforms.
Luminous, airy, gentle gradient lighting. NO black outlines — shapes are
separated by soft shadows and subtle highlights. Storybook game art,
high resolution, clean, warm.
```

Key palette: `#ffd9a0` (sand cream) · `#ff9a6b` (peach) · `#c86ba6` (magenta) ·
`#6b5bb8` (violet) · neon accent `#38f0e8` (cyan).

## World 3 — Deep Void (night / neon)

```
Soft paper-craft diorama of floating geometric platforms in a deep night
kingdom. Near-black indigo and violet layered hills, a starry sky gradient,
thin crescent moon. Platforms are rounded cubes in slate blue and dark
charcoal with strong glowing neon edges — cyan and magenta — and tiny
glowing stars floating between them. Subtle aurora band in the sky.
Luminous, mysterious, gentle gradient lighting. NO black outlines — shapes
are separated by glow and soft highlights. Storybook game art, high
resolution, clean, dramatic but not scary.
```

Key palette: `#1b1f3a` (night indigo) · `#2a2f52` (slate) · `#3d4470` (charcoal
blue) · neon accents `#38f0e8` (cyan) · `#ff4dd8` (magenta) · star dots
`#fff3c8`.

## Optional extras (same visual family)

- **Coin reference:** glowing coinstone in cream-gold (W1), amber-peach (W2),
  neon cyan-magenta (W3) — same paper-craft feel, no outlines.
- **Coin/logo refresh:** the in-game coin as a glowing golden disc with soft
  inner light (keep existing shape, match the new palette family).
- **Streak-fire element:** soft cartoon flames in warm white-gold for streak 10.

## Locked outline decision (Week 2 spike, 2026-09-02)

Single V1 pipeline: **mode 0 — current thick black inverted-hull outlines
on everything** (platforms, ball, coins, props). Rejected: tinted rims
(cloud rims inconsistent); contrast-only not selected. Pre-approved
fallback: playable-only outlines (recoverable from git history `39b7384`).

Note: the "NO black outlines" lines in the prompts above are prompt
aspirations and are **superseded** by this lock — use the prompts for
palette/mood only. If a future week re-opens the edge treatment,
regenerate references in the new language first.


