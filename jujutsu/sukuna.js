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

  /* a cut that is actually a cut: it travels, it is huge, and it leaves
     the floor the way it found the air */
  function cut(at, angle, size, color) {
    var dir = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
    if (FX.worldCut && size >= 10) {
      FX.worldCut(at.clone().addScaledVector(dir, -size * .45), dir, {
        len: size * 1.8, h: size * .38, color: color == null ? 0xffffff : color,
        echo: color === 0xffffff ? RED : 0xffffff, life: .42
      });
      return;
    }
    var m = FX.billboard(FX.T.slash, color == null ? 0xffffff : color, 1);
    m.position.copy(at);
    m.scale.set(size, size * .5, 1);
    scene.add(m);
    var life = .28, t = 0;
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

  /* if they are already nearly out, the cut does not wound them — it
     takes them apart, and the pieces stay */
  function slashVictim(e, dmg, dir, react) {
    if (!e || e.dead || e.__gone) return;
    var max = e.maxHp || 100;
    var lethal = e.hp - dmg <= 0 || e.hp / max <= .24;
    if (lethal && window.JJGORE) {
      window.JJGORE.mark(e, 'cut', dir);
      e.hp = 0;
      try { e.die(); } catch (err) {}
      return;
    }
    var kb = dir ? dir.clone().setY(0) : new THREE.Vector3();
    if (kb.lengthSq() > .001) kb.normalize().multiplyScalar(10);
    e.damage(dmg, kb, { react: react || 'slice', reactDur: .5, spark: 0xffffff });
  }

  /* -------------------------------------------------- 1 · DISMANTLE
     Invisible until it has already gone through. What you see is the
     world after: a cut that crosses everything in front, and another
     that crosses that, the way the page itself gets sliced. */
  function castDismantle() {
    if (!ok('s1')) return;
    begin('s1', 1.35, 's1', 'DISMANTLE', '\u89e3');
    player.iframes = Math.max(player.iframes, .35);
  }
  function stepDismantle(a, dt) {
    var p = player, d = fwd();
    var origin = p.pos.clone().add(new THREE.Vector3(0, 2.8, 0));
    if (a.t < .32 && Math.random() < .4) {
      FX.mote(origin.clone().addScaledVector(d, 1.4), 0xffffff, 3, .25);
    }
    if (a.t >= .32 && a.stage < 1) {
      a.stage = 1;
      /* three cuts that actually cross the world, not a fan of sparks */
      var side = new THREE.Vector3(d.z, 0, -d.x);
      FX.worldCut(origin.clone().addScaledVector(side, -4), d, {
        len: 48, h: 14, color: 0xffffff, echo: RED, life: .48
      });
      setTimeout(function () {
        if (!scene) return;
        var o2 = origin.clone().addScaledVector(side, 6).add(new THREE.Vector3(0, 1.2, 0));
        var d2 = d.clone().addScaledVector(side, -.35).normalize();
        FX.worldCut(o2, d2, { len: 44, h: 12, color: 0xffffff, echo: RED, life: .42 });
      }, 90);
      setTimeout(function () {
        if (!scene) return;
        var o3 = origin.clone().addScaledVector(side, -7).add(new THREE.Vector3(0, -1, 0));
        var d3 = d.clone().addScaledVector(side, .4).normalize();
        FX.worldCut(o3, d3, { len: 40, h: 11, color: RED, echo: 0xffffff, life: .4 });
      }, 170);
      FX.cross(origin.clone().addScaledVector(d, 8), 0xffffff, 7, .22);
      FX.mangaLines(.85, .3);
      FX.flash('#ffffff', .35, .12);
      addShake(1.3);
      if (AN) AN.camKick(1.2);
      hitstop(.1);
      var hit = targets(36, 10);
      hit.forEach(function (e) {
        slashVictim(e, 18, e.pos.clone().sub(p.pos), 'slice');
        FX.cracks(e.pos.clone(), 9, 11, INK);
      });
      try { sfx.slash(); } catch (e) {}
    }
    if (a.t >= .78 && a.stage < 2) {
      a.stage = 2;
      /* the second pass: the ones that were only opened, closed */
      FX.worldCut(origin.clone().add(new THREE.Vector3(0, -1.2, 0)), d, {
        len: 46, h: 9, color: 0xffffff, echo: RED, life: .36
      });
      var t2 = targets(36, 10);
      t2.forEach(function (e) {
        slashVictim(e, 14, e.pos.clone().sub(p.pos), 'twist');
      });
      if (t2.length && window.JJAW) window.JJAW.gain(8);
      addShake(.8);
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
        slashVictim(tgt, 46, kb, 'slice');
        if (tgt.hp > 0 && window.JJRAG) {
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
    begin('s3', 3.4, 's3', 'DIVINE FLAME', '\u958b');
    player.iframes = Math.max(player.iframes, 1.4);
  }

  /* the arrow itself: shaft, head, fletching, and the fire that is all of it */
  function buildArrow() {
    var g = new THREE.Group();
    function bit(w, h, d, c, em) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({
          color: c, roughness: .35, emissive: em || c, emissiveIntensity: 1.15
        }));
      return m;
    }
    var shaft = bit(.11, .11, 2.9, 0x2a0606, 0xff3a10);
    g.add(shaft);
    var head = bit(.28, .28, .75, 0xff7a22, 0xff5010);
    head.position.z = 1.7;
    g.add(head);
    var tip = bit(.1, .1, .4, 0xffe8b0, 0xffc060);
    tip.position.z = 2.2;
    g.add(tip);
    for (var i = 0; i < 3; i++) {
      var f = bit(.05, .42, .55, 0xff2a08, 0xff4010);
      f.position.z = -1.25;
      f.rotation.z = i * TAU / 3;
      g.add(f);
    }
    var glow = FX.billboard(FX.T.star, 0xff6a2a, .95);
    glow.scale.setScalar(3.6);
    glow.position.z = 1.5;
    g.add(glow);
    g.glow = glow;
    return g;
  }

  function detonate(at, dir) {
    FX.flash('#ff8a3a', .85, .45);
    FX.impact(at, 0xff6a2a, 4.2);
    FX.cross(at, 0xffe0a0, 8, .32);
    FX.rings(new THREE.Vector3(at.x, .1, at.z), 0xff6a2a, 5, { maxR: 22, life: .85, gap: 50 });
    FX.cracks(at.clone(), 16, 18, 0x2a1008);
    FX.debris(at.clone(), 22, 18, 0x4a2010);
    FX.dust(at.clone(), 14, 0xffb070, 8, 3);
    FX.mangaLines(1, .45);
    FX.zoom(-14, .9);
    addShake(2.2);
    if (AN) AN.camKick(2);
    enemies.forEach(function (e) {
      if (!e || e.dead || e.__gone) return;
      var dist = e.pos.distanceTo(at);
      if (dist > 16) return;
      var kb = e.pos.clone().sub(at).setY(0);
      if (kb.lengthSq() < .001) kb.copy(dir || fwd());
      kb.normalize().multiplyScalar(28 - dist); kb.y = 7;
      if (dist < 7 || e.hp / (e.maxHp || 100) <= .28) {
        if (window.JJGORE) {
          window.JJGORE.mark(e, 'burn', kb);
          e.hp = 0;
          try { e.die(); } catch (err) {}
          return;
        }
      }
      e.damage(38 - dist, kb, { react: 'sear', reactDur: 1, spark: 0xff8a3a });
    });
    try { sfx.blast(); } catch (e) {}
  }

  function stepFlame(a, dt) {
    var p = player, d = fwd();
    var hands = p.pos.clone().addScaledVector(d, 1.3).add(new THREE.Vector3(0, 3.1, 0));

    /* ---- 0.0 fire between closed palms ---- */
    if (a.t < .75) {
      if (Math.random() < .95) FX.mote(hands, 0xff5a2a, 6, .3);
      if (!a.spark) {
        a.spark = FX.billboard(FX.T.star, 0xff7a2a, .9);
        scene.add(a.spark);
        FX.converge(hands, 0xff8a3a, 22, 10, .7);
      }
      a.spark.position.copy(hands);
      a.spark.scale.setScalar(.4 + E.out(a.t / .75) * 2.2);
      addShake(.2);
    }

    /* ---- 0.75 the hands open and it becomes an arrow ---- */
    if (a.t >= .75 && a.stage < 1) {
      a.stage = 1;
      if (a.spark) { scene.remove(a.spark); a.spark.material.dispose(); a.spark = null; }
      a.arrow = buildArrow();
      scene.add(a.arrow);
      try { sfx.raise(); } catch (e) {}
    }
    if (a.arrow && a.stage < 2) {
      var grow = E.out(Math.min(1, (a.t - .75) / 1.1));
      a.arrow.position.copy(hands);
      a.arrow.lookAt(hands.clone().add(d));
      a.arrow.scale.setScalar(.4 + grow * 1.1);
      if (a.arrow.glow) a.arrow.glow.scale.setScalar(2.4 + grow * 2.4);
      if (Math.random() < .7) FX.mote(hands.clone().addScaledVector(d, 1.2), 0xff8a3a, 5, .3);
      addShake(.3);
    }

    /* ---- 2.05 released. It is slow. That is the point. ---- */
    if (a.t >= 2.05 && a.stage < 2) {
      a.stage = 2;
      a.fly = hands.clone();
      a.vdir = d.clone();
      FX.flash('#ff8a3a', .4, .16);
      addShake(.8);
    }
    if (a.stage === 2 && a.arrow) {
      a.fly.addScaledVector(a.vdir, dt * 38);
      a.arrow.position.copy(a.fly);
      a.arrow.lookAt(a.fly.clone().add(a.vdir));
      if (Math.random() < .9) FX.mote(a.fly.clone(), 0xff6a2a, 4, .25);
      var hit = null, hd = 2.6;
      enemies.forEach(function (e) {
        if (!e || e.dead) return;
        var dd = e.pos.clone().add(new THREE.Vector3(0, 2.4, 0)).distanceTo(a.fly);
        if (dd < hd) { hd = dd; hit = e; }
      });
      var gone = a.fly.distanceTo(hands) > 52;
      if (hit || gone) {
        a.stage = 3;
        var at = hit ? hit.pos.clone().add(new THREE.Vector3(0, 2.6, 0)) : a.fly.clone();
        scene.remove(a.arrow);
        a.arrow = null;
        detonate(at, a.vdir);
        if (window.JJAW) window.JJAW.gain(16);
      }
    }
    if (a.t >= a.dur - .05 && a.arrow) {
      scene.remove(a.arrow);
      a.arrow = null;
    }
  }

  /* -------------------------------------------- 4 · MALEVOLENT SHRINE
     An open Buddhist shrine — a zushi, twisted to enshrine demons.
     Bovine skulls for a base, a hip-and-gable roof with horns, four
     mouths for doors, human skulls hanging from the corners, and four
     gnarled stumps. No barrier. The city stays; the slashes go through it. */
  var SHRINE = { r: 52, dur: 11.2 };
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
    function skull(s, bovine) {
      var sg = new THREE.Group();
      sg.add(bone(s * 1.45, s * 1.15, s * 1.25, BONE));
      for (var i = -1; i <= 1; i += 2) {
        var sock = new THREE.Mesh(new THREE.BoxGeometry(s * .38, s * .42, s * .12),
          new THREE.MeshBasicMaterial({ color: 0x180208, toneMapped: false }));
        sock.position.set(i * s * .34, s * .16, s * .62);
        sg.add(sock);
      }
      if (bovine) {
        for (var h = -1; h <= 1; h += 2) {
          var horn = bone(s * .2, s * 1.2, s * .2, 0xd8c9ad);
          horn.position.set(h * s * .58, s * .9, 0);
          horn.rotation.z = h * .5;
          horn.rotation.x = -.25;
          sg.add(horn);
        }
      }
      var jaw = bone(s * 1.1, s * .35, s * .9, 0xd8c9ad);
      jaw.position.set(0, -s * .7, s * .15);
      sg.add(jaw);
      return sg;
    }

    /* the platform, ringed with bovine skulls */
    var base = bone(24, 1.3, 24, 0x2a2028);
    base.position.y = .65;
    g.add(base);
    var i;
    for (i = 0; i < 8; i++) {
      var a = (i / 8) * TAU;
      var sk = skull(1.45, true);
      sk.position.set(Math.cos(a) * 10.2, 1.7, Math.sin(a) * 10.2);
      sk.rotation.y = a + Math.PI;
      g.add(sk);
    }

    /* the cabinet */
    var body = bone(10.5, 12.4, 10.5, 0x3a2218);
    body.position.y = 8.2;
    g.add(body);

    /* four mouths for four doors */
    function mouth() {
      var mg = new THREE.Group();
      var hole = new THREE.Mesh(new THREE.BoxGeometry(5.6, 7.4, .35),
        new THREE.MeshBasicMaterial({ color: 0x0a0204, toneMapped: false }));
      mg.add(hole);
      for (var t = 0; t < 7; t++) {
        var up = bone(.58, 1.15, .42, 0xf0e6d0);
        up.position.set(-2.1 + t * .7, 3.15, .28);
        mg.add(up);
        var dn = bone(.52, .95, .42, 0xf0e6d0);
        dn.position.set(-2.1 + t * .7, -3.05, .28);
        mg.add(dn);
      }
      var tongue = bone(2.3, .5, 2.5, 0xa8203c);
      tongue.position.set(0, -1.7, .9);
      tongue.rotation.x = .42;
      mg.add(tongue);
      for (var c = -1; c <= 1; c += 2) {
        var fang = bone(.28, .7, .28, 0xf0e6d0);
        fang.position.set(c * 2.6, 3.5, .2);
        mg.add(fang);
      }
      return mg;
    }
    [[0, 0, 5.45, 0], [0, 0, -5.45, Math.PI],
      [5.45, 0, 0, Math.PI / 2], [-5.45, 0, 0, -Math.PI / 2]].forEach(function (s) {
      var m = mouth();
      m.position.set(s[0], 8.2, s[2]);
      m.rotation.y = s[3];
      g.add(m);
    });

    /* hip-and-gable roof */
    var hip = bone(17, 1.5, 17, 0x5a1a22);
    hip.position.y = 15;
    g.add(hip);
    var hip2 = bone(13, 1.3, 13, 0x4a121c);
    hip2.position.y = 16.3;
    g.add(hip2);
    var gable = bone(7.4, 3.4, 2.6, 0x6a1c28);
    gable.position.y = 18.6;
    g.add(gable);
    var ridge = bone(8.4, .55, 1.3, 0x8b1226);
    ridge.position.y = 20.4;
    g.add(ridge);
    /* a small mouth in each gable */
    for (var gb = -1; gb <= 1; gb += 2) {
      var gm = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, .2),
        new THREE.MeshBasicMaterial({ color: 0x180208, toneMapped: false }));
      gm.position.set(0, 18.2, gb * 1.4);
      g.add(gm);
    }

    /* crown: bovine skull and horns out of the roof */
    var crown = skull(1.7, true);
    crown.position.set(0, 21.6, 0);
    g.add(crown);
    for (var hh = -1; hh <= 1; hh += 2) {
      var rh = bone(.55, 5.2, .55, 0xd8c9ad);
      rh.position.set(hh * 3.6, 20.2, 0);
      rh.rotation.z = hh * .58;
      g.add(rh);
    }

    /* human skulls hanging from the four corners */
    [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(function (c) {
      var hs = skull(.9, false);
      hs.position.set(c[0] * 7.6, 13.4, c[1] * 7.6);
      g.add(hs);
    });

    /* gnarled stumps at the corners of the yard */
    [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(function (c) {
      var st = bone(1.8, 4.2, 1.8, 0x3a2a22);
      st.position.set(c[0] * 13, 2.4, c[1] * 13);
      st.rotation.z = c[0] * .12;
      st.rotation.x = c[1] * .08;
      g.add(st);
      for (var b = 0; b < 3; b++) {
        var br = bone(.35, 2.4, .35, 0x4a3428);
        br.position.set(c[0] * 13 + (b - 1) * .7, 5.2, c[1] * 13);
        br.rotation.z = (b - 1) * .5 + c[0] * .2;
        g.add(br);
      }
    });

    var lamp = new THREE.PointLight(0xffe0b0, 3.6, 80, 1.2);
    lamp.position.set(0, 22, 6);
    g.add(lamp);
    var lamp2 = new THREE.PointLight(0xff6a3a, 2.4, 70, 1.4);
    lamp2.position.set(0, 10, -8);
    g.add(lamp2);
    g.add(new THREE.AmbientLight(0x6a5a58, 1.15));
    g.sky = { material: { map: { offset: { x: 0 } } } };

    g.position.copy(center);
    g.rotation.y = player.facing;
    g.position.y -= 24;
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
      /* no barrier — the shrine stands in the city and the slashes go through it */
      FX.flash('#ff2a4a', .7, .4);
      FX.rings(new THREE.Vector3(a.center.x, .1, a.center.z), RED, 6, { maxR: 52, life: 1, gap: 70 });
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
      a.shrine.position.y = a.center.y - 24 * (1 - E.out(rise));
      if (rise >= 1) {
        /* the slashes that cut the world, not sparks around a dummy */
        a.cut = (a.cut || 0) + dt;
        if (a.cut > .18) {
          a.cut = 0;
          var ang = Math.random() * TAU;
          var from = a.center.clone().add(new THREE.Vector3(
            Math.cos(ang) * -SHRINE.r * .7, 1 + Math.random() * 6,
            Math.sin(ang) * -SHRINE.r * .7));
          var dir = new THREE.Vector3(Math.cos(ang + Math.PI), 0, Math.sin(ang + Math.PI));
          FX.worldCut(from, dir, {
            len: 38 + Math.random() * 28, h: 8 + Math.random() * 10,
            color: Math.random() < .35 ? RED : 0xffffff,
            echo: Math.random() < .5 ? RED : 0xffffff, life: .4
          });
        }
        a.tick = (a.tick || 0) + dt;
        if (a.tick > .32) {
          a.tick = 0;
          (a.locked || []).forEach(function (e) {
            if (!e || e.dead || e.__gone) return;
            var at2 = e.pos.clone().add(new THREE.Vector3(
              (Math.random() - .5) * 2, 1.5 + Math.random() * 2.5, (Math.random() - .5) * 2));
            FX.slash(at2, new THREE.Vector3(1, 0, 0), 0xffffff, 8, .2);
            e.stunT = Math.max(e.stunT || 0, .6);
            slashVictim(e, 11, e.pos.clone().sub(a.center), 'slice');
          });
          addShake(.4);
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
      { t: 1.5, yaw: -.25, d: 16, h: 9, ly: 7, k: 12 },
      { t: 3.4, yaw: -.7, d: 28, h: 16, ly: 10, k: 8 },            // the shrine, whole
      { t: 5.6, yaw: -.15, d: 22, h: 12, ly: 7, k: 9 },
      { t: 8.2, yaw: .55, d: 18, h: 8, ly: 5, k: 10 },
      { t: SHRINE.dur, yaw: .2, d: 14, h: 6, ly: 4, k: 12 }
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
      case 's3': {                                   // palms together, then spread, then loosed
        rp(r);
        if (t < .75) {
          var c = E.out(t / .75);
          r.shoulderR.rotation.x = -.4 - 1.15 * c;
          r.shoulderR.rotation.z = -.72 * c;
          r.elbowR.rotation.x = -1.55 * c;
          r.shoulderL.rotation.x = -.4 - 1.15 * c;
          r.shoulderL.rotation.z = .72 * c;
          r.elbowL.rotation.x = -1.55 * c;
          r.spine.rotation.x = .16 * c;
          r.neck.rotation.x = -.12 * c;
          r.hips.position.y = r.hipsBaseY - .16 * c;
          W(r, -.25 * c);
        } else if (t < 2.05) {                       // the arrow grows between them
          var s = E.out(Math.min(1, (t - .75) / 1.1));
          r.shoulderR.rotation.x = -1.55 - .15 * s;
          r.shoulderR.rotation.z = -.72 + .28 * s;
          r.elbowR.rotation.x = -1.55 + .85 * s;
          r.shoulderL.rotation.x = -1.55 - .1 * s;
          r.shoulderL.rotation.z = .72 - .22 * s;
          r.elbowL.rotation.x = -1.55 + .7 * s;
          r.spine.rotation.x = .16 - .08 * s;
          r.neck.rotation.x = -.12 - .1 * s;
          W(r, -.15);
        } else {                                     // one hand forward, loosing it
          var fire = E.out(Math.min(1, (t - 2.05) / .18));
          r.shoulderR.rotation.x = -1.7 - .25 * fire;
          r.shoulderR.rotation.z = -.44 + .2 * fire;
          r.elbowR.rotation.x = -.7 + .45 * fire;
          r.shoulderL.rotation.x = -1.65 + .5 * fire;
          r.shoulderL.rotation.z = .5 - .15 * fire;
          r.elbowL.rotation.x = -.85 + .4 * fire;
          r.spine.rotation.x = .08 - .4 * fire;
          r.neck.rotation.x = -.22;
          r.hips.position.y = r.hipsBaseY - .16 + .1 * fire;
          r.hipL.rotation.x = -.35 * fire;
          r.kneeL.rotation.x = .45 * fire;
          W(r, .55 * fire);
        }
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
    y1: ['s1', 1.35, 'DISMANTLE', '\u89e3'],
    y2: ['s2', 1.15, 'CLEAVE', '\u634c'],
    y3: ['s3', 3.4, 'DIVINE FLAME', '\u958b'],
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
    else player.iframes = Math.max(player.iframes, sw[0] === 's3' ? 1.4 : .35);
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
