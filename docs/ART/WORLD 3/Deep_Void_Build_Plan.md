# Deep Void — Build Plan

This is the plan for painting World 3. It is written from the four reference paintings in this folder and from `Deep_Void_Color_and_Visual_System.md`. The paintings decide the shapes. The color document decides the hex values, as long as those values still look like the paintings.

Nothing in this file is built yet. The order at the end is the order the pieces should be made, one at a time, so each one can be looked at before the next starts.

## What the four paintings are

They are the same world from four angles, not four different worlds.

| File | What it shows most clearly |
|---|---|
| `Deep_Void_world_art_direction_20261006155825.jpg` | Ringed planets on both sides, a cracked island with a monolith rising off it, cyan seams in the rock, tiles with constellation drawings and cyan or magenta rims |
| `Deep_Void_art_direction_guide_20261006160355.jpg` | One huge broken ring standing in the sky, wide islands, a monolith with a constellation drawn on its face, tiles with a pale rim |
| `Deep_Void_art_direction_guide_20261006155844.jpg` | Many broken rings at different sizes and tilts, an island wrapped in a broken ring, tall dark pillars, a strong aurora behind everything |
| `Deep_Void_art_direction_concept_20261006160324.jpg` | Two large ringed planets framing the path, a cluster of hanging shards, islands at several depths, one pale tile among dark ones |

Shared in all four: a dark blue void, a cyan-to-magenta aurora, warm gold stars, a few constellation lines, one small crescent moon, dark low-poly rocks, and a short chain of square tiles down the middle. No ground, no city, no crystals, no ships.

## What stays the same as the rest of the game

The camera, the ball, the tile size, the jump, the sway, the unlocks, and the UI do not change. World 3 is scenery and tile paint around that.

The camera sits above and behind the ball and looks down the path at about 40 degrees. Anything placed flat in front of the ball, low in the frame, reads as a card on the floor. The Dusk sun did that. The moon and the big rings have to be aimed so they do not.

Scenery recycles in the same 240-unit chunks Sunrise and Dusk use. The same seed must rebuild the same layout. A phone shows a narrower canyon than a desktop; that is placement, not a second art style. Nothing solid crosses the hop corridor.

## Non-negotiable

These are in the world even if a later pass cuts decoration.

1. **Aurora.** Soft flowing bands, cyan and teal first, then blue, then violet and magenta. Irregular, not equal stripes. Brightest behind the structures, quieter over the tiles.
2. **One crescent moon.** Small, cool white, a soft halo. It stays in the upper sky. It is not a destination and it is not a disc sitting on the path.
3. **Stars.** Warm gold points, a few brighter white-gold ones, different sizes. Distant ones are smaller. A handful of thin constellation lines connect some of them. Not a full-sky grid.
4. **Ringed planets.** A dark faceted ball with one or two rings around it. The rings are the subject, not a glowing planet.
5. **Broken rings that still read as a full circle.** A ring has at most three splits. Each split is a real gap, not a hairline. The rest of the circle stays closed enough that it is obviously one ring. A few broken rocks float near the gaps. They are part of that ring, not debris spawned on their own. This applies to the gate ring over the path and to the rings around planets.
6. **Floating rocks.** Dark, low-poly, several silhouettes, from chips up to islands that crop the edge of the frame.
7. **The giant gate ring, only sometimes.** This is the vertical circle in `Deep_Void_art_direction_guide_20261006160355.jpg`. It stands over the path and the tiles pass through the opening. It is not a small hoop on a single tile. It shows up sparingly down the run, not as a row of hoops.

## Color

Use the locked palette. The paintings are darker in the stone and brighter only in the aurora, the star points, the moon, and the thin rims.

Structures stay in this family:

- `#0B1228` shadow
- `#101B3A` midnight
- `#17284E` main face
- `#24446B` lit face
- `#355B79` rare highlight
- `#302B67` a little violet in the stone, not a purple object

Aurora: `#32D8E5`, `#24C7C8`, `#4A9BE8`, `#8E66E8`, `#C45AE5`, `#B8A4EF`.

