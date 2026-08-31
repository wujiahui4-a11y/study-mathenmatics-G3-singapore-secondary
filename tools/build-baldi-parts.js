#!/usr/bin/env node
/* Build a split version of the game for hosts that cannot serve one big page.

   Apps Script chops a 2.2 MB HTML document in half, which leaves a script
   block truncated ("Unexpected end of input"). This build keeps the document
   tiny and puts each script in its own file, fetched separately:

     baldi-parts/index.html   markup only, a few tens of kB
     baldi-parts/p1.js        three.js
     baldi-parts/p2.js        Tone.js
     baldi-parts/p3.js        the game
     baldi-parts/p4.js        MQTT client
     baldi-parts/p5.js        multiplayer module

   index.html references them as __PART_BASE__?p=N so whoever serves it can
   point that at itself.
   Usage: node tools/build-baldi-parts.js  */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = path.join(root, 'baldi');
const out = path.join(root, 'baldi-parts');

if (!fs.existsSync(out)) fs.mkdirSync(out);

const base = fs.readFileSync(path.join(src, 'base.html'), 'utf8');
const parts = [];

/* pull every inline script out of the page, in order */
let shell = base.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/g, (m, code) => {
  if (!code.trim()) return m;
  parts.push(code);
  return '<script src="__PART_BASE__?p=' + parts.length + '"></script>';
});

parts.push(fs.readFileSync(path.join(src, 'mqtt.min.js'), 'utf8'));
parts.push(fs.readFileSync(path.join(src, 'mp.js'), 'utf8'));

const extra =
  '<script src="__PART_BASE__?p=' + (parts.length - 1) + '"></script>\n' +
  '<script src="__PART_BASE__?p=' + parts.length + '"></script>\n' +
  '<script>window.__bbGameLoaded = true;</script>\n';

const probe = fs.readFileSync(path.join(__dirname, 'baldi-probe.html'), 'utf8');

const bodyEnd = shell.indexOf('>', shell.indexOf('<body')) + 1;
shell = shell.slice(0, bodyEnd) + '\n' + probe + shell.slice(bodyEnd);
const closeAt = shell.lastIndexOf('</body>');
shell = shell.slice(0, closeAt) + extra + shell.slice(closeAt);

fs.writeFileSync(path.join(out, 'index.html'), shell);
parts.forEach((code, i) => fs.writeFileSync(path.join(out, 'p' + (i + 1) + '.js'), code));

/* a copy with the parts pointed at plain files, so it can be opened locally */
fs.writeFileSync(path.join(out, 'index.local.html'),
  shell.replace(/__PART_BASE__\?p=(\d+)/g, 'p$1.js'));

console.log('shell        ' + Math.round(shell.length / 1024) + ' kB');
parts.forEach((c, i) => console.log('p' + (i + 1) + '.js       ' + Math.round(c.length / 1024) + ' kB'));
