/* =======================================================================
   HAKARI, IN FEVER
   What the jackpot actually buys. While the song is playing his bar is
   four different moves, and none of them is a piece of parlour furniture
   — he has unlimited output and no reason to be careful with it.

     1  a shipping container, kicked down the road at them. In the air it
        is summoned overhead and punched down instead.
     2  the punch rush, but long, and with the fists left behind in the
        air as afterimages.
     3  two seconds of dancing and then a run he steers himself, dragging
        whoever he touches along with him. Two of them at most.
     4  up, and the ground breaks. Then down, and it breaks again.

   Every one of them ends differently, and the second one hands the
   camera to the player for five seconds.
   ===================================================================== */
(function () {
  'use strict';
  if (typeof player === 'undefined' || typeof THREE === 'undefined') return;
  var FX = window.JJFX;
  if (!FX) return;
  var AN = window.JJANIM;
  var GORE = window.JJGORE;
  var E = FX.ease;
  var TAU = Math.PI * 2;
  var HK = window.JJHAKARI;
  if (!HK) return;

  var FV = window.JJFEVER = { drag: [], holes: null, box: null };
  var FCD = { ha1: 7, ha2: 8, ha3: 11, ha4: 9 };
  var GOLD = 0xffd964, HOT = 0xffe08a, PINK = 0xff5ec4;

  function awake() { return HK.fever > 0 && player.char === 'hakari'; }
  function boost() { return 1.45; }
  function aim() { return new THREE.Vector3(Math.sin(player.facing), 0, Math.cos(player.facing)); }
  function rp(r) { resetPose(r); if (r.body) r.body.rotation.set(0, 0, 0); }

  function start(type, dur, key, name, sub) {
    cds[key] = FCD[key];
    player.action = { type: type, t: 0, dur: dur, stage: 0 };
    if (name) { try { showSplash(name, sub || '', '#ffd964'); } catch (e) {} }
    if (window.MPJJ && window.MPJJ.relay) {
      window.MPJJ.relay.pub({ t: 'cast', id: window.MPJJ.id, k: type });
    }
    return player.action;
  }
  function ready(key) {
    return awake() && !player.dead && !busy() && !player.react &&
      !(window.JJGAMBLE && window.JJGAMBLE.on);
  }

  /* ===================================================================
     THE AURA, TURNED UP
     The old one was a column of smoke and a ring. In fever he is
     supposed to be the loudest thing on the screen, so this is a
     standing body of cursed energy: sheets around him, rainbow through
     it, light on the floor and the loose ground coming up off it.
     ================================================================ */
  var RAIN = [0xffe94d, 0xff4d4d, 0xffb03a, 0x4de26a, 0x4dc9ff, 0x9a6bff, 0xff5ec4];

  FV.bigAura = function () {
    if (FV.aura) return FV.aura;
    var live = true, t = 0, acc = 0, rise = 0, snap = 0, bolt = 0;
    var parts = [], junk = [];
    function keep(m) { scene.add(m); junk.push(m); return m; }

    /* The body of it is fire, not smoke. Eleven tongues stood up around
       him at different heights and speeds, so the silhouette is always
       moving and never a symmetrical cone. */
    /* Held OUT at a radius, never over him: the point of an aura is the
       silhouette it frames, so nothing here sits on his centre line. */
    for (var i = 0; i < 11; i++) {
      var m = FX.billboard(FX.T.flame, i % 3 ? GOLD : RAIN[i % RAIN.length], .3);
      var big = i < 4;
      m.scale.set(big ? 4.2 : 2.8, big ? 9 : 5.6, 1);
      keep(m);
      parts.push({ m: m, a: i / 11 * TAU, r: big ? 2.1 : 1.5 + (i % 3) * .5,
                   n: i, big: big, sp: 5 + (i % 4) * 2.3 });
    }
    /* the hard core, standing up behind him and no wider than he is */
    var core = FX.billboard(FX.T.flame, 0xfff3c4, .26);
    core.scale.set(2.4, 8, 1);
    keep(core);
    /* Two licks pinned to his outline. A ring of flames at a fixed radius
       reads as a bonfire from some angles and as nothing from others;
       these are placed off the camera's own right vector every frame, so
       whichever way you look at him there is fire on both edges of him. */
    var edge = [];
    for (var j = 0; j < 2; j++) {
      var em = FX.billboard(FX.T.flame, j ? 0xffe08a : GOLD, .42);
      em.scale.set(3, 11, 1);
      keep(em);
      edge.push(em);
    }
    var camR = new THREE.Vector3();

    /* the light it puts on the floor, and the ring standing on it */
    var pool = FX.billboard(FX.T.smoke, GOLD, .22);
    pool.rotation.x = -Math.PI / 2;
    pool.scale.set(11, 11, 1);
    keep(pool);
    var disc = FX.billboard(FX.T.ring, 0xffe08a, .3);
    disc.rotation.x = -Math.PI / 2;
    disc.scale.set(6.5, 6.5, 1);
    keep(disc);

    addFx({ t: 1e9, update: function (dt) {
      if (!live || HK.fever <= 0) {
        junk.forEach(function (m) { scene.remove(m); m.material.dispose(); });
        FV.aura = null;
        return false;
      }
      t += dt;
      var p = player.pos;
      /* a fast flicker on top of a slow swell — a steady glow reads as fog */
      var flick = .82 + .18 * Math.sin(t * 26) + .1 * Math.sin(t * 41.3);
      var pulse = (.8 + .2 * Math.sin(t * 6)) * flick;

      parts.forEach(function (q) {
        var a = q.a + t * (q.big ? .9 : 1.7);
        var lift = q.big ? 3.6 : 2.6;
        q.m.position.set(
          p.x + Math.cos(a) * q.r,
          p.y + lift + Math.sin(t * q.sp + q.n) * (q.big ? .7 : .45),
          p.z + Math.sin(a) * q.r);
        FX.faceCam(q.m, Math.sin(t * 3.1 + q.n) * .1);
        var s = 1 + Math.sin(t * q.sp + q.n * 1.7) * .14;
        q.m.scale.y = (q.big ? 9 : 5.6) * s;
        q.m.scale.x = (q.big ? 4.2 : 2.8) * (2 - s) * .96;
        q.m.material.opacity = (q.big ? .34 : .24) * pulse;
      });

      /* the two on his outline, wherever the lens happens to be */
      camera.getWorldDirection(camR);
      camR.set(camR.z, 0, -camR.x).normalize();
      edge.forEach(function (m, k) {
        var side = k ? 1 : -1;
        var wob = Math.sin(t * (9 + k * 3.4)) * .16;
        m.position.copy(p)
          .addScaledVector(camR, side * (1.25 + wob))
          .add(new THREE.Vector3(0, 5.2 + Math.sin(t * 7 + k * 2) * .5, 0));
        FX.faceCam(m, side * .07);
        m.scale.set(3.2 * (1 + wob * .5), 13.5 + Math.sin(t * 11 + k) * 1.4, 1);
        m.material.opacity = .4 * flick;
      });

      core.position.set(p.x, p.y + 3.4, p.z);
      FX.faceCam(core, 0);
      core.scale.set(2.4 + Math.sin(t * 19) * .3, 8 + Math.sin(t * 13) * .9, 1);
      core.material.opacity = .22 * flick;

      pool.position.set(p.x, .07, p.z);
      pool.scale.setScalar(11 + Math.sin(t * 6) * 1.2);
      pool.material.opacity = .2 * pulse;
      disc.position.set(p.x, .1, p.z);
      var ds = 6.5 + Math.sin(t * 9) * .8;
      disc.scale.set(ds, ds, 1);
      disc.material.opacity = .28 * flick;

      /* rainbow going up past him, constantly and thickly */
      acc += dt;
      if (acc > .02) {
        acc = 0;
        for (var k = 0; k < 2; k++) {
          var an = Math.random() * TAU, rr = 1.2 + Math.random() * 3.6;
          FX.streaks(p.clone().add(new THREE.Vector3(
            Math.cos(an) * rr, Math.random() * 5.5, Math.sin(an) * rr)),
            RAIN[(Math.random() * RAIN.length) | 0], 2, 20, 1.5);
        }
      }
      /* a shock standing off the floor every so often, so the aura beats
         instead of just burning */
      snap += dt;
      if (snap > .55) {
        snap = 0;
        FX.rings(new THREE.Vector3(p.x, .14, p.z),
          RAIN[(Math.random() * RAIN.length) | 0], 1, { maxR: 13, life: .45, gap: 0 });
      }
      /* cursed energy arcing off him */
      bolt += dt;
      if (bolt > .12) {
        bolt = 0;
        var ba = Math.random() * TAU;
        var from = p.clone().add(new THREE.Vector3(
          Math.cos(ba) * 1.1, 1.4 + Math.random() * 3.6, Math.sin(ba) * 1.1));
        var to = from.clone().add(new THREE.Vector3(
          (Math.random() - .5) * 5, (Math.random() - .2) * 4, (Math.random() - .5) * 5));
        var b = FX.billboard(FX.T.bolt, RAIN[(Math.random() * RAIN.length) | 0], .95);
        var len = FX.orientAlong(b, from, to);
        b.scale.set(len, len * .34, 1);
        scene.add(b);
        addFx({ t: .1, update: function (dd) {
          this.t -= dd;
          b.material.opacity = Math.max(0, this.t / .1);
          if (this.t <= 0) { scene.remove(b); b.material.dispose(); return false; }
          return true;
        } });
      }
      /* and the loose ground lifting off the floor around him */
      rise += dt;
      if (rise > .07) {
        rise = 0;
        var a2 = Math.random() * TAU, r2 = 1.6 + Math.random() * 4.4;
        var sz = .12 + Math.random() * .24;
        var g = new THREE.Mesh(new THREE.BoxGeometry(sz, sz, sz),
          new THREE.MeshBasicMaterial({
            color: Math.random() < .35 ? RAIN[(Math.random() * RAIN.length) | 0] : GOLD,
            transparent: true, toneMapped: false }));
        g.position.set(p.x + Math.cos(a2) * r2, .2, p.z + Math.sin(a2) * r2);
        scene.add(g);
        var vy = 4 + Math.random() * 6, life = 1.1;
        addFx({ t: life, update: function (dd) {
          this.t -= dd;
          g.position.y += vy * dd;
          g.rotation.x += dd * 7; g.rotation.z += dd * 6;
          g.material.opacity = this.t / life;
          if (this.t <= 0) { scene.remove(g); g.material.dispose(); return false; }
          return true;
        } });
      }
      return true;
    } });
    FV.aura = { stop: function () { live = false; } };
    return FV.aura;
  };

  /* ===================================================================
     THE CONTAINER
     ================================================================ */
  function buildContainer() {
    var g = new THREE.Group();
    var col = [0xd83a3a, 0x2fae62, 0x3a7ad8, 0xe8b93a][(Math.random() * 4) | 0];
    var body = new THREE.Mesh(new THREE.BoxGeometry(5.4, 4.6, 4.6),
      new THREE.MeshStandardMaterial({ color: col, roughness: .82, metalness: .25 }));
    body.castShadow = true;
    g.add(body);
    g.__body = body;
    /* ribs, so it reads as a container rather than a crate */
    for (var i = -2; i <= 2; i++) {
      var rib = new THREE.Mesh(new THREE.BoxGeometry(.24, 4.7, 4.7),
        new THREE.MeshStandardMaterial({ color: 0x2a2c34, roughness: .9 }));
      rib.position.x = i * 1.05;
      g.add(rib);
    }
    var door = new THREE.Mesh(new THREE.BoxGeometry(.16, 4.2, 4.2),
      new THREE.MeshStandardMaterial({ color: 0x1e2028, roughness: .85 }));
    door.position.x = 2.75;
    g.add(door);
    return g;
  }

  /* a container that has been hit: dented in, and dented more each time */
  function dent(box, n) {
    var b = box.__body;
    if (!b) return;
    b.scale.x = Math.max(.28, b.scale.x - .11);
    b.scale.y = Math.max(.34, b.scale.y - .07);
    b.scale.z = Math.min(1.5, b.scale.z + .06);
    box.children.forEach(function (c) {
      if (c === b) return;
      c.rotation.z += (Math.random() - .5) * .4;
      c.position.y += (Math.random() - .5) * .3;
    });
    FX.debris(box.position.clone(), 6, 12, 0x6a6e78);
    FX.impact(box.position.clone(), GOLD, 1.2 + n * .1);
  }

  /* ===================================================================
     1 · CONTAINER — kicked, or dropped
     ================================================================ */
  function castContainer() {
    if (!ready('ha1')) return;
    var air = !player.onGround;
    if (air) {
      var a = start('ha1j', 1.5, 'ha1', 'CONTAINER', 'FROM ABOVE');
      a.dir = aim();
      player.vel.y = 26;                       // it jumps higher
      player.iframes = Math.max(player.iframes, .9);
      return;
    }
    var b = start('ha1', 1.4, 'ha1', 'CONTAINER', 'DOWN THE ROAD');
    b.dir = aim();
    player.iframes = Math.max(player.iframes, .4);
  }

  /* it rolls, and everything it reaches goes with it */
  function rollContainer(from, dir, ghost) {
    var box = buildContainer();
    box.position.copy(from);
    box.position.y = 2.4;
    scene.add(box);
    var hit = [], travelled = 0, spin = 0;
    addFx({ t: 4, update: function (dt) {
      this.t -= dt;
      var step = 26 * dt;
      travelled += step;
      box.position.addScaledVector(dir, step);
      spin += dt * 5.4;
      box.rotation.z = -spin * (Math.abs(dir.x) > Math.abs(dir.z) ? 1 : 0);
      box.rotation.x = spin * (Math.abs(dir.z) >= Math.abs(dir.x) ? 1 : 0);
      if (Math.random() < dt * 26) {
        FX.dust(new THREE.Vector3(box.position.x, 0, box.position.z), 2, 0xcfc3a8, 8, 2.6);
        FX.cracks(new THREE.Vector3(box.position.x, 0, box.position.z), 3, 5, 0x2a2418);
      }
      if (!ghost) {
        for (var i = 0; i < enemies.length; i++) {
          var e = enemies[i];
          if (!e || e.dead || hit.indexOf(e) >= 0) continue;
          if (e.pos.clone().add(new THREE.Vector3(0, 2.2, 0)).distanceTo(box.position) > 5) continue;
          hit.push(e);
          FV.lastBox = box;
          FV.lastHit = e;
          var kb = dir.clone().multiplyScalar(34); kb.y = 12;
          e.damage(30 * boost(), kb, {
            react: 'blow', reactDur: .9, spark: GOLD, ragdoll: true, death: 'ragdoll'
          });
          FX.heavyHit(e.pos.clone().add(new THREE.Vector3(0, 2.6, 0)), GOLD, 1.6);
          addShake(1.2);
          hitstop(.08);
        }
      }
      if (travelled < 46 && this.t > 0) return true;
      FX.impact(box.position.clone(), GOLD, 2.4);
      FX.debris(box.position.clone(), 14, 18, 0x6a6e78);
      scene.remove(box);
      box.traverse(function (o) { if (o.isMesh) o.material.dispose(); });
      return false;
    } });
    return box;
  }

  function stepContainer(a, dt) {
    var p = player;
    if (a.t < .42) {
      if (!a.box) {
        a.box = buildContainer();
        a.box.position.copy(p.pos).addScaledVector(a.dir, 5.5);
        a.box.position.y = 2.4;
        a.box.scale.setScalar(.05);
        scene.add(a.box);
        FX.rings(a.box.position.clone(), GOLD, 3, { maxR: 9, life: .5, ground: false, gap: 40 });
        try { sfx.frame(); } catch (e) {}
      }
      a.box.scale.setScalar(.05 + E.out(a.t / .42) * .95);
      return;
    }
    if (a.stage < 1) {
      a.stage = 1;
      if (a.box) {
        scene.remove(a.box);
        a.box.traverse(function (o) { if (o.isMesh) o.material.dispose(); });
        a.box = null;
      }
      FX.speedRing(p.pos.clone().addScaledVector(a.dir, 4).add(new THREE.Vector3(0, 2, 0)), HOT, 11, .3);
      addShake(1.4);
      hitstop(.07);
      try { sfx.punch(); } catch (e) {}
      rollContainer(p.pos.clone().addScaledVector(a.dir, 5.5), a.dir.clone());
    }
  }

  /* the air version: summoned overhead and driven straight down */
  function stepDrop(a, dt) {
    var p = player;
    if (a.t < .5) {
      if (!a.box) {
        a.box = buildContainer();
        scene.add(a.box);
      }
      a.box.position.copy(p.pos).add(new THREE.Vector3(0, 9 + a.t * 2, 0));
      a.box.scale.setScalar(.05 + E.out(a.t / .5) * .95);
      a.box.rotation.y = a.t * 3;
      return;
    }
    if (a.stage < 1) {
      a.stage = 1;
      FX.speedRing(p.pos.clone().add(new THREE.Vector3(0, 6, 0)), HOT, 12, .3);
      addShake(1.4);
      hitstop(.08);
      try { sfx.punch(); } catch (e) {}
      var box = a.box;
      a.box = null;
      var down = new THREE.Vector3(0, -1, 0);
      var landed = false;
      addFx({ t: 3, update: function (dd) {
        this.t -= dd;
        box.position.y -= 52 * dd;
        box.rotation.x += dd * 7;
        if (Math.random() < dd * 20) FX.streaks(box.position.clone(), GOLD, 2, 12, .8);
        if (!landed && box.position.y <= 2.2) {
          landed = true;
          var at = new THREE.Vector3(box.position.x, 0, box.position.z);
          FX.impact(box.position.clone(), GOLD, 3.4);
          FX.rings(at.clone(), GOLD, 4, { maxR: 20, life: .8, gap: 45 });
          FX.cracks(at.clone(), 14, 20, 0x2a2418);
          FX.debris(at.clone(), 20, 22, 0x6a6e78);
          FX.dust(at.clone(), 10, 0xcfc3a8, 15, 4);
          addShake(2.6);
          hitstop(.12);
          try { sfx.redBoom(); } catch (e) {}
          enemies.forEach(function (e) {
            if (!e || e.dead || e.pos.distanceTo(at) > 9) return;
            FV.lastBox = box;
            FV.lastHit = e;
            var kb = e.pos.clone().sub(at).setY(0).normalize().multiplyScalar(18); kb.y = 16;
            e.damage(44 * boost(), kb, {
              react: 'blow', reactDur: 1, spark: GOLD, ragdoll: true, death: 'dice'
            });
          });
          scene.remove(box);
          box.traverse(function (o) { if (o.isMesh) o.material.dispose(); });
          return false;
        }
        return this.t > 0;
      } });
    }
  }

  /* ===================================================================
     2 · THE BARRAGE
     The same rush, but longer, and every fist stays in the air behind
     the one after it.
     ================================================================ */
  function castBarrage() {
    if (!ready('ha2')) return;
    var a = start('ha2', 2.2, 'ha2', 'UNLIMITED', 'AND THEN SOME');
    a.dir = aim();
    a.n = 0;
    player.iframes = Math.max(player.iframes, 1.2);
  }

  var FIST = null;
  function ghostFist(at, dir, n) {
    if (!FIST) FIST = new THREE.BoxGeometry(.85, .85, 1.2);
    var m = new THREE.Mesh(FIST, new THREE.MeshBasicMaterial({
      color: n % 3 ? GOLD : HOT, transparent: true, opacity: .85,
      toneMapped: false, depthWrite: false
    }));
    m.position.copy(at);
    m.lookAt(at.clone().add(dir));
    scene.add(m);
    var t = 0, life = .42;
    var v = dir.clone().multiplyScalar(16 + Math.random() * 10);
    addFx({ t: life, update: function (dt) {
      this.t -= dt; t += dt;
      m.position.addScaledVector(v, dt);
      v.multiplyScalar(.9);
      m.material.opacity = .85 * (this.t / life);
      m.scale.setScalar(1 + t * 1.6);
      if (this.t <= 0) { scene.remove(m); m.material.dispose(); return false; }
      return true;
    } });
  }

  function stepBarrage(a, dt) {
    var p = player, d = a.dir;
    if (a.t < .22) return;
    a.acc = (a.acc || 0) + dt;
    if (a.acc < .055) return;
    a.acc = 0;
    a.n++;
    var side = new THREE.Vector3(-d.z, 0, d.x);
    var at = p.pos.clone()
      .addScaledVector(d, 2.2 + Math.random() * 1.4)
      .addScaledVector(side, (Math.random() - .5) * 1.8)
      .add(new THREE.Vector3(0, 2.2 + Math.random() * 1.6, 0));
    ghostFist(at, d, a.n);
    /* and the body itself smeared behind them */
    if (a.n % 3 === 0 && !p.dead) ghostAfterimage(p.rig, GOLD, .3);
    FX.impact(at, GOLD, .7);
    addShake(.2);
    if (a.n % 2 === 0) { try { sfx.punch(); } catch (e) {} }
    /* A rush closes the distance — standing still and punching the air
       two metres short of them is not a rush. He walks it onto the
       nearest target and the reach is a proper one. */
    var near = null, nd = 26;
    for (var i = 0; i < enemies.length; i++) {
      var en = enemies[i];
      if (!en || en.dead) continue;
      var dd = en.pos.distanceTo(p.pos);
      if (dd < nd) { nd = dd; near = en; }
    }
    if (near && nd > 3.2) {
      var to = near.pos.clone().sub(p.pos).setY(0).normalize();
      p.pos.addScaledVector(to, Math.min(18 * dt * 3, nd - 3));
      collideWorld(p.pos, 1);
      a.dir.copy(to);
      player.facing = Math.atan2(to.x, to.z);
    }
    var hits = enemiesNear(p.pos.clone().add(new THREE.Vector3(0, 2.5, 0)).addScaledVector(d, 2), 6.5);
    hits.forEach(function (e) {
      e.damage(7 * boost(), d.clone().multiplyScalar(4).setY(.6), {
        react: 'pummel', reactDur: .22, spark: GOLD, noFrameBonus: true, stun: .3
      });
    });
  }

  /* ===================================================================
     THE HOLE
     A real one: a dark shaft driven through them, with a torn rim on
     both sides, and it stays on the body and moves with it.
     ================================================================ */
  var HOLE_GEO = null, RIM_GEO = null;
  function punchHole(ent, point, dir) {
    if (!ent || !ent.rig) return;
    if (!HOLE_GEO) {
      HOLE_GEO = new THREE.CylinderGeometry(.34, .34, 2.2, 10, 1, true);
      RIM_GEO = new THREE.TorusGeometry(.36, .12, 6, 12);
    }
    /* hang it off whichever bone is nearest, so it travels with them */
    var best = null, bd = 1e9, wp = new THREE.Vector3();
    ent.rig.root.traverse(function (o) {
      if (!o.isMesh) return;
      o.getWorldPosition(wp);
      var dd = wp.distanceTo(point);
      if (dd < bd) { bd = dd; best = o; }
    });
    var host = best ? best.parent : ent.rig.root;
    var shaft = new THREE.Mesh(HOLE_GEO, new THREE.MeshBasicMaterial({
      color: 0x0a0206, side: THREE.DoubleSide, toneMapped: false
    }));
    var q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    shaft.quaternion.copy(q);
    host.worldToLocal(shaft.position.copy(point));
    host.add(shaft);
    for (var s = -1; s <= 1; s += 2) {
      var rim = new THREE.Mesh(RIM_GEO, new THREE.MeshBasicMaterial({
        color: 0x5e0714, toneMapped: false
      }));
      rim.quaternion.copy(q);
      rim.rotateX(Math.PI / 2);
      rim.position.copy(shaft.position).addScaledVector(
        host.worldToLocal(point.clone().addScaledVector(dir, s)).sub(shaft.position).normalize(), .9);
      host.add(rim);
    }
    FX.bloodBurst ? FX.bloodBurst(point.clone(), 1.6, dir.clone())
                  : FX.impact(point.clone(), 0x8b0f2a, 1.6);
    FX.blood(point.clone(), dir.clone(), 8, 1.4);
    FX.blood(point.clone(), dir.clone().negate(), 6, 1.2);
    addShake(.7);
    hitstop(.07);
    try { sfx.punch(); } catch (e) {}
  }
  FV.punchHole = punchHole;

  /* His own two fists, hung off the lens, so the shot reads as his eyes
     and not a floating camera. */
  function firstPersonHands() {
    var g = new THREE.Group();
    for (var s = -1; s <= 1; s += 2) {
      var arm = new THREE.Group();
      var sleeve = new THREE.Mesh(
        new THREE.CapsuleGeometry(.19, .95, 4, 8),
        new THREE.MeshLambertMaterial({ color: 0x1b1f2a }));
      sleeve.rotation.x = Math.PI / 2.1;
      sleeve.position.set(0, -.16, .42);
      arm.add(sleeve);
      var fist = new THREE.Mesh(
        new THREE.IcosahedronGeometry(.3, 1),
        new THREE.MeshLambertMaterial({ color: 0xe8b98e }));
      fist.scale.set(1, .88, 1.05);
      arm.add(fist);
      /* the cursed energy still on his knuckles — kept small, or it
         washes the whole bottom of the frame out */
      var glow = FX.billboard(FX.T.glow, GOLD, .3);
      glow.scale.setScalar(.85);
      arm.add(glow);
      arm.position.set(s * .74, -.62, -1.5);
      arm.rotation.z = s * -.2;
      arm.rotation.y = s * .16;
      g.add(arm);
    }
    return g;
  }

  /* the five seconds where the camera is yours */
  FV.holeMode = function (ent, secs, done) {
    if (!ent || FV.holes) { if (done) done(); return; }
    var cross = document.createElement('div');
    cross.id = 'jjHole';
    cross.innerHTML =
      '<style>#jjHole{position:fixed;inset:0;z-index:70;pointer-events:none;' +
      'font-family:"Finger Paint",system-ui,sans-serif}' +
      '#jjHole .x{position:absolute;width:34px;height:34px;margin:-17px 0 0 -17px;' +
      'border:3px solid #ffd964;border-radius:50%;box-shadow:0 0 16px #ffd964}' +
      '#jjHole .x:after{content:"";position:absolute;inset:13px;background:#ffd964;border-radius:50%}' +
      '#jjHole .t{position:absolute;top:9%;left:50%;transform:translateX(-50%);' +
      'font-size:clamp(18px,3vw,40px);font-weight:900;color:#fff;' +
      '-webkit-text-stroke:6px #05070c;paint-order:stroke fill}' +
      '#jjHole .n{position:absolute;top:17%;left:50%;transform:translateX(-50%);' +
      'font-size:clamp(11px,1.5vw,19px);font-weight:700;color:#ffd964}</style>' +
      '<div class="x"></div><div class="t">5.0</div>' +
      '<div class="n">PICK YOUR SPOTS</div>';
    document.body.appendChild(cross);
    var dot = cross.querySelector('.x');
    var clock = cross.querySelector('.t');
    var x = window.innerWidth / 2, y = window.innerHeight / 2;
    dot.style.left = x + 'px'; dot.style.top = y + 'px';

    var ray = new THREE.Raycaster();
    var left = secs, holes = 0, livePtr = true;
    function move(ev) {
      x = Math.max(0, Math.min(window.innerWidth, x + (ev.movementX || 0)));
      y = Math.max(0, Math.min(window.innerHeight, y + (ev.movementY || 0)));
      dot.style.left = x + 'px'; dot.style.top = y + 'px';
    }
    function click(ev) {
      if (!livePtr) return;
      /* the click is for the hole, not for a punch */
      if (ev && ev.stopImmediatePropagation) ev.stopImmediatePropagation();
      if (!ent || ent.dead) return;
      ray.setFromCamera(new THREE.Vector2(
        (x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1), camera);
      var hits = ray.intersectObject(ent.rig.root, true);
      if (!hits.length) return;
      holes++;
      punchHole(ent, hits[0].point.clone(), ray.ray.direction.clone());
      FX.mangaLines(.5, .2);
    }
    window.addEventListener('mousemove', move, true);
    window.addEventListener('mousedown', click, true);

    /* Stand him a clean seven units off them and turn them round to face
       him: at fov 70 that puts the whole body in the frame with the head
       and the feet both clear of the HUD. */
    var away = player.pos.clone().sub(ent.pos).setY(0);
    if (away.lengthSq() < .04) away.set(0, 0, 1);
    away.normalize();
    var stand = ent.pos.clone().addScaledVector(away, 7);
    player.pos.copy(stand);
    player.vel.set(0, 0, 0);
    player.facing = Math.atan2(-away.x, -away.z);
    ent.facing = Math.atan2(away.x, away.z);

    var hands = firstPersonHands();
    camera.add(hands);
    if (!camera.parent) scene.add(camera);
    /* his own head is where the lens is, so it comes off */
    if (player.rig && player.rig.root) player.rig.root.visible = false;
    FV.holes = { ent: ent, stand: stand, away: away, hands: hands };

    addFx({ t: 1e9, update: function (dt) {
      left -= dt;
      clock.textContent = Math.max(0, left).toFixed(1);
      /* hold them still and in front of the lens */
      if (ent && !ent.dead) {
        ent.stunT = Math.max(ent.stunT || 0, .5);
        ent.lockT = Math.max(ent.lockT || 0, .4);
        ent.vel.set(0, 0, 0);
        ent.facing = Math.atan2(away.x, away.z);
      }
      /* and hold him where the shot was set up */
      player.pos.lerp(stand, Math.min(1, dt * 10));
      player.vel.set(0, 0, 0);
      player.iframes = Math.max(player.iframes, .4);
      if (left > 0) return true;
      livePtr = false;
      window.removeEventListener('mousemove', move, true);
      window.removeEventListener('mousedown', click, true);
      if (cross.parentNode) cross.parentNode.removeChild(cross);
      if (hands.parent) hands.parent.remove(hands);
      if (player.rig && player.rig.root) player.rig.root.visible = true;
      FV.holes = null;
      if (window.JJNOTICE) {
        window.JJNOTICE(holes ? holes + ' HOLE' + (holes === 1 ? '' : 'S') : 'NOT ONE', '#ffd964');
      }
      if (done) done(holes);
      return false;
    } });
  };

  /* ===================================================================
     3 · THE RUN THAT DRAGS
     ================================================================ */
  function castRun() {
    if (!ready('ha3')) return;
    /* two seconds of dancing and then two and a half of running: at 30
       a second that is about seventy five units, most of the way across
       but not far enough to dead-end in the arena wall */
    var a = start('ha3', 4.6, 'ha3', 'FEVER RUSH', 'COME ALONG');
    a.dance = 2;
    FV.drag.length = 0;
    player.iframes = Math.max(player.iframes, 1.4);
  }

  function stepRun(a, dt) {
    var p = player;
    /* --- the dance --- */
    if (a.t < a.dance) {
      p.vel.x *= .8; p.vel.z *= .8;
      if (Math.random() < .5) {
        FX.streaks(p.pos.clone().add(new THREE.Vector3(
          (Math.random() - .5) * 2, .5 + Math.random() * 4, (Math.random() - .5) * 2)),
          RAIN[(Math.random() * RAIN.length) | 0], 2, 12, 1);
      }
      addShake(.18);
      return;
    }
    /* --- and then he goes, wherever he is pointed --- */
    var d = new THREE.Vector3(Math.sin(player.facing), 0, Math.cos(player.facing));
    p.pos.addScaledVector(d, 30 * dt);
    p.vel.y -= 30 * dt;
    p.pos.y = Math.max(0, p.pos.y + p.vel.y * dt);
    if (p.pos.y <= 0) { p.pos.y = 0; p.vel.y = 0; }
    collideWorld(p.pos, 1);
    /* the aura coming off both hands */
    ['handL', 'handR'].forEach(function (h, i) {
      var b = p.rig[h] || p.rig[i ? 'elbowR' : 'elbowL'];
      if (!b) return;
      var wp = new THREE.Vector3();
      b.getWorldPosition(wp);
      if (Math.random() < .8) {
        FX.streaks(wp, RAIN[(Math.random() * RAIN.length) | 0], 1, 9, .55);
        FX.mote(wp, GOLD, 1.4, .22);
      }
    });
    if (Math.random() < dt * 26) {
      FX.dust(new THREE.Vector3(p.pos.x, 0, p.pos.z), 2, 0xcfc3a8, 7, 2.4);
    }
    /* whoever he touches comes with him, two at the most */
    enemies.forEach(function (e) {
      if (!e || e.dead) return;
      if (FV.drag.indexOf(e) >= 0) return;
      if (FV.drag.length >= 2) return;
      if (e.pos.distanceTo(p.pos) > 5.2) return;
      FV.drag.push(e);
      FX.heavyHit(e.pos.clone().add(new THREE.Vector3(0, 2.6, 0)), GOLD, 1.4);
      addShake(.9);
      hitstop(.06);
      e.damage(9 * boost(), null, {
        react: 'stagger', reactDur: .5, spark: GOLD, noFrameBonus: true
      });
    });
    /* and they are held against him while it lasts */
    var side = new THREE.Vector3(-d.z, 0, d.x);
    FV.drag.forEach(function (e, i) {
      if (!e || e.dead) return;
      var want = p.pos.clone().addScaledVector(d, 2.2).addScaledVector(side, (i ? 1.5 : -1.5));
      e.pos.lerp(want, Math.min(1, dt * 12));
      e.pos.y = .6;
      e.vel.set(0, 0, 0);
      e.stunT = Math.max(e.stunT || 0, .4);
      e.lockT = Math.max(e.lockT || 0, .3);
      if (Math.random() < dt * 20) {
        FX.streaks(e.pos.clone().add(new THREE.Vector3(0, 2, 0)), HOT, 1, 8, .5);
      }
      /* the road takes its cut the whole way */
      a.scrape = (a.scrape || 0) + dt;
      if (a.scrape > .22) {
        a.scrape = 0;
        FX.dust(e.pos.clone(), 3, 0xcfc3a8, 6, 2);
        e.damage(5 * boost(), null, { spark: GOLD, react: null, noFrameBonus: true });
      }
    });

    /* --- and he lets go, hard. Both of them are still on him here, so
       the finisher gets to see the pair. --- */
    if (a.t > a.dur - .3 && !a.threw) {
      a.threw = true;
      var pack = FV.drag.slice();
      FX.speedRing(p.pos.clone().add(new THREE.Vector3(0, 2, 0)), HOT, 10, .3);
      FX.mangaLines(.6, .22);
      addShake(1.6);
      hitstop(.09);
      pack.forEach(function (e) {
        if (!e || e.dead) return;
        FX.heavyHit(e.pos.clone().add(new THREE.Vector3(0, 2.6, 0)), GOLD, 2);
        e.damage(30 * boost(), d.clone().multiplyScalar(30), {
          react: 'launch', reactDur: .7, spark: GOLD, noFrameBonus: true
        });
      });
    }
  }

  /* ===================================================================
     4 · UP, DOWN, AND UP AGAIN
     ================================================================ */
  function castStomp() {
    if (!ready('ha4')) return;
    var a = start('ha4', 2.3, 'ha4', 'GACHINKO', 'BOTH WAYS');
    player.vel.y = 30;
    player.iframes = Math.max(player.iframes, 2);
  }

  function crush(at, power, up) {
    FX.rings(new THREE.Vector3(at.x, .12, at.z), GOLD, 5,
      { maxR: 30 * power, life: .9, gap: 42 });
    FX.cracks(new THREE.Vector3(at.x, 0, at.z), 18, 28 * power, 0x2a2418);
    FX.debris(new THREE.Vector3(at.x, 0, at.z), 26, 26 * power, 0x6a6e78);
    FX.dust(new THREE.Vector3(at.x, 0, at.z), 14, 0xcfc3a8, 20 * power, 5);
    FX.shockwave(new THREE.Vector3(at.x, .2, at.z), GOLD, power);
    addShake(3 * power);
    hitstop(.14);
    try { sfx.redBoom(); } catch (e) {}
    enemies.forEach(function (e) {
      if (!e || e.dead || e.pos.distanceTo(at) > 22 * power) return;
      var kb = e.pos.clone().sub(at).setY(0);
      if (kb.lengthSq() < .01) kb.set(1, 0, 0);
      kb.normalize().multiplyScalar(26 * power);
      kb.y = up;
      e.damage(30 * boost(), kb, {
        react: 'blow', reactDur: 1, spark: GOLD, ragdoll: true, death: 'ragdoll', stun: 1.1
      });
    });
  }

  function stepStomp(a, dt) {
    var p = player;
    if (a.stage < 1 && a.t > .05 && p.vel.y <= 0) {
      /* the top of the jump: he turns over and comes down */
      a.stage = 1;
      p.vel.y = -60;
      FX.speedRing(p.pos.clone().add(new THREE.Vector3(0, 2, 0)), HOT, 12, .3);
    }
    if (a.stage === 1 && p.pos.y <= .2) {
      a.stage = 2;
      a.landed = a.t;
      crush(p.pos.clone(), 1, 20);
      p.vel.y = 0;
    }
    /* and then he goes back up through it, and it happens again */
    if (a.stage === 2 && a.t > (a.landed || 0) + .38) {
      a.stage = 3;
      p.vel.y = 34;
      crush(p.pos.clone(), 1.25, 26);
      FX.rings(p.pos.clone().add(new THREE.Vector3(0, 1, 0)), HOT, 4,
        { maxR: 18, life: .7, ground: false, gap: 40 });
    }
  }

  /* ===================================================================
     POSES
     ================================================================ */
  function poseFever(r, a) {
    var t = a.t, out = E.out;
    switch (a.type) {
      case 'ha1': {
        rp(r);
        if (t < .42) {                                   // it is put down
          var k = out(t / .42);
          r.shoulderL.rotation.x = -1.3 * k; r.shoulderR.rotation.x = -1.3 * k;
          r.shoulderL.rotation.z = .5 * k; r.shoulderR.rotation.z = -.5 * k;
          r.elbowL.rotation.x = -1.1 * k; r.elbowR.rotation.x = -1.1 * k;
          r.spine.rotation.x = .18 * k;
          r.hips.position.y = r.hipsBaseY - .2 * k;
          return true;
        }
        var kk = out(Math.min(1, (t - .42) / .24));      // and kicked
        r.hipR.rotation.x = -2.1 * kk;
        r.kneeR.rotation.x = .3 * kk;
        r.hipL.rotation.x = .45 * kk;
        r.kneeL.rotation.x = .5 * kk;
        r.spine.rotation.x = .18 - .5 * kk;
        r.shoulderL.rotation.x = -1.3 + .5 * kk;
        r.shoulderR.rotation.x = -1.3 + 1.9 * kk;
        r.hips.position.y = r.hipsBaseY - .2 + .5 * kk;
        return true;
      }
      case 'ha1j': {
        rp(r);
        var j = out(Math.min(1, t / .5));
        var pun = t > .5 ? out(Math.min(1, (t - .5) / .22)) : 0;
        r.shoulderL.rotation.x = -2.6 * j + 3.4 * pun;
        r.shoulderR.rotation.x = -2.6 * j + 3.4 * pun;
        r.elbowL.rotation.x = -.5 * j; r.elbowR.rotation.x = -.5 * j;
        r.spine.rotation.x = -.36 * j + .7 * pun;
        r.neck.rotation.x = -.4 * j + .6 * pun;
        r.hipL.rotation.x = -.7 * j; r.kneeL.rotation.x = 1.1 * j;
        r.hipR.rotation.x = -.5 * j; r.kneeR.rotation.x = .9 * j;
        r.hips.position.y = r.hipsBaseY + .3 * j;
        return true;
      }
      case 'ha2': {
        rp(r);
        var s = Math.sin(t * 44), c = Math.cos(t * 44);
        r.spine.rotation.y = s * .3;
        r.spine.rotation.x = -.16;
        r.neck.rotation.x = -.12;
        r.shoulderL.rotation.x = -1.5 - s * 1.1;
        r.shoulderR.rotation.x = -1.5 + s * 1.1;
        r.elbowL.rotation.x = -.35 + c * .3;
        r.elbowR.rotation.x = -.35 - c * .3;
        r.hipL.rotation.x = -.3; r.kneeL.rotation.x = .5;
        r.hipR.rotation.x = .22; r.kneeR.rotation.x = .34;
        r.hips.position.y = r.hipsBaseY - .3 + Math.abs(s) * .1;
        return true;
      }
      case 'ha3': {
        rp(r);
        if (t < a.dance) {
          var d2 = t * 8, sd = Math.sin(d2), cd = Math.cos(d2);
          r.spine.rotation.y = sd * .45;
          r.spine.rotation.x = -.12 + Math.abs(cd) * .12;
          r.neck.rotation.y = -sd * .32;
          r.shoulderL.rotation.x = -1.2 - sd * .95;
          r.shoulderR.rotation.x = -1.2 + sd * .95;
          r.shoulderL.rotation.z = .62 + cd * .34;
          r.shoulderR.rotation.z = -.62 + cd * .34;
          r.elbowL.rotation.x = -1.4 + sd * .5;
          r.elbowR.rotation.x = -1.4 - sd * .5;
          r.hipL.rotation.x = -.22 + sd * .34;
          r.hipR.rotation.x = -.22 - sd * .34;
          r.kneeL.rotation.x = .42 + Math.max(0, sd) * .5;
          r.kneeR.rotation.x = .42 + Math.max(0, -sd) * .5;
          r.hips.position.y = r.hipsBaseY - .18 + Math.abs(sd) * .3;
          r.hips.position.x = sd * .22;
          return true;
        }
        /* the run: low, arms back, shoulders ahead of the feet */
        var g = (t - a.dance) * 22;
        var sg = Math.sin(g);
        r.spine.rotation.x = -.62;
        r.neck.rotation.x = .42;
        r.shoulderL.rotation.x = 1.5; r.shoulderR.rotation.x = 1.5;
        r.shoulderL.rotation.z = .34; r.shoulderR.rotation.z = -.34;
        r.elbowL.rotation.x = -.5; r.elbowR.rotation.x = -.5;
        r.hipL.rotation.x = -1.05 + sg * .6; r.hipR.rotation.x = -1.05 - sg * .6;
        r.kneeL.rotation.x = .8 + Math.max(0, sg) * .8;
        r.kneeR.rotation.x = .8 + Math.max(0, -sg) * .8;
        r.hips.position.y = r.hipsBaseY - .34;
        return true;
      }
      case 'ha4': {
        rp(r);
        if (a.stage < 2) {                                // up, then over
          var u = out(Math.min(1, t / .4));
          r.spine.rotation.x = -.3 * u;
          r.shoulderL.rotation.x = -2.7 * u; r.shoulderR.rotation.x = -2.7 * u;
          r.hipL.rotation.x = -1.3 * u; r.kneeL.rotation.x = 1.7 * u;
          r.hipR.rotation.x = -1.3 * u; r.kneeR.rotation.x = 1.7 * u;
          r.hips.position.y = r.hipsBaseY + .5 * u;
          return true;
        }
        var l = out(Math.min(1, (t - (a.landed || 0)) / .3));  // and landed
        r.spine.rotation.x = .55 * (1 - l) + .2;
        r.shoulderL.rotation.x = 1.2 * (1 - l); r.shoulderR.rotation.x = 1.2 * (1 - l);
        r.elbowL.rotation.x = -.4; r.elbowR.rotation.x = -.4;
        r.hipL.rotation.x = -.6; r.kneeL.rotation.x = 1.15 * (1 - l * .5);
        r.hipR.rotation.x = -.55; r.kneeR.rotation.x = 1.1 * (1 - l * .5);
        r.hips.position.y = r.hipsBaseY - 1 * (1 - l * .6);
        return true;
      }
    }
    return false;
  }

  /* ===================================================================
     THE BAR, AND THE KEYS
     ================================================================ */
  cds.ha1 = 0; cds.ha2 = 0; cds.ha3 = 0; cds.ha4 = 0;
  var BASE = CHARS.hakari.moves.slice();
  var FEVER_MOVES = [
    { key: 'LMB', lbl: 'Punch', cd: 'm1', max: .32 },
    { key: 'Q', lbl: 'Dash', cd: 'dash', max: 1 },
    { key: '1', lbl: 'Container', cd: 'ha1', max: FCD.ha1 },
    { key: '2', lbl: 'Unlimited', cd: 'ha2', max: FCD.ha2 },
    { key: '3', lbl: 'Fever Rush', cd: 'ha3', max: FCD.ha3 },
    { key: '4', lbl: 'Gachinko', cd: 'ha4', max: FCD.ha4 },
    { key: 'R', lbl: 'Door Guard', cd: 'hr', max: 12 }
  ];
  var barOn = false;
  function swapBar(on) {
    if (on === barOn) return;
    barOn = on;
    CHARS.hakari.moves = on ? FEVER_MOVES : BASE;
    if (player.char === 'hakari') { try { buildMovesBar(); } catch (e) {} }
  }

  /* the fever comes and goes on its own clock, so watch it */
  addFx({ t: 1e9, update: function (dt) {
    var on = awake();
    swapBar(on);
    if (on && !FV.aura) FV.bigAura();
    if (!on && FV.aura) { FV.aura.stop(); FV.aura = null; }
    if (!on && FV.drag.length) FV.drag.length = 0;
    return true;
  } });

  var _stepAction = stepAction;
  stepAction = function (a, dt) {
    switch (a.type) {
      case 'ha1': return stepContainer(a, dt);
      case 'ha1j': return stepDrop(a, dt);
      case 'ha2': return stepBarrage(a, dt);
      case 'ha3': return stepRun(a, dt);
      case 'ha4': return stepStomp(a, dt);
    }
    return _stepAction(a, dt);
  };

  var _poseAction = poseAction;
  poseAction = function (r, a) {
    if (a && poseFever(r, a)) return;
    return _poseAction(r, a);
  };

  /* The one place the camera IS taken: his own eyes, for the five
     seconds you are choosing where the holes go.
     NOTE: it is deliberately NOT taken during Fever Rush — the whole
     point of that move is that you steer it yourself. */
  var _updateCamera = updateCamera;
  updateCamera = function (dt) {
    var h = FV.holes;
    if (h && h.ent) {
      var eye = player.pos.clone().add(new THREE.Vector3(0, 3.55, 0));
      camera.position.lerp(eye, Math.min(1, dt * 18));
      var look = h.ent.pos.clone().add(new THREE.Vector3(0, 2.5, 0));
      camera.lookAt(look.x, look.y, look.z);
      return;
    }
    return _updateCamera(dt);
  };

  /* and he does not walk out of his own shot — the movement keys are
     read straight off the table every frame, so for those frames they
     are simply not down */
  var MOVE = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'];
  var _updatePlayer = updatePlayer;
  updatePlayer = function (dt) {
    var held = !!FV.holes;
    var saved = null;
    if (held) {
      saved = {};
      MOVE.forEach(function (k) { saved[k] = keys[k]; keys[k] = false; });
      player.vel.x = 0; player.vel.z = 0;
    }
    var r = _updatePlayer(dt);
    if (held) MOVE.forEach(function (k) { keys[k] = saved[k]; });
    return r;
  };
  window.addEventListener('keydown', function (e) {
    if (!started || player.char !== 'hakari' || e.repeat || !awake()) return;
    if (player.react || (player.action && (player.action.type === 'kb' ||
        player.action.type === 'void' || player.action.type === 'hdom'))) return;
    var hit = true;
    if (e.code === 'Digit1') castContainer();
    else if (e.code === 'Digit2') castBarrage();
    else if (e.code === 'Digit3') castRun();
    else if (e.code === 'Digit4') castStomp();
    else hit = false;
    if (hit) e.stopImmediatePropagation();
  }, true);

  /* what everybody else sees */
  FV.remote = {
    ha1: function (pos, yaw) {
      var d = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
      setTimeout(function () {
        if (typeof scene === 'undefined') return;
        rollContainer(pos.clone().addScaledVector(d, 5.5), d, true);
      }, 420);
    },
    ha4: function (pos) {
      setTimeout(function () {
        if (typeof scene === 'undefined') return;
        FX.rings(new THREE.Vector3(pos.x, .12, pos.z), GOLD, 5, { maxR: 30, life: .9, gap: 42 });
        FX.debris(pos.clone(), 22, 24, 0x6a6e78);
        FX.dust(pos.clone(), 12, 0xcfc3a8, 18, 5);
      }, 700);
    }
  };
})();
