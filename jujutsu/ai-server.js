/* AI Server: free-for-all actors, tactical decisions, social memory and room sync. */
(function () {
  'use strict';
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z),
    C = JJAICOMBAT,
    N = JJAINAV,
    F = JJFIGHT;
  const names = [
    'Kuro',
    'Lotus',
    'Shiro',
    'Zen',
    'Ash',
    'Mochi',
    'Crow',
    'Nova',
    'Onyx',
    'Rin',
    'Echo',
    'Sora',
    'Dusk',
    'Ren',
    'Fox',
    'Aster'
  ];
  const bots = [],
    stash = [],
    signals = new Map(),
    events = [];
  let epoch = '',
    seed = 1,
    serial = 0,
    hostId = null,
    sent = 0,
    uiT = 0,
    lastRoot = null,
    rxSeq = -1,
    rxAt = 0,
    pending = 0;
  const seenHits = new Map(),
    pendingHits = new Map();
  const S = (window.JJAISERVER = {
    active: false,
    authority: false,
    time: 0,
    bots,
    start,
    stop,
    actors,
    hit,
    swap,
    receive,
    onArena,
    onMap,
    newRoom() {
      stop();
      hostId = null;
      pending = 0;
    },
    audit: () => ({
      active: S.active,
      authority: S.authority,
      count: bots.length,
      time: S.time,
      events: events.slice(-40),
      navigation: N.audit(),
      bots: bots.map((e) => ({
        id: e.ai.id,
        name: e.ai.name,
        char: e.char,
        hp: e.hp,
        kills: e.ai.kills,
        deaths: e.ai.deaths,
        state: e.ai.state,
        action: e.action?.type,
        target: e.ai.target ? actorId(e.ai.target) : null,
        revenge: e.ai.revenge,
        pos: e.pos.toArray(),
        history: e.ai.history.slice(-16)
      }))
    })
  });
  function rng() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  function note(message) {
    events.push({ time: +S.time.toFixed(2), message });
    if (events.length > 80) events.shift();
  }
  function actorId(e) {
    return e === player ? 'human:' + MPJJ.id : e.ai?.id || 'human:' + e.net?.id;
  }
  function actors() {
    return [player, ...bots, ...Object.values(MPJJ.fighters).map((f) => f.e)].filter((e) => e && e.pos);
  }
  function actor(id) {
    return actors().find((e) => actorId(e) === id);
  }
  function pub(m) {
    if (MPJJ.active && MPJJ.relay?.connected) MPJJ.relay.pub({ ...m, id: MPJJ.id, epoch });
  }
  function nearPlayer(e, n = 150) {
    return e.pos.distanceTo(player.pos) < n;
  }
  function disposeRig(r) {
    if (!r) return;
    scene.remove(r.root);
    const gs = new Set(),
      ms = new Set();
    r.root.traverse((o) => {
      if (o.geometry) gs.add(o.geometry);
      if (o.material) for (const m of Array.isArray(o.material) ? o.material : [o.material]) ms.add(m);
    });
    gs.forEach((g) => g.dispose());
    ms.forEach((m) => m.dispose());
  }
  function tag(e) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 50;
    const g = canvas.getContext('2d');
    g.font = 'bold 25px Arial';
    g.textAlign = 'center';
    g.strokeStyle = '#161b24';
    g.lineWidth = 6;
    g.strokeText('[AI] ' + e.ai.name, 128, 31);
    g.fillStyle = '#eadbc4';
    g.fillText('[AI] ' + e.ai.name, 128, 31);
    const tex = new THREE.CanvasTexture(canvas),
      spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    spr.scale.set(5.2, 1, 1);
    spr.position.y = 7.4;
    e.rig.root.add(spr);
    e.ai.tagTex = tex;
  }
  function rig(e, id) {
    if (e.ai?.tagTex) e.ai.tagTex.dispose();
    e.rig.root.remove(e.hpSpr);
    disposeRig(e.rig);
    e.char = id;
    e.rig = makeAnimeRig(CHARS[id].cfg);
    e.rig.__char = id;
    e.rig.root.add(e.hpSpr);
    scene.add(e.rig.root);
    tag(e);
    e.rig.root.position.copy(e.pos);
    e.rig.root.rotation.y = e.facing;
  }
  function spawnPoint(index, around = player.pos) {
    for (let n = 0; n < 55; n++) {
      const angle = index * 2.399 + n * 0.7,
        radius = 18 + (index % 4) * 10 + n * 0.7;
      const p = around.clone().add(V(Math.sin(angle) * radius, 0, Math.cos(angle) * radius));
      p.y = worldFloor(p, around.y + 1.2);
      if (
        !Number.isFinite(p.y) ||
        Math.abs(p.y - around.y) > 8 ||
        N.occupied(p) ||
        bots.some((e) => !e.dead && e.pos.distanceTo(p) < 4)
      )
        continue;
      return p;
    }
    const p = JJMAP.spawn(index);
    return V(p.x, p.y || 0, p.z);
  }
  function make(id, name, char, pos, remote = false) {
    const e = new Enemy(pos.x, pos.z, 'dummy');
    const random = rng();
    e.ai = {
      id,
      name,
      remote,
      state: 'roaming',
      action: null,
      target: null,
      combo: 0,
      comboReset: 0,
      m1CD: 0,
      frontCD: 0,
      evadeCD: 0,
      techCD: [1 + random * 3, 3 + random * 3],
      charges: 2,
      mode: 0,
      guardT: 0,
      serial: 0,
      gait: 0,
      think: 0.15 + random * 0.15,
      react: 0.12 + random * 0.12,
      aggression: 0.35 + rng() * 0.6,
      social: 0.2 + rng() * 0.7,
      grudge: 0.45 + rng() * 0.4,
      strafe: rng() < 0.5 ? -1 : 1,
      memory: new Map(),
      history: [],
      kills: 0,
      deaths: 0,
      revenge: null,
      revengeUntil: 0,
      lastAttacker: null,
      lastHurt: -20,
      lastHit: -20,
      confirm: false,
      path: [],
      pathT: 0,
      pathPending: 0,
      goal: null,
      wander: 0,
      peace: 0,
      stuck: 0,
      lastPos: pos.clone(),
      checkT: 0,
      skillBias: rng(),
      reaction: null
    };
    e.hp = e.maxHp = 100;
    e.pos.copy(pos);
    e.spawn.copy(pos);
    e.iframes = 2;
    e.blocking = false;
    e.action = null;
    rig(e, char);
    bots.push(e);
    enemies.push(e);
    return e;
  }
  function start(count = 12, options = {}) {
    if (MPJJ.joined && !MPJJ.host && !options.remote) return false;
    stop(false);
    seed = Number.isFinite(options.seed) ? options.seed >>> 0 : Date.now() >>> 0;
    epoch = MPJJ.id + '-' + seed.toString(36);
    serial = 0;
    sent = 0;
    S.time = 0;
    events.length = 0;
    S.active = true;
    S.authority = !options.remote;
    lastRoot = JJJJS.root;
    N.clear();
    hostId = S.authority ? MPJJ.id : hostId;
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (e.net || e.ai) continue;
      stash.push(e);
      scene.remove(e.rig.root);
      enemies.splice(i, 1);
    }
    if (!options.remote) {
      const ids = Object.keys(CHARS);
      for (let i = ids.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [ids[i], ids[j]] = [ids[j], ids[i]];
      }
      for (let i = 0; i < Math.max(1, Math.min(16, count)); i++)
        make('ai:' + epoch + ':' + i, names[i], ids[i % ids.length], spawnPoint(i));
      player.hp = player.maxHp;
      player.dead = false;
      player.iframes = 2;
      player.stunT = 0;
      player.action = null;
      F.reset();
      JJRAG.stop(player);
      JJGORE.clear(player);
      document.getElementById('jjLobby').style.display = 'none';
      enterArenaLocal();
      note('AI Server started');
      snapshot();
    }
    refreshUI();
    return true;
  }
  function stop(announce = true) {
    if (announce && S.active && S.authority) pub({ t: 'ai-stop' });
    for (const e of bots) {
      JJRAG.stop(e);
      JJGORE.clear(e);
      e.unframe(false);
      e.ai.tagTex?.dispose();
      e.hpTex.dispose();
      e.rig.root.remove(e.hpSpr);
      e.hpSpr.material.dispose();
      disposeRig(e.rig);
      const i = enemies.indexOf(e);
      if (i >= 0) enemies.splice(i, 1);
    }
    bots.length = 0;
    for (const e of stash) {
      if (!enemies.includes(e)) enemies.push(e);
      scene.add(e.rig.root);
    }
    stash.length = 0;
    S.active = false;
    S.authority = false;
    signals.clear();
    seenHits.clear();
    pendingHits.clear();
    N.clear();
    rxSeq = -1;
    refreshUI();
  }
  function onArena() {
    if (pending && MPJJ.host) {
      const count = pending;
      pending = 0;
      start(count);
    } else if (S.active && S.authority) onMap();
  }
  function onMap() {
    N.clear();
    lastRoot = JJJJS.root;
    for (const [i, e] of bots.entries()) {
      e.ai.path = [];
      e.ai.goal = null;
      e.ai.pathT = 0;
      e.ai.target = null;
      e.action = null;
      e.bcFall = null;
      if (S.authority) {
        e.pos.copy(spawnPoint(i));
        e.spawn.copy(e.pos);
        e.vel.set(0, 0, 0);
        e.__jjsLast = null;
      }
    }
  }
  function remember(e, source) {
    const b = e.ai,
      id = actorId(source);
    let m = b.memory.get(id);
    if (!m) {
      m = { anger: 0, guard: 0, seen: 0, pos: source.pos.clone() };
      b.memory.set(id, m);
    }
    return m;
  }
  function damaged(e, source) {
    if (!source || source === e) return;
    e.ai.lastAttacker = actorId(source);
    e.ai.lastHurt = S.time;
    e.ai.peace = 0;
    e.ai.socialAction = null;
    e.ai.path = [];
    e.ai.pathT = 0;
    remember(e, source).anger += 3;
    e.ai.target = source;
    e.ai.state = 'fighting';
    e.action = null;
    e.blocking = false;
  }
  function killed(victim, killer) {
    if (!S.active || !S.authority) return;
    if (victim.ai) {
      const b = victim.ai;
      b.deaths++;
      b.target = null;
      b.path = [];
      b.socialAction = null;
      eNoAction(victim);
      if (killer && rng() < b.grudge) {
        b.revenge = actorId(killer);
        b.revengeUntil = S.time + 150;
        note(b.name + ' remembers a revenge target');
      } else b.revenge = null;
    }
    if (killer?.ai) {
      const b = killer.ai;
      b.kills++;
      note(b.name + ' won a fight');
      if (b.revenge === actorId(victim)) {
        b.revenge = null;
        b.target = null;
        b.taunt = { pos: victim.pos.clone(), victim: actorId(victim), t: 0 };
        b.state = 'revenge celebration';
        eNoAction(killer);
        note(b.name + ' completed revenge');
      } else {
        b.target = null;
        b.wander = 2 + rng() * 3;
        b.peace = S.time + 1;
      }
    }
  }
  function eNoAction(e) {
    e.action = null;
    e.blocking = false;
    e.ai.guardT = 0;
  }
  function hit(source, target, amount, knock, meta) {
    if (!S.active || !S.authority || !source.ai || !Number.isFinite(amount) || amount <= 0) return false;
    if (target === player) {
      const before = player.hp;
      hurtPlayer(amount, knock, { combat: meta, aiSource: source.ai.id });
      return player.hp < before;
    }
    if (target.net) {
      pendingHits.set(target.net.id + ':' + source.ai.id + ':' + meta.id, S.time);
      if (pendingHits.size > 512) pendingHits.delete(pendingHits.keys().next().value);
      pub({
        t: 'ai-hit-player',
        to: target.net.id,
        bot: source.ai.id,
        d: amount,
        k: knock.toArray(),
        bc: F.hitData(meta)
      });
      return false; // The owning peer confirms damage before a hit-confirm combo.
    }
    return takeBotHit(target, amount, knock, meta, source);
  }
  function takeBotHit(target, amount, knock, meta, source) {
    if (
      !target.ai ||
      target.dead ||
      target.rag ||
      target.bcFall ||
      target.iframes > 0 ||
      target.cineHold ||
      target.tdHold ||
      target.mhConsumed
    )
      return false;
    if (F.blocked(target, meta)) {
      if (nearPlayer(target)) F.blockFX(target);
      return false;
    }
    const hp = target.hp;
    target.hp = Math.max(JJGORE.isHeld(target) ? 1 : 0, hp - amount);
    damaged(target, source);
    target.stunT = Math.max(target.stunT, meta?.stun || 0.35);
    if (knock) {
      target.vel.add(knock);
      if (meta?.down) F.actors.startFall(target, knock, meta);
    }
    target.react = { type: 'stagger', t: 0, dur: 0.32, side: 1 };
    target.drawBars();
    if (nearPlayer(target, 90))
      damageNumber(target.pos.clone().add(V(0, 5.4, 0)), Math.round(amount), '#ffddb0');
    if (target.hp <= 0) target.die();
    return target.hp < hp;
  }
  function swap(e, target) {
    if (target.net) return;
    const from = e.pos.clone(),
      to = target.pos.clone();
    if (
      N.occupied(from) ||
      N.occupied(to) ||
      !F.actors.visible(from.clone().add(V(0, 2.5, 0)), to.clone().add(V(0, 2.5, 0)))
    )
      return;
    e.pos.copy(to);
    target.pos.copy(from);
    e.__jjsLast = e.pos.clone();
    target.__jjsLast = target.pos.clone();
    if (nearPlayer(e)) {
      JJFX.ring(from.clone().add(V(0, 2.5, 0)), 0xffddb0, { maxR: 2, life: 0.2 });
      JJFX.ring(to.clone().add(V(0, 2.5, 0)), 0xffddb0, { maxR: 2, life: 0.2 });
    }
    if (target === player) note(e.ai.name + ' used a swap');
  }
  function choose(e) {
    const b = e.ai;
    let best = null,
      score = -Infinity;
    if (b.revenge && b.revengeUntil < S.time) b.revenge = null;
    for (const t of actors()) {
      if (
        t === e ||
        t.dead ||
        t.cineHold ||
        t.mhConsumed ||
        t.iframes > 1 ||
        (t === player && !gameInputActive())
      )
        continue;
      const id = actorId(t),
        dist = e.pos.distanceTo(t.pos),
        known = b.memory.get(id),
        revenge = id === b.revenge;
      if (t === player && S.time < b.peace && !revenge) continue;
      if (dist > (revenge ? 180 : 75) || Math.abs(t.pos.y - e.pos.y) > 80) continue;
      if (
        !revenge &&
        !known &&
        dist > 22 &&
        !F.actors.visible(e.pos.clone().add(V(0, 3, 0)), t.pos.clone().add(V(0, 3, 0)))
      )
        continue;
      let n = 65 - dist + (100 - t.hp) * 0.16 + (known?.anger || 0) * 6 + (revenge ? 110 : 0);
      if (t === player) {
        n -= 15 + (1 - b.aggression) * 24;
        n -= bots.filter((o) => o !== e && o.ai.target === t).length * 22;
      } else n -= bots.filter((o) => o !== e && o.ai.target === t).length * 21;
      if (t.ai?.target === e) n += 12;
      if (t === b.target) n += 5;
      if (n > score) {
        score = n;
        best = t;
      }
    }
    return best;
  }
  function jump(e) {
    if (e.onGround && C.free(e) && !e.action && !e.blocking && !N.occupied(e.pos.clone().add(V(0, 2, 0)))) {
      e.vel.y = 15;
      e.onGround = false;
      return true;
    }
    return false;
  }
  function goal(e, p) {
    e.ai.goal = p.clone();
  }
  function socialSignal(source, kind) {
    for (const e of bots) {
      const b = e.ai;
      if (
        e.dead ||
        e.action ||
        e.stunT > 0 ||
        b.revenge === actorId(source) ||
        S.time - b.lastHurt < 2.5 ||
        e.pos.distanceTo(source.pos) > 20
      )
        continue;
      if (!F.actors.visible(e.pos.clone().add(V(0, 3, 0)), source.pos.clone().add(V(0, 3, 0)))) continue;
      if (rng() > b.social) {
        b.history.push('ignored ' + kind);
        continue;
      }
      b.socialAction = {
        source: actorId(source),
        kind: rng() < 0.5 ? 'double block' : 'backstep jump',
        t: 0
      };
      b.target = null;
      b.peace = S.time + 12 + rng() * 10;
      b.state = 'responding';
      eNoAction(e);
      note(b.name + ' responds to ' + kind);
    }
  }
  function detectSignals(dt) {
    for (const source of [player, ...Object.values(MPJJ.fighters).map((f) => f.e)]) {
      const id = actorId(source);
      let s = signals.get(id);
      if (!s) {
        s = { block: false, presses: [], angle: source.facing, spin: 0, walk: 0, window: 0, cool: 0 };
        signals.set(id, s);
      }
      const network = source.net && MPJJ.fighters[source.net.id];
      if (source.dead || source.stunT > 0 || source.action || network?.action) {
        s.presses = [];
        s.spin = 0;
        s.block = source.blocking;
        continue;
      }
      if (source.blocking && !s.block) {
        s.presses = s.presses.filter((t) => S.time - t < 1.2);
        s.presses.push(S.time);
        if (s.presses.length >= 2 && S.time > s.cool) {
          socialSignal(source, 'double block');
          s.cool = S.time + 4;
          s.presses = [];
        }
      }
      s.block = source.blocking;
      let a = source.facing - s.angle;
      while (a > Math.PI) a -= 2 * Math.PI;
      while (a < -Math.PI) a += 2 * Math.PI;
      s.angle = source.facing;
      s.window += dt;
      const movement = network?.motion || source.vel;
      if (Math.hypot(movement?.x || 0, movement?.z || 0) > 1) {
        s.spin += Math.abs(a);
        s.walk += dt;
      }
      if (s.spin > 4.8 && s.walk > 0.5 && S.time > s.cool) {
        socialSignal(source, 'walking spin');
        s.cool = S.time + 4;
        s.spin = 0;
      }
      if (s.window > 3) {
        s.window = s.spin = s.walk = 0;
      }
    }
  }
  function think(e) {
    const b = e.ai;
    if (!C.free(e) || b.socialAction || b.taunt || S.time < b.walkAwayUntil) return;
    let target = b.target;
    if (!target || target.dead || e.pos.distanceTo(target.pos) > 125 || S.time > (b.pickAt || 0)) {
      target = b.target = choose(e);
      b.pickAt = S.time + 1.3 + rng();
    }
    if (!target) {
      b.state = 'roaming';
      if (!b.goal || e.pos.distanceTo(b.goal) < 3 || b.wander <= 0) {
        goal(e, spawnPoint(Math.floor(rng() * 16), e.pos));
        b.wander = 5 + rng() * 5;
      }
      return;
    }
    const m = remember(e, target),
      visible = F.actors.visible(e.pos.clone().add(V(0, 3, 0)), target.pos.clone().add(V(0, 3, 0)));
    if (visible) {
      m.pos.copy(target.pos);
      m.seen = S.time;
    } else if (S.time - m.seen > 5) {
      b.target = null;
      b.pickAt = 0;
      return;
    }
    const distance = e.pos.distanceTo(m.pos);
    b.state = b.revenge === actorId(target) ? 'seeking revenge' : 'fighting';
    const toward = m.pos.clone().sub(e.pos).setY(0).normalize(),
      angle = Math.atan2(toward.x, toward.z);
    C.turn(e, angle, 0.1, 12);
    if (!visible || distance > 25 || Math.abs(target.pos.y - e.pos.y) > 3) {
      goal(e, m.pos);
      return;
    }
    m.guard = m.guard * 0.8 + (target.blocking ? 0.2 : 0);
    const ta = target.action || target.bcFall || (target.net && MPJJ.fighters[target.net.id]?.action);
    if (ta && (ta.type !== b.observed?.type || ta.t < b.observed.t - 0.05)) {
      b.reactAt = S.time + b.react;
    }
    b.observed = ta ? { type: ta.type, t: ta.t } : null;
    if (
      distance < 7 &&
      ta &&
      S.time >= b.reactAt &&
      ['bc_m1', 'bc_dash', 'ai_skill'].includes(ta.type) &&
      rng() < 0.83
    ) {
      if (target.blocking || m.guard > 0.65) {
        if (C.dash(e, target, 'side', b.strafe)) {
          b.plan = 'flank combo';
          b.goal = null;
          return;
        }
      }
      if (C.guard(e, 0.18 + rng() * 0.3)) {
        b.goal = null;
        return;
      }
      if (C.dash(e, target, 'back')) {
        b.goal = null;
        return;
      }
    }
    if (e.action) {
      if (
        b.confirm &&
        e.action.type === 'bc_m1' &&
        e.action.n === 1 &&
        e.action.t >= e.action.start + 0.16 &&
        rng() < 0.7
      ) {
        if (C.skill(e, target, b.skillBias > 0.5 ? 1 : 0)) {
          b.history.push('hit-confirm technique');
          return;
        }
      }
      return;
    }
    if (e.blocking) return;
    if (distance < 8 && (target.blocking || m.guard > 0.45) && rng() < 0.85) {
      if (C.dash(e, target, 'side', b.strafe)) {
        b.plan = 'flank combo';
        b.history.push('rotate behind guard');
        b.goal = null;
        return;
      }
      if (e.onGround && distance < 5 && b.combo === 3) {
        jump(e);
        b.plan = 'downslam';
      }
    }
    if (distance <= 5.2) {
      b.goal = distance > 3.2 ? m.pos.clone() : null;
      if (b.combo === 3 && b.plan === 'downslam' && !e.onGround) {
        C.m1(e, target, 'down');
        return;
      }
      if (b.combo === 0 && distance < 4 && rng() < 0.12) {
        C.guard(e, 0.22);
        return;
      }
      if (C.m1(e, target, b.combo === 3 && rng() < 0.45 ? 'up' : 'normal')) {
        if (b.plan === 'flank combo') {
          b.history.push('side dash + rotation + M1');
          b.plan = null;
        }
        return;
      }
    } else if (distance < 20 && C.dash(e, target, 'front')) {
      b.goal = null;
      return;
    }
    if (distance > 7 && distance < 27 && b.techCD[0] <= 0 && rng() < 0.45 && C.skill(e, target, 0)) {
      b.goal = null;
      return;
    }
    const lead = m.pos.clone().addScaledVector(target.vel || V(), Math.min(0.22, distance / 50));
    if (distance < 10) lead.addScaledVector(V(toward.z, 0, -toward.x), b.strafe * 2.5);
    goal(e, lead);
  }
  function navigate(e, dt) {
    const b = e.ai,
      p = b.goal;
    if (!p) return V();
    const distance = e.pos.distanceTo(p);
    if (distance < 1.1) {
      b.goal = null;
      b.path = [];
      return V();
    }
    // Jump momentum is handled by physics; traversal links start from a floor.
    if (!e.onGround) return N.steer(e, p, actors());
    if (N.walk(e.pos, p)) {
      b.path = [];
      return N.steer(e, p, actors());
    }
    if (b.pathT <= 0 && b.pathPending <= 0) {
      b.pathT = 1.2 + rng() * 0.5;
      b.pathPending = 0.8;
      const expected = epoch;
      N.request(
        e.pos,
        p,
        (path, complete) => {
          if (!S.active || epoch !== expected || !bots.includes(e)) return;
          b.path = path;
          b.pathPending = 0;
          if (!complete && !path.length) {
            b.pathT = 2;
            b.target = null;
            b.pickAt = S.time + 2;
          }
        },
        b.id
      );
    }
    while (b.path.length && e.pos.distanceTo(b.path[0].p) < 1.1) b.path.shift();
    const waypoint = b.path[0];
    if (!waypoint) return N.steer(e, p, actors());
    if (waypoint.link) {
      const l = waypoint.link;
      if (e.pos.distanceTo(l.from) > 1.25) return N.steer(e, l.from, actors());
      if (C.free(e) && !e.action && !e.blocking) {
        if (!l.path.slice(1).every((q, i) => N.segment(l.path[i], q))) {
          b.path = [];
          b.pathT = 0;
          return V();
        }
        e.action = { type: l.type === 'drop' ? 'pk_kick' : l.type, t: 0, dur: l.dur, link: l, side: 1 };
        e.blocking = false;
        e.onGround = false;
        b.state = l.type === 'pk_climb' ? 'climbing' : 'vaulting';
        C.turn(e, l.end, 1);
        b.history.push(l.type);
        b.path.shift();
        return V();
      }
    }
    return N.steer(e, waypoint.p, actors());
  }
  function traversal(e, a) {
    const l = a.link,
      k = Math.min(1, a.t / a.dur);
    let at;
    if (l.type === 'pk_climb') {
      const times = [0, 0.3, 0.72, 1];
      let i = 0;
      while (i < 2 && k > times[i + 1]) i++;
      let f = (k - times[i]) / (times[i + 1] - times[i]);
      f = f * f * (3 - 2 * f);
      at = l.path[i].clone().lerp(l.path[i + 1], f);
    } else {
      const i = Math.min(l.path.length - 2, Math.floor(k * (l.path.length - 1))),
        f = k * (l.path.length - 1) - i;
      at = l.path[i].clone().lerp(l.path[i + 1], f * f * (3 - 2 * f));
    }
    if (N.occupied(at)) {
      e.action = null;
      e.ai.path = [];
      e.ai.pathT = 0;
      return;
    }
    e.pos.copy(at);
    e.vel.set(0, 0, 0);
    e.__jjsLast = e.pos.clone();
    if (k >= 1) {
      e.pos.copy(l.end);
      e.action = null;
      e.onGround = true;
      e.ai.pathT = 0;
    }
  }
  function socialStep(e, dt) {
    const b = e.ai,
      s = b.socialAction;
    if (!s) return false;
    s.t += dt;
    const source = actor(s.source);
    if (!source || source.dead || s.t > 1.65) {
      b.socialAction = null;
      b.goal = null;
      e.blocking = false;
      b.state = 'roaming';
      return false;
    }
    C.turn(e, source.pos, dt);
    e.blocking = s.kind === 'double block' && (s.t < 0.26 || (s.t > 0.53 && s.t < 0.83));
    b.guardT = e.blocking ? 0.1 : 0;
    if (s.kind === 'backstep jump') {
      goal(e, e.pos.clone().addScaledVector(e.pos.clone().sub(source.pos).setY(0).normalize(), 4));
      if (s.t > 0.3 && !s.jumped) {
        s.jumped = true;
        jump(e);
      }
    } else b.goal = null;
    return true;
  }
  function tauntStep(e, dt) {
    const b = e.ai,
      t = b.taunt;
    if (!t) return false;
    t.t += dt;
    const victim = actor(t.victim);
    if (t.t > 2.25 || (victim && !victim.dead)) {
      b.taunt = null;
      e.blocking = false;
      b.guardT = 0;
      b.walkAwayUntil = S.time + 5;
      b.target = null;
      b.state = 'walking away';
      const away = e.pos.clone().sub(t.pos).setY(0);
      if (away.lengthSq() < 0.01) away.set(Math.sin(e.facing + Math.PI), 0, Math.cos(e.facing + Math.PI));
      goal(e, e.pos.clone().addScaledVector(away.normalize(), 15));
      b.history.push('walk away after revenge');
      return false;
    }
    C.turn(e, t.pos, dt);
    if (e.pos.distanceTo(t.pos) > 3) {
      goal(e, t.pos);
      return true;
    }
    b.goal = null;
    const phase = Math.floor(t.t / 0.2);
    e.blocking = phase % 2 === 0;
    b.guardT = e.blocking ? 0.1 : 0;
    const d = V(Math.sin(e.facing), 0, Math.cos(e.facing)).multiplyScalar(phase % 2 ? 1 : -1);
    F.actors.sweepMove(e, d.multiplyScalar(dt * 3));
    return true;
  }
  const beforeEnemyUpdate = Enemy.prototype.update;
  Enemy.prototype.update = function (dt) {
    if (!this.ai) return beforeEnemyUpdate.call(this, dt);
    const e = this,
      b = e.ai;
    if (!S.active) return;
    if (b.remote) {
      remoteStep(e, dt);
      return;
    }
    if (!MPJJ.active && !gameInputActive()) return;
    if (
      e.dead ||
      e.rag ||
      e.bcFall ||
      e.frameT > 0 ||
      e.stunT > 0 ||
      e.anchorT > 0 ||
      e.lockT > 0 ||
      e.cineHold ||
      e.tdHold ||
      e.mhConsumed
    ) {
      e.action = null;
      e.blocking = false;
      C.tick(e, dt);
      beforeEnemyUpdate.call(e, dt);
      return;
    }
    e.iframes = Math.max(0, (e.iframes || 0) - dt);
    e.animT += dt;
    e.bcGuardHit = Math.max(0, (e.bcGuardHit || 0) - dt);
    for (const k of ['pathT', 'pathPending', 'wander', 'think']) b[k] -= dt;
    const sociallyBusy = tauntStep(e, dt) || socialStep(e, dt);
    if (!sociallyBusy && b.think <= 0) {
      b.think = nearPlayer(e) ? 0.07 + rng() * 0.06 : 0.18 + rng() * 0.1;
      think(e);
    }
    const a = e.action;
    C.tick(e, dt);
    if (a?.link) {
      traversal(e, a);
    } else {
      const d = !e.action || e.action.type === 'bc_m1' ? navigate(e, dt) : V();
      const speed = e.blocking
        ? 3.4
        : e.action?.type === 'bc_m1'
          ? 4.8
          : b.state === 'fighting' || b.revenge
            ? 12.5
            : 7.2;
      e.vel.x += (d.x * speed - e.vel.x) * Math.min(1, dt * 12);
      e.vel.z += (d.z * speed - e.vel.z) * Math.min(1, dt * 12);
      const y = e.pos.y;
      e.vel.y -= 30 * dt;
      F.actors.sweepMove(e, V(e.vel.x * dt, 0, e.vel.z * dt));
      e.pos.y += e.vel.y * dt;
      resolveActorWorld(e, y, 1);
      if (!b.target && d.lengthSq() > 0.1) C.turn(e, e.pos.clone().add(d), dt, 7);
    }
    b.checkT += dt;
    if (b.checkT > 0.8) {
      const traveled = b.lastPos.distanceTo(e.pos);
      if (b.goal && e.pos.distanceTo(b.goal) > 1.5 && traveled < 0.15 && !e.action && !e.blocking) {
        b.stuck++;
        b.path = [];
        b.pathT = 0;
        if (b.stuck === 2) jump(e);
        if (b.stuck > 3) {
          b.target = null;
          b.goal = spawnPoint(Math.floor(rng() * 10), e.pos);
          b.pickAt = S.time + 3;
          b.stuck = 0;
        }
      } else b.stuck = 0;
      b.lastPos.copy(e.pos);
      b.checkT = 0;
    }
    b.gait += dt * (4.2 + Math.hypot(e.vel.x, e.vel.z) * 0.92);
    if (e.react) {
      e.react.t += dt;
      if (e.react.t >= e.react.dur) e.react = null;
    }
    e.hp = Math.min(e.maxHp, e.hp + dt * 0.65);
    C.pose(e);
    e.rig.root.visible = nearPlayer(e, 180);
  };
  const beforeDamage = Enemy.prototype.damage;
  Enemy.prototype.damage = function (amount, knock, opts = {}) {
    if (!this.ai) return beforeDamage.call(this, amount, knock, opts);
    if (this.ai.remote) {
      pub({
        t: 'ai-hit-bot',
        to: hostId,
        bot: this.ai.id,
        d: amount,
        k: knock?.toArray() || [0, 0, 0],
        bc: opts.combat ? F.hitData(opts.combat) : null,
        st: opts.stun || 0.35,
        seq: ++serial
      });
      return;
    }
    const before = this.hp,
      prior = this.ai.lastAttacker;
    this.ai.lastAttacker = 'human:' + MPJJ.id;
    const result = beforeDamage.call(this, amount, knock, opts);
    if (this.hp < before && !this.dead) damaged(this, player);
    else this.ai.lastAttacker = prior;
    return result;
  };
  const beforeDirect = Enemy.prototype.directDamage;
  Enemy.prototype.directDamage = function (amount, color, canKill) {
    if (this.ai?.remote) {
      this.damage(canKill ? amount : Math.min(amount, Math.max(0, this.hp - 1)), V(), { stun: 0.1 });
      return;
    }
    if (this.ai) this.ai.lastAttacker = 'human:' + MPJJ.id;
    return beforeDirect.apply(this, arguments);
  };
  const beforeDie = Enemy.prototype.die;
  Enemy.prototype.die = function () {
    if (this.ai && !this.dead) {
      killed(this, actor(this.ai.lastAttacker));
      eNoAction(this);
    }
    return beforeDie.apply(this, arguments);
  };
  const beforeRespawn = Enemy.prototype.respawn;
  Enemy.prototype.respawn = function () {
    if (this.ai) {
      this.spawn.copy(spawnPoint(Math.floor(rng() * 16)));
      this.ai.path = [];
      this.ai.pathT = 0;
      this.ai.combo = 0;
      this.ai.comboReset = 0;
      this.ai.techCD = [1, 2];
      this.ai.target = null;
      this.ai.state = this.ai.revenge ? 'seeking revenge' : 'roaming';
      this.action = null;
    }
    const r = beforeRespawn.apply(this, arguments);
    if (this.ai) this.iframes = 2;
    return r;
  };
  const beforeHurt = hurtPlayer;
  hurtPlayer = function (amount, knock, opts) {
    const hp = player.hp,
      was = player.dead,
      source = opts?.aiSource ? bots.find((e) => e.ai.id === opts.aiSource) : null;
    const result = beforeHurt.apply(this, arguments);
    if (S.active && source && player.hp < hp && !was && player.dead) killed(player, source);
    return result;
  };
  function snapshot(to) {
    if (!S.active || !S.authority || !MPJJ.active) return;
    pub({
      t: 'ai-state',
      to,
      seq: ++serial,
      map: JJMAP.id,
      bots: bots.map((e) => {
        const a = e.bcFall || e.action;
        return {
          id: e.ai.id,
          n: e.ai.name,
          c: e.char,
          p: e.pos.toArray(),
          v: e.vel.toArray(),
          y: e.facing,
          hp: e.hp,
          dead: e.dead,
          bl: e.blocking,
          iv: e.iframes || 0,
          k: e.ai.kills,
          d: e.ai.deaths,
          mode: e.ai.mode,
          state: e.ai.state,
          og: e.onGround,
          a: a
            ? {
                type: a.type,
                id: a.id,
                t: a.t,
                dur: a.dur,
                pose: F.pack(a),
                kind: a.kind,
                slot: a.slot,
                side: a.side
              }
            : null
        };
      })
    });
  }
  function remoteStep(e, dt) {
    const b = e.ai,
      s = b.remoteState;
    if (!s) return;
    e.pos.lerp(V(...s.p), Math.min(1, dt * 18));
    e.vel.fromArray(s.v);
    C.turn(e, s.y, dt, 18);
    e.animT += dt;
    b.gait += dt * (4.2 + e.vel.length() * 0.92);
    if (e.action) {
      e.action.t = Math.min(e.action.dur, e.action.t + dt);
      if (e.action.type === 'ai_skill' && e.action.t >= e.action.start && b.visualId !== e.action.id) {
        b.visualId = e.action.id;
        C.techFX(e, { ...e.action, dir: V(Math.sin(e.facing), 0, Math.cos(e.facing)) });
      }
    }
    C.pose(e);
    e.rig.root.visible = nearPlayer(e, 180);
  }
  function acceptHit(m) {
    const tag = m.id + ':' + m.bot + ':' + (m.bc ? 'swing:' + m.bc.id : 'hit:' + m.seq);
    if (seenHits.has(tag)) return false;
    seenHits.set(tag, S.time);
    if (seenHits.size > 1024) seenHits.delete(seenHits.keys().next().value);
    return true;
  }
  function receive(m) {
    if ((m.t === 'hi' || m.t === 'hi2' || m.t === 'map') && m.host && !MPJJ.host) {
      if (!hostId || hostId === m.id) hostId = m.id;
    }
    if (m.t === 'hi' || m.t === 'hi2') {
      if (S.active && S.authority) snapshot(m.id);
      return false;
    }
    if (m.t === 'bye' && m.id === hostId) {
      stop(false);
      hostId = null;
      return false;
    }
    if (!String(m.t).startsWith('ai-')) return false;
    if (m.to && m.to !== MPJJ.id) return true;
    if (m.t === 'ai-state') {
      if (
        MPJJ.host ||
        !MPJJ.joined ||
        m.id !== hostId ||
        typeof m.epoch !== 'string' ||
        !Array.isArray(m.bots) ||
        m.bots.length > 16 ||
        !Number.isSafeInteger(m.seq)
      )
        return true;
      if (!S.active || epoch !== m.epoch) {
        start(0, { remote: true });
        epoch = m.epoch;
        rxSeq = -1;
      }
      if (m.seq <= rxSeq) return true;
      rxSeq = m.seq;
      rxAt = S.time;
      const valid = m.bots.filter(
        (s) =>
          typeof s.id === 'string' &&
          s.id.startsWith('ai:' + epoch + ':') &&
          CHARS[s.c] &&
          Array.isArray(s.p) &&
          s.p.length === 3 &&
          s.p.every((n) => Number.isFinite(n) && Math.abs(n) < 2000) &&
          Array.isArray(s.v) &&
          s.v.length === 3 &&
          s.v.every(Number.isFinite) &&
          Number.isFinite(s.hp) &&
          Number.isFinite(s.y)
      );
      for (const s of valid) {
        let e = bots.find((e) => e.ai.id === s.id);
        if (!e) e = make(s.id, String(s.n).slice(0, 12), s.c, V(...s.p), true);
        if (e.char !== s.c) rig(e, s.c);
        e.ai.remoteState = s;
        e.hp = Math.max(0, Math.min(100, s.hp));
        e.dead = !!s.dead;
        e.onGround = s.og !== false;
        e.blocking = !!s.bl;
        e.iframes = Math.max(0, Math.min(3, s.iv || 0));
        e.ai.kills = s.k || 0;
        e.ai.deaths = s.d || 0;
        e.ai.state = s.state;
        e.ai.mode = s.mode || 0;
        const a = s.a;
        e.action =
          a && typeof a.type === 'string' && Number.isFinite(a.t) && Number.isFinite(a.dur)
            ? {
                type: a.type,
                id: a.id,
                t: a.t,
                dur: Math.max(0.1, a.dur),
                kind: a.kind,
                slot: a.slot,
                start: a.pose?.start || 0.24,
                side: a.side === -1 ? -1 : 1
              }
            : null;
        F.unpack(e.action, s.a?.pose);
        e.bcFall = e.action?.type === 'bc_fall' ? e.action : null;
        e.drawBars();
      }
      refreshUI();
      return true;
    }
    if (!S.active || m.epoch !== epoch) return true;
    if (m.t === 'ai-stop' && m.id === hostId) {
      stop(false);
      return true;
    }
    if (m.t === 'ai-hit-bot' && S.authority) {
      const source = MPJJ.fighters[m.id]?.e,
        target = bots.find((e) => e.ai.id === m.bot);
      if (
        !source ||
        !target ||
        !Number.isSafeInteger(m.seq) ||
        !Number.isFinite(m.d) ||
        m.d <= 0 ||
        m.d > 200 ||
        !Array.isArray(m.k) ||
        m.k.length !== 3 ||
        !m.k.every(Number.isFinite) ||
        (m.bc && !Number.isSafeInteger(m.bc.id)) ||
        source.pos.distanceTo(target.pos) > 120 ||
        !acceptHit(m)
      )
        return true;
      const h = m.bc,
        meta = {
          source: source.pos.clone(),
          guardable: !!h?.g,
          breakGuard: !!h?.b,
          stun: Math.min(1.5, Math.max(0.1, h?.st || m.st || 0.35)),
          down: Math.min(2, Math.max(0, h?.down || 0)),
          variant: h?.v || 'normal'
        };
      takeBotHit(target, m.d, V(...m.k).clampLength(0, 100), meta, source);
      return true;
    }
    if (m.t === 'ai-hit-player' && m.id === hostId && m.to === MPJJ.id) {
      const e = bots.find((e) => e.ai.id === m.bot);
      if (
        !e ||
        !m.bc ||
        !Number.isFinite(m.d) ||
        m.d > 200 ||
        !Array.isArray(m.k) ||
        m.k.length !== 3 ||
        !m.k.every(Number.isFinite)
      )
        return true;
      const h = { ...m, id: m.bot, bc: m.bc, kx: m.k[0], ky: m.k[1], kz: m.k[2] };
      const hp = player.hp;
      F.networkHit(h);
      pub({
        t: 'ai-hit-result',
        to: hostId,
        bot: m.bot,
        attack: m.bc.id,
        hit: player.hp < hp,
        dead: player.hp < hp && player.dead
      });
      return true;
    }
    if (m.t === 'ai-hit-result' && S.authority) {
      const key = m.id + ':' + m.bot + ':' + m.attack,
        at = pendingHits.get(key);
      pendingHits.delete(key);
      const source = bots.find((e) => e.ai.id === m.bot),
        target = MPJJ.fighters[m.id]?.e;
      if (at === undefined || S.time - at > 3 || !source || !target) return true;
      if (m.hit) {
        source.ai.confirm = true;
        source.ai.lastHit = S.time;
      }
      if (m.dead && !target.dead) {
        target.dead = true;
        target.hp = 0;
        killed(target, source);
      }
      return true;
    }
    return true;
  }
  const beforeUpdate = updatePlayer;
  updatePlayer = function (dt) {
    beforeUpdate(dt);
    if (!S.active) return;
    if (S.authority && !MPJJ.active && !gameInputActive()) return;
    S.time += dt;
    if (!S.authority) {
      if (S.time - rxAt > 12) stop(false);
      return;
    }
    if (lastRoot !== JJJJS.root) onMap();
    N.step(dt);
    detectSignals(dt);
    sent += dt;
    uiT += dt;
    if (sent > 0.12) {
      sent = 0;
      snapshot();
    }
    if (uiT > 0.4) {
      uiT = 0;
      refreshUI();
    }
  };
  function refreshUI() {
    const hud = document.getElementById('jjAIHud');
    if (!hud) return;
    hud.hidden = !S.active;
    document.getElementById('jjAIStop').hidden = !S.active || !S.authority;
    hud.querySelector('.aiCount').textContent = bots.length + ' AI FIGHTERS · VERY HARD';
    hud.querySelector('.aiScores').replaceChildren(
      ...bots
        .slice()
        .sort((a, b) => b.ai.kills - a.ai.kills)
        .slice(0, 5)
        .map((e) => {
          const row = document.createElement('div');
          row.textContent =
            e.ai.name + ' · ' + CHARS[e.char].name.split(' ')[0] + '   ' + e.ai.kills + ' / ' + e.ai.deaths;
          return row;
        })
    );
  }
  function joinUI() {
    const count = Number(document.getElementById('jjAICount').value) || 12;
    if (MPJJ.joined && MPJJ.host && !MPJJ.active) {
      pending = count;
      document.getElementById('jjFight').click();
      return;
    }
    if (MPJJ.joined && !MPJJ.host) {
      document.getElementById('jjAIInfo').textContent =
        'The room host controls AI fighters. Leave this room to start your own AI Server.';
      return;
    }
    if (!MPJJ.joined) JJMAP.load(MPJJ.map);
    start(count);
  }
  function installUI() {
    const style = document.createElement('style');
    style.textContent =
      '#jjAICard{border:1px solid #776852;padding:14px;margin:14px 0;background:#22242a}#jjAICard h3{margin:0 0 8px;color:#ffe3b0;font:700 19px Arial}#jjAICard p{font:13px/1.5 Arial;color:#cfced2;margin:5px 0 12px}#jjAICard .aiRow{display:flex;gap:8px;align-items:center;flex-wrap:wrap}#jjAICount{background:#10141c;color:white;padding:9px;border:1px solid #6e737e}#jjAIJoin,#jjAIStop{padding:9px 12px;background:#343943;color:#fff;border:1px solid #a39a86;cursor:pointer}#jjAIHud{position:fixed;right:14px;top:130px;padding:11px;background:#161b24d9;color:#e5e6e9;font:12px/1.7 Arial;z-index:14;pointer-events:none;max-width:260px}#jjAIHud strong{color:#ffe2b2}#jjAIHud[hidden]{display:none}#jjLobby .box{max-height:92vh;overflow-y:auto}@media(max-width:600px){#jjAIHud{top:80px;right:6px;font-size:10px;max-width:175px}.aiScores{display:none}}';
    document.head.appendChild(style);
    style.textContent += '#jjAICard .aiRow label{color:#e5e6e9;font-size:12px}';
    const card = document.createElement('section');
    card.id = 'jjAICard';
    card.innerHTML =
      '<h3>AI Server</h3><p>Random fighters. Free-for-all battles. Combos, flanking, wall climbs and rivalries.</p><div class="aiRow"><label for="jjAICount">AI players</label><select id="jjAICount"><option>8</option><option selected>12</option><option>16</option></select><button id="jjAIJoin" type="button">JOIN AI SERVER</button><button id="jjAIStop" type="button" hidden>END AI SESSION</button></div><p id="jjAIInfo">Play locally, or add AI fighters to a room you host. Double-block or walk in a circle to signal nearby fighters. Some respond; some ignore you.</p>';
    document.querySelector('#jjLobby .sub').after(card);
    document.getElementById('jjAIJoin').addEventListener('click', joinUI);
    document.getElementById('jjAIStop').addEventListener('click', () => stop());
    const quick = document.createElement('button');
    quick.type = 'button';
    quick.id = 'jjAIQuick';
    quick.textContent = 'AI SERVER';
    quick.addEventListener('click', (e) => {
      e.stopPropagation();
      document.getElementById('jjOnline').click();
      card.scrollIntoView({ block: 'nearest' });
    });
    document.querySelector('#menu .menu-actions').appendChild(quick);
    const hud = document.createElement('aside');
    hud.id = 'jjAIHud';
    hud.hidden = true;
    hud.innerHTML = '<strong>AI SERVER</strong><div class="aiCount"></div><div class="aiScores"></div>';
    document.body.appendChild(hud);
    refreshUI();
  }
  if (document.getElementById('jjLobby')) installUI();
  else document.addEventListener('DOMContentLoaded', installUI);
})();
