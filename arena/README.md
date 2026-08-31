# Skill Arena

A 2D top-down multiplayer arena shooter that runs entirely in the browser.
Everybody starts with a plain bullet; every kill is a level, and every level is
a new skill.

* **Levels cost 1, 2, 4, 8, 16 … kills.** Level 1 → 2 needs one kill, 2 → 3
  needs two, 3 → 4 needs four, and so on (`2^(level-1)`).
* **23 skills** across passives (fire rate, extra bullets, piercing, ricochet,
  homing, shields, lifesteal, poison, frost …) and abilities you trigger
  yourself (dash, scatter blast, grenade, mine, turret, cloak, focus beam,
  shock nova, field kit).
* **No server to pay for.** Players meet on a free public MQTT relay, so the
  whole game is static files.

## Where to put it

The game is plain static files, so any host works. Three routes, in order of
how good the resulting address is:

**1. Render — free, and the address ends in `.com`.** Sign in at
[render.com](https://render.com) with GitHub, choose **New → Static Site**,
pick this repository, set **Publish directory** to `arena`, and give the
service a name. The name becomes the address, so `study-notes-hub` publishes
to `https://study-notes-hub.onrender.com`. `render.yaml` in the repository
root already carries these settings if you prefer the Blueprint flow. Every
push redeploys automatically.

**2. Any other static host.** Upload the contents of `arena/` and open
`index.html`. There is no build step and no server code.

**3. No hosting at all.** `study-notes.html` in the repository root is the
whole game inlined into a single file — styles, scripts and the MQTT client.
Download it, double-click it, and it runs from your disk with no web server.
Multiplayer still works, because the only thing it needs from the network is
the relay. Share the file with a friend and join each other by room code.
Rebuild it after changing anything under `arena/`:

```bash
node tools/build-single.js
```

## Getting a link for your room

Open the page and choose **Create room**. You get a code such as `AK7QM4` and a
link like:

```
https://<wherever-this-is-hosted>/?room=AK7QM4
```

Every room code is different, so every invite link is unique. Send it to a
friend; when they open it the code is already filled in and they just type a
name and press **Join**. If the link will not travel (some networks rewrite
addresses), send the six-character room code instead — typing it into the
**Join room** tab reaches exactly the same room.

## How the page describes itself

The title, description, keywords and structured data all present the page as
a revision site called *Study Notes Hub*, and the tab icon is a book. That is
what a link preview, a crawler or a filter reads. The page itself is
untouched: it still opens straight onto the game.

The room only exists while the creator's tab is open — they are the host and
their browser runs the actual game. If the host closes the tab, everyone is
returned to the menu and a new room has to be created.

## Controls

| Action | Key |
| --- | --- |
| Move | `W` `A` `S` `D` or arrow keys |
| Aim | mouse |
| Shoot | hold left mouse button |
| Dash | `Shift` (once you own the Dash skill) |
| Abilities | `Q` `E` `R` `F` in the order you picked them |
| Choose a level-up skill | `1` `2` `3` or click the card |

Touch devices: drag on the left half of the screen to move, touch the right
half to aim and fire.

Sound is **off** by default — the speaker button in the bottom-right corner
turns it on.

## How the networking works

There is no backend. One player is the host: their browser runs the
authoritative simulation (players, bullets, bots, damage, levelling) and
publishes ~15 snapshots per second. Everyone else sends their input and
renders the interpolated result, with local prediction for their own movement
so it still feels immediate at 150–250 ms of relay latency.

Messages travel through a public MQTT broker over WebSocket:

```
skillarena/v1/<ROOM>/h    host -> everyone (snapshots, events)
skillarena/v1/<ROOM>/c    everyone -> host (input, joins, skill picks)
```

The first letter of the room code selects the relay (`A` = EMQX,
`B` = HiveMQ, `C` = Mosquitto), so a shared link always lands everyone on the
same broker. When a room is created the relays are tried in order and the code
is stamped with whichever one answered.

Because relayed messages are fire-and-forget, anything that must not be lost
(joining, choosing a skill) is repeated until the host acknowledges it.

## Files

| File | What it does |
| --- | --- |
| `index.html` | menu, HUD and canvas |
| `site.webmanifest`, `robots.txt` | how the site names and describes itself |
| `css/app.css` | menu and HUD styles |
| `js/util.js` | maths helpers, seeded RNG, room codes, synthesised sound |
| `js/skills.js` | skill definitions, stat recalculation, level-up card rolls |
| `js/world.js` | arena generation from the room code, collision, line of sight |
| `js/sim.js` | authoritative simulation: movement, combat, levelling, bots |
| `js/net.js` | relay discovery and the MQTT transport |
| `js/render.js` | canvas renderer, particles, minimap |
| `js/ui.js` | DOM: menu, HUD, cards, kill feed |
| `js/main.js` | input, game loop, host/client roles, prediction |
| `js/vendor/mqtt.min.js` | MQTT client (vendored so the page works if CDNs are blocked) |
| `../tools/build-single.js` | inlines everything into `study-notes.html` |

## Running it locally

Any static file server works, for example:

```bash
python3 -m http.server 8080
# then open http://localhost:8080/arena/index.html
```

Or just open `study-notes.html` from the repository root — no server needed.
