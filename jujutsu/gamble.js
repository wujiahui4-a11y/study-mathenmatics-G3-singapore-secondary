/* =======================================================================
   IDLE DEATH GAMBLE — 坐殺博戯
   Hakari's domain, built the way the source describes it rather than as a
   room with a slot machine in it.

   THE OPENING, in order:

     1  the hand sign, and DOMAIN EXPANSION across the screen — the banner
        is a flat overlay but everything behind it is the real 3D scene,
        shot from a camera put on his face
     2  the surroundings go white, and stay white
     3  out of the white, two lines of machines
     4  those lines turn from upright to flat, up and over
     5  four more lines join them
     6  and it settles into six machines standing around the floor

   THEN THE GAME, which is the domain's actual mechanic:

     · everyone caught is frozen in a neutral stage, and the rules are
       written down the left of every screen in rainbow
     · the caster is untouchable for the whole of it
     · two VISUAL MOVES progress the stage to a Richii scenario: balls,
       doors, a landed Fever Breaker, a Door Guard that actually caught
       something. Balls and doors together count as both.
     · a Richii is a little scene with Tze in it, and whether Tze makes it
       decides the jackpot. Transit Card is one star, Travel Emergency is
       two.
     · two numbered symbols show at the start of a Richii and a third
       lands between them at the end, matching on a win
     · four rolls, and the fourth is a guaranteed pity jackpot at half the
       usual length if anybody was caught in there
     · an odd jackpot improves the next domain's odds; an even one makes
       the next domain's Richii twice as fast; dying loses both

   AND THE PAYOUT: the domain comes apart, he shouts, he dances, and he
   walks out of it with the aura still on him.
   ===================================================================== */
