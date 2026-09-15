/* Station hazard: host-owned timing, swept collisions, simple block train. */
(function () {
  'use strict';
  const J = window.JJJJS;
  if (!J) return;
  // Packed indices from StationControl.ButtonTrain and its two tunnel portals.
  const BUTTON = 7951, ENTRY = 7946, EXIT = 7948;
  const WAIT = 5, SPEED = 260, LENGTH = 60, WIDTH = 24, HEIGHT = 24, COOLDOWN = 8;
  const point = i => new THREE.Vector3(...J.data.parts[i].slice(0, 3)).sub(new THREE.Vector3(...J.data.origin));
  const buttonPos = point(BUTTON), entry = point(ENTRY), end = point(EXIT);
  const direction = end.clone().sub(entry).setY(0).normalize();
  const side = new THREE.Vector3(direction.z, 0, -direction.x);
  const distance = end.distanceTo(entry), duration = (distance + LENGTH) / SPEED;
  const trackFloor = -19.251 - J.data.origin[1];
  const start = entry.clone().addScaledVector(direction, -LENGTH / 2).setY(trackFloor + HEIGHT / 2);
  let root = null, model = null, proxy = null, resources = [], mapRoot = null, room = null;
  let run = null, serial = 0, hostId = null, rxSeq = -1, sendSeq = 0, lastSend = -Infinity;
  let applied = new Set(), previous = new Map(), requestAt = -Infinity, suppressMouse = 0;
  const now = () => performance.now() / 1000;
  const multiplayer = () => !!window.MPJJ?.active;
  const authority = () => !multiplayer() || MPJJ.host;
  const activeMap = () => window.JJMAP?.id === 'jjs' && !!J.root;
  const elapsed = () => run ? Math.max(0, now() - run.at) : 0;
  const travel = t => Math.max(0, Math.min(distance + LENGTH, (t - WAIT) * SPEED));
  const own = o => (resources.push(o), o);
  const panel = document.createElement('div'), call = document.createElement('button'), label = document.createElement('div');
  panel.style.cssText = 'position:fixed;left:50%;bottom:24%;transform:translateX(-50%);z-index:35;text-align:center;display:none;pointer-events:none;font:700 15px system-ui;color:#fff;text-shadow:0 2px 4px #000';
  call.type = 'button'; call.textContent = 'Call train · E';
  call.style.cssText = 'pointer-events:auto;padding:12px 20px;border:2px solid #b4ef9a;border-radius:8px;background:#234c2e;color:#fff;font:inherit;cursor:pointer';
  label.style.cssText = 'padding:8px;background:#17202de6;border-radius:6px;margin-bottom:6px';
  label.setAttribute('role', 'status'); label.setAttribute('aria-live', 'polite');
  panel.appendChild(label); panel.appendChild(call); document.body.appendChild(panel);

  function makeModel() {
    root = new THREE.Group(); root.name = 'Station train hazard'; scene.add(root);
    const box = own(new THREE.BoxGeometry(1, 1, 1));
    model = new THREE.Group(); model.name = 'Express train'; root.add(model);
    // Four instanced draw calls, shared cube geometry, no textures or shadows.
    const batches = [[], [], [], []];
    for (const z of [-15, 15]) {
      batches[0].push([0, 0, z, WIDTH, HEIGHT - 4, 28]);
      batches[1].push([0, 10.5, z, WIDTH, 3, 28], [0, -11, z, WIDTH, 2, 28]);
      batches[2].push([0, 3, z - 14.05, 19, 7, .2], [0, 3, z + 14.05, 19, 7, .2]);
      for (const x of [-12.05, 12.05]) for (const dz of [-8, 0, 8]) batches[2].push([x, 3, z + dz, .2, 7, 5]);
    }
    for (const x of [-8, 8]) batches[3].push([x, -5, 29.2, 3, 2, .3]);
    const colors = [0xc8cdd4, 0x397559, 0x152b3a, 0xffedb0];
    const matrix = new THREE.Matrix4(), q = new THREE.Quaternion();
    batches.forEach((items, i) => {
      const material = own(i === 3 ? new THREE.MeshBasicMaterial({color: colors[i]}) : new THREE.MeshLambertMaterial({color: colors[i]}));
      const mesh = own(new THREE.InstancedMesh(box, material, items.length));
      items.forEach((b, n) => mesh.setMatrixAt(n, matrix.compose(new THREE.Vector3(...b.slice(0, 3)), q, new THREE.Vector3(...b.slice(3)))));
      mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); model.add(mesh);
    });
    model.rotation.y = Math.atan2(direction.x, direction.z); model.visible = false;
    const mat = own(new THREE.MeshBasicMaterial({color: 0x78ee72, transparent: true, opacity: .5, depthWrite: false}));
    proxy = new THREE.Mesh(box, mat); proxy.name = 'Call train button';
    proxy.matrixAutoUpdate = false;
    proxy.matrix.copy(J.transform(J.data.parts[BUTTON])).scale(new THREE.Vector3(1.55, .34, 1.55));
    root.add(proxy); root.updateMatrixWorld(true);
  }
  function clear() {
    if (root) scene.remove(root);
    resources.forEach(o => o.dispose()); resources = [];
    root = model = proxy = null; run = null; previous.clear(); applied.clear(); panel.style.display = 'none';
  }
  function context() {
    const key = multiplayer() ? MPJJ.code : 'offline';
    if (key !== room) { clear(); room = key; hostId = null; rxSeq = -1; }
    if (mapRoot !== J.root || !activeMap()) { clear(); mapRoot = J.root; }
    if (activeMap() && !root) makeModel();
    return activeMap();
  }
  function nearButton(ent) {
    if (!ent || ent.dead || ent.rag || !ent.pos) return false;
    const eye = ent.pos.clone().add(new THREE.Vector3(0, 3.8, 0));
    if (eye.distanceToSquared(buttonPos) > 100) return false;
    const target = buttonPos.clone().addScaledVector(eye.clone().sub(buttonPos).normalize(), .65);
    return J.ray(eye, target, 0) >= .96;
  }
  function ready() { return !run || elapsed() >= WAIT + duration + COOLDOWN; }
  function pub(m) {
    if (multiplayer() && MPJJ.relay) MPJJ.relay.pub(Object.assign({id: MPJJ.id, room: MPJJ.code, map: 'jjs'}, m));
  }
  function snapshot() {
    if (!authority() || !run) return;
    lastSend = now();
    pub({t: 'tr-state', run: run.id, seq: ++sendSeq, elapsed: Math.min(elapsed(), WAIT + duration + COOLDOWN), hits: Array.from(run.hits)});
  }
  function activate(ent) {
    if (!context() || !authority() || !ready() || !nearButton(ent)) return false;
    run = {id: ++serial, at: now(), last: 0, hits: new Set()}; applied.clear(); previous.clear();
    snapshot(); return true;
  }
  function request() {
    if (!gameInputActive() || !context() || !nearButton(player) || !ready() || player.action || player.frameT > 0) return false;
    if (authority()) return activate(player);
    if (now() - requestAt < .7) return false;
    requestAt = now(); pub({t: 'tr-request'}); return true;
  }
  function crash(ent, id, visualOnly) {
    if (!ent || !ent.rig || (ent.trainCrash?.run === id && ent.rag)) return;
    const wasAlive = !ent.dead;
    if (!visualOnly && ent.ai && window.JJAISERVER) JJAISERVER.environmentKO(ent);
    if (window.JJAIKITS && ent.ai) JJAIKITS.cancel(ent);
    if (ent === player && ent.frameT > 0 && typeof unframePlayer === 'function') unframePlayer(false);
    else if (typeof ent.unframe === 'function') ent.unframe(false);
    if (window.JJRAG) JJRAG.stop(ent);
    if (window.JJGORE) { JJGORE.clear(ent); if (JJGORE.release) JJGORE.release(ent); }
    ent.__death = null;
    ent.trainCrash = {run: id, floor: trackFloor};
    ent.hp = 0; ent.dead = true; ent.action = ent.bcFall = ent.react = null;
    ent.blocking = false; ent.frameT = ent.anchorT = ent.lockT = 0; ent.flung = false;
    const knock = direction.clone().multiplyScalar(70).setY(12);
    ent.vel.copy(knock);
    if (window.JJRAG) JJRAG.start(ent, knock);
    if (ent === player) {
      ent.deathT = 3.4;
      if (wasAlive && !visualOnly) {
        if (multiplayer() && MPJJ.environmentKO) MPJJ.environmentKO();
        if (typeof showSplash === 'function') showSplash('CRASH', 'TRAIN FINISHER · RESPAWNING…', '#ffdf80');
      }
    } else ent.respawnT = 5;
  }
  function syncActor(ent, dead, id) {
    if (!dead && ent.trainCrash) { if (window.JJRAG) JJRAG.stop(ent); delete ent.trainCrash; }
    else if (activeMap() && dead && Number.isSafeInteger(id) && id > 0) crash(ent, id, true);
  }
  function actors() {
    const result = [['human:' + (multiplayer() ? MPJJ.id : 'local'), player]];
    if (multiplayer()) for (const [id, f] of Object.entries(MPJJ.fighters)) result.push(['human:' + id, f.e]);
    enemies.forEach((e, i) => { if (!e.net && (!e.ai || !e.ai.remote)) result.push([e.ai ? 'ai:' + e.ai.id : 'dummy:' + i, e]); });
    return result;
  }
  // A segment in train-relative space catches both moving actors and fast trains.
  function intersects(before, after, t0, t1) {
    const a = before.clone().add(new THREE.Vector3(0, 2.55, 0)).sub(start).addScaledVector(direction, -travel(t0));
    const b = after.clone().add(new THREE.Vector3(0, 2.55, 0)).sub(start).addScaledVector(direction, -travel(t1));
    const from = [a.dot(side), a.y, a.dot(direction)], to = [b.dot(side), b.y, b.dot(direction)];
    const extent = [WIDTH / 2 + 1, HEIGHT / 2 + 2.55, LENGTH / 2 + 1];
    let lo = 0, hi = 1;
    for (let i = 0; i < 3; i++) {
      const delta = to[i] - from[i];
      if (Math.abs(delta) < 1e-8) { if (Math.abs(from[i]) > extent[i]) return false; }
      else {
        const x = (-extent[i] - from[i]) / delta, y = (extent[i] - from[i]) / delta;
        lo = Math.max(lo, Math.min(x, y)); hi = Math.min(hi, Math.max(x, y));
        if (lo > hi) return false;
      }
    }
    return true;
  }
  function applyHits() {
    if (!run) return;
    for (const id of run.hits) {
      if (applied.has(id)) continue;
      let ent = null;
      if (id === 'human:' + (multiplayer() ? MPJJ.id : 'local')) ent = player;
      else if (id.startsWith('human:')) ent = MPJJ.fighters[id.slice(6)]?.e;
      else if (id.startsWith('ai:')) ent = enemies.find(e => e.ai && String(e.ai.id) === id.slice(3));
      else if (!multiplayer()) ent = enemies[Number(id.slice(6))];
      if (ent) { applied.add(id); if (!ent.dead) crash(ent, run.id, ent !== player && !authority()); }
    }
  }
  function receive(m) {
    context();
    if (!multiplayer()) return false;
    if (m.t === 'hi' || m.t === 'hi2') {
      if (m.host && !MPJJ.host && (!hostId || hostId === m.id)) hostId = m.id;
      if (authority()) snapshot();
    }
    if (typeof m.t !== 'string' || !m.t.startsWith('tr-')) return false;
    if (m.room !== MPJJ.code || m.map !== 'jjs' || !activeMap()) return true;
    if (m.t === 'tr-request') {
      if (authority()) activate(MPJJ.fighters[m.id]?.e);
      return true;
    }
    if (m.t !== 'tr-state' || authority() || m.id !== hostId || !Number.isSafeInteger(m.seq) || m.seq <= rxSeq ||
        !Number.isSafeInteger(m.run) || m.run < 1 || !Number.isFinite(m.elapsed) || m.elapsed < 0 || m.elapsed > WAIT + duration + COOLDOWN + .1 ||
        !Array.isArray(m.hits) || m.hits.length > 512 || !m.hits.every(x => typeof x === 'string' && x.length < 100)) return true;
    if (run && m.run < run.id) return true;
    rxSeq = m.seq;
    if (!run || run.id !== m.run) { run = {id: m.run, at: now() - m.elapsed, last: m.elapsed, hits: new Set()}; applied.clear(); }
    else run.at = Math.min(run.at, now() - m.elapsed);
    m.hits.forEach(id => run.hits.add(id)); applyHits(); return true;
  }
  function tick() {
    if (!context()) return;
    const t = elapsed(), near = gameInputActive() && nearButton(player);
    const warning = run && t < WAIT + duration && Math.abs(player.pos.y - trackFloor) < 45 && Math.abs(player.pos.x - entry.x) < 90;
    panel.style.display = near || warning ? 'block' : 'none';
    call.style.display = near ? 'inline-block' : 'none'; call.disabled = !ready();
    const message = !run || ready() ? 'Station express' : t < WAIT ? 'TRAIN IN ' + Math.ceil(WAIT - t) + 's · Clear the tracks!' : t < WAIT + duration ? 'TRAIN PASSING · Keep clear!' : 'Train ready in ' + Math.ceil(WAIT + duration + COOLDOWN - t) + 's';
    if (label.textContent !== message) label.textContent = message;
    proxy.material.color.setHex(ready() ? 0x78ee72 : 0xffbb44);
    model.visible = !!run && t >= WAIT && t < WAIT + duration;
    if (run) model.position.copy(start).addScaledVector(direction, travel(t));
    if (!run) return;
    if (authority()) {
      for (const [id, ent] of (run.last < WAIT + duration ? actors() : [])) {
        if (!ent?.pos) continue;
        const before = previous.get(id) || ent.pos;
        if (!ent.dead && !run.hits.has(id) && t >= WAIT && run.last < WAIT + duration) {
          // Clip actor motion to the same time interval as the active train.
          const span = t - run.last, low = Math.max(WAIT, run.last), high = Math.min(t, WAIT + duration);
          const a = before.clone().lerp(ent.pos, span > 0 ? (low - run.last) / span : 1);
          const b = before.clone().lerp(ent.pos, span > 0 ? (high - run.last) / span : 1);
          if (intersects(a, b, low, high)) run.hits.add(id);
        }
        previous.set(id, ent.pos.clone());
      }
      const count = applied.size; applyHits();
      if (multiplayer() && t < WAIT + duration + COOLDOWN + 1 && (now() - lastSend >= .4 || applied.size !== count)) snapshot();
    } else applyHits();
    run.last = t;
  }
  call.addEventListener('click', e => { e.stopPropagation(); request(); });
  window.addEventListener('keydown', e => {
    if (e.code !== 'KeyE' || e.repeat || (typeof typingInUI === 'function' && typingInUI(e))) return;
    if (request()) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
  window.addEventListener('pointerdown', e => {
    if (e.button !== 0 || e.target !== renderer.domElement || !gameInputActive() || !context() || !nearButton(player)) return;
    const rect = renderer.domElement.getBoundingClientRect(), locked = document.pointerLockElement === renderer.domElement;
    const cursor = new THREE.Vector2(locked ? 0 : (e.clientX - rect.left) / rect.width * 2 - 1, locked ? 0 : -(e.clientY - rect.top) / rect.height * 2 + 1);
    const ray = new THREE.Raycaster(); ray.setFromCamera(cursor, camera); root.updateMatrixWorld(true);
    if (!ray.intersectObject(proxy).length) return;
    suppressMouse = now() + .4; e.preventDefault(); e.stopImmediatePropagation(); request();
  }, true);
  // The base combat listener uses bubbling mousedown rather than pointerdown.
  window.addEventListener('mousedown', e => { if (now() < suppressMouse) { e.preventDefault(); e.stopImmediatePropagation(); } }, true);
  const render = renderer.render;
  renderer.render = function (s, c) { if (s === scene) tick(); return render.apply(this, arguments); };
  window.JJTRAIN = {request, receive, clear, syncActor, audit: () => ({button: buttonPos.toArray(), entry: entry.toArray(), end: end.toArray(), trackFloor, duration, run: run?.id || 0, elapsed: elapsed(), hits: run ? Array.from(run.hits) : [], visible: !!model?.visible, drawGroups: model?.children.length || 0})};
})();
