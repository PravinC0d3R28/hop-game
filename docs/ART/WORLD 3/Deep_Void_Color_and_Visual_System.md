# Deep Void — Final Color & Visual System

## Status

**World 3 visual language: LOCKED**

This document is the text-based visual source of truth for Deep Void.
Use it together with the four locked Deep Void reference images.

The references define the final look. This document translates that look
into reusable palette, material, lighting, contrast, and world-building
rules suitable for a Three.js implementation.

---

# 1. Core Identity

Deep Void is an **infinite celestial dimension** built around:

- dark floating void islands
- massive broken orbital rings
- suspended geometric monoliths
- drifting geometric fragments
- sweeping aurora
- warm stars
- subtle constellation patterns
- one distant crescent moon
- dark celestial gameplay platforms

Deep Void must NOT reuse the environmental identity of the other worlds.

### World differentiation

- **Sunrise Peaks:** colorful crystal formations + cloud sea
- **Dusk District:** endless twilight architecture + lanterns
- **Deep Void:** celestial megastructures + aurora + stars

Do **not** introduce crystals, crystal clusters, city architecture,
lanterns, or conventional mountains.

---

# 2. Overall Color Philosophy

Deep Void should be **dark but never empty**.

The base environment is built from deep navy, blue-black, indigo and
violet.

Color energy is introduced through:

- cyan/teal aurora
- violet/magenta aurora
- warm golden stars
- cool moonlight
- restrained luminous platform edges

The strongest saturation should come from the **aurora and controlled
celestial accents**, not from the structural masses.

### Visual balance

```text
DARK STRUCTURES
        ↓
deep navy / indigo / violet

ATMOSPHERE
        ↓
cyan / teal / violet / magenta

CELESTIAL ACCENTS
        ↓
warm gold / soft white

GAMEPLAY
        ↓
dark platforms + bright controlled edge
```

---

# 3. Canonical Palette

These are the recommended implementation colors.

## 3.1 Deep Void Base

| Role | Name | Hex | Usage |
|---|---|---|---|
| DV-01 | Void Black Blue | `#0B1228` | deepest background / heavy shadow |
| DV-02 | Midnight Navy | `#101B3A` | primary environment |
| DV-03 | Deep Navy | `#17284E` | structural mid-tone |
| DV-04 | Celestial Blue | `#24446B` | lit structural planes |
| DV-05 | Blue Slate | `#355B79` | lighter facet planes |
| DV-06 | Muted Indigo | `#302B67` | violet structural accents |

Use DV-01 through DV-04 for most floating structures.

DV-05 should be used sparingly on light-catching facets.

DV-06 adds subtle violet variation without making the structures
colorful.

---

# 4. Aurora Palette

Aurora is one of the primary visual signatures of Deep Void.

## 4.1 Core Aurora Colors

| Role | Name | Hex |
|---|---|---|
| Aurora Cyan | `#32D8E5` |
| Aurora Teal | `#24C7C8` |
| Aurora Blue | `#4A9BE8` |
| Aurora Violet | `#8E66E8` |
| Aurora Magenta | `#C45AE5` |
| Aurora Soft Lavender | `#B8A4EF` |

### Aurora rules

- Use cyan and teal as the strongest aurora colors.
- Violet and magenta appear as transitions or secondary ribbons.
- Avoid hard bands of equal saturation.
- Aurora should have soft gradients and irregular flowing shapes.
- Aurora is brightest in the distant/background atmosphere.
- Do not let the aurora dominate the central gameplay corridor.

### Preferred visual relationship

```text
cyan / teal
     ↓
blue
     ↓
violet
     ↓
magenta
```

The transitions should feel organic rather than segmented.

---

# 5. Star Palette

Stars provide the warm counter-color against the cool void.

## 5.1 Stars

| Role | Name | Hex |
|---|---|---|
| Star Core | `#FFF3B0` |
| Star Gold | `#F7D66A` |
| Star Warm | `#F4B85E` |
| Bright White Star | `#FFF9E8` |

### Star rules

- Most stars should use the Star Gold family.
- A small number may use brighter warm-white tones.
- Avoid saturated yellow stars.
- Vary size and brightness.
- Distant stars should be smaller and dimmer.
- A few large star points may act as visual anchors.

Stars should feel like **warm points in a cool world**.

---

# 6. Crescent Moon

The moon should be a separate visual accent.

## Moon palette

| Role | Hex |
|---|---|
| Moon Core | `#DDF7FF` |
| Moon Glow | `#79D8F2` |
| Soft Halo | `#466EA8` |

The crescent should remain relatively small.

It should be clearly visible but never become the primary focal point.

