/* Todo's original anime effects: tapered ink ribbons, swap seams and impact frames.
   Solid props use voxels. Light uses flat strokes, never a projectile sphere. */
(function () {
  'use strict';
  var F = (window.JJTODOFX = { effects: new Set() }),
    VOX = JJTODOVOX,
    FX = JJFX;
  var V = (x, y, z) => new THREE.Vector3(x || 0, y || 0, z || 0),
    GOLD = 0xffd59a,
    WHITE = 0xfff7e6;
  F.effect = function (g, life, step, done) {
    scene.add(g);
    var o = { g, t: 0, life, dead: false };
    F.effects.add(o);
    o.stop = function () {
      if (o.dead) return;
      o.dead = true;
      F.effects.delete(o);
      VOX.dispose(g);
      if (done) done();
    };
    addFx({
      update(dt) {
        if (o.dead) return false;
        o.t += dt;
        if (step) step(o.t, dt, o);
        if (o.t >= life) o.stop();
        return !o.dead;
      }
    });
    return o;
  };
  F.clear = function () {
    Array.from(F.effects).forEach((o) => o.stop());
  };
  F.ribbon = function (points, width, color, life, normal) {
    var positions = [],
      indices = [],
      n = normal || V(0, 1, 0);
    points.forEach((p, i) => {
      var d = points[Math.min(i + 1, points.length - 1)]
        .clone()
        .sub(points[Math.max(0, i - 1)])
        .normalize();
      var side = d.clone().cross(n).normalize();
      if (side.lengthSq() < 0.1) side = V(1, 0, 0);
      var w = width * Math.pow(Math.sin((Math.PI * (i + 0.2)) / (points.length - 0.6)), 0.55);
      if (!Number.isFinite(w)) w = 0;
      [1, -1].forEach((s) =>
        positions.push(
          ...p
            .clone()
            .addScaledVector(side, w * s)
            .toArray()
        )
      );
      if (i) {
        var j = i * 2;
        indices.push(j - 2, j - 1, j, j - 1, j + 1, j);
      }
    });
    var geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setIndex(indices);
    var mesh = new THREE.Mesh(
      geom,
      new THREE.MeshBasicMaterial({
        color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        toneMapped: false
      })
    );
    return F.effect(mesh, life, (t) => {
      mesh.material.opacity = 0.95 * Math.pow(Math.max(0, 1 - t / life), 0.6);
    });
  };
  F.arc = function (at, yaw, scale, color, life, tilt) {
    var pts = [];
    for (var i = 0; i <= 20; i++) {
      var a = -1.9 + (i / 20) * 3.8;
      pts.push(
        V(Math.sin(a) * scale, Math.cos(a) * scale * (tilt || 0.15), Math.cos(a) * scale)
          .applyAxisAngle(V(0, 1, 0), yaw)
          .add(at)
      );
    }
    F.ribbon(pts, scale * 0.095, color || WHITE, life || 0.25, V(0, 1, 0));
    F.ribbon(
      pts.map((p) => p.clone().add(V(0, 0.12, 0))),
      scale * 0.027,
      WHITE,
      life || 0.25,
      V(0, 1, 0)
    );
  };
  F.sound = function (kind, power) {
    try {
      var ctx = F.audio || (F.audio = new (window.AudioContext || window.webkitAudioContext)());
      if (ctx.state === 'suspended') ctx.resume();
      var now = ctx.currentTime,
        p = power || 1;
      var buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.18), ctx.sampleRate),
        data = buffer.getChannelData(0);
      for (var i = 0; i < data.length; i++)
        data[i] = (Math.random() * 2 - 1) * Math.exp((-i / data.length) * (kind === 'clap' ? 12 : 7));
      var src = ctx.createBufferSource(),
        filter = ctx.createBiquadFilter(),
        gain = ctx.createGain();
      src.buffer = buffer;
      filter.type = 'bandpass';
      filter.frequency.value = kind === 'clap' ? 1900 : 650;
      filter.Q.value = 0.7;
      gain.gain.setValueAtTime(0.3 * p, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      src.connect(filter).connect(gain).connect(ctx.destination);
      src.start(now);
      src.onended = () => {
        src.disconnect();
        filter.disconnect();
        gain.disconnect();
      };
      var osc = ctx.createOscillator(),
        bass = ctx.createGain();
      osc.type = kind === 'black' ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(kind === 'clap' ? 310 : 100, now);
      osc.frequency.exponentialRampToValueAtTime(35, now + 0.18);
      bass.gain.setValueAtTime(0.12 * p, now);
      bass.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(bass).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.26);
      osc.onended = () => {
        osc.disconnect();
        bass.disconnect();
      };
    } catch (e) {}
  };
  F.clap = function (at, power, screen) {
    power = power || 1;
    F.sound('clap', power);
    FX.slash(at, V(0, 1, 0), WHITE, 4 * power, 0.2);
    FX.ring(at, GOLD, { maxR: 5 * power, life: 0.32, ground: false });
    F.arc(at, 0, 2.5 * power, WHITE, 0.16, 0.35);
    if (screen) {
      FX.flash('#fff5dd', 0.16, 0.055);
      addShake(0.22 * power);
    }
  };
  F.swap = function (from, to) {
    var a = from.clone().add(V(0, 2.6, 0)),
      b = to.clone().add(V(0, 2.6, 0));
    [a, b].forEach((p) => {
      FX.slash(p, V(0, 1, 0), WHITE, 6, 0.23);
      F.ribbon(
        [p.clone().add(V(-0.15, -2.5, 0)), p.clone().add(V(0.15, 0, 0)), p.clone().add(V(-0.1, 3.5, 0))],
        0.2,
        GOLD,
        0.27,
        V(0, 0, 1)
      );
    });
    [-1, 1].forEach((s) => {
      var pts = [];
      for (var i = 0; i <= 18; i++) {
        var k = i / 18;
        pts.push(
          a
            .clone()
            .lerp(b, k)
            .add(V(0, Math.sin(k * Math.PI) * s * 1.4, 0))
        );
      }
      F.ribbon(pts, 0.13, s > 0 ? WHITE : GOLD, 0.29, V(0, 0, 1));
    });
  };
  F.hit = function (at, d, black, power, screen) {
    power = power || 1;
    F.sound(black ? 'black' : 'hit', power);
    FX.slash(at, d, WHITE, 5 * power, 0.22);
    F.arc(at, Math.atan2(d.x, d.z), 3 * power, black ? 0xd92651 : GOLD, 0.23, 0.35);
    if (black) {
      // Thin forked red ink bolts and white core create a Black Flash silhouette.
      for (var i = 0; i < 9; i++) {
        var angle = (i / 9) * Math.PI * 2,
          axis = V(Math.cos(angle), Math.sin(angle), 0),
          pts = [];
        for (var k = 0; k < 6; k++)
          pts.push(
            at
              .clone()
              .addScaledVector(axis, k * 1.15 * power)
              .add(V(k % 2 ? 0.23 : -0.23, k % 2 ? 0.12 : -0.12, ((i % 3) - 1) * 0.2))
          );
        F.ribbon(pts, 0.18 * power, 0x170e20, 0.45, V(0, 0, 1));
        F.ribbon(
          pts.map((p) => p.clone().add(V(0.045, 0.045, 0.025))),
          0.065 * power,
          0xf62e53,
          0.32,
          V(0, 0, 1)
        );
      }
      FX.ring(at, 0xe43657, { maxR: 8 * power, life: 0.4, ground: false });
      if (screen) {
        FX.flash('#130b20', 0.7, 0.075);
        FX.mangaLines(0.6, 0.24);
        addShake(1.2 * power);
      }
    } else if (screen) addShake(0.45 * power);
  };
  F.debris = function (at, power) {
    var g = new THREE.Group();
    g.position.copy(at);
    var chunks = [];
    for (var i = 0; i < 16; i++) {
      var s = 0.14 + (i % 4) * 0.11,
        m = new THREE.Mesh(
          new THREE.BoxGeometry(s, s, s),
          new THREE.MeshStandardMaterial({ color: i % 2 ? 0xa29b94 : 0x6d7179, roughness: 1 })
        );
      m.geometry.userData.voxel = true;
      g.add(m);
      var a = (i / 16) * Math.PI * 2;
      chunks.push({
        m,
        v: V(Math.cos(a) * (2 + (i % 3)) * power, 3 + (i % 4) * power, Math.sin(a) * (2 + (i % 3)) * power)
      });
    }
    F.effect(g, 1.1, (t, dt) =>
      chunks.forEach((o) => {
        o.v.y -= 18 * dt;
        o.m.position.addScaledVector(o.v, dt);
        o.m.rotation.x += dt * 4;
        o.m.rotation.z += dt * 2;
        o.m.scale.setScalar(Math.max(0, 1 - t / 1.1));
      })
    );
    FX.ring(at.clone().add(V(0, 0.08, 0)), 0xe3d8c5, { maxR: 6 * power, life: 0.42 });
  };
  F.pebble = function (at) {
    var g = new THREE.Group();
    g.position.copy(at);
    VOX.sculpt(g, 'Cursed stone · voxel prop', 0.1)
      .block(0, 0, 0, 0.5, 0.4, 0.4, 0x7c7486)
      .block(0.15, 0.1, 0, 0.3, 0.3, 0.3, 0xc0b5ba)
      .block(-0.1, -0.1, 0.05, 0.3, 0.3, 0.5, 0x474450)
      .block(0.05, 0.15, 0.2, 0.1, 0.1, 0.1, GOLD)
      .bake();
    return g;
  };
})();
