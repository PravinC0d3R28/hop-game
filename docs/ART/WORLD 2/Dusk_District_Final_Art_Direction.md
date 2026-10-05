# World 2 — Dusk District
## Final Art Direction & Implementation Reference

**Status:** LOCKED  
**Reference image:** `Dusk_District_game_world_art_20261003225827.jpg`

This document is the text-based source of truth for implementing Dusk
District alongside the reference image.

The image defines the visual target. This document defines the rules that
should be preserved when creating the world, generating assets, placing
environmental elements, and adapting the world to different screen
ratios.

---

# 1. Core World Identity

Dusk District is an **endless stylized twilight city**.

The player is continuously travelling through a deep architectural
district suspended between towering structures.

The world should communicate:

- endless forward travel
- deep vertical scale
- warm sunset
- purple twilight
- glowing lanterns
- stylized fantasy architecture
- sparse, readable gameplay

The player should feel as though they are moving **toward a distant
sunset**, but the sunset is an atmospheric destination that is never
actually reached.

There is no visible end point.

---

# 2. Global Game Identity

Dusk District must still feel like the same game as all other worlds.

These elements are GLOBAL and should not be redesigned per world:

- Three-quarter elevated gameplay camera
- Floating disconnected bounce tiles
- Ball size and shape
- Tile proportions and core geometry
- Gameplay spacing rules
- Dark outline treatment
- Simple low-poly / faceted geometry language
- Clean silhouettes
- Minimal texture detail
- Gameplay readability
- UI placement logic
- Responsive composition rules

The world changes around the gameplay system.

---

# 3. Composition

## Gameplay Path

The playable path is a clearly readable chain of approximately 7–9
disconnected floating tiles.

The path:

- begins large in the foreground
- becomes smaller toward the distance
- moves generally toward the upper-middle of the frame
- remains visually centered
- retains obvious gaps between platforms

The center gameplay corridor should remain relatively open.

Environmental architecture frames the path from both sides.

---

# 4. The Endless-World Illusion

This is one of the most important rules for Dusk District.

The architecture must NOT look like isolated buildings placed around the
player.

Instead, it should feel like a **continuous enormous city/canyon
structure that extends beyond the visible frame**.

## Foreground

Large structures should enter from:

- bottom-left
- bottom-right
- left edge
- right edge

These structures should be partially cropped by the camera and clearly
appear to continue below the visible frame.

The player should feel surrounded by architecture that extends both
behind and below them.

## Midground

Use connected-looking architectural masses:

- buildings
- walls
- towers
- arches
- terraces
- rooftops
- balconies
- stairs
- vertical facades

These should overlap and layer into one another.

## Background

Use smaller silhouettes that progressively fade toward the sunset.

The distant city should extend continuously toward the horizon.

## Critical rule

**Avoid arbitrary cutoffs.**

When a structure is cropped by the screen edge, it should look like the
camera has simply cut through a much larger structure.

---

# 5. Architecture Language

Architecture should be **stylized fantasy architecture**, not realistic
modern urban architecture.

Preferred forms:

- chunky rectangular building masses
- stepped rooftops
- narrow towers
- small towers with pointed caps
- arches
- repeated archways
- terraces
- parapets
- staircases
- balconies
- faceted walls
- cliff-like vertical masses

The architectural forms should share the game's low-poly geometric
language.

Use large planar surfaces rather than detailed masonry.

Do not add:

- cars
- people
- signs
- street furniture
- realistic windows everywhere
- realistic city infrastructure
- dense modern skyscraper detail

The district should feel timeless, fantastical and game-like.

---

# 6. Visual Depth Structure

Build the environment in three depth layers.

## Foreground

Very large structures.

Characteristics:

- dark
- saturated
- strongly outlined
- partially cropped
- close to camera
- visually heavy

Purpose:

Create the impression of enormous structures continuing beyond the
screen.

## Midground

Medium-sized buildings and architectural structures.

Characteristics:

- more colorful
- warm sunset illumination
- medium lantern density
- clear silhouettes

Purpose:

Frame the gameplay path and establish the city.

## Background

Distant architecture and lanterns.

Characteristics:

- smaller
- softer
- lower contrast
- partially atmospheric
- warm horizon glow

Purpose:

Create depth and the endless-distance illusion.

---

# 7. Sunset / Horizon

A bright warm sunset glow should sit in the **distant upper-middle**
background.

Preferred gradient logic:

dark violet / plum
    ↓
