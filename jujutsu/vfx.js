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

  /* a cut: a straight line with a hot core, tapered at both ends, which is
     what a slash actually leaves behind — a crescent is the swing, this is
     the wound */
  T.cutline = (function () {
    var c = canvas(256), g = c.getContext('2d');
    var grad = g.createLinearGradient(0, 0, 256, 0);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(.12, 'rgba(255,255,255,.55)');
    grad.addColorStop(.5, 'rgba(255,255,255,1)');
    grad.addColorStop(.88, 'rgba(255,255,255,.55)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    /* a lens rather than a bar: fat in the middle, nothing at the tips */
    g.beginPath();
    g.moveTo(0, 128);
    g.quadraticCurveTo(128, 128 - 62, 256, 128);
    g.quadraticCurveTo(128, 128 + 62, 0, 128);
    g.fill();
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = grad;
    g.fillRect(0, 122, 256, 12);
    return tex(c);
  })();

  /* a flame: a tongue of fire with licks coming off it, drawn pointing up */
  T.flame = (function () {
    var c = canvas(256), g = c.getContext('2d');
    function tongue(x, w, h, alpha) {
      var grad = g.createLinearGradient(0, 256 - h, 0, 256);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(.35, 'rgba(255,255,255,' + alpha * .55 + ')');
      grad.addColorStop(.8, 'rgba(255,255,255,' + alpha + ')');
      grad.addColorStop(1, 'rgba(255,255,255,' + alpha * .7 + ')');
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(x, 256 - h);
      g.bezierCurveTo(x + w, 256 - h * .55, x - w * .4, 256 - h * .3, x + w * .9, 250);
      g.lineTo(x - w * .9, 250);
      g.bezierCurveTo(x + w * .4, 256 - h * .3, x - w, 256 - h * .55, x, 256 - h);
      g.fill();
    }
    tongue(128, 62, 236, .95);
    tongue(84, 30, 150, .6);
    tongue(176, 26, 132, .6);
    tongue(112, 16, 96, .5);
    return tex(c);
  })();

  /* blood: a splatter of drops around a wet centre, for the ground and for
     the hole a cut leaves */
  T.blood = (function () {
    var c = canvas(256), g = c.getContext('2d');
    var i, a, d, r;
    var core = g.createRadialGradient(128, 128, 4, 128, 128, 52);
    core.addColorStop(0, 'rgba(255,255,255,.95)');
    core.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = core;
    g.beginPath(); g.arc(128, 128, 52, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,.85)';
    for (i = 0; i < 34; i++) {
      a = Math.random() * TAU;
      d = 24 + Math.random() * 104;
      r = 2 + Math.random() * 9 * (1 - d / 150);
      g.beginPath();
      g.ellipse(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, r, r * (.5 + Math.random()), a, 0, TAU);
      g.fill();
    }
    return tex(c);
  })();

  /* Two textures the blood kit needs that the light kit does not.

     Every other ring in here is T.ring, which is a soft filled disc that
     happens to be brightest at its edge. Additive blending hides that:
     the dim middle adds almost nothing. Normal blending does not — the
     middle covers what is behind it, and a big ring becomes a red bubble
     over half the arena. So blood gets a real annulus, empty inside.

     T.splat is the same argument for impacts: no filled core, only the
     blobs, so a splatter is a splatter and not a disc. */
  T.bloodRing = (function () {
    var c = canvas(256), g = c.getContext('2d'), h = 128;
    var grad = g.createRadialGradient(h, h, h * .80, h, h, h);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(.55, 'rgba(255,255,255,.85)');
    grad.addColorStop(.82, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.beginPath(); g.arc(h, h, h, 0, TAU); g.fill();
    /* broken up, because fluid does not throw a clean circle */
    g.globalCompositeOperation = 'destination-out';
    for (var i = 0; i < 26; i++) {
      var a = Math.random() * TAU, d = h * (.82 + Math.random() * .16);
      g.beginPath();
      g.arc(h + Math.cos(a) * d, h + Math.sin(a) * d, 4 + Math.random() * 13, 0, TAU);
      g.fill();
    }
    return tex(c);
  })();

  T.splat = (function () {
    var c = canvas(256), g = c.getContext('2d'), i, a, d, r;
    g.fillStyle = 'rgba(255,255,255,1)';
    /* a ragged middle rather than a round one */
    g.beginPath();
    for (i = 0; i <= 26; i++) {
      a = i / 26 * TAU;
      r = 26 + Math.random() * 20;
      g[i ? 'lineTo' : 'moveTo'](128 + Math.cos(a) * r, 128 + Math.sin(a) * r);
    }
    g.closePath(); g.fill();
    /* and the thrown drops around it */
    for (i = 0; i < 46; i++) {
      a = Math.random() * TAU;
      d = 46 + Math.random() * 82;
      r = 2 + Math.random() * 10 * (1 - d / 150);
      g.globalAlpha = .5 + Math.random() * .5;
      g.beginPath();
      g.ellipse(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, r, r * (.45 + Math.random()), a, 0, TAU);
      g.fill();
    }
    g.globalAlpha = 1;
    return tex(c);
  })();

  /* the shell of a domain: latitudes, longitudes and the seams between
     them, so a transparent sphere reads as a sphere from any angle rather
     than as a wash of colour over half the screen */
  T.shell = (function () {
    var c = canvas(512), g = c.getContext('2d'), i;
    g.lineCap = 'round';
    for (i = 1; i < 16; i++) {                       // latitudes
      var y = i / 16 * 512;
      var edge = Math.abs(i / 16 - .5) * 2;          // brighter at the poles
      g.strokeStyle = 'rgba(255,255,255,' + (.16 + edge * .3) + ')';
      g.lineWidth = i % 4 === 0 ? 3.4 : 1.4;
      g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke();
    }
    for (i = 0; i < 24; i++) {                       // longitudes
      var x = i / 24 * 512;
      g.strokeStyle = 'rgba(255,255,255,' + (i % 3 === 0 ? .34 : .14) + ')';
      g.lineWidth = i % 3 === 0 ? 3 : 1.2;
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 512); g.stroke();
    }
    /* and the panelling between them, so it is a made thing */
    for (i = 0; i < 90; i++) {
      g.fillStyle = 'rgba(255,255,255,' + (.02 + Math.random() * .05) + ')';
      var px = Math.random() * 512, py = Math.random() * 512;
      g.fillRect(px, py, 20 + Math.random() * 40, 14 + Math.random() * 26);
    }
    var t = tex(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  })();

  /* THE FRACTURE WEB
     Ground that has been hit does not crack in straight lines out of a
     point. It splits along a few main faults, each of which sheds branches
     that shed their own, and the surface between them breaks into plates.
     Four are drawn at load and picked between, so putting one down costs a
     single quad instead of fifty. */
  var WEBS = (function () {
    function split(g, x, y, a, len, w, depth) {
      var steps = 4 + (Math.random() * 3 | 0);
      for (var i = 0; i < steps; i++) {
        var nx = x + Math.cos(a) * len / steps;
        var ny = y + Math.sin(a) * len / steps;
        /* the crumbled lip either side of the split, then the split */
        g.strokeStyle = 'rgba(255,255,255,.16)';
        g.lineWidth = w * 3.6;
        g.beginPath(); g.moveTo(x, y); g.lineTo(nx, ny); g.stroke();
        g.strokeStyle = 'rgba(255,255,255,' + (.72 + Math.random() * .28) + ')';
        g.lineWidth = w;
        g.beginPath(); g.moveTo(x, y); g.lineTo(nx, ny); g.stroke();
        x = nx; y = ny;
        a += (Math.random() - .5) * .95;
        w *= .84;
        if (depth < 3 && Math.random() < .45) {
          split(g, x, y, a + (Math.random() < .5 ? 1 : -1) * (.55 + Math.random() * .8),
            len * (.3 + Math.random() * .35), w * .85, depth + 1);
        }
      }
    }
    var out = [], v, i, a;
    for (v = 0; v < 4; v++) {
      var c = canvas(512), g = c.getContext('2d');
      g.lineCap = 'round'; g.lineJoin = 'round';
      /* the plates the surface has broken into, right under the hit */
      for (i = 0; i < 9; i++) {
        a = i / 9 * TAU;
        var rr = 26 + Math.random() * 62;
        g.fillStyle = 'rgba(255,255,255,.10)';
        g.beginPath();
        for (var k = 0; k < 5; k++) {
          var pa = a + k / 5 * 1.3, pr = rr * (.5 + Math.random() * .8);
          var px = 256 + Math.cos(pa) * pr, py = 256 + Math.sin(pa) * pr;
          if (k === 0) g.moveTo(px, py); else g.lineTo(px, py);
        }
        g.closePath(); g.fill();
      }
      var mains = 7 + (v % 3);
      for (i = 0; i < mains; i++) {
        a = i / mains * TAU + Math.random() * .55;
        split(g, 256, 256, a, 116 + Math.random() * 118, 6.5 - Math.random() * 2.6, 0);
      }
      out.push(tex(c));
    }
    return out;
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

    /* the flash frame, which is white for light and the hit's own colour
       for anything dark enough that white would be the only bright thing
       left on the screen */
    var dark = isDark(color);
    var star = billboard(T.star, dark ? color : 0xffffff, dark ? .75 : 1);
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
      star.material.opacity = (dark ? .75 : 1) * (k < .18 ? 1 : Math.max(0, 1 - (k - .18) / .82));
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

  /* a flat decal laid on the ground, which opens up and then fades */
  function decal(map, pos, r, color, alpha, life, spin) {
    var m = new THREE.Mesh(PLANE, new THREE.MeshBasicMaterial({
      map: map, color: color, transparent: true, opacity: 0,
      depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
      blending: THREE.NormalBlending
    }));
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = spin == null ? Math.random() * TAU : spin;
    m.position.set(pos.x, (pos.y || 0) + .06 + Math.random() * .03, pos.z);
    m.renderOrder = 3;
    m.scale.set(r * 2, r * 2, 1);
    scene.add(m);
    live++;
    /* timed in seconds rather than in fractions of the life, so a mark
       meant to stay — a scorch, a pool of blood — is not permanently
       three frames into its own fade in */
    var t = 0, out = Math.min(1.4, life * .45);
    addFx({ t: life, update: function (dt) {
      this.t -= dt; t += dt;
      var open = Math.min(1, t / .1);                 // splits open in two frames
      m.scale.set(r * 2 * (.35 + open * .65), r * 2 * (.35 + open * .65), 1);
      m.material.opacity = alpha * Math.min(1, t / .07) * Math.min(1, this.t / out);
      if (this.t <= 0) { kill(m); live--; return false; }
      return true;
    } });
    return m;
  }

  /* how many ground decals are in the air right now: a busy domain would
     otherwise put a thousand quads down and the frame rate with them */
  var live = 0;

  /* GROUND BREAKING UNDER SOMETHING
     The web of fractures, a dark gap opening along it, plates of the
     surface tipped up out of the gap, and the dust it throws. */
  /* `grit` tints the pale half of the break — the crumbled lip of the
     fissure and the dust off it. It defaults to concrete, which is right
     for a punch through a road and wrong under an effect that has gone
     out of its way to be dark: pale blue-grey haze under dark red blood
     is the one bright thing left in the frame. */
  function cracks(pos, n, len, color, grit) {
    n = n || 7; len = len || 9;
    color = color == null ? 0x0a0d14 : color;
    var lip = grit == null ? 0x9aa3b2 : grit;
    var haze = grit == null ? 0xbcc3d0 : grit;
    var R = len * 1.1, i;
    var busy = live > 80;

    /* the fissure, and a paler one just off it — the crumbled edge of the
       break catching the light, which is what gives it depth */
    var w0 = (Math.random() * WEBS.length) | 0;
    var spin = Math.random() * TAU;
    decal(WEBS[w0], pos, R, color, .92, 2.4 + Math.random() * 1.2, spin);
    if (!busy) {
      decal(WEBS[(w0 + 1) % WEBS.length], pos, R * 1.16, lip, .3,
        2.0 + Math.random(), spin + .3);
    }

    /* a couple of faults running much further than the web does */
    var spikes = busy ? 0 : Math.min(4, 1 + (n / 3 | 0));
    for (i = 0; i < spikes; i++) {
      var a = Math.random() * TAU;
      var l = len * (1.1 + Math.random() * 1.1);
      var m = new THREE.Mesh(PLANE, new THREE.MeshBasicMaterial({
        map: T.bolt, color: color, transparent: true, opacity: .85,
        depthWrite: false, side: THREE.DoubleSide, toneMapped: false
      }));
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = -a;
      m.position.set(pos.x + Math.cos(a) * l * .5, (pos.y || 0) + .07, pos.z + Math.sin(a) * l * .5);
      m.scale.set(.01, .35 + Math.random() * .3, 1);
      m.renderOrder = 3;
      scene.add(m);
      live++;
      (function (m, l) {
        var life = 1.8 + Math.random() * .8;
        addFx({ t: life, update: function (dt) {
          this.t -= dt;
          var k = 1 - this.t / life;
          m.scale.x = l * Math.min(1, k * 11);       // races outward
          m.material.opacity = .85 * Math.max(0, 1 - Math.max(0, k - .5) / .5);
          if (this.t <= 0) { kill(m); live--; return false; }
          return true;
        } });
      })(m, l);
    }

    if (!busy) plates(pos, Math.min(5, 2 + (n / 2 | 0)), len);
    dust(new THREE.Vector3(pos.x, (pos.y || 0), pos.z), Math.min(6, 2 + (n / 3 | 0)), haze, len * .5, 2.2);
  }

  /* slabs of the surface levered up out of the break and left standing */
  function plates(pos, n, len) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * TAU;
      var d = len * (.2 + Math.random() * .5);
      var w = len * (.18 + Math.random() * .28);
      var m = new THREE.Mesh(CHUNK, new THREE.MeshStandardMaterial({ color: 0x3d4351, roughness: .95 }));
      m.scale.set(w, .22 + Math.random() * .2, w * (.6 + Math.random() * .7));
      m.position.set(pos.x + Math.cos(a) * d, (pos.y || 0) - .1, pos.z + Math.sin(a) * d);
      m.rotation.y = Math.random() * TAU;
      m.castShadow = true;
      scene.add(m);
      live++;
      (function (m, a) {
        var life = 3.4 + Math.random() * 2;
        var tilt = (.2 + Math.random() * .5) * (Math.random() < .5 ? 1 : -1);
        var rise = .12 + Math.random() * .34, t = 0;
        addFx({ t: life, update: function (dt) {
          this.t -= dt; t += dt;
          var k = Math.min(1, t / .22);              // levered up in two frames
          m.position.y = -.1 + rise * ease.out(k);
          m.rotation.z = tilt * ease.out(k) * Math.cos(a);
          m.rotation.x = tilt * ease.out(k) * Math.sin(a);
          if (this.t < .8) {
            m.material.transparent = true;
            m.material.opacity = this.t / .8;
            m.position.y -= dt * .5;                 // settles back into the ground
          }
          if (this.t <= 0) { scene.remove(m); m.material.dispose(); live--; return false; }
          return true;
        } });
      })(m, a);
    }
  }

  /* =====================================================================
     THE CUT
     A slash leaves a line, not a ball. This is that line: a quad held
     between two points and turned edge-on to nobody, so it reads from
     every angle, with a hot core that arrives on one frame.
     ================================================================== */
  var _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3(),
    _mid = new THREE.Vector3(), _mat = new THREE.Matrix4();
  function orientAlong(m, from, to) {
    _x.subVectors(to, from);
    var len = _x.length() || .001;
    _x.multiplyScalar(1 / len);
    _mid.addVectors(from, to).multiplyScalar(.5);
    _z.subVectors(camera.position, _mid).normalize();
    _y.crossVectors(_z, _x);
    if (_y.lengthSq() < 1e-6) _y.set(0, 1, 0);
    _y.normalize();
    _z.crossVectors(_x, _y).normalize();
    _mat.makeBasis(_x, _y, _z);
    m.quaternion.setFromRotationMatrix(_mat);
    m.position.copy(_mid);
    return len;
  }

  /* one cut, drawn between two points in the world */
  function cutLine(from, to, color, width, life, opt) {
    opt = opt || {};
    life = life || .28;
    var m = billboard(T.cutline, color == null ? 0xffffff : color, 1);
    m.renderOrder = 7;
    scene.add(m);
    var w = width || .5, t = 0, grow = opt.grow == null ? 1 : opt.grow;
    var a = from.clone(), b = to.clone();
    addFx({ t: life, update: function (dt) {
      this.t -= dt; t += dt;
      var k = Math.min(1, t / life);
      /* it is drawn on in the first frames, then thins out and goes */
      var draw = Math.min(1, k / .18);
      var end = a.clone().lerp(b, grow ? ease.out(draw) : 1);
      var len = orientAlong(m, a, end);
      m.scale.set(len, w * (1 - k * .55), 1);
      m.material.opacity = k < .2 ? 1 : Math.max(0, 1 - (k - .2) / .8);
      if (this.t <= 0) { kill(m); return false; }
      return true;
    } });
    return m;
  }

  /* the lattice: Dismantle is not one cut, it is a net of them woven
     across everything in front of you, and what is caught in it comes
     apart along the lines */
  function lattice(center, dir, w, h, cols, rows, color, opt) {
    opt = opt || {};
    var side = new THREE.Vector3(dir.z, 0, -dir.x).normalize();
    var up = new THREE.Vector3(0, 1, 0);
    var stagger = opt.stagger == null ? 26 : opt.stagger;
    var life = opt.life || .5;
    var width = opt.width || .34;
    var out = [], i;
    function line(from, to, n) {
      if (stagger <= 0) { cutLine(from, to, color, width, life, opt); return; }
      setTimeout(function () {
        if (typeof scene === 'undefined') return;
        cutLine(from, to, color, width, life, opt);
        if (opt.spark !== false && Math.random() < .5) streaks(from.clone().lerp(to, Math.random()), color, 1, 6, .8);
      }, n * stagger);
    }
    for (i = 0; i <= cols; i++) {                    // the uprights
      var x = (i / cols - .5) * w;
      var base = center.clone().addScaledVector(side, x);
      line(base.clone().addScaledVector(up, -h / 2), base.clone().addScaledVector(up, h / 2), i);
    }
    for (i = 0; i <= rows; i++) {                    // and the crossings
      var y = (i / rows - .5) * h;
      var b2 = center.clone().addScaledVector(up, y);
      line(b2.clone().addScaledVector(side, -w / 2), b2.clone().addScaledVector(side, w / 2), cols + 1 + i);
    }
    return out;
  }

  /* =====================================================================
     FIRE
     ================================================================== */
  function flame(pos, size, life, color, rise) {
    var m = billboard(T.flame, color == null ? 0xff8a2a : color, .95);
    m.position.copy(pos);
    m.renderOrder = 7;
    scene.add(m);
    var t = 0, wob = Math.random() * TAU, up = rise == null ? 3.2 : rise;
    var drift = new THREE.Vector3((Math.random() - .5) * 1.4, 0, (Math.random() - .5) * 1.4);
    life = life || .6;
    addFx({ t: life, update: function (dt) {
      this.t -= dt; t += dt;
      var k = t / life;
      m.position.y += up * dt * (1 - k * .5);
      m.position.addScaledVector(drift, dt);
      faceCam(m, 0);
      var flick = 1 + Math.sin(t * 26 + wob) * .16;
      m.scale.set(size * (.7 + k * .5) * flick, size * (1.35 - k * .45), 1);
      /* fire goes from white hot through orange to smoke */
      m.material.color.setHSL(.09 - k * .05, 1, Math.max(.16, .72 - k * .55));
      m.material.opacity = .95 * Math.max(0, 1 - Math.pow(k, 2));
      if (this.t <= 0) { kill(m); return false; }
      return true;
    } });
    return m;
  }

  /* a body of fire: tongues, embers and the smoke off the top of it */
  function fire(pos, n, radius, size, life) {
    n = n || 8; radius = radius || 1.4; size = size || 2.4;
    for (var i = 0; i < n; i++) {
      var a = Math.random() * TAU, d = Math.random() * radius;
      flame(pos.clone().add(new THREE.Vector3(Math.cos(a) * d, Math.random() * radius * .5, Math.sin(a) * d)),
        size * (.6 + Math.random() * .8), (life || .7) * (.7 + Math.random() * .7));
    }
    streaks(pos.clone(), 0xffc46a, Math.max(2, n / 2 | 0), 10, 1);
    dust(new THREE.Vector3(pos.x, pos.y + radius, pos.z), Math.max(2, n / 3 | 0), 0x2a2026, radius * 2, size);
  }

  /* what fire leaves on the ground */
  function scorch(pos, r, life) {
    return decal(WEBS[(Math.random() * WEBS.length) | 0], pos, r, 0x140a08, .8, life || 14);
  }

  /* =====================================================================
     THE BARRIER
     A domain seen from outside it. Every domain but one closes a space
     off, and the thing that does the closing is a sphere sitting in the
     street — so from out here that is what it looks like, for as long as
     it is up, rather than a puff of rings and nothing.
     ================================================================== */
  function barrier(pos, radius, color, life, opt) {
    opt = opt || {};
    var g = new THREE.Group();
    g.position.copy(pos);
    var skin = new THREE.Mesh(SPHERE, new THREE.MeshBasicMaterial({
      color: color, map: opt.map || null, transparent: true,
      opacity: opt.opacity == null ? .22 : opt.opacity,
      side: THREE.DoubleSide, depthWrite: false, toneMapped: false,
      blending: opt.blend === false ? THREE.NormalBlending : THREE.AdditiveBlending
    }));
    g.add(skin);
    /* the shell over it: the lines that make a transparent sphere read as
       one, brightest where it turns away from you */
    var mesh = T.shell.clone();
    mesh.wrapS = mesh.wrapT = THREE.RepeatWrapping;
    mesh.repeat.set(3, 2);
    mesh.needsUpdate = true;
    var rim = new THREE.Mesh(SPHERE, new THREE.MeshBasicMaterial({
      map: mesh, color: opt.rim == null ? 0xffffff : opt.rim,
      transparent: true, opacity: .5,
      side: THREE.DoubleSide, depthWrite: false, toneMapped: false,
      blending: THREE.AdditiveBlending
    }));
    rim.material.__own = true;
    rim.scale.setScalar(1.01);
    g.add(rim);
    scene.add(g);
    /* and where it meets the ground */
    ring(new THREE.Vector3(pos.x, .12, pos.z), color, { maxR: radius * 1.05, life: .9 });

    var t = 0, open = .45, shut = Math.max(.5, life * .12);
    addFx({ t: life, update: function (dt) {
      this.t -= dt; t += dt;
      var k = Math.min(1, t / open);
      /* snaps open past its own size and settles back into it */
      var s = radius * (ease.out(k) * 1.06 - Math.max(0, k - .7) * .2);
      if (this.t < shut) s *= Math.max(0, this.t / shut);
      g.scale.setScalar(Math.max(.001, s));
      g.rotation.y += dt * .05;
      var pulse = 1 + Math.sin(t * 2.4) * .12;
      var fade = (this.t < shut ? this.t / shut : 1) * Math.min(1, t / .2);
      skin.material.opacity = (opt.opacity == null ? .22 : opt.opacity) * pulse * fade;
      rim.material.opacity = .5 * pulse * fade;
      rim.material.map.offset.y += dt * .012;
      if (this.t <= 0) {
        scene.remove(g);
        skin.material.dispose();
        rim.material.map.dispose();
        rim.material.dispose();
        return false;
      }
      return true;
    } });
    return g;
  }

  /* =====================================================================
     BLOOD

     Blood is not light, and everything else in this kit is.

     Every effect above this line is drawn with additive blending: it adds
     its colour to whatever is behind it, which is exactly right for a
     technique made of light and exactly wrong for one made of fluid. Add
     red to a grey road and you get pink. Add it to itself where two
     layers cross and you get white. So the old blood beam had a white
     core and a glowing head, and it read as a laser somebody had tinted
     red rather than as blood.

     So this section is drawn the other way round, and the rules are:

       · normal blending, never additive — it covers what is behind it
         instead of brightening it
       · the core is the DARKEST part, not the lightest. A rope of fluid
         is dark in the middle where it is thickest and only catches a
         little light at its edge, which is the opposite of a beam
       · nothing white anywhere, and no star head or muzzle flare
       · one narrow off-centre sheen for wetness, at low opacity, because
         without it the whole thing is a flat shape

     Everything Choso throws goes through here.
     ================================================================== */

  /* the palette: all of it dark, and the "bright" one is still dark */
  var BL = { deep: 0x1c0106, dark: 0x33020b, mid: 0x4e0512, lit: 0x6d0a1c, wet: 0x8c1526 };

  /* Is this colour a dark one?

     The generic hit effects — the white star of an impact, the white cross
     of a heavy hit — are built for techniques made of light, and they are
     applied by the damage path to every hit in the game including the ones
     thrown by somebody whose whole technique is fluid. Rather than thread
     a flag down through four call sites, the colour of the hit decides:
     a dark spark means a dark hit, and the white parts are dropped. */
  function isDark(color) {
    var c = new THREE.Color(color);
    return (c.r * .299 + c.g * .587 + c.b * .114) < .28;
  }

  /* a flat, non-additive piece of blood */
  function bloodPlate(map, color, opacity) {
    var m = new THREE.Mesh(PLANE, new THREE.MeshBasicMaterial({
      map: map, color: color, transparent: true, opacity: opacity == null ? 1 : opacity,
      blending: THREE.NormalBlending, depthWrite: false,
      side: THREE.DoubleSide, toneMapped: false
    }));
    m.renderOrder = 8;
    return m;
  }

  /* THE BEAM
     A rope of blood under pressure, not a beam of light. Dark all the way
     through, darkest in the middle, with a thin wet line off to one side
     and the surface crawling along it so it reads as something being
     pushed rather than something being shone. */
  function bloodBeam(from, dir, len, opt) {
    opt = opt || {};
    var radius = opt.radius || 1.1;
    var life = opt.life || .3;
    var d = dir.clone().normalize();
    var q = new THREE.Quaternion().setFromUnitVectors(UP, d);
    var parts = [];

    function tube(r, col, op, off) {
      var m = new THREE.Mesh(CYL, new THREE.MeshBasicMaterial({
        color: col, transparent: true, opacity: op, blending: THREE.NormalBlending,
        depthWrite: false, side: THREE.DoubleSide, toneMapped: false
      }));
      m.quaternion.copy(q);
      m.renderOrder = 8;
      scene.add(m);
      parts.push({ m: m, r: r, op: op, off: off || null });
      return m;
    }
    /* outside in: rim, body, and a core darker than either */
    tube(radius, BL.lit, .96);
    tube(radius * .78, BL.mid, 1);
    tube(radius * .44, BL.deep, 1);
    /* the sheen: a thin bright-ish line held off the axis, never centred,
       because a line down the middle is what makes a thing look lit */
    var side = new THREE.Vector3(-d.z, 0, d.x);
    if (side.lengthSq() < .01) side.set(1, 0, 0);
    side.normalize();
    tube(radius * .16, BL.wet, .5, side.clone().multiplyScalar(radius * .52));

    /* the mouth of it, which is a splatter and not a flare */
    var mouth = bloodPlate(T.splat, BL.dark, .9);
    mouth.position.copy(from);
    scene.add(mouth);

    var t = 0;
    addFx({ t: life, update: function (dt) {
      this.t -= dt; t += dt;
      var k = 1 - this.t / life;
      var open = Math.min(1, k / .09);
      var fade = k > .68 ? 1 - (k - .68) / .32 : 1;
      /* fluid does not flicker, it swells — a slow wobble along its length */
      var swell = 1 + Math.sin(t * 30) * .07;
      var L = len * open;
      var c = from.clone().addScaledVector(d, L / 2);
      parts.forEach(function (p) {
        p.m.position.copy(c);
        if (p.off) p.m.position.add(p.off);
        p.m.scale.set(p.r * swell, L, p.r * swell);
        p.m.material.opacity = p.op * fade;
      });
      faceCam(mouth);
      mouth.scale.setScalar(radius * (2.2 + open * 1.2));
      mouth.material.opacity = .9 * fade;
      if (this.t <= 0) {
        parts.forEach(function (p) { kill(p.m); });
        kill(mouth);
        return false;
      }
      return true;
    } });
  }

  /* a hit: a dark splatter that spreads and sinks, with droplets off it */
  function bloodBurst(pos, size, dir) {
    size = size || 2;
    var p = bloodPlate(T.splat, BL.dark, .95);
    p.position.copy(pos);
    scene.add(p);
    var spin = Math.random() * TAU;
    var t = 0;
    addFx({ t: .42, update: function (dt) {
      this.t -= dt; t += dt;
      var k = 1 - this.t / .42;
      faceCam(p, spin);
      /* it opens and stops: a splatter does not keep growing, and a plate
         that keeps growing is a disc over the camera */
      p.scale.setScalar(size * (.55 + ease.out(k) * .6));
      p.material.opacity = .95 * (1 - k * k);
      if (this.t <= 0) { kill(p); return false; }
      return true;
    } });
    blood(pos.clone(), dir || new THREE.Vector3(0, 1, 0), Math.round(size * 2.4), size * .5);
  }

  /* a droplet: the small stuff, and none of it glows either */
  function bloodMote(pos, size, life) {
    var m = bloodPlate(T.splat, Math.random() < .5 ? BL.dark : BL.mid, .9);
    m.position.copy(pos);
    scene.add(m);
    var t = 0, dur = life || .3, s = size || 1;
    var drift = new THREE.Vector3((Math.random() - .5) * 3, -1 - Math.random() * 3, (Math.random() - .5) * 3);
    addFx({ t: dur, update: function (dt) {
      this.t -= dt; t += dt;
      m.position.addScaledVector(drift, dt);
      faceCam(m);
      m.scale.setScalar(s * (1 - t / dur * .5));
      m.material.opacity = .9 * (this.t / dur);
      if (this.t <= 0) { kill(m); return false; }
      return true;
    } });
  }

  /* threads thrown off whatever it is doing */
  function bloodThreads(pos, n, reach, life) {
    n = n || 4;
    for (var i = 0; i < n; i++) {
      var m = bloodPlate(T.streak, i % 2 ? BL.mid : BL.dark, .95);
      m.position.copy(pos);
      scene.add(m);
      (function (m) {
        var a = Math.random() * TAU, e = (Math.random() - .5) * 1.4;
        var v = new THREE.Vector3(Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e))
          .multiplyScalar((reach || 12) * (.5 + Math.random()));
        var dur = (life || 1) * (.6 + Math.random() * .6), t = 0;
        addFx({ t: dur, update: function (dt) {
          this.t -= dt; t += dt;
          v.y -= 16 * dt;
          m.position.addScaledVector(v, dt);
          orientAlong(m, m.position.clone().addScaledVector(v, -dt * 2), m.position);
          m.scale.set(Math.max(.5, v.length() * .05), .2, 1);
          m.material.opacity = .95 * (this.t / dur);
          if (this.t <= 0) { kill(m); return false; }
          return true;
        } });
      })(m);
    }
  }

  /* a mass of it — the meteorite, the orbs. A dark body with a wet rim,
     so it has a silhouette without being a light source. */
  function bloodMass(r) {
    var g = new THREE.Group();
    var body = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1),
      new THREE.MeshStandardMaterial({
        color: BL.mid, roughness: .28, metalness: .1, flatShading: true
      }));
    g.add(body);
    /* the rim: a slightly larger dark shell, faces inward, so the edge of
       the mass reads against whatever is behind it */
    var rim = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1),
      new THREE.MeshBasicMaterial({
        color: BL.deep, side: THREE.BackSide, transparent: true, opacity: .95,
        toneMapped: false, depthWrite: false
      }));
    rim.scale.setScalar(1.1);
    g.add(rim);
    g.__body = body;
    return g;
  }

  /* rings, but sunk into the dark end of the palette and not additive */
  function bloodRings(pos, n, opt) {
    opt = opt || {};
    n = n || 3;
    for (var i = 0; i < n; i++) {
      (function (idx) {
        setTimeout(function () {
          if (typeof scene === 'undefined') return;
          var m = bloodPlate(T.bloodRing, idx % 2 ? BL.mid : BL.lit, .7);
          m.position.copy(pos);
          if (opt.ground) m.rotation.x = -Math.PI / 2;
          scene.add(m);
          var t = 0, dur = opt.life || .6, maxR = opt.maxR || 12;
          addFx({ t: dur, update: function (dt) {
            this.t -= dt; t += dt;
            var k = t / dur;
            if (!opt.ground) faceCam(m);
            m.scale.setScalar(ease.out(k) * maxR);
            m.material.opacity = .7 * (1 - k);
            if (this.t <= 0) { kill(m); return false; }
            return true;
          } });
        }, idx * (opt.gap == null ? 40 : opt.gap));
      })(i);
    }
  }

  /* a cut made of blood rather than of light: a dark edge with a wet lip */
  function bloodCut(from, to, width, life) {
    var w = width || 1, dur = life || .26;
    var mid = from.clone().add(to).multiplyScalar(.5);
    var len = from.distanceTo(to);
    var made = [];
    [[w, BL.lit, .9], [w * .55, BL.deep, 1]].forEach(function (spec) {
      var m = new THREE.Mesh(PLANE, new THREE.MeshBasicMaterial({
        color: spec[1], transparent: true, opacity: spec[2],
        blending: THREE.NormalBlending, depthWrite: false,
        side: THREE.DoubleSide, toneMapped: false
      }));
      m.renderOrder = 8;
      scene.add(m);
      made.push({ m: m, w: spec[0], op: spec[2] });
    });
    var t = 0;
    addFx({ t: dur, update: function (dt) {
      this.t -= dt; t += dt;
      var k = t / dur;
      made.forEach(function (e) {
        e.m.position.copy(mid);
        orientAlong(e.m, from, to);
        e.m.scale.set(len, e.w * (1 - k * .6), 1);
        e.m.material.opacity = e.op * (1 - k);
      });
      if (this.t <= 0) { made.forEach(function (e) { kill(e.m); }); return false; }
      return true;
    } });
  }

  /* the aura for Flowing Red Scale: pressure, so it beats rather than
     shines — a dark shell that swells on a pulse */
  function bloodAura(getPos) {
    var shell = new THREE.Mesh(new THREE.SphereGeometry(2.4, 20, 14),
      new THREE.MeshBasicMaterial({
        color: BL.mid, transparent: true, opacity: .3, blending: THREE.NormalBlending,
        side: THREE.BackSide, depthWrite: false, toneMapped: false
      }));
    scene.add(shell);
    var t = 0, live = true;
    addFx({ t: 1e9, update: function (dt) {
      if (!live) { kill(shell); return false; }
      t += dt;
      var beat = 1 + Math.sin(t * 4.4) * .09;        // a pulse, about a heart's
      shell.position.copy(getPos()).add(new THREE.Vector3(0, 3, 0));
      shell.scale.setScalar(beat);
      shell.material.opacity = .24 + Math.sin(t * 4.4) * .08;
      if (Math.random() < dt * 9) {
        bloodMote(shell.position.clone().add(new THREE.Vector3(
          (Math.random() - .5) * 5, (Math.random() - .5) * 5, (Math.random() - .5) * 5)), 1, .4);
      }
      return true;
    } });
    return { stop: function () { live = false; } };
  }

  function blood(pos, dir, n, size) {
    n = n || 10; size = size || 1.1;
    var d = (dir || new THREE.Vector3(0, 1, 0)).clone().normalize();
    for (var i = 0; i < n; i++) {
      var m = billboard(T.streak, BL.lit, 1, false);
      m.position.copy(pos);
      m.renderOrder = 7;
      scene.add(m);
      (function (m) {
        var v = d.clone().multiplyScalar(6 + Math.random() * 13)
          .add(new THREE.Vector3((Math.random() - .5) * 9, Math.random() * 6, (Math.random() - .5) * 9));
        var life = .35 + Math.random() * .5, t = 0, s = size * (.5 + Math.random());
        var landed = false;
        addFx({ t: life, update: function (dt) {
          this.t -= dt; t += dt;
          v.y -= 30 * dt;
          m.position.addScaledVector(v, dt);
          if (m.position.y < .2 && !landed) {
            landed = true;
            decal(T.blood, new THREE.Vector3(m.position.x, 0, m.position.z),
              .5 + Math.random() * .9, 0x6d0616, .85, 9 + Math.random() * 6);
            this.t = 0;
          }
          var len = v.length() * .06;
          orientAlong(m, m.position.clone().addScaledVector(v, -dt * 2), m.position);
          m.scale.set(Math.max(.4, len) * s, .22 * s, 1);
          m.material.opacity = Math.min(1, this.t * 4);
          if (this.t <= 0) { kill(m); return false; }
          return true;
        } });
      })(m);
    }
  }

  /* the wet face of a cut, left on the piece it was cut from */
  function gash(parent, w, h, color) {
    var m = new THREE.Mesh(PLANE, new THREE.MeshBasicMaterial({
      color: color == null ? 0x6d0a1c : color, side: THREE.DoubleSide, toneMapped: false
    }));
    m.scale.set(w, h, 1);
    parent.add(m);
    return m;
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

  /* Rubble that is pulled off the ground toward a moving point, then rides
     around it. Pieces start far out and small, grow as they arrive, and
     never pop in already orbiting. */
  function orbitRubble(getPos, n, color, opt) {
    opt = opt || {};
    n = n || 14;
    color = color == null ? 0x5c6473 : color;
    var from = opt.from || 12;
    var to = opt.to || 3.6;
    var rise = opt.rise || .55;
    var bits = [];
    var alive = true;
    var mode = 'in';
    var i;

    function spawnOne(delay, startR) {
      var s = .5 + Math.random() * 1.25;
      var m = new THREE.Mesh(CHUNK, new THREE.MeshStandardMaterial({ color: color, roughness: .9 }));
      m.scale.setScalar(.001);
      var ang = Math.random() * TAU;
      var r0 = startR != null ? startR : from * (.62 + Math.random() * .55);
      var r1 = to * (.88 + Math.random() * .5);
      var lift = -1.1 + Math.random() * 3.2;
      var c0 = getPos();
      m.position.set(c0.x + Math.cos(ang) * r0, .12, c0.z + Math.sin(ang) * r0);
      scene.add(m);
      bits.push({
        m: m, ang: ang, r0: r0, r1: r1, lift: lift,
        spin: (Math.random() < .5 ? -1 : 1) * (1.3 + Math.random() * 2.5),
        av: new THREE.Vector3((Math.random() - .5) * 12, (Math.random() - .5) * 12, (Math.random() - .5) * 12),
        delay: delay == null ? Math.random() * (opt.stagger || .48) : delay,
        k: 0, sx: s, sy: s * (.45 + Math.random() * .4), sz: s * (.55 + Math.random() * .7),
        v: null, life: 0
      });
    }

    for (i = 0; i < n; i++) spawnOne(Math.random() * (opt.stagger || .48));

    addFx({ t: 14, update: function (dt) {
      if (!alive && mode !== 'out') {
        for (i = 0; i < bits.length; i++) if (bits[i].m) { kill(bits[i].m); bits[i].m = null; }
        return false;
      }
      var c = getPos();
      if (!c) return true;
      var any = false;
      for (i = 0; i < bits.length; i++) {
        var b = bits[i];
        if (!b.m) continue;
        any = true;
        if (mode === 'out' && b.v) {
          b.life -= dt;
          b.v.y -= 30 * dt;
          b.m.position.addScaledVector(b.v, dt);
          b.m.rotation.x += b.av.x * dt;
          b.m.rotation.y += b.av.y * dt;
          b.m.rotation.z += b.av.z * dt;
          if (b.m.position.y < .25) {
            b.m.position.y = .25;
            b.v.y = Math.abs(b.v.y) * .28;
            b.v.x *= .6; b.v.z *= .6;
          }
          if (b.life < .45) {
            b.m.material.transparent = true;
            b.m.material.opacity = Math.max(0, b.life / .45);
          }
          if (b.life <= 0) { kill(b.m); b.m = null; }
          continue;
        }
        if (b.delay > 0) { b.delay -= dt; continue; }
        if (b.k === 0) {
          dust(new THREE.Vector3(b.m.position.x, 0, b.m.position.z), 1, 0xd2ddef, 3.2, 1.5);
        }
        b.k = Math.min(1, b.k + dt / rise);
        var e = ease.out(b.k);
        b.ang += b.spin * dt * (.22 + e);
        var r = b.r0 + (b.r1 - b.r0) * e;
        var y = .12 + (c.y + b.lift - .12) * e;
        b.m.position.set(c.x + Math.cos(b.ang) * r, y, c.z + Math.sin(b.ang) * r);
        b.m.scale.set(b.sx * e, b.sy * e, b.sz * e);
        b.m.rotation.x += b.av.x * dt * .35;
        b.m.rotation.y += b.av.y * dt * .35;
      }
      if (!any) { alive = false; return false; }
      return true;
    } });

    return {
      add: function (count, startR) {
        count = count || 1;
        for (var j = 0; j < count; j++) spawnOne(0, startR);
      },
      release: function (spd) {
        mode = 'out';
        var c = getPos();
        spd = spd || 16;
        for (i = 0; i < bits.length; i++) {
          var b = bits[i];
          if (!b.m) continue;
          var away = c ? b.m.position.clone().sub(c) : new THREE.Vector3((Math.random() - .5), .5, (Math.random() - .5));
          if (away.lengthSq() < .01) away.set(Math.random() - .5, .5, Math.random() - .5);
          away.normalize();
          b.v = away.multiplyScalar(spd * (.5 + Math.random() * .75));
          b.v.y = Math.max(b.v.y, 7 + Math.random() * 10);
          b.life = 1.25 + Math.random() * .7;
        }
      },
      dispose: function () {
        if (mode === 'out') { alive = false; return; }
        alive = false;
        mode = 'dead';
      }
    };
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
    var dark = isDark(color);
    /* the white cross is the frame a heavy hit gets; a jab does not earn it,
       and neither does a hit whose own colour is darker than the road */
    if (power >= .95 && !dark) cross(pos, 0xffffff, 2.6 * power, .2);
    impact(pos, color, 1.1 * power);
    ring(pos.clone(), color, { maxR: 5.5 * power, life: .34, ground: false });
    dust(new THREE.Vector3(pos.x, 0, pos.z), 4, dark ? 0x5a3038 : 0xd7dde8, 4, 2);
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
    dust: dust, cracks: cracks, debris: debris, orbitRubble: orbitRubble,
    shockwave: shockwave, plates: plates,
    beam: beam, orb: orb, mote: mote, converge: converge,
    aura: aura, dome: dome, barrier: barrier,
    flash: flash, mangaLines: mangaLines, letterbox: letterbox, tint: tint, zoom: zoom,
    heavyHit: heavyHit, trail: trail,
    isDark: isDark, WEBS: WEBS, cutLine: cutLine, lattice: lattice, orientAlong: orientAlong, decal: decal,
    flame: flame, fire: fire, scorch: scorch, blood: blood, gash: gash,
    /* the dark kit: normal blending, no white anywhere, nothing that adds
       its colour to what is behind it. Everything Choso throws uses these. */
    bloodBeam: bloodBeam, bloodBurst: bloodBurst, bloodMote: bloodMote,
    bloodThreads: bloodThreads, bloodMass: bloodMass, bloodRings: bloodRings,
    bloodCut: bloodCut, bloodAura: bloodAura, bloodPlate: bloodPlate, BL: BL,
    billboard: billboard, faceCam: faceCam, ease: ease
  };
})();
