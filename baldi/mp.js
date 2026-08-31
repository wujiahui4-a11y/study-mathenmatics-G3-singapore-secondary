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
    cds: {}, sprintT: 0, revealT: 0, rageT: 0, stunT: 0,
    rulers: [], wheelOpen: false, wheelVec: { x: 0, y: 0 }, wheelPick: -1
  };

  var SEND_HZ = 12;
  var CATCH_R = 2.3;
  var RAGE_CATCH_R = 3.6;
  var HEAD_START = 10;      // seconds before Baldi can catch anyone
  var RING = 2 * Math.PI * 27;   // circumference of the cooldown ring

  var SKILLS = [
    { id: 'sprint', name: 'SPRINT', cd: 14, desc: '4s of speed' },
    { id: 'listen', name: 'LISTEN', cd: 20, desc: 'see them for 5s' },
    { id: 'ruler', name: 'RULER', cd: 12, desc: 'throw, stuns 2.5s' },
    { id: 'warp', name: 'WARP', cd: 30, desc: 'jump to a notebook' },
    { id: 'rage', name: 'RAGE', cd: 26, desc: '6s, longer reach' }
  ];

  /* drawn icons, not emoji: each is a set of 24x24 paths used both as inline
     SVG on the buttons and as Path2D on the wheel canvas */
  var ICONS = {
    sprint: [{ d: 'M13.4 2.2 5 13.4h5.1l-1.1 8.4L19 10.2h-5.2z', fill: true }],
    listen: [{ d: 'M7.4 9.6a2.7 2.7 0 1 0 0 5.4 2.7 2.7 0 0 0 0-5.4z', fill: true },
             { d: 'M12.2 8.1a5.6 5.6 0 0 1 0 8.4' },
             { d: 'M15.9 5a10.2 10.2 0 0 1 0 14.6' }],
    ruler: [{ d: 'M3.2 14.9 14.9 3.2l5.9 5.9L9.1 20.8z' },
            { d: 'M6.7 11.5 8.9 13.7' }, { d: 'M9.7 8.5 11.9 10.7' }, { d: 'M12.7 5.5 14.9 7.7' }],
    warp: [{ d: 'M12 3.6a8.4 8.4 0 1 1-7.8 11.5' },
           { d: 'M12 7.9a4.2 4.2 0 1 0 3.9 5.7' },
           { d: 'M4.2 15.1 2.4 12.2M4.2 15.1 7.5 14.6' }],
    rage: [{ d: 'M4.6 8.1 10.2 11' }, { d: 'M19.4 8.1 13.8 11' },
           { d: 'M8.8 13.9v2.1' }, { d: 'M15.2 13.9v2.1' },
           { d: 'M8.2 19.5q3.8-2.9 7.6 0' }]
  };

  function iconSvg(id, cls) {
    var d = ICONS[id] || [];
    var inner = '';
    for (var i = 0; i < d.length; i++) {
      inner += '<path d="' + d[i].d + '"' + (d[i].fill ? ' fill="currentColor" stroke="none"' : '') + '/>';
    }
    return '<svg class="' + (cls || 'ico') + '" viewBox="0 0 24 24" aria-hidden="true">' + inner + '</svg>';
  }

  /* the same paths, painted onto the wheel canvas */
  function iconOnCanvas(x, id, cx, cy, size, color) {
    var defs = ICONS[id];
    if (!defs || typeof Path2D === 'undefined') return;
    x.save();
    x.translate(cx - size / 2, cy - size / 2);
    x.scale(size / 24, size / 24);
    x.lineWidth = 2; x.lineCap = 'round'; x.lineJoin = 'round';
    x.strokeStyle = color; x.fillStyle = color;
    for (var i = 0; i < defs.length; i++) {
      var p = new Path2D(defs[i].d);
      if (defs[i].fill) x.fill(p); else x.stroke(p);
    }
    x.restore();
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
      '#mpSkills{position:fixed;left:50%;bottom:40px;transform:translateX(-50%);z-index:40;display:none;gap:16px}',
      '#mpSkills .sk{position:relative;width:60px;height:60px}',
      '#mpSkills .sk .ring{position:absolute;inset:0;width:60px;height:60px;transform:rotate(-90deg)}',
      '#mpSkills .sk .ring .track{fill:rgba(9,13,22,.82);stroke:rgba(255,255,255,.15);stroke-width:3}',
      '#mpSkills .sk .ring .sweep{fill:none;stroke:#7fd7ff;stroke-width:3;stroke-linecap:round}',
      '#mpSkills .sk .ico{position:absolute;left:50%;top:50%;width:27px;height:27px;',
      'transform:translate(-50%,-50%);color:#dbe6ff;fill:none;stroke:currentColor;stroke-width:2;',
      'stroke-linecap:round;stroke-linejoin:round}',
      '#mpSkills .sk .num{position:absolute;inset:0;display:none;place-items:center;',
      'font:800 18px system-ui,sans-serif;color:#fff;text-shadow:0 2px 6px #000}',
      '#mpSkills .sk .nm{position:absolute;left:50%;top:64px;transform:translateX(-50%);',
      'font:700 9px system-ui,sans-serif;letter-spacing:.7px;color:#8f9dbd;white-space:nowrap}',
      '#mpSkills .sk.ready .ring .track{stroke:rgba(127,215,255,.5)}',
      '#mpSkills .sk.ready .ico{color:#fff}',
      '#mpSkills .sk.cooling .ico{opacity:.25}',
      '#mpSkills .sk.cooling .num{display:grid}',
      '#mpSkills .sk.cooling .ring .sweep{stroke:#4d6cf5}',
      '#mpWheel{position:fixed;inset:0;z-index:60;display:none;pointer-events:none}',
      '#mpResult{position:fixed;inset:0;z-index:75;display:none;align-items:center;justify-content:center;',
      'background:rgba(4,8,14,.9);color:#fff;font-family:inherit;text-align:center}',
      '#mpResult .r{max-width:460px}',
      '#mpResult h2{font-size:40px;margin:0 0 10px;letter-spacing:2px}',
      '#mpResult p{color:#a9b6d3;font-size:14px;line-height:1.6;margin:0 0 18px}',
      '#mpResult button{background:#4d6cf5;border:0;color:#fff;border-radius:8px;padding:12px 26px;',
      'font:inherit;font-size:14px;font-weight:700;cursor:pointer}',
      '#mpFlash{position:fixed;inset:0;z-index:55;background:#c0392b;opacity:0;pointer-events:none;transition:opacity .18s}',
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
      '    <div id="mpStatus"></div>',
      '    <div class="row"><button id="mpBack" class="ghost">BACK</button></div>',
      '  </div>',
      '</div>',
      '<div id="mpHud"></div>',
      '<div id="mpSkills"></div>',
      '<canvas id="mpWheel"></canvas>',
      '<div id="mpFlash"></div>',
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
    el('mpCreate').addEventListener('click', function () { createRoom(); });
    el('mpJoin').addEventListener('click', function () { joinRoom(); });
    el('mpLeave').addEventListener('click', function () { leaveRoom(); openLobby(); });
    el('mpStart').addEventListener('click', function () { hostStart(); });
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
    el('mpCode').addEventListener('keydown', function (e) { if (e.key === 'Enter') joinRoom(); });

    var skills = el('mpSkills');
    SKILLS.forEach(function (s) {
      var d = document.createElement('div');
      d.className = 'sk';
      d.id = 'mpsk_' + s.id;
      d.innerHTML =
        '<svg class="ring" viewBox="0 0 60 60">' +
        '<circle class="track" cx="30" cy="30" r="27"/>' +
        '<circle class="sweep" cx="30" cy="30" r="27" stroke-dasharray="' + RING + '" stroke-dashoffset="0"/>' +
        '</svg>' + iconSvg(s.id) +
        '<span class="num"></span><span class="nm">' + s.name + '</span>';
      skills.appendChild(d);
    });
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
    clearAvatars();
    MP.relay = null; MP.active = false; MP.joined = false; MP.players = {};
    MP.over = null; MP.caught = false; MP.escaped = false; MP.spectating = false;
    MP.teamNb = 0; MP.cds = {}; MP.sprintT = MP.revealT = MP.rageT = MP.stunT = 0;
    MP.rulers = [];
    el('mpHud').style.display = 'none';
    el('mpSkills').style.display = 'none';
    el('mpWheel').style.display = 'none';
    el('mpCaught').style.display = 'none';
    MP.inScare = false;
    MP.pendingResult = null;
    try { UI.el('staminaWrap').style.display = ''; UI.el('nbCount').style.display = ''; } catch (e) {}
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
    MP.sprintT = MP.revealT = MP.rageT = MP.stunT = 0; MP.rulers = [];
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
    el('mpWheel').style.display = 'none';
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
    el('mpWheel').style.display = 'none';
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

  /* ----------------------------------------------------------- HUD + wheel */
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
        '<br><span style="font-size:11px;color:#94a3c4">hold Q or right mouse, draw to a skill, let go</span>';
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

  function drawWheel() {
    var cv = el('mpWheel');
    if (cv.width !== window.innerWidth) { cv.width = window.innerWidth; cv.height = window.innerHeight; }
    var x = cv.getContext('2d');
    x.clearRect(0, 0, cv.width, cv.height);
    var cx = cv.width / 2, cy = cv.height / 2, R = 168, r0 = 58;
    var n = SKILLS.length;
    var vx = MP.wheelVec.x, vy = MP.wheelVec.y;
    var len = Math.hypot(vx, vy);
    var ang = Math.atan2(vy, vx);
    var pick = -1;
    if (len > 42) {
      var a = (ang + Math.PI * 2.5) % (Math.PI * 2);      // 0 at the top
      pick = Math.floor(a / (Math.PI * 2 / n)) % n;
    }
    MP.wheelPick = pick;

    for (var i = 0; i < n; i++) {
      var s = SKILLS[i];
      var a0 = -Math.PI / 2 + (i / n) * Math.PI * 2;
      var a1 = -Math.PI / 2 + ((i + 1) / n) * Math.PI * 2;
      var ready = skillReady(s.id);
      x.beginPath();
      x.arc(cx, cy, R, a0, a1);
      x.arc(cx, cy, r0, a1, a0, true);
      x.closePath();
      x.fillStyle = i === pick ? (ready ? 'rgba(77,108,245,.92)' : 'rgba(120,60,60,.9)')
        : (ready ? 'rgba(16,22,38,.86)' : 'rgba(16,22,38,.55)');
      x.fill();
      x.strokeStyle = 'rgba(255,255,255,.18)';
      x.lineWidth = 2;
      x.stroke();

      var am = (a0 + a1) / 2, rm = (R + r0) / 2;
      var tx = cx + Math.cos(am) * rm, ty = cy + Math.sin(am) * rm;
      x.textAlign = 'center';
      x.globalAlpha = ready ? 1 : 0.45;
      iconOnCanvas(x, s.id, tx, ty - 8, 30, '#ffffff');
      x.font = 'bold 12px system-ui';
      x.fillStyle = i === pick ? '#fff' : '#b9c3dc';
      x.fillText(s.name, tx, ty + 20);
      x.font = '10px system-ui';
      x.fillStyle = '#94a3c4';
      x.fillText(ready ? s.desc : Math.ceil(MP.cds[s.id]) + 's', tx, ty + 34);
      x.globalAlpha = 1;
    }

    /* the line you draw */
    x.strokeStyle = '#7fd7ff';
    x.lineWidth = 5;
    x.lineCap = 'round';
    x.beginPath();
    x.moveTo(cx, cy);
    x.lineTo(cx + vx, cy + vy);
    x.stroke();
    x.fillStyle = '#7fd7ff';
    x.beginPath(); x.arc(cx + vx, cy + vy, 7, 0, Math.PI * 2); x.fill();
    x.fillStyle = 'rgba(16,22,38,.9)';
    x.beginPath(); x.arc(cx, cy, r0 - 6, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#cfd8ee';
    x.font = 'bold 13px system-ui';
    x.textAlign = 'center';
    x.fillText('DRAW', cx, cy - 2);
    x.font = '11px system-ui';
    x.fillStyle = '#8b97b5';
    x.fillText('then let go', cx, cy + 14);
  }

  function openWheel() {
    if (!MP.active || MP.role !== 'hunter' || MP.over) return;
    MP.wheelOpen = true;
    MP.wheelVec.x = MP.wheelVec.y = 0;
    el('mpWheel').style.display = 'block';
    drawWheel();
  }
  function closeWheel(cast) {
    if (!MP.wheelOpen) return;
    MP.wheelOpen = false;
    el('mpWheel').style.display = 'none';
    if (cast && MP.wheelPick >= 0) useSkill(SKILLS[MP.wheelPick]);
    MP.wheelPick = -1;
  }

  function useSkill(s) {
    if (!skillReady(s.id)) { if (UI) UI.say(s.name + ' is not ready', 1200); return; }
    MP.cds[s.id] = s.cd;
    if (s.id === 'sprint') {
      MP.sprintT = 4;
      if (UI) UI.say('SPRINT!', 1500);
    } else if (s.id === 'listen') {
      MP.revealT = 5;
      if (UI) UI.say('LISTENING…', 1500);
      if (typeof Audio1 !== 'undefined') { try { Audio1.bell(); } catch (e) {} }
    } else if (s.id === 'ruler') {
      throwRuler();
    } else if (s.id === 'warp') {
      warpToNotebook();
    } else if (s.id === 'rage') {
      MP.rageT = 6;
      if (UI) UI.say('BALDI IS FURIOUS', 2000);
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

  function warpToNotebook() {
    var open = [];
    for (var i = 0; i < G.nbList.length; i++) if (!G.nbList[i].mpTaken) open.push(G.nbList[i]);
    if (!open.length) { if (UI) UI.say('No notebooks left to guard', 1600); return; }
    var t = open[Math.floor(Math.random() * open.length)];
    G.player.x = t.x; G.player.z = t.z;
    if (UI) UI.say('WARPED TO A NOTEBOOK', 1800);
    if (typeof Audio1 !== 'undefined') { try { Audio1.bell(); } catch (e) {} }
  }

  /* the ring draws itself back in as the skill recharges */
  function drawSkillBar() {
    for (var i = 0; i < SKILLS.length; i++) {
      var s = SKILLS[i];
      var d = el('mpsk_' + s.id);
      if (!d) continue;
      var cd = MP.cds[s.id] || 0;
      var frac = clamp01(cd / s.cd);
      var sweep = d.querySelector('.sweep');
      if (sweep) sweep.setAttribute('stroke-dashoffset', (RING * frac).toFixed(1));
      var num = d.querySelector('.num');
      if (num) num.textContent = cd > 0 ? String(Math.ceil(cd)) : '';
      d.className = 'sk ' + (cd > 0 ? 'cooling' : 'ready');
    }
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
      G.loadFactor = 1.18 * (MP.sprintT > 0 ? 1.75 : 1) * (MP.rageT > 0 ? 1.35 : 1);
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
    if (MP.wheelOpen) drawWheel();
    drawSkillBar();
  };

  function tickTimers(dt) {
    for (var k in MP.cds) if (MP.cds[k] > 0) MP.cds[k] = Math.max(0, MP.cds[k] - dt);
    if (MP.sprintT > 0) MP.sprintT -= dt;
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
  function bindInput() {
    window.addEventListener('keydown', function (e) {
      if (!MP.active || MP.role !== 'hunter') return;
      if (e.code === 'KeyQ' && !MP.wheelOpen && !e.repeat) { openWheel(); e.preventDefault(); }
    }, true);
    window.addEventListener('keyup', function (e) {
      if (e.code === 'KeyQ' && MP.wheelOpen) { closeWheel(true); e.preventDefault(); }
    }, true);
    window.addEventListener('mousedown', function (e) {
      if (!MP.active || MP.role !== 'hunter') return;
      if (e.button === 2) { openWheel(); e.preventDefault(); e.stopImmediatePropagation(); }
    }, true);
    window.addEventListener('mouseup', function (e) {
      if (e.button === 2 && MP.wheelOpen) { closeWheel(true); e.preventDefault(); e.stopImmediatePropagation(); }
    }, true);
    /* while the wheel is up the mouse draws instead of looking around */
    window.addEventListener('mousemove', function (e) {
      if (!MP.wheelOpen) return;
      MP.wheelVec.x += (e.movementX || 0);
      MP.wheelVec.y += (e.movementY || 0);
      var len = Math.hypot(MP.wheelVec.x, MP.wheelVec.y);
      if (len > 168) { MP.wheelVec.x *= 168 / len; MP.wheelVec.y *= 168 / len; }
      drawWheel();
      e.stopImmediatePropagation();
      e.preventDefault();
    }, true);
    window.addEventListener('contextmenu', function (e) { if (MP.active) e.preventDefault(); });
  }

  /* ----------------------------------------------------------------- boot */
  function start() {
    if (!document.getElementById('modeCards')) { setTimeout(start, 200); return; }
    injectUI();
    bindInput();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

})();