The moon is a visual punctuation mark, not a destination.

---

# 7. Platform Palette

Platforms retain the global game geometry.

Deep Void changes their **material treatment**, not their silhouette.

## 7.1 Platform Base

| Role | Name | Hex |
|---|---|---|
| Platform Deep | `#111A38` |
| Platform Navy | `#18264B` |
| Platform Blue Slate | `#26385D` |
| Platform Violet | `#43386F` |

Use these primarily for the top and side materials of dark platforms.

## 7.2 Light Platform Tops

A small number of platforms may use:

| Role | Hex |
|---|---|
| Celestial Ivory | `#EEF3EA` |
| Moonlit Ivory | `#DDE8E7` |
| Cool Lavender | `#CFC8F0` |

These light platforms improve gameplay readability and visual rhythm.

Do not make every platform bright.

---

# 8. Platform Edge Glow

The platform edge is a world-specific accent.

## Primary

`#36E4EE` — cool cyan

## Secondary

`#8A73F5` — soft violet

## Rare Accent

`#D35BE7` — subtle magenta

### Rules

- The glow must remain thin.
- It should sit on the lower/outer edge of the platform.
- It should not turn the platform into a neon object.
- Cyan is the most common edge color.
- Violet is the secondary variation.
- Magenta should be rare.

The edge is a visual connection between the gameplay object and the
celestial environment.

---

# 9. Constellation / Surface Markings

Constellation details should be extremely subtle.

## Constellation line

`#8FB8D6`

## Warm constellation line

`#D8BE78`

## Tiny star node

`#FFE8A0`

### Rules

- Thin lines only.
- Very low visual weight.
- Sparse patterns.
- Avoid full-sky grids.
- On platforms, constellation marks should feel decorative rather
  than like a user interface.

---

# 10. Floating Structure Materials

Deep Void structures should remain predominantly dark.

## Typical structure recipe

### Shadow face
`#0B1228`

### Main face
`#17284E`

### Mid-light face
`#24446B`

### Rare highlight face
`#355B79`

A small violet tint can be introduced with:

`#302B67`

### Important

Do not randomly assign bright colors to structural facets.

Most structure surfaces should stay within the dark blue family.

The environment gets its color primarily from the aurora and celestial
lighting.

---

# 11. Broken Orbital Rings

Orbital rings are one of Deep Void's signature assets.

They should usually use:

- deep navy
- blue slate
- muted indigo

Optional edge highlights:

- cool cyan
- pale blue
- restrained violet

Do NOT make the whole ring glow.

Only selected edges/facets may catch celestial light.

The rings should feel ancient, massive and mysterious.

They are environmental structures, NOT portals.

---

# 12. Floating Void Islands

Void islands should use dark layered materials.

Recommended material distribution:

```text
60–70% deep navy / blue-black
20–30% blue slate / indigo
5–10% lighter celestial facets
```

This keeps them visually substantial without overpowering the aurora.

Avoid realistic asteroid coloring.

---

# 13. Suspended Monoliths

Monoliths should remain darker and simpler than rings.

Preferred colors:

- `#0B1228`
- `#101B3A`
- `#17284E`
- `#302B67`

Use occasional cyan or blue highlights only when they catch aurora or
moonlight.

Monoliths should feel like impossible celestial objects, not buildings
or crystals.

---

# 14. Drifting Fragments

Small fragments should use the same dark structural palette.

They should generally be:

- darker than nearby major structures
- lower saturation
- low detail
- varied in scale

Their purpose is to add scale and motion, not visual noise.

---

# 15. Lighting System

Deep Void should use **cool primary lighting + colored atmospheric
lighting + warm celestial accents**.

## Primary light

Cool blue / blue-white.

Suggested color:

`#9BB8E5`

## Aurora contribution

Use:

- cyan
- teal
- violet
- magenta

as soft environmental illumination.

## Warm celestial accents

Stars use:

`#F7D66A`

Moon uses:

`#DDF7FF`

### Lighting hierarchy

```text
COOL CELESTIAL LIGHT
        +
AURORA COLORING
        +
SMALL WARM STAR ACCENTS
```

The lighting must preserve the low-poly facets on the environment.

Avoid completely black shadow faces.

---

# 16. Contrast Rules

Deep Void depends heavily on contrast.

## Highest contrast

- platform vs background
- bright stars vs dark sky
- aurora vs dark structures
- moon vs upper background

## Medium contrast

- floating structures vs background
- monoliths vs aurora

## Lowest contrast

- distant fragments
- distant structures
- faint constellation lines

This produces atmospheric depth without requiring photorealistic fog.

---

