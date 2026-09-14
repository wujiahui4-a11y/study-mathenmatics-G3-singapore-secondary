/* Real exported geometry and destruction, with a CPU-only renderer spy.
   Run without Chrome: node tools/test-potato-streaming.cjs */
'use strict';
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict'), zlib = require('node:zlib');
const root = path.resolve(__dirname, '..');
(async () => {
  const THREE = await import(require('node:url').pathToFileURL(path.join(root, 'jujutsu/three.module.min.js')).href);
  const packed = fs.readFileSync(path.join(root, 'jujutsu/jjs-data.js'), 'utf8').match(/atob\('([^']+)'\)/)[1];
  const data = JSON.parse(zlib.gunzipSync(Buffer.from(packed, 'base64')));
  const storage = new Map(), nodes = new Map();
  let images = 0, ticks = 0, fullCalls = 0, seenFog;
  function element() {
    const children = new Map();
    return { style: {}, parentElement: { after() {} }, after() {}, addEventListener() {},
      querySelectorAll() { return [element(),element(),element()]; },
      querySelector(key) { if (!children.has(key)) children.set(key, element()); return children.get(key); },
      getContext() { return new Proxy({measureText: () => ({width: 10})}, {get(o, k) { return o[k] || (() => {}); }}); } };
  }
  const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0xffffff, 900, 1800);
  const renderer = { ratio: 1.5, getPixelRatio() { return this.ratio; }, setPixelRatio(n) { this.ratio = n; },
    shadowMap: {enabled: true}, capabilities: {getMaxAnisotropy: () => 8},
    render(s) { seenFog = s.fog; s.updateMatrixWorld(true); s.traverseVisible(m => {
      if (m.name.startsWith('JJS exported surfaces')) fullCalls++;
    }); } };
  const context = vm.createContext({THREE, JJS_DATA: data, renderer, scene, devicePixelRatio: 2,
    performance: { now: () => ticks += .3 }, console, atob, setTimeout, clearTimeout,
    document: { createElement: element, getElementById(id) { if (!nodes.has(id)) nodes.set(id, element()); return nodes.get(id); } },
    localStorage: { getItem: k => storage.get(k), setItem: (k, v) => storage.set(k, v) },
    Image: class { set src(v) { images++; queueMicrotask(() => this.onload && this.onload()); } },
    player: {pos: new THREE.Vector3(), vel: new THREE.Vector3()}, enemies: [],
    JJMAP: {id: 'jjs'}, Enemy: class { damage() {} }, cds: {}, punch() {}, stepAction() {}, explodeRed() {}, updatePlayer() {}, resolveActorWorld() {} });
  context.window = context;
  function load(file) { vm.runInContext(fs.readFileSync(path.join(root, 'jujutsu', file), 'utf8'), context); }
  load('jjs.js'); load('potato.js'); load('destruction.js');
  const J = context.JJJJS, P = context.JJPOTATO, X = context.JJDESTRUCT;
  X.settings.debris = 0;
  P.setEnabled(true); J.build(); await J.ready;
  assert.equal(images, 0, 'Fast startup must defer exported texture decoding');
  const spawn = J.spawn(2); context.player.pos.set(spawn.x, spawn.y, spawn.z);
  const originalFog = scene.fog;
  const draw = () => renderer.render(scene, null);
  function settle() {
    let frames = 0;
    do { draw(); assert.ok(++frames < 10000, 'Streaming must finish'); } while (P.audit().pending);
    return frames;
  }
  draw(); assert.ok(P.audit().pending > 0, 'A cold neighborhood must yield across frames');
  const frames = settle(), initial = P.audit();
  assert.equal(initial.residentCells, 25); assert.equal(initial.pixelRatio, .75); assert.equal(initial.shadows, false);
  assert.equal(fullCalls, 0); assert.equal(scene.fog, originalFog); assert.notEqual(seenFog, originalFog);
  assert.ok(initial.triangles < initial.fullTriangles * .6);
  const group = () => J.root.getObjectByName('JJS nearby areas (Potato Mode)');
  function bounds() {
    const a = P.audit(); group().traverse(m => {
      if (!m.isMesh) return;
      assert.ok(m.material.isMeshLambertMaterial); assert.ok(!m.material.normalMap);
      const p = m.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        assert.ok(Math.abs(p.getX(i)-a.center[0]) <= a.range+.01);
        assert.ok(Math.abs(p.getZ(i)-a.center[1]) <= a.range+.01);
      }
    });
  }
  bounds(); const stable = P.audit().builds; draw(); assert.equal(P.audit().builds, stable);
  const oldCells = new Set(group().children), oldBuilds = P.audit().builds;
  context.player.pos.x += 48; settle();
  assert.equal(group().children.filter(g => oldCells.has(g)).length, 20, 'Movement reuses 20 overlapping cells');
  assert.equal(P.audit().builds-oldBuilds, 5, 'Only the new row is built'); bounds();
  const beforeFar = P.audit().builds;
  const far = data.parts.findIndex(p => (Math.abs(p[0]-context.player.pos.x)>250 || Math.abs(p[2]-context.player.pos.z)>250) && p[12]<10 && p[14]<10);
  assert.ok(far >= 0); P.invalidate(far); settle(); assert.equal(P.audit().builds, beforeFar);
  // Use the same original wall and live destruction as the browser suite.
  const p = data.parts[4211], matrix = J.transform(p), at = new THREE.Vector3(p[0], p[1]-data.origin[1], p[2]);
  const from = new THREE.Vector3(0,0,5).applyMatrix4(matrix), to = new THREE.Vector3(0,0,-5).applyMatrix4(matrix);
  context.player.pos.copy(at); settle();
  const ray = new THREE.Raycaster(from, to.clone().sub(from).normalize(), 0, 10);
  function visibleWall() { scene.updateMatrixWorld(true); return ray.intersectObjects(group().children, true).length > 0; }
  assert.ok(visibleWall()); assert.ok(J.ray(from, to, .2) < .8);
  X.hit(at, 7); settle();
  assert.equal(visibleWall(), false); assert.ok(J.ray(from, to, .2) > .98);
  context.player.pos.set(400,10,400); settle(); context.player.pos.copy(at); settle(); assert.equal(visibleWall(), false);
  context.player.pos.set(900,100,900); X.restoreAll(); context.player.pos.copy(at); settle(); assert.ok(visibleWall());
  // Teleport while a job is incomplete, then change maps: no obsolete geometry survives.
  context.player.pos.set(-400,0,-400); draw(); context.player.pos.set(400,0,400); settle(); bounds();
  const lowImages = images;
  P.setEnabled(false); await J.ready; draw();
  assert.ok(fullCalls > 0); assert.equal(renderer.ratio, 1.5); assert.equal(renderer.shadowMap.enabled, true);
  assert.ok(images > lowImages, 'Full mode loads deferred normal/specular/distant textures');
  assert.equal(group(), undefined); assert.equal(storage.get('jj.potatoMode'), '0');
  P.setEnabled(true); draw(); J.clear(); assert.equal(P.audit().cells, 0); assert.equal(P.audit().pending, 0); assert.equal(J.root, null);
  console.log(JSON.stringify({frames, initialTriangles: initial.triangles, initialMeshes: initial.meshes, fullTriangles: initial.fullTriangles,
    reusedCells: 20, tests: 'nearby bounds, bounded cache, incremental work, texture deferral, movement, teleports, live destruction, restoration, full mode, cleanup'}, null, 2));
})().catch(e => { console.error(e); process.exitCode = 1; });
