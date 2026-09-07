/* =======================================================================
   YUTA OKKOTSU
   Four ordinary sword techniques, and one that is not.

     1  CURSED KATANA     呪具・刀 — the cut across
     2  THRUST            突き — one point, straight through
     3  RISING CUT        斬り上げ — up from the floor, and so are they
     4  CROSS SLASH       十字斬り — two cuts on one beat, in an X
     R  PURE LOVE         純愛 — the special. Everything he has, in one,
                          and the cut is longer than the road

   Rika is NOT in this file. She comes later; what is here is a boy who
   is very good with a sword and puts far too much into it.

   Two rules for the look:

     · HIS ENERGY IS TOO MUCH FOR THE MOVE IT IS IN. He is a boy with a
       sword doing more damage than a sword does, so every cut of his is
       drawn several times longer than the blade and several times wider
       than the swing. That overspill IS the character.
     · ONE TO FOUR ARE THE SAME SIZE AS EACH OTHER. None of them is the
       big one — the big one is on R, where a special belongs, and it is
       the only move of his that stops the frame.
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
  /* the uniform out of the reference: a white high-collared top, dark
     grey trousers with a white drawstring, and the bag strap across him */
  var TOP = 0xecefe9, TOP_D = 0xd4d8d2, PANTS = 0x3a3d44, STRAP = 0x1b1d22;

  var YT = window.JJYUTA = { props: [] };

  var YCD = { o1: 6, o2: 7, o3: 8, o4: 9, or: 18 };

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
    name: 'YUTA OKKOTSU', sub: 'CURSED SWORDSMAN',
    cfg: YUTA_CFG, glow: '#8fe6ff',
    /* one to four are four ordinary cuts of about the same weight; the
       special is on R, which is where a special goes */
    moves: [
      { key: 'LMB', lbl: 'Punch', cd: 'm1', max: .3 },
      { key: 'Q', lbl: 'Dash', cd: 'dash', max: 1 },
      { key: '1', lbl: 'Cursed Katana', cd: 'o1', max: YCD.o1 },
      { key: '2', lbl: 'Thrust', cd: 'o2', max: YCD.o2 },
      { key: '3', lbl: 'Rising Cut', cd: 'o3', max: YCD.o3 },
      { key: '4', lbl: 'Cross Slash', cd: 'o4', max: YCD.o4 },
      { key: 'R', lbl: 'Pure Love', cd: 'or', max: YCD.or }
    ]
  };
  try { CHARS.yuta.portrait = makePortrait(YUTA_CFG); } catch (e) {}
  try { buildCharList(); } catch (e) {}

  cds.o1 = 0; cds.o2 = 0; cds.o3 = 0; cds.o4 = 0; cds.or = 0;

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

  /* The blade is in his hand for the length of the move and then it is
     not. Every one of the five wants exactly this, so it is one call. */
  function holdKatana(a, secs) {
    var k = buildKatana();
    player.rig.elbowR.add(k);
    k.position.set(0, -1.1, 0);
    k.rotation.x = Math.PI * .5;
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
      if (t > secs) { k.parent.remove(k); drop(k); return false; }
      return true;
    } });
    return k;
  }

  function castKatana() {
    if (!ready('o1')) return;
    var a = start('o1', 1.0, 'o1', 'CURSED KATANA', '呪具・刀');
    a.dir = aim();
    player.iframes = Math.max(player.iframes, .45);
    try { sfx.whoosh(); } catch (e) {}
  }
  function stepKatana(a, dt) {
    var p = player, d = a.dir;
    if (a.stage < 1) { a.stage = 1; a.kat = holdKatana(a, 1.0); }
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
     2 · THRUST  突き
     One point, straight, and the overspill goes out of the far side of
     whatever it went into.
     ================================================================== */
  var THR = { dmg: 32, reach: 13, spill: 24, step: 30 };

  function castThrust() {
    if (!ready('o2')) return;
    var a = start('o2', .95, 'o2', 'THRUST', '突き');
    a.dir = aim();
    player.iframes = Math.max(player.iframes, .45);
    try { sfx.whoosh(); } catch (e) {}
  }
  function stepThrust(a, dt) {
    var p = player, d = a.dir;
    if (a.stage < 1) { a.stage = 1; a.kat = holdKatana(a, .95); }
    if (a.t < .26) { p.vel.x *= .7; p.vel.z *= .7; return; }
    if (a.t < .44) {
      p.vel.x = d.x * THR.step; p.vel.z = d.z * THR.step;
      if (Math.random() < .5 && typeof ghostAfterimage === 'function') {
        ghostAfterimage(p.rig, CE_D, .22);
      }
      return;
    }
    p.vel.x *= .55; p.vel.z *= .55;
    if (a.stage < 2) {
      a.stage = 2;
      var at = p.pos.clone().addScaledVector(d, 3.6).add(new THREE.Vector3(0, 2.6, 0));
      /* a thrust is one line, so it is drawn as one very long one */
      FX.cutLine(at.clone(), at.clone().addScaledVector(d, THR.spill), CE2, 1.4, .35);
      FX.cutLine(at.clone(), at.clone().addScaledVector(d, THR.spill * .7), 0xffffff, .7, .28);
      overspill(at.clone(), d, THR.spill, 5, CE);
      FX.speedRing(at.clone(), CE2, 11, .26);
      FX.mangaLines(.7, .24);
      addShake(1.9);
      if (typeof hitstop === 'function') hitstop(.12);
      try { sfx.redBoom(); } catch (e) {}
      enemiesNear(at, THR.reach, d, .55).forEach(function (e) {
        if (!e || e.dead) return;
        var kb = d.clone().multiplyScalar(24); kb.y = 9;
        e.damage(THR.dmg, kb, {
          react: 'stagger', reactDur: .7, spark: CE2, stun: .7,
          bleed: true, death: 'sever' });
        FX.blood(e.pos.clone().add(new THREE.Vector3(0, 2.5, 0)), d, 14, 2);
        FX.cutLine(e.pos.clone().add(new THREE.Vector3(0, 2.5, 0)),
          e.pos.clone().add(new THREE.Vector3(0, 2.5, 0)).addScaledVector(d, 9), CE2, .8, .3);
      });
    }
  }

  /* =====================================================================
     3 · RISING CUT  斬り上げ
     Up from the floor. It takes them with it, which is what an upward
     cut is for.
     ================================================================== */
  var RISE = { dmg: 30, reach: 8.5, spill: 22 };

  function castRise() {
    if (!ready('o3')) return;
    var a = start('o3', 1.0, 'o3', 'RISING CUT', '斬り上げ');
    a.dir = aim();
    player.iframes = Math.max(player.iframes, .45);
    try { sfx.whoosh(); } catch (e) {}
  }
  function stepRise(a, dt) {
    var p = player, d = a.dir;
    if (a.stage < 1) { a.stage = 1; a.kat = holdKatana(a, 1.0); }
    if (a.t < .34) { p.vel.x *= .72; p.vel.z *= .72; return; }
    if (a.t < .46) { p.vel.x = d.x * 16; p.vel.z = d.z * 16; return; }
    p.vel.x *= .6; p.vel.z *= .6;
    if (a.stage < 2) {
      a.stage = 2;
      var at = p.pos.clone().addScaledVector(d, 3).add(new THREE.Vector3(0, 1.4, 0));
      FX.slash(at.clone(), new THREE.Vector3(0, 1, 0), CE2, 14, .24);
      FX.cutLine(at.clone().add(new THREE.Vector3(0, -1.4, 0)),
        at.clone().add(new THREE.Vector3(0, RISE.spill, 0)), CE2, 1.1, .34);
      overspill(at.clone(), new THREE.Vector3(0, 1, 0), RISE.spill, 9, CE);
      FX.dust(new THREE.Vector3(p.pos.x + d.x * 3, 0, p.pos.z + d.z * 3), 8, 0xcfd8e0, 11, 4);
      FX.mangaLines(.7, .24);
      addShake(2);
      if (typeof hitstop === 'function') hitstop(.11);
      try { sfx.redBoom(); } catch (e) {}
      enemiesNear(at, RISE.reach, d, -.2).forEach(function (e) {
        if (!e || e.dead) return;
        var kb = d.clone().multiplyScalar(7); kb.y = 34;
        e.damage(RISE.dmg, kb, {
          react: 'blow', reactDur: .9, spark: CE2, stun: .8,
          bleed: true, death: 'sever' });
        FX.blood(e.pos.clone().add(new THREE.Vector3(0, 2.4, 0)), new THREE.Vector3(0, 1, 0), 13, 2);
        FX.cutLine(e.pos.clone().add(new THREE.Vector3(0, -.2, 0)),
          e.pos.clone().add(new THREE.Vector3(0, 6.4, 0)), CE2, .8, .3);
      });
    }
  }

  /* =====================================================================
     4 · CROSS SLASH  十字斬り
     Two cuts on one beat, at right angles, both of them landing at once.
     Still an ordinary cut — it is two of the same thing, not a bigger
     one.
     ================================================================== */
  var CROSS = { dmg: 17, reach: 10, spill: 20 };

  function castCross() {
    if (!ready('o4')) return;
    var a = start('o4', 1.05, 'o4', 'CROSS SLASH', '十字斬り');
    a.dir = aim();
    player.iframes = Math.max(player.iframes, .5);
    try { sfx.whoosh(); } catch (e) {}
  }
  function stepCross(a, dt) {
    var p = player, d = a.dir;
    if (a.stage < 1) { a.stage = 1; a.kat = holdKatana(a, 1.05); }
    if (a.t < .3) { p.vel.x *= .72; p.vel.z *= .72; return; }
    if (a.t < .44) { p.vel.x = d.x * 18; p.vel.z = d.z * 18; return; }
    p.vel.x *= .6; p.vel.z *= .6;
    if (a.stage < 2) {
      a.stage = 2;
      var at = p.pos.clone().addScaledVector(d, 3.4).add(new THREE.Vector3(0, 2.6, 0));
      var side = new THREE.Vector3(-d.z, 0, d.x).normalize();
      /* both diagonals, on the same frame */
      [1, -1].forEach(function (sg) {
        var ax = side.clone().multiplyScalar(sg).add(new THREE.Vector3(0, 1, 0)).normalize();
        FX.slash(at.clone(), ax, sg > 0 ? CE2 : CE, 14, .24);
        FX.cutLine(at.clone().addScaledVector(ax, -CROSS.spill * .5),
          at.clone().addScaledVector(ax, CROSS.spill * .5), CE2, 1, .34);
        overspill(at.clone(), ax, CROSS.spill * .6, 8, CE);
      });
      FX.cross(at.clone(), 0xffffff, 8, .22);
      FX.mangaLines(.8, .26);
      addShake(2.2);
      if (typeof hitstop === 'function') hitstop(.13);
      try { sfx.redBoom(); } catch (e) {}
      /* each arm of the X is its own hit, so a body in the middle takes
         both — which is how it adds up to about what the others do */
      enemiesNear(at, CROSS.reach, d, .05).forEach(function (e) {
        if (!e || e.dead) return;
        [0, 1].forEach(function (n) {
          setTimeout(function () {
            if (typeof scene === 'undefined' || !e || e.dead) return;
            var kb = d.clone().multiplyScalar(11); kb.y = 10;
            e.damage(CROSS.dmg, kb, {
              react: n ? 'slash' : null, reactDur: .6, spark: CE2,
              stun: .5, bleed: true, death: 'dice', noFrameBonus: !!n });
            FX.blood(e.pos.clone().add(new THREE.Vector3(0, 2.5, 0)),
              side.clone().multiplyScalar(n ? 1 : -1), 9, 1.6);
          }, n * 70);
        });
      });
    }
  }

  /* =====================================================================
     R · PURE LOVE  純愛
     THE SPECIAL, and the only move of his that is allowed to be one. He
     does not cut faster or from a better angle — he simply stops holding
     any of it back, and the overspill goes the whole length of the road.
     ================================================================== */
  var PURE = { dmg: 62, reach: 16, spill: 60, wide: 26 };

  function castPure() {
    if (!ready('or')) return;
    var a = start('or', 1.7, 'or', 'PURE LOVE', '純愛');
    a.dir = aim();
    player.iframes = Math.max(player.iframes, 1.5);
    FX.letterbox(true);
    later(3000, function () { FX.letterbox(false); });
    try { sfx.raise(); } catch (e) {}
  }
  function stepPure(a, dt) {
    var p = player, d = a.dir;
    p.vel.set(0, 0, 0);
    if (a.stage < 1) {
      a.stage = 1;
      a.kat = holdKatana(a, 1.7);
      a.shine = shimmer(function () { return player.pos.clone(); },
        function () { return player.action === a; });
      FX.tint('#08161e', .35, 1.4);
    }
    /* the wind-up: it goes IN before it goes out, which is the only time
       anything of his does */
    if (a.t < .95) {
      if (Math.random() < dt * 20) {
        FX.converge(p.pos.clone().add(new THREE.Vector3(0, 2.6, 0)), CE, 6, 14, .4);
      }
      if (a.stage < 2 && a.t > .5) {
        a.stage = 2;
        FX.rings(p.pos.clone().add(new THREE.Vector3(0, 2.4, 0)), CE, 3,
          { maxR: 12, life: .6, ground: false, gap: 44 });
        FX.mangaLines(.5, .45);
        addShake(1);
      }
      return;
    }
    if (a.stage < 3) {
      a.stage = 3;
      var at = p.pos.clone().addScaledVector(d, 4).add(new THREE.Vector3(0, 2.8, 0));
      var side = new THREE.Vector3(-d.z, 0, d.x).normalize();
      FX.flash('#ffffff', .85, .32);
      FX.slash(at.clone(), side, 0xffffff, 30, .34);
      FX.slash(at.clone().add(new THREE.Vector3(0, -1, 0)), side, CE2, 24, .28);
      /* sixty metres of it, twenty six wide */
      overspill(at.clone(), d, PURE.spill, PURE.wide, CE);
      overspill(at.clone(), d, PURE.spill * .7, PURE.wide * .5, CE2);
      for (var i = 0; i < 7; i++) {
        var k = i / 6 - .5;
        FX.cutLine(at.clone().addScaledVector(side, k * PURE.wide),
          at.clone().addScaledVector(side, k * PURE.wide).addScaledVector(d, PURE.spill),
          i % 2 ? CE2 : 0xffffff, 1.4, .55);
      }
      FX.speedRing(at.clone(), CE2, 30, .42);
      FX.mangaLines(1, .42);
      FX.cracks(new THREE.Vector3(p.pos.x + d.x * 14, .1, p.pos.z + d.z * 14), 22, 30, 0x59636e);
      FX.dust(new THREE.Vector3(p.pos.x + d.x * 10, 0, p.pos.z + d.z * 10), 16, 0xcfd8e0, 22, 6);
      addShake(5);
      if (typeof hitstop === 'function') hitstop(.3);
      try { sfx.redBoom(); } catch (e) {}
      /* everything down the whole lane, at full value the entire way */
      var hit = [];
      for (var q = 4; q < PURE.spill; q += 8) {
        enemiesNear(p.pos.clone().addScaledVector(d, q).add(new THREE.Vector3(0, 2.4, 0)),
          PURE.wide * .5).forEach(function (e) {
          if (!e || e.dead || hit.indexOf(e) >= 0) return;
          hit.push(e);
          var kb = d.clone().multiplyScalar(34); kb.y = 20;
          e.damage(PURE.dmg, kb, {
            react: 'blow', reactDur: 1.2, spark: 0xffffff, stun: 1.2,
            bleed: true, death: 'sever' });
          FX.blood(e.pos.clone().add(new THREE.Vector3(0, 2.6, 0)), side, 22, 2.6);
          FX.cutLine(e.pos.clone().add(new THREE.Vector3(-5, 3.6, 0)),
            e.pos.clone().add(new THREE.Vector3(5, 1.4, 0)), 0xffffff, 1.2, .45);
        });
      }
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
      case 'o2': {                     // both hands back, and one point out
        rp(r);
        var wd = out(Math.min(1, t / .24));
        var pu = t > .42 ? out(Math.min(1, (t - .42) / .14)) : 0;
        r.shoulderR.rotation.x = -.4 - .8 * wd + 1.0 * pu;
        r.shoulderR.rotation.z = -.5 * wd + .5 * pu;
        r.shoulderR.rotation.y = -.9 * wd + 1.1 * pu;
        r.elbowR.rotation.x = -1.7 * wd + 1.6 * pu;
        r.shoulderL.rotation.x = -1.0 * wd + .6 * pu;
        r.shoulderL.rotation.z = .6 * wd - .5 * pu;
        r.elbowL.rotation.x = -1.5 * wd + 1.0 * pu;
        r.spine.rotation.y = .7 * wd - 1.0 * pu;
        r.spine.rotation.x = -.14 * wd + .3 * pu;
        r.neck.rotation.y = -.3 * wd + .5 * pu;
        r.hipL.rotation.x = -.5 * wd + .4 * pu; r.kneeL.rotation.x = .8 * wd - .3 * pu;
        r.hipR.rotation.x = .35 * wd - .5 * pu; r.kneeR.rotation.x = .55 * wd;
        r.hips.position.y = r.hipsBaseY - .38 * wd + .2 * pu;
        return true;
      }
      case 'o3': {                     // down low, and everything goes up
        rp(r);
        var lo = out(Math.min(1, t / .32));
        var up2 = t > .44 ? out(Math.min(1, (t - .44) / .16)) : 0;
        r.shoulderR.rotation.x = .7 * lo - 2.9 * up2;
        r.shoulderR.rotation.z = -.6 * lo + .5 * up2;
        r.elbowR.rotation.x = -.4 * lo - .3 * up2;
        r.shoulderL.rotation.x = .4 * lo - 2.2 * up2;
        r.shoulderL.rotation.z = .7 * lo - .5 * up2;
        r.elbowL.rotation.x = -.7 * lo - .2 * up2;
        r.spine.rotation.x = .34 * lo - .74 * up2;
        r.spine.rotation.y = .3 * lo - .5 * up2;
        r.neck.rotation.x = .2 * lo - .7 * up2;
        r.hipL.rotation.x = -.6 * lo + .5 * up2; r.kneeL.rotation.x = 1.0 * lo - .8 * up2;
        r.hipR.rotation.x = -.4 * lo + .3 * up2; r.kneeR.rotation.x = .8 * lo - .6 * up2;
        r.hips.position.y = r.hipsBaseY - .6 * lo + .5 * up2;
        return true;
      }
      case 'o4': {                     // the arm goes twice, on one beat
        rp(r);
        var w2 = out(Math.min(1, t / .28));
        var c1 = t > .42 ? out(Math.min(1, (t - .42) / .1)) : 0;
        var c2 = t > .52 ? out(Math.min(1, (t - .52) / .1)) : 0;
        r.shoulderR.rotation.x = -1.0 * w2 + 1.4 * c1 - .9 * c2;
        r.shoulderR.rotation.z = -1.3 * w2 + 2.2 * c1 - 1.6 * c2;
        r.shoulderR.rotation.y = -.8 * w2 + 1.4 * c1;
        r.elbowR.rotation.x = -1.2 * w2 + .9 * c1 - .3 * c2;
        r.shoulderL.rotation.x = -1.2 * w2 + .4 * c1;
        r.shoulderL.rotation.z = .9 * w2 - .7 * c1 + .4 * c2;
        r.elbowL.rotation.x = -1.4 * w2 + .8 * c1;
        r.spine.rotation.y = .9 * w2 - 1.5 * c1 + .9 * c2;
        r.spine.rotation.x = -.2 * w2 + .4 * c1 - .2 * c2;
        r.neck.rotation.y = -.34 * w2 + .6 * c1 - .3 * c2;
        r.hipL.rotation.x = -.5 * w2; r.kneeL.rotation.x = .8 * w2;
        r.hipR.rotation.x = .34 * w2 - .4 * c1; r.kneeR.rotation.x = .6 * w2;
        r.hips.position.y = r.hipsBaseY - .4 * w2 + .2 * c1;
        return true;
      }
      case 'or': {                     // the only one he takes his time on
        rp(r);
        var gather = out(Math.min(1, t / .55));
        var held = t > .55 ? Math.min(1, (t - .55) / .4) : 0;
        var go = t > .95 ? out(Math.min(1, (t - .95) / .18)) : 0;
        var tremor = Math.sin(t * 24) * .035 * held * (1 - go);
        r.shoulderR.rotation.x = -.3 - 1.5 * gather + 2.6 * go;
        r.shoulderR.rotation.z = -1.6 * gather + 2.6 * go + tremor;
        r.shoulderR.rotation.y = -1.1 * gather + 1.9 * go;
        r.elbowR.rotation.x = -1.9 * gather + 1.8 * go;
        r.shoulderL.rotation.x = -1.5 * gather + 1.0 * go;
        r.shoulderL.rotation.z = 1.0 * gather - .9 * go - tremor;
        r.elbowL.rotation.x = -1.8 * gather + 1.2 * go;
        r.spine.rotation.y = 1.1 * gather - 2.1 * go;
        r.spine.rotation.x = -.3 * gather + .6 * go + tremor;
        r.neck.rotation.y = -.44 * gather + .8 * go;
        r.neck.rotation.x = -.2 * gather + .4 * go;
        r.hipL.rotation.x = -.7 * gather + .5 * go; r.kneeL.rotation.x = 1.05 * gather - .4 * go;
        r.hipR.rotation.x = .5 * gather - .7 * go; r.kneeR.rotation.x = .75 * gather;
        r.hips.position.y = r.hipsBaseY - .55 * gather + .28 * go + tremor;
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
      case 'o2': return stepThrust(a, dt);
      case 'o3': return stepRise(a, dt);
      case 'o4': return stepCross(a, dt);
      case 'or': return stepPure(a, dt);
    }
    return _stepAction(a, dt);
  };

  var _poseAction = poseAction;
  poseAction = function (r, a) {
    if (a && (r.__char || player.char) === 'yuta' && poseYuta(r, a)) return;
    return _poseAction(r, a);
  };

  window.addEventListener('keydown', function (e) {
    if (!started || player.char !== 'yuta' || e.repeat) return;
    if (player.react || (player.action && (player.action.type === 'kb' ||
        player.action.type === 'void'))) {
      if (window.JJNOTICE && Math.random() < .5) window.JJNOTICE('NO TECHNIQUE WHILE HIT', '#ff8b98');
      return;
    }
    var hit = true;
    if (e.code === 'Digit1') castKatana();
    else if (e.code === 'Digit2') castThrust();
    else if (e.code === 'Digit3') castRise();
    else if (e.code === 'Digit4') castCross();
    else if (e.code === 'KeyR') castPure();
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
      var d = dirOf(yaw);
      later(460, function () {
        var at = pos.clone().addScaledVector(d, 3.6).add(new THREE.Vector3(0, 2.6, 0));
        FX.cutLine(at.clone(), at.clone().addScaledVector(d, THR.spill), CE2, 1.4, .35);
        FX.cutLine(at.clone(), at.clone().addScaledVector(d, THR.spill * .7), 0xffffff, .7, .28);
        overspill(at.clone(), d, THR.spill, 5, CE);
        FX.speedRing(at.clone(), CE2, 11, .26);
      });
    },
    o3: function (pos, yaw) {
      var d = dirOf(yaw);
      later(470, function () {
        var at = pos.clone().addScaledVector(d, 3).add(new THREE.Vector3(0, 1.4, 0));
        FX.slash(at.clone(), new THREE.Vector3(0, 1, 0), CE2, 14, .24);
        FX.cutLine(at.clone().add(new THREE.Vector3(0, -1.4, 0)),
          at.clone().add(new THREE.Vector3(0, RISE.spill, 0)), CE2, 1.1, .34);
        overspill(at.clone(), new THREE.Vector3(0, 1, 0), RISE.spill, 9, CE);
        FX.dust(new THREE.Vector3(at.x, 0, at.z), 8, 0xcfd8e0, 11, 4);
      });
    },
    o4: function (pos, yaw) {
      var d = dirOf(yaw), side = new THREE.Vector3(-d.z, 0, d.x).normalize();
      later(450, function () {
        var at = pos.clone().addScaledVector(d, 3.4).add(new THREE.Vector3(0, 2.6, 0));
        [1, -1].forEach(function (sg) {
          var ax = side.clone().multiplyScalar(sg).add(new THREE.Vector3(0, 1, 0)).normalize();
          FX.slash(at.clone(), ax, sg > 0 ? CE2 : CE, 14, .24);
          FX.cutLine(at.clone().addScaledVector(ax, -CROSS.spill * .5),
            at.clone().addScaledVector(ax, CROSS.spill * .5), CE2, 1, .34);
          overspill(at.clone(), ax, CROSS.spill * .6, 8, CE);
        });
        FX.cross(at.clone(), 0xffffff, 8, .22);
      });
    },
    /* the special, which is the one worth drawing properly on somebody
       else's screen: sixty metres of cut, twenty six wide */
    or: function (pos, yaw) {
      var d = dirOf(yaw), side = new THREE.Vector3(-d.z, 0, d.x).normalize();
      var t = 0;
      addFx({ t: .95, update: function (dd) {
        this.t -= dd; t += dd;
        if (Math.random() < dd * 16) {
          FX.converge(pos.clone().add(new THREE.Vector3(0, 2.6, 0)), CE, 5, 14, .4);
        }
        return this.t > 0;
      } });
      later(970, function () {
        var at = pos.clone().addScaledVector(d, 4).add(new THREE.Vector3(0, 2.8, 0));
        FX.flash('#ffffff', .7, .3);
        FX.slash(at.clone(), side, 0xffffff, 30, .34);
        FX.slash(at.clone().add(new THREE.Vector3(0, -1, 0)), side, CE2, 24, .28);
        overspill(at.clone(), d, PURE.spill, PURE.wide, CE);
        overspill(at.clone(), d, PURE.spill * .7, PURE.wide * .5, CE2);
        for (var i = 0; i < 7; i++) {
          var k = i / 6 - .5;
          FX.cutLine(at.clone().addScaledVector(side, k * PURE.wide),
            at.clone().addScaledVector(side, k * PURE.wide).addScaledVector(d, PURE.spill),
            i % 2 ? CE2 : 0xffffff, 1.4, .55);
        }
        FX.speedRing(at.clone(), CE2, 30, .42);
        FX.cracks(new THREE.Vector3(pos.x + d.x * 14, .1, pos.z + d.z * 14), 22, 30, 0x59636e);
        FX.dust(new THREE.Vector3(pos.x + d.x * 10, 0, pos.z + d.z * 10), 16, 0xcfd8e0, 22, 6);
      });
    }
  };

  /* the pieces the finishers borrow */
  YT.CE = CE; YT.CE2 = CE2; YT.CE_D = CE_D;
})();
