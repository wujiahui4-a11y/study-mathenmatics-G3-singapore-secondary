# Shared combat

The browser game now uses a shared M1, guard and directional dash system across
all 14 fighters. Naoya uses the new M1 and guard, with his existing two-charge
dash implementation, movement curve, recharge, invulnerability and effects.

## Controls

- **Left mouse:** a four-hit combo. Hold to continue, or click for individual
  swings. Hits have startup, an active hitbox and recovery.
- **Space during the combo:** the fourth hit becomes an uppercut. Start hit four
  while airborne for a downslam. Downslam breaks frontal guard.
- **B:** hold frontal guard. Release B to lower it. Guard slows movement and
  prevents jumping, attacking and dashing. Rear attacks bypass it.
- **Q / W + Q:** forward dash ending in a strike. Its cooldown is 4.5 seconds.
- **A/D + Q:** side dash. **S + Q:** back dash. These share a separate two-second
  cooldown. Side and back dashes do not deal damage.
- **Naoya Q:** his original two-charge directional dash.

Shift lock and free cursor controls continue to work. Airborne side Q near a
wall retains the existing parkour wall kick. Skill and awakening bindings remain
on each fighter's move bar. Mahito's arm modes affect his M1, club swings break
guard on hits three and four, and B + a click still withdraws one reserve.

## Behavior and animation

The combo resets after 1.2 seconds without another swing. An active swing can
hit each target once, checks forward reach and height, and cannot hit through
JJS walls. Default M1 damage is 3; Naoya retains 2, and Mahito's blade/club modes
use 2/4. The fourth hit adds knockdown and a 1.5-second M1 cooldown. Missing that
hit leaves a longer recovery. Side/back and forward dash cooldowns are independent.

New poses animate the voxel rigs through anticipation, extension and recovery:
alternating punches, a hook, a finishing cross, uppercut, double-fist downslam,
frontal guard recoil, directional dash lean and skid, and a three-stage knockdown
and stand-up. Character profiles vary stance, twist, timing and weapon swing.
Contact effects keep the glowing hit ring without the removed blue spokes.

Dash paths sweep the existing world collision. Knockdowns use the actual floor
and ceiling, including elevated platforms and destructible surfaces. Fourth-hit
impact calls the existing destruction system. Taking damage interrupts an M1 or
dash and prevents new actions during hitstun. Core hits cannot hit someone already
knocked down; recovery grants a short protection window.

## Connected Studio reference

Read from the user's connected Studio on September 7, 2026, in Edit mode:

- `ServerScriptService.Services.Moveset.Gojo.GojoService` and
  `Itadori.ItadoriService`: four-hit chain, hit-marker damage, uppercut/downslam,
  combo reset, fourth-hit recovery, knockdown, and forward chase strike.
- `ServerScriptService.Services.Combat.BlockService`: hold/release blocking and
  action restrictions. The character service checks the frontal hemisphere and
  allows downslam through block.
- `ServerScriptService.Services.Combat.HitboxService`: oriented overlap and
  per-target hit deduplication.
- `StarterPlayer.StarterPlayerScripts.Controllers.Character.MovementController`:
  short side/back dashes, their shared cooldown, and blocking movement limits.
- `StarterPlayer.StarterPlayerScripts.Controllers.Character.ToolController`:
  held-M1 repetition and fourth-hit jump variants.

The server MovementService's dash handler was empty. The implementation uses the
working character/client behavior as reference, with distances, launch velocity
and poses adapted to this game's voxel rigs and physics. No Studio scripts or
Roblox animation assets were changed or imported.

## Integration and verification

`battleground-combat.js` loads after the character, multiplayer, destruction and
movement modules. `base.html` provides early input and movement hooks. `mp.js`
shares combo beat, dash direction, variant and knockdown stage, plus guarded-hit
metadata with a per-swing ID. The victim's client resolves its guard, health and
knockdown, and ignores duplicate core-hit messages. This retains the game's
existing peer relay architecture; it is not a server-authoritative combat backend.

Build with `node tools/build-jujutsu.js`. With Playwright and Chrome available, run
`node tools/test-core-combat.cjs`. `PLAYWRIGHT_MODULE` can point to an installed
Playwright package. The suite covers the complete roster, startup and repeated
hit protection, actual held inputs, variants, guard angles, interrupted attacks,
dash cooldowns, owner/spectator packet handling, walls, ceilings and platforms.

`tools/fixtures/naoya-dash.json` records the pre-remake behavior from commit
`2611bbfb37e6f242b769f92675ef70f2bd03534c`: six directions, trajectory samples,
charges, recharge and invincibility, plus immediate double-Q. The combat suite
compares every value. The original `combat.js`, `dash.js` and `naoya.js` remain
unchanged.

Related regression suites: `test-mahito.cjs`, `test-todo.cjs`,
`test-movement.cjs`, `test-destruction.cjs`, `test-shift-lock.cjs`,
`test-jjs.cjs`, `test-potato.cjs` and `test-studio-ui.cjs`.
