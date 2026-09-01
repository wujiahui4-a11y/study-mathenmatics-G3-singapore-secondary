/* =======================================================================
   YUJI ITADORI
   A third fighter, built the way the other two are: a rig config, an
   entry in CHARS, and a handful of moves that live in stepAction and
   poseAction.

   He has no technique, so everything he does is thrown with his body.
   That is the whole brief for the animation here — every move starts
   from the floor, turns the hips before the shoulders, and finishes
   past the target rather than at it. All of it runs through the spring
   layer, so the fist arrives after the hip and the follow through is
   real rather than drawn.

     1  DIVERGENT FIST     the punch lands, and then it lands again
     2  BLACK FLASH        a hundredth of a second, and the room goes out
     3  MANJI KICK         a turning kick that takes them up with it
     4  CRUSHING BLOW      up, and back down through the floor
     R  SURGE              output dumped all at once, to make room

   F wakes the thing living in him up.
   ===================================================================== */
(function () {
  'use strict';
  if (typeof player === 'undefined' || typeof THREE === 'undefined') return;
  var FX = window.JJFX;
  if (!FX) return;
  var AN = window.JJANIM;

  var YUJI_CFG = {
    yuji: true, face: true,
    torso: 0x20263a, pants: 0x1a1f2b, shoes: 0x262a33, skin: 0xf6cba4
  };

  /* ---------------------------------------------------------------- rig */
  var _makeAnimeRig = makeAnimeRig;
  makeAnimeRig = function (cfg) {
    var r = _makeAnimeRig(cfg);
    if (!cfg || !cfg.yuji) return r;
    var head = r.head, pink = 0xf07a8c, pinkD = 0xd45c72;

    function box(w, h, d, c) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({ color: c, roughness: .72 }));
      m.castShadow = true;
      return m;
    }
    /* the crop: a flat cap of hair with the sides shaved back */
    var cap = box(1.02, .3, 1.0, pink); cap.position.set(0, .98, -.02); head.add(cap);
    var backh = box(.98, .5, .24, pinkD); backh.position.set(0, .72, -.42); head.add(backh);
    var i;
    for (i = 0; i < 6; i++) {                      // spikes, standing up and back
      var s = box(.2, .26 + Math.random() * .22, .2, i % 2 ? pink : pinkD);
      s.position.set(-.4 + i * .16, 1.2, -.06 - (i % 2) * .1);
      s.rotation.x = .3 + Math.random() * .2;
      s.rotation.z = (i - 2.5) * .08;
      head.add(s);
    }
    for (i = -1; i <= 1; i += 2) {                 // shaved sides
      var side = box(.1, .34, .8, pinkD);
      side.position.set(i * .5, .84, -.04);
      head.add(side);
    }
    var fringe = box(.86, .2, .12, pink);          // a short fringe
    fringe.position.set(0, .84, .44);
    head.add(fringe);

    /* the school uniform's standing collar */
    var collar = box(.98, .38, .74, 0x161a26);
    collar.position.set(0, 1.06, 0);
    r.spine.add(collar);
    var zip = box(.08, .9, .06, 0x39405a);
    zip.position.set(0, .45, .34);
    r.spine.add(zip);

    /* what shows when the thing inside him is awake */
    var marks = new THREE.Group();
    [[-.24, .72, .46, .3, .05], [.24, .72, .46, .3, .05],
     [-.3, .4, .46, .22, .05], [.3, .4, .46, .22, .05],
     [0, .86, .46, .42, .05]].forEach(function (m) {
      var b = new THREE.Mesh(new THREE.BoxGeometry(m[3], m[4], .04),
        new THREE.MeshBasicMaterial({ color: 0x14060a, toneMapped: false }));
      b.position.set(m[0], m[1], m[2]);
      marks.add(b);
    });
    marks.visible = false;
    head.add(marks);
    r.marks = marks;
    return r;
  };

  /* ------------------------------------------------------------- roster */
  cds.y1 = 0; cds.y2 = 0; cds.y3 = 0; cds.y4 = 0; cds.yr = 0;
  var YCD = { y1: 7, y2: 12, y3: 9, y4: 11, yr: 8 };

  CHARS.yuji = {
    name: 'YUJI ITADORI', sub: 'NO TECHNIQUE \u2014 ALL OF IT BY HAND',
    cfg: YUJI_CFG, glow: '#ff7f9a',
    moves: [
      { key: 'LMB', lbl: 'Punch', cd: 'm1', max: .3 },
      { key: 'Q', lbl: 'Dash', cd: 'dash', max: 1 },
      { key: '1', lbl: 'Divergent Fist', cd: 'y1', max: YCD.y1 },
      { key: '2', lbl: 'Black Flash', cd: 'y2', max: YCD.y2 },
      { key: '3', lbl: 'Manji Kick', cd: 'y3', max: YCD.y3 },
      { key: '4', lbl: 'Crushing Blow', cd: 'y4', max: YCD.y4 },
      { key: 'R', lbl: 'Surge', cd: 'yr', max: YCD.yr }
    ]
  };
  try { CHARS.yuji.portrait = makePortrait(YUJI_CFG); } catch (e) {}
  try { buildCharList(); } catch (e) {}

  /* --------------------------------------------------------------- help */
  function ready(key) {
    return player.char === 'yuji' && !player.dead && !busy() && cds[key] <= 0 &&
      !player.react && !(window.JJNAOYA && window.JJNAOYA.busy());
  }
  function start(type, dur, key, name, sub) {
    cds[key] = YCD[key];
    player.action = { type: type, t: 0, dur: dur, stage: 0 };
    if (name) showSplash(name, sub || '', '#ff7f9a');
    return player.action;
  }
  function aim() {
    return new THREE.Vector3(Math.sin(player.facing), 0, Math.cos(player.facing));
  }
  function fistAt(reach, height) {
    return player.pos.clone().addScaledVector(aim(), reach == null ? 2.4 : reach)
      .add(new THREE.Vector3(0, height == null ? 3 : height, 0));
  }
  function inFront(range, width) {
    var f = aim(), out = [];
    for (var i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      if (!e || e.dead || e.rag) continue;
      var to = e.pos.clone().sub(player.pos); to.y = 0;
      var along = to.dot(f);
      if (along < -1.5 || along > range) continue;
      if (to.addScaledVector(f, -along).length() > (width || 3.4)) continue;
      out.push(e);
    }
    return out;
  }
  function boost() { return (window.JJAW && window.JJAW.yuji) ? 1.35 : 1; }

  /* =====================================================================
     1 · DIVERGENT FIST
     ================================================================== */
  function castDivergent() {
    if (!ready('y1')) return;
    start('y1', 1.05, 'y1', 'DIVERGENT FIST', 'AND AGAIN');
    try { sfx.whoosh(); } catch (e) {}
  }
  function stepDivergent(a, dt) {
    if (a.t >= .40 && a.stage < 1) {                 // the fist arrives
      a.stage = 1;
      a.at = fistAt(2.6, 2.9);
      FX.impact(a.at, 0xffd9a8, 1.5);
      FX.cross(a.at, 0xffffff, 3.4, .2);
      FX.slash(a.at, aim(), 0xffe0c0, 4, .18);
      addShake(.4);
      hitstop(.05);
      inFront(4.4).forEach(function (e) {
        /* barely moves them: the second impact has to find them here */
        e.damage(16 * boost(), aim().multiplyScalar(5).setY(3),
          { react: 'gut', reactDur: .45, spark: 0xffd9a8, noFrameBonus: true });
      });
      try { sfx.hit(); } catch (e) {}
    }
    if (a.t >= .62 && a.stage < 2) {                 // and the rest of it
      a.stage = 2;
      var at = a.at || fistAt(2.6, 2.9);
      FX.flash('#ffe6d0', .3, .3);
      FX.cross(at, 0xffb37a, 7, .3);
      FX.impact(at, 0xff8a5c, 2.4);
      FX.rings(at, 0xff9a6a, 3, { maxR: 11, life: .45, ground: false, gap: 38 });
      FX.ring(new THREE.Vector3(at.x, .1, at.z), 0xffc79a, { maxR: 12, life: .5 });
      FX.streaks(at, 0xffd0a8, 14, 22, 1.6);
      FX.dust(new THREE.Vector3(at.x, 0, at.z), 6, 0xd8cbb8, 9, 3);
      FX.zoom(9, .4);
      addShake(1);
      hitstop(.1);
      inFront(6.5, 4.6).forEach(function (e) {
        e.damage(24 * boost(), aim().multiplyScalar(34).setY(15),
          { react: 'stagger', reactDur: .7, spark: 0xff8a5c });
      });
      try { sfx.redBoom(); } catch (e) {}
    }
  }

  /* =====================================================================
     2 · BLACK FLASH
     ================================================================== */
  function castBlackFlash() {
    if (!ready('y2')) return;
    start('y2', 1.45, 'y2', 'BLACK FLASH', '0.000001 SECONDS');
    FX.tint('#0a0006', .35, 1.2);
    try { sfx.raise(); } catch (e) {}
  }
  function stepBlackFlash(a, dt) {
    var p = player;
    if (a.t < .58) {                                 // gathering it into one fist
      if (!a.orb) a.orb = FX.orb(0x8b0f2a, .8);
      var h = p.rig.handR ? handWorld(p.rig.handR) : fistAt(1.2, 2.8);
      a.orb.set(h);
      a.orb.step(dt, .3 + a.t / .58 * .7);
      if (Math.random() < .9) FX.mote(h, 0x2a0410, 5, .26);
      if (Math.random() < .5) FX.streaks(h, 0xd4143c, 1, 6, .8);
      if (Math.random() < .25) addShake(.12);
      return;
    }
    if (a.stage < 1) {                               // the step in
      a.stage = 1;
      if (AN) AN.camKick(.4);
      FX.trail(p.rig, 0xd4143c, 3, 34, .4);
    }
    if (a.t >= .74 && a.stage < 2) {
      a.stage = 2;
      if (a.orb) { a.orb.dispose(); a.orb = null; }
      var at = fistAt(2.7, 2.9);
      blackFlash(at);
      var hits = inFront(5.4, 4);
      hits.forEach(function (e) {
        e.damage(52 * boost(), aim().multiplyScalar(46).setY(20),
          { react: 'stagger', reactDur: .95, spark: 0xd4143c });
      });
      if (window.JJAW && hits.length) window.JJAW.gain(14);
    }
  }

  /* The one effect in the game that is mostly absence: the frame goes
     out, then comes back white, and what is left behind is black line
     work rather than light. */
  function blackFlash(at) {
    FX.flash('#04000a', .95, .1);
    setTimeout(function () { FX.flash('#ffffff', .92, .4); }, 110);
    FX.mangaLines(true, .55);

    /* black cracks thrown out through the air */
    for (var i = 0; i < 14; i++) {
      var a = (i / 14) * Math.PI * 2 + Math.random() * .4;
      var len = 7 + Math.random() * 9;
      var m = FX.billboard(FX.T.bolt, 0x0a0008, .95, false);
      m.position.copy(at);
      m.renderOrder = 8;
      scene.add(m);
      (function (m, a, len) {
        var life = .34 + Math.random() * .2, t = 0;
        var roll = a;
        addFx({ t: life, update: function (dt) {
          this.t -= dt; t += dt;
          var k = 1 - this.t / life;
          FX.faceCam(m, roll);
          m.scale.set(len * Math.min(1, k * 7), (1.1 + Math.random() * .5) * (1 - k * .5), 1);
          m.position.copy(at).add(new THREE.Vector3(
            Math.cos(a) * len * .5 * Math.min(1, k * 7), Math.sin(a) * len * .35 * Math.min(1, k * 7), 0));
          m.material.opacity = .95 * (1 - k * k);
          if (this.t <= 0) { scene.remove(m); m.material.dispose(); return false; }
          return true;
        } });
      })(m, a, len);
    }
    FX.cross(at, 0xd4143c, 9, .34);
    FX.impact(at, 0xff2a4a, 2.8);
    FX.speedRing(at, 0x8b0f2a, 13, .45);
    FX.rings(at, 0xd4143c, 4, { maxR: 15, life: .55, ground: false, gap: 36 });
    FX.ring(new THREE.Vector3(at.x, .1, at.z), 0x8b0f2a, { maxR: 16, life: .6 });
    FX.debris(new THREE.Vector3(at.x, 0, at.z), 12, 17, 0x2a1218);
    FX.cracks(new THREE.Vector3(at.x, 0, at.z), 9, 13, 0x120309);
    FX.zoom(22, .8);
    addShake(2.2);
    hitstop(.26);
    try { sfx.redBoom(); } catch (e) {}
  }

  /* =====================================================================
     3 · MANJI KICK
     ================================================================== */
  function castManji() {
    if (!ready('y3')) return;
    start('y3', 1.05, 'y3', 'MANJI KICK', 'UP YOU GO');
    try { sfx.whoosh(); } catch (e) {}
  }
  function stepManji(a, dt) {
    if (a.t > .22 && a.t < .58 && Math.random() < .7) {
      FX.streaks(fistAt(1.6, 2 + Math.random() * 2.4), 0xffc0cc, 1, 9, 1);
    }
    if (a.t >= .42 && a.stage < 1) {
      a.stage = 1;
      var at = fistAt(2.4, 2.2);
      FX.slash(at, aim(), 0xffd0da, 6.5, .22);
      FX.slash(at.clone().add(new THREE.Vector3(0, 1.2, 0)),
        new THREE.Vector3(0, 1, 0).add(aim()).normalize(), 0xffffff, 5, .2);
      FX.impact(at, 0xff9fb0, 1.9);
      FX.ring(new THREE.Vector3(at.x, .1, at.z), 0xff9fb0, { maxR: 9, life: .45 });
      FX.zoom(7, .4);
      addShake(.8);
      hitstop(.09);
      inFront(4.6, 3.6).forEach(function (e) {
        var kb = aim().multiplyScalar(13);
        kb.y = 32;                                   // straight up with him
        e.damage(23 * boost(), kb, { react: 'head', reactDur: .6, spark: 0xff9fb0 });
      });
      try { sfx.hit(); } catch (e) {}
    }
  }

  /* =====================================================================
     4 · CRUSHING BLOW
     ================================================================== */
  function castCrush() {
    if (!ready('y4')) return;
    var a = start('y4', 1.3, 'y4', 'CRUSHING BLOW', 'ALL OF HIS WEIGHT');
    a.y0 = player.pos.y;
    try { sfx.whoosh(); } catch (e) {}
  }
  function stepCrush(a, dt) {
    var p = player;
    /* he actually leaves the ground for it */
    if (a.t < .38) {
      p.pos.y = a.y0 + Math.sin(a.t / .38 * Math.PI * .5) * 5.4;
      p.onGround = false;
    } else if (a.t < .62) {
      p.pos.y = a.y0 + 5.4 + Math.sin((a.t - .38) / .24 * Math.PI) * .5;
      if (Math.random() < .5) FX.streaks(p.pos.clone().add(new THREE.Vector3(0, 3, 0)), 0xffc0cc, 1, 6, .9);
    } else if (a.t < .74) {
      var f = (a.t - .62) / .12;
      p.pos.y = a.y0 + 5.4 * (1 - f * f);
      if (AN) AN.camKick(.3);
    } else {
      p.pos.y = a.y0;
      p.onGround = true;
    }

    if (a.t >= .74 && a.stage < 1) {
      a.stage = 1;
      var at = p.pos.clone().addScaledVector(aim(), 1.6);
      FX.flash('#ffe0e6', .4, .35);
      FX.cross(at.clone().add(new THREE.Vector3(0, 1.4, 0)), 0xffffff, 7, .3);
      FX.impact(at.clone().add(new THREE.Vector3(0, 1, 0)), 0xff9fb0, 3);
      FX.rings(new THREE.Vector3(at.x, .12, at.z), 0xffb0bd, 4, { maxR: 17, life: .65, gap: 45 });
      FX.cracks(new THREE.Vector3(at.x, 0, at.z), 12, 17, 0x241016);
      FX.debris(new THREE.Vector3(at.x, 0, at.z), 16, 19, 0x5a4a44);
      FX.dust(new THREE.Vector3(at.x, 0, at.z), 12, 0xd8cbc4, 14, 4.5);
      FX.zoom(15, .6);
      addShake(1.7);
      hitstop(.16);
      enemies.forEach(function (e) {
        if (!e || e.dead || e.rag) return;
        var d = e.pos.clone().sub(at); d.y = 0;
        var dist = d.length();
        if (dist > 9) return;
        d.normalize().multiplyScalar(30 * (1.2 - dist / 9 * .6));
        d.y = 16;
        e.damage(30 * boost() * (1.1 - dist / 9 * .4), d,
          { react: 'gut', reactDur: .7, spark: 0xff9fb0 });
      });
      try { sfx.redBoom(); } catch (e) {}
    }
  }

  /* =====================================================================
     R · SURGE
     ================================================================== */
  function castSurge() {
    if (!ready('yr')) return;
    start('yr', .75, 'yr', 'SURGE', 'GET OFF');
    try { sfx.raise(); } catch (e) {}
  }
  function stepSurge(a, dt) {
    if (a.t >= .22 && a.stage < 1) {
      a.stage = 1;
      var at = player.pos.clone().add(new THREE.Vector3(0, 2.4, 0));
      FX.flash('#ffd9e2', .35, .3);
      FX.speedRing(at, 0xff7f9a, 11, .4);
      FX.rings(at, 0xff9fb0, 3, { maxR: 14, life: .5, ground: false, gap: 40 });
      FX.ring(new THREE.Vector3(player.pos.x, .1, player.pos.z), 0xff7f9a, { maxR: 15, life: .55 });
      FX.streaks(at, 0xffd0da, 18, 20, 1.5);
      FX.dust(player.pos.clone(), 8, 0xd8cbc4, 10, 3.4);
      FX.zoom(-8, .5);
      addShake(.9);
      player.dashCh = player.char === 'naoya' ? 2 : 1;
      player.iframes = Math.max(player.iframes, .45);
      enemies.forEach(function (e) {
        if (!e || e.dead || e.rag) return;
        var d = e.pos.clone().sub(player.pos); d.y = 0;
        var dist = d.length();
        if (dist > 11) return;
        d.normalize().multiplyScalar(34);
        d.y = 13;
        e.damage(10 * boost(), d, { react: 'stagger', reactDur: .6, spark: 0xff7f9a });
      });
    }
  }

  /* =====================================================================
     POSES
     Written as targets. The spring layer is what turns them into
     movement, so these are extremes rather than a finished curve.
     ================================================================== */
  var E = FX.ease;
  function rp(r) { resetPose(r); if (r.body) r.body.rotation.set(0, 0, 0); }
  function W(r, s) { if (AN) AN.weight(r, s, 1); }

  /* the shape every one of his punches passes through */
  function punchShape(r, coil, out, arm) {
    var sh = arm < 0 ? r.shoulderL : r.shoulderR;
    var el = arm < 0 ? r.elbowL : r.elbowR;
    var osh = arm < 0 ? r.shoulderR : r.shoulderL;
    var oel = arm < 0 ? r.elbowR : r.elbowL;
    var lead = arm < 0 ? 'R' : 'L', rear = arm < 0 ? 'L' : 'R';
    sh.rotation.x = -.3 + 1.1 * coil - 2.55 * out;
    sh.rotation.z = arm * (-.55 * coil + .5 * out);
    el.rotation.x = -1.95 * coil + 1.9 * out;
    osh.rotation.x = -.4 - .7 * coil + .45 * out;
    osh.rotation.z = arm * (.35 * coil - .6 * out);
    oel.rotation.x = -1.1 - .6 * coil + .3 * out;
    r.hips.rotation.y = arm * (.42 * coil - .75 * out);
    r.spine.rotation.y = arm * (.72 * coil - 1.25 * out);
    r.spine.rotation.x = .16 + .24 * coil - .42 * out;
    r.spine.rotation.z = arm * (-.1 * coil + .16 * out);
    r.neck.rotation.y = arm * (-.4 * coil + .6 * out);
    r.neck.rotation.x = .1 * coil - .16 * out;
    r['hip' + rear].rotation.x = -.4 * coil + .18 * out;
    r['knee' + rear].rotation.x = .8 * coil - .6 * out;
    r['ankle' + rear].rotation.x = -.3 * coil + .6 * out;
    r['hip' + lead].rotation.x = .3 * coil - .42 * out;
    r['knee' + lead].rotation.x = .45 * coil + .4 * out;
    r.hips.position.y = r.hipsBaseY - .55 * coil + .22 * out;
    W(r, (arm < 0 ? 1 : -1) * (.5 * coil - .9 * out));
  }

  function poseYuji(r, a) {
    var t = a.t;
    switch (a.type) {
      case 'y1': {
        rp(r);
        /* coil, throw, and then a second shove off the same arm */
        var coil = t < .28 ? E.out(t / .28) : Math.max(0, 1 - (t - .28) / .12);
        var out = t < .28 ? 0 : Math.min(1, (t - .28) / .12);
        if (t > .62) out = 1 + Math.min(1, (t - .62) / .1) * .1;      // the shove
        if (t > .82) out = 1.1 - E.out((t - .82) / .23) * .75;        // and back
        punchShape(r, coil, out, 1);
        return true;
      }
      case 'y2': {
        rp(r);
        if (t < .58) {                                // low, coiled, loading it
          var c = E.out(t / .58);
          punchShape(r, c * .92, 0, 1);
          r.spine.rotation.x = .16 + .4 * c;
          r.neck.rotation.x = .2 * c;
          r.hips.position.y = r.hipsBaseY - .8 * c;
          r.kneeL.rotation.x = .95 * c; r.kneeR.rotation.x = .8 * c;
        } else if (t < .74) {                         // in
          var s = E.out((t - .58) / .16);
          punchShape(r, .92 - .3 * s, .35 * s, 1);
        } else {                                      // through
          var o = Math.min(1, (t - .74) / .1);
          var back = t > 1.05 ? E.out((t - 1.05) / .4) : 0;
          punchShape(r, 0, 1.12 * o - .85 * back, 1);
          r.spine.rotation.x -= .12 * o;
        }
        return true;
      }
      case 'y3': {
        rp(r);
        if (t < .22) {                                // load the standing leg
          var k = E.out(t / .22);
          r.hips.position.y = r.hipsBaseY - .7 * k;
          r.kneeL.rotation.x = .9 * k; r.kneeR.rotation.x = .75 * k;
          r.spine.rotation.x = .3 * k;
          r.spine.rotation.y = .5 * k;
          r.shoulderL.rotation.x = -.9 * k; r.shoulderR.rotation.x = -.4 * k;
          r.elbowL.rotation.x = -1.3 * k;
          W(r, .5 * k);
        } else {                                      // and turn through it
          var s2 = Math.min(1, (t - .22) / .34);
          var down = t > .62 ? E.out((t - .62) / .43) : 0;
          player.visYaw = -s2 * Math.PI * 2 * (1 - down * .0);
          r.hips.position.y = r.hipsBaseY - .7 + 1.1 * s2 - .6 * down;
          r.hipR.rotation.x = -1.9 * s2 + 1.6 * down;   // the leg that goes up
          r.hipR.rotation.z = -.5 * s2 + .4 * down;
          r.kneeR.rotation.x = .3 * s2 + .5 * down;
          r.hipL.rotation.x = .5 * s2 - .5 * down;
          r.kneeL.rotation.x = .4 - .2 * s2 + .5 * down;
          r.spine.rotation.x = .3 - .7 * s2 + .5 * down;
          r.spine.rotation.z = .35 * s2 - .3 * down;
          r.shoulderL.rotation.x = -.9 - 1.1 * s2 + 1.3 * down;
          r.shoulderL.rotation.z = .7 * s2;
          r.shoulderR.rotation.x = -.4 - .8 * s2 + .9 * down;
          r.shoulderR.rotation.z = -.6 * s2;
          r.elbowL.rotation.x = -1.3 + .8 * s2;
          r.elbowR.rotation.x = -.4 - .5 * s2;
          r.neck.rotation.x = -.3 * s2 + .3 * down;
        }
        return true;
      }
      case 'y4': {
        rp(r);
        if (t < .38) {                                // the jump
          var j = E.out(t / .38);
          r.hips.position.y = r.hipsBaseY - .6 + .6 * j;
          r.hipL.rotation.x = -.4 - .8 * j; r.kneeL.rotation.x = .8 + .9 * j;
          r.hipR.rotation.x = -.3 - .5 * j; r.kneeR.rotation.x = .7 + .6 * j;
          r.shoulderL.rotation.x = -1.2 - 1.5 * j; r.shoulderR.rotation.x = -1.2 - 1.5 * j;
          r.shoulderL.rotation.z = .5 - .3 * j; r.shoulderR.rotation.z = -.5 + .3 * j;
          r.elbowL.rotation.x = -.5 - .3 * j; r.elbowR.rotation.x = -.5 - .3 * j;
          r.spine.rotation.x = .35 - .55 * j;
          r.neck.rotation.x = -.35 * j;
        } else if (t < .74) {                         // hang, then drive down
          var d = t < .62 ? 0 : (t - .62) / .12;
          r.shoulderL.rotation.x = -2.7 + 3.3 * d; r.shoulderR.rotation.x = -2.7 + 3.3 * d;
          r.shoulderL.rotation.z = .2; r.shoulderR.rotation.z = -.2;
          r.elbowL.rotation.x = -.8 + .5 * d; r.elbowR.rotation.x = -.8 + .5 * d;
          r.spine.rotation.x = -.2 + 1.1 * d;
          r.neck.rotation.x = -.35 + .8 * d;
          r.hipL.rotation.x = -1.2 + .8 * d; r.kneeL.rotation.x = 1.7 - .6 * d;
          r.hipR.rotation.x = -.8 + .6 * d; r.kneeR.rotation.x = 1.3 - .5 * d;
        } else {                                      // the landing
          var l = E.out(Math.min(1, (t - .74) / .5));
          r.spine.rotation.x = .9 - .7 * l;
          r.neck.rotation.x = .45 - .4 * l;
          r.shoulderL.rotation.x = .6 - .7 * l; r.shoulderR.rotation.x = .6 - .7 * l;
          r.shoulderL.rotation.z = .4 - .3 * l; r.shoulderR.rotation.z = -.4 + .3 * l;
          r.elbowL.rotation.x = -.3 - .2 * l; r.elbowR.rotation.x = -.3 - .2 * l;
          r.hipL.rotation.x = -.4 + .35 * l; r.kneeL.rotation.x = 1.1 - .95 * l;
          r.hipR.rotation.x = -.35 + .3 * l; r.kneeR.rotation.x = .95 - .85 * l;
          r.hips.position.y = r.hipsBaseY - .95 + .9 * l;
        }
        return true;
      }
      case 'yr': {
        rp(r);
        var b = t < .22 ? E.out(t / .22) : 1;
        var rel = t > .22 ? E.out(Math.min(1, (t - .22) / .3)) : 0;
        r.spine.rotation.x = .5 * b - .75 * rel;      // braced, then thrown open
        r.neck.rotation.x = .3 * b - .6 * rel;
        r.shoulderL.rotation.x = -1.5 * b + .9 * rel;
        r.shoulderR.rotation.x = -1.5 * b + .9 * rel;
        r.shoulderL.rotation.z = .7 * b - 1.1 * rel;
        r.shoulderR.rotation.z = -.7 * b + 1.1 * rel;
        r.elbowL.rotation.x = -1.7 * b + 1.4 * rel;
        r.elbowR.rotation.x = -1.7 * b + 1.4 * rel;
        r.hipL.rotation.x = -.25 * b; r.hipR.rotation.x = -.25 * b;
        r.kneeL.rotation.x = .7 * b - .4 * rel; r.kneeR.rotation.x = .7 * b - .4 * rel;
        r.hips.position.y = r.hipsBaseY - .6 * b + .55 * rel;
        return true;
      }
    }
    return false;
  }

  /* =====================================================================
     WHAT IS INSIDE HIM
     Not a cutscene — a transformation, held for as long as it lasts.
     ================================================================== */
  function awakenYuji() {
    if (player.char !== 'yuji' || player.dead || busy()) return false;
    var a = start('yaw', 2.4, 'y1', 'SUKUNA\u2019S VESSEL', 'FOR A WHILE');
    cds.y1 = 0;
    player.iframes = Math.max(player.iframes, 2.8);
    FX.letterbox(true);
    FX.tint('#12000a', .5, 2.4);
    if (window.MPJJ && window.MPJJ.relay) {
      window.MPJJ.relay.pub({ t: 'cast', id: window.MPJJ.id, k: 'yaw' });
    }
    return true;
  }
  function stepAwaken(a, dt) {
    var p = player;
    p.vel.set(0, 0, 0);
    if (Math.random() < .8) {
      FX.mote(p.pos.clone().add(new THREE.Vector3(0, 2.8, 0)), 0x8b0f2a, 7, .45);
    }
    if (a.t >= .9 && a.stage < 1) {                  // the markings come up
      a.stage = 1;
      if (p.rig.marks) p.rig.marks.visible = true;
      FX.flash('#2a000e', .7, .3);
      FX.cross(p.pos.clone().add(new THREE.Vector3(0, 4.2, 0)), 0xd4143c, 5, .35);
      FX.impact(p.pos.clone().add(new THREE.Vector3(0, 4.2, 0)), 0x8b0f2a, 2);
      addShake(.9);
      hitstop(.12);
      try { sfx.frame(); } catch (e) {}
    }
    if (a.t >= 1.5 && a.stage < 2) {                 // and the rest of it
      a.stage = 2;
      FX.rings(new THREE.Vector3(p.pos.x, .12, p.pos.z), 0xd4143c, 4, { maxR: 20, life: .75, gap: 60 });
      FX.beam(p.pos.clone(), new THREE.Vector3(0, 1, 0), 46, 0x8b0f2a, { radius: 1.5, life: 1 });
      FX.debris(p.pos.clone(), 12, 15, 0x2a1218);
      FX.cracks(p.pos.clone(), 10, 13, 0x120309);
      FX.flash('#ff2a4a', .45, .5);
      FX.zoom(-11, .7);
      addShake(1.3);
      try { sfx.raise(); } catch (e) {}
      if (window.JJAW) {
        window.JJAW.yuji = true;
        if (!window.JJAW.yujiAura) {
          window.JJAW.yujiAura = FX.aura(function () { return player.pos; }, 0xd4143c);
        }
        window.JJAW.yujiT = 26;
      }
    }
    if (a.t >= a.dur - .1) FX.letterbox(false);
  }
  function poseAwaken(r, a) {
    rp(r);
    var t = a.t, E2 = E.out;
    if (t < .9) {                                    // a hand over his own face
      var k = E2(t / .9);
      r.shoulderR.rotation.x = -.3 - 2.4 * k;
      r.shoulderR.rotation.z = -.2 - .3 * k;
      r.elbowR.rotation.x = -.5 - 1.5 * k;
      r.shoulderL.rotation.x = -.4 - .5 * k;
      r.elbowL.rotation.x = -.8 - .7 * k;
      r.spine.rotation.x = .2 + .45 * k;
      r.neck.rotation.x = .35 * k;
      r.hips.position.y = r.hipsBaseY - .8 * k;
      r.kneeL.rotation.x = .9 * k; r.kneeR.rotation.x = .8 * k;
      W(r, -.3 * k);
    } else {                                         // and it comes away
      var k2 = E2(Math.min(1, (t - .9) / .8));
      var roar = Math.sin(Math.min(1, (t - .9) / 1.2) * Math.PI);
      r.shoulderR.rotation.x = -2.7 + 1.9 * k2;
      r.shoulderR.rotation.z = -.5 - .5 * k2;
      r.elbowR.rotation.x = -2 + 1.4 * k2;
      r.shoulderL.rotation.x = -.9 - 1 * k2;
      r.shoulderL.rotation.z = .6 * k2;
      r.elbowL.rotation.x = -1.5 + .9 * k2;
      r.spine.rotation.x = .65 - 1 * k2;             // arched back
      r.neck.rotation.x = .35 - .95 * k2;
      r.hips.position.y = r.hipsBaseY - .8 + .7 * k2 + .18 * roar;
      r.hipL.rotation.x = -.3 * k2; r.hipR.rotation.x = -.3 * k2;
      r.kneeL.rotation.x = .9 - .75 * k2; r.kneeR.rotation.x = .8 - .7 * k2;
    }
  }

  /* =====================================================================
     WIRING
     ================================================================== */
  var _stepAction = stepAction;
  stepAction = function (a, dt) {
    switch (a.type) {
      case 'y1': return stepDivergent(a, dt);
      case 'y2': return stepBlackFlash(a, dt);
      case 'y3': return stepManji(a, dt);
      case 'y4': return stepCrush(a, dt);
      case 'yr': return stepSurge(a, dt);
      case 'yaw': return stepAwaken(a, dt);
    }
    return _stepAction(a, dt);
  };

  var _poseAction = poseAction;
  poseAction = function (r, a) {
    if (a.type === 'yaw') { poseAwaken(r, a); return; }
    if (poseYuji(r, a)) return;
    return _poseAction(r, a);
  };

  /* his own keys: the game's handler only knows two fighters */
  window.addEventListener('keydown', function (e) {
    if (!started || player.char !== 'yuji' || e.repeat) return;
    if (player.react || (player.action && (player.action.type === 'kb' || player.action.type === 'void'))) {
      if (window.JJNOTICE && Math.random() < .5) window.JJNOTICE('NO TECHNIQUE WHILE HIT', '#ff8b98');
      return;
    }
    if (e.code === 'Digit1') castDivergent();
    else if (e.code === 'Digit2') castBlackFlash();
    else if (e.code === 'Digit3') castManji();
    else if (e.code === 'Digit4') castCrush();
    else if (e.code === 'KeyR') castSurge();
  });

  /* F: the meter is shared, and this is what he spends it on */
  window.addEventListener('keydown', function (e) {
    if (e.code !== 'KeyF' || e.repeat || !started) return;
    if (player.char !== 'yuji') return;
    var A = window.JJAW;
    if (!A || !A.ready || A.active || A.cine || A.yuji) return;
    if (window.JJNAOYA && window.JJNAOYA.busy()) return;
    if (awakenYuji()) { A.charge = 0; A.ready = false; }
  });

  /* --------------------------------------------------------- per frame */
  var SM = null, SMEAR = {};
  var _updatePlayer = updatePlayer;
  updatePlayer = function (dt) {
    _updatePlayer(dt);
    if (player.char !== 'yuji') { SM = null; return; }

    /* the borrowed power runs out */
    var A = window.JJAW;
    if (A && A.yuji) {
      A.yujiT -= dt;
      if (Math.random() < .3) {
        FX.streaks(player.pos.clone().add(new THREE.Vector3(
          (Math.random() - .5) * 2, .5 + Math.random() * 4, (Math.random() - .5) * 2)),
          0xd4143c, 1, 5, .8);
      }
      if (A.yujiT <= 0) {
        A.yuji = false;
        if (A.yujiAura) { A.yujiAura.stop(); A.yujiAura = null; }
        if (player.rig.marks) player.rig.marks.visible = false;
        if (window.JJNOTICE) window.JJNOTICE('IT WENT BACK TO SLEEP', '#c08b95');
        FX.ring(new THREE.Vector3(player.pos.x, .1, player.pos.z), 0x8b0f2a, { maxR: 9, life: .6 });
      }
    }

    /* His moves are posed as extremes and sprung into shape, which is
       what gives them a follow through. Locomotion is left alone — a
       spring on walking is just input lag. */
    if (!AN) return;
    var a = player.action, on = a && (a.type.charAt(0) === 'y');
    if (on) {
      if (!SM) { SM = AN.smoother(player.rig); SM.snap(); SMEAR = {}; }
      AN.smear(player.rig, SM.step(dt), SMEAR,
        dt, (A && A.yuji) ? 0xd4143c : 0xffb0bd, 7);
    } else if (SM) {
      if (SM.step(dt) < 1.2) SM = null;             // let it settle, then let go
    }
  };

  /* death drops it, and so does being knocked out of the transformation
     half way through — the markings should never outlast the power */
  addFx({ t: 1e9, update: function () {
    var A = window.JJAW;
    var mid = player.action && player.action.type === 'yaw';
    if (player.rig && player.rig.marks && player.rig.marks.visible &&
        !mid && !(A && A.yuji)) {
      player.rig.marks.visible = false;
    }
    if (A && A.yuji && player.dead) {
      A.yuji = false;
      A.yujiT = 0;
      if (A.yujiAura) { A.yujiAura.stop(); A.yujiAura = null; }
      if (player.rig.marks) player.rig.marks.visible = false;
    }
    return true;
  } });

  window.JJYUJI = { cfg: YUJI_CFG, blackFlash: blackFlash };
})();
