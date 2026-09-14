/* CPU integration: real map colliders, Three objects, ragdolls and two peers. */
'use strict';
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const zlib = require('node:zlib'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..'), read = p => fs.readFileSync(path.join(root, p), 'utf8');
(async () => {
  const THREE = await import(require('node:url').pathToFileURL(path.join(root, 'jujutsu/three.module.min.js')).href);
  const data = JSON.parse(zlib.gunzipSync(Buffer.from(read('jujutsu/jjs-data.js').match(/atob\('([^']+)'\)/)[1], 'base64')));
  const source = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root, 'jujutsu/jjs/source.json.gz'))));
  const packed = source.parts.filter(p => !p.path.startsWith('Workspace.Map.Data.'));
  assert.match(packed[7951].path, /StationControl.ButtonTrain.Button$/);
  for (const i of [7951, 7946, 7948]) packed[i].cf.slice(0, 3).forEach((v, k) => assert.ok(Math.abs(v - data.parts[i][k]) < .001));
  function client(id, host = false, online = false) {
    let clock = 0;
    const listeners = {}, packets = [], effects = [];
    function element() { return {style: {}, children: [], listeners: {}, appendChild(e) {this.children.push(e);}, setAttribute() {}, addEventListener(t, fn) {this.listeners[t] = fn;}, getBoundingClientRect() {return {left: 0, top: 0, width: 800, height: 600};}}; }
    function Enemy() {
      this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3(); this.hp = 100; this.dead = false;
      this.rig = {root: new THREE.Group(), body: new THREE.Group(), hipsBaseY: 2.6};
    }
    Enemy.prototype.respawn = function () {this.dead = false; this.hp = 100;};
    Enemy.prototype.update = function () {};
    Enemy.prototype.unframe = function () {};
    const player = new Enemy(), scene = new THREE.Scene();
    const c = vm.createContext({THREE, scene, player, enemies: [], Enemy, console, atob,
      JJS_DATA: {...data, visual: {...data.visual, groups: []}, guis: []},
      performance: {now: () => clock * 1000}, document: {body: element(), createElement: element},
      renderer: {render() {}, domElement: element()}, camera: new THREE.PerspectiveCamera(60, 4 / 3, .1, 2000),
      localStorage: {getItem() {return '1';}}, gameInputActive: () => true, typingInUI: () => false,
      addFx: e => effects.push(e), updatePlayer() {}, resetPose() {}, collideWorld() {},
      showSplash(...args) {c.splash = args;},
      addEventListener(t, fn) {(listeners[t] ||= []).push(fn);},
      MPJJ: {id, host, active: online, code: 'ROOM', fighters: {}, deaths: 0, relay: {pub(m) {packets.push(JSON.parse(JSON.stringify(m)));}}, environmentKO() {this.deaths++;}},
      JJAISERVER: {environmentKO(e) {e.ai.deaths = (e.ai.deaths || 0) + 1;}},
      JJGORE: {clear(e) {e.__death = null;}},
    }); c.window = c;
    vm.runInContext(read('jujutsu/jjs.js'), c); c.JJJJS.build(); c.JJMAP = {id: 'jjs'};
    vm.runInContext(read('jujutsu/ragdoll.js'), c); vm.runInContext(read('jujutsu/train.js'), c);
    const T = c.JJTRAIN;
    function draw(t) {clock = t; c.renderer.render(scene, c.camera);}
    draw(0);
    // Find a real clear approach on the control-room floor.
    const bp = new THREE.Vector3(...T.audit().button); let found = false;
    for (const dx of [-4, 4, -2, 2]) for (const dz of [-4, 4, 0]) {
      const p = bp.clone().add(new THREE.Vector3(dx, 0, dz)); const floor = c.JJJJS.floor(p, bp.y);
      if (!Number.isFinite(floor) || bp.y - floor > 8) continue;
      const eye = p.clone().setY(floor + 3.8), target = bp.clone().addScaledVector(eye.clone().sub(bp).normalize(), .65);
      if (eye.distanceToSquared(bp) <= 100 && c.JJJJS.ray(eye, target, 0) >= .96) {player.pos.copy(p).setY(floor); found = true; break;}
    }
    assert.ok(found, 'Button must be reachable through actual station colliders');
    return {c, T, player, draw, packets, listeners, Enemy, effects};
  }
  const solo = client('solo'), a = solo.T.audit();
  assert.equal(a.drawGroups, 4);
  let stopped = false;
  solo.listeners.keydown[0]({code: 'KeyE', preventDefault() {}, stopImmediatePropagation() {stopped = true;}});
  assert.ok(stopped); assert.equal(solo.T.audit().run, 1); assert.equal(solo.T.request(), false, 'No duplicate train');
  const onTrack = (e, z = 300) => e.pos.set(218.5, a.trackFloor, z);
  const target = new solo.Enemy(); onTrack(target); target.ai = {id: 'bot'}; target.__death = {s: 'old'};
  const safe = new solo.Enemy(); safe.pos.set(185, a.trackFloor, 300);
  const upstairs = new solo.Enemy(); upstairs.pos.set(218.5, 0, 300);
  solo.c.enemies.push(target, safe, upstairs);
  solo.draw(4.999); assert.equal(solo.T.audit().visible, false); assert.equal(target.dead, false);
  solo.draw(5); assert.equal(solo.T.audit().visible, true);
  solo.draw(7.1); assert.equal(target.dead, true, 'Swept test catches a train crossing between frames');
  assert.equal(target.ai.deaths, 1); assert.ok(target.rag); assert.equal(target.__death, null);
  assert.equal(safe.dead, false); assert.equal(upstairs.dead, false);
  for (let i = 0; i < 100; i++) solo.c.JJRAG.step(target, .02);
  assert.ok(target.pos.y < -20, 'Ragdoll stays underground');
  solo.draw(9); assert.equal(solo.T.audit().visible, false); assert.equal(target.ai.deaths, 1);
  target.respawn(); assert.equal(target.trainCrash, undefined); assert.equal(target.rag, null);
  solo.draw(17); assert.equal(solo.T.request(), true, 'Button rearms after passage and cooldown');
  solo.c.JJMAP.id = 'plate'; solo.draw(18); assert.equal(solo.T.audit().run, 0); assert.equal(solo.T.audit().drawGroups, 0);

  const host = client('host', true, true), guest = client('guest', false, true);
  const remote = new host.Enemy(); remote.net = {id: 'guest'}; remote.pos.copy(guest.player.pos);
  host.c.MPJJ.fighters.guest = {e: remote};
  guest.T.receive({t: 'hi2', id: 'host', host: true});
  assert.equal(guest.T.request(), true); host.T.receive(guest.packets.pop());
  assert.equal(host.T.audit().run, 1); guest.T.receive(host.packets.pop());
  onTrack(remote); onTrack(guest.player);
  host.draw(4.9); guest.draw(4.9); host.packets.length = 0;
  host.draw(7.1); const hitPacket = host.packets.pop();
  assert.ok(hitPacket.hits.includes('human:guest')); assert.equal(guest.player.dead, false);
  host.draw(7.6); guest.draw(7.6); guest.T.receive(host.packets.pop());
  assert.equal(guest.player.dead, true, 'Repeated snapshot repairs a lost hit packet');
  assert.equal(guest.c.MPJJ.deaths, 1); assert.equal(guest.c.splash[0], 'CRASH');
  guest.T.receive(hitPacket); assert.equal(guest.c.MPJJ.deaths, 1, 'Old snapshots do not hit twice');
  guest.T.receive({...hitPacket, id: 'stranger', run: 900, seq: 900}); assert.equal(guest.T.audit().run, 1);
  guest.T.receive({...hitPacket, room: 'OTHER', run: 900, seq: 900}); assert.equal(guest.T.audit().run, 1);
  guest.T.receive({...hitPacket, run: 900, seq: 900, elapsed: NaN}); assert.equal(guest.T.audit().run, 1);
  const late = client('late', false, true);
  late.T.receive({t: 'hi2', id: 'host', host: true}); late.T.receive(hitPacket); late.draw(0);
  assert.equal(late.T.audit().visible, true, 'Late join sees train already passing');
  assert.equal(late.player.dead, false, 'Late join does not inherit another player hit');
  const crossing = client('crossing'); crossing.T.request();
  const runner = new crossing.Enemy(); runner.pos.set(180, a.trackFloor, 300); crossing.c.enemies.push(runner);
  crossing.draw(6.1); runner.pos.x = 255; crossing.draw(6.2);
  assert.equal(runner.dead, true, 'Actor crossing the train between frames is detected');
  host.draw(17); remote.dead = false; remote.pos.set(0, 0, 0);
  host.T.receive({t: 'tr-request', id: 'guest', room: 'ROOM', map: 'jjs'});
  assert.equal(host.T.audit().run, 1, 'Host rejects requests away from button');
  guest.c.MPJJ.code = 'NEW'; guest.draw(18); assert.equal(guest.T.audit().run, 0);
  console.log('PASS: real station button/rails, five-second delay, fast swept hits, safe platform/upstairs, underground ragdoll/respawn, cooldown, host validation, packet loss/replay, room/map cleanup.');
})().catch(e => {console.error(e); process.exitCode = 1;});
