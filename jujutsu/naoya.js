/* =======================================================================
   NAOYA — AWAKENING
   Two halves.

   The rush: twenty seconds at a speed nothing in the arena can answer.
   You steer it, and anything you touch is thrown and goes limp. It ends
   with a drift, a hand dragged through the floor, and a punch into
   whoever you left hanging.

   The finish: a cut only the two of you see. It runs on a stage built
   out of sight above the city, so the arena never has to be taken apart
   — every other player carries on watching the pair of you stand still.

     1  a green room full of branches, the victim held in a frame, and
        one punch taken as slowly as it can be taken
     2  the frame goes, the gut folds, three rings leave the belly
     3  one second of a still panel, cut in with nothing either side
     4  a wall of packed earth, colour blooming out of it, then through it
     5  a slab of ground hanging in the air, boot on the belly, the
        mountain coming apart behind
     6  off, run, and put them through the slab
     7  down after them, land on them, and take the ground with you
     8  they get up into a circle of speed with nobody in it
     9  the uppercut, the frame in the sky, twenty four passes and one
        fist through the middle of it
    10  white, and back to the arena

   ===================================================================== */
(function () {
  'use strict';
  if (typeof player === 'undefined' || typeof THREE === 'undefined') return;
  var FX = window.JJFX;
  if (!FX) return;

  var TAU = Math.PI * 2;
  var E = FX.ease;
  var STAGE = new THREE.Vector3(0, 900, 0);       // where the cut is played

  var NA = window.JJNAOYA = {
    awaken: awaken,
    rushing: function () { return RUSH.on; },
    cine: function () { return CINE.on; },
    remoteCine: remoteCine,
    busy: function () { return RUSH.on || CINE.on; },
    panel: function (on) { panel(on); }          // the still, for a look at it
  };

  /* =====================================================================
     ART
     ================================================================== */
  function canvas(w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }
  function texOf(c) {
    var t = new THREE.CanvasTexture(c);
    t.needsUpdate = true;
    return t;
  }

  /* the wall of packed earth: deep red-brown, with hairline fractures
     wandering across it the way dried mud splits */
  var TEX_WALL = (function () {
    var c = canvas(1024, 640), g = c.getContext('2d');
    var grad = g.createRadialGradient(512, 300, 60, 512, 320, 760);
    grad.addColorStop(0, '#6c3742');
    grad.addColorStop(.55, '#54262f');
    grad.addColorStop(1, '#2b1219');
    g.fillStyle = grad;
    g.fillRect(0, 0, 1024, 640);
    /* blotchy damp patches */
    for (var i = 0; i < 220; i++) {
      var x = Math.random() * 1024, y = Math.random() * 640, r = 12 + Math.random() * 90;
      var b = g.createRadialGradient(x, y, 0, x, y, r);
      var dark = Math.random() < .5;
      b.addColorStop(0, dark ? 'rgba(20,8,12,.18)' : 'rgba(150,90,96,.10)');
      b.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = b;
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
    /* fractures */
    g.lineCap = 'round';
    for (var k = 0; k < 46; k++) {
      var px = Math.random() * 1024, py = Math.random() * 640;
      var a = Math.random() * TAU, len = 40 + Math.random() * 260;
      g.strokeStyle = 'rgba(12,5,8,' + (.35 + Math.random() * .5) + ')';
      g.lineWidth = .6 + Math.random() * 1.7;
      g.beginPath(); g.moveTo(px, py);
      var steps = 5 + (Math.random() * 8 | 0);
      for (var s = 0; s < steps; s++) {
        a += (Math.random() - .5) * 1.5;
        px += Math.cos(a) * len / steps;
        py += Math.sin(a) * len / steps;
        g.lineTo(px, py);
      }
      g.stroke();
      if (Math.random() < .4) {                    // a branch off the crack
        g.beginPath(); g.moveTo(px, py);
        g.lineTo(px + Math.cos(a + 1.2) * 40, py + Math.sin(a + 1.2) * 40);
        g.stroke();
      }
    }
    return texOf(c);
  })();

  /* a limb of the thing growing through the green room: thick at the root,
     splitting as it goes */
  var TEX_BRANCH = (function () {
    var c = canvas(512, 512), g = c.getContext('2d');
    g.strokeStyle = '#1f2c1d';
    g.lineCap = 'round';
    function limb(x, y, a, len, w, depth) {
      var steps = 7;
      for (var i = 0; i < steps; i++) {
        var nx = x + Math.cos(a) * len / steps;
        var ny = y + Math.sin(a) * len / steps;
        g.lineWidth = w * (1 - i / steps * .55);
        g.beginPath(); g.moveTo(x, y); g.lineTo(nx, ny); g.stroke();
        x = nx; y = ny;
        a += (Math.random() - .5) * .34;
        if (depth > 0 && i > 1 && Math.random() < .45) {
          limb(x, y, a + (Math.random() < .5 ? 1 : -1) * (.5 + Math.random() * .6),
            len * (.35 + Math.random() * .3), w * .5, depth - 1);
        }
      }
    }
    limb(40, 470, -1.05, 430, 40, 2);
    return texOf(c);
  })();

  /* the panes of colour that bloom out of the wall */
  var TEX_PANE = (function () {
    var c = canvas(128, 128), g = c.getContext('2d');
    var grad = g.createLinearGradient(0, 0, 128, 128);
    grad.addColorStop(0, 'rgba(255,255,255,.95)');
    grad.addColorStop(.5, 'rgba(255,255,255,.35)');
    grad.addColorStop(1, 'rgba(255,255,255,.05)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = 'rgba(255,255,255,.9)';
    g.lineWidth = 5;
    g.strokeRect(3, 3, 122, 122);
    return texOf(c);
  })();

  /* the one second panel: ink, hatching, an arch of stand roof, a face
     turned away and another behind it */
  var PANEL = (function () {
    var c = canvas(1280, 720), g = c.getContext('2d');
    var sky = g.createLinearGradient(0, 0, 0, 720);
    sky.addColorStop(0, '#8f949a');
    sky.addColorStop(.45, '#c9ccd0');
    sky.addColorStop(1, '#f2f3f4');
    g.fillStyle = sky; g.fillRect(0, 0, 1280, 720);

    /* the roof sweeping over the top of frame */
    g.save();
    g.strokeStyle = '#4a4f57'; g.lineWidth = 3;
    g.fillStyle = '#7e848c';
    g.beginPath();
    g.moveTo(-40, 300); g.quadraticCurveTo(640, 40, 1320, 250);
    g.lineTo(1320, 120); g.quadraticCurveTo(640, -60, -40, 190);
    g.closePath(); g.fill(); g.stroke();
    for (var rib = 0; rib < 16; rib++) {           // ribs under the roof
      var t = rib / 15;
      var x0 = -40 + t * 1360;
      g.beginPath();
      g.moveTo(x0, 190 + Math.sin(t * Math.PI) * 60);
      g.lineTo(x0 + 14, 300 + Math.sin(t * Math.PI) * 90);
      g.strokeStyle = 'rgba(40,44,50,.55)'; g.lineWidth = 2;
      g.stroke();
    }
    g.restore();

    /* hatching in the shadows */
    g.strokeStyle = 'rgba(30,33,38,.22)'; g.lineWidth = 1.4;
    for (var h = 0; h < 260; h++) {
      var hx = Math.random() * 1280, hy = 260 + Math.random() * 460;
      g.beginPath(); g.moveTo(hx, hy); g.lineTo(hx + 26, hy + 34); g.stroke();
    }

    /* the figure behind: shoulders and a head, kept as a flat shape with a
       rim of light down one side and no features at all */
    g.save();
    g.translate(900, 300);
    g.fillStyle = '#191c21';
    g.beginPath();
    g.moveTo(-150, 420); g.lineTo(-120, 130);
    g.quadraticCurveTo(-100, 40, -30, 22);          // shoulder into neck
    g.quadraticCurveTo(-70, -30, -46, -96);
    g.quadraticCurveTo(-10, -160, 66, -128);
    g.quadraticCurveTo(120, -100, 108, -16);
    g.quadraticCurveTo(150, 30, 176, 150);
    g.lineTo(200, 420);
    g.closePath(); g.fill();
    g.strokeStyle = 'rgba(240,240,238,.5)'; g.lineWidth = 3;
    g.beginPath();
    g.moveTo(66, -128); g.quadraticCurveTo(120, -100, 108, -16);
    g.quadraticCurveTo(150, 30, 176, 150);
    g.stroke();
    g.restore();

    /* the head in front: a profile facing left. The face is one clean
       shape, the hair is laid over the top of it, and nothing is drawn
       across the face itself — that is what made the last one a scribble. */
    g.save();
    g.translate(520, 360);
    g.scale(1.55, 1.55);

    g.fillStyle = '#0d1013';                        // shoulder and chest
    g.beginPath();
    g.moveTo(-96, 250); g.lineTo(-70, 140);
    g.quadraticCurveTo(-30, 96, 10, 92);
    g.quadraticCurveTo(80, 96, 120, 150);
    g.lineTo(150, 250);
    g.closePath(); g.fill();

    g.fillStyle = '#efe7dd';                        // the face
    g.beginPath();
    g.moveTo(-18, -78);                             // top of the forehead
    g.quadraticCurveTo(-54, -60, -60, -24);         // forehead
    g.lineTo(-56, -14);
    g.quadraticCurveTo(-74, 4, -70, 12);            // nose
    g.lineTo(-52, 18);
    g.quadraticCurveTo(-58, 30, -50, 34);           // lip
    g.quadraticCurveTo(-58, 50, -44, 62);           // chin
    g.quadraticCurveTo(-14, 84, 22, 74);            // jaw
    g.lineTo(44, -46);
    g.closePath(); g.fill();

    g.strokeStyle = '#1a1e24'; g.lineWidth = 2.6;   // the profile line
    g.beginPath();
    g.moveTo(-18, -78);
    g.quadraticCurveTo(-54, -60, -60, -24);
    g.lineTo(-56, -14);
    g.quadraticCurveTo(-74, 4, -70, 12);
    g.lineTo(-52, 18);
    g.quadraticCurveTo(-58, 30, -50, 34);
    g.quadraticCurveTo(-58, 50, -44, 62);
    g.quadraticCurveTo(-14, 84, 22, 74);
    g.stroke();

    g.fillStyle = '#12151a';                        // brow, eye, mouth
    g.save();
    g.translate(-34, -6); g.rotate(-.12);
    g.fillRect(-16, -16, 40, 6);
    g.beginPath(); g.ellipse(0, 2, 17, 6.5, 0, 0, TAU); g.fill();
    g.restore();
    g.strokeStyle = '#20242b'; g.lineWidth = 2.2;
    g.beginPath(); g.moveTo(-48, 40); g.lineTo(-22, 44); g.stroke();

    /* hair: one solid mass over the crown, then a fringe hanging in front
       of the forehead only, and a fall of strands down the back */
    g.fillStyle = '#0b0e11';
    g.beginPath();
    g.moveTo(-62, -18);
    g.quadraticCurveTo(-72, -96, -6, -118);         // over the forehead
    g.quadraticCurveTo(78, -142, 108, -60);
    g.quadraticCurveTo(126, 20, 96, 120);
    g.lineTo(50, 120);
    g.quadraticCurveTo(84, 20, 62, -48);
    g.quadraticCurveTo(30, -92, -22, -74);
    g.quadraticCurveTo(-46, -62, -44, -20);
    g.closePath(); g.fill();
    for (var s2 = 0; s2 < 11; s2++) {               // the fringe
      var fx = -58 + s2 * 9;
      g.strokeStyle = 'rgba(11,14,17,' + (.75 + Math.random() * .25) + ')';
      g.lineWidth = 5 + Math.random() * 8;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(fx, -86 + Math.random() * 8);
      g.quadraticCurveTo(fx - 12, -60, fx - 16 - Math.random() * 10, -26 - Math.random() * 22);
      g.stroke();
    }
    for (var s3 = 0; s3 < 9; s3++) {                // the fall down the back
      var bx = 60 + Math.random() * 46;
      g.strokeStyle = 'rgba(11,14,17,.9)';
      g.lineWidth = 6 + Math.random() * 10;
      g.beginPath();
      g.moveTo(bx, -70 + Math.random() * 40);
      g.quadraticCurveTo(bx + 26, 20, bx + 8 + Math.random() * 20, 110 + Math.random() * 40);
      g.stroke();
    }
    g.restore();

    /* a hard vignette, the way a printed panel darkens at the edge */
    var vg = g.createRadialGradient(640, 360, 260, 640, 360, 800);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,.55)');
    g.fillStyle = vg; g.fillRect(0, 0, 1280, 720);
    return c.toDataURL('image/png');
  })();

  /* =====================================================================
     SCREEN LAYER — the panel, the white out, the rush lines
     ================================================================== */
  var layer = null;
  function screen() {
    if (layer) return layer;
    var css = document.createElement('style');
    css.textContent = [
      '#jjNa{position:fixed;inset:0;z-index:16;pointer-events:none}',
      '#jjNaPanel{position:absolute;inset:0;background-size:cover;background-position:center;display:none}',
      '#jjNaWhite{position:absolute;inset:0;background:#fff;opacity:0}',
      '#jjNaRush{position:fixed;left:50%;top:12%;transform:translateX(-50%);z-index:12;',
      '  font-family:"Finger Paint","Segoe UI",cursive;text-align:center;display:none;pointer-events:none}',
      '#jjNaRush .k{font-size:12px;letter-spacing:8px;color:#cfe6ff;text-shadow:0 1px 5px #000}',
      '#jjNaRush .v{font-size:34px;letter-spacing:2px;color:#fff;text-shadow:0 0 18px #4aa3ff,0 2px 6px #000}',
      '#jjNaCard{position:fixed;left:0;right:0;top:33%;text-align:center;z-index:17;pointer-events:none;',
      '  font-family:"Finger Paint","Segoe UI",cursive;opacity:0}',
      '#jjNaCard.on{opacity:1}',
      '#jjNaCard .n{font-size:50px;letter-spacing:8px;color:#fff;',
      '  text-shadow:0 0 24px #7fd4ff,0 0 66px #7fd4ff,0 3px 0 #10141c}',
      '#jjNaCard .s{font-size:13px;letter-spacing:9px;color:#cfe2ff;margin-top:6px;text-shadow:0 1px 6px #000}'
    ].join('');
    document.head.appendChild(css);
    layer = document.createElement('div');
    layer.id = 'jjNa';
    layer.innerHTML = '<div id="jjNaPanel"></div><div id="jjNaWhite"></div>';
    document.body.appendChild(layer);
    var r = document.createElement('div');
    r.id = 'jjNaRush';
    r.innerHTML = '<div class="k">PROJECTION SORCERY</div><div class="v">20.0</div>';
    document.body.appendChild(r);
    var card = document.createElement('div');
    card.id = 'jjNaCard';
    card.innerHTML = '<div class="n">NAOYA ZEN\'IN</div><div class="s">TWENTY FOUR FRAMES</div>';
    document.body.appendChild(card);
    return layer;
  }
  function panel(on) {
    screen();
    var el = document.getElementById('jjNaPanel');
    el.style.backgroundImage = on ? 'url(' + PANEL + ')' : '';
    el.style.display = on ? 'block' : 'none';
  }
  function white(v) {
    screen();
    document.getElementById('jjNaWhite').style.opacity = String(v);
  }
  function hudOff(off) {
    ['hud', 'crosshair', 'jjScore', 'jjFeed', 'jjSwap', 'jjAwake', 'jjNotice', 'jjNaRush']
      .forEach(function (id) {
        var n = document.getElementById(id);
        if (n) n.style.visibility = off ? 'hidden' : '';
      });
  }

  /* =====================================================================
     HANDLES — the cut drives two bodies without caring which is ours
     ================================================================== */
  function selfHandle() {
    return {
      self: true, rig: player.rig, ent: player,
      char: player.char,
      hold: function () { player.vel.set(0, 0, 0); player.iframes = 9e9; },
      release: function () { player.iframes = 2; }
    };
  }
  function entHandle(e) {
    return {
      self: false, rig: e.rig, ent: e,
      char: e.net ? (MPfighterChar(e) || 'gojo') : 'dummy',
      hold: function () {
        e.cineHold = true; e.vel.set(0, 0, 0);
        if (e.hpSpr) e.hpSpr.visible = false;
      },
      release: function () {
        e.cineHold = false;
        if (e.hpSpr) e.hpSpr.visible = true;
      }
    };
  }
  function MPfighterChar(e) {
    var M = window.MPJJ;
    if (!M || !e.net) return null;
    var f = M.fighters[e.net.id];
    return f ? f.char : null;
  }

  /* place a body on the stage */
  function put(h, x, y, z, yaw) {
    h.rig.root.position.set(STAGE.x + x, STAGE.y + y, STAGE.z + z);
    h.rig.root.rotation.set(0, yaw == null ? 0 : yaw, 0);
    h.rig.root.scale.set(1, 1, 1);
  }
  function at(h) { return h.rig.root.position.clone(); }

  function cam(px, py, pz, lx, ly, lz) {
    camera.position.set(STAGE.x + px, STAGE.y + py, STAGE.z + pz);
    camera.lookAt(STAGE.x + lx, STAGE.y + ly, STAGE.z + lz);
  }
  /* the shot: a handful of marks, eased between */
  function shot(t, marks) {
    var i = 0;
    while (i < marks.length - 1 && t >= marks[i + 1].t) i++;
    var a = marks[i], b = marks[Math.min(i + 1, marks.length - 1)];
    var k = b === a ? 0 : E.out(Math.min(1, Math.max(0, (t - a.t) / Math.max(.001, b.t - a.t))));
    function mix(j) { return a.p[j] + (b.p[j] - a.p[j]) * k; }
    function look(j) { return a.l[j] + (b.l[j] - a.l[j]) * k; }
    cam(mix(0), mix(1), mix(2), look(0), look(1), look(2));
  }

  function shakeCam(m) {
    camera.position.x += (Math.random() - .5) * m;
    camera.position.y += (Math.random() - .5) * m;
    camera.position.z += (Math.random() - .5) * m;
  }
  function sp(x, y, z) { return new THREE.Vector3(STAGE.x + x, STAGE.y + y, STAGE.z + z); }

  /* =====================================================================
     THE RUSH
     ================================================================== */
  var RUSH = { on: false, t: 0, dur: 20, dir: new THREE.Vector3(0, 0, 1), lastHit: null, acc: 0, gait: 0, wipe: 0 };

  function awaken() {
    if (RUSH.on || CINE.on || player.dead) return false;
    if (player.char !== 'naoya') return false;
    RUSH.on = true; RUSH.t = 0; RUSH.lastHit = null; RUSH.wipe = 0; RUSH.gait = 0;
    RUSH.dir.set(Math.sin(player.facing), 0, Math.cos(player.facing));
    player.action = { type: 'nrush', t: 0, dur: RUSH.dur + 1.4 };
    player.iframes = Math.max(player.iframes, 1.2);
    screen();
    document.getElementById('jjNaRush').style.display = 'block';
    var card = document.getElementById('jjNaCard');
    card.classList.add('on');
    setTimeout(function () { card.classList.remove('on'); }, 1800);
    FX.mangaLines(true, 1.1);
    FX.flash('#dff0ff', .45, .35);
    FX.rings(new THREE.Vector3(player.pos.x, .1, player.pos.z), 0x9fd8ff, 3, { maxR: 15, life: .6, gap: 55 });
    FX.cracks(player.pos.clone(), 8, 10);
    FX.dust(player.pos.clone(), 8, 0xbfae95, 8, 3);
    addShake(.6);
    try { sfx.raise(); } catch (e) {}
    if (window.MPJJ && window.MPJJ.relay) {
      window.MPJJ.relay.pub({ t: 'cast', id: window.MPJJ.id, k: 'nrush' });
    }
    return true;
  }

  var RUSH_SPEED = 54;
  function stepRush(dt) {
    var p = player, r = p.rig;
    RUSH.t += dt;
    var left = RUSH.dur - RUSH.t;

    var el = document.getElementById('jjNaRush');
    if (el) el.querySelector('.v').textContent = Math.max(0, left).toFixed(1);

    /* --- the drift, then the punch --- */
    if (left <= 0) { stepWipe(dt); return; }

    /* --- steering: the camera leads, WASD leans it --- */
    var fwd = camForward();
    var right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    var want = fwd.clone();
    if (keys['KeyA']) want.addScaledVector(right, -1.1);
    if (keys['KeyD']) want.addScaledVector(right, 1.1);
    if (keys['KeyS']) want.multiplyScalar(-.35);
    if (want.lengthSq() < .001) want.copy(RUSH.dir);
    want.y = 0; want.normalize();
    RUSH.dir.lerp(want, Math.min(1, dt * 4.5)).normalize();

    p.vel.set(RUSH.dir.x * RUSH_SPEED, 0, RUSH.dir.z * RUSH_SPEED);
    p.pos.addScaledVector(p.vel, dt);
    p.pos.y = 0;
    p.onGround = true;
    collideWorld(p.pos, 1);
    p.facing = Math.atan2(RUSH.dir.x, RUSH.dir.z);
    p.iframes = Math.max(p.iframes, .5);

    /* --- what it leaves behind --- */
    RUSH.acc += dt;
    var behind = p.pos.clone().addScaledVector(RUSH.dir, -2.2);
    if (RUSH.acc > 1 / 24) {                       // his own frame rate
      RUSH.acc = 0;
      ghostAfterimage(r, 0x9fd8ff, .34);
      FX.dust(behind.clone(), 2, 0x9c8367, 7, 3.1);
      FX.streaks(behind.clone().add(new THREE.Vector3(0, 1.4, 0)), 0xbfe6ff, 2, 12, 1.2);
    }
    if (Math.random() < dt * 14) FX.debris(behind.clone(), 2, 11, 0x6b5642);
    if (Math.random() < dt * 7) FX.cracks(p.pos.clone(), 2, 7, 0x2a2018);
    if (Math.random() < dt * 5) {
      FX.ring(new THREE.Vector3(p.pos.x, .1, p.pos.z), 0xa8d8ff, { maxR: 5.5, life: .34 });
    }

    /* --- anything in the way --- */
    for (var i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      if (!e || e.dead || e.rag || e.cineHold) continue;
      if (e.pos.distanceTo(p.pos) > 4.2) continue;
      if (e.rushHitT && RUSH.t - e.rushHitT < 1.2) continue;
      e.rushHitT = RUSH.t;
      RUSH.lastHit = e;
      var kb = RUSH.dir.clone().multiplyScalar(42);
      kb.y = 17;
      /* the run softens people up, it does not finish them: there has to be
         somebody still standing at the end of it to finish */
      var dmg = Math.max(0, Math.min(14, (e.hp || 0) - 1));
      e.damage(dmg, kb, { react: 'stagger', reactDur: .8, spark: 0x9fd8ff, noFrameBonus: true });
      if (window.JJRAG && !e.net && !e.dead) window.JJRAG.start(e, kb.clone().multiplyScalar(.5), 2.6);
      FX.heavyHit(e.pos.clone().add(new THREE.Vector3(0, 2.8, 0)), 0x9fd8ff, 1.4);
      FX.slash(p.pos.clone().add(new THREE.Vector3(0, 2.4, 0)), RUSH.dir, 0xdfefff, 5, .2);
      addShake(.4);
      hitstop(.04);
    }

    /* --- the run itself, on twos --- */
    RUSH.gait += dt * 26;
    poseRun(r, RUSH.gait, RUSH.t);
    r.root.position.copy(p.pos);
    r.root.rotation.set(0, p.facing, 0);

    /* --- camera: low, behind, dragged along --- */
    var back = p.pos.clone().addScaledVector(RUSH.dir, -9.5).add(new THREE.Vector3(0, 3.6, 0));
    camera.position.lerp(back, Math.min(1, dt * 6));
    camera.lookAt(p.pos.clone().addScaledVector(RUSH.dir, 7).add(new THREE.Vector3(0, 2.4, 0)));
    if (RUSH.t < .6) FX.zoom(-14 * (1 - RUSH.t / .6), .1);
  }

  /* a sprinter's stride, exaggerated and low */
  function poseRun(r, g, t) {
    rp(r);
    var s = Math.sin(g), c = Math.cos(g);
    r.spine.rotation.x = .52 + Math.sin(g * 2) * .05;    // folded forward
    r.spine.rotation.y = s * .18;
    r.neck.rotation.x = -.46;
    r.hipL.rotation.x = -.1 + s * 1.35;
    r.hipR.rotation.x = -.1 - s * 1.35;
    r.kneeL.rotation.x = .75 - c * .75;
    r.kneeR.rotation.x = .75 + c * .75;
    r.ankleL.rotation.x = -.25 + s * .3;
    r.ankleR.rotation.x = -.25 - s * .3;
    r.shoulderL.rotation.x = -.5 - s * 1.25;
    r.shoulderR.rotation.x = -.5 + s * 1.25;
    r.shoulderL.rotation.z = .22;
    r.shoulderR.rotation.z = -.22;
    r.elbowL.rotation.x = -1.5;
    r.elbowR.rotation.x = -1.5;
    r.hips.position.y = r.hipsBaseY - .38 + Math.abs(s) * .1;
    if (t < .55) {                                       // out of the blocks
      var k = 1 - t / .55;
      r.spine.rotation.x = .52 + .5 * k;
      r.hipL.rotation.x = -.1 - 1.1 * k;
      r.kneeL.rotation.x = .75 + 1.1 * k;
      r.hipR.rotation.x = -.1 + 1.2 * k;
      r.shoulderR.rotation.x = -.5 - 1.6 * k;
      r.hips.position.y = r.hipsBaseY - .38 - .5 * k;
    }
  }

  /* the drift: a hand through the floor, a wall of dirt, then the punch */
  function stepWipe(dt) {
    var p = player, r = p.rig;
    RUSH.wipe += dt;
    var w = RUSH.wipe;
    var slow = Math.max(0, 1 - w / .85);
    p.vel.set(RUSH.dir.x * RUSH_SPEED * slow * .5, 0, RUSH.dir.z * RUSH_SPEED * slow * .5);
    p.pos.addScaledVector(p.vel, dt);
    collideWorld(p.pos, 1);

    resetPose(r);
    var lean = Math.min(1, w / .3);
    r.spine.rotation.x = .3 + .5 * lean;
    r.spine.rotation.y = -.55 * lean;
    r.shoulderL.rotation.x = -.2 - 1.5 * lean;           // the hand that drags
    r.shoulderL.rotation.z = .9 * lean;
    r.elbowL.rotation.x = -.35;
    r.shoulderR.rotation.x = -.4 + .2 * lean;
    r.elbowR.rotation.x = -1.7;
    r.hipL.rotation.x = -.75 * lean;
    r.kneeL.rotation.x = 1.15 * lean;
    r.hipR.rotation.x = .5 * lean;
    r.kneeR.rotation.x = .35 * lean;
    r.hips.position.y = r.hipsBaseY - .75 * lean;
    r.root.position.copy(p.pos);
    r.root.rotation.set(0, p.facing + .5 * lean, 0);

    if (slow > 0 && Math.random() < .9) {
      var side = new THREE.Vector3(-RUSH.dir.z, 0, RUSH.dir.x);
      FX.dust(p.pos.clone().addScaledVector(side, -1.4), 3, 0x9c8367, 9, 3.6);
      FX.debris(p.pos.clone(), 2, 9, 0x6b5642);
    }
    if (w < .1) {
      FX.cracks(p.pos.clone(), 7, 12, 0x2a2018);
      FX.ring(new THREE.Vector3(p.pos.x, .1, p.pos.z), 0xc9b598, { maxR: 12, life: .6 });
      addShake(.5);
    }

    var back = p.pos.clone().addScaledVector(RUSH.dir, -7).add(new THREE.Vector3(0, 3, 0));
    camera.position.lerp(back, Math.min(1, dt * 5));
    camera.lookAt(p.pos.clone().add(new THREE.Vector3(0, 2.2, 0)));

    if (w >= .9) endRush();
  }

  function endRush() {
    RUSH.on = false;
    var el = document.getElementById('jjNaRush');
    if (el) el.style.display = 'none';
    player.action = null;
    player.iframes = Math.max(player.iframes, .8);

    var v = RUSH.lastHit;
    if (v && (v.dead || !enemies.indexOf || enemies.indexOf(v) < 0)) v = null;
    if (!v) {
      /* nobody left hanging: pick whoever is closest, or just stop */
      var best = null, bd = 70;
      for (var i = 0; i < enemies.length; i++) {
        var e = enemies[i];
        if (!e || e.dead) continue;
        var d = e.pos.distanceTo(player.pos);
        if (d < bd) { bd = d; best = e; }
      }
      v = best;
    }
    if (!v) {
      if (window.JJNOTICE) window.JJNOTICE('NOBODY LEFT STANDING', '#9fd8ff');
      if (window.JJAW) window.JJAW.finish();
      return;
    }
    if (v.rag && window.JJRAG) window.JJRAG.stop(v);
    startCine(entHandle(v), selfHandle());
    /* the other side plays the same cut, from the other end of the fist */
    if (v.net && window.MPJJ && window.MPJJ.relay) {
      window.MPJJ.relay.pub({ t: 'ncine', id: window.MPJJ.id, to: v.net.id });
    }
  }

  /* somebody else's rush caught us */
  function remoteCine(attackerId) {
    var M = window.MPJJ;
    if (!M || CINE.on) return;
    var f = M.fighters[attackerId];
    if (!f || !f.e) return;
    startCine(selfHandle(), entHandle(f.e));
  }

  /* =====================================================================
     THE CUT
     ================================================================== */
  var CINE = { on: false, t: 0, beat: -1, bt: 0, A: null, V: null, stage: [], flags: {} };

  function startCine(V, A) {
    if (CINE.on) return;
    CINE.on = true; CINE.t = 0; CINE.beat = -1; CINE.bt = 0; CINE.flags = {};
    CINE.A = A; CINE.V = V;
    CINE.homeA = A.rig.root.position.clone();
    CINE.homeV = V.rig.root.position.clone();
    A.hold(); V.hold();
    if (A.self) { player.action = null; player.vel.set(0, 0, 0); }
    if (V.self) { player.action = null; player.vel.set(0, 0, 0); }
    hudOff(true);
    FX.letterbox(true);
    white(0);
    panel(false);
  }

  function endCine() {
    if (!CINE.on) return;
    var A = CINE.A, V = CINE.V;
    clearStage();
    panel(false);
    white(0);
    FX.letterbox(false);
    FX.tint('#000000', 0);
    hudOff(false);
    A.rig.root.position.copy(CINE.homeA);
    V.rig.root.position.copy(CINE.homeV);
    A.rig.root.rotation.set(0, 0, 0);
    V.rig.root.rotation.set(0, 0, 0);
    A.release(); V.release();
    CINE.on = false;

    /* The fist finally arrives. The victim applies it to themselves rather
       than being sent it, because a hit arriving while their own copy of
       the cut is still finishing would be thrown away. */
    var away = new THREE.Vector3();
    if (V.self) {
      away.subVectors(player.pos, A.ent.pos || player.pos);
      if (away.lengthSq() < .01) away.set(0, 0, 1);
      away.y = 0; away.normalize().multiplyScalar(30); away.y = 16;
      player.iframes = 0;
      _hurtPlayer(58, away);
      player.iframes = 1.4;
    } else if (A.self && V.ent && V.ent.damage && !V.ent.net) {
      away.subVectors(V.ent.pos, player.pos);
      if (away.lengthSq() < .01) away.set(0, 0, 1);
      away.y = 0; away.normalize().multiplyScalar(30); away.y = 16;
      V.ent.damage(58, away, { react: 'stagger', reactDur: .9, spark: 0x9fd8ff, noFrameBonus: true });
    }

    /* both of them arriving back where they were standing */
    [CINE.homeA, CINE.homeV].forEach(function (h) {
      FX.ring(new THREE.Vector3(h.x, .1, h.z), 0xbfe6ff, { maxR: 9, life: .5 });
      FX.dust(new THREE.Vector3(h.x, 0, h.z), 6, 0xc9bda6, 8, 3);
      FX.streaks(new THREE.Vector3(h.x, 2, h.z), 0xdfefff, 6, 12, 1.2);
    });
    FX.flash('#ffffff', .35, .45);
    addShake(.5);
    if (A.self) FX.trail(A.rig, 0x9fd8ff, 3, 45, .4);

    if (A.self && window.JJAW) window.JJAW.finish();
  }

  /* ------------------------------------------------------------- stage */
  function keep(o) { CINE.stage.push(o); scene.add(o); return o; }
  function clearStage() {
    CINE.stage.forEach(function (o) {
      scene.remove(o);
      if (o.geometry && o.__own) o.geometry.dispose();
      if (o.material) { if (o.material.map && o.material.__own) o.material.map.dispose(); o.material.dispose(); }
    });
    CINE.stage.length = 0;
  }

  function backdrop(colorTop, colorBottom, paint) {
    var W = paint ? 1024 : 8;
    var c = canvas(W, 256), g = c.getContext('2d');
    var grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, colorTop);
    grad.addColorStop(1, colorBottom);
    g.fillStyle = grad; g.fillRect(0, 0, W, 256);
    if (paint) paint(g, W, 256);
    var m = new THREE.Mesh(new THREE.SphereGeometry(150, 24, 16),
      new THREE.MeshBasicMaterial({ map: texOf(c), side: THREE.BackSide, depthWrite: false, toneMapped: false }));
    m.geometry.__own = true;
    m.material.__own = true;
    m.position.copy(STAGE);
    m.renderOrder = -1;
    return keep(m);
  }

  /* the green room: pale light, and the branches growing through it —
     near ones as flat silhouettes, far ones washed out by the haze */
  function buildGreenRoom() {
    backdrop('#f2faf3', '#7fae94');
    function branch(dist, size, dark, y) {
      var a = Math.random() * TAU;
      var m = new THREE.Mesh(new THREE.PlaneGeometry(size, size),
        new THREE.MeshBasicMaterial({
          map: TEX_BRANCH, color: dark ? 0x22301f : 0x8fb79c,
          transparent: true, opacity: dark ? .96 : .45,
          depthWrite: false, side: THREE.DoubleSide, toneMapped: false
        }));
      m.geometry.__own = true;
      m.position.set(STAGE.x + Math.cos(a) * dist, STAGE.y + y, STAGE.z + Math.sin(a) * dist);
      m.lookAt(STAGE.x, STAGE.y + 6, STAGE.z);
      m.rotation.z = Math.random() * TAU;
      keep(m);
    }
    var i;
    for (i = 0; i < 7; i++) branch(11 + Math.random() * 8, 26 + Math.random() * 22, true, 4 + Math.random() * 12);
    for (i = 0; i < 9; i++) branch(26 + Math.random() * 26, 34 + Math.random() * 30, false, 6 + Math.random() * 20);
    /* a floor of the same pale light, fading out at the edge */
    var fl = new THREE.Mesh(new THREE.CircleGeometry(70, 32),
      new THREE.MeshBasicMaterial({ color: 0xe7f4ea, toneMapped: false }));
    fl.geometry.__own = true;
    fl.rotation.x = -Math.PI / 2;
    fl.position.copy(STAGE);
    keep(fl);
  }

  /* one pane of colour coming out of the wall, toward the camera */
  var PANE_COLORS = [0xff7fb4, 0x7fb4ff, 0x7fffc0, 0xffd67f];
  function square() {
    var m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
      map: TEX_PANE, color: PANE_COLORS[Math.random() * PANE_COLORS.length | 0],
      transparent: true, opacity: .5, blending: THREE.AdditiveBlending,
      depthWrite: false, side: THREE.DoubleSide, toneMapped: false
    }));
    m.geometry.__own = true;
    var x = (Math.random() - .5) * 66, y = 3 + Math.random() * 34;
    m.position.set(STAGE.x + x, STAGE.y + y, STAGE.z - 25);
    m.rotation.z = (Math.random() - .5) * .5;
    var s0 = 3 + Math.random() * 9;
    m.scale.set(s0, s0, 1);
    scene.add(m);
    var life = .55 + Math.random() * .5, spd = 26 + Math.random() * 30, t = 0;
    var mine = CINE.beat;
    addFx({ t: life, update: function (dt) {
      this.t -= dt;
      t += dt;
      if (!CINE.on || CINE.beat !== mine) {
        scene.remove(m); m.geometry.dispose(); m.material.dispose(); return false;
      }
      m.position.z += spd * dt;
      var gk = 1 + t * 2.2;
      m.scale.set(s0 * gk, s0 * gk, 1);
      m.material.opacity = .5 * Math.max(0, this.t / life);
      if (this.t <= 0) { scene.remove(m); m.geometry.dispose(); m.material.dispose(); return false; }
      return true;
    } });
  }

  function buildWall() {
    backdrop('#3a1a22', '#160a0e');
    var w = new THREE.Mesh(new THREE.PlaneGeometry(120, 74),
      new THREE.MeshBasicMaterial({ map: TEX_WALL, toneMapped: false }));
    w.geometry.__own = true;
    w.position.set(STAGE.x, STAGE.y + 20, STAGE.z - 26);
    keep(w);
    CINE.wall = w;
  }

  /* the slab: a long strip of ground hanging at an angle, dust behind it */
  function buildSlab() {
    backdrop('#dcd8cd', '#a79f90', function (g, W, H) {
      /* three ridges of hill, each hazier than the one in front */
      [[.44, '#9aa08f', .5], [.50, '#8b917f', .65], [.56, '#7c8272', .8]].forEach(function (row) {
        var base = H * row[0];
        g.fillStyle = row[1];
        g.globalAlpha = row[2];
        g.beginPath();
        g.moveTo(0, H);
        g.lineTo(0, base);
        for (var x = 0; x <= W; x += 24) {
          g.lineTo(x, base - Math.sin(x * .011 + row[0] * 9) * 14 - Math.sin(x * .003) * 10);
        }
        g.lineTo(W, H);
        g.closePath(); g.fill();
      });
      g.globalAlpha = 1;
      /* dust hanging over everything */
      var haze = g.createLinearGradient(0, H * .38, 0, H * .62);
      haze.addColorStop(0, 'rgba(226,220,206,0)');
      haze.addColorStop(1, 'rgba(226,220,206,.6)');
      g.fillStyle = haze;
      g.fillRect(0, H * .38, W, H * .3);
    });
    function plate(len, z) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(13, 2.2, len),
        new THREE.MeshStandardMaterial({ color: 0x8a6f4f, roughness: 1 }));
      m.geometry.__own = true;
      m.position.set(STAGE.x, STAGE.y, STAGE.z + z);
      m.rotation.set(0, 0, .05);
      return keep(m);
    }
    /* in three pieces: the middle one is what he puts them through */
    var g = plate(64, 43);
    CINE.slabBridge = plate(7, 7.5);
    plate(79, -35.5);
    CINE.slab = g;
    return g;
  }

  function buildGround() {
    backdrop('#b9b3a6', '#6d6558');
    var fl = new THREE.Mesh(new THREE.CircleGeometry(90, 40),
      new THREE.MeshStandardMaterial({ color: 0x8a7658, roughness: 1 }));
    fl.geometry.__own = true;
    fl.rotation.x = -Math.PI / 2;
    fl.position.copy(STAGE);
    keep(fl);
    return fl;
  }

  function buildSky() {
    backdrop('#dfe8f4', '#8ea6c4');
  }

  /* rubble thrown up behind the slab, the way the picture has it */
  function rockFan(origin, dir, n, spread) {
    for (var i = 0; i < n; i++) {
      var s = .8 + Math.random() * 2.6;
      var m = new THREE.Mesh(new THREE.BoxGeometry(s, s * (.6 + Math.random()), s * (.7 + Math.random() * .7)),
        new THREE.MeshStandardMaterial({ color: 0x3a3128, roughness: 1 }));
      m.geometry.__own = true;
      m.position.copy(origin).add(new THREE.Vector3(
        (Math.random() - .5) * spread, Math.random() * spread * .4, (Math.random() - .5) * spread));
      m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      keep(m);
      (function (m) {
        var v = dir.clone().multiplyScalar(6 + Math.random() * 16)
          .add(new THREE.Vector3((Math.random() - .5) * 9, 6 + Math.random() * 16, (Math.random() - .5) * 9));
        var av = new THREE.Vector3(Math.random() * 4, Math.random() * 4, Math.random() * 4);
        addFx({ t: 12, update: function (dt) {
          this.t -= dt;
          if (!CINE.on) return false;
          v.y -= 11 * dt;
          m.position.addScaledVector(v, dt);
          m.rotation.x += av.x * dt; m.rotation.y += av.y * dt;
          /* out of the shot rather than hanging there when it runs out */
          if (m.position.y < STAGE.y - 60) { m.visible = false; return false; }
          if (this.t <= 0) { m.visible = false; return false; }
          return true;
        } });
      })(m);
    }
  }

  /* =====================================================================
     POSES USED BY THE CUT
     ================================================================== */
  /* every pose in the cut starts from nothing, including the whole body
     lean that a couple of the beats set */
  function rp(r) {
    resetPose(r);
    if (r.body) r.body.rotation.set(0, 0, 0);
  }

  function poseGuard(r) {
    rp(r);
    r.shoulderL.rotation.x = -.9; r.elbowL.rotation.x = -1.5; r.shoulderL.rotation.z = .35;
    r.shoulderR.rotation.x = -.9; r.elbowR.rotation.x = -1.5; r.shoulderR.rotation.z = -.35;
    r.spine.rotation.x = .12;
  }
  /* the wind up and the throw, split so it can be taken as slowly as we like */
  function posePunch(r, k, arm) {
    rp(r);
    var back = Math.min(1, k / .72), out = k > .72 ? (k - .72) / .28 : 0;
    var sh = arm < 0 ? r.shoulderL : r.shoulderR;
    var el = arm < 0 ? r.elbowL : r.elbowR;
    var osh = arm < 0 ? r.shoulderR : r.shoulderL;
    var oel = arm < 0 ? r.elbowR : r.elbowL;
    sh.rotation.x = -.4 + .9 * back - 2.3 * out;
    sh.rotation.z = arm * (-.5 * back + .45 * out);
    el.rotation.x = -1.75 * back + 1.68 * out;
    osh.rotation.x = -.5 - .5 * back + .3 * out;
    oel.rotation.x = -1.2 - .4 * back;
    r.spine.rotation.y = arm * (.6 * back - 1.05 * out);
    r.spine.rotation.x = .1 + .12 * back - .26 * out;
    r.hipL.rotation.x = -.2 * back; r.kneeL.rotation.x = .45 * back - .25 * out;
    r.hipR.rotation.x = .16 * back; r.kneeR.rotation.x = .3 * back;
    r.hips.position.y = r.hipsBaseY - .35 * back + .2 * out;
    r.neck.rotation.y = arm * -.2;
  }
  function poseGut(r, k) {
    rp(r);
    var s = Math.min(1, k * 6);
    r.spine.rotation.x = .95 * s;
    r.neck.rotation.x = .5 * s;
    r.shoulderL.rotation.x = -1.25 * s; r.shoulderR.rotation.x = -1.25 * s;
    r.shoulderL.rotation.z = .34 * s; r.shoulderR.rotation.z = -.34 * s;
    r.elbowL.rotation.x = -1.55 * s; r.elbowR.rotation.x = -1.55 * s;
    r.hipL.rotation.x = -.35 * s; r.hipR.rotation.x = -.35 * s;
    r.kneeL.rotation.x = .8 * s; r.kneeR.rotation.x = .8 * s;
    r.hips.position.y = r.hipsBaseY - .5 * s;
  }
  function poseLimp(r, k) {
    rp(r);
    r.spine.rotation.x = .55;
    r.neck.rotation.x = .45;
    r.shoulderL.rotation.x = .7; r.shoulderR.rotation.x = .75;
    r.shoulderL.rotation.z = -.35; r.shoulderR.rotation.z = .35;
    r.elbowL.rotation.x = -.35; r.elbowR.rotation.x = -.4;
    r.hipL.rotation.x = .25; r.hipR.rotation.x = .1;
    r.kneeL.rotation.x = .55; r.kneeR.rotation.x = .35;
    r.hips.position.y = r.hipsBaseY - .3;
    if (k != null) { r.spine.rotation.z = Math.sin(k * 6) * .08; }
  }
  /* brought down from overhead onto something on the floor */
  function poseSmash(r, k) {
    rp(r);
    var up = Math.min(1, k / .55), down = k > .55 ? (k - .55) / .45 : 0;
    r.shoulderR.rotation.x = -.4 - 2.5 * up + 3.1 * down;
    r.shoulderR.rotation.z = -.25 * up + .2 * down;
    r.elbowR.rotation.x = -.5 * up + .45 * down;
    r.shoulderL.rotation.x = -.5 - .4 * up + .2 * down;
    r.elbowL.rotation.x = -1.3;
    r.spine.rotation.x = -.22 * up + 1.05 * down;      // folds over the strike
    r.spine.rotation.y = -.3 * up + .2 * down;
    r.neck.rotation.x = -.25 * up + .75 * down;
    r.hipL.rotation.x = -.2 * up - .5 * down;
    r.kneeL.rotation.x = .3 * up + .9 * down;
    r.hipR.rotation.x = .15 * up - .3 * down;
    r.kneeR.rotation.x = .25 * up + .7 * down;
    r.hips.position.y = r.hipsBaseY + .18 * up - .85 * down;
  }

  /* flat on their back, arms and knees fallen open */
  function poseDown(r) {
    rp(r);
    r.spine.rotation.x = -.18;
    r.neck.rotation.x = -.3;
    r.shoulderL.rotation.x = -.35; r.shoulderR.rotation.x = -.2;
    r.shoulderL.rotation.z = -.85; r.shoulderR.rotation.z = .7;
    r.elbowL.rotation.x = -.45; r.elbowR.rotation.x = -.3;
    r.hipL.rotation.x = .1; r.hipR.rotation.x = -.05;
    r.hipL.rotation.z = .3; r.hipR.rotation.z = -.22;
    r.kneeL.rotation.x = .5; r.kneeR.rotation.x = .3;
  }

  /* boot planted on a stomach */
  function poseStamp(r, k) {
    rp(r);
    var s = Math.min(1, k * 4);
    r.spine.rotation.x = .3 * s;
    r.neck.rotation.x = .3 * s;
    r.hipR.rotation.x = -1.5 * s;                  // the leg that is down
    r.kneeR.rotation.x = .35 * s;
    r.ankleR.rotation.x = .5 * s;
    r.hipL.rotation.x = .5 * s;
    r.kneeL.rotation.x = .45 * s;
    r.shoulderL.rotation.x = -.6 * s; r.shoulderL.rotation.z = .55 * s;
    r.shoulderR.rotation.x = -1.1 * s; r.shoulderR.rotation.z = -.5 * s;
    r.elbowR.rotation.x = -1.1 * s;
    r.hips.position.y = r.hipsBaseY - .1;
  }
  function poseUppercut(r, k) {
    rp(r);
    var wind = Math.min(1, k / .55), out = k > .55 ? (k - .55) / .45 : 0;
    r.spine.rotation.x = .45 * wind - .75 * out;
    r.spine.rotation.y = .5 * wind - .8 * out;
    r.shoulderR.rotation.x = .55 * wind - 2.9 * out;
    r.shoulderR.rotation.z = -.3 * wind + .35 * out;
    r.elbowR.rotation.x = -.5 * wind + .3 * out;
    r.shoulderL.rotation.x = -.6 - .5 * wind;
    r.elbowL.rotation.x = -1.4;
    r.hipL.rotation.x = -.3 * wind; r.kneeL.rotation.x = .7 * wind - .5 * out;
    r.kneeR.rotation.x = .5 * wind - .4 * out;
    r.hips.position.y = r.hipsBaseY - .6 * wind + .8 * out;
  }
  function poseFly(r, k) {
    rp(r);
    r.body.rotation.x = -.35 - k * .7;
    r.spine.rotation.x = -.5;
    r.neck.rotation.x = -.4;
    r.shoulderL.rotation.x = -2.2; r.shoulderR.rotation.x = -2.15;
    r.shoulderL.rotation.z = -.5; r.shoulderR.rotation.z = .5;
    r.elbowL.rotation.x = -.3; r.elbowR.rotation.x = -.25;
    r.hipL.rotation.x = -.5; r.hipR.rotation.x = -.3;
    r.kneeL.rotation.x = .7; r.kneeR.rotation.x = .5;
  }

  /* the victim, flattened into a frame of film */
  function frameOn(h, on) {
    h.rig.root.scale.z = on ? .12 : 1;
    if (on && !h.pane) {
      h.pane = makeGlassPane();
      h.pane.position.copy(h.rig.root.position).add(new THREE.Vector3(0, 3, 0));
      h.pane.rotation.y = h.rig.root.rotation.y;
      keep(h.pane);
    } else if (!on && h.pane) {
      glassShards(h.pane.position.clone(), 16);
      scene.remove(h.pane);
      var i = CINE.stage.indexOf(h.pane);
      if (i >= 0) CINE.stage.splice(i, 1);
      h.pane = null;
    }
  }

  /* =====================================================================
     BEATS
     ================================================================== */
  function once(name, fn) {
    if (CINE.flags[name]) return false;
    CINE.flags[name] = 1;
    if (fn) fn();
    return true;
  }

  var BEATS = [

  /* ---- 1 · the green room, and one punch taken slowly ---------------- */
  { dur: 5.4, enter: function () {
      clearStage();
      buildGreenRoom();
      var A = CINE.A, V = CINE.V;
      put(A, 0, 0, 7.4, Math.PI);
      put(V, 0, 0, .6, 0);
      frameOn(V, true);
      FX.tint('#06120b', .45, 5.2);
    },
    step: function (t, k) {
      var A = CINE.A, V = CINE.V;
      /* he takes the whole beat to throw it */
      var swing = Math.min(1, t / 4.1);
      posePunch(A.rig, swing, 1);
      A.rig.root.position.z = STAGE.z + 7.4 - E.out(swing) * 3.8;
      poseLimp(V.rig, t);
      V.rig.root.rotation.y = .06 * Math.sin(t * 2);

      /* the air being pressed out of the room */
      if (Math.random() < .5) {
        FX.mote(sp(0, 3, 3), 0x9fd8ff, 8 + Math.sin(t) * 3, .5);
      }
      if (t > 1.4 && Math.random() < .25) {
        FX.ring(sp(0, 3, 3.2), 0xbfe6ff, { maxR: 1, from: 9, life: .5, ground: false, opacity: .5 });
      }
      /* Side on and low to start, so the gap between them is the shot.
         Then over his shoulder, then close enough to count the knuckles. */
      shot(t, [
        { t: 0, p: [13.5, 2.0, 11.5], l: [0, 3.0, 4.2] },
        { t: 1.7, p: [11.5, 2.3, 9.8], l: [0, 3.0, 3.8] },
        { t: 2.5, p: [9.0, 3.5, 8.2], l: [0, 3.1, 2.8] },
        { t: 3.6, p: [7.0, 3.3, 6.6], l: [0, 3.0, 2.1] },
        { t: 4.1, p: [5.8, 3.1, 5.6], l: [0, 3.0, 1.9] },
        { t: 5.4, p: [5.4, 3.0, 5.2], l: [0, 2.95, 1.8] }
      ]);
      if (t > 3.4) shakeCam(.05 + (t - 3.4) * .2);

      if (t > 3.7) once('pressure', function () {
        FX.rings(sp(0, 3, 2.4), 0x9fd8ff, 3, { maxR: 7, life: .5, ground: false, gap: 60 });
        try { sfx.whoosh(); } catch (e) {}
      });
      if (t >= 4.1) once('land', function () {
        FX.flash('#ffffff', .5, .22);
        FX.cross(sp(0, 3, 1.6), 0xffffff, 6, .3);
        FX.impact(sp(0, 3, 1.6), 0x9fd8ff, 2);
        addShake(.9);
        hitstop(.12);
        try { sfx.hit(); } catch (e) {}
      });
    } },

  /* ---- 2 · the frame goes, three rings leave the belly --------------- */
  { dur: 2.0, enter: function () {
      frameOn(CINE.V, false);
      FX.flash('#eafff2', .55, .3);
      FX.debris(sp(0, 2, 1), 8, 12, 0x2f4a35);
      try { sfx.shatter(); } catch (e) {}
    },
    step: function (t) {
      var A = CINE.A, V = CINE.V;
      posePunch(A.rig, 1, 1);
      A.rig.root.position.set(STAGE.x, STAGE.y, STAGE.z + 3.6);
      poseGut(V.rig, t);
      V.rig.root.position.set(STAGE.x, STAGE.y, STAGE.z + .6 - E.out(Math.min(1, t / .8)) * 2.2);
      cam(7.5 - t * .6, 3.3, 9.5 - t * .8, 0, 2.8, 1.9);
      shakeCam(Math.max(0, .35 - t * .5));
      /* three rings, one after another, out of the stomach */
      [0, .22, .46].forEach(function (d, i) {
        if (t >= d) once('ring' + i, function () {
          FX.ring(sp(0, 2.6, 2.2), i === 1 ? 0xffffff : 0x9fd8ff,
            { maxR: 6 + i * 2.5, life: .5, ground: false, axis: new THREE.Vector3(0, 0, 1) });
          FX.ring(sp(0, 2.6, 2.2), 0xdfefff, { maxR: 5 + i * 2, life: .45, ground: false });
        });
      });
    } },

  /* ---- 3 · one second of a still panel, cut hard both ways ----------- */
  { dur: 1.0, enter: function () { panel(true); },
    step: function () {},
    exit: function () { panel(false); } },

  /* ---- 4 · the wall, the colour coming out of it, and through -------- */
  { dur: 3.4, enter: function () {
      clearStage();
      buildWall();
      var A = CINE.A, V = CINE.V;
      put(A, 0, 0, 30, Math.PI);
      put(V, 0, -40, 30, 0);                        // kept out of shot
      FX.tint('#1a0a0e', .3, 3.2);
    },
    step: function (t) {
      poseGuard(CINE.A.rig);
      CINE.A.rig.root.position.y = STAGE.y + Math.sin(t * 3) * .1;
      cam(0, 20, 14 - t * 1.1, 0, 20, -26);
      /* translucent panes blooming out of the wall, faster and faster */
      var rate = 3 + t * t * 9;
      CINE.sq = (CINE.sq || 0) + t * 0;
      for (var i = 0; i < 3; i++) {
        if (Math.random() > rate * .016) continue;
        square();
      }
      if (t > 2.55) once('burst', function () {
        FX.flash('#ffe9ef', .85, .4);
        FX.cross(sp(0, 20, -24), 0xffffff, 16, .4);
        FX.impact(sp(0, 20, -24), 0xff7f9a, 4.5);
        FX.rings(sp(0, 20, -24), 0xff90a8, 4, { maxR: 44, life: .6, ground: false, gap: 40 });
        FX.debris(sp(0, 14, -22), 22, 26, 0x54262f);
        rockFan(sp(0, 16, -24), new THREE.Vector3(0, .3, 1), 16, 26);
        addShake(1.5);
        hitstop(.14);
        if (CINE.wall) CINE.wall.visible = false;
        try { sfx.redBoom(); } catch (e) {}
      });
      if (t > 2.55) shakeCam(.5);
    } },

  /* ---- 5 · the slab, the boot, the mountain coming apart ------------- */
  { dur: 4.0, enter: function () {
      clearStage();
      buildSlab();
      var A = CINE.A, V = CINE.V;
      put(V, 0, 1.6, 6, Math.PI * .5);
      put(A, 0, 2.4, 3.4, Math.PI);
      /* the mountain the slab came out of, still coming apart behind it */
      rockFan(sp(9, 5, -30), new THREE.Vector3(.55, .75, -.25), 30, 26);
      rockFan(sp(14, 3, -44), new THREE.Vector3(.5, .7, -.2), 18, 30);
      FX.dust(sp(0, 2, -14), 14, 0xbdb3a1, 16, 8);
      FX.tint('#000000', 0);
    },
    step: function (t) {
      var A = CINE.A, V = CINE.V;
      /* on their back along the slab. Tipping the root lays the whole body
         down on the surface; tipping the torso only buries it in one. */
      poseDown(V.rig);
      V.rig.root.rotation.set(-Math.PI / 2, 0, 0);
      V.rig.root.position.set(STAGE.x, STAGE.y + 1.5, STAGE.z + 7.4);

      /* boot planted on the stomach, standing over them */
      poseStamp(A.rig, t);
      A.rig.root.position.set(STAGE.x - .2, STAGE.y + 1.9, STAGE.z + 5.6);
      A.rig.root.rotation.set(0, Math.PI * .96, 0);

      if (CINE.slab) CINE.slab.rotation.x = -t * .004;      // drifting as it falls
      /* along the slab, so it runs off into the haze behind them */
      shot(t, [
        { t: 0, p: [-13.5, 5.6, 19], l: [0, 2.2, 5] },
        { t: 2.2, p: [-11.5, 4.4, 15.5], l: [0, 2.1, 5.5] },
        { t: 4, p: [-10, 3.8, 13], l: [0, 2.0, 5.5] }
      ]);
      shakeCam(.06);
      if (Math.random() < .3) FX.dust(sp((Math.random() - .5) * 20, 2, -8 - Math.random() * 20), 2, 0xbdb3a1, 8, 5);
      if (t > .2) once('stampHit', function () {
        FX.impact(sp(0, 3.2, 5.4), 0xffd9a8, 1.6);
        FX.ring(sp(0, 2.6, 5.4), 0xd8c39c, { maxR: 7, life: .5, ground: false });
        FX.debris(sp(0, 1.4, 5.4), 8, 12, 0x6b5642);
        addShake(.7);
      });
    } },

  /* ---- 6 · off, run, and put them through it ------------------------- */
  { dur: 3.4, enter: function () {},
    step: function (t) {
      var A = CINE.A, V = CINE.V;
      /* The victim stays where the boot left them and the whole beat is
         one movement of his: off, in, down. Anything that teleports
         between poses here reads as missing frames. */
      var vy = STAGE.y + 1.5, fall = 0;
      if (t > 2.15) {
        fall = (t - 2.15) / 1.25;
        vy = STAGE.y + 1.5 - fall * fall * 30;
        poseFly(V.rig, fall);
        V.rig.root.rotation.set(-Math.PI / 2 + fall * .6, 0, fall * 1.2);
      } else {
        poseDown(V.rig);
        V.rig.root.rotation.set(-Math.PI / 2, 0, 0);
      }
      V.rig.root.position.set(STAGE.x, vy, STAGE.z + 7.4);

      if (t < .75) {                                  // steps off them
        var s = E.out(t / .75);
        rp(A.rig);
        A.rig.spine.rotation.x = .2 - .1 * s;
        A.rig.hipR.rotation.x = -1.5 + 1.5 * s;
        A.rig.kneeR.rotation.x = .35 + .2 * s;
        A.rig.hipL.rotation.x = .5 - .5 * s;
        A.rig.shoulderL.rotation.x = -.6 + .3 * s;
        A.rig.shoulderR.rotation.x = -1.1 + .7 * s;
        A.rig.root.position.set(STAGE.x - .2, STAGE.y + 1.9 - s * .8, STAGE.z + 5.6 + s * 3.2);
        A.rig.root.rotation.set(0, Math.PI * .96, 0);
      } else if (t < 1.75) {                          // runs back at them
        var rk = E.out((t - .75) / 1);
        poseRun(A.rig, (t - .75) * 30, t - .75);
        A.rig.root.position.set(STAGE.x - 1.4 * rk, STAGE.y + 1.1, STAGE.z + 8.8 - rk * 2.9);
        A.rig.root.rotation.set(0, Math.PI - rk * Math.PI * .5, 0);
      } else {                                        // and drives them down
        var pk = Math.min(1, (t - 1.75) / .45);
        poseSmash(A.rig, pk);
        A.rig.root.position.set(STAGE.x - 1.4, STAGE.y + 1.1, STAGE.z + 5.9 - E.out(pk) * .3);
        A.rig.root.rotation.set(0, Math.PI * .5, 0);   // side on to them
      }

      /* side on, level with the slab, so the drop through it reads */
      shot(t, [
        { t: 0, p: [-17, 5.5, 10], l: [0, 2.6, 6] },
        { t: 2.1, p: [-15, 4.2, 7.5], l: [0, 2.2, 6] },
        { t: 3.4, p: [-15, 1.5, 7], l: [0, -4, 6] }
      ]);
      if (t > 2.15) {
        once('crack', function () {
          FX.flash('#fff3e0', .5, .3);
          FX.cross(sp(0, 2.2, 6), 0xffffff, 7, .3);
          FX.impact(sp(0, 2.2, 6), 0xffd9a8, 2.4);
          FX.debris(sp(0, 1, 7.4), 22, 20, 0x8a6f4f);
          FX.debris(sp(0, 0, 7.4), 14, 14, 0x6b5642);
          rockFan(sp(0, 0, 7.4), new THREE.Vector3(0, -.5, .1), 18, 9);
          if (CINE.slabBridge) CINE.slabBridge.visible = false;   // the hole
          addShake(1.2);
          hitstop(.1);
          try { sfx.hit(); } catch (e) {}
        });
        shakeCam(.4);
      }
    } },

  /* ---- 7 · down after them ------------------------------------------ */
  { dur: 3.0, enter: function () {
      clearStage();
      buildGround();
      var A = CINE.A, V = CINE.V;
      put(V, 0, 46, 0, 0);
      put(A, 0, 58, 0, Math.PI);
    },
    step: function (t) {
      var A = CINE.A, V = CINE.V;
      var f = Math.min(1, t / 2.1);
      var vy = 46 - f * f * 46;
      var ay = 58 - Math.min(1, t / 1.9) * Math.min(1, t / 1.9) * 52;
      if (f < 1) {
        poseFly(V.rig, 1);
        V.rig.root.rotation.set(0, 0, 0);
        V.rig.root.position.set(STAGE.x, STAGE.y + vy, STAGE.z);
      } else {
        poseDown(V.rig);                              // flat out on the floor
        V.rig.root.rotation.set(-Math.PI / 2, 0, 0);
        V.rig.root.position.set(STAGE.x, STAGE.y + .45, STAGE.z + 2.2);
      }
      poseStamp(A.rig, 1);
      A.rig.root.position.set(STAGE.x, STAGE.y + Math.max(1.5, ay), STAGE.z + 1.6);
      A.rig.root.rotation.set(0, Math.PI, 0);
      /* the camera falls with them */
      var camY = 30 - f * 24;
      cam(11, Math.max(4, camY + 5), 11, 0, Math.max(2, vy), 0);
      if (Math.random() < .6) {
        FX.streaks(sp((Math.random() - .5) * 6, Math.max(2, vy) + Math.random() * 10, (Math.random() - .5) * 6),
          0xdfefff, 1, 8, 1.2);
      }
      if (t >= 2.1) once('slam', function () {
        FX.flash('#ffffff', .8, .5);
        FX.cross(sp(0, 2, 0), 0xffffff, 12, .35);
        FX.impact(sp(0, 2, 0), 0xffd9a8, 4);
        FX.rings(sp(0, .2, 0), 0xd8c39c, 4, { maxR: 40, life: .8, gap: 55 });
        FX.cracks(sp(0, .05, 0), 16, 34, 0x2a2018);
        FX.debris(sp(0, .5, 0), 26, 24, 0x6b5642);
        FX.dust(sp(0, 0, 0), 16, 0xc9bda6, 22, 8);
        rockFan(sp(0, 0, 0), new THREE.Vector3(0, 1, 0), 20, 10);
        addShake(2);
        hitstop(.16);
        FX.zoom(16, .6);
        try { sfx.redBoom(); } catch (e) {}
      });
      if (t > 2.1) shakeCam(.8 * (1 - (t - 2.1) / .9));
    } },

  /* ---- 8 · a circle of speed with nobody in it ----------------------- */
  { dur: 2.9, enter: function () {
      var A = CINE.A, V = CINE.V;
      put(V, 0, 0, 0, 0);
      put(A, 0, 0, 9, Math.PI);
      A.rig.root.visible = false;                   // too fast to be drawn
    },
    step: function (t) {
      var A = CINE.A, V = CINE.V;
      /* they push themselves off the floor and stand, from exactly where
         the last beat left them lying */
      var up = E.pop(Math.min(1, t / 2.0));
      if (up < 1) {
        poseDown(V.rig);
        V.rig.spine.rotation.x = -.18 + .7 * up;
        V.rig.neck.rotation.x = -.3 + .6 * up;
        V.rig.shoulderL.rotation.z = -.85 + .5 * up;
        V.rig.shoulderR.rotation.z = .7 - .35 * up;
        V.rig.kneeL.rotation.x = .5 + .5 * up;
        V.rig.root.rotation.set(-Math.PI / 2 * (1 - up), t * .35 * up, 0);
        V.rig.root.position.set(STAGE.x, STAGE.y + .45 * (1 - up), STAGE.z + 2.2 * (1 - up));
      } else {
        poseLimp(V.rig, t);
        V.rig.spine.rotation.x = .2;
        V.rig.neck.rotation.x = .15;
        V.rig.root.position.set(STAGE.x, STAGE.y, STAGE.z);
        V.rig.root.rotation.set(0, t * .35, 0);
      }

      /* only the trail — three arcs whipping around them */
      var spin = t * 9;
      for (var i = 0; i < 3; i++) {
        var a = spin + i * 2.1;
        var rr = 6.5 - i * .5;
        var p = sp(Math.cos(a) * rr, 1.2 + i * 1.4 + Math.sin(t * 6 + i) * .5, Math.sin(a) * rr);
        var tangent = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a));
        FX.slash(p, tangent, 0x9fd8ff, 3.4, .16);
        if (Math.random() < .6) FX.streaks(p, 0xdfefff, 1, 7, 1);
      }
      if (Math.random() < .5) {
        FX.ring(sp(0, .1, 0), 0x9fd8ff, { maxR: 9, life: .35, opacity: .7 });
      }
      cam(0, 6.5, 15, 0, 2.6, 0);
      shakeCam(.05);
    },
    exit: function () { CINE.A.rig.root.visible = true; } },

  /* ---- 9 · the uppercut, and the frame in the sky -------------------- */
  { dur: 2.4, enter: function () {
      var A = CINE.A, V = CINE.V;
      put(A, 0, 0, -3.9, 0);                        // behind them
      A.rig.root.visible = true;
      FX.trail(A.rig, 0x9fd8ff, 4, 35, .45);
      FX.speedRing(sp(0, 2.6, -3.9), 0x9fd8ff, 7, .3);
      FX.streaks(sp(0, 2.4, -3.9), 0xdfefff, 8, 14, 1.2);
    },
    step: function (t) {
      var A = CINE.A, V = CINE.V;
      /* they look back, and it is already too late */
      var look = Math.min(1, t / .55);
      poseLimp(V.rig, t);
      V.rig.neck.rotation.y = -1.1 * look;
      V.rig.spine.rotation.y = -.45 * look;
      poseUppercut(A.rig, Math.min(1, t / 1.1));

      if (t < 1.1) {
        V.rig.root.position.set(STAGE.x, STAGE.y, STAGE.z);
        shot(t, [
          { t: 0, p: [-12.5, 1.4, 10.5], l: [0, 3.2, 0] },
          { t: 1.1, p: [-10, 1.1, 8.6], l: [0, 3.4, 0] }
        ]);
      } else {
        var f = (t - 1.1) / 1.3;
        var y = E.out(Math.min(1, f)) * 34;
        poseFly(V.rig, f);
        V.rig.root.position.set(STAGE.x, STAGE.y + y, STAGE.z);
        V.rig.root.rotation.y = f * 2.2;
        cam(-10.5, 2.5 + y * .5, 13 + y * .18, 0, 2.4 + y * .82, 0);
      }
      if (t >= 1.1) once('lift', function () {
        FX.flash('#eaf6ff', .6, .3);
        FX.cross(sp(0, 3, 0), 0xffffff, 8, .32);
        FX.impact(sp(0, 3, 0), 0x9fd8ff, 2.6);
        FX.rings(sp(0, .2, 0), 0xbfe6ff, 3, { maxR: 22, life: .6, gap: 45 });
        FX.debris(sp(0, .3, 0), 14, 18, 0x6b5642);
        FX.speedRing(sp(0, 3, 0), 0xdfefff, 10, .4);
        addShake(1.3);
        hitstop(.12);
        try { sfx.hit(); } catch (e) {}
      });
      if (t > 2.15) once('skyFrame', function () {
        frameOn(CINE.V, true);
        try { sfx.frame(); } catch (e) {}
      });
    } },

  /* ---- 10 · twenty four passes, and one fist through the middle ------ */
  { dur: 3.2, enter: function () {
      buildSky();
      var A = CINE.A, V = CINE.V;
      V.rig.root.position.set(STAGE.x, STAGE.y + 34, STAGE.z);
      V.rig.root.rotation.set(0, .35, 0);
      put(A, -9, 34, 6, Math.PI * .8);
    },
    step: function (t) {
      var A = CINE.A, V = CINE.V;
      var vp = sp(0, 34, 0);
      /* twenty four of him crossing the frame, one per frame of film */
      if (t < 1.6) {
        CINE.pass = (CINE.pass || 0) + t * 0;
        if (!CINE.passAcc) CINE.passAcc = 0;
        CINE.passAcc += 1;
        if (CINE.passAcc % 1 === 0 && (CINE.passN || 0) < 24 && Math.random() < .75) {
          CINE.passN = (CINE.passN || 0) + 1;
          var a = Math.random() * TAU, rr = 7 + Math.random() * 5;
          A.rig.root.position.set(vp.x + Math.cos(a) * rr, vp.y + (Math.random() - .3) * 7, vp.z + Math.sin(a) * rr);
          A.rig.root.rotation.set(0, a + Math.PI, 0);
          poseRun(A.rig, Math.random() * 6, 1);
          ghostAfterimage(A.rig, 0x3f9bff, .32);
          FX.slash(A.rig.root.position.clone().add(new THREE.Vector3(0, 2.4, 0)),
            new THREE.Vector3(Math.cos(a + 1.6), 0, Math.sin(a + 1.6)), 0x9fd8ff, 4, .14);
        }
        A.rig.root.visible = false;
        cam(0, 36.4, 13.5, 0, 34.7, 0);
        if (Math.random() < .5) FX.streaks(vp.clone(), 0x9fd8ff, 2, 12, 1.3);
      } else {
        /* the last one does not stop */
        A.rig.root.visible = true;
        var pk = Math.min(1, (t - 1.6) / .5);
        posePunch(A.rig, pk, 1);
        A.rig.root.position.set(vp.x, vp.y + .4, vp.z + 7.4 - E.out(pk) * 2.6);
        A.rig.root.rotation.set(0, Math.PI, 0);
        /* off to one side of the victim, so the gap between them reads */
        cam(7.5, 36.2, -9.5, 0, 34.8, 2.2);
        if (t > 2.1) shakeCam(.35);
      }
      if (t >= 2.1) once('through', function () {
        frameOn(CINE.V, false);
        FX.flash('#ffffff', .9, .35);
        FX.cross(vp.clone(), 0xffffff, 14, .4);
        FX.impact(vp.clone(), 0xbfe6ff, 4.2);
        FX.rings(vp.clone(), 0xdfefff, 4, { maxR: 26, life: .6, ground: false, gap: 40 });
        FX.speedRing(vp.clone(), 0xffffff, 15, .5);
        addShake(1.8);
        hitstop(.18);
        FX.zoom(18, .6);
        try { sfx.shatter(); } catch (e) {}
      });
      if (t >= 2.1) poseGut(CINE.V.rig, t - 2.1);
    } },

  /* ---- 11 · white, and back to the arena ----------------------------- */
  { dur: 2.4, enter: function () { CINE.whiteT = 0; },
    step: function (t) {
      white(Math.min(1, t / 1.5));
      if (t > 1.5) hudOff(true);
      cam(7.5, 36.2, -9.5, 0, 34.8, 2.2);
    },
    exit: function () {
      white(0);
    } }
  ];

  function stepCine(dt) {
    CINE.t += dt;
    CINE.bt += dt;
    if (CINE.beat < 0 || CINE.bt >= BEATS[CINE.beat].dur) {
      if (CINE.beat >= 0 && BEATS[CINE.beat].exit) BEATS[CINE.beat].exit();
      CINE.beat++;
      CINE.bt = 0;
      CINE.flags = {};
      if (CINE.beat >= BEATS.length) { endCine(); return; }
      if (BEATS[CINE.beat].enter) BEATS[CINE.beat].enter();
    }
    var b = BEATS[CINE.beat];
    b.step(CINE.bt, CINE.bt / b.dur);
    /* both bodies are ours for the duration */
    if (CINE.A.self) { player.iframes = 9e9; player.vel.set(0, 0, 0); }
    if (CINE.V.self) { player.iframes = 9e9; player.vel.set(0, 0, 0); }
  }

  /* =====================================================================
     HOOKS
     ================================================================== */
  var _updatePlayer = updatePlayer;
  updatePlayer = function (dt) {
    if (CINE.on) return;                            // the cut owns both of us
    if (RUSH.on) { stepRush(dt); return; }
    _updatePlayer(dt);
  };

  var _updateCamera = updateCamera;
  updateCamera = function (dt) {
    if (CINE.on) { stepCine(dt); return; }
    if (RUSH.on) { shakeMag = Math.max(0, shakeMag - dt * 2.2); return; }
    return _updateCamera(dt);
  };

  /* a body being posed by the cut is not being simulated by anything else */
  var _enemyUpdate = Enemy.prototype.update;
  Enemy.prototype.update = function (dt) {
    if (this.cineHold) return;
    return _enemyUpdate.call(this, dt);
  };

  /* the rush cannot be interrupted, and neither can the cut */
  var _hurtPlayer = hurtPlayer;
  hurtPlayer = function (amount, knock) {
    if (CINE.on || RUSH.on) return;
    return _hurtPlayer(amount, knock);
  };

  /* =====================================================================
     NO TECHNIQUES WHILE YOU ARE BEING HIT
     Wrapped here because this file is the last one to touch the casts,
     so the awakened versions are covered too.
     ================================================================== */
  function stunned() {
    if (CINE.on || RUSH.on) return true;
    if (player.react) return true;                  // mid flinch
    if (player.action && player.action.type === 'kb') return true;
    if (player.action && player.action.type === 'void') return true;
    return false;
  }
  function guard(fn, name) {
    return function () {
      if (stunned()) {
        if (window.JJNOTICE && Math.random() < .5) window.JJNOTICE('NO TECHNIQUE WHILE HIT', '#ff8b98');
        return;
      }
      return fn.apply(null, arguments);
    };
  }
  castRed = guard(castRed);
  castRapid = guard(castRapid);
  castTwofold = guard(castTwofold);
  castPalm = guard(castPalm);
  castLimitless = guard(castLimitless);
  castN1 = guard(castN1);
  castN2 = guard(castN2);
  castN3 = guard(castN3);
  castNaoyaR = guard(castNaoyaR);

})();
