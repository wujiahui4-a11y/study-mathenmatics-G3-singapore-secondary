# AI Server

Open **AI SERVER** on the title screen, select the Baseplate or JJS, enter **1–100** AI players, choose **Mixed players**, **Noob**, **Middle**, or **Pro**, and press **JOIN AI SERVER**. The default is 12 mixed fighters. **END AI SESSION** restores training mode.

The room host runs the shared AI in their browser. Keep that browser open for multiplayer. This update uses the existing relay and does not create a dedicated cloud server.

## Controls

- **F:** hold block. **G:** awakening when charged.
- **Left mouse:** four-hit M1 combo. Normal hits stun for 0.5 seconds. A confirmed hit among the first three punches can cancel into a skill, including a three-punch → skill combo.
- **Q / W + Q:** front dash strike. **A/D + Q:** side dash. **S + Q:** back dash. Turn the camera during a dash to steer it.
- **Q while ragdolled:** evasive recovery with a **25-second cooldown**, shared by players and bots. There is a short reaction window after knockdown. Death, cinematic grabs, finishers and other holds cannot be escaped this way. Readiness appears in the combat HUD. Respawning restores availability.
- **Space:** jump; hold during the combo for the fourth-hit uppercut, or attack in the air for a downslam.
- **Double-tap F**, or walk while turning in a circle, to signal nearby bots. Responses are optional.

Naoya retains his existing two-charge player dash and its trajectory, recharge and invulnerability. His bot dash also retains that behavior. Other fighters use the shared steering dashes. Shift lock remains available.

## Fighters and decisions

Bots use all 14 voxel characters, their real four normal skills and R, their animations, effects, damage and cooldowns. The first 14 assignments are unique; larger populations repeat characters with distinct names and independent state.

Noob, middle and pro profiles vary reaction time, combo selection, guard tracking, skill dodging, retreat decisions and cooperation. Their base revenge chances are 18%, 52% and 88%. Every profile starts with the same 100 HP as a player.

Bots chain M1s into character techniques, use front-dash approaches, flank with side dash → rotation → M1, and sometimes back away from a guard. Pros can follow a visible flank with their guard. Attack detection examines nearby visible attack direction, range and timing, then reacts after the profile's delay; bots do not automatically avoid every hit.

Low-health bots may retreat, string front and side dashes into their escape, use reachable buildings for cover, or turn back with a character skill. On seeing an awakened enemy, they may flee, fight on, or spend their own charged awakening.

Awakenings work for the eight existing awakened characters: Gojo, Naoya, Yuji/Sukuna, Hakari, Choso, Megumi, Mahito and Todo. Their awakened kits use the original attacks; Mahito retains only his first awakening. Gojo/Hakari regeneration is retained, as is Hakari's protection from death during fever. Bots have separate meters and timers. Naoya's AI awakening uses an arena rush; the local player's special cinematic and dash remain intact. Bot presentations stay in the arena and do not commandeer the observing player's camera.

## Spawning, navigation and rivalries

Bots spawn and respawn in the map's designated spawn areas, using small collision-checked offsets for crowded servers. They never respawn around a chase or revenge target. They must travel back to their rival.

Pursuits survive occlusion and failed path attempts. Bots investigate a moving target's latest position and use live collision geometry to find routes through doorways, around walls, along stairs, and over reachable ledges. Grounded clearance handles stair treads; swept jump/vault/climb links let them leave crater rims and low obstacles. When obstructed they replan or try a short detour without forgetting their enemy. They may punch through a destructible obstruction using the normal four-hit chain. Unbreakable walls and unreachable ledges still require a traversable route.

Idle fighters search the arena for opponents. Damage interrupts social pauses and celebrations, redirects attention to the attacker, and records other threats. Bots can abandon one revenge pursuit for a new attacker and remember the earlier grudge. A target's death resolves the active grudge; new deaths can start new rivalries.

Bots sharing a revenge target may team temporarily and avoid friendly fire. All participating revengers can celebrate the target's death, standing or alternating block and forward/back movement, then signal their teammates and move on. Friendships expire. Hitting a former killer yourself starts your own fight; bots recognize the attack and may target you again. The HUD shows your last rival and their distance/elevation.

## Performance and implementation

Path searches share a time/node budget and a live collision cache, with a queue sized for 100 fighters. Spatial buckets limit nearby-agent scans. Effects are updated in batches per caster to avoid rebuilding actor state for every particle. Faraway rig poses update less frequently. These keep simulation work bounded, but rendering 100 detailed fighters and their effects is demanding; use fewer bots or Potato Mode on slower devices.

The modules are ai-server.js (lifecycle and room sync), ai-behavior.js (profiles and decisions), ai-navigation.js (routes and local steering), ai-combat.js (shared combat actions), and ai-character-kits.js (original character casts in isolated actor state). The host decides bot actions; remote players confirm damage through the existing owning-client protocol. Snapshots carry difficulty, awakening, evasive cooldown and action poses. Session epochs, ordering and per-hit IDs reject stale or duplicate updates.

## Validation

Build with node tools/build-jujutsu.js. Tests require Playwright and Chrome; PLAYWRIGHT_MODULE can point to an external installation.

- test-ai-tactics.cjs: 100 fighters, spawn independence, profiles, evasive eligibility/cooldown, dash steering, M1 → skill stun, retaliation, revenge teams, retreat/dodge decisions, enclosed stairs, craters and destructible barriers.
- test-ai-awakenings.cjs: all existing awakened kits, actual hits, readiness, cooldowns, expiry/reset and local-player state isolation.
- test-ai-character-kits.cjs: all 70 normal/R moves, variants, counters, independent cooldowns and cleanup.
- test-ai-server.cjs: autonomous battles, flank combos, guard/damage, signals, revenge, navigation, JJS, mobile layout, pause and lifecycle.
- test-ai-network.cjs: separate host/guest browsers, 100 synchronized bots, difficulty and awakening state, player/bot evasive replication, character actions, actual damage, deduplication and late joining.
- test-core-combat.cjs: full roster, actual controls, combat windows and collision, plus an exact comparison against Naoya's saved dash baseline.

Network tests exchange captured relay packets between browser instances; external relay availability and smooth rendering on every device are not guaranteed by these tests.

Playable files are jujutsu-multiplayer.html (standalone), jujutsu-parts/index.local.html (local server), and jujutsu-parts/index.html (existing Apps Script host). Rebuild all three when changing source.
