#!/usr/bin/env node
/* Inline the whole game into one HTML file.
   Useful when no host is reachable: download the file, double-click it, play.
   Usage: node tools/build-single.js  */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = path.join(root, 'arena');
const out = path.join(root, 'study-notes.html');

let html = fs.readFileSync(path.join(src, 'index.html'), 'utf8');

/* A "</script" inside inlined code would close the tag early. Escaping the
   slash keeps the JavaScript identical while hiding it from the parser. */
const guard = (js) => js.replace(/<\/script/gi, '<\\/script');

html = html.replace(/[ \t]*<link rel="stylesheet" href="([^"]+)" \/>\s*/g, (m, href) => {
  const css = fs.readFileSync(path.join(src, href), 'utf8');
  return '<style>\n' + css + '</style>\n';
});

/* net.js normally fetches the MQTT client on demand; a standalone file has
   nowhere to fetch it from, so it ships inlined and net.js finds it already
   loaded on window. */
const preload = { 'js/util.js': ['js/vendor/mqtt.min.js'] };

html = html.replace(/[ \t]*<script src="([^"]+)"><\/script>\s*/g, (m, srcPath) => {
  const files = (preload[srcPath] || []).concat([srcPath]);
  return files
    .map((f) => '<script>\n' + guard(fs.readFileSync(path.join(src, f), 'utf8')) + '\n</script>\n')
    .join('');
});

/* the manifest is a separate request that a file:// page cannot make */
html = html.replace(/[ \t]*<link rel="manifest"[^>]*>\s*/g, '');

const leftover = html.match(/(src|href)="(?!data:|https?:|#)[^"]+"/g);
if (leftover) {
  console.error('still referencing external files:', leftover.join(', '));
  process.exit(1);
}

fs.writeFileSync(out, html);
console.log('wrote ' + path.relative(root, out) + ' (' + Math.round(html.length / 1024) + ' kB)');
