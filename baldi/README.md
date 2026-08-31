# Baldi's Basics 3D — Multiplayer

A new **MULTIPLAYER** entry on the mode screen. One player is Baldi and hunts
the others; the students share one pile of notebooks and have to reach an exit.

* **Baldi** — the room's creator. Moves like a player, cannot pick up
  notebooks, and has a skill wheel. He wins when every student is caught.
* **Students** — everyone who joins with the code. They share the notebook
  count; once the class has them all the exit bars lift and *any* student who
  reaches an exit wins it for the whole class.
* Students get a **10 second head start** before Baldi can catch anybody.

## Baldi's skill wheel

Hold **Q** or the **right mouse button**, draw outwards towards the skill you
want, and let go.

| Skill | Effect | Cooldown |
| --- | --- | --- |
| ⚡ Sprint | 4 seconds of extra speed | 14 s |
| 👂 Listen | see every student through walls and on the minimap for 5 s | 20 s |
| 📏 Ruler | throw a ruler; a hit freezes that student for 2.5 s | 12 s |
| 🌀 Warp | jump to a notebook nobody has taken yet | 30 s |
| 😡 Rage | 6 seconds of speed and a much longer reach | 26 s |

## Playing

Mode screen → **MULTIPLAYER**.

* **Create — I am Baldi** gives you a six character room code.
* Everyone else types that code and picks **Join as student**.
* Baldi presses **START THE MATCH** once the class is in.

The room lives only while Baldi's tab is open.

## How it is put together

The original game is untouched. `base.html` is the single-player game exactly
as it was; `mp.js` is loaded after it and patches the globals the game already
defines:

| Patched | Why |
| --- | --- |
| `updatePlayer` | broadcast our position, run catches, skills, avatars |
| `updateBaldi` | during a match his body follows the network, never the AI |
| `checkExits` | an exit ends the match for everybody |
| `checkPickups`, `tryGrabNotebook`, `Math1.finish` | notebooks are shared, and Baldi cannot take them |
| `caught` | the single-player death screen must not fire |
| `drawMinimap` | draw the other players |
| `returnToTitle` | leave the room on the way out |

Every patch checks `MP.active` first, so single player behaves exactly as
before.

**The same school for everyone.** The level is built from `Math.random`, so
before calling `newGame` the module swaps in a seeded generator keyed to the
room code and puts the real one back afterwards. Every peer therefore lays out
identical notebooks, items and rooms without sending a byte of map data.

**Transport.** The same relay as the arena game: free public MQTT brokers over
WebSocket, every peer connected to all of them, duplicates dropped by sender
and sequence number. Baldi's browser is the host — it merges everyone's
positions and publishes the world 12 times a second on
`baldischool/v1/<ROOM>/h`, and students send their own state on `.../c`.

## Building

`baldi-multiplayer.html` in the repository root is generated — the game, the
MQTT client and `mp.js` inlined into one file you can host anywhere or open
straight from disk:

```bash
node tools/build-baldi.js
```
