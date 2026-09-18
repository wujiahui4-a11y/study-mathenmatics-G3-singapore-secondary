# Nanami — Ratio Draw

Nanami carries his wrapped blade at rest and uses it for every M1. The model has
a beveled metal blade, patterned cloth, wrapped grip, circular tinted glasses,
and an open cream jacket. Slash effects are continuous ribbons and circular
streaks, not duplicate character models. All new finishers use intact ragdolls
and cursed-energy shards, without graphic injury effects.

| Input | Move | Behavior |
| --- | --- | --- |
| M1 | Blade Slash | Four blade swings; ordinary hits deal 3 damage. The fourth keeps the shared recovery cooldown and knockdown. |
| 1 | Turning Cut | Nanami advances while rotating his body and spinning the blade. One 18-damage hit per target; a horizontal white ten-division diagram appears at the waist. It does not activate 7:3. |
| Hold/release 2 | Ratio Draw | Blue aura and the raised-blade pose while charging. Reaches 7:3 after **0.65s**, then stays locked until release. Automatically releases at 3s. |
| 2, early release | Normal Draw | Sudden forward displacement in a held pose, with swept collision checks. 16 damage and a neutral diagram. |
| 2, 7:3 | Ratio Break | Confirmed hit: black background, rotating diagram, red seventh mark, energy fracture, white transition and camera impulse. 28 damage and ragdoll recovery. |
| 3 | Threefold | Punch, kick, kick for 5/5/7 damage. Each hit stuns; no added knockback or knockdown. A lethal last hit confirms the ground finisher, blue hand energy and 咒力 title. |
| 4 | Blind Spot | Counter window from 0.1–1.3s. Evades a confirmed attack, disappears, returns upside down behind the attacker, then lands the blade. White head-height diagram, 24 damage; no 7:3. |
| R | Overtime | Ignites the blade with blue cursed energy for 16s. Every M1 becomes a 6-damage 7:3 hit with Black Flash energy. 24s cooldown. |

All ordinary attacks remain guardable. Normal diagrams never turn the seventh
mark red. Lethal spinning cuts, draws, counters, and empowered M1s receive energy
finish effects; the fighter stays intact. Reduced motion suppresses camera
impulses and diagram rotation.

## Multiplayer

Normal hits use the shared victim-owned guard and health path, including Nanami
effect metadata. Confirmed ratio, counter, and combo-finisher sequences use a
reservation and acknowledgment before either character is held. Counter
requests must match a recent outgoing attack recorded by the attacker. Repeated
timelines repair dropped starts; victim acknowledgments detect lost connections.
Events are scoped by room and map, and duplicates cannot reapply damage.

Participants see the authored camera. Spectators keep their camera and see the
world choreography and confirmed effects. Holds release on departure, map or
character change, death, pause, blur, or communication timeout. Bot casts remain
registered with the existing AI adapter; their paired strikes use the adapter's
direct-damage path instead of taking over the human camera.

## Verification

- `node tools/test-nanami.cjs` uses actual Three rigs, the shared M1 dispatch,
  multiplayer hit sender/receiver, and three simulated clients. It covers charge
  timing, damage, guard, counter proof, finishers, spectator behavior, packet loss,
  duplicate rejection, cleanup, and finite animation transforms.
- `node tools/test-network-guard.cjs` checks guard and destruction regressions.
- `node tools/test-ryu.cjs` checks the existing Ryu kit and upload size budget.
- `node --experimental-vm-modules tools/test-opening.cjs` checks full module syntax
  and the opening lifecycle; `node tools/test-opening-film.cjs` checks its art.

`test-nanami.cjs --render` can produce software previews from the actual rigs and
cameras using `skia-canvas` or `OPENING_CANVAS_MODULE`. These are not a live WebGL
or public multiplayer-broker playtest. Build with `node tools/build-jujutsu.js`.
