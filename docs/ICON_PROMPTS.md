# HOP — Icon Generation Prompts (Paper-Craft 2.5D)

Use these prompts to generate replacement SVGs/raster icons that match the in-game paper-craft treatment. All icons use the game's outline treatment: thick `#111` stroke, soft `rgba(0,0,0,0.25)` drop shadow (5px 5px 0 style), rounded corners, and flat fills. Export at 1024×1024, center the glyph with 12% padding, on transparent background. Keep the style consistent with the existing flag, crater debris, and platform palette.

## Shared style anchor (prepend to every prompt)

`2.5D paper-craft icon, flat bold shapes, thick black outline (#111, 3-4px), soft paper drop shadow, slightly rounded corners, clean vector, centered on transparent background, minimal detail, high contrast, no gradients beyond subtle highlight, no photorealism, no thin lines`

Negative: `photorealistic, 3d render, metallic shine, thin outline, gradient mesh, text, letters, watermark`

---

### 1) Settings gear — `#settings-btn`

Replace the placeholder blocky gear. Needs to read instantly as "settings" at 38-62px.

**Prompt:**
```
{shared} : a settings gear / cog, 8 rounded teeth, centered circular hole, white fill (#fff), thick black outline, subtle inner highlight ellipse top-left, soft paper shadow, perfectly centered, 1024x1024, transparent background
```

**Variants to try:** `toothed gear with 6 teeth` vs `8 teeth` — pick the one that reads cleanest at small size.

**Integration:** Inline SVG in `#settings-btn`, `width:60%` of button, `fill #fff` gear + `stroke #111`, center dot `fill #111`. Keep `viewBox 0 0 24 24`.

---

### 2) Stats — `#stats-btn` (coupled, better)

Current is 3 plain bars. Needs to read as "all-time stats" and feel coupled/together, not just bars.

**Prompt:**
```
{shared} : stats / analytics icon, three vertical rounded bars of ascending height (short, medium, tall) grouped tightly, with a small gold (#ffd700) upward trend line and dots overlaying the bars, black outline on bars and trend, white dots with black stroke, compact centered composition, 1024x1024 transparent
```

**Details:** Bars: `#111` fill, `rx 1.2`. Trend: `stroke #ffd700 1.9px`, dots: `fill #fff stroke #111 1px` plus gold tip `fill #ffd700`. Keep the trend line slightly above bars so it reads as "growth".

**Integration:** Inline SVG in `#stats-btn`, same `viewBox 0 0 24 24`, `width:60%`.

---

### 3) Locked world — `.lock-svg` in `.lock-card`

Current gold-gradient lock feels heavy and not matching the soft paper vibes. Needs softer, cuter paper lock that matches the rest of the card (white card, black outline, gold keyhole accent).

**Prompt:**
```
{shared} : cute padlock, white rounded rectangular body (rx 12), thick black outline, open shackle? No — closed shackle, thick rounded shackle (#111 stroke, inner white), small gold (#ffd700) circular keyhole with black outline and tiny white highlight dot, soft highlight ellipse top-left on body (rgba 255,255,255,0.45), minimal, friendly, centered, 1024x1024 transparent
```

**Details:** Body: `fill #fff stroke #111 4px`, Shackle: `stroke #111 6px round caps`. Keyhole: `circle r 7.5 fill #ffd700 stroke #111 2.6px` + stem `rect 5.6x9.5 rx 2.8 fill #111`. Highlights: two ellipses `rgba(255,255,255,0.45)` top-left. No gradients, flat.

**Integration:** Replace `<svg class="lock-svg" viewBox="0 0 100 100">` content. Keep `filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3))` in CSS.

---

### 4) Game-over unlock sparkles — `#go-unlock-callout` / `#go-missions-callout`

Replaces the emoji `✨` / `🎯`. Needs authentic small starburst art, not emoji.

**Prompt:**
```
{shared} : tiny 4-point star sparkle, flat gold (#ffd700) with thick black outline, small white highlight top-left, paper shadow, centered, 256x256 transparent
```

Generate 2 sizes: 18px and 16px variants. Use as inline SVG `<svg>` in pseudo-elements or as `background-image` data URI, or bake into the callout as absolute positioned `<img>`.

**Missions variant:** same star but add a tiny purple (#8838c8) target ring behind the gold star to hint "missions".

---

### Export checklist

- [ ] 1024×1024 PNG + SVG (expand strokes, no embedded fonts)
- [ ] Transparent background, centered with 12% padding
- [ ] Outline is consistently 3-4px at 1024px (≈ 0.35% of size) — scales to 1.6px at 24px viewBox
- [ ] Drop shadow baked as soft 5px offset `rgba(0,0,0,0.25)` for preview, but CSS will handle final shadow (`box-shadow: 5px 5px 0 rgba(0,0,0,0.25)`)
- [ ] Test at 38px (iPhone SE small button) — must remain legible, no thin lines disappearing
