# JJS map import

JJS comes from the user's `Jujutsu Shenanigans.rbxl` place and the accompanying
Roblox Studio `jjsmap.obj` / `jjsmap.mtl` export. No buildings were reconstructed
from screenshots. One Roblox stud is one game unit; the only coordinate change
is subtracting `(0, 20.309, 0)` so the street is near the game's zero-height plane.

The snapshot contains 15,499 parts. The 2,000 `Map.Data` debris-pool objects at
Y = 10,000,000 are preserved in the snapshot and excluded from the arena.
The remaining 13,499 parts retain every original CFrame, size, color and
collision flag. The OBJ supplies 171,667 triangles, including the original
9,999-triangle Reimu mesh. Its 310 texture-file references are deduplicated by
content into 100 embedded PNGs, with no resizing or image recompression.

`source.json.gz` contains the readable Studio properties, decals, surface GUI
layout, lighting and nine spawns. `visual.json.gz` contains the actual OBJ
vertices, normals, UVs, colors, indices and texture bytes. The importer batches
compatible materials into 90 draw groups. Roblox's plastic surface atlas is
clamped vertically so smooth walls do not acquire repeated studs.

Choose **JJS** under **TRAINING MAP** on the title screen, or in the online
room creator's map selector. The `?map=jjs` URL parameter also selects it.
The room creator's selection propagates to guests. Floor support, ceilings,
oriented walls, fast movement, camera obstruction and respawns support rooftops
and the underground levels. Switching back to the baseplate disposes map GPU
resources and restores its lighting and floor.

This imports the static map into this game's renderer and combat system.
Roblox scripts, live leaderboards, video/audio streams, destruction scripts
and interactive shop behavior are not executed. Surface GUI text/layout is
retained, but Roblox-specific fonts and image thumbnails not included in the
OBJ export are not identical. Rendering uses Three.js lighting, so matching
geometry and textures does not imply pixel-identical Roblox shading.

To refresh the visual export, keep the OBJ, MTL and PNG files together:

```sh
node tools/import-jjs-obj.cjs path/to/jjsmap.obj
node tools/build-jjs-data.cjs
node tools/build-jujutsu.js
```

To replace the property snapshot, supply its exported JSON as the argument to
`tools/build-jjs-data.cjs`. Both compressed source files are checked in, so a
normal build needs no Roblox login or external asset server.

`tools/test-jjs.cjs` checks every part's transform, dimensions and color against
the Studio snapshot, the original custom mesh and textures, all nine spawns,
rooftop/underground landing, movement, wall ray tests, fall recovery, map
synchronization, cleanup and the actual split build. It uses Playwright and
installed Chrome, with the same `PLAYWRIGHT_MODULE` override as the Hanami suite.
