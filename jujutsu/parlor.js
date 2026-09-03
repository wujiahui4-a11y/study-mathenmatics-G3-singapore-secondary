/* =======================================================================
   IDLE DEATH GAMBLE — THE FLOOR
   Hakari's domain is not a void or a shrine. It is a pachinko parlour,
   and he is standing in the aisle of it: two rows of machines, the
   lights over them, the sign at the end, and a floor polished enough to
   hold all of it twice.

   The reels themselves are hakari.js's. This is the room they happen in,
   and the camera that walks it.
   ===================================================================== */
(function () {
  'use strict';
  if (typeof player === 'undefined' || typeof THREE === 'undefined') return;
  var FX = window.JJFX;
  if (!FX) return;
  var AN = window.JJANIM;
  var E = FX.ease;
  var GOLD = 0xffd964, HOT = 0xff4f8b, NEON = 0x4fd8ff;

  var P = window.JJPARLOR = { on: false, stage: [], lamps: [], t: 0 };
  var DUR = 9.6;

  function keep(o) { P.stage.push(o); scene.add(o); return o; }

  function box(w, h, d, c, opt) {
    opt = opt || {};
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
      opt.flat ? new THREE.MeshBasicMaterial({ color: c, toneMapped: false })
        : new THREE.MeshStandardMaterial({ color: c, roughness: opt.rough == null ? .7 : opt.rough,
          metalness: opt.metal || 0 }));
    return m;
  }

  /* one machine: a body, a lit face, a dish under it */
  function cabinet(lit) {
    var g = new THREE.Group();
    var body = box(2.2, 4.6, 1.5, 0x5a3a4c, { rough: .5, metal: .35 });
    body.position.y = 2.3;
    g.add(body);
    var face = box(1.8, 2.6, .12, lit, { flat: true });
    face.position.set(0, 3.1, .8);
    g.add(face);
    g.face = face;
    var glow = FX.billboard(FX.T.star, lit, .5);
    glow.scale.setScalar(4.4);
    glow.position.set(0, 3.1, 1.1);
    g.add(glow);
    g.glow = glow;
    var dish = box(1.9, .3, .8, 0x6a5230, { metal: .7, rough: .35 });
    dish.position.set(0, 1.5, .85);
    g.add(dish);
    var crown = box(2.3, .34, 1.6, HOT, { flat: true });
    crown.position.y = 4.8;
    g.add(crown);
    g.crown = crown;
    return g;
  }

  function build(center, facing) {
    var room = new THREE.Group();
    room.position.copy(center);
    room.rotation.y = facing;

    /* the floor, dark and polished */
    var floor = new THREE.Mesh(new THREE.PlaneGeometry(64, 96),
      new THREE.MeshStandardMaterial({ color: 0x2a1824, roughness: .16, metalness: .8 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = .03;
    room.add(floor);
    for (var s = -1; s <= 1; s += 2) {              // light running down the aisle
      var strip = new THREE.Mesh(new THREE.PlaneGeometry(.5, 90),
        new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: .55, toneMapped: false }));
      strip.rotation.x = -Math.PI / 2;
      strip.position.set(s * 5.2, .06, 0);
      room.add(strip);
    }

    /* the two rows, facing each other across it */
    P.cabs = [];
    var i, sd;
    for (i = 0; i < 11; i++) {
      for (sd = -1; sd <= 1; sd += 2) {
        var c = cabinet(i % 3 === 0 ? HOT : (i % 3 === 1 ? GOLD : NEON));
        c.position.set(sd * 8.5, 0, -34 + i * 6.4);
        c.rotation.y = sd > 0 ? -Math.PI / 2 : Math.PI / 2;
        room.add(c);
        P.cabs.push(c);
      }
    }

    /* walls behind the rows, and something over it all */
    for (sd = -1; sd <= 1; sd += 2) {
      var wall = box(1, 16, 92, 0x2e1c28, { rough: .85 });
      wall.position.set(sd * 12, 8, 0);
      room.add(wall);
    }
    var ceil = box(26, 1, 92, 0x241522, { rough: 1 });
    ceil.position.set(0, 15.5, 0);
    room.add(ceil);
    for (i = 0; i < 10; i++) {
      var tube = box(9, .3, .8, 0xfff0c0, { flat: true });
      tube.position.set(0, 14.8, -34 + i * 7.2);
      room.add(tube);
    }

    /* the sign at the end of the aisle */
    var sign = box(20, 5.4, .6, 0x2a0a18, { rough: .6 });
    sign.position.set(0, 9, -44);
    room.add(sign);
    for (i = 0; i < 5; i++) {
      var ch = box(2.4, 3, .3, i % 2 ? GOLD : HOT, { flat: true });
      ch.position.set(-7.2 + i * 3.6, 9, -43.6);
      room.add(ch);
    }
    var signGlow = FX.billboard(FX.T.star, HOT, .6);
    signGlow.scale.setScalar(30);
    signGlow.position.set(0, 9, -42);
    room.add(signGlow);
    P.signGlow = signGlow;

    /* light: warm, low, and a lot of it */
    var amb = new THREE.AmbientLight(0x9a7a88, 2.2);
    room.add(amb);
    var key = new THREE.PointLight(0xffd8b0, 4.5, 90, 1.1);
    key.position.set(0, 12, 6);
    room.add(key);
    var back = new THREE.PointLight(HOT, 3.4, 100, 1.2);
    back.position.set(0, 9, -36);
    room.add(back);
    var front = new THREE.PointLight(NEON, 2.8, 80, 1.3);
    front.position.set(0, 8, 26);
    room.add(front);
    P.lamps = [key, back, front];

    for (i = 0; i < 4; i++) {
      var aisle = new THREE.PointLight(0xffe0c0, 1.6, 46, 1.4);
      aisle.position.set(0, 11, -30 + i * 19);
      room.add(aisle);
    }

    keep(room);
    return room;
  }

  function open(center, yaw) {
    if (P.on) return;
    P.on = true;
    P.center = center.clone();
    P.room = build(center, yaw == null ? player.facing : yaw);
    P.room.scale.set(1, .01, 1);
    if (window.JJSTAGE) {
      window.JJSTAGE.hide.sky = 0x0d0510;
      window.JJSTAGE.hide(P.stage.slice());
      window.JJSTAGE.hud(false);
    }
  }

  function close() {
    if (!P.on) return;
    P.on = false;
    if (window.JJSTAGE) { window.JJSTAGE.show(); window.JJSTAGE.hud(true); }
    P.stage.forEach(function (o) { scene.remove(o); });
    P.stage.length = 0;
    P.cabs = null;
    P.room = null;
    FX.flash('#ffe9b0', .4, .5);
  }

  /* coins, when the machine finally gives something back. `always` is for
     the copy played by somebody standing outside the barrier, who has no
     parlour of their own for the check to pass against. */
  function payout(center, always) {
    for (var i = 0; i < 46; i++) {
      (function (n) {
        setTimeout(function () {
          if (!P.on && !always) return;
          var a = Math.random() * Math.PI * 2, r = Math.random() * 9;
          var m = FX.billboard(FX.T.star, n % 3 ? GOLD : 0xfff0c0, 1);
          m.scale.setScalar(.7 + Math.random() * .7);
          m.position.set(center.x + Math.cos(a) * r, 12 + Math.random() * 8,
            center.z + Math.sin(a) * r);
          scene.add(m);
          var vy = 2 + Math.random() * 4, life = 2.4;
          addFx({ t: life, update: function (d) {
            this.t -= d;
            vy -= 26 * d;
            m.position.y += vy * d;
            if (m.position.y < .4) { m.position.y = .4; vy = Math.abs(vy) * .42; }
            m.material.opacity = Math.min(1, this.t / .5);
            if (this.t <= 0) { scene.remove(m); m.material.dispose(); return false; }
            return true;
          } });
        }, n * 34);
      })(i);
    }
  }

  /* =====================================================================
     THE SEQUENCE, wrapped around hakari.js's reels
     ================================================================== */
  function stageStep(a, dt) {
    if (!a.par) {
      a.par = 1;
      a.dur = DUR;
      if (AN) AN.camRelease();
      FX.tint('#1a1204', .3, DUR);
    }
    if (a.t >= .85 && !P.on) {
      open(a.center || player.pos.clone());
      FX.flash('#fff3d0', .9, .45);
      addShake(1.6);
    }
    if (P.on && P.room) {
      var rise = Math.min(1, (a.t - .85) / 1.1);
      P.room.scale.y = .01 + E.out(rise) * .99;
      var pulse = .5 + Math.sin(a.t * 7) * .28;
      if (P.signGlow) P.signGlow.material.opacity = pulse;
      if (P.cabs) {
        for (var i = 0; i < P.cabs.length; i++) {
          var c = P.cabs[i];
          var ph = Math.sin(a.t * 6 + i * .7) * .5 + .5;
          c.glow.material.opacity = .3 + ph * .45;
          c.crown.material.color.setHex(ph > .5 ? HOT : GOLD);
        }
      }
      if (Math.random() < .5) {
        FX.mote(new THREE.Vector3(P.center.x + (Math.random() - .5) * 14, 1 + Math.random() * 10,
          P.center.z + (Math.random() - .5) * 30), GOLD, 4, .6);
      }
    }
    /* hakari.js flips fever on when the reels land; that is the payout */
    if (window.JJHAKARI && window.JJHAKARI.fever > 0 && !a.paid) {
      a.paid = 1;
      payout(P.center || player.pos);
      FX.flash('#fff0b0', .9, .5);
      addShake(2);
      if (AN) AN.camKick(1.6);
      P.lamps.forEach(function (l) { l.intensity *= 2.2; });
    }
    if (a.t >= DUR - .5) close();
  }

  function camera(a, dt) {
    var p = player, t = a.t, face = p.facing;
    var marks = [
      { t: 0, yaw: .5, d: 7, h: 4, ly: 3.2, k: 18 },
      { t: .85, yaw: .15, d: 4.2, h: 3.6, ly: 3.4, k: 26 },
      { t: 1.5, yaw: -.05, d: 13, h: 7, ly: 4, k: 11 },        // the room arrives
      { t: 3.2, yaw: -.9, d: 20, h: 9, ly: 4.5, k: 8 },        // down the aisle
      { t: 5.2, yaw: .35, d: 9, h: 5, ly: 3.6, k: 10 },        // back on him for the reels
      { t: 7.0, yaw: .1, d: 6, h: 4.2, ly: 3.4, k: 13 },
      { t: DUR, yaw: -.2, d: 11, h: 5.4, ly: 3.4, k: 12 }
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

  /* The domain lives on `hdom` now — `h4` is Fever Breaker. Keying this
     off the old name meant a dropkick built the parlour, took the camera
     into the domain framing and never gave either of them back. */
  var _stepAction = stepAction;
  stepAction = function (a, dt) {
    if (a.type === 'hdom') { stageStep(a, dt); return _stepAction(a, dt); }
    return _stepAction(a, dt);
  };

  var _updateCamera = updateCamera;
  updateCamera = function (dt) {
    var a = player.action;
    if (a && a.type === 'hdom' && AN) { camera(a, dt); return; }
    return _updateCamera(dt);
  };

  /* =====================================================================
     SOMEBODY ELSE'S PARLOUR
     From outside, the barrier standing in the street with the machine
     lighting it from inside. From inside, the parlour — the same room he
     is standing in, because that is where you are now too.
     ================================================================== */
  var R = 32;
  P.remoteT = 0;
  P.remote = function (center, yaw, dur) {
    if (P.on) return;
    dur = dur || DUR;
    center = center.clone();
    FX.barrier(new THREE.Vector3(center.x, 1, center.z), R, 0x6a4a10, dur, {
      opacity: .26, rim: GOLD, blend: false
    });
    FX.rings(new THREE.Vector3(center.x, .15, center.z), GOLD, 4,
      { maxR: R + 4, life: .9, gap: 55 });
    FX.cracks(new THREE.Vector3(center.x, 0, center.z), 11, 18, 0x2a2008);
    FX.debris(new THREE.Vector3(center.x, 0, center.z), 12, 14, 0x6b5a30);
    var d = player.pos.distanceTo(center);
    if (d < R + 40) addShake(Math.max(.3, 1.3 - d / 60));
    /* the coins go up whether you are in it or not — that is the noise a
       jackpot makes */
    setTimeout(function () { if (typeof scene !== 'undefined') payout(center, true); }, 900);
    if (d > R) return;
    P.remoteT = dur;
    P.remoteYaw = yaw;
    open(center, yaw);
    if (P.room) P.room.scale.set(1, 1, 1);
    FX.flash('#fff3d0', .8, .45);
  };

  addFx({ t: 1e9, update: function (dt) {
    if (P.remoteT > 0) {
      P.remoteT -= dt;
      if (P.remoteT <= 0) { P.remoteT = 0; close(); }
      return true;
    }
    var a = player.action;
    if (P.on && !(a && a.type === 'hdom')) close();
    return true;
  } });
})();
