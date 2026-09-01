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
A scoreboard sits on the right and a kill feed on the left.

**Switching fighter takes eight seconds out of combat.** `C` starts the
wind-down and a timer appears above the ability bar; taking a hit puts you
back in combat and starts the eight seconds again, and pressing `C` a second
time cancels. You cannot switch at all while awakened.

## Gojo's awakening

A meter under the ability bar fills while Gojo fights — fastest from hits you
land and hits you take, slowly the rest of the time. At full it lights up and
`F` takes the blindfold off.

The entrance is three and a half seconds and cannot be interrupted: the ground
cracks, the air is pulled in, the blindfold comes away on a white frame with
the six eyes lit behind it, a column of cursed energy goes up and the name
card lands. You are untouchable for all of it. The other players see the
column, the shockwave and the poses, and their copy of you loses the blindfold
on the same beat you do.

For the next thirty four seconds `1`–`4` are a different kit, the aura stands
off you, and health comes back about twice as fast.

| Key | Technique | What it does |
| --- | --- | --- |
| `1` | **Lapse: Blue** | a point of attraction thrown forward; everything within nineteen metres is dragged toward it while it travels, then it collapses |
| `2` | **Reversal: Red** | repulsion thrown as a front down a thirty metre cone — the hardest knockback in the game |
| `3` | **Hollow Purple** | blue in one hand, red in the other, brought together and fired as a beam the length of the arena |
| `4` | **Domain Expansion: Unlimited Void** | a dome thirty four metres across; everyone inside is held in place and fed more than they can process |

`R` is still Limitless and the punch combo is unchanged. When the meter runs
out the blindfold goes back on and the ordinary four return.

Everything above is shared: the domain travels as its own message and locks
anyone standing inside it on their own screen, and each technique is announced
so the other clients play the matching effect from the right place, facing the
right way.

## Getting hit

A hit hard enough to move you — anything over an impulse of seventeen —
throws you rather than making you flinch. The throw is an *action*, not a
reaction, which means the game already does the work: your cast is
interrupted, movement is locked out until you land, and because the current
action is broadcast every tick, every other screen plays the same tumble on
their copy of you. Dummies and remote fighters use a matching pose driven by
the same curve: arched over the impact with the limbs trailing, then a heavy
landing and a scramble back up.

The dash was a single velocity impulse fighting a drag of ten, so it covered
about two metres. It now drives the velocity for the length of the dash and
covers about twelve, with a short window of invulnerability at the start.

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

## Spawn cutscene

Entering the arena — and every respawn after a defeat — plays a short anime
entrance for whichever fighter you are. Letterbox bars slide in, speed lines
sweep across, the camera pushes in close on the face and then sweeps around
while the fighter moves through their signature pose, cursed energy bursts at
the turn, and the name card slams in with a shockwave.

| | Gojo | Naoya |
| --- | --- | --- |
| card | GOJO SATORU · THE HONORED ONE | NAOYA ZEN'IN · PROJECTION SORCERY |
| line 1 | "Throughout heaven and earth…" | "Twenty-four frames a second." |
| line 2 | "I alone am the honored one." | "You will not see a single one of them." |
| pose | head lifts, hand raises palm-out, settles into the hero shot | arms folded, sweeps one out, chin up |

Naoya's cutscene is deliberately animated **on twos at 24 frames a second** —
his whole gimmick — while Gojo's runs smooth.

It ends with **two white flashes**, and while they land the health bar turns
white and reads **∞**: that is real spawn protection, three seconds of
invulnerability, and the bar returns to normal when it runs out. Any key or
click skips the whole thing.

The camera hands back cleanly because the cutscene ends exactly where the
chase camera lives — an offset of `(sin y, cos y)` means `yaw = facing` looks
the fighter in the face and `yaw = facing + PI` is the normal view, so the
sweep just eases into it. The HUD is hidden for the duration and the other
players see a burst of cursed energy where you appeared.

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

