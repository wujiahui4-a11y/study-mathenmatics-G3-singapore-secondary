/* Run: node --experimental-vm-modules tools/test-jjs-loader.cjs */
'use strict';
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..'), read = file => fs.readFileSync(path.join(root, file), 'utf8');
async function bootstrap(fail) {
  const calls = [], blobs = new Map(), nodes = new Map(); let serial = 0, imported = false, removed = false;
  const node = selector => {
    if (!nodes.has(selector)) nodes.set(selector, {hidden: selector === 'button', addEventListener() {}, removeAttribute(k) { delete this[k]; }});
    return nodes.get(selector);
  };
  const ctx = vm.createContext({console, Blob, TextDecoder, Uint8Array, AbortController,
    setTimeout: (fn, ms) => setTimeout(fn, ms < 2000 ? 0 : ms), clearTimeout,
    location: {reload() {}},
    URL: {revokeObjectURL(url) {blobs.delete(url);}, createObjectURL(b) {const id = 'blob:test-' + ++serial; blobs.set(id, b); return id;}},
    document: {body: {appendChild() {}}, head: {appendChild(s) { queueMicrotask(() => s.onload()); }},
      createElement() { return {style: {}, querySelector: node, remove() { removed = true; }}; }},
    fetch: async url => {
      const id = Number(url.match(/p=(\d+)/)[1]); calls.push(id);
      if (id === 5 && fail === 'http') return new Response('failed', {status: 503});
      if (id === 5 && fail === 'html') return new Response('<html>sign-in</html>', {headers: {'content-type': 'text/html'}});
      const text = id === 5 ? 'import * as THREE from "three"; /* game */' : '/* vendor */';
      return new Response(text, {headers: {'content-type': 'text/javascript'}});
    }});
  ctx.window = ctx;
  const result = vm.runInContext(read('jujutsu/loader.js'), ctx, {
    importModuleDynamically: async specifier => {
      const code = await blobs.get(specifier).text();
      assert.match(code, /from "blob:test-/); assert.ok(calls.includes(1) && calls.includes(2) && calls.includes(5));
      assert.ok(!calls.includes(3) && !calls.includes(4), 'Music waits until game startup');
      const module = new vm.SyntheticModule([], () => {}, {context: ctx});
      await module.link(() => {}); await module.evaluate(); imported = true; return module;
    }
  });
  await result;
  if (fail) {
    assert.equal(imported, false); assert.equal(removed, false); assert.equal(node('button').hidden, false);
    assert.equal(calls.filter(id => id === 5).length, 3); assert.match(node('span').textContent, /Could not load JJS/);
  } else {
    assert.equal(imported, true); assert.equal(removed, true); assert.equal(ctx.JJLOADER.ready, true);
    assert.ok(calls.includes(3) && calls.includes(4)); assert.equal(node('progress').max, undefined, 'Unknown lengths stay indeterminate');
  }
}
function appsScript() {
  const revision = 'a'.repeat(40), requests = [], cache = new Map();
  const context = vm.createContext({
    UrlFetchApp: {fetch(url) {requests.push(url); return {getResponseCode: () => 200,
      getContentText: () => url.includes('/commits/') ? JSON.stringify({sha: revision}) : url.endsWith('index.html') ? read('jujutsu-parts/index.html') : '/* game part */'};}},
    CacheService: {getScriptCache: () => ({get: k => cache.get(k), put: (k, v) => cache.set(k, v)})},
    ContentService: {MimeType: {JAVASCRIPT: 'javascript'}, createTextOutput: text => ({text, setMimeType(mime) {this.mime=mime;return this;}})},
    HtmlService: {createHtmlOutput: text => ({text, setTitle() {return this;}})},
    ScriptApp: {getService: () => ({getUrl: () => 'https://script.google.com/macros/s/test/exec'})}});
  vm.runInContext(read('apps-script/Code.gs'), context);
  const html = context.doGet({parameter: {}}).text;
  assert.ok(!html.includes('__PART_BASE__')); assert.ok(html.includes('?p=5&v=' + revision));
  const response = context.doGet({parameter: {p: '5', v: revision}});
  assert.equal(response.mime, 'javascript'); assert.ok(requests.at(-1).endsWith('/' + revision + '/jujutsu-parts/p5.js'));
  const count = requests.length;
  assert.match(context.doGet({parameter: {p: '../file'}}).text, /Unknown game file/);
  assert.match(context.doGet({parameter: {v: '<bad>'}}).text, /Invalid game revision/);
  assert.equal(requests.length, count);
  context.doGet({parameter: {}}); assert.equal(requests.filter(u => u.includes('/commits/')).length, 1, 'Only small revision lookup is cached');
}
(async () => {
  const html = read('jujutsu-parts/index.html'), local = read('jujutsu-parts/index.local.html');
  assert.ok(Buffer.byteLength(html) < 60000, 'Shell stays small even with the pop-out copy');
  assert.ok(!html.includes('var JJS_DATA')); assert.ok(!html.includes('cdn.jsdelivr.net'));
  assert.ok(!local.includes('__PART_BASE__')); assert.ok(local.includes('./p5.js'));
  new vm.SourceTextModule(read('jujutsu-parts/p5.js'));
  // The pop-out stores exactly the small shell with only script terminators escaped.
  const copy = html.match(/<script type="text\/plain" id="__selfDoc">([\s\S]*)<\/script>\n<\/body>/)[1];
  assert.equal(copy.replace(/<\\\/script/g, '</script'), html.replace(/<script type="text\/plain" id="__selfDoc">[\s\S]*<\/script>\n<\/body>/, '</body>'));
  await bootstrap(); await bootstrap('http'); await bootstrap('html'); appsScript();
  console.log('PASS: small shell, module parsing, pop-out copy, startup order, progress, retries, failure recovery, Apps Script version pinning and routes');
})().catch(e => { console.error(e); process.exitCode = 1; });
