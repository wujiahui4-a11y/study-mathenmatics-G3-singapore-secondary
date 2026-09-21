# Gojo–Sukuna domain clash

In a multiplayer room, activate Gojo's Unlimited Void and Sukuna's Malevolent
Shrine within 1.5 seconds of each other, close enough that their domain radii
overlap (102 world units). Both activations pause before creating a domain.
An uncontested activation resumes automatically after that short window;
offline casts keep their original timing.

The clash shows two opposing barriers, a shared score bar and a countdown.
After “GET READY”, release and repeatedly press **Space** for six seconds.
Holding Space or its automatic key repeat does not score. The higher score wins;
only that player's original domain animation and effects continue. Both casts
spend their usual cooldown. A tie adds three seconds of overtime; a second tie
cancels both domains. Spectators see the scores and keep their controls.

Pausing, switching character or being defeated forfeits a participant's clash.
Room changes and disconnects clean up local input locks and barrier geometry.
Connection timeouts prevent an unfinished handshake from leaving a caster stuck.

`domain-clash.js` loads last and follows the existing action/update/camera hooks.
`base.html` routes clash keys before combat controls; `mp.js` routes the `dc-*`
messages through the existing relay. The lower participant ID coordinates one
result, with room/map scoping, participant and token checks, cumulative tap
counts, bounded scoring, ordered snapshots, handshake retries and replay guards.
This uses the game's peer trust model; it is not an authoritative game server.
An already active domain is not interrupted by a later activation.

Build: `node tools/build-jujutsu.js`.
Regression check: `node tools/test-domain-clash.cjs`.
The test runs independent VM clients with real Three.js geometry and queued
transport. It checks either winner, spectator input, repeat rejection, stale
messages, scoring limits, overtime, uncontested/offline casts, forfeit/connection
cleanup, packet recovery, and inclusion in both generated builds.

A live two-browser visual/audio playtest remains necessary; the automated checks
exercise gameplay and protocol behavior without rendering a browser scene.
