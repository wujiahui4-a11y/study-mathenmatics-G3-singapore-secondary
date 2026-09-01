/* =======================================================================
   SUKUNA
   What is inside Yuji, when it is allowed out.

   The transformation is not a power-up flash. He goes down first: hands
   on his own head, shaking, losing. The marks crawl up. Then it goes
   quiet — and what stands up is not him. Four eyes, a mouth on his
   cheek, and a grin that belongs to something that has been waiting.

   And then he has the King of Curses' hands:
     1  DISMANTLE        a fan of cuts through everything in front
     2  CLEAVE           one cut, on one target, that takes them apart
     3  DIVINE FLAME     the arrow, black and red, straight down the line
     4  MALEVOLENT SHRINE the shrine, and everything inside it cut to pieces

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
        window.MPJJ.relay.pub({ t: 'fx', id: window.MPJJ.id, k: 'sukuna' });
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

  /* -------------------------------------------------- 1 · DISMANTLE */
  function castDismantle() {
    if (!ok('s1')) return;
    begin('s1', .85, 's1', 'DISMANTLE', '\u89e3');
    player.iframes = Math.max(player.iframes, .2);
  }
  function stepDismantle(a, dt) {
    var p = player, d = fwd();
    if (a.t >= .22 && a.stage < 1) {
      a.stage = 1;
      var base = p.pos.clone().addScaledVector(d, 5).add(new THREE.Vector3(0, 2.6, 0));
      for (var i = 0; i < 7; i++) {
        (function (n) {
          setTimeout(function () {
            if (!scene) return;
            var off = (n - 3) * 1.5;
            var side = new THREE.Vector3(d.z, 0, -d.x).multiplyScalar(off);
            var at = base.clone().add(side).add(new THREE.Vector3(0, (n % 2 ? .8 : -.9), 0));
            cut(at, (n % 2 ? .7 : -.7), 7, 0xffffff);
            cut(at, (n % 2 ? -.7 : .7), 5.5, RED);
            FX.streaks(at, RED, 2, 6, 1);
          }, n * 34);
        })(i);
      }
      FX.cross(p.pos.clone().addScaledVector(d, 4).add(new THREE.Vector3(0, 2.6, 0)), 0xffffff, 4, .18);
      FX.mangaLines(.5, .22);
      addShake(.7);
      if (AN) AN.camKick(.7);
      var hit = targets(15, 6);
      hit.forEach(function (e) {
        var kb = e.pos.clone().sub(p.pos).setY(0).normalize().multiplyScalar(9);
        e.damage(11 + Math.random() * 4, kb, { react: 'flinch', reactDur: .3, spark: RED });
        FX.cracks(e.pos.clone(), 4, 6, INK);
      });
      /* and the ground it passed over */
      for (var j = 1; j <= 6; j++) {
        var g = p.pos.clone().addScaledVector(d, j * 2.4);
        FX.cracks(g, 3 + Math.random() * 3, 5, INK);
      }
      try { sfx.slash(); } catch (e) {}
    }
    if (a.t >= .5 && a.stage < 2) {
      a.stage = 2;
      var t2 = targets(15, 6);
      t2.forEach(function (e) {
        var kb = e.pos.clone().sub(p.pos).setY(0).normalize().multiplyScalar(14);
        e.damage(9, kb, { react: 'flinch', reactDur: .3, spark: 0xffffff });
      });
      if (t2.length && window.JJAW) window.JJAW.gain(8);
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
        tgt.damage(46, kb, { react: 'blow', reactDur: 1, spark: 0xffffff, ragdoll: true });
        if (window.JJRAG && tgt.hp > 0) {
          try { window.JJRAG.start(tgt, kb.clone().multiplyScalar(.5), 1.2); } catch (e) {}
        }
        if (window.JJAW) window.JJAW.gain(14);
      }
      FX.cracks(new THREE.Vector3(at.x, .1, at.z), 12, 14, INK);
      try { sfx.slash(); } catch (e) {}
    }
  }

  /* ------------------------------------------------- 3 · DIVINE FLAME */
  function castFlame() {
    if (!ok('s3')) return;
    begin('s3', 1.9, 's3', 'DIVINE FLAME', '\u958b');
    player.iframes = Math.max(player.iframes, .8);
  }
  function stepFlame(a, dt) {
    var p = player, d = fwd();
    var muzzle = p.pos.clone().addScaledVector(d, 1.1).add(new THREE.Vector3(0, 2.7, 0));
    if (a.t < .85) {                                 // it gathers in the palm
      if (Math.random() < .95) FX.mote(muzzle, 0xff5a2a, 5, .3);
      if (!a.orb) {
        a.orb = FX.billboard(FX.T.star, 0xff7a2a, .9);
        scene.add(a.orb);
        SK.stage.push(a.orb);
        FX.converge(muzzle, 0xff8a3a, 26, 12, .8);
      }
      a.orb.position.copy(muzzle);
      a.orb.scale.setScalar(.6 + E.out(a.t / .85) * 3.4);
      addShake(.25);
    }
    if (a.t >= .85 && a.stage < 1) {
      a.stage = 1;
      if (a.orb) { scene.remove(a.orb); a.orb.material.dispose(); a.orb = null; }
      var len = 58;
      FX.beam(muzzle, d, len, 0xff5a2a, { radius: 2.6, life: .8 });
      FX.beam(muzzle, d, len, 0x2a0208, { radius: 3.6, life: .85 });
      FX.beam(muzzle, d, len, 0xffd8a0, { radius: 1.1, life: .75 });
      for (var i = 0; i < 12; i++) {
        var at = muzzle.clone().addScaledVector(d, 4 + i * 4.4);
        FX.impact(at, 0xff6a2a, 1.6 + Math.random());
        FX.streaks(at, 0xffb070, 3, 7, 1.2);
        FX.cracks(new THREE.Vector3(at.x, .1, at.z), 5, 7, 0x2a1008);
      }
      FX.flash('#ff8a3a', .6, .4);
      FX.mangaLines(1, .45);
      FX.zoom(-14, .9);
      addShake(2);
      if (AN) AN.camKick(1.8);
      var hit = targets(len, 5.5);
      hit.forEach(function (e) {
        var kb = d.clone().multiplyScalar(34); kb.y = 8;
        e.damage(52, kb, { react: 'blow', reactDur: 1.1, spark: 0xff8a3a, ragdoll: true });
      });
      if (hit.length && window.JJAW) window.JJAW.gain(16);
      try { sfx.blast(); } catch (e) {}
    }
    if (a.t >= .85 && a.t < 1.5 && Math.random() < .7) {
      var q = muzzle.clone().addScaledVector(d, 5 + Math.random() * 45);
      FX.mote(q, 0xff7a2a, 8, .5);
    }
  }

  /* -------------------------------------------- 4 · MALEVOLENT SHRINE */
  var SHRINE = { r: 34, dur: 9.6 };
  function castShrine() {
    if (!ok('s4')) return;
    begin('s4', SHRINE.dur, 's4', 'MALEVOLENT SHRINE', '\u4f0f\u9b54\u5fa1\u5eda\u5b50');
    player.iframes = Math.max(player.iframes, SHRINE.dur);
    FX.letterbox(true);
    hud(false);
  }

  function buildShrine(center) {
    var g = new THREE.Group();
    function bone(w, h, d, c) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({ color: c == null ? BONE : c, roughness: .85 }));
      m.castShadow = true; m.receiveShadow = true;
      return m;
    }
    /* the platform it all sits on */
    var base = bone(46, 1.4, 46, 0x2a2028);
    base.position.y = -.7;
    g.add(base);
    for (var s = 0; s < 3; s++) {
      var step = bone(46 - s * 6, .7, 46 - s * 6, s % 2 ? 0x3a2c34 : 0x241c22);
      step.position.y = .35 + s * .7;
      g.add(step);
    }

    /* the skull at the back of it, and the ribs around */
    var head = new THREE.Group();
    head.position.set(0, 15, -19);
    var cranium = bone(11, 9, 9);
    head.add(cranium);
    var jaw = bone(9.4, 3, 7.4, 0xd8c9ad);
    jaw.position.set(0, -5.6, .6);
    head.add(jaw);
    for (var e2 = -1; e2 <= 1; e2 += 2) {
      var socket = new THREE.Mesh(new THREE.BoxGeometry(3, 3.2, .6),
        new THREE.MeshBasicMaterial({ color: 0x180208, toneMapped: false }));
      socket.position.set(e2 * 2.7, 1.4, 4.6);
      head.add(socket);
      var glow = FX.billboard(FX.T.star, RED, .95);
      glow.scale.setScalar(5.5);
      glow.position.set(e2 * 2.7, 1.4, 5.2);
      head.add(glow);
    }
    for (var tth = 0; tth < 7; tth++) {
      var t2 = bone(.9, 1.6, .8, 0xf0e6d0);
      t2.position.set(-2.7 + tth * .9, -4.2, 4.2);
      head.add(t2);
    }
    g.add(head);
    g.skull = head;

    /* ribs, leaning in over the yard */
    for (var i = 0; i < 10; i++) {
      var sgn = i % 2 ? 1 : -1, n = Math.floor(i / 2);
      var rib = bone(1.5, 20 - n * 2.2, 1.5);
      rib.position.set(sgn * (10 + n * 3.4), 9 - n, -10 + n * 6);
      rib.rotation.z = sgn * (.32 + n * .06);
      rib.rotation.x = -.12;
      g.add(rib);
    }
    /* gate posts at the front */
    for (var q = -1; q <= 1; q += 2) {
      var post = bone(2, 22, 2, 0x8b1226);
      post.position.set(q * 15, 11, 19);
      g.add(post);
    }
    var lintel = bone(34, 2.2, 2.4, 0x8b1226);
    lintel.position.set(0, 21, 19);
    lintel.rotation.z = .02;
    g.add(lintel);
    var lintel2 = bone(30, 1.6, 1.8, 0x6a0c1c);
    lintel2.position.set(0, 18, 19);
    g.add(lintel2);

    /* the sky it happens under */
    var sky = new THREE.Mesh(new THREE.SphereGeometry(190, 28, 20),
      new THREE.MeshBasicMaterial({
        map: FX.T.smoke, color: 0x3a0510, side: THREE.BackSide,
        depthWrite: false, toneMapped: false, transparent: true, opacity: .95
      }));
    sky.material.map = FX.T.smoke.clone();
    sky.material.map.wrapS = sky.material.map.wrapT = THREE.RepeatWrapping;
    sky.material.map.repeat.set(6, 3);
    sky.material.map.needsUpdate = true;
    g.add(sky);
    g.sky = sky;

    var lamp = new THREE.PointLight(0xffe0b0, 3.4, 150, 1.2);
    lamp.position.set(0, 30, 6);
    g.add(lamp);
    var lamp2 = new THREE.PointLight(0xff6a3a, 2.6, 110, 1.4);
    lamp2.position.set(0, 10, -22);                  // behind the skull
    g.add(lamp2);
    var lamp3 = new THREE.PointLight(0xffb070, 2, 80, 1.5);
    lamp3.position.set(0, 7, 22);
    g.add(lamp3);
    g.add(new THREE.AmbientLight(0x6a5a58, 1.1));

    /* braziers, so the yard has something burning in it */
    for (var b = 0; b < 4; b++) {
      var bx = (b % 2 ? 1 : -1) * 17, bz = (b < 2 ? 1 : -1) * 13;
      var bowl = bone(2.2, 1.6, 2.2, 0x3a2c2c);
      bowl.position.set(bx, 3, bz);
      g.add(bowl);
      var fire = FX.billboard(FX.T.star, 0xff8a3a, .9);
      fire.scale.setScalar(5);
      fire.position.set(bx, 5.4, bz);
      g.add(fire);
      var fl = new THREE.PointLight(0xff7a3a, 2.2, 34, 1.6);
      fl.position.set(bx, 5.4, bz);
      g.add(fl);
    }

    g.position.copy(center);
    g.rotation.y = player.facing;
    g.position.y -= 30;                              // it comes up out of the ground
    scene.add(g);
    SK.stage.push(g);
    return g;
  }

  function stepShrine(a, dt) {
    var p = player, t = a.t;
    p.vel.set(0, 0, 0);

    if (!a.sk) {
      a.sk = 1;
      a.center = p.pos.clone();
      FX.tint('#1a0008', .26, SHRINE.dur);
      if (AN) AN.camRelease();
      try { sfx.raise(); } catch (e) {}
    }

    /* ---- the sign, both hands ---- */
    if (t < 1.5) {
      if (Math.random() < .8) {
        FX.mote(p.pos.clone().add(new THREE.Vector3(0, 3, 0)), BLOOD, 7, .4);
      }
      addShake(.2 + t * .3);
    }

    /* ---- it comes up ---- */
    if (t >= 1.5 && a.sk < 2) {
      a.sk = 2;
      a.shrine = buildShrine(a.center);
      SK.shrine = a.shrine;
      if (window.JJSTAGE) {
        window.JJSTAGE.hide.sky = 0x1a0308;
        window.JJSTAGE.hide(SK.stage.slice());
      }
      FX.flash('#ff2a4a', .7, .4);
      FX.rings(new THREE.Vector3(a.center.x, .1, a.center.z), RED, 6, { maxR: 40, life: 1, gap: 70 });
      addShake(2.2);
      hitstop(.14);
      a.locked = [];
      enemies.forEach(function (e) {
        if (!e || e.dead || e.pos.distanceTo(a.center) > SHRINE.r) return;
        a.locked.push(e);
        e.stunT = Math.max(e.stunT || 0, SHRINE.dur - 1.5);
      });
      if (window.MPJJ && window.MPJJ.relay) {
        window.MPJJ.relay.pub({ t: 'dom', id: window.MPJJ.id,
          x: Math.round(a.center.x * 10) / 10, z: Math.round(a.center.z * 10) / 10,
          r: SHRINE.r, d: SHRINE.dur - 1.5 });
      }
      try { sfx.frame(); } catch (e) {}
    }

    if (a.shrine) {
      var rise = Math.min(1, (t - 1.5) / 1.8);
      a.shrine.position.y = a.center.y - 30 * (1 - E.out(rise));
      a.shrine.sky.material.map.offset.x += dt * .01;
      if (rise >= 1) {
        /* everything inside gets taken apart, and keeps getting taken apart */
        a.cut = (a.cut || 0) + dt;
        if (a.cut > .12) {
          a.cut = 0;
          var ang = Math.random() * TAU, rr = Math.random() * SHRINE.r;
          var at = new THREE.Vector3(a.center.x + Math.cos(ang) * rr,
            .8 + Math.random() * 9, a.center.z + Math.sin(ang) * rr);
          cut(at, Math.random() * TAU, 5 + Math.random() * 8, Math.random() < .4 ? RED : 0xffffff);
          if (Math.random() < .4) FX.cracks(new THREE.Vector3(at.x, .1, at.z), 4, 6, INK);
        }
        a.tick = (a.tick || 0) + dt;
        if (a.tick > .35) {
          a.tick = 0;
          (a.locked || []).forEach(function (e) {
            if (!e || e.dead) return;
            var at2 = e.pos.clone().add(new THREE.Vector3(
              (Math.random() - .5) * 2, 1.5 + Math.random() * 2.5, (Math.random() - .5) * 2));
            cut(at2, Math.random() * TAU, 6, 0xffffff);
            FX.streaks(at2, RED, 2, 5, 1);
            e.stunT = Math.max(e.stunT || 0, .6);
            e.hp = Math.max(1, e.hp - 9);            /* quietly; the shrine is the shot */
            if (e.drawHp) e.drawHp();
          });
          addShake(.35);
        }
      }
    }

    if (t >= SHRINE.dur - .6 && a.sk < 3) {
      a.sk = 3;
      closeShrine();
    }
  }

  function closeShrine() {
    if (window.JJSTAGE) window.JJSTAGE.show();
    SK.stage.forEach(function (o) {
      scene.remove(o);
      if (o.material) o.material.dispose();
    });
    SK.stage.length = 0;
    SK.shrine = null;
    FX.letterbox(false);
    FX.tint('#1a0008', 0);
    hud(true);
    FX.flash('#ff8a9a', .4, .5);
  }

  function shrineCamera(a, dt) {
    var p = player, t = a.t, face = p.facing;
    var marks = [
      { t: 0, yaw: .45, d: 7, h: 4, ly: 3, k: 18 },
      { t: 1.0, yaw: .12, d: 4.2, h: 3.6, ly: 3.4, k: 26 },        // the sign
      { t: 1.5, yaw: -.25, d: 15, h: 8, ly: 5, k: 12 },
      { t: 3.4, yaw: -.85, d: 40, h: 24, ly: 11, k: 8 },           // all of it at once
      { t: 5.6, yaw: -.2, d: 26, h: 13, ly: 6, k: 9 },
      { t: 7.6, yaw: .5, d: 17, h: 7.5, ly: 4, k: 10 },
      { t: SHRINE.dur, yaw: .2, d: 13, h: 5.6, ly: 3.4, k: 12 }
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
     POSES FOR THE FOUR
     ================================================================== */
  function poseSukuna(r, a) {
    var t = a.t;
    switch (a.type) {
      case 's1': {                                   // a backhand sweep
        rp(r);
        var w = t < .22 ? E.out(t / .22) : 1;
        var sw = t >= .22 ? E.out(Math.min(1, (t - .22) / .2)) : 0;
        r.shoulderR.rotation.x = -.4 - .9 * w + .7 * sw;
        r.shoulderR.rotation.z = -1.5 * w + 2.5 * sw;
        r.elbowR.rotation.x = -1.3 * w + 1.1 * sw;
        r.shoulderL.rotation.x = -.3 - .3 * w;
        r.shoulderL.rotation.z = .4 * w - .5 * sw;
        r.spine.rotation.y = .7 * w - 1.3 * sw;
        r.spine.rotation.x = -.1 * w + .18 * sw;
        r.neck.rotation.y = -.3 * w + .5 * sw;
        W(r, .3 * sw);
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
      case 's3': {                                   // palm forward, holding it
        rp(r);
        var c = t < .85 ? E.out(t / .85) : 1;
        var fire = t >= .85 ? E.out(Math.min(1, (t - .85) / .16)) : 0;
        r.shoulderR.rotation.x = -.4 - 1.1 * c - .3 * fire;
        r.shoulderR.rotation.z = -.5 * c + .25 * fire;
        r.elbowR.rotation.x = -1.4 * c + 1.25 * fire;
        r.shoulderL.rotation.x = -.4 - .9 * c - .2 * fire;
        r.shoulderL.rotation.z = .5 * c - .2 * fire;
        r.elbowL.rotation.x = -1.2 * c + 1 * fire;
        r.spine.rotation.x = .18 * c - .42 * fire;
        r.neck.rotation.x = -.1 * c - .12 * fire;
        r.hips.position.y = r.hipsBaseY - .2 * c + .1 * fire;
        r.hipL.rotation.x = -.35 * c + .2 * fire;
        r.kneeL.rotation.x = .5 * c - .3 * fire;
        W(r, -.35 * c + .55 * fire);
        return true;
      }
      case 's4': {                                   // hands together, and held
        rp(r);
        if (t < 1.5) {
          var s = E.out(Math.min(1, t / 1.1));
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
          var o = E.out(Math.min(1, (t - 1.5) / .7));
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
    { key: '3', lbl: 'Divine Flame', cd: 's3', max: CD.s3 },
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
    y1: ['s1', .85, 'DISMANTLE', '\u89e3'],
    y2: ['s2', 1.15, 'CLEAVE', '\u634c'],
    y3: ['s3', 1.9, 'DIVINE FLAME', '\u958b'],
    y4: ['s4', SHRINE.dur, 'MALEVOLENT SHRINE', '\u4f0f\u9b54\u5fa1\u5eda\u5b50']
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
    if (sw[0] === 's4') { player.iframes = Math.max(player.iframes, SHRINE.dur); FX.letterbox(true); hud(false); }
    else player.iframes = Math.max(player.iframes, sw[0] === 's3' ? .8 : .35);
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
    if (SK.shrine && !(player.action && player.action.type === 's4')) closeShrine();
    return true;
  } });
})();
