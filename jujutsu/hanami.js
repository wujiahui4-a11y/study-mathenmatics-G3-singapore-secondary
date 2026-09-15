/* Hanami — four techniques, four lethal-hit finishers, and Flower Field on R.
   Geometry is authored here so both offline builds carry the complete fighter.
   Cast clocks drive damage, poses and remote effects; no delayed damage timers. */
(function () {
  'use strict';
  if (typeof player === 'undefined' || !window.JJFX) return;
  var FX = window.JJFX, TAU = Math.PI * 2;
  var BONE = 0xd9d3bd, INK = 0x262a25, WOOD = 0x66513b, MOSS = 0x4e7040;
  var GREEN = 0x91cf62, LIGHT = 0xe4f5ad, PINK = 0xd76b89;
  var H = window.JJHANAMI = { props: [], remote: {}, field: null };
  var CFG = { hanami: true, face: false, skin: BONE, torso: BONE, pants: 0x222831, shoes: BONE };
  var KIT = {
    hn1: { name: 'Root Uprising', cd: 8, dur: 1.4, damage: 34 },
    hn2: { name: 'Cursed Buds', cd: 10, dur: 1.85, damage: 30 },
    hn3: { name: 'Branch Breaker', cd: 10, dur: 1.35, damage: 32 },
    hn4: { name: 'Solar Bloom', cd: 15, dur: 2.05, damage: 38 },
    hnr: { name: 'Flower Field', cd: 21, dur: 1.05, damage: 10 }
  };
  var clamp = function (v) { return Math.max(0, Math.min(1, v)); };
  var smooth = function (v) { v = clamp(v); return v * v * (3 - 2 * v); };
  var V = function (x, y, z) { return new THREE.Vector3(x, y, z); };
  function direction(yaw) { return V(Math.sin(yaw), 0, Math.cos(yaw)); }
  function sideOf(d) { return V(d.z, 0, -d.x); }

  /* A tapered tube follows an authored curve, including the radius at its tip.
     Unlike scaling a cylinder it can branch, curl, and grow along its length. */
  function tube(points, radius, tip, segments, sides) {
    var curve = new THREE.CatmullRomCurve3(points.map(function (p) { return p.isVector3 ? p : V(p[0], p[1], p[2]); }));
    segments = segments || 20; sides = sides || 7;
    var geo = new THREE.TubeGeometry(curve, segments, 1, sides, false);
    var attr = geo.attributes.position;
    for (var i = 0; i <= segments; i++) {
      var t = i / segments, center = curve.getPointAt(t), rad = radius * (1 - t) + tip * t;
      for (var j = 0; j <= sides; j++) {
        var k = i * (sides + 1) + j;
        attr.setXYZ(k, center.x + (attr.getX(k) - center.x) * rad,
          center.y + (attr.getY(k) - center.y) * rad, center.z + (attr.getZ(k) - center.z) * rad);
      }
    }
    geo.computeVertexNormals();
    return geo;
  }
  function mesh(parent, geo, mat, x, y, z) {
    var m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0);
    // The arena shadow map is coarse: self-shadowing a smooth limb creates
    // concentric acne bands. Keep its cast shadow and use toon light on skin.
    m.castShadow = true; m.receiveShadow = false; parent.add(m); return m;
  }
  function curveMesh(parent, points, radius, tip, mat, segments) {
    return mesh(parent, tube(points, radius, tip, segments), mat);
  }
  function oval(parent, scale, pos, mat) {
    var m = mesh(parent, new THREE.SphereGeometry(1, 20, 14), mat, pos[0], pos[1], pos[2]);
    m.scale.set(scale[0], scale[1], scale[2]); return m;
  }
  /* Cross sections are elliptical and may have cloth pleats, not box limbs. */
  function surface(sections, pleats) {
    var n = 32, vs = [], ids = [];
    sections.forEach(function (s, i) {
      for (var j = 0; j <= n; j++) {
        var a = j / n * TAU, fold = 1 + (pleats || 0) * Math.cos(a * 8 + i * .35);
        vs.push(Math.sin(a) * s[1] * fold, s[0], Math.cos(a) * s[2] * fold);
        if (i && j < n) {
          var k = i * (n + 1) + j;
          ids.push(k, k + 1, k - n - 1, k + 1, k - n, k - n - 1);
        }
      }
    });
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(vs, 3)); g.setIndex(ids); g.computeVertexNormals(); return g;
  }
  function petalGeo(length, width, curl) {
    var vs = [], ids = [], n = 12;
    for (var i = 0; i <= n; i++) {
      var t = i / n, w = Math.sin(Math.PI * t) * width;
      for (var j = 0; j < 3; j++) {
        var s = j - 1;
        vs.push(w * s, t * length, curl * t * t + (1 - Math.abs(s)) * Math.sin(Math.PI * t) * width * .3);
      }
      if (i) for (j = 0; j < 2; j++) {
        var k = i * 3 + j; ids.push(k - 3, k, k + 1, k - 3, k + 1, k - 2);
      }
    }
    var geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(vs, 3));
    geo.setIndex(ids); geo.computeVertexNormals(); return geo;
  }
  function flower(mat, coreMat, size) {
    var group = new THREE.Group(); group.userData.petals = [];
    for (var layer = 0; layer < 2; layer++) for (var i = 0; i < 7; i++) {
      var pivot = new THREE.Group(); pivot.rotation.z = i / 7 * TAU + layer * .36;
      group.add(pivot);
      var p = mesh(pivot, petalGeo(size * (layer ? .78 : 1), size * .3, size * .36), mat);
      p.rotation.x = .38 + layer * .22; p.position.z = layer * .08;
      group.userData.petals.push(p);
    }
    oval(group, [size * .25, size * .25, size * .18], [0, 0, .13], coreMat);
    return group;
  }
  function openFlower(group, amount) {
    group.userData.petals.forEach(function (p, i) { p.rotation.x = 1.42 - amount * (1.13 - (i >= 7 ? .2 : 0)); });
  }

  /* The character is a voxel sculpture on an 0.08-unit grid. Each joint is
     baked separately so animation still articulates it. Internal voxel faces
     are culled and the colored exterior is one mesh per joint or accessory. */
  var previousRig = makeAnimeRig;
  makeAnimeRig = function (cfg) {
    var r = previousRig(cfg);
    if (!cfg || !cfg.hanami) return r;
    var old = [], oldGeometries = new Set(), oldMaterials = new Set();
    r.root.traverse(function (o) { if (o.isMesh) old.push(o); });
    old.forEach(function (o) { o.parent.remove(o); oldGeometries.add(o.geometry); oldMaterials.add(o.material); });
    oldGeometries.forEach(function(g){g.dispose();});oldMaterials.forEach(function(m){m.dispose();});
    r.__char = 'hanami'; r.body.scale.set(1.1, 1.08, 1.05);
    var S = .08;
    var ramp = new THREE.DataTexture(new Uint8Array([76, 153, 217, 255]), 4, 1, THREE.RedFormat);
    ramp.minFilter = ramp.magFilter = THREE.NearestFilter; ramp.needsUpdate = true;
    var mat = new THREE.MeshToonMaterial({ color: 0xffffff, vertexColors: true, gradientMap: ramp });
    var C = {
      bone: BONE, shade: 0xb9b49e, highlight: 0xeee7d1, ink: INK,
      bark: 0x5b4635, wood: 0x806347, cloth: 0xeeefeb, fold: 0xc1c7c8,
      seam: 0x949fa5, pants: 0x232932, pantsLight: 0x343d48, pantsDark: 0x171c24,
      petal: 0xb65c77, petalLight: 0xe793a6, pollen: 0xdfc77c
    };
    // Each face has an explicit flat normal and four grid-aligned corners.
    var faces = [
      [[1,0,0],[[1,0,0],[1,1,0],[1,1,1],[1,0,1]]],
      [[-1,0,0],[[0,0,1],[0,1,1],[0,1,0],[0,0,0]]],
      [[0,1,0],[[0,1,1],[1,1,1],[1,1,0],[0,1,0]]],
      [[0,-1,0],[[0,0,0],[1,0,0],[1,0,1],[0,0,1]]],
      [[0,0,1],[[1,0,1],[1,1,1],[0,1,1],[0,0,1]]],
      [[0,0,-1],[[0,0,0],[0,1,0],[1,1,0],[1,0,0]]]
    ];
    function sculpture(parent, name) {
      var cells = new Map();
      function cell(x,y,z,color) { cells.set(x+','+y+','+z,{x:x,y:y,z:z,c:color}); }
      function block(x,y,z,w,h,d,color) {
        var nx=Math.max(1,Math.round(w/S)),ny=Math.max(1,Math.round(h/S)),nz=Math.max(1,Math.round(d/S));
        var ox=Math.round(x/S-nx/2),oy=Math.round(y/S-ny/2),oz=Math.round(z/S-nz/2);
        for(var i=0;i<nx;i++)for(var j=0;j<ny;j++)for(var k=0;k<nz;k++)cell(ox+i,oy+j,oz+k,color);
        return api;
      }
      function stroke(points,width,color) {
        for(var i=1;i<points.length;i++) {
          var a=points[i-1],b=points[i];
          var steps=Math.max(1,Math.ceil(Math.max(Math.abs(b[0]-a[0]),Math.abs(b[1]-a[1]),Math.abs(b[2]-a[2]))/S*2));
          for(var j=0;j<=steps;j++){var t=j/steps;block(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t,width,width,width,color);}
        }
        return api;
      }
      function bake() {
        var vertices=[],normals=[],colors=[],indices=[],palette={};
        cells.forEach(function(v){
          var color=palette[v.c]||(palette[v.c]=new THREE.Color(v.c));
          faces.forEach(function(f){var n=f[0];if(cells.has((v.x+n[0])+','+(v.y+n[1])+','+(v.z+n[2])))return;
            var base=vertices.length/3;
            f[1].forEach(function(p){vertices.push((v.x+p[0])*S,(v.y+p[1])*S,(v.z+p[2])*S);normals.push(n[0],n[1],n[2]);colors.push(color.r,color.g,color.b);});
            indices.push(base,base+1,base+2,base,base+2,base+3);
          });
        });
        var geo=new THREE.BufferGeometry();
        geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
        geo.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
        geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setIndex(indices);
        geo.userData={voxel:true,grid:S,cells:cells.size};
        var m=mesh(parent,geo,mat);m.name=name;return m;
      }
      var api={block:block,stroke:stroke,bake:bake};return api;
    }

    var torso=sculpture(r.spine,'Hanami / block torso');
    torso.block(0,.28,0,1.12,.72,.64,C.bone).block(0,.76,0,1.6,.64,.8,C.bone);
    torso.block(0,1.08,0,.96,.16,.56,C.shade);
    [-1,1].forEach(function(s){
      torso.block(s*.4,.8,.4,.64,.32,.16,C.highlight);
      for(var k=0;k<3;k++)torso.block(s*.24,.42-k*.2,.36,.32,.16,.16,k===2?C.shade:C.bone);
      torso.stroke([[s*.64,1,.42],[s*.48,.8,.48],[s*.56,.56,.42],[s*.4,.32,.4],[s*.4,.08,.4]],.08,C.ink);
      torso.stroke([[s*.56,.72,-.4],[s*.32,.56,-.4],[s*.4,.32,-.32],[s*.24,.08,-.32]],.08,C.ink);
    });torso.bake();
    sculpture(r.neck,'Hanami / square neck').block(0,.12,0,.4,.32,.4,C.shade).block(0,.16,.2,.16,.32,.08,C.ink).bake();

    // A squared mask and rectangular jaw, with stepped brow and cheek plates.
    var head=sculpture(r.head,'Hanami / voxel mask and antlers');
    head.block(0,.6,0,.8,.8,.64,C.bone).block(0,1.04,-.04,.64,.16,.56,C.highlight);
    head.block(0,1.2,-.08,.32,.16,.4,C.bone).block(0,.12,.04,.48,.24,.48,C.shade);
    head.block(0,.4,.36,.32,.32,.16,C.bone).block(0,.64,.4,.08,.56,.08,C.highlight);
    head.block(0,.16,.32,.32,.08,.08,C.ink).block(0,.24,.4,.08,.16,.08,C.shade);
    [-1,1].forEach(function(s){
      head.block(s*.24,.72,.36,.24,.24,.16,C.ink);
      head.block(s*.32,.88,.36,.24,.08,.08,C.shade);
      head.stroke([[s*.32,.6,.32],[s*.24,.48,.4],[s*.24,.32,.32],[s*.16,.24,.32]],.08,C.ink);
      // Horn branches are connected stair-stepped voxels, including their tips.
      head.stroke([[s*.24,.72,.48],[s*.32,1.12,.48],[s*.4,1.44,.4],[s*.48,1.76,.32]],.16,C.bark);
      head.stroke([[s*.48,1.68,.32],[s*.56,1.92,.32],[s*.56,2.08,.24]],.08,C.wood);
      head.stroke([[s*.4,1.28,.4],[s*.64,1.52,.32],[s*.72,1.76,.24]],.08,C.bark);
      head.stroke([[s*.48,1.68,.32],[s*.32,1.84,.32],[s*.32,2.08,.24]],.08,C.bone);
      head.stroke([[s*.64,1.52,.32],[s*.88,1.6,.4]],.08,C.wood);
      head.stroke([[s*.24,.8,.56],[s*.24,1.04,.56],[s*.32,1.2,.48]],.08,C.wood);
    });head.bake();

    r.shoulderL.position.x=-.96;r.shoulderR.position.x=.96;
    ['L','R'].forEach(function(side){
      var barkArm=side==='L',skin=barkArm?C.bark:C.bone,accent=barkArm?C.wood:C.shade;
      var upper=sculpture(r['shoulder'+side],'Hanami / '+side+' square upper arm');
      upper.block(0,-.12,0,.64,.48,.64,skin).block(0,-.56,0,.48,.64,.48,skin);
      upper.block(0,-.9,0,.4,.24,.4,accent).block(.08,-.48,.24,.24,.32,.08,skin);
      upper.stroke([[-.16,-.08,.32],[0,-.32,.32],[-.08,-.48,.24],[.08,-.72,.24]],.08,C.ink);
      upper.stroke([[.16,-.08,.32],[.24,-.4,.24],[.16,-.64,.24],[.16,-.88,.24]],.08,C.ink);upper.bake();
      var fore=sculpture(r['elbow'+side],'Hanami / '+side+' forearm and pixel claws');
      fore.block(0,-.12,0,.4,.24,.4,accent).block(0,-.4,0,.48,.4,.4,skin);
      fore.block(0,-.72,0,.32,.32,.32,skin).block(0,-1.0,.04,.4,.24,.24,skin);
      fore.stroke([[-.16,-.24,.24],[.08,-.4,.24],[-.08,-.56,.24],[.08,-.88,.16]],.08,C.ink);
      fore.stroke([[.16,-.24,-.24],[0,-.48,-.24],[.08,-.8,-.16]],.08,accent);
      for(var k=0;k<4;k++){
        var x=-.24+k*.16,len=(k===1||k===2)?.4:.32;
        fore.block(x,-1.12-len*.5,.08,.08,len,.16,skin);
        fore.block(x,-1.12-len,.16,.08,.16,.16,C.ink);
        fore.block(x,-1.2-len,.24,.08,.08,.08,C.ink);
      }
      fore.block(.32,-1.0,.08,.16,.16,.16,skin).block(.4,-1.16,.16,.08,.24,.16,skin);
      fore.block(.4,-1.28,.24,.08,.08,.16,C.ink);fore.bake();
    });

    // The concealed flower is also made of voxels. Its block petals retain
    // the existing opening pivots so Solar Bloom's animation still works.
    var bloom=new THREE.Group();bloom.userData.petals=[];bloom.position.set(-.16,.08,.4);r.shoulderL.add(bloom);
    for(var layer=0;layer<2;layer++)for(var j=0;j<8;j++){
      var pivot=new THREE.Group();pivot.rotation.z=j/8*TAU+layer*Math.PI/8;bloom.add(pivot);
      var leaf=new THREE.Group();pivot.add(leaf);leaf.position.z=layer*.08;bloom.userData.petals.push(leaf);
      var petal=sculpture(leaf,'Hanami / voxel shoulder petal');
      var length=layer?.4:.56;
      petal.block(0,.12,.04,.16,.24,.08,C.petal).block(0,.32,.08,.32,.24,.16,C.petal);
      petal.block(0,length,.16,.16,.24,.08,C.petalLight);petal.bake();
    }
    sculpture(bloom,'Hanami / square flower center').block(0,0,.16,.32,.32,.24,C.pollen).block(0,0,.32,.16,.16,.08,C.bone).bake();
    openFlower(bloom,0);bloom.visible=false;r.hanamiBloom=bloom;

    // Overlapping square cloth tiers give the wrap volume and pixel folds.
    var sleeve=new THREE.Group();r.shoulderL.add(sleeve);r.hanamiSleeve=sleeve;
    var drape=sculpture(sleeve,'Hanami / stepped shoulder cloth');
    drape.block(0,.24,0,.8,.32,.8,C.cloth).block(0,-.08,0,1.12,.48,.96,C.cloth);
    drape.block(-.08,-.44,0,.96,.32,.88,C.cloth).block(0,-.72,0,.72,.24,.72,C.cloth);
    drape.block(.08,-.92,0,.48,.16,.56,C.fold);
    for(j=0;j<4;j++)drape.stroke([[-.4,.08-j*.24,.48],[-.08,-.08-j*.24,.48],[.32,.0-j*.24,.4]],.08,j%2?C.fold:C.highlight);
    drape.bake();
    var wrap=new THREE.Group();r.spine.add(wrap);r.hanamiWrap=wrap;
    var cloth=sculpture(wrap,'Hanami / diagonal voxel wrap');
    for(j=0;j<21;j++){
      var x=-.8+j*.08,y=1.0-x*.4;
      cloth.block(x,y,.48,.08,.56,.24,C.cloth).block(x,y,-.4,.08,.48,.16,C.cloth);
      cloth.block(x,y-.16,.64,.08,.08,.08,C.fold);
      cloth.block(x,y+.16,.64,.08,.08,.08,C.highlight);
    }
    cloth.block(-.88,1.2,0,.24,.56,.88,C.cloth).block(.88,.72,0,.24,.48,.88,C.cloth);cloth.bake();

    var hips=sculpture(r.hips,'Hanami / waistband and square sash');
    hips.block(0,.4,0,1.12,.64,.64,C.pants).block(0,.72,0,1.2,.16,.8,C.cloth);
    hips.block(0,.64,.4,.24,.24,.16,C.fold).block(0,.72,.48,.16,.16,.16,C.cloth);
    hips.stroke([[-.08,.64,.48],[-.16,.4,.48],[-.16,.08,.48]],.08,C.cloth);
    hips.stroke([[.08,.64,.48],[.24,.48,.48],[.16,.24,.48]],.08,C.cloth);hips.bake();
    ['L','R'].forEach(function(side){
      var s=side==='L'?-1:1;r['hip'+side].position.x=s*.4;
      var thigh=sculpture(r['hip'+side],'Hanami / '+side+' block trousers');
      thigh.block(0,-.24,0,.64,.56,.72,C.pants).block(0,-.68,0,.8,.48,.8,C.pants);
      thigh.block(0,-1.04,0,.64,.32,.64,C.pants);
      thigh.block(-.24,-.64,.4,.08,.8,.08,C.pantsLight).block(.16,-.64,.4,.08,.8,.08,C.pantsDark);
      thigh.block(.08,-.56,-.4,.08,.8,.08,C.pantsLight);thigh.bake();
      var calf=sculpture(r['knee'+side],'Hanami / '+side+' stepped trouser cuff');
      calf.block(0,-.24,0,.64,.48,.64,C.pants).block(0,-.56,0,.56,.32,.56,C.pants);
      calf.block(0,-.8,0,.4,.16,.48,C.pants).block(0,-.96,0,.32,.16,.32,C.pantsDark);
      calf.block(-.16,-.48,.32,.08,.56,.08,C.pantsLight).block(.16,-.24,.32,.08,.4,.08,C.pantsDark);calf.bake();
      var foot=sculpture(r['ankle'+side],'Hanami / '+side+' square foot and claws');
      foot.block(0,.0,.08,.4,.24,.56,C.bone).block(0,-.08,.32,.56,.16,.4,C.bone);
      for(var k=0;k<4;k++){
        var toe=-.24+k*.16,reach=k===1||k===2?.16:.08;
        foot.block(toe,-.08,.48,.08,.16,.24,C.bone).block(toe,-.12,.6,.08,.08,reach+.16,C.ink);
      }
      foot.block(0,.08,.24,.32,.08,.24,C.highlight);foot.bake();
    });
    return r;
  };


  CHARS.hanami = { name: 'HANAMI', sub: 'DISASTER CURSE — NATURE', cfg: CFG, glow: '#91cf62', moves: [
    {key:'LMB',lbl:'Punch',cd:'m1',max:.3},{key:'Q',lbl:'Dash',cd:'dash',max:1}
  ].concat(Object.keys(KIT).map(function(k,i){ cds[k]=0; return {key:i===4?'R':String(i+1),lbl:KIT[k].name,cd:k,max:KIT[k].cd}; })) };
  // The standard portrait faces backward and crops taller heads; frame Hanami's horns explicitly.
  try {
    var portraitRenderer = new THREE.WebGLRenderer({antialias:true,alpha:true}); portraitRenderer.setSize(192,192);
    var portraitScene = new THREE.Scene(), portraitRig=makeAnimeRig(CFG), portraitCamera=new THREE.PerspectiveCamera(32,1,.1,40);
    portraitRig.root.rotation.y=-.22; portraitScene.add(portraitRig.root);
    portraitScene.add(new THREE.HemisphereLight(0xffffff,0x4f5961,2));
    var keyLight=new THREE.DirectionalLight(0xfff4dc,2.5); keyLight.position.set(-3,8,5); portraitScene.add(keyLight);
    portraitCamera.position.set(.2,5.95,7.8); portraitCamera.lookAt(0,5.25,0); portraitRenderer.render(portraitScene,portraitCamera);
    CHARS.hanami.portrait=portraitRenderer.domElement.toDataURL();
    var portraitGeos=new Set(),portraitMats=new Set(),portraitMaps=new Set();
    portraitRig.root.traverse(function(o){if(o.isMesh){portraitGeos.add(o.geometry);portraitMats.add(o.material);if(o.material.gradientMap)portraitMaps.add(o.material.gradientMap);}});
    portraitGeos.forEach(function(g){g.dispose();});portraitMats.forEach(function(m){m.dispose();});portraitMaps.forEach(function(m){m.dispose();});
    portraitRenderer.dispose();
  } catch (err) { CHARS.hanami.portrait=''; }
  buildCharList();

  /* All transient meshes have bounded lifetimes and deterministic disposal.
     owner marks only local casts: changing fighter must not erase a peer's VFX. */
  function material(c, glow) {
    return glow ? new THREE.MeshBasicMaterial({color:c,side:THREE.DoubleSide,transparent:true,depthWrite:false,toneMapped:false})
      : new THREE.MeshStandardMaterial({color:c,roughness:.87,side:THREE.DoubleSide,transparent:true});
  }
  function discard(entry) {
    if (entry.dead) return; entry.dead=true;
    if(entry.group.parent) entry.group.parent.remove(entry.group);
    var gs=new Set(),ms=new Set();
    entry.group.traverse(function(o){if(o.geometry)gs.add(o.geometry);if(o.material)ms.add(o.material);});
    gs.forEach(function(g){g.dispose();});ms.forEach(function(m){m.dispose();});
    var at=H.props.indexOf(entry);if(at>=0)H.props.splice(at,1);
  }
  function effect(group,life,update,owner) {
    scene.add(group); var entry={group:group,owner:!!owner,t:0,dead:false}; H.props.push(entry);
    addFx({update:function(dt){
      if(entry.dead)return false;entry.t+=dt;
      if(entry.t>=life){discard(entry);return false;}
      if(update)update(entry.t,dt,group);
      var alpha=clamp((life-entry.t)/Math.min(.3,life*.25));
      group.traverse(function(o){if(o.material && o.material.transparent)o.material.opacity=alpha;});
      return true;
    }}); return entry;
  }
  function petals(at,count,color,radius,life,owner) {
    var g=new THREE.Group(),mat=material(color,false),parts=[];g.position.copy(at);
    var instances=new THREE.InstancedMesh(petalGeo(.6,.19,.12),mat,count),dummy=new THREE.Object3D();
    instances.frustumCulled=false;g.add(instances);
    for(var i=0;i<count;i++) {
      var angle=i/count*TAU,rad=radius*(.3+.7*((i*7%13)/13));
      parts.push({a:angle,r:rad,y:(i%5)*.27,w:1.3+(i%4)*.45});
    }
    return effect(g,life,function(t){parts.forEach(function(p,i){var a=p.a+t*p.w;
      dummy.position.set(Math.cos(a)*p.r*clamp(t*3),p.y+t*2.5,Math.sin(a)*p.r*clamp(t*3));
      dummy.rotation.set(t*3+p.a,a,t*4);dummy.updateMatrix();instances.setMatrixAt(i,dummy.matrix);
    });instances.instanceMatrix.needsUpdate=true;},owner);
  }
  function root(at,d,height,width,life,owner) {
    var g=new THREE.Group();g.position.copy(at);g.position.y-=.12;g.rotation.y=Math.atan2(d.x,d.z);
    var wood=material(WOOD),light=material(0x93815b),dark=material(INK);
    var trunk=curveMesh(g,[[0,-.45,-1],[.2,height*.25,-.65],[-.15,height*.63,.15],[0,height,width*1.45]],width,.015,wood,24);
    for(var j=0;j<3;j++) {
      var s=j%2?1:-1, start=height*(.3+j*.14);
      curveMesh(g,[[0,start,-.4],[s*width*1.3,start+height*.18,.1],[s*width*1.9,start+height*.3,.8]],width*.36,.007,j%2?light:wood,12);
    }
    for(j=0;j<3;j++)curveMesh(g,[[width*(j-1)*.5,0,-.6],[width*(j-1)*.4,height*.45,.05],[.02,height*.92,width]],.025,.005,dark,18);
    var indexCount=trunk.geometry.index.count;
    return effect(g,life,function(t){var grow=smooth(t/.24);g.scale.y=Math.max(.002,grow);
      trunk.geometry.setDrawRange(0,Math.floor(indexCount*clamp(t/.2)/3)*3);
      g.position.y=at.y-.12-Math.max(0,t-(life-.35))*height*2;
    },owner);
  }
  function impact(at,d,size,owner) {
    petals(at,14,GREEN,size,.75,owner);
    FX.slash(at.clone(),sideOf(d),LIGHT,size*2,.18);
    FX.slash(at.clone(),V(0,1,0),INK,size*1.5,.16);
    FX.cross(at.clone(),GREEN,size*2,.22);
    var floor=typeof worldFloor==='function'?worldFloor(at,at.y+1.2):0;
    FX.cracks(V(at.x,(Number.isFinite(floor)?floor:at.y)+.05,at.z),5,size*2,WOOD);
    addShake(.65); if(typeof hitstop==='function')hitstop(.055);
  }
  function rootsWave(from,d,t,owner) {
    for(var j=0;j<2;j++) {
      var at=from.clone().addScaledVector(d,4+t*4.4).addScaledVector(sideOf(d),(j?1:-1)*(1.3+t*.32));
      var floor=typeof worldFloor==='function'?worldFloor(at,from.y+1.2):0;
      at.y=Number.isFinite(floor)?floor:from.y;root(at,d,4.2+t*.62,.55+t*.09,.95,owner);
    }
  }
  function bud(from,d,life,owner) {
    var g=new THREE.Group(),wood=material(0x33442b),light=material(GREEN),dark=material(0x171e18);
    g.position.copy(from);g.quaternion.setFromUnitVectors(V(0,1,0),d);
    mesh(g,surface([[-.8,.01,.01],[-.45,.28,.28],[0,.38,.38],[.65,.12,.12],[1.15,.005,.005]],.11),wood);
    for(var i=0;i<5;i++){var a=i/5*TAU;
      curveMesh(g,[[Math.cos(a)*.2,-.6,Math.sin(a)*.2],[Math.cos(a)*.43,-.1,Math.sin(a)*.43],[Math.cos(a)*.21,.6,Math.sin(a)*.21]],.053,.008,light,12);
      var thorn=mesh(g,new THREE.ConeGeometry(.12,.6,5),dark);thorn.position.set(Math.cos(a)*.33,.04,Math.sin(a)*.33);thorn.rotation.z=-Math.cos(a);
    }
    effect(g,life,function(t){g.position.copy(from).addScaledVector(d,t*30);g.rotateY(.14);},owner);
  }
  function blossom(at,size,life,owner) {
    var g=flower(material(PINK),material(LIGHT,true),size);g.position.copy(at);
    effect(g,life,function(t){openFlower(g,smooth(t/.5));g.rotation.z=t*.32;},owner);return g;
  }
  function branchSweep(from,d,owner) {
    var g=new THREE.Group();g.position.copy(from);g.rotation.y=Math.atan2(d.x,d.z);
    var wood=material(WOOD),light=material(0x9c9671);
    curveMesh(g,[[-5,.1,2],[-4,1.2,4],[0,2,7],[5,3.8,5]],.86,.035,wood,32);
    for(var j=0;j<7;j++)curveMesh(g,[[-4+j*1.3,1.7,4],[-3.5+j*1.3,3.4,5],[-3.8+j*1.4,5.5,5.6]],.25,.01,light,12);
    effect(g,.75,function(t){g.scale.setScalar(.3+.7*smooth(t/.16));g.rotation.y=Math.atan2(d.x,d.z)-.8+t*1.8;g.position.y=from.y-.25+Math.sin(t/.75*Math.PI)*.7;},owner);
    petals(from.clone().addScaledVector(d,5).add(V(0,2,0)),20,GREEN,5,.8,owner);
    FX.slash(from.clone().addScaledVector(d,4).add(V(0,2.6,0)),V(0,1,0),LIGHT,13,.26);
  }
  function solar(from,d,length,owner) {
    var g=new THREE.Group();g.position.copy(from);g.quaternion.setFromUnitVectors(V(0,0,1),d);
    var outer=material(GREEN,true),dark=material(0x4a7141,true),white=material(LIGHT,true);
    // Three ragged ribbons, with a twisting vine cage and a flower-shaped muzzle.
    [0,1,2].forEach(function(layer){var vs=[],ids=[];
      for(var j=0;j<=28;j++){var t=j/28,w=(.3+Math.sin(Math.PI*t)*1.15)*(layer===2?.27:1)*(1+.17*Math.sin(j*2.7));
        vs.push(-w,0,t*length,w,0,t*length);if(j){var k=j*2;ids.push(k-2,k,k+1,k-2,k+1,k-1);}}
      var geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vs,3));geo.setIndex(ids);geo.computeVertexNormals();
      var m=mesh(g,geo,layer===2?white:layer?dark:outer);m.rotation.z=layer===1?Math.PI/2:.3;
    });
    for(var i=0;i<3;i++){var points=[];for(var j=0;j<=24;j++){var t=j/24,a=t*TAU*2+i/3*TAU;points.push([Math.cos(a)*1.1,Math.sin(a)*1.1,t*length]);}
      curveMesh(g,points,.075,.025,dark,40);}
    effect(g,.48,function(t){g.scale.z=smooth(t/.07);g.scale.x=g.scale.y=1+.06*Math.sin(t*65);},owner);
    blossom(from,1.7,.65,owner);petals(from.clone().addScaledVector(d,length),24,GREEN,6,1,owner);
    FX.cutLine(from.clone(),from.clone().addScaledVector(d,length),LIGHT,.23,.21);
  }
  function field(at,owner) {
    var g=new THREE.Group();g.position.copy(at);var count=112,blooms=[];
    // 1,568 petals, 112 centers and 112 stems in just three instanced draws.
    var petalMesh=new THREE.InstancedMesh(petalGeo(1,.3,.36),material(0xffffff),count*14);
    var centers=new THREE.InstancedMesh(new THREE.SphereGeometry(.2,8,6),material(0xf7deb0),count);
    var stems=new THREE.InstancedMesh(new THREE.CylinderGeometry(.018,.026,1,5),material(MOSS),count);
    petalMesh.frustumCulled=centers.frustumCulled=stems.frustumCulled=false;g.add(petalMesh,centers,stems);
    var base=new THREE.Object3D(),center=new THREE.Object3D(),rz=new THREE.Matrix4(),rx=new THREE.Matrix4(),transform=new THREE.Matrix4();
    for(var i=0;i<count;i++) {
      var angle=i*2.399963,radius=10*Math.sqrt((i+.5)/count),x=Math.cos(angle)*radius,z=Math.sin(angle)*radius;
      var height=.3+(i%3)*.12,size=.39+(i%4)*.075;
      blooms.push({x:x,z:z,h:height,size:size,delay:radius*.032});
      for(var j=0;j<14;j++)petalMesh.setColorAt(i*14+j,new THREE.Color(i%3?0xe394ab:0xf7deb0));
      center.position.set(x,height*.5,z);center.scale.set(1,height,1);center.updateMatrix();stems.setMatrixAt(i,center.matrix);
    }
    petalMesh.instanceColor.needsUpdate=true;stems.instanceMatrix.needsUpdate=true;
    var entry=effect(g,4.1,function(t){blooms.forEach(function(b,i){
      var k=smooth((t-b.delay)/.35);base.position.set(b.x,b.h*k,b.z);base.rotation.set(-Math.PI/2,0,Math.sin(t*1.7+b.delay)*.12);
      base.scale.setScalar(Math.max(.001,k*b.size));base.updateMatrix();centers.setMatrixAt(i,base.matrix);
      for(var j=0;j<14;j++){
        var layer=j>=7?1:0;rz.makeRotationZ(j%7/7*TAU+layer*.36);rx.makeRotationX(1.42-k*(1.13-layer*.2));
        transform.copy(base.matrix).multiply(rz).multiply(rx);petalMesh.setMatrixAt(i*14+j,transform);
      }
    });petalMesh.instanceMatrix.needsUpdate=centers.instanceMatrix.needsUpdate=true;},owner);
    petals(at.clone(),28,PINK,10,3.8,owner);
    // Root tracery under the flowers makes the radius readable without a sphere.
    for(i=0;i<8;i++){var a=i/8*TAU;root(at.clone().add(V(Math.cos(a)*9,0,Math.sin(a)*9)),V(-Math.cos(a),0,-Math.sin(a)),.7,.14,3.7,owner);}
    return entry;
  }

  /* Shared timelines. Remote replay calls the exact visual events below;
     only the local action runs hit tests. Outgoing casts remain MP's job. */
  var EVENTS={hn1:[.38,.48,.58,.68,.78],hn2:[.38,.55,.72],hn3:[.56],hn4:[.18,.96],hnr:[.42]};
  function visual(key,index,from,d,owner) {
    if(key==='hn1')rootsWave(from,d,index,owner);
    if(key==='hn2')bud(from.clone().addScaledVector(d,1.4).add(V(0,2.7+index*.18,0)),d,1.0,owner);
    if(key==='hn3')branchSweep(from,d,owner);
    if(key==='hn4') {
      var origin=from.clone().addScaledVector(sideOf(d),-1.15).add(V(0,4.1,0));
      if(index===0){blossom(origin,1.25,.8,owner);petals(from,20,GREEN,4,.8,owner);}
      else solar(origin,d,30,owner);
    }
    if(key==='hnr')return field(from,owner);
  }
  function targets(from,d,length,width,minHeight,maxHeight) {
    return enemies.filter(function(e){
      if(!e||e.dead)return false;
      var delta=e.pos.clone().sub(from),along=delta.x*d.x+delta.z*d.z;
      var across=delta.x*d.z-delta.z*d.x;
      return along>=-1.8 && along<=length && Math.abs(across)<=width && delta.y<=maxHeight && delta.y+5>=minHeight;
    });
  }
  function hit(e,key,amount,d,power,up) {
    if(!e||e.dead)return;
    e.damage(amount,d.clone().multiplyScalar(power).add(V(0,up,0)),{
      stun:key==='hnr'?.8:.6,react:key==='hnr'?'stagger':'blow',reactDur:.65,
      spark:GREEN,fin:key!=='hnr',finSkill:key,noFrameBonus:true
    });
    impact(e.pos.clone().add(V(0,2.7,0)),d,2.3,true);
  }
  function cast(key) {
    if(!KIT[key] || player.char!=='hanami'||!started||player.dead||busy()||player.react||cds[key]>0)return false;
    if(window.JJNAOYA&&window.JJNAOYA.busy())return false;
    cds[key]=KIT[key].cd;
    player.action={type:key,t:0,dur:KIT[key].dur,stage:0,origin:player.pos.clone(),dir:direction(player.facing),hits:[],projectiles:[]};
    showSplash(KIT[key].name.toUpperCase(),key==='hnr'?'BLOOM • DISTRACT • ENDURE':'CURSED PLANT MANIPULATION','#91cf62');
    if(sfx.raise)sfx.raise();return true;
  }
  H.cast=cast; H.kit=KIT;
  function step(a,dt) {
    var key=a.type,d=a.dir,from=a.origin;
    player.vel.x*=Math.exp(-dt*16);player.vel.z*=Math.exp(-dt*16);
    if(key==='hnr'&&H.field&&(H.field.dead||H.field.t>4.1))H.field=null;
    var times=EVENTS[key];
    while(a.stage<times.length&&a.t>=times[a.stage]) {
      var index=a.stage++;
      var prop=visual(key,index,from,d,true);
      if(key==='hnr') {
        H.field=prop;
        enemies.slice().forEach(function(e){if(e&&!e.dead&&e.pos.distanceTo(from)<10.5)hit(e,key,10,d,0,0);});
      } else if(key==='hn1') {
        if(window.JJDESTRUCT)JJDESTRUCT.hit(from.clone().addScaledVector(d,5+index*4.4).add(V(0,.5,0)),4);
        targets(from,d,7+index*4.4,4+index*.3,-1,4.7).forEach(function(e){
          if(a.hits.indexOf(e)<0){a.hits.push(e);hit(e,key,34,d,14,17);}
        });
      } else if(key==='hn2') {
        a.projectiles.push({index:index,t:0,start:from.clone().addScaledVector(d,1.4).add(V(0,2.7+index*.18,0)),hit:[]});
      } else if(key==='hn3') {
        if(window.JJDESTRUCT)JJDESTRUCT.hit(from.clone().addScaledVector(d,5).add(V(0,2,0)),6);
        targets(from,d,10,6,-1,6).forEach(function(e){hit(e,key,32,d,25,20);});
      } else if(key==='hn4'&&index===1) {
        var muzzle=from.clone().addScaledVector(sideOf(d),-1.15);
        if(window.JJDESTRUCT)JJDESTRUCT.sweep(muzzle.clone().add(V(0,3.6,0)),muzzle.clone().add(V(0,3.6,0)).addScaledVector(d,30),7);
        targets(muzzle,d,30,2.5,2.8,5.1).forEach(function(e){hit(e,key,38,d,34,10);});
      }
      if(player.action!==a)return; // A lethal hit handed control to its finisher.
    }
    // Swept segments prevent fast buds tunnelling through a body on a long frame.
    a.projectiles.forEach(function(p){
      var prev=p.t;p.t=Math.min(1,p.t+dt);if(prev>=1)return;
      var start=p.start.clone().addScaledVector(d,prev*30),len=(p.t-prev)*30;
      if(window.JJDESTRUCT)JJDESTRUCT.sweep(start,start.clone().addScaledVector(d,len+1),2.5);
      targets(start,d,len+1,1.5,-1.6,1.6).forEach(function(e){if(p.hit.indexOf(e)<0){p.hit.push(e);hit(e,key,10,d,2,0);blossom(e.pos.clone().add(V(0,3,0)),.6,.65,true);}});
    });
  }

  /* Art-directed key poses: hips initiate, shoulders follow, wrists snap at
     contact, then the entire silhouette settles. The clock alone is enough
     to reconstruct each pose on a spectator's rig. */
  var POSES={
    hn1:[
      [0,{}],[.24,{spine:[-.2,0,0],shoulderR:[-2.5,0,-.22],elbowR:[-.65,0,0],shoulderL:[-.65,0,.25],hipL:[-.22,0,-.18],kneeL:[.4,0,0],height:-.2}],
      [.39,{spine:[.48,.12,0],shoulderR:[.4,0,-.1],elbowR:[-.12,0,0],shoulderL:[.25,0,.4],hipL:[-.5,0,-.2],kneeL:[.8,0,0],height:-.38}],
      [.84,{spine:[.28,.1,0],shoulderR:[.28,0,-.13],elbowR:[-.2,0,0],height:-.16}],[1.4,{}]],
    hn2:[
      [0,{}],[.28,{spine:[-.12,-.55,0],hips:[0,-.18,0],shoulderR:[-.6,0,-.7],elbowR:[-1.7,0,0],shoulderL:[-.8,0,.3]}],
      [.4,{spine:[.12,.32,0],hips:[0,.15,0],shoulderR:[-1.5,0,.18],elbowR:[-.1,0,0]}],
      [.53,{spine:[.02,-.25,0],shoulderR:[-1.1,0,-.35],elbowR:[-.65,0,0]}],
      [.57,{spine:[.12,.24,0],shoulderR:[-1.55,0,.16],elbowR:[-.08,0,0]}],
      [.69,{spine:[0,-.2,0],shoulderR:[-1.15,0,-.3],elbowR:[-.6,0,0]}],
      [.75,{spine:[.16,.3,0],shoulderR:[-1.55,0,.18],elbowR:[-.05,0,0]}],[1.1,{shoulderR:[-1,0,-.1]}],[1.85,{}]],
    hn3:[
      [0,{}],[.38,{hips:[0,-.55,0],spine:[-.12,-.65,-.1],shoulderR:[-.4,0,-1.3],elbowR:[-.6,0,0],hipR:[-.3,0,.22],kneeR:[.55,0,0],height:-.25}],
      [.6,{hips:[0,.42,0],spine:[.25,.82,.12],shoulderR:[-1.2,0,.9],elbowR:[-.08,0,0],shoulderL:[-.4,0,.4],hipL:[-.45,0,-.25],kneeL:[.45,0,0],height:-.1}],
      [.9,{spine:[.2,.4,.07],shoulderR:[-.85,0,.6],height:-.12}],[1.35,{}]],
    hn4:[
      [0,{}],[.45,{spine:[-.22,.38,0],shoulderL:[-.7,0,.62],elbowL:[-.8,0,0],shoulderR:[-.7,0,-.3],elbowR:[-1.4,0,0],hipL:[-.3,0,-.22],hipR:[.25,0,.22],kneeL:[.42,0,0],height:-.16,bloom:1}],
      [.88,{spine:[-.3,.3,0],shoulderL:[-1.35,0,.18],elbowL:[-.1,0,0],shoulderR:[-.5,0,-.5],height:-.27,bloom:1}],
      [1.02,{spine:[-.5,.2,0],shoulderL:[-1.58,0,.15],elbowL:[-.06,0,0],shoulderR:[.25,0,-.7],kneeL:[.5,0,0],height:-.35,bloom:1}],
      [1.52,{spine:[.12,.2,0],shoulderL:[-1.1,0,.28],height:-.15,bloom:.65}],[2.05,{}]],
    hnr:[
      [0,{}],[.25,{spine:[.14,0,0],neck:[.18,0,0],shoulderL:[-1.1,0,.35],shoulderR:[-1.1,0,-.35],elbowL:[-1.4,0,0],elbowR:[-1.4,0,0],height:-.2}],
      [.48,{spine:[-.17,0,0],neck:[-.15,0,0],shoulderL:[-.8,0,1.15],shoulderR:[-.8,0,-1.15],elbowL:[-.15,0,0],elbowR:[-.15,0,0],height:-.08}],
      [.78,{shoulderL:[-.4,0,.7],shoulderR:[-.4,0,-.7]}],[1.05,{}]]
  };
  POSES.fin_hn1=[
    [0,{}],[.32,{spine:[.5,0,0],shoulderL:[.5,0,.4],shoulderR:[.5,0,-.4],hipL:[-.6,0,-.2],hipR:[-.6,0,.2],kneeL:[1.0,0,0],kneeR:[1.0,0,0],height:-.45}],
    [.87,{spine:[-.28,0,0],neck:[-.2,0,0],shoulderL:[-2.5,0,.45],shoulderR:[-2.5,0,-.45],elbowL:[-.3,0,0],elbowR:[-.3,0,0],height:-.04}],
    [1.14,{spine:[.42,0,0],shoulderL:[-.3,0,.1],shoulderR:[-.3,0,-.1],elbowL:[-1.4,0,0],elbowR:[-1.4,0,0],height:-.3}],[1.85,{}]];
  POSES.fin_hn2=[
    [0,{}],[.32,{spine:[-.16,-.24,0],shoulderR:[-1.6,0,-.2],shoulderL:[-.65,0,.3],elbowL:[-1.4,0,0]}],
    [.82,{spine:[-.3,0,0],neck:[-.17,0,0],shoulderL:[-1.2,0,1.2],shoulderR:[-1.2,0,-1.2],elbowL:[-.15,0,0],elbowR:[-.15,0,0],height:-.15}],
    [1.03,{spine:[.25,0,0],shoulderL:[-1.1,0,.12],shoulderR:[-1.1,0,-.12],elbowL:[-1.7,0,0],elbowR:[-1.7,0,0],height:-.25}],[1.65,{}]];
  POSES.fin_hn3=[
    [0,{}],[.65,{spine:[-.24,-.3,0],hipR:[-1.2,0,.2],kneeR:[1.6,0,0],shoulderR:[-2.7,0,-.4],elbowR:[-.7,0,0],shoulderL:[-.4,0,.8],height:.15}],
    [1.08,{spine:[.55,.2,0],shoulderR:[.5,0,-.15],elbowR:[-.1,0,0],hipR:[-.1,0,.2],kneeR:[.3,0,0],hipL:[-.3,0,-.2],kneeL:[.5,0,0],height:-.4}],
    [1.42,{spine:[.3,.15,0],shoulderR:[.3,0,-.1],height:-.15}],[1.8,{}]];
  POSES.fin_hn4=[
    [0,{}],[.6,{spine:[-.22,.35,0],neck:[-.15,0,0],shoulderL:[-2.5,0,.32],elbowL:[-.35,0,0],shoulderR:[-.6,0,-.3],elbowR:[-1.4,0,0],bloom:1,height:-.2}],
    [1.13,{spine:[-.32,.3,0],shoulderL:[-1.4,0,.12],elbowL:[-.08,0,0],shoulderR:[-.4,0,-.8],hipL:[-.3,0,-.3],hipR:[.3,0,.3],bloom:1,height:-.3}],
    [1.32,{spine:[-.55,.2,0],shoulderL:[-1.75,0,.15],elbowL:[-.1,0,0],shoulderR:[.4,0,-.9],bloom:1,height:-.4}],
    [1.7,{spine:[.1,.1,0],shoulderL:[-1.1,0,.2],bloom:.8,height:-.2}],[2.15,{}]];
  function applyPose(r,key,t) {
    var seq=POSES[key];if(!seq)return false;
    resetPose(r);if(r.body)r.body.rotation.set(0,0,0);
    var index=1;while(index<seq.length-1&&t>seq[index][0])index++;
    var left=seq[index-1],right=seq[index],mix=smooth((t-left[0])/(right[0]-left[0]));
    JOINTS.forEach(function(j){var a=left[1][j]||[0,0,0],b=right[1][j]||[0,0,0];
      r[j].rotation.set(a[0]+(b[0]-a[0])*mix,a[1]+(b[1]-a[1])*mix,a[2]+(b[2]-a[2])*mix);});
    r.hips.position.y=r.hipsBaseY+(left[1].height||0)*(1-mix)+(right[1].height||0)*mix;
    var bloomAmount=(left[1].bloom||0)*(1-mix)+(right[1].bloom||0)*mix;
    if(r.hanamiBloom){openFlower(r.hanamiBloom,bloomAmount);r.hanamiBloom.visible=bloomAmount>.03;}
    if(r.hanamiSleeve){r.hanamiSleeve.scale.set(1-.82*bloomAmount,1-.85*bloomAmount,1-.8*bloomAmount);r.hanamiSleeve.visible=bloomAmount<.97;}
    if(r.hanamiWrap){r.hanamiWrap.rotation.z=Math.sin(t*7)*.018;r.hanamiWrap.rotation.x=-r.spine.rotation.x*.08;}
    return true;
  }
  H.pose=applyPose;
  var prevLocomotion=applyLocomotion;
  applyLocomotion=function(r,t,gait,move,run,grounded,vy){
    prevLocomotion(r,t,gait,move,run,grounded,vy);
    if(r.__char!=='hanami')return;
    if(r.hanamiBloom){openFlower(r.hanamiBloom,0);r.hanamiBloom.visible=false;}
    if(r.hanamiSleeve){r.hanamiSleeve.scale.set(1,1,1);r.hanamiSleeve.visible=true;}
    r.shoulderL.rotation.z+=.18;r.shoulderR.rotation.z-=.15;
    if(move<.1&&grounded){r.spine.rotation.x=-.045+Math.sin(t*1.35)*.025;r.elbowL.rotation.x=-.24;r.elbowR.rotation.x=-.15;}
    if(r.hanamiWrap){r.hanamiWrap.rotation.set(Math.sin(gait)*move*.025,0,Math.sin(t*2)*.01+Math.sin(gait)*move*.018);}
  };
  var prevStep=stepAction;stepAction=function(a,dt){if(KIT[a.type])return step(a,dt);return prevStep(a,dt);};
  var prevPose=poseAction;poseAction=function(r,a){if(a&&KIT[a.type]&&applyPose(r,a.type,a.t))return;return prevPose(r,a);};
  var prevHurt=hurtPlayer;hurtPlayer=function(amount,knock){
    if(player.char==='hanami'&&H.field&&!H.field.dead&&player.pos.distanceTo(H.field.group.position)<10.5)amount*=.65;
    return prevHurt(amount,knock);
  };
  var previousSwitch=switchChar;switchChar=function(id,quiet){
    var before=player.char,result=previousSwitch(id,quiet);
    if(before==='hanami'&&player.char!==before){H.props.slice().filter(function(e){return e.owner;}).forEach(discard);H.field=null;}
    return result;
  };
  var prevUpdate=updatePlayer;updatePlayer=function(dt){
    prevUpdate(dt);
    if(player.dead&&H.field){discard(H.field);H.field=null;}
  };
  window.addEventListener('keydown',function(e){
    if(!started||player.char!=='hanami'||e.repeat||e.ctrlKey||e.metaKey||e.altKey)return;
    if(e.target&&e.target.closest&&e.target.closest('input,textarea,select,[contenteditable="true"]'))return;
    var key={Digit1:'hn1',Digit2:'hn2',Digit3:'hn3',Digit4:'hn4',KeyR:'hnr'}[e.code];
    if(!key)return;cast(key);e.preventDefault();e.stopImmediatePropagation();
  },true);
  Object.keys(KIT).forEach(function(key){H.remote[key]=function(pos,yaw){
    var t=0,index=0,d=direction(yaw),times=EVENTS[key],origin=pos.clone();
    addFx({update:function(dt){t+=dt;while(index<times.length&&t>=times[index])visual(key,index++,origin,d,false);return t<KIT[key].dur;}});
  };});

  /* Finisher VFX are shared by local and remote playback. Damage and health
     pinning remain exclusively in finisher.js. The caster pose uses hafin's
     existing named-pose protocol, never a callback sent across the wire. */
  H.finisher=function(key,e,d,p,G,local){
    var floor=V(p.x,0,p.z),duration={hn1:1.85,hn2:1.65,hn3:1.8,hn4:2.15}[key];
    if(local&&window.JJFEVER){window.JJFEVER.perform(duration,function(a,dt,actor){actor.vel.x*=Math.exp(-dt*15);actor.vel.z*=Math.exp(-dt*15);},null,'hanami_'+key);}
    var t=0,stage=0;
    addFx({update:function(dt){t+=dt;
      if(stage===0){stage=1;
        if(key==='hn1')for(var j=0;j<7;j++){var a=j/7*TAU;root(floor.clone().add(V(Math.cos(a)*3,0,Math.sin(a)*3)),V(-Math.cos(a),0,-Math.sin(a)),7,.75,1.85,local);}
        if(key==='hn2')for(j=0;j<5;j++)blossom(p.clone().add(V(Math.cos(j*1.8)*1.3,(j%3)-1,Math.sin(j*1.8)*1.3)),.9,1.6,local);
        if(key==='hn3'){root(floor.clone().addScaledVector(d,2),d.clone().negate(),10,1.8,1.7,local);petals(p,24,GREEN,5,1.8,local);}
        if(key==='hn4'){blossom(p,4.3,2.05,local);petals(floor,40,GREEN,8,1.5,local);}
      }
      if(stage===1&&t>duration*.58){stage=2;
        if(key==='hn1'){for(var i=0;i<4;i++){var a2=i/4*TAU;root(floor.clone().add(V(Math.cos(a2)*1.4,0,Math.sin(a2)*1.4)),d,10,1.0,.7,local);}G.fling(e,V(0,25,0),V(3,0,2));}
        if(key==='hn2'){for(i=0;i<6;i++)root(floor,direction(i/6*TAU),5,.28,.75,local);G.fling(e,d.clone().multiplyScalar(18).add(V(0,13,0)),V(2,4,0));}
        if(key==='hn3'){branchSweep(floor.clone().addScaledVector(d,-4),d,local);G.flatten(e,{crater:8});}
        if(key==='hn4'){solar(p.clone().addScaledVector(d,-9),d,22,local);G.fling(e,d.clone().multiplyScalar(34).add(V(0,16,0)),V(5,1,2));}
        impact(p,d,key==='hn4'?6:4,local);FX.flash('#e5f4c8',.23,.14);
      }
      return t<duration;
    }});
  };
  // fever.js loads later; register once after the complete bundle has booted.
  addFx({update:function(){
    if(!window.JJFEVER)return true;
    ['hn1','hn2','hn3','hn4'].forEach(function(key){window.JJFEVER.finPose['hanami_'+key]=function(r,a){
      applyPose(r,'fin_'+key,a.t);
    };});return false;
  }});
  // The AI invokes these same casts and the shared action/pose dispatchers.
  (window.JJCHARCAST ||= {}).hanami = { cast: ['hn1','hn2','hn3','hn4','hnr'].map(key=>()=>cast(key)), state: H };
})();
