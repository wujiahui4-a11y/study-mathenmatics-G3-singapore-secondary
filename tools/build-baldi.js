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

const marker = '</body>';
const at = base.lastIndexOf(marker);
if (at < 0) { console.error('no </body> in base.html'); process.exit(1); }

const block =
  '\n<!-- ===== multiplayer: transport ===== -->\n<script>\n' + guard(mqtt) + '\n</script>\n' +
  '<!-- ===== multiplayer: hunter vs students ===== -->\n<script>\n' + guard(mp) + '\n</script>\n';

const html = base.slice(0, at) + block + base.slice(at);
fs.writeFileSync(out, html);
console.log('wrote ' + path.relative(root, out) + ' (' + Math.round(html.length / 1024) + ' kB)');
