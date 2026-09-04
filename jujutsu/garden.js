/* =======================================================================
   MEGUMI AWAKENED — and the garden at the end of it

   His base kit is five separate shikigami, one at a time. Awakened, the
   idea changes: he stops calling them out one by one and starts putting
   them TOGETHER. So the four are a chain, and each one is the one before
   it taken further — which is what the source means by 渾, Totality.

     1  TOTALITY        玉犬・渾 — the two dogs, merged mid-run into one
     2  CHIMERA         a variant of 1: not two of one, but three of
                        different things — the serpent's jaws, the toad's
                        tongue and Nue's wings, in one body
     3  MAHORAGA        八握剣異戒神将魔虚羅 — a variant of 2 taken to its
                        end. The wheel over its head turns, and whatever
                        hit it last stops working.
     4  CHIMERA SHADOW GARDEN
                        嵌合暗翳庭 — the domain. Everything is shadow, so
                        anything can come out of anywhere.

   Each has a finisher, and none of them is one hit: they run in three
   beats, because a thing that merges should end somebody in stages too.
   ===================================================================== */
(function () {
  'use strict';
  if (typeof player === 'undefined' || typeof THREE === 'undefined') return;
  var FX = window.JJFX;
  if (!FX || typeof CHARS === 'undefined') return;
  var MG = window.JJMEGUMI;
  if (!MG) return;
  var AN = window.JJANIM;
  var E = FX.ease;
  var TAU = Math.PI * 2;

  var INK = MG.INK, DEEP = MG.DEEP, EDGE = MG.EDGE;
  var LIT = MG.LIT, COLD = MG.COLD, WHITE = MG.WHITE;
  /* the two colours the garden is drawn in, and nothing else */
  var ARC = 0x4fd8ff, ARC2 = 0x9fe8ff, GRID = 0xd8365e;

  var GD = window.JJGARDEN = { on: false, t: 0, center: null, yaw: 0, stage: 0 };
  var AWAKE_DUR = 30;
  var GCD = { ga1: 9, ga2: 12, ga3: 18, gdom: 40 };

  function A() { return window.JJAW; }
  function awake() { return !!(A() && A().megumi) && player.char === 'megumi'; }
  function aim() { return new THREE.Vector3(Math.sin(player.facing), 0, Math.cos(player.facing)); }
  function rp(r) { resetPose(r); if (r.body) r.body.rotation.set(0, 0, 0); }
  function later(ms, fn) {
    setTimeout(function () { if (typeof scene !== 'undefined') fn(); }, ms);
  }
  function ready(key) {
    return awake() && !player.dead && !busy() && !player.react && cds[key] <= 0 &&
      !(window.JJNAOYA && window.JJNAOYA.busy());
  }
  function start(type, dur, key, name, sub) {
    cds[key] = GCD[key];
    player.action = { type: type, t: 0, dur: dur, stage: 0 };
    if (name) { try { showSplash(name, sub || '', '#4fd8ff'); } catch (e) {} }
    return player.action;
  }
  cds.ga1 = 0; cds.ga2 = 0; cds.ga3 = 0; cds.gdom = 0;

  /* =====================================================================
     THE ARC
     One piece of branching lightning, from a point, growing outward. It
     is the whole visual identity of the awakened half of him and of the
     garden, so it is built once and used everywhere: a chain of segments
     that forks, each fork thinner and dimmer than its parent, drawn with
     the bolt texture on ADDITIVE blending — this one IS light, unlike
     everything in his base kit, which is why the two halves of him look
     nothing like each other.
     ================================================================== */
  function arcBolt(from, to, w, color, life) {
    var m = FX.billboard(FX.T.bolt, color, 1);
    var len = FX.orientAlong(m, from, to);
    /* Thin. A bolt drawn as tall as it is long is a ribbon, not lightning —
       the first pass of this filled the frame with pale slabs. The height
       is capped in absolute units so a long arc stays a line. */
    m.scale.set(len, Math.min(.9, Math.max(.16, len * w)), 1);
    scene.add(m);
    var t = 0;
    addFx({ t: life, update: function (dt) {
      this.t -= dt; t += dt;
      /* it snaps out rather than fading: lightning is on or it is not */
      m.material.opacity = this.t > life * .5 ? 1 : (this.t / (life * .5));
      if (this.t <= 0) { scene.remove(m); m.material.dispose(); return false; }
      return true;
    } });
    return m;
  }

  /* a whole tree of it, grown outward from one point */
  function arcTree(origin, dir, opt) {
    opt = opt || {};
    var reach = opt.reach || 16;
    var depth = opt.depth == null ? 3 : opt.depth;
    var life = opt.life || .5;
    var spread = opt.spread == null ? .8 : opt.spread;
    var made = 0;

    function grow(from, d, len, w, lvl, delay) {
      if (lvl > depth || len < .8) return;
      /* the segment wanders rather than running straight */
      var to = from.clone().addScaledVector(d, len).add(new THREE.Vector3(
        (Math.random() - .5) * len * .5,
        (Math.random() - .5) * len * .5,
        (Math.random() - .5) * len * .5));
      made++;
      var a = from.clone(), b = to.clone();
      later(delay, function () {
        arcBolt(a, b, w, lvl < 2 ? ARC2 : ARC, life * (1 - lvl * .18));
        if (lvl === 0 && Math.random() < .5) {
          FX.mote(b.clone(), ARC2, 2.4, .22);
        }
      });
      /* and forks, two of them, narrower */
      var forks = lvl >= depth ? 0 : (lvl === 0 ? 3 : 2);
      for (var i = 0; i < forks; i++) {
        var nd = d.clone().add(new THREE.Vector3(
          (Math.random() - .5) * spread * 2,
          (Math.random() - .5) * spread * 2,
          (Math.random() - .5) * spread * 2)).normalize();
        grow(to, nd, len * (.58 + Math.random() * .22), w * .72, lvl + 1,
          delay + 18 + Math.random() * 26);
      }
    }
    grow(origin.clone(), dir.clone().normalize(), reach * .42, .07, 0, 0);
    return made;
  }
  GD.arc = arcTree;

  /* the standing crackle a body carries while the shadow is open on it */
  function crackle(getPos, alive) {
    var acc = 0, live = true;
    addFx({ t: 1e9, update: function (dt) {
      var p = getPos();
      if (!live || !p || (alive && !alive())) return false;
      acc += dt;
      if (acc > .1) {
        acc = 0;
        var a = Math.random() * TAU;
        var from = p.clone().add(new THREE.Vector3(
          Math.cos(a) * 1.1, .6 + Math.random() * 4, Math.sin(a) * 1.1));
        arcTree(from, new THREE.Vector3(
          Math.cos(a), .2 + Math.random() * .8, Math.sin(a)),
          { reach: 7, depth: 2, life: .22, spread: .9 });
      }
      return true;
    } });
    return { stop: function () { live = false; } };
  }
  GD.crackle = crackle;

  /* =====================================================================
     1 · TOTALITY  玉犬・渾
     The two of them come out and merge on the way in. One body, twice
     the size, and it does not stop at the first thing it reaches.
     ================================================================== */
  var TOT = { reach: 46, speed: 30, dmg: 30, radius: 4.2 };

  function buildTotality() {
    var g = new THREE.Group();
    /* the merged one: black down one side, white down the other, which
       is the only way to draw two things that became one */
    var dogL = MG.buildDog(false);
    var dogR = MG.buildDog(true);
    dogL.position.x = -.55; dogR.position.x = .55;
    dogL.scale.x = .55; dogR.scale.x = .55;
    g.add(dogL); g.add(dogR);
    g.__halves = [dogL, dogR];
    g.__legs = dogL.__legs.concat(dogR.__legs);
    g.scale.setScalar(1.7);
    return g;
  }

  function runTotality(from, dir, ghost) {
    var t0 = buildTotality();
    t0.position.copy(from);
    t0.rotation.y = Math.atan2(dir.x, dir.z);
    scene.add(t0);
    MG.pets.push(t0);
    var travelled = 0, t = 0, bound = 0, hit = [];
    var stop = crackle(function () { return t0.position.clone(); },
      function () { return travelled < TOT.reach; });
    addFx({ t: 5, update: function (dt) {
      this.t -= dt; t += dt;
      var step = TOT.speed * dt;
      travelled += step;
      t0.position.addScaledVector(dir, step);
      bound += dt * 13;
      t0.__legs.forEach(function (l, i) {
        l.rotation.x = Math.sin(bound + (i % 4 < 2 ? 0 : Math.PI)) * 1;
      });
      t0.position.y = Math.abs(Math.sin(bound)) * .8;
      /* the two halves breathe against each other, so the merge reads */
      var sq = Math.sin(t * 9) * .06;
      t0.__halves[0].position.x = -.55 - sq;
      t0.__halves[1].position.x = .55 + sq;
      if (!ghost) {
        for (var i = 0; i < enemies.length; i++) {
          var e = enemies[i];
          if (!e || e.dead || hit.indexOf(e) >= 0) continue;
          if (e.pos.clone().add(new THREE.Vector3(0, 2, 0))
            .distanceTo(t0.position) > TOT.radius) continue;
          hit.push(e);
          var kb = dir.clone().multiplyScalar(26); kb.y = 12;
          e.damage(TOT.dmg, kb, {
            react: 'slash', reactDur: .5, spark: ARC, bleed: true, death: 'dice'
          });
          FX.impact(e.pos.clone().add(new THREE.Vector3(0, 2.6, 0)), ARC2, 2.2);
          arcTree(e.pos.clone().add(new THREE.Vector3(0, 2.6, 0)),
            dir.clone(), { reach: 12, depth: 3, life: .3 });
          addShake(1.1);
          hitstop(.06);
        }
      }
      if (travelled < TOT.reach && this.t > 0) return true;
      stop.stop();
      MG.dismiss(t0, t0.position.clone());
      return false;
    } });
    return t0;
  }

  function castTotality() {
    if (!ready('ga1')) return;
    var a = start('ga1', 1.2, 'ga1', 'DIVINE DOGS: TOTALITY', '玉犬・渾');
    a.dir = aim();
    player.iframes = Math.max(player.iframes, .4);
    try { sfx.whoosh(); } catch (e) {}
  }
  function stepTotality(a, dt) {
    var p = player, d = a.dir;
    var at = p.pos.clone().addScaledVector(d, 5);
    if (a.t < .42) {
      if (!a.pool) {
        a.pool = MG.pool(at.clone(), 7, .6);
        arcTree(at.clone().add(new THREE.Vector3(0, 1, 0)),
          new THREE.Vector3(0, 1, 0), { reach: 14, depth: 3, life: .4 });
        addShake(.7);
      }
      return;
    }
    if (a.stage < 1) {
      a.stage = 1;
      /* the two of them, and then one */
      FX.speedRing(at.clone().add(new THREE.Vector3(0, 1.6, 0)), ARC2, 14, .34);
      FX.flash('#bfeaff', .3, .18);
      arcTree(at.clone().add(new THREE.Vector3(0, 1.6, 0)),
        d.clone(), { reach: 20, depth: 3, life: .42 });
      addShake(1.4);
      hitstop(.06);
      runTotality(at.clone(), d.clone());
    }
  }

  /* =====================================================================
     2 · CHIMERA — the variant of one
     Totality merges two of the same thing. This merges three different
     ones: the serpent's jaws on the front, the toad's tongue underneath
     and Nue's wings on the back. It does not run a line — it leaps, and
     it takes whatever it lands on with it.
     ================================================================== */
  var CHI = { leap: 26, dmg: 40, radius: 6.5 };

  function buildChimera() {
    var g = new THREE.Group();
    /* the body is the serpent's head, which is the part that bites */
    var head = MG.buildSnake();
    head.scale.setScalar(1.15);
    head.__segs.forEach(function (s) { s.visible = false; });   // no tail
    g.add(head);
    g.__jaw = head.__jaw;
    /* Nue's wings off the back of it */
    var bird = MG.buildNue();
    bird.scale.setScalar(.85);
    bird.position.set(0, .4, -2.4);
    g.add(bird);
    g.__wings = bird.__wings;
    /* and the toad's tongue, which is what it reaches with */
    var tongue = new THREE.Group();
    g.__tongue = [];
    for (var i = 0; i < 8; i++) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(.5 - i * .03, .3, 1.2),
        new THREE.MeshStandardMaterial({ color: i % 2 ? 0x5e2038 : 0x431628,
          roughness: .55, flatShading: true }));
      m.position.set(0, -.5, 2.4 + i * 1.1);
      tongue.add(m);
      g.__tongue.push(m);
    }
    g.add(tongue);
    return g;
  }

  /* Where it comes down. A leap that always travels its full length lands
     behind whoever it was aimed at, which is how this read the first time
     it was driven: the thing sailed over them. So it picks the nearest
     body in front of it and lands on that instead, and only goes the full
     distance when there is nobody there. Both screens run the same search
     over their own copy of the fight, so the ghost lands where the real
     one did without the spot having to travel. */
  function leapSpot(from, dir) {
    var best = null, near = 1e9;
    enemies.forEach(function (e) {
      if (!e || e.dead) return;
      var to = e.pos.clone().sub(from); to.y = 0;
      var dist = to.length();
      if (dist < 3 || dist > CHI.leap + 8) return;
      if (to.normalize().dot(dir) < .3) return;        // it has to be in front
      if (dist < near) { near = dist; best = e; }
    });
    return best ? new THREE.Vector3(best.pos.x, 0, best.pos.z)
                : from.clone().addScaledVector(dir, CHI.leap).setY(0);
  }
  GD.leapSpot = leapSpot;

  function leapChimera(from, dir, ghost, land) {
    var c = buildChimera();
    c.position.copy(from);
    c.rotation.y = Math.atan2(dir.x, dir.z);
    scene.add(c);
    MG.pets.push(c);
    var t = 0, landed = false, flap = 0;
    var to = (land || leapSpot(from, dir)).clone();
    to.y = from.y;
    var stop = crackle(function () { return c.position.clone(); },
      function () { return t < 1.5; });
    addFx({ t: 4, update: function (dt) {
      this.t -= dt; t += dt;
      flap += dt * 12;
      c.__wings.forEach(function (w, i) { w.rotation.z = Math.sin(flap) * .8 * (i ? -1 : 1); });
      if (t < .6) {
        /* the arc of the leap, as tall as the leap is long */
        var k = t / .6;
        c.position.lerpVectors(from, to, k);
        c.position.y = Math.sin(k * Math.PI) * Math.min(11, 3 + from.distanceTo(to) * .34);
        c.rotation.x = -.5 + k;
        /* the tongue trailing behind it */
        c.__tongue.forEach(function (m, i) {
          m.position.y = -.5 - Math.sin(k * 3 + i * .4) * .5;
        });
        if (Math.random() < dt * 30) MG.wisp(c.position.clone(), 1);
        return true;
      }
      if (!landed) {
        landed = true;
        c.position.copy(to);
        c.position.y = 0;
        c.rotation.x = 0;
        if (c.__jaw) c.__jaw.rotation.x = .1;
        var at = new THREE.Vector3(to.x, 0, to.z);
        FX.flash('#bfeaff', .42, .22);
        FX.impact(to.clone().add(new THREE.Vector3(0, 2, 0)), ARC2, 4);
        FX.rings(at.clone(), ARC, 5, { maxR: 26, life: .85, gap: 42 });
        FX.cracks(at.clone(), 18, 24, 0x101020);
        FX.debris(at.clone(), 20, 20, 0x22223a);
        for (var b = 0; b < 5; b++) {
          arcTree(to.clone().add(new THREE.Vector3(0, 1.4, 0)),
            new THREE.Vector3(Math.cos(b / 5 * TAU), .3, Math.sin(b / 5 * TAU)),
            { reach: 20, depth: 3, life: .4 });
        }
        addShake(3);
        hitstop(.12);
        try { sfx.redBoom(); } catch (e) {}
        if (!ghost) {
          enemies.forEach(function (e) {
            if (!e || e.dead || e.pos.distanceTo(at) > CHI.radius) return;
            var kb = e.pos.clone().sub(at).setY(0);
            if (kb.lengthSq() < .01) kb.set(1, 0, 0);
            kb.normalize().multiplyScalar(16); kb.y = 20;
            e.damage(CHI.dmg, kb, {
              react: 'blow', reactDur: 1, spark: ARC2, stun: 1,
              bleed: true, death: 'dice'
            });
          });
        }
      }
      if (c.__jaw) c.__jaw.rotation.x = .1 + Math.sin(t * 5) * .1;
      if (this.t > 2.4) return true;
      stop.stop();
      MG.dismiss(c, c.position.clone().add(new THREE.Vector3(0, 1, 0)));
      return false;
    } });
    return c;
  }

  function castChimera() {
    if (!ready('ga2')) return;
    var a = start('ga2', 1.35, 'ga2', 'CHIMERA', '嵌合');
    a.dir = aim();
    player.iframes = Math.max(player.iframes, .6);
    try { sfx.whoosh(); } catch (e) {}
  }
  function stepChimera(a, dt) {
    var p = player, d = a.dir;
    var at = p.pos.clone().addScaledVector(d, 5.5);
    if (a.t < .5) {
      if (!a.pool) {
        a.pool = MG.pool(at.clone(), 9, .7);
        /* three of them coming up, and going into one */
        for (var i = 0; i < 3; i++) {
          arcTree(at.clone().add(new THREE.Vector3(
            Math.cos(i / 3 * TAU) * 3, .8, Math.sin(i / 3 * TAU) * 3)),
            new THREE.Vector3(0, 1, 0), { reach: 13, depth: 3, life: .45 });
        }
        addShake(1);
      }
      return;
    }
    if (a.stage < 1) {
      a.stage = 1;
      FX.speedRing(at.clone().add(new THREE.Vector3(0, 2, 0)), ARC2, 16, .36);
      FX.flash('#cfeeff', .34, .2);
      addShake(1.6);
      hitstop(.07);
      leapChimera(at.clone(), d.clone());
    }
  }

  /* =====================================================================
     3 · MAHORAGA — the variant of two
     八握剣異戒神将魔虚羅. The chimera taken to its end: not a thing he
     merged, a thing that was already one. The wheel over its head turns
     once for every technique it is shown, and after it has turned, that
     technique does not work on it any more — so its three strikes get
     stronger rather than repeating.
     ================================================================== */
  var MAH = { dur: 3.4, reach: 15, dmg: [26, 34, 52] };

  function buildMahoraga() {
    var g = new THREE.Group();
    function part(w, h, d, x, y, z, c) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({ color: c == null ? DEEP : c,
          roughness: .86, flatShading: true }));
      m.position.set(x, y, z);
      m.castShadow = Math.max(w, h, d) > 1.2;
      var shell = new THREE.Mesh(m.geometry, new THREE.MeshBasicMaterial({
        color: LIT, side: THREE.BackSide, transparent: true,
        opacity: .4, depthWrite: false, toneMapped: false }));
      shell.scale.set(1 + .26 / w, 1 + .26 / h, 1 + .26 / d);
      m.add(shell);
      g.add(m);
      return m;
    }
    /* the body: long, thin, and standing up */
    part(2.6, 4.4, 1.9, 0, 6.4, 0, DEEP);
    part(2.0, 1.4, 1.6, 0, 9.0, 0, INK);          // the shoulders
    part(1.4, 1.5, 1.5, 0, 10.1, .2, EDGE);       // the skull
    /* the mask: two slits, and nothing else */
    for (var s = -1; s <= 1; s += 2) {
      var eye = new THREE.Mesh(new THREE.BoxGeometry(.4, .12, .08),
        new THREE.MeshBasicMaterial({ color: 0xffb03a, toneMapped: false }));
      eye.position.set(s * .32, 10.2, .96);
      g.add(eye);
    }
    /* the arms, and the sword in one of them */
    g.__arms = [];
    for (s = -1; s <= 1; s += 2) {
      var sh = new THREE.Group();
      sh.position.set(s * 1.5, 8.9, 0);
      part(.7, 2.6, .7, s * 1.5, 7.6, 0, DEEP);
      part(.62, 2.4, .62, s * 1.5, 5.4, .3, INK);
      g.__arms.push(sh);
      g.add(sh);
    }
    var blade = part(.22, 6.4, .9, 1.9, 4.2, 1.4, 0xb8c2d8);
    blade.rotation.x = .3;
    g.__blade = blade;
    /* the legs */
    for (s = -1; s <= 1; s += 2) {
      part(.9, 3.0, .9, s * .8, 2.7, 0, DEEP);
      part(1.0, .5, 1.6, s * .8, 1.0, .3, INK);
    }
    /* THE WHEEL. Eight spokes over its head, and it turns. */
    var wheel = new THREE.Group();
    wheel.position.set(0, 12.4, 0);
    wheel.rotation.x = Math.PI / 2;
    var rim = new THREE.Mesh(new THREE.TorusGeometry(1.9, .18, 6, 20),
      new THREE.MeshBasicMaterial({ color: ARC2, toneMapped: false }));
    wheel.add(rim);
    for (var i = 0; i < 8; i++) {
      var sp = new THREE.Mesh(new THREE.BoxGeometry(.16, 3.6, .16),
        new THREE.MeshBasicMaterial({ color: ARC, toneMapped: false }));
      sp.rotation.z = i / 8 * Math.PI;
      wheel.add(sp);
    }
    g.add(wheel);
    g.__wheel = wheel;
    return g;
  }

  /* it comes out, and it swings three times, and each one is worse */
  function callMahoraga(at, dir, ghost) {
    var m = buildMahoraga();
    m.position.set(at.x, -16, at.z);
    m.rotation.y = Math.atan2(dir.x, dir.z);
    scene.add(m);
    MG.pets.push(m);
    var t = 0, swung = 0, spin = 0;
    var BEAT = [.95, 1.75, 2.55];
    var stop = crackle(function () {
      return m.position.clone().add(new THREE.Vector3(0, 6, 0));
    }, function () { return t < MAH.dur; });

    addFx({ t: MAH.dur + 1.4, update: function (dt) {
      this.t -= dt; t += dt;
      /* the rise */
      if (t < .6) {
        var k = E.out(t / .6);
        m.position.y = -16 + k * 16;
        if (Math.random() < dt * 50) MG.wisp(m.position.clone().add(new THREE.Vector3(0, 6, 0)), 1);
      } else m.position.y = 0;
      /* the wheel turns, and it turns faster once it has started */
      spin += dt * (1.4 + swung * 3.4);
      m.__wheel.rotation.z = spin;
      m.__wheel.children[0].scale.setScalar(1 + swung * .18);

      /* three strikes, and the wheel turns between them */
      if (swung < 3 && t > BEAT[swung]) {
        var n = swung++;
        var to = m.position.clone().addScaledVector(dir, 8).add(new THREE.Vector3(0, 3, 0));
        /* the wheel takes a turn, out loud */
        FX.speedRing(m.position.clone().add(new THREE.Vector3(0, 12.4, 0)),
          ARC2, 10 + n * 4, .3);
        arcTree(m.position.clone().add(new THREE.Vector3(0, 12.4, 0)),
          new THREE.Vector3(0, 1, 0), { reach: 12 + n * 6, depth: 3, life: .34 });
        /* and the arm comes down */
        m.__arms[1].rotation.x = -2.2;
        (function (arm) {
          var at2 = 0;
          addFx({ t: .3, update: function (dd) {
            this.t -= dd; at2 += dd;
            arm.rotation.x = -2.2 + E.out(at2 / .3) * 3.4;
            if (this.t <= 0) { arm.rotation.x = 0; return false; }
            return true;
          } });
        })(m.__arms[1]);
        /* the cut it leaves, longer and brighter every time */
        var w = 8 + n * 5;
        var side = new THREE.Vector3(-dir.z, 0, dir.x);
        FX.cutLine(to.clone().addScaledVector(side, -w), to.clone().addScaledVector(side, w),
          n < 2 ? ARC : 0xffffff, .5 + n * .35, .3);
        FX.impact(to.clone(), n < 2 ? ARC2 : 0xffffff, 2.4 + n);
        FX.mangaLines(.4 + n * .2, .18);
        addShake(1.4 + n * 1.1);
        hitstop(.05 + n * .04);
        try { sfx.slash(); } catch (e) {}
        if (!ghost) {
          var got = enemiesNear(to.clone(), MAH.reach + n * 3);
          got.forEach(function (e) {
            if (!e || e.dead) return;
            e.damage(MAH.dmg[n], dir.clone().multiplyScalar(10 + n * 8).setY(6 + n * 4), {
              react: n < 2 ? 'slash' : 'blow', reactDur: .4 + n * .2,
              spark: n < 2 ? ARC : 0xffffff, bleed: true,
              death: n < 2 ? 'sever' : 'dice', stun: .3 + n * .3
            });
          });
        }
      }
      if (t < MAH.dur) return true;
      stop.stop();
      MG.dismiss(m, m.position.clone().add(new THREE.Vector3(0, 6, 0)));
      return false;
    } });
    return m;
  }

  function castMahoraga() {
    if (!ready('ga3')) return;
    var a = start('ga3', 1.5, 'ga3', 'MAHORAGA', '八握剣異戒神將魔虚羅');
    a.dir = aim();
    player.iframes = Math.max(player.iframes, 1.5);
    FX.letterbox(true);
    later(3600, function () { FX.letterbox(false); });
    try { sfx.raise(); } catch (e) {}
  }
  function stepMahoraga(a, dt) {
    var p = player, d = a.dir;
    var at = p.pos.clone().addScaledVector(d, 9);
    if (a.t < .6) {
      if (!a.pool) {
        a.pool = MG.pool(at.clone(), 12, 1.2);
        FX.cracks(new THREE.Vector3(at.x, .05, at.z), 14, 20, 0x101020);
        FX.flash('#9fd8ff', .3, .3);
        addShake(1.2);
      }
      return;
    }
    if (a.stage < 1) {
      a.stage = 1;
      callMahoraga(at.clone(), d.clone());
    }
  }

  /* =====================================================================
     4 · CHIMERA SHADOW GARDEN  嵌合暗翳庭
     The domain. Not a room with something in it — the floor becomes
     shadow, so there is no longer anywhere a shikigami is not. What it
     looks like is the whole point: black, a red lattice on the ground,
     and the arcs going out of him in every direction and filling it.
     ================================================================== */
  var DOM = { open: 2.4, dur: 22, r: 38 };

  /* THE FLOOR. In the picture it is a square red lattice running away
     under him to the edge of the dark, so that is what it is: one set of
     lines each way, clipped to a circle so the garden has an edge rather
     than a wall. One geometry, one material, one draw. */
  function gridFloor(c, r) {
    var mat = new THREE.LineBasicMaterial({
      color: GRID, transparent: true, opacity: .9, toneMapped: false });
    var STEP = r / 11;
    var pts = [], i, x, z, half;
    for (i = -11; i <= 11; i++) {
      x = i * STEP;
      half = Math.sqrt(Math.max(0, r * r - x * x));
      if (half < .5) continue;
      pts.push(new THREE.Vector3(x, .06, -half), new THREE.Vector3(x, .06, half));
      z = i * STEP;
      half = Math.sqrt(Math.max(0, r * r - z * z));
      pts.push(new THREE.Vector3(-half, .06, z), new THREE.Vector3(half, .06, z));
    }
    var g = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), mat);
    /* and the edge of it, so the lattice stops somewhere */
    var ring = [];
    for (i = 0; i <= 96; i++) {
      var a = i / 96 * TAU;
      ring.push(new THREE.Vector3(Math.cos(a) * r, .06, Math.sin(a) * r));
    }
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ring), mat));
    g.position.set(c.x, 0, c.z);
    g.__mat = mat;
    return g;
  }

  function openGarden(center, yaw, remote) {
    if (GD.on) return;
    GD.on = true;
    GD.t = 0;
    GD.stage = 0;
    GD.center = center.clone();
    GD.yaw = yaw || 0;
    GD.parts = [];
    GD.remote = !!remote;

    /* everything goes, and what is left is black */
    if (window.JJSTAGE) {
      window.JJSTAGE.hide.sky = 0x02030a;
      window.JJSTAGE.hide([]);
    }
    FX.flash('#bfeaff', .8, .5);
    FX.letterbox(true);
    try { sfx.raise(); } catch (e) {}

    var grid = gridFloor(center, DOM.r);
    grid.scale.setScalar(.02);
    scene.add(grid);
    GD.parts.push(grid);
    GD.grid = grid;

    /* the point everything comes out of. T.star, because there is no
       T.glow — asking for one gets a textureless plane, which drew as a
       white box standing in front of him */
    var core = FX.billboard(FX.T.star, 0xdff4ff, .85);
    core.scale.setScalar(3);
    core.position.copy(center).add(new THREE.Vector3(0, 3.4, 0));
    scene.add(core);
    GD.parts.push(core);
    GD.core = core;

    addShake(2.6);
  }

  function shutGarden() {
    if (!GD.on) return;
    GD.on = false;
    (GD.parts || []).forEach(function (o) {
      scene.remove(o);
      o.traverse && o.traverse(function (c) {
        if (c.material) c.material.dispose();
        if (c.geometry) c.geometry.dispose();
      });
      if (o.material && o.material.dispose) o.material.dispose();
    });
    GD.parts = [];
    GD.grid = null; GD.core = null;
    if (window.JJSTAGE) { delete window.JJSTAGE.hide.sky; window.JJSTAGE.show(); }
    FX.letterbox(false);
    if (player.action && player.action.type === 'gdom') player.action = null;
  }
  GD.close = shutGarden;

  /* the garden's own tick: it runs on its own, not on an action, so he
     can move and fight inside it the way Hakari can inside his */
  addFx({ t: 1e9, update: function (dt) {
    if (!GD.on) return true;
    GD.t += dt;
    var c = GD.center;

    /* the lattice grows out over the first second */
    if (GD.grid) {
      var k = Math.min(1, GD.t / 1.1);
      GD.grid.scale.setScalar(.02 + E.out(k) * .98);
      GD.grid.__mat.opacity = .55 + Math.abs(Math.sin(GD.t * 2)) * .4;
    }
    if (GD.core) {
      GD.core.scale.setScalar(2.6 + Math.sin(GD.t * 9) * .7);
      FX.faceCam(GD.core, 0);
      GD.core.position.copy(GD.remote ? c : player.pos).add(new THREE.Vector3(0, 3.4, 0));
    }

    /* THE ARCS. The picture is mostly this: branching cyan lightning
       going out of him in every direction and reaching the edge of the
       frame. So they are thrown constantly, from him, outward, at a rate
       that keeps a dozen of them alive at any moment. */
    GD.acc = (GD.acc || 0) + dt;
    if (GD.acc > .05) {
      GD.acc = 0;
      var from = (GD.remote ? c : player.pos).clone().add(new THREE.Vector3(0, 3, 0));
      for (var n = 0; n < 3; n++) {
        var a = Math.random() * TAU;
        var up = Math.random() * 1.4 - .1;
        arcTree(from.clone(), new THREE.Vector3(Math.cos(a), up, Math.sin(a)),
          { reach: 26 + Math.random() * 14, depth: 3, life: .45, spread: .85 });
      }
    }
    /* and a few coming off the floor at the edge, so the space has depth */
    GD.edge = (GD.edge || 0) + dt;
    if (GD.edge > .18) {
      GD.edge = 0;
      var ea = Math.random() * TAU, er = DOM.r * (.5 + Math.random() * .5);
      arcTree(new THREE.Vector3(c.x + Math.cos(ea) * er, .2, c.z + Math.sin(ea) * er),
        new THREE.Vector3(0, 1, 0), { reach: 16, depth: 2, life: .35 });
    }

    /* Everything caught inside is standing on shadow, and takes it. */
    if (!GD.remote) {
      GD.tick = (GD.tick || 0) + dt;
      if (GD.tick > .6) {
        GD.tick = 0;
        enemies.forEach(function (e) {
          if (!e || e.dead || e.pos.distanceTo(c) > DOM.r) return;
          e.damage(9, null, { spark: ARC, react: null, noFrameBonus: true, death: 'dice' });
          arcTree(e.pos.clone().add(new THREE.Vector3(0, 1.4, 0)),
            new THREE.Vector3(0, 1, 0), { reach: 9, depth: 2, life: .28 });
        });
      }
      /* and he is untouchable in his own */
      player.iframes = Math.max(player.iframes, .5);
    }

    if (GD.t > DOM.dur) shutGarden();
    return true;
  } });

  function castGarden() {
    if (!ready('gdom')) return;
    var a = start('gdom', DOM.open, 'gdom', '', '');
    a.center = player.pos.clone();
    player.iframes = Math.max(player.iframes, DOM.open + 1);
    if (window.MPJJ && window.MPJJ.relay) {
      window.MPJJ.relay.pub({ t: 'dom', id: window.MPJJ.id, k: 'garden',
        x: Math.round(player.pos.x * 10) / 10, z: Math.round(player.pos.z * 10) / 10,
        y: Math.round(player.facing * 100) / 100, r: DOM.r, d: 1.6, dur: DOM.dur });
    }
  }

  /* the opening: the hand sign, the name, and then the floor goes */
  function stepGarden(a, dt) {
    var p = player;
    p.vel.set(0, 0, 0);
    if (a.t < 1.1) {
      if (a.stage < 1) {
        a.stage = 1;
        FX.letterbox(true);
        FX.tint('#04060f', .6, 1.4);
        if (AN) AN.camRelease();
        addShake(.8);
      }
      /* the arcs starting on his hands before anything else */
      if (Math.random() < .6) {
        var h = p.pos.clone().add(new THREE.Vector3(
          (Math.random() - .5) * 1.6, 2.6 + Math.random() * 1.4, .6));
        arcTree(h, new THREE.Vector3(0, 1, 0), { reach: 7, depth: 2, life: .24 });
      }
      return;
    }
    if (a.stage < 2) {
      a.stage = 2;
      /* the name in the corner of the picture, kept */
      try { showSplash('DOMAIN EXPANSION', 'CHIMERA SHADOW GARDEN 嵌合暗翳庭', '#4fd8ff'); } catch (e) {}
      openGarden(a.center.clone(), p.facing, false);
      /* the first burst, which is the shot the picture is */
      for (var i = 0; i < 10; i++) {
        var an = i / 10 * TAU;
        arcTree(p.pos.clone().add(new THREE.Vector3(0, 3, 0)),
          new THREE.Vector3(Math.cos(an), .2 + Math.random(), Math.sin(an)),
          { reach: 34, depth: 3, life: .6 });
      }
    }
  }

  /* =====================================================================
     POSES
     ================================================================== */
  function poseGarden(r, a) {
    var t = a.t, out = E.out;
    switch (a.type) {
      case 'ga1': {                                    // both hands down and apart
        rp(r);
        var k = out(Math.min(1, t / .42));
        var go = t > .42 ? out(Math.min(1, (t - .42) / .24)) : 0;
        r.shoulderL.rotation.x = -.9 * k + .6 * go;
        r.shoulderR.rotation.x = -.9 * k + .6 * go;
        r.shoulderL.rotation.z = .9 * k - .5 * go;
        r.shoulderR.rotation.z = -.9 * k + .5 * go;
        r.elbowL.rotation.x = -1.2 * k + 1 * go;
        r.elbowR.rotation.x = -1.2 * k + 1 * go;
        r.spine.rotation.x = .3 * k - .5 * go;
        r.neck.rotation.x = .16 * k - .3 * go;
        r.hipL.rotation.x = -.42 * k; r.kneeL.rotation.x = .78 * k;
        r.hipR.rotation.x = .3 * k; r.kneeR.rotation.x = .5 * k;
        r.hips.position.y = r.hipsBaseY - .45 * k + .3 * go;
        return true;
      }
      case 'ga2': {                                    // hands together, then thrown
        rp(r);
        var c = out(Math.min(1, t / .5));
        var th = t > .5 ? out(Math.min(1, (t - .5) / .26)) : 0;
        r.shoulderL.rotation.x = -1.5 * c - .8 * th;
        r.shoulderR.rotation.x = -1.5 * c - .8 * th;
        r.shoulderL.rotation.z = 1.1 * c - .9 * th;
        r.shoulderR.rotation.z = -1.1 * c + .9 * th;
        r.elbowL.rotation.x = -1.5 * c + 1.3 * th;
        r.elbowR.rotation.x = -1.5 * c + 1.3 * th;
        r.spine.rotation.x = .26 * c - .6 * th;
        r.neck.rotation.x = -.2 * c;
        r.hipL.rotation.x = -.5 * c; r.kneeL.rotation.x = .9 * c;
        r.hipR.rotation.x = .34 * c; r.kneeR.rotation.x = .56 * c;
        r.hips.position.y = r.hipsBaseY - .5 * c + .34 * th;
        return true;
      }
      case 'ga3': {                                    // one hand out, held there
        rp(r);
        var m = out(Math.min(1, t / .6));
        var hold = t > .6 ? Math.min(1, (t - .6) / .5) : 0;
        var tremor = Math.sin(t * 22) * .03 * hold;
        r.shoulderR.rotation.x = -1.7 * m;
        r.shoulderR.rotation.z = -.34 * m;
        r.elbowR.rotation.x = -.24 * m;
        r.shoulderL.rotation.x = -.7 * m;
        r.elbowL.rotation.x = -1.5 * m;
        r.spine.rotation.x = -.2 * m + tremor;
        r.neck.rotation.x = -.34 * m;
        r.hipL.rotation.x = -.3 * m; r.kneeL.rotation.x = .55 * m;
        r.hipR.rotation.x = -.22 * m; r.kneeR.rotation.x = .45 * m;
        r.hips.position.y = r.hipsBaseY - .2 * m + tremor;
        return true;
      }
      case 'gdom': {                                   // the sign, and then open
        rp(r);
        var s1 = out(Math.min(1, t / .8));
        var op = t > 1.1 ? out(Math.min(1, (t - 1.1) / .5)) : 0;
        /* both hands in front of the chest, fingers laced */
        r.shoulderL.rotation.x = -1.45 * s1 + .5 * op;
        r.shoulderR.rotation.x = -1.45 * s1 + .5 * op;
        r.shoulderL.rotation.z = .62 * s1 + .7 * op;
        r.shoulderR.rotation.z = -.62 * s1 - .7 * op;
        r.elbowL.rotation.x = -1.7 * s1 + 1.4 * op;
        r.elbowR.rotation.x = -1.7 * s1 + 1.4 * op;
        r.spine.rotation.x = .16 * s1 - .44 * op;
        r.neck.rotation.x = .2 * s1 - .6 * op;
        r.hipL.rotation.x = -.22 * s1; r.kneeL.rotation.x = .42 * s1;
        r.hipR.rotation.x = -.18 * s1; r.kneeR.rotation.x = .36 * s1;
        r.hips.position.y = r.hipsBaseY - .28 * s1 + .18 * op;
        return true;
      }
    }
    return false;
  }

  /* =====================================================================
     THE AWAKENING ITSELF
     ================================================================== */
  var BASE_MOVES = CHARS.megumi.moves.slice();
  var AW_MOVES = [
    { key: 'LMB', lbl: 'Punch', cd: 'm1', max: .3 },
    { key: 'Q', lbl: 'Dash', cd: 'dash', max: 1 },
    { key: '1', lbl: 'Totality', cd: 'ga1', max: GCD.ga1 },
    { key: '2', lbl: 'Chimera', cd: 'ga2', max: GCD.ga2 },
    { key: '3', lbl: 'Mahoraga', cd: 'ga3', max: GCD.ga3 },
    { key: '4', lbl: 'Shadow Garden', cd: 'gdom', max: GCD.gdom },
    { key: 'R', lbl: 'Rabbit Escape', cd: 'mgr', max: 9 }
  ];
  var barOn = false;
  function swapBar(on) {
    if (on === barOn) return;
    barOn = on;
    CHARS.megumi.moves = on ? AW_MOVES : BASE_MOVES;
    if (player.char === 'megumi') { try { buildMovesBar(); } catch (e) {} }
  }

  function awakenMegumi() {
    if (player.char !== 'megumi' || player.dead || busy()) return false;
    start('gaw', 2.3, 'ga1', 'TEN SHADOWS', '十種影法術');
    cds.ga1 = 0;
    player.iframes = Math.max(player.iframes, 2.7);
    FX.letterbox(true);
    FX.tint('#04101c', .5, 2.3);
    if (AN) AN.camRelease();
    return true;
  }

  function stepAwaken(a, dt) {
    var p = player;
    p.vel.set(0, 0, 0);
    /* the shadow opens under him and keeps opening */
    if (a.stage < 1 && a.t > .3) {
      a.stage = 1;
      MG.pool(p.pos.clone(), 11, 1.8);
      addShake(1.2);
    }
    if (Math.random() < .8) {
      var h = p.pos.clone().add(new THREE.Vector3(
        (Math.random() - .5) * 2.4, .4 + Math.random() * 5, (Math.random() - .5) * 2.4));
      arcTree(h, new THREE.Vector3(
        (Math.random() - .5), .6 + Math.random(), (Math.random() - .5)),
        { reach: 10, depth: 2, life: .26 });
    }
    /* and then the arcs stand off him for good */
    if (a.stage < 2 && a.t > 1.5) {
      a.stage = 2;
      FX.flash('#bfeaff', .6, .34);
      FX.rings(new THREE.Vector3(p.pos.x, .12, p.pos.z), ARC, 5, { maxR: 26, life: .9, gap: 50 });
      for (var i = 0; i < 12; i++) {
        arcTree(p.pos.clone().add(new THREE.Vector3(0, 3, 0)),
          new THREE.Vector3(Math.cos(i / 12 * TAU), .3 + Math.random(), Math.sin(i / 12 * TAU)),
          { reach: 26, depth: 3, life: .55 });
      }
      addShake(2.4);
      var AW = A();
      if (AW) {
        AW.megumi = true;
        AW.megumiT = AWAKE_DUR;
        if (AW.theme) { try { AW.theme(true, 'local'); } catch (e) {} }
      }
      swapBar(true);
      GD.aura = crackle(function () {
        return player.char === 'megumi' && !player.dead ? player.pos.clone() : null;
      }, function () { return awake(); });
      FX.letterbox(false);
    }
  }

  function endAwaken(quiet) {
    var AW = A();
    if (!AW || !AW.megumi) return;
    AW.megumi = false;
    AW.megumiT = 0;
    swapBar(false);
    if (GD.aura) { GD.aura.stop(); GD.aura = null; }
    if (GD.on) shutGarden();
    if (!quiet && FX) {
      FX.rings(new THREE.Vector3(player.pos.x, .12, player.pos.z), LIT, 3,
        { maxR: 14, life: .7, gap: 50 });
      MG.wisp(player.pos.clone().add(new THREE.Vector3(0, 2, 0)), 6);
    }
    if (AW.theme) { try { AW.theme(false, 'local'); } catch (e) {} }
  }
  GD.end = endAwaken;

  /* it runs on a clock, and it goes when he does */
  var _updatePlayer = updatePlayer;
  updatePlayer = function (dt) {
    var AW = A();
    if (AW && AW.megumi) {
      if (player.char !== 'megumi' || player.dead) endAwaken(!!player.dead);
      else {
        AW.megumiT -= dt;
        for (var k in GCD) { if (cds[k] > 0) cds[k] = Math.max(0, cds[k] - dt * 1.6); }
        if (AW.megumiT <= 0) endAwaken(false);
      }
    }
    return _updatePlayer(dt);
  };

  /* --------------------------------------------------------------- wiring */
  var _stepAction = stepAction;
  stepAction = function (a, dt) {
    switch (a.type) {
      case 'gaw': return stepAwaken(a, dt);
      case 'ga1': return stepTotality(a, dt);
      case 'ga2': return stepChimera(a, dt);
      case 'ga3': return stepMahoraga(a, dt);
      case 'gdom': return stepGarden(a, dt);
    }
    return _stepAction(a, dt);
  };

  var _poseAction = poseAction;
  poseAction = function (r, a) {
    if (a && a.type === 'gaw') { poseGarden(r, { type: 'gdom', t: Math.min(a.t, 1.05) }); return; }
    if (a && (r.__char || player.char) === 'megumi' && poseGarden(r, a)) return;
    return _poseAction(r, a);
  };

  /* the awakened four sit on the same keys, and the base kit is what he
     has when the shadow is shut */
  window.addEventListener('keydown', function (e) {
    if (!started || player.char !== 'megumi' || e.repeat || !awake()) return;
    if (player.react || (player.action && (player.action.type === 'kb' ||
        player.action.type === 'void' || player.action.type === 'gaw'))) return;
    var hit = true;
    if (e.code === 'Digit1') castTotality();
    else if (e.code === 'Digit2') castChimera();
    else if (e.code === 'Digit3') castMahoraga();
    else if (e.code === 'Digit4') castGarden();
    else hit = false;
    if (hit) e.stopImmediatePropagation();
  }, true);

  /* F: the shared meter, spent on opening the shadow properly */
  window.addEventListener('keydown', function (e) {
    if (e.code !== 'KeyF' || e.repeat || !started) return;
    if (player.char !== 'megumi') return;
    var AW = A();
    if (!AW || !AW.ready || AW.active || AW.cine || AW.megumi) return;
    if (window.JJNAOYA && window.JJNAOYA.busy()) return;
    if (awakenMegumi()) { AW.charge = 0; AW.ready = false; }
  });

  var _switchCharG = switchChar;
  switchChar = function (id, quiet) {
    endAwaken(true);
    return _switchCharG(id, quiet);
  };

  /* =====================================================================
     WHAT EVERYBODY ELSE SEES
     ================================================================== */
  function dirOf(yaw) { return new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)); }

  GD.remoteFx = {
    gaw: function (pos) {
      MG.pool(pos.clone(), 11, 1.8);
      var t = 0;
      addFx({ t: 1.6, update: function (dt) {
        this.t -= dt; t += dt;
        if (Math.random() < .8) {
          arcTree(pos.clone().add(new THREE.Vector3(
            (Math.random() - .5) * 2.4, .4 + Math.random() * 5, (Math.random() - .5) * 2.4)),
            new THREE.Vector3((Math.random() - .5), .6 + Math.random(), (Math.random() - .5)),
            { reach: 10, depth: 2, life: .26 });
        }
        return this.t > 0;
      } });
      later(1500, function () {
        FX.flash('#bfeaff', .5, .3);
        FX.rings(new THREE.Vector3(pos.x, .12, pos.z), ARC, 5, { maxR: 26, life: .9, gap: 50 });
        for (var i = 0; i < 12; i++) {
          arcTree(pos.clone().add(new THREE.Vector3(0, 3, 0)),
            new THREE.Vector3(Math.cos(i / 12 * TAU), .3 + Math.random(), Math.sin(i / 12 * TAU)),
            { reach: 26, depth: 3, life: .55 });
        }
      });
    },
    ga1: function (pos, yaw) {
      var d = dirOf(yaw), at = pos.clone().addScaledVector(d, 5);
      MG.pool(at.clone(), 7, .6);
      later(430, function () {
        FX.speedRing(at.clone().add(new THREE.Vector3(0, 1.6, 0)), ARC2, 14, .34);
        arcTree(at.clone().add(new THREE.Vector3(0, 1.6, 0)), d.clone(),
          { reach: 20, depth: 3, life: .42 });
        runTotality(at.clone(), d.clone(), true);
      });
    },
    ga2: function (pos, yaw) {
      var d = dirOf(yaw), at = pos.clone().addScaledVector(d, 5.5);
      MG.pool(at.clone(), 9, .7);
      later(510, function () {
        FX.speedRing(at.clone().add(new THREE.Vector3(0, 2, 0)), ARC2, 16, .36);
        leapChimera(at.clone(), d.clone(), true);
      });
    },
    ga3: function (pos, yaw) {
      var d = dirOf(yaw), at = pos.clone().addScaledVector(d, 9);
      MG.pool(at.clone(), 12, 1.2);
      FX.cracks(new THREE.Vector3(at.x, .05, at.z), 14, 20, 0x101020);
      later(620, function () { callMahoraga(at.clone(), d.clone(), true); });
    },
    gdom: function (pos) {
      /* the sign; the garden itself arrives on its own message */
      for (var i = 0; i < 6; i++) {
        arcTree(pos.clone().add(new THREE.Vector3(0, 2.8, 0)),
          new THREE.Vector3((Math.random() - .5), .6 + Math.random(), (Math.random() - .5)),
          { reach: 9, depth: 2, life: .3 });
      }
    }
  };

  /* the garden, on somebody else's screen: the same black, the same
     lattice, the same arcs — and no damage in any of it */
  GD.remote = function (center, yaw, dur) {
    openGarden(center.clone(), yaw || 0, true);
    later((dur || DOM.dur) * 1000, function () { shutGarden(); });
  };

  /* the pieces the finishers borrow */
  GD.buildTotality = buildTotality;
  GD.buildChimera = buildChimera;
  GD.buildMahoraga = buildMahoraga;
  GD.ARC = ARC; GD.ARC2 = ARC2; GD.GRID = GRID;
})();
