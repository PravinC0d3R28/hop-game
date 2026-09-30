# Sunrise Peaks — High-Level Three.js Implementation Plan

## Purpose

This document describes how to turn the locked **Sunrise Peaks** art direction into a real-time Three.js game world.

The target is not to reproduce the concept image as a flat background. The concept image is the **visual blueprint**. The final game should recreate its visual language using lightweight 3D geometry, materials, lighting and procedural placement.

---

## 1. Core Implementation Philosophy

Use a **procedural, modular environment** rather than importing many externally generated image/model assets.

The current art direction is especially suitable for this because the visual language is based on:

- simple chunky geometry
- low-poly/faceted crystals
- simple bounce tiles
- soft cloud forms
- flat or simple materials
- controlled lighting
- strong outlines

Most of World 1 can therefore be generated internally through code.

### Recommended target

Aim for roughly **90%+ of the visual environment to be generated in Three.js**.

External assets should be optional and reserved for unusually complex or hero elements.

---

## 2. Scene Structure

Recommended high-level world structure:

```text
SunrisePeaksWorld
├── Sky
├── Lighting
├── Atmosphere / Fog
├── CloudSea
├── CrystalEnvironment
│   ├── LargeCrystals
│   ├── MediumCrystals
│   ├── SmallCrystals
│   └── FloatingCrystals
├── Gameplay
│   ├── BounceTiles
│   └── Ball
└── Effects
    ├── Sparkles
    └── SmallParticles
```

Keep gameplay and world decoration logically separate.

---

## 3. Keep the Existing Gameplay System

Do not redesign the bounce mechanics just to implement the new art.

The world system should sit around the existing gameplay system.

The gameplay already provides the important visual structure:

- floating disconnected tiles
- player ball
- level/path positions
- camera
- bounce movement

The Sunrise Peaks work should primarily change **appearance and environment**.

---

## 4. Create a World Configuration Object

Define the world primarily through configuration rather than hardcoding colors and placement rules throughout the code.

Conceptually:

```js
const SUNRISE_PEAKS = {
  sky: {...},
  clouds: {...},
  crystals: {...},
  tiles: {...},
  lighting: {...},
  effects: {...},
  environmentRules: {...}
};
```

This makes World 2 and World 3 easier later because the gameplay engine can remain unchanged while the world configuration changes.

---

## 5. Bounce Tiles

### Implementation

Generate the tiles procedurally using simple Three.js geometry.

A tile should be a lightweight beveled/rounded rectangular platform with visually distinct top and side faces.

Recommended approach:

- BoxGeometry or lightweight custom beveled box geometry
- separate top/side material treatment where useful
- warm tile palette from the color palette document
- outline treatment shared with environmental objects

### Visual rules

- top face brighter than side face
- warm cream/gold/orange palette
- simple matte appearance
- no complex texture maps
- maintain the existing game tile dimensions and gameplay readability

---

## 6. Procedural Crystal Generator

This is the most important new reusable system.

Do not create one unique model for every crystal.

Create a **parameterized crystal generator** that can produce many variations from a common geometry language.

### Conceptual parameters

```text
height
width
number of sides
base radius
middle radius
upper taper
point height
tilt
rotation
scale
facet irregularity
palette family
```

### Geometry concept

A crystal can be built from several rings of vertices:

```text
          tip
           /\
          /  \
         /----\
        /      \
       |        |
       |        |
        \______/
```

Use irregular but controlled ring positions so the crystals feel hand-built rather than perfectly mathematical.

Keep the polygon count low.

---

## 7. Crystal Facet Materials

The faceted appearance is more important than texture detail.

Use several materials or controlled per-face material assignment.

Example logic:

```text
light-facing facet → lighter palette color
front facet        → base palette color
side facet         → darker related color
shadow facet       → deeper/muted variant
```

The crystal generator should choose from related palette families rather than random colors.

Examples:

- coral + peach + apricot
- mint + turquoise + cyan
- yellow + gold + cream
- orange + peach + cream

Avoid full rainbow assignment per crystal.

---

## 8. Crystal Variants

