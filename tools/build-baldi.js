#!/usr/bin/env node
/* Assemble baldi-multiplayer.html = the original game + MQTT + the
   multiplayer module, as one self-contained file.
   Usage: node tools/build-baldi.js  */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = path.join(root, 'baldi');
const out = path.join(root, 'baldi-multiplayer.html');

const base = fs.readFileSync(path.join(src, 'base.html'), 'utf8');
const mqtt = fs.readFileSync(path.join(src, 'mqtt.min.js'), 'utf8');
const mp = fs.readFileSync(path.join(src, 'mp.js'), 'utf8');

const guard = (js) => js.replace(/<\/script/gi, '<\\/script');

/* A tiny checker placed near the top of the file, so it still runs even if the
   page arrives truncated. If the 3D never starts it says why instead of
   leaving a black screen. */
const probe = `<script>
(function(){
  window.__bbProbe = true;
  function webglOk(){
    try {
      var c = document.createElement('canvas');
      return !!(c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl'));
    } catch (e) { return false; }
  }
  function show(title, lines){
    var d = document.createElement('div');
    d.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:99999;background:#161b26;color:#e8ecf6;'
      + 'font:14px/1.6 system-ui,sans-serif;padding:16px 20px;border-bottom:3px solid #ff8f84';
    d.innerHTML = '<b style="color:#ff8f84">' + title + '</b><br>' + lines.join('<br>');
    document.body.appendChild(d);
  }
  /* G is a top level const, so it lives in the global lexical scope and is
     not a property of window — it has to be read as a bare identifier. */
  function gameRunning(){ try { return !!(G && G.renderer); } catch (e) { return false; } }
  setTimeout(function(){
    if (gameRunning()) return;                          // all good
    if (!window.__bbGameLoaded) {
      show('The page did not finish loading.', [
        'Only part of the file arrived, so the game never started.',
        'This usually means whatever is serving the page cut it off — it is about 2.2 MB.',
        'Try opening the file directly, or from a host that can serve the whole thing.'
      ]);
    } else if (!webglOk()) {
      show('3D is switched off in this browser.', [
        'The page loaded, but this device will not give the game a WebGL canvas.',
        'In Chrome: Settings &rarr; System &rarr; turn on "Use graphics acceleration when available", then restart the browser.',
        'On a school-managed device this may be blocked by policy.'
      ]);
    } else {
      show('The game failed to start.', ['WebGL works and the file loaded, so something else threw during start-up.']);
    }
  }, 6000);
})();
</script>
`;

const marker = '</body>';
const at = base.lastIndexOf(marker);
if (at < 0) { console.error('no </body> in base.html'); process.exit(1); }

const block =
  '\n<!-- ===== multiplayer: transport ===== -->\n<script>\n' + guard(mqtt) + '\n</script>\n' +
  '<!-- ===== multiplayer: hunter vs students ===== -->\n<script>\n' + guard(mp) + '\n</script>\n' +
  '<script>window.__bbGameLoaded = true;</script>\n';

const bodyOpen = base.indexOf('<body');
const bodyEnd = base.indexOf('>', bodyOpen) + 1;
const withProbe = base.slice(0, bodyEnd) + '\n' + probe + base.slice(bodyEnd);
const at2 = withProbe.lastIndexOf(marker);

const html = withProbe.slice(0, at2) + block + withProbe.slice(at2);
fs.writeFileSync(out, html);
console.log('wrote ' + path.relative(root, out) + ' (' + Math.round(html.length / 1024) + ' kB)');
