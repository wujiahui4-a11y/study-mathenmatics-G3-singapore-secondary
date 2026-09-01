/* =======================================================================
   UNLIMITED VOID
   Gojo's domain, rebuilt from what it actually is.

   From the source: he raises a hand and makes the sign; the inside of
   the domain is an instant of boundless white light, and then pitch
   black — an endless space of stars and distant galaxies with an eye
   the size of a black hole behind the target. Everyone in it except
   Gojo, who stands on solid ground, hangs in the air, taking more
   information than a brain can be asked to hold.

   So the sequence is: the hand, the card, the white, and then the void.

     0.0  he raises it, and the fingers make the sign
     1.5  the frame slams across the screen
     2.3  the world bleaches out
     3.3  white, and then nothing
     3.5  the void, the eye, the floor that reflects it all
     8.2  it closes

   ===================================================================== */
(function () {
  'use strict';
  if (typeof player === 'undefined' || typeof THREE === 'undefined') return;
  var FX = window.JJFX;
  if (!FX) return;
  var AN = window.JJANIM;
  var E = FX.ease;
  var TAU = Math.PI * 2;

  var V = window.JJVOID = {
    on: false, stage: [], mirrors: [], hand: null, eye: null, center: null, t: 0
  };
  var DUR = 8.2, R = 40;

  /* =====================================================================
     THE HAND
     The rig's hands are single boxes, which is fine for a fist and no use
     at all for a sign. This is a proper one, shown only while he makes it.
     ================================================================== */
  function buildHand(skin) {
    var g = new THREE.Group();
    function part(w, h, d, c) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({ color: c, roughness: .7 }));
      m.castShadow = true;
      return m;
    }
    var palm = part(.42, .46, .2, skin);
    g.add(palm);
    g.fingers = [];
    /* index, middle, ring, little — two bones each so they can curl */
    var xs = [-.15, -.05, .05, .15], len = [.3, .34, .3, .24];
    for (var i = 0; i < 4; i++) {
      var base = new THREE.Group();
      base.position.set(xs[i], .23, 0);
      var b1 = part(.09, len[i], .1, skin);
      b1.position.y = len[i] / 2;
      base.add(b1);
      var mid = new THREE.Group();
      mid.position.y = len[i];
      var b2 = part(.085, len[i] * .8, .095, skin);
      b2.position.y = len[i] * .4;
      mid.add(b2);
      base.add(mid);
      g.add(base);
      g.fingers.push({ base: base, mid: mid });
    }
    var thumbBase = new THREE.Group();
    thumbBase.position.set(-.22, .02, .02);
    var t1 = part(.1, .26, .11, skin);
    t1.position.y = .13;
    thumbBase.add(t1);
    var thumbMid = new THREE.Group();
    thumbMid.position.y = .26;
    var t2 = part(.09, .2, .1, skin);
    t2.position.y = .1;
    thumbMid.add(t2);
    thumbBase.add(thumbMid);
    g.add(thumbBase);
    g.thumb = { base: thumbBase, mid: thumbMid };
    g.scale.setScalar(1.35);
    g.visible = false;
    return g;
  }

  /* index and middle straight up, the other two folded under the thumb */
  function poseSign(hand, k) {
    if (!hand) return;
    var f = hand.fingers, curl = E.out(Math.min(1, k));
    f[0].base.rotation.x = -.05 * curl; f[0].mid.rotation.x = -.02 * curl;
    f[1].base.rotation.x = -.02 * curl; f[1].mid.rotation.x = 0;
    f[2].base.rotation.x = 1.5 * curl; f[2].mid.rotation.x = 1.7 * curl;
    f[3].base.rotation.x = 1.6 * curl; f[3].mid.rotation.x = 1.8 * curl;
    f[0].base.rotation.z = .02 * curl;
    f[1].base.rotation.z = -.02 * curl;
    hand.thumb.base.rotation.z = -.5 - .55 * curl;
    hand.thumb.base.rotation.x = .5 * curl;
    hand.thumb.mid.rotation.x = .6 * curl;
  }

  function attachHand() {
    var r = player.rig;
    if (!r.handR) return null;
    if (!r.domainHand) {
      r.domainHand = buildHand(0xf2c992);
      r.handR.add(r.domainHand);
    }
    return r.domainHand;
  }

  /* =====================================================================
     THE CARD
     A frame that slides across the world and turns it into a panel.
     ================================================================== */
  var ui = null;
  function buildUI() {
    if (ui) return;
    var css = document.createElement('style');
    css.textContent = [
      '#jjVoid{position:fixed;inset:0;z-index:17;pointer-events:none;overflow:hidden;opacity:0;',
      '  transition:opacity .18s}',
      '#jjVoid.on{opacity:1}',
      '#jjVoid .band{position:absolute;left:-14%;width:128%;height:23%;background:#f4f6fb;',
      '  transform:skewY(-6deg) translateX(-130%);transition:transform .42s cubic-bezier(.12,.9,.2,1);',
      '  box-shadow:0 0 40px rgba(0,0,0,.55);display:flex;align-items:center}',
      '#jjVoid .band.bot{transform:skewY(-6deg) translateX(130%);justify-content:flex-end}',
      '#jjVoid.slam .band{transform:skewY(-6deg) translateX(0)}',
      '#jjVoid .band.top{top:11%}',
      '#jjVoid .band.bot{bottom:19%}',
      '#jjVoid .band span{font-family:"Finger Paint","Segoe UI",cursive;font-size:min(5.2vw,46px);',
      '  letter-spacing:5px;color:#0a0d16;padding:0 19%;white-space:nowrap}',
      '#jjVoid .cut{position:absolute;left:-14%;width:128%;height:.55%;background:#0a0d16;',
      '  transform:skewY(-6deg) scaleX(0);transition:transform .3s ease-out}',
      '#jjVoid.slam .cut{transform:skewY(-6deg) scaleX(1)}',
      '#jjVoid .cut.a{top:34%} #jjVoid .cut.b{bottom:42%}',
      '#jjVoidWhite{position:fixed;inset:0;z-index:18;background:#fff;opacity:0;pointer-events:none}'
    ].join('');
    document.head.appendChild(css);
    ui = document.createElement('div');
    ui.id = 'jjVoid';
    ui.innerHTML = '<div class="band top"><span>0.2 DOMAIN</span></div>' +
      '<div class="cut a"></div><div class="cut b"></div>' +
      '<div class="band bot"><span>EXPANSION</span></div>';
    document.body.appendChild(ui);
    var w = document.createElement('div');
    w.id = 'jjVoidWhite';
    document.body.appendChild(w);
  }
  function card(on, slam) {
    buildUI();
    ui.classList.toggle('on', !!on);
    ui.classList.toggle('slam', !!slam);
  }
  function whiteOut(v) {
    buildUI();
    document.getElementById('jjVoidWhite').style.opacity = String(v);
  }

  /* =====================================================================
     THE VOID
     ================================================================== */
  /* a cutscene wants the frame to itself */
  function hud(show) {
    ['hud', 'crosshair', 'jjScore', 'jjFeed', 'jjSwap', 'jjAwake', 'jjNotice', 'jjPach', 'jjFever']
      .forEach(function (id) {
        var n = document.getElementById(id);
        if (n) n.style.visibility = show ? '' : 'hidden';
      });
  }

  /* the city does not come with him */
  var world = null;
  function hideWorld() {
    var keeps = new Set();
    keeps.add(player.rig.root);
    enemies.forEach(function (e) { if (e && e.rig) keeps.add(e.rig.root); });
    V.stage.forEach(function (o) { keeps.add(o); });
    V.mirrors.forEach(function (m) { keeps.add(m.dst); });
    world = { hidden: [], fog: scene.fog, bg: scene.background };
    scene.children.forEach(function (o) {
      if (!o.visible || keeps.has(o) || o.isLight) return;
      o.visible = false;
      world.hidden.push(o);
    });
    scene.background = new THREE.Color(0x01020a);
    scene.fog = new THREE.Fog(0x01020a, 60, 340);
    enemies.forEach(function (e) { if (e && e.hpSpr) e.hpSpr.visible = false; });
  }
  function showWorld() {
    if (!world) return;
    world.hidden.forEach(function (o) { o.visible = true; });
    scene.fog = world.fog;
    scene.background = world.bg;
    world = null;
    enemies.forEach(function (e) { if (e && e.hpSpr && !e.dead) e.hpSpr.visible = true; });
  }

  function keep(o) { V.stage.push(o); scene.add(o); return o; }
  function clearStage() {
    V.stage.forEach(function (o) {
      scene.remove(o);
      if (o.geometry && o.__own) o.geometry.dispose();
      if (o.material) { if (o.material.__own && o.material.map) o.material.map.dispose(); o.material.dispose(); }
    });
    V.stage.length = 0;
    V.mirrors.forEach(function (m) { scene.remove(m.dst); });
    V.mirrors.length = 0;
    V.eye = null;
  }

  /* a black disc the size of a hole in the sky, watching whoever it opened on */
  function buildEye(at) {
    var g = new THREE.Group();
    var iris = new THREE.Mesh(new THREE.CircleGeometry(19, 64),
      new THREE.MeshBasicMaterial({ color: 0x02030a, toneMapped: false }));
    g.add(iris);
    var rim = FX.billboard(FX.T.ring, 0x9fd8ff, .9);
    rim.scale.set(46, 46, 1);
    rim.position.z = -.4;
    g.add(rim);
    var rim2 = FX.billboard(FX.T.ring, 0xffffff, .5);
    rim2.scale.set(42, 42, 1);
    rim2.position.z = -.3;
    g.add(rim2);
    var pupil = new THREE.Mesh(new THREE.CircleGeometry(5.8, 40),
      new THREE.MeshBasicMaterial({ color: 0x0a1430, toneMapped: false }));
    pupil.position.z = .1;
    g.add(pupil);
    var glow = FX.billboard(FX.T.star, 0x6fb4ff, .55);
    glow.scale.setScalar(34);
    glow.position.z = .2;
    g.add(glow);
    g.position.copy(at);
    return keep(g);
  }

  /* the floor he is standing on, and everything standing on it twice */
  function mirrorOf(rig) {
    var dst = rig.root.clone(true);
    dst.traverse(function (o) {
      if (!o.isMesh) return;
      o.material = o.material.clone();
      o.material.transparent = true;
      o.material.opacity = .8;
      o.material.depthWrite = false;
      if (o.material.color) o.material.color.multiplyScalar(.85);
      o.castShadow = false;
      o.receiveShadow = false;
      if (o.material.emissive) o.material.emissive.setHex(0x0a1830);
    });
    dst.scale.y *= -1;
    scene.add(dst);
    var m = { src: rig.root, dst: dst };
    V.mirrors.push(m);
    return m;
  }
  function syncMirrors() {
    for (var i = 0; i < V.mirrors.length; i++) {
      var m = V.mirrors[i];
      copyTree(m.src, m.dst);
      m.dst.position.y = -m.src.position.y;
      m.dst.scale.set(m.src.scale.x, -m.src.scale.y, m.src.scale.z);
      /* a reflection is the same rotation turned over */
      m.dst.rotation.set(-m.src.rotation.x, m.src.rotation.y, -m.src.rotation.z);
    }
  }
  function copyTree(a, b) {
    var ca = a.children, cb = b.children, n = Math.min(ca.length, cb.length);
    for (var i = 0; i < n; i++) {
      cb[i].position.copy(ca[i].position);
      cb[i].quaternion.copy(ca[i].quaternion);
      cb[i].scale.copy(ca[i].scale);
      cb[i].visible = ca[i].visible;
      if (ca[i].children.length) copyTree(ca[i], cb[i]);
    }
  }

  /* pieces of somewhere else, turning slowly in the dark */
  function shards(center) {
    var g = new THREE.Group();
    for (var i = 0; i < 26; i++) {
      var w = .4 + Math.random() * 2.6;
      var m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * (.3 + Math.random())),
        new THREE.MeshBasicMaterial({
          color: [0x9fd8ff, 0xdfefff, 0x4b7fd8][i % 3],
          transparent: true, opacity: .1 + Math.random() * .22,
          side: THREE.DoubleSide, depthWrite: false, toneMapped: false
        }));
      var a = Math.random() * TAU, rr = 10 + Math.random() * R;
      m.position.set(Math.cos(a) * rr, 1 + Math.random() * 24, Math.sin(a) * rr);
      m.rotation.set(Math.random() * TAU, Math.random() * TAU, Math.random() * TAU);
      m.userData.spin = (Math.random() - .5) * .5;
      m.userData.rise = .3 + Math.random() * 1.1;
      g.add(m);
    }
    g.position.copy(center);
    return keep(g);
  }

  function openVoid(center) {
    clearStage();
    V.center = center.clone();

    /* pitch black, stars, and galaxies a long way off */
    var sky = new THREE.Mesh(new THREE.SphereGeometry(R * 4.5, 32, 24),
      new THREE.MeshBasicMaterial({
        map: FX.T.void.clone(), color: 0xffffff, side: THREE.BackSide,
        depthWrite: false, toneMapped: false
      }));
    sky.material.map.wrapS = sky.material.map.wrapT = THREE.RepeatWrapping;
    sky.material.map.repeat.set(4, 2);
    sky.material.map.needsUpdate = true;
    sky.material.__own = true;
    sky.geometry.__own = true;
    sky.position.copy(center);
    sky.renderOrder = -2;
    keep(sky);
    V.sky = sky;

    /* the floor: black glass, with everything above it underneath as well */
    var floor = new THREE.Mesh(new THREE.CircleGeometry(R * 2.4, 64),
      new THREE.MeshBasicMaterial({
        color: 0x05070f, transparent: true, opacity: .55, toneMapped: false
      }));
    floor.geometry.__own = true;
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(center.x, .02, center.z);
    floor.renderOrder = 2;
    keep(floor);

    var sheen = FX.billboard(FX.T.ring, 0x2f5fa8, .22);
    sheen.rotation.x = -Math.PI / 2;
    sheen.position.set(center.x, .05, center.z);
    sheen.scale.set(R * 2, R * 2, 1);
    sheen.renderOrder = 3;
    keep(sheen);

    V.shards = shards(center);
    mirrorOf(player.rig);
    var lifted = [];
    enemies.forEach(function (e) {
      if (!e || e.dead || !e.rig) return;
      if (e.pos.distanceTo(center) > R) return;
      lifted.push(e);
      if (V.mirrors.length < 5) mirrorOf(e.rig);
    });

    /* the eye, out past the target, the size of the hole it is named for */
    var dir = new THREE.Vector3(Math.sin(player.facing), 0, Math.cos(player.facing));
    var eye = buildEye(center.clone().addScaledVector(dir, R * 1.55).add(new THREE.Vector3(0, 13, 0)));
    eye.lookAt(player.pos.x, player.pos.y + 3, player.pos.z);
    V.eye = eye;

    /* everyone but him comes off the floor */
    lifted.forEach(function (e) {
      e.anchorT = DUR;
      e.anchorPos.copy(e.pos).add(new THREE.Vector3(0, 3.4 + Math.random() * 3.4, 0));
      e.stunT = Math.max(e.stunT || 0, DUR);
      e.lockT = Math.max(e.lockT || 0, DUR);
    });
    V.lifted = lifted;
    V.outside = [];
    enemies.forEach(function (e) {
      if (!e || !e.rig || lifted.indexOf(e) >= 0 || !e.rig.root.visible) return;
      e.rig.root.visible = false;
      V.outside.push(e);
    });

    /* nothing here gives off light, so bring some */
    var key = new THREE.PointLight(0xbfd8ff, 2.6, 90, 1.4);
    key.position.copy(center).add(new THREE.Vector3(0, 14, 0));
    keep(key);
    var rim = new THREE.PointLight(0x4b7fd8, 1.8, 70, 1.6);
    rim.position.copy(center).addScaledVector(dir, -10).add(new THREE.Vector3(0, 5, 0));
    keep(rim);
    var fill = new THREE.PointLight(0xdfefff, 3.4, 60, 1.1);
    fill.position.copy(player.pos).addScaledVector(dir, -6).add(new THREE.Vector3(0, 6, 0));
    keep(fill);
    var amb = new THREE.AmbientLight(0x33507f, 1.5);
    keep(amb);

    hideWorld();
    V.on = true;
  }

  function closeVoid() {
    if (!V.on) return;
    V.on = false;
    showWorld();
    clearStage();
    hud(true);
    card(false, false);
    whiteOut(0);
    FX.letterbox(false);
    FX.tint('#000000', 0);
    var r = player.rig;
    if (r.domainHand) r.domainHand.visible = false;
    if (V.lifted) V.lifted.forEach(function (e) { e.anchorT = 0; });
    if (V.outside) V.outside.forEach(function (e) { if (e.rig) e.rig.root.visible = true; });
    V.outside = null;
    FX.flash('#ffffff', .5, .5);
  }

  /* the information, pouring past whoever has to read it */
  function streams(center, dt, amt) {
    if (Math.random() > amt) return;
    var a = Math.random() * TAU, rr = 4 + Math.random() * R * 1.1;
    var at = new THREE.Vector3(center.x + Math.cos(a) * rr, .5 + Math.random() * 26,
      center.z + Math.sin(a) * rr);
    var m = FX.billboard(FX.T.streak, Math.random() < .3 ? 0x9fd8ff : 0xdfefff, 1);
    m.position.copy(at);
    scene.add(m);
    var life = .5 + Math.random() * .7, t = 0;
    var len = 3 + Math.random() * 10, fall = 14 + Math.random() * 26;
    addFx({ t: life, update: function (d) {
      this.t -= d; t += d;
      if (!V.on) { scene.remove(m); m.material.dispose(); return false; }
      m.position.y -= fall * d;
      FX.faceCam(m, Math.PI / 2);
      m.scale.set(len, .13, 1);
      m.material.opacity = Math.sin((1 - this.t / life) * Math.PI) * .85;
      if (this.t <= 0) { scene.remove(m); m.material.dispose(); return false; }
      return true;
    } });
  }

  /* =====================================================================
     THE SEQUENCE
     ================================================================== */
  function stepVoid(a, dt) {
    var p = player, t = a.t;
    if (a.dur !== DUR) { a.dur = DUR; }
    p.vel.set(0, 0, 0);
    p.iframes = Math.max(p.iframes, 1);

    /* ---- 0.0 the hand comes up ---- */
    if (a.stage < 1) {
      a.stage = 1;
      a.center = p.pos.clone();
      a.hand = attachHand();
      if (a.hand) {
        a.hand.visible = true;
        if (!a.handLit) {
          a.handLit = new THREE.PointLight(0xbfe4ff, 2.4, 6, 1.6);
          a.hand.add(a.handLit);
          a.handLit.position.set(.1, .9, .5);
        }
      }
      FX.letterbox(true);
      hud(false);
      FX.tint('#04060f', .35, 3.4);
      if (AN) AN.camRelease();
      try { sfx.raise(); } catch (e) {}
    }
    if (a.hand) {
      poseSign(a.hand, (t - .35) / .8);
      /* the arm chain twists the wrist wherever it likes; the sign is the
         shot, so hold it upright and turned to camera on its own */
      var fwd = new THREE.Vector3(Math.sin(p.facing), 0, Math.cos(p.facing));
      var sd = new THREE.Vector3(fwd.z, 0, -fwd.x);
      var toCam = fwd.clone().multiplyScalar(1.6).addScaledVector(sd, .7);
      var want = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(-.14, Math.atan2(toCam.x, toCam.z), .1, 'YXZ'));
      var wq = p.rig.handR.getWorldQuaternion(new THREE.Quaternion());
      a.hand.quaternion.copy(wq.invert().multiply(want));
      a.hand.position.set(0, -.12, 0);
    }
    if (t < 1.6 && a.hand) {
      var tip = a.hand.fingers[1].mid.getWorldPosition(new THREE.Vector3());
      if (!a.tipGlow) {
        a.tipGlow = FX.billboard(FX.T.star, 0xbfe4ff, 0);
        scene.add(a.tipGlow);
        V.stage.push(a.tipGlow);
      }
      var g = Math.max(0, Math.min(1, (t - .5) / .9));
      a.tipGlow.position.copy(tip);
      a.tipGlow.scale.setScalar(.5 + g * 1.9);
      a.tipGlow.material.opacity = g * .8;
      if (Math.random() < .85) FX.mote(tip, 0x9fd8ff, 2.2, .35);
      if (Math.random() < .3) FX.ring(tip, 0x9fd8ff,
        { maxR: .75, from: 3.5, life: .4, ground: false, opacity: .6 });
    } else if (a.tipGlow) {
      a.tipGlow.material.opacity = Math.max(0, a.tipGlow.material.opacity - dt * 3);
    }

    /* ---- 1.5 the card ---- */
    if (t >= 1.5 && a.stage < 2) {
      a.stage = 2;
      card(true, false);
      setTimeout(function () { card(true, true); }, 30);
      FX.flash('#dfefff', .4, .25);
      addShake(.5);
      if (AN) AN.camKick(.8);
      try { sfx.frame(); } catch (e) {}
    }

    /* ---- 2.3 everything bleaches ---- */
    if (t >= 2.3 && t < 3.3) {
      var w = (t - 2.3) / 1;
      whiteOut(w * w);
      if (Math.random() < .6) {
        FX.streaks(p.pos.clone().add(new THREE.Vector3(
          (Math.random() - .5) * 6, .5 + Math.random() * 6, (Math.random() - .5) * 6)),
          0xffffff, 1, 8, 1.2);
      }
      addShake(.25 + w * .6);
    }

    /* ---- 3.3 white, and then it is somewhere else ---- */
    if (t >= 3.3 && a.stage < 3) {
      a.stage = 3;
      if (a.hand) a.hand.visible = false;
      whiteOut(1);
      card(false, false);
      openVoid(a.center);
      hitstop(.12);
      if (window.MPJJ && window.MPJJ.relay) {
        window.MPJJ.relay.pub({ t: 'dom', id: window.MPJJ.id,
          x: Math.round(a.center.x * 10) / 10, z: Math.round(a.center.z * 10) / 10,
          r: R, d: 3.2 });
      }
      (V.lifted || []).forEach(function (e) {
        e.damage(22, null, { react: 'pummel', reactDur: 2, noFrameBonus: true, spark: 0xbfd8ff });
      });
      try { sfx.frame(); } catch (e) {}
    }
    if (t >= 3.3 && t < 4.1) whiteOut(1 - (t - 3.3) / .8);   // and the white lifts

    /* ---- the domain holds ---- */
    if (V.on) {
      streams(V.center, dt, .9);
      syncMirrors();
      if (V.sky) { V.sky.material.map.offset.x += dt * .006; V.sky.rotation.y += dt * .01; }
      if (V.shards) V.shards.children.forEach(function (m) {
        m.rotation.y += m.userData.spin * dt;
        m.rotation.x += m.userData.spin * .6 * dt;
        m.position.y += m.userData.rise * dt;
        if (m.position.y > 30) m.position.y = 1;
      });
      if (V.eye) {
        V.eye.lookAt(camera.position);
        var pulse = 1 + Math.sin(t * 2.2) * .02;
        V.eye.scale.setScalar(pulse);
      }
      a.tick = (a.tick || 0) + dt;
      if (a.tick > .5) {
        a.tick = 0;
        (V.lifted || []).forEach(function (e) {
          if (!e || e.dead) return;
          e.stunT = Math.max(e.stunT || 0, 1);
          e.hp = Math.max(1, e.hp - 5);          /* quietly, and it never kills */
          if (e.hpTex) e.drawHp && e.drawHp();
          FX.streaks(e.pos.clone().add(new THREE.Vector3(0, 3, 0)), 0xbfd8ff, 2, 7, .9);
        });
      }
    }
    if (t >= DUR - .35) closeVoid();
  }

  /* the sign, and the arm that carries it up */
  function poseVoid(r, a) {
    resetPose(r);
    if (r.body) r.body.rotation.set(0, 0, 0);
    var t = a.t;
    if (t < 1.5) {                                   // raising it
      var k = E.out(Math.min(1, (t - .1) / 1.2));
      var dip = t < .3 ? Math.sin(t / .3 * Math.PI) : 0;
      r.shoulderR.rotation.x = -.3 + .35 * dip - 2.05 * k;
      r.shoulderR.rotation.z = -.16 + .72 * k;
      r.elbowR.rotation.x = -.5 - .1 * dip - .95 * k;
      r.shoulderL.rotation.x = -.35 - .3 * k;
      r.shoulderL.rotation.z = .12 + .2 * k;
      r.elbowL.rotation.x = -.6 - .3 * k;
      r.spine.rotation.x = .1 - .16 * k + dip * .1;
      r.spine.rotation.y = .18 * k;
      r.neck.rotation.x = -.06 - .2 * k;
      r.neck.rotation.y = -.22 * k;
      r.hips.position.y = r.hipsBaseY - .22 * dip - .04 * k;
      if (AN) AN.weight(r, -.3 * k, 1);
    } else if (t < 3.3) {                            // held, while it is announced
      var s = E.out(Math.min(1, (t - 1.5) / .5));
      r.shoulderR.rotation.x = -2.35 - .18 * s;
      r.shoulderR.rotation.z = .56 + .06 * s;
      r.elbowR.rotation.x = -1.45 + .3 * s;
      r.shoulderL.rotation.x = -.65 - .2 * s;
      r.shoulderL.rotation.z = .32;
      r.elbowL.rotation.x = -.9;
      r.spine.rotation.x = -.06 - .1 * s;
      r.spine.rotation.y = .18 - .06 * s;
      r.neck.rotation.x = -.26 - .12 * s;
      r.hips.position.y = r.hipsBaseY + .06 * s;
      if (AN) AN.weight(r, -.3, 1);
    } else {                                         // and lowered, inside it
      var d = E.out(Math.min(1, (t - 3.3) / 1.1));
      r.shoulderR.rotation.x = -2.53 + 1.86 * d;
      r.shoulderR.rotation.z = .62 - .78 * d;
      r.elbowR.rotation.x = -1.15 + .7 * d;
      r.shoulderL.rotation.x = -.85 + .4 * d;
      r.shoulderL.rotation.z = .32 - .16 * d;
      r.elbowL.rotation.x = -.9 + .4 * d;
      r.spine.rotation.x = -.16 + .1 * d;
      r.spine.rotation.y = .12 - .12 * d;
      r.neck.rotation.x = -.38 + .2 * d;
      r.hips.position.y = r.hipsBaseY + .06 - .06 * d;
    }
  }

  /* the camera: on the hand, then on the frame, then on all of it */
  function voidCamera(a, dt) {
    var p = player, t = a.t, face = p.facing;
    var marks = [
      { t: 0, yaw: .9, d: 7.5, h: 3.2, lx: 0, ly: 3.4, k: 24 },
      { t: .9, yaw: .55, d: 3.4, h: 4.6, lx: 0, ly: 4.9, k: 30 },   // the hand
      { t: 1.5, yaw: .3, d: 2.8, h: 5.0, lx: 0, ly: 5.2, k: 44 },
      { t: 2.3, yaw: -.5, d: 8.5, h: 4.6, lx: 0, ly: 3.9, k: 20 },
      { t: 3.3, yaw: Math.PI + .9, d: 12, h: 5.2, lx: 0, ly: 3.8, k: 16 },
      { t: 4.6, yaw: Math.PI - .34, d: 17, h: 7.8, lx: 0, ly: 4.2, k: 13 },
      { t: 6.6, yaw: Math.PI + .12, d: 13, h: 6.2, lx: 0, ly: 3.6, k: 12 },
      { t: DUR, yaw: Math.PI + .05, d: 12.5, h: 5.8, lx: 0, ly: 3.5, k: 14 }
    ];
    /* while he makes the sign, the frame belongs to the hand */
    var dh = p.rig.domainHand;
    if (t > .62 && t < 1.62 && dh && dh.visible) {
      var h = dh.getWorldPosition(new THREE.Vector3());
      var fwd = new THREE.Vector3(Math.sin(face), 0, Math.cos(face));
      var side = new THREE.Vector3(fwd.z, 0, -fwd.x);
      var push = E.out(Math.min(1, (t - .62) / .8));
      var dd = 3.1 - .85 * push;
      var lat = h.clone().sub(p.pos); lat.y = 0;
      var sgn = lat.dot(side) >= 0 ? 1 : -1;
      var cp = h.clone().addScaledVector(fwd, dd)
        .addScaledVector(side, sgn * (.5 + .25 * push))
        .add(new THREE.Vector3(0, .2 - .12 * push, 0));
      if (AN && a.camMode !== 'hand') { a.camMode = 'hand'; AN.camRelease(); }
      if (AN) AN.camTo(cp.x, cp.y, cp.z, h.x, h.y + .06, h.z, dt, 52);
      else { camera.position.copy(cp); camera.lookAt(h.x, h.y + .06, h.z); }
      shakeMag = Math.max(0, shakeMag - dt * 2.2);
      return;
    }

    if (a.camMode === 'hand') { a.camMode = 'wide'; if (AN) AN.camRelease(); }
    var i = 0;
    while (i < marks.length - 1 && t >= marks[i + 1].t) i++;
    var m0 = marks[i], m1 = marks[Math.min(i + 1, marks.length - 1)];
    var k = m1 === m0 ? 0 : E.out(Math.min(1, (t - m0.t) / Math.max(.001, m1.t - m0.t)));
    function mix(f) { return m0[f] + (m1[f] - m0[f]) * k; }
    var yaw = face + mix('yaw'), d = mix('d');
    var lookY = mix('ly');
    if (AN) {
      AN.camTo(p.pos.x + Math.sin(yaw) * d, p.pos.y + mix('h'), p.pos.z + Math.cos(yaw) * d,
        p.pos.x, p.pos.y + lookY, p.pos.z, dt, mix('k'));
    } else {
      camera.position.set(p.pos.x + Math.sin(yaw) * d, p.pos.y + mix('h'), p.pos.z + Math.cos(yaw) * d);
      camera.lookAt(p.pos.x, p.pos.y + lookY, p.pos.z);
    }
    shakeMag = Math.max(0, shakeMag - dt * 2.2);
  }

  /* =====================================================================
     WIRING
     ================================================================== */
  var _stepAction = stepAction;
  stepAction = function (a, dt) {
    if (a.type === 'aw_domain') return stepVoid(a, dt);
    return _stepAction(a, dt);
  };
  var _poseAction = poseAction;
  poseAction = function (r, a) {
    if (a.type === 'aw_domain') return poseVoid(r, a);
    return _poseAction(r, a);
  };
  var _updateCamera = updateCamera;
  updateCamera = function (dt) {
    var a = player.action;
    if (a && a.type === 'aw_domain') { voidCamera(a, dt); return; }
    return _updateCamera(dt);
  };

  /* the domain is his: nothing interrupts it, and nothing in it touches him */
  var _hurtPlayer = hurtPlayer;
  hurtPlayer = function (amount, knock) {
    var a = player.action;
    if (a && a.type === 'aw_domain') return;
    return _hurtPlayer(amount, knock);
  };

  /* if it is cut short, put the world back */
  addFx({ t: 1e9, update: function () {
    var a = player.action;
    if (V.on && (!a || a.type !== 'aw_domain')) closeVoid();
    return true;
  } });
})();
