/* =======================================================================
   ANIME VFX KIT
   Effects drawn the way a sakuga cut draws them: flat shapes that snap in
   on one frame and are gone a few frames later, not solids that swell.
   Almost everything here is a billboard with a hand-drawn canvas texture —
   stars, spokes, crescents, rings with a hard leading edge — because that
   is what impact frames actually are. Nothing in this file expands a
   sphere, and the two shapes that are volumetric (a beam, a domain) get
   their read from a snap, a rim and interior detail rather than scale.

   Everything lives on window.JJFX so the other modules can use it without
   worrying about which order they were inlined in.
   ===================================================================== */
(function () {
  'use strict';
  if (typeof THREE === 'undefined' || typeof scene === 'undefined') return;

  var TAU = Math.PI * 2;
  var UP = new THREE.Vector3(0, 1, 0);

  /* ------------------------------------------------------------ canvas art
     One texture per shape, drawn once. Anime effects are line art, so these
     are drawn with hard cores and short falloffs rather than soft blobs. */
  function canvas(size) {
    var c = document.createElement('canvas');
    c.width = c.height = size;
    return c;
  }
  function tex(c) {
    var t = new THREE.CanvasTexture(c);
    t.needsUpdate = true;
    return t;
  }

  /* a four point star with a hot core — the classic single frame hit flash */
  function drawStar(g, s, spikes, thin) {
    var h = s / 2;
    g.save();
    g.translate(h, h);
    for (var i = 0; i < spikes; i++) {
      var a = (i / spikes) * TAU;
      var long = (i % 2 === 0) ? h * .98 : h * .42;
      g.save();
      g.rotate(a);
      var grad = g.createLinearGradient(0, 0, 0, -long);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(.35, 'rgba(255,255,255,.75)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(-long * thin, 0);
      g.lineTo(0, -long);
      g.lineTo(long * thin, 0);
      g.closePath();
      g.fill();
      g.restore();
    }
    var core = g.createRadialGradient(0, 0, 0, 0, 0, h * .3);
    core.addColorStop(0, 'rgba(255,255,255,1)');
    core.addColorStop(.5, 'rgba(255,255,255,.9)');
    core.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = core;
    g.beginPath(); g.arc(0, 0, h * .3, 0, TAU); g.fill();
    g.restore();
  }

  var T = {};

  T.star = (function () {
    var c = canvas(256), g = c.getContext('2d');
    drawStar(g, 256, 8, .055);
    return tex(c);
  })();

  T.cross = (function () {
    var c = canvas(256), g = c.getContext('2d');
    drawStar(g, 256, 4, .045);
    return tex(c);
  })();

  /* spokes rushing outward: the burst behind an impact, and the ring of
     motion lines that sells speed */
  T.spokes = (function () {
    var c = canvas(256), g = c.getContext('2d'), h = 128;
    g.translate(h, h);
    for (var i = 0; i < 46; i++) {
      var a = (i / 46) * TAU + (i % 2) * .03;
      var inner = 26 + Math.random() * 16;
      var outer = 78 + Math.random() * 46;
      var w = .006 + Math.random() * .012;
      g.save(); g.rotate(a);
      var grad = g.createLinearGradient(0, -inner, 0, -outer);
      grad.addColorStop(0, 'rgba(255,255,255,.95)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(-inner * w * 12, -inner);
      g.lineTo(0, -outer);
      g.lineTo(inner * w * 12, -inner);
      g.closePath(); g.fill();
      g.restore();
    }
    return tex(c);
  })();

  /* a ring whose leading edge is hard and whose inside falls away fast —
     an expanding shock reads as a line, never as a filled disc */
  T.ring = (function () {
    var c = canvas(256), g = c.getContext('2d'), h = 128;
    var grad = g.createRadialGradient(h, h, h * .60, h, h, h * .97);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(.62, 'rgba(255,255,255,.30)');
    grad.addColorStop(.88, 'rgba(255,255,255,1)');
    grad.addColorStop(.97, 'rgba(255,255,255,.55)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.beginPath(); g.arc(h, h, h, 0, TAU); g.fill();
    return tex(c);
  })();

  /* crescent slash */
  T.slash = (function () {
    var c = canvas(256), g = c.getContext('2d');
    g.translate(128, 128);
    g.rotate(-Math.PI / 2);
    for (var pass = 0; pass < 2; pass++) {
      var r = 96 - pass * 5;
      var w = (pass === 0 ? 26 : 9);
      var grad = g.createLinearGradient(-r, 0, r, 0);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(.28, 'rgba(255,255,255,' + (pass ? 1 : .55) + ')');
      grad.addColorStop(.5, 'rgba(255,255,255,1)');
      grad.addColorStop(.72, 'rgba(255,255,255,' + (pass ? 1 : .55) + ')');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.strokeStyle = grad;
      g.lineWidth = w;
      g.lineCap = 'round';
      g.beginPath();
      g.arc(0, 0, r, -1.15, 1.15);
      g.stroke();
    }
    return tex(c);
  })();

  /* a soft, slightly torn puff for dust and smoke */
  T.smoke = (function () {
    var c = canvas(128), g = c.getContext('2d');
    for (var i = 0; i < 13; i++) {
      var x = 64 + (Math.random() - .5) * 44;
      var y = 64 + (Math.random() - .5) * 44;
      var r = 16 + Math.random() * 26;
      var grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, 'rgba(255,255,255,.30)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
    return tex(c);
  })();

  /* a tapered streak — a spark stretched along the way it is travelling */
  T.streak = (function () {
    var c = canvas(128), g = c.getContext('2d');
    var grad = g.createLinearGradient(0, 64, 128, 64);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(.42, 'rgba(255,255,255,.85)');
    grad.addColorStop(.86, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(0, 64); g.lineTo(96, 50); g.lineTo(128, 64); g.lineTo(96, 78);
    g.closePath(); g.fill();
    return tex(c);
  })();

  /* jagged energy bolt, drawn along the horizontal */
  T.bolt = (function () {
    var c = canvas(256), g = c.getContext('2d');
    g.lineCap = 'round';
    for (var pass = 0; pass < 2; pass++) {
      g.strokeStyle = pass ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,.4)';
      g.lineWidth = pass ? 5 : 16;
      g.beginPath();
      g.moveTo(4, 128);
      for (var x = 4; x < 252; x += 20) {
        g.lineTo(x, 128 + (Math.random() - .5) * 74);
      }
      g.lineTo(252, 128);
      g.stroke();
    }
    return tex(c);
  })();

  /* the inside of a domain: a deep field of stars and drifting glyph rows */
  T.void = (function () {
    var c = canvas(512), g = c.getContext('2d');
    g.fillStyle = '#04060f';
    g.fillRect(0, 0, 512, 512);
    var i, x, y, r;
    for (i = 0; i < 900; i++) {
      x = Math.random() * 512; y = Math.random() * 512;
      r = Math.random() * 1.5;
      g.fillStyle = 'rgba(' + (170 + Math.random() * 85 | 0) + ',' +
        (190 + Math.random() * 65 | 0) + ',255,' + (.25 + Math.random() * .75) + ')';
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
    for (i = 0; i < 26; i++) {                       // streams of information
      y = Math.random() * 512;
      g.strokeStyle = 'rgba(150,190,255,' + (.06 + Math.random() * .12) + ')';
      g.lineWidth = .6 + Math.random() * 1.4;
      g.beginPath(); g.moveTo(0, y);
      g.lineTo(512, y + (Math.random() - .5) * 40);
      g.stroke();
    }
    var t = tex(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  })();

  /* ------------------------------------------------------------- geometry
     Shared, because these are spawned dozens at a time. */
  var PLANE = new THREE.PlaneGeometry(1, 1);
  var CYL = new THREE.CylinderGeometry(1, 1, 1, 24, 1, true);
  var SPHERE = new THREE.SphereGeometry(1, 40, 28);
  var CHUNK = new THREE.BoxGeometry(1, 1, 1);

  /* Three.js bakes the light count into every material's shader, so adding a
     light mid-fight recompiles all of them and drops frames exactly when the
     screen is busiest. These are created once, at nothing, and borrowed. */
  var LIGHTS = (function () {
    var out = [];
    for (var i = 0; i < 3; i++) {
      var l = new THREE.PointLight(0xffffff, 0, 30);
      l.position.set(0, -60, 0);
      l.free = true;
      scene.add(l);
      out.push(l);
    }
    return out;
  })();
  function takeLight(color, distance) {
    for (var i = 0; i < LIGHTS.length; i++) {
      if (!LIGHTS[i].free) continue;
      LIGHTS[i].free = false;
      LIGHTS[i].color.set(color);
      LIGHTS[i].distance = distance;
      return LIGHTS[i];
    }
    return null;
  }
  function dropLight(l) {
    if (!l) return;
    l.intensity = 0;
    l.position.set(0, -60, 0);
    l.free = true;
  }

  function billboard(texture, color, opacity, blend) {
    var m = new THREE.Mesh(PLANE, new THREE.MeshBasicMaterial({
      map: texture, color: color, transparent: true, opacity: opacity == null ? 1 : opacity,
      blending: blend === false ? THREE.NormalBlending : THREE.AdditiveBlending,
      depthWrite: false, side: THREE.DoubleSide, toneMapped: false
    }));
    m.renderOrder = 6;
    return m;
  }

  function kill(m) {
    scene.remove(m);
    if (m.material) { if (m.material.map && m.material.__own) m.material.map.dispose(); m.material.dispose(); }
  }

  /* face the camera on every frame, optionally keeping a roll angle */
  function faceCam(m, roll) {
    m.quaternion.copy(camera.quaternion);
    if (roll) m.rotateZ(roll);
  }

  var ease = {
    out: function (x) { return 1 - Math.pow(1 - x, 3); },
    outQ: function (x) { return 1 - Math.pow(1 - x, 5); },
    in: function (x) { return x * x; },
    pop: function (x) { return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  };

  /* =====================================================================
     IMPACT
     Two frames of white, a star, a spoke burst and a handful of streaks.
     ================================================================== */
  function impact(pos, color, size) {
    size = size || 1;
    color = color == null ? 0xffffff : color;

    var star = billboard(T.star, 0xffffff, 1);
    star.position.copy(pos);
    star.scale.setScalar(size * 2.2);
    scene.add(star);
    var roll = Math.random() * TAU;
    addFx({ t: .16, update: function (dt) {
      this.t -= dt;
      var k = 1 - this.t / .16;
      faceCam(star, roll + k * .5);
      /* snap open, then thin out — the flash is over in three frames */
      star.scale.setScalar(size * (2.2 + ease.out(k) * 5.4));
      star.material.opacity = k < .18 ? 1 : Math.max(0, 1 - (k - .18) / .82);
      if (this.t <= 0) { kill(star); return false; }
      return true;
    } });

    var burst = billboard(T.spokes, color, .95);
    burst.position.copy(pos);
    scene.add(burst);
    var roll2 = Math.random() * TAU;
    addFx({ t: .26, update: function (dt) {
      this.t -= dt;
      var k = 1 - this.t / .26;
      faceCam(burst, roll2);
      burst.scale.setScalar(size * (1.6 + ease.outQ(k) * 9));
      burst.material.opacity = .95 * (1 - k) * (1 - k);
      if (this.t <= 0) { kill(burst); return false; }
      return true;
    } });

    streaks(pos, color, Math.round(6 * size), 16 * size, size);
  }

  /* sparks stretched along their own velocity */
  function streaks(pos, color, n, spd, size) {
    n = n || 6; spd = spd || 16; size = size || 1;
    for (var i = 0; i < n; i++) {
      var m = billboard(T.streak, color, 1);
      m.position.copy(pos);
      var v = new THREE.Vector3(Math.random() - .5, (Math.random() - .25) * .9, Math.random() - .5)
        .normalize().multiplyScalar(spd * (.45 + Math.random() * .9));
      var life = .18 + Math.random() * .22;
      (function (m, v, life) {
        var len = size * (1.1 + Math.random() * 1.5);
        addFx({ t: life, update: function (dt) {
          this.t -= dt;
          var k = Math.max(0, this.t / life);
          m.position.addScaledVector(v, dt);
          v.y -= 26 * dt;
          v.multiplyScalar(1 - dt * 2.2);
          /* the streak points where it is going and shrinks as it slows */
          var sp = v.length();
          m.quaternion.copy(camera.quaternion);
          var local = m.worldToLocal(m.position.clone().add(v));
          m.rotateZ(Math.atan2(local.y, local.x));
          m.scale.set(len * (.5 + sp * .055), size * .30 * k + .04, 1);
          m.material.opacity = k;
          if (this.t <= 0) { kill(m); return false; }
          return true;
        } });
      })(m, v, life);
    }
  }

  /* a cross flash: the single brightest frame of a heavy hit */
  function cross(pos, color, size, life) {
    size = size || 3; life = life || .22;
    var m = billboard(T.cross, color == null ? 0xffffff : color, 1);
    m.position.copy(pos);
    scene.add(m);
    var roll = (Math.random() - .5) * .6;
    addFx({ t: life, update: function (dt) {
      this.t -= dt;
      var k = 1 - this.t / life;
      faceCam(m, roll);
      /* wide first, then squeezes shut vertically like an iris */
      m.scale.set(size * (1 + ease.out(k) * 2.4), size * (1 + ease.out(k) * 2.4) * (1 - k * .82), 1);
      m.material.opacity = 1 - k * k;
      if (this.t <= 0) { kill(m); return false; }
      return true;
    } });
  }

  /* =====================================================================
     RINGS
     A flat ring texture on a plane. Ground rings lie down, air rings face
     the camera; both keep a hard edge as they run out.
     ================================================================== */
  function ring(pos, color, opt) {
    opt = opt || {};
    var maxR = opt.maxR || 10, life = opt.life || .5;
    var m = billboard(T.ring, color == null ? 0xffffff : color, opt.opacity == null ? 1 : opt.opacity);
    m.position.copy(pos);
    var ground = opt.ground !== false;
    if (ground) { m.rotation.x = -Math.PI / 2; m.position.y = Math.max(pos.y, .06); }
    var tilt = opt.tilt || 0;
    if (ground && tilt) m.rotation.z = tilt;
    /* a ring across the path of something travelling, rather than one lying
       on the floor or facing the camera */
    var axis = opt.axis ? opt.axis.clone().normalize() : null;
    if (axis) {
      ground = false;
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis);
    }
    scene.add(m);
    var from = opt.from == null ? .6 : opt.from;
    var rise = opt.rise || 0;
    var op0 = opt.opacity == null ? 1 : opt.opacity;
    addFx({ t: life, update: function (dt) {
      this.t -= dt;
      var k = 1 - this.t / life;
      if (!ground && !axis) faceCam(m, 0);
      var r = from + ease.outQ(k) * (maxR - from);
      m.scale.set(r, r, 1);
      if (rise) m.position.y += rise * dt;
      m.material.opacity = op0 * (1 - ease.in(k));
      if (this.t <= 0) { kill(m); return false; }
      return true;
    } });
    return m;
  }

  /* concentric rings a few frames apart — one ring reads thin, three read
     like a shock front */
  function rings(pos, color, n, opt) {
    opt = opt || {};
    for (var i = 0; i < n; i++) {
      (function (i) {
        setTimeout(function () {
          if (!scene) return;
          ring(pos, color, {
            maxR: (opt.maxR || 12) * (1 - i * .17),
            life: (opt.life || .5) * (1 + i * .12),
            ground: opt.ground,
            opacity: (opt.opacity || 1) * (1 - i * .22),
            rise: opt.rise
          });
        }, i * (opt.gap || 55));
      })(i);
    }
  }

  /* motion lines rushing inward, drawn as a ring of spokes that shrinks */
  function speedRing(pos, color, r, life) {
    r = r || 9; life = life || .32;
    var m = billboard(T.spokes, color == null ? 0xffffff : color, .9);
    m.position.copy(pos);
    scene.add(m);
    var roll = Math.random() * TAU;
    addFx({ t: life, update: function (dt) {
      this.t -= dt;
      var k = 1 - this.t / life;
      faceCam(m, roll + k * .3);
      m.scale.setScalar(r * (1.6 - ease.out(k) * 1.05));   // rushes inward
      m.material.opacity = .9 * Math.sin(k * Math.PI);
      if (this.t <= 0) { kill(m); return false; }
      return true;
    } });
  }

  /* =====================================================================
     SLASH / ARC
     ================================================================== */
  function slash(pos, dir, color, size, life) {
    size = size || 4; life = life || .2;
    var m = billboard(T.slash, color == null ? 0xffffff : color, 1);
    m.position.copy(pos);
    scene.add(m);
    var q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.clone().normalize());
    var roll = (Math.random() - .5) * 1.4;
    addFx({ t: life, update: function (dt) {
      this.t -= dt;
      var k = 1 - this.t / life;
      m.quaternion.copy(q);
      m.rotateZ(roll);
      /* sweeps open along its length, then wipes out */
      m.scale.set(size * (.5 + ease.out(k) * 1.1), size * (.5 + ease.out(k) * .8), 1);
      m.material.opacity = k < .12 ? 1 : Math.max(0, 1 - (k - .12) / .88);
      if (this.t <= 0) { kill(m); return false; }
      return true;
    } });
  }

  /* =====================================================================
     GROUND: dust, cracks, debris
     ================================================================== */
  function dust(pos, n, color, spread, size) {
    n = n || 8; spread = spread || 5; size = size || 3;
    color = color == null ? 0xcfd6e4 : color;
    for (var i = 0; i < n; i++) {
      var m = billboard(T.smoke, color, .5, false);
      var a = Math.random() * TAU;
      m.position.copy(pos).add(new THREE.Vector3(Math.cos(a) * Math.random() * 2, .2 + Math.random(), Math.sin(a) * Math.random() * 2));
      scene.add(m);
      (function (m, a) {
        var v = new THREE.Vector3(Math.cos(a), .25 + Math.random() * .5, Math.sin(a)).multiplyScalar(spread * (.5 + Math.random()));
        var life = .5 + Math.random() * .5, s0 = size * (.6 + Math.random() * .7);
        addFx({ t: life, update: function (dt) {
          this.t -= dt;
          var k = 1 - this.t / life;
          m.position.addScaledVector(v, dt);
          v.multiplyScalar(1 - dt * 1.9);
          faceCam(m, 0);
          m.scale.setScalar(s0 * (1 + k * 2.1));
          m.material.opacity = .5 * (1 - k) * (k < .12 ? k / .12 : 1);
          if (this.t <= 0) { kill(m); return false; }
          return true;
        } });
      })(m, a);
    }
  }

  /* dark fracture lines running away from a point of impact */
  function cracks(pos, n, len, color) {
    n = n || 7; len = len || 9;
    color = color == null ? 0x0a0d14 : color;
    for (var i = 0; i < n; i++) {
      var a = (i / n) * TAU + Math.random() * .4;
      var l = len * (.5 + Math.random() * .8);
      var m = new THREE.Mesh(PLANE, new THREE.MeshBasicMaterial({
        map: T.bolt, color: color, transparent: true, opacity: .8,
        depthWrite: false, side: THREE.DoubleSide, toneMapped: false
      }));
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = -a;
      m.position.set(pos.x + Math.cos(a) * l * .5, pos.y + .07, pos.z + Math.sin(a) * l * .5);
      /* a fracture is a line: the width stays hairline however long it runs */
      var w = .5 + Math.random() * .45;
      m.scale.set(.01, w, 1);
      m.renderOrder = 3;
      scene.add(m);
      (function (m, l) {
        var life = 1.3 + Math.random() * .7;
        addFx({ t: life, update: function (dt) {
          this.t -= dt;
          var k = 1 - this.t / life;
          m.scale.x = l * Math.min(1, k * 9);        // races outward
          m.material.opacity = .8 * Math.max(0, 1 - Math.max(0, k - .45) / .55);
          if (this.t <= 0) { kill(m); return false; }
          return true;
        } });
      })(m, l);
    }
  }

  function debris(pos, n, spd, color) {
    n = n || 10; spd = spd || 14;
    color = color == null ? 0x5c6473 : color;
    for (var i = 0; i < n; i++) {
      var s = .25 + Math.random() * .75;
      var m = new THREE.Mesh(CHUNK, new THREE.MeshStandardMaterial({ color: color, roughness: .9 }));
      m.scale.set(s, s * (.5 + Math.random()), s * (.6 + Math.random() * .8));
      m.position.copy(pos).add(new THREE.Vector3((Math.random() - .5) * 3, .4 + Math.random(), (Math.random() - .5) * 3));
      scene.add(m);
      (function (m) {
        var v = new THREE.Vector3((Math.random() - .5) * spd, spd * (.4 + Math.random() * .7), (Math.random() - .5) * spd);
        var av = new THREE.Vector3((Math.random() - .5) * 14, (Math.random() - .5) * 14, (Math.random() - .5) * 14);
        var life = 1.5 + Math.random();
        addFx({ t: life, update: function (dt) {
          this.t -= dt;
          v.y -= 30 * dt;
          m.position.addScaledVector(v, dt);
          m.rotation.x += av.x * dt; m.rotation.y += av.y * dt; m.rotation.z += av.z * dt;
          if (m.position.y < .25) { m.position.y = .25; v.y = Math.abs(v.y) * .3; v.x *= .6; v.z *= .6; }
          if (this.t < .5) { m.material.transparent = true; m.material.opacity = this.t / .5; }
          if (this.t <= 0) { kill(m); return false; }
          return true;
        } });
      })(m);
    }
  }

  /* A front travelling away from the caster. Three reads per step — one
     across the path, one facing the camera and one on the floor — because a
     ring across the path is edge on to whoever fired it. */
  function wave(from, dir, color, opt) {
    opt = opt || {};
    var steps = opt.steps || 5, gap = opt.gap || 34, reach = opt.reach || 5.5;
    for (var i = 0; i < steps; i++) {
      (function (i) {
        setTimeout(function () {
          var at = from.clone().addScaledVector(dir, (opt.start || 4) + i * reach);
          var r = (opt.r0 || 8) + i * (opt.grow || 2.4);
          ring(at, color, { maxR: r, life: .42, ground: false });
          ring(new THREE.Vector3(at.x, .1, at.z), color, { maxR: r * 1.15, life: .5 });
          ring(at, color, { maxR: r * .78, life: .36, axis: dir, opacity: .85 });
          streaks(at, color, 4, 17, 1.3);
        }, i * gap);
      })(i);
    }
  }

  /* the whole ground reaction to something heavy landing */
  function shockwave(pos, color, power) {
    power = power || 1;
    rings(pos, color, 3, { maxR: 9 * power, life: .5, gap: 50, ground: true });
    ring(pos.clone().add(new THREE.Vector3(0, 1.2, 0)), 0xffffff,
      { maxR: 5 * power, life: .3, ground: false });
    dust(pos, Math.round(7 * power), 0xd7dde8, 6 * power, 3 * power);
    cracks(pos, Math.round(6 * power), 7 * power);
    debris(pos, Math.round(7 * power), 12 * power);
    addShake(.3 * power);
  }

  /* =====================================================================
     BEAM
     A hot white core inside a coloured sheath, with rings running along it
     and a flare at each end. Fires in three frames, holds, then wipes.
     ================================================================== */
  function beam(from, dir, len, color, opt) {
    opt = opt || {};
    var radius = opt.radius || 2.2;
    var life = opt.life || .75;
    var d = dir.clone().normalize();
    var q = new THREE.Quaternion().setFromUnitVectors(UP, d);
    var mid = from.clone().addScaledVector(d, len / 2);

    function tube(r, col, op) {
      var m = new THREE.Mesh(CYL, new THREE.MeshBasicMaterial({
        color: col, transparent: true, opacity: op, blending: THREE.AdditiveBlending,
        depthWrite: false, side: THREE.DoubleSide, toneMapped: false
      }));
      m.quaternion.copy(q);
      m.position.copy(mid);
      m.renderOrder = 7;
      scene.add(m);
      return m;
    }
    var outer = tube(radius, color, .5);
    var midT = tube(radius * .62, color, .75);
    var core = tube(radius * .26, 0xffffff, 1);

    /* rings sliding down the barrel sell direction and speed */
    var travel = [];
    for (var i = 0; i < 5; i++) {
      var rg = billboard(T.ring, color, .85);
      rg.quaternion.copy(q);
      rg.rotateX(Math.PI / 2);
      scene.add(rg);
      travel.push({ m: rg, p: i / 5 });
    }

    var head = billboard(T.star, 0xffffff, 1);
    head.position.copy(from).addScaledVector(d, len);
    scene.add(head);
    var muzzle = billboard(T.spokes, color, 1);
    muzzle.position.copy(from);
    scene.add(muzzle);

    addFx({ t: life, update: function (dt) {
      this.t -= dt;
      var k = 1 - this.t / life;
      var open = Math.min(1, k / .10);                 // three frames to full
      var fade = k > .62 ? 1 - (k - .62) / .38 : 1;
      var flick = .88 + Math.random() * .12;
      var L = len * open;
      var c = from.clone().addScaledVector(d, L / 2);

      [[outer, radius, .5], [midT, radius * .62, .75], [core, radius * .26, 1]].forEach(function (e) {
        e[0].position.copy(c);
        e[0].scale.set(e[1] * (1 + (1 - open) * .6) * flick, L, e[1] * (1 + (1 - open) * .6) * flick);
        e[0].material.opacity = e[2] * fade * flick;
      });

      for (var j = 0; j < travel.length; j++) {
        var tr = travel[j];
        tr.p += dt * 2.6;
        if (tr.p > 1) tr.p -= 1;
        tr.m.position.copy(from).addScaledVector(d, tr.p * L);
        var s = radius * (1.5 + Math.sin(tr.p * 8) * .25);
        tr.m.scale.set(s, s, 1);
        tr.m.material.opacity = .85 * fade * (1 - Math.abs(tr.p - .5) * .6);
      }

      head.position.copy(from).addScaledVector(d, L);
      faceCam(head, k * 3);
      head.scale.setScalar(radius * (3.4 + Math.sin(k * 40) * .5));
      head.material.opacity = fade;

      faceCam(muzzle, -k * 2);
      muzzle.scale.setScalar(radius * (3 + open * 2));
      muzzle.material.opacity = .9 * fade;

      if (this.t <= 0) {
        kill(outer); kill(midT); kill(core); kill(head); kill(muzzle);
        travel.forEach(function (tr) { kill(tr.m); });
        return false;
      }
      return true;
    } });
  }

  /* =====================================================================
     ORB — a gathering point of energy that can be carried around
     A hot core, a rim that breathes, and motes falling into it. Used for
     charge-ups; it never simply scales up.
     ================================================================== */
  function orb(color, r) {
    var g = new THREE.Group();
    var core = new THREE.Mesh(SPHERE, new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: .95, blending: THREE.AdditiveBlending,
      depthWrite: false, toneMapped: false
    }));
    core.scale.setScalar(r * .45);
    var shell = new THREE.Mesh(SPHERE, new THREE.MeshBasicMaterial({
      color: color, transparent: true, opacity: .42, blending: THREE.AdditiveBlending,
      depthWrite: false, side: THREE.BackSide, toneMapped: false
    }));
    shell.scale.setScalar(r);
    var halo = billboard(T.star, color, .8);
    halo.scale.setScalar(r * 4);
    g.add(core, shell, halo);
    g.renderOrder = 6;
    scene.add(g);
    var light = takeLight(color, r * 22);

    var t = 0;
    return {
      group: g,
      set: function (p) { g.position.copy(p); },
      grow: function (mul) { r *= mul; },
      step: function (dt, energy) {
        t += dt;
        energy = energy == null ? 1 : energy;
        var pulse = 1 + Math.sin(t * 22) * .07;
        core.scale.setScalar(r * .45 * pulse * energy);
        shell.scale.setScalar(r * (1 + Math.sin(t * 13) * .05) * energy);
        faceCam(halo, t * .8);
        halo.scale.setScalar(r * 4 * energy * (1 + Math.sin(t * 17) * .09));
        if (light) { light.position.copy(g.position); light.intensity = 2.4 * energy; }
        if (Math.random() < .55) mote(g.position, color, r * 3.4, .28);
      },
      flash: function () { faceCam(halo, 0); },
      dispose: function () {
        scene.remove(g);
        dropLight(light);
        core.material.dispose(); shell.material.dispose(); halo.material.dispose();
      }
    };
  }

  /* one speck of cursed energy falling inward */
  function mote(center, color, radius, life) {
    var m = billboard(T.streak, color, 1);
    var a = Math.random() * TAU, el = (Math.random() - .5) * Math.PI;
    var start = center.clone().add(new THREE.Vector3(
      Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el)).multiplyScalar(radius));
    m.position.copy(start);
    scene.add(m);
    var total = life || .3;
    addFx({ t: total, update: function (dt) {
      this.t -= dt;
      var k = 1 - this.t / total;
      m.position.lerpVectors(start, center, ease.in(k));
      var dirV = center.clone().sub(m.position);
      m.quaternion.copy(camera.quaternion);
      var local = m.worldToLocal(m.position.clone().add(dirV));
      m.rotateZ(Math.atan2(local.y, local.x));
      m.scale.set(.9 + k * .7, .16, 1);
      m.material.opacity = Math.sin(k * Math.PI);
      if (this.t <= 0) { kill(m); return false; }
      return true;
    } });
  }

  /* a burst of motes converging on a point — a charge you can see coming */
  function converge(center, color, n, radius, life) {
    for (var i = 0; i < (n || 14); i++) mote(center, color, radius || 6, life || .35);
  }

  /* =====================================================================
     AURA — cursed energy standing off a fighter, for as long as they hold it
     ================================================================== */
  function aura(getPos, color, opt) {
    opt = opt || {};
    var alive = true, t = 0, acc = 0;
    var column = billboard(T.smoke, color, .30);
    column.scale.set(4.4, 7.4, 1);
    scene.add(column);
    var base = billboard(T.ring, color, .55);
    base.rotation.x = -Math.PI / 2;
    base.scale.set(6, 6, 1);
    scene.add(base);
    var light = takeLight(color, 26);

    addFx({ t: 1, update: function (dt) {
      if (!alive) {
        kill(column); kill(base); dropLight(light);
        return false;
      }
      t += dt;
      var p = getPos();
      if (!p) return true;
      column.position.set(p.x, p.y + 3.3, p.z);
      faceCam(column, 0);
      column.scale.set(4.4 + Math.sin(t * 7) * .5, 7.4 + Math.sin(t * 5.5) * .8, 1);
      column.material.opacity = .22 + Math.sin(t * 9) * .07;
      base.position.set(p.x, p.y + .08, p.z);
      var s = 6 + Math.sin(t * 6) * .5;
      base.scale.set(s, s, 1);
      base.material.opacity = .45 + Math.sin(t * 8) * .12;
      if (light) {
        light.position.set(p.x, p.y + 3, p.z);
        light.intensity = 1.6 + Math.sin(t * 12) * .4;
      }
      /* embers rising off them, the standing sign of a raised output */
      acc += dt;
      if (acc > (opt.gap || .055)) {
        acc = 0;
        var m = billboard(T.streak, color, 1);
        var a = Math.random() * TAU, rr = Math.random() * 1.9;
        m.position.set(p.x + Math.cos(a) * rr, p.y + Math.random() * 1.2, p.z + Math.sin(a) * rr);
        scene.add(m);
        (function (m) {
          var life = .55 + Math.random() * .4, up = 5 + Math.random() * 5;
          addFx({ t: life, update: function (dt2) {
            this.t -= dt2;
            var k2 = 1 - this.t / life;
            m.position.y += up * dt2;
            faceCam(m, Math.PI / 2);
            m.scale.set(.5 + k2 * .8, .17, 1);
            m.material.opacity = Math.sin(k2 * Math.PI) * .95;
            if (this.t <= 0) { kill(m); return false; }
            return true;
          } });
        })(m);
      }
      return true;
    } });

    return { stop: function () { alive = false; } };
  }

  /* =====================================================================
     DOMAIN — a sky that snaps shut over the arena
     ================================================================== */
  function dome(pos, radius, color, life, opt) {
    opt = opt || {};
    var inner = new THREE.Mesh(SPHERE, new THREE.MeshBasicMaterial({
      map: T.void, color: color, transparent: true, opacity: 0,
      side: THREE.BackSide, depthWrite: false, toneMapped: false
    }));
    inner.material.map = T.void.clone();
    inner.material.map.wrapS = inner.material.map.wrapT = THREE.RepeatWrapping;
    inner.material.map.repeat.set(3, 2);
    inner.material.map.needsUpdate = true;
    inner.position.copy(pos);
    inner.renderOrder = 1;
    scene.add(inner);

    var rim = billboard(T.ring, 0xffffff, 1);
    rim.rotation.x = -Math.PI / 2;
    rim.position.set(pos.x, pos.y + .1, pos.z);
    scene.add(rim);

    var t = 0, total = life || 6;
    addFx({ t: total, update: function (dt) {
      this.t -= dt;
      t += dt;
      /* the snap: full size in a fifth of a second, with a rim wave that
         outruns it, then it just hangs there being infinite */
      var open = Math.min(1, t / .22);
      var s = radius * (ease.pop(open) * 1.04 - (open === 1 ? .04 : 0));
      inner.scale.setScalar(Math.max(.1, s));
      inner.material.opacity = Math.min(.94, open * .94) * (this.t < .8 ? this.t / .8 : 1);
      inner.material.map.offset.x += dt * .012;
      inner.material.map.offset.y -= dt * .006;
      inner.rotation.y += dt * .05;

      var rs = radius * ease.outQ(Math.min(1, t / .45)) * 1.25;
      rim.scale.set(rs, rs, 1);
      rim.material.opacity = Math.max(0, 1 - t / .45);

      if (this.t <= 0) {
        kill(inner); kill(rim);
        return false;
      }
      return true;
    } });
  }

  /* =====================================================================
     SCREEN — flashes, manga lines, letterbox, lens punch
     ================================================================== */
  var layer = null;
  function screenLayer() {
    if (layer) return layer;
    var css = document.createElement('style');
    css.textContent = [
      '#jjfx{position:fixed;inset:0;z-index:14;pointer-events:none;overflow:hidden}',
      '#jjfxFlash{position:absolute;inset:0;background:#fff;opacity:0}',
      '#jjfxLines{position:absolute;inset:-30%;opacity:0;transition:opacity .12s;',
      '  background:repeating-conic-gradient(from 0deg at 50% 50%,',
      '    rgba(255,255,255,.85) 0deg .35deg, rgba(255,255,255,0) .35deg 2.6deg);',
      '  -webkit-mask-image:radial-gradient(circle at 50% 50%, transparent 26%, #000 72%);',
      '  mask-image:radial-gradient(circle at 50% 50%, transparent 26%, #000 72%);}',
      '#jjfxBars{position:absolute;inset:0}',
      '#jjfxBars i{position:absolute;left:0;right:0;height:0;background:#05070d;',
      '  transition:height .28s cubic-bezier(.2,.9,.2,1)}',
      '#jjfxBars i.top{top:0} #jjfxBars i.bot{bottom:0}',
      '#jjfx.bars i{height:11.5vh}',
      '#jjfxTint{position:absolute;inset:0;opacity:0;transition:opacity .3s;mix-blend-mode:screen}'
    ].join('');
    document.head.appendChild(css);
    layer = document.createElement('div');
    layer.id = 'jjfx';
    layer.innerHTML = '<div id="jjfxTint"></div><div id="jjfxLines"></div>' +
      '<div id="jjfxFlash"></div><div id="jjfxBars"><i class="top"></i><i class="bot"></i></div>';
    document.body.appendChild(layer);
    return layer;
  }

  function flash(color, alpha, dur) {
    screenLayer();
    var f = document.getElementById('jjfxFlash');
    f.style.background = color || '#fff';
    f.style.transition = 'none';
    f.style.opacity = String(alpha == null ? .9 : alpha);
    setTimeout(function () {
      f.style.transition = 'opacity ' + (dur || .25) + 's';
      f.style.opacity = '0';
    }, 24);
  }

  function mangaLines(on, dur) {
    screenLayer();
    var l = document.getElementById('jjfxLines');
    l.style.opacity = on ? '.5' : '0';
    if (on && dur) setTimeout(function () { l.style.opacity = '0'; }, dur * 1000);
  }

  function tint(color, alpha, dur) {
    screenLayer();
    var el = document.getElementById('jjfxTint');
    el.style.background = color;
    el.style.opacity = String(alpha);
    if (dur) setTimeout(function () { el.style.opacity = '0'; }, dur * 1000);
  }

  function letterbox(on) {
    screenLayer().classList.toggle('bars', !!on);
  }

  /* a short punch of focal length — the camera flinching with the hit */
  var fovBase = null, fovT = 0, fovAmt = 0, fovDur = .01;
  function zoom(amount, dur) {
    if (fovBase == null) fovBase = camera.fov;
    fovAmt = amount; fovDur = dur || .35; fovT = fovDur;
  }
  function stepZoom(dt) {
    if (fovBase == null || fovT <= 0) return;
    fovT = Math.max(0, fovT - dt);
    var k = fovT / fovDur;
    camera.fov = fovBase + fovAmt * Math.sin(k * Math.PI);
    camera.updateProjectionMatrix();
    if (fovT === 0) { camera.fov = fovBase; camera.updateProjectionMatrix(); }
  }

  /* the kit runs its own screen level animation off the render loop */
  var _upd = updateCamera;
  updateCamera = function (dt) {
    var r = _upd.call(this, dt);
    stepZoom(dt);
    return r;
  };

  /* =====================================================================
     COMPOSITES used by more than one move
     ================================================================== */

  /* a body being hit hard: flash frame, cross, spokes, ring, dust */
  function heavyHit(pos, color, power) {
    power = power || 1;
    /* the white cross is the frame a heavy hit gets; a jab does not earn it */
    if (power >= .95) cross(pos, 0xffffff, 2.6 * power, .2);
    impact(pos, color, 1.1 * power);
    ring(pos.clone(), color, { maxR: 5.5 * power, life: .34, ground: false });
    dust(new THREE.Vector3(pos.x, 0, pos.z), 4, 0xd7dde8, 4, 2);
    addShake(.32 * power);
    if (typeof hitstop === 'function') hitstop(.05 * power);
  }

  /* afterimages left behind by something moving faster than the eye */
  function trail(rig, color, n, gap, alpha) {
    for (var i = 0; i < (n || 3); i++) {
      (function (i) {
        setTimeout(function () {
          try { ghostAfterimage(rig, color, alpha == null ? .42 : alpha); } catch (e) {}
        }, i * (gap || 55));
      })(i);
    }
  }

  window.JJFX = {
    T: T, tex: T,
    impact: impact, cross: cross, streaks: streaks,
    ring: ring, rings: rings, speedRing: speedRing, slash: slash, wave: wave,
    dust: dust, cracks: cracks, debris: debris, shockwave: shockwave,
    beam: beam, orb: orb, mote: mote, converge: converge,
    aura: aura, dome: dome,
    flash: flash, mangaLines: mangaLines, letterbox: letterbox, tint: tint, zoom: zoom,
    heavyHit: heavyHit, trail: trail,
    billboard: billboard, faceCam: faceCam, ease: ease
  };
})();
