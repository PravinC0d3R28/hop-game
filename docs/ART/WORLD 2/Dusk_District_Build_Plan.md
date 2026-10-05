# Dusk District — Build Plan

This is the plan for painting World 2. It follows the reference image and the locked art direction. The older implementation plan in this folder is not part of this work.

## Where the game is

HOP is an endless hop runner. The ball, the six floating tiles, the camera, scoring, and world unlocks are done. Sunrise Peaks is the only fully painted world: crystal formations, a cloud sea, a gradient sky, and warm tiles, driven by `WorldLook` and recycled in 240-unit chunks.

Dusk District already exists as gameplay (unlock at 1000, swaying tiles, steeper ramps). Its scenery does not. The `city` and `lantern` recipes are skipped, and two Sunrise-only effects would leak in: the sun-ray fan, and the score-driven sky shift that walks the dawn from purple toward green.

The camera, ball, and tile size stay as they are. The city is built around that camera.

## What this world is

An endless architectural canyon that frames the hop path.

Depth comes from perspective and fog. A building is large because it is close to the camera, not because it was baked as a foreground prop at one spot in the repeating chunk.

Two layers:

1. **The canyon you fly through.** Continuous buildings along both sides for the full chunk: blocks, towers, stepped roofs, arches, walls. They share a base that continues below the frame and get cropped by the screen edges. One merged mesh per chunk, recycled the same way the crystals are.
2. **The city you never reach.** A softer skyline and the sunset glow, parented ahead of the camera, so the horizon never becomes a wall you arrive at.

Lanterns sit on the buildings at three sizes, plus small ones in the distance. The center of the path stays empty.

## Left out on purpose

No separate mobile art style, no cars, people, or signs, no bloom, no cyan on buildings, and no library of named model files. Modules are a handful of procedural shapes, varied by seed, scale, and color. Deep Void stays a stub. Sunrise Peaks stays as it is.

## Build order

1. **Lock the dusk look and stop Sunrise effects from leaking.** Plum-to-peach sky, violet-to-coral buildings, ivory / gold / amber / coral tile tops, warm dark outlines (`#4A3638`). Fog keeps the mid-city saturated and dissolves only the far skyline into the sunset. The sky dome gets the full sunset ramp, brightest where this camera actually looks. Sun rays and the score-driven hue shift run only on Sunrise.
2. **Build the canyon.** A seeded city builder wired to the `city` recipe. Placement uses the live camera framing, so a phone pushes the buildings to the edges and a laptop shows more of them. A hard corridor keeps every mass off the tiles. The same seed always rebuilds the same street.
3. **Add lanterns.** Warm points on walls, a few larger ones up close, many tiny ones in the distance. They ride with the city. Nothing glowing sits on the next tiles.
4. **Paint the tiles.** Dusk tops use the warm set. Sides stay darker. A thin electric-cyan strip sits on the lower edge of each dusk tile and nowhere else.
5. **Prove it, then tune by eye.** Tests cover: dusk builds a city and no crystals, the corridor stays clear, a seed repeats, chunks cover their length, and Sunrise still builds crystals and clouds. Then check the dusk start screen on a wide frame and a phone-shaped frame.
