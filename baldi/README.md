# Baldi's Basics 3D — Multiplayer

A new **MULTIPLAYER** entry on the mode screen. One player is Baldi and hunts
the others; the students share one pile of notebooks and have to reach an exit.

* **Baldi** — the room's creator. Moves like a player, cannot pick up
  notebooks, and has three skills on keys 1, 2 and 3. He wins when every
  student is caught.
* **Students** — everyone who joins with the code. They share the notebook
  count; once the class has them all the exit bars lift and *any* student who
  reaches an exit wins it for the whole class.
* Students get a **10 second head start** before Baldi can catch anybody.

## Baldi's skills

Three of them, one key each, shown as three little chalkboards along the
bottom of the screen.

| Key | Skill | Effect | Cooldown |
| --- | --- | --- | --- |
| `1` | Ruler | throw it; a hit freezes that student for 2.5 s | 10 s |
| `2` | Listen | see every student through walls and on the minimap for 5 s | 18 s |
| `3` | Anger | 6 seconds of speed and a much longer reach | 22 s |

A board greys out while it recharges, with the seconds left written across it
and the chalk line under the drawing filling back in.

## Mouse look

Strict first-person mouse look. The existing **Join as student** or **Start
the match** click is used as the browser-required gesture, so there is no extra
click at the start: the cursor is captured, hidden and held in the centre.
`movementX` and `movementY` rotate the view directly; cursor position, screen
edges and mouse buttons are never used.

`unadjustedMovement` requests raw input without the desktop's acceleration
curve. `Esc` releases the pointer, at which point a **CLICK TO LOOK AROUND**
card appears; one click captures it again. While it is loose, mouse movement
is deliberately swallowed, so the old edge-turn behavior cannot come back.

If a page refuses pointer lock the game retries plainly and from fullscreen.
Google Apps Script frames its pages with a sandbox that has no
`allow-pointer-lock`, so the browser refuses outright:

```
Blocked pointer lock on an element because the element's frame is sandboxed
and the 'allow-pointer-lock' permission is not set.
```

There is one way out. Apps Script's sandbox includes
`allow-popups-to-escape-sandbox`, so a pop-up opened to a **real URL** is a
fresh top level window that is not sandboxed — and the mouse locks there
normally. An embedded page now says so and offers **OPEN IN A FULL WINDOW**,
both in the lobby and beside the look hint during a match. (A blob pop-up does
not work: blob URLs inherit the opener's sandbox flags. A nested iframe cannot
help either, since it can never hold more permissions than its parent.)

For anyone who stays in the frame, the game switches to **drag-look**: hold the
**right mouse button** and move. It reads the same relative movement, so there
is still no cursor position or screen edge involved, and releasing and
re-gripping works like lifting a mouse off the mat. Left click stays as shoot.
The single player pause card is also kept from freezing a live match.

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

Two builds come out of the same sources.

**One file** — `baldi-multiplayer.html` in the repository root: the game, the
MQTT client and `mp.js` inlined, 2.2 MB. Host it anywhere or open it straight
from disk.

```bash
node tools/build-baldi.js
```

**Split** — `baldi-parts/`: a 45 kB shell plus five separate scripts. Some
hosts cannot serve a 2.2 MB document in one piece; Google Apps Script for
instance truncates it, which leaves a script block cut in half and the page
dies with `SyntaxError: Unexpected end of input`. This build keeps the
document small and loads each script on its own.

```bash
node tools/build-baldi-parts.js
```

`baldi-parts/index.html` references its scripts as `__PART_BASE__?p=N`, so
whoever serves it substitutes its own address. `index.local.html` is the same
shell with plain filenames, for opening from disk.

### Serving the split build from Google Apps Script

Useful when the network blocks ordinary hosting but allows `google.com`.
New project at script.google.com, paste this, then Deploy → Web app →
Execute as **Me**, Access **Anyone**:

```javascript
const BASE = 'https://raw.githubusercontent.com/wujiahui4-a11y/'
  + 'study-mathenmatics-G3-singapore-secondary/'
  + 'cursor/baldi-multiplayer-mode-9b82/baldi-parts/';

function doGet(e) {
  if (e.parameter.p) {
    return ContentService
      .createTextOutput(UrlFetchApp.fetch(BASE + 'p' + e.parameter.p + '.js').getContentText())
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  const html = UrlFetchApp.fetch(BASE + 'index.html').getContentText()
    .replace(/__PART_BASE__/g, ScriptApp.getService().getUrl());
  return HtmlService.createHtmlOutput(html).setTitle('Study Notes Hub');
}
```

The page then asks the same web app for each script in turn, so nothing bigger
than 900 kB is ever served in one response.

### If it does not start

The built pages carry a small probe. If the 3D never appears it waits, retries
start-up once, and then says which of three things went wrong: the file did
not arrive in full, the browser refused a WebGL canvas, or start-up threw —
in which case it prints the exception.
