/* =======================================================================
   FINISHERS

   Naoya had one and nobody else did. Now every fighter has a long one on
   their ordinary kit: land a hit on somebody who is nearly out and the
   match stops for it.

   While it runs, neither the target nor the attacker can be taken below
   one point of health, so nothing gets cut short — and each one ends its
   own way rather than everybody flopping over the same.

     Gojo    Hollow Purple, point blank        the body comes apart
     Yuji    four Black Flashes and a slam     the body burns
     Hakari  the reels, and then the shutter   the body drops
     Naoya   twenty-four frames and the tanto  the body comes apart
   ===================================================================== */
(function () {
  'use strict';
  if (typeof player === 'undefined' || typeof THREE === 'undefined') return;
  var FX = window.JJFX, G = window.JJGORE;
  if (!FX || !G) return;
  var AN = window.JJANIM;
  var E = FX.ease;

  var FIN = window.JJFIN = { on: false, cd: 0, vic: null };
  var TRIGGER = .22;          /* at or under this much health left */
  var COOLDOWN = 14;

  function hud(v) { if (window.JJSTAGE) window.JJSTAGE.hud(v); }
  function rp(r) { resetPose(r); if (r.body) r.body.rotation.set(0, 0, 0); }
  function fwd(yaw) { return new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)); }

  /* =====================================================================
     POSES FOR WHOEVER IS ON THE RECEIVING END
     ================================================================== */
  function vpose(r, kind, k, t) {
    if (!r) return;
    rp(r);
    var sway = Math.sin((t || 0) * 3.2) * .06;
    switch (kind) {
      case 'held':                                   // hanging off a fist
        r.spine.rotation.x = .3 + sway;
        r.spine.rotation.z = sway * 2;
        r.neck.rotation.x = .5;
        r.shoulderL.rotation.x = -.3; r.shoulderL.rotation.z = .5;
        r.shoulderR.rotation.x = -.3; r.shoulderR.rotation.z = -.5;
        r.elbowL.rotation.x = -.5; r.elbowR.rotation.x = -.5;
        r.hipL.rotation.x = .35; r.hipR.rotation.x = .2;
        r.kneeL.rotation.x = .8; r.kneeR.rotation.x = .5;
        break;
      case 'limp':                                   // nothing holding it up
        r.spine.rotation.x = .85 + sway * .4;
        r.neck.rotation.x = .9;
        r.shoulderL.rotation.x = .5; r.shoulderR.rotation.x = .5;
        r.elbowL.rotation.x = -.3; r.elbowR.rotation.x = -.3;
        r.hipL.rotation.x = .5; r.hipR.rotation.x = .4;
        r.kneeL.rotation.x = 1.3; r.kneeR.rotation.x = 1.1;
        r.hips.position.y = r.hipsBaseY - 1.1;
        break;
      case 'kneel':
        r.spine.rotation.x = .55;
        r.neck.rotation.x = .35;
        r.shoulderL.rotation.x = .2; r.shoulderR.rotation.x = .2;
        r.elbowL.rotation.x = -.6; r.elbowR.rotation.x = -.6;
        r.hipL.rotation.x = -1.5; r.kneeL.rotation.x = 2;
        r.hipR.rotation.x = .3; r.kneeR.rotation.x = 1.6;
        r.hips.position.y = r.hipsBaseY - 1.5;
        break;
      case 'air':                                    // thrown, and not in control
        r.spine.rotation.x = -.5 + sway;
        r.neck.rotation.x = -.4;
        r.shoulderL.rotation.x = -2.4; r.shoulderL.rotation.z = .6;
        r.shoulderR.rotation.x = -2.4; r.shoulderR.rotation.z = -.6;
        r.elbowL.rotation.x = -.4; r.elbowR.rotation.x = -.4;
        r.hipL.rotation.x = .6; r.hipR.rotation.x = .3;
        r.kneeL.rotation.x = .9; r.kneeR.rotation.x = .5;
        break;
      case 'flat':                                   // on their back
        if (r.root) r.root.rotation.x = -Math.PI / 2 * .92;
        r.spine.rotation.x = .12;
        r.shoulderL.rotation.z = .9; r.shoulderR.rotation.z = -.9;
        r.hipL.rotation.x = .2; r.hipR.rotation.x = -.15;
        r.kneeL.rotation.x = .3; r.kneeR.rotation.x = .2;
        break;
      case 'brace':                                  // still up, only just
        r.spine.rotation.x = .4 + sway;
        r.neck.rotation.x = .2;
        r.shoulderL.rotation.x = -.9; r.shoulderL.rotation.z = .7;
        r.shoulderR.rotation.x = -.9; r.shoulderR.rotation.z = -.7;
        r.elbowL.rotation.x = -1.4; r.elbowR.rotation.x = -1.4;
        r.kneeL.rotation.x = .5; r.kneeR.rotation.x = .4;
        r.hips.position.y = r.hipsBaseY - .4;
        break;
    }
    if (k != null && k < 1) {                        // ease into it
      var f = E.out(Math.max(0, k));
      ['spine', 'neck', 'shoulderL', 'shoulderR', 'elbowL', 'elbowR',
        'hipL', 'hipR', 'kneeL', 'kneeR'].forEach(function (j) {
        if (!r[j]) return;
        r[j].rotation.x *= f; r[j].rotation.z *= f;
      });
    }
  }

  function place(vic, at, y, faceTo) {
    if (!vic) return;
    vic.pos.set(at.x, y == null ? 0 : y, at.z);
    if (vic.rig) {
      vic.rig.root.position.set(at.x, y == null ? 0 : y, at.z);
      if (faceTo) {
        vic.rig.root.rotation.set(0, Math.atan2(faceTo.x - at.x, faceTo.z - at.z), 0);
      }
    }
  }

  /* =====================================================================
     THE RUNNER
     ================================================================== */
  function begin(vic, def) {
    if (FIN.on || !vic || vic.dead) return false;
    FIN.on = true;
    FIN.vic = vic;
    FIN.def = def;
    FIN.cd = COOLDOWN;
    G.lock(vic, true);
    G.lock(player, true);
    vic.cineHold = true;
    vic.vel.set(0, 0, 0);
    vic.stunT = def.dur + 1;
    vic.lockT = def.dur + 1;
    if (vic.hpSpr) vic.hpSpr.visible = false;
    if (window.JJRAG && vic.rag) { try { window.JJRAG.stop(vic); } catch (e) {} }
    player.iframes = Math.max(player.iframes, def.dur + .5);
    player.action = { type: 'fin', t: 0, dur: def.dur, stage: 0, vic: vic, def: def };
    hud(false);
    FX.letterbox(true);
    if (def.tint) FX.tint(def.tint, .38, def.dur);
    if (AN) AN.camRelease();
    hitstop(.16);
    FX.flash('#ffffff', .5, .18);
    if (window.JJNOTICE) window.JJNOTICE(def.name, def.colour);
    if (window.MPJJ && window.MPJJ.relay) {
      window.MPJJ.relay.pub({ t: 'cast', id: window.MPJJ.id, k: 'fin' });
    }
    return true;
  }

  function end(a) {
    var vic = a.vic;
    FIN.on = false;
    FIN.vic = null;
    G.lock(player, false);
    hud(true);
    FX.letterbox(false);
    if (a.def.tint) FX.tint(a.def.tint, 0);
    if (vic) {
      vic.cineHold = false;
      G.lock(vic, false);
      if (!vic.dead) {
        G.mark(vic, a.def.death, a.dir || fwd(player.facing));
        vic.hp = 0;
        try { vic.die(); } catch (e) {}
      }
    }
  }

  function step(a, dt) {
    var vic = a.vic;
    player.vel.set(0, 0, 0);
    if (!vic || (vic.dead && !vic.__gone)) { end(a); player.action = null; return; }
    a.def.step(a, dt, vic);
    if (a.t >= a.dur - .05 && !a.done) { a.done = 1; end(a); }
  }

  function pose(r, a) {
    if (a.def && a.def.pose) a.def.pose(r, a);
    if (a.vic && a.vic.rig && a.def && a.def.vic) a.def.vic(a.vic.rig, a, a.vic);
  }

  function camera(a, dt) {
    var marks = a.def.cam, t = a.t;
    var i = 0;
    while (i < marks.length - 1 && t >= marks[i + 1].t) i++;
    var m0 = marks[i], m1 = marks[Math.min(i + 1, marks.length - 1)];
    var k = m1 === m0 ? 0 : E.out(Math.min(1, (t - m0.t) / Math.max(.001, m1.t - m0.t)));
    function mix(f) { return m0[f] + (m1[f] - m0[f]) * k; }
    /* shots are framed on the pair, so neither of them slides out of it */
    var mid = a.vic ? player.pos.clone().add(a.vic.pos).multiplyScalar(.5) : player.pos.clone();
    var yaw = player.facing + mix('yaw'), d = mix('d');
    if (AN) {
      AN.camTo(mid.x + Math.sin(yaw) * d, mid.y + mix('h'), mid.z + Math.cos(yaw) * d,
        mid.x, mid.y + mix('ly'), mid.z, dt, mix('k'));
    }
    shakeMag = Math.max(0, shakeMag - dt * 2);
  }

  /* =====================================================================
     GOJO — HOLLOW PURPLE, POINT BLANK
     ================================================================== */
  var GOJO = {
    name: 'HOLLOW PURPLE', colour: '#c39bff', death: 'cut', dur: 8.6,
    tint: '#060412',
    cam: [
      { t: 0, yaw: .8, d: 6, h: 3.4, ly: 3, k: 20 },
      { t: 1.2, yaw: 1.5, d: 4.2, h: 4.6, ly: 4.2, k: 22 },
      { t: 2.6, yaw: .3, d: 9, h: 8, ly: 6, k: 12 },
      { t: 4.0, yaw: -.7, d: 6.5, h: 3.2, ly: 2.6, k: 15 },
      { t: 5.4, yaw: -.2, d: 4.4, h: 3.8, ly: 3.4, k: 24 },
      { t: 6.4, yaw: 1.1, d: 11, h: 4.4, ly: 3.2, k: 11 },
      { t: 7.4, yaw: 1.4, d: 13, h: 5, ly: 2.6, k: 10 },
      { t: 8.6, yaw: .9, d: 9, h: 4, ly: 2.4, k: 12 }
    ],
    step: function (a, dt, v) {
      var p = player, f = fwd(p.facing);
      if (a.stage < 1) {
        a.stage = 1;
        a.dir = f.clone();
        place(v, p.pos.clone().addScaledVector(f, 2.6), 0, p.pos);
        FX.flash('#bfd8ff', .5, .2);
        FX.streaks(v.pos.clone().add(new THREE.Vector3(0, 3, 0)), 0x6fb4ff, 6, 8, 1.1);
      }
      /* up */
      if (a.t >= 1.1 && a.stage < 2) {
        a.stage = 2;
        FX.impact(v.pos.clone().add(new THREE.Vector3(0, 3.4, 0)), 0x6fb4ff, 2);
        FX.cross(v.pos.clone().add(new THREE.Vector3(0, 3.4, 0)), 0xffffff, 3, .2);
        addShake(.9); hitstop(.08);
      }
      if (a.t >= 1.2 && a.t < 2.8) {
        var rise = (a.t - 1.2) / 1.6;
        place(v, p.pos.clone().addScaledVector(f, 2.4), 1 + Math.sin(rise * Math.PI) * 9, p.pos);
        if (Math.random() < .5) FX.mote(v.pos.clone().add(new THREE.Vector3(0, 3, 0)), 0x9fd8ff, 6, .4);
      }
      /* and down */
      if (a.t >= 2.8 && a.stage < 3) {
        a.stage = 3;
        place(v, p.pos.clone().addScaledVector(f, 2.4), 0, p.pos);
        FX.rings(new THREE.Vector3(v.pos.x, .12, v.pos.z), 0x6fb4ff, 4, { maxR: 14, life: .7, gap: 50 });
        FX.cracks(v.pos.clone(), 14, 13, 0x1a2038);
        FX.debris(v.pos.clone(), 14, 13, 0x39405a);
        FX.dust(v.pos.clone(), 10, 2.4);
        addShake(1.6); hitstop(.14);
        try { sfx.blast(); } catch (e) {}
      }
      /* blue, then red, then the thing they make */
      if (a.t >= 3.6 && a.stage < 4) {
        a.stage = 4;
        a.blue = FX.billboard(FX.T.star, 0x3a7dff, .95);
        a.red = FX.billboard(FX.T.star, 0xff3344, .95);
        scene.add(a.blue); scene.add(a.red);
        FX.converge(p.pos.clone().add(new THREE.Vector3(0, 3.4, 0)), 0x6fb4ff, 28, 12, .9);
        try { sfx.raise(); } catch (e) {}
      }
      if (a.blue) {
        var side = new THREE.Vector3(f.z, 0, -f.x);
        var gap = a.t < 5.6 ? 1.5 - E.out(Math.min(1, (a.t - 3.6) / 2)) * 1.35 : .15;
        var hub = p.pos.clone().addScaledVector(f, 1.4).add(new THREE.Vector3(0, 3.4, 0));
        a.blue.position.copy(hub).addScaledVector(side, gap);
        a.red.position.copy(hub).addScaledVector(side, -gap);
        var gsz = 1 + E.out(Math.min(1, (a.t - 3.6) / 2)) * 1.4;
        a.blue.scale.setScalar(gsz); a.red.scale.setScalar(gsz);
        if (Math.random() < .6) FX.mote(a.blue.position.clone(), 0x3a7dff, 5, .3);
        if (Math.random() < .6) FX.mote(a.red.position.clone(), 0xff3344, 5, .3);
        addShake(.3);
      }
      if (a.t >= 5.7 && a.stage < 5) {
        a.stage = 5;
        if (a.blue) { scene.remove(a.blue); scene.remove(a.red); a.blue = null; }
        hitstop(.22);
        FX.flash('#e6d4ff', .9, .35);
        FX.mangaLines(1, .5);
        var from = p.pos.clone().addScaledVector(f, 1.2).add(new THREE.Vector3(0, 3.4, 0));
        FX.beam(from, f, 70, 0x8b5cff, { radius: 3.4, life: 1.1 });
        FX.beam(from, f, 70, 0xffffff, { radius: 1.4, life: 1 });
        FX.beam(from, f, 70, 0x2a0f5a, { radius: 5, life: 1.2 });
        for (var i = 0; i < 12; i++) {
          var at = from.clone().addScaledVector(f, 4 + i * 5);
          FX.impact(at, 0x8b5cff, 2);
          FX.cracks(new THREE.Vector3(at.x, .1, at.z), 6, 9, 0x1a0a2a);
        }
        FX.zoom(-16, 1);
        addShake(2.4);
        if (AN) AN.camKick(2);
        try { sfx.blast(); } catch (e) {}
      }
      /* the target is inside it for a while before there is nothing left */
      if (a.t >= 5.7 && a.t < 7.1) {
        var q = p.pos.clone().addScaledVector(f, 2.4 + (a.t - 5.7) * 3);
        place(v, q, .6 + Math.sin((a.t - 5.7) * 9) * .3, p.pos);
        if (Math.random() < .8) {
          FX.streaks(v.pos.clone().add(new THREE.Vector3(0, 2.6, 0)), 0xd0b8ff, 3, 8, 1.2);
        }
        addShake(1);
      }
      if (a.t >= 7.1 && a.stage < 6) {
        a.stage = 6;
        G.lock(v, false);
        G.mark(v, 'cut', f);
        v.hp = 0;
        try { v.die(); } catch (e) {}
        FX.flash('#ffffff', .7, .4);
        addShake(1.4);
      }
    },
    pose: function (r, a) {
      rp(r);
      var t = a.t;
      if (t < 1.2) {                                 // holding them up by the face
        var k = E.out(Math.min(1, t / .5));
        r.shoulderR.rotation.x = -1.4 * k;
        r.shoulderR.rotation.z = -.2 * k;
        r.elbowR.rotation.x = -.25 * k;
        r.shoulderL.rotation.x = -.3 * k;
        r.spine.rotation.x = -.1 * k;
        r.neck.rotation.x = -.15 * k;
      } else if (t < 2.8) {                          // the throw, and watching it
        var u = E.out(Math.min(1, (t - 1.2) / .3));
        r.shoulderR.rotation.x = -1.4 - 1.2 * u;
        r.shoulderR.rotation.z = -.2 - .3 * u;
        r.elbowR.rotation.x = -.25 + .2 * u;
        r.neck.rotation.x = -.15 - .55 * u;
        r.spine.rotation.x = -.1 - .2 * u;
      } else if (t < 3.6) {                          // hand down: they come with it
        var dn = E.out(Math.min(1, (t - 2.8) / .25));
        r.shoulderR.rotation.x = -2.6 + 3.3 * dn;
        r.elbowR.rotation.x = -.05;
        r.spine.rotation.x = -.3 + .7 * dn;
        r.neck.rotation.x = -.7 + .9 * dn;
        r.hips.position.y = r.hipsBaseY - .3 * dn;
        r.kneeL.rotation.x = .5 * dn; r.kneeR.rotation.x = .4 * dn;
      } else if (t < 5.7) {                          // both hands, and what is in them
        var c = E.out(Math.min(1, (t - 3.6) / .8));
        r.shoulderR.rotation.x = -1.2 * c;
        r.shoulderR.rotation.z = -.5 * c;
        r.elbowR.rotation.x = -1.1 * c;
        r.shoulderL.rotation.x = -1.2 * c;
        r.shoulderL.rotation.z = .5 * c;
        r.elbowL.rotation.x = -1.1 * c;
        r.spine.rotation.x = .1 * c;
        r.neck.rotation.x = -.1 * c;
        r.hips.position.y = r.hipsBaseY - .2 * c;
      } else {                                       // hands together, and pushed
        var s = E.out(Math.min(1, (t - 5.7) / .2));
        r.shoulderR.rotation.x = -1.2 - .35 * s;
        r.shoulderR.rotation.z = -.5 + .42 * s;
        r.elbowR.rotation.x = -1.1 + .95 * s;
        r.shoulderL.rotation.x = -1.2 - .35 * s;
        r.shoulderL.rotation.z = .5 - .42 * s;
        r.elbowL.rotation.x = -1.1 + .95 * s;
        r.spine.rotation.x = .1 - .32 * s;
        r.hips.position.y = r.hipsBaseY - .2 + .1 * s;
        if (AN) AN.weight(r, -.4 * s, 1);
      }
    },
    vic: function (r, a) {
      var t = a.t;
      if (t < 1.2) vpose(r, 'held', t / .4, t);
      else if (t < 2.8) vpose(r, 'air', 1, t);
      else if (t < 5.7) vpose(r, 'kneel', (t - 2.8) / .5, t);
      else vpose(r, 'air', 1, t);
    }
  };

  /* =====================================================================
     YUJI — FOUR BLACK FLASHES
     ================================================================== */
  var YUJI = {
    name: 'BLACK FLASH', colour: '#ff2a4a', death: 'burn', dur: 8.4,
    tint: '#120006',
    cam: [
      { t: 0, yaw: .7, d: 5.5, h: 3.4, ly: 3, k: 20 },
      { t: 1.0, yaw: 1.3, d: 3.6, h: 3.6, ly: 3.4, k: 26 },
      { t: 2.0, yaw: -1.2, d: 3.4, h: 3.4, ly: 3.2, k: 26 },
      { t: 3.0, yaw: 1.6, d: 3.2, h: 4, ly: 3.4, k: 26 },
      { t: 4.0, yaw: -.5, d: 4.2, h: 3.2, ly: 3.2, k: 24 },
      { t: 5.0, yaw: .2, d: 9, h: 7.5, ly: 5.5, k: 12 },
      { t: 6.4, yaw: -.9, d: 7, h: 4, ly: 2.6, k: 14 },
      { t: 7.4, yaw: .6, d: 8.5, h: 3.6, ly: 2, k: 12 },
      { t: 8.4, yaw: 1, d: 7.5, h: 3.4, ly: 1.8, k: 13 }
    ],
    step: function (a, dt, v) {
      var p = player, f = fwd(p.facing);
      if (a.stage < 1) {
        a.stage = 1;
        a.dir = f.clone();
        place(v, p.pos.clone().addScaledVector(f, 2.5), 0, p.pos);
        a.hits = 0;
      }
      /* four of them, on the beat */
      var beats = [1.15, 2.15, 3.15, 4.15];
      for (var i = 0; i < 4; i++) {
        if (a.t >= beats[i] && a.hits === i) {
          a.hits = i + 1;
          var at = v.pos.clone().add(new THREE.Vector3(0, 3 - i * .2, 0));
          if (window.JJYUJI && window.JJYUJI.blackFlash) {
            try { window.JJYUJI.blackFlash(at); } catch (e) {}
          }
          FX.cross(at, 0xffffff, 3.4 + i * .5, .22);
          FX.impact(at, 0xd4143c, 2 + i * .3);
          FX.streaks(at, 0x2a0410, 5, 8, 1.1);
          FX.mangaLines(.6 + i * .1, .3);
          hitstop(.1 + i * .03);
          addShake(1 + i * .3);
          if (AN) AN.camKick(1 + i * .3);
          try { sfx.frame(); } catch (e) {}
        }
      }
      /* launched, chased, caught */
      if (a.t >= 4.6 && a.stage < 2) {
        a.stage = 2;
        FX.rings(v.pos.clone().add(new THREE.Vector3(0, 2, 0)), 0xd4143c, 3,
          { maxR: 9, life: .5, ground: false, gap: 45 });
        addShake(1.2);
      }
      if (a.t >= 4.6 && a.t < 6.2) {
        var k = (a.t - 4.6) / 1.6;
        var h = Math.sin(Math.min(1, k * 1.25) * Math.PI) * 11;
        place(v, p.pos.clone().addScaledVector(f, 2.4), h, p.pos);
        p.pos.y = Math.max(0, h - 1.2);
        if (Math.random() < .6) FX.mote(v.pos.clone().add(new THREE.Vector3(0, 2, 0)), 0xd4143c, 6, .4);
      }
      /* and put through the floor */
      if (a.t >= 6.2 && a.stage < 3) {
        a.stage = 3;
        p.pos.y = 0;
        place(v, p.pos.clone().addScaledVector(f, 2.2), 0, p.pos);
        hitstop(.2);
        FX.flash('#ff2a4a', .8, .35);
        FX.cross(v.pos.clone().add(new THREE.Vector3(0, 1.6, 0)), 0xffffff, 7, .3);
        FX.rings(new THREE.Vector3(v.pos.x, .12, v.pos.z), 0xd4143c, 5, { maxR: 20, life: .8, gap: 50 });
        FX.cracks(v.pos.clone(), 18, 17, 0x120309);
        FX.debris(v.pos.clone(), 18, 16, 0x2a1218);
        FX.dust(v.pos.clone(), 14, 3);
        FX.zoom(-14, .9);
        addShake(2.4);
        if (AN) AN.camKick(2);
        try { sfx.blast(); } catch (e) {}
      }
      /* the cursed energy in the wound has nowhere to go */
      if (a.t >= 7.0 && a.stage < 4) {
        a.stage = 4;
        G.lock(v, false);
        G.mark(v, 'burn', f);
        v.hp = 0;
        try { v.die(); } catch (e) {}
        FX.flash('#ff8a3a', .7, .4);
        FX.beam(v.pos.clone(), new THREE.Vector3(0, 1, 0), 40, 0xff6a2a, { radius: 2, life: 1 });
        addShake(1.6);
      }
    },
    pose: function (r, a) {
      rp(r);
      var t = a.t, i;
      if (t < 4.6) {                                 // collar in one hand, the other working
        var grab = E.out(Math.min(1, t / .4));
        r.shoulderL.rotation.x = -1.5 * grab;
        r.elbowL.rotation.x = -.4 * grab;
        r.spine.rotation.x = .08;
        var beats = [1.15, 2.15, 3.15, 4.15], sw = 0, wind = 0;
        for (i = 0; i < 4; i++) {
          var d = t - beats[i];
          if (d > -.35 && d < 0) wind = Math.max(wind, (d + .35) / .35);
          if (d >= 0 && d < .3) sw = Math.max(sw, 1 - d / .3);
        }
        r.shoulderR.rotation.x = -.3 - 1.5 * wind + 1.1 * sw;
        r.shoulderR.rotation.z = -.2 - .5 * wind + .5 * sw;
        r.elbowR.rotation.x = -.4 - 1.5 * wind + 1.75 * sw;
        r.spine.rotation.y = .55 * wind - .95 * sw;
        r.neck.rotation.y = .25 * wind - .4 * sw;
        r.hips.position.y = r.hipsBaseY - .16 * wind;
        if (AN) AN.weight(r, .4 * sw - .2 * wind, 1);
      } else if (t < 6.2) {                          // up after them
        var u = E.out(Math.min(1, (t - 4.6) / .5));
        r.shoulderR.rotation.x = -2.5 * u;
        r.shoulderL.rotation.x = -2.3 * u;
        r.elbowR.rotation.x = -.5 * u; r.elbowL.rotation.x = -.5 * u;
        r.spine.rotation.x = -.35 * u;
        r.hipL.rotation.x = -.5 * u; r.hipR.rotation.x = -.3 * u;
        r.kneeL.rotation.x = 1 * u; r.kneeR.rotation.x = .7 * u;
      } else {                                       // and down on top of them
        var s = E.out(Math.min(1, (t - 6.2) / .22));
        r.shoulderR.rotation.x = -2.5 + 3.4 * s;
        r.shoulderL.rotation.x = -2.3 + 3.1 * s;
        r.elbowR.rotation.x = -.5 + .4 * s; r.elbowL.rotation.x = -.5 + .4 * s;
        r.spine.rotation.x = -.35 + 1.05 * s;
        r.neck.rotation.x = .4 * s;
        r.hips.position.y = r.hipsBaseY - .7 * s;
        r.kneeL.rotation.x = 1 + .5 * s; r.kneeR.rotation.x = .7 + .4 * s;
        if (AN) AN.weight(r, .7 * s, 1);
      }
    },
    vic: function (r, a) {
      var t = a.t;
      if (t < 4.6) vpose(r, 'held', t / .4, t);
      else if (t < 6.2) vpose(r, 'air', 1, t);
      else vpose(r, 'flat', 1, t);
    }
  };

  /* =====================================================================
     HAKARI — THE REELS, AND THEN THE SHUTTER
     ================================================================== */
  var HAKARI = {
    name: 'JACKPOT', colour: '#ffd964', death: 'ragdoll', dur: 8.2,
    tint: '#1a1204',
    cam: [
      { t: 0, yaw: .7, d: 6, h: 3.6, ly: 3, k: 20 },
      { t: 1.2, yaw: .1, d: 4, h: 5, ly: 4.6, k: 24 },
      { t: 2.8, yaw: -.6, d: 7, h: 4, ly: 3.2, k: 14 },
      { t: 4.2, yaw: 1.2, d: 5.5, h: 3.4, ly: 3, k: 18 },
      { t: 5.6, yaw: -1.1, d: 6, h: 4.4, ly: 3.4, k: 16 },
      { t: 6.8, yaw: .3, d: 9, h: 6, ly: 3, k: 12 },
      { t: 8.2, yaw: .8, d: 8, h: 4.2, ly: 2.4, k: 13 }
    ],
    step: function (a, dt, v) {
      var p = player, f = fwd(p.facing);
      if (a.stage < 1) {
        a.stage = 1;
        a.dir = f.clone();
        place(v, p.pos.clone().addScaledVector(f, 2.6), 0, p.pos);
        a.reels = [];
        for (var i = 0; i < 3; i++) {
          var m = FX.billboard(FX.T.star, 0xffd964, .95);
          m.scale.setScalar(2.2);
          scene.add(m);
          a.reels.push(m);
        }
      }
      if (a.reels) {
        var hub = p.pos.clone().addScaledVector(f, 1.4).add(new THREE.Vector3(0, 6.4, 0));
        var side = new THREE.Vector3(f.z, 0, -f.x);
        for (var r = 0; r < 3; r++) {
          var stopAt = 1.4 + r * .5;
          var spin = a.t < stopAt ? Math.sin(a.t * 26 + r) * .9 : 0;
          a.reels[r].position.copy(hub).addScaledVector(side, (r - 1) * 2.4)
            .add(new THREE.Vector3(0, spin, 0));
          a.reels[r].material.color.setHex(a.t < stopAt ? 0xfff0b0 : 0xffd964);
          if (a.t >= stopAt && !a.reels[r].__hit) {
            a.reels[r].__hit = 1;
            FX.impact(a.reels[r].position.clone(), 0xffd964, 1.6);
            addShake(.5);
            try { sfx.hit(); } catch (e) {}
          }
        }
      }
      if (a.t >= 2.5 && a.stage < 2) {                // three of a kind
        a.stage = 2;
        FX.flash('#fff0b0', .9, .4);
        FX.rings(new THREE.Vector3(p.pos.x, .12, p.pos.z), 0xffd964, 5, { maxR: 22, life: .8, gap: 50 });
        FX.mangaLines(.9, .4);
        addShake(1.8);
        hitstop(.16);
        if (a.reels) {
          a.reels.forEach(function (m) { scene.remove(m); m.material.dispose(); });
          a.reels = null;
        }
        try { sfx.frame(); } catch (e) {}
      }
      /* the combo, while the parlour applauds */
      if (a.t >= 2.9 && a.t < 5.4) {
        a.beat = (a.beat || 0) + dt;
        if (a.beat > .22) {
          a.beat = 0;
          var at = v.pos.clone().add(new THREE.Vector3(
            (Math.random() - .5) * 1.4, 2 + Math.random() * 2, (Math.random() - .5) * 1.4));
          FX.impact(at, 0xffd964, 1.5);
          FX.streaks(at, 0xfff0b0, 3, 6, 1);
          addShake(.5);
          if (Math.random() < .4) FX.cross(at, 0xffffff, 2.2, .16);
        }
      }
      /* and the shutter, which is not a fist */
      if (a.t >= 5.5 && a.stage < 3) {
        a.stage = 3;
        a.door = new THREE.Mesh(new THREE.BoxGeometry(6, 8, .6),
          new THREE.MeshStandardMaterial({ color: 0x8a6a2a, roughness: .5, metalness: .7 }));
        scene.add(a.door);
        FX.converge(v.pos.clone().add(new THREE.Vector3(0, 4, 0)), 0xffd964, 24, 10, .6);
      }
      if (a.door) {
        var k2 = Math.min(1, (a.t - 5.5) / .8);
        a.door.position.copy(v.pos).add(new THREE.Vector3(0, 16 - E.in(k2) * 12, 0));
        a.door.rotation.y = p.facing;
        if (k2 >= 1 && !a.slammed) {
          a.slammed = 1;
          hitstop(.24);
          FX.flash('#fff0b0', .9, .4);
          FX.impact(v.pos.clone().add(new THREE.Vector3(0, 2, 0)), 0xffd964, 4);
          FX.rings(new THREE.Vector3(v.pos.x, .1, v.pos.z), 0xffd964, 6, { maxR: 26, life: .9, gap: 45 });
          FX.cracks(v.pos.clone(), 20, 18, 0x2a2008);
          FX.debris(v.pos.clone(), 20, 17, 0x6b5a30);
          FX.dust(v.pos.clone(), 16, 3.2);
          FX.zoom(-15, .9);
          addShake(2.6);
          if (AN) AN.camKick(2.2);
          try { sfx.blast(); } catch (e) {}
        }
      }
      if (a.t >= 6.9 && a.stage < 4) {
        a.stage = 4;
        if (a.door) { scene.remove(a.door); a.door = null; }
        G.lock(v, false);
        G.mark(v, 'ragdoll', f);
        v.hp = 0;
        try { v.die(); } catch (e) {}
        /* it pays out over the body */
        for (var c = 0; c < 30; c++) {
          (function (n) {
            setTimeout(function () {
              var m = FX.billboard(FX.T.star, n % 2 ? 0xffd964 : 0xfff0c0, 1);
              m.scale.setScalar(.5 + Math.random() * .5);
              m.position.copy(v.pos).add(new THREE.Vector3(
                (Math.random() - .5) * 5, 9 + Math.random() * 5, (Math.random() - .5) * 5));
              scene.add(m);
              var vy = 1 + Math.random() * 3;
              addFx({ t: 2, update: function (d) {
                this.t -= d; vy -= 26 * d;
                m.position.y += vy * d;
                if (m.position.y < .4) { m.position.y = .4; vy = Math.abs(vy) * .4; }
                m.material.opacity = Math.min(1, this.t);
                if (this.t <= 0) { scene.remove(m); m.material.dispose(); return false; }
                return true;
              } });
            }, n * 40);
          })(c);
        }
      }
    },
    pose: function (r, a) {
      rp(r);
      var t = a.t;
      if (t < 2.9) {                                 // one hand up, pulling the handle
        var k = E.out(Math.min(1, t / .6));
        var pull = t > 1 && t < 1.4 ? E.out((t - 1) / .4) : (t >= 1.4 ? 1 : 0);
        r.shoulderR.rotation.x = -2.3 * k + 1.1 * pull;
        r.shoulderR.rotation.z = -.5 * k;
        r.elbowR.rotation.x = -.6 * k + .3 * pull;
        r.shoulderL.rotation.x = -1.2 * k;
        r.elbowL.rotation.x = -.5 * k;
        r.spine.rotation.x = -.15 * k + .2 * pull;
        r.neck.rotation.x = -.3 * k + .2 * pull;
        if (AN) AN.weight(r, -.2 * k + .3 * pull, 1);
      } else if (t < 5.5) {                          // hands, fast
        var sw = Math.sin(t * 15);
        r.shoulderR.rotation.x = -1.3 + sw * .7;
        r.elbowR.rotation.x = -.8 - sw * .5;
        r.shoulderL.rotation.x = -1.3 - sw * .7;
        r.elbowL.rotation.x = -.8 + sw * .5;
        r.spine.rotation.y = sw * .35;
        r.spine.rotation.x = .12;
        r.hips.position.y = r.hipsBaseY - .12;
      } else {                                       // both arms up under the door
        var u = E.out(Math.min(1, (t - 5.5) / .5));
        var slam = t > 6.3 ? E.out(Math.min(1, (t - 6.3) / .2)) : 0;
        r.shoulderR.rotation.x = -2.7 * u + 2.9 * slam;
        r.shoulderL.rotation.x = -2.7 * u + 2.9 * slam;
        r.shoulderR.rotation.z = -.45 * u;
        r.shoulderL.rotation.z = .45 * u;
        r.elbowR.rotation.x = -.3 * u; r.elbowL.rotation.x = -.3 * u;
        r.spine.rotation.x = -.3 * u + .95 * slam;
        r.hips.position.y = r.hipsBaseY + .12 * u - .75 * slam;
        r.kneeL.rotation.x = .2 + .9 * slam; r.kneeR.rotation.x = .2 + .7 * slam;
        if (AN) AN.weight(r, -.3 * u + .8 * slam, 1);
      }
    },
    vic: function (r, a) {
      var t = a.t;
      if (t < 2.9) vpose(r, 'brace', t / .5, t);
      else if (t < 5.5) vpose(r, 'held', 1, t * 3);
      else if (t < 6.5) vpose(r, 'brace', 1, t);
      else vpose(r, 'flat', 1, t);
    }
  };

  /* =====================================================================
     NAOYA — TWENTY-FOUR FRAMES
     ================================================================== */
  var NAOYA = {
    name: '24 FRAMES', colour: '#9fd8ff', death: 'cut', dur: 8.0,
    tint: '#040810',
    cam: [
      { t: 0, yaw: .8, d: 6, h: 3.4, ly: 3, k: 20 },
      { t: 1.0, yaw: 1.4, d: 4, h: 3.8, ly: 3.4, k: 24 },
      { t: 2.4, yaw: -1.4, d: 5, h: 3.2, ly: 3, k: 20 },
      { t: 4.0, yaw: .5, d: 4.2, h: 3.6, ly: 3.2, k: 22 },
      { t: 5.4, yaw: -.4, d: 3.6, h: 3.4, ly: 3.2, k: 26 },
      { t: 6.4, yaw: 1.5, d: 9, h: 4.2, ly: 2.8, k: 12 },
      { t: 8.0, yaw: 1.1, d: 7.5, h: 3.6, ly: 2.2, k: 13 }
    ],
    step: function (a, dt, v) {
      var p = player, f = fwd(p.facing);
      if (a.stage < 1) {
        a.stage = 1;
        a.dir = f.clone();
        place(v, p.pos.clone().addScaledVector(f, 2.8), 0, p.pos);
        a.cut = 0;
        FX.speedRing(p.pos.clone().add(new THREE.Vector3(0, 2, 0)), 0x9fd8ff, 8, .4);
      }
      /* he crosses the gap a frame at a time, and each frame leaves a cut */
      if (a.t >= 1.0 && a.t < 5.6) {
        a.fr = (a.fr || 0) + dt;
        if (a.fr > 1 / 12) {                          // deliberately not smooth
          a.fr = 0;
          a.cut++;
          var ang = a.cut * 1.9;
          var around = new THREE.Vector3(Math.sin(ang), 0, Math.cos(ang)).multiplyScalar(2.9);
          p.pos.copy(v.pos).add(around);
          p.facing = Math.atan2(v.pos.x - p.pos.x, v.pos.z - p.pos.z);
          var at = v.pos.clone().add(new THREE.Vector3(
            (Math.random() - .5) * 1.6, 1.4 + Math.random() * 3, (Math.random() - .5) * 1.6));
          FX.slash(at, around.clone().normalize(), a.cut % 3 ? 0xcfefff : 0xffffff, 4.5, .16);
          FX.impact(at, 0x9be7ff, 1.2);
          if (a.cut % 3 === 0) { addShake(.5); FX.streaks(at, 0xcfefff, 3, 7, 1); }
          if (window.ghostAfterimage) { try { ghostAfterimage(p.rig, 0x9fd8ff); } catch (e) {} }
        }
      }
      /* the last one is drawn slowly, which is the only one they see */
      if (a.t >= 5.7 && a.stage < 2) {
        a.stage = 2;
        p.pos.copy(v.pos).addScaledVector(f, -2.6);
        p.facing = Math.atan2(v.pos.x - p.pos.x, v.pos.z - p.pos.z);
        FX.converge(p.pos.clone().add(new THREE.Vector3(0, 3, 0)), 0x9fd8ff, 20, 9, .7);
        FX.zoom(-6, .7);
      }
      if (a.t >= 6.4 && a.stage < 3) {
        a.stage = 3;
        var dir = v.pos.clone().sub(p.pos).setY(0).normalize();
        a.dir = dir.clone();
        hitstop(.26);
        FX.flash('#ffffff', .9, .3);
        var at2 = v.pos.clone().add(new THREE.Vector3(0, 2.8, 0));
        FX.slash(at2, dir, 0xffffff, 15, .3);
        FX.slash(at2, dir, 0x9fd8ff, 12, .28);
        FX.cross(at2, 0xffffff, 6, .28);
        FX.mangaLines(1, .45);
        FX.zoom(-14, .9);
        addShake(2.2);
        if (AN) AN.camKick(2);
        try { sfx.slash(); } catch (e) {}
        G.lock(v, false);
        G.mark(v, 'cut', dir);
        v.hp = 0;
        try { v.die(); } catch (e) {}
      }
    },
    pose: function (r, a) {
      rp(r);
      var t = a.t;
      if (t < 1.0) {
        var k = E.out(t / .6);
        r.shoulderR.rotation.x = -.6 * k;
        r.shoulderR.rotation.z = -.5 * k;
        r.elbowR.rotation.x = -1.5 * k;
        r.spine.rotation.y = .4 * k;
        r.neck.rotation.y = -.2 * k;
        r.hips.position.y = r.hipsBaseY - .18 * k;
      } else if (t < 5.7) {                          // mid-cut, every frame
        var ph = ((a.cut || 0) % 2) ? 1 : 0;
        r.shoulderR.rotation.x = -1.4 + ph * .9;
        r.shoulderR.rotation.z = -.9 + ph * 1.4;
        r.elbowR.rotation.x = -1.6 + ph * 1.3;
        r.shoulderL.rotation.x = -.5 - ph * .3;
        r.spine.rotation.y = .7 - ph * 1.3;
        r.spine.rotation.x = .1;
        r.neck.rotation.y = -.3 + ph * .5;
        r.hips.position.y = r.hipsBaseY - .2;
      } else if (t < 6.4) {                          // the draw
        var w = E.out((t - 5.7) / .6);
        r.shoulderR.rotation.x = -.4 - .9 * w;
        r.shoulderR.rotation.z = -.3 - 1 * w;
        r.elbowR.rotation.x = -.5 - 1.6 * w;
        r.shoulderL.rotation.x = -.3 - .4 * w;
        r.spine.rotation.y = 1.15 * w;
        r.neck.rotation.y = -.45 * w;
        r.hips.position.y = r.hipsBaseY - .3 * w;
        r.kneeL.rotation.x = .5 * w; r.kneeR.rotation.x = .3 * w;
        if (AN) AN.weight(r, -.4 * w, 1);
      } else {                                       // and through
        var s = E.out(Math.min(1, (t - 6.4) / .16));
        r.shoulderR.rotation.x = -1.3 + .9 * s;
        r.shoulderR.rotation.z = -1.3 + 2.3 * s;
        r.elbowR.rotation.x = -2.1 + 1.9 * s;
        r.shoulderL.rotation.x = -.7 + .3 * s;
        r.spine.rotation.y = 1.15 - 2.1 * s;
        r.spine.rotation.x = .18 * s;
        r.neck.rotation.y = -.45 + .8 * s;
        r.hips.position.y = r.hipsBaseY - .3 + .2 * s;
        if (AN) AN.weight(r, .5 * s, 1);
      }
    },
    vic: function (r, a) {
      var t = a.t;
      if (t < 1.0) vpose(r, 'brace', t / .5, t);
      else if (t < 5.7) vpose(r, 'brace', 1, t * 5);
      else vpose(r, 'limp', 1, t);
    }
  };

  var BY_CHAR = { gojo: GOJO, yuji: YUJI, hakari: HAKARI, naoya: NAOYA };

  /* =====================================================================
     WHEN IT FIRES
     ================================================================== */
  function want(vic, amount) {
    if (FIN.on || FIN.cd > 0 || !vic || vic.dead || vic.__gone) return false;
    if (vic.rag || vic.cineHold) return false;
    if (player.dead || !player.rig) return false;
    if (vic.hp <= 0) return false;
    /* a blow that would end it always earns one; anything short of that
       has to be a real hit on somebody already nearly out */
    var max = vic.maxHp || 100;
    var lethal = vic.hp - amount <= 0;
    if (!lethal && (amount < 7 || vic.hp - amount > max * TRIGGER)) return false;
    var a = player.action;
    if (a && (a.type === 'fin' || a.type.charAt(0) === 'a' || a.type === 's4' ||
      a.type === 'h4' || a.type === 'yaw' || a.type === 'void' || a.type === 'kb')) return false;
    if (window.JJNAOYA && window.JJNAOYA.busy && window.JJNAOYA.busy()) return false;
    if (vic.pos.distanceTo(player.pos) > 26) return false;
    var def = BY_CHAR[player.char];
    if (!def) return false;
    player.facing = Math.atan2(vic.pos.x - player.pos.x, vic.pos.z - player.pos.z);
    return begin(vic, def);
  }

  var _damage = Enemy.prototype.damage;
  Enemy.prototype.damage = function (amount, knock, opt) {
    if (!(opt && opt.noFinisher) && want(this, amount)) return;
    return _damage.call(this, amount, knock, opt);
  };

  var _stepAction = stepAction;
  stepAction = function (a, dt) {
    if (a.type === 'fin') return step(a, dt);
    return _stepAction(a, dt);
  };
  var _poseAction = poseAction;
  poseAction = function (r, a) {
    if (a.type === 'fin') {
      if (r === player.rig) { pose(r, a); return; }
      return;
    }
    return _poseAction(r, a);
  };
  var _updateCamera = updateCamera;
  updateCamera = function (dt) {
    var a = player.action;
    if (a && a.type === 'fin' && AN) { camera(a, dt); return; }
    return _updateCamera(dt);
  };

  addFx({ t: 1e9, update: function (dt) {
    if (FIN.cd > 0) FIN.cd -= dt;
    var a = player.action;
    if (FIN.on && (!a || a.type !== 'fin')) {         // interrupted somehow
      var v = FIN.vic;
      FIN.on = false; FIN.vic = null;
      G.lock(player, false);
      if (v) { v.cineHold = false; G.lock(v, false); }
      hud(true);
      FX.letterbox(false);
    }
    return true;
  } });
})();
