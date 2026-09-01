# Jujutsu Battleground — Online

An **ONLINE MATCH** button on the title screen. Instead of hitting training
dummies you fight your friends in the same city arena, with the full kit:
Gojo's Red, Rapid Punches, Twofold Kick, Palm Barrage and Limitless, Naoya's
Projection Breaker, Tanto, You're Not Toji and 24 FPS, plus the projection
meter and glass frames.

## Playing

Title screen → **PLAY ONLINE WITH FRIENDS**.

* **Create a room** gives you a six character code.
* Everyone else types that code and joins.
* Each player presses **Enter the arena** when they are ready — nobody has to
  wait for a countdown.

The training dummies step out when the match starts, so the arena is yours.
Press `C` to switch between Gojo and Naoya at any time; everyone else sees you
change. A scoreboard sits on the right and a kill feed on the left.

## How it works

Every fighter owns their own health. When your attack lands, the hit is sent
to that player, they apply it to themselves and broadcast their new health —
so nobody can be damaged by somebody else's lag, and there is no host to
route through. Positions go out 14 times a second and are interpolated at the
other end.

The neat part is that remote players are real `Enemy` instances. The game's
attacks all find their targets through `enemiesNear()`, so putting a networked
fighter in the `enemies` array means every punch, projectile, blast radius,
projection meter and glass frame already works on them — no attack needed a
special multiplayer case. Three hooks do the whole job:

| Patched | Why |
| --- | --- |
| `Enemy.prototype.update` | a remote body follows the network, never the dummy AI |
| `Enemy.prototype.damage` | our hits are sent to that player instead of applied locally |
| `Enemy.prototype.applyProj` | same for the projection meter |
| `updatePlayer` | broadcast our own state, and announce any ability we start |

The multiplayer code is appended **inside the game's own module**, which is how
it can reach `player`, `enemies`, `Enemy`, `scene`, `hurtPlayer` and the rest.
Everything is behind `MPJJ.active`, so the offline game is unchanged.

## Animation and effects

A fighter sends more than a position: speed, whether they are on the ground,
vertical velocity, which arm is mid-punch, and the current ability as
`{ type, t, dur }`. The receiving side then runs the game's **own** animation
on their rig — `resetPose`, `applyLocomotion`, `applyNaoyaFlair`, the punch
pose and `poseAction` — so a remote fighter walks, runs, jumps, swings and
holds every ability pose exactly the way it looks on their screen. The action
clock keeps ticking between packets so the pose plays smoothly at 14 updates
a second. (`poseAction` clears the local player's `visYaw` as a side effect,
so that is saved and put back around the call.)

Ability *visuals* are made by the caster's client, so they would never appear
on anybody else's screen. Each cast announces itself — watching
`player.action` and `attackT` catches all nine abilities without patching a
single cast function — and the other clients play a matching effect at that
fighter's feet: a red blast for Reversal: Red, a flurry for Rapid Punches, a
shockwave for Twofold Kick, a run of rings for Palm Barrage, a teleport puff
for Limitless, frame-blue rings for Naoya's kit. These are visual only and
never damage anything, because the hit already travels as its own message.

The title screen normally comes back whenever pointer lock is lost, which in a
match looks like being thrown out of the room. During a match it is kept shut
and a small **CLICK TO LOOK AROUND** card offers the mouse back instead.

## Looking around where the mouse cannot be locked

Apps Script frames the page with a sandbox that does not include
`allow-pointer-lock`, so the browser refuses the lock outright:

```
Blocked pointer lock on an element because the element's frame is sandboxed
and the 'allow-pointer-lock' permission is not set.
```

Nothing on the page can grant it — a popup opened from the frame inherits the
same restriction, and a nested iframe cannot hold more permissions than its
parent. So when the refusal is seen, the game switches to **drag-look**: hold
the **right mouse button** and move, which uses the same relative movement and
has no screen edge to run into, because letting go and re-gripping works like
lifting a mouse off the mat. Left click stays as your attack.

Where the lock *is* available — the file opened from disk, or ordinary hosting
— nothing changes and the mouse is captured as usual.

## Transport

Free public MQTT brokers over WebSocket, the same arrangement as the other two
games: every peer connects to all three (EMQX, HiveMQ, Mosquitto) and messages
carry a sender id and sequence number so a duplicate arriving on a second
relay is dropped. One topic per room, `jujutsu/v1/<ROOM>/all` — this is a
free-for-all, so there is no host to funnel through.

## Builds

The original game imports three.js from a CDN. Both builds vendor it instead,
so the game works on a network that blocks the CDN.

**One file** — `jujutsu-multiplayer.html` (1.1 MB). three.js is carried inside
the page and handed to the module loader as a blob URL. Open it from disk or
host it anywhere.

```bash
node tools/build-jujutsu.js
```

**Split** — `jujutsu-parts/`: a 138 kB shell plus three.js and the MQTT client
as separate files, for hosts that cannot serve one big document. The shell
refers to them as `__PART_BASE__?p=N`, so whoever serves it substitutes its own
address. Same Apps Script as the Baldi game, pointed at this folder:

```javascript
const BASE = 'https://raw.githubusercontent.com/wujiahui4-a11y/'
  + 'study-mathenmatics-G3-singapore-secondary/'
  + 'cursor/jujutsu-multiplayer-9b82/jujutsu-parts/';

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

`index.local.html` is the same shell with plain filenames, for opening from
disk.

## Files

| File | What it does |
| --- | --- |
| `base.html` | the original game, untouched |
| `mp.js` | the online mode, appended inside the game's module |
| `three.module.min.js` | vendored three.js 0.160.0 |
| `mqtt.min.js` | vendored MQTT client |
| `../tools/build-jujutsu.js` | produces both builds |
