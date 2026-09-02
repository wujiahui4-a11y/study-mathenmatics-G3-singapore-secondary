# Jujutsu Battleground — Online

An **ONLINE MATCH** button on the title screen. Instead of hitting training
dummies you fight your friends in the same city arena, with the full kit:
Gojo's Red, Rapid Punches, Twofold Kick, Palm Barrage and Limitless, Naoya's
Projection Breaker, Tanto, You're Not Toji and 24 FPS, plus the projection
meter and glass frames.

## Playing

Title screen → **PLAY ONLINE WITH FRIENDS**. Five fighters: Gojo, Naoya, Yuji,
Hakari and Choso.

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

## Hakari Kinji

Built from the source rather than invented. His technique is pachinko, and
outside his domain he can only put out the machine's furniture — shutter doors
to take an attack, and the balls — so most of what he does he does with his
hands.

| Key | Move | What it does |
| --- | --- | --- |
| `1` | **Shutter** | a train door dropped between him and whatever is coming, which blocks anything hitting him from the front, and is then thrown through them |
| `2` | **Ball Barrage** | the other half of the machine, at speed |
| `3` | **Gachinko** | three of his own and the floor after them |
| `4` | **Idle Death Gamble** | the domain |
| `R` | **Overwhelm** | shoulder first, straight through |

The domain's sure hit is the rules rather than a wound: everything inside is
held for a moment and told how the game works. Then it runs a machine. Three
reels land one at a time, and when the first two match the third takes its time
about it. Three sevens and he is given **unlimited cursed energy and an
automatic reverse cursed technique** — no cooldowns at all, eleven health a
second, and a floor of one health that cannot be gone through. Miss and the
domain simply runs again, which is what it does in the manga.

The real odds are one in two hundred and thirty nine and the real song is four
minutes and eleven seconds. Neither of those is a game, so the reels open at
three in ten and improve every time they miss — and that carries across
domains, the way the increased probability does — and the round is twenty
eight seconds rather than four minutes.

## Yuji Itadori

A third fighter, on the same bones as the other two: a rig config, an entry in
`CHARS`, and moves that live in `stepAction` and `poseAction`. Pink crop,
shaved sides, school collar, and markings that stay hidden until something else
is driving.

He has no technique, so everything he throws is thrown with his body, and that
is the brief for the animation. Every move starts from the floor: the back foot
turns, the hips go before the shoulders, the fist is last, and he finishes past
the target rather than at it.

| Key | Move | What it does |
| --- | --- | --- |
| `1` | **Divergent Fist** | lands, and then lands again half a second later — which is why the first hit barely moves them |
| `2` | **Black Flash** | the frame goes out, comes back white, and what is left behind is black line work thrown through the air rather than light |
| `3` | **Manji Kick** | a turning kick that takes them up with it |
| `4` | **Crushing Blow** | up, and back down through the floor |
| `R` | **Surge** | output dumped at once, to make room |

`F` spends the shared meter on the thing living in him: the markings come up
and for twenty six seconds everything he throws lands about a third harder.

His poses run through the same spring layer as the cutscenes, but only while a
move is playing — a spring on walking is just input lag. The arm doing the work
is given a much stiffer spring than the rest of him: a strike that takes an
eighth of a second on a loose spring never actually extends, and the whole
thing reads as gliding.

## Sukuna

`F` a second time, while Yuji is already transformed, lets the thing inside
him out. He goes down first — hands on his own head, shaking, losing — and
what stands up has four eyes, a mouth on its cheek, and the King of Curses'
hands.

| Key | Move | What it does |
| --- | --- | --- |
| `1` | **Dismantle** | 解 — a net of cuts thrown across everything in front of him |
| `2` | **Cleave** | 捌 — one cut, on one target, adjusted to whatever it has to go through |
| `3` | **Fuga** | 竈 — the furnace opened, and an arrow of it loosed |
| `4` | **Malevolent Shrine** | 伏魔御廚子 — the shrine, with no barrier, cutting everything inside it |

