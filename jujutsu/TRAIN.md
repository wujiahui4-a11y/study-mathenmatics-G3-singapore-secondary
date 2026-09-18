# Station express

At the green station control button, click/tap the button, press **E**, or use
the nearby **Call train** screen button. A five-second warning starts before
the express crosses the existing rails. Players and enemies in its path receive
a non-graphic **Crash** knockout with ragdoll knockback and normal respawning.
The control rearms eight seconds after the train leaves. Platforms outside the
train's width and the street above it remain safe.

The room host validates requests and owns train timing and collisions. Repeated
snapshots repair missed hit messages; spectators use the same train progress.
The train uses four instanced draw groups, one cube geometry, no textures, and
no dynamic shadows. It works with Potato mode and the normal map renderer.

`train.js` anchors to packed map parts 7951 (ButtonTrain), 7946 and 7948
(tunnel portals). If the Studio export is reordered, update these indices;
`tools/test-train.cjs` checks them against the original snapshot. The collision
test sweeps both train and actor movement, including across slow frames.

Validation:

```sh
node tools/test-train.cjs
node tools/test-potato-streaming.cjs
node tools/build-jujutsu.js
node --experimental-vm-modules tools/test-jjs-loader.cjs
```

The CPU train test uses real map colliders, Three geometry, ragdoll physics and
simulated host/guest delivery. Live browser and real relay playtesting are still
needed to check the visual presentation and network feel on a small device.

Deploy the regenerated `jujutsu-parts/p5.js` with the branch's other files.
An Apps Script loader already pointing at `codex/jjs-loader-potato-streaming`
needs no BASE edit for this feature. Reload the game on all clients.
