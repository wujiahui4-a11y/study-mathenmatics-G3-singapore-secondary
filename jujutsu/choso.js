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

  /* The palette, and every entry in it is dark.

     There is no bright red here on purpose. The hit confirm sets the
     victim's emissive from `spark`, so a bright value makes the body they
     are standing in glow — which is the same mistake as a glowing beam,
     just on somebody else's mesh. A dark red emissive reads as blood
     soaking through and adds almost nothing to the frame. */
  var BLOOD = 0x4e0512, BRIGHT = 0x6d0a1c, DARK = 0x1c0106, PALE = 0x8c1526;

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
    /* THE HAIR
       The old version had one flat slab for a fringe, which is the one
       thing his hair is not. What it actually is: a mass swept up and
       back into the knot, and then a ragged fringe of separate points
       hanging over the forehead at different lengths and different
       angles, with a long strand down each side of the face. So the
       fringe is built as nine separate spikes rather than a block —
       every one a different width, length and tilt, because a row of
       matching teeth reads as a comb. */
    var cap = box(1.02, .32, 1.02, hair); cap.position.set(0, .97, -.02); head.add(cap);
    var backh = box(.96, .62, .34, hairD); backh.position.set(0, .68, -.44); head.add(backh);
    /* swept up at the sides, into the knot */
    for (i = -1; i <= 1; i += 2) {
      var sweep = box(.2, .5, .74, hair);
      sweep.position.set(i * .46, .86, -.1);
      sweep.rotation.z = i * .16;
      head.add(sweep);
    }
    /* the knot, and the tie under it */
    var tie = box(.5, .12, .5, 0x3a1018); tie.position.set(0, 1.1, -.08); head.add(tie);
    var knot = box(.46, .4, .46, hair); knot.position.set(0, 1.32, -.09); head.add(knot);
    var knot2 = box(.34, .26, .34, hairD); knot2.position.set(0, 1.56, -.13); head.add(knot2);
    var tuft = box(.16, .3, .16, hairD);
    tuft.position.set(.1, 1.7, -.16); tuft.rotation.z = -.4; head.add(tuft);

    /* The fringe: nine points, none of them the same length, width or
       angle. They hang from the hairline onto the FOREHEAD and stop
       there — the eyes at .55 and the mark at .42 stay clear, with only
       the two long accents reaching down past the brow. A fringe that
       covers the face hides the two things that identify him. */
    var SPIKE = [
      /*  x     len   w     tilt   z   */
      [-.42, .26, .17, .32, .40],
      [-.31, .20, .13, .16, .44],
      [-.21, .38, .15, -.10, .44],
      [-.08, .22, .14, .05, .47],
      [.04, .34, .16, -.20, .46],
      [.16, .19, .12, .20, .45],
      [.26, .30, .15, -.15, .43],
      [.38, .24, .14, -.33, .40],
      [-.13, .16, .11, .42, .48]
    ];
    for (i = 0; i < SPIKE.length; i++) {
      var sp = SPIKE[i];
      var pt = box(sp[2], sp[1], .13, i % 3 ? hair : hairD);
      /* hung from the hairline, so the length grows downward */
      pt.position.set(sp[0], .94 - sp[1] / 2, sp[4]);
      pt.rotation.z = sp[3];
      head.add(pt);
      /* a darker tip, which is what makes it read as a point */
      var tip = box(sp[2] * .62, .14, .12, hairD);
      tip.position.set(sp[0] - Math.sin(sp[3]) * (sp[1] / 2), .94 - sp[1] - .04, sp[4] + .01);
      tip.rotation.z = sp[3];
      head.add(tip);
    }

    /* The long strand down each side of the face, past the jaw. Held out
       at the edge of the head and forward of it, so it frames the face
       rather than sitting on top of it. */
    for (i = -1; i <= 1; i += 2) {
      var strand = box(.16, 1.3, .2, hair);
      strand.position.set(i * .5, .34, .34);
      strand.rotation.z = i * .06;
      head.add(strand);
      var tipS = box(.12, .28, .16, hairD);
      tipS.position.set(i * .54, -.4, .34);
      tipS.rotation.z = i * .12;
      head.add(tipS);
    }

    /* the eyes, the shadow around them, and the mark across the bridge
       of his nose — the one he opens when he needs ammunition */
    for (i = -1; i <= 1; i += 2) {
      var shade = box(.28, .19, .04, 0x6b4a63, true);
      shade.position.set(i * .21, .57, .455);
      head.add(shade);
      var eye = box(.16, .085, .05, 0x1a1420, true);
      eye.position.set(i * .21, .55, .46);
      head.add(eye);
    }
    var mark = box(.8, .12, .06, 0x1a1018, true);
    mark.position.set(0, .42, .46);
    head.add(mark);
    r.chosoMark = mark;

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
  cds.c1 = 0; cds.c2 = 0; cds.c3 = 0; cds.c4 = 0; cds.cr = 0; cds.caw = 0;
  cds.ca1 = 0; cds.ca2 = 0; cds.ca3 = 0; cds.ca4 = 0;
  var CCD = { c1: 8, c2: 9, c3: 12, c4: 22, cr: 7,
    /* the four he gets when the curse half is out */
    ca1: 7, ca2: 10, ca3: 11, ca4: 20 };

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
      { key: 'R', lbl: 'Blood Edge', cd: 'cr', max: CCD.cr },
      { key: 'F', lbl: 'Death Painting', cd: 'caw', max: 1 }
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
  function scale() {
    /* Flowing Red Scale, or the awakening — which holds it open for its
       whole duration rather than making him spend a slot on it */
    if (CH.scale > 0) return 1.35;
    return (window.JJAW && window.JJAW.choso) ? 1.35 : 1;
  }
  function awake() { return !!(window.JJAW && window.JJAW.choso); }

  /* THE POISON
     The one thing that is his and nobody else's. Death Painting blood is
     poisonous to humans when it mixes with theirs — the backlash off it
     put Naoya Zen'in on the floor — so while the curse half of him is out,
     everything he lands keeps working after it has landed. */
  function venom(ent, secs) {
    if (!ent || ent.dead) return;
    ent.psn = Math.max(ent.psn || 0, secs == null ? 6 : secs);
  }
  function stepVenom(ent, dt, isPlayer) {
    if (!ent || !ent.psn || ent.psn <= 0) return;
    ent.psn = Math.max(0, ent.psn - dt);
    ent.psnAcc = (ent.psnAcc || 0) + dt;
    if (ent.psnAcc >= .5) {
      ent.psnAcc = 0;
      if (isPlayer) {
        if (!ent.dead) hurtPlayer(4, null);
      } else if (!ent.dead) {
        ent.damage(4, null, { spark: 0x4e0512, color: '#c8203c', noFrameBonus: true });
      }
    }
    if (Math.random() < dt * 7) {
      FX.bloodMote(ent.pos.clone().add(new THREE.Vector3(
        (Math.random() - .5) * 2, 1 + Math.random() * 3.4, (Math.random() - .5) * 2)), 1, .5);
    }
  }
  CH.venom = venom;

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
    /* the whole shot, drawn dark: a rope of blood with a darker core, a
       cut of the same colour laid along it, and threads shed off it.
       Nothing here brightens what is behind it. */
    FX.bloodBeam(from.clone(), dir, len, { radius: wide * .52, life: .3 });
    FX.bloodCut(from.clone(), to, wide * .5, .22);
    for (var i = 0; i < 7; i++) {
      var at = from.clone().addScaledVector(dir, len * (i + 1) / 8);
      FX.bloodThreads(at, 2, 13, 1);
    }
    FX.bloodBurst(from.clone().addScaledVector(dir, 1.4), 2, dir.clone());
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
      if (Math.random() < .8) FX.bloodMote(hands, 1.5, .3);
      if (a.t > .16 && Math.random() < .4) FX.bloodThreads(hands, 1, 5, .8);
      return;
    }
    if (!a.fired) {
      a.fired = true;
      var d = aim();
      var from = p.pos.clone().addScaledVector(d, 1.4).add(new THREE.Vector3(0, 3.1, 0));
      lance(from, d, PB.lance.range, PB.lance.width);
      FX.tint('#3a0410', .3, .18);
      FX.mangaLines(.6, .25);
      addShake(1);
      FX.zoom(-7, .35);
      if (AN) AN.camKick(1.1);
      if (typeof hitstop === 'function') hitstop(.08);
      try { sfx.stab(); } catch (e) {}
      p.vel.addScaledVector(d, -7);        // it has a recoil
      inLine(from, d, PB.lance.range, PB.lance.width, null).forEach(function (e) {
        e.damage(PB.lance.dmg * scale(), d.clone().multiplyScalar(16).setY(6), {
          react: 'slash', reactDur: .5, spark: BRIGHT, color: '#c8203c', psn: awake(),
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
    if (window.JJNOTICE) window.JJNOTICE('HOLDING — RELEASE TO STOP', '#c8203c');
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
    FX.bloodThreads(player.pos.clone().add(new THREE.Vector3(0, 3, 0)), 6, 10, 1);
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
      FX.bloodBeam(from.clone(), d, len, { radius: .52, life: .12 });
      FX.bloodThreads(from.clone().addScaledVector(d, 2 + Math.random() * 20), 1, 15, 1);
    }
    if (Math.random() < dt * 26) FX.bloodMote(from.clone(), .8, .2);
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
        FX.bloodBurst(at, 1.1, d.clone());
        FX.blood(at, d.clone(), 3, .9);
        e.damage(PB.stream.dps * .12 * scale(), null, {
          react: 'shock', reactDur: .3, spark: BRIGHT, color: '#c8203c', psn: awake(),
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
        a.orb = FX.bloodMass(.5);
        scene.add(a.orb);
        for (var ci = 0; ci < 14; ci++) {
          FX.bloodMote(hand.clone().add(new THREE.Vector3(
            (Math.random() - .5) * 8, (Math.random() - .5) * 8, (Math.random() - .5) * 8)), 1.2, .5);
        }
      }
      a.orb.position.copy(hand);
      a.orb.scale.setScalar(.8 + E.out(a.t / .45) * 3.2);
      a.orb.rotation.y += dt * 2.4;
      return;
    }
    if (a.stage < 1) {
      a.stage = 1;
      if (a.orb) { scene.remove(a.orb); a.orb = null; }
      /* hardened, and thrown. A solid dark mass with a darker rim — it is
         a rock of blood, so it blocks the light rather than making any. */
      var rock = FX.bloodMass(1.5);
      rock.position.copy(hand);
      scene.add(rock);
      var v = d.clone().multiplyScalar(46); v.y = 5;
      var t = 0, done = false;
      addFx({ t: 3, update: function (dd) {
        this.t -= dd; t += dd;
        v.y -= 22 * dd;
        rock.position.addScaledVector(v, dd);
        rock.rotation.x += dd * 7; rock.rotation.z += dd * 5;
        if (Math.random() < dd * 30) FX.bloodMote(rock.position.clone(), 1.4, .3);
        var near = null;
        for (var i = 0; i < enemies.length; i++) {
          var e = enemies[i];
          if (!e || e.dead) continue;
          if (e.pos.clone().add(new THREE.Vector3(0, 2.4, 0)).distanceTo(rock.position) < 3.4) { near = e; break; }
        }
        if (!done && (near || rock.position.y <= .8 || this.t <= 0)) {
          done = true;
          var at = rock.position.clone();
          FX.bloodBurst(at, 4.5, new THREE.Vector3(0, 1, 0));
          FX.bloodThreads(at, 10, 20, 1.4);
          FX.bloodRings(at, 4, { maxR: 20, life: .7, gap: 40 });
          FX.cracks(new THREE.Vector3(at.x, 0, at.z), 11, 17, 0x2a0810, 0x5a3038);
          FX.debris(new THREE.Vector3(at.x, 0, at.z), 16, 18, DARK);
          FX.blood(at, new THREE.Vector3(0, 1, 0), 14, 1.5);
          addShake(2);
          if (typeof hitstop === 'function') hitstop(.1);
          try { sfx.redBoom(); } catch (e) {}
          enemies.forEach(function (e) {
            if (!e || e.dead || e.pos.distanceTo(at) > 12) return;
            var kb = e.pos.clone().sub(at).setY(0).normalize().multiplyScalar(28); kb.y = 13;
            e.damage(40 * scale(), kb, {
              react: 'blow', reactDur: .9, spark: BRIGHT, color: '#c8203c', death: 'sever', psn: awake()
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
      if (Math.random() < .9) FX.bloodMote(mid, 2.4, .35);
      addShake(.2 + a.t * .5);
      return;
    }
    if (a.stage < 1) {
      a.stage = 1;
      FX.tint('#40040f', .5, .3);
      FX.bloodRings(mid, 4, { maxR: 16, life: .6, gap: 34 });
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
            var orb = FX.bloodMass(.62);
            orb.position.copy(mid);
            scene.add(orb);
            var sp = 34 + Math.random() * 16, t = 0, hit = false;
            addFx({ t: 1.4, update: function (dd) {
              this.t -= dd; t += dd;
              orb.position.addScaledVector(d, sp * dd);
              orb.rotation.x += dd * 6; orb.rotation.z += dd * 4;
              if (Math.random() < dd * 18) FX.bloodMote(orb.position.clone(), .7, .2);
              if (!hit) {
                for (var j = 0; j < enemies.length; j++) {
                  var e = enemies[j];
                  if (!e || e.dead) continue;
                  if (e.pos.clone().add(new THREE.Vector3(0, 2.4, 0)).distanceTo(orb.position) > 2.8) continue;
                  hit = true;
                  var at = orb.position.clone();
                  FX.bloodBurst(at, 1.7, d.clone());
                  e.damage(15 * scale(), d.clone().multiplyScalar(11).setY(5), {
                    react: 'slash', reactDur: .3, spark: BRIGHT, color: '#c8203c', psn: awake(),
                    bleed: true, death: 'dice'
                  });
                  addShake(.4);
                  break;
                }
              }
              if (hit || this.t <= 0) { scene.remove(orb); return false; }
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
    if (!CH.aura) CH.aura = FX.bloodAura(function () { return player.pos; });
    FX.tint('#48060f', .45, .45);
    FX.bloodRings(new THREE.Vector3(player.pos.x, .1, player.pos.z), 4,
      { maxR: 12, life: .7, gap: 50, ground: true });
    addShake(1.2);
    try { sfx.raise(); } catch (e) {}
  }
  function stepScale(a, dt) {
    var mid = player.pos.clone().add(new THREE.Vector3(0, 2.6, 0));
    if (Math.random() < .7) FX.bloodMote(mid, 2, .4);
    if (a.t > .4 && Math.random() < .2) FX.bloodThreads(mid, 2, 8, 1);
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
      FX.bloodCut(at.clone().addScaledVector(side, -5).add(new THREE.Vector3(0, 2.4, 0)),
        at.clone().addScaledVector(side, 5).add(new THREE.Vector3(0, -2.4, 0)), 1.3, .3);
      FX.bloodBurst(at, 2.6, d.clone().setY(.3));
      FX.bloodThreads(at, 6, 15, 1.1);
      addShake(1.1);
      if (typeof hitstop === 'function') hitstop(.08);
      try { sfx.slash(); } catch (e) {}
      inLine(p.pos.clone().add(new THREE.Vector3(0, 2.4, 0)), d, 9, 4, null).forEach(function (e) {
        e.damage(30 * scale(), d.clone().multiplyScalar(20).setY(8), {
          react: 'slash', reactDur: .6, spark: BRIGHT, color: '#c8203c', psn: awake(),
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
     THE FOUR HE GETS WHEN THE CURSE HALF IS OUT

     Not four bigger versions of the same shot. Each one is built on a
     different line from the source:

       1  Convergence is a real step, not flavour. He compresses blood
          between his palms and condenses it to its limit, then claps and
          fires it from his fingertips at the SPEED OF SOUND. The source
          also says the compression TAKES TIME and leaves him open to
          anything fast — so the charge here is a genuine window with no
          invulnerability in it, and what comes out is instant.
       2  He hardens blood into a solid. Awake, that is not one rock: it
          is a bombardment of them.
       3  Supernova is Convergence split into many small orbs and fired
          in every direction LIKE BUCKSHOT — a technique he made himself
          by honing blood manipulation for a hundred and fifty years. So
          the awakened one is a sphere of it, not a ring.
       4  He manipulates his own blood flow to avoid fatal damage, clot
          wounds and move blood to vital areas. That is the one thing the
          whole roster lacks: a fighter who repairs himself.
     ================================================================== */

  /* ---------------------------------------------- 1 · CONVERGENCE ---- */
  function castConverge() {
    if (!ready('ca1')) return;
    var a = start('ca1', 1.05, 'ca1', 'CONVERGENCE', '収束 · 穿血');
    a.fired = false;
    /* deliberately NO iframes: the compression is the opening */
  }
  function stepConverge(a, dt) {
    var p = player, d = aim();
    var palms = p.pos.clone().addScaledVector(d, 1.1).add(new THREE.Vector3(0, 3.2, 0));
    if (a.t < .72) {
      /* it condenses between the palms, and gets tighter as it goes */
      var k = a.t / .72;
      var r = 3.4 * (1 - k * .78);
      for (var i = 0; i < 2; i++) {
        var ang = Math.random() * TAU, e2 = (Math.random() - .5) * 2;
        FX.bloodMote(palms.clone().add(new THREE.Vector3(
          Math.cos(ang) * r, e2 * r * .5, Math.sin(ang) * r)), 1 + k, .22);
      }
      if (Math.random() < dt * 14) FX.bloodThreads(palms.clone(), 1, 4, .4);
      addShake(.12 + k * .5);
      return;
    }
    if (!a.fired) {
      a.fired = true;
      /* the clap, and then it is already there */
      FX.bloodBurst(palms.clone(), 2.4, d.clone());
      FX.tint('#40040f', .45, .2);
      FX.mangaLines(.8, .3);
      if (typeof hitstop === 'function') hitstop(.11);
      addShake(1.6);
      if (AN) AN.camKick(1.5);
      FX.zoom(-9, .4);
      try { sfx.stab(); } catch (e) {}
      var from = palms.clone();
      /* at the speed of sound there is no travel to watch: the whole line
         lands on the frame it is fired on, and it does not stop at the
         first body it meets */
      FX.bloodBeam(from.clone(), d, 96, { radius: 1.1, life: .34 });
      FX.bloodCut(from.clone(), from.clone().addScaledVector(d, 96), 1, .26);
      for (var j = 1; j <= 10; j++) {
        FX.bloodThreads(from.clone().addScaledVector(d, j * 9), 2, 15, 1);
      }
      p.vel.addScaledVector(d, -13);
      inLine(from, d, 96, 3.2, null).forEach(function (en) {
        en.damage(74 * scale(), d.clone().multiplyScalar(22).setY(7), {
          react: 'slash', reactDur: .6, spark: BRIGHT, color: '#c8203c',
          bleed: true, death: 'sever', psn: awake()
        });
        FX.bloodBurst(en.pos.clone().add(new THREE.Vector3(0, 2.6, 0)), 2, d.clone());
      });
      if (window.JJAW) window.JJAW.gain(10);
    }
  }

  /* ------------------------------------------- 2 · THE BOMBARDMENT --- */
  function castBarrage() {
    if (!ready('ca2')) return;
    start('ca2', 1.2, 'ca2', 'BLOOD METEORITE', '血隠 · 極');
    player.iframes = Math.max(player.iframes, .4);
  }
  function dropMass(at, delay, size) {
    setTimeout(function () {
      if (typeof scene === 'undefined') return;
      var rock = FX.bloodMass(size);
      rock.position.set(at.x, 42, at.z);
      scene.add(rock);
      var v = -46, done = false;
      addFx({ t: 3, update: function (dd) {
        this.t -= dd;
        v -= 42 * dd;
        rock.position.y += v * dd;
        rock.rotation.x += dd * 5; rock.rotation.z += dd * 4;
        if (Math.random() < dd * 24) FX.bloodMote(rock.position.clone(), 1.4, .3);
        if (!done && (rock.position.y <= size || this.t <= 0)) {
          done = true;
          var floor = new THREE.Vector3(at.x, .4, at.z);
          FX.bloodBurst(floor, size * 2.4, new THREE.Vector3(0, 1, 0));
          FX.bloodThreads(floor, 8, 17, 1.2);
          FX.bloodRings(floor, 2, { maxR: 12, life: .55, gap: 40 });
          FX.cracks(new THREE.Vector3(at.x, 0, at.z), 8, 12, 0x1c0106, 0x5a3038);
          FX.debris(new THREE.Vector3(at.x, 0, at.z), 10, 14, DARK);
          addShake(1);
          try { sfx.redBoom(); } catch (e) {}
          enemies.forEach(function (en) {
            if (!en || en.dead || en.pos.distanceTo(floor) > 9) return;
            var kb = en.pos.clone().sub(floor).setY(0).normalize().multiplyScalar(20); kb.y = 12;
            en.damage(30 * scale(), kb, {
              react: 'blow', reactDur: .8, spark: BRIGHT, color: '#c8203c',
              death: 'flat', psn: awake()
            });
          });
          scene.remove(rock);
          return false;
        }
        return true;
      } });
    }, delay);
  }
  function stepBarrage(a, dt) {
    var p = player, d = aim();
    if (a.t < .5) {
      if (Math.random() < .8) {
        FX.bloodMote(p.pos.clone().add(new THREE.Vector3(0, 4.4, 0)), 2.4, .4);
      }
      addShake(.2);
      return;
    }
    if (a.stage < 1) {
      a.stage = 1;
      FX.tint('#40040f', .4, .35);
      addShake(1.2);
      try { sfx.raise(); } catch (e) {}
      /* seven of them, walked up the ground in front of him */
      var side = new THREE.Vector3(-d.z, 0, d.x);
      for (var i = 0; i < 7; i++) {
        var at = p.pos.clone()
          .addScaledVector(d, 10 + i * 5.5)
          .addScaledVector(side, (Math.random() - .5) * 14);
        dropMass(at, i * 120, 1.3 + Math.random() * .8);
      }
      if (window.JJAW) window.JJAW.gain(12);
    }
  }

  /* --------------------------------------------- 3 · THE SAW BLADE --- */
  /* He hardens blood into solids — that is how Blood Edge and Blood
     Meteorite both work — so the awakened version of that is not a bigger
     knife. It is a disc with teeth on it, thrown, and it does not stop at
     the first person: a saw goes through and keeps going. */
  var SAW = { range: 62, speed: 30, radius: 3.4, dmg: 22, tick: .22 };

  /* A flat blade, not an upright wheel. It lies level and spins about the
     vertical, so what it does to whatever it reaches is take it across the
     middle — which is what its finisher has always done. A wheel rolling
     at them cut on the vertical and the two never agreed. */
  function buildSaw() {
    var g = new THREE.Group();
    /* a CylinderGeometry's axis is Y already, so left alone it is level */
    var disc = new THREE.Mesh(new THREE.CylinderGeometry(2.9, 2.9, .3, 22),
      new THREE.MeshStandardMaterial({ color: 0x4e0512, roughness: .3, flatShading: true }));
    g.add(disc);
    /* the dark rim, so the shape reads against the road */
    var rim = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.1, .24, 22),
      new THREE.MeshBasicMaterial({ color: 0x1c0106, side: THREE.BackSide,
        transparent: true, opacity: .95, depthWrite: false, toneMapped: false }));
    rim.scale.setScalar(1.06);
    g.add(rim);
    /* the teeth, round the level edge and raked back against the turn */
    for (var i = 0; i < 14; i++) {
      var a = i / 14 * TAU;
      var t = new THREE.Mesh(new THREE.BoxGeometry(.5, .3, .8),
        new THREE.MeshStandardMaterial({ color: 0x6d0a1c, roughness: .26, flatShading: true }));
      t.position.set(Math.cos(a) * 3.1, 0, Math.sin(a) * 3.1);
      t.rotation.y = -a + .5;
      g.add(t);
    }
    var hub = new THREE.Mesh(new THREE.CylinderGeometry(.9, .9, .5, 10),
      new THREE.MeshStandardMaterial({ color: 0x1c0106, roughness: .5, flatShading: true }));
    g.add(hub);
    return g;
  }

  function throwSaw(from, dir, ghost) {
    var g = buildSaw();
    g.position.copy(from);
    scene.add(g);
    var travelled = 0, spin = 0, cut = {};
    addFx({ t: 5, update: function (dt) {
      this.t -= dt;
      var step = SAW.speed * dt;
      travelled += step;
      g.position.addScaledVector(dir, step);
      spin += dt * 26;
      g.rotation.set(0, spin, 0);                // level, turning about the vertical
      if (Math.random() < dt * 30) {
        FX.bloodThreads(g.position.clone(), 1, 9, .6);
      }
      /* the line it leaves behind it — across, at the height it is cutting
         at, not scratched along the road */
      if (Math.random() < dt * 12) {
        var side = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(3.1);
        FX.bloodCut(
          g.position.clone().sub(side),
          g.position.clone().add(side), .5, .4);
      }
      /* it saws: everything it is touching is cut again on a timer, and
         nothing stops it going through */
      if (!ghost) {
        for (var i = 0; i < enemies.length; i++) {
          var e = enemies[i];
          if (!e || e.dead) continue;
          if (e.pos.clone().add(new THREE.Vector3(0, 2.4, 0))
            .distanceTo(g.position) > SAW.radius) { cut[i] = 0; continue; }
          cut[i] = (cut[i] || 0) - dt;
          if (cut[i] > 0) continue;
          cut[i] = SAW.tick;
          FX.bloodBurst(e.pos.clone().add(new THREE.Vector3(0, 2.6, 0)), 1.8, dir.clone());
          e.damage(SAW.dmg * scale(), dir.clone().multiplyScalar(6).setY(2), {
            react: 'slash', reactDur: .3, spark: BRIGHT, color: '#c8203c',
            bleed: true, death: 'sever', psn: awake(), stun: .2
          });
          addShake(.35);
        }
      }
      if (travelled < SAW.range && this.t > 0) return true;
      /* and it comes apart where it stops */
      FX.bloodBurst(g.position.clone(), 3.4, dir.clone());
      FX.bloodThreads(g.position.clone(), 12, 20, 1.3);
      FX.bloodRings(g.position.clone(), 3, { maxR: 12, life: .6, gap: 40 });
      scene.remove(g);
      g.traverse(function (o) { if (o.isMesh) o.material.dispose(); });
      return false;
    } });
  }

  function castSaw() {
    if (!ready('ca3')) return;
    start('ca3', 1.05, 'ca3', 'BLOOD SAW', '血鋸');
    player.iframes = Math.max(player.iframes, .4);
  }
  function stepSaw(a, dt) {
    var p = player, d = aim();
    var hand = p.pos.clone().addScaledVector(d, 1.4).add(new THREE.Vector3(0, 3.4, 0));
    if (a.t < .5) {
      /* it is drawn out and set spinning before it goes */
      if (!a.disc) {
        a.disc = buildSaw();
        scene.add(a.disc);
      }
      var k = a.t / .5;
      a.disc.position.copy(hand);
      a.disc.scale.setScalar(.25 + E.out(k) * .75);
      /* held flat over the palm and wound up about the vertical */
      a.disc.rotation.set(0, a.t * (6 + k * 30), 0);
      if (Math.random() < dt * 20) FX.bloodMote(hand.clone(), 1.4, .3);
      addShake(.2 + k * .5);
      return;
    }
    if (a.stage < 1) {
      a.stage = 1;
      if (a.disc) {
        scene.remove(a.disc);
        a.disc.traverse(function (o) { if (o.isMesh) o.material.dispose(); });
        a.disc = null;
      }
      throwSaw(hand.clone(), d.clone());
      FX.bloodBurst(hand.clone(), 2, d.clone());
      FX.mangaLines(.6, .25);
      addShake(1.2);
      if (AN) AN.camKick(1.1);
      p.vel.addScaledVector(d, -6);
      try { sfx.slash(); } catch (e) {}
      if (window.JJAW) window.JJAW.gain(12);
    }
  }

  /* ------------------------------------------ 4 · THE ROCK PILLAR ---- */
  /* Both hands to the ground, and a column of it comes up under whoever
     is standing there and takes them with it. Then he puts a hand on the
     column, and it starts to bleed: his blood goes into the stone, webs
     through it along the cracks, and takes the whole thing apart. What is
     riding the top comes apart with it. */
  var PILLAR = {
    reach: 9,        // how far in front of him it comes up
    grab: 7,         // who gets carried
    height: 17,
    rise: .55,
    hand: 1.25,      // when he touches it
    blow: 2.15       // when it goes
  };

  function buildPillar(at) {
    var g = new THREE.Group();
    var rock = new THREE.MeshStandardMaterial({ color: 0x4a4f5c, roughness: .95, flatShading: true });
    var dark = new THREE.MeshStandardMaterial({ color: 0x33373f, roughness: .96, flatShading: true });
    /* a stack of slabs rather than one box, so it reads as broken ground
       that has been pushed up rather than as a pillar somebody built */
    var y = 0;
    for (var i = 0; i < 6; i++) {
      var h = PILLAR.height / 6;
      var w = 5.4 - i * .34 + (Math.random() - .5) * .8;
      var slab = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), i % 2 ? dark : rock);
      slab.position.set((Math.random() - .5) * .7, y + h / 2, (Math.random() - .5) * .7);
      slab.rotation.y = Math.random() * .5;
      slab.castShadow = true;
      g.add(slab);
      y += h;
    }
    g.position.set(at.x, -PILLAR.height, at.z);
    g.__slabs = g.children.slice();
    scene.add(g);
    return g;
  }

  /* the blood going into the stone: web decals down all four faces */
  function bleedPillar(g, at, n) {
    var webs = FX.WEBS;
    for (var i = 0; i < n; i++) {
      var face = i % 4;
      var m = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 5.4),
        new THREE.MeshBasicMaterial({
          map: webs ? webs[(Math.random() * webs.length) | 0] : FX.T.blood,
          color: 0x5e0714, transparent: true, opacity: 0,
          blending: THREE.NormalBlending, depthWrite: false,
          side: THREE.DoubleSide, toneMapped: false
        }));
      var ang = face * Math.PI / 2;
      var h = 2 + Math.random() * (PILLAR.height - 4);
      m.position.set(Math.sin(ang) * 2.75, h, Math.cos(ang) * 2.75);
      m.rotation.y = ang;
      m.renderOrder = 8;
      g.add(m);
      (function (m) {
        var t = 0;
        addFx({ t: 1.6, update: function (dt) {
          this.t -= dt; t += dt;
          m.material.opacity = Math.min(.9, t * 1.6);
          if (this.t <= 0) return false;
          return true;
        } });
      })(m);
    }
  }

  function castPillar() {
    if (!ready('ca4')) return;
    var a = start('ca4', 2.6, 'ca4', 'BLOOD PILLAR', '血柱');
    a.at = null; a.g = null; a.rider = null;
    player.iframes = Math.max(player.iframes, 2.4);
  }

  function stepPillar(a, dt) {
    var p = player, d = aim();
    p.vel.x = 0; p.vel.z = 0;

    /* ---- both hands down ---- */
    if (a.t < PILLAR.rise) {
      if (Math.random() < .5) {
        FX.bloodMote(p.pos.clone().addScaledVector(d, 1.4).add(new THREE.Vector3(0, .4, 0)), 1.2, .3);
      }
      addShake(.3 + a.t);
      return;
    }

    /* ---- and the ground comes up ---- */
    if (a.stage < 1) {
      a.stage = 1;
      var at = p.pos.clone().addScaledVector(d, PILLAR.reach);
      a.at = new THREE.Vector3(at.x, 0, at.z);
      a.g = buildPillar(a.at);
      FX.cracks(a.at.clone(), 14, 20, 0x2a2630, 0x8a8f9c);
      FX.debris(a.at.clone(), 18, 20, 0x4a4f5c);
      FX.dust(a.at.clone(), 10, 0xb9bfc9, 12, 4);
      FX.rings(new THREE.Vector3(a.at.x, .12, a.at.z), 0x8a8f9c, 3,
        { maxR: 14, life: .6, gap: 40 });
      addShake(2.2);
      if (typeof hitstop === 'function') hitstop(.12);
      try { sfx.redBoom(); } catch (e) {}
      /* whoever was standing on it goes up with it */
      var best = null, bd = PILLAR.grab;
      enemies.forEach(function (e) {
        if (!e || e.dead) return;
        var dist = e.pos.distanceTo(a.at);
        if (dist < bd) { bd = dist; best = e; }
      });
      a.rider = best;
      if (best) {
        best.damage(24 * scale(), null, {
          react: 'uplift', reactDur: .6, spark: BRIGHT, color: '#c8203c',
          psn: awake(), noFrameBonus: true
        });
      }
      if (window.JJAW) window.JJAW.gain(12);
    }

    /* the column rising, and the rider riding it */
    if (a.g) {
      var k = Math.min(1, (a.t - PILLAR.rise) / .5);
      a.g.position.y = -PILLAR.height + E.out(k) * PILLAR.height;
      if (k < 1 && Math.random() < dt * 22) {
        FX.dust(new THREE.Vector3(a.at.x + (Math.random() - .5) * 6, 1,
          a.at.z + (Math.random() - .5) * 6), 2, 0xb9bfc9, 7, 3);
      }
    }
    if (a.rider && !a.rider.dead && a.t < PILLAR.blow) {
      var top = new THREE.Vector3(a.at.x, PILLAR.height * Math.min(1,
        (a.t - PILLAR.rise) / .5) + .2, a.at.z);
      a.rider.anchorT = .25;
      a.rider.anchorPos.copy(top);
      a.rider.pos.lerp(top, Math.min(1, dt * 14));
    }

    /* ---- his hand goes on it, and it starts to bleed ---- */
    if (a.t >= PILLAR.hand && a.stage < 2) {
      a.stage = 2;
      var base = new THREE.Vector3(a.at.x, 2.4, a.at.z);
      FX.bloodBurst(base.clone(), 2.2, new THREE.Vector3(0, 1, 0));
      bleedPillar(a.g, a.at, 16);
      addShake(.7);
      try { sfx.stab(); } catch (e) {}
    }
    /* it oozes: blood running up and down the stone */
    if (a.stage >= 2 && a.t < PILLAR.blow && Math.random() < dt * 34) {
      var hgt = Math.random() * PILLAR.height;
      var ang2 = Math.random() * TAU;
      FX.bloodMote(new THREE.Vector3(
        a.at.x + Math.cos(ang2) * 2.9, hgt, a.at.z + Math.sin(ang2) * 2.9), 1.3, .6);
      if (Math.random() < .3) {
        FX.bloodCut(
          new THREE.Vector3(a.at.x + Math.cos(ang2) * 2.9, hgt, a.at.z + Math.sin(ang2) * 2.9),
          new THREE.Vector3(a.at.x + Math.cos(ang2) * 2.9, Math.max(0, hgt - 4),
            a.at.z + Math.sin(ang2) * 2.9), .4, .5);
      }
      addShake(.16);
    }

    /* ---- and then the whole thing goes ---- */
    if (a.t >= PILLAR.blow && a.stage < 3) {
      a.stage = 3;
      var c = new THREE.Vector3(a.at.x, PILLAR.height * .5, a.at.z);
      FX.tint('#40040f', .6, .35);
      if (typeof hitstop === 'function') hitstop(.18);
      FX.bloodBurst(c.clone(), 8, new THREE.Vector3(0, 1, 0));
      FX.bloodThreads(c.clone(), 26, 34, 1.8);
      FX.bloodRings(c.clone(), 6, { maxR: 30, life: .9, gap: 40 });
      FX.bloodRings(new THREE.Vector3(a.at.x, .12, a.at.z), 4,
        { maxR: 26, life: .8, gap: 46, ground: true });
      FX.cracks(new THREE.Vector3(a.at.x, 0, a.at.z), 16, 24, 0x1c0106, 0x5a3038);
      addShake(3);
      FX.zoom(-12, .7);
      if (AN) AN.camKick(2);
      try { sfx.blast(); } catch (e) {}

      /* the stone goes outward as real pieces */
      if (a.g) {
        a.g.__slabs.forEach(function (sl) {
          var wp = new THREE.Vector3();
          sl.getWorldPosition(wp);
          scene.remove(a.g);
          var chunk = new THREE.Mesh(sl.geometry, sl.material);
          chunk.position.copy(wp);
          scene.add(chunk);
          var v = new THREE.Vector3((Math.random() - .5) * 26, 6 + Math.random() * 16,
            (Math.random() - .5) * 26);
          var av = new THREE.Vector3((Math.random() - .5) * 7, (Math.random() - .5) * 7,
            (Math.random() - .5) * 7);
          addFx({ t: 4, update: function (dd) {
            this.t -= dd;
            v.y -= 32 * dd;
            chunk.position.addScaledVector(v, dd);
            chunk.rotation.x += av.x * dd;
            chunk.rotation.y += av.y * dd;
            chunk.rotation.z += av.z * dd;
            if (chunk.position.y < 1) { v.y = Math.abs(v.y) * .3; v.multiplyScalar(.6); }
            if (this.t <= 0) { scene.remove(chunk); return false; }
            return true;
          } });
        });
        FX.debris(new THREE.Vector3(a.at.x, 2, a.at.z), 26, 26, 0x4a4f5c);
        FX.dust(new THREE.Vector3(a.at.x, 1, a.at.z), 14, 0xb9bfc9, 16, 5);
        a.g = null;
      }

      /* and the one riding the top comes apart with it */
      if (a.rider && !a.rider.dead) {
        var r = a.rider;
        r.anchorT = 0;
        var up = new THREE.Vector3(0, 26, 0);
        r.damage(96 * scale(), up, {
          react: 'uplift', reactDur: .8, spark: BRIGHT, color: '#c8203c',
          death: 'sever', psn: awake(), ragdoll: true
        });
        if (!r.dead && window.JJGORE) {
          /* it does not kill them, but it still takes them apart where
             they were: the pieces are the point of the move */
          try { window.JJGORE.sever(r, { dir: up.clone().normalize(), power: 1.7, cubes: 12 }); } catch (e) {}
        }
      }
      /* everything standing near the base takes the stone */
      enemies.forEach(function (e) {
        if (!e || e.dead || e === a.rider) return;
        if (e.pos.distanceTo(a.at) > 16) return;
        var kb = e.pos.clone().sub(a.at).setY(0).normalize().multiplyScalar(24); kb.y = 14;
        e.damage(38 * scale(), kb, {
          react: 'blow', reactDur: .8, spark: BRIGHT, color: '#c8203c',
          death: 'sever', psn: awake()
        });
      });
    }
  }

  /* it must not be left standing if the cast is cut short */
  function dropPillar(a) {
    if (a && a.g) {
      scene.remove(a.g);
      a.g = null;
    }
    if (a && a.rider) { a.rider.anchorT = 0; a.rider = null; }
  }

  /* =====================================================================
     F · DEATH PAINTING   呪胎九相図

     What the meter buys for him, and it is built out of the three things
     the source actually says about him rather than out of a bigger beam.

       · He is a Cursed Womb: Death Painting — half human, half cursed
         spirit, and a hundred and fifty years old. The curse half is what
         comes out here.
       · "He can make this mark bleed at will in order to produce
         ammunition for his cursed technique." So the awakening opens the
         mark across the bridge of his nose, and it runs.
       · He has NO LACK OF BLOOD, which is why his blood manipulation goes
         further than a sorcerer's. So the cost of using it drops: his
         cooldowns run at four times the speed.
       · Death Painting blood is POISONOUS to humans when it mixes with
         theirs, and the backlash off it put Naoya Zen'in on the floor.
         So everything he lands keeps working for six seconds after it
         has landed.

     Flowing Red Scale stays open for the whole of it too, so he does not
     spend a slot re-buying his own damage.
     ================================================================== */
  var AWAKE_DUR = 26;

  function awakenChoso() {
    if (player.char !== 'choso' || player.dead || busy()) return false;
    if (CH.stream) shutStream();
    start('caw', 2.2, 'c1', 'DEATH PAINTING', '\u546a\u80ce\u4e5d\u76f8\u56f3');
    cds.c1 = 0;
    player.iframes = Math.max(player.iframes, 2.6);
    FX.letterbox(true);
    FX.tint('#2a0208', .55, 2.2);
    if (AN) AN.camRelease();
    /* not published here: mp.js watches player.action and announces
       every cast on its own, so a pub of our own plays it twice on
       every other screen */
    return true;
  }

  function stepAwakenChoso(a, dt) {
    var p = player;
    p.vel.set(0, 0, 0);
    var face = p.pos.clone().add(new THREE.Vector3(0, 4.1, 0));
    if (Math.random() < .7) FX.bloodMote(p.pos.clone().add(new THREE.Vector3(0, 2.8, 0)), 2, .5);

    /* the mark opens */
    if (a.t >= .7 && a.stage < 1) {
      a.stage = 1;
      FX.bloodBurst(face.clone(), 1.6, new THREE.Vector3(0, -1, 0));
      FX.tint('#40040f', .6, .3);
      addShake(.8);
      if (typeof hitstop === 'function') hitstop(.12);
      try { sfx.stab(); } catch (e) {}
    }
    /* and it runs, because there is no shortage of it */
    if (a.t >= .7 && a.t < 1.6 && Math.random() < dt * 26) {
      FX.blood(face.clone(), new THREE.Vector3(0, -1, .3), 2, .8);
    }
    /* the curse half surfaces */
    if (a.t >= 1.5 && a.stage < 2) {
      a.stage = 2;
      FX.bloodRings(new THREE.Vector3(p.pos.x, .12, p.pos.z), 5,
        { maxR: 22, life: .8, gap: 55, ground: true });
      FX.bloodThreads(p.pos.clone().add(new THREE.Vector3(0, 3, 0)), 20, 26, 1.6);
      /* narrow: the camera sits about eight metres behind his shoulder,
         and anything wider than this is a red tube across the whole lens
         instead of a column standing behind him */
      FX.bloodBeam(p.pos.clone(), new THREE.Vector3(0, 1, 0), 44, { radius: .8, life: 1 });
      FX.cracks(new THREE.Vector3(p.pos.x, 0, p.pos.z), 11, 15, 0x1c0106, 0x5a3038);
      FX.debris(p.pos.clone(), 12, 15, 0x1c0106);
      FX.tint('#48060f', .5, .5);
      FX.zoom(-11, .7);
      addShake(1.4);
      try { sfx.raise(); } catch (e) {}
      var A = window.JJAW;
      if (A) {
        A.choso = true;
        A.chosoT = AWAKE_DUR;
        if (!A.chosoAura) A.chosoAura = FX.bloodAura(function () { return player.pos; });
      }
      swapChosoBar(true);
    }
    if (a.t >= a.dur - .1) FX.letterbox(false);
  }

  /* the awakened four. Convergence is the one that matters: both palms
     brought together in front of the chest and squeezed, then a clap and
     both arms straight down the line — which is the pose the technique is
     drawn in, and the reason the charge reads as a charge. */
  function poseChosoAwake(r, a) {
    var t = a.t, out = E.out;
    switch (a.type) {
      case 'ca1': {
        rp(r);
        if (t < .72) {
          var k = out(t / .72);
          /* palms in, and closing */
          r.shoulderL.rotation.x = -1.24 * k;
          r.shoulderR.rotation.x = -1.24 * k;
          r.shoulderL.rotation.z = .82 * k - .3 * k * k;
          r.shoulderR.rotation.z = -.82 * k + .3 * k * k;
          r.elbowL.rotation.x = -1.5 * k;
          r.elbowR.rotation.x = -1.5 * k;
          r.spine.rotation.x = .2 * k;
          r.neck.rotation.x = .16 * k;
          r.hips.position.y = r.hipsBaseY - .3 * k;
          r.kneeL.rotation.x = .5 * k; r.kneeR.rotation.x = .46 * k;
        } else {
          /* clapped, and pointed */
          var f = out(Math.min(1, (t - .72) / .16));
          poseClamp(r, f, 0);
        }
        return true;
      }
      case 'ca2': {
        rp(r);
        /* both arms up over the head, then thrown down */
        var up = out(Math.min(1, t / .5));
        var thr = t > .5 ? out(Math.min(1, (t - .5) / .3)) : 0;
        r.shoulderL.rotation.x = -2.5 * up + 2.9 * thr;
        r.shoulderR.rotation.x = -2.5 * up + 2.9 * thr;
        r.shoulderL.rotation.z = .34 * up;
        r.shoulderR.rotation.z = -.34 * up;
        r.elbowL.rotation.x = -.5 * up;
        r.elbowR.rotation.x = -.5 * up;
        r.spine.rotation.x = -.3 * up + .5 * thr;
        r.neck.rotation.x = -.34 * up + .5 * thr;
        r.hips.position.y = r.hipsBaseY + .16 * up - .4 * thr;
        return true;
      }
      case 'ca3': {
        rp(r);
        /* held out flat while it spins up, then thrown across the body */
        var hold = out(Math.min(1, t / .5));
        var thr = t > .5 ? out(Math.min(1, (t - .5) / .28)) : 0;
        r.shoulderR.rotation.x = -1.45 * hold + .5 * thr;
        r.shoulderR.rotation.z = -.5 * hold + 1.5 * thr;
        r.elbowR.rotation.x = -.5 * hold - .3 * thr;
        r.shoulderL.rotation.x = -.5 * hold;
        r.shoulderL.rotation.z = .3 * hold;
        r.elbowL.rotation.x = -1.1 * hold;
        r.spine.rotation.x = -.1 * hold + .26 * thr;
        r.spine.rotation.y = .3 * hold - .7 * thr;
        r.neck.rotation.x = -.06 * hold;
        r.hipL.rotation.x = -.24 * hold; r.kneeL.rotation.x = .42 * hold;
        r.hips.position.y = r.hipsBaseY - .16 * hold;
        return true;
      }
      case 'ca4': {
        rp(r);
        /* both palms flat on the road, then one hand up onto the stone */
        if (t < PILLAR.hand) {
          var dn = out(Math.min(1, t / PILLAR.rise));
          r.shoulderL.rotation.x = 1.05 * dn;
          r.shoulderR.rotation.x = 1.05 * dn;
          r.shoulderL.rotation.z = .3 * dn;
          r.shoulderR.rotation.z = -.3 * dn;
          r.elbowL.rotation.x = -.2 * dn;
          r.elbowR.rotation.x = -.2 * dn;
          r.spine.rotation.x = .95 * dn;
          r.neck.rotation.x = -.55 * dn;
          r.hipL.rotation.x = -.5 * dn; r.kneeL.rotation.x = 1.15 * dn;
          r.hipR.rotation.x = -.35 * dn; r.kneeR.rotation.x = .95 * dn;
          r.hips.position.y = r.hipsBaseY - 1.15 * dn;
          return true;
        }
        /* up, and the near hand pressed flat against the column */
        var up2 = out(Math.min(1, (t - PILLAR.hand) / .5));
        r.shoulderR.rotation.x = 1.05 - 2.6 * up2;
        r.shoulderR.rotation.z = -.3 + .1 * up2;
        r.elbowR.rotation.x = -.2 - .1 * up2;
        r.shoulderL.rotation.x = 1.05 - 1.5 * up2;
        r.elbowL.rotation.x = -.2 - .5 * up2;
        r.spine.rotation.x = .95 - .85 * up2;
        r.neck.rotation.x = -.55 + .3 * up2;
        r.hipL.rotation.x = -.5 + .4 * up2; r.kneeL.rotation.x = 1.15 - .85 * up2;
        r.hipR.rotation.x = -.35 + .35 * up2; r.kneeR.rotation.x = .95 - .7 * up2;
        r.hips.position.y = r.hipsBaseY - 1.15 + .95 * up2;
        return true;
      }
    }
    return false;
  }

  function poseAwakenChoso(r, a) {
    rp(r);
    var t = a.t, out = E.out;
    if (t < .7) {
      /* two fingers to the mark on his own nose, and he opens it */
      var k = out(t / .7);
      r.shoulderR.rotation.x = -.3 - 2.3 * k;
      r.shoulderR.rotation.z = -.24 * k;
      r.elbowR.rotation.x = -.4 - 1.7 * k;
      r.shoulderL.rotation.x = -.2 * k;
      r.spine.rotation.x = .1 * k;
      r.neck.rotation.x = .12 * k;
      r.hips.position.y = r.hipsBaseY - .12 * k;
      return true;
    }
    if (t < 1.5) {
      /* the hand comes away and the head goes back */
      var k2 = out((t - .7) / .8);
      r.shoulderR.rotation.x = -2.6 + 1.5 * k2;
      r.elbowR.rotation.x = -2.1 + 1.2 * k2;
      r.spine.rotation.x = .1 - .34 * k2;
      r.neck.rotation.x = .12 - .5 * k2;
      r.hips.position.y = r.hipsBaseY - .12 - .18 * k2;
      r.kneeL.rotation.x = .4 * k2; r.kneeR.rotation.x = .36 * k2;
      return true;
    }
    /* arms down and open, weight settled: nothing is being held back now */
    var k3 = out(Math.min(1, (t - 1.5) / .7));
    r.spine.rotation.x = -.24 + .16 * k3;
    r.neck.rotation.x = -.38 + .3 * k3;
    r.shoulderL.rotation.x = -.2 * (1 - k3) - .12;
    r.shoulderR.rotation.x = -1.1 * (1 - k3) - .12;
    r.shoulderL.rotation.z = .5 * k3;
    r.shoulderR.rotation.z = -.5 * k3;
    r.elbowL.rotation.x = -.3 * k3;
    r.elbowR.rotation.x = -.9 * (1 - k3) - .3 * k3;
    r.kneeL.rotation.x = .4 * (1 - k3); r.kneeR.rotation.x = .36 * (1 - k3);
    r.hips.position.y = r.hipsBaseY - .3 * (1 - k3);
    return true;
  }

  function endAwaken(quiet) {
    var A = window.JJAW;
    if (!A || !A.choso) return;
    A.choso = false;
    A.chosoT = 0;
    if (A.chosoAura) { A.chosoAura.stop(); A.chosoAura = null; }
    swapChosoBar(false);
    if (quiet) return;
    if (window.JJNOTICE) window.JJNOTICE('THE MARK CLOSES', '#c8203c');
    FX.bloodRings(new THREE.Vector3(player.pos.x, .1, player.pos.z), 2,
      { maxR: 9, life: .6, ground: true });
  }
  CH.endAwaken = endAwaken;

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
      case 'caw': return stepAwakenChoso(a, dt);
      case 'ca1': return stepConverge(a, dt);
      case 'ca2': return stepBarrage(a, dt);
      case 'ca3': return stepSaw(a, dt);
      case 'ca4': return stepPillar(a, dt);
    }
    return _stepAction(a, dt);
  };

  var _poseAction = poseAction;
  poseAction = function (r, a) {
    if (a && a.type === 'caw' && poseAwakenChoso(r, a)) return;
    if (a && poseChosoAwake(r, a)) return;
    /* whose body this is, not who is watching — the rig carries its own
       character, so a Choso somebody else is driving poses off the same
       table ours does */
    if ((r.__char || player.char) === 'choso' && poseChoso(r, a)) return;
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
    /* the awakening runs out, and while it is up the cooldowns barely
       matter — he is not short of blood */
    var A = window.JJAW;
    if (A && A.choso) {
      if (player.char !== 'choso' || player.dead) { endAwaken(!!player.dead); }
      else {
        A.chosoT -= dt;
        for (var ck in CCD) { if (cds[ck] > 0) cds[ck] = Math.max(0, cds[ck] - dt * 3); }
        if (Math.random() < .25) {
          FX.bloodMote(player.pos.clone().add(new THREE.Vector3(
            (Math.random() - .5) * 2, .5 + Math.random() * 4, (Math.random() - .5) * 2)), 1.2, .5);
        }
        if (A.chosoT <= 0) endAwaken(false);
      }
    }
    /* poison he was handed by somebody else's awakening */
    stepVenom(player, dt, true);
    if (CH.stream) {
      if (player.dead || player.char !== 'choso') shutStream();
      else stepStream(dt);
    }
    /* being held down by somebody else's stream: the keys stop answering */
    if (player.pinned > 0) player.pinned = Math.max(0, player.pinned - dt);
  };

  /* A hit tagged `psn` leaves the poison behind in whatever it landed on.
     Applied here rather than at the five call sites so a hit relayed from
     another client lands the same way a local one does. */
  var _enemyDamage = Enemy.prototype.damage;
  Enemy.prototype.damage = function (amount, knock, opts) {
    var r = _enemyDamage.call(this, amount, knock, opts);
    if (opts && opts.psn && !this.dead) venom(this, opts.psn === true ? 6 : opts.psn);
    return r;
  };

  /* whatever the stream is on cannot walk out of it */
  var _enemyUpdate = Enemy.prototype.update;
  Enemy.prototype.update = function (dt) {
    if (this.pinned > 0) {
      this.pinned = Math.max(0, this.pinned - dt);
      if (this.vel) this.vel.set(0, 0, 0);
    }
    stepVenom(this, dt, false);
    return _enemyUpdate.call(this, dt);
  };

  /* His keys — and the awakened four are routed from inside this one
     rather than from a second listener of their own. Both would be in the
     capture phase, and capture listeners on the same element run in the
     order they were added, so the first one registered takes the key and
     stops the event before the second ever sees it. One handler that
     picks by state is the only version of this that works. */
  window.addEventListener('keydown', function (e) {
    if (!started || player.char !== 'choso' || e.repeat) return;
    if (player.react || (player.action && (player.action.type === 'kb' ||
        player.action.type === 'void' || player.action.type === 'caw'))) return;
    var on = awake();
    var hit = true;
    if (e.code === 'Digit1') (on ? castConverge : castPierce)();
    else if (e.code === 'Digit2') (on ? castBarrage : castMeteorite)();
    else if (e.code === 'Digit3') (on ? castSaw : castSupernova)();
    else if (e.code === 'Digit4') (on ? castPillar : castScale)();
    else if (e.code === 'KeyR') castEdge();
    else hit = false;
    if (hit) e.stopImmediatePropagation();
  }, true);

  /* =====================================================================
     THE BAR
     ================================================================== */
  var BASE_MOVES = CHARS.choso.moves.slice();
  var CAW_MOVES = [
    { key: 'LMB', lbl: 'Punch', cd: 'm1', max: .3 },
    { key: 'Q', lbl: 'Dash', cd: 'dash', max: 1 },
    { key: '1', lbl: 'Convergence', cd: 'ca1', max: CCD.ca1 },
    { key: '2', lbl: 'Blood Meteorite', cd: 'ca2', max: CCD.ca2 },
    { key: '3', lbl: 'Blood Saw', cd: 'ca3', max: CCD.ca3 },
    { key: '4', lbl: 'Blood Pillar', cd: 'ca4', max: CCD.ca4 },
    { key: 'R', lbl: 'Blood Edge', cd: 'cr', max: CCD.cr }
  ];
  function swapChosoBar(on) {
    CHARS.choso.moves = on ? CAW_MOVES : BASE_MOVES;
    if (player.char === 'choso') { try { buildMovesBar(); } catch (e) {} }
  }
  CH.swapBar = swapChosoBar;

  /* F: the shared meter, spent on the half of him that is a curse */
  window.addEventListener('keydown', function (e) {
    if (e.code !== 'KeyF' || e.repeat || !started) return;
    if (player.char !== 'choso') return;
    var A = window.JJAW;
    if (!A || !A.ready || A.active || A.cine || A.choso) return;
    if (window.JJNAOYA && window.JJNAOYA.busy()) return;
    if (awakenChoso()) { A.charge = 0; A.ready = false; }
  });

  /* letting go is what ends the stream — and what decides which of the two
     Piercing Blood was in the first place */
  window.addEventListener('keyup', function (e) {
    if (e.code !== 'Digit1') return;
    if (player.action && player.action.type === 'c1') player.action.held = false;
    if (CH.stream) shutStream();
  }, true);

  /* the swap takes the stream and the scale with it */
  var _switchChar = switchChar;
  switchChar = function (id, quiet) {
    if (CH.stream) shutStream();
    endAwaken(true);
    if (CH.scale > 0) { CH.scale = 0; if (CH.aura) { CH.aura.stop(); CH.aura = null; } }
    return _switchChar(id, quiet);
  };

  CH.stopStream = shutStream;

  /* =====================================================================
     WHAT EVERYBODY ELSE SEES
     The same routines the caster runs, with the damage taken out. Every
     hit already travels as its own message, so a ghost that dealt damage
     would land twice; a ghost that drew a different effect would mean two
     people in the same room watching two different fights.
     ================================================================== */
  function dirOf(yaw) { return new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)); }

  CH.remote = {
    /* the mark opening, and the curse coming up out of him */
    awaken: function (pos) {
      var face = pos.clone().add(new THREE.Vector3(0, 4.1, 0));
      setTimeout(function () {
        if (typeof scene === 'undefined') return;
        FX.bloodBurst(face.clone(), 1.6, new THREE.Vector3(0, -1, 0));
        FX.blood(face.clone(), new THREE.Vector3(0, -1, .3), 6, .9);
      }, 700);
      setTimeout(function () {
        if (typeof scene === 'undefined') return;
        FX.bloodRings(new THREE.Vector3(pos.x, .12, pos.z), 5,
          { maxR: 22, life: .8, gap: 55, ground: true });
        FX.bloodThreads(pos.clone().add(new THREE.Vector3(0, 3, 0)), 20, 26, 1.6);
        FX.bloodBeam(pos.clone(), new THREE.Vector3(0, 1, 0), 44, { radius: .8, life: 1 });
        FX.cracks(new THREE.Vector3(pos.x, 0, pos.z), 11, 15, 0x1c0106, 0x5a3038);
        FX.debris(pos.clone(), 12, 15, 0x1c0106);
      }, 1500);
    },
    /* the awakened four, damage-free */
    converge: function (pos, yaw) {
      var d = dirOf(yaw);
      var from = pos.clone().addScaledVector(d, 1.1).add(new THREE.Vector3(0, 3.2, 0));
      FX.bloodBurst(from.clone(), 2.4, d.clone());
      FX.bloodBeam(from.clone(), d, 96, { radius: 1.1, life: .34 });
      FX.bloodCut(from.clone(), from.clone().addScaledVector(d, 96), 1, .26);
      for (var j = 1; j <= 10; j++) {
        FX.bloodThreads(from.clone().addScaledVector(d, j * 9), 2, 15, 1);
      }
    },
    barrage: function (pos, yaw) {
      var d = dirOf(yaw);
      var side = new THREE.Vector3(-d.z, 0, d.x);
      for (var i = 0; i < 7; i++) {
        var at = pos.clone().addScaledVector(d, 10 + i * 5.5)
          .addScaledVector(side, (Math.random() - .5) * 14);
        dropMass(at, i * 120, 1.3 + Math.random() * .8);
      }
    },
    saw: function (pos, yaw) {
      var d = dirOf(yaw);
      var hand = pos.clone().addScaledVector(d, 1.4).add(new THREE.Vector3(0, 3.4, 0));
      FX.bloodBurst(hand.clone(), 2, d.clone());
      throwSaw(hand.clone(), d.clone(), true);
    },
    pillar: function (pos, yaw) {
      var d = dirOf(yaw);
      var at = pos.clone().addScaledVector(d, PILLAR.reach);
      at.y = 0;
      var g = buildPillar(at);
      FX.cracks(at.clone(), 14, 20, 0x2a2630, 0x8a8f9c);
      FX.debris(at.clone(), 18, 20, 0x4a4f5c);
      FX.dust(at.clone(), 10, 0xb9bfc9, 12, 4);
      var t = 0;
      addFx({ t: PILLAR.blow - PILLAR.rise, update: function (dd) {
        this.t -= dd; t += dd;
        g.position.y = -PILLAR.height + E.out(Math.min(1, t / .5)) * PILLAR.height;
        if (t > PILLAR.hand - PILLAR.rise && !g.__bled) {
          g.__bled = true;
          bleedPillar(g, at, 16);
          FX.bloodBurst(new THREE.Vector3(at.x, 2.4, at.z), 2.2, new THREE.Vector3(0, 1, 0));
        }
        if (this.t > 0) return true;
        var c = new THREE.Vector3(at.x, PILLAR.height * .5, at.z);
        FX.bloodBurst(c.clone(), 8, new THREE.Vector3(0, 1, 0));
        FX.bloodThreads(c.clone(), 26, 34, 1.8);
        FX.bloodRings(c.clone(), 6, { maxR: 30, life: .9, gap: 40 });
        FX.cracks(new THREE.Vector3(at.x, 0, at.z), 16, 24, 0x1c0106, 0x5a3038);
        FX.debris(new THREE.Vector3(at.x, 2, at.z), 26, 26, 0x4a4f5c);
        FX.dust(new THREE.Vector3(at.x, 1, at.z), 14, 0xb9bfc9, 16, 5);
        scene.remove(g);
        return false;
      } });
    },
    lance: function (pos, yaw) {
      var d = dirOf(yaw);
      var from = pos.clone().addScaledVector(d, 1.4).add(new THREE.Vector3(0, 3.1, 0));
      lance(from, d, PB.lance.range, PB.lance.width);
      FX.bloodThreads(from.clone(), 6, 10, 1);
    },
    /* one tick of the held stream, re-sent for as long as it is held */
    stream: function (pos, yaw) {
      var d = dirOf(yaw);
      var from = pos.clone().addScaledVector(d, 1.2).add(new THREE.Vector3(0, HAND_Y, 0));
      FX.bloodBeam(from, d, PB.stream.range, { radius: .52, life: .14 });
      if (Math.random() < .5) {
        FX.bloodThreads(from.clone().addScaledVector(d, 2 + Math.random() * 20), 1, 15, 1);
      }
    },
    meteorite: function (pos, yaw) {
      var d = dirOf(yaw);
      var hand = pos.clone().addScaledVector(d, .9).add(new THREE.Vector3(0, 4.2, 0));
      var rock = FX.bloodMass(1.5);
      rock.position.copy(hand);
      scene.add(rock);
      var v = d.clone().multiplyScalar(46); v.y = 5;
      var done = false;
      addFx({ t: 3, update: function (dd) {
        this.t -= dd;
        v.y -= 22 * dd;
        rock.position.addScaledVector(v, dd);
        rock.rotation.x += dd * 7; rock.rotation.z += dd * 5;
        if (Math.random() < dd * 30) FX.bloodMote(rock.position.clone(), 1.4, .3);
        if (!done && (rock.position.y <= .8 || this.t <= 0)) {
          done = true;
          var at = rock.position.clone();
          FX.bloodBurst(at, 4.5, new THREE.Vector3(0, 1, 0));
          FX.bloodThreads(at, 10, 20, 1.4);
          FX.bloodRings(at, 4, { maxR: 20, life: .7, gap: 40 });
          FX.cracks(new THREE.Vector3(at.x, 0, at.z), 11, 17, 0x2a0810, 0x5a3038);
          FX.debris(new THREE.Vector3(at.x, 0, at.z), 16, 18, DARK);
          scene.remove(rock);
          return false;
        }
        return true;
      } });
    },
    supernova: function (pos) {
      var mid = pos.clone().add(new THREE.Vector3(0, 3, 0));
      FX.tint('#40040f', .5, .3);
      FX.bloodRings(mid, 4, { maxR: 16, life: .6, gap: 34 });
      for (var i = 0; i < 18; i++) {
        (function (n) {
          setTimeout(function () {
            if (typeof scene === 'undefined') return;
            var ang = n / 18 * TAU + Math.random() * .3;
            var d = new THREE.Vector3(Math.cos(ang), -.15 + Math.random() * .5, Math.sin(ang)).normalize();
            var orb = FX.bloodMass(.62);
            orb.position.copy(mid);
            scene.add(orb);
            var sp = 34 + Math.random() * 16;
            addFx({ t: 1.4, update: function (dd) {
              this.t -= dd;
              orb.position.addScaledVector(d, sp * dd);
              orb.rotation.x += dd * 6; orb.rotation.z += dd * 4;
              if (Math.random() < dd * 18) FX.bloodMote(orb.position.clone(), .7, .2);
              if (this.t <= 0) { scene.remove(orb); return false; }
              return true;
            } });
          }, n * 26);
        })(i);
      }
    },
    scale: function (pos) {
      FX.tint('#48060f', .45, .45);
      FX.bloodRings(new THREE.Vector3(pos.x, .1, pos.z), 4,
        { maxR: 12, life: .7, gap: 50, ground: true });
      /* the pressure holds on them for as long as it holds on him */
      var t = 0;
      addFx({ t: SCALE_DUR, update: function (dd) {
        this.t -= dd; t += dd;
        if (Math.random() < dd * 7) {
          FX.bloodMote(pos.clone().add(new THREE.Vector3(
            (Math.random() - .5) * 4, 1 + Math.random() * 4, (Math.random() - .5) * 4)), 1.4, .4);
        }
        return this.t > 0;
      } });
    },
    edge: function (pos, yaw) {
      var d = dirOf(yaw);
      var at = pos.clone().addScaledVector(d, 3).add(new THREE.Vector3(0, 2.8, 0));
      var side = new THREE.Vector3(-d.z, 0, d.x);
      FX.bloodCut(at.clone().addScaledVector(side, -5).add(new THREE.Vector3(0, 2.4, 0)),
        at.clone().addScaledVector(side, 5).add(new THREE.Vector3(0, -2.4, 0)), 1.3, .3);
      FX.bloodBurst(at, 2.6, d.clone().setY(.3));
      FX.bloodThreads(at, 6, 15, 1.1);
    }
  };
})();