### Dismantle is a net, not a slash

From the source: Dismantle is not one cut aimed at one person. The slashes
are **woven into an interconnected grid** across the whole space in front of
him — the ways out as much as whoever is standing in it. Any one line of the
net is survivable. Everything caught in all of them at once is not.

So it is thrown as three lattices at different depths, thirty six metres
deep and twenty four across, each line drawn on a frame later than the one
before it so the net weaves rather than appearing; the same grid goes through
the floor. The weave itself is a hundred small cuts and barely moves anybody.
Three quarters of a second later everything inside it **comes apart along the
lines**.

And a body that had little enough left when the net closed does not fall
over. Dismantle reduces people to cubes of flesh in the source, and it does
here: the rig is cut into the eleven pieces the lattice cut it into plus the
cubes between them, and they land where they were thrown and stay there.

### Fuga is an arrow

The Divine Flame was a beam, which is wrong. He opens the furnace and the
fire that comes out of it is **drawn into a shape** — a head, a shaft, and
four flights — held on the line by the front hand and drawn back against the
shoulder by the other. Then it is loosed, and it is a real object travelling
down the arena at forty two metres a second: slow enough to watch, hot enough
that what it reaches is not put out afterwards, and it leaves the ground
burning in a line behind it. Anything it kills **burns down to a husk**, which
stays where it fell.

**Making it read.** The first version of it was too big and all glow, so
there was no arrow in it — just a bright mess going down the road, and during
the draw it was pulled back to three metres in front of a camera sitting on
his shoulder, which put it across the whole lens. Two things fix that. It is
about half the size it was, and it is drawn back only as far as ten metres,
so the shape stays a shape. And every bright part of it is drawn twice: a
dark shell a little larger than the part it sits on, faces turned inward so
only the far side renders, with the fire inside that. Two passes give an
outline, and an outline is the only reason a shape reads against something as
loud as fire. The tail starts behind the fletching and never in front of it.

**Where it lands.** It stops at the first thing it touches rather than
passing through. Then two frames, which are the manga's: one white, held for
almost nothing, and then one black — a flash on its own only brightens the
screen, but a flash that goes to black is an event. A fifth of a second later
the ground opens and the fire goes **up** rather than out: a two hundred metre
pillar, soot on the outside, fire inside it and white down the middle, with
thirty flames climbing it in sequence so it is fire going up and not a bar of
light standing in the road. Debris, shock rings, a scorch mark and smoke are
what it leaves.

### Malevolent Shrine has no barrier

Every other domain closes a space off and works inside it. This one is put
down in the space that was already there, which is the binding vow that buys
its sure hit a radius nothing else gets. **So the city stays exactly where it
is** — you can see it between the ribs — and the cuts fall on everything
inside sixty two metres whether it is standing in the shrine or not.

The shrine itself is built from what the source describes: ox skulls holding
up the platform with their mouths open, a hip and gable roof with horns out
of the ridge and human skulls hanging off the eaves, a pair of closed mouths
in each gable, a **ribcage for a ceiling** over the yard, and four ways in
that are four enormous mouths with human teeth and a tongue rolled out
through them.

The camera is only borrowed for the opening. After five seconds it is handed
back and the shrine is simply somewhere you are now fighting — for thirteen
and a half seconds it rains full length Cleaves across the whole radius,
drops a lattice over anybody inside it three times a second, and cuts apart
anything that runs out of health in there.

## Choso

The eldest of the nine Death Painting Wombs — half human, half cursed spirit,
and the only thing he does is move his own blood. Black hair tied up with two
long strands left down the front of it, the stitch mark across the bridge of
his nose, and a high collar.

Blood manipulation is a technique of pressure, not of volume, so nothing he
throws is a cloud of red: everything is a **line**, drawn thin, with the whole
of the pressure behind the point of it.

