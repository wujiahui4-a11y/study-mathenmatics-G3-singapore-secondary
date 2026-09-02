/* =======================================================================
   MAPS
   The original arena was a ring of boxes and four more sitting in the
   road. Crates landed inside walls. This file owns the city.

   Four maps, and a plaza in the middle of each so the fight has a floor:

     city      the streets you already know, laid out on blocks
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
    { id: 'city', name: 'CITY STREETS', sub: 'the plaza you already know', size: 112 },
    { id: 'crossing', name: 'THE CROSSING', sub: 'four towers, one intersection', size: 168 },
    { id: 'campus', name: 'THE SCHOOL', sub: 'courtyard and the halls around it', size: 152 },
    { id: 'yard', name: 'TRAIN YARD', sub: 'the long lane between the sheds', size: 170 }
  ];

  var JJMAP = window.JJMAP = {
    id: 'city',
    list: LIST,
    load: load,
    spawn: spawn,
    nameOf: nameOf
  };

  var spawns = [{ x: 0, z: 20 }];

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
    camera.far = Math.max(700, size * 5);
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
  }

  function overlaps(x, z, w, d, gap) {
    var g = gap == null ? 6 : gap;
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
    if (overlaps(x, z, w, d, 7)) return false;
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

  function place(x, z, w, d, h, mat, street, plaza) {
    if (!fits(x, z, w, d, street, plaza)) return null;
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
    return m;
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
    setWorld(112, 0x87b8e8, 100, 280);
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
    var street = 34;
    var plaza = [-20, -20, 20, 20];
    var mats = [darkWin, warmWin, goldWin];
    var q, sx, sz, i;
    /* four blocks — each a cluster sitting back from the cross */
    var blocks = [
      [-1, -1], [1, -1], [-1, 1], [1, 1]
    ];
    for (q = 0; q < 4; q++) {
      sx = blocks[q][0]; sz = blocks[q][1];
      place(sx * 42, sz * 42, 20, 18, 34 + q * 3, mats[q % 3], street, plaza);
      place(sx * 64, sz * 40, 16, 16, 26 + q * 2, mats[(q + 1) % 3], street, plaza);
      place(sx * 40, sz * 64, 18, 14, 22 + q * 2, mats[(q + 2) % 3], street, plaza);
      place(sx * 78, sz * 62, 14, 18, 40, mats[q % 3], street, plaza);
      place(sx * 62, sz * 80, 16, 14, 30, mats[(q + 1) % 3], street, plaza);
    }
    /* skyline on the rim, still off the streets */
    for (i = 0; i < 12; i++) {
      var a = (i + .5) / 12 * Math.PI * 2;
      place(Math.cos(a) * 98, Math.sin(a) * 98, 18, 18, 36 + (i % 4) * 8, mats[i % 3], street, plaza);
    }
    sidewalks(street);
    lampsAt(38);
    cratesAlong(street);
    spawns = [
      { x: -16, z: 18 }, { x: 16, z: 18 }, { x: -16, z: -18 }, { x: 16, z: -18 },
      { x: 0, z: 22 }, { x: 0, z: -22 }
    ];
  }

  function buildCrossing() {
    setWorld(168, 0x6e8aaa, 130, 380);
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
      /* zebra */
      g.fillStyle = '#e8e2d4';
      for (i = 0; i < 8; i++) {
        g.fillRect(96 + i * 8, 70, 5, 16);
        g.fillRect(96 + i * 8, 170, 5, 16);
        g.fillRect(70, 96 + i * 8, 16, 5);
        g.fillRect(170, 96 + i * 8, 16, 5);
      }
    }, 14);
    var street = 52;
    var plaza = [-28, -28, 28, 28];
    var mats = [darkWin, warmWin, goldWin];
    var towers = [
      [-58, -58, 28, 26, 78], [58, -58, 26, 28, 72],
      [-58, 58, 28, 26, 70], [58, 58, 26, 28, 82]
    ];
    var t, i;
    for (i = 0; i < towers.length; i++) {
      t = towers[i];
      place(t[0], t[1], t[2], t[3], t[4], mats[i % 3], street, plaza);
    }
    /* mid-rise around each tower, still in the block */
    var mid = [
      [-86, -54, 18, 20, 44], [-54, -86, 20, 16, 38],
      [86, -54, 18, 20, 42], [54, -86, 20, 16, 36],
      [-86, 54, 18, 20, 40], [-54, 86, 20, 16, 46],
      [86, 54, 18, 20, 48], [54, 86, 20, 16, 40],
      [-110, -80, 16, 18, 34], [110, -80, 16, 18, 32],
      [-110, 80, 16, 18, 36], [110, 80, 16, 18, 38],
      [-80, -110, 18, 16, 30], [80, -110, 18, 16, 28],
      [-80, 110, 18, 16, 32], [80, 110, 18, 16, 34]
    ];
    for (i = 0; i < mid.length; i++) {
      t = mid[i];
      place(t[0], t[1], t[2], t[3], t[4], mats[i % 3], street, plaza);
    }
    /* far rim */
    for (i = 0; i < 16; i++) {
      var a = (i + .25) / 16 * Math.PI * 2;
      place(Math.cos(a) * 148, Math.sin(a) * 148, 20, 20, 42 + (i % 5) * 7, mats[i % 3], street, plaza);
    }
    sidewalks(street);
    lampsAt(50);
    /* crosswalk marks as raised paint */
    zebra(0, 36, 22, 8, true);
    zebra(0, -36, 22, 8, true);
    zebra(36, 0, 8, 22, false);
    zebra(-36, 0, 8, 22, false);
    cratesAlong(street);
    spawns = [
      { x: -24, z: 24 }, { x: 24, z: 24 }, { x: -24, z: -24 }, { x: 24, z: -24 },
      { x: 0, z: 30 }, { x: 0, z: -30 }, { x: 30, z: 0 }, { x: -30, z: 0 }
    ];
  }

  function buildCampus() {
    setWorld(152, 0xb4cce0, 120, 340);
    paintGround(function (g) {
      g.fillStyle = '#7a8a6e'; g.fillRect(0, 0, 256, 256);
      var i;
      for (i = 0; i < 500; i++) {
        g.fillStyle = Math.random() < .5 ? '#738266' : '#829072';
        g.fillRect(Math.random() * 256, Math.random() * 256, 4, 4);
      }
      g.fillStyle = '#c4b49a';
      g.fillRect(70, 70, 116, 116);
      g.fillStyle = '#b0a088';
      g.fillRect(118, 0, 20, 256);
      g.fillRect(0, 118, 256, 20);
    }, 14);
    var plaza = [-38, -32, 38, 32];
    /* main hall — north, long, off the courtyard */
    place(0, 72, 86, 20, 24, schoolMats[0], 0, plaza);
    place(-52, 72, 22, 16, 18, schoolMats[1], 0, plaza);
    place(52, 72, 22, 16, 18, schoolMats[1], 0, plaza);
    /* south gate houses */
    place(-48, -78, 28, 18, 16, schoolMats[0], 0, plaza);
    place(48, -78, 28, 18, 16, schoolMats[0], 0, plaza);
    /* east and west wings, parallel to the yard */
    place(78, 8, 18, 72, 20, schoolMats[1], 0, plaza);
    place(-78, 8, 18, 72, 20, schoolMats[1], 0, plaza);
    /* corner dojos */
    place(-78, -78, 20, 20, 14, woodMat, 0, plaza);
    place(78, -78, 20, 20, 14, woodMat, 0, plaza);
    place(-100, 72, 16, 16, 14, schoolMats[0], 0, plaza);
    place(100, 72, 16, 16, 14, schoolMats[0], 0, plaza);
    /* outer wall pavilions */
    place(0, 118, 40, 16, 12, stoneMat, 0, plaza);
    place(-120, 0, 16, 28, 14, schoolMats[1], 0, plaza);
    place(120, 0, 16, 28, 14, schoolMats[1], 0, plaza);
    /* path flats */
    flat(0, 0, 16, 64, .05, new THREE.MeshStandardMaterial({ color: 0xb8a888, roughness: .95 }));
    flat(0, 0, 76, 14, .05, new THREE.MeshStandardMaterial({ color: 0xb8a888, roughness: .95 }));
    lamp(-22, 22); lamp(22, 22); lamp(-22, -22); lamp(22, -22);
    lamp(-40, 0); lamp(40, 0);
    crate(-30, -40); crate(30, -40); crate(-30, 40); crate(30, 40);
    crate(-60, -20); crate(60, -20);
    spawns = [
      { x: -20, z: 16 }, { x: 20, z: 16 }, { x: -20, z: -16 }, { x: 20, z: -16 },
      { x: 0, z: 22 }, { x: 0, z: -22 }
    ];
  }

  function buildYard() {
    setWorld(170, 0x8aa0a8, 140, 400);
    paintGround(function (g) {
      g.fillStyle = '#5a5e62'; g.fillRect(0, 0, 256, 256);
      var i;
      for (i = 0; i < 600; i++) {
        g.fillStyle = Math.random() < .5 ? '#54585c' : '#62666a';
        g.fillRect(Math.random() * 256, Math.random() * 256, 3, 3);
      }
      /* rails */
      g.fillStyle = '#2a2c2e';
      g.fillRect(0, 108, 256, 6);
      g.fillRect(0, 142, 256, 6);
      g.fillStyle = '#8a7a62';
      for (i = 0; i < 16; i++) g.fillRect(i * 16, 100, 8, 56);
    }, 12);
    var plaza = [-80, -22, 80, 22];
    /* north sheds */
    place(-70, 58, 56, 22, 16, yardMats[0], 0, plaza);
    place(10, 58, 48, 22, 14, yardMats[1], 0, plaza);
    place(78, 58, 40, 22, 18, rustMat, 0, plaza);
    /* south sheds */
    place(-70, -58, 56, 22, 15, yardMats[1], 0, plaza);
    place(10, -58, 48, 22, 14, yardMats[0], 0, plaza);
    place(78, -58, 40, 22, 16, rustMat, 0, plaza);
    /* end engine houses — off the lane */
    place(-130, 0, 22, 40, 20, steelMat, 0, plaza);
    place(130, 0, 22, 40, 20, steelMat, 0, plaza);
    /* offices set back */
    place(-100, 90, 28, 18, 22, yardMats[1], 0, plaza);
    place(100, 90, 28, 18, 20, yardMats[0], 0, plaza);
    place(-100, -90, 28, 18, 18, yardMats[0], 0, plaza);
    place(100, -90, 28, 18, 18, yardMats[1], 0, plaza);
    /* containers along the platforms, not on the tracks */
    var i, x;
    for (i = -4; i <= 4; i++) {
      x = i * 16;
      crate(x, 32);
      crate(x + 3, -32);
    }
    lamp(-40, 28); lamp(40, 28); lamp(-40, -28); lamp(40, -28);
    lamp(0, 28); lamp(0, -28);
    /* platform edges */
    flat(0, 30, 150, 4, .18, steelMat);
    flat(0, -30, 150, 4, .18, steelMat);
    spawns = [
      { x: -36, z: 12 }, { x: 36, z: 12 }, { x: -36, z: -12 }, { x: 36, z: -12 },
      { x: 0, z: 14 }, { x: 0, z: -14 }, { x: 60, z: 0 }, { x: -60, z: 0 }
    ];
  }

  function sidewalks(street) {
    var s = street / 2;
    var curb = new THREE.MeshStandardMaterial({ color: 0x8a8680, roughness: .95 });
    /* four curb lines along the cross, stopping at the plaza */
    flat(s + .6, 50, 1.2, 70, .1, curb);
    flat(-(s + .6), 50, 1.2, 70, .1, curb);
    flat(s + .6, -50, 1.2, 70, .1, curb);
    flat(-(s + .6), -50, 1.2, 70, .1, curb);
    flat(50, s + .6, 70, 1.2, .1, curb);
    flat(-50, s + .6, 70, 1.2, .1, curb);
    flat(50, -(s + .6), 70, 1.2, .1, curb);
    flat(-50, -(s + .6), 70, 1.2, .1, curb);
  }

  function lampsAt(r) {
    lamp(r, r); lamp(-r, r); lamp(r, -r); lamp(-r, -r);
    lamp(r, 0); lamp(-r, 0); lamp(0, r); lamp(0, -r);
  }

  function cratesAlong(street) {
    var s = street / 2 + 4;
    var pts = [
      [s, s], [-s, s], [s, -s], [-s, -s],
      [s + 10, s], [-s - 10, s], [s + 10, -s], [-s - 10, -s]
    ];
    var i;
    for (i = 0; i < pts.length; i++) crate(pts[i][0], pts[i][1]);
  }

  function zebra(x, z, w, d, acrossX) {
    var paint = new THREE.MeshStandardMaterial({ color: 0xe8e2d4, roughness: .7 });
    var n = 6, i, o;
    for (i = 0; i < n; i++) {
      o = (i - (n - 1) / 2) * (acrossX ? 2.2 : 2.2);
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
    /* if a spawn landed in a wall anyway, push the player out */
    if (typeof player !== 'undefined' && player && player.pos) {
      collideWorld(player.pos, 1.2);
    }
    return id;
  }

  JJMAP.audit = function () {
    var i, j, a, b, overlapsN = 0, cratesIn = 0;
    for (i = 0; i < buildingAABBs.length; i++) {
      for (j = i + 1; j < buildingAABBs.length; j++) {
        a = buildingAABBs[i]; b = buildingAABBs[j];
        if (a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ) overlapsN++;
      }
    }
    for (i = 0; i < crates.length; i++) {
      if (blocked(crates[i].mesh.position.x, crates[i].mesh.position.z, 0.7)) cratesIn++;
    }
    return {
      id: JJMAP.id, arena: ARENA, buildings: buildingAABBs.length,
      crates: crates.length, overlaps: overlapsN, cratesInWalls: cratesIn
    };
  };

  /* the default city, built properly, replaces the empty floor */
  load('city');
})();
