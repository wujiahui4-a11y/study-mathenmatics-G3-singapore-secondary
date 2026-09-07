# Studio-inspired parkour

The browser game now adapts the movement mechanics from the connected Studio place `95007704167001`, inspected on 2026-09-07. Source scripts were `StarterPlayer.StarterCharacterScripts.Wall_Parkour`, `LedgeGrab`, and `Vault`. The Studio place itself was only inspected; the implementation lives in this game.

## Play

Choose **JJS** in Settings → General → Training map. All characters can use parkour on suitable solid surfaces.

- **Vault:** walk forward into a low, narrow barrier with clear space above and beyond it.
- **Grab:** jump toward a reachable ledge, then press **Space** again while airborne and facing it.
- **Shimmy:** hold **A / D** while hanging to move along the ledge.
- **Climb:** press **Space** while hanging to pull onto the top.
- **Drop:** press **S** while hanging.
- **Wall kick:** while airborne beside a wall, hold **A or D** toward it and press **Q**. Without a suitable wall, Q keeps its normal dash behavior.
- **Sprint:** double-tap **W**. **Shift** still toggles shift lock; with it off, the cursor is free and right mouse drag rotates the camera.

## Adaptation and animation

`movement.js` supplies the traversal state machine and original procedural joint animation. It uses anticipation, contact, weight transfer, and recovery poses for vaults, catches, shimmies, climbs, and wall kicks. Two-bone arm solving places hanging hands at the ledge. The original locomotion layer includes directional strides, running lean, jump/fall poses, breathing, and landing compression. Character-specific secondary animation remains layered on top. No Roblox animation asset IDs are reused.

The browser keeps its existing walk/run speeds (7.2/13.5), jump velocity (15), and gravity (34). Wall kicks use 28 horizontal and 13 initial vertical velocity, adapted to that pace. Vaults last 0.68 seconds, catches 0.2, shimmies 0.35, climbs 0.72, and wall pushes 0.36. A kick cooldown and same-wall lock until landing prevent repeated climbing on one wall. Studio's tagged low-wall vault is adapted to geometrically suitable low barriers on the imported map.

Detailed oriented-box traces and swept body clearance use the live JJS collision index, including destruction fragments. Vaults/climbs require landing support and headroom. Destroyed handholds, damage, character/map changes, focus loss, menus, and cinematic takeovers release traversal. Custom-mesh enclosing boxes and invisible boundaries do not act as parkour targets. Parkour provides no damage or invincibility. Multiplayer state carries traversal phase, side, and travel direction to reproduce the original poses for other players. Potato Mode retains the same collision behavior.

## Build and verification

Run `node tools/build-jujutsu.js` to regenerate the standalone game and `jujutsu-parts` entry points.

Run `node tools/test-movement.cjs` with Playwright installed (or set `PLAYWRIGHT_MODULE` to its module path). The browser test covers vaulting, low-ceiling rejection, ledge movement/climbing/drop, wall kicking and dash fallback, destroyed support, damage/menu/map cleanup, two-client animation playback, and ledges in the actual imported JJS map. It writes its report and screenshots under `../movement-test`, or `MOVEMENT_ARTIFACT_DIR` if set.

Regression suites passed for shift lock, Todo combat/cinematics, JJS collision/map synchronization, destruction, and Potato Mode. These are controlled browser checks, not a latency or long-session multiplayer load test.