Create a small family of procedural presets instead of many unique assets.

Example categories:

```text
LargeWarmCrystal
TallCoralCrystal
LargeMintCrystal
TallCyanCrystal
MediumMixedCrystal
SmallAccentCrystal
FloatingCrystal
```

Each preset changes dimensions, taper, tilt and palette family.

The same generator can produce dozens of visibly different formations.

---

## 9. Environment Placement

The crystal formations should be placed procedurally around the gameplay path.

The path should remain the dominant visual structure.

### Suggested placement rules

Large crystals:

- mostly left/right of the playable path
- farther from the center line
- occasionally closer to the foreground edges
- never obscure a critical tile

Medium crystals:

- between the large formations
- moderate frequency
- can frame individual sections of the route

Small crystals:

- background depth
- occasional foreground accents
- low frequency

Floating crystals:

- very limited use
- primarily distant/background decoration

---

## 10. Cloud Sea

Do not use a single giant cloud texture.

Build the cloud sea from reusable simple cloud clusters.

A cluster can consist of several overlapping low-poly blobs, flattened spheres, or simple custom cloud meshes.

### Placement

Keep the cloud layer below the gameplay world and around the lower edges of the frame.

Some large crystal formations should appear to emerge from the cloud layer.

### Important constraint

The clouds must not obscure the central bounce path.

The cloud system should support depth and atmosphere rather than become a gameplay obstacle.

---

## 11. Sky

Generate the sky procedurally.

Recommended implementation options:

- scene background + simple gradient
- lightweight sky dome
- fullscreen gradient shader
- subtle atmospheric fog

Use the Sunrise Peaks sky palette from the color document.

The background should remain softer and less saturated than the crystals.

Do not depend on a large painted sky texture unless there is a later artistic reason to do so.

---

## 12. Lighting

Use warm directional morning lighting from the upper-left.

Recommended conceptual setup:

```text
Warm Directional Light
          ↘
           ↘
     [crystals / tiles]
           ↓
    soft shadow to lower-right
```

Use:

- one strong warm directional/key light
- soft ambient or hemisphere fill
- restrained shadowing
- optional very subtle fog/atmospheric depth

The lighting should create the facet contrast visible in the concept art.

Do not rely on emissive textures to fake the entire lighting style.

---

## 13. Outlines

The dark outline around the geometry is a major part of the visual identity.

Use a consistent real-time outline approach across:

- bounce tiles
- crystals
- ball
- important foreground objects

Possible Three.js implementation approaches include:

- post-processing outline pass
- expanded-backface outline mesh
- shader-based edge treatment

Choose the implementation based on the existing project's renderer/post-processing architecture.

The important requirement is **consistent visual thickness and clean silhouettes**, not a specific technical method.

---

## 14. Materials

Keep materials simple.

Preferred direction:

- matte or semi-matte
- low texture dependence
- controlled roughness
- restrained specular response
- strong color blocks

The visual style should come from geometry, color and lighting rather than high-resolution texture maps.

---

## 15. Effects

Effects should remain subtle.

Optional effects:

- tiny warm sparkles
- a few floating particles
- very soft atmospheric haze
- subtle bounce impact effect
- subtle tile highlight on successful landing

Do not add heavy bloom, lens flare or large particle systems.

The game should remain visually clean and readable.

---

## 16. Performance Considerations

Because this is a real-time Three.js game, prefer reusable geometry and materials.

### Reuse aggressively

Use shared geometry/materials where possible.

### Consider InstancedMesh

For many repeated small crystals or background objects, use `THREE.InstancedMesh` where practical.

### Keep polygon counts low

The visual style does not require dense meshes.

### Avoid unnecessary texture memory

Most of the world can work with flat colors and procedural geometry.

### Keep shadow quality reasonable

Use enough shadow quality for readability, but avoid expensive settings that do not meaningfully improve the look.

---

## 17. Suggested File / Module Structure

The exact structure should follow the existing project, but a clean conceptual split would be:

