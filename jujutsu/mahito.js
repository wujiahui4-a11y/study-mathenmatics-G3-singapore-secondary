/* =======================================================================
   MAHITO
   Idle Transfiguration 無為転変. He does not hit souls, he RESHAPES them,
   and the shape a thing ends up in is the whole point of him — so every
   move in this file changes the form of something that already existed
   rather than throwing a new thing at it.

     1  IDLE TRANSFIGURATION  無為転変 — he reaches out, and whatever the
                              palm lands on stops being the shape it was
     2  TRANSFIGURED HUMAN    改造人間 — one he already reshaped, sent at
                              them on the wrong number of legs
     3  BODY REPEL            身体潰変 — his own arm, opened out into a
                              blade of flesh and bone, and swung
     4  POLYMORPHIC SOUL      多重魂 — a great many of them fused into one
        ISOMER                mass of hands and faces, rolled forward
     R  RESHAPE               蠢動 — he goes soft, pours out of the way,
                              and the shell he left bursts

   Two rules hold the look together:

     · THE SEAM. Every single thing here is stitched. He is stitched, the
       transfigured are stitched, the blade is stitched down its spine
       and the mass is nothing but seams. It is drawn as real dashes on a
       line rather than a texture, so it reads at any distance.
     · SOUL LIGHT IS COLD AND FLESH IS NOT. The cursed energy is a pale
       sick teal on additive blending. Flesh — his, theirs, the mass — is
       muted red on NORMAL blending and never glows, the same rule the
       blood kit is under. A glowing chunk of meat reads as a spark.
   ===================================================================== */
