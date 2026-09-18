/* =======================================================================
   KOKICHI MUTA  —  MECHAMARU
   Puppet Manipulation 傀儡操術. The body on the screen is his real one:
   small, thin, barefoot, wrapped in bandages and a uniform four sizes too
   big, with a plate where a face should be.

   THE REWRITE. The first version of him conjured. Every move built a piece
   of machinery out of nothing in the air beside his head, used it once and
   threw it away, which meant he barely moved and none of it was ever
   really his. Nothing here is summoned any more. Every weapon is bolted to
   the arm it comes out of — folded flat inside the sleeve until it opens,
   parented to the hand so it swings when he swings — and the move is the
   arm doing something, not a boy standing beside a machine.

   So the three beats are now:

     · a forearm OPENS: plates slide out along it and lock
     · he swings, throws, leans on or drives the thing they made
     · and it folds shut again, because it was part of him

     1  ARM CANNON        腕砲 — the forearm opens into a barrel, and he
                          levels it and fires one shell
     2  ROCKET PUNCH      拳射出 — the gauntlet closes over his hand and
                          then his hand leaves, on a chain bolted to the
                          arm, and is reeled back into the open socket
     3  DRILL             削岩 — a bit over the knuckles. Not swung at
                          them: put against them and walked forward
     4  PILE BUNKER       杭打 — NEW. A piston down the left forearm. He
                          plants both feet and drives one spike through
                          whatever is in front of him, and you can see it
                          being re-cocked
     R  ULTRA SPIN        超高速回転 — the special. Both arms lock out
                          straight, a bracer runs out along each, the
                          thrusters light, and HE turns

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
      { key: '3', lbl: 'Drill', cd: 'k3', max: KCD.k3 },
      { key: '4', lbl: 'Pile Bunker', cd: 'k4', max: KCD.k4 },
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

  /* =====================================================================
     MOUNTING
     The difference between this Kokichi and the last one. None of his
     machinery is conjured in the air beside him any more. Every weapon is
     parented to the arm it comes out of and folded flat inside the sleeve
     until it opens, so it moves with the pose, swings when he swings, and
     sits where his fist is instead of a metre from his head.

     The builders author everything pointing along +Z, because that is what
     a projectile wants. An arm points down its own -Y. ARM_TURN is that
     quarter turn, and it is the only thing mounting has to know.
     ================================================================== */
  var ARM_TURN = Math.PI / 2;

  function hand(right) {
    var r = player.rig;
    return r ? (right ? r.handR : r.handL) : null;
  }
  function mount(bone, g, scale, lift) {
    if (!bone) { scene.add(g); keep(g); return g; }
    g.rotation.set(ARM_TURN, 0, 0);
    g.position.set(0, lift == null ? -.15 : lift, 0);
    if (scale) g.scale.setScalar(scale);
    bone.add(g);
    keep(g);
    return g;
  }
  /* hand a mounted piece back to the world at the place it had reached, so
     it flies off or comes apart where it was standing rather than jumping
     to the origin the moment it stops being part of him */
  function handOff(g) {
    if (!g) return null;
    var w = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    g.updateWorldMatrix(true, false);
    g.matrixWorld.decompose(w, q, s);
    if (g.parent) g.parent.remove(g);
    scene.add(g);
    g.position.copy(w); g.quaternion.copy(q); g.scale.copy(s);
    return g;
  }
  /* where a mounted piece has got to, for aiming and for effects */
  function tipOf(g, along) {
    if (!g) return player.pos.clone().add(new THREE.Vector3(0, 2.8, 0));
    var v = new THREE.Vector3(0, 0, along == null ? 1 : along);
    g.updateWorldMatrix(true, false);
    return g.localToWorld(v);
  }

  /* Opening, not summoning. Each plate starts folded flat against the
     forearm and slides out along it in order, so the weapon comes OUT of
     him — the same three beats as before, without the parts arriving from
     off screen. */
  function unfold(g, secs) {
    var st = [];
    g.children.forEach(function (c, i) {
      if (!c.isMesh) return;
      var to = c.position.clone();
      var from = new THREE.Vector3(to.x * .2, to.y * .2, Math.min(to.z, 0) * .2);
      c.position.copy(from);
      c.scale.setScalar(.15);
      st.push({ m: c, to: to, from: from, at: i * .012 });
    });
    var span = Math.max(.05, secs * .45), t = 0;
    addFx({ t: 1e9, update: function (dt) {
      t += dt;
      if (typeof scene === 'undefined' || !g.parent) return false;
      var live = false;
      st.forEach(function (s2) {
        var k = (t - s2.at) / span;
        if (k >= 1) { s2.m.position.copy(s2.to); s2.m.scale.setScalar(1); return; }
        live = true;
        if (k < 0) return;
        var e2 = E.out(k);
        s2.m.position.lerpVectors(s2.from, s2.to, e2);
        s2.m.scale.setScalar(.15 + .85 * e2);
      });
      if (!live) {
        var w = new THREE.Vector3();
        g.getWorldPosition(w);
        FX.mote(w, WARN, 1.1, .16);
      }
      return live;
    } });
  }
  MU.unfold = unfold;

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

  /* the jet off the back of a mounted piece as it comes round */
  function exhaustTrail(g, chance) {
    if (Math.random() > chance) return;
    FX.mote(tipOf(g, -1.2), Math.random() < .6 ? HOT : FLASH, 1.1, .16);
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
  var CAN = { dmg: 13, reach: 34, radius: 5.5, speed: 78 };

  /* the arm version: a barrel over the knuckles, not a field piece. The
     full size one below is still what the finishers use, where a set piece
     is the point. */
  function buildArmCannon() {
    var g = new THREE.Group();
    plated(g, .78, .78, 1.1, 0, 0, -.1, GUN);            // the breech, over the fist
    plated(g, .56, .56, 1.3, 0, 0, 1.0, IRON);           // the barrel
    part(g, .7, .7, .2, 0, 0, 1.72, STEEL);              // the brake
    part(g, .26, .26, .8, -.44, -.1, .5, COP);           // recoil rods along the forearm
    part(g, .26, .26, .8, .44, -.1, .5, COP);
    part(g, .8, .08, .16, 0, .36, .1, WARN);
    part(g, .8, .08, .16, 0, .36, .7, WARN);
    return g;
  }
  MU.buildArmCannon = buildArmCannon;

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
    if (a.stage < 1) {
      a.stage = 1;
      /* it opens along his own forearm, and the pose below points it */
      a.gun = mount(hand(true), buildArmCannon());
      unfold(a.gun, .34);
      addShake(.35);
    }
    if (a.stage < 2 && a.t > .5) {
      a.stage = 2;
      var muzzle = tipOf(a.gun, 2);
      FX.flash('#fff0d0', .35, .18);
      FX.impact(muzzle.clone(), FLASH, 3);
      FX.speedRing(muzzle.clone(), HOT, 9, .22);
      exhaust(tipOf(a.gun, -1), d, 9);
      sparks(muzzle.clone(), 10);
      addShake(2);
      if (typeof hitstop === 'function') hitstop(.09);
      try { sfx.redBoom(); } catch (e) {}
      /* fired from the muzzle, but along where he is looking: the arm is
         mid recoil by the time the shell exists */
      fireShell(muzzle, d.clone());
      a.kick = .16;
    }
    if (a.stage < 3 && a.t > .86) {
      a.stage = 3;
      /* and it folds shut, rather than being thrown away */
      if (a.gun) { sparks(tipOf(a.gun, 0), 5); drop(a.gun); }
      a.gun = null;
    }
  }

  /* =====================================================================
     2 · ROCKET PUNCH  拳射出
     The fist leaves. The chain does not, which is what makes it come
     back through everything a second time.
     ================================================================== */
  var RP = { dmg: 11, reach: 26, radius: 4.2, speed: 46, back: .3 };

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

  /* the one he actually wears, and the hole it leaves */
  function buildArmFist() {
    var g = new THREE.Group();
    plated(g, .9, .82, 1.0, 0, 0, .1, GUN);
    part(g, .94, .2, 1.05, 0, .38, .1, IRON);
    for (var i = 0; i < 4; i++) {
      part(g, .18, .2, .46, -.33 + i * .22, -.08, .66, STEEL);
      part(g, .18, .12, .16, -.33 + i * .22, -.14, .92, COP);
    }
    part(g, .28, .28, .58, -.56, -.16, .3, STEEL);       // the thumb
    part(g, .5, .5, .24, 0, 0, -.5, COP);                // the coupling it leaves on
    return g;
  }
  MU.buildArmFist = buildArmFist;

  function buildSocket() {
    var g = new THREE.Group();
    plated(g, .74, .74, .34, 0, 0, 0, IRON);
    var lit = part(g, .4, .4, .1, 0, 0, .21, HOT);       // the open coupling
    lit.material.emissive = new THREE.Color(HOT);
    lit.material.emissiveIntensity = .7;
    part(g, .78, .07, .14, 0, .34, 0, WARN);
    return g;
  }

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

  /* `given` is the fist he was already wearing, handed to the world at the
     place his arm had it. Without one — a spectator's copy, a finisher —
     it builds a loose one at `from` instead. */
  function throwFist(from, dir, ghost, given, onHome) {
    var g = given;
    if (!g) {
      g = buildFist();
      g.position.copy(from);
      g.rotation.y = Math.atan2(dir.x, dir.z);
      scene.add(g);
      keep(g);
      assemble(g, .2);
    }
    var t = 0, back = false, hit = [];
    var home = from.clone();

    addFx({ t: 1e9, update: function (dt) {
      t += dt;
      if (typeof scene === 'undefined') return false;
      /* the chain is bolted to his forearm, so the far end of it follows
         him around rather than hanging in the air where he threw from */
      if (given && !ghost && player.char === 'muta' && player.rig && player.rig.handR) {
        player.rig.handR.updateWorldMatrix(true, false);
        player.rig.handR.getWorldPosition(home);
      }
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
        /* his own hand is put back on; a loose one is only scrap */
        if (given) { drop(g); if (onHome) onHome(); }
        else scrap(g, g.position.clone());
        return false;
      }
      /* it can be flung somewhere it cannot get back from; the arm still
         has to stop waiting for it */
      if (t >= 3.2) {
        if (given) { drop(g); if (onHome) onHome(); }
        return false;
      }
      return true;
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
    if (a.stage < 1) {
      a.stage = 1;
      /* the gauntlet closes over the hand he is about to lose */
      a.fist = mount(hand(true), buildArmFist());
      unfold(a.fist, .24);
    }
    if (a.stage < 2 && a.t > .38) {
      a.stage = 2;
      /* and then it is not his any more: the same piece is handed to the
         world exactly where his arm had it, so nothing pops */
      var g = handOff(a.fist);
      a.fist = null;
      var from = g ? g.position.clone() : p.pos.clone().addScaledVector(d, 2.6).add(new THREE.Vector3(0, 2.9, 0));
      a.socket = mount(hand(true), buildSocket());
      FX.flash('#fff0d0', .3, .16);
      FX.speedRing(from.clone(), HOT, 10, .24);
      exhaust(from.clone().addScaledVector(d, -1.6), d, 8);
      addShake(1.8);
      if (typeof hitstop === 'function') hitstop(.08);
      try { sfx.redBoom(); } catch (e) {}
      throwFist(from, d.clone(), false, g, function () {
        // it comes home and the socket shuts over it
        if (a.socket) { drop(a.socket); a.socket = null; }
      });
    }
  }

  /* =====================================================================
     3 · DRILL  削岩
     A bit over the knuckles, not a rig on a mount. It is not swung at
     them — it is put against them and left running, and he has to walk
     forward behind his own fist to keep it there.
     ================================================================== */
  var DR = { dmg: 14, reach: 9, ticks: 6, tick: 1.5, out: 5, step: 13 };

  /* The drill he wears. The old one was six units long on its own carriage
     and floated at his shoulder; this is shorter than his forearm and it
     goes wherever the fist goes. */
  function buildHandDrill() {
    var g = new THREE.Group();
    plated(g, .66, .66, .74, 0, 0, -.16, GUN);           // the housing over the fist
    part(g, .52, .52, .2, 0, 0, .26, COP);               // the collar
    g.__bit = new THREE.Group();
    for (var i = 0; i < 5; i++) {
      var w = .44 - i * .07;
      var seg = part(g.__bit, w, w, .26, 0, 0, .44 + i * .25, i % 2 ? STEEL : PALE);
      seg.rotation.z = i * .62;
    }
    part(g.__bit, .11, .11, .42, 0, 0, 1.78, PALE);      // the point
    g.add(g.__bit);
    part(g, .7, .07, .15, 0, .32, -.1, WARN);
    part(g, .24, .24, .5, -.4, -.1, -.1, COP);           // the motor down the forearm
    part(g, .24, .24, .5, .4, -.1, -.1, COP);
    return g;
  }
  MU.buildHandDrill = buildHandDrill;

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
    if (a.stage < 1) {
      a.stage = 1;
      a.drill = mount(hand(true), buildHandDrill());
      unfold(a.drill, .3);
      addShake(.3);
    }
    /* the bit spins in the housing; the housing goes wherever the pose
       below puts his arm, which is straight out in front of him */
    if (a.drill && a.drill.__bit && a.t > .34) a.drill.__bit.rotation.z += dt * 34;
    var tip = tipOf(a.drill, 2.1);
    if (a.t < .42) { p.vel.x *= .7; p.vel.z *= .7; return; }
    /* he walks it forward and it stays on them */
    if (a.t < 1.15) {
      p.vel.x = d.x * DR.step; p.vel.z = d.z * DR.step;
      if (Math.random() < dt * 26) sparks(tip.clone(), 3);
      if (a.n < DR.ticks && a.t > .48 + a.n * .11) {
        a.n++;
        /* what it is being put against is whatever is in front of HIM;
           searching from the tip alone missed anyone his arm swung past */
        var got = enemiesNear(
          p.pos.clone().addScaledVector(d, 4).add(new THREE.Vector3(0, 2.4, 0)),
          DR.reach, d, .1);
        if (got.length) {
          FX.impact(tip.clone(), FLASH, 1.5);
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
      /* he leans on it once, and it goes through */
      var tip2 = tipOf(a.drill, 2.1);
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
    }
    if (a.stage < 3 && a.t > a.dur - .2) {
      a.stage = 3;
      if (a.drill) { sparks(tipOf(a.drill, 0), 6); drop(a.drill); a.drill = null; }
    }
  }

  /* =====================================================================
     4 · PILE BUNKER  杭打
     The new one, and the least like the rest of him: no barrel, no chain,
     nothing that leaves. A piston runs the length of his left forearm. He
     plants both feet, the housing locks, and it drives one spike through
     whatever is directly in front of him.

     Short, heavy, and the only move of his that needs him to be close.
     ================================================================== */
  var PILE = { dmg: 14, reach: 7.5, radius: 4.6, throw: 34, drive: .32 };

  function buildBunker() {
    var g = new THREE.Group();
    plated(g, .84, .84, 1.5, 0, 0, -.2, GUN);            // the housing along the forearm
    part(g, .95, .18, 1.55, 0, .38, -.2, IRON);          // the rail on top
    part(g, .3, .3, 1.1, -.5, -.12, -.1, COP);           // the return springs
    part(g, .3, .3, 1.1, .5, -.12, -.1, COP);
    part(g, .9, .09, .18, 0, .4, .35, WARN);
    part(g, .9, .09, .18, 0, .4, -.6, WARN);
    plated(g, .62, .62, .34, 0, 0, .72, IRON);           // the muzzle it comes out of
    /* the spike itself, which is the only part that moves */
    g.__pin = new THREE.Group();
    part(g.__pin, .3, .3, 1.3, 0, 0, .5, STEEL);
    part(g.__pin, .18, .18, .5, 0, 0, 1.35, PALE);
    part(g.__pin, .44, .44, .2, 0, 0, -.2, COP);
    g.add(g.__pin);
    return g;
  }
  MU.buildBunker = buildBunker;

  function castPile() {
    if (!ready('k4')) return;
    var a = start('k4', 1.15, 'k4', 'PILE BUNKER', '杭打');
    a.dir = aim();
    player.iframes = Math.max(player.iframes, .5);
    try { sfx.whoosh(); } catch (e) {}
  }
  function stepPile(a, dt) {
    var p = player, d = a.dir;
    if (a.stage < 1) {
      a.stage = 1;
      a.pile = mount(hand(false), buildBunker());
      unfold(a.pile, .3);
      addShake(.4);
    }
    /* he sets himself: no drift while the housing locks */
    if (a.t < .46) { p.vel.x *= .62; p.vel.z *= .62; }
    else { p.vel.x *= .86; p.vel.z *= .86; }

    if (a.stage < 2 && a.t > .48) {
      a.stage = 2;
      var muzzle = tipOf(a.pile, 1.1);
      FX.flash('#fff0d0', .4, .2);
      FX.impact(muzzle.clone(), FLASH, 3.4);
      FX.speedRing(muzzle.clone(), HOT, 10, .22);
      FX.cross(muzzle.clone(), 0xffffff, 3, .2);
      exhaust(tipOf(a.pile, -1.2), d, 8);
      sparks(muzzle.clone(), 14);
      FX.dust(new THREE.Vector3(p.pos.x, 0, p.pos.z), 6, 0x9aa0a8, 7, 3);
      addShake(2.4);
      if (typeof hitstop === 'function') hitstop(.12);
      try { sfx.redBoom(); } catch (e) {}
      enemiesNear(p.pos.clone().addScaledVector(d, 2.6).add(new THREE.Vector3(0, 2.5, 0)),
        PILE.reach, d, .05).forEach(function (e) {
        if (!e || e.dead) return;
        var kb = d.clone().multiplyScalar(PILE.throw); kb.y = 16;
        e.damage(PILE.dmg, kb, {
          react: 'blow', reactDur: .9, spark: HOT, stun: .9,
          bleed: true, death: 'flat' });
        FX.impact(e.pos.clone().add(new THREE.Vector3(0, 2.5, 0)), FLASH, 3.8);
        sparks(e.pos.clone().add(new THREE.Vector3(0, 2.4, 0)), 12);
        FX.blood(e.pos.clone().add(new THREE.Vector3(0, 2.5, 0)), d, 9, 1.8);
      });
    }
    /* the pin goes out fast and is drawn back slowly, which is the whole
       read on the move: you can see it has to be re-cocked */
    if (a.pile && a.pile.__pin) {
      var k = a.t < .48 ? 0
        : a.t < .48 + PILE.drive ? E.out((a.t - .48) / PILE.drive)
        : Math.max(0, 1 - (a.t - .48 - PILE.drive) / .3);
      a.pile.__pin.position.z = k * 1.5;
    }
    if (a.stage < 3 && a.t > a.dur - .18) {
      a.stage = 3;
      if (a.pile) { sparks(tipOf(a.pile, 0), 5); drop(a.pile); a.pile = null; }
    }
  }


  /* =====================================================================
     R · ULTRA SPIN  超高速回転
     THE SPECIAL. Not a frame built around him: his own arms lock out
     straight, a bracer runs out along each of them, the thrusters in both
     palms light, and he turns on the spot until everything in reach has
     been hit by an arm going far too fast.
     ================================================================== */
  var SPIN = { dmg: 28, radius: 11, dur: 1.6, rate: 26 };

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
  /* a bracer, and the thruster on the end of it that does the turning */
  function buildBracer() {
    var g = new THREE.Group();
    plated(g, .8, .8, 1.4, 0, 0, -.1, GUN);
    part(g, .88, .16, 1.45, 0, .36, -.1, IRON);
    part(g, .9, .08, .16, 0, .38, .42, WARN);
    plated(g, .96, .96, .5, 0, 0, .82, IRON);            // the weight on the end
    part(g, .5, .5, .3, 0, 0, -.9, COP);                 // the thruster bell
    var jet = part(g, .34, .34, .16, 0, 0, -1.08, HOT);
    jet.material.emissive = new THREE.Color(HOT);
    jet.material.emissiveIntensity = .9;
    return g;
  }
  MU.buildBracer = buildBracer;

  function stepSpin(a, dt) {
    var p = player, d = a.dir;
    p.vel.x *= .9; p.vel.z *= .9;
    if (a.stage < 1) {
      a.stage = 1;
      /* one down each arm, and nothing anywhere near him that is not his */
      a.bracers = [mount(hand(true), buildBracer()), mount(hand(false), buildBracer())];
      a.bracers.forEach(function (g) { unfold(g, .42); });
      FX.cracks(new THREE.Vector3(p.pos.x, .06, p.pos.z), 12, 15, 0x3a3f46);
      addShake(1.6);
    }
    if (a.t > .62) {
      /* and then HE turns, and keeps turning faster. visYaw is the spin:
         the body yaw the renderer adds on top of his facing, so his own
         aim is still where he left it when this ends. */
      var w = Math.min(1, (a.t - .62) / .38);
      p.visYaw = (p.visYaw || 0) + dt * SPIN.rate * w;
      if (a.bracers) a.bracers.forEach(function (g) {
        if (!g || !g.parent) return;
        exhaustTrail(g, dt * 18 * w);
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
      if (a.bracers) {
        a.bracers.forEach(function (g) {
          if (g) scrap(handOff(g), null);
        });
        a.bracers = null;
      }
      player.visYaw = 0;
    }
  }

  /* =====================================================================
     POSES
     He used to hold still while several tonnes of machinery did the work a
     metre from his head. Now the machinery is bolted to his arms, so the
     arms have to do the move: he points the cannon, he throws the punch,
     he leans on the drill, he plants and drives the bunker, and the spin
     is him turning rather than something turning around him.
     ================================================================== */
  function poseMuta(r, a) {
    var t = a.t, out = E.out;
    switch (a.type) {
      case 'k1': {                        // levels the arm, and takes the recoil
        rp(r);
        var k = out(Math.min(1, t / .3));
        var kick = t > .5 ? Math.max(0, 1 - (t - .5) / .3) : 0;
        /* the barrel is on this forearm, so it has to end up level and
           pointing where he is looking, not raised beside his ear */
        r.shoulderR.rotation.x = -1.62 * k + .42 * kick;
        r.shoulderR.rotation.z = -.12 * k;
        r.elbowR.rotation.x = -.06 * k - .62 * kick;
        r.shoulderL.rotation.x = -.7 * k;                 // the other hand braces it
        r.shoulderL.rotation.z = .5 * k;
        r.elbowL.rotation.x = -1.5 * k;
        r.spine.rotation.x = -.1 * k + .34 * kick;
        r.spine.rotation.y = -.26 * k;
        r.neck.rotation.y = .22 * k;
        r.neck.rotation.x = -.1 * k + .2 * kick;
        r.hipL.rotation.x = -.38 * k; r.kneeL.rotation.x = .66 * k;
        r.hipR.rotation.x = -.2 * k + .2 * kick; r.kneeR.rotation.x = .5 * k;
        r.hips.position.y = r.hipsBaseY - .3 * k - .14 * kick;
        return true;
      }
      case 'k2': {                        // a real punch, and the arm stays out
        rp(r);
        var w = out(Math.min(1, t / .3));
        var go = t > .38 ? out(Math.min(1, (t - .38) / .1)) : 0;
        var hold = t > .6 ? Math.min(1, (t - .6) / .3) : 0;
        /* wound across the body, then everything opens at once */
        r.shoulderR.rotation.x = -.35 - .55 * w - 1.05 * go;
        r.shoulderR.rotation.z = -.62 * w + .58 * go;
        r.elbowR.rotation.x = -1.85 * w + 1.82 * go;
        r.shoulderL.rotation.x = -.4 * w + .5 * go;
        r.shoulderL.rotation.z = .3 * w - .5 * go;
        r.elbowL.rotation.x = -1.35 * w;
        r.spine.rotation.y = .62 * w - 1.05 * go;
        r.spine.rotation.x = -.14 * w + .3 * go;
        r.neck.rotation.y = -.3 * w + .55 * go;
        r.hipL.rotation.x = -.42 * w + .26 * go; r.kneeL.rotation.x = .72 * w;
        r.hipR.rotation.x = .26 * w - .42 * go; r.kneeR.rotation.x = .5 * w;
        r.hips.rotation.y = .3 * w - .5 * go;
        r.hips.position.y = r.hipsBaseY - .36 * w - .1 * hold;
        return true;
      }
      case 'k3': {                        // out in front of him, and leaned on
        rp(r);
        var b = out(Math.min(1, t / .3));
        var push = t > .44 ? Math.min(1, (t - .44) / .3) : 0;
        var lean = t > 1.12 ? Math.min(1, (t - 1.12) / .16) : 0;
        var rattle = Math.sin(t * 40) * .05 * push;
        /* arm straight out: the bit is on the knuckles and has to be the
           furthest forward part of him */
        r.shoulderR.rotation.x = -1.5 * b - .28 * push - .3 * lean;
        r.shoulderR.rotation.z = -.06 * b;
        r.elbowR.rotation.x = -.12 * b + .06 * push;
        r.shoulderL.rotation.x = -1.15 * b;               // second hand on the housing
        r.shoulderL.rotation.z = .46 * b;
        r.elbowL.rotation.x = -1.25 * b;
        r.spine.rotation.x = -.18 * b + .38 * push + .22 * lean + rattle;
        r.spine.rotation.y = -.16 * b;
        r.neck.rotation.x = -.16 * b + .26 * push;
        r.hipL.rotation.x = -.66 * b - .14 * lean; r.kneeL.rotation.x = .95 * b;
        r.hipR.rotation.x = .34 * b; r.kneeR.rotation.x = .5 * b;
        r.hips.position.y = r.hipsBaseY - .42 * b - .14 * lean + rattle;
        return true;
      }
      case 'k4': {                        // plants, locks, and drives it
        rp(r);
        var set = out(Math.min(1, t / .34));
        var fire = t > .48 ? Math.max(0, 1 - (t - .48) / .26) : 0;
        var wind = t < .48 ? out(t / .48) : 1;
        /* the bunker is on the LEFT arm, so that is the one that goes out */
        r.shoulderL.rotation.x = -.5 * set - 1.15 * wind + .34 * fire;
        r.shoulderL.rotation.z = .5 * set - .44 * wind;
        r.elbowL.rotation.x = -1.5 * set + 1.42 * wind - .5 * fire;
        r.shoulderR.rotation.x = -.7 * set;               // right hand braces the housing
        r.shoulderR.rotation.z = -.55 * set;
        r.elbowR.rotation.x = -1.6 * set;
        r.spine.rotation.y = -.42 * set + .62 * wind;
        r.spine.rotation.x = -.16 * set + .2 * wind + .34 * fire;
        r.neck.rotation.y = .3 * set - .44 * wind;
        r.hips.rotation.y = -.24 * set + .36 * wind;
        /* both feet planted wide: nothing about this move moves him */
        r.hipL.rotation.x = -.6 * set + .18 * fire; r.kneeL.rotation.x = .95 * set;
        r.hipR.rotation.x = .34 * set - .2 * fire; r.kneeR.rotation.x = .62 * set;
        r.hips.position.y = r.hipsBaseY - .55 * set - .16 * fire;
        return true;
      }
      case 'kr': {                        // arms locked out, and hold on
        rp(r);
        var lock = out(Math.min(1, t / .6));
        var spun = t > .85 ? Math.min(1, (t - .85) / .4) : 0;
        var shake = Math.sin(t * 46) * .05 * spun;
        /* straight out to the sides, because the bracers are the weapon
           and the arms are what swings them */
        r.shoulderL.rotation.x = -.2 * lock;
        r.shoulderR.rotation.x = -.2 * lock;
        r.shoulderL.rotation.z = 1.62 * lock;
        r.shoulderR.rotation.z = -1.62 * lock;
        r.elbowL.rotation.x = -.1 * lock; r.elbowR.rotation.x = -.1 * lock;
        r.spine.rotation.x = .2 * lock + shake;
        r.spine.rotation.z = shake * 2;
        r.neck.rotation.x = .34 * lock;
        r.hipL.rotation.x = -.34 * lock; r.kneeL.rotation.x = .66 * lock;
        r.hipR.rotation.x = -.3 * lock; r.kneeR.rotation.x = .6 * lock;
        r.hips.position.y = r.hipsBaseY - .36 * lock + shake;
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
      case 'k4': return stepPile(a, dt);
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
    else if (e.code === 'Digit4') castPile();
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

  /* A spectator sees the same thing he does: the gear bolted to the arm of
     the body that is casting. If that body has not arrived on this screen
     yet, it falls back to a piece standing in the world so the move still
     reads rather than not happening at all. */
  function remoteMount(f, right, g, world, yaw) {
    var r = f && f.e && f.e.rig;
    var bone = r ? (right ? r.handR : r.handL) : null;
    if (bone) {
      g.rotation.set(ARM_TURN, 0, 0);
      g.position.set(0, -.15, 0);
      bone.add(g);
    } else {
      g.position.copy(world);
      g.rotation.y = yaw;
      scene.add(g);
    }
    return g;
  }
  function remoteDrop(g, ms) {
    later(ms, function () {
      if (!g) return;
      if (g.parent) g.parent.remove(g);
      g.traverse(function (c) {
        if (c.isMesh) { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); }
      });
    });
  }
  /* where a remote piece has got to */
  function remoteTip(g, along) {
    g.updateWorldMatrix(true, false);
    return g.localToWorld(new THREE.Vector3(0, 0, along));
  }

  MU.remote = {
    k1: function (pos, yaw, f) {
      var d = dirOf(yaw);
      var g = remoteMount(f, true, buildArmCannon(),
        pos.clone().addScaledVector(d, 1.4).add(new THREE.Vector3(0, 3.1, 0)), yaw);
      unfold(g, .34);
      later(510, function () {
        if (!g.parent) return;
        var muzzle = remoteTip(g, 2);
        FX.impact(muzzle.clone(), FLASH, 3);
        FX.speedRing(muzzle.clone(), HOT, 9, .22);
        exhaust(remoteTip(g, -1), d, 9);
        sparks(muzzle.clone(), 10);
        fireShell(muzzle, d.clone(), true);
      });
      remoteDrop(g, 880);
    },
    k2: function (pos, yaw, f) {
      var d = dirOf(yaw);
      var g = remoteMount(f, true, buildArmFist(),
        pos.clone().addScaledVector(d, 1.4).add(new THREE.Vector3(0, 2.9, 0)), yaw);
      unfold(g, .24);
      var sock = null;
      later(390, function () {
        if (!g.parent) return;
        /* the same piece leaves the arm it was on, exactly as it does for
           whoever threw it */
        handOff(g);
        var from = g.position.clone();
        sock = remoteMount(f, true, buildSocket(),
          pos.clone().add(new THREE.Vector3(0, 2.9, 0)), yaw);
        FX.speedRing(from.clone(), HOT, 10, .24);
        exhaust(from.clone().addScaledVector(d, -1.6), d, 8);
        throwFist(from, d.clone(), true, g, function () { remoteDrop(sock, 0); });
        remoteDrop(sock, 3400);
      });
    },
    k3: function (pos, yaw, f) {
      var d = dirOf(yaw);
      var g = remoteMount(f, true, buildHandDrill(),
        pos.clone().addScaledVector(d, 1.8).add(new THREE.Vector3(0, 2.7, 0)), yaw);
      unfold(g, .3);
      var t = 0, loose = !(f && f.e && f.e.rig);
      addFx({ t: 1e9, update: function (dt) {
        t += dt;
        if (typeof scene === 'undefined' || !g.parent) return false;
        if (t > .34) {
          if (g.__bit) g.__bit.rotation.z += dt * 34;
          /* only a loose fallback has to walk itself forward; one on an arm
             is carried by the arm */
          if (loose && t < 1.15) g.position.addScaledVector(d, 13 * dt);
          if (Math.random() < dt * 26) sparks(remoteTip(g, 2.1), 3);
        }
        return t < 1.35;
      } });
      remoteDrop(g, 1400);
    },
    k4: function (pos, yaw, f) {
      var d = dirOf(yaw);
      var g = remoteMount(f, false, buildBunker(),
        pos.clone().addScaledVector(d, 1.4).add(new THREE.Vector3(0, 2.8, 0)), yaw);
      unfold(g, .3);
      var t = 0;
      addFx({ t: 1e9, update: function (dt) {
        t += dt;
        if (typeof scene === 'undefined' || !g.parent) return false;
        if (g.__pin) {
          var k = t < .48 ? 0
            : t < .48 + PILE.drive ? E.out((t - .48) / PILE.drive)
            : Math.max(0, 1 - (t - .48 - PILE.drive) / .3);
          g.__pin.position.z = k * 1.5;
        }
        return t < 1.1;
      } });
      later(480, function () {
        if (!g.parent) return;
        var muzzle = remoteTip(g, 1.1);
        FX.impact(muzzle.clone(), FLASH, 3.4);
        FX.speedRing(muzzle.clone(), HOT, 10, .22);
        FX.cross(muzzle.clone(), 0xffffff, 3, .2);
        exhaust(remoteTip(g, -1.2), d, 8);
        sparks(muzzle.clone(), 14);
      });
      remoteDrop(g, 1150);
    },
    /* the special: both bracers, and the ground going while he turns */
    kr: function (pos, yaw, f) {
      var gs = [
        remoteMount(f, true, buildBracer(),
          pos.clone().add(new THREE.Vector3(1.8, 3.4, 0)), yaw),
        remoteMount(f, false, buildBracer(),
          pos.clone().add(new THREE.Vector3(-1.8, 3.4, 0)), yaw)
      ];
      gs.forEach(function (g) { unfold(g, .42); });
      FX.cracks(new THREE.Vector3(pos.x, .06, pos.z), 14, 18, 0x3a3f46);
      var t = 0;
      addFx({ t: 1e9, update: function (dt) {
        t += dt;
        if (typeof scene === 'undefined') return false;
        var here = (f && f.e) ? f.e.pos : pos;
        if (t > .85) {
          var w = Math.min(1, (t - .85) / .5);
          gs.forEach(function (g) { if (g.parent) exhaustTrail(g, dt * 18 * w); });
          if (Math.random() < dt * 40) {
            var ang = Math.random() * TAU;
            sparks(here.clone().add(new THREE.Vector3(
              Math.cos(ang) * 7, 1 + Math.random() * 6, Math.sin(ang) * 7)), 2);
          }
          if (Math.random() < dt * 26) {
            FX.speedRing(here.clone().add(new THREE.Vector3(0, 3 + Math.random() * 4, 0)),
              HOT, 12 + Math.random() * 8, .2);
          }
        }
        if (t > SPIN.dur + .4) {
          FX.rings(new THREE.Vector3(here.x, .12, here.z), HOT, 5,
            { maxR: SPIN.radius * 2.4, life: .9, gap: 34 });
          FX.dust(new THREE.Vector3(here.x, 0, here.z), 16, 0x9aa0a8, 20, 6);
          gs.forEach(function (g) { if (g.parent) scrap(handOff(g), null); });
          return false;
        }
        return true;
      } });
    }
  };

  /* the pieces the finishers borrow. They still build at full size in open
     air, because a finisher is a set piece and a cannon the size of a car
     is the point of one of them — assemble and scrap are theirs now. */
  MU.exhaust = exhaust;
  MU.chain = chainTo;
  MU.mount = mount;
  MU.handOff = handOff;
  MU.tipOf = tipOf;
  MU.IRON = IRON; MU.GUN = GUN; MU.STEEL = STEEL; MU.PALE = PALE;
  MU.COP = COP; MU.WARN = WARN; MU.HOT = HOT; MU.FLASH = FLASH; MU.LENS = LENS;
  // The AI invokes these same casts and the shared action/pose dispatchers.
  (window.JJCHARCAST ||= {}).muta = { cast: [castCannon, castFist, castDrill, castPile, castSpin], state: MU };
})();
