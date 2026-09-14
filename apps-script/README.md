# JJS Apps Script loader

The split build now has a roughly 48 KB startup page and a separate `p5.js`
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

The startup overlay shows elapsed time and which files are ready. Inside an
Apps Script HTML-service page it now calls `getGamePart` through
`google.script.run`, instead of fetching the public `/exec` URL back from its
Google-hosted iframe. A missing server function produces an actionable deployment
error. Native calls time out after 45 seconds without automatically repeating
large transfers; late callbacks cannot restart a failed load.

**Existing installations must add the new `getGamePart` function and deploy a
new Apps Script version.** Replacing the entire loader with `Code.gs` includes
it. With the short BASE/doGet loader, add this below `doGet` (keep BASE pointing
to the branch you are testing):

```js
function getGamePart(part) {
  if (!/^[1-5]$/.test(String(part))) throw new Error('Unknown game file.');
  const response = UrlFetchApp.fetch(BASE + 'p' + part + '.js', {
    muteHttpExceptions: true
  });
  if (response.getResponseCode() !== 200) {
    throw new Error('Game file failed: HTTP ' + response.getResponseCode());
  }
  return response.getContentText();
}
```

Static hosting continues to use streamed fetch, with a 30-second idle timeout
and 90-second overall limit per file. The old 90-second timeout followed by two
automatic retries could leave a stalled page waiting over four minutes.
A retry button remains available after failure. Music downloads start after
initialization. JavaScript blob buffers are released after scripts start.

The game module remains about 12 MB, so the first load can still take time.
This change addresses transport and long silent waits; it is not a measured
speedup or proof of the precise cause on a particular user's deployment.

## Checks

- `node --experimental-vm-modules tools/test-jjs-loader.cjs`: shell size, module
  syntax, pop-out document, startup ordering, unknown response lengths, HTML error responses, native server calls,
  missing functions, timeout/late-callback handling, routing and commit pinning.
- `node tools/test-potato-streaming.cjs`: map streaming and real destruction
  behavior with Three.js and a CPU renderer spy.
- `node tools/test-potato.cjs`: browser/GPU integration (Playwright and Chrome).

The first two checks passed during this change. Live Apps Script deployment
and device FPS still need checking; the available browser could not reach the
local test server.

Apps Script references: [Content Service](https://developers.google.com/apps-script/guides/content)
, [HTML-service server calls](https://developers.google.com/apps-script/guides/html/communication)
and [UrlFetchApp](https://developers.google.com/apps-script/reference/url-fetch/url-fetch-app).
