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
  /* A forty-foot box, at the scale one actually is next to a person: it
     is longer than the road is wide and it stands taller than he does.
     BOX.len is the length it rolls along, so everything downstream —
     travel, dents, the hit radius — is read off these. */
  var BOX = { len: 15.5, tall: 6.2, wide: 5.6 };

  function buildContainer() {
    var g = new THREE.Group();
    var col = [0xd83a3a, 0x2fae62, 0x3a7ad8, 0xe8b93a][(Math.random() * 4) | 0];
    var body = new THREE.Mesh(new THREE.BoxGeometry(BOX.len, BOX.tall, BOX.wide),
      new THREE.MeshStandardMaterial({ color: col, roughness: .82, metalness: .25 }));
    body.castShadow = true;
    g.add(body);
    g.__body = body;
    /* corrugation: fourteen ribs down the length, which is what makes a
       container read as a container instead of a crate */
    for (var i = -7; i <= 7; i++) {
      var rib = new THREE.Mesh(new THREE.BoxGeometry(.3, BOX.tall + .1, BOX.wide + .1),
        new THREE.MeshStandardMaterial({ color: 0x2a2c34, roughness: .9 }));
      rib.position.x = i * (BOX.len / 15.4);
      g.add(rib);
    }
    /* the frame down every long edge */
    for (var sy = -1; sy <= 1; sy += 2) {
      for (var sz = -1; sz <= 1; sz += 2) {
        var rail = new THREE.Mesh(new THREE.BoxGeometry(BOX.len + .2, .42, .42),
          new THREE.MeshStandardMaterial({ color: 0x35383f, roughness: .88, metalness: .35 }));
        rail.position.set(0, sy * BOX.tall / 2, sz * BOX.wide / 2);
        g.add(rail);
      }
    }
    /* and the two doors on the end, with their locking bars */
    var door = new THREE.Mesh(new THREE.BoxGeometry(.2, BOX.tall - .5, BOX.wide - .4),
      new THREE.MeshStandardMaterial({ color: 0x1e2028, roughness: .85 }));
    door.position.x = BOX.len / 2 + .06;
    g.add(door);
    for (var b = -1; b <= 1; b += 2) {
      var bar = new THREE.Mesh(new THREE.CylinderGeometry(.11, .11, BOX.tall - .7, 6),
        new THREE.MeshStandardMaterial({ color: 0x4a4d55, roughness: .7, metalness: .5 }));
      bar.position.set(BOX.len / 2 + .2, 0, b * 1.1);
      g.add(bar);
    }
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
    FX.debris(box.position.clone(), 8, 14, 0x6a6e78);
    FX.impact(box.position.clone(), GOLD, 1.6 + n * .12);
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
    var b = start('ha1', 1.55, 'ha1', 'CONTAINER', 'DOWN THE ROAD');
    b.dir = aim();
    player.iframes = Math.max(player.iframes, .4);
  }

  /* It goes end over end, not along its own length: a forty-foot box
     kicked down a road cartwheels, and each time a corner comes down the
     street shakes. A yaw pivot carries the travel direction so the tumble
     can stay on one local axis. */
  function rollContainer(from, dir, ghost) {
    var pivot = new THREE.Group();
    pivot.rotation.y = Math.atan2(dir.x, dir.z) - Math.PI / 2;
    var box = buildContainer();
    pivot.add(box);
    pivot.position.copy(from);
    pivot.position.y = BOX.tall / 2;
    scene.add(pivot);
    pivot.__body = box.__body;

    var hit = [], travelled = 0, spin = 0, corner = 0;
    var reach = BOX.len / 2 + 2.6;
    addFx({ t: 5, update: function (dt) {
      this.t -= dt;
      var step = 24 * dt;
      travelled += step;
      pivot.position.addScaledVector(dir, step);
      /* one turn every three quarters of a second, and it rides up on the
         corner it is turning over */
      var was = spin;
      spin += dt * 8.4;
      box.rotation.z = -spin;
      var ride = Math.abs(Math.sin(spin)) * (BOX.len - BOX.tall) * .28;
      pivot.position.y = BOX.tall / 2 + ride;
      /* every quarter turn a corner lands */
      if (Math.floor(spin / (Math.PI / 2)) !== Math.floor(was / (Math.PI / 2))) {
        corner++;
        var down = new THREE.Vector3(pivot.position.x, 0, pivot.position.z);
        FX.dust(down.clone(), 7, 0xcfc3a8, 16, 4);
        FX.cracks(down.clone(), 9, 13, 0x2a2418);
        FX.debris(down.clone(), 8, 14, 0x6a6e78);
        addShake(1.1);
        try { sfx.step(); } catch (e) {}
      }
      if (Math.random() < dt * 30) {
        FX.dust(new THREE.Vector3(pivot.position.x, 0, pivot.position.z), 2, 0xcfc3a8, 9, 3);
      }
      if (!ghost) {
        /* the whole length of it is dangerous, so measure to the box's own
           axis rather than to a point in the middle of it */
        var half = new THREE.Vector3(1, 0, 0).applyAxisAngle(
          new THREE.Vector3(0, 1, 0), pivot.rotation.y).multiplyScalar(BOX.len / 2);
        for (var i = 0; i < enemies.length; i++) {
          var e = enemies[i];
          if (!e || e.dead || hit.indexOf(e) >= 0) continue;
          var to = e.pos.clone().add(new THREE.Vector3(0, 2.2, 0)).sub(pivot.position);
          var along = Math.max(-1, Math.min(1, to.dot(half) / (half.lengthSq() || 1)));
          if (to.clone().sub(half.clone().multiplyScalar(along)).length() > 4.6) continue;
          hit.push(e);
          FV.lastBox = pivot;
          FV.lastHit = e;
          var kb = dir.clone().multiplyScalar(38); kb.y = 15;
          e.damage(34 * boost(), kb, {
            react: 'blow', reactDur: .9, spark: GOLD, ragdoll: true, death: 'ragdoll'
          });
          FX.heavyHit(e.pos.clone().add(new THREE.Vector3(0, 2.6, 0)), GOLD, 2);
          addShake(1.6);
          hitstop(.09);
        }
      }
      if (travelled < 58 && this.t > 0) return true;
      FX.impact(pivot.position.clone(), GOLD, 3);
      FX.debris(pivot.position.clone(), 20, 22, 0x6a6e78);
      FX.dust(new THREE.Vector3(pivot.position.x, 0, pivot.position.z), 10, 0xcfc3a8, 18, 5);
      scene.remove(pivot);
      pivot.traverse(function (o) { if (o.isMesh) o.material.dispose(); });
      return false;
    } });
    return pivot;
  }

  /* Three beats rather than one: it comes out of nothing, it sits there
     long enough for you to see how big it is, and then he kicks it. */
  var C1 = { call: .34, hold: .26, wind: .22 };

  function stepContainer(a, dt) {
    var p = player;
    var spot = p.pos.clone().addScaledVector(a.dir, BOX.len / 2 + 3);
    spot.y = BOX.tall / 2;

    /* --- it is called up --- */
    if (a.t < C1.call) {
      if (!a.box) {
        var piv = new THREE.Group();
        piv.rotation.y = Math.atan2(a.dir.x, a.dir.z) - Math.PI / 2;
        piv.add(buildContainer());
        piv.position.copy(spot);
        piv.scale.setScalar(.05);
        scene.add(piv);
        a.box = piv;
        FX.rings(spot.clone(), GOLD, 4, { maxR: 16, life: .55, ground: false, gap: 40 });
        FX.speedRing(spot.clone(), HOT, 14, .35);
        for (var s = 0; s < 10; s++) {
          FX.streaks(spot.clone().add(new THREE.Vector3(
            (Math.random() - .5) * BOX.len, (Math.random() - .5) * BOX.tall,
            (Math.random() - .5) * BOX.wide)),
            RAIN[(Math.random() * RAIN.length) | 0], 2, 16, 1.1);
        }
        addShake(.8);
        try { sfx.frame(); } catch (e) {}
      }
      var k = E.out(a.t / C1.call);
      a.box.position.copy(spot);
      a.box.scale.set(.05 + k * .95, .05 + k * .95, .05 + k * .95);
      return;
    }
    /* --- and it just sits there for a beat --- */
    if (a.t < C1.call + C1.hold) {
      if (a.stage < 1) {
        a.stage = 1;
        FX.dust(new THREE.Vector3(spot.x, 0, spot.z), 8, 0xcfc3a8, 16, 4);
        FX.cracks(new THREE.Vector3(spot.x, 0, spot.z), 10, 14, 0x2a2418);
        addShake(1.4);
        try { sfx.redBoom(); } catch (e) {}
      }
      a.box.position.copy(spot);
      a.box.scale.setScalar(1);
      return;
    }
    /* --- he winds the leg back --- */
    if (a.t < C1.call + C1.hold + C1.wind) {
      a.box.position.copy(spot);
      return;
    }
    if (a.stage < 2) {
      a.stage = 2;
      if (a.box) {
        scene.remove(a.box);
        a.box.traverse(function (o) { if (o.isMesh) o.material.dispose(); });
        a.box = null;
      }
      FX.speedRing(p.pos.clone().addScaledVector(a.dir, 4).add(new THREE.Vector3(0, 2, 0)), HOT, 14, .32);
      FX.mangaLines(.5, .2);
      addShake(2.2);
      hitstop(.1);
      try { sfx.punch(); } catch (e) {}
      rollContainer(spot.clone(), a.dir.clone());
    }
  }

  /* the air version: summoned overhead, turned side on, and driven down */
  function stepDrop(a, dt) {
    var p = player;
    if (a.t < .55) {
      if (!a.box) {
        var piv = new THREE.Group();
        piv.add(buildContainer());
        scene.add(piv);
        a.box = piv;
        FX.rings(p.pos.clone().add(new THREE.Vector3(0, 11, 0)), GOLD, 4,
          { maxR: 18, life: .55, ground: false, gap: 40 });
        addShake(.9);
        try { sfx.frame(); } catch (e) {}
      }
      var k = E.out(a.t / .55);
      a.box.position.copy(p.pos).add(new THREE.Vector3(0, 12 + a.t * 2, 0));
      a.box.scale.setScalar(.05 + k * .95);
      /* it turns broadside on the way in, so what comes down is the long
         face and not a corner */
      a.box.rotation.y = a.t * 3.4;
      a.box.rotation.z = (1 - k) * .9;
      return;
    }
    if (a.stage < 1) {
      a.stage = 1;
      FX.speedRing(p.pos.clone().add(new THREE.Vector3(0, 7, 0)), HOT, 15, .3);
      FX.mangaLines(.5, .2);
      addShake(1.8);
      hitstop(.1);
      try { sfx.punch(); } catch (e) {}
      var box = a.box;
      a.box = null;
      var landed = false;
      addFx({ t: 3, update: function (dd) {
        this.t -= dd;
        box.position.y -= 58 * dd;
        box.rotation.z += dd * 3.4;
        if (Math.random() < dd * 26) {
          FX.streaks(box.position.clone().add(new THREE.Vector3(
            (Math.random() - .5) * BOX.len, 0, (Math.random() - .5) * BOX.wide)),
            GOLD, 2, 15, .9);
        }
        if (!landed && box.position.y <= BOX.tall / 2) {
          landed = true;
          var at = new THREE.Vector3(box.position.x, 0, box.position.z);
          FX.impact(box.position.clone(), GOLD, 4.2);
          FX.rings(at.clone(), GOLD, 5, { maxR: 30, life: .9, gap: 45 });
          FX.cracks(at.clone(), 20, 30, 0x2a2418);
          FX.debris(at.clone(), 28, 28, 0x6a6e78);
          FX.dust(at.clone(), 16, 0xcfc3a8, 22, 6);
          addShake(3.4);
          hitstop(.14);
          try { sfx.redBoom(); } catch (e) {}
          /* it is fifteen metres long, so what it lands on is a strip */
          enemies.forEach(function (e) {
            if (!e || e.dead || e.pos.distanceTo(at) > BOX.len / 2 + 3) return;
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

  /* A punch, as a thing you can see: a fist with knuckles on it and a
     forearm behind it, not a cube. One is thrown per beat and five more
     are strung out behind it along the same line, each further back,
     smaller and fainter — which is what an afterimage is. */
  var FIST_G = null, KNUCK_G = null, ARM_G = null;
  function fistModel(color, opacity) {
    if (!FIST_G) {
      FIST_G = new THREE.BoxGeometry(.74, .68, .62);
      KNUCK_G = new THREE.BoxGeometry(.16, .16, .16);
      ARM_G = new THREE.CylinderGeometry(.26, .3, 1.5, 7);
    }
    var mat = new THREE.MeshBasicMaterial({
      color: color, transparent: true, opacity: opacity,
      toneMapped: false, depthWrite: false
    });
    var g = new THREE.Group();
    var fist = new THREE.Mesh(FIST_G, mat);
    g.add(fist);
    for (var i = 0; i < 4; i++) {                  // the knuckles
      var k = new THREE.Mesh(KNUCK_G, mat);
      k.position.set(-.27 + i * .18, .28, .3);
      g.add(k);
    }
    var arm = new THREE.Mesh(ARM_G, mat);          // the forearm behind it
    arm.rotation.x = Math.PI / 2;
    arm.position.z = -1.05;
    g.add(arm);
    g.__mat = mat;
    return g;
  }

  function ghostFist(at, dir, n) {
    var GHOSTS = 6;
    for (var i = 0; i < GHOSTS; i++) {
      (function (i) {
        var lead = i === 0;
        var fade = 1 - i / GHOSTS;
        var g = fistModel(n % 3 ? GOLD : (i % 2 ? HOT : PINK),
                          (lead ? .95 : .5) * fade);
        g.position.copy(at).addScaledVector(dir, -i * .62);
        g.position.y += (Math.random() - .5) * .12 * i;
        g.lookAt(g.position.clone().add(dir));
        g.scale.setScalar(1 - i * .085);
        scene.add(g);
        var t = 0, life = .3 + i * .045;
        var v = dir.clone().multiplyScalar((17 + Math.random() * 9) * (1 - i * .06));
        addFx({ t: life, update: function (dt) {
          this.t -= dt; t += dt;
          g.position.addScaledVector(v, dt);
          v.multiplyScalar(.9);
          g.__mat.opacity = (lead ? .95 : .5) * fade * (this.t / life);
          g.scale.setScalar((1 - i * .085) * (1 + t * 1.3));
          if (this.t <= 0) {
            scene.remove(g); g.__mat.dispose(); return false;
          }
          return true;
        } });
      })(i);
    }
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
    /* and the body itself smeared behind them, every beat */
    if (!p.dead) ghostAfterimage(p.rig, a.n % 3 ? GOLD : PINK, .34);
    FX.impact(at, GOLD, .8);
    FX.streaks(at, RAIN[a.n % RAIN.length], 2, 12, .5);
    addShake(.24);
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
     Not a hole-shaped object hung on the body — the material is taken
     out of the body. Every mesh in these rigs is a box, so each one that
     the punch passes through is rebuilt as a grid of cells with the
     cells along the punch line missing, and only the faces that border
     something missing are emitted. What you get is a shaft you can see
     daylight through, with real walls, that deforms and travels with the
     limb because it IS the limb.
     ================================================================ */
  var CELL = .11;                       // how fine the body is diced
  var MINN = 3, MAXN = 18;              // cells per axis, floor and ceiling

  function boxOf(mesh) {
    var g = mesh.geometry;
    if (!g) return null;
    if (g.parameters && g.parameters.width != null) {
      return { w: g.parameters.width, h: g.parameters.height, d: g.parameters.depth,
               cx: 0, cy: 0, cz: 0 };
    }
    if (!g.boundingBox) g.computeBoundingBox();
    var bb = g.boundingBox;
    if (!bb) return null;
    return { w: bb.max.x - bb.min.x, h: bb.max.y - bb.min.y, d: bb.max.z - bb.min.z,
             cx: (bb.max.x + bb.min.x) / 2, cy: (bb.max.y + bb.min.y) / 2,
             cz: (bb.max.z + bb.min.z) / 2 };
  }

  function gridOf(mesh) {
    if (mesh.__grid) return mesh.__grid;
    var b = boxOf(mesh);
    if (!b) return null;
    function n(size) { return Math.max(MINN, Math.min(MAXN, Math.round(size / CELL))); }
    var G = {
      nx: n(b.w), ny: n(b.h), nz: n(b.d),
      x0: b.cx - b.w / 2, y0: b.cy - b.h / 2, z0: b.cz - b.d / 2
    };
    G.cw = b.w / G.nx; G.ch = b.h / G.ny; G.cd = b.d / G.nz;
    G.on = new Uint8Array(G.nx * G.ny * G.nz);
    for (var i = 0; i < G.on.length; i++) G.on[i] = 1;
    mesh.__grid = G;
    return G;
  }

  /* only the faces that face outward or face a missing cell */
  function meshFromGrid(G) {
    var pos = [], nor = [];
    var at = function (i, j, k) {
      if (i < 0 || j < 0 || k < 0 || i >= G.nx || j >= G.ny || k >= G.nz) return 0;
      return G.on[(i * G.ny + j) * G.nz + k];
    };
    function quad(a, b, c, dd, nx, ny, nz) {
      pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
      pos.push(a[0], a[1], a[2], c[0], c[1], c[2], dd[0], dd[1], dd[2]);
      for (var q = 0; q < 6; q++) nor.push(nx, ny, nz);
    }
    for (var i = 0; i < G.nx; i++) {
      for (var j = 0; j < G.ny; j++) {
        for (var k = 0; k < G.nz; k++) {
          if (!at(i, j, k)) continue;
          var xa = G.x0 + i * G.cw, xb = xa + G.cw;
          var ya = G.y0 + j * G.ch, yb = ya + G.ch;
          var za = G.z0 + k * G.cd, zb = za + G.cd;
          if (!at(i + 1, j, k)) quad([xb, ya, za], [xb, ya, zb], [xb, yb, zb], [xb, yb, za], 1, 0, 0);
          if (!at(i - 1, j, k)) quad([xa, ya, zb], [xa, ya, za], [xa, yb, za], [xa, yb, zb], -1, 0, 0);
          if (!at(i, j + 1, k)) quad([xa, yb, za], [xb, yb, za], [xb, yb, zb], [xa, yb, zb], 0, 1, 0);
          if (!at(i, j - 1, k)) quad([xa, ya, zb], [xb, ya, zb], [xb, ya, za], [xa, ya, za], 0, -1, 0);
          if (!at(i, j, k + 1)) quad([xa, ya, zb], [xa, yb, zb], [xb, yb, zb], [xb, ya, zb], 0, 0, 1);
          if (!at(i, j, k - 1)) quad([xb, ya, za], [xb, yb, za], [xa, yb, za], [xa, ya, za], 0, 0, -1);
        }
      }
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.computeBoundingSphere();
    return g;
  }

  /* the wet lining of the shaft, so it does not read as a clean drill */
  function lineHole(host, point, dir, radius) {
    var tube = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * .82, radius * .82, 2.6, 9, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x2a0209, side: THREE.BackSide, toneMapped: false }));
    tube.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    host.worldToLocal(tube.position.copy(point));
    tube.__isCarve = true;               // it is dressing, not body
    tube.__lining = true;
    host.add(tube);
    return tube;
  }

  /* Take the material out along the line. Returns how many meshes it
     actually went through — zero means the click missed the body. */
  function punchHole(ent, point, dir, radius) {
    if (!ent || !ent.rig || !ent.rig.root) return 0;
    radius = radius || .3;
    var n = dir.clone().normalize();
    var a = new THREE.Vector3(), b = new THREE.Vector3();
    var through = [], cut = 0;
    ent.rig.root.traverse(function (o) {
      if (!o.isMesh || !o.geometry) return;
      /* never carve the carved copy, or the lining of an earlier hole —
         the grid always belongs to the original box */
      if (o.__isCarve) return;
      /* a mesh already carved is hidden, and it is still the one to cut */
      if (!o.visible && !o.__carved) return;
      through.push(o);
    });
    through.forEach(function (mesh) {
      var G = gridOf(mesh);
      if (!G) return;
      /* the punch line, in this mesh's own space */
      mesh.updateWorldMatrix(true, false);
      a.copy(point).addScaledVector(n, -6);
      b.copy(point).addScaledVector(n, 6);
      mesh.worldToLocal(a);
      mesh.worldToLocal(b);
      var ab = b.clone().sub(a);
      var len2 = ab.lengthSq() || 1;
      /* the mesh may be scaled, so the radius has to come along */
      var sc = new THREE.Vector3();
      mesh.getWorldScale(sc);
      var rl = radius / Math.max(1e-4, (Math.abs(sc.x) + Math.abs(sc.y) + Math.abs(sc.z)) / 3);
      var r2 = rl * rl;
      var took = 0, c = new THREE.Vector3();
      for (var i = 0; i < G.nx; i++) {
        for (var j = 0; j < G.ny; j++) {
          for (var k = 0; k < G.nz; k++) {
            var idx = (i * G.ny + j) * G.nz + k;
            if (!G.on[idx]) continue;
            c.set(G.x0 + (i + .5) * G.cw, G.y0 + (j + .5) * G.ch, G.z0 + (k + .5) * G.cd);
            var t = c.clone().sub(a).dot(ab) / len2;
            if (t < 0 || t > 1) continue;
            if (c.distanceToSquared(a.clone().addScaledVector(ab, t)) > r2) continue;
            G.on[idx] = 0;
            took++;
          }
        }
      }
      if (!took) return;
      cut++;
      /* swap in the rebuilt body, once, and update it after that */
      var fresh = meshFromGrid(G);
      if (mesh.__carved) {
        mesh.__carved.geometry.dispose();
        mesh.__carved.geometry = fresh;
      } else {
        var m = new THREE.Mesh(fresh, mesh.material);
        m.castShadow = mesh.castShadow;
        m.position.copy(mesh.position);
        m.quaternion.copy(mesh.quaternion);
        m.scale.copy(mesh.scale);
        m.__isCarve = true;
        (mesh.parent || ent.rig.root).add(m);
        mesh.visible = false;
        mesh.__carved = m;
        (ent.__carved || (ent.__carved = [])).push(mesh);
      }
    });
    if (!cut) return 0;

    /* the shaft is lined, and it bleeds from both ends */
    var host = null, bd = 1e9, wp = new THREE.Vector3();
    ent.rig.root.traverse(function (o) {
      if (!o.isMesh || o.__isCarve) return;
      o.getWorldPosition(wp);
      var dd = wp.distanceTo(point);
      if (dd < bd) { bd = dd; host = o.parent; }
    });
    if (host) lineHole(host, point.clone(), n, radius);
    FX.bloodBurst ? FX.bloodBurst(point.clone(), 1.7, n.clone())
                  : FX.impact(point.clone(), 0x8b0f2a, 1.7);
    FX.blood(point.clone(), n.clone(), 10, 1.6);
    FX.blood(point.clone(), n.clone().negate(), 8, 1.3);
    FX.debris(point.clone(), 5, 8, 0x5e0714);
    addShake(.8);
    hitstop(.08);
    try { sfx.punch(); } catch (e) {}
    return cut;
  }
  FV.punchHole = punchHole;

  /* put the body back — a respawned enemy is not still full of holes */
  FV.unpunch = function (ent) {
    if (!ent || !ent.__carved) return;
    ent.__carved.forEach(function (mesh) {
      if (mesh.__carved) {
        if (mesh.__carved.parent) mesh.__carved.parent.remove(mesh.__carved);
        mesh.__carved.geometry.dispose();
        mesh.__carved = null;
      }
      mesh.__grid = null;
      mesh.visible = true;
    });
    ent.__carved = null;
    if (ent.rig && ent.rig.root) {
      var kill = [];
      ent.rig.root.traverse(function (o) { if (o.__lining) kill.push(o); });
      kill.forEach(function (o) {
        if (o.parent) o.parent.remove(o);
        o.geometry.dispose(); o.material.dispose();
      });
    }
  };

  if (GORE && GORE.clear) {
    var _clear = GORE.clear;
    GORE.clear = function (ent) { FV.unpunch(ent); return _clear(ent); };
  }

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
      /* the fist goes in where the ray landed and comes out the far side,
         so the shaft is cut along the whole depth of them */
      var cut = punchHole(ent, hits[0].point.clone(), ray.ray.direction.clone(), .26);
      if (!cut) return;
      holes++;
      FX.mangaLines(.5, .2);
      /* his own arm, thrown out at what he just hit */
      var reach = hits[0].point.clone();
      var fist = FX.billboard(FX.T.glow, GOLD, .7);
      fist.scale.setScalar(2.2);
      fist.position.copy(reach);
      scene.add(fist);
      var ft = 0;
      addFx({ t: .22, update: function (dd) {
        this.t -= dd; ft += dd;
        fist.material.opacity = Math.max(0, .7 * (1 - ft / .22));
        FX.faceCam(fist, 0);
        if (this.t <= 0) { scene.remove(fist); fist.material.dispose(); return false; }
        return true;
      } });
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
     PERFORMING A FINISHER
     A finisher in the table gets a target and some effects and that is
     all — it cannot move the caster and it cannot pose him, which is why
     the earlier ones read as things happening near a man standing still.
     This hands the finisher an action of its own: it is driven every
     frame by whatever callback it was given, so it can jump, punch, and
     land, and the pose comes from the same place.
     ================================================================ */
  FV.perform = function (dur, step, pose) {
    var a = { type: 'hafin', t: 0, dur: dur, stage: 0, step: step, pose: pose };
    player.action = a;
    player.iframes = Math.max(player.iframes, dur + .3);
    return a;
  };

  function stepPerform(a, dt) {
    if (a.step) { try { a.step(a, dt, player); } catch (e) {} }
  }

  /* ===================================================================
     POSES
     ================================================================ */
  function poseFever(r, a) {
    if (a.type === 'hafin') {
      rp(r);
      if (a.pose) { try { a.pose(r, a, E.out); } catch (e) {} }
      return true;
    }
    var t = a.t, out = E.out;
    switch (a.type) {
      /* Four beats, and they line up with what the move is actually
         doing: both hands out to call it, a look at the size of it, the
         leg drawn all the way back, and then the kick, with the follow
         through carrying his shoulders round after it. */
      case 'ha1': {
        rp(r);
        var CALL = C1.call, HOLD = C1.hold, WIND = C1.wind;
        if (t < CALL) {                                  // it is called up
          var k = out(t / CALL);
          r.shoulderL.rotation.x = -1.55 * k; r.shoulderR.rotation.x = -1.55 * k;
          r.shoulderL.rotation.z = .62 * k; r.shoulderR.rotation.z = -.62 * k;
          r.elbowL.rotation.x = -1.15 * k; r.elbowR.rotation.x = -1.15 * k;
          r.spine.rotation.x = .2 * k;
          r.neck.rotation.x = -.22 * k;
          r.hipL.rotation.x = .12 * k; r.hipR.rotation.x = .12 * k;
          r.kneeL.rotation.x = .3 * k; r.kneeR.rotation.x = .3 * k;
          r.hips.position.y = r.hipsBaseY - .26 * k;
          return true;
        }
        if (t < CALL + HOLD) {                           // and he looks at it
          var h = (t - CALL) / HOLD;
          var br = Math.sin(h * Math.PI) * .1;
          r.shoulderL.rotation.x = -1.55 + .35 * h; r.shoulderR.rotation.x = -1.55 + .35 * h;
          r.shoulderL.rotation.z = .62 - .2 * h; r.shoulderR.rotation.z = -.62 + .2 * h;
          r.elbowL.rotation.x = -1.15; r.elbowR.rotation.x = -1.15;
          r.spine.rotation.x = .2 - br;
          r.neck.rotation.x = -.22 - br * 2;
          r.hips.position.y = r.hipsBaseY - .26 + br;
          return true;
        }
        if (t < CALL + HOLD + WIND) {                    // the leg goes back
          var w = out((t - CALL - HOLD) / WIND);
          r.spine.rotation.x = .2 + .34 * w;
          r.spine.rotation.y = .42 * w;
          r.neck.rotation.y = -.32 * w;
          r.shoulderL.rotation.x = -1.2 - .9 * w;
          r.shoulderR.rotation.x = -1.2 + 1.6 * w;
          r.shoulderL.rotation.z = .42; r.shoulderR.rotation.z = -.42;
          r.elbowL.rotation.x = -1.15 + .5 * w; r.elbowR.rotation.x = -1.15 + .8 * w;
          r.hipR.rotation.x = 1.15 * w;                  // drawn right back
          r.kneeR.rotation.x = 1.5 * w;
          r.hipL.rotation.x = -.24 * w; r.kneeL.rotation.x = .55 * w;
          r.hips.position.y = r.hipsBaseY - .26 - .2 * w;
          return true;
        }
        var kk = out(Math.min(1, (t - CALL - HOLD - WIND) / .2));   // and through
        r.hipR.rotation.x = 1.15 - 3.5 * kk;
        r.kneeR.rotation.x = 1.5 - 1.35 * kk;
        r.hipL.rotation.x = -.24 + .8 * kk;
        r.kneeL.rotation.x = .55 + .3 * kk;
        r.spine.rotation.x = .54 - .95 * kk;
        r.spine.rotation.y = .42 - .95 * kk;
        r.neck.rotation.y = -.32 + .5 * kk;
        r.shoulderL.rotation.x = -2.1 + 3.1 * kk;
        r.shoulderR.rotation.x = .4 - 1.9 * kk;
        r.hips.position.y = r.hipsBaseY - .46 + .74 * kk;
        return true;
      }
      case 'ha1j': {
        rp(r);
        var j = out(Math.min(1, t / .55));
        var pun = t > .55 ? out(Math.min(1, (t - .55) / .2)) : 0;
        /* both hands up over the head, then driven straight down */
        r.shoulderL.rotation.x = -2.85 * j + 3.9 * pun;
        r.shoulderR.rotation.x = -2.85 * j + 3.9 * pun;
        r.shoulderL.rotation.z = .3 * j - .3 * pun;
        r.shoulderR.rotation.z = -.3 * j + .3 * pun;
        r.elbowL.rotation.x = -.7 * j + .5 * pun; r.elbowR.rotation.x = -.7 * j + .5 * pun;
        r.spine.rotation.x = -.44 * j + .95 * pun;
        r.neck.rotation.x = -.5 * j + .8 * pun;
        r.hipL.rotation.x = -.95 * j + .6 * pun; r.kneeL.rotation.x = 1.5 * j - .7 * pun;
        r.hipR.rotation.x = -.6 * j + .4 * pun; r.kneeR.rotation.x = 1.1 * j - .5 * pun;
        r.hips.position.y = r.hipsBaseY + .36 * j;
        return true;
      }
      /* The rush. Not a metronome: the fists come in pairs, the hips
         drive each one, and every fourth is a hook that turns him. */
      case 'ha2': {
        rp(r);
        var lead = out(Math.min(1, t / .13));            // he steps in
        var beat = t * 26;
        var s = Math.sin(beat), c = Math.cos(beat);
        var swing = Math.sin(beat * .25);                // the slow hook under it
        r.spine.rotation.y = s * .46 + swing * .2;
        r.spine.rotation.x = -.26 * lead + Math.abs(c) * .06;
        r.neck.rotation.x = -.18;
        r.neck.rotation.y = -s * .26;
        r.shoulderL.rotation.x = -1.62 * lead - s * 1.5;
        r.shoulderR.rotation.x = -1.62 * lead + s * 1.5;
        r.shoulderL.rotation.z = .3 + swing * .3;
        r.shoulderR.rotation.z = -.3 + swing * .3;
        r.elbowL.rotation.x = -.5 + Math.max(0, c) * .9;
        r.elbowR.rotation.x = -.5 + Math.max(0, -c) * .9;
        r.hipL.rotation.x = (-.42 - s * .18) * lead; r.kneeL.rotation.x = .62 * lead;
        r.hipR.rotation.x = (.3 + s * .18) * lead; r.kneeR.rotation.x = .42 * lead;
        r.hips.rotation.y = s * .3;
        r.hips.position.y = r.hipsBaseY - .38 * lead + Math.abs(s) * .12;
        r.hips.position.x = s * .1;
        return true;
      }
      /* Two seconds of dancing that is actually a dance — four figures
         in sequence rather than one loop — and then a sprint that starts
         from a crouch and settles into a stride. */
      case 'ha3': {
        rp(r);
        if (t < a.dance) {
          var ph = t / a.dance;                          // 0 → 1 over the dance
          var d2 = t * 9.4, sd = Math.sin(d2), cd = Math.cos(d2);
          var sw = Math.sin(t * 4.7);                    // the slow weight shift
          /* the figure changes a third of the way in and again at two
             thirds, so it does not read as one repeated bar */
          var fig = ph < .34 ? 0 : (ph < .68 ? 1 : 2);
          r.spine.rotation.y = sd * (fig === 1 ? .62 : .4);
          r.spine.rotation.z = sw * .18;
          r.spine.rotation.x = -.14 + Math.abs(cd) * .14;
          r.neck.rotation.y = -sd * .36;
          r.neck.rotation.z = sw * .2;
          if (fig === 0) {                               // hands high, rolling
            r.shoulderL.rotation.x = -2.2 - sd * .5;
            r.shoulderR.rotation.x = -2.2 + sd * .5;
            r.shoulderL.rotation.z = .5 + cd * .4;
            r.shoulderR.rotation.z = -.5 + cd * .4;
            r.elbowL.rotation.x = -1.7 + sd * .4;
            r.elbowR.rotation.x = -1.7 - sd * .4;
          } else if (fig === 1) {                        // wide, punching out
            r.shoulderL.rotation.x = -1.1 - sd * 1.5;
            r.shoulderR.rotation.x = -1.1 + sd * 1.5;
            r.shoulderL.rotation.z = 1.1 + cd * .3;
            r.shoulderR.rotation.z = -1.1 + cd * .3;
            r.elbowL.rotation.x = -.9 - sd * .7;
            r.elbowR.rotation.x = -.9 + sd * .7;
          } else {                                       // arms crossed, low
            r.shoulderL.rotation.x = -1.5;
            r.shoulderR.rotation.x = -1.5;
            r.shoulderL.rotation.z = .1 + sd * .8;
            r.shoulderR.rotation.z = -.1 + sd * .8;
            r.elbowL.rotation.x = -2.1; r.elbowR.rotation.x = -2.1;
          }
          r.hipL.rotation.x = -.26 + sd * .42;
          r.hipR.rotation.x = -.26 - sd * .42;
          r.hipL.rotation.z = .14 * sw; r.hipR.rotation.z = .14 * sw;
          r.kneeL.rotation.x = .46 + Math.max(0, sd) * .62;
          r.kneeR.rotation.x = .46 + Math.max(0, -sd) * .62;
          r.hips.rotation.y = -sd * .34;
          r.hips.position.y = r.hipsBaseY - .2 + Math.abs(sd) * .34;
          r.hips.position.x = sw * .3;
          return true;
        }
        /* the run: out of the crouch, then low and long */
        var rt = t - a.dance;
        var open = out(Math.min(1, rt / .22));
        var g = rt * 24;
        var sg = Math.sin(g), cg = Math.cos(g);
        r.spine.rotation.x = -.7 * open;
        r.spine.rotation.y = sg * .16;
        r.neck.rotation.x = .5 * open;
        /* arms streaming behind him, and they trail on the beat */
        r.shoulderL.rotation.x = (1.65 + sg * .3) * open;
        r.shoulderR.rotation.x = (1.65 - sg * .3) * open;
        r.shoulderL.rotation.z = .4 * open; r.shoulderR.rotation.z = -.4 * open;
        r.elbowL.rotation.x = (-.62 - cg * .2) * open;
        r.elbowR.rotation.x = (-.62 + cg * .2) * open;
        r.hipL.rotation.x = (-1.15 + sg * .75) * open;
        r.hipR.rotation.x = (-1.15 - sg * .75) * open;
        r.kneeL.rotation.x = (.85 + Math.max(0, sg) * .95) * open;
        r.kneeR.rotation.x = (.85 + Math.max(0, -sg) * .95) * open;
        r.ankleL.rotation.x = -.3 * open; r.ankleR.rotation.x = -.3 * open;
        r.hips.rotation.y = -sg * .2;
        r.hips.position.y = r.hipsBaseY - .4 * open;
        return true;
      }
      /* Up tucked, over the top, down with the legs out in front, and
         then the same again — the second one is a jump off the crater. */
      case 'ha4': {
        rp(r);
        if (a.stage === 0) {                              // tucked, going up
          var u = out(Math.min(1, t / .3));
          r.spine.rotation.x = -.42 * u;
          r.neck.rotation.x = -.4 * u;
          r.shoulderL.rotation.x = -2.9 * u; r.shoulderR.rotation.x = -2.9 * u;
          r.shoulderL.rotation.z = .34 * u; r.shoulderR.rotation.z = -.34 * u;
          r.elbowL.rotation.x = -.9 * u; r.elbowR.rotation.x = -.9 * u;
          r.hipL.rotation.x = -1.7 * u; r.kneeL.rotation.x = 2.1 * u;
          r.hipR.rotation.x = -1.5 * u; r.kneeR.rotation.x = 1.9 * u;
          r.hips.position.y = r.hipsBaseY + .55 * u;
          return true;
        }
        if (a.stage === 1) {                              // turned over, driving
          var f = out(Math.min(1, (t - .3) / .22));
          r.spine.rotation.x = -.42 + 1.05 * f;
          r.neck.rotation.x = -.4 + .95 * f;
          r.shoulderL.rotation.x = -2.9 + 4.3 * f;
          r.shoulderR.rotation.x = -2.9 + 4.3 * f;
          r.shoulderL.rotation.z = .34 - .5 * f; r.shoulderR.rotation.z = -.34 + .5 * f;
          r.elbowL.rotation.x = -.9 + .7 * f; r.elbowR.rotation.x = -.9 + .7 * f;
          /* legs out in front of him, coming down feet first */
          r.hipL.rotation.x = -1.7 + .5 * f; r.kneeL.rotation.x = 2.1 - 1.9 * f;
          r.hipR.rotation.x = -1.5 + .35 * f; r.kneeR.rotation.x = 1.9 - 1.7 * f;
          r.ankleL.rotation.x = .4 * f; r.ankleR.rotation.x = .4 * f;
          r.hips.position.y = r.hipsBaseY + .55 - .4 * f;
          return true;
        }
        if (a.stage === 2) {                              // absorbed, folded up
          var l = out(Math.min(1, (t - (a.landed || 0)) / .22));
          r.spine.rotation.x = .75 - .3 * l;
          r.neck.rotation.x = .5 - .3 * l;
          r.shoulderL.rotation.x = 1.5 - .4 * l; r.shoulderR.rotation.x = 1.5 - .4 * l;
          r.shoulderL.rotation.z = .5; r.shoulderR.rotation.z = -.5;
          r.elbowL.rotation.x = -.5; r.elbowR.rotation.x = -.5;
          r.hipL.rotation.x = -1.15; r.kneeL.rotation.x = 1.75;
          r.hipR.rotation.x = -1.1; r.kneeR.rotation.x = 1.7;
          r.hips.position.y = r.hipsBaseY - 1.15;
          return true;
        }
        /* and off it again, thrown open */
        var b = out(Math.min(1, (t - (a.landed || 0) - .38) / .28));
        r.spine.rotation.x = .45 - .95 * b;
        r.neck.rotation.x = .2 - .7 * b;
        r.shoulderL.rotation.x = 1.1 - 4 * b; r.shoulderR.rotation.x = 1.1 - 4 * b;
        r.shoulderL.rotation.z = .5 - .2 * b; r.shoulderR.rotation.z = -.5 + .2 * b;
        r.elbowL.rotation.x = -.5 + .3 * b; r.elbowR.rotation.x = -.5 + .3 * b;
        r.hipL.rotation.x = -1.15 + .5 * b; r.kneeL.rotation.x = 1.75 - 1.2 * b;
        r.hipR.rotation.x = -1.1 + .4 * b; r.kneeR.rotation.x = 1.7 - 1.1 * b;
        r.ankleL.rotation.x = -.5 * b; r.ankleR.rotation.x = -.5 * b;
        r.hips.position.y = r.hipsBaseY - 1.15 + 1.5 * b;
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
      case 'hafin': return stepPerform(a, dt);
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

  /* the finishers build containers too, and they build the same one */
  FV.BOX = BOX;
  FV.buildContainer = buildContainer;
  FV.dent = dent;

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
