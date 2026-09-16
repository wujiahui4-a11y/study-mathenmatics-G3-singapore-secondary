# Opening: Signal / City / Sorcerers

A 64-second original opening plays when the game finishes loading. Press **G**
at any point, or click/tap **SKIP OPENING · G**, to return immediately to the
menu. **WATCH OPENING** replays it before entering the arena. It is unavailable
during a match. Skipping does not start a match or trigger awakening.

Use **SOUND: OFF** to enable the original synthesized instrumental score.
Playback begins silently to work with browser autoplay restrictions. No video,
recording, lyrics, external images, or additional asset requests are included.
The supplied reference informed broad graphic direction; the artwork,
choreography, scene sequence, typography and music were created for this game.

| Time | Scene | Animation |
| --- | --- | --- |
| 0–7 s | Signal | City layers, signal trace, moon reveal and walking figure |
| 7–15 s | City in Motion | Perspective street, parallax towers and sprint |
| 15–23 s | Limitless | Gojo portrait, orbiting rings and casting pose |
| 23–31 s | Break the Line | Yuji sprint, rising kick and drifting graphic fragments |
| 31–39 s | Frame by Frame | Naoya sprint with offset silhouettes and frame counter |
| 39–47 s | Domain Collision | Gojo and Sukuna casting across opposing barriers |
| 47–56 s | White Wind | White arcs, scarf, skirt, casting and upperkick |
| 56–64 s | Jujutsu Battleground | Animated title, fighter lineup and fade to menu |

The white-wind character is an anonymous teaser until her existing unlock is
complete. The opening does not change unlock storage or roster availability.

`opening.js` loads last. `base.html` routes its keyboard gate before combat,
and pauses the main simulation/render loop while the opening is visible.
The separate Canvas 2D timeline is capped at 30 fps and 1280×720, fits any
viewport with letterboxing, and pauses when the tab is hidden. Reduced-motion
preferences slow scene movement and remove wipes. Canvas failure leaves the
menu available. Skip and natural completion cancel the animation callback,
stop/disconnect audio, restore menu focus and clear held movement input.

Build: `node tools/build-jujutsu.js`.
Tests: `node --experimental-vm-modules tools/test-opening.cjs`.
The tests cover the full drawing timeline, every chapter's skip, input and
focus restoration, no G awakening leak, hidden tabs, reduced motion, unavailable
canvas/audio, audio-resume races and both generated builds. Existing browser
fixtures explicitly dismiss the opening before their gameplay checks.

For PNG inspection, install `skia-canvas` or point `OPENING_CANVAS_MODULE` at
its module, then run the test with `--render`. Images go to ignored
`work/opening/`. Canvas frames were rendered and inspected locally; a live
browser audio/input playtest remains outstanding in this environment.
