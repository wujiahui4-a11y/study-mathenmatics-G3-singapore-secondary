# AI Server

Open **AI SERVER** on the title screen, or **Servers** in the top bar. Choose
the Baseplate or JJS, choose **8, 12, or 16** AI players, and press
**JOIN AI SERVER**. The default is 12. **END AI SESSION** restores training mode.

An offline AI session starts immediately. In an existing multiplayer room, the
room creator can add the same bots for everyone. The creator's browser runs
their decisions and sends snapshots to the other players. Keep that browser
open. This feature does not provision a dedicated cloud server, and joining
friends still requires the game's existing relay connection.

## Fighting

- Random voxel fighters drawn from all 14 characters. The first 14 assignments
  do not repeat; a 16-player session can contain two repeats.
- Four-hit M1 chains, uppercuts, airborne downslams, directional guard, forward
  dash strikes, back dashes, and side dashes that curve around an opponent while
  turning to face them. After flanking a guard, bots follow with M1.
- Bots react to visible attacks after a short delay, remember frequent blocking,
  lead moving opponents, and can cancel a confirmed second punch into a technique.
- Each fighter uses their actual four normal skills and R, with the existing
  damage, animation and world effects. Cooldowns, summons and stance state are
  independent for each bot. Awakening selection is not automated.
- Bots choose moves by range and cooldown, chain confirmed M1s into skills,
  approach with forward dash → M1 → skill, and back dash to create space for
  long lunges. Todo uses stone swaps and timed Black Flash; Mahito changes arm
  stance and uses Focus Strike's Black Flash and Body Repel's ride follow-up.
  Hakari's Door Guard and Todo's False Clap respond to incoming attacks.
- Different aggression, reaction, sociability and grudge traits. Bots fight one
  another, can target humans, and spread their attention across opponents.
- 100 HP, damage windows, cooldowns, line-of-sight checks and knockdown recovery.
  Difficulty comes from decisions and combos, not extra health. Naoya's player
  dash remains unchanged; Naoya bots also retain a straight, two-charge dash.

Player controls are unchanged: **WASD** move, **Space** jump, **left mouse** M1,
**B** block, **Q** dash, **A/D + Q** side dash, **S + Q** back dash. See
[the combat guide](COMBAT.md) for the full shared combat controls.

## Movement and signals

Bots use the map's collision geometry to navigate around obstacles and separate
from nearby fighters. They vault low barriers, climb reachable ledges roughly
3.6–7.6 units above their feet, and step off safe drops. They cannot scale an
arbitrarily tall building. Paths update after destruction or map changes;
blocked routes cause replanning or a different destination.

Tap **B twice within 1.2 seconds**, or walk while rotating through most of a
circle. Nearby, available bots may double-block back, walk backward and jump,
or ignore the signal. A friendly response temporarily discourages attacking
that player. Hitting a bot ends its friendly response.

After dying, a bot has a personality-dependent chance to remember its killer
for revenge after respawning. If it kills that target, it briefly alternates
block and forward/back movement near the body, then walks away. Responses and
revenge are probabilistic, not guaranteed. Signals have a cooldown and busy
fighters may continue their current fight.

The AI HUD lists the population and the five leading bots' kills/deaths. It
collapses on narrow screens. Local sessions pause with the menu; shared rooms
continue running. Existing Potato Mode remains available for map rendering.

## Implementation and validation

`ai-navigation.js` separates incremental A* route planning from local steering.
The implementation follows the search concepts explained by
[Red Blob Games](https://www.redblobgames.com/pathfinding/a-star/implementation.html)
and the separation of steering from path planning described by
[Craig Reynolds](https://www.red3d.com/cwr/steer/). Searches share a per-frame
time/node budget and invalidate their cache when live collision changes.

`ai-combat.js` owns independent action state for each bot and shares the existing
guard angles, combat poses and world sweeps. `ai-character-kits.js` invokes the
original casts registered by each character module and the existing action/pose
dispatchers. Scoped bindings and delayed callbacks retain the casting actor;
the human player's state and camera are restored before returning. Actor
movement uses the shared collision sweeps. `ai-server.js` owns decisions,
memory, respawns, lobby controls and room synchronization. Remote players own
their damage/blocking decisions and acknowledge bot hits to the host. Snapshot
sequence numbers, per-swing duplicate checks and session epochs prevent stale
or duplicate updates from replaying attacks or duplicating the population.

Build with `node tools/build-jujutsu.js`. Browser tests require Playwright and
Chrome; set `PLAYWRIGHT_MODULE` if Playwright is installed outside the project.

- `node tools/test-ai-server.cjs`: live free-for-all kills and advanced combo
  choices, damage/blocking, signals, revenge and walk-away, wall detours, ledge
  climbing, vaulting, forward dash/skill combos, 16 bots in the real JJS
  map, pause behavior, mobile layout and repeated start/stop cleanup.
- `node tools/test-ai-network.cjs`: separate browser clients, guest attacks,
  guard decisions, duplicate swings, revenge kill acknowledgement, death and
  knockdown poses, ordered snapshots, late joining, host loss, new sessions
  and joining a different host. These tests use captured relay packets between
  browsers; they do not depend on an external relay being reachable. They also
  check real character skill poses, stance synchronization and multiple hits
  from a skill against the owning player's damage/deduplication logic.
- `node tools/test-ai-character-kits.cjs`: all 70 normal/R entries, every
  damaging move at its useful range, real timed variants and counters, separate
  cooldowns for matching characters, local-player isolation and summon cleanup.
- Existing shared combat tests include the saved Naoya dash trajectory and
  two-charge/recharge baseline.

Playable files: `jujutsu-multiplayer.html` (standalone),
`jujutsu-parts/index.local.html` (local server), and `jujutsu-parts/index.html`
(existing Apps Script host). Regenerate all three after editing source modules.
