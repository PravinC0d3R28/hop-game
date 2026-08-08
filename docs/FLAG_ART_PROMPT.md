# Failure Flag — 2.5D Art Prompt

For generating a 2.5D asset to replace the procedural flag mesh, IF we move to
the asset route. The procedural version in `EffectsSystem.playFailureFlag`
should stay the fallback; this doc captures the exact art direction so the
asset matches the game.

---

## What it is

On a real miss, a small flag drops from the sky and plants into the center of
the platform the player failed to land on. It stays planted (visible behind
the dimmed game-over overlay) until the next run. It is a **penalty marker** —
deliberately crimson, but it must still feel hand-made and cozy, not violent.

Current procedural specs (for scale reference):

| Part | Current procedural value |
|---|---|
| Pole height | 1.1 world units (platform is 2.2 wide) |
| Pole color | cream paper `#f0e6d8` + thin dark rim |
| Pennant | crimson `#c0392b`, flat edge on pole, wavy tip flying outward, ~0.7 long |
| Outline | thin `#111111` paper edge, never a thick border |

---

## The prompt (tuned to the real in-game style)

> A tiny paper-craft pennant flag, flat-shaded 2.5D game asset on a pure
> transparent background. Deep crimson flag cloth `#c0392b` with a subtle
> darker crimson fold line near the pole. The flag's straight edge is attached
> to a thin vertical paper pole; the cloth tips fly outward and slightly up
> with a gentle flutter curve on the top and bottom edges — like a small
> pennant waving in a soft breeze. Pole is cream paper `#f0e6d8` with one thin
> dark `#111111` rim down each side (paper edge, not a thick comic outline).
> A tiny soft shadow pools under the flag base. Flat cel-shaded lighting, no
> gradients larger than one subtle fold, no glow, no bloom, no outline around
> the whole silhouette. Storybook paper-craft diorama style matching a cozy
> endless-hopper arcade game. Clean vector-like edges, high resolution,
> readable at small size (about 40 pixels tall on screen).
>
> Orientation: front view, flag facing the camera, pole perfectly vertical,
> flag base centered at the bottom of the frame.
>
> Do NOT: make it cartoony-plastic, glossy, metal, glass, neon-glowing,
> detailed fabric weave, drop-shadow outside the base, or add text/logos.

---

## If you want per-world palette variants

The flag is crimson in every world (it's a universal fail marker), but the
**pole** can echo the world for a crafted feel:

- **Sunrise Peaks:** pole cream `#f0e6d8`, cloth `#c0392b`.
- **Dusk District:** pole sand `#ffd9a0`, cloth `#c0392b`.
- **Deep Void:** pole slate `#2a2f52`, cloth `#d63a35` (slightly brighter so it
  reads against the dark world).

If you prefer one universal asset, use the Sunrise version.

---

## Integration notes (if we use the asset)

- Load via `TextureLoader` exactly like `Coin.png` does
  (`MaterialFactory.loadCoinTexture` → `createCoinMaterial`, see
  `src/systems/MaterialFactory.ts:102-130`).
- Render as a **billboarded plane** (or a plane with a fixed slight tilt)
  planted at the platform center: `x = platformX + swayOffset`,
  `z = platform.z`, base `y = PLATFORM_HEIGHT / 2` (0.4).
- File: transparent **PNG**, ~256×256, flag base centered at the bottom-center
  of the canvas. Keep the same silhouette as the procedural version so the
  drop/impact feel is unchanged.
- The drop animation, debris, dust puff, settle wobble, and impact shake stay
  exactly as implemented — only the flag mesh is swapped for the texture
  plane.

---

## Why the old procedural flag looked wrong (don't repeat these)

1. The dark "paper edge" mesh was placed **in front** of the cloth and scaled
   up, so it covered the crimson entirely → the flag read as a black blob.
   → Paper edges go **behind** the cloth and stay thin.
2. The triangle's **pointy tip** was attached to the pole. A pennant's **flat
   edge** attaches to the pole and the tip flies outward.
3. It was too small to read at game-over camera distance.

---

## Deliverable

1. One transparent PNG (256×256 min, 512 preferred) following the main prompt
   above.
2. Optional: the three pole-color variants as separate PNGs with identical
   silhouettes.
3. Naming: `assets/flag.png` (or `flag_sunrise.png` / `flag_dusk.png` /
   `flag_void.png` if variants).
