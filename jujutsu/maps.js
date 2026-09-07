/* Stage selection and lifecycle. The inexpensive baseplate and the imported
   JJS city share the same training selector, lobby and multiplayer protocol.
   jjs.js owns the exported city's rendering and oriented-box collision. */
(function () {
  'use strict';
  if (typeof scene === 'undefined' || typeof THREE === 'undefined') return;
  if (typeof buildingAABBs === 'undefined') return;

  var SIZE = 120;                       // half-width of the plate
  var CELL = 8;                         // one square of the grid, in units
  var SKY = 0xdfe7f0;

  var LIST = [
    { id: 'plate', name: 'THE BASEPLATE', sub: 'a grid, and room to fight on it', size: SIZE },
    { id: 'jjs', name: 'JJS', sub: 'the original city, rooftops and underground', size: 640 }
  ];

  var JJMAP = window.JJMAP = {
    id: 'plate',
    list: LIST,
    load: load,
    spawn: spawn,
    nameOf: nameOf,
    SIZE: SIZE
  };
  JJMAP.floor=function(pos,limit){return JJMAP.id==='jjs'?JJJJS.floor(pos,limit):0;};
  JJMAP.ceiling=function(pos,limit){return JJMAP.id==='jjs'?JJJJS.ceiling(pos,limit):Infinity;};
  JJMAP.collide=function(pos,radius){return JJJJS.collide(pos,radius);};
  JJMAP.killY=-145;

  /* eight places to stand, well apart, all of them on the plate */
  var spawns = [
    { x: 0, z: 26 }, { x: 0, z: -26 }, { x: 26, z: 0 }, { x: -26, z: 0 },
    { x: 20, z: 20 }, { x: -20, z: 20 }, { x: 20, z: -20 }, { x: -20, z: -20 }
  ];

  function nameOf(id) { return id==='jjs'?'JJS':'THE BASEPLATE'; }

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
    var materials=new Set();
    while (plate.children.length) {
      var o = plate.children[0];
      plate.remove(o);
      if (o.geometry) o.geometry.dispose();
      if(o.material)materials.add(o.material);
    }
    materials.forEach(function(m){m.dispose();});
  }

  /* Everything the old maps put in the world, taken back out. A room that
     was on one of them and reloads onto this one has to come back clean. */
  function clearWorld() {
    if(window.JJJJS)JJJJS.clear();
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
    JJMAP.SIZE=SIZE;ground.visible=true;
    hemi.color.set(0xcfe4ff);hemi.groundColor.set(0x4a4438);hemi.intensity=.9;
    sun.color.set(0xfff2d8);sun.intensity=1.6;sun.position.set(60,90,40);sun.shadow.bias=0;sun.shadow.normalBias=0;
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

  function buildJJS(){
    JJJJS.build();ground.visible=false;JJMAP.SIZE=ARENA=640;
    scene.background=new THREE.Color(0xb4d7ec);
    if(scene.fog){scene.fog.color.set(0xb4d7ec);scene.fog.near=900;scene.fog.far=1800;}
    camera.far=2200;camera.updateProjectionMatrix();
    hemi.color.set(0xffffff);hemi.groundColor.set(0xc8c6c1);hemi.intensity=2.1;
    sun.color.set(0xffffff);sun.intensity=1.5;
    var d=JJS_DATA.lighting.sun;sun.position.set(d[0]*600,d[1]*600,d[2]*600);
    sun.shadow.camera.left=-440;sun.shadow.camera.right=440;sun.shadow.camera.top=440;sun.shadow.camera.bottom=-440;sun.shadow.camera.far=1500;
    sun.shadow.camera.updateProjectionMatrix();sun.shadow.bias=-.00015;sun.shadow.normalBias=.07;
    if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null;}sun.shadow.mapSize.set(2048,2048);
  }
  function load(id) {
    id=id==='jjs'?'jjs':'plate';
    if(JJMAP.id===id&&((id==='jjs'&&JJJJS.root)||(id==='plate'&&plate.children.length)))return id;
    if(window.JJMOVE)JJMOVE.cancel('map');
    clearWorld();
    JJMAP.id = id;
    if(id==='jjs')buildJJS();else build();
    if (typeof player !== 'undefined' && player && player.pos) {
      var s=spawn(2);player.pos.set(s.x,s.y||0,s.z);player.vel.set(0,0,0);player.onGround=true;player.__jjsLast=null;
      if(player.rig)player.rig.root.position.copy(player.pos);
      if(typeof enemies!=='undefined')enemies.forEach(function(e,i){if(e.net)return;var s=spawn(i);e.pos.set(s.x,s.y||0,s.z);e.spawn.copy(e.pos);e.vel.set(0,0,0);e.__jjsLast=null;e.rig.root.position.copy(e.pos);});
    }
    var pick=document.getElementById('jjTrainingMap');if(pick)pick.value=id;
    document.querySelectorAll('#jjMaps button').forEach(function(button){button.classList.toggle('on',button.dataset.map===id);});
    return id;
  }

  function hash(s) {
    var h = 0, i;
    for (i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return h;
  }

  function spawn(index) {
    var mp = window.MPJJ;
    var i=index==null?Math.abs(mp && mp.id ? hash(mp.id) : (Math.random() * 99) | 0):index;
    if(JJMAP.id==='jjs')return JJJJS.spawn(i);
    i%=spawns.length;return { x: spawns[i].x, y:0, z: spawns[i].z };
  }

  /* kept so the old check still runs; there is simply nothing to collide */
  JJMAP.audit = function () {
    if(JJMAP.id==='jjs')return Object.assign({id:'jjs'},JJJJS.audit());
    return {
      id: JJMAP.id, arena: ARENA, buildings: buildingAABBs.length,
      crates: (typeof crates !== 'undefined') ? crates.length : 0,
      overlaps: 0, cratesInWalls: 0, inStreet: 0, inPlaza: 0,
      rejected: 0, cratesInStreet: 0
    };
  };

  load('plate');
  var label=document.createElement('label');label.style.cssText='display:flex;align-items:center;justify-content:center;gap:12px;margin:10px 0;color:#bbc9db;font:600 12px Arial;letter-spacing:2px';
  label.textContent='TRAINING MAP';var select=document.createElement('select');select.id='jjTrainingMap';select.setAttribute('aria-label','Training map');
  select.style.cssText='background:#101923;color:#e5edfa;border:1px solid #52667e;border-radius:5px;padding:8px 15px;font:600 12px Arial';
  LIST.forEach(function(m){var o=document.createElement('option');o.value=m.id;o.textContent=m.name;select.appendChild(o);});label.appendChild(select);
  document.getElementById('menuPick').after(label);
  select.addEventListener('change',function(){load(select.value);if(window.MPJJ)MPJJ.map=select.value;});
  if(new URLSearchParams(location.search).get('map')==='jjs')load('jjs');
})();
