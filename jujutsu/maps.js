/* =======================================================================
   THE BASEPLATE
   There used to be four maps in here — a city, a crossing, a school and a
   train yard — and between them a few hundred textured buildings, roofs,
   plinths, lamps, kerbs, rails and crates, all casting shadows. On a
   machine that has to draw six fighters, a domain and a few thousand
   effect billboards on top of that, the buildings were most of the frame
   budget and none of the fight.

   So there is one stage now: a white baseplate with a square grid on it,
   and the dummies. Nothing casts a shadow that nobody looks at, nothing
   stands between you and what you are hitting, and the frame rate is the
   fight's to spend.

   The shape of the module is unchanged — JJMAP.load / spawn / nameOf /
   list are what mp.js and the lobby talk to, and they still work, there
   is just one thing in the list.
   ===================================================================== */
(function () {
  'use strict';
  if (typeof scene === 'undefined' || typeof THREE === 'undefined') return;
  if (typeof buildingAABBs === 'undefined') return;

  var SIZE = 120;                       // half-width of the plate
  var CELL = 8;                         // one square of the grid, in units
  var SKY = 0xdfe7f0;

  var LIST = [
    { id: 'plate', name: 'THE BASEPLATE', sub: 'a grid, and room to fight on it', size: SIZE }
  ];

  var JJMAP = window.JJMAP = {
    id: 'plate',
    list: LIST,
    load: load,
    spawn: spawn,
    nameOf: nameOf,
    SIZE: SIZE
  };

  /* eight places to stand, well apart, all of them on the plate */
  var spawns = [
    { x: 0, z: 26 }, { x: 0, z: -26 }, { x: 26, z: 0 }, { x: -26, z: 0 },
    { x: 20, z: 20 }, { x: -20, z: 20 }, { x: 20, z: -20 }, { x: -20, z: -20 }
  ];

  function nameOf(id) { return 'THE BASEPLATE'; }

  /* --------------------------------------------------------------- grid
     One tile, drawn once, repeated across the plate: two thin lines on
     white with a heavier one every fourth square so the eye has something
     to measure distance against. */
  function gridTexture() {
    var px = 128;
    return canvasTex(px, px, function (g) {
      g.fillStyle = '#f4f6f8';
      g.fillRect(0, 0, px, px);
      /* the light line, on two edges of the tile */
      g.strokeStyle = '#c8d0d8';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(0, .5); g.lineTo(px, .5);
      g.moveTo(.5, 0); g.lineTo(.5, px);
      g.stroke();
      /* and a faint one down the middle, so a square reads as four */
      g.strokeStyle = '#e2e7ec';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(0, px / 2); g.lineTo(px, px / 2);
      g.moveTo(px / 2, 0); g.lineTo(px / 2, px);
      g.stroke();
    }, (SIZE * 2 + 40) / CELL, (SIZE * 2 + 40) / CELL);
  }

  /* the heavy lines through the middle, so the centre of the plate reads */
  function centreLines() {
    var mat = new THREE.MeshBasicMaterial({ color: 0x9fb0c0, toneMapped: false });
    var reach = SIZE * 2 + 40;
    [[reach, .5], [.5, reach]].forEach(function (d) {
      var m = new THREE.Mesh(new THREE.PlaneGeometry(d[0], d[1]), mat);
      m.rotation.x = -Math.PI / 2;
      m.position.y = .02;
      plate.add(m);
    });
  }

  /* a lip round the edge, so you can see where the plate stops */
  function edge() {
    var mat = new THREE.MeshStandardMaterial({ color: 0xb8c2cc, roughness: .9 });
    var reach = SIZE * 2;
    var h = 1.1;
    [[0, SIZE, reach, .8], [0, -SIZE, reach, .8],
     [SIZE, 0, .8, reach], [-SIZE, 0, .8, reach]].forEach(function (s) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(s[2], h, s[3]), mat);
      m.position.set(s[0], h / 2, s[1]);
      m.receiveShadow = true;
      plate.add(m);
    });
  }

  var plate = new THREE.Group();
  plate.name = 'jjPlate';
  scene.add(plate);

  function clearPlate() {
    while (plate.children.length) {
      var o = plate.children[0];
      plate.remove(o);
      if (o.geometry) o.geometry.dispose();
    }
  }

  /* Everything the old maps put in the world, taken back out. A room that
     was on one of them and reloads onto this one has to come back clean. */
  function clearWorld() {
    var i, b, k;
    for (i = buildingAABBs.length - 1; i >= 0; i--) {
      b = buildingAABBs[i];
      if (b.mesh) scene.remove(b.mesh);
      if (b.extras) for (k = 0; k < b.extras.length; k++) scene.remove(b.extras[k]);
    }
    buildingAABBs.length = 0;
    if (typeof crates !== 'undefined') {
      for (i = crates.length - 1; i >= 0; i--) scene.remove(crates[i].mesh);
      crates.length = 0;
    }
    var old = scene.getObjectByName('jjMapDecor');
    if (old) scene.remove(old);
    clearPlate();
  }

  function build() {
    ARENA = SIZE;
    /* the floor itself: one plane, one texture, no tiles to sort */
    if (ground.geometry) ground.geometry.dispose();
    ground.geometry = new THREE.PlaneGeometry(SIZE * 2 + 40, SIZE * 2 + 40);
    if (ground.material.map) ground.material.map.dispose();
    ground.material.map = gridTexture();
    ground.material.color.set(0xffffff);
    ground.material.roughness = .96;
    ground.material.needsUpdate = true;

    centreLines();
    edge();

    /* the sky, and a fog that only ever has to hide the edge of the plate */
    scene.background = new THREE.Color(SKY);
    if (scene.fog) {
      scene.fog.color.set(SKY);
      scene.fog.near = SIZE * 1.4;
      scene.fog.far = SIZE * 2.6;
    }
    camera.far = SIZE * 5;
    camera.updateProjectionMatrix();

    /* Nothing on the plate casts a long shadow any more, so the shadow
       camera can be tight and cheap instead of covering a city. */
    var half = 70;
    sun.shadow.camera.left = -half;
    sun.shadow.camera.right = half;
    sun.shadow.camera.top = half;
    sun.shadow.camera.bottom = -half;
    sun.shadow.camera.far = 260;
    sun.shadow.camera.updateProjectionMatrix();
    if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    sun.shadow.mapSize.set(1024, 1024);
  }

  function load(id) {
    clearWorld();
    JJMAP.id = 'plate';
    build();
    if (typeof player !== 'undefined' && player && player.pos) {
      collideWorld(player.pos, 1.2);
    }
    return 'plate';
  }

  function hash(s) {
    var h = 0, i;
    for (i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return h;
  }

  function spawn() {
    var mp = window.MPJJ;
    var i = Math.abs(mp && mp.id ? hash(mp.id) : (Math.random() * 99) | 0) % spawns.length;
    return { x: spawns[i].x, z: spawns[i].z };
  }

  /* kept so the old check still runs; there is simply nothing to collide */
  JJMAP.audit = function () {
    return {
      id: JJMAP.id, arena: ARENA, buildings: buildingAABBs.length,
      crates: (typeof crates !== 'undefined') ? crates.length : 0,
      overlaps: 0, cratesInWalls: 0, inStreet: 0, inPlaza: 0,
      rejected: 0, cratesInStreet: 0
    };
  };

  load('plate');
})();