# 17. Saturation Rules

Use saturation intentionally.

### High saturation

- aurora cyan
- aurora teal
- selected violet/magenta aurora
- rare glowing platform edge
- occasional bright star

### Medium saturation

- blue-lit facets
- violet structural accents
- moon glow

### Low saturation

- floating islands
- monoliths
- orbital rings
- distant fragments
- most of the background

The world should never become a uniformly neon environment.

---

# 18. Gameplay Readability

The player must immediately recognize:

**PLATFORMS**
→ gameplay

**BALL**
→ player

**FLOATING STRUCTURES**
→ environment

**AURORA**
→ atmosphere

**STARS**
→ celestial depth

**MOON**
→ world punctuation

The central gameplay route should remain one of the clearest structures
in the frame.

---

# 19. White Ball

Keep the global player-ball appearance consistent.

Recommended:

`#FFFDF8`

The ball should be brighter than surrounding gameplay surfaces.

Use a small cool contact shadow.

Do not recolor the ball per world.

---

# 20. World-Specific Effects

Deep Void can use subtle effects such as:

- tiny drifting fragments
- slow star twinkles
- occasional star pulse
- subtle aurora movement
- restrained platform edge glow
- faint moon halo

Effects should remain lightweight and suitable for real-time Three.js.

Avoid effects-heavy rendering.

---

# 21. Environmental Color Distribution

A useful approximate distribution for the visible scene:

```text
55–65%  deep navy / dark blue
10–15%  mid blue / indigo structures
10–20%  aurora cyan / teal
5–10%   violet / magenta atmosphere
3–6%    warm gold stars
1–3%    bright moon / light accents
```

These are directional targets, not strict pixel percentages.

The goal is a dark celestial world whose color energy comes from
controlled luminous phenomena.

---

# 22. Asset Reuse Rules

All Deep Void environment assets should share:

- the same dark material family
- the same low-poly facet language
- the same outline treatment
- the same cool-light response
- the same restrained saturation

Do not create one asset that looks photorealistic while the others are
cartoon low-poly.

---

# 23. Recommended Asset Families

For a scalable Three.js implementation:

### Major

- `DV_OrbitalRing_A`
- `DV_OrbitalRing_B`
- `DV_VoidIsland_A`
- `DV_VoidIsland_B`
- `DV_Monolith_A`
- `DV_Monolith_B`

### Small

- `DV_Fragment_A`
- `DV_Fragment_B`
- `DV_Fragment_C`

### Effects

- `DV_Aurora`
- `DV_Star`
- `DV_Constellation`
- `DV_Moon`

The same assets can be procedurally varied by:

- scale
- rotation
- position
- material variant
- depth
- light exposure

---

# 24. Multi-World Identity Rule

Deep Void should share these global game traits with every future world:

- platform silhouette
- ball
- camera language
- dark outline treatment
- low-poly/faceted geometry
- readable central gameplay path
- clean stylized rendering

Only the following are world-specific:

- environment shapes
- color palette
- atmospheric effects
- lighting mood
- decorative systems
- platform material treatment

This allows many worlds to coexist without feeling like separate games.

---

# 25. Final Deep Void Visual Formula

## Primary

**Deep navy + floating megastructures**

## Secondary

**Cyan/teal aurora**

## Accent

**Violet + magenta**

## Warm counterpoint

**Golden stars**

## Atmospheric punctuation

**One distant crescent moon**

## Gameplay

**Dark celestial platforms with thin luminous edges and subtle
constellation details**

## Overall feeling

**Vast + mysterious + magical + premium + infinite**

---

# 26. Things That Must Not Happen

Do not drift into:

- crystal worlds
- gemstone colors
- city architecture
- cyberpunk neon
- realistic space photography
- black empty backgrounds
- giant planets
- spaceships
- sci-fi interfaces
- excessive neon
- excessive constellation lines
- giant moon
- glowing portals
- overly bright structures
- noisy particle fields

Deep Void should be **celestial fantasy**, not generic science fiction.

---

# 27. Reference Priority for Agents

When implementing from the supplied Deep Void images, prioritize:

1. Overall world mood
2. Dark structural palette
3. Aurora shape and color
4. Large orbital-ring / floating-island silhouettes
5. Gameplay readability
6. Star distribution
7. Crescent moon
8. Constellation details
9. Small decorative fragments

If a decorative effect conflicts with gameplay readability, remove or
reduce the decorative effect.

If a generated asset conflicts with the Deep Void palette or shape
language, adjust the asset rather than changing the world palette.

The reference image is the visual target.

This document is the rule set that preserves the target when the scene
is procedurally generated or expanded.
