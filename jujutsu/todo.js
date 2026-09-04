/* =======================================================================
   AOI TODO
   Boogie Woogie 不義遊戯. The technique is one thing and one thing only:
   he claps, and two things swap places. Everything else about him is a
   very large man punching, which the swap is what gets him to.

     1  BOOGIE WOOGIE     不義遊戯 — a clap, and he is standing where the
                          marker landed, already swinging
     2  CHANGE PLACES     the two of them trade, and they arrive hard
     3  STRAIGHT PUNCH    直突き — one, committed, all the way through
     4  BOOGIE WOOGIE     連続不義遊戯 — clap, hit, clap, hit, from a
        RUSH              different side every time, and then the drop
     R  SWAP OUT          he claps and is not where the hit went

   Two rules for the look:

     · THE CLAP IS THE MOVE. Every single thing in this file starts with
       a clap, so the clap has to be worth watching: a hard flat ring on
       the ground, a second one in the air, and the crack of two palms
       that stops the frame for a moment.
     · A SWAP IS TWO PLACES AT ONCE. It is never drawn at one end. Both
       ends get a pillar, the pillars are joined by an arc that crosses
       over the middle, and both flash on the same frame — because what
       he did was to the pair, not to either one.
   ===================================================================== */
(function () {
  'use strict';
  if (typeof player === 'undefined' || typeof THREE === 'undefined') return;
  var FX = window.JJFX;
  if (!FX || typeof CHARS === 'undefined') return;
  var AN = window.JJANIM;
  var E = FX.ease;
  var TAU = Math.PI * 2;

  /* hot and heavy: a clap is a light, a fist is not */
  var GOLD = 0xffb347, HOT = 0xfff0d8, EMBER = 0xd45a1e;
  var SKIN = 0x8a5a3c, SKIN_D = 0x5f3b25, WRAP = 0xe6ddc8;
  var JACK = 0x1d2430, JACK_D = 0x11161f;

  var TD = window.JJTODO = { marks: [] };

  var BCD = { b1: 6, b2: 11, b3: 8, b4: 19, br: 10 };

  var TODO_CFG = {
    todo: true, face: false,
    torso: JACK, pants: 0x2a2f38, shoes: 0x14171d, skin: SKIN
  };

  /* ---------------------------------------------------------------- rig
     He is the biggest thing on the roster and that has to read from the
     back at thirty metres, so the bulk is real geometry hung on the
     bones rather than a scale on them — scale is what Mahito's warp
     writes to, and a body that loses its shoulders when somebody
     reshapes it is a bug waiting to happen.
     ================================================================== */
  var _makeAnimeRig = makeAnimeRig;
  makeAnimeRig = function (cfg) {
    var r = _makeAnimeRig(cfg);
    if (!cfg || !cfg.todo) return r;
    var head = r.head, spine = r.spine;

    function box(w, h, d, c, basic) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), basic
        ? new THREE.MeshBasicMaterial({ color: c, toneMapped: false })
        : new THREE.MeshStandardMaterial({ color: c, roughness: .8 }));
      m.castShadow = !basic;
      return m;
    }
    var i, s;

    /* the head: buzzed almost to the skin, with the hairline square */
    var buzz = box(.94, .3, .94, 0x1a1410); buzz.position.set(0, .92, -.01); head.add(buzz);
    var nape = box(.86, .34, .3, 0x120e0b); nape.position.set(0, .66, -.46); head.add(nape);
    /* the brows, which are most of his face */
    var bL = box(.28, .1, .07, 0x120e0b); bL.position.set(-.2, .70, .46); bL.rotation.z = -.18; head.add(bL);
    var bR = box(.28, .1, .07, 0x120e0b); bR.position.set(.2, .70, .46); bR.rotation.z = .18; head.add(bR);
    var eL = box(.16, .1, .05, 0xf4efe4, true); eL.position.set(-.2, .56, .46); head.add(eL);
    var eR = box(.16, .1, .05, 0xf4efe4, true); eR.position.set(.2, .56, .46); head.add(eR);
    var pL = box(.07, .08, .06, 0x241a12, true); pL.position.set(-.19, .56, .48); head.add(pL);
    var pR = box(.07, .08, .06, 0x241a12, true); pR.position.set(.19, .56, .48); head.add(pR);
    /* the jaw, and the grin under it */
    var jaw = box(.78, .28, .8, SKIN); jaw.position.set(0, .18, .02); head.add(jaw);
    var grin = box(.42, .07, .06, 0x5a3020); grin.position.set(0, .26, .46); head.add(grin);
    for (i = 0; i < 4; i++) {
      var th = box(.08, .09, .05, 0xf2ece0);
      th.position.set(-.14 + i * .1, .30, .47);
      head.add(th);
    }

    /* THE BULK. Chest and back slabs, deltoids on the shoulders, thick
       forearms and thighs. All parented so they move with the bone. */
    /* The chest sits BEHIND the jacket, not in front of it. The first
       pass had the pec slab 1.5 wide at z=.38 and the lapels at z=.30,
       so a man in an open jacket came out as a man in no jacket. */
    var pec = box(1.2, .78, .3, SKIN); pec.position.set(0, .72, .30); spine.add(pec);
    var abs = box(.96, .74, .28, SKIN_D); abs.position.set(0, .16, .28); spine.add(abs);
    for (i = 0; i < 3; i++) {
      var line = box(.8, .05, .06, SKIN_D);
      line.position.set(0, .38 - i * .22, .42);
      spine.add(line);
    }
    var lat = box(1.66, 1.06, .56, JACK_D); lat.position.set(0, .62, -.22); spine.add(lat);
    /* the jacket, worn open over all of it and hanging in front of it */
    for (s = -1; s <= 1; s += 2) {
      var lap = box(.42, 1.6, .2, JACK);
      lap.position.set(.6 * s, .56, .42);
      lap.rotation.z = -.12 * s;
      spine.add(lap);
      var trim = box(.12, 1.6, .22, JACK_D);
      trim.position.set(.42 * s, .56, .44);
      trim.rotation.z = -.12 * s;
      spine.add(trim);
      /* the shoulder of it, big enough to sit over the deltoid */
      var epa = box(.9, .36, .9, JACK);
      epa.position.set(.84 * s, 1.02, 0);
      spine.add(epa);
      var sleeve = box(.84, .5, .84, JACK_D);
      sleeve.position.set(.86 * s, .66, 0);
      spine.add(sleeve);
    }
    var coll = box(1.0, .42, .78, JACK); coll.position.set(0, 1.2, -.04); spine.add(coll);
    var back = box(1.3, 1.3, .2, JACK); back.position.set(0, .62, -.46); spine.add(back);

    /* arms: deltoid, then a forearm wrapped to the knuckle */
    var arms = [[r.shoulderL, r.elbowL, -1], [r.shoulderR, r.elbowR, 1]];
    for (i = 0; i < arms.length; i++) {
      var sh = arms[i][0], el = arms[i][1];
      var delt = box(.6, .58, .6, SKIN); delt.position.set(0, -.34, 0); sh.add(delt);
      var bic = box(.5, .78, .5, SKIN); bic.position.set(0, -.66, .04); sh.add(bic);
      var fore = box(.46, .8, .46, SKIN); fore.position.set(0, -.5, 0); el.add(fore);
      /* the wraps, which is how you know he hits things for a living */
      for (var w = 0; w < 4; w++) {
        var band = box(.52, .12, .52, WRAP);
        band.position.set(0, -.72 - w * .15, 0);
        band.rotation.y = w * .3;
        el.add(band);
      }
      var fist = box(.44, .38, .46, WRAP); fist.position.set(0, -1.22, .02); el.add(fist);
    }
    /* legs */
    var legs = [[r.hipL, r.kneeL], [r.hipR, r.kneeR]];
    for (i = 0; i < legs.length; i++) {
      var th2 = box(.62, .96, .62, 0x2a2f38); th2.position.set(0, -.56, 0); legs[i][0].add(th2);
      var cf = box(.54, .7, .56, 0x2a2f38); cf.position.set(0, -.42, -.04); legs[i][1].add(cf);
    }
    return r;
  };

  CHARS.todo = {
    name: 'AOI TODO', sub: 'BOOGIE WOOGIE',
    cfg: TODO_CFG, glow: '#ffb347',
    moves: [
      { key: 'LMB', lbl: 'Punch', cd: 'm1', max: .3 },
      { key: 'Q', lbl: 'Dash', cd: 'dash', max: 1 },
      { key: '1', lbl: 'Boogie Woogie', cd: 'b1', max: BCD.b1 },
      { key: '2', lbl: 'Change Places', cd: 'b2', max: BCD.b2 },
      { key: '3', lbl: 'Straight Punch', cd: 'b3', max: BCD.b3 },
      { key: '4', lbl: 'Woogie Rush', cd: 'b4', max: BCD.b4 },
      { key: 'R', lbl: 'Swap Out', cd: 'br', max: BCD.br }
    ]
  };
  try { CHARS.todo.portrait = makePortrait(TODO_CFG); } catch (e) {}
  try { buildCharList(); } catch (e) {}

  cds.b1 = 0; cds.b2 = 0; cds.b3 = 0; cds.b4 = 0; cds.br = 0;

  /* --------------------------------------------------------------- help */
  function ready(key) {
    return player.char === 'todo' && !player.dead && !busy() && cds[key] <= 0 &&
      !player.react && !(window.JJNAOYA && window.JJNAOYA.busy());
  }
  function start(type, dur, key, name, sub) {
    cds[key] = BCD[key];
    player.action = { type: type, t: 0, dur: dur, stage: 0 };
    if (name) { try { showSplash(name, sub || '', '#ffb347'); } catch (e) {} }
    return player.action;
  }
  function aim() {
    return new THREE.Vector3(Math.sin(player.facing), 0, Math.cos(player.facing));
  }
  function rp(r) { resetPose(r); if (r.body) r.body.rotation.set(0, 0, 0); }
  function later(ms, fn) {
    setTimeout(function () { if (typeof scene !== 'undefined') fn(); }, ms);
  }
  /* the nearest body in front of him, which is who a clap is about */
  function target(range, cone) {
    var d = aim(), best = null, near = range || 30;
    for (var i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      if (!e || e.dead) continue;
      var to = e.pos.clone().sub(player.pos); to.y = 0;
      var dist = to.length();
      if (dist < .5 || dist > near) continue;
      if (to.normalize().dot(d) < (cone == null ? .2 : cone)) continue;
      near = dist; best = e;
    }
    return best;
  }

  /* =====================================================================
     THE CLAP
     Every move he has starts with one, so it is worth building properly:
     a hard flat ring on the ground, a second in the air at his hands,
     the crack, and a frame of stop.
     ================================================================== */
  function clap(at, size, loud) {
    size = size || 1;
    FX.ring(new THREE.Vector3(at.x, .12, at.z), GOLD,
      { maxR: 9 * size, life: .38, ground: true });
    FX.rings(at.clone(), HOT, 2, { maxR: 5 * size, life: .28, ground: false, gap: 40 });
    FX.impact(at.clone(), HOT, 2 * size);
    FX.cross(at.clone(), HOT, 4.5 * size, .16);
    FX.flash('#fff3d8', .22 * size, .13);
    addShake(1 * size);
    if (loud !== false && typeof hitstop === 'function') hitstop(.07 * size);
    try { sfx.redBoom(); } catch (e) {}
  }
  TD.clap = clap;

  /* a pillar of light standing where something is about to stop being */
  function pillar(at, color, life) {
    var m = FX.billboard(FX.T.streak, color == null ? GOLD : color, 1);
    m.scale.set(2.4, 14, 1);
    m.position.copy(at).add(new THREE.Vector3(0, 6, 0));
    scene.add(m);
    var t = 0, L = life || .34;
    addFx({ t: L, update: function (dd) {
      this.t -= dd; t += dd;
      FX.faceCam(m, 0);
      m.scale.x = 2.4 * (1 + t * 5);
      m.material.opacity = Math.max(0, this.t / L);
      if (this.t <= 0) { scene.remove(m); m.material.dispose(); return false; }
      return true;
    } });
  }

  /* A SWAP, drawn at both ends at once. The arc crosses over the middle
     so the eye can see which went where — a swap drawn as two separate
     puffs is two teleports, which is a different technique. */
  function swapFx(a, b) {
    var A = a.clone(), B = b.clone();
    pillar(A, GOLD, .38);
    pillar(B, HOT, .38);
    var mid = A.clone().lerp(B, .5).add(new THREE.Vector3(0, 7, 0));
    var side = new THREE.Vector3(-(B.z - A.z), 0, B.x - A.x);
    if (side.lengthSq() < .01) side.set(1, 0, 0);
    side.normalize().multiplyScalar(Math.max(3, A.distanceTo(B) * .22));
    /* two halves of one crossing arc, drawn as chains of short bolts */
    [[A, mid.clone().add(side), B], [B, mid.clone().sub(side), A]].forEach(function (path, i) {
      var STEPS = 12, prev = path[0].clone().add(new THREE.Vector3(0, 2, 0));
      for (var s = 1; s <= STEPS; s++) {
        var k = s / STEPS;
        var pt = new THREE.Vector3().copy(path[0]).lerp(path[2], k).add(new THREE.Vector3(0, 2, 0));
        pt.lerp(path[1], Math.sin(k * Math.PI) * .7);
        var seg = FX.billboard(FX.T.streak, i ? HOT : GOLD, .95);
        var len = FX.orientAlong(seg, prev, pt);
        seg.scale.set(len, Math.max(.22, len * .12), 1);
        scene.add(seg);
        (function (seg, delay) {
          var t = -delay;
          addFx({ t: 1e9, update: function (dd) {
            t += dd;
            seg.material.opacity = t < 0 ? 0 : Math.max(0, 1 - t / .3);
            if (t > .3) { scene.remove(seg); seg.material.dispose(); return false; }
            return true;
          } });
        })(seg, k * .1);
        prev = pt;
      }
    });
    FX.impact(A.clone().add(new THREE.Vector3(0, 2, 0)), GOLD, 2.4);
    FX.impact(B.clone().add(new THREE.Vector3(0, 2, 0)), HOT, 2.4);
  }
  TD.swapFx = swapFx;

  /* somebody arriving somewhere they were not a moment ago */
  function arrive(at, power) {
    FX.rings(new THREE.Vector3(at.x, .12, at.z), GOLD, 2,
      { maxR: 7 * (power || 1), life: .4, gap: 40 });
    FX.dust(new THREE.Vector3(at.x, 0, at.z), 7, 0xd8c8a8, 9, 3);
    FX.speedRing(at.clone().add(new THREE.Vector3(0, 2, 0)), HOT, 8 * (power || 1), .26);
  }

  /* actually exchanging two bodies, with the ground kept honest */
  function place(ent, to) {
    if (ent === player) {
      player.pos.set(to.x, Math.max(0, to.y), to.z);
      player.vel.set(0, 0, 0);
      if (typeof collideWorld === 'function') { try { collideWorld(player); } catch (e) {} }
    } else if (ent) {
      ent.pos.set(to.x, Math.max(0, to.y), to.z);
      if (ent.vel) ent.vel.set(0, 0, 0);
      ent.anchorT = 0;
    }
  }
  function exchange(x, y) {
    if (!x || !y) return;
    var a = x === player ? player.pos.clone() : x.pos.clone();
    var b = y === player ? player.pos.clone() : y.pos.clone();
    swapFx(a, b);
    place(x, b);
    place(y, a);
    arrive(a); arrive(b);
  }
  TD.exchange = exchange;

  /* =====================================================================
     1 · BOOGIE WOOGIE  不義遊戯
     The engage. He flicks a marker at whoever is in front of him, claps,
     and is standing where the marker landed with his elbow already out.
     ================================================================== */
  var BW = { range: 34, dmg: 30, reach: 5.5 };

  function markerAt(at) {
    var g = new THREE.Group();
    var core = FX.billboard(FX.T.star, HOT, .95);
    core.scale.setScalar(1.6);
    g.add(core);
    var ring = FX.billboard(FX.T.ring, GOLD, .8);
    ring.scale.setScalar(2.2);
    ring.rotation.x = -Math.PI / 2;
    g.add(ring);
    g.position.copy(at);
    scene.add(g);
    TD.marks.push(g);
    return g;
  }
  function dropMarker(g) {
    if (!g) return;
    var i = TD.marks.indexOf(g);
    if (i >= 0) TD.marks.splice(i, 1);
    scene.remove(g);
    g.traverse(function (o) { if (o.isMesh && o.material) o.material.dispose(); });
  }

  function castBoogie() {
    if (!ready('b1')) return;
    var a = start('b1', 1.0, 'b1', 'BOOGIE WOOGIE', '不義遊戯');
    a.dir = aim();
    a.mark = target(BW.range, .15);
    player.iframes = Math.max(player.iframes, .7);
    try { sfx.whoosh(); } catch (e) {}
  }
  function stepBoogie(a, dt) {
    var p = player, d = a.dir;
    /* the marker goes out first, so the swap has a place to be */
    if (a.stage < 1 && a.t > .12) {
      a.stage = 1;
      var to = a.mark && !a.mark.dead
        ? a.mark.pos.clone().addScaledVector(d, -3.2)
        : p.pos.clone().addScaledVector(d, 14);
      to.y = 0;
      a.spot = to;
      a.marker = markerAt(to.clone().add(new THREE.Vector3(0, 1.2, 0)));
      FX.streaks(p.pos.clone().add(new THREE.Vector3(0, 2.4, 0)), GOLD, 4, 12, .7);
    }
    if (a.stage < 2 && a.t > .38) {
      a.stage = 2;
      /* THE CLAP, and he is not where he was */
      var from = p.pos.clone();
      clap(p.pos.clone().add(new THREE.Vector3(0, 2.4, 0)), 1);
      swapFx(from, a.spot);
      dropMarker(a.marker); a.marker = null;
      place(player, a.spot);
      arrive(a.spot, 1.2);
      if (a.mark && !a.mark.dead) {
        var to2 = a.mark.pos.clone().sub(player.pos).setY(0);
        if (to2.lengthSq() > .01) player.facing = Math.atan2(to2.x, to2.z);
      }
    }
    /* and the elbow that was already on its way */
    if (a.stage < 3 && a.t > .58) {
      a.stage = 3;
      var d2 = aim();
      var at = p.pos.clone().addScaledVector(d2, 2.6).add(new THREE.Vector3(0, 2.5, 0));
      FX.slash(at.clone(), d2, HOT, 7, .18);
      FX.impact(at.clone(), GOLD, 2.6);
      addShake(1.8);
      if (typeof hitstop === 'function') hitstop(.1);
      enemiesNear(at, BW.reach, d2, 0).forEach(function (e) {
        if (!e || e.dead) return;
        var kb = d2.clone().multiplyScalar(20); kb.y = 15;
        e.damage(BW.dmg, kb, {
          react: 'blow', reactDur: .8, spark: GOLD, stun: .7,
          bleed: true, death: 'ragdoll' });
        FX.cross(e.pos.clone().add(new THREE.Vector3(0, 2.4, 0)), HOT, 6, .2);
      });
    }
  }

  /* =====================================================================
     2 · CHANGE PLACES
     The technique used on somebody else's pair. Two of them trade, and
     they arrive at the wrong speed. With only one, the one they trade
     with is the ground in front of him.
     ================================================================== */
  var CP = { range: 34, dmg: 26 };

  function castChange() {
    if (!ready('b2')) return;
    var a = start('b2', 1.1, 'b2', 'CHANGE PLACES', '入れ替え');
    a.dir = aim();
    /* the two nearest bodies in front of him */
    var d = aim(), list = [];
    enemies.forEach(function (e) {
      if (!e || e.dead) return;
      var to = e.pos.clone().sub(player.pos); to.y = 0;
      var dist = to.length();
      if (dist < .5 || dist > CP.range) return;
      if (to.clone().normalize().dot(d) < 0) return;
      list.push({ e: e, d: dist });
    });
    list.sort(function (x, y) { return x.d - y.d; });
    a.pair = [list[0] && list[0].e, list[1] && list[1].e];
    player.iframes = Math.max(player.iframes, .5);
    try { sfx.whoosh(); } catch (e) {}
  }
  function stepChange(a, dt) {
    var p = player, d = a.dir;
    p.vel.x *= .8; p.vel.z *= .8;
    if (a.stage < 1 && a.t > .42) {
      a.stage = 1;
      clap(p.pos.clone().add(new THREE.Vector3(0, 2.4, 0)), 1.25);
      var x = a.pair[0], y = a.pair[1];
      if (x && !x.dead && y && !y.dead) {
        exchange(x, y);
      } else if (x && !x.dead) {
        /* one of them: the other end of the swap is the floor at his feet */
        var here = p.pos.clone().addScaledVector(d, 3.5);
        swapFx(x.pos.clone(), here);
        place(x, here);
        arrive(here, 1.2);
        y = null;
      }
      /* they arrive at the speed of somebody who did not choose to */
      [x, y].forEach(function (e) {
        if (!e || e.dead) return;
        var kb = e.pos.clone().sub(p.pos).setY(0);
        if (kb.lengthSq() < .01) kb.copy(d);
        kb.normalize().multiplyScalar(9); kb.y = 16;
        e.damage(CP.dmg, kb, {
          react: 'blow', reactDur: .9, spark: HOT, stun: .9,
          bleed: true, death: 'dice' });
        FX.rings(e.pos.clone().add(new THREE.Vector3(0, 1.4, 0)), GOLD, 2,
          { maxR: 9, life: .45, ground: false, gap: 36 });
        FX.debris(new THREE.Vector3(e.pos.x, .1, e.pos.z), 8, 10, 0x8b7c62);
      });
      addShake(2.2);
      if (typeof hitstop === 'function') hitstop(.12);
    }
  }

  /* =====================================================================
     3 · STRAIGHT PUNCH  直突き
     No technique in it at all. He steps in and throws one, and it is the
     hardest single thing anybody on the roster does.
     ================================================================== */
  var SP = { dmg: 38, reach: 8, step: 26 };

  function castStraight() {
    if (!ready('b3')) return;
    var a = start('b3', 1.05, 'b3', 'STRAIGHT PUNCH', '直突き');
    a.dir = aim();
    player.iframes = Math.max(player.iframes, .45);
    try { sfx.whoosh(); } catch (e) {}
  }
  function stepStraight(a, dt) {
    var p = player, d = a.dir;
    /* the wind-up plants him, the step carries him through it */
    if (a.t < .3) { p.vel.x *= .6; p.vel.z *= .6; return; }
    if (a.t < .46) {
      p.vel.x = d.x * SP.step; p.vel.z = d.z * SP.step;
      if (a.stage < 1) {
        a.stage = 1;
        FX.streaks(p.pos.clone().add(new THREE.Vector3(0, 2.4, 0)), GOLD, 5, 13, .8);
        if (typeof ghostAfterimage === 'function') ghostAfterimage(p.rig, EMBER, .3);
      }
      return;
    }
    p.vel.x *= .55; p.vel.z *= .55;
    if (a.stage < 2) {
      a.stage = 2;
      var at = p.pos.clone().addScaledVector(d, 3.4).add(new THREE.Vector3(0, 2.5, 0));
      /* the cone of air it pushes */
      FX.wave(at.clone(), d, GOLD, { steps: 4, gap: 26, reach: 4, r0: 3.4, grow: 2.2 });
      FX.cross(at.clone(), 0xffffff, 9, .24);
      FX.impact(at.clone(), HOT, 4);
      FX.speedRing(at.clone(), GOLD, 14, .3);
      FX.mangaLines(.9, .3);
      FX.flash('#fff3d8', .4, .2);
      addShake(3);
      if (typeof hitstop === 'function') hitstop(.18);
      try { sfx.redBoom(); } catch (e) {}
      enemiesNear(at, SP.reach, d, .1).forEach(function (e) {
        if (!e || e.dead) return;
        var kb = d.clone().multiplyScalar(46); kb.y = 20;
        e.damage(SP.dmg, kb, {
          react: 'blow', reactDur: 1.1, spark: HOT, stun: 1,
          bleed: true, death: 'sever' });
        FX.blood(e.pos.clone().add(new THREE.Vector3(0, 2.4, 0)), d, 16, 2.2);
        FX.rings(e.pos.clone().add(new THREE.Vector3(0, 2.2, 0)), HOT, 3,
          { maxR: 13, life: .5, ground: false, gap: 34 });
      });
    }
  }

  /* =====================================================================
     4 · BOOGIE WOOGIE RUSH  連続不義遊戯
     The whole technique as one attack. Clap, hit, clap, hit — a marker
     on every side of them in turn, and he is never where the last one
     landed. It ends with both hands from directly overhead.
     ================================================================== */
  var RUSH = { hits: 7, dmg: 9, last: 34, radius: 6, gap: .16 };

  function castRush() {
    if (!ready('b4')) return;
    var a = start('b4', 2.1, 'b4', 'BOOGIE WOOGIE RUSH', '連続不義遊戯');
    a.dir = aim();
    a.mark = target(36, 0);
    a.n = 0;
    a.home = player.pos.clone();
    player.iframes = Math.max(player.iframes, 2.4);
    FX.letterbox(true);
    later(2600, function () { FX.letterbox(false); });
    try { sfx.raise(); } catch (e) {}
  }
  function stepRush(a, dt) {
    var p = player, d = a.dir;
    p.vel.set(0, 0, 0);
    var mark = a.mark && !a.mark.dead ? a.mark : null;
    var focus = mark ? mark.pos.clone() : a.home.clone().addScaledVector(d, 10);
    focus.y = 0;

    if (a.t < .28) return;                     // the first clap winds up

    /* one beat per hit: clap, appear on a new side, hit, repeat */
    if (a.n < RUSH.hits && a.t > .28 + a.n * RUSH.gap) {
      var n = a.n++;
      var ang = (n / RUSH.hits) * TAU * 1.35 + .6;
      var spot = focus.clone().add(new THREE.Vector3(Math.cos(ang) * 4.4, 0, Math.sin(ang) * 4.4));
      var from = p.pos.clone();
      clap(from.clone().add(new THREE.Vector3(0, 2.4, 0)), .55, false);
      swapFx(from, spot);
      place(player, spot);
      var to = focus.clone().sub(player.pos).setY(0);
      if (to.lengthSq() > .01) player.facing = Math.atan2(to.x, to.z);
      if (typeof ghostAfterimage === 'function') ghostAfterimage(p.rig, GOLD, .26);
      /* each hit lands where they are NOW, and they are being carried
         upward a little further every time — a fixed height stops
         connecting about halfway through */
      var lift = Math.min(5, n * .8);
      var at = focus.clone().add(new THREE.Vector3(0, lift + 1.8, 0));
      FX.impact(at.clone(), n % 2 ? HOT : GOLD, 2);
      FX.cross(at.clone(), HOT, 5, .14);
      addShake(.9);
      if (typeof hitstop === 'function') hitstop(.04);
      enemiesNear(at, RUSH.radius).forEach(function (e) {
        if (!e || e.dead) return;
        e.damage(RUSH.dmg, null, {
          react: null, spark: GOLD, noFrameBonus: true, bleed: true, death: 'flat' });
        FX.blood(e.pos.clone().add(new THREE.Vector3(0, 2.4, 0)),
          new THREE.Vector3(Math.cos(ang), .2, Math.sin(ang)), 5, 1.2);
        e.anchorT = .3;
        e.anchorPos.copy(focus).add(new THREE.Vector3(0, lift, 0));
        e.pos.lerp(e.anchorPos, .45);
        e.vel.set(0, 0, 0);
      });
    }

    /* and the drop: straight above, both hands, all the way down */
    if (a.n >= RUSH.hits && a.stage < 1 && a.t > .28 + RUSH.hits * RUSH.gap + .18) {
      a.stage = 1;
      var over = focus.clone().add(new THREE.Vector3(0, 9, 0));
      clap(p.pos.clone().add(new THREE.Vector3(0, 2.4, 0)), 1.4);
      swapFx(p.pos.clone(), over);
      place(player, over);
      player.vel.y = -2;
    }
    if (a.stage === 1 && p.pos.y <= .2) {
      a.stage = 2;
      p.pos.y = 0; p.vel.y = 0;
      var down = new THREE.Vector3(focus.x, 0, focus.z);
      FX.flash('#fff3d8', .6, .28);
      FX.rings(new THREE.Vector3(down.x, .12, down.z), GOLD, 5,
        { maxR: 24, life: .8, gap: 40 });
      FX.cracks(new THREE.Vector3(down.x, .1, down.z), 20, 26, 0x3a2a18);
      FX.dust(new THREE.Vector3(down.x, 0, down.z), 14, 0xd8c8a8, 18, 5);
      FX.mangaLines(1, .34);
      addShake(4);
      if (typeof hitstop === 'function') hitstop(.22);
      try { sfx.redBoom(); } catch (e) {}
      enemiesNear(down.clone().add(new THREE.Vector3(0, 2, 0)), 8).forEach(function (e) {
        if (!e || e.dead) return;
        e.anchorT = 0;
        e.damage(RUSH.last, new THREE.Vector3(0, -18, 0), {
          react: 'blow', reactDur: 1, spark: HOT, stun: 1,
          bleed: true, death: 'flat' });
      });
    }
    if (a.stage === 1) { p.vel.y -= 90 * dt; }
  }

  /* =====================================================================
     R · SWAP OUT
     The other half of the technique: he does not dodge, he simply is
     not where the hit went, and something else is.
     ================================================================== */
  var OUT = { range: 15, dmg: 12, radius: 6.5 };

  function castOut() {
    if (!ready('br')) return;
    var a = start('br', .8, 'br', 'SWAP OUT', '不義遊戯');
    a.dir = aim();
    a.from = player.pos.clone();
    player.iframes = Math.max(player.iframes, 1);
    try { sfx.whoosh(); } catch (e) {}
  }
  function stepOut(a, dt) {
    var p = player, d = a.dir;
    if (a.stage < 1) {
      a.stage = 1;
      var side = new THREE.Vector3(-d.z, 0, d.x);
      var to = a.from.clone().addScaledVector(d, -OUT.range * .7)
        .addScaledVector(side, OUT.range * .6);
      to.y = 0;
      clap(a.from.clone().add(new THREE.Vector3(0, 2.4, 0)), .9);
      swapFx(a.from, to);
      place(player, to);
      arrive(to, 1);
      var face = a.from.clone().sub(player.pos).setY(0);
      if (face.lengthSq() > .01) player.facing = Math.atan2(face.x, face.z);
      /* and what he swapped in for himself goes off where he was */
      later(180, function () {
        FX.impact(a.from.clone().add(new THREE.Vector3(0, 2, 0)), GOLD, 3);
        FX.rings(a.from.clone().add(new THREE.Vector3(0, 1.4, 0)), HOT, 3,
          { maxR: OUT.radius * 1.7, life: .5, ground: false, gap: 34 });
        FX.debris(new THREE.Vector3(a.from.x, .1, a.from.z), 10, 12, 0x8b7c62);
        FX.dust(new THREE.Vector3(a.from.x, 0, a.from.z), 8, 0xd8c8a8, 11, 4);
        addShake(1.4);
        enemiesNear(a.from.clone().add(new THREE.Vector3(0, 2, 0)), OUT.radius).forEach(function (e) {
          if (!e || e.dead) return;
          var kb = e.pos.clone().sub(a.from).setY(0);
          if (kb.lengthSq() < .01) kb.set(1, 0, 0);
          kb.normalize().multiplyScalar(15); kb.y = 12;
          e.damage(OUT.dmg, kb, {
            react: 'stagger', reactDur: .5, spark: GOLD, bleed: true, death: 'dice' });
        });
      });
    }
  }

  /* =====================================================================
     POSES
     A heavyweight's timing: the wind-up is slow and wide and everything
     after the contact is fast. The claps are the exception — both hands
     meet on one frame and stop dead, because that is what a clap is.
     ================================================================== */
  function poseTodo(r, a) {
    var t = a.t, out = E.out;
    switch (a.type) {
      case 'b1': {                     // flick, clap, elbow
        rp(r);
        var fl = out(Math.min(1, t / .14));
        var cl = t > .28 ? out(Math.min(1, (t - .28) / .1)) : 0;
        var el = t > .56 ? out(Math.min(1, (t - .56) / .14)) : 0;
        r.shoulderR.rotation.x = -1.5 * fl + .4 * cl - 1.4 * el;
        r.shoulderR.rotation.z = -.5 * fl + .5 * cl - .3 * el;
        r.elbowR.rotation.x = -.4 * fl - 1.4 * cl + 1.1 * el;
        r.shoulderL.rotation.x = -.6 * fl - .9 * cl + .5 * el;
        r.shoulderL.rotation.z = .8 * fl - .5 * cl;
        r.elbowL.rotation.x = -1.0 * fl - .6 * cl + .4 * el;
        r.spine.rotation.y = -.5 * fl + .5 * cl - .9 * el;
        r.spine.rotation.x = .1 * fl - .2 * cl + .3 * el;
        r.neck.rotation.y = .3 * fl - .3 * cl + .5 * el;
        r.hipL.rotation.x = -.4 * fl + .3 * el; r.kneeL.rotation.x = .7 * fl;
        r.hipR.rotation.x = .3 * fl - .3 * el; r.kneeR.rotation.x = .5 * fl;
        r.hips.position.y = r.hipsBaseY - .34 * fl + .16 * el;
        return true;
      }
      case 'b2': {                     // both arms wide, then the clap
        rp(r);
        var w = out(Math.min(1, t / .38));
        var c2 = t > .4 ? out(Math.min(1, (t - .4) / .09)) : 0;
        r.shoulderL.rotation.x = -1.5 * w + .3 * c2;
        r.shoulderR.rotation.x = -1.5 * w + .3 * c2;
        r.shoulderL.rotation.z = 1.5 * w - 1.35 * c2;
        r.shoulderR.rotation.z = -1.5 * w + 1.35 * c2;
        r.elbowL.rotation.x = -.15 - .7 * c2;
        r.elbowR.rotation.x = -.15 - .7 * c2;
        r.spine.rotation.x = -.22 * w + .34 * c2;
        r.neck.rotation.x = -.3 * w + .4 * c2;
        r.hipL.rotation.x = -.24 * w; r.kneeL.rotation.x = .45 * w + .2 * c2;
        r.hipR.rotation.x = -.2 * w; r.kneeR.rotation.x = .4 * w + .2 * c2;
        r.hips.position.y = r.hipsBaseY - .2 * w - .22 * c2;
        return true;
      }
      case 'b3': {                     // the biggest wind-up on the roster
        rp(r);
        var up = out(Math.min(1, t / .3));
        var go = t > .32 ? out(Math.min(1, (t - .32) / .14)) : 0;
        var thru = t > .46 ? out(Math.min(1, (t - .46) / .16)) : 0;
        r.shoulderR.rotation.x = -.3 - 1.0 * up + 2.3 * (go + thru) * .5;
        r.shoulderR.rotation.z = -1.5 * up + 1.5 * thru;
        r.shoulderR.rotation.y = -.9 * up + 1.5 * thru;
        r.elbowR.rotation.x = -1.9 * up + 1.85 * thru;
        r.shoulderL.rotation.x = -1.3 * up - .5 * thru;
        r.shoulderL.rotation.z = .9 * up - .5 * thru;
        r.elbowL.rotation.x = -1.5 * up + .7 * thru;
        r.spine.rotation.y = 1.0 * up - 1.9 * thru;
        r.spine.rotation.x = -.24 * up + .5 * thru;
        r.neck.rotation.y = -.4 * up + .8 * thru;
        r.hipL.rotation.x = -.6 * up + .4 * thru; r.kneeL.rotation.x = .9 * up - .3 * thru;
        r.hipR.rotation.x = .5 * up - .7 * thru; r.kneeR.rotation.x = .7 * up - .3 * thru;
        r.hips.position.y = r.hipsBaseY - .5 * up + .3 * thru;
        return true;
      }
      case 'b4': {                     // clapping on every beat, then both up
        rp(r);
        var beat = Math.max(0, Math.sin(t * 19));
        var over = a.stage >= 1;
        if (!over) {
          r.shoulderL.rotation.x = -1.35 - .3 * beat;
          r.shoulderR.rotation.x = -1.35 - .3 * beat;
          r.shoulderL.rotation.z = .18 + 1.0 * (1 - beat);
          r.shoulderR.rotation.z = -.18 - 1.0 * (1 - beat);
          r.elbowL.rotation.x = -.9 - .5 * beat;
          r.elbowR.rotation.x = -.9 - .5 * beat;
          r.spine.rotation.x = -.14 + .28 * beat;
          r.neck.rotation.x = -.2 + .3 * beat;
          r.hipL.rotation.x = -.3; r.kneeL.rotation.x = .55;
          r.hipR.rotation.x = -.24; r.kneeR.rotation.x = .48;
          r.hips.position.y = r.hipsBaseY - .3;
        } else {
          /* both hands locked over the head, coming down */
          var f = a.stage >= 2 ? 1 : 0;
          r.shoulderL.rotation.x = -2.9 + 3.2 * f;
          r.shoulderR.rotation.x = -2.9 + 3.2 * f;
          r.shoulderL.rotation.z = .2 - .1 * f;
          r.shoulderR.rotation.z = -.2 + .1 * f;
          r.elbowL.rotation.x = -.2; r.elbowR.rotation.x = -.2;
          r.spine.rotation.x = -.3 + .9 * f;
          r.neck.rotation.x = -.5 + 1.0 * f;
          r.hipL.rotation.x = -.7 + 1.0 * f; r.kneeL.rotation.x = 1.2 - .5 * f;
          r.hipR.rotation.x = -.6 + .9 * f; r.kneeR.rotation.x = 1.1 - .5 * f;
          r.hips.position.y = r.hipsBaseY - .2 - .5 * f;
        }
        return true;
      }
      case 'br': {                     // one clap, and he is not there
        rp(r);
        var k = out(Math.min(1, t / .1));
        var after = t > .18 ? out(Math.min(1, (t - .18) / .3)) : 0;
        r.shoulderL.rotation.x = -1.45 * k + .9 * after;
        r.shoulderR.rotation.x = -1.45 * k + .9 * after;
        r.shoulderL.rotation.z = .2 * k + .6 * after;
        r.shoulderR.rotation.z = -.2 * k - .6 * after;
        r.elbowL.rotation.x = -1.2 * k + .7 * after;
        r.elbowR.rotation.x = -1.2 * k + .7 * after;
        r.spine.rotation.x = .2 * k - .5 * after;
        r.spine.rotation.y = .4 * after;
        r.neck.rotation.x = .16 * k - .4 * after;
        r.hipL.rotation.x = -.3 * k - .3 * after; r.kneeL.rotation.x = .55 * k + .5 * after;
        r.hipR.rotation.x = -.24 * k; r.kneeR.rotation.x = .48 * k;
        r.hips.position.y = r.hipsBaseY - .3 * k - .2 * after;
        return true;
      }
    }
    return false;
  }

  /* --------------------------------------------------------------- wiring */
  var _stepAction = stepAction;
  stepAction = function (a, dt) {
    switch (a.type) {
      case 'b1': return stepBoogie(a, dt);
      case 'b2': return stepChange(a, dt);
      case 'b3': return stepStraight(a, dt);
      case 'b4': return stepRush(a, dt);
      case 'br': return stepOut(a, dt);
    }
    return _stepAction(a, dt);
  };

  var _poseAction = poseAction;
  poseAction = function (r, a) {
    if (a && (r.__char || player.char) === 'todo' && poseTodo(r, a)) return;
    return _poseAction(r, a);
  };

  window.addEventListener('keydown', function (e) {
    if (!started || player.char !== 'todo' || e.repeat) return;
    if (player.react || (player.action && (player.action.type === 'kb' ||
        player.action.type === 'void'))) {
      if (window.JJNOTICE && Math.random() < .5) window.JJNOTICE('NO TECHNIQUE WHILE HIT', '#ff8b98');
      return;
    }
    var hit = true;
    if (e.code === 'Digit1') castBoogie();
    else if (e.code === 'Digit2') castChange();
    else if (e.code === 'Digit3') castStraight();
    else if (e.code === 'Digit4') castRush();
    else if (e.code === 'KeyR') castOut();
    else hit = false;
    if (hit) e.stopImmediatePropagation();
  }, true);

  /* a marker left standing after he has gone is a swap waiting to happen
     to somebody who is not in this fight any more */
  var _switchChar = switchChar;
  switchChar = function (id, quiet) {
    TD.marks.slice().forEach(dropMarker);
    return _switchChar(id, quiet);
  };

  /* =====================================================================
     WHAT EVERYBODY ELSE SEES
     A swap is the one thing in the game that is drawn at two places at
     once, and only one of them is where the caster is — so the far end
     is rebuilt from the direction he was facing rather than assumed to
     be under him. The damage is left out: every hit travels as its own
     message and would otherwise land twice.
     ================================================================== */
  function dirOf(yaw) { return new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)); }

  TD.remote = {
    b1: function (pos, yaw) {
      var d = dirOf(yaw), to = pos.clone().addScaledVector(d, 12);
      later(120, function () { markerAt(to.clone().add(new THREE.Vector3(0, 1.2, 0))); });
      later(380, function () {
        clap(pos.clone().add(new THREE.Vector3(0, 2.4, 0)), 1);
        swapFx(pos.clone(), to);
        arrive(to, 1.2);
        TD.marks.slice().forEach(dropMarker);
      });
      later(580, function () {
        FX.slash(to.clone().addScaledVector(d, 2.6).add(new THREE.Vector3(0, 2.5, 0)), d, HOT, 7, .18);
        FX.impact(to.clone().addScaledVector(d, 2.6).add(new THREE.Vector3(0, 2.5, 0)), GOLD, 2.6);
      });
    },
    b2: function (pos, yaw) {
      var d = dirOf(yaw);
      later(420, function () {
        clap(pos.clone().add(new THREE.Vector3(0, 2.4, 0)), 1.25);
        var a = pos.clone().addScaledVector(d, 9);
        var b = pos.clone().addScaledVector(d, 18);
        swapFx(a, b);
        arrive(a, 1.1); arrive(b, 1.1);
      });
    },
    b3: function (pos, yaw) {
      var d = dirOf(yaw);
      later(460, function () {
        var at = pos.clone().addScaledVector(d, 3.4).add(new THREE.Vector3(0, 2.5, 0));
        FX.wave(at.clone(), d, GOLD, { steps: 4, gap: 26, reach: 4, r0: 3.4, grow: 2.2 });
        FX.cross(at.clone(), 0xffffff, 9, .24);
        FX.impact(at.clone(), HOT, 4);
        FX.speedRing(at.clone(), GOLD, 14, .3);
      });
    },
    b4: function (pos, yaw) {
      var d = dirOf(yaw), focus = pos.clone().addScaledVector(d, 10);
      for (var i = 0; i < RUSH.hits; i++) {
        (function (n) {
          later(280 + n * RUSH.gap * 1000, function () {
            var ang = (n / RUSH.hits) * TAU * 1.35 + .6;
            var spot = focus.clone().add(new THREE.Vector3(Math.cos(ang) * 4.4, 0, Math.sin(ang) * 4.4));
            clap(spot.clone().add(new THREE.Vector3(0, 2.4, 0)), .55, false);
            swapFx(spot, focus);
            FX.impact(focus.clone().add(new THREE.Vector3(0, 1.8 + (n % 3) * .8, 0)),
              n % 2 ? HOT : GOLD, 2);
          });
        })(i);
      }
      later(280 + RUSH.hits * RUSH.gap * 1000 + 500, function () {
        FX.flash('#fff3d8', .5, .26);
        FX.rings(new THREE.Vector3(focus.x, .12, focus.z), GOLD, 5, { maxR: 24, life: .8, gap: 40 });
        FX.cracks(new THREE.Vector3(focus.x, .1, focus.z), 20, 26, 0x3a2a18);
        FX.dust(new THREE.Vector3(focus.x, 0, focus.z), 14, 0xd8c8a8, 18, 5);
      });
    },
    br: function (pos, yaw) {
      var d = dirOf(yaw), side = new THREE.Vector3(-d.z, 0, d.x);
      var to = pos.clone().addScaledVector(d, -OUT.range * .7).addScaledVector(side, OUT.range * .6);
      clap(pos.clone().add(new THREE.Vector3(0, 2.4, 0)), .9);
      swapFx(pos.clone(), to);
      arrive(to, 1);
      later(180, function () {
        FX.impact(pos.clone().add(new THREE.Vector3(0, 2, 0)), GOLD, 3);
        FX.rings(pos.clone().add(new THREE.Vector3(0, 1.4, 0)), HOT, 3,
          { maxR: OUT.radius * 1.7, life: .5, ground: false, gap: 34 });
        FX.debris(new THREE.Vector3(pos.x, .1, pos.z), 10, 12, 0x8b7c62);
      });
    }
  };

  /* the pieces the finishers borrow */
  TD.pillar = pillar;
  TD.arrive = arrive;
  TD.marker = markerAt;
  TD.dropMarker = dropMarker;
  TD.GOLD = GOLD; TD.HOT = HOT; TD.EMBER = EMBER;
})();
