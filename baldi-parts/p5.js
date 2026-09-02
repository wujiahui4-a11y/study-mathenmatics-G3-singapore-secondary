/* =========================================================================
   BALDI'S BASICS 3D — MULTIPLAYER MODE
   One player is Baldi and hunts the others; the students have to finish the
   team's notebooks and reach an exit.

   Nothing in the original game file is edited. Everything below hooks into
   the globals it already defines (G, CHAPTERS, newGame, updatePlayer,
   updateBaldi, checkExits, drawMinimap ...) and patches them at runtime,
   so single player keeps behaving exactly as before.
   ========================================================================= */
(function () {
  'use strict';

  /* ----------------------------------------------------------------- relay
     Same transport as the arena game: free public MQTT brokers, every peer
     connects to all of them, duplicates dropped by sender + sequence. */
  var BROKERS = [
    { url: 'wss://broker.emqx.io:8084/mqtt', name: 'relay 1', host: 'broker.emqx.io', port: 8084 },
    { url: 'wss://broker.hivemq.com:8884/mqtt', name: 'relay 2', host: 'broker.hivemq.com', port: 8884 },
    { url: 'wss://test.mosquitto.org:8081/mqtt', name: 'relay 3', host: 'test.mosquitto.org', port: 8081 }
  ];
  var TOPIC_ROOT = 'baldischool/v1/';
  var CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  function uid() {
    return Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6);
  }
  function roomCode() {
    var out = '', buf = new Uint8Array(6);
    (window.crypto || window.msCrypto).getRandomValues(buf);
    for (var i = 0; i < 6; i++) out += CODE_ALPHABET[buf[i] % CODE_ALPHABET.length];
    return out;
  }
  function hashStr(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }
  function now() { return performance.now() / 1000; }

  function connectBroker(broker, timeoutMs) {
    return new Promise(function (resolve, reject) {
      if (!window.mqtt) return reject(new Error('no mqtt library'));
      var settled = false;
      var client = window.mqtt.connect(broker.url, {
        clientId: 'bb_' + uid(), keepalive: 30, connectTimeout: timeoutMs || 9000,
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

  function Relay() {
    this.conns = []; this.selfId = uid(); this.outSeq = 0;
    this.lastSeq = {}; this.senderConn = {}; this.connected = false;
  }
  Relay.prototype.start = function (opts) {
    var self = this;
    this.isHost = !!opts.isHost;
    this.onMsg = opts.onMsg;
    this.onStatus = opts.onStatus || function () {};
    var base = TOPIC_ROOT + opts.code + '/';
    this.pubTopic = base + (this.isHost ? 'h' : 'c');
    this.subTopic = base + (this.isHost ? 'c' : 'h');
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
    client.subscribe(this.subTopic, { qos: 0 }, function () {});
    client.on('message', function (t, payload) { self.handle(payload, client); });
    client.on('connect', function () { client.subscribe(self.subTopic, { qos: 0 }, function () {}); self.report(); });
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
    this.onStatus(live.length ? 'online' : 'off', live.length ? 'connected via ' + live.join(' + ') : 'reconnecting…');
  };
  Relay.prototype.handle = function (payload, client) {
    var msg;
    try { msg = JSON.parse(payload.toString()); } catch (e) { return; }
    if (msg.__s) {
      if (msg.__s === this.selfId) return;
      var last = this.lastSeq[msg.__s] || 0;
      if (msg.__q <= last) return;
      this.lastSeq[msg.__s] = msg.__q;
      this.senderConn[msg.__s] = client;
    }
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
      try { to[i].publish(this.pubTopic, text, { qos: 0 }); } catch (e) {}
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

  /* ------------------------------------------------------------- MP state */
  var MP = window.MP = {
    active: false, role: null, isHost: false, code: null, id: uid(), name: '',
    players: {},            // id -> record for everyone except me
    teamNb: 0, total: 5,
    over: null,             // null | 'hunter' | 'runners'
    relay: null, seed: 0,
    caught: false, escaped: false, spectating: false,
    sendAcc: 0, tick: 0,
    lastWorld: 0,
    cds: {}, revealT: 0, rageT: 0, stunT: 0, rulers: []
  };

  var SEND_HZ = 12;
  var CATCH_R = 2.3;
  var RAGE_CATCH_R = 3.6;
  var HEAD_START = 10;      // seconds before Baldi can catch anyone

  /* Three things Baldi can do, one key each. */
  var SKILLS = [
    { id: 'ruler', key: '1', code: 'Digit1', name: 'RULER', chalk: '#3fe0ff', cd: 10, desc: 'throw it — they freeze' },
    { id: 'listen', key: '2', code: 'Digit2', name: 'LISTEN', chalk: '#5cff5c', cd: 18, desc: 'hear them through walls' },
    { id: 'anger', key: '3', code: 'Digit3', name: 'ANGER', chalk: '#ffd84a', cd: 22, desc: 'faster, longer reach' }
  ];

  /* chalk drawings, not emoji — 24x24 paths */
  var ICONS = {
    ruler: [{ d: 'M3.2 14.9 14.9 3.2l5.9 5.9L9.1 20.8z' },
            { d: 'M6.7 11.5 8.9 13.7' }, { d: 'M9.7 8.5 11.9 10.7' }, { d: 'M12.7 5.5 14.9 7.7' }],
    listen: [{ d: 'M7.4 9.6a2.7 2.7 0 1 0 0 5.4 2.7 2.7 0 0 0 0-5.4z', fill: true },
             { d: 'M12.2 8.1a5.6 5.6 0 0 1 0 8.4' },
             { d: 'M15.9 5a10.2 10.2 0 0 1 0 14.6' }],
    anger: [{ d: 'M4.6 8.1 10.2 11' }, { d: 'M19.4 8.1 13.8 11' },
            { d: 'M8.8 13.9v2.1' }, { d: 'M15.2 13.9v2.1' },
            { d: 'M8.2 19.5q3.8-2.9 7.6 0' }]
  };

  function iconSvg(id, cls) {
    var d = ICONS[id] || [];
    var inner = '';
    for (var i = 0; i < d.length; i++) {
      inner += '<path d="' + d[i].d + '"' + (d[i].fill ? ' fill="currentColor" stroke="none"' : '') + '/>';
    }
    return '<svg class="' + (cls || 'ico') + '" viewBox="0 0 24 24" aria-hidden="true">' +
      '<g filter="url(#mpChalk)">' + inner + '</g></svg>';
  }

  /* deterministic worlds: every peer builds the same school from the code */
  function withSeed(seed, fn) {
    var orig = Math.random, s = seed >>> 0;
    Math.random = function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    try { return fn(); } finally { Math.random = orig; }
  }

  /* ------------------------------------------------------------------- UI */
  function el(id) { return document.getElementById(id); }

  function injectUI() {
    var css = document.createElement('style');
    css.textContent = [
      '#mpLobby{position:fixed;inset:0;z-index:70;background:rgba(6,10,18,.94);display:flex;align-items:center;',
      'justify-content:center;font-family:inherit;color:#e8ecf6}',
      '#mpLobby .box{width:min(520px,92vw);background:#131a28;border:2px solid #2f3c5c;border-radius:14px;padding:22px}',
      '#mpLobby h2{margin:0 0 4px;font-size:26px;letter-spacing:1px;color:#7fd7ff}',
      '#mpLobby .sub{color:#94a3c4;font-size:13px;line-height:1.5;margin-bottom:16px}',
      '#mpLobby label{display:block;font-size:11px;letter-spacing:1px;color:#7e8bab;margin:12px 0 5px}',
      '#mpLobby input{width:100%;background:#0b1018;border:1px solid #2f3c5c;color:#e8ecf6;border-radius:8px;',
      'padding:10px 12px;font:inherit;font-size:15px;text-transform:uppercase}',
      '#mpLobby input:focus{outline:none;border-color:#4d6cf5}',
      '#mpLobby .row{display:flex;gap:8px;margin-top:14px}',
      '#mpLobby button{flex:1;background:#4d6cf5;border:0;color:#fff;border-radius:8px;padding:12px;',
      'font:inherit;font-size:14px;font-weight:700;cursor:pointer;letter-spacing:.5px}',
      '#mpLobby button.ghost{background:#222c46;color:#cfd8ee}',
      '#mpLobby button:disabled{opacity:.45;cursor:default}',
      '#mpLobby .code{font-size:30px;letter-spacing:8px;text-align:center;color:#ffd76a;margin:8px 0}',
      '#mpLobby .list{background:#0b1018;border:1px solid #26314c;border-radius:8px;padding:10px;margin-top:12px;',
      'font-size:13px;min-height:64px}',
      '#mpLobby .list div{padding:2px 0}',
      '#mpLobby .who{color:#7fd7ff;font-weight:700}',
      '#mpStatus{font-size:12px;color:#8b97b5;margin-top:12px;min-height:16px}',
      '#mpStatus.err{color:#ff8f84}',
      '#mpHud{position:fixed;left:50%;top:10px;transform:translateX(-50%);z-index:40;display:none;',
      'background:rgba(8,12,20,.72);border:1px solid rgba(255,255,255,.14);border-radius:10px;padding:6px 14px;',
      'font-family:inherit;color:#e8ecf6;font-size:13px;letter-spacing:.5px;pointer-events:none;text-align:center}',
      '#mpHud b{color:#ffd76a}',
      '#mpHud .tag{color:#7fd7ff;font-weight:700}',
      /* three little chalkboards, propped up like the one on the title screen */
      '#mpSkills{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:40;',
      'display:none;gap:22px;align-items:flex-end;font-family:"Comic Sans MS","Chalkboard SE",cursive}',
      '#mpSkills .sk{position:relative;width:106px;height:92px;background:#0d0d0d;',
      'border:6px solid #e08a2e;border-radius:6px;box-shadow:0 8px 0 rgba(0,0,0,.4),',
      'inset 0 0 34px rgba(255,255,255,.05);transition:transform .12s,filter .12s}',
      '#mpSkills .sk:nth-child(1){transform:rotate(-3deg)}',
      '#mpSkills .sk:nth-child(2){transform:rotate(1.5deg)}',
      '#mpSkills .sk:nth-child(3){transform:rotate(-1.5deg)}',
      '#mpSkills .sk .ico{position:absolute;left:50%;top:14px;width:34px;height:34px;',
      'transform:translateX(-50%);color:#fff;fill:none;stroke:currentColor;stroke-width:2.2;',
      'stroke-linecap:round;stroke-linejoin:round;opacity:.95}',
      '#mpSkills .sk .nm{position:absolute;left:0;right:0;bottom:7px;text-align:center;',
      'font-size:16px;line-height:1;-webkit-text-stroke:1px rgba(0,0,0,.85);',
      'text-shadow:2px 2px 0 rgba(0,0,0,.75)}',
      '#mpSkills .sk .key{position:absolute;left:-11px;top:-13px;width:26px;height:26px;',
      'border-radius:50%;background:#fdf6e0;border:3px solid #000;color:#111;font-size:14px;',
      'display:grid;place-items:center;transform:rotate(-8deg);box-shadow:2px 3px 0 rgba(0,0,0,.45)}',
      '#mpSkills .sk .num{position:absolute;inset:0;display:none;place-items:center;font-size:40px;',
      'color:#ff7b6b;-webkit-text-stroke:1px #000;text-shadow:2px 3px 0 rgba(0,0,0,.7)}',
      '#mpSkills .sk .line{position:absolute;left:9%;right:9%;bottom:29px;height:3px;',
      'background:#fff;opacity:.55;transform-origin:left center;border-radius:2px}',
      '#mpSkills .sk.cooling{filter:grayscale(.7) brightness(.78)}',
      '#mpSkills .sk.cooling .ico{opacity:.35}',
      '#mpSkills .sk.cooling .nm{opacity:.45}',
      '#mpSkills .sk.cooling .num{display:grid}',
      '#mpSkills .sk.fire{transform:scale(1.14) rotate(0deg) !important}',
      '#mpResult{position:fixed;inset:0;z-index:75;display:none;align-items:center;justify-content:center;',
      'background:rgba(4,8,14,.9);color:#fff;font-family:inherit;text-align:center}',
      '#mpResult .r{max-width:460px}',
      '#mpResult h2{font-size:40px;margin:0 0 10px;letter-spacing:2px}',
      '#mpResult p{color:#a9b6d3;font-size:14px;line-height:1.6;margin:0 0 18px}',
      '#mpResult button{background:#4d6cf5;border:0;color:#fff;border-radius:8px;padding:12px 26px;',
      'font:inherit;font-size:14px;font-weight:700;cursor:pointer}',
      '#mpFlash{position:fixed;inset:0;z-index:55;background:#c0392b;opacity:0;pointer-events:none;transition:opacity .18s}',
      '#mpClick{position:fixed;inset:0;z-index:58;display:none;align-items:center;justify-content:center;',
      'background:rgba(0,0,0,.45);cursor:pointer;font-family:"Comic Sans MS","Chalkboard SE",cursive}',
      '#mpClick .card{background:#0d0d0d;border:9px solid #e08a2e;border-radius:6px;padding:26px 40px;',
      'text-align:center;transform:rotate(-1.6deg);box-shadow:0 10px 0 rgba(0,0,0,.4)}',
      '#mpClick b{display:block;font-size:30px;color:#3fe0ff;-webkit-text-stroke:1px rgba(0,0,0,.8);',
      'text-shadow:3px 3px 0 rgba(0,0,0,.6)}',
      '#mpClick span{display:block;margin-top:10px;font-size:14px;color:#ffe98a;text-shadow:2px 2px 0 #000}',
      'body.mpMouseLocked,body.mpMouseLocked *{cursor:none!important}',
      '#mpDragHint{position:fixed;left:50%;transform:translateX(-50%);bottom:130px;z-index:42;display:none;',
      'background:#0d0d0d;border:4px solid #e08a2e;border-radius:6px;padding:6px 16px;',
      'font:15px "Comic Sans MS","Chalkboard SE",cursive;color:#ffe98a;pointer-events:none;',
      'text-shadow:2px 2px 0 rgba(0,0,0,.6)}',
      '#mpDragHint b{color:#3fe0ff}',
      '#mpPopOut{display:none;margin-top:14px;background:#0d0d0d;border:4px solid #e08a2e;',
      'border-radius:6px;padding:12px 14px;font:13px/1.55 "Comic Sans MS","Chalkboard SE",cursive;color:#ffe98a}',
      '#mpPopOut button{width:100%;margin-top:10px;background:#e08a2e;border:0;color:#1b1205;',
      'border-radius:6px;padding:11px;font:inherit;font-size:14px;font-weight:700;cursor:pointer}',
      '#mpPopBtn2{position:fixed;left:50%;transform:translateX(-50%);bottom:96px;z-index:43;display:none;',
      'background:#e08a2e;border:0;color:#1b1205;border-radius:6px;padding:8px 16px;cursor:pointer;',
      'font:700 13px "Comic Sans MS",cursive}',
      '#mpCaught{position:fixed;inset:0;z-index:74;display:none;align-items:center;justify-content:center;',
      'background:rgba(4,8,14,.9);color:#fff;font-family:inherit;text-align:center}',
      '#mpCaught .r{max-width:440px}',
      '#mpCaught h2{font-size:34px;margin:0 0 10px;letter-spacing:2px}',
      '#mpCaught p{color:#a9b6d3;font-size:14px;line-height:1.6;margin:0 0 18px}',
      '#mpCaught button{background:#222c46;border:0;color:#dfe5f4;border-radius:8px;padding:11px 22px;',
      'font:inherit;font-size:13px;font-weight:700;cursor:pointer}'
    ].join('');
    document.head.appendChild(css);

    var wrap = document.createElement('div');
    wrap.innerHTML = [
      '<div id="mpLobby" class="hidden">',
      '  <div class="box">',
      '    <h2>MULTIPLAYER</h2>',
      '    <div class="sub">One of you plays Baldi and hunts the rest. The students share one pile of',
      '      notebooks and have to reach an exit. Baldi wins by catching everybody.</div>',
      '    <label>YOUR NAME</label>',
      '    <input id="mpName" maxlength="10" placeholder="PLAYER">',
      '    <div id="mpJoinBox">',
      '      <label>ROOM CODE (leave empty to create one)</label>',
      '      <input id="mpCode" maxlength="6" placeholder="E.G. K4RM2P">',
      '      <div class="row">',
      '        <button id="mpCreate">CREATE — I AM BALDI</button>',
      '        <button id="mpJoin" class="ghost">JOIN AS STUDENT</button>',
      '      </div>',
      '    </div>',
      '    <div id="mpRoomBox" style="display:none">',
      '      <label>ROOM CODE — TELL YOUR FRIENDS</label>',
      '      <div class="code" id="mpCodeOut">------</div>',
      '      <div class="list" id="mpList"></div>',
      '      <div class="row">',
      '        <button id="mpStart">START THE MATCH</button>',
      '        <button id="mpLeave" class="ghost">LEAVE</button>',
      '      </div>',
      '    </div>',
      '    <div id="mpPopOut">This page is embedded, so the browser will not let the game hold the',
      '      mouse. Opening it in its own window fixes that.',
      '      <button id="mpPopBtn">OPEN IN A FULL WINDOW</button></div>',
      '    <div id="mpStatus"></div>',
      '    <div class="row"><button id="mpBack" class="ghost">BACK</button></div>',
      '  </div>',
      '</div>',
      '<div id="mpHud"></div>',
      '<div id="mpSkills"></div>',
      '<svg width="0" height="0" style="position:absolute"><filter id="mpChalk">',
      '<feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" result="n"/>',
      '<feDisplacementMap in="SourceGraphic" in2="n" scale="1.6"/></filter></svg>',
      '<div id="mpFlash"></div>',
      '<div id="mpClick"><div class="card"><b>CLICK TO LOOK AROUND</b>',
      '<span>move the mouse to look · Esc lets it go</span></div></div>',
      '<div id="mpDragHint">hold <b>RIGHT MOUSE</b> and move to look around</div>',
      '<button id="mpPopBtn2">open in a full window for proper mouse look</button>',
      '<div id="mpResult"><div class="r"><h2 id="mpResultTitle">—</h2><p id="mpResultText"></p>',
      '<button id="mpResultBtn">BACK TO THE MENU</button></div></div>',
      '<div id="mpCaught"><div class="r"><h2 style="color:#ff8f84">BALDI CAUGHT YOU</h2>',
      '<p>Sit tight — the rest of the class is still in there.</p>',
      '<button id="mpCaughtBtn">LEAVE THE ROOM</button></div></div>'
    ].join('');
    while (wrap.firstChild) document.body.appendChild(wrap.firstChild);

    /* a card in the existing mode picker */
    var cards = el('modeCards');
    if (cards) {
      var card = document.createElement('button');
      card.className = 'modeCard';
      card.id = 'mcMulti';
      card.innerHTML = '<span class="mcTag">ONLINE</span><span class="mcName">MULTIPLAYER</span>' +
        '<span class="mcSub">Play with friends over the internet. One of you is Baldi and hunts the others ' +
        'with his own set of skills. The students share the notebooks and run for an exit.</span>';
      cards.insertBefore(card, cards.firstChild);
      card.addEventListener('click', openLobby);
    }

    el('mpBack').addEventListener('click', closeLobby);

    /* An embedded page is never granted pointer lock, but a pop-up opened
       from it is a fresh top level window that is not sandboxed — and there
       the mouse locks normally. */
    if (window.top !== window.self) el('mpPopOut').style.display = 'block';
    el('mpPopBtn').addEventListener('click', popOut);
    el('mpPopBtn2').addEventListener('click', popOut);
    el('mpCreate').addEventListener('click', function () { createRoom(); });
    /* These existing clicks are the user gestures browsers require before
       they will lock a pointer. No extra click is needed when the match starts. */
    el('mpJoin').addEventListener('click', function () { grabMouse(); joinRoom(); });
    el('mpLeave').addEventListener('click', function () { leaveRoom(); openLobby(); });
    el('mpStart').addEventListener('click', function () { grabMouse(); hostStart(); });
    el('mpResultBtn').addEventListener('click', function () {
      el('mpResult').style.display = 'none';
      el('mpCaught').style.display = 'none';
      leaveRoom();
      if (typeof returnToTitle === 'function') returnToTitle();
    });
    el('mpCaughtBtn').addEventListener('click', function () {
      el('mpCaught').style.display = 'none';
      leaveRoom();
      if (typeof returnToTitle === 'function') returnToTitle();
    });
    el('mpCode').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { grabMouse(); joinRoom(); }
    });

    var skills = el('mpSkills');
    SKILLS.forEach(function (s) {
      var d = document.createElement('div');
      d.className = 'sk';
      d.id = 'mpsk_' + s.id;
      d.title = s.name + ' — ' + s.desc;
      d.innerHTML = iconSvg(s.id) +
        '<span class="line"></span>' +
        '<span class="num"></span>' +
        '<span class="nm" style="color:' + s.chalk + '">' + s.name + '</span>' +
        '<span class="key">' + s.key + '</span>';
      skills.appendChild(d);
    });
    bindSkillClicks();
  }

  /* Google's frame URL renders nothing on its own, so the new window is
     opened blank and the page is written into it. A written about:blank
     window escapes the sandbox, which is what lets the mouse lock there. */
  function popOut() {
    var w = null;
    try { w = window.open('', '_blank', 'width=1280,height=820'); } catch (e) {}
    if (!w) { status('Your browser blocked the pop-up — allow pop-ups for this page and try again.', true); return; }
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
    status('Opened in a new window. Start the room from there.');
  }

  function status(text, bad) {
    var s = el('mpStatus');
    s.textContent = text || '';
    s.className = bad ? 'err' : '';
  }

  function openLobby() {
    var ms = el('modeSelect');
    if (ms) ms.classList.add('hidden');
    el('mpLobby').classList.remove('hidden');
    el('mpLobby').style.display = 'flex';
    el('mpJoinBox').style.display = '';
    el('mpRoomBox').style.display = 'none';
    status('');
    try { el('mpName').value = localStorage.getItem('bb_name') || ''; } catch (e) {}
  }
  function closeLobby() {
    el('mpLobby').style.display = 'none';
    el('mpLobby').classList.add('hidden');
    var ms = el('modeSelect');
    if (ms) ms.classList.remove('hidden');
  }

  function myName() {
    var v = (el('mpName').value || '').trim().toUpperCase().slice(0, 10);
    if (!v) v = 'PLAYER' + Math.floor(Math.random() * 90 + 10);
    try { localStorage.setItem('bb_name', v); } catch (e) {}
    return v;
  }

  /* --------------------------------------------------------------- rooms */
  function createRoom() {
    MP.name = myName();
    MP.isHost = true; MP.role = 'hunter';
    var code = (el('mpCode').value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '') || roomCode();
    connect(code, true);
  }
  function joinRoom() {
    var code = (el('mpCode').value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length < 4) { status('Type the room code your friend gave you.', true); return; }
    MP.name = myName();
    MP.isHost = false; MP.role = 'runner';
    connect(code, false);
  }

  function connect(code, isHost) {
    status('Connecting…');
    el('mpCreate').disabled = el('mpJoin').disabled = true;
    MP.code = code;
    MP.seed = hashStr('baldi-' + code);
    MP.relay = new Relay();
    MP.relay.start({
      isHost: isHost, code: code,
      onStatus: function (s, t) { if (!MP.active) status(t, s !== 'online'); },
      onMsg: isHost ? hostMsg : clientMsg
    }).then(function () {
      el('mpCreate').disabled = el('mpJoin').disabled = false;
      el('mpJoinBox').style.display = 'none';
      el('mpRoomBox').style.display = '';
      el('mpCodeOut').textContent = code;
      el('mpStart').style.display = isHost ? '' : 'none';
      MP.players = {};
      renderList();
      if (isHost) {
        status('Room open. Waiting for students to join…');
      } else {
        status('Looking for the room…');
        MP.joinTimer = setInterval(function () {
          if (MP.joined) { clearInterval(MP.joinTimer); return; }
          MP.relay.pub({ t: 'j', id: MP.id, n: MP.name });
        }, 1000);
        MP.relay.pub({ t: 'j', id: MP.id, n: MP.name });
        setTimeout(function () {
          if (!MP.joined) status('Nobody is hosting that code. Ask your friend to keep their tab open.', true);
        }, 9000);
      }
    }).catch(function (e) {
      el('mpCreate').disabled = el('mpJoin').disabled = false;
      status('Could not reach a relay (' + (e && e.message ? e.message : 'blocked') + ').', true);
    });
  }

  function leaveRoom() {
    if (MP.relay) {
      if (MP.relay.connected) MP.relay.pub(MP.isHost ? { t: 'end' } : { t: 'bye', id: MP.id });
      MP.relay.stop();
    }
    if (MP.joinTimer) clearInterval(MP.joinTimer);
    if (MP.lockTimer) { clearInterval(MP.lockTimer); MP.lockTimer = null; }
    el('mpClick').style.display = 'none';
    el('mpDragHint').style.display = 'none';
    el('mpPopBtn2').style.display = 'none';
    MP.dragging = false;
    document.body.classList.remove('mpMouseLocked');
    if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
    clearAvatars();
    MP.relay = null; MP.active = false; MP.joined = false; MP.players = {};
    MP.over = null; MP.caught = false; MP.escaped = false; MP.spectating = false;
    MP.teamNb = 0; MP.cds = {}; MP.revealT = MP.rageT = MP.stunT = 0;
    MP.rulers = [];
    el('mpHud').style.display = 'none';
    el('mpSkills').style.display = 'none';
    el('mpCaught').style.display = 'none';
    MP.inScare = false;
    MP.pendingResult = null;
    try {
      UI.el('staminaWrap').style.display = '';
      UI.el('nbCount').style.display = '';
      UI.el('items').style.display = '';
      UI.el('subtitle').style.bottom = '';
    } catch (e) {}
  }

  function renderList() {
    var list = el('mpList');
    var html = '<div><span class="who">' + MP.name + '</span> — ' +
      (MP.isHost ? 'BALDI (host)' : 'student') + ' <span style="color:#6f7">you</span></div>';
    for (var id in MP.players) {
      var p = MP.players[id];
      html += '<div><span class="who">' + p.name + '</span> — ' + (p.role === 'hunter' ? 'BALDI' : 'student') + '</div>';
    }
    var n = Object.keys(MP.players).length;
    if (MP.isHost) html += '<div style="color:#8b97b5;margin-top:6px">' +
      (n ? n + ' student' + (n === 1 ? '' : 's') + ' ready.' : 'Waiting for someone to join…') + '</div>';
    list.innerHTML = html;
  }

  /* ------------------------------------------------------- host messaging */
  function hostMsg(m) {
    if (m.t === 'j') {
      if (!MP.players[m.id]) {
        MP.players[m.id] = mkPlayer(m.id, m.n, 'runner');
        renderList();
      }
      MP.players[m.id].seen = now();
      MP.relay.pub({ t: 'lob', to: m.id, host: MP.name, started: MP.active ? 1 : 0, seed: MP.seed, total: MP.total });
    } else if (m.t === 'bye') {
      if (MP.players[m.id]) { removeAvatar(MP.players[m.id]); delete MP.players[m.id]; renderList(); }
    } else if (m.t === 'i') {
      var p = MP.players[m.id];
      if (!p) { MP.players[m.id] = p = mkPlayer(m.id, m.n || '???', 'runner'); renderList(); }
      p.seen = now();
      p.tx = m.x; p.tz = m.z; p.tyaw = m.y / 100;
      if (p.x === null) { p.x = m.x; p.z = m.z; p.yaw = p.tyaw; }
    } else if (m.t === 'nb') {
      takeNotebook(m.i, true);
    } else if (m.t === 'esc') {
      var e = MP.players[m.id];
      if (e && !e.caught && !e.escaped) {
        e.escaped = true;
        finish('runners', (e.name || 'A student') + ' got out of the school.');
      }
    }
  }

  /* ----------------------------------------------------- client messaging */
  function clientMsg(m) {
    if (m.t === 'lob') {
      if (m.to !== MP.id) return;
      if (!MP.joined) {
        MP.joined = true;
        clearInterval(MP.joinTimer);
        MP.seed = m.seed; MP.total = m.total;
        status('In the room. Waiting for ' + (m.host || 'the host') + ' to start…');
      }
      if (m.started && !MP.active) startMatch();
    } else if (m.t === 'go') {
      MP.seed = m.seed; MP.total = m.total;
      if (!MP.active) startMatch();
    } else if (m.t === 'w') {
      applyWorld(m);
    } else if (m.t === 'end') {
      status('The host closed the room.', true);
      if (MP.active) finish(null, 'The host left the game.');
      else { leaveRoom(); openLobby(); }
    }
  }

  function mkPlayer(id, name, role) {
    return {
      id: id, name: name, role: role, x: null, z: null, yaw: 0,
      tx: 0, tz: 0, tyaw: 0, caught: false, escaped: false, seen: now(), av: null
    };
  }

  /* --------------------------------------------------------- match start */
  var MP_CHAPTER = -1;
  function ensureChapter() {
    if (MP_CHAPTER >= 0) return MP_CHAPTER;
    CHAPTERS.push({
      n: 0, name: 'MULTIPLAYER', zones: 3, notebooks: 5,
      sub: 'One of you is Baldi.',
      cast: [], base: 2.30, step: 0.10, min: 1.05, hidden: true, multiplayer: true
    });
    MP_CHAPTER = CHAPTERS.length - 1;
    return MP_CHAPTER;
  }

  function hostStart() {
    if (!Object.keys(MP.players).length) { status('Nobody has joined yet.', true); return; }
    MP.relay.pub({ t: 'go', seed: MP.seed, total: MP.total });
    startMatch();
  }

  function startMatch() {
    MP.active = true; MP.over = null; MP.caught = false; MP.escaped = false;
    MP.spectating = false; MP.teamNb = 0; MP.cds = {};
    MP.revealT = MP.rageT = MP.stunT = 0; MP.rulers = [];
    el('mpLobby').style.display = 'none';
    el('mpLobby').classList.add('hidden');
    el('mpCaught').style.display = 'none';
    el('mpResult').style.display = 'none';
    MP.inScare = false;
    if (el('modeSelect')) el('modeSelect').classList.add('hidden');
    if (typeof Audio1 !== 'undefined') { Audio1.init(); Audio1.resume(); }

    var idx = ensureChapter();
    withSeed(MP.seed, function () { newGame(idx); });

    G.total = MP.total;
    G.notebooks = 0;
    UI.el('nbCount').innerHTML = '0/' + G.total + '<small>NOTEBOOKS</small>';

    MP.startT = now();
    var b = G.ents.baldi;
    if (MP.role === 'hunter') {
      /* you are Baldi: the AI body is hidden and you move as him */
      if (b) { b.disabled = 1; b.active = false; if (b.model && b.model.root) b.model.root.visible = false; }
      G.loadFactor = 1.18;
      UI.el('nbCount').style.display = 'none';
      UI.el('staminaWrap').style.display = 'none';   // he never runs out, and it sat on the skill row
      UI.el('items').style.display = 'none';         // and he carries nothing, so 1/2/3 are his
      UI.el('subtitle').style.bottom = '24%';        // clear of the chalkboards
      el('mpSkills').style.display = 'flex';
      /* start away from the class, the same way the AI Baldi would */
      var spot = null;
      try { spot = randomUnlockedCell(50) || randomUnlockedCell(0); } catch (e) {}
      if (spot) { G.player.x = spot.x; G.player.z = spot.z; }
      if (UI) UI.say('You are Baldi. Give them ' + HEAD_START + ' seconds, then hunt.', 4000);
    } else {
      if (b) { b.awake = true; b.anger = 0; }
      UI.el('nbCount').style.display = '';
      el('mpSkills').style.display = 'none';
      /* the class starts together but not stacked on one tile, or one slap
         would take everybody at once */
      var pl = G.player;
      for (var t = 0; t < 24; t++) {
        var a = Math.random() * Math.PI * 2, rr = 3 + Math.random() * 9;
        var nx = pl.x + Math.cos(a) * rr, nz = pl.z + Math.sin(a) * rr;
        if (!blockedAt(nx, nz, 1.0) && !blockedByProp(nx, nz, 1.0)) { pl.x = nx; pl.z = nz; break; }
      }
      if (UI) UI.say('Get the notebooks and reach an exit before Baldi finds you.', 4500);
    }
    el('mpHud').style.display = 'block';
    updateHud();
    ensureAvatars();

    MP.lockAttempts = 0; MP.triedFullscreen = false; MP.lockBlocked = false; MP.dragging = false;
    try { lockDenied = false; } catch (e) {}
    if (MP.lockTimer) clearInterval(MP.lockTimer);
    MP.lockTimer = setInterval(lockWatch, 200);
    lockWatch();
    /* Ask once now. On an ordinary page this either succeeds (the Start click
       is still a live gesture) or puts the click-to-look card up. On a page
       that forbids the lock it throws, and we switch to drag-look. */
    grabMouse();
  }

  /* ------------------------------------------------------------- avatars */
  function studentTexture(name, hue) {
    var c = document.createElement('canvas');
    c.width = 128; c.height = 256;
    var x = c.getContext('2d');
    x.clearRect(0, 0, 128, 256);
    /* body */
    x.fillStyle = 'hsl(' + hue + ',62%,52%)';
    x.fillRect(30, 96, 68, 108);
    x.fillStyle = 'hsl(' + hue + ',62%,42%)';
    x.fillRect(30, 186, 68, 18);
    /* arms */
    x.fillStyle = '#f0c9a0';
    x.fillRect(16, 100, 16, 74);
    x.fillRect(96, 100, 16, 74);
    /* legs */
    x.fillStyle = '#2f3a52';
    x.fillRect(40, 204, 20, 44);
    x.fillRect(70, 204, 20, 44);
    /* head */
    x.fillStyle = '#f7d6ae';
    x.beginPath(); x.arc(64, 66, 34, 0, Math.PI * 2); x.fill();
    x.fillStyle = 'hsl(' + ((hue + 200) % 360) + ',40%,26%)';
    x.beginPath(); x.arc(64, 56, 34, Math.PI, Math.PI * 2); x.fill();
    /* face */
    x.fillStyle = '#1a1a1a';
    x.beginPath(); x.arc(52, 68, 5, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.arc(76, 68, 5, 0, Math.PI * 2); x.fill();
    x.strokeStyle = '#1a1a1a'; x.lineWidth = 3;
    x.beginPath(); x.arc(64, 80, 11, 0.15 * Math.PI, 0.85 * Math.PI); x.stroke();
    /* name plate */
    x.fillStyle = 'rgba(0,0,0,.65)';
    x.fillRect(4, 4, 120, 26);
    x.fillStyle = '#ffe9a8';
    x.font = 'bold 18px monospace';
    x.textAlign = 'center';
    x.fillText(String(name).slice(0, 10), 64, 23);
    var tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    return tex;
  }

  function makeStudentAvatar(name, hue) {
    var tex = studentTexture(name, hue);
    var mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide });
    var mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 5.2), mat);
    mesh.position.y = 2.6;
    var root = new THREE.Group();
    root.add(mesh);
    return { root: root, mesh: mesh, mat: mat };
  }

  function ensureAvatars() {
    for (var id in MP.players) avatarFor(MP.players[id]);
  }
  function avatarFor(p) {
    if (p.role === 'hunter') return null;      // the hunter is the game's Baldi
    if (p.av) return p.av;
    if (!G.scene) return null;
    p.av = makeStudentAvatar(p.name, (hashStr(p.id) % 360));
    G.scene.add(p.av.root);
    return p.av;
  }
  function removeAvatar(p) {
    if (p && p.av && G.scene) { G.scene.remove(p.av.root); p.av = null; }
  }
  function clearAvatars() {
    for (var id in MP.players) removeAvatar(MP.players[id]);
  }

  /* ------------------------------------------------------------ notebooks */
  function takeNotebook(i, fromNet) {
    var n = G.nbList && G.nbList[i];
    if (!n || n.mpTaken) return;
    n.mpTaken = true;
    if (!n.taken) { n.taken = true; if (n.mesh && G.scene) G.scene.remove(n.mesh); }
    MP.teamNb++;
    G.notebooks = MP.teamNb;
    if (UI && UI.el('nbCount')) UI.el('nbCount').innerHTML = G.notebooks + '/' + G.total + '<small>NOTEBOOKS</small>';
    if (MP.teamNb >= G.total) {
      for (var k = 0; k < Map1.exits.length; k++) {
        var e = Map1.exits[k];
        if (e.bar && e.zone <= G.unlockedZones) e.bar.visible = false;
      }
      if (UI) UI.say(MP.role === 'hunter' ? 'ALL NOTEBOOKS GONE — GUARD THE EXITS!' : 'THAT IS ALL OF THEM — GET TO AN EXIT!', 4000);
      if (typeof Audio1 !== 'undefined') Audio1.bell();
    }
    updateHud();
  }

  function nearestNotebookIndex() {
    var best = -1, bd = 1e9;
    for (var i = 0; i < G.nbList.length; i++) {
      var n = G.nbList[i];
      var d = Math.hypot(n.x - G.player.x, n.z - G.player.z);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  /* ------------------------------------------------------------ the match */
  function finish(winner, why) {
    if (MP.over) return;
    MP.over = winner || 'none';
    if (MP.isHost && MP.relay) {
      MP.relay.pub({ t: 'w', k: ++MP.tick, p: worldPlayers(), nb: MP.teamNb, over: winner || 'none', why: why || '' });
    }
    /* if the jumpscare is on screen, let it finish before covering it up */
    if (MP.inScare) { MP.pendingResult = { w: winner, why: why }; return; }
    showResult(winner, why);
  }

  function showResult(winner, why) {
    var won = (winner === 'hunter' && MP.role === 'hunter') || (winner === 'runners' && MP.role === 'runner');
    el('mpResultTitle').textContent = winner === 'hunter' ? 'BALDI WINS' : (winner === 'runners' ? 'THE STUDENTS WIN' : 'MATCH OVER');
    el('mpResultTitle').style.color = won ? '#7dfa9a' : '#ff8f84';
    el('mpResultText').textContent = why || '';
    el('mpCaught').style.display = 'none';
    el('mpResult').style.display = 'flex';
    el('mpHud').style.display = 'none';
    el('mpSkills').style.display = 'none';
    G.mode = 'over';
    G.running = false;
    document.exitPointerLock && document.exitPointerLock();
  }

  function flashRed() {
    var f = el('mpFlash');
    f.style.opacity = '0.75';
    setTimeout(function () { f.style.opacity = '0'; }, 220);
  }

  /* the real thing: hand over to the game's own jumpscare, then land on our
     own screen instead of the title */
  function getCaught() {
    if (MP.caught) return;
    MP.caught = true;
    MP.spectating = true;
    el('mpHud').style.display = 'none';
    el('mpSkills').style.display = 'none';
    var b = G.ents && G.ents.baldi;
    if (b && b.model && G.mode !== 'over') {
      var hunter = null;
      for (var id in MP.players) if (MP.players[id].role === 'hunter') hunter = MP.players[id];
      if (hunter && hunter.x !== null) { b.x = hunter.x; b.z = hunter.z; }
      if (b.model.root) b.model.root.visible = true;
      MP.inScare = true;
      try { origCaught(b); return; } catch (e) { MP.inScare = false; }
    }
    flashRed();
    if (typeof Audio1 !== 'undefined') { try { Audio1.slap(); } catch (e) {} }
    showCaughtScreen();
  }

  function showCaughtScreen() {
    if (MP.over) return;
    el('mpCaught').style.display = 'flex';
    el('mpHud').style.display = 'none';
    el('mpSkills').style.display = 'none';
  }

  /* ------------------------------------------------------ world snapshots */
  function worldPlayers() {
    var out = [];
    /* the host is Baldi */
    out.push([MP.id, Math.round(G.player.x * 10), Math.round(G.player.z * 10),
      Math.round(G.player.yaw * 100), 1, 0, 'h', MP.name]);
    for (var id in MP.players) {
      var p = MP.players[id];
      out.push([id, Math.round((p.tx || 0) * 10), Math.round((p.tz || 0) * 10),
        Math.round((p.tyaw || 0) * 100), p.caught ? 0 : 1, p.stunUntil && p.stunUntil > now() ? 1 : 0, 'r', p.name]);
    }
    return out;
  }

  function applyWorld(m) {
    MP.lastWorld = now();
    if (typeof m.gr === 'number') MP.graceRemote = m.gr;
    if (typeof m.nb === 'number' && m.nb > MP.teamNb) {
      while (MP.teamNb < m.nb) {
        /* the host already knows which ones; mark the closest untaken */
        var idx = -1;
        for (var i = 0; i < G.nbList.length; i++) if (!G.nbList[i].mpTaken) { idx = i; break; }
        if (idx < 0) break;
        takeNotebook(idx, true);
      }
    }
    if (m.tk && m.tk.length) for (var t = 0; t < m.tk.length; t++) takeNotebook(m.tk[t], true);

    var seen = {};
    for (var j = 0; j < m.p.length; j++) {
      var row = m.p[j], id = row[0];
      if (id === MP.id) {
        if (!row[4] && !MP.caught) getCaught();
        if (row[5]) MP.stunT = Math.max(MP.stunT, 0.4);
        continue;
      }
      var p = MP.players[id];
      if (!p) { p = MP.players[id] = mkPlayer(id, row[7] || '???', row[6] === 'h' ? 'hunter' : 'runner'); }
      p.name = row[7] || p.name;
      p.role = row[6] === 'h' ? 'hunter' : 'runner';
      p.tx = row[1] / 10; p.tz = row[2] / 10; p.tyaw = row[3] / 100;
      p.caught = !row[4];
      if (p.x === null) { p.x = p.tx; p.z = p.tz; p.yaw = p.tyaw; }
      p.seen = now();
      seen[id] = 1;
    }
    for (var k in MP.players) if (!seen[k]) { removeAvatar(MP.players[k]); delete MP.players[k]; }

    if (m.over && !MP.over) finish(m.over === 'none' ? null : m.over, m.why);
    updateHud();
  }

  /* ------------------------------------------------------------- HUD + skills */
  function updateHud() {
    if (!MP.active) return;
    var alive = 0, total = 0, caughtN = 0;
    for (var id in MP.players) {
      var p = MP.players[id];
      if (p.role !== 'runner') continue;
      total++;
      if (p.caught) caughtN++; else alive++;
    }
    if (MP.role === 'runner') {
      total++;
      if (MP.caught) caughtN++; else alive++;
    }
    var h = el('mpHud');
    /* the host owns the clock: students show the number he sends them, so
       both sides count down together */
    var grace = MP.isHost
      ? Math.max(0, HEAD_START - (now() - (MP.startT || 0)))
      : Math.max(0, MP.graceRemote || 0);
    var grtxt = grace > 0 ? '<span style="color:#ffd76a">HEAD START ' + Math.ceil(grace) + 's</span> · ' : '';
    if (MP.role === 'hunter') {
      h.innerHTML = grtxt + '<span class="tag">YOU ARE BALDI</span> — catch them all · <b>' + alive + '</b> still running' +
        (caughtN ? ' · ' + caughtN + ' caught' : '') + ' · notebooks <b>' + MP.teamNb + '/' + G.total + '</b>' +
        '<br><span style="font-size:11px;color:#94a3c4">press 1, 2 or 3 to use a skill</span>';
    } else {
      h.innerHTML = grtxt + '<span class="tag">STUDENT</span> · team notebooks <b>' + MP.teamNb + '/' + G.total + '</b>' +
        ' · <b>' + alive + '</b> still running' +
        (MP.caught ? '<br><span style="color:#ff8f84">you were caught — watching</span>' : '');
    }
  }

  function skillReady(id) { return (MP.cds[id] || 0) <= 0; }

  /* also handy from the console: MP.useSkill('ruler') */
  MP.useSkill = function (id) {
    for (var i = 0; i < SKILLS.length; i++) if (SKILLS[i].id === id) return useSkill(SKILLS[i]);
  };
  MP.SKILLS = SKILLS;

  function useSkill(s) {
    if (!MP.active || MP.role !== 'hunter' || MP.over || MP.caught) return;
    if (!skillReady(s.id)) { if (UI) UI.say(s.name + ' is not ready yet!', 1200); return; }
    MP.cds[s.id] = s.cd;
    popSkill(s.id);
    if (s.id === 'listen') {
      MP.revealT = 5;
      if (UI) UI.say('I HEAR YOU…', 1600);
      if (typeof Audio1 !== 'undefined') { try { Audio1.bell(); } catch (e) {} }
    } else if (s.id === 'ruler') {
      throwRuler();
      if (UI) UI.say('CATCH!', 1200);
    } else if (s.id === 'anger') {
      MP.rageT = 6;
      if (UI) UI.say('YOU MADE ME ANGRY!', 2000);
      if (typeof Audio1 !== 'undefined') { try { Audio1.slap(); } catch (e) {} }
    }
    drawSkillBar();
  }

  function throwRuler() {
    var p = G.player;
    var geo = new THREE.BoxGeometry(0.35, 0.12, 2.2);
    var mat = new THREE.MeshBasicMaterial({ color: 0xe8c25a });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(p.x, 3.2, p.z);
    G.scene.add(mesh);
    MP.rulers.push({
      mesh: mesh, x: p.x, z: p.z, life: 1.6,
      vx: -Math.sin(p.yaw) * 34, vz: -Math.cos(p.yaw) * 34
    });
    if (typeof Audio1 !== 'undefined') { try { Audio1.slap(); } catch (e) {} }
  }


  /* the chalk line under the drawing fills back in as the skill recharges */
  function drawSkillBar() {
    for (var i = 0; i < SKILLS.length; i++) {
      var s = SKILLS[i];
      var d = el('mpsk_' + s.id);
      if (!d) continue;
      var cd = MP.cds[s.id] || 0;
      var line = d.querySelector('.line');
      if (line) line.style.transform = 'scaleX(' + (1 - clamp01(cd / s.cd)).toFixed(3) + ')';
      var num = d.querySelector('.num');
      if (num) num.textContent = cd > 0 ? String(Math.ceil(cd)) : '';
      var cooling = cd > 0;
      if (d.classList.contains('cooling') !== cooling) d.classList.toggle('cooling', cooling);
    }
  }

  /* a quick chalk squeak of a pop when one goes off */
  function popSkill(id) {
    var d = el('mpsk_' + id);
    if (!d) return;
    d.classList.add('fire');
    setTimeout(function () { d.classList.remove('fire'); }, 130);
  }

  /* -------------------------------------------------------------- patches */
  var origUpdatePlayer = window.updatePlayer;
  var origUpdateBaldi = window.updateBaldi;
  var origCheckExits = window.checkExits;
  var origDrawMinimap = window.drawMinimap;
  var origCaught = window.caught;
  var origTryGrab = window.tryGrabNotebook;
  var origCheckPickups = window.checkPickups;
  var origReturnToTitle = window.returnToTitle;
  var origMathFinish = (typeof Math1 !== 'undefined') ? Math1.finish : null;

  window.updatePlayer = function (dt) {
    if (!MP.active) return origUpdatePlayer(dt);
    var p = G.player;

    /* being caught leaves you watching, not walking */
    if (MP.caught || MP.over) p.stuck = 1;
    if (MP.stunT > 0) { MP.stunT -= dt; p.stuck = 1; }
    else if (!MP.caught && !MP.over && p.stuck === 1) p.stuck = 0;

    if (MP.role === 'hunter') {
      p.energy = 5;                                    // Baldi never runs out of breath
      G.loadFactor = 1.18 * (MP.rageT > 0 ? 1.62 : 1);
    }

    origUpdatePlayer(dt);

    tickTimers(dt);
    moveRulers(dt);
    if (MP.role === 'hunter') hunterCatch(dt);
    syncAvatars(dt);
    sendState(dt);
    if (MP.isHost) hostTick(dt);
    MP.hudAcc = (MP.hudAcc || 0) + dt;
    if (MP.hudAcc > 0.25) { MP.hudAcc = 0; updateHud(); }
    drawSkillBar();
  };

  function tickTimers(dt) {
    for (var k in MP.cds) if (MP.cds[k] > 0) MP.cds[k] = Math.max(0, MP.cds[k] - dt);
    if (MP.revealT > 0) MP.revealT -= dt;
    if (MP.rageT > 0) MP.rageT -= dt;
  }

  function moveRulers(dt) {
    for (var i = MP.rulers.length - 1; i >= 0; i--) {
      var r = MP.rulers[i];
      r.life -= dt;
      r.x += r.vx * dt; r.z += r.vz * dt;
      r.mesh.position.set(r.x, 3.2, r.z);
      r.mesh.rotation.y += dt * 14;
      var dead = r.life <= 0 || (typeof blockedAt === 'function' && blockedAt(r.x, r.z, 0.4));
      if (!dead) {
        for (var id in MP.players) {
          var p = MP.players[id];
          if (p.role !== 'runner' || p.caught || p.x === null) continue;
          if (Math.hypot(p.x - r.x, p.z - r.z) < 2.0) {
            p.stunUntil = now() + 2.5;
            dead = true;
            if (UI) UI.say('RULER HIT ' + p.name, 1600);
            break;
          }
        }
      }
      if (dead) { G.scene.remove(r.mesh); MP.rulers.splice(i, 1); }
    }
  }

  function hunterCatch() {
    if (MP.over) return;
    if (now() - (MP.startT || 0) < HEAD_START) return;
    var reach = MP.rageT > 0 ? RAGE_CATCH_R : CATCH_R;
    var left = 0, any = false;
    for (var id in MP.players) {
      var p = MP.players[id];
      if (p.role !== 'runner') continue;
      any = true;
      if (p.caught) continue;
      if (p.x !== null && Math.hypot(p.x - G.player.x, p.z - G.player.z) < reach) {
        p.caught = true;
        if (typeof Audio1 !== 'undefined') { try { Audio1.slap(); } catch (e) {} }
        if (UI) UI.say('CAUGHT ' + p.name + '!', 2500);
        flashRed();
      }
      if (!p.caught) left++;
    }
    if (any && left === 0) finish('hunter', 'Baldi caught every student.');
  }

  function syncAvatars(dt) {
    var k = Math.min(1, dt * 9);
    for (var id in MP.players) {
      var p = MP.players[id];
      if (p.x === null) continue;
      p.x += (p.tx - p.x) * k;
      p.z += (p.tz - p.z) * k;
      var d = ((p.tyaw - p.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
      p.yaw += d * k;

      if (p.role === 'hunter') {
        var b = G.ents.baldi;
        if (b) {
          b.x = p.x; b.z = p.z;
          if (b.model && b.model.root) {
            b.model.root.visible = !p.caught;
            b.model.root.position.set(p.x, 0, p.z);
            b.model.root.rotation.y = p.yaw + Math.PI;
          }
        }
        continue;
      }
      var av = avatarFor(p);
      if (!av) continue;
      av.root.visible = !p.caught;
      av.root.position.set(p.x, 0, p.z);
      /* billboard towards the camera */
      av.root.rotation.y = Math.atan2(G.camera.position.x - p.x, G.camera.position.z - p.z);
      var seeThrough = (MP.role === 'hunter' && MP.revealT > 0);
      if (av.mat.depthTest === seeThrough) {          // toggled: three.js needs telling
        av.mat.depthTest = !seeThrough;
        av.mat.needsUpdate = true;
      }
      av.mat.opacity = seeThrough ? 0.85 : 1;
      av.mat.transparent = true;
    }
  }

  function sendState(dt) {
    MP.sendAcc += dt;
    if (MP.sendAcc < 1 / SEND_HZ || !MP.relay || !MP.relay.connected) return;
    MP.sendAcc = 0;
    var p = G.player;
    if (MP.isHost) {
      MP.relay.pub({
        t: 'w', k: ++MP.tick, p: worldPlayers(), nb: MP.teamNb,
        gr: Math.round(Math.max(0, HEAD_START - (now() - (MP.startT || 0))) * 10) / 10,
        over: MP.over || 0, why: ''
      });
    } else {
      MP.relay.pub({
        t: 'i', id: MP.id, n: MP.name,
        x: Math.round(p.x * 10) / 10, z: Math.round(p.z * 10) / 10,
        y: Math.round(p.yaw * 100)
      });
    }
  }

  function hostTick() {
    /* drop players who stopped talking to us — but a caught one has gone quiet
       on purpose, they are sitting on the jumpscare screen watching */
    for (var id in MP.players) {
      var p = MP.players[id];
      if (p.caught) continue;
      if (now() - p.seen > 12) { removeAvatar(p); delete MP.players[id]; renderList(); }
    }
  }

  /* Baldi's body is driven by the network, never by the AI, during a match */
  window.updateBaldi = function (dt) {
    if (!MP.active) return origUpdateBaldi(dt);
    var b = G.ents.baldi;
    if (!b || !b.model) return;
    if (MP.role === 'hunter') { if (b.model.root) b.model.root.visible = false; return; }
    var moving = 0;
    for (var id in MP.players) if (MP.players[id].role === 'hunter') moving = 1;
    try { b.model.update(dt, { speed: moving ? 1 : 0, anger: MP.teamNb >= G.total ? 1 : 0.4 }); } catch (e) {}
  };

  /* students share one pile of notebooks */
  if (origMathFinish) {
    Math1.finish = function (allDone) {
      if (!MP.active) return origMathFinish.call(Math1, allDone);
      var before = G.notebooks;
      origMathFinish.call(Math1, allDone);
      G.notebooks = before;                       // the team count is the truth
      var i = (MP.pendingNb != null) ? MP.pendingNb : nearestNotebookIndex();
      MP.pendingNb = null;
      if (i >= 0) {
        if (MP.isHost) takeNotebook(i, false);
        else { takeNotebook(i, false); MP.relay.pub({ t: 'nb', i: i, id: MP.id }); }
      }
    };
  }

  window.tryGrabNotebook = function () {
    if (MP.active && MP.role === 'hunter') return false;   // Baldi does no homework
    if (MP.active) {
      var p = G.player, best = -1, bd = 1e9;
      for (var i = 0; i < G.nbList.length; i++) {
        var n = G.nbList[i];
        if (n.taken || n.mpTaken) continue;
        var d = Math.hypot(n.x - p.x, n.z - p.z);
        if (d < 8 && d < bd) { bd = d; best = i; }
      }
      MP.pendingNb = best >= 0 ? best : null;
    }
    return origTryGrab();
  };

  window.checkPickups = function () {
    if (MP.active && MP.role === 'hunter') return;         // he cannot take notebooks
    if (MP.active) {
      var p = G.player;
      for (var i = 0; i < G.nbList.length; i++) {
        var n = G.nbList[i];
        if (n.taken || n.mpTaken) continue;
        if (Math.hypot(n.x - p.x, n.z - p.z) < 2.8) { MP.pendingNb = i; break; }
      }
    }
    return origCheckPickups();
  };

  /* reaching an exit ends the match for everyone */
  window.checkExits = function () {
    if (!MP.active) return origCheckExits();
    if (MP.role === 'hunter' || MP.caught || MP.over) return;
    var p = G.player;
    for (var i = 0; i < Map1.exits.length; i++) {
      var e = Map1.exits[i];
      if (e.zone > G.unlockedZones) continue;
      if (Math.hypot(e.wx - p.x, e.wz - p.z) > 3.2) continue;
      if (MP.teamNb < G.total) {
        UI.el('prompt').classList.remove('hidden');
        UI.el('prompt').textContent = 'LOCKED — the class still needs ' + (G.total - MP.teamNb) + ' notebooks';
        return;
      }
      MP.escaped = true;
      if (MP.isHost) finish('runners', 'A student got out of the school.');
      else {
        MP.relay.pub({ t: 'esc', id: MP.id });
        finish('runners', 'You got out of the school!');
      }
      return;
    }
  };

  /* the single player death screen must not fire during a match */
  window.caught = function (who) {
    if (!MP.active) return origCaught(who);
    getCaught();
  };

  window.returnToTitle = function () {
    /* the jumpscare finishes by going to the title screen — in a match we stay
       in the room instead and watch the rest of it */
    if (MP.active && MP.inScare) {
      MP.inScare = false;
      var r = origReturnToTitle();
      if (MP.pendingResult) {
        var pr = MP.pendingResult;
        MP.pendingResult = null;
        showResult(pr.w, pr.why);
      } else {
        showCaughtScreen();
      }
      return r;
    }
    if (MP.active) leaveRoom();
    return origReturnToTitle();
  };

  window.drawMinimap = function () {
    origDrawMinimap();
    if (!MP.active) return;
    if (typeof mmCtx === 'undefined' || !mmCtx) return;
    var x = mmCtx, S = 3;                     // same cell scale the game uses
    function put(wx, wz, color, r) {
      x.fillStyle = color;
      x.beginPath();
      x.arc((wx / CS) * S, (wz / CS) * S, r, 0, Math.PI * 2);
      x.fill();
    }
    for (var id in MP.players) {
      var p = MP.players[id];
      if (p.x === null || p.caught) continue;
      if (p.role === 'hunter') put(p.x, p.z, '#4ee36b', 3.2);
      else if (MP.role === 'hunter' && MP.revealT > 0) put(p.x, p.z, '#ff5f5f', 3);
      else if (MP.role === 'runner') put(p.x, p.z, '#7fd7ff', 2.6);
    }
  };

  /* ---------------------------------------------------------------- input */
  /* ------------------------------------------------------------ mouse look
     Strict FPS look: only relative movementX/movementY is allowed to rotate
     the camera. Cursor position, screen edges and mouse buttons never do. */
  function pointerIsLocked() {
    var v = document.getElementById('view');
    return document.pointerLockElement === v || !!document.pointerLockElement;
  }

  function grabMouse() {
    var view = document.getElementById('view');
    if (!view || !view.requestPointerLock) return;
    MP.lockAttempts = (MP.lockAttempts || 0) + 1;
    try { lockDenied = false; } catch (e) {}
    G.paused = false;

    /* Some embedded pages need to become the root document before pointer
       lock is legal. A retry click requests fullscreen first. */
    if (MP.lockAttempts > 1 && !document.fullscreenElement && !MP.triedFullscreen) {
      fullscreenRetry();
      return;
    }

    var pr = null, threw = false;
    /* unadjustedMovement skips the desktop's mouse acceleration curve, which
       is what makes a browser FPS feel right */
    try { pr = view.requestPointerLock({ unadjustedMovement: true }); }
    catch (e) { pr = null; threw = true; }
    if (pr === undefined && !threw) return;             // old API, events will tell us
    if (!pr) {
      /* a sandboxed frame throws here rather than firing pointerlockerror */
      try { view.requestPointerLock(); }
      catch (e2) { MP.lockBlocked = true; lockWatch(); }
      return;
    }
    if (pr.catch) {
      pr.catch(function () {
        var p2;
        try { p2 = view.requestPointerLock(); } catch (e) { fullscreenRetry(); return; }
        if (p2 && p2.catch) p2.catch(function () { fullscreenRetry(); });
      });
    }
  }

  /* Inside an iframe a lock can be refused with "the root document of this
     element is not valid" — going fullscreen first makes it the root. */
  function fullscreenRetry() {
    if (MP.triedFullscreen) { MP.lockBlocked = true; lockWatch(); return; }
    MP.triedFullscreen = true;
    var root = document.documentElement;
    var fs = root.requestFullscreen || root.webkitRequestFullscreen || root.mozRequestFullScreen;
    if (!fs || document.fullscreenElement) return;
    var again = function () {
      setTimeout(function () {
        var view = document.getElementById('view');
        try { lockDenied = false; view.requestPointerLock(); } catch (e) {}
      }, 260);
    };
    var r;
    try { r = fs.call(root); } catch (e) { return; }
    if (r && r.then) r.then(again, function () {}); else again();
  }

  /* Keep the click-to-look card in step with the real lock state, and never
     let the single player pause screen freeze a live match. */
  function lockWatch() {
    if (!MP.active) {
      el('mpClick').style.display = 'none';
      document.body.classList.remove('mpMouseLocked');
      return;
    }
    if (G.paused) {
      G.paused = false;
      var ph = UI.el('pauseHint');
      if (ph) ph.classList.add('hidden');
    }
    var playing = G.mode === 'play' && !MP.over && !MP.caught;
    if (!playing) {
      el('mpClick').style.display = 'none';
      document.body.classList.remove('mpMouseLocked');
      return;
    }
    var locked = pointerIsLocked();
    if (!locked) { try { lockDenied = false; } catch (e) {} }
    var lh = UI.el('lookHint');
    if (lh) lh.classList.add('hidden');
    document.body.classList.toggle('mpMouseLocked', locked || MP.dragging);
    /* three states: locked, loose but lockable, or a page that will never
       grant the lock — the last one gets drag-look instead */
    el('mpClick').style.display = (locked || MP.lockBlocked) ? 'none' : 'flex';
    var showDrag = !locked && MP.lockBlocked && !MP.dragging;
    el('mpDragHint').style.display = showDrag ? 'block' : 'none';
    el('mpPopBtn2').style.display = (showDrag && window.top !== window.self) ? 'block' : 'none';
  }

  /* Hold the right button and move. Same relative movement as a locked mouse,
     and no screen edge to run into: release and re-grip works like lifting a
     mouse off the mat. Left click stays as shoot. */
  function bindDragLook() {
    var canLook = function () {
      return MP.active && !MP.over && !MP.caught && G.mode === 'play' && !pointerIsLocked();
    };
    window.addEventListener('mousedown', function (e) {
      if (!canLook() || (e.button !== 2 && e.button !== 1)) return;
      MP.dragging = true;
      document.body.classList.add('mpMouseLocked');
      el('mpDragHint').style.display = 'none';
      e.preventDefault(); e.stopImmediatePropagation();
    }, true);
    window.addEventListener('mouseup', function (e) {
      if (!MP.dragging || (e.button !== 2 && e.button !== 1)) return;
      MP.dragging = false;
      document.body.classList.remove('mpMouseLocked');
      lockWatch();
      e.preventDefault(); e.stopImmediatePropagation();
    }, true);
    window.addEventListener('contextmenu', function (e) { if (MP.active) e.preventDefault(); });
  }

  function bindLook() {
    bindDragLook();
    el('mpClick').addEventListener('mousedown', function (e) {
      e.preventDefault();
      e.stopPropagation();
      grabMouse();
    });
    document.addEventListener('pointerlockchange', function () {
      if (pointerIsLocked()) MP.lockAttempts = 0;
      lockWatch();
    });
    document.addEventListener('pointerlockerror', function (e) {
      if (!MP.active) return;
      /* Apps Script frames the page with a sandbox that has no
         allow-pointer-lock, so the lock can never be granted there. Stop the
         original edge-of-screen handler and offer drag-look instead. */
      e.stopImmediatePropagation();
      try { lockDenied = false; } catch (err) {}
      G.paused = false;
      MP.lockBlocked = true;
      lockWatch();
    }, true);

    /* The original game's unlocked handler rotates from cursor position and
       stops at the screen edge. Only a held-button drag may turn the view.
       On window, so it sees every move before the game's own listener. */
    window.addEventListener('mousemove', function (e) {
      if (!MP.active || pointerIsLocked()) return;
      if (MP.dragging && G.mode === 'play' && !MP.over && !MP.caught) {
        var p = G.player;
        p.yaw -= (e.movementX || 0) * 0.0026;
        p.pitch = Math.max(-1.25, Math.min(1.25, p.pitch - (e.movementY || 0) * 0.0026));
      }
      e.preventDefault();
      e.stopImmediatePropagation();
    }, true);
  }

  /* one key per skill, and the tiles are clickable too when the mouse is free */
  function bindInput() {
    window.addEventListener('keydown', function (e) {
      if (!MP.active || MP.role !== 'hunter' || e.repeat) return;
      if (document.activeElement && /input|textarea/i.test(document.activeElement.tagName)) return;
      for (var i = 0; i < SKILLS.length; i++) {
        if (e.code === SKILLS[i].code || e.code === 'Numpad' + SKILLS[i].key) {
          useSkill(SKILLS[i]);
          e.preventDefault();
          e.stopImmediatePropagation();   // keep it off the game's item slots
          return;
        }
      }
    }, true);
  }

  function bindSkillClicks() {
    SKILLS.forEach(function (s) {
      var d = el('mpsk_' + s.id);
      if (!d) return;
      d.style.pointerEvents = 'auto';
      d.style.cursor = 'pointer';
      d.addEventListener('click', function () { useSkill(s); });
    });
  }

  /* ----------------------------------------------------------------- boot */
  function start() {
    if (!document.getElementById('modeCards')) { setTimeout(start, 200); return; }
    injectUI();
    bindInput();
    bindLook();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

})();
