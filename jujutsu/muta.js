/* =======================================================================
   KOKICHI MUTA  —  MECHAMARU
   Puppet Manipulation 傀儡操術. The body on the screen is his real one:
   small, thin, barefoot, wrapped in bandages and a uniform four sizes too
   big, with a plate where a face should be. It is not what fights.

   What fights is machinery, and the machinery is not there until he
   builds it. So every move in this file is the same three beats —

     · the parts fly in from nowhere and LOCK, one snap at a time
     · the thing does exactly one thing, and it is a heavy one
     · and then it comes apart, because he never keeps any of it

   which means he barely moves, and the frame is full anyway.

     1  ARM CANNON        腕砲 — one barrel, one shell
     2  ROCKET PUNCH      拳射出 — the fist leaves on a chain and is
                          reeled back in
     3  DRILL ARM         削岩 — it does not hit them, it goes IN
     4  MISSILE POD       弾幕 — a shoulder rack, and eight of them
     R  ULTRA SPIN        超高速回転 — the special. The whole frame comes
                          together around him and turns

   One to four are four ordinary pieces of ordnance of about the same
   weight. The big one is on R, where a special belongs.

   The look: gunmetal and iron, with copper at the joints, a warning
   yellow on anything that is about to move, and ONE hot colour — the
   orange of an exhaust — used nowhere except where something is firing.
   ===================================================================== */
