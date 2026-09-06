/* Loaded after multiplayer so Todo's participant camera takes precedence.
   Anime reference: https://jujutsukaisen.jp/episodes/45.php
   Locket / imagination reference: https://times.abema.tv/articles/-/10106990?page=1
   Animation, pixel portraits, silhouettes, sound and effects are original. */
(function () {
  'use strict';
  var T = JJTODO,
    FX = JJTODOFX,
    VOX = JJTODOVOX,
    V = (x, y, z) => new THREE.Vector3(x || 0, y || 0, z || 0),
    clamp = (x) => Math.max(0, Math.min(1, x));
  var ui = document.createElement('div');
  ui.id = 'jjTodoCinema';
  ui.style.cssText =
    'position:fixed;inset:0;z-index:65;pointer-events:none;display:none;color:#fff3df;font-family:Segoe UI,sans-serif';
  ui.innerHTML =
    '<div style="position:absolute;top:0;width:100%;height:9%;background:#090912"></div><div style="position:absolute;bottom:0;width:100%;height:12%;background:#090912"></div><div class="td-cine-title" style="position:absolute;bottom:4%;left:7%;font-size:clamp(20px,3vw,42px);font-weight:900;font-style:italic;letter-spacing:4px"></div><div class="td-cine-sub" style="position:absolute;top:3%;right:7%;font-size:12px;letter-spacing:3px;color:#e3becf"></div>';
  document.body.appendChild(ui);
  function echo(kind) {
    var rig = makeAnimeRig({ todo: true, skin: 0xd9ae8b, torso: 0x242839, pants: 0x222636, shoes: 0x15171e });
    var list = [];
    rig.root.traverse((o) => {
      if (o.isMesh) list.push(o);
    });
    list.forEach(VOX.dispose);
    var skin = 0xe2bea5,
      navy = 0x282638,
      hair = kind === 'idol' ? 0x363046 : 0xdb9296;
    function part(parent, name, x, y, z, w, h, d, c) {
      return VOX.sculpt(parent, name, 0.08).block(x, y, z, w, h, d, c).bake();
    }
    part(rig.head, 'Memory · face', 0, 0.5, 0, 0.72, 0.79, 0.68, skin);
    var h = VOX.sculpt(rig.head, 'Memory · hair silhouette', 0.08).block(
      0,
      0.99,
      -0.02,
      0.82,
      0.26,
      0.75,
      hair
    );
    for (var i = 0; i < 7; i++)
      h.block(-0.32 + i * 0.11, 1.1 + (i % 3) * 0.045, -0.03, 0.1, 0.24, 0.65, hair);
    if (kind === 'idol') {
      h.block(-0.38, 0.35, -0.1, 0.2, 1.15, 0.6, hair)
        .block(0.38, 0.35, -0.1, 0.2, 1.15, 0.6, hair)
        .block(0, 0.3, -0.35, 0.72, 1.2, 0.22, hair);
    }
    h.block(-0.17, 0.57, 0.36, 0.08, 0.08, 0.08, 0x393142)
      .block(0.17, 0.57, 0.36, 0.08, 0.08, 0.08, 0x393142)
      .bake();
    part(rig.neck, 'Memory · neck', 0, 0.05, 0, 0.3, 0.25, 0.3, skin);
    part(rig.spine, 'Memory · costume', 0, 0.56, 0, 1.4, 1.1, 0.73, kind === 'idol' ? 0xc96ca4 : navy);
    if (kind !== 'idol') part(rig.spine, 'Memory · red hood', 0, 1.14, -0.1, 1.08, 0.37, 0.76, 0xa84059);
    part(rig.hips, 'Memory · waist', 0, 0.3, 0, 1.13, 0.6, 0.7, navy);
    ['L', 'R'].forEach((s) => {
      part(
        rig['shoulder' + s],
        'Memory · sleeve',
        0,
        -0.51,
        0,
        0.48,
        1.05,
        0.48,
        kind === 'idol' ? 0xe9bdcf : navy
      );
      part(
        rig['elbow' + s],
        'Memory · forearm',
        0,
        -0.48,
        0,
        0.35,
        0.95,
        0.36,
        kind === 'idol' ? skin : navy
      );
      part(rig['elbow' + s], 'Memory · hand', 0, -1.06, 0.02, 0.39, 0.29, 0.38, skin);
      part(
        rig['hip' + s],
        'Memory · thigh',
        0,
        -0.56,
        0,
        0.59,
        1.18,
        0.62,
        kind === 'idol' ? 0xdc97b9 : navy
      );
      part(rig['knee' + s], 'Memory · calf', 0, -0.57, 0, 0.44, 1.1, 0.48, kind === 'idol' ? skin : navy);
      part(
        rig['ankle' + s],
        'Memory · shoe',
        0,
        -0.1,
        0.13,
        0.45,
        0.21,
        0.74,
        kind === 'idol' ? 0xb85682 : 0xad485e
      );
    });
    rig.root.scale.setScalar(kind === 'idol' ? 0.87 : 0.91);
    rig.root.traverse((o) => {
      if (o.isMesh) {
        o.material.transparent = true;
        o.material.opacity = 0.68;
        o.material.emissive = new THREE.Color(kind === 'idol' ? 0x8b4268 : 0x70504c);
        o.material.emissiveIntensity = 0.34;
      }
    });
    return rig;
  }
  T.cinematic = function (kind, origin, dir, victim, local, participant, caster) {
    var own = !!local || !!participant;
    if (own && T.cine) T.cine.stop();
    var g = new THREE.Group(),
      d = dir.clone().normalize(),
      side = V(d.z, 0, -d.x),
      e = caster || player;
    var center = origin.clone(),
      focus = victim ? victim.pos.clone() : origin.clone().addScaledVector(d, 3.2);
    var total = kind === 'awake' ? 3.65 : 5.23;
    function point(x, y, z) {
      return center
        .clone()
        .addScaledVector(side, x)
        .addScaledVector(d, z)
        .add(V(0, y, 0));
    }
    var locket = VOX.locket();
    locket.scale.setScalar(2.6);
    locket.position.copy(point(0, 4.55, 1.8));
    locket.rotation.y = Math.atan2(d.x, d.z);
    g.add(locket);
    var partner = echo(kind === 'awake' ? 'idol' : 'brother');
    g.add(partner.root);
    partner.root.visible = false;
    var rays = new THREE.Group();
    g.add(rays);
    rays.position.copy(point(0, 0, -2));
    rays.rotation.y = Math.atan2(d.x, d.z);
    for (var i = 0; i < 11; i++) {
      var x = (i - 5) * 1.9,
        geo = new THREE.BufferGeometry();
      geo.setAttribute(
        'position',
        new THREE.Float32BufferAttribute([x, 0, 0, x - 2, 11, -3, x + 2, 11, -3], 3)
      );
      var m = new THREE.Mesh(
        geo,
        new THREE.MeshBasicMaterial({
          color: i % 2 ? 0xffc4db : 0xc891b9,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          toneMapped: false
        })
      );
      rays.add(m);
    }
    var events = {},
      saved = own ? { yaw: camYaw, pitch: camPitch, fov: camera.fov } : null;
    var c = {
      kind,
      t: 0,
      remote: !local,
      origin: center,
      focus,
      d,
      side,
      victim,
      e,
      own,
      dead: false,
      phase: 'establish'
    };
    c.stop = function () {
      if (c.dead) return;
      c.dead = true;
      if (c.fx) c.fx.stop();
      if (T.cine === c) {
        T.cine = null;
        ui.style.display = 'none';
        camYaw = saved.yaw;
        camPitch = saved.pitch;
        camera.fov = saved.fov;
        camera.updateProjectionMatrix();
      }
    };
    if (own) {
      T.cine = c;
      ui.style.display = 'block';
    }
    c.fx = FX.effect(
      g,
      total,
      (t, dt) => {
        c.t = t;
        if ((local && (!mineAlive() || !player.action)) || (victim && victim.dead && t < 4.8)) {
          c.stop();
          return;
        }
        if (!local && caster && caster.dead) {
          c.stop();
          return;
        }
        function beat(id, at, fn) {
          if (t >= at && !events[id]) {
            events[id] = true;
            fn();
          }
        }
        locket.visible = kind === 'awake' && t > 0.5 && t < 1.64;
        locket.userData.hinge.rotation.y = 2.9 * (1 - clamp((t - 0.58) / 0.45));
        locket.rotation.z = Math.sin(t * 3) * 0.045;
        rays.visible = kind === 'awake' && t > 1.4 && t < 2.8;
        rays.children.forEach((m, i) => {
          m.material.opacity = Math.sin(clamp((t - 1.4) / 1.4) * Math.PI) * 0.18;
          m.rotation.z = Math.sin(t * 2 + i) * 0.08;
        });
        partner.root.visible = kind === 'awake' ? t > 1.55 && t < 2.66 : t > 1.05 && t < 4.87;
        var partnerPoint =
          kind === 'awake'
            ? point(-3.2, 0, 0.2)
            : focus
                .clone()
                .addScaledVector(side, Math.sin(t * 5) > 0 ? -2.4 : 2.4)
                .addScaledVector(d, 1.2);
        partner.root.position.copy(partnerPoint);
        partner.root.rotation.y = Math.atan2(focus.x - partnerPoint.x, focus.z - partnerPoint.z);
        T.pose(partner, {
          type: kind === 'awake' ? 'td_awaken' : 'b4',
          t: kind === 'awake' ? t : (t - 0.9) % 2.1,
          dur: 2.15
        });
        if (own) {
          var title =
            kind === 'awake'
              ? t < 1.5
                ? 'MY BEST FRIEND'
                : t < 2.55
                  ? 'OUR RHYTHM NEVER BREAKS'
                  : '120% POTENTIAL'
              : t < 3.5
                ? 'BROTHERHOOD FINALE'
                : t < 4.78
                  ? 'ONE PERFECT BEAT'
                  : 'BLACK FLASH';
          ui.querySelector('.td-cine-title').textContent = title;
          ui.querySelector('.td-cine-sub').textContent =
            kind === 'awake' && t > 1.5 && t < 2.55 ? 'TODO’S IMAGINATION' : 'AOI TODO · BOOGIE WOOGIE';
        }
        if (kind === 'awake') {
          beat('open', 0.65, () => FX.sound('clap', 0.55));
          beat('memory', 1.56, () => {
            if (own) JJFX.flash('#ffe2ed', 0.38, 0.18);
            FX.arc(point(0, 3, 0), 0, 5, 0xf9bad5, 0.5, 0.4);
          });
          beat('potential', 2.55, () => {
            FX.clap(point(0, 3.4, 1), 1.7, own);
            FX.debris(origin, 1.4);
            if (!local && e.rig) VOX.awake(e.rig, true);
          });
        } else {
          [0.83, 1.43, 2.08, 2.78].forEach((at, i) =>
            beat('beat' + i, at, () => {
              FX.swap(
                focus.clone().addScaledVector(side, i % 2 ? 3 : -3),
                focus.clone().addScaledVector(side, i % 2 ? -3 : 3)
              );
              FX.clap(focus.clone().add(V(0, 3, 0)), 0.85, own);
              FX.hit(focus.clone().add(V(0, 2.8, 0)), d, false, 1, own);
            })
          );
          beat('coil', 3.4, () => {
            FX.arc(focus.clone().add(V(0, 3, 0)), Math.atan2(d.x, d.z), 4, 0xa53659, 0.8, 0.5);
          });
          beat('flash', 4.78, () => {
            FX.hit(focus.clone().add(V(0, 2.8, 0)), d, true, 2.2, own);
            FX.debris(focus, 2.4);
            if (own) JJFX.flash('#fff3df', 0.85, 0.055);
          });
        }
      },
      () => {
        if (!c.dead) c.stop();
      }
    );
    return c;
  };
  function mineAlive() {
    return player.char === 'todo' && !player.dead;
  }
  var beforeCamera = updateCamera;
  updateCamera = function (dt) {
    beforeCamera(dt);
    var c = T.cine;
    if (!c || c.dead || !c.own) return;
    var p = c.origin,
      d = c.d,
      s = c.side,
      t = c.t;
    function point(x, y, z) {
      return p
        .clone()
        .addScaledVector(s, x)
        .addScaledVector(d, z)
        .add(V(0, y, 0));
    }
    var at, look, fov;
    if (c.kind === 'awake') {
      if (t < 0.56) {
        c.phase = 'face';
        at = point(1.3, 5.3, 4.5);
        look = point(0, 5, 0);
        fov = 39;
      } else if (t < 1.6) {
        c.phase = 'locket';
        at = point(0.3, 4.75, 5.9 - (t - 0.56) * 0.3);
        look = point(0, 4.55, 1.8);
        fov = 40;
      } else if (t < 2.55) {
        c.phase = 'memory';
        at = point(-5.3, 5.6, 10.8);
        look = point(-1, 3, 0);
        fov = 48;
      } else {
        c.phase = 'potential';
        at = point(3.8, 3.8, 8 - (t - 2.55) * 1.5);
        look = point(0, 3.6, 0);
        fov = 45;
      }
    } else {
      var f = c.focus;
      if (t < 0.75) {
        c.phase = 'establish';
        at = point(-6, 3.2, 7);
        look = p
          .clone()
          .lerp(f, 0.5)
          .add(V(0, 3, 0));
        fov = 49;
      } else if (t < 3.25) {
        c.phase = 'cross rhythm';
        var angle = t * 2.1;
        at = f
          .clone()
          .addScaledVector(s, Math.cos(angle) * 11)
          .addScaledVector(d, Math.sin(angle) * 11)
          .add(V(0, 5.2, 0));
        look = f.clone().add(V(0, 2.8, 0));
        fov = 51;
      } else if (t < 4.3) {
        c.phase = 'focus';
        var ep = c.e.pos;
        at = ep
          .clone()
          .addScaledVector(DIR(c.e.facing || 0), 4.0)
          .add(V(0.5, 5.1, 0));
        look = ep.clone().add(V(0, 4.9, 0));
        fov = 35;
      } else {
        c.phase = 'black flash';
        at = f
          .clone()
          .addScaledVector(s, 8)
          .addScaledVector(d, 8)
          .add(V(0, 4.5, 0));
        look = f.clone().add(V(0, 2.7, 0));
        fov = t > 4.78 ? 60 : 48;
      }
    }
    if (window.JJMAP && JJMAP.id === 'jjs') {
      var fraction = JJJJS.ray(look, at, 0.18);
      if (fraction < 1) at.lerpVectors(look, at, Math.max(0.18, fraction));
    }
    camera.position.copy(at);
    camera.lookAt(look);
    camera.fov = fov;
    camera.updateProjectionMatrix();
  };
  function DIR(y) {
    return V(Math.sin(y), 0, Math.cos(y));
  }
})();
