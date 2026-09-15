# Potato Mode (Fast Mode)

Open **Settings → Performance** and enable **Potato Mode (Fast Mode)**.
It is a personal setting, saved in this browser. Turn it
off to restore the full city view. Multiplayer guests can use it independently
of the room host. The empty baseplate has no city scenery to stream.

On JJS, only a moving neighborhood around the player is submitted to the GPU.
Distant streets and buildings fade into fog; nearby sections update as the
player crosses 48-stud cells, including teleports. The rendered region extends
144 studs from the cell center in X/Z. Fog hides the boundary. Scenery shadows
are omitted in this mode; character models and combat controls are unchanged.

The importer batches the full city's geometry by material. Fast Mode builds a
spatial catalog of those triangles, clips selected triangles to the nearby
region, and batches surviving triangles by their original material. This also
clips large floors instead of retaining a map-sized triangle. Only these nearby
meshes are rendered. Previous nearby GPU buffers are disposed when the window
changes. Previously uploaded full-map buffers/textures are released on entry,
and textures required by the nearby materials are uploaded again as needed.

The self-contained HTML still includes the entire map payload and keeps CPU
map data for gameplay. This reduces scenery rendering and graphics-memory use;
it does not shrink the initial download or provide network asset streaming.
Collision, floor queries, and shared destruction remain available everywhere.
Destruction fragments and signs join the nearby rendering batches, so a remote
area damaged before you arrive has the correct holes when it becomes visible.

`potato.js` wraps only the main scene renderer, restoring source visibility and
fog after each render. It does not send multiplayer packets or change collision.
`jjs.js` clears its graphics cache when maps change, and `destruction.js` marks
the nearby rendering cache dirty when an overlapping part changes.

Validation: `node tools/test-potato.cjs` checks the actual renderer's triangle
counts and clipped bounds, movement and GPU-buffer disposal, destruction and
restoration in nearby/distant areas, preference persistence, guest independence,
full-mode restoration, map-switch cleanup, and the split production build.
Existing JJS, destruction, and shift-lock suites cover related regressions.