| Key | Move | What it does |
| --- | --- | --- |
| `1` | **Piercing Blood** | 貫流 — see below; it has two of them |
| `2` | **Blood Meteorite** | 血隕 — a mass taken up over the head and thrown down as one piece |
| `3` | **Supernova** | 超新星 — eighteen orbs put out around him and opened at once |
| `4` | **Flowing Red Scale** | 赤鱗 — his own blood pressure raised; everything lands about a third harder while it holds |
| `R` | **Blood Edge** | 血刃 — a blade drawn out and taken across whatever is close |

### Piercing Blood has a tap and a hold

Because in the source it is both: a single shot that goes through what it is
pointed at, and a sustained one he stands and holds on somebody.

**Tap** is the shot. Convergence first — it is pulled in before it is let go —
then one line seventy four metres long and two and a half wide, drawn as a cut
rather than a beam.

**Hold** is the version he takes a stance for. Keep `1` down and the shot
becomes a stream, and the camera goes to **first person over his own two hands
clamped together** on the line — which is the pose the technique is drawn in.
From there:

- The aim turns **slowly**, at about 1.35 radians a second, and no faster no
  matter how hard the mouse is thrown. It is a braced firing position, so it
  cannot be whipped around; getting it onto somebody is the cost of the damage.
- It runs for up to four and a fifth seconds at forty six a second along a
  sixty metre line.
- Anybody the line is **on is held there** and cannot move. They are released
  the moment it comes off them — so it is a pin that has to be maintained, not
  a stun that is applied once.
- His head, neck and collar are hidden while it runs, because the camera is
  inside them.

## Finishers

**Every skill has its own, and the basic punch has none.**

When a *skill* is the thing that would have taken somebody out, it does not
just take them out. It finishes them, in the way that skill finishes people,
and differently from every other skill in the game — thirty four of them, one
per ability per fighter.

Three things a finisher deliberately is not:

* **It is not the punch.** A jab that happens to land last is not a finisher.
  `m1` never triggers one, and it excludes itself for free: a punch runs off
  `attackT` rather than off an action, so there is no skill to attribute it to.
* **It is not a cutscene.** Nobody is taken anywhere, the camera is never taken
  away, the letterbox never comes in and you never stop playing. The longest of
  them is under two and a half seconds; most are around one.
* **It is not Naoya's awakening.** That eleven beat cut is his and it is
  untouched.

| | Gojo | Naoya | Yuji | Hakari | Choso |
| --- | --- | --- | --- | --- | --- |
| `1` | **blown apart** — repulsion has nowhere to put them but outward | **framed** — stopped, and then shattered like the glass | **hit twice** — it folds them, and half a second later the rest of it arrives | **cut in half** — the shutter hits them, turns flat, and goes through | **pierced** — one line, and the jet out of the back of them |
| `2` | **pummelled** — a dozen of them, and then the floor | **cut in two** — one level cut, and he walks on | **black flash** — the frame goes out and comes back as black line work | **riddled** — the other half of the machine, all of it | **under it** — the mass comes down and stays down |
| `3` | **launched** — up, and a very small flash a long way overhead | **put through it** — the kick that ends the conversation | **spun apart** — it takes them up and it takes them apart | **floored** — three of his own, and then the ground | **supernova** — dark and small, and then not |
| `4` | **pressed flat** — four rings, each one lower than the last | — | **driven down** — all of his weight, and a crater | **paid out** — the machine cashes them in | **burst** — the pressure is raised inside them |
| `R` | **erased** — nothing is left standing and nothing falls over | **never saw it** — three places at once | **burned out** — from the inside | **run through** — shoulder first, and out the other side | **opened** — one level draw, and the top of them waits |

Choso's held Piercing Blood has one of its own on top of that: it does not
stop, so neither does the finisher — it **bores through** them and there is
nothing left to fall over.

Gojo awakened gets four more: Lapse: Blue **draws them in** and closes on them,
Reversal: Red **tears them apart**, Unlimited Void **shuts them down** without
touching them at all, and Hollow Purple **halves** them — the top of them goes
with the beam and the legs are left standing in the road until they find out.

