/* =======================================================================
   CHOSO
   The eldest of the nine Death Painting Wombs, half cursed womb and half
   Kamo, which is why the family's technique is his: Blood Manipulation.

   Everything he does is his own blood, and it all comes out of one idea —
   compress it, and it stops being a fluid. From the source:

     1  PIERCING BLOOD    Convergence to the limit, then the hands clap
                          together and it leaves the fingertips at the
                          speed of sound. Two ways to throw it.
     2  BLOOD METEORITE   the same blood hardened into a solid and thrown
     3  SUPERNOVA         orbs of it, at speed, in every direction
     4  FLOWING RED SCALE temperature, pulse and red cell count up, and
                          everything he does with his body along with it
     R  BLOOD EDGE        hardened into an edge and swung

   PIERCING BLOOD, which is the one worth building properly, has two
   forms because the source gives it two. Tap it and it is the shot he
   put through Yuji's arm: one lance, no correction, gone before it can
   be read. Hold it and you get the other line from the source — that he
   can change the direction of the stream at the expense of its velocity.
   So holding drops you behind the clamped hands, in first person, with a
   stream that keeps going and an aim that turns slowly, because that is
   what the trade costs. Whatever the stream is on cannot move while it
   is on them, and can the moment it comes off.
   ===================================================================== */