**Hit reactions.** The dummies already had a set of flinches — head snapped
back by a jab, doubled over by a gut punch, clutching a stab, jerked around by
a barrage — and `Enemy.applyReact` only ever touches `rig`, `react` and
`animT`, so the same animations now run on players through a small stand-in
object. The reaction an attack asks for travels with the hit, the victim plays
it, and it goes out in their state so everyone else sees the same flinch. The
attacker starts it locally the moment they connect, and a packet arriving
mid-flinch will not cut it short. No flinch plays while spawn protection is
shrugging the hit off.

Ability *visuals* are made by the caster's client, so they would never appear
on anybody else's screen. Each cast announces itself — watching
`player.action` and `attackT` catches every ability without patching a single
cast function — and the other clients play a matching effect at that fighter's
feet: a red blast for Reversal: Red, a flurry for Rapid Punches, a shockwave
for Twofold Kick, a run of rings for Palm Barrage, a teleport puff for
Limitless, frame-blue rings for Naoya's kit, and the whole awakened set. These
are visual only and never damage anything, because the hit already travels as
its own message.

### The effects kit

`vfx.js` draws effects the way a sakuga cut draws them: flat shapes that snap
in on one frame and are gone a few frames later. Almost everything is a
billboard carrying a canvas-drawn texture — four and eight point stars, spoke
bursts, rings with a hard leading edge, crescents, tapered streaks, jagged
bolts, a starfield for the domain — because that is what an impact frame
actually is. A hit is a white cross, a spoke burst and streaks that point
along their own velocity, not a ball that inflates.

The three helpers the original game used everywhere — `ringWave`, `spark` and
`explodeRed` — are re-pointed at the kit, so every existing move was upgraded
at the same time without touching `base.html`.

Two things are handled carefully because they cost frames. Rings *across* the
path of a blast are edge-on to whoever fired it, so a travelling front draws
three rings per step — across the path, facing the camera, and on the floor —
and reads from any angle. And three.js bakes the light count into every
material's shader, so the point lights used by charge orbs and auras come from
a pool created at load; adding one mid-fight would recompile every shader in
the scene exactly when the screen is busiest.

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

Nothing inside the frame can grant it, and a nested iframe cannot hold more
permissions than its parent. So when the refusal is seen, the game switches to
**drag-look**: hold the **right mouse button** and move, which uses the same
relative movement and has no screen edge to run into, because letting go and
re-gripping works like lifting a mouse off the mat. Left click stays as your
attack.

Where the lock *is* available — the file opened from disk, or ordinary hosting
— nothing changes and the mouse is captured as usual.

### Getting the lock back with **OPEN IN A FULL WINDOW**

The sandbox does carry `allow-popups-to-escape-sandbox`, so a window opened
from the frame is *not* itself sandboxed and can lock the mouse. What it
cannot do is reload the page: the address the frame is showing belongs to
`googleusercontent.com` and renders nothing outside its parent, which is why
pointing the new window at `location.href` only ever produced a blank page.

Instead the split build carries a copy of its own markup in a
`<script type="text/plain" id="__selfDoc">`, and the button opens a blank
window and writes that copy into it. A written `about:blank` window is a fresh
top level context — not sandboxed, mouse locks normally — and a `<base>` is
prepended so its scripts still resolve to the same `?p=N` addresses. The copy
is stored with its closing script tags escaped, so they are restored on the
way out.

The window is a full second player: it joins by room code like anyone else.

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
| `vfx.js` | the effects kit: impact frames, rings, slashes, beams, domes |
| `combat.js` | the longer dash, the throw, and the eight second fighter swap |
| `gojo.js` | the awakening meter, its entrance and the four techniques |
| `mp.js` | the online mode, appended inside the game's module |
| `three.module.min.js` | vendored three.js 0.160.0 |
| `mqtt.min.js` | vendored MQTT client |
| `../tools/build-jujutsu.js` | produces both builds |
