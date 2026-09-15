/* Aoi Todo: exposed voxel faces, articulated anatomy and cloth. */
(function () {
  'use strict';
  var V = (window.JJTODOVOX = {});
  var faces = [
    [
      [1, 0, 0],
      [
        [1, 0, 0],
        [1, 1, 0],
        [1, 1, 1],
        [1, 0, 1]
      ]
    ],
    [
      [-1, 0, 0],
      [
        [0, 0, 1],
        [0, 1, 1],
        [0, 1, 0],
        [0, 0, 0]
      ]
    ],
    [
      [0, 1, 0],
      [
        [0, 1, 1],
        [1, 1, 1],
        [1, 1, 0],
        [0, 1, 0]
      ]
    ],
    [
      [0, -1, 0],
      [
        [0, 0, 0],
        [1, 0, 0],
        [1, 0, 1],
        [0, 0, 1]
      ]
    ],
    [
      [0, 0, 1],
      [
        [1, 0, 1],
        [1, 1, 1],
        [0, 1, 1],
        [0, 0, 1]
      ]
    ],
    [
      [0, 0, -1],
      [
        [0, 0, 0],
        [0, 1, 0],
        [1, 1, 0],
        [1, 0, 0]
      ]
    ]
  ];
  V.sculpt = function (parent, name, grid, material) {
    var S = grid || 0.08,
      cells = new Map();
    function block(x, y, z, w, h, d, c) {
      var nx = Math.max(1, Math.round(w / S)),
        ny = Math.max(1, Math.round(h / S)),
        nz = Math.max(1, Math.round(d / S));
      var ox = Math.round(x / S - nx / 2),
        oy = Math.round(y / S - ny / 2),
        oz = Math.round(z / S - nz / 2);
      for (var i = 0; i < nx; i++)
        for (var j = 0; j < ny; j++)
          for (var k = 0; k < nz; k++)
            cells.set(ox + i + ',' + (oy + j) + ',' + (oz + k), [ox + i, oy + j, oz + k, c]);
      return api;
    }
    function stroke(points, width, color) {
      for (var i = 1; i < points.length; i++) {
        var a = points[i - 1],
          b = points[i],
          n = Math.max(
            1,
            Math.ceil(
              (Math.max(
                ...a.map(function (v, j) {
                  return Math.abs(v - b[j]);
                })
              ) /
                S) *
                2
            )
          );
        for (var j = 0; j <= n; j++) {
          var t = j / n;
          block(
            a[0] + (b[0] - a[0]) * t,
            a[1] + (b[1] - a[1]) * t,
            a[2] + (b[2] - a[2]) * t,
            width,
            width,
            width,
            color
          );
        }
      }
      return api;
    }
    function bake() {
      var p = [],
        n = [],
        c = [],
        ix = [],
        palette = {};
      cells.forEach(function (v) {
        var color = palette[v[3]] || (palette[v[3]] = new THREE.Color(v[3]));
        faces.forEach(function (f) {
          var normal = f[0];
          if (cells.has(v[0] + normal[0] + ',' + (v[1] + normal[1]) + ',' + (v[2] + normal[2]))) return;
          var start = p.length / 3;
          f[1].forEach(function (q) {
            p.push((v[0] + q[0]) * S, (v[1] + q[1]) * S, (v[2] + q[2]) * S);
            n.push(...normal);
            c.push(color.r, color.g, color.b);
          });
          ix.push(start, start + 1, start + 2, start, start + 2, start + 3);
        });
      });
      var g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
      g.setIndex(ix);
      g.userData = { voxel: true, grid: S, cells: cells.size };
      var m = new THREE.Mesh(
        g,
        material || new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, flatShading: true })
      );
      m.name = name;
      m.castShadow = true;
      m.receiveShadow = false;
      parent.add(m);
      return m;
    }
    var api = { block: block, stroke: stroke, bake: bake };
    return api;
  };
  V.dispose = function (g) {
    if (!g) return;
    if (g.parent) g.parent.remove(g);
    var geos = new Set(),
      mats = new Set();
    g.traverse(function (o) {
      if (o.isMesh) {
        geos.add(o.geometry);
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => mats.add(m));
      }
    });
    geos.forEach((g) => g.dispose());
    mats.forEach((m) => m.dispose());
  };
  var C = (V.colors = {
    skin: 0xd4ac88,
    shade: 0xac7e64,
    light: 0xe8c6a0,
    navy: 0x242a40,
    fold: 0x363f56,
    dark: 0x151b2b,
    purple: 0x67516c,
    plum: 0x463c53,
    white: 0xdedfd7,
    hair: 0x171821,
    gold: 0xcfa56b,
    scar: 0x996b61
  });
  function sculpt(parent, name, s) {
    return V.sculpt(parent, name, s || 0.07);
  }
  V.locket = function () {
    var g = new THREE.Group(),
      left = new THREE.Group();
    g.add(left);
    sculpt(g, 'Locket · brass frame', 0.035)
      .block(0.18, 0, 0, 0.39, 0.49, 0.11, C.gold)
      .block(0.18, 0, 0.07, 0.29, 0.38, 0.035, 0xf0ded0)
      .bake();
    sculpt(left, 'Locket · hinged cover', 0.035)
      .block(-0.18, 0, 0, 0.39, 0.49, 0.1, C.gold)
      .block(-0.18, 0, 0.07, 0.29, 0.38, 0.035, 0xe4d5e1)
      .bake();
    // Original pixel portraits of his friend and favourite idol, sculpted in the pendant.
    var a = sculpt(g, 'Yuji miniature portrait', 0.035);
    a.block(0.18, 0.06, 0.105, 0.18, 0.19, 0.035, C.skin)
      .block(0.18, 0.16, 0.11, 0.23, 0.105, 0.035, 0xcc8a91)
      .block(0.18, -0.12, 0.11, 0.23, 0.14, 0.035, 0xa74356)
      .block(0.145, 0.04, 0.14, 0.035, 0.035, 0.035, C.dark)
      .block(0.215, 0.04, 0.14, 0.035, 0.035, 0.035, C.dark)
      .bake();
    sculpt(left, 'Takada miniature portrait', 0.035)
      .block(-0.18, 0.04, 0.105, 0.21, 0.3, 0.035, C.hair)
      .block(-0.18, 0.05, 0.14, 0.14, 0.17, 0.035, 0xf3d5bd)
      .block(-0.18, -0.13, 0.14, 0.23, 0.1, 0.035, 0xd46c9e)
      .block(-0.23, 0.2, 0.14, 0.1, 0.035, 0.035, 0xf5b5d2)
      .block(-0.215, 0.06, 0.175, 0.035, 0.035, 0.035, C.dark)
      .block(-0.145, 0.06, 0.175, 0.035, 0.035, 0.035, C.dark)
      .block(-0.18, -0.005, 0.175, 0.07, 0.035, 0.035, 0xcb8796)
      .bake();
    g.userData.hinge = left;
    return g;
  };
  var makeBefore = makeAnimeRig;
  makeAnimeRig = function (cfg) {
    var r = makeBefore(cfg);
    if (!cfg || !cfg.todo) return r;
    var old = [];
    r.root.traverse((o) => {
      if (o.isMesh) old.push(o);
    });
    old.forEach(V.dispose);
    r.td = { jacket: [], bare: [], sash: [], awake: false };
    r.shoulderL.position.x = -0.94;
    r.shoulderR.position.x = 0.94;
    r.hipL.position.x = -0.4;
    r.hipR.position.x = 0.4;
    var head = sculpt(r.head, 'Todo · jaw, cheek planes, ears', 0.055);
    head
      .block(0, 0.48, 0, 0.83, 0.77, 0.72, C.skin)
      .block(0, 0.22, 0.045, 0.7, 0.31, 0.7, C.shade)
      .block(0, 0.19, 0.16, 0.62, 0.2, 0.58, C.skin)
      .block(0, 0.65, -0.06, 0.88, 0.46, 0.76, C.skin)
      .block(-0.46, 0.48, 0, 0.13, 0.27, 0.23, C.shade)
      .block(0.46, 0.48, 0, 0.13, 0.27, 0.23, C.shade)
      .block(0, 0.45, 0.42, 0.13, 0.24, 0.15, C.light)
      .block(0, 0.36, 0.45, 0.19, 0.08, 0.13, C.skin)
      .block(0, 0.25, 0.39, 0.28, 0.055, 0.055, 0x74544c)
      .block(0.085, 0.28, 0.395, 0.13, 0.055, 0.055, C.light)
      .block(-0.26, 0.39, 0.39, 0.18, 0.1, 0.055, C.light)
      .block(0.26, 0.39, 0.39, 0.18, 0.1, 0.055, C.light)
      .bake();
    var face = sculpt(r.head, 'Todo · sharp eyes and diagonal facial scar', 0.025);
    [-1, 1].forEach((s) => {
      face
        .block(s * 0.21, 0.59, 0.385, 0.2, 0.075, 0.04, 0xf4e7d2)
        .block(s * 0.18, 0.585, 0.415, 0.05, 0.075, 0.035, 0x352d32)
        .stroke(
          [
            [s * 0.1, 0.68, 0.405],
            [s * 0.22, 0.71, 0.405],
            [s * 0.34, 0.72, 0.385]
          ],
          0.06,
          C.hair
        );
    });
    face
      .stroke(
        [
          [0.27, 0.93, 0.38],
          [0.3, 0.81, 0.405],
          [0.28, 0.68, 0.425],
          [0.33, 0.56, 0.425],
          [0.27, 0.43, 0.425],
          [0.23, 0.32, 0.405]
        ],
        0.045,
        C.scar
      )
      .bake();
    var hair = sculpt(r.head, 'Todo · combed hair, shaved sides and tied topknot', 0.055);
    hair
      .block(0, 0.97, -0.07, 0.86, 0.22, 0.76, C.hair)
      .block(0, 0.78, -0.36, 0.74, 0.4, 0.16, C.hair)
      .block(-0.4, 0.77, -0.02, 0.055, 0.22, 0.48, 0x544b49)
      .block(0.4, 0.77, -0.02, 0.055, 0.22, 0.48, 0x544b49);
    for (var i = 0; i < 7; i++)
      hair.stroke(
        [
          [-0.33 + i * 0.11, 0.98, 0.31],
          [-0.3 + i * 0.1, 1.13, 0.05],
          [-0.2 + i * 0.07, 1.16, -0.2]
        ],
        0.065,
        i % 2 ? 0x373540 : C.hair
      );
    hair.bake();
    r.td.knot = new THREE.Group();
    r.td.knot.position.set(0, 1.14, -0.2);
    r.head.add(r.td.knot);
    sculpt(r.td.knot, 'Todo · folded topknot and tie', 0.055)
      .block(0, 0.13, -0.03, 0.29, 0.35, 0.31, C.hair)
      .block(-0.06, 0.31, 0.015, 0.29, 0.16, 0.29, 0x292731)
      .block(0.08, 0.23, 0.08, 0.13, 0.26, 0.22, 0x393440)
      .block(0, 0.015, 0, 0.3, 0.07, 0.3, C.gold)
      .bake();
    sculpt(r.neck, 'Todo · thick neck and tendons', 0.07)
      .block(0, 0.02, 0, 0.42, 0.37, 0.39, C.skin)
      .block(-0.18, -0.09, 0.03, 0.14, 0.2, 0.33, C.shade)
      .block(0.18, -0.09, 0.03, 0.14, 0.2, 0.33, C.shade)
      .bake();
    var muscle = sculpt(r.spine, 'Todo · sculpted pectorals, abs and back', 0.07);
    muscle
      .block(0, 0.46, 0, 1.34, 1.2, 0.68, C.shade)
      .block(0, 0.98, -0.035, 1.75, 0.4, 0.73, C.skin)
      .block(0, 0.45, -0.3, 1.35, 0.87, 0.2, C.skin);
    [-1, 1].forEach((s) => {
      muscle
        .block(s * 0.38, 0.79, 0.34, 0.71, 0.4, 0.28, C.skin)
        .block(s * 0.37, 0.87, 0.43, 0.6, 0.22, 0.1, C.light)
        .block(s * 0.68, 0.56, 0.04, 0.24, 0.59, 0.63, C.skin);
      for (var n = 0; n < 3; n++)
        muscle.block(s * 0.2, 0.43 - n * 0.22, 0.365, 0.33, 0.18, 0.18, n === 0 ? C.light : C.skin);
    });
    muscle.bake();
    var tank = sculpt(r.spine, 'Todo · purple fitted tank and fabric folds', 0.07)
      .block(0, 0.44, 0.035, 1.38, 1.1, 0.82, C.purple)
      .block(0, 0.32, 0.43, 1.09, 0.54, 0.07, C.plum)
      .block(0, 0.12, 0.49, 1.15, 0.1, 0.07, 0x8c7590)
      .block(0, 0.52, 0.49, 0.92, 0.1, 0.07, 0x77617e);
    for (var s of [-1, 1]) tank.block(s * 0.47, 1.0, 0.35, 0.24, 0.37, 0.22, C.purple);
    r.td.jacket.push(tank.bake());
    r.td.jacket.push(
      sculpt(r.spine, 'Todo · navy cropped jacket, tailored back', 0.07)
        .block(0, 0.64, -0.28, 1.72, 1.18, 0.4, C.navy)
        .block(0, 0.77, -0.51, 1.46, 0.65, 0.07, C.fold)
        .block(0, 0.07, -0.36, 1.46, 0.14, 0.36, C.dark)
        .block(0, 1.19, -0.15, 0.98, 0.27, 0.63, C.navy)
        .bake()
    );
    [-1, 1].forEach((s) => {
      var lap = sculpt(r.spine, 'Todo · stepped lapel and gold button', 0.07);
      for (var n = 0; n < 9; n++)
        lap.block(s * (0.7 - n * 0.025), 0.16 + n * 0.12, 0.47, 0.32, 0.14, 0.2, n === 7 ? C.fold : C.navy);
      lap
        .block(s * 0.47, 1.02, 0.49, 0.14, 0.27, 0.14, C.fold)
        .block(s * 0.67, 0.73, 0.595, 0.07, 0.07, 0.07, C.gold);
      r.td.jacket.push(lap.bake());
    });
    sculpt(r.hips, 'Todo · trousers seat', 0.07).block(0, 0.22, 0, 1.38, 0.75, 0.8, C.navy).bake();
    var sash = sculpt(r.hips, 'Todo · layered white waist sash', 0.07);
    for (var n = 0; n < 5; n++)
      sash
        .block(0, 0.63 - n * 0.1, 0.035, 1.42 + (n === 2 ? 0.07 : 0), 0.105, 0.88, C.white)
        .block(((n % 2) - 0.5) * 0.15, 0.63 - n * 0.1, 0.5, 1.32, 0.035, 0.045, n % 2 ? 0xf4f0e4 : 0xb6bebf);
    sash.block(0.38, 0.44, 0.55, 0.28, 0.25, 0.21, 0xece9df).bake();
    for (var i = 0; i < 2; i++) {
      var tail = new THREE.Group();
      tail.position.set(0.32 + i * 0.19, 0.39, 0.53);
      r.hips.add(tail);
      sculpt(tail, 'Todo · sash tail', 0.07)
        .block(0, -0.26, 0, 0.18, 0.56, 0.1, i ? C.white : 0xc9cfca)
        .block(0, -0.52, 0.025, 0.21, 0.07, 0.07, 0xedece0)
        .bake();
      r.td.sash.push(tail);
    }
    ['L', 'R'].forEach((side, i) => {
      var s = i ? 1 : -1,
        sh = r['shoulder' + side],
        el = r['elbow' + side];
      sculpt(sh, 'Todo · deltoid and upper arm ' + side, 0.07)
        .block(0, -0.21, 0, 0.7, 0.56, 0.66, C.skin)
        .block(0, -0.48, 0.03, 0.6, 0.61, 0.59, C.skin)
        .block(0, -0.51, 0.29, 0.42, 0.35, 0.1, C.light)
        .block(s * 0.22, -0.53, -0.12, 0.17, 0.4, 0.35, C.shade)
        .block(0, -0.89, 0, 0.44, 0.25, 0.44, C.skin)
        .bake();
      var sleeve = sculpt(sh, 'Todo · loose jacket sleeve ' + side, 0.07)
        .block(0, -0.25, 0, 0.85, 0.69, 0.8, C.navy)
        .block(s * 0.37, -0.26, 0, 0.07, 0.44, 0.68, C.fold)
        .block(0, -0.66, 0, 0.73, 0.21, 0.71, C.dark)
        .block(0, -0.75, 0.035, 0.71, 0.1, 0.67, C.fold)
        .bake();
      r.td.jacket.push(sleeve);
      sculpt(el, 'Todo · forearm anatomy ' + side, 0.055)
        .block(0, -0.27, 0, 0.48, 0.62, 0.49, C.skin)
        .block(0, -0.34, 0.23, 0.3, 0.36, 0.07, C.light)
        .block(s * 0.19, -0.3, -0.1, 0.1, 0.45, 0.29, C.shade)
        .block(0, -0.73, 0, 0.34, 0.44, 0.38, C.skin)
        .bake();
      var fist = sculpt(el, 'Todo · fist and individual knuckles ' + side, 0.055);
      fist
        .block(0, -1.07, 0.015, 0.39, 0.34, 0.4, C.skin)
        .block(-s * 0.23, -1.01, 0.12, 0.14, 0.24, 0.19, C.shade);
      for (var n = 0; n < 4; n++) fist.block(-0.145 + n * 0.095, -1.15, 0.225, 0.08, 0.13, 0.08, C.light);
      fist.bake();
      var hip = r['hip' + side],
        knee = r['knee' + side],
        ankle = r['ankle' + side];
      var trousers = sculpt(hip, 'Todo · wide pleated trousers ' + side, 0.07);
      trousers
        .block(0, -0.45, -0.015, 0.84, 1.18, 0.85, C.navy)
        .block(s * 0.21, -0.36, -0.03, 0.52, 0.86, 0.88, C.navy)
        .block(s * 0.41, -0.4, 0.1, 0.14, 0.82, 0.46, C.fold)
        .block(-s * 0.29, -0.52, 0.4, 0.14, 0.96, 0.1, C.dark)
        .block(s * 0.04, -0.81, 0.42, 0.14, 0.4, 0.1, C.fold)
        .bake();
      sculpt(knee, 'Todo · tapered calf and gathered trouser cuff ' + side, 0.07)
        .block(0, -0.27, 0, 0.75, 0.75, 0.75, C.navy)
        .block(s * 0.2, -0.31, 0.29, 0.21, 0.54, 0.17, C.fold)
        .block(0, -0.64, 0, 0.62, 0.18, 0.65, C.dark)
        .block(0, -0.76, 0.015, 0.43, 0.12, 0.43, C.navy)
        .block(0, -0.98, 0.015, 0.32, 0.37, 0.33, C.skin)
        .block(0, -1.02, 0.16, 0.21, 0.27, 0.07, C.light)
        .bake();
      sculpt(ankle, 'Todo · exposed instep and black slip-on shoe ' + side, 0.055)
        .block(0, -0.1, 0.05, 0.39, 0.25, 0.45, C.skin)
        .block(0, -0.18, 0.19, 0.48, 0.22, 0.75, 0x131820)
        .block(0, -0.09, 0.36, 0.44, 0.12, 0.39, 0x242735)
        .block(0, -0.27, 0.19, 0.5, 0.07, 0.78, 0x4b5056)
        .bake();
    });
    r.td.locket = V.locket();
    r.td.locket.position.set(0, 0.77, 0.57);
    r.td.locket.scale.setScalar(0.48);
    r.spine.add(r.td.locket);
    r.td.locket.userData.hinge.rotation.y = 2.9;
    sculpt(r.spine, 'Todo · pendant chain', 0.035)
      .stroke(
        [
          [-0.2, 1.21, 0.36],
          [-0.16, 1.06, 0.47],
          [0, 0.77, 0.59],
          [0.16, 1.06, 0.47],
          [0.2, 1.21, 0.36]
        ],
        0.035,
        C.gold
      )
      .bake();
    return r;
  };
  V.awake = function (r, on) {
    if (!r || !r.td) return;
    r.td.awake = !!on;
    r.td.jacket.forEach((m) => (m.visible = !on));
  };
})();