(function () {
  'use strict';
  if (typeof player === 'undefined' || typeof THREE === 'undefined') return;
  var FX = window.JJFX;
  if (!FX || typeof CHARS === 'undefined') return;
  var AN = window.JJANIM;
  var E = FX.ease;
  var TAU = Math.PI * 2;

  var BLOOD = 0x8b0f2a, BRIGHT = 0xd4143c, DARK = 0x4a0512, PALE = 0xf0d8dc;

  var CH = window.JJCHOSO = { stream: null, scale: 0 };

  var CHOSO_CFG = {
    choso: true, face: true,
    torso: 0x1a1a22, pants: 0x14141a, shoes: 0x2a2a32, skin: 0xe8d5c8
  };

  /* ---------------------------------------------------------------- rig
     Black hair up in a knot with two long strands down the front, the
     mark across the bridge of the nose, and the high collar.
     ================================================================== */
  var _makeAnimeRig = makeAnimeRig;
  makeAnimeRig = function (cfg) {
    var r = _makeAnimeRig(cfg);
    if (!cfg || !cfg.choso) return r;
    var head = r.head, hair = 0x14121a, hairD = 0x0b0a10;

    function box(w, h, d, c, basic) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), basic
        ? new THREE.MeshBasicMaterial({ color: c, toneMapped: false })
        : new THREE.MeshStandardMaterial({ color: c, roughness: .74 }));
      m.castShadow = !basic;
      return m;
    }
    var i;
    /* the hair, pulled back and up */
    var cap = box(1.0, .3, 1.0, hair); cap.position.set(0, .97, -.02); head.add(cap);
    var backh = box(.94, .56, .3, hairD); backh.position.set(0, .7, -.42); head.add(backh);
    /* the knot on top */
    var knot = box(.44, .38, .44, hair); knot.position.set(0, 1.26, -.08); head.add(knot);
    var tie = box(.5, .1, .5, 0x3a1018); tie.position.set(0, 1.06, -.08); head.add(tie);
    var tuft = box(.28, .26, .28, hairD); tuft.position.set(0, 1.5, -.12); head.add(tuft);
    /* two long strands down the front of the face */
    for (i = -1; i <= 1; i += 2) {
      var strand = box(.16, 1.15, .16, hair);
      strand.position.set(i * .42, .42, .38);
      strand.rotation.x = -.05;
      head.add(strand);
      var tipS = box(.13, .34, .13, hairD);
      tipS.position.set(i * .44, -.2, .38);
      head.add(tipS);
    }
    var fringe = box(.9, .22, .14, hair); fringe.position.set(0, .86, .44); head.add(fringe);

    /* the eyes, and the mark across the bridge of his nose */
    for (i = -1; i <= 1; i += 2) {
      var eye = box(.15, .09, .05, 0x1a1420, true);
      eye.position.set(i * .21, .56, .46);
      head.add(eye);
    }
    var mark = box(.78, .11, .06, 0x1a1018, true);
    mark.position.set(0, .42, .46);
    head.add(mark);

    /* the collar, standing up the way it does */
    var collar = box(1.02, .46, .8, 0x101018);
    collar.position.set(0, 1.06, 0);
    r.spine.add(collar);
    var wrap = box(1.1, .3, .72, 0x3a0a14);
    wrap.position.set(0, .74, 0);
    r.spine.add(wrap);
    var sash = box(1.06, .16, .7, 0x6a0c1c);
    sash.position.set(0, .12, 0);
    r.hips.add(sash);

    /* the blood he has not used yet, kept out of sight until he does */
    var aura = new THREE.Group();
    aura.visible = false;
    r.spine.add(aura);
    r.chosoAura = aura;
    return r;
  };

  /* ------------------------------------------------------------- roster */
  cds.c1 = 0; cds.c2 = 0; cds.c3 = 0; cds.c4 = 0; cds.cr = 0;
  var CCD = { c1: 8, c2: 9, c3: 12, c4: 22, cr: 7 };

  CHARS.choso = {
    name: 'CHOSO', sub: 'BLOOD MANIPULATION — DEATH PAINTING',
    cfg: CHOSO_CFG, glow: '#d4143c',
    moves: [
      { key: 'LMB', lbl: 'Punch', cd: 'm1', max: .3 },
      { key: 'Q', lbl: 'Dash', cd: 'dash', max: 1 },
      { key: '1', lbl: 'Piercing Blood', cd: 'c1', max: CCD.c1 },
      { key: '2', lbl: 'Blood Meteorite', cd: 'c2', max: CCD.c2 },
      { key: '3', lbl: 'Supernova', cd: 'c3', max: CCD.c3 },
      { key: '4', lbl: 'Flowing Red Scale', cd: 'c4', max: CCD.c4 },
      { key: 'R', lbl: 'Blood Edge', cd: 'cr', max: CCD.cr }
    ]
  };
  try { CHARS.choso.portrait = makePortrait(CHOSO_CFG); } catch (e) {}
  try { buildCharList(); } catch (e) {}

  /* --------------------------------------------------------------- help */
  function ready(key) {
    return player.char === 'choso' && !player.dead && !busy() && cds[key] <= 0 &&
      !player.react && !(window.JJNAOYA && window.JJNAOYA.busy());
  }
  function start(type, dur, key, name, sub) {
    cds[key] = CCD[key];
    player.action = { type: type, t: 0, dur: dur, stage: 0 };
    if (name) { try { showSplash(name, sub || '', '#d4143c'); } catch (e) {} }
    return player.action;
  }
  function aim() {
    return new THREE.Vector3(Math.sin(player.facing), 0, Math.cos(player.facing));
  }
  /* Flowing Red Scale is a multiplier on everything he does with his body */
  function scale() { return CH.scale > 0 ? 1.35 : 1; }

  function inLine(from, dir, range, width, skip) {
    var out = [];
    for (var i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      if (!e || e.dead || (skip && skip.indexOf(e) >= 0)) continue;
      var to = e.pos.clone().add(new THREE.Vector3(0, 2.4, 0)).sub(from);
      var along = to.dot(dir);
      if (along < 0 || along > range) continue;
      if (to.addScaledVector(dir, -along).length() > width) continue;
      out.push(e);
    }
    return out;
  }

  /* =====================================================================
     1 · PIERCING BLOOD
     ================================================================== */
  var PB = {
    lance: { range: 74, width: 2.6, dmg: 46 },
    stream: { range: 60, width: 2.2, dps: 46, turn: 1.35, max: 4.2 }
  };

  /* the shot itself: one line, drawn thin and long, with the pressure
     behind it rather than around it */
  function lance(from, dir, len, wide) {
    var to = from.clone().addScaledVector(dir, len);
    FX.cutLine(from.clone(), to, 0xffdde4, wide * 1.5, .2);
    FX.beam(from.clone(), dir, len, BRIGHT, { radius: wide * .5, life: .28 });
    FX.beam(from.clone(), dir, len, 0xffffff, { radius: wide * .18, life: .24 });
    for (var i = 0; i < 7; i++) {
      var at = from.clone().addScaledVector(dir, len * (i + 1) / 8);
      FX.streaks(at, BLOOD, 2, 14, 1.1);
    }
    FX.impact(from.clone().addScaledVector(dir, 1.4), BRIGHT, 1.4);
  }

  function castPierce() {
    if (!ready('c1')) return;
    var a = start('c1', .62, 'c1', 'PIERCING BLOOD', '貫流');
    a.held = true;                        // released by the keyup handler
    a.fired = false;
    player.iframes = Math.max(player.iframes, .18);
  }

  function stepPierce(a, dt) {
    var p = player;
    /* Convergence: it is pulled in before it is let go */
    if (a.t < .3) {
      var hands = p.pos.clone().addScaledVector(aim(), 1.1).add(new THREE.Vector3(0, 3.1, 0));
      if (Math.random() < .8) FX.mote(hands, BLOOD, 3.4, .3);
      if (a.t > .16 && Math.random() < .4) FX.streaks(hands, BRIGHT, 1, 5, .8);
      return;
    }
    if (!a.fired) {
      a.fired = true;
      var d = aim();
      var from = p.pos.clone().addScaledVector(d, 1.4).add(new THREE.Vector3(0, 3.1, 0));
      lance(from, d, PB.lance.range, PB.lance.width);
      FX.flash('#ffd9dd', .3, .18);
      FX.mangaLines(.6, .25);
      addShake(1);
      FX.zoom(-7, .35);
      if (AN) AN.camKick(1.1);
      if (typeof hitstop === 'function') hitstop(.08);
      try { sfx.stab(); } catch (e) {}
      p.vel.addScaledVector(d, -7);        // it has a recoil
      inLine(from, d, PB.lance.range, PB.lance.width, null).forEach(function (e) {
        e.damage(PB.lance.dmg * scale(), d.clone().multiplyScalar(16).setY(6), {
          react: 'slash', reactDur: .5, spark: BRIGHT, color: '#ff5f7a',
          bleed: true, death: 'sever'
        });
      });
      if (window.JJAW) window.JJAW.gain(12);
    }
    /* still holding it when the shot is done: it does not stop, it turns */
    if (a.t >= .5 && a.held && !CH.stream) openStream();
  }

  /* --------------------------------------------------- the held stream */
  function openStream() {
    if (CH.stream) return;
    var s = CH.stream = {
      t: 0, yaw: player.facing, pitch: 0, hit: [], tick: 0, spit: 0
    };
    player.action = { type: 'c1s', t: 0, dur: PB.stream.max };
    player.iframes = Math.max(player.iframes, .2);
    /* the head and the collar are both at eye level in here */
    if (player.rig.head) player.rig.head.visible = false;
    if (player.rig.neck) player.rig.neck.visible = false;
    s.hid = [];
    player.rig.spine.children.forEach(function (c) {
      if (c.isMesh && c.visible && c.position.y > .55) { c.visible = false; s.hid.push(c); }
    });
    if (AN) AN.camRelease();
    FX.letterbox(false);
    if (window.JJNOTICE) window.JJNOTICE('HOLDING — RELEASE TO STOP', '#ff5f7a');
    try { sfx.redFire(); } catch (e) {}
  }

  function shutStream() {
    if (!CH.stream) return;
    var s = CH.stream;
    CH.stream = null;
    if (player.rig.head) player.rig.head.visible = true;
    if (player.rig.neck) player.rig.neck.visible = true;
    (s.hid || []).forEach(function (c) { c.visible = true; });
    if (player.action && player.action.type === 'c1s') player.action = null;
    player.iframes = Math.max(player.iframes, .25);
    /* everything it was holding down is let go */
    s.hit.forEach(function (e) { if (e && e.pinned) e.pinned = 0; });
    FX.streaks(player.pos.clone().add(new THREE.Vector3(0, 3, 0)), BLOOD, 6, 10, 1);
  }

  /* where the stream comes out of: between the clamped hands */
  var HAND_Y = 4.15;                       // where the clamped hands end up
  function muzzle() {
    var s = CH.stream;
    var d = streamDir();
    return player.pos.clone().addScaledVector(d, 2.3)
      .add(new THREE.Vector3(0, HAND_Y + Math.sin(s.t * 9) * .05, 0));
  }
  function streamDir() {
    var s = CH.stream;
    return new THREE.Vector3(
      Math.sin(s.yaw) * Math.cos(s.pitch), Math.sin(s.pitch), Math.cos(s.yaw) * Math.cos(s.pitch));
  }

  function stepStream(dt) {
    var s = CH.stream;
    if (!s) return;
    s.t += dt;
    var p = player;
    p.vel.x *= Math.pow(.02, dt);          // he is braced, not walking
    p.vel.z *= Math.pow(.02, dt);

    /* the trade the source names: the direction can be changed, and what
       it costs is the speed of changing it */
    var wantYaw = camYaw + Math.PI;
    var dy = wantYaw - s.yaw;
    while (dy > Math.PI) dy -= TAU;
    while (dy < -Math.PI) dy += TAU;
    s.yaw += Math.max(-PB.stream.turn * dt, Math.min(PB.stream.turn * dt, dy));
    var wantPitch = -camPitch * .8;
    s.pitch += Math.max(-PB.stream.turn * .7 * dt,
      Math.min(PB.stream.turn * .7 * dt, wantPitch - s.pitch));
    p.facing = s.yaw;

    var d = streamDir(), from = muzzle();

    /* the stream: a line that is always there rather than a shot repeated */
    s.spit += dt;
    if (s.spit > .04) {
      s.spit = 0;
      var len = PB.stream.range;
      FX.beam(from.clone(), d, len, BRIGHT, { radius: .5, life: .1 });
      FX.beam(from.clone(), d, len, 0xffffff, { radius: .17, life: .09 });
      FX.streaks(from.clone().addScaledVector(d, 2 + Math.random() * 20), BLOOD, 1, 16, 1);
    }
    if (Math.random() < dt * 26) FX.mote(from.clone(), BLOOD, 1.4, .2);
    addShake(.12);

    /* what it is on cannot move, and can again the moment it is not */
    s.tick += dt;
    if (s.tick > .12) {
      s.tick = 0;
      var caught = inLine(from, d, PB.stream.range, PB.stream.width, null);
      caught.forEach(function (e) {
        if (s.hit.indexOf(e) < 0) s.hit.push(e);
        e.pinned = .3;
        e.stunT = Math.max(e.stunT || 0, .34);
        e.lockT = Math.max(e.lockT || 0, .18);
        if (e.vel) e.vel.set(0, 0, 0);
        var at = e.pos.clone().add(new THREE.Vector3(0, 2.5, 0));
        FX.impact(at, BRIGHT, 1);
        FX.blood(at, d.clone(), 3, .9);
        e.damage(PB.stream.dps * .12 * scale(), null, {
          react: 'shock', reactDur: .3, spark: BRIGHT, color: '#ff5f7a',
          bleed: true, stun: .34, fin: false, pin: .3
        });
      });
      if (caught.length) addShake(.3);
    }

    if (s.t >= PB.stream.max) shutStream();
  }

  /* first person, over the clamped hands */
  function streamCamera(dt) {
    var s = CH.stream;
    var d = streamDir();
    /* over the arms rather than between them: from up here they run away
       from the eye and the two hands sit in the bottom of the frame with
       the stream leaving from between them, which is the shot */
    var eye = player.pos.clone()
      .add(new THREE.Vector3(0, HAND_Y + .95, 0))
      .addScaledVector(d, -.35);
    camera.position.lerp(eye, Math.min(1, dt * 24));
    var look = eye.clone().addScaledVector(d, 24);
    camera.lookAt(look.x, look.y, look.z);
    shakeMag = Math.max(shakeMag, .1);
  }

  /* =====================================================================
     2 · BLOOD METEORITE
     ================================================================== */
  function castMeteorite() {
    if (!ready('c2')) return;
    start('c2', 1.05, 'c2', 'BLOOD METEORITE', '血隕');
  }
  function stepMeteorite(a, dt) {
    var p = player, d = aim();
    var hand = p.pos.clone().addScaledVector(d, .9).add(new THREE.Vector3(0, 4.2, 0));
    if (a.t < .45) {
      if (!a.orb) {
        a.orb = FX.billboard(FX.T.star, BLOOD, .95);
        scene.add(a.orb);
        FX.converge(hand, BRIGHT, 24, 10, .6);
      }
      a.orb.position.copy(hand);
      a.orb.scale.setScalar(.8 + E.out(a.t / .45) * 3.2);
      return;
    }
    if (a.stage < 1) {
      a.stage = 1;
      if (a.orb) { scene.remove(a.orb); a.orb.material.dispose(); a.orb = null; }
      /* hardened, and thrown */
      var rock = new THREE.Mesh(new THREE.SphereGeometry(1.5, 12, 10),
        new THREE.MeshStandardMaterial({ color: DARK, roughness: .5 }));
      var shell = FX.billboard(FX.T.star, BRIGHT, .8);
      shell.scale.setScalar(5.5);
      rock.add(shell);
      rock.position.copy(hand);
      scene.add(rock);
      var v = d.clone().multiplyScalar(46); v.y = 5;
      var t = 0, done = false;
      addFx({ t: 3, update: function (dd) {
        this.t -= dd; t += dd;
        v.y -= 22 * dd;
        rock.position.addScaledVector(v, dd);
        rock.rotation.x += dd * 7; rock.rotation.z += dd * 5;
        if (Math.random() < dd * 30) FX.mote(rock.position.clone(), BLOOD, 2, .3);
        var near = null;
        for (var i = 0; i < enemies.length; i++) {
          var e = enemies[i];
          if (!e || e.dead) continue;
          if (e.pos.clone().add(new THREE.Vector3(0, 2.4, 0)).distanceTo(rock.position) < 3.4) { near = e; break; }
        }
        if (!done && (near || rock.position.y <= .8 || this.t <= 0)) {
          done = true;
          var at = rock.position.clone();
          FX.impact(at, BRIGHT, 4);
          FX.cross(at, 0xffdde4, 7, .3);
          FX.rings(at, BLOOD, 4, { maxR: 20, life: .7, ground: false, gap: 40 });
          FX.cracks(new THREE.Vector3(at.x, 0, at.z), 11, 17, 0x2a0810);
          FX.debris(new THREE.Vector3(at.x, 0, at.z), 16, 18, DARK);
          FX.blood(at, new THREE.Vector3(0, 1, 0), 14, 1.5);
          addShake(2);
          if (typeof hitstop === 'function') hitstop(.1);
          try { sfx.redBoom(); } catch (e) {}
          enemies.forEach(function (e) {
            if (!e || e.dead || e.pos.distanceTo(at) > 12) return;
            var kb = e.pos.clone().sub(at).setY(0).normalize().multiplyScalar(28); kb.y = 13;
            e.damage(40 * scale(), kb, {
              react: 'blow', reactDur: .9, spark: BRIGHT, color: '#ff5f7a', death: 'sever'
            });
          });
          if (window.JJAW) window.JJAW.gain(12);
          scene.remove(rock);
          rock.traverse(function (c) { if (c.isMesh) c.material.dispose(); });
          return false;
        }
        return !done;
      } });
    }
  }

  /* =====================================================================
     3 · SUPERNOVA
     ================================================================== */
  function castSupernova() {
    if (!ready('c3')) return;
    start('c3', 1.5, 'c3', 'SUPERNOVA', '超新星');
    player.iframes = Math.max(player.iframes, .4);
  }
  function stepSupernova(a, dt) {
    var p = player;
    var mid = p.pos.clone().add(new THREE.Vector3(0, 3, 0));
    if (a.t < .5) {
      if (Math.random() < .9) FX.mote(mid, BLOOD, 5, .35);
      addShake(.2 + a.t * .5);
      return;
    }
    if (a.stage < 1) {
      a.stage = 1;
      FX.flash('#ff9aae', .45, .3);
      FX.rings(mid, BRIGHT, 4, { maxR: 16, life: .6, ground: false, gap: 34 });
      addShake(1.4);
      try { sfx.redFire(); } catch (e) {}
      /* orbs in every direction, each one going somewhere of its own */
      for (var i = 0; i < 18; i++) {
        (function (n) {
          setTimeout(function () {
            if (typeof scene === 'undefined') return;
            var ang = n / 18 * TAU + Math.random() * .3;
            var rise = -.15 + Math.random() * .5;
            var d = new THREE.Vector3(Math.cos(ang), rise, Math.sin(ang)).normalize();
            var orb = FX.billboard(FX.T.star, n % 3 ? BRIGHT : BLOOD, .95);
            orb.scale.setScalar(1.8);
            orb.position.copy(mid);
            scene.add(orb);
            var sp = 34 + Math.random() * 16, t = 0, hit = false;
            addFx({ t: 1.4, update: function (dd) {
              this.t -= dd; t += dd;
              orb.position.addScaledVector(d, sp * dd);
              FX.faceCam(orb, 0);
              orb.material.opacity = Math.min(1, this.t / .4);
              if (Math.random() < dd * 18) FX.mote(orb.position.clone(), BLOOD, 1, .2);
              if (!hit) {
                for (var j = 0; j < enemies.length; j++) {
                  var e = enemies[j];
                  if (!e || e.dead) continue;
                  if (e.pos.clone().add(new THREE.Vector3(0, 2.4, 0)).distanceTo(orb.position) > 2.8) continue;
                  hit = true;
                  var at = orb.position.clone();
                  FX.impact(at, BRIGHT, 1.6);
                  FX.blood(at, d.clone(), 5, 1.1);
                  e.damage(15 * scale(), d.clone().multiplyScalar(11).setY(5), {
                    react: 'slash', reactDur: .3, spark: BRIGHT, color: '#ff5f7a',
                    bleed: true, death: 'dice'
                  });
                  addShake(.4);
                  break;
                }
              }
              if (hit || this.t <= 0) { scene.remove(orb); orb.material.dispose(); return false; }
              return true;
            } });
          }, n * 26);
        })(i);
      }
      if (window.JJAW) window.JJAW.gain(14);
    }
  }

  /* =====================================================================
     4 · FLOWING RED SCALE
     ================================================================== */
  var SCALE_DUR = 15;
  function castScale() {
    if (!ready('c4')) return;
    start('c4', 1.1, 'c4', 'FLOWING RED SCALE', '\u8d64\u9c57');
    CH.scale = SCALE_DUR;
    player.iframes = Math.max(player.iframes, .5);
    if (!CH.aura) CH.aura = FX.aura(function () { return player.pos; }, BRIGHT);
    FX.flash('#ff6a80', .4, .4);
    FX.rings(new THREE.Vector3(player.pos.x, .1, player.pos.z), BRIGHT, 4,
      { maxR: 12, life: .7, gap: 50 });
    addShake(1.2);
    try { sfx.raise(); } catch (e) {}
  }
  function stepScale(a, dt) {
    var mid = player.pos.clone().add(new THREE.Vector3(0, 2.6, 0));
    if (Math.random() < .7) FX.mote(mid, BRIGHT, 4, .4);
    if (a.t > .4 && Math.random() < .2) FX.streaks(mid, BLOOD, 2, 8, 1);
  }

  /* =====================================================================
     R · BLOOD EDGE
     ================================================================== */
  function castEdge() {
    if (!ready('cr')) return;
    start('cr', .78, 'cr', 'BLOOD EDGE', '血刃');
    player.iframes = Math.max(player.iframes, .3);
  }
  function stepEdge(a, dt) {
    var p = player, d = aim();
    if (a.t < .26) {
      p.pos.addScaledVector(d, dt * 26);   // he steps into it
      return;
    }
    if (a.stage < 1) {
      a.stage = 1;
      var at = p.pos.clone().addScaledVector(d, 3).add(new THREE.Vector3(0, 2.8, 0));
      var side = new THREE.Vector3(-d.z, 0, d.x);
      FX.cutLine(at.clone().addScaledVector(side, -5).add(new THREE.Vector3(0, 2.4, 0)),
        at.clone().addScaledVector(side, 5).add(new THREE.Vector3(0, -2.4, 0)), 0xffdde4, 1.2, .3);
      FX.slash(at, d, BRIGHT, 7, .22);
      FX.impact(at, BRIGHT, 2.4);
      FX.blood(at, d.clone().setY(.3), 8, 1.2);
      addShake(1.1);
      if (typeof hitstop === 'function') hitstop(.08);
      try { sfx.slash(); } catch (e) {}
      inLine(p.pos.clone().add(new THREE.Vector3(0, 2.4, 0)), d, 9, 4, null).forEach(function (e) {
        e.damage(30 * scale(), d.clone().multiplyScalar(20).setY(8), {
          react: 'slash', reactDur: .6, spark: BRIGHT, color: '#ff5f7a',
          bleed: true, death: 'sever'
        });
      });
      if (window.JJAW) window.JJAW.gain(10);
    }
  }

  /* =====================================================================
     POSES
     ================================================================== */
  function rp(r) { resetPose(r); if (r.body) r.body.rotation.set(0, 0, 0); }

  /* the hands clamped together and pointed down the line of the shot:
     wrists together, fingers out, both arms straight */
  function poseClamp(r, k, aimUp) {
    var out = E.out(Math.min(1, k));
    r.shoulderL.rotation.x = -1.62 * out + (aimUp || 0);
    r.shoulderR.rotation.x = -1.62 * out + (aimUp || 0);
    r.shoulderL.rotation.z = .3 * out;      // brought together in front
    r.shoulderR.rotation.z = -.3 * out;
    r.elbowL.rotation.x = -.06 * out;
    r.elbowR.rotation.x = -.06 * out;
    r.spine.rotation.x = -.12 * out;
    r.neck.rotation.x = -.16 * out;
    r.hipL.rotation.x = -.3 * out;
    r.kneeL.rotation.x = .55 * out;
    r.hipR.rotation.x = .2 * out;
    r.kneeR.rotation.x = .25 * out;
    r.hips.position.y = r.hipsBaseY - .3 * out;
  }

  function poseChoso(r, a) {
    var t = a.t;
    switch (a.type) {
      case 'c1': {
        rp(r);
        /* pulled in, and then let go */
        var pull = E.out(Math.min(1, t / .3));
        var fire = t >= .3 ? E.out(Math.min(1, (t - .3) / .12)) : 0;
        if (t < .3) {
          /* Convergence: both hands in at the chest, compressing it */
          r.shoulderL.rotation.x = -1.15 * pull;
          r.shoulderR.rotation.x = -1.15 * pull;
          r.shoulderL.rotation.z = .78 * pull;
          r.shoulderR.rotation.z = -.78 * pull;
          r.elbowL.rotation.x = -1.72 * pull;
          r.elbowR.rotation.x = -1.72 * pull;
          r.spine.rotation.x = .26 * pull;
          r.neck.rotation.x = .2 * pull;
          r.hips.position.y = r.hipsBaseY - .34 * pull;
          r.kneeL.rotation.x = .5 * pull; r.kneeR.rotation.x = .45 * pull;
        } else {
          poseClamp(r, fire, 0);
        }
        return true;
      }
      case 'c1s': {                                  // holding the stream
        rp(r);
        poseClamp(r, 1, CH.stream ? -CH.stream.pitch : 0);
        var shake = Math.sin(t * 34) * .022;
        r.shoulderL.rotation.x += shake;
        r.shoulderR.rotation.x -= shake;
        r.spine.rotation.x += shake * .6;
        return true;
      }
      case 'c2': {                                   // up over the head, thrown
        rp(r);
        var u = t < .45 ? E.out(t / .45) : 1;
        var th = t >= .45 ? E.out(Math.min(1, (t - .45) / .18)) : 0;
        r.shoulderR.rotation.x = -.4 - 2.7 * u + 3.4 * th;
        r.shoulderR.rotation.z = -.24 * u;
        r.elbowR.rotation.x = -.5 - 1.05 * u + 1.4 * th;
        r.shoulderL.rotation.x = -.4 - .9 * u + .5 * th;
        r.elbowL.rotation.x = -1.1 * u;
        r.spine.rotation.x = -.38 * u + .82 * th;
        r.spine.rotation.y = .3 * u - .5 * th;
        r.neck.rotation.x = -.3 * u + .55 * th;
        r.hips.position.y = r.hipsBaseY + .2 * u - .4 * th;
        return true;
      }
      case 'c3': {                                   // arms out, and opened
        rp(r);
        var c = t < .5 ? E.out(t / .5) : 1;
        var burst = t >= .5 ? E.out(Math.min(1, (t - .5) / .2)) : 0;
        r.shoulderL.rotation.x = -1.3 * c + .5 * burst;
        r.shoulderR.rotation.x = -1.3 * c + .5 * burst;
        r.shoulderL.rotation.z = .55 * c + .8 * burst;
        r.shoulderR.rotation.z = -.55 * c - .8 * burst;
        r.elbowL.rotation.x = -1.5 * c + 1.4 * burst;
        r.elbowR.rotation.x = -1.5 * c + 1.4 * burst;
        r.spine.rotation.x = .2 * c - .5 * burst;
        r.neck.rotation.x = .18 * c - .55 * burst;
        r.hips.position.y = r.hipsBaseY - .4 * c + .5 * burst;
        r.kneeL.rotation.x = .6 * c - .5 * burst;
        r.kneeR.rotation.x = .55 * c - .45 * burst;
        return true;
      }
      case 'c4': {                                   // one fist closed, held
        rp(r);
        var s = E.out(Math.min(1, t / .6));
        var pulse = Math.sin(t * 12) * .05 * s;
        r.shoulderR.rotation.x = -.5 - .8 * s;
        r.shoulderR.rotation.z = -.5 * s;
        r.elbowR.rotation.x = -1.9 * s + pulse;
        r.shoulderL.rotation.x = -.4 - .35 * s;
        r.elbowL.rotation.x = -.7 * s;
        r.spine.rotation.x = -.2 * s + pulse;
        r.neck.rotation.x = -.3 * s;
        r.hips.position.y = r.hipsBaseY - .2 * s;
        r.kneeL.rotation.x = .35 * s; r.kneeR.rotation.x = .3 * s;
        return true;
      }
      case 'cr': {                                   // a blade, drawn across
        rp(r);
        var w = t < .26 ? E.out(t / .26) : 1;
        var sw = t >= .26 ? E.out(Math.min(1, (t - .26) / .16)) : 0;
        r.shoulderR.rotation.x = -.3 - 2.1 * w + 2.9 * sw;
        r.shoulderR.rotation.z = -1.15 * w + 1.6 * sw;
        r.elbowR.rotation.x = -1 * w + .95 * sw;
        r.shoulderL.rotation.x = -.5 - .5 * w + .3 * sw;
        r.shoulderL.rotation.z = .45 * w + .2 * sw;
        r.elbowL.rotation.x = -1.15 * w;
        r.spine.rotation.y = .68 * w - 1.2 * sw;
        r.spine.rotation.x = -.2 * w + .4 * sw;
        r.neck.rotation.y = -.3 * w + .48 * sw;
        r.hips.position.y = r.hipsBaseY - .2 * w - .2 * sw;
        return true;
      }
    }
    return false;
  }

  /* =====================================================================
     WIRING
     ================================================================== */
  var _stepAction = stepAction;
  stepAction = function (a, dt) {
    switch (a.type) {
      case 'c1': return stepPierce(a, dt);
      case 'c1s': return;                    // driven by its own tick
      case 'c2': return stepMeteorite(a, dt);
      case 'c3': return stepSupernova(a, dt);
      case 'c4': return stepScale(a, dt);
      case 'cr': return stepEdge(a, dt);
    }
    return _stepAction(a, dt);
  };

  var _poseAction = poseAction;
  poseAction = function (r, a) {
    if (r === player.rig && player.char === 'choso' && poseChoso(r, a)) return;
    /* a remote Choso holding the stream poses off the same table */
    if (a && (a.type === 'c1s' || (a.type || '').charAt(0) === 'c') && poseChoso(r, a)) return;
    return _poseAction(r, a);
  };

  var _updateCamera = updateCamera;
  updateCamera = function (dt) {
    if (CH.stream) { streamCamera(dt); return; }
    return _updateCamera(dt);
  };

  /* Being held by a stream has to stop a player moving, and the movement
     is read straight off the key table every frame — so for those frames
     the keys are simply not down. Put back immediately afterwards, so
     nothing else in the game can tell. */
  var MOVE = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'];
  var _updatePlayer = updatePlayer;
  updatePlayer = function (dt) {
    var held = player.pinned > 0 && !player.dead;
    var saved = null;
    if (held) {
      saved = {};
      MOVE.forEach(function (k) { saved[k] = keys[k]; keys[k] = false; });
      player.vel.x = 0; player.vel.z = 0;
    }
    _updatePlayer(dt);
    if (held) MOVE.forEach(function (k) { keys[k] = saved[k]; });
    if (CH.scale > 0) {
      CH.scale = Math.max(0, CH.scale - dt);
      if (CH.scale <= 0 && CH.aura) { CH.aura.stop(); CH.aura = null; }
    }
    if (CH.stream) {
      if (player.dead || player.char !== 'choso') shutStream();
      else stepStream(dt);
    }
    /* being held down by somebody else's stream: the keys stop answering */
    if (player.pinned > 0) player.pinned = Math.max(0, player.pinned - dt);
  };

  /* whatever the stream is on cannot walk out of it */
  var _enemyUpdate = Enemy.prototype.update;
  Enemy.prototype.update = function (dt) {
    if (this.pinned > 0) {
      this.pinned = Math.max(0, this.pinned - dt);
      if (this.vel) this.vel.set(0, 0, 0);
    }
    return _enemyUpdate.call(this, dt);
  };

  /* his keys */
  window.addEventListener('keydown', function (e) {
    if (!started || player.char !== 'choso' || e.repeat) return;
    if (player.react || (player.action && (player.action.type === 'kb' || player.action.type === 'void'))) return;
    var hit = true;
    if (e.code === 'Digit1') castPierce();
    else if (e.code === 'Digit2') castMeteorite();
    else if (e.code === 'Digit3') castSupernova();
    else if (e.code === 'Digit4') castScale();
    else if (e.code === 'KeyR') castEdge();
    else hit = false;
    if (hit) e.stopImmediatePropagation();
  }, true);

  /* letting go is what ends the stream — and what decides which of the two
     Piercing Blood was in the first place */
  window.addEventListener('keyup', function (e) {
    if (e.code !== 'Digit1') return;
    if (player.action && player.action.type === 'c1') player.action.held = false;
    if (CH.stream) shutStream();
  }, true);

  /* the swap takes the stream and the scale with it */
  var _switchChar = switchChar;
  switchChar = function (id) {
    if (CH.stream) shutStream();
    if (CH.scale > 0) { CH.scale = 0; if (CH.aura) { CH.aura.stop(); CH.aura = null; } }
    return _switchChar(id);
  };

  CH.stopStream = shutStream;
})();
