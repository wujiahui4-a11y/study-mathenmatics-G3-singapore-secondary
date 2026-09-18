# Potato Mode (Fast Mode)

Enable **Settings → Performance → Potato Mode (Fast Mode)** on smaller devices.
The choice is saved in this browser and is independent of the multiplayer host.

The old implementation reduced visible geometry but rebuilt the entire nearby
window synchronously whenever the player crossed a cell. It also kept full
render resolution, dynamic shadows and expensive normal/specular materials.
Those costs could still cause lag even though distant buildings were hidden.

The new implementation:

- Keeps at most 25 nearby 48-stud cells, extending 120 studs from the center
  of the player's current cell. Fog runs from 45 to 90 studs.
- Reuses the 20 overlapping cells on a one-cell horizontal/vertical move.
  Only the five incoming cells are built; outgoing GPU geometry is disposed.
- Builds cells nearest first over multiple frames, targeting 3 ms of CPU
  streaming work per render. This is a cooperative budget, not a guaranteed
  maximum frame time; individual buffer uploads and browser work can exceed it.
- Uses a triangle catalog generated on the build machine, so enabling Potato
  does not scan the whole map to create an index on the device.
- Caps pixel ratio at 0.75, disables all dynamic shadows, and uses diffuse
  Lambert scenery materials without normal/specular maps. Saved Potato mode
  also disables WebGL antialiasing at startup. Changing antialiasing requires
  a reload; resolution and shadows change immediately.
- Defers exported texture image decoding until a nearby diffuse material needs
  it. Evicted material/texture GPU resources are released when no resident
  cell uses them. CPU image/map data remains available for full-mode return.

Collision, floor queries, and multiplayer destruction still use the complete
source map. A damaged part invalidates only intersecting cells; far-away damage
appears correctly when visited. Teleports cancel obsolete work. Map changes and
mode changes release both completed cells and partly built jobs.

This is local scenery streaming, not network streaming of separate map files.
The compressed map payload and CPU collision/visual data still load initially.
AI, combat effects, browser/device limitations, and network latency can still
cause lag. Lower graphics costs do not guarantee a particular FPS.

## Build and validation

Run `node tools/build-jjs-data.cjs` after changing the map export or cell catalog,
then `node tools/build-jujutsu.js` to regenerate the single-file and split builds.

`node tools/test-potato-streaming.cjs` checks the real exported geometry and live
destruction using Three.js with a CPU renderer spy. It covers nearby bounds,
incremental work, cell reuse, teleports, texture deferral, wall damage/restoration,
full-mode return and cleanup. It does not measure GPU performance.

`node tools/test-potato.cjs` is the browser/GPU integration suite; it requires
Playwright and Chrome. The browser suite now waits for incremental cells to
finish and checks reuse instead of requiring whole-window rebuilds.

See `apps-script/README.md` for the replacement web-app loader.
