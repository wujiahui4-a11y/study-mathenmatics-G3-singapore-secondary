# JJS destruction

Select **JJS** in the training map selector or multiplayer room. Destruction is
enabled by default. Fourth punches, heavy confirmed hits, knockback wall impacts,
and supported skill impacts break the imported city into angular voxel openings.
The surviving walls, floors, signs, and furniture retain their original textures.
Holes affect walking, falling, movement sweeps, and camera obstruction.

The menu offers destruction on/off, a 30- or 60-second rebuild delay, no automatic
rebuild, three debris settings, and Restore map. Turning destruction off stops
new damage; use Restore map to repair existing holes. Occupied source parts wait
until players move clear before rebuilding. The empty baseplate has no breakable
city geometry; use JJS to try the system.

## Gameplay integration

- Fourth M1 for every character can break a wall even without an enemy target.
- Confirmed damage of at least 12, or a strong knockback, damages nearby scenery
  for the existing roster. Blocked/rejected hits do not trigger this hook.
- Todo's contact strikes and cinematic final impact have explicit impact timing.
- Mahito's heavy strikes, bullets, and Body Repel have terrain impacts.
- Hanami's roots, branches, buds, and flower beam affect the environment.
- Gojo's Red explosion, awakened Blue collapse, awakened Red, and Hollow Purple
  affect the environment. Swept beams break their first scenery contact.
- Fast local knockback and ragdolls can break walls on contact. Ordinary running
  does not destroy buildings. Replayed remote VFX do not cause a second impact.

## Implementation

`import-jjs-obj.cjs` adds a source-part owner to each exported triangle. The first
pass matches original oriented-box world bounds; a second pass attaches the
separately exported decal planes to their part's face. Vertex positions, normals,
UVs, materials, and images are retained. `build-jjs-data.cjs` carries the Studio
`Workspace.Map.Destructible` membership into the game. `Workspace.Map.Core`,
unmatched objects, and complex custom meshes remain protected.

`destruction.js` finds nearby source parts in a spatial grid. It recursively splits
only cuboids intersecting a spherical impact, retaining unaffected regions as
large blocks. Surviving source triangles are clipped against these fragments;
new internal faces use the source material color. Original triangle indices are
hidden and later restored exactly. GUI planes are also clipped when their carrier
part breaks. `jjs.js` replaces only the affected oriented colliders in its spatial
buckets, so collision agrees with the visible opening.

Debris uses one pooled instanced cube mesh, gravity, a simple floor bounce, and
a short shrink/fade. It is cosmetic and does not block players or cause chain
damage. There is no structural-support simulation or whole-building rigid-body
collapse. This is an original browser implementation inspired by JJS, not its
private source code or Roblox's native terrain engine.

The default limits are 160 simultaneously damaged source parts, 128 surviving
fragments per part, 5,000 surviving fragments overall, 32 changed parts per impact,
and 192 cosmetic debris pieces (64 on Low). Large impacts use coarser cells.
When a limit is reached, additional pieces remain intact until capacity is freed;
existing damage is not silently repaired to make room.

## Multiplayer

The room host owns destruction settings, affected colliders, and rebuild timing.
Guests request bounded impacts; the host checks sender presence, health, range,
coordinates, radius, and request rate. Changed parts are sent as small snapshots
with a map generation and revision. Late join and periodic full snapshots repair
missed packets on the existing QoS 0 relay. Duplicate updates, stale generations,
and updates from other peers are ignored. Debris quality remains a personal setting.
The host must remain connected for guests to change or rebuild the shared world.
This uses the game's existing peer relay, not a dedicated authoritative server.

## Research references

- [Jujutsu Shenanigans official game page](https://www.roblox.com/games/9391468976/Jujutsu-Shenanigans)
  identifies Combat Mayhem as inspiration for its destruction.
- [VoxBreaker author's implementation discussion](https://devforum.roblox.com/t/voxbreaker-an-oop-voxel-destruction-module/2935099)
  explains marked-part filtering, localized subdivision, cell-size tradeoffs,
  and delayed reset. Those principles informed this original JavaScript system.
- [Three.js InstancedMesh documentation](https://threejs.org/docs/pages/InstancedMesh.html)
  covers the pooled debris rendering and instance buffer updates.

## Validation

Build with `node tools/build-jujutsu.js`. Run `node tools/test-destruction.cjs`
with Playwright available through `PLAYWRIGHT_MODULE` if needed. The suite uses
the actual game build and imported city, including visual triangle clipping,
full-height character clearance, floor falling, protected Core, exact restoration,
occupied rebuild deferral, billboard artwork holes, combat triggers, resource
limits, separate-page multiplayer synchronization, late join, and map reset.

Existing Todo, Mahito, Hanami, JJS, and shift-lock integration suites cover
regressions. Todo's isolated rooftop teleport test disables destruction so its
supporting floor survives that test; falling through a destroyed roof is checked
by the destruction suite.