(function () {
  'use strict';
  if (typeof player === 'undefined' || typeof THREE === 'undefined') return;
  var FX = window.JJFX;
  if (!FX) return;
  var AN = window.JJANIM;
  var E = FX.ease;
  var TAU = Math.PI * 2;

  var G = window.JJGAMBLE = {
    on: false, stage: 0, t: 0,
    moves: 0, rolls: 0, caught: 0,
    richii: null, jackpot: false,
    /* carried between domains, and lost on death */
    luck: 0, fast: false,
    machines: [], props: []
  };

  var R = 34;                  // how far the domain reaches
  var OPEN = {                 // the beats of the opening, in seconds
    sign: 2.4,                 // hand sign under the banner
    white: 3.7,                // the world goes white
    two: 5.1,                  // two lines of machines
    turn: 6.4,                 // and they turn flat
    six: 7.8,                  // four more lines
    ring: 8.8                  // settled into six around the floor
  };
  /* A backstop, not the limit. What actually ends the domain is running
     out of rolls — four of them, and the fourth always pays. Twenty two
     seconds was shorter than four rolls take to earn, so it kept timing
     out before the guaranteed one. */
  var PLAY = 80;

  /* ===================================================================
     THE MACHINE
     A pachinko cabinet: a body, a lit screen, a tray, a handle and a
     light on top. Small enough that sixty of them cost nothing.
     ================================================================ */
  var MGEO = null, MMAT = null;
  function machineParts() {
    if (MGEO) return;
    MGEO = {
      body: new THREE.BoxGeometry(2.6, 4.4, 1.5),
      screen: new THREE.BoxGeometry(1.9, 2.1, .1),
      tray: new THREE.BoxGeometry(2.5, .5, .9),
      lamp: new THREE.SphereGeometry(.34, 10, 8),
      post: new THREE.BoxGeometry(.24, 1.1, .24)
    };
    MMAT = {
      screen: new THREE.MeshBasicMaterial({ color: 0xfff0a8, toneMapped: false }),
      glass: new THREE.MeshBasicMaterial({ color: 0x2a1a3a, toneMapped: false })
    };
  }
  var MCOL = [0xd83a3a, 0xe8b93a, 0x2fae62, 0x3a7ad8, 0x8a4ad8, 0xe8489a];

  function buildMachine(i) {
    machineParts();
    var c = MCOL[i % MCOL.length];
    var g = new THREE.Group();
    var body = new THREE.Mesh(MGEO.body,
      new THREE.MeshStandardMaterial({ color: c, roughness: .5, metalness: .2 }));
    body.position.y = 2.2;
    body.castShadow = true;
    g.add(body);
    var sc = new THREE.Mesh(MGEO.screen, MMAT.screen);
    sc.position.set(0, 2.9, .78);
    g.add(sc);
    var gl = new THREE.Mesh(MGEO.glass, MMAT.glass);
    gl.position.set(0, 1.4, .78);
    gl.scale.set(1, .5, 1);
    g.add(gl);
    var tray = new THREE.Mesh(MGEO.tray,
      new THREE.MeshStandardMaterial({ color: 0x2a2c34, roughness: .8 }));
    tray.position.set(0, .5, .8);
    g.add(tray);
    var post = new THREE.Mesh(MGEO.post,
      new THREE.MeshStandardMaterial({ color: 0x2a2c34, roughness: .8 }));
    post.position.set(0, 4.9, 0);
    g.add(post);
    var lamp = new THREE.Mesh(MGEO.lamp,
      new THREE.MeshBasicMaterial({ color: c, toneMapped: false }));
    lamp.position.set(0, 5.6, 0);
    g.add(lamp);
    g.__lamp = lamp;
    g.__screen = sc;
    g.__col = c;
    return g;
  }

  /* ===================================================================
     THE OVERLAY
     The banner, the rules and the symbols are DOM, because they are
     screen furniture rather than things standing in the world. What is
     behind the banner is the real scene, filmed.
     ================================================================ */
  var el = null;
  function ui() {
    if (el) return el;
    el = document.createElement('div');
    el.id = 'jjIDG';
    el.innerHTML =
      '<style>' +
      '#jjIDG{position:fixed;inset:0;pointer-events:none;z-index:64;' +
      'font-family:"Finger Paint",system-ui,sans-serif;overflow:hidden;display:none}' +
      '#jjIDG .band{position:absolute;left:-14%;width:128%;background:#31dd4a;' +
      'border-top:4px solid #f4f8ff;border-bottom:4px solid #f4f8ff;' +
      'transform-origin:50% 50%;opacity:0;transition:opacity .18s}' +
      '#jjIDG .b1{top:6%;height:19%;transform:rotate(-6.5deg) translateX(-120%)}' +
      '#jjIDG .b2{bottom:4%;height:23%;transform:rotate(-6.5deg) translateX(120%)}' +
      '#jjIDG .band.in{opacity:1}' +
      '#jjIDG .b1.in{animation:jjB1 .5s cubic-bezier(.16,.9,.3,1) forwards}' +
      '#jjIDG .b2.in{animation:jjB2 .5s cubic-bezier(.16,.9,.3,1) forwards}' +
      '@keyframes jjB1{to{transform:rotate(-6.5deg) translateX(0)}}' +
      '@keyframes jjB2{to{transform:rotate(-6.5deg) translateX(0)}}' +
      '#jjIDG .word{position:absolute;font-size:clamp(30px,7vw,86px);font-weight:900;' +
      'letter-spacing:.04em;color:#fff;-webkit-text-stroke:7px #05070c;' +
      'paint-order:stroke fill;white-space:nowrap;opacity:0;transition:opacity .2s}' +
      '#jjIDG .w1{top:2%;left:5%;transform:rotate(-6.5deg)}' +
      '#jjIDG .w2{bottom:12%;right:5%;transform:rotate(-6.5deg)}' +
      '#jjIDG .word.in{opacity:1}' +
      /* the rules, down the left, in rainbow */
      '#jjIDG .rules{position:absolute;top:14px;left:16px;max-width:34%;' +
      'font-size:clamp(10px,1.15vw,15px);line-height:1.5;font-weight:700;' +
      'opacity:0;transition:opacity .4s;text-shadow:0 2px 0 rgba(0,0,0,.85)}' +
      '#jjIDG .rules.in{opacity:1}' +
      '#jjIDG .rules b{display:block;font-size:1.25em;margin-bottom:4px}' +
      '#jjIDG .rules span{background:linear-gradient(90deg,#ff4d4d,#ffb03a,#ffe94d,' +
      '#4de26a,#4dc9ff,#9a6bff,#ff5ec4);-webkit-background-clip:text;' +
      'background-clip:text;color:transparent;animation:jjRain 3s linear infinite;' +
      'background-size:280% 100%}' +
      '@keyframes jjRain{to{background-position:280% 0}}' +
      /* the reels */
      '#jjIDG .sym{position:absolute;top:9%;left:50%;transform:translateX(-50%);' +
      'display:flex;gap:14px;opacity:0;transition:opacity .25s}' +
      '#jjIDG .sym.in{opacity:1}' +
      '#jjIDG .sym div{width:clamp(46px,6vw,74px);height:clamp(60px,8vw,96px);' +
      'background:#12101a;border:4px solid #ffd964;border-radius:9px;color:#ffe9a8;' +
      'font-size:clamp(28px,4vw,50px);font-weight:900;display:flex;' +
      'align-items:center;justify-content:center;box-shadow:0 0 22px rgba(255,217,100,.5)}' +
      '#jjIDG .sym div.mid{border-color:#f4f8ff;background:#1c1622;transform:scale(.9)}' +
      '#jjIDG .sym div.hit{animation:jjHit .5s ease-out}' +
      '@keyframes jjHit{0%{transform:scale(1.5);filter:brightness(2.4)}100%{transform:scale(1)}}' +
      /* the Richii caption */
      '#jjIDG .cap{position:absolute;bottom:15%;left:50%;transform:translateX(-50%);' +
      'font-size:clamp(15px,2.2vw,30px);font-weight:900;color:#fff;' +
      '-webkit-text-stroke:5px #05070c;paint-order:stroke fill;opacity:0;' +
      'transition:opacity .25s;white-space:nowrap;text-align:center}' +
      '#jjIDG .cap.in{opacity:1}' +
      '#jjIDG .cap i{display:block;font-style:normal;font-size:.62em;color:#ffd964}' +
      /* the payout word */
      '#jjIDG .pay{position:absolute;inset:0;display:flex;align-items:center;' +
      'justify-content:center;font-size:clamp(40px,10vw,140px);font-weight:900;' +
      'color:#ffe94d;-webkit-text-stroke:9px #05070c;paint-order:stroke fill;' +
      'opacity:0;transition:opacity .2s}' +
      '#jjIDG .pay.in{opacity:1;animation:jjPay .6s ease-out}' +
      '@keyframes jjPay{0%{transform:scale(2.2) rotate(-9deg);filter:brightness(3)}' +
      '100%{transform:scale(1) rotate(-3deg)}}' +
      '</style>' +
      '<div class="band b1"></div><div class="band b2"></div>' +
      '<div class="word w1">DOMAIN</div><div class="word w2">EXPANSION</div>' +
      '<div class="rules"><b><span>IDLE DEATH GAMBLE</span></b>' +
      '<span>EVERYONE INSIDE IS HELD.<br>' +
      'TWO VISUAL MOVES OPEN A RICHII.<br>' +
      'BALLS &middot; DOORS &middot; FEVER BREAKER &middot; DOOR GUARD<br>' +
      'FOUR ROLLS. THE FOURTH ALWAYS PAYS.<br>' +
      'ODD PAYS LUCK. EVEN PAYS SPEED.</span></div>' +
      '<div class="sym"><div class="a">7</div><div class="mid">?</div><div class="b">7</div></div>' +
      '<div class="cap"></div><div class="pay"></div>';
    document.body.appendChild(el);
    return el;
  }
  function q(sel) { return ui().querySelector(sel); }
  function show(on) { ui().style.display = on ? 'block' : 'none'; }
  function cls(sel, name, on) { q(sel).classList[on ? 'add' : 'remove'](name); }

  /* ===================================================================
     TZE
     The little figure a Richii scenario is about. He is deliberately
     crude — he is a character on a machine's screen, not a fighter.
     ================================================================ */
  function buildTze() {
    var g = new THREE.Group();
    function b(w, h, d, c, x, y, z) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({ color: c, roughness: .8 }));
      m.position.set(x, y, z);
      g.add(m);
      return m;
    }
    b(.9, 1.1, .6, 0x3ad86a, 0, 1.7, 0);          // body, green like the picture
    b(.75, .75, .7, 0xf0d8b0, 0, 2.6, 0);          // head
    b(.8, .2, .75, 0xd83a3a, 0, 3.0, 0);           // cap
    g.__armL = b(.24, .8, .24, 0xf0d8b0, -.6, 1.7, 0);
    g.__armR = b(.24, .8, .24, 0xf0d8b0, .6, 1.7, 0);
    g.__legL = b(.28, .9, .28, 0x2a2c34, -.22, .65, 0);
    g.__legR = b(.28, .9, .28, 0x2a2c34, .22, .65, 0);
    return g;
  }

  /* the two scenarios, as the source describes them */
  var RICHII = [
    { name: 'TRANSIT CARD RICHII', stars: '☆☆★', odds: .34,
      note: 'TZE IS WALKING TO THE CHECKPOINT',
      win: 'HE GOES THROUGH', lose: 'HE FLIES UP' },
    { name: 'TRAVEL EMERGENCY RICHII', stars: '☆★★', odds: .5,
      note: 'TZE IS RUNNING FOR THE BATHROOM',
      win: 'HE MAKES IT', lose: 'HE DOES NOT' }
  ];

  /* ===================================================================
     BUILDING THE WHITE
     ================================================================ */
  function keep(o) { G.props.push(o); scene.add(o); return o; }

  function clearStage() {
    G.props.forEach(function (o) {
      scene.remove(o);
      o.traverse(function (c) {
        if (c.isMesh && c.material && c.material.dispose && c !== c.parent) {
          /* shared geometry stays; only per-machine materials go */
          if (c.material.__own !== false && c.material.color) {
            try { c.material.dispose(); } catch (e) {}
          }
        }
      });
    });
    G.props.length = 0;
    G.machines.length = 0;
  }

  /* a line of machines, standing shoulder to shoulder */
  function buildLine(n, at, dir, tilt) {
    var side = new THREE.Vector3(-dir.z, 0, dir.x);
    var line = new THREE.Group();
    for (var i = 0; i < n; i++) {
      var m = buildMachine(i);
      m.position.copy(side).multiplyScalar((i - (n - 1) / 2) * 3);
      m.rotation.y = Math.atan2(dir.x, dir.z);
      line.add(m);
      G.machines.push(m);
    }
    line.position.copy(at);
    line.rotation.x = tilt || 0;
    keep(line);
    return line;
  }

  /* ===================================================================
     THE OPENING
     ================================================================ */
  function begin(center, yaw) {
    G.on = true;
    G.stage = 0;
    G.t = 0;
    G.moves = 0;
    G.rolls = 0;
    G.jackpot = false;
    G.richii = null;
    G.center = center.clone();
    G.yaw = yaw;
    G.lines = [];
    G.caught = 0;
    show(true);
    cls('.band.b1', 'in', true);
    cls('.band.b2', 'in', true);
    cls('.word.w1', 'in', true);
    cls('.word.w2', 'in', true);
    FX.letterbox(false);
    try { sfx.raise(); } catch (e) {}
  }

  function stepOpen(dt) {
    var t = G.t;
    var c = G.center;

    /* --- 1 · the hand sign, filmed --- */
    if (t < OPEN.sign) {
      if (Math.random() < .5) {
        FX.mote(player.pos.clone().add(new THREE.Vector3(0, 3, 0)), 0xffd964, 5, .4);
      }
      addShake(.2 + t * .3);
      return;
    }
    if (G.stage < 1) {
      G.stage = 1;
      cls('.band.b1', 'in', false);
      cls('.band.b2', 'in', false);
      cls('.word.w1', 'in', false);
      cls('.word.w2', 'in', false);
      /* --- 2 · and the world goes white --- */
      if (window.JJSTAGE) {
        window.JJSTAGE.hide.sky = 0xffffff;
        window.JJSTAGE.hide([]);
      }
      FX.flash('#ffffff', 1, .8);
      addShake(1.6);
      try { sfx.frame(); } catch (e) {}
    }

    if (t < OPEN.white) return;

    /* --- 3 · two lines of machines out of the white --- */
    if (G.stage < 2) {
      G.stage = 2;
      var f = new THREE.Vector3(Math.sin(G.yaw), 0, Math.cos(G.yaw));
      var s = new THREE.Vector3(-f.z, 0, f.x);
      /* upright to begin with, and stood well out */
      for (var i = -1; i <= 1; i += 2) {
        var at = c.clone().addScaledVector(s, i * 24);
        at.y = 0;
        var ln = buildLine(9, at, f.clone().multiplyScalar(-i), -Math.PI / 2);
        ln.__from = -Math.PI / 2;
        G.lines.push(ln);
      }
      FX.flash('#ffffff', .5, .3);
      addShake(.8);
    }
    if (t < OPEN.two) {
      /* they rise into the white */
      var k = Math.min(1, (t - OPEN.white) / (OPEN.two - OPEN.white));
      G.lines.forEach(function (ln) { ln.scale.setScalar(.05 + E.out(k) * .95); });
      return;
    }

    /* --- 4 · and they turn from upright to flat, up and over --- */
    if (t < OPEN.turn) {
      var k2 = E.out((t - OPEN.two) / (OPEN.turn - OPEN.two));
      G.lines.forEach(function (ln) { ln.rotation.x = -Math.PI / 2 * (1 - k2); });
      if (Math.random() < dt * 10) addShake(.3);
      return;
    }
    if (G.stage < 3) {
      G.stage = 3;
      G.lines.forEach(function (ln) { ln.rotation.x = 0; });
      /* --- 5 · four more lines --- */
      var f2 = new THREE.Vector3(Math.sin(G.yaw), 0, Math.cos(G.yaw));
      var s2 = new THREE.Vector3(-f2.z, 0, f2.x);
      var spots = [
        { d: f2.clone(), off: 30 }, { d: f2.clone().negate(), off: 26 },
        { d: s2.clone(), off: 38 }, { d: s2.clone().negate(), off: 38 }
      ];
      spots.forEach(function (sp, n) {
        var at = c.clone().addScaledVector(sp.d, sp.off);
        at.y = 0;
        var ln = buildLine(7, at, sp.d.clone().negate(), 0);
        ln.scale.setScalar(.05);
        ln.__grow = 0;
        G.lines.push(ln);
      });
      FX.flash('#ffffff', .45, .3);
      addShake(1);
      try { sfx.frame(); } catch (e) {}
    }
    if (t < OPEN.six) {
      var k3 = E.out((t - OPEN.turn) / (OPEN.six - OPEN.turn));
      for (var j = 2; j < G.lines.length; j++) G.lines[j].scale.setScalar(.05 + k3 * .95);
      return;
    }

    /* --- 6 · and six of them stood around the floor --- */
    if (G.stage < 4) {
      G.stage = 4;
      var f3 = new THREE.Vector3(Math.sin(G.yaw), 0, Math.cos(G.yaw));
      for (var n = 0; n < 6; n++) {
        var a = n / 6 * TAU + G.yaw;
        var m = buildMachine(n);
        m.position.set(c.x + Math.cos(a) * 19, 0, c.z + Math.sin(a) * 19);
        m.lookAt(c.x, 2, c.z);
        m.scale.setScalar(.05);
        m.__ring = 1;
        keep(m);
        G.machines.push(m);
      }
      FX.rings(new THREE.Vector3(c.x, .12, c.z), 0xffd964, 4,
        { maxR: 26, life: .9, gap: 60 });
      addShake(1.2);
    }
    if (t < OPEN.ring) {
      var k4 = E.out((t - OPEN.six) / (OPEN.ring - OPEN.six));
      G.machines.forEach(function (m) { if (m.__ring) m.scale.setScalar(.05 + k4 * .95); });
      return;
    }

    /* --- open --- */
    if (G.stage < 5) {
      G.stage = 5;
      G.machines.forEach(function (m) { if (m.__ring) m.scale.setScalar(1); });
      cls('.rules', 'in', true);
      FX.flash('#ffffff', .6, .4);
      addShake(1.4);
      if (typeof hitstop === 'function') hitstop(.14);
      /* everyone caught is held where they are, in a neutral stage */
      enemies.forEach(function (e) {
        if (!e || e.dead || e.pos.distanceTo(G.center) > R) return;
        G.caught++;
        e.stunT = Math.max(e.stunT || 0, PLAY);
        e.lockT = Math.max(e.lockT || 0, PLAY);
        e.vel.set(0, 0, 0);
      });
      if (window.JJNOTICE) window.JJNOTICE('TWO MOVES OPENS A RICHII', '#ffd964');
      if (window.MPJJ && window.MPJJ.relay) {
        window.MPJJ.relay.pub({ t: 'dom', id: window.MPJJ.id, k: 'gamble',
          x: Math.round(G.center.x * 10) / 10, z: Math.round(G.center.z * 10) / 10,
          y: Math.round(G.yaw * 100) / 100, r: R, d: 1.4, dur: PLAY });
      }
    }
  }

  /* ===================================================================
     THE GAME
     ================================================================ */
  /* a visual move. Doors and balls together count as two, which is what
     the source says, so the ball cast reports two of its own. */
  G.move = function (n) {
    if (!G.on || G.stage < 5 || G.richii || G.jackpot) return;
    G.moves += (n || 1);
    FX.rings(player.pos.clone().add(new THREE.Vector3(0, 3, 0)), 0xffd964, 1,
      { maxR: 6, life: .4, ground: false });
    if (window.JJNOTICE) {
      window.JJNOTICE(G.moves >= 2 ? 'RICHII' : 'ONE MORE MOVE', '#ffd964');
    }
    if (G.moves >= 2) { G.moves = 0; startRichii(); }
  };

  function pick(min, max) { return min + Math.floor(Math.random() * (max - min + 1)); }

  function startRichii() {
    var which = RICHII[pick(0, 1)];
    /* the two numbers, matching each other and waiting for a third */
    var n = pick(1, 9);
    var r = {
      def: which, t: 0, dur: G.fast ? 1.7 : 3.4, n: n,
      won: Math.random() < Math.min(.92, which.odds + G.luck) || G.rolls >= 3,
      pity: G.rolls >= 3
    };
    G.richii = r;
    G.rolls++;
    q('.sym .a').textContent = n;
    q('.sym .b').textContent = n;
    q('.sym .mid').textContent = '?';
    q('.sym .mid').classList.remove('hit');
    cls('.sym', 'in', true);
    q('.cap').innerHTML = which.name + '<i>' + which.stars + ' &middot; ' +
      which.note + ' &middot; ROLL ' + G.rolls + ' OF 4</i>';
    cls('.cap', 'in', true);
    /* Tze, and the thing he is walking at */
    /* Staged off to one side and lifted, so it plays out where the caster
       can watch it instead of directly behind his own shoulders. */
    var c = G.center;
    var f = new THREE.Vector3(Math.sin(G.yaw), 0, Math.cos(G.yaw));
    var sd = new THREE.Vector3(-f.z, 0, f.x);
    var start = c.clone().addScaledVector(f, 9).addScaledVector(sd, -9);
    start.y = 1.4;
    r.tze = buildTze();
    r.tze.scale.setScalar(1.5);
    r.tze.position.copy(start);
    r.tze.rotation.y = G.yaw + Math.PI / 2;
    keep(r.tze);
    /* the checkpoint, or the door */
    var gate = new THREE.Group();
    var col = which === RICHII[0] ? 0x3a7ad8 : 0x2fae62;
    for (var i = -1; i <= 1; i += 2) {
      var post = new THREE.Mesh(new THREE.BoxGeometry(.7, 3.2, 1.6),
        new THREE.MeshStandardMaterial({ color: col, roughness: .6 }));
      post.position.set(i * 1.5, 1.6, 0);
      gate.add(post);
    }
    var top = new THREE.Mesh(new THREE.BoxGeometry(3.7, .5, 1.6),
      new THREE.MeshStandardMaterial({ color: 0xf0f2f6, roughness: .7 }));
    top.position.y = 3.4;
    gate.add(top);
    gate.position.copy(c).addScaledVector(f, 9).addScaledVector(sd, 9);
    gate.position.y = 1.4;
    gate.rotation.y = G.yaw + Math.PI / 2;
    keep(gate);
    r.gate = gate;
    var deck = new THREE.Mesh(new THREE.BoxGeometry(26, .5, 6),
      new THREE.MeshStandardMaterial({ color: 0x2a2c34, roughness: .9 }));
    deck.position.copy(c).addScaledVector(f, 9);
    deck.position.y = 1.05;
    deck.rotation.y = G.yaw + Math.PI / 2;
    keep(deck);
    r.deck = deck;
    r.from = start.clone();
    r.to = gate.position.clone();
    try { sfx.frame(); } catch (e) {}
    if (window.JJNOTICE) window.JJNOTICE(which.name, '#ffd964');
  }

  /* the little stage a scenario is played on, taken away with it */
  function dropRichii(r) {
    [r.tze, r.gate, r.deck].forEach(function (o) {
      if (!o) return;
      scene.remove(o);
      var i = G.props.indexOf(o);
      if (i >= 0) G.props.splice(i, 1);
    });
  }

  function stepRichii(dt) {
    var r = G.richii;
    r.t += dt;
    var k = Math.min(1, r.t / r.dur);
    var tz = r.tze;
    if (tz) {
      /* he walks at it, and near the end either goes through or does not */
      var p = r.from.clone().lerp(r.to, Math.min(1, k * 1.05));
      tz.position.copy(p);
      var sw = Math.sin(r.t * (r.def === RICHII[1] ? 16 : 9)) * .8;
      if (tz.__legL) { tz.__legL.rotation.x = sw; tz.__legR.rotation.x = -sw; }
      if (tz.__armL) { tz.__armL.rotation.x = -sw; tz.__armR.rotation.x = sw; }
      if (k > .82) {
        if (r.won) {
          tz.position.y = 0;                       // straight through it
        } else if (r.def === RICHII[0]) {
          tz.position.y += dt * 16;                // flies up instead
          tz.rotation.z += dt * 6;
        } else {
          tz.position.y = Math.max(-1.4, tz.position.y - dt * 9);  // falls
          tz.rotation.x = -1.4;
        }
      }
      if (Math.random() < dt * 8) {
        FX.mote(tz.position.clone().add(new THREE.Vector3(0, 2, 0)),
          r.won ? 0xffd964 : 0x9aa3b2, 2, .3);
      }
    }
    if (k < 1) return;

    /* the third symbol lands between the other two */
    q('.sym .mid').textContent = r.won ? r.n : pick(0, 9);
    q('.sym .mid').classList.add('hit');
    q('.cap').innerHTML = r.def.name + '<i>' + (r.won ? r.def.win : r.def.lose) + '</i>';
    if (r.won) {
      G.richii = null;                 // or this runs again on every frame
      dropRichii(r);
      jackpot(r);
    } else {
      if (window.JJNOTICE) window.JJNOTICE('NO GOOD — AGAIN', '#ff8b98');
      FX.flash('#3a2a10', .4, .3);
      setTimeout(function () {
        cls('.sym', 'in', false);
        cls('.cap', 'in', false);
      }, 900);
      dropRichii(r);
      G.richii = null;
      if (G.rolls >= 4) breakDomain();
    }
  }

  /* ===================================================================
     THE PAYOUT
     ================================================================ */
  function jackpot(r) {
    G.jackpot = true;
    var n = r.n;
    var word = String(n) + String(n) + String(n);
    q('.pay').textContent = word;
    cls('.pay', 'in', true);
    FX.flash('#fff3c8', 1, .5);
    addShake(3);
    if (typeof hitstop === 'function') hitstop(.2);
    try { sfx.redBoom(); } catch (e) {}
    /* odd pays luck, even pays speed — and they carry to the next one */
    if (n % 2) { G.luck = Math.min(.45, G.luck + .22); G.fast = false; }
    else { G.fast = true; G.luck = Math.max(0, G.luck - .05); }
    if (window.JJNOTICE) {
      window.JJNOTICE(n % 2 ? 'ODD — BETTER ODDS NEXT TIME'
                            : 'EVEN — FASTER NEXT TIME', '#ffe94d');
    }
    /* the fever it pays out with, halved if it was the pity roll */
    var dur = r.pity ? 14 : 28;
    setTimeout(function () { startCine(dur); }, 900);
  }

  function breakDomain() {
    if (window.JJNOTICE) window.JJNOTICE('THE DOMAIN BREAKS', '#ff8b98');
    finish(0);
  }

  /* ===================================================================
     THE CUTSCENE
     The domain comes apart, he shouts, he dances, and the camera gives
     itself back with the aura still on him.
     ================================================================ */
  var CINE = { on: false, t: 0, dur: 7.2, fever: 0 };

  function startCine(fever) {
    CINE.on = true;
    CINE.t = 0;
    CINE.stage = 0;
    player.action = { type: 'hwin', t: 0, dur: CINE.dur + 1 };
    CINE.fever = fever;
    show(true);
    cls('.rules', 'in', false);
    cls('.sym', 'in', false);
    cls('.cap', 'in', false);
    FX.letterbox(true);
    if (AN) AN.camRelease();
  }


  function stepCine(dt) {
    CINE.t += dt;
    var t = CINE.t, p = player;
    var c = G.center;
    p.vel.set(0, 0, 0);
    p.pos.x += (c.x - p.pos.x) * Math.min(1, dt * 4);
    p.pos.z += (c.z - p.pos.z) * Math.min(1, dt * 4);
    p.iframes = Math.max(p.iframes, 2);

    /* --- the domain comes apart --- */
    if (CINE.stage < 1) {
      CINE.stage = 1;
      G.machines.forEach(function (m, i) {
        setTimeout(function () {
          if (typeof scene === 'undefined' || !m.parent) return;
          FX.impact(m.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 2, 0)),
            m.__col, 1.4);
          m.visible = false;
        }, i * 18);
      });
      FX.flash('#ffffff', .9, .5);
      addShake(2.4);
      try { sfx.shatter(); } catch (e) {}
      if (window.JJSTAGE) window.JJSTAGE.show();
    }

    /* --- 1 · his face, from the side, shouting --- */
    if (t < 2.1) {
      if (Math.random() < .6) {
        FX.mote(p.pos.clone().add(new THREE.Vector3(0, 4, 0)), 0xffe94d, 4, .4);
      }
      return;
    }

    /* --- 2 · out front, dancing, and the aura is enormous --- */
    if (CINE.stage < 2) {
      CINE.stage = 2;
      cls('.pay', 'in', false);
      bigAura();
    }
    if (t < 5.2) return;

    /* --- 3 · and the camera hands itself back --- */
    if (CINE.stage < 3) {
      CINE.stage = 3;
      FX.letterbox(false);
      if (AN) AN.camRelease();
      show(false);
      /* the fever he walks out with */
      /* his own fever state, so hakari.js keeps counting it down, keeps
         the cooldowns off and takes the aura away when the song ends */
      var HK = window.JJHAKARI;
      if (HK) {
        HK.fever = CINE.fever;
        HK.spins = 0;
        player.hp = player.maxHp;
        /* fever.js puts up the heavy standing aura the moment HK.fever
           goes positive, so only fall back if it is not loaded */
        if (!HK.aura && !window.JJFEVER) {
          HK.aura = FX.aura(function () { return player.pos; }, 0xffcc4d);
        }
        var fev = document.getElementById('jjFever');
        if (fev) fev.style.display = 'block';
      }
      if (window.JJNOTICE) {
        window.JJNOTICE('UNLIMITED CURSED ENERGY — AUTOMATIC RCT', '#ffd964');
      }

    }
    if (t > CINE.dur) { CINE.on = false; finish(CINE.fever); }
  }

  /* The aura: yellow, very large, and with rainbow running through it —
     but see-through, because the point of the shot is watching him dance
     inside it. The first version stacked seven big additive sheets and a
     wide column on top of each other and the screen simply went white. */
  function bigAura() {
    var COLS = [0xffe94d, 0xff4d4d, 0xffb03a, 0x4de26a, 0x4dc9ff, 0x9a6bff, 0xff5ec4];
    for (var i = 0; i < 7; i++) {
      (function (n) {
        var m = FX.billboard(FX.T.smoke, COLS[n], .1);
        m.scale.set(9 + n * 1.6, 15 + n * 2.4, 1);
        scene.add(m);
        /* held out around him rather than over him */
        var a = n / 7 * TAU;
        var off = new THREE.Vector3(Math.cos(a) * (2.2 + n * .5), 0, Math.sin(a) * (2.2 + n * .5));
        var t = 0;
        addFx({ t: 6.4, update: function (dt) {
          this.t -= dt; t += dt;
          m.position.copy(player.pos).add(off).add(new THREE.Vector3(0, 5 + n * .3, 0));
          FX.faceCam(m, Math.sin(t * 2 + n) * .1);
          m.material.opacity = .085 * Math.min(1, this.t / .8) * (.6 + .4 * Math.sin(t * 5 + n));
          if (this.t <= 0) { scene.remove(m); m.material.dispose(); return false; }
          return true;
        } });
      })(i);
    }
    /* No column. A beam up the middle stands exactly where he is and
       there is no shot of him left. The aura is the rings, the shells and
       the rainbow going past him. */
    FX.rings(new THREE.Vector3(player.pos.x, .12, player.pos.z), 0xffd964, 6,
      { maxR: 26, life: 1.1, gap: 90 });
    /* and the rainbow, as streaks climbing past him */
    for (var k = 0; k < 54; k++) {
      (function (n) {
        setTimeout(function () {
          if (typeof scene === 'undefined') return;
          var a2 = Math.random() * TAU, rr = 2.6 + Math.random() * 5;
          FX.streaks(player.pos.clone().add(new THREE.Vector3(
            Math.cos(a2) * rr, Math.random() * 8, Math.sin(a2) * rr)),
            COLS[n % COLS.length], 2, 18, 1.5);
        }, n * 46);
      })(k);
    }
    addShake(2);
  }

  function finish(fever) {
    G.on = false;
    G.stage = 0;
    G.richii = null;
    CINE.on = false;
    /* hand the body back: an action left standing here is a player who
       cannot move, cannot cast, and cannot get out of it */
    if (player.action && (player.action.type === 'hdom' || player.action.type === 'hwin')) {
      player.action = null;
    }
    clearStage();
    show(false);
    cls('.rules', 'in', false);
    cls('.sym', 'in', false);
    cls('.cap', 'in', false);
    cls('.pay', 'in', false);
    FX.letterbox(false);
    if (window.JJSTAGE) window.JJSTAGE.show();
    if (AN) AN.camRelease();
    if (fever && window.JJHAKARI) window.JJHAKARI.fever = fever;
    enemies.forEach(function (e) {
      if (!e) return;
      e.stunT = Math.min(e.stunT || 0, .3);
      e.lockT = 0;
    });
  }
  G.finish = finish;

  /* ===================================================================
     THE POSES
     ================================================================ */
  function rp(r) { resetPose(r); if (r.body) r.body.rotation.set(0, 0, 0); }

  function poseDomain(r, t) {
    rp(r);
    if (t < OPEN.sign) {
      /* the hand sign: both hands together in front of his chest */
      var k = E.out(Math.min(1, t / .7));
      r.shoulderL.rotation.x = -1.35 * k;
      r.shoulderR.rotation.x = -1.35 * k;
      r.shoulderL.rotation.z = .62 * k;
      r.shoulderR.rotation.z = -.62 * k;
      r.elbowL.rotation.x = -1.7 * k;
      r.elbowR.rotation.x = -1.7 * k;
      r.neck.rotation.x = .2 * k;
      r.spine.rotation.x = .16 * k;
      r.hips.position.y = r.hipsBaseY - .26 * k;
      return true;
    }
    /* arms out, holding it open */
    var o = E.out(Math.min(1, (t - OPEN.sign) / .6));
    var idle = Math.sin(t * 2) * .05;
    r.shoulderL.rotation.x = -1.35 + .95 * o;
    r.shoulderR.rotation.x = -1.35 + .95 * o;
    r.shoulderL.rotation.z = .62 + .7 * o;
    r.shoulderR.rotation.z = -.62 - .7 * o;
    r.elbowL.rotation.x = -1.7 + 1.5 * o;
    r.elbowR.rotation.x = -1.7 + 1.5 * o;
    r.neck.rotation.x = .2 - .55 * o + idle;
    r.spine.rotation.x = .16 - .3 * o + idle * .5;
    r.hips.position.y = r.hipsBaseY - .26 + .36 * o + idle * .4;
    return true;
  }

  /* the dance, and then the pose off the reference: one arm thrown up,
     the other across, weight on the back foot, head back */
  function poseCine(r, t) {
    rp(r);
    if (t < 2.1) {
      /* shouting: head back, mouth open, fists up by the shoulders */
      var k = E.out(Math.min(1, t / .5));
      var y = Math.sin(t * 9) * .06;
      r.neck.rotation.x = -.62 * k + y;
      r.spine.rotation.x = -.3 * k;
      r.shoulderL.rotation.x = -1.55 * k;
      r.shoulderR.rotation.x = -1.55 * k;
      r.shoulderL.rotation.z = .78 * k;
      r.shoulderR.rotation.z = -.78 * k;
      r.elbowL.rotation.x = -2.2 * k;
      r.elbowR.rotation.x = -2.2 * k;
      r.hips.position.y = r.hipsBaseY - .18 * k + y * .5;
      return true;
    }
    if (t < 3.9) {
      /* dancing, front on */
      var d = (t - 2.1) * 7;
      var s = Math.sin(d), c2 = Math.cos(d);
      r.spine.rotation.y = s * .42;
      r.spine.rotation.x = -.14 + Math.abs(c2) * .12;
      r.neck.rotation.x = -.24;
      r.neck.rotation.y = -s * .3;
      r.shoulderL.rotation.x = -1.1 - s * .9;
      r.shoulderR.rotation.x = -1.1 + s * .9;
      r.shoulderL.rotation.z = .6 + c2 * .34;
      r.shoulderR.rotation.z = -.6 + c2 * .34;
      r.elbowL.rotation.x = -1.5 + s * .5;
      r.elbowR.rotation.x = -1.5 - s * .5;
      r.hipL.rotation.x = -.24 + s * .34;
      r.hipR.rotation.x = -.24 - s * .34;
      r.kneeL.rotation.x = .4 + Math.max(0, s) * .5;
      r.kneeR.rotation.x = .4 + Math.max(0, -s) * .5;
      r.hips.position.y = r.hipsBaseY - .2 + Math.abs(s) * .32;
      r.hips.position.x = s * .2;
      return true;
    }
    /* THE POSE: near arm punched up and out, far arm across the body,
       hips cocked, head tipped back — and he keeps bouncing in it */
    var k2 = E.out(Math.min(1, (t - 3.9) / .4));
    var b = Math.sin((t - 3.9) * 9) * .5 + .5;
    r.spine.rotation.z = .3 * k2;
    r.spine.rotation.y = -.34 * k2;
    r.spine.rotation.x = -.2 * k2;
    r.neck.rotation.x = -.5 * k2;
    r.neck.rotation.z = .2 * k2;
    r.shoulderR.rotation.x = -2.75 * k2;
    r.shoulderR.rotation.z = -.55 * k2;
    r.elbowR.rotation.x = -.3 * k2;
    r.shoulderL.rotation.x = -.85 * k2;
    r.shoulderL.rotation.z = -.95 * k2;
    r.elbowL.rotation.x = -1.5 * k2;
    r.hipL.rotation.x = -.5 * k2;
    r.kneeL.rotation.x = .95 * k2;
    r.hipR.rotation.x = .28 * k2;
    r.kneeR.rotation.x = .3 * k2;
    r.hips.position.y = r.hipsBaseY - (.34 + b * .18) * k2;
    r.hips.position.x = .22 * k2;
    return true;
  }

  /* ===================================================================
     WIRING
     ================================================================ */
  G.begin = begin;

  var _stepAction = stepAction;
  stepAction = function (a, dt) {
    /* The opening, and nothing else. An action blocks movement and blocks
       casting — holding one for the domain's whole length left the caster
       standing still inside his own domain, unable to make the two visual
       moves the domain is asking him for. So the action ends when the
       machines are up, and the game itself runs on its own tick. */
    if (a.type === 'hdom') {
      if (!G.on) begin(player.pos.clone(), player.facing);
      G.t += dt;
      player.vel.set(0, 0, 0);
      player.iframes = Math.max(player.iframes, 2);
      stepOpen(dt);
      if (G.stage >= 5) player.action = null;      // and now he plays
      return;
    }
    /* the payout, which is a cutscene and does hold him */
    if (a.type === 'hwin') {
      CINE.t += dt;
      stepCine(dt);
      return;
    }
    return _stepAction(a, dt);
  };

  var _poseAction = poseAction;
  poseAction = function (r, a) {
    if (!a) return _poseAction(r, a);
    if (a.type === 'hdom' && r === player.rig) { poseDomain(r, G.t); return; }
    if (a.type === 'hwin' && r === player.rig) { poseCine(r, CINE.t); return; }
    return _poseAction(r, a);
  };

  var _updateCamera = updateCamera;
  updateCamera = function (dt) {
    var a = player.action;
    if (a && AN && (a.type === 'hdom' || a.type === 'hwin')) {
      var c = G.center || player.pos;
      var f = new THREE.Vector3(Math.sin(player.facing), 0, Math.cos(player.facing));
      if (a.type === 'hwin') {
        var side = new THREE.Vector3(-f.z, 0, f.x);
        if (CINE.t < 2.1) {
          /* his face, from the side, while he shouts */
          AN.camTo(player.pos.x + side.x * 4.2 + f.x * 2.6, 4.3,
            player.pos.z + side.z * 4.2 + f.z * 2.6,
            player.pos.x + f.x * .6, 4.25, player.pos.z + f.z * .6, dt, 28);
        } else if (CINE.t < 5.2) {
          /* and then out in front of him for the dance */
          /* up and looking down, so a frozen body standing between the
             lens and him does not take the shot */
          AN.camTo(player.pos.x + f.x * 15, 10.5, player.pos.z + f.z * 15,
            player.pos.x, 3.6, player.pos.z, dt, 20);
        } else {
          return _updateCamera(dt);
        }
        return;
      }
      if (G.t < OPEN.sign) {
        AN.camTo(c.x + f.x * 4.6, 4.6, c.z + f.z * 4.6, c.x, 4.2, c.z, dt, 26);
        return;
      }
      if (G.t < OPEN.ring) {
        var out = 12 + (G.t - OPEN.sign) * 3.4;
        AN.camTo(c.x + f.x * out, 8 + (G.t - OPEN.sign) * 1.6, c.z + f.z * out,
          c.x, 3.4, c.z, dt, 16);
        return;
      }
    }
    return _updateCamera(dt);
  };

  /* THE GAME'S OWN TICK
     Once the machines are up the domain is not an action any more — it is
     a state the fight happens inside. */
  addFx({ t: 1e9, update: function (dt) {
    if (player.dead && (G.luck || G.fast)) { G.luck = 0; G.fast = false; }
    if (!G.on || G.stage < 5) return true;
    var a = player.action;
    if (a && a.type === 'hwin') return true;       // the payout owns it
    G.t += dt;
    if (G.richii) { stepRichii(dt); return true; }
    /* the caster dying, or walking out of his own domain, ends it */
    if (player.dead) { finish(0); return true; }
    if (!G.jackpot && G.t > OPEN.ring + PLAY) breakDomain();
    return true;
  } });

  /* ===================================================================
     THE SCENERY HE DRAGS AROUND WITH HIM
     Everything he does is a piece of somebody else's building — a train
     door, a parlour's balls, a machine. So the ground he fights on keeps
     turning into the place those things came from: a platform, a parlour
     floor, a crossing. It lasts a few seconds and goes.
     ================================================================ */
  var SCENES = [
    { name: 'SUBWAY PLATFORM', floor: 0x3a3f4a, line: 0xffd964, wall: 0x2a2e38 },
    { name: 'PARLOUR FLOOR', floor: 0x5a1f3a, line: 0xff5ec4, wall: 0x36122a },
    { name: 'THE CROSSING', floor: 0x44474e, line: 0xf4f8ff, wall: 0x2e3138 },
    { name: 'ARCADE', floor: 0x1e2440, line: 0x4dc9ff, wall: 0x141834 }
  ];
  var sceneN = 0, sceneLive = null;

  G.scene = function (at) {
    if (G.on) return;                     // the domain has its own floor
    if (sceneLive) return;                // one at a time
    var S = SCENES[(sceneN++) % SCENES.length];
    var c = at ? at.clone() : player.pos.clone();
    c.y = 0;
    var g = new THREE.Group();
    /* the floor it stands on */
    var floor = new THREE.Mesh(new THREE.PlaneGeometry(46, 46),
      new THREE.MeshStandardMaterial({ color: S.floor, roughness: .92 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(c.x, .04, c.z);
    g.add(floor);
    /* the yellow line down a platform, or the stripes of a crossing */
    for (var i = -1; i <= 1; i += 2) {
      var ln = new THREE.Mesh(new THREE.PlaneGeometry(44, 1.1),
        new THREE.MeshBasicMaterial({ color: S.line, toneMapped: false }));
      ln.rotation.x = -Math.PI / 2;
      ln.position.set(c.x, .07, c.z + i * 9);
      g.add(ln);
    }
    /* NO WALLS. The first version stood two of them at the edges to make
       it feel like a place, and the result was a slab of building
       appearing beside you in the middle of a fight for no reason you
       could see. The floor is the scene; anything vertical is scenery
       that gets in the way of the thing you are actually doing. */
    for (var k = -2; k <= 2; k++) {
      var stud = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6),
        new THREE.MeshBasicMaterial({ color: S.line, toneMapped: false,
          transparent: true, opacity: .5 }));
      stud.rotation.x = -Math.PI / 2;
      stud.position.set(c.x + k * 9, .06, c.z);
      g.add(stud);
    }
    scene.add(g);
    sceneLive = g;
    FX.rings(new THREE.Vector3(c.x, .12, c.z), S.line, 3, { maxR: 24, life: .7, gap: 50 });
    FX.dust(new THREE.Vector3(c.x, 0, c.z), 8, 0xcfc3a8, 16, 4);
    if (window.JJNOTICE) window.JJNOTICE(S.name, '#ffd964');
    var t = 0;
    addFx({ t: 7, update: function (dt) {
      this.t -= dt; t += dt;
      var k2 = Math.min(1, t / .4);
      g.scale.set(1, k2, 1);
      if (this.t < .8) {
        g.traverse(function (o) {
          if (!o.isMesh || !o.material) return;
          o.material.transparent = true;
          o.material.opacity = this.t / .8;
        }.bind(this));
      }
      if (this.t <= 0) {
        scene.remove(g);
        g.traverse(function (o) { if (o.isMesh) o.material.dispose(); });
        if (sceneLive === g) sceneLive = null;
        return false;
      }
      return true;
    } });
  };

  /* what everybody else in the room sees */
  G.remote = function (center, yaw, dur) {
    var c = center.clone();
    if (window.JJSTAGE) { window.JJSTAGE.hide.sky = 0xffffff; }
    FX.flash('#ffffff', .8, .6);
    FX.rings(new THREE.Vector3(c.x, .12, c.z), 0xffd964, 4, { maxR: 26, life: .9, gap: 60 });
    var made = [];
    for (var n = 0; n < 6; n++) {
      var a = n / 6 * TAU + (yaw || 0);
      var m = buildMachine(n);
      m.position.set(c.x + Math.cos(a) * 19, 0, c.z + Math.sin(a) * 19);
      m.lookAt(c.x, 2, c.z);
      scene.add(m);
      made.push(m);
    }
    addShake(1.2);
    setTimeout(function () {
      if (typeof scene === 'undefined') return;
      made.forEach(function (m) { scene.remove(m); });
    }, (dur || PLAY) * 1000);
  };
})();