Sukuna's four: Dismantle **dismantles**, Cleave **cleaves** on the diagonal,
Fuga **burns them to ash**, and Malevolent Shrine **cuts them to pieces**.

Choso's are all pressure and none of them is a spray. Piercing Blood tapped
**pierces** — one line through, and the picture is the jet out of the far
side; held, it **bores through** them until there is nothing to fall over.
Blood Meteorite puts them **under it** and leaves a crater. Supernova goes
dark and small for a beat before it **bursts**, because that is the only way
an explosion reads. Flowing Red Scale raises the pressure *inside* them, so
nothing hits them and they go anyway. Blood Edge **opens** them on one level
draw, and the top of them stands on it half a second longer than anybody
else's does.

The health lock still holds — the target is pinned at one health for as long as
the finisher runs, so the beat plays out on somebody who is still there and the
kill lands at the end of it — and there is a seven second cooldown, so a
finisher stays something that happens rather than something that always happens.

Over the network it is one small message: everybody plays the same beat on
their copy of whoever it caught, and the person it is happening *to* is handed
a set of blanks instead of the body-breaking kit, because their own body is
taken apart by the hit that arrives at the end rather than by a replay of
somebody else's effect landing on them while they are still alive.

### What is left

Five endings, and which one you get depends on the skill: a **ragdoll**, a
body **cut apart** into the pieces it was cut into, one **cut in two** at the
waist or across the diagonal, one **burned** down to a husk, one **pressed
flat** into the road, and one **erased** — which leaves a mark on the floor
and nothing else.

## Dying

Dying used to burst the body into loose boxes, and then it was a ragdoll:
the hips carry the momentum of whatever killed you, the joints swing on
springs with nothing driving them, and it lands and settles into a heap. That
is still the default, and it is now one of six.

**Cut apart.** A body Dismantle catches falls into the pieces it was cut
into. The separation is real: every mesh in the rig is copied into the piece
it belongs to, each piece starts with the world transform its joint had at
the moment of the cut, and from there they are eleven independent bodies with
their own momentum, their own bounce and their own blood. The cut faces are
real geometry, so a piece looked at from the wrong end is open. They land
where they were thrown and stay there until the respawn.

**Burnt.** A body the Divine Flame catches chars from the inside out over a
second and a half, burns where it is standing, goes down, and stays as a
husk with the scorch mark it left under it.

**Cut in two.** One cut rather than eleven: the top of them leaves and the
bottom is still standing on legs that have not been told yet, for about a
third of a second, before those go too.

**Pressed flat.** Whatever came down on them is still coming down. The body
is compressed into the road over a fifth of a second and stays compressed
into it.

**Erased.** Nothing is left standing and nothing falls over. There is a mark
on the floor where somebody used to be.

## Gojo's awakening

A meter under the ability bar fills while either fighter fights — fastest from hits you
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

## How the cutscenes are animated

Both entrances were written as a pose per beat, and a pose list played
straight is a slideshow: every joint arrives on the same frame, nothing leads,
nothing trails, and the joins between beats are cuts. `anim.js` sits under all
of it:

* **a spring per joint**, stiff at the hips and loose at the hands, so a
  movement travels out through the body and carries across a beat change
  instead of snapping. The extremities are under-damped, so they overshoot
  and settle rather than stopping dead.
* **a breathing layer**, so a held pose is never actually still.
* **a weight helper** — hips over one foot, the free knee bending, the spine
  and head countering — because a figure with its weight on one leg reads as
  standing on something and a figure with its weight nowhere reads as a
  mannequin.
* **smears**: a ghost of the whole body whenever it moves faster than the eye
  follows, scaled by how fast.
* **the camera on its own spring**, with a hand on it and a kick when
  something lands.
* **holds**: two or three frames of nothing at the moment of contact, which is
  where an anime cut spends its weight.