Stars: `#F7D66A` for most, `#FFF3B0` and `#FFF9E8` for a few bright ones. Not saturated yellow.

Moon: core `#DDF7FF`, glow `#79D8F2`, halo `#466EA8`.

Tiles: mostly `#111A38`, `#18264B`, `#26385D`, sometimes `#43386F`. A few tiles, not most, use a light top: `#EEF3EA`, `#DDE8E7`, or `#CFC8F0`.

Tile edge glow: cyan `#36E4EE` is the usual one, violet `#8A73F5` is the second, magenta `#D35BE7` is rare.

Constellation lines, when they appear: `#8FB8D6` or `#D8BE78`, with tiny nodes `#FFE8A0`. Thin and quiet.

The color document says not to add a giant planet. The paintings do have large ringed bodies beside the path. Those are the ringed planets in this plan: dark rocks with rings, big enough to frame the screen, not a sky-filling world you fly toward.

## Structures to build

Each family gets three to five authored variations. A variation is a finished design: its own silhouette, its own gaps, its own nearby rocks. Gameplay only picks a finished variation and places it. It does not assemble a ring out of loose arcs, or stick a monolith onto a random island, at spawn time.

A compound is one asset. The gate ring and the chips near its gaps are one piece. A planet and its rings are one piece. An island with a monolith that belongs to it is one piece. Empty sky between these pieces is correct. The ball moves forward, and the next piece is another finished structure, not a denser copy of the last one.

### Sky, not scenery chunks

These stay with the camera, the way the Dusk sunset stays ahead of you. You never hop into them.

| Piece | What it is | Seen in the paintings |
|---|---|---|
| Aurora | Two or three wide ribbons across the sky, soft edges, cyan through magenta | All four, strongest in the third painting |
| Star field | Points at two or three sizes, warm gold | All four |
| Constellations | A few short figures of 3 to 6 stars. Sparse. Some only in the distance | All four, never a full grid |
| Crescent | One moon, upper sky, small, with a halo | All four, always one |

### Rings

A ring is a full circle of thick dark blocks with at most three gaps. The inner rim can carry a thin cyan or pale blue edge. The body stays dark. It is not a portal and it does not glow as a whole. Small broken rocks sit near the gaps, inside the same asset.

The gate ring is the vertical circle in `Deep_Void_art_direction_guide_20261006160355.jpg`. The tile chain flies through the opening. The blocks stay off the hop corridor. There is no planet inside this one. It appears less often than islands and monoliths.

Planets are separate. They sit beside the path, each one a dark faceted ball with its own broken rings and nearby chips, authored as one piece.

| Piece | What it is | Seen in the paintings |
|---|---|---|
| `ring-gate` | Four variations. The big vertical circle the tiles pass through. At most three gaps, chips near those gaps, no planet in the middle | `Deep_Void_art_direction_guide_20261006160355.jpg`, the ring on the right. Also the large rings in the third painting |
| `ring-planet` | Four variations. Faceted dark ball, broken rings, chips. Beside the path, never over it | First and fourth paintings, left and right |
| `ring-orbit` | Three variations. A thin broken ring that already belongs to a monolith or a small rock in that same asset | First painting, the tall shard on the right; third painting, the small rings |

A ring planted flat on the ground will look like a plate. The gate ring stands upright so you look through it. The planet rings are tilted so the circle reads from this camera, and they stay off to the side.

### Rocks

Dark stone only. No brown asteroid colors. A few faces catch `#24446B` or `#355B79`. Cracks, when a piece has them, are a thin cyan line in the seam, not a neon web.

| Piece | What it is | Seen in the paintings |
|---|---|---|
| `island-wide` | Four variations. A broad low island, flatter on top, jagged underneath | Second and fourth paintings, the large side masses |
| `island-jagged` | Four variations. An irregular cluster, no flat top | First painting, the island right of the path; third painting, the left cluster |
| `island-seam` | Three variations. A rock with one or two cyan cracks | First painting, the island with the glowing seams |
| `island-crowned` | Four variations. An island and the monolith that belongs to it, designed together, including the gap if the monolith floats just above the rock | First painting, the monolith over the cracked island; second painting, the pillar on the right island |

