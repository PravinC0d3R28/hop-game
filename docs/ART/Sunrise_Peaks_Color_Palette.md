# Sunrise Peaks — Color Palette

## Purpose

This palette defines the visual language for **World 1: Sunrise Peaks**.

The target look is a **bright, poppy, candy-colored crystalline world emerging from soft dawn clouds**, while keeping the bounce tiles visually distinct from the environment.

The palette is intentionally separated into roles:

- **Sky + clouds:** soft, low-saturation foundation
- **Crystals:** colorful, saturated environmental focal points
- **Tiles:** warm, bright gameplay colors
- **Ball:** near-white, high readability
- **Outlines + shadows:** controlled dark neutral tones
- **Lighting:** warm upper-left morning light

---

## 1. Palette Hierarchy

The intended visual hierarchy is:

**Soft sky → soft clouds → poppy crystals → bright tiles → white ball**

The world should feel colorful without making every object equally saturated.

### Saturation guidance

- Sky: low
- Clouds: low
- Crystals: medium-high to high
- Tiles: medium-high
- Ball: very low / near-white
- Outlines: dark and neutral

---

## 2. Sky / Atmosphere

The sky should remain significantly softer than the crystals.

| Role | Name | Hex | Usage |
|---|---|---:|---|
| Sky Top | Dawn Peach | `#F5D9DF` | Upper background |
| Sky Mid | Warm Blush | `#F8DFD2` | Main atmospheric transition |
| Sky Lower | Warm Cream | `#FFF0D5` | Lower atmosphere |
| Horizon Glow | Pale Apricot | `#FFE8C7` | Very subtle distant brightening |
| Atmospheric Tint | Soft Rose | `#F3D1D8` | Optional depth/fog tint |

### Sky rule

Do not use a strongly saturated blue sky for Sunrise Peaks. The environment should read as warm dawn.

Keep the gradient subtle. The sky is a backdrop, not a focal element.

---

## 3. Cloud Sea

The cloud layer sits below and around the floating level. It should be soft and pale so that the crystals remain dominant.

| Role | Name | Hex | Usage |
|---|---|---:|---|
| Cloud Base | Warm White | `#FFF7E8` | Main cloud material |
| Cloud Highlight | Ivory Glow | `#FFFBEF` | Upper illuminated areas |
| Cloud Shadow | Peach Mist | `#F4DCCB` | Soft lower/occluded areas |
| Cloud Accent | Pale Pink Mist | `#F1D7DA` | Very limited variation |

### Cloud rule

Clouds should never become visually brighter/saturated than the gameplay tiles.

They should feel soft, airy and slightly translucent without looking like realistic volumetric clouds.

---

## 4. Crystal Palette — Primary Environment Colors

Crystals are the **main color carriers of Sunrise Peaks**.

Use a controlled mix of warm and cool candy colors.

### Warm crystals

| Role | Name | Hex | Usage |
|---|---|---:|---|
| Warm Coral | Coral Punch | `#FF6F70` | Strong coral facets |
| Coral Light | Peach Coral | `#FF927C` | Highlight facets |
| Peach | Candy Peach | `#FFB07A` | Main warm crystal color |
| Apricot | Soft Apricot | `#FFC27E` | Transitional facets |
| Orange | Sunset Orange | `#FF9C38` | High-energy accent |
| Yellow | Crystal Gold | `#FFD95A` | Bright yellow facets |
| Cream | Crystal Ivory | `#FFF0BE` | Light / neutral facets |

### Cool crystals

| Role | Name | Hex | Usage |
|---|---|---:|---|
| Mint | Fresh Mint | `#8DE3B0` | Main mint crystal color |
| Mint Light | Mint Glow | `#B5F0C7` | Highlight facets |
| Turquoise | Candy Turquoise | `#52D8C8` | Strong cool accent |
| Cyan | Crystal Cyan | `#55CFE6` | Bright cyan facets |
| Deep Cyan | Ocean Teal | `#35AFC1` | Shaded cool facets |

### Crystal rule

A single crystal should generally use **2–4 related colors**, not the entire palette.

Good examples:

- Coral + peach + apricot
- Coral + orange + cream
- Mint + turquoise + cyan
- Yellow + apricot + cream
- Cyan + turquoise + mint

Avoid making every crystal a rainbow.

---

## 5. Crystal Facet Shading

Do not rely only on one material per crystal. Adjacent faces should have visible value/color changes.

Suggested relationship:

- Light-facing facet → lighter/higher-value version
- Main/front facet → base color
- Side facet → slightly darker version
- Shadow facet → deeper, muted version

### Example coral crystal

- Light: `#FFAA8C`
- Base: `#FF6F70`
- Shade: `#E95F67`

