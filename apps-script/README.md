# JJS Apps Script loader

The split build now has a roughly 43 KB startup page and a separate `p5.js`
game module. The previous page was about 22 MB because it embedded the game and
map twice. The map payload is still downloaded once inside the game module;
Potato mode controls local scenery rendering and texture decoding.

## Update an existing web app

1. Replace the old Apps Script loader (including its `BASE` and `doGet`) with
   the contents of `apps-script/Code.gs`. Keep only one `doGet` definition.
2. Use **Deploy → Manage deployments → Edit → New version → Deploy**.
3. Merge this change into `cursor/jujutsu-kaisen-multiplayer-0a77`. The replacement
   loader also supports the old build, so deploying it first avoids a missing
   `p5.js` route during the transition.
4. Reload the web app, then enable **Settings → Performance → Potato Mode**.

For testing before merge, change `JJS_REF` in `Code.gs` to the PR's branch.
The code automatically derives `BASE` from that ref. No other URL edits are
needed. A static HTTP server can serve `jujutsu-parts/index.local.html` directly.
The self-contained `jujutsu-multiplayer.html` still opens from disk.

The loader now serves `p=1` through `p=5`. Old loaders restricted to `p=1`–`p=4`
need the replacement before they can open the new split build. The shell and
all five parts use one resolved commit SHA, preventing mixed versions during
an update. Only the small SHA lookup is cached (60 seconds); large files are
not placed in Apps Script's limited CacheService.

The startup overlay shows received bytes, uses a progress bar only when response
lengths are available, retries a failed download twice, and offers a reload
button after failure. The renderer, multiplayer library and game load first;
music downloads start after the game initializes. Text files become JavaScript
blob URLs so both static hosting and Apps Script can load the modules.

## Checks

- `node --experimental-vm-modules tools/test-jjs-loader.cjs`: shell size, module
  syntax, pop-out document, startup ordering, unknown response lengths, retry
  exhaustion, HTML error responses, Apps Script routing and commit pinning.
- `node tools/test-potato-streaming.cjs`: map streaming and real destruction
  behavior with Three.js and a CPU renderer spy.
- `node tools/test-potato.cjs`: browser/GPU integration (Playwright and Chrome).

The first two checks passed during this change. Live Apps Script deployment
and device FPS still need checking; the available browser could not reach the
local test server.

Apps Script references: [Content Service](https://developers.google.com/apps-script/guides/content)
and [UrlFetchApp](https://developers.google.com/apps-script/reference/url-fetch/url-fetch-app).
