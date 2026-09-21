# Ryu: Output and Dessert

Every successful skill activation adds **20 output**, up to 100. A vertical
white meter follows Ryu beside his body, including remote players. At maximum
output the pompadour opens into loose hair and emits white steam. **R: Tidy
Hair** equips a visible brush, plays several strokes, and clears output at the
last stroke. Interrupted brushing does not clear the meter. R has a 4s cooldown.

**G: Granite Blast** uses the existing full awakening meter. Ryu extends a
modeled index finger and thumb, charges for 2.8s, then fires a 180-unit beam.
Targets inside the beam are reduced to at most **50 HP**, never healed. Contact
uses a non-graphic white energy coating. The owning client confirms Yuta contact;
after the beam fades, confirmed contact opens **Dessert**, a 60-second second
awakening with loose hair, steam, and a new moves bar. Without Yuta contact, Ryu
returns to his normal kit after the beam. Death, a character swap, or a room
change clears the state.

| Key | Dessert skill | Behavior |
| --- | --- | --- |
| 1 | Larp Me | Front kick, turn, rear punch; confirmed hits launch with a white trail. 9s cooldown. |
| 2 | Hate Me | Ground strike with an 18-unit area and knock-up. JJS destruction lifts actual removed chunks, including large slabs, about 2.2 units; they hover and then drop. 15s cooldown. |
| 3 | Dessert Exchange | Forward dash into a guardable hit. Two cupcakes cross over black, then both fighters exchange a held punch pose amid debris. Caster loses 10% maximum HP; target loses 40%. 18s cooldown. |
| 4 | Best Dessert | A steerable dash eases from fast to slow and can grab online players. A confirmed hit begins the full paired sequence. Caster loses 10% maximum HP; target loses 80%. Both fall into ragdoll recovery. 32s cooldown. |

Skill 4's clock starts when the grab is confirmed:

| Time | Shot |
| --- | --- |
| 0–2s | Both fighters exchange animated strikes. |
| 2–2.65s | Held close-up of the caster's face. |
| 2.65–5.65s | Three more seconds of strikes. |
| 5.65–6.3s | Held close-up of the opponent's face. |
| 6.3–8.3s | Twelve generated Black Flash frames, played at 6 fps. |
| 8.3–9.2s | Smooth white transition. |
| 9.2–10.1s | Both fighters hold the final pose against the generated energy background. |
| 10.1–11.5s | Caster drifts left and opponent drifts right. |
| 11.5–12.3s | Both fall; the owning clients apply the final damage once. |

The poses, timing, and framing follow the supplied references. Artwork and sound
are original. Ryu's effects use intact ragdolls, with no blood or wound imagery.
Reduced motion holds one impact frame rather than cycling the full sequence.
Generated art and complete prompts are in `ryu-art/`; the built-in image tool
was used. Both WebP assets are embedded in both builds, so no extra image host
or runtime download is required.

## Multiplayer and guard

The victim validates distance, direction, line of sight, phase, guard, and
availability before acknowledging a grab. Room, map, event, caster, and victim
identities scope each sequence. Repeated timeline packets repair dropped starts;
victim acknowledgements detect a lost connection in both directions. Old or
duplicate events cannot reapply damage. Participants get the camera; other
players see world choreography without losing control. Holds release on timeout,
death, switch, pause, blur, or departure. Completed damage also updates normal
multiplayer kill/death accounting. This continues to use the game's existing
peer relay and owning-client health model.

Older skills now include guard metadata and source position in normal hit
packets. The receiving client resolves frontal guard; rear attacks and explicit
guard breaks still work. Known positions provide compatibility with old packets
that omitted guard metadata. Blocked prediction no longer lowers a proxy's HP.

## Build and checks

Run `node tools/build-jujutsu.js`. The existing gzip map payload is encoded as
Base85 in generated builds to reduce text overhead without changing map bytes.
This preserves local-file/Apps Script loading and leaves room for the new art.
Tests check the complete GitHub request size, with a 32 KiB allowance below the
16 MiB connector limit.

- `node tools/test-ryu.cjs`: real Three rigs, a simulated three-client relay,
  skills, damage, guard rejection, timeouts, retries, state reset, frame sampling,
  map-byte equivalence, and generated builds.
- `node tools/test-network-guard.cjs`: actual multiplayer sender/receiver guard
  logic and actual destruction debris integration.
- `node --experimental-vm-modules tools/test-opening.cjs`: complete module syntax
  and opening lifecycle regression.
- `node tools/test-opening-film.cjs`: opening artwork and playback regression.

`test-ryu.cjs --render` uses `skia-canvas` (or `OPENING_CANVAS_MODULE`) for
software previews from the real rig transforms and game cameras. These previews
are checked locally; they do not replace a live WebGL/browser/broker playtest.
