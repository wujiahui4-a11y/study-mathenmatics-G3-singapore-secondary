/* Aoi Todo · original Boogie Woogie battleground kit.
   One awakening, inspired by episodes 44–45. The imagination sequence is
   an original cinematic adaptation, not a Domain Expansion. */
(function () {
  'use strict';
  var V = (x, y, z) => new THREE.Vector3(x || 0, y || 0, z || 0),
    DIR = (y) => V(Math.sin(y), 0, Math.cos(y));
  var FX = JJTODOFX,
    VOX = JJTODOVOX;
  var T = (window.JJTODO = {
    active: false,
    remaining: 0,
    charge: 0,
    stone: null,
    grabbed: null,
    remote: {},
    lastAction: null
  });
  var K = (T.kit = {
    b1: { name: 'Clap & Collide', slot: 'b1', cd: 8, dur: 1.05, damage: 14 },
    td_air: { name: 'Clap & Collide · Heel Drop', slot: 'b1', cd: 8, dur: 1.15, damage: 17 },
    b2: { name: 'Cursed Stone', slot: 'b2', cd: 11, dur: 0.7, damage: 10 },
    td_stone: { name: 'Stone Feint · Blindside', slot: 'b2', cd: 11, dur: 0.95, damage: 18 },
    b3: { name: 'Heavy Knuckle', slot: 'b3', cd: 13, dur: 1.1, damage: 16 },
    td_black: { name: 'Heavy Knuckle · Black Flash', slot: 'b3', cd: 13, dur: 1.1, damage: 22 },
    b4: { name: 'Brother’s Rhythm', slot: 'b4', cd: 17, dur: 2.15, damage: 25 },
    br: { name: 'False Clap', slot: 'br', cd: 9, dur: 0.85, damage: 8 },
    td_awaken: { name: 'My Best Friend · 120%', slot: 'tdAw', cd: 0, dur: 3.65, damage: 0 },
    tda1: { name: 'Cross Rhythm', slot: 'tda1', cd: 13, dur: 2.0, damage: 28, awake: true },
    tda2: { name: 'Sky-Swap Piledriver', slot: 'tda2', cd: 16, dur: 2.25, damage: 30, awake: true },
    tda3: { name: 'Black Flash · Overdrive', slot: 'tda3', cd: 18, dur: 1.55, damage: 32, awake: true },
    tda4: { name: 'Brotherhood Finale', slot: 'tda4', cd: 35, dur: 5.65, damage: 55, awake: true }
  });
  Object.values(K).forEach((k) => (cds[k.slot] = 0));
  var cfg = {
    todo: true,
    face: false,
    skin: VOX.colors.skin,
    torso: VOX.colors.navy,
    pants: VOX.colors.navy,
    shoes: VOX.colors.dark
  };
  function moves() {
    return [
      { key: 'LMB', lbl: 'Heavy Combo', cd: 'm1', max: 0.34 },
      { key: 'Q', lbl: 'Dash', cd: 'dash', max: 1 }
    ]
      .concat(
        (T.active ? ['tda1', 'tda2', 'tda3', 'tda4'] : ['b1', 'b2', 'b3', 'b4']).map((id, i) => ({
          key: String(i + 1),
          lbl: K[id].name,
          cd: K[id].slot,
          max: K[id].cd
        }))
      )
      .concat([{ key: 'R', lbl: 'False Clap', cd: 'br', max: 9 }]);
  }
  CHARS.todo = {
    name: 'AOI TODO',
    sub: 'BOOGIE WOOGIE — MY BEST FRIEND',
    cfg,
    glow: '#ffd59a',
    moves: moves()
  };
  CHARS.todo.portrait = makePortrait(cfg);
  buildCharList();
  function mine() {
    return player.char === 'todo';
  }
  function refresh() {
    CHARS.todo.moves = moves();
    if (mine()) buildMovesBar();
  }
  function allowed() {
    return (
      started &&
      gameInputActive() &&
      mine() &&
      !player.dead &&
      !player.react &&
      player.frameT <= 0 &&
      !T.grabbed
    );
  }
  function send(m) {
    var mp = window.MPJJ;
    if (mp && mp.active && mp.relay) mp.relay.pub(Object.assign({ id: mp.id }, m));
  }
  function rayFraction(a, b, radius) {
    var length = a.distanceTo(b);
    if (length < 0.001) return 1;
    var fraction = JJJJS.ray(a, b, radius);
    // JJS subtracts a 0.1-unit clearance even on an unobstructed segment.
    return fraction >= 1 - 0.1 / length - 1e-6 ? 1 : fraction;
  }
  function clearLine(a, b) {
    return (
      !(window.JJMAP && JJMAP.id === 'jjs') ||
      rayFraction(a.clone().add(V(0, 2.5, 0)), b.clone().add(V(0, 2.5, 0)), 0.25) === 1
    );
  }
  function available(e) {
    return e && !e.dead && e.hp > 0 && !(e.iframes > 0) && !e.cineHold;
  }
  function target(range, cone, dir) {
    dir = dir || camForward();
    return (
      enemies
        .filter((e) => {
          if (!available(e)) return false;
          var v = e.pos.clone().sub(player.pos),
            len = v.length();
          return (
            len < range &&
            Math.abs(v.y) < 8 &&
            (len < 1 || v.normalize().dot(dir) > (cone == null ? 0.05 : cone)) &&
            clearLine(player.pos, e.pos)
          );
        })
        .sort((a, b) => a.pos.distanceToSquared(player.pos) - b.pos.distanceToSquared(player.pos))[0] || null
    );
  }
  function near(at, range) {
    return enemies.filter((e) => available(e) && e.pos.distanceTo(at) < range && clearLine(at, e.pos));
  }
  function move(actor, to, teleport) {
    var from = actor.pos.clone(),
      next = to.clone();
    if (window.JJMAP && JJMAP.id === 'jjs') {
      var f = rayFraction(from.clone().add(V(0, 2.5, 0)), next.clone().add(V(0, 2.5, 0)), 0.85);
      next.lerpVectors(from, next, f);
    }
    collideWorld(next, 0.95);
    actor.pos.copy(next);
    actor.vel.set(0, 0, 0);
    actor.__jjsLast = next.clone();
    if (actor.rig) actor.rig.root.position.copy(next);
    if (teleport) visual('swap', from, next);
    return next;
  }
  T.move = move;
  function face(e) {
    var d = e.pos.clone().sub(player.pos).setY(0).normalize();
    if (d.lengthSq() < 0.1) d = camForward();
    player.facing = Math.atan2(d.x, d.z);
    return d;
  }
  function approach(a, e, distance, side) {
    if (!e || e.dead || !clearLine(player.pos, e.pos)) return false;
    var d = a.dir.clone(),
      right = V(d.z, 0, -d.x),
      p = e.pos
        .clone()
        .addScaledVector(d, -distance)
        .addScaledVector(right, side || 0);
    p.y = worldFloor(p, Math.max(player.pos.y, e.pos.y) + 0.6);
    move(player, p, true);
    a.facing = Math.atan2(e.pos.x - player.pos.x, e.pos.z - player.pos.z);
    return true;
  }
  function visual(kind, p, q, black, power) {
    if (kind === 'swap') FX.swap(p, q);
    else if (kind === 'clap') FX.clap(p, power, true);
    else if (kind === 'hit') FX.hit(p, q, black, power, true);
    else if (kind === 'debris') FX.debris(p, power || 1);
    send({
      t: 'td-fx',
      k: kind,
      x: p.x,
      y: p.y,
      z: p.z,
      q: q ? q.toArray() : null,
      b: !!black,
      p: power || 1
    });
  }
  function gain(n) {
    if (mine() && !T.active) T.charge = Math.min(100, T.charge + Math.max(0, n) * 0.85);
  }
  function hit(e, key, amount, d, power, up, opts) {
    opts = opts || {};
    if (!e || e.dead || e.hp <= 0 || e.iframes > 0) return false;
    if (e.blocking && !opts.breakGuard && DIR(e.facing || 0).dot(d) < -0.15) {
      visual('clap', e.pos.clone().add(V(0, 3, 0)), null, false, 0.5);
      return false;
    }
    var before = e.hp,
      finKey = key === 'td_air' ? 'b1' : key === 'td_stone' ? 'b2' : key === 'td_black' ? 'b3' : key;
    e.damage(
      amount,
      d
        .clone()
        .multiplyScalar(power || 0)
        .add(V(0, up || 0, 0)),
      {
        noFrameBonus: true,
        fin: ['b1', 'b2', 'b3', 'b4'].includes(finKey) && opts.fin !== false,
        finSkill: finKey,
        stun: opts.stun == null ? 0.5 : opts.stun,
        react: power > 15 || up > 9 ? 'blow' : 'stagger',
        reactDur: opts.stun || 0.5,
        spark: 0xffd59a,
        death: 'ragdoll'
      }
    );
    gain(Math.min(before, amount));
    visual(
      'hit',
      e.pos.clone().add(V(0, 2.7, 0)),
      d,
      key === 'td_black' || key === 'tda3' || key === 'tda4',
      opts.power || 1
    );
    return true;
  }
  function hold(a, e, point) {
    if (!e || e.dead) return;
    e.pos.copy(point);
    e.vel.set(0, 0, 0);
    e.cineHold = true;
    e.stunT = 0.3;
    e.anchorT = 0;
    e.rig.root.position.copy(point);
    e.tdHold = a;
    a.tdHeld = e;
    a.holdAcc = (a.holdAcc || 0) + 1;
    e.rig.spine.rotation.x = -0.13;
    e.rig.neck.rotation.x = -0.2;
    e.rig.shoulderL.rotation.z = -0.22;
    e.rig.shoulderR.rotation.z = 0.22;
    if (e.net && a.holdAcc % 4 === 1)
      send({ t: 'td-control', to: e.net.id, op: 'hold', x: point.x, y: point.y, z: point.z });
  }
  function release(a) {
    if (!a || !a.tdHeld) return;
    var e = a.tdHeld;
    e.tdHold = null;
    e.cineHold = false;
    e.stunT = 0;
    e.anchorT = 0;
    resetPose(e.rig);
    if (e.net) send({ t: 'td-control', to: e.net.id, op: 'release' });
    a.tdHeld = null;
  }
  function removeStone() {
    if (T.stone) {
      T.stone.fx.stop();
      T.stone = null;
      send({ t: 'td-stone-end' });
    }
  }
  function start(key, free) {
    var k = K[key];
    if (!k || !allowed() || busy() || (!free && cds[k.slot] > 0) || (k.awake && !T.active)) return false;
    player.blocking = false;
    cds[k.slot] = free ? cds[k.slot] : k.cd;
    var a = (player.action = {
      type: key,
      t: 0,
      dur: k.dur,
      stage: 0,
      dir: camForward(),
      origin: player.pos.clone(),
      events: {},
      hits: new Set()
    });
    player.facing = Math.atan2(a.dir.x, a.dir.z);
    player.vel.x = player.vel.z = 0;
    a.facing = player.facing;
    a.target = target(key === 'b1' || key === 'td_air' ? 23 : key === 'tda4' ? 9 : 14, 0.05, a.dir);
    if (key === 'b3' || key === 'td_black') a.target = target(6, 0.3, a.dir);
    if (key === 'td_air') {
      player.vel.y = 4;
      player.onGround = false;
    }
    if (key === 'td_stone') {
      a.spot = T.stone.g.position.clone();
      a.spot.y = worldFloor(a.spot);
      removeStone();
    }
    if (key === 'td_awaken') {
      player.iframes = k.dur;
      if (T.cinematic) a.cine = T.cinematic('awake', a.origin, a.dir, null, true);
    }
    showSplash(k.name.toUpperCase(), T.active ? '120% · BOOGIE WOOGIE' : 'AOI TODO', '#ffd59a');
    return true;
  }
  T.cast = function (slot) {
    var a = player.action;
    if (slot === 3 && a && a.type === 'b3' && a.t >= 0.24 && a.t <= 0.42) {
      a.type = 'td_black';
      a.stage = 1;
      return true;
    }
    if (slot === 2 && T.stone && (!a || (a.type === 'b2' && a.t > 0.24))) {
      if (a) player.action = null;
      return start('td_stone', true);
    }
    var ids = T.active
      ? ['tda1', 'tda2', 'tda3', 'tda4']
      : [player.onGround ? 'b1' : 'td_air', 'b2', 'b3', 'b4'];
    return start(ids[slot - 1]);
  };
  T.special = () => start('br');
  T.awaken = function () {
    if (T.active || T.charge < 100 || !allowed() || busy()) return false;
    T.active = true;
    T.remaining = 50;
    T.charge = 0;
    player.hp = Math.min(player.maxHp, player.hp + 35);
    removeStone();
    ['tda1', 'tda2', 'tda3', 'tda4'].forEach((k) => (cds[k] = 0));
    refresh();
    return start('td_awaken');
  };
  function step(a, dt) {
    var key = a.type,
      t = a.t,
      k = K[key],
      e = a.target;
    function beat(id, at, fn) {
      if (t >= at && !a.events[id]) {
        a.events[id] = true;
        a.stage++;
        fn();
      }
    }
    function clap() {
      visual(
        'clap',
        player.pos.clone().add(V(0, 3.7, 1).applyAxisAngle(V(0, 1, 0), a.facing)),
        null,
        false,
        1
      );
    }
    if (key === 'b1' || key === 'td_air') {
      beat('swap', 0.26, () => {
        clap();
        if (e) approach(a, e, 2.5, key === 'td_air' ? 1.1 : 0);
      });
      beat('hit', key === 'td_air' ? 0.57 : 0.47, () => {
        var d = e ? face(e) : a.dir;
        Fist(e, key, k.damage, d, 22, key === 'td_air' ? 3 : 8, 5.2);
        if (key === 'td_air') visual('debris', player.pos.clone(), null, false, 1.2);
      });
    } else if (key === 'b2') {
      beat('throw', 0.2, () => {
        removeStone();
        var from = player.pos.clone().add(V(0.5, 3.5, 1).applyAxisAngle(V(0, 1, 0), a.facing));
        var dest = e ? e.pos.clone().addScaledVector(a.dir, 2) : a.origin.clone().addScaledVector(a.dir, 17);
        if (!clearLine(a.origin, dest)) {
          dest.lerpVectors(a.origin, dest, 0.35);
        }
        dest.y = worldFloor(dest, Math.max(player.pos.y, dest.y) + 1) + 0.4;
        send({ t: 'td-stone', x: from.x, y: from.y, z: from.z, q: dest.toArray() });
        var g = FX.pebble(from),
          s = { g, t: 0, landed: false };
        T.stone = s;
        s.fx = FX.effect(
          g,
          3.3,
          (time, dd) => {
            s.t = time;
            var u = Math.min(1, time / 0.4);
            g.position.copy(from).lerp(dest, u);
            g.position.y += Math.sin(u * Math.PI) * 1.3;
            g.rotation.x = time * 7;
            g.rotation.z = time * 4;
            if (u === 1 && !s.landed) {
              s.landed = true;
              if (e && e.pos.distanceTo(g.position) < 4) hit(e, 'b2', 10, a.dir, 3, 0, { fin: false });
            }
            if (u === 1) g.position.y = dest.y + Math.sin(time * 5) * 0.13;
          },
          () => {
            if (T.stone === s) T.stone = null;
          }
        );
      });
    } else if (key === 'td_stone') {
      beat('swap', 0.24, () => {
        clap();
        move(player, a.spot, true);
        if (e) a.facing = Math.atan2(e.pos.x - player.pos.x, e.pos.z - player.pos.z);
      });
      beat('kick', 0.47, () => Fist(e, key, 18, e ? face(e) : a.dir, 24, 7, 6));
    } else if (key === 'b3' || key === 'td_black') {
      if (t > 0.27 && t < 0.45) move(player, player.pos.clone().addScaledVector(a.dir, dt * 6), false);
      beat('hit', 0.49, () => {
        var at = player.pos.clone().addScaledVector(a.dir, 3);
        var list = near(at, 3.7);
        list.forEach((v) =>
          hit(v, key, k.damage, a.dir, key === 'td_black' ? 31 : 22, key === 'td_black' ? 10 : 5)
        );
        if (!list.length) FX.arc(at.clone().add(V(0, 3, 0)), a.facing, 2.8, 0xfff1d6, 0.25);
      });
    } else if (key === 'b4' || key === 'tda1' || key === 'tda2') {
      var sky = key === 'tda2',
        times = sky
          ? [0.38, 0.84, 1.65]
          : key === 'tda1'
            ? [0.3, 0.64, 1.02, 1.43]
            : [0.34, 0.77, 1.25, 1.68];
      if (a.confirm && e && !e.dead && a.tdHeld) hold(a, e, a.pin);
      if (a.confirm && (!e || e.dead || player.pos.distanceTo(e.pos) > 20)) {
        release(a);
        a.dur = t;
        return;
      }
      times.forEach((at, i) =>
        beat('hit' + i, at, () => {
          if (!e || e.dead) return;
          if (i === 0) {
            if (!available(e) || !clearLine(player.pos, e.pos) || e.pos.distanceTo(player.pos) > 14) return;
            if (e.blocking && DIR(e.facing).dot(a.dir) < -0.15) return;
            a.confirm = true;
            a.pin = e.pos.clone();
          }
          if (!a.confirm) return;
          clap();
          if (sky && i === 1) {
            a.pin.y += 5;
            move(player, a.pin.clone().addScaledVector(a.dir, -2.5), true);
          } else if (sky && i === 2) {
            a.pin.y = worldFloor(a.pin);
            move(player, a.pin.clone().addScaledVector(a.dir, -2.5), true);
          } else approach(a, e, 2.6, i % 2 ? 1.7 : -1.7);
          var last = i === times.length - 1;
          hold(a, e, a.pin);
          if (last) release(a);
          hit(
            e,
            key,
            last ? (sky ? 18 : key === 'tda1' ? 13 : 10) : sky ? 6 : 5,
            face(e),
            last ? 29 : 0,
            last ? (sky ? 2 : 11) : 0,
            { fin: last, stun: last ? 0.8 : 0.3, power: last ? 1.3 : 0.7 }
          );
          if (sky && last) visual('debris', a.pin, null, false, 2);
        })
      );
    } else if (key === 'br') {
      beat('clap', 0.18, clap);
      if (a.counter)
        beat('counter', a.trigger + 0.13, () => {
          if (e) Fist(e, 'br', T.active ? 12 : 8, face(e), 19, 5, 6);
        });
    } else if (key === 'td_awaken') {
      player.vel.set(0, 0, 0);
      move(player, a.origin, false);
      player.iframes = Math.max(player.iframes, 0.15);
      beat('rise', 2.55, () => {
        VOX.awake(player.rig, true);
        clap();
        visual('debris', player.pos.clone(), null, false, 1.3);
      });
    } else if (key === 'tda3') {
      if (t > 0.3 && t < 0.68) move(player, player.pos.clone().addScaledVector(a.dir, dt * 34), false);
      if (t > 0.32 && t < 0.72) {
        var candidates = near(player.pos.clone().addScaledVector(a.dir, 2.8), 3.4);
        candidates.forEach((v) => {
          if (!a.hits.has(v)) {
            a.hits.add(v);
            hit(v, key, 32, a.dir, 37, 12, { breakGuard: true, power: 1.6 });
          }
        });
      }
      beat('trail', 0.38, () =>
        FX.arc(player.pos.clone().add(V(0, 3, 0)), a.facing, 4, 0xf2375c, 0.45, 0.25)
      );
    } else if (key === 'tda4') {
      beat('confirm', 0.32, () => {
        if (
          !available(e) ||
          e.pos.distanceTo(player.pos) > 9 ||
          !clearLine(player.pos, e.pos) ||
          (e.blocking && DIR(e.facing).dot(a.dir) < -0.15)
        ) {
          a.dur = 1.05;
          return;
        }
        a.confirm = true;
        a.pin = e.pos.clone();
        a.origin = player.pos.clone();
        a.dir = face(e);
        a.facing = player.facing;
        player.iframes = 5.25;
        hold(a, e, a.pin);
        if (T.cinematic) a.cine = T.cinematic('ultimate', a.origin, a.dir, e, true);
        send({
          t: 'td-cine',
          k: 'ultimate',
          x: a.origin.x,
          y: a.origin.y,
          z: a.origin.z,
          d: a.dir.toArray(),
          to: e.net ? e.net.id : null
        });
      });
      if (a.confirm) {
        if (
          !e ||
          e.dead ||
          e.hp <= 0 ||
          player.pos.distanceTo(e.pos) > 20 ||
          (e.net && window.MPJJ && !MPJJ.fighters[e.net.id])
        ) {
          a.dur = t;
          release(a);
          if (a.cine) a.cine.stop();
          return;
        }
        player.iframes = Math.max(player.iframes, 0.15);
        if (t < 5.15) {
          hold(a, e, a.pin);
          player.vel.set(0, 0, 0);
        }
        [1.15, 1.75, 2.4, 3.1].forEach((at, i) =>
          beat('swap' + i, at, () => {
            var side = V(a.dir.z, 0, -a.dir.x);
            var atp = a.pin
              .clone()
              .addScaledVector(a.dir, i % 2 ? 2.5 : -2.5)
              .addScaledVector(side, i % 2 ? -1.5 : 1.5);
            move(player, atp, false);
            a.facing = Math.atan2(e.pos.x - player.pos.x, e.pos.z - player.pos.z);
          })
        );
        beat('final', 5.1, () => {
          release(a);
          hit(e, key, 55, a.dir, 43, 14, { breakGuard: true, power: 2.1, fin: false });
          visual('debris', e.pos.clone(), null, false, 2.8);
          T.remaining = Math.max(0, T.remaining - 8);
        });
      }
    }
    function Fist(v, id, damage, d, kb, up, range) {
      if (v && !v.dead && v.pos.distanceTo(player.pos) < range && clearLine(player.pos, v.pos))
        hit(v, id, damage, d, kb, up);
      else FX.arc(player.pos.clone().add(V(0, 3, 0)), a.facing, 2.5, 0xffe4bc, 0.24);
    }
  }
  var beforeStep = stepAction;
  stepAction = function (a, dt) {
    if (K[a.type]) return step(a, dt);
    return beforeStep(a, dt);
  };
  var beforeEnemy = Enemy.prototype.update;
  Enemy.prototype.update = function (dt) {
    if (this.tdHold && !this.dead) {
      this.vel.set(0, 0, 0);
      this.rig.root.position.copy(this.pos);
      this.rig.root.rotation.y = this.facing;
      return;
    }
    return beforeEnemy.call(this, dt);
  };
  var beforePunch = punch;
  punch = function () {
    if (!mine()) return beforePunch();
    if (!allowed() || busy() || player.blocking || cds.m1 > 0) return;
    var n = player.comboN,
      d = camForward();
    player.facing = Math.atan2(d.x, d.z);
    cds.m1 = 0.34;
    player.comboReset = 0.95;
    player.comboN = (n + 1) % 4;
    player.attackT = 0.26;
    player.attackArm = n % 2;
    near(player.pos.clone().addScaledVector(d, 2.3), 2.6).forEach((e) =>
      hit(e, 'td_m1', [4, 4, 5, 7][n], d, n === 3 ? 24 : 2, n === 3 ? 8 : 0, {
        fin: false,
        stun: n === 3 ? 0.65 : 0.25,
        power: 0.65
      })
    );
    FX.arc(player.pos.clone().add(V(0, 3.4, 0)), player.facing, 2.2, 0xf7e8d2, 0.14);
    sfx.whoosh();
  };
  function counter() {
    var a = player.action;
    if (
      mine() &&
      a &&
      a.type === 'br' &&
      a.t >= 0.1 &&
      a.t <= 0.65 &&
      !a.counter &&
      !player.dead &&
      player.iframes <= 0
    ) {
      a.counter = true;
      a.trigger = a.t;
      a.target = target(12, -1);
      a.dur = a.t + 0.48;
      player.iframes = 0.55;
      if (a.target) approach(a, a.target, -2.5, 0);
      else move(player, player.pos.clone().addScaledVector(V(a.dir.z, 0, -a.dir.x), 4), true);
      visual('clap', player.pos.clone().add(V(0, 3.6, 0)), null, false, 1.2);
      return true;
    }
    return false;
  }
  var beforeHurt = hurtPlayer;
  hurtPlayer = function (amount, knock) {
    if (counter()) return;
    var a = player.action;
    var hp = player.hp,
      result = beforeHurt(amount, knock);
    if (mine() && player.hp < hp) {
      gain((hp - player.hp) * 0.45);
      release(T.lastAction);
      if (a && K[a.type]) {
        player.action = null;
        if (a.cine) a.cine.stop();
      }
    }
    return result;
  };
  T.cleanup = function () {
    release(T.lastAction);
    if (T.cine) T.cine.stop();
    removeStone();
    T.active = false;
    T.remaining = 0;
    T.charge = 0;
    T.lastAction = null;
    if (player.rig) VOX.awake(player.rig, false);
    refresh();
  };
  var beforeSwitch = switchChar;
  switchChar = function (id, quiet) {
    var was = player.char,
      result = beforeSwitch(id, quiet);
    if (was === 'todo' && player.char !== was) T.cleanup();
    return result;
  };
  var beforeUpdate = updatePlayer;
  updatePlayer = function (dt) {
    var prior = player.action;
    if (T.grabbed) {
      T.grabbed.ttl -= dt;
      if (T.grabbed.ttl <= 0 || player.dead) {
        T.grabbed = null;
        if (T.cine && T.cine.remote) T.cine.stop();
      } else {
        clearMovement();
        player.action = null;
        player.vel.set(0, 0, 0);
        player.pos.copy(T.grabbed.pos);
      }
    }
    beforeUpdate(dt);
    if (T.grabbed) {
      player.pos.copy(T.grabbed.pos);
      player.vel.set(0, 0, 0);
      player.rig.root.position.copy(player.pos);
      var r = player.rig;
      r.spine.rotation.x = -0.18;
      r.neck.rotation.x = -0.25;
      r.shoulderL.rotation.z = -0.4;
      r.shoulderR.rotation.z = 0.4;
      r.elbowL.rotation.x = r.elbowR.rotation.x = -0.4;
    }
    if (prior && prior !== player.action) {
      release(prior);
      if (prior.cine) prior.cine.stop();
    }
    T.lastAction = player.action;
    if (!mine()) return;
    if (player.dead) {
      if (!T.wasDead) T.cleanup();
      T.wasDead = true;
      return;
    }
    T.wasDead = false;
    if (T.active) {
      T.remaining = Math.max(0, T.remaining - dt);
      if (!T.remaining && !(player.action && player.action.type === 'tda4' && player.action.confirm)) {
        if (player.action && K[player.action.type] && K[player.action.type].awake) {
          release(player.action);
          player.action = null;
        }
        T.active = false;
        VOX.awake(player.rig, false);
        refresh();
      }
    }
    var a = player.action;
    if (a && K[a.type]) {
      player.facing = a.facing;
      player.rig.root.rotation.y = player.facing;
    }
    VOX.awake(player.rig, T.active && !(a && a.type === 'td_awaken' && a.t < 2.55));
  };
  T.receive = function (m) {
    var mp = window.MPJJ,
      f = mp && mp.fighters[m.id];
    if (!f || f.char !== 'todo' || f.e.dead) return;
    if (m.t === 'td-control' && m.to === mp.id) {
      if (m.op === 'release') {
        if (T.grabbed && T.grabbed.by === m.id) T.grabbed = null;
        return;
      }
      if (player.dead || player.iframes > 0 || ![m.x, m.y, m.z].every(Number.isFinite)) return;
      var p = V(m.x, m.y, m.z);
      if (p.distanceTo(f.e.pos) > 22 || p.distanceTo(player.pos) > 16) return;
      T.grabbed = { by: m.id, pos: p, ttl: 0.45 };
    } else if (m.t === 'td-fx') {
      if (![m.x, m.y, m.z].every(Number.isFinite)) return;
      var p = V(m.x, m.y, m.z);
      if (p.distanceTo(f.e.pos) > 55) return;
      var power = Math.max(0.4, Math.min(3, Number(m.p) || 1));
      var q = Array.isArray(m.q) && m.q.length === 3 && m.q.every(Number.isFinite) ? V(...m.q) : V(0, 0, 1);
      if (m.k === 'swap' && q.distanceTo(p) < 50) FX.swap(p, q);
      else if (m.k === 'clap') FX.clap(p, power, false);
      else if (m.k === 'hit') FX.hit(p, q.normalize(), !!m.b, power, false);
      else if (m.k === 'debris') FX.debris(p, power);
    } else if (m.t === 'td-stone-end') {
      if (f.tdStone) {
        f.tdStone.stop();
        f.tdStone = null;
      }
    } else if (m.t === 'td-stone') {
      if (
        ![m.x, m.y, m.z].every(Number.isFinite) ||
        !Array.isArray(m.q) ||
        m.q.length !== 3 ||
        !m.q.every(Number.isFinite)
      )
        return;
      var from = V(m.x, m.y, m.z),
        to = V(...m.q);
      if (from.distanceTo(f.e.pos) > 8 || from.distanceTo(to) > 25) return;
      if (f.tdStone) f.tdStone.stop();
      var g = FX.pebble(from);
      f.tdStone = FX.effect(g, 3.3, (t) => {
        var k = Math.min(1, t / 0.4);
        g.position.copy(from).lerp(to, k);
        g.position.y += Math.sin(k * Math.PI) * 1.3;
        g.rotation.x = t * 7;
        g.rotation.z = t * 4;
      });
    } else if (m.t === 'td-cine' && m.k === 'ultimate' && T.cinematic) {
      if (
        ![m.x, m.y, m.z].every(Number.isFinite) ||
        !Array.isArray(m.d) ||
        m.d.length !== 3 ||
        !m.d.every(Number.isFinite)
      )
        return;
      var p = V(m.x, m.y, m.z);
      if (p.distanceTo(f.e.pos) > 20) return;
      var victim = m.to === mp.id ? player : mp.fighters[m.to] && mp.fighters[m.to].e;
      T.cinematic(
        'ultimate',
        p,
        V(...m.d)
          .setY(0)
          .normalize(),
        victim,
        false,
        m.to === mp.id,
        f.e
      );
    }
  };
  Object.keys(K).forEach(
    (key) =>
      (T.remote[key] = function (p, y, f) {
        if (key === 'td_awaken' && T.cinematic) T.cinematic('awake', p, DIR(y), null, false, false, f && f.e);
        // Every damaging beat is sent separately as td-fx; cast never reapplies damage.
      })
  );
  T.finish = function (key, e, d, p, G, isMine) {
    if (!e) return;
    var at = e.pos.clone(),
      i = ['b1', 'b2', 'b3', 'b4'].indexOf(key),
      g = new THREE.Group(),
      done = false;
    if (isMine) {
      player.action = { type: 'td_fin', fin: key, t: 0, dur: 1.3, stage: 0 };
      player.iframes = Math.max(player.iframes, 1.3);
    }
    FX.effect(g, 1.3, (t) => {
      if (t > 0.3 && !done) {
        done = true;
        FX.clap(at.clone().add(V(0, 3, 0)), 1.2, isMine);
        if (i === 0) FX.arc(at.clone().add(V(0, 4, 0)), 0, 5, 0xfff7df, 0.5, 0.8);
        if (i === 1) FX.swap(at.clone().addScaledVector(d, 4), at);
        if (i === 3) {
          [-1, 1].forEach((s) => FX.arc(at.clone().add(V(0, 2.4, 0)), s, 5, 0xffd59a, 0.5, 0.4));
        }
      }
      if (t > 0.75 && done === true) {
        done = 2;
        FX.hit(at.clone().add(V(0, 2.5, 0)), d, i === 2, 1.8, isMine);
        FX.debris(at, 1.8);
        G.fling(
          e,
          d
            .clone()
            .multiplyScalar(i === 1 ? -37 : 32)
            .add(V(0, i === 0 ? 23 : 10, 0))
        );
      }
    });
  };
  addEventListener(
    'keydown',
    (e) => {
      if (typingInUI(e) || e.ctrlKey || e.metaKey || e.altKey || !gameInputActive()) return;
      if (T.grabbed) {
        if (e.code !== 'ShiftLeft' && e.code !== 'ShiftRight' && e.code !== 'Escape') {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
        return;
      }
      if (!mine()) return;
      var yes = /^Digit[1-4]$/.test(e.code) || ['KeyR', 'KeyG'].includes(e.code);
      if (!yes) return;
      if (!e.repeat) {
        if (e.code.startsWith('Digit')) T.cast(Number(e.code.slice(-1)));
        else if (e.code === 'KeyR') T.special();
        else T.awaken();
      }
      e.preventDefault();
      e.stopImmediatePropagation();
    },
    true
  );
  addEventListener(
    'mousedown',
    (e) => {
      if (T.grabbed && e.button === 0 && gameInputActive()) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    },
    true
  );
  var hud = document.createElement('div');
  hud.id = 'jjTodoHud';
  hud.style.cssText =
    'position:fixed;left:50%;bottom:158px;transform:translateX(-50%);width:min(480px,90vw);padding:10px 14px;background:#191923e8;border:1px solid #bc9b75;color:#ffebd0;z-index:22;font:12px Segoe UI,sans-serif;display:none';
  hud.innerHTML =
    '<div class="td-title"></div><div style="height:5px;background:#45404b;margin:7px 0"><div class="td-fill" style="height:100%;background:linear-gradient(90deg,#b975ad,#ffe1a4)"></div></div><div class="td-hint"></div>';
  document.body.appendChild(hud);
  var help = document.createElement('div');
  help.className = 'kit-row';
  help.innerHTML =
    '<span class="cn">AOI TODO</span><span><b>1–4</b> skills · <b>R</b> counter · <b>G</b> awaken<br>Air <b>1</b>: heel drop · <b>2 → 2</b>: stone swap · <b>3 → 3</b>: timed Black Flash · <b>F</b>: block</span>';
  var panel = document.querySelector('#menu .ctrl-kits');
  if (panel) panel.appendChild(help);
  var beforeHUD = updateHUD;
  updateHUD = function (dt) {
    beforeHUD(dt);
    hud.style.display = started && mine() && !player.dead ? 'block' : 'none';
    if (!mine()) return;
    var old = document.getElementById('jjAwake');
    if (old) old.style.display = 'none';
    hud.querySelector('.td-title').textContent = T.active
      ? '120% POTENTIAL · ' + Math.ceil(T.remaining) + 's'
      : 'MY BEST FRIEND · ' + Math.floor(T.charge) + '%' + (T.charge >= 100 ? ' · G TO AWAKEN' : '');
    hud.querySelector('.td-fill').style.width = (T.active ? T.remaining * 2 : T.charge) + '%';
    var a = player.action;
    hud.querySelector('.td-hint').textContent =
      a && a.type === 'b3' && a.t >= 0.24 && a.t <= 0.42
        ? 'PRESS 3 NOW · BLACK FLASH'
        : T.stone
          ? 'PRESS 2 · SWAP WITH CURSED STONE'
          : T.active
            ? '1–4: awakened skills · 4: cinematic ultimate · R: counter'
            : 'Air 1: heel drop · 2 → 2: stone swap · 3 → 3: Black Flash · R: counter';
  };
  // The AI invokes these same casts and the shared action/pose dispatchers.
  (window.JJCHARCAST ||= {}).todo = { cast: [1,2,3,4].map(slot=>()=>T.cast(slot)).concat(()=>T.special()), state: T, release, defend: counter };
})();
