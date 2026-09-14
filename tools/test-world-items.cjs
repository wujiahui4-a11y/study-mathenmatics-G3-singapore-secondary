/* Integration with real exported colliders, source surfaces and ragdoll code. */
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), zlib = require('node:zlib'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..'), read = p => fs.readFileSync(path.join(root, 'jujutsu', p), 'utf8');
(async () => {
  const THREE = await import(require('node:url').pathToFileURL(path.join(root, 'jujutsu/three.module.min.js')).href);
  const data = JSON.parse(zlib.gunzipSync(Buffer.from(read('jjs-data.js').match(/atob\('([^']+)'\)/)[1], 'base64')));
  function client(id, host = false, online = false) {
    let clock = 0, rng = 31;
    const listeners = {}, packets = [], elements = [];
    function element(tag) {
      const e = {tag, style: {}, children: [], listeners: {}, parentElement: {after() {}}, after() {}, value: '',
        appendChild(n) {this.children.push(n);}, setAttribute() {}, removeAttribute() {}, focus() {}, load() {}, pause() {this.paused = true;}, play() {this.paused = false; return Promise.resolve();},
        addEventListener(t, f) {this.listeners[t] = f;}, querySelectorAll() {return [element(), element(), element()];}, querySelector() {return element();},
        getContext() {return new Proxy({measureText() {return {width: 10};}}, {get(o, k) {return o[k] || (() => {});}});}};
      elements.push(e); return e;
    }
    function Enemy() {
      this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3(); this.hp = 100; this.dead = false; this.facing = 0; this.char = 'gojo';
      this.rig = {root: new THREE.Group(), body: new THREE.Group(), hipsBaseY: 2.6};
      for (const n of ['shoulderL','shoulderR','elbowL','elbowR','hipL','hipR','kneeL','kneeR']) this.rig[n] = new THREE.Group();
    }
    Enemy.prototype.respawn = function () {this.dead = false;}; Enemy.prototype.update = Enemy.prototype.damage = Enemy.prototype.unframe = function () {};
    const math = Object.create(Math); math.random = () => ((rng = (rng * 1664525 + 1013904223) >>> 0) / 4294967296);
    const c = vm.createContext({THREE, Math: math, URL, performance: {now: () => clock * 1000}, console, atob,
      scene: new THREE.Scene(), JJS_DATA: data, player: new Enemy(), enemies: [], Enemy, keys: {}, cds: {},
      document: {body: element('body'), createElement: element, getElementById: () => null, addEventListener() {}, hidden: false},
      renderer: {domElement: element('canvas'), render() {}, capabilities: {getMaxAnisotropy: () => 1}},
      Image: class {set src(v) {this.value = v; if (v?.startsWith('data:image/jpeg') && this.onload) this.onload();}},
      localStorage: {getItem: () => '1'}, gameInputActive: () => true, typingInUI: () => false,
      addEventListener(t, fn) {(listeners[t] ||= []).push(fn);}, addFx() {}, resetPose() {}, collideWorld() {},
      updatePlayer() {}, punch() {}, stepAction() {}, explodeRed() {}, resolveActorWorld() {},
      aimDir: () => new THREE.Vector3(0, .08, 1), JJMOVE: {cancel() {}, driving: () => false}, JJFIGHT: {clearInput() {}},
      MPJJ: {id, host, active: online, code: 'TEST', fighters: {}, relay: {pub(m) {packets.push(JSON.parse(JSON.stringify(m)));}}}});
    c.window = c;
    for (const file of ['jjs.js','destruction.js','ragdoll.js','interaction-data.js']) vm.runInContext(read(file), c);
    c.JJJJS.build(); c.JJMAP = {id: 'jjs'};
    for (const file of ['world-items.js','screens.js']) vm.runInContext(read(file), c);
    const W = c.JJIWORLD;
    function draw(dt = .05) {clock += dt; c.renderer.render(c.scene, null);}
    function advance(seconds) {for (let n = 0; n < seconds / .05; n++) draw();}
    draw(); draw();
    return {c, W, draw, advance, packets, Enemy, elements, listeners};
  }
  const solo = client('solo'), {c, W} = solo, J = c.JJJJS, D = c.JJINTERACTION_DATA;
  assert.equal(D.ladders.length, 12); assert.equal(D.bins.length, 19); assert.equal(D.screens.length, 2);
  assert.ok(W.audit().items.some(i => i.kind === 'tnt'), 'A random drop appears');
  solo.advance(3); const drop = W.audit().items.find(i => i.kind === 'tnt');
  assert.equal(drop.state, 'world', 'Random drop lands on real map support');
  function approach(p, available = () => true) {
    for (let radius = 3; radius <= 6; radius++) for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
      const pos = new THREE.Vector3(p[0] + Math.cos(a) * radius, p[1] + 3, p[2] + Math.sin(a) * radius);
      const floor = J.floor(pos, pos.y); if (!Number.isFinite(floor) || Math.abs(floor - p[1]) > 7) continue;
      pos.y = floor + .04; if (J.occupied(pos, .85, 5.1)) continue;
      c.player.pos.copy(pos); if (W.reachable(c.player, new THREE.Vector3(...p)) && available()) return pos.clone();
    }
    return null;
  }
  assert.ok(approach(drop.p)); assert.equal(W.pickup(), true); assert.equal(W.audit().held, drop.id);
  const blastTarget = new solo.Enemy(); blastTarget.pos.copy(c.player.pos); c.enemies.push(blastTarget);
  c.aimDir = () => new THREE.Vector3(0, -1, 0);
  solo.draw(.3); assert.equal(W.consumeM1(), true); assert.equal(W.audit().held, '');
  assert.equal(W.consumeM1(), false, 'Normal M1 resumes after throw');
  assert.equal(W.audit().items.find(i => i.id === drop.id).state, 'flying');
  solo.advance(2); assert.ok(!W.audit().items.find(i => i.id === drop.id) || W.audit().items.find(i => i.id === drop.id).state === 'spent');
  assert.ok(blastTarget.rag, 'TNT burst ragdolls nearby actors'); assert.equal(blastTarget.hp, 100);
  c.enemies.length = 0; c.aimDir = () => new THREE.Vector3(0, .08, 1);
  c.JJRAG.stop(c.player);

  let selectedBin = -1;
  for (let n = 0; n < D.bins.length; n++) if (approach(D.bins[n].p)) {selectedBin = n; break;}
  const binApproach = c.player.pos.clone();
  assert.ok(selectedBin >= 0); solo.draw(.4); assert.equal(W.pickup(), true);
  const bin = D.bins[selectedBin]; assert.equal(W.audit().held, 'bin:' + selectedBin);
  assert.ok(bin.ids.every(id => !J.originals.has(id) || J.originals.get(id).disabled), 'Picked bin collision is removed');
  const hiddenOwners = new Set(bin.ids.map(i => i + 1)); let removedTriangles = 0;
  for (const m of J.visualMeshes) for (let t = 0; t < m.userData.owners.length; t++) if (hiddenOwners.has(m.userData.owners[t])) {
    assert.equal(m.geometry.index.array[t * 3], 0, 'Picked bin triangles are hidden'); removedTriangles++;
  }
  assert.ok(removedTriangles > 0);
  // Throw in a clear lane to verify a bin strikes a character without killing it.
  let lane = null;
  for (let x = -180; x <= 180 && !lane; x += 20) for (let z = -100; z <= 100 && !lane; z += 20) {
    const p = new THREE.Vector3(x, 10, z), floor = J.floor(p, 10); if (!Number.isFinite(floor) || floor < -2) continue;
    p.y = floor + .04;
    if ([0, 3, 6, 9, 12].every(d => !J.occupied(p.clone().add(new THREE.Vector3(0, 0, d)), 1.7, 7))) lane = p;
  }
  assert.ok(lane); c.player.pos.copy(lane); c.player.facing = 0;
  const enemy = new solo.Enemy(); enemy.pos.copy(lane).add(new THREE.Vector3(0, 0, 9)); c.enemies.push(enemy);
  solo.draw(.4); W.consumeM1(); solo.advance(.4);
  assert.ok(enemy.rag, 'Thrown bin causes ragdoll: ' + JSON.stringify(W.audit().items.find(i => i.id === 'bin:' + selectedBin))); assert.equal(enemy.dead, false); assert.equal(enemy.hp, 100);
  for (let n = 0; n < 260; n++) c.JJRAG.step(enemy, .025);
  assert.equal(enemy.rag, null, 'Item ragdoll recovers automatically');

  let climbed = -1;
  for (let n = 0; n < D.ladders.length; n++) {
    const b = D.ladders[n]; if (b.min[1] < 0) continue;
    for (const sign of [1, -1]) {
      const normal = new THREE.Vector3(...b.n).multiplyScalar(sign);
      c.player.pos.set(b.p[0], b.min[1] + 1, b.p[2]).addScaledVector(normal, 1.45);
      c.player.action = null; c.player.facing = Math.atan2(-normal.x, -normal.z); c.keys.KeyW = true;
      W.beforeStep(.05);
      if (W.driving()) {climbed = n; break;}
    }
    if (climbed >= 0) break;
  }
  assert.ok(climbed >= 0, 'Exported ladder is climbable');
  const bottom = c.player.pos.y; for (let n = 0; n < 30; n++) W.beforeStep(.05);
  assert.ok(c.player.pos.y > bottom + 5, 'W moves the player up the ladder');
  W.impact(c.player.pos.clone().add(new THREE.Vector3(0, 3, 0)), 3);
  assert.ok(W.audit().broken.includes(climbed)); assert.equal(W.driving(), false); assert.ok(c.player.rag);
  assert.ok(D.ladders[climbed].ids.every(id => !J.originals.has(id) || J.originals.get(id).disabled), 'Whole ladder disappears from collision');
  c.JJRAG.stop(c.player); c.keys.KeyW = false;

  // Both existing control machines must be reachable from actual supported floors.
  for (let n = 0; n < 2; n++) {
    const p = data.parts[D.screens[n].control].slice(0, 3).map((v, k) => v - data.origin[k]);
    assert.ok(approach(p, () => c.JJBROADCAST.nearConsole(c.player) === n), 'Existing screen control ' + n + ' can be reached');
  }
  const B = c.JJBROADCAST;
  assert.equal(B.openNearby(), true); assert.equal(c.gameInputActive(), false, 'Console typing blocks combat');
  assert.equal(B.validURL('https://example.org/movie.mp4'), true); assert.equal(B.validURL('javascript:alert(1)'), false);
  assert.equal(B.validURL('https://example.org/watch?id=2'), false); assert.equal(B.validURL('https://127.0.0.1/a.mp4'), false);
  B.receive({t: 'wi-media-set', id: 'local', screen: 1, kind: 'video', url: 'https://example.org/movie.mp4'});
  assert.equal(B.snapshot()[1].kind, 'video');
  B.clear(); assert.equal(c.gameInputActive(), true);
  c.JJMAP.id = 'plate'; solo.draw(); assert.equal(W.audit().items.length, 0); assert.equal(B.audit().views, 0);
  console.log('PASS local: drops, M1 replacement, real bin visual/collision removal, ragdoll recovery, ladder climb/break, reachable consoles, URL validation, cleanup.');

  const host = client('host', true, true), guest = client('guest', false, true);
  const remote = new host.Enemy(); remote.net = {id: 'guest'}; host.c.MPJJ.fighters.guest = {e: remote};
  guest.W.receive({t: 'hi2', id: 'host', host: true});
  function deliver(from, to) {for (const m of from.packets.splice(0)) to.W.receive(m);}
  host.W.snapshot(); deliver(host, guest);
  assert.equal(guest.W.audit().items.length, host.W.audit().items.length);
  const binState = host.W.audit().items.find(i => i.kind === 'bin');
  remote.pos.set(binState.p[0] + 3, binState.p[1] - 2, binState.p[2]); guest.c.player.pos.copy(remote.pos);
  guest.W.receive({t: 'wi-state', id: 'stranger', room: 'TEST', map: 'jjs', epoch: 'bad', seq: 999, items: [], broken: [], hits: []});
  assert.equal(guest.W.audit().epoch, host.W.audit().epoch, 'Only host snapshots are accepted');
  host.W.receive({t: 'wi-pick', id: 'guest', room: 'OTHER', map: 'jjs', epoch: host.W.epoch, item: binState.id});
  assert.equal(host.W.audit().items.find(i => i.id === binState.id).state, 'home');
  remote.pos.set(0, 0, 0);
  host.W.receive({t: 'wi-pick', id: 'guest', room: 'TEST', map: 'jjs', epoch: host.W.epoch, item: binState.id});
  assert.equal(host.W.audit().items.find(i => i.id === binState.id).state, 'home', 'Host rejects distant pickup');
  host.draw(.3); remote.pos.copy(binApproach); guest.c.player.pos.copy(remote.pos);
  host.W.receive({t: 'wi-pick', id: 'guest', room: 'TEST', map: 'jjs', epoch: host.W.epoch, item: 'bin:' + selectedBin});
  deliver(host, guest); assert.equal(guest.W.audit().held, 'bin:' + selectedBin, 'Host grants reachable pickup');
  const state = {t: 'wi-state', id: 'host', room: 'TEST', map: 'jjs', epoch: host.W.epoch, seq: 9000, items: host.W.audit().items,
    broken: [], hits: [{event: 'test:blast', target: 'guest', v: [12, 15, 0]}], screens: [null, null]};
  guest.W.receive(state); assert.ok(guest.c.player.rag, 'Human receives room knockback'); const rag = guest.c.player.rag;
  guest.W.receive({...state, seq: 9001}); assert.equal(guest.c.player.rag, rag, 'Repeated hit snapshot does not restart ragdoll');
  guest.W.receive({...state, seq: 8999, hits: [{event: 'old', target: 'guest', v: [10, 5, 0]}]}); assert.equal(guest.c.player.rag, rag, 'Old snapshot is ignored');
  guest.c.JJRAG.stop(guest.c.player);
  // New peer obtains the current host state, including photos after a missed chunk.
  const viewer = client('viewer', false, true); host.c.MPJJ.fighters.viewer = {e: new host.Enemy()};
  viewer.W.receive({t: 'hi2', id: 'host', host: true}); host.W.snapshot(); deliver(host, viewer);
  const controller = D.screens[1].control, cp = data.parts[controller].slice(0, 3).map((v, k) => v - data.origin[k]);
  c.JJMAP.id = 'jjs'; assert.ok(approach(cp)); remote.pos.copy(c.player.pos);
  const image = 'data:image/jpeg;base64,' + 'A'.repeat(12000), chunks = [image.slice(0, 8000), image.slice(8000)];
  for (let n = 0; n < 2; n++) host.W.receive({t: 'wi-media-upload', id: 'guest', room: 'TEST', map: 'jjs', epoch: host.W.epoch, asset: 'photo1', screen: 1, count: 2, index: n, text: chunks[n]});
  assert.equal(host.c.JJBROADCAST.snapshot()[1].kind, 'image'); deliver(host, viewer);
  host.advance(.5); const assetPackets = host.packets.splice(0).filter(m => m.t === 'wi-media-asset');
  assert.equal(assetPackets.length, 2); viewer.W.receive(assetPackets[1]); assert.equal(viewer.c.JJBROADCAST.audit().assets, 0);
  viewer.W.receive(assetPackets[0]); assert.equal(viewer.c.JJBROADCAST.audit().assets, 1, 'Out-of-order photo chunks reassemble');
  const photoId = host.c.JJBROADCAST.snapshot()[1].id;
  for (let n = 0; n < 2; n++) host.W.receive({t: 'wi-media-upload', id: 'guest', room: 'TEST', map: 'jjs', epoch: host.W.epoch, asset: 'photo1', screen: 1, count: 2, index: n, text: chunks[n]});
  assert.equal(host.c.JJBROADCAST.snapshot()[1].id, photoId, 'Upload retries publish once');
  host.W.receive({t: 'wi-media-set', id: 'viewer', room: 'TEST', map: 'jjs', epoch: host.W.epoch, screen: 1, kind: 'video', url: 'https://example.org/movie.mp4'});
  assert.equal(host.c.JJBROADCAST.snapshot()[1].id, photoId, 'Distant peer cannot replace screen');
  host.W.impact(new THREE.Vector3(...host.c.JJINTERACTION_DATA.ladders[4].p), 3); deliver(host, viewer);
  assert.ok(viewer.W.audit().broken.includes(4), 'Ladder break replicates');
  guest.c.MPJJ.code = 'NEW'; guest.draw(); assert.equal(guest.W.audit().items.length, 0);
  console.log('PASS network: authority, range validation, shared pickup, human ragdoll/replay, photo chunks/retries, console ownership, ladder replication and room reset.');
})().catch(e => {console.error(e); process.exitCode = 1;});
