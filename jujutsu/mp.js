/* =========================================================================
   JUJUTSU BATTLEGROUND — ONLINE MODE
   Fight your friends in the same arena instead of the training dummies.

   This block is appended inside the game's own module, so it can reach the
   things the game already declares: player, enemies, Enemy, scene, THREE,
   makeAnimeRig, hurtPlayer, applyProjPlayer, updatePlayer, switchChar ...
   Every hook checks MP.active first, so the offline game is untouched.

   Each player owns their own health. When your attack lands on somebody, the
   hit is sent to them and they apply it to themselves, then tell everyone
   their new health — the same model the arena and Baldi games use.
   ========================================================================= */
(function () {
  'use strict';

  /* ----------------------------------------------------------------- relay */
  var BROKERS = [
    { url: 'wss://broker.emqx.io:8084/mqtt', name: 'relay 1' },
    { url: 'wss://broker.hivemq.com:8884/mqtt', name: 'relay 2' },
    { url: 'wss://test.mosquitto.org:8081/mqtt', name: 'relay 3' }
  ];
  var TOPIC_ROOT = 'jujutsu/v1/';
  var ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var SEND_HZ = 14;

  function uid() {
    return Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6);
  }
  function roomCode() {
    var out = '', buf = new Uint8Array(6);
    (window.crypto || window.msCrypto).getRandomValues(buf);
    for (var i = 0; i < 6; i++) out += ALPHABET[buf[i] % ALPHABET.length];
    return out;
  }
  function nowS() { return performance.now() / 1000; }

  function connectBroker(broker, timeoutMs) {
    return new Promise(function (resolve, reject) {
      if (!window.mqtt) return reject(new Error('no networking library'));
      var settled = false;
      var client = window.mqtt.connect(broker.url, {
        clientId: 'jj_' + uid(), keepalive: 30, connectTimeout: timeoutMs || 9000,
        reconnectPeriod: 4000, resubscribe: true, queueQoSZero: false, clean: true
      });
      var timer = setTimeout(function () {
        if (settled) return;
        settled = true;
        try { client.end(true); } catch (e) {}
        reject(new Error('no answer'));
      }, (timeoutMs || 9000) + 1500);
      client.on('connect', function () {
        if (settled) return;
        settled = true; clearTimeout(timer); resolve(client);
      });
      client.on('error', function (err) {
        if (settled) return;
        settled = true; clearTimeout(timer);
        try { client.end(true); } catch (e) {}
        reject(err);
      });
    });
  }

  /* Everyone talks on one topic here: this game is a free-for-all brawl and
     each fighter owns their own health, so there is no host to route through. */
  function Relay() {
    this.conns = []; this.selfId = uid(); this.outSeq = 0;
    this.lastSeq = {}; this.senderConn = {}; this.connected = false;
  }
  Relay.prototype.start = function (opts) {
    var self = this;
    this.onMsg = opts.onMsg;
    this.onStatus = opts.onStatus || function () {};
    this.topic = TOPIC_ROOT + opts.code + '/all';
    return new Promise(function (resolve, reject) {
      var pending = BROKERS.length, done = false, errs = [];
      BROKERS.forEach(function (b) {
        connectBroker(b, 9000).then(function (client) {
          self.attach(client, b); pending--;
          if (!done) { done = true; self.connected = true; resolve(opts.code); }
        }).catch(function (e) {
          errs.push(b.name + ' ' + ((e && e.message) || 'blocked')); pending--;
          if (!pending && !done) reject(new Error(errs.join(', ')));
        });
      });
    });
  };
  Relay.prototype.attach = function (client, broker) {
    var self = this;
    client.__name = broker.name;
    this.conns.push(client);
    client.subscribe(this.topic, { qos: 0 }, function () {});
    client.on('message', function (t, payload) { self.handle(payload, client); });
    client.on('connect', function () { client.subscribe(self.topic, { qos: 0 }, function () {}); self.report(); });
    client.on('close', function () { self.report(); });
    this.report();
  };
  Relay.prototype.live = function () {
    var out = [];
    for (var i = 0; i < this.conns.length; i++) if (this.conns[i].connected) out.push(this.conns[i].__name);
    return out;
  };
  Relay.prototype.report = function () {
    var live = this.live();
    this.onStatus(live.length ? 'online' : 'off',
      live.length ? 'connected via ' + live.join(' + ') : 'reconnecting…');
  };
  Relay.prototype.handle = function (payload, client) {
    var msg;
    try { msg = JSON.parse(payload.toString()); } catch (e) { return; }
    if (!msg.__s || msg.__s === this.selfId) return;      // never hear ourselves
    var last = this.lastSeq[msg.__s] || 0;
    if (msg.__q <= last) return;                          // already had it elsewhere
    this.lastSeq[msg.__s] = msg.__q;
    this.senderConn[msg.__s] = client;
    if (this.onMsg) this.onMsg(msg);
  };
  Relay.prototype.targets = function () {
    var list = [];
    for (var k in this.senderConn) {
      var c = this.senderConn[k];
      if (c && c.connected && list.indexOf(c) < 0) list.push(c);
    }
    return list.length ? list : this.conns;
  };
  Relay.prototype.pub = function (obj) {
    if (!this.conns.length) return;
    obj.__s = this.selfId; obj.__q = ++this.outSeq;
    var text = JSON.stringify(obj), to = this.targets();
    for (var i = 0; i < to.length; i++) {
      if (!to[i].connected) continue;
      try { to[i].publish(this.topic, text, { qos: 0 }); } catch (e) {}
    }
  };
  Relay.prototype.stop = function () {
    this.connected = false;
    var conns = this.conns; this.conns = [];
    conns.forEach(function (c) {
      try { c.end(false); setTimeout(function () { try { c.end(true); } catch (e) {} }, 1000); }
      catch (e) { try { c.end(true); } catch (e2) {} }
    });
  };

  /* ------------------------------------------------------------------ state */
  var MP = window.MPJJ = {
    active: false, code: null, id: uid(), name: '',
    relay: null, fighters: {},        // id -> { id, name, char, e (Enemy), tx, tz, tyaw, ... }
    sendAcc: 0, kills: 0, deaths: 0, joined: false,
    map: 'plate', host: false
  };

  function el(id) { return document.getElementById(id); }

  /* ------------------------------------------------------------------- UI */
  function injectUI() {
    var css = document.createElement('style');
    css.textContent = [
      '#jjLobby{position:fixed;inset:0;z-index:60;display:none;align-items:center;justify-content:center;',
      'background:radial-gradient(ellipse at 50% 0%,rgba(154,28,46,.38),transparent 52%),rgba(8,7,11,.94);',
      'color:#efe6d4;font-family:Barlow,"Segoe UI",Arial,sans-serif}',
      '#jjLobby .box{width:min(640px,94vw);background:linear-gradient(180deg,rgba(16,12,12,.92),rgba(8,7,10,.92));',
      'border:1px solid rgba(212,180,90,.4);padding:28px 26px;',
      'box-shadow:0 24px 60px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,230,160,.1)}',
      '#jjLobby h2{margin:0 0 6px;font-family:Cinzel,serif;font-size:26px;letter-spacing:3px;color:#f3dd8c}',
      '#jjLobby .sub{color:#b6aa94;font-size:13px;line-height:1.55;margin-bottom:16px}',
      '#jjLobby label{display:block;font-family:Cinzel,serif;font-size:10px;letter-spacing:2px;color:#d4b45a;margin:12px 0 5px}',
      '#jjLobby input{width:100%;background:#0b090c;border:1px solid rgba(212,180,90,.28);color:#efe6d4;',
      'padding:11px 12px;font:inherit;font-size:15px;text-transform:uppercase;border-radius:0}',
      '#jjLobby input:focus{outline:none;border-color:#f3dd8c}',
      '#jjLobby .row{display:flex;gap:8px;margin-top:14px}',
      '#jjLobby button{flex:1;background:linear-gradient(180deg,#f3dd8c,#c9a24a);border:1px solid #d4b45a;',
      'color:#1a1208;padding:12px;font-family:Cinzel,serif;font-size:13px;font-weight:700;',
      'cursor:pointer;letter-spacing:1.4px;border-radius:0}',
      '#jjLobby button.ghost{background:transparent;color:#f3dd8c}',
      '#jjLobby .code{font-family:Cinzel,serif;font-size:30px;letter-spacing:8px;text-align:center;color:#f3dd8c;margin:10px 0}',
      '#jjLobby .list{background:#0b090c;border:1px solid rgba(212,180,90,.22);padding:10px;',
      'margin-top:12px;font-size:13px;min-height:58px}',
      '#jjStatus{font-size:12px;color:#9a9080;margin-top:12px;min-height:16px}',
      '#jjStatus.err{color:#ff8f84}',
      '#jjMaps{display:grid;grid-template-columns:1fr;gap:8px;margin:8px 0 4px}',
      '#jjMaps button{display:block;text-align:left;padding:10px 12px;background:transparent;',
      'border:1px solid rgba(212,180,90,.28);color:#efe6d4;cursor:pointer;font:inherit;border-radius:0}',
      '#jjMaps button.on{border-color:#f3dd8c;background:rgba(40,28,12,.7)}',
      '#jjMaps .mn{display:block;font-family:Cinzel,serif;letter-spacing:1.6px;color:#f3dd8c;font-size:12px}',
      '#jjMaps .ms{display:block;font-size:11px;color:#9a9080;margin-top:3px;line-height:1.35}',
      '#jjMapNow{font-family:Cinzel,serif;letter-spacing:2px;color:#f3dd8c;text-align:center;margin:8px 0 2px}',
      '#jjScore{position:fixed;right:14px;top:96px;z-index:20;display:none;min-width:186px;',
      'background:rgba(8,7,10,.72);border:1px solid rgba(212,180,90,.28);',
      'padding:8px 10px;font:12px/1.6 Barlow,"Segoe UI",Arial,sans-serif;color:#efe6d4}',
      '#jjScore .hd{font-family:Cinzel,serif;font-size:10px;letter-spacing:2px;color:#d4b45a;margin-bottom:4px}',
      '#jjScore .r{display:flex;gap:8px}',
      '#jjScore .r .n{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '#jjScore .r.me .n{color:#f3dd8c;font-weight:700}',
      '#jjFeed{position:fixed;left:14px;bottom:110px;z-index:20;display:flex;flex-direction:column-reverse;',
      'gap:4px;font:12px Barlow,"Segoe UI",Arial,sans-serif;color:#efe6d4;max-width:320px}',
      '#jjFeed div{background:rgba(8,7,10,.75);border:1px solid rgba(212,180,90,.18);padding:4px 9px}',
      '#jjOnline{position:static;transform:none;background:transparent;border:1px solid #d4b45a;',
      'color:#f3dd8c;padding:13px 26px;cursor:pointer;min-width:220px;',
      'font:700 14px Cinzel,serif;letter-spacing:2.4px}',
      '#jjLook{position:fixed;inset:0;z-index:55;display:none;align-items:center;justify-content:center;',
      'background:rgba(6,5,8,.62);cursor:pointer;font-family:Barlow,"Segoe UI",Arial,sans-serif}',
      '#jjLook .c{background:linear-gradient(180deg,rgba(16,12,12,.94),rgba(8,7,10,.94));',
      'border:1px solid rgba(212,180,90,.4);padding:26px 38px;text-align:center}',
      '#jjLook b{display:block;font-family:Cinzel,serif;font-size:22px;letter-spacing:3px;color:#f3dd8c}',
      '#jjLook span{display:block;margin-top:8px;font-size:13px;color:#b6aa94}',
      'body.jjLocked,body.jjLocked *{cursor:none!important}',
      '#jjDragHint{position:fixed;left:50%;transform:translateX(-50%);bottom:66px;z-index:22;display:none;',
      'background:rgba(8,12,22,.8);border:1px solid rgba(127,212,255,.35);border-radius:8px;',
      'padding:6px 14px;font:13px "Segoe UI",Arial,sans-serif;color:#cfe6ff;pointer-events:none}',
      '#jjDragHint b{color:#7fd4ff}',
      '#jjPopOut{display:none;margin-top:14px;background:#123a2c;border:1px solid #2f7d5c;',
      'border-radius:10px;padding:12px 14px;font-size:13px;color:#bff0d8;line-height:1.5}',
      '#jjPopOut button{width:100%;margin-top:10px;background:#2f9d6a;border:0;color:#fff;',
      'border-radius:8px;padding:11px;font:inherit;font-size:14px;font-weight:700;cursor:pointer}',
      '#jjPopBtn2{position:fixed;left:50%;transform:translateX(-50%);bottom:104px;z-index:23;display:none;',
      'background:#2f9d6a;border:0;color:#fff;border-radius:8px;padding:9px 18px;cursor:pointer;',
      'font:700 13px "Segoe UI",Arial,sans-serif}',

      /* ---- spawn cutscene ---- */
      '#jjCine{position:fixed;inset:0;z-index:45;display:none;pointer-events:none;opacity:0;',
      'transition:opacity .35s;font-family:"Finger Paint","Segoe UI",cursive}',
      '#jjCine.on{opacity:1}',
      '#jjCine .bar{position:absolute;left:0;right:0;height:12vh;background:#000;transition:transform .5s cubic-bezier(.2,.9,.2,1)}',
      '#jjCine .bar.t{top:0;transform:translateY(-100%)}',
      '#jjCine .bar.b{bottom:0;transform:translateY(100%)}',
      '#jjCine.on .bar.t,#jjCine.on .bar.b{transform:translateY(0)}',
      '#jjCine .lines{position:absolute;inset:0;opacity:.22;background:repeating-linear-gradient(',
      '100deg,transparent 0 22px,rgba(255,255,255,.75) 22px 24px);animation:jjZip .55s linear infinite}',
      '@keyframes jjZip{from{background-position:0 0}to{background-position:120px 0}}',
      '#jjCineCard{position:absolute;left:6vw;bottom:20vh;transform:scale(2.6) rotate(-7deg);opacity:0}',
      '#jjCineCard.slam{animation:jjSlam .55s cubic-bezier(.15,1.3,.3,1) forwards}',
      '@keyframes jjSlam{0%{transform:scale(2.6) rotate(-7deg);opacity:0}',
      '60%{transform:scale(.94) rotate(-2.4deg);opacity:1}100%{transform:scale(1) rotate(-2.4deg);opacity:1}}',
      '#jjCineName{font-size:clamp(30px,6.4vw,74px);line-height:1;color:#fff;',
      '-webkit-text-stroke:3px #000;text-shadow:6px 6px 0 rgba(0,0,0,.55)}',
      '#jjCineSub{margin-top:6px;font-size:clamp(12px,1.7vw,20px);letter-spacing:6px;color:#fff;',
      '-webkit-text-stroke:1px #000;text-shadow:3px 3px 0 rgba(0,0,0,.5)}',
      '#jjCineSay{position:absolute;left:0;right:0;bottom:14.5vh;text-align:center;',
      'font-size:clamp(16px,2.5vw,30px);color:#fff;text-shadow:3px 3px 0 #000,0 0 22px rgba(120,190,255,.7);',
      'opacity:0}',
      '#jjCineSay.on{animation:jjSay 2.1s ease forwards}',
      '@keyframes jjSay{0%{opacity:0;transform:translateY(14px)}12%{opacity:1;transform:translateY(0)}',
      '78%{opacity:1}100%{opacity:0}}',
      '#jjCineSkip{position:absolute;right:2vw;bottom:13.5vh;font:12px "Segoe UI",Arial,sans-serif;',
      'color:rgba(255,255,255,.5);letter-spacing:1px}',
      '#jjWhite{position:fixed;inset:0;z-index:56;background:#fff;opacity:0;pointer-events:none}',
      '#jjInf{position:fixed;right:22px;top:64px;z-index:24;display:none;font:700 30px "Segoe UI",Arial;',
      'color:#7fd4ff;text-shadow:0 0 14px rgba(127,212,255,.9),2px 2px 0 #000}',
      '.jjInfBar{background:linear-gradient(90deg,#7fd4ff,#ffffff)!important;',
      'box-shadow:0 0 16px rgba(127,212,255,.9)}'
    ].join('');
    document.head.appendChild(css);

    var wrap = document.createElement('div');
    wrap.innerHTML = [
      '<div id="jjLobby"><div class="box">',
      '  <h2>ONLINE MATCH</h2>',
      '  <div class="sub">Pick a map, create a room, or join one. Dummies step out when the match',
      '    starts, and C still switches fighter. The creator\'s map is the one everybody gets.</div>',
      '  <label>YOUR NAME</label><input id="jjName" maxlength="10" placeholder="PLAYER">',
      '  <div id="jjJoinBox">',
      '    <label>MAP — THE CREATOR PICKS</label>',
      '    <div id="jjMaps"></div>',
      '    <label>ROOM CODE (leave empty to create one)</label>',
      '    <input id="jjCode" maxlength="6" placeholder="E.G. K4RM2P">',
      '    <div class="row"><button id="jjCreate">CREATE A ROOM</button>',
      '    <button id="jjJoin" class="ghost">JOIN A ROOM</button></div>',
      '  </div>',
      '  <div id="jjRoomBox" style="display:none">',
      '    <label>ROOM CODE — TELL YOUR FRIENDS</label>',
      '    <div class="code" id="jjCodeOut">------</div>',
      '    <div id="jjMapNow">THE BASEPLATE</div>',
      '    <div class="list" id="jjList"></div>',
      '    <div class="row"><button id="jjFight">ENTER THE ARENA</button>',
      '    <button id="jjLeave" class="ghost">LEAVE</button></div>',
      '  </div>',
      '  <div id="jjPopOut">This page is embedded, so the browser will not let the game hold',
      '    the mouse. Opening it in its own window fixes that.',
      '    <button id="jjPopBtn">OPEN IN A FULL WINDOW</button></div>',
      '  <div id="jjStatus"></div>',
      '  <div class="row"><button id="jjBack" class="ghost">BACK</button></div>',
      '</div></div>',
      '<div id="jjScore"></div>',
      '<div id="jjFeed"></div>',
      '<div id="jjLook"><div class="c"><b>CLICK TO LOOK AROUND</b>',
      '<span>mouse looks · Esc frees the cursor</span></div></div>',
      '<div id="jjDragHint">hold <b>RIGHT MOUSE</b> and move to look around</div>',
      '<button id="jjPopBtn2">open in a full window for proper mouse look</button>',
      '<div id="jjCine">',
      '  <div class="bar t"></div><div class="bar b"></div>',
      '  <div class="lines"></div>',
      '  <div id="jjCineCard"><div id="jjCineName">—</div><div id="jjCineSub">—</div></div>',
      '  <div id="jjCineSay"></div>',
      '  <div id="jjCineSkip">any key to skip</div>',
      '</div>',
      '<div id="jjWhite"></div>',
      '<div id="jjInf">\u221e</div>'
    ].join('');
    while (wrap.firstChild) document.body.appendChild(wrap.firstChild);

    var btn = document.createElement('button');
    btn.id = 'jjOnline';
    btn.textContent = 'ONLINE MATCH';
    var host = document.querySelector('#menu .menu-actions') || el('menu');
    if (host) host.appendChild(btn);
    btn.addEventListener('click', function (e) {
      e.stopPropagation();                       // the menu itself starts the offline game
      openLobby();
    });

    fillMapPick();
    el('jjBack').addEventListener('click', closeLobby);
    el('jjCreate').addEventListener('click', function () { createRoom(); });
    el('jjJoin').addEventListener('click', function () { joinRoom(); });
    el('jjLeave').addEventListener('click', function () { leaveRoom(); openLobby(); });
    el('jjFight').addEventListener('click', function () { enterArena(); });
    el('jjCode').addEventListener('keydown', function (e) { if (e.key === 'Enter') joinRoom(); });

    /* An embedded page cannot be granted pointer lock, but a pop-up opened
       from it is a fresh top level window that is not sandboxed — and there
       the mouse locks normally. */
    if (window.top !== window.self) el('jjPopOut').style.display = 'block';
    el('jjPopBtn').addEventListener('click', popOut);
    el('jjPopBtn2').addEventListener('click', popOut);

    /* The game drops back to its title screen whenever pointer lock is lost.
       During a match that reads as "you left the room", so it is kept shut and
       a small card hands the mouse back instead. */
    el('jjLook').addEventListener('mousedown', function (e) {
      e.preventDefault();
      e.stopPropagation();                       // do not throw a punch while re-locking
      grabMouse();
    });
    document.addEventListener('pointerlockchange', lookWatch);
    document.addEventListener('pointerlockerror', function () {
      /* Google Apps Script frames the page with a sandbox that has no
         allow-pointer-lock, so the lock can never be granted there. Rather
         than leave the player unable to turn, switch to drag-look. */
      MP.lockBlocked = true;
      lookWatch();
    });
    bindDragLook();
    setInterval(lookWatch, 200);
  }

  function grabMouse() {
    var cv = renderer.domElement;
    if (!cv || !cv.requestPointerLock) { MP.lockBlocked = true; lookWatch(); return; }
    var pr = null;
    try { pr = cv.requestPointerLock({ unadjustedMovement: true }); }
    catch (e) { MP.lockBlocked = true; lookWatch(); return; }
    if (pr && pr.catch) {
      pr.catch(function () {
        var p2;
        try { p2 = cv.requestPointerLock(); } catch (e2) { MP.lockBlocked = true; lookWatch(); return; }
        if (p2 && p2.catch) p2.catch(function () { MP.lockBlocked = true; lookWatch(); });
      });
    }
  }

  function lookWatch() {
    if (!MP.active) { document.body.classList.remove('jjLocked'); return; }
    var m = el('menu');
    if (m && m.style.display !== 'none') m.style.display = 'none';
    var isLocked = document.pointerLockElement === renderer.domElement;
    document.body.classList.toggle('jjLocked', isLocked || MP.dragging);
    /* three states: locked and playing, able to lock but loose, or a page
       that will never grant it — the last one gets drag-look */
    el('jjLook').style.display = (isLocked || MP.lockBlocked) ? 'none' : 'flex';
    var showDrag = !isLocked && MP.lockBlocked && !MP.dragging;
    el('jjDragHint').style.display = showDrag ? 'block' : 'none';
    el('jjPopBtn2').style.display = (showDrag && window.top !== window.self) ? 'block' : 'none';
  }

  /* Hold the right button and move: the same relative movement drives the
     camera, and letting go and re-gripping works like lifting a mouse. */
  function bindDragLook() {
    var canLook = function () {
      return MP.active && document.pointerLockElement !== renderer.domElement;
    };
    window.addEventListener('mousedown', function (e) {
      if (!canLook() || (e.button !== 2 && e.button !== 1)) return;
      MP.dragging = true;
      document.body.classList.add('jjLocked');
      el('jjDragHint').style.display = 'none';
      e.preventDefault(); e.stopImmediatePropagation();
    }, true);
    window.addEventListener('mouseup', function (e) {
      if (!MP.dragging || (e.button !== 2 && e.button !== 1)) return;
      MP.dragging = false;
      document.body.classList.remove('jjLocked');
      lookWatch();
      e.preventDefault(); e.stopImmediatePropagation();
    }, true);
    window.addEventListener('mousemove', function (e) {
      if (!MP.dragging || !canLook()) return;
      camYaw -= (e.movementX || 0) * .0032;
      camPitch = Math.max(-.5, Math.min(1.1, camPitch + (e.movementY || 0) * .0026));
      e.preventDefault(); e.stopImmediatePropagation();
    }, true);
    window.addEventListener('contextmenu', function (e) { if (MP.active) e.preventDefault(); });
  }

  /* Google's frame URL renders nothing on its own, so the new window is
     opened blank and the page is written into it. A written about:blank
     window escapes the sandbox, which is what lets the mouse lock there. */
  function popOut() {
    var w = null;
    try { w = window.open('', '_blank', 'width=1280,height=820'); } catch (e) {}
    if (!w) {
      status('Your browser blocked the pop-up — allow pop-ups for this page and try again.', true);
      return;
    }
    var self = document.getElementById('__selfDoc');
    try {
      if (self && self.textContent.length > 500) {
        /* the copy stores its own closing script tags escaped, so they have
           to be restored before the parser sees them; and a written window has
           no URL of its own, so it needs a base for parts loaded by path */
        var doc = self.textContent.split('<\\/script').join('</script')
          .replace('<head>', '<head><base href="' + location.href.split('#')[0] + '">');
        w.document.open();
        w.document.write(doc);
        w.document.close();
      } else {
        w.location.href = location.href;      // not the embedded build
      }
    } catch (e) {
      status('Could not open the window: ' + (e.message || e), true);
      return;
    }
    status('Opened in a new window. Join the room from there.');
  }

  function status(text, bad) {
    var s = el('jjStatus');
    s.textContent = text || '';
    s.className = bad ? 'err' : '';
  }
  function openLobby() {
    el('jjLobby').style.display = 'flex';
    el('jjJoinBox').style.display = '';
    el('jjRoomBox').style.display = 'none';
    status('');
    try { el('jjName').value = localStorage.getItem('jj_name') || ''; } catch (e) {}
  }
  function closeLobby() { el('jjLobby').style.display = 'none'; }

  function myName() {
    var v = (el('jjName').value || '').trim().toUpperCase().slice(0, 10);
    if (!v) v = 'PLAYER' + Math.floor(Math.random() * 90 + 10);
    try { localStorage.setItem('jj_name', v); } catch (e) {}
    return v;
  }

  function fillMapPick() {
    var host = el('jjMaps');
    if (!host) return;
    host.innerHTML = '';
    var maps = (window.JJMAP && window.JJMAP.list) || [
      { id: 'plate', name: 'THE BASEPLATE', sub: 'a grid, and room to fight on it' }
    ];
    maps.forEach(function (m) {
      var b = document.createElement('button');
      b.type = 'button';
      b.dataset.map = m.id;
      if (m.id === MP.map) b.className = 'on';
      b.innerHTML = '<span class="mn">' + m.name + '</span><span class="ms">' + m.sub + '</span>';
      b.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        MP.map = m.id;
        host.querySelectorAll('button').forEach(function (x) {
          x.classList.toggle('on', x.dataset.map === m.id);
        });
      });
      host.appendChild(b);
    });
  }

  function mapName(id) {
    return (window.JJMAP && window.JJMAP.nameOf) ? window.JJMAP.nameOf(id) : 'THE BASEPLATE';
  }

  function applyMap(id, fromPeer) {
    if (!id) return;
    if (fromPeer && MP.host) {
      if (MP.relay) MP.relay.pub(hello('map'));
      return;
    }
    MP.map = id;
    if (window.JJMAP) window.JJMAP.load(id);
    var now = el('jjMapNow');
    if (now) now.textContent = mapName(id);
  }

  function hello(kind) {
    return { t: kind || 'hi', id: MP.id, n: MP.name, c: player.char, map: MP.map };
  }

  function createRoom() {
    MP.name = myName();
    MP.host = true;
    var picked = document.querySelector('#jjMaps button.on');
    if (picked && picked.dataset.map) MP.map = picked.dataset.map;
    applyMap(MP.map, false);
    var code = (el('jjCode').value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '') || roomCode();
    connect(code);
  }
  function joinRoom() {
    var code = (el('jjCode').value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length < 4) { status('Type the room code your friend sent you.', true); return; }
    MP.name = myName();
    MP.host = false;
    connect(code);
  }

  function connect(code) {
    status('Connecting…');
    el('jjCreate').disabled = el('jjJoin').disabled = true;
    MP.code = code;
    MP.relay = new Relay();
    MP.relay.start({
      code: code,
      onStatus: function (s, t) { if (!MP.active) status(t, s !== 'online'); },
      onMsg: onMessage
    }).then(function () {
      el('jjCreate').disabled = el('jjJoin').disabled = false;
      el('jjJoinBox').style.display = 'none';
      el('jjRoomBox').style.display = '';
      el('jjCodeOut').textContent = code;
      MP.joined = true;
      renderList();
      status('Room ' + code + ' is open. Anyone with the code can walk in.');
      applyMap(MP.map, false);
      MP.relay.pub(hello('hi'));
      if (MP.host) MP.relay.pub(hello('map'));
    }).catch(function (e) {
      el('jjCreate').disabled = el('jjJoin').disabled = false;
      status('Could not reach a relay (' + (e && e.message ? e.message : 'blocked') + ').', true);
    });
  }

  function leaveRoom() {
    if (MP.relay) {
      if (MP.relay.connected) MP.relay.pub({ t: 'bye', id: MP.id });
      MP.relay.stop();
    }
    for (var id in MP.fighters) dropFighter(id);
    MP.relay = null; MP.active = false; MP.joined = false; MP.fighters = {};
    MP.host = false;
    el('jjScore').style.display = 'none';
    el('jjFeed').innerHTML = '';
    el('jjLook').style.display = 'none';
    el('jjDragHint').style.display = 'none';
    el('jjPopBtn2').style.display = 'none';
    MP.dragging = false;
    document.body.classList.remove('jjLocked');
    CS.active = false;
    el('jjCine').style.display = 'none';
    el('jjCine').classList.remove('on');
    hudDuring(true);
    setInfinite(false);
  }

  function renderList() {
    var html = '<div><b style="color:#7fd4ff">' + MP.name + '</b> — you</div>';
    for (var id in MP.fighters) html += '<div><b>' + MP.fighters[id].name + '</b></div>';
    var n = Object.keys(MP.fighters).length;
    html += '<div style="color:#8b97b5;margin-top:6px">' +
      (n ? (n + 1) + ' fighters in the room.' : 'Waiting for someone to join…') + '</div>';
    el('jjList').innerHTML = html;
  }

  /* ------------------------------------------------------------ the arena */
  function enterArena() {
    MP.active = true;
    closeLobby();
    /* the training dummies leave: this is a duel now */
    for (var i = enemies.length - 1; i >= 0; i--) {
      if (enemies[i].net) continue;
      scene.remove(enemies[i].rig.root);
      enemies.splice(i, 1);
    }
    player.hp = player.maxHp; player.dead = false; player.proj = 0;
    applyMap(MP.map, false);
    var sp = (window.JJMAP && window.JJMAP.spawn) ? window.JJMAP.spawn() : { x: (Math.random() - .5) * 30, z: (Math.random() - .5) * 30 };
    player.pos.set(sp.x, 0, sp.z);
    collideWorld(player.pos, 1.2);
    el('jjScore').style.display = 'block';
    updateScore();
    feed('You entered room ' + MP.code + ' — ' + mapName(MP.map));
    if (window.__game && !window.__game.started) window.__game.start();
    var cv = renderer.domElement;
    if (cv && cv.requestPointerLock) { try { cv.requestPointerLock(); } catch (e) {} }
    MP.relay.pub(hello('hi'));
    if (MP.host) MP.relay.pub(hello('map'));
    setTag(player.rig, MP.name, player.char);
    MP.myChar = player.char;
    MP.wasDead = false;
    startCutscene();
  }

  /* ---------------------------------------------------------- name tags
     Who that is, over their head, in their fighter's colour. Drawn once
     into a canvas and carried on the rig, so it follows the body through
     everything the body does — including being thrown across the arena. */
  function nameTag(text, color) {
    var c = document.createElement('canvas');
    c.width = 320; c.height = 72;
    var g = c.getContext('2d');
    g.font = 'bold 40px "Finger Paint", "Segoe UI", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.lineWidth = 9;
    g.strokeStyle = 'rgba(0,0,0,.9)';
    g.strokeText(text, 160, 38);
    g.fillStyle = color || '#ffffff';
    g.fillText(text, 160, 38);
    var t = new THREE.CanvasTexture(c);
    t.needsUpdate = true;
    var s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: t, transparent: true, depthWrite: false, toneMapped: false
    }));
    s.scale.set(6.4, 1.44, 1);
    s.position.y = 7.7;
    s.renderOrder = 12;
    s.__tag = true;
    return s;
  }

  function setTag(rig, text, char) {
    if (!rig || !rig.root) return;
    if (rig.__tag) {
      rig.root.remove(rig.__tag);
      if (rig.__tag.material.map) rig.__tag.material.map.dispose();
      rig.__tag.material.dispose();
    }
    var col = (CHARS[char] && CHARS[char].glow) || '#ffffff';
    rig.__tag = nameTag(text, col);
    rig.root.add(rig.__tag);
  }
  MP.setTag = setTag;

  /* A remote fighter is a real Enemy, so every punch, Red, palm and frame the
     game already knows how to do lands on them without special cases. */
  function makeFighter(id, name, char) {
    var e = new Enemy(0, 0, 'dummy');
    e.net = { id: id };
    e.name = name;
    e.kind = 'remote';
    scene.remove(e.rig.root);
    e.rig = makeAnimeRig((CHARS[char] && CHARS[char].cfg) || GOJO_CFG);
    e.rig.root.add(e.hpSpr);
    scene.add(e.rig.root);
    e.maxHp = 100; e.hp = 100;
    e.drawBars();
    setTag(e.rig, name || '???', char);
    var f = { id: id, name: name, char: char, e: e, tx: 0, tz: 0, tyaw: 0, seen: nowS() };
    MP.fighters[id] = f;
    return f;
  }

  function dropFighter(id) {
    var f = MP.fighters[id];
    if (!f) return;
    if (f.aura) { f.aura.stop(); f.aura = null; }
    if (window.JJAW && window.JJAW.theme) window.JJAW.theme(false, id);
    if (f.e && f.e.rag && window.JJRAG) window.JJRAG.stop(f.e);
    var i = enemies.indexOf(f.e);
    if (i >= 0) enemies.splice(i, 1);
    scene.remove(f.e.rig.root);
    delete MP.fighters[id];
  }

  function fighterFor(id, name, char) {
    var f = MP.fighters[id];
    if (f && char && f.char !== char) { dropFighter(id); f = null; }   // they switched fighter
    if (!f) {
      f = makeFighter(id, name || '???', char || 'gojo');
      enemies.push(f.e);
      renderList();
      updateScore();
    }
    if (name && f.name !== name) { f.name = name; setTag(f.e.rig, name, f.char); }
    return f;
  }

  /* ------------------------------------------------------------- messages */
  function onMessage(m) {
    if (!m || !m.id || m.id === MP.id) return;
    if (m.t === 'map' && m.map) {
      applyMap(m.map, true);
      return;
    }
    if (m.t === 'hi') {
      var f = fighterFor(m.id, m.n, m.c);
      f.seen = nowS();
      feed('<b>' + esc(m.n || '???') + '</b> joined');
      if (m.map) applyMap(m.map, true);
      if (MP.relay) MP.relay.pub(hello('hi2'));
      return;
    }
    if (m.t === 'hi2') {
      fighterFor(m.id, m.n, m.c).seen = nowS();
      if (m.map) applyMap(m.map, true);
      return;
    }
    if (m.t === 'bye') {
      if (MP.fighters[m.id]) feed('<b>' + esc(MP.fighters[m.id].name) + '</b> left');
      dropFighter(m.id); renderList(); updateScore();
      return;
    }
    if (m.t === 's') {                                  // state
      var g = fighterFor(m.id, m.n, m.c);
      g.seen = nowS();
      g.tx = m.x; g.tz = m.z; g.tyaw = m.y / 100;
      g.ty = m.h / 10;
      if (g.e.pos.x === 0 && g.e.pos.z === 0) { g.e.pos.set(m.x, g.ty, m.z); }
      g.e.hp = m.hp; g.e.maxHp = m.mx || 100;
      /* Somebody else going down used to just hide their body, so only the
         player who died ever saw a corpse. Their body drops here too, and
         their own broadcast decides where it lands. */
      if (!!m.d !== !!g.down) {
        g.down = !!m.d;
        if (g.down && window.JJRAG) {
          var away = new THREE.Vector3(m.x - g.e.pos.x, 0, m.z - g.e.pos.z);
          if (away.lengthSq() < .04) away.set(Math.random() - .5, 0, Math.random() - .5);
          away.normalize().multiplyScalar(13);
          away.y = 9;
          window.JJRAG.start(g.e, away);
          if (g.e.rag) g.e.rag.pull = { x: m.x, z: m.z, y: g.ty };
        } else if (!g.down && window.JJRAG) {
          window.JJRAG.stop(g.e);
        }
      }
      if (g.e.rag) g.e.rag.pull = { x: m.x, z: m.z, y: g.ty };
      /* back on their feet: whatever is left of the last body goes */
      if (g.e.dead && !m.d && window.JJGORE) window.JJGORE.clear(g.e);
      g.e.dead = !!m.d;
      /* only hide them if there is no body to show */
      g.e.rig.root.visible = !m.d || !!g.e.rag;
      g.remoteFramed = !!m.f;
      /* animation state, replayed on their rig exactly as they see it */
      g.speed = (m.sp || 0) / 10;
      g.onGround = m.og !== 0;
      g.vy = (m.vv || 0) / 10;
      g.visYaw = (m.vy || 0) / 100;
      g.attack = m.at || 0;
      g.action = m.ac ? { type: m.ac, t: (m.ap || 0) / 100, dur: (m.ad || 1) / 100 } : null;
      /* Some poses are driven by which beat of the move they are on rather
         than by the clock alone, so the stage travels with the action.
         A finisher that has taken its caster over travels by name. */
      if (g.action && m.sg != null) g.action.stage = m.sg;
      if (g.action && m.fk) g.action.fin = m.fk;
      if (g.action && m.pf) { g.action.sprung = true; g.action.sprungAt = m.pf / 100; }
      if (g.action && m.ac === 'dash') {
        g.action.kind = m.dk || 'fwd';
        g.action.side = m.ds || 0;
        g.action.st = g.char;
        if (!g.dashedAt || nowS() - g.dashedAt > .5) {
          g.dashedAt = nowS();
          if (window.JJDASH) window.JJDASH.remote(g.char, g.e.pos.clone(), g.e.facing, m.dk);
        }
      }
      /* a flinch they are already playing: start ours from the same point.
         One that is already running is left alone — applyReact expires it on
         its own, so a packet that arrives mid-flinch cannot cut it short. */
      if (m.rk && (!g.e.react || g.e.react.type !== m.rk)) {
        g.e.react = { type: m.rk, t: (m.rt || 0) / 100, dur: (m.rd || 50) / 100, side: m.rs || 1 };
        /* somebody landed one on them somewhere else in the room: the two
           frames of white that goes with it should happen here too */
        if (window.JJHITS) window.JJHITS.flash(g.e.rig, 0xffffff, 1);
        if (m.rk === 'slash' || m.rk === 'dismantle') {
          window.JJFX.blood(g.e.pos.clone().add(new THREE.Vector3(0, 2.7, 0)),
            new THREE.Vector3(0, 1, 0), 5, 1.1);
        } else if (m.rk === 'burn') {
          window.JJFX.fire(g.e.pos.clone().add(new THREE.Vector3(0, 2, 0)), 5, 1, 2, .6);
        }
      }
      /* blindfold off, six eyes lit, cursed energy standing off them */
      if (!!m.aw !== !!g.aw) {
        g.aw = !!m.aw;
        if (window.JJAW) window.JJAW.remote(g, g.aw);
        if (g.aw) feed('<b>' + esc(g.name) + '</b> awakened');
      }
      /* and Hakari in fever, which is his awakening and looks like one */
      if (!!m.hf !== !!g.fever) {
        g.fever = !!m.hf;
        if (window.JJFEVER && window.JJFEVER.remoteAura) {
          window.JJFEVER.remoteAura(g, g.fever);
        }
        if (g.fever) feed('<b>' + esc(g.name) + '</b> hit the jackpot');
      }
      g.e.drawBars();
      return;
    }
    if (m.t === 'cast') {                               // somebody started a move
      var cf = MP.fighters[m.id];
      if (!cf || !cf.e) return;
      remoteFx(m.k, cf.e.pos.clone(), cf.e.facing, cf);
      /* their blindfold comes off partway through their entrance, not at
         the end of it, so it is applied on the same beat they see */
      if (m.k === 'awaken' && window.JJAW) {
        if (window.JJAW.theme) window.JJAW.theme(true, m.id);
        setTimeout(function () {
          if (MP.fighters[m.id] === cf) { cf.aw = true; window.JJAW.remote(cf, true); }
        }, 1300);
      }
      return;
    }
    if (m.t === 'hit' && m.to === MP.id) {              // somebody landed one on us
      var k = null;
      if (m.kx || m.ky || m.kz) k = new THREE.Vector3(m.kx || 0, m.ky || 0, m.kz || 0);
      /* how the body is meant to go if this is the one that does it —
         cut apart, burnt, or simply limp */
      if (m.dth && window.JJGORE) window.JJGORE.mark(player, m.dth);
      /* pinned by a stream: it holds for as long as it keeps arriving */
      if (m.pin) player.pinned = Math.max(player.pinned || 0, m.pin / 100);
      if (m.psn) player.psn = Math.max(player.psn || 0, m.psn / 10);
      if (m.rk && window.JJHITS) window.JJHITS.next(m.rk, m.rd || .5);
      hurtPlayer(m.d, k);
      /* the same flinch the dummies play, on us — but not while the hit is
         being shrugged off by spawn protection, and not on top of a hit
         heavy enough to have thrown us, which animates itself */
      var thrown = player.action && player.action.type === 'kb';
      if (m.rk && !player.dead && player.iframes <= 0 && !thrown) {
        player.react = { type: m.rk, t: 0, dur: m.rd || .5, side: m.rs || 1 };
      }
      MP.lastHitBy = m.id;
      if (player.dead) {
        MP.deaths++;
        if (MP.relay) MP.relay.pub({ t: 'died', id: MP.id, by: m.id });
        updateScore();
      }
      return;
    }
    if (m.t === 'proj' && m.to === MP.id) { applyProjPlayer(m.a); return; }
    if (m.t === 'ncine') {                              // their rush caught somebody
      if (m.to === MP.id) {
        if (window.JJNAOYA) window.JJNAOYA.remoteCine(m.id);
      } else {
        var na = MP.fighters[m.id], nv = MP.fighters[m.to];
        [na, nv].forEach(function (f, n) {
          if (!f || !f.e) return;
          var at = f.e.pos.clone();
          window.JJFX.beam(at.clone(), new THREE.Vector3(0, 1, 0), 34, 0x9fd8ff,
            { radius: 1.2, life: 1.4 });
          window.JJFX.rings(new THREE.Vector3(at.x, .12, at.z), 0xbfe6ff, 3,
            { maxR: 10, life: .8, gap: 70 });
          if (!f.finAura) {
            f.finAura = window.JJFX.aura(function () { return f.e.pos; }, 0x9fd8ff);
            setTimeout(function () {
              if (f.finAura) { f.finAura.stop(); f.finAura = null; }
            }, 30000);
          }
        });
      }
      return;
    }
    if (m.t === 'fin') {                                // a skill finished somebody
      var fv = m.to === MP.id ? null : MP.fighters[m.to];
      var fa = MP.fighters[m.id];
      var who = m.to === MP.id ? player : (fv && fv.e);
      if (who && window.JJFIN) {
        window.JJFIN.remote(who,
          m.k,
          new THREE.Vector3(m.x || who.pos.x, 0, m.z || who.pos.z),
          new THREE.Vector3(m.dx || 0, 0, m.dz || 1),
          m.to === MP.id);
      }
      feed('<b>' + esc(fa ? fa.name : '???') + '</b> finished <b>' +
        esc(m.to === MP.id ? MP.name : (fv ? fv.name : '???')) + '</b>');
      return;
    }
    if (m.t === 'gore') {                               // their body, coming apart
      var gf = MP.fighters[m.id];
      if (gf && gf.e && window.JJGORE) {
        window.JJGORE.remote(gf.e, m.s,
          new THREE.Vector3(m.dx || 0, 0, m.dz || 1));
      }
      return;
    }
    if (m.t === 'dom') {                                // a domain opened near us
      var who = MP.fighters[m.id];
      feed('<b>' + esc(who ? who.name : '???') + '</b> expanded a domain');
      var dc = new THREE.Vector3(m.x, 0, m.z);
      var inside = Math.hypot(player.pos.x - m.x, player.pos.z - m.z) <= (m.r || 34);
      /* The domain itself, not a puff of rings where one happened. Each of
         the three builds the same thing the caster built: the barrier from
         outside, the room from inside, and for the shrine — which has no
         barrier — the whole shrine, for everybody, wherever they stand. */
      var yaw = m.y == null ? 0 : m.y, dur = m.dur || 8;
      if (m.k === 'shrine' && window.JJSUKUNA && window.JJSUKUNA.remote) {
        window.JJSUKUNA.remote.shrine(dc, yaw, dur);
      } else if (m.k === 'gamble' && window.JJGAMBLE && window.JJGAMBLE.remote) {
        window.JJGAMBLE.remote(dc, yaw, dur);
      } else if (m.k === 'garden' && window.JJGARDEN && window.JJGARDEN.remote) {
        window.JJGARDEN.remote(dc, yaw, dur);
      } else if (window.JJVOID && window.JJVOID.remote) {
        window.JJVOID.remote(dc, yaw, dur);
      }
      if (inside && window.JJAW && !player.dead) window.JJAW.enterVoid(m.d || 2.3);
      return;
    }
    if (m.t === 'died') {
      var who = MP.fighters[m.id];
      var killer = m.by === MP.id ? { name: MP.name } : MP.fighters[m.by];
      if (m.by === MP.id) { MP.kills++; }
      feed('<b>' + esc(killer ? killer.name : '???') + '</b> defeated <b>' +
        esc(who ? who.name : '???') + '</b>');
      if (who) { who.kills = who.kills || 0; }
      if (MP.fighters[m.by]) MP.fighters[m.by].kills = (MP.fighters[m.by].kills || 0) + 1;
      if (who) who.deaths = (who.deaths || 0) + 1;
      updateScore();
      return;
    }
  }

  function feed(html) {
    var d = document.createElement('div');
    d.innerHTML = html;
    el('jjFeed').appendChild(d);
    while (el('jjFeed').children.length > 5) el('jjFeed').removeChild(el('jjFeed').firstChild);
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 7000);
  }

  function updateScore() {
    var rows = [{ n: MP.name, k: MP.kills, d: MP.deaths, me: true }];
    for (var id in MP.fighters) {
      var f = MP.fighters[id];
      rows.push({ n: f.name, k: f.kills || 0, d: f.deaths || 0 });
    }
    rows.sort(function (a, b) { return b.k - a.k; });
    var html = '<div class="hd">ROOM ' + (MP.code || '') + '</div>';
    rows.forEach(function (r) {
      html += '<div class="r' + (r.me ? ' me' : '') + '"><span class="n">' + esc(r.n) +
        '</span><span>' + r.k + '</span><span style="color:#8b97b5">' + r.d + '</span></div>';
    });
    el('jjScore').innerHTML = html;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* =======================================================================
     SPAWN CUTSCENE
     A short anime entrance for whichever fighter you are: letterbox bars,
     a close push-in on the face, the signature pose, cursed energy, the name
     card slamming in, two lines of dialogue — then two white flashes while
     the health bar reads infinity, because you cannot be touched yet.
     Skippable with any key or click.
     ===================================================================== */
  var CUT = {
    gojo: {
      glow: '#3a7dff', aura: 0x3a7dff,
      name: 'GOJO SATORU', sub: 'THE HONORED ONE',
      lines: [
        { t: 0.45, s: 'Throughout heaven and earth\u2026' },
        { t: 2.60, s: 'I alone am the honored one.' }
      ]
    },
    naoya: {
      glow: '#9fd8ff', aura: 0x9fd8ff,
      name: "NAOYA ZEN'IN", sub: 'PROJECTION SORCERY',
      lines: [
        { t: 0.45, s: 'Twenty-four frames a second.' },
        { t: 2.60, s: 'You will not see a single one of them.' }
      ]
    }
  };

  var CS = MP.cs = { active: false, t: 0, dur: 6.0, char: 'gojo', shot: 0, said: 0, framed: 0, orbit: 0 };

  function startCutscene() {
    if (!MP.active) return;
    CS.active = true; CS.t = 0; CS.said = 0; CS.framed = 0;
    CS.char = player.char;
    CS.orbit = player.facing + Math.PI;
    var d = CUT[CS.char] || CUT.gojo;
    player.vel.set(0, 0, 0);
    el('jjCine').style.display = 'block';
    el('jjCine').classList.add('on');
    hudDuring(false);                          // a cutscene wants a clean frame
    var card = el('jjCineCard');
    card.classList.remove('slam');
    el('jjCineName').textContent = d.name;
    el('jjCineName').style.color = d.glow;
    el('jjCineSub').textContent = d.sub;
    el('jjCineSay').textContent = '';
    el('jjCineSay').classList.remove('on');
    if (MP.relay) MP.relay.pub({ t: 'cast', id: MP.id, k: 'spawn' });
  }

  function endCutscene() {
    if (!CS.active) return;
    CS.active = false;
    el('jjCine').classList.remove('on');
    hudDuring(true);
    setTimeout(function () { if (!CS.active) el('jjCine').style.display = 'none'; }, 420);
    camYaw = CS.orbit;
    camPitch = .22;
    flashTwice();
  }

  /* two white flashes, and while they land the bar reads infinity — the
     spawn protection the flashes are announcing */
  function flashTwice() {
    var f = el('jjWhite');
    var pop = function (delay) {
      setTimeout(function () {
        f.style.transition = 'none'; f.style.opacity = '.92';
        setTimeout(function () { f.style.transition = 'opacity .22s'; f.style.opacity = '0'; }, 40);
      }, delay);
    };
    pop(0); pop(260);
    setInfinite(true);
    player.iframes = Math.max(player.iframes, 3);
    clearTimeout(CS.infT);
    CS.infT = setTimeout(function () { setInfinite(false); }, 3000);
  }

  function setInfinite(on) {
    var bar = el('hpFill');
    var mark = el('jjInf');
    if (mark) mark.style.display = on ? 'block' : 'none';
    if (bar) {
      bar.style.width = on ? '100%' : bar.style.width;
      bar.classList.toggle('jjInfBar', !!on);
    }
    MP.infinite = !!on;
  }

  var EASE = function (x) { return x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x); };

  function hudDuring(show) {
    ['hud', 'crosshair'].forEach(function (id) {
      var n = el(id);
      if (n) n.style.opacity = show ? '' : '0';
    });
    el('jjScore').style.opacity = show ? '' : '0';
    el('jjFeed').style.opacity = show ? '' : '0';
  }

  function stepCutscene(dt) {
    CS.t += dt;
    var d = CUT[CS.char] || CUT.gojo;
    var t = CS.t;

    /* Naoya is animated on twos — his whole gimmick is 24 frames a second */
    var gate = CS.char === 'naoya' ? 1 / 24 : 0;
    CS.framed += dt;
    var pose = gate === 0 || CS.framed >= gate;
    if (pose) CS.framed = 0;

    player.pos.y = 0;
    player.vel.set(0, 0, 0);
    player.iframes = Math.max(player.iframes, 1);

    if (pose) poseCutscene(t);
    player.rig.root.position.copy(player.pos);

    /* dialogue */
    while (CS.said < d.lines.length && t >= d.lines[CS.said].t) {
      var line = d.lines[CS.said++];
      var say = el('jjCineSay');
      say.textContent = line.s;
      say.classList.remove('on');
      void say.offsetWidth;                      // restart the animation
      say.classList.add('on');
    }

    /* cursed energy at the turn, and again under the name card */
    var FX = window.JJFX;
    if (t >= 2.15 && CS.shot < 1) {
      CS.shot = 1;
      if (FX) {
        FX.speedRing(player.pos.clone().add(new THREE.Vector3(0, 3, 0)), d.aura, 8, .38);
        FX.rings(player.pos.clone(), d.aura, 2, { maxR: 12, life: .55, gap: 60 });
        FX.dust(player.pos.clone(), 6, 0xd3dceb, 6, 2.6);
        FX.streaks(player.pos.clone().add(new THREE.Vector3(0, 2.6, 0)), d.aura, 14, 16, 1.4);
      }
      addShake(.25);
    }
    if (t >= 3.85 && CS.shot < 2) {
      CS.shot = 2;
      el('jjCineCard').classList.add('slam');
      if (FX) {
        FX.cross(player.pos.clone().add(new THREE.Vector3(0, 3.4, 0)), 0xffffff, 5, .3);
        FX.rings(player.pos.clone(), d.aura, 3, { maxR: 18, life: .6, gap: 55 });
        FX.ring(player.pos.clone().add(new THREE.Vector3(0, 2, 0)), 0xffffff, { maxR: 13, life: .45, ground: false });
        FX.debris(player.pos.clone(), 8, 12);
        FX.cracks(player.pos.clone(), 6, 8);
        FX.mangaLines(true, .3);
        FX.zoom(-8, .5);
      }
      addShake(.55);
      if (typeof sfx !== 'undefined' && sfx.raise) { try { sfx.raise(); } catch (e) {} }
    }
    /* a steady drip of aura the whole way through */
    if (Math.random() < .5) {
      var at = player.pos.clone().add(new THREE.Vector3(
        (Math.random() - .5) * 2.4, .3 + Math.random() * 4.2, (Math.random() - .5) * 2.4));
      if (FX) FX.streaks(at, d.aura, 1, 5, .9); else spark(at, d.aura, 1, 5, .9);
    }

    if (t >= CS.dur) endCutscene();
  }

  /* keyframed signature poses, lerped so they read as one continuous move */
  function poseCutscene(t) {
    var r = player.rig;
    resetPose(r);
    var gojo = CS.char !== 'naoya';
    if (gojo) {
      if (t < 1.8) {
        var k = EASE(t / 1.8);
        r.spine.rotation.x = .06 - .1 * k;
        r.neck.rotation.x = .22 - .3 * k;                 // head lifts
        r.shoulderL.rotation.x = -.18; r.elbowL.rotation.x = -.30;
        r.shoulderR.rotation.x = -.18; r.elbowR.rotation.x = -.30;
        r.spine.rotation.y = -.16 * (1 - k);
      } else if (t < 3.8) {
        var k2 = EASE((t - 1.8) / .8);                    // hand up, palm out
        r.shoulderR.rotation.x = -.18 - 2.05 * k2;
        r.elbowR.rotation.x = -.30 + .22 * k2;
        r.shoulderR.rotation.z = -.25 * k2;
        r.shoulderL.rotation.x = -.5 * k2 - .18;
        r.elbowL.rotation.x = -1.1 * k2 - .3;
        r.spine.rotation.y = -.30 * k2;
        r.neck.rotation.x = -.08 - .08 * k2;
      } else {
        var k3 = EASE((t - 3.8) / .7);                    // settle into the hero shot
        r.shoulderR.rotation.x = -2.23 + 2.0 * k3;
        r.shoulderR.rotation.z = -.25 + .25 * k3;
        r.elbowR.rotation.x = -.08 - .2 * k3;
        r.shoulderL.rotation.x = -.68 + .5 * k3;
        r.elbowL.rotation.x = -1.4 + 1.1 * k3;
        r.spine.rotation.y = -.30 + .30 * k3;
        r.spine.rotation.x = -.04;
        r.neck.rotation.x = -.16 + .1 * k3;
      }
    } else {
      if (t < 1.8) {                                      // arms folded, chin up
        var n1 = EASE(t / 1.2);
        r.shoulderL.rotation.x = -.95 * n1; r.elbowL.rotation.x = -1.45 * n1;
        r.shoulderR.rotation.x = -.95 * n1; r.elbowR.rotation.x = -1.45 * n1;
        r.shoulderL.rotation.z = .42 * n1; r.shoulderR.rotation.z = -.42 * n1;
        r.neck.rotation.x = -.2 * n1;
        r.spine.rotation.y = .14 * n1;
      } else if (t < 3.8) {                               // the arm sweeps out
        var n2 = EASE((t - 1.8) / .7);
        r.shoulderL.rotation.x = -.95 + .55 * n2; r.elbowL.rotation.x = -1.45 + .9 * n2;
        r.shoulderR.rotation.x = -.95 - .55 * n2;
        r.shoulderR.rotation.z = -.42 - .55 * n2;
        r.elbowR.rotation.x = -1.45 + 1.25 * n2;
        r.spine.rotation.y = .14 - .5 * n2;
        r.neck.rotation.x = -.2 + .06 * n2;
        r.hips.position.y = r.hipsBaseY - .08 * n2;
      } else {
        var n3 = EASE((t - 3.8) / .7);
        r.shoulderR.rotation.x = -1.5 + 1.3 * n3;
        r.shoulderR.rotation.z = -.97 + .87 * n3;
        r.elbowR.rotation.x = -.2 - .1 * n3;
        r.shoulderL.rotation.x = -.4 + .2 * n3;
        r.elbowL.rotation.x = -.55 + .25 * n3;
        r.spine.rotation.y = -.36 + .36 * n3;
        r.neck.rotation.x = -.14;
        r.hips.position.y = r.hipsBaseY - .08 + .08 * n3;
      }
    }
    r.root.rotation.y = player.facing;
  }

  /* the camera does the work an anime cut would: close, orbit, hero shot */
  function cutsceneCamera() {
    /* An offset of (sin y, cos y) puts the camera along the fighter's own
       forward, so yaw = facing looks them in the face and yaw = facing + PI is
       where the normal chase camera lives — which is where this has to end. */
    var t = CS.t, head = player.pos.clone().add(new THREE.Vector3(0, 4.3, 0));
    var face = player.facing, back = face + Math.PI;
    var yaw, dist, height, look;
    if (t < 2.15) {
      var k = EASE(t / 2.15);
      yaw = face + .5;                         // three quarters on, close
      dist = 3.9 - 1.3 * k;                    // slow push in on the face
      height = 4.45 + .15 * k;
      look = head;
    } else if (t < 3.85) {
      var k2 = EASE((t - 2.15) / 1.7);
      yaw = face + .5 + k2 * ((back - 1.25) - (face + .5));  // sweep around
      dist = 2.6 + 5.1 * k2;
      height = 4.6 - 1.5 * k2;
      look = player.pos.clone().add(new THREE.Vector3(0, 3.3, 0));
    } else {
      var k3 = EASE((t - 3.85) / (CS.dur - 3.85));
      yaw = (back - 1.25) + k3 * 1.25;         // settle exactly behind them
      dist = 7.7 + 1.8 * k3;
      height = 3.1 + 1.3 * k3;                 // and rise into the chase cam
      look = player.pos.clone().add(new THREE.Vector3(0, 3.1, 0));
    }
    CS.orbit = yaw;
    var off = new THREE.Vector3(Math.sin(yaw) * dist, height, Math.cos(yaw) * dist);
    camera.position.copy(player.pos.clone().add(off));
    if (shakeMag > 0) {
      camera.position.add(new THREE.Vector3(
        (Math.random() - .5) * shakeMag, (Math.random() - .5) * shakeMag, (Math.random() - .5) * shakeMag));
    }
    camera.lookAt(look);
  }

  var _updateCamera = updateCamera;
  updateCamera = function (dt) {
    if (CS.active) { cutsceneCamera(); shakeMag = Math.max(0, shakeMag - dt * 2.2); return; }
    return _updateCamera(dt);
  };

  function skipCutscene() { if (CS.active) { CS.t = CS.dur; endCutscene(); } }
  window.addEventListener('keydown', function () { skipCutscene(); }, true);
  window.addEventListener('mousedown', function () { if (CS.active) skipCutscene(); }, true);

  /* --------------------------------------------------------------- hooks */
  var _updatePlayer = updatePlayer;
  /* Enemy.applyReact only ever touches rig, react and animT, so the dummies'
     flinch animations can be run on the player with a stand-in object. */
  var selfReact = { rig: null, react: null, animT: 0 };
  function stepSelfReact(dt) {
    if (!player.react) return;
    if (player.dead || CS.active) { player.react = null; return; }
    selfReact.rig = player.rig;
    selfReact.animT = player.animT;
    selfReact.react = player.react;
    Enemy.prototype.applyReact.call(selfReact, dt);
    player.react = selfReact.react;           // cleared for us when it finishes
  }

  /* the tags: ours follows a fighter swap onto the new rig, and every tag
     steps out of shot while a cutscene owns the frame */
  function stepTags() {
    if (MP.myChar !== player.char) {
      MP.myChar = player.char;
      setTag(player.rig, MP.name, player.char);
    }
    /* a finisher is not a cutscene any more, so the tags stay up for it */
    var cine = CS.active ||
      !!(window.JJNAOYA && window.JJNAOYA.busy()) ||
      !!(window.JJAW && window.JJAW.cine);
    if (player.rig && player.rig.__tag) player.rig.__tag.visible = !cine && !player.dead;
    for (var id in MP.fighters) {
      var e = MP.fighters[id].e;
      if (e && e.rig && e.rig.__tag) e.rig.__tag.visible = !cine && !e.dead;
    }
  }

  updatePlayer = function (dt) {
    /* our own rig gets the same tag the remote ones do, so a pose can ask
       whose body it is being applied to rather than who is watching */
    if (player.rig) player.rig.__char = player.char;
    if (CS.active) stepCutscene(dt);          // you stand still and pose
    else { _updatePlayer(dt); stepSelfReact(dt); }
    if (!MP.active) return;
    stepTags();
    announceCasts();
    stepFighters(dt);
    sendState(dt);
    /* respawning after a defeat gets the same entrance */
    if (MP.wasDead && !player.dead) startCutscene();
    MP.wasDead = player.dead;
  };

  /* Watching player.action and attackT means every ability announces itself
     without having to patch each of the nine cast functions. */
  function announceCasts() {
    var type = player.action ? player.action.type : null;
    if (type && type !== MP.lastCast) {
      if (MP.relay) MP.relay.pub({ t: 'cast', id: MP.id, k: type });
    }
    MP.lastCast = type;
    var punching = player.attackT > 0;
    if (punching && !MP.wasPunching && MP.relay) {
      MP.relay.pub({ t: 'cast', id: MP.id, k: 'm1' });
    }
    MP.wasPunching = punching;
  }

  /* remote fighters are driven by the network, never by the dummy AI */
  var _enemyUpdate = Enemy.prototype.update;
  Enemy.prototype.update = function (dt) {
    if (!this.net) return _enemyUpdate.call(this, dt);
    if (this.rag) return;                            // the body is falling
    /* keep the parts of the enemy tick that are purely cosmetic */
    if (this.frameT > 0) this.frameT -= dt;
    if (this.stunT > 0) this.stunT -= dt;
    this.animT += dt;
    if (this.rig && this.rig.root) {
      this.rig.root.position.copy(this.pos);
      this.rig.root.rotation.y = this.facing;
    }
  };

  /* our attacks tell the other player they were hit; they own their health */
  var _enemyDamage = Enemy.prototype.damage;
  Enemy.prototype.damage = function (amount, knock, opts) {
    if (!this.net) return _enemyDamage.call(this, amount, knock, opts);
    if (this.dead) return;
    opts = opts || {};
    var msg = { t: 'hit', id: MP.id, to: this.net.id, d: amount };
    if (knock) { msg.kx = round2(knock.x); msg.ky = round2(knock.y); msg.kz = round2(knock.z); }
    /* carry the reaction the attack asked for, so they flinch the same way a
       dummy would have */
    if (opts.react) {
      msg.rk = opts.react;
      msg.rd = opts.reactDur == null ? .5 : opts.reactDur;
      msg.rs = opts.side == null ? (Math.random() < .5 ? -1 : 1) : opts.side;
    }
    /* and how the body should go if this is the hit that finishes them:
       theirs to apply, like their health, but ours to ask for */
    if (opts.death) msg.dth = opts.death;
    if (opts.pin) msg.pin = Math.round(opts.pin * 100);
    /* Death Painting blood keeps working after it lands */
    if (opts.psn) msg.psn = Math.round((opts.psn === true ? 6 : opts.psn) * 10);
    if (MP.relay) MP.relay.pub(msg);
    /* show it on them straight away; their own broadcast confirms it */
    if (opts.react) {
      this.react = { type: opts.react, t: 0, dur: msg.rd, side: msg.rs };
    }
    /* local feedback right away, their broadcast corrects the bar */
    this.hp = Math.max(0, this.hp - amount);
    this.drawBars();
    var at = this.pos.clone().add(new THREE.Vector3(0, 2.9, 0));
    if (window.JJFX) {
      window.JJFX.heavyHit(at, (opts && opts.spark) || 0xffd76a,
        Math.min(1.7, .6 + (knock ? knock.length() : 0) / 55));
    } else if (typeof spark === 'function') {
      spark(at, 0xff4455, 5, 10);
    }
    /* the confirm a local hit gets, on a remote body too */
    if (window.JJHITS) {
      window.JJHITS.flash(this.rig, opts.spark || 0xffffff, Math.min(1.8, .5 + amount / 30));
      if (opts.react === 'slash' || opts.react === 'dismantle' || opts.bleed) {
        window.JJFX.blood(at.clone(),
          knock ? knock.clone().setY(.4).normalize() : new THREE.Vector3(0, 1, 0),
          5 + Math.round(amount / 8), 1.1);
      }
      if (opts.react === 'burn') window.JJFX.fire(at.clone(), 5, 1, 2, .6);
    }
    if (typeof damageNumber === 'function') {
      damageNumber(this.pos.clone().add(new THREE.Vector3(0, 5.2, 0)), String(Math.round(amount)), '#ffd76a');
    }
    /* landing one on a real opponent is what fills the meter fastest */
    if (window.JJAW) window.JJAW.gain(amount * .55);
  };

  var _enemyProj = Enemy.prototype.applyProj;
  Enemy.prototype.applyProj = function (amount, byPlayer) {
    if (!this.net) return _enemyProj.call(this, amount, byPlayer);
    if (MP.relay) MP.relay.pub({ t: 'proj', id: MP.id, to: this.net.id, a: amount });
  };

  /* ------------------------------------------------------------ per frame */
  function stepFighters(dt) {
    var k = Math.min(1, dt * 12);
    for (var id in MP.fighters) {
      var f = MP.fighters[id];
      if (nowS() - f.seen > 12) { dropFighter(id); renderList(); updateScore(); continue; }
      var e = f.e;
      if (e.cineHold || e.rag) continue;             // posed by a cutscene, or dead
      e.pos.x += (f.tx - e.pos.x) * k;
      e.pos.z += (f.tz - e.pos.z) * k;
      if (f.ty != null) e.pos.y += (f.ty - e.pos.y) * k;
      var d = ((f.tyaw - e.facing + Math.PI) % (Math.PI * 2)) - Math.PI;
      e.facing += d * k;
      animateFighter(f, dt);
    }
  }

  /* Run the game's own animation on their rig, from the state they sent, so a
     remote fighter walks, runs, jumps, punches and poses their abilities
     exactly the way their own screen shows it. */
  function animateFighter(f, dt) {
    var e = f.e, r = e.rig;
    if (!r) return;
    var sp = f.speed || 0;
    e.animT += dt;
    f.gait = (f.gait || 0) + dt * (2 + sp * .55) * (sp > .2 ? 1 : 0);

    var moveAmt = Math.max(0, Math.min(1, sp / 2.2));
    var runAmt = Math.max(0, Math.min(1, (sp - 6.6) / 6.3));   // WALK_SPEED .92 .. RUN_SPEED
    resetPose(r);
    /* a remote body is driven entirely from here, so the lean a throw puts
       into it has to be cleared here too */
    if (r.body) r.body.rotation.set(0, 0, 0);
    applyLocomotion(r, e.animT, f.gait, moveAmt, runAmt, f.onGround !== false, f.vy || 0);
    if (f.char === 'naoya' && !f.action && !f.attack) {
      applyNaoyaFlair(r, e.animT, moveAmt, runAmt, f.onGround !== false);
    }
    if (f.attack) {
      var L = f.attack === 1;
      var sh = L ? r.shoulderL : r.shoulderR;
      var elb = L ? r.elbowL : r.elbowR;
      var osh = L ? r.shoulderR : r.shoulderL;
      var oel = L ? r.elbowR : r.elbowL;
      sh.rotation.x = -1.75; elb.rotation.x = -.08;
      osh.rotation.x = -.7; oel.rotation.x = -1.35;
      r.spine.rotation.y = L ? .38 : -.38;
      r.spine.rotation.x = -.1;
    }
    /* Whose body this is. Two modules key the same action type off the
       fighter's character — Sukuna's transformation and Yuji's awakening
       are both 'yaw' — and asking `player.char` gets the character of
       whoever is *watching*, which is the wrong one on every screen but
       the caster's. */
    r.__char = f.char;
    if (f.action) {
      f.action.t += dt;                       // keep posing between packets
      /* poseAction zeroes the local player's visYaw as a side effect, so it is
         put back after posing somebody else's rig */
      var savedVis = player.visYaw;
      try { poseAction(r, f.action); } catch (err) {}
      player.visYaw = savedVis;
    }

    if (e.react) { try { e.applyReact(dt); } catch (err) { e.react = null; } }

    r.root.rotation.y = e.facing + (f.visYaw || 0);
    r.root.position.copy(e.pos);
  }

  function round2(v) { return Math.round(v * 100) / 100; }
  function awakening() { return !!(window.JJAW && window.JJAW.cine); }

  function sendState(dt) {
    MP.sendAcc += dt;
    if (MP.sendAcc < 1 / SEND_HZ || !MP.relay || !MP.relay.connected) return;
    MP.sendAcc = 0;
    var sp = Math.hypot(player.vel.x, player.vel.z);
    MP.relay.pub({
      t: 's', id: MP.id, n: MP.name, c: player.char,
      x: round2(player.pos.x), z: round2(player.pos.z), h: Math.round(player.pos.y * 10),
      y: Math.round(player.facing * 100), vy: Math.round(player.visYaw * 100),
      hp: Math.round(player.hp), mx: Math.round(player.maxHp),
      d: player.dead ? 1 : 0, f: player.frameT > 0 ? 1 : 0,
      /* everything the animation needs to be reproduced exactly */
      sp: Math.round(sp * 10), og: player.onGround ? 1 : 0, vv: Math.round(player.vel.y * 10),
      at: player.attackT > 0 ? (player.attackArm + 1) : 0,
      /* the awakening is not an action, but the other screens still have to
         play the poses, so it travels as one */
      ac: awakening() ? 'awakening' : (player.action ? player.action.type : 0),
      ap: awakening() ? Math.round(window.JJAW.ct * 100) : (player.action ? Math.round(player.action.t * 100) : 0),
      /* which way a dash went, so it is not posed as a side one on every
         other screen */
      dk: (player.action && player.action.type === 'dash') ? player.action.kind : 0,
      ds: (player.action && player.action.type === 'dash') ? (player.action.side || 0) : 0,
      ad: awakening() ? 360 : (player.action ? Math.round(player.action.dur * 100) : 0),
      /* which beat of the move he is on, for the poses that are staged
         rather than timed, and the name of a finisher that has taken him
         over so the other screens can pose it too */
      sg: (player.action && player.action.stage != null) ? player.action.stage : null,
      fk: (player.action && player.action.fin) ? player.action.fin : 0,
      /* one spare number for a pose that needs a moment as well as a
         clock — Hakari's guard needs to know when it sprung */
      pf: (player.action && player.action.sprung) ?
          Math.max(1, Math.round((player.action.sprungAt || 0) * 100)) : 0,
      rk: player.react ? player.react.type : 0,
      rt: player.react ? Math.round(player.react.t * 100) : 0,
      rd: player.react ? Math.round(player.react.dur * 100) : 0,
      rs: player.react ? player.react.side : 0,
      aw: (window.JJAW && window.JJAW.active) ? 1 : 0,
      /* Hakari's fever is his awakening: the bar, the boost and the aura
         all hang off it, so it travels the same way Gojo's does */
      hf: (window.JJHAKARI && window.JJHAKARI.fever > 0 && player.char === 'hakari') ? 1 : 0
    });
  }

  /* ------------------------------------------------------------- remote fx
     An ability's visuals are made by the caster's own client, so the other
     screens would show nothing at all. Each cast is announced and a matching
     effect is played at that fighter's feet — visual only, never damaging,
     because the hit itself already travels as its own message. */
  function remoteFx(kind, pos, yaw, f) {
    var FX = window.JJFX;
    if (!FX) return;
    /* their rig, for the effects that are made out of copies of the
       body rather than out of billboards */
    var rig = (f && f.e && f.e.rig) ? f.e.rig : null;
    var fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    var mid = pos.clone().add(new THREE.Vector3(0, 2.6, 0));
    var d = player.pos.distanceTo(pos);
    var near = d < 26, close = d < 45;
    var i;
    switch (kind) {
      case 'red':
        redBlast(mid.clone().addScaledVector(fwd, 6));
        break;
      case 'rapid':
        for (i = 0; i < 7; i++) {
          (function (n) {
            setTimeout(function () {
              var at = mid.clone().addScaledVector(fwd, 2 + n * .4);
              FX.impact(at, 0x9fd8ff, .7);
              FX.slash(at, fwd, 0xdfefff, 2.4, .16);
            }, n * 65);
          })(i);
        }
        break;
      case 'tf':
        FX.slash(mid.clone().addScaledVector(fwd, 2.4), fwd, 0xbfe6ff, 5, .22);
        FX.ring(pos.clone().addScaledVector(fwd, 3), 0x8fd0ff, { maxR: 11, life: .45 });
        FX.impact(mid.clone().addScaledVector(fwd, 3), 0xbfe6ff, 1.3);
        if (near) addShake(.18);
        break;
      case 'palm':
        for (i = 0; i < 5; i++) {
          (function (n) {
            setTimeout(function () {
              var at = mid.clone().addScaledVector(fwd, 2 + n * 1.6);
              FX.ring(at, 0x7fd4ff, { maxR: 4.5, life: .3, ground: false, axis: fwd });
              FX.streaks(at, 0xcfeaff, 3, 14, 1);
            }, n * 90);
          })(i);
        }
        break;
      case 'lim':
        FX.speedRing(mid, 0x6fa8ff, 7, .3);
        FX.ring(pos, 0x6fa8ff, { maxR: 9, life: .5 });
        FX.streaks(mid, 0xdfefff, 12, 20, 1.4);
        break;
      case 'm1':
        try { sfx.punch(); } catch (e) {}
        break;
      case 'spawn':
        FX.rings(pos, 0xbfe0ff, 3, { maxR: 14, life: .6, gap: 60 });
        FX.cross(mid, 0xffffff, 4, .3);
        FX.dust(pos.clone(), 6, 0xd7dde8, 7, 3);
        if (near) addShake(.3);
        break;

      /* ---- awakened Gojo, as the rest of the room sees it ---- */
      case 'awaken':
        FX.rings(pos, 0x3a7dff, 4, { maxR: 20, life: .8, gap: 70 });
        FX.beam(pos.clone(), new THREE.Vector3(0, 1, 0), 55, 0x4a8dff, { radius: 1.7, life: 1.1 });
        FX.cross(mid.clone().add(new THREE.Vector3(0, 1.7, 0)), 0x9fd8ff, 5, .35);
        FX.debris(pos.clone(), 12, 15);
        FX.dust(pos.clone(), 9, 0xd6e2f2, 10, 4);
        FX.cracks(pos.clone(), 10, 13);
        if (close) { addShake(.8); FX.flash('#bfe0ff', .3, .5); }
        break;
      case 'aw_blue':
        var live = { p: mid.clone().addScaledVector(fwd, 1.6) };
        var rocks = FX.orbitRubble(function () { return live.p; }, 20, 0x5c6473,
          { from: 14, to: 6.8, rise: .48, stagger: .36 });
        FX.speedRing(live.p.clone(), 0x59a8ff, 14, .36);
        for (i = 0; i < 10; i++) {
          (function (n) {
            setTimeout(function () {
              live.p.addScaledVector(fwd, 2.1);
              FX.ring(live.p.clone(), 0x59a8ff, { maxR: 2.2, from: 8, life: .32, ground: false, opacity: .8 });
              FX.mote(live.p.clone(), 0x8fd0ff, 10, .28);
              if (n % 2 === 0) rocks.add(1, 8 + Math.random() * 4);
            }, 380 + n * 55);
          })(i);
        }
        setTimeout(function () {
          rocks.release(18);
          FX.rings(live.p.clone(), 0x2f7bff, 3, { maxR: 22, life: .55, ground: false, gap: 45 });
          FX.dust(new THREE.Vector3(live.p.x, 0, live.p.z), 8, 0xd2ddef, 12, 3.6);
        }, 1320);
        break;
      case 'aw_red':
        setTimeout(function () {
          FX.wave(mid, fwd, 0xff3b4d, { steps: 6, r0: 9, grow: 2.4, reach: 5.5 });
          try { (sfx.redMax || sfx.hit)(); } catch (e) {}
        }, 450);
        setTimeout(function () {
          FX.cross(mid.clone().addScaledVector(fwd, 1.4), 0xffb3ba, 6, .3);
          FX.dust(pos.clone().addScaledVector(fwd, 4), 8, 0xe4d3d6, 12, 3.4);
          FX.debris(pos.clone().addScaledVector(fwd, 7), 9, 15);
          if (close) addShake(.7);
        }, 450);
        break;
      case 'aw_purple':
        setTimeout(function () {
          if (close) { FX.flash('#f2e6ff', .45, .5); addShake(1.1); }
          FX.beam(mid.clone().addScaledVector(fwd, 1.6), fwd, 120, 0x9b4dff, { radius: 3.4, life: 1 });
          FX.beam(mid.clone().addScaledVector(fwd, 1.6), fwd, 120, 0xffffff, { radius: 1.2, life: .9 });
          for (var n = 0; n < 12; n++) {
            (function (n) {
              setTimeout(function () {
                var at = pos.clone().addScaledVector(fwd, 6 + n * 8);
                FX.ring(new THREE.Vector3(at.x, .1, at.z), 0x9b4dff, { maxR: 10, life: .5 });
                FX.dust(new THREE.Vector3(at.x, 0, at.z), 3, 0xcdbde4, 8, 3);
              }, n * 16);
            })(n);
          }
        }, 1750);
        break;
      case 'aw_domain':
        /* the hand and the sign; the void arrives on its own message */
        FX.converge(mid, 0x6fb4ff, 20, 10, .8);
        if (close) addShake(.5);
        break;

      /* his own module builds the real door, the real balls and the same
         three hits — these used to be rings and crosses standing in for
         furniture that never appeared */
      case 'h1':
        if (window.JJHAKARI && window.JJHAKARI.remoteShutter) {
          window.JJHAKARI.remoteShutter(pos.clone(), yaw);
        }
        if (near) addShake(.5);
        break;
      case 'h2':
        if (window.JJHAKARI && window.JJHAKARI.remoteBalls) {
          window.JJHAKARI.remoteBalls(pos.clone(), yaw);
        }
        break;
      case 'h3':
        if (window.JJHAKARI && window.JJHAKARI.remoteGachinko) {
          window.JJHAKARI.remoteGachinko(pos.clone(), yaw);
        }
        if (near) addShake(1);
        break;
      case 'h4':
        /* Fever Breaker: the reaching kick, the pair of doors they hang in
           front of, and the dropkick that puts them through both */
        setTimeout(function () {
          var at = mid.clone().addScaledVector(fwd, 3.4);
          FX.slash(at, fwd, 0xffcc4d, 7, .22);
          FX.speedRing(at, 0xffd964, 9, .3);
          if (near) addShake(.6);
        }, 280);
        setTimeout(function () {
          if (window.JJHAKARI && window.JJHAKARI.remoteFever) {
            window.JJHAKARI.remoteFever(pos.clone(), yaw);
          }
        }, 300);
        break;
      case 'hr':
        /* the two doors going up; whether anybody swings is its own message */
        if (window.JJHAKARI && window.JJHAKARI.remoteGuard) {
          window.JJHAKARI.remoteGuard(pos.clone(), yaw);
        }
        break;
      case 'hrx':
        /* somebody swung, and he came back through them */
        if (window.JJHAKARI && window.JJHAKARI.remoteSpring) {
          window.JJHAKARI.remoteSpring(pos.clone(), yaw);
        }
        if (close) addShake(1.4);
        break;
      case 'hdom':
        FX.mote(mid, 0xffd964, 8, .6);
        if (close) addShake(.5);
        break;

      /* ------------------------------------------------- HAKARI IN FEVER
         All five of these are built by his own module, so what everybody
         else sees is the same container, the same fists and the same
         broken road the caster sees. The hits travel separately. */
      case 'ha1':
        if (window.JJFEVER && window.JJFEVER.remote) {
          window.JJFEVER.remote.ha1(pos.clone(), yaw);
        }
        if (near) addShake(.8);
        break;
      case 'ha1j':
        if (window.JJFEVER && window.JJFEVER.remote) {
          window.JJFEVER.remote.ha1j(pos.clone(), yaw);
        }
        if (close) addShake(.9);
        break;
      case 'ha2':
        if (window.JJFEVER && window.JJFEVER.remote) {
          window.JJFEVER.remote.ha2(pos.clone(), yaw);
        }
        if (near) addShake(.4);
        break;
      case 'ha3':
        if (window.JJFEVER && window.JJFEVER.remote) {
          window.JJFEVER.remote.ha3(pos.clone(), yaw);
        }
        break;
      case 'ha4':
        if (window.JJFEVER && window.JJFEVER.remote) {
          window.JJFEVER.remote.ha4(pos.clone(), yaw);
        }
        if (close) addShake(1);
        break;
      case 'hafin':
        if (window.JJFEVER && window.JJFEVER.remote) {
          window.JJFEVER.remote.hafin(pos.clone(), yaw);
        }
        if (close) addShake(.8);
        break;
      case 'y1':
        setTimeout(function () {
          var at = mid.clone().addScaledVector(fwd, 2.6);
          FX.impact(at, 0xffd9a8, 1.5);
          FX.slash(at, fwd, 0xffe0c0, 4, .18);
          try { sfx.punch(); } catch (e) {}
        }, 400);
        setTimeout(function () {
          var at = mid.clone().addScaledVector(fwd, 2.6);
          FX.cross(at, 0xffb37a, 7, .3);
          FX.impact(at, 0xff8a5c, 2.4);
          FX.rings(at, 0xff9a6a, 3, { maxR: 11, life: .45, ground: false, gap: 38 });
          FX.ring(new THREE.Vector3(at.x, .1, at.z), 0xffc79a, { maxR: 12, life: .5 });
          if (near) addShake(.6);
        }, 620);
        break;
      case 'y2':
        setTimeout(function () {
          if (window.JJYUJI) window.JJYUJI.blackFlash(mid.clone().addScaledVector(fwd, 2.7));
          else FX.impact(mid, 0xd4143c, 3);
        }, 740);
        break;
      case 'y3':
        setTimeout(function () {
          var at = mid.clone().addScaledVector(fwd, 2.4);
          FX.slash(at, fwd, 0xffd0da, 6.5, .22);
          FX.impact(at, 0xff9fb0, 1.9);
          FX.ring(new THREE.Vector3(at.x, .1, at.z), 0xff9fb0, { maxR: 9, life: .45 });
          if (near) addShake(.5);
        }, 420);
        break;
      case 'y4':
        setTimeout(function () {
          var at = pos.clone().addScaledVector(fwd, 1.6);
          FX.cross(at.clone().add(new THREE.Vector3(0, 1.4, 0)), 0xffffff, 7, .3);
          FX.impact(at.clone().add(new THREE.Vector3(0, 1, 0)), 0xff9fb0, 3);
          FX.rings(new THREE.Vector3(at.x, .12, at.z), 0xffb0bd, 4, { maxR: 17, life: .65, gap: 45 });
          FX.cracks(new THREE.Vector3(at.x, 0, at.z), 12, 17, 0x241016);
          FX.debris(new THREE.Vector3(at.x, 0, at.z), 14, 18, 0x5a4a44);
          FX.dust(new THREE.Vector3(at.x, 0, at.z), 10, 0xd8cbc4, 13, 4.2);
          if (close) addShake(1.2);
        }, 740);
        break;
      case 'yr':
        setTimeout(function () {
          FX.speedRing(mid, 0xff7f9a, 11, .4);
          FX.rings(mid, 0xff9fb0, 3, { maxR: 14, life: .5, ground: false, gap: 40 });
          FX.ring(new THREE.Vector3(pos.x, .1, pos.z), 0xff7f9a, { maxR: 15, life: .55 });
          FX.streaks(mid, 0xffd0da, 14, 18, 1.4);
        }, 220);
        break;
      case 'yaw':
        setTimeout(function () {
          FX.rings(new THREE.Vector3(pos.x, .12, pos.z), 0xd4143c, 4, { maxR: 20, life: .75, gap: 60 });
          FX.beam(pos.clone(), new THREE.Vector3(0, 1, 0), 46, 0x8b0f2a, { radius: 1.5, life: 1 });
          FX.debris(pos.clone(), 10, 14, 0x2a1218);
          FX.cracks(pos.clone(), 9, 12, 0x120309);
          if (close) addShake(1);
        }, 1500);
        break;
      /* the four he gets when the thing inside him is out */
      case 's1':
        setTimeout(function () {
          if (window.JJSUKUNA && window.JJSUKUNA.remote) {
            window.JJSUKUNA.remote.dismantle(pos.clone(), yaw);
          }
        }, 180);
        break;
      case 's2':
        setTimeout(function () {
          if (window.JJSUKUNA && window.JJSUKUNA.remote) {
            window.JJSUKUNA.remote.cleave(pos.clone(), yaw);
          }
        }, 420);
        break;
      case 's3':
        if (window.JJSUKUNA && window.JJSUKUNA.remote) {
          window.JJSUKUNA.remote.fuga(pos.clone(), yaw);
        }
        break;
      case 's4':
        /* the hands going together, and the pressure of it. The shrine
           itself arrives on its own message, which builds the real one. */
        FX.mote(mid, 0x8b0f2a, 8, .6);
        FX.rings(new THREE.Vector3(pos.x, .1, pos.z), 0xd4143c, 3, { maxR: 12, life: .7, gap: 70 });
        if (close) addShake(.6);
        break;
      case 'sukuna':
        FX.flash('#2a000e', .4, .3);
        FX.rings(new THREE.Vector3(pos.x, .1, pos.z), 0xd4143c, 5, { maxR: 26, life: .8, gap: 55 });
        FX.beam(pos.clone(), new THREE.Vector3(0, 1, 0), 60, 0x8b0f2a, { radius: 2.4, life: 1.2 });
        FX.cracks(pos.clone(), 14, 16, 0x14060a);
        if (close) addShake(1.4);
        break;
      /* ------------------------------------------------------ CHOSO
         All five of these are relayed through his own routines, so what
         everybody else sees is the same dark blood the caster sees and
         not a bright stand-in. The hits travel as their own messages. */
      case 'caw':
        if (window.JJCHOSO && window.JJCHOSO.remote) window.JJCHOSO.remote.awaken(pos.clone());
        if (close) addShake(1);
        break;
      /* the four he only has while the mark is open */
      case 'ca1':
        setTimeout(function () {
          if (window.JJCHOSO && window.JJCHOSO.remote) window.JJCHOSO.remote.converge(pos.clone(), yaw);
        }, 720);
        break;
      case 'ca2':
        setTimeout(function () {
          if (window.JJCHOSO && window.JJCHOSO.remote) window.JJCHOSO.remote.barrage(pos.clone(), yaw);
        }, 500);
        break;
      case 'ca3':
        setTimeout(function () {
          if (window.JJCHOSO && window.JJCHOSO.remote) window.JJCHOSO.remote.saw(pos.clone(), yaw);
        }, 620);
        break;
      case 'ca4':
        if (window.JJCHOSO && window.JJCHOSO.remote) window.JJCHOSO.remote.pillar(pos.clone(), yaw);
        break;
      case 'c1':
        setTimeout(function () {
          if (window.JJCHOSO && window.JJCHOSO.remote) window.JJCHOSO.remote.lance(pos.clone(), yaw);
        }, 300);
        break;
      case 'c1s':
        /* the held stream: it is re-sent every tick it runs, so this is a
           short burst that simply keeps being replaced */
        if (window.JJCHOSO && window.JJCHOSO.remote) window.JJCHOSO.remote.stream(pos.clone(), yaw);
        break;
      case 'c2':
        setTimeout(function () {
          if (window.JJCHOSO && window.JJCHOSO.remote) window.JJCHOSO.remote.meteorite(pos.clone(), yaw);
        }, 450);
        break;
      case 'c3':
        setTimeout(function () {
          if (window.JJCHOSO && window.JJCHOSO.remote) window.JJCHOSO.remote.supernova(pos.clone());
        }, 500);
        break;
      case 'c4':
        if (window.JJCHOSO && window.JJCHOSO.remote) window.JJCHOSO.remote.scale(pos.clone());
        if (close) addShake(.7);
        break;
      case 'cr':
        setTimeout(function () {
          if (window.JJCHOSO && window.JJCHOSO.remote) window.JJCHOSO.remote.edge(pos.clone(), yaw);
        }, 260);
        break;
      /* ------------------------------------------------------- MEGUMI
         Every one of his is a body that gets summoned, travels and does
         something with its own weight, so all five are built by his own
         module — a stand-in ring would be a shikigami nobody can see. */
      case 'mg1': case 'mg2': case 'mg3': case 'mg4': case 'mgr':
        if (window.JJMEGUMI && window.JJMEGUMI.remote &&
            window.JJMEGUMI.remote[kind]) {
          window.JJMEGUMI.remote[kind](pos.clone(), yaw);
        }
        if (close && (kind === 'mg4' || kind === 'mg2')) addShake(1.2);
        else if (near) addShake(.5);
        break;
      /* ---- Megumi awakened: the four on the bar, plus the two merges
         that have no key of their own — gv1 is 1-then-2 and gv2 is
         2-then-3, and they arrive as ordinary casts because that is what
         they are. The merged shikigami are bodies, so the garden module
         builds the real ones. The domain itself arrives as its own 'dom'
         message; `gdom` here is only the sign that it is coming. */
      case 'gaw': case 'ga1': case 'ga2': case 'ga3':
      case 'gv1': case 'gv2': case 'gdom':
        if (window.JJGARDEN && window.JJGARDEN.remoteFx &&
            window.JJGARDEN.remoteFx[kind]) {
          window.JJGARDEN.remoteFx[kind](pos.clone(), yaw, f);
        }
        if (close && (kind === 'gv1' || kind === 'gv2' || kind === 'gaw' || kind === 'gdom')) addShake(1.6);
        else if (near) addShake(.6);
        break;

      /* ------------------------------------------------------- MAHITO
         Every one of his changes the SHAPE of something, and a shape is
         not damage — a body left the wrong shape on one screen and the
         right shape on another is two different fights. So the warp
         travels with the cast rather than with the hit. */
      case 't1': case 't2': case 't3': case 't4': case 'tr':
        if (window.JJMAHITO && window.JJMAHITO.remote &&
            window.JJMAHITO.remote[kind]) {
          window.JJMAHITO.remote[kind](pos.clone(), yaw);
        }
        if (close && (kind === 't4' || kind === 't3')) addShake(1.3);
        else if (near) addShake(.5);
        break;

      /* ---------------------------------------------------------- TODO
         A swap is the one thing in the game drawn at two places at once,
         and only one of them is where the caster is — so the far end is
         rebuilt from the direction he was facing rather than assumed to
         be under him. */
      case 'b1': case 'b2': case 'b3': case 'b4': case 'br':
        if (window.JJTODO && window.JJTODO.remote &&
            window.JJTODO.remote[kind]) {
          window.JJTODO.remote[kind](pos.clone(), yaw);
        }
        if (close && (kind === 'b4' || kind === 'b3')) addShake(1.4);
        else if (near) addShake(.5);
        break;

      /* ------------------------------------------------------ HIGURUMA
         The seal is deliberately NOT rebuilt here: it is what makes his
         next hit worth more, and a second one put up on this screen
         would be a charge nobody filed. */
      case 'j1': case 'j2': case 'j3': case 'j4': case 'jr':
        if (window.JJHIGURUMA && window.JJHIGURUMA.remote &&
            window.JJHIGURUMA.remote[kind]) {
          window.JJHIGURUMA.remote[kind](pos.clone(), yaw);
        }
        if (close && (kind === 'j4' || kind === 'j2')) addShake(1.4);
        else if (near) addShake(.5);
        break;

      /* ---------------------------------------------------------- YUTA
         Four, because he has four. The overspill on his cuts is drawn
         here too — it is most of what a Yuta move looks like, and a copy
         without it is a boy waving a stick. */
      case 'o1': case 'o2': case 'o3': case 'o4': case 'or':
        if (window.JJYUTA && window.JJYUTA.remote &&
            window.JJYUTA.remote[kind]) {
          window.JJYUTA.remote[kind](pos.clone(), yaw);
        }
        if (close && kind === 'or') addShake(1.8);
        else if (close) addShake(1.2);
        else if (near) addShake(.5);
        break;

      /* ---------------------------------------------------------- MUTA
         Every one of his is a thing that gets built and then comes
         apart, so the copy has to be the whole assembly — a puppet that
         only half arrives reads as a bug rather than as a puppet. The
         frame on R follows him, so it wants the packet as well. */
      case 'k1': case 'k2': case 'k3': case 'k4': case 'kr':
        if (window.JJMUTA && window.JJMUTA.remote &&
            window.JJMUTA.remote[kind]) {
          window.JJMUTA.remote[kind](pos.clone(), yaw, f);
        }
        if (close && kind === 'kr') addShake(1.9);
        else if (close) addShake(1.1);
        else if (near) addShake(.5);
        break;

      /* ----------------------------------------------------------- RYU
         Everything he throws leaves a point on his HEAD, so the copy is
         handed the packet — his rig is inside it, and the bore is read
         off it exactly the way it is read locally. A shot that started
         at his chest instead would be a different character. */
      case 'r1': case 'r2': case 'r3': case 'r4': case 'rr':
        if (window.JJRYU && window.JJRYU.remote &&
            window.JJRYU.remote[kind]) {
          window.JJRYU.remote[kind](pos.clone(), yaw, f);
        }
        if (close && kind === 'rr') addShake(2);
        else if (close) addShake(1.1);
        else if (near) addShake(.5);
        break;

      /* -------------------------------------------------------- NANAMI
         The measurement is most of what a move of his looks like — ten
         ticks up whatever he is about to hit with the seventh one lit —
         so the copy draws it before it draws the swing. */
      case 'w1': case 'w2': case 'w3': case 'w4': case 'wr':
        if (window.JJNANAMI && window.JJNANAMI.remote &&
            window.JJNANAMI.remote[kind]) {
          window.JJNANAMI.remote[kind](pos.clone(), yaw, f);
        }
        if (close && kind === 'wr') addShake(1.9);
        else if (close) addShake(1.1);
        else if (near) addShake(.5);
        break;

      case 'n4':
        /* the shot he framed, and the twenty four stills inside it */
        if (window.JJNAOYA && window.JJNAOYA.remoteFrames) {
          window.JJNAOYA.remoteFrames(pos.clone(), yaw, rig);
        }
        if (close) addShake(.5);
        break;
      case 'nrush':
        FX.rings(pos, 0x9fd8ff, 3, { maxR: 15, life: .6, gap: 55 });
        FX.cracks(pos.clone(), 7, 10, 0x2a2018);
        FX.dust(pos.clone(), 7, 0xbfae95, 8, 3);
        FX.speedRing(mid, 0xbfe6ff, 8, .35);
        if (close) addShake(.5);
        break;
      case 'kb':
        /* the tumble poses itself off the broadcast action; the landing
           did not travel, so it is played here on the same beat */
        setTimeout(function () {
          var at = new THREE.Vector3(pos.x, 0, pos.z);
          FX.dust(at, 7, 0xd7dde8, 9, 3);
          FX.ring(new THREE.Vector3(at.x, .1, at.z), 0xbcc6d8, { maxR: 7, life: .4 });
          FX.cracks(at, 4, 6);
          if (near) addShake(.25);
        }, 560);
        break;
      case 'void':
        break;                                        // this animates itself
      case 'dash':
        break;                                        // JJDASH.remote draws it
      case 'hwin':
        /* his jackpot payout: the machine coming apart and the aura going
           up. He poses it himself off the action that travelled. */
        FX.rings(new THREE.Vector3(pos.x, .12, pos.z), 0xffd964, 5,
          { maxR: 24, life: .9, gap: 46 });
        FX.beam(pos.clone(), new THREE.Vector3(0, 1, 0), 40, 0xffd964,
          { radius: 1.4, life: 1.1 });
        for (i = 0; i < 16; i++) {
          FX.streaks(pos.clone().add(new THREE.Vector3(
            (Math.random() - .5) * 4, Math.random() * 5, (Math.random() - .5) * 4)),
            [0xffe94d, 0xff4d4d, 0xffb03a, 0x4de26a, 0x4dc9ff, 0x9a6bff, 0xff5ec4][i % 7],
            2, 16, 1.3);
        }
        if (close) addShake(1);
        break;
      /* His four used to share one ring and one slash between them, so
         four different techniques looked identical from the outside.
         Each is built by his own module now, off his own rig, because
         what makes them read is the trail of copies of his body. */
      case 'n1': case 'n2': case 'n3': case 'nr': case 'nrf':
        if (window.JJNAOYA && window.JJNAOYA.remote && window.JJNAOYA.remote[kind]) {
          window.JJNAOYA.remote[kind](pos.clone(), yaw, rig);
        } else {
          FX.ring(pos, 0x9be7ff, { maxR: 8, life: .4 });
          FX.slash(mid.clone().addScaledVector(fwd, 1.6), fwd, 0xcfefff, 3, .18);
        }
        if (near && (kind === 'n1' || kind === 'nrf')) addShake(.4);
        break;
      default:
        FX.impact(mid, 0xffffff, .8);
    }
  }

  /* the red blast as the other screens see it — no damage, all noise */
  function redBlast(pos) {
    var FX = window.JJFX;
    FX.cross(pos, 0xffd0d4, 7, .3);
    FX.impact(pos, 0xff3b4d, 2.3);
    FX.rings(pos, 0xff3344, 3, { maxR: 18, life: .55, ground: false, gap: 45 });
    FX.ring(new THREE.Vector3(pos.x, .1, pos.z), 0xff5566, { maxR: 17, life: .6 });
    FX.dust(new THREE.Vector3(pos.x, 0, pos.z), 8, 0xe4d3d6, 11, 3.4);
    FX.debris(new THREE.Vector3(pos.x, 0, pos.z), 8, 15);
    FX.cracks(new THREE.Vector3(pos.x, 0, pos.z), 6, 10);
    if (player.pos.distanceTo(pos) < 30) { addShake(.5); FX.zoom(6, .35); }
  }

  window.addEventListener('beforeunload', function () {
    if (MP.relay && MP.relay.connected) MP.relay.pub({ t: 'bye', id: MP.id });
  });

  /* handy for checking the camera from outside, the game only had a setter */
  if (window.__game) {
    window.__game.getCam = function () { return { yaw: camYaw, pitch: camPitch }; };
    /* The export was a snapshot of switchChar taken before a single module
       had wrapped it, so calling it from outside skipped every one of them
       — Choso's stream was left running, Naoya could be left invisible and
       Megumi's shikigami were left standing in somebody else's fight. The
       character menu was always fine, because it closes over the binding
       and picks up the wrapped one; only this handle was stale. */
    window.__game.switchChar = function (id, quiet) { return switchChar(id, quiet); };
  }

  /* The receive half of the room, out where it can be driven directly.
     Feeding one client's outgoing packets straight into another's receive
     is how the two halves get checked against each other without standing
     a broker up in the middle of them. */
  MP.receive = onMessage;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectUI);
  else injectUI();

})();
