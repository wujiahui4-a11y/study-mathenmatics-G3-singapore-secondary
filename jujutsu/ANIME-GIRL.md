# Stupid Anime Girl — secret white-wind fighter

Visit the **JJS** map and find **东方project博丽灵梦 / Reimu**. Stand on the
street in front of the model, face her, and type **baka**. You can also press
**Enter** (or tap the nearby prompt), type the word, and choose **Say**.
The character then appears in both Characters lists. The unlock is saved in
this browser; if browser storage is unavailable, it lasts for the current session.

The original character art is a monochrome voxel fighter with twin tails,
a white jacket and scarf, a pleated charcoal skirt with white trim, opaque tights,
and white sneakers. Layered silver irises, pupils, lashes and white highlights
give the eyes more definition. Wind VFX are white.
All moves have startup, contact, follow-through and recovery poses. Shared M1,
guard, movement and dash animations continue to work.

| Key | Move | Behavior | Base cooldown | Stamina |
| --- | --- | --- | --- | --- |
| 1 | Slap | Close-range, guard-breaking knockout with a very strong launch. | 18 s | 30 |
| 2 | Baka | Shout and expanding white wind wave; launches each target once. With destruction on, five travelling impacts carve a broad swath of eligible map geometry. | 16 s | 35 |
| 3 | Continuous Punch | Ten alternating punches and a launching final punch. Frontal guard blocks it. | 10 s | 25 |
| 4 | Tsundere Kick | Rising upperkick with a vertical wind trail and upward launch. | 11 s | 25 |
| R | Tsundere | Completes a charge pose, adds 25 Tsundere and restores 35 stamina. | 2.5 s | 0 |

Tsundere caps at 100. At full charge, stamina capacity rises from 100 to 150,
skill damage/launch strength rises to 1.75×, stamina regeneration rises from
10 to 22 per second, and skill cooldowns are divided by 1.3. Slap remains a
knockout at every charge level. Tsundere drains by 1.5 per idle second and resets
on death or character switch. Charge rewards occur at the animation's contact
beat, so interruption prevents the reward. Skills cannot start while guarding,
stunned, paused, or on cooldown, and targets behind walls remain protected.

The unlock uses the imported Reimu model's CFrame and bounds, including its
original scale and the map origin offset. It requires the front region, nearby
street height, and facing toward the model. It works independently of Potato
Mode's visual streaming. Random bot selection uses the public roster so it does
not reveal the secret before discovery.

`anime-girl.js` follows the other character modules: `CHARS`, wrapped
`makeAnimeRig`, `stepAction`, `poseAction`, locomotion, HUD, cooldowns and cleanup.
`mp.js` announces its cast IDs, shares Tsundere, and replays visuals without
applying extra damage. Hits use the existing victim-owned multiplayer health,
guard, knockdown and duplicate-hit protection. Destruction uses the existing
host-owned bounded impacts; protected map Core geometry is retained. Browser
speech synthesis voices “Baka!” when available; text and wind audio remain when
that browser feature is absent. The shout uses a higher voice pitch and two short,
quiet rising tones for a sharper sound, without increasing voice volume.
No external animation or audio assets are needed.

Slap explicitly selects an intact ragdoll. The shared death-style dispatcher
bypasses special effects for that tag, preserving the full launch velocity and
attached rig through the existing ragdoll simulation.

Build: `node tools/build-jujutsu.js`.

Regression check: `node --experimental-vm-modules tools/test-anime-girl.cjs`.
This runs real Three.js geometry, base rig, cast timelines, shared damage wrapper,
JJS collision at the unlock location, multiplayer cast dispatch and hit decoder.
It covers locked selection, unlock constraints, word input, storage, stamina,
damage, launch vectors, cooldowns, guard, interruption, white-only custom VFX,
cleanup, skirt/eye geometry, bounded shout layers, the actual damage/death/ragdoll
chain (including over 60 units of intact flight), and both generated builds.
Existing public-roster tests exclude secret
entries; the new suite exercises this secret separately.

A visual/audio browser playtest is still needed: this environment could not
reach the local game from its browser or download a local Chromium runtime.
