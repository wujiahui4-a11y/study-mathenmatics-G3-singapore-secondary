/* Study Portal — wiring: input, game loop, host/client roles. */
(function (SA) {
  'use strict';

  var CFG = SA.CFG;
  var UI = SA.UI;
  var FIXED = 1 / 60;
  var INTERP = 0.14;           // render remote players this far in the past
  var MAX_PLAYERS = 10;

  var G = {
    mode: 'idle',              // idle | solo | host | client
    world: null,
    sim: null,
    relay: null,
    renderer: null,
    myId: null,
    myName: 'Player',
    myColor: 0,
    code: null,
    bots: 4,
    you: null,
    accum: 0,
    snapAccum: 0,
    rosterAccum: 0,
    pendingEvents: [],
    pongs: [],
    snapBuf: [],
    roster: {},
    pred: null,
    aim: 0,
    lastFrame: 0,
    lastSnapAt: 0,
    ping: 0,
    pingSentAt: 0,
    shownCards: null,
    view: null
  };

  /* --------------------------------------------------------------- input */
  var keys = {};
  var mouse = { x: 0, y: 0, down: false };
  var pressQueue = [];
  var dashQueue = false;

  function inputVector() {
    var ax = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0);
    var ay = (keys.s || keys.arrowdown ? 1 : 0) - (keys.w || keys.arrowup ? 1 : 0);
    if (touch.active) { ax = touch.mx; ay = touch.my; }
    return { ax: ax, ay: ay };
  }

  function currentInput() {
    var v = inputVector();
    var inp = { ax: v.ax, ay: v.ay, an: G.aim, s: (mouse.down || touch.shoot) ? 1 : 0 };
    if (pressQueue.length) { inp.u = pressQueue.slice(); pressQueue.length = 0; }
    if (dashQueue) { inp.d = 1; dashQueue = false; }
    return inp;
  }

  var touch = { active: false, shoot: false, mx: 0, my: 0, moveId: null, aimId: null };

  function bindInput() {
    window.addEventListener('keydown', function (e) {
      var k = e.key.toLowerCase();

      if (k === 'escape') {
        e.preventDefault();
        UI.setNotes(!UI.notesOpen);
        return;
      }
      if (UI.notesOpen) return;
      if (document.activeElement && /input|textarea/i.test(document.activeElement.tagName)) return;

      keys[k] = true;
      if (k === 'tab') e.preventDefault();
      if (G.mode === 'idle') return;

      if (k === '1' || k === '2' || k === '3') {
        var idx = parseInt(k, 10) - 1;
        if (UI.cardIds[idx]) { pickSkill(UI.cardIds[idx]); e.preventDefault(); }
        return;
      }
      if (k === 'shift') { dashQueue = true; return; }
      var slot = { q: 0, e: 1, r: 2, f: 3 }[k];
      if (slot != null) pressQueue.push(slot);
    });

    window.addEventListener('keyup', function (e) { keys[e.key.toLowerCase()] = false; });
    window.addEventListener('blur', function () { keys = {}; mouse.down = false; });

    var cv = document.getElementById('game');
    cv.addEventListener('mousemove', function (e) {
      var r = cv.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
    });
    cv.addEventListener('mousedown', function (e) { if (e.button === 0) { mouse.down = true; e.preventDefault(); } });
    window.addEventListener('mouseup', function (e) { if (e.button === 0) mouse.down = false; });
    cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    /* very small touch scheme: left half steers, right half aims and fires */
    function touchUpdate(e) {
      var r = cv.getBoundingClientRect();
      touch.active = false; touch.shoot = false;
      for (var i = 0; i < e.touches.length; i++) {
        var t = e.touches[i];
        var x = t.clientX - r.left, y = t.clientY - r.top;
        if (x < r.width * 0.45) {
          if (touch.originX == null) { touch.originX = x; touch.originY = y; }
          var dx = x - touch.originX, dy = y - touch.originY;
          var len = Math.hypot(dx, dy) || 1;
          var mag = Math.min(1, len / 60);
          touch.mx = (dx / len) * mag; touch.my = (dy / len) * mag;
          touch.active = true;
        } else {
          mouse.x = x; mouse.y = y;
          touch.shoot = true;
        }
      }
      if (!touch.active) { touch.originX = null; touch.mx = touch.my = 0; }
      e.preventDefault();
    }
    cv.addEventListener('touchstart', touchUpdate, { passive: false });
    cv.addEventListener('touchmove', touchUpdate, { passive: false });
    cv.addEventListener('touchend', touchUpdate, { passive: false });

    window.addEventListener('resize', function () { if (G.renderer) G.renderer.resize(); });
    window.addEventListener('beforeunload', function () { shutdown(true); });
  }

  /* --------------------------------------------------------------- start */
  function makeWorld(seed) {
    G.world = new SA.World(seed);
    G.view = {
      world: G.world, meId: null, players: {}, bullets: [], mines: [],
      turrets: [], pickups: [], snapCam: true
    };
  }

  function ensureRenderer() {
    if (!G.renderer) {
      G.renderer = new SA.Renderer(document.getElementById('game'), document.getElementById('minimap'));
    }
    G.renderer.world = G.world;
    G.renderer.miniBase = null;
    G.renderer.resize();
  }

  function localProfile() {
    G.myName = UI.playerName();
    G.myColor = UI.colorIdx || 0;
  }

  function startSolo(bots) {
    shutdown();
    localProfile();
    makeWorld((Math.random() * 0xffffffff) >>> 0);
    G.mode = 'solo';
    G.sim = new SA.Sim(G.world);
    G.myId = 'me_' + SA.uid();
    G.sim.addPlayer({ id: G.myId, name: G.myName, colorIdx: G.myColor });
    G.sim.fillBots(bots);
    G.view.meId = G.myId;
    G.view.snapCam = true;
    UI.setRoom('SOLO', null);
    UI.setPing('offline');
    ensureRenderer();
    UI.showScreen('game');
    UI.toast('Solo practice — defeat 1 opponent to reach level 2');
    startLoop();
  }

  function startHost(bots, code) {
    shutdown();
    localProfile();
    G.mode = 'host';
    G.bots = bots;
    G.relay = new SA.Relay();
    UI.netStatus('Opening a room…');

    G.relay.start({
      isHost: true,
      code: code || SA.newRoomCode(),
      onStatus: function (s, text) { UI.netStatus(text, s === 'online' ? 'ok' : ''); UI.setPing(s === 'online' ? 'live' : s, s !== 'online'); },
      onMsg: hostOnMessage
    }).then(function (finalCode) {
      G.code = finalCode;
      makeWorld(SA.hash(finalCode));
      G.sim = new SA.Sim(G.world);
      G.myId = 'me_' + SA.uid();
      G.sim.addPlayer({ id: G.myId, name: G.myName, colorIdx: G.myColor });
      G.sim.fillBots(bots);
      G.view.meId = G.myId;
      G.view.snapCam = true;

      var link = inviteLink(finalCode);
      UI.showShare(link);
      UI.setRoom(finalCode, link);
      UI.netStatus('Room ' + finalCode + ' is open. Share the link — the room stays open while this tab is open.', 'ok');
      ensureRenderer();
      UI.showScreen('game');
      UI.toast('Room ' + finalCode + ' — share the link with your friends');
      startLoop();
      startKeepAlive();
    }).catch(function (err) {
      UI.netStatus('Could not reach a relay (' + (err && err.message ? err.message : 'network blocked') +
        '). You can still play solo practice.', 'err');
      G.mode = 'idle';
    });
  }

  function startClient(code) {
    if (!/^[A-Z0-9]{4,8}$/.test(code || '')) { UI.netStatus('That room code does not look right.', 'err'); return; }
    shutdown();
    localProfile();
    G.mode = 'client';
    G.code = code;
    G.relay = new SA.Relay();
    UI.netStatus('Looking for room ' + code + '…');

    G.relay.start({
      isHost: false,
      code: code,
      onStatus: function (s, text) { UI.setPing(s === 'online' ? '…' : s, s !== 'online'); },
      onMsg: clientOnMessage
    }).then(function () {
      makeWorld(SA.hash(code));
      G.myId = 'p_' + SA.uid();
      G.view.meId = G.myId;
      G.joined = false;
      var tries = 0;
      G.joinTimer = setInterval(function () {
        if (G.joined || G.mode !== 'client') { clearInterval(G.joinTimer); return; }
        if (++tries > 6) {
          clearInterval(G.joinTimer);
          UI.netStatus('No one is hosting room ' + code + ' right now. Ask your friend to keep their tab open, or create the room yourself.', 'err');
          UI.showScreen('lobby');
          shutdown();
          return;
        }
        G.relay.pub({ t: 'j', id: G.myId, n: G.myName, c: G.myColor });
      }, 900);
      G.relay.pub({ t: 'j', id: G.myId, n: G.myName, c: G.myColor });
    }).catch(function (err) {
      UI.netStatus('Could not reach the relay this room uses (' + (err && err.message ? err.message : 'blocked') + ').', 'err');
      G.mode = 'idle';
    });
  }

  function inviteLink(code) {
    return location.origin + location.pathname + '?room=' + code;
  }

  function shutdown(quiet) {
    if (G.relay && G.relay.connected) {
      if (G.mode === 'host') G.relay.pub({ t: 'end' });
      else if (G.mode === 'client') G.relay.pub({ t: 'bye', id: G.myId });
    }
    if (G.relay) G.relay.stop();
    if (G.joinTimer) clearInterval(G.joinTimer);
    stopKeepAlive();
    G.relay = null; G.sim = null; G.you = null;
    G.snapBuf = []; G.roster = {}; G.pred = null;
    G.pendingEvents = []; G.pongs = [];
    G.shownCards = null; G.pendingPick = null;
    G.mode = 'idle';
    if (!quiet) { UI.hideCards(); UI.setDeath(false); }
  }

  /* --------------------------------------------------------- host messages */
  function hostOnMessage(msg) {
    if (!G.sim || G.mode !== 'host') return;
    if (msg.t === 'j') {
      var p = G.sim.players[msg.id];
      if (!p) {
        if (countHumans() >= MAX_PLAYERS) {
          G.relay.pub({ t: 'full', id: msg.id });
          return;
        }
        p = G.sim.addPlayer({ id: msg.id, name: msg.n, colorIdx: msg.c });
        rebalanceBots();
        UI.addFeedText('<b>' + esc(p.name) + '</b> <span style="opacity:.6">joined the room</span>');
        SA.Sound.pickup();
      }
      G.relay.pub({ t: 'w', id: msg.id, code: G.code, seed: G.world.seed, host: G.myName });
      G.relay.pub(G.sim.roster());
    } else if (msg.t === 'i') {
      G.sim.setInput(msg.id, msg);
      if (msg.pk) G.sim.pickSkill(msg.id, msg.pk);
      if (msg.ts) G.pongs.push([msg.id, msg.ts]);
    } else if (msg.t === 'pick') {
      G.sim.pickSkill(msg.id, msg.s);
    } else if (msg.t === 'bye') {
      var gone = G.sim.players[msg.id];
      if (gone) {
        UI.addFeedText('<b>' + esc(gone.name) + '</b> <span style="opacity:.6">left the room</span>');
        G.sim.removePlayer(msg.id);
        rebalanceBots();
      }
    }
  }

  function countHumans() {
    var n = 0;
    for (var id in G.sim.players) if (!G.sim.players[id].isBot) n++;
    return n;
  }

  function rebalanceBots() {
    var humans = countHumans();
    G.sim.fillBots(SA.clamp(G.bots, 0, Math.max(0, MAX_PLAYERS - humans)));
  }

  function dropStaleClients() {
    var ids = Object.keys(G.sim.players);
    for (var i = 0; i < ids.length; i++) {
      var p = G.sim.players[ids[i]];
      if (p.isBot || p.id === G.myId) continue;
      if (G.sim.time - p.lastSeen > 12) {
        UI.addFeedText('<b>' + esc(p.name) + '</b> <span style="opacity:.6">disconnected</span>');
        G.sim.removePlayer(p.id);
        rebalanceBots();
      }
    }
  }

  /* ------------------------------------------------------- client messages */
  function clientOnMessage(msg) {
    if (G.mode !== 'client') return;
    if (msg.t === 'w') {
      if (msg.id !== G.myId) return;
      if (!G.joined) {
        G.joined = true;
        clearInterval(G.joinTimer);
        if (msg.seed !== G.world.seed) makeWorld(msg.seed >>> 0);
        G.view.meId = G.myId;
        G.view.snapCam = true;
        ensureRenderer();
        UI.setRoom(G.code, inviteLink(G.code));
        UI.netStatus('Connected to room ' + G.code + '.', 'ok');
        UI.showScreen('game');
        UI.toast('Joined ' + esc(msg.host || 'the room') + "'s room");
        startLoop();
      }
    } else if (msg.t === 'full') {
      if (msg.id !== G.myId) return;
      UI.netStatus('That room is full.', 'err');
      UI.showScreen('lobby');
      shutdown();
    } else if (msg.t === 'r') {
      G.roster = {};
      for (var i = 0; i < msg.p.length; i++) {
        var r = msg.p[i];
        G.roster[r[0]] = { name: r[1], c: r[2], bot: !!r[3] };
      }
    } else if (msg.t === 's') {
      if (!G.joined) return;
      G.lastSnapAt = SA.now();
      G.snapBuf.push({ t: G.lastSnapAt, s: msg });
      while (G.snapBuf.length > 16) G.snapBuf.shift();
      if (msg.ev && msg.ev.length) applyEvents(msg.ev);
      if (msg.ys && msg.ys[G.myId]) setYou(SA.fillYou(msg.ys[G.myId]));
      if (msg.pg) {
        for (var j = 0; j < msg.pg.length; j++) {
          if (msg.pg[j][0] === G.myId) G.ping = Math.max(1, Date.now() - msg.pg[j][1]);
        }
      }
    } else if (msg.t === 'end') {
      UI.toast('The host closed the room.', 4000);
      UI.netStatus('The host closed the room.', 'err');
      shutdown();
      UI.showScreen('lobby');
    }
  }

  /* ------------------------------------------------------------- you state */
  function setYou(you) {
    G.you = you;
    UI.updateHud(you);
    var hasCards = !!(you.cards && you.cards.length);
    if (G.pendingPick && !hasCards) G.pendingPick = null;

    if (hasCards && !G.pendingPick) {
      var sig = you.cards.join(',') + '@' + you.level;
      if (G.shownCards !== sig) {
        G.shownCards = sig;
        UI.showCards({ skills: you.skills }, you.cards, you.level);
      }
      UI.setCardTimer(you.cardEnds);
    } else if (G.shownCards) {
      G.shownCards = null;
      UI.hideCards();
    }
    UI.setDeath(!you.alive, you.killedBy, you.respawnIn);
  }

  function pickSkill(id) {
    if (G.mode === 'client') {
      /* relay messages are fire-and-forget, so keep asking until the host
         confirms by clearing our card offer */
      G.pendingPick = id;
      G.relay.pub({ t: 'pick', id: G.myId, s: id });
    } else if (G.sim) {
      G.sim.pickSkill(G.myId, id);
    }
    UI.hideCards();
    G.shownCards = null;
  }

  /* ---------------------------------------------------------------- events */
  var lastShotSfx = 0;
  function applyEvents(evs) {
    var fx = G.renderer && G.renderer.fx;
    if (!fx) return;
    var me = G.myId;
    for (var i = 0; i < evs.length; i++) {
      var e = evs[i];
      var col = SA.COLORS[(e.c || 0) % SA.COLORS.length];
      switch (e.t) {
        case 'shot':
          fx.spark(e.x + Math.cos(e.a / 100) * 22, e.y + Math.sin(e.a / 100) * 22, col, 3, 90);
          if (performance.now() - lastShotSfx > 45) { lastShotSfx = performance.now(); SA.Sound.shoot(); }
          break;
        case 'spark': fx.spark(e.x, e.y, col, 4, 130); break;
        case 'hit':
          fx.spark(e.x, e.y, col, 5, 160);
          if (e.d >= 3) fx.text(e.x + (Math.random() - 0.5) * 18, e.y - 12, '-' + e.d, '#ffd7a1');
          SA.Sound.hit();
          break;
        case 'boom':
          fx.boom(e.x, e.y, e.r || 60, e.small ? SA.COLORS[0] : null);
          if (!e.small) SA.Sound.explode();
          break;
        case 'beam': fx.beam(e.x0, e.y0, e.x1, e.y1, col); break;
        case 'spawn': fx.ring(e.x, e.y, 48, col); break;
        case 'kill':
          UI.addKillFeed(e);
          if (e.ai === me) { SA.Sound.kill(); fx.text(e.x || 0, e.y || 0, '', '#fff'); }
          else if (e.bi === me) SA.Sound.hurt();
          break;
        case 'lvl':
          if (e.id === me) {
            SA.Sound.levelup();
            UI.toast('Level ' + e.level + '! Choose a new skill');
          } else {
            UI.addFeedText('<b style="color:' + col + '">' + esc(e.name) + '</b> <span style="opacity:.6">reached level ' + e.level + '</span>');
          }
          break;
        case 'took':
          if (e.id !== me) {
            var d = SA.SKILL_BY_ID[e.skill];
            if (d) UI.addFeedText('<b style="color:' + col + '">' + esc(e.name) + '</b> <span style="opacity:.6">took</span> ' + d.icon + ' ' + d.name);
          }
          break;
        case 'sfx':
          if (SA.Sound[e.s]) SA.Sound[e.s]();
          break;
      }
    }
  }

  /* ------------------------------------------------------------------ loop */
  var running = false;
  function startLoop() {
    if (running) return;
    running = true;
    G.lastFrame = SA.now();
    requestAnimationFrame(frame);
  }

  function frame() {
    if (G.mode === 'idle') { running = false; return; }
    requestAnimationFrame(frame);

    var t = SA.now();
    var dt = Math.min(0.05, t - G.lastFrame);
    G.lastFrame = t;

    updateAim();

    if (G.mode === 'host' || G.mode === 'solo') hostFrame(dt);
    else clientFrame(dt);

    if (G.renderer && G.view) G.renderer.draw(G.view, dt);
  }

  /* Browsers stop animation frames in a hidden tab, which would freeze the
     room for everyone else. A worker timer keeps the host simulating. */
  function startKeepAlive() {
    if (G.keepAlive) return;
    var tick = function () {
      if (!document.hidden || G.mode !== 'host') return;
      var t = SA.now();
      var dt = Math.min(0.1, t - G.lastFrame);
      G.lastFrame = t;
      hostFrame(dt, true);
    };
    try {
      var src = 'var i=null;onmessage=function(e){if(e.data){i=setInterval(function(){postMessage(1)},20)}else{clearInterval(i)}}';
      var w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
      w.onmessage = tick;
      w.postMessage(1);
      G.keepAlive = { worker: w };
    } catch (e) {
      G.keepAlive = { timer: setInterval(tick, 40) };
    }
  }

  function stopKeepAlive() {
    if (!G.keepAlive) return;
    if (G.keepAlive.worker) { try { G.keepAlive.worker.terminate(); } catch (e) {} }
    if (G.keepAlive.timer) clearInterval(G.keepAlive.timer);
    G.keepAlive = null;
  }

  function updateAim() {
    if (!G.renderer || !G.view) return;
    var me = G.view.players[G.view.meId];
    if (!me) return;
    var z = G.renderer.zoom || 1;
    var sx = (me.rx - G.renderer.cam.x) * z;
    var sy = (me.ry - G.renderer.cam.y) * z;
    G.aim = Math.atan2(mouse.y - sy, mouse.x - sx);
  }

  function hostFrame(dt, headless) {
    var sim = G.sim;
    if (!sim) return;

    sim.setInput(G.myId, currentInput());
    var mp = sim.players[G.myId];
    if (mp) mp.lastSeen = sim.time;

    G.accum += dt;
    var steps = 0;
    while (G.accum >= FIXED && steps < 5) { sim.step(FIXED); G.accum -= FIXED; steps++; }
    if (G.accum > 0.25) G.accum = 0;

    var evs = sim.drainEvents();
    if (evs.length) {
      if (!headless) applyEvents(evs);
      if (G.mode === 'host') Array.prototype.push.apply(G.pendingEvents, evs);
    }

    if (!headless) {
      setYou(SA.fillYou(sim.playerState(G.myId) || {}));
      buildViewFromSim(sim);
    }

    if (G.mode === 'host') {
      dropStaleClients();
      G.snapAccum += dt;
      if (G.snapAccum >= 1 / CFG.SNAP_HZ) {
        G.snapAccum = 0;
        var snap = sim.snapshot(G.pendingEvents.splice(0, G.pendingEvents.length));
        var ys = {};
        for (var id in sim.players) {
          var p = sim.players[id];
          if (p.isBot || p.id === G.myId) continue;
          ys[id] = sim.playerState(id);
        }
        snap.ys = ys;
        if (G.pongs.length) { snap.pg = G.pongs.splice(0, G.pongs.length); }
        G.relay.pub(snap);
      }
      G.rosterAccum += dt;
      if (G.rosterAccum > 2.5) { G.rosterAccum = 0; G.relay.pub(sim.roster()); }
    }
  }

  function buildViewFromSim(sim) {
    var v = G.view;
    var seen = {};
    for (var id in sim.players) {
      var p = sim.players[id];
      var e = v.players[id];
      if (!e) e = v.players[id] = {};
      e.rx = p.x; e.ry = p.y; e.rang = p.angle;
      e.hp = p.hp; e.maxHp = p.st.maxHp; e.shield = p.shield; e.shieldMax = p.st.shieldMax;
      e.level = p.level; e.kills = p.kills; e.alive = p.alive; e.c = p.colorIdx;
      e.name = p.name; e.bot = p.isBot;
      e.flags = (p.alive ? 1 : 0) | (p.cloakT > 0 ? 2 : 0) | (p.dashT > 0 ? 4 : 0) |
        (p.isBot ? 8 : 0) | (p.iFrames > 0 ? 16 : 0) | (p.slowT > 0 ? 32 : 0) | (p.poisonT > 0 ? 64 : 0);
      seen[id] = 1;
    }
    for (var k in v.players) if (!seen[k]) delete v.players[k];

    v.bullets.length = 0;
    for (var i = 0; i < sim.bullets.length; i++) {
      var b = sim.bullets[i];
      v.bullets.push({ x: b.x, y: b.y, r: b.r, kind: b.kind, c: b.colorIdx, ang: Math.atan2(b.vy, b.vx) });
    }
    v.mines.length = 0;
    for (i = 0; i < sim.mines.length; i++) v.mines.push({ x: sim.mines[i].x, y: sim.mines[i].y, c: sim.mines[i].colorIdx });
    v.turrets.length = 0;
    for (i = 0; i < sim.turrets.length; i++) v.turrets.push({ x: sim.turrets[i].x, y: sim.turrets[i].y, ang: sim.turrets[i].angle, c: sim.turrets[i].colorIdx });
    v.pickups.length = 0;
    for (i = 0; i < sim.pickups.length; i++) v.pickups.push({ x: sim.pickups[i].x, y: sim.pickups[i].y, type: sim.pickups[i].type });

    updateScores(v);
  }

  /* ------------------------------------------------------------ client view */
  function idxPlayers(snap) {
    if (snap._pi) return snap._pi;
    var m = {};
    for (var i = 0; i < snap.p.length; i++) m[snap.p[i][0]] = snap.p[i];
    snap._pi = m;
    return m;
  }
  function idxBullets(snap) {
    if (snap._bi) return snap._bi;
    var m = {};
    for (var i = 0; i + 6 < snap.b.length; i += 7) m[snap.b[i]] = i;
    snap._bi = m;
    return m;
  }

  function clientFrame(dt) {
    /* send input on its own cadence */
    G.inputAccum = (G.inputAccum || 0) + dt;
    if (G.inputAccum >= 1 / CFG.INPUT_HZ) {
      G.inputAccum = 0;
      var inp = currentInput();
      inp.t = 'i'; inp.id = G.myId;
      if (G.pendingPick) inp.pk = G.pendingPick;
      if (SA.now() - (G.pingSentAt || 0) > 2) { G.pingSentAt = SA.now(); inp.ts = Date.now(); }
      G.relay.pub(inp);
    }

    if (SA.now() - G.lastSnapAt > 5 && G.joined) {
      UI.setPing('lost', true);
      if (SA.now() - G.lastSnapAt > 18) {
        UI.toast('Lost contact with the host.', 4000);
        UI.netStatus('Lost contact with the host — their tab may have closed.', 'err');
        shutdown();
        UI.showScreen('lobby');
        return;
      }
    } else {
      UI.setPing(G.ping ? G.ping + 'ms' : 'live', G.ping > 320);
    }

    var rt = SA.now() - INTERP;
    var a = null, b = null;
    for (var i = G.snapBuf.length - 1; i >= 0; i--) {
      if (G.snapBuf[i].t <= rt) { a = G.snapBuf[i]; b = G.snapBuf[i + 1] || null; break; }
    }
    if (!a) { a = G.snapBuf[0]; b = G.snapBuf[1] || null; }
    if (!a) return;
    var f = (b && b.t > a.t) ? SA.clamp((rt - a.t) / (b.t - a.t), 0, 1) : 0;

    var v = G.view;
    var pa = idxPlayers(a.s), pb = b ? idxPlayers(b.s) : null;
    var seen = {};
    for (var id in pa) {
      var A = pa[id], B = pb ? pb[id] : null;
      var e = v.players[id];
      if (!e) e = v.players[id] = {};
      var info = G.roster[id] || {};
      e.rx = B ? SA.lerp(A[1], B[1], f) : A[1];
      e.ry = B ? SA.lerp(A[2], B[2], f) : A[2];
      e.rang = B ? SA.angLerp(A[3] / 100, B[3] / 100, f) : A[3] / 100;
      e.hp = A[4]; e.maxHp = A[5]; e.shield = A[6]; e.shieldMax = Math.max(A[6], 1);
      e.level = A[7]; e.kills = A[8]; e.flags = A[9]; e.c = A[10];
      e.alive = !!(A[9] & 1);
      e.bot = !!(A[9] & 8);
      e.name = info.name || (e.bot ? 'Bot' : 'Player');
      seen[id] = 1;
    }
    for (var k in v.players) if (!seen[k]) delete v.players[k];

    predictSelf(dt, pa[G.myId]);

    /* bullets: interpolate by id so fast shots do not stutter */
    v.bullets.length = 0;
    var bi = b ? idxBullets(b.s) : null;
    for (i = 0; i + 6 < a.s.b.length; i += 7) {
      var arr = a.s.b;
      var x = arr[i + 1], y = arr[i + 2];
      if (bi) {
        var j = bi[arr[i]];
        if (j != null) { x = SA.lerp(x, b.s.b[j + 1], f); y = SA.lerp(y, b.s.b[j + 2], f); }
      }
      v.bullets.push({ x: x, y: y, r: arr[i + 3], kind: arr[i + 4], c: arr[i + 5], ang: arr[i + 6] / 100 });
    }
    v.mines.length = 0;
    for (i = 0; i + 2 < a.s.m.length; i += 3) v.mines.push({ x: a.s.m[i], y: a.s.m[i + 1], c: a.s.m[i + 2] });
    v.turrets.length = 0;
    for (i = 0; i + 3 < a.s.u.length; i += 4) v.turrets.push({ x: a.s.u[i], y: a.s.u[i + 1], ang: a.s.u[i + 2] / 100, c: a.s.u[i + 3] });
    v.pickups.length = 0;
    var pk = a.s.pk || [];
    for (i = 0; i + 2 < pk.length; i += 3) v.pickups.push({ x: pk[i], y: pk[i + 1], type: pk[i + 2] });

    updateScores(v);
  }

  /* Move our own dot immediately instead of waiting for the round trip,
     then ease back onto whatever the host says is true. */
  function predictSelf(dt, serverRow) {
    var me = G.view.players[G.myId];
    if (!me || !serverRow) return;
    var alive = !!(serverRow[9] & 1);
    if (!alive) { G.pred = null; return; }

    var speed = (G.you && G.you.spd) || CFG.BASE_SPEED;
    if (!G.pred) G.pred = { x: serverRow[1], y: serverRow[2] };

    var v = inputVector();
    var m = Math.hypot(v.ax, v.ay);
    if (m > 0.01) {
      var ax = v.ax / Math.max(1, m), ay = v.ay / Math.max(1, m);
      var np = G.world.collideCircle(G.pred.x + ax * speed * dt, G.pred.y + ay * speed * dt, CFG.PLAYER_R);
      G.pred.x = np.x; G.pred.y = np.y;
    }
    var d = SA.dist(G.pred.x, G.pred.y, serverRow[1], serverRow[2]);
    var pull = d > 150 ? 1 : Math.min(1, dt * 3.2);
    G.pred.x = SA.lerp(G.pred.x, serverRow[1], pull);
    G.pred.y = SA.lerp(G.pred.y, serverRow[2], pull);

    me.rx = G.pred.x; me.ry = G.pred.y; me.rang = G.aim;
  }

  var scoreTimer = 0;
  function updateScores(v) {
    scoreTimer -= 1;
    if (scoreTimer > 0) return;
    scoreTimer = 15;
    var rows = [];
    for (var id in v.players) {
      var p = v.players[id];
      rows.push({ name: p.name, level: p.level, kills: p.kills, c: p.c, me: id === v.meId, alive: p.alive, bot: p.bot });
    }
    rows.sort(function (x, y) { return (y.level - x.level) || (y.kills - x.kills); });
    UI.setScores(rows);
  }

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* ------------------------------------------------------------------ boot */
  function boot() {
    UI.init({
      create: function () { startHost(parseInt(document.getElementById('botRange').value, 10)); },
      join: function (code) { startClient(code); },
      solo: function () { startSolo(parseInt(document.getElementById('botRangeSolo').value, 10)); },
      pick: pickSkill,
      leave: function () { shutdown(); UI.showScreen('lobby'); UI.netStatus(''); },
      resize: function () { if (G.renderer) G.renderer.resize(); }
    });
    bindInput();

    var params = new URLSearchParams(location.search);
    var room = (params.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (room) {
      UI.showScreen('lobby');
      document.querySelector('.tab[data-tab="join"]').click();
      document.getElementById('joinCode').value = room;
      UI.netStatus('You were invited to room ' + room + '. Enter a name and press Join.', 'ok');
      document.getElementById('nameInput').focus();
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  SA.G = G;

})(window.SA);
