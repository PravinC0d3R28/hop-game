# HOP sound effects — direction for review

Draft, 2026-10-08. Nothing here is generated yet. The three world songs stay as they are: Sunrise S3, Dusk D2, Deep Void V1.

## The two questions

**Game over should keep the music.** The world is still on screen, and Play Again steps back onto the same path. Stopping the song makes that feel like a reload. The bed already ducks, and Play Again already brings that same song back up. Home already returns it to the quieter menu level. Pause already freezes it. Keep all of that.

What should change is the depth of the duck. For about a second, while the miss and the flag impact play, the song should sit lower than it does now, so those two sounds have a hole. Then it settles at today's game-over level under the score card. It does not stop, and it does not restart.

**Yes, there should be a game-over sound.** There already is one. It is a sawtooth and a square wave, about four tenths of a second, fired the instant the ball misses. It reads as a buzzer, and it is not timed to the red flag, which hits the tile about 0.3 seconds later. Replace it. Do not leave the miss silent.

## What plays today

Every one of these is a generated beep, built from sine, square, sawtooth, or noise. None of them are samples.

| Moment | What you hear | How often |
|---|---|---|
| Ordinary landing | Two short sines. The pitch steps with the score, then repeats every 8 points. | Every hop that is not a perfect. A hop is 0.5s at the start and 0.35s when the run is fast. |
| Perfect landing | A rising arpeggio. A fourth note joins from streak 3. This replaces the landing sound. | Every centered landing. |
| Coin | Three rising sines, about a quarter of a second. | Every coin, and also every mission claim. |
| Fire streak | A half-second noise whoosh, then a second one. | Every fresh streak of 10 perfects. |
| Shield break | Random bright beeps plus a hiss. | Once, when a shield saves a miss. |
| Mission complete | A C-major chime. Repeats are held to one every 1.8s. | When a mission flips to done. |
| Game over | Low saw and square buzz. | The instant of the miss. |

The start-screen demo stays silent. That stays.

## What is silent, and should not be

These clicks have no sound at all:

- Play, Play Again, Home, pause, resume
- World arrows, including a locked world
- Shop, missions, stats, settings, their close buttons, and the mission tabs
- Buying a skin and equipping one
- New best, the world-unlock card, the missions-unlocked card, the shield card
- The 3-2-1 before a paused run resumes

Sliders stay silent. A drag would chatter. The hop itself stays the feedback during a run, so a finger on the canvas does not click.

## How the set should feel

The songs are already the personality of each world. Effects sit on top of them. They have to be short, or a fast run becomes a smear.

- A landing is under a tenth of a second. A perfect is a little longer, still gone before the next hop.
- A perfect replaces the ordinary landing. They never play together.
- A coin, a mission toast, and a landing can happen on the same frame. The miss cuts the landing. The coin waits a breath if a perfect is still speaking.
- Effects follow the sound slider. Music follows the music slider. That split stays.
- Hopping stays off the beat. A landing can have a little pitch movement so a long run does not become one note. It does not climb into a siren, and it does not lock to 116, 88, or 76.

World color belongs on the sounds you hear every hop. The coin, the buttons, the fire, and the shield are the same objects in every world, so they stay one sound each.

## Landings — three versions

This is the sound of the game. It should feel like the tile, heard through the song that is already playing.

**Sunrise.** A soft glassy tap, like a fingertip on a crystal. Bright, dry, no ring that hangs. The perfect is the same tap with one small sparkle on top. Higher streaks add one extra glint, not a longer tune. Pitched in D major so it can sit inside the Sunrise song. Three close pitches, so a long run is not one identical beep.

The generated takes were rejected. Landings are electronic ticks in the game, one family per world, in that world's key. A perfect is the same tick with one higher note.

| Take | Full file | One hit |
|---|---|---|
| 1 Crystal tick | `acestep_output/sunrise-land-1.mp3` (`a9852d11-1562-4b39-a0c3-7e50aae19758_1.mp3`) | `sunrise-land-1-tick.mp3` |
| 2 Glass ping | `acestep_output/sunrise-land-2.mp3` (`b66d94a4-4d2f-48b6-8117-fbea9da63eee_1.mp3`) | `sunrise-land-2-hit.mp3`, brighter `sunrise-land-2-bright.mp3` |
| 3 Warm knock | `acestep_output/sunrise-land-3.mp3` (`fbf22e25-70ce-4da5-9565-bb76b9563d96_1.mp3`) | `sunrise-land-3-hit.mp3` |

**Dusk.** A warm muted knock, wood or a soft felt piano note. Close and round. The perfect is the same knock, a little brighter, with a short warm bloom. No shaker, and no icy ping — the cyan edge on the tile is a gameplay mark, not a sound.

**Deep Void.** A soft padded tick with a hint of a distant bell. Quiet, short, no zap and no horror hit. The perfect is the same tick with one thin shimmer. Long gaps in the song should stay. The landing must not fill them.

Each world gets three takes. You pick one family. The ordinary landing and the perfect are cut from that same family, so they sound related.

## The miss

Two beats, shared shape, a light tint from the world so it belongs next to that song.

1. At the miss: a short downward breath, soft, under half a second. Sunrise is glassy, Dusk is warm, Void is a low soft tone. None of them are a buzzer, a scream, or a sad chord.
2. When the flag hits the tile, about 0.3 seconds later: a small soft impact. Same impact in every world. The camera shake is already there. The impact just confirms it.

New best, if the run earned it, is one extra sparkle after the impact. It does not replace the miss.

## One coin, for every world

The pickup is the same gold star everywhere, so the sound is one chime: a single bright note with a tiny sparkle, gone in under a fifth of a second. A little pitch variation so two coins in a row are not a copy. Not the three-note ladder it is now. That ladder stacks and it is also what a mission claim plays, which makes a claim feel like one coin.

A mission claim gets its own sound: the coin's chime, one step bigger, as if several coins landed in the bank. Still short.

## Buttons

One small set for the whole game. A wooden or soft plastic tick, 40 to 80 milliseconds, quieter than a landing. Not a beep.

| Tick | Used for |
|---|---|
| Light | Arrows, tabs, open and close for shop, missions, stats, settings |
| Confirm | Play, Play Again, resume, buy, equip |
| Soft deny | A locked arrow, or anything that does not open |
| Low | Home, and closing back to the start screen |

The 3-2-1 uses the light tick, once per number.

## The rare ones

These can be a little richer. They are still one sound for every world.

- **Fire streak.** A short rising shimmer, about a third of a second, in place of the noise whoosh. It matches the banner. It does not whoosh twice.
- **Shield break.** Keep the idea of cracked glass. Replace the random beeps with one short shatter, a little louder than a landing, because it is rare and it just saved the run.
- **Mission complete.** Two bright notes when the toast appears. The claim sound, above, is separate and plays when the coins are taken.
- **World unlock card.** One short reveal when the card opens. The missions-unlocked card and the shield card can share it.

## What we will not add

- A new song for the score screen.
- A voice, a sting that lasts more than a second, or a fail chord that asks the player to feel bad.
- A different button sound per world.
- A click on the volume sliders, or a click for steering the ball.
- Sound on the start-screen demo.

## How they are made

Every effect is synthesized in the game. No generated hit files. Sunrise ticks are high and glassy, in D major. Dusk ticks are warmer and lower, in F major. Void ticks are quieter, in E minor, with a thin overtone. The sound slider scales them, and every effect sits half again as loud as the first mix so the song does not cover it. On a miss the song drops to half the run level and stays there until Play Again or Home.
