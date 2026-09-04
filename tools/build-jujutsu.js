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

/* Order matters: each of these patches the one before it. vfx defines the
   kit, gore adds the ways of dying and the health lock, combat re-points
   the game's own effects at the kit and adds the throw, hits layers the
   reactions over all of them, dash replaces Q for everybody but Naoya,
   gojo builds the awakening on top, finisher
   sits after every fighter so it can send them all somewhere, and mp
   shares the lot — last, so it still broadcasts through a cutscene. */
const addons = ['vfx.js', 'anim.js', 'ragdoll.js', 'gore.js', 'punch-sfx.js', 'red-sfx.js', 'combat.js', 'hits.js',
  'dash.js', 'gojo.js', 'naoya.js', 'yuji.js', 'hakari.js', 'choso.js', 'megumi.js', 'mahito.js', 'todo.js', 'higuruma.js', 'yuta.js',
  'void.js', 'sukuna.js', 'gamble.js', 'fever.js', 'garden.js', 'finisher.js', 'maps.js', 'mp.js']
  .map(function (f) {
    return { name: f, code: fs.readFileSync(path.join(src, f), 'utf8') };
  });

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
  const extra = addons.map(function (a) {
    return '\n/* ===== ' + a.name + ' ===== */\n' + guard(a.code) + '\n';
  }).join('');
  return html.slice(0, at) +
    mqttTag + '\n' +
    MODULE_OPEN + body + extra +
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

const p4src = (function () {
  const p = path.join(root, 'jujutsu-parts', 'p4.js');
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
})();
const p4Tag = p4src ? '<script>\n' + guard(p4src) + '\n</script>\n' : '';

const single = assemble(inlineThree, '<script>\n' + guard(mqtt) + '\n</script>\n' + p4Tag);
fs.writeFileSync(path.join(root, 'jujutsu-multiplayer.html'), single);
console.log('jujutsu-multiplayer.html  ' + Math.round(single.length / 1024) + ' kB');

/* ------------------------------------------------------------------ parts */
const out = path.join(root, 'jujutsu-parts');
if (!fs.existsSync(out)) fs.mkdirSync(out);

const partsThree = '<script type="importmap">\n' +
  '{ "imports": { "three": "__PART_BASE__?p=1" } }\n</script>';
const partsMqtt = '<script src="__PART_BASE__?p=2"></script>\n' +
  '<script src="__PART_BASE__?p=3" async></script>\n' +
  '<script src="__PART_BASE__?p=4" async></script>';

let shell = assemble(partsThree, partsMqtt);

/* A copy of the page, kept as inert text. An embedded page cannot be granted
   pointer lock, but it can open a blank window and write this into it: that
   window is a fresh top level context, so the mouse locks there. Whoever
   serves the shell substitutes __PART_BASE__ inside this copy too, so its
   script URLs are already absolute. */
shell = shell.replace('</body>',
  '<script type="text/plain" id="__selfDoc">' + guard(shell) + '</script>\n</body>');

fs.writeFileSync(path.join(out, 'index.html'), shell);
fs.writeFileSync(path.join(out, 'p1.js'), three);
fs.writeFileSync(path.join(out, 'p2.js'), mqtt);
fs.writeFileSync(path.join(out, 'index.local.html'),
  shell.replace(/__PART_BASE__\?p=(\d+)/g, './p$1.js'));

console.log('jujutsu-parts/index.html  ' + Math.round(shell.length / 1024) + ' kB');
console.log('jujutsu-parts/p1.js       ' + Math.round(three.length / 1024) + ' kB (three.js)');
console.log('jujutsu-parts/p2.js       ' + Math.round(mqtt.length / 1024) + ' kB (mqtt)');
const p3path = path.join(out, 'p3.js');
if (fs.existsSync(p3path)) {
  console.log('jujutsu-parts/p3.js       ' + Math.round(fs.statSync(p3path).size / 1024) + ' kB (theme)');
}
const p4path = path.join(out, 'p4.js');
if (fs.existsSync(p4path)) {
  console.log('jujutsu-parts/p4.js       ' + Math.round(fs.statSync(p4path).size / 1024) + ' kB (naoya ost)');
}
