# Studio UI adaptation

The browser UI uses the saved interface in the user's open **Jujutsu
Shenanigans.rbxl**, inspected through the Roblox Studio connector. Studio was
returned to Edit mode after inspection. Its project contents were not edited.

`StarterGui.Main` supplies the square 60-pixel skill slots, 5-pixel spacing,
bottom-center placement, translucent RGB(31,31,31) slot backgrounds, cyan
RGB(85,255,255) cooldowns, 300×20 awakening bar and paired readiness bars.
`StarterGui.Menus` supplies translucent light settings panels, black borders,
category tabs and cyan selection underlines. The web interface uses a local
Arial/Segoe UI fallback for Roblox's asset-backed fonts.

The local Studio playtest did not initialize the gameplay HUD and reported
many restricted asset errors. This is an adaptation of the inspectable saved
templates, not a verified pixel-perfect copy of a working Roblox play session.

## Controls

- **Characters:** compact dropdown with the existing 14 fighters; the initial
  menu also has a portrait list. Character switching keeps its existing rules.
- **Settings → General:** training map, shared destruction, rebuild delay,
  debris quality and Restore map. Guest restrictions remain enforced.
- **Settings → Performance:** persistent, personal Potato Mode (Fast Mode).
- **Servers:** existing room creation/join flow, restyled to match.
- **Controls:** movement instructions and the selected fighter's skill help.
- **1–4:** square skill slots, with a separate **R** slot. Existing additional
  **F** moves for Hakari/Choso get a smaller slot on the left. Skills accept
  keyboard input and clicks through the original combat handlers.
- **Q / R readiness:** paired thin bars below the awakening meter. Punch and
  dash retain their keyboard/mouse controls. Shift lock and right-drag orbit
  use the existing shared cursor controller.

The adapter moves existing menu nodes instead of cloning form controls, so
saved preferences, host authority, selection handlers and room state retain
their owners. It decorates rebuilt move bars, including awakened kits, and
reads actual cooldowns. It does not change combat damage, maps or network data.

Build with `node tools/build-jujutsu.js`. `tools/test-studio-ui.cjs` exercises
real DOM keyboard and mouse interaction, roster coverage, settings persistence,
room navigation, character meters and desktop/portrait/landscape bounds.
Related regressions are covered by `test-shift-lock.cjs`, `test-potato.cjs`
and `test-jjs.cjs`.