(function () {
  'use strict';
  if (typeof player === 'undefined' || typeof THREE === 'undefined') return;
  var FX = window.JJFX;
  if (!FX || typeof CHARS === 'undefined') return;
  var AN = window.JJANIM;
  var E = FX.ease;
  var TAU = Math.PI * 2;

  /* the soul, which glows; and the body, which does not */
  var SOUL = 0x6fe0cf, SOUL2 = 0xc6fbf1, SOUL_D = 0x2f8f86;
  var MEAT = 0x8a3a4c, MEAT_D = 0x55202f, BONE = 0xd6ccbb;
  var SKIN = 0xb7c1c8, SKIN_D = 0x7e8b95, SEAM = 0x2a3138;
  var COAT = 0x333a48, COAT_D = 0x20262f;

  var MH = window.JJMAHITO = { pets: [], warped: [] };

  var TCD = { t1: 7, t2: 10, t3: 9, t4: 18, tr: 11 };

  var MAHITO_CFG = {
    mahito: true, face: false,
    torso: COAT, pants: 0x1f232c, shoes: 0x12141a, skin: SKIN
  };

  /* ---------------------------------------------------------------- rig
     The two things everybody draws about him: the seam that runs across
     his face and over his scalp, and the blue-grey bob that is cut off
     square at the jaw. The stitches are real geometry — a row of little
     bars along the seam — because a painted stitch disappears at six
     metres and a modelled one does not.
     ================================================================== */
  var _makeAnimeRig = makeAnimeRig;
  makeAnimeRig = function (cfg) {
    var r = _makeAnimeRig(cfg);
    if (!cfg || !cfg.mahito) return r;
    var head = r.head, spine = r.spine;
    var hair = 0x6f8494, hairD = 0x4a5a68;

    function box(w, h, d, c, basic) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), basic
        ? new THREE.MeshBasicMaterial({ color: c, toneMapped: false })
        : new THREE.MeshStandardMaterial({ color: c, roughness: .74 }));
      m.castShadow = !basic;
      return m;
    }
    /* a run of stitches along a line on a parent, as bars across it */
    function stitches(parent, ax, ay, az, bx, by, bz, n, w) {
      for (var i = 0; i < n; i++) {
        var k = (i + .5) / n;
        var bar = box(w || .07, .035, .035, SEAM);
        bar.position.set(ax + (bx - ax) * k, ay + (by - ay) * k, az + (bz - az) * k);
        bar.rotation.z = Math.atan2(by - ay, bx - ax) + Math.PI / 2;
        bar.rotation.y = (i % 2 ? .2 : -.2);
        parent.add(bar);
      }
    }
    var i, s;

    /* the bob: square, chin length, heavier on the left */
    var cap = box(1.06, .40, 1.06, hair); cap.position.set(0, .96, -.02); head.add(cap);
    var back = box(1.02, .78, .40, hairD); back.position.set(0, .62, -.5); head.add(back);
    for (s = -1; s <= 1; s += 2) {
      var side = box(.22, .92, .96, s < 0 ? hair : hairD);
      side.position.set(.48 * s, .56, -.04);
      head.add(side);
      var tip = box(.2, .26, .5, hairD);
      tip.position.set(.48 * s, .10, .1);
      tip.rotation.x = -.2 * s;
      head.add(tip);
    }
    /* The fringe, parted hard to one side and cut ABOVE the eyes. The
       first pass of it hung to y=.57, which is exactly where the eyes
       are, so he had no face at all from the front. */
    for (i = 0; i < 5; i++) {
      var fx = -.42 + i * .21;
      var fr = box(.21, .26 + i * .05, .12, i % 2 ? hair : hairD);
      fr.position.set(fx, 1.0 - i * .03, .49);
      fr.rotation.z = -.34 + i * .12;
      head.add(fr);
    }
    /* one long strand down the left, past the seam — the only part of it
       that comes below the brow */
    var strand = box(.14, .62, .13, hairD);
    strand.position.set(-.44, .74, .44);
    strand.rotation.z = .18;
    head.add(strand);

    /* THE SEAM. Over the scalp, down through the left eye, across the
       cheek — one continuous line, drawn as three runs of stitches. */
    stitches(head, -.46, 1.12, .0, -.10, 1.02, .42, 5, .1);
    stitches(head, -.36, .88, .47, -.30, .46, .47, 5, .095);
    stitches(head, -.30, .46, .47, .34, .18, .45, 6, .085);
    var scar = box(.045, .46, .04, SKIN_D); scar.position.set(-.33, .67, .48); scar.rotation.z = .07; head.add(scar);
    var scar2 = box(.62, .045, .04, SKIN_D); scar2.position.set(.02, .32, .47); scar2.rotation.z = .38; head.add(scar2);

    /* mismatched eyes: the right one wide, the left one a slit through
       the seam. Both on basic material so they hold in the dark. */
    var eR = box(.16, .17, .05, SOUL2, true); eR.position.set(.2, .58, .47); head.add(eR);
    var pR = box(.07, .09, .06, 0x101820, true); pR.position.set(.2, .57, .49); head.add(pR);
    var eL = box(.15, .08, .05, SOUL, true); eL.position.set(-.2, .58, .47); head.add(eL);
    var brR = box(.18, .05, .05, hairD); brR.position.set(.2, .72, .47); brR.rotation.z = -.22; head.add(brR);

    /* the grin, wide and pleased with itself */
    var gr = box(.42, .05, .05, 0x6b3540); gr.position.set(.02, .24, .47); gr.rotation.z = .1; head.add(gr);
    for (i = 0; i < 4; i++) {
      var th = box(.06, .09, .05, 0xe8e2d6);
      th.position.set(-.13 + i * .09, .28 - i * .012, .48);
      head.add(th);
    }

    /* the coat: a high ragged collar, an open front, and seams down it */
    var coll = box(.78, .46, .7, COAT_D); coll.position.set(0, 1.16, -.02); spine.add(coll);
    for (s = -1; s <= 1; s += 2) {
      var pt = box(.24, .5, .12, COAT_D);
      pt.position.set(.3 * s, 1.3, .3);
      pt.rotation.z = -.4 * s; pt.rotation.x = -.3;
      spine.add(pt);
      var lap = box(.26, .9, .12, COAT_D);
      lap.position.set(.26 * s, .66, .3);
      lap.rotation.z = -.16 * s;
      spine.add(lap);
    }
    var vee = box(.34, .5, .1, SKIN); vee.position.set(0, .82, .3); spine.add(vee);
    stitches(spine, -.55, 1.0, .3, -.55, .3, .3, 6, .1);
    stitches(spine, .55, 1.0, .3, .55, .3, .3, 6, .1);
    /* and one across the chest, because he is put together too */
    stitches(spine, -.4, .58, .34, .4, .5, .34, 6, .09);
    return r;
  };

  CHARS.mahito = {
    name: 'MAHITO', sub: 'IDLE TRANSFIGURATION',
    cfg: MAHITO_CFG, glow: '#6fe0cf',
    moves: [
      { key: 'LMB', lbl: 'Punch', cd: 'm1', max: .3 },
      { key: 'Q', lbl: 'Dash', cd: 'dash', max: 1 },
      { key: '1', lbl: 'Transfiguration', cd: 't1', max: TCD.t1 },
      { key: '2', lbl: 'Transfigured', cd: 't2', max: TCD.t2 },
      { key: '3', lbl: 'Body Repel', cd: 't3', max: TCD.t3 },
      { key: '4', lbl: 'Soul Isomer', cd: 't4', max: TCD.t4 },
      { key: 'R', lbl: 'Reshape', cd: 'tr', max: TCD.tr }
    ]
  };
  try { CHARS.mahito.portrait = makePortrait(MAHITO_CFG); } catch (e) {}
  try { buildCharList(); } catch (e) {}

  cds.t1 = 0; cds.t2 = 0; cds.t3 = 0; cds.t4 = 0; cds.tr = 0;

  /* --------------------------------------------------------------- help */
  function ready(key) {
    return player.char === 'mahito' && !player.dead && !busy() && cds[key] <= 0 &&
      !player.react && !(window.JJNAOYA && window.JJNAOYA.busy());
  }
  function start(type, dur, key, name, sub) {
    cds[key] = TCD[key];
    player.action = { type: type, t: 0, dur: dur, stage: 0 };
    if (name) { try { showSplash(name, sub || '', '#6fe0cf'); } catch (e) {} }
    return player.action;
  }
  function aim() {
    return new THREE.Vector3(Math.sin(player.facing), 0, Math.cos(player.facing));
  }
  function rp(r) { resetPose(r); if (r.body) r.body.rotation.set(0, 0, 0); }
  function later(ms, fn) {
    setTimeout(function () { if (typeof scene !== 'undefined') fn(); }, ms);
  }
  function mat(color, rough) {
    return new THREE.MeshStandardMaterial({ color: color, roughness: rough == null ? .72 : rough, flatShading: true });
  }
  function part(g, w, h, d, x, y, z, c) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c));
    m.position.set(x, y, z);
    m.castShadow = Math.max(w, h, d) > 1;
    g.add(m);
    return m;
  }

  /* =====================================================================
     THE VFX KIT
     Four primitives, and everything he has is built out of them.
     ================================================================== */

  /* A SEAM: a line of stitches through the air, drawn as real bars so it
     is a seam rather than a glowing streak. This is his signature and it
     goes on every move. */
  function seamLine(from, to, opt) {
    opt = opt || {};
    var n = opt.n || 9, life = opt.life || .5, color = opt.color == null ? SOUL : opt.color;
    var dir = to.clone().sub(from);
    var len = dir.length();
    if (len < .01) return;
    dir.normalize();
    /* the thread */
    var thread = FX.billboard(FX.T.streak, color, .9);
    var tl = FX.orientAlong(thread, from, to);
    thread.scale.set(tl, Math.max(.1, len * .012), 1);
    scene.add(thread);
    /* and the bars across it */
    var bars = [];
    var up = new THREE.Vector3(0, 1, 0);
    var side = new THREE.Vector3().crossVectors(dir, up).normalize();
    if (side.lengthSq() < .01) side.set(1, 0, 0);
    for (var i = 0; i < n; i++) {
      var k = (i + .5) / n;
      var b = new THREE.Mesh(new THREE.BoxGeometry(.09, .09, len / n * .42),
        new THREE.MeshBasicMaterial({ color: i % 2 ? SOUL2 : color, toneMapped: false,
          transparent: true, opacity: .95 }));
      b.position.copy(from).addScaledVector(dir, len * k)
        .addScaledVector(side, (i % 2 ? .16 : -.16));
      b.lookAt(b.position.clone().addScaledVector(side, i % 2 ? -1 : 1));
      scene.add(b);
      bars.push(b);
    }
    var t = 0;
    addFx({ t: life, update: function (dd) {
      this.t -= dd; t += dd;
      var f = Math.max(0, this.t / life);
      thread.material.opacity = f * .9;
      bars.forEach(function (b, i) {
        b.material.opacity = f;
        b.position.addScaledVector(side, (i % 2 ? .5 : -.5) * dd * (1 - f));
      });
      if (this.t <= 0) {
        scene.remove(thread); thread.material.dispose();
        bars.forEach(function (b) { scene.remove(b); b.geometry.dispose(); b.material.dispose(); });
        return false;
      }
      return true;
    } });
  }
  MH.seam = seamLine;

  /* SOUL THREADS: what a reshaping looks like from outside — a knot of
     seams tying themselves around a body. */
  function soulKnot(at, n, r, life) {
    for (var i = 0; i < n; i++) {
      var a1 = Math.random() * TAU, a2 = Math.random() * TAU;
      var p1 = at.clone().add(new THREE.Vector3(
        Math.cos(a1) * r, (Math.random() - .5) * r * 1.4, Math.sin(a1) * r));
      var p2 = at.clone().add(new THREE.Vector3(
        Math.cos(a2) * r, (Math.random() - .5) * r * 1.4, Math.sin(a2) * r));
      seamLine(p1, p2, { n: 4, life: (life || .45) * (.7 + Math.random() * .6) });
    }
  }
  MH.knot = soulKnot;

  /* A PALM: the print left where he touched, growing outward. */
  function palmPrint(at, dir, size) {
    var m = FX.billboard(FX.T.ring, SOUL, .95);
    m.scale.setScalar(size || 3);
    m.position.copy(at);
    m.lookAt(at.clone().add(dir));
    scene.add(m);
    var t = 0;
    addFx({ t: .42, update: function (dd) {
      this.t -= dd; t += dd;
      m.scale.setScalar((size || 3) * (1 + t * 3.4));
      m.material.opacity = Math.max(0, this.t / .42);
      if (this.t <= 0) { scene.remove(m); m.material.dispose(); return false; }
      return true;
    } });
    FX.impact(at.clone(), SOUL, (size || 3) * .7);
  }

  /* MEAT: chunks of transfigured flesh. Normal blending, never additive —
     a glowing lump of meat reads as a spark, not as meat. */
  function meatBurst(at, n, power) {
    for (var i = 0; i < n; i++) {
      var s = .16 + Math.random() * .34;
      var m = new THREE.Mesh(new THREE.BoxGeometry(s, s * (.6 + Math.random()), s),
        new THREE.MeshStandardMaterial({ color: i % 3 ? MEAT : MEAT_D, roughness: .9, flatShading: true }));
      m.position.copy(at).add(new THREE.Vector3(
        (Math.random() - .5) * 1.4, (Math.random() - .5) * 1.4, (Math.random() - .5) * 1.4));
      scene.add(m);
      var v = new THREE.Vector3((Math.random() - .5), Math.random() * .9 + .3, (Math.random() - .5))
        .normalize().multiplyScalar((power || 12) * (.5 + Math.random()));
      var spin = new THREE.Vector3(Math.random() * 9, Math.random() * 9, Math.random() * 9);
      (function (m, v, spin) {
        addFx({ t: 1.6, update: function (dd) {
          this.t -= dd;
          v.y -= 34 * dd;
          m.position.addScaledVector(v, dd);
          m.rotation.x += spin.x * dd; m.rotation.y += spin.y * dd; m.rotation.z += spin.z * dd;
          if (m.position.y < .1) { m.position.y = .1; v.y = Math.abs(v.y) * .28; v.multiplyScalar(.7); }
          if (this.t <= 0) { scene.remove(m); m.geometry.dispose(); m.material.dispose(); return false; }
          return true;
        } });
      })(m, v, spin);
    }
  }
  MH.meat = meatBurst;

  /* =====================================================================
     WARPING A BODY
     What his technique actually does, on somebody who is still alive.

     The scale of a bone, not its rotation: the game re-poses every rig
     every frame, so a rotation put here is gone by the next one — but
     nothing touches scale, so a body left the wrong shape STAYS the
     wrong shape until this puts it back.
     ================================================================== */
  var BONES = ['head', 'spine', 'shoulderL', 'shoulderR', 'elbowL', 'elbowR',
    'hipL', 'hipR', 'kneeL', 'kneeR'];

  function warp(ent, power, secs) {
    if (!ent || !ent.rig) return;
    var r = ent.rig;
    if (r.__warp) { r.__warp.t = Math.max(r.__warp.t, secs); return; }
    var want = {}, i, b;
    for (i = 0; i < BONES.length; i++) {
      b = BONES[i];
      if (!r[b]) continue;
      want[b] = new THREE.Vector3(
        1 + (Math.random() - .35) * power,
        1 + (Math.random() - .25) * power * 1.6,
        1 + (Math.random() - .35) * power);
    }
    var w = { t: secs, k: 0, want: want };
    r.__warp = w;
    MH.warped.push(r);
    addFx({ t: 1e9, update: function (dt) {
      if (typeof scene === 'undefined' || r.__warp !== w) return false;
      w.t -= dt;
      /* on quickly, off slowly — a body springs back into a shape it is
         no longer sure of */
      w.k = w.t > .25 ? Math.min(1, w.k + dt * 7) : Math.max(0, w.k - dt * 2.4);
      for (var j = 0; j < BONES.length; j++) {
        var bn = BONES[j];
        if (!r[bn] || !want[bn]) continue;
        r[bn].scale.set(
          1 + (want[bn].x - 1) * w.k,
          1 + (want[bn].y - 1) * w.k,
          1 + (want[bn].z - 1) * w.k);
      }
      if (w.t <= 0 && w.k <= 0) {
        unwarp(r);
        return false;
      }
      return true;
    } });
  }
  function unwarp(r) {
    if (!r) return;
    for (var j = 0; j < BONES.length; j++) if (r[BONES[j]]) r[BONES[j]].scale.set(1, 1, 1);
    r.__warp = null;
    var i = MH.warped.indexOf(r);
    if (i >= 0) MH.warped.splice(i, 1);
  }
  function unwarpAll() { MH.warped.slice().forEach(unwarp); }
  MH.warp = warp; MH.unwarp = unwarp;

  /* =====================================================================
     1 · IDLE TRANSFIGURATION  無為転変
     He reaches out. It is not a punch — the hand only has to LAND. What
     it does arrives a beat afterwards, from the inside.
     ================================================================== */
  var TOUCH = { lunge: 22, reach: 6.5, seek: 16, dmg: 32, burn: 1.05 };

  function touchLand(e, at, dir) {
    palmPrint(at.clone(), dir.clone(), 3.2);
    FX.flash('#bffbf1', .3, .18);
    if (typeof hitstop === 'function') hitstop(.1);
    addShake(1.4);
    try { sfx.redBoom(); } catch (err) {}

    /* the seams go in */
    for (var i = 0; i < 7; i++) {
      seamLine(at.clone().add(new THREE.Vector3((Math.random() - .5) * .6, (Math.random() - .5) * .6, 0)),
        e.pos.clone().add(new THREE.Vector3((Math.random() - .5) * 2.2, 1 + Math.random() * 3, (Math.random() - .5) * 2.2)),
        { n: 5, life: .5 });
    }
    warp(e, .55, TOUCH.burn + .5);
    e.damage(TOUCH.dmg, dir.clone().multiplyScalar(6).setY(4), {
      react: 'stagger', reactDur: .7, spark: SOUL, stun: .7,
      bleed: true, death: 'implode' });

    /* and it keeps going for a moment: the shape settles wrong */
    var t = 0, ticks = 0;
    addFx({ t: 1e9, update: function (dt) {
      t += dt;
      if (!e || e.dead || typeof scene === 'undefined') return false;
      if (t > ticks * .26) {
        ticks++;
        var p = e.pos.clone().add(new THREE.Vector3(0, 1.6 + Math.random() * 2, 0));
        soulKnot(p, 2, 1.5, .34);
        FX.mote(p.clone(), SOUL2, 1.6, .3);
        e.damage(5, null, { spark: SOUL, react: null, noFrameBonus: true, death: 'implode' });
      }
      return t < TOUCH.burn;
    } });
  }

  function castTouch() {
    if (!ready('t1')) return;
    var a = start('t1', 1.0, 't1', 'IDLE TRANSFIGURATION', '無為転変');
    var d = aim();
    /* The hand only has to LAND, so it goes where somebody is rather than
       where he happens to be pointing — a technique that has to be aimed
       to the centimetre is a technique nobody lands. */
    var near = null, nd = TOUCH.seek;
    for (var i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      if (!e || e.dead) continue;
      var to = e.pos.clone().sub(player.pos); to.y = 0;
      var dist = to.length();
      if (dist < .5 || dist > nd) continue;
      if (to.clone().normalize().dot(d) < .25) continue;
      nd = dist; near = e;
    }
    if (near) { d = near.pos.clone().sub(player.pos).setY(0).normalize(); }
    a.dir = d;
    a.mark = near || null;
    a.hit = false;
    player.iframes = Math.max(player.iframes, .4);
    try { sfx.whoosh(); } catch (e) {}
  }
  function stepTouch(a, dt) {
    var p = player, d = a.dir;
    /* the reach: he steps into it rather than standing and waving */
    if (a.t < .3) {
      if (a.mark && !a.mark.dead) {
        var to = a.mark.pos.clone().sub(p.pos).setY(0);
        if (to.length() > 3.5) d.copy(to.normalize());
      }
      p.vel.x = d.x * TOUCH.lunge; p.vel.z = d.z * TOUCH.lunge;
      if (a.stage < 1) {
        a.stage = 1;
        FX.streaks(p.pos.clone().add(new THREE.Vector3(0, 2.2, 0)), SOUL, 4, 10, .7);
        if (typeof ghostAfterimage === 'function') ghostAfterimage(p.rig, SOUL_D, .3);
      }
      return;
    }
    p.vel.x *= .7; p.vel.z *= .7;
    if (a.stage < 2) {
      a.stage = 2;
      var at = p.pos.clone().addScaledVector(d, 2.6).add(new THREE.Vector3(0, 2.6, 0));
      var got = enemiesNear(at, TOUCH.reach, d, .1);
      /* the one he set out for counts first, if he got anywhere near it */
      if (a.mark && !a.mark.dead && a.mark.pos.distanceTo(p.pos) < TOUCH.reach + 3) {
        got = [a.mark];
      }
      if (got.length) {
        a.hit = true;
        touchLand(got[0], got[0].pos.clone().add(new THREE.Vector3(0, 2.4, 0)), d);
      } else {
        /* a miss is still a hand out: the seams go into the air */
        palmPrint(at.clone(), d.clone(), 2.2);
        soulKnot(at.clone(), 3, 1.6, .35);
      }
    }
  }

  /* =====================================================================
     2 · TRANSFIGURED HUMAN  改造人間
     One he already got to. It runs at them on the wrong number of legs
     and it comes apart on arrival, because that is all it is for.
     ================================================================== */
  var HUMAN = { speed: 26, reach: 34, dmg: 26, radius: 4.4 };

  function buildTransfigured() {
    var g = new THREE.Group();
    /* a torso that was a person's, and is now a bag */
    part(g, 1.5, 1.9, 1.1, 0, 2.1, 0, MEAT);
    part(g, 1.2, .7, .9, 0, 3.2, .1, MEAT_D);
    /* a head, on sideways */
    var h = part(g, .9, .9, .9, .3, 3.9, .1, SKIN_D);
    h.rotation.z = .7; h.rotation.y = .5;
    var eye = new THREE.Mesh(new THREE.BoxGeometry(.5, .16, .06),
      new THREE.MeshBasicMaterial({ color: SOUL, toneMapped: false }));
    eye.position.set(.3, 3.95, .56);
    g.add(eye);
    /* a mouth somewhere it should not be */
    var mouth = part(g, .5, .16, .1, -.5, 2.4, .58, 0x3a1420);
    mouth.rotation.z = .4;
    for (var i = 0; i < 3; i++) {
      part(g, .1, .14, .08, -.62 + i * .12, 2.42 - i * .04, .62, BONE);
    }
    /* FIVE legs, none of them the same */
    g.__legs = [];
    var LEG = [[-.55, -.2, .0], [.55, .2, .0], [-.3, .0, -.6], [.4, -.1, -.5], [.0, .1, .55]];
    for (i = 0; i < LEG.length; i++) {
      var pivot = new THREE.Group();
      pivot.position.set(LEG[i][0], 1.5, LEG[i][2]);
      var seg = part(pivot, .32, 1.5, .32, 0, -.75, 0, i % 2 ? MEAT : MEAT_D);
      seg.castShadow = true;
      pivot.rotation.z = LEG[i][1];
      g.add(pivot);
      g.__legs.push(pivot);
    }
    /* and arms that grew out of the back */
    g.__arms = [];
    for (i = 0; i < 3; i++) {
      var ap = new THREE.Group();
      ap.position.set((i - 1) * .5, 2.9, -.5);
      part(ap, .26, 1.3, .26, 0, -.6, 0, MEAT);
      part(ap, .34, .3, .36, 0, -1.3, .06, SKIN_D);
      ap.rotation.x = .6 + i * .3;
      g.add(ap);
      g.__arms.push(ap);
    }
    /* stitched together everywhere */
    for (i = 0; i < 5; i++) {
      var bar = new THREE.Mesh(new THREE.BoxGeometry(.5, .07, .07),
        new THREE.MeshBasicMaterial({ color: SEAM, toneMapped: false }));
      bar.position.set(0, 1.4 + i * .42, .56);
      bar.rotation.z = (i % 2 ? .2 : -.2);
      g.add(bar);
    }
    return g;
  }

  function sendTransfigured(from, dir, ghost) {
    var g = buildTransfigured();
    g.position.copy(from); g.position.y = 0;
    g.rotation.y = Math.atan2(dir.x, dir.z);
    scene.add(g);
    MH.pets.push(g);
    var t = 0, run = 0, burst = false;
    var to = from.clone().addScaledVector(dir, HUMAN.reach);

    addFx({ t: 1e9, update: function (dt) {
      t += dt; run += dt * 17;
      if (typeof scene === 'undefined') return false;
      g.position.addScaledVector(dir, HUMAN.speed * dt);
      g.position.y = Math.abs(Math.sin(run)) * .5;
      /* five legs out of time with each other, which is the point */
      g.__legs.forEach(function (l, i) {
        l.rotation.x = Math.sin(run * (1 + i * .18) + i * 1.7) * 1.1;
      });
      g.__arms.forEach(function (a2, i) {
        a2.rotation.x = .6 + i * .3 + Math.sin(run * .7 + i) * .5;
        a2.rotation.z = Math.sin(run * .5 + i * 2) * .4;
      });
      if (Math.random() < dt * 8) {
        seamLine(g.position.clone().add(new THREE.Vector3(0, 3, 0)),
          g.position.clone().add(new THREE.Vector3(
            (Math.random() - .5) * 5, 1 + Math.random() * 4, (Math.random() - .5) * 5)),
          { n: 4, life: .3 });
      }

      /* it goes off on whoever it reaches, or at the end of its run */
      var near = ghost ? [] : enemiesNear(g.position.clone().add(new THREE.Vector3(0, 2, 0)), HUMAN.radius);
      if (!burst && (near.length || g.position.distanceTo(to) < 1.5 || t > 2.4)) {
        burst = true;
        var at = g.position.clone().add(new THREE.Vector3(0, 2.2, 0));
        FX.flash('#bffbf1', .4, .2);
        FX.impact(at.clone(), SOUL, 3.4);
        FX.rings(at.clone(), SOUL, 3, { maxR: 12, life: .5, ground: false, gap: 38 });
        soulKnot(at.clone(), 8, 3, .5);
        meatBurst(at.clone(), 16, 14);
        FX.debris(new THREE.Vector3(g.position.x, .1, g.position.z), 10, 12, MEAT_D);
        addShake(2);
        if (typeof hitstop === 'function') hitstop(.1);
        try { sfx.redBoom(); } catch (e) {}
        if (!ghost) {
          enemiesNear(at.clone(), HUMAN.radius + 3).forEach(function (e) {
            if (!e || e.dead) return;
            var kb = e.pos.clone().sub(g.position).setY(0);
            if (kb.lengthSq() < .01) kb.copy(dir);
            kb.normalize().multiplyScalar(16); kb.y = 14;
            warp(e, .35, .8);
            e.damage(HUMAN.dmg, kb, {
              react: 'blow', reactDur: .8, spark: SOUL, stun: .7,
              bleed: true, death: 'dice' });
          });
        }
        scene.remove(g);
        var ix = MH.pets.indexOf(g);
        if (ix >= 0) MH.pets.splice(ix, 1);
        g.traverse(function (o) { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
        return false;
      }
      return true;
    } });
    return g;
  }

  function castHuman() {
    if (!ready('t2')) return;
    var a = start('t2', 1.1, 't2', 'TRANSFIGURED HUMAN', '改造人間');
    a.dir = aim();
    player.iframes = Math.max(player.iframes, .35);
    try { sfx.whoosh(); } catch (e) {}
  }
  function stepHuman(a, dt) {
    var p = player, d = a.dir;
    var at = p.pos.clone().addScaledVector(d, 4.5);
    if (a.t < .42) {
      if (a.stage < 1) {
        a.stage = 1;
        /* it is assembled in front of him, out of seams */
        for (var i = 0; i < 8; i++) {
          seamLine(at.clone().add(new THREE.Vector3(
            (Math.random() - .5) * 6, Math.random() * 5, (Math.random() - .5) * 6)),
            at.clone().add(new THREE.Vector3(0, 2, 0)), { n: 5, life: .45 });
        }
        FX.mote(at.clone().add(new THREE.Vector3(0, 2, 0)), SOUL, 3, .4);
        addShake(.7);
      }
      return;
    }
    if (a.stage < 2) {
      a.stage = 2;
      FX.impact(at.clone().add(new THREE.Vector3(0, 2, 0)), SOUL, 2.2);
      sendTransfigured(at.clone(), d.clone());
    }
  }

  /* =====================================================================
     3 · BODY REPEL  身体潰変
     His own arm. It opens out into a blade of flesh with a bone edge,
     and the swing is one wide arc that keeps going after the hit.
     ================================================================== */
  var REPEL = { dmg: 34, reach: 13, arc: .55 };

  function buildBlade() {
    var g = new THREE.Group();
    /* the arm, gone wrong: it widens as it goes out */
    part(g, .6, .5, 1.6, 0, 0, .9, MEAT);
    part(g, .9, .4, 2.4, 0, 0, 2.9, MEAT_D);
    part(g, 1.5, .34, 3.2, 0, 0, 5.6, MEAT);
    /* the bone edge along one side */
    var edge = part(g, .18, .5, 6.2, .74, 0, 3.6, BONE);
    edge.rotation.x = 0;
    for (var i = 0; i < 7; i++) {
      var tooth = part(g, .3, .22, .34, .74, 0, 1.4 + i * .9, BONE);
      tooth.rotation.z = .2;
    }
    /* a hand still on the end of it, which is the horrible part */
    part(g, .8, .3, .5, 0, 0, 7.6, SKIN_D);
    for (i = 0; i < 3; i++) part(g, .16, .2, .8, -.24 + i * .24, 0, 8.2, SKIN_D);
    /* stitched down the spine of it */
    for (i = 0; i < 8; i++) {
      var bar = new THREE.Mesh(new THREE.BoxGeometry(.6, .07, .07),
        new THREE.MeshBasicMaterial({ color: SEAM, toneMapped: false }));
      bar.position.set(0, .2, .8 + i * .9);
      g.add(bar);
    }
    return g;
  }
  MH.buildBlade = buildBlade;

  function swingBlade(a) {
    var p = player;
    var blade = buildBlade();
    /* carried on his own arm, so the swing is his swing */
    p.rig.elbowR.add(blade);
    blade.position.set(0, -1.0, 0);
    blade.rotation.x = -Math.PI / 2;
    blade.scale.setScalar(.02);
    a.blade = blade;
    var t = 0;
    addFx({ t: 1e9, update: function (dt) {
      t += dt;
      if (typeof scene === 'undefined' || !blade.parent) return false;
      /* it grows out of him, holds, and is pulled back in */
      var k = t < .22 ? E.out(t / .22) : (t > .78 ? Math.max(0, 1 - (t - .78) / .24) : 1);
      blade.scale.set(k, k, k);
      if (Math.random() < dt * 20) {
        var w = new THREE.Vector3();
        blade.getWorldPosition(w);
        seamLine(w.clone(), w.clone().add(new THREE.Vector3(
          (Math.random() - .5) * 4, (Math.random() - .5) * 3, (Math.random() - .5) * 4)),
          { n: 3, life: .22 });
      }
      if (t > 1.02) {
        blade.parent.remove(blade);
        blade.traverse(function (o) { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
        return false;
      }
      return true;
    } });
  }

  function castRepel() {
    if (!ready('t3')) return;
    var a = start('t3', 1.15, 't3', 'BODY REPEL', '身体潰変');
    a.dir = aim();
    player.iframes = Math.max(player.iframes, .5);
    try { sfx.whoosh(); } catch (e) {}
  }
  function stepRepel(a, dt) {
    var p = player, d = a.dir;
    if (a.stage < 1) {
      a.stage = 1;
      swingBlade(a);
      soulKnot(p.pos.clone().add(new THREE.Vector3(0, 2.4, 0)), 4, 1.6, .4);
    }
    if (a.t > .44 && a.stage < 2) {
      a.stage = 2;
      /* THE SWING: one long arc across the front of him */
      var mid = p.pos.clone().addScaledVector(d, 5).add(new THREE.Vector3(0, 2.4, 0));
      var side = new THREE.Vector3(-d.z, 0, d.x);
      FX.slash(mid.clone(), side.clone(), 0xfff2e2, 16, .26);
      FX.slash(mid.clone().add(new THREE.Vector3(0, -.7, 0)), side.clone(), SOUL2, 13, .22);
      seamLine(mid.clone().addScaledVector(side, -REPEL.reach * .8),
        mid.clone().addScaledVector(side, REPEL.reach * .8), { n: 14, life: .55 });
      FX.mangaLines(.7, .24);
      addShake(2.2);
      if (typeof hitstop === 'function') hitstop(.12);
      try { sfx.redBoom(); } catch (e) {}
      enemiesNear(mid.clone(), REPEL.reach, d, REPEL.arc).forEach(function (e) {
        if (!e || e.dead) return;
        var kb = d.clone().multiplyScalar(20); kb.y = 13;
        warp(e, .4, 1);
        e.damage(REPEL.dmg, kb, {
          react: 'slash', reactDur: .8, spark: SOUL2, stun: .8,
          bleed: true, death: 'halve' });
        FX.blood(e.pos.clone().add(new THREE.Vector3(0, 2.4, 0)), side.clone(), 14, 2);
        meatBurst(e.pos.clone().add(new THREE.Vector3(0, 2.2, 0)), 5, 9);
      });
    }
  }

  /* =====================================================================
     4 · POLYMORPHIC SOUL ISOMER  多重魂
     Not one transfigured human — all of them, run together into one mass
     that is mostly hands. It does not run: it rolls, and it takes the
     whole width of the road with it.
     ================================================================== */
  var ISO = { speed: 19, reach: 40, dmg: 40, radius: 7.5, dur: 3.4 };

  function buildIsomer() {
    var g = new THREE.Group();
    /* the body of it: overlapping lumps, no two aligned */
    for (var i = 0; i < 13; i++) {
      var s = 1.7 + Math.random() * 2.1;
      var lump = part(g, s, s * (.7 + Math.random() * .5), s * (.8 + Math.random() * .5),
        (Math.random() - .5) * 5, 1.5 + Math.random() * 3.6, (Math.random() - .5) * 5,
        i % 3 ? MEAT : MEAT_D);
      lump.rotation.set(Math.random(), Math.random(), Math.random());
    }
    /* THE HANDS. This is the whole silhouette: it should read as a mass
       of people reaching out of it, from every side. */
    g.__hands = [];
    for (i = 0; i < 22; i++) {
      var a = i / 22 * TAU + Math.random() * .3;
      /* out past the edge of the mass, or it is a lump with arms inside
         it — the reaching is the entire silhouette */
      var rr = 3.6 + Math.random() * 1.6;
      var arm = new THREE.Group();
      arm.position.set(Math.cos(a) * rr, 1.2 + Math.random() * 4.4, Math.sin(a) * rr);
      var len = 2.0 + Math.random() * 1.4;
      part(arm, .32, len, .32, 0, len * .5, 0, i % 2 ? MEAT : SKIN_D);
      part(arm, .46, .52, .32, 0, len + .26, 0, SKIN_D);
      for (var f = 0; f < 3; f++) part(arm, .13, .46, .13, -.15 + f * .15, len + .7, 0, SKIN_D);
      arm.rotation.z = -Math.cos(a) * .85;
      arm.rotation.x = Math.sin(a) * .85;
      arm.__base = arm.rotation.clone();
      g.add(arm);
      g.__hands.push(arm);
    }
    /* faces in it, which is worse than hands */
    g.__faces = [];
    for (i = 0; i < 6; i++) {
      var fa = i / 6 * TAU + .4;
      var face = part(g, 1.1, 1.25, .8, Math.cos(fa) * 3.4, 2.2 + Math.random() * 3.4, Math.sin(fa) * 3.4, SKIN_D);
      face.rotation.y = -fa;
      var eyes = new THREE.Mesh(new THREE.BoxGeometry(.7, .12, .06),
        new THREE.MeshBasicMaterial({ color: SOUL, toneMapped: false }));
      eyes.position.set(0, .2, .38);
      face.add(eyes);
      var mo = new THREE.Mesh(new THREE.BoxGeometry(.36, .28, .06),
        new THREE.MeshBasicMaterial({ color: 0x2a0e16, toneMapped: false }));
      mo.position.set(0, -.28, .38);
      face.add(mo);
      g.__faces.push(face);
    }
    /* and seams holding the whole thing together */
    for (i = 0; i < 14; i++) {
      var bar = new THREE.Mesh(new THREE.BoxGeometry(.9, .11, .11),
        new THREE.MeshBasicMaterial({ color: SEAM, toneMapped: false }));
      bar.position.set((Math.random() - .5) * 6, 1 + Math.random() * 5, (Math.random() - .5) * 6);
      bar.rotation.set(Math.random(), Math.random(), Math.random());
      g.add(bar);
    }
    return g;
  }
  MH.buildIsomer = buildIsomer;

  function rollIsomer(from, dir, ghost) {
    var g = buildIsomer();
    g.position.copy(from); g.position.y = -6;
    g.rotation.y = Math.atan2(dir.x, dir.z);
    scene.add(g);
    MH.pets.push(g);
    var t = 0, hit = [], churn = 0;

    addFx({ t: 1e9, update: function (dt) {
      t += dt; churn += dt * 3.4;
      if (typeof scene === 'undefined') return false;
      /* up out of the floor, then forward */
      if (t < .5) g.position.y = -6 + E.out(t / .5) * 6;
      else {
        g.position.y = Math.sin(churn * 2) * .3;
        g.position.addScaledVector(dir, ISO.speed * dt);
      }
      /* the hands never stop reaching */
      g.__hands.forEach(function (a2, i) {
        a2.rotation.x = a2.__base.x + Math.sin(churn * 2 + i) * .55;
        a2.rotation.z = a2.__base.z + Math.cos(churn * 1.7 + i * .7) * .45;
        a2.scale.y = 1 + Math.sin(churn * 3 + i * 1.3) * .22;
      });
      g.__faces.forEach(function (f, i) {
        f.scale.y = 1 + Math.sin(churn * 4 + i * 2) * .18;
      });
      if (Math.random() < dt * 26) {
        seamLine(g.position.clone().add(new THREE.Vector3(
          (Math.random() - .5) * 7, 1 + Math.random() * 6, (Math.random() - .5) * 7)),
          g.position.clone().add(new THREE.Vector3(
            (Math.random() - .5) * 12, 1 + Math.random() * 8, (Math.random() - .5) * 12)),
          { n: 5, life: .34 });
      }
      if (Math.random() < dt * 12) {
        FX.mote(g.position.clone().add(new THREE.Vector3(
          (Math.random() - .5) * 6, 2 + Math.random() * 4, (Math.random() - .5) * 6)), SOUL, 1.8, .3);
      }
      /* everything it rolls over */
      if (!ghost && t > .5) {
        enemies.forEach(function (e) {
          if (!e || e.dead || hit.indexOf(e) >= 0) return;
          if (e.pos.distanceTo(g.position) > ISO.radius) return;
          hit.push(e);
          var kb = dir.clone().multiplyScalar(22); kb.y = 17;
          warp(e, .6, 1.4);
          e.damage(ISO.dmg, kb, {
            react: 'blow', reactDur: 1, spark: SOUL, stun: 1,
            bleed: true, death: 'erase' });
          FX.impact(e.pos.clone().add(new THREE.Vector3(0, 2.4, 0)), SOUL2, 3.4);
          soulKnot(e.pos.clone().add(new THREE.Vector3(0, 2.4, 0)), 5, 2.2, .45);
          meatBurst(e.pos.clone().add(new THREE.Vector3(0, 2.2, 0)), 7, 11);
          addShake(2.2);
          if (typeof hitstop === 'function') hitstop(.08);
        });
      }
      if (t > .5 && (g.position.distanceTo(from) > ISO.reach || t > ISO.dur)) {
        /* it comes apart where it stops */
        var at = g.position.clone().add(new THREE.Vector3(0, 2.6, 0));
        FX.rings(new THREE.Vector3(g.position.x, .12, g.position.z), SOUL, 4,
          { maxR: 20, life: .8, gap: 42 });
        soulKnot(at.clone(), 12, 4, .6);
        meatBurst(at.clone(), 22, 15);
        FX.debris(new THREE.Vector3(g.position.x, .1, g.position.z), 16, 18, MEAT_D);
        addShake(2.4);
        scene.remove(g);
        var ix = MH.pets.indexOf(g);
        if (ix >= 0) MH.pets.splice(ix, 1);
        g.traverse(function (o) { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
        return false;
      }
      return true;
    } });
    return g;
  }

  function castIsomer() {
    if (!ready('t4')) return;
    var a = start('t4', 1.6, 't4', 'POLYMORPHIC SOUL ISOMER', '多重魂');
    a.dir = aim();
    player.iframes = Math.max(player.iframes, 1.2);
    FX.letterbox(true);
    later(2600, function () { FX.letterbox(false); });
    try { sfx.raise(); } catch (e) {}
  }
  function stepIsomer(a, dt) {
    var p = player, d = a.dir;
    p.vel.set(0, 0, 0);
    var at = p.pos.clone().addScaledVector(d, 10);
    if (a.t < .75) {
      if (a.stage < 1) {
        a.stage = 1;
        FX.cracks(new THREE.Vector3(at.x, .06, at.z), 14, 18, 0x2a1220);
        FX.tint('#160a12', .4, 1.2);
        addShake(1.4);
      }
      /* they are being run together, and you can see the seams doing it */
      if (Math.random() < .8) {
        seamLine(at.clone().add(new THREE.Vector3(
          (Math.random() - .5) * 14, .3, (Math.random() - .5) * 14)),
          at.clone().add(new THREE.Vector3(0, 2 + Math.random() * 3, 0)),
          { n: 6, life: .4 });
      }
      return;
    }
    if (a.stage < 2) {
      a.stage = 2;
      FX.flash('#bffbf1', .5, .3);
      FX.speedRing(at.clone().add(new THREE.Vector3(0, 3, 0)), SOUL, 18, .4);
      addShake(3);
      if (typeof hitstop === 'function') hitstop(.14);
      rollIsomer(at.clone(), d.clone());
    }
  }

  /* =====================================================================
     R · RESHAPE  蠢動
     He is not dodging. He stops holding the shape he was in, pours out
     of the way, and the shape he left behind is still standing there for
     a moment before it goes.
     ================================================================== */
  var RESHAPE = { back: 17, dmg: 14, radius: 8 };

  function shedShell(at, yaw) {
    /* a copy of him, left standing, which then stops being a copy */
    if (typeof ghostAfterimage === 'function') {
      try { ghostAfterimage(player.rig, SOUL_D, .5); } catch (e) {}
    }
    var t = 0;
    addFx({ t: 1e9, update: function (dt) {
      t += dt;
      if (typeof scene === 'undefined') return false;
      if (Math.random() < dt * 30) {
        seamLine(at.clone().add(new THREE.Vector3((Math.random() - .5) * 1.2, Math.random() * 4, (Math.random() - .5) * 1.2)),
          at.clone().add(new THREE.Vector3((Math.random() - .5) * 5, Math.random() * 5, (Math.random() - .5) * 5)),
          { n: 4, life: .26 });
      }
      return t < .42;
    } });
    later(420, function () {
      FX.impact(at.clone().add(new THREE.Vector3(0, 2.2, 0)), SOUL, 2.6);
      FX.rings(at.clone().add(new THREE.Vector3(0, 1.6, 0)), SOUL, 3,
        { maxR: RESHAPE.radius * 1.8, life: .5, ground: false, gap: 34 });
      soulKnot(at.clone().add(new THREE.Vector3(0, 2, 0)), 7, 2.4, .45);
      meatBurst(at.clone().add(new THREE.Vector3(0, 2, 0)), 9, 12);
      addShake(1.2);
      enemiesNear(at.clone().add(new THREE.Vector3(0, 2, 0)), RESHAPE.radius).forEach(function (e) {
        if (!e || e.dead) return;
        var kb = e.pos.clone().sub(at).setY(0);
        if (kb.lengthSq() < .01) kb.set(1, 0, 0);
        kb.normalize().multiplyScalar(13); kb.y = 10;
        warp(e, .3, .7);
        e.damage(RESHAPE.dmg, kb, {
          react: 'stagger', reactDur: .5, spark: SOUL, bleed: true, death: 'sever' });
      });
    });
  }

  function castReshape() {
    if (!ready('tr')) return;
    var a = start('tr', .85, 'tr', 'RESHAPE', '蠢動');
    a.dir = aim();
    a.from = player.pos.clone();
    player.iframes = Math.max(player.iframes, .9);
    try { sfx.whoosh(); } catch (e) {}
  }
  function stepReshape(a, dt) {
    var p = player, d = a.dir;
    if (a.stage < 1) {
      a.stage = 1;
      shedShell(a.from.clone(), p.facing);
      FX.streaks(p.pos.clone().add(new THREE.Vector3(0, 2, 0)), SOUL, 6, 14, .8);
    }
    /* he goes backwards and to the side, low and fast */
    if (a.t < .34) {
      var side = new THREE.Vector3(-d.z, 0, d.x);
      p.vel.x = -d.x * RESHAPE.back + side.x * RESHAPE.back * .5;
      p.vel.z = -d.z * RESHAPE.back + side.z * RESHAPE.back * .5;
      if (Math.random() < .6 && typeof ghostAfterimage === 'function') {
        ghostAfterimage(p.rig, SOUL_D, .22);
      }
    } else { p.vel.x *= .78; p.vel.z *= .78; }
  }

  /* =====================================================================
     POSES
     He is loose-limbed and unhurried about all of it — the hands lead
     and the body follows them late, which is what makes him read as
     something wearing a person rather than being one.
     ================================================================== */
  function poseMahito(r, a) {
    var t = a.t, out = E.out;
    switch (a.type) {
      case 't1': {                        // the reach: palm out, body behind it
        rp(r);
        var k = out(Math.min(1, t / .22));
        var push = t > .3 ? out(Math.min(1, (t - .3) / .18)) : 0;
        r.shoulderR.rotation.x = -1.5 * k - .5 * push;
        r.shoulderR.rotation.z = -.24 * k;
        r.elbowR.rotation.x = -1.2 * k + 1.15 * push;
        r.shoulderL.rotation.x = -.3 * k + .5 * push;
        r.shoulderL.rotation.z = .5 * k;
        r.elbowL.rotation.x = -1.4 * k;
        r.spine.rotation.x = -.16 * k + .34 * push;
        r.spine.rotation.y = .34 * k - .5 * push;
        r.neck.rotation.x = -.1 * k + .2 * push;
        r.neck.rotation.y = -.24 * k + .3 * push;
        r.hipL.rotation.x = -.6 * k; r.kneeL.rotation.x = .8 * k;
        r.hipR.rotation.x = .34 * k; r.kneeR.rotation.x = .5 * k;
        r.hips.position.y = r.hipsBaseY - .3 * k;
        return true;
      }
      case 't2': {                        // makes it, then flicks it away
        rp(r);
        var m = out(Math.min(1, t / .34));
        var fl = t > .42 ? out(Math.min(1, (t - .42) / .2)) : 0;
        r.shoulderL.rotation.x = -1.35 * m + .3 * fl;
        r.shoulderR.rotation.x = -1.35 * m - .9 * fl;
        r.shoulderL.rotation.z = .8 * m - .5 * fl;
        r.shoulderR.rotation.z = -.8 * m + .3 * fl;
        r.elbowL.rotation.x = -.9 * m + .7 * fl;
        r.elbowR.rotation.x = -.9 * m + .85 * fl;
        r.spine.rotation.x = .2 * m - .44 * fl;
        r.neck.rotation.x = .2 * m - .34 * fl;
        r.hipL.rotation.x = -.24 * m; r.kneeL.rotation.x = .46 * m;
        r.hipR.rotation.x = -.16 * m; r.kneeR.rotation.x = .38 * m;
        r.hips.position.y = r.hipsBaseY - .26 * m + .16 * fl;
        return true;
      }
      case 't3': {                        // the arm goes back, and comes across
        rp(r);
        var w = out(Math.min(1, t / .42));
        var sw = t > .44 ? out(Math.min(1, (t - .44) / .18)) : 0;
        r.shoulderR.rotation.x = -.5 - .9 * w + 1.1 * sw;
        r.shoulderR.rotation.z = -1.25 * w + 2.3 * sw;
        r.shoulderR.rotation.y = -.6 * w + 1.2 * sw;
        r.elbowR.rotation.x = -.5 * w + .4 * sw;
        r.shoulderL.rotation.x = -.5 * w - .4 * sw;
        r.shoulderL.rotation.z = .7 * w - .9 * sw;
        r.spine.rotation.y = .7 * w - 1.4 * sw;
        r.spine.rotation.x = -.16 * w + .3 * sw;
        r.neck.rotation.y = -.3 * w + .7 * sw;
        r.hipL.rotation.x = -.4 * w + .2 * sw; r.kneeL.rotation.x = .7 * w;
        r.hipR.rotation.x = .3 * w - .4 * sw; r.kneeR.rotation.x = .5 * w;
        r.hips.position.y = r.hipsBaseY - .4 * w + .18 * sw;
        return true;
      }
      case 't4': {                        // both hands down, then thrown open
        rp(r);
        var d1 = out(Math.min(1, t / .5));
        var op = t > .75 ? out(Math.min(1, (t - .75) / .3)) : 0;
        r.shoulderL.rotation.x = .5 * d1 - 2.0 * op;
        r.shoulderR.rotation.x = .5 * d1 - 2.0 * op;
        r.shoulderL.rotation.z = .3 * d1 + 1.0 * op;
        r.shoulderR.rotation.z = -.3 * d1 - 1.0 * op;
        r.elbowL.rotation.x = -.3 * d1 - .5 * op;
        r.elbowR.rotation.x = -.3 * d1 - .5 * op;
        r.spine.rotation.x = .42 * d1 - .8 * op;
        r.neck.rotation.x = .34 * d1 - .8 * op;
        r.hipL.rotation.x = -.36 * d1; r.kneeL.rotation.x = .7 * d1;
        r.hipR.rotation.x = -.3 * d1; r.kneeR.rotation.x = .62 * d1;
        r.hips.position.y = r.hipsBaseY - .5 * d1 + .3 * op;
        return true;
      }
      case 'tr': {                        // he goes boneless, then reforms
        rp(r);
        var s1 = Math.min(1, t / .16);
        var back = t > .3 ? out(Math.min(1, (t - .3) / .3)) : 0;
        var loose = Math.sin(t * 20) * .3 * s1 * (1 - back);
        r.spine.rotation.z = loose;
        r.spine.rotation.x = -.4 * s1 + .4 * back;
        r.neck.rotation.z = -loose * 1.4;
        r.shoulderL.rotation.x = -2.2 * s1 + 1.9 * back;
        r.shoulderR.rotation.x = -2.2 * s1 + 1.9 * back;
        r.shoulderL.rotation.z = .9 * s1 - .8 * back + loose;
        r.shoulderR.rotation.z = -.9 * s1 + .8 * back + loose;
        r.elbowL.rotation.x = -.4 - loose * 2;
        r.elbowR.rotation.x = -.4 + loose * 2;
        r.hipL.rotation.x = .5 * s1 - .5 * back;
        r.hipR.rotation.x = .3 * s1 - .3 * back;
        r.kneeL.rotation.x = .9 * s1 - .9 * back;
        r.kneeR.rotation.x = .7 * s1 - .7 * back;
        r.hips.position.y = r.hipsBaseY - .55 * s1 + .5 * back;
        return true;
      }
    }
    return false;
  }

  /* --------------------------------------------------------------- wiring */
  var _stepAction = stepAction;
  stepAction = function (a, dt) {
    switch (a.type) {
      case 't1': return stepTouch(a, dt);
      case 't2': return stepHuman(a, dt);
      case 't3': return stepRepel(a, dt);
      case 't4': return stepIsomer(a, dt);
      case 'tr': return stepReshape(a, dt);
    }
    return _stepAction(a, dt);
  };

  var _poseAction = poseAction;
  poseAction = function (r, a) {
    if (a && (r.__char || player.char) === 'mahito' && poseMahito(r, a)) return;
    return _poseAction(r, a);
  };

  window.addEventListener('keydown', function (e) {
    if (!started || player.char !== 'mahito' || e.repeat) return;
    if (player.react || (player.action && (player.action.type === 'kb' ||
        player.action.type === 'void'))) {
      if (window.JJNOTICE && Math.random() < .5) window.JJNOTICE('NO TECHNIQUE WHILE HIT', '#ff8b98');
      return;
    }
    var hit = true;
    if (e.code === 'Digit1') castTouch();
    else if (e.code === 'Digit2') castHuman();
    else if (e.code === 'Digit3') castRepel();
    else if (e.code === 'Digit4') castIsomer();
    else if (e.code === 'KeyR') castReshape();
    else hit = false;
    if (hit) e.stopImmediatePropagation();
  }, true);

  /* nothing of his outlives the swap — including a body he left the
     wrong shape, which would otherwise stay that way all match */
  var _switchChar = switchChar;
  switchChar = function (id, quiet) {
    MH.pets.slice().forEach(function (g) {
      meatBurst(g.position.clone().add(new THREE.Vector3(0, 2, 0)), 6, 9);
      scene.remove(g);
      g.traverse(function (o) { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
    });
    MH.pets.length = 0;
    unwarpAll();
    return _switchChar(id, quiet);
  };

  /* =====================================================================
     WHAT EVERYBODY ELSE SEES
     The same routines with the damage taken out — every hit already
     travels as its own message, so a copy that dealt damage would deal
     it twice. The warp is the exception: it is not damage, it is a shape,
     and a body that is the wrong shape on one screen and the right shape
     on another is two different fights.
     ================================================================== */
  function dirOf(yaw) { return new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)); }

  MH.remote = {
    t1: function (pos, yaw) {
      var d = dirOf(yaw);
      var at = pos.clone().addScaledVector(d, 3.4).add(new THREE.Vector3(0, 2.6, 0));
      later(300, function () {
        palmPrint(at.clone(), d.clone(), 3.2);
        soulKnot(at.clone(), 6, 2, .45);
        FX.flash('#bffbf1', .22, .16);
      });
    },
    t2: function (pos, yaw) {
      var d = dirOf(yaw), at = pos.clone().addScaledVector(d, 4.5);
      for (var i = 0; i < 8; i++) {
        seamLine(at.clone().add(new THREE.Vector3(
          (Math.random() - .5) * 6, Math.random() * 5, (Math.random() - .5) * 6)),
          at.clone().add(new THREE.Vector3(0, 2, 0)), { n: 5, life: .45 });
      }
      later(430, function () { sendTransfigured(at.clone(), d.clone(), true); });
    },
    t3: function (pos, yaw) {
      var d = dirOf(yaw);
      var mid = pos.clone().addScaledVector(d, 5).add(new THREE.Vector3(0, 2.4, 0));
      var side = new THREE.Vector3(-d.z, 0, d.x);
      later(440, function () {
        FX.slash(mid.clone(), side.clone(), 0xfff2e2, 16, .26);
        FX.slash(mid.clone().add(new THREE.Vector3(0, -.7, 0)), side.clone(), SOUL2, 13, .22);
        seamLine(mid.clone().addScaledVector(side, -REPEL.reach * .8),
          mid.clone().addScaledVector(side, REPEL.reach * .8), { n: 14, life: .55 });
      });
    },
    t4: function (pos, yaw) {
      var d = dirOf(yaw), at = pos.clone().addScaledVector(d, 10);
      FX.cracks(new THREE.Vector3(at.x, .06, at.z), 14, 18, 0x2a1220);
      for (var i = 0; i < 8; i++) {
        seamLine(at.clone().add(new THREE.Vector3(
          (Math.random() - .5) * 14, .3, (Math.random() - .5) * 14)),
          at.clone().add(new THREE.Vector3(0, 2.5, 0)), { n: 6, life: .5 });
      }
      later(760, function () {
        FX.speedRing(at.clone().add(new THREE.Vector3(0, 3, 0)), SOUL, 18, .4);
        rollIsomer(at.clone(), d.clone(), true);
      });
    },
    tr: function (pos) {
      shedShell(pos.clone(), 0);
    }
  };

  /* a body somebody else reshaped: the shape has to arrive too */
  MH.remoteWarp = function (ent, power, secs) { warp(ent, power || .5, secs || 1); };

  /* the pieces the finishers borrow */
  MH.buildTransfigured = buildTransfigured;
  MH.palm = palmPrint;
  MH.SOUL = SOUL; MH.SOUL2 = SOUL2; MH.SOUL_D = SOUL_D;
  MH.MEAT = MEAT; MH.MEAT_D = MEAT_D; MH.SEAM = SEAM;
  MH.SKIN = SKIN; MH.SKIN_D = SKIN_D; MH.BONE = BONE;
})();