magenta
    ↓
coral
    ↓
warm orange
    ↓
peach / golden glow near horizon

The horizon is an atmospheric destination only.

Do NOT create:

- a road leading to the sun
- a gateway
- a final building
- a landmark that suggests the level ends there
- a visible boundary

The player should always appear to be approaching the glow without
ever reaching it.

---

# 8. Final Dusk District Palette

Use the following palette as the canonical starting point.

## Sky / Atmosphere

| Role | Hex | Usage |
|---|---|---|
| Deep Plum | `#301530` | Upper sky / deepest distant tone |
| Twilight Violet | `#4A214F` | Main upper-middle atmosphere |
| Dusk Purple | `#6B2A61` | Mid atmospheric transition |
| Magenta Dusk | `#9A3D67` | Lower sky transition |
| Coral Glow | `#D95C68` | Near-horizon atmosphere |
| Sunset Peach | `#F58A66` | Bright horizon |
| Golden Peach | `#FFB36F` | Strongest horizon glow |

The sky should be significantly darker at the top than at the horizon.

---

## Architecture

### Deep shadow

`#261631`

### Deep plum

`#3B2146`

### Purple facade

`#5A2C59`

### Magenta-violet facade

`#713050`

### Coral facade

`#C65363`

### Warm coral highlight

`#F07868`

### Peach/orange highlight

`#F49A67`

Architecture should generally move from darker violet/plum shadow
planes to coral/peach illuminated planes.

---

## Gameplay Tiles

Tiles intentionally use a smaller, warmer palette than the environment.

### Tile top colors

`#FFF0CF` — ivory  
`#FFD978` — warm yellow  
`#F6B64E` — golden amber  
`#F28A61` — coral orange

### Tile side colors

`#C97952` — warm muted orange  
`#9D5A54` — darker warm side

### Cyan ribbon

`#20E6EA` — electric cyan  
`#63F5F2` — brighter cyan highlight

The cyan ribbon is a **signature Dusk District gameplay accent**.

---

## Lanterns

### Main lantern glow

`#FFB347`

### Bright core

`#FFD36B`

### Warm rose lantern

`#FF7F95`

### Soft orange lantern

`#FF9361`

Lantern light should be warm and visibly emissive.

---

## Clouds / Haze

Clouds are not a major world feature like Sunrise Peaks.

Use only subtle atmospheric haze when necessary:

`#D9B8C7`

`#F0D4C7`

Keep haze subordinate to architecture.

---

## Universal Outline

`#4A3638`

Use the same dark warm outline language as the rest of the game.

---

# 9. Color Hierarchy

The color hierarchy is intentional.

1. **Sky**
   - darkest overall at the top
   - gradually becomes warmer toward horizon

2. **Architecture**
   - mostly violet/plum/coral
   - strong warm-vs-cool facet contrast

3. **Lanterns**
   - small, concentrated warm points

4. **Tiles**
   - cream, yellow, amber and coral
   - brighter and cleaner than architecture

5. **Cyan ribbon**
   - rare, highly visible signature accent

6. **Ball**
   - near-white

The environment should NOT become dominated by cyan.

---

# 10. Cyan Ribbon Rule

The electric-cyan ribbon should primarily appear on the lower edge or
underside of gameplay tiles.

It should be:

- thin
- crisp
- bright
- restrained
- clearly associated with gameplay

Do not turn the tiles into neon blocks.

Do not add cyan strips to random buildings.

Do not make cyan a major architectural color.

The purpose is for players to subconsciously associate the cyan ribbon
with the gameplay system.

---

# 11. Lantern System

Lanterns are a permanent Dusk District world signature.

Use multiple scales.

## Foreground

Few lanterns.

- large enough to read
- attached to buildings or walls
- warm bright glow

## Midground

Moderate number.

- mixed sizes
- architectural fixtures
- occasional floating lantern

## Background

Many small lanterns.

- tiny
- soft
- atmospheric
- distributed through the distant city

This creates the sense of a huge inhabited district without showing
people.

Avoid placing many lanterns directly over the center gameplay corridor.

---

# 12. Lighting

The main world light is a warm sunset light coming from the distant
horizon / upper-rear direction.

Lighting should create:

- warm peach/orange highlights on sun-facing surfaces
- deep violet/plum shadow faces
- clear planar facet separation
- warm lantern pools around fixtures

The lighting is stylized rather than physically realistic.

Avoid:

