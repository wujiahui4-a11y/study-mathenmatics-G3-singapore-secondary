#!/usr/bin/env node
/* Build the online version of Jujutsu Battleground.

   Two outputs from the same sources, the same split as the Baldi game:

     jujutsu-multiplayer.html   everything in one file, opens from disk
     jujutsu-parts/             45 kB shell + separate scripts, for hosts that
                                cannot serve one big document (Apps Script)

   The original game pulls three.js from a CDN through an import map. Both
   builds vendor it instead, so the game works on a network that blocks the
   CDN and inside an Apps Script frame.

   Usage: node tools/build-jujutsu.js  */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = path.join(root, 'jujutsu');

const base = fs.readFileSync(path.join(src, 'base.html'), 'utf8');
const three = fs.readFileSync(path.join(src, 'three.module.min.js'), 'utf8');
const mqtt = fs.readFileSync(path.join(src, 'mqtt.min.js'), 'utf8');
const mp = fs.readFileSync(path.join(src, 'mp.js'), 'utf8');

const guard = (js) => js.replace(/<\/script/gi, '<\\/script');

/* the original import map, which we replace in both builds */
const IMPORTMAP = /<script type="importmap">[\s\S]*?<\/script>/;
if (!IMPORTMAP.test(base)) { console.error('import map not found in base.html'); process.exit(1); }

/* the game's module: our multiplayer code is appended inside it so it can see
   player, enemies, Enemy, scene, hurtPlayer and the rest of the module scope */
const MODULE_OPEN = '<script type="module">';
const modAt = base.indexOf(MODULE_OPEN);
if (modAt < 0) { console.error('module script not found'); process.exit(1); }
const modEnd = base.indexOf('</script>', modAt);
if (modEnd < 0) { console.error('module script never closes'); process.exit(1); }

function assemble(threeTag, mqttTag) {
  let html = base.replace(IMPORTMAP, threeTag);
  const at = html.indexOf(MODULE_OPEN);
  const end = html.indexOf('</script>', at);
  const body = html.slice(at + MODULE_OPEN.length, end);
  return html.slice(0, at) +
    mqttTag + '\n' +
    MODULE_OPEN + body +
    '\n/* ===== online mode ===== */\n' + guard(mp) + '\n' +
    html.slice(end);
}

/* ---------------------------------------------------------------- one file */
const inlineThree =
  '<script id="jjThreeSrc" type="text/plain">\n' + guard(three) + '\n</script>\n' +
  `<script>
(function () {
  /* three.js is carried inside this page; hand the module loader a URL for it */
  var code = document.getElementById('jjThreeSrc').textContent;
  var url;
  try { url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' })); }
  catch (e) { url = 'data:text/javascript;base64,' + btoa(unescape(encodeURIComponent(code))); }
  var im = document.createElement('script');
  im.type = 'importmap';
  im.textContent = JSON.stringify({ imports: { three: url } });
  document.head.appendChild(im);
})();
</script>`;

const single = assemble(inlineThree, '<script>\n' + guard(mqtt) + '\n</script>');
fs.writeFileSync(path.join(root, 'jujutsu-multiplayer.html'), single);
console.log('jujutsu-multiplayer.html  ' + Math.round(single.length / 1024) + ' kB');

/* ------------------------------------------------------------------ parts */
const out = path.join(root, 'jujutsu-parts');
if (!fs.existsSync(out)) fs.mkdirSync(out);

const partsThree = '<script type="importmap">\n' +
  '{ "imports": { "three": "__PART_BASE__?p=1" } }\n</script>';
const partsMqtt = '<script src="__PART_BASE__?p=2"></script>';

let shell = assemble(partsThree, partsMqtt);
/* the module itself is small enough to stay inline: it is the game, ~116 kB */
fs.writeFileSync(path.join(out, 'index.html'), shell);
fs.writeFileSync(path.join(out, 'p1.js'), three);
fs.writeFileSync(path.join(out, 'p2.js'), mqtt);
fs.writeFileSync(path.join(out, 'index.local.html'),
  shell.replace(/__PART_BASE__\?p=(\d+)/g, 'p$1.js'));

console.log('jujutsu-parts/index.html  ' + Math.round(shell.length / 1024) + ' kB');
console.log('jujutsu-parts/p1.js       ' + Math.round(three.length / 1024) + ' kB (three.js)');
console.log('jujutsu-parts/p2.js       ' + Math.round(mqtt.length / 1024) + ' kB (mqtt)');