Amplitude matters more than subtlety here. The first version of this layer was
technically correct and completely invisible — springs that settled inside a
frame, a breath of a hundredth of a radian, weight shifts of a sixth of a unit
on a figure five units tall. On an unskinned blocky character none of that can
be seen. Everything is two to three times larger than felt right on paper.

## Naoya's awakening

The same meter, spent differently. `F` starts a **twenty second run**: you
steer it with the mouse and A/D, it leaves fog, mud, rubble and afterimages
behind, and anything it touches is thrown and goes limp. It softens people up
rather than killing them — it always leaves one health — because the run has
to end on somebody still standing.

It ends with a drift, a hand dragged through the floor, and a punch into
whoever was left hanging. That punch opens a cut only the two of them see.

The cut is played on a stage built nine hundred units above the city, so the
arena is never taken apart and every other player carries on watching the pair
of them stand still. It runs through eleven beats:

1. a green room full of branches, the victim held in a frame, and one punch
   taken as slowly as it can be taken
2. the frame goes, the gut folds, three rings leave the belly
3. one second of a still ink panel, cut in with nothing either side
4. a wall of packed earth with colour blooming out of it, faster and faster,
   until it bursts
5. a slab of ground hanging in the air, boot on the belly, the mountain
   coming apart behind
6. off, run, and put them down through the slab — which loses its middle
   plate, so there is a hole and rubble where the strike landed
7. down after them, and the ground goes too
8. they get up into a circle of speed with nobody in it
9. the uppercut, and the frame in the sky
10. twenty four passes and one fist through the middle of it
11. white, and back to the arena

The victim's client plays the same eleven beats from the other end of the
fist, driven by one message; the finisher's damage is applied by the victim at
the end of their own copy, because a hit arriving while a cut is running would
be thrown away.

## The dash

`Q`, and it is built on the one from **The Strongest Battlegrounds** — for
Gojo, Yuji and Hakari. **Naoya keeps his** (two charges, any direction, no
commitment) because that is his whole gimmick and this is not it.

What that game does, and what this now does:

* **The direction comes from what you are holding.** Nothing or `W` is a
  forward dash, `S` is a back dash, `A` or `D` is a side dash.
* **Forward and back share one cooldown; the side dash has its own, much
  shorter one.** That split is the entire design. The forward dash is a
  commitment you spend to close or escape; the side dash is the tool you
  actually fight with, and neither eats the other's cooldown. Four seconds
  against one point seven here, which is that game's five against two brought
  down to the size of this arena.
* **Forward and back cover half as much ground again** — fourteen metres
  against nine and a half, which is its four and a half tiles against three.
* **A side dash gets shorter as your health does.** At full health it is the
  full nine and a half; on your last few points it is about six. You do not
  get to run a fight out on the thing you were winning it with.
* **It is a commitment.** For its quarter of a second you are going where you
  pointed and nowhere else, and it has its own animation — three of them, one
  per direction, rather than a run cycle sliding sideways. Forward is a body
  thrown ahead of its own feet, back is a skid with the weight behind it, and
  a side dash keeps the shoulders pointed where they were looking and takes
  the legs across underneath.
* **It cancels recovery, not startup.** Throw something, and once it is past
  the point where it could still miss you can leave early. Try to cancel the
  first half of a move and it refuses. Domains and awakenings refuse outright.
* **And you can leave a dash into a move**, so a dash that closes the distance
  can be spent the moment it lands you — which is where that game's combos
  come from.

Each of the three does it their own way, which is the last thing that game
does — same system, different animation and different colour coming off it.
Gojo does not run through the space so much as stop being subject to it: a
blue shimmer and the longest invulnerable window. Yuji has no technique, so it
is a man sprinting and the floor finds out — dust off the push, and hairline
cracks where he pushed. Hakari is on a polished floor and stays on it, so his
keeps sliding after the dash itself has finished.

Two implementation notes worth keeping:

**The dash is an `action`.** That is what puts the pose on everybody else's
screen — mp.js already broadcasts the current action every tick and replays it
through `poseAction` — so remote fighters dash properly instead of sliding
along in a run cycle. The direction rides along with it, because otherwise
every remote dash would be posed as a side one.