```text
worlds/
  sunrisePeaks/
    SunrisePeaksWorld.js
    sunrisePeaksConfig.js
    createCrystal.js
    createCloudCluster.js
    createSunriseLighting.js
    placeEnvironment.js

materials/
  worldMaterials.js

components/
  Tile.js
  Ball.js
```

If the project already has equivalent systems, integrate rather than duplicating them.

---

## 18. Procedural Environment Decorator

A useful high-level function is:

```js
placeEnvironment(levelData, SUNRISE_PEAKS)
```

It should inspect the existing tile path and place environmental elements around it.

Conceptually:

```text
Level tile data
      ↓
Environment decorator
      ↓
 ┌───────────────┐
 │ Crystal rules │
 │ Cloud rules   │
 │ Depth rules   │
 │ Palette rules │
 └───────────────┘
      ↓
Final Sunrise Peaks scene
```

This avoids manually decorating every level.

---

## 19. Camera / Composition

The final Three.js camera should preserve the visual language of the original gameplay screenshot and the selected Sunrise Peaks concept.

Maintain:

- elevated three-quarter angle
- readable top and side faces of tiles
- foreground tile larger than distant tiles
- clear central route
- generous negative space
- environmental crystals framing left/right

Do not let scenery drive the camera composition.

The camera exists to make the gameplay readable first.

---

## 20. Build Order

Implement in this sequence:

### Phase 1 — Palette

Create the Sunrise Peaks color constants from `Sunrise_Peaks_Color_Palette.md`.

### Phase 2 — Tile treatment

Match the existing bounce tiles to the new cream/gold/amber palette.

### Phase 3 — One crystal

Build and tune one procedural crystal until its silhouette, facets and lighting feel close to the concept.

### Phase 4 — Crystal variants

Create the small family of procedural crystal presets.

### Phase 5 — Environment placement

Place crystals automatically around the existing tile path.

### Phase 6 — Cloud sea

Add the cloud layer and make crystals visibly emerge from it.

### Phase 7 — Lighting

Tune warm upper-left directional light and shadows.

### Phase 8 — Outlines

Add or tune the consistent outline system.

### Phase 9 — Atmosphere

Add sky gradient, subtle fog and only minimal particles/sparkles.

### Phase 10 — Visual comparison

Compare the running Three.js scene against the locked Sunrise Peaks concept image and tune:

- crystal size
- crystal spacing
- color saturation
- facet contrast
- cloud height
- lighting direction
- tile brightness
- camera framing

Do not solve visual mismatch by simply adding more objects.

---

## 21. External Assets — When to Use Them

External assets are **not required for the first implementation**.

Use generated/code geometry for:

- tiles
- crystals
- clouds
- sky
- lighting
- simple effects

Consider Blender/GLB assets later only if a particular element needs a custom hero shape that procedural geometry cannot reproduce well.

A small number of hero meshes is preferable to a large library of unrelated assets.

---

## 22. Definition of Done for Sunrise Peaks

The world is visually ready when:

1. The game still immediately reads as the original bounce-tile game.
2. The crystals are the primary environmental color source.
3. The crystals feel chunky, faceted and candy-colored.
4. The sky/clouds remain soft and do not compete with gameplay.
5. The tiles clearly read as gameplay objects and use a controlled warm palette.
6. The ball is always easy to find.
7. Warm upper-left lighting creates consistent facet direction.
8. Outlines feel coherent across the scene.
9. The environment looks good with multiple level layouts, not only one hand-crafted composition.
10. The visual result can run in Three.js using lightweight real-time geometry and materials.

---

## 23. Reference Images

Use these references during implementation:

- **Locked Sunrise Peaks concept:** `Create_3D_mobile_game_scene_20260928223134.jpg`
- **Original gameplay structure reference:** `1d2618ab-d76e-4a38-85c6-6d9f0e606637.png`

The locked concept is the primary reference for the world art.
The original screenshot is the primary reference for gameplay composition.

---

## Final Principle

> **Treat the concept art as the blueprint, not the asset.**
>
> Recreate its visual rules in Three.js using procedural geometry, controlled materials, lighting and environment placement.

The goal is a reusable **Sunrise Peaks world system**, not a one-off scene that only works for one screenshot.
