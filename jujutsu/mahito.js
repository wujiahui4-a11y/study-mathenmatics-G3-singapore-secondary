/* Perfection, base + Essence of the Soul only.
   Reference: https://jujutsu-shenanigans.fandom.com/wiki/Perfection
   Named moves, arm-mode variants and documented damage/cooldowns follow the
   reference. Timings, voxel art, sound synthesis and animation are authored
   for this Three.js arena. There is deliberately no second awakening. */
(function () {
  'use strict';
  var VOX = window.JJMAHITOVOX,
    FX = window.JJFX,
    C = VOX.colors;
  var V = (x, y, z) => new THREE.Vector3(x || 0, y || 0, z || 0),
    DIR = (y) => V(Math.sin(y), 0, Math.cos(y));
  var clamp = (x) => Math.max(0, Math.min(1, x));
  var M = (window.JJMAHITO = {
    mode: 0,
    active: false,
    remaining: 0,
    charge: 0,
    basePage: false,
    modeCD: 0,
    reserves: [],
    held: null,
    items: [],
    effects: new Set(),
    marks: new Map(),
    domain: null,
    grabbed: null,
    remote: {},
    secondAwakening: false
  });
  var KIT = (M.kit = {
    mh_stock: { name: 'Stockpile', cd: 12, dur: 1.05, damage: 12, slot: 'mh1' },
    mh_air: { name: 'Aerial Stockpile', cd: 12, dur: 1.3, damage: 10, slot: 'mh1' },
    mh_fire: { name: 'Soul Fire', cd: 12, dur: 1.5, damage: 12, slot: 'mh2' },
    mh_focus: { name: 'Focus Strike', cd: 15, dur: 1.15, damage: 10, slot: 'mh3' },
    mh_black: { name: 'Focus Strike · Black Flash', cd: 15, dur: 1.15, damage: 12, slot: 'mh3' },
    mh_chain: { name: 'Chainwhip', cd: 15, dur: 1.3, damage: 3, slot: 'mh3' },
    mh_home: { name: 'Homerun', cd: 15, dur: 1.4, damage: 18, slot: 'mh3' },
    mh_repel: { name: 'Body Repel', cd: 20, dur: 0.95, damage: 14, slot: 'mh4' },
    mh_ride: { name: 'Body Repel · Ride', cd: 20, dur: 2.95, damage: 14, slot: 'mh4' },
    mh_blade_dash: { name: 'Blade Dash', cd: 8, dur: 0.7, damage: 6.5, slot: 'mhd' },
    mh_club_dash: { name: 'Club Dash', cd: 10, dur: 0.75, damage: 8.5, slot: 'mhd' },
    mh_awaken: { name: 'Essence of the Soul', cd: 0, dur: 2.2, damage: 15, slot: 'mhAw' },
    mh_awblack: { name: 'Awakening Black Flash', cd: 15, dur: 1.8, damage: 10, slot: 'mha1' },
    mh_idle: { name: 'Idle Transfiguration', cd: 15, dur: 2.1, damage: 15, slot: 'mha1' },
    mh_drill: { name: 'Drill Splitter', cd: 15, dur: 2.0, damage: 35, slot: 'mha2' },
    mh_heart: { name: 'Heart Piercer', cd: 15, dur: 4.7, damage: 45, slot: 'mha2' },
    mh_grab: { name: 'Force Grab', cd: 15, dur: 6, damage: 5, slot: 'mha2' },
    mh_spike: { name: 'Spike Wrath', cd: 25, dur: 3.8, damage: 25, slot: 'mha3' },
    mh_domain: { name: 'Embodiment of Self Perfection', cd: 120, dur: 2.5, damage: 0, slot: 'mha4' }
  });
  Object.values(KIT).forEach((k) => (cds[k.slot] = 0));
  var FINISHERS = (M.finishers = {
    mh_air: 'HAMMER CRUSH',
    mh_focus: 'SOUL RESERVES',
    mh_black: 'TRANSFIGURED FLESH',
    mh_home: 'HOMERUN',
    mh_blade_dash: 'BISECTION'
  });
  var CFG = { mahito: true, face: false, skin: C.skin, torso: C.cloth, pants: C.black, shoes: C.black };
  function barMoves() {
    var awake = M.active && !M.basePage;
    var ids = awake
      ? ['mh_idle', ['mh_drill', 'mh_heart', 'mh_grab'][M.mode], 'mh_spike', 'mh_domain']
      : ['mh_stock', 'mh_fire', ['mh_focus', 'mh_chain', 'mh_home'][M.mode], 'mh_repel'];
    return [
      { key: 'LMB', lbl: ['Punch', 'Blade M1', 'Club M1'][M.mode], cd: 'm1', max: 0.32 },
      {
        key: 'Q',
        lbl: M.mode ? ['', 'Blade Dash', 'Club Dash'][M.mode] : 'Dash',
        cd: M.mode ? 'mhd' : 'dash',
        max: M.mode === 1 ? 8 : M.mode === 2 ? 10 : 1
      }
    ]
      .concat(
        ids.map((id, i) => ({ key: String(i + 1), lbl: KIT[id].name, cd: KIT[id].slot, max: KIT[id].cd }))
      )
      .concat([{ key: 'R', lbl: ['Normal Arms', 'Blade Arms', 'Club Arms'][M.mode], cd: 'mhMode', max: 1 }]);
  }
  CHARS.mahito = {
    name: 'MAHITO',
    sub: 'PERFECTION · IDLE TRANSFIGURATION',
    cfg: CFG,
    glow: '#79eee0',
    moves: barMoves()
  };
  CHARS.mahito.portrait = makePortrait(CFG);
  buildCharList();
  function refresh() {
    CHARS.mahito.moves = barMoves();
    if (player.char === 'mahito') buildMovesBar();
  }
  function mine() {
    return player.char === 'mahito';
  }
  function valid() {
    return (
      started &&
      gameInputActive() &&
      mine() &&
      !player.dead &&
      !player.react &&
      player.frameT <= 0 &&
      !M.grabbed
    );
  }
  function send(packet) {
    var mp = window.MPJJ;
    if (mp && mp.active && mp.relay) mp.relay.pub(Object.assign({ id: mp.id }, packet));
  }
  function notice(text) {
    if (window.JJNOTICE) JJNOTICE(text, '#79eee0');
  }
  function effect(g, life, update, owner, done) {
    scene.add(g);
    var o = { g, t: 0, life, owner: owner !== false, dead: false, done };
    M.effects.add(o);
    addFx({
      update: function (dt) {
        if (o.dead) return false;
        o.t += dt;
        if (update) update(o.t, dt, o);
        if (o.t >= o.life) {
          discard(o);
          return false;
        }
        return true;
      }
    });
    return o;
  }
  function discard(o) {
    if (!o || o.dead) return;
    o.dead = true;
    M.effects.delete(o);
    VOX.dispose(o.g);
    if (o.done) o.done();
  }
  M.effect = effect;
  M.discard = discard;
  function solid(parent, w, h, d, c, x, y, z) {
    var m = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, flatShading: true })
    );
    m.position.set(x || 0, y || 0, z || 0);
    m.geometry.userData.voxel = true;
    parent.add(m);
    return m;
  }
  function stroke(points, color, width, life, owner) {
    var g = new THREE.Group();
    VOX.sculpt(g, 'Stepped cursed-energy seam', width || 0.12)
      .stroke(
        points.map((p) => p.toArray()),
        width || 0.12,
        color
      )
      .bake();
    g.traverse((o) => {
      if (o.isMesh) {
        o.material.emissive = new THREE.Color(color);
        o.material.emissiveIntensity = 0.65;
      }
    });
    return effect(
      g,
      life || 0.35,
      (t, dt, o) => {
        g.scale.setScalar(1 + t * 0.1);
      },
      owner
    );
  }
  function impact(pos, black, owner) {
    if (black) {
      var g = new THREE.Group();
      g.position.copy(pos);
      for (var i = 0; i < 12; i++) {
        var a = (i / 12) * Math.PI * 2,
          rad = 1.2 + (i % 3) * 0.7;
        var s = VOX.sculpt(g, 'Angular impact shard', 0.12);
        s.stroke(
          [
            [0, 0, 0],
            [Math.cos(a) * rad, Math.sin(a) * rad, ((i % 3) - 1) * 0.25],
            [Math.cos(a) * rad * 1.8, Math.sin(a) * rad * 1.8, ((i % 3) - 1) * 0.4]
          ],
          0.12,
          i % 2 ? 0x130b16 : 0xe34359
        );
        s.bake();
      }
      effect(
        g,
        0.36,
        (t) => {
          g.scale.setScalar(0.4 + t * 4);
          g.rotation.z = t * 0.4;
        },
        owner
      );
    }
    FX.slash(pos, V(0, 1, 0), black ? 0xee2948 : C.soul, black ? 10 : 5, 0.2);
    if (owner !== false) {
      addShake(black ? 0.65 : 0.18);
      if (black) {
        FX.flash('#ffffff', 0.15, 0.08);
        hitstop(0.08);
      }
      sfx.punch();
    }
  }
  function trail(from, to, black, owner) {
    var points = [];
    for (var i = 0; i < 8; i++) {
      var p = from.clone().lerp(to, i / 7);
      p.x += (i % 2 ? 1 : -1) * 0.2;
      p.y += Math.sin(i * 1.8) * 0.3;
      points.push(p);
    }
    stroke(points, black ? 0xf23650 : C.soul, 0.1, 0.3, owner);
  }
  function worm() {
    var g = new THREE.Group();
    g.userData.segments = [];
    for (var i = 0; i < 13; i++) {
      var seg = new THREE.Group();
      g.add(seg);
      g.userData.segments.push(seg);
      solid(seg, 1.5 - i * 0.055, 1.3 - i * 0.035, 1.3, i % 2 ? C.green : C.purple);
      if (i % 3 === 0) {
        solid(seg, 0.6, 0.35, 0.15, C.skin, 0, 0.28, 0.69);
        solid(seg, 0.15, 0.15, 0.1, C.black, -0.18, 0.35, 0.79);
        solid(seg, 0.15, 0.15, 0.1, C.black, 0.18, 0.35, 0.79);
        solid(seg, 0.4, 0.13, 0.1, C.black, 0, 0.05, 0.79);
      }
    }
    return g;
  }
  function poseWorm(g, t) {
    g.userData.segments.forEach(function (s, i) {
      s.position.set(
        Math.sin(t * 7 - i * 0.8) * (0.3 + i * 0.035),
        Math.sin(t * 5 - i * 0.65) * 0.3,
        -i * 0.73
      );
      s.rotation.z = Math.sin(t * 5 - i * 0.9) * 0.15;
    });
  }
  function burstWorms(origin, owner) {
    for (var i = 0; i < 8; i++) {
      var g = worm(),
        a = (i / 8) * Math.PI * 2,
        d = DIR(a);
      g.rotation.y = a;
      g.scale.setScalar(0.5);
      effect(
        g,
        1.4,
        (t) => {
          poseWorm(g, t);
          g.position
            .copy(origin)
            .addScaledVector(d, t * 12)
            .add(V(0, 1 + Math.sin((t / 1.4) * Math.PI) * 3, 0));
        },
        owner
      );
    }
    impact(origin.clone().add(V(0, 2, 0)), false, owner);
  }
  function lineTargets(origin, d, reach, width, minY, maxY) {
    return enemies.filter(function (e) {
      if (!e || e.dead || e.mhConsumed) return false;
      var v = e.pos.clone().sub(origin),
        along = v.dot(d),
        side = v.x * d.z - v.z * d.x;
      return (
        along >= -1 &&
        along <= reach &&
        Math.abs(side) <= width &&
        v.y <= (maxY == null ? 5 : maxY) &&
        v.y + 5 >= (minY == null ? -1 : minY) &&
        clearLine(origin.clone().add(V(0, 2.5, 0)), e.pos.clone().add(V(0, 2.5, 0)))
      );
    });
  }
  function clearLine(a, b) {
    return !(window.JJMAP && JJMAP.id === 'jjs') || JJJJS.ray(a, b, 0.05) > 0.98;
  }
  function ragdolled(e) {
    return !!e.rag || !!(e.react && e.react.type === 'blow');
  }
  function guarding(e, d, all) {
    return !!e.blocking && (all || DIR(e.facing || 0).dot(d) < -0.15);
  }
  function gain(amount) {
    if (mine() && !M.active) M.charge = Math.min(100, M.charge + Math.max(0, amount) * 0.65);
  }
  function hit(e, key, amount, d, power, up, opts) {
    opts = opts || {};
    if (!e || e.dead || e.mhConsumed || e.iframes > 0) return false;
    if (opts.ragdoll === false && ragdolled(e)) return false;
    if (!opts.unblockable && guarding(e, d, opts.allSides)) {
      if (opts.chip) amount *= 0.25;
      else {
        impact(e.pos.clone().add(V(0, 3, 0)), false, true);
        return false;
      }
    }
    var before = e.hp;
    e.damage(
      amount,
      d
        .clone()
        .multiplyScalar(power || 0)
        .add(V(0, up || 0, 0)),
      {
        stun: opts.stun == null ? 0.55 : opts.stun,
        react: power > 16 || up > 8 ? 'blow' : opts.react || 'stagger',
        reactDur: opts.stun || 0.55,
        spark: C.soul,
        fin: !!FINISHERS[key],
        finSkill: key,
        noFrameBonus: true,
        pin: opts.pin || 0,
        death: opts.death || null
      }
    );
    gain(Math.min(before, amount));
    impact(e.pos.clone().add(V(0, 2.6, 0)), key === 'mh_black' || key === 'mh_awblack', true);
    if (M.domain && M.domain.targets.has(e))
      M.domain.targets.get(e).value = Math.max(0, M.domain.targets.get(e).value - amount * 1.1);
    return true;
  }
  function moveActor(actor, d, distance) {
    var old = actor.pos.clone(),
      next = old.clone().addScaledVector(d, distance);
    if (window.JJMAP && JJMAP.id === 'jjs') {
      var f = JJJJS.ray(old.clone().add(V(0, 2.5, 0)), next.clone().add(V(0, 2.5, 0)), 0.8);
      next.lerpVectors(old, next, f);
    }
    actor.pos.copy(next);
    collideWorld(actor.pos, 0.9);
    actor.vel.x = actor.vel.z = 0;
    return old.distanceTo(actor.pos);
  }
  function hold(a, e, point, escape) {
    if (!e || e.dead) return;
    e.pos.copy(point);
    e.vel.set(0, 0, 0);
    e.stunT = Math.max(e.stunT || 0, 0.25);
    e.cineHold = true;
    if (!a.held) a.held = new Set();
    a.held.add(e);
    a.netHold = (a.netHold || 0) + 1;
    if (e.net && a.netHold % 5 === 1)
      send({
        t: 'mh-control',
        to: e.net.id,
        op: 'hold',
        x: point.x,
        y: point.y,
        z: point.z,
        escape: !!escape
      });
  }
  function release(a) {
    if (!a || !a.held) return;
    a.held.forEach((e) => {
      e.cineHold = false;
      e.stunT = 0;
      if (e.net) send({ t: 'mh-control', to: e.net.id, op: 'release' });
    });
    a.held.clear();
  }
  function start(key) {
    var k = KIT[key];
    if (!k || !valid() || busy() || cds[k.slot] > 0) return false;
    if (
      key.startsWith('mh_a') ||
      ['mh_idle', 'mh_drill', 'mh_heart', 'mh_grab', 'mh_spike', 'mh_domain'].includes(key)
    ) {
      if (key !== 'mh_air' && key !== 'mh_awaken' && !M.active) return false;
    }
    if (key === 'mh_awblack' && M.remaining < 6) return false;
    player.blocking = false;
    cds[k.slot] = k.cd;
    var a = (player.action = {
      type: key,
      t: 0,
      dur: k.dur,
      stage: 0,
      dir: camForward(),
      origin: player.pos.clone(),
      hits: new Set(),
      held: new Set(),
      events: {},
      mode: M.mode
    });
    player.facing = Math.atan2(a.dir.x, a.dir.z);
    player.vel.x = player.vel.z = 0;
    if (['mh_focus', 'mh_chain', 'mh_home', 'mh_blade_dash', 'mh_club_dash'].includes(key)) M.modeCD = 1;
    if (key === 'mh_air') {
      player.vel.y = 5;
      player.onGround = false;
    }
    if (key === 'mh_grab') a.lastSlam = -1;
    if (key === 'mh_awblack') {
      M.remaining = Math.max(0, M.remaining - 6);
      player.iframes = Math.max(player.iframes, a.dur);
    }
    showSplash(k.name.toUpperCase(), M.active ? 'ESSENCE OF THE SOUL' : 'IDLE TRANSFIGURATION', '#79eee0');
    sfx.raise();
    return true;
  }
  function awaken() {
    if (M.active) {
      if (player.action && player.action.type === 'mh_awblack') {
        player.action.strike = true;
        return true;
      }
      return start('mh_awblack');
    }
    if (M.charge < 100 || !valid() || busy()) return false;
    M.active = true;
    M.remaining = 60;
    M.charge = 0;
    M.basePage = false;
    player.hp = Math.min(player.maxHp, player.hp + 45);
    player.iframes = 2.2;
    refresh();
    return start('mh_awaken');
  }
  M.awaken = awaken;
  function cast(slot) {
    var a = player.action;
    if (slot === 3 && a && a.type === 'mh_repel' && a.t < 0.62) {
      a.type = 'mh_ride';
      a.dur = KIT.mh_ride.dur;
      return true;
    }
    if (slot === 3 && a && a.type === 'mh_focus' && a.t >= 0.2 && a.t <= 0.38) {
      a.type = 'mh_black';
      return true;
    }
    if (slot === 2 && a && a.type === 'mh_grab' && a.target && a.t - a.lastSlam > 0.65) {
      a.slam = true;
      return true;
    }
    var ids =
      M.active && !M.basePage
        ? ['mh_idle', ['mh_drill', 'mh_heart', 'mh_grab'][M.mode], 'mh_spike', 'mh_domain']
        : [
            player.onGround ? 'mh_stock' : 'mh_air',
            'mh_fire',
            ['mh_focus', 'mh_chain', 'mh_home'][M.mode],
            'mh_repel'
          ];
    return start(ids[slot - 1]);
  }
  M.cast = cast;
  M.start = start;
  function special() {
    var a = player.action;
    if (!valid()) return false;
    if (a && a.type === 'mh_grab' && a.target) {
      a.toss = true;
      return true;
    }
    if (M.held) {
      M.reserves.push(M.held.kind);
      VOX.dispose(M.held.g);
      M.held = null;
      notice('SOUL STORED');
      return true;
    }
    if (M.modeCD > 0 || busy()) return false;
    M.mode = (M.mode + 1) % 3;
    VOX.mode(player.rig, M.mode);
    refresh();
    notice(['NORMAL ARMS', 'BLADE ARMS', 'CLUB ARMS'][M.mode]);
    return true;
  }
  M.special = special;
  function item(kind, at) {
    var g = VOX.human(kind);
    g.scale.setScalar(0.65);
    g.position.copy(at);
    scene.add(g);
    var o = { g, kind, t: 0, dead: false };
    M.items.push(o);
    return o;
  }
  function equip(kind) {
    var g = VOX.human(kind);
    g.scale.setScalar(0.45);
    player.rig.handL.add(g);
    g.rotation.x = Math.PI;
    M.held = { g, kind };
  }
  function pickup() {
    if (!valid() || busy()) return false;
    if (M.held) {
      throwItem(M.held.kind);
      VOX.dispose(M.held.g);
      M.held = null;
      return true;
    }
    var o = M.items.find((o) => !o.dead && o.g.position.distanceTo(player.pos) < 5);
    if (!o) return false;
    o.dead = true;
    VOX.dispose(o.g);
    equip(o.kind);
    return true;
  }
  function withdraw() {
    if (!M.reserves.length) return false;
    var kind = M.reserves.shift();
    if (M.held) throwItem(kind);
    else equip(kind);
    return true;
  }
  M.pickup = pickup;
  M.withdraw = withdraw;
  function throwItem(kind) {
    var d = camForward(),
      g = VOX.human(kind),
      startPos = player.pos.clone().add(V(0, 2.5, 0));
    g.scale.setScalar(0.65);
    var landing = startPos.clone().addScaledVector(d, 18);
    if (window.JJMAP && JJMAP.id === 'jjs')
      landing.lerpVectors(startPos, landing, JJJJS.ray(startPos, landing, 0.4));
    landing.y = worldFloor(landing);
    effect(
      g,
      1,
      (t) => {
        g.position
          .copy(startPos)
          .lerp(landing, t)
          .add(V(0, Math.sin(t * Math.PI) * 2, 0));
        g.rotation.x = t * 4;
      },
      true,
      () => {
        if (mine() && !player.dead) {
          if (kind === 'human') ally(landing);
          else item(kind, landing);
        }
      }
    );
  }
  function ally(at) {
    var g = VOX.human('human'),
      hp = 6,
      attack = 0;
    g.position.copy(at);
    effect(g, 15, (t, dt, o) => {
      var target = enemies
        .filter((e) => !e.dead)
        .sort((a, b) => a.pos.distanceTo(g.position) - b.pos.distanceTo(g.position))[0];
      if (!target) return;
      var delta = target.pos.clone().sub(g.position).setY(0),
        dist = delta.length();
      delta.normalize();
      g.rotation.y = Math.atan2(delta.x, delta.z);
      g.position.addScaledVector(delta, Math.min(Math.max(0, dist - 2.2), dt * 8));
      g.position.y = worldFloor(g.position) + Math.abs(Math.sin(t * 10)) * 0.18;
      attack -= dt;
      if (dist < 3 && attack <= 0) {
        hit(target, 'mh_ally', 3, delta, 3, 0, { unblockable: false });
        attack = 0.8;
        hp--;
        if (hp <= 0) o.life = t;
      }
    });
  }
  function launchBullet(a, index, owner, from, d) {
    var origin = (from || player.pos)
        .clone()
        .add(V(0, 2.7, 0))
        .addScaledVector(d, 1.2),
      g = VOX.human('human', index % 2 ? C.green : C.purple);
    g.scale.set(0.32, 0.32, 0.8);
    g.rotation.x = Math.PI / 2;
    g.rotation.y = Math.atan2(d.x, d.z);
    var prev = origin.clone(),
      travel = 0;
    if (owner !== false && index >= 3)
      send({ t: 'mh-shot', x: from.x, y: from.y, z: from.z, dx: d.x, dz: d.z });
    effect(
      g,
      100 / 65,
      (t, dt, o) => {
        var step = Math.min(65 * dt, 100 - travel),
          next = prev.clone().addScaledVector(d, step);
        g.position.copy(next);
        if (!clearLine(prev, next)) {
          o.life = t;
          return;
        }
        if (owner !== false) {
          var targets = lineTargets(prev, d, step + 1, 1.1, -1.6, 1.6);
          if (targets.length) {
            var e = targets[0];
            hit(e, 'mh_fire', 4, d, index >= 2 ? 21 : 1, index >= 2 ? 6 : 0, {
              stun: index >= 2 ? 0.8 : 0.38
            });
            if (index >= 2 && player.action === a) a.dur = Math.min(a.dur, a.t + 0.15);
            o.life = t;
          }
        }
        if (Math.floor(travel / 5) !== Math.floor((travel + step) / 5)) trail(prev, next, false, owner);
        travel += step;
        prev.copy(next);
      },
      owner
    );
  }
  function shatterProps(at, radius, owner) {
    crates.forEach((c) => {
      if (!c.mesh.parent || !c.mesh.visible || c.mesh.position.distanceTo(at) > radius + 1.2) return;
      c.mesh.visible = false;
      var g = new THREE.Group(),
        home = c.mesh.position.clone();
      g.position.copy(home);
      var bits = [];
      for (var i = 0; i < 8; i++) {
        var m = solid(g, 0.72, 0.72, 0.72, 0xb98a4a),
          dir = V(i % 2 ? 1 : -1, 1.5 + Math.floor(i / 4), i % 4 < 2 ? 1 : -1);
        bits.push({ m, dir });
      }
      effect(
        g,
        12,
        (t) => {
          bits.forEach((b) => {
            b.m.position.copy(b.dir).multiplyScalar(Math.min(t, 1.2) * 4);
            b.m.position.y = Math.max(-0.4, b.dir.y * t * 4 - t * t * 12);
            b.m.rotation.set(t * 0.7, t * 0.9, t * 0.3);
          });
        },
        owner,
        () => {
          if (crates.includes(c)) {
            c.mesh.position.copy(home);
            c.vel.set(0, 0, 0);
            c.av.set(0, 0, 0);
            c.mesh.visible = true;
          }
        }
      );
    });
  }
  function launchRepel(a, owner, remoteEnt) {
    var g = worm(),
      from = (remoteEnt ? remoteEnt.pos : a.origin).clone(),
      d = a.dir.clone(),
      prev = from.clone(),
      travel = 0,
      caught = new Set(),
      ride = a.type === 'mh_ride';
    var obj = effect(
      g,
      70 / 32,
      (t, dt, o) => {
        if (owner !== false && (player.dead || !mine())) {
          o.life = t;
          return;
        }
        if (owner !== false && !ride) d.copy(camForward());
        else if (remoteEnt && !ride) d.copy(DIR(remoteEnt.facing));
        var step = Math.min(dt * 32, 70 - travel),
          next = prev.clone().addScaledVector(d, step);
        if (!clearLine(prev.clone().add(V(0, 2, 0)), next.clone().add(V(0, 2, 0)))) {
          o.life = t;
          return;
        }
        travel += step;
        g.position.copy(next).add(V(0, 2, 0));
        g.rotation.y = Math.atan2(d.x, d.z);
        poseWorm(g, t);
        shatterProps(next, 2.5, owner);
        if (owner !== false) {
          lineTargets(prev, d, step + 2, 2.5, -2, 4).forEach((e) => {
            if (!caught.has(e) && hit(e, 'mh_repel', 14, d, 20, 8, { unblockable: true })) caught.add(e);
          });
          caught.forEach((e) => {
            if (!e.dead) hold(a, e, next.clone().addScaledVector(d, 2.5), false);
          });
          if (ride && player.action === a) moveActor(player, d, step);
        }
        prev.copy(next);
      },
      owner,
      () => release(a)
    );
    a.repel = obj;
    return obj;
  }
  function grabVisual(a, owner, remoteEnt) {
    var g = new THREE.Group(),
      hand = VOX.hand(g, 'Force Grab / articulated palm', 2.5),
      bones = [];
    for (var i = 0; i < 12; i++) bones.push(solid(g, 0.7, 0.7, 0.7, C.skinD));
    return effect(
      g,
      a.dur,
      (t, dt, o) => {
        var p = remoteEnt ? remoteEnt.pos : player.pos,
          d = remoteEnt ? DIR(remoteEnt.facing) : a.dir;
        var from = p.clone().add(V(0, 3.4, 0)),
          to = a.target
            ? a.target.pos.clone().add(V(0, 2.3, 0))
            : from.clone().addScaledVector(d, Math.min(40, t * 65));
        hand.position.copy(to);
        hand.rotation.x = Math.PI / 2;
        hand.rotation.z = Math.PI;
        for (var j = 0; j < bones.length; j++) bones[j].position.copy(from).lerp(to, j / 12);
        if (owner !== false && player.action !== a) o.life = t;
      },
      owner
    );
  }
  function legsVisual(a, owner, remoteEnt, spike) {
    var g = new THREE.Group(),
      legs = [];
    if (spike) {
      var mass = VOX.sculpt(g, 'Spike Wrath / voxel transfigured body', 0.2);
      mass
        .block(0, 0, 0, 3.4, 2.4, 2.8, C.skinD)
        .block(0, 0.9, 0, 2.8, 1.4, 2.4, C.skin)
        .block(0, -1, 0, 4, 0.6, 3.2, C.skinD);
      for (var face = 0; face < 3; face++) {
        mass
          .block(-1 + face, 0.4, 1.5, 0.7, 0.6, 0.2, C.skin)
          .block(-1.16 + face, 0.5, 1.7, 0.2, 0.2, 0.2, C.black)
          .block(-0.84 + face, 0.5, 1.7, 0.2, 0.2, 0.2, C.black)
          .block(-1 + face, 0.1, 1.7, 0.4, 0.2, 0.2, C.black);
      }
      mass.bake();
    }
    for (var i = 0; i < (spike ? 18 : 8); i++) {
      var l = new THREE.Group();
      g.add(l);
      legs.push(l);
      for (var j = 0; j < 9; j++) solid(l, 0.34, 0.34, 0.65, j % 3 ? C.skinD : C.skin);
    }
    return effect(
      g,
      a.dur,
      (t, dt, o) => {
        var pos = remoteEnt ? remoteEnt.pos : player.pos;
        g.position.copy(pos).add(V(0, spike ? 2.8 : 3, 0));
        legs.forEach((leg, i) => {
          var ang = (i / legs.length) * Math.PI * 2,
            reach = spike ? 4 + Math.sin(t * 5 + i) * 2 : 4;
          leg.children.forEach((m, j) => {
            var f = j / 8;
            m.position.set(
              Math.cos(ang) * f * reach,
              Math.sin(f * Math.PI) * 2 - f * (spike ? 1 : 6),
              Math.sin(ang) * f * reach
            );
            m.lookAt(
              g.position
                .clone()
                .add(m.position)
                .add(V(Math.cos(ang), -1, Math.sin(ang)))
            );
          });
        });
        if (owner !== false) {
          if (t > (o.nextTrail || 0)) {
            o.nextTrail = t + 0.14;
            a.held.forEach((e) => {
              trail(pos.clone().add(V(0, 3, 0)), e.pos.clone().add(V(0, 2.5, 0)), false, true);
            });
          }
          if (player.action !== a) o.life = t;
        }
      },
      owner
    );
  }
  function dome(origin, owner) {
    var g = new THREE.Group();
    g.position.copy(origin);
    var radius = 28;
    // An enclosed stepped void, with a flower of sculpted voxel hands.
    function dark(w, h, d, x, y, z) {
      var m = solid(g, w, h, d, 0x080710, x, y, z);
      m.material.dispose();
      m.material = new THREE.MeshBasicMaterial({ color: 0x080710 });
      return m;
    }
    for (var i = 0; i < 36; i++) {
      var ang = (i / 36) * Math.PI * 2,
        wall = dark(5, 25, 0.7, Math.sin(ang) * radius, 11, Math.cos(ang) * radius);
      wall.rotation.y = ang;
      var hand = VOX.hand(g, 'Domain / flower of hands', 3.3, i % 2 ? 0xaaa3c1 : 0xc9c1d1);
      hand.position.set(Math.sin(ang) * (radius - 3), 7 + (i % 3) * 2, Math.cos(ang) * (radius - 3));
      hand.rotation.set(Math.PI / 3, ang, -ang * 0.15);
    }
    for (i = 0; i < 12; i++) {
      var a = (i / 12) * Math.PI * 2,
        h = VOX.hand(g, 'Domain / overhead lotus', 4, 0xaaa3c1);
      h.position.set(Math.sin(a) * 12, 19, Math.cos(a) * 12);
      h.rotation.set(Math.PI / 2, a, 0);
    }
    dark(58, 0.2, 58, 0, 0.015, 0);
    dark(58, 0.8, 58, 0, 23, 0);
    var light = new THREE.PointLight(0xaaa2dc, 1.8, 52);
    light.position.set(0, 12, 0);
    g.add(light);
    return effect(
      g,
      14,
      (t) => {
        g.scale.y = Math.min(1, t / 0.5);
      },
      owner
    );
  }
  function openDomain(a) {
    var origin = player.pos.clone(),
      visual = dome(origin, true),
      targets = new Map();
    enemies.forEach((e) => {
      if (!e.dead && e.pos.distanceTo(origin) <= 28) targets.set(e, { value: 100, bar: null });
    });
    M.domain = { origin, visual, targets, t: 0, owner: player };
    send({ t: 'mh-domain', x: origin.x, y: origin.y, z: origin.z, dur: 14 });
  }
  function soulBar(e) {
    var g = new THREE.Group(),
      back = solid(g, 0.18, 2.4, 0.12, 0x272134),
      fill = solid(g, 0.2, 2.3, 0.14, C.soul);
    g.position.set(1.5, 3, 0);
    e.rig.root.add(g);
    return { g, fill };
  }
  function closeDomain() {
    var dom = M.domain;
    if (!dom) return;
    discard(dom.visual);
    dom.targets.forEach((s) => {
      if (s.bar) VOX.dispose(s.bar.g);
    });
    M.domain = null;
    send({ t: 'mh-domain-end' });
  }
  function stepDomain(dt) {
    var dom = M.domain;
    if (!dom) return;
    dom.t += dt;
    if (dom.t >= 14 || !M.active || player.dead || !mine()) {
      closeDomain();
      return;
    }
    var offset = player.pos.clone().sub(dom.origin).setY(0);
    if (offset.length() > 26) {
      offset.normalize().multiplyScalar(26);
      player.pos.x = dom.origin.x + offset.x;
      player.pos.z = dom.origin.z + offset.z;
    }
    dom.targets.forEach(function (s, e) {
      if (e.dead) {
        if (s.bar) {
          VOX.dispose(s.bar.g);
          s.bar = null;
        }
        return;
      }
      var delta = e.pos.clone().sub(dom.origin),
        dist = Math.hypot(delta.x, delta.z);
      if (dist > 26) {
        delta.setY(0).normalize().multiplyScalar(26);
        e.pos.x = dom.origin.x + delta.x;
        e.pos.z = dom.origin.z + delta.z;
      }
      var near = e.pos.distanceTo(player.pos);
      s.value = Math.max(0, s.value - dt * Math.max(2, 18 - near * 0.55));
      if (!s.bar) s.bar = soulBar(e);
      s.bar.fill.scale.y = s.value / 100;
      s.bar.fill.position.y = -(1 - s.value / 100) * 1.15;
      if (e.net && Math.floor(dom.t * 10) !== Math.floor((dom.t - dt) * 10))
        send({
          t: 'mh-soul',
          to: e.net.id,
          value: s.value,
          x: dom.origin.x,
          y: dom.origin.y,
          z: dom.origin.z
        });
      if (s.value <= 0) {
        release(player.action);
        if (
          hit(e, 'mh_domain', e.maxHp * 3, DIR(player.facing), 0, 0, { unblockable: true, death: 'implode' })
        )
          e.mhConsumed = true;
      }
    });
  }

  function step(a, dt) {
    var type = a.type,
      d = a.dir || camForward();
    if (!KIT[type]) return;
    function beat(id, time, fn) {
      if (a.t >= time && !a.events[id]) {
        a.events[id] = true;
        fn();
      }
    }
    function front(reach, width) {
      return lineTargets(player.pos, d, reach, width);
    }
    if (type === 'mh_stock') {
      beat('one', 0.34, () => {
        a.target = front(5, 2.7).find((e) => hit(e, type, 6, d, 0, 0, { ragdoll: false }));
      });
      beat('two', 0.68, () => {
        var es = a.target && !a.target.dead ? [a.target] : front(5.8, 3.5);
        es.forEach((e) => hit(e, type, 6, d, 12, 12, { unblockable: true }));
      });
    } else if (type === 'mh_air') {
      if (a.t < 0.45) moveActor(player, d, dt * 7);
      beat('slam', 0.5, () => {
        player.vel.y = -22;
        front(6, 3).forEach((e) => hit(e, type, 10, d, 8, -10, { unblockable: true }));
        impact(player.pos.clone().addScaledVector(d, 3), false, true);
      });
    } else if (type === 'mh_fire') {
      [0.3, 0.49, 0.68].forEach((time, i) =>
        beat('shot' + i, time, () => launchBullet(a, i, true, player.pos, d))
      );
      if (a.t > 0.83 && keys.Digit2 && M.reserves.length && a.t >= (a.nextShot || 0.84)) {
        M.reserves.shift();
        launchBullet(a, 3, true, player.pos, d);
        a.nextShot = a.t + 0.18;
        a.dur = a.t + 0.5;
      }
    } else if (['mh_focus', 'mh_black', 'mh_chain', 'mh_home'].includes(type)) {
      beat('strike', type === 'mh_home' ? 0.64 : 0.46, () => {
        var range = type === 'mh_chain' ? 14 : type === 'mh_home' ? 8 : 5.2;
        front(range, type === 'mh_home' ? 4 : 2.5).forEach((e) => {
          var blocked = guarding(e, d),
            power =
              type === 'mh_chain'
                ? -13
                : type === 'mh_black'
                  ? 28
                  : type === 'mh_home'
                    ? blocked
                      ? 9
                      : 28
                    : 6;
          hit(e, type, KIT[type].damage, d, power, type === 'mh_home' ? 20 : type === 'mh_black' ? 9 : 0, {
            unblockable: type === 'mh_home' || type === 'mh_black',
            allSides: type === 'mh_chain',
            ragdoll: type !== 'mh_focus',
            stun: type === 'mh_chain' ? 1.2 : 0.6
          });
        });
        if (type === 'mh_chain') {
          var pts = [];
          for (var i = 0; i < 14; i++)
            pts.push(
              player.pos
                .clone()
                .addScaledVector(d, i)
                .add(V(Math.sin(i * 0.5) * 0.3, 2 + Math.sin((i / 14) * Math.PI) * 2, 0))
            );
          stroke(pts, C.skin, 0.24, 0.4, true);
        }
      });
    } else if (type === 'mh_blade_dash' || type === 'mh_club_dash') {
      if (a.t > 0.15 && a.t < 0.5) {
        var from = player.pos.clone(),
          stepDist = moveActor(player, d, dt * (type === 'mh_blade_dash' ? 58 : 30));
        lineTargets(from, d, stepDist + 3, type === 'mh_club_dash' ? 4 : 2.5).forEach((e) => {
          if (!a.hits.has(e)) {
            a.hits.add(e);
            var stunned = e.stunT > 0 || e.react;
            hit(e, type, KIT[type].damage, d, type === 'mh_club_dash' || stunned ? 25 : 2, 0, {
              unblockable: type === 'mh_club_dash',
              stun: 0.7
            });
          }
        });
        trail(from.clone().add(V(0, 2, 0)), player.pos.clone().add(V(0, 2, 0)), false, true);
      }
    } else if (type === 'mh_repel' || type === 'mh_ride') {
      beat('worm', 0.65, () => launchRepel(a, true));
    } else if (type === 'mh_awaken') {
      beat('burst', 1.1, () => {
        burstWorms(player.pos.clone(), true);
        enemies
          .filter((e) => e.pos.distanceTo(player.pos) < 10)
          .forEach((e) =>
            hit(e, type, 15, DIR(Math.atan2(e.pos.x - player.pos.x, e.pos.z - player.pos.z)), 14, 19, {
              unblockable: true
            })
          );
      });
    } else if (type === 'mh_awblack') {
      if (a.t > 0.25 && !a.events.hit) {
        moveActor(player, d, dt * 27);
        if (a.strike || front(4, 2.5).length || a.t > 1.45) {
          a.events.hit = true;
          a.stage = 1;
          front(5, 3).forEach((e) => hit(e, type, 10, d, 33, 14, { unblockable: true }));
          a.dur = a.t + 0.3;
        }
      }
    } else if (type === 'mh_idle') {
      if (a.t > 0.4) {
        moveActor(player, d, dt * 20);
        var e = front(4.2, 2.2).find((e) => !a.hits.has(e));
        if (e) {
          a.hits.add(e);
          var already = M.marks.has(e);
          if (already) {
            if (hit(e, type, e.maxHp * 3, d, 0, 0, { unblockable: true, death: 'sever' })) {
              e.mhConsumed = true;
              cds.mha1 = 0;
              a.dur = Math.min(a.t + 1.25, 5);
              burstWorms(e.pos.clone(), true);
            }
          } else if (hit(e, type, 15, d, 8, 0, { unblockable: true })) {
            M.marks.set(e, true);
            a.dur = a.t + 0.3;
            notice('SOUL TOUCHED · NEXT IDLE TRANSFIGURATION IS LETHAL');
          }
        }
      }
    } else if (type === 'mh_drill') {
      if (a.t > 0.15 && a.t < 0.46 && !front(4.8, 2.8).length) moveActor(player, d, dt * 18);
      beat('kick', 0.46, () => {
        a.target = front(5, 2.8).find((e) => hit(e, type, 10, d, 0, 3, { unblockable: true }));
        if (!a.target) a.dur = 0.85;
      });
      if (a.target && !a.target.dead && a.t < 1.4)
        hold(a, a.target, player.pos.clone().addScaledVector(d, 3), false);
      beat('drill', 1.3, () => {
        if (a.target) {
          hit(a.target, type, 25, d, 24, 8, { unblockable: true });
          release(a);
        }
      });
    } else if (type === 'mh_heart') {
      beat('legs', 0.25, () => {
        a.visual = legsVisual(a, true);
      });
      if (a.t > 0.5 && a.t < 4.2) {
        moveActor(player, camForward(), dt * 11);
        front(6, 4).forEach((e) => {
          if (!a.target && !(e.iframes > 0)) a.target = e;
        });
        if (a.target && !a.target.dead) {
          hold(a, a.target, player.pos.clone().add(V(0, 1.2, 0)), false);
          while (a.t - 0.5 >= (a.ticks || 0) * 0.2 && (a.ticks || 0) < 18) {
            a.ticks = (a.ticks || 0) + 1;
            hit(a.target, type, 2.5, d, 0, 0, { unblockable: true, stun: 0.3 });
          }
        }
      } else if (a.t >= 4.2) release(a);
    } else if (type === 'mh_grab') {
      beat('arm', 0.15, () => {
        a.target = front(40, 2.8).find((e) => hit(e, type, 5, d, 0, 0, { unblockable: true }));
        a.visual = grabVisual(a, true);
        if (!a.target) a.dur = 1;
      });
      if (a.target && !a.target.dead && !a.escaped) {
        var targetPoint = player.pos
          .clone()
          .addScaledVector(camForward(), Math.min(18, player.pos.distanceTo(a.target.pos)))
          .add(V(0, 2, 0));
        hold(a, a.target, targetPoint, true);
        if (a.slam) {
          a.slam = false;
          a.lastSlam = a.t;
          hit(a.target, type, 8, d, 0, -5, { unblockable: true });
          enemies
            .filter((e) => e !== a.target && !e.dead && e.pos.distanceTo(a.target.pos) < 4)
            .forEach((e) => hit(e, type, 8, d, 10, 4, { unblockable: true }));
          impact(a.target.pos.clone(), false, true);
        }
        if (a.toss) {
          hit(a.target, type, 4, camForward(), 34, 12, { unblockable: true });
          release(a);
          a.dur = a.t;
        }
      } else if (a.escaped) {
        release(a);
        a.dur = a.t;
      }
    } else if (type === 'mh_spike') {
      beat('form', 0.65, () => {
        a.visual = legsVisual(a, true, null, true);
        player.iframes = Math.max(player.iframes, 2.5);
      });
      if (a.t > 0.65 && a.t < 3) {
        moveActor(player, camForward(), dt * 14);
        enemies
          .filter(
            (e) =>
              !e.dead &&
              !(e.iframes > 0) &&
              !e.mhConsumed &&
              e.pos.distanceTo(player.pos) < 25 &&
              clearLine(player.pos.clone().add(V(0, 2.5, 0)), e.pos.clone().add(V(0, 2.5, 0))) &&
              !guarding(e, DIR(Math.atan2(e.pos.x - player.pos.x, e.pos.z - player.pos.z)))
          )
          .forEach((e) => {
            if (a.held.size < 18) a.held.add(e);
          });
        Array.from(a.held).forEach((e, i) =>
          hold(
            a,
            e,
            player.pos
              .clone()
              .addScaledVector(DIR((i / Math.max(1, a.held.size)) * Math.PI * 2), 5)
              .add(V(0, 2.4, 0)),
            false
          )
        );
      }
      beat('slam', 3, () => {
        a.held.forEach((e) =>
          hit(e, type, 25, DIR(Math.atan2(e.pos.x - player.pos.x, e.pos.z - player.pos.z)), 10, -15, {
            unblockable: true
          })
        );
        release(a);
      });
    } else if (type === 'mh_domain') {
      beat('open', 2.2, () => openDomain(a));
    }
  }
  var prevStep = stepAction;
  stepAction = function (a, dt) {
    if (KIT[a.type]) return step(a, dt);
    return prevStep(a, dt);
  };
  var prevPunch = punch;
  punch = function () {
    if (!mine()) return prevPunch();
    if (!valid()) return;
    if (player.blocking) {
      withdraw();
      return;
    }
    if (cds.m1 > 0 || busy()) return;
    var n = player.comboN,
      d = camForward(),
      last = n === 3;
    var damage = [3, 3, 4, 4][n];
    if (M.mode === 1) damage = [2, 2, 3, 3][n];
    if (M.mode === 2) damage = [4, 4, 5, 5][n];
    cds.m1 = 0.32 + (M.mode === 1 ? -0.05 : M.mode === 2 ? 0.05 : 0);
    player.comboReset = 0.9;
    player.comboN = (n + 1) % 4;
    player.attackT = 0.22;
    player.attackArm = n % 2;
    lineTargets(player.pos, d, M.mode === 2 ? 4.8 : 4, 2.4).forEach((e) =>
      hit(e, 'mh_m1', damage, d, last ? 23 : 2, last ? 9 : 0, {
        unblockable: M.mode === 2 && n >= 2,
        chip: M.mode === 2,
        ragdoll: M.mode === 1,
        stun: last ? 0.7 : 0.28
      })
    );
    sfx.whoosh();
  };
  var prevDash = doDash;
  doDash = function () {
    if (!mine() || !M.mode || keys.KeyA || keys.KeyS || keys.KeyD) return prevDash();
    return start(M.mode === 1 ? 'mh_blade_dash' : 'mh_club_dash');
  };
  var previousHurt = hurtPlayer;
  hurtPlayer = function (amount, knock) {
    var hp = player.hp,
      result = previousHurt(amount, knock);
    if (mine() && player.hp < hp) {
      gain((hp - player.hp) * 0.45);
      var a = M.lastAction;
      release(a);
      if (a && a.visual) discard(a.visual);
      if (player.action === a && a && KIT[a.type]) player.action = null;
    }
    return result;
  };
  function cleanup() {
    release(M.lastAction);
    M.effects.forEach((o) => {
      if (o.owner) discard(o);
    });
    M.items.forEach((o) => VOX.dispose(o.g));
    M.items = [];
    M.reserves = [];
    if (M.held) VOX.dispose(M.held.g);
    M.held = null;
    M.marks.forEach((_, e) => {
      e.mhConsumed = false;
    });
    M.marks.clear();
    M.active = false;
    M.remaining = 0;
    M.charge = 0;
    M.mode = 0;
    M.basePage = false;
    M.modeCD = 0;
    M.grabbed = null;
    closeDomain();
    refresh();
  }
  M.cleanup = cleanup;
  var previousSwitch = switchChar;
  switchChar = function (id, quiet) {
    if (started && mine() && M.active && id !== player.char) {
      notice('CANNOT SWITCH WHILE AWAKENED');
      return;
    }
    var before = player.char,
      result = previousSwitch(id, quiet);
    if (before === 'mahito' && player.char !== before) cleanup();
    return result;
  };
  var previousUpdate = updatePlayer;
  updatePlayer = function (dt) {
    var before = player.action;
    if (M.grabbed) {
      M.grabbed.ttl -= dt;
      if (M.grabbed.ttl <= 0 || player.dead) M.grabbed = null;
      else {
        clearMovement();
        player.action = null;
        player.pos.copy(M.grabbed.pos);
        player.vel.set(0, 0, 0);
      }
    }
    previousUpdate(dt);
    if (M.grabbed) {
      player.pos.copy(M.grabbed.pos);
      player.vel.set(0, 0, 0);
    }
    if (before && before !== player.action) {
      release(before);
      if (before.visual) discard(before.visual);
    }
    M.lastAction = player.action;
    enemies.forEach((e) => {
      if (e.dead || e.hp <= 0) {
        e.mhWasDead = true;
        M.marks.delete(e);
      } else if (e.mhWasDead) {
        e.mhWasDead = false;
        e.mhConsumed = false;
        M.marks.delete(e);
      }
    });
    if (!mine()) return;
    if (player.dead) {
      if (!M.wasDead) {
        cleanup();
        M.wasDead = true;
      }
      return;
    }
    M.wasDead = false;
    M.modeCD = Math.max(0, M.modeCD - dt);
    cds.mhMode = M.modeCD;
    if (M.active) {
      M.remaining = Math.max(0, M.remaining - dt);
      if (!M.remaining) {
        M.active = false;
        M.basePage = false;
        if (player.action && player.action.type.startsWith('mh_')) {
          release(player.action);
          player.action = null;
        }
        closeDomain();
        refresh();
      }
    }
    M.items = M.items.filter((o) => {
      if (o.dead) return false;
      o.t += dt;
      o.g.rotation.y += dt * 0.5;
      o.g.position.y = worldFloor(o.g.position) + 0.4 + Math.sin(o.t * 2) * 0.12;
      if (o.t > 90) {
        VOX.dispose(o.g);
        return false;
      }
      return true;
    });
    stepDomain(dt);
    VOX.mode(player.rig, M.mode, player.action && player.action.type);
    var current = player.action;
    player.rig.body.visible = !(
      current &&
      current.type === 'mh_spike' &&
      current.t > 0.65 &&
      current.t < 3.2
    );
  };
  M.receive = function (msg) {
    var mp = window.MPJJ;
    if (!mp) return;
    if (msg.t === 'mh-control' && msg.to === mp.id) {
      if (msg.op === 'release') {
        if (M.grabbed && M.grabbed.by === msg.id) M.grabbed = null;
        return;
      }
      var caster = mp.fighters[msg.id];
      if (
        !caster ||
        caster.char !== 'mahito' ||
        caster.e.dead ||
        player.dead ||
        player.iframes > 0 ||
        caster.e.pos.distanceTo(player.pos) > 65
      )
        return;
      var pos = V(msg.x, msg.y, msg.z);
      if (![msg.x, msg.y, msg.z].every(Number.isFinite) || pos.distanceTo(caster.e.pos) > 60) return;
      var jumps = M.grabbed && M.grabbed.by === msg.id ? M.grabbed.jumps : 0;
      M.grabbed = { by: msg.id, pos, ttl: 0.45, escape: !!msg.escape, jumps };
    } else if (msg.t === 'mh-escape' && msg.to === mp.id) {
      var a = player.action;
      if (a && a.type === 'mh_grab' && a.target && a.target.net && a.target.net.id === msg.id)
        a.escaped = true;
    } else if (msg.t === 'mh-domain') {
      var f = mp.fighters[msg.id];
      if (f && f.char === 'mahito' && [msg.x, msg.y, msg.z].every(Number.isFinite)) {
        if (f.mhDomain) discard(f.mhDomain);
        f.mhDomain = dome(V(msg.x, msg.y, msg.z), false);
      }
    } else if (msg.t === 'mh-domain-end') {
      var f = mp.fighters[msg.id];
      if (f && f.mhDomain) discard(f.mhDomain);
      if (M.soulThreat && M.soulThreat.by === msg.id) M.soulThreat = null;
    } else if (msg.t === 'mh-soul' && msg.to === mp.id) {
      var f = mp.fighters[msg.id];
      if (!f || f.char !== 'mahito' || ![msg.x, msg.y, msg.z, msg.value].every(Number.isFinite)) return;
      M.soulThreat = { by: msg.id, value: clamp(msg.value / 100) * 100, ttl: 0.5 };
      var center = V(msg.x, msg.y, msg.z),
        delta = player.pos.clone().sub(center).setY(0);
      if (delta.length() > 26 && delta.length() < 36) {
        delta.normalize().multiplyScalar(26);
        player.pos.x = center.x + delta.x;
        player.pos.z = center.z + delta.z;
      }
    } else if (msg.t === 'mh-shot') {
      var f = mp.fighters[msg.id];
      if (f && f.char === 'mahito' && [msg.x, msg.y, msg.z, msg.dx, msg.dz].every(Number.isFinite))
        launchBullet({}, 3, false, V(msg.x, msg.y, msg.z), V(msg.dx, 0, msg.dz).normalize());
    }
  };
  M.remoteState = function (r, mode, awake, action, blocking) {
    if (r && r.mh) {
      r.mh.awake = !!awake;
      VOX.mode(r, mode >= 0 && mode <= 2 ? mode : 0, action);
    }
    if (r) r.mhBlocking = !!blocking;
  };
  Object.keys(KIT).forEach(function (key) {
    M.remote[key] = function (pos, yaw, f) {
      var d = DIR(yaw),
        a = { type: key, dir: d, origin: pos, dur: KIT[key].dur, held: new Set() },
        ent = f && f.e;
      if (f && f.mhPending) discard(f.mhPending);
      var timeline = effect(
        new THREE.Group(),
        a.dur,
        (t, dt, o) => {
          var at = ent ? ent.pos : pos;
          if (f && f.action && f.action.type === key) o.seenAction = true;
          else if (o.seenAction) {
            o.life = t;
            return;
          }
          function beat(index, time, fn) {
            if (t >= time && !o[index]) {
              o[index] = true;
              fn();
            }
          }
          if (key === 'mh_repel' || key === 'mh_ride') beat('worm', 0.65, () => launchRepel(a, false, ent));
          else if (key === 'mh_awaken') beat('burst', 1.1, () => burstWorms(at, false));
          else if (key === 'mh_grab')
            beat('hand', 0.15, () => {
              a.visual = grabVisual(a, false, ent);
            });
          else if (key === 'mh_heart' || key === 'mh_spike')
            beat('legs', key === 'mh_heart' ? 0.25 : 0.65, () => {
              a.visual = legsVisual(a, false, ent, key === 'mh_spike');
            });
          else if (key === 'mh_fire')
            [0.3, 0.49, 0.68].forEach((when, i) =>
              beat('shot' + i, when, () => launchBullet(a, i, false, at, d))
            );
          else if (key !== 'mh_domain')
            beat('hit', key === 'mh_home' ? 0.64 : 0.46, () =>
              impact(
                at
                  .clone()
                  .addScaledVector(d, 3)
                  .add(V(0, 2.6, 0)),
                key === 'mh_black' || key === 'mh_awblack',
                false
              )
            );
        },
        false,
        () => {
          if (a.visual) discard(a.visual);
        }
      );
      if (f) f.mhPending = timeline;
    };
  });
  M.finish = function (key, e, d, point, G, isMine) {
    var t = 0,
      done = false,
      holdTime = key === 'mh_air' ? 1.15 : key === 'mh_home' ? 1.4 : 1.35,
      baseScale = e.rig.body.scale.clone();
    if (isMine) {
      release(player.action);
      player.action = { type: 'mh_fin', fin: key, t: 0, dur: holdTime };
    }
    var g = new THREE.Group();
    effect(
      g,
      holdTime,
      (time) => {
        t = time;
        if (key === 'mh_home' && e !== player)
          e.rig.body.position.y = Math.sin(clamp(t / holdTime) * Math.PI) * 9;
        if ((key === 'mh_focus' || key === 'mh_black') && e !== player)
          e.rig.body.scale.copy(baseScale).multiplyScalar(1 - clamp(t / 0.95) * 0.7);
        if (t > 0.85 && !done) {
          done = true;
          impact(point, key === 'mh_black', isMine);
          if (key === 'mh_air') G.flatten(e, { crater: 5 });
          else if (key === 'mh_blade_dash') G.halve(e, { dir: d });
          else if (key === 'mh_home')
            G.fling(
              e,
              d
                .clone()
                .multiplyScalar(40)
                .add(V(0, 24, 0))
            );
          else G.implode(e, {});
          if (isMine && (key === 'mh_focus' || key === 'mh_black')) {
            item(key === 'mh_focus' ? 'human' : 'flesh', e.pos.clone());
            item(key === 'mh_focus' ? 'human' : 'flesh', e.pos.clone().add(V(1, 0, 0)));
          }
        }
      },
      isMine,
      () => {
        e.rig.body.scale.copy(baseScale);
        e.rig.body.position.y = 0;
      }
    );
  };
  function keydown(e) {
    if (typingInUI(e) || e.ctrlKey || e.metaKey || e.altKey || !gameInputActive()) return;
    if (e.code === 'Space' && M.grabbed) {
      if (!e.repeat && M.grabbed.escape) {
        M.grabbed.jumps++;
        if (M.grabbed.jumps >= 5) {
          send({ t: 'mh-escape', to: M.grabbed.by });
          M.grabbed = null;
        }
      }
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    if (M.grabbed) {
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    if (e.code === 'KeyB') {
      if (!busy() && !player.react && !player.dead) player.blocking = true;
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    if (!mine()) return;
    var handled = true;
    if (e.code === 'Digit2') keys.Digit2 = true;
    if (
      e.repeat &&
      ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'KeyR', 'KeyF', 'KeyG', 'KeyX', 'KeyE'].includes(e.code)
    ) {
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    if (/^Digit[1-4]$/.test(e.code)) cast(Number(e.code.slice(-1)));
    else if (e.code === 'KeyR') special();
    else if (e.code === 'KeyF' || e.code === 'KeyG') awaken();
    else if (e.code === 'KeyX') {
      if (M.active && !busy()) {
        M.basePage = !M.basePage;
        refresh();
      }
    } else if (e.code === 'KeyE') pickup();
    else handled = false;
    if (handled) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }
  addEventListener('keydown', keydown, true);
  addEventListener(
    'mousedown',
    (e) => {
      if (M.grabbed) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    },
    true
  );
  addEventListener(
    'keyup',
    (e) => {
      if (e.code === 'Digit2') keys.Digit2 = false;
      if (e.code === 'KeyB') player.blocking = false;
    },
    true
  );
  addEventListener('blur', () => {
    player.blocking = false;
    keys.Digit2 = false;
  });
  var hud = document.createElement('div');
  hud.id = 'jjMahitoHud';
  hud.style.cssText =
    'position:fixed;left:50%;bottom:158px;transform:translateX(-50%);width:min(510px,92vw);color:#cfefeb;background:#111820dc;border:1px solid #668f91;padding:9px 12px;z-index:21;font:12px Barlow,Segoe UI,sans-serif;display:none';
  hud.innerHTML =
    '<div class="mhTitle"></div><div style="height:5px;background:#29343d;margin:6px 0"><div class="mhFill" style="height:100%;background:#79eee0"></div></div><div class="mhHint"></div>';
  document.body.appendChild(hud);
  var help = document.createElement('div');
  help.className = 'kit-row';
  help.innerHTML =
    '<span class="cn">MAHITO</span><span><b>R</b> arms · <b>3 → 3</b> timed Black Flash · <b>4 → 3</b> ride · <b>F / G</b> awaken · <b>X</b> switch kit<br><b>B</b> block · <b>E</b> pick up / throw soul · <b>R</b> store held soul · <b>B + LMB</b> retrieve · Hold <b>2</b> extra Soul Fire shots</span>';
  var control = document.querySelector('#menu .ctrl-kits');
  if (control) control.appendChild(help);
  var prevHUD = updateHUD;
  updateHUD = function (dt) {
    prevHUD(dt);
    if (M.soulThreat) {
      M.soulThreat.ttl -= dt;
      if (M.soulThreat.ttl <= 0) M.soulThreat = null;
    }
    hud.style.display = started && (mine() || M.grabbed || M.soulThreat) ? 'block' : 'none';
    if (mine()) {
      var aw = document.getElementById('jjAwake');
      if (aw) aw.style.display = 'none';
    }
    var title = M.active
      ? 'ESSENCE OF THE SOUL · ' +
        Math.ceil(M.remaining) +
        's · ' +
        (M.basePage ? 'BASE KIT' : 'AWAKENING KIT')
      : 'ESSENCE OF THE SOUL · ' + Math.floor(M.charge) + '%' + (M.charge >= 100 ? ' · F / G READY' : '');
    if (M.grabbed)
      title =
        'FORCE GRAB · ' + (M.grabbed.escape ? 'PRESS SPACE TO ESCAPE ' + M.grabbed.jumps + '/5' : 'HELD');
    else if (M.soulThreat) title = 'SOUL INTEGRITY · ' + Math.ceil(M.soulThreat.value) + '%';
    hud.querySelector('.mhTitle').textContent = title;
    hud.querySelector('.mhFill').style.width =
      (M.soulThreat ? M.soulThreat.value : M.active ? (M.remaining / 60) * 100 : M.charge) + '%';
    var a = player.action,
      hint =
        ['NORMAL', 'BLADES', 'CLUBS'][M.mode] +
        ' · R: transform · Stored souls: ' +
        M.reserves.length +
        (M.held ? ' · Holding ' + M.held.kind : '') +
        ' · B: block';
    if (a && a.type === 'mh_focus' && a.t >= 0.2 && a.t <= 0.38) hint = 'PRESS 3 NOW · BLACK FLASH';
    else if (a && a.type === 'mh_grab') hint = '2: slam · R: throw';
    else if (M.active) hint += ' · X: switch kit · F/G: Black Flash';
    hud.querySelector('.mhHint').textContent = hint;
  };
})();
