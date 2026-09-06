# Mahito / Perfection

The moveset follows the [Perfection reference](https://jujutsu-shenanigans.fandom.com/wiki/Perfection).
This build includes the base kit and **Essence of the Soul only**. Second awakening is disabled.
The voxel sculpture, animation keyframes and effects are original Three.js assets.

- **1–4:** Stockpile, Soul Fire, Focus Strike, Body Repel.
- **R:** cycle normal, blade and club arms. This changes M1, forward dash, slot 3 and awakened slot 2.
- **Jump + 1:** Aerial Stockpile. Press **3 again during its windup cue** for Black Flash. Press **4 then 3** for the riding variant.
- **F/G:** awaken when the meter fills; use it again for Awakening Black Flash. **X** switches between base and awakened slots.
- Awakened **1–4:** Idle Transfiguration; Body Disfigure (Drill Splitter, Heart Piercer or Force Grab); Spike Wrath; Embodiment of Self Perfection.
- During Force Grab, **2** slams and **R** throws. The victim presses **Space** repeatedly to escape.
- **E:** pick up/throw a soul item. **R** stores it. **B + LMB** retrieves one. Hold **2** to spend reserves on extra shots. **B** blocks.

Five automatic lethal-hit finishers cover Aerial Stockpile, Focus Strike, its Black Flash variant, Homerun and Blade Dash.

`mahito-voxel.js` builds the articulated model; `mahito-poses.js` supplies shared local/remote poses; `mahito.js` owns combat, effects and meters. Body Repel breaks movable arena crates; imported JJS architecture remains static.

Build with `node tools/build-jujutsu.js`. Run `node tools/test-mahito.cjs` with Playwright installed (or set `PLAYWRIGHT_MODULE` to its installed path).
