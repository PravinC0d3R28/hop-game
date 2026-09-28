# HOP — World Art Generation Prompts (Week 2)

**Status:** variations logged 2026-09-02 — awaiting owner picks (one S, one D, one V).
**Purpose:** generate feel/palette references for the three world identities.
The game stays 100% procedural — we copy mood and palette from the winners,
never pixels.

## 1. How to use this file

1. Pick **one variation per world** (§5) and generate it.
2. Every variation below is **fully merged** — global style, locked
   constraints, and the avoid-list are all inside the one block.
   Copy, paste, go; nothing to append.
3. Need a 4th variation later? Combine the **global style block** (§2) with a
   new mood line, keeping that world's **locked constraints** (§4).
4. Judge with §6, then send back the winner IDs + images (see §7).

## 2. Global style block (baked into every variation)

All nine prompts below already contain this DNA — documented here so a
future 10th variation can be built the same way:

- soft paper-craft diorama, layered cutout depth;
- a track of floating rounded-cube platforms receding into the distance,
  seen from a slightly elevated three-quarter view (like gameplay);
- gradient sky matched to the world mood;
- **bold black cartoon outlines around platforms and shapes** (Week 2 spike
  lock, mode 0 — the old "no outlines" line is dead);
- storybook mobile game art, clean shapes, luminous lighting;
- 16:9 landscape, no text, no watermark, no characters, no UI.

## 3. Negative prompt (already merged into each variation below)

Use standalone only if the generator has a dedicated negative field:

```
photorealistic, 3d render, neon grid, synthwave sun only, dark minimalist
void, scary, horror, gore, text, watermark, logo, user interface, buttons,
blurry, low resolution, muddy colors, washed out
```

## 4. Locked world constraints (do not break in any variation)

- **Sunrise Peaks** — morning / paper hills. Cream, warm blue, peach,
  restrained gold. Bright, calm, high legibility. No motion cue on platforms.
- **Dusk District** — sunset / paper city. Peach–coral–violet with **exactly
  one cyan accent**, reserved for hierarchy (moving-tile edges, lanterns).
  Never cyan everywhere. Background motion must read calmer than tile motion.
- **Deep Void** — night paper / space cutouts. Night indigo + slate +
  charcoal blue, cyan and magenta as accents, warm star dots. Must NOT become
  generic all-neon, Ketchapp purple/navy, or neon-rhythm tile-hop. Platforms
  stay readable dark shapes — the sky must never swallow the next landing.

## 5. Variations (copy-paste ready)

### Sunrise Peaks

**S1 — Golden Morning Pop:**
```
Paper-craft diorama game art, 16:9, slightly elevated view following a track of floating rounded-cube platforms into the distance. Vivid golden morning: huge glowing tangerine sun, saturated warm-gold hills layered in cream and peach paper cutouts, bright azure-blue sky gradient, crisp white puffy clouds. Platforms are cream and honey-gold with bold black cartoon outlines. Cheerful, high-energy, luminous. Storybook mobile game art, clean shapes, no text. Avoid photorealism, 3D renders, text, watermarks, UI elements, blur, and muddy or washed-out colors. Keep it bright and highly legible.
```

**S2 — Candy Dawn:**
```
Paper-craft diorama game art, 16:9, slightly elevated view following a track of floating rounded-cube platforms into the distance. Playful candy-colored dawn: hot coral-pink gradient sky, vivid teal-blue paper mountains, bright tangerine sun disc, fluffy pink-white clouds. Platforms are cream, pastel yellow and saturated orange with bold black cartoon outlines. Lively, saturated, joyful. Storybook mobile game art, clean shapes, no text. Avoid photorealism, 3D renders, text, watermarks, UI elements, blur, and muddy or washed-out colors. Keep it bright and highly legible.
```

**S3 — Electric Horizon:**
```
Paper-craft diorama game art, 16:9, slightly elevated view following a track of floating rounded-cube platforms into the distance. Bold complementary-color morning: deep vivid cobalt-blue sky, blazing orange-yellow sunburst, peach and apricot paper hills glowing at the edges, sharp white cloud cutouts. Platforms are ivory, gold and bright amber with bold black cartoon outlines. High contrast, electric, crisp. Storybook mobile game art, clean shapes, no text. Avoid photorealism, 3D renders, text, watermarks, UI elements, blur, and muddy or washed-out colors. Keep it bright and highly legible.
```

### Dusk District

