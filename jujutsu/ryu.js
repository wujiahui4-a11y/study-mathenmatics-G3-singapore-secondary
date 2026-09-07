/* =======================================================================
   RYU ISHIGORI  —  CURSED ENERGY DISCHARGE  呪力放出

   A Culling Game player out of the Meiji era with, by common account, the
   highest raw cursed energy output of anybody in it. His innate technique
   is the plainest one in the series: he does not shape cursed energy into
   anything. He just lets an enormous amount of it out, in a direction.

   The direction is the joke. It comes out of his HAIR — a pompadour built
   in the shape of a cannon, with a bore in the front of it — which leaves
   both hands free the whole time he is firing. So this file never puts a
   weapon in his hands, and every shot in it is spawned at the bore and
   aimed by his head.

     1  CURSED ENERGY DISCHARGE  呪力放出 — one bolt, straight out
     2  FLARE SHOT               曳光弾 — the rapid burst, six tracers
     3  TRACKING SHOTS           追尾弾 — four that leave wide and come back in
     4  POINT BLANK              零距離放出 — no aiming at all: he walks into
                                 them and lets the whole discharge out
     R  GRANITE BLAST            花崗岩 — the special. He charges it, and
                                 the more he charges the wider it opens

   One to four are four ordinary discharges of about the same weight. The
   big one is on R — and it is a SKILL, not an ultimate: no cinema bars,
   no domain, no three seconds of invulnerability. He charges, he fires,
   it is over.

   The look, from the reference: black jacket with heavy cream fur at the
   neck, the cuffs and the hem, worn open over a bare chest, a pendant on
   a cord, a maroon belt with a yellow four-pointed star on the buckle,
   black trousers, black shoes. Blue eyes. The cursed energy is the pale
   blue-white it is drawn as, and it is the ONLY thing in the file that
   glows.
   ===================================================================== */