- heavy bloom
- cinematic lens flare
- strong volumetric fog
- dramatic depth of field
- photorealistic reflections

---

# 13. Geometry Language

All environment assets should be:

- low-poly
- chunky
- modular
- faceted
- composed from large planar faces
- simple enough for real-time Three.js rendering

Complexity should come primarily from:

- scale
- layering
- repetition
- composition
- lighting

not from dense meshes or texture maps.

---

# 14. Recommended Modular Asset Library

A small reusable asset set should be sufficient.

## Architecture

- `DD_Building_Block_A`
- `DD_Building_Block_B`
- `DD_Tower_A`
- `DD_Tower_B`
- `DD_Rooftop_A`
- `DD_Rooftop_B`
- `DD_Arch_A`
- `DD_Arch_B`
- `DD_Wall_A`
- `DD_Wall_B`
- `DD_Stair_A`
- `DD_Balcony_A`
- `DD_Cliff_Block_A`

## Lighting / Decoration

- `DD_Lantern_Wall`
- `DD_Lantern_Floating`
- `DD_Lantern_Large`
- `DD_Lantern_Small`

The goal is not to create dozens of unique models.

A small number of strong base assets should be transformed procedurally.

---

# 15. Procedural Variation

Each modular asset can vary through:

- scale
- rotation
- position
- vertical offset
- material color
- facet shading
- repetition count

Use seeded randomness so the same level can always be regenerated.

Example concept:

```js
createWorld({
  world: "dusk-district",
  seed: 42017
});
```

The same seed should produce the same:

- building selection
- placement
- scale
- lantern placement
- tile treatment
- environmental arrangement

---

# 16. Environment Placement Rules

Environmental decoration should be generated relative to the gameplay
path.

Maintain a protected center corridor.

Do not place large structures where they can visually block the next few
tiles.

Recommended conceptual zones:

```text
LEFT ENVIRONMENT | SAFE GAMEPLAY | RIGHT ENVIRONMENT
```

Foreground structures can come close to the camera and crop into the
sides, but the central path must stay clear.

---

# 17. Mobile Adaptation

The world should use the same art style on web and mobile.

Do NOT create a separate mobile art style.

Instead, change composition rules.

## Desktop

- wider side framing
- larger architectural masses
- broader visual corridor
- more lateral environment

## Mobile

- narrower gameplay corridor
- architecture pushed toward left/right edges
- fewer objects near center
- taller vertical framing
- distant horizon remains visible
- foreground architecture may crop more aggressively

The visual identity stays the same.

---

# 18. Gameplay Readability Rules

At all times the player should quickly recognize:

**Tiles = gameplay**

**Ball = player**

**Architecture = environment**

**Lanterns = atmosphere**

**Cyan ribbon = gameplay/world accent**

Environmental beauty must never reduce the clarity of the bounce path.

---

# 19. What Dusk District Should NOT Become

Avoid drifting into:

- cyberpunk neon city
- realistic medieval city
- modern skyscraper city
- dense urban simulation
- gritty dark fantasy
- realistic canyon
- generic sunset landscape
- empty architectural corridor
- floating disconnected buildings
- random decorative clutter

The intended feeling is:

**stylized + warm + mysterious + playful + endless**

not:

**realistic + gritty + cinematic + dense**

---

# 20. Reference Fidelity Rules for the Agent

When implementing from the reference image, prioritize in this order:

1. Gameplay composition
2. Endless architectural framing
3. Distant sunset glow
4. Purple/coral/orange palette
5. Lantern distribution
6. Cyan tile ribbon
7. Faceted low-poly geometry
8. Outline treatment
9. Small decorative details

When there is a conflict between decoration and gameplay readability,
always preserve gameplay readability.

When there is a conflict between a newly generated asset and the
reference's geometry/style, favor the established Dusk District
language.

Do not add visual elements simply because the scene feels empty.
Negative space is part of the art direction.

---

# 21. Final Mental Model

The world should read as:

**ENDLESS ARCHITECTURAL CANYON**
+
**TWILIGHT SUNSET**
+
**GLOWING LANTERNS**
+
**WARM FLOATING TILES**
+
**THIN ELECTRIC-CYAN RIBBON**
+
**CONTINUOUS DEEP STRUCTURES**
+
**CLEAN CENTRAL GAMEPLAY CORRIDOR**

The player is always moving toward the distant glow, while the city
continues around and below them.

This is the locked visual identity for Dusk District.