**D1 — Sunset Boulevard:**
```
Paper-craft diorama game art, 16:9, slightly elevated view following a track of floating rounded-cube platforms into the distance. Electric synthwave sunset in paper: blazing magenta-to-orange gradient sky with a low striped sun, deep violet paper city silhouettes and rooftops on both sides. Platforms are warm cream and coral with bold black cartoon outlines and a single streak of glowing electric-cyan light on their bottom edges — the only cyan in the scene. Small warm lantern dots floating. Lively, glowing, dramatic. Storybook mobile game art, clean shapes, no text. Avoid photorealism, 3D renders, text, watermarks, UI elements, blur, and muddy colors. Keep cyan to one single accent only.
```

**D2 — Lantern Festival:**
```
Paper-craft diorama game art, 16:9, slightly elevated view following a track of floating rounded-cube platforms into the distance. Festive dusk fairground in paper: rich violet-purple sky, dozens of glowing amber and rose paper lanterns floating everywhere like popping lights, magenta paper hills. Platforms are cream and soft gold with bold black cartoon outlines and a single streak of glowing electric-cyan light on their bottom edges — the only cyan in the scene. Joyful, sparkling, warm. Storybook mobile game art, clean shapes, no text. Avoid photorealism, 3D renders, text, watermarks, UI elements, blur, and muddy colors. Keep cyan to one single accent only.
```

**D3 — Coral Electric:**
```
Paper-craft diorama game art, 16:9, slightly elevated view following a track of floating rounded-cube platforms into the distance. Maximum-saturation coral dusk: hot coral-pink sky, saturated purple and fuchsia paper cliffs, glowing peach sun half-dipped below the skyline. Platforms are vivid tangerine and cream with bold black cartoon outlines and a single streak of glowing electric-cyan light on their bottom edges — the only cyan in the scene. Bold, punchy, loud. Storybook mobile game art, clean shapes, no text. Avoid photorealism, 3D renders, text, watermarks, UI elements, blur, and muddy colors. Keep cyan to one single accent only.
```

### Deep Void

**V1 — Starlit Origami:**
```
Paper-craft diorama game art, 16:9, slightly elevated view following a track of floating rounded-cube platforms into the distance. Mysterious night-paper kingdom: deep indigo night sky densely scattered with warm golden star dots, thin glowing crescent moon. Platforms are dark slate-blue rounded cubes with bold black cartoon outlines and glowing cyan edge light, one magenta glowing accent platform. Sparse, luminous, magical. Storybook mobile game art, clean shapes, no text. Avoid photorealism, 3D renders, neon grids, empty minimalist darkness, text, watermarks, UI elements, and blur. Platforms must stay clearly visible against the sky.
```

**V2 — Aurora Reef:**
```
Paper-craft diorama game art, 16:9, slightly elevated view following a track of floating rounded-cube platforms into the distance. Vivid aurora night in paper: sweeping teal and magenta aurora ribbons across a deep indigo starry sky, dark charcoal-blue platforms silhouetted with bold black cartoon outlines and cyan glowing edges, golden star dots. Colorful, alive, electric. Storybook mobile game art, clean shapes, no text. Avoid photorealism, 3D renders, neon grids, empty minimalist darkness, text, watermarks, UI elements, and blur. Platforms must stay clearly visible against the sky.
```

**V3 — Neon Constellation:**
```
Paper-craft diorama game art, 16:9, slightly elevated view following a track of floating rounded-cube platforms into the distance. Dramatic constellation night in paper: near-black indigo sky, platforms as dark navy shapes with bold black cartoon outlines traced in bright cyan and magenta constellation lines, clusters of gold star dots, one slim glowing crescent. High contrast, striking, premium. Storybook mobile game art, clean shapes, no text. Avoid photorealism, 3D renders, neon grids, empty minimalist darkness, text, watermarks, UI elements, and blur. Platforms must stay clearly visible against the sky.
```

## 6. Judging a candidate (ask per image)

1. Can I instantly tell where the ball would land? (If the background eats
   the platforms, it's out no matter how pretty.)
2. Which world is this — morning hills, sunset city, or night space?
3. Dusk only: is the cyan a single hierarchy accent, or splashed everywhere?
4. Void only: do the platforms survive as readable dark shapes?
5. Does it feel alive (popping color) without turning noisy?

## 7. Picks log (owner fills in)

- [x] Sunrise winner: **custom docs/ART concept** (`Sunrise_Peaks_art_direction_concept_20260928224813.jpg` + palette + implementation docs — picked over S1–S3, 2026-09-02)
- [ ] Dusk winner: ___ (image: ___)
- [ ] Void winner: ___ (image: ___)

When the picks land: palettes move into `src/config/WorldLooks.ts`
(replacing provisional Dusk/Void values), winners are recorded in
`docs/ART_REFERENCES.md`, and the Day 2/3 paint passes match them.