(function () {
  'use strict';
  if (typeof player === 'undefined' || typeof THREE === 'undefined') return;
  var FX = window.JJFX;
  if (!FX || typeof CHARS === 'undefined') return;
  var AN = window.JJANIM;
  var E = FX.ease;
  var TAU = Math.PI * 2;

  /* the energy: three steps of one blue, and white at the centre of it */
  var CE = 0x6fd0ff, CE2 = 0xdff4ff, CE_D = 0x2a7fd0, WHITE = 0xffffff;
  /* the body */
  var COAT = 0x15171f, COAT_D = 0x0b0d12, FUR = 0xf2efe6, FUR_D = 0xd6d1c2;
  var SKIN = 0xe8b98f, SKIN_D = 0xc9955f, HAIR = 0x171b25, HAIR_D = 0x0e1119;
  var BELT = 0x6d2b32, BUCKLE = 0xe8c24a, PANTS = 0x1a1c26, SHOE = 0x0c0d11;
  var CORD = 0x2a2d36, PEND = 0xcfd6df;

  var RY = window.JJRYU = { props: [] };

  var RCD = { r1: 6, r2: 7, r3: 8, r4: 8, rr: 17 };

  var RYU_CFG = {
    ryu: true, face: false,
    torso: COAT, pants: PANTS, shoes: SHOE, skin: SKIN
  };

  /* ---------------------------------------------------------------- rig
     The two things that have to read at fighting distance are the cannon
     in his hair and the fact that the coat is open. Everything else is
     trim on those two.
     ================================================================== */
  var _makeAnimeRig = makeAnimeRig;
  makeAnimeRig = function (cfg) {
    var r = _makeAnimeRig(cfg);
    if (!cfg || !cfg.ryu) return r;
    var head = r.head, spine = r.spine, hips = r.hips;

    function box(w, h, d, c, basic) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), basic
        ? new THREE.MeshBasicMaterial({ color: c, toneMapped: false })
        : new THREE.MeshStandardMaterial({ color: c, roughness: .78 }));
      m.castShadow = !basic;
      return m;
    }
    var i, s;

    /* THE POMPADOUR, WHICH IS A CANNON.
       A block swept up and forward off the forehead, tapering, with a
       dark bore straight through the front of it and a lit ring round
       the mouth. Everything he fires is spawned at `rig.bore`. */
    /* the mass, stepping up and BACK off the crown. It has to stay short:
       stacked straight up it stops being a haircut and becomes a chimney */
    var p0 = box(1.0, .40, 1.0, HAIR); p0.position.set(0, 1.04, -.02); head.add(p0);
    var p1 = box(.94, .32, .84, HAIR); p1.position.set(0, 1.34, -.12); p1.rotation.x = .13; head.add(p1);
    var p2 = box(.8, .24, .62, HAIR_D); p2.position.set(0, 1.55, -.28); p2.rotation.x = .24; head.add(p2);
    /* the lip hanging out over the brow, which is the pompadour itself */
    var lip = box(.92, .32, .36, HAIR); lip.position.set(0, 1.12, .44); lip.rotation.x = -.3; head.add(lip);
    /* and the barrel set into the FRONT of it, pointing where he is looking */
    var barrel = box(.58, .42, .46, HAIR_D); barrel.position.set(0, 1.02, .66); barrel.rotation.x = -.1; head.add(barrel);
    var rim = box(.48, .36, .1, 0x252b38); rim.position.set(0, 1.02, .87); head.add(rim);
    /* the bore: a hole, and a ring of energy sitting in the mouth of it */
    var bore = box(.3, .23, .08, 0x05070c, true); bore.position.set(0, 1.02, .92); head.add(bore);
    var lit = box(.19, .14, .05, CE, true); lit.position.set(0, 1.02, .96); head.add(lit);
    r.bore = new THREE.Object3D(); r.bore.position.set(0, 1.02, 1.08); head.add(r.bore);
    r.boreLit = lit;
    /* the undercut: tight and darker at the sides, which is what makes
       the top read as deliberately built rather than as a big head */
    for (s = -1; s <= 1; s += 2) {
      var sideH = box(.14, .58, .84, HAIR_D); sideH.position.set(.42 * s, .62, -.04); head.add(sideH);
      var burn = box(.1, .3, .14, HAIR); burn.position.set(.42 * s, .46, .34); head.add(burn);
    }
    var backH = box(.9, .56, .18, HAIR_D); backH.position.set(0, .7, -.44); head.add(backH);

    /* the face: blue eyes, thin brows, and a jaw with a corner on it */
    for (s = -1; s <= 1; s += 2) {
      var white = box(.17, .12, .05, 0xf4f6fa); white.position.set(.2 * s, .56, .45); head.add(white);
      var iris = box(.09, .1, .04, 0x4aa8e0, true); iris.position.set(.2 * s, .55, .47); head.add(iris);
      var brow = box(.2, .05, .05, HAIR); brow.position.set(.21 * s, .69, .46); brow.rotation.z = -.12 * s; head.add(brow);
    }
    var jaw = box(.78, .22, .3, SKIN_D); jaw.position.set(0, .12, .3); head.add(jaw);
    var mouth = box(.22, .04, .04, 0xa8674a); mouth.position.set(0, .26, .46); head.add(mouth);

    /* THE COAT, WORN OPEN.
       The default chest is already the coat colour, so the bare chest
       goes in FRONT of it and the coat is put back either side as two
       panels — that way the skin is between them rather than under. */
    var pec = box(.86, .42, .26, SKIN); pec.position.set(0, .86, .3); spine.add(pec);
    var split = box(.05, .4, .1, SKIN_D); split.position.set(0, .86, .43); spine.add(split);
    var torsoF = box(.8, .5, .24, SKIN); torsoF.position.set(0, .5, .3); spine.add(torsoF);
    /* the abs: two columns of three, which is what the reference leads on */
    for (i = 0; i < 3; i++) {
      for (s = -1; s <= 1; s += 2) {
        var ab = box(.28, .16, .1, SKIN); ab.position.set(.17 * s, .58 - i * .21, .42); spine.add(ab);
      }
    }
    var navel = box(.3, .22, .1, SKIN); navel.position.set(0, -.02, .4); spine.add(navel);
    /* and the coat back over the top of it, one panel each side */
    for (s = -1; s <= 1; s += 2) {
      var panel = box(.38, 1.18, .2, COAT); panel.position.set(.48 * s, .54, .34);
      panel.rotation.z = .09 * s; spine.add(panel);
      var edge = box(.08, 1.18, .22, COAT_D); edge.position.set(.31 * s, .54, .36);
      edge.rotation.z = .09 * s; spine.add(edge);
    }

    /* THE FUR. Neck, cuffs, hem — heavy, cream, and lumpy rather than
       smooth, because a smooth ring reads as plastic. */
    function furRing(parent, y, z, rad, hgt, n, w) {
      w = w || .3;
      for (var k = 0; k < n; k++) {
        var a = k / n * TAU;
        var tuft = box(w + Math.random() * w * .5, hgt + Math.random() * .12, w + Math.random() * w * .5,
          k % 2 ? FUR : FUR_D);
        tuft.position.set(Math.cos(a) * rad, y + (Math.random() - .5) * .09, z + Math.sin(a) * rad * .74);
        tuft.rotation.y = a;
        parent.add(tuft);
      }
    }
    furRing(spine, 1.12, 0, .62, .34, 10, .32);         // the collar
    furRing(spine, .2, 0, .56, .24, 9, .28);            // the hem of a cropped jacket
    var arms = [r.elbowL, r.elbowR];
    for (i = 0; i < arms.length; i++) furRing(arms[i], -.9, 0, .19, .2, 7, .17);

    /* the pendant, on a cord, which is the one bright thing on the body */
    var cordL = box(.05, .32, .05, CORD); cordL.position.set(-.13, .98, .5); cordL.rotation.z = .3; spine.add(cordL);
    var cordR = box(.05, .32, .05, CORD); cordR.position.set(.13, .98, .5); cordR.rotation.z = -.3; spine.add(cordR);
    var pend = box(.17, .21, .08, PEND); pend.position.set(0, .78, .52); spine.add(pend);

    /* the belt: maroon, with the four pointed star on the buckle */
    var belt = box(1.14, .24, .7, BELT); belt.position.set(0, .76, 0); hips.add(belt);
    var buck = box(.32, .3, .1, BUCKLE); buck.position.set(0, .76, .37); hips.add(buck);
    var starV = box(.09, .26, .05, 0x8a6a10); starV.position.set(0, .76, .43); hips.add(starV);
    var starH = box(.26, .09, .05, 0x8a6a10); starH.position.set(0, .76, .43); hips.add(starH);
    /* the strip of him between the jacket and the belt */
    var midriff = box(.72, .4, .5, SKIN); midriff.position.set(0, 1.0, .06); hips.add(midriff);

    return r;
  };

  CHARS.ryu = {
    name: 'RYU ISHIGORI', sub: 'CURSED ENERGY DISCHARGE',
    cfg: RYU_CFG, glow: '#6fd0ff',
    moves: [
      { key: 'LMB', lbl: 'Punch', cd: 'm1', max: .3 },
      { key: 'Q', lbl: 'Dash', cd: 'dash', max: 1 },
      { key: '1', lbl: 'Discharge', cd: 'r1', max: RCD.r1 },
      { key: '2', lbl: 'Flare Shot', cd: 'r2', max: RCD.r2 },
      { key: '3', lbl: 'Tracking Shots', cd: 'r3', max: RCD.r3 },
      { key: '4', lbl: 'Point Blank', cd: 'r4', max: RCD.r4 },
      { key: 'R', lbl: 'Granite Blast', cd: 'rr', max: RCD.rr }
    ]
  };
  try { CHARS.ryu.portrait = makePortrait(RYU_CFG); } catch (e) {}
  try { buildCharList(); } catch (e) {}

  cds.r1 = 0; cds.r2 = 0; cds.r3 = 0; cds.r4 = 0; cds.rr = 0;

  /* --------------------------------------------------------------- help */
  function ready(key) {
    return player.char === 'ryu' && !player.dead && !busy() && cds[key] <= 0 &&
      !player.react && !(window.JJNAOYA && window.JJNAOYA.busy());
  }
  function start(type, dur, key, name, sub) {
    cds[key] = RCD[key];
    player.action = { type: type, t: 0, dur: dur, stage: 0 };
    if (name) { try { showSplash(name, sub || '', '#6fd0ff'); } catch (e) {} }
    return player.action;
  }
  function aim() {
    return new THREE.Vector3(Math.sin(player.facing), 0, Math.cos(player.facing));
  }
  function rp(r) { resetPose(r); if (r.body) r.body.rotation.set(0, 0, 0); }
  function later(ms, fn) {
    setTimeout(function () { if (typeof scene !== 'undefined') fn(); }, ms);
  }
  /* props are either a group of our own or one of FX's orb handles —
     the handle already put itself in the scene and knows how to take
     itself back out, including the light it checked out */
  function keep(o) { RY.props.push(o); return o; }
  function drop(o) {
    if (!o) return;
    var i = RY.props.indexOf(o);
    if (i >= 0) RY.props.splice(i, 1);
    if (!o.isObject3D) { if (o.dispose) o.dispose(); return; }
    if (o.parent) o.parent.remove(o); else scene.remove(o);
    o.traverse(function (c) {
      if (c.isMesh) { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); }
    });
  }
  function nearest(range, cone) {
    var d = aim(), best = null, near = range || 34;
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
     THE BORE
     Where every shot in this file starts. It is on his head, so it moves
     when he is knocked about, and a shot that came out of his chest
     instead would throw away the only joke the character has.
     ================================================================== */
  var _w = new THREE.Vector3();
  function muzzleOf(rig, pos, dir) {
    if (rig && rig.bore) {
      rig.bore.getWorldPosition(_w);
      /* a bore below the waist means the rig has not been posed yet */
      if (_w.y > 1) return _w.clone();
    }
    return pos.clone().addScaledVector(dir, .6).add(new THREE.Vector3(0, 5.1, 0));
  }
  RY.muzzle = muzzleOf;

  /* WHERE IT IS POINTED.
     The bore is six units off the floor, so a shot fired level goes over
     the top of everybody. It is aimed at a chest instead, in three
     dimensions, and only falls back to level-and-slightly-down when
     there is nobody in front of him to aim at. */
  function aim3(rig, pos, flat) {
    var t = nearest(46, .2);
    var from = muzzleOf(rig, pos, flat);
    if (t && !t.dead) {
      var to = t.pos.clone().add(new THREE.Vector3(0, 2.5, 0)).sub(from);
      if (to.lengthSq() > .04) return to.normalize();
    }
    return flat.clone().add(new THREE.Vector3(0, -.13, 0)).normalize();
  }

  /* WHAT IT PASSED THROUGH.
     Not where it is now — where it has BEEN since the last frame. A
     fast shot tested as a point is a shot that misses on a slow frame. */
  function sweepHit(from, to, radius, skip) {
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
  RY.sweep = sweepHit;

  /* the mouth of it lighting up while he holds a charge */
  function boreGlow(rig, secs, size) {
    if (!rig || !rig.boreLit) return;
    var lit = rig.boreLit, t = 0;
    addFx({ t: 1e9, update: function (dt) {
      t += dt;
      if (typeof scene === 'undefined' || !lit.parent) return false;
      var k = Math.min(1, t / secs);
      lit.scale.setScalar(1 + k * (size || 2.6) + Math.sin(t * 30) * .15);
      if (t > secs + .35) { lit.scale.setScalar(1); return false; }
      return true;
    } });
  }

  /* the charge itself: an orb sitting in the bore, growing */
  function charge(rig, pos, dir, secs, r0, r1) {
    var h = FX.orb(CE, r0);
    keep(h);
    var t = 0, gone = false;
    addFx({ t: 1e9, update: function (dt) {
      t += dt;
      if (typeof scene === 'undefined' || gone) return false;
      if (RY.props.indexOf(h) < 0) { gone = true; return false; }   // swept by a swap
      var k = Math.min(1, t / secs);
      var at = muzzleOf(rig, pos, dir);
      h.set(at);
      h.step(dt, 1 + k * ((r1 / r0) - 1));
      if (Math.random() < dt * 40) FX.mote(at.clone(), CE, 3 + k * 4, .3);
      if (t > secs + .1) { gone = true; drop(h); return false; }
      return true;
    } });
    return h;
  }

  /* the recoil: this is where all the weight of the character is. He is
     not thrown by it, but the ground under him is */
  function recoil(at, dir, power) {
    var back = at.clone().addScaledVector(dir, -1.5);
    FX.speedRing(back, CE, 8 * power, .26);
    FX.dust(new THREE.Vector3(at.x, .1, at.z), 6 + power * 4, 0xc8ccd4, 8 * power, 3);
    FX.cracks(new THREE.Vector3(at.x, .08, at.z), 6 * power, 8 * power, 0x3c4149);
    for (var i = 0; i < 4; i++) FX.mote(back.clone(), i % 2 ? CE : CE2, 2.4 * power, .24);
    addShake(power);
  }

  /* the pale blue flash at the far end of anything that lands */
  function burst(at, size) {
    FX.impact(at.clone(), CE2, size);
    FX.rings(at.clone(), CE, 2, { maxR: size * 2.4, life: .4, ground: false, gap: 32 });
    for (var i = 0; i < 5; i++) FX.mote(at.clone(), i % 2 ? CE : CE2, size * .8, .26);
  }
  RY.burst = burst;

  /* =====================================================================
     1 · CURSED ENERGY DISCHARGE  呪力放出
     The whole technique, with nothing done to it: he points his head at
     somebody and lets one out.
     ================================================================== */
  var DIS = { dmg: 34, reach: 42, radius: 4.6, speed: 96 };

  function bolt(from, dir, ghost) {
    var g = new THREE.Group();
    var glow = FX.billboard(FX.T.star, CE, .9); glow.scale.setScalar(5); g.add(glow);
    var core = FX.billboard(FX.T.star, WHITE, 1); core.scale.setScalar(2.2); g.add(core);
    scene.add(g);
    g.position.copy(from);
    var travelled = 0, hit = [], last = from.clone();
    addFx({ t: 1e9, update: function (dt) {
      if (typeof scene === 'undefined') return false;
      var step = DIS.speed * dt;
      last.copy(g.position);
      g.position.addScaledVector(dir, step);
      travelled += step;
      /* the tail is drawn between where it was and where it is, so a
         slow frame stretches the bolt instead of teleporting it */
      FX.faceCam(glow, 0); FX.faceCam(core, 0);
      FX.cutLine(last.clone(), g.position.clone(), CE2, .9, .16);
      FX.cutLine(last.clone(), g.position.clone(), CE, 1.8, .12);
      if (Math.random() < dt * 60) FX.mote(g.position.clone(), CE, 2, .2);
      if (!ghost) {
        var got = sweepHit(last, g.position, DIS.radius, hit);
        for (var i = 0; i < got.length; i++) {
          var e = got[i];
          if (!e || e.dead || hit.indexOf(e) >= 0) continue;
          hit.push(e);
          var kb = dir.clone().multiplyScalar(28); kb.y = 12;
          e.damage(DIS.dmg, kb, {
            react: 'blow', reactDur: .8, spark: CE2, stun: .7,
            bleed: true, death: 'gone' });
          burst(e.pos.clone().add(new THREE.Vector3(0, 2.5, 0)), 4);
          FX.blood(e.pos.clone().add(new THREE.Vector3(0, 2.5, 0)), dir, 14, 2);
          addShake(1.8);
          if (typeof hitstop === 'function') hitstop(.08);
        }
        if (hit.length) { land(g, g.position.clone()); return false; }
      }
      if (travelled > DIS.reach) { land(g, g.position.clone()); return false; }
      return true;
    } });

    function land(grp, at) {
      burst(at, 5.5);
      FX.cracks(new THREE.Vector3(at.x, .08, at.z), 10, 14, 0x3c4149);
      FX.debris(new THREE.Vector3(at.x, .1, at.z), 8, 12, 0x6a7078);
      FX.dust(new THREE.Vector3(at.x, 0, at.z), 8, 0xc8ccd4, 10, 4);
      addShake(1.4);
      scene.remove(grp);
      grp.traverse(function (o) { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
    }
  }
  RY.bolt = bolt;

  function castDischarge() {
    if (!ready('r1')) return;
    var a = start('r1', 1.1, 'r1', 'CURSED ENERGY DISCHARGE', '呪力放出');
    a.dir = aim();
    boreGlow(player.rig, .42, 2.4);
    try { sfx.raise(); } catch (e) {}
  }
  function stepDischarge(a, dt) {
    var p = player, d = a.dir;
    p.vel.x *= .74; p.vel.z *= .74;
    if (a.stage < 1 && a.t > .12) {
      a.stage = 1;
      a.orb = charge(p.rig, p.pos, d, .32, .8, 2.2);
      FX.converge(muzzleOf(p.rig, p.pos, d), CE, 14, 6, .34);
    }
    if (a.stage < 2 && a.t > .48) {
      a.stage = 2;
      var at = muzzleOf(p.rig, p.pos, d);
      FX.flash('#dff4ff', .3, .16);
      FX.speedRing(at.clone(), CE2, 9, .22);
      recoil(p.pos.clone(), d, 1.6);
      try { sfx.redBoom(); } catch (e) {}
      bolt(at, aim3(p.rig, p.pos, d), false);
    }
  }

  /* =====================================================================
     2 · FLARE SHOT  曳光弾
     The same technique fired badly on purpose: six small ones, fast, in
     a shallow fan, so it covers a lane instead of a line.
     ================================================================== */
  var FLR = { dmg: 6, n: 6, reach: 34, radius: 3.6, speed: 82, spread: .11 };

  function flare(from, dir, ghost) {
    var m = FX.billboard(FX.T.star, CE2, 1);
    m.scale.setScalar(1.6);
    m.position.copy(from);
    scene.add(m);
    var travelled = 0, done = false, last = from.clone();
    addFx({ t: 1e9, update: function (dt) {
      if (typeof scene === 'undefined') return false;
      var step = FLR.speed * dt;
      last.copy(m.position);
      m.position.addScaledVector(dir, step);
      travelled += step;
      FX.cutLine(last.clone(), m.position.clone(), CE, .55, .13);
      if (!ghost && !done) {
        var got = sweepHit(last, m.position, FLR.radius);
        if (got.length) {
          done = true;
          for (var i = 0; i < got.length; i++) {
            var e = got[i];
            if (!e || e.dead) continue;
            var kb = dir.clone().multiplyScalar(6); kb.y = 3;
            e.damage(FLR.dmg, kb, {
              react: null, spark: CE2, noFrameBonus: true, stun: .12,
              bleed: true, death: 'burn' });
            FX.blood(e.pos.clone().add(new THREE.Vector3(0, 2.4, 0)), dir, 4, 1.2);
          }
          burst(m.position.clone(), 2.4);
          addShake(.7);
        }
      }
      if (done || travelled > FLR.reach) {
        if (!done) burst(m.position.clone(), 2);
        scene.remove(m); m.material.dispose();
        return false;
      }
      return true;
    } });
  }
  RY.flare = flare;

  function castFlare() {
    if (!ready('r2')) return;
    var a = start('r2', 1.3, 'r2', 'FLARE SHOT', '曳光弾');
    a.dir = aim();
    a.n = 0;
    boreGlow(player.rig, .9, 1.6);
    try { sfx.whoosh(); } catch (e) {}
  }
  function stepFlare(a, dt) {
    var p = player, d = a.dir;
    p.vel.x *= .8; p.vel.z *= .8;
    if (a.t < .26) return;
    /* six of them, one every ninety milliseconds, alternating sides */
    if (a.n < FLR.n && a.t > .26 + a.n * .09) {
      var i = a.n++;
      var at = muzzleOf(p.rig, p.pos, d);
      var yaw = (i % 2 ? 1 : -1) * FLR.spread * (1 - Math.abs(i - 2.5) / 4);
      var to = aim3(p.rig, p.pos, d);
      var dir = new THREE.Vector3(
        to.x * Math.cos(yaw) - to.z * Math.sin(yaw), to.y + (Math.random() - .5) * .05,
        to.x * Math.sin(yaw) + to.z * Math.cos(yaw)).normalize();
      FX.speedRing(at.clone(), CE, 5, .16);
      FX.mote(at.clone(), CE2, 2, .18);
      recoil(p.pos.clone(), d, .5);
      if (i === 0) { try { sfx.redBoom(); } catch (e) {} }
      flare(at, dir, false);
    }
  }

  /* =====================================================================
     3 · TRACKING SHOTS  追尾弾
     Four that leave in the wrong direction entirely, and then come back.
     The turn is the whole move: fired straight they would be move 2.
     ================================================================== */
  var TRK = { dmg: 9, n: 4, radius: 3.8, speed: 40, turn: 5.6, life: 2.4 };

  function tracker(from, out, target, ghost) {
    var m = FX.billboard(FX.T.star, CE, 1);
    m.scale.setScalar(2.2);
    m.position.copy(from);
    scene.add(m);
    var v = out.clone().multiplyScalar(TRK.speed);
    var t = 0, done = false, last = from.clone();
    addFx({ t: 1e9, update: function (dt) {
      t += dt;
      if (typeof scene === 'undefined') return false;
      /* it steers towards wherever they are NOW, not where they were */
      var to = (target && !target.dead ? target.pos.clone().add(new THREE.Vector3(0, 2.4, 0))
        : from.clone().addScaledVector(out, 40));
      var want = to.sub(m.position);
      if (want.lengthSq() > .01) {
        want.normalize().multiplyScalar(TRK.speed);
        v.lerp(want, Math.min(1, dt * TRK.turn));
        v.setLength(TRK.speed);
      }
      last.copy(m.position);
      m.position.addScaledVector(v, dt);
      FX.cutLine(last.clone(), m.position.clone(), CE, .7, .18);
      if (Math.random() < dt * 26) FX.mote(m.position.clone(), CE2, 1.6, .2);
      if (!ghost && !done) {
        var got = sweepHit(last, m.position, TRK.radius);
        if (got.length) {
          done = true;
          for (var i = 0; i < got.length; i++) {
            var e = got[i];
            if (!e || e.dead) continue;
            var kb = v.clone().normalize().multiplyScalar(11); kb.y = 7;
            e.damage(TRK.dmg, kb, {
              react: null, spark: CE2, noFrameBonus: true, stun: .18,
              bleed: true, death: 'dice' });
            FX.blood(e.pos.clone().add(new THREE.Vector3(0, 2.4, 0)), v.clone().normalize(), 6, 1.6);
          }
          burst(m.position.clone(), 3.2);
          addShake(1);
          if (typeof hitstop === 'function') hitstop(.05);
        }
      }
      if (done || t > TRK.life) {
        if (!done) burst(m.position.clone(), 2.4);
        scene.remove(m); m.material.dispose();
        return false;
      }
      return true;
    } });
  }
  RY.tracker = tracker;

  function castTrack() {
    if (!ready('r3')) return;
    var a = start('r3', 1.5, 'r3', 'TRACKING SHOTS', '追尾弾');
    a.dir = aim();
    a.target = nearest(40, -.4);
    boreGlow(player.rig, .6, 2);
    try { sfx.raise(); } catch (e) {}
  }
  function stepTrack(a, dt) {
    var p = player, d = a.dir;
    p.vel.x *= .8; p.vel.z *= .8;
    if (a.stage < 1 && a.t > .1) {
      a.stage = 1;
      a.orb = charge(p.rig, p.pos, d, .42, .7, 1.9);
      FX.converge(muzzleOf(p.rig, p.pos, d), CE, 12, 5, .38);
    }
    if (a.stage < 2 && a.t > .56) {
      a.stage = 2;
      var at = muzzleOf(p.rig, p.pos, d);
      var side = new THREE.Vector3(-d.z, 0, d.x);
      FX.flash('#dff4ff', .26, .16);
      FX.speedRing(at.clone(), CE2, 8, .2);
      recoil(p.pos.clone(), d, 1.1);
      try { sfx.redBoom(); } catch (e) {}
      /* out to the corners first — up-left, up-right, wide-left, wide-right */
      for (var i = 0; i < TRK.n; i++) {
        var s = i % 2 ? 1 : -1;
        var up = i < 2 ? .9 : .25;
        var out = d.clone().multiplyScalar(.35)
          .addScaledVector(side, s * (i < 2 ? .7 : 1.1))
          .add(new THREE.Vector3(0, up, 0)).normalize();
        tracker(at.clone(), out, a.target, false);
      }
    }
  }

  /* =====================================================================
     4 · POINT BLANK  零距離放出
     He does not aim this one anywhere. He plants, and every bit of it
     comes out of him at once, in every direction, at zero range.
     ================================================================== */
  var PB = { dmg: 34, radius: 9.5, step: 26 };

  function castPoint() {
    if (!ready('r4')) return;
    var a = start('r4', 1.2, 'r4', 'POINT BLANK', '零距離放出');
    a.dir = aim();
    a.hit = [];
    player.iframes = Math.max(player.iframes, .55);
    boreGlow(player.rig, .5, 3);
    try { sfx.raise(); } catch (e) {}
  }
  function stepPoint(a, dt) {
    var p = player, d = a.dir;
    /* he walks into them for it, which is the only way it reaches */
    if (a.t < .4) { p.vel.x = d.x * PB.step; p.vel.z = d.z * PB.step; }
    else { p.vel.x *= .6; p.vel.z *= .6; }
    var mid = p.pos.clone().add(new THREE.Vector3(0, 2.6, 0));
    if (a.stage < 1) {
      a.stage = 1;
      FX.converge(mid.clone(), CE, 22, 8, .45);
      a.aura = FX.aura(function () {
        return player.pos.clone().add(new THREE.Vector3(0, 2.4, 0));
      }, CE, { r: 3.4 });
    }
    if (a.stage < 2 && a.t > .46) {
      a.stage = 2;
      /* everything at once, and the ground goes with it */
      FX.flash('#dff4ff', .55, .28);
      FX.shockwave(mid.clone(), CE2, 2.2);
      FX.rings(new THREE.Vector3(p.pos.x, .12, p.pos.z), CE, 4,
        { maxR: PB.radius * 2, life: .7, gap: 32 });
      FX.cracks(new THREE.Vector3(p.pos.x, .08, p.pos.z), 20, 24, 0x3c4149);
      FX.debris(new THREE.Vector3(p.pos.x, .1, p.pos.z), 16, 20, 0x6a7078);
      FX.dust(new THREE.Vector3(p.pos.x, 0, p.pos.z), 14, 0xc8ccd4, 18, 5);
      FX.mangaLines(.7, .26);
      for (var i = 0; i < 14; i++) {
        var ang = i / 14 * TAU;
        var out = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang));
        FX.cutLine(mid.clone(), mid.clone().addScaledVector(out, PB.radius * 1.2), CE, .9, .3);
      }
      addShake(2.6);
      if (typeof hitstop === 'function') hitstop(.12);
      try { sfx.redBoom(); } catch (e) {}
      enemies.forEach(function (e) {
        if (!e || e.dead || a.hit.indexOf(e) >= 0) return;
        if (e.pos.distanceTo(p.pos) > PB.radius) return;
        a.hit.push(e);
        var kb = e.pos.clone().sub(p.pos).setY(0);
        if (kb.lengthSq() < .01) kb.copy(d);
        kb.normalize().multiplyScalar(40); kb.y = 20;
        e.damage(PB.dmg, kb, {
          react: 'blow', reactDur: 1, spark: CE2, stun: .9,
          bleed: true, death: 'flat' });
        burst(e.pos.clone().add(new THREE.Vector3(0, 2.5, 0)), 4.4);
        FX.blood(e.pos.clone().add(new THREE.Vector3(0, 2.5, 0)), kb.clone().normalize(), 16, 2.2);
      });
    }
    if (a.stage < 3 && a.t > .8) {
      a.stage = 3;
      if (a.aura && a.aura.stop) a.aura.stop();
      a.aura = null;
    }
  }

  /* =====================================================================
     R · GRANITE BLAST  花崗岩
     THE SPECIAL. Not a domain and not a cutscene — he holds the charge,
     and the longer it is held the wider the thing that comes out. There
     is a real hold here: the beam opens over half a second and the recoil
     shoves him backwards down his own lane.
     ================================================================== */
  var GB = { dmg: 58, len: 74, wide: 13, hold: .95, life: .7 };

  function granite(from, dir, ghost) {
    FX.beam(from.clone(), dir.clone(), GB.len, CE, { radius: GB.wide * .5, life: GB.life });
    FX.beam(from.clone(), dir.clone(), GB.len, CE2, { radius: GB.wide * .22, life: GB.life });
    var end = from.clone().addScaledVector(dir, GB.len);
    var floor = new THREE.Vector3(from.x, .08, from.z);
    /* the trench it leaves down the lane it was fired along */
    for (var i = 1; i < 8; i++) {
      var at = floor.clone().addScaledVector(dir, i * (GB.len / 8));
      FX.cracks(at, 8 + i, 10 + i * 2, 0x3c4149);
      if (i % 2) FX.debris(at, 8, 14, 0x6a7078);
      FX.dust(at, 6, 0xc8ccd4, 12, 5);
    }
    burst(end, 9);
    FX.rings(new THREE.Vector3(end.x, .12, end.z), CE, 5, { maxR: 26, life: .9, gap: 30 });
    FX.flash('#dff4ff', .6, .32);
    FX.mangaLines(.9, .3);
    addShake(3.4);
    if (typeof hitstop === 'function') hitstop(.16);
    if (ghost) return;
    /* everything in the lane, once */
    var got = enemiesNear(from.clone().addScaledVector(dir, GB.len * .5),
      GB.len * .5 + GB.wide, dir, -1);
    got.forEach(function (e) {
      if (!e || e.dead) return;
      var rel = e.pos.clone().sub(from);
      var along = rel.dot(dir);
      if (along < -2 || along > GB.len) return;
      var off = rel.clone().addScaledVector(dir, -along); off.y = 0;
      if (off.length() > GB.wide) return;
      var kb = dir.clone().multiplyScalar(46); kb.y = 20;
      e.damage(GB.dmg, kb, {
        react: 'blow', reactDur: 1.2, spark: CE2, stun: 1.1,
        bleed: true, death: 'gone' });
      burst(e.pos.clone().add(new THREE.Vector3(0, 2.6, 0)), 6);
      FX.blood(e.pos.clone().add(new THREE.Vector3(0, 2.6, 0)), dir, 22, 2.6);
    });
  }
  RY.granite = granite;

  function castGranite() {
    if (!ready('rr')) return;
    var a = start('rr', GB.hold + 1.1, 'rr', 'GRANITE BLAST', '花崗岩');
    a.dir = aim();
    player.iframes = Math.max(player.iframes, .8);
    boreGlow(player.rig, GB.hold, 4.5);
    try { sfx.raise(); } catch (e) {}
  }
  function stepGranite(a, dt) {
    var p = player, d = a.dir;
    p.vel.x *= .7; p.vel.z *= .7;
    if (a.stage < 1) {
      a.stage = 1;
      a.orb = charge(p.rig, p.pos, d, GB.hold, 1.2, 5.2);
      FX.converge(muzzleOf(p.rig, p.pos, d), CE, 34, 12, .8);
      FX.zoom(-4, .5);
      /* he braces for it: the floor under his back foot goes first */
      FX.cracks(new THREE.Vector3(p.pos.x, .06, p.pos.z), 10, 13, 0x3c4149);
      addShake(1);
    }
    /* the hold. Motes keep arriving and the ground keeps giving */
    if (a.stage === 1 && a.t < GB.hold) {
      if (Math.random() < dt * 30) {
        FX.mote(muzzleOf(p.rig, p.pos, d), Math.random() < .5 ? CE : CE2, 7, .34);
      }
      if (Math.random() < dt * 5) addShake(.5);
    }
    if (a.stage < 2 && a.t > GB.hold) {
      a.stage = 2;
      var at = muzzleOf(p.rig, p.pos, d);
      try { sfx.redBoom(); } catch (e) {}
      granite(at, d.clone(), false);
      /* and it moves HIM: the recoil on the biggest one he has is the
         only time anything of his shifts him off his own mark */
      p.vel.x -= d.x * 26; p.vel.z -= d.z * 26;
      recoil(p.pos.clone(), d, 2.6);
    }
  }

  /* =====================================================================
     POSES
     His hands are free the entire time — that is the point of firing out
     of your hair — so the pose language is the head and the stance, and
     the arms only ever brace.
     ================================================================== */
  function poseRyu(r, a) {
    if (RCD[a.type] == null) return false;
    var t = a.t, k;
    rp(r);
    if (a.type === 'r1') {
      /* head back, then snapped down the lane on the shot */
      k = t < .48 ? t / .48 : 1;
      r.neck.rotation.x = -.34 * k + (t > .48 ? Math.min(.7, (t - .48) * 6) : 0);
      r.spine.rotation.x = -.16 * k + (t > .48 ? Math.min(.34, (t - .48) * 3) : 0);
      r.shoulderL.rotation.z = .5 + .3 * k; r.shoulderR.rotation.z = -.5 - .3 * k;
      r.shoulderL.rotation.x = .3; r.shoulderR.rotation.x = .3;
      r.hipL.rotation.x = .2; r.hipR.rotation.x = -.3;
      r.kneeR.rotation.x = .4;
      return true;
    }
    if (a.type === 'r2') {
      /* he sweeps it: the head turns across the lane while it fires */
      k = Math.min(1, Math.max(0, (t - .26) / .55));
      r.neck.rotation.y = -.34 + k * .68;
      r.neck.rotation.x = -.2 + Math.sin(t * 46) * .05;
      r.spine.rotation.y = (-.2 + k * .4) * .5;
      r.shoulderL.rotation.z = .62; r.shoulderR.rotation.z = -.62;
      r.shoulderL.rotation.x = .42; r.shoulderR.rotation.x = .42;
      r.hipL.rotation.x = .16; r.hipR.rotation.x = -.16;
      return true;
    }
    if (a.type === 'r3') {
      k = t < .56 ? t / .56 : 1;
      r.neck.rotation.x = -.46 * k;                  // right up, they go over him
      r.spine.rotation.x = -.24 * k;
      r.shoulderL.rotation.x = -.3 * k; r.shoulderR.rotation.x = -.3 * k;
      r.shoulderL.rotation.z = .72 * k; r.shoulderR.rotation.z = -.72 * k;
      r.hipL.rotation.x = .1; r.hipR.rotation.x = -.1;
      return true;
    }
    if (a.type === 'r4') {
      /* into them, and then everything opens at once */
      if (t < .46) {
        k = t / .46;
        r.spine.rotation.x = .34 * k;
        r.shoulderL.rotation.x = -.5 * k; r.shoulderR.rotation.x = -.5 * k;
        r.shoulderL.rotation.z = .3; r.shoulderR.rotation.z = -.3;
        r.hipL.rotation.x = -.3 * k; r.hipR.rotation.x = .3 * k;
      } else {
        k = Math.min(1, (t - .46) / .2);
        r.spine.rotation.x = .34 - .58 * k;
        r.neck.rotation.x = -.4 * k;
        r.shoulderL.rotation.x = -.5 + 1.1 * k; r.shoulderR.rotation.x = -.5 + 1.1 * k;
        r.shoulderL.rotation.z = .3 + 1.1 * k; r.shoulderR.rotation.z = -.3 - 1.1 * k;
        r.hips.position.y = r.hipsBaseY + .3 * Math.sin(k * Math.PI);
      }
      return true;
    }
    if (a.type === 'rr') {
      if (t < GB.hold) {
        /* the hold: he sinks into it and shakes */
        k = t / GB.hold;
        var sh = Math.sin(t * 52) * .03 * k;
        r.spine.rotation.x = -.3 * k + sh;
        r.neck.rotation.x = -.5 * k;
        r.hips.position.y = r.hipsBaseY - .34 * k;
        r.shoulderL.rotation.z = .5 + .5 * k; r.shoulderR.rotation.z = -.5 - .5 * k;
        r.shoulderL.rotation.x = .5 * k + sh; r.shoulderR.rotation.x = .5 * k - sh;
        r.hipL.rotation.x = .4 * k; r.kneeL.rotation.x = -.6 * k;
        r.hipR.rotation.x = -.5 * k; r.kneeR.rotation.x = .7 * k;
      } else {
        /* and the release throws his head and his whole back into it */
        k = Math.min(1, (t - GB.hold) / .26);
        r.spine.rotation.x = -.3 + .8 * k;
        r.neck.rotation.x = -.5 + 1.1 * k;
        r.hips.position.y = r.hipsBaseY - .34 + .34 * k;
        r.shoulderL.rotation.z = 1 - .3 * k; r.shoulderR.rotation.z = -1 + .3 * k;
        r.shoulderL.rotation.x = .5 - 1.2 * k; r.shoulderR.rotation.x = .5 - 1.2 * k;
        r.hipL.rotation.x = .4 - .5 * k; r.kneeL.rotation.x = -.6 + .6 * k;
        r.hipR.rotation.x = -.5 + .3 * k; r.kneeR.rotation.x = .7 - .5 * k;
      }
      return true;
    }
    return false;
  }

  /* ------------------------------------------------------- wiring it in
     stepAction is (a, dt) and the loop that calls it already advances
     a.t and clears the action at the end — a wrapper that did either
     itself would double the clock. poseAction is (r, a), with no dt,
     and the convention is to return truthy when it handled the pose. */
  var _stepAction = stepAction;
  stepAction = function (a, dt) {
    switch (a.type) {
      case 'r1': return stepDischarge(a, dt);
      case 'r2': return stepFlare(a, dt);
      case 'r3': return stepTrack(a, dt);
      case 'r4': return stepPoint(a, dt);
      case 'rr': return stepGranite(a, dt);
    }
    return _stepAction(a, dt);
  };

  var _poseAction = poseAction;
  poseAction = function (r, a) {
    if (a && (r.__char || player.char) === 'ryu' && poseRyu(r, a)) return;
    return _poseAction(r, a);
  };

  window.addEventListener('keydown', function (e) {
    if (!started || player.char !== 'ryu') return;
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === 'Digit1') castDischarge();
    else if (e.code === 'Digit2') castFlare();
    else if (e.code === 'Digit3') castTrack();
    else if (e.code === 'Digit4') castPoint();
    else if (e.code === 'KeyR') castGranite();
    else return;
    e.stopImmediatePropagation();
    e.preventDefault();
  }, true);

  /* a charge he was holding when he stopped being the fighter is a
     light and a sphere nobody owns any more */
  var _switchChar = switchChar;
  switchChar = function (id, quiet) {
    RY.props.slice().forEach(drop);
    return _switchChar(id, quiet);
  };

  /* =====================================================================
     ON EVERYBODY ELSE'S SCREEN
     Every one of these is a shot leaving a point on his head, so the copy
     has to start at the same place: the watcher is handed his rig, and
     the bore is read off it exactly as it is locally.
     ================================================================== */
  function dirOf(yaw) { return new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)); }

  RY.remote = {
    r1: function (pos, yaw, f) {
      var d = dirOf(yaw), rig = (f && f.e && f.e.rig) ? f.e.rig : null;
      var at = muzzleOf(rig, pos, d);
      FX.converge(at.clone(), CE, 14, 6, .34);
      FX.speedRing(at.clone(), CE2, 9, .22);
      recoil(pos.clone(), d, 1.2);
      later(340, function () {
        bolt(muzzleOf(rig, pos, d),
          d.clone().add(new THREE.Vector3(0, -.13, 0)).normalize(), true);
      });
    },
    r2: function (pos, yaw, f) {
      var d = dirOf(yaw), rig = (f && f.e && f.e.rig) ? f.e.rig : null;
      for (var i = 0; i < FLR.n; i++) {
        (function (i) {
          later(260 + i * 90, function () {
            var at = muzzleOf(rig, pos, d);
            var s = i % 2 ? 1 : -1;
            var yw = s * FLR.spread * (1 - Math.abs(i - 2.5) / 4);
            var dir = new THREE.Vector3(
              d.x * Math.cos(yw) - d.z * Math.sin(yw), (Math.random() - .5) * .06,
              d.x * Math.sin(yw) + d.z * Math.cos(yw)).normalize();
            FX.speedRing(at.clone(), CE, 5, .16);
            recoil(pos.clone(), d, .4);
            flare(at, dir, true);
          });
        })(i);
      }
    },
    r3: function (pos, yaw, f) {
      var d = dirOf(yaw), rig = (f && f.e && f.e.rig) ? f.e.rig : null;
      var side = new THREE.Vector3(-d.z, 0, d.x);
      FX.converge(muzzleOf(rig, pos, d).clone(), CE, 12, 5, .38);
      later(560, function () {
        var at = muzzleOf(rig, pos, d);
        FX.speedRing(at.clone(), CE2, 8, .2);
        recoil(pos.clone(), d, .9);
        /* the ghosts have no target to chase: they fly the same arc out
           and fade, which is what the shots look like from a distance */
        for (var i = 0; i < TRK.n; i++) {
          var s = i % 2 ? 1 : -1;
          var up = i < 2 ? .9 : .25;
          var out = d.clone().multiplyScalar(.35)
            .addScaledVector(side, s * (i < 2 ? .7 : 1.1))
            .add(new THREE.Vector3(0, up, 0)).normalize();
          tracker(at.clone(), out, null, true);
        }
      });
    },
    r4: function (pos, yaw) {
      var d = dirOf(yaw);
      var mid = pos.clone().add(new THREE.Vector3(0, 2.6, 0));
      FX.converge(mid.clone(), CE, 22, 8, .45);
      later(460, function () {
        FX.flash('#dff4ff', .4, .24);
        FX.shockwave(mid.clone(), CE2, 2.2);
        FX.rings(new THREE.Vector3(pos.x, .12, pos.z), CE, 4,
          { maxR: PB.radius * 2, life: .7, gap: 32 });
        FX.cracks(new THREE.Vector3(pos.x, .08, pos.z), 20, 24, 0x3c4149);
        FX.debris(new THREE.Vector3(pos.x, .1, pos.z), 16, 20, 0x6a7078);
        FX.dust(new THREE.Vector3(pos.x, 0, pos.z), 14, 0xc8ccd4, 18, 5);
        for (var i = 0; i < 14; i++) {
          var ang = i / 14 * TAU;
          var out = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang));
          FX.cutLine(mid.clone(), mid.clone().addScaledVector(out, PB.radius * 1.2), CE, .9, .3);
        }
      });
    },
    rr: function (pos, yaw, f) {
      var d = dirOf(yaw), rig = (f && f.e && f.e.rig) ? f.e.rig : null;
      var at = muzzleOf(rig, pos, d);
      FX.converge(at.clone(), CE, 34, 12, .8);
      FX.cracks(new THREE.Vector3(pos.x, .06, pos.z), 10, 13, 0x3c4149);
      var orb = FX.orb(CE, 1.2);
      keep(orb);
      var t = 0;
      addFx({ t: 1e9, update: function (dd) {
        t += dd;
        if (typeof scene === 'undefined') return false;
        if (RY.props.indexOf(orb) < 0) return false;
        orb.set(muzzleOf(rig, pos, d));
        orb.step(dd, 1 + (t / GB.hold) * 3.4);
        if (t > GB.hold) {
          drop(orb);
          granite(muzzleOf(rig, pos, d), d.clone(), true);
          recoil(pos.clone(), d, 2.2);
          return false;
        }
        return true;
      } });
    }
  };

  /* the pieces the finishers borrow */
  RY.CE = CE; RY.CE2 = CE2; RY.CE_D = CE_D;
  RY.COAT = COAT; RY.FUR = FUR;
  RY.GBLEN = GB.len; RY.GBWIDE = GB.wide;
})();
