/* =======================================================================
   SUKUNA
   What is inside Yuji, when it is allowed out.

   The transformation is not a power-up flash. He goes down first: hands
   on his own head, shaking, losing. The marks crawl up. Then it goes
   quiet — and what stands up is not him. Four eyes, a mouth on his
   cheek, and a grin that belongs to something that has been waiting.

   And then he has the King of Curses' hands:
     1  DISMANTLE        a net of cuts, and what was inside it in pieces
     2  CLEAVE           one cut, on one target, that takes them apart
     3  FUGA             the furnace opened, and an arrow of it loosed
     4  MALEVOLENT SHRINE the shrine, with no barrier, cutting everything

   ===================================================================== */
(function () {
  'use strict';
  if (typeof player === 'undefined' || typeof THREE === 'undefined') return;
  var FX = window.JJFX;
  if (!FX || typeof CHARS === 'undefined' || !CHARS.yuji) return;
  var AN = window.JJANIM;
  var E = FX.ease;
  var TAU = Math.PI * 2;
  var RED = 0xd4143c, BLOOD = 0x8b0f2a, INK = 0x14060a, BONE = 0xe8dcc4;

  var SK = window.JJSUKUNA = { on: false, stage: [], shrine: null };

  function rp(r) { resetPose(r); if (r.body) r.body.rotation.set(0, 0, 0); }
  function W(r, s) { if (AN) AN.weight(r, s, 1); }
  function hud(v) { if (window.JJSTAGE) window.JJSTAGE.hud(v); }

  /* =====================================================================
     THE FACE
     Four eyes and the mouth, kept folded away until he is out.
     ================================================================== */
  function buildFace(r) {
    if (r.sukuna) return r.sukuna;
    var head = r.head;
    if (!head) return null;
    var g = new THREE.Group();
    function flat(w, h, c, x, y, z) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, .05),
        new THREE.MeshBasicMaterial({ color: c, toneMapped: false }));
      m.position.set(x, y, z);
      g.add(m);
      return m;
    }
    /* the second pair, under the first */
    g.eyes = [];
    for (var i = -1; i <= 1; i += 2) {
      var sclera = flat(.22, .14, 0xf4ece0, i * .26, .29, .53);
      var pupil = flat(.09, .11, 0x2a0410, i * .26, .29, .56);
      g.eyes.push(sclera, pupil);
    }
    /* the mouth on his cheek: a seam that opens into teeth */
    var mo = new THREE.Group();
    mo.position.set(-.54, .62, .28);
    mo.rotation.y = .5;
    var gum = new THREE.Mesh(new THREE.BoxGeometry(.36, .3, .06),
      new THREE.MeshBasicMaterial({ color: 0x3a0410, toneMapped: false }));
    mo.add(gum);
    for (var k = 0; k < 5; k++) {
      var tk = new THREE.Mesh(new THREE.BoxGeometry(.05, .09, .07),
        new THREE.MeshBasicMaterial({ color: 0xf2ead8, toneMapped: false }));
      tk.position.set(-.14 + k * .07, .09, .01);
      mo.add(tk);
      var tb = tk.clone();
      tb.position.y = -.09;
      mo.add(tb);
    }
    var tongue = new THREE.Mesh(new THREE.BoxGeometry(.16, .06, .08),
      new THREE.MeshBasicMaterial({ color: 0xa8203c, toneMapped: false }));
    tongue.position.set(0, -.02, .03);
    mo.add(tongue);
    mo.scale.set(1, 0, 1);
    g.add(mo);
    g.mouth = mo;

    /* the marks: they come in one at a time, so it reads as spreading */
    g.strokes = [];
    [[-.3, .8, .53, .36, .09], [.3, .8, .53, .36, .09],
     [-.33, .13, .53, .3, .09], [.33, .13, .53, .3, .09],
     [0, .98, .53, .54, .1], [-.55, .6, .16, .34, .09], [.55, .6, .16, .34, .09]]
      .forEach(function (m) {
        var side = Math.abs(m[0]) > .5;
        var b = new THREE.Mesh(
          side ? new THREE.BoxGeometry(.05, m[4], m[3])
               : new THREE.BoxGeometry(m[3], m[4], .05),
          new THREE.MeshBasicMaterial({ color: INK, toneMapped: false }));
        b.position.set(m[0], m[1], m[2]);
        b.scale[side ? 'z' : 'x'] = 0;
        b.__ax = side ? 'z' : 'x';
        g.add(b);
        g.strokes.push(b);
      });
    head.add(g);

    /* and the same ink down the arms */
    g.limbs = [];
    [r.armL, r.armR, r.foreL, r.foreR].forEach(function (part) {
      if (!part) return;
      for (var j = 0; j < 2; j++) {
        var b = new THREE.Mesh(new THREE.BoxGeometry(.42, .07, .42),
          new THREE.MeshBasicMaterial({ color: INK, transparent: true, opacity: .95, toneMapped: false }));
        b.position.y = -.35 - j * .5;
        b.scale.setScalar(0);
        part.add(b);
        g.limbs.push(b);
      }
    });
    g.visible = false;
    r.sukuna = g;
    return g;
  }
  function faceOf() { return player.rig ? (player.rig.sukuna || buildFace(player.rig)) : null; }

  /* how far out he is: 0 is Yuji, 1 is not */
  function setFace(k) {
    var f = faceOf();
    if (!f) return;
    f.visible = k > 0;
    var n = f.strokes.length, i;
    for (i = 0; i < n; i++) {
      var at = i / n * .7;
      f.strokes[i].scale[f.strokes[i].__ax] = Math.max(0, Math.min(1, (k - at) / .3));
    }
    for (i = 0; i < f.limbs.length; i++) {
      f.limbs[i].scale.setScalar(Math.max(0, Math.min(1, (k - .35 - i * .04) / .3)));
    }
    var open = Math.max(0, Math.min(1, (k - .72) / .28));
    for (i = 0; i < f.eyes.length; i++) f.eyes[i].scale.y = open;
    f.mouth.scale.y = open;
  }

  /* =====================================================================
     THE TRANSFORMATION
     ================================================================== */
  var DUR = 7.4;

  function stepAwaken(a, dt) {
    var p = player, t = a.t;
    a.dur = DUR;
    p.vel.set(0, 0, 0);
    p.iframes = Math.max(p.iframes, .3);

    if (!a.sk) {
      a.sk = 1;
      buildFace(p.rig);
      setFace(0);
      hud(false);
      FX.letterbox(true);
      FX.tint('#12000a', .55, DUR);
      if (AN) AN.camRelease();
      if (p.rig.marks) p.rig.marks.visible = false;
    }

    /* ---- 0.0 it starts winning ---- */
    if (t < 2.4) {
      setFace(Math.max(0, (t - .5) / 2.6));
      if (Math.random() < .9) {
        FX.mote(p.pos.clone().add(new THREE.Vector3(
          (Math.random() - .5) * 1.4, 2.2 + Math.random() * 2, (Math.random() - .5) * 1.4)),
          BLOOD, 6, .5);
      }
      addShake(.12 + t * .16);
      if (t > 1.2 && Math.random() < .1) {
        FX.streaks(p.pos.clone().add(new THREE.Vector3(0, 3.6, 0)), RED, 2, 5, 1.1);
      }
    }
    if (t >= 1.25 && a.sk < 2) {
      a.sk = 2;
      FX.cross(p.pos.clone().add(new THREE.Vector3(0, 4, 0)), RED, 4, .3);
      FX.flash('#2a000e', .55, .28);
      addShake(.7);
      hitstop(.08);
      try { sfx.frame(); } catch (e) {}
    }

    /* ---- 2.4 it pulls in, and everything stops ---- */
    if (t >= 2.4 && a.sk < 3) {
      a.sk = 3;
      setFace(.72);
      FX.converge(p.pos.clone().add(new THREE.Vector3(0, 2.6, 0)), BLOOD, 34, 16, .85);
      FX.zoom(-7, .9);
      try { sfx.raise(); } catch (e) {}
    }
    if (t >= 2.4 && t < 4.1 && Math.random() < .5) {
      FX.mote(p.pos.clone().add(new THREE.Vector3(0, 2.6, 0)), 0x3a0410, 10, .5);
    }

    /* ---- 4.1 the eyes open ---- */
    if (t >= 4.1 && a.sk < 4) {
      a.sk = 4;
      setFace(1);
      hitstop(.2);
      FX.flash('#ff2a4a', .8, .35);
      FX.cross(p.pos.clone().add(new THREE.Vector3(0, 4.2, 0)), 0xffffff, 7, .3);
      FX.impact(p.pos.clone().add(new THREE.Vector3(0, 4.2, 0)), RED, 3.2);
      FX.mangaLines(.9, .4);
      addShake(1.5);
      if (AN) AN.camKick(1.6);
      try { sfx.frame(); } catch (e) {}
    }

    /* ---- 4.9 and the ground finds out ---- */
    if (t >= 4.9 && a.sk < 5) {
      a.sk = 5;
      var at = new THREE.Vector3(p.pos.x, .1, p.pos.z);
      FX.rings(at, RED, 5, { maxR: 26, life: .8, gap: 55 });
      FX.beam(p.pos.clone(), new THREE.Vector3(0, 1, 0), 60, BLOOD, { radius: 2.4, life: 1.2 });
      FX.debris(p.pos.clone(), 20, 18, 0x2a1218);
      FX.cracks(p.pos.clone(), 15, 16, INK);
      FX.dust(at, 16, 3);
      FX.zoom(-13, .8);
      addShake(1.8);
      enemies.forEach(function (e) {
        if (!e || e.dead) return;
        var d = e.pos.distanceTo(p.pos);
        if (d > 22) return;
        var dir = e.pos.clone().sub(p.pos).setY(0).normalize();
        e.damage(14, dir.clone().multiplyScalar(26), { react: 'blow', reactDur: .8, spark: RED });
      });
      if (window.JJAW) {
        window.JJAW.yuji = true;
        window.JJAW.sukuna = true;
        if (!window.JJAW.yujiAura) {
          window.JJAW.yujiAura = FX.aura(function () { return player.pos; }, RED);
        }
        window.JJAW.yujiT = 30;
        swapBar(true);
      }
      if (window.MPJJ && window.MPJJ.relay) {
        window.MPJJ.relay.pub({ t: 'cast', id: window.MPJJ.id, k: 'sukuna' });
      }
    }

    if (t >= DUR - .5 && a.sk < 6) {
      a.sk = 6;
      FX.letterbox(false);
      FX.tint('#12000a', 0);
      hud(true);
      if (window.JJNOTICE) window.JJNOTICE('THE KING OF CURSES', '#ff2a4a');
    }
  }

  function poseAwaken(r, a) {
    rp(r);
    var t = a.t;
    if (t < 2.4) {                                   // both hands on his head
      var k = E.out(Math.min(1, t / 1.1));
      var shiver = Math.sin(t * 34) * .05 * k;
      r.shoulderR.rotation.x = -.3 - 2.5 * k;
      r.shoulderR.rotation.z = -.2 - .5 * k;
      r.elbowR.rotation.x = -.5 - 1.7 * k;
      r.shoulderL.rotation.x = -.3 - 2.5 * k;
      r.shoulderL.rotation.z = .2 + .5 * k;
      r.elbowL.rotation.x = -.5 - 1.7 * k;
      r.spine.rotation.x = .2 + .7 * k + shiver;
      r.spine.rotation.z = shiver * 1.4;
      r.neck.rotation.x = .5 * k - shiver * 2;
      r.hips.position.y = r.hipsBaseY - 1.05 * k;
      r.hipL.rotation.x = -.5 * k; r.hipR.rotation.x = -.3 * k;
      r.kneeL.rotation.x = 1.5 * k; r.kneeR.rotation.x = .8 * k;
      W(r, -.2 * k);
    } else if (t < 4.1) {                            // down, and very still
      var s = E.out(Math.min(1, (t - 2.4) / .8));
      var br = Math.sin(t * 2.4) * .03;
      r.shoulderR.rotation.x = -2.8 + 2.3 * s;
      r.shoulderR.rotation.z = -.7 + .45 * s;
      r.elbowR.rotation.x = -2.2 + 1.5 * s;
      r.shoulderL.rotation.x = -2.8 + 2.3 * s;
      r.shoulderL.rotation.z = .7 - .45 * s;
      r.elbowL.rotation.x = -2.2 + 1.5 * s;
      r.spine.rotation.x = .9 - .25 * s + br;
      r.neck.rotation.x = .5 + .25 * s;              // head hanging
      r.hips.position.y = r.hipsBaseY - 1.05 + .35 * s;
      r.hipL.rotation.x = -.5 + .2 * s; r.hipR.rotation.x = -.3 + .1 * s;
      r.kneeL.rotation.x = 1.5 - .6 * s; r.kneeR.rotation.x = .8 - .3 * s;
      W(r, -.2 + .1 * s);
    } else if (t < 5.6) {                            // up, all at once
      var u = E.out(Math.min(1, (t - 4.1) / .42));
      var snap = t < 4.35 ? (1 - (t - 4.1) / .25) : 0;
      r.shoulderR.rotation.x = -.5 + .32 * u;
      r.shoulderR.rotation.z = -.25 - 1.05 * u;
      r.elbowR.rotation.x = -.7 + .48 * u;
      r.shoulderL.rotation.x = -.5 + .32 * u;
      r.shoulderL.rotation.z = .25 + 1.05 * u;
      r.elbowL.rotation.x = -.7 + .48 * u;
      r.spine.rotation.x = .65 - .95 * u - .12 * snap;
      r.neck.rotation.x = .75 - 1.15 * u;            // chin up
      r.hips.position.y = r.hipsBaseY - .7 + .82 * u;
      r.hipL.rotation.x = -.3 + .3 * u; r.hipR.rotation.x = -.2 + .2 * u;
      r.kneeL.rotation.x = .9 - .8 * u; r.kneeR.rotation.x = .5 - .45 * u;
      W(r, 0);
    } else {                                         // and stands like he owns it
      var v = E.out(Math.min(1, (t - 5.6) / .9));
      var idle = Math.sin(t * 1.6) * .04;
      r.shoulderR.rotation.x = -1.05 + .75 * v;
      r.shoulderR.rotation.z = -1.1 + .82 * v;
      r.elbowR.rotation.x = -1.2 + .75 * v;
      r.shoulderL.rotation.x = -1.05 + .8 * v;
      r.shoulderL.rotation.z = 1.1 - .78 * v;
      r.elbowL.rotation.x = -1.2 + .8 * v;
      r.spine.rotation.x = -.3 + .28 * v + idle;
      r.spine.rotation.y = -.18 * v;
      r.neck.rotation.x = -.4 + .34 * v;
      r.neck.rotation.y = .2 * v;
      r.hips.position.y = r.hipsBaseY + .12 - .12 * v;
      W(r, .2 * v);
    }
  }

  function awakenCamera(a, dt) {
    var p = player, t = a.t, face = p.facing;
    /* he spends most of this on his knees, so the frame follows the head
       rather than a height that stops being true */
    var h = p.rig.head ? p.rig.head.localToWorld(new THREE.Vector3(0, .58, 0))
      : p.pos.clone().add(new THREE.Vector3(0, 4.4, 0));
    var marks = [
      { t: 0, yaw: .55, d: 8.5, up: 1.3, k: 16 },
      { t: 1.0, yaw: .95, d: 3.4, up: -.8, k: 22 },    // low, at what is left of him
      { t: 2.4, yaw: 1.55, d: 2.9, up: -.5, k: 24 },
      { t: 3.6, yaw: .22, d: 2.7, up: .1, k: 20 },    // waiting on it
      { t: 4.1, yaw: .1, d: 2.5, up: .06, k: 48 },    // the eyes
      { t: 4.55, yaw: .06, d: 2.3, up: .04, k: 40 },
      { t: 4.9, yaw: -.5, d: 7.5, up: 1.3, k: 15 },
      { t: 6.0, yaw: -.28, d: 10.5, up: 1.7, k: 13 },
      { t: DUR, yaw: -.12, d: 8.5, up: 1.4, k: 14 }
    ];
    var i = 0;
    while (i < marks.length - 1 && t >= marks[i + 1].t) i++;
    var m0 = marks[i], m1 = marks[Math.min(i + 1, marks.length - 1)];
    var k = m1 === m0 ? 0 : E.out(Math.min(1, (t - m0.t) / Math.max(.001, m1.t - m0.t)));
    function mix(f) { return m0[f] + (m1[f] - m0[f]) * k; }
    var yaw = face + mix('yaw'), d = mix('d');
    if (AN) {
      AN.camTo(h.x + Math.sin(yaw) * d, h.y + mix('up'), h.z + Math.cos(yaw) * d,
        h.x, h.y, h.z, dt, mix('k'));
    }
    shakeMag = Math.max(0, shakeMag - dt * 2);
  }

  /* =====================================================================
     THE FOUR
     ================================================================== */
  var CD = { s1: 6, s2: 9, s3: 12, s4: 26 };
  cds.s1 = 0; cds.s2 = 0; cds.s3 = 0; cds.s4 = 0;

  function awake() { return window.JJAW && window.JJAW.yuji && player.char === 'yuji'; }
  function ok(key) {
    return awake() && !player.dead && !busy() && cds[key] <= 0;
  }
  function begin(type, dur, key, name, sub) {
    cds[key] = CD[key];
    var a = player.action = { type: type, t: 0, dur: dur, stage: 0 };
    if (name) { try { showSplash(name, sub || '', '#ff2a4a'); } catch (e) {} }
    if (window.MPJJ && window.MPJJ.relay) {
      window.MPJJ.relay.pub({ t: 'cast', id: window.MPJJ.id, k: type });
    }
    return a;
  }
  function fwd() { return new THREE.Vector3(Math.sin(player.facing), 0, Math.cos(player.facing)); }
  function targets(range, halfWidth) {
    var d = fwd(), out = [];
    enemies.forEach(function (e) {
      if (!e || e.dead) return;
      var rel = e.pos.clone().sub(player.pos);
      var along = rel.dot(d);
      if (along < -1 || along > range) return;
      var side = Math.abs(rel.clone().addScaledVector(d, -along).setY(0).length());
      if (side > halfWidth) return;
      out.push(e);
    });
    return out;
  }

  /* the cut itself: a line drawn in the air that leaves a mark */
  function cut(at, angle, size, color) {
    var m = FX.billboard(FX.T.slash, color == null ? 0xffffff : color, 1);
    m.position.copy(at);
    m.scale.set(size, size * .5, 1);
    scene.add(m);
    var life = .22, t = 0;
    addFx({ t: life, update: function (d) {
      this.t -= d; t += d;
      FX.faceCam(m, angle);
      var k = t / life;
      m.scale.set(size * (1 + k * .5), size * .5 * (1 - k * .6), 1);
      m.material.opacity = 1 - k;
      if (this.t <= 0) { scene.remove(m); m.material.dispose(); return false; }
      return true;
    } });
  }

  /* -------------------------------------------------- 1 · DISMANTLE
     Not one cut. The slashes are woven into a net across the whole of the
     space in front of him — the ways out as much as whoever is standing in
     it — and any one line of that net is survivable. Everything caught in
     all of them at once is not: a beat after the weave closes, what was
     inside comes apart along the lines. Anything with little enough left
     goes into the pieces the net cut it into, and they stay on the floor.
     ================================================================== */
  var DIS = { range: 36, half: 12, high: 15 };

  /* below this, a body caught in the net does not survive to fall over */
  function lowEnough(e) {
    return e && !e.dead && e.hp <= Math.max(30, (e.maxHp || 100) * .32);
  }

  /* taken apart along the lines rather than knocked down */
  function cutApart(e, dir) {
    if (!e || e.dead) return false;
    if (window.JJGORE && window.JJGORE.isHeld(e)) return false;   // a finisher owns them
    var kb = dir.clone().multiplyScalar(11); kb.y = 6;
    e.damage(9999, kb, {
      react: 'dismantle', reactDur: .5, spark: 0xffffff, death: 'dice',
      color: '#ff2a4a', noFrameBonus: true, bleed: true
    });
    return true;
  }

  /* the net itself, with nothing behind it. Every client in the room plays
     this — the caster's, and everybody watching them do it. */
  function weaveFx(from, d) {
    var side = new THREE.Vector3(d.z, 0, -d.x).normalize();
    var i;
    /* three planes of it at different depths, so it reads as a volume of
       cuts rather than a curtain — and the far one is the widest, because
       the net is thrown rather than drawn */
    [8, 18, 29].forEach(function (dist, n) {
      var c = from.clone().addScaledVector(d, dist).add(new THREE.Vector3(0, 6.2, 0));
      FX.lattice(c, d, DIS.half * 2 + n * 3, DIS.high + n * 2,
        7 - n, 5 - n, n === 1 ? RED : 0xffffff,
        { stagger: 14, life: .6, width: .4 + n * .08 });
    });
    /* and the same grid put through the floor */
    var g0 = from.clone().addScaledVector(d, 3);
    for (i = -3; i <= 3; i++) {
      var lane = g0.clone().addScaledVector(side, i * (DIS.half / 3));
      FX.cutLine(new THREE.Vector3(lane.x, .18, lane.z),
        lane.clone().addScaledVector(d, DIS.range).setY(.18), INK, .5, .7);
    }
    for (i = 1; i <= 6; i++) {
      var rung = g0.clone().addScaledVector(d, i * (DIS.range / 6));
      FX.cutLine(rung.clone().addScaledVector(side, -DIS.half).setY(.18),
        rung.clone().addScaledVector(side, DIS.half).setY(.18), INK, .5, .7);
    }
    FX.cross(from.clone().addScaledVector(d, 6).add(new THREE.Vector3(0, 4, 0)), 0xffffff, 6, .2);
    FX.mangaLines(.7, .3);
    addShake(.9);
    try { sfx.slash(); } catch (e) {}
  }

  /* and what the net leaves behind, wherever it closed */
  function unravelFx(from, d) {
    var side = new THREE.Vector3(d.z, 0, -d.x).normalize();
    FX.flash('#ffffff', .45, .18);
    for (var i = 1; i <= 7; i++) {
      var q = from.clone().addScaledVector(d, i * (DIS.range / 7))
        .addScaledVector(side, (Math.random() - .5) * DIS.half);
      FX.cracks(q, 5 + Math.random() * 3, 6 + Math.random() * 4, INK);
    }
    addShake(1.3);
    try { sfx.sever(); } catch (e) {}
  }

  function castDismantle() {
    if (!ok('s1')) return;
    begin('s1', 1.25, 's1', 'DISMANTLE', '解');
    player.iframes = Math.max(player.iframes, .3);
  }

  function stepDismantle(a, dt) {
    var p = player, d = fwd();

    /* ---- the weave ---- */
    if (a.t >= .18 && a.stage < 1) {
      a.stage = 1;
      weaveFx(p.pos, d);
      if (AN) AN.camKick(.9);
      FX.zoom(-6, .35);

      /* the weave barely moves anybody: it is a hundred small cuts */
      targets(DIS.range, DIS.half).forEach(function (e) {
        var kb = e.pos.clone().sub(p.pos).setY(0).normalize().multiplyScalar(6);
        e.damage(9 + Math.random() * 4, kb,
          { react: 'slash', reactDur: .35, spark: 0xffffff, bleed: true });
      });
    }

    /* ---- and then everything inside it comes apart ---- */
    if (a.t >= .72 && a.stage < 2) {
      a.stage = 2;
      hitstop(.09);
      var caught = targets(DIS.range, DIS.half);
      caught.forEach(function (e) {
        var dir = e.pos.clone().sub(p.pos).setY(0);
        if (dir.lengthSq() < .01) dir.copy(d);
        dir.normalize();
        var at = e.pos.clone().add(new THREE.Vector3(0, 2.8, 0));
        /* the lines it was caught in, drawn on the body itself */
        FX.lattice(at, d, 3.4, 5, 3, 3, 0xffffff, { stagger: 0, life: .32, width: .3 });
        FX.blood(at, dir.clone().setY(.4), 8, 1.2);
        if (lowEnough(e)) { cutApart(e, dir); return; }
        e.damage(27 + Math.random() * 7, dir.clone().multiplyScalar(13).setY(5),
          { react: 'dismantle', reactDur: .6, spark: RED, death: 'dice', bleed: true });
      });
      /* the ground it was thrown across goes the same way */
      unravelFx(p.pos, d);
      if (caught.length && window.JJAW) window.JJAW.gain(10);
    }
  }

  /* ------------------------------------------------------ 2 · CLEAVE */
  function castCleave() {
    if (!ok('s2')) return;
    begin('s2', 1.15, 's2', 'CLEAVE', '\u634c');
    player.iframes = Math.max(player.iframes, .45);
  }
  function stepCleave(a, dt) {
    var p = player;
    if (!a.mark) {
      var best = null, bd = 1e9;
      enemies.forEach(function (e) {
        if (!e || e.dead) return;
        var dd = e.pos.distanceTo(p.pos);
        if (dd < bd && dd < 22) { bd = dd; best = e; }
      });
      a.mark = best || 1;
      if (best) {
        p.facing = Math.atan2(best.pos.x - p.pos.x, best.pos.z - p.pos.z);
        FX.zoom(-6, .5);
      }
    }
    var tgt = a.mark && a.mark !== 1 ? a.mark : null;
    if (a.t < .4 && tgt) {                          // step onto them
      var to = tgt.pos.clone().sub(p.pos).setY(0);
      var want = Math.max(0, to.length() - 3.2);
      if (want > .1) p.pos.addScaledVector(to.normalize(), Math.min(want, dt * 26));
    }
    if (a.t >= .42 && a.stage < 1) {
      a.stage = 1;
      var at = tgt ? tgt.pos.clone().add(new THREE.Vector3(0, 2.8, 0))
        : p.pos.clone().addScaledVector(fwd(), 4).add(new THREE.Vector3(0, 2.8, 0));
      hitstop(.14);
      FX.flash('#ffffff', .5, .16);
      cut(at, .35, 13, 0xffffff);
      cut(at, -.45, 11, RED);
      cut(at, 1.5, 9, 0xffffff);
      FX.cross(at, 0xffffff, 6, .26);
      FX.impact(at, RED, 3);
      FX.heavyHit(at, RED, 1.2);
      FX.mangaLines(.85, .35);
      FX.debris(at, 14, 13, 0x2a1218);
      addShake(1.5);
      if (AN) AN.camKick(1.5);
      if (tgt) {
        var kb = tgt.pos.clone().sub(p.pos).setY(0).normalize().multiplyScalar(30);
        kb.y = 12;
        /* one cut, adjusted to whatever is in front of it. If there is not
           enough of them left to adjust to, it goes straight through. */
        if (lowEnough(tgt)) {
          FX.cutLine(at.clone().add(new THREE.Vector3(-4, 2.4, 0)),
            at.clone().add(new THREE.Vector3(4, -2.4, 0)), 0xffffff, 1.1, .4);
          cutApart(tgt, kb.clone().setY(0).normalize());
        } else {
          tgt.damage(46, kb, {
            react: 'slash', reactDur: 1, spark: 0xffffff, ragdoll: true,
            death: 'sever', bleed: true
          });
          if (window.JJRAG && tgt.hp > 0) {
            try { window.JJRAG.start(tgt, kb.clone().multiplyScalar(.5), 1.2); } catch (e) {}
          }
        }
        if (window.JJAW) window.JJAW.gain(14);
      }
      FX.cracks(new THREE.Vector3(at.x, .1, at.z), 12, 14, INK);
      try { sfx.slash(); } catch (e) {}
    }
  }

  /* ------------------------------------------------------- 3 · FUGA
     The Divine Flame is not a beam. It is an arrow.

     He opens the furnace — 竈 — and the fire that comes out of it is
     drawn into a shape: a head, a shaft, and the fletching behind it.
     Then it is loosed, and it goes where it was pointed, slowly enough
     to watch and hot enough that whatever it reaches is not put out
     afterwards. It leaves the ground burning behind it in a line.

     So: gather, form, draw back, loose, and a body of fire travelling
     down the arena rather than a line of light that is already at the
     other end.
     ================================================================== */
  var FUGA = { charge: 1.15, speed: 42, range: 78, radius: 7.4 };

  function castFlame() {
    if (!ok('s3')) return;
    begin('s3', 2.4, 's3', 'FUGA', '竈 · DIVINE FLAME');
    player.iframes = Math.max(player.iframes, 1);
  }

  /* the arrow itself: a head, a shaft, four flights, and the fire that is
     all of it held together */
  function buildArrow() {
    var g = new THREE.Group();
    function hot(geo, color, opacity) {
      var m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        color: color, transparent: opacity != null, opacity: opacity == null ? 1 : opacity,
        toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false
      }));
      g.add(m);
      return m;
    }
    /* the head: a long spike, with a white core inside the fire of it */
    var head = hot(new THREE.ConeGeometry(3.4, 12, 4), 0xffd08a);
    head.rotation.x = Math.PI / 2;
    head.position.z = 8.6;
    var core = hot(new THREE.ConeGeometry(2, 10.6, 4), 0xffffff);
    core.rotation.x = Math.PI / 2;
    core.position.z = 8.9;
    /* the shaft */
    var shaft = hot(new THREE.CylinderGeometry(1.5, 2.2, 17, 10), 0xff6a1e);
    shaft.rotation.x = Math.PI / 2;
    shaft.position.z = -3.5;
    var shaftCore = hot(new THREE.CylinderGeometry(.68, 1, 17.6, 8), 0xffe6b4);
    shaftCore.rotation.x = Math.PI / 2;
    shaftCore.position.z = -3.5;
    /* the flights, which are the part that makes it read as an arrow */
    for (var i = 0; i < 4; i++) {
      var f = hot(new THREE.PlaneGeometry(5.8, 8.4), 0xff8a2a, .92);
      f.position.z = -10.6;
      f.rotation.z = i * Math.PI / 4;
      f.rotation.y = i % 2 ? Math.PI / 2 : 0;
      f.material.side = THREE.DoubleSide;
    }
    /* the black the flame carries in the middle of it */
    var soot = hot(new THREE.CylinderGeometry(2.6, 3, 14, 8), 0x1a0402, .55);
    soot.rotation.x = Math.PI / 2;
    soot.position.z = -2.2;
    soot.material.blending = THREE.NormalBlending;
    g.__soot = soot;
    return g;
  }

  function aimArrow(g, from, dir) {
    g.position.copy(from);
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.clone().normalize());
  }

  /* It flies. Everything it passes burns, and the ground under it stays lit.
     `ghost` is the copy every other client in the room flies: same arrow,
     same trench, same detonation, and not a point of damage — the hits
     travel as their own messages, the way every other hit does. */
  function loose(from, dir, ghost) {
    var g = buildArrow();
    scene.add(g);
    aimArrow(g, from, dir);
    var travelled = 0, hitList = [], t = 0, trail = 0;
    var lamp = FX.orb ? null : null;
    addFx({ t: 6, update: function (dt) {
      this.t -= dt; t += dt;
      var step = FUGA.speed * dt;
      travelled += step;
      g.position.addScaledVector(dir, step);
      g.rotation.z += dt * 2.2;
      var wob = 1 + Math.sin(t * 24) * .05;
      g.scale.set(wob, wob, 1 + Math.sin(t * 17) * .04);
      if (g.__soot) g.__soot.material.opacity = .35 + Math.random() * .3;

      /* the fire coming off it */
      trail += dt;
      if (trail > .02) {
        trail = 0;
        FX.flame(g.position.clone().addScaledVector(dir, -7 - Math.random() * 7)
          .add(new THREE.Vector3((Math.random() - .5) * 5, (Math.random() - .5) * 5, (Math.random() - .5) * 5)),
          4.5 + Math.random() * 4, .55 + Math.random() * .4);
        FX.flame(g.position.clone().add(new THREE.Vector3(
          (Math.random() - .5) * 4, (Math.random() - .5) * 4, (Math.random() - .5) * 4)),
          3.4 + Math.random() * 3, .35);
        FX.streaks(g.position.clone().addScaledVector(dir, -8), 0xffc46a, 2, 15, 1.5);
      }
      /* and the line it burns into the ground under itself */
      if (Math.random() < dt * 26) {
        var floor = new THREE.Vector3(g.position.x, 0, g.position.z);
        FX.scorch(floor, 3.4 + Math.random() * 2.4, 16);
        FX.fire(floor.clone().add(new THREE.Vector3(0, .4, 0)), 3, 2.4, 2.6, .8);
      }

      /* whatever it reaches, it does not reach twice */
      if (!ghost) enemies.forEach(function (e) {
        if (!e || e.dead || hitList.indexOf(e) >= 0) return;
        if (e.pos.clone().add(new THREE.Vector3(0, 2.4, 0)).distanceTo(g.position) > FUGA.radius) return;
        hitList.push(e);
        var kb = dir.clone().multiplyScalar(26); kb.y = 10;
        e.damage(64, kb, {
          react: 'burn', reactDur: 1.3, spark: 0xff8a3a, color: '#ff9a4a',
          death: 'burn', ragdoll: true
        });
        FX.fire(e.pos.clone().add(new THREE.Vector3(0, 2.4, 0)), 12, 1.6, 3.4, 1);
        FX.impact(e.pos.clone().add(new THREE.Vector3(0, 2.6, 0)), 0xffb070, 2.6);
        hitstop(.06);
        addShake(1);
        if (window.JJAW) window.JJAW.gain(16);
      });
      var done = travelled >= FUGA.range || this.t <= 0;
      if (!done) return true;
      /* it goes off where it stops */
      var at = g.position.clone();
      FX.flash('#ffb070', .7, .5);
      FX.impact(at, 0xffd08a, 5.5);
      FX.fire(at, 26, 5, 6, 1.5);
      FX.rings(at, 0xff8a3a, 4, { maxR: 30, life: .8, ground: false, gap: 60 });
      FX.ring(new THREE.Vector3(at.x, .2, at.z), 0xffb070, { maxR: 34, life: .9 });
      FX.debris(new THREE.Vector3(at.x, 0, at.z), 18, 20, 0x2a1008);
      FX.cracks(new THREE.Vector3(at.x, 0, at.z), 9, 15, 0x2a1008);
      FX.scorch(new THREE.Vector3(at.x, 0, at.z), 13, 40);
      FX.mangaLines(1, .4);
      FX.zoom(12, .6);
      addShake(2.2);
      if (AN) AN.camKick(2);
      try { sfx.blast(); } catch (e) {}
      if (!ghost) enemies.forEach(function (e) {
        if (!e || e.dead || hitList.indexOf(e) >= 0) return;
        if (e.pos.distanceTo(at) > 16) return;
        var kb = e.pos.clone().sub(at).setY(0).normalize().multiplyScalar(24); kb.y = 12;
        e.damage(38, kb, { react: 'burn', reactDur: 1.1, spark: 0xff8a3a, death: 'burn' });
        FX.fire(e.pos.clone().add(new THREE.Vector3(0, 2, 0)), 8, 1.4, 3, .9);
      });
      scene.remove(g);
      g.traverse(function (o) { if (o.isMesh) o.material.dispose(); });
      return false;
    } });
  }

  function stepFlame(a, dt) {
    var p = player, d = fwd();
    var palm = p.pos.clone().addScaledVector(d, 1.6).add(new THREE.Vector3(0, 3, 0));

    /* ---- the furnace opens ---- */
    if (a.t < FUGA.charge) {
      var k = a.t / FUGA.charge;
      if (Math.random() < .95) FX.mote(palm, 0xff5a2a, 5 + k * 4, .3);
      if (Math.random() < .5) FX.flame(palm.clone().add(new THREE.Vector3(
        (Math.random() - .5) * 2, (Math.random() - .5) * 2, (Math.random() - .5) * 2)),
        1 + Math.random() * 1.6, .35);
      if (!a.arrow) {
        a.arrow = buildArrow();
        scene.add(a.arrow);
        SK.stage.push(a.arrow);
        FX.converge(palm, 0xff8a3a, 30, 14, .9);
        FX.flash('#ff9a4a', .3, .3);
        try { sfx.fire(); } catch (e) {}
      }
      /* it forms in front of him and is drawn back onto the hand */
      var out = 9 - E.out(k) * 5.5;
      aimArrow(a.arrow, palm.clone().addScaledVector(d, out), d);
      var grow = .25 + E.out(Math.min(1, k * 1.3)) * .95;
      a.arrow.scale.setScalar(grow);
      addShake(.2 + k * .5);
      /* the ground in front of him is already alight */
      if (Math.random() < dt * 14) {
        FX.fire(p.pos.clone().addScaledVector(d, 3 + Math.random() * 8).setY(.2), 2, 1.6, 2, .6);
      }
    }

    /* ---- and it is loosed ---- */
    if (a.t >= FUGA.charge && a.stage < 1) {
      a.stage = 1;
      if (a.arrow) {
        var i = SK.stage.indexOf(a.arrow);
        if (i >= 0) SK.stage.splice(i, 1);
        scene.remove(a.arrow);
        a.arrow.traverse(function (o) { if (o.isMesh) o.material.dispose(); });
        a.arrow = null;
      }
      loose(palm.clone().addScaledVector(d, 4), d.clone());
      FX.flash('#ffd8a0', .55, .3);
      FX.cross(palm, 0xffffff, 7, .24);
      FX.rings(palm, 0xff8a3a, 3, { maxR: 12, life: .5, ground: false, gap: 40 });
      FX.mangaLines(.9, .35);
      FX.zoom(-10, .5);
      addShake(1.6);
      if (AN) AN.camKick(1.6);
      hitstop(.07);
      /* it goes forward, so he goes back */
      p.vel.addScaledVector(d, -9);
      try { sfx.blast(); } catch (e) {}
    }
  }

  /* -------------------------------------------- 4 · MALEVOLENT SHRINE
     伏魔御廚子.

     A Buddhist shrine, built out of the things a shrine is not built out
     of. Ox skulls hold the platform up, mouths open. The roof is hip and
     gable: a hipped skirt, a gabled ridge over it, horns coming out of
     the ridge, human skulls hanging off the eaves and a pair of small
     closed mouths in each gable. The ceiling over the yard is a ribcage.
     The four ways in are four mouths, with human teeth and a tongue
     rolled out through them.

     And it has no barrier. Every other domain shuts a space off and
     works inside it; this one is put down in the space that was already
     there — which is the vow that buys its sure-hit a radius most
     domains could not dream of. So the city stays exactly where it is:
     you can see it through the ribs, and the cuts fall on everything
     inside the radius whether it is standing in the shrine or not.

     Which is why the camera is only borrowed for the opening. After that
     it is handed back and the shrine is simply somewhere you are now
     fighting, and it keeps cutting for as long as it stands.
     ================================================================== */
  var SHRINE = { r: 62, dur: 13.5, open: 4.8 };

  function castShrine() {
    if (!ok('s4')) return;
    begin('s4', SHRINE.open, 's4', 'MALEVOLENT SHRINE', '伏魔御廚子');
    player.iframes = Math.max(player.iframes, SHRINE.open);
    FX.letterbox(true);
    hud(false);
  }

  /* `yaw` and `into` are here so the same shrine can be built by somebody
     who is not the caster: every other client in the room builds its own
     copy of it, at the position and facing that came down the wire. */
  function buildShrine(center, yaw, into) {
    var g = new THREE.Group();
    var i, s, q;
    function bone(w, h, d, c) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({ color: c == null ? BONE : c, roughness: .85 }));
      m.castShadow = true; m.receiveShadow = true;
      g.add(m);
      return m;
    }
    function part(parent, w, h, d, c) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({ color: c == null ? BONE : c, roughness: .85 }));
      m.castShadow = true;
      parent.add(m);
      return m;
    }

    /* ---------------------------------------------------- the platform */
    var base = bone(64, 1.8, 64, 0x3d2b32);
    base.position.y = -.9;
    for (s = 0; s < 3; s++) {
      var step = bone(64 - s * 7, .9, 64 - s * 7, s % 2 ? 0x594049 : 0x46323a);
      step.position.y = .45 + s * .9;
    }
    var yard = bone(44, .5, 44, 0x33232b);
    yard.position.y = 2.9;

    /* ---- the ox skulls the platform stands on ----
       Long muzzles, horns out sideways, and the jaw hanging open. */
    function oxSkull(x, z, yaw, scale) {
      var o = new THREE.Group();
      o.position.set(x, 1.1, z);
      o.rotation.y = yaw;
      o.scale.setScalar(scale || 1);
      var cranium = part(o, 4.4, 3.6, 3.6, 0xd8cbb0);
      cranium.position.y = 1.9;
      var muzzle = part(o, 2.9, 2.4, 4.4, 0xe4d8be);
      muzzle.position.set(0, 1.2, 3.1);
      var jaw = part(o, 2.7, 1.1, 4.2, 0xcabda2);   // hanging open
      jaw.position.set(0, -.5, 3.4);
      jaw.rotation.x = -.22;
      for (var t = 0; t < 5; t++) {                 // the teeth in between
        var tt = part(o, .34, .8, .34, 0xf2ead8);
        tt.position.set(-.9 + t * .45, .3, 4.4 + (t % 2) * .2);
      }
      for (var h = -1; h <= 1; h += 2) {            // and the horns
        var horn = part(o, .7, .7, 4.2, 0x3a2f28);
        horn.position.set(h * 2.9, 3, .4);
        horn.rotation.z = h * .5;
        horn.rotation.x = .3;
        var tip = part(o, .5, .5, 2.6, 0x2a221d);
        tip.position.set(h * 4.4, 3.9, 2);
        tip.rotation.z = h * .9;
        tip.rotation.x = .8;
      }
      for (var e = -1; e <= 1; e += 2) {            // sockets, lit from inside
        var sock = part(o, 1.1, 1.2, .4, 0x140208);
        sock.position.set(e * 1.2, 2.2, 1.9);
        var glow = FX.billboard(FX.T.star, RED, .9);
        glow.scale.setScalar(2.4);
        glow.position.set(e * 1.2, 2.2, 2.2);
        o.add(glow);
      }
      g.add(o);
      return o;
    }
    for (i = 0; i < 8; i++) {
      var a = i / 8 * TAU + Math.PI / 8;
      oxSkull(Math.cos(a) * 27, Math.sin(a) * 27, -a + Math.PI / 2, 1);
    }

    /* ---------------------------------- the four mouths you walk in by */
    function mouth(dirX, dirZ, yaw) {
      var m = new THREE.Group();
      m.position.set(dirX * 22, 3.2, dirZ * 22);
      m.rotation.y = yaw;
      var gumTop = part(m, 15, 3.2, 3.4, 0x6a0c1c);
      gumTop.position.y = 12.4;
      var gumBot = part(m, 15, 2.6, 3.4, 0x54081a);
      gumBot.position.y = .6;
      var back = part(m, 14, 10, .8, 0x140208);      // the dark behind it
      back.position.set(0, 6.4, -1.6);
      for (var t = 0; t < 7; t++) {                  // human teeth, top and bottom
        var x = -5.4 + t * 1.8;
        var up = part(m, 1.35, 2.9 - (t % 2) * .5, 1.35, 0xf2ead8);
        up.position.set(x, 9.6, .5);
        var dn = part(m, 1.3, 2.5 - (t % 2) * .4, 1.3, 0xece2cc);
        dn.position.set(x + .3, 3.1, .5);
      }
      /* and a tongue, rolled out through it and onto the ground */
      var tongue = part(m, 6.4, .7, 12, 0xa8203c);
      tongue.position.set(0, 2.1, 6);
      tongue.rotation.x = .16;
      var tip = part(m, 4.6, .6, 4, 0xb52a44);
      tip.position.set(0, 1.1, 12.4);
      tip.rotation.x = .3;
      g.add(m);
      return m;
    }
    mouth(0, 1, 0);
    mouth(0, -1, Math.PI);
    mouth(1, 0, Math.PI / 2);
    mouth(-1, 0, -Math.PI / 2);

    /* --------------------------------------------- the pillars and beams */
    for (i = 0; i < 4; i++) {
      q = i / 4 * TAU + Math.PI / 4;
      var post = bone(2.6, 22, 2.6, 0x8b1226);
      post.position.set(Math.cos(q) * 21, 14, Math.sin(q) * 21);
    }
    var plate = bone(46, 1.8, 46, 0x6a0c1c);
    plate.position.y = 25.4;

    /* ------------------------------------------- the ribcage over the yard
       Pairs of ribs arching across it and meeting at a spine that runs the
       length of it, hung under the plate rather than in the roof — so from
       inside the yard, which is where the fight is, the ceiling is a chest.
       ================================================================== */
    var spineBeam = bone(2.2, 2.2, 50, 0xe0d4ba);
    spineBeam.position.y = 24.2;
    for (i = 0; i < 7; i++) {
      var z = -21 + i * 7;
      var span = 21 - Math.abs(i - 3) * 1.7;
      for (var sgn = -1; sgn <= 1; sgn += 2) {
        for (var seg = 0; seg < 6; seg++) {
          var th = seg / 5 * (Math.PI / 2);
          var rib = bone(1.5, 1.5, 2.2, seg % 2 ? 0xe8dcc4 : 0xd6c9ad);
          /* one quarter turn from the spine at the top down to the eaves */
          rib.position.set(sgn * Math.sin(th) * span, 23.8 - (1 - Math.cos(th)) * 11.4, z);
          rib.rotation.z = -sgn * th;
          rib.scale.y = 1 + seg * .12;
        }
      }
    }

    /* --------------------------------- the hipped skirt, and then the gable
       Narrower than the platform, so from anywhere above it the skulls and
       the mouths are still in shot instead of under a lid. */
    for (i = 0; i < 5; i++) {
      var w = 46 - i * 5;
      var tier = bone(w, 1.5, w, i % 2 ? 0x6e2029 : 0x54171f);
      tier.position.y = 26.6 + i * 1.5;
    }
    for (i = 0; i < 7; i++) {
      var gw = 26 - i * 3.4;
      var ridge = bone(gw, 1.4, 26 - i * .6, i % 2 ? 0x7a2530 : 0x5e1a23);
      ridge.position.y = 34.2 + i * 1.4;
    }
    var ridgeBeam = bone(4, 1.6, 30, 0x8b1226);
    ridgeBeam.position.y = 44.4;

    /* the horns, out of each end of the ridge and curling up and away */
    for (i = 0; i < 4; i++) {
      var hs = i % 2 ? 1 : -1, hz = (i < 2 ? 1 : -1) * 12;
      var horn = bone(2.2, 11, 2.2, 0x2a221d);
      horn.position.set(hs * 3.4, 49.4, hz);
      horn.rotation.z = hs * .34;
      horn.rotation.x = -hz * .022;
      var htip = bone(1.5, 8, 1.5, 0x1a1512);
      htip.position.set(hs * 8.4, 56.4, hz * 1.24);
      htip.rotation.z = hs * .82;
      htip.rotation.x = -hz * .04;
    }

    /* the two closed mouths in each gable, and the face between them */
    for (var side = -1; side <= 1; side += 2) {
      for (var mi = 0; mi < 2; mi++) {
        var lip = bone(6.4, .9, .8, 0x8b1226);
        lip.position.set(-5 + mi * 10, 39.6, side * 13.4);
        var lip2 = bone(6.4, .9, .8, 0x6a0c1c);
        lip2.position.set(-5 + mi * 10, 38.5, side * 13.4);
        var seam = bone(6.6, .22, .9, 0x140208);
        seam.position.set(-5 + mi * 10, 39.05, side * 13.6);
      }
    }

    /* the skull in the gable, which is the thing looking at you */
    var head = new THREE.Group();
    head.position.set(0, 36.4, -14);
    var cranium2 = part(head, 12, 10, 9, BONE);
    var jaw2 = part(head, 10.4, 3.4, 7.4, 0xd8c9ad);
    jaw2.position.set(0, -6.2, .6);
    for (i = -1; i <= 1; i += 2) {
      var socket = part(head, 3.4, 3.6, .8, 0x180208);
      socket.position.set(i * 3, 1.4, 4.6);
      var glow2 = FX.billboard(FX.T.star, RED, .95);
      glow2.scale.setScalar(6.5);
      glow2.position.set(i * 3, 1.4, 5.4);
      head.add(glow2);
    }
    for (i = 0; i < 7; i++) {
      var t2 = part(head, 1, 1.8, .9, 0xf0e6d0);
      t2.position.set(-3 + i * 1, -4.6, 4.2);
    }
    g.add(head);
    g.skull = head;

    /* the skulls hanging off the eaves, on their cords */
    for (i = 0; i < 16; i++) {
      var ha = i / 16 * TAU;
      var hx2 = Math.cos(ha) * 21.4, hz2 = Math.sin(ha) * 21.4;
      var cord = bone(.16, 3.4, .16, 0x2a2028);
      cord.position.set(hx2, 26, hz2);
      var sk = bone(1.9, 2, 1.9, 0xe4d8be);
      sk.position.set(hx2, 23.4, hz2);
      sk.rotation.y = ha;
      var jaw3 = bone(1.5, .8, 1.4, 0xd0c2a6);
      jaw3.position.set(hx2, 22.1, hz2 + .1);
      var eye = bone(1.5, .55, .2, 0x180208);
      eye.position.set(hx2 * 1.05, 23.6, hz2 * 1.05);
      eye.rotation.y = -ha;
    }

    /* ------------------------------------------------------- the light
       No barrier means no sky of its own: the city's own sky stays. This
       is only the light the shrine throws on what is under it. */
    var lamp = new THREE.PointLight(0xffa060, 4.6, 240, 1.1);
    lamp.position.set(0, 26, 0);
    g.add(lamp);
    var lamp2 = new THREE.PointLight(0xff5a3a, 3.4, 180, 1.2);
    lamp2.position.set(0, 34, -14);
    g.add(lamp2);
    g.add(new THREE.AmbientLight(0x7a4a48, 1.4));

    /* braziers around the yard */
    for (var b = 0; b < 4; b++) {
      var bx = (b % 2 ? 1 : -1) * 15, bz = (b < 2 ? 1 : -1) * 15;
      var bowl = bone(2.6, 1.8, 2.6, 0x3a2c2c);
      bowl.position.set(bx, 4.2, bz);
      var fireS = FX.billboard(FX.T.flame, 0xff8a3a, .95);
      fireS.scale.set(4, 6, 1);
      fireS.position.set(bx, 7.4, bz);
      g.add(fireS);
      if (!g.fires) g.fires = [];
      g.fires.push(fireS);
    }

    g.position.copy(center);
    g.rotation.y = yaw == null ? player.facing : yaw;
    g.position.y -= 46;                              // it comes up out of the ground
    scene.add(g);
    (into || SK.stage).push(g);
    return g;
  }

  /* =====================================================================
     THE SURE HIT
     Cleave and Dismantle, falling on everything inside the radius until
     there is nothing left of it. This runs on its own clock rather than
     on the action, because the action is over long before the shrine is.
     ================================================================== */
  function openDomain(center, opt) {
    opt = opt || {};
    var t = 0, cutT = 0, tickT = 0, bigT = 0;
    var shrine = opt.shrine || SK.shrine;
    var mine = !opt.shrine;                          // ours, or somebody else's
    var dur = opt.dur || SHRINE.dur;
    var yaw = opt.yaw == null ? null : opt.yaw;
    if (mine) SK.domain = { center: center.clone(), r: SHRINE.r, t: 0 };
    addFx({ t: 1e9, update: function (dt) {
      t += dt;
      if (mine) {
        SK.domain.t = t;
        shrine = SK.shrine;
        if (!SK.shrine) return false;
      }
      if (!shrine) return false;

      /* it rises for the first two seconds and then stands */
      var rise = Math.min(1, t / 2.2);
      shrine.position.y = center.y - 46 * (1 - E.out(rise));
      if (shrine.fires) {
        shrine.fires.forEach(function (f, i) {
          f.scale.set(4 + Math.sin(t * 9 + i) * .8, 6 + Math.cos(t * 11 + i) * 1.4, 1);
        });
      }
      if (rise < 1) return true;

      /* ---- the cuts. Long ones, everywhere, all the time. ---- */
      cutT += dt;
      if (cutT > .07) {
        cutT = 0;
        var ang = Math.random() * TAU, rr = Math.random() * SHRINE.r;
        var at = new THREE.Vector3(center.x + Math.cos(ang) * rr,
          1 + Math.random() * 22, center.z + Math.sin(ang) * rr);
        var len = 16 + Math.random() * 30;
        var dir2 = new THREE.Vector3(Math.random() - .5, (Math.random() - .5) * 1.4, Math.random() - .5)
          .normalize().multiplyScalar(len / 2);
        FX.cutLine(at.clone().sub(dir2), at.clone().add(dir2),
          Math.random() < .35 ? RED : 0xffffff, .5 + Math.random() * .7, .32);
        if (Math.random() < .3) {
          FX.cracks(new THREE.Vector3(at.x, .1, at.z), 4, 7, INK);
        }
      }
      /* and a whole lattice dropped across it every so often */
      bigT += dt;
      if (bigT > 1.1) {
        bigT = 0;
        var ba = Math.random() * TAU;
        var bc = new THREE.Vector3(center.x + Math.cos(ba) * SHRINE.r * .5, 11,
          center.z + Math.sin(ba) * SHRINE.r * .5);
        FX.lattice(bc, new THREE.Vector3(Math.cos(ba), 0, Math.sin(ba)),
          34, 22, 6, 4, 0xffffff, { stagger: 18, life: .5, width: .55 });
        addShake(.5);
        try { sfx.slash(); } catch (e) {}
      }

      /* ---- and what it does to whoever is standing in it ----
         Everybody plays the cuts on everybody. Only the caster's client
         applies the damage, the way every other hit in the game works. */
      tickT += dt;
      if (tickT > .32) {
        tickT = 0;
        var face = yaw == null ? player.facing : yaw;
        var marks = enemies.slice();
        if (!mine) marks.push(player);               // their shrine, our body
        marks.forEach(function (e) {
          if (!e || e.dead) return;
          if (e.pos.distanceTo(center) > SHRINE.r) return;
          var at2 = e.pos.clone().add(new THREE.Vector3(0, 2.6, 0));
          FX.lattice(at2, new THREE.Vector3(Math.sin(face), 0, Math.cos(face)),
            3.6, 5.4, 3, 3, 0xffffff, { stagger: 0, life: .28, width: .3, spark: false });
          FX.blood(at2, new THREE.Vector3(0, 1, 0), 3, .9);
          if (!mine || e === player) return;
          var dir3 = e.pos.clone().sub(center).setY(0);
          if (dir3.lengthSq() < .01) dir3.set(0, 0, 1);
          dir3.normalize();
          if (lowEnough(e)) { cutApart(e, dir3); return; }
          e.damage(13, null, {
            react: 'dismantle', reactDur: .3, spark: 0xffffff,
            color: '#ff2a4a', death: 'dice', stun: .34, bleed: true, fin: false
          });
        });
        addShake(.3);
      }

      if (t >= dur) {
        if (mine) closeShrine();
        else if (opt.done) opt.done();
        return false;
      }
      return true;
    } });
  }

  function stepShrine(a, dt) {
    var p = player, t = a.t;
    p.vel.set(0, 0, 0);

    if (!a.sk) {
      a.sk = 1;
      a.center = p.pos.clone();
      FX.tint('#1a0008', .2, SHRINE.dur);
      if (AN) AN.camRelease();
      try { sfx.raise(); } catch (e) {}
    }

    /* ---- the sign, both hands ---- */
    if (t < 1.6) {
      if (Math.random() < .8) {
        FX.mote(p.pos.clone().add(new THREE.Vector3(0, 3, 0)), BLOOD, 7, .4);
      }
      addShake(.2 + t * .3);
    }

    /* ---- and it is simply there, in the space that was already there ---- */
    if (t >= 1.6 && a.sk < 2) {
      a.sk = 2;
      a.shrine = buildShrine(a.center);
      SK.shrine = a.shrine;
      openDomain(a.center);
      FX.flash('#ff2a4a', .75, .45);
      FX.rings(new THREE.Vector3(a.center.x, .1, a.center.z), RED, 7,
        { maxR: SHRINE.r, life: 1.2, gap: 60 });
      FX.cracks(new THREE.Vector3(a.center.x, 0, a.center.z), 12, 26, INK);
      addShake(2.6);
      hitstop(.16);
      enemies.forEach(function (e) {
        if (!e || e.dead || e.pos.distanceTo(a.center) > SHRINE.r) return;
        e.stunT = Math.max(e.stunT || 0, 1.4);
        if (window.JJHITS) window.JJHITS.react(e, 'shock', 1.4);
      });
      if (window.MPJJ && window.MPJJ.relay) {
        window.MPJJ.relay.pub({ t: 'dom', id: window.MPJJ.id, k: 'shrine',
          x: Math.round(a.center.x * 10) / 10, z: Math.round(a.center.z * 10) / 10,
          y: Math.round(player.facing * 100) / 100,
          r: SHRINE.r, d: 1.6, dur: SHRINE.dur });
      }
      try { sfx.frame(); } catch (e) {}
    }

    /* ---- the frame is handed back, and the shrine keeps going ---- */
    if (t >= SHRINE.open - .5 && a.sk < 3) {
      a.sk = 3;
      FX.letterbox(false);
      hud(true);
      if (window.JJNOTICE) window.JJNOTICE('MALEVOLENT SHRINE — NO BARRIER', '#ff2a4a');
    }
  }

  function closeShrine() {
    var i;
    for (i = 0; i < SK.stage.length; i++) {
      var o = SK.stage[i];
      scene.remove(o);
      o.traverse && o.traverse(function (c) {
        if (c.isMesh && c.material) c.material.dispose();
      });
      if (o.material) o.material.dispose();
    }
    SK.stage.length = 0;
    SK.shrine = null;
    SK.domain = null;
    FX.letterbox(false);
    FX.tint('#1a0008', 0);
    hud(true);
    FX.flash('#ff8a9a', .4, .5);
  }

  function shrineCamera(a, dt) {
    var p = player, t = a.t, face = p.facing;
    /* the opening only: the sign, the shrine arriving, and one look up at
       what is now standing over the fight */
    var marks = [
      { t: 0, yaw: .45, d: 8, h: 4.4, ly: 3, k: 18 },
      { t: 1.1, yaw: .12, d: 4.4, h: 3.8, ly: 3.4, k: 26 },        // the sign
      /* out of the yard fast enough to be clear of the roof before it
         arrives — a wide shot the camera is still inside is a black frame */
      { t: 1.6, yaw: -.3, d: 44, h: 30, ly: 12, k: 22 },
      { t: 3.0, yaw: -.95, d: 96, h: 60, ly: 22, k: 15 },          // all of it
      { t: 4.2, yaw: -.4, d: 46, h: 24, ly: 12, k: 13 },
      { t: SHRINE.open, yaw: .1, d: 14, h: 5.4, ly: 3.4, k: 12 }
    ];
    var i = 0;
    while (i < marks.length - 1 && t >= marks[i + 1].t) i++;
    var m0 = marks[i], m1 = marks[Math.min(i + 1, marks.length - 1)];
    var k = m1 === m0 ? 0 : E.out(Math.min(1, (t - m0.t) / Math.max(.001, m1.t - m0.t)));
    function mix(f) { return m0[f] + (m1[f] - m0[f]) * k; }
    var yaw = face + mix('yaw'), d = mix('d');
    if (AN) {
      AN.camTo(p.pos.x + Math.sin(yaw) * d, p.pos.y + mix('h'), p.pos.z + Math.cos(yaw) * d,
        p.pos.x, p.pos.y + mix('ly'), p.pos.z, dt, mix('k'));
    }
    shakeMag = Math.max(0, shakeMag - dt * 2);
  }

  /* =====================================================================
     WHAT EVERYBODY ELSE SEES
     An ability's visuals are made by the caster's own client, so without
     this the rest of the room watches somebody mime. These are not
     stand-ins: they are the same routines the caster runs, with the
     damage taken out of them, played at the position and facing that
     came down the wire.
     ================================================================== */
  SK.remote = {
    dismantle: function (pos, yaw) {
      var d = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
      weaveFx(pos, d);
      setTimeout(function () {
        if (typeof scene === 'undefined') return;
        unravelFx(pos, d);
      }, 540);
    },
    cleave: function (pos, yaw) {
      var d = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
      var at = pos.clone().addScaledVector(d, 3.4).add(new THREE.Vector3(0, 2.8, 0));
      cut(at, .35, 13, 0xffffff);
      cut(at, -.45, 11, RED);
      cut(at, 1.5, 9, 0xffffff);
      FX.cross(at, 0xffffff, 6, .26);
      FX.impact(at, RED, 3);
      FX.heavyHit(at, RED, 1.2);
      FX.debris(at, 14, 13, 0x2a1218);
      FX.cracks(new THREE.Vector3(at.x, .1, at.z), 12, 14, INK);
      addShake(1.2);
      try { sfx.slash(); } catch (e) {}
    },
    fuga: function (pos, yaw) {
      var d = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
      var palm = pos.clone().addScaledVector(d, 1.6).add(new THREE.Vector3(0, 3, 0));
      /* the furnace opening, and then the arrow going */
      FX.converge(palm, 0xff8a3a, 30, 14, .9);
      var n = 0, iv = setInterval(function () {
        if (n++ > 22 || typeof scene === 'undefined') { clearInterval(iv); return; }
        FX.flame(palm.clone().add(new THREE.Vector3(
          (Math.random() - .5) * 3, (Math.random() - .5) * 3, (Math.random() - .5) * 3)),
          1.4 + Math.random() * 2, .35);
      }, 50);
      setTimeout(function () {
        if (typeof scene === 'undefined') return;
        FX.flash('#ffd8a0', .35, .3);
        FX.rings(palm, 0xff8a3a, 3, { maxR: 12, life: .5, ground: false, gap: 40 });
        loose(palm.clone().addScaledVector(d, 4), d.clone(), true);
      }, FUGA.charge * 1000);
    },
    /* the shrine has no barrier, so there is nothing to be outside of:
       everybody in the room builds the whole thing and watches it cut */
    shrine: function (center, yaw, dur) {
      var stage = [];
      var g = buildShrine(center, yaw, stage);
      FX.flash('#ff2a4a', .55, .45);
      FX.rings(new THREE.Vector3(center.x, .1, center.z), RED, 7,
        { maxR: SHRINE.r, life: 1.2, gap: 60 });
      FX.cracks(new THREE.Vector3(center.x, 0, center.z), 12, 26, INK);
      addShake(Math.max(.4, 2.6 - player.pos.distanceTo(center) / 40));
      try { sfx.frame(); } catch (e) {}
      openDomain(center, {
        shrine: g, dur: dur || SHRINE.dur, yaw: yaw,
        done: function () {
          stage.forEach(function (o) {
            scene.remove(o);
            o.traverse && o.traverse(function (c) {
              if (c.isMesh && c.material) c.material.dispose();
            });
          });
          stage.length = 0;
          FX.flash('#ff8a9a', .3, .5);
        }
      });
      return g;
    }
  };

  /* =====================================================================
     POSES FOR THE FOUR
     ================================================================== */
  function poseSukuna(r, a) {
    var t = a.t;
    switch (a.type) {
      case 's1': {
        /* Both hands, crossed and thrown open — the net is woven with two
           hands and it is thrown wide, not flicked. Then it is held open
           while everything on the other side of it falls apart. */
        rp(r);
        var w = t < .18 ? E.out(t / .18) : 1;
        var sw = t >= .18 ? E.out(Math.min(1, (t - .18) / .18)) : 0;
        var hold = t >= .72 ? E.out(Math.min(1, (t - .72) / .3)) : 0;
        r.shoulderR.rotation.x = -.4 - 1.15 * w + .95 * sw + .2 * hold;
        r.shoulderR.rotation.z = -1.7 * w + 3.1 * sw - .5 * hold;
        r.elbowR.rotation.x = -1.5 * w + 1.35 * sw;
        r.shoulderL.rotation.x = -.4 - 1.05 * w + .85 * sw + .2 * hold;
        r.shoulderL.rotation.z = 1.6 * w - 2.9 * sw + .5 * hold;
        r.elbowL.rotation.x = -1.4 * w + 1.25 * sw;
        r.spine.rotation.y = .55 * w - 1.05 * sw + .5 * hold;
        r.spine.rotation.x = -.16 * w + .24 * sw - .12 * hold;
        r.neck.rotation.y = -.28 * w + .46 * sw - .18 * hold;
        r.neck.rotation.x = -.1 * w - .16 * hold;      // watching it work
        r.hips.position.y = r.hipsBaseY - .18 * w + .1 * sw;
        r.kneeL.rotation.x = .35 * w - .2 * sw;
        W(r, -.25 * w + .55 * sw);
        return true;
      }
      case 's2': {                                   // up over the head, and down
        rp(r);
        var u = t < .42 ? E.out(t / .42) : 1;
        var dn = t >= .42 ? E.out(Math.min(1, (t - .42) / .18)) : 0;
        r.shoulderR.rotation.x = -.4 - 2.6 * u + 3.5 * dn;
        r.shoulderR.rotation.z = -.2 - .3 * u + .3 * dn;
        r.elbowR.rotation.x = -.6 - 1.1 * u + 1.4 * dn;
        r.shoulderL.rotation.x = -.4 - 1.9 * u + 2.6 * dn;
        r.elbowL.rotation.x = -.6 - .9 * u + 1.2 * dn;
        r.spine.rotation.x = -.4 * u + 1 * dn;
        r.neck.rotation.x = -.35 * u + .7 * dn;
        r.hips.position.y = r.hipsBaseY + .28 * u - .55 * dn;
        r.kneeL.rotation.x = .1 + .8 * dn; r.kneeR.rotation.x = .1 + .5 * dn;
        W(r, -.2 * u + .5 * dn);
        return true;
      }
      case 's3': {
        /* The bow he does not have. The front hand holds the arrow on its
           line, the back hand draws it in against the shoulder, and the
           loose is the back hand opening — everything after that is the
           body following the arrow it just let go of. */
        rp(r);
        var c = E.out(Math.min(1, t / FUGA.charge));
        var draw = E.out(Math.min(1, Math.max(0, t - FUGA.charge * .45) / (FUGA.charge * .55)));
        var loose = t >= FUGA.charge ? E.out(Math.min(1, (t - FUGA.charge) / .2)) : 0;
        var after = t >= FUGA.charge + .2 ? E.out(Math.min(1, (t - FUGA.charge - .2) / .6)) : 0;
        /* front arm out along the shot and staying there */
        r.shoulderR.rotation.x = -.4 - 1.35 * c + .12 * loose - .5 * after;
        r.shoulderR.rotation.z = -.42 * c - .1 * draw + .3 * after;
        r.elbowR.rotation.x = -.55 * c + .3 * loose - .3 * after;
        /* back arm drawn in, then thrown open */
        r.shoulderL.rotation.x = -.4 - .8 * c - .55 * draw + 1.1 * loose - .4 * after;
        r.shoulderL.rotation.z = .55 * c + .5 * draw - 1.15 * loose + .3 * after;
        r.elbowL.rotation.x = -1.1 * c - .9 * draw + 1.7 * loose;
        r.spine.rotation.y = -.42 * c - .3 * draw + .55 * loose - .1 * after;
        r.spine.rotation.x = .1 * c + .16 * draw - .46 * loose + .18 * after;
        r.neck.rotation.y = .3 * c + .16 * draw - .3 * loose;
        r.neck.rotation.x = -.12 * c - .1 * loose;
        r.hips.position.y = r.hipsBaseY - .26 * c - .14 * draw + .3 * loose - .16 * after;
        r.hipL.rotation.x = -.5 * c + .3 * loose;
        r.hipR.rotation.x = .25 * c - .2 * loose;
        r.kneeL.rotation.x = .7 * c - .35 * loose + .2 * after;
        r.kneeR.rotation.x = .3 * c - .1 * loose;
        W(r, -.5 * c + .8 * loose - .2 * after);
        return true;
      }
      case 's4': {                                   // hands together, and held
        rp(r);
        if (t < 1.6) {
          var s = E.out(Math.min(1, t / 1.2));
          r.shoulderR.rotation.x = -.4 - 1.35 * s;
          r.shoulderR.rotation.z = -.62 * s;
          r.elbowR.rotation.x = -1.75 * s;
          r.shoulderL.rotation.x = -.4 - 1.35 * s;
          r.shoulderL.rotation.z = .62 * s;
          r.elbowL.rotation.x = -1.75 * s;
          r.spine.rotation.x = -.14 * s;
          r.neck.rotation.x = -.2 * s;
          r.hips.position.y = r.hipsBaseY - .1 * s;
          W(r, -.15 * s);
        } else {
          var o = E.out(Math.min(1, (t - 1.6) / .7));
          var breathe = Math.sin(t * 1.5) * .04;
          r.shoulderR.rotation.x = -1.75 + .8 * o;
          r.shoulderR.rotation.z = -.62 - .5 * o;
          r.elbowR.rotation.x = -1.75 + 1.35 * o;
          r.shoulderL.rotation.x = -1.75 + .8 * o;
          r.shoulderL.rotation.z = .62 + .5 * o;
          r.elbowL.rotation.x = -1.75 + 1.35 * o;
          r.spine.rotation.x = -.14 - .12 * o + breathe;
          r.neck.rotation.x = -.2 - .2 * o;
          r.hips.position.y = r.hipsBaseY - .1 + .1 * o;
          W(r, .1 * o);
        }
        return true;
      }
    }
    return false;
  }

  /* =====================================================================
     THE BAR
     ================================================================== */
  var BASE_MOVES = CHARS.yuji.moves.slice();
  var AW_MOVES = [
    { key: 'LMB', lbl: 'Punch', cd: 'm1', max: .3 },
    { key: 'Q', lbl: 'Dash', cd: 'dash', max: 1 },
    { key: '1', lbl: 'Dismantle', cd: 's1', max: CD.s1 },
    { key: '2', lbl: 'Cleave', cd: 's2', max: CD.s2 },
    { key: '3', lbl: 'Fuga', cd: 's3', max: CD.s3 },
    { key: '4', lbl: 'Malevolent Shrine', cd: 's4', max: CD.s4 },
    { key: 'R', lbl: 'Surge', cd: 'yr', max: 8 }
  ];
  function swapBar(on) {
    CHARS.yuji.moves = on ? AW_MOVES : BASE_MOVES;
    if (player.char === 'yuji') { try { buildMovesBar(); } catch (e) {} }
  }

  /* =====================================================================
     WIRING
     ================================================================== */
  var _stepAction = stepAction;
  stepAction = function (a, dt) {
    switch (a.type) {
      case 'yaw': return stepAwaken(a, dt);
      case 's1': return stepDismantle(a, dt);
      case 's2': return stepCleave(a, dt);
      case 's3': return stepFlame(a, dt);
      case 's4': return stepShrine(a, dt);
    }
    return _stepAction(a, dt);
  };

  var _poseAction = poseAction;
  poseAction = function (r, a) {
    if (a.type === 'yaw' && player.char === 'yuji') { poseAwaken(r, a); return; }
    if (r === player.rig && poseSukuna(r, a)) return;
    return _poseAction(r, a);
  };

  var _updateCamera = updateCamera;
  updateCamera = function (dt) {
    var a = player.action;
    if (a && player.char === 'yuji' && AN) {
      if (a.type === 'yaw') { awakenCamera(a, dt); return; }
      if (a.type === 's4') { shrineCamera(a, dt); return; }
    }
    return _updateCamera(dt);
  };

  /* Yuji's own handler may win the keydown, so the swap happens at the
     action instead: while it is out, his four become the other four */
  var SWAP = {
    y1: ['s1', 1.25, 'DISMANTLE', '\u89e3'],
    y2: ['s2', 1.15, 'CLEAVE', '\u634c'],
    y3: ['s3', 2.4, 'FUGA', '\u7ac3 \u00b7 DIVINE FLAME'],
    y4: ['s4', SHRINE.open, 'MALEVOLENT SHRINE', '\u4f0f\u9b54\u5fa1\u5eda\u5b50']
  };
  var _updateAction = null;
  addFx({ t: 1e9, update: function () {
    var a = player.action;
    if (!a || !awake() || a.t > .05) return true;
    var sw = SWAP[a.type];
    if (!sw || cds[sw[0]] > 0) return true;
    a.type = sw[0];
    a.dur = sw[1];
    a.stage = 0;
    cds[sw[0]] = CD[sw[0]];
    try { showSplash(sw[2], sw[3], '#ff2a4a'); } catch (e) {}
    if (sw[0] === 's4') { player.iframes = Math.max(player.iframes, SHRINE.open); FX.letterbox(true); hud(false); }
    else player.iframes = Math.max(player.iframes, sw[0] === 's3' ? 1 : .35);
    if (window.MPJJ && window.MPJJ.relay) {
      window.MPJJ.relay.pub({ t: 'cast', id: window.MPJJ.id, k: sw[0] });
    }
    return true;
  } });

  /* his keys, while he is out — ahead of the ones Yuji had */
  window.addEventListener('keydown', function (e) {
    if (!started || player.char !== 'yuji' || e.repeat || !awake()) return;
    if (player.react || (player.action && (player.action.type === 'kb' || player.action.type === 'void'))) return;
    var hit = true;
    if (e.code === 'Digit1') castDismantle();
    else if (e.code === 'Digit2') castCleave();
    else if (e.code === 'Digit3') castFlame();
    else if (e.code === 'Digit4') castShrine();
    else hit = false;
    if (hit) e.stopImmediatePropagation();
  }, true);

  /* when it goes back in, so does the face */
  addFx({ t: 1e9, update: function (dt) {
    var A = window.JJAW;
    if (A && A.sukuna && !A.yuji) {
      A.sukuna = false;
      setFace(0);
      var f = faceOf();
      if (f) f.visible = false;
      swapBar(false);
    }
    /* the shrine outlives the opening — it stands until its own clock runs
       out — but it does not outlive him being Sukuna */
    if (SK.shrine && (player.dead || player.char !== 'yuji' || !awake())) closeShrine();
    return true;
  } });
})();
