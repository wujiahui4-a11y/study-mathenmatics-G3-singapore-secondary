/* =======================================================================
   KENTO NANAMI  —  RATIO TECHNIQUE  十劃呪法

   A grade 1 sorcerer who used to be a salaryman and never stopped being
   one. His technique is arithmetic: divide whatever is in front of him
   into ten parts and hit it at the seven-to-three line, and that spot is
   a weak point whether the thing had one or not. It works on a special
   grade curse and it works on a wall.

   Which makes him the least flashy fighter on this roster and the most
   MEASURED one. Nothing in this file is thrown wildly. Every move draws
   the division on the target first — ten ticks up the body, the seventh
   one lit — and then puts a blunt weapon through that mark. The weapon
   does not cut. It is a cleaver with no edge, wrapped in the same
   spotted cloth as his tie, and it works by breaking things.

     1  RATIO TECHNIQUE  十劃呪法 — measure, then one strike on the line
     2  BLUNT CLEAVE     鈍刀 — two hands, across, and it does not slice
     3  COLLAPSE         瓦落瓦落 — the ratio applied to a whole lane
                         rather than to one person
     4  THROWN BLADE     投擲 — it goes out, it lands, it comes back
     R  OVERTIME         時間外労働 — the special. The binding vow says
                         he works fixed hours. Past them it lapses, and
                         his output does not

   One to four are four measured strikes of about the same weight. The
   big one is on R, where a special belongs, and it is a SKILL: he checks
   the time, the vow lapses, he swings once. No cinema bars, no domain.

   The look, from the reference: blonde hair with a neat part, round
   tinted glasses with no arms over the ears, a blue shirt with the
   sleeves rolled to the elbow, brown leather braces, a spotted tie,
   cream slacks and brown shoes. Nothing in his palette glows. The only
   lit thing in the file is the division line, and it is a cold near
   white — a ruler, not an aura.
   ===================================================================== */
