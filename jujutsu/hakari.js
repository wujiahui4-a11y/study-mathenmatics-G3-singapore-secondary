/* =======================================================================
   KINJI HAKARI
   Private Pure Love Train, and the domain it exists to open.

   From the source: the technique is pachinko. Outside the domain he can
   only put out its furniture — the shutter doors, and the balls — and he
   fights with his hands, which he is very good at. Inside it, Idle Death
   Gamble runs a machine: line up three of the same symbol and he is given
   unlimited cursed energy and an automatic reverse cursed technique for
   as long as the song lasts, which makes him unkillable. Miss and the
   domain simply runs again.

     1  SHUTTER          a train door, put between him and the attack
     2  BALL BARRAGE     the other thing the machine is full of
     3  GACHINKO         three of his own, and the floor after them
     4  IDLE DEATH GAMBLE the domain, the reels, and the jackpot
     R  OVERWHELM        straight through whatever is in the way

   The real odds are 1 in 239 and the real song is four minutes eleven.
   Neither of those is a game, so the reels here start generous and get
   more so every time they miss, and the round is half a minute.
   ===================================================================== */
(function () {
  'use strict';
  if (typeof player === 'undefined' || typeof THREE === 'undefined') return;
  var FX = window.JJFX;
  if (!FX) return;
  var AN = window.JJANIM;
  var E = FX.ease;

  var HAKARI_CFG = {
    hakari: true, face: true,
    torso: 0x232838, pants: 0x2f3646, shoes: 0x3a3f4a, skin: 0xd8a273
  };

  /* ---------------------------------------------------------------- rig */
  var _makeAnimeRig = makeAnimeRig;
  makeAnimeRig = function (cfg) {
    var r = _makeAnimeRig(cfg);
    if (!cfg || !cfg.hakari) return r;
    var head = r.head, hair = 0xe0b34e, hairD = 0xc2952f;

    function box(w, h, d, c, basic) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), basic
        ? new THREE.MeshBasicMaterial({ color: c, toneMapped: false })
        : new THREE.MeshStandardMaterial({ color: c, roughness: .76 }));
      m.castShadow = !basic;
      return m;
    }
    /* the afro: puffy, and swept toward the back of his head */
    var i;
    for (i = 0; i < 5; i++) {
      var w = 1.06 - i * .07;
      var lump = box(w, .3, .96 - i * .04, i % 2 ? hair : hairD);
      lump.position.set(0, .95 + i * .17, -.06 - i * .13);
      lump.rotation.x = -.12 * i;
      head.add(lump);
    }
    for (i = -1; i <= 1; i += 2) {                  // the taper at the sides
      var side = box(.13, .5, .78, hairD);
      side.position.set(i * .5, .82, -.1);
      head.add(side);
    }
    var back = box(.9, .44, .3, hairD);
    back.position.set(0, .78, -.5);
    head.add(back);

    /* magenta eyes, and the stubble across his lip */
    for (i = -1; i <= 1; i += 2) {
      var eye = box(.15, .09, .05, 0xd6407f, true);
      eye.position.set(i * .2, .58, .47);
      head.add(eye);
      var brow = box(.19, .04, .05, hairD);
      brow.position.set(i * .2, .69, .47);
      brow.rotation.z = i * .1;
      head.add(brow);
    }
    var tache = box(.3, .05, .05, 0x8a6a3a);
    tache.position.set(0, .38, .47);
    head.add(tache);

    /* the uniform jacket, open at the collar */
    var collar = box(1.0, .34, .78, 0x1a1f2c);
    collar.position.set(0, 1.06, 0);
    r.spine.add(collar);
    return r;
  };

  /* ------------------------------------------------------------- roster */
  cds.h1 = 0; cds.h2 = 0; cds.h3 = 0; cds.h4 = 0; cds.hr = 0;
  var HCD = { h1: 8, h2: 7, h3: 6, h4: 30, hr: 9 };

  CHARS.hakari = {
    name: 'HAKARI KINJI', sub: 'PRIVATE PURE LOVE TRAIN',
    cfg: HAKARI_CFG, glow: '#ffcc4d',
    moves: [
      { key: 'LMB', lbl: 'Punch', cd: 'm1', max: .32 },
      { key: 'Q', lbl: 'Dash', cd: 'dash', max: 1 },
      { key: '1', lbl: 'Shutter', cd: 'h1', max: HCD.h1 },
      { key: '2', lbl: 'Ball Barrage', cd: 'h2', max: HCD.h2 },
      { key: '3', lbl: 'Gachinko', cd: 'h3', max: HCD.h3 },
      { key: '4', lbl: 'Idle Death Gamble', cd: 'h4', max: HCD.h4 },
      { key: 'R', lbl: 'Overwhelm', cd: 'hr', max: HCD.hr }
    ]
  };
  try { CHARS.hakari.portrait = makePortrait(HAKARI_CFG); } catch (e) {}
  try { buildCharList(); } catch (e) {}

  var HK = window.JJHAKARI = { fever: 0, spins: 0, shutter: null, makeDoor: null };

  /* --------------------------------------------------------------- help */
  function ready(key) {
    return player.char === 'hakari' && !player.dead && !busy() &&
      (HK.fever > 0 || cds[key] <= 0) && !player.react &&
      !(window.JJNAOYA && window.JJNAOYA.busy());
  }
  function start(type, dur, key, name, sub) {
    cds[key] = HCD[key];
    player.action = { type: type, t: 0, dur: dur, stage: 0 };
    if (name) showSplash(name, sub || '', HK.fever > 0 ? '#ffd964' : '#ffcc4d');
    return player.action;
  }
  function aim() { return new THREE.Vector3(Math.sin(player.facing), 0, Math.cos(player.facing)); }
  function boost() { return HK.fever > 0 ? 1.45 : 1; }
  function inFront(range, width) {
    var f = aim(), out = [];
    for (var i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      if (!e || e.dead || e.rag) continue;
      var to = e.pos.clone().sub(player.pos); to.y = 0;
      var along = to.dot(f);
      if (along < -1.5 || along > range) continue;
      if (to.addScaledVector(f, -along).length() > (width || 3.6)) continue;
      out.push(e);
    }
    return out;
  }

  /* =====================================================================
     1 · SHUTTER
     A train door between him and whatever is coming, and then thrown.
     ================================================================== */
  function castShutter() {
    if (!ready('h1')) return;
    var a = start('h1', 1.35, 'h1', 'SHUTTER', 'PRIVATE PURE LOVE TRAIN');
    a.dir = aim();
    a.door = makeDoor();
    a.door.position.copy(player.pos).addScaledVector(a.dir, 2.6).add(new THREE.Vector3(0, 3.4, 0));
    a.door.rotation.y = player.facing;
    a.door.scale.set(1, .05, 1);
    scene.add(a.door);
    HK.shutter = { until: 0, dir: a.dir.clone() };
    try { sfx.frame(); } catch (e) {}
  }
  /* one door, used by the skill and by the finisher — a train shutter,
     not a wooden box. Same size the throw already aims with. */
  var DOOR_SLAT = null, DOOR_GLASS = null, DOOR_PLATE = null;
  function doorCanvas(w, h, draw) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    var t = new THREE.CanvasTexture(c);
    try { t.colorSpace = THREE.SRGBColorSpace || THREE.sRGBEncoding; } catch (err) {}
    t.anisotropy = 4;
    return t;
  }
  function doorMaps() {
    if (DOOR_SLAT) return;
    DOOR_SLAT = doorCanvas(16, 64, function (x, w, h) {
      var i, g;
      for (i = 0; i < 8; i++) {
        g = x.createLinearGradient(0, i * 8, 0, i * 8 + 8);
        g.addColorStop(0, '#f2f6fb');
        g.addColorStop(.28, '#b8c2d0');
        g.addColorStop(.5, '#6e7888');
        g.addColorStop(.72, '#d0d8e2');
        g.addColorStop(1, '#8a93a2');
        x.fillStyle = g;
        x.fillRect(0, i * 8, w, 8);
      }
    });
    DOOR_SLAT.wrapS = DOOR_SLAT.wrapT = THREE.RepeatWrapping;
    DOOR_SLAT.repeat.set(1, 2);
    DOOR_GLASS = doorCanvas(256, 160, function (x, w, h) {
      var g = x.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#153044');
      g.addColorStop(.45, '#2a5a78');
      g.addColorStop(1, '#0c1c28');
      x.fillStyle = g;
      x.fillRect(0, 0, w, h);
      g = x.createLinearGradient(20, 0, w - 20, h);
      g.addColorStop(0, 'rgba(210,230,255,0.22)');
      g.addColorStop(.5, 'rgba(255,220,120,0.08)');
      g.addColorStop(1, 'rgba(80,140,180,0.18)');
      x.fillStyle = g;
      x.fillRect(10, 10, w - 20, h - 20);
      x.fillStyle = 'rgba(255,210,74,0.92)';
      x.font = 'bold 54px sans-serif';
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillText('777', w / 2, h / 2 + 4);
      x.fillStyle = 'rgba(255,80,140,0.55)';
      x.fillRect(18, h - 22, w - 36, 5);
    });
    DOOR_PLATE = doorCanvas(256, 48, function (x, w, h) {
      x.fillStyle = '#1a1420';
      x.fillRect(0, 0, w, h);
      var g = x.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, '#ff4f8b');
      g.addColorStop(.5, '#ffd964');
      g.addColorStop(1, '#ff4f8b');
      x.fillStyle = g;
      x.fillRect(0, 6, w, h - 12);
      x.fillStyle = '#1a1020';
      x.font = 'bold 18px sans-serif';
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillText('PRIVATE PURE LOVE TRAIN', w / 2, h / 2);
    });
  }
  function makeDoor() {
    doorMaps();
    var g = new THREE.Group();
    g.userData.slats = [];
    g.userData.golds = [];

    function mat(c, opt) {
      opt = opt || {};
      var m = new THREE.MeshStandardMaterial({
        color: c,
        roughness: opt.rough == null ? .55 : opt.rough,
        metalness: opt.metal == null ? .22 : opt.metal,
        emissive: opt.emit || 0x000000,
        emissiveIntensity: opt.emitI || 0,
        map: opt.map || null,
        transparent: !!opt.alpha,
        opacity: opt.alpha == null ? 1 : opt.alpha
      });
      if (opt.gold) {
        m.userData.baseEmit = opt.emitI || .32;
        g.userData.golds.push(m);
      }
      return m;
    }
    function lit(c, opt) {
      opt = opt || {};
      var m = new THREE.MeshBasicMaterial({
        color: c, toneMapped: false, map: opt.map || null,
        transparent: !!opt.alpha, opacity: opt.alpha == null ? 1 : opt.alpha
      });
      return m;
    }
    function box(par, w, h, d, m, x, y, z) {
      var mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      mesh.position.set(x || 0, y || 0, z || 0);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      par.add(mesh);
      return mesh;
    }

    var steel = mat(0xc5ced8, { rough: .48, metal: .28 });
    var steelD = mat(0x6a7382, { rough: .58, metal: .18 });
    var steelR = mat(0xffffff, { rough: .42, metal: .2, map: DOOR_SLAT });
    var ink = mat(0x2a2e36, { rough: .82, metal: .06 });
    var gold = lit(0xffd24a);
    var goldH = lit(0xffe08a);
    var pink = lit(0xff4f8b);
    var glass = lit(0xffffff, { map: DOOR_GLASS });
    var plate = lit(0xffffff, { map: DOOR_PLATE });
    var hazY = lit(0xffcc33);
    var hazK = mat(0x2a2c32, { rough: .8, metal: .08 });
    var rv = mat(0xc8d0da, { rough: .4, metal: .3 });

    /* two leaves, so the finisher can open them and clamp them */
    var left = new THREE.Group();
    left.position.x = -1.72;
    left.userData.homeX = -1.72;
    g.add(left);
    var right = new THREE.Group();
    right.position.x = 1.72;
    right.userData.homeX = 1.72;
    g.add(right);
    g.userData.left = left;
    g.userData.right = right;

    /* the frame the shutter rides in — same from either side */
    box(g, 7.55, .42, .96, steel, 0, 3.22, 0);
    box(g, 7.7, .14, 1.02, gold, 0, 3.46, 0);
    box(g, .38, 6.6, .96, steel, -3.58, 0, 0);
    box(g, .38, 6.6, .96, steel, 3.58, 0, 0);
    box(g, 7.55, .34, 1.0, steelD, 0, -3.28, 0);

    /* rubber sweep and hazard blocks on the sill */
    box(g, 7.1, .16, .86, ink, 0, -3.08, 0);
    var h;
    for (h = 0; h < 9; h++) {
      box(g, .72, .12, .96, h % 2 ? hazY : hazK, -2.88 + h * .72, -3.38, 0);
    }

    /* both skins: the player stands on -Z, the throw goes toward +Z */
    function skin(zS) {
      box(g, 7.85, .07, .07, goldH, 0, 3.58, .44 * zS);
      box(g, 7.85, .07, .07, goldH, 0, -3.48, .44 * zS);
      box(g, .07, 7.1, .07, goldH, -3.82, 0, .44 * zS);
      box(g, .07, 7.1, .07, goldH, 3.82, 0, .44 * zS);

      var side;
      for (side = -1; side <= 1; side += 2) {
        var leaf = side < 0 ? left : right;

        box(leaf, 3.28, 6.05, .14, steel, 0, 0, 0);
        var s;
        for (s = 0; s < 10; s++) {
          var sy = -2.62 + s * .38;
          var slat = box(leaf, 3.12, .3, .2, steelR, 0, sy, .12 * zS);
          slat.userData.home = slat.position.clone();
          g.userData.slats.push(slat);
          box(leaf, 3.12, .06, .24, steelD, 0, sy - .16, .14 * zS);
        }
        box(leaf, 2.55, 1.85, .08, ink, 0, 2.08, .14 * zS);
        box(leaf, 2.36, 1.66, .05, glass, 0, 2.08, .2 * zS);
        box(leaf, 2.58, .1, .12, gold, 0, 2.96, .22 * zS);
        box(leaf, 2.58, .1, .12, gold, 0, 1.2, .22 * zS);
        box(leaf, .1, 1.86, .12, gold, -1.24, 2.08, .22 * zS);
        box(leaf, .1, 1.86, .12, gold, 1.24, 2.08, .22 * zS);
        box(leaf, 2.4, .06, .1, gold, 0, 2.08, .24 * zS);
        box(leaf, .06, 1.66, .1, gold, 0, 2.08, .24 * zS);
        box(leaf, 3.16, .28, .12, plate, 0, 1.02, .26 * zS);
        box(leaf, 3.16, .05, .14, pink, 0, 1.18, .28 * zS);
        box(leaf, .08, .72, .08, ink, side * -.9, -.15, .34 * zS);
        box(leaf, .34, .08, .08, ink, side * -.9, -.15, .34 * zS);
        box(leaf, .22, .1, .1, goldH, 0, 2.88, .32 * zS);
        box(leaf, .12, 6.0, .22, steel, side * 1.52, 0, .08 * zS);
        /* the inner edge that meets the other leaf when they clamp */
        box(leaf, .14, 6.1, .28, goldH, side * -1.62, 0, .2 * zS);
      }

      var r;
      for (r = -3; r <= 3; r++) box(g, .1, .1, .1, rv, r * 1.05, 3.22, .5 * zS);
      for (r = -2; r <= 2; r++) {
        box(g, .1, .1, .1, rv, -3.58, r * 1.15, .5 * zS);
        box(g, .1, .1, .1, rv, 3.58, r * 1.15, .5 * zS);
      }
    }
    skin(-1);
    skin(1);

    var glow = FX.billboard(FX.T.ring, 0xffcc4d, .5);
    glow.scale.set(8.2, 8.2, 1);
    glow.position.z = -.58;
    g.add(glow);
    g.userData.glow = glow;
    var glowB = FX.billboard(FX.T.ring, 0xff4f8b, .32);
    glowB.scale.set(7.4, 7.4, 1);
    glowB.position.z = .58;
    g.add(glowB);
    g.userData.glowB = glowB;
    var star = FX.billboard(FX.T.star, 0xffe08a, .35);
    star.scale.set(2.8, 2.8, 1);
    star.position.set(0, .15, -.68);
    g.add(star);
    g.userData.star = star;

    return g;
  }
  HK.makeDoor = makeDoor;
  HK.openDoor = function (door, amount) {
    if (!door || !door.userData.left || !door.userData.right) return;
    door.userData.left.position.x = door.userData.left.userData.homeX - amount;
    door.userData.right.position.x = door.userData.right.userData.homeX + amount;
    var show = amount < .55;
    if (door.userData.glow) door.userData.glow.visible = show;
    if (door.userData.glowB) door.userData.glowB.visible = show;
    if (door.userData.star) door.userData.star.visible = amount < .25;
  };
  HK.dropDoor = function (door) {
    if (!door) return;
    if (door.parent) door.parent.remove(door);
    else if (typeof scene !== 'undefined') scene.remove(door);
    door.traverse(function (c) {
      if (!c.isMesh || !c.material) return;
      var ms = c.material.length ? c.material : [c.material];
      for (var i = 0; i < ms.length; i++) if (ms[i] && ms[i].dispose) ms[i].dispose();
    });
  };
  HK.pulseDoor = function (door, t) {
    if (!door || !door.userData) return;
    var k = .5 + .5 * Math.sin(t * 20);
    if (door.userData.glow) door.userData.glow.material.opacity = .42 + k * .28;
    if (door.userData.glowB) door.userData.glowB.material.opacity = .22 + k * .18;
    if (door.userData.star) door.userData.star.material.opacity = .28 + k * .3;
    var golds = door.userData.golds || [];
    for (var i = 0; i < golds.length; i++) {
      if (golds[i].isMeshStandardMaterial) {
        golds[i].emissiveIntensity = (golds[i].userData.baseEmit || .3) + k * .45;
      }
    }
  };
  HK.rattleDoor = function (door, amt) {
    if (!door || !door.userData || !door.userData.slats) return;
    var slats = door.userData.slats;
    for (var i = 0; i < slats.length; i++) {
      var s = slats[i], home = s.userData.home;
      if (!home) continue;
      s.position.x = home.x + (Math.random() - .5) * amt;
      s.position.z = home.z + (Math.random() - .5) * amt * .6;
    }
  };
  function stepShutter(a, dt) {
    if (!a.door) return;
    if (a.t < .22) {                                 // it drops into place
      var k = E.out(a.t / .22);
      a.door.scale.set(1, .05 + .95 * k, 1);
      a.door.position.copy(player.pos).addScaledVector(a.dir, 2.6).add(new THREE.Vector3(0, 3.4, 0));
      HK.pulseDoor(a.door, a.t);
      if (a.stage < 1) {
        a.stage = 1;
        FX.ring(new THREE.Vector3(a.door.position.x, .1, a.door.position.z), 0xffcc4d, { maxR: 7, life: .5 });
        FX.dust(new THREE.Vector3(a.door.position.x, 0, a.door.position.z), 5, 0xcfc3a8, 7, 2.6);
        addShake(.35);
      }
      HK.shutter.until = SA_now() + .001;
      return;
    }
    /* while it is up, it is between him and everything in front */
    if (a.t < .62) {
      HK.shutter.until = SA_now() + .2;
      a.door.position.copy(player.pos).addScaledVector(a.dir, 2.6).add(new THREE.Vector3(0, 3.4, 0));
      HK.pulseDoor(a.door, a.t);
      if (Math.random() < .3) FX.streaks(a.door.position.clone(), 0xffcc4d, 1, 5, .8);
      return;
    }
    /* and then he puts it through them */
    if (a.stage < 2) {
      a.stage = 2;
      a.slam = 0;
      FX.speedRing(a.door.position.clone(), 0xffcc4d, 8, .3);
      try { sfx.whoosh(); } catch (e) {}
    }
    if (a.t < 1.0) {
      a.slam += dt;
      a.door.position.addScaledVector(a.dir, 34 * dt);
      HK.pulseDoor(a.door, a.t * 2);
      HK.rattleDoor(a.door, .04);
      if (Math.random() < .7) FX.streaks(a.door.position.clone(), 0xffe08a, 2, 12, 1.2);
      enemies.forEach(function (e) {
        if (!e || e.dead || e.rag || e.hkHit) return;
        if (e.pos.clone().add(new THREE.Vector3(0, 2.4, 0)).distanceTo(a.door.position) > 5) return;
        e.hkHit = 1;
        setTimeout(function () { e.hkHit = 0; }, 1400);   // once per door
        var kb = a.dir.clone().multiplyScalar(40); kb.y = 15;
        e.damage(26 * boost(), kb, { react: 'stagger', reactDur: .8, spark: 0xffcc4d });
        FX.impact(e.pos.clone().add(new THREE.Vector3(0, 2.8, 0)), 0xffcc4d, 1.6);
        addShake(.5);
      });
      return;
    }
    if (a.stage < 3) {
      a.stage = 3;
      var at = a.door.position.clone();
      FX.cross(at, 0xffe08a, 6, .3);
      FX.impact(at, 0xffcc4d, 2.2);
      FX.rings(at, 0xffcc4d, 3, { maxR: 12, life: .5, ground: false, gap: 40 });
      FX.debris(new THREE.Vector3(at.x, 0, at.z), 10, 15, 0x8b93a2);
      addShake(.8);
      HK.dropDoor(a.door);
      a.door = null;
      HK.shutter = null;
    }
  }
  function SA_now() { return performance.now() / 1000; }

  /* =====================================================================
     2 · BALL BARRAGE
     ================================================================== */
  function castBalls() {
    if (!ready('h2')) return;
    var a = start('h2', 1.5, 'h2', 'BALL BARRAGE', 'THE OTHER HALF OF THE MACHINE');
    a.dir = aim();
    a.fired = 0;
    try { sfx.whoosh(); } catch (e) {}
  }
  function stepBalls(a, dt) {
    if (a.t < .3 || a.t > 1.15) return;
    a.acc = (a.acc || 0) + dt;
    if (a.acc < .045) return;
    a.acc = 0;
    var from = player.pos.clone().addScaledVector(a.dir, 1.4).add(new THREE.Vector3(0, 3, 0));
    var spread = new THREE.Vector3((Math.random() - .5) * .5, (Math.random() - .5) * .28, (Math.random() - .5) * .5);
    var dir = a.dir.clone().add(spread).normalize();
    ball(from, dir);
    a.fired++;
    if (a.fired % 3 === 0) addShake(.12);
  }
  var BALL_GEO = null;
  function ball(from, dir) {
    if (!BALL_GEO) BALL_GEO = new THREE.SphereGeometry(.34, 10, 8);
    var m = new THREE.Mesh(BALL_GEO, new THREE.MeshStandardMaterial({
      color: 0xdfe4ec, roughness: .25, metalness: .8
    }));
    m.position.copy(from);
    scene.add(m);
    var sp = 62 + Math.random() * 14, life = .7;
    addFx({ t: life, update: function (dt) {
      this.t -= dt;
      m.position.addScaledVector(dir, sp * dt);
      if (Math.random() < .5) FX.streaks(m.position.clone(), 0xffe08a, 1, 3, .5);
      for (var i = 0; i < enemies.length; i++) {
        var e = enemies[i];
        if (!e || e.dead || e.rag) continue;
        if (e.pos.clone().add(new THREE.Vector3(0, 2.6, 0)).distanceTo(m.position) > 2.2) continue;
        e.damage(4 * boost(), dir.clone().multiplyScalar(7).setY(3),
          { react: 'pummel', reactDur: .25, noFrameBonus: true, spark: 0xffe08a });
        FX.impact(m.position.clone(), 0xffe08a, .55);
        scene.remove(m); m.material.dispose();
        return false;
      }
      if (this.t <= 0 || m.position.y < .2) {
        FX.streaks(m.position.clone(), 0xdfe4ec, 3, 7, .6);
        scene.remove(m); m.material.dispose();
        return false;
      }
      return true;
    } });
  }

  /* =====================================================================
     3 · GACHINKO
     Three of his own and the floor after them. No technique in it at all.
     ================================================================== */
  function castGachinko() {
    if (!ready('h3')) return;
    start('h3', 1.35, 'h3', 'GACHINKO', 'NO TECHNIQUE REQUIRED');
    try { sfx.whoosh(); } catch (e) {}
  }
  var GACHI = [.26, .48, .70];
  function stepGachinko(a, dt) {
    if (a.t < .84) player.pos.addScaledVector(aim(), 6 * dt);
    for (var i = 0; i < GACHI.length; i++) {
      if (a.t >= GACHI[i] && (a.stage || 0) === i) {
        a.stage = i + 1;
        var at = player.pos.clone().addScaledVector(aim(), 2.5).add(new THREE.Vector3(0, 2.9 - i * .2, 0));
        FX.impact(at, 0xffcc4d, 1.1 + i * .3);
        FX.slash(at, aim(), 0xffe08a, 3.4 + i, .16);
        addShake(.3 + i * .12);
        hitstop(.04);
        inFront(4.6).forEach(function (e) {
          e.damage((11 + i * 3) * boost(), aim().multiplyScalar(9).setY(4),
            { react: i === 1 ? 'head' : 'gut', reactDur: .4, spark: 0xffcc4d, noFrameBonus: true });
        });
        try { sfx.hit(); } catch (e) {}
      }
    }
    if (a.t >= .95 && a.stage < 4) {                 // and the floor
      a.stage = 4;
      var at2 = player.pos.clone().addScaledVector(aim(), 2.2);
      FX.flash('#fff0c8', .35, .3);
      FX.cross(at2.clone().add(new THREE.Vector3(0, 1.6, 0)), 0xffffff, 6.5, .3);
      FX.impact(at2.clone().add(new THREE.Vector3(0, 1.2, 0)), 0xffcc4d, 2.8);
      FX.rings(new THREE.Vector3(at2.x, .12, at2.z), 0xffd964, 4, { maxR: 15, life: .6, gap: 42 });
      FX.cracks(new THREE.Vector3(at2.x, 0, at2.z), 11, 15, 0x2a2418);
      FX.debris(new THREE.Vector3(at2.x, 0, at2.z), 13, 17, 0x5c5240);
      FX.dust(new THREE.Vector3(at2.x, 0, at2.z), 9, 0xd8cbaa, 12, 4);
      FX.zoom(13, .55);
      addShake(1.5);
      hitstop(.14);
      inFront(6, 4.4).forEach(function (e) {
        var kb = aim().multiplyScalar(30); kb.y = 18;
        e.damage(24 * boost(), kb, { react: 'stagger', reactDur: .8, spark: 0xffcc4d });
      });
      try { sfx.redBoom(); } catch (e) {}
    }
  }

  /* =====================================================================
     R · OVERWHELM
     ================================================================== */
  function castOverwhelm() {
    if (!ready('hr')) return;
    var a = start('hr', .95, 'hr', 'OVERWHELM', 'STRAIGHT THROUGH');
    a.dir = aim();
    player.iframes = Math.max(player.iframes, .5);
    try { sfx.dash(); } catch (e) {}
  }
  function stepOverwhelm(a, dt) {
    if (a.t < .55) {
      player.pos.addScaledVector(a.dir, 34 * dt);
      collideWorld(player.pos, 1);
      if (Math.random() < .8) {
        FX.streaks(player.pos.clone().add(new THREE.Vector3(0, 2.4, 0)), 0xffd964, 2, 10, 1.1);
        FX.dust(player.pos.clone(), 1, 0xcfc3a8, 6, 2.2);
      }
      enemies.forEach(function (e) {
        if (!e || e.dead || e.rag || e.hkRam) return;
        if (e.pos.distanceTo(player.pos) > 3.4) return;
        e.hkRam = 1;
        setTimeout(function () { e.hkRam = 0; }, 700);
        var kb = a.dir.clone().multiplyScalar(38); kb.y = 13;
        e.damage(20 * boost(), kb, { react: 'stagger', reactDur: .75, spark: 0xffd964 });
        FX.heavyHit(e.pos.clone().add(new THREE.Vector3(0, 2.8, 0)), 0xffd964, 1.3);
        addShake(.6);
        hitstop(.06);
      });
    }
  }

  /* =====================================================================
     4 · IDLE DEATH GAMBLE
     The domain, and the machine inside it. Miss and it runs again.
     ================================================================== */
  var REELS = ['7', '\u2605', '\u2665', '\u25c6', '\u266a'];
  var ui = null;
  function buildUI() {
    if (ui) return;
    var css = document.createElement('style');
    css.textContent = [
      '#jjPach{position:fixed;left:50%;top:16%;transform:translateX(-50%);z-index:16;display:none;',
      '  pointer-events:none;font-family:"Finger Paint","Segoe UI",cursive;text-align:center}',
      '#jjPach .frame{display:flex;gap:8px;padding:12px 14px;border-radius:14px;',
      '  background:linear-gradient(180deg,#2a1c05,#140c02);border:3px solid #ffcc4d;',
      '  box-shadow:0 0 30px rgba(255,204,77,.6),inset 0 0 24px rgba(255,204,77,.25)}',
      '#jjPach .reel{width:88px;height:110px;border-radius:9px;background:#0b0904;',
      '  border:2px solid #7a5c16;display:flex;align-items:center;justify-content:center;',
      '  font-size:62px;color:#ffe08a;text-shadow:0 0 16px #ffcc4d;overflow:hidden}',
      '#jjPach .reel.spin{animation:jjSpin .09s linear infinite}',
      '#jjPach .reel.hit{border-color:#fff;color:#fff;text-shadow:0 0 26px #fff,0 0 60px #ffcc4d}',
      '@keyframes jjSpin{0%{transform:translateY(-14px);opacity:.5}100%{transform:translateY(14px);opacity:1}}',
      '#jjPach .cap{margin-top:8px;font-size:15px;letter-spacing:6px;color:#ffd964;',
      '  text-shadow:0 1px 6px #000}',
      '#jjPach.reach .frame{border-color:#ff5a7a;box-shadow:0 0 40px rgba(255,90,122,.8)}',
      '#jjPach.reach .cap{color:#ff8fa5;animation:jjReach .3s infinite}',
      '@keyframes jjReach{50%{opacity:.3}}',
      '#jjPach.win .frame{border-color:#fff;animation:jjWin .25s infinite}',
      '@keyframes jjWin{50%{box-shadow:0 0 70px #fff,inset 0 0 40px #ffcc4d}}',
      '#jjFever{position:fixed;left:50%;top:9%;transform:translateX(-50%);z-index:15;display:none;',
      '  font-family:"Finger Paint","Segoe UI",cursive;text-align:center;pointer-events:none}',
      '#jjFever .t{font-size:30px;letter-spacing:5px;color:#fff;',
      '  text-shadow:0 0 20px #ffcc4d,0 0 52px #ff9f2a}',
      '#jjFever .s{font-size:11px;letter-spacing:7px;color:#ffd964;text-shadow:0 1px 5px #000}'
    ].join('');
    document.head.appendChild(css);
    ui = document.createElement('div');
    ui.id = 'jjPach';
    ui.innerHTML = '<div class="frame"><div class="reel">7</div><div class="reel">7</div>' +
      '<div class="reel">7</div></div><div class="cap">IDLE DEATH GAMBLE</div>';
    document.body.appendChild(ui);
    var f = document.createElement('div');
    f.id = 'jjFever';
    f.innerHTML = '<div class="t">JACKPOT</div><div class="s">ADMIRING YOU</div>';
    document.body.appendChild(f);
  }
  function reelEls() { return ui.querySelectorAll('.reel'); }

  function castDomain() {
    if (!ready('h4')) return;
    if (HK.fever > 0) return;
    var a = start('h4', 6.2, 'h4', 'DOMAIN EXPANSION', 'IDLE DEATH GAMBLE');
    buildUI();
    a.center = player.pos.clone();
    a.spin = 0;
    a.roll = null;
    player.iframes = Math.max(player.iframes, 1.4);
    FX.letterbox(true);
    FX.tint('#1a1204', .4, 6);
    try { sfx.raise(); } catch (e) {}
    if (window.MPJJ && window.MPJJ.relay) {
      window.MPJJ.relay.pub({ t: 'cast', id: window.MPJJ.id, k: 'h4' });
    }
  }

  var DOM_R = 32;
  function stepDomain(a, dt) {
    var p = player;
    p.vel.set(0, 0, 0);
    p.iframes = Math.max(p.iframes, .5);

    if (a.stage < 1 && a.t >= .85) {                 // it opens
      a.stage = 1;
      FX.dome(new THREE.Vector3(a.center.x, 1, a.center.z), DOM_R, 0xffcc4d, 5.4);
      FX.flash('#fff3d0', .9, .5);
      FX.rings(new THREE.Vector3(a.center.x, .15, a.center.z), 0xffd964, 4, { maxR: DOM_R, life: .8, gap: 55 });
      FX.cracks(a.center.clone(), 12, 20, 0x2a2008);
      FX.debris(a.center.clone(), 14, 15, 0x6b5a30);
      FX.zoom(16, .8);
      addShake(1.4);
      hitstop(.14);
      /* the sure hit is the rules, not a wound: everything inside is held
         for a moment while it is told how the game works */
      enemies.forEach(function (e) {
        if (!e || e.dead || e.pos.distanceTo(a.center) > DOM_R) return;
        e.stunT = Math.max(e.stunT || 0, 1.4);
        e.lockT = Math.max(e.lockT || 0, 1.2);
        e.damage(8, null, { react: 'pummel', reactDur: 1.1, noFrameBonus: true, spark: 0xffd964 });
      });
      if (window.MPJJ && window.MPJJ.relay) {
        window.MPJJ.relay.pub({ t: 'dom', id: window.MPJJ.id, k: 'parlour',
          x: Math.round(a.center.x * 10) / 10, z: Math.round(a.center.z * 10) / 10,
          y: Math.round(player.facing * 100) / 100,
          r: DOM_R, d: 1.4, dur: 9.6 });
      }
      ui.style.display = 'block';
      ui.className = '';
      spin(a);
      try { sfx.frame(); } catch (e) {}
    }
    if (a.stage < 1) return;

    /* the machine: three reels, landing one at a time */
    a.rt = (a.rt || 0) + dt;
    var els = reelEls();
    if (a.roll) {
      for (var i = 0; i < 3; i++) {
        if (a.rt >= a.roll.stop[i]) {
          if (!a.roll.done[i]) {
            a.roll.done[i] = 1;
            els[i].classList.remove('spin');
            els[i].textContent = a.roll.face[i];
            els[i].classList.toggle('hit', a.roll.face[i] === a.roll.face[0]);
            FX.streaks(p.pos.clone().add(new THREE.Vector3(0, 4, 0)), 0xffd964, 5, 9, 1);
            addShake(.25);
            try { sfx.hit(); } catch (e) {}
            /* two the same, and the third still going */
            if (i === 1 && a.roll.face[0] === a.roll.face[1]) {
              ui.classList.add('reach');
              ui.querySelector('.cap').textContent = 'R E A C H !!';
              FX.zoom(-9, .8);
              addShake(.5);
            }
          }
        } else if (!a.roll.done[i]) {
          els[i].textContent = REELS[(Math.random() * REELS.length) | 0];
        }
      }
      if (a.rt >= a.roll.stop[2] + .55) {
        if (a.roll.win) { jackpot(a); }
        else if (a.t < a.dur - 1.4) { spin(a); }     // miss: it simply runs again
      }
    }
    if (Math.random() < .5) {
      var ang = Math.random() * Math.PI * 2, rr = Math.random() * DOM_R;
      FX.streaks(new THREE.Vector3(a.center.x + Math.cos(ang) * rr, .5 + Math.random() * 12,
        a.center.z + Math.sin(ang) * rr), 0xffd964, 1, 5, 1);
    }
    if (a.t > a.dur - .3) { ui.style.display = 'none'; FX.letterbox(false); }
  }

  function spin(a) {
    HK.spins++;
    /* one in two hundred and thirty nine is the real number and it is not
       a game; the odds open generous and improve every time it misses */
    var odds = Math.min(1, .3 + (HK.spins - 1) * .22);
    var win = Math.random() < odds;
    var face;
    if (win) {
      face = ['7', '7', '7'];
    } else {
      var a1 = REELS[(Math.random() * REELS.length) | 0];
      var same = Math.random() < .55;                // near misses are the point
      var a2 = same ? a1 : REELS[(Math.random() * REELS.length) | 0];
      var a3 = REELS[(Math.random() * REELS.length) | 0];
      if (a3 === a1 && a2 === a1) a3 = REELS[(REELS.indexOf(a1) + 1) % REELS.length];
      face = [a1, a2, a3];
    }
    a.rt = 0;
    a.roll = { face: face, win: win, done: [0, 0, 0], stop: [.55, 1.0, same_stop(face)] };
    ui.className = '';
    ui.querySelector('.cap').textContent = 'IDLE DEATH GAMBLE';
    var els = reelEls();
    for (var i = 0; i < 3; i++) { els[i].classList.add('spin'); els[i].classList.remove('hit'); }
  }
  function same_stop(face) { return face[0] === face[1] ? 2.3 : 1.45; }

  function jackpot(a) {
    a.roll = null;
    ui.classList.add('win');
    ui.querySelector('.cap').textContent = 'J A C K P O T';
    HK.spins = 0;
    HK.fever = 28;                                   // 4:11, at a length a match can carry
    player.hp = player.maxHp;
    FX.flash('#fff6d8', .95, .6);
    FX.cross(player.pos.clone().add(new THREE.Vector3(0, 3.4, 0)), 0xffffff, 12, .4);
    FX.rings(player.pos.clone().add(new THREE.Vector3(0, 2, 0)), 0xffcc4d, 5, { maxR: 24, life: .7, ground: false, gap: 40 });
    FX.rings(new THREE.Vector3(player.pos.x, .12, player.pos.z), 0xffd964, 4, { maxR: 26, life: .8, gap: 55 });
    FX.debris(player.pos.clone(), 18, 18, 0x6b5a30);
    FX.zoom(20, .9);
    FX.mangaLines(true, .6);
    addShake(2);
    hitstop(.2);
    rainbowShutters(player.pos.clone());
    if (!HK.aura) HK.aura = FX.aura(function () { return player.pos; }, 0xffcc4d);
    document.getElementById('jjFever').style.display = 'block';
    if (window.JJNOTICE) window.JJNOTICE('UNLIMITED CURSED ENERGY \u2014 AUTOMATIC RCT', '#ffd964');
    try { sfx.raise(); } catch (e) {}
    setTimeout(function () { if (ui) ui.style.display = 'none'; }, 1400);
  }

  /* the shutters that come up around him when it lands */
  function rainbowShutters(at) {
    var cols = [0xff5a7a, 0xffcc4d, 0x7fe08a, 0x7fb4ff, 0xc79bff, 0xff9f2a];
    for (var i = 0; i < 6; i++) {
      (function (i) {
        setTimeout(function () {
          var ang = (i / 6) * Math.PI * 2;
          var m = FX.billboard(FX.T.ring, cols[i], .75);
          m.position.set(at.x + Math.cos(ang) * 5, 3.4, at.z + Math.sin(ang) * 5);
          m.scale.set(.3, .3, 1);
          scene.add(m);
          var life = .9, t = 0;
          addFx({ t: life, update: function (dt) {
            this.t -= dt; t += dt;
            var k = 1 - this.t / life;
            FX.faceCam(m, 0);
            m.scale.set(.3 + k * 9, .3 + k * 9, 1);
            m.position.y = 3.4 + k * 3;
            m.material.opacity = .75 * (1 - k);
            if (this.t <= 0) { scene.remove(m); m.material.dispose(); return false; }
            return true;
          } });
          FX.streaks(new THREE.Vector3(at.x + Math.cos(ang) * 5, 3, at.z + Math.sin(ang) * 5),
            cols[i], 6, 14, 1.3);
        }, i * 70);
      })(i);
    }
  }

  /* =====================================================================
     POSES
     ================================================================== */
  function rp(r) { resetPose(r); if (r.body) r.body.rotation.set(0, 0, 0); }
  function W(r, s) { if (AN) AN.weight(r, s, 1); }

  function poseHakari(r, a) {
    var t = a.t;
    switch (a.type) {
      case 'h1': {                                    // shutter: hand out, braced
        rp(r);
        var up = Math.min(1, t / .22), push = t > .62 ? E.out(Math.min(1, (t - .62) / .2)) : 0;
        r.shoulderR.rotation.x = -.4 - 1.5 * up - .7 * push;
        r.shoulderR.rotation.z = -.2 - .2 * up + .3 * push;
        r.elbowR.rotation.x = -1.1 + .5 * up + .5 * push;
        r.shoulderL.rotation.x = -.4 - 1.1 * up - .5 * push;
        r.shoulderL.rotation.z = .2 + .2 * up - .3 * push;
        r.elbowL.rotation.x = -1.2 + .5 * up + .4 * push;
        r.spine.rotation.x = .2 + .16 * up - .34 * push;
        r.neck.rotation.x = .06 - .16 * push;
        r.hipL.rotation.x = -.28 * up + .18 * push;
        r.kneeL.rotation.x = .6 * up - .3 * push;
        r.kneeR.rotation.x = .45 * up - .2 * push;
        r.hips.position.y = r.hipsBaseY - .48 * up + .24 * push;
        W(r, -.35 * up + .5 * push);
        return true;
      }
      case 'h2': {                                    // balls: cranking them out
        rp(r);
        var g = Math.min(1, t / .3);
        var churn = Math.sin(t * 26) * (t > .3 && t < 1.15 ? 1 : 0);
        r.shoulderR.rotation.x = -1.7 * g + churn * .22;
        r.shoulderR.rotation.z = -.35 * g;
        r.elbowR.rotation.x = -.7 * g - churn * .3;
        r.shoulderL.rotation.x = -1.3 * g - churn * .18;
        r.shoulderL.rotation.z = .4 * g;
        r.elbowL.rotation.x = -1.1 * g;
        r.spine.rotation.x = .22 * g;
        r.spine.rotation.y = -.2 * g + churn * .07;
        r.neck.rotation.y = .14 * g;
        r.kneeL.rotation.x = .4 * g; r.kneeR.rotation.x = .35 * g;
        r.hips.position.y = r.hipsBaseY - .34 * g + churn * .04;
        W(r, -.3 * g);
        return true;
      }
      case 'h3': {                                    // three of his own
        rp(r);
        var n = 0, local = t;
        if (t < .26) { n = 0; local = t / .26; }
        else if (t < .48) { n = 1; local = (t - .26) / .22; }
        else if (t < .70) { n = 2; local = (t - .48) / .22; }
        else { n = 3; local = Math.min(1, (t - .70) / .35); }
        var arm = n % 2 === 0 ? 1 : -1;
        if (n < 3) {
          var coil = local < .45 ? E.out(local / .45) : 1 - (local - .45) / .55;
          var out = local < .45 ? 0 : E.out((local - .45) / .3);
          punchShape(r, coil * .8, Math.min(1, out), arm);
        } else {                                      // and the floor
          var raise = local < .35 ? E.out(local / .35) : 1;
          var down = local > .35 ? E.out(Math.min(1, (local - .35) / .25)) : 0;
          r.shoulderL.rotation.x = -1.2 - 1.5 * raise + 3.2 * down;
          r.shoulderR.rotation.x = -1.2 - 1.5 * raise + 3.2 * down;
          r.shoulderL.rotation.z = .3 - .1 * raise; r.shoulderR.rotation.z = -.3 + .1 * raise;
          r.elbowL.rotation.x = -.5 - .3 * raise + .3 * down;
          r.elbowR.rotation.x = -.5 - .3 * raise + .3 * down;
          r.spine.rotation.x = -.3 * raise + 1.15 * down;
          r.neck.rotation.x = -.3 * raise + .8 * down;
          r.hipL.rotation.x = -.2 * raise - .4 * down;
          r.kneeL.rotation.x = .3 * raise + 1 * down;
          r.kneeR.rotation.x = .25 * raise + .85 * down;
          r.hips.position.y = r.hipsBaseY + .3 * raise - 1.1 * down;
        }
        return true;
      }
      case 'hr': {                                    // shoulder first
        rp(r);
        var d = Math.min(1, t / .18), end = t > .55 ? E.out((t - .55) / .4) : 0;
        r.spine.rotation.x = .55 * d - .5 * end;
        r.spine.rotation.y = -.5 * d + .4 * end;
        r.neck.rotation.x = -.2 * d;
        r.shoulderR.rotation.x = -.9 * d + .5 * end;
        r.shoulderR.rotation.z = -.6 * d + .5 * end;
        r.elbowR.rotation.x = -1.5 * d + .8 * end;
        r.shoulderL.rotation.x = .5 * d - .7 * end;
        r.shoulderL.rotation.z = -.3 * d;
        r.elbowL.rotation.x = -.5 * d;
        r.hipL.rotation.x = -.55 * d + .5 * end;
        r.kneeL.rotation.x = .7 * d - .5 * end;
        r.hipR.rotation.x = .4 * d - .4 * end;
        r.kneeR.rotation.x = .5 * d - .4 * end;
        r.hips.position.y = r.hipsBaseY - .5 * d + .4 * end;
        return true;
      }
      case 'h4': {                                    // the domain
        rp(r);
        var s = t < .85 ? E.out(t / .85) : 1;
        var open = t >= .85 ? E.out(Math.min(1, (t - .85) / .4)) : 0;
        var idle = t > 1.4 ? Math.sin((t - 1.4) * 2.2) : 0;
        r.shoulderL.rotation.x = -1.45 * s + .5 * open;
        r.shoulderR.rotation.x = -1.45 * s + .5 * open;
        r.shoulderL.rotation.z = .5 * s - 1 * open;
        r.shoulderR.rotation.z = -.5 * s + 1 * open;
        r.elbowL.rotation.x = -1.5 * s + 1.2 * open;
        r.elbowR.rotation.x = -1.5 * s + 1.2 * open;
        r.neck.rotation.x = .18 * s - .55 * open + idle * .05;
        r.spine.rotation.x = .16 * s - .3 * open + idle * .04;
        r.hipL.rotation.x = -.14 * open; r.hipR.rotation.x = -.14 * open;
        r.hips.position.y = r.hipsBaseY - .3 * s + .38 * open + idle * .05;
        return true;
      }
    }
    return false;
  }

  /* his straight right, thrown from the floor like everyone else's */
  function punchShape(r, coil, out, arm) {
    var sh = arm < 0 ? r.shoulderL : r.shoulderR;
    var el = arm < 0 ? r.elbowL : r.elbowR;
    var osh = arm < 0 ? r.shoulderR : r.shoulderL;
    var oel = arm < 0 ? r.elbowR : r.elbowL;
    var lead = arm < 0 ? 'R' : 'L', rear = arm < 0 ? 'L' : 'R';
    sh.rotation.x = -.3 + 1 * coil - 2.5 * out;
    sh.rotation.z = arm * (-.5 * coil + .45 * out);
    el.rotation.x = -1.85 * coil + 1.8 * out;
    osh.rotation.x = -.4 - .6 * coil + .4 * out;
    osh.rotation.z = arm * (.3 * coil - .5 * out);
    oel.rotation.x = -1.1 - .5 * coil;
    r.hips.rotation.y = arm * (.38 * coil - .68 * out);
    r.spine.rotation.y = arm * (.66 * coil - 1.15 * out);
    r.spine.rotation.x = .18 + .2 * coil - .36 * out;
    r.neck.rotation.y = arm * (-.34 * coil + .5 * out);
    r['hip' + rear].rotation.x = -.34 * coil + .16 * out;
    r['knee' + rear].rotation.x = .7 * coil - .5 * out;
    r['ankle' + rear].rotation.x = -.25 * coil + .5 * out;
    r['hip' + lead].rotation.x = .26 * coil - .36 * out;
    r['knee' + lead].rotation.x = .4 * coil + .34 * out;
    r.hips.position.y = r.hipsBaseY - .5 * coil + .2 * out;
    W(r, (arm < 0 ? 1 : -1) * (.45 * coil - .8 * out));
  }

  /* =====================================================================
     WIRING
     ================================================================== */
  var _stepAction = stepAction;
  stepAction = function (a, dt) {
    switch (a.type) {
      case 'h1': return stepShutter(a, dt);
      case 'h2': return stepBalls(a, dt);
      case 'h3': return stepGachinko(a, dt);
      case 'h4': return stepDomain(a, dt);
      case 'hr': return stepOverwhelm(a, dt);
    }
    return _stepAction(a, dt);
  };

  var _poseAction = poseAction;
  poseAction = function (r, a) {
    if (poseHakari(r, a)) return;
    return _poseAction(r, a);
  };

  window.addEventListener('keydown', function (e) {
    if (!started || player.char !== 'hakari' || e.repeat) return;
    if (player.react || (player.action && (player.action.type === 'kb' || player.action.type === 'void'))) {
      if (window.JJNOTICE && Math.random() < .5) window.JJNOTICE('NO TECHNIQUE WHILE HIT', '#ff8b98');
      return;
    }
    if (e.code === 'Digit1') castShutter();
    else if (e.code === 'Digit2') castBalls();
    else if (e.code === 'Digit3') castGachinko();
    else if (e.code === 'Digit4') castDomain();
    else if (e.code === 'KeyR') castOverwhelm();
  });

  /* the shutter is a door, so it stops what comes at it from the front */
  var _hurtPlayer = hurtPlayer;
  hurtPlayer = function (amount, knock) {
    if (player.char === 'hakari' && HK.shutter && SA_now() < HK.shutter.until) {
      var from = knock ? knock.clone().normalize() : null;
      if (!from || from.dot(HK.shutter.dir) > -.2) {
        FX.impact(player.pos.clone().addScaledVector(HK.shutter.dir, 2.6).add(new THREE.Vector3(0, 3.4, 0)),
          0xffcc4d, 1.6);
        FX.streaks(player.pos.clone().addScaledVector(HK.shutter.dir, 2.6).add(new THREE.Vector3(0, 3, 0)),
          0xffe08a, 8, 14, 1.2);
        addShake(.4);
        if (window.JJNOTICE) window.JJNOTICE('BLOCKED', '#ffd964');
        return;
      }
    }
    var before = player.hp;
    _hurtPlayer(amount, knock);
    /* unlimited cursed energy means the body heals it before it lands */
    if (HK.fever > 0 && player.char === 'hakari') {
      if (player.hp < 1) { player.hp = 1; player.dead = false; player.deathT = 0; }
      FX.streaks(player.pos.clone().add(new THREE.Vector3(0, 3, 0)), 0xffd964, 6, 10, 1);
    }
  };

  /* --------------------------------------------------------- per frame */
  var STRIKE = {
    hips: 46, spine: 30, neck: 13,
    shoulderR: 58, elbowR: 58, shoulderL: 34, elbowL: 22,
    hipR: 28, kneeR: 20, hipL: 24, kneeL: 18
  };
  var SM = null, SMEAR = {};
  var _updatePlayer = updatePlayer;
  updatePlayer = function (dt) {
    _updatePlayer(dt);
    if (player.char !== 'hakari') { SM = null; return; }

    if (HK.fever > 0) {
      HK.fever -= dt;
      /* unlimited cursed energy: nothing is on cooldown, and the body
         mends itself as fast as it is opened */
      for (var k in cds) cds[k] = 0;
      player.hp = Math.min(player.maxHp, player.hp + dt * 11);
      if (Math.random() < .5) {
        FX.streaks(player.pos.clone().add(new THREE.Vector3(
          (Math.random() - .5) * 2.4, .4 + Math.random() * 4.4, (Math.random() - .5) * 2.4)),
          Math.random() < .5 ? 0xffcc4d : 0xff8fa5, 1, 6, .9);
      }
      var fev = document.getElementById('jjFever');
      if (fev) fev.querySelector('.s').textContent = 'ADMIRING YOU \u2014 ' + Math.ceil(HK.fever) + 's';
      if (HK.fever <= 0) {
        HK.fever = 0;
        if (HK.aura) { HK.aura.stop(); HK.aura = null; }
        if (fev) fev.style.display = 'none';
        if (window.JJNOTICE) window.JJNOTICE('THE SONG ENDED', '#c8b78a');
        FX.ring(new THREE.Vector3(player.pos.x, .1, player.pos.z), 0xffcc4d, { maxR: 10, life: .6 });
      }
    }

    if (!AN) return;
    var a = player.action, on = a && a.type.charAt(0) === 'h' && a.type.length === 2;
    if (on) {
      if (!SM) { SM = AN.smoother(player.rig, STRIKE); SM.snap(); SMEAR = {}; }
      AN.smear(player.rig, SM.step(dt), SMEAR, dt, HK.fever > 0 ? 0xffcc4d : 0xffe08a, 7);
    } else if (SM) {
      if (SM.step(dt) < 1.2) SM = null;
    }
  };

  /* dying, or leaving him, puts everything away */
  addFx({ t: 1e9, update: function () {
    if ((player.dead || player.char !== 'hakari') && HK.fever > 0) {
      HK.fever = 0;
      if (HK.aura) { HK.aura.stop(); HK.aura = null; }
      var fev = document.getElementById('jjFever');
      if (fev) fev.style.display = 'none';
    }
    if (player.char !== 'hakari' && ui) ui.style.display = 'none';
    return true;
  } });

  HK.jackpotFx = rainbowShutters;
})();
