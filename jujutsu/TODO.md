# Aoi Todo — Boogie Woogie remake

Select **AOI TODO** in Training or the multiplayer lobby. Both maps support the kit.

The base model follows the supplied reference: tied topknot, diagonal facial scar, navy cropped jacket, purple tank, layered white sash, wide trousers and black slip-on shoes. All solid model surfaces are voxel faces. The awakened model reveals sculpted shoulders, chest and abdominal muscles.

## Controls

- **LMB:** four-hit heavy punch combo.
- **1 — Clap & Collide:** clap into a close-range elbow. Use it airborne for **Heel Drop**.
- **2 — Cursed Stone:** throw a voxel cursed stone. Press **2 again within 3.3 seconds** to swap with it and deliver a blindside kick.
- **3 — Heavy Knuckle:** wind up a heavy punch. Press **3 again 0.24–0.42 seconds after the first press** for **Black Flash**. The HUD highlights this timing window.
- **4 — Brother’s Rhythm:** a hit-confirmed sequence of claps, position changes and heavy strikes.
- **R — False Clap:** counter an incoming attack during the 0.10–0.65-second window; reposition and kick. A missed counter still consumes its cooldown.
- **F or G:** activate **My Best Friend / 120%** at full meter. Damage dealt and received builds the meter. Awakening heals 35 HP and lasts 50 seconds, including its opening animation.
- **B:** block. **Q:** dash. **Space:** jump. Double-tap **W** to sprint.
- **Shift:** toggle Shift lock. While unlocked, the cursor moves freely; hold the right mouse button to orbit the camera.

## Awakened skills

- **1 — Cross Rhythm:** four alternating swap strikes.
- **2 — Sky-Swap Piledriver:** launch the target, follow into the air and slam them down.
- **3 — Black Flash / Overdrive:** a rushing, guard-breaking Black Flash.
- **4 — Brotherhood Finale:** confirm a nearby target to start a cinematic sequence with a voxel companion, camera cuts, synchronized swap attacks and a final Black Flash. Deals 55 damage once and consumes eight additional awakening seconds. A miss uses a short recovery instead of starting a cutscene.

There are four automatic lethal finishers for the base skill slots. This kit has one awakening stage.

## Anime inspiration

The awakening adapts Todo's locket, imagined companionship and the 120% potential motif into an original in-game sequence. The imagined stage is not a Domain Expansion. The official [episode 45 synopsis](https://jujutsukaisen.jp/episodes/45.php) describes Todo's Black Flash and the three fighters reaching 120%. [ABEMA's episode coverage](https://times.abema.tv/articles/-/10106990?page=1) describes the opened locket and Todo imagining Takada fighting beside him.

The voxel portraits, models, keyframes, camera choreography, ribbon effects and synthesized audio are authored for this game. No anime footage or soundtrack is bundled with the remake.

## Files and validation

- `todo-voxel.js`: articulated model and hinged locket.
- `todo-vfx.js`: tapered energy ribbons, clap rings, cursed stone and synthesized impacts.
- `todo.js`: moves, meter, cooldowns, holds, finishers and networking.
- `todo-poses.js`: deterministic joint keyframes and hand-contact IK.
- `todo-cinematic.js`: awakening and ultimate presentation; loaded after multiplayer for camera priority.
- `finisher.js` and `mp.js`: finisher registry and multiplayer transport integration.

Build using `node tools/build-jujutsu.js`. This regenerates the standalone game and both split entry pages under `jujutsu-parts/`.

Run `node tools/test-todo.cjs` with Playwright available (`PLAYWRIGHT_MODULE` may point at its installed module). Tests cover voxel geometry, every base and awakened skill, variants, counter timing, guard, invulnerability, cooldowns, lethal finishers, camera restoration, two-client damage and holds, spectator cameras, hold expiry, JJS rooftops and wall obstruction, and both game entry pages. `TODO_ARTIFACT_DIR` selects the screenshot and report directory.
