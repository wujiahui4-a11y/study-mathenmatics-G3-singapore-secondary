/* =======================================================================
   MEGUMI AWAKENED — and the garden at the end of it

   His base kit is five separate shikigami, one at a time. Awakened, the
   idea changes: he stops calling them out one by one and starts putting
   them TOGETHER — 渾, Totality. So there are four on the bar:

     1  TOTALITY        玉犬・渾 — the two dogs, merged mid-run into one
     2  CHIMERA         嵌合 — three different things in one body: the
                        serpent's jaws, Nue's wings, a toad's tongue
     3  TOAD            蝦蟇 — the tongue takes them and the mouth keeps
                        them; the only one of his that reels somebody in
     4  CHIMERA SHADOW GARDEN
                        嵌合暗翳庭 — the domain. Everything is shadow, so
                        anything can come out of anywhere.

   AND TWO THAT ARE NOT ON THE BAR. A merge needs two things to merge, so
   the variants are not moves you press — they are moves you EARN, by
   throwing one and then throwing the next one while the first is still
   out. Each opens a window on the key after it:

     1 then 2  ▸  DIVINE CHIMERA  玉犬嵌合
                  the hound and the chimera in one body, down the whole
                  lane and back through it again
     2 then 3  ▸  GREAT MAW       嵌合蝦蟇
                  the chimera wearing the toad's mouth: taken off the
                  floor, hauled in, and shut on

   So 1 → 2 → 3 is one escalating chain, because the variant counts as
   the move it was thrown on. Mahoraga is still here — he is what the
   DOMAIN calls, which is where he belongs.

   Every one of them has a finisher, and none is one hit: they run in
   three beats, because a thing that merges should end somebody in
   stages too.
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

  var GD = window.JJGARDEN = { on: false, t: 0, center: null, yaw: 0, stage: 0, link: null };
  var AWAKE_DUR = 30;
  var GCD = { ga1: 9, ga2: 12, ga3: 10, gv1: 16, gv2: 18, gdom: 40 };
  var LINK = 4.5;                  // how long a merge stays available

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
  cds.ga1 = 0; cds.ga2 = 0; cds.ga3 = 0; cds.gv1 = 0; cds.gv2 = 0; cds.gdom = 0;

  /* =====================================================================
     THE MERGE WINDOW
     Two of these are not moves on the bar. They are what happens when one
     shikigami is still out and he calls the next one into it, so the only
     way to reach them is to throw the one before — and the only place
     that can be said is on the key it lands on.

     `1` opens `2`, and `2` opens `3` — and the variant thrown on `2`
     counts as a `2`, so one chain runs all the way down: Totality, then
     the hound merged into the chimera, then that merged into the mouth.
     ================================================================== */
  var MERGE = { ga1: { key: 'gv1', slot: '2', lbl: 'Divine Chimera' },
                ga2: { key: 'gv2', slot: '3', lbl: 'Great Maw' } };

  function armLink(from) {
    if (!MERGE[from]) { clearLink(); return; }
    GD.link = { from: from, t: LINK };
    showLink(from);
    try {
      if (window.JJNOTICE) window.JJNOTICE(MERGE[from].slot + ' ▸ ' + MERGE[from].lbl.toUpperCase(), '#9fe8ff');
    } catch (e) {}
  }
  function clearLink() {
    if (!GD.link) return;
    GD.link = null;
    showLink(null);
  }
  /* the open key says so on the bar, because a move with no key of its
     own that nobody can see is a move nobody throws */
  function showLink(from) {
    var want = from && MERGE[from] ? MERGE[from] : null;
    var changed = false;
    AW_MOVES.forEach(function (m) {
      var lbl = (want && m.key === want.slot) ? '▸ ' + want.lbl : m.base;
      if (m.lbl !== lbl) { m.lbl = lbl; changed = true; }
      var cd = (want && m.key === want.slot) ? want.key : m.baseCd;
      if (m.cd !== cd) { m.cd = cd; m.max = GCD[cd] || m.max; changed = true; }
    });
    if (changed && barOn && player.char === 'megumi') { try { buildMovesBar(); } catch (e) {} }
  }
  /* which move a key throws right now */
  function merged(from) {
    return !!(GD.link && GD.link.from === from && MERGE[from] && ready(MERGE[from].key));
  }

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
      armLink('ga1');                 /* and 2 becomes the merge for a moment */
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
      armLink('ga2');                 /* and 3 becomes the maw */
    }
  }

  /* =====================================================================
     3 · TOAD  蝦蟇
     The only one of his that does not run at somebody. It comes up,
     opens, and the tongue goes out and BRINGS THEM BACK — every other
     shikigami closes the distance itself, this one closes it with them
     on the end of it. Which is also why it is the one the maw is built
     out of: a mouth is only frightening if something puts things in it.
     ================================================================== */
  /* The corridor was three and a half wide to begin with, which is thinner
   than a body moves in the time it takes to open the mouth — it caught
   things standing still and nothing else. */