**`busy` is a `const` arrow in the original and cannot be wrapped**, so being
in a dash blocks casting by definition. Leaving a dash early is done by taking
the action out from under the cast instead: a `keydown` listener in the
capture phase runs before the game's own bubble handler, so by the time that
handler asks whether you are busy, there is nothing left to be busy with.

### The run trail is Naoya's alone

Everybody used to leave afterimages behind them just for walking around, which
made the one fighter whose entire technique is *being faster than you* look
like everyone else. So the trail is now his and nobody else's: `dash.js` holds
`player.ghostAcc` far below its threshold for any character that is not Naoya,
before the original `updatePlayer` gets a chance to top it up. Nothing else
changes — the same accumulator, the same ghosts, just not spent on people who
have not earned them.

## Getting hit

**No techniques while you are being hit.** Every cast is refused for as long
as the flinch or the throw lasts; the punch and the dash stay available, so
there is still a way out.

A hit hard enough to move you — anything over an impulse of seventeen —
throws you rather than making you flinch. The throw is an *action*, not a
reaction, which means the game already does the work: your cast is
interrupted, movement is locked out until you land, and because the current
action is broadcast every tick, every other screen plays the same tumble on
their copy of you. Dummies and remote fighters use a matching pose driven by
the same curve: arched over the impact with the limbs trailing, then a heavy
landing and a scramble back up.

The dash was a single velocity impulse fighting a drag of ten, so it covered
about two metres. Naoya's now drives the velocity for the length of the dash
and covers about twelve, with a short window of invulnerability at the start;
everybody else's was rebuilt again, above.

### The reactions

The game shipped with five flinches — the head snapped back by a jab, doubled
over by a gut punch, clutching a stab, jerked around by a barrage, staggered
onto the heels — and the throw above. They were only ever played on the
dummies and on other people's fighters: **nothing hurting you locally ever
asked your own body to react to it.** It does now, in every mode, off the
same table.

There are eight more, because being cut open is not being punched in the head
and being set on fire is not being punched in the gut:

| | |
| --- | --- |
| `slash` | the body opens along the line of the cut first, and folds around it after |
| `dismantle` | one jerk per cut, each dying inside a tenth of a second, each in its own direction, with less left every time |
| `burn` | arms up over the face, turning away from it, shaking hard enough that nothing stays put |
| `crumple` | the legs simply stop holding them up |
| `whip` | the head goes first and everything else finds out late |
| `spin` | spun off a glancing hit, arms trailing behind the turn |
| `shock` | held, and trembling — a domain, a lock, more coming in than can go out |
| `uplift` | taken off the ground, arched over the fist, everything hanging |

And every reaction in the game, the five originals included, now gets a layer
of **ring-out** over the top: the head carrying past where it was snapped to,
the arms trailing, the knees giving a little and taking the weight back over
the same beat. A flinch that arrives and stops dead reads as one frame of
animation; a flinch that overshoots and settles reads as a body. Bodies also
flash white for two frames when they are hit, cuts bleed along the way the
cut went, and fire hits leave the victim alight.

### The ground

A crack used to be a handful of straight lines fanning out from a point.
Ground does not break like that: it splits along a few main faults, each of
which sheds branches that shed their own, and the surface between them breaks
into plates. So the fracture web is drawn as a branching network at load,
four of them to pick between, and a break puts one down along with a paler
one just off it — the crumbled edge of the split catching the light, which is
what gives it depth — a couple of faults running much further than the web
does, slabs of the surface levered up out of the break and left standing, and
the dust it throws.

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
cast function — and the other clients play the effect at that fighter's feet.
These are visual only and never damage anything, because the hit already
travels as its own message.

For a while those effects were *stand-ins*: a hand-written sketch of each
ability, cheaper and smaller than the thing it stood for. A domain expansion
was a dome for five seconds and then nothing, which meant the biggest move in
the game was the one nobody else could see. So the sketches are gone. Every
module now exposes the routine the caster runs, with the damage taken out of
it, and the room plays **that**:

| Announced | What every other screen builds |
| --- | --- |
| Dismantle | the three real lattices and the grid through the floor, then the unravelling |
| Cleave | the real cut |
| Fuga | the furnace, and a real arrow flying the length of the arena and going off |
| Malevolent Shrine | the whole shrine — it has no barrier, so everybody gets the building, the ribs, the mouths and thirteen seconds of cuts |
| Unlimited Void | the barrier, standing in the street; and if you are inside its forty metres, the void itself |
| Idle Death Gamble | the same: the barrier from outside, the parlour from inside, and the coins either way |

The barrier is `FX.barrier`: a sphere with a latitude and longitude shell over
it, because a transparent sphere with no lines on it reads as a wash of colour
over half the screen rather than as a thing standing in the road.

**Bodies too.** A death that comes apart on one screen and flops on every
other one is two different deaths, so the style travels: `dth` rides along with
the hit that causes it, and the dying client broadcasts a `gore` message that
every other client plays on their copy of that fighter. The finisher and
Naoya's cut are private to the two people in them, so everybody else gets a
column of cursed energy and an aura over the pair of them for as long as it
runs — which is the honest answer to "why are those two standing still".

### Name tags

Everybody's name sits over their head in their fighter's colour, drawn once
into a canvas and carried on the rig, so it follows the body through
everything the body does. It follows a fighter swap onto the new rig, and it
steps out of shot whenever a cutscene owns the frame.

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

**One file** — `jujutsu-multiplayer.html` (1.6 MB). three.js is carried inside
the page and handed to the module loader as a blob URL. Open it from disk or
host it anywhere.

```bash
node tools/build-jujutsu.js
```

**Split** — `jujutsu-parts/`: a 330 kB shell plus three.js and the MQTT client
as separate files, for hosts that cannot serve one big document. The shell
refers to them as `__PART_BASE__?p=N`, so whoever serves it substitutes its own
address. Same Apps Script as the Baldi game, pointed at this folder:

```javascript
const BASE = 'https://raw.githubusercontent.com/wujiahui4-a11y/'
  + 'study-mathenmatics-G3-singapore-secondary/'
  + 'cursor/jujutsu-kaisen-multiplayer-0a77/jujutsu-parts/';

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
| `vfx.js` | the effects kit: impact frames, rings, cuts, lattices, fire, blood, fracture webs, barriers |
| `anim.js` | joint springs, weight, breath, smears, camera and holds |
| `ragdoll.js` | limp bodies, and the heaps they settle into |
| `gore.js` | the other two ways of dying, and the health lock a finisher runs under |
| `combat.js` | the longer dash, the throw, and the eight second fighter swap |
| `dash.js` | Q, rebuilt on The Strongest Battlegrounds — for everybody but Naoya; and the run trail kept to Naoya alone |
| `hits.js` | eight more reactions, the ring-out over all of them, and the player finally playing them |
| `gojo.js` | the awakening meter, Gojo's entrance and his four techniques |
| `naoya.js` | Naoya's run, and the cut it ends in |
| `yuji.js` | Yuji: his rig, his five moves and his transformation |
| `hakari.js` | Hakari: his rig, his four moves and the machine in his domain |
| `choso.js` | Choso: his rig, his five moves and the first-person blood stream |
| `void.js` | Unlimited Void: the hand sign, the barrier and everything inside it |
| `sukuna.js` | Sukuna: the face, the net, the arrow and the shrine |
| `parlor.js` | Hakari's domain: the parlour, the machine and what it pays out |
| `finisher.js` | one short finisher per skill, and the health lock they run under |
| `mp.js` | the online mode, appended inside the game's module |
| `three.module.min.js` | vendored three.js 0.160.0 |
| `mqtt.min.js` | vendored MQTT client |
| `../tools/build-jujutsu.js` | produces both builds |