### Monoliths

Tall, dark, simple. They are not Sunrise crystals and they are not buildings. A monolith can have one thin cyan edge where a face catches the aurora. A few, not all, get a small constellation drawn on the front face.

| Piece | What it is | Seen in the paintings |
|---|---|---|
| `monolith` | Four variations. One tall shaft, slightly tapered, faceted | All four |
| `monolith-cluster` | Three variations. Several shafts of different heights, designed as one group | Fourth painting, the group hanging at the top |
| `monolith-marked` | Three variations. A shaft with a constellation on the face toward the path. This is the stone, not the tile | Second painting, the tall block on the left |

### Tiles

The tile box does not change size. Only the paint and a few attachments change, and only while World 3 is the active world.

| Treatment | How often | What it is |
|---|---|---|
| Dark top and side | Most tiles | The navy and slate list above |
| Light top | Rare | Ivory, moonlit, or lavender. A rhythm, not a random flicker every tile |
| Edge glow | Most tiles | A thin rim on the tile face. Cyan usually, violet sometimes, magenta rarely. It stays a line, not a neon block |

No constellation is drawn on a tile. Constellation lines stay in the sky, and on the few monoliths authored with them. The circle the tiles pass through is the gate ring, not a ring attached to the tile.

## How they get placed

Three depths, same idea as Dusk, different shapes.

- **Gate.** Every so often, one `ring-gate` stands on the path ahead. The tiles pass through the opening. The blocks of the ring stay outside the corridor.
- **Sides.** Wide islands, monoliths, and ringed planets sit left and right, cropped by the frame. They do not form a wall.
- **Far.** Smaller rocks, chips, and thin rings. They fade with the fog. They are not a second copy of the near shapes shrunk down.

The aurora, stars, constellations, and moon are not in those rows. They live on the sky and move with the camera.

A phone keeps the same pieces and the same scale relationship. The near row sits at the corridor, and the mid and far rows start further out and further ahead, so they are not stacked beside the ball.

Every solid, including a ring segment, stays outside the hop corridor. Chips included.

## Left out on purpose

No crystals, no city, no lanterns, no clouds, no ships, no portals, no interface rings, no second moon, no sun. No photoreal planet. No constellation drawn on every surface. Debris is a few chips around a large piece, not a particle storm.

Outlines in the paintings are dark and stuck to the shape. Dusk showed that a shell offset from every face looks like a floating plate. Void outlines have to stay on the surface. If a shell starts to float, the piece loses the shell and keeps the facet colors.

## Build order

Each step is reviewable on its own. Do not start the next until the current one looks right in the game or in the piece viewer.

1. **Lock the void look.** Sky, fog, lights, and tile colors from the palette above. Stop Sunrise rays and the Dusk canyon from showing in this world. Fog must leave the tiles readable and only soften the far rocks. The sky is deep navy, not black.
2. **Sky.** Stars, a few constellations, the aurora ribbons, then the crescent. Check that the moon sits in the sky and not on the path. This is the first thing to look at in `?world=void`.
3. **The gate ring.** Author `ring-gate` and look at it alone, upright, with the tile path running through the hole. The gaps between the blocks have to read, and the shape has to stay a full circle.
4. **The ringed planet.** `ring-planet` beside the path, dark core, broken rings. Then `ring-orbit` for the small version.
5. **Rocks.** The island variations, including the crowned ones as finished compounds. Chips that do not belong to a ring or a planet are not a separate spawn.
6. **Monoliths.** The shaft, cluster, and marked-face variations, each one a finished piece.
7. **Tiles.** Dark faces, the rare light top, and the edge glow. No constellation. No ring on the tile.
8. **Plant the field.** Spawn finished variations, with empty stretches between them. A gate ring shows up less often than an island or a monolith. Corridor clear. Phone and desktop both checked. Same seed, same layout.
9. **Prove it.** Tests for the corridor, the seed, the presence of a ring, a rock, the moon, and the aurora, and that Sunrise and Dusk still build their own scenery. Then a desktop screenshot and a phone screenshot before calling the world done.