### Example mint crystal

- Light: `#B8F4CB`
- Base: `#8DE3B0`
- Shade: `#5FC89A`

### Example cyan crystal

- Light: `#89E8F1`
- Base: `#55CFE6`
- Shade: `#35AFC1`

These are illustrative relationships; the exact Three.js shading should still respond to lighting.

---

## 6. Gameplay Tile Palette

Tiles should be **related to the warm crystal palette but remain a separate visual category**.

Do NOT make tiles mint, cyan or rainbow-colored.

| Role | Name | Hex | Usage |
|---|---|---:|---|
| Tile Light | Ivory Tile | `#FFF5D8` | Main neutral tile top |
| Tile Cream | Warm Cream | `#FFE9AF` | Secondary tile |
| Tile Yellow | Sunny Yellow | `#FFD84F` | Bright gameplay tile |
| Tile Gold | Golden Tile | `#F6B83F` | Strong warm tile |
| Tile Amber | Amber Tile | `#F29A2E` | High-energy accent tile |
| Tile Coral | Soft Coral Tile | `#F59A7C` | Occasional variation only |

### Tile side colors

Tile side faces should be visibly darker than the top faces.

Suggested side range:

- Cream side: `#D9B978`
- Yellow side: `#D59D2F`
- Gold side: `#C88726`
- Amber side: `#C66D1F`

The exact shade should respond to scene lighting.

### Tile rule

The player should immediately read:

**Crystals = environment**

**Tiles = gameplay**

**Ball = player**

---

## 7. Player Ball

| Role | Name | Hex | Usage |
|---|---|---:|---|
| Ball | Soft White | `#FFFDF8` | Main ball material |
| Ball Shadow Tint | Warm Grey | `#D9D1C6` | Optional subtle shading |

Keep the ball close to white. It should remain visible against both pastel sky and colorful crystals.

---

## 8. Outline / Edge Color

The reference style uses strong dark edges. Avoid pure black everywhere because a slightly warm dark neutral will integrate better with the palette.

| Role | Name | Hex | Usage |
|---|---|---:|---|
| Primary Outline | Warm Charcoal | `#3B302D` | Main object outlines |
| Secondary Edge | Deep Brown | `#5A4237` | Softer/distant edges if needed |

### Outline rule

Use the same outline language across tiles and crystals so they feel like one game.

Distant objects may use slightly softer/thinner outlines.

---

## 9. Sunrise Lighting

The world uses a **warm directional light from the upper-left**.

Suggested light color:

| Role | Name | Hex |
|---|---|---:|
| Key Light | Golden Morning | `#FFD39A` |
| Warm Fill | Soft Peach | `#F6D7C5` |
| Cool Fill / Environment | Pale Blue-Grey | `#DCE7EA` |

The warm key light should create:

- brighter peach/gold highlights on upper-left faces
- slightly cooler/darker faces on the opposite side
- subtle shadows extending generally toward the lower-right

Do not use intense bloom or cinematic glare.

---

## 10. Accent / Effects Colors

Use sparingly.

| Role | Name | Hex |
|---|---|---:|
| Sparkle | Soft Gold | `#FFE59A` |
| Glow | Pale Warm White | `#FFF3D1` |
| Optional Cyan Accent | Bright Aqua | `#7BE8EA` |

These are for tiny particles, sparkles or special effects, not for large environmental surfaces.

---

## 11. Color Usage Rules

### Rule A — Crystals carry the color

Crystals should have the most saturated and visually interesting colors in the environment.

### Rule B — Background stays soft

The sky and cloud sea should never compete with the crystal formations.

### Rule C — Tiles use a controlled warm subset

Tiles should primarily use ivory, cream, yellow, gold and amber.

### Rule D — Avoid rainbow noise

A colorful world does not mean every object uses every color.

### Rule E — Preserve value contrast

Even when hue changes, the top face of a tile and the ball must remain easy to distinguish from the environment.

### Rule F — Lighting creates additional variation

Prefer lighting-driven facet differences instead of introducing many additional colors.

---

## 12. Suggested Overall Color Mix

For a typical scene, a reasonable starting balance is:

- 45–55% soft sky/atmosphere
- 15–20% cloud sea
- 15–20% crystal colors
- 8–12% gameplay tile colors
- <5% dark outlines and strong accents

These percentages are visual guidance, not strict pixel ratios.

---

## 13. Final Art-Direction Summary

**Sunrise Peaks should read as:**

> A bright candy-colored crystalline world emerging from warm dawn clouds, lit by soft golden morning light.

The palette is **poppy where it matters** — the crystals and gameplay accents — while the sky and clouds remain soft enough to preserve gameplay readability.