(function () {
  'use strict';
  if (typeof player === 'undefined' || typeof THREE === 'undefined') return;
  var FX = window.JJFX;
  if (!FX || typeof CHARS === 'undefined') return;
  var AN = window.JJANIM;
  var E = FX.ease;
  var TAU = Math.PI * 2;

  var IRON = 0x2e343b, GUN = 0x4a5058, STEEL = 0x8a939c, PALE = 0xc3cad1;
  var COP = 0xb2793f, COP_D = 0x7a5028, WARN = 0xd8c24a;
  var HOT = 0xff8a3d, FLASH = 0xfff0d0, LENS = 0x6fd8e0;
  /* the real body: a navy uniform, bandages, and the plate */
  var CLOTH = 0x434d78, CLOTH_D = 0x2f375c, WRAP = 0xe6e2d4, PLATE = 0xb59a76;

  var MU = window.JJMUTA = { rigs: [] };

  var KCD = { k1: 7, k2: 7, k3: 8, k4: 9, kr: 18 };

  var MUTA_CFG = {
    muta: true, face: false,
    torso: CLOTH, pants: CLOTH, shoes: 0x6b5a48, skin: 0x8f6f52
  };

  /* ---------------------------------------------------------------- rig
     Out of the reference: a plate face with two round holes and a seam
     across it, a bandage collar swallowing the neck, a navy top with
     sleeves that hang past the wrists, bandages at the waist, and
     trousers so wide they hide the legs entirely. Bare feet.
     ================================================================== */
  var _makeAnimeRig = makeAnimeRig;
  makeAnimeRig = function (cfg) {
    var r = _makeAnimeRig(cfg);
    if (!cfg || !cfg.muta) return r;
    var head = r.head, spine = r.spine, hips = r.hips;

    function box(w, h, d, c, basic) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), basic
        ? new THREE.MeshBasicMaterial({ color: c, toneMapped: false })
        : new THREE.MeshStandardMaterial({ color: c, roughness: .84 }));
      m.castShadow = !basic;
      return m;
    }
    var i, s;

    /* THE FACE. A plate, not a head: flat, seamed across, with two round
       holes and nothing behind them. */
    var mask = box(1.0, 1.0, .18, PLATE); mask.position.set(0, .52, .44); head.add(mask);
    var brow = box(1.02, .12, .2, 0x8a6f52); brow.position.set(0, .92, .44); head.add(brow);
    var seam = box(1.02, .07, .21, 0x6d573f); seam.position.set(0, .58, .45); head.add(seam);
    for (s = -1; s <= 1; s += 2) {
      var rim = box(.3, .3, .1, 0x6d573f); rim.position.set(.22 * s, .62, .53); head.add(rim);
      var hole = box(.2, .2, .08, 0x120f0c, true); hole.position.set(.22 * s, .62, .56); head.add(hole);
      var spark = box(.08, .08, .06, LENS, true); spark.position.set(.22 * s, .62, .59); head.add(spark);
    }
    /* the mouth: a row of set teeth, which is the only expression he has */
    var jaw = box(.72, .22, .18, 0x6d573f); jaw.position.set(0, .26, .46); head.add(jaw);
    for (i = 0; i < 6; i++) {
      var th = box(.09, .16, .06, 0xd8d0c0);
      th.position.set(-.25 + i * .1, .26, .55);
      head.add(th);
    }
    /* the skull behind it, plain and small */
    var cap = box(.86, .5, .84, 0xa18a68); cap.position.set(0, .78, -.06); head.add(cap);
    /* the bandage collar, thick enough to swallow the neck */
    for (i = 0; i < 4; i++) {
      var band = box(1.18 - i * .08, .17, 1.1 - i * .08, i % 2 ? WRAP : 0xcfcab8);
      band.position.set(0, 1.3 + i * .15, .02);
      band.rotation.y = i * .3;
      spine.add(band);
    }

    /* the top: oversized, square, and hanging off him */
    var body = box(1.5, 1.4, .9, CLOTH); body.position.set(0, .66, 0); spine.add(body);
    var yoke = box(1.56, .3, .96, CLOTH_D); yoke.position.set(0, 1.12, 0); spine.add(yoke);
    var badge = box(.11, .11, .06, WARN); badge.position.set(.46, .86, .47); spine.add(badge);
    var fold = box(.06, 1.0, .05, CLOTH_D); fold.position.set(-.1, .62, .46); spine.add(fold);
    /* the bandages at the waist */
    for (i = 0; i < 3; i++) {
      var wb = box(1.58 - i * .04, .21, .98 - i * .03, i % 2 ? WRAP : 0xcfcab8);
      wb.position.set(0, -.04 - i * .19, 0);
      wb.rotation.z = (i % 2 ? .04 : -.04);
      spine.add(wb);
    }
    /* sleeves that go past the hand */
    var arms = [[r.shoulderL, r.elbowL], [r.shoulderR, r.elbowR]];
    for (i = 0; i < arms.length; i++) {
      var up1 = box(.56, 1.02, .56, CLOTH); up1.position.set(0, -.5, 0); arms[i][0].add(up1);
      var lo = box(.58, 1.0, .58, CLOTH); lo.position.set(0, -.5, 0); arms[i][1].add(lo);
      var cuff = box(.62, .2, .62, CLOTH_D); cuff.position.set(0, -1.0, 0); arms[i][1].add(cuff);
    }
    /* and trousers wide enough to hide the legs */
    var skirt = box(1.5, 1.5, 1.1, CLOTH); skirt.position.set(0, -.1, 0); hips.add(skirt);
    var legs = [[r.hipL, r.kneeL, r.ankleL], [r.hipR, r.kneeR, r.ankleR]];
    for (i = 0; i < legs.length; i++) {
      var thigh = box(.86, 1.2, .86, CLOTH); thigh.position.set(0, -.6, 0); legs[i][0].add(thigh);
      var shin = box(.9, 1.1, .9, CLOTH); shin.position.set(0, -.5, 0); legs[i][1].add(shin);
      var hem = box(.94, .16, .94, CLOTH_D); hem.position.set(0, -1.0, 0); legs[i][1].add(hem);
      /* bare feet, which is the detail that makes the rest of it sad */
      var foot = box(.4, .2, .7, 0x8f6f52); foot.position.set(0, -.06, .12); legs[i][2].add(foot);
    }
    return r;
  };

  CHARS.muta = {
    name: 'KOKICHI MUTA', sub: 'MECHAMARU — PUPPET MANIPULATION',
    cfg: MUTA_CFG, glow: '#d8c24a',
    moves: [
      { key: 'LMB', lbl: 'Punch', cd: 'm1', max: .3 },
      { key: 'Q', lbl: 'Dash', cd: 'dash', max: 1 },
      { key: '1', lbl: 'Arm Cannon', cd: 'k1', max: KCD.k1 },
      { key: '2', lbl: 'Rocket Punch', cd: 'k2', max: KCD.k2 },
      { key: '3', lbl: 'Drill Arm', cd: 'k3', max: KCD.k3 },
      { key: '4', lbl: 'Missile Pod', cd: 'k4', max: KCD.k4 },
      { key: 'R', lbl: 'Ultra Spin', cd: 'kr', max: KCD.kr }
    ]
  };
  try { CHARS.muta.portrait = makePortrait(MUTA_CFG); } catch (e) {}
  try { buildCharList(); } catch (e) {}

  cds.k1 = 0; cds.k2 = 0; cds.k3 = 0; cds.k4 = 0; cds.kr = 0;

  /* --------------------------------------------------------------- help */
  function ready(key) {
    return player.char === 'muta' && !player.dead && !busy() && cds[key] <= 0 &&
      !player.react && !(window.JJNAOYA && window.JJNAOYA.busy());
  }
  function start(type, dur, key, name, sub) {
    cds[key] = KCD[key];
    player.action = { type: type, t: 0, dur: dur, stage: 0 };
    if (name) { try { showSplash(name, sub || '', '#d8c24a'); } catch (e) {} }
    return player.action;
  }
  function aim() {
    return new THREE.Vector3(Math.sin(player.facing), 0, Math.cos(player.facing));
  }
  function rp(r) { resetPose(r); if (r.body) r.body.rotation.set(0, 0, 0); }
  function later(ms, fn) {
    setTimeout(function () { if (typeof scene !== 'undefined') fn(); }, ms);
  }
  function part(g, w, h, d, x, y, z, c) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color: c, roughness: .62, metalness: .35, flatShading: true }));
    m.position.set(x, y, z);
    m.castShadow = Math.max(w, h, d) > 1;
    g.add(m);
    return m;
  }
  function keep(o) { MU.rigs.push(o); return o; }
  function drop(o) {
    if (!o) return;
    var i = MU.rigs.indexOf(o);
    if (i >= 0) MU.rigs.splice(i, 1);
    if (o.parent) o.parent.remove(o); else scene.remove(o);
    o.traverse(function (c) {
      if (c.isMesh) { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); }
    });
  }
  function nearest(range, cone) {
    var d = aim(), best = null, near = range || 30;
    for (var i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      if (!e || e.dead) continue;
      var to = e.pos.clone().sub(player.pos); to.y = 0;
      var dist = to.length();
      if (dist < .5 || dist > near) continue;
      if (to.normalize().dot(d) < (cone == null ? .1 : cone)) continue;
      near = dist; best = e;
    }
    return best;
  }

  /* =====================================================================
     ASSEMBLY
     Nothing of his exists until it is built, and the building is half the
     move. Each part starts scattered and arrives on its own frame with a
     snap and a spark, so a piece of machinery clatters together rather
     than fading in.
     ================================================================== */
  function assemble(g, secs) {
    var parts = [];
    g.children.forEach(function (c) {
      if (!c.isMesh) return;
      parts.push({ m: c, to: c.position.clone(), rot: c.rotation.clone() });
    });
    /* throw them out to where they came from */
    parts.forEach(function (p2) {
      var a = Math.random() * TAU, r = 4 + Math.random() * 5;
      p2.from = p2.to.clone().add(new THREE.Vector3(
        Math.cos(a) * r, (Math.random() - .3) * 7, Math.sin(a) * r));
      p2.m.position.copy(p2.from);
      p2.m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      p2.at = Math.random() * secs * .8;
      p2.done = false;
    });
    var t = 0;
    addFx({ t: 1e9, update: function (dt) {
      t += dt;
      if (typeof scene === 'undefined' || !g.parent) return false;
      var all = true;
      parts.forEach(function (p2) {
        if (p2.done) return;
        var k = (t - p2.at) / (secs * .3);
        if (k < 0) { all = false; return; }
        if (k >= 1) {
          p2.m.position.copy(p2.to);
          p2.m.rotation.copy(p2.rot);
          if (!p2.done) {
            p2.done = true;
            /* the snap */
            var w = new THREE.Vector3();
            p2.m.getWorldPosition(w);
            if (Math.random() < .5) FX.mote(w, WARN, .9, .14);
          }
          return;
        }
        all = false;
        var ea = E.out(k);
        p2.m.position.lerpVectors(p2.from, p2.to, ea);
        p2.m.rotation.set(
          p2.rot.x + (1 - ea) * 3, p2.rot.y + (1 - ea) * 3, p2.rot.z + (1 - ea) * 3);
      });
      return !all || t < secs;
    } });
  }
  MU.assemble = assemble;

  /* and the other half: he never keeps any of it */
  function scrap(g, at) {
    var here = at || g.position.clone();
    var parts = [];
    g.children.forEach(function (c) { if (c.isMesh) parts.push(c); });
    sparks(here.clone(), 14);
    FX.debris(new THREE.Vector3(here.x, .1, here.z), 10, 12, GUN);
    parts.forEach(function (m) {
      var v = new THREE.Vector3((Math.random() - .5), Math.random() * .8 + .2, (Math.random() - .5))
        .normalize().multiplyScalar(9 + Math.random() * 9);
      var spin = new THREE.Vector3(Math.random() * 12, Math.random() * 12, Math.random() * 12);
      addFx({ t: 1.3, update: function (dd) {
        this.t -= dd;
        v.y -= 40 * dd;
        m.position.addScaledVector(v, dd);
        m.rotation.x += spin.x * dd; m.rotation.y += spin.y * dd; m.rotation.z += spin.z * dd;
        if (this.t <= 0) return false;
        return true;
      } });
    });
    later(1300, function () { drop(g); });
  }
  MU.scrap = scrap;

  /* the one hot colour in the file, and it only ever means "firing" */
  function sparks(at, n) {
    for (var i = 0; i < n; i++) {
      var m = FX.billboard(FX.T.streak, i % 3 ? HOT : FLASH, 1);
      var a = Math.random() * TAU, e2 = Math.random() * 1.2 - .2;
      var to = at.clone().add(new THREE.Vector3(
        Math.cos(a) * (2 + Math.random() * 4), e2 * 3, Math.sin(a) * (2 + Math.random() * 4)));
      var len = FX.orientAlong(m, at, to);
      m.scale.set(len, Math.max(.1, len * .07), 1);
      scene.add(m);
      (function (m) {
        var life = .2 + Math.random() * .2, t = life;
        addFx({ t: life, update: function (dd) {
          this.t -= dd;
          m.material.opacity = Math.max(0, this.t / life);
          if (this.t <= 0) { scene.remove(m); m.material.dispose(); return false; }
          return true;
        } });
      })(m);
    }
  }
  MU.sparks = sparks;

  /* the exhaust behind anything that fires */
  function exhaust(at, dir, n) {
    FX.dust(at.clone(), n || 7, 0x9aa0a8, 6, 3);
    for (var i = 0; i < 3; i++) {
      FX.mote(at.clone().addScaledVector(dir, -i * .8), i ? HOT : FLASH, 2 - i * .4, .22);
    }
  }

  /* a shared bracket: the plate-and-rivet look every build shares */
  function plated(g, w, h, d, x, y, z, c) {
    var m = part(g, w, h, d, x, y, z, c == null ? GUN : c);
    var n = Math.max(2, Math.min(4, Math.round(Math.max(w, h) * 2)));
    for (var i = 0; i < n; i++) {
      part(g, .1, .1, .1, x - w * .4 + (w * .8) * (i / (n - 1 || 1)), y + h * .42, z + d * .5, COP);
    }
    return m;
  }

  /* =====================================================================
     1 · ARM CANNON  腕砲
     One barrel, built beside his shoulder, and one shell.
     ================================================================== */
  var CAN = { dmg: 32, reach: 34, radius: 5.5, speed: 78 };

  function buildCannon() {
    var g = new THREE.Group();
    plated(g, 1.5, 1.5, 4.2, 0, 0, 0, GUN);            // the receiver
    plated(g, 1.1, 1.1, 3.0, 0, 0, 3.2, IRON);          // the barrel
    part(g, 1.35, 1.35, .5, 0, 0, 4.7, STEEL);           // the muzzle brake
    for (var i = 0; i < 3; i++) {
      part(g, 1.5, .16, .3, 0, .68, 1.0 + i * .9, WARN);
    }
    part(g, .5, .5, 1.6, -.9, -.2, 1.4, COP);            // the recoil rod
    part(g, .5, .5, 1.6, .9, -.2, 1.4, COP);
    plated(g, 1.7, .8, 1.2, 0, -.9, -1.4, IRON);         // the mount
    return g;
  }
  MU.buildCannon = buildCannon;

  function fireShell(from, dir, ghost) {
    var s = new THREE.Group();
    part(s, .5, .5, 1.5, 0, 0, 0, STEEL);
    part(s, .38, .38, .7, 0, 0, .9, COP);
    s.position.copy(from);
    s.rotation.y = Math.atan2(dir.x, dir.z);
    scene.add(s);
    var t = 0, gone = false;
    addFx({ t: 1e9, update: function (dt) {
      t += dt;
      if (typeof scene === 'undefined') return false;
      s.position.addScaledVector(dir, CAN.speed * dt);
      s.rotation.z += dt * 22;
      if (Math.random() < dt * 40) FX.mote(s.position.clone(), HOT, .9, .14);
      var got = ghost ? [] : enemiesNear(s.position.clone(), 3);
      if (!gone && (got.length || t > CAN.reach / CAN.speed)) {
        gone = true;
        var at = s.position.clone();
        FX.flash('#ffe7c0', .4, .2);
        FX.impact(at.clone(), FLASH, 4);
        FX.rings(at.clone(), HOT, 3, { maxR: CAN.radius * 2, life: .5, ground: false, gap: 34 });
        FX.rings(new THREE.Vector3(at.x, .12, at.z), HOT, 2, { maxR: CAN.radius * 2, life: .5, gap: 36 });
        sparks(at.clone(), 16);
        FX.debris(new THREE.Vector3(at.x, .1, at.z), 12, 14, GUN);
        FX.dust(new THREE.Vector3(at.x, 0, at.z), 10, 0x9aa0a8, 12, 4);
        addShake(2.6);
        if (typeof hitstop === 'function') hitstop(.12);
        try { sfx.redBoom(); } catch (err) {}
        if (!ghost) {
          enemiesNear(at.clone(), CAN.radius).forEach(function (e) {
            if (!e || e.dead) return;
            var kb = e.pos.clone().sub(at).setY(0);
            if (kb.lengthSq() < .01) kb.copy(dir);
            kb.normalize().multiplyScalar(20); kb.y = 15;
            e.damage(CAN.dmg, kb, {
              react: 'blow', reactDur: .8, spark: HOT, stun: .8,
              bleed: true, death: 'sever' });
          });
        }
        scene.remove(s);
        s.traverse(function (o) { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
        return false;
      }
      return true;
    } });
  }

  function castCannon() {
    if (!ready('k1')) return;
    var a = start('k1', 1.1, 'k1', 'ARM CANNON', '腕砲');
    a.dir = aim();
    player.iframes = Math.max(player.iframes, .5);
    try { sfx.whoosh(); } catch (e) {}
  }
  function stepCannon(a, dt) {
    var p = player, d = a.dir;
    p.vel.x *= .8; p.vel.z *= .8;
    var side = new THREE.Vector3(-d.z, 0, d.x);
    var at = p.pos.clone().addScaledVector(side, 1.9).add(new THREE.Vector3(0, 3.1, 0));
    if (a.stage < 1) {
      a.stage = 1;
      var g = buildCannon();
      g.position.copy(at);
      g.rotation.y = Math.atan2(d.x, d.z);
      scene.add(g);
      keep(g);
      a.gun = g;
      assemble(g, .42);
      addShake(.5);
    }
    if (a.stage < 2 && a.t > .5) {
      a.stage = 2;
      var muzzle = at.clone().addScaledVector(d, 5.2);
      FX.flash('#fff0d0', .35, .18);
      FX.impact(muzzle.clone(), FLASH, 3);
      FX.speedRing(muzzle.clone(), HOT, 9, .22);
      exhaust(at.clone().addScaledVector(d, -2), d, 9);
      sparks(muzzle.clone(), 10);
      addShake(2);
      if (typeof hitstop === 'function') hitstop(.09);
      try { sfx.redBoom(); } catch (e) {}
      fireShell(muzzle, d.clone());
      if (a.gun) { a.gun.position.addScaledVector(d, -.7); }
    }
    if (a.stage < 3 && a.t > .85) {
      a.stage = 3;
      if (a.gun) scrap(a.gun, a.gun.position.clone());
      a.gun = null;
    }
  }

  /* =====================================================================
     2 · ROCKET PUNCH  拳射出
     The fist leaves. The chain does not, which is what makes it come
     back through everything a second time.
     ================================================================== */
  var RP = { dmg: 26, reach: 26, radius: 4.2, speed: 46, back: .3 };

  function buildFist() {
    var g = new THREE.Group();
    plated(g, 2.2, 2.0, 2.4, 0, 0, 0, GUN);
    part(g, 2.3, .5, 2.5, 0, .9, 0, IRON);
    for (var i = 0; i < 4; i++) {
      part(g, .44, .5, 1.1, -.8 + i * .53, -.2, 1.5, STEEL);
      part(g, .44, .3, .4, -.8 + i * .53, -.35, 2.1, COP);
    }
    part(g, .7, .7, 1.4, -1.4, -.4, .6, STEEL);          // the thumb
    part(g, 1.2, 1.2, .6, 0, 0, -1.4, COP);              // the coupling
    return g;
  }
  MU.buildFist = buildFist;

  function chainTo(a, b) {
    var n = Math.max(3, Math.round(a.distanceTo(b) / 1.6));
    for (var i = 0; i < n; i++) {
      var k = (i + .5) / n;
      var m = FX.billboard(FX.T.streak, i % 2 ? COP : STEEL, .95);
      var p1 = a.clone().lerp(b, k - .5 / n), p2 = a.clone().lerp(b, k + .5 / n);
      var len = FX.orientAlong(m, p1, p2);
      m.scale.set(len, Math.max(.14, len * .3), 1);
      scene.add(m);
      (function (m) {
        addFx({ t: .1, update: function (dd) {
          this.t -= dd;
          if (this.t <= 0) { scene.remove(m); m.material.dispose(); return false; }
          return true;
        } });
      })(m);
    }
  }

  function throwFist(from, dir, ghost) {
    var g = buildFist();
    g.position.copy(from);
    g.rotation.y = Math.atan2(dir.x, dir.z);
    scene.add(g);
    keep(g);
    assemble(g, .2);
    var t = 0, back = false, hit = [];
    var home = from.clone();

    addFx({ t: 1e9, update: function (dt) {
      t += dt;
      if (typeof scene === 'undefined') return false;
      if (!back) {
        g.position.addScaledVector(dir, RP.speed * dt);
        if (g.position.distanceTo(home) > RP.reach) { back = true; hit = []; }
      } else {
        var to = home.clone().sub(g.position);
        g.position.addScaledVector(to.normalize(), RP.speed * 1.15 * dt);
      }
      g.rotation.z += dt * (back ? -16 : 16);
      chainTo(home.clone(), g.position.clone());
      if (Math.random() < dt * 22) FX.mote(g.position.clone(), HOT, 1, .16);
      if (!ghost) {
        enemiesNear(g.position.clone(), RP.radius).forEach(function (e) {
          if (!e || e.dead || hit.indexOf(e) >= 0) return;
          hit.push(e);
          var kb = (back ? dir.clone().negate() : dir.clone()).multiplyScalar(24); kb.y = 14;
          e.damage(back ? Math.round(RP.dmg * RP.back) : RP.dmg, kb, {
            react: 'blow', reactDur: .8, spark: HOT, stun: .7,
            bleed: true, death: 'flat' });
          FX.impact(e.pos.clone().add(new THREE.Vector3(0, 2.4, 0)), FLASH, 3.4);
          sparks(e.pos.clone().add(new THREE.Vector3(0, 2.4, 0)), 10);
          addShake(2);
          if (typeof hitstop === 'function') hitstop(.08);
        });
      }
      if (back && g.position.distanceTo(home) < 2) {
        sparks(home.clone(), 8);
        scrap(g, g.position.clone());
        return false;
      }
      return t < 3.2;
    } });
  }

  function castFist() {
    if (!ready('k2')) return;
    var a = start('k2', 1.05, 'k2', 'ROCKET PUNCH', '拳射出');
    a.dir = aim();
    player.iframes = Math.max(player.iframes, .5);
    try { sfx.whoosh(); } catch (e) {}
  }
  function stepFist(a, dt) {
    var p = player, d = a.dir;
    p.vel.x *= .8; p.vel.z *= .8;
    if (a.stage < 1 && a.t > .38) {
      a.stage = 1;
      var from = p.pos.clone().addScaledVector(d, 2.6).add(new THREE.Vector3(0, 2.9, 0));
      FX.flash('#fff0d0', .3, .16);
      FX.speedRing(from.clone(), HOT, 10, .24);
      exhaust(from.clone().addScaledVector(d, -1.6), d, 8);
      addShake(1.8);
      if (typeof hitstop === 'function') hitstop(.08);
      try { sfx.redBoom(); } catch (e) {}
      throwFist(from, d.clone());
    }
  }

  /* =====================================================================
     3 · DRILL ARM  削岩
     It does not hit them. It is put against them and left running.
     ================================================================== */
  var DR = { dmg: 34, reach: 9, ticks: 6, tick: 4, out: 11, step: 13 };

  function buildDrill() {
    var g = new THREE.Group();
    plated(g, 1.6, 1.6, 2.4, 0, 0, -1.2, GUN);
    part(g, 1.2, 1.2, .5, 0, 0, .3, COP);
    /* the flutes: four boxes twisted along the cone */
    g.__bit = new THREE.Group();
    for (var i = 0; i < 7; i++) {
      var w = 1.25 - i * .16;
      var seg = part(g.__bit, w, w, .7, 0, 0, .8 + i * .68, i % 2 ? STEEL : PALE);
      seg.rotation.z = i * .6;
    }
    part(g.__bit, .3, .3, 1.2, 0, 0, 5.9, PALE);
    g.add(g.__bit);
    for (i = 0; i < 3; i++) part(g, 1.7, .16, .3, 0, .72, -2.1 + i * .7, WARN);
    return g;
  }
  MU.buildDrill = buildDrill;

  function castDrill() {
    if (!ready('k3')) return;
    var a = start('k3', 1.5, 'k3', 'DRILL ARM', '削岩');
    a.dir = aim();
    a.n = 0;
    player.iframes = Math.max(player.iframes, .6);
    try { sfx.whoosh(); } catch (e) {}
  }
  function stepDrill(a, dt) {
    var p = player, d = a.dir;
    var side = new THREE.Vector3(-d.z, 0, d.x);
    var at = p.pos.clone().addScaledVector(side, 1.6).add(new THREE.Vector3(0, 2.7, 0));
    if (a.stage < 1) {
      a.stage = 1;
      var g = buildDrill();
      g.position.copy(at);
      g.rotation.y = Math.atan2(d.x, d.z);
      scene.add(g);
      keep(g);
      a.drill = g;
      assemble(g, .38);
      addShake(.5);
    }
    if (a.drill) {
      a.drill.position.copy(at);
      a.drill.rotation.y = Math.atan2(d.x, d.z);
      if (a.drill.__bit && a.t > .4) a.drill.__bit.rotation.z += dt * 34;
    }
    if (a.t < .42) { p.vel.x *= .7; p.vel.z *= .7; return; }
    /* he walks it forward and it stays on them */
    if (a.t < 1.15) {
      p.vel.x = d.x * DR.step; p.vel.z = d.z * DR.step;
      var tip = at.clone().addScaledVector(d, 6);
      if (Math.random() < dt * 26) sparks(tip.clone(), 3);
      if (a.n < DR.ticks && a.t > .48 + a.n * .11) {
        a.n++;
        /* the drill is held out to one side, but what it is being put
           against is whatever is in front of HIM — searching from the
           tip meant everybody on his other shoulder was never touched */
        var got = enemiesNear(
          p.pos.clone().addScaledVector(d, 5).add(new THREE.Vector3(0, 2.4, 0)),
          DR.reach, d, .1);
        if (got.length) {
          FX.impact(tip.clone(), FLASH, 1.8);
          sparks(tip.clone(), 8);
          addShake(.9);
          got.forEach(function (e) {
            if (!e || e.dead) return;
            e.damage(DR.tick, null, {
              react: null, spark: HOT, noFrameBonus: true, bleed: true, death: 'gone' });
            FX.blood(e.pos.clone().add(new THREE.Vector3(0, 2.4, 0)), d, 5, 1.2);
          });
        }
      }
      return;
    }
    p.vel.x *= .6; p.vel.z *= .6;
    if (a.stage < 2) {
      a.stage = 2;
      /* it comes out the far side, and then it is finished with */
      var tip2 = at.clone().addScaledVector(d, 6);
      FX.flash('#fff0d0', .35, .2);
      FX.impact(tip2.clone(), FLASH, 3.6);
      sparks(tip2.clone(), 16);
      FX.debris(new THREE.Vector3(tip2.x, .1, tip2.z), 10, 12, GUN);
      FX.mangaLines(.7, .24);
      addShake(2.6);
      if (typeof hitstop === 'function') hitstop(.14);
      try { sfx.redBoom(); } catch (e) {}
      enemiesNear(p.pos.clone().add(new THREE.Vector3(0, 2.4, 0)),
        DR.reach + 4, d, -.4).forEach(function (e) {
        if (!e || e.dead) return;
        var kb = d.clone().multiplyScalar(22); kb.y = 12;
        e.damage(DR.out, kb, {
          react: 'blow', reactDur: .8, spark: HOT, stun: .8,
          bleed: true, death: 'gone' });
      });
      if (a.drill) { scrap(a.drill, a.drill.position.clone()); a.drill = null; }
    }
  }

  /* =====================================================================
     4 · MISSILE POD  弾幕
     A rack on the shoulder and eight of them, which go up before they go
     anywhere else.
     ================================================================== */
  var POD = { dmg: 4, n: 8, radius: 5.5, spread: 4.4, out: 22 };

  function buildPod() {
    var g = new THREE.Group();
    plated(g, 3.0, 2.0, 2.0, 0, 0, 0, GUN);
    for (var i = 0; i < 4; i++) {
      for (var j = 0; j < 2; j++) {
        part(g, .5, .5, .3, -1.0 + i * .68, .42 - j * .84, 1.05, IRON);
        part(g, .34, .34, .12, -1.0 + i * .68, .42 - j * .84, 1.16, HOT);
      }
    }
    part(g, 3.1, .18, .4, 0, 1.1, .4, WARN);
    plated(g, 1.2, .8, 1.4, 0, -1.1, -.6, IRON);
    return g;
  }
  MU.buildPod = buildPod;

  function missile(from, target, delay, ghost) {
    later(delay, function () {
      var m = new THREE.Group();
      part(m, .32, .32, 1.3, 0, 0, 0, PALE);
      part(m, .24, .24, .5, 0, 0, .82, HOT);
      for (var f = 0; f < 3; f++) {
        var fin = part(m, .1, .5, .4, 0, 0, -.55, STEEL);
        fin.rotation.z = f * 2.1;
      }
      m.position.copy(from);
      scene.add(m);
      var t = 0, gone = false;
      var apex = from.clone().lerp(target, .5).add(new THREE.Vector3(0, 9, 0));
      addFx({ t: 1e9, update: function (dt) {
        t += dt;
        if (typeof scene === 'undefined') return false;
        var k = Math.min(1, t / .62);
        /* up, over, and down: a quadratic through the apex */
        var a1 = from.clone().lerp(apex, k), a2 = apex.clone().lerp(target, k);
        var was = m.position.clone();
        m.position.copy(a1.lerp(a2, k));
        if (was.distanceTo(m.position) > .01) m.lookAt(m.position.clone().add(m.position.clone().sub(was)));
        if (Math.random() < dt * 50) FX.mote(m.position.clone(), i2() ? HOT : 0x9aa0a8, .9, .18);
        if (!gone && k >= 1) {
          gone = true;
          var at = m.position.clone();
          FX.impact(at.clone(), FLASH, 2.6);
          FX.rings(new THREE.Vector3(at.x, .12, at.z), HOT, 2, { maxR: POD.radius * 2, life: .4, gap: 34 });
          sparks(at.clone(), 8);
          FX.debris(new THREE.Vector3(at.x, .1, at.z), 6, 8, GUN);
          FX.dust(new THREE.Vector3(at.x, 0, at.z), 5, 0x9aa0a8, 7, 3);
          addShake(1.2);
          if (!ghost) {
            enemiesNear(at.clone(), POD.radius).forEach(function (e) {
              if (!e || e.dead) return;
              var kb = e.pos.clone().sub(at).setY(0);
              if (kb.lengthSq() < .01) kb.set(1, 0, 0);
              /* barely any push: a barrage is supposed to pin somebody
                 down, and the first one throwing them clear of the next
                 seven made it the weakest thing in the kit */
              kb.normalize().multiplyScalar(2); kb.y = 1.5;
              e.damage(POD.dmg, kb, {
                react: null, spark: HOT, noFrameBonus: true, stun: .14,
                bleed: true, death: 'burn' });
            });
          }
          scene.remove(m);
          m.traverse(function (o) { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
          return false;
        }
        return true;
      } });
      function i2() { return Math.random() < .6; }
    });
  }

  function castPod() {
    if (!ready('k4')) return;
    var a = start('k4', 1.4, 'k4', 'MISSILE POD', '弾幕');
    var d = aim();
    var near = nearest(30, 0);
    a.at = near ? new THREE.Vector3(near.pos.x, 1, near.pos.z)
                : player.pos.clone().addScaledVector(d, POD.out).setY(1);
    a.dir = d;
    player.iframes = Math.max(player.iframes, .6);
    try { sfx.whoosh(); } catch (e) {}
  }
  function stepPod(a, dt) {
    var p = player, d = a.dir;
    p.vel.x *= .82; p.vel.z *= .82;
    var side = new THREE.Vector3(-d.z, 0, d.x);
    var at = p.pos.clone().addScaledVector(side, -2.1).add(new THREE.Vector3(0, 3.6, 0));
    if (a.stage < 1) {
      a.stage = 1;
      var g = buildPod();
      g.position.copy(at);
      g.rotation.y = Math.atan2(d.x, d.z);
      scene.add(g);
      keep(g);
      a.pod = g;
      assemble(g, .4);
      addShake(.5);
    }
    if (a.pod) a.pod.position.copy(at);
    if (a.stage < 2 && a.t > .52) {
      a.stage = 2;
      FX.speedRing(at.clone(), HOT, 8, .22);
      addShake(1.4);
      try { sfx.redBoom(); } catch (e) {}
      for (var i = 0; i < POD.n; i++) {
        var spread = new THREE.Vector3(
          (Math.random() - .5) * POD.spread, 0, (Math.random() - .5) * POD.spread);
        missile(at.clone(), a.at.clone().add(spread), i * 65, false);
      }
    }
    if (a.stage < 3 && a.t > 1.15) {
      a.stage = 3;
      if (a.pod) { scrap(a.pod, a.pod.position.clone()); a.pod = null; }
    }
  }

  /* =====================================================================
     R · ULTRA SPIN  超高速回転
     THE SPECIAL. Not another piece of ordnance — the whole frame comes
     together around him, and then it turns.
     ================================================================== */
  var SPIN = { dmg: 54, radius: 11, dur: 1.6, rate: 26 };

  function buildFrame() {
    var g = new THREE.Group();
    /* the shell around him: shoulders, chest, and a head over his own */
    plated(g, 4.0, 3.4, 2.8, 0, 4.4, 0, GUN);
    plated(g, 5.2, 1.2, 3.0, 0, 6.3, 0, IRON);
    part(g, 4.2, .3, 3.1, 0, 6.95, 0, WARN);
    plated(g, 2.0, 1.6, 1.8, 0, 7.6, .2, GUN);
    for (var s = -1; s <= 1; s += 2) {
      var eye = part(g, .5, .3, .12, .5 * s, 7.7, 1.16, LENS);
      eye.material.emissive = new THREE.Color(LENS);
      eye.material.emissiveIntensity = .8;
      /* the arms, which are what the spin swings */
      var arm = new THREE.Group();
      arm.position.set(2.6 * s, 5.6, 0);
      plated(arm, 1.5, 3.2, 1.5, 0, -1.5, 0, GUN);
      plated(arm, 1.3, 3.0, 1.3, 0, -4.2, .2, IRON);
      part(arm, 2.0, 1.8, 2.0, 0, -6.2, .3, STEEL);
      part(arm, 2.1, .4, 2.1, 0, -5.2, .3, COP);
      g.add(arm);
      (g.__arms = g.__arms || []).push(arm);
      /* and the thrusters that make it turn */
      var th = part(g, .9, .9, 1.4, 3.4 * s, 4.6, -1.4, IRON);
      part(g, .7, .7, .4, 3.4 * s, 4.6, -2.2, HOT);
    }
    plated(g, 2.6, 2.2, 2.2, 0, 2.0, 0, IRON);           // the waist
    for (var i = 0; i < 4; i++) part(g, 4.2, .16, .3, 0, 3.2 + i * .8, 1.45, WARN);
    return g;
  }
  MU.buildFrame = buildFrame;

  function castSpin() {
    if (!ready('kr')) return;
    var a = start('kr', SPIN.dur + .5, 'kr', 'ULTRA SPIN', '超高速回転');
    a.dir = aim();
    a.hit = [];
    player.iframes = Math.max(player.iframes, .9);
    try { sfx.raise(); } catch (e) {}
  }
  function stepSpin(a, dt) {
    var p = player, d = a.dir;
    p.vel.x *= .9; p.vel.z *= .9;
    if (a.stage < 1) {
      a.stage = 1;
      var g = buildFrame();
      g.position.copy(p.pos);
      g.rotation.y = Math.atan2(d.x, d.z);
      scene.add(g);
      keep(g);
      a.frame = g;
      /* it still takes the longest of his to build, because it is the
         only thing he builds around himself — but half a second, not one */
      assemble(g, .5);
      FX.cracks(new THREE.Vector3(p.pos.x, .06, p.pos.z), 12, 15, 0x3a3f46);
      addShake(1.6);
    }
    if (a.frame) {
      a.frame.position.copy(p.pos);
      if (a.t > .62) {
        /* and then it turns, and keeps turning faster */
        var w = Math.min(1, (a.t - .62) / .38);
        a.frame.rotation.y += dt * SPIN.rate * w;
        if (a.frame.__arms) a.frame.__arms.forEach(function (arm2, i) {
          arm2.rotation.z = (i ? -1 : 1) * (.2 + w * 1.15);
        });
        if (Math.random() < dt * 40) {
          var ang = Math.random() * TAU;
          sparks(p.pos.clone().add(new THREE.Vector3(
            Math.cos(ang) * 7, 1 + Math.random() * 6, Math.sin(ang) * 7)), 2);
        }
        if (Math.random() < dt * 26) {
          FX.speedRing(p.pos.clone().add(new THREE.Vector3(0, 3 + Math.random() * 4, 0)),
            HOT, 12 + Math.random() * 8, .2);
        }
      }
    }
    if (a.stage < 2 && a.t > .62) {
      a.stage = 2;
      FX.flash('#fff0d0', .4, .22);
      FX.rings(new THREE.Vector3(p.pos.x, .12, p.pos.z), HOT, 3,
        { maxR: SPIN.radius * 1.6, life: .6, gap: 38 });
      FX.mangaLines(.6, .22);
      addShake(2.2);
      try { sfx.redBoom(); } catch (e) {}
    }
    /* everything inside the circle, once, and it is a lot */
    if (a.stage >= 2 && a.t < a.dur - .5) {
      enemies.forEach(function (e) {
        if (!e || e.dead || a.hit.indexOf(e) >= 0) return;
        if (e.pos.distanceTo(p.pos) > SPIN.radius) return;
        a.hit.push(e);
        var kb = e.pos.clone().sub(p.pos).setY(0);
        if (kb.lengthSq() < .01) kb.copy(d);
        kb.normalize().multiplyScalar(30); kb.y = 17;
        e.damage(SPIN.dmg, kb, {
          react: 'blow', reactDur: 1, spark: FLASH, stun: .9,
          bleed: true, death: 'dice' });
        FX.impact(e.pos.clone().add(new THREE.Vector3(0, 2.5, 0)), FLASH, 3.8);
        sparks(e.pos.clone().add(new THREE.Vector3(0, 2.4, 0)), 12);
        FX.blood(e.pos.clone().add(new THREE.Vector3(0, 2.5, 0)), kb.clone().normalize(), 15, 2.2);
        addShake(2.2);
        if (typeof hitstop === 'function') hitstop(.1);
      });
    }
    if (a.stage < 3 && a.t > a.dur - .4) {
      a.stage = 3;
      /* and it comes apart at speed, which is the whole payoff */
      FX.flash('#ffe7c0', .45, .24);
      FX.rings(new THREE.Vector3(p.pos.x, .12, p.pos.z), HOT, 4,
        { maxR: SPIN.radius * 2, life: .7, gap: 34 });
      FX.dust(new THREE.Vector3(p.pos.x, 0, p.pos.z), 13, 0x9aa0a8, 17, 5);
      FX.mangaLines(.7, .26);
      addShake(2.6);
      if (typeof hitstop === 'function') hitstop(.12);
      if (a.frame) { scrap(a.frame, p.pos.clone().add(new THREE.Vector3(0, 4, 0))); a.frame = null; }
    }
  }

  /* =====================================================================
     POSES
     He hardly moves, and that is the point: a boy holding still while
     several tonnes of machinery does the work a metre from his head. The
     one thing his body does is brace.
     ================================================================== */
  function poseMuta(r, a) {
    var t = a.t, out = E.out;
    switch (a.type) {
      case 'k1': {                        // one arm up, and the recoil
        rp(r);
        var k = out(Math.min(1, t / .3));
        var kick = t > .5 ? Math.max(0, 1 - (t - .5) / .3) : 0;
        r.shoulderR.rotation.x = -1.5 * k + .5 * kick;
        r.shoulderR.rotation.z = -.4 * k;
        r.elbowR.rotation.x = -.5 * k - .5 * kick;
        r.shoulderL.rotation.x = -.6 * k;
        r.elbowL.rotation.x = -1.2 * k;
        r.spine.rotation.x = -.16 * k + .3 * kick;
        r.spine.rotation.y = -.2 * k;
        r.neck.rotation.x = -.2 * k + .2 * kick;
        r.hipL.rotation.x = -.34 * k; r.kneeL.rotation.x = .6 * k;
        r.hipR.rotation.x = -.24 * k; r.kneeR.rotation.x = .5 * k;
        r.hips.position.y = r.hipsBaseY - .3 * k - .12 * kick;
        return true;
      }
      case 'k2': {                        // the arm goes out with the fist
        rp(r);
        var w = out(Math.min(1, t / .34));
        var go = t > .38 ? out(Math.min(1, (t - .38) / .12)) : 0;
        r.shoulderR.rotation.x = -.5 - .9 * w - .8 * go;
        r.shoulderR.rotation.z = -.5 * w + .3 * go;
        r.elbowR.rotation.x = -1.6 * w + 1.5 * go;
        r.shoulderL.rotation.x = -.5 * w;
        r.elbowL.rotation.x = -1.3 * w;
        r.spine.rotation.y = .4 * w - .7 * go;
        r.spine.rotation.x = -.12 * w + .26 * go;
        r.neck.rotation.y = -.24 * w + .4 * go;
        r.hipL.rotation.x = -.4 * w + .2 * go; r.kneeL.rotation.x = .7 * w;
        r.hipR.rotation.x = .2 * w - .3 * go; r.kneeR.rotation.x = .5 * w;
        r.hips.position.y = r.hipsBaseY - .34 * w;
        return true;
      }
      case 'k3': {                        // braced behind it, walking it in
        rp(r);
        var b = out(Math.min(1, t / .34));
        var push = t > .44 ? Math.min(1, (t - .44) / .3) : 0;
        var rattle = Math.sin(t * 40) * .04 * push;
        r.shoulderR.rotation.x = -1.4 * b - .2 * push;
        r.shoulderR.rotation.z = -.34 * b;
        r.elbowR.rotation.x = -.8 * b + .3 * push;
        r.shoulderL.rotation.x = -1.2 * b;
        r.shoulderL.rotation.z = .3 * b;
        r.elbowL.rotation.x = -1.0 * b;
        r.spine.rotation.x = -.2 * b + .34 * push + rattle;
        r.neck.rotation.x = -.24 * b + .2 * push;
        r.hipL.rotation.x = -.6 * b; r.kneeL.rotation.x = .9 * b;
        r.hipR.rotation.x = .3 * b; r.kneeR.rotation.x = .5 * b;
        r.hips.position.y = r.hipsBaseY - .44 * b + rattle;
        return true;
      }
      case 'k4': {                        // he does not even look up
        rp(r);
        var s1 = out(Math.min(1, t / .4));
        var sh = t > .52 ? Math.sin((t - .52) * 34) * .06 * Math.max(0, 1 - (t - .52) / .6) : 0;
        r.shoulderL.rotation.x = -.4 * s1;
        r.shoulderR.rotation.x = -.4 * s1;
        r.shoulderL.rotation.z = .34 * s1;
        r.shoulderR.rotation.z = -.34 * s1;
        r.elbowL.rotation.x = -1.4 * s1; r.elbowR.rotation.x = -1.4 * s1;
        r.spine.rotation.x = .12 * s1 + sh;
        r.spine.rotation.z = sh * 1.6;
        r.neck.rotation.x = .16 * s1;
        r.hipL.rotation.x = -.3 * s1; r.kneeL.rotation.x = .54 * s1;
        r.hipR.rotation.x = -.26 * s1; r.kneeR.rotation.x = .48 * s1;
        r.hips.position.y = r.hipsBaseY - .34 * s1;
        return true;
      }
      case 'kr': {                        // arms in, head down, and hold on
        rp(r);
        var tuck = out(Math.min(1, t / .6));
        var spun = t > .85 ? Math.min(1, (t - .85) / .4) : 0;
        var shake = Math.sin(t * 46) * .05 * spun;
        r.shoulderL.rotation.x = -1.9 * tuck;
        r.shoulderR.rotation.x = -1.9 * tuck;
        r.shoulderL.rotation.z = .95 * tuck;
        r.shoulderR.rotation.z = -.95 * tuck;
        r.elbowL.rotation.x = -2.1 * tuck; r.elbowR.rotation.x = -2.1 * tuck;
        r.spine.rotation.x = .44 * tuck + shake;
        r.spine.rotation.z = shake * 2;
        r.neck.rotation.x = .5 * tuck;
        r.hipL.rotation.x = -.5 * tuck; r.kneeL.rotation.x = .9 * tuck;
        r.hipR.rotation.x = -.44 * tuck; r.kneeR.rotation.x = .82 * tuck;
        r.hips.position.y = r.hipsBaseY - .5 * tuck + shake;
        return true;
      }
    }
    return false;
  }

  /* --------------------------------------------------------------- wiring */
  var _stepAction = stepAction;
  stepAction = function (a, dt) {
    switch (a.type) {
      case 'k1': return stepCannon(a, dt);
      case 'k2': return stepFist(a, dt);
      case 'k3': return stepDrill(a, dt);
      case 'k4': return stepPod(a, dt);
      case 'kr': return stepSpin(a, dt);
    }
    return _stepAction(a, dt);
  };

  var _poseAction = poseAction;
  poseAction = function (r, a) {
    if (a && (r.__char || player.char) === 'muta' && poseMuta(r, a)) return;
    return _poseAction(r, a);
  };

  window.addEventListener('keydown', function (e) {
    if (!started || player.char !== 'muta' || e.repeat) return;
    if (player.react || (player.action && (player.action.type === 'kb' ||
        player.action.type === 'void'))) {
      if (window.JJNOTICE && Math.random() < .5) window.JJNOTICE('NO TECHNIQUE WHILE HIT', '#ff8b98');
      return;
    }
    var hit = true;
    if (e.code === 'Digit1') castCannon();
    else if (e.code === 'Digit2') castFist();
    else if (e.code === 'Digit3') castDrill();
    else if (e.code === 'Digit4') castPod();
    else if (e.code === 'KeyR') castSpin();
    else hit = false;
    if (hit) e.stopImmediatePropagation();
  }, true);

  /* he never keeps any of it, and neither does the swap */
  var _switchChar = switchChar;
  switchChar = function (id, quiet) {
    MU.rigs.slice().forEach(drop);
    return _switchChar(id, quiet);
  };

  /* =====================================================================
     WHAT EVERYBODY ELSE SEES
     The assembly is most of what a move of his looks like, so it is
     rebuilt in full — a copy that skipped it would be a boy standing
     still while nothing happened.
     ================================================================== */
  function dirOf(yaw) { return new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)); }

  MU.remote = {
    k1: function (pos, yaw) {
      var d = dirOf(yaw), side = new THREE.Vector3(-d.z, 0, d.x);
      var at = pos.clone().addScaledVector(side, 1.9).add(new THREE.Vector3(0, 3.1, 0));
      var g = buildCannon();
      g.position.copy(at);
      g.rotation.y = Math.atan2(d.x, d.z);
      scene.add(g);
      assemble(g, .42);
      later(510, function () {
        var muzzle = at.clone().addScaledVector(d, 5.2);
        FX.impact(muzzle.clone(), FLASH, 3);
        FX.speedRing(muzzle.clone(), HOT, 9, .22);
        exhaust(at.clone().addScaledVector(d, -2), d, 9);
        sparks(muzzle.clone(), 10);
        fireShell(muzzle, d.clone(), true);
      });
      later(860, function () { scrap(g, g.position.clone()); });
    },
    k2: function (pos, yaw) {
      var d = dirOf(yaw);
      var from = pos.clone().addScaledVector(d, 2.6).add(new THREE.Vector3(0, 2.9, 0));
      later(390, function () {
        FX.speedRing(from.clone(), HOT, 10, .24);
        exhaust(from.clone().addScaledVector(d, -1.6), d, 8);
        throwFist(from, d.clone(), true);
      });
    },
    k3: function (pos, yaw) {
      var d = dirOf(yaw), side = new THREE.Vector3(-d.z, 0, d.x);
      var at = pos.clone().addScaledVector(side, 1.6).add(new THREE.Vector3(0, 2.7, 0));
      var g = buildDrill();
      g.position.copy(at);
      g.rotation.y = Math.atan2(d.x, d.z);
      scene.add(g);
      assemble(g, .38);
      var t = 0;
      addFx({ t: 1e9, update: function (dt) {
        t += dt;
        if (typeof scene === 'undefined' || !g.parent) return false;
        if (t > .4) {
          if (g.__bit) g.__bit.rotation.z += dt * 34;
          g.position.addScaledVector(d, 20 * dt * (t < 1.15 ? 1 : 0));
          if (Math.random() < dt * 26) sparks(g.position.clone().addScaledVector(d, 6), 3);
        }
        if (t > 1.2) { scrap(g, g.position.clone()); return false; }
        return true;
      } });
    },
    k4: function (pos, yaw) {
      var d = dirOf(yaw), side = new THREE.Vector3(-d.z, 0, d.x);
      var at = pos.clone().addScaledVector(side, -2.1).add(new THREE.Vector3(0, 3.6, 0));
      var tgt = pos.clone().addScaledVector(d, POD.out).setY(1);
      var g = buildPod();
      g.position.copy(at);
      g.rotation.y = Math.atan2(d.x, d.z);
      scene.add(g);
      assemble(g, .4);
      later(530, function () {
        FX.speedRing(at.clone(), HOT, 8, .22);
        for (var i = 0; i < POD.n; i++) {
          missile(at.clone(), tgt.clone().add(new THREE.Vector3(
            (Math.random() - .5) * 7, 0, (Math.random() - .5) * 7)), i * 65, true);
        }
      });
      later(1160, function () { scrap(g, g.position.clone()); });
    },
    /* the special: the frame, the spin, and the way it comes apart */
    kr: function (pos, yaw, f) {
      var d = dirOf(yaw);
      var g = buildFrame();
      g.position.copy(pos);
      g.rotation.y = Math.atan2(d.x, d.z);
      scene.add(g);
      assemble(g, .8);
      FX.cracks(new THREE.Vector3(pos.x, .06, pos.z), 14, 18, 0x3a3f46);
      var t = 0;
      addFx({ t: 1e9, update: function (dt) {
        t += dt;
        if (typeof scene === 'undefined' || !g.parent) return false;
        /* it follows the body it was built around, wherever that is now */
        if (f && f.e) g.position.copy(f.e.pos);
        if (t > .85) {
          var w = Math.min(1, (t - .85) / .5);
          g.rotation.y += dt * SPIN.rate * w;
          if (g.__arms) g.__arms.forEach(function (arm2, i) {
            arm2.rotation.z = (i ? -1 : 1) * (.2 + w * 1.15);
          });
          if (Math.random() < dt * 40) {
            var ang = Math.random() * TAU;
            sparks(g.position.clone().add(new THREE.Vector3(
              Math.cos(ang) * 7, 1 + Math.random() * 6, Math.sin(ang) * 7)), 2);
          }
        }
        if (t > SPIN.dur + .4) {
          FX.rings(new THREE.Vector3(g.position.x, .12, g.position.z), HOT, 5,
            { maxR: SPIN.radius * 2.4, life: .9, gap: 34 });
          FX.dust(new THREE.Vector3(g.position.x, 0, g.position.z), 16, 0x9aa0a8, 20, 6);
          scrap(g, g.position.clone().add(new THREE.Vector3(0, 4, 0)));
          return false;
        }
        return true;
      } });
    }
  };

  /* the pieces the finishers borrow */
  MU.exhaust = exhaust;
  MU.chain = chainTo;
  MU.IRON = IRON; MU.GUN = GUN; MU.STEEL = STEEL; MU.PALE = PALE;
  MU.COP = COP; MU.WARN = WARN; MU.HOT = HOT; MU.FLASH = FLASH; MU.LENS = LENS;
})();