(function () {
  'use strict';
  if (typeof player === 'undefined' || typeof THREE === 'undefined') return;
  var FX = window.JJFX;
  if (!FX || typeof CHARS === 'undefined') return;
  var AN = window.JJANIM;
  var E = FX.ease;
  var TAU = Math.PI * 2;

  /* the measurement: a cold near-white, because it is a ruler */
  var RAT = 0xd8e4ec, RAT2 = 0xffffff, STEEL = 0x4d84a8;
  /* the man */
  var SHIRT = 0x3f6f96, SHIRT_D = 0x2f5878, BRACE = 0x8a5232, BRACE_D = 0x63381f;
  var TIE = 0xa89a5e, TIE_SPOT = 0x2a2618, SLACK = 0xd8d4c8, SLACK_D = 0xbfbbae;
  var SHOE = 0x7a4a2c, BELT = 0x5c3a22, SKIN = 0xf0c9a0, SKIN_D = 0xd6a878;
  var HAIR = 0xd6c17e, HAIR_D = 0xb59a52;
  var LENS = 0x3d5a4a, FRAME = 0xc9a84e;
  /* the weapon: a black grip, a spotted wrap, and a blunt end */
  var GRIP = 0x14151a, WRAP = 0xf2f0ea, SPOT = 0x191919, BLADE = 0x9aa2ab, BLADE_D = 0x6d747c;

  var NA = window.JJNANAMI = { props: [] };

  var WCD = { w1: 6, w2: 6, w3: 8, w4: 8, wr: 17 };

  var NANAMI_CFG = {
    nanami: true, face: false,
    torso: SHIRT, pants: SLACK, shoes: SHOE, skin: SKIN
  };

  /* ---------------------------------------------------------------- rig
     The three things that have to read at fighting distance: the round
     tinted glasses, the braces over a blue shirt, and the fact that his
     sleeves stop at the elbow. Everything else is trim.
     ================================================================== */
  var _makeAnimeRig = makeAnimeRig;
  makeAnimeRig = function (cfg) {
    var r = _makeAnimeRig(cfg);
    if (!cfg || !cfg.nanami) return r;
    var head = r.head, spine = r.spine, hips = r.hips;

    function box(w, h, d, c, basic) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), basic
        ? new THREE.MeshBasicMaterial({ color: c, toneMapped: false })
        : new THREE.MeshStandardMaterial({ color: c, roughness: .8 }));
      m.castShadow = !basic;
      return m;
    }
    var i, s;

    /* the hair: blonde, short, with a part that is on one side and stays
       there. It is combed rather than styled */
    var top = box(.96, .3, .96, HAIR); top.position.set(0, .98, -.02); head.add(top);
    var swept = box(.9, .22, .8, HAIR_D); swept.position.set(0, 1.16, -.08); swept.rotation.x = .1; head.add(swept);
    var part = box(.07, .22, .84, HAIR_D); part.position.set(-.2, 1.06, -.02); head.add(part);
    /* a short fringe that stops well above the glasses */
    for (i = 0; i < 4; i++) {
      var fr = box(.24, .2, .12, i % 2 ? HAIR : HAIR_D);
      fr.position.set(-.33 + i * .22, .92, .44);
      fr.rotation.z = (i - 1.5) * .08;
      head.add(fr);
    }
    for (s = -1; s <= 1; s += 2) {
      var side = box(.12, .44, .8, HAIR_D); side.position.set(.44 * s, .74, -.04); head.add(side);
    }
    var back = box(.9, .44, .16, HAIR_D); back.position.set(0, .74, -.44); head.add(back);

    /* THE GLASSES. Round, tinted, and with no arms going over his ears —
       they sit on the face and the bridge is the only thing holding them */
    for (s = -1; s <= 1; s += 2) {
      var ring = box(.32, .3, .06, FRAME); ring.position.set(.22 * s, .57, .46); head.add(ring);
      var lens = box(.26, .24, .05, LENS, true); lens.position.set(.22 * s, .57, .49); head.add(lens);
      var shine = box(.08, .16, .03, 0x9fc4b4, true); shine.position.set(.15 * s, .61, .51); head.add(shine);
    }
    var bridge = box(.16, .05, .05, FRAME); bridge.position.set(0, .58, .48); head.add(bridge);
    var brow = box(.72, .04, .06, HAIR_D); brow.position.set(0, .74, .46); head.add(brow);
    var mouth2 = box(.2, .04, .04, 0xb07a5e); mouth2.position.set(0, .28, .46); head.add(mouth2);
    var jaw2 = box(.8, .2, .28, SKIN_D); jaw2.position.set(0, .14, .3); head.add(jaw2);

    /* the collar, open at the throat, and the tie under it */
    var collarL = box(.3, .26, .12, SHIRT_D); collarL.position.set(-.2, 1.02, .34); collarL.rotation.z = .3; spine.add(collarL);
    var collarR = box(.3, .26, .12, SHIRT_D); collarR.position.set(.2, 1.02, .34); collarR.rotation.z = -.3; spine.add(collarR);
    var knot = box(.16, .16, .1, TIE); knot.position.set(0, .96, .36); spine.add(knot);
    /* the tie: spotted, the same cloth as the wrap on the weapon */
    for (i = 0; i < 6; i++) {
      var seg = box(.13 + i * .01, .16, .07, TIE);
      seg.position.set(0, .82 - i * .155, .36 + i * .002);
      spine.add(seg);
      if (i % 2 === 0) {
        var sp = box(.045, .045, .03, TIE_SPOT); sp.position.set(-.032, .84 - i * .155, .41); spine.add(sp);
      }
      var sp2 = box(.04, .04, .03, TIE_SPOT); sp2.position.set(.036, .78 - i * .155, .41); spine.add(sp2);
    }
    /* the shirt placket and its buttons */
    var placket = box(.1, 1.0, .06, SHIRT_D); placket.position.set(-.14, .56, .34); spine.add(placket);

    /* THE BRACES. Over both shoulders, down the front to the waistband
       and down the back, which is what stops them reading as straps on a
       bag rather than as braces */
    for (s = -1; s <= 1; s += 2) {
      var fB = box(.14, 1.14, .07, BRACE); fB.position.set(.44 * s, .5, .35);
      fB.rotation.z = .13 * s; spine.add(fB);
      var oB = box(.14, .3, .5, BRACE); oB.position.set(.44 * s, 1.0, .06); spine.add(oB);
      var bB = box(.14, 1.04, .07, BRACE_D); bB.position.set(.36 * s, .5, -.32);
      bB.rotation.z = -.05 * s; spine.add(bB);
      var clip = box(.16, .1, .1, 0xb8bcc4); clip.position.set(.44 * s, -.02, .36); spine.add(clip);
    }

    /* the sleeves stop at the elbow: the upper arm is shirt, the forearm
       is him, and a rolled cuff sits at the join */
    var arms = [[r.shoulderL, r.elbowL], [r.shoulderR, r.elbowR]];
    for (i = 0; i < arms.length; i++) {
      var roll = box(.44, .2, .44, SHIRT_D); roll.position.set(0, -.94, 0); arms[i][0].add(roll);
      var fore = box(.34, .94, .34, SKIN); fore.position.set(0, -.46, 0); arms[i][1].add(fore);
    }

    /* the belt over the waistband of the slacks, and a crease down each leg */
    var belt2 = box(1.08, .16, .66, BELT); belt2.position.set(0, .72, 0); hips.add(belt2);
    var buck2 = box(.2, .16, .08, 0xb8bcc4); buck2.position.set(0, .72, .34); hips.add(buck2);
    var legs = [[r.hipL, r.kneeL], [r.hipR, r.kneeR]];
    for (i = 0; i < legs.length; i++) {
      var cr = box(.05, 1.18, .06, SLACK_D); cr.position.set(0, -.59, .25); legs[i][0].add(cr);
      var cr2 = box(.05, 1.14, .06, SLACK_D); cr2.position.set(0, -.57, .22); legs[i][1].add(cr2);
    }

    return r;
  };

  CHARS.nanami = {
    name: 'KENTO NANAMI', sub: 'RATIO TECHNIQUE 十劃呪法',
    cfg: NANAMI_CFG, glow: '#4d84a8',
    moves: [
      { key: 'LMB', lbl: 'Punch', cd: 'm1', max: .3 },
      { key: 'Q', lbl: 'Dash', cd: 'dash', max: 1 },
      { key: '1', lbl: 'Ratio Technique', cd: 'w1', max: WCD.w1 },
      { key: '2', lbl: 'Blunt Cleave', cd: 'w2', max: WCD.w2 },
      { key: '3', lbl: 'Collapse', cd: 'w3', max: WCD.w3 },
      { key: '4', lbl: 'Thrown Blade', cd: 'w4', max: WCD.w4 },
      { key: 'R', lbl: 'Overtime', cd: 'wr', max: WCD.wr }
    ]
  };
  try { CHARS.nanami.portrait = makePortrait(NANAMI_CFG); } catch (e) {}
  try { buildCharList(); } catch (e) {}

  cds.w1 = 0; cds.w2 = 0; cds.w3 = 0; cds.w4 = 0; cds.wr = 0;

  /* --------------------------------------------------------------- help */
  function ready(key) {
    return player.char === 'nanami' && !player.dead && !busy() && cds[key] <= 0 &&
      !player.react && !(window.JJNAOYA && window.JJNAOYA.busy());
  }
  function start(type, dur, key, name, sub) {
    cds[key] = WCD[key];
    player.action = { type: type, t: 0, dur: dur, stage: 0 };
    if (name) { try { showSplash(name, sub || '', '#4d84a8'); } catch (e) {} }
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
      new THREE.MeshStandardMaterial({ color: c, roughness: .7, metalness: .12, flatShading: true }));
    m.position.set(x, y, z);
    m.castShadow = Math.max(w, h, d) > .8;
    g.add(m);
    return m;
  }
  function keep(o) { NA.props.push(o); return o; }
  function drop(o) {
    if (!o) return;
    var i = NA.props.indexOf(o);
    if (i >= 0) NA.props.splice(i, 1);
    if (o.parent) o.parent.remove(o); else scene.remove(o);
    o.traverse(function (c) {
      if (c.isMesh) { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); }
    });
  }
  function nearest(range, cone) {
    var d = aim(), best = null, near = range || 26;
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
     THE WEAPON
     A cleaver with no edge on it, wrapped in white cloth with black
     spots — the same cloth as his tie, which is the one joke he makes.
     ================================================================== */
  function buildCleaver() {
    var g = new THREE.Group();
    /* the grip, black and plain */
    part(g, .16, .16, 1.1, 0, 0, -1.5, GRIP);
    part(g, .22, .22, .12, 0, 0, -2.1, 0x0a0b0e);
    part(g, .3, .06, .16, 0, 0, -.9, 0x2a2c33);          // the guard
    /* the wrap: a cloth sleeve over the body of it, and the spots */
    for (var i = 0; i < 6; i++) {
      var w = .5 - i * .012;
      part(g, w, .3 - i * .012, .42, 0, 0, -.5 + i * .42, WRAP);
    }
    for (var k = 0; k < 16; k++) {
      var sp = part(g, .1 + Math.random() * .07, .06, .1 + Math.random() * .07,
        (Math.random() - .5) * .34, (Math.random() < .5 ? .16 : -.16), -.4 + Math.random() * 2.4, SPOT);
      sp.castShadow = false;
    }
    /* and the end of it, which is square, because it does not cut */
    part(g, .46, .3, .5, 0, 0, 2.1, BLADE);
    part(g, .5, .12, .16, 0, 0, 2.32, BLADE_D);
    return g;
  }
  NA.buildCleaver = buildCleaver;

  /* he holds it in the right hand for the length of a swing, and then it
     is put away again — he does not walk around with it out */
  function holdCleaver(secs) {
    var g = buildCleaver();
    player.rig.elbowR.add(g);
    keep(g);
    g.position.set(0, -1.1, 0);
    g.rotation.x = Math.PI * .5;
    var t = 0;
    addFx({ t: 1e9, update: function (dt) {
      t += dt;
      if (typeof scene === 'undefined' || NA.props.indexOf(g) < 0) return false;
      if (t > secs) { drop(g); return false; }
      return true;
    } });
    return g;
  }
  NA.hold = holdCleaver;

  /* =====================================================================
     THE MEASUREMENT
     The signature, and it is on every move: ten ticks drawn up whatever
     he is about to hit, and the seventh one lit. It is a cold white
     line rather than an aura — he is measuring, not charging.
     ================================================================== */
  function ratioMarks(at, height, life) {
    life = life || .5;
    var h = height || 5;
    for (var i = 1; i < 10; i++) {
      var y = at.y - h * .5 + h * (i / 10);
      var lit = (i === 7);
      var w = lit ? 2.6 : 1.4;
      FX.cutLine(
        new THREE.Vector3(at.x - w, y, at.z),
        new THREE.Vector3(at.x + w, y, at.z),
        lit ? RAT2 : RAT, lit ? .5 : .22, lit ? life * 1.6 : life);
      if (lit) {
        FX.cutLine(
          new THREE.Vector3(at.x - w, y, at.z - w),
          new THREE.Vector3(at.x + w, y, at.z + w),
          RAT2, .4, life * 1.6);
        FX.mote(new THREE.Vector3(at.x, y, at.z), RAT2, 3, .3);
      }
    }
    /* the vertical the ticks hang off */
    FX.cutLine(
      new THREE.Vector3(at.x, at.y - h * .5, at.z),
      new THREE.Vector3(at.x, at.y + h * .5, at.z), RAT, .18, life);
  }
  NA.marks = ratioMarks;

  /* where the seventh tick is on a given body */
  function ratioPoint(e) {
    return e.pos.clone().add(new THREE.Vector3(0, 5 * .7, 0));
  }

  /* the strike itself: the blunt end arriving at the mark. Nanami is the
     one who lands Black Flash more than anybody, so a clean hit on the
     line borrows Yuji's for the distortion */
  function ratioHit(e, dmg, opts) {
    opts = opts || {};
    if (!e || e.dead) return;
    var at = ratioPoint(e);
    var kb = (opts.dir || aim()).clone().multiplyScalar(opts.kb == null ? 24 : opts.kb);
    kb.y = opts.up == null ? 11 : opts.up;
    e.damage(dmg, kb, {
      react: opts.react === undefined ? 'blow' : opts.react,
      reactDur: opts.reactDur || .8,
      spark: RAT2, stun: opts.stun == null ? .7 : opts.stun,
      noFrameBonus: opts.noFrameBonus, bleed: true,
      death: opts.death || 'sever'
    });
    FX.impact(at.clone(), RAT2, opts.size || 3.6);
    FX.cross(at.clone(), RAT, opts.size || 9, .28);
    FX.blood(at.clone(), kb.clone().normalize(), opts.gore == null ? 14 : opts.gore, 2);
    if (opts.flash && window.JJYUJI && window.JJYUJI.blackFlash) {
      window.JJYUJI.blackFlash(at.clone());
    }
    addShake(opts.shake == null ? 1.8 : opts.shake);
    if (opts.stop !== false && typeof hitstop === 'function') hitstop(opts.stop || .09);
  }
  NA.hit = ratioHit;

  /* WHO IS IN FRONT OF HIM.
     enemiesNear measures its cone from the point you hand it, and every
     swing in this file lands a few units ahead of him — so somebody
     standing ON him came out BEHIND the strike point and was rejected by
     a swing that would obviously have hit them. The cone belongs on the
     man, and the reach on the weapon. */
  function inFront(reach, cone) {
    var p = player, d = aim(), out = [];
    for (var i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      if (!e || e.dead) continue;
      var rel = e.pos.clone().sub(p.pos); rel.y = 0;
      var dist = rel.length();
      if (dist > reach) continue;
      if (dist > .6 && rel.normalize().dot(d) < (cone == null ? -.2 : cone)) continue;
      out.push(e);
    }
    return out;
  }
  NA.inFront = inFront;

  /* the arc a blunt thing draws when it is swung hard */
  function swingArc(at, axis, len, color) {
    FX.slash(at.clone(), axis, color || RAT, len || 12, .24);
    FX.speedRing(at.clone(), RAT, (len || 12) * .5, .2);
  }

  /* =====================================================================
     1 · RATIO TECHNIQUE  十劃呪法
     Measure, then one strike. The whole character in four seconds.
     ================================================================== */
  var W1 = { dmg: 34, reach: 9, step: 22 };

  function castRatio() {
    if (!ready('w1')) return;
    var a = start('w1', 1.1, 'w1', 'RATIO TECHNIQUE', '十劃呪法');
    a.dir = aim();
    a.mark = nearest(18, .1);
    holdCleaver(1.3);
    try { sfx.raise(); } catch (e) {}
  }
  function stepRatio(a, dt) {
    var p = player, d = a.dir;
    if (a.stage < 1 && a.t > .1) {
      a.stage = 1;
      /* the measuring happens before he moves, which is the point */
      var on = a.mark && !a.mark.dead ? a.mark.pos.clone().add(new THREE.Vector3(0, 2.6, 0))
        : p.pos.clone().addScaledVector(d, 7).add(new THREE.Vector3(0, 2.6, 0));
      ratioMarks(on, 5.2, .55);
      FX.mangaLines(.4, .3);
    }
    if (a.t < .34) { p.vel.x *= .7; p.vel.z *= .7; return; }
    if (a.t < .56) { p.vel.x = d.x * W1.step; p.vel.z = d.z * W1.step; return; }
    p.vel.x *= .5; p.vel.z *= .5;
    if (a.stage < 2 && a.t > .6) {
      a.stage = 2;
      var at = p.pos.clone().addScaledVector(d, 3.4).add(new THREE.Vector3(0, 3.4, 0));
      swingArc(at, new THREE.Vector3(0, -1, 0), 13, RAT2);
      FX.flash('#ffffff', .3, .16);
      FX.cracks(new THREE.Vector3(p.pos.x + d.x * 4, .08, p.pos.z + d.z * 4), 10, 13, 0x4a5058);
      try { sfx.redBoom(); } catch (e) {}
      var got = inFront(W1.reach, 0);
      got.forEach(function (e) {
        ratioHit(e, W1.dmg, { dir: d, flash: true, size: 4.4, shake: 2.4, stop: .12 });
      });
      if (!got.length) {
        FX.dust(new THREE.Vector3(p.pos.x + d.x * 4, 0, p.pos.z + d.z * 4), 8, 0xc8ccd4, 10, 4);
        addShake(1);
      }
    }
  }

  /* =====================================================================
     2 · BLUNT CLEAVE  鈍刀
     Two hands, across, and it does not slice. It breaks.
     ================================================================== */
  var W2 = { dmg: 34, reach: 10.5, step: 16 };

  function castCleave() {
    if (!ready('w2')) return;
    var a = start('w2', 1.05, 'w2', 'BLUNT CLEAVE', '鈍刀');
    a.dir = aim();
    holdCleaver(1.25);
    try { sfx.whoosh(); } catch (e) {}
  }
  function stepCleave(a, dt) {
    var p = player, d = a.dir;
    var side = new THREE.Vector3(-d.z, 0, d.x);
    if (a.t < .3) { p.vel.x *= .74; p.vel.z *= .74; return; }
    if (a.t < .5) { p.vel.x = d.x * W2.step; p.vel.z = d.z * W2.step; return; }
    p.vel.x *= .5; p.vel.z *= .5;
    if (a.stage < 1 && a.t > .52) {
      a.stage = 1;
      var at = p.pos.clone().addScaledVector(d, 3.6).add(new THREE.Vector3(0, 2.9, 0));
      ratioMarks(at.clone(), 4.6, .3);
      swingArc(at, side, 16, RAT2);
      FX.cutLine(at.clone().addScaledVector(side, -8), at.clone().addScaledVector(side, 8), RAT2, .8, .3);
      FX.flash('#ffffff', .28, .16);
      FX.cracks(new THREE.Vector3(p.pos.x + d.x * 4, .08, p.pos.z + d.z * 4), 12, 16, 0x4a5058);
      FX.debris(new THREE.Vector3(p.pos.x + d.x * 4, .1, p.pos.z + d.z * 4), 10, 14, 0x6a7078);
      try { sfx.redBoom(); } catch (e) {}
      var got = inFront(W2.reach, -.35);
      got.forEach(function (e) {
        /* a blunt weapon does not cut people in half — it throws them */
        ratioHit(e, W2.dmg, {
          dir: d, kb: 40, up: 15, reactDur: 1, stun: .9,
          size: 4, shake: 2.6, stop: .12, death: 'flat' });
      });
      if (!got.length) addShake(1.1);
    }
  }

  /* =====================================================================
     3 · COLLAPSE  瓦落瓦落
     The extension. The ratio stops being about one person and becomes
     about a length of road: ten divisions down the lane, and the seventh
     one gives way.
     ================================================================== */
  var W3 = { dmg: 34, len: 30, wide: 5.5 };

  function collapse(from, dir, ghost) {
    var floor = new THREE.Vector3(from.x, .1, from.z);
    /* the ten divisions, drawn one after another down the lane */
    for (var i = 1; i <= 10; i++) {
      (function (i) {
        later(i * 34, function () {
          var on = floor.clone().addScaledVector(dir, W3.len * (i / 10));
          var side = new THREE.Vector3(-dir.z, 0, dir.x);
          var lit = (i === 7);
          FX.cutLine(
            on.clone().addScaledVector(side, -(lit ? W3.wide : W3.wide * .6)),
            on.clone().addScaledVector(side, lit ? W3.wide : W3.wide * .6),
            lit ? RAT2 : RAT, lit ? .8 : .3, lit ? .7 : .35);
          if (!lit) FX.mote(on.clone().add(new THREE.Vector3(0, .6, 0)), RAT, 1.6, .2);
        });
      })(i);
    }
    /* and then the seventh gives, and takes the rest of the lane with it */
    later(420, function () {
      var on = floor.clone().addScaledVector(dir, W3.len * .7);
      FX.flash('#ffffff', .4, .22);
      FX.impact(on.clone().add(new THREE.Vector3(0, 1.4, 0)), RAT2, 6);
      FX.rings(on.clone(), RAT, 4, { maxR: W3.wide * 3.4, life: .7, gap: 32 });
      for (var k = 0; k < 9; k++) {
        var at2 = floor.clone().addScaledVector(dir, W3.len * (k + 1) / 10);
        FX.cracks(at2, 12, 15, 0x4a5058);
        FX.debris(at2, 9, 14, 0x6a7078);
        FX.dust(at2, 6, 0xc8ccd4, 11, 5);
      }
      FX.mangaLines(.7, .26);
      addShake(3);
      if (typeof hitstop === 'function') hitstop(.12);
      try { sfx.redBoom(); } catch (e) {}
      if (ghost) return;
      /* everybody standing anywhere on the lane, once */
      enemies.forEach(function (e) {
        if (!e || e.dead) return;
        var rel = e.pos.clone().sub(from);
        var along = rel.dot(dir);
        if (along < -1 || along > W3.len) return;
        var off = rel.clone().addScaledVector(dir, -along); off.y = 0;
        if (off.length() > W3.wide) return;
        ratioHit(e, W3.dmg, {
          dir: dir, kb: 14, up: 22, reactDur: 1, stun: .9,
          size: 4, shake: 1.4, stop: false, death: 'dice' });
      });
    });
  }
  NA.collapse = collapse;

  function castCollapse() {
    if (!ready('w3')) return;
    var a = start('w3', 1.4, 'w3', 'COLLAPSE', '瓦落瓦落');
    a.dir = aim();
    holdCleaver(1.6);
    try { sfx.raise(); } catch (e) {}
  }
  function stepCollapse(a, dt) {
    var p = player, d = a.dir;
    p.vel.x *= .7; p.vel.z *= .7;
    if (a.stage < 1 && a.t > .34) {
      a.stage = 1;
      /* he puts the blunt end into the road and the road does the rest */
      var at = p.pos.clone().addScaledVector(d, 2.4);
      FX.impact(at.clone().add(new THREE.Vector3(0, .6, 0)), RAT2, 3.4);
      FX.cracks(new THREE.Vector3(at.x, .08, at.z), 10, 12, 0x4a5058);
      addShake(1.4);
      collapse(p.pos.clone(), d.clone(), false);
    }
  }

  /* =====================================================================
     4 · THROWN BLADE  投擲
     It goes out end over end, it lands, and then he goes and gets it —
     which is the least heroic thing anybody on this roster does.
     ================================================================== */
  var W4 = { out: 24, back: 10, reach: 26, radius: 3.8, speed: 44 };

  function throwCleaver(from, dir, ghost) {
    var g = buildCleaver();
    g.position.copy(from);
    g.rotation.y = Math.atan2(dir.x, dir.z);
    scene.add(g);
    keep(g);
    var home = from.clone(), spin = 0, back = false, hit = [], t = 0;
    var last = from.clone();
    addFx({ t: 1e9, update: function (dt) {
      t += dt;
      if (typeof scene === 'undefined' || NA.props.indexOf(g) < 0) return false;
      last.copy(g.position);
      spin += dt * 15;
      g.rotation.x = spin;                                  // end over end
      if (!back) {
        g.position.addScaledVector(dir, W4.speed * dt);
        if (g.position.distanceTo(home) > W4.reach) { back = true; hit = []; }
      } else {
        var to = (player.pos.clone().add(new THREE.Vector3(0, 2.9, 0))).sub(g.position);
        g.position.addScaledVector(to.normalize(), W4.speed * 1.2 * dt);
      }
      if (Math.random() < dt * 20) FX.mote(g.position.clone(), RAT, 1.6, .18);
      if (!ghost) {
        var got = sweep(last, g.position, W4.radius, hit);
        for (var i = 0; i < got.length; i++) {
          var e = got[i];
          hit.push(e);
          ratioHit(e, back ? W4.back : W4.out, {
            dir: back ? dir.clone().negate() : dir,
            kb: back ? 12 : 26, up: back ? 8 : 12,
            react: back ? null : 'blow', stun: back ? .3 : .7,
            noFrameBonus: back, size: back ? 2.8 : 4,
            gore: back ? 7 : 14, shake: back ? 1.1 : 2.2,
            stop: back ? false : .1 });
        }
      }
      if (back && g.position.distanceTo(player.pos.clone().add(new THREE.Vector3(0, 2.9, 0))) < 2.2) {
        FX.mote(g.position.clone(), RAT2, 2, .2);
        drop(g);
        return false;
      }
      return t < 3.4;
    } });
  }
  NA.throwCleaver = throwCleaver;

  /* a thing moving forty units a second is not a point: test the segment */
  function sweep(from, to, radius, skip) {
    var out = [], seg = to.clone().sub(from), len2 = seg.lengthSq();
    for (var i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      if (!e || e.dead || (skip && skip.indexOf(e) >= 0)) continue;
      var c = e.pos.clone().add(new THREE.Vector3(0, 2.5, 0));
      var k = len2 > 1e-6 ? Math.max(0, Math.min(1, c.clone().sub(from).dot(seg) / len2)) : 0;
      if (from.clone().addScaledVector(seg, k).distanceTo(c) <= radius) out.push(e);
    }
    return out;
  }
  NA.sweep = sweep;

  function castThrow() {
    if (!ready('w4')) return;
    var a = start('w4', 1.15, 'w4', 'THROWN BLADE', '投擲');
    a.dir = aim();
    a.held = holdCleaver(.6);
    try { sfx.whoosh(); } catch (e) {}
  }
  function stepThrow(a, dt) {
    var p = player, d = a.dir;
    p.vel.x *= .78; p.vel.z *= .78;
    if (a.stage < 1 && a.t > .38) {
      a.stage = 1;
      if (a.held) { drop(a.held); a.held = null; }
      var from = p.pos.clone().addScaledVector(d, 1.8).add(new THREE.Vector3(0, 3.1, 0));
      var mark = nearest(26, .1);
      ratioMarks(mark && !mark.dead ? mark.pos.clone().add(new THREE.Vector3(0, 2.6, 0))
        : from.clone().addScaledVector(d, 10), 4.6, .35);
      FX.speedRing(from.clone(), RAT, 7, .2);
      try { sfx.redBoom(); } catch (e) {}
      throwCleaver(from, d.clone(), false);
    }
  }

  /* =====================================================================
     R · OVERTIME  時間外労働
     THE SPECIAL. The binding vow is that he works fixed hours. Past them
     the vow lapses and his output does not — so this is one swing, with
     everything he was holding back inside working hours behind it. Not a
     domain and not a cutscene: he checks the time, and then he swings.
     ================================================================== */
  var WR = { dmg: 58, reach: 15, wide: 11, hold: .8 };

  function castOvertime() {
    if (!ready('wr')) return;
    var a = start('wr', WR.hold + 1.05, 'wr', 'OVERTIME', '時間外労働');
    a.dir = aim();
    player.iframes = Math.max(player.iframes, .8);
    holdCleaver(WR.hold + 1.3);
    try { sfx.raise(); } catch (e) {}
  }
  function stepOvertime(a, dt) {
    var p = player, d = a.dir;
    p.vel.x *= .72; p.vel.z *= .72;
    var mid = p.pos.clone().add(new THREE.Vector3(0, 2.8, 0));
    if (a.stage < 1) {
      a.stage = 1;
      /* the vow lapsing: everything comes IN, and the light goes cold */
      FX.converge(mid.clone(), RAT, 30, 11, .8);
      FX.zoom(-4, .5);
      FX.mangaLines(.5, .6);
      FX.cracks(new THREE.Vector3(p.pos.x, .06, p.pos.z), 10, 13, 0x4a5058);
      a.aura = FX.aura(function () { return player.pos; }, STEEL);
      addShake(1.2);
    }
    if (a.stage === 1 && a.t < WR.hold) {
      if (Math.random() < dt * 26) FX.mote(mid.clone(), Math.random() < .5 ? RAT : RAT2, 8, .34);
      if (Math.random() < dt * 5) addShake(.5);
    }
    if (a.stage < 2 && a.t > WR.hold) {
      a.stage = 2;
      var at = p.pos.clone().addScaledVector(d, 4.4).add(new THREE.Vector3(0, 3.2, 0));
      /* the measurement, at the scale of the swing rather than the man */
      ratioMarks(at.clone(), 11, .7);
      swingArc(at, new THREE.Vector3(0, -1, 0), 26, RAT2);
      FX.cutLine(at.clone().add(new THREE.Vector3(0, 9, 0)),
        at.clone().add(new THREE.Vector3(0, -4, 0)), RAT2, 2.2, .5);
      FX.flash('#ffffff', .6, .3);
      FX.shockwave(at.clone(), RAT2, 2.4);
      var floor = new THREE.Vector3(p.pos.x + d.x * 5, .1, p.pos.z + d.z * 5);
      FX.rings(floor.clone(), RAT, 5, { maxR: 24, life: .8, gap: 30 });
      FX.cracks(floor.clone(), 26, 30, 0x4a5058);
      FX.debris(floor.clone(), 20, 26, 0x6a7078);
      FX.dust(floor.clone(), 16, 0xc8ccd4, 20, 6);
      FX.mangaLines(1, .32);
      addShake(3.8);
      if (typeof hitstop === 'function') hitstop(.2);
      try { sfx.redBoom(); } catch (e) {}
      var got = inFront(WR.reach, -.3);
      got.forEach(function (e) {
        ratioHit(e, WR.dmg, {
          dir: d, kb: 44, up: 20, reactDur: 1.2, stun: 1.1,
          flash: true, size: 7, gore: 24, shake: 3, stop: .16, death: 'sever' });
      });
      if (a.aura && a.aura.stop) { a.aura.stop(); a.aura = null; }
    }
    if (a.stage < 3 && a.t > WR.hold + .5) {
      a.stage = 3;
      if (a.aura && a.aura.stop) { a.aura.stop(); a.aura = null; }
    }
  }

  /* =====================================================================
     POSES
     He is economical. Nothing is wound up further than it needs to be,
     and the recovery is always back to standing straight — which for
     this character is most of the characterisation.
     ================================================================== */
  function poseNanami(r, a) {
    if (WCD[a.type] == null) return false;
    var t = a.t, k, out = E.out;
    rp(r);
    if (a.type === 'w1') {
      /* up over the shoulder, then straight down on the line */
      if (t < .6) {
        k = out(Math.min(1, t / .5));
        r.shoulderR.rotation.x = -2.4 * k;
        r.shoulderR.rotation.z = -.5 * k;
        r.elbowR.rotation.x = -.7 * k;
        r.shoulderL.rotation.x = -.5 * k;
        r.spine.rotation.y = -.34 * k;
        r.spine.rotation.x = -.14 * k;
      } else {
        k = out(Math.min(1, (t - .6) / .22));
        r.shoulderR.rotation.x = -2.4 + 3.1 * k;
        r.shoulderR.rotation.z = -.5 + .5 * k;
        r.elbowR.rotation.x = -.7 + .5 * k;
        r.shoulderL.rotation.x = -.5 + .9 * k;
        r.spine.rotation.y = -.34 + .34 * k;
        r.spine.rotation.x = -.14 + .5 * k;
        r.hipR.rotation.x = -.3 * k; r.kneeR.rotation.x = .4 * k;
      }
      return true;
    }
    if (a.type === 'w2') {
      /* wound across the body, then through it, and the hips go first */
      if (t < .52) {
        k = out(Math.min(1, t / .44));
        r.spine.rotation.y = .8 * k;
        r.shoulderR.rotation.x = -.9 * k; r.shoulderR.rotation.z = -1.1 * k;
        r.elbowR.rotation.x = -.9 * k;
        r.shoulderL.rotation.z = .5 * k;
        r.hips.rotation.y = .3 * k;
      } else {
        k = out(Math.min(1, (t - .52) / .24));
        r.spine.rotation.y = .8 - 1.7 * k;
        r.shoulderR.rotation.x = -.9 + .7 * k; r.shoulderR.rotation.z = -1.1 + 1.9 * k;
        r.elbowR.rotation.x = -.9 + .8 * k;
        r.shoulderL.rotation.z = .5 - 1 * k;
        r.hips.rotation.y = .3 - .6 * k;
        r.spine.rotation.x = .2 * k;
      }
      return true;
    }
    if (a.type === 'w3') {
      /* both hands on it, and it goes into the road rather than at anybody */
      k = out(Math.min(1, t / .32));
      var down = t > .32 ? out(Math.min(1, (t - .32) / .18)) : 0;
      r.shoulderR.rotation.x = -1.9 * k + 2.1 * down;
      r.shoulderL.rotation.x = -1.7 * k + 1.9 * down;
      r.shoulderL.rotation.z = .55 * k - .25 * down;
      r.shoulderR.rotation.z = -.3 * k;
      r.elbowR.rotation.x = -.5 * k;
      r.spine.rotation.x = -.2 * k + .55 * down;
      r.hips.position.y = r.hipsBaseY - .3 * down;
      r.hipL.rotation.x = .45 * down; r.kneeL.rotation.x = -.7 * down;
      r.hipR.rotation.x = .45 * down; r.kneeR.rotation.x = -.7 * down;
      return true;
    }
    if (a.type === 'w4') {
      /* over the shoulder and away, and then he watches it go */
      if (t < .4) {
        k = out(Math.min(1, t / .34));
        r.shoulderR.rotation.x = -2.5 * k;
        r.shoulderR.rotation.z = -.4 * k;
        r.elbowR.rotation.x = -1.2 * k;
        r.spine.rotation.y = -.4 * k;
      } else {
        k = out(Math.min(1, (t - .4) / .2));
        r.shoulderR.rotation.x = -2.5 + 2.1 * k;
        r.shoulderR.rotation.z = -.4 + .2 * k;
        r.elbowR.rotation.x = -1.2 + 1.1 * k;
        r.spine.rotation.y = -.4 + .5 * k;
        r.spine.rotation.x = .2 * k;
        r.shoulderL.rotation.x = -.4 * k;
      }
      return true;
    }
    if (a.type === 'wr') {
      if (t < WR.hold) {
        /* the hold: he settles, both hands on it, and does not shake much
           — the whole point of him is that he stays composed */
        k = t / WR.hold;
        r.spine.rotation.x = -.22 * k;
        r.neck.rotation.x = -.16 * k;
        r.hips.position.y = r.hipsBaseY - .26 * k;
        r.shoulderR.rotation.x = -2.5 * k; r.shoulderR.rotation.z = -.4 * k;
        r.shoulderL.rotation.x = -2.2 * k; r.shoulderL.rotation.z = .55 * k;
        r.elbowR.rotation.x = -.5 * k; r.elbowL.rotation.x = -.7 * k;
        r.hipL.rotation.x = .35 * k; r.kneeL.rotation.x = -.55 * k;
        r.hipR.rotation.x = -.35 * k; r.kneeR.rotation.x = .5 * k;
      } else {
        k = out(Math.min(1, (t - WR.hold) / .26));
        r.spine.rotation.x = -.22 + .85 * k;
        r.neck.rotation.x = -.16 + .5 * k;
        r.hips.position.y = r.hipsBaseY - .26 + .26 * k;
        r.shoulderR.rotation.x = -2.5 + 3.3 * k; r.shoulderR.rotation.z = -.4 + .4 * k;
        r.shoulderL.rotation.x = -2.2 + 3 * k; r.shoulderL.rotation.z = .55 - .55 * k;
        r.elbowR.rotation.x = -.5 + .4 * k; r.elbowL.rotation.x = -.7 + .6 * k;
        r.hipL.rotation.x = .35 - .6 * k; r.kneeL.rotation.x = -.55 + .75 * k;
        r.hipR.rotation.x = -.35 + .3 * k; r.kneeR.rotation.x = .5 - .4 * k;
      }
      return true;
    }
    return false;
  }

  /* ------------------------------------------------------- wiring it in
     stepAction is (a, dt) and the loop that calls it already advances
     a.t and clears the action. poseAction is (r, a), and returns truthy
     when it handled the pose. */
  var _stepAction = stepAction;
  stepAction = function (a, dt) {
    switch (a.type) {
      case 'w1': return stepRatio(a, dt);
      case 'w2': return stepCleave(a, dt);
      case 'w3': return stepCollapse(a, dt);
      case 'w4': return stepThrow(a, dt);
      case 'wr': return stepOvertime(a, dt);
    }
    return _stepAction(a, dt);
  };

  var _poseAction = poseAction;
  poseAction = function (r, a) {
    if (a && (r.__char || player.char) === 'nanami' && poseNanami(r, a)) return;
    return _poseAction(r, a);
  };

  window.addEventListener('keydown', function (e) {
    if (!started || player.char !== 'nanami') return;
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === 'Digit1') castRatio();
    else if (e.code === 'Digit2') castCleave();
    else if (e.code === 'Digit3') castCollapse();
    else if (e.code === 'Digit4') castThrow();
    else if (e.code === 'KeyR') castOvertime();
    else return;
    e.stopImmediatePropagation();
    e.preventDefault();
  }, true);

  /* he does not leave his weapon lying about, and neither does the swap */
  var _switchChar = switchChar;
  switchChar = function (id, quiet) {
    NA.props.slice().forEach(drop);
    return _switchChar(id, quiet);
  };

  /* =====================================================================
     ON EVERYBODY ELSE'S SCREEN
     The measurement is most of what a move of his looks like — a copy
     that skipped it would be a man hitting somebody with a stick.
     ================================================================== */
  function dirOf(yaw) { return new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)); }

  NA.remote = {
    w1: function (pos, yaw) {
      var d = dirOf(yaw);
      var on = pos.clone().addScaledVector(d, 7).add(new THREE.Vector3(0, 2.6, 0));
      ratioMarks(on, 5.2, .55);
      later(600, function () {
        var at = pos.clone().addScaledVector(d, 5).add(new THREE.Vector3(0, 3.4, 0));
        swingArc(at, new THREE.Vector3(0, -1, 0), 13, RAT2);
        FX.impact(at.clone(), RAT2, 4);
        FX.cracks(new THREE.Vector3(at.x, .08, at.z), 10, 13, 0x4a5058);
      });
    },
    w2: function (pos, yaw) {
      var d = dirOf(yaw), side = new THREE.Vector3(-d.z, 0, d.x);
      later(520, function () {
        var at = pos.clone().addScaledVector(d, 5.4).add(new THREE.Vector3(0, 2.9, 0));
        ratioMarks(at.clone(), 4.6, .3);
        swingArc(at, side, 16, RAT2);
        FX.cutLine(at.clone().addScaledVector(side, -8), at.clone().addScaledVector(side, 8), RAT2, .8, .3);
        FX.cracks(new THREE.Vector3(at.x, .08, at.z), 12, 16, 0x4a5058);
        FX.debris(new THREE.Vector3(at.x, .1, at.z), 10, 14, 0x6a7078);
      });
    },
    w3: function (pos, yaw) {
      var d = dirOf(yaw);
      later(340, function () {
        FX.impact(pos.clone().addScaledVector(d, 2.4).add(new THREE.Vector3(0, .6, 0)), RAT2, 3.4);
        collapse(pos.clone(), d, true);
      });
    },
    w4: function (pos, yaw) {
      var d = dirOf(yaw);
      later(380, function () {
        var from = pos.clone().addScaledVector(d, 1.8).add(new THREE.Vector3(0, 3.1, 0));
        ratioMarks(from.clone().addScaledVector(d, 10), 4.6, .35);
        FX.speedRing(from.clone(), RAT, 7, .2);
        throwCleaver(from, d, true);
      });
    },
    wr: function (pos, yaw) {
      var d = dirOf(yaw);
      var mid = pos.clone().add(new THREE.Vector3(0, 2.8, 0));
      FX.converge(mid.clone(), RAT, 30, 11, .8);
      FX.cracks(new THREE.Vector3(pos.x, .06, pos.z), 10, 13, 0x4a5058);
      later(WR.hold * 1000, function () {
        var at = pos.clone().addScaledVector(d, 4.4).add(new THREE.Vector3(0, 3.2, 0));
        ratioMarks(at.clone(), 11, .7);
        swingArc(at, new THREE.Vector3(0, -1, 0), 26, RAT2);
        FX.cutLine(at.clone().add(new THREE.Vector3(0, 9, 0)),
          at.clone().add(new THREE.Vector3(0, -4, 0)), RAT2, 2.2, .5);
        FX.flash('#ffffff', .45, .26);
        FX.shockwave(at.clone(), RAT2, 2.4);
        var floor = new THREE.Vector3(pos.x + d.x * 5, .1, pos.z + d.z * 5);
        FX.rings(floor.clone(), RAT, 5, { maxR: 24, life: .8, gap: 30 });
        FX.cracks(floor.clone(), 26, 30, 0x4a5058);
        FX.debris(floor.clone(), 20, 26, 0x6a7078);
        FX.dust(floor.clone(), 16, 0xc8ccd4, 20, 6);
      });
    }
  };

  /* the pieces the finishers borrow */
  NA.RAT = RAT; NA.RAT2 = RAT2; NA.STEEL = STEEL;
  NA.WRAP = WRAP; NA.SPOT = SPOT; NA.BLADE = BLADE;
})();
