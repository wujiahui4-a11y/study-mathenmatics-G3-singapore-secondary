/* =======================================================================
   MAPS
   The original arena was a ring of boxes and four more sitting in the
   road. Crates landed inside walls. This file owns the city.

   Four maps, and a plaza in the middle of each so the fight has a floor:

     city      the streets you already know, laid out on four full blocks
     crossing  a wide intersection and the towers on its four corners
     campus    the school — a courtyard and the halls around it
     yard      the long lane between the sheds

   The creator of a room picks one. Everybody else loads that same map.
   Buildings never sit in a street, never overlap, and never close the
   plaza. A crate that would land inside a wall is not placed.
   ===================================================================== */
(function () {
  'use strict';
  if (typeof scene === 'undefined' || typeof THREE === 'undefined') return;
  if (typeof buildingAABBs === 'undefined' || typeof addBuilding === 'undefined') return;

  var roofMat = new THREE.MeshStandardMaterial({ color: 0x2a2d34, roughness: .88 });
  var plinthMat = new THREE.MeshStandardMaterial({ color: 0x4a4e56, roughness: .92 });
  var stoneMat = new THREE.MeshStandardMaterial({ color: 0x6a6258, roughness: .9 });
  var woodMat = new THREE.MeshStandardMaterial({ color: 0x3a322c, roughness: .86 });
  var rustMat = new THREE.MeshStandardMaterial({ color: 0x5a4034, roughness: .9 });
  var steelMat = new THREE.MeshStandardMaterial({ color: 0x6a7278, roughness: .7 });
  var darkWin = buildingMats[0];
  var warmWin = buildingMats[1];
  var goldWin = buildingMats[2];

  var schoolMats = [
    new THREE.MeshStandardMaterial({ map: buildingTex('#5c5348', '#e8d8a8'), roughness: .84 }),
    new THREE.MeshStandardMaterial({ map: buildingTex('#4a4550', '#c8d8e8'), roughness: .84 })
  ];
  var yardMats = [
    new THREE.MeshStandardMaterial({ map: buildingTex('#6a6460', '#c4b48a'), roughness: .86 }),
    new THREE.MeshStandardMaterial({ map: buildingTex('#4e5458', '#9ad0e8'), roughness: .8 })
  ];

  var decor = new THREE.Group();
  decor.name = 'jjMapDecor';
  scene.add(decor);

  var LIST = [
    { id: 'city', name: 'CITY STREETS', sub: 'four blocks around the plaza', size: 124 },
    { id: 'crossing', name: 'THE CROSSING', sub: 'four towers, one intersection', size: 176 },
    { id: 'campus', name: 'THE SCHOOL', sub: 'courtyard and the halls around it', size: 164 },
    { id: 'yard', name: 'TRAIN YARD', sub: 'the long lane between the sheds', size: 184 }
  ];

  var JJMAP = window.JJMAP = {
    id: 'city',
    list: LIST,
    load: load,
    spawn: spawn,
    nameOf: nameOf
  };

  var spawns = [{ x: 0, z: 20 }];
  var rejected = 0;
  var rules = { street: 0, plaza: null };

  function nameOf(id) {
    var i;
    for (i = 0; i < LIST.length; i++) if (LIST[i].id === id) return LIST[i].name;
    return 'CITY STREETS';
  }

  function info(id) {
    var i;
    for (i = 0; i < LIST.length; i++) if (LIST[i].id === id) return LIST[i];
    return LIST[0];
  }

  /* -------------------------------------------------------------- world */
  function setWorld(size, sky, fogNear, fogFar) {
    ARENA = size;
    if (ground.geometry) ground.geometry.dispose();
    ground.geometry = new THREE.PlaneGeometry(size * 2 + 80, size * 2 + 80);
    var half = size + 36;
    sun.shadow.camera.left = -half;
    sun.shadow.camera.right = half;
    sun.shadow.camera.top = half;
    sun.shadow.camera.bottom = -half;
    sun.shadow.camera.far = size * 3 + 80;
    sun.shadow.camera.updateProjectionMatrix();
    scene.background = new THREE.Color(sky);
    if (scene.fog) {
      scene.fog.color.set(sky);
      scene.fog.near = fogNear;
      scene.fog.far = fogFar;
    }
    camera.far = Math.max(800, size * 5);
    camera.updateProjectionMatrix();
  }

  function paintGround(draw, tiles) {
    var t = canvasTex(256, 256, draw, tiles || 18, tiles || 18);
    if (ground.material.map) ground.material.map.dispose();
    ground.material.map = t;
    ground.material.needsUpdate = true;
  }

  function clearWorld() {
    var i, b, k;
    for (i = buildingAABBs.length - 1; i >= 0; i--) {
      b = buildingAABBs[i];
      if (b.mesh) scene.remove(b.mesh);
      if (b.extras) for (k = 0; k < b.extras.length; k++) scene.remove(b.extras[k]);
    }
    buildingAABBs.length = 0;
    for (i = crates.length - 1; i >= 0; i--) scene.remove(crates[i].mesh);
    crates.length = 0;
    while (decor.children.length) decor.remove(decor.children[0]);
    rejected = 0;
  }

  /* gap 3.2 plus the 0.6 collision pad — alleys stay walkable, nothing kisses */
  function overlaps(x, z, w, d, gap) {
    var g = gap == null ? 3.2 : gap;
    var minX = x - w / 2 - g, maxX = x + w / 2 + g;
    var minZ = z - d / 2 - g, maxZ = z + d / 2 + g;
    var i, b;
    for (i = 0; i < buildingAABBs.length; i++) {
      b = buildingAABBs[i];
      if (minX < b.maxX && maxX > b.minX && minZ < b.maxZ && maxZ > b.minZ) return true;
    }
    return false;
  }

  function inCross(x, z, w, d, street) {
    var hx = w / 2, hz = d / 2, s = street / 2;
    if (x - hx < s && x + hx > -s) return true;
    if (z - hz < s && z + hz > -s) return true;
    return false;
  }

  function inRect(x, z, w, d, x0, z0, x1, z1) {
    return !(x + w / 2 < x0 || x - w / 2 > x1 || z + d / 2 < z0 || z - d / 2 > z1);
  }

  function fits(x, z, w, d, street, plaza) {
    if (Math.abs(x) + w / 2 > ARENA - 3 || Math.abs(z) + d / 2 > ARENA - 3) return false;
    if (street && inCross(x, z, w, d, street)) return false;
    if (plaza && inRect(x, z, w, d, plaza[0], plaza[1], plaza[2], plaza[3])) return false;
    if (overlaps(x, z, w, d, 3.2)) return false;
    return true;
  }

  function blocked(x, z, r) {
    var i, b;
    r = r || 1.4;
    if (Math.abs(x) > ARENA - 2 || Math.abs(z) > ARENA - 2) return true;
    for (i = 0; i < buildingAABBs.length; i++) {
      b = buildingAABBs[i];
      if (x + r > b.minX && x - r < b.maxX && z + r > b.minZ && z - r < b.maxZ) return true;
    }
    return false;
  }

  function place(x, z, w, d, h, mat, street, plaza, topped) {
    if (!fits(x, z, w, d, street, plaza)) {
      rejected++;
      return null;
    }
    var m = addBuilding(x, z, w, d, h, mat);
    var last = buildingAABBs[buildingAABBs.length - 1];
    var plinth = new THREE.Mesh(new THREE.BoxGeometry(w + 1.1, .45, d + 1.1), plinthMat);
    plinth.position.set(x, .22, z);
    plinth.receiveShadow = true;
    scene.add(plinth);
    var roof = new THREE.Mesh(new THREE.BoxGeometry(w + 1.4, .7, d + 1.4), roofMat);
    roof.position.set(x, h + .35, z);
    roof.castShadow = true;
    scene.add(roof);
    last.extras.push(plinth, roof);
    if (topped) {
      var tw = w * 0.56, td = d * 0.56, th = Math.max(5, h * 0.24);
      var cap = new THREE.Mesh(new THREE.BoxGeometry(tw, th, td), mat || roofMat);
      cap.position.set(x, h + th / 2, z);
      cap.castShadow = true;
      scene.add(cap);
      last.extras.push(cap);
    }
    return m;
  }

  function drop(list, street, plaza, mats) {
    var i, t, mat;
    for (i = 0; i < list.length; i++) {
      t = list[i];
      mat = t[6] || mats[i % mats.length];
      place(t[0], t[1], t[2], t[3], t[4], mat, street, plaza, t[5]);
    }
  }

  function quad(list, street, plaza, mats) {
    var q, sx, sz, i, t, mat, signs = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
    for (q = 0; q < 4; q++) {
      sx = signs[q][0]; sz = signs[q][1];
      for (i = 0; i < list.length; i++) {
        t = list[i];
        mat = t[6] || mats[(q + i) % mats.length];
        place(sx * t[0], sz * t[1], t[2], t[3], t[4] + (q % 3), mat, street, plaza, t[5]);
      }
    }
  }

  function flat(x, z, w, d, y, mat) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, .12, d), mat);
    m.position.set(x, y == null ? .06 : y, z);
    m.receiveShadow = true;
    decor.add(m);
    return m;
  }

  function lamp(x, z) {
    if (blocked(x, z, 1.2)) return;
    var pole = new THREE.Mesh(new THREE.BoxGeometry(.22, 7.2, .22), steelMat);
    pole.position.set(x, 3.6, z);
    pole.castShadow = true;
    decor.add(pole);
    var head = new THREE.Mesh(new THREE.BoxGeometry(1.1, .28, .6), goldWin);
    head.position.set(x, 7.2, z);
    decor.add(head);
  }

  function crate(x, z) {
    if (blocked(x, z, 1.5)) return;
    addCrate(x, z);
  }

  function spawn() {
    var n = spawns.length || 1;
    var mp = window.MPJJ;
    var i = Math.abs((mp && mp.id ? hash(mp.id) : (Math.random() * 99) | 0)) % n;
    var s = spawns[i] || { x: 0, z: 20 };
    if (blocked(s.x, s.z, 1.6)) return { x: 0, z: 18 };
    return { x: s.x, z: s.z };
  }

  function hash(s) {
    var h = 0, i;
    for (i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return h;
  }

  /* -------------------------------------------------------------- maps */
  function buildCity() {
    setWorld(124, 0x87b8e8, 110, 320);
    paintGround(function (g) {
      g.fillStyle = '#4e535a'; g.fillRect(0, 0, 256, 256);
      var i;
      for (i = 0; i < 700; i++) {
        g.fillStyle = Math.random() < .5 ? '#484d54' : '#555b62';
        g.fillRect(Math.random() * 256, Math.random() * 256, 3, 3);
      }
      g.fillStyle = '#6a6f76';
      g.fillRect(96, 0, 64, 256);
      g.fillRect(0, 96, 256, 64);
      g.fillStyle = '#d8d2c0';
      g.fillRect(124, 0, 8, 40); g.fillRect(124, 56, 8, 40);
      g.fillRect(124, 160, 8, 40); g.fillRect(124, 216, 8, 40);
      g.fillRect(0, 124, 40, 8); g.fillRect(56, 124, 40, 8);
      g.fillRect(160, 124, 40, 8); g.fillRect(216, 124, 40, 8);
    }, 16);
    var street = 36;
    var plaza = [-20, -20, 20, 20];
    rules = { street: street, plaza: plaza };
    var mats = [darkWin, warmWin, goldWin];
    /* one block, mirrored onto all four corners. Alleys are 8–10 units. */
    quad([
      [36, 36, 18, 16, 26],
      [64, 36, 20, 16, 32],
      [94, 36, 18, 16, 44],
      [36, 64, 16, 18, 28],
      [64, 64, 22, 20, 40, true],
      [94, 64, 16, 18, 48],
      [36, 94, 16, 18, 30],
      [64, 94, 20, 16, 38],
      [94, 94, 18, 18, 52, true],
      [114, 114, 14, 14, 68, true]
    ], street, plaza, mats);
    sidewalks(street);
    zebra(0, 24, 20, 7, true);
    zebra(0, -24, 20, 7, true);
    zebra(24, 0, 7, 20, false);
    zebra(-24, 0, 7, 20, false);
    lampsAt(40);
    cratesAlong(street);
    crate(28, 28); crate(-28, 28); crate(28, -28); crate(-28, -28);
    spawns = [
      { x: -16, z: 18 }, { x: 16, z: 18 }, { x: -16, z: -18 }, { x: 16, z: -18 },
      { x: 0, z: 22 }, { x: 0, z: -22 }
    ];
  }

  function buildCrossing() {
    setWorld(176, 0x6e8aaa, 140, 420);
    paintGround(function (g) {
      g.fillStyle = '#3e444c'; g.fillRect(0, 0, 256, 256);
      var i;
      for (i = 0; i < 800; i++) {
        g.fillStyle = Math.random() < .5 ? '#383e46' : '#464c54';
        g.fillRect(Math.random() * 256, Math.random() * 256, 3, 3);
      }
      g.fillStyle = '#5a616a';
      g.fillRect(88, 0, 80, 256);
      g.fillRect(0, 88, 256, 80);
      g.fillStyle = '#e8e2d4';
      for (i = 0; i < 8; i++) {
        g.fillRect(96 + i * 8, 70, 5, 16);
        g.fillRect(96 + i * 8, 170, 5, 16);
        g.fillRect(70, 96 + i * 8, 16, 5);
        g.fillRect(170, 96 + i * 8, 16, 5);
      }
    }, 14);
    var street = 54;
    var plaza = [-28, -28, 28, 28];
    rules = { street: street, plaza: plaza };
    var mats = [darkWin, warmWin, goldWin];
    /* tower on the corner of the intersection, then the mid-rises behind it */
    quad([
      [50, 50, 26, 26, 80, true],
      [50, 90, 22, 20, 44],
      [90, 50, 20, 22, 42],
      [90, 90, 24, 22, 50, true],
      [50, 128, 24, 18, 36],
      [128, 50, 18, 24, 34],
      [92, 130, 20, 16, 32],
      [130, 92, 16, 20, 30],
      [132, 132, 22, 22, 54, true],
      [158, 100, 16, 18, 28],
      [100, 158, 18, 16, 28],
      [158, 158, 16, 16, 46, true]
    ], street, plaza, mats);
    sidewalks(street);
    lampsAt(56);
    zebra(0, 38, 24, 8, true);
    zebra(0, -38, 24, 8, true);
    zebra(38, 0, 8, 24, false);
    zebra(-38, 0, 8, 24, false);
    cratesAlong(street);
    crate(36, 36); crate(-36, 36); crate(36, -36); crate(-36, -36);
    spawns = [
      { x: -24, z: 24 }, { x: 24, z: 24 }, { x: -24, z: -24 }, { x: 24, z: -24 },
      { x: 0, z: 30 }, { x: 0, z: -30 }, { x: 30, z: 0 }, { x: -30, z: 0 }
    ];
  }

  function buildCampus() {
    setWorld(164, 0xb4cce0, 130, 380);
    paintGround(function (g) {
      g.fillStyle = '#7a8a6e'; g.fillRect(0, 0, 256, 256);
      var i;
      for (i = 0; i < 500; i++) {
        g.fillStyle = Math.random() < .5 ? '#738266' : '#829072';
        g.fillRect(Math.random() * 256, Math.random() * 256, 4, 4);
      }
      g.fillStyle = '#c4b49a';
      g.fillRect(68, 72, 120, 112);
      g.fillStyle = '#b0a088';
      g.fillRect(118, 0, 20, 256);
      g.fillRect(0, 118, 256, 20);
    }, 14);
    var plaza = [-40, -34, 40, 34];
    rules = { street: 0, plaza: plaza };
    var a = schoolMats[0], b = schoolMats[1];
    /* hall short enough that the wings sit on the ends, not inside it */
    drop([
      [0, 74, 68, 20, 26, true, a],
      [-56, 74, 22, 16, 18, false, b],
      [56, 74, 22, 16, 18, false, b],
      [-56, 104, 22, 16, 14, false, a],
      [56, 104, 22, 16, 14, false, a],
      [0, 104, 36, 16, 12, false, stoneMat],
      [0, 132, 40, 16, 12, false, stoneMat],
      [80, 6, 20, 52, 20, false, b],
      [-80, 6, 20, 52, 20, false, b],
      [80, 52, 18, 20, 16, false, a],
      [-80, 52, 18, 20, 16, false, a],
      [80, -40, 18, 22, 16, false, a],
      [-80, -40, 18, 22, 16, false, a],
      [44, -76, 32, 18, 16, false, a],
      [-44, -76, 32, 18, 16, false, a],
      [0, -76, 24, 18, 14, false, stoneMat],
      [80, -76, 20, 18, 14, false, woodMat],
      [-80, -76, 20, 18, 14, false, woodMat],
      [0, -118, 36, 16, 14, false, a],
      [80, -110, 20, 16, 12, false, b],
      [-80, -110, 20, 16, 12, false, b],
      [120, 6, 16, 32, 14, false, b],
      [-120, 6, 16, 32, 14, false, b],
      [120, 74, 16, 20, 14, false, a],
      [-120, 74, 16, 20, 14, false, a],
      [120, -76, 16, 18, 12, false, a],
      [-120, -76, 16, 18, 12, false, a]
    ], 0, plaza, schoolMats);
    var path = new THREE.MeshStandardMaterial({ color: 0xb8a888, roughness: .95 });
    flat(0, 0, 16, 68, .05, path);
    flat(0, 0, 80, 14, .05, path);
    lamp(-22, 22); lamp(22, 22); lamp(-22, -22); lamp(22, -22);
    lamp(-40, 0); lamp(40, 0); lamp(0, 40); lamp(0, -40);
    crate(-30, -42); crate(30, -42); crate(-30, 42); crate(30, 42);
    crate(-60, -22); crate(60, -22); crate(-60, 22); crate(60, 22);
    spawns = [
      { x: -20, z: 16 }, { x: 20, z: 16 }, { x: -20, z: -16 }, { x: 20, z: -16 },
      { x: 0, z: 22 }, { x: 0, z: -22 }
    ];
  }

  function buildYard() {
    setWorld(184, 0x8aa0a8, 150, 440);
    paintGround(function (g) {
      g.fillStyle = '#5a5e62'; g.fillRect(0, 0, 256, 256);
      var i;
      for (i = 0; i < 600; i++) {
        g.fillStyle = Math.random() < .5 ? '#54585c' : '#62666a';
        g.fillRect(Math.random() * 256, Math.random() * 256, 3, 3);
      }
      g.fillStyle = '#2a2c2e';
      g.fillRect(0, 108, 256, 6);
      g.fillRect(0, 142, 256, 6);
      g.fillStyle = '#8a7a62';
      for (i = 0; i < 16; i++) g.fillRect(i * 16, 100, 8, 56);
    }, 12);
    var plaza = [-90, -24, 90, 24];
    rules = { street: 0, plaza: plaza };
    var y0 = yardMats[0], y1 = yardMats[1];
    drop([
      [-100, 58, 44, 22, 16, false, y0],
      [-48, 58, 40, 22, 14, false, y1],
      [4, 58, 40, 22, 15, false, y0],
      [54, 58, 36, 22, 18, false, rustMat],
      [104, 58, 36, 22, 16, false, y1],
      [148, 58, 28, 22, 17, false, rustMat],
      [-100, -58, 44, 22, 15, false, y1],
      [-48, -58, 40, 22, 14, false, y0],
      [4, -58, 40, 22, 16, false, y1],
      [54, -58, 36, 22, 14, false, rustMat],
      [104, -58, 36, 22, 15, false, y0],
      [148, -58, 28, 22, 16, false, rustMat],
      [-160, 0, 20, 36, 22, true, steelMat],
      [160, 0, 20, 36, 22, true, steelMat],
      [-100, 94, 28, 16, 22, false, y1],
      [-48, 94, 24, 16, 20, false, y0],
      [4, 94, 24, 16, 21, false, y1],
      [54, 94, 24, 16, 20, false, y0],
      [104, 94, 24, 16, 22, false, y1],
      [148, 94, 22, 16, 18, false, y0],
      [-100, -94, 28, 16, 18, false, y0],
      [-48, -94, 24, 16, 20, false, y1],
      [4, -94, 24, 16, 18, false, y0],
      [54, -94, 24, 16, 19, false, y1],
      [104, -94, 24, 16, 18, false, y0],
      [148, -94, 22, 16, 20, false, y1],
      [0, 128, 18, 18, 36, true, steelMat],
      [0, -128, 18, 18, 32, true, steelMat],
      [-160, 94, 18, 16, 16, false, rustMat],
      [172, 94, 14, 16, 16, false, rustMat],
      [-160, -94, 18, 16, 16, false, rustMat],
      [172, -94, 14, 16, 16, false, rustMat]
    ], 0, plaza, yardMats);
    var i, x;
    for (i = -5; i <= 5; i++) {
      x = i * 16;
      crate(x, 34);
      crate(x + 3, -34);
    }
    lamp(-40, 30); lamp(40, 30); lamp(-40, -30); lamp(40, -30);
    lamp(0, 30); lamp(0, -30); lamp(-80, 30); lamp(80, 30);
    lamp(-80, -30); lamp(80, -30);
    flat(0, 32, 168, 4, .18, steelMat);
    flat(0, -32, 168, 4, .18, steelMat);
    spawns = [
      { x: -36, z: 12 }, { x: 36, z: 12 }, { x: -36, z: -12 }, { x: 36, z: -12 },
      { x: 0, z: 14 }, { x: 0, z: -14 }, { x: 60, z: 0 }, { x: -60, z: 0 }
    ];
  }

  function sidewalks(street) {
    var s = street / 2;
    var curb = new THREE.MeshStandardMaterial({ color: 0x8a8680, roughness: .95 });
    var start = s + 6;
    var end = ARENA - 10;
    var len = Math.max(24, end - start);
    var mid = (start + end) / 2;
    flat(s + .6, mid, 1.2, len, .1, curb);
    flat(-(s + .6), mid, 1.2, len, .1, curb);
    flat(s + .6, -mid, 1.2, len, .1, curb);
    flat(-(s + .6), -mid, 1.2, len, .1, curb);
    flat(mid, s + .6, len, 1.2, .1, curb);
    flat(-mid, s + .6, len, 1.2, .1, curb);
    flat(mid, -(s + .6), len, 1.2, .1, curb);
    flat(-mid, -(s + .6), len, 1.2, .1, curb);
  }

  function lampsAt(r) {
    lamp(r, r); lamp(-r, r); lamp(r, -r); lamp(-r, -r);
    lamp(r, 0); lamp(-r, 0); lamp(0, r); lamp(0, -r);
  }

  function cratesAlong(street) {
    var s = street / 2 + 5;
    var pts = [
      [s, s], [-s, s], [s, -s], [-s, -s],
      [s + 12, s], [-s - 12, s], [s + 12, -s], [-s - 12, -s]
    ];
    var i;
    for (i = 0; i < pts.length; i++) crate(pts[i][0], pts[i][1]);
  }

  function zebra(x, z, w, d, acrossX) {
    var paint = new THREE.MeshStandardMaterial({ color: 0xe8e2d4, roughness: .7 });
    var n = 6, i, o;
    for (i = 0; i < n; i++) {
      o = (i - (n - 1) / 2) * 2.2;
      if (acrossX) flat(x + o, z, 1.2, d, .08, paint);
      else flat(x, z + o, w, 1.2, .08, paint);
    }
  }

  function load(id) {
    if (!id) id = 'city';
    if (id !== 'city' && id !== 'crossing' && id !== 'campus' && id !== 'yard') id = 'city';
    if (JJMAP.id === id && buildingAABBs.length) return id;
    clearWorld();
    JJMAP.id = id;
    if (id === 'crossing') buildCrossing();
    else if (id === 'campus') buildCampus();
    else if (id === 'yard') buildYard();
    else buildCity();
    if (typeof player !== 'undefined' && player && player.pos) {
      collideWorld(player.pos, 1.2);
    }
    return id;
  }

  function meshSize(b) {
    return {
      x: b.mesh.position.x,
      z: b.mesh.position.z,
      w: (b.maxX - b.minX) - 1.2,
      d: (b.maxZ - b.minZ) - 1.2
    };
  }

  JJMAP.audit = function () {
    var i, j, a, b, m, overlapsN = 0, cratesIn = 0, inStreet = 0, inPlaza = 0;
    for (i = 0; i < buildingAABBs.length; i++) {
      for (j = i + 1; j < buildingAABBs.length; j++) {
        a = buildingAABBs[i]; b = buildingAABBs[j];
        if (a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ) overlapsN++;
      }
      m = meshSize(buildingAABBs[i]);
      if (rules.street && inCross(m.x, m.z, m.w, m.d, rules.street)) inStreet++;
      if (rules.plaza && inRect(m.x, m.z, m.w, m.d, rules.plaza[0], rules.plaza[1], rules.plaza[2], rules.plaza[3])) inPlaza++;
    }
    for (i = 0; i < crates.length; i++) {
      if (blocked(crates[i].mesh.position.x, crates[i].mesh.position.z, 0.7)) cratesIn++;
    }
    return {
      id: JJMAP.id, arena: ARENA, buildings: buildingAABBs.length,
      crates: crates.length, overlaps: overlapsN, cratesInWalls: cratesIn,
      inStreet: inStreet, inPlaza: inPlaza, rejected: rejected
    };
  };

  /* the default city, built properly, replaces the empty floor */
  load('city');
})();
