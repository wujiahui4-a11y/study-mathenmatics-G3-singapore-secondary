/* Room-owned pickups, cartoon throwables and the exported city's ladders. */
(function () {
  'use strict';
  const J = JJJJS, D = JJINTERACTION_DATA, V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const items = new Map(), broken = new Set(), masks = new Set(), models = new Map(), seen = new Set(), rates = new Map();
  let root = null, sourceRoot = null, room = null, hostId = null, epoch = '', retired = new Set();
  let clock = 0, lastFrame = 0, spawnAt = 0, serial = 0, sequence = 0, rx = -1, lastSend = 0, lastRequest = -10;
  let hits = [], effects = [], climb = null, lastRig = player.rig, lastChar = player.char;
  const now = () => performance.now() / 1000;
  const online = () => !!window.MPJJ?.active;
  const authority = () => !online() || !!MPJJ.host;
  const active = () => window.JJMAP?.id === 'jjs' && !!J.root;
  const localId = () => online() ? MPJJ.id : 'local';
  const validV = a => Array.isArray(a) && a.length === 3 && a.every(n => Number.isFinite(n) && Math.abs(n) < 4000);
  const actor = id => id === localId() ? player : MPJJ.fighters[id]?.e;
  const available = e => e && !e.dead && !e.rag && !e.action && !(e.frameT > 0) && !(e.stunT > 0);
  const allActors = () => [[localId(), player], ...Object.entries(online() ? MPJJ.fighters : {}).map(([id, f]) => [id, f.e]), ...enemies.filter(e => !e.net && (!e.ai || !e.ai.remote)).map((e, i) => [e.ai ? 'ai:' + e.ai.id : 'dummy:' + i, e])];
  const heldBy = id => [...items.values()].find(i => i.state === 'held' && i.owner === id);
  const resources = [], own = o => (resources.push(o), o);
  let sharedBox = null, sharedMaterials = null, maskKey = '';
  const ui = document.createElement('div'), hint = document.createElement('div'), use = document.createElement('button'), throwButton = document.createElement('button');
  ui.style.cssText = 'position:fixed;bottom:15%;left:50%;transform:translateX(-50%);z-index:36;text-align:center;color:#fff;font:700 14px system-ui;pointer-events:none;display:none';
  for (const b of [use, throwButton]) {b.type = 'button'; b.style.cssText = 'pointer-events:auto;background:#17273deb;color:white;border:1px solid #b0d6ff;border-radius:8px;padding:11px 16px;margin:4px;font:inherit';ui.appendChild(b);}
  hint.style.cssText = 'background:#142033d9;border-radius:6px;padding:7px'; ui.appendChild(hint); document.body.appendChild(ui);
  throwButton.textContent = 'Throw · M1';
  function send(m) { if (online() && MPJJ.relay) MPJJ.relay.pub(Object.assign({id: MPJJ.id, room: MPJJ.code, map: 'jjs', epoch}, m)); }
  function closeClimb() {
    if (player.action?.type === 'wi_climb') player.action = null;
    climb = null; delete player.worldClimb; player.onGround = false; player.__jjsLast = player.pos.clone();
  }
  function clear() {
    closeClimb();
    if (window.JJBROADCAST) JJBROADCAST.clear();
    effects.forEach(disposeEffect);
    if (root) scene.remove(root);
    for (const i of masks) if (window.JJDESTRUCT && sourceRoot === J.root) JJDESTRUCT.setRemoved([i], false);
    resources.forEach(o => o.dispose()); resources.length = 0;
    sharedBox = sharedMaterials = null; maskKey = '';
    for (const [, e] of allActors()) if (e?.worldRag) {JJRAG.stop(e); delete e.worldRag;}
    root = null; items.clear(); broken.clear(); masks.clear(); models.clear(); seen.clear(); rates.clear(); hits = []; effects = [];
    ui.style.display = 'none'; rx = -1;
  }
  function context() {
    const key = online() ? MPJJ.code : 'offline';
    if (room !== key || sourceRoot !== J.root || !active()) {
      const roomChanged = room !== key;
      if (epoch) {retired.add(epoch); if (retired.size > 16) retired.delete(retired.values().next().value);}
      clear(); room = key; sourceRoot = J.root;
      if (roomChanged) {hostId = null; retired.clear();}
      epoch = authority() ? Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8) : '';
      clock = 0; lastFrame = now(); lastSend = -10; spawnAt = 0;
    }
    if (!active()) return false;
    if (!root) {
      root = new THREE.Group(); root.name = 'City interactions'; scene.add(root);
      if (authority()) D.bins.forEach((b, n) => items.set('bin:' + n, {id: 'bin:' + n, kind: 'bin', bin: n, p: V(...b.p), v: V(), state: 'home', owner: '', age: 0}));
    }
    return true;
  }
  function reachable(e, p, range = 7) {
    if (!e?.pos || e.dead) return false;
    const eye = e.pos.clone().add(V(0, 3, 0)), d = eye.distanceTo(p);
    return d < range && J.ray(eye, p.clone().lerp(eye, Math.min(1, 1.8 / Math.max(.01, d))), 0) >= .96;
  }
  function nearest() {
    let best = null, distance = 7;
    for (const i of items.values()) if ((i.state === 'home' || i.state === 'world') && reachable(player, i.p)) {
      const d = player.pos.distanceTo(i.p); if (d < distance) {distance = d; best = i;}
    }
    return best;
  }
  function request(m) {
    if (!context() || now() - lastRequest < .22) return false;
    lastRequest = now();
    if (authority()) command(Object.assign({id: localId(), epoch}, m)); else send(m);
    return true;
  }
  function pickup() {
    if (!gameInputActive() || !available(player) || heldBy(localId())) return false;
    const i = nearest(); return !!i && request({t: 'wi-pick', item: i.id});
  }
  function consumeM1() {
    if (!active() || !heldBy(localId())) return false;
    if (gameInputActive() && available(player)) {
      const direction = typeof aimDir === 'function' ? aimDir() : V(Math.sin(player.facing), .1, Math.cos(player.facing));
      request({t: 'wi-throw', dir: direction.normalize().toArray()});
    }
    return true;
  }
  function mask() {
    if (!window.JJDESTRUCT) return;
    const key = [...broken].join(',') + '/' + [...items.values()].filter(i => i.kind === 'bin' && i.state !== 'home').map(i => i.bin).join(',');
    if (key === maskKey) return; maskKey = key;
    const desired = new Set();
    for (const n of broken) D.ladders[n].ids.forEach(id => desired.add(id));
    for (const i of items.values()) if (i.kind === 'bin' && i.state !== 'home') D.bins[i.bin].ids.forEach(id => desired.add(id));
    const added = [...desired].filter(id => !masks.has(id)), removed = [...masks].filter(id => !desired.has(id));
    if (added.length) JJDESTRUCT.setRemoved(added, true);
    if (removed.length) JJDESTRUCT.setRemoved(removed, false);
    masks.clear(); desired.forEach(id => masks.add(id));
  }
  function breakLadder(n) {
    if (!Number.isInteger(n) || !D.ladders[n] || broken.has(n)) return false;
    broken.add(n); mask();
    const b = D.ladders[n]; flash(V(b.p[0], Math.max(b.min[1], Math.min(b.max[1], player.pos.y + 3)), b.p[2]), 0xb9c4d1, 4);
    // A few loose rungs make the instant break visible without a large debris burst.
    for (let k = 0; k < 6; k++) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.6, .16, .16), new THREE.MeshLambertMaterial({color: 0xa7b2c0, transparent: true}));
      mesh.position.set(b.p[0], Math.max(b.min[1], Math.min(b.max[1], player.pos.y + k - 1)), b.p[2]);
      root.add(mesh); effects.push({mesh, t: .8, size: 1, velocity: V((k % 2 ? 1 : -1) * 3, 2 + k * .2, (k % 3 - 1) * 3)});
    }
    while (effects.length > 12) disposeEffect(effects.shift());
    if (climb?.n === n) {closeClimb(); knock(player, V(0, 3, 4), epoch + ':ladder:' + n);}
    return true;
  }
  function ladderDistance(p, b) {
    const q = V(...b.p); q.y = Math.max(b.min[1], Math.min(b.max[1], p.y)); return q.distanceTo(p);
  }
  function impact(pos, radius = 4) {
    if (!context()) return;
    const p = pos.clone ? pos : V(pos.x, pos.y, pos.z);
    D.ladders.forEach((b, n) => {
      if (!broken.has(n) && ladderDistance(p, b) < Math.min(18, radius) + 1) {
        if (authority()) {breakLadder(n); snapshot();}
        else request({t: 'wi-break', ladder: n});
      }
    });
  }
  function command(m) {
    const e = actor(m.id);
    if (!authority() || !e || !active()) return false;
    const key = m.id + ':' + m.t, last = rates.get(key) ?? -10;
    if (clock - last < .15) return false; rates.set(key, clock);
    if (m.t === 'wi-pick') {
      const i = items.get(m.item);
      if (!available(e) || heldBy(m.id) || !i || !['home', 'world'].includes(i.state) || !reachable(e, i.p)) return false;
      i.state = 'held'; i.owner = m.id; i.age = 0; i.v.set(0, 0, 0);
      if (e === player && window.JJFIGHT) JJFIGHT.clearInput();
      mask();
    } else if (m.t === 'wi-throw') {
      const i = heldBy(m.id);
      if (!i || !available(e) || !validV(m.dir)) return false;
      const dir = V(...m.dir); if (dir.lengthSq() < .25 || dir.lengthSq() > 2) return false; dir.normalize();
      const origin = e.pos.clone().add(V(0, 3.4, 0));
      i.p.copy(origin); i.v.copy(dir).multiplyScalar(i.kind === 'tnt' ? 36 : 43); i.v.y += 7;
      i.state = 'flying'; i.age = 0;
    } else if (m.t === 'wi-drop') {
      const i = heldBy(m.id); if (!i) return false;
      i.state = 'world'; i.owner = ''; i.age = 0; i.p.copy(e.pos).add(V(0, 2, 0)); i.v.set(0, 0, 0);
    } else if (m.t === 'wi-break') {
      const b = D.ladders[m.ladder];
      if (!b || e.dead || e.rag || ladderDistance(e.pos.clone().add(V(0, 3, 0)), b) > 7) return false;
      if (!breakLadder(m.ladder)) return false;
    } else return false;
    snapshot(); return true;
  }
  function spawn() {
    if ([...items.values()].filter(i => i.kind === 'tnt').length >= 6) return;
    for (let attempt = 0; attempt < 30; attempt++) {
      const base = J.spawn(Math.floor(Math.random() * J.data.spawns.length));
      const p = V(base.x + (Math.random() - .5) * 110, base.y + 30, base.z + (Math.random() - .5) * 110);
      const ground = J.floor(p, p.y); if (!Number.isFinite(ground) || ground < -85) continue;
      p.y = ground + 1.1;
      if (J.occupied(p.clone().add(V(0, .1, 0)), 1.1, 2.3)) continue;
      const ceiling = J.ceiling(p, p.y + 2); const height = Math.min(24, Number.isFinite(ceiling) ? ceiling - p.y - 2 : 24);
      p.y += Math.max(0, height);
      const id = 'drop:' + ++serial;
      items.set(id, {id, kind: 'tnt', p, v: V(), state: 'falling', owner: '', age: 0, bin: -1}); return;
    }
  }
  function knock(e, velocity, event) {
    if (!e || e.dead || e.worldRag?.event === event) return;
    if (e === player) {closeClimb(); if (window.JJMOVE) JJMOVE.cancel('item hit'); if (window.JJFIGHT) JJFIGHT.clearInput();}
    if (e.ai && window.JJAIKITS) JJAIKITS.cancel(e);
    if (e === player && e.frameT > 0 && typeof unframePlayer === 'function') unframePlayer(false);
    else if (e.unframe) e.unframe(false);
    e.action = e.bcFall = e.react = null; e.blocking = false; e.frameT = e.anchorT = e.lockT = 0;
    JJRAG.stop(e);
    const floor = J.floor(e.pos, e.pos.y + .5);
    e.worldRag = {event, floor: Number.isFinite(floor) ? floor : e.pos.y}; e.vel.copy(velocity);
    JJRAG.start(e, velocity, 1.15);
  }
  function syncActor(e, event, ladder) {
    if (typeof event === 'string' && event.length > 0 && event.length < 100 && !e.dead) {
      if (e.worldRag?.event !== event) knock(e, e.vel.clone().setY(Math.max(5, e.vel.y)), event);
    } else if (e.worldRag) JJRAG.stop(e);
    e.worldClimb = Number.isInteger(ladder) && D.ladders[ladder] && !broken.has(ladder) ? ladder : undefined;
  }
  function addHit(id, e, at, power, kind) {
    const d = e.pos.clone().sub(at).setY(0); if (d.lengthSq() < .01) d.set(1, 0, 0);
    d.normalize().multiplyScalar(power).setY(kind === 'tnt' ? 15 : 10);
    const h = {event: epoch + ':' + ++serial, target: id, v: d.toArray(), age: 0}; hits.push(h); applyHit(h);
  }
  function applyHit(h) {
    if (seen.has(h.event)) return;
    let e = actor(h.target);
    if (h.target.startsWith('ai:')) e = enemies.find(e => e.ai && String(e.ai.id) === h.target.slice(3));
    if (h.target.startsWith('dummy:') && authority()) e = allActors().find(a => a[0] === h.target)?.[1];
    if (!e) return;
    seen.add(h.event); if (seen.size > 256) seen.delete(seen.values().next().value);
    knock(e, V(...h.v), h.event);
  }
  function flash(p, color, size) {
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshBasicMaterial({color, transparent: true, opacity: .7, wireframe: true, depthWrite: false}));
    mesh.position.copy(p); root.add(mesh); effects.push({mesh, t: .45, size});
    while (effects.length > 12) disposeEffect(effects.shift());
  }
  function disposeEffect(e) {root?.remove(e.mesh); e.mesh.geometry.dispose(); e.mesh.material.dispose();}
  function detonate(i) {
    if (i.kind === 'tnt') {
      flash(i.p, 0xffbb55, 14);
      for (const [id, e] of allActors()) if (e && !e.dead && e.pos.clone().add(V(0, 2.5, 0)).distanceTo(i.p) < 14 && J.ray(i.p, e.pos.clone().add(V(0, 2.5, 0)), 0) > .92) addHit(id, e, i.p, 25, 'tnt');
      impact(i.p, 12);
    }
    i.state = 'spent'; i.age = 0; i.v.set(0, 0, 0);
    snapshot();
  }
  function sweepActor(a, b, e, radius) {
    const center = e.pos.clone().add(V(0, 2.55, 0));
    const closest = new THREE.Line3(a, b).closestPointToPoint(center, true, V());
    return Math.hypot(closest.x - center.x, closest.z - center.z) < radius + 1 && Math.abs(closest.y - center.y) < radius + 2.55;
  }
  function simulate(dt) {
    for (const i of items.values()) {
      i.age += dt;
      if (i.state === 'held') {
        const e = actor(i.owner);
        if (!e || e.dead || e.rag || i.age > 90) {i.state = 'falling'; i.owner = ''; i.age = 0; i.v.set(0, 0, 0);}
        else i.p.copy(e.pos).add(V(0, 3, 0));
      }
      if (['flying', 'falling', 'world'].includes(i.state)) {
        const flying = i.state === 'flying'; i.v.y -= 30 * dt;
        const next = i.p.clone().addScaledVector(i.v, dt), fraction = J.ray(i.p, next, i.kind === 'bin' ? 1.1 : .65);
        const ground = J.floor(next, i.p.y + 1.5), bottom = next.y - (i.kind === 'bin' ? 2 : 1);
        let hit = false;
        if (flying && i.kind === 'bin') for (const [id, e] of allActors()) {
          if (!e || e.dead || id === i.owner && i.age < .25) continue;
          const end = i.p.clone().lerp(next, fraction);
          if (sweepActor(i.p, end, e, 1.6)) {addHit(id, e, i.p, 24, 'bin'); hit = true; break;}
        }
        const wall = fraction < 1 - .1 / Math.max(.001, i.p.distanceTo(next)) - .0001;
        i.p.lerp(next, wall ? fraction : 1);
        if (flying && (wall || hit || bottom <= ground || i.age > (i.kind === 'tnt' ? 1.6 : 3))) {
          if (wall) impact(i.p, 3); detonate(i);
        } else if (bottom <= ground || wall) {i.p.y = Math.max(i.p.y, ground + (i.kind === 'bin' ? 2 : 1)); i.v.set(0, 0, 0); i.state = 'world';}
      }
      if (i.kind === 'tnt' && (i.state === 'spent' && i.age > 1 || i.age > 80 && i.state !== 'held' || i.p.y < -120)) items.delete(i.id);
      if (i.kind === 'bin' && i.state === 'spent' && i.age > 35) {i.p.set(...D.bins[i.bin].p); i.state = 'home'; i.owner = ''; i.age = 0;}
    }
    hits.forEach(h => h.age += dt); hits = hits.filter(h => h.age < 5).slice(-64);
    if (clock >= spawnAt) {spawn(); spawnAt = clock + 12;}
    mask();
  }
  function snapshot() {
    if (!authority() || !active()) return;
    lastSend = now();
    send({t: 'wi-state', seq: ++sequence, items: [...items.values()].map(i => ({id: i.id, kind: i.kind, bin: i.bin, p: i.p.toArray(), v: i.v.toArray(), state: i.state, owner: i.owner, age: i.age})), broken: [...broken], hits, screens: window.JJBROADCAST ? JJBROADCAST.snapshot() : []});
  }
  function receive(m) {
    context();
    if (!online()) return false;
    if (m.t === 'hi' || m.t === 'hi2') {
      if (m.host && !MPJJ.host && (!hostId || hostId === m.id)) hostId = m.id;
      if (authority()) snapshot();
      return false;
    }
    if (typeof m.t !== 'string' || !m.t.startsWith('wi-')) return false;
    if (!active() || m.room !== MPJJ.code || m.map !== 'jjs' || m.to && m.to !== MPJJ.id) return true;
    if (m.t === 'wi-state') {
      if (authority() || m.id !== hostId || typeof m.epoch !== 'string' || m.epoch.length > 60 || retired.has(m.epoch) || !Number.isSafeInteger(m.seq) || m.epoch === epoch && m.seq <= rx) return true;
      if (!Array.isArray(m.items) || m.items.length > 30 || !Array.isArray(m.broken) || m.broken.length > D.ladders.length || !Array.isArray(m.hits) || m.hits.length > 64) return true;
      if (!m.items.every(i => typeof i.id === 'string' && i.id.length < 60 && ['bin', 'tnt'].includes(i.kind) && validV(i.p) && validV(i.v) && ['held','home','world','falling','flying','spent'].includes(i.state) && typeof i.owner === 'string' && i.owner.length < 80 && Number.isFinite(i.age) && (i.kind !== 'bin' || Number.isInteger(i.bin) && D.bins[i.bin]))) return true;
      if (!m.broken.every(n => Number.isInteger(n) && D.ladders[n]) || !m.hits.every(h => typeof h.event === 'string' && h.event.length < 100 && typeof h.target === 'string' && h.target.length < 100 && validV(h.v))) return true;
      if (epoch !== m.epoch) {if (epoch) retired.add(epoch); epoch = m.epoch; broken.clear(); seen.clear();}
      rx = m.seq;
      m.items.forEach(i => {if (i.kind === 'tnt' && i.state === 'spent' && items.get(i.id)?.state !== 'spent') flash(V(...i.p), 0xffbb55, 14);});
      items.clear(); m.items.forEach(i => items.set(i.id, {...i, p: V(...i.p), v: V(...i.v)}));
      m.broken.forEach(n => breakLadder(n)); mask(); m.hits.forEach(applyHit);
      if (window.JJBROADCAST) JJBROADCAST.receiveState(m.screens);
      return true;
    }
    if (m.epoch !== epoch) return true;
    if (window.JJBROADCAST && JJBROADCAST.receive(m)) return true;
    if (authority()) command(m);
    return true;
  }
  function nearbyLadder() {
    for (let n = 0; n < D.ladders.length; n++) {
      const b = D.ladders[n];
      if (broken.has(n) || player.pos.y < b.min[1] - 2 || player.pos.y > b.max[1] + 2) continue;
      if (ladderDistance(player.pos, b) > 3.5) continue;
      for (const sign of [1, -1]) {
        const normal = V(...b.n).multiplyScalar(sign), p = V(b.p[0], Math.max(player.pos.y, b.min[1]), b.p[2]).addScaledVector(normal, 1.45);
        if (p.distanceTo(player.pos) > 3.6 || J.occupied(p, .85, 5.1)) continue;
        return {n, normal, p};
      }
    }
    return null;
  }
  function beforeStep(dt) {
    if (!context()) return;
    if (lastRig !== player.rig || lastChar !== player.char) {request({t: 'wi-drop'}); closeClimb(); lastRig = player.rig; lastChar = player.char;}
    const a = player.action;
    if (a?.type === 'bc_m1' && a.t > .12 && !a.worldCheck) {
      a.worldCheck = true;
      const from = player.pos.clone().add(V(0, 3, 0)), forward = V(Math.sin(player.facing), 0, Math.cos(player.facing));
      D.ladders.forEach((b, n) => {
        const target = V(b.p[0], Math.max(b.min[1], Math.min(b.max[1], from.y)), b.p[2]), delta = target.clone().sub(from);
        if (!broken.has(n) && delta.length() < 5.8 && delta.normalize().dot(forward) > .4 && reachable(player, target, 7)) request({t: 'wi-break', ladder: n});
      });
    }
    if (climb && (!gameInputActive() || player.dead || player.rag || player.frameT > 0 || player.stunT > 0 || broken.has(climb.n) || player.action?.type !== 'wi_climb')) closeClimb();
    if (!climb && gameInputActive() && available(player) && keys.KeyW && !(window.JJMOVE?.driving())) {
      const l = nearbyLadder();
      if (l && V(Math.sin(player.facing), 0, Math.cos(player.facing)).dot(l.normal) < -.25) {
        climb = l; player.action = {type: 'wi_climb', t: 0, dur: 1e8}; player.worldClimb = l.n;
        player.pos.copy(l.p); player.vel.set(0, 0, 0); player.onGround = false;
      }
    }
    if (!climb) return;
    const b = D.ladders[climb.n];
    if (keys.Space) {const n = climb.normal.clone(); closeClimb(); player.vel.copy(n.multiplyScalar(9)).setY(11); keys.Space = false; return;}
    const input = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), y = player.pos.y + input * 8 * dt;
    if (y < b.min[1] - .2) {closeClimb(); return;}
    if (y > b.max[1] - 1) {
      for (const sign of [-1, 1]) {
        const stand = V(b.p[0], b.max[1] + 3, b.p[2]).addScaledVector(climb.normal, sign * 2.3);
        const floor = J.floor(stand, stand.y);
        if (!Number.isFinite(floor) || floor < b.max[1] - 4 || floor > b.max[1] + 3) continue;
        stand.y = floor + .04;
        if (!J.occupied(stand, .85, 5.1)) {player.pos.copy(stand); closeClimb(); player.onGround = true; player.vel.set(0, 0, 0); return;}
      }
    }
    const next = player.pos.clone(); next.y = Math.max(b.min[1], Math.min(b.max[1], y));
    if (!J.occupied(next, .85, 5.1)) player.pos.copy(next);
    player.vel.set(0, 0, 0); player.facing = Math.atan2(-climb.normal.x, -climb.normal.z); player.__jjsLast = player.pos.clone();
  }
  function model(i) {
    if (models.has(i.id)) return models.get(i.id);
    if (!sharedBox) {sharedBox = own(new THREE.BoxGeometry(1, 1, 1)); sharedMaterials = [0xe95448,0x456877,0xffefc8,0x263b49].map(color => own(new THREE.MeshLambertMaterial({color})));}
    const g = new THREE.Group(), box = sharedBox;
    const body = new THREE.Mesh(box, sharedMaterials[i.kind === 'tnt' ? 0 : 1]);
    body.scale.setScalar(i.kind === 'tnt' ? 1.8 : 2.5); if (i.kind === 'bin') body.scale.y = 3.2; g.add(body);
    const band = new THREE.Mesh(box, sharedMaterials[i.kind === 'tnt' ? 2 : 3]);
    band.scale.set(i.kind === 'tnt' ? 1.84 : 2.9, .5, i.kind === 'tnt' ? 1.84 : 2.9); band.position.y = i.kind === 'tnt' ? 0 : 1.8; g.add(band);
    g.name = i.kind === 'tnt' ? 'TNT pickup' : 'Throwable trash bin'; root.add(g); models.set(i.id, g); return g;
  }
  function renderActors() {
    for (const [, e] of allActors()) {
      if (!e?.rig || e.rag || e.dead) continue;
      if (Number.isInteger(e.worldClimb)) {
        const r = e.rig, t = e.pos.y * 2.1;
        r.root.position.copy(e.pos); r.root.rotation.y = e.facing;
        for (const [s, phase] of [['L', 0], ['R', Math.PI]]) {
          if (r['shoulder' + s]) r['shoulder' + s].rotation.x = -2 + Math.sin(t + phase) * .4;
          if (r['hip' + s]) r['hip' + s].rotation.x = -.3 + Math.sin(t + phase) * .55;
          if (r['knee' + s]) r['knee' + s].rotation.x = .6 - Math.sin(t + phase) * .5;
        }
      }
      if (heldBy(e === player ? localId() : e.net?.id)) {
        if (e.rig.shoulderR) e.rig.shoulderR.rotation.x = -1.15;
        if (e.rig.elbowR) e.rig.elbowR.rotation.x = -.6;
      }
    }
  }
  function tick() {
    if (!context()) return;
    const t = now(), delta = Math.min(.25, Math.max(0, t - lastFrame)); lastFrame = t;
    if (authority() && (online() || gameInputActive())) {
      let remaining = delta;
      while (remaining > 0) {const dt = Math.min(1 / 60, remaining); clock += dt; simulate(dt); remaining -= dt;}
      if (online() && t - lastSend > .15) snapshot();
    }
    for (const [id, g] of models) if (!items.has(id)) {root.remove(g); models.delete(id);}
    for (const i of items.values()) {
      if (i.state === 'home' || i.state === 'spent') {if (models.has(i.id)) models.get(i.id).visible = false; continue;}
      const g = model(i); g.visible = true;
      if (i.state === 'held') {
        const e = actor(i.owner); if (!e) {g.visible = false; continue;}
        const dir = V(Math.sin(e.facing), 0, Math.cos(e.facing));
        g.position.copy(e.pos).add(V(0, 3.4, 0)).addScaledVector(dir, 2); g.rotation.set(0, e.facing, -.2);
      } else {g.position.lerp(i.p, authority() ? 1 : .45); if (i.state === 'flying') g.rotation.x += delta * 7;}
      g.visible = g.position.distanceToSquared(player.pos) < 320 * 320;
    }
    for (const e of effects) {
      e.t -= delta;
      if (e.velocity) {e.velocity.y -= delta * 22; e.mesh.position.addScaledVector(e.velocity, delta); e.mesh.rotation.z += delta * 4;}
      else e.mesh.scale.setScalar(e.size * (1 - e.t / .45));
      e.mesh.material.opacity = Math.max(0, Math.min(1, e.t * 2));
    }
    effects = effects.filter(e => {if (e.t > 0) return true; disposeEffect(e); return false;});
    renderActors();
    const held = heldBy(localId()), nearby = nearest(), consoleIndex = window.JJBROADCAST ? JJBROADCAST.nearConsole(player) : -1;
    ui.style.display = gameInputActive() && (held || nearby || climb || consoleIndex >= 0) ? 'block' : 'none';
    use.style.display = !held && (nearby || consoleIndex >= 0) ? 'inline-block' : 'none';
    use.textContent = nearby ? 'Pick up ' + (nearby.kind === 'tnt' ? 'TNT' : 'bin') + ' · E' : 'Screen console · E';
    throwButton.style.display = held ? 'inline-block' : 'none';
    const text = held ? (held.kind === 'tnt' ? 'Holding TNT' : 'Holding bin') + ' · Left click to throw · X to drop' : climb ? 'W / S · Climb   Space · Jump off' : nearby ? 'Random drops and city props' : 'Broadcast to this building’s screen';
    if (hint.textContent !== text) hint.textContent = text;
    if (window.JJBROADCAST) JJBROADCAST.tick(delta);
  }
  function interact() {
    if (pickup()) return true;
    return !!window.JJBROADCAST && JJBROADCAST.openNearby();
  }
  use.addEventListener('click', e => {e.stopPropagation(); interact();});
  throwButton.addEventListener('click', e => {e.stopPropagation(); consumeM1();});
  window.addEventListener('keydown', e => {
    if (e.repeat || !gameInputActive() || (typeof typingInUI === 'function' && typingInUI(e))) return;
    if (e.code === 'KeyE' && interact() || e.code === 'KeyX' && heldBy(localId()) && request({t: 'wi-drop'})) {e.preventDefault(); e.stopImmediatePropagation();}
  }, true);
  const render = renderer.render;
  renderer.render = function (s, c) {if (s === scene) tick(); return render.apply(this, arguments);};
  window.JJIWORLD = {receive, beforeStep, consumeM1, pickup, impact, syncActor, clear, send, snapshot, authority, online, actor, reachable, available, active,
    driving: () => !!climb, get epoch() {return epoch;}, get hostId() {return hostId;},
    audit: () => ({items: [...items.values()].map(i => ({...i, p: i.p.toArray(), v: i.v.toArray()})), broken: [...broken], ladders: D.ladders.length, held: heldBy(localId())?.id || '', climb: climb?.n ?? -1, epoch, effects: effects.length, models: models.size})};
})();
