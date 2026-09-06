/* Mahito's articulated voxel sculpture. All solid surfaces are exposed cube
   faces; joints animate independently and no rounded primitives are retained. */
(function () {
  'use strict';
  var V = (window.JJMAHITOVOX = {});
  var C = (V.colors = {
    skin: 0xd7d0ba,
    skinD: 0xaba89b,
    light: 0xefe7d3,
    seam: 0x4c4a46,
    hair: 0x839ca4,
    hairD: 0x536e78,
    hairL: 0xa8b8ba,
    cloth: 0x21252c,
    fold: 0x353a46,
    patch: 0x454a56,
    black: 0x14171e,
    soul: 0x79eee0,
    purple: 0xa877b5,
    green: 0x9bbe68
  });
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
  V.hand = function (parent, name, size, color) {
    var g = new THREE.Group();
    parent.add(g);
    var s = V.sculpt(g, name, 0.1);
    s.block(0, 0, 0, 0.85, 1.1, 0.4, color || C.skin).block(
      -0.54,
      -0.08,
      0,
      0.26,
      0.6,
      0.35,
      color || C.skin
    );
    for (var i = 0; i < 4; i++)
      s.block(-0.36 + i * 0.24, 0.88 + (i === 0 || i === 3 ? -0.1 : 0), 0, 0.2, 0.85, 0.3, color || C.skin);
    for (i = 0; i < 3; i++) s.block(0, -0.3 + i * 0.3, 0.24, 0.8, 0.06, 0.08, C.seam);
    s.bake();
    g.scale.setScalar(size || 1);
    return g;
  };
  V.human = function (kind, color) {
    var g = new THREE.Group(),
      s = V.sculpt(g, 'Transfigured ' + kind, 0.12);
    s.block(0, 0.72, 0, 0.72, 1, 0.48, color || C.purple).block(0, 1.46, 0.04, 0.64, 0.64, 0.6, C.skinD);
    s.block(-0.14, 1.5, 0.36, 0.12, 0.12, 0.12, C.black)
      .block(0.14, 1.5, 0.36, 0.12, 0.12, 0.12, C.black)
      .block(0, 1.22, 0.36, 0.36, 0.12, 0.12, C.black);
    s.stroke(
      [
        [-0.35, 1, 0],
        [-0.65, 0.6, 0.1],
        [-0.55, 0.12, 0.3]
      ],
      0.24,
      color || C.purple
    ).stroke(
      [
        [0.35, 1, 0],
        [0.75, 1.3, 0],
        [0.9, 0.9, 0.2]
      ],
      0.24,
      color || C.purple
    );
    s.stroke(
      [
        [-0.2, 0.3, 0],
        [-0.35, 0, 0.2],
        [-0.4, -0.3, 0.5]
      ],
      0.24,
      C.skinD
    ).stroke(
      [
        [0.2, 0.3, 0],
        [0.3, -0.25, -0.25],
        [0.7, -0.25, -0.1]
      ],
      0.24,
      C.skinD
    );
    if (kind === 'flesh') s.block(0, 0.55, 0, 1.08, 0.7, 0.84, C.skinD);
    s.bake();
    return g;
  };
  var previous = makeAnimeRig;
  makeAnimeRig = function (cfg) {
    var r = previous(cfg);
    if (!cfg || !cfg.mahito) return r;
    var old = [];
    r.root.traverse(function (o) {
      if (o.isMesh) old.push(o);
    });
    old.forEach(V.dispose);
    r.__char = 'mahito';
    r.body.scale.set(1.04, 1.04, 1.02);
    r.mh = { mode: 0, awake: false, normal: [], blade: [], club: [], hammers: [], braids: [], coat: [] };
    var S = V.sculpt;
    var s = S(r.spine, 'Mahito / asymmetrical patchwork tunic', 0.06);
    s.block(0, 0.5, 0, 1.14, 1.02, 0.64, C.cloth)
      .block(0, 1.02, 0, 1.26, 0.18, 0.66, C.fold)
      .block(0, 1.14, 0, 0.6, 0.22, 0.5, C.cloth);
    for (var i = 0; i < 5; i++)
      for (var j = 0; j < 3; j++)
        s.block(
          -0.48 + j * 0.42,
          0.12 + i * 0.2,
          0.34,
          0.36,
          0.16,
          0.06,
          (i + j) % 3 === 0 ? C.fold : C.cloth
        );
    for (i = 0; i < 6; i++) {
      s.block(-0.52 + i * 0.2, 0.72, 0.4, 0.1, 0.035, 0.035, C.patch);
      s.block(-0.52 + i * 0.2, 0.16, 0.4, 0.1, 0.035, 0.035, C.patch);
    }
    s.stroke(
      [
        [-0.42, 1.08, 0.36],
        [-0.24, 0.86, 0.4],
        [0.04, 0.66, 0.4],
        [0.1, 0.08, 0.36]
      ],
      0.06,
      C.patch
    );
    s.block(0.42, 0.88, 0.36, 0.24, 0.36, 0.06, C.black).block(-0.5, 0.45, -0.34, 0.18, 0.7, 0.06, C.fold);
    s.bake();
    S(r.neck, 'Mahito / neck stitches', 0.05)
      .block(0, 0.1, 0, 0.3, 0.25, 0.32, C.skin)
      .block(0, 0.13, 0.18, 0.3, 0.04, 0.05, C.seam)
      .bake();
    s = S(r.head, 'Mahito / stitched face and mismatched eyes', 0.04);
    s.block(0, 0.58, 0, 0.8, 0.72, 0.72, C.skin)
      .block(0, 0.16, 0.04, 0.56, 0.2, 0.56, C.skinD)
      .block(0, 0.3, 0.08, 0.72, 0.16, 0.64, C.skin);
    s.block(0, 0.53, 0.4, 0.12, 0.2, 0.12, C.light)
      .block(-0.2, 0.63, 0.38, 0.24, 0.12, 0.08, C.light)
      .block(0.2, 0.63, 0.38, 0.24, 0.12, 0.08, C.light);
    s.block(-0.18, 0.63, 0.44, 0.08, 0.12, 0.04, 0x75a8b3).block(
      0.22,
      0.63,
      0.44,
      0.08,
      0.12,
      0.04,
      0x897851
    );
    s.block(-0.18, 0.63, 0.48, 0.04, 0.08, 0.04, C.black).block(0.22, 0.63, 0.48, 0.04, 0.08, 0.04, C.black);
    s.stroke(
      [
        [-0.32, 0.76, 0.4],
        [-0.2, 0.8, 0.44],
        [-0.08, 0.76, 0.4]
      ],
      0.04,
      C.hairD
    ).stroke(
      [
        [0.1, 0.76, 0.4],
        [0.26, 0.8, 0.4],
        [0.34, 0.76, 0.4]
      ],
      0.04,
      C.hairD
    );
    s.stroke(
      [
        [-0.36, 0.95, 0.4],
        [-0.28, 0.68, 0.44],
        [-0.24, 0.48, 0.44],
        [0.08, 0.32, 0.44],
        [0.36, 0.4, 0.4]
      ],
      0.04,
      C.seam
    );
    for (i = 0; i < 5; i++) s.block(-0.31 + i * 0.015, 0.87 - i * 0.08, 0.46, 0.12, 0.04, 0.04, C.seam);
    for (i = 0; i < 5; i++) s.block(-0.18 + i * 0.11, 0.45 - i * 0.022, 0.46, 0.04, 0.12, 0.04, C.seam);
    s.stroke(
      [
        [-0.13, 0.24, 0.4],
        [0.03, 0.2, 0.4],
        [0.19, 0.25, 0.4]
      ],
      0.04,
      0x79594e
    ).bake();
    s = S(r.head, 'Mahito / layered blue-grey hair', 0.06);
    s.block(0, 1.01, -0.06, 0.9, 0.26, 0.84, C.hair).block(0, 0.67, -0.43, 0.84, 0.72, 0.24, C.hairD);
    for (i = 0; i < 9; i++) {
      var x = -0.48 + i * 0.12,
        tip = i === 0 || i === 8 ? 0.48 : 0.79 + Math.sin(i) * 0.055;
      s.stroke(
        [
          [x * 0.8, 1.16, -0.06],
          [x, 1.04, 0.24],
          [x * 0.98, 0.9, 0.42],
          [x * 0.9, tip, 0.46]
        ],
        0.12,
        i % 3 === 0 ? C.hairL : C.hair
      );
      if (i < 3 || i > 6)
        s.stroke(
          [
            [x, 1, -0.12],
            [x * 1.15, 0.6, -0.08],
            [x * 1.2, 0.05, 0.02],
            [x * 1.3, -0.2, 0.15]
          ],
          0.18,
          i % 2 ? C.hair : C.hairD
        );
      s.stroke(
        [
          [x * 0.85, 1.05, -0.38],
          [x, 0.5, -0.55],
          [x * 0.9, 0.1, -0.5]
        ],
        0.12,
        i % 2 ? C.hair : C.hairD
      );
    }
    s.bake();
    [-1, 1].forEach(function (sign) {
      var braid = new THREE.Group();
      braid.position.set(sign * 0.43, 0.18, -0.42);
      r.head.add(braid);
      r.mh.braids.push(braid);
      var b = S(braid, 'Mahito / tied segmented hair', 0.06);
      for (var k = 0; k < 9; k++)
        b.block(
          Math.sin(k * 1.5) * 0.05,
          -k * 0.13,
          0,
          0.24 - (k > 6 ? 0.06 : 0),
          0.18,
          0.24,
          k % 2 ? C.hairD : C.hair
        );
      b.block(0, -0.83, 0, 0.3, 0.12, 0.3, C.black);
      b.stroke(
        [
          [0, -0.9, 0],
          [0.12 * sign, -1.25, 0.12],
          [0.06 * sign, -1.38, 0.12]
        ],
        0.12,
        C.hair
      );
      b.bake();
    });
    s = S(r.hips, 'Mahito / waistband and trouser pleats', 0.06);
    s.block(0, 0.36, 0, 1, 0.7, 0.6, C.black).block(0, 0.68, 0, 1.08, 0.12, 0.66, C.fold);
    s.stroke(
      [
        [-0.43, 0.5, 0.34],
        [-0.26, 0.23, 0.34],
        [-0.2, 0.06, 0.34]
      ],
      0.06,
      C.fold
    )
      .stroke(
        [
          [0.45, 0.55, 0.34],
          [0.2, 0.3, 0.34],
          [0.12, 0.12, 0.34]
        ],
        0.06,
        C.fold
      )
      .bake();
    [-1, 1].forEach(function (sign) {
      var skirt = new THREE.Group();
      skirt.position.set(sign * 0.38, 0.02, 0);
      r.hips.add(skirt);
      r.mh.coat.push(skirt);
      S(skirt, 'Mahito / split tunic hem', 0.06)
        .block(0, -0.1, -0.05, 0.42, 0.6, 0.72, C.cloth)
        .block(sign * 0.1, -0.28, 0.3, 0.18, 0.24, 0.12, C.fold)
        .bake();
    });
    ['L', 'R'].forEach(function (side) {
      var bare = side === 'L',
        up = S(r['shoulder' + side], 'Mahito / ' + side + ' upper arm', 0.06);
      up.block(0, -0.12, 0, 0.48, 0.42, 0.48, bare ? C.skin : C.cloth).block(
        0,
        -0.56,
        0,
        0.36,
        0.7,
        0.36,
        bare ? C.skin : C.cloth
      );
      if (bare) {
        up.block(0, -0.27, 0, 0.48, 0.12, 0.48, C.cloth)
          .block(0, -0.55, 0, 0.42, 0.12, 0.42, C.cloth)
          .stroke(
            [
              [-0.12, -0.7, 0.2],
              [0.12, -0.87, 0.2]
            ],
            0.06,
            C.seam
          );
      } else {
        up.block(0, -0.18, 0.25, 0.48, 0.12, 0.06, C.fold);
        up.stroke(
          [
            [-0.12, -0.3, 0.22],
            [0.06, -0.58, 0.22],
            [-0.06, -0.88, 0.2]
          ],
          0.06,
          C.patch
        );
      }
      up.bake();
      var el = r['elbow' + side],
        normal = new THREE.Group();
      el.add(normal);
      r.mh.normal.push(normal);
      var fore = S(normal, 'Mahito / ' + side + ' forearm and fingers', 0.06);
      fore
        .block(0, -0.4, 0, 0.3, 0.8, 0.3, bare ? C.skin : C.cloth)
        .block(0, -0.87, 0, 0.3, 0.18, 0.3, C.skin);
      fore.block(0, -1.05, 0.03, 0.3, 0.24, 0.24, C.skin);
      for (i = 0; i < 4; i++)
        fore.block(-0.12 + i * 0.08, -1.23 + (i % 3 === 0 ? 0.05 : 0), 0.08, 0.06, 0.22, 0.12, C.skin);
      fore.block(-0.2, -1, 0.06, 0.12, 0.24, 0.12, C.skin);
      if (bare) {
        fore.stroke(
          [
            [-0.12, -0.15, 0.18],
            [0.08, -0.42, 0.18],
            [0.02, -0.7, 0.18]
          ],
          0.06,
          C.seam
        );
        for (i = 0; i < 4; i++) fore.block(0, -0.25 - i * 0.12, 0.2, 0.18, 0.06, 0.06, C.skinD);
      }
      fore.bake();
      var blade = new THREE.Group();
      el.add(blade);
      r.mh.blade.push(blade);
      s = S(blade, 'Mahito / stepped arm blade', 0.08);
      s.block(0, -0.22, 0, 0.4, 0.48, 0.4, C.skinD);
      for (i = 0; i < 13; i++) s.block(0, -0.5 - i * 0.15, 0.06, 0.4 * (1 - i / 15), 0.24, 0.22, C.skin);
      s.stroke(
        [
          [0.18, -0.5, 0.12],
          [0.12, -1.4, 0.12],
          [0, -2.4, 0.12]
        ],
        0.08,
        C.light
      );
      s.bake();
      blade.visible = false;
      var club = new THREE.Group();
      el.add(club);
      r.mh.club.push(club);
      s = S(club, 'Mahito / ribbed flesh club', 0.1);
      s.block(0, -0.22, 0, 0.4, 0.5, 0.4, C.skinD)
        .block(0, -0.85, 0, 0.72, 0.9, 0.72, C.skin)
        .block(0, -1.45, 0.05, 1, 0.5, 0.8, C.skinD);
      for (i = 0; i < 4; i++) s.block(-0.38 + i * 0.25, -1.4, 0.48, 0.2, 0.6, 0.16, C.skin);
      s.bake();
      club.visible = false;
      var hammer = new THREE.Group();
      el.add(hammer);
      r.mh.hammers.push(hammer);
      s = S(hammer, 'Mahito / ' + side + ' transfigured hammer', 0.12);
      s.block(0, -1.5, 0, 0.24, 1.1, 0.24, C.skinD)
        .block(0, -2.1, 0, 1.4, 0.84, 0.84, bare ? C.green : C.purple)
        .block(0, -2.1, 0.48, 0.6, 0.48, 0.12, C.skinD);
      s.block(-0.2, -2, 0.6, 0.12, 0.12, 0.12, C.black)
        .block(0.2, -2, 0.6, 0.12, 0.12, 0.12, C.black)
        .block(0, -2.25, 0.6, 0.48, 0.12, 0.12, C.black);
      s.bake();
      hammer.visible = false;
      s = S(r['hip' + side], 'Mahito / ' + side + ' trouser thigh', 0.06);
      s.block(0, -0.58, 0, 0.48, 1.16, 0.48, C.cloth).block(0.06, -0.9, 0.25, 0.12, 0.36, 0.06, C.fold);
      s.stroke(
        [
          [-0.12, -0.1, 0.27],
          [0.06, -0.4, 0.27],
          [-0.06, -0.72, 0.27]
        ],
        0.06,
        C.fold
      );
      s.bake();
      s = S(r['knee' + side], 'Mahito / ' + side + ' tapered trouser calf', 0.06);
      s.block(0, -0.38, 0, 0.42, 0.78, 0.42, C.cloth).block(0, -0.94, 0, 0.36, 0.36, 0.36, C.black);
      s.stroke(
        [
          [0.12, -0.06, 0.24],
          [0.06, -0.4, 0.24],
          [-0.06, -0.8, 0.18]
        ],
        0.06,
        C.fold
      );
      s.bake();
      S(r['ankle' + side], 'Mahito / ' + side + ' split toe shoes', 0.06)
        .block(0, -0.12, 0.12, 0.42, 0.24, 0.66, C.black)
        .block(0, -0.22, 0.14, 0.42, 0.06, 0.72, C.fold)
        .bake();
    });
    r.mh.gun = new THREE.Group();
    r.elbowR.add(r.mh.gun);
    S(r.mh.gun, 'Mahito / flesh barrel', 0.08)
      .block(0, -0.58, 0, 0.56, 1.12, 0.56, C.skinD)
      .block(0, -1.24, 0, 0.72, 0.32, 0.64, C.skin)
      .block(0, -1.44, 0, 0.4, 0.08, 0.4, C.black)
      .block(-0.32, -0.62, 0.24, 0.16, 0.48, 0.16, C.seam)
      .bake();
    r.mh.gun.visible = false;
    r.mh.drill = new THREE.Group();
    r.elbowR.add(r.mh.drill);
    s = S(r.mh.drill, 'Mahito / spiral voxel drill', 0.1);
    for (i = 0; i < 20; i++) {
      var rad = 0.7 * (1 - i / 22),
        ang = i * 0.9;
      s.block(
        Math.cos(ang) * rad * 0.5,
        -0.4 - i * 0.13,
        Math.sin(ang) * rad * 0.5,
        rad,
        0.2,
        rad,
        i % 3 ? C.skinD : C.light
      );
    }
    s.bake();
    r.mh.drill.visible = false;
    return r;
  };
  V.mode = function (r, mode, action) {
    if (!r || !r.mh) return;
    var m = r.mh;
    m.mode = mode;
    action = action || '';
    var hammer = action === 'mh_stock' || action === 'mh_air' || action === 'mh_fin_air',
      gun = action === 'mh_fire',
      drill = action === 'mh_drill';
    m.normal.forEach(function (g, i) {
      g.visible =
        mode === 0 &&
        !(hammer && (action !== 'mh_air' || i === 1)) &&
        !(gun && i === 1) &&
        !(drill && i === 1);
    });
    m.blade.forEach((g) => (g.visible = mode === 1 && !hammer && !gun && !drill));
    m.club.forEach((g) => (g.visible = mode === 2 && !hammer && !gun && !drill));
    m.hammers.forEach((g, i) => (g.visible = hammer && (action !== 'mh_air' || i === 1)));
    m.gun.visible = gun;
    m.drill.visible = drill;
  };
})();
