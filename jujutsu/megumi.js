/* =======================================================================
   MEGUMI FUSHIGURO
   The Ten Shadows Technique. He does not throw cursed energy at anybody —
   he opens a shadow and something comes out of it, and the shadow is the
   move as much as the thing is. So this file builds the shadow first and
   the shikigami second, and every one of the five comes up out of a pool
   that opens on the ground under him or under them.

     1  DIVINE DOGS      玉犬 — the pair, white and black, run down
                         whatever is in front of him
     2  NUE              鵺 — out of the sky, and the lightning with it
     3  GREAT SERPENT    大蛇 — the head comes up out of the ground under
                         them and takes them off it
     4  MAX ELEPHANT     満象 — the big one, and the water it brings
     R  RABBIT ESCAPE    脱兎 — the swarm, and he goes out with it

   None of these is a beam. Everything here is a body: it is summoned, it
   travels, it does something with its own weight, and it goes back into
   the shadow it came from. That is the whole character.

   The awakening and the domain are not in here yet.
   ===================================================================== */
(function () {
  'use strict';
  if (typeof player === 'undefined' || typeof THREE === 'undefined') return;
  var FX = window.JJFX;
  if (!FX || typeof CHARS === 'undefined') return;
  var AN = window.JJANIM;
  var E = FX.ease;
  var TAU = Math.PI * 2;

  /* THE PALETTE
     A shadow darkens what is behind it; it does not add to it. So every
     colour here is near-black and everything drawn with them is on
     NORMAL blending — an additive shadow is a light, which is the one
     thing it must not be. The only bright value is the pale edge that
     keeps a black shape readable against a light floor, and the white of
     the one dog that is white. */
  var INK = 0x07070d, DEEP = 0x11111f, EDGE = 0x232338;
  var LIT = 0x7b7bb8, COLD = 0xa9b6e8, WHITE = 0xe8ecf5;

  var MG = window.JJMEGUMI = { pools: [], pets: [] };

  var MCD = { mg1: 8, mg2: 10, mg3: 11, mg4: 20, mgr: 9 };

  var MEGUMI_CFG = {
    megumi: true, face: true,
    torso: 0x14161f, pants: 0x0f1118, shoes: 0x1c1f28, skin: 0xe6cbb4
  };

  /* ---------------------------------------------------------------- rig
     Black hair that goes up and out in every direction — the one thing
     everybody draws about him — over the school uniform's high collar.
     Built as fourteen separate spikes at different lengths and angles,
     because a block of hair reads as a helmet.
     ================================================================== */
  var _makeAnimeRig = makeAnimeRig;
  makeAnimeRig = function (cfg) {
    var r = _makeAnimeRig(cfg);
    if (!cfg || !cfg.megumi) return r;
    var head = r.head, spine = r.spine;
    var hair = 0x14141c, hairD = 0x08080e;

    function box(w, h, d, c, basic) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), basic
        ? new THREE.MeshBasicMaterial({ color: c, toneMapped: false })
        : new THREE.MeshStandardMaterial({ color: c, roughness: .78 }));
      m.castShadow = !basic;
      return m;
    }
    var i, s;

    /* the mass it all grows out of */
    var cap = box(1.04, .34, 1.04, hair); cap.position.set(0, .96, -.02); head.add(cap);
    var back = box(1.0, .5, .34, hairD); back.position.set(0, .74, -.5); head.add(back);

    /* fourteen spikes, going up and out, no two the same */
    var SPIKE = [
      /* x,    y,    z,    w,   h,    rz,   rx */
      [-.42, 1.12, .30, .17, .62, .46, -.22],
      [-.26, 1.20, .38, .14, .74, .26, -.30],
      [-.08, 1.24, .40, .16, .82, .06, -.34],
      [.12, 1.22, .38, .15, .76, -.14, -.30],
      [.30, 1.16, .32, .17, .66, -.36, -.24],
      [.44, 1.06, .20, .14, .54, -.58, -.14],
      [-.50, 1.02, .06, .15, .52, .62, -.06],
      [-.34, 1.18, -.16, .16, .70, .30, .22],
      [-.10, 1.22, -.30, .15, .78, .08, .34],
      [.14, 1.20, -.30, .16, .72, -.12, .34],
      [.36, 1.12, -.18, .15, .60, -.34, .24],
      [.50, 1.00, .02, .14, .48, -.62, .04],
      [-.02, 1.26, .06, .13, .90, .02, .02],
      [.20, 1.24, -.04, .12, .84, -.18, .06]
    ];
    for (i = 0; i < SPIKE.length; i++) {
      s = SPIKE[i];
      var sp = box(s[3], s[4], s[3] * 1.15, i % 3 ? hair : hairD);
      sp.position.set(s[0], s[1], s[2]);
      sp.rotation.z = s[5];
      sp.rotation.x = s[6];
      head.add(sp);
    }
    /* the fringe, short and split over the eyes */
    for (i = 0; i < 5; i++) {
      var fx = -.36 + i * .18;
      var fr = box(.16, .3 + (i % 2) * .12, .1, i % 2 ? hair : hairD);
      fr.position.set(fx, .82 - (i % 2) * .05, .5);
      fr.rotation.z = fx * .5;
      head.add(fr);
    }
    /* the green eyes, which are the only colour on him */
    var eL = box(.14, .11, .05, 0x2f6b52, true); eL.position.set(-.2, .58, .47); head.add(eL);
    var eR = box(.14, .11, .05, 0x2f6b52, true); eR.position.set(.2, .58, .47); head.add(eR);
    var bL = box(.18, .05, .05, hairD); bL.position.set(-.2, .70, .47); bL.rotation.z = .1; head.add(bL);
    var bR = box(.18, .05, .05, hairD); bR.position.set(.2, .70, .47); bR.rotation.z = -.1; head.add(bR);

    /* the uniform: high dark collar with the light band under it */
    var band = box(.66, .12, .6, 0xd8dce6); band.position.set(0, 1.06, .02); spine.add(band);
    var coll = box(.7, .36, .64, 0x1a1c26); coll.position.set(0, 1.2, .0); spine.add(coll);
    for (s = -1; s <= 1; s += 2) {
      var lap = box(.2, .74, .1, 0x1a1c26);
      lap.position.set(.2 * s, .74, .32);
      lap.rotation.z = -.24 * s;
      spine.add(lap);
    }
    return r;
  };

  CHARS.megumi = {
    name: 'MEGUMI FUSHIGURO', sub: 'TEN SHADOWS TECHNIQUE',
    cfg: MEGUMI_CFG, glow: '#7b7bb8',
    moves: [
      { key: 'LMB', lbl: 'Punch', cd: 'm1', max: .3 },
      { key: 'Q', lbl: 'Dash', cd: 'dash', max: 1 },
      { key: '1', lbl: 'Divine Dogs', cd: 'mg1', max: MCD.mg1 },
      { key: '2', lbl: 'Nue', cd: 'mg2', max: MCD.mg2 },
      { key: '3', lbl: 'Great Serpent', cd: 'mg3', max: MCD.mg3 },
      { key: '4', lbl: 'Max Elephant', cd: 'mg4', max: MCD.mg4 },
      { key: 'R', lbl: 'Rabbit Escape', cd: 'mgr', max: MCD.mgr }
    ]
  };
  try { CHARS.megumi.portrait = makePortrait(MEGUMI_CFG); } catch (e) {}
  try { buildCharList(); } catch (e) {}

  cds.mg1 = 0; cds.mg2 = 0; cds.mg3 = 0; cds.mg4 = 0; cds.mgr = 0;

  /* --------------------------------------------------------------- help */
  function ready(key) {
    return player.char === 'megumi' && !player.dead && !busy() && cds[key] <= 0 &&
      !player.react && !(window.JJNAOYA && window.JJNAOYA.busy());
  }
  function start(type, dur, key, name, sub) {
    cds[key] = MCD[key];
    player.action = { type: type, t: 0, dur: dur, stage: 0 };
    if (name) { try { showSplash(name, sub || '', '#8f8fd0'); } catch (e) {} }
    return player.action;
  }
  function aim() {
    return new THREE.Vector3(Math.sin(player.facing), 0, Math.cos(player.facing));
  }
  function rp(r) { resetPose(r); if (r.body) r.body.rotation.set(0, 0, 0); }
  function later(ms, fn) {
    setTimeout(function () { if (typeof scene !== 'undefined') fn(); }, ms);
  }

  /* =====================================================================
     THE SHADOW
     A pool of it on the ground, which is where everything he has comes
     from. Drawn on NORMAL blending in near-black so it takes light OUT
     of the floor; an additive one would be a puddle of light, which is
     the opposite of a shadow and the mistake the blood kit already had
     to be rescued from once.
     ================================================================== */
  var POOL_TEX = null;
  function poolTexture() {
    if (POOL_TEX) return POOL_TEX;
    POOL_TEX = canvasTex(256, 256, function (g) {
      /* a filled black disc with a torn edge, and nothing in the middle
         but black — the fade is only in the last fifth of the radius */
      var grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(.72, 'rgba(255,255,255,1)');
      grad.addColorStop(.9, 'rgba(255,255,255,.55)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.beginPath(); g.arc(128, 128, 128, 0, TAU); g.fill();
      /* the tears round the rim, so it is not a stencil circle */
      g.globalCompositeOperation = 'destination-out';
      for (var i = 0; i < 26; i++) {
        var a = Math.random() * TAU, d = 106 + Math.random() * 26;
        g.beginPath();
        g.arc(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, 8 + Math.random() * 16, 0, TAU);
        g.fill();
      }
      g.globalCompositeOperation = 'source-over';
    });
    return POOL_TEX;
  }

  /* opens, holds, and shuts. Everything that comes out comes out of one. */
  function shadowPool(at, radius, hold) {
    var m = FX.billboard(poolTexture(), INK, 0, false);
    m.rotation.x = -Math.PI / 2;
    m.position.set(at.x, .05, at.z);
    m.renderOrder = 3;
    scene.add(m);
    var t = 0, live = true, open = .22, shut = .32;
    var H = { m: m, r: radius, close: function () { live = false; } };
    addFx({ t: 1e9, update: function (dt) {
      t += dt;
      var k;
      if (t < open) k = E.out(t / open);
      else if (live && t < open + (hold || 1e9)) k = 1;
      else {
        var q = (t - open - (hold || 0)) / shut;
        if (q >= 1) {
          scene.remove(m); m.material.dispose();
          var i = MG.pools.indexOf(H); if (i >= 0) MG.pools.splice(i, 1);
          return false;
        }
        k = 1 - E.out(q);
      }
      var w = radius * 2 * k;
      m.scale.set(w, w * .82, 1);
      m.material.opacity = .92 * k;
      return true;
    } });
    MG.pools.push(H);
    /* the ink that comes up off the edge of one when it opens */
    for (var i = 0; i < 8; i++) {
      var a = Math.random() * TAU, d = radius * (.5 + Math.random() * .5);
      FX.streaks(new THREE.Vector3(at.x + Math.cos(a) * d, .3, at.z + Math.sin(a) * d),
        i % 3 ? INK : LIT, 1, 5, .5);
    }
    return H;
  }
  MG.pool = shadowPool;

  /* a shape made of shadow: black, with a pale shell round it so the
     silhouette survives against a white floor */
  function inkMat(color) {
    return new THREE.MeshStandardMaterial({
      color: color == null ? DEEP : color, roughness: .92, metalness: .04,
      flatShading: true
    });
  }
  /* The pale shell that keeps a black shape readable. It is scaled to a
     CONSTANT thickness rather than a constant ratio — a fixed 1.07 is a
     hairline on a rabbit's ear and a halo the size of a door on the
     elephant's flank, which made the big one read as a lit slab. */
  var RIM = .13;
  function rimmed(mesh, w, h, d, color) {
    var big = Math.max(w, h, d);
    var shell = new THREE.Mesh(mesh.geometry, new THREE.MeshBasicMaterial({
      color: color == null ? LIT : color, side: THREE.BackSide,
      transparent: true, opacity: .45, depthWrite: false, toneMapped: false
    }));
    shell.scale.set(1 + RIM * 2 / w, 1 + RIM * 2 / h, 1 + RIM * 2 / d);
    /* and it fades out on the very large parts, which do not need it */
    shell.material.opacity = .45 * Math.max(.3, Math.min(1, 3 / big));
    mesh.add(shell);
    return mesh;
  }
  function part(g, w, h, d, x, y, z, c) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), inkMat(c));
    m.position.set(x, y, z);
    /* Only the big pieces cast. Six shadow casters on a rabbit is a
       hundred and fifty of them once the swarm is out, and on a white
       floor at this sun angle each one stretches into a hard black slab
       — the escape came out looking like a scattering of paving stones. */
    m.castShadow = Math.max(w, h, d) > 1.2;
    rimmed(m, w, h, d);
    g.add(m);
    return m;
  }

  /* the smoke a shikigami is made of, coming off it while it is out */
  function wisp(at, n) {
    for (var i = 0; i < (n || 1); i++) {
      var m = FX.billboard(FX.T.smoke, i % 2 ? INK : EDGE, .5, false);
      m.scale.setScalar(1.4 + Math.random() * 1.6);
      m.position.copy(at).add(new THREE.Vector3(
        (Math.random() - .5) * 1.6, Math.random() * 1.2, (Math.random() - .5) * 1.6));
      scene.add(m);
      (function (m) {
        var t = 0, life = .4 + Math.random() * .3;
        addFx({ t: life, update: function (dt) {
          this.t -= dt; t += dt;
          m.position.y += dt * 1.6;
          m.material.opacity = .5 * (this.t / life);
          m.scale.setScalar(m.scale.x + dt * 1.4);
          FX.faceCam(m, 0);
          if (this.t <= 0) { scene.remove(m); m.material.dispose(); return false; }
          return true;
        } });
      })(m);
    }
  }
  MG.wisp = wisp;

  /* everything he summons goes back the way it came */
  function dismiss(obj, at) {
    if (!obj) return;
    wisp(at || obj.position.clone(), 6);
    var t = 0;
    addFx({ t: .3, update: function (dt) {
      this.t -= dt; t += dt;
      obj.scale.multiplyScalar(Math.max(0, 1 - dt * 5));
      obj.position.y -= dt * 3;
      if (this.t <= 0) {
        scene.remove(obj);
        obj.traverse(function (o) { if (o.isMesh) o.material.dispose(); });
        var i = MG.pets.indexOf(obj); if (i >= 0) MG.pets.splice(i, 1);
        return false;
      }
      return true;
    } });
  }
  MG.dismiss = dismiss;

  /* =====================================================================
     1 · DIVINE DOGS  玉犬
     The pair. One black, one white, and they go together — the whole
     point of the two of them is that they run whatever is in front of
     him down from both sides at once.
     ================================================================== */
  var DOG = { reach: 40, speed: 26, dmg: 15, radius: 3 };

  function buildDog(white) {
    var g = new THREE.Group();
    var body = white ? 0x2a2c38 : DEEP;
    var coat = white ? WHITE : INK;
    /* chest and haunch */
    part(g, 1.5, 1.25, 2.9, 0, 1.5, 0, body);
    part(g, 1.35, 1.15, 1.1, 0, 1.55, -1.5, coat);
    /* neck and head, low and forward the way a running dog carries it */
    var neck = part(g, 1.0, .95, 1.1, 0, 1.75, 1.5, body);
    var head = part(g, .95, .85, 1.4, 0, 1.85, 2.5, coat);
    /* the muzzle, and what is in it */
    part(g, .62, .5, .9, 0, 1.62, 3.3, coat);
    for (var i = 0; i < 5; i++) {
      var tx = -.2 + i * .1;
      part(g, .07, .22, .07, tx, 1.44, 3.6, COLD);
    }
    /* ears, back along the skull */
    for (var s = -1; s <= 1; s += 2) {
      var ear = part(g, .22, .5, .18, s * .3, 2.35, 2.3, coat);
      ear.rotation.z = s * .2;
      ear.rotation.x = -.3;
    }
    /* the eye, which is the only thing on it that is not shadow */
    for (s = -1; s <= 1; s += 2) {
      var eye = new THREE.Mesh(new THREE.BoxGeometry(.16, .13, .06),
        new THREE.MeshBasicMaterial({ color: white ? 0x9fd0ff : 0xff9a6a, toneMapped: false }));
      eye.position.set(s * .27, 1.98, 3.1);
      g.add(eye);
    }
    /* four legs, remembered so they can run */
    g.__legs = [];
    var LEG = [[-.55, 1.9], [.55, 1.9], [-.55, -1.1], [.55, -1.1]];
    for (i = 0; i < 4; i++) {
      var hip = new THREE.Group();
      hip.position.set(LEG[i][0], 1.35, LEG[i][1]);
      var up = part(hip, .3, 1.0, .34, 0, -.5, 0, body);
      var paw = part(hip, .36, .3, .5, 0, -1.05, .1, coat);
      g.add(hip);
      g.__legs.push(hip);
    }
    /* the tail */
    var tail = part(g, .24, .24, 1.3, 0, 1.85, -2.2, coat);
    tail.rotation.x = -.4;
    g.__tail = tail;
    g.__white = !!white;
    return g;
  }

  /* one dog, running a line and taking whatever is on it */
  function runDog(from, dir, side, white, ghost) {
    var d = buildDog(white);
    var across = new THREE.Vector3(-dir.z, 0, dir.x);
    d.position.copy(from).addScaledVector(across, side * 2.4);
    d.rotation.y = Math.atan2(dir.x, dir.z);
    d.scale.setScalar(.05);
    scene.add(d);
    MG.pets.push(d);
    var travelled = 0, t = 0, hit = [], bound = 0;
    addFx({ t: 4, update: function (dt) {
      this.t -= dt; t += dt;
      /* it comes up out of the pool over the first fifth of a second */
      if (t < .2) { d.scale.setScalar(.05 + E.out(t / .2) * .95); }
      else d.scale.setScalar(1);
      var step = DOG.speed * dt;
      travelled += step;
      d.position.addScaledVector(dir, step);
      /* the two of them close on the line as they go, so they meet on
         whatever is in front of him */
      d.position.addScaledVector(across, -side * dt * 2.6);
      /* the run: four legs on two beats, and the body rising on each */
      bound += dt * 15;
      d.__legs.forEach(function (l, i) {
        l.rotation.x = Math.sin(bound + (i < 2 ? 0 : Math.PI)) * .9;
      });
      d.position.y = Math.abs(Math.sin(bound)) * .5;
      d.__tail.rotation.y = Math.sin(bound * .5) * .4;
      if (Math.random() < dt * 14) wisp(d.position.clone().add(new THREE.Vector3(0, 1, 0)), 1);
      if (!ghost) {
        for (var i = 0; i < enemies.length; i++) {
          var e = enemies[i];
          if (!e || e.dead || hit.indexOf(e) >= 0) continue;
          if (e.pos.clone().add(new THREE.Vector3(0, 1.6, 0))
            .distanceTo(d.position) > DOG.radius) continue;
          hit.push(e);
          var kb = dir.clone().multiplyScalar(20); kb.y = 9;
          e.damage(DOG.dmg, kb, {
            react: 'slash', reactDur: .4, spark: white ? COLD : LIT,
            bleed: true, death: 'sever'
          });
          FX.impact(e.pos.clone().add(new THREE.Vector3(0, 2.4, 0)), white ? COLD : LIT, 1.6);
          FX.slash(e.pos.clone().add(new THREE.Vector3(0, 2.4, 0)), dir, WHITE, 4, .16);
          addShake(.6);
          hitstop(.04);
          try { sfx.slash(); } catch (err) {}
        }
      }
      if (travelled < DOG.reach && this.t > 0) return true;
      dismiss(d, d.position.clone());
      return false;
    } });
    return d;
  }

  function castDogs() {
    if (!ready('mg1')) return;
    var a = start('mg1', 1.05, 'mg1', 'DIVINE DOGS', '玉犬');
    a.dir = aim();
    player.iframes = Math.max(player.iframes, .3);
    try { sfx.whoosh(); } catch (e) {}
  }
  function stepDogs(a, dt) {
    var p = player, d = a.dir;
    if (a.t < .34) {
      if (!a.pool) {
        a.pool = shadowPool(p.pos.clone().addScaledVector(d, 4), 5.5, .5);
        addShake(.4);
      }
      return;
    }
    if (a.stage < 1) {
      a.stage = 1;
      var at = p.pos.clone().addScaledVector(d, 4);
      runDog(at.clone(), d.clone(), -1, false);
      runDog(at.clone(), d.clone(), 1, true);
      FX.streaks(at.clone().add(new THREE.Vector3(0, 1, 0)), LIT, 6, 12, .9);
      addShake(.9);
      try { sfx.whoosh(); } catch (e) {}
    }
  }

  /* =====================================================================
     2 · NUE  鵺
     Out of the sky rather than out of the road. It comes down on them,
     and what it carries is lightning.
     ================================================================== */
  var NUE = { reach: 26, dmg: 26, drop: 34 };

  function buildNue() {
    var g = new THREE.Group();
    part(g, 1.5, 1.2, 3.2, 0, 0, 0, DEEP);              // body
    part(g, .9, .8, 1.1, 0, .3, 1.9, INK);              // head
    part(g, .34, .3, 1.2, 0, .2, 2.8, EDGE);            // the beak
    /* the eye */
    for (var s = -1; s <= 1; s += 2) {
      var eye = new THREE.Mesh(new THREE.BoxGeometry(.18, .15, .07),
        new THREE.MeshBasicMaterial({ color: 0xffd66a, toneMapped: false }));
      eye.position.set(s * .3, .42, 2.3);
      g.add(eye);
    }
    /* the wings, in three panels each so they can fold */
    g.__wings = [];
    for (s = -1; s <= 1; s += 2) {
      var w = new THREE.Group();
      w.position.set(s * .7, .2, .2);
      part(w, 2.6, .22, 2.2, s * 1.4, 0, 0, DEEP);
      part(w, 2.4, .18, 1.6, s * 3.4, -.1, -.4, INK);
      part(w, 1.8, .16, 1.0, s * 5.0, -.2, -.9, EDGE);
      g.add(w);
      g.__wings.push(w);
    }
    /* the tail it drags */
    var tail = part(g, .4, .3, 2.4, 0, -.1, -2.4, INK);
    tail.rotation.x = .2;
    /* and the talons */
    for (s = -1; s <= 1; s += 2) {
      for (var i = 0; i < 3; i++) {
        var c = part(g, .12, .5, .12, s * .45 + (i - 1) * .16, -.8, .4 + i * .1, EDGE);
        c.rotation.x = .4;
      }
    }
    return g;
  }

  /* the arc it comes down on, and the shock it lands with */
  function flyNue(from, dir, ghost) {
    var n = buildNue();
    var start3 = from.clone().addScaledVector(dir, -6);
    start3.y = 22;
    n.position.copy(start3);
    n.rotation.y = Math.atan2(dir.x, dir.z);
    scene.add(n);
    MG.pets.push(n);
    var t = 0, flap = 0, struck = false;
    var target = from.clone().addScaledVector(dir, NUE.reach * .5);
    addFx({ t: 4.5, update: function (dt) {
      this.t -= dt; t += dt;
      flap += dt * 9;
      n.__wings.forEach(function (w, i) {
        w.rotation.z = Math.sin(flap) * .5 * (i ? -1 : 1);
      });
      if (t < .9) {
        /* the dive */
        var k = E.in ? E.in(t / .9) : (t / .9) * (t / .9);
        n.position.lerpVectors(start3, target.clone().add(new THREE.Vector3(0, 3.2, 0)), k);
        n.rotation.x = -.5 + k * .5;
        if (Math.random() < dt * 20) wisp(n.position.clone(), 1);
        return true;
      }
      if (!struck) {
        struck = true;
        var at = new THREE.Vector3(n.position.x, 0, n.position.z);
        /* the lightning, down the line it dived on */
        FX.beam(n.position.clone(), new THREE.Vector3(0, -1, 0), 8, COLD,
          { radius: .5, life: .28 });
        for (var b = 0; b < 7; b++) {
          var bolt = FX.billboard(FX.T.bolt, b % 2 ? COLD : 0xffffff, .9);
          var a1 = at.clone().add(new THREE.Vector3(
            (Math.random() - .5) * 7, 5 + Math.random() * 4, (Math.random() - .5) * 7));
          var a2 = at.clone().add(new THREE.Vector3(
            (Math.random() - .5) * 9, .4, (Math.random() - .5) * 9));
          var len = FX.orientAlong(bolt, a1, a2);
          bolt.scale.set(len, len * .3, 1);
          scene.add(bolt);
          (function (bolt) {
            var bt = .16;
            addFx({ t: bt, update: function (dd) {
              this.t -= dd;
              bolt.material.opacity = Math.max(0, this.t / bt);
              if (this.t <= 0) { scene.remove(bolt); bolt.material.dispose(); return false; }
              return true;
            } });
          })(bolt);
        }
        FX.flash('#dbe6ff', .34, .18);
        FX.rings(new THREE.Vector3(at.x, .12, at.z), COLD, 3, { maxR: 15, life: .5, gap: 44 });
        FX.impact(n.position.clone(), COLD, 3);
        addShake(1.8);
        hitstop(.09);
        try { sfx.blast ? sfx.blast() : sfx.redBoom(); } catch (e) {}
        if (!ghost) {
          enemies.forEach(function (e) {
            if (!e || e.dead || e.pos.distanceTo(at) > 8) return;
            var kb = e.pos.clone().sub(at).setY(0);
            if (kb.lengthSq() < .01) kb.set(1, 0, 0);
            kb.normalize().multiplyScalar(12); kb.y = 26;
            e.damage(NUE.dmg, kb, {
              react: 'blow', reactDur: .9, spark: COLD, stun: .9, death: 'burn'
            });
          });
        }
      }
      /* and it climbs back out of the frame */
      n.position.addScaledVector(dir, 16 * dt);
      n.position.y += 13 * dt;
      n.rotation.x = -.6;
      if (this.t > 2.6) return true;
      dismiss(n, n.position.clone());
      return false;
    } });
    return n;
  }

  function castNue() {
    if (!ready('mg2')) return;
    var a = start('mg2', 1.15, 'mg2', 'NUE', '鵺');
    a.dir = aim();
    player.iframes = Math.max(player.iframes, .4);
    try { sfx.whoosh(); } catch (e) {}
  }
  function stepNue(a, dt) {
    var p = player, d = a.dir;
    if (a.t < .38) {
      if (!a.pool) {
        a.pool = shadowPool(p.pos.clone().add(new THREE.Vector3(0, 0, 0)), 4.4, .4);
        addShake(.35);
      }
      return;
    }
    if (a.stage < 1) {
      a.stage = 1;
      flyNue(p.pos.clone(), d.clone());
      FX.streaks(p.pos.clone().add(new THREE.Vector3(0, 3, 0)), COLD, 6, 14, 1);
      addShake(.7);
    }
  }

  /* =====================================================================
     3 · GREAT SERPENT  大蛇
     It does not travel to them. The pool opens UNDER them and the head
     comes up out of it, which is the whole reason a shadow technique is
     frightening: there is nowhere the shadow is not.
     ================================================================== */
  var SNAKE = { range: 22, dmg: 30, hold: .8 };

  function buildSnake() {
    var g = new THREE.Group();
    /* the head */
    part(g, 1.9, 1.5, 3.0, 0, 0, 1.2, DEEP);
    part(g, 1.5, 1.0, 1.2, 0, -.2, 3.0, INK);           // the snout
    /* the jaw, hinged, so it can open */
    var jaw = new THREE.Group();
    jaw.position.set(0, -.6, .6);
    part(jaw, 1.7, .5, 2.8, 0, 0, 1.2, INK);
    for (var i = 0; i < 6; i++) {
      var tx = -.6 + (i % 3) * .6;
      part(jaw, .14, .5, .14, tx, .42, .6 + Math.floor(i / 3) * 1.5, COLD);
    }
    g.add(jaw);
    g.__jaw = jaw;
    /* the upper teeth */
    for (i = 0; i < 6; i++) {
      var ux = -.6 + (i % 3) * .6;
      part(g, .14, .55, .14, ux, -.6, 1.4 + Math.floor(i / 3) * 1.5, COLD);
    }
    /* the eyes */
    for (var s = -1; s <= 1; s += 2) {
      var eye = new THREE.Mesh(new THREE.BoxGeometry(.22, .18, .08),
        new THREE.MeshBasicMaterial({ color: 0xffc44d, toneMapped: false }));
      eye.position.set(s * .6, .3, 2.2);
      g.add(eye);
    }
    /* the body behind it, in segments that can be laid along a curve */
    g.__segs = [];
    for (i = 0; i < 9; i++) {
      var w = 1.9 - i * .13;
      var seg = part(g, w, w, 1.5, 0, 0, -.6 - i * 1.45, i % 2 ? DEEP : INK);
      g.__segs.push(seg);
    }
    return g;
  }

  /* up out of the ground under them, and back down with them */
  function strikeSnake(at, dir, ghost, victim) {
    var s = buildSnake();
    s.position.set(at.x, -9, at.z);
    s.rotation.y = Math.atan2(-dir.x, -dir.z);
    s.rotation.x = -1.15;                       // rearing up out of the floor
    scene.add(s);
    MG.pets.push(s);
    var t = 0, bit = false, held = null;
    addFx({ t: 3.4, update: function (dt) {
      this.t -= dt; t += dt;
      if (t < .34) {
        /* the rise */
        var k = E.out(t / .34);
        s.position.y = -9 + k * 11;
        s.rotation.x = -1.15 + k * .55;
        s.__jaw.rotation.x = k * .95;
        s.__segs.forEach(function (g2, i) {
          g2.position.y = Math.sin(t * 8 - i * .5) * .3;
          g2.position.x = Math.sin(t * 5 - i * .7) * .5;
        });
        if (Math.random() < dt * 26) wisp(s.position.clone(), 1);
        return true;
      }
      if (!bit) {
        bit = true;
        s.__jaw.rotation.x = .1;                 // it shuts
        FX.impact(s.position.clone().add(new THREE.Vector3(0, 1, 0)), LIT, 2.6);
        FX.streaks(s.position.clone(), COLD, 8, 16, 1);
        addShake(1.6);
        hitstop(.1);
        try { sfx.stab ? sfx.stab() : sfx.slash(); } catch (e) {}
        if (!ghost) {
          var got = enemiesNear(new THREE.Vector3(at.x, 2.4, at.z), 5.2);
          got.forEach(function (e) {
            if (!e || e.dead) return;
            if (!held) held = e;
            e.damage(SNAKE.dmg, dir.clone().multiplyScalar(8).setY(16), {
              react: 'blow', reactDur: .9, spark: LIT, stun: 1,
              bleed: true, death: 'sever'
            });
          });
        }
      }
      /* whatever it has is carried up on the jaw for a beat */
      if (held && !held.dead) {
        held.anchorT = .3;
        held.anchorPos.set(at.x, 6.4, at.z);
        held.pos.lerp(held.anchorPos, Math.min(1, dt * 9));
        held.vel.set(0, 0, 0);
      }
      s.__jaw.rotation.x = .1 + Math.sin(t * 3) * .06;
      s.__segs.forEach(function (g2, i) {
        g2.position.x = Math.sin(t * 4 - i * .8) * .45;
      });
      if (this.t > 2.1) return true;
      if (held) held.anchorT = 0;
      dismiss(s, s.position.clone());
      return false;
    } });
    return s;
  }

  function castSerpent() {
    if (!ready('mg3')) return;
    var a = start('mg3', 1.2, 'mg3', 'GREAT SERPENT', '大蛇');
    var d = aim();
    /* it opens under whoever is in front of him, or where he is looking */
    var near = null, nd = SNAKE.range;
    for (var i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      if (!e || e.dead) continue;
      var to = e.pos.clone().sub(player.pos); to.y = 0;
      if (to.dot(d) < 0) continue;
      var dd = to.length();
      if (dd < nd) { nd = dd; near = e; }
    }
    a.at = near ? near.pos.clone() : player.pos.clone().addScaledVector(d, 11);
    a.dir = d;
    player.iframes = Math.max(player.iframes, .4);
    try { sfx.whoosh(); } catch (e) {}
  }
  function stepSerpent(a, dt) {
    if (a.t < .42) {
      if (!a.pool) {
        a.pool = shadowPool(a.at.clone(), 6.5, .55);
        FX.cracks(new THREE.Vector3(a.at.x, .05, a.at.z), 8, 10, 0x1a1a24);
        addShake(.5);
      }
      return;
    }
    if (a.stage < 1) {
      a.stage = 1;
      strikeSnake(a.at.clone(), a.dir.clone());
    }
  }

  /* =====================================================================
     4 · MAX ELEPHANT  満象
     The heavy one. It is not thrown at anybody — it arrives, and what
     does the damage is the water it brings with it.
     ================================================================== */
  var ELEPH = { dmg: 34, wave: 30, push: 34 };

  function buildElephant() {
    var g = new THREE.Group();
    part(g, 6.4, 5.2, 9.2, 0, 5.4, 0, DEEP);            // the body
    part(g, 4.2, 3.8, 3.4, 0, 6.2, 5.6, INK);           // the head
    /* the trunk, in seven falling segments */
    g.__trunk = [];
    var ty = 5.2, tz = 7.0;
    for (var i = 0; i < 7; i++) {
      var w = 1.5 - i * .13;
      var seg = part(g, w, w, 1.2, 0, ty, tz, i % 2 ? INK : EDGE);
      g.__trunk.push(seg);
      ty -= .75; tz += .35;
    }
    /* the tusks */
    for (var s = -1; s <= 1; s += 2) {
      var tu = part(g, .34, .34, 3.2, s * 1.3, 5.0, 6.6, WHITE);
      tu.rotation.x = -.35;
      tu.rotation.y = s * .12;
    }
    /* the ears */
    for (s = -1; s <= 1; s += 2) {
      var ear = part(g, 3.4, 4.0, .3, s * 3.0, 6.4, 4.4, INK);
      ear.rotation.y = s * .4;
    }
    /* the eye */
    for (s = -1; s <= 1; s += 2) {
      var eye = new THREE.Mesh(new THREE.BoxGeometry(.3, .26, .1),
        new THREE.MeshBasicMaterial({ color: 0xdcd2b8, toneMapped: false }));
      eye.position.set(s * 1.5, 6.9, 7.2);
      g.add(eye);
    }
    /* four columns */
    g.__legs = [];
    var LEG = [[-2.1, 3.2], [2.1, 3.2], [-2.1, -3.2], [2.1, -3.2]];
    for (i = 0; i < 4; i++) {
      var hip = new THREE.Group();
      hip.position.set(LEG[i][0], 5.0, LEG[i][1]);
      part(hip, 1.9, 4.4, 1.9, 0, -2.2, 0, DEEP);
      part(hip, 2.2, .7, 2.2, 0, -4.6, 0, INK);
      g.add(hip);
      g.__legs.push(hip);
    }
    return g;
  }

  /* the flood it throws, as a front rather than a puddle */
  function flood(from, dir, ghost) {
    var hit = [], travelled = 0;
    var across = new THREE.Vector3(-dir.z, 0, dir.x);
    var head = from.clone();
    addFx({ t: 2.2, update: function (dt) {
      this.t -= dt;
      var step = 32 * dt;
      travelled += step;
      head.addScaledVector(dir, step);
      /* the wall of it, drawn across the front. Nine metres of elephant
         does not throw a hosepipe — the front is as wide as it is. */
      for (var i = 0; i < 7; i++) {
        var o = (i - 3) * 3.2;
        var at = head.clone().addScaledVector(across, o)
          .add(new THREE.Vector3(0, .4 + Math.random() * 3.4, 0));
        var m = FX.billboard(FX.T.smoke, i % 2 ? 0x8fb6d8 : 0xcfe2f2, .55);
        m.scale.setScalar(3.4 + Math.random() * 2.6);
        m.position.copy(at);
        scene.add(m);
        (function (m) {
          var life = .45;
          addFx({ t: life, update: function (dd) {
            this.t -= dd;
            m.position.y -= dd * 2;
            m.material.opacity = .55 * (this.t / life);
            FX.faceCam(m, 0);
            if (this.t <= 0) { scene.remove(m); m.material.dispose(); return false; }
            return true;
          } });
        })(m);
      }
      FX.streaks(head.clone().add(new THREE.Vector3(0, 1.4, 0)), 0xdff0ff, 3, 16, .8);
      if (Math.random() < dt * 20) {
        FX.dust(new THREE.Vector3(head.x, 0, head.z), 4, 0xcfe2f2, 12, 4);
      }
      if (!ghost) {
        for (var j = 0; j < enemies.length; j++) {
          var e = enemies[j];
          if (!e || e.dead || hit.indexOf(e) >= 0) continue;
          var to = e.pos.clone().sub(head); to.y = 0;
          if (Math.abs(to.dot(dir)) > 3.5) continue;
          if (Math.abs(to.dot(across)) > 11) continue;
          hit.push(e);
          var kb = dir.clone().multiplyScalar(ELEPH.push); kb.y = 14;
          e.damage(ELEPH.dmg, kb, {
            react: 'blow', reactDur: 1, spark: 0xcfe2f2, stun: .8,
            ragdoll: true, death: 'flat'
          });
          FX.impact(e.pos.clone().add(new THREE.Vector3(0, 2.4, 0)), 0xdff0ff, 2.2);
          addShake(1);
        }
      }
      return travelled < ELEPH.wave && this.t > 0;
    } });
  }

  function summonElephant(at, dir, ghost, aimAt) {
    var el = buildElephant();
    el.position.set(at.x, -12, at.z);
    el.rotation.y = Math.atan2(dir.x, dir.z);
    scene.add(el);
    MG.pets.push(el);
    var t = 0, blown = false;
    addFx({ t: 5, update: function (dt) {
      this.t -= dt; t += dt;
      if (t < .7) {
        var k = E.out(t / .7);
        el.position.y = -12 + k * 12;
        el.__trunk.forEach(function (s2, i) {
          s2.rotation.x = -.2 - Math.sin(t * 4 - i * .4) * .2;
        });
        if (Math.random() < dt * 40) wisp(el.position.clone().add(new THREE.Vector3(0, 4, 0)), 1);
        return true;
      }
      if (!blown) {
        blown = true;
        el.position.y = 0;
        /* the ground it arrived on */
        var floor = new THREE.Vector3(at.x, 0, at.z);
        FX.rings(floor.clone(), LIT, 4, { maxR: 24, life: .8, gap: 44 });
        FX.cracks(floor.clone(), 16, 22, 0x1a1a24);
        FX.debris(floor.clone(), 20, 20, 0x2a2a38);
        FX.dust(floor.clone(), 14, 0xbfc6d4, 18, 5);
        addShake(3);
        hitstop(.12);
        try { sfx.redBoom(); } catch (e) {}
        /* the trunk comes up, and then it lets go */
        /* out of the raised trunk and across onto the line he is facing */
        var mouth = el.position.clone().addScaledVector(dir, 8).add(new THREE.Vector3(0, 7.4, 0));
        var go = aimAt ? aimAt.clone().sub(mouth).setY(0).normalize() : dir.clone();
        later(320, function () {
          FX.speedRing(mouth.clone(), 0xdff0ff, 13, .3);
          FX.impact(mouth.clone(), 0xcfe2f2, 3);
          addShake(2);
          flood(mouth.clone(), go, ghost);
        });
      }
      /* the trunk raised and pouring */
      el.__trunk.forEach(function (s2, i) {
        var lift = Math.min(1, (t - .7) / .35);
        s2.rotation.x = -.2 - lift * (1.1 - i * .05) + Math.sin(t * 3 - i * .3) * .07;
      });
      if (this.t > 1.6) return true;
      dismiss(el, el.position.clone().add(new THREE.Vector3(0, 4, 0)));
      return false;
    } });
    return el;
  }

  /* Where it stands. Not in front — nine metres of shadow between him and
     everything he was aiming at, and a flood that starts on the far side
     of whoever it was for. Not directly behind either: the chase camera
     lives back there and ends up inside its ribs. So it comes up BESIDE
     him and a little back, in frame the whole time, and the water it
     throws is aimed across onto the line he is facing down. */
  var EL_SIDE = 12, EL_BACK = 3;

  function elephantSpot(p, d) {
    var across = new THREE.Vector3(-d.z, 0, d.x);
    return p.clone().addScaledVector(across, EL_SIDE).addScaledVector(d, -EL_BACK);
  }

  function castElephant() {
    if (!ready('mg4')) return;
    var a = start('mg4', 1.6, 'mg4', 'MAX ELEPHANT', '満象');
    a.dir = aim();
    player.iframes = Math.max(player.iframes, 1.2);
    try { sfx.raise(); } catch (e) {}
  }
  function stepElephant(a, dt) {
    var p = player, d = a.dir;
    var at = elephantSpot(p.pos, d);
    a.aimAt = p.pos.clone().addScaledVector(d, 26);
    if (a.t < .55) {
      if (!a.pool) {
        a.pool = shadowPool(at.clone(), 13, .9);
        FX.cracks(new THREE.Vector3(at.x, .05, at.z), 12, 16, 0x1a1a24);
        addShake(.8);
      }
      return;
    }
    if (a.stage < 1) {
      a.stage = 1;
      summonElephant(at.clone(), d.clone(), false, a.aimAt.clone());
    }
  }

  /* =====================================================================
     R · RABBIT ESCAPE  脱兎
     The one that is not an attack. A great many of them come out at
     once, they go everywhere, and he goes out with them — which is what
     it is for.
     ================================================================== */
  var RAB = { count: 26, dist: 16, dmg: 4 };

  function buildRabbit() {
    var g = new THREE.Group();
    part(g, .6, .55, .9, 0, .4, 0, DEEP);
    part(g, .45, .42, .45, 0, .72, .55, INK);
    for (var s = -1; s <= 1; s += 2) {
      var ear = part(g, .12, .6, .1, s * .13, 1.2, .48, INK);
      ear.rotation.z = s * .16;
      ear.rotation.x = -.14;
    }
    var eye = new THREE.Mesh(new THREE.BoxGeometry(.4, .09, .05),
      new THREE.MeshBasicMaterial({ color: 0xff8a8a, toneMapped: false }));
    eye.position.set(0, .74, .72);
    g.add(eye);
    part(g, .5, .3, .34, 0, .2, -.5, EDGE);
    return g;
  }

  function loose(at, dir, ghost) {
    var made = [];
    for (var i = 0; i < RAB.count; i++) {
      var r = buildRabbit();
      var a = (i / RAB.count) * TAU + Math.random() * .3;
      var away = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      /* most of them go the way he is going; the rest scatter */
      if (i % 3 === 0) away.copy(dir).addScaledVector(away, .5).normalize();
      r.position.copy(at);
      r.rotation.y = Math.atan2(away.x, away.z);
      r.scale.setScalar(.05);
      scene.add(r);
      made.push(r);
      (function (r, away, i) {
        var t = 0, hop = Math.random() * TAU, hit = [];
        var sp = 13 + Math.random() * 9;
        var life = 1.5 + Math.random() * .8;
        addFx({ t: life, update: function (dt) {
          this.t -= dt; t += dt;
          r.scale.setScalar(Math.min(1, .05 + t * 6));
          r.position.addScaledVector(away, sp * dt);
          hop += dt * 17;
          r.position.y = Math.abs(Math.sin(hop)) * 1.2;
          r.rotation.x = -Math.cos(hop) * .3;
          if (Math.random() < dt * 6) wisp(r.position.clone(), 1);
          if (!ghost) {
            for (var j = 0; j < enemies.length; j++) {
              var e = enemies[j];
              if (!e || e.dead || hit.indexOf(e) >= 0) continue;
              if (e.pos.clone().add(new THREE.Vector3(0, 1, 0))
                .distanceTo(r.position) > 1.8) continue;
              hit.push(e);
              e.damage(RAB.dmg, away.clone().multiplyScalar(5).setY(2), {
                react: 'pummel', reactDur: .2, spark: LIT, noFrameBonus: true
              });
              FX.impact(r.position.clone(), LIT, .7);
            }
          }
          if (this.t > 0) return true;
          wisp(r.position.clone(), 2);
          scene.remove(r);
          r.traverse(function (o) { if (o.isMesh) o.material.dispose(); });
          return false;
        } });
      })(r, away, i);
    }
    return made;
  }

  function castRabbits() {
    if (!ready('mgr')) return;
    var a = start('mgr', .9, 'mgr', 'RABBIT ESCAPE', '脱兎');
    a.dir = aim();
    a.from = player.pos.clone();
    player.iframes = Math.max(player.iframes, 1.1);
    try { sfx.whoosh(); } catch (e) {}
  }
  function stepRabbits(a, dt) {
    var p = player, d = a.dir;
    if (a.t < .26) {
      if (!a.pool) {
        a.pool = shadowPool(p.pos.clone(), 7, .5);
        addShake(.4);
      }
      return;
    }
    if (a.stage < 1) {
      a.stage = 1;
      loose(p.pos.clone(), d.clone());
      FX.streaks(p.pos.clone().add(new THREE.Vector3(0, 1.4, 0)), LIT, 10, 14, 1);
      addShake(.8);
      try { sfx.dash(); } catch (e) {}
    }
    /* and he goes with them, backwards, out of whatever he was in */
    if (a.stage === 1) {
      var k = Math.min(1, (a.t - .26) / .42);
      p.pos.addScaledVector(d, -RAB.dist * dt * (1 - k) * 3.4);
      collideWorld(p.pos, 1);
      if (Math.random() < dt * 30) ghostAfterimage(p.rig, EDGE, .26);
    }
  }

  /* =====================================================================
     POSES
     Every one of them is the same idea in a different shape: the hand
     goes out and the shadow does the work. So they all read off the
     hands, and none of them is a swing.
     ================================================================== */
  function poseMegumi(r, a) {
    var t = a.t, out = E.out;
    switch (a.type) {
      case 'mg1': {                                   // dogs: hand down and out
        rp(r);
        var k = out(Math.min(1, t / .34));
        var go = t > .34 ? out(Math.min(1, (t - .34) / .22)) : 0;
        r.shoulderR.rotation.x = -.5 - .9 * k + .5 * go;
        r.shoulderR.rotation.z = -.5 * k - .3 * go;
        r.elbowR.rotation.x = -1.5 * k + 1.2 * go;
        r.shoulderL.rotation.x = -.35 * k;
        r.elbowL.rotation.x = -1.1 * k;
        r.spine.rotation.x = .22 * k - .3 * go;
        r.spine.rotation.y = -.3 * k + .5 * go;
        r.neck.rotation.x = .16 * k - .2 * go;
        r.hipL.rotation.x = -.3 * k; r.kneeL.rotation.x = .6 * k;
        r.hipR.rotation.x = .2 * k; r.kneeR.rotation.x = .4 * k;
        r.hips.position.y = r.hipsBaseY - .34 * k + .2 * go;
        return true;
      }
      case 'mg2': {                                   // nue: hand up, calling it down
        rp(r);
        var u = out(Math.min(1, t / .38));
        var dn = t > .38 ? out(Math.min(1, (t - .38) / .24)) : 0;
        r.shoulderR.rotation.x = -2.7 * u + 1.4 * dn;
        r.shoulderR.rotation.z = -.24 * u;
        r.elbowR.rotation.x = -.4 * u;
        r.shoulderL.rotation.x = -.9 * u + .3 * dn;
        r.elbowL.rotation.x = -1.4 * u;
        r.spine.rotation.x = -.3 * u + .5 * dn;
        r.neck.rotation.x = -.5 * u + .7 * dn;
        r.hipL.rotation.x = -.16 * u; r.kneeL.rotation.x = .34 * u;
        r.hipR.rotation.x = -.1 * u; r.kneeR.rotation.x = .28 * u;
        r.hips.position.y = r.hipsBaseY - .1 * u;
        return true;
      }
      case 'mg3': {                                   // serpent: both hands, pointed
        rp(r);
        var p2 = out(Math.min(1, t / .42));
        var st = t > .42 ? out(Math.min(1, (t - .42) / .2)) : 0;
        r.shoulderL.rotation.x = -1.5 * p2 - .5 * st;
        r.shoulderR.rotation.x = -1.5 * p2 - .5 * st;
        r.shoulderL.rotation.z = .5 * p2 - .34 * st;
        r.shoulderR.rotation.z = -.5 * p2 + .34 * st;
        r.elbowL.rotation.x = -1.3 * p2 + 1.1 * st;
        r.elbowR.rotation.x = -1.3 * p2 + 1.1 * st;
        r.spine.rotation.x = .2 * p2 - .34 * st;
        r.neck.rotation.x = -.14 * p2 - .1 * st;
        r.hipL.rotation.x = -.4 * p2; r.kneeL.rotation.x = .7 * p2;
        r.hipR.rotation.x = .3 * p2; r.kneeR.rotation.x = .5 * p2;
        r.hips.position.y = r.hipsBaseY - .4 * p2 + .24 * st;
        return true;
      }
      case 'mg4': {                                   // elephant: braced, both palms down
        rp(r);
        var b = out(Math.min(1, t / .55));
        var hold = t > .55 ? Math.min(1, (t - .55) / .5) : 0;
        var shake = Math.sin(t * 26) * .04 * hold;
        r.shoulderL.rotation.x = -1.05 * b;
        r.shoulderR.rotation.x = -1.05 * b;
        r.shoulderL.rotation.z = .8 * b;
        r.shoulderR.rotation.z = -.8 * b;
        r.elbowL.rotation.x = -.7 * b; r.elbowR.rotation.x = -.7 * b;
        r.spine.rotation.x = .46 * b + shake;
        r.neck.rotation.x = -.3 * b;
        r.hipL.rotation.x = -.62 * b; r.kneeL.rotation.x = 1.1 * b;
        r.hipR.rotation.x = -.56 * b; r.kneeR.rotation.x = 1.0 * b;
        r.hips.position.y = r.hipsBaseY - .78 * b + shake;
        return true;
      }
      case 'mgr': {                                   // rabbits: hand down, going back
        rp(r);
        var c = out(Math.min(1, t / .26));
        var away = t > .26 ? out(Math.min(1, (t - .26) / .34)) : 0;
        r.shoulderR.rotation.x = -.4 - .8 * c + 1.9 * away;
        r.shoulderR.rotation.z = -.36 * c;
        r.elbowR.rotation.x = -1.2 * c + .9 * away;
        r.shoulderL.rotation.x = -.3 * c + 1.5 * away;
        r.elbowL.rotation.x = -.9 * c;
        r.spine.rotation.x = .3 * c - .8 * away;
        r.neck.rotation.x = .2 * c - .5 * away;
        r.hipL.rotation.x = -.4 * c + .9 * away; r.kneeL.rotation.x = .8 * c;
        r.hipR.rotation.x = .3 * c - .5 * away; r.kneeR.rotation.x = .5 * c + .6 * away;
        r.hips.position.y = r.hipsBaseY - .3 * c;
        return true;
      }
    }
    return false;
  }

  /* --------------------------------------------------------------- wiring */
  var _stepAction = stepAction;
  stepAction = function (a, dt) {
    switch (a.type) {
      case 'mg1': return stepDogs(a, dt);
      case 'mg2': return stepNue(a, dt);
      case 'mg3': return stepSerpent(a, dt);
      case 'mg4': return stepElephant(a, dt);
      case 'mgr': return stepRabbits(a, dt);
    }
    return _stepAction(a, dt);
  };

  var _poseAction = poseAction;
  poseAction = function (r, a) {
    if (a && (r.__char || player.char) === 'megumi' && poseMegumi(r, a)) return;
    return _poseAction(r, a);
  };

  window.addEventListener('keydown', function (e) {
    if (!started || player.char !== 'megumi' || e.repeat) return;
    if (player.react || (player.action && (player.action.type === 'kb' ||
        player.action.type === 'void'))) {
      if (window.JJNOTICE && Math.random() < .5) window.JJNOTICE('NO TECHNIQUE WHILE HIT', '#ff8b98');
      return;
    }
    var hit = true;
    if (e.code === 'Digit1') castDogs();
    else if (e.code === 'Digit2') castNue();
    else if (e.code === 'Digit3') castSerpent();
    else if (e.code === 'Digit4') castElephant();
    else if (e.code === 'KeyR') castRabbits();
    else hit = false;
    if (hit) e.stopImmediatePropagation();
  }, true);

  /* nothing he has is allowed to outlive the swap */
  var _switchChar = switchChar;
  switchChar = function (id, quiet) {
    /* gone at once rather than fading out: a shikigami that outlives the
       body that called it is standing in somebody else's fight */
    MG.pets.slice().forEach(function (p2) {
      wisp(p2.position.clone(), 4);
      scene.remove(p2);
      p2.traverse(function (o) { if (o.isMesh) o.material.dispose(); });
    });
    MG.pets.length = 0;
    MG.pools.slice().forEach(function (p2) { p2.close(); });
    return _switchChar(id, quiet);
  };

  /* =====================================================================
     WHAT EVERYBODY ELSE SEES
     The same routines, with the damage taken out. Every hit already
     travels as its own message, so a shikigami that dealt damage here
     would deal it twice.
     ================================================================== */
  function dirOf(yaw) { return new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)); }

  MG.remote = {
    mg1: function (pos, yaw) {
      var d = dirOf(yaw);
      var at = pos.clone().addScaledVector(d, 4);
      shadowPool(at.clone(), 5.5, .5);
      later(340, function () {
        runDog(at.clone(), d.clone(), -1, false, true);
        runDog(at.clone(), d.clone(), 1, true, true);
        FX.streaks(at.clone().add(new THREE.Vector3(0, 1, 0)), LIT, 6, 12, .9);
      });
    },
    mg2: function (pos, yaw) {
      var d = dirOf(yaw);
      shadowPool(pos.clone(), 4.4, .4);
      later(380, function () { flyNue(pos.clone(), d.clone(), true); });
    },
    mg3: function (pos, yaw) {
      var d = dirOf(yaw);
      /* it opens where they are looking; the exact body is theirs to know */
      var at = pos.clone().addScaledVector(d, 11);
      shadowPool(at.clone(), 6.5, .55);
      FX.cracks(new THREE.Vector3(at.x, .05, at.z), 8, 10, 0x1a1a24);
      later(420, function () { strikeSnake(at.clone(), d.clone(), true); });
    },
    mg4: function (pos, yaw) {
      var d = dirOf(yaw);
      var at = elephantSpot(pos, d);
      var aimAt = pos.clone().addScaledVector(d, 26);
      shadowPool(at.clone(), 13, .9);
      FX.cracks(new THREE.Vector3(at.x, .05, at.z), 12, 16, 0x1a1a24);
      later(550, function () {
        summonElephant(at.clone(), d.clone(), true, aimAt.clone());
      });
    },
    mgr: function (pos, yaw) {
      var d = dirOf(yaw);
      shadowPool(pos.clone(), 7, .5);
      later(260, function () {
        loose(pos.clone(), d.clone(), true);
        FX.streaks(pos.clone().add(new THREE.Vector3(0, 1.4, 0)), LIT, 10, 14, 1);
      });
    }
  };

  /* the pieces the finishers borrow, so an ending is made of the same
     shikigami the move is */
  MG.buildDog = buildDog;
  MG.buildNue = buildNue;
  MG.buildSnake = buildSnake;
  MG.buildElephant = buildElephant;
  MG.buildRabbit = buildRabbit;
  MG.INK = INK; MG.DEEP = DEEP; MG.EDGE = EDGE; MG.LIT = LIT;
  MG.COLD = COLD; MG.WHITE = WHITE;
})();
