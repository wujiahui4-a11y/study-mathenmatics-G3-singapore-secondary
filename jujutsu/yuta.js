/* =======================================================================
   YUTA OKKOTSU
   Four moves, and no R. Everybody else on this roster has a fifth thing
   they do on their own; his fifth thing is a person, and she is already
   on 3 and 4.

     1  CURSED KATANA     呪具・刀 — the sword, and a cut a great deal
                          longer than the sword is
     2  BLUE              蒼 — the one he copied. Weaker than the man he
                          took it from, and still the second best in the
                          game at pulling a fight into one spot
     3  RIKA'S ARM        里香・腕 — she puts one hand through
     4  TRUE LOVE         完全顕現・里香 — all of her

   Two rules for the look:

     · HIS ENERGY IS TOO MUCH FOR THE MOVE IT IS IN. He is a boy with a
       sword doing more damage than a sword does, so every cut of his is
       drawn several times longer than the blade and several times wider
       than the swing. That overspill IS the character.
     · RIKA IS NOT A GHOST. She is pale, solid, lit, and she casts a
       shadow — the one thing she must never look like is a translucent
       blue overlay, which is what a cursed spirit in a game always is.
       The only part of her that glows is the inside of her mouth.
   ===================================================================== */
(function () {
  'use strict';
  if (typeof player === 'undefined' || typeof THREE === 'undefined') return;
  var FX = window.JJFX;
  if (!FX || typeof CHARS === 'undefined') return;
  var AN = window.JJANIM;
  var E = FX.ease;
  var TAU = Math.PI * 2;

  /* his energy, and her */
  var CE = 0x8fe6ff, CE2 = 0xeafcff, CE_D = 0x3aa8cc;
  var COLD = 0x3a7dff, COLD2 = 0xbcd8ff;
  var RIKA = 0xf2f1e8, RIKA_D = 0xb9b7a9, MARK = 0x2b2a26;
  var MAW = 0x3a0f18, TOOTH = 0xfffdf2;
  /* the uniform out of the reference: a white high-collared top, dark
     grey trousers with a white drawstring, and the bag strap across him */
  var TOP = 0xecefe9, TOP_D = 0xd4d8d2, PANTS = 0x3a3d44, STRAP = 0x1b1d22;

  var YT = window.JJYUTA = { props: [] };

  var YCD = { o1: 6, o2: 10, o3: 12, o4: 20 };

  var YUTA_CFG = {
    yuta: true, face: false,
    torso: TOP, pants: PANTS, shoes: 0x16181d, skin: 0xf0d3ba
  };

  /* ---------------------------------------------------------------- rig
     Straight off the reference: the collar is the whole silhouette. It
     stands up past the jaw and wraps across on a diagonal with the seam
     and the button on his left, the sleeves are pushed up, the trousers
     are dark with a white drawstring, and the bag strap runs corner to
     corner over the front of him.
     ================================================================== */
  var _makeAnimeRig = makeAnimeRig;
  makeAnimeRig = function (cfg) {
    var r = _makeAnimeRig(cfg);
    if (!cfg || !cfg.yuta) return r;
    var head = r.head, spine = r.spine, hips = r.hips;
    var hair = 0x1b1a20, hairD = 0x0e0d12;

    function box(w, h, d, c, basic) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), basic
        ? new THREE.MeshBasicMaterial({ color: c, toneMapped: false })
        : new THREE.MeshStandardMaterial({ color: c, roughness: .8 }));
      m.castShadow = !basic;
      return m;
    }
    var i, s;

    /* the hair: black, soft, parted, and not spiked */
    var cap = box(1.04, .4, 1.06, hair); cap.position.set(0, .94, -.02); head.add(cap);
    var back = box(1.0, .74, .42, hairD); back.position.set(0, .58, -.5); head.add(back);
    for (s = -1; s <= 1; s += 2) {
      var sd = box(.2, .8, .96, s < 0 ? hair : hairD);
      sd.position.set(.48 * s, .6, -.04);
      head.add(sd);
    }
    /* a fringe that sits above the eyes and parts a little left of centre */
    var FR = [[-.42, .96, .3], [-.22, .92, .38], [-.02, .98, .3],
              [.18, .93, .36], [.38, .98, .3]];
    for (i = 0; i < FR.length; i++) {
      var fr = box(.22, FR[i][2], .13, i % 2 ? hair : hairD);
      fr.position.set(FR[i][0], FR[i][1], .48);
      fr.rotation.z = -.2 + i * .1;
      head.add(fr);
    }
    for (s = -1; s <= 1; s += 2) {
      var sb = box(.13, .5, .14, hairD);
      sb.position.set(.44 * s, .58, .36);
      head.add(sb);
    }

    /* the eyes: wide and dark, and not narrowed at anything */
    var eL = box(.17, .16, .05, 0xf1f4f8, true); eL.position.set(-.2, .56, .46); head.add(eL);
    var eR = box(.17, .16, .05, 0xf1f4f8, true); eR.position.set(.2, .56, .46); head.add(eR);
    var iL = box(.09, .12, .06, 0x1a2028, true); iL.position.set(-.2, .55, .48); head.add(iL);
    var iR = box(.09, .12, .06, 0x1a2028, true); iR.position.set(.2, .55, .48); head.add(iR);
    var brL = box(.19, .05, .05, hairD); brL.position.set(-.2, .72, .47); brL.rotation.z = .07; head.add(brL);
    var brR = box(.19, .05, .05, hairD); brR.position.set(.2, .72, .47); brR.rotation.z = -.07; head.add(brR);
    var mouth = box(.16, .04, .05, 0xc08a78); mouth.position.set(0, .3, .46); head.add(mouth);

    /* THE COLLAR. It stands right up past the jaw and closes across on a
       diagonal — the one thing that makes this uniform his. */
    /* It stops at the chin. The first cut of it stood to y=1.54 with the
       diagonal wrap at 1.24, which put a slab straight across his mouth —
       a collar you cannot see a face over is a scarf. */
    var neck = box(.84, .58, .82, TOP); neck.position.set(0, 1.08, .0); spine.add(neck);
    var lip = box(.9, .1, .88, TOP_D); lip.position.set(0, 1.36, .0); spine.add(lip);
    var wrap = box(.52, .5, .14, TOP);
    wrap.position.set(-.2, 1.02, .40); wrap.rotation.z = .5; spine.add(wrap);
    var seam = box(.05, .62, .05, 0xa8aeb4);
    seam.position.set(-.02, 1.04, .45); seam.rotation.z = .5; spine.add(seam);
    var btn = box(.11, .11, .07, 0x8f959b);
    btn.position.set(-.32, .88, .43); spine.add(btn);

    /* the top itself: loose, with the seam carried down the front */
    var body = box(1.34, 1.24, .74, TOP); body.position.set(0, .62, .0); spine.add(body);
    var hem = box(1.36, .16, .76, TOP_D); hem.position.set(0, .02, 0); spine.add(hem);
    var front = box(.06, 1.0, .05, 0xbfc5c9); front.position.set(-.06, .6, .38); spine.add(front);

    /* the bag strap, corner to corner across the front and over the back */
    var st = box(.22, 1.7, .1, STRAP);
    st.position.set(-.05, .66, .40); st.rotation.z = .46; spine.add(st);
    var stb = box(.22, 1.6, .1, STRAP);
    stb.position.set(.02, .66, -.4); stb.rotation.z = -.4; spine.add(stb);
    var buckle = box(.2, .14, .12, 0x54585e);
    buckle.position.set(-.3, .82, .44); spine.add(buckle);

    /* sleeves pushed up to just under the elbow */
    var arms = [[r.shoulderL, r.elbowL], [r.shoulderR, r.elbowR]];
    for (i = 0; i < arms.length; i++) {
      var sl = box(.56, .96, .56, TOP); sl.position.set(0, -.5, 0); arms[i][0].add(sl);
      var cuff = box(.6, .16, .6, TOP_D); cuff.position.set(0, -.98, 0); arms[i][0].add(cuff);
    }
    /* trousers, with the white drawstring at the waist */
    var waist = box(1.06, .22, .68, PANTS); waist.position.set(0, .58, 0); hips.add(waist);
    var tieL = box(.07, .34, .07, 0xe8eae6); tieL.position.set(-.12, .38, .34); tieL.rotation.z = .12; hips.add(tieL);
    var tieR = box(.07, .3, .07, 0xe8eae6); tieR.position.set(.1, .4, .34); tieR.rotation.z = -.16; hips.add(tieR);
    return r;
  };

  CHARS.yuta = {
    name: 'YUTA OKKOTSU', sub: 'RIKA — QUEEN OF CURSES',
    cfg: YUTA_CFG, glow: '#8fe6ff',
    /* four, and no R: his fifth thing is a person and she is on 3 and 4 */
    moves: [
      { key: 'LMB', lbl: 'Punch', cd: 'm1', max: .3 },
      { key: 'Q', lbl: 'Dash', cd: 'dash', max: 1 },
      { key: '1', lbl: 'Cursed Katana', cd: 'o1', max: YCD.o1 },
      { key: '2', lbl: 'Blue', cd: 'o2', max: YCD.o2 },
      { key: '3', lbl: "Rika's Arm", cd: 'o3', max: YCD.o3 },
      { key: '4', lbl: 'True Love', cd: 'o4', max: YCD.o4 }
    ]
  };
  try { CHARS.yuta.portrait = makePortrait(YUTA_CFG); } catch (e) {}
  try { buildCharList(); } catch (e) {}

  cds.o1 = 0; cds.o2 = 0; cds.o3 = 0; cds.o4 = 0;

  /* --------------------------------------------------------------- help */
  function ready(key) {
    return player.char === 'yuta' && !player.dead && !busy() && cds[key] <= 0 &&
      !player.react && !(window.JJNAOYA && window.JJNAOYA.busy());
  }
  function start(type, dur, key, name, sub) {
    cds[key] = YCD[key];
    player.action = { type: type, t: 0, dur: dur, stage: 0 };
    if (name) { try { showSplash(name, sub || '', '#8fe6ff'); } catch (e) {} }
    return player.action;
  }
  function aim() {
    return new THREE.Vector3(Math.sin(player.facing), 0, Math.cos(player.facing));
  }
  function rp(r) { resetPose(r); if (r.body) r.body.rotation.set(0, 0, 0); }
  function later(ms, fn) {
    setTimeout(function () { if (typeof scene !== 'undefined') fn(); }, ms);
  }
  function mat(c, rough) {
    return new THREE.MeshStandardMaterial({ color: c, roughness: rough == null ? .78 : rough, flatShading: true });
  }
  function part(g, w, h, d, x, y, z, c) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c));
    m.position.set(x, y, z);
    m.castShadow = Math.max(w, h, d) > 1;
    g.add(m);
    return m;
  }
  function keep(o) { YT.props.push(o); return o; }
  function drop(o) {
    if (!o) return;
    var i = YT.props.indexOf(o);
    if (i >= 0) YT.props.splice(i, 1);
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
     THE OVERSPILL
     He puts far more into everything than it needs, so a cut of his is
     drawn as the swing PLUS the several metres of it that got away. This
     is one routine because it is on every single move he has.
     ================================================================== */
  function overspill(at, dir, len, wide, color) {
    var side = new THREE.Vector3(-dir.z, 0, dir.x);
    if (side.lengthSq() < .01) side.set(1, 0, 0);
    side.normalize();
    /* the wall of it going out past where the swing stopped */
    for (var i = 0; i < 5; i++) {
      var k = i / 4 - .5;
      var a = at.clone().addScaledVector(side, k * wide);
      var b = a.clone().addScaledVector(dir, len * (.7 + Math.random() * .5));
      b.y += (Math.random() - .5) * wide * .5;
      FX.cutLine(a, b, i % 2 ? (color || CE) : CE2, .6 + Math.random() * .5, .3);
    }
    FX.wave(at.clone(), dir, color || CE, { steps: 4, gap: 24, reach: len * .22, r0: wide * .5, grow: wide * .3 });
    FX.speedRing(at.clone(), CE2, wide * 1.4, .28);
  }
  YT.spill = overspill;

  /* his energy coming off him while he holds something */
  function shimmer(getPos, alive) {
    var acc = 0, live = true;
    addFx({ t: 1e9, update: function (dt) {
      var p = getPos();
      if (!live || !p || (alive && !alive())) return false;
      acc += dt;
      if (acc > .06) {
        acc = 0;
        var a = Math.random() * TAU;
        FX.mote(p.clone().add(new THREE.Vector3(
          Math.cos(a) * 1.4, .4 + Math.random() * 4, Math.sin(a) * 1.4)),
          Math.random() < .4 ? CE2 : CE, 1.2 + Math.random(), .3);
      }
      return true;
    } });
    return { stop: function () { live = false; } };
  }

  /* =====================================================================
     1 · CURSED KATANA  呪具・刀
     A plain sword. What is not plain is how far past the end of it the
     cut goes.
     ================================================================== */
  var KAT = { dmg: 34, reach: 9, spill: 26, step: 22 };

  function buildKatana() {
    var g = new THREE.Group();
    part(g, .18, .9, .18, 0, -.2, 0, 0x1a1a22);        // the grip
    for (var i = 0; i < 5; i++) part(g, .21, .05, .21, 0, -.55 + i * .18, 0, 0x5a4a3a);
    part(g, .52, .1, .3, 0, .3, 0, 0x3a3630);           // the guard
    var blade = part(g, .16, 4.2, .34, 0, 2.45, 0, 0xdfe6ec);
    blade.castShadow = true;
    var edge = new THREE.Mesh(new THREE.BoxGeometry(.08, 4.2, .1),
      new THREE.MeshBasicMaterial({ color: CE2, toneMapped: false }));
    edge.position.set(0, 2.45, .16);
    g.add(edge);
    part(g, .14, .6, .3, 0, 4.7, .04, 0xdfe6ec);
    return g;
  }
  YT.buildKatana = buildKatana;

  function castKatana() {
    if (!ready('o1')) return;
    var a = start('o1', 1.0, 'o1', 'CURSED KATANA', '呪具・刀');
    a.dir = aim();
    player.iframes = Math.max(player.iframes, .45);
    try { sfx.whoosh(); } catch (e) {}
  }
  function stepKatana(a, dt) {
    var p = player, d = a.dir;
    if (a.stage < 1) {
      a.stage = 1;
      var k = buildKatana();
      p.rig.elbowR.add(k);
      k.position.set(0, -1.1, 0);
      k.rotation.x = Math.PI * .5;
      a.kat = k;
      var t = 0;
      addFx({ t: 1e9, update: function (dd) {
        t += dd;
        if (typeof scene === 'undefined' || !k.parent) return false;
        if (Math.random() < dd * 24) {
          var w = new THREE.Vector3();
          k.getWorldPosition(w);
          FX.mote(w.clone().add(new THREE.Vector3(
            (Math.random() - .5) * 2, (Math.random() - .5) * 3, (Math.random() - .5) * 2)), CE, 1.2, .22);
        }
        if (t > 1.0) { k.parent.remove(k); drop(k); return false; }
        return true;
      } });
    }
    if (a.t < .28) { p.vel.x *= .7; p.vel.z *= .7; return; }
    if (a.t < .44) { p.vel.x = d.x * KAT.step; p.vel.z = d.z * KAT.step; return; }
    p.vel.x *= .6; p.vel.z *= .6;
    if (a.stage < 2) {
      a.stage = 2;
      var at = p.pos.clone().addScaledVector(d, 3.4).add(new THREE.Vector3(0, 2.6, 0));
      var side = new THREE.Vector3(-d.z, 0, d.x);
      FX.slash(at.clone(), side, CE2, 15, .24);
      FX.slash(at.clone().add(new THREE.Vector3(0, -.6, 0)), side, CE, 12, .2);
      /* and the part that got away from him */
      overspill(at.clone(), d, KAT.spill, 11, CE);
      FX.mangaLines(.8, .26);
      addShake(2.2);
      if (typeof hitstop === 'function') hitstop(.13);
      try { sfx.redBoom(); } catch (e) {}
      /* it hurts everything the sword reached AND everything the
         overspill went through, which is most of the road */
      enemiesNear(at, KAT.reach, d, .1).forEach(function (e) { cut(e, d, 1); });
      var far = p.pos.clone().addScaledVector(d, KAT.spill * .55).add(new THREE.Vector3(0, 2, 0));
      enemiesNear(far, KAT.spill * .5, d, .5).forEach(function (e) { cut(e, d, .55); });
    }
    function cut(e, d2, mul) {
      if (!e || e.dead || e.__yhit === a) return;
      e.__yhit = a;
      var kb = d2.clone().multiplyScalar(18 * mul); kb.y = 12 * mul;
      e.damage(Math.round(KAT.dmg * mul), kb, {
        react: 'slash', reactDur: .8, spark: CE2, stun: .7 * mul,
        bleed: true, death: 'sever' });
      FX.blood(e.pos.clone().add(new THREE.Vector3(0, 2.5, 0)), d2, 14, 2);
      FX.cutLine(e.pos.clone().add(new THREE.Vector3(-3, 3.4, 0)),
        e.pos.clone().add(new THREE.Vector3(3, 1.4, 0)), CE2, .8, .3);
    }
  }

  /* =====================================================================
     2 · BLUE  蒼
     The one he copied. It is not as good as the man he took it from and
     it does not need to be: it still pulls the whole fight into one spot
     and then lets go of it.
     ================================================================== */
  var BL = { dmg: 30, radius: 11, out: 14, pull: 1.05 };

  function castBlue() {
    if (!ready('o2')) return;
    var a = start('o2', 1.5, 'o2', 'BLUE', '蒼');
    var d = aim();
    var near = nearest(28, 0);
    a.at = (near ? new THREE.Vector3(near.pos.x, 0, near.pos.z)
                 : player.pos.clone().addScaledVector(d, BL.out).setY(0))
      .add(new THREE.Vector3(0, 3, 0));
    a.dir = d;
    player.iframes = Math.max(player.iframes, .8);
    try { sfx.raise(); } catch (e) {}
  }
  function stepBlue(a, dt) {
    var p = player, d = a.dir;
    p.vel.x *= .85; p.vel.z *= .85;
    if (a.stage < 1 && a.t > .34) {
      a.stage = 1;
      /* the orb: small, dense, and dark blue at the middle */
      var orb = FX.billboard(FX.T.star, COLD, .95);
      orb.scale.setScalar(1.4);
      orb.position.copy(a.at);
      scene.add(orb);
      a.orb = orb;
      keep(orb);
      var t = 0;
      addFx({ t: 1e9, update: function (dd) {
        t += dd;
        if (typeof scene === 'undefined' || !orb.parent) return false;
        FX.faceCam(orb, t * 2);
        orb.scale.setScalar(1.4 + Math.min(1, t / .5) * 3 + Math.sin(t * 18) * .3);
        /* everything it can reach comes toward it */
        if (t < BL.pull) {
          FX.converge(a.at.clone(), COLD, 3, BL.radius, .3);
          enemies.forEach(function (e) {
            if (!e || e.dead) return;
            var to = a.at.clone().sub(e.pos).setY(0);
            var dist = to.length();
            if (dist > BL.radius || dist < .4) return;
            e.pos.addScaledVector(to.normalize(), Math.min(dist, 22 * dd * (1 - dist / BL.radius / 1.6)));
            e.stunT = Math.max(e.stunT || 0, .25);
            e.vel.set(0, 0, 0);
          });
        }
        if (t > BL.pull) {
          drop(orb);
          return false;
        }
        return true;
      } });
      FX.rings(a.at.clone(), COLD, 3, { maxR: BL.radius, life: .6, ground: false, gap: 44 });
      addShake(1.2);
    }
    if (a.stage < 2 && a.t > .34 + BL.pull) {
      a.stage = 2;
      /* and then it stops holding on */
      FX.flash('#cfe0ff', .5, .26);
      FX.impact(a.at.clone(), COLD2, 5);
      FX.rings(a.at.clone(), COLD, 4, { maxR: BL.radius * 1.6, life: .7, ground: false, gap: 34 });
      FX.rings(new THREE.Vector3(a.at.x, .12, a.at.z), COLD, 3, { maxR: BL.radius * 1.7, life: .7, gap: 38 });
      FX.debris(new THREE.Vector3(a.at.x, .1, a.at.z), 14, 16, 0x6a7488);
      FX.mangaLines(.9, .3);
      addShake(3);
      if (typeof hitstop === 'function') hitstop(.18);
      try { sfx.redBoom(); } catch (e) {}
      enemiesNear(a.at.clone(), BL.radius * .9).forEach(function (e) {
        if (!e || e.dead) return;
        var kb = e.pos.clone().sub(a.at).setY(0);
        if (kb.lengthSq() < .01) kb.copy(d);
        kb.normalize().multiplyScalar(24); kb.y = 18;
        e.damage(BL.dmg, kb, {
          react: 'blow', reactDur: .9, spark: COLD2, stun: .9,
          bleed: true, death: 'implode' });
      });
    }
  }

  /* =====================================================================
     3 · RIKA'S ARM  里香・腕
     One hand, at about six times the size of one. It comes over his
     shoulder from behind him, which is where she is.
     ================================================================== */
  var ARM = { dmg: 40, reach: 15, radius: 7 };

  function buildArm() {
    var g = new THREE.Group();
    /* the forearm, tapering out to the hand */
    part(g, 2.6, 2.6, 2.6, 0, -1.2, -5.2, RIKA_D);
    part(g, 2.9, 2.9, 6.0, 0, -.6, -2.0, RIKA);
    part(g, 3.4, 3.2, 3.0, 0, -.3, 1.6, RIKA);
    /* the markings, which are the only dark thing on her */
    for (var i = 0; i < 5; i++) {
      part(g, 3.1, .18, .5, 0, .6 - i * .1, -3.4 + i * 1.2, MARK);
    }
    /* the hand: a palm and four long fingers and a thumb */
    var palm = part(g, 3.6, 1.4, 2.6, 0, -.2, 3.6, RIKA);
    palm.castShadow = true;
    g.__fingers = [];
    for (i = 0; i < 4; i++) {
      var f = new THREE.Group();
      f.position.set(-1.35 + i * .9, -.2, 4.8);
      part(f, .72, .74, 2.2, 0, 0, 1.0, RIKA);
      part(f, .6, .62, 1.8, 0, -.1, 2.8, RIKA_D);
      part(f, .44, .44, .8, 0, -.2, 4.0, 0xe9e6d8);   // the nail
      g.add(f);
      g.__fingers.push(f);
    }
    var th = new THREE.Group();
    th.position.set(-2.0, -.3, 3.4);
    part(th, .9, .8, 2.0, 0, 0, .8, RIKA);
    part(th, .6, .6, 1.2, 0, -.1, 2.2, RIKA_D);
    th.rotation.y = -.7;
    g.add(th);
    g.__fingers.push(th);
    return g;
  }
  YT.buildArm = buildArm;

  function swingArm(from, dir, ghost) {
    var g = buildArm();
    g.position.copy(from).add(new THREE.Vector3(0, 9, 0));
    g.rotation.y = Math.atan2(dir.x, dir.z);
    g.rotation.x = -1.2;
    scene.add(g);
    keep(g);
    var t = 0, hit = false;
    var at = from.clone().addScaledVector(dir, ARM.reach);
    var stop = shimmer(function () { return g.position.clone(); }, function () { return t < 1.4; });
    addFx({ t: 1e9, update: function (dt) {
      t += dt;
      if (typeof scene === 'undefined') return false;
      var k = Math.min(1, t / .42);
      /* over the shoulder and down, opening as it goes */
      g.position.copy(from).lerp(at.clone(), E.out(k));
      g.position.y = 9 - E.out(k) * 6.6;
      g.rotation.x = -1.2 + E.out(k) * 1.5;
      g.__fingers.forEach(function (f, i) {
        f.rotation.x = -.5 + E.out(k) * (1.4 + (i % 2) * .3);
      });
      if (!hit && k >= .92) {
        hit = true;
        var land = new THREE.Vector3(g.position.x, 0, g.position.z);
        FX.flash('#eafcff', .5, .26);
        FX.impact(land.clone().add(new THREE.Vector3(0, 2, 0)), CE2, 5);
        FX.rings(new THREE.Vector3(land.x, .12, land.z), CE, 5,
          { maxR: ARM.radius * 2.4, life: .8, gap: 38 });
        FX.cracks(new THREE.Vector3(land.x, .1, land.z), 16, 20, 0x59636e);
        FX.dust(new THREE.Vector3(land.x, 0, land.z), 14, 0xcfd8e0, 18, 5);
        overspill(land.clone().add(new THREE.Vector3(0, 2, 0)), dir, 22, 14, CE);
        FX.mangaLines(1, .32);
        addShake(4);
        if (typeof hitstop === 'function') hitstop(.2);
        try { sfx.redBoom(); } catch (e) {}
        if (!ghost) {
          enemiesNear(land.clone().add(new THREE.Vector3(0, 2, 0)), ARM.radius).forEach(function (e) {
            if (!e || e.dead) return;
            var kb = dir.clone().multiplyScalar(16); kb.y = 16;
            e.damage(ARM.dmg, kb, {
              react: 'blow', reactDur: 1, spark: CE2, stun: 1,
              bleed: true, death: 'flat' });
          });
        }
      }
      /* and she takes it back */
      if (t > .95) {
        var s = (t - .95) / .45;
        g.position.y = 2.4 + s * 22;
        g.rotation.x = .3 - s * 1.4;
        if (s > 1) { stop.stop(); drop(g); return false; }
      }
      return true;
    } });
    return g;
  }

  function castArm() {
    if (!ready('o3')) return;
    var a = start('o3', 1.2, 'o3', "RIKA'S ARM", '里香・腕');
    a.dir = aim();
    player.iframes = Math.max(player.iframes, .8);
    try { sfx.whoosh(); } catch (e) {}
  }
  function stepArm(a, dt) {
    var p = player, d = a.dir;
    p.vel.x *= .8; p.vel.z *= .8;
    if (a.stage < 1 && a.t > .34) {
      a.stage = 1;
      var side = new THREE.Vector3(-d.z, 0, d.x);
      var from = p.pos.clone().addScaledVector(d, -2).addScaledVector(side, 3);
      from.y = 0;
      FX.mote(p.pos.clone().add(new THREE.Vector3(0, 4, 0)), CE2, 3.4, .4);
      FX.rings(p.pos.clone().add(new THREE.Vector3(0, 3, 0)), CE, 2,
        { maxR: 9, life: .5, ground: false, gap: 40 });
      addShake(1.4);
      swingArm(from, d.clone());
    }
  }

  /* =====================================================================
     4 · TRUE LOVE  完全顕現・里香
     All of her. She comes out whole, she is bigger than anything else on
     the field, and the only part of her that glows is the inside of her
     mouth.
     ================================================================== */
  var LOVE = { dmg: 52, radius: 11, dur: 3.6, sweep: 16 };

  function buildRika() {
    var g = new THREE.Group();
    /* the head, which is mostly mouth */
    var skull = part(g, 5.2, 3.4, 4.4, 0, 11.6, 0, RIKA);
    skull.castShadow = true;
    part(g, 5.4, .5, 4.6, 0, 13.4, 0, RIKA_D);
    /* two small flat eyes, high and far apart */
    for (var s = -1; s <= 1; s += 2) {
      part(g, .9, .5, .3, 1.5 * s, 12.4, 2.25, MARK);
    }
    /* THE MOUTH. A lipless split all the way across, dark inside, with
       teeth top and bottom. The only lit thing on her. */
    var jaw = new THREE.Group();
    jaw.position.set(0, 10.2, .4);
    var inner = new THREE.Mesh(new THREE.BoxGeometry(4.8, 2.0, 3.4),
      new THREE.MeshBasicMaterial({ color: MAW, toneMapped: false }));
    inner.position.set(0, -.6, .6);
    jaw.add(inner);
    part(jaw, 5.0, 1.0, 4.0, 0, -1.4, .2, RIKA_D);
    for (var i = 0; i < 7; i++) {
      var t1 = part(g, .5, .8, .5, -1.8 + i * .6, 10.3, 2.0, TOOTH);
      t1.rotation.x = .1;
      var t2 = part(jaw, .5, .8, .5, -1.8 + i * .6, -.6, 1.8, TOOTH);
      t2.rotation.x = -.1;
    }
    g.add(jaw);
    g.__jaw = jaw;

    /* the hair, long and heavy, hanging past the shoulders */
    for (i = 0; i < 9; i++) {
      var a = (i / 9) * TAU;
      var h = part(g, .9, 5.5 + Math.random() * 3, .9,
        Math.cos(a) * 2.6, 8.4, Math.sin(a) * 2.2 - .6, i % 2 ? RIKA : RIKA_D);
      h.rotation.z = Math.cos(a) * .16;
      h.rotation.x = -Math.sin(a) * .1;
    }
    /* the body: narrow, and the torn dress under it */
    part(g, 3.6, 4.2, 2.8, 0, 7.4, -.2, RIKA);
    for (i = 0; i < 4; i++) {
      part(g, 3.8, .2, 3.0, 0, 8.6 - i * .9, -.2, MARK);
    }
    var skirt = part(g, 5.2, 4.4, 4.2, 0, 3.4, -.2, RIKA);
    skirt.castShadow = true;
    for (i = 0; i < 7; i++) {
      var rag = part(g, .8, 2.4 + Math.random() * 2.2, .7,
        -2.2 + i * .74, .6, 1.6, i % 2 ? RIKA_D : RIKA);
      rag.rotation.z = (Math.random() - .5) * .3;
    }
    /* two very long arms */
    g.__arms = [];
    for (s = -1; s <= 1; s += 2) {
      var arm = new THREE.Group();
      arm.position.set(2.4 * s, 9.4, 0);
      part(arm, 1.3, 4.6, 1.3, 0, -2.2, 0, RIKA);
      part(arm, 1.1, 4.2, 1.1, 0, -6.4, .3, RIKA_D);
      var hand = part(arm, 1.7, 1.0, 1.5, 0, -8.8, .4, RIKA);
      hand.castShadow = true;
      for (i = 0; i < 4; i++) {
        part(arm, .3, 1.6, .3, -.6 + i * .4, -9.9, .7, 0xe9e6d8);
      }
      arm.rotation.z = -.2 * s;
      arm.__base = arm.rotation.clone();
      g.add(arm);
      g.__arms.push(arm);
    }
    return g;
  }
  YT.buildRika = buildRika;

  /* `lane` is the line HE is facing down. She comes up beside him, so a
     sweep aimed straight out of her own shoulders lands eight metres off
     the thing he pointed at — she is helping, not fighting her own
     fight. */
  function manifest(at, dir, ghost, lane) {
    var g = buildRika();
    var aimAt = lane ? lane.clone().setY(0) : at.clone().addScaledVector(dir, LOVE.sweep);
    var face = aimAt.clone().sub(at).setY(0);
    if (face.lengthSq() < .01) face.copy(dir);
    face.normalize();
    g.position.set(at.x, -20, at.z);
    g.rotation.y = Math.atan2(face.x, face.z);
    scene.add(g);
    keep(g);
    var t = 0, roared = false, swept = false, drift = 0;
    var stop = shimmer(function () {
      return g.position.clone().add(new THREE.Vector3(0, 6, 0));
    }, function () { return t < LOVE.dur; });

    addFx({ t: 1e9, update: function (dt) {
      t += dt; drift += dt * 1.6;
      if (typeof scene === 'undefined') return false;
      if (t < .8) {
        g.position.y = -20 + E.out(t / .8) * 20;
        if (Math.random() < dt * 50) {
          FX.mote(g.position.clone().add(new THREE.Vector3(
            (Math.random() - .5) * 9, 2 + Math.random() * 12, (Math.random() - .5) * 6)), CE2, 2, .34);
        }
      } else g.position.y = Math.sin(drift) * .4;
      g.__arms.forEach(function (a2, i) {
        a2.rotation.z = a2.__base.z + Math.sin(drift * 1.3 + i * 2) * .22;
        a2.rotation.x = Math.sin(drift + i) * .18;
      });

      /* she opens, and everything in front of her knows about it */
      if (!roared && t > .95) {
        roared = true;
        g.__jaw.rotation.x = 1.05;
        FX.flash('#eafcff', .6, .3);
        FX.speedRing(g.position.clone().add(new THREE.Vector3(0, 10.6, 0)), CE2, 24, .4);
        overspill(g.position.clone().add(new THREE.Vector3(0, 10, 0)), face, 34, 20, CE);
        FX.mangaLines(1, .36);
        addShake(3.4);
        try { sfx.raise(); } catch (e) {}
      }
      /* and then both arms come across, together */
      if (roared && !swept && t > 1.7) {
        swept = true;
        var land = aimAt.clone();
        g.__arms.forEach(function (a2, i) {
          var s2 = 0;
          addFx({ t: .4, update: function (dd) {
            this.t -= dd; s2 += dd;
            a2.rotation.x = -1.3 + E.out(s2 / .4) * 2.4;
            a2.rotation.z = a2.__base.z * (1 - E.out(s2 / .4)) + (i ? -.5 : .5) * E.out(s2 / .4);
            return this.t > 0;
          } });
        });
        later(220, function () {
          FX.flash('#ffffff', .7, .3);
          FX.impact(land.clone().add(new THREE.Vector3(0, 2.4, 0)), CE2, 6);
          FX.rings(new THREE.Vector3(land.x, .12, land.z), CE, 6,
            { maxR: LOVE.radius * 2.6, life: 1, gap: 36 });
          FX.cracks(new THREE.Vector3(land.x, .1, land.z), 20, 24, 0x59636e);
          FX.dust(new THREE.Vector3(land.x, 0, land.z), 18, 0xcfd8e0, 24, 6);
          FX.debris(new THREE.Vector3(land.x, .1, land.z), 18, 22, 0x6a7488);
          overspill(land.clone().add(new THREE.Vector3(0, 2.4, 0)), face, 30, 22, CE);
          FX.mangaLines(1, .4);
          addShake(5);
          if (typeof hitstop === 'function') hitstop(.26);
          try { sfx.redBoom(); } catch (e) {}
          if (!ghost) {
            enemiesNear(land.clone().add(new THREE.Vector3(0, 2.5, 0)), LOVE.radius).forEach(function (e) {
              if (!e || e.dead) return;
              var kb = face.clone().multiplyScalar(30); kb.y = 22;
              e.damage(LOVE.dmg, kb, {
                react: 'blow', reactDur: 1.2, spark: CE2, stun: 1.2,
                bleed: true, death: 'dice' });
            });
          }
        });
      }
      if (t > LOVE.dur) {
        stop.stop();
        var s3 = 0;
        addFx({ t: 1e9, update: function (dd) {
          s3 += dd;
          g.position.y = -24 * s3;
          if (Math.random() < dd * 30) {
            FX.mote(g.position.clone().add(new THREE.Vector3(
              (Math.random() - .5) * 8, 4 + Math.random() * 8, (Math.random() - .5) * 5)), CE, 1.6, .3);
          }
          if (s3 > .9) { drop(g); return false; }
          return true;
        } });
        return false;
      }
      return true;
    } });
    return g;
  }

  function castLove() {
    if (!ready('o4')) return;
    var a = start('o4', 1.7, 'o4', 'TRUE LOVE', '完全顕現・里香');
    a.dir = aim();
    player.iframes = Math.max(player.iframes, 1.6);
    FX.letterbox(true);
    later(3400, function () { FX.letterbox(false); });
    try { sfx.raise(); } catch (e) {}
  }
  function stepLove(a, dt) {
    var p = player, d = a.dir;
    p.vel.set(0, 0, 0);
    if (a.stage < 1) {
      a.stage = 1;
      a.shine = shimmer(function () { return player.pos.clone(); },
        function () { return player.action === a; });
      FX.tint('#0a1620', .35, 1.6);
    }
    if (a.stage < 2 && a.t > .8) {
      a.stage = 2;
      /* She is fourteen metres tall. Four in front and eight to the side
         puts her level with the chase camera, which sees her shins and
         nothing else — she has to stand out where the fight is. */
      var side = new THREE.Vector3(-d.z, 0, d.x);
      var at = p.pos.clone().addScaledVector(d, 15).addScaledVector(side, 10);
      at.y = 0;
      FX.flash('#eafcff', .5, .3);
      FX.rings(new THREE.Vector3(at.x, .12, at.z), CE, 4, { maxR: 20, life: .8, gap: 42 });
      FX.cracks(new THREE.Vector3(at.x, .06, at.z), 12, 15, 0x59636e);
      addShake(2.4);
      if (typeof hitstop === 'function') hitstop(.12);
      manifest(at, d.clone(), false, p.pos.clone().addScaledVector(d, 18));
    }
  }

  /* =====================================================================
     POSES
     He is not a stylist. Everything is a plain, committed, slightly
     over-large version of the ordinary movement — which is the same
     thing his cursed energy does.
     ================================================================== */
  function poseYuta(r, a) {
    var t = a.t, out = E.out;
    switch (a.type) {
      case 'o1': {                     // draw, step, and cut across
        rp(r);
        var dr = out(Math.min(1, t / .26));
        var sw = t > .44 ? out(Math.min(1, (t - .44) / .16)) : 0;
        r.shoulderR.rotation.x = -.6 - .9 * dr + 1.5 * sw;
        r.shoulderR.rotation.z = -1.2 * dr + 2.0 * sw;
        r.shoulderR.rotation.y = -.7 * dr + 1.2 * sw;
        r.elbowR.rotation.x = -1.5 * dr + 1.2 * sw;
        r.shoulderL.rotation.x = -1.1 * dr - .3 * sw;
        r.shoulderL.rotation.z = .8 * dr - .8 * sw;
        r.elbowL.rotation.x = -1.4 * dr + .8 * sw;
        r.spine.rotation.y = .8 * dr - 1.6 * sw;
        r.spine.rotation.x = -.18 * dr + .34 * sw;
        r.neck.rotation.y = -.34 * dr + .6 * sw;
        r.hipL.rotation.x = -.5 * dr + .3 * sw; r.kneeL.rotation.x = .8 * dr;
        r.hipR.rotation.x = .4 * dr - .5 * sw; r.kneeR.rotation.x = .6 * dr;
        r.hips.position.y = r.hipsBaseY - .34 * dr + .16 * sw;
        return true;
      }
      case 'o2': {                     // one hand out, fingers open, held
        rp(r);
        var k = out(Math.min(1, t / .3));
        var pop = t > 1.3 ? out(Math.min(1, (t - 1.3) / .18)) : 0;
        r.shoulderR.rotation.x = -1.62 * k + .4 * pop;
        r.shoulderR.rotation.z = -.26 * k - .4 * pop;
        r.elbowR.rotation.x = -.2 * k;
        r.shoulderL.rotation.x = -.9 * k;
        r.shoulderL.rotation.z = .5 * k;
        r.elbowL.rotation.x = -1.3 * k;
        r.spine.rotation.x = -.2 * k + .4 * pop;
        r.spine.rotation.y = .2 * k - .3 * pop;
        r.neck.rotation.x = -.24 * k + .3 * pop;
        r.hipL.rotation.x = -.3 * k; r.kneeL.rotation.x = .55 * k;
        r.hipR.rotation.x = -.24 * k; r.kneeR.rotation.x = .46 * k;
        r.hips.position.y = r.hipsBaseY - .24 * k - .16 * pop;
        return true;
      }
      case 'o3': {                     // he does not swing it. He points
        rp(r);
        var pt = out(Math.min(1, t / .3));
        var thr = t > .38 ? out(Math.min(1, (t - .38) / .2)) : 0;
        r.shoulderR.rotation.x = -1.5 * pt - 1.1 * thr;
        r.shoulderR.rotation.z = -.3 * pt + .2 * thr;
        r.elbowR.rotation.x = -.9 * pt + .8 * thr;
        r.shoulderL.rotation.x = -.5 * pt - .4 * thr;
        r.shoulderL.rotation.z = .6 * pt;
        r.elbowL.rotation.x = -1.2 * pt;
        r.spine.rotation.x = .1 * pt - .5 * thr;
        r.spine.rotation.y = -.3 * pt + .2 * thr;
        r.neck.rotation.x = -.1 * pt - .3 * thr;
        r.hipL.rotation.x = -.34 * pt; r.kneeL.rotation.x = .6 * pt;
        r.hipR.rotation.x = -.26 * pt; r.kneeR.rotation.x = .5 * pt;
        r.hips.position.y = r.hipsBaseY - .3 * pt + .1 * thr;
        return true;
      }
      case 'o4': {                     // both arms down and open, and held
        rp(r);
        var op = out(Math.min(1, t / .6));
        var sway = Math.sin(t * 2.6) * .05;
        r.shoulderL.rotation.x = .5 * op;
        r.shoulderR.rotation.x = .5 * op;
        r.shoulderL.rotation.z = .95 * op + sway;
        r.shoulderR.rotation.z = -.95 * op - sway;
        r.elbowL.rotation.x = -.2 * op; r.elbowR.rotation.x = -.2 * op;
        r.spine.rotation.x = -.34 * op;
        r.neck.rotation.x = -.6 * op;
        r.hipL.rotation.x = -.14 * op; r.kneeL.rotation.x = .24 * op;
        r.hipR.rotation.x = -.12 * op; r.kneeR.rotation.x = .2 * op;
        r.hips.position.y = r.hipsBaseY - .1 * op;
        return true;
      }
    }
    return false;
  }

  /* --------------------------------------------------------------- wiring */
  var _stepAction = stepAction;
  stepAction = function (a, dt) {
    switch (a.type) {
      case 'o1': return stepKatana(a, dt);
      case 'o2': return stepBlue(a, dt);
      case 'o3': return stepArm(a, dt);
      case 'o4': return stepLove(a, dt);
    }
    return _stepAction(a, dt);
  };

  var _poseAction = poseAction;
  poseAction = function (r, a) {
    if (a && (r.__char || player.char) === 'yuta' && poseYuta(r, a)) return;
    return _poseAction(r, a);
  };

  /* four keys. R is deliberately not taken: he has no fifth technique,
     so it is left to whatever the game does with it */
  window.addEventListener('keydown', function (e) {
    if (!started || player.char !== 'yuta' || e.repeat) return;
    if (player.react || (player.action && (player.action.type === 'kb' ||
        player.action.type === 'void'))) {
      if (window.JJNOTICE && Math.random() < .5) window.JJNOTICE('NO TECHNIQUE WHILE HIT', '#ff8b98');
      return;
    }
    var hit = true;
    if (e.code === 'Digit1') castKatana();
    else if (e.code === 'Digit2') castBlue();
    else if (e.code === 'Digit3') castArm();
    else if (e.code === 'Digit4') castLove();
    else hit = false;
    if (hit) e.stopImmediatePropagation();
  }, true);

  var _switchChar = switchChar;
  switchChar = function (id, quiet) {
    YT.props.slice().forEach(drop);
    return _switchChar(id, quiet);
  };

  /* =====================================================================
     WHAT EVERYBODY ELSE SEES
     ================================================================== */
  function dirOf(yaw) { return new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)); }

  YT.remote = {
    o1: function (pos, yaw) {
      var d = dirOf(yaw), side = new THREE.Vector3(-d.z, 0, d.x);
      later(450, function () {
        var at = pos.clone().addScaledVector(d, 4).add(new THREE.Vector3(0, 2.6, 0));
        FX.slash(at.clone(), side, CE2, 15, .24);
        FX.slash(at.clone().add(new THREE.Vector3(0, -.6, 0)), side, CE, 12, .2);
        overspill(at.clone(), d, KAT.spill, 11, CE);
      });
    },
    o2: function (pos, yaw) {
      var d = dirOf(yaw), at = pos.clone().addScaledVector(d, BL.out).add(new THREE.Vector3(0, 3, 0));
      later(350, function () {
        var orb = FX.billboard(FX.T.star, COLD, .95);
        orb.position.copy(at);
        scene.add(orb);
        var t = 0;
        addFx({ t: 1e9, update: function (dd) {
          t += dd;
          FX.faceCam(orb, t * 2);
          orb.scale.setScalar(1.4 + Math.min(1, t / .5) * 3 + Math.sin(t * 18) * .3);
          FX.converge(at.clone(), COLD, 2, BL.radius, .3);
          if (t > BL.pull) { scene.remove(orb); orb.material.dispose(); return false; }
          return true;
        } });
        FX.rings(at.clone(), COLD, 3, { maxR: BL.radius, life: .6, ground: false, gap: 44 });
      });
      later(350 + BL.pull * 1000, function () {
        FX.impact(at.clone(), COLD2, 5);
        FX.rings(at.clone(), COLD, 4, { maxR: BL.radius * 1.6, life: .7, ground: false, gap: 34 });
        FX.rings(new THREE.Vector3(at.x, .12, at.z), COLD, 3, { maxR: BL.radius * 1.7, life: .7, gap: 38 });
        FX.debris(new THREE.Vector3(at.x, .1, at.z), 14, 16, 0x6a7488);
      });
    },
    o3: function (pos, yaw) {
      var d = dirOf(yaw), side = new THREE.Vector3(-d.z, 0, d.x);
      var from = pos.clone().addScaledVector(d, -2).addScaledVector(side, 3).setY(0);
      later(360, function () { swingArm(from, d.clone(), true); });
    },
    o4: function (pos, yaw) {
      var d = dirOf(yaw), side = new THREE.Vector3(-d.z, 0, d.x);
      var at = pos.clone().addScaledVector(d, 15).addScaledVector(side, 10).setY(0);
      FX.cracks(new THREE.Vector3(at.x, .06, at.z), 12, 15, 0x59636e);
      later(830, function () {
        FX.rings(new THREE.Vector3(at.x, .12, at.z), CE, 4, { maxR: 20, life: .8, gap: 42 });
        manifest(at, d.clone(), true, pos.clone().addScaledVector(d, 18));
      });
    }
  };

  /* the pieces the finishers borrow */
  YT.CE = CE; YT.CE2 = CE2; YT.CE_D = CE_D;
  YT.COLD = COLD; YT.COLD2 = COLD2;
  YT.RIKA = RIKA; YT.RIKA_D = RIKA_D; YT.MARK = MARK;
  YT.MAW = MAW; YT.TOOTH = TOOTH;
})();