var TOAD = { reach: 26, dmg: 30, dur: 1.8, corridor: 6 };

  /* the shadow palette, as a box with a constant-thickness pale edge —
     the same rule the whole of Megumi is drawn under */
  function shade(g, w, h, d, x, y, z, c) {
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

  /* a tongue is a row of boxes that can be stretched to anywhere: the
     segments slide down +z and scale, so one call points the whole thing */
  function tongueOf(g, n, w) {
    g.__tongue = [];
    for (var i = 0; i < n; i++) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(w - i * .02, .3, 1.2),
        new THREE.MeshStandardMaterial({ color: i % 2 ? 0x5e2038 : 0x431628,
          roughness: .55, flatShading: true }));
      m.position.set(0, 0, 0);
      m.visible = false;
      g.add(m);
      g.__tongue.push(m);
    }
  }
  /* point it from the mouth at a place in the world */
  function tongueTo(g, from, to) {
    if (!g.__tongue) return;
    var len = from.distanceTo(to);
    var seg = Math.max(.5, len / g.__tongue.length);
    var local = g.worldToLocal(to.clone());
    var dir = local.clone().normalize();
    g.__tongue.forEach(function (m, i) {
      m.visible = true;
      m.position.copy(dir).multiplyScalar(seg * (i + .5) / (g.scale.x || 1));
      m.lookAt(local);
      m.scale.z = seg / 1.2;
    });
  }
  function tongueIn(g) {
    if (g.__tongue) g.__tongue.forEach(function (m) { m.visible = false; });
  }

  function buildToad() {
    var g = new THREE.Group();
    /* squat, wide and low — it is all mouth and shoulders */
    shade(g, 4.4, 2.2, 5.0, 0, 1.5, -.4, DEEP);          // the belly
    shade(g, 3.6, 1.7, 2.8, 0, 2.5, -2.0, INK);          // the back
    shade(g, 4.8, 1.4, 2.8, 0, 1.8, 2.6, EDGE);          // the skull
    /* the mouth: a hinge at the back of the jaw so it opens properly */
    var jaw = new THREE.Group();
    jaw.position.set(0, 1.3, 1.3);
    shade(jaw, 4.4, .8, 2.9, 0, -.3, 1.4, INK);
    g.add(jaw);
    g.__jaw = jaw;
    /* two eyes on top, which is where a toad keeps them */
    for (var s = -1; s <= 1; s += 2) {
      shade(g, 1.0, .9, 1.0, s * 1.3, 2.7, 2.3, EDGE);
      var eye = new THREE.Mesh(new THREE.BoxGeometry(.5, .3, .12),
        new THREE.MeshBasicMaterial({ color: 0xffb03a, toneMapped: false }));
      eye.position.set(s * 1.3, 2.8, 2.82);
      g.add(eye);
    }
    /* four legs, splayed the way a sitting toad's are */
    g.__legs = [];
    for (s = -1; s <= 1; s += 2) {
      var fr = shade(g, .9, .8, 2.6, s * 2.3, .8, 1.4, DEEP);
      fr.rotation.z = s * .35;
      var bk = shade(g, 1.2, 1.0, 2.0, s * 2.5, 1.0, -1.9, DEEP);
      bk.rotation.z = s * .5;
      shade(g, 1.7, .4, 1.4, s * 2.9, .3, -2.6, INK);    // the foot
      g.__legs.push(fr, bk);
    }
    tongueOf(g, 10, .52);
    return g;
  }
  GD.buildToad = buildToad;

  /* who the tongue reaches: the first body in the corridor in front of it */
  function inLane(from, dir, reach, wide) {
    var best = null, near = 1e9;
    enemies.forEach(function (e) {
      if (!e || e.dead) return;
      var to = e.pos.clone().sub(from); to.y = 0;
      var along = to.dot(dir);
      if (along < 1 || along > reach) return;
      if (to.clone().addScaledVector(dir, -along).length() > wide) return;
      if (along < near) { near = along; best = e; }
    });
    return best;
  }

  /* the whole beat: it rises, the tongue goes out, it takes them, and the
     mouth shuts. `ghost` means somebody else's copy — draw it, hurt no one */
  function callToad(at, dir, ghost) {
    var g = buildToad();
    g.position.set(at.x, -7, at.z);
    g.rotation.y = Math.atan2(dir.x, dir.z);
    scene.add(g);
    MG.pets.push(g);
    var mouth = function () {
      return g.position.clone().add(new THREE.Vector3(0, 1.8, 0))
        .addScaledVector(dir, 3.4);
    };
    var caught = null, hunted = false, bit = false, t = 0;
    var stop = crackle(function () { return g.position.clone(); },
      function () { return t < TOAD.dur; });

    addFx({ t: TOAD.dur + 1, update: function (dt) {
      this.t -= dt; t += dt;
      if (typeof scene === 'undefined') return false;
      /* up out of the shadow */
      if (t < .32) {
        g.position.y = -7 + E.out(t / .32) * 7;
        if (Math.random() < dt * 40) MG.wisp(g.position.clone().add(new THREE.Vector3(0, 2, 0)), 1);
        return true;
      }
      g.position.y = 0;

      /* the mouth opens, and the tongue goes */
      if (!hunted) {
        hunted = true;
        g.__jaw.rotation.x = .9;
        FX.impact(mouth(), ARC2, 2);
        try { sfx.whoosh(); } catch (e) {}
        caught = ghost ? null : inLane(g.position.clone(), dir, TOAD.reach, TOAD.corridor);
        var end = caught ? caught.pos.clone().add(new THREE.Vector3(0, 1.6, 0))
                         : g.position.clone().addScaledVector(dir, TOAD.reach).add(new THREE.Vector3(0, 1.4, 0));
        tongueTo(g, mouth(), end);
        FX.streaks(end.clone(), 0x5e2038, 3, 12, .5);
        if (!caught && !ghost) {
          /* nothing to take hold of: it lashes the whole lane instead,
             so a miss is still a move rather than an animation */
          var lashed = [];
          for (var q = 4; q < TOAD.reach; q += 6) {
            enemiesNear(g.position.clone().addScaledVector(dir, q), 7).forEach(function (e) {
              if (!e || e.dead || lashed.indexOf(e) >= 0) return;
              lashed.push(e);
              e.damage(TOAD.dmg * .45, dir.clone().multiplyScalar(9).setY(5), {
                react: 'slash', reactDur: .3, spark: 0x5e2038, bleed: true, death: 'sever' });
            });
          }
          FX.cracks(new THREE.Vector3(end.x, .06, end.z), 8, 12, 0x2a1018);
          addShake(.8);
        }
        return true;
      }

      /* And it reels them in — fast. A tongue that takes two seconds to
         bring somebody back lands its damage after the cast is over, and
         a hit that lands after its own cast can never arm a finisher. */
      if (caught && !caught.dead && !bit) {
        var want = mouth();
        caught.anchorT = .3;
        caught.anchorPos.copy(want);
        caught.pos.lerp(want, Math.min(1, dt * 13));
        caught.vel.set(0, 0, 0);
        caught.stunT = Math.max(caught.stunT || 0, .4);
        tongueTo(g, mouth(), caught.pos.clone().add(new THREE.Vector3(0, 1.6, 0)));
        if (Math.random() < dt * 14) MG.wisp(caught.pos.clone().add(new THREE.Vector3(0, 2, 0)), 1);
        if (caught.pos.distanceTo(want) < 4 || t > .7) {
          /* the mouth shuts */
          bit = true;
          g.__jaw.rotation.x = 0;
          tongueIn(g);
          FX.impact(want.clone(), 0xffffff, 3.4);
          FX.cross(want.clone(), ARC2, 8, .24);
          FX.blood(want.clone(), dir.clone().negate(), 14, 2);
          FX.mangaLines(.8, .26);
          addShake(2.4);
          hitstop(.14);
          try { sfx.redBoom(); } catch (e) {}
          caught.anchorT = 0;
          caught.damage(TOAD.dmg, dir.clone().negate().multiplyScalar(14).setY(12), {
            react: 'blow', reactDur: .8, spark: ARC2, stun: .8,
            bleed: true, death: 'sever' });
          arcTree(want.clone(), new THREE.Vector3(0, 1, 0), { reach: 14, depth: 3, life: .4 });
        }
      } else if (!bit && t > .85) {
        bit = true;
        g.__jaw.rotation.x = 0;
        tongueIn(g);
      }

      if (t < TOAD.dur) return true;
      stop.stop();
      if (caught) caught.anchorT = 0;
      MG.dismiss(g, g.position.clone().add(new THREE.Vector3(0, 2, 0)));
      return false;
    } });
    return g;
  }

  /* WHERE IT SITS. Nine metres of shadow directly in front of him is not
     a move — that is what the elephant taught. So it comes up beside him
     and a little forward, in frame the whole time, and the tongue is aimed
     down the line HE is facing rather than straight out of its own nose. */
  function besideHim(p, d, out, over) {
    var side = new THREE.Vector3(-d.z, 0, d.x).normalize();
    return p.clone().addScaledVector(d, out).addScaledVector(side, over);
  }
  function laneFrom(at, p, d) {
    return p.clone().addScaledVector(d, 24).sub(at).setY(0).normalize();
  }

  function castToad() {
    if (!ready('ga3')) return;
    /* long enough to still be the toad's cast when the mouth shuts */
    start('ga3', 1.9, 'ga3', 'TOAD', '蝦蟇');
    player.action.dir = aim();
    player.iframes = Math.max(player.iframes, .5);
    try { sfx.whoosh(); } catch (e) {}
  }
  function stepToad(a, dt) {
    var p = player, d = a.dir;
    var at = besideHim(p.pos, d, 8, 5);
    if (a.t < .45) {
      if (!a.pool) {
        a.pool = MG.pool(at.clone(), 8, .9);
        addShake(.9);
      }
      return;
    }
    if (a.stage < 1) {
      a.stage = 1;
      FX.speedRing(at.clone().add(new THREE.Vector3(0, 1.6, 0)), ARC2, 12, .32);
      callToad(at.clone(), laneFrom(at, p.pos, d));
      clearLink();               /* the mouth is where the chain stops */
    }
  }

  /* =====================================================================
     VARIANT ONE · DIVINE CHIMERA  玉犬嵌合   (1 then 2)
     The hound is still running when the chimera is called into it, so
     what comes out has four legs and the wrong head. It does not leap
     and it does not stop: it goes the whole length, turns, and comes
     back through everything still standing.
     ================================================================== */
  var DCH = { reach: 52, speed: 36, dmg: 46, radius: 5.4 };

  function buildDivineChimera() {
    var g = new THREE.Group();
    /* the hound, as the body it runs on */
    var body = buildTotality();
    body.scale.setScalar(1.25);
    g.add(body);
    g.__legs = body.__legs;
    /* the chimera's head, on the front of it */
    var head = MG.buildSnake();
    head.scale.setScalar(1.35);
    head.position.set(0, 3.2, 3.4);
    head.__segs.forEach(function (s) { s.visible = false; });
    g.add(head);
    g.__jaw = head.__jaw;
    /* and Nue's wings, off the shoulders */
    var bird = MG.buildNue();
    bird.scale.setScalar(1.05);
    bird.position.set(0, 3.4, -1.6);
    g.add(bird);
    g.__wings = bird.__wings;
    return g;
  }
  GD.buildDivineChimera = buildDivineChimera;

  function runDivineChimera(from, dir, ghost) {
    var g = buildDivineChimera();
    g.position.copy(from); g.position.y = 0;
    g.rotation.y = Math.atan2(dir.x, dir.z);
    scene.add(g);
    MG.pets.push(g);
    var hitOnce = [];
    var to = from.clone().addScaledVector(dir, DCH.reach);
    var back = from.clone().addScaledVector(dir, -6);
    var t = 0, bound = 0, leg = 0, turned = false, phase = 0;
    var stop = crackle(function () { return g.position.clone(); },
      function () { return phase < 2; });

    function sweep(power, list) {
      if (ghost) return;
      enemies.forEach(function (e) {
        if (!e || e.dead || list.indexOf(e) >= 0) return;
        if (e.pos.distanceTo(g.position) > DCH.radius) return;
        list.push(e);
        var kb = e.pos.clone().sub(g.position).setY(0);
        if (kb.lengthSq() < .01) kb.copy(dir);
        kb.normalize().multiplyScalar(15); kb.y = 15;
        e.damage(DCH.dmg * power, kb, {
          react: 'blow', reactDur: .9, spark: ARC2, stun: .9,
          bleed: true, death: 'dice' });
        FX.impact(e.pos.clone().add(new THREE.Vector3(0, 2, 0)), 0xffffff, 3);
        FX.slash(e.pos.clone().add(new THREE.Vector3(0, 2, 0)), dir, 0xe8ecf5, 7, .18);
        arcTree(e.pos.clone().add(new THREE.Vector3(0, 2, 0)), dir.clone(),
          { reach: 14, depth: 2, life: .28 });
        addShake(1.6);
        hitstop(.05);
      });
    }

    addFx({ t: 1e9, update: function (dt) {
      t += dt; bound += dt * 15; leg += dt * 22;
      if (typeof scene === 'undefined') return false;
      if (g.__legs) g.__legs.forEach(function (l, n) {
        l.rotation.x = Math.sin(leg + (n % 2 ? Math.PI : 0)) * 1.15;
      });
      if (g.__wings) g.__wings.forEach(function (w, i) {
        w.rotation.z = Math.sin(bound * 1.6) * .7 * (i ? -1 : 1);
      });
      if (g.__jaw) g.__jaw.rotation.x = .25 + Math.abs(Math.sin(bound)) * .3;
      if (Math.random() < dt * 26) {
        arcTree(g.position.clone().add(new THREE.Vector3(0, 2.4, 0)),
          dir.clone().multiplyScalar(phase ? 1 : -1),
          { reach: 9, depth: 2, life: .2 });
      }

      if (phase === 0) {                       /* down the lane */
        g.position.addScaledVector(dir, DCH.speed * dt);
        g.position.y = Math.abs(Math.sin(bound)) * .9;
        sweep(1, hitOnce);
        if (g.position.distanceTo(from) >= DCH.reach) {
          phase = 1;
          turned = t;
          FX.speedRing(g.position.clone().add(new THREE.Vector3(0, 2, 0)), ARC, 16, .3);
          FX.dust(new THREE.Vector3(g.position.x, 0, g.position.z), 12, 0xcfd6e6, 14, 4);
          addShake(1.4);
        }
        return true;
      }
      if (phase === 1) {                       /* the turn */
        var k = Math.min(1, (t - turned) / .34);
        g.rotation.y = Math.atan2(dir.x, dir.z) + Math.PI * k;
        if (k >= 1) { phase = 2; hitOnce = []; }
        return true;
      }
      /* and back through it */
      g.position.addScaledVector(dir, -DCH.speed * 1.15 * dt);
      g.position.y = Math.abs(Math.sin(bound)) * .9;
      sweep(.75, hitOnce);
      if (g.position.distanceTo(back) < 2.5 || t > 4.5) {
        stop.stop();
        MG.dismiss(g, g.position.clone().add(new THREE.Vector3(0, 2, 0)));
        return false;
      }
      return true;
    } });
    return g;
  }

  function castDivineChimera() {
    if (!ready('gv1')) return;
    cds.ga2 = GCD.ga2;
    start('gv1', 1.5, 'gv1', 'DIVINE CHIMERA', '玉犬嵌合');
    player.action.dir = aim();
    player.iframes = Math.max(player.iframes, .8);
    FX.flash('#cfeeff', .3, .22);
    try { sfx.raise(); } catch (e) {}
  }
  function stepDivineChimera(a, dt) {
    var p = player, d = a.dir;
    var at = p.pos.clone().addScaledVector(d, 6);
    if (a.t < .55) {
      if (!a.pool) {
        a.pool = MG.pool(at.clone(), 11, 1.1);
        /* two shadows opening into one, which is the whole move */
        for (var i = -1; i <= 1; i += 2) {
          arcTree(at.clone().add(new THREE.Vector3(i * 3.4, .8, 0)),
            new THREE.Vector3(-i, .7, 0), { reach: 16, depth: 3, life: .5 });
        }
        addShake(1.3);
      }
      return;
    }
    if (a.stage < 1) {
      a.stage = 1;
      FX.speedRing(at.clone().add(new THREE.Vector3(0, 2, 0)), ARC2, 18, .38);
      FX.flash('#dff4ff', .4, .24);
      addShake(2);
      hitstop(.09);
      runDivineChimera(at.clone(), d.clone());
      /* a variant thrown on 2 still counts as a 2, so 3 opens next */
      armLink('ga2');
    }
  }

  /* =====================================================================
     VARIANT TWO · GREAT MAW  嵌合蝦蟇   (2 then 3)
     The chimera called into the toad. It keeps the wings and the jaws
     and it gains the mouth, and a mouth that size does not bite — it
     takes them off the floor, brings them up, and shuts.
     ================================================================== */
  var MAW = { reach: 30, dmg: 56, lift: 15, dur: 2.6 };

  function buildMaw() {
    var g = new THREE.Group();
    var body = buildToad();
    body.scale.setScalar(1.7);
    g.add(body);
    g.__jaw = body.__jaw;
    g.__tongue = body.__tongue;
    g.__mouthOf = body;
    /* the serpent's head inside the mouth, which is what actually bites */
    var head = MG.buildSnake();
    head.scale.setScalar(1.1);
    head.position.set(0, 3.4, 3.2);
    head.__segs.forEach(function (s) { s.visible = false; });
    g.add(head);
    g.__inner = head.__jaw;
    /* and the wings, so it is still the chimera underneath */
    var bird = MG.buildNue();
    bird.scale.setScalar(1.5);
    bird.position.set(0, 5.4, -3.4);
    g.add(bird);
    g.__wings = bird.__wings;
    return g;
  }
  GD.buildMaw = buildMaw;

  function callMaw(at, dir, ghost) {
    var g = buildMaw();
    g.position.set(at.x, -12, at.z);
    g.rotation.y = Math.atan2(dir.x, dir.z);
    scene.add(g);
    MG.pets.push(g);
    var mouth = function () {
      return g.position.clone().add(new THREE.Vector3(0, 4.6, 0)).addScaledVector(dir, 5.4);
    };
    var t = 0, phase = 0, caught = null, flap = 0;
    var stop = crackle(function () { return g.position.clone().add(new THREE.Vector3(0, 3, 0)); },
      function () { return t < MAW.dur; });

    addFx({ t: MAW.dur + 1.2, update: function (dt) {
      this.t -= dt; t += dt; flap += dt * 9;
      if (typeof scene === 'undefined') return false;
      if (g.__wings) g.__wings.forEach(function (w, i) {
        w.rotation.z = Math.sin(flap) * .55 * (i ? -1 : 1);
      });
      if (t < .45) {                            /* it comes up */
        g.position.y = -12 + E.out(t / .45) * 12;
        if (Math.random() < dt * 60) MG.wisp(g.position.clone().add(new THREE.Vector3(0, 4, 0)), 1);
        return true;
      }
      g.position.y = 0;

      if (phase === 0) {                        /* the tongue goes out */
        phase = 1;
        g.__jaw.rotation.x = 1.1;
        if (g.__inner) g.__inner.rotation.x = .6;
        FX.impact(mouth(), 0xffffff, 3.4);
        FX.speedRing(mouth(), ARC2, 16, .34);
        addShake(1.8);
        try { sfx.whoosh(); } catch (e) {}
        caught = ghost ? null : inLane(g.position.clone(), dir, MAW.reach, 8);
        var end = caught ? caught.pos.clone().add(new THREE.Vector3(0, 1.6, 0))
                         : g.position.clone().addScaledVector(dir, MAW.reach).add(new THREE.Vector3(0, 1.6, 0));
        tongueTo(g, mouth(), end);
        for (var i = 0; i < 4; i++) {
          arcTree(end.clone(), new THREE.Vector3((Math.random() - .5), .6, (Math.random() - .5)),
            { reach: 12, depth: 2, life: .3 });
        }
        return true;
      }

      if (phase === 1) {                        /* up, and in */
        var want = mouth();
        if (caught && !caught.dead) {
          caught.anchorT = .3;
          caught.anchorPos.copy(want);
          caught.pos.lerp(want, Math.min(1, dt * 11));
          caught.vel.set(0, 0, 0);
          caught.stunT = Math.max(caught.stunT || 0, .5);
          tongueTo(g, want, caught.pos.clone().add(new THREE.Vector3(0, 1.6, 0)));
          if (Math.random() < dt * 20) FX.blood(caught.pos.clone().add(new THREE.Vector3(0, 2, 0)),
            dir.clone().negate(), 3, .8);
          if (caught.pos.distanceTo(want) < 4.4 || t > .95) phase = 2;
        } else if (t > .95) phase = 2;
        return true;
      }

      if (phase === 2) {                        /* and it shuts */
        phase = 3;
        g.__jaw.rotation.x = 0;
        if (g.__inner) g.__inner.rotation.x = 0;
        tongueIn(g);
        var at2 = mouth();
        FX.flash('#dff4ff', .55, .28);
        FX.impact(at2, 0xffffff, 4.4);
        FX.cross(at2, ARC2, 11, .3);
        FX.blood(at2, new THREE.Vector3(0, -1, 0), 22, 2.6);
        FX.mangaLines(1, .32);
        addShake(3.6);
        hitstop(.2);
        try { sfx.redBoom(); } catch (e) {}
        for (var b = 0; b < 8; b++) {
          arcTree(at2.clone(), new THREE.Vector3(Math.cos(b / 8 * TAU), .3, Math.sin(b / 8 * TAU)),
            { reach: 22, depth: 3, life: .45 });
        }
        if (caught && !caught.dead) {
          caught.anchorT = 0;
          caught.damage(MAW.dmg, new THREE.Vector3(0, -20, 0), {
            react: 'blow', reactDur: 1.1, spark: 0xffffff, stun: 1.1,
            bleed: true, death: 'dice' });
        }
        if (!ghost) {
          enemiesNear(g.position.clone().addScaledVector(dir, 5), 9).forEach(function (e) {
            if (!e || e.dead || e === caught) return;
            e.damage(MAW.dmg * .4, dir.clone().multiplyScalar(12).setY(10), {
              react: 'blow', reactDur: .6, spark: ARC2, bleed: true, death: 'sever' });
          });
        }
        return true;
      }

      if (t < MAW.dur) return true;
      stop.stop();
      if (caught) caught.anchorT = 0;
      MG.dismiss(g, g.position.clone().add(new THREE.Vector3(0, 4, 0)));
      return false;
    } });
    return g;
  }

  function castMaw() {
    if (!ready('gv2')) return;
    cds.ga3 = GCD.ga3;
    /* same rule as the toad: the maw shuts inside its own cast */
    start('gv2', 2.5, 'gv2', 'GREAT MAW', '嵌合蝦蟇');
    player.action.dir = aim();
    player.iframes = Math.max(player.iframes, 1);
    FX.letterbox(true);
    later(3200, function () { FX.letterbox(false); });
    try { sfx.raise(); } catch (e) {}
  }
  function stepMaw(a, dt) {
    var p = player, d = a.dir;
    var at = besideHim(p.pos, d, 13, 8);
    if (a.t < .7) {
      if (!a.pool) {
        a.pool = MG.pool(at.clone(), 13, 1.4);
        FX.cracks(new THREE.Vector3(at.x, .05, at.z), 12, 18, 0x101020);
        addShake(1.4);
      }
      /* the two of them going in, from either side */
      if (Math.random() < .5) {
        arcTree(at.clone().add(new THREE.Vector3((Math.random() - .5) * 7, .6, (Math.random() - .5) * 7)),
          new THREE.Vector3(0, 1, 0), { reach: 14, depth: 2, life: .3 });
      }
      return;
    }
    if (a.stage < 1) {
      a.stage = 1;
      FX.flash('#dff4ff', .45, .26);
      addShake(2.2);
      hitstop(.1);
      callMaw(at.clone(), laneFrom(at, p.pos, d));
      clearLink();                 /* the end of the chain */
    }
  }

  /* =====================================================================
     MAHORAGA  八握剣異戒神将魔虚羅
     Not on the bar any more. He is what the DOMAIN calls — which is
     where he comes from in the first place — so the model and the three
     escalating strikes live on for the garden and for its finisher.
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
        try { sfx.redBoom(); } catch (e) {}
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

  GD.callMahoraga = callMahoraga;

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
    GD.called = false;
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
    GD.called = false;
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

    /* AND THE THING THE GARDEN IS FOR. Mahoraga is not on the bar — he
       is what this calls, which is where he comes from. Four seconds in,
       once, on both screens, and his three strikes land on whoever is
       still standing on the shadow. */
    if (!GD.called && GD.t > 4) {
      GD.called = true;
      var mAt = c.clone().addScaledVector(dirOf(GD.yaw), 12);
      MG.pool(new THREE.Vector3(mAt.x, 0, mAt.z), 12, 1.4);
      FX.cracks(new THREE.Vector3(mAt.x, .05, mAt.z), 16, 22, 0x2a0410);
      FX.flash('#bfeaff', .5, .34);
      addShake(2.6);
      try { showSplash('', '八握剣異戒神将魔虚羅', '#9fe8ff'); } catch (e) {}
      later(500, function () {
        if (GD.on) callMahoraga(mAt.clone(), dirOf(GD.yaw + Math.PI), !!GD.remote);
      });
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
      case 'ga3': {              // the toad: one hand out, and the tongue goes
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
      /* A merge is two hands brought together and then one thing sent —
         both variants read as that, and they differ in what he does at
         the end: one throws it away from him, one shuts his fist. */
      case 'gv1': {                          // brought together, then thrown
        rp(r);
        var mm = out(Math.min(1, t / .55));
        var thr = t > .55 ? out(Math.min(1, (t - .55) / .22)) : 0;
        r.shoulderL.rotation.x = -1.35 * mm - .9 * thr;
        r.shoulderR.rotation.x = -1.35 * mm - .9 * thr;
        r.shoulderL.rotation.z = 1.25 * mm - 1.15 * thr;
        r.shoulderR.rotation.z = -1.25 * mm + 1.15 * thr;
        r.elbowL.rotation.x = -1.1 * mm + 1.0 * thr;
        r.elbowR.rotation.x = -1.1 * mm + 1.0 * thr;
        r.spine.rotation.x = .3 * mm - .74 * thr;
        r.neck.rotation.x = .12 * mm - .44 * thr;
        r.hipL.rotation.x = -.52 * mm + .3 * thr; r.kneeL.rotation.x = .95 * mm - .5 * thr;
        r.hipR.rotation.x = .36 * mm; r.kneeR.rotation.x = .6 * mm;
        r.hips.position.y = r.hipsBaseY - .52 * mm + .4 * thr;
        return true;
      }
      case 'gv2': {                          // opened wide, and then shut
        rp(r);
        var op2 = out(Math.min(1, t / .7));
        var sh2 = t > .7 ? out(Math.min(1, (t - .7) / .26)) : 0;
        r.shoulderL.rotation.x = -1.6 * op2 + .5 * sh2;
        r.shoulderR.rotation.x = -1.6 * op2 + .5 * sh2;
        r.shoulderL.rotation.z = 1.45 * op2 - 1.2 * sh2;
        r.shoulderR.rotation.z = -1.45 * op2 + 1.2 * sh2;
        r.elbowL.rotation.x = -.14 - 1.2 * sh2;
        r.elbowR.rotation.x = -.14 - 1.2 * sh2;
        r.spine.rotation.x = -.24 * op2 + .5 * sh2;
        r.neck.rotation.x = -.4 * op2 + .5 * sh2;
        r.hipL.rotation.x = -.3 * op2; r.kneeL.rotation.x = .5 * op2 + .3 * sh2;
        r.hipR.rotation.x = -.24 * op2; r.kneeR.rotation.x = .42 * op2 + .3 * sh2;
        r.hips.position.y = r.hipsBaseY - .22 * op2 - .3 * sh2;
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
  /* `base` and `baseCd` are what the slot says when nothing is open on
     it — showLink swaps `lbl` and `cd` over to the merge and back */
  var BASE_MOVES = CHARS.megumi.moves.slice();
  var AW_MOVES = [
    { key: 'LMB', lbl: 'Punch', base: 'Punch', cd: 'm1', baseCd: 'm1', max: .3 },
    { key: 'Q', lbl: 'Dash', base: 'Dash', cd: 'dash', baseCd: 'dash', max: 1 },
    { key: '1', lbl: 'Totality', base: 'Totality', cd: 'ga1', baseCd: 'ga1', max: GCD.ga1 },
    { key: '2', lbl: 'Chimera', base: 'Chimera', cd: 'ga2', baseCd: 'ga2', max: GCD.ga2 },
    { key: '3', lbl: 'Toad', base: 'Toad', cd: 'ga3', baseCd: 'ga3', max: GCD.ga3 },
    { key: '4', lbl: 'Shadow Garden', base: 'Shadow Garden', cd: 'gdom', baseCd: 'gdom', max: GCD.gdom },
    { key: 'R', lbl: 'Rabbit Escape', base: 'Rabbit Escape', cd: 'mgr', baseCd: 'mgr', max: 9 }
  ];
  var barOn = false;
  function swapBar(on) {
    if (on === barOn) return;
    barOn = on;
    if (!on) { GD.link = null; showLink(null); }
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
        /* the merge window, which shuts on its own */
        if (GD.link) {
          GD.link.t -= dt;
          if (GD.link.t <= 0) clearLink();
        }
        if (AW.megumiT <= 0) endAwaken(false);
      }
    } else if (GD.link) clearLink();
    return _updatePlayer(dt);
  };

  /* --------------------------------------------------------------- wiring */
  var _stepAction = stepAction;
  stepAction = function (a, dt) {
    switch (a.type) {
      case 'gaw': return stepAwaken(a, dt);
      case 'ga1': return stepTotality(a, dt);
      case 'ga2': return stepChimera(a, dt);
      case 'ga3': return stepToad(a, dt);
      case 'gv1': return stepDivineChimera(a, dt);
      case 'gv2': return stepMaw(a, dt);
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
    /* 2 and 3 throw the merge when one is open, and the plain one when it
       is not — the key does not change, what is on the end of it does */
    if (e.code === 'Digit1') castTotality();
    else if (e.code === 'Digit2') (merged('ga1') ? castDivineChimera : castChimera)();
    else if (e.code === 'Digit3') (merged('ga2') ? castMaw : castToad)();
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
      var d = dirOf(yaw), at = besideHim(pos, d, 8, 5);
      MG.pool(at.clone(), 8, .9);
      later(470, function () {
        FX.speedRing(at.clone().add(new THREE.Vector3(0, 1.6, 0)), ARC2, 12, .32);
        callToad(at.clone(), laneFrom(at, pos, d), true);
      });
    },
    gv1: function (pos, yaw) {
      var d = dirOf(yaw), at = pos.clone().addScaledVector(d, 6);
      MG.pool(at.clone(), 11, 1.1);
      later(580, function () {
        FX.speedRing(at.clone().add(new THREE.Vector3(0, 2, 0)), ARC2, 18, .38);
        FX.flash('#dff4ff', .3, .2);
        runDivineChimera(at.clone(), d.clone(), true);
      });
    },
    gv2: function (pos, yaw) {
      var d = dirOf(yaw), at = besideHim(pos, d, 13, 8);
      MG.pool(at.clone(), 13, 1.4);
      FX.cracks(new THREE.Vector3(at.x, .05, at.z), 12, 18, 0x101020);
      later(730, function () { callMaw(at.clone(), laneFrom(at, pos, d), true); });
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
  GD.tongueAt = tongueTo;
  GD.tongueIn = tongueIn;
  GD.buildTotality = buildTotality;
  GD.buildChimera = buildChimera;
  GD.buildMahoraga = buildMahoraga;
  GD.ARC = ARC; GD.ARC2 = ARC2; GD.GRID = GRID;
})();
